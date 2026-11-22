# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.1.0] - 2026-11-04

### Added

- **Photorealistic Deep Space Realism**:
  - Replaced procedural purple nebula with physically calibrated Milky Way galaxy band and galactic dust extinction rifts (mean sRGB of empty sky patch < 8/255 at 1920x1080).
  - AmbientLight calibrated to deep-space darkness (0.008 <= 0.01) with Sun PointLight inverse-square falloff (`decay = 2.0`).
  - ACESFilmicToneMapping calibrated with HalfFloatType HDR render target in `EffectComposer`.
  - UnrealBloomPass threshold set to 1.05 ensuring only HDR Sun photosphere glows while planetary bodies never bloom.
  - Earth day/night cycle with golden city lights on dark hemisphere, clouds layer, and Rayleigh atmospheric scattering rim.
  - Synchronous tidal lock for Moon (near side permanently facing Earth).
  - Saturn rings with high-res Cassini division and analytical soft spherical shadow projection.
  - Uranus tilted to true 97.8° with delicate ring system.
  - True Astronomical Scale toggle mode accessible via `window.__toggleTrueScale()`.
- **Hand Gesture Control via @mediapipe/tasks-vision**:
  - Migrated to self-hosted `@mediapipe/tasks-vision` HandLandmarker with GPU acceleration and CPU fallback.
  - Rotation-invariant joint angle classification, hand-scale normalization, One-Euro spatial filter, and 5-frame stabilizer with hysteresis.
  - Full gesture interaction set: 🖐 Palm (360° orbit / still overview), 👆 Point (holographic reticle raycast), 🤏 Pinch (select & zoom), ✊ Fist (freeze time), ✌️ Victory (autopilot tour), and 👐 Two-hand zoom.
  - Accurate Three.js Normalized Device Coordinate (NDC) mapping (`ndcX = (x / W) * 2 - 1`, `ndcY = -(y / H) * 2 + 1`) enabling precision pointing, hovering, and pinch-to-open on celestial bodies.
  - In-app privacy consent modal and real-time telemetry HUD displaying FPS, gesture badge, live video PIP, and skeletal wireframe overlay.
  - Test injection hooks `window.__gestureTest.inject` and `window.__feedGestureLandmarks`.
- **Minimal Cinematic Preloader & Onboarding Guide**:
  - Real `THREE.LoadingManager` with monotonic byte-weighted progress, phase progression labels, and 6-second fallback skip button.
  - Redesigned `.preloader-card` with fluid `width: min(92vw, 420px)`, typography >= 12px with `clamp()`, `<noscript>` warning banner, and WebGL failure error message.
  - Respect for `prefers-reduced-motion: reduce` skipping camera dive animation.
  - 8-step interactive onboarding guide with live gesture practice mode chips lighting up on recognition, hotkey support ('?', 'H', Space, Esc, 1-9), and trilingual support across UZ, EN, and RU.
  - Dedicated trilingual Credits Modal and `#credits-toggle-btn` linked with `ATTRIBUTIONS.md`.
- **Automated Zero-Overflow & Responsive Design**:
  - Removed all 17 rigid `white-space: nowrap !important;` rules from `style.css`.
  - Added ultra-compact mobile (320px) header wrapping and terminal header flex adaptations preventing horizontal overflow.
  - Added safe-area insets (`env(safe-area-inset-*)`), fluid typography with `clamp()`, and 44px touch targets.
  - Automated Playwright test suite (`tests/overflow.spec.js`) verifying zero horizontal scroll across 10 viewports (320px to 3840px) x 3 languages x all modal states.

### Changed

- **Cloudflare Rate Limiting & CI Workflow**:
  - Corrected `wrangler.jsonc` rate limiting syntax from `"binding"` to `"name": "RATE_LIMITER"` for full compatibility with Cloudflare Workers runtime.
  - Updated `.github/workflows/ci.yml` with triggers for `feat/**` branches and pull requests.
- **CSP & Markup Hardening**:
  - Extracted all inline styles from `index.html` fallback cards and SVGs into clean utility classes in `style.css`.
  - Added explicit Vitest check verifying zero inline `style=` attributes in `dist/index.html` under strict CSP (`style-src 'self'`).
  - Removed placeholder `contactEmail` from `src/data/profile.json` and documented owner choices in `REPORT.md`.

## [2.0.0] - 2026-11-04

### Added

- **Vite 6 Modern Build Pipeline**:
  - Vanilla ES Module setup with `npm run dev`, `npm run build`, `npm run preview`, `npm test`, `npm run test:e2e`, `npm run lint`, and `npm run format:check`.
  - Production code splitting with manual chunks for `three`, `gsap`, and application modules.
  - Hashed asset outputs, CSS extraction, minification, and tree-shaking.
- **Self-Hosted Assets & Zero External CDNs**:
  - Self-hosted fonts via `@fontsource/inter`, `@fontsource/plus-jakarta-sans`, and `@fontsource/jetbrains-mono`, eliminating render-blocking external Google Fonts / gstatic CDNs.
  - Self-hosted Google MediaPipe Hands WASM, SIMD, and TFLite model files in `public/mediapipe/hands/`.
  - Lazy-loaded gesture recognition module with explicit user consent/privacy dialog before activating webcam.
