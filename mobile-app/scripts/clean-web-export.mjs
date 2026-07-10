import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const argumentIndex = process.argv.indexOf("--output-dir");
const requested = argumentIndex >= 0 ? process.argv[argumentIndex + 1] : "dist";
const target = path.resolve(root, requested || "dist");
const relativeTarget = path.relative(root, target);

if (!relativeTarget || relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) {
  console.error(`Refusing to clean web export outside a child of mobile-app: ${target}`);
  process.exit(1);
}

fs.rmSync(target, { force: true, recursive: true });
console.log(`Cleaned web export: ${relativeTarget}`);
