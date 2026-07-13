const assert = require("node:assert/strict");
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, "../..");

test("provider terms readiness blocks public launch when configured terms are missing", async () => {
  await assert.rejects(
    execFileAsync(
      process.execPath,
      ["scripts/check-provider-terms-readiness.mjs", "--production", "--enforce-public-launch"],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          VIC_SERVO_SAVER_API_KEY: "",
          NSW_FUEL_API_KEY: "test-nsw-key",
          NSW_FUEL_API_SECRET: "test-nsw-secret",
          QLD_FUEL_API_TOKEN: "test-qld-token",
          FUEL_PATH_NSW_ACT_USAGE_TERMS_CONFIRMED: "",
          FUEL_PATH_QLD_USAGE_TERMS_CONFIRMED: "",
          FUEL_PATH_TAS_USAGE_TERMS_CONFIRMED: "",
          FUEL_PATH_FUELCHECK_USAGE_TERMS_CONFIRMED: "",
        },
        timeout: 10_000,
      },
    ),
    (error) => {
      const payload = JSON.parse(error.stdout);
      assert.equal(payload.status, "blocked");
      assert.equal(payload.publicLivePriceClaimsAllowed, false);
      assert.equal(payload.blockers.includes("nsw_terms_not_confirmed"), true);
      assert.equal(payload.blockers.includes("act_terms_not_confirmed"), true);
      assert.equal(payload.blockers.includes("qld_terms_not_confirmed"), true);
      const qldChecklist = payload.confirmationChecklist.find((item) => item.region === "QLD");
      assert.equal(qldChecklist.flag, "FUEL_PATH_QLD_USAGE_TERMS_CONFIRMED=1");
      assert.equal(
        qldChecklist.requiredEvidence.includes("price cache max-age recorded at 30 minutes or less"),
        true,
      );
      const nswChecklist = payload.confirmationChecklist.find((item) => item.region === "NSW");
      assert.equal(
        nswChecklist.requiredEvidence.includes("allowed caching duration recorded in minutes"),
        true,
      );
      return true;
    },
  );
});

test("provider terms readiness blocks public launch when flags are set without evidence", async () => {
  await assert.rejects(
    execFileAsync(
      process.execPath,
      ["scripts/check-provider-terms-readiness.mjs", "--production", "--enforce-public-launch"],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          VIC_SERVO_SAVER_API_KEY: "",
          NSW_FUEL_API_KEY: "test-nsw-key",
          NSW_FUEL_API_SECRET: "test-nsw-secret",
          QLD_FUEL_API_TOKEN: "test-qld-token",
          FUEL_PATH_NSW_ACT_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_QLD_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_TAS_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_FUELCHECK_USAGE_TERMS_CONFIRMED: "",
        },
        timeout: 10_000,
      },
    ),
    (error) => {
      const payload = JSON.parse(error.stdout);
      assert.equal(payload.status, "blocked");
      assert.equal(payload.publicLivePriceClaimsAllowed, false);
      assert.equal(payload.blockers.includes("nsw_terms_evidence_missing"), true);
      assert.equal(payload.blockers.includes("act_terms_evidence_missing"), true);
      assert.equal(payload.blockers.includes("qld_terms_evidence_missing"), true);
      assert.equal(payload.blockers.includes("tas_terms_evidence_missing"), true);
      assert.equal(payload.evidence.provided, false);
      assert.deepEqual(payload.termsBlocked, []);
      return true;
    },
  );
});

test("provider terms readiness blocks VIC public claims when Servo Saver evidence is missing", async () => {
  await assert.rejects(
    execFileAsync(
      process.execPath,
      ["scripts/check-provider-terms-readiness.mjs", "--production", "--enforce-public-launch"],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          VIC_SERVO_SAVER_API_KEY: "test-vic-key",
        },
        timeout: 10_000,
      },
    ),
    (error) => {
      const payload = JSON.parse(error.stdout);
      assert.equal(payload.status, "blocked");
      assert.equal(payload.publicLivePriceClaimsAllowed, false);
      assert.equal(payload.blockers.includes("vic_terms_evidence_missing"), true);
      assert.equal(payload.evidenceBlocked.some((entry) => entry.region === "VIC"), true);
      return true;
    },
  );
});

