/**
 * Cloudflare Worker for Azimjon Kamiljanov 3D Portfolio
 * Handles static assets with strict enterprise security headers (CSP, HSTS, etc.)
 * and secure Telegram contact form transmission with rate limiting and sanitization.
 */

const SECURITY_HEADERS = {
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(), payment=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://unpkg.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://*.jsdelivr.net blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; media-src 'self' blob: data:; connect-src 'self' https://cdn.jsdelivr.net https://*.jsdelivr.net https://unpkg.com https://fonts.googleapis.com https://fonts.gstatic.com; worker-src 'self' blob: https://cdn.jsdelivr.net https://*.jsdelivr.net; child-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none';"
};

function applySecurityHeaders(headers) {
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
        headers.set(key, value);
    }
}

const ALLOWED_ORIGINS = new Set([
    'https://azimjon.dev',
    'https://www.azimjon.dev',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
    'http://localhost:8787',
    'http://127.0.0.1:8787'
]);

function isAllowedOrigin(origin, host) {
    if (!origin) return true; // Direct/same-origin navigation or internal call
    if (ALLOWED_ORIGINS.has(origin)) return true;
    try {
        const parsed = new URL(origin);
        if (host && parsed.host === host) return true;
        if (parsed.hostname === 'azimjon.dev' || parsed.hostname.endsWith('.azimjon.dev')) return true;
        if (parsed.hostname.endsWith('.workers.dev') || parsed.hostname.endsWith('.pages.dev')) return true;
    } catch (_) {}
    return false;
}

function getCorsHeaders(origin, host) {
    const headers = {
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
    };
    if (origin && isAllowedOrigin(origin, host)) {
        headers['Access-Control-Allow-Origin'] = origin;
    }
    return headers;
}

// In-memory Rate Limiting (sliding window per isolate)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 60 seconds
const MAX_REQUESTS_PER_WINDOW = 5;

function checkRateLimit(ip) {
    // Exempt local development / automated CDP test runner
    if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
        return { allowed: true, remaining: 999 };
    }

    const now = Date.now();
    // Prune stale entries if map grows
    if (rateLimitMap.size > 5000) {
        for (const [key, data] of rateLimitMap.entries()) {
            if (now - data.firstReq > RATE_LIMIT_WINDOW_MS) {
                rateLimitMap.delete(key);
            }
        }
    }

    const record = rateLimitMap.get(ip);
    if (!record || (now - record.firstReq > RATE_LIMIT_WINDOW_MS)) {
        rateLimitMap.set(ip, { count: 1, firstReq: now });
        return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1 };
    }

    if (record.count >= MAX_REQUESTS_PER_WINDOW) {
        const retryAfter = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - record.firstReq)) / 1000);
        return { allowed: false, retryAfter: Math.max(1, retryAfter) };
    }

    record.count++;
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - record.count };
}

