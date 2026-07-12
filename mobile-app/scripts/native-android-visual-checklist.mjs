import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = resolve(fileURLToPath(import.meta.url), "..");
const mobileRoot = resolve(scriptDir, "..");
const repoRoot = resolve(mobileRoot, "..");
const outputRoot = resolve(repoRoot, "tmp", "native-checklist");
const smokeOutputRoot = resolve(repoRoot, "tmp", "native-smoke");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const reportBase = `native-visual-checklist-${timestamp}`;

const adb = resolveAndroidSdk();
const packageName = "com.fuelpath.app";
const activityName = "com.fuelpath.app/.MainActivity";
const requestedDeviceSerial = argumentValue("--device-serial") || process.env.FUEL_PATH_ANDROID_DEVICE_SERIAL || "";
const explicitArtifact = argumentValue("--artifact") || process.env.FUEL_PATH_NATIVE_ARTIFACT || "";
const skipInstall = process.argv.includes("--skip-install");
const doInstall = !skipInstall;
const resetAppData = process.argv.includes("--reset-app-data");
const planOnly = process.argv.includes("--plan-only");
const evParity = process.argv.includes("--ev-parity");

const artifact = explicitArtifact ? resolve(repoRoot, explicitArtifact) : findLatestArtifact();

mkdirSync(outputRoot, { recursive: true });
mkdirSync(smokeOutputRoot, { recursive: true });
const reportMd = join(outputRoot, `${reportBase}.md`);

if (!existsSync(adb)) throw new Error(`adb not found at ${adb}`);

const serial = chooseDevice(requestedDeviceSerial);
if (!serial) throw new Error("No Android device connected or authorised.");

if (doInstall) {
  if (!artifact || !existsSync(artifact)) {
    throw new Error("No APK found. Provide --artifact path, set FUEL_PATH_NATIVE_ARTIFACT, or use --skip-install.");
  }
}

const evidence = [];

await installAndLaunch();
await switchTab("Plan");
if (evParity) {
  await captureEvParityFlow();
} else {
  await captureState("plan_default", {
    "Bottom navigation visible": hasBottomTabs,
    "Plan form shell present": (xml) => /content-desc="From"/.test(xml) && /content-desc="To"/.test(xml),
    "Map surface present on plan home": hasGoogleMapXml,
  });

  await capturePlanFlow();
  if (!planOnly) {
    await switchTab("Nearby");
    await captureState("nearby_default", {
      "Nearby controls present": (xml) => /Nearby location|Choose fuel or EV charging/.test(xml),
      "Station markers present": hasAnyStationMarker,
      "Bottom navigation visible": hasBottomTabs,
    });
    await interactNearby();
    await switchTab("Settings");
    await captureState("settings_root", {
      "Settings rows visible": hasSettingsRoot,
      "Settings tab selected": (xml) => /content-desc="Settings"[^>]*selected="true"/.test(xml) || /text="Settings"/.test(xml),
    });
    await captureSettingsSections();
  }
}

await generateReport();
console.log(`Checklist complete: ${reportMd}`);
if (evidence.some((item) => item.rows.some((row) => row.status !== "PASS"))) {
  console.error("Native visual checklist contains failed or blocked checks.");
  process.exitCode = 1;
}

