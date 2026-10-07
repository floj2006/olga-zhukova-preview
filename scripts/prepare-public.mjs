import {readFile,writeFile} from 'node:fs/promises';
const catalog=JSON.parse(await readFile(new URL('../server/catalog-default.json',import.meta.url),'utf8'));
await writeFile(new URL('../public/catalog.json',import.meta.url),JSON.stringify(catalog,null,2)+'\n');
