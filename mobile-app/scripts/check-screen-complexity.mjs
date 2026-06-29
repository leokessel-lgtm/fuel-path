import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

const screenBudgets = [
  {
    file: "src/screens/PlanScreen.tsx",
    maxLines: 729,
    maxStateHooks: 15,
    maxEffectHooks: 1,
    maxMemoHooks: 8,
    maxCallbackHooks: 0,
    maxRefHooks: 2,
    splitHint: "route editor, recommendation panel, map/list sheet and saved-route alert modules",
  },
  {
    file: "src/screens/NearbyScreen.tsx",
    maxLines: 468,
    maxStateHooks: 14,
    maxEffectHooks: 3,
    maxMemoHooks: 4,
    maxCallbackHooks: 6,
    maxRefHooks: 1,
    splitHint: "location search, map sheet and station-list modules",
  },
  {
    file: "src/screens/AccountScreen.tsx",
    maxLines: 115,
    maxStateHooks: 0,
    maxEffectHooks: 0,
    maxMemoHooks: 0,
    maxCallbackHooks: 0,
    maxRefHooks: 0,
    splitHint: "preferences, saved places, wallet, policy and support/settings modules",
  },
];

const results = screenBudgets.map((budget) => {
  const filePath = path.join(root, budget.file);
  const source = fs.readFileSync(filePath, "utf8");
  const hooks = hookCounts(source);
  const lines = lineCount(filePath);
  return {
    ...budget,
    ...hooks,
    lines,
    ok:
      lines <= budget.maxLines &&
      hooks.stateHooks <= budget.maxStateHooks &&
      hooks.effectHooks <= budget.maxEffectHooks &&
      hooks.memoHooks <= budget.maxMemoHooks &&
      hooks.callbackHooks <= budget.maxCallbackHooks &&
      hooks.refHooks <= budget.maxRefHooks,
  };
});

for (const result of results) {
  const prefix = result.ok ? "OK" : "FAIL";
  console.log(
    `${prefix} ${result.file}: ${result.lines}/${result.maxLines} lines, ` +
      `state ${result.stateHooks}/${result.maxStateHooks}, ` +
      `effects ${result.effectHooks}/${result.maxEffectHooks}, ` +
      `memos ${result.memoHooks}/${result.maxMemoHooks}, ` +
      `callbacks ${result.callbackHooks}/${result.maxCallbackHooks}, ` +
      `refs ${result.refHooks}/${result.maxRefHooks}; split target: ${result.splitHint}`,
  );
}

const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(
    `Screen complexity budget failed: ${failed.map((result) => result.file).join(", ")}. ` +
      "Extract modules before adding more screen-local behaviour.",
  );
  process.exit(1);
}

function lineCount(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  if (!text) return 0;
  return text.endsWith("\n") ? text.split("\n").length - 1 : text.split("\n").length;
}

function hookCounts(source) {
  return {
    stateHooks: countMatches(source, /\buseState(?:<[^>]+>)?\s*\(/g),
    effectHooks: countMatches(source, /\buseEffect\s*\(/g),
    memoHooks: countMatches(source, /\buseMemo\s*\(/g),
    callbackHooks: countMatches(source, /\buseCallback\s*\(/g),
    refHooks: countMatches(source, /\buseRef(?:<[^>]+>)?\s*\(/g),
  };
}

function countMatches(source, pattern) {
  return Array.from(source.matchAll(pattern)).length;
}