async function capturePlanFlow() {
  await tapByLabel("From", { fallbackX: 190, fallbackY: 330 });
  await clearAndType("Sylvania NSW");
  await wait(1800);
  await tapByLabel(/Use Sylvania NSW 2224/i, { fallbackX: 430, fallbackY: 690 });
  await wait(1000);
  await captureState("plan_from_filled", {
    "From field populated": (xml) => /Sylvania NSW 2224|Sylvania/.test(xml),
  });

  await tapByLabel("To", { fallbackX: 190, fallbackY: 430 });
  await clearAndType("Emu Plains NSW");
  await wait(1800);
  await tapByLabel(/Use Emu Plains NSW 2750|Use 14 Iralba Avenue, Emu Plains NSW 2750/i, { fallbackX: 430, fallbackY: 835 });
  await wait(1000);
  await captureState("plan_to_filled", {
    "To field populated": (xml) => /Emu Plains/.test(xml),
    "Address resolved": (xml) => /Emu Plains NSW 2750|Iralba Avenue, Emu Plains NSW 2750/.test(xml),
  });

  await tapByLabel("Plan route", { useText: true, fallbackX: 200, fallbackY: 740 });
  await wait(12000);
  await captureState("plan_route_result", {
    "Route sheet rendered": (xml) => /Best stop for this trip|Recommended|Route map|Route found|No route/i.test(xml),
    "Google map rendered": hasGoogleMapXml,
    "Result marker(s) present": (xml) => hasAnyStationMarker(xml),
    "Route recommendation present": (xml) => /Best stop for this trip|Navigate via|Pump price only|c\/L/i.test(xml),
    "Bottom navigation still visible": hasBottomTabs,
  });

  const routeDump = latestDump();
  const recommendation = findNodeByTextOrContent(routeDump, /Open .* recommendation detail/i);
  if (recommendation) {
    await tapBounds(recommendation);
    await wait(900);
    await captureState("plan_recommendation_detail", {
      "Recommendation detail opens": (xml) => /Recommended|Navigate|Checked detour|PRICE|Open now|c\/L/i.test(xml),
      "Bottom navigation still visible": hasBottomTabs,
    });
    await switchTab("Plan");
    await wait(600);
  } else {
    evidence.push({
      state: "plan_recommendation_detail",
      screenshot: "",
      xml: "",
      rows: [{ label: "Recommendation detail available for tap", status: "BLOCKED" }],
    });
  }

  const mapMarker = findVisiblePriceMarker(routeDump);
  if (mapMarker) {
    await tapBounds(mapMarker);
    await wait(900);
    await captureState("plan_station_detail_from_map_marker", {
      "Station/charger detail state opens": (xml) => /Navigate to|Navigate via|Get directions|Open in Google Maps|PRICE|CHECKED DETOUR|Recommended|No station|No charger|Stop/i.test(xml),
      "Bottom navigation still visible": hasBottomTabs,
    });
  } else {
    evidence.push({
      state: "plan_station_detail_from_map_marker",
      screenshot: "",
      xml: "",
      rows: [{ label: "Station marker available for tap", status: "BLOCKED" }],
    });
  }
}

async function captureEvParityFlow() {
  if (/text="Edit"/.test(readUiDump())) {
    await tapByLabel("Edit", { fallbackX: 1110, fallbackY: 500 });
    await wait(900);
  }
  await tapByLabel("From", { fallbackX: 190, fallbackY: 500 });
  await clearAndType("Sylvania NSW");
  await wait(1800);
  const fromSuggestionFound = await tapByLabel(/Use Sylvania NSW 2224/i, { fallbackX: 430, fallbackY: 820 });
  await wait(1000);

  await tapByLabel("To", { fallbackX: 190, fallbackY: 650 });
  await clearAndType("Newcastle NSW");
  await wait(1800);
  const toSuggestionFound = await tapByLabel(/Use Newcastle NSW 2300|Use Newcastle NSW/i, { fallbackX: 430, fallbackY: 980 });
  await wait(1000);

  await tapByLabel(/Check route range|Plan route/i, { fallbackX: 300, fallbackY: 1050 });
  await wait(14000);

  const xml = readUiDump();
  const stem = `android-pixel-ev-route-result-${timestamp}`;
  const screenshot = join(smokeOutputRoot, `${stem}.png`);
  const xmlPath = join(smokeOutputRoot, `${stem}.xml`);
  const pngResult = run(["-s", serial, "exec-out", "screencap", "-p"], {
    encoding: "buffer",
    maxBuffer: 24 * 1024 * 1024,
  });
  if (pngResult.status !== 0) throw new Error("EV parity screenshot failed");
  writeFileSync(xmlPath, xml);
  writeFileSync(screenshot, pngResult.stdout);
  const rows = [
    ["Sylvania autocomplete suggestion found", fromSuggestionFound],
    ["Newcastle autocomplete suggestion found", toSuggestionFound],
    ["EV profile active", /EV|400 km/i.test(xml)],
    ["Sylvania endpoint present", /Sylvania/i.test(xml)],
    ["Newcastle endpoint present", /Newcastle/i.test(xml)],
    ["Route charger options present", /Route charger options/i.test(xml)],
    ["400 km selected range present", /\d+ km route\. 400 km selected range/i.test(xml)],
  ].map(([label, passed]) => ({ label: String(label), status: passed ? "PASS" : "FAIL" }));
  evidence.push({ stateName: "android_ev_route_parity", screenshot, xmlPath, rows });
}

