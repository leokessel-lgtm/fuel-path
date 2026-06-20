import { spawnSync } from "node:child_process";

const xcodeSelectCommand = process.env.FUEL_PATH_XCODE_SELECT_FOR_TESTS || "xcode-select";
const xcrunCommand = process.env.FUEL_PATH_XCRUN_FOR_TESTS || "xcrun";

const developerDirectory = run(xcodeSelectCommand, ["-p"], 5_000);
const simctlDevices = run(xcrunCommand, ["simctl", "list", "devices", "available"], 5_000);
const simctlRuntimes = run(xcrunCommand, ["simctl", "list", "runtimes", "available"], 5_000);
const simulators = parseAvailableSimulators(simctlDevices.stdout);
const iosRuntimes = parseIosRuntimes(simctlRuntimes.stdout);

const checks = [
  {
    name: "Xcode developer directory",
    status: developerDirectory.status === 0 ? "pass" : "blocked",
    detail: developerDirectory.status === 0 ? developerDirectory.stdout.trim() : commandError(developerDirectory) || "Install full Xcode.",
  },
  {
    name: "iOS simulator control",
    status: simctlDevices.status === 0 ? "pass" : "blocked",
    detail: simctlDevices.status === 0
      ? "xcrun simctl is available."
      : commandError(simctlDevices) || "Install full Xcode or switch xcode-select to the full Xcode developer directory.",
  },
  {
    name: "iOS simulator runtime",
    status: iosRuntimes.length ? "pass" : simctlRuntimes.status === 0 ? "blocked" : "blocked",
    detail: iosRuntimes.length ? iosRuntimes.join(", ") : "Install an iOS simulator runtime from Xcode Settings > Platforms.",
  },
  {
    name: "Bootable iOS simulator",
    status: simulators.length ? "pass" : simctlDevices.status === 0 ? "blocked" : "blocked",
    detail: simulators.length ? `${simulators.length} simulator(s) available.` : "Create or install an iOS simulator device.",
  },
];

const commands = buildCommands();

console.log("Fuel Path iOS simulator plan");
for (const item of checks) {
  const marker = item.status === "pass" ? "PASS" : "BLOCKED";
  console.log(`${marker} ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
}

console.log("\nRecommended commands");
for (const command of commands) {
  console.log(command);
}

const blockers = checks.filter((item) => item.status === "blocked");
if (blockers.length) {
  console.error(`iOS simulator setup is blocked by ${blockers.length} item(s).`);
  process.exit(1);
}

console.log("iOS simulator setup plan is ready for native validation.");

function buildCommands() {
  const lines = [];
  if (developerDirectory.status !== 0 || developerDirectory.stdout.includes("/CommandLineTools")) {
    lines.push("Install full Xcode from the App Store or Apple Developer downloads.");
    lines.push("sudo xcode-select -s /Applications/Xcode.app/Contents/Developer");
  }
  if (!iosRuntimes.length) {
    lines.push("Xcode > Settings > Platforms > install the current iOS simulator runtime");
  }
  if (!simulators.length && simctlDevices.status === 0) {
    lines.push(`${xcrunCommand} simctl create "Fuel Path iPhone" "iPhone 15"`);
  }
  lines.push("npm run native:readiness -- --strict");
  return lines;
}

function parseAvailableSimulators(output) {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /\([0-9A-F-]+\) \((Shutdown|Booted)\)/.test(line));
}

function parseIosRuntimes(output) {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^iOS \d+/.test(line) && /\(available\)/i.test(line));
}

function run(command, args, timeout) {
  return spawnSync(command, args, { encoding: "utf8", timeout });
}

function commandError(result) {
  return (result.stderr || result.stdout || result.error?.message || "").trim();
}
