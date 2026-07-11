import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const mobileRoot = resolve(scriptDir, "..");
const repoRoot = resolve(mobileRoot, "..");
const outputRoot = resolve(repoRoot, "tmp", "native-smoke");
const sdkRoot = findAndroidSdkRoot();
const adb = join(sdkRoot, "platform-tools", "adb");
const emulator = join(sdkRoot, "emulator", "emulator");
const avdName = process.env.FUEL_PATH_ANDROID_AVD || "Fuel_Path_Arm64_API_35";
const packageName = "com.fuelpath.app";
const activityName = "com.fuelpath.app/.MainActivity";
const artifact = resolveInputPath(argumentValue("--artifact") || process.env.FUEL_PATH_NATIVE_ARTIFACT || "");
const mapSettleMs = Number(process.env.FUEL_PATH_ANDROID_MAP_SETTLE_MS || argumentValue("--map-settle-ms") || 8_000);
const requirePhysicalDevice = process.argv.includes("--require-physical");
const requestedDeviceSerial = argumentValue("--device-serial") || process.env.FUEL_PATH_ANDROID_DEVICE_SERIAL || "";
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const reportJson = join(outputRoot, `android-preview-smoke-${timestamp}.json`);
const reportMd = join(outputRoot, `android-preview-smoke-${timestamp}.md`);
const screenshots = [];
const marks = [];
const appForegroundTimeoutMs = Number(process.env.FUEL_PATH_ANDROID_PREVIEW_FOREGROUND_MS || 45_000);
let emulatorProcess;
let selectedDeviceSerial = requestedDeviceSerial;

mkdirSync(outputRoot, { recursive: true });

try {
  assertTool(adb, "adb");
  assertTool(emulator, "emulator");
  if (!artifact || !existsSync(artifact)) {
    throw new Error("Pass a preview APK with --artifact <path> or FUEL_PATH_NATIVE_ARTIFACT.");
  }

  const device = await ensureAndroidBooted();
  adbCommand(["install", "-r", artifact], { maxBuffer: 16 * 1024 * 1024 });
  clearLogcat();
  await launchPreviewApp();
  await wait(mapSettleMs);
  resetGfxinfo();
  await tapLabel("Plan", "plan tab", { x: 260, y: 2220 });
  await wait(1_500);
  await capture("plan");
  await tapLabel("Nearby", "nearby tab", { x: 540, y: 2220 });
  await wait(2_500);
  await capture("nearby");
  await swipe(540, 1160, 540, 760, "nearby pan/list drag");
  await wait(1_500);
  await capture("nearby-after-pan");
  await tapLabel("Settings", "settings tab", { x: 860, y: 2220 });
  await wait(1_500);
  await capture("account");
  await performMeasuredFramePass();

  const logcat = adbCommand(["logcat", "-d", "-t", "1000"]);
  const gfxinfo = adbCommand(["shell", "dumpsys", "gfxinfo", packageName]);
  const certificate = readApkCertificate();
  const artifactSha256 = createHash("sha256").update(readFileSync(artifact)).digest("hex");
  const deviceDiagnostics = readDeviceDiagnostics();
  const logPath = join(outputRoot, `android-preview-smoke-${timestamp}.logcat.txt`);
  const gfxPath = join(outputRoot, `android-preview-smoke-${timestamp}.gfxinfo.txt`);
  writeFileSync(logPath, logcat.stdout);
  writeFileSync(gfxPath, gfxinfo.stdout);

  const failureLines = logcat.stdout
    .split("\n")
    .filter((line) => /\b(FATAL EXCEPTION|TypeError: undefined is not a function)\b/i.test(line));
  const mapWarningLines = logcat.stdout
    .split("\n")
    .filter(isMapCredentialWarningLine);
  const frameSummary = parseGfxinfo(gfxinfo.stdout);
  const mapTileSummaries = screenshots
    .filter((path) => /-(plan|nearby|nearby-after-pan)\.png$/.test(path))
    .map((path) => ({ screenshot: path, ...analyseMapScreenshot(path) }));
  const mapTileSummary = mapTileSummaries[0] || analyseMapScreenshot(screenshots[0]);
  const attentionItems = buildAttentionItems(frameSummary, mapWarningLines, mapTileSummaries);
  const result = {
    status: failureLines.length ? "failed" : attentionItems.length ? "partial" : "passed",
    renderStatus: failureLines.length ? "failed" : "passed",
    performanceStatus: attentionItems.length ? "needs_device_validation" : "passed",
    packageName,
    activityName,
    avdName,
    device,
    artifact,
    artifactName: basename(artifact),
    certificate,
    artifactSha256,
    mapSettleMs,
    deviceDiagnostics,
    screenshots,
    marks,
    frameSummary,
    logPath,
    gfxPath,
    failureLines,
    mapWarningLines,
    mapTileSummary,
    mapTileSummaries,
    attentionItems,
  };
  writeReport(result);
  if (failureLines.length) process.exit(1);
} finally {
  if (emulatorProcess && !process.argv.includes("--keep-emulator")) {
    adbSpawnSync(["emu", "kill"], { encoding: "utf8" });
  }
}

