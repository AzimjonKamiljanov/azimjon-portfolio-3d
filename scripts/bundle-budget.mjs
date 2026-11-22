#!/usr/bin/env node
/**
 * Fails the build when the bytes a first-time visitor must download grow past
 * an agreed budget.
 *
 * Why this and not Lighthouse: the page runs a continuous requestAnimationFrame
 * loop, so Lighthouse's load model never sees the CPU go idle and the run does
 * not terminate. And a CI runner has no GPU, so any frame-rate number it
 * produced would measure SwiftShader rather than the site. Transfer size is
 * the part of performance that *is* deterministic on a runner, and it is the
 * part that regresses silently when a dependency is added.
 *
 * Budgets are gzip sizes, because that is what the edge actually serves.
 * Deliberately raising one is a visible, reviewable diff.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const DIST = "dist/assets";

/**
 * Each entry matches one emitted chunk by filename prefix. `maxGzipKb` is set
 * a little above today's size so routine churn does not trip it, but not so
 * far that a real regression slips through.
 */
const BUDGETS = [
  { name: "main", pattern: /^main-.*\.js$/, maxGzipKb: 70 },
  { name: "three", pattern: /^three-.*\.js$/, maxGzipKb: 150 },
  { name: "gsap", pattern: /^gsap-.*\.js$/, maxGzipKb: 32 },
  { name: "i18n", pattern: /^i18n-.*\.js$/, maxGzipKb: 34 },
  { name: "css", pattern: /^main-.*\.css$/, maxGzipKb: 38 },
];

// Everything the browser must fetch before the scene can start. The MediaPipe
// vision bundle is excluded on purpose: it loads only when a visitor opts into
// hand control, so it is not part of a first view.
const TOTAL_EAGER_GZIP_KB = 300;

const files = readdirSync(DIST);
const rows = [];
const failures = [];

for (const budget of BUDGETS) {
  const match = files.find((f) => budget.pattern.test(f));
  if (!match) {
    failures.push(`${budget.name}: no chunk matched ${budget.pattern}`);
    continue;
  }

  const path = join(DIST, match);
  const raw = statSync(path).size;
  const gzip = gzipSync(readFileSync(path)).length;
  const gzipKb = gzip / 1024;

  rows.push({
    name: budget.name,
    file: match,
    rawKb: raw / 1024,
    gzipKb,
    maxGzipKb: budget.maxGzipKb,
    over: gzipKb > budget.maxGzipKb,
  });

  if (gzipKb > budget.maxGzipKb) {
    failures.push(
      `${budget.name}: ${gzipKb.toFixed(1)} KB gzip exceeds the ${budget.maxGzipKb} KB budget`,
    );
  }
}

const totalGzipKb = rows.reduce((sum, r) => sum + r.gzipKb, 0);

console.log("\nFirst-view transfer budget (gzip)\n");
console.log(
  `  ${"chunk".padEnd(8)} ${"gzip".padStart(9)} ${"budget".padStart(8)}   file`,
);
for (const r of rows) {
  const flag = r.over ? "OVER" : "ok";
  console.log(
    `  ${r.name.padEnd(8)} ${`${r.gzipKb.toFixed(1)} KB`.padStart(9)} ${`${r.maxGzipKb} KB`.padStart(8)}   ${r.file}  ${flag}`,
  );
}
console.log(
  `\n  total    ${`${totalGzipKb.toFixed(1)} KB`.padStart(9)} ${`${TOTAL_EAGER_GZIP_KB} KB`.padStart(8)}   (excludes the lazy vision bundle)`,
);

if (totalGzipKb > TOTAL_EAGER_GZIP_KB) {
  failures.push(
    `total: ${totalGzipKb.toFixed(1)} KB gzip exceeds the ${TOTAL_EAGER_GZIP_KB} KB first-view budget`,
  );
}

if (failures.length > 0) {
  console.error("\n✖ Bundle budget exceeded:\n");
  for (const f of failures) console.error(`  - ${f}`);
  console.error(
    "\nEither reduce the payload, or raise the budget in" +
      " scripts/bundle-budget.mjs with a reason in the commit message.\n",
  );
  process.exit(1);
}

console.log("\n✔ Within budget.\n");
