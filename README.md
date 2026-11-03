# 🪐 3D Solar System Developer Portfolio

> **Azimjon Kamiljanov** — AI & Full-Stack Developer (Student)  
> 🎓 2nd-year AI Student at **PDP University** • Cybersecurity Student at **School 21 Tashkent**  
> 🌐 **Live Site:** [https://azimjon.dev](https://azimjon.dev)

![3D Solar System Developer Portfolio](docs/screenshots/desktop_overview_clean.png)

---

## 🌌 Overview

An interactive, high-performance 3D WebGL Solar System portfolio showcasing AI ecosystems, software architectures, and cybersecurity tooling. Powered by Three.js and deployed globally on Cloudflare Workers with strict Content Security Policy (CSP), zero external CDNs, self-hosted assets, and automated end-to-end verification.

---

## ✨ Key Features

- **☀️ Photorealistic Convective Sun:** NASA SDO AIA photosphere, 3D simplex domain-warped procedural boiling lava core, dynamic solar prominence arches, and soft coronal streamers.
- **🪐 All 9 Concentric Planetary Portals:** Mercury, Venus, Earth + Moon, Mars, Jupiter, Saturn (with rings), Uranus (with rings at 97.8° axial tilt), Neptune, and Pluto orbiting collision-free with authentic Keplerian mechanics.
- **🛸 1,450+ Instanced Asteroid Belt:** Procedurally distributed rocky asteroid ring between Mars and Jupiter rendered via Three.js `InstancedMesh` at a locked 60 FPS.
- **🤖 Computer Vision Gesture Control:** Powered by self-hosted Google MediaPipe Hands. Navigate the cosmos using hand gestures through your webcam (Open Palm to Orbit, Pointing for Crosshair Reticle, Pinch to Zoom/Select, Fist to Freeze). Lazy-loaded on demand with an explicit user privacy consent modal.
- **🎬 Cinematic Autopilot Tour Mode:** Smooth Bézier camera transitions guiding visitors sequentially through the Sun, all 9 planets, and lunar satellite with floating telemetry HUD and playback controls.
- **💬 Direct Contact Terminal (The Moon):** In-scene cyber terminal enabling visitors to transmit messages directly to Azimjon's Telegram Bot (`@CyberAgent0bot`) with anti-spam honeypot protection, Turnstile validation, and localized feedback.
- **📄 Clean PDF Resume / CV Download:** Instant high-resolution resume access directly from the header and Sun modal without browser print headers or footers.
- **🌐 Trilingual Engine:** Full live language switching across Uzbek (UZ), English (EN), and Russian (RU) with 100% state retention.
- **📱 Responsive & Liquid Glass UI:** Frosted glass HUD docks, 0px horizontal overflow across all viewports from 375px mobile screens to 4K displays.
- **🔍 SEO & Prerendered Catalog:** Pre-rendered semantic HTML fallback for search engines and screen readers; instant debounced search across all 28 catalog items.

---

## 🛠️ Technology Stack

- **Frontend & 3D:** [Three.js](https://threejs.org/) (r186), WebGL, Custom GLSL Shaders, EffectComposer, UnrealBloomPass, [GSAP](https://greensock.com/gsap/).
- **Build System:** [Vite 6](https://vitejs.dev/) with vanilla ES modules, code splitting, and tree shaking.
- **Deployment & Serverless:** [Cloudflare Workers](https://workers.cloudflare.com/) (`worker.js`) serving static assets from `./dist` with strict security headers.
- **Typography:** Self-hosted [`@fontsource`](https://fontsource.org/) (Inter, Plus Jakarta Sans, JetBrains Mono).
- **Vision:** Self-hosted Google MediaPipe Hands (WASM + TFLite models).
- **Audio:** Web Audio API Procedural Synthesizer & 64 kbps ambient soundscape.
- **Testing:** [Vitest](https://vitest.dev/) (unit tests) & [Playwright](https://playwright.dev/) (browser E2E acceptance tests).
- **Code Quality:** ESLint v10, Prettier, GitHub Actions CI.

---

## 📁 Repository Structure

```
├── .github/workflows/       # GitHub Actions automated CI pipeline
├── docs/screenshots/        # Verification and portfolio screenshots
├── public/                  # Static assets (favicons, manifests, MediaPipe WASM, WebP textures)
├── scripts/                 # Offline build utilities (texture generators, resume PDF, prerender)
├── src/
│   ├── audio/               # Web Audio API procedural soundscape
│   ├── bodies/              # 3D bodies: Sun, 9 planets, asteroid belt, stars, cosmic objects
│   ├── data/                # Single source of truth: profile.json, projects.json
│   ├── i18n/                # Trilingual dictionary and dynamic language switcher
│   ├── input/               # OrbitControls, camera Bézier transitions, raycaster, gestures
│   ├── scene/               # Canvas, camera, renderer with DPR clamp, bloom postprocessing
│   ├── ui/                  # HUD docks, focus-trapped modals, catalog, tour, Moon terminal
│   ├── errors.js            # Centralized client-side error telemetry
│   └── main.js              # Application entry point
├── tests/                   # Vitest unit tests and Playwright E2E test suite
├── worker.js                # Hardened Cloudflare Worker backend (/api/contact)
├── wrangler.jsonc           # Cloudflare Worker configuration (serving ./dist)
├── vite.config.js           # Vite 6 configuration with manual chunking
└── vitest.config.js         # Vitest test configuration
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 20.0.0
- npm ≥ 10.0.0

### Installation & Development
```bash
# Clone repository
git clone https://github.com/AzimjonKamiljanov/azimjon-portfolio-3d.git
cd azimjon-portfolio-3d

# Install dependencies
npm install

# Start local development server (http://localhost:8080)
npm run dev
```

### Production Build & Preview
```bash
# Build production bundle into dist/
npm run build

# Preview production build locally
npm run preview
```

### Automated Testing & Linting
```bash
# Run unit tests (Vitest)
npm test

# Run browser E2E acceptance tests (Playwright)
npm run test:e2e

# Run linter
npm run lint

# Check code formatting
npm run format:check
```

---

## 🔐 Environment Variables & Deployment

Create a `.dev.vars` file for local Worker testing (see `.dev.vars.example`):

```bash
TELEGRAM_BOT_TOKEN="your_bot_token_here"
TELEGRAM_CHAT_ID="your_telegram_chat_id"
TURNSTILE_SECRET_KEY="optional_turnstile_secret_key"
ENVIRONMENT="dev"
```

To configure secrets in Cloudflare Workers and deploy:

```bash
# Set production secrets
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_CHAT_ID
npx wrangler secret put TURNSTILE_SECRET_KEY

# Deploy to Cloudflare
npm run deploy
```

---

## 📊 Measured Performance

Tested on Google Chrome (Linux x86_64) via Chrome DevTools Protocol & Lighthouse v12:

- **Frame Rate:** 60.01 FPS (16.66 ms average frame time)
- **Asset Size:** 2.7 MB total textures and audio (WebP compressed, -64.9% vs original)
- **Lighthouse Desktop:** Performance: **87**, Accessibility: **100**, Best Practices: **100**, SEO: **100**
- **Lighthouse Mobile:** Performance: **44**, Accessibility: **95**, Best Practices: **100**, SEO: **100**
- **Console Errors:** 0 unhandled exceptions across desktop and mobile devices.

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.  
Created with ❤️ by **Azimjon Kamiljanov**.
