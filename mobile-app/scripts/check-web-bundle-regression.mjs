import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const baselinePath = path.join(root, "build-baselines", "web-bundle.json");
const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
const files = listFiles(path.join(root, "dist"));
const metrics = {
  webDistTotalBytes: files.reduce((sum, file) => sum + file.size, 0),
  webLargestFileBytes: files.reduce((largest, file) => Math.max(largest, file.size), 0),
  webJsTotalBytes: files.filter((file) => file.path.endsWith(".js")).reduce((sum, file) => sum + file.size, 0),
};
const failures = [];

for (const [metric, actual] of Object.entries(metrics)) {
  const allowed = Number(baseline[metric]);
  const ok = Number.isFinite(allowed) && actual <= allowed;
  console.log(`${ok ? "OK" : "FAIL"} ${metric}: ${actual} / ${allowed}`);
  if (!ok) failures.push(metric);
}

if (failures.length) {
  console.error(`Web bundle regression detected: ${failures.join(", ")}`);
  process.exit(1);
}

function listFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(target);
    if (!entry.isFile()) return [];
    return [{ path: target, size: fs.statSync(target).size }];
  });
}
