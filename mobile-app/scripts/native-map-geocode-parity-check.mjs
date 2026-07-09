import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, extname, isAbsolute, relative, resolve } from "node:path";

const appRoot = process.cwd();
const repoRoot = resolve(appRoot, "..");
const args = parseArgs(process.argv.slice(2));
const allowStale =
  Boolean(args["allow-stale"]) || process.env.FUEL_PATH_NATIVE_PARITY_ALLOW_STALE === "1";
const maxAgeHours = Number(
  args["max-age-hours"] || process.env.FUEL_PATH_NATIVE_PARITY_MAX_AGE_HOURS || 36,
);
const validationPath = resolveInput(
  args.validation || process.env.FUEL_PATH_NATIVE_PARITY_VALIDATION || "NATIVE-VALIDATION.md",
);
const evidenceDirs = String(
  args["evidence-dir"] || process.env.FUEL_PATH_NATIVE_PARITY_EVIDENCE_DIR || "",
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)
  .map(resolveInput);
const searchDirs = evidenceDirs.length
  ? evidenceDirs
  : [
      resolve(appRoot, "tmp/native-smoke"),
      resolve(appRoot, "tmp/native-typography"),
      resolve(repoRoot, "tmp/native-smoke"),
    ];

const failures = [];

function requireFile(path, label) {
  if (!existsSync(path)) failures.push(`${label} missing: ${path}`);
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function resolveInput(value) {
  if (!value) return "";
  if (isAbsolute(value)) return value;
  const candidates = [resolve(appRoot, value), resolve(repoRoot, value), resolve(process.cwd(), value)];
  return candidates.find((candidate) => existsSync(candidate)) || resolve(appRoot, value);
}

function listEvidenceFiles(dirs) {
  return dirs.flatMap((dir) => {
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .map((entry) => resolve(dir, entry))
      .filter((path) => {
        try {
          return statSync(path).isFile();
        } catch {
          return false;
        }
      });
  });
}

function fileAgeHours(path) {
  return (Date.now() - statSync(path).mtimeMs) / (1000 * 60 * 60);
}

function isFresh(path) {
  return allowStale || fileAgeHours(path) <= maxAgeHours;
}

function requireFresh(path, label) {
  if (!existsSync(path) || allowStale) return;
  const ageHours = fileAgeHours(path);
  if (ageHours > maxAgeHours) {
    failures.push(
      `${label} is stale (${ageHours.toFixed(1)}h old): ${displayPath(path)}. Pass --allow-stale only for historical audits.`,
    );
  }
}

function latestMatchingFile(extensions, namePatterns = [], contentMatcher = null) {
  return listEvidenceFiles(searchDirs)
    .filter((path) => extensions.includes(extname(path).toLowerCase()))
    .filter((path) => isFresh(path))
    .filter((path) => !namePatterns.length || namePatterns.some((pattern) => pattern.test(basename(path))))
    .filter((path) => {
      if (!contentMatcher) return true;
      try {
        return contentMatcher(readFileSync(path, "utf8"));
      } catch {
        return false;
      }
    })
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)[0];
}

function displayPath(path) {
  if (path.startsWith(`${repoRoot}/`)) return relative(repoRoot, path);
  if (path.startsWith(`${appRoot}/`)) return relative(appRoot, path);
  return path;
}

function requireText(source, pattern, label) {
  if (!pattern.test(source)) failures.push(label);
}

const explicitXmlPath = resolveInput(args.xml || process.env.FUEL_PATH_NATIVE_PARITY_XML || "");
const explicitScreenshotPath = resolveInput(args.screenshot || process.env.FUEL_PATH_NATIVE_PARITY_SCREENSHOT || "");
const xmlPath =
  explicitXmlPath ||
  latestMatchingFile([".xml"], [/route|plan|fuelpath/i], (xml) => {
    return /Sylvania/i.test(xml) && /Newcastle/i.test(xml) && /Route charger options/i.test(xml);
  }) ||
  "";
