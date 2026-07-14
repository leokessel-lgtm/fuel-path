const assert = require("node:assert/strict");
const test = require("node:test");

const { safeDiagnosticMessage } = require("../../api/_serverDiagnostics");

test("server diagnostics preserve actionable database context while redacting secrets", () => {
  const message = safeDiagnosticMessage(
    "column alert_next_evaluation_at failed at postgres://user:password@host/db token=abc123 ExponentPushToken[private]",
  );
  assert.match(message, /alert_next_evaluation_at/);
  assert.doesNotMatch(message, /user:password|abc123|private/);
  assert.match(message, /\[redacted-url\]/);
  assert.match(message, /token=\[redacted\]/);
});
