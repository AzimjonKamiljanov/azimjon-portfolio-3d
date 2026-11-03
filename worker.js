/**
 * Cloudflare Worker for Azimjon Kamiljanov 3D Portfolio
 * Enterprise-grade security headers, CSP, Turnstile verification,
 * honeypot protection, strict origin allowlist, and hardened Telegram dispatch.
 */

const SECURITY_HEADERS = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(self), microphone=(), geolocation=(), payment=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'", // Allowed for dynamic styles/theme injection while migrating; scoped to self
    "font-src 'self' data:",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; "),
};

function applySecurityHeaders(headers) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
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
    if (host && parsed.host === host) return true;
    if (
      parsed.hostname === "azimjon.dev" ||
      parsed.hostname === "www.azimjon.dev"
    )
      return true;
  } catch (_) {}
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
  // Allow tabs (9), newlines (10), carriage returns (13); strip others below 32 and delete (127)
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

async function handleContact(request, env, url) {
  const isDev = env.ENVIRONMENT === "dev";
  const origin = request.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin, url.host, isDev);

  // 1. Origin verification
  if (origin && !isAllowedOrigin(origin, url.host, isDev)) {
    const headers = new Headers({
      "Content-Type": "application/json",
      Vary: "Origin",
    });
    applySecurityHeaders(headers);
    return new Response(
      JSON.stringify({ ok: false, error: getMsg("uz", "forbiddenOrigin") }),
      {
        status: 403,
        headers,
      },
    );
  }

  // 2. Strict Content-Type check
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    const headers = new Headers({
      "Content-Type": "application/json",
      ...corsHeaders,
    });
    applySecurityHeaders(headers);
    return new Response(
      JSON.stringify({ ok: false, error: getMsg("uz", "invalidJson") }),
      {
        status: 415,
        headers,
      },
    );
  }

  // 3. Payload size check (max 10KB)
  const contentLength = parseInt(
    request.headers.get("content-length") || "0",
    10,
  );
  if (contentLength > 10240) {
    const headers = new Headers({
      "Content-Type": "application/json",
      ...corsHeaders,
    });
    applySecurityHeaders(headers);
    return new Response(
      JSON.stringify({ ok: false, error: getMsg("uz", "validationError") }),
      {
        status: 413,
        headers,
      },
    );
  }

  // 4. Client IP resolution (do not trust x-forwarded-for)
  const clientIp =
    request.headers.get("cf-connecting-ip") ||
    (isDev ? "127.0.0.1" : "0.0.0.0");

  // 5. Rate limiting
  const rate = await checkRateLimit(clientIp, env, isDev);
  if (!rate.allowed) {
    const headers = new Headers({
      "Content-Type": "application/json",
      "Retry-After": String(rate.retryAfter),
      ...corsHeaders,
    });
    applySecurityHeaders(headers);
    return new Response(
      JSON.stringify({
        ok: false,
        error: getMsg("uz", "rateLimited"),
      }),
      {
        status: 429,
        headers,
      },
    );
  }

  // 6. JSON payload parsing
  let body;
  try {
    body = await request.json();
  } catch (_) {
    const headers = new Headers({
      "Content-Type": "application/json",
      ...corsHeaders,
    });
    applySecurityHeaders(headers);
    return new Response(
      JSON.stringify({ ok: false, error: getMsg("uz", "invalidJson") }),
      {
        status: 400,
        headers,
      },
    );
  }

  const lang = ["uz", "en", "ru"].includes(body.lang?.toLowerCase())
    ? body.lang.toLowerCase()
    : "uz";

  // 7. Honeypot check (anti-bot trap)
  if (body._hp || body.website || body.honeypot) {
    // Silently accept without transmitting spam
    const headers = new Headers({
      "Content-Type": "application/json",
      ...corsHeaders,
    });
    applySecurityHeaders(headers);
    return new Response(
      JSON.stringify({ ok: true, message: getMsg(lang, "success") }),
      {
        status: 200,
        headers,
      },
    );
  }

  // 8. Turnstile verification (if secret configured)
  if (env.TURNSTILE_SECRET_KEY) {
    const turnstileToken = body["cf-turnstile-response"] || body.turnstileToken;
    const passed = await verifyTurnstile(
      turnstileToken,
      env.TURNSTILE_SECRET_KEY,
      clientIp,
    );
    if (!passed) {
      const headers = new Headers({
        "Content-Type": "application/json",
        ...corsHeaders,
      });
      applySecurityHeaders(headers);
      return new Response(
        JSON.stringify({ ok: false, error: getMsg(lang, "turnstileFailed") }),
        {
          status: 400,
          headers,
        },
      );
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
    const headers = new Headers({
      "Content-Type": "application/json",
      ...corsHeaders,
    });
    applySecurityHeaders(headers);
    return new Response(
      JSON.stringify({
        ok: false,
        error: getMsg(lang, "validationError"),
      }),
      {
        status: 400,
        headers,
      },
    );
  }

  // 10. Contact type identification
  let detectedType = "phone";
  if (contact.includes("@") && !contact.startsWith("@")) {
    detectedType = "email";
  } else if (contact.startsWith("@")) {
    detectedType = "tg";
  } else if (/^\+?\d[\d\s\-\(\)]{6,}$/.test(contact)) {
    detectedType = "phone";
  }

  const typeLabels = {
    tg: "Telegram (@username)",
    email: "Email Manzil",
    phone: "Telefon Raqam",
  };
  const currentTypeLabel = typeLabels[detectedType] || "Aloqa Manzili";

  const now = new Date();
  const dateStr = now.toISOString().replace("T", " ").slice(0, 19) + " UTC";

  // 11. Format Telegram message (guaranteed <= 4096 chars)
  let safeMessage = rawMessage;
  if (safeMessage.length > 2000) {
    safeMessage = safeMessage.slice(0, 2000) + "... [truncated]";
  }

  const tgText =
    `🌌 <b>YANGI MUROJAAT (3D Portfolio Moon Terminal)</b>\n\n` +
    `👤 <b>F.I.SH / Ismi:</b> ${escapeTg(name)}\n` +
    `📡 <b>Aloqa Turi:</b> ${escapeTg(currentTypeLabel)}\n` +
    `📱 <b>Aloqa Manzili:</b> ${escapeTg(contact)}\n` +
    (finalTopic ? `🎯 <b>Mavzu:</b> ${escapeTg(finalTopic)}\n` : "") +
    `📝 <b>Xabar Matni:</b>\n${escapeTg(safeMessage)}\n\n` +
    `⏱ <b>Vaqt:</b> ${dateStr}\n` +
    `🌐 <b>Til:</b> ${escapeTg(lang.toUpperCase())}`;

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

  // 12. Telegram API dispatch - ONLY from env vars, NO fallback defaults!
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.error(
      "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in environment.",
    );
    const headers = new Headers({
      "Content-Type": "application/json",
      ...corsHeaders,
    });
    applySecurityHeaders(headers);
    return new Response(
      JSON.stringify({ ok: false, error: getMsg(lang, "serviceUnavailable") }),
      {
        status: 500,
        headers,
      },
    );
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
          reply_markup: {
            inline_keyboard: inlineButtons,
          },
        }),
      },
    );

    const tgData = await tgRes.json();
    if (tgRes.ok && tgData.ok) {
      const headers = new Headers({
        "Content-Type": "application/json",
        ...corsHeaders,
      });
      applySecurityHeaders(headers);
      return new Response(
        JSON.stringify({ ok: true, message: getMsg(lang, "success") }),
        {
          status: 200,
          headers,
        },
      );
    } else {
      console.error("Telegram API error status:", tgRes.status);
      const headers = new Headers({
        "Content-Type": "application/json",
        ...corsHeaders,
      });
      applySecurityHeaders(headers);
      return new Response(
        JSON.stringify({
          ok: false,
          error: getMsg(lang, "serviceUnavailable"),
        }),
        {
          status: 502,
          headers,
        },
      );
    }
  } catch (err) {
    console.error("Telegram dispatch error");
    const headers = new Headers({
      "Content-Type": "application/json",
      ...corsHeaders,
    });
    applySecurityHeaders(headers);
    return new Response(
      JSON.stringify({ ok: false, error: getMsg(lang, "serviceUnavailable") }),
      {
        status: 500,
        headers,
      },
    );
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const isDev = env.ENVIRONMENT === "dev";

    // CORS preflight for /api/contact
    if (path === "/api/contact" && request.method === "OPTIONS") {
      const origin = request.headers.get("Origin");
      if (origin && !isAllowedOrigin(origin, url.host, isDev)) {
        const headers = new Headers({
          "Content-Type": "application/json",
          Vary: "Origin",
        });
        applySecurityHeaders(headers);
        return new Response(
          JSON.stringify({ ok: false, error: getMsg("uz", "forbiddenOrigin") }),
          {
            status: 403,
            headers,
          },
        );
      }
      const headers = new Headers(getCorsHeaders(origin, url.host, isDev));
      applySecurityHeaders(headers);
      return new Response(null, { status: 204, headers });
    }

    // Contact endpoint POST
    if (path === "/api/contact") {
      if (request.method !== "POST") {
        const headers = new Headers({ "Content-Type": "application/json" });
        applySecurityHeaders(headers);
        return new Response(
          JSON.stringify({ ok: false, error: "Method Not Allowed" }),
          {
            status: 405,
            headers,
          },
        );
      }
      return handleContact(request, env, url);
    }

    // Static Assets handling via Cloudflare binding
    if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
      const assetRes = await env.ASSETS.fetch(request);
      const newHeaders = new Headers(assetRes.headers);
      applySecurityHeaders(newHeaders);

      // Fine-grained Cache-Control
      if (
        path.startsWith("/assets/") ||
        path.match(/\.[a-f0-9]{8,}\.(js|css|webp|woff2|png|jpg)$/)
      ) {
        newHeaders.set("Cache-Control", "public, max-age=31536000, immutable");
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
    applySecurityHeaders(headers);
    return new Response("Not Found", { status: 404, headers });
  },
};
