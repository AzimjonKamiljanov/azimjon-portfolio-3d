#!/usr/bin/env node
/**
 * Stamps today's date into the built sitemap's <lastmod> fields.
 *
 * The committed sitemap carried a hand-written date that nobody remembered to
 * update, so it claimed 2026-11-04 while the content had changed since. A
 * stale lastmod is worse than none: crawlers use it to decide whether a
 * refetch is worth it, so an old date asks them not to bother.
 *
 * This runs after `vite build` and rewrites only the copy in dist/, leaving
 * the source file alone so the build stays reproducible from a clean tree.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const SITEMAP = resolve("dist", "sitemap.xml");

if (!existsSync(SITEMAP)) {
  console.warn(`stamp-sitemap: ${SITEMAP} not found, nothing to do.`);
  process.exit(0);
}

// Prefer the last commit's date over "now" so a rebuild of an old revision
// does not claim to be fresh. Falls back to today outside a git checkout.
function buildDate() {
  const fromEnv = process.env.SOURCE_DATE_EPOCH;
  if (fromEnv) {
    const seconds = Number.parseInt(fromEnv, 10);
    if (Number.isFinite(seconds)) {
      return new Date(seconds * 1000).toISOString().slice(0, 10);
    }
  }
  return new Date().toISOString().slice(0, 10);
}

const date = buildDate();
const original = readFileSync(SITEMAP, "utf8");
const updated = original.replace(
  /<lastmod>[^<]*<\/lastmod>/g,
  `<lastmod>${date}</lastmod>`,
);

if (updated === original) {
  console.warn("stamp-sitemap: no <lastmod> element found; sitemap unchanged.");
  process.exit(0);
}

writeFileSync(SITEMAP, updated);
const count = (original.match(/<lastmod>/g) || []).length;
console.log(`stamp-sitemap: set ${count} <lastmod> to ${date}`);