async function interactNearby() {
  await captureState("nearby_after_tap", {
    "Nearby state stable": (xml) => /Google Map|Nearby/.test(xml),
  });

  await tapByLabel(/Expand station list/i, { fallbackX: 1200, fallbackY: 860 });
  await wait(700);
  await captureState("nearby_station_list_open", {
    "Station list controls visible": (xml) => /Closest|Cheapest|Best value/.test(xml),
    "Map still visible under list": hasGoogleMapXml,
  });

  const listDump = latestDump();
  const cheapestSort = findNodeByText(listDump, "Cheapest");
  if (cheapestSort) {
    await tapBounds(cheapestSort);
    await wait(700);
    await captureState("nearby_sort_cheapest", {
      "Sort action applied": (xml) => /Cheapest/.test(xml),
      "Bottom navigation still visible": hasBottomTabs,
    });
  }

  await swipe(620, 2000, 620, 1200);
  await wait(900);
  await captureState("nearby_map_panned", {
    "Map marker count stays non-zero": hasAnyStationMarker,
  });

  const panDump = latestDump();
  const marker = findVisiblePriceMarker(panDump);
  if (marker) {
    await tapBounds(marker);
    await wait(1200);
    await captureState("nearby_marker_detail", {
      "Station detail opens from map marker": (xml) => /Navigate to|Open in Google Maps|Close selected station|\d+\.\d+ kilometres away|cents per litre pump price|No station/i.test(xml),
      "Brand/logo or station row visible": (xml) => /Station|Price|c\/L|kWh|Open|Navigate/i.test(xml),
    });
  }
}

async function captureSettingsSections() {
  const sections = [
    {
      title: "Vehicle & fuel",
      openLabel: /Active vehicle|Vehicle &amp; fuel|Vehicle & fuel/i,
      expectedHeader: /Vehicle &amp; fuel|Vehicle & fuel|Fuel profile/i,
      expectedContent: /Add fuel car|Add EV|Fuel grade|Current vehicle|My vehicle|TYPE|Petrol/i,
    },
    {
      title: "Savings",
      openLabel: /Discounts &amp; eligibility|Discounts & eligibility|Savings/i,
      expectedHeader: /Savings|Discount wallet/i,
      expectedContent: /Discount wallet|Eligible discounts|Disable|Enable/i,
    },
    {
      title: "Stations",
      openLabel: /Stations &amp; brands|Stations & brands/i,
      expectedHeader: /Stations &amp; brands|Stations & brands|Choose what appears on the map/i,
      expectedContent: /All brands|Preferred only|Search station brands/i,
      action: { label: /Common/i, fallbackX: 940, fallbackY: 1340 },
      actionExpected: /Ampol|BP|Shell|Caltex|7-Eleven/i,
    },
    {
      title: "Places",
      openLabel: /Home, work &amp; saved routes|Home, work & saved routes|Places/i,
      expectedHeader: /Places &amp; routes|Places & routes|Home and Work|Favourite routes/i,
      expectedContent: /Home|Work|Favourite routes/i,
      action: { label: /Set/i, fallbackX: 900, fallbackY: 1090 },
      actionExpected: /No station|No favourite routes yet|Route|Editor/i,
    },
    {
      title: "Alerts",
      openLabel: /Notifications|Alerts/i,
      expectedHeader: /Watch saved routes|Notifications/i,
      expectedContent: /Enable notifications|Route alert|Watch/i,
    },
    {
      title: "Support",
      openLabel: /Privacy &amp; support|Privacy & support|Support/i,
      expectedHeader: /Privacy &amp; support|Privacy & support|Data used for better route decisions/i,
      expectedContent: /Navigation app|Device maps|Apple Maps|Google Maps|Waze/i,
      action: { label: /Apple Maps/i, fallbackX: 560, fallbackY: 1250 },
      actionExpected: /Navigation app|Apple Maps|Google Maps|Waze|Device maps/i,
    },
  ];

  for (const section of sections) {
    await ensureSettingsRoot();
    await tapByLabel(section.openLabel || section.title, sectionLabelFallback(section.title));
    await wait(1200);

    await captureState(`settings_${slug(section.title)}`, {
      "Section opened": (xml) => section.expectedHeader.test(xml),
      "Section content visible": (xml) => section.expectedContent.test(xml),
    });

    if (section.action) {
      await tapByLabel(section.action.label, section.action);
      await wait(600);
      await captureState(`settings_${slug(section.title)}_action`, {
        "Action responds": section.actionExpected ? ((xml) => section.actionExpected.test(xml)) : (() => true),
      });
    }

    const withBack = latestDump();
    if (hasBackToSettings(withBack)) {
      await returnToSettingsRoot();
      await captureState(`settings_back_after_${slug(section.title)}`, {
        "Return to settings root": hasSettingsRoot,
      });
    }
  }
}

