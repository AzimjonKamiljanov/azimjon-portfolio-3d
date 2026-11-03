import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

export function initPostprocessing(renderer, scene, camera) {
  const isMobile = window.innerWidth <= 768;

  // Half-resolution bloom pass for mobile performance
  const bloomResolution = isMobile
    ? new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2)
    : new THREE.Vector2(window.innerWidth, window.innerHeight);

  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // UnrealBloomPass: strength, radius, threshold
  const bloomPass = new UnrealBloomPass(
    bloomResolution,
    isMobile ? 0.85 : 1.15, // strength
    0.4, // radius
    0.82, // threshold
  );
  composer.addPass(bloomPass);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  return { composer, bloomPass };
}
