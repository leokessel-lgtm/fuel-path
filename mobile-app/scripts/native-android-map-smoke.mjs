import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(scriptDir, "..");
const repoRoot = resolve(appRoot, "..");
const outputRoot = resolve(repoRoot, "tmp", "native-smoke");
const avdName = process.env.FUEL_PATH_ANDROID_AVD || "Fuel_Path_Arm64_API_35";
const port = process.env.FUEL_PATH_ANDROID_SMOKE_PORT || "8082";
const sdkRoot = findAndroidSdkRoot();
const adb = join(sdkRoot, "platform-tools", "adb");
const emulator = join(sdkRoot, "emulator", "emulator");
const deviceSerial = process.env.FUEL_PATH_ANDROID_DEVICE_SERIAL || "";
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const reportJson = join(outputRoot, `android-map-smoke-${timestamp}.json`);
const reportMd = join(outputRoot, `android-map-smoke-${timestamp}.md`);
const screenshots = [];
const marks = [];
let emulatorProcess;
let expoProcess;

mkdirSync(outputRoot, { recursive: true });

try {
  assertTool(adb, "adb");
  assertTool(emulator, "emulator");
  await ensureAndroidBooted();
  clearLogcat();
  await launchExpoGo();
  await capture("plan");
  await tap(540, 2260, "nearby tab");
  await wait(2_000);
  await capture("nearby");
  await swipe(540, 1200, 540, 760, "nearby list/panel drag");
  await wait(1_000);
  await capture("nearby-after-pan");
  await tap(860, 2260, "account tab");
  await wait(1_500);
  await capture("account");

  const logcat = command(`${adb}`, ["logcat", "-d", "-t", "500"]);
  const gfxinfo = command(`${adb}`, ["shell", "dumpsys", "gfxinfo", "host.exp.exponent"]);
  const logPath = join(outputRoot, `android-map-smoke-${timestamp}.logcat.txt`);
  const gfxPath = join(outputRoot, `android-map-smoke-${timestamp}.gfxinfo.txt`);
  writeFileSync(logPath, logcat.stdout);
  writeFileSync(gfxPath, gfxinfo.stdout);

  const failureLines = logcat.stdout
    .split("\n")
    .filter((line) => /\b(FATAL EXCEPTION|Uncaught|expo-notifications: Android Push notifications|TypeError: undefined is not a function)\b/i.test(line));
  const frameSummary = parseGfxinfo(gfxinfo.stdout);
  const attentionItems = buildAttentionItems(frameSummary);
  const result = {
    status: failureLines.length ? "failed" : attentionItems.length ? "partial" : "passed",
    renderStatus: failureLines.length ? "failed" : "passed",
    performanceStatus: attentionItems.length ? "needs_dev_or_device_validation" : "passed",
    avdName,
    port: Number(port),
    screenshots,
    marks,
    frameSummary,
    logPath,
    gfxPath,
    failureLines,
    attentionItems,
    caveat: "Expo Go smoke proves Android render/navigation/pan only. Push-token delivery still needs a development or EAS preview build.",
  };
  writeReport(result);
  if (failureLines.length) process.exit(1);
} finally {
  if (expoProcess) {
    expoProcess.kill("SIGINT");
    await wait(1_000);
  }
  if (emulatorProcess && !process.argv.includes("--keep-emulator")) {
    spawnSync(adb, ["emu", "kill"], { encoding: "utf8" });
  }
}

function buildAttentionItems(frameSummary) {
  const attentionItems = [
    "Expo Go may show its floating tools button, so screenshots are render evidence only.",
    "Expo Go cannot validate push-token delivery or production notification behaviour.",
  ];
  if (frameSummary.jankyPercent > 20) {
    attentionItems.push(`Frame jank is high for a performance claim: ${frameSummary.jankyPercent}% janky frames.`);
  }
  if (frameSummary.percentile95Ms > 80) {
    attentionItems.push(`Frame p95 is high for a performance claim: ${frameSummary.percentile95Ms} ms.`);
  }
  return attentionItems;
}

async function ensureAndroidBooted() {
  const devices = command(adb, ["devices", "-l"]).stdout;
  if (!devices.includes("device product:")) {
    emulatorProcess = spawn(emulator, [
      "-avd",
      avdName,
      "-no-window",
      "-no-audio",
      "-no-snapshot",
      "-gpu",
      "swiftshader_indirect",
      "-no-boot-anim",
    ], {
      detached: false,
      stdio: "ignore",
    });
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < 120_000) {
    const booted = spawnSync(adb, ["shell", "getprop", "sys.boot_completed"], { encoding: "utf8" }).stdout.trim();
    if (booted === "1") {
      marks.push({ name: "android_booted", ms: Date.now() - startedAt });
      return;
    }
    await wait(2_000);
  }
  throw new Error(`Android emulator ${avdName} did not boot within 120 seconds.`);
}

