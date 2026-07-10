import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";

const root = resolve(process.cwd());
const configPath = resolve(process.argv[2] || "scripts/architecture-check.config.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));
const issues = [];

let tracked = [];
let gitMetadataAvailable = true;
try {
  tracked = execFileSync("git", ["ls-files"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
    .split(/\r?\n/)
    .filter(Boolean);
} catch {
  gitMetadataAvailable = false;
}

if (gitMetadataAvailable) {
  for (const patternText of config.disallowedTrackedPathPatterns) {
    const pattern = new RegExp(patternText);
    for (const path of tracked.filter((item) => pattern.test(item))) {
      issues.push(`generated or machine-local path is tracked: ${path}`);
    }
  }
} else {
  console.warn("Architecture check: Git metadata unavailable; tracked-residue check skipped.");
}

const productionFiles = config.productionRoots.flatMap((directory) => walk(resolve(root, directory)))
  .filter((path) => [".js", ".mjs", ".ts", ".tsx"].includes(extname(path)));
const ratchetBaseRef = gitMetadataAvailable ? resolveRatchetBaseRef() : "";

for (const absolutePath of productionFiles) {
  const path = repoPath(absolutePath);
  const source = readFileSync(absolutePath, "utf8");
  const lineCount = sourceLineCount(source);
  const configuredLimit = config.lineLimitExceptions[path] || config.defaultMaxLines;
  const baselineLines = config.lineLimitExceptions[path] && ratchetBaseRef
    ? linesAtRef(ratchetBaseRef, path)
    : null;
  const limit = baselineLines == null ? configuredLimit : Math.min(configuredLimit, baselineLines);
  if (lineCount > limit) issues.push(`production module exceeds ${limit} lines: ${path} (${lineCount})`);
}

const productionPaths = productionFiles.map(repoPath);
for (const path of productionPaths.filter((item) => /^api\/[^/_][^/]*\.js$/.test(item))) {
  const source = readFileSync(resolve(root, path), "utf8");
  const allowedRequires = new Set([
    ...config.publicApiAllowedRequires,
    ...(config.publicApiRequireExceptions[path] || []),
  ]);
  for (const target of moduleSpecifiers(source)) {
    if (target.startsWith("./_") && !allowedRequires.has(target)) {
      issues.push(`public API handler imports disallowed internal module: ${path} -> ${target}`);
    }
  }
}

for (const directory of config.mobileLowerLayerRoots) {
  for (const absolutePath of walk(resolve(root, directory)).filter((path) => [".ts", ".tsx"].includes(extname(path)))) {
    const path = repoPath(absolutePath);
    const source = readFileSync(absolutePath, "utf8");
    for (const moduleSpecifier of moduleSpecifiers(source)) {
      const target = normaliseImportTarget(path, moduleSpecifier);
      if (config.mobileLowerLayerDisallowedImports.some((fragment) => target.includes(fragment))) {
        issues.push(`mobile lower layer imports UI layer: ${path} -> ${moduleSpecifier}`);
      }
    }
  }
}

if (issues.length) {
  console.error(`Architecture check failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

const trackedSummary = gitMetadataAvailable ? `${tracked.length} tracked files` : "source tree without Git metadata";
console.log(`Architecture check passed: ${trackedSummary}, ${productionFiles.length} production modules.`);

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

function sourceLineCount(source) {
  return source.split(/\r?\n/).length - (source.endsWith("\n") ? 1 : 0);
}

function resolveRatchetBaseRef() {
  const candidates = [
    process.env.FUEL_PATH_ARCHITECTURE_BASE_REF,
    config.lineRatchetBaseRef,
    "HEAD^1",
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      execFileSync("git", ["rev-parse", "--verify", `${candidate}^{commit}`], {
        cwd: root,
        stdio: ["ignore", "pipe", "pipe"],
      });
      return candidate;
    } catch {
      // Try the next available baseline.
    }
  }
  return "";
}

function linesAtRef(ref, path) {
  try {
    const source = execFileSync("git", ["show", `${ref}:${path}`], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return sourceLineCount(source);
  } catch {
    return null;
  }
}

function moduleSpecifiers(source) {
  const specifiers = [];
  const patterns = [
    /require\s*\(\s*["']([^"']+)["']\s*\)/g,
    /(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g,
    /import\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  }
  return [...new Set(specifiers)];
}
