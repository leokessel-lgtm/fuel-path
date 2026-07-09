#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const mobileRoot = resolve(scriptDir, "..");
const repoRoot = resolve(mobileRoot, "..");
const smokeDir = resolve(repoRoot, "tmp/native-smoke");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const reportPath = join(smokeDir, `android-alert-delivery-gate-${timestamp}.md`);
const apiBaseUrl = (
  argumentValue("--api-base-url") ||
  process.env.EXPO_PUBLIC_FUEL_PATH_API_BASE_URL ||
  "https://fuel-path.vercel.app"
).replace(/\/+$/, "");
const requireEnabled = process.argv.includes("--require-enabled");

mkdirSync(smokeDir, { recursive: true });

const checks = [];
const payload = await alertsStatus(apiBaseUrl);
const alerts = payload.body?.alerts || {};
const providerWarning = alerts.providerHealth?.alerts?.warning || "";
const pushDeliveryEnabled = alerts.pushDeliveryEnabled === true;
const storageDurable = alerts.storage?.durable === true;

check("Backend alert status reachable", payload.status === 200, {
  detail: `HTTP ${payload.status}`,
  fail: true,
});
check("Durable alert storage is configured", storageDurable, {
  detail: storageDurable ? "durable" : "not durable",
  fail: true,
});
check("Expo push delivery gate is enabled", pushDeliveryEnabled, {
  detail: pushDeliveryEnabled ? "enabled" : providerWarning || "disabled",
  fail: requireEnabled,
});

const status = checks.some((item) => item.status === "fail")
  ? "failed"
  : pushDeliveryEnabled
    ? "passed"
    : "blocked_by_environment";

const lines = [
  `# Android Alert Delivery Gate - ${new Date().toISOString()}`,
  "",
  `Status: ${status}`,
  `API base URL: ${apiBaseUrl}`,
  "",
  "| Check | Status | Detail |",
  "| --- | --- | --- |",
  ...checks.map((item) => `| ${item.name} | ${item.status} | ${escapeTable(item.detail)} |`),
  "",
  "## Interpretation",
  "",
  "- This checks whether real remote push delivery is currently testable from the hosted backend.",
  "- It does not create a device Expo push token, send a notification, or inspect a physical notification tray.",
  "- When status is `blocked_by_environment`, Android app/package/backend sync work can still be valid, but delivered push cannot be proven until the backend delivery gate is enabled.",
  "",
];

writeFileSync(reportPath, `${lines.join("\n")}\n`);
console.log(`Android alert delivery gate ${status}: ${reportPath}`);
if (status === "failed") process.exit(1);

async function alertsStatus(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/api/alerts`, {
      headers: { Accept: "application/json" },
    });
    return {
      status: response.status,
      body: await response.json().catch(() => ({})),
    };
  } catch (error) {
    return {
      status: 0,
      body: { error: error.message || "request failed" },
    };
  }
}

function check(name, passed, { detail = "", fail = false } = {}) {
  checks.push({
    name,
    detail,
    status: passed ? "pass" : fail ? "fail" : "warn",
  });
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return "";
  return process.argv[index + 1] && !process.argv[index + 1].startsWith("--")
    ? process.argv[index + 1]
    : "";
}

function escapeTable(value) {
  return String(value || "").replaceAll("|", "\\|");
}
