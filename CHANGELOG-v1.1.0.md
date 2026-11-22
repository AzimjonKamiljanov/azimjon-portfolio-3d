# v1.1.0 — Hardening, hand control, design system

All work below is verified locally: `npm run verify` passes (Prettier, ESLint,
build, 67 unit tests) and `npx playwright test --grep-invert @visual` passes
30/30 functional E2E specs. `npm audit --omit=dev` reports 0 vulnerabilities.

---

## ⚠️ Still needs you

**The Telegram bot token is in the public git history** (commits `c815943`,
`0094523`, `13670fe` — all ancestors of `origin/main`). No code change can
remove it, because rewriting published history and force-pushing is your call:

1. @BotFather → `/revoke` → issue a new token
2. Store the new one with `npx wrangler secret put TELEGRAM_BOT_TOKEN`
3. `git filter-repo` or BFG, then `git push --force`
4. Turn on GitHub secret scanning and push protection

CI now **fails** on any Gitleaks finding, so once the history is clean it
cannot silently regress.

---

## Security

- **Secret scan now blocks.** `scripts/report-gitleaks.cjs` only printed
  findings and always exited 0, so a leaked credential produced a green build.
  It now exits 1 on any finding — and on a missing or unparseable report, so a
  crashed scanner cannot read as a clean tree.
- **Turnstile actually works.** The Worker enforced a token whenever
  `TURNSTILE_SECRET_KEY` was set, while the browser never sent one because no
  widget existed. Setting the secret in production would have rejected 100% of
  real messages, silently. The challenge is now one runtime state derived from
  both keys and published at `GET /api/config`; the widget and the verifier
  cannot disagree. A half-configuration logs an error and stays off rather than
  breaking the form.
- **CSP follows that state.** The Turnstile origin is added to `script-src`,
  `frame-src` and `connect-src` only while the challenge is live, so a
  deployment without it keeps a self-only policy and no external script origin.
- **Payload cap is real.** The 10 KB limit trusted `Content-Length`, which a
  chunked request omits — reporting 0 and skipping the check. The cap is now
  applied to the bytes actually read. Non-object JSON bodies are rejected.
- Added `LICENSE` (README linked to a file that did not exist) and
  `SECURITY.md`.

## Hand control

The webcam is now a complete input device rather than a demo of a few poses.

- **New: 👎 thumbs down closes the top panel or goes back.** Everything you
  could open by hand previously required a mouse or Escape to close, which
  defeated the point.
- **New: ✌️ two fingers scroll the open panel.** Held still it still toggles
  the tour; the two are told apart by movement.
- **New: 👐 two-hand roll** orbits the camera, alongside spread-to-zoom.
- **🤏 pinch is now a precision controller** — sideways drag orbits, vertical
  drag zooms, a quick pinch selects. It used to zoom only, leaving no
  fine-grained way to aim by hand.
- **Progress is visible.** Every hold action fills a bar and every dwell fills
  a ring around the reticle. An invisible timer is indistinguishable from a
  control that does not work.
- **Calibration panel in the HUD** — sensitivity, dwell time, hold time,
  deadzone, mirroring and skeleton overlay, clamped and persisted. Fixed
  thresholds cannot suit every webcam, room and arm reach.
- **Camera raised from 320×240 to 640×480.** Fingertip error at QVGA was the
  dominant source of pinch and pointing drift.
- Detection confidence raised 0.5 → 0.6, removing phantom hands that fired
  actions with nothing in frame.
- Filter frequency now tracks measured FPS instead of assuming 30 Hz, so
  smoothing feels the same on a slow laptop.
- Viewport dimensions are cached behind a resize listener instead of forcing a
  layout flush on every webcam frame.
- `stopGestureControl` detaches the stream as well as stopping tracks, which is
  what actually clears the browser's camera-in-use indicator.
- **Six near-identical 25-line hold blocks became one state machine** over a
  `HOLD_ACTIONS` table. That duplication is why their thresholds had drifted
  apart.

## Design system

- **`src/styles/tokens.css`** — the stylesheet carried 164 distinct literal
  colours against four custom properties, so "the same" panel background
  existed in a dozen alpha values and nothing could be tuned in one place.
  577 literals were migrated to tokens; `var()` usage went from 4 to ~600.
- **`src/styles/refinements.css`** loads last and unifies what grew
  component-by-component: one focus ring, one glass recipe, one scrollbar, one
  press interaction, one motion scale.
- **Catalog restraint** — the bright blue section heading became a 2px accent
  marker beside white text; tags became outline-only metadata that lifts on
  hover; body copy moved onto the type scale from arbitrary 12.5/11.5px.
- **Accessibility that was missing:** `prefers-contrast: more`, a
  `@supports not (backdrop-filter)` solid fallback so text never lands on raw
  3D scene, and WCAG 2.5.8 touch targets.

## Code quality

- **ESLint went from 2 rules to a real config.** It had only `no-unused-vars`
  and `no-undef` with a hand-maintained global list, and ignored `scripts/`
  entirely — so `npm run lint` was always green. Now `js.configs.recommended`
  plus 11 rules, with per-runtime globals so `no-undef` does real work. This
  surfaced **38 genuine findings**, all fixed.
- Prettier now covers the whole repo, with `.prettierignore` protecting
  vendored MediaPipe glue and `index.html` (its HTML printer rewrites all 724
  lines and lowercases the doctype).
- **CI went from one job to four:** quality, functional E2E, advisory visual
  regression, and security. 24 Playwright specs existed but CI never ran them.

## Performance

- The 115 KB trilingual dictionary is its own chunk. It changes far less often
  than the code around it, so as part of `main` every copy edit invalidated it
  for returning visitors. **`main` dropped from 91 KB to 62 KB gzip** and the
  two now load in parallel.
- Source maps enabled, making `errors.js` telemetry actionable.
- `vite.config.js` no longer relies on `__dirname` in an ES module.

## Tests

39 → **67** unit tests.

| Suite                          | Covers                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `turnstile.test.js` (16)       | Config states, `/api/config`, CSP following the state, honeypot, payload caps |
| `gestureSettings.test.js` (10) | Clamping, corrupt storage, blocked storage, persistence, reset                |
| `gestures.test.js` (+2)        | `thumbs_down`, and that a sideways thumb stays a fist                         |

## Removed

`gsap.min.js` (72 KB, unreferenced — gsap comes from npm), a duplicate root
screenshot (299 KB), and `worker-configuration.d.ts` (612 KB, generated by
`wrangler types`) is now git-ignored.

## Not done, deliberately

- **`assets/` (6.3 MB)** left in place. It is the only copy of the generated
  source textures that `optimize_assets.mjs` converts into the shipped WebP in
  `public/assets/`; deleting it on the assumption the generators can rebuild it
  would be destructive. Git LFS is the right move when you want it.
- **Splitting the dictionary per locale** was not attempted. Language is the
  _innermost_ key (`celestial.sun.uz`), so it would mean restructuring hundreds
  of nested objects and making `getTranslations()` async — it is called inside
  the gesture frame loop. The chunk split gets most of the caching benefit at a
  fraction of the risk.
- Asteroid count and the render loop were examined and left alone: 1450
  instances are one draw call, the per-frame update is a single group rotation,
  and the loop already pauses on `visibilitychange`. That part was already
  well built.
