import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const source = fs.readFileSync(path.join(root, "src/services/localDataLifecycle.ts"), "utf8");
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
const asyncStorage = {
  multiRemove: async (keys) => removed.push(...keys),
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
  "fuel-path:saved-commutes:v1",
  "fuel-path:recent-locations:v1",
  "fuelpath.monetisationBehaviour.events.v1",
  "fuelpath.monetisationBehaviour.sessionId.v1",
]);
assert.equal(new Set(removed).size, removed.length, "local data keys must not be duplicated");
assert.equal(removed.some((key) => /alert-installation|capability|secret/i.test(key)), false);

const backendDelete = appSource.indexOf("await deleteAllAlertData()");
const localDelete = appSource.indexOf("await clearRoutineLocalData()");
assert.ok(backendDelete >= 0 && localDelete > backendDelete, "backend alert deletion must complete before local routine data is cleared");
assert.match(appSource.slice(backendDelete, localDelete), /if \(!backendDeleted\) return;/);
assert.match(appSource, /if \(Platform\.OS !== "web"\)/);
assert.match(appSource, /Local data not fully deleted/);
assert.match(routeAlertsSource, /return failedLocalIds\.size === 0;/);
assert.match(routeAlertsSource, /local app data was kept\. Try again\./);

console.log("Local data lifecycle contract passed.");
