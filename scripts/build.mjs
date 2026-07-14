import { cp, mkdir, rm } from "node:fs/promises";

const output = new URL("../dist/", import.meta.url);

await rm(output, { force: true, recursive: true });
await mkdir(output, { recursive: true });

for (const entry of ["index.html", "styles.css", "app.js", ".nojekyll"]) {
  await cp(new URL(`../${entry}`, import.meta.url), new URL(entry, output));
}

await cp(new URL("../data/", import.meta.url), new URL("data/", output), { recursive: true });

console.log("Gotowe: dist/");
