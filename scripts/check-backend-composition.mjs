import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";

const root = resolve(process.cwd());
const contract = JSON.parse(readFileSync(resolve(root, "scripts/backend-composition-contract.json"), "utf8"));
const backendPath = resolve(root, "api/_backend.js");
const backendSource = readFileSync(backendPath, "utf8");
const exports = backendExports(backendSource);
const consumers = walk(resolve(root, "api"))
  .filter((path) => extname(path) === ".js")
  .filter((path) => /require\s*\(\s*["'](?:\.\.\/|\.\/)_backend["']\s*\)/.test(readFileSync(path, "utf8")))
  .map(repoPath)
  .sort();

const expectedExports = [...contract.backendExports].sort();
const expectedConsumers = [...contract.backendConsumers].sort();
const issues = [];
compare("backend exports", expectedExports, exports, issues);
compare("backend consumers", expectedConsumers, consumers, issues);

if (issues.length) {
  console.error("Backend composition contract failed:");
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

const lineCount = backendSource.split(/\r?\n/).length - (backendSource.endsWith("\n") ? 1 : 0);
console.log(`Backend composition contract passed: ${exports.length} exports, ${consumers.length} consumers, ${lineCount} _backend.js lines.`);

function backendExports(source) {
  const match = source.match(/module\.exports\s*=\s*\{([\s\S]*?)\n\};\s*$/);
  if (!match) throw new Error("Could not read the api/_backend.js export block.");
  return match[1]
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .sort();
}

function compare(label, expected, actual, issues) {
  const missing = expected.filter((item) => !actual.includes(item));
  const added = actual.filter((item) => !expected.includes(item));
  if (missing.length) issues.push(`${label} missing: ${missing.join(", ")}`);
  if (added.length) issues.push(`${label} added without contract update: ${added.join(", ")}`);
}

function walk(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function repoPath(path) {
  return relative(root, path).split(sep).join("/");
}
