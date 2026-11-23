import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Production Distribution (dist/) Integrity Tests", () => {
  const distPath = path.resolve(import.meta.dirname, "../dist");
  const indexPath = path.join(distPath, "index.html");

  it("dist/index.html exists and contains valid modern HTML", () => {
    expect(fs.existsSync(indexPath)).toBe(true);
    const html = fs.readFileSync(indexPath, "utf8");
    expect(html.length).toBeGreaterThan(5000);
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("enforces zoomable viewport meta without user-scalable=no (WCAG 1.4.4)", () => {
    const html = fs.readFileSync(indexPath, "utf8");
    expect(html).toContain(
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    );
    expect(html).not.toContain("user-scalable=no");
    expect(html).not.toContain("maximum-scale=1");
  });

  it("contains no external unpkg or jsdelivr CDN script dependencies", () => {
    const html = fs.readFileSync(indexPath, "utf8");
    expect(html).not.toContain("https://unpkg.com/three");
    expect(html).not.toContain("https://unpkg.com/es-module-shims");
    expect(html).not.toContain("https://cdn.jsdelivr.net");
  });

  it("contains accessible skip-link and accessible-fallback region with projects", () => {
    const html = fs.readFileSync(indexPath, "utf8");
    expect(html).toContain('class="skip-link"');
    expect(html).toContain('id="accessible-fallback"');

    // The fallback is what screen readers and crawlers see, so it has to
    // agree with the catalogue rather than drift from it. It is generated
    // from the same projects.json, and these titles are the proof.
    expect(html).toContain("Cyber Agent");
    expect(html).toContain("CareTrack Clinic");
    expect(html).toContain("Cosmic Portfolio");

    // Entries that were removed must not survive in the crawlable copy.
    expect(html).not.toContain("TITAN NEXUS");
    expect(html).not.toContain("Agent Zero");
    expect(html).not.toContain("UstaPro Master CAD 3D");
  });

  it("contains truthful schema.org JSON-LD and meta description", () => {
    const html = fs.readFileSync(indexPath, "utf8");
    expect(html).toContain("AI & Full-Stack Developer (Student)");
    expect(html).toContain("PDP University");
    expect(html).toContain("School 21 Tashkent");
    expect(html).not.toContain(
      "Lead AI Systems Architect & Full-Stack Engineer",
    );
  });

  it("verifies bundled self-hosted assets exist in dist/", () => {
    const assetsDir = path.join(distPath, "assets");
    expect(fs.existsSync(assetsDir)).toBe(true);

    const files = fs.readdirSync(assetsDir);
    expect(files.some((f) => f.endsWith(".woff2"))).toBe(true);
    expect(files.some((f) => f.endsWith(".webp"))).toBe(true);
    expect(files.some((f) => f.endsWith(".css"))).toBe(true);
    expect(files.some((f) => f.endsWith(".js"))).toBe(true);

    expect(
      fs.existsSync(
        path.join(distPath, "assets/Azimjon_Kamiljanov_Resume.pdf"),
      ),
    ).toBe(true);
    expect(fs.existsSync(path.join(distPath, "assets/space_ambient.mp3"))).toBe(
      true,
    );
  });

  it("verifies self-hosted MediaPipe tasks-vision assets exist in dist/mediapipe/", () => {
    const mpDir = path.join(distPath, "mediapipe");
    expect(fs.existsSync(mpDir)).toBe(true);
    expect(fs.existsSync(path.join(mpDir, "hand_landmarker.task"))).toBe(true);
    expect(
      fs.existsSync(path.join(mpDir, "wasm/vision_wasm_internal.wasm")),
    ).toBe(true);
  });

  it("fails if any file in dist/ has a size of 0 bytes (C1 zero-byte guard)", () => {
    function checkZeroBytes(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          checkZeroBytes(fullPath);
        } else {
          const stats = fs.statSync(fullPath);
          expect(stats.size, `Found 0-byte file: ${fullPath}`).toBeGreaterThan(
            0,
          );
        }
      }
    }
    checkZeroBytes(distPath);
  });

  it("contains zero inline style attributes in dist/index.html (A5 strict CSP compatibility)", () => {
    const html = fs.readFileSync(indexPath, "utf8");
    const styleAttrMatches = html.match(/\sstyle\s*=\s*["'][^"']*["']/gi) || [];
    expect(
      styleAttrMatches.length,
      `Expected 0 inline style attributes, found: ${JSON.stringify(styleAttrMatches)}`,
    ).toBe(0);
  });
});