test("provider terms readiness rejects vague evidence fields even when booleans are true", async () => {
  const evidencePath = writeEvidenceFile({
    NSW: {
      apiAccessApproved: true,
      authorityTermsAccepted: true,
      cachingDurationConfirmed: true,
      cachingDurationMinutes: 0,
      attributionDisclaimerReady: true,
      attributionDisclaimerWording: "todo",
      commercialConsumerAppUseConfirmed: true,
      termsAcceptedAt: "",
      evidenceReference: "approval-email-2026-06-20",
    },
    QLD: {
      signUpAccepted: true,
      licenceTermsAccepted: true,
      attributionDisclaimerReady: true,
      attributionDisclaimerWording: "confirm wording",
      cachePolicyCoversCurrencyObligations: true,
      priceCacheMaxAgeMinutes: 45,
      siteDataCacheMaxAgeHours: 36,
      serverSideTokenOnly: true,
      commercialConsumerAppUseConfirmed: true,
      termsAcceptedAt: "2026-06-20",
      evidenceReference: "qld-terms-acceptance-2026-06-20",
    },
  });

  await assert.rejects(
    execFileAsync(
      process.execPath,
      [
        "scripts/check-provider-terms-readiness.mjs",
        "--production",
        "--enforce-public-launch",
        "--evidence-json",
        evidencePath,
      ],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          VIC_SERVO_SAVER_API_KEY: "",
          NSW_FUEL_API_KEY: "test-nsw-key",
          NSW_FUEL_API_SECRET: "test-nsw-secret",
          QLD_FUEL_API_TOKEN: "test-qld-token",
          FUEL_PATH_NSW_ACT_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_QLD_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_TAS_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_FUELCHECK_USAGE_TERMS_CONFIRMED: "",
        },
        timeout: 10_000,
      },
    ),
    (error) => {
      const payload = JSON.parse(error.stdout);
      assert.equal(payload.status, "blocked");
      assert.equal(payload.publicLivePriceClaimsAllowed, false);
      assert.equal(payload.blockers.includes("nsw_terms_evidence_missing"), true);
      assert.equal(payload.blockers.includes("qld_terms_evidence_missing"), true);
      return true;
    },
  );
});

test("provider terms readiness does not treat a release-owner confirmation as provider terms evidence", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-provider-owner-attestation-"));
  const evidence = providerTermsEvidence();
  const evidenceDir = path.join(tmp, "evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });
  for (const [region, entry] of Object.entries(evidence.regions)) {
    const sourceName = `${region.toLowerCase()}-terms-source.md`;
    entry.evidenceSource = `evidence/${sourceName}`;
    fs.writeFileSync(
      path.join(evidenceDir, sourceName),
      [
        "Source type: release-owner confirmation from Leo.",
        `${providerFamilyText(region)} terms source for ${entry.evidenceReference}.`,
        `Terms accepted at ${entry.termsAcceptedAt}.`,
      ].join("\n"),
    );
  }
  const evidencePath = path.join(tmp, "provider-terms-evidence.json");
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

  await assert.rejects(
    execFileAsync(
      process.execPath,
      [
        "scripts/check-provider-terms-readiness.mjs",
        "--production",
        "--enforce-public-launch",
        "--evidence-json",
        evidencePath,
      ],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          VIC_SERVO_SAVER_API_KEY: "",
          NSW_FUEL_API_KEY: "test-nsw-key",
          NSW_FUEL_API_SECRET: "test-nsw-secret",
          QLD_FUEL_API_TOKEN: "test-qld-token",
          FUEL_PATH_NSW_ACT_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_QLD_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_TAS_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_FUELCHECK_USAGE_TERMS_CONFIRMED: "",
        },
        timeout: 10_000,
      },
    ),
    (error) => {
      const payload = JSON.parse(error.stdout);
      assert.equal(payload.publicLivePriceClaimsAllowed, false);
      assert.equal(payload.blockers.includes("nsw_terms_evidence_missing"), true);
      return true;
    },
  );
});

