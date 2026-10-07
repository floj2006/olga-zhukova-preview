import { readdir, readFile, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
async function files(directory) {
  const result = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) result.push(...(await files(file)));
    else result.push(file);
  }
  return result;
}
let checked = 0;
for (const folder of ["public", "server", "scripts", "lib"]) {
  for (const file of await files(path.join(root, folder))) {
    if (/\.(?:js|mjs)$/.test(file)) {
      const result = spawnSync(process.execPath, ["--check", file], {
        encoding: "utf8",
        windowsHide: true,
      });
      if (result.status !== 0)
        throw new Error(result.stderr || `Invalid JavaScript: ${file}`);
      checked++;
    }
    if (file.endsWith(".css") && (await readFile(file, "utf8")).includes("\uFEFF")) {
      throw new Error("CSS contains a BOM that can break imported selectors: " + path.relative(root, file));
    }
    if (file.endsWith(".json")) JSON.parse(await readFile(file, "utf8"));
    if (file.endsWith(".html")) {
      const html = await readFile(file, "utf8");
      for (const [, value] of html.matchAll(
        /(?:src|href)="([^"?#]+)(?:[?#][^"]*)?"/g,
      )) {
        if (/^(?:[a-z]+:|\/\/)/i.test(value)) continue;
        const target = value.startsWith("/")
          ? path.join(root, "dist", value)
          : path.resolve(path.dirname(file), value);
        await stat(target).catch(() => {
          throw new Error(
            `Missing production asset: ${value} in ${path.relative(root, file)}`,
          );
        });
      }
    }
  }
}
JSON.parse(await readFile(path.join(root, "vercel.json"), "utf8"));
console.log(
  `Next support modules are ready: ${checked} JavaScript modules, JSON and static asset references checked. Next components are validated by npm run build.`,
);
