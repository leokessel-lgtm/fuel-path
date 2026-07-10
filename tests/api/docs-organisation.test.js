const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");
const test = require("node:test");

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, "../..");
const CHECKER = path.join(ROOT, "scripts/check-docs.mjs");

test("documentation checker passes without Git metadata", async (context) => {
  const fixture = createFixture(context);
  const { stdout } = await runChecker(fixture);
  assert.match(stdout, /Documentation check passed/);
});

test("documentation checker rejects broken relative links", async (context) => {
  const fixture = createFixture(context);
  writeFixtureFile(fixture, "docs/README.md", "# Docs\n\n[Missing](missing.md)\n");
  await expectCheckerFailure(fixture, "broken link: docs/README.md -> missing.md");
});

test("documentation checker rejects stale moved paths in TypeScript", async (context) => {
  const fixture = createFixture(context);
  writeFixtureFile(fixture, "src/reference.ts", 'export const oldPath = "OLD-PATH.md";\n');
  await expectCheckerFailure(fixture, "stale moved-path reference in src/reference.ts: OLD-PATH.md");
});

test("documentation checker rejects unapproved root Markdown", async (context) => {
  const fixture = createFixture(context);
  writeFixtureFile(fixture, "EXTRA.md", "# Unapproved root file\n");
  await expectCheckerFailure(fixture, "unapproved root Markdown document: EXTRA.md");
});

test("documentation checker rejects provider implementation notes under evidence", async (context) => {
  const fixture = createFixture(context);
  writeFixtureFile(fixture, "docs/03-provider-data/evidence/QLD-API-NOTES.md", "# Misplaced implementation note\n");
  await expectCheckerFailure(
    fixture,
    "provider implementation or decision file is under evidence: docs/03-provider-data/evidence/QLD-API-NOTES.md",
  );
});

function createFixture(context) {
  const fixture = mkdtempSync(path.join(tmpdir(), "fuel-path-docs-check-"));
  context.after(() => rmSync(fixture, { force: true, recursive: true }));

  const config = {
    requiredDocuments: ["README.md", "docs/README.md", "docs/03-provider-data/README.md"],
    allowedRootMarkdown: ["README.md"],
    templateLabelTerms: ["template", "sample"],
    providerEvidenceDisallowedNamePatterns: ["API-NOTES", "PROVIDER-DECISION"],
    requiredProviderStates: ["request sent", "terms confirmed", "quality-ready", "beta-release-ready"],
    stalePathFragments: ["OLD-PATH.md"],
    textFileExtensions: [".json", ".md", ".ts"],
    textFileNames: [],
    excludedDirectoryNames: ["node_modules", "tmp"],
    excludedPaths: [],
  };

  writeFixtureFile(fixture, "docs-check.config.json", `${JSON.stringify(config, null, 2)}\n`);
  writeFixtureFile(fixture, "README.md", "# Fixture\n");
  writeFixtureFile(fixture, "docs/README.md", "# Docs\n");
  writeFixtureFile(
    fixture,
    "docs/03-provider-data/README.md",
    "# Providers\n\nrequest sent\nterms confirmed\nquality-ready\nbeta-release-ready\n",
  );
  return fixture;
}

function writeFixtureFile(fixture, relativePath, contents) {
  const target = path.join(fixture, relativePath);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, contents, "utf8");
}

function runChecker(fixture) {
  return execFileAsync(process.execPath, [CHECKER, "--root", fixture, "--config", path.join(fixture, "docs-check.config.json")], {
    cwd: fixture,
    timeout: 10_000,
  });
}

async function expectCheckerFailure(fixture, expectedMessage) {
  await assert.rejects(runChecker(fixture), (error) => {
    assert.match(error.stderr, new RegExp(escapeRegExp(expectedMessage)));
    return true;
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