test("provider terms readiness rejects generic attribution wording", async () => {
  const evidencePath = writeEvidenceFile({
    NSW: {
      ...providerTermsEvidence().regions.NSW,
      attributionDisclaimerWording: "Required provider attribution and disclaimer wording approved for display.",
    },
    QLD: {
      ...providerTermsEvidence().regions.QLD,
      attributionDisclaimerWording: "Required provider attribution and disclaimer wording approved for display.",
    },
  });

  await assert.rejects(
    execFileAsync(
      process.execPath,
      [
        "scripts/check-provider-terms-readiness.mjs",
        "--production",
        "--enforce-public-launch",
        "--evidence-json",
        evidencePath,
      ],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          VIC_SERVO_SAVER_API_KEY: "",
          NSW_FUEL_API_KEY: "test-nsw-key",
          NSW_FUEL_API_SECRET: "test-nsw-secret",
          QLD_FUEL_API_TOKEN: "test-qld-token",
          FUEL_PATH_NSW_ACT_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_QLD_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_TAS_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_FUELCHECK_USAGE_TERMS_CONFIRMED: "",
        },
        timeout: 10_000,
      },
    ),
    (error) => {
      const payload = JSON.parse(error.stdout);
      assert.equal(payload.status, "blocked");
      assert.equal(payload.publicLivePriceClaimsAllowed, false);
      assert.equal(payload.blockers.includes("nsw_terms_evidence_missing"), true);
      assert.equal(payload.blockers.includes("qld_terms_evidence_missing"), true);
      return true;
    },
  );
});

test("provider terms readiness rejects future terms acceptance dates", async () => {
  const evidencePath = writeEvidenceFile({
    TAS: {
      ...providerTermsEvidence().regions.TAS,
      termsAcceptedAt: "2099-01-01",
    },
  });

  await assert.rejects(
    execFileAsync(
      process.execPath,
      [
        "scripts/check-provider-terms-readiness.mjs",
        "--production",
        "--enforce-public-launch",
        "--evidence-json",
        evidencePath,
      ],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          VIC_SERVO_SAVER_API_KEY: "",
          NSW_FUEL_API_KEY: "test-nsw-key",
          NSW_FUEL_API_SECRET: "test-nsw-secret",
          QLD_FUEL_API_TOKEN: "test-qld-token",
          FUEL_PATH_NSW_ACT_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_QLD_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_TAS_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_FUELCHECK_USAGE_TERMS_CONFIRMED: "",
        },
        timeout: 10_000,
      },
    ),
    (error) => {
      const payload = JSON.parse(error.stdout);
      assert.equal(payload.status, "blocked");
      assert.equal(payload.publicLivePriceClaimsAllowed, false);
      assert.equal(payload.blockers.includes("tas_terms_evidence_missing"), true);
      assert.equal(payload.evidenceBlocked.some((entry) => entry.region === "TAS"), true);
      return true;
    },
  );
});

test("provider terms readiness rejects vague evidence references", async () => {
  const evidencePath = writeEvidenceFile({
    NSW: {
      ...providerTermsEvidence().regions.NSW,
      evidenceReference: "ticket-123",
    },
    QLD: {
      ...providerTermsEvidence().regions.QLD,
      evidenceReference: "done 2026-06-20",
    },
  });

  await assert.rejects(
    execFileAsync(
      process.execPath,
      [
        "scripts/check-provider-terms-readiness.mjs",
        "--production",
        "--enforce-public-launch",
        "--evidence-json",
        evidencePath,
      ],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          VIC_SERVO_SAVER_API_KEY: "",
          NSW_FUEL_API_KEY: "test-nsw-key",
          NSW_FUEL_API_SECRET: "test-nsw-secret",
          QLD_FUEL_API_TOKEN: "test-qld-token",
          FUEL_PATH_NSW_ACT_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_QLD_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_TAS_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_FUELCHECK_USAGE_TERMS_CONFIRMED: "",
        },
        timeout: 10_000,
      },
    ),
    (error) => {
      const payload = JSON.parse(error.stdout);
      assert.equal(payload.status, "blocked");
      assert.equal(payload.publicLivePriceClaimsAllowed, false);
      assert.equal(payload.blockers.includes("nsw_terms_evidence_missing"), true);
      assert.equal(payload.blockers.includes("qld_terms_evidence_missing"), true);
      return true;
    },
  );
});

