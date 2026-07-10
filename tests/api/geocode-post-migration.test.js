const assert = require("node:assert/strict");
const test = require("node:test");

const geocodeHandler = require("../../api/geocode");

test("GET /api/geocode with query params returns geocode response", async () => {
 const response = await callGeocode({ method: "GET", query: { q: "Canberra", limit: "3" } });
 assert.equal(response.status, 200);
 assert.equal(response.headers["cache-control"], "no-store, private");
 assert.ok(response.payload.suggestions.length > 0 || response.payload.location);
});

test("POST /api/geocode with JSON body returns geocode response", async () => {
 const response = await callGeocode({ method: "POST", body: { q: "Canberra", limit: 3 } });
 assert.equal(response.status, 200);
 assert.equal(response.headers["cache-control"], "no-store, private");
 assert.ok(response.payload.suggestions.length > 0 || response.payload.location);
});

test("GET and POST produce equivalent geocode params", async () => {
 const getRes = await callGeocode({ method: "GET", query: { q: "Canberra", limit: "3" } });
 const postRes = await callGeocode({ method: "POST", body: { q: "Canberra", limit: 3 } });
 assert.equal(getRes.status, 200);
 assert.equal(postRes.status, 200);
 assert.equal(getRes.payload.query, postRes.payload.query);
 assert.equal(getRes.payload.lookupStatus, postRes.payload.lookupStatus);
 assert.deepEqual(
 getRes.payload.suggestions.map(function(s) { return s.label; }),
 postRes.payload.suggestions.map(function(s) { return s.label; }),
 );
});

test("geocode response includes Cache-Control no-store private", async () => {
 const response = await callGeocode({ method: "POST", body: { q: "Sydney", limit: 1 } });
 assert.equal(response.headers["cache-control"], "no-store, private");
});

test("POST without q returns public recovery guidance", async () => {
 const response = await callGeocode({ method: "POST", body: { limit: 3 } });
 assert.equal(response.status, 404);
 assert.equal(response.payload.error, "Enter an address, suburb or postcode to search.");
});

test("PUT method returns 405", async () => {
 const response = await callGeocode({ method: "PUT", body: { q: "test" } });
 assert.equal(response.status, 405);
});


test("diagnostics emit redacted JSON when FUEL_PATH_GEOCODE_DIAGNOSTICS=1", async () => {
  const original = process.env.FUEL_PATH_GEOCODE_DIAGNOSTICS;
  process.env.FUEL_PATH_GEOCODE_DIAGNOSTICS = "1";
  const logs = [];
  const origLog = console.log;
  console.log = (...args) => logs.push(args.join(" "));
  try {
    await callGeocode({ method: "POST", body: { q: "Sydney", limit: 1 } });
    assert.equal(logs.length, 1);
    const event = JSON.parse(logs[0]);
    assert.equal(event.event, "geocode_lookup");
    assert.equal(event.method, "POST");
    assert.equal(typeof event.lookupStatus, "string");
    assert.equal(typeof event.latencyMs, "number");
    assert.equal(typeof event.hasLocation, "boolean");
    assert.equal(event.query, undefined);
    assert.equal(event.label, undefined);
    assert.equal(event.lat, undefined);
    assert.equal(event.lon, undefined);
    assert.equal(event.sessionToken, undefined);
    assert.equal(logs[0].includes("Sydney"), false);
  } finally {
    console.log = origLog;
    if (original === undefined) delete process.env.FUEL_PATH_GEOCODE_DIAGNOSTICS;
    else process.env.FUEL_PATH_GEOCODE_DIAGNOSTICS = original;
  }
});

test("diagnostics do not emit when env is unset", async () => {
  const original = process.env.FUEL_PATH_GEOCODE_DIAGNOSTICS;
  delete process.env.FUEL_PATH_GEOCODE_DIAGNOSTICS;
  const logs = [];
  const origLog = console.log;
  console.log = (...args) => logs.push(args.join(" "));
  try {
    await callGeocode({ method: "POST", body: { q: "Melbourne", limit: 1 } });
    assert.equal(logs.length, 0);
  } finally {
    console.log = origLog;
    if (original !== undefined) process.env.FUEL_PATH_GEOCODE_DIAGNOSTICS = original;
  }
});

test("diagnostics on error do not leak query text", async () => {
  const original = process.env.FUEL_PATH_GEOCODE_DIAGNOSTICS;
  process.env.FUEL_PATH_GEOCODE_DIAGNOSTICS = "1";
  const logs = [];
  const origLog = console.log;
  console.log = (...args) => logs.push(args.join(" "));
  try {
    await callGeocode({ method: "POST", body: { limit: 1 } });
    assert.equal(logs.length, 1);
    const event = JSON.parse(logs[0]);
    assert.equal(event.event, "geocode_lookup");
    assert.equal(event.lookupStatus, "error");
    assert.equal(event.errorCategory, "missing_query");
    assert.equal(event.query, undefined);
  } finally {
    console.log = origLog;
    if (original === undefined) delete process.env.FUEL_PATH_GEOCODE_DIAGNOSTICS;
    else process.env.FUEL_PATH_GEOCODE_DIAGNOSTICS = original;
  }
});

function callGeocode({ method, query, body }) {
 return new Promise(function(resolve) {
 const req = { method: method, query: query || {}, body: body || undefined };
 const res = {
 statusCode: 200,
 headers: {},
 status: function(code) { this.statusCode = code; return this; },
 setHeader: function(key, value) { this.headers[key.toLowerCase()] = value; },
 json: function(payload) { resolve({ status: this.statusCode, payload: payload, headers: this.headers }); },
 };
 geocodeHandler(req, res);
 });
}
