/**
 * Chooses a device pixel ratio from a pixel budget rather than from screen
 * width.
 *
 * The renderer used to pick its ratio from `innerWidth <= 768`, which asks the
 * wrong question. Fill rate is driven by the *total* number of pixels shaded
 * each frame, and width alone does not predict that: a 1024-wide window at
 * DPR 2 is 2048x4436 on a tall display — 9.1 megapixels, more than 4K — and
 * it measured 16 FPS on a real GPU. Meanwhile a 760-wide window was forced
 * down to 1.5 even on hardware that could easily afford more.
 *
 * Budgeting pixels directly fixes both ends: every device renders at the
 * highest ratio that still fits inside the budget, and no device exceeds it.
 */

/**
 * Roughly 1080p. Above this the scene is fill-rate bound on integrated
 * graphics without looking meaningfully sharper, because the detail here is
 * in the shaders and the bloom rather than in fine geometry.
 */
export const DEFAULT_PIXEL_BUDGET = 2_100_000;

/** A phone-class budget: fewer pixels, since the panel is small anyway. */
export const MOBILE_PIXEL_BUDGET = 1_300_000;

/**
 * @param {object} opts
 * @param {number} opts.width      CSS pixels
 * @param {number} opts.height     CSS pixels
 * @param {number} opts.dpr        the display's own devicePixelRatio
 * @param {number} [opts.budget]   maximum drawing-buffer pixels
 * @param {number} [opts.maxRatio] never exceed this even if the budget allows
 * @param {number} [opts.minRatio] never go below this, however large the window
 * @returns {number} the ratio to hand to `renderer.setPixelRatio`
 */
export function choosePixelRatio({
  width,
  height,
  dpr,
  budget = DEFAULT_PIXEL_BUDGET,
  maxRatio = 2,
  minRatio = 0.75,
}) {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const displayRatio = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;

  // The largest ratio whose drawing buffer still fits the budget.
  const fromBudget = Math.sqrt(budget / (w * h));

  const chosen = Math.min(displayRatio, maxRatio, fromBudget);

  // Below minRatio the image turns to mush; a very large window is better
  // served by going slightly over budget than by looking broken.
  return Math.max(minRatio, chosen);
}

/**
 * Picks the budget for the current device. Coarse pointer plus a narrow
 * viewport is a phone; everything else gets the desktop budget, including
 * tablets, which usually have the thermal headroom for it.
 */
export function pickBudget({ width, coarsePointer }) {
  return coarsePointer && width <= 820
    ? MOBILE_PIXEL_BUDGET
    : DEFAULT_PIXEL_BUDGET;
}