test("provider terms readiness rejects evidence references dated before terms acceptance", async () => {
  const evidencePath = writeEvidenceFile({
    NSW: {
      ...providerTermsEvidence().regions.NSW,
      termsAcceptedAt: "2026-06-20",
      evidenceReference: "approval-email-2026-06-19",
    },
    TAS: {
      ...providerTermsEvidence().regions.TAS,
      termsAcceptedAt: "2026-06-20",
      evidenceReference: "tas-approval-email-2026-06-19",
    },
  });

  await assert.rejects(
    execFileAsync(
      process.execPath,
      [
        "scripts/check-provider-terms-readiness.mjs",
        "--production",
        "--enforce-public-launch",
        "--evidence-json",
        evidencePath,
      ],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          VIC_SERVO_SAVER_API_KEY: "",
          NSW_FUEL_API_KEY: "test-nsw-key",
          NSW_FUEL_API_SECRET: "test-nsw-secret",
          QLD_FUEL_API_TOKEN: "test-qld-token",
          FUEL_PATH_NSW_ACT_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_QLD_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_TAS_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_FUELCHECK_USAGE_TERMS_CONFIRMED: "",
        },
        timeout: 10_000,
      },
    ),
    (error) => {
      const payload = JSON.parse(error.stdout);
      assert.equal(payload.status, "blocked");
      assert.equal(payload.publicLivePriceClaimsAllowed, false);
      assert.equal(payload.blockers.includes("nsw_terms_evidence_missing"), true);
      assert.equal(payload.blockers.includes("tas_terms_evidence_missing"), true);
      return true;
    },
  );
});

test("provider terms readiness rejects future-dated evidence references", async () => {
  const evidencePath = writeEvidenceFile({
    QLD: {
      ...providerTermsEvidence().regions.QLD,
      evidenceReference: "qld-terms-acceptance-record-2099-01-01",
    },
  });

  await assert.rejects(
    execFileAsync(
      process.execPath,
      [
        "scripts/check-provider-terms-readiness.mjs",
        "--production",
        "--enforce-public-launch",
        "--evidence-json",
        evidencePath,
      ],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          VIC_SERVO_SAVER_API_KEY: "",
          NSW_FUEL_API_KEY: "test-nsw-key",
          NSW_FUEL_API_SECRET: "test-nsw-secret",
          QLD_FUEL_API_TOKEN: "test-qld-token",
          FUEL_PATH_NSW_ACT_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_QLD_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_TAS_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_FUELCHECK_USAGE_TERMS_CONFIRMED: "",
        },
        timeout: 10_000,
      },
    ),
    (error) => {
      const payload = JSON.parse(error.stdout);
      assert.equal(payload.status, "blocked");
      assert.equal(payload.publicLivePriceClaimsAllowed, false);
      assert.equal(payload.blockers.includes("qld_terms_evidence_missing"), true);
      return true;
    },
  );
});

test("provider terms readiness rejects evidence references from the wrong provider family", async () => {
  const evidencePath = writeEvidenceFile({
    NSW: {
      ...providerTermsEvidence().regions.NSW,
      evidenceReference: "qld-fuel-prices-terms-record-2026-06-20",
    },
    QLD: {
      ...providerTermsEvidence().regions.QLD,
      evidenceReference: "fuelcheck-api-nsw-approval-email-2026-06-20",
    },
    TAS: {
      ...providerTermsEvidence().regions.TAS,
      evidenceReference: "generic-provider-terms-ticket-2026-06-20",
    },
  });

  await assert.rejects(
    execFileAsync(
      process.execPath,
      [
        "scripts/check-provider-terms-readiness.mjs",
        "--production",
        "--enforce-public-launch",
        "--evidence-json",
        evidencePath,
      ],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          VIC_SERVO_SAVER_API_KEY: "",
          NSW_FUEL_API_KEY: "test-nsw-key",
          NSW_FUEL_API_SECRET: "test-nsw-secret",
          QLD_FUEL_API_TOKEN: "test-qld-token",
          FUEL_PATH_NSW_ACT_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_QLD_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_TAS_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_FUELCHECK_USAGE_TERMS_CONFIRMED: "",
        },
        timeout: 10_000,
      },
    ),
    (error) => {
      const payload = JSON.parse(error.stdout);
      assert.equal(payload.status, "blocked");
      assert.equal(payload.publicLivePriceClaimsAllowed, false);
      assert.equal(payload.blockers.includes("nsw_terms_evidence_missing"), true);
      assert.equal(payload.blockers.includes("qld_terms_evidence_missing"), true);
      assert.equal(payload.blockers.includes("tas_terms_evidence_missing"), true);
      return true;
    },
  );
});