async function launchExpoGo() {
  const startedAt = Date.now();
  expoProcess = spawn("npx", [
    "expo",
    "start",
    "--localhost",
    "--port",
    port,
  ], {
    cwd: appRoot,
    env: {
      ...process.env,
      EXPO_PUBLIC_FUEL_PATH_API_BASE_URL: "https://fuel-path.vercel.app",
      npm_config_cache: ".npm-cache",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  expoProcess.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  expoProcess.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  while (Date.now() - startedAt < 120_000) {
    if (/Metro waiting on|Logs for your project will appear below/.test(output)) {
      command(adb, ["reverse", `tcp:${port}`, `tcp:${port}`]);
      command(adb, ["shell", "am", "force-stop", "host.exp.exponent"]);
      command(adb, [
        "shell",
        "am",
        "start",
        "-a",
        "android.intent.action.VIEW",
        "-d",
        `exp://127.0.0.1:${port}`,
        "host.exp.exponent",
      ]);
      await waitForAppSurface();
      marks.push({ name: "expo_go_launched", ms: Date.now() - startedAt });
      return;
    }
    if (/CommandError|Error:/.test(output) && !/Warning:/.test(output)) {
      throw new Error(output.slice(-2_000));
    }
    await wait(1_000);
  }
  throw new Error(`Expo Go did not launch within 120 seconds. Last output:\n${output.slice(-2_000)}`);
}

async function waitForAppSurface() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 90_000) {
    const dump = readUiDump();
    if (/Fuel Path|Plan trip|Start address|Destination address|Nearby|Account/i.test(dump) && !/Expo Go|Development servers|Enter URL|Scan QR/i.test(dump)) {
      return;
    }
    if (/Expo Go|Development servers|Enter URL|Scan QR/i.test(dump)) {
      command(adb, [
        "shell",
        "am",
        "start",
        "-a",
        "android.intent.action.VIEW",
        "-d",
        `exp://127.0.0.1:${port}`,
        "host.exp.exponent",
      ]);
    }
    await wait(2_000);
  }
  throw new Error(`Fuel Path did not become the visible app surface. Last UI dump:\n${readUiDump().slice(0, 2_000)}`);
}

async function tap(x, y, label) {
  command(adb, ["shell", "input", "tap", String(x), String(y)]);
  marks.push({ name: label, at: new Date().toISOString() });
}

async function swipe(x1, y1, x2, y2, label) {
  command(adb, ["shell", "input", "swipe", String(x1), String(y1), String(x2), String(y2), "450"]);
  marks.push({ name: label, at: new Date().toISOString() });
}

async function back(label) {
  command(adb, ["shell", "input", "keyevent", "4"]);
  marks.push({ name: label, at: new Date().toISOString() });
}

async function capture(name) {
  assertNotExpoGoShell(name);
  const path = join(outputRoot, `android-map-smoke-${timestamp}-${name}.png`);
  const result = spawnSync(adb, ["exec-out", "screencap", "-p"], {
    encoding: "buffer",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const detail = result.error?.message || result.stderr.toString() || `adb screencap exited with status ${result.status}`;
    throw new Error(`Could not capture ${name}: ${detail}`);
  }
  writeFileSync(path, result.stdout);
  screenshots.push(path);
}

function assertNotExpoGoShell(name) {
  const dump = readUiDump();
  if (/Expo Go|Development servers|Enter URL|Scan QR/i.test(dump)) {
    throw new Error(`Could not capture ${name}: Expo Go shell is visible instead of Fuel Path.`);
  }
}

function readUiDump() {
  spawnSync(adb, ["shell", "uiautomator", "dump", "/sdcard/fuel-path-window.xml"], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  const result = spawnSync(adb, ["exec-out", "cat", "/sdcard/fuel-path-window.xml"], {
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
  });
  return result.stdout || "";
}

function clearLogcat() {
  spawnSync(adb, ["logcat", "-c"], { encoding: "utf8" });
}

function parseGfxinfo(output) {
  const totalFrames = matchNumber(output, /Total frames rendered:\s+(\d+)/);
  const jankyFrames = matchNumber(output, /Janky frames:\s+(\d+)/);
  const percentile90 = matchNumber(output, /90th percentile:\s+(\d+)ms/);
  const percentile95 = matchNumber(output, /95th percentile:\s+(\d+)ms/);
  const percentile99 = matchNumber(output, /99th percentile:\s+(\d+)ms/);
  return {
    totalFrames,
    jankyFrames,
    jankyPercent: totalFrames ? Number(((jankyFrames / totalFrames) * 100).toFixed(1)) : 0,
    percentile90Ms: percentile90,
    percentile95Ms: percentile95,
    percentile99Ms: percentile99,
  };
}

function matchNumber(value, pattern) {
  const match = value.match(pattern);
  return match ? Number(match[1]) : 0;
}

function writeReport(result) {
  writeFileSync(reportJson, `${JSON.stringify(result, null, 2)}\n`);
  writeFileSync(reportMd, [
    "# Android Map Smoke",
    "",
    `Status: ${result.status}`,
    `AVD: ${result.avdName}`,
    `Port: ${result.port}`,
    "",
    "## Frame Summary",
    "",
    `- Total frames: ${result.frameSummary.totalFrames}`,
    `- Janky frames: ${result.frameSummary.jankyFrames}`,
    `- Janky percent: ${result.frameSummary.jankyPercent}%`,
    `- p90: ${result.frameSummary.percentile90Ms} ms`,
    `- p95: ${result.frameSummary.percentile95Ms} ms`,
    `- p99: ${result.frameSummary.percentile99Ms} ms`,
    "",
    "## Screenshots",
    "",
    ...result.screenshots.map((path) => `- ${path}`),
    "",
    "## Attention Items",
    "",
    ...(result.attentionItems.length ? result.attentionItems.map((item) => `- ${item}`) : ["- None"]),
    "",
    `Caveat: ${result.caveat}`,
    "",
  ].join("\n"));
  console.log(`Android map smoke ${result.status}: ${reportMd}`);
}

function assertTool(path, label) {
  if (!existsSync(path)) throw new Error(`${label} was not found at ${path}`);
}

function command(cmd, args) {
  const finalArgs = cmd === adb && deviceSerial && args[0] !== "devices" && args[0] !== "emu"
    ? ["-s", deviceSerial, ...args]
    : args;
  const result = spawnSync(cmd, finalArgs, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${cmd} ${finalArgs.join(" ")} failed`);
  }
  return result;
}

function findAndroidSdkRoot() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.HOME ? join(process.env.HOME, "Library", "Android", "sdk") : "",
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) || "";
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
