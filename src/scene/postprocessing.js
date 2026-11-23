import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

/**
 * Bloom resolution is half the viewport on every device, not just phones.
 *
 * UnrealBloomPass builds a five-level mip chain and runs a separable blur on
 * each, so it costs on the order of ten extra full-screen passes. At full
 * resolution that was the single largest source of frame-time variance here:
 * measured at a 1600x857 viewport, removing bloom moved the average from
 * 29.1 ms to 27.2 ms but moved the 95th percentile from 49.9 ms to 33.4 ms —
 * so it was not the average cost that made the scene feel like it stuttered,
 * it was the spikes.
 *
 * Halving the resolution keeps the effect and removes three quarters of that
 * work. Bloom is a wide, soft glow by definition: there is no detail in it
 * for the extra samples to resolve, which is why the result is hard to tell
 * apart from the full-resolution version.
 */
const BLOOM_RESOLUTION_SCALE = 0.5;

function bloomResolution(width, height) {
  return new THREE.Vector2(
    Math.max(1, Math.floor(width * BLOOM_RESOLUTION_SCALE)),
    Math.max(1, Math.floor(height * BLOOM_RESOLUTION_SCALE)),
  );
}

export function initPostprocessing(renderer, scene, camera) {
  // A half-float target keeps luminances above 1.0 intact, which is what lets
  // the threshold below pick out genuine emitters instead of bright pixels.
  const renderTarget = new THREE.WebGLRenderTarget(
    window.innerWidth,
    window.innerHeight,
    {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      stencilBuffer: false,
      depthBuffer: true,
    },
  );

  const composer = new EffectComposer(renderer, renderTarget);
  composer.addPass(new RenderPass(scene, camera));

  // threshold > 1.0 means only HDR emitters bloom — the Sun's photosphere and
  // corona. Planets and the sky stay crisp instead of washing out, which is
  // what separates a photograph of space from a glow filter.
  const bloomPass = new UnrealBloomPass(
    bloomResolution(window.innerWidth, window.innerHeight),
    0.72, // strength
    0.4, // radius
    1.05, // threshold
  );
  composer.addPass(bloomPass);

  composer.addPass(new OutputPass());

  return { composer, bloomPass, bloomResolution };
}
