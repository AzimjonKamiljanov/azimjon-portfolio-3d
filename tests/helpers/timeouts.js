/**
 * Timeouts that scale with the environment.
 *
 * A GitHub runner has no GPU, so Chromium falls back to SwiftShader and
 * renders this WebGL scene roughly an order of magnitude slower than a local
 * machine: the same suite takes 40 seconds locally and 6.5 minutes in CI.
 * Waits tuned for a developer's laptop therefore expire on the runner, and
 * the resulting failures say nothing about the code.
 *
 * Rather than relax the assertions, every wait is multiplied by a single
 * factor. The tests still check exactly what they checked before; they just
 * allow the slower machine time to get there.
 */

const CI_SLOWDOWN = 6;

export const isCI = Boolean(process.env.CI);

/** Scales a locally-tuned timeout for the current environment. */
export function waitMs(localMs) {
  return isCI ? localMs * CI_SLOWDOWN : localMs;
}

/** The scene's first canvas paint — the slowest single step under software GL. */
export const CANVAS_TIMEOUT = waitMs(10_000);

/** A panel or modal animating in once the scene is already running. */
export const PANEL_TIMEOUT = waitMs(6_000);
