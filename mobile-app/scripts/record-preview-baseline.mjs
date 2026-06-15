import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const outputPath = resolve("build-baselines/eas-preview.json");

function parseArgs(argv) {
  const values = {};

  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];

    if (!part.startsWith("--")) {
      continue;
    }

    const [rawKey, inlineValue] = part.slice(2).split("=");
    const key = rawKey.trim();
    const value = inlineValue ?? argv[index + 1];

    if (!inlineValue) {
      index += 1;
    }

    values[key] = value;
  }

  return values;
}

function numericField(values, key) {
  const value = Number(values[key]);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Missing or invalid --${key}. Use a positive number.`);
  }

  return value;
}

function readBaselineFile() {
  try {
    return JSON.parse(readFileSync(outputPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }

    return {
      schemaVersion: 1,
      warningThresholdPercent: 10,
      records: [],
    };
  }
}

const args = parseArgs(process.argv.slice(2));
const platform = args.platform;

if (!["android", "ios"].includes(platform)) {
  throw new Error("Missing or invalid --platform. Use android or ios.");
}

if (!args["build-id"]) {
  throw new Error("Missing --build-id.");
}

const data = readBaselineFile();
const previousPlatformRecords = data.records.filter((record) => record.platform === platform);
const firstPlatformRecord = previousPlatformRecords[0];
const installSizeMb = numericField(args, "install-size-mb");
const downloadSizeMb = numericField(args, "download-size-mb");
const coldStartMs = numericField(args, "cold-start-ms");
const installGrowthPercent = firstPlatformRecord
  ? ((installSizeMb - firstPlatformRecord.installSizeMb) / firstPlatformRecord.installSizeMb) * 100
  : 0;
const downloadGrowthPercent = firstPlatformRecord
  ? ((downloadSizeMb - firstPlatformRecord.downloadSizeMb) / firstPlatformRecord.downloadSizeMb) * 100
  : 0;

const record = {
  recordedAt: new Date().toISOString(),
  profile: "preview",
  platform,
  buildId: args["build-id"],
  installSizeMb,
  downloadSizeMb,
  coldStartMs,
  notes: args.notes ?? "",
};

data.records.push(record);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`);

console.log(`Recorded ${platform} preview baseline: ${args["build-id"]}`);

if (firstPlatformRecord) {
  const threshold = data.warningThresholdPercent;

  if (installGrowthPercent > threshold) {
    console.warn(
      `Install size grew ${installGrowthPercent.toFixed(1)}% from first ${platform} baseline.`,
    );
  }

  if (downloadGrowthPercent > threshold) {
    console.warn(
      `Download size grew ${downloadGrowthPercent.toFixed(1)}% from first ${platform} baseline.`,
    );
  }
}
