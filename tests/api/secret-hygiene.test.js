const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, "../..");

test("secret hygiene allows documented placeholders and local test URLs", async () => {
  const dir = fixtureDir();
  const file = path.join(dir, "safe.md");
  fs.writeFileSync(file, [
    "FUEL_PATH_GNAF_DATABASE_URL=postgres://...",
    "postgres://fuelpath:example@127.0.0.1:9/fuel_path_gnaf",
    "postgres://quota.example.test/fuel_path",
  ].join("\n"));

  const result = await runSecretCheck(dir, "safe.md");

  assert.match(result.stdout, /OK tracked and untracked non-ignored files contain no live-looking/);
});

test("secret hygiene rejects live-looking database credentials", async () => {
  const dir = fixtureDir();
  const file = path.join(dir, "leak.md");
  const leakedUrl = [
    "DATABASE_URL=postgres",
    "ql://app:",
    "npg",
    "_fakeSecretValue12345",
    "@db.supabase.co/app\n",
  ].join("");
  fs.writeFileSync(file, leakedUrl);

  await assert.rejects(
    runSecretCheck(dir, "leak.md"),
    (error) => {
      assert.match(error.stderr, /live-looking Neon password/);
      assert.match(error.stderr, /live-looking Postgres URL/);
      assert.match(error.stderr, /Secret hygiene check failed/);
      assert.doesNotMatch(error.stderr, new RegExp(["npg", "_fakeSecretValue12345"].join("")));
      return true;
    },
  );
});

test("secret hygiene scans untracked non-ignored files by default", async () => {
  const dir = fixtureDir();
  await execFileAsync("git", ["init"], { cwd: dir, timeout: 20_000 });
  fs.writeFileSync(path.join(dir, "README.md"), "safe\n");
  await execFileAsync("git", ["add", "README.md"], { cwd: dir, timeout: 20_000 });
  const leakedUrl = [
    "DATABASE_URL=postgres",
    "ql://app:",
    "npg",
    "_untrackedSecretValue12345",
    "@db.supabase.co/app\n",
  ].join("");
  fs.writeFileSync(path.join(dir, "new-secret.md"), leakedUrl);

  await assert.rejects(
    runSecretCheck(dir),
    (error) => {
      assert.match(error.stderr, /new-secret\.md:1/);
      assert.match(error.stderr, /live-looking Postgres URL/);
      assert.doesNotMatch(error.stderr, new RegExp(["npg", "_untrackedSecretValue12345"].join("")));
      return true;
    },
  );
});

async function runSecretCheck(root, file = "") {
  const args = [
    "scripts/check-secret-hygiene.mjs",
    "--root",
    root,
  ];
  if (file) args.push("--file", file);
  return execFileAsync(process.execPath, args, {
    cwd: ROOT,
    timeout: 20_000,
  });
}

function fixtureDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-secret-hygiene-"));
}