async function ensureAndroidBooted() {
  let device = currentAndroidDevice();
  if (requestedDeviceSerial && !device) {
    throw new Error(`Requested Android device serial ${requestedDeviceSerial} is not visible to adb.`);
  }
  if (requirePhysicalDevice && requestedDeviceSerial && device?.serial?.startsWith("emulator-")) {
    throw new Error(`Physical Android device required for performance validation; requested ${requestedDeviceSerial} is an emulator.`);
  }
  if (!device && requirePhysicalDevice) {
    throw new Error("Physical Android device required for performance validation; no Android device is connected.");
  }
  if (!device) {
    emulatorProcess = spawn(emulator, [
      "-avd",
      avdName,
      "-no-window",
      "-no-audio",
      "-no-snapshot",
      "-gpu",
      "swiftshader_indirect",
      "-no-boot-anim",
    ], { stdio: "ignore" });
    emulatorProcess.unref();
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < 120_000) {
    device = currentAndroidDevice();
    if (device) selectedDeviceSerial = device.serial;
    const booted = device ? adbSpawnSync(["shell", "getprop", "sys.boot_completed"], { encoding: "utf8" }).stdout.trim() : "";
    if (booted === "1") {
      marks.push({ name: "android_booted", ms: Date.now() - startedAt });
      return device || currentAndroidDevice() || { serial: "unknown", type: "unknown", detail: "" };
    }
    await wait(2_000);
  }
  throw new Error(`Android emulator ${avdName} did not boot within 120 seconds.`);
}

function currentAndroidDevice() {
  const lines = command(adb, ["devices", "-l"]).stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("List of devices"));
  const devices = lines
    .filter((item) => /\sdevice\s/.test(item))
    .map((line) => {
      const serial = line.split(/\s+/)[0];
      return {
        serial,
        type: serial.startsWith("emulator-") ? "emulator" : "physical",
        detail: line,
      };
    });
  const requested = requestedDeviceSerial
    ? devices.find((item) => item.serial === requestedDeviceSerial)
    : null;
  if (requestedDeviceSerial && !requested) return undefined;
  const device = requested || (requirePhysicalDevice ? devices.find((item) => item.type === "physical") : devices[0]);
  if (device) selectedDeviceSerial = device.serial;
  return device;
}

function adbArgs(args) {
  return selectedDeviceSerial ? ["-s", selectedDeviceSerial, ...args] : args;
}

function adbCommand(args, options = {}) {
  return command(adb, adbArgs(args), options);
}

function adbSpawnSync(args, options = {}) {
  return spawnSync(adb, adbArgs(args), options);
}

function currentAndroidDeviceLine() {
  const line = command(adb, ["devices", "-l"]).stdout
    .split("\n")
    .map((item) => item.trim())
    .find((item) => item && !item.startsWith("List of devices") && item.startsWith(`${selectedDeviceSerial} `));
  if (!line) return undefined;
  return line;
}

