#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function scanNativeIosDependencyDrift({ mobileRoot = process.cwd() } = {}) {
  const lockPath = path.join(mobileRoot, "ios", "Podfile.lock");
  if (!existsSync(lockPath)) {
    return {
      status: "not_generated",
      lockPath,
      missingPaths: [],
      message: "No generated iOS Podfile.lock is present. A clean native generation will resolve dependencies.",
    };
  }

  const lockText = readFileSync(lockPath, "utf8");
  const dependencyPaths = Array.from(lockText.matchAll(/:path:\s+"([^\"]+)"/g), (match) => match[1]);
  const uniquePaths = Array.from(new Set(dependencyPaths));
  const iosRoot = path.dirname(lockPath);
  const missingPaths = uniquePaths
    .map((dependencyPath) => ({
      dependencyPath,
      absolutePath: path.resolve(iosRoot, dependencyPath),
    }))
    .filter(({ absolutePath }) => !existsSync(absolutePath));

  if (!missingPaths.length) {
    return {
      status: "ready",
      lockPath,
      checkedPaths: uniquePaths.length,
      missingPaths: [],
      message: `Generated iOS dependencies match ${uniquePaths.length} local Pod path(s).`,
    };
  }

  return {
    status: "stale",
    lockPath,
    checkedPaths: uniquePaths.length,
    missingPaths,
    message: [
      "The ignored local iOS workspace is stale and references packages that are no longer installed.",
      ...missingPaths.map(({ dependencyPath }) => `Missing: ios/${dependencyPath}`),
      "Regenerate the iOS workspace from the current package.json before building; do not restore removed packages only to satisfy stale Pods.",
    ].join("\n"),
  };
}

function isMainModule() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  const result = scanNativeIosDependencyDrift();
  console.log(JSON.stringify(result, null, 2));
  if (process.argv.includes("--strict") && result.status === "stale") process.exit(1);
}
