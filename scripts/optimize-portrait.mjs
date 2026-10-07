// Optional asset preparation, using the project's existing browser tooling.
// Re-encodes the supplied portrait without changing its crop or colors.
import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
const source = await readFile(new URL("../dist/olga.jpg", import.meta.url));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const variants = await page.evaluate(async data => {
    const image = new Image();
    image.src = `data:image/jpeg;base64,${data}`;
    await image.decode();
    return [480, 768, 1024].map(width => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = Math.round(image.naturalHeight * width / image.naturalWidth);
      const context = canvas.getContext("2d");
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return { width, data: canvas.toDataURL("image/webp", .88) };
    });
  }, source.toString("base64"));
  for (const variant of variants) {
    if (!variant.data.startsWith("data:image/webp;base64,")) throw new Error("WebP encoding unavailable.");
    const bytes = Buffer.from(variant.data.split(",")[1], "base64");
    await writeFile(new URL(`../dist/images/olga-${variant.width}.webp`, import.meta.url), bytes);
    console.log(`${variant.width}px: ${bytes.length} bytes (original ${source.length})`);
  }
} finally {
  await browser.close();
}
