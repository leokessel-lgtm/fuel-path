import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";

const root = resolve(process.cwd());
const configPath = resolve(process.argv[2] || "scripts/architecture-check.config.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));
const issues = [];

const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean);

for (const patternText of config.disallowedTrackedPathPatterns) {
  const pattern = new RegExp(patternText);
  for (const path of tracked.filter((item) => pattern.test(item))) {
    issues.push(`generated or machine-local path is tracked: ${path}`);
  }
}

const productionFiles = config.productionRoots.flatMap((directory) => walk(resolve(root, directory)))
  .filter((path) => [".js", ".mjs", ".ts", ".tsx"].includes(extname(path)));

for (const absolutePath of productionFiles) {
  const path = repoPath(absolutePath);
  const source = readFileSync(absolutePath, "utf8");
  const lineCount = source.split(/\r?\n/).length - (source.endsWith("\n") ? 1 : 0);
  const limit = config.lineLimitExceptions[path] || config.defaultMaxLines;
  if (lineCount > limit) issues.push(`production module exceeds ${limit} lines: ${path} (${lineCount})`);
}

for (const path of tracked.filter((item) => /^api\/[^/_][^/]*\.js$/.test(item))) {
  const source = readFileSync(resolve(root, path), "utf8");
  const allowedRequires = new Set([
    ...config.publicApiAllowedRequires,
    ...(config.publicApiRequireExceptions[path] || []),
  ]);
  for (const match of source.matchAll(/require\(["']([^"']+)["']\)/g)) {
    if (match[1].startsWith("./_") && !allowedRequires.has(match[1])) {
      issues.push(`public API handler imports disallowed internal module: ${path} -> ${match[1]}`);
    }
  }
}

for (const directory of config.mobileLowerLayerRoots) {
  for (const absolutePath of walk(resolve(root, directory)).filter((path) => [".ts", ".tsx"].includes(extname(path)))) {
    const path = repoPath(absolutePath);
    const source = readFileSync(absolutePath, "utf8");
    for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) {
      const target = normaliseImportTarget(path, match[1]);
      if (config.mobileLowerLayerDisallowedImports.some((fragment) => target.includes(fragment))) {
        issues.push(`mobile lower layer imports UI layer: ${path} -> ${match[1]}`);
      }
    }
  }
}

if (issues.length) {
  console.error(`Architecture check failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`Architecture check passed: ${tracked.length} tracked files, ${productionFiles.length} production modules.`);

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

function normaliseImportTarget(sourcePath, target) {
  if (!target.startsWith(".")) return target;
  const sourceDirectory = sourcePath.slice(0, sourcePath.lastIndexOf("/"));
  return `/${repoPath(resolve(root, sourceDirectory, target))}`;
}
