const assert = require("node:assert/strict");
const test = require("node:test");

const {
  boolParam,
  fetchJson,
  methodAllowed,
  numberParam,
  setParam,
  stringParam,
} = require("../../api/_http");

test("HTTP parameter helpers preserve scalar, array and fallback contracts", () => {
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

test("fetchJson preserves provider request and error contracts", async () => {
  const originalFetch = global.fetch;
  const calls = [];
  try {
    global.fetch = async (url, options) => {
      calls.push({ url, options });
      return response({ ok: true }, 200);
    };
    assert.deepEqual(await fetchJson("https://provider.invalid/data", { data: { fuel: "U91" }, headers: { "X-Test": "yes" } }), { ok: true });
    assert.equal(calls[0].options.method, "POST");
    assert.equal(calls[0].options.headers["User-Agent"], "FuelPathHostedBackend/0.1");
    assert.equal(calls[0].options.headers["Content-Type"], "application/json");
    assert.equal(calls[0].options.body, JSON.stringify({ fuel: "U91" }));

    global.fetch = async () => response({ error: { message: "quota" } }, 429);
    await assert.rejects(fetchJson("https://provider.invalid/data"), /Provider returned 429: quota/);

    global.fetch = async () => ({ ok: true, status: 200, statusText: "OK", text: async () => "not-json" });
    await assert.rejects(fetchJson("https://provider.invalid/data"), /Provider returned non-JSON response: not-json/);
  } finally {
    global.fetch = originalFetch;
  }
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

function response(payload, status) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    text: async () => JSON.stringify(payload),
  };
}
