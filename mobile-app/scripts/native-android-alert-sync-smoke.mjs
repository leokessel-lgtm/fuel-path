#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const mobileRoot = resolve(scriptDir, "..");
const repoRoot = resolve(mobileRoot, "..");
const smokeDir = resolve(repoRoot, "tmp/native-smoke");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const reportPath = join(smokeDir, `android-alert-sync-smoke-${timestamp}.md`);
const apiBaseUrl = (
  argumentValue("--api-base-url") ||
  process.env.EXPO_PUBLIC_FUEL_PATH_API_BASE_URL ||
  "https://fuel-path.vercel.app"
).replace(/\/+$/, "");
const installationId = `installation_readiness_${timestamp}`;
const installationSecret = randomBytes(32).toString("base64url");
const userId = installationId;
const deviceId = installationId;
const routeId = `readiness_route_${timestamp}`;
const checks = [];

if (
  new URL(apiBaseUrl).hostname === "fuel-path.vercel.app" &&
  process.env.FUEL_PATH_ALLOW_PRODUCTION_ALERT_SMOKE !== "1"
) {
  console.error(
    "Refusing to write synthetic alert data to Production. Pass a Preview URL with --api-base-url, or set FUEL_PATH_ALLOW_PRODUCTION_ALERT_SMOKE=1 only for an explicitly authorised Production check.",
  );
  process.exit(1);
}

mkdirSync(smokeDir, { recursive: true });

const capability = await step("Scoped client capability issued", async () => {
  const response = await requestJson("/api/alerts?action=client-capability", {
    method: "POST",
    body: { installationId, installationSecret },
  });
  assertStatus(response, 202);
  if (response.payload?.accepted !== true || !response.payload?.token) {
    throw new Error(response.payload?.error || "capability token missing");
  }
  return {
    detail: `accepted, expires ${response.payload.expiresAt || "unknown"}`,
    token: String(response.payload.token),
  };
}, { fail: true });

const token = capability.result?.token || "";

await step("Android push device register contract accepts scoped token", async () => {
  const response = await requestJson("/api/push/register", {
    method: "POST",
    token,
    body: {
      userId,
      deviceId,
      platform: "android",
      expoPushToken: fakeExpoPushToken(deviceId),
      appVersion: "local-alert-sync-smoke",
    },
  });
  assertStatus(response, 202);
  if (response.payload?.accepted !== true) throw new Error(response.payload?.error || "device not accepted");
  return { detail: `registered ${response.payload.device?.platform || "android"} device` };
}, { fail: true, skip: !token });

await step("Saved route watch save contract accepts Android payload", async () => {
  const response = await requestJson("/api/saved-routes", {
    method: "POST",
    token,
    body: savedRoutePayload(),
  });
  assertStatus(response, 202);
  if (response.payload?.accepted !== true || response.payload?.route?.id !== routeId) {
    throw new Error(response.payload?.error || "route not accepted");
  }
  return { detail: `saved ${response.payload.route.fuel} route watch` };
}, { fail: true, skip: !token });

await step("Saved route watch can be listed back for this Android identity", async () => {
  const response = await requestJson(`/api/saved-routes?userId=${encodeURIComponent(userId)}&limit=5`, {
    method: "GET",
    token,
  });
  assertStatus(response, 200);
  const route = Array.isArray(response.payload?.routes)
    ? response.payload.routes.find((item) => item.id === routeId)
    : null;
  if (!route) throw new Error("saved route was not returned by list endpoint");
  return { detail: `listed ${route.name || route.id}` };
}, { fail: true });

await step("Temporary saved route watch cleanup succeeds", async () => {
  const response = await requestJson(`/api/saved-routes?routeId=${encodeURIComponent(routeId)}&userId=${encodeURIComponent(userId)}`, {
    method: "DELETE",
    token,
  });
  assertStatus(response, 202);
  if (response.payload?.deleted !== true) throw new Error("delete did not remove the temporary route");
  return { detail: "deleted temporary route" };
}, { fail: true, skip: !token });

await step("Temporary saved route watch is absent after cleanup", async () => {
  const response = await requestJson(`/api/saved-routes?userId=${encodeURIComponent(userId)}&limit=5`, {
    method: "GET",
    token,
  });
  assertStatus(response, 200);
  const route = Array.isArray(response.payload?.routes)
    ? response.payload.routes.find((item) => item.id === routeId)
    : null;
  if (route) throw new Error("temporary route still present after cleanup");
  return { detail: "cleanup verified" };
}, { fail: true });

