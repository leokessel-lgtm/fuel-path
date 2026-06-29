import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

const budgets = {
  webDistTotalBytes: 2_500_000,
  webLargestFileBytes: 750_000,
  webJsTotalBytes: 1_100_000,
  sourceAssetsTotalBytes: 1_500_000,
  sourceLargestAssetBytes: 512_000,
  brandIconsTotalBytes: 900_000,
  brandIconLargestBytes: 64_000,
  nativeAndroidApkBytes: 80_000_000,
  nativeAndroidAabBytes: 90_000_000,
  nativeIosIpaBytes: 120_000_000,
};

const checks = [
  checkDirectoryBudget("web export total", path.join(root, "dist"), budgets.webDistTotalBytes),
  checkLargestFile("web largest file", path.join(root, "dist"), budgets.webLargestFileBytes),
  checkExtensionTotal("web JavaScript total", path.join(root, "dist"), ".js", budgets.webJsTotalBytes),
  checkDirectoryBudget("source assets total", path.join(root, "assets"), budgets.sourceAssetsTotalBytes),
  checkLargestFile("source largest asset", path.join(root, "assets"), budgets.sourceLargestAssetBytes),
  checkDirectoryBudget("brand icons total", path.join(root, "assets", "brand-icons"), budgets.brandIconsTotalBytes),
  checkLargestFile("brand largest icon", path.join(root, "assets", "brand-icons"), budgets.brandIconLargestBytes),
  ...checkNativeArtifactBudgets(),
];

const failed = checks.filter((check) => !check.ok);

for (const check of checks) {
  const prefix = check.ok ? (check.skipped ? "SKIP" : "OK") : "FAIL";
  const note = check.note ? ` - ${check.note}` : "";
  console.log(`${prefix} ${check.label}: ${formatBytes(check.actual)} / ${formatBytes(check.budget)}${check.file ? ` (${relative(check.file)})` : ""}${note}`);
}

if (failed.length) {
  console.error(`Bundle/asset budget failed: ${failed.map((check) => check.label).join(", ")}`);
  process.exit(1);
}

function checkDirectoryBudget(label, directory, budget) {
  const actual = directorySize(directory);
  return { label, actual, budget, ok: actual <= budget };
}

function checkLargestFile(label, directory, budget) {
  const files = listFiles(directory);
  const largest = files.reduce((best, file) => (file.size > best.size ? file : best), { size: 0, file: "" });
  return { label, actual: largest.size, budget, ok: largest.size <= budget, file: largest.file };
}

function checkExtensionTotal(label, directory, extension, budget) {
  const actual = listFiles(directory)
    .filter((file) => file.file.endsWith(extension))
    .reduce((total, file) => total + file.size, 0);
  return { label, actual, budget, ok: actual <= budget };
}

function checkNativeArtifactBudgets() {
  const artifacts = nativeArtifactFiles();
  if (!artifacts.length) {
    return [
      {
        label: "native preview artifact",
        actual: 0,
        budget: 0,
        ok: true,
        skipped: true,
        note: "no APK/AAB/IPA artifact found",
      },
    ];
  }
  return artifacts.map((file) => {
    const extension = path.extname(file.file).toLowerCase();
    const budget = extension === ".apk"
      ? budgets.nativeAndroidApkBytes
      : extension === ".aab"
        ? budgets.nativeAndroidAabBytes
        : budgets.nativeIosIpaBytes;
    return {
      label: `native ${extension.slice(1).toUpperCase()} artifact`,
      actual: file.size,
      budget,
      ok: file.size <= budget,
      file: file.file,
    };
  });
}

function nativeArtifactFiles() {
  const explicit = String(process.env.FUEL_PATH_NATIVE_ARTIFACT || "").trim();
  const roots = explicit
    ? [path.resolve(root, explicit)]
    : [
        path.join(root, "dist-native"),
        path.join(root, "native-artifacts"),
        path.join(root, "build"),
      ];
  const files = roots.flatMap((target) => {
    if (!fs.existsSync(target)) return [];
    const stat = fs.statSync(target);
    if (stat.isFile()) return nativeArtifactExtension(target) ? [{ file: target, size: stat.size }] : [];
    if (!stat.isDirectory()) return [];
    return listFiles(target).filter((file) => nativeArtifactExtension(file.file));
  });
  if (explicit) return files;
  return newestByNativeArtifactType(files);
}

function nativeArtifactExtension(file) {
  return [".apk", ".aab", ".ipa"].includes(path.extname(file).toLowerCase());
}

function newestByNativeArtifactType(files) {
  const latest = new Map();
  for (const file of files) {
    const extension = path.extname(file.file).toLowerCase();
    const mtimeMs = fs.statSync(file.file).mtimeMs;
    const existing = latest.get(extension);
    if (!existing || mtimeMs > existing.mtimeMs) latest.set(extension, { ...file, mtimeMs });
  }
  return [...latest.values()].map(({ mtimeMs, ...file }) => file);
}

function directorySize(directory) {
  return listFiles(directory).reduce((total, file) => total + file.size, 0);
}

function listFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(file);
    if (!entry.isFile()) return [];
    return [{ file, size: fs.statSync(file).size }];
  });
}

function relative(file) {
  return path.relative(root, file);
}

function formatBytes(value) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}