function sectionLabelFallback(label) {
  const map = {
    "Vehicle & fuel": { fallbackX: 640, fallbackY: 720 },
    Savings: { fallbackX: 640, fallbackY: 950 },
    Stations: { fallbackX: 640, fallbackY: 1175 },
    Places: { fallbackX: 640, fallbackY: 1405 },
    Alerts: { fallbackX: 640, fallbackY: 1635 },
    Support: { fallbackX: 640, fallbackY: 1860 },
  };
  return map[label] || { fallbackX: 540, fallbackY: 500 };
}

async function ensureSettingsRoot() {
  run(["-s", serial, "shell", "am", "start", "-n", activityName]);
  await wait(600);
  await switchTab("Settings");
  for (let i = 0; i < 3; i += 1) {
    const dump = readUiDump();
    if (hasSettingsRoot(dump)) return;
    if (hasBackToSettings(dump)) {
      const backButton = findNodeByContentDesc(dump, /Back to settings/i);
      if (backButton) {
        await tapBounds(backButton);
      } else {
        run(["-s", serial, "shell", "input", "tap", "150", "470"]);
      }
      await wait(800);
    } else {
      run(["-s", serial, "shell", "input", "keyevent", "4"]);
      await wait(800);
      await switchTab("Settings");
    }
  }
}

async function returnToSettingsRoot() {
  for (let i = 0; i < 3; i += 1) {
    const dump = readUiDump();
    if (hasSettingsRoot(dump)) return;
    const backButton = findNodeByContentDesc(dump, /Back to settings/i);
    if (backButton) {
      await tapBounds(backButton);
    } else {
      run(["-s", serial, "shell", "input", "keyevent", "4"]);
    }
    await wait(900);
  }
}

async function captureState(stateName, checks) {
  const xml = readUiDump();
  const screenshot = join(outputRoot, `${reportBase}-${stateName}.png`);
  const xmlPath = join(outputRoot, `${reportBase}-${stateName}.xml`);
  const pngResult = run(["-s", serial, "exec-out", "screencap", "-p"], {
    encoding: "buffer",
    maxBuffer: 24 * 1024 * 1024,
  });
  if (pngResult.status !== 0) throw new Error(`screencap failed: ${stateName}`);
  writeFileSync(xmlPath, xml);
  writeFileSync(screenshot, pngResult.stdout);

  const rows = Object.entries(checks).map(([label, predicate]) => {
    try {
      const passed = typeof predicate === "function" ? predicate(xml) : Boolean(predicate);
      return { label, status: passed ? "PASS" : "FAIL" };
    } catch {
      return { label, status: "FAIL" };
    }
  });
  if (!rows.length) rows.push({ label: "Rendered", status: "PASS" });
  evidence.push({ stateName, screenshot, xmlPath, rows });
}

function hasBottomTabs(xml) {
  return /content-desc="Plan"/.test(xml) && /content-desc="Nearby"/.test(xml) && /content-desc="Settings"/.test(xml);
}

function hasSettingsRoot(xml) {
  return /Active vehicle|Vehicle &amp; fuel|Vehicle & fuel/i.test(xml)
    && /Discounts &amp; eligibility|Discounts & eligibility|Savings/i.test(xml)
    && /Stations &amp; brands|Stations & brands/i.test(xml)
    && /Home, work &amp; saved routes|Home, work & saved routes/i.test(xml)
    && /Notifications/i.test(xml)
    && /Privacy &amp; support|Privacy & support/i.test(xml);
}

function hasBackToSettings(xml) {
  return /Back to settings|← Settings|‹ Settings/i.test(xml);
}

function hasGoogleMapXml(xml) {
  return /Google Map/.test(xml);
}

function hasAnyStationMarker(xml) {
  return /content-desc=\"Map Marker\"/.test(xml);
}

function findVisiblePriceMarker(xml) {
  const matches = [...xml.matchAll(/<node\b[^>]*content-desc="Map Marker"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*>/gi)];
  const markers = matches
    .map((match) => ({
      left: Number(match[1]),
      top: Number(match[2]),
      right: Number(match[3]),
      bottom: Number(match[4]),
    }))
    .filter((marker) => {
      const width = marker.right - marker.left;
      const height = marker.bottom - marker.top;
      return width >= 120 && height >= 120 && marker.top >= 380 && marker.bottom <= 2050;
    });
  markers.sort((left, right) => {
    const leftScore = Math.abs((left.left + left.right) / 2 - 640) + Math.abs((left.top + left.bottom) / 2 - 1120);
    const rightScore = Math.abs((right.left + right.right) / 2 - 640) + Math.abs((right.top + right.bottom) / 2 - 1120);
    return leftScore - rightScore;
  });
  return markers[0] || findNodeByContentDesc(xml, /Map Marker/i);
}

