import * as THREE from "three";

/**
 * The background stars.
 *
 * This used to live inside the module that also drew eighteen fictional
 * "star" bodies with their own orbit rings. Removing those took the real
 * starfield with them and left an empty black sky, so it lives on its own
 * now — it is the one thing in the background that genuinely belongs there.
 *
 * Three things decide whether a starfield reads as a night sky or as
 * confetti, and the earlier version got all three wrong:
 *
 * 1. **Shape.** A PointsMaterial with no map draws squares. Stars are point
 *    sources smeared by the optics of the eye or lens, so they need a soft
 *    round falloff. The sprite below is generated once on a canvas.
 *
 * 2. **Colour.** The first attempt weighted colours by how common each
 *    spectral class is, which is M-dwarf dominated, and produced an orange
 *    sky. That confuses the population with what is visible: red dwarfs are
 *    intrinsically faint and essentially none are visible to the eye. The
 *    sky you actually see is biased hard toward intrinsically bright, hot
 *    stars, so it reads white with a scattering of warm ones.
 *
 * 3. **Brightness.** Star counts rise steeply with magnitude — each step
 *    fainter is roughly 2.5x more stars. A flat distribution looks like
 *    noise; a steep one gives the sky its depth.
 */

const STAR_COUNT = 6000;
const INNER_RADIUS = 2600;
const OUTER_RADIUS = 4000;

/**
 * Colours weighted by what is actually visible in the sky rather than by
 * population share. Blue-white and white dominate; deep red is rare enough
 * to be an accent.
 */
const VISIBLE_SPECTRUM = [
  { color: 0xaabfff, share: 0.12 }, // B — blue-white
  { color: 0xcad7ff, share: 0.18 }, // A — white with a blue cast
  { color: 0xf8f8ff, share: 0.3 }, // F — white
  { color: 0xfff4ea, share: 0.22 }, // G — warm white, like the Sun
  { color: 0xffe3c0, share: 0.13 }, // K — pale orange
  { color: 0xffcf9d, share: 0.05 }, // bright M giants
];

const PALETTE = VISIBLE_SPECTRUM.map((c) => new THREE.Color(c.color));
const CUMULATIVE = VISIBLE_SPECTRUM.reduce((acc, c) => {
  acc.push((acc.at(-1) ?? 0) + c.share);
  return acc;
}, []);

function pickSpectralIndex(r) {
  for (let i = 0; i < CUMULATIVE.length; i++) {
    if (r <= CUMULATIVE[i]) return i;
  }
  return CUMULATIVE.length - 1;
}

/**
 * A soft round point, drawn once into a small canvas.
 *
 * The gradient is deliberately tight — a wide halo makes every star look
 * like a glowing orb. Most of the sprite is transparent, with a small bright
 * core and a short falloff, which is what a point source looks like.
 */
function createStarSprite() {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  const half = size / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0.0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.18, "rgba(255,255,255,0.85)");
  gradient.addColorStop(0.42, "rgba(255,255,255,0.22)");
  gradient.addColorStop(1.0, "rgba(255,255,255,0)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function initStarfield(scene) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);

  for (let i = 0; i < STAR_COUNT; i++) {
    // acos(2u-1) spreads points evenly over the sphere; a plain uniform
    // angle would crowd them at the poles.
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const radius = INNER_RADIUS + Math.random() * (OUTER_RADIUS - INNER_RADIUS);

    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);

    const base = PALETTE[pickSpectralIndex(Math.random())];

    // Cubing a uniform variable approximates the steep rise in star counts
    // with magnitude without needing a real luminosity function: the great
    // majority land dim, a handful land bright.
    // Squared rather than cubed: cubing left almost everything at the floor
    // and the sky read as empty. Squaring keeps the steep shape but gives the
    // mid-range enough population to feel like a real field of stars.
    const u = Math.random();
    const brightness = 0.14 + u * u * 0.86;

    colors[i * 3] = base.r * brightness;
    colors[i * 3 + 1] = base.g * brightness;
    colors[i * 3 + 2] = base.b * brightness;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    map: createStarSprite(),
    size: 9,
    // Size attenuation on: stars at the far edge of the shell render slightly
    // smaller, which gives the field a little depth as the camera moves.
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    // Additive, so overlapping stars brighten rather than darken the sky —
    // which is how light actually adds up.
    blending: THREE.AdditiveBlending,
  });

  const starfield = new THREE.Points(geometry, material);
  // The shell surrounds the camera, so it must not be culled when the camera
  // looks away from the origin.
  starfield.frustumCulled = false;
  // Draw behind everything else; it is the backdrop.
  starfield.renderOrder = -1;
  scene.add(starfield);

  function update(_time, delta) {
    // Barely perceptible. Real stars do not move on human timescales; this
    // exists only so the backdrop is not perfectly rigid behind a moving
    // camera, and it is slow enough to read as parallax rather than spin.
    starfield.rotation.y += delta * 0.0006;
  }

  return { starfield, update };
}
