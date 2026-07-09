import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const mobileRoot = resolve(scriptDir, "..");
const repoRoot = resolve(mobileRoot, "..");
const outputRoot = join(repoRoot, "tmp", "native-smoke");
const artifact = resolveInputPath(argumentValue("--artifact") || process.env.FUEL_PATH_NATIVE_ARTIFACT || latestArtifact());
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const appJson = JSON.parse(readFileSync(join(mobileRoot, "app.json"), "utf8")).expo;
const packageName = appJson.android?.package || "com.fuelpath.app";
const certificate = readApkCertificate();
const latestSmoke = readLatestSmoke();
const report = {
  status: certificate.sha1 ? "ready_for_cloud_fix" : "blocked",
  packageName,
  artifact,
  artifactName: basename(artifact || ""),
  certificate,
  latestSmoke,
  requiredRestriction: {
    applicationType: "Android apps",
    packageName,
    sha1Fingerprint: certificate.sha1 || "unknown",
  },
  requiredApiRestriction: "Maps SDK for Android",
  rerunPlan: {
    sameKeyValue: "If only the Google Cloud restriction changes, wait for propagation and rerun the existing installed APK smoke.",
    changedKeyValue: "If the API key value or EAS environment variable changes, rebuild the Android preview APK before rerunning the smoke.",
  },
  cloudAccess: detectCloudAccess(),
};

mkdirSync(outputRoot, { recursive: true });
const jsonPath = join(outputRoot, `android-maps-key-fix-${timestamp}.json`);
const mdPath = join(outputRoot, `android-maps-key-fix-${timestamp}.md`);
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(mdPath, markdown(report));

console.log(`Android Maps key fix packet ${report.status}: ${mdPath}`);
if (report.status !== "ready_for_cloud_fix") process.exit(1);

function markdown(data) {
  const artifactCommandPath = data.artifact
    ? relativeArtifactCommandPath(data.artifact)
    : "native-artifacts/YOUR_PREVIEW.apk";
  return [
    "# Android Maps Key Fix Packet",
    "",
    `Status: ${data.status}`,
    `Artifact: ${data.artifactName}`,
    `Package: ${data.packageName}`,
    `APK signing SHA-1: ${data.certificate.sha1 || "unknown"}`,
    `APK signing SHA-256: ${data.certificate.sha256 || "unknown"}`,
    `Latest smoke: ${data.latestSmoke?.path || "none"}`,
    `Latest smoke status: ${data.latestSmoke?.status || "unknown"}`,
    `Latest smoke blank map likely: ${data.latestSmoke?.mapTileSummary?.blankMapLikely ?? "unknown"}`,
    "",
    "## Required Google Cloud Change",
    "",
    "Update the Android Maps API key used by `FUEL_PATH_ANDROID_GOOGLE_MAPS_API_KEY`:",
    "",
    `- Application restriction: Android apps`,
    `- Package name: ${data.packageName}`,
    `- SHA-1 certificate fingerprint: ${data.certificate.sha1 || "unknown"}`,
    "- API restriction: Maps SDK for Android",
    "",
    "Google's Android Maps key setup requires an Android app restriction using the package name and SHA-1 certificate fingerprint, plus restricting the key to the Maps SDK for Android.",
    "",
    "Official setup page: https://developers.google.com/maps/documentation/android-sdk/get-api-key",
    "",
    "## Current Local Cloud Access",
    "",
    `- gcloud CLI: ${data.cloudAccess.gcloudPath || "not found"}`,
    `- local Maps key env: ${data.cloudAccess.localMapsKeyEnv ? "present" : "not exported"}`,
    "",
    "## After The Cloud Change",
    "",
    "If the same embedded key is kept and only its Google Cloud restrictions are updated, a rebuild should not be needed. Wait a few minutes for propagation, then rerun the installed APK smoke against the existing APK.",
    "",
    "If the key value itself changes, update the EAS preview environment, rebuild the Android preview APK, then download the new APK into `mobile-app/native-artifacts/`.",
    "",
    "Run:",
    "",
    "```sh",
    "npm run native:preflight",
    `FUEL_PATH_NATIVE_ARTIFACT=${artifactCommandPath} npm run native:android-preview-smoke`,
    `FUEL_PATH_NATIVE_ARTIFACT=${artifactCommandPath} npm run budget:native`,
    "```",
    "",
    "Pass condition: Google map tiles render and the smoke report has no `GoogleCertificatesRslt`, API key, `ApiNotActivated` or `REQUEST_DENIED` warning lines.",
    "",
  ].join("\n");
}