async function launchPreviewApp() {
  adbCommand(["shell", "am", "force-stop", packageName]);
  adbCommand(["shell", "am", "start", "-n", activityName]);
  const startedAt = Date.now();
  let lastDump = "";
  while (Date.now() - startedAt < appForegroundTimeoutMs) {
    let dump = "";
    try {
      dump = readUiDump();
      lastDump = dump;
    } catch (error) {
      dump = "";
    }
    if (isFuelPathForeground()) {
      marks.push({ name: "preview_app_launched", ms: Date.now() - startedAt, reason: "foreground_check" });
      return;
    }
    if (dump && /Fuel Path|Plan trip|Nearby|Account/i.test(dump) && dump.includes(`package="${packageName}"`)) {
      marks.push({ name: "preview_app_launched", ms: Date.now() - startedAt });
      return;
    }
    await wait(1_500);
  }
  throw new Error(`Fuel Path preview APK did not become visible. Last UI dump:\n${lastDump.slice(0, 2_000)}`);
}

async function tap(x, y, label) {
  adbCommand(["shell", "input", "tap", String(x), String(y)]);
  marks.push({ name: label, at: new Date().toISOString() });
}

async function tapLabel(text, label, fallback) {
  const bounds = findNodeBoundsByText(readUiDump(), text);
  const point = bounds ? centreOfBounds(bounds) : fallback;
  await tap(Math.round(point.x), Math.round(point.y), label);
  marks.push({
    name: `${label} target`,
    text,
    target: bounds ? "ui_dump" : "fallback",
    x: Math.round(point.x),
    y: Math.round(point.y),
  });
}

async function swipe(x1, y1, x2, y2, label) {
  adbCommand(["shell", "input", "swipe", String(x1), String(y1), String(x2), String(y2), "450"]);
  marks.push({ name: label, at: new Date().toISOString() });
}

async function measuredSwipe(x1, y1, x2, y2, durationMs, label) {
  adbCommand(["shell", "input", "swipe", String(x1), String(y1), String(x2), String(y2), String(durationMs)]);
  marks.push({ name: label, at: new Date().toISOString(), durationMs });
}

async function performMeasuredFramePass() {
  await tapLabel("Nearby", "nearby tab before measured frame pass", { x: 540, y: 2220 });
  await wait(1_000);
  resetGfxinfo("gfxinfo_reset_before_measured_frame_pass");
  await measuredSwipe(500, 1800, 500, 600, 1200, "measured nearby upward drag");
  await wait(700);
  await measuredSwipe(500, 600, 500, 1800, 1200, "measured nearby downward drag");
  await wait(700);
  await measuredSwipe(500, 1800, 500, 600, 1200, "measured nearby second upward drag");
  await wait(1_200);
  await capture("nearby-measured-frame-pass");
}

async function capture(name) {
  let foreground = isPreviewAppVisible();
  if (!foreground) {
    await bringPreviewAppToForeground(`foreground recovery before ${name}`);
    foreground = isPreviewAppVisible();
  }
  if (!foreground) {
    throw new Error(`Could not capture ${name}: Fuel Path is not foreground.`);
  }
  const path = join(outputRoot, `android-preview-smoke-${timestamp}-${name}.png`);
  let lastResult;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    lastResult = adbSpawnSync(["exec-out", "screencap", "-p"], {
      encoding: "buffer",
      maxBuffer: 8 * 1024 * 1024,
    });
    if (lastResult.status !== 0 || lastResult.stdout.length < 1024) break;
    writeFileSync(path, lastResult.stdout);
    const integrity = screenshotEdgeIntegrity(readPng(path));
    marks.push({ name: `${name} screenshot integrity attempt`, attempt, ...integrity });
    if (integrity.screenshotIntegrityReady) break;
    await wait(1_500);
  }
  if (lastResult?.status !== 0 || !lastResult || lastResult.stdout.length < 1024) {
    throw new Error(`Could not capture ${name}: ${lastResult?.error?.message || lastResult?.stderr?.toString() || "empty screencap"}`);
  }
  screenshots.push(path);
}

async function bringPreviewAppToForeground(reason) {
  adbCommand(["shell", "am", "start", "-n", activityName]);
  marks.push({ name: reason, at: new Date().toISOString() });
  await wait(1_500);
}

function isPreviewAppVisible() {
  try {
    const dump = readUiDump();
    if (dump.includes(`package="${packageName}"`)) return true;
  } catch (error) {
    // Fall back to window focus below.
  }
  return isFuelPathForeground();
}

