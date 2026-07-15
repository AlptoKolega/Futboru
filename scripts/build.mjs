import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const output = new URL("../dist/", import.meta.url);
const fontOutput = new URL("assets/fonts/", output);
const flagOutput = new URL("assets/flags/", output);

await rm(output, { force: true, recursive: true });
await mkdir(output, { recursive: true });
await mkdir(fontOutput, { recursive: true });

for (const entry of ["index.html", "styles.css", "app.js", ".nojekyll"]) {
  await cp(new URL(`../${entry}`, import.meta.url), new URL(entry, output));
}

let index = await readFile(new URL("index.html", output), "utf8");

for (const asset of ["styles.css", "app.js"]) {
  const reference = `./${asset}`;
  const contents = await readFile(new URL(asset, output));
  const fingerprint = createHash("sha256").update(contents).digest("hex").slice(0, 12);
  const extensionIndex = asset.lastIndexOf(".");
  const versionedAsset = `${asset.slice(0, extensionIndex)}.${fingerprint}${asset.slice(extensionIndex)}`;

  if (!index.includes(reference)) {
    throw new Error(`Missing ${reference} reference in index.html`);
  }

  await cp(new URL(asset, output), new URL(versionedAsset, output));
  index = index.replace(reference, `./${versionedAsset}`);
}

await writeFile(new URL("index.html", output), index);

await cp(new URL("../data/", import.meta.url), new URL("data/", output), { recursive: true });
await cp(new URL("../node_modules/flag-icons/flags/4x3/", import.meta.url), flagOutput, { recursive: true });
await cp(new URL("../node_modules/flag-icons/LICENSE", import.meta.url), new URL("LICENSE.txt", flagOutput));

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
