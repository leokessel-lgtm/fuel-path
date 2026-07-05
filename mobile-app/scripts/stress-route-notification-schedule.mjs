#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const repoRoot = path.resolve(process.cwd(), "..");
const mobileRoot = process.cwd();
const sourcePath = path.join(mobileRoot, "src/services/routeNotificationSchedule.ts");
const smokeDir = path.join(repoRoot, "tmp/native-smoke");
mkdirSync(smokeDir, { recursive: true });

const source = readFileSync(sourcePath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
  fileName: sourcePath,
}).outputText;

const module = { exports: {} };
vm.runInNewContext(transpiled, {
  exports: module.exports,
  module,
  require: () => ({}),
}, { filename: sourcePath });

const {
  ROUTE_ALERT_CHANNEL_ID,
  allRouteAlertWeekdays,
  expoRouteAlertWeekday,
  nextRouteAlertAt,
  normaliseRouteAlertDays,
  parseRouteAlertTime,
  routeAlertScheduleInputs,
  scheduledRouteNotificationIds,
} = module.exports;

const generatedAt = new Date().toISOString();
const report = {
  generatedAt,
  status: "passed",
  checks: [],
};

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function check(label, fn) {
  try {
    fn();
    report.checks.push({ label, status: "passed" });
  } catch (error) {
    report.status = "failed";
    report.checks.push({ label, status: "failed", message: error.message });
  }
}

function commute(overrides = {}) {
  return {
    id: "commute:test",
    name: "Test commute",
    from: { lat: -31.9523, lon: 115.8613, label: "Perth" },
    to: { lat: -32.0569, lon: 115.7439, label: "Fremantle" },
    fuel: "P98",
    alertEnabled: true,
    alertTime: "07:30",
    alertDays: ["mon", "tue", "wed", "thu", "fri"],
    minSavingDollars: 5,
    maxDetourMinutes: 8,
    tankThresholdPercent: 45,
    createdAt: "2026-07-05T00:00:00.000Z",
    ...overrides,
  };
}

check("route-alerts channel id is stable", () => {
  assert.equal(ROUTE_ALERT_CHANNEL_ID, "route-alerts");
});

check("weekday mapping matches Expo weekly trigger contract", () => {
  assert.deepEqual(
    plain(allRouteAlertWeekdays.map((day) => [day, expoRouteAlertWeekday(day)])),
    [
      ["mon", 2],
      ["tue", 3],
      ["wed", 4],
      ["thu", 5],
      ["fri", 6],
      ["sat", 7],
      ["sun", 1],
    ],
  );
});

check("selected weekdays create one weekly trigger each", () => {
  const inputs = routeAlertScheduleInputs(commute({ alertDays: ["mon", "wed", "fri"], alertTime: "06:45" }));
  assert.deepEqual(plain(inputs), [
    { day: "mon", weekday: 2, hour: 6, minute: 45 },
    { day: "wed", weekday: 4, hour: 6, minute: 45 },
    { day: "fri", weekday: 6, hour: 6, minute: 45 },
  ]);
});

check("missing alert days fall back to all days", () => {
  assert.deepEqual(plain(routeAlertScheduleInputs(commute({ alertDays: undefined })).map((input) => input.day)), plain(allRouteAlertWeekdays));
  assert.deepEqual(plain(routeAlertScheduleInputs(commute({ alertDays: [] })).map((input) => input.day)), plain(allRouteAlertWeekdays));
});

check("invalid days are ignored and fully invalid day lists fall back", () => {
  assert.deepEqual(plain(normaliseRouteAlertDays(["sun", "bad", "mon"])), ["mon", "sun"]);
  assert.deepEqual(plain(normaliseRouteAlertDays(["bad"])), plain(allRouteAlertWeekdays));
});

check("bad alert times fall back to 07:30", () => {
  for (const badTime of ["", "7:30", "24:00", "12:99", "nope", "07"]) {
    assert.deepEqual(plain(parseRouteAlertTime(badTime)), { hour: 7, minute: 30 }, badTime);
  }
});

check("edge alert times remain valid", () => {
  assert.deepEqual(plain(parseRouteAlertTime("00:00")), { hour: 0, minute: 0 });
  assert.deepEqual(plain(parseRouteAlertTime("23:59")), { hour: 23, minute: 59 });
});

check("next alert skips past same-day times", () => {
  const sundayMorning = new Date("2026-07-05T08:00:00+10:00");
  const next = nextRouteAlertAt("07:30", ["sun"], sundayMorning);
  assert.equal(next.toISOString(), new Date("2026-07-12T07:30:00+10:00").toISOString());
});

check("next alert can still use a later same-day time", () => {
  const sundayMorning = new Date("2026-07-05T08:00:00+10:00");
  const next = nextRouteAlertAt("09:15", ["sun"], sundayMorning);
  assert.equal(next.toISOString(), new Date("2026-07-05T09:15:00+10:00").toISOString());
});

check("scheduled ids include legacy and new ids without blanks", () => {
  assert.deepEqual(
    plain(scheduledRouteNotificationIds(commute({
      scheduledNotificationId: "legacy-id",
      scheduledNotificationIds: ["mon-id", "", "wed-id"],
    }))),
    ["mon-id", "wed-id", "legacy-id"],
  );
});

check("stress every weekday and hour produces bounded weekly trigger inputs", () => {
  let count = 0;
  for (const day of allRouteAlertWeekdays) {
    for (let hour = 0; hour < 24; hour += 1) {
      const alertTime = `${String(hour).padStart(2, "0")}:05`;
      const [input] = routeAlertScheduleInputs(commute({ alertDays: [day], alertTime }));
      assert.equal(input.day, day);
      assert.equal(input.weekday, expoRouteAlertWeekday(day));
      assert.equal(input.hour, hour);
      assert.equal(input.minute, 5);
      count += 1;
    }
  }
  assert.equal(count, 168);
});

const reportPath = path.join(smokeDir, `route-notification-schedule-stress-${generatedAt.replaceAll(":", "-")}.json`);
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

if (report.status !== "passed") {
  console.error(`Route notification schedule stress failed: ${reportPath}`);
  process.exit(1);
}

console.log(`Route notification schedule stress passed: ${reportPath}`);
