import { describe, it, expect, vi, beforeEach } from "vitest";
import worker, { getTurnstileConfig } from "../worker.js";

/**
 * Regression tests for the Turnstile wiring.
 *
 * The bug these exist to prevent: the Worker used to enforce a Turnstile
 * token whenever TURNSTILE_SECRET_KEY was set, while the browser never sent
 * one because no widget was ever rendered. Setting the secret in production
 * would therefore have rejected 100% of real messages, silently. The
 * challenge is now a single runtime state derived from both keys, published
 * to the browser at GET /api/config.
 */

const BASE_ENV = {
  TELEGRAM_BOT_TOKEN: "mock_token_12345",
  TELEGRAM_CHAT_ID: "987654321",
  ENVIRONMENT: "dev",
};

function contactRequest(body) {
  return new Request("http://localhost:8787/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_MESSAGE = {
  name: "Azimjon",
  contact: "@someuser",
  message: "Salom, bu test xabari.",
  lang: "uz",
};

describe("getTurnstileConfig", () => {
  it("is disabled when neither key is present", () => {
    expect(getTurnstileConfig(BASE_ENV)).toMatchObject({ enabled: false });
  });

  it("is enabled only when both keys are present", () => {
    const config = getTurnstileConfig({
      ...BASE_ENV,
      TURNSTILE_SITE_KEY: "0x4AAA",
      TURNSTILE_SECRET_KEY: "0x4AAA_secret",
    });
    expect(config.enabled).toBe(true);
    expect(config.siteKey).toBe("0x4AAA");
  });

  it("stays disabled, and reports the error, when only the secret is set", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const config = getTurnstileConfig({
      ...BASE_ENV,
      TURNSTILE_SECRET_KEY: "0x4AAA_secret",
    });

    // The whole point: a half-configuration must not silently reject every
    // submission. It degrades to honeypot + rate limiting and says so.
    expect(config.enabled).toBe(false);
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toContain("TURNSTILE_SITE_KEY");
    spy.mockRestore();
  });

  it("stays disabled when only the site key is set", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      getTurnstileConfig({ ...BASE_ENV, TURNSTILE_SITE_KEY: "0x4AAA" }).enabled,
    ).toBe(false);
    spy.mockRestore();
  });

  it("treats whitespace-only values as absent", () => {
    const config = getTurnstileConfig({
      ...BASE_ENV,
      TURNSTILE_SITE_KEY: "   ",
      TURNSTILE_SECRET_KEY: "   ",
    });
    expect(config.enabled).toBe(false);
  });
});

describe("GET /api/config", () => {
  it("reports the challenge as off and leaks no secret", async () => {
    const res = await worker.fetch(
      new Request("http://localhost:8787/api/config"),
      BASE_ENV,
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.turnstile).toEqual({ enabled: false, siteKey: null });
    expect(JSON.stringify(body)).not.toContain("secret");
  });

  it("publishes the public site key when the challenge is on", async () => {
    const res = await worker.fetch(
      new Request("http://localhost:8787/api/config"),
      {
        ...BASE_ENV,
        TURNSTILE_SITE_KEY: "0x4AAA_public",
        TURNSTILE_SECRET_KEY: "0x4AAA_secret",
      },
    );
    const body = await res.json();

    expect(body.turnstile.enabled).toBe(true);
    expect(body.turnstile.siteKey).toBe("0x4AAA_public");
    // A site key is public by design; the secret must never cross the wire.
    expect(JSON.stringify(body)).not.toContain("0x4AAA_secret");
  });

  it("rejects non-GET methods", async () => {
    const res = await worker.fetch(
      new Request("http://localhost:8787/api/config", { method: "POST" }),
      BASE_ENV,
    );
    expect(res.status).toBe(405);
  });
});

describe("Content-Security-Policy follows the Turnstile state", () => {
  it("names no external script origin while the challenge is off", async () => {
    const res = await worker.fetch(
      new Request("http://localhost:8787/api/config"),
      BASE_ENV,
    );
    const csp = res.headers.get("Content-Security-Policy");

    expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval'");
    expect(csp).not.toContain("challenges.cloudflare.com");
  });

  it("admits exactly the Turnstile origin once the challenge is on", async () => {
    const res = await worker.fetch(
      new Request("http://localhost:8787/api/config"),
      {
        ...BASE_ENV,
        TURNSTILE_SITE_KEY: "0x4AAA",
        TURNSTILE_SECRET_KEY: "0x4AAA_secret",
      },
    );
    const csp = res.headers.get("Content-Security-Policy");

    expect(csp).toContain(
      "script-src 'self' 'wasm-unsafe-eval' https://challenges.cloudflare.com",
    );
    expect(csp).toContain("frame-src 'self' https://challenges.cloudflare.com");
    // Unrelated directives must not loosen as a side effect.
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
  });
});

describe("contact endpoint under each Turnstile state", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts a message with no token while the challenge is off", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true }))),
    );

    const res = await worker.fetch(contactRequest(VALID_MESSAGE), BASE_ENV);
    expect(res.status).toBe(200);
    vi.unstubAllGlobals();
  });

  it("rejects a message with no token once the challenge is on", async () => {
    const res = await worker.fetch(contactRequest(VALID_MESSAGE), {
      ...BASE_ENV,
      TURNSTILE_SITE_KEY: "0x4AAA",
      TURNSTILE_SECRET_KEY: "0x4AAA_secret",
    });
    expect(res.status).toBe(400);
  });

  it("accepts a verified token once the challenge is on", async () => {
    // First call is siteverify, second is the Telegram dispatch.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true })));
    vi.stubGlobal("fetch", fetchMock);

    const res = await worker.fetch(
      contactRequest({ ...VALID_MESSAGE, "cf-turnstile-response": "token" }),
      {
        ...BASE_ENV,
        TURNSTILE_SITE_KEY: "0x4AAA",
        TURNSTILE_SECRET_KEY: "0x4AAA_secret",
      },
    );

    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toContain(
      "challenges.cloudflare.com/turnstile/v0/siteverify",
    );
    vi.unstubAllGlobals();
  });

  it("drops a honeypot submission before reaching Turnstile or Telegram", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await worker.fetch(
      contactRequest({ ...VALID_MESSAGE, _hp: "i am a bot" }),
      {
        ...BASE_ENV,
        TURNSTILE_SITE_KEY: "0x4AAA",
        TURNSTILE_SECRET_KEY: "0x4AAA_secret",
      },
    );

    // The bot is told it succeeded, but nothing left the Worker.
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("payload limits", () => {
  it("rejects a body over the cap even without a Content-Length header", async () => {
    // The old check trusted Content-Length alone, so a chunked request
    // reported 0 and skipped the limit entirely.
    const huge = "x".repeat(20000);
    const req = new Request("http://localhost:8787/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...VALID_MESSAGE, message: huge }),
    });
    req.headers.delete("content-length");

    const res = await worker.fetch(req, BASE_ENV);
    expect(res.status).toBe(413);
  });

  it("rejects a JSON array payload", async () => {
    const res = await worker.fetch(
      new Request("http://localhost:8787/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "[1,2,3]",
      }),
      BASE_ENV,
    );
    expect(res.status).toBe(400);
  });
});