await step("Temporary installation data is deleted atomically", async () => {
  const response = await requestJson("/api/alerts?action=delete-installation-data", {
    method: "POST",
    token,
    body: {},
  });
  assertStatus(response, 202);
  if (response.payload?.accepted !== true || response.payload?.revoked !== true) {
    throw new Error(response.payload?.error || "installation capability was not revoked");
  }
  if (Number(response.payload?.deletedDeviceCount) < 1) {
    throw new Error("temporary push device was not deleted");
  }
  return {
    detail: `deleted ${response.payload.deletedDeviceCount} device(s), revoked capability`,
  };
}, { fail: true, skip: !token });

await step("Revoked installation capability cannot read saved routes", async () => {
  const response = await requestJson("/api/saved-routes?limit=5", {
    method: "GET",
    token,
  });
  assertStatus(response, 401);
  return { detail: "revocation verified" };
}, { fail: true, skip: !token });

const status = checks.some((item) => item.status === "fail")
  ? "failed"
  : checks.some((item) => item.status === "warn")
    ? "partial"
    : "passed";

writeReport(status);
console.log(`Android alert sync smoke ${status}: ${reportPath}`);
if (status === "failed") process.exit(1);

async function step(name, fn, { fail = false, skip = false } = {}) {
  if (skip) {
    checks.push({ name, status: fail ? "fail" : "warn", detail: "Skipped because a required prior token was unavailable." });
    return { ok: false };
  }
  try {
    const result = await fn();
    checks.push({ name, status: "pass", detail: result?.detail || "passed" });
    return { ok: true, result };
  } catch (error) {
    checks.push({ name, status: fail ? "fail" : "warn", detail: error.message || "failed" });
    return { ok: false, error };
  }
}

async function requestJson(path, { method, token = "", body } = {}) {
  const headers = {
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { error: "non-JSON response" };
  }
  return { status: response.status, payload };
}

function assertStatus(response, expected) {
  if (response.status !== expected) {
    throw new Error(`HTTP ${response.status}: ${response.payload?.error || "unexpected response"}`);
  }
}

function savedRoutePayload() {
  const now = new Date().toISOString();
  return {
    id: routeId,
    userId,
    name: "Android readiness route",
    from: { lat: -31.9523, lon: 115.8613, label: "Perth WA" },
    to: { lat: -32.0569, lon: 115.7439, label: "Fremantle WA" },
    fuel: "P95",
    vehicleId: "readiness_vehicle_android",
    vehicleEnergyType: "petrol",
    alertEnabled: true,
    alertTimeLocal: "07:30",
    alertDays: ["mon", "tue", "wed", "thu", "fri"],
    timezone: "Australia/Perth",
    minSavingDollars: 5,
    maxDetourMinutes: 8,
    eligibleDiscounts: [],
    tankLitres: 55,
    tankPercent: 45,
    economy: 8.2,
    reserveKm: 35,
    createdAt: now,
    updatedAt: now,
  };
}

function fakeExpoPushToken(seed) {
  return `ExponentPushToken[${Buffer.from(seed).toString("base64url").slice(0, 22).padEnd(22, "0")}]`;
}

function writeReport(status) {
  const lines = [
    `# Android Alert Sync Smoke - ${new Date().toISOString()}`,
    "",
    `Status: ${status}`,
    `API base URL: ${apiBaseUrl}`,
    `Temporary installation: ${installationId}`,
    `Temporary route: ${routeId}`,
    "",
    "| Check | Status | Detail |",
    "| --- | --- | --- |",
    ...checks.map((item) => `| ${item.name} | ${item.status} | ${escapeTable(item.detail || "")} |`),
    "",
    "## Interpretation",
    "",
    "- This proves the account-free Android route-watch backend contract can issue an installation-scoped capability, accept a push-device registration shape, save and list a route watch, delete the temporary route, atomically delete the installation's alert data, and revoke the capability.",
    "- It does not send a real push notification or prove Expo delivery to a physical device.",
    "- Installation secret, scoped capability and push token values are intentionally omitted from this report.",
    "",
  ];
  writeFileSync(reportPath, `${lines.join("\n")}\n`);
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return "";
  return process.argv[index + 1] && !process.argv[index + 1].startsWith("--")
    ? process.argv[index + 1]
    : "";
}

function escapeTable(value) {
  return String(value).replaceAll("|", "\\|");
}
