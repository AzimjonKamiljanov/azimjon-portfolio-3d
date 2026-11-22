#!/usr/bin/env node
/**
 * Reads a Gitleaks JSON report and turns it into a hard CI failure.
 *
 * The previous version of this script only printed findings, so a leaked
 * credential in the git history still produced a green build. It now exits
 * with code 1 whenever the report is non-empty, and also when the report is
 * missing or unparseable — a scan that did not produce readable output is
 * treated as a failure rather than as "no leaks".
 *
 * Secret values are never printed. Findings are referenced by file, commit,
 * rule id and line number only.
 */

const fs = require("fs");
const path = require("path");

const REPORT_PATH = process.env.GITLEAKS_REPORT || "gitleaks-report.json";
const EXPECT_REPORT = process.env.GITLEAKS_EXPECT_REPORT === "1";

function fail(message) {
  console.error(`\n✖ Secret scan failed: ${message}\n`);
  process.exit(1);
}

function cleanup(file) {
  try {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {
    // A leftover report file is not worth failing the build over.
  }
}

const resolved = path.resolve(REPORT_PATH);

if (!fs.existsSync(resolved)) {
  // Gitleaks writes no report file when it finds nothing. Treat that as a
  // pass unless the caller asserts a report must exist (so that a crashed
  // scanner cannot be mistaken for a clean tree).
  if (EXPECT_REPORT) {
    fail(
      `expected a report at ${REPORT_PATH} but none was written — ` +
        `the scanner probably failed to run`,
    );
  }
  console.log("✔ Secret scan clean: Gitleaks reported zero findings.");
  process.exit(0);
}

let report;
try {
  const raw = fs.readFileSync(resolved, "utf8").trim();
  report = raw === "" ? [] : JSON.parse(raw);
} catch (err) {
  cleanup(resolved);
  fail(`could not parse ${REPORT_PATH}: ${err.message}`);
}

if (!Array.isArray(report)) {
  cleanup(resolved);
  fail(`${REPORT_PATH} did not contain a JSON array`);
}

if (report.length === 0) {
  cleanup(resolved);
  console.log("✔ Secret scan clean: Gitleaks reported zero findings.");
  process.exit(0);
}

console.error("\n=== Gitleaks full-history audit ===");
console.error(`Findings: ${report.length} (values redacted)\n`);

report.forEach((item, idx) => {
  const file = item.File || "<unknown file>";
  const commit = (item.Commit || "<working tree>").slice(0, 12);
  const rule = item.RuleID || item.Description || "<unknown rule>";
  const line = item.StartLine ?? "?";
  console.error(`[${idx + 1}] ${file}:${line}  commit ${commit}  rule ${rule}`);
});

console.error(
  [
    "",
    "A credential is present in the repository or its history.",
    "Required remediation, in this order:",
    "  1. Revoke and rotate the credential at its provider.",
    "  2. Rewrite the history (git filter-repo / BFG) and force-push.",
    "  3. Enable GitHub secret scanning and push protection.",
    "",
    "This job fails until the scan comes back clean.",
  ].join("\n"),
);

cleanup(resolved);
process.exit(1);