function isFuelPathForeground() {
  const result = adbSpawnSync(["shell", "dumpsys", "window"], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    timeout: 5_000,
  });
  if (result.error || result.status !== 0) return false;
  const output = result.stdout;
  const lines = output.split("\n");
  const focusLine = lines.find((line) => line.includes("mCurrentFocus="));
  const focusedAppLine = lines.find((line) => line.includes("mFocusedApp="));
  const hasPackageWindow =
    output.includes(`${packageName}/${packageName}.MainActivity`)
    || output.includes(`${packageName}/.MainActivity`);
  const hasFocusedApp = Boolean(focusedAppLine && focusedAppLine.includes(`${packageName}/`));

  if (focusLine) {
    if (focusLine.includes("NotificationShade")) {
      return hasPackageWindow && hasFocusedApp;
    }
    return hasPackageWindow && focusLine.includes("com.fuelpath.app");
  }

  return hasPackageWindow && hasFocusedApp;
}

function readUiDump() {
  const dumpResult = adbSpawnSync(["shell", "uiautomator", "dump", "/sdcard/fuel-path-preview-window.xml"], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
    timeout: 10_000,
  });
  if (dumpResult.error) {
    throw new Error(`Android UI dump timed out or failed: ${dumpResult.error.message}`);
  }
  if (dumpResult.status !== 0) {
    throw new Error(`Android UI dump failed: ${dumpResult.stderr || dumpResult.stdout || "unknown error"}`);
  }
  const readResult = adbSpawnSync(["exec-out", "cat", "/sdcard/fuel-path-preview-window.xml"], {
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
    timeout: 5_000,
  });
  if (readResult.error) {
    throw new Error(`Android UI dump read timed out or failed: ${readResult.error.message}`);
  }
  if (readResult.status !== 0) {
    throw new Error(`Android UI dump read failed: ${readResult.stderr || readResult.stdout || "unknown error"}`);
  }
  return readResult.stdout || "";
}

function findNodeBoundsByText(xml, text) {
  const escaped = escapeRegExp(escapeXmlAttribute(text));
  const nodePattern = new RegExp(`<node\\b(?=[^>]*(?:text|content-desc)="${escaped}")[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"[^>]*/?>`, "i");
  const match = xml.match(nodePattern);
  if (!match) return null;
  return {
    left: Number(match[1]),
    top: Number(match[2]),
    right: Number(match[3]),
    bottom: Number(match[4]),
  };
}

function centreOfBounds(bounds) {
  return {
    x: (bounds.left + bounds.right) / 2,
    y: (bounds.top + bounds.bottom) / 2,
  };
}

function escapeXmlAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readApkCertificate() {
  const apksigner = latestTool("build-tools", "apksigner");
  if (!apksigner) return { error: "apksigner not found" };
  const androidStudioJavaHome = "/Applications/Android Studio.app/Contents/jbr/Contents/Home";
  const javaHome = process.env.JAVA_HOME || (existsSync(androidStudioJavaHome)
    ? androidStudioJavaHome
    : join(repoRoot, "var", "tooling", "java", "jdk-21.0.11+10", "Contents", "Home"));
  const result = spawnSync(apksigner, ["verify", "--print-certs", artifact], {
    encoding: "utf8",
    env: { ...process.env, JAVA_HOME: javaHome },
  });
  if (result.status !== 0) return { error: result.stderr || result.stdout };
  return {
    sha1: matchText(result.stdout, /SHA-1 digest:\s*([a-f0-9]+)/i),
    sha256: matchText(result.stdout, /SHA-256 digest:\s*([a-f0-9]+)/i),
  };
}

function readDeviceDiagnostics() {
  const connectivity = adbSpawnSync(["shell", "dumpsys", "connectivity"], {
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
  }).stdout || "";
  return {
    googlePlayServicesVersion: packageVersion("com.google.android.gms"),
    googleMapsVersion: packageVersion("com.google.android.apps.maps"),
    networkProbeSummary: matchText(connectivity, /(NetworkAgentInfo\{[^}]+VALIDATED[^}]+\})/),
    targetDeviceLine: currentAndroidDeviceLine() || "",
  };
}

function packageVersion(name) {
  const output = adbSpawnSync(["shell", "dumpsys", "package", name], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  }).stdout || "";
  const versionName = matchText(output, /versionName=([^\s]+)/);
  const versionCode = matchText(output, /versionCode=(\d+)/);
  return [versionName, versionCode ? `(${versionCode})` : ""].filter(Boolean).join(" ");
}

