import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const source = fs.readFileSync(path.join(root, "src/services/localDataLifecycle.ts"), "utf8");
const recoverableSource = fs.readFileSync(path.join(root, "src/services/recoverableLocalStore.ts"), "utf8");
const appSource = fs.readFileSync(path.join(root, "App.tsx"), "utf8");
const routeAlertsSource = fs.readFileSync(path.join(root, "src/hooks/useRouteAlerts.ts"), "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    esModuleInterop: true,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

const removed = [];
const stored = new Map();
const asyncStorage = {
  multiRemove: async (keys) => removed.push(...keys),
  multiGet: async (keys) => keys.map((key) => [key, stored.get(key) ?? null]),
  multiSet: async (pairs) => pairs.forEach(([key, value]) => stored.set(key, value)),
};
const module = { exports: {} };
new Function("require", "module", "exports", transpiled)(
  (id) => {
    if (id === "@react-native-async-storage/async-storage") return asyncStorage;
    throw new Error(`Unexpected local data lifecycle dependency: ${id}`);
  },
  module,
  module.exports,
);

const lifecycle = module.exports;
await lifecycle.clearRoutineLocalData();
assert.deepEqual(removed, [
  "fuel-path:preferences:v1",
  "fuel-path:preferences:v1:backup",
  "fuel-path:saved-commutes:v1",
  "fuel-path:saved-commutes:v1:backup",
  "fuel-path:recent-locations:v1",
  "fuel-path:recent-locations:v1:backup",
  "fuelpath.monetisationBehaviour.events.v1",
  "fuelpath.monetisationBehaviour.sessionId.v1",
]);
assert.equal(new Set(removed).size, removed.length, "local data keys must not be duplicated");
assert.equal(removed.some((key) => /alert-installation|capability|secret/i.test(key)), false);

const recoverableModule = { exports: {} };
const recoverableTranspiled = ts.transpileModule(recoverableSource, {
  compilerOptions: {
    esModuleInterop: true,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
new Function("require", "module", "exports", recoverableTranspiled)(
  (id) => {
    if (id === "@react-native-async-storage/async-storage") return asyncStorage;
    throw new Error(`Unexpected recoverable local store dependency: ${id}`);
  },
  recoverableModule,
  recoverableModule.exports,
);
const recoverable = recoverableModule.exports;
const normalise = (value) => {
  if (!value || typeof value !== "object") throw new Error("invalid fixture");
  return value;
};
await recoverable.persistRecoverableJson({
  primaryKey: "test:primary",
  backupKey: "test:backup",
  value: { route: "latest" },
});
assert.equal(stored.get("test:primary"), stored.get("test:backup"));
stored.set("test:primary", "{corrupt");
const recovered = await recoverable.loadRecoverableJson({
  primaryKey: "test:primary",
  backupKey: "test:backup",
  fallback: {},
  normalise,
});
assert.equal(recovered.source, "backup");
assert.equal(recovered.recovered, true);
assert.deepEqual(recovered.value, { route: "latest" });
const olderPrimaryRaw = stored.get("test:backup");
await recoverable.persistRecoverableJson({
  primaryKey: "test:primary",
  backupKey: "test:backup",
  value: { route: "newest" },
});
stored.set("test:primary", olderPrimaryRaw);
const newerBackup = await recoverable.loadRecoverableJson({
  primaryKey: "test:primary",
  backupKey: "test:backup",
  fallback: {},
  normalise,
});
assert.equal(newerBackup.source, "backup");
assert.deepEqual(newerBackup.value, { route: "newest" });
stored.set("test:primary", JSON.stringify({ route: "legacy" }));
stored.delete("test:backup");
const migrated = await recoverable.loadRecoverableJson({
  primaryKey: "test:primary",
  backupKey: "test:backup",
  fallback: {},
  normalise,
});
assert.equal(migrated.migratedLegacy, true);
stored.set("test:primary", "bad");
stored.set("test:backup", "bad");
await assert.rejects(
  recoverable.loadRecoverableJson({
    primaryKey: "test:primary",
    backupKey: "test:backup",
    fallback: {},
    normalise,
  }),
  /unreadable/,
);
const originalMultiGet = asyncStorage.multiGet;
asyncStorage.multiGet = async (keys) => {
  const pairs = await originalMultiGet(keys);
  return pairs.map(([key, value], index) => index === 0 ? [key, `${value}corrupt`] : [key, value]);
};
await assert.rejects(
  recoverable.persistRecoverableJson({
    primaryKey: "test:verify-primary",
    backupKey: "test:verify-backup",
    value: { route: "must-verify" },
  }),
  /verification failed/,
);
asyncStorage.multiGet = originalMultiGet;

const backendDelete = appSource.indexOf("await deleteAllAlertData()");
const localDelete = appSource.indexOf("await clearRoutineLocalData()");
assert.ok(backendDelete >= 0 && localDelete > backendDelete, "backend alert deletion must complete before local routine data is cleared");
assert.match(appSource.slice(backendDelete, localDelete), /if \(!backendDeleted\) return;/);
assert.match(appSource, /if \(Platform\.OS !== "web"\)/);
assert.match(appSource, /Local data not fully deleted/);
assert.match(appSource, /Retry saving local data/);
assert.match(routeAlertsSource, /return failedLocalIds\.size === 0;/);
assert.match(routeAlertsSource, /local app data was kept\. Try again\./);

console.log("Local data lifecycle contract passed.");