- **Strict Security & Worker Hardening**:
  - Production `worker.js` with zero fallback secrets; reads exclusively from `env.TELEGRAM_BOT_TOKEN` and `env.TELEGRAM_CHAT_ID`.
  - Honeypot anti-spam field (`_hp`) on contact form, returning generic rejection on bot auto-fill.
  - Cloudflare Turnstile CAPTCHA server-side validation support.
  - Strict Origin header verification: only `https://azimjon.dev` and `https://www.azimjon.dev` in production (and localhost when `env.ENVIRONMENT === 'dev'`), removing wildcard domains.
  - Enforced 10 KB body size cap, control character stripping, and safe Telegram HTML truncation (≤ 4096 characters).
  - Sanitized error responses preventing upstream Telegram Bot API error leakage.
  - CSP with zero `'unsafe-inline'` / `'unsafe-eval'`; added `form-action 'self'`, `upgrade-insecure-requests`, `Cross-Origin-Opener-Policy: same-origin`, and `Cross-Origin-Resource-Policy: same-origin`.
  - `.dev.vars.example` template added and `.dev.vars` added to `.gitignore`.
- **Modular Application Architecture**:
  - Split 6,200-line monolithic `main.js` into modular structure under `src/`:
    - `src/scene/setup.js` & `src/scene/postprocessing.js`: Canvas, camera, renderer with DPR clamp (≤ 2.0), procedural Milky Way skybox, and UnrealBloomPass.
    - `src/bodies/`: Sun (NASA SDO photosphere, prominences, coronal rays), 9 planets + rings, 1,450 instanced asteroids, stars, and cosmic objects.
    - `src/input/`: OrbitControls, Bézier camera transitions, pointer raycaster, and gesture recognition.
    - `src/audio/`: Web Audio API procedural synthesizer and space ambient soundscape.
    - `src/ui/`: Floating HUD, focus-trapped accessible modals, catalog with debounced live search, onboarding guide, tour controller, and Moon contact terminal.
    - `src/i18n/`: Trilingual engine (UZ, EN, RU) with persistent state and DOM updates.
    - `src/errors.js`: Runtime global error tracker and safe client-side telemetry.
- **Single Source of Truth**:
  - `src/data/profile.json`: Truthful developer background (PDP University 2nd-year AI student, School 21 Tashkent, languages: Uzbek Native, English B1, Russian A1).
  - `src/data/projects.json`: All 28 projects categorized with original author attributions and taxonomy tags.
  - `scripts/prerender_catalog.mjs`: Automated injection of semantic fallback HTML for search engine crawlers and screen readers.
- **Comprehensive Automated Testing**:
  - Vitest test suite (`tests/worker.test.js`, `tests/data.test.js`, `tests/dist.test.js`) with 20 unit tests verifying API security, data schema integrity, and build outputs.
  - Playwright E2E test suite (`tests/e2e.spec.js`) with 7 end-to-end tests validating 3D canvas rendering, trilingual switcher, project catalog search, tour mode, contact terminal, viewport overflow, and accessibility.
  - GitHub Actions CI workflow (`.github/workflows/ci.yml`) automating linting, formatting checks, production build, unit tests, and E2E tests.

### Changed

- **Asset Optimization**:
  - Converted 2048px planet and solar textures from PNG/JPG to WebP, saving ~5.0 MB (from 7.7 MB down to 2.7 MB, a 64.9% reduction).
  - Re-encoded ambient audio to 64 kbps mono MP3 with volume attenuation.
- **Repository Organization**:
  - Cleaned root folder: tests moved to `tests/`, build and verification scripts moved to `scripts/`, test screenshots moved to `docs/screenshots/`.
  - Configured Cloudflare Worker assets directory to `./dist` (in `wrangler.jsonc`), ensuring source code, scripts, and private configs are never publicly served.
- **Identity & Project Attribution**:
  - Unified title across all files: `"AI & Full-Stack Developer (Student)"`.
  - Removed misleading hardware specifications (GPU/CPU specs) from portfolio and resume.
  - Clarified project catalog: distinct sections for personal creations ("Mening Loyihalarim") versus open-source tools and security kits ("Ochiq Kodli Vositalar & Kiber-Arsenal"), crediting original authors (e.g. Gordon Lyon for Nmap, Bernardo Damele for sqlmap).
  - Replaced aggressive "cyber-weapons" terminology with "Security Toolkit & Defense Lab".
- **Resume Generation**:
  - Refactored `scripts/generate_resume_pdf.mjs` to eliminate hardcoded absolute paths (`/home/cyber/...`) and suppressed browser headers/footers (`printBackground: true`, `displayHeaderFooter: false`).

### Fixed

- Fixed Telegram token and chat ID fallback exposure in `worker.js`.
- Fixed mobile viewport accessibility by removing `user-scalable=no` and `maximum-scale=1` in `index.html`.
- Added keyboard skip link (`.skip-link`) for WCAG accessibility compliance.
- Fixed Three.js texture and geometry disposal to prevent memory leaks during long browsing sessions.
- Fixed terminal feedback display in `src/ui/terminal.js` by aligning server response schema (`{ ok: true, message: ... }`).

---

## [1.0.0] - 2026-10-19

- Initial release of the 3D Solar System Developer Portfolio with Three.js r160, 9 planets, audio synthesizer, gesture control, and Cloudflare Worker backend.