function buildAttentionItems(frameSummary, mapWarningLines, mapTileSummaries) {
  const attentionItems = [];
  if (mapWarningLines.length) {
    attentionItems.push("Google Maps or Google Play services credential warnings were captured; confirm the Android Maps key restriction, API enablement and emulator Google Play services state.");
  }
  const blankSummaries = mapTileSummaries.filter((summary) => summary.blankMapLikely);
  if (blankSummaries.length) {
    attentionItems.push(`Google map tiles appear blank in ${blankSummaries.length}/${mapTileSummaries.length} map screenshots; first colour ratio ${blankSummaries[0].colourRatio}, detail buckets ${blankSummaries[0].detailBuckets}.`);
  }
  const incompleteScreens = mapTileSummaries.filter((summary) => summary.screenshotIntegrityReady === false);
  if (incompleteScreens.length) {
    attentionItems.push(`Screenshot integrity failed in ${incompleteScreens.length}/${mapTileSummaries.length} map captures; black or clipped edge bands exceed the allowed threshold.`);
  }
  if (frameSummary.totalFrames < 30) {
    attentionItems.push(frameSummary.renderSurfacePresent
      ? `Frame timing is unavailable from gfxinfo: ${frameSummary.totalFrames} counted frames, but ${frameSummary.viewRootCount} ViewRootImpl and ${frameSummary.graphicsBufferCount} graphics buffers were present. Treat this as render evidence only.`
      : `Frame evidence is insufficient for a performance claim: ${frameSummary.totalFrames} rendered frames captured.`);
    return attentionItems;
  }
  if (frameSummary.jankyPercent > 20) {
    attentionItems.push(`Frame jank is high for a performance claim: ${frameSummary.jankyPercent}% janky frames.`);
  }
  if (frameSummary.percentile95Ms > 80) {
    attentionItems.push(`Frame p95 is high for a performance claim: ${frameSummary.percentile95Ms} ms.`);
  }
  return attentionItems;
}

function isMapCredentialWarningLine(line) {
  if (/GoogleCertificatesRslt/i.test(line) && /PhFlagUpdateRegistry|Phenotype/i.test(line)) return false;
  return /GoogleCertificatesRslt|Authorization failure|API key|ApiNotActivated|REQUEST_DENIED|Application credential header not valid|GLSUser/i.test(line);
}

function parseGfxinfo(output) {
  const totalFrames = matchNumber(output, /Total frames rendered:\s+(\d+)/);
  const jankyFrames = matchNumber(output, /Janky frames:\s+(\d+)/);
  const viewRootCount = matchNumber(output, /Total ViewRootImpl\s+:\s+(\d+)/);
  const attachedViewCount = matchNumber(output, /Total attached Views\s+:\s+(\d+)/);
  const renderNodeMemory = matchText(output, /Total RenderNode\s+:\s+([^\n]+)/).trim();
  const graphicsBufferCount = (output.match(/^\s*0x[0-9a-f]+\s+\|/gim) || []).length;
  const graphicsBufferEstimateKb = matchNumber(output, /Total allocated by GraphicBufferAllocator \(estimate\):\s+([\d.]+)\s+KB/);
  const profileDataRows = output
    .split("---PROFILEDATA---")[1]
    ?.split("\n")
    .filter((line) => /^\d/.test(line.trim()))
    .length || 0;
  return {
    totalFrames,
    jankyFrames,
    jankyPercent: totalFrames ? Number(((jankyFrames / totalFrames) * 100).toFixed(1)) : 0,
    percentile90Ms: totalFrames ? matchNumber(output, /90th percentile:\s+(\d+)ms/) : null,
    percentile95Ms: totalFrames ? matchNumber(output, /95th percentile:\s+(\d+)ms/) : null,
    percentile99Ms: totalFrames ? matchNumber(output, /99th percentile:\s+(\d+)ms/) : null,
    viewRootCount,
    attachedViewCount,
    renderNodeMemory,
    graphicsBufferCount,
    graphicsBufferEstimateKb,
    profileDataRows,
    renderSurfacePresent: viewRootCount > 0 && graphicsBufferCount > 0,
  };
}

