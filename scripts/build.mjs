import { cp, mkdir, rm } from "node:fs/promises";

const output = new URL("../dist/", import.meta.url);
const fontOutput = new URL("assets/fonts/", output);

await rm(output, { force: true, recursive: true });
await mkdir(output, { recursive: true });
await mkdir(fontOutput, { recursive: true });

for (const entry of ["index.html", "styles.css", "app.js", ".nojekyll"]) {
  await cp(new URL(`../${entry}`, import.meta.url), new URL(entry, output));
}

await cp(new URL("../data/", import.meta.url), new URL("data/", output), { recursive: true });

for (const font of [
  "instrument-sans-latin-ext-wght-normal.woff2",
  "instrument-sans-latin-wght-normal.woff2",
]) {
  await cp(
    new URL(`../node_modules/@fontsource-variable/instrument-sans/files/${font}`, import.meta.url),
    new URL(font, fontOutput),
  );
}

console.log("Built: dist/");