test("provider terms readiness rejects state-only provider evidence references", async () => {
  const evidencePath = writeEvidenceFile({
    NSW: {
      ...providerTermsEvidence().regions.NSW,
      evidenceReference: "nsw-provider-terms-ticket-2026-06-20",
    },
    ACT: {
      ...providerTermsEvidence().regions.ACT,
      evidenceReference: "act-live-price-approval-record-2026-06-20",
    },
    QLD: {
      ...providerTermsEvidence().regions.QLD,
      evidenceReference: "qld-provider-terms-record-2026-06-20",
    },
    TAS: {
      ...providerTermsEvidence().regions.TAS,
      evidenceReference: "tas-terms-approval-email-2026-06-20",
    },
  });

  await assert.rejects(
    execFileAsync(
      process.execPath,
      [
        "scripts/check-provider-terms-readiness.mjs",
        "--production",
        "--enforce-public-launch",
        "--evidence-json",
        evidencePath,
      ],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          VIC_SERVO_SAVER_API_KEY: "",
          NSW_FUEL_API_KEY: "test-nsw-key",
          NSW_FUEL_API_SECRET: "test-nsw-secret",
          QLD_FUEL_API_TOKEN: "test-qld-token",
          FUEL_PATH_NSW_ACT_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_QLD_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_TAS_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_FUELCHECK_USAGE_TERMS_CONFIRMED: "",
        },
        timeout: 10_000,
      },
    ),
    (error) => {
      const payload = JSON.parse(error.stdout);
      assert.equal(payload.status, "blocked");
      assert.equal(payload.publicLivePriceClaimsAllowed, false);
      assert.equal(payload.blockers.includes("nsw_terms_evidence_missing"), true);
      assert.equal(payload.blockers.includes("act_terms_evidence_missing"), true);
      assert.equal(payload.blockers.includes("qld_terms_evidence_missing"), true);
      assert.equal(payload.blockers.includes("tas_terms_evidence_missing"), true);
      return true;
    },
  );
});

test("provider terms readiness rejects stale evidence references", async () => {
  const evidencePath = writeEvidenceFile({
    NSW: {
      ...providerTermsEvidence().regions.NSW,
      termsAcceptedAt: "2026-01-01",
      evidenceReference: "fuelcheck-api-nsw-approval-email-2026-01-01",
    },
    QLD: {
      ...providerTermsEvidence().regions.QLD,
      termsAcceptedAt: "2026-01-01",
      evidenceReference: "qld-fuel-prices-terms-acceptance-record-2026-01-01",
    },
  });

  await assert.rejects(
    execFileAsync(
      process.execPath,
      [
        "scripts/check-provider-terms-readiness.mjs",
        "--production",
        "--enforce-public-launch",
        "--evidence-json",
        evidencePath,
      ],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          VIC_SERVO_SAVER_API_KEY: "",
          NSW_FUEL_API_KEY: "test-nsw-key",
          NSW_FUEL_API_SECRET: "test-nsw-secret",
          QLD_FUEL_API_TOKEN: "test-qld-token",
          FUEL_PATH_NSW_ACT_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_QLD_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_TAS_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_FUELCHECK_USAGE_TERMS_CONFIRMED: "",
        },
        timeout: 10_000,
      },
    ),
    (error) => {
      const payload = JSON.parse(error.stdout);
      assert.equal(payload.status, "blocked");
      assert.equal(payload.publicLivePriceClaimsAllowed, false);
      assert.equal(payload.blockers.includes("nsw_terms_evidence_missing"), true);
      assert.equal(payload.blockers.includes("qld_terms_evidence_missing"), true);
      return true;
    },
  );
});