function readApkCertificate() {
  if (!artifact || !existsSync(artifact)) {
    return { error: "No preview APK found. Pass --artifact or FUEL_PATH_NATIVE_ARTIFACT." };
  }
  const apksigner = latestTool("build-tools", "apksigner");
  if (!apksigner) return { error: "apksigner not found" };
  const javaHome = process.env.JAVA_HOME || androidStudioJavaHome() || join(repoRoot, "var", "tooling", "java", "jdk-21.0.11+10", "Contents", "Home");
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

function readLatestSmoke() {
  const reports = listFiles(outputRoot)
    .filter((file) => basename(file).startsWith("android-preview-smoke-") && file.endsWith(".json"))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (!reports.length) return undefined;
  try {
    const report = JSON.parse(readFileSync(reports[0], "utf8"));
    return {
      path: reports[0],
      status: report.status,
      mapWarningLines: (report.mapWarningLines || []).slice(0, 5),
      mapTileSummary: report.mapTileSummary,
      screenshots: report.screenshots || [],
    };
  } catch (error) {
    return { path: reports[0], error: error.message };
  }
}

function detectCloudAccess() {
  return {
    gcloudPath: which("gcloud"),
    localMapsKeyEnv: Boolean(process.env.FUEL_PATH_ANDROID_GOOGLE_MAPS_API_KEY),
  };
}

function latestArtifact() {
  const nativeArtifacts = join(mobileRoot, "native-artifacts");
  const previewArtifact = listFiles(nativeArtifacts)
    .filter((file) => file.endsWith(".apk"))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
  if (previewArtifact) return previewArtifact;
  const debugArtifact = join(mobileRoot, "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk");
  return existsSync(debugArtifact) ? debugArtifact : "";
}

function latestTool(group, tool) {
  const sdkRoot = findAndroidSdkRoot();
  if (!sdkRoot) return "";
  return spawnSync("zsh", ["-lc", `ls "${sdkRoot}/${group}"/*/${tool} 2>/dev/null | sort -V | tail -1`], {
    encoding: "utf8",
  }).stdout.trim();
}

function findAndroidSdkRoot() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    join(process.env.HOME || "", "Library", "Android", "sdk"),
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) || "";
}

function which(binary) {
  const result = spawnSync("zsh", ["-lc", `command -v ${binary} || true`], { encoding: "utf8" });
  return result.stdout.trim();
}

function androidStudioJavaHome() {
  const home = "/Applications/Android Studio.app/Contents/jbr/Contents/Home";
  return existsSync(home) ? home : "";
}

function relativeArtifactCommandPath(file) {
  if (!file) return "native-artifacts/YOUR_PREVIEW.apk";
  const relative = file.startsWith(`${mobileRoot}/`) ? file.slice(mobileRoot.length + 1) : file;
  return relative || "native-artifacts/YOUR_PREVIEW.apk";
}

function listFiles(directory) {
  if (!directory || !existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(file);
    return entry.isFile() ? [file] : [];
  });
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function resolveInputPath(value) {
  if (!value) return "";
  return isAbsolute(value) ? value : resolve(process.cwd(), value);
}

function matchText(text, pattern) {
  return text.match(pattern)?.[1]?.toLowerCase() || "";
}
