import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";

const target = new URL("../dist/fonts/", import.meta.url);
await mkdir(target, { recursive: true });
const blocks = [];
for (const name of ["cormorant-garamond", "manrope"]) {
  const source = new URL(
    `../node_modules/@fontsource-variable/${name}/`,
    import.meta.url,
  );
  const styles =
    name === "cormorant-garamond"
      ? ["index.css", "wght-italic.css"]
      : ["index.css"];
  for (const style of styles) {
    const css = await readFile(new URL(style, source), "utf8");
    for (const face of css.match(/@font-face\s*\{[^}]+\}/g)) {
      const filename = face.match(/\.\/files\/([^)]*)/)[1];
      if (!/-(cyrillic|latin)-wght-/.test(filename)) continue;
      await copyFile(
        new URL(`files/${filename}`, source),
        new URL(filename, target),
      );
      blocks.push(
        face.replaceAll(" Variable", "").replace("./files/", "fonts/"),
      );
    }
  }
  await copyFile(
    new URL("LICENSE", source),
    new URL(`${name}-LICENSE.txt`, target),
  );
}
await writeFile(
  new URL("../dist/fonts.css", import.meta.url),
  blocks.join("\n\n") + "\n",
);
console.log(`${blocks.length} font subsets prepared locally.`);
