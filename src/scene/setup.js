import * as THREE from "three";
import { choosePixelRatio, pickBudget } from "./pixelBudget.js";
import { bakeStarfieldSky } from "./skybox.js";

// Fresnel Atmospheric Rim Glow Helper
export function createAtmosphereGlow(
  radius,
  colorHex,
  intensity = 1.0,
  scale = 1.055,
) {
  const glowGeo = new THREE.SphereGeometry(radius * scale, 48, 48);
  const glowMat = new THREE.ShaderMaterial({
    vertexShader: `
            varying vec3 vNormal;
            varying vec3 vViewDir;
            void main() {
                vNormal = normalize(normalMatrix * normal);
                vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
                vViewDir = normalize(-mvPos.xyz);
                gl_Position = projectionMatrix * mvPos;
            }
        `,
    fragmentShader: `
            uniform vec3 uColor;
            uniform float uIntensity;
            varying vec3 vNormal;
            varying vec3 vViewDir;
            void main() {
                float fresnel = 1.0 - dot(vNormal, vViewDir);
                fresnel = pow(clamp(fresnel, 0.0, 1.0), 3.2);
                gl_FragColor = vec4(uColor, fresnel * uIntensity);
            }
        `,
    uniforms: {
      uColor: { value: new THREE.Color(colorHex) },
      uIntensity: { value: intensity },
    },
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  });
  return new THREE.Mesh(glowGeo, glowMat);
}

export function initScene() {
  const container = document.getElementById("canvas-container");
  const scene = new THREE.Scene();

  // Camera
  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    15000,
  );
  camera.position.set(0, 120, 420);

  // Renderer with hardware performance capping.
  //
  // The pixel ratio comes from a pixel budget rather than from screen width.
  // Width does not predict fill rate: a 1024-wide window at DPR 2 on a tall
  // display is 9.1 megapixels -- more than 4K -- and measured 16 FPS on real
  // hardware, while a 760-wide window was being forced down to 1.5 on a GPU
  // that could afford far more. See pixelBudget.js.
  const coarsePointer =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  const isMobile = coarsePointer && window.innerWidth <= 820;

  function currentPixelRatio() {
    return choosePixelRatio({
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: window.devicePixelRatio,
      budget: pickBudget({ width: window.innerWidth, coarsePointer }),
    });
  }

  const maxPixelRatio = currentPixelRatio();

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: !isMobile,
      powerPreference: "high-performance",
      alpha: false,
      stencil: false,
      preserveDrawingBuffer: true,
    });
  } catch (err) {
    console.warn(
      "WebGL not supported, activating accessible fallback view.",
      err,
    );
    const fallback = document.getElementById("accessible-fallback");
    if (fallback) fallback.classList.add("visible");
    const preloader = document.getElementById("preloader");
    if (preloader) preloader.style.display = "none";
    throw err;
  }

  renderer.domElement.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    console.warn("WebGL context lost.");
  });
  renderer.domElement.addEventListener("webglcontextrestored", () => {
    console.warn("WebGL context restored.");
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(maxPixelRatio);
  // Rotating a phone or dragging a window between displays changes both the
  // viewport and the display's own ratio, so the budget is re-evaluated
  // rather than fixed at load.
  renderer.recomputePixelRatio = () =>
    renderer.setPixelRatio(currentPixelRatio());
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  // Shadows stay off. The Sun PointLight never set castShadow, so the shadow
  // map was configured but never rendered — and a point-light shadow cube for
  // a system this large would cost far more than the barely-visible terminator
  // it would buy. Measured: enabling or disabling it changed nothing, because
  // it was never running.
  renderer.shadowMap.enabled = false;
  container.appendChild(renderer.domElement);

  // Sky: baked once into a cube map rather than redrawn every frame.
  // See skybox.js — the procedural version cost about a third of the entire
  // frame to produce an image that never changed.
  const sky = bakeStarfieldSky(renderer);
  scene.background = sky.texture;

  // Lighting: deep space ambient <= 0.01 (0.008) for photographic contrast, physically calibrated Sun PointLight
  const ambientLight = new THREE.AmbientLight(0x020306, 0.008);
  scene.add(ambientLight);

  const sunLight = new THREE.PointLight(0xfffaed, 2800, 0, 2.0);
  sunLight.position.set(0, 0, 0);
  scene.add(sunLight);

  // Global exposure for debugging/tests
  window.__renderer = renderer;
  window.__scene = scene;
  window.__camera = camera;

  return { scene, camera, renderer, sky, sunLight };
}