test("provider terms readiness caps excessive evidence freshness windows", async () => {
  const evidencePath = writeEvidenceFile({
    TAS: {
      ...providerTermsEvidence().regions.TAS,
      termsAcceptedAt: "2026-01-01",
      evidenceReference: "fuelcheck-tas-api-nsw-approval-email-2026-01-01",
    },
  });

  await assert.rejects(
    execFileAsync(
      process.execPath,
      [
        "scripts/check-provider-terms-readiness.mjs",
        "--production",
        "--enforce-public-launch",
        "--evidence-json",
        evidencePath,
        "--provider-terms-review-max-age-days",
        "9999",
      ],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          VIC_SERVO_SAVER_API_KEY: "",
          NSW_FUEL_API_KEY: "test-nsw-key",
          NSW_FUEL_API_SECRET: "test-nsw-secret",
          QLD_FUEL_API_TOKEN: "test-qld-token",
          FUEL_PATH_NSW_ACT_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_QLD_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_TAS_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_FUELCHECK_USAGE_TERMS_CONFIRMED: "",
        },
        timeout: 10_000,
      },
    ),
    (error) => {
      const payload = JSON.parse(error.stdout);
      assert.equal(payload.status, "blocked");
      assert.equal(payload.publicLivePriceClaimsAllowed, false);
      assert.equal(payload.blockers.includes("tas_terms_evidence_missing"), true);
      return true;
    },
  );
});

test("provider terms readiness rejects evidence references without source files", async () => {
  const evidencePath = writeEvidenceFile({
    NSW: {
      ...providerTermsEvidence().regions.NSW,
      evidenceSource: "evidence/missing-nsw-approval.md",
    },
  });

  await assert.rejects(
    execFileAsync(
      process.execPath,
      [
        "scripts/check-provider-terms-readiness.mjs",
        "--production",
        "--enforce-public-launch",
        "--evidence-json",
        evidencePath,
      ],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          VIC_SERVO_SAVER_API_KEY: "",
          NSW_FUEL_API_KEY: "test-nsw-key",
          NSW_FUEL_API_SECRET: "test-nsw-secret",
          QLD_FUEL_API_TOKEN: "test-qld-token",
          FUEL_PATH_NSW_ACT_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_QLD_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_TAS_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_FUELCHECK_USAGE_TERMS_CONFIRMED: "",
        },
        timeout: 10_000,
      },
    ),
    (error) => {
      const payload = JSON.parse(error.stdout);
      assert.equal(payload.status, "blocked");
      assert.equal(payload.publicLivePriceClaimsAllowed, false);
      assert.equal(payload.blockers.includes("nsw_terms_evidence_missing"), true);
      return true;
    },
  );
});

test("provider terms readiness rejects source files that leak provider secrets", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-provider-terms-secret-"));
  const sourcePath = path.join(tmp, "evidence", "nsw-terms-source.md");
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(
    sourcePath,
    [
      "FuelCheck API.NSW approval email 2026-06-20.",
      "Caching, attribution and commercial consumer app terms were reviewed.",
      "NSW_FUEL_API_SECRET: do-not-store-this-here",
    ].join("\n"),
  );
  const evidence = providerTermsEvidence({
    NSW: {
      ...providerTermsEvidence().regions.NSW,
      evidenceSource: "evidence/nsw-terms-source.md",
    },
  });
  const evidencePath = path.join(tmp, "provider-terms-evidence.json");
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

  await assert.rejects(
    execFileAsync(
      process.execPath,
      [
        "scripts/check-provider-terms-readiness.mjs",
        "--production",
        "--enforce-public-launch",
        "--evidence-json",
        evidencePath,
      ],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          VIC_SERVO_SAVER_API_KEY: "",
          NSW_FUEL_API_KEY: "test-nsw-key",
          NSW_FUEL_API_SECRET: "test-nsw-secret",
          QLD_FUEL_API_TOKEN: "test-qld-token",
          FUEL_PATH_NSW_ACT_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_QLD_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_TAS_USAGE_TERMS_CONFIRMED: "1",
          FUEL_PATH_FUELCHECK_USAGE_TERMS_CONFIRMED: "",
        },
        timeout: 10_000,
      },
    ),
    (error) => {
      const payload = JSON.parse(error.stdout);
      assert.equal(payload.status, "blocked");
      assert.equal(payload.publicLivePriceClaimsAllowed, false);
      assert.equal(payload.blockers.includes("nsw_terms_evidence_missing"), true);
      return true;
    },
  );
});

