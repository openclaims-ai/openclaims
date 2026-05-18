import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = ["packages", "scripts"];
const files = roots
  .flatMap((root) => list(root))
  .filter((file) => file.endsWith(".js") || file.endsWith(".mjs"))
  .filter((file) => !file.endsWith("packages/validator-cli/src/index.js"))
  .filter((file) => !file.endsWith("packages/collector/src/index.js"))
  .filter((file) => !file.endsWith("scripts/check-js.mjs"))
  .filter((file) => !file.endsWith("scripts/run-tests.mjs"))
  .filter((file) => !file.endsWith("scripts/generate-fixtures.mjs"))
  .filter((file) => !file.endsWith("scripts/verify-collector.mjs"));

for (const file of files) {
  await import(new URL(`../${file}`, import.meta.url));
}

console.log(`checked ${files.length} JavaScript modules`);

function list(root) {
  try {
    return readdirSync(root).flatMap((name) => {
      const path = join(root, name);
      if (name === "node_modules") return [];
      return statSync(path).isDirectory() ? list(path) : [path];
    });
  } catch {
    return [];
  }
}
