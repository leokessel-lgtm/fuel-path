const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const path = require("node:path");
const { promisify } = require("node:util");
const test = require("node:test");

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, "../..");

test("documentation organisation and internal links remain valid", async () => {
  const { stdout } = await execFileAsync(process.execPath, ["scripts/check-docs.mjs"], {
    cwd: ROOT,
    timeout: 10_000,
  });

  assert.match(stdout, /Documentation check passed/);
});