test("provider terms readiness rejects VIC evidence source files that leak Servo Saver credentials", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-provider-terms-vic-secret-"));
  const sourcePath = path.join(tmp, "evidence", "vic-terms-source.md");
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(
    sourcePath,
    [
      "Service Victoria Servo Saver terms source for service-victoria-servo-saver-api-approval-email-2026-06-25.",
      "Terms accepted at 2026-06-25.",
      "Attribution wording: Service Victoria Servo Saver source and required disclaimer wording approved for display.",
      "x-consumer-id: do-not-store-provider-credential",
    ].join("\n"),
  );

  const evidence = providerTermsEvidence({
    VIC: {
      servoSaverApiAccessApproved: true,
      servoSaverTermsAccepted: true,
      cachingDurationConfirmed: true,
      cachingDurationMinutes: 5,
      attributionDisclaimerReady: true,
      attributionDisclaimerWording: "Service Victoria Servo Saver source and required disclaimer wording approved for display.",
      commercialConsumerAppUseConfirmed: true,
      termsAcceptedAt: "2026-06-25",
      evidenceReference: "service-victoria-servo-saver-api-approval-email-2026-06-25",
      evidenceSource: "evidence/vic-terms-source.md",
    },
  });
  const evidencePath = path.join(tmp, "provider-terms-evidence.json");
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);

  await assert.rejects(
    execFileAsync(
      process.execPath,
      [
        "scripts/check-provider-terms-readiness.mjs",
        "--production",
        "--enforce-public-launch",
        "--evidence-json",
        evidencePath,
      ],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          VIC_SERVO_SAVER_API_KEY: "test-vic-key",
        },
        timeout: 10_000,
      },
    ),
    (error) => {
      const payload = JSON.parse(error.stdout);
      assert.equal(payload.status, "blocked");
      assert.equal(payload.blockers.includes("vic_terms_evidence_missing"), true);
      return true;
    },
  );
});

test("provider terms readiness passes when configured provider terms have evidence", async () => {
  const evidencePath = writeEvidenceFile();
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-provider-terms-readiness.mjs",
      "--production",
      "--enforce-public-launch",
      "--evidence-json",
      evidencePath,
    ],
    {
      cwd: ROOT,
      env: {
        ...process.env,
          VIC_SERVO_SAVER_API_KEY: "",
        NSW_FUEL_API_KEY: "test-nsw-key",
        NSW_FUEL_API_SECRET: "test-nsw-secret",
        QLD_FUEL_API_TOKEN: "test-qld-token",
        FUEL_PATH_NSW_ACT_USAGE_TERMS_CONFIRMED: "1",
        FUEL_PATH_QLD_USAGE_TERMS_CONFIRMED: "1",
        FUEL_PATH_TAS_USAGE_TERMS_CONFIRMED: "1",
        FUEL_PATH_FUELCHECK_USAGE_TERMS_CONFIRMED: "",
      },
      timeout: 10_000,
    },
  );
  const payload = JSON.parse(stdout);
  assert.equal(payload.status, "ready");
  assert.equal(payload.publicLivePriceClaimsAllowed, true);
  assert.deepEqual(payload.termsBlocked, []);
  assert.deepEqual(payload.evidenceBlocked, []);
  assert.equal(payload.evidence.provided, true);
  assert.deepEqual(payload.confirmationChecklist, []);
});

test("provider terms readiness passes VIC when Servo Saver evidence is present", async () => {
  const evidencePath = writeEvidenceFile({
    VIC: {
      servoSaverApiAccessApproved: true,
      servoSaverTermsAccepted: true,
      cachingDurationConfirmed: true,
      cachingDurationMinutes: 5,
      attributionDisclaimerReady: true,
      attributionDisclaimerWording: "Service Victoria Servo Saver source and required disclaimer wording approved for display.",
      commercialConsumerAppUseConfirmed: true,
      termsAcceptedAt: "2026-06-25",
      evidenceReference: "service-victoria-servo-saver-api-approval-email-2026-06-25",
    },
  });

  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "scripts/check-provider-terms-readiness.mjs",
      "--production",
      "--enforce-public-launch",
      "--evidence-json",
      evidencePath,
    ],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        VIC_SERVO_SAVER_API_KEY: "test-vic-key",
      },
      timeout: 10_000,
    },
  );
  const payload = JSON.parse(stdout);
  assert.equal(payload.status, "ready");
  assert.equal(payload.publicLivePriceClaimsAllowed, true);
  assert.deepEqual(payload.evidenceBlocked, []);
  assert.equal(payload.publicLiveRegions.includes("VIC"), true);
});

