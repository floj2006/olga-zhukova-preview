import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { createSiteServer } from '../scripts/serve.mjs';
const server = await createSiteServer({dataDir: await mkdtemp('artifacts/gallery-react-'), env: {NODE_ENV:'test'}});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch();
const context = await browser.newContext({reducedMotion:'reduce', viewport:{width:1440,height:1000}});
const page = await context.newPage(), errors = [];
page.on('pageerror', error => errors.push(error.message));
let release = () => {};
try {
  const catalog = await (await page.request.get(base + '/api/catalog')).json();
  const photos = [
    {id:'test-real-shape-1',url:'/images/evening-768.webp',alt:'Тестовый кадр 1',caption:'<img src=x onerror=alert(1)>',width:768,height:512,published:true,featured:true},
    {id:'test-real-shape-2',url:'/images/banquet-768.webp',alt:'Тестовый кадр 2',caption:'Вторая подпись',width:768,height:512,published:true},
    {id:'test-draft',url:'/images/olga-480.webp',alt:'Черновик',published:false},
    {id:'test-invalid',url:'javascript:alert(1)',alt:'Некорректная ссылка',published:true},
  ];
  let calls = 0;
  await page.route('**/api/catalog', route => { calls++; return route.fulfill({json:{...catalog,gallery:photos}}); });
  const files = await readdir('.next/static/chunks');
  const matches = [];
  for(const file of files.filter(file=>file.endsWith('.js'))) {
    if((await readFile('.next/static/chunks/'+file,'utf8')).includes('lightbox-stage')) matches.push(file);
  }
  assert.equal(matches.length,1,'Lightbox is a separate code chunk');
  const chunk = matches[0], requests = [];
  page.on('request', request => { if(request.url().includes(chunk)) requests.push(request.url()); });
  await page.goto(base,{waitUntil:'networkidle'});
  await expect(page.locator('.gallery-item')).toHaveCount(2);
  await expect(page.locator('.gallery-item').first().locator('figcaption')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('.gallery-item figcaption img')).toHaveCount(0);
  assert.equal(calls,1,'Gallery and calculator share a catalog request');
  assert.deepEqual(requests,[],'Lightbox code is not loaded with the page');
  const gate = new Promise(resolve => {release=resolve;});
  await page.route('**/'+chunk, async route => {await gate; await route.continue();});
  await page.locator('.gallery-open').first().click();
  await expect(page.locator('.gallery-feedback')).toHaveText('Открываем фотографию…');
  await page.keyboard.press('Escape');
  await expect(page.locator('.gallery-feedback')).toBeEmpty();
  release();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#gallery-lightbox')).toHaveCount(0);
  await expect(page.locator('.gallery-open').first()).toBeFocused();
  await page.locator('.gallery-open').first().click();
  await expect(page.locator('#gallery-lightbox')).toBeVisible();
  assert.ok(requests.length>0,'Lightbox was requested on demand');
  await expect(page.locator('#lightbox-counter')).toHaveText('01 / 02');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#lightbox-counter')).toHaveText('02 / 02');
  for(const width of [1440,390,320]) {
    await page.setViewportSize({width,height:900});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    const audit = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    assert.deepEqual(audit.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[]);
    await page.screenshot({path:'artifacts/react-gallery-'+width+'.png'});
  }
  await page.locator('.lightbox-close').click();
  await expect(page.locator('.gallery-open').first()).toBeFocused();
  await expect(page.locator('body')).not.toHaveClass(/dialog-open/);
  await page.route('**/api/catalog',route=>route.fulfill({json:{...catalog,gallery:[photos[0]]}}));
  await page.reload({waitUntil:'networkidle'});
  await page.locator('.gallery-open').click();
  await expect(page.locator('.lightbox-next')).toBeHidden();
  await expect(page.locator('.lightbox-prev')).toBeHidden();
  await page.keyboard.press('Escape');
  await page.route('**/api/catalog',route=>route.fulfill({json:{...catalog,gallery:[]}}));
  await page.reload({waitUntil:'networkidle'});
  await expect(page.locator('#gallery')).toBeHidden();
  await expect(page.locator('[data-gallery-link]:visible')).toHaveCount(0);
  assert.deepEqual(errors,[]);
  console.log('PASS: React gallery, shared catalog, safe captions/URLs, draft filtering, lazy chunk, cancellation, keyboard/focus, single/empty gallery, mobile and axe.');
} finally {release(); await browser.close(); await new Promise(resolve=>server.close(resolve));}
