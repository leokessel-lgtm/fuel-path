const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createAddressStorageAdapters } = require("../../api/_addressStorageAdapters");

test("address API transport fails closed for HTTP, JSON and timeout failures", async () => {
  const previous = process.env.FUEL_PATH_GNAF_API_URL;
  process.env.FUEL_PATH_GNAF_API_URL = "https://address.example.test";
  try {
    const http = createAddressStorageAdapters({ fetchFn: async () => ({ ok: false }) });
    const malformed = createAddressStorageAdapters({ fetchFn: async () => ({ ok: true, json: async () => { throw new Error("bad json"); } }) });
    const timeout = createAddressStorageAdapters({
      requestTimeoutMs: 1,
      fetchFn: async (_url, { signal }) => new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      }),
    });
    assert.deepEqual(await http.fetchApiSuggestions("Sydney", 5), []);
    assert.deepEqual(await malformed.fetchApiSuggestions("Sydney", 5), []);
    assert.deepEqual(await timeout.fetchApiSuggestions("Sydney", 5), []);
  } finally {
    if (previous === undefined) delete process.env.FUEL_PATH_GNAF_API_URL;
    else process.env.FUEL_PATH_GNAF_API_URL = previous;
  }
});

test("address database adapters isolate construction and query failures", async () => {
  const previous = {
    database: process.env.FUEL_PATH_GNAF_DATABASE_URL,
    sqlite: process.env.FUEL_PATH_GNAF_SQLITE_PATH,
  };
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-adapter-"));
  const sqlitePath = path.join(directory, "addresses.sqlite");
  fs.writeFileSync(sqlitePath, "fixture");
  process.env.FUEL_PATH_GNAF_DATABASE_URL = "postgres://example.invalid/db";
  process.env.FUEL_PATH_GNAF_SQLITE_PATH = sqlitePath;
  try {
    const adapters = createAddressStorageAdapters({
      postgresFactory: () => { throw new Error("postgres unavailable"); },
      sqliteFactory: class { constructor() { throw new Error("sqlite unavailable"); } },
    });
    assert.equal(adapters.postgresClient(), null);
    assert.equal(adapters.openSqliteIndex(), null);
    assert.deepEqual(await adapters.queryPostgresAddresses("sydney", 5), []);
    assert.deepEqual(adapters.sqliteAll({ prepare() { throw new Error("query failed"); } }, "SELECT 1"), []);
    assert.equal(adapters.sqliteGet({ prepare() { throw new Error("query failed"); } }, "SELECT 1"), undefined);
    assert.throws(() => adapters.sqliteAllOrThrow({ prepare() { throw new Error("query failed"); } }, "SELECT 1"), /query failed/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
    if (previous.database === undefined) delete process.env.FUEL_PATH_GNAF_DATABASE_URL;
    else process.env.FUEL_PATH_GNAF_DATABASE_URL = previous.database;
    if (previous.sqlite === undefined) delete process.env.FUEL_PATH_GNAF_SQLITE_PATH;
    else process.env.FUEL_PATH_GNAF_SQLITE_PATH = previous.sqlite;
  }
});