function latestDump() {
  const xmlFiles = readdirSync(outputRoot)
    .filter((item) => item.endsWith(".xml"))
    .map((file) => join(outputRoot, file))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (!xmlFiles.length) return "";
  return readFileSync(xmlFiles[0], "utf8");
}

function findNodeByText(xml, value) {
  const textPattern = value instanceof RegExp
    ? `[^"]*${value.source}[^"]*`
    : escapeRegex(String(value));
  const rx = new RegExp(`<node\\b[^>]*text="${textPattern}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`, "i");
  const match = xml.match(rx);
  if (!match) return null;
  return { left: Number(match[1]), top: Number(match[2]), right: Number(match[3]), bottom: Number(match[4]) };
}

function findNodeByContentDesc(xml, pattern) {
  const matcher = new RegExp(
    pattern instanceof RegExp ? pattern.source : `^${escapeRegex(String(pattern))}$`,
    "i",
  );
  const matches = [...xml.matchAll(/<node\b[^>]*content-desc="([^"]+)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*>/gi)];
  const target = matches.find((match) => matcher.test(match[1] || ""));
  if (!target) return null;
  return { left: Number(target[2]), top: Number(target[3]), right: Number(target[4]), bottom: Number(target[5]) };
}

async function tapBounds({ left, top, right, bottom }) {
  const x = Math.round((left + right) / 2);
  const y = Math.round((top + bottom) / 2);
  run(["-s", serial, "shell", "input", "tap", String(x), String(y)]);
}

async function tapByLabel(label, options = {}) {
  const xml = readUiDump();
  const fallbackX = options.fallbackX || 540;
  const fallbackY = options.fallbackY || 740;
  const useText = options.useText === true;

  let node = null;
  if (options.label) {
    node = useText ? findNodeByText(xml, options.label) : findNodeByTextOrContent(xml, options.label);
  } else if (options.useText === true || label instanceof RegExp) {
    node = useText ? findNodeByText(xml, label) : findNodeByTextOrContent(xml, label);
  } else {
    node = findNodeByTextOrContent(xml, label);
  }

  if (node) {
    await tapBounds(node);
    return true;
  }

  run(["-s", serial, "shell", "input", "tap", String(fallbackX), String(fallbackY)]);
  return false;
}

function findNodeByTextOrContent(xml, label) {
  if (label instanceof RegExp) {
    return findNodeByContentDesc(xml, label) || findNodeByText(xml, label);
  }
  const byText = findNodeByText(xml, label);
  return byText || findNodeByContentDesc(xml, label);
}

function findNodeByContentDescStrict(xml, label) {
  const matcher = new RegExp(label instanceof RegExp ? label.source : `^${escapeRegex(String(label))}$`, "i");
  const matches = [...xml.matchAll(/<node\b[^>]*content-desc="([^"]+)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*>/gi)];
  for (const match of matches) {
    if (matcher.test(match[1] || "")) {
      return { left: Number(match[2]), top: Number(match[3]), right: Number(match[4]), bottom: Number(match[5]) };
    }
  }
  const fallback = findNodeByText(xml, label);
  return fallback;
}

async function clearAndType(text) {
  for (let i = 0; i < 80; i += 1) {
    run(["-s", serial, "shell", "input", "keyevent", "67"]);
  }
  await wait(150);
  run(["-s", serial, "shell", "input", "text", text.replace(/ /g, "%s")]);
}

async function switchTab(label) {
  await tapByLabel(label, { label, useText: true, fallbackX: tabFallbackX(label), fallbackY: tabFallbackY(label) });
  await wait(1000);
}

function tabFallbackX(label) {
  return label === "Plan" ? 190 : label === "Nearby" ? 640 : 1090;
}

function tabFallbackY() {
  return 2740;
}

