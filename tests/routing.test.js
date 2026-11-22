import { describe, it, expect } from "vitest";
import worker, { isServablePath } from "../worker.js";

/**
 * The assets binding is configured for single-page-application fallback,
 * which answered any unknown path with index.html and HTTP 200. This site has
 * no client-side router, so each of those was a soft 404 that a crawler could
 * index as a real, duplicate page. These tests pin the guard that stops it.
 */

const ENV = {
  TELEGRAM_BOT_TOKEN: "mock",
  TELEGRAM_CHAT_ID: "123",
  ENVIRONMENT: "dev",
};

function get(path) {
  return worker.fetch(new Request(`http://localhost:8787${path}`), ENV);
}

describe("isServablePath", () => {
  it.each([
    "/",
    "/index.html",
    "/favicon.ico",
    "/favicon.svg",
    "/robots.txt",
    "/sitemap.xml",
    "/manifest.webmanifest",
    "/desktop_overview_clean.png",
  ])("accepts %s", (path) => {
    expect(isServablePath(path)).toBe(true);
  });

  it.each([
    "/assets/main-abc123.js",
    "/assets/main-abc123.css",
    "/assets/earth_2048.webp",
    "/mediapipe/hand_landmarker.task",
    "/mediapipe/wasm/vision_wasm_internal.wasm",
  ])("accepts build output at %s", (path) => {
    expect(isServablePath(path)).toBe(true);
  });

  it.each([
    "/mavjud-emas",
    "/admin",
    "/wp-login.php",
    "/.env",
    "/some/deep/path",
    "/index.php",
  ])("rejects %s", (path) => {
    expect(isServablePath(path)).toBe(false);
  });

  it("does not accept a lookalike prefix outside the real directory", () => {
    // "/assetsomething" shares a prefix with "/assets" but is not under it.
    expect(isServablePath("/assetsomething.js")).toBe(false);
  });
});

describe("unknown paths", () => {
  it("answers 404, not a 200 home page", async () => {
    const res = await get("/mavjud-emas-sahifa");
    expect(res.status).toBe(404);
  });

  it("asks crawlers not to index the 404", async () => {
    const res = await get("/mavjud-emas-sahifa");
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
  });

  it("serves a real HTML page, not bare text", async () => {
    const res = await get("/mavjud-emas-sahifa");
    const body = await res.text();
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(body).toContain("<!DOCTYPE html>");
    expect(body).toContain("404");
  });

  it("keeps the security headers on the 404", async () => {
    const res = await get("/mavjud-emas-sahifa");
    expect(res.headers.get("Content-Security-Policy")).toContain(
      "default-src 'self'",
    );
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("does not let the edge cache the miss", async () => {
    const res = await get("/mavjud-emas-sahifa");
    expect(res.headers.get("Cache-Control")).toContain("max-age=0");
  });
});

describe("the API is still reachable", () => {
  it("serves /api/config rather than 404ing it as an unknown path", async () => {
    const res = await get("/api/config");
    expect(res.status).toBe(200);
  });

  it("still rejects the wrong method on /api/contact with 405", async () => {
    const res = await get("/api/contact");
    expect(res.status).toBe(405);
  });
});

describe("Content-Security-Policy", () => {
  it("admits the Cloudflare Web Analytics beacon", async () => {
    // The beacon was blocked on every page load, so the account collected
    // nothing while logging a violation. It needs script-src and connect-src.
    const res = await get("/api/config");
    const csp = res.headers.get("Content-Security-Policy");
    const directive = (name) =>
      csp.split("; ").find((d) => d.startsWith(`${name} `));

    expect(directive("script-src")).toContain(
      "https://static.cloudflareinsights.com",
    );
    expect(directive("connect-src")).toContain(
      "https://static.cloudflareinsights.com",
    );
  });

  it("still forbids inline script", async () => {
    const res = await get("/api/config");
    const csp = res.headers.get("Content-Security-Policy");
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
  });
});
