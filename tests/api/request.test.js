const assert = require("node:assert/strict");
const test = require("node:test");

const {
  boolParam,
  methodAllowed,
  numberParam,
  setParam,
  stringParam,
} = require("../../api/_request");

test("request parameter helpers preserve scalar, array and fallback contracts", () => {
  assert.equal(numberParam(["12", "13"], 4), 12);
  assert.equal(numberParam("invalid", 4), 4);
  assert.equal(stringParam(["first", "second"], "fallback"), "first");
  assert.equal(stringParam("", "fallback"), "fallback");
  assert.equal(boolParam("yes"), true);
  assert.equal(boolParam(undefined, true), true);
  assert.equal(boolParam("off", true), false);
  assert.deepEqual([...setParam(" Ampol, BP, Ampol ")], ["Ampol", "BP"]);
});

test("methodAllowed preserves local CORS, preflight and rejection responses", () => {
  const local = responseDouble();
  assert.equal(methodAllowed({ method: "POST", headers: { origin: "http://localhost:8081" } }, local, ["POST"]), true);
  assert.equal(local.headers["Access-Control-Allow-Origin"], "http://localhost:8081");

  const preflight = responseDouble();
  assert.equal(methodAllowed({ method: "OPTIONS", headers: {} }, preflight, ["POST"]), false);
  assert.equal(preflight.statusCode, 204);
  assert.equal(preflight.ended, true);

  const rejected = responseDouble();
  assert.equal(methodAllowed({ method: "DELETE", headers: {} }, rejected, ["GET"]), false);
  assert.equal(rejected.statusCode, 405);
  assert.deepEqual(rejected.payload, { error: "Method not allowed" });
});

function responseDouble() {
  return {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}
