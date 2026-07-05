import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(mobileRoot, "..");
const source = path.join(repoRoot, "shared", "discountRegistry.json");
const target = path.join(mobileRoot, "src", "data", "discountRegistry.generated.json");

const registry = JSON.parse(fs.readFileSync(source, "utf8"));
if (!Array.isArray(registry)) {
  throw new Error("shared/discountRegistry.json must contain an array");
}

fs.writeFileSync(target, `${JSON.stringify(registry, null, 2)}\n`);
console.log(`Synced ${registry.length} discount programmes to ${path.relative(mobileRoot, target)}`);