function writeReport(result) {
  writeFileSync(reportJson, `${JSON.stringify(result, null, 2)}\n`);
  writeFileSync(reportMd, [
    "# Android Preview APK Smoke",
    "",
    `Status: ${result.status}`,
    `Artifact: ${result.artifactName}`,
    `Package: ${result.packageName}`,
    `Device: ${result.device.type} ${result.device.serial}`,
    `Signing certificate SHA-1: ${result.certificate.sha1 || "unknown"}`,
    `Signing certificate SHA-256: ${result.certificate.sha256 || "unknown"}`,
    `APK SHA-256: ${result.artifactSha256}`,
    `Map settle: ${result.mapSettleMs} ms`,
    "",
    "## Frame Summary",
    "",
    `- Total frames: ${result.frameSummary.totalFrames}`,
    `- Janky frames: ${result.frameSummary.jankyFrames}`,
    `- Janky percent: ${result.frameSummary.jankyPercent}%`,
    `- p90: ${result.frameSummary.percentile90Ms} ms`,
    `- p95: ${result.frameSummary.percentile95Ms} ms`,
    `- p99: ${result.frameSummary.percentile99Ms} ms`,
    `- Render surface present: ${result.frameSummary.renderSurfacePresent}`,
    `- View roots: ${result.frameSummary.viewRootCount}`,
    `- Attached views: ${result.frameSummary.attachedViewCount}`,
    `- Graphics buffers: ${result.frameSummary.graphicsBufferCount}`,
    `- Graphics buffer estimate: ${result.frameSummary.graphicsBufferEstimateKb} KB`,
    `- Profile frame rows: ${result.frameSummary.profileDataRows}`,
    "",
    "## Map Tile Summary",
    "",
    `- Blank map likely: ${result.mapTileSummary.blankMapLikely}`,
    `- Colour ratio: ${result.mapTileSummary.colourRatio}`,
    `- Detail buckets: ${result.mapTileSummary.detailBuckets}`,
    `- Sample count: ${result.mapTileSummary.sampleCount}`,
    "",
    "## Map Tile Screens",
    "",
    ...result.mapTileSummaries.map(
      (summary) =>
        `- ${basename(summary.screenshot)}: blank=${summary.blankMapLikely}, integrity=${summary.screenshotIntegrityReady}, blackEdges=${summary.blackEdgeRatio}, colour=${summary.colourRatio}, buckets=${summary.detailBuckets}`,
    ),
    "",
    "## Device Diagnostics",
    "",
    `- Google Play services: ${result.deviceDiagnostics.googlePlayServicesVersion || "unknown"}`,
    `- Google Maps app: ${result.deviceDiagnostics.googleMapsVersion || "unknown"}`,
    `- Network probes: ${result.deviceDiagnostics.networkProbeSummary || "unknown"}`,
    "",
    "## Screenshots",
    "",
    ...result.screenshots.map((path) => `- ${path}`),
    "",
    "## Attention Items",
    "",
    ...(result.attentionItems.length ? result.attentionItems.map((item) => `- ${item}`) : ["- None"]),
    "",
    "## Map Warning Lines",
    "",
    ...(result.mapWarningLines.length ? result.mapWarningLines.slice(0, 8).map((line) => `- ${line}`) : ["- None"]),
    "",
  ].join("\n"));
  console.log(`Android preview APK smoke ${result.status}: ${reportMd}`);
}

function clearLogcat() {
  adbSpawnSync(["logcat", "-c"], { encoding: "utf8" });
}

function resetGfxinfo(name = "gfxinfo_reset_after_map_settle") {
  adbSpawnSync(["shell", "dumpsys", "gfxinfo", packageName, "reset"], { encoding: "utf8" });
  marks.push({ name, at: new Date().toISOString() });
}