const screenshotPath =
  explicitScreenshotPath ||
  siblingScreenshotForXml(xmlPath) ||
  latestMatchingFile([".png", ".jpg", ".jpeg"], [/ev-route|route|plan/i]) ||
  "";

const evidenceStemMismatch =
  screenshotPath && xmlPath && evidenceStem(screenshotPath) !== evidenceStem(xmlPath);

if (!explicitScreenshotPath && evidenceStemMismatch) {
  failures.push(
    `Android EV Plan route screenshot/XML evidence must come from the same packet stem: ${displayPath(screenshotPath)} vs ${displayPath(xmlPath)}.`,
  );
}

function siblingScreenshotForXml(path) {
  if (!path) return "";
  const stem = path.slice(0, -extname(path).length);
  return [".png", ".jpg", ".jpeg"]
    .map((extension) => `${stem}${extension}`)
    .find((candidate) => existsSync(candidate) && isFresh(candidate)) || "";
}

function evidenceStem(path) {
  return basename(path, extname(path));
}

requireFile(validationPath, "Native validation document");
requireFile(screenshotPath, "Android EV Plan route screenshot evidence");
requireFile(xmlPath, "Android EV Plan route accessibility dump");
requireFresh(screenshotPath, "Android EV Plan route screenshot evidence");
requireFresh(xmlPath, "Android EV Plan route accessibility dump");

const validation = existsSync(validationPath) ? readFileSync(validationPath, "utf8") : "";
const xml = existsSync(xmlPath) ? readFileSync(xmlPath, "utf8") : "";
const evidenceComplete = Boolean(screenshotPath && xmlPath && existsSync(screenshotPath) && existsSync(xmlPath));

requireText(validation, /Pixel 9 Pro/i, "Native validation must identify the physical Android device.");
requireText(validation, /EV was selectable from `PLAN WITH` as `EV charge`/i, "Native validation must cover EV in Plan mode.");
requireText(validation, /Sylvania NSW and Newcastle NSW suggestions appeared/i, "Native validation must cover Plan From/To suggestion behaviour.");
requireText(validation, /Route charger options/i, "Native validation must cover EV route charger results.");
requireText(validation, /10 options/i, "Native validation must record charger option count evidence.");
requireText(validation, /\d+ km route\. 400 km selected range/i, "Native validation must record route distance and selected EV range evidence.");
if (evidenceComplete) {
  requireText(
    validation,
    new RegExp(escapeRegExp(basename(screenshotPath))),
    `Native validation must cite the checked screenshot: ${basename(screenshotPath)}.`,
  );
  requireText(
    validation,
    new RegExp(escapeRegExp(basename(xmlPath))),
    `Native validation must cite the checked XML dump: ${basename(xmlPath)}.`,
  );

  requireText(xml, /Sylvania/i, "Android XML evidence must show Sylvania route endpoint text.");
  requireText(xml, /Newcastle/i, "Android XML evidence must show Newcastle route endpoint text.");
  requireText(xml, /Route charger options/i, "Android XML evidence must show route charger options text.");
  requireText(xml, /\d+ km route\. 400 km selected range/i, "Android XML evidence must show route distance and selected EV range text.");
}

if (failures.length) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        failures,
        searchedEvidenceDirs: searchDirs.map(displayPath),
        freshness: { allowStale, maxAgeHours },
        checked: {
          validationPath: displayPath(validationPath),
          screenshotPath: screenshotPath ? displayPath(screenshotPath) : null,
          xmlPath: xmlPath ? displayPath(xmlPath) : null,
        },
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  checked: {
    validationPath: displayPath(validationPath),
    screenshotPath: displayPath(screenshotPath),
    xmlPath: displayPath(xmlPath),
  },
  freshness: { allowStale, maxAgeHours },
  coverage: [
    "physical Android device named",
    "EV Plan selector visible",
    "Plan From/To suggestions evidenced",
    "EV route charger result evidenced",
    "charger count and route range evidenced",
  ],
}, null, 2));

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
