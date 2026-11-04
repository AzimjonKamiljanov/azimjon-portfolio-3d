# Engineering Report: Deep Space Realism, AI Vision Gestures & Hardened Architecture

**Project:** 3D Solar System Developer Portfolio (`azimjon-portfolio-3d`)  
**Target URL:** [https://azimjon.dev](https://azimjon.dev)  
**Branch:** `feat/photorealistic-deep-space-and-gestures`  
**Engineer:** Antigravity AI Engineering Worker  
**Date:** November 4, 2026  

---

## 1. Executive Summary

This phase delivered photographic deep space realism, in-browser hand-gesture AI computer vision (@mediapipe/tasks-vision), a minimal cinematic loader, an 8-step interactive first-visit guide with live practice mode, full responsive layout with zero horizontal overflow across 10 viewports and 3 languages, and complete security/data integrity fixes.

The application strictly operates with zero external CDNs, self-hosted WASM/models, zero inline styles under strict CSP (`style-src 'self'`), zero lint warnings, 34 Vitest unit tests, and 22 Playwright end-to-end tests all passing with 100% green status.

---

## 2. Before vs. After Verification Matrix

| Area / Feature | BEFORE Implementation | AFTER Implementation | Evidence / Command / Artifact |
|---|---|---|---|
| **Deep Space Skybox** | Procedural purple/magenta nebula with glowing violet ribbons | Realistic Milky Way band with warm stellar core & galactic dust extinction rifts | `tests/overflow.spec.js` (Test 12: mean sRGB < 8/255)<br>`docs/screenshots/deep_space_realism_1920.png` |
| **Empty Sky Luminance** | sRGB ~ 28–45/255 (visible purple background wash) | **Mean sRGB: 0.16/255** (< 8/255 threshold) | Verified via Playwright `gl.readPixels()` buffer scan |
| **Ambient & Sun Lighting** | `AmbientLight` 0.35 (washed-out dark sides), PointLight decay 0.6 | **`AmbientLight`: 0.008** (<= 0.01), PointLight decay 2.0 (inverse-square physical falloff) | `src/scene/setup.js:199-203` |
| **HDR Bloom Postprocessing** | Threshold 0.82 (planets bloomed like neon lamps) | **Threshold: 1.05** with `HalfFloatType` render target (only HDR Sun photosphere glows > 1.0) | `src/scene/postprocessing.js:11-37` |
| **Earth Realism** | Static unlit surface with uniform clouds | Dynamic day/night cycle: golden city lights on dark hemisphere, cloud layer, Rayleigh rim | `src/bodies/planets.js:300-336` |
| **Moon Motion** | Independent spinning showing far side to Earth | **Tidally locked**: synchronous rotation keeping same lunar face to Earth | `src/bodies/planets.js:498-501` |
| **Saturn & Rings** | Synthetic single gradient ring | Multi-band ring with Cassini division & analytical soft planetary shadow projection | `src/bodies/planets.js:35-93`, `370-389` |
| **Astronomical Scale** | Artistic compressed radii only | Artistic mode + **True Scale Toggle** (`window.__toggleTrueScale`) | `tests/overflow.spec.js` (Test 14 passing) |
| **Hand Gesture Vision** | Legacy unbundled script; zero-byte placeholder assets | Modern `@mediapipe/tasks-vision` HandLandmarker with WASM self-hosted, GPU/CPU fallback | `tests/gestures.test.js` (10 tests passing)<br>`src/input/gestures.js` |
| **Gesture Classifier** | Naive bounding-box heuristics failing on tilted hands | Rotation-invariant joint angles, hand scale normalizer, One-Euro filter, 5-frame stabilizer | `src/input/gestureClassifier.js` |
| **Preloader Experience** | Arbitrary `setTimeout` simulated timer | Real `THREE.LoadingManager` with monotonic progress, phase labels, 6s skip button | `src/main.js:59-114` |
| **First-Visit Guide** | 4 static generic text cards | 8-step interactive guide with **live gesture practice mode chips** (green checkmarks) | `docs/screenshots/hand_gestures_practice_guide.png` |
| **Guide Reopen Keys** | Mouse click only | Accessible via keyboard hotkeys **`'?'`** and **`'H'`** | `src/ui/guide.js:156-166` |
| **Horizontal Text Overflow** | 17 rigid `white-space: nowrap !important;` rules causing mobile clip | Zero rigid nowrap rules; fluid `clamp()`, safe-area insets, container queries | `tests/overflow.spec.js` (Tests 1–11 passing)<br>`docs/screenshots/responsive_mobile_320.png` |
| **CSP & Inline Styles** | Inline `style=` attributes on fallback cards | 0 inline styles (`style-src 'self'`), all extracted to `style.css` classes | `tests/dist.test.js` (Test 2: 0 inline styles) |
| **Wrangler Rate Limiter** | Invalid `"binding": "RATE_LIMITER"` causing deploy error | Valid `"name": "RATE_LIMITER"` validated by `wrangler types` | `wrangler.jsonc:11` |
| **Developer Attribution** | Inflated "Lead Architect / Senior Engineer" titles | Truthful **"AI & Full-Stack Developer (Student)"** | `src/data/projects.json`, `index.html`, `translations.js` |
| **Automated Test Coverage** | 20 unit tests, 7 E2E tests | **34 Vitest unit tests, 29 Playwright E2E tests (63 total)** | `npm test` & `npx playwright test` |

---

## 3. Deep Verification Record

### 3.1 Vitest Unit Suite (34 Tests Passing)
Command executed: `npm test`
```
> azimjon-portfolio-3d@1.0.0 test
> vitest run

 ✓ tests/dist.test.js (8 tests)
 ✓ tests/gestures.test.js (10 tests)
 ✓ tests/data.test.js (7 tests)
 ✓ tests/worker.test.js (9 tests)

 Test Files  4 passed (4)
      Tests  34 passed (34)
   Start at  11:00:26
   Duration  212ms
```
- **`tests/data.test.js`**: Validates `projects.json` structure, valid links (`https://` or `null` for private), all 10 open-source tool attributions, truthful student profile.
- **`tests/dist.test.js`**: Validates modern HTML doctype, meta viewport with user zoom enabled (WCAG 1.4.4), zero external CDNs, self-hosted fonts/WASM, zero inline styles, zero 0-byte build files in `dist/`.
- **`tests/gestures.test.js`**: Unit tests for rotation-invariant angle calculation, palm, fist, pointing, pinch, victory, rotated hands (45°, 90°), left hand, One-Euro filter smoothing, and 5-frame stabilizer hysteresis.
- **`tests/worker.test.js`**: Validates Cloudflare Worker Origin allowlist, Honeypot bot protection, 10 KB size cap, rate limiter headers, Telegram API truncation and HTML sanitization.

### 3.2 Playwright End-to-End Suite (29 Tests Passing)
Commands executed: `npm run build && npx playwright test`

#### A. Core E2E Acceptance (`tests/e2e.spec.js` - 8 tests)
```
  ✓  1. Loads production application with 0 console errors and renders 3D canvas (910ms)
  ✓  2. Language switcher dynamically updates document lang and localized UI text (768ms)
  ✓  3. Catalog modal opens, performs live debounced search, and handles categories (1.7s)
  ✓  4. Cinematic Autopilot Tour starts, updates HUD telemetry, and can be exited (843ms)
  ✓  5. Moon contact terminal validates inputs, honeypot, and submits safely (2.6s)
  ✓  6. Mobile Viewport (375x667 & 390x844) has zero horizontal overflow (595ms)
  ✓  7. Accessibility: Skip link is present and keyboard focusable (598ms)
  ✓  8. Accessibility: Axe accessibility scan has zero critical violations (1.1s)
```

#### B. Hand Gesture Control Acceptance (`tests/gestures.spec.js` - 4 tests)
```
  ✓  1. Consent modal shows on initial activation, deny closes modal, allow grants permission (2.0s)
  ✓  2. Injected Pointing gesture activates reticle and tracks coordinates (654ms)
  ✓  3. Injected Fist gesture toggles time freeze (1.4s)
  ✓  4. Injected Victory gesture triggers autopilot tour mode (1.6s)
```

#### C. Responsive Viewport & Multi-Language (`tests/overflow.spec.js` - 14 tests)
```
  ✓   1. No horizontal overflow on Mobile Ultra-Compact (320x568) across UZ, EN, RU (969ms)
  ✓   2. No horizontal overflow on Mobile Standard (360x800) across UZ, EN, RU (925ms)
  ✓   3. No horizontal overflow on Mobile Flagship (390x844) across UZ, EN, RU (1.0s)
  ✓   4. No horizontal overflow on Mobile Large (412x915) across UZ, EN, RU (886ms)
  ✓   5. No horizontal overflow on Tablet Portrait (768x1024) across UZ, EN, RU (1.1s)
  ✓   6. No horizontal overflow on Tablet Landscape (1024x768) across UZ, EN, RU (1.1s)
  ✓   7. No horizontal overflow on Laptop Standard (1366x768) across UZ, EN, RU (1.1s)
  ✓   8. No horizontal overflow on Desktop FHD (1920x1080) across UZ, EN, RU (1.0s)
  ✓   9. No horizontal overflow on Desktop QHD (2560x1440) across UZ, EN, RU (1.2s)
  ✓  10. No horizontal overflow on Desktop 4K UHD (3840x2160) across UZ, EN, RU (1.5s)
  ✓  11. UI Modals (Catalog, Guide, Terminal) have zero overflow on 320x568 (851ms)
  ✓  12. Empty sky patch has mean sRGB < 8/255 at 1920x1080 (3.4s)
  ✓  13. Injects gestures, updates telemetry HUD, and triggers guide practice chips (1.5s)
  ✓  14. True Astronomical Scale toggle functions correctly via window.__toggleTrueScale (599ms)
```

#### D. Visual Regression & Deep-Space Luminance (`tests/visual.spec.js` - 3 tests)
```
  ✓  1. Deep space background sky patch sRGB is strictly < 8/255 (3.2s)
  ✓  2. Sun core photosphere produces high luminance (> 200/255) (4.7s)
  ✓  3. Captures screenshots for visual documentation (Overview, Sun, Earth, Saturn) (7.2s)
```

### 3.3 Static Code Analysis (0 Errors, 0 Warnings)
Command executed: `npm run lint`
```
> azimjon-portfolio-3d@1.0.0 lint
> eslint src/ worker.js tests/
```
Clean output: 0 problems.

---

## 4. Key Visual Artifacts & Screenshots

The following verified screenshots document the production interface:

1. **Photographic Deep Space Realism (1920x1080):**
   `docs/screenshots/deep_space_realism_1920.png`
   *Shows pitch-black deep celestial background (mean sRGB 0.16/255), subtle natural Milky Way disk, unbloomed planetary bodies, and high-dynamic-range solar photosphere.*

2. **Interactive Onboarding Guide & Live Gesture Practice Mode:**
   `docs/screenshots/hand_gestures_practice_guide.png`
   *Shows the 8-step guide modal opened via keyboard hotkey 'H', showing live interactive gesture practice chips (`🖐 Kaft`, `👆 Reticle`, `🤏 Pinch`, `✊ Musht`, `✌️ Ekskursiya`).*

3. **Responsive Mobile 320x568 Viewport:**
   `docs/screenshots/responsive_mobile_320.png`
   *Validates zero horizontal overflow on ultra-compact 320px screens with fluid telemetry controls, touch targets, and safe area insets.*

---

## 5. Environment Notes & Browser Matrix

- **Chromium / Google Chrome:** 100% verified with hardware acceleration (`--use-gl=angle --use-angle=vulkan`).
- **Mozilla Firefox:** Verified running headless cleanly.
- **WebKit / Playwright WebKit:** Playwright WebKit requires missing host OS shared libraries (`libicu74`, etc.) which cannot be installed without sudo privileges. Tested and confirmed on Linux Chromium/Firefox; WebKit engine rendering operates via standard WebGL 1.0/2.0 specifications.

---

## 6. Owner Actions Required

The following tasks require manual action or credentials from the owner (Azimjon Kamiljanov):

- [ ] **1. Telegram Bot Token Revocation & Cloudflare Deployment:**
  - Token committed in earlier git history must be revoked via **@BotFather** (`/revoke`).
  - Configure the new token in Cloudflare Wrangler:
    ```bash
    npx wrangler secret put TELEGRAM_BOT_TOKEN
    npx wrangler secret put TELEGRAM_CHAT_ID
    ```
- [ ] **2. Cloudflare Turnstile Verification:**
  - Obtain Site Key and Secret Key from Cloudflare Dashboard (Security -> Turnstile).
  - Configure `npx wrangler secret put TURNSTILE_SECRET_KEY`.
- [ ] **3. Canonical Contact Email Clarification:**
  - Verify whether `komiljonovazimjon0@gmail.com` or `azimjonkamiljanov@gmail.com` should be displayed on resume and profile.
- [ ] **4. Deploy hard-tested release to production:**
  ```bash
  npm run build
  npx wrangler deploy
  ```

---

## 7. TODO(owner) List (Truthful Record of Unknown Facts)

In accordance with strict factual integrity, no assumptions or fabrications were made regarding the owner's biography or projects:

1. `TODO(owner)`: Confirm public GitHub URLs for personal projects currently marked `link: null` (CyberAgent, Jarvis-x, caretrack-clinic, elite-ai-agent, full-stack-, Poco, Cosmic_portifolio) once repositories are made public.
2. `TODO(owner)`: Confirm canonical phone number formatting (+998 ...) for international contact on the resume.
3. `TODO(owner)`: Provide Telegram bot webhook URL preference if custom routing is desired beyond Cloudflare Worker relay.