function slug(label) {
  return String(label).toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

async function swipe(x1, y1, x2, y2) {
  run(["-s", serial, "shell", "input", "swipe", String(x1), String(y1), String(x2), String(y2), "420"]);
}

async function installAndLaunch() {
  if (doInstall) {
    const installResult = run(["-s", serial, "install", "-r", artifact], { timeoutMs: 180000 });
    if (installResult.status !== 0) {
      throw new Error(`APK install failed: ${installResult.stderr || installResult.stdout}`);
    }
  }

  if (resetAppData) {
    run(["-s", serial, "shell", "pm", "clear", packageName], { timeoutMs: 30_000 });
  }
  run(["-s", serial, "shell", "svc", "power", "stayon", "true"]);
  run(["-s", serial, "shell", "am", "force-stop", packageName]);
  run(["-s", serial, "shell", "am", "start", "-n", activityName]);

  const startAt = Date.now();
  while (Date.now() - startAt < 45_000) {
    if (isFuelPathForeground()) return;
    run(["-s", serial, "shell", "am", "start", "-n", activityName]);
    await wait(1400);
  }
  throw new Error("Fuel Path did not come to foreground.");
}

function isFuelPathForeground() {
  try {
    const dump = readUiDump();
    return dump.includes(`package="${packageName}"`) && hasBottomTabs(dump);
  } catch {
    return false;
  }
}

function readUiDump() {
  let dumpCommand = run(["-s", serial, "shell", "timeout", "8", "uiautomator", "dump", "/sdcard/window_dump.xml"], {
    timeoutMs: 10_000,
  });
  if (dumpCommand.status !== 0) {
    run(["-s", serial, "shell", "input", "keyevent", "4"]);
    dumpCommand = run(["-s", serial, "shell", "timeout", "8", "uiautomator", "dump", "/sdcard/window_dump.xml"], {
      timeoutMs: 10_000,
    });
  }
  const dump = run(["-s", serial, "exec-out", "cat", "/sdcard/window_dump.xml"], {
    encoding: "utf8",
    timeoutMs: 10_000,
  });
  if (dump.status !== 0 || !dump.stdout) {
    throw new Error("uiautomator dump failed");
  }
  return dump.stdout;
}

function resolveAndroidSdk() {
  const base =
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    (process.env.HOME ? join(process.env.HOME, "Library", "Android", "sdk") : "");
  return base && existsSync(base) ? join(base, "platform-tools", "adb") : "/tmp/notfound/adb";
}

function chooseDevice(requestedSerial) {
  const lines = run(["devices", "-l"], { encoding: "utf8" }).stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.includes("device"));

  if (!lines.length) return null;
  if (requestedSerial) {
    const requested = lines.find((line) => line.startsWith(requestedSerial));
    return requested ? requestedSerial : null;
  }
  const physical = lines.find((line) => !line.startsWith("emulator-"));
  const first = lines[0];
  return (physical || first).split(/\s+/)[0];
}

function findLatestArtifact() {
  const candidateDirs = [join(repoRoot, "mobile-app", "native-artifacts"), join(repoRoot, "native-artifacts")];
  const files = candidateDirs
    .flatMap((dir) => {
      if (!existsSync(dir)) return [];
      return readdirSync(dir)
        .filter((name) => /fuel-path-(local-standalone|preview-android|preview-android).*\.apk$/.test(name))
        .map((name) => join(dir, name));
    })
    .filter((path) => existsSync(path))
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);
  return files[0] || "";
}

function run(args, { timeoutMs = 12_000, encoding = "utf8", maxBuffer = 4 * 1024 * 1024 } = {}) {
  const result = spawnSync(adb, args, {
    encoding,
    maxBuffer,
    timeout: timeoutMs,
  });
  return result;
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateReport() {
  const lines = [
    "# Native Visual Checklist",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Device: ${serial}`,
    `Package: ${packageName}`,
    `APK: ${doInstall ? artifact : "skip-install mode (existing app)"} `,
    "",
    "## Checklist results",
    "",
  ];

  for (const item of evidence) {
    const pass = item.rows.filter((row) => row.status === "PASS").length;
    const total = item.rows.length;
    const stateName = item.stateName || item.state || "state";
    const screenshot = item.screenshot ? `\`${basename(item.screenshot)}\`` : "`n/a`";
    const xmlPath = item.xmlPath ? `\`${basename(item.xmlPath)}\`` : "`n/a`";
    lines.push(`### ${stateName}`);
    lines.push(`- Summary: ${pass}/${total} checks passed`);
    lines.push(`- Screenshot: ${screenshot}`);
    lines.push(`- XML: ${xmlPath}`);
    for (const row of item.rows) {
      lines.push(`- [${row.status === "PASS" ? "x" : " "}] ${row.label}`);
    }
    lines.push("");
  }

  writeFileSync(reportMd, `${lines.join("\n")}\n`);
}
