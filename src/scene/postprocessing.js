import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

export function initPostprocessing(renderer, scene, camera) {
  const isMobile = window.innerWidth <= 768;

  // Use HalfFloatType HDR render target so luminances > 1.0 are preserved
  const renderTarget = new THREE.WebGLRenderTarget(
    window.innerWidth,
    window.innerHeight,
    {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      stencilBuffer: false,
    },
  );

  const composer = new EffectComposer(renderer, renderTarget);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // Half-resolution bloom pass for mobile performance
  const bloomResolution = isMobile
    ? new THREE.Vector2(Math.floor(window.innerWidth / 2), Math.floor(window.innerHeight / 2))
    : new THREE.Vector2(window.innerWidth, window.innerHeight);

  // UnrealBloomPass: threshold >= 1.0 ensures only HDR emitters (> 1.0, e.g. Sun photosphere) bloom,
  // preventing planets and dark sky from blooming or washing out.
  const bloomPass = new UnrealBloomPass(
    bloomResolution,
    isMobile ? 0.55 : 0.75, // strength
    0.45, // radius
    1.05, // threshold
  );
  composer.addPass(bloomPass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  return { composer, bloomPass };
}