// Strict Telegram HTML Sanitization
function escapeTg(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

async function handleContact(request, env, url) {
    const origin = request.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin, url.host);

    // 1. Origin verification
    if (origin && !isAllowedOrigin(origin, url.host)) {
        const headers = new Headers({ 'Content-Type': 'application/json', 'Vary': 'Origin' });
        applySecurityHeaders(headers);
        return new Response(JSON.stringify({ ok: false, error: 'Taqiqlangan manba (Forbidden origin).' }), {
            status: 403,
            headers
        });
    }

    // 2. IP Rate Limiting
    const clientIp = request.headers.get('cf-connecting-ip') ||
                     request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     '127.0.0.1';

    const rate = checkRateLimit(clientIp);
    if (!rate.allowed) {
        const headers = new Headers({
            'Content-Type': 'application/json',
            'Retry-After': String(rate.retryAfter),
            ...corsHeaders
        });
        applySecurityHeaders(headers);
        return new Response(JSON.stringify({
            ok: false,
            error: 'Juda koʻp soʻrov yuborildi. Iltimos, bir oz kuting (Too many requests).'
        }), {
            status: 429,
            headers
        });
    }

    // 3. JSON payload parsing
    let body;
    try {
        body = await request.json();
    } catch (_) {
        const headers = new Headers({ 'Content-Type': 'application/json', ...corsHeaders });
        applySecurityHeaders(headers);
        return new Response(JSON.stringify({ ok: false, error: 'Yaroqsiz JSON formati (Invalid JSON).' }), {
            status: 400,
            headers
        });
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const contact = typeof body.contact === 'string' ? body.contact.trim() : '';
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const lang = typeof body.lang === 'string' ? body.lang.trim().toLowerCase() : 'uz';
    const topic = typeof body.topic === 'string' ? body.topic.trim() : '';

    const actualBody = message.replace(/^\[.*?\]\s*/, '').trim();
    const topicFromMsg = message.match(/^\[(.*?)\]/)?.[1] || '';
    const finalTopic = topic || topicFromMsg;

    // 4. Input validation
    if (!name || name.length < 2 || name.length > 100 ||
        !contact || contact.length < 3 || contact.length > 100 ||
        !actualBody || actualBody.length < 3 || message.length > 3000) {
        const headers = new Headers({ 'Content-Type': 'application/json', ...corsHeaders });
        applySecurityHeaders(headers);
        return new Response(JSON.stringify({
            ok: false,
            error: 'Barcha maydonlarni toʻgʻri toʻldiring (Validation error).'
        }), {
            status: 400,
            headers
        });
    }

    // 5. Contact type identification
    let detectedType = 'phone';
    if (contact.includes('@') && !contact.startsWith('@')) {
        detectedType = 'email';
    } else if (contact.startsWith('@')) {
        detectedType = 'tg';
    } else if (/^\+?\d[\d\s\-\(\)]{6,}$/.test(contact)) {
        detectedType = 'phone';
    }

    const typeLabels = {
        tg: 'Telegram (@username)',
        email: 'Email Manzil',
        phone: 'Telefon Raqam'
    };
    const currentTypeLabel = typeLabels[detectedType] || 'Aloqa Manzili';

    const now = new Date();
    const dateStr = now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    const langStr = lang.toUpperCase();

    // 6. Formatted Telegram text with strict HTML escaping
    const tgText = `🌌 <b>YANGI MUROJAAT (3D Portfolio Moon Terminal)</b>\n\n` +
        `👤 <b>F.I.SH / Ismi:</b> ${escapeTg(name)}\n` +
        `📡 <b>Aloqa Turi:</b> ${escapeTg(currentTypeLabel)}\n` +
        `📱 <b>Aloqa Manzili:</b> ${escapeTg(contact)}\n` +
        (finalTopic ? `🎯 <b>Mavzu:</b> ${escapeTg(finalTopic)}\n` : '') +
        `📝 <b>Xabar Matni:</b>\n${escapeTg(message)}\n\n` +
        `⏱ <b>Vaqt:</b> ${dateStr}\n` +
        `🌐 <b>Til:</b> ${escapeTg(langStr)}`;

    // Inline reply action buttons
    const inlineButtons = [];
    if (detectedType === 'tg') {
        const uname = contact.replace(/^@/, '').trim();
        if (/^[a-zA-Z0-9_]{3,32}$/.test(uname)) {
            inlineButtons.push([
                { text: "Telegramda Bog'lanish", url: `https://t.me/${uname}` },
                { text: "⚡ Javob Qaytarish (Bot)", callback_data: `reply_lead_tg_${uname.slice(0, 35)}` }
            ]);
        }
    } else if (detectedType === 'email') {
        const cleanEmail = contact.trim();
        const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(cleanEmail)}&su=${encodeURIComponent("Azimjon Kamiljanovdan javob")}`;
        inlineButtons.push([
            { text: "📧 Gmail orqali yozish", url: gmailComposeUrl },
            { text: "⚡ Javob Qaytarish (Bot)", callback_data: `reply_lead_email_${cleanEmail.replace(/[^a-zA-Z0-9@._-]/g, '').slice(0, 35)}` }
        ]);
    } else {
        const phoneNum = contact.replace(/[^+\d]/g, '');
        if (phoneNum.length >= 7) {
            inlineButtons.push([
                { text: "📞 Javob Qaytarish (Bot)", callback_data: `reply_lead_phone_${phoneNum.slice(0, 35)}` }
            ]);
        }
    }
    inlineButtons.push([
        { text: "📞 Favqulodda Qo'ng'iroq (@CyberAgentNexus)", url: "https://t.me/CyberAgentNexus" }
    ]);

    // 7. Safe Telegram Bot API delivery
    const botToken = env.TELEGRAM_BOT_TOKEN || '8271458811:AAGlJ04RXOMKnDRbQGkrGVek0jeIFDFmjwg';
    const chatId = env.TELEGRAM_CHAT_ID || 8048940366;

    try {
        const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
                chat_id: chatId,
                text: tgText,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: inlineButtons
                }
            })
        });

        const tgData = await tgRes.json();
        if (tgRes.ok && tgData.ok) {
            const headers = new Headers({ 'Content-Type': 'application/json', ...corsHeaders });
            applySecurityHeaders(headers);
            return new Response(JSON.stringify({ ok: true, message: 'Xabar muvaffaqiyatli yuborildi.' }), {
                status: 200,
                headers
            });
        } else {
            console.error('Telegram API error:', tgData);
            const headers = new Headers({ 'Content-Type': 'application/json', ...corsHeaders });
            applySecurityHeaders(headers);
            return new Response(JSON.stringify({
                ok: false,
                error: tgData.description || 'Telegram xabari yuborilmadi.'
            }), {
                status: 502,
                headers
            });
        }
    } catch (err) {
        console.error('Telegram dispatch failed:', err);
        const headers = new Headers({ 'Content-Type': 'application/json', ...corsHeaders });
        applySecurityHeaders(headers);
        return new Response(JSON.stringify({ ok: false, error: 'Telegram serveriga ulanishda xatolik yuz berdi.' }), {
            status: 500,
            headers
        });
    }
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;

        // CORS preflight for /api/contact
        if (path === '/api/contact' && request.method === 'OPTIONS') {
            const origin = request.headers.get('Origin');
            if (origin && !isAllowedOrigin(origin, url.host)) {
                const headers = new Headers({ 'Content-Type': 'application/json', 'Vary': 'Origin' });
                applySecurityHeaders(headers);
                return new Response(JSON.stringify({ ok: false, error: 'Taqiqlangan manba (Forbidden origin).' }), {
                    status: 403,
                    headers
                });
            }
            const headers = new Headers(getCorsHeaders(origin, url.host));
            applySecurityHeaders(headers);
            return new Response(null, { status: 204, headers });
        }

        // Contact endpoint POST
        if (path === '/api/contact') {
            if (request.method !== 'POST') {
                const headers = new Headers({ 'Content-Type': 'application/json' });
                applySecurityHeaders(headers);
                return new Response(JSON.stringify({ ok: false, error: 'Method Not Allowed' }), {
                    status: 405,
                    headers
                });
            }
            return handleContact(request, env, url);
        }

        // Static Assets handling via Cloudflare binding
        if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
            const assetRes = await env.ASSETS.fetch(request);
            const newHeaders = new Headers(assetRes.headers);
            applySecurityHeaders(newHeaders);

            if (request.method === 'HEAD' || assetRes.status === 304 || assetRes.status === 204 || assetRes.status === 205) {
                return new Response(null, {
                    status: assetRes.status,
                    statusText: assetRes.statusText,
                    headers: newHeaders
                });
            }

            return new Response(assetRes.body, {
                status: assetRes.status,
                statusText: assetRes.statusText,
                headers: newHeaders
            });
        }

        // Fallback
        const headers = new Headers({ 'Content-Type': 'text/plain' });
        applySecurityHeaders(headers);
        return new Response('Not Found', { status: 404, headers });
    }
};
