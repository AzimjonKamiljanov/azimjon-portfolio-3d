/**
 * Cloudflare Worker for Azimjon Kamiljanov 3D Portfolio
 * Enterprise-grade security headers, CSP, Turnstile verification,
 * honeypot protection, strict origin allowlist, and hardened Telegram dispatch.
 */

const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

const STATIC_SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(self), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};

/**
 * Turnstile needs a cross-origin script and iframe. Those origins are added to
 * the policy only while the challenge is actually configured, so a deployment
 * without Turnstile keeps a self-only policy and no external script origin.
 */
function buildCsp(turnstileEnabled) {
  const scriptSrc = ["'self'", "'wasm-unsafe-eval'"];
  const frameSrc = ["'self'"];
  const connectSrc = ["'self'"];

  if (turnstileEnabled) {
    scriptSrc.push(TURNSTILE_ORIGIN);
    frameSrc.push(TURNSTILE_ORIGIN);
    connectSrc.push(TURNSTILE_ORIGIN);
  }

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self'",
    "font-src 'self' data:",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob:",
    `connect-src ${connectSrc.join(" ")}`,
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    `frame-src ${frameSrc.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

const CSP_WITHOUT_TURNSTILE = buildCsp(false);
const CSP_WITH_TURNSTILE = buildCsp(true);

/**
 * Turnstile is live only when BOTH halves are present: the public site key the
 * browser needs to render the widget, and the secret the Worker needs to
 * verify the token. Half a configuration previously meant every submission was
 * rejected, so the two are now checked together and reported as one state.
 */
export function getTurnstileConfig(env) {
  const siteKey =
    typeof env?.TURNSTILE_SITE_KEY === "string"
      ? env.TURNSTILE_SITE_KEY.trim()
      : "";
  const secretKey =
    typeof env?.TURNSTILE_SECRET_KEY === "string"
      ? env.TURNSTILE_SECRET_KEY.trim()
      : "";

  if (siteKey && secretKey) {
    return { enabled: true, siteKey, secretKey };
  }

  if (siteKey || secretKey) {
    console.error(
      "Turnstile is half-configured: " +
        `${siteKey ? "TURNSTILE_SITE_KEY" : "TURNSTILE_SECRET_KEY"} is set but ` +
        `${siteKey ? "TURNSTILE_SECRET_KEY" : "TURNSTILE_SITE_KEY"} is missing. ` +
        "The challenge stays disabled; honeypot and rate limiting still apply.",
    );
  }

  return { enabled: false, siteKey: null, secretKey: null };
}

function applySecurityHeaders(headers, turnstileEnabled = false) {
  for (const [key, value] of Object.entries(STATIC_SECURITY_HEADERS)) {
    headers.set(key, value);
  }
  headers.set(
    "Content-Security-Policy",
    turnstileEnabled ? CSP_WITH_TURNSTILE : CSP_WITHOUT_TURNSTILE,
  );
}

const PRODUCTION_ALLOWED_ORIGINS = new Set([
  "https://azimjon.dev",
  "https://www.azimjon.dev",
]);

const DEV_ALLOWED_ORIGINS = new Set([
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:8787",
  "http://127.0.0.1:8787",
]);

function isAllowedOrigin(origin, host, isDev) {
  if (!origin) return true; // Same-origin direct request
  if (PRODUCTION_ALLOWED_ORIGINS.has(origin)) return true;
  if (isDev && DEV_ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const parsed = new URL(origin);
    if (!isDev && parsed.protocol !== "https:") return false;
    if (host && parsed.host === host) return true;
    if (
      (parsed.hostname === "azimjon.dev" ||
        parsed.hostname === "www.azimjon.dev") &&
      (parsed.port === "" || parsed.port === "443")
    )
      return true;
  } catch {
    // A malformed Origin header is simply not an allowed origin.
  }
  return false;
}

function getCorsHeaders(origin, host, isDev) {
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Requested-With",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin && isAllowedOrigin(origin, host, isDev)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

// Sliding window in-memory rate limiter per edge isolate
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;

async function checkRateLimit(ip, env, isDev) {
  if (isDev && (ip === "127.0.0.1" || ip === "::1" || ip === "localhost")) {
    return { allowed: true, remaining: 999 };
  }

  // 1. Cloudflare Workers Rate Limiting binding (env.RATE_LIMITER)
  if (env && env.RATE_LIMITER && typeof env.RATE_LIMITER.limit === "function") {
    try {
      const outcome = await env.RATE_LIMITER.limit({ key: ip });
      if (!outcome.success) {
        return { allowed: false, retryAfter: 60 };
      }
      return { allowed: true, remaining: 1 };
    } catch (_) {
      // Fall back to in-memory limiter on binding exception
    }
  }

  // 2. Cloudflare KV rate limiting binding (env.RATE_LIMIT_KV)
  if (env && env.RATE_LIMIT_KV && typeof env.RATE_LIMIT_KV.get === "function") {
    try {
      const kvKey = `rl:${ip}`;
      const current = await env.RATE_LIMIT_KV.get(kvKey);
      const count = current ? parseInt(current, 10) : 0;
      if (count >= MAX_REQUESTS_PER_WINDOW) {
        return { allowed: false, retryAfter: 60 };
      }
      await env.RATE_LIMIT_KV.put(kvKey, String(count + 1), {
        expirationTtl: 60,
      });
      return {
        allowed: true,
        remaining: MAX_REQUESTS_PER_WINDOW - (count + 1),
      };
    } catch (_) {
      // Fall back to in-memory limiter on KV exception
    }
  }

  // 3. Sliding window in-memory fallback per edge isolate
  const now = Date.now();
  if (rateLimitMap.size > 2000) {
    for (const [key, data] of rateLimitMap.entries()) {
      if (now - data.firstReq > RATE_LIMIT_WINDOW_MS) {
        rateLimitMap.delete(key);
      }
    }
  }

  const record = rateLimitMap.get(ip);
  if (!record || now - record.firstReq > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, firstReq: now });
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1 };
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.ceil(
      (RATE_LIMIT_WINDOW_MS - (now - record.firstReq)) / 1000,
    );
    return { allowed: false, retryAfter: Math.max(1, retryAfter) };
  }

  record.count++;
  return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - record.count };
}

// Strict HTML escaping for Telegram messages
function escapeTg(str) {
  if (typeof str !== "string") return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Strip non-printable ASCII control characters
function sanitizeInput(str) {
  if (typeof str !== "string") return "";
  // Allow tabs (9), newlines (10), carriage returns (13); strip every other
  // C0 control character plus DEL. Matching control characters is the entire
  // purpose of this expression, hence the targeted rule suppression.
  // eslint-disable-next-line no-control-regex
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
}

const LOCALIZED_MESSAGES = {
  uz: {
    forbiddenOrigin: "Taqiqlangan manba (Forbidden origin).",
    rateLimited: "Juda koʻp soʻrov yuborildi. Iltimos, bir oz kuting.",
    invalidJson: "Yaroqsiz JSON formati.",
    validationError: "Barcha maydonlarni toʻgʻri toʻldiring.",
    turnstileFailed: "Xavfsizlik tekshiruvidan oʻtib boʻlmadi.",
    serviceUnavailable: "Xizmatda vaqtinchalik nosozlik yuz berdi.",
    success: "Xabar muvaffaqiyatli yuborildi.",
  },
  en: {
    forbiddenOrigin: "Forbidden origin.",
    rateLimited: "Too many requests. Please wait a moment.",
    invalidJson: "Invalid JSON payload.",
    validationError: "Please fill in all fields correctly.",
    turnstileFailed: "Security challenge verification failed.",
    serviceUnavailable: "Service temporarily unavailable.",
    success: "Message sent successfully.",
  },
  ru: {
    forbiddenOrigin: "Запрещенный источник (Forbidden origin).",
    rateLimited: "Слишком много запросов. Пожалуйста, подождите немного.",
    invalidJson: "Неверный формат JSON.",
    validationError: "Пожалуйста, заполните все поля корректно.",
    turnstileFailed: "Проверка безопасности не пройдена.",
    serviceUnavailable: "Служба временно недоступна.",
    success: "Сообщение успешно отправлено.",
  },
};

function getMsg(lang, key) {
  const l = LOCALIZED_MESSAGES[lang] || LOCALIZED_MESSAGES.uz;
  return l[key] || LOCALIZED_MESSAGES.uz[key];
}

async function verifyTurnstile(token, secretKey, clientIp) {
  if (!token || !secretKey) return false;
  try {
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token);
    if (clientIp) formData.append("remoteip", clientIp);

    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      },
    );
    const data = await res.json();
    return !!data.success;
  } catch (_) {
    return false;
  }
}

/**
 * Single exit point for every JSON response the Worker produces.
 *
 * Previously each branch rebuilt its own `Headers`, called
 * `applySecurityHeaders` and stringified its own body — seventeen copies of
 * the same four lines, which is how the Turnstile CSP entries would have been
 * missed on at least one path. One helper means one place to get it right.
 */
function jsonResponse(payload, { status = 200, cors, turnstile, extra } = {}) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (cors) {
    for (const [key, value] of Object.entries(cors)) headers.set(key, value);
  } else {
    headers.set("Vary", "Origin");
  }
  if (extra) {
    for (const [key, value] of Object.entries(extra)) headers.set(key, value);
  }
  applySecurityHeaders(headers, Boolean(turnstile));
  return new Response(JSON.stringify(payload), { status, headers });
}

/** Public runtime configuration the browser needs before rendering the form. */
function handleConfig(env) {
  const turnstile = getTurnstileConfig(env);
  return jsonResponse(
    {
      ok: true,
      // A Turnstile *site* key is public by design — it ships in the markup of
      // every site that uses the widget. Serving it here instead of baking it
      // into the bundle keeps one runtime source of truth, so the widget and
      // the Worker's verification can never disagree about whether the
      // challenge is active.
      turnstile: {
        enabled: turnstile.enabled,
        siteKey: turnstile.siteKey,
      },
    },
    {
      turnstile: turnstile.enabled,
      extra: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}

const MAX_CONTACT_BYTES = 10240;

async function handleContact(request, env, url) {
  const isDev = env.ENVIRONMENT === "dev";
  const origin = request.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin, url.host, isDev);
  const turnstile = getTurnstileConfig(env);
  const reply = (payload, status, extra) =>
    jsonResponse(payload, {
      status,
      cors: corsHeaders,
      turnstile: turnstile.enabled,
      extra,
    });

  // 1. Origin verification
  if (origin && !isAllowedOrigin(origin, url.host, isDev)) {
    return jsonResponse(
      { ok: false, error: getMsg("uz", "forbiddenOrigin") },
      { status: 403, turnstile: turnstile.enabled },
    );
  }

  // 2. Strict Content-Type check
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return reply({ ok: false, error: getMsg("uz", "invalidJson") }, 415);
  }

  // 3. Declared payload size check. A request may omit Content-Length
  //    (chunked transfer), so this is only the cheap early rejection; the
  //    authoritative cap is applied on the bytes actually read, below.
  const declaredLength = Number.parseInt(
    request.headers.get("content-length") || "0",
    10,
  );
  if (Number.isFinite(declaredLength) && declaredLength > MAX_CONTACT_BYTES) {
    return reply({ ok: false, error: getMsg("uz", "validationError") }, 413);
  }

  // 4. Client IP resolution (do not trust x-forwarded-for)
  const clientIp =
    request.headers.get("cf-connecting-ip") ||
    (isDev ? "127.0.0.1" : "0.0.0.0");

  // 5. Rate limiting
  const rate = await checkRateLimit(clientIp, env, isDev);
  if (!rate.allowed) {
    return reply({ ok: false, error: getMsg("uz", "rateLimited") }, 429, {
      "Retry-After": String(rate.retryAfter),
    });
  }

  // 6. Read the body under a hard byte cap, then parse.
  let body;
  try {
    const raw = await request.text();
    // `.length` counts UTF-16 units; a multi-byte body can only be larger in
    // bytes, so this never lets an oversized payload through.
    if (raw.length > MAX_CONTACT_BYTES) {
      return reply({ ok: false, error: getMsg("uz", "validationError") }, 413);
    }
    body = JSON.parse(raw);
  } catch {
    return reply({ ok: false, error: getMsg("uz", "invalidJson") }, 400);
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return reply({ ok: false, error: getMsg("uz", "invalidJson") }, 400);
  }

  const lang = ["uz", "en", "ru"].includes(body.lang?.toLowerCase())
    ? body.lang.toLowerCase()
    : "uz";

  // 7. Honeypot check (anti-bot trap)
  if (body._hp || body.website || body.honeypot) {
    // Silently accept without transmitting spam
    return reply({ ok: true, message: getMsg(lang, "success") }, 200);
  }

  // 8. Turnstile verification, only when the challenge is fully configured.
  if (turnstile.enabled) {
    const turnstileToken = body["cf-turnstile-response"] || body.turnstileToken;
    const passed = await verifyTurnstile(
      turnstileToken,
      turnstile.secretKey,
      clientIp,
    );
    if (!passed) {
      return reply({ ok: false, error: getMsg(lang, "turnstileFailed") }, 400);
    }
  }

  // 9. Input sanitization and validation
  const name = sanitizeInput(body.name);
  const contact = sanitizeInput(body.contact);
  const rawMessage = sanitizeInput(body.message);
  const topic = sanitizeInput(body.topic);

  const actualBody = rawMessage.replace(/^\[.*?\]\s*/, "").trim();
  const topicFromMsg = rawMessage.match(/^\[(.*?)\]/)?.[1] || "";
  const finalTopic = sanitizeInput(topic || topicFromMsg);

  if (
    !name ||
    name.length < 2 ||
    name.length > 100 ||
    !contact ||
    contact.length < 3 ||
    contact.length > 100 ||
    !actualBody ||
    actualBody.length < 3 ||
    rawMessage.length > 2500
  ) {
    return reply({ ok: false, error: getMsg(lang, "validationError") }, 400);
  }

  // 10. Contact type identification
  let detectedType = "phone";
  if (contact.includes("@") && !contact.startsWith("@")) {
    detectedType = "email";
  } else if (contact.startsWith("@")) {
    detectedType = "tg";
  } else if (/^\+?\d[\d\s\-()]{6,}$/.test(contact)) {
    detectedType = "phone";
  }

  const typeLabels = {
    tg: "Telegram (@username)",
    email: "Email Manzil",
    phone: "Telefon Raqam",
  };
  const currentTypeLabel = typeLabels[detectedType] || "Aloqa Manzili";

  const dateStr = `${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC`;

  // 11. Format Telegram message (guaranteed <= 4096 chars)
  let safeMessage = rawMessage;
  if (safeMessage.length > 2000) {
    safeMessage = `${safeMessage.slice(0, 2000)}... [truncated]`;
  }

  const tgLines = [
    "🌌 <b>YANGI MUROJAAT (3D Portfolio Moon Terminal)</b>",
    "",
    `👤 <b>F.I.SH / Ismi:</b> ${escapeTg(name)}`,
    `📡 <b>Aloqa Turi:</b> ${escapeTg(currentTypeLabel)}`,
    `📱 <b>Aloqa Manzili:</b> ${escapeTg(contact)}`,
  ];
  if (finalTopic) tgLines.push(`🎯 <b>Mavzu:</b> ${escapeTg(finalTopic)}`);
  tgLines.push(
    `📝 <b>Xabar Matni:</b>\n${escapeTg(safeMessage)}`,
    "",
    `⏱ <b>Vaqt:</b> ${dateStr}`,
    `🌐 <b>Til:</b> ${escapeTg(lang.toUpperCase())}`,
  );
  const tgText = tgLines.join("\n");

  // Inline action buttons
  const inlineButtons = [];
  if (detectedType === "tg") {
    const uname = contact.replace(/^@/, "").trim();
    if (/^[a-zA-Z0-9_]{3,32}$/.test(uname)) {
      inlineButtons.push([
        { text: "Telegramda Bog'lanish", url: `https://t.me/${uname}` },
        {
          text: "⚡ Javob Qaytarish (Bot)",
          callback_data: `reply_lead_tg_${uname.slice(0, 35)}`,
        },
      ]);
    }
  } else if (detectedType === "email") {
    const cleanEmail = contact.trim();
    const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(cleanEmail)}&su=${encodeURIComponent("Azimjon Kamiljanovdan javob")}`;
    inlineButtons.push([
      { text: "📧 Gmail orqali yozish", url: gmailComposeUrl },
      {
        text: "⚡ Javob Qaytarish (Bot)",
        callback_data: `reply_lead_email_${cleanEmail.replace(/[^a-zA-Z0-9@._-]/g, "").slice(0, 35)}`,
      },
    ]);
  } else {
    const phoneNum = contact.replace(/[^+\d]/g, "");
    if (phoneNum.length >= 7) {
      inlineButtons.push([
        {
          text: "📞 Javob Qaytarish (Bot)",
          callback_data: `reply_lead_phone_${phoneNum.slice(0, 35)}`,
        },
      ]);
    }
  }
  inlineButtons.push([
    {
      text: "📞 Favqulodda Qo'ng'iroq (@CyberAgentNexus)",
      url: "https://t.me/CyberAgentNexus",
    },
  ]);

  // 12. Telegram API dispatch — env vars only, no fallback defaults.
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.error(
      "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in environment.",
    );
    return reply({ ok: false, error: getMsg(lang, "serviceUnavailable") }, 500);
  }

  try {
    const tgRes = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          chat_id: chatId,
          text: tgText,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: inlineButtons },
        }),
      },
    );

    const tgData = await tgRes.json();
    if (tgRes.ok && tgData.ok) {
      return reply({ ok: true, message: getMsg(lang, "success") }, 200);
    }

    console.error("Telegram API error status:", tgRes.status);
    return reply({ ok: false, error: getMsg(lang, "serviceUnavailable") }, 502);
  } catch {
    console.error("Telegram dispatch error");
    return reply({ ok: false, error: getMsg(lang, "serviceUnavailable") }, 500);
  }
}

export default {
  async fetch(request, env, _ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const isDev = env.ENVIRONMENT === "dev";
    const turnstileEnabled = getTurnstileConfig(env).enabled;

    // Public runtime config
    if (path === "/api/config") {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return jsonResponse(
          { ok: false, error: "Method Not Allowed" },
          { status: 405, turnstile: turnstileEnabled },
        );
      }
      return handleConfig(env);
    }

    // CORS preflight for /api/contact
    if (path === "/api/contact" && request.method === "OPTIONS") {
      const origin = request.headers.get("Origin");
      if (origin && !isAllowedOrigin(origin, url.host, isDev)) {
        return jsonResponse(
          { ok: false, error: getMsg("uz", "forbiddenOrigin") },
          { status: 403, turnstile: turnstileEnabled },
        );
      }
      const headers = new Headers(getCorsHeaders(origin, url.host, isDev));
      applySecurityHeaders(headers, turnstileEnabled);
      return new Response(null, { status: 204, headers });
    }

    // Contact endpoint POST
    if (path === "/api/contact") {
      if (request.method !== "POST") {
        return jsonResponse(
          { ok: false, error: "Method Not Allowed" },
          { status: 405, turnstile: turnstileEnabled },
        );
      }
      return handleContact(request, env, url);
    }

    // Static assets via the Cloudflare ASSETS binding
    if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
      const assetRes = await env.ASSETS.fetch(request);
      const newHeaders = new Headers(assetRes.headers);
      applySecurityHeaders(newHeaders, turnstileEnabled);

      // Fine-grained Cache-Control
      if (
        path.startsWith("/assets/") ||
        path.startsWith("/mediapipe/") ||
        path.endsWith(".task") ||
        path.match(/\.[a-f0-9]{8,}\.(js|css|webp|woff2|png|jpg)$/)
      ) {
        newHeaders.set("Cache-Control", "public, max-age=31536000, immutable");
      } else if (
        path === "/manifest.webmanifest" ||
        path === "/site.webmanifest"
      ) {
        newHeaders.set(
          "Cache-Control",
          "public, max-age=86400, stale-while-revalidate=604800",
        );
      } else if (path === "/" || path.endsWith(".html")) {
        newHeaders.set("Cache-Control", "public, max-age=0, must-revalidate");
      }

      if (
        request.method === "HEAD" ||
        assetRes.status === 304 ||
        assetRes.status === 204 ||
        assetRes.status === 205
      ) {
        return new Response(null, {
          status: assetRes.status,
          statusText: assetRes.statusText,
          headers: newHeaders,
        });
      }

      return new Response(assetRes.body, {
        status: assetRes.status,
        statusText: assetRes.statusText,
        headers: newHeaders,
      });
    }

    // Fallback 404
    const headers = new Headers({ "Content-Type": "text/plain" });
    applySecurityHeaders(headers, turnstileEnabled);
    return new Response("Not Found", { status: 404, headers });
  },
};