function writeEvidenceFile(overrides = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fuel-path-provider-terms-"));
  const evidence = providerTermsEvidence(overrides);
  writeProviderEvidenceSources(tmp, evidence, overrides);
  const filePath = path.join(tmp, "provider-terms-evidence.json");
  fs.writeFileSync(filePath, `${JSON.stringify(evidence, null, 2)}\n`);
  return filePath;
}

function writeProviderEvidenceSources(tmp, evidence, overrides) {
  const evidenceDir = path.join(tmp, "evidence");
  fs.mkdirSync(evidenceDir, { recursive: true });
  for (const [region, entry] of Object.entries(evidence.regions)) {
    if (overrides[region]?.evidenceSource) continue;
    const sourceName = `${region.toLowerCase()}-terms-source.md`;
    entry.evidenceSource = `evidence/${sourceName}`;
    fs.writeFileSync(
      path.join(evidenceDir, sourceName),
      [
        `${providerFamilyText(region)} terms source for ${entry.evidenceReference}.`,
        `Terms accepted at ${entry.termsAcceptedAt}.`,
        `Attribution wording: ${entry.attributionDisclaimerWording}.`,
        "Caching, attribution and commercial consumer app usage were reviewed for Fuel Path.",
      ].join("\n"),
    );
  }
}

function providerFamilyText(region) {
  if (region === "QLD") return "Queensland Fuel Prices";
  if (region === "VIC") return "Service Victoria Servo Saver";
  return "FuelCheck API.NSW";
}

function providerTermsEvidence(overrides = {}) {
  return {
    regions: {
      NSW: {
        apiAccessApproved: true,
        authorityTermsAccepted: true,
        cachingDurationConfirmed: true,
        cachingDurationMinutes: 30,
        attributionDisclaimerReady: true,
        attributionDisclaimerWording: "FuelCheck NSW source and required disclaimer wording approved for display.",
        commercialConsumerAppUseConfirmed: true,
        termsAcceptedAt: "2026-06-20",
        evidenceReference: "fuelcheck-api-nsw-approval-email-2026-06-20",
      },
      ACT: {
        apiAccessApproved: true,
        authorityTermsAccepted: true,
        cachingDurationConfirmed: true,
        cachingDurationMinutes: 30,
        attributionDisclaimerReady: true,
        attributionDisclaimerWording: "FuelCheck ACT source and required disclaimer wording approved for display.",
        commercialConsumerAppUseConfirmed: true,
        termsAcceptedAt: "2026-06-20",
        evidenceReference: "fuelcheck-act-api-nsw-approval-email-2026-06-20",
      },
      QLD: {
        signUpAccepted: true,
        licenceTermsAccepted: true,
        attributionDisclaimerReady: true,
        attributionDisclaimerWording: "Queensland Fuel Prices source and disclaimer wording approved for display.",
        cachePolicyCoversCurrencyObligations: true,
        priceCacheMaxAgeMinutes: 30,
        siteDataCacheMaxAgeHours: 24,
        serverSideTokenOnly: true,
        commercialConsumerAppUseConfirmed: true,
        termsAcceptedAt: "2026-06-20",
        evidenceReference: "qld-fuel-prices-terms-acceptance-record-2026-06-20",
      },
      TAS: {
        apiV2AccessApproved: true,
        fuelCheckTasTermsAccepted: true,
        cachingDurationConfirmed: true,
        cachingDurationMinutes: 30,
        attributionDisclaimerReady: true,
        attributionDisclaimerWording: "FuelCheck TAS source and required disclaimer wording approved for display.",
        commercialConsumerAppUseConfirmed: true,
        termsAcceptedAt: "2026-06-20",
        evidenceReference: "fuelcheck-tas-api-nsw-approval-email-2026-06-20",
      },
      ...overrides,
    },
  };
}
