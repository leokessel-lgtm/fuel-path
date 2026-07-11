const assert = require("node:assert/strict");
const test = require("node:test");
const { tokenAuthorised, tokenSecurity } = require("../../api/_securityPolicy");

test("token policy accepts bearer or named header without weakening durable storage", () => {
  assert.equal(tokenAuthorised({ headers: { authorization: "Bearer secret" } }, "secret", "x-test-token"), true);
  assert.equal(tokenAuthorised({ headers: { "x-test-token": "secret" } }, "secret", "x-test-token"), true);
  assert.equal(tokenAuthorised({ headers: {} }, "secret", "x-test-token"), false);
  assert.deepEqual(tokenSecurity({ expected: "", storageDurable: true, directHeader: "X-Test-Token" }), {
    tokenConfigured: false,
    tokenRequired: true,
    writeEnabled: false,
    acceptedHeaders: ["Authorization: Bearer <token>", "X-Test-Token"],
  });
});
