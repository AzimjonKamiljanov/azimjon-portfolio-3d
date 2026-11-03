import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../worker.js';

describe('Cloudflare Worker Security & API Unit Tests', () => {
    let mockEnv;

    beforeEach(() => {
        mockEnv = {
            TELEGRAM_BOT_TOKEN: 'mock_token_12345',
            TELEGRAM_CHAT_ID: '987654321',
            ENVIRONMENT: 'dev'
        };
        vi.restoreAllMocks();
    });

    it('rejects disallowed Origin on OPTIONS preflight', async () => {
        const req = new Request('https://azimjon.dev/api/contact', {
            method: 'OPTIONS',
            headers: {
                'Origin': 'https://malicious-attacker.com'
            }
        });
        const res = await worker.fetch(req, { ...mockEnv, ENVIRONMENT: 'production' });
        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data.ok).toBe(false);
    });

    it('allows valid production Origin on OPTIONS preflight', async () => {
        const req = new Request('https://azimjon.dev/api/contact', {
            method: 'OPTIONS',
            headers: {
                'Origin': 'https://azimjon.dev'
            }
        });
        const res = await worker.fetch(req, { ...mockEnv, ENVIRONMENT: 'production' });
        expect(res.status).toBe(204);
        expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://azimjon.dev');
    });

    it('rejects POST with missing Content-Type (requires application/json)', async () => {
        const req = new Request('https://azimjon.dev/api/contact', {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
                'Origin': 'https://azimjon.dev'
            },
            body: 'plain text data'
        });
        const res = await worker.fetch(req, mockEnv);
        expect(res.status).toBe(415);
        const data = await res.json();
        expect(data.ok).toBe(false);
    });

    it('rejects payload exceeding 10KB size limit', async () => {
        const largeString = 'A'.repeat(12000);
        const req = new Request('https://azimjon.dev/api/contact', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': '12500',
                'Origin': 'https://azimjon.dev'
            },
            body: JSON.stringify({ message: largeString })
        });
        const res = await worker.fetch(req, mockEnv);
        expect(res.status).toBe(413);
        const data = await res.json();
        expect(data.ok).toBe(false);
    });

    it('silently accepts and drops honeypot spam requests', async () => {
        const req = new Request('https://azimjon.dev/api/contact', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'https://azimjon.dev'
            },
            body: JSON.stringify({
                name: 'Spam Bot',
                contact: 'spam@bot.com',
                message: 'Buy cheap watches',
                website: 'https://spam.com' // Honeypot field
            })
        });
        const res = await worker.fetch(req, mockEnv);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.ok).toBe(true);
    });

    it('fails with 400 when required fields are missing', async () => {
        const req = new Request('https://azimjon.dev/api/contact', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'https://azimjon.dev'
            },
            body: JSON.stringify({
                name: 'A', // Too short (< 2)
                contact: '',
                message: ''
            })
        });
        const res = await worker.fetch(req, mockEnv);
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.ok).toBe(false);
    });

    it('fails safely with 500 when Telegram environment variables are missing', async () => {
        const req = new Request('https://azimjon.dev/api/contact', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'https://azimjon.dev'
            },
            body: JSON.stringify({
                name: 'Azimjon',
                contact: '@AzimjonKamiljanov',
                message: 'Salom, yangi loyiha bor'
            })
        });
        // Empty environment
        const res = await worker.fetch(req, { ENVIRONMENT: 'production' });
        expect(res.status).toBe(500);
        const data = await res.json();
        expect(data.ok).toBe(false);
        // Ensure no internal tokens or secrets leaked
        expect(JSON.stringify(data)).not.toContain('TELEGRAM');
    });

    it('successfully dispatches valid message to Telegram and applies security headers', async () => {
        // Mock global fetch for Telegram API call
        const originalFetch = globalThis.fetch;
        globalThis.fetch = vi.fn().mockImplementation((url, options) => {
            if (url.toString().includes('api.telegram.org')) {
                return Promise.resolve(new Response(JSON.stringify({ ok: true, result: {} }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                }));
            }
            return originalFetch(url, options);
        });

        try {
            const req = new Request('https://azimjon.dev/api/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Origin': 'https://azimjon.dev'
                },
                body: JSON.stringify({
                    name: 'Kamiljanov',
                    contact: 'azimjon@example.com',
                    message: 'Salom, portfolio ajoyib!',
                    lang: 'uz'
                })
            });

            const res = await worker.fetch(req, mockEnv);
            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.ok).toBe(true);

            // Verify security headers
            expect(res.headers.get('Strict-Transport-Security')).toContain('max-age=63072000');
            expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
            expect(res.headers.get('X-Frame-Options')).toBe('DENY');
            expect(res.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
            expect(res.headers.get('Cross-Origin-Resource-Policy')).toBe('same-origin');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    it('enforces Cloudflare Rate Limiting binding when env.RATE_LIMITER rejects request', async () => {
        const rateLimitEnv = {
            ...mockEnv,
            RATE_LIMITER: {
                limit: vi.fn().mockResolvedValue({ success: false })
            }
        };
        const req = new Request('https://azimjon.dev/api/contact', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Origin': 'https://azimjon.dev',
                'CF-Connecting-IP': '198.51.100.42'
            },
            body: JSON.stringify({
                name: 'Rate Limit Test',
                contact: '@ratelimit',
                message: 'Testing rate limit binding'
            })
        });
        const res = await worker.fetch(req, rateLimitEnv);
        expect(res.status).toBe(429);
        const data = await res.json();
        expect(data.ok).toBe(false);
        expect(res.headers.get('Retry-After')).toBe('60');
    });
});
