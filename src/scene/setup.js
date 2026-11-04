import * as THREE from "three";

// Procedural GLSL Milky Way Galaxy & Cosmic Nebulae Skydome
const milkyWayVertexShader = `
varying vec3 vWorldDir;
void main() {
    vWorldDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const milkyWayFragmentShader = `
uniform float uTime;
uniform float uMode;
varying vec3 vWorldDir;

float hash3(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.1, 0.1));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise3(vec3 x) {
    vec3 p = floor(x);
    vec3 w = fract(x);
    vec3 u = w * w * w * (w * (w * 6.0 - 15.0) + 10.0);
    
    float n000 = hash3(p + vec3(0.0, 0.0, 0.0));
    float n100 = hash3(p + vec3(1.0, 0.0, 0.0));
    float n010 = hash3(p + vec3(0.0, 1.0, 0.0));
    float n110 = hash3(p + vec3(1.0, 1.0, 0.0));
    float n001 = hash3(p + vec3(0.0, 0.0, 1.0));
    float n101 = hash3(p + vec3(1.0, 0.0, 1.0));
    float n011 = hash3(p + vec3(0.0, 1.0, 1.0));
    float n111 = hash3(p + vec3(1.0, 1.0, 1.0));

    float nx00 = mix(n000, n100, u.x);
    float nx10 = mix(n010, n110, u.x);
    float nx01 = mix(n001, n101, u.x);
    float nx11 = mix(n011, n111, u.x);

    float nxy0 = mix(nx00, nx10, u.y);
    float nxy1 = mix(nx01, nx11, u.y);

    return mix(nxy0, nxy1, u.z);
}

float fbmNebula(vec3 p) {
    float val = 0.0;
    float amp = 0.5;
    mat3 rot = mat3(
        0.00,  0.80,  0.60,
       -0.80,  0.36, -0.48,
       -0.60, -0.48,  0.64
    );
    for (int i = 0; i < 5; i++) {
        val += amp * noise3(p);
        p = rot * p * 2.02;
        amp *= 0.5;
    }
    return val;
}

void main() {
    vec3 dir = normalize(vWorldDir);
    float galLat = abs(dir.y);
    float mwMask = exp(-galLat * 5.2);
    float mwDust = exp(-galLat * 16.0) * 0.75;

    vec3 sampleCoord = dir * 2.8 + vec3(uTime * 0.001, 0.0, uTime * 0.0008);
    float nebulaNoise = fbmNebula(sampleCoord);
    float dustNoise = fbmNebula(dir * 5.2 + vec3(5.2, 1.3, 2.7));

    float mwIntensity = clamp((nebulaNoise - dustNoise * mwDust) * mwMask * 1.1, 0.0, 1.0);

    // Deep space is near pitch-black (sRGB < 4/255 away from galactic plane)
    vec3 deepSpace = vec3(0.0005, 0.0005, 0.0009);
    // Unresolved starlight along the galactic disc: natural subtle warm starlight
    vec3 starlightColor = vec3(0.09, 0.085, 0.075);

    vec3 finalSky = deepSpace + starlightColor * mwIntensity * 0.35;
    gl_FragColor = vec4(finalSky, 1.0);
}
`;

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
  scene.background = new THREE.Color(0x000001);

  // Camera
  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    15000,
  );
  camera.position.set(0, 120, 420);

  // Renderer with hardware performance capping
  const isMobile = window.innerWidth <= 768;
  const maxPixelRatio = isMobile
    ? 1.5
    : Math.min(window.devicePixelRatio || 1, 2);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: !isMobile,
      powerPreference: "high-performance",
      alpha: false,
      stencil: false,
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
    console.log("WebGL context restored.");
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(maxPixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // Skydome
  const skyGeo = new THREE.SphereGeometry(4500, 32, 32);
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: milkyWayVertexShader,
    fragmentShader: milkyWayFragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uMode: { value: 0 },
    },
    side: THREE.BackSide,
    depthWrite: false,
  });
  const skydomeMesh = new THREE.Mesh(skyGeo, skyMat);
  scene.add(skydomeMesh);

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

  return { scene, camera, renderer, skydomeMesh, sunLight };
}