function analyseMapScreenshot(path) {
  try {
    const png = readPng(path);
    const xStart = Math.floor(png.width * 0.08);
    const xEnd = Math.floor(png.width * 0.92);
    const yStart = Math.floor(png.height * 0.38);
    const yEnd = Math.floor(png.height * 0.78);
    const buckets = new Set();
    let colourPixels = 0;
    let sampleCount = 0;

    for (let y = yStart; y < yEnd; y += 8) {
      for (let x = xStart; x < xEnd; x += 8) {
        const index = (y * png.width + x) * 4;
        const r = png.data[index];
        const g = png.data[index + 1];
        const b = png.data[index + 2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max === 0 ? 0 : (max - min) / max;
        const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        if (saturation > 0.08 && luminance > 0.2 && luminance < 0.96) colourPixels += 1;
        buckets.add(`${r >> 4}:${g >> 4}:${b >> 4}`);
        sampleCount += 1;
      }
    }

    const colourRatio = sampleCount ? Number((colourPixels / sampleCount).toFixed(4)) : 0;
    const detailBuckets = buckets.size;
    const edge = screenshotEdgeIntegrity(png);
    return {
      blankMapLikely: colourRatio < 0.015 && detailBuckets < 28,
      ...edge,
      colourRatio,
      detailBuckets,
      sampleCount,
    };
  } catch (error) {
    return {
      blankMapLikely: false,
      error: error.message,
    };
  }
}

function screenshotEdgeIntegrity(png) {
  const topEnd = Math.max(1, Math.floor(png.height * 0.12));
  const rightStart = Math.floor(png.width * 0.94);
  let black = 0;
  let sampled = 0;
  for (let y = 0; y < png.height; y += 6) {
    for (let x = 0; x < png.width; x += 6) {
      if (y >= topEnd && x < rightStart) continue;
      const index = (y * png.width + x) * 4;
      if (
        png.data[index + 3] < 250 ||
        (png.data[index] < 8 && png.data[index + 1] < 8 && png.data[index + 2] < 8)
      ) black += 1;
      sampled += 1;
    }
  }
  const blackEdgeRatio = sampled ? Number((black / sampled).toFixed(4)) : 1;
  return { screenshotIntegrityReady: blackEdgeRatio < 0.2, blackEdgeRatio };
}

function readPng(path) {
  const bytes = readFileSync(path);
  const signature = "89504e470d0a1a0a";
  if (bytes.subarray(0, 8).toString("hex") !== signature) throw new Error("not a PNG");

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colourType = 0;
  const idat = [];

  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colourType = data[9];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += length + 12;
  }

  if (bitDepth !== 8 || colourType !== 6) {
    throw new Error(`unsupported PNG format bitDepth=${bitDepth} colourType=${colourType}`);
  }

  const compressed = Buffer.concat(idat);
  const inflated = inflateSync(compressed);
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const output = Buffer.alloc(width * height * bytesPerPixel);
  let inputOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inputOffset++];
    const row = inflated.subarray(inputOffset, inputOffset + stride);
    inputOffset += stride;
    const outputRow = y * stride;
    const priorRow = outputRow - stride;

    for (let x = 0; x < stride; x += 1) {
      const left = x >= bytesPerPixel ? output[outputRow + x - bytesPerPixel] : 0;
      const up = y > 0 ? output[priorRow + x] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? output[priorRow + x - bytesPerPixel] : 0;
      const raw = row[x];
      output[outputRow + x] = (raw + pngFilterValue(filter, left, up, upLeft)) & 0xff;
    }
  }

  return { width, height, data: output };
}

function pngFilterValue(filter, left, up, upLeft) {
  if (filter === 0) return 0;
  if (filter === 1) return left;
  if (filter === 2) return up;
  if (filter === 3) return Math.floor((left + up) / 2);
  if (filter === 4) return paeth(left, up, upLeft);
  throw new Error(`unsupported PNG filter ${filter}`);
}

function paeth(left, up, upLeft) {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) return left;
  return pb <= pc ? up : upLeft;
}

function command(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024, ...options });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${cmd} ${args.join(" ")} failed`);
  return result;
}

function latestTool(group, tool) {
  return spawnSync("zsh", ["-lc", `ls "${sdkRoot}/${group}"/*/${tool} 2>/dev/null | sort -V | tail -1`], {
    encoding: "utf8",
  }).stdout.trim();
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function resolveInputPath(value) {
  if (!value) return "";
  return isAbsolute(value) ? value : resolve(process.cwd(), value);
}

function matchNumber(value, pattern) {
  const match = value.match(pattern);
  return match ? Number(match[1]) : 0;
}

function matchText(value, pattern) {
  const match = value.match(pattern);
  return match ? match[1] : "";
}

function assertTool(path, label) {
  if (!existsSync(path)) throw new Error(`${label} was not found at ${path}`);
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
