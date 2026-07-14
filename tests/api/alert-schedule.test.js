const assert = require("node:assert/strict");
const test = require("node:test");

const {
  nextRouteAlertEvaluationAt,
  routeAlertDaySelected,
} = require("../../api/_alertSchedule");

test("next alert due time advances to the next selected local day without UTC drift", () => {
  const next = nextRouteAlertEvaluationAt({
    alertTimeLocal: "09:00",
    alertDays: ["tue"],
    timezone: "Australia/Sydney",
  }, "2026-07-13T22:00:00.000Z");

  assert.equal(next, "2026-07-20T21:30:00.000Z");
});

test("next alert due time honours daylight-saving timezone conversion", () => {
  const next = nextRouteAlertEvaluationAt({
    alertTimeLocal: "07:30",
    alertDays: ["sun"],
    timezone: "Australia/Sydney",
  }, "2026-10-03T00:00:00.000Z");

  assert.equal(next, "2026-10-03T19:00:00.000Z");
});

test("alert day selection uses the route timezone", () => {
  const route = { alertDays: ["tue"], timezone: "Australia/Sydney" };
  assert.equal(routeAlertDaySelected(route, "2026-07-13T22:00:00.000Z"), true);
  assert.equal(routeAlertDaySelected(route, "2026-07-14T22:00:00.000Z"), false);
});
