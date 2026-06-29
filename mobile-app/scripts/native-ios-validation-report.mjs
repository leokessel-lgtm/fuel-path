import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const mobileAppRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const projectRoot = resolve(mobileAppRoot, "..");
const outputRoot = resolve(argumentValue("--output-dir") || join(projectRoot, "tmp", "native-smoke"));
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const outJson = join(outputRoot, `ios-validation-${timestamp}.json`);
const outMd = join(outputRoot, `ios-validation-${timestamp}.md`);
const requiredScreens = ["plan", "nearby", "account"];

mkdirSync(outputRoot, { recursive: true });

const report = buildReport();
const blockers = validationBlockers(report);
const payload = {
  ...report,
  status: blockers.length ? "blocked" : "passed",
  blockers,
};

writeFileSync(outJson, `${JSON.stringify(payload, null, 2)}\n`);
writeFileSync(outMd, markdown(payload));

console.log(`iOS validation report ${payload.status}: ${outMd}`);
if (blockers.length) {
  console.error(blockers.map((blocker) => `- ${blocker}`).join("\n"));
  process.exit(1);
}

function buildReport() {
  const sourceReportPath = argumentValue("--source-report");
  if (sourceReportPath) {
    const source = JSON.parse(readFileSync(resolve(sourceReportPath), "utf8"));
    return {
      ...source,
      platform: source.platform || "ios",
      sourceReport: resolve(sourceReportPath),
    };
  }

  return {
    platform: "ios",
    simulator: target("simulator"),
    device: target("device"),
    renderedScreens: requiredScreens.map((screen) => ({
      name: screen,
      screenshot: argumentValue(`--${screen}-screenshot`),
    })),
    failureLines: failureLines(),
  };
}

function target(kind) {
  const name = argumentValue(`--${kind}-name`);
  if (!name) return undefined;
  return {
    name,
    runtime: argumentValue(`--${kind}-runtime`),
  };
}

function failureLines() {
  const failureLog = argumentValue("--failure-log");
  if (!failureLog) return [];
  const resolved = resolve(failureLog);
  if (!existsSync(resolved)) return [`Failure log not found: ${failureLog}`];
  return readFileSync(resolved, "utf8")
    .split("\n")
    .filter((line) => /\b(FATAL|Exception|TypeError|Unhandled|Invariant Violation)\b/i.test(line));
}

function validationBlockers(report) {
  const screens = report.renderedScreens || report.screens || [];
  const screenNames = screens.map((screen) => String(screen.name || screen.screen || "").toLowerCase());
  const missingScreens = requiredScreens.filter((screen) => !screenNames.includes(screen));
  const missingScreenshots = requiredScreens.filter((screen) => {
    const item = screens.find((candidate) => String(candidate.name || candidate.screen || "").toLowerCase() === screen);
    return !item?.screenshot || !existsSync(resolve(item.screenshot));
  });
  return [
    ...(String(report.platform || "").toLowerCase() !== "ios" ? ["Report platform must be ios."] : []),
    ...(!report.simulator?.name && !report.device?.name ? ["Report needs a simulator or device target name."] : []),
    ...(missingScreens.length ? [`Missing rendered screens: ${missingScreens.join(", ")}.`] : []),
    ...(missingScreenshots.length ? [`Missing screenshot evidence: ${missingScreenshots.join(", ")}.`] : []),
    ...((report.failureLines || []).length ? [`Runtime failure lines were captured: ${report.failureLines.length}.`] : []),
  ];
}

function markdown(report) {
  const screens = report.renderedScreens || report.screens || [];
  return [
    "# iOS Validation Report",
    "",
    `Status: ${report.status}`,
    `Generated: ${new Date().toISOString()}`,
    `Target: ${report.simulator?.name || report.device?.name || "unknown"}`,
    `Runtime: ${report.simulator?.runtime || report.device?.runtime || "unknown"}`,
    "",
    "## Screens",
    "",
    ...screens.map((screen) => `- ${screen.name || screen.screen}: ${screen.screenshot ? basename(screen.screenshot) : "missing"}`),
    "",
    "## Blockers",
    "",
    ...(report.blockers.length ? report.blockers.map((item) => `- ${item}`) : ["- None"]),
    "",
  ].join("\n");
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || "" : "";
}
