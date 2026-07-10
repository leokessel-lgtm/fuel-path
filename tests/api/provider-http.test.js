const assert = require("node:assert/strict");
const test = require("node:test");

const { fetchJson } = require("../../api/_providerHttp");

test("provider HTTP preserves GET, empty-response and caller-header contracts", async () => {
  await withFetch(async (_url, options) => {
    assert.equal(options.method, "GET");
    assert.equal(options.body, undefined);
    assert.equal(options.headers.Accept, "application/vnd.fuel-path+json");
    assert.equal(options.headers["User-Agent"], "ProviderTest/1.0");
    return textResponse("", 200);
  }, async () => {
    assert.deepEqual(await fetchJson("https://provider.invalid/data", {
      headers: { Accept: "application/vnd.fuel-path+json", "User-Agent": "ProviderTest/1.0" },
    }), {});
  });
});

test("provider HTTP preserves POST body and default headers", async () => {
  await withFetch(async (_url, options) => {
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Accept, "application/json");
    assert.equal(options.headers["User-Agent"], "FuelPathHostedBackend/0.1");
    assert.equal(options.headers["Content-Type"], "application/json");
    assert.equal(options.body, JSON.stringify({ fuel: "U91" }));
    return jsonResponse({ ok: true }, 200);
  }, async () => {
    assert.deepEqual(await fetchJson("https://provider.invalid/data", { data: { fuel: "U91" } }), { ok: true });
  });
});

test("provider HTTP preserves structured and malformed error contracts", async () => {
  await withFetch(async () => jsonResponse({ error: { message: "quota" } }, 429), async () => {
    await assert.rejects(fetchJson("https://provider.invalid/data"), /Provider returned 429: quota/);
  });
  await withFetch(async () => textResponse("not-json", 200), async () => {
    await assert.rejects(fetchJson("https://provider.invalid/data"), /Provider returned non-JSON response: not-json/);
  });
});

test("provider HTTP aborts and reports timed-out requests", async () => {
  await withFetch((_url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener("abort", () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      reject(error);
    }, { once: true });
  }), async () => {
    await assert.rejects(fetchJson("https://provider.invalid/slow", { timeoutMs: 5 }), /Provider request timed out after 5ms/);
  });
});

async function withFetch(mock, operation) {
  const originalFetch = global.fetch;
  try {
    global.fetch = mock;
    return await operation();
  } finally {
    global.fetch = originalFetch;
  }
}

function jsonResponse(payload, status) {
  return textResponse(JSON.stringify(payload), status);
}

function textResponse(payload, status) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    text: async () => payload,
  };
}
