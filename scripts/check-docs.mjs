import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, extname, relative, resolve, sep } from "node:path";

const args = parseArgs(process.argv.slice(2));
const root = resolve(args.root || process.cwd());
const configPath = args.config ? resolve(args.config) : resolve(root, "scripts/docs-check.config.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));
const allFiles = discoverFiles(root);
const markdownFiles = allFiles.filter((path) => extname(path).toLowerCase() === ".md");
const documentFiles = allFiles.filter((path) => [".md", ".json"].includes(extname(path).toLowerCase()));
const relevantTextFiles = allFiles.filter(isRelevantTextPath);
const failures = [];

const allowedRootMarkdown = new Set(config.allowedRootMarkdown);

for (const path of config.requiredDocuments) {
  if (!existsSync(resolve(root, path))) failures.push(`missing required document: ${path}`);
}

for (const path of markdownFiles) {
  if (!path.includes("/") && !allowedRootMarkdown.has(path)) {
    failures.push(`unapproved root Markdown document: ${path}`);
  }

  const text = readFileSync(resolve(root, path), "utf8");
  for (const link of markdownTargets(text)) {
    const localPath = localLinkPath(link);
    if (!localPath) continue;
    const resolvedPath = resolve(root, dirname(path), localPath);
    if (!existsSync(resolvedPath)) failures.push(`broken link: ${path} -> ${link}`);
  }
}

for (const path of documentFiles) {
  if (path.startsWith("docs/templates/")) {
    const name = basename(path).toLowerCase();
    if (!config.templateLabelTerms.some((term) => name.includes(term))) {
      failures.push(`template folder contains an unlabelled artefact: ${path}`);
    }
  }

  if (path.startsWith("docs/03-provider-data/evidence/") && !path.startsWith("docs/03-provider-data/evidence/historical/")) {
    const name = basename(path);
    if (config.providerEvidenceDisallowedNamePatterns.some((pattern) => name.toLowerCase().includes(pattern.toLowerCase()))) {
      failures.push(`provider implementation or decision file is under evidence: ${path}`);
    }
  }
}

const providerIndexPath = resolve(root, "docs/03-provider-data/README.md");
if (existsSync(providerIndexPath)) {
  const providerIndex = readFileSync(providerIndexPath, "utf8");
  for (const state of config.requiredProviderStates) {
    if (!providerIndex.includes(state)) failures.push(`provider index is missing readiness state: ${state}`);
  }
}

for (const path of relevantTextFiles) {
  if (resolve(root, path) === configPath) continue;
  const fullPath = resolve(root, path);
  let text = "";
  try {
    text = readFileSync(fullPath, "utf8");
  } catch {
    continue;
  }
  for (const fragment of config.stalePathFragments) {
    if (text.includes(fragment)) failures.push(`stale moved-path reference in ${path}: ${fragment}`);
  }
}

if (failures.length) {
  console.error(`Documentation check failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Documentation check passed: ${markdownFiles.length} Markdown files, ${documentFiles.length} Markdown/JSON files, ${relevantTextFiles.length} text files scanned for stale paths.`,
);

function discoverFiles(directory) {
  const files = [];
  walk(directory);
  return files.sort();

  function walk(currentDirectory) {
    for (const entry of readdirSync(currentDirectory, { withFileTypes: true })) {
      const absolutePath = resolve(currentDirectory, entry.name);
      const repositoryPath = relative(root, absolutePath).split(sep).join("/");
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (config.excludedDirectoryNames.includes(entry.name) || isExcludedPath(repositoryPath)) continue;
        walk(absolutePath);
        continue;
      }
      if (entry.isFile() && !isExcludedPath(repositoryPath)) files.push(repositoryPath);
    }
  }
}

function isExcludedPath(path) {
  return config.excludedPaths.some((excludedPath) => path === excludedPath || path.startsWith(`${excludedPath}/`));
}

function isRelevantTextPath(path) {
  const name = basename(path);
  return config.textFileNames.includes(name) || config.textFileExtensions.includes(extname(path).toLowerCase());
}

function markdownTargets(text) {
  const targets = [];
  const inlinePattern = /\[[^\]]*\]\(([^)]+)\)/g;
  const referencePattern = /^\[[^\]]+\]:\s*(\S+)/gm;
  for (const pattern of [inlinePattern, referencePattern]) {
    let match;
    while ((match = pattern.exec(text))) targets.push(match[1]);
  }
  return targets;
}

function localLinkPath(rawTarget) {
  let target = String(rawTarget || "").trim().replace(/^<|>$/g, "");
  target = target.split(/\s+["']/)[0];
  if (!target || /^(?:https?:|mailto:|tel:|data:|#)/i.test(target)) return "";
  target = target.split("#")[0].split("?")[0];
  if (!target) return "";
  try {
    return decodeURIComponent(target);
  } catch {
    return target;
  }
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--root") parsed.root = argv[++index];
    else if (argv[index] === "--config") parsed.config = argv[++index];
  }
  return parsed;
}
