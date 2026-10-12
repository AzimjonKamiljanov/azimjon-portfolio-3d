import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { translations } from './translations.js';

// Setup Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x010106);

// ==============================================================================
// 1-YO'NALISH: PROCEDURAL GLSL MILKY WAY GALAXY & COSMIC NEBULAE SKYDOME
// ==============================================================================
const milkyWayVertexShader = `
varying vec3 vWorldDir;
void main() {
    vWorldDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const milkyWayFragmentShader = `
uniform float uTime;
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

float fbm3(vec3 p) {
    float f = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
        f += amp * noise3(p);
        p = p * 2.15 + vec3(1.2, 3.4, 5.6);
        amp *= 0.5;
    }
    return f;
}

void main() {
    vec3 dir = normalize(vWorldDir);
    
    // Tilt coordinate system by ~60 degrees for realistic galactic plane relative to ecliptic
    float cosT = 0.50;
    float sinT = 0.866;
    vec3 gDir = vec3(
        dir.x,
        dir.y * cosT - dir.z * sinT,
        dir.y * sinT + dir.z * cosT
    );
    
    float distG = abs(gDir.y);
    
    // Main galactic disk profile (smooth bell curve along galactic equator)
    float disk = exp(-distG * distG * 18.0);
    
    // Galactic core bulge (brightest in Sagittarius constellation)
    vec3 coreDir = normalize(vec3(0.82, 0.04, 0.57));
    float coreDist = length(gDir - coreDir);
    float coreGlow = exp(-coreDist * coreDist * 3.4) * 1.6;
    
    // Interstellar cosmic dust lanes & The Great Rift (absorption of light by cold molecular dust)
    vec3 noisePos = gDir * 4.2;
    float dustNoise = fbm3(noisePos);
    float darkLanes = smoothstep(0.40, 0.74, dustNoise * (1.0 - distG * 1.4));
    float diskBright = max(0.0, (disk * 1.35 + coreGlow) * (1.0 - darkLanes * 0.78));
    
    // Cosmic emission nebulae (Orion / Carina / Lagoon style interstellar gas clouds)
    float neb1Dist = length(gDir - normalize(vec3(-0.68, 0.18, -0.70)));
    float neb1 = exp(-neb1Dist * neb1Dist * 14.0) * fbm3(gDir * 7.5);
    
    float neb2Dist = length(gDir - normalize(vec3(0.24, -0.22, -0.94)));
    float neb2 = exp(-neb2Dist * neb2Dist * 12.0) * fbm3(gDir * 7.0 + 2.1);
    
    // Deep cosmic palette
    vec3 bgSpace = vec3(0.003, 0.003, 0.008);
    vec3 discStarGlow = vec3(0.82, 0.78, 0.96) * 0.52; // Luminous stellar disc
    vec3 coreWarmth = vec3(1.0, 0.80, 0.52) * 0.95;     // Golden galactic bulge
    vec3 nebCyan = vec3(0.12, 0.55, 0.88) * 1.15;       // Cyan reflection nebulae
    vec3 nebMagenta = vec3(0.72, 0.18, 0.55) * 1.05;    // Pink/magenta H-alpha gas
    
    vec3 col = bgSpace;
    col += discStarGlow * diskBright;
    col += coreWarmth * coreGlow * (1.0 - darkLanes * 0.45);
    col += nebCyan * neb1;
    col += nebMagenta * neb2;
    
    // Subtle star dust grain
    float grain = pow(noise3(gDir * 32.0), 3.0) * disk * 0.3;
    col += vec3(grain);
    
    gl_FragColor = vec4(col, 1.0);
}
`;

const milkyWayUniforms = {
    uTime: { value: 0.0 }
};

const milkyWayMat = new THREE.ShaderMaterial({
    vertexShader: milkyWayVertexShader,
    fragmentShader: milkyWayFragmentShader,
    uniforms: milkyWayUniforms,
    side: THREE.BackSide,
    depthWrite: false
});

const milkyWaySphere = new THREE.Mesh(
    new THREE.SphereGeometry(950, 64, 48),
    milkyWayMat
);
milkyWaySphere.renderOrder = -100;
scene.add(milkyWaySphere);

// ==============================================================================
// 2-YO'NALISH: FRESNEL RAYLEIGH SCATTERING ATMOSPHERIC RIM GLOW HELPER
// ==============================================================================
function createAtmosphereGlow(radius, colorHex, intensity = 1.0, scale = 1.055) {
    const geo = new THREE.SphereGeometry(radius * scale, 48, 48);
    const mat = new THREE.ShaderMaterial({
        vertexShader: `
            varying vec3 vNormalView;
            varying vec3 vWorldPos;
            varying vec3 vWorldNormal;
            void main() {
                vNormalView = normalize(normalMatrix * normal);
                vec4 worldP = modelMatrix * vec4(position, 1.0);
                vWorldPos = worldP.xyz;
                vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
                gl_Position = projectionMatrix * viewMatrix * worldP;
            }
        `,
        fragmentShader: `
            uniform vec3 uColor;
            uniform float uIntensity;
            varying vec3 vNormalView;
            varying vec3 vWorldPos;
            varying vec3 vWorldNormal;
            void main() {
                // Peak limb rim at grazing silhouette
                float rim = 1.0 - abs(vNormalView.z);
                rim = smoothstep(0.0, 1.0, rim);
                rim = pow(rim, 2.6);
                
                // Rayleigh scattering modulation by solar illumination (Sun at 0,0,0)
                vec3 sunDir = normalize(-vWorldPos);
                float sunDot = dot(vWorldNormal, sunDir);
                float sunFactor = smoothstep(-0.25, 0.35, sunDot);
                
                float finalGlow = rim * mix(0.10, 1.0, sunFactor) * uIntensity;
                gl_FragColor = vec4(uColor, finalGlow);
            }
        `,
        uniforms: {
            uColor: { value: new THREE.Color(colorHex) },
            uIntensity: { value: intensity }
        },
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false
    });
    const atmosMesh = new THREE.Mesh(geo, mat);
    atmosMesh.raycast = () => {}; // Transparent to raycasting so planet sphere is directly clickable
    return atmosMesh;
}

// Setup Camera with wide cinematic field of view
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 4000);
// Elevated overview camera showing ALL 9 PLANETS immediately
camera.position.set(0, 165, 195);

// Setup Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Setup Orbit Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxDistance = 550;
controls.minDistance = 15;
controls.enablePan = false;
controls.target.set(0, 0, 0);

// Lighting: Balanced solar illumination so planets reflect sharp textures without blooming
const ambientLight = new THREE.AmbientLight(0x223355, 0.38);
scene.add(ambientLight);

// Radiant Sun PointLight (Calibrated natural solar illumination)
const sunLight = new THREE.PointLight(0xfffaec, 110, 480, 1.15);
sunLight.position.set(0, 0, 0);
scene.add(sunLight);

// Secondary soft fill light for deep space
const hemiLight = new THREE.HemisphereLight(0x223344, 0x050510, 0.25);
scene.add(hemiLight);

// Post-processing (Balanced Bloom: Stars & Sun twinkle and glow tastefully without blinding)
const renderScene = new RenderPass(scene, camera);
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.30,
    0.30,
    0.95
);
bloomPass.threshold = 1.15; // Realistic threshold: preserves rich solar surface contrast and colors without washing out
bloomPass.strength = 0.35;
bloomPass.radius = 0.35;

const outputPass = new OutputPass();

const composer = new EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);
composer.addPass(outputPass);

// ==========================================
// PRELOADER & TEXTURE LOADING MANAGER
// ==========================================
const preloaderEl = document.getElementById('preloader');
const preloaderBar = document.getElementById('preloader-bar');
const preloaderPct = document.getElementById('preloader-pct');
const controlHintsEl = document.getElementById('control-hints');

function updatePreloaderProgress(pct) {
    if (preloaderBar) preloaderBar.style.width = `${Math.min(pct, 100)}%`;
    if (preloaderPct) preloaderPct.innerText = `${Math.round(Math.min(pct, 100))}%`;
}

let hasFinishedLoading = false;
function finishLoading() {
    if (hasFinishedLoading) return;
    hasFinishedLoading = true;
    updatePreloaderProgress(100);
    
    if (preloaderEl) {
        preloaderEl.classList.add('preloader-hidden');
        setTimeout(() => {
            if (preloaderEl.parentNode) preloaderEl.style.display = 'none';
        }, 850);
    }

    if (controlHintsEl) {
        controlHintsEl.classList.remove('hint-hidden');
        setTimeout(dismissControlHints, 4500);
    }

    if (localStorage.getItem('solar_guide_dismissed') !== 'true') {
        setTimeout(() => {
            if (window.__guideInteracted || localStorage.getItem('solar_guide_dismissed') === 'true') return;
            window.__guideInteracted = true;
            if (typeof showGuide === 'function') {
                showGuide();
            } else {
                const g = document.getElementById('guide-modal-container');
                if (g) {
                    g.classList.remove('hidden');
                    g.style.display = 'flex';
                }
            }
        }, 1200);
    }
}

function dismissControlHints() {
    if (controlHintsEl && !controlHintsEl.classList.contains('hint-hidden')) {
        controlHintsEl.classList.add('hint-hidden');
    }
}

window.addEventListener('pointerdown', dismissControlHints, { once: true });
window.addEventListener('wheel', dismissControlHints, { once: true });

const loadingManager = new THREE.LoadingManager(
    () => {
        updatePreloaderProgress(100);
        setTimeout(finishLoading, 400);
    },
    (item, loaded, total) => {
        const pct = (loaded / total) * 100;
        updatePreloaderProgress(pct);
    }
);

// Fallback in case textures are cached or load instantly
setTimeout(() => {
    updatePreloaderProgress(100);
    finishLoading();
}, 2200);

// Texture Loader
const textureLoader = new THREE.TextureLoader(loadingManager);
const textureBase = 'assets/';

const interactableObjects = [];

// ==========================================
// 1. PHOTOREALISTIC SUN (DYNAMIC GLSL SHADER & ATMOSPHERE)
// ==========================================

// ==========================================
// 1. PHOTOREALISTIC SUN (EXACT 1:1 NASA SDO CORONA & GRANULATION)
// ==========================================

const sunPhotosphereExact = textureLoader.load(textureBase + 'sun_disk_square.jpg');
sunPhotosphereExact.colorSpace = THREE.SRGBColorSpace;
const sunProminencesCorona = textureLoader.load(textureBase + 'sun_prominences_exact.png');
sunProminencesCorona.colorSpace = THREE.SRGBColorSpace;

const sunVertexShader = `
varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
varying vec3 vLocalPosition;
varying vec3 vViewNormal;

void main() {
    vUv = uv;
    vLocalPosition = position;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vViewNormal = normalize((viewMatrix * modelMatrix * vec4(normal, 0.0)).xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const sunFragmentShader = `
uniform float uTime;
uniform sampler2D uPhotosphereExact;
uniform sampler2D uPhotosphereTexture;

varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
varying vec3 vLocalPosition;
varying vec3 vViewNormal;

// 3D Simplex noise for convective boiling granulation
vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

void main() {
    vec3 worldViewDir = normalize(cameraPosition - vWorldPosition);
    float cosTheta = clamp(dot(vWorldNormal, worldViewDir), 0.0, 1.0);

    // Convective domain-warping fluid flow (simulating boiling liquid plasma inside the core)
    float t = uTime * 0.055;
    vec3 flowPos = vWorldPosition * 0.38;
    vec2 flowOffset1 = vec2(
        snoise(flowPos + vec3(0.0, t * 0.55, 0.0)),
        snoise(flowPos + vec3(t * 0.45, 0.0, t * 0.35))
    ) * 0.016;
    vec2 flowOffset2 = vec2(
        snoise(flowPos * 2.2 - vec3(t * 0.35, 0.0, 0.0)),
        snoise(flowPos * 2.2 + vec3(0.0, t * 0.35, 0.0))
    ) * 0.008;
    vec2 totalFlow = flowOffset1 + flowOffset2;

    // View-aligned disc mapping matching the camera orientation and prominence loop quad
    // In view space, vViewNormal.xy spans [-1.0, 1.0] across the disc
    // Radius in sun_disk_square.jpg is 0.4707 (center 0.5, 0.5)
    vec2 diskUV = vec2(
        0.5 + vViewNormal.x * 0.4707 + totalFlow.x,
        0.5 + vViewNormal.y * 0.4707 + totalFlow.y
    );
    diskUV = clamp(diskUV, vec2(0.002), vec2(0.998));

    vec4 photo = texture2D(uPhotosphereExact, diskUV);

    // Fine convective boiling granulation (Rayleigh-Bénard cells)
    vec3 granPos = vWorldPosition * 3.4;
    float gran1 = snoise(granPos + vec3(totalFlow * 28.0, t * 0.65));
    float gran2 = snoise(granPos * 2.2 + vec3(t * 0.45, 0.0, t * 0.35));
    float granulation = gran1 * 0.65 + gran2 * 0.35;

    // Active magnetic loops flux surging & breathing
    float activeFlux = smoothstep(0.62, 0.95, (photo.r * 0.6 + photo.g * 0.4));
    float fluxBreathe = activeFlux * (0.12 + 0.09 * sin(uTime * 2.4 + vWorldPosition.x * 0.6 + vWorldPosition.y * 0.5));

    // Base color from photo with rich, saturated golden-amber tone matching NASA SDO 171/304Å reference
    vec3 col = photo.rgb;
    // Boost contrast between deep convective magma lanes and bright granules
    col = pow(col, vec3(1.18));
    // Warm golden-amber saturation
    col = mix(col, vec3(col.r * 1.06, col.g * 0.85, col.b * 0.40), 0.35);

    // Deep convective boiling ridges & bright hot granules
    col += vec3(0.08, 0.04, -0.02) * granulation;

    // Surging active magnetic loop flux
    col += vec3(0.22, 0.16, 0.04) * fluxBreathe;

    // Solar limb darkening (deep fiery magma at the limb)
    float limbDarkening = 0.50 + 0.50 * pow(cosTheta, 0.70);
    col = mix(vec3(0.82, 0.24, 0.01), col, limbDarkening);

    // Brilliant golden chromospheric rim
    float rim = pow(1.0 - cosTheta, 3.8);
    col += vec3(1.0, 0.90, 0.35) * rim * 0.75;

    // Soft cosmic breathing
    col *= (0.985 + 0.015 * sin(uTime * 0.85));

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

const sunUniforms = {
    uTime: { value: 0 },
    uPhotosphereExact: { value: sunPhotosphereExact },
    uPhotosphereTexture: { value: sunPhotosphereExact }
};

const sunGeometry = new THREE.SphereGeometry(7.2, 64, 64);
const sunMaterial = new THREE.ShaderMaterial({
    uniforms: sunUniforms,
    vertexShader: sunVertexShader,
    fragmentShader: sunFragmentShader,
    depthWrite: true,
    transparent: false
});
const sun = new THREE.Mesh(sunGeometry, sunMaterial);
sun.renderOrder = 1;
scene.add(sun);

// ==========================================
// DYNAMIC CORONAL RAYS & SOLAR PROMINENCE ATMOSPHERE
// ==========================================

const coronaVertexShader = `
varying vec2 vUv;
varying vec3 vWorldPosition;

void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const coronaFragmentShader = `
uniform float uTime;
uniform sampler2D uProminenceTexture;

varying vec2 vUv;
varying vec3 vWorldPosition;

// 2D Simplex noise for dynamic ray turbulence
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
           -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
  + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
    dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
    vec2 p = vUv - 0.5;
    float dist = length(p);
    float angle = atan(p.y, p.x);

    // Sun sphere rim is at dist = 0.1636 (radius 7.2 in 44.0 quad)
    float sunRim = 0.1636;

    // Butter-smooth inner fade right at the limb - eliminates any jagged seams or depth fighting!
    float innerFade = smoothstep(sunRim - 0.016, sunRim + 0.006, dist);
    if (innerFade <= 0.001) {
        discard;
    }

    // 1. Dynamic Coronal Rays (Solar Streamers waving outwards into space)
    float t = uTime * 0.15;

    // Multi-frequency radial streamers
    float ray1 = sin(angle * 16.0 + snoise(vec2(angle * 3.2, t * 0.4)) * 2.4 + t * 0.32);
    float ray2 = cos(angle * 32.0 - t * 0.52 + snoise(vec2(angle * 6.5, t * 0.55)) * 1.8);
    float ray3 = sin(angle * 64.0 + t * 0.72 + snoise(vec2(angle * 12.0, t * 0.85)) * 1.2);

    float rawRays = ray1 * 0.48 + ray2 * 0.36 + ray3 * 0.16;
    float rayPattern = pow(0.5 + 0.5 * rawRays, 2.2);

    // Radial distance beyond the rim (0.0 at rim, 1.0 at outer fade radius)
    float normDist = clamp((dist - sunRim) / (0.45 - sunRim), 0.0, 1.0);

    // Exponential atmospheric coronal falloff (smooth, non-blinding, fades before quad edge)
    float coronaFade = exp(-normDist * 5.0) * (1.0 - smoothstep(0.65, 0.98, normDist));

    // Dynamic streamer intensity (soft, luminous rays stretching into deep space)
    float streamerLight = rayPattern * coronaFade * 0.74 * innerFade;

    // Warm atmospheric halo right around the limb
    float haloLight = pow(1.0 - normDist, 3.0) * 0.48 * innerFade;

    // 2. Animated Prominence Loops & Eruptive Flares
    // Scale factor: 0.9414 / (14.4 / 44.0) = 2.8766
    vec2 promUV = (vUv - 0.5) * 2.8766 + 0.5;
    vec4 promCol = vec4(0.0);
    if (promUV.x > 0.01 && promUV.x < 0.99 && promUV.y > 0.01 && promUV.y < 0.99) {
        // Soft border feathering to guarantee zero square edge
        float edgeFeather = smoothstep(0.01, 0.08, promUV.x) * smoothstep(0.99, 0.92, promUV.x) *
                            smoothstep(0.01, 0.08, promUV.y) * smoothstep(0.99, 0.92, promUV.y);
        
        // Fluid plasma warp along the prominence arch
        vec2 promWarp = promUV + vec2(
            snoise(vec2(promUV.x * 12.0 + t * 0.7, promUV.y * 12.0)),
            snoise(vec2(promUV.x * 12.0, promUV.y * 12.0 + t * 0.7))
        ) * 0.010;
        
        promCol = texture2D(uProminenceTexture, promWarp) * edgeFeather;
        
        // Plasma scintillation along magnetic field lines
        float plasmaScint = snoise(vec2(angle * 20.0 + t * 1.2, dist * 30.0 - t * 0.5));
        promCol.rgb *= (0.90 + 0.22 * plasmaScint);
    }

    // Color gradient for the rays:
    // Brilliant golden core -> warm solar amber -> deep fiery orange space streamers
    vec3 rayColor = mix(
        vec3(1.0, 0.88, 0.38), // warm luminous gold at limb
        vec3(0.96, 0.40, 0.04), // fiery amber outer streamers
        pow(normDist, 0.65)
    );

    vec3 col = rayColor * (streamerLight + haloLight);

    // Add prominence loop and flares
    col += promCol.rgb * promCol.a * 1.20;

    float alpha = clamp(coronaFade * (rayPattern * 0.6 + 0.4) * 0.78 + promCol.a * 0.88, 0.0, 1.0);

    // Gentle organic solar pulsation
    col *= (0.975 + 0.025 * sin(uTime * 0.75));

    gl_FragColor = vec4(col, alpha);
}
`;

const coronaUniforms = {
    uTime: { value: 0 },
    uProminenceTexture: { value: sunProminencesCorona }
};

const coronaMaterial = new THREE.ShaderMaterial({
    uniforms: coronaUniforms,
    vertexShader: coronaVertexShader,
    fragmentShader: coronaFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide
});

const prominenceGeo = new THREE.PlaneGeometry(44.0, 44.0);
const prominenceMesh = new THREE.Mesh(prominenceGeo, coronaMaterial);
prominenceMesh.renderOrder = 2;
scene.add(prominenceMesh);

sun.userData = { 
    id: 'sun',
    isSun: true, 
    badge: 'Markaziy Yulduz • Developer Profili',
    title: 'Azimjon Kamiljanov (Lead AI Architect)', 
    subtitle: 'Lead AI Systems Architect • Senior Full-Stack Engineer',
    content: `Assalomu alaykum! Men Azimjon Kamiljanov — sun'iy intellekt agentlari, yuqori yuklamali mikroxizmatlar, 3D WebGL interfeyslar va xavfsiz taqsimlangan tizimlar me'moriman.

Apparat & Laboratoriya:
• Model: Lenovo Legion Pro 5
• CPU: AMD Ryzen 9 9955HX (32 vCPU threads)
• GPU: NVIDIA GeForce RTX 5070 Laptop GPU (8GB VRAM)
• RAM: 32 GB DDR5 | SSD: 1 TB NVMe SSD
• Tizim: EndeavourOS Linux (Linux 7.2.3-zen kernel)

Asosiy Texnologik Stack:
• AI & ML: Python 3.12, PyTorch 2.14 + CUDA 13, Transformers, Whisper Large-v3-Turbo, Kokoro TTS, Gemini 3.8 Flash, DeepSeek R1, Groq LPU.
• Frontend & 3D: Three.js / WebGL, GLSL Shaders, React, Next.js, TypeScript, TailwindCSS.
• Backend & DevOps: Node.js, Express, Docker Engine 29.7.2, Portainer, PostgreSQL, Redis, Cloudflare Tunnels, DevSecOps (OWASP GenAI).

Dizaynda minimalist estetika, qat'iy mantiq va 100% ishonchlilik tarafdoriman.`,
    tags: ['Azimjon Kamiljanov', 'Three.js / WebGL', 'PyTorch CUDA 13', 'AI Agents', 'Docker', 'DevSecOps', 'RTX 5070'],
    actionUrl: 'https://t.me/KamiljanovAzimjon',
    actionText: 'Telegramda Bog\'lanish',
    githubUrl: 'https://github.com/AzimjonKamiljanov',
    githubText: 'GitHub Profil',
    radius: 7.2
};
interactableObjects.push(sun);

// Helper function to create 3D Holographic Billboard Labels
function createLabelSprite(text, icon, colorHex = '#ffaa00') {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    
    // Rounded pill container
    const r = 24;
    const x = 16, y = 16, w = 352, h = 64;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    
    ctx.fillStyle = 'rgba(8, 10, 18, 0.82)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = colorHex;
    ctx.stroke();
    
    // Label text
    ctx.font = 'bold 27px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${icon} ${text}`, canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ 
        map: texture, 
        transparent: true,
        depthTest: true
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(6.8, 1.7, 1);
    return sprite;
}

// Sun Label (omitted from 3D scene to keep nuclear core clean and minimalist)
const sunLabel = createLabelSprite('Quyosh', '☀️', '#ffaa00');
sunLabel.position.y = 9.8;
// sun.add(sunLabel);

// 5-YO'NALISH BOOST: Scale Comparison Label Generator
function createScaleLabelSprite(name, diameterKm, colorHex = '#38bdf8') {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 110;
    const ctx = canvas.getContext('2d');
    
    const r = 24;
    const x = 16, y = 14, w = 352, h = 82;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    
    ctx.fillStyle = 'rgba(10, 14, 24, 0.90)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = colorHex;
    ctx.stroke();
    
    ctx.font = 'bold 24px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(name, canvas.width / 2, 45);
    
    ctx.font = '600 20px "JetBrains Mono", monospace';
    ctx.fillStyle = colorHex;
    ctx.fillText(`⌀ ${diameterKm}`, canvas.width / 2, 74);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(7.5, 2.15, 1);
    sprite.visible = false;
    return sprite;
}

function updateScaleLabelSprite(sprite, name, diameterKm, colorHex = '#38bdf8') {
    if (!sprite || !sprite.material || !sprite.material.map) return;
    const canvas = sprite.material.map.image;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const r = 24, x = 16, y = 14, w = 352, h = 82;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fillStyle = 'rgba(10, 14, 24, 0.90)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = colorHex;
    ctx.stroke();
    ctx.font = 'bold 24px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(name, canvas.width / 2, 45);
    ctx.font = '600 20px "JetBrains Mono", monospace';
    ctx.fillStyle = colorHex;
    ctx.fillText(`⌀ ${diameterKm}`, canvas.width / 2, 74);
    sprite.material.map.needsUpdate = true;
}

function updateLabelSprite(sprite, text, icon, colorHex = '#38bdf8') {
    if (!sprite || !sprite.material || !sprite.material.map) return;
    const canvas = sprite.material.map.image;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const r = 24, x = 16, y = 16, w = 352, h = 64;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fillStyle = 'rgba(8, 10, 18, 0.82)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = colorHex;
    ctx.stroke();
    ctx.font = 'bold 27px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${icon} ${text}`, canvas.width / 2, canvas.height / 2);
    sprite.material.map.needsUpdate = true;
}

const sunScaleLabel = createScaleLabelSprite('Quyosh', '1,392,700 km', '#ffaa00');
sunScaleLabel.position.y = 10.5;
sun.add(sunScaleLabel);
sun.userData.scaleLabel = sunScaleLabel;

// ==========================================
// PHOTOREALISTIC PROCEDURAL PLANETARY RINGS (NASA CASSINI & JWST SPEC)
// ==========================================

function createRadialRingGeometry(innerRadius, outerRadius, thetaSegments = 160, phiSegments = 32) {
    const geo = new THREE.RingGeometry(innerRadius, outerRadius, thetaSegments, phiSegments);
    const pos = geo.attributes.position;
    const uvs = geo.attributes.uv;
    
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const r = Math.sqrt(x * x + y * y);
        const u = Math.min(1.0, Math.max(0.0, (r - innerRadius) / (outerRadius - innerRadius)));
        uvs.setXY(i, u, 0.5);
    }
    geo.attributes.uv.needsUpdate = true;
    return geo;
}

// Photorealistic Saturn Ring Texture (2048px NASA Cassini profile: C ring, B ring, Cassini Division, A ring, Encke gap)
function createSaturnRingTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const w = canvas.width;
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    
    // D & C Ring (Faint inner dust)
    grad.addColorStop(0.00, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.05, 'rgba(110, 95, 75, 0.08)');
    grad.addColorStop(0.10, 'rgba(145, 128, 100, 0.28)');
    // C Ring (Crepe Ring)
    grad.addColorStop(0.18, 'rgba(165, 142, 110, 0.42)');
    grad.addColorStop(0.24, 'rgba(140, 120, 95, 0.35)');
    // Maxwell Gap
    grad.addColorStop(0.26, 'rgba(30, 25, 20, 0.05)');
    grad.addColorStop(0.27, 'rgba(170, 145, 112, 0.50)');
    // B Ring (Main, densest, brightest golden multi-banded ring)
    grad.addColorStop(0.30, 'rgba(235, 212, 168, 0.92)');
    grad.addColorStop(0.38, 'rgba(245, 225, 182, 0.98)');
    grad.addColorStop(0.46, 'rgba(228, 205, 160, 0.90)');
    grad.addColorStop(0.54, 'rgba(242, 222, 178, 0.95)');
    grad.addColorStop(0.61, 'rgba(220, 195, 150, 0.88)');
    // CASSINI DIVISION (The legendary dark gap ~4800 km wide)
    grad.addColorStop(0.625, 'rgba(5, 5, 5, 0.02)');
    grad.addColorStop(0.675, 'rgba(8, 8, 8, 0.03)');
    // A Ring (Outer bright ring)
    grad.addColorStop(0.69, 'rgba(215, 195, 160, 0.82)');
    grad.addColorStop(0.77, 'rgba(205, 185, 150, 0.78)');
    grad.addColorStop(0.83, 'rgba(195, 175, 140, 0.74)');
    // Encke Gap (Sharp narrow gap)
    grad.addColorStop(0.855, 'rgba(10, 8, 6, 0.03)');
    grad.addColorStop(0.865, 'rgba(190, 170, 138, 0.70)');
    // A Ring outer edge
    grad.addColorStop(0.93, 'rgba(170, 150, 120, 0.55)');
    // Keeler Gap & F ring boundary
    grad.addColorStop(0.95, 'rgba(10, 8, 6, 0.02)');
    grad.addColorStop(0.965, 'rgba(140, 125, 100, 0.35)');
    grad.addColorStop(1.00, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, canvas.height);
    
    // Fine procedural micro-striations (hundreds of delicate sub-rings)
    for (let x = 0; x < w; x++) {
        const u = x / w;
        if ((u > 0.625 && u < 0.675) || (u > 0.852 && u < 0.868) || u < 0.05 || u > 0.97) continue;
        const microNoise = Math.sin(x * 0.45) * 0.08 + Math.sin(x * 1.4) * 0.04;
        if (microNoise > 0) {
            ctx.fillStyle = `rgba(255, 245, 225, ${microNoise * 0.22})`;
        } else {
            ctx.fillStyle = `rgba(30, 20, 10, ${-microNoise * 0.28})`;
        }
        ctx.fillRect(x, 0, 1, canvas.height);
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
}

// Photorealistic Uranus Ring Texture (1024px Voyager 2 & JWST faint icy cyan profile)
function createUranusRingTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const w = canvas.width;
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    
    grad.addColorStop(0.00, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.14, 'rgba(0, 0, 0, 0)');
    // Faint inner rings (6, 5, 4, alpha, beta)
    grad.addColorStop(0.20, 'rgba(140, 195, 220, 0.22)');
    grad.addColorStop(0.26, 'rgba(100, 150, 180, 0.12)');
    grad.addColorStop(0.38, 'rgba(150, 210, 235, 0.30)');
    grad.addColorStop(0.45, 'rgba(90, 140, 170, 0.08)');
    grad.addColorStop(0.58, 'rgba(160, 220, 245, 0.35)');
    grad.addColorStop(0.66, 'rgba(80, 130, 160, 0.05)');
    // Eta, Gamma, Delta rings
    grad.addColorStop(0.74, 'rgba(170, 230, 250, 0.45)');
    grad.addColorStop(0.80, 'rgba(70, 120, 150, 0.05)');
    // THE EPSILON (ε) RING - The brightest icy ring
    grad.addColorStop(0.88, 'rgba(215, 248, 255, 0.95)');
    grad.addColorStop(0.93, 'rgba(185, 238, 255, 0.85)');
    grad.addColorStop(0.97, 'rgba(120, 185, 215, 0.25)');
    grad.addColorStop(1.00, 'rgba(0, 0, 0, 0)');
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, canvas.height);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
}

// ==========================================
// 2. THE 9 PLANETS DATA (HARMONIOUS CONCENTRIC ORBITS)
// ==========================================

const planetsData = [
    { 
        id: 'Mercury',
        name: 'Merkuriy', 
        icon: '☿',
        radius: 0.95, 
        diameterKm: '4,879 km',
        distance: 16, 
        speed: 0.012, 
        texture: 'mercury_2048.jpg', 
        color: 0xb5b2ad, 
        tilt: 0.03,
        badge: '1-Sayyora • Enterprise Platform',
        title: 'CareTrack Clinic • Medical ERP', 
        subtitle: 'Klinikalar va Shifoxonalar uchun Avtomatlashtirilgan CRM/ERP',
        content: `Tibbiyot muassasalari uchun to'liq tsiklli enterprise boshqaruv platformasi.
Bemorlar qabuli, elektron tibbiy kartalar (EMR), shifokorlar ish jadvali, laboratoriya tahlillari va moliya hisobotlarini birlashtiruvchi tezkor tizim.

Xavfsiz ma'lumotlar shifrlanishi (HIPAA standartlari), role-based audit va real vaqtda yangilanuvchi boshqaruv paneli bilan ta'minlangan.`,
        tags: ['Next.js', 'React', 'Node.js', 'PostgreSQL', 'TailwindCSS', 'REST API', 'Medical ERP'],
        actionUrl: 'https://github.com/AzimjonKamiljanov/caretrack-clinic',
        actionText: 'caretrack-clinic',
        githubUrl: 'https://github.com/AzimjonKamiljanov/caretrack-clinic',
        githubText: 'caretrack-clinic'
    },
    { 
        id: 'Venus',
        name: 'Venera', 
        icon: '♀',
        radius: 1.35, 
        diameterKm: '12,104 km',
        distance: 26, 
        speed: 0.0085, 
        texture: 'venus_2048.jpg', 
        color: 0xe8c892, 
        tilt: 177.3,
        hasAtmosphere: true,
        atmosphereColor: 0xfcd34d,
        atmosphereIntensity: 1.1,
        badge: '2-Sayyora • Voice AI & Robotics',
        title: 'Jarvis-X • Autonomous Desktop Voice Assistant', 
        subtitle: 'Ovozli Buyruqlar, Desktop Avtomatizatsiyasi va Aqlli Yordamchi',
        content: `Foydalanuvchi ovozini real vaqtda tushunib, dasturlar ochish, skriptlar yurgizish, brauzerni boshqarish va murakkab operatsion tizim vazifalarini bajaruvchi mustaqil yordamchi.

Modular, offline-capable, multilingual (EN/UZ) arxitektura, mahalliy STT/TTS dvigatellari va FastAPI backend.`,
        tags: ['Python', 'Voice AI', 'SpeechRecognition', 'Kokoro TTS', 'System Automation', 'FastAPI'],
        actionUrl: 'https://github.com/AzimjonKamiljanov/Jarvis-x',
        actionText: 'Jarvis-x',
        githubUrl: 'https://github.com/AzimjonKamiljanov/Jarvis-x',
        githubText: 'Jarvis-x'
    },
    { 
        id: 'Earth',
        name: 'Yer', 
        icon: 'orb-earth',
        radius: 1.55, 
        diameterKm: '12,742 km',
        distance: 38, 
        speed: 0.0062, 
        texture: 'earth_atmos_2048.jpg', 
        specular: 'earth_specular_2048.jpg', 
        normal: 'earth_normal_2048.jpg', 
        color: 0xffffff, 
        tilt: 23.4,
        hasClouds: true,
        hasMoon: true,
        moonDistance: 3.4,
        hasAtmosphere: true,
        atmosphereColor: 0x38bdf8,
        atmosphereIntensity: 1.35,
        hasNightLights: true,
        badge: '3-Sayyora • Flagship AI Loyiha',
        title: 'CyberAgent TITAN NEXUS', 
        subtitle: 'Shaxsiy Avtonom Super-Agent va Telegram Ovozli Duplex VoIP Tizimi',
        content: `Azimjon Kamiljanovning bosh flagman loyihasi.
Gemini 3.8 Flash, Groq, DeepSeek R1 va mahalliy RTX 5070 GPU (Whisper + Kokoro TTS) vositasida ishlovchi avtonom kiber-agent.

Hydrogram VoIP dvigateli orqali 1-on-1 telefon qo'ng'iroqlari, jonli duplex ovozli muloqot va tizimdagi 180 dan ortiq vositalarni (Docker, bash, fayllar, skriptlar) avtonom boshqarish qobiliyatiga ega.`,
        tags: ['Gemini 3.8 Flash', 'Telegram VoIP', 'WebRTC Duplex', 'RTX 5070 CUDA', 'PyTorch', 'Docker'],
        actionUrl: 'https://github.com/AzimjonKamiljanov/CyberAgent',
        actionText: 'CyberAgent Repo',
        githubUrl: 'https://github.com/AzimjonKamiljanov/CyberAgent',
        githubText: 'CyberAgent'
    },
    { 
        id: 'Mars',
        name: 'Mars', 
        icon: '♂',
        radius: 1.15, 
        diameterKm: '6,779 km',
        distance: 50, 
        speed: 0.0048, 
        texture: 'mars_2048.jpg', 
        color: 0xdb582a, 
        tilt: 25.2,
        badge: '4-Sayyora • 3D CAD & Smeta Engine',
        title: 'UstaPro Master CAD 3D • Construction Platform', 
        subtitle: 'Muhandislik 3D Hisob-kitob, Tom, Pol, Shift va Avtomatlashtirilgan Smeta',
        content: `Telegram Mini App va web uchun mo'ljallangan 3D CAD arxitektura platformasi.
O'zbekiston qurilish standartlari asosida kvadratura, materiallar sarfi (m³, dona, kg, profil) va smetani avtomatik hisoblaydi.

Three.js 3D interaktiv modeli, 2D blueprint rejimi, solo-inspektor va Cloudflare HTTPS xavfsiz tunneli bilan jihozlangan. 98/98 testlar 100% PASS.`,
        tags: ['Three.js 3D', 'CAD Engine', 'Telegram Mini App', 'JavaScript', 'Cloudflare Tunnel', 'Engineering'],
        actionUrl: 'https://github.com/AzimjonKamiljanov',
        actionText: 'UstaPro CAD',
        githubUrl: 'https://github.com/AzimjonKamiljanov',
        githubText: 'GitHub Profil'
    },
    { 
        id: 'Jupiter',
        name: 'Yupiter', 
        icon: '♃',
        radius: 3.0, 
        diameterKm: '139,820 km',
        distance: 68, 
        speed: 0.0028, 
        texture: 'jupiter_2048.jpg', 
        color: 0xdf9b64, 
        tilt: 3.1,
        badge: '5-Sayyora • DevSecOps & Security Engine',
        title: 'Sentinel ECC Matrix • Resilient Distributed Architecture', 
        subtitle: 'Xatoliklarga Chidamli ECC Matritsa va Xavfsiz Docker Sandboxing',
        content: `Katta hajmli hisoblashlarda xatoliklarni avtomatik tuzatuvchi (ECC) hamda xavfsiz izolyatsiyalangan Docker sandboxing platformasi.

OWASP GenAI 2026 xatarlarini oldini olish, terminal buyruqlarini audit qilish va benchmark testlarini o'tkazish imkoniyati (/home/cyber/projects/sentinel-ecc-matrix). Poliglot arxitektura: Go, Python, Rust, TypeScript.`,
        tags: ['DevSecOps', 'Docker Sandboxing', 'Matrix Benchmark', 'Python', 'OWASP Security'],
        actionUrl: 'https://github.com/AzimjonKamiljanov',
        actionText: 'Sentinel Matrix',
        githubUrl: 'https://github.com/AzimjonKamiljanov',
        githubText: 'GitHub Profil'
    },
    { 
        id: 'Saturn',
        name: 'Saturn', 
        icon: '♄',
        radius: 2.4, 
        diameterKm: '116,460 km',
        distance: 88, 
        speed: 0.0020, 
        texture: 'saturn_2048.jpg', 
        color: 0xe5c78a, 
        hasRing: true,
        ringInner: 2.9,
        ringOuter: 5.85,
        tilt: 26.7,
        badge: '6-Sayyora • Multi-Agent Swarm',
        title: 'Elite AI Agent • Multi-Agent Swarm Framework', 
        subtitle: 'Murakkab Muammolarni Taqsimlangan Holda Bajaruvchi Agentlar Galaktikasi',
        content: `Ko'p agentli hamkorlik arxitekturasi: Planner, Coder, Critic va Tester rollaridagi mustaqil agentlar yagona maqsad sari sinxron ishlaydi.

Avtonom ravishda kod yozish, testlarni yurgizish, xatolarni tahlil qilish va loyihalarni ishlab chiqish jarayonini 100% avtomatlashtiradi.`,
        tags: ['Multi-Agent Swarm', 'Autonomous Agents', 'Python', 'ReAct', 'AsyncIO', 'LangChain'],
        actionUrl: 'https://github.com/AzimjonKamiljanov/elite-ai-agent',
        actionText: 'elite-ai-agent',
        githubUrl: 'https://github.com/AzimjonKamiljanov/elite-ai-agent',
        githubText: 'elite-ai-agent'
    },
    { 
        id: 'Uranus',
        name: 'Uran', 
        icon: '♅',
        radius: 1.8, 
        diameterKm: '50,724 km',
        distance: 108, 
        speed: 0.0014, 
        texture: 'uranus_2048.jpg', 
        color: 0x93d7e8, 
        hasRing: true,
        ringInner: 2.3,
        ringOuter: 3.75,
        tilt: 97.8,
        hasAtmosphere: true,
        atmosphereColor: 0x67e8f9,
        atmosphereIntensity: 0.9,
        badge: '7-Sayyora • Cloud Web Solutions',
        title: 'Modern Full-Stack Ecosystem • Enterprise Web', 
        subtitle: 'Mikroxizmatlar, REST/GraphQL API va Yuqori Yuklamali Web Ilovalar',
        content: `Zamonaviy korporativ web platformalar uchun modular arxitektura.

React / Next.js frontend, Node.js / Express backend mikroxizmatlari, Redis kesh qatlami, PostgreSQL ma'lumotlar bazasi va Docker Compose orqali to'liq klasterlangan infrastrukturani o'z ichiga oladi.`,
        tags: ['React', 'TypeScript', 'Node.js', 'Express', 'PostgreSQL', 'Redis', 'Docker'],
        actionUrl: 'https://github.com/AzimjonKamiljanov/full-stack-',
        actionText: 'full-stack-framework',
        githubUrl: 'https://github.com/AzimjonKamiljanov/full-stack-',
        githubText: 'full-stack-'
    },
    { 
        id: 'Neptune',
        name: 'Neptun', 
        icon: '♆',
        radius: 1.7, 
        diameterKm: '49,244 km',
        distance: 126, 
        speed: 0.0010, 
        texture: 'neptune_2048.jpg', 
        color: 0x3d66cc, 
        tilt: 28.3,
        hasAtmosphere: true,
        atmosphereColor: 0x3b82f6,
        atmosphereIntensity: 1.25,
        badge: '8-Sayyora • Deep Learning & Neural Networks',
        title: 'AI Learning & Deep Learning Lab • RTX 5070 CUDA', 
        subtitle: 'PyTorch 2.14, CUDA 13 va 200+ Zamonaviy AI/ML Kutubxonalar',
        content: `Lenovo Legion Pro 5 va NVIDIA RTX 5070 GPU (8GB VRAM) imkoniyatlariga to'liq sozlangan mahalliy sun'iy intellekt laboratoriyasi.

Kompyuter ko'rishi (CV), NLP, Transformer modellarini nozik sozlash (Fine-tuning), Optuna giperparametrlar optimizatsiyasi va TensorBoard tahlillari (/home/cyber/Ai-learning/).`,
        tags: ['PyTorch', 'CUDA 13', 'RTX 5070 Laptop GPU', 'Transformers', 'OpenCV', 'Deep Learning'],
        actionUrl: 'https://github.com/AzimjonKamiljanov',
        actionText: 'AI Laboratoriya',
        githubUrl: 'https://github.com/AzimjonKamiljanov',
        githubText: 'GitHub Profil'
    },
    { 
        id: 'Pluto',
        name: 'Pluton', 
        icon: '♇',
        radius: 0.85, 
        diameterKm: '2,376 km',
        distance: 142, 
        speed: 0.00075, 
        texture: 'pluto_2048.jpg', 
        color: 0xba9e83, 
        tilt: 122.5,
        badge: '9-Sayyora • Cloud Fleet & Edge Computing',
        title: 'Google Jules Cloud Fleet & Poco Orchestrator', 
        subtitle: 'Google Labs Jules SDK, Cloud VM Fleet va Avtonom PR Generator',
        content: `Google Jules SDK orqali 8 ta GitHub repozitoriy bilan to'g'ridan-to'g'ri integratsiya qilingan bulutli agentlar armiyasi.

Antigravity va terminal orqali Google Cloud VM'larida murakkab dasturlash vazifalarini avtonom bajarib, tayyor Pull Requestlar shakllantiradi va jules-orchestrator orqali boshqariladi.`,
        tags: ['Google Jules SDK', 'Cloud Fleet', 'GitHub API', 'Poco', 'CLI Automation', 'DevOps'],
        actionUrl: 'https://github.com/AzimjonKamiljanov/Poco',
        actionText: '⚪ Poco & Jules',
        githubUrl: 'https://github.com/AzimjonKamiljanov/Poco',
        githubText: 'Poco'
    }
];

let saturnGlobeMesh = null;
let moonMeshRef = null;
let moonOrbitCenterRef = null;
let jupiterMoonsCenterRef = null;
let saturnMoonsCenterRef = null;
const earthEclipseUniforms = {
    uMoonWorldPos: { value: new THREE.Vector3(9999, 9999, 9999) },
    uEclipseRadius: { value: 0.65 }
};
const jupiterMoonsList = [];
const saturnMoonsList = [];

const saturnRingUniforms = {
    uSunDirLocal: { value: new THREE.Vector3(1, 0, 0) },
    uSaturnRadius: { value: 2.4 }
};

function updateSaturnRingShadow() {
    if (!saturnGlobeMesh) return;
    const saturnWorldPos = new THREE.Vector3();
    saturnGlobeMesh.getWorldPosition(saturnWorldPos);
    // Sun is at (0, 0, 0) in world space
    const sunDirWorld = saturnWorldPos.clone().negate().normalize();
    const saturnWorldQuat = new THREE.Quaternion();
    saturnGlobeMesh.getWorldQuaternion(saturnWorldQuat);
    const invSaturnRot = saturnWorldQuat.invert();
    const sunDirLocal = sunDirWorld.applyQuaternion(invSaturnRot);
    saturnRingUniforms.uSunDirLocal.value.copy(sunDirLocal);
}

const planets = [];

planetsData.forEach(data => {
    const orbitGroup = new THREE.Group();
    scene.add(orbitGroup);
    
    const geom = new THREE.SphereGeometry(data.radius, 64, 64);
    
    // When texture is present, use color 0xffffff so the high-res texture colors render purely
    const materialOptions = {
        roughness: 0.72,
        metalness: 0.08,
        color: data.texture ? 0xffffff : data.color
    };
    
    if (data.texture) materialOptions.map = textureLoader.load(textureBase + data.texture);
    if (data.normal) materialOptions.normalMap = textureLoader.load(textureBase + data.normal);
    if (data.specular) materialOptions.metalnessMap = textureLoader.load(textureBase + data.specular);
    
    const mat = new THREE.MeshStandardMaterial(materialOptions);

    // 2-YO'NALISH: Earth Dynamic Night City Lights on unlit hemisphere & Real Solar Eclipse
    if (data.id === 'Earth' && data.hasNightLights) {
        const earthNightTex = textureLoader.load(textureBase + 'earth_night_2048.jpg');
        earthNightTex.colorSpace = THREE.SRGBColorSpace;
        mat.onBeforeCompile = (shader) => {
            shader.uniforms.uNightTexture = { value: earthNightTex };
            shader.uniforms.uMoonWorldPos = earthEclipseUniforms.uMoonWorldPos;
            shader.uniforms.uEclipseRadius = earthEclipseUniforms.uEclipseRadius;
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `#include <common>
                 varying vec3 vEarthWorldPos;
                 varying vec3 vEarthWorldNormal;`
            );
            shader.vertexShader = shader.vertexShader.replace(
                '#include <worldpos_vertex>',
                `#include <worldpos_vertex>
                 vEarthWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
                 vEarthWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);`
            );
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <common>',
                `#include <common>
                 uniform sampler2D uNightTexture;
                 uniform vec3 uMoonWorldPos;
                 uniform float uEclipseRadius;
                 varying vec3 vEarthWorldPos;
                 varying vec3 vEarthWorldNormal;`
            );
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <emissivemap_fragment>',
                `#include <emissivemap_fragment>
                 #ifdef USE_MAP
                 vec3 lightToSun = normalize(-vEarthWorldPos);
                 float NdotL = dot(vEarthWorldNormal, lightToSun);
                 float nightFactor = smoothstep(0.10, -0.25, NdotL);
                 vec3 nightLights = texture2D(uNightTexture, vMapUv).rgb * nightFactor * 2.5;
                 totalEmissiveRadiance += nightLights;
                 #endif`
            );
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <dithering_fragment>',
                `#include <dithering_fragment>
                 // Real Solar Eclipse: calculate Moon shadow umbra on Earth
                 vec3 sunToFrag = vEarthWorldPos;
                 float distFrag = length(sunToFrag);
                 vec3 rayDir = normalize(sunToFrag);
                 float tMoon = dot(uMoonWorldPos, rayDir);
                 float distMoon = length(uMoonWorldPos);
                 if (tMoon > 0.0 && distMoon < distFrag) {
                     vec3 closestMoonPt = rayDir * tMoon;
                     float perpDist = length(uMoonWorldPos - closestMoonPt);
                     float eclipseShadow = smoothstep(uEclipseRadius * 0.35, uEclipseRadius * 1.5, perpDist);
                     gl_FragColor.rgb *= mix(0.12, 1.0, eclipseShadow);
                 }`
            );
        };
    }

    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.x = data.distance;
    
    // Real astronomical axial tilt
    if (data.tilt) {
        mesh.rotation.z = THREE.MathUtils.degToRad(data.tilt);
    }
    
    // Distribute planets harmoniously around the solar system
    const initialAngle = (data.distance * 0.85) % (Math.PI * 2);
    orbitGroup.rotation.y = initialAngle;

    // Photorealistic Rings for Saturn & Uranus with Cassini Real Globe Shadow
    let ringMesh = null;
    if (data.hasRing && data.ringInner && data.ringOuter) {
        const ringGeo = createRadialRingGeometry(data.ringInner, data.ringOuter, 180, 32);
        const ringTex = data.id === 'Saturn' ? createSaturnRingTexture() : createUranusRingTexture();
        const ringMat = new THREE.MeshStandardMaterial({
            map: ringTex,
            side: THREE.DoubleSide,
            transparent: true,
            roughness: 0.52,
            metalness: 0.08,
            alphaTest: 0.015
        });

        // 2-YO'NALISH: Saturn Globe Shadow cast onto its Rings
        if (data.id === 'Saturn') {
            saturnGlobeMesh = mesh;
            ringMat.onBeforeCompile = (shader) => {
                shader.uniforms.uSunDirLocal = saturnRingUniforms.uSunDirLocal;
                shader.uniforms.uSaturnRadius = saturnRingUniforms.uSaturnRadius;
                shader.vertexShader = shader.vertexShader.replace(
                    '#include <common>',
                    `#include <common>
                     varying vec3 vRingLocalPos;`
                );
                shader.vertexShader = shader.vertexShader.replace(
                    '#include <begin_vertex>',
                    `#include <begin_vertex>
                     vRingLocalPos = position;`
                );
                shader.fragmentShader = shader.fragmentShader.replace(
                    '#include <common>',
                    `#include <common>
                     uniform vec3 uSunDirLocal;
                     uniform float uSaturnRadius;
                     varying vec3 vRingLocalPos;`
                );
                shader.fragmentShader = shader.fragmentShader.replace(
                    '#include <dithering_fragment>',
                    `#include <dithering_fragment>
                     vec3 globePos = vec3(vRingLocalPos.x, -vRingLocalPos.z, vRingLocalPos.y);
                     float proj = dot(globePos, uSunDirLocal);
                     if (proj < 0.0) {
                         float distToAxis = length(globePos - proj * uSunDirLocal);
                         float shadow = smoothstep(uSaturnRadius * 0.94, uSaturnRadius * 1.05, distToAxis);
                         gl_FragColor.rgb *= mix(0.06, 1.0, shadow);
                     }`
                );
            };
        }

        ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = Math.PI / 2;
        ringMesh.raycast = () => {}; // Decorative rings don't block raycasting to planet
        mesh.add(ringMesh);
    }

    // 2-YO'NALISH: Earth Dynamic Realistic Cloud Layer
    let cloudsMesh = null;
    if (data.hasClouds) {
        const cloudGeo = new THREE.SphereGeometry(data.radius * 1.022, 64, 64);
        const cloudsTex = textureLoader.load(textureBase + 'earth_clouds_2048.png');
        const cloudMat = new THREE.MeshStandardMaterial({
            map: cloudsTex,
            transparent: true,
            opacity: 0.72,
            depthWrite: false,
            roughness: 0.92,
            metalness: 0.0
        });
        cloudsMesh = new THREE.Mesh(cloudGeo, cloudMat);
        cloudsMesh.raycast = () => {}; // Transparent to raycasting so Earth sphere is directly targeted
        mesh.add(cloudsMesh);
    }

    // 2-YO'NALISH: Planetary Atmospheres (Fresnel Rayleigh Limb Glow)
    if (data.hasAtmosphere) {
        const atmosGlow = createAtmosphereGlow(data.radius, data.atmosphereColor, data.atmosphereIntensity, 1.055);
        mesh.add(atmosGlow);
    }

    // 3D Holographic Planet Label (omitted from in-scene mesh for a clean minimalist environment)
    const planetLabel = createLabelSprite(data.name, data.icon, '#' + (data.color ? data.color.toString(16).padStart(6, '0') : 'ffaa00'));
    planetLabel.position.y = data.radius + 1.8;
    // mesh.add(planetLabel);

    // 5-YO'NALISH BOOST: Scale Comparison Label for Planets
    const planetScaleLabel = createScaleLabelSprite(data.name, data.diameterKm || '12,000 km', '#' + (data.color ? data.color.toString(16).padStart(6, '0') : '38bdf8'));
    planetScaleLabel.position.y = data.radius + 2.2;
    mesh.add(planetScaleLabel);

    mesh.userData = { 
        id: data.id,
        badge: data.badge,
        title: data.title, 
        subtitle: data.subtitle,
        content: data.content, 
        tags: data.tags,
        actionUrl: data.actionUrl,
        actionText: data.actionText,
        githubUrl: data.githubUrl,
        githubText: data.githubText,
        isPlanet: true, 
        orbitGroup: orbitGroup, 
        distance: data.distance,
        radius: data.radius,
        diameterKm: data.diameterKm,
        scaleLabel: planetScaleLabel,
        ringOuter: data.ringOuter || 0
    };
    orbitGroup.add(mesh);
    interactableObjects.push(mesh);
    
    planets.push({ 
        mesh, 
        orbitGroup, 
        speed: data.speed, 
        cloudsMesh,
        axialTilt: data.tilt || 0 
    });
    
    // Moon (Yer Yo'ldoshi - Direct Contacts)
    if (data.hasMoon) {
        const moonOrbitCenter = new THREE.Group();
        moonOrbitCenter.position.x = data.distance;
        moonOrbitCenterRef = moonOrbitCenter;
        orbitGroup.add(moonOrbitCenter);
        
        const moonOrbit = new THREE.Group();
        moonOrbitCenter.add(moonOrbit);
        
        const moonGeom = new THREE.SphereGeometry(0.42, 32, 32);
        const moonTex = textureLoader.load(textureBase + 'moon_1024.jpg');
        const moonMat = new THREE.MeshStandardMaterial({ 
            map: moonTex, 
            roughness: 0.88,
            metalness: 0.05
        });
        const moon = new THREE.Mesh(moonGeom, moonMat);
        moonMeshRef = moon;
        moon.position.x = data.moonDistance;
        
        const moonLabel = createLabelSprite('Oy', '', '#ffffff');
        moonLabel.scale.set(4.5, 1.15, 1);
        moonLabel.position.y = 1.0;
        // moon.add(moonLabel);
        
        moon.userData = { 
            id: 'moon',
            badge: 'Yer Yo\'ldoshi • Aloqa Markazi',
            title: 'Bog\'lanish va Hamkorlik (Direct Contact)', 
            subtitle: 'Azimjon Kamiljanov bilan To\'g\'ridan-to\'g\'ri Aloqa Kanallari',
            content: `Yangi loyihalar, texnologik konsalting, sun'iy intellekt integratsiyalari, xavfsiz arxitektura yoki jamoaga qo'shilish takliflari bo'yicha doimo ochiqman.

Telegram Shaxsiy: @KamiljanovAzimjon
CyberAgent Bot: @CyberAgent0bot
Email: azimjonkomiljonov907@gmail.com
GitHub: github.com/AzimjonKamiljanov
Joylashuv: Toshkent, O'zbekiston`,
            tags: ['Telegram: @KamiljanovAzimjon', 'Email', 'GitHub', 'Tashkent, UZ', 'Full-time / Remote', 'Direct Contact'],
            actionUrl: 'https://t.me/KamiljanovAzimjon',
            actionText: 'Telegram: @KamiljanovAzimjon',
            githubUrl: 'https://github.com/AzimjonKamiljanov',
            githubText: 'GitHub Profil',
            isMoon: true, 
            radius: 0.42 
        };
        moonOrbit.add(moon);
        interactableObjects.push(moon);
        planets.push({ mesh: moon, orbitGroup: moonOrbit, speed: 0.022, isMoonData: true });
    }

    // 2-YO'NALISH BOOST: Yupiter Tabiiy Yo'ldoshlari (Io, Yevropa, Ganimed, Kallisto)
    if (data.id === 'Jupiter') {
        const jupiterMoonsCenter = new THREE.Group();
        jupiterMoonsCenter.position.x = data.distance;
        jupiterMoonsCenterRef = jupiterMoonsCenter;
        orbitGroup.add(jupiterMoonsCenter);

        const jMoonsConfig = [
            { name: 'Io', radius: 0.22, distance: 4.6, speed: 0.038, color: 0xf59e0b, angle: 0.6 },
            { name: 'Europa', radius: 0.18, distance: 6.0, speed: 0.028, color: 0xdbeafe, angle: 2.1 },
            { name: 'Ganymede', radius: 0.32, distance: 7.8, speed: 0.019, color: 0x9ca3af, angle: 3.8 },
            { name: 'Callisto', radius: 0.28, distance: 9.6, speed: 0.013, color: 0x78716c, angle: 5.3 }
        ];

        jMoonsConfig.forEach(m => {
            const mOrbit = new THREE.Group();
            mOrbit.rotation.y = m.angle;
            jupiterMoonsCenter.add(mOrbit);

            const mGeo = new THREE.SphereGeometry(m.radius, 16, 16);
            const mMat = new THREE.MeshStandardMaterial({
                color: m.color,
                roughness: 0.82,
                metalness: 0.08
            });
            const mMesh = new THREE.Mesh(mGeo, mMat);
            mMesh.position.x = m.distance;
            mMesh.userData = { id: m.name, isMiniMoon: true, parentPlanet: 'Jupiter', radius: m.radius };
            mOrbit.add(mMesh);

            // Subtle minimalist orbit ring
            const orbitPts = [];
            for (let i = 0; i <= 64; i++) {
                const th = (i / 64) * Math.PI * 2;
                orbitPts.push(new THREE.Vector3(Math.cos(th) * m.distance, 0, Math.sin(th) * m.distance));
            }
            const oLine = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(orbitPts),
                new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.12 })
            );
            jupiterMoonsCenter.add(oLine);

            jupiterMoonsList.push({ name: m.name, mesh: mMesh, orbitGroup: mOrbit, speed: m.speed });
            planets.push({ mesh: mMesh, orbitGroup: mOrbit, speed: m.speed, isMiniMoon: true });
        });
    }

    // 2-YO'NALISH BOOST: Saturn Tabiiy Yo'ldoshlari (Titan, Enselad)
    if (data.id === 'Saturn') {
        const saturnMoonsCenter = new THREE.Group();
        saturnMoonsCenter.position.x = data.distance;
        saturnMoonsCenterRef = saturnMoonsCenter;
        orbitGroup.add(saturnMoonsCenter);

        const sMoonsConfig = [
            { name: 'Titan', radius: 0.32, distance: 8.2, speed: 0.021, color: 0xfbbf24, angle: 1.2 },
            { name: 'Enceladus', radius: 0.16, distance: 6.4, speed: 0.032, color: 0xf8fafc, angle: 4.2 }
        ];

        sMoonsConfig.forEach(m => {
            const mOrbit = new THREE.Group();
            mOrbit.rotation.y = m.angle;
            saturnMoonsCenter.add(mOrbit);

            const mGeo = new THREE.SphereGeometry(m.radius, 16, 16);
            const mMat = new THREE.MeshStandardMaterial({
                color: m.color,
                roughness: 0.78,
                metalness: 0.12
            });
            const mMesh = new THREE.Mesh(mGeo, mMat);
            mMesh.position.x = m.distance;
            mMesh.userData = { id: m.name, isMiniMoon: true, parentPlanet: 'Saturn', radius: m.radius };
            mOrbit.add(mMesh);

            // Subtle minimalist orbit ring
            const orbitPts = [];
            for (let i = 0; i <= 64; i++) {
                const th = (i / 64) * Math.PI * 2;
                orbitPts.push(new THREE.Vector3(Math.cos(th) * m.distance, 0, Math.sin(th) * m.distance));
            }
            const oLine = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(orbitPts),
                new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.12 })
            );
            saturnMoonsCenter.add(oLine);

            saturnMoonsList.push({ name: m.name, mesh: mMesh, orbitGroup: mOrbit, speed: m.speed });
            planets.push({ mesh: mMesh, orbitGroup: mOrbit, speed: m.speed, isMiniMoon: true });
        });
    }
});

// Crisp, Elegant Glowing Orbit Lines (Consistently separated concentric rings)
const orbitLinesGroup = new THREE.Group();
scene.add(orbitLinesGroup);

planetsData.forEach(data => {
    const orbitPoints = [];
    const segments = 160;
    for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        orbitPoints.push(new THREE.Vector3(Math.cos(theta) * data.distance, 0, Math.sin(theta) * data.distance));
    }
    const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
    const orbitMat = new THREE.LineBasicMaterial({ 
        color: 0x6688aa, 
        transparent: true, 
        opacity: 0.22 
    });
    const orbitLine = new THREE.Line(orbitGeo, orbitMat);
    orbitLinesGroup.add(orbitLine);
});

// ==========================================
// 2.5 AUTHENTIC ASTEROID BELT (BETWEEN MARS & JUPITER)
// ==========================================
const asteroidBeltGroup = new THREE.Group();
scene.add(asteroidBeltGroup);

const ASTEROID_COUNT = 1450; // Authentic ring of 1,200 - 1,600 rocky asteroids
const asteroidGeo = new THREE.DodecahedronGeometry(0.24, 1);
const posAttr = asteroidGeo.attributes.position;
for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vy = posAttr.getY(i);
    const vz = posAttr.getZ(i);
    const noise = 1.0 + (Math.sin(vx * 7.0 + vy * 5.0) * 0.18 + Math.cos(vz * 6.0) * 0.14);
    posAttr.setXYZ(i, vx * noise, vy * noise, vz * noise);
}
posAttr.needsUpdate = true;
asteroidGeo.computeVertexNormals();

const asteroidMat = new THREE.MeshStandardMaterial({
    roughness: 0.88,
    metalness: 0.12,
    flatShading: true
});

const asteroidBeltMesh = new THREE.InstancedMesh(asteroidGeo, asteroidMat, ASTEROID_COUNT);
asteroidBeltMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
asteroidBeltMesh.raycast = () => {}; // Purely environmental; does not block clicking planets

const dummyObj = new THREE.Object3D();
const tempColor = new THREE.Color();
const asteroidColors = [
    0x4a4744, // dark stone grey
    0x5c5852, // medium slate rock
    0x383533, // carbonaceous dark
    0x6e6358, // silicate brownish grey
    0x54473b, // oxidized rust-tinged
    0x787268  // light stony chondrite
];

for (let i = 0; i < ASTEROID_COUNT; i++) {
    const u1 = Math.random();
    const u2 = Math.random();
    const normal = Math.sqrt(-2.0 * Math.log(u1 || 0.0001)) * Math.cos(2.0 * Math.PI * u2);
    const radius = 61.0 + normal * 2.2;
    const clampedRadius = Math.max(56.5, Math.min(65.5, radius));
    
    const theta = Math.random() * Math.PI * 2;
    const yDisp = (Math.random() + Math.random() - 1.0) * 1.6;
    
    dummyObj.position.set(
        Math.cos(theta) * clampedRadius,
        yDisp,
        Math.sin(theta) * clampedRadius
    );
    
    dummyObj.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
    );
    
    const isDwarf = (i % 65 === 0);
    const baseScale = isDwarf ? (1.8 + Math.random() * 1.0) : (0.45 + Math.random() * 0.95);
    dummyObj.scale.set(
        baseScale * (0.75 + Math.random() * 0.5),
        baseScale * (0.65 + Math.random() * 0.6),
        baseScale * (0.75 + Math.random() * 0.5)
    );
    
    dummyObj.updateMatrix();
    asteroidBeltMesh.setMatrixAt(i, dummyObj.matrix);
    
    const colHex = asteroidColors[Math.floor(Math.random() * asteroidColors.length)];
    tempColor.setHex(colHex);
    tempColor.multiplyScalar(0.85 + Math.random() * 0.35);
    asteroidBeltMesh.setColorAt(i, tempColor);
}

asteroidBeltMesh.instanceMatrix.needsUpdate = true;
if (asteroidBeltMesh.instanceColor) asteroidBeltMesh.instanceColor.needsUpdate = true;
asteroidBeltGroup.add(asteroidBeltMesh);

// ==========================================
// ==========================================
// 3. AUTHENTIC ASTRONOMICAL STARS & USER PROJECTS
// ==========================================

// Real astronomical star texture generator (Clean optical point, Gaussian falloff & tapered 4-point micro-diffraction)
function createAstronomicalStarTexture(colorStr) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const cx = 128, cy = 128;

    // 1. Natural astronomical Gaussian radial glow (smooth exponential falloff, zero hard rings)
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 115);
    grad.addColorStop(0.0, '#ffffff');
    grad.addColorStop(0.06, '#ffffff');
    grad.addColorStop(0.18, colorStr);
    grad.addColorStop(0.38, colorStr);
    grad.addColorStop(0.65, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    // 2. High-precision astronomical 4-point micro-diffraction spikes (tapered diamond cross)
    const spikeLen = 115;
    
    // Horizontal spike
    const hGrad = ctx.createLinearGradient(cx - spikeLen, cy, cx + spikeLen, cy);
    hGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    hGrad.addColorStop(0.35, colorStr);
    hGrad.addColorStop(0.5, '#ffffff');
    hGrad.addColorStop(0.65, colorStr);
    hGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = hGrad;
    ctx.beginPath();
    ctx.moveTo(cx - spikeLen, cy);
    ctx.lineTo(cx, cy - 3.2);
    ctx.lineTo(cx + spikeLen, cy);
    ctx.lineTo(cx, cy + 3.2);
    ctx.closePath();
    ctx.fill();

    // Vertical spike
    const vGrad = ctx.createLinearGradient(cx, cy - spikeLen, cx, cy + spikeLen);
    vGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vGrad.addColorStop(0.35, colorStr);
    vGrad.addColorStop(0.5, '#ffffff');
    vGrad.addColorStop(0.65, colorStr);
    vGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = vGrad;
    ctx.beginPath();
    ctx.moveTo(cx, cy - spikeLen);
    ctx.lineTo(cx + 3.2, cy);
    ctx.lineTo(cx, cy + spikeLen);
    ctx.lineTo(cx - 3.2, cy);
    ctx.closePath();
    ctx.fill();

    // Subtle 45-degree micro-spikes (space telescope secondary diffraction)
    const dLen = 42;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    const dGrad = ctx.createLinearGradient(-dLen, 0, dLen, 0);
    dGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    dGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.7)');
    dGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = dGrad;
    ctx.beginPath();
    ctx.moveTo(-dLen, 0); ctx.lineTo(0, -1.5); ctx.lineTo(dLen, 0); ctx.lineTo(0, 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -dLen); ctx.lineTo(1.5, 0); ctx.lineTo(0, dLen); ctx.lineTo(-1.5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 3. Central incandescent optical pinpoint sparkle
    ctx.beginPath();
    ctx.arc(cx, cy, 3.8, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
}

const stellarProjectsData = [
    {
        id: 'star_legion_power',
        shortName: 'Legion Power',
        icon: '',
        stellarClass: 'Class B (Blue-White)',
        colorHex: 0xa0c8ff,
        colorStr: '#a0c8ff',
        accentHex: '#a0c8ff',
        pos: new THREE.Vector3(155, 46, 115),
        badge: 'Tizim Loyihasi • Legion Power',
        title: 'Legion Power Optimizer • Hardware & Battery Automation',
        subtitle: 'Lenovo Legion Pro 5 Avtomatlashtirilgan Tejamkorlik va Himoya Tizimi',
        content: `Lenovo Legion Pro 5 uchun maxsus yaratilgan apparat nazorati va batareya tejamkorligi avtomatizatsiyasi.
Tok manbaidan uzilganda ekran chastotasini avtomatik 165Hz dan 60Hz ga tushiradi, noutbukni Quiet/Power-Saver rejimiga o'tkazadi, klaviatura RGB yoritgichlarini o'chiradi va batareya degradatsiyasini oldini oluvchi Conservation Mode (80% chegara) boshqaradi.

Tizim holatini real vaqtda kuzatuvchi maxsus CLI status vositasiga ega.`,
        tags: ['Lenovo Legion Pro 5', 'Battery Automation', 'Bash / Systemd', 'Linux Kernel', 'Hardware Control'],
        actionUrl: 'https://github.com/AzimjonKamiljanov',
        actionText: 'Legion Power',
        githubUrl: 'https://github.com/AzimjonKamiljanov',
        githubText: 'GitHub Profil'
    },
    {
        id: 'star_titan_cyber',
        shortName: 'Titan Centurion',
        icon: '',
        stellarClass: 'Class A (Diamond White)',
        colorHex: 0xffffff,
        colorStr: '#ffffff',
        accentHex: '#ffffff',
        pos: new THREE.Vector3(-165, 52, 110),
        badge: 'Xavfsizlik Tizimi • Cyber Arsenal',
        title: 'Titan Centurion • Hybrid Cyber & OSINT Arsenal',
        subtitle: '100+ Kiberxavfsizlik, Pentesting va OSINT Qurollari Integratsiyasi',
        content: `BlackArch, AUR va maxsus skriptlar orqali birlashtirilgan 100+ jangovar kiber-qurollar arsenali.
RTX 5070 CUDA bilan tezlashtirilgan Hashcat, Nmap, Radare2, Lynis, Volatility3, Nuclei, NetExec va 760+ manbali OSINT razvedka dvigateli.

Xavfsizlik auditi, telemetriya monitoringi va tizim mustahkamligini 24/7 nazorat qiluvchi titan_sentry moduli bilan jihozlangan.`,
        tags: ['Cybersecurity', 'OSINT', 'Hashcat CUDA', 'Nmap', 'Penetration Testing', 'DevSecOps'],
        actionUrl: 'https://github.com/AzimjonKamiljanov',
        actionText: 'Cyber Arsenal',
        githubUrl: 'https://github.com/AzimjonKamiljanov',
        githubText: 'GitHub Profil'
    },
    {
        id: 'star_graphify',
        shortName: 'Graphify Visual',
        icon: '',
        stellarClass: 'Class B (Cyan-White)',
        colorHex: 0x9ae4ff,
        colorStr: '#9ae4ff',
        accentHex: '#9ae4ff',
        pos: new THREE.Vector3(-145, -42, -140),
        badge: 'Arxitektura Dvigateli • Graphify',
        title: 'Graphify Visual Architecture • Codebase Knowledge Graph',
        subtitle: '373 Tugunli D3 Interaktiv Arxitektura Grafigi va AST Tahlili',
        content: `Katta kod bazalarini (CyberAgent, mikroxizmatlar) chuqur tahlil qilib, 373 tugun va 766 bog'lanishli D3 interaktiv bilimlar grafigiga (graph.html) va Obsidian Canvas modeliga aylantiruvchi dvigatel.

God nodes aniqlash, funksiyalar va sinflar orasidagi semantik bog'liqliklarni vizuallashtirish orqali loyihani boshqarishni 10 barobar tezlashtiradi (~/.local/bin/graphify).`,
        tags: ['AST Analysis', 'Knowledge Graph', 'D3.js', 'Obsidian Canvas', 'Code Intelligence'],
        actionUrl: 'https://github.com/Graphify-Labs/graphify',
        actionText: 'Graphify Repo',
        githubUrl: 'https://github.com/Graphify-Labs/graphify',
        githubText: 'GitHub Repo'
    },
    {
        id: 'star_newapi',
        shortName: 'New API Gateway',
        icon: '',
        stellarClass: 'Class F (Warm White)',
        colorHex: 0xfff1d6,
        colorStr: '#fff1d6',
        accentHex: '#fff1d6',
        pos: new THREE.Vector3(-120, -55, 155),
        badge: 'AI Infratuzilma • New API',
        title: 'New API • Universal Multi-Provider AI Gateway',
        subtitle: 'Docker AI Shlyuzi: Gemini, DeepSeek, Claude, OpenAI va Groq (Port 3001)',
        content: `Port 3001 da Docker muhitida ishlovchi universal AI marshrutizatori va shlyuzi (/home/cyber/services/new-api).
Barcha global LLM API provayderlari (Gemini 3.8 Flash, DeepSeek-R1, Claude 3.5, OpenAI, Groq) va mahalliy Ollama modellarini yagona OpenAI-moslashuvchan endpoint orqali birlashtiradi.

Tokenlar monitoringi, avtomatik failover va yuklamalarni aqlli muvozanatlashtirish imkoniyatiga ega.`,
        tags: ['Docker', 'AI Gateway', 'Multi-LLM', 'Load Balancing', 'Port 3001', 'REST API'],
        actionUrl: 'https://github.com/Calcium-Ion/new-api',
        actionText: 'New API Gateway',
        githubUrl: 'https://github.com/Calcium-Ion/new-api',
        githubText: 'GitHub Repo'
    },
    {
        id: 'star_agentzero',
        shortName: 'Agent Zero',
        icon: '',
        stellarClass: 'Class G (Warm Gold)',
        colorHex: 0xffd580,
        colorStr: '#ffd580',
        accentHex: '#ffd580',
        pos: new THREE.Vector3(115, 60, -155),
        badge: 'Avtonom Tizim • Agent Zero',
        title: 'Agent Zero • Autonomous Dual-Brain Docker System',
        subtitle: 'Port 5080: Izolyatsiyalangan Avtonom Tizim va Master-Agent Ko\'prigi',
        content: `Port 5080 da izolyatsiyalangan Docker konteynerida ishlovchi ko'p vazifali avtonom agent.
Mustaqil terminal, headless brauzer va fayl manipulyatsiyasi vositalariga ega. Antigravity bilan ikki miyali ko'prik (agent_zero_bridge) orqali bog'langan bo'lib, xavfli dasturlash va operatsion tizim skriptlarini qumloqda (sandbox) xavfsiz bajaradi.`,
        tags: ['Docker Sandbox', 'Autonomous Agent', 'Dual-Brain', 'Port 5080', 'Agent Zero'],
        actionUrl: 'https://github.com/frdel/agent-zero',
        actionText: 'Agent Zero',
        githubUrl: 'https://github.com/frdel/agent-zero',
        githubText: 'GitHub Repo'
    },
    {
        id: 'star_aider_nv',
        shortName: 'Aider NIM',
        icon: '',
        stellarClass: 'Class K (Golden Amber)',
        colorHex: 0xffba54,
        colorStr: '#ffba54',
        accentHex: '#ffba54',
        pos: new THREE.Vector3(170, 30, -95),
        badge: 'AI Muhandislik • Aider NIM',
        title: 'Aider & NVIDIA NIM • Dual-Brain Coding Architecture',
        subtitle: 'DeepSeek-R1 + Qwen 2.5 Coder 32B va 81 ta NVIDIA NIM Modellari',
        content: `NVIDIA NIM kognitiv klasteri (81 ta flagman model) va Aider CLI asosidagi universal avtonom dasturchi (aider-nv).
Dual-Brain arxitekturasi: DeepSeek-R1 murakkab mantiq va arxitekturani rejalashtirsa, Qwen 2.5 Coder 32B kodni xatosiz yozadi va Git bilan avto-commit qiladi. Tree-sitter AST integratsiyasi bilan ta'minlangan.`,
        tags: ['Aider CLI', 'NVIDIA NIM', 'DeepSeek-R1', 'Qwen 2.5 Coder', 'Git Automation'],
        actionUrl: 'https://github.com/AzimjonKamiljanov',
        actionText: 'Aider NIM',
        githubUrl: 'https://github.com/AzimjonKamiljanov',
        githubText: 'GitHub Profil'
    },
    {
        id: 'star_openshell',
        shortName: 'OpenShell Sandbox',
        icon: '',
        stellarClass: 'Class B (Pale Azure)',
        colorHex: 0xa8d0ff,
        colorStr: '#a8d0ff',
        accentHex: '#a8d0ff',
        pos: new THREE.Vector3(-170, 35, -85),
        badge: 'Xavfsizlik Qalqoni • OpenShell',
        title: 'NVIDIA OpenShell • Enterprise AI Safety Sandbox',
        subtitle: 'OpenShell Gateway va T3 AI Agentlarining Izolyatsiyalangan Qobig\'i',
        content: `NVIDIA OpenShell (v0.1.2) asosidagi avtonom agentlar xavfsizlik platformasi.
T3 Code va terminal AI agentlarining (Claude/Codex/Antigravity) barcha buyruqlarini 100% izolyatsiyalangan t3-agent-sandbox qobig'iga yo'naltiradi. Tizim yadrosi va fayllarini kutilmagan modifikatsiyalardan ishonchli himoya qiladi.`,
        tags: ['NVIDIA OpenShell', 'AI Safety', 'Docker Sandbox', 'T3 Code', 'Zero-Trust'],
        actionUrl: 'https://github.com/AzimjonKamiljanov',
        actionText: 'OpenShell Safety',
        githubUrl: 'https://github.com/AzimjonKamiljanov',
        githubText: 'GitHub Profil'
    },
    {
        id: 'star_btech',
        shortName: 'B.Tech Cloud',
        icon: '',
        stellarClass: 'Class A (Silver White)',
        colorHex: 0xedf3fc,
        colorStr: '#edf3fc',
        accentHex: '#edf3fc',
        pos: new THREE.Vector3(130, -50, -145),
        badge: 'Akademik Loyiha • B.Tech Cloud',
        title: 'B.Tech Cloud Fundamentals • University Cloud Lab',
        subtitle: 'Bulutli Hisoblash Nazariyasi, IaaS/PaaS/SaaS va Amaliy Laboratoriya',
        content: `B.Tech universiteti Cloud Fundamentals fani bo'yicha to'liq akademik va amaliy laboratoriya kursi (/home/cyber/Projects/BTech/Cloud_Fundamentals/).
Jupyter Notebooklar (01_Cloud_Basics.ipynb), Obsidian bilimlar bazasi, virtualizatsiya, konteynerizatsiya va taqsimlangan tizimlar arxitekturasini qamrab oladi.`,
        tags: ['Cloud Computing', 'B.Tech University', 'Jupyter Notebook', 'IaaS / PaaS', 'Obsidian'],
        actionUrl: 'https://github.com/AzimjonKamiljanov',
        actionText: 'Cloud Lab',
        githubUrl: 'https://github.com/AzimjonKamiljanov',
        githubText: 'GitHub Profil'
    },
    {
        id: 'star_gsd',
        shortName: 'GSD Core',
        icon: '⚙️',
        stellarClass: 'Class G (Warm Solar)',
        colorHex: 0xffe29a,
        colorStr: '#ffe29a',
        accentHex: '#ffe29a',
        pos: new THREE.Vector3(185, -25, 80),
        badge: 'AI Freymvork • GSD Core',
        title: 'GSD Core • Spec-Driven Multi-Agent Framework',
        subtitle: 'SPEC.md, PLAN.md, VERIFY.md Bo\'yicha 72 Ko\'nikmali Avtonom Dvigatel',
        content: `Murakkab dasturiy loyihalarni spec-contract asosida avtonom fazalarga bo'lib, TDD va sifat filtrlari bilan xatosiz ijro etuvchi tizim (~/.bun/bin/gsd-core).
72 ta ixtisoslashgan subagent ko'nikmasi, xavfsizlik tekshiruvlari va doimiy xotira sinxronizatsiyasi bilan qurollangan.`,
        tags: ['Spec-Driven AI', 'Bun / TS', 'Multi-Agent', 'TDD Quality Gates'],
        actionUrl: 'https://github.com/open-gsd/gsd-core',
        actionText: '⚙️ GSD Core',
        githubUrl: 'https://github.com/open-gsd/gsd-core',
        githubText: 'GitHub Repo'
    },
    {
        id: 'star_claudemem',
        shortName: 'Claude-Mem',
        icon: '',
        stellarClass: 'Class B (Crystal Blue)',
        colorHex: 0xb4d8ff,
        colorStr: '#b4d8ff',
        accentHex: '#b4d8ff',
        pos: new THREE.Vector3(-185, -20, 80),
        badge: 'AI Xotira • Claude-Mem',
        title: 'Claude-Mem • Long-Term Vector Memory Engine',
        subtitle: 'SQLite + Chroma Vektor Xotirasi va Port 37700 Kognitiv Servisi',
        content: `AI agentlar uchun uzluksiz kognitiv xotira tizimi (port 37700).
Suhbatlar, me'moriy qarorlar va tizim bilimlarini vektor formatida saqlab, yangi sessiyalarda avtomatik kontekstga qaytaradi. Antigravity va Obsidian xotirasi uchun doimiy sinxronizatsiya hooklariga ega.`,
        tags: ['Vector DB', 'ChromaDB', 'SQLite', 'Cognitive Memory', 'Port 37700'],
        actionUrl: 'https://github.com/thedotmack/claude-mem',
        actionText: 'Claude-Mem',
        githubUrl: 'https://github.com/thedotmack/claude-mem',
        githubText: 'GitHub Repo'
    },
    {
        id: 'star_headroom',
        shortName: 'Headroom Layer',
        icon: '',
        stellarClass: 'Class A (Diamond White)',
        colorHex: 0xf4f8ff,
        colorStr: '#f4f8ff',
        accentHex: '#f4f8ff',
        pos: new THREE.Vector3(80, -65, 175),
        badge: 'Optimizatsiya • Headroom',
        title: 'Headroom • Context Optimization & SmartCrusher',
        subtitle: 'AST Parsing, Token Kompressiyasi va Cache Aligner (v0.39.1)',
        content: `Katta hajmdagi kod bazalarini til modellariga uzatishdan oldin tokenlar sarfini 40% gacha tejovchi qatlam.
AST daraxti bo'yicha tahlil, keraksiz probellarni tozalash va MCP server orqali LLM unumdorligini 2 barobar oshiradi.`,
        tags: ['Token Compression', 'AST Parsing', 'MCP Server', 'SmartCrusher'],
        actionUrl: 'https://github.com/headroomlabs-ai/headroom',
        actionText: 'Headroom',
        githubUrl: 'https://github.com/headroomlabs-ai/headroom',
        githubText: 'GitHub Repo'
    },
    {
        id: 'star_ralph',
        shortName: 'Ralph Loop',
        icon: '',
        stellarClass: 'Class K (Peach Gold)',
        colorHex: 0xffa96b,
        colorStr: '#ffa96b',
        accentHex: '#ffa96b',
        pos: new THREE.Vector3(-75, 65, -175),
        badge: 'Avtonom Dvigatel • Ralph Loop',
        title: 'Ralph Loop • Fresh-Context Self-Healing Runner',
        subtitle: 'Uzluksiz O\'zini-O\'zi Tuzatuvchi Avtonom TDD Sikli (v2.0)',
        content: `Dasturchi agentlar xatolikka yo'liqqanda yangi toza kontekst bilan ishga tushib, xatoni tahlil qiluvchi va barcha testlar 100% yashil bo'lmaguncha to'xtamaydigan avtonom sikl dvigateli (~/.local/bin/ralph).`,
        tags: ['Self-Healing', 'Automated TDD', 'Bash CLI', 'Resilient Loops'],
        actionUrl: 'https://github.com/ghuntley/how-to-ralph-wiggum',
        actionText: 'Ralph Loop',
        githubUrl: 'https://github.com/ghuntley/how-to-ralph-wiggum',
        githubText: 'GitHub Repo'
    },
    {
        id: 'star_deepseek_harness',
        shortName: 'DeepSeek Harness',
        icon: '',
        stellarClass: 'Class O (Electric Sapphire)',
        colorHex: 0x8ec5ff,
        colorStr: '#8ec5ff',
        accentHex: '#8ec5ff',
        pos: new THREE.Vector3(95, 75, 130),
        badge: 'Agent Freymvork • DeepSeek Harness',
        title: 'DeepSeek Harness (dsh) • Modular Plugin Engine',
        subtitle: 'Cordis Spatiotemporal Framework va Web UI (Port 3080)',
        content: `DeepSeek AI tomonidan yaratilgan ochiq kodli agent xobiti (/home/cyber/deepseek-harness).
Everything-is-a-plugin arxitekturasi, Cordis spatiotemporal dvigateli va port 3080 da ishlovchi interaktiv Web UI. Ko'p agentli modulli tizimlarni xavfsiz boshqaradi.`,
        tags: ['DeepSeek', 'Cordis Framework', 'TypeScript', 'pnpm', 'Agent Plugins'],
        actionUrl: 'https://github.com/deepseek-ai/deepseek-harness',
        actionText: 'DeepSeek Harness',
        githubUrl: 'https://github.com/deepseek-ai/deepseek-harness',
        githubText: 'GitHub Repo'
    },
    {
        id: 'star_titan_osint',
        shortName: 'Titan OSINT',
        icon: '',
        stellarClass: 'Class M (Ruby Topaz)',
        colorHex: 0xff7373,
        colorStr: '#ff7373',
        accentHex: '#ff7373',
        pos: new THREE.Vector3(-135, 70, -110),
        badge: 'Razvedka Dvigateli • OSINT Engine',
        title: 'Titan OSINT Massive Engine • Global Cyber Reconnaissance',
        subtitle: '769 OSINT Asboblari Inventari, Avtomatlashtirilgan Parserlar va Razvedka',
        content: `10 ta parallel tadqiqot agenti orqali yig'ilgan 769 ta qudratli kiber-razvedka va OSINT vositalari majmuasi (/home/cyber/OSINT_TOOL_INVENTORY.md).
Maigret, Sherlock, Holehe, Cloudfox, NetExec va maxsus Python parserlari (parse_tools.py) orqali kiber-xavflarni aniqlash va tahlil qilish imkoniyati.`,
        tags: ['OSINT Recon', '769 Tools', 'Threat Intel', 'Python Automation', 'BlackArch'],
        actionUrl: 'https://github.com/AzimjonKamiljanov',
        actionText: 'Titan OSINT',
        githubUrl: 'https://github.com/AzimjonKamiljanov',
        githubText: 'GitHub Profil'
    },
    {
        id: 'star_sentinel_shield',
        shortName: 'System Sentinel',
        icon: '',
        stellarClass: 'Class A (Pure Crystalline)',
        colorHex: 0xffffff,
        colorStr: '#ffffff',
        accentHex: '#ffffff',
        pos: new THREE.Vector3(-105, -70, -150),
        badge: 'Tizim Qalqoni • Sentinel Shield',
        title: 'System Sentinel • Sudo Guard & Linux Kernel Hardening',
        subtitle: 'sudo rm -rf Blokirovkasi, ZRAM 8GB Xotira va Doimiy Watchdog',
        content: `Linux operatsion tizimini xavfli va halokatli buyruqlardan tizim darajasida himoyalovchi qalqon.
/home/cyber/.local/bin/sudo orqali 'sudo rm -rf' komandasini butunlay bloklash, 8GB ZRAM tezkor swap xotirasi, kscreen crash prevensiyasi va suspend/resume holatlarini barqarorlashtiruvchi avtomatizatsiya.`,
        tags: ['Linux Hardening', 'Sudo Interceptor', 'ZRAM Swap', 'Kernel Watchdog', 'Systemd'],
        actionUrl: 'https://github.com/AzimjonKamiljanov',
        actionText: 'System Sentinel',
        githubUrl: 'https://github.com/AzimjonKamiljanov',
        githubText: 'GitHub Profil'
    },
    {
        id: 'star_solar_portfolio',
        shortName: 'SolarPortfolio 3D',
        icon: '✨',
        stellarClass: 'Class G (Golden Radiance)',
        colorHex: 0xffd166,
        colorStr: '#ffd166',
        accentHex: '#ffd166',
        pos: new THREE.Vector3(160, -45, 110),
        badge: 'Web Loyiha • SolarPortfolio',
        title: 'SolarPortfolio 3D • React Vite Modern Component Engine',
        subtitle: 'React + TypeScript + Vite, Oxlint Qoidalari va 3D WebGL Arxitekturasi',
        content: `/home/cyber/Projects/SolarPortfolio/ da joylashgan reaktiv 3D web platforma shabloni.
Vite tezkor yig'ish moduli, TypeScript qat'iy tiplashtirish, Oxlint statik tahlili va interaktiv UI komponentlari to'plamini o'z ichiga oladi.`,
        tags: ['React', 'TypeScript', 'Vite', 'Oxlint', 'Modern Web'],
        actionUrl: 'https://github.com/AzimjonKamiljanov',
        actionText: '✨ SolarPortfolio',
        githubUrl: 'https://github.com/AzimjonKamiljanov',
        githubText: 'GitHub Profil'
    },
    {
        id: 'star_school21',
        shortName: 'School 21 Lab',
        icon: '',
        stellarClass: 'Class B (Azure Cyan)',
        colorHex: 0x85d7ff,
        colorStr: '#85d7ff',
        accentHex: '#85d7ff',
        pos: new THREE.Vector3(-160, -50, 70),
        badge: 'Akademik Loyiha • School 21',
        title: 'School 21 • Advanced Cryptography & Networking Lab',
        subtitle: 'CbS Tarmoq Protokollari, Simmetrik Shifrlash va C/C++ Xavfsizlik Sinovlari',
        content: `School 21 dasturi doirasidagi past darajadagi tarmoq protokollari (CbS2-CbS4 Networking) va zamonaviy simmetrik/asimmetrik kriptografiya (CbS7-CbS8 Crypto) laboratoriya ishlari (/home/cyber/School 21/).
Tarmoq paketi tahlili, shifrlash algoritmlari va C/C++ dasturlash amaliyotini o'z ichiga oladi.`,
        tags: ['School 21', 'Networking', 'Cryptography', 'C/C++', 'Low-Level Security'],
        actionUrl: 'https://github.com/AzimjonKamiljanov',
        actionText: 'School 21 Lab',
        githubUrl: 'https://github.com/AzimjonKamiljanov',
        githubText: 'GitHub Profil'
    },
    {
        id: 'star_task_observer',
        shortName: 'Task Observer',
        icon: '',
        stellarClass: 'Class F (Warm Ivory)',
        colorHex: 0xfff4e0,
        colorStr: '#fff4e0',
        accentHex: '#fff4e0',
        pos: new THREE.Vector3(50, 85, -160),
        badge: 'Telemetriya • Task Observer',
        title: 'Task Observer & Mnemoverse • Agent Telemetry Engine',
        subtitle: 'Avtonom Agent Harakatlarini Kuzatish va Dinamik Xotira Sinxronizatsiyasi',
        content: `Murakkab ko'p agentli operatsiyalarda har bir agentning qadamlari, asboblardan foydalanishi va xotira o'zgarishlarini real vaqtda kuzatuvchi telemetriya va monitoring qatlami.
Mnemoverse orqali agentlar xotirasini real vaqtda sinxronizatsiya qiladi va audit hisobotlarini shakllantiradi.`,
        tags: ['Telemetry', 'Multi-Agent Monitoring', 'Task Observer', 'Mnemoverse', 'Hooks'],
        actionUrl: 'https://github.com/AzimjonKamiljanov',
        actionText: 'Task Observer',
        githubUrl: 'https://github.com/AzimjonKamiljanov',
        githubText: 'GitHub Profil'
    }
];

const interactiveStars = [];

// Instantiate authentic astronomical stars with natural optical profiles, pinpoints & scintillation
stellarProjectsData.forEach((sData, idx) => {
    const starGroup = new THREE.Group();
    starGroup.position.copy(sData.pos);
    scene.add(starGroup);

    // 1. Primary Astronomical Star Optical Body (Brilliant spectral halo & 4-point micro-diffraction)
    const starTex = createAstronomicalStarTexture(sData.colorStr);
    const spriteMat = new THREE.SpriteMaterial({
        map: starTex,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.92,
        depthWrite: false
    });
    const starSprite = new THREE.Sprite(spriteMat);
    starSprite.scale.set(4.5, 4.5, 1);
    starGroup.add(starSprite);

    // 2. High-Intensity Central Incandescent Optical Core (Double-additive optical pinpoint that stays pure brilliant white)
    const coreTex = createAstronomicalStarTexture('#ffffff');
    const coreMat = new THREE.SpriteMaterial({
        map: coreTex,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.88,
        depthWrite: false
    });
    const coreSprite = new THREE.Sprite(coreMat);
    coreSprite.scale.set(1.4, 1.4, 1);
    starGroup.add(coreSprite);

    // 3. 3D Holographic Label (omitted from in-scene 3D space to keep clean minimalist environment)
    const labelSprite = createLabelSprite(sData.shortName, sData.icon || '⭐', sData.accentHex || '#ffffff');
    labelSprite.scale.set(5.6, 1.4, 1);
    labelSprite.position.y = 2.4;
    // starGroup.add(labelSprite);

    // 4. Clickable Raycast Hitbox
    const hitGeo = new THREE.SphereGeometry(4.8, 8, 8);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitMesh = new THREE.Mesh(hitGeo, hitMat);
    hitMesh.position.copy(sData.pos);
    
    hitMesh.userData = {
        id: sData.id,
        badge: sData.badge,
        title: sData.title,
        subtitle: sData.subtitle,
        content: sData.content,
        tags: sData.tags,
        actionUrl: sData.actionUrl || sData.url,
        actionText: sData.actionText || 'Ko\'rish',
        githubUrl: sData.githubUrl,
        githubText: sData.githubText || 'GitHub Repo',
        isStar: true,
        starGroup: starGroup,
        radius: 2.2
    };
    scene.add(hitMesh);
    interactableObjects.push(hitMesh);

    interactiveStars.push({
        core: coreSprite,
        sprite: starSprite,
        speed: 1.4 + (idx * 0.22) % 1.6,
        phase: (idx * 1.35) % (Math.PI * 2)
    });
});

// ==============================================================================
// 1-YO'NALISH: PLANCK BLACKBODY STELLAR POPULATION (7,500 STARS)
// ==============================================================================
const starsGeometry = new THREE.BufferGeometry();
const starsCount = 7500;
const posArray = new Float32Array(starsCount * 3);
const colorArray = new Float32Array(starsCount * 3);
const starsData = [];

// Planck Blackbody spectral distribution:
// O/B (blue/cyan ~25,000K): #9bb0ff
// A (pure white ~10,000K): #cad7ff
// F (warm white ~7,000K): #f8f9ff
// G (solar yellow/gold ~5,800K): #fff4e8
// K (orange ~4,500K): #ffd2a1
// M (crimson/red dwarf ~3,000K): #ff9e79
const planckSpectralPalette = [
    new THREE.Color(0x9bb0ff), // O/B Hot Blue
    new THREE.Color(0xb8c8ff), // B Light Blue
    new THREE.Color(0xf0f4ff), // A Pure White
    new THREE.Color(0xfff8ee), // F Warm White
    new THREE.Color(0xffe2a4), // G Solar Yellow/Gold
    new THREE.Color(0xffb87a), // K Orange
    new THREE.Color(0xff8866)  // M Red Dwarf
];

for (let i = 0; i < starsCount; i++) {
    const idx3 = i * 3;
    const r = 220 + Math.random() * 550;
    const theta = 2 * Math.PI * Math.random();
    const phi = Math.acos(2 * Math.random() - 1);
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);
    
    posArray[idx3] = x;
    posArray[idx3 + 1] = y;
    posArray[idx3 + 2] = z;
    
    // Choose spectral color with realistic distribution
    const roll = Math.random();
    let col;
    if (roll < 0.08) col = planckSpectralPalette[0];
    else if (roll < 0.18) col = planckSpectralPalette[1];
    else if (roll < 0.38) col = planckSpectralPalette[2];
    else if (roll < 0.58) col = planckSpectralPalette[3];
    else if (roll < 0.78) col = planckSpectralPalette[4];
    else if (roll < 0.92) col = planckSpectralPalette[5];
    else col = planckSpectralPalette[6];
    
    colorArray[idx3] = col.r;
    colorArray[idx3 + 1] = col.g;
    colorArray[idx3 + 2] = col.b;
    
    if (i < 120) {
        starsData.push({ position: new THREE.Vector3(x, y, z) });
    }
}
starsGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
starsGeometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
const starsMaterial = new THREE.PointsMaterial({ 
    size: 0.65, 
    vertexColors: true,
    transparent: true, 
    opacity: 0.88
});
const stars = new THREE.Points(starsGeometry, starsMaterial);
scene.add(stars);

// ==============================================================================
// 3-YO'NALISH: DYNAMIC PERIODIC COMET (HALLEY-NEOWISE DUAL TAILS)
// ==============================================================================
const cometGroup = new THREE.Group();
scene.add(cometGroup);

const cometNucleusGeo = new THREE.DodecahedronGeometry(0.55, 1);
const cometNucleusMat = new THREE.MeshStandardMaterial({
    color: 0x88ccff,
    roughness: 0.75,
    metalness: 0.2
});
const cometNucleus = new THREE.Mesh(cometNucleusGeo, cometNucleusMat);
cometGroup.add(cometNucleus);

// Glowing nucleus core sprite
const cometCanvas = document.createElement('canvas');
cometCanvas.width = 128;
cometCanvas.height = 128;
const cCtx = cometCanvas.getContext('2d');
const cGrad = cCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
cGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
cGrad.addColorStop(0.2, 'rgba(160, 235, 255, 0.9)');
cGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.35)');
cGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
cCtx.fillStyle = cGrad;
cCtx.fillRect(0, 0, 128, 128);
const cometCoreTex = new THREE.CanvasTexture(cometCanvas);
const cometCoreMat = new THREE.SpriteMaterial({
    map: cometCoreTex,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.95
});
const cometCoreSprite = new THREE.Sprite(cometCoreMat);
cometCoreSprite.scale.set(6.5, 6.5, 1);
cometNucleus.add(cometCoreSprite);

// Dynamic dual ion & dust particle tail
const COMET_TAIL_COUNT = 140;
const cometTailGeo = new THREE.BufferGeometry();
const cometTailPositions = new Float32Array(COMET_TAIL_COUNT * 3);
const cometTailColors = new Float32Array(COMET_TAIL_COUNT * 3);

for (let i = 0; i < COMET_TAIL_COUNT; i++) {
    const fraction = i / COMET_TAIL_COUNT;
    cometTailPositions[i * 3] = 0;
    cometTailPositions[i * 3 + 1] = 0;
    cometTailPositions[i * 3 + 2] = 0;
    // Ion tail gradient from electric cyan-blue to faint white
    cometTailColors[i * 3] = 0.35 + fraction * 0.55;
    cometTailColors[i * 3 + 1] = 0.75 + fraction * 0.2;
    cometTailColors[i * 3 + 2] = 1.0;
}
cometTailGeo.setAttribute('position', new THREE.BufferAttribute(cometTailPositions, 3));
cometTailGeo.setAttribute('color', new THREE.BufferAttribute(cometTailColors, 3));

const cometTailMat = new THREE.PointsMaterial({
    size: 1.8,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.72,
    depthWrite: false
});
const cometTailMesh = new THREE.Points(cometTailGeo, cometTailMat);
scene.add(cometTailMesh);

// UserData for interaction
cometNucleus.userData = {
    id: 'Comet',
    isComet: true,
    radius: 0.85,
    badge: 'Koinot Hodisasi • Davriy Kometa',
    title: 'Halley-Neowise • Dynamic Periodic Comet',
    subtitle: 'Ekssentrik Dumli Yulduz va Quyosh Shamoli Dinamikasi',
    content: `Quyosh tizimini kesib o'tuvchi yuqori ekssentriklikdagi kometaning dinamik harakati.
Quyosh nurlanish bosimi va quyosh shamoli natijasida hosil bo'ladigan gaz (ion) va chang dumlari fizikasi. Quyosh yaqinida maksimal tezlik va yorqinlikka erishadi.`,
    tags: ['Comet', 'Keplerian Orbit', 'Ion Tail', 'Solar Wind', 'Solar Physics'],
    actionUrl: 'https://github.com/AzimjonKamiljanov',
    actionText: 'Kometa Dinamikasi',
    githubUrl: 'https://github.com/AzimjonKamiljanov',
    githubText: 'GitHub Profil'
};
interactableObjects.push(cometNucleus);
cometGroup.userData = cometNucleus.userData;

let cometProgress = 0.0;
function updateComet(deltaSpeed = 1.0) {
    // Keplerian eccentric ellipse: a = 120, e = 0.86, inclination = 36 deg
    const a = 120;
    const e = 0.86;
    const r = (a * (1 - e * e)) / (1 + e * Math.cos(cometProgress));
    
    if (deltaSpeed > 0) {
        // Kepler's 2nd Law: speed scales inversely with distance (dramatic fast flyby near Sun)
        const perihelionDist = a * (1 - e); // ~16.8 units
        const speedMultiplier = Math.pow(perihelionDist / Math.max(r, 12.0), 1.25);
        cometProgress += 0.0010 * speedMultiplier * deltaSpeed;
        if (cometProgress > Math.PI * 2) cometProgress -= Math.PI * 2;
    }
    
    const cosInc = 0.81; // cos(36 deg)
    const sinInc = 0.58; // sin(36 deg)
    
    const cx = r * Math.cos(cometProgress);
    const cz = r * Math.sin(cometProgress) * cosInc;
    const cy = r * Math.sin(cometProgress) * sinInc;
    
    cometGroup.position.set(cx, cy, cz);
    
    // Comet tail points directly AWAY from the Sun (0, 0, 0)
    const sunToComet = cometGroup.position.clone().normalize();
    const tailPositionsAttr = cometTailGeo.attributes.position;
    
    // Near perihelion (small r), tail stretches long (up to 42 units) and blazes brightly
    const tailLen = Math.max(12.0, (1.0 - Math.min(1.0, r / 150.0)) * 42.0);
    const tailBrightness = Math.max(0.35, (1.0 - Math.min(1.0, r / 160.0)) * 1.0);
    cometTailMat.opacity = tailBrightness * 0.78;
    
    for (let i = 0; i < COMET_TAIL_COUNT; i++) {
        const frac = i / COMET_TAIL_COUNT;
        // Tail particles expand and trail outward
        const spread = frac * 1.4;
        const pTail = cometGroup.position.clone().add(
            sunToComet.clone().multiplyScalar(frac * tailLen)
        );
        pTail.x += (Math.sin(i * 1.7 + cometProgress * 5.0) - 0.5) * spread;
        pTail.y += (Math.cos(i * 2.3 + cometProgress * 4.0) - 0.5) * spread;
        pTail.z += (Math.sin(i * 3.1 + cometProgress * 6.0) - 0.5) * spread;
        
        tailPositionsAttr.setXYZ(i, pTail.x, pTail.y, pTail.z);
    }
    tailPositionsAttr.needsUpdate = true;
}

// ==============================================================================
// 3-YO'NALISH: SOLAR WIND PARTICLE STREAM
// ==============================================================================
const SOLAR_WIND_COUNT = 900;
const solarWindGeo = new THREE.BufferGeometry();
const solarWindPositions = new Float32Array(SOLAR_WIND_COUNT * 3);
const solarWindDirections = new Float32Array(SOLAR_WIND_COUNT * 3);
const solarWindDistances = new Float32Array(SOLAR_WIND_COUNT);

for (let i = 0; i < SOLAR_WIND_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2.0 * Math.random() - 1.0);
    const dx = Math.sin(phi) * Math.cos(theta);
    const dy = Math.sin(phi) * Math.sin(theta) * 0.45;
    const dz = Math.cos(phi);
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1.0;
    
    solarWindDirections[i * 3] = dx / len;
    solarWindDirections[i * 3 + 1] = dy / len;
    solarWindDirections[i * 3 + 2] = dz / len;
    
    const dist = 8.5 + Math.random() * 155.0;
    solarWindDistances[i] = dist;
    
    solarWindPositions[i * 3] = (dx / len) * dist;
    solarWindPositions[i * 3 + 1] = (dy / len) * dist;
    solarWindPositions[i * 3 + 2] = (dz / len) * dist;
}

solarWindGeo.setAttribute('position', new THREE.BufferAttribute(solarWindPositions, 3));
const solarWindMat = new THREE.PointsMaterial({
    size: 0.75,
    color: 0xffd288,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.45,
    depthWrite: false
});
const solarWindMesh = new THREE.Points(solarWindGeo, solarWindMat);
scene.add(solarWindMesh);

function updateSolarWind(deltaSpeed = 1.0) {
    const posAttr = solarWindGeo.attributes.position;
    for (let i = 0; i < SOLAR_WIND_COUNT; i++) {
        solarWindDistances[i] += 0.32 * deltaSpeed;
        if (solarWindDistances[i] > 165.0) {
            solarWindDistances[i] = 8.0 + Math.random() * 4.0;
        }
        const d = solarWindDistances[i];
        posAttr.setXYZ(
            i,
            solarWindDirections[i * 3] * d,
            solarWindDirections[i * 3 + 1] * d,
            solarWindDirections[i * 3 + 2] * d
        );
    }
    posAttr.needsUpdate = true;
}

// ==============================================================================
// 4-YO'NALISH: VOYAGER 1 / CYBERPROBE 3D MODEL
// ==============================================================================
const voyagerGroup = new THREE.Group();

// 1. High-Gain Parabolic Antenna Dish
const dishGeo = new THREE.CylinderGeometry(1.5, 0.2, 0.45, 32, 1, true);
const dishMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.3,
    metalness: 0.5,
    side: THREE.DoubleSide
});
const dishMesh = new THREE.Mesh(dishGeo, dishMat);
dishMesh.rotation.x = Math.PI / 2;
dishMesh.position.z = 0.35;
voyagerGroup.add(dishMesh);

// Subreflector cone in front of dish
const subreflectorGeo = new THREE.ConeGeometry(0.18, 0.65, 12);
const subreflectorMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });
const subreflectorMesh = new THREE.Mesh(subreflectorGeo, subreflectorMat);
subreflectorMesh.rotation.x = -Math.PI / 2;
subreflectorMesh.position.z = 0.75;
voyagerGroup.add(subreflectorMesh);

// 2. Main Spacecraft Bus (10-sided electronics compartment with golden MLI foil)
const busGeo = new THREE.CylinderGeometry(0.75, 0.75, 0.5, 10);
const busMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37, // Golden Kapton MLI foil
    metalness: 0.85,
    roughness: 0.25
});
const busMesh = new THREE.Mesh(busGeo, busMat);
busMesh.position.z = -0.15;
voyagerGroup.add(busMesh);

// 3. RTG Power Generator Boom
const rtgBoomGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.8, 8);
const boomMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6 });
const rtgBoom = new THREE.Mesh(rtgBoomGeo, boomMat);
rtgBoom.rotation.z = Math.PI / 3;
rtgBoom.position.set(-1.2, 0.6, -0.2);
voyagerGroup.add(rtgBoom);

// RTG Power Canisters
const rtgCanGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.9, 12);
const rtgCanMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.3 });
const rtgCan = new THREE.Mesh(rtgCanGeo, rtgCanMat);
rtgCan.position.set(-2.4, 1.2, -0.2);
voyagerGroup.add(rtgCan);

// 4. Magnetometer Boom (Long boom extending outward)
const magBoomGeo = new THREE.CylinderGeometry(0.03, 0.03, 4.2, 8);
const magBoom = new THREE.Mesh(magBoomGeo, boomMat);
magBoom.rotation.z = -Math.PI / 4;
magBoom.position.set(1.6, -0.9, -0.2);
voyagerGroup.add(magBoom);

// 5. Pulsing Telemetry LED Beacon
const beaconGeo = new THREE.SphereGeometry(0.12, 16, 16);
const beaconMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
beaconMesh.position.set(0, 0.55, 0.5);
voyagerGroup.add(beaconMesh);

// Raycast hit target for Voyager
const voyagerHitGeo = new THREE.SphereGeometry(2.4, 16, 16);
const voyagerHitMat = new THREE.MeshBasicMaterial({ visible: false });
const voyagerHitMesh = new THREE.Mesh(voyagerHitGeo, voyagerHitMat);

voyagerHitMesh.userData = {
    id: 'Voyager',
    isProbe: true,
    radius: 1.5,
    badge: 'Koinot Zondi • Interstellar Architecture',
    title: 'Voyager 1 • CyberProbe Deep Space Telemetry',
    subtitle: 'Avtonom Tizimlar, Chuqur Arxitektura va Erkin AI Missiyasi',
    content: `Azimjon Kamiljanovning yulduzlararo fazoga yo'naltirilgan texnologik konseptsiyasi.
Yulduzlararo masofalarda avtonom ishlovchi kiber-agentlar arxitekturasi, RTX 5070 lokal GPU infratuzilmasi, markazlashmagan AI protokollari va tizimli optimallashtirish missiyasi.

Telemetriya:
• Missiya: Deep Space Autonomous Computing
• Aloqa kanali: Direct Decentralized RPC
• Holat: Yulduzlararo fazoda faol parvozda
• Boshqaruv: Azimjon Kamiljanov AI Systems Lab`,
    tags: ['Voyager 1', 'Interstellar Mission', 'Autonomous Agents', 'Deep Architecture', 'RTX 5070 CUDA', 'Decentralized Tech'],
    actionUrl: 'https://github.com/AzimjonKamiljanov',
    actionText: 'Voyager Missiyasi',
    githubUrl: 'https://github.com/AzimjonKamiljanov',
    githubText: 'GitHub Profil'
};
voyagerGroup.add(voyagerHitMesh);
voyagerGroup.userData = voyagerHitMesh.userData;
interactableObjects.push(voyagerHitMesh);

// Position Voyager in deep outer solar system (distance 158 units)
let voyagerOrbitAngle = 1.1;
const VOYAGER_DIST = 158;
voyagerGroup.position.set(
    Math.cos(voyagerOrbitAngle) * VOYAGER_DIST,
    14,
    Math.sin(voyagerOrbitAngle) * VOYAGER_DIST
);
voyagerGroup.lookAt(0, 0, 0);
scene.add(voyagerGroup);

function updateVoyager(deltaSpeed = 1.0) {
    if (deltaSpeed > 0) {
        voyagerOrbitAngle += 0.00035 * deltaSpeed;
        voyagerGroup.position.set(
            Math.cos(voyagerOrbitAngle) * VOYAGER_DIST,
            14 + Math.sin(clockTime * 0.5) * 1.2,
            Math.sin(voyagerOrbitAngle) * VOYAGER_DIST
        );
        voyagerGroup.lookAt(0, 0, 0);
    }
    const pulse = 0.5 + 0.5 * Math.sin(clockTime * 4.0);
    beaconMat.color.setRGB(0.2, 0.8 + 0.2 * pulse, 1.0);
}

// ==============================================================================
// 🌌 COSMIC REALISM BOOST ENHANCEMENTS
// ==============================================================================

// ------------------------------------------------------------------------------
// 1. GRAVITATIONAL LENSING BLACK HOLE (SAGITTARIUS A* / GARGANTUA)
// ------------------------------------------------------------------------------
const blackHoleGroup = new THREE.Group();

// Dark event horizon sphere
const eventHorizonGeo = new THREE.SphereGeometry(3.6, 64, 64);
const eventHorizonMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
const eventHorizon = new THREE.Mesh(eventHorizonGeo, eventHorizonMat);
blackHoleGroup.add(eventHorizon);

// Swirling plasma accretion disk with relativistic Doppler beaming
const accretionGeo = new THREE.RingGeometry(3.7, 13.0, 160, 24);
const accretionMat = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uInnerRadius: { value: 3.7 },
        uOuterRadius: { value: 13.0 }
    },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vPos;
        void main() {
            vUv = uv;
            vPos = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float uTime;
        uniform float uInnerRadius;
        uniform float uOuterRadius;
        varying vec2 vUv;
        varying vec3 vPos;

        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }
        float noise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                       mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
        }

        void main() {
            float r = length(vPos.xy);
            float angle = atan(vPos.y, vPos.x);
            float normR = (r - uInnerRadius) / (uOuterRadius - uInnerRadius);
            if (normR < 0.0 || normR > 1.0) discard;

            // Swirling Keplerian plasma flow (accelerates near photon orbit)
            float swirl = angle * 5.0 - uTime * (1.8 / (normR + 0.25));
            float n1 = noise(vec2(normR * 10.0, swirl * 0.6));
            float n2 = noise(vec2(normR * 20.0, swirl * 1.4));
            float plasma = n1 * 0.65 + n2 * 0.35;

            // Relativistic Doppler beaming
            float doppler = 1.0 + 0.58 * cos(angle + 0.5);

            vec3 colInner = vec3(1.0, 0.95, 0.72);
            vec3 colMid = vec3(1.0, 0.52, 0.12);
            vec3 colOuter = vec3(0.85, 0.16, 0.02);

            vec3 color = mix(colInner, colMid, smoothstep(0.0, 0.38, normR));
            color = mix(color, colOuter, smoothstep(0.38, 0.95, normR));
            color *= (0.75 + 0.7 * plasma) * doppler;

            float alpha = smoothstep(0.0, 0.08, normR) * smoothstep(1.0, 0.68, normR) * 0.92;
            gl_FragColor = vec4(color, alpha);
        }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
});
const accretionDisk = new THREE.Mesh(accretionGeo, accretionMat);
accretionDisk.rotation.x = Math.PI / 2 + 0.32;
accretionDisk.rotation.y = 0.2;
blackHoleGroup.add(accretionDisk);

// Gravitational Lensing Halo (Photon sphere thin Einstein ring and warped distortion)
const lensingGeo = new THREE.PlaneGeometry(36, 36);
const lensingMat = new THREE.ShaderMaterial({
    uniforms: {
        uHorizonRadius: { value: 3.6 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float uHorizonRadius;
        varying vec2 vUv;
        void main() {
            vec2 centerUv = vUv - 0.5;
            float dist = length(centerUv) * 36.0;
            if (dist < uHorizonRadius) discard;

            // Photon sphere Einstein ring at r = 4.3
            float photonRing = exp(-pow(dist - 4.3, 2.0) / 0.16) * 1.85;

            // Gravitational lensing warp glow
            float lensingGlow = pow(uHorizonRadius / max(dist, uHorizonRadius), 3.2) * 0.42;

            vec3 ringCol = vec3(1.0, 0.88, 0.55) * photonRing;
            vec3 glowCol = vec3(1.0, 0.48, 0.12) * lensingGlow;

            float alpha = clamp(photonRing + lensingGlow, 0.0, 0.95);
            gl_FragColor = vec4(ringCol + glowCol, alpha);
        }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
});
const lensingMesh = new THREE.Mesh(lensingGeo, lensingMat);
blackHoleGroup.add(lensingMesh);

// Raycast hit target for Black Hole
const blackHoleHitGeo = new THREE.SphereGeometry(7.5, 16, 16);
const blackHoleHitMat = new THREE.MeshBasicMaterial({ visible: false });
const blackHoleHitMesh = new THREE.Mesh(blackHoleHitGeo, blackHoleHitMat);

blackHoleHitMesh.userData = {
    id: 'BlackHole',
    isBlackHole: true,
    radius: 3.6,
    badge: 'Singulyarlik • Gravitatsion Linza',
    title: 'Sagittarius A* • Supermassive Singularity',
    subtitle: 'Fazoni Eguvchi Gravitatsion Linzalanish va Voqealar Gorizonti',
    content: `Somon Yo'li galaktikasi markazidagi o'ta og'ir qora o'ra (Gargantua / Sagittarius A*).
Umumiy nisbiylik nazariyasi (Eynshteyn tenglamalari) bo'yicha cheksiz gravitatsiya qudug'i, yorug'lik ham qochib qutula olmaydigan qop-qora voqealar gorizonti (event horizon) va yorug'lik tezligiga yaqin aylanuvchi oltin-qizil plazma akkretsion diski.

Fizik va Kosmik Ko'rsatkichlar:
• Relyativistik Gravitatsion Linzalanish (GLSL Spacetime Distortion)
• Eynshteyn Foton Sferasi va Doppler nurlanish asimmetriyasi
• Joylashuv: Pluton orbitasidan tashqarida, chuqur yulduzlararo fazoda
• Arxitektura Falsafasi: Katta yuklamalarda 100% buzilmas va yengilmas mustahkam yadroli tizimlar ramzi.`,
    tags: ['General Relativity', 'Event Horizon', 'Accretion Disk', 'Einstein Ring', 'Gravitational Lensing', 'Sagittarius A*', 'GLSL Shader'],
    actionUrl: 'https://github.com/AzimjonKamiljanov',
    actionText: 'Singulyarlik Tahlili',
    githubUrl: 'https://github.com/AzimjonKamiljanov',
    githubText: 'GitHub Profil'
};
blackHoleGroup.add(blackHoleHitMesh);
blackHoleGroup.userData = blackHoleHitMesh.userData;
interactableObjects.push(blackHoleHitMesh);

// Deep space coordinates beyond Pluto (distance ~228 units)
blackHoleGroup.position.set(-170, 26, -145);
scene.add(blackHoleGroup);

// ------------------------------------------------------------------------------
// 6. YULDUZ TURKUMLARI XARITASI (CONSTELLATIONS GRID)
// ------------------------------------------------------------------------------
const constellationsGroup = new THREE.Group();
scene.add(constellationsGroup);
let areConstellationsVisible = true;

const constellationDefs = [
    {
        nameKey: 'orion',
        defaultName: 'ORION',
        stars: [
            { id: 'betelgeuse', pos: [250, 180, -860] },
            { id: 'bellatrix', pos: [120, 200, -880] },
            { id: 'rigel', pos: [140, -120, -900] },
            { id: 'saiph', pos: [260, -130, -870] },
            { id: 'mintaka', pos: [150, 60, -890] },
            { id: 'alnilam', pos: [185, 50, -885] },
            { id: 'alnitak', pos: [220, 40, -880] }
        ],
        lines: [
            ['betelgeuse', 'bellatrix'],
            ['bellatrix', 'mintaka'],
            ['mintaka', 'alnilam'],
            ['alnilam', 'alnitak'],
            ['alnitak', 'saiph'],
            ['saiph', 'rigel'],
            ['rigel', 'mintaka'],
            ['betelgeuse', 'alnitak']
        ],
        center: [185, 230, -875]
    },
    {
        nameKey: 'ursa_major',
        defaultName: 'URSA MAJOR',
        stars: [
            { id: 'dubhe', pos: [-350, 680, -520] },
            { id: 'merak', pos: [-380, 620, -560] },
            { id: 'phecda', pos: [-470, 600, -480] },
            { id: 'megrez', pos: [-450, 660, -450] },
            { id: 'alioth', pos: [-520, 640, -380] },
            { id: 'mizar', pos: [-580, 610, -320] },
            { id: 'alkaid', pos: [-640, 560, -250] }
        ],
        lines: [
            ['dubhe', 'merak'],
            ['merak', 'phecda'],
            ['phecda', 'megrez'],
            ['megrez', 'dubhe'],
            ['megrez', 'alioth'],
            ['alioth', 'mizar'],
            ['mizar', 'alkaid']
        ],
        center: [-480, 710, -440]
    },
    {
        nameKey: 'cassiopeia',
        defaultName: 'CASSIOPEIA',
        stars: [
            { id: 'caph', pos: [120, 780, 460] },
            { id: 'schedar', pos: [180, 760, 480] },
            { id: 'gamma_cas', pos: [240, 790, 430] },
            { id: 'ruchbah', pos: [310, 770, 450] },
            { id: 'segin', pos: [360, 800, 400] }
        ],
        lines: [
            ['caph', 'schedar'],
            ['schedar', 'gamma_cas'],
            ['gamma_cas', 'ruchbah'],
            ['ruchbah', 'segin']
        ],
        center: [240, 830, 440]
    },
    {
        nameKey: 'sagittarius',
        defaultName: 'SAGITTARIUS',
        stars: [
            { id: 'kaus_bor', pos: [-620, -180, -650] },
            { id: 'kaus_med', pos: [-660, -240, -620] },
            { id: 'kaus_aus', pos: [-690, -310, -580] },
            { id: 'ascella', pos: [-620, -320, -640] },
            { id: 'nunki', pos: [-550, -220, -700] },
            { id: 'alnasl', pos: [-730, -210, -550] }
        ],
        lines: [
            ['kaus_bor', 'kaus_med'],
            ['kaus_med', 'kaus_aus'],
            ['kaus_aus', 'ascella'],
            ['ascella', 'nunki'],
            ['nunki', 'kaus_bor'],
            ['kaus_med', 'alnasl'],
            ['alnasl', 'kaus_aus']
        ],
        center: [-640, -140, -640]
    }
];

constellationDefs.forEach(c => {
    const starMap = new Map();
    const starPositions = [];
    c.stars.forEach(s => {
        const v = new THREE.Vector3(...s.pos).normalize().multiplyScalar(910);
        starMap.set(s.id, v);
        starPositions.push(v.x, v.y, v.z);
    });

    const pointsGeo = new THREE.BufferGeometry();
    pointsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    const pointsMat = new THREE.PointsMaterial({
        color: 0xe0f2fe,
        size: 7.0,
        transparent: true,
        opacity: 0.85
    });
    const pointsMesh = new THREE.Points(pointsGeo, pointsMat);
    constellationsGroup.add(pointsMesh);

    const lineCoords = [];
    c.lines.forEach(([id1, id2]) => {
        const v1 = starMap.get(id1);
        const v2 = starMap.get(id2);
        if (v1 && v2) {
            lineCoords.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
        }
    });
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lineCoords, 3));
    const lineMat = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.38,
        linewidth: 1
    });
    const lineMesh = new THREE.LineSegments(lineGeo, lineMat);
    constellationsGroup.add(lineMesh);

    const centerV = new THREE.Vector3(...c.center).normalize().multiplyScalar(895);
    const label = createLabelSprite(c.defaultName, '✦', '#38bdf8');
    label.scale.set(40.0, 10.0, 1);
    label.position.copy(centerV);
    label.userData = { constellationNameKey: c.nameKey };
    constellationsGroup.add(label);
});

function toggleConstellations(forceState) {
    const nextState = typeof forceState === 'boolean' ? forceState : !areConstellationsVisible;
    areConstellationsVisible = nextState;
    constellationsGroup.visible = areConstellationsVisible;
    const uiTexts = translations.ui[currentLang] || translations.ui.uz;
    const btn = document.getElementById('constellations-toggle-btn');
    const txt = document.getElementById('constellations-toggle-text');
    if (btn) btn.classList.toggle('active', areConstellationsVisible);
    if (txt) txt.innerText = areConstellationsVisible ? (uiTexts.constellationsBtnOn || "Turkumlar: Yoniq") : (uiTexts.constellationsBtnOff || "Turkumlar: O'chiq");
}

const constellationsToggleBtn = document.getElementById('constellations-toggle-btn');
if (constellationsToggleBtn) {
    constellationsToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playUiClick();
        toggleConstellations();
    });
}

// ------------------------------------------------------------------------------
// 8. METEOR YOMG'IRI (PERSEID METEOR SHOWER)
// ------------------------------------------------------------------------------
const meteorShowerGroup = new THREE.Group();
scene.add(meteorShowerGroup);

class PerseidMeteorShower {
    constructor() {
        this.meteors = [];
        this.nextSpawnTime = 1.5;
        this.radiant = new THREE.Vector3(500, 380, -600).normalize();
    }

    spawn() {
        if (this.meteors.length >= 3) return;

        const start = new THREE.Vector3(
            (Math.random() - 0.5) * 500,
            120 + Math.random() * 200,
            (Math.random() - 0.5) * 500
        );

        const dir = this.radiant.clone().negate().add(new THREE.Vector3(
            (Math.random() - 0.5) * 0.25,
            (Math.random() - 0.5) * 0.25,
            (Math.random() - 0.5) * 0.25
        )).normalize();

        const length = 22 + Math.random() * 18;
        const speed = 320 + Math.random() * 140;

        const points = [start.clone(), start.clone().add(dir.clone().multiplyScalar(-length))];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({
            color: 0xe0f2fe,
            transparent: true,
            opacity: 0.9,
            linewidth: 1.5
        });
        const line = new THREE.Line(geo, mat);
        meteorShowerGroup.add(line);

        this.meteors.push({
            line,
            geo,
            mat,
            start,
            dir,
            speed,
            length,
            age: 0,
            life: 0.5 + Math.random() * 0.35
        });
    }

    update(dt) {
        this.nextSpawnTime -= dt;
        if (this.nextSpawnTime <= 0) {
            this.spawn();
            this.nextSpawnTime = 2.0 + Math.random() * 3.5;
        }

        for (let i = this.meteors.length - 1; i >= 0; i--) {
            const m = this.meteors[i];
            m.age += dt;
            const progress = m.age / m.life;

            if (progress >= 1.0) {
                meteorShowerGroup.remove(m.line);
                m.geo.dispose();
                m.mat.dispose();
                this.meteors.splice(i, 1);
            } else {
                const travelDist = m.speed * m.age;
                const head = m.start.clone().add(m.dir.clone().multiplyScalar(travelDist));
                const tail = head.clone().add(m.dir.clone().multiplyScalar(-m.length));

                const pos = m.geo.attributes.position;
                pos.setXYZ(0, head.x, head.y, head.z);
                pos.setXYZ(1, tail.x, tail.y, tail.z);
                pos.needsUpdate = true;

                const alpha = Math.sin(progress * Math.PI) * 0.88;
                m.mat.opacity = alpha;
            }
        }
    }
}

const perseidShower = new PerseidMeteorShower();

// ------------------------------------------------------------------------------
// 5. HAJMLAR TAQQOSLASHI REJIMI (SCALE COMPARISON MODE)
// ------------------------------------------------------------------------------
let isScaleModeActive = false;

function toggleScaleComparison(forceState) {
    const nextState = typeof forceState === 'boolean' ? forceState : !isScaleModeActive;
    if (nextState === isScaleModeActive) return;
    isScaleModeActive = nextState;
    playUiClick();

    const uiTexts = translations.ui[currentLang] || translations.ui.uz;
    const btn = document.getElementById('scale-compare-btn');
    const txt = document.getElementById('scale-compare-text');
    if (btn) btn.classList.toggle('active', isScaleModeActive);
    if (txt) txt.innerText = isScaleModeActive ? (uiTexts.scaleCompareOn || "Hajmlar: Yoniq") : (uiTexts.scaleCompareBtn || "Hajmlar Taqqoslashi");

    if (isScaleModeActive) {
        if (isTourActive) exitTour(false);
        if (currentSurfaceMode) setSurfaceView(null);
        if (currentTarget) hideInfo();
        currentTarget = null;

        if (orbitLinesGroup) orbitLinesGroup.visible = false;
        if (typeof asteroidBeltGroup !== 'undefined' && asteroidBeltGroup) asteroidBeltGroup.visible = false;
        if (typeof cometGroup !== 'undefined' && cometGroup) cometGroup.visible = false;
        if (typeof voyagerGroup !== 'undefined' && voyagerGroup) voyagerGroup.visible = false;
        if (typeof blackHoleGroup !== 'undefined' && blackHoleGroup) blackHoleGroup.visible = false;
        if (moonOrbitCenterRef) moonOrbitCenterRef.visible = false;
        if (jupiterMoonsCenterRef) jupiterMoonsCenterRef.visible = false;
        if (saturnMoonsCenterRef) saturnMoonsCenterRef.visible = false;

        const scaleLayout = [
            { id: 'sun', x: -52 },
            { id: 'Mercury', x: -38 },
            { id: 'Venus', x: -32 },
            { id: 'Earth', x: -24 },
            { id: 'Mars', x: -17 },
            { id: 'Jupiter', x: -6 },
            { id: 'Saturn', x: 8 },
            { id: 'Uranus', x: 20 },
            { id: 'Neptune', x: 29 },
            { id: 'Pluto', x: 37 }
        ];

        gsap.to(sun.position, { x: -52, y: 0, z: 0, duration: 1.5, ease: 'power2.inOut' });
        if (sun.userData && sun.userData.scaleLabel) sun.userData.scaleLabel.visible = true;

        scaleLayout.forEach(item => {
            if (item.id === 'sun') return;
            const p = planets.find(pl => pl.mesh.userData && pl.mesh.userData.id === item.id);
            if (p) {
                gsap.to(p.orbitGroup.rotation, { y: 0, duration: 1.2, ease: 'power2.inOut' });
                gsap.to(p.mesh.position, { x: item.x, y: 0, z: 0, duration: 1.5, ease: 'power2.inOut' });
                if (p.mesh.userData && p.mesh.userData.scaleLabel) {
                    p.mesh.userData.scaleLabel.visible = true;
                }
            }
        });

        gsap.to(camera.position, {
            x: 0,
            y: 14,
            z: 76,
            duration: 1.8,
            ease: 'power2.inOut',
            onUpdate: () => {
                controls.target.set(0, 0, 0);
                controls.update();
            }
        });
    } else {
        gsap.to(sun.position, { x: 0, y: 0, z: 0, duration: 1.5, ease: 'power2.inOut' });
        if (sun.userData && sun.userData.scaleLabel) sun.userData.scaleLabel.visible = false;

        planetsData.forEach(d => {
            const p = planets.find(pl => pl.mesh.userData && pl.mesh.userData.id === d.id);
            if (p) {
                gsap.to(p.mesh.position, { x: d.distance, y: 0, z: 0, duration: 1.5, ease: 'power2.inOut' });
                if (p.mesh.userData && p.mesh.userData.scaleLabel) {
                    p.mesh.userData.scaleLabel.visible = false;
                }
            }
        });

        if (orbitLinesGroup) orbitLinesGroup.visible = true;
        if (typeof asteroidBeltGroup !== 'undefined' && asteroidBeltGroup) asteroidBeltGroup.visible = true;
        if (typeof cometGroup !== 'undefined' && cometGroup) cometGroup.visible = true;
        if (typeof voyagerGroup !== 'undefined' && voyagerGroup) voyagerGroup.visible = true;
        if (typeof blackHoleGroup !== 'undefined' && blackHoleGroup) blackHoleGroup.visible = true;
        if (moonOrbitCenterRef) moonOrbitCenterRef.visible = true;
        if (jupiterMoonsCenterRef) jupiterMoonsCenterRef.visible = true;
        if (saturnMoonsCenterRef) saturnMoonsCenterRef.visible = true;

        resetView();
    }
}

const scaleCompareBtn = document.getElementById('scale-compare-btn');
if (scaleCompareBtn) {
    scaleCompareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleScaleComparison();
    });
}

// ------------------------------------------------------------------------------
// 3. "EARTHRISE" VA "MARS QUYOSH BOTISHI" (SURFACE VIEW MODE)
// ------------------------------------------------------------------------------
let currentSurfaceMode = null; // null | 'earthrise' | 'mars_sunset'
let surfaceSavedCamPos = new THREE.Vector3();
let surfaceSavedTarget = new THREE.Vector3();

const surfaceViewBar = document.getElementById('surface-view-bar');
const surfaceEarthriseBtn = document.getElementById('surface-earthrise-btn');
const surfaceMarsBtn = document.getElementById('surface-mars-btn');
const surfaceExitBtn = document.getElementById('surface-exit-btn');
const surfaceViewBtn = document.getElementById('surface-view-btn');

function setSurfaceView(mode) {
    if (mode === currentSurfaceMode) return;
    playUiClick();

    if (mode) {
        if (!currentSurfaceMode) {
            surfaceSavedCamPos.copy(camera.position);
            surfaceSavedTarget.copy(controls.target);
        }
        currentSurfaceMode = mode;
        if (isScaleModeActive) toggleScaleComparison(false);
        if (isSkyViewActive) toggleSkyView(false);
        if (isTourActive) exitTour(false);
        hideInfo();
        currentTarget = null;

        if (surfaceViewBar) surfaceViewBar.classList.remove('hidden');
        if (surfaceViewBtn) surfaceViewBtn.classList.add('active');
        if (surfaceEarthriseBtn) surfaceEarthriseBtn.classList.toggle('active', mode === 'earthrise');
        if (surfaceMarsBtn) surfaceMarsBtn.classList.toggle('active', mode === 'mars_sunset');

        if (mode === 'earthrise' && moonMeshRef) {
            const mPos = new THREE.Vector3();
            moonMeshRef.getWorldPosition(mPos);
            const earthObj = planets.find(p => p.mesh.userData && p.mesh.userData.id === 'Earth');
            if (earthObj) {
                const ePos = new THREE.Vector3();
                earthObj.mesh.getWorldPosition(ePos);
                const dir = ePos.clone().sub(mPos).normalize();
                camera.position.copy(mPos.clone().add(dir.clone().multiplyScalar(0.55)).add(new THREE.Vector3(0, 0.25, 0)));
                controls.target.copy(ePos);
                controls.update();
            }
        } else if (mode === 'mars_sunset') {
            const marsObj = planets.find(p => p.mesh.userData && p.mesh.userData.id === 'Mars');
            if (marsObj) {
                const marsPos = new THREE.Vector3();
                marsObj.mesh.getWorldPosition(marsPos);
                camera.position.copy(marsPos.clone().add(new THREE.Vector3(0, 0, 0).sub(marsPos).normalize().multiplyScalar(1.68)).add(new THREE.Vector3(0, 0.4, 0)));
                controls.target.set(0, 0, 0);
                controls.update();
            }
        }
    } else {
        currentSurfaceMode = null;
        if (surfaceViewBar) surfaceViewBar.classList.add('hidden');
        if (surfaceViewBtn) surfaceViewBtn.classList.remove('active');

        gsap.to(camera.position, {
            x: surfaceSavedCamPos.x || 0,
            y: surfaceSavedCamPos.y || 165,
            z: surfaceSavedCamPos.z || 195,
            duration: 1.6,
            ease: "power2.out",
            onUpdate: () => {
                controls.target.copy(surfaceSavedTarget);
                controls.update();
            }
        });
    }
}

if (surfaceViewBtn) {
    surfaceViewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setSurfaceView(currentSurfaceMode ? null : 'earthrise');
    });
}
if (surfaceEarthriseBtn) {
    surfaceEarthriseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setSurfaceView('earthrise');
    });
}
if (surfaceMarsBtn) {
    surfaceMarsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setSurfaceView('mars_sunset');
    });
}
if (surfaceExitBtn) {
    surfaceExitBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setSurfaceView(null);
    });
}

// ------------------------------------------------------------------------------
// 7. MOBIL GIROSKOP REJIMI (PLANETARIUM / SKY VIEW)
// ------------------------------------------------------------------------------
let isSkyViewActive = false;
let skyViewSavedPos = new THREE.Vector3();

const skyViewToggleBtn = document.getElementById('skyview-toggle-btn');
const skyviewExitBanner = document.getElementById('skyview-exit-banner');
const skyviewExitBtn = document.getElementById('skyview-exit-btn');

function onDeviceOrientation(event) {
    if (!isSkyViewActive) return;
    const alpha = event.alpha ? THREE.MathUtils.degToRad(event.alpha) : 0;
    const beta = event.beta ? THREE.MathUtils.degToRad(event.beta) : 0;
    const gamma = event.gamma ? THREE.MathUtils.degToRad(event.gamma) : 0;
    const orient = (typeof window.orientation !== 'undefined') ? THREE.MathUtils.degToRad(window.orientation) : 0;

    const zee = new THREE.Vector3(0, 0, 1);
    const euler = new THREE.Euler();
    const q0 = new THREE.Quaternion();
    const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));

    euler.set(beta, alpha, -gamma, 'YXZ');
    const quat = new THREE.Quaternion().setFromEuler(euler);
    quat.multiply(q1);
    quat.multiply(q0.setFromAxisAngle(zee, -orient));

    camera.quaternion.slerp(quat, 0.22);
}

function toggleSkyView(forceState) {
    const nextState = typeof forceState === 'boolean' ? forceState : !isSkyViewActive;
    if (nextState === isSkyViewActive) return;
    isSkyViewActive = nextState;
    playUiClick();

    if (isSkyViewActive) {
        if (currentSurfaceMode) setSurfaceView(null);
        if (isScaleModeActive) toggleScaleComparison(false);
        if (isTourActive) exitTour(false);
        if (currentTarget) hideInfo();
        currentTarget = null;

        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission().then(state => {
                if (state === 'granted') {
                    window.addEventListener('deviceorientation', onDeviceOrientation, true);
                }
            }).catch(() => {});
        } else {
            window.addEventListener('deviceorientation', onDeviceOrientation, true);
        }

        skyViewSavedPos.copy(camera.position);
        controls.enabled = false;
        camera.position.set(0, 2, 0);

        if (skyviewExitBanner) skyviewExitBanner.classList.remove('hidden');
        if (skyViewToggleBtn) skyViewToggleBtn.classList.add('active');
    } else {
        window.removeEventListener('deviceorientation', onDeviceOrientation, true);
        controls.enabled = true;
        if (skyviewExitBanner) skyviewExitBanner.classList.add('hidden');
        if (skyViewToggleBtn) skyViewToggleBtn.classList.remove('active');

        gsap.to(camera.position, {
            x: skyViewSavedPos.x || 0,
            y: skyViewSavedPos.y || 165,
            z: skyViewSavedPos.z || 195,
            duration: 1.5,
            ease: "power2.out",
            onUpdate: () => {
                controls.target.set(0, 0, 0);
                controls.update();
            }
        });
    }
}

if (skyViewToggleBtn) {
    skyViewToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSkyView();
    });
}
if (skyviewExitBtn) {
    skyviewExitBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSkyView(false);
    });
}

// ==========================================
// 4. UI ELEMENTS & MODAL CONTROLS
// ==========================================

const infoPanel = document.getElementById('info-panel');
const infoBadge = document.getElementById('info-badge');
const infoTitle = document.getElementById('info-title');
const infoSubtitle = document.getElementById('info-subtitle');
const infoContent = document.getElementById('info-content');
const infoTags = document.getElementById('info-tags');
const infoActionBtn = document.getElementById('info-action-btn');
const infoGithubBtn = document.getElementById('info-github-btn');
const backBtn = document.getElementById('back-button');
const modalClose = document.getElementById('modal-close');

let currentTarget = null;
let isAnimating = false;
let isOrbitPaused = false;

// Multilingual Engine (UZ, EN, RU)
let currentLang = localStorage.getItem('portfolio_lang') || 'uz';
if (!translations.ui[currentLang]) currentLang = 'uz';

// ==========================================
// WEB AUDIO API SPACE SOUNDSCAPE & SCI-FI SFX
// ==========================================
let audioCtx = null;
let isAudioMuted = true;
let ambientMasterGain = null;
let solarWindNode = null;

function initAudio() {
    if (audioCtx) return;
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        audioCtx = new AudioContextClass();
    } catch (e) {
        console.warn("Audio Context init warning:", e);
    }
}

// User interaction gesture listener to seamlessly unlock audio on mobile
['touchstart', 'touchend', 'click', 'pointerdown'].forEach(evtType => {
    window.addEventListener(evtType, () => {
        if (audioCtx && audioCtx.state === 'suspended' && !isAudioMuted) {
            audioCtx.resume();
        }
    }, { passive: true });
});

function playUiClick() {
    if (isAudioMuted || !audioCtx) return;
    try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.04);
        gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.045);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
    } catch (_) {}
}

function playUiHover() {
    if (isAudioMuted || !audioCtx) return;
    try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(520, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.012, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.025);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.03);
    } catch (_) {}
}

function playUiTransmit() {
    if (isAudioMuted || !audioCtx) return;
    try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.07, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.22);
    } catch (_) {}
}

function playUiSuccess() {
    if (isAudioMuted || !audioCtx) return;
    try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const now = audioCtx.currentTime;
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(1046.5, now);
        osc2.frequency.setValueAtTime(1318.5, now + 0.08);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(audioCtx.destination);
        osc1.start(now);
        osc1.stop(now + 0.15);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.35);
    } catch (_) {}
}

function playUiError() {
    if (isAudioMuted || !audioCtx) return;
    try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.setValueAtTime(105, now + 0.09);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.24);
    } catch (_) {}
}

let ambientMusicAudio = null;

function toggleAudio() {
    initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    isAudioMuted = !isAudioMuted;
    window.isAudioMuted = isAudioMuted;
    const btn = document.getElementById('audio-toggle-btn');
    const icon = document.getElementById('audio-toggle-icon');
    const text = document.getElementById('audio-toggle-text');
    const uiTexts = translations.ui[currentLang] || translations.ui.uz;

    if (!ambientMusicAudio) {
        try {
            ambientMusicAudio = new Audio('assets/space_ambient.mp3');
            ambientMusicAudio.loop = true;
            ambientMusicAudio.volume = 0.40;
        } catch (e) {
            console.warn("Ambient music init error:", e);
        }
    }

    if (isAudioMuted) {
        if (ambientMusicAudio) {
            ambientMusicAudio.pause();
        }
        if (btn) btn.classList.add('audio-muted');
        if (icon) icon.innerHTML = '<svg class="btn-svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/></svg>';
        if (text) text.innerText = uiTexts.audioOff;
    } else {
        if (ambientMusicAudio) {
            ambientMusicAudio.play().catch(e => console.log('Ambient music playback deferred:', e));
        }
        if (btn) btn.classList.remove('audio-muted');
        if (icon) icon.innerHTML = '<svg class="btn-svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>';
        if (text) text.innerText = uiTexts.audioOn;
        playUiClick();
    }
}

// Helper functions for safe HTML string interpolation
function escapeHtmlAttr(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escapeHtmlText(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escapeTgHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ==========================================
// DIRECT AI / TELEGRAM TERMINAL (FEATURE 6)
// ==========================================
let currentContactType = 'tg';

function renderMoonTerminal() {
    const container = document.getElementById('moon-terminal-container');
    if (!container) return;
    container.classList.remove('hidden');
    container.style.display = 'block';

    const prevName = document.getElementById('terminal-name')?.value || '';
    const prevContact = document.getElementById('terminal-contact')?.value || '';
    let prevMsg = document.getElementById('terminal-message')?.value || '';

    const topicIcons = ['🤝', '💼', '⚡', '☕'];
    const topicKeys = ['topicCollab', 'topicProject', 'topicConsulting', 'topicQuestion'];

    let activeTopicIndex = -1;
    const topicMatch = prevMsg.match(/^\[(.*?)\]\s*/);
    if (topicMatch) {
        const inside = topicMatch[1];
        for (let i = 0; i < topicIcons.length; i++) {
            if (inside.includes(topicIcons[i])) {
                activeTopicIndex = i;
                break;
            }
        }
    } else {
        const activeChip = container.querySelector('.topic-chip.active');
        if (activeChip) {
            const topicText = activeChip.getAttribute('data-topic') || '';
            for (let i = 0; i < topicIcons.length; i++) {
                if (topicText.includes(topicIcons[i])) {
                    activeTopicIndex = i;
                    break;
                }
            }
        }
    }

    const termTexts = (translations.ui[currentLang] && translations.ui[currentLang].terminal)
        ? translations.ui[currentLang].terminal
        : translations.ui.uz.terminal;

    // If a topic was selected, sync its bracketed header to current language
    if (activeTopicIndex !== -1) {
        const newTopic = termTexts[topicKeys[activeTopicIndex]];
        if (topicMatch) {
            prevMsg = `[${newTopic}] ` + prevMsg.replace(/^\[.*?\]\s*/, '');
        }
    }

    let countColor = '#64748b';
    if (prevMsg.length >= 1000) countColor = '#ef4444';
    else if (prevMsg.length >= 850) countColor = '#f59e0b';

    const quickChipsHtml = topicKeys.map((key, idx) => {
        const topicStr = termTexts[key];
        const isActive = (idx === activeTopicIndex) ? ' active' : '';
        return `<button type="button" class="topic-chip${isActive}" data-topic="${escapeHtmlAttr(topicStr)}">${escapeHtmlText(topicStr)}</button>`;
    }).join('');

    const placeholders = {
        tg: termTexts.contactPlaceholderTg || "@username",
        email: termTexts.contactPlaceholderEmail || "sizning@emailingiz.com",
        phone: termTexts.contactPlaceholderPhone || "+998 90 123 45 67"
    };

    const prefixes = {
        tg: '@',
        email: '📧',
        phone: '📞'
    };

    const contactPlaceholder = placeholders[currentContactType] || placeholders.tg;
    const contactPrefix = prefixes[currentContactType] || '@';

    container.innerHTML = `
        <div class="cyber-terminal">
            <div class="terminal-header">
                <div class="terminal-dots">
                    <span class="dot dot-red"></span>
                    <span class="dot dot-yellow"></span>
                    <span class="dot dot-green"></span>
                </div>
                <div class="terminal-title">
                    <span class="terminal-prompt">CYBER_UPLINK://</span>
                    <a href="https://t.me/CyberAgent0bot" target="_blank" rel="noopener noreferrer" class="terminal-channel" title="Telegram Botda Ochish">@CyberAgent0bot</a>
                </div>
                <span class="terminal-status-pill">${termTexts.statusOnline}</span>
            </div>
            
            <p class="terminal-intro">${termTexts.intro}</p>

            <div class="terminal-notice-box">
                <span class="notice-icon"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.8;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></span>
                <p class="notice-text">${escapeHtmlText(termTexts.notice || "Mendan (ya'ni Azimjondan) aniq va tezroq javob olish uchun barcha ma'lumotlarni to'g'ri va to'liq kiriting.")}</p>
            </div>

            <div class="terminal-quick-topics">
                ${quickChipsHtml}
            </div>

            <form id="terminal-form" class="terminal-form" novalidate>
                <div class="terminal-field">
                    <label for="terminal-name">${termTexts.nameLabel || "F.I.SH / ISMINGIZ"}</label>
                    <div class="input-glow-wrap">
                        <span class="input-prefix"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.6;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>
                        <input type="text" id="terminal-name" placeholder="${escapeHtmlAttr(termTexts.namePlaceholder || "To'liq ismingizni kiriting...")}" maxlength="60" required autocomplete="name" value="${escapeHtmlAttr(prevName)}">
                    </div>
                </div>

                <div class="terminal-field">
                    <label for="terminal-contact">${termTexts.contactLabel || "ALOQA MA'LUMOTI"}</label>
                    <div class="terminal-type-tabs">
                        <button type="button" class="type-tab${currentContactType === 'tg' ? ' active' : ''}" data-type="tg">${termTexts.contactTypeTg || 'Telegram (@username)'}</button>
                        <button type="button" class="type-tab${currentContactType === 'email' ? ' active' : ''}" data-type="email">${termTexts.contactTypeEmail || 'Email Manzil'}</button>
                        <button type="button" class="type-tab${currentContactType === 'phone' ? ' active' : ''}" data-type="phone">${termTexts.contactTypePhone || 'Telefon Raqam'}</button>
                    </div>
                    <div class="input-glow-wrap">
                        <span class="input-prefix" id="terminal-contact-prefix">${contactPrefix}</span>
                        <input type="text" id="terminal-contact" placeholder="${escapeHtmlAttr(contactPlaceholder)}" maxlength="80" required value="${escapeHtmlAttr(prevContact)}">
                    </div>
                </div>

                <div class="terminal-field">
                    <label for="terminal-message">${termTexts.messageLabel}</label>
                    <div class="input-glow-wrap textarea-wrap">
                        <textarea id="terminal-message" rows="3" placeholder="${escapeHtmlAttr(termTexts.messagePlaceholder)}" maxlength="1000" required>${escapeHtmlText(prevMsg)}</textarea>
                        <div class="char-counter"><span id="char-count" style="color:${countColor}">${prevMsg.length}</span>/1000</div>
                    </div>
                </div>

                <button type="submit" id="terminal-submit-btn" class="terminal-send-btn">
                    <span class="send-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></span>
                    <span id="terminal-send-text">${termTexts.sendBtn}</span>
                </button>

                <div id="terminal-feedback" class="terminal-feedback hidden" aria-live="polite"></div>
            </form>

            <div class="terminal-direct-channels">
                <h4 class="channels-title">${escapeHtmlText(termTexts.directChannelsTitle || "To'g'ridan-to'g'ri Aloqa Kanallari & Shoshilinch Qo'ng'iroq:")}</h4>
                <div class="channels-grid">
                    <a href="https://t.me/KamiljanovAzimjon" target="_blank" rel="noopener noreferrer" class="channel-btn channel-tg">
                        <span class="ch-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .37z"/></svg></span>
                        <div class="ch-info">
                            <span class="ch-name">Telegram Shaxsiy</span>
                            <span class="ch-val">@KamiljanovAzimjon</span>
                        </div>
                    </a>
                    <a href="mailto:azimjonkamiljanov@gmail.com" class="channel-btn channel-email">
                        <span class="ch-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg></span>
                        <div class="ch-info">
                            <span class="ch-name">Rasmiy Email</span>
                            <span class="ch-val">azimjonkamiljanov@gmail.com</span>
                        </div>
                    </a>
                    <a href="https://t.me/CyberAgentNexus" target="_blank" rel="noopener noreferrer" class="channel-btn channel-voip">
                        <span class="ch-icon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg></span>
                        <div class="ch-info">
                            <span class="ch-name">${escapeHtmlText(termTexts.voipCallTitle || "Favqulodda Onlayn Qo'ng'iroq")}</span>
                            <span class="ch-val">@CyberAgentNexus (AI & VoIP)</span>
                        </div>
                    </a>
                </div>
                <div class="voip-hint">${escapeHtmlText(termTexts.voipHint || "Juda muhim va kechiktirib bo'lmaydigan masala bo'lsa, @CyberAgentNexus profiliga to'g'ridan-to'g'ri Telegram orqali qo'ng'iroq qilishingiz mumkin. Sun'iy intellekt assistenti qo'ng'iroqni qabul qilib, kerak bo'lsa darhol shaxsan Azimjonga ulaydi.")}</div>
            </div>
        </div>
    `;

    // Type tab switcher
    container.querySelectorAll('.type-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            playUiClick();
            const type = tab.getAttribute('data-type');
            currentContactType = type;
            container.querySelectorAll('.type-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const prefixEl = document.getElementById('terminal-contact-prefix');
            if (prefixEl) prefixEl.innerText = prefixes[type] || '@';

            const contactInput = document.getElementById('terminal-contact');
            if (contactInput) {
                contactInput.placeholder = placeholders[type] || '';
                contactInput.focus();
            }
        });
    });

    function updateCharCount(len) {
        const charCount = document.getElementById('char-count');
        if (!charCount) return;
        charCount.innerText = len;
        if (len >= 1000) {
            charCount.style.color = '#ef4444';
        } else if (len >= 850) {
            charCount.style.color = '#f59e0b';
        } else {
            charCount.style.color = '#64748b';
        }
    }

    // Chip click handler with toggle behavior
    container.querySelectorAll('.topic-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            playUiClick();
            const topic = chip.getAttribute('data-topic');
            const textarea = document.getElementById('terminal-message');
            const isAlreadyActive = chip.classList.contains('active');

            if (isAlreadyActive) {
                chip.classList.remove('active');
                if (textarea) {
                    textarea.value = textarea.value.replace(/^\[.*?\]\s*/, '');
                    updateCharCount(textarea.value.length);
                }
            } else {
                container.querySelectorAll('.topic-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                if (textarea) {
                    textarea.value = `[${topic}] ` + textarea.value.replace(/^\[.*?\]\s*/, '');
                    textarea.focus();
                    updateCharCount(textarea.value.length);
                }
            }

            const feedback = document.getElementById('terminal-feedback');
            if (feedback && feedback.classList.contains('error')) {
                feedback.classList.add('hidden');
            }
        });
    });

    // Textarea input and keyboard shortcut listener
    const textarea = document.getElementById('terminal-message');
    if (textarea) {
        textarea.addEventListener('input', () => {
            updateCharCount(textarea.value.length);
            const currentMatch = textarea.value.match(/^\[(.*?)\]\s*/);
            container.querySelectorAll('.topic-chip').forEach(chip => {
                if (currentMatch) {
                    chip.classList.toggle('active', chip.getAttribute('data-topic') === currentMatch[1]);
                } else {
                    chip.classList.remove('active');
                }
            });
            const feedback = document.getElementById('terminal-feedback');
            if (feedback && !feedback.classList.contains('hidden')) {
                feedback.classList.add('hidden');
            }
        });

        textarea.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                const formEl = document.getElementById('terminal-form');
                if (formEl) {
                    formEl.requestSubmit ? formEl.requestSubmit() : document.getElementById('terminal-submit-btn')?.click();
                }
            }
        });
    }

    // Dismiss feedback when visitor begins correcting name or contact fields
    ['terminal-name', 'terminal-contact'].forEach(id => {
        const inputEl = document.getElementById(id);
        if (inputEl) {
            inputEl.addEventListener('input', () => {
                const feedback = document.getElementById('terminal-feedback');
                if (feedback && !feedback.classList.contains('hidden')) {
                    feedback.classList.add('hidden');
                }
            });
        }
    });

    // Form submit listener with isSending lock and AbortController timeout
    let isSending = false;
    const form = document.getElementById('terminal-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (isSending) return;

            const name = document.getElementById('terminal-name')?.value.trim() || '';
            const contact = document.getElementById('terminal-contact')?.value.trim() || '';
            const msg = document.getElementById('terminal-message')?.value.trim() || '';
            const feedback = document.getElementById('terminal-feedback');
            const submitBtn = document.getElementById('terminal-submit-btn');
            const sendText = document.getElementById('terminal-send-text');
            const sendIcon = submitBtn ? submitBtn.querySelector('.send-icon') : null;

            // Strip topic bracket header to ensure visitor actually entered a message body
            const actualBody = msg.replace(/^\[.*?\]\s*/, '').trim();

            if (!name || name.length < 2 || !contact || contact.length < 3 || !actualBody || actualBody.length < 3) {
                playUiError();
                if (feedback) {
                    feedback.className = 'terminal-feedback error';
                    feedback.innerText = termTexts.errorValidation;
                    feedback.classList.remove('hidden');
                }
                return;
            }

            isSending = true;
            playUiTransmit();
            if (submitBtn) submitBtn.disabled = true;
            if (sendIcon) sendIcon.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;" class="spin"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
            if (sendText) sendText.innerText = termTexts.sending;
            if (feedback) {
                feedback.className = 'terminal-feedback sending';
                feedback.innerText = termTexts.sending;
                feedback.classList.remove('hidden');
            }

            const abortController = new AbortController();
            const timeoutId = setTimeout(() => abortController.abort(), 15000);

            try {
                const cleanContact = contact.trim();
                const topicMatch = msg.match(/^\[(.*?)\]/);
                const topicVal = topicMatch ? topicMatch[1] : '';
                const response = await fetch('/api/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json; charset=utf-8' },
                    body: JSON.stringify({
                        name: name,
                        contact: cleanContact,
                        message: msg,
                        lang: currentLang,
                        topic: topicVal
                    }),
                    signal: abortController.signal
                });

                const resData = await response.json();
                if (response.ok && resData.ok) {
                    playUiSuccess();
                    if (feedback) {
                        feedback.className = 'terminal-feedback success';
                        feedback.innerText = termTexts.success;
                    }
                    form.reset();
                    container.querySelectorAll('.topic-chip').forEach(c => c.classList.remove('active'));
                    updateCharCount(0);
                } else {
                    throw new Error(resData.error || resData.description || 'API Error');
                }
            } catch (err) {
                playUiError();
                console.warn("Direct Terminal Telegram Send:", err);
                if (feedback) {
                    feedback.className = 'terminal-feedback error';
                    const linkLabel = currentLang === 'en' 
                        ? 'Chat with @KamiljanovAzimjon on Telegram →' 
                        : (currentLang === 'ru' ? 'Написать @KamiljanovAzimjon в Telegram →' : '@KamiljanovAzimjon ga yozish →');
                    feedback.innerHTML = `${termTexts.errorNetwork} <br><a href="https://t.me/KamiljanovAzimjon" target="_blank" rel="noopener noreferrer" style="color:#00d2ff;text-decoration:underline;margin-top:6px;display:inline-block;"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px;"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>${linkLabel}</a>`;
                }
            } finally {
                clearTimeout(timeoutId);
                isSending = false;
                if (submitBtn) submitBtn.disabled = false;
                if (sendIcon) sendIcon.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
                if (sendText) sendText.innerText = termTexts.sendBtn;
            }
        });
    }
}

// ==========================================
// CATALOG SEARCH & CATEGORY FILTERS
// ==========================================
let activeCategory = 'all';
const catalogSearchInput = document.getElementById('catalog-search');
const catalogSearchClear = document.getElementById('catalog-search-clear');
const catalogEmptyState = document.getElementById('catalog-empty-state');
const stellarDivider = document.querySelector('.catalog-section-divider');

function applyCatalogFilters() {
    const query = catalogSearchInput ? catalogSearchInput.value.toLowerCase().trim() : '';
    if (catalogSearchClear) {
        catalogSearchClear.classList.toggle('hidden', query.length === 0);
    }

    let visiblePlanetsCount = 0;
    let visibleStarsCount = 0;

    const allCards = document.querySelectorAll('.catalog-card, .catalog-star-card');
    allCards.forEach(card => {
        const categories = (card.getAttribute('data-categories') || '').split(' ');
        const matchesCategory = (activeCategory === 'all') || categories.includes(activeCategory);

        let matchesSearch = true;
        if (query.length > 0) {
            const cardText = card.innerText.toLowerCase();
            matchesSearch = cardText.includes(query);
        }

        const isVisible = matchesCategory && matchesSearch;
        card.style.display = isVisible ? '' : 'none';

        if (isVisible) {
            if (card.classList.contains('catalog-card')) visiblePlanetsCount++;
            else visibleStarsCount++;
        }
    });

    if (stellarDivider) {
        stellarDivider.style.display = (visibleStarsCount > 0) ? '' : 'none';
    }
    if (catalogEmptyState) {
        const totalVisible = visiblePlanetsCount + visibleStarsCount;
        catalogEmptyState.classList.toggle('hidden', totalVisible > 0);
    }
}

if (catalogSearchInput) {
    catalogSearchInput.addEventListener('input', () => {
        applyCatalogFilters();
    });
}

if (catalogSearchClear) {
    catalogSearchClear.addEventListener('click', () => {
        playUiClick();
        if (catalogSearchInput) {
            catalogSearchInput.value = '';
            catalogSearchInput.focus();
        }
        applyCatalogFilters();
    });
}

document.querySelectorAll('.cat-filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        playUiClick();
        document.querySelectorAll('.cat-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeCategory = btn.getAttribute('data-category') || 'all';
        applyCatalogFilters();
    });
});

// ==========================================
// MULTILINGUAL LOCALIZATION ENGINE
// ==========================================
function setLanguage(lang) {
    if (!translations.ui[lang]) lang = 'uz';
    currentLang = lang;
    localStorage.setItem('portfolio_lang', lang);
    document.documentElement.lang = lang;

    // 1. Language switcher buttons active state
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });

    // 2. Header and Controls
    const uiTexts = translations.ui[lang];
    const brandTitleEl = document.querySelector('.brand-title');
    if (brandTitleEl) brandTitleEl.innerText = uiTexts.brandTitle;

    const brandSubtitleEl = document.querySelector('.brand-subtitle');
    if (brandSubtitleEl) brandSubtitleEl.innerText = uiTexts.brandSubtitle;

    const overviewBtnText = document.getElementById('overview-btn-text');
    if (overviewBtnText) overviewBtnText.innerText = uiTexts.overviewBtn;

    const audioToggleText = document.getElementById('audio-toggle-text');
    if (audioToggleText) audioToggleText.innerText = isAudioMuted ? uiTexts.audioOff : uiTexts.audioOn;

    const orbitToggleText = document.getElementById('orbit-toggle-text');
    if (orbitToggleText) {
        orbitToggleText.innerText = isOrbitPaused ? uiTexts.orbitPaused : uiTexts.orbitActive;
    }
    const warpSpeedText = document.getElementById('warp-speed-text');
    if (warpSpeedText) {
        if (orbitSpeedMultiplier === 5) warpSpeedText.innerText = uiTexts.warpSpeed5x || "Vaqt: 5x";
        else if (orbitSpeedMultiplier === 20) warpSpeedText.innerText = uiTexts.warpSpeed20x || "Vaqt: 20x";
        else warpSpeedText.innerText = uiTexts.warpSpeed1x || "Vaqt: 1x";
    }
    const orbitsToggleText = document.getElementById('orbits-toggle-text');
    if (orbitsToggleText) {
        const isVis = (typeof orbitLinesGroup === 'undefined' || !orbitLinesGroup) ? true : orbitLinesGroup.visible;
        orbitsToggleText.innerText = isVis ? (uiTexts.orbitsActive || "Orbitalar: Yoniq") : (uiTexts.orbitsHidden || "Orbitalar: O'chiq");
    }
    const cinematicToggleText = document.getElementById('cinematic-toggle-text');
    if (cinematicToggleText && uiTexts.cinematicBtn) cinematicToggleText.innerText = uiTexts.cinematicBtn;
    const cinematicExitText = document.getElementById('cinematic-exit-text');
    if (cinematicExitText && uiTexts.cinematicExit) cinematicExitText.innerText = uiTexts.cinematicExit;

    const constellationsToggleText = document.getElementById('constellations-toggle-text');
    if (constellationsToggleText) {
        constellationsToggleText.innerText = areConstellationsVisible ? (uiTexts.constellationsBtnOn || "Turkumlar: Yoniq") : (uiTexts.constellationsBtnOff || "Turkumlar: O'chiq");
    }
    const scaleCompareText = document.getElementById('scale-compare-text');
    if (scaleCompareText) {
        scaleCompareText.innerText = isScaleModeActive ? (uiTexts.scaleCompareOn || "Hajmlar: Yoniq") : (uiTexts.scaleCompareBtn || "Hajmlar Taqqoslashi");
    }
    const surfaceViewText = document.getElementById('surface-view-text');
    if (surfaceViewText && uiTexts.surfaceViewBtn) surfaceViewText.innerText = uiTexts.surfaceViewBtn;
    const surfaceEarthriseText = document.getElementById('surface-earthrise-text');
    if (surfaceEarthriseText && uiTexts.surfaceEarthrise) surfaceEarthriseText.innerText = uiTexts.surfaceEarthrise;
    const surfaceMarsText = document.getElementById('surface-mars-text');
    if (surfaceMarsText && uiTexts.surfaceMars) surfaceMarsText.innerText = uiTexts.surfaceMars;
    const surfaceExitText = document.getElementById('surface-exit-text');
    if (surfaceExitText && uiTexts.surfaceExit) surfaceExitText.innerText = uiTexts.surfaceExit;

    const skyviewToggleText = document.getElementById('skyview-toggle-text');
    if (skyviewToggleText) {
        skyviewToggleText.innerText = isSkyViewActive ? (uiTexts.skyViewOn || "Sky View: Yoniq") : (uiTexts.skyViewBtn || "Sky View");
    }
    const skyviewBannerText = document.getElementById('skyview-banner-text');
    if (skyviewBannerText && uiTexts.skyViewBanner) skyviewBannerText.innerText = uiTexts.skyViewBanner;
    const skyviewExitText = document.getElementById('skyview-exit-text');
    if (skyviewExitText && uiTexts.skyViewExit) skyviewExitText.innerText = uiTexts.skyViewExit;

    const catalogBtnText = document.getElementById('catalog-btn-text');
    if (catalogBtnText) catalogBtnText.innerText = uiTexts.catalogBtn;

    const telemetryToggleLabel = document.querySelector('.telemetry-toggle-label');
    if (telemetryToggleLabel && uiTexts.telemetryBtn) telemetryToggleLabel.innerText = uiTexts.telemetryBtn;
    const telemetryBadgeText = document.querySelector('.telemetry-badge-text');
    if (telemetryBadgeText && uiTexts.telemetryBadge) telemetryBadgeText.innerText = uiTexts.telemetryBadge;

    const tourToggleText = document.getElementById('tour-toggle-text');
    if (tourToggleText && uiTexts.tourBtn) tourToggleText.innerText = uiTexts.tourBtn;

    const resumeDownloadText = document.getElementById('resume-download-text');
    if (resumeDownloadText && uiTexts.resumeBtn) resumeDownloadText.innerText = uiTexts.resumeBtn;

    const sunResumeBtnText = document.getElementById('sun-resume-btn-text');
    if (sunResumeBtnText && uiTexts.resumeSunBtn) sunResumeBtnText.innerText = uiTexts.resumeSunBtn;

    const gestureToggleText = document.getElementById('gesture-toggle-text');
    if (gestureToggleText) {
        gestureToggleText.innerText = (typeof isGestureActive !== 'undefined' && isGestureActive)
            ? (uiTexts.gestureOn || "Qo'l: Yoniq")
            : (uiTexts.gestureBtn || "Qo'l Boshqaruvi");
    }
    const gestureToggleBtn = document.getElementById('gesture-toggle-btn');
    if (gestureToggleBtn) {
        if (uiTexts.gestureTitle) gestureToggleBtn.title = uiTexts.gestureTitle;
        gestureToggleBtn.setAttribute('data-tooltip', uiTexts.gestureBtn || "Qo'l Boshqaruvi");
    }
    const audioToggleBtn = document.getElementById('audio-toggle-btn');
    if (audioToggleBtn) {
        audioToggleBtn.setAttribute('data-tooltip', isAudioMuted ? uiTexts.audioOff : uiTexts.audioOn);
    }
    const cinematicToggleBtn = document.getElementById('cinematic-toggle-btn');
    if (cinematicToggleBtn) {
        cinematicToggleBtn.setAttribute('data-tooltip', uiTexts.cinematicBtn || "Toza Fazo");
    }
    const guideToggleBtn = document.getElementById('guide-toggle-btn');
    if (guideToggleBtn) {
        guideToggleBtn.setAttribute('data-tooltip', uiTexts.guideBtn || "Ko'rsatma");
    }
    const gestureBadgeText = document.getElementById('gesture-badge-text');
    if (gestureBadgeText && uiTexts.gestures?.hudTitle) {
        gestureBadgeText.innerText = uiTexts.gestures.hudTitle;
    }
    const gestureQuickGuide = document.getElementById('gesture-quick-guide');
    if (gestureQuickGuide && uiTexts.gestures?.guide) {
        gestureQuickGuide.innerText = uiTexts.gestures.guide;
    }
    const gestureStateText = document.getElementById('gesture-state-text');
    if (gestureStateText && (typeof isGestureActive !== 'undefined' && isGestureActive)) {
        if (currentGesture === 'palm') gestureStateText.innerText = uiTexts.gestures?.palm || "Ochiq Kaft • Orbit";
        else if (currentGesture === 'pointing') gestureStateText.innerText = uiTexts.gestures?.pointing || "Ko'rsatish • Reticle";
        else if (currentGesture === 'pinch') gestureStateText.innerText = uiTexts.gestures?.pinch || "Chimchilash • Zoom / Tanlash";
        else if (currentGesture === 'fist') gestureStateText.innerText = uiTexts.gestures?.fist || "Musht • To'xtatish";
        else gestureStateText.innerText = uiTexts.gestures?.searching || "Qo'l qidirilmoqda...";
    }

    if (typeof isTourActive !== 'undefined' && isTourActive) {
        updateTourHud();
        updateTourControlsUI();
    }

    const backButtonEl = document.getElementById('back-button');
    if (backButtonEl) backButtonEl.innerText = uiTexts.returnToOrbit;

    // Control Hints & Preloader localized texts
    const controlHintsText = document.getElementById('control-hints-text');
    if (controlHintsText) controlHintsText.innerText = uiTexts.controlHints;

    const preloaderTitleEl = document.getElementById('preloader-title');
    if (preloaderTitleEl) preloaderTitleEl.innerText = uiTexts.preloaderTitle;

    const preloaderSubEl = document.getElementById('preloader-sub');
    if (preloaderSubEl) preloaderSubEl.innerText = uiTexts.preloaderSub;

    const preloaderStatusEl = document.getElementById('preloader-status');
    if (preloaderStatusEl) preloaderStatusEl.innerText = uiTexts.preloaderStatus;

    // 3. Bottom Navigation Labels
    const navMap = {
        'sun': uiTexts.nav.sun,
        'Mercury': uiTexts.nav.mercury,
        'Venus': uiTexts.nav.venus,
        'Earth': uiTexts.nav.earth,
        'moon': uiTexts.nav.moon,
        'Mars': uiTexts.nav.mars,
        'Jupiter': uiTexts.nav.jupiter,
        'Saturn': uiTexts.nav.saturn,
        'Uranus': uiTexts.nav.uranus,
        'Neptune': uiTexts.nav.neptune,
        'Pluto': uiTexts.nav.pluto,
        'star': uiTexts.nav.stars,
        'Voyager': uiTexts.nav.voyager || 'Voyager',
        'BlackHole': uiTexts.nav.blackHole || "Qora O'ra"
    };

    document.querySelectorAll('#nav-container .nav-btn').forEach(btn => {
        const target = btn.getAttribute('data-target');
        const labelEl = btn.querySelector('.label');
        if (labelEl && navMap[target]) {
            labelEl.innerText = navMap[target];
        }
    });

    // 4. Catalog Modal Headings & Search Bar
    const catalogBadgeEl = document.querySelector('#catalog-modal .badge-tag');
    if (catalogBadgeEl) catalogBadgeEl.innerText = uiTexts.catalogBadge;

    const catalogHeadingEl = document.querySelector('.catalog-heading');
    if (catalogHeadingEl) catalogHeadingEl.innerText = uiTexts.catalogHeading;

    const catalogDescEl = document.querySelector('.catalog-desc');
    if (catalogDescEl) catalogDescEl.innerText = uiTexts.catalogDesc;

    const stellarBadgeEl = document.querySelector('.stellar-badge');
    if (stellarBadgeEl) stellarBadgeEl.innerText = uiTexts.stellarBadge;

    const stellarSubheadingEl = document.querySelector('.catalog-subheading');
    if (stellarSubheadingEl) stellarSubheadingEl.innerText = uiTexts.stellarHeading;

    const stellarSubdescEl = document.querySelector('.catalog-subdesc');
    if (stellarSubdescEl) stellarSubdescEl.innerText = uiTexts.stellarDesc;

    if (catalogSearchInput) {
        catalogSearchInput.placeholder = uiTexts.catalogSearchPlaceholder;
    }

    const catLabels = {
        'all': uiTexts.catAll,
        'ai': uiTexts.catAi,
        'security': uiTexts.catSecurity,
        'web': uiTexts.catWeb,
        'systems': uiTexts.catSystems
    };
    document.querySelectorAll('.cat-filter-btn').forEach(btn => {
        const cat = btn.getAttribute('data-category');
        const label = btn.querySelector('.cat-label');
        if (label && catLabels[cat]) {
            label.innerText = catLabels[cat];
        }
    });

    const emptyTitleEl = document.getElementById('catalog-empty-title');
    if (emptyTitleEl) emptyTitleEl.innerText = uiTexts.catalogEmptyTitle;

    const emptyDescEl = document.getElementById('catalog-empty-desc');
    if (emptyDescEl) emptyDescEl.innerText = uiTexts.catalogEmptyDesc;

    // 5. Update All Catalog Cards (Planets + Sun)
    document.querySelectorAll('.catalog-card').forEach(card => {
        const targetId = card.getAttribute('data-target');
        const cData = translations.celestial[targetId]?.[lang];
        if (cData) {
            const h3 = card.querySelector('.card-header h3');
            if (h3) h3.innerText = cData.title;
            const type = card.querySelector('.card-type');
            if (type) type.innerText = cData.subtitle;
            const p = card.querySelector('p');
            if (p) {
                const firstLine = cData.content.split('\n')[0];
                p.innerText = firstLine.length > 25 ? firstLine : cData.content.replace(/\n+/g, ' ').slice(0, 160) + '...';
            }
            const link = card.querySelector('.card-link');
            if (link) link.innerText = `${cData.githubText || 'GitHub Repo'} →`;
        }
    });

    // 6. Update All Catalog Star Cards (18 Stars)
    document.querySelectorAll('.catalog-star-card').forEach(card => {
        const targetId = card.getAttribute('data-target');
        const sData = translations.stars[targetId]?.[lang];
        if (sData) {
            const h3 = card.querySelector('.card-header h3');
            if (h3) h3.innerText = sData.title;
            const type = card.querySelector('.card-type');
            if (type) type.innerText = sData.subtitle;
            const p = card.querySelector('p');
            if (p) {
                const firstLine = sData.content.split('\n')[0];
                p.innerText = firstLine.length > 25 ? firstLine : sData.content.replace(/\n+/g, ' ').slice(0, 160) + '...';
            }
            const link = card.querySelector('.card-link');
            if (link) link.innerText = `${sData.actionText || sData.githubText || 'Batafsil'} →`;
        }
    });

    // 7. Update 3D interactableObjects userData
    interactableObjects.forEach(obj => {
        if (!obj.userData) return;
        let transData = null;
        if (obj.userData.isSun) {
            transData = translations.celestial.sun?.[lang];
        } else if (obj.userData.isMoon) {
            transData = translations.celestial.moon?.[lang];
        } else if ((obj.userData.isPlanet || obj.userData.isProbe || obj.userData.isComet || obj.userData.isBlackHole) && translations.celestial[obj.userData.id]) {
            transData = translations.celestial[obj.userData.id]?.[lang];
        } else if (obj.userData.isStar && translations.stars[obj.userData.id]) {
            transData = translations.stars[obj.userData.id]?.[lang];
        }

        if (transData) {
            obj.userData.badge = transData.badge || obj.userData.badge;
            obj.userData.title = transData.title || obj.userData.title;
            obj.userData.subtitle = transData.subtitle || obj.userData.subtitle;
            obj.userData.content = transData.content || obj.userData.content;
            if (transData.tags) obj.userData.tags = transData.tags;
            if (transData.actionText) obj.userData.actionText = transData.actionText;
            if (transData.githubText) obj.userData.githubText = transData.githubText;
        }
    });

    // 8. If Moon or another object is currently focused and infoPanel is visible, refresh it
    if (currentTarget && !infoPanel.classList.contains('hidden')) {
        showInfo(currentTarget.userData);
    } else {
        // Re-render Moon Terminal if open
        const moonTermContainer = document.getElementById('moon-terminal-container');
        if (moonTermContainer && !moonTermContainer.classList.contains('hidden') && moonTermContainer.style.display !== 'none') {
            renderMoonTerminal();
        }
    }

    // 9. Update Guide Modal and Guide Button Texts
    const guideToggleText = document.getElementById('guide-toggle-text');
    if (guideToggleText) guideToggleText.innerText = uiTexts.guideBtn || "Ko'rsatma";

    if (uiTexts.guide) {
        const guideBadgeEl = document.getElementById('guide-badge');
        if (guideBadgeEl) guideBadgeEl.innerText = uiTexts.guide.badge;

        const guideHeadingEl = document.getElementById('guide-heading');
        if (guideHeadingEl) guideHeadingEl.innerText = uiTexts.guide.heading;

        const guideDescEl = document.getElementById('guide-desc');
        if (guideDescEl) guideDescEl.innerText = uiTexts.guide.desc;

        const step1Title = document.getElementById('guide-step1-title');
        if (step1Title) step1Title.innerText = uiTexts.guide.step1Title;
        const step1Desc = document.getElementById('guide-step1-desc');
        if (step1Desc) step1Desc.innerText = uiTexts.guide.step1Desc;

        const step2Title = document.getElementById('guide-step2-title');
        if (step2Title) step2Title.innerText = uiTexts.guide.step2Title;
        const step2Desc = document.getElementById('guide-step2-desc');
        if (step2Desc) step2Desc.innerText = uiTexts.guide.step2Desc;

        const step3Title = document.getElementById('guide-step3-title');
        if (step3Title) step3Title.innerText = uiTexts.guide.step3Title;
        const step3Desc = document.getElementById('guide-step3-desc');
        if (step3Desc) step3Desc.innerText = uiTexts.guide.step3Desc;

        const step4Title = document.getElementById('guide-step4-title');
        if (step4Title) step4Title.innerText = uiTexts.guide.step4Title;
        const step4Desc = document.getElementById('guide-step4-desc');
        if (step4Desc) step4Desc.innerText = uiTexts.guide.step4Desc;

        const dontShowText = document.getElementById('guide-dont-show-text');
        if (dontShowText) dontShowText.innerText = uiTexts.guide.dontShow;

        const startText = document.getElementById('guide-start-text');
        if (startText) startText.innerText = uiTexts.guide.startBtn;
    }

    // 10. Update Constellations Labels
    if (typeof constellationsGroup !== 'undefined' && constellationsGroup) {
        constellationsGroup.children.forEach(child => {
            if (child.isSprite && child.userData?.constellationNameKey) {
                const cKey = child.userData.constellationNameKey;
                const locName = uiTexts.constellations?.[cKey] || child.userData.constellationNameKey.toUpperCase();
                updateLabelSprite(child, locName, '✦', '#38bdf8');
            }
        });
    }

    // 11. Update Sun and Planets Scale Comparison Labels
    if (typeof sun !== 'undefined' && sun && sun.userData && sun.userData.scaleLabel) {
        const sunName = uiTexts.scaleSun || uiTexts.nav?.sun || 'Quyosh';
        updateScaleLabelSprite(sun.userData.scaleLabel, sunName, '1,392,700 km', '#ffaa00');
    }
    if (typeof planets !== 'undefined' && planets) {
        planets.forEach(p => {
            if (p.mesh && p.mesh.userData && p.mesh.userData.scaleLabel && p.mesh.userData.isPlanet) {
                const pId = p.mesh.userData.id;
                const pData = planetsData.find(d => d.id === pId);
                const locName = uiTexts.nav?.[pId.toLowerCase()] || uiTexts.nav?.[pId] || p.mesh.userData.name || pId;
                const colHex = '#' + (pData && pData.color ? pData.color.toString(16).padStart(6, '0') : '38bdf8');
                updateScaleLabelSprite(p.mesh.userData.scaleLabel, locName, pData?.diameterKm || '12,000 km', colHex);
            }
        });
    }
}

// Language switch buttons click listener
document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        playUiClick();
        const selectedLang = btn.getAttribute('data-lang');
        if (selectedLang) {
            setLanguage(selectedLang);
        }
    });
});

// Overview Camera Reset Button (Persistent)
const overviewBtn = document.getElementById('overview-btn');
if (overviewBtn) {
    overviewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playUiClick();
        resetView();
    });
}

// ==========================================
// ONBOARDING GUIDE MODAL CONTROLLER
// ==========================================
const guideModalContainer = document.getElementById('guide-modal-container');
const guideToggleBtn = document.getElementById('guide-toggle-btn');
const guideCloseBtn = document.getElementById('guide-close-btn');
const guideStartBtn = document.getElementById('guide-start-btn');
const guideDontShowCheckbox = document.getElementById('guide-dont-show-checkbox');

function showGuide() {
    window.__guideInteracted = true;
    if (typeof isTourActive !== 'undefined' && isTourActive && !isTourPaused) {
        toggleTourPlayPause();
    }
    if (guideModalContainer) {
        guideModalContainer.classList.remove('hidden');
        guideModalContainer.style.display = 'flex';
    }
}

function hideGuide() {
    window.__guideInteracted = true;
    if (guideModalContainer) {
        guideModalContainer.classList.add('hidden');
        guideModalContainer.style.display = 'none';
        if (guideDontShowCheckbox && guideDontShowCheckbox.checked) {
            localStorage.setItem('solar_guide_dismissed', 'true');
        }
    }
}

if (guideToggleBtn) {
    guideToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playUiClick();
        showGuide();
    });
}

if (guideCloseBtn) {
    guideCloseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playUiClick();
        hideGuide();
    });
}

if (guideStartBtn) {
    guideStartBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playUiClick();
        hideGuide();
    });
}

if (guideModalContainer) {
    guideModalContainer.addEventListener('click', (e) => {
        if (e.target === guideModalContainer) {
            playUiClick();
            hideGuide();
        }
    });
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && guideModalContainer && !guideModalContainer.classList.contains('hidden')) {
        hideGuide();
    }
});

// Audio Synthesizer ON/OFF Toggle
const audioToggleBtn = document.getElementById('audio-toggle-btn');
if (audioToggleBtn) {
    audioToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleAudio();
    });
}

// Orbit Pause/Resume Toggle
const orbitToggleBtn = document.getElementById('orbit-toggle-btn');
const orbitToggleIcon = document.getElementById('orbit-toggle-icon');
const orbitToggleText = document.getElementById('orbit-toggle-text');

if (orbitToggleBtn) {
    orbitToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playUiClick();
        isOrbitPaused = !isOrbitPaused;
        const uiTexts = translations.ui[currentLang] || translations.ui.uz;
        if (isOrbitPaused) {
            if (orbitToggleIcon) orbitToggleIcon.innerHTML = '<svg class="btn-svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>';
            if (orbitToggleText) orbitToggleText.innerText = uiTexts.orbitPaused;
            orbitToggleBtn.classList.add('paused-state');
        } else {
            if (orbitToggleIcon) orbitToggleIcon.innerHTML = '<svg class="btn-svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><rect x="6" y="4" width="3.5" height="16" rx="1"/><rect x="14.5" y="4" width="3.5" height="16" rx="1"/></svg>';
            if (orbitToggleText) orbitToggleText.innerText = uiTexts.orbitActive;
            orbitToggleBtn.classList.remove('paused-state');
        }
    });
}

// ==============================================================================
// 5-YO'NALISH: INTERAKTIV KOINOT ASBOBLARI (HUD CONTROLS & CINEMATIC MODE)
// ==============================================================================
let orbitSpeedMultiplier = 1;
const warpSpeedBtn = document.getElementById('warp-speed-btn');
const warpSpeedText = document.getElementById('warp-speed-text');

function setOrbitSpeed(multiplier) {
    orbitSpeedMultiplier = multiplier;
    if (warpSpeedBtn) {
        warpSpeedBtn.classList.remove('speed-5x', 'speed-20x');
        if (multiplier === 5) warpSpeedBtn.classList.add('speed-5x');
        else if (multiplier === 20) warpSpeedBtn.classList.add('speed-20x');
    }
    const uiTexts = translations.ui[currentLang] || translations.ui.uz;
    if (warpSpeedText) {
        if (multiplier === 5) warpSpeedText.innerText = uiTexts.warpSpeed5x || "Vaqt: 5x";
        else if (multiplier === 20) warpSpeedText.innerText = uiTexts.warpSpeed20x || "Vaqt: 20x";
        else warpSpeedText.innerText = uiTexts.warpSpeed1x || "Vaqt: 1x";
    }
}

if (warpSpeedBtn) {
    warpSpeedBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playUiClick();
        if (orbitSpeedMultiplier === 1) setOrbitSpeed(5);
        else if (orbitSpeedMultiplier === 5) setOrbitSpeed(20);
        else setOrbitSpeed(1);
    });
}

// Orbit Lines Toggle (Show/Hide all orbit trajectories)
const orbitsToggleBtn = document.getElementById('orbits-toggle-btn');
const orbitsToggleText = document.getElementById('orbits-toggle-text');

function toggleOrbits() {
    if (typeof orbitLinesGroup === 'undefined' || !orbitLinesGroup) return;
    orbitLinesGroup.visible = !orbitLinesGroup.visible;
    const uiTexts = translations.ui[currentLang] || translations.ui.uz;
    if (orbitsToggleBtn) {
        if (orbitLinesGroup.visible) {
            orbitsToggleBtn.classList.remove('orbits-hidden');
            if (orbitsToggleText) orbitsToggleText.innerText = uiTexts.orbitsActive || "Orbitalar: Yoniq";
        } else {
            orbitsToggleBtn.classList.add('orbits-hidden');
            if (orbitsToggleText) orbitsToggleText.innerText = uiTexts.orbitsHidden || "Orbitalar: O'chiq";
        }
    }
}

if (orbitsToggleBtn) {
    orbitsToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playUiClick();
        toggleOrbits();
    });
}

// Telemetry Island Expand/Collapse Toggle
const telemetryIslandToggleBtn = document.getElementById('telemetry-island-toggle');
const cosmicTelemetryIsland = document.getElementById('cosmic-telemetry-island');
if (telemetryIslandToggleBtn && cosmicTelemetryIsland) {
    telemetryIslandToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playUiClick();
        const isCollapsed = cosmicTelemetryIsland.classList.toggle('island-collapsed');
        telemetryIslandToggleBtn.setAttribute('aria-expanded', !isCollapsed);
    });
}

// Pure Space / Cinematic Mode (Hide all UI overlays for pure cosmic view)
let isCinematicActive = false;
const cinematicToggleBtn = document.getElementById('cinematic-toggle-btn');
const cinematicExitBanner = document.getElementById('cinematic-exit-banner');
const cinematicExitBtn = document.getElementById('cinematic-exit-btn');

function toggleCinematic(enable = null) {
    if (enable !== null) isCinematicActive = enable;
    else isCinematicActive = !isCinematicActive;

    if (isCinematicActive) {
        document.body.classList.add('cinematic-active');
        if (cinematicExitBanner) {
            cinematicExitBanner.classList.remove('hidden');
            cinematicExitBanner.style.display = 'block';
        }
    } else {
        document.body.classList.remove('cinematic-active');
        if (cinematicExitBanner) {
            cinematicExitBanner.classList.add('hidden');
            setTimeout(() => {
                if (!isCinematicActive && cinematicExitBanner) cinematicExitBanner.style.display = 'none';
            }, 350);
        }
    }
}

if (cinematicToggleBtn) {
    cinematicToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playUiClick();
        toggleCinematic();
    });
}

if (cinematicExitBtn) {
    cinematicExitBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playUiClick();
        toggleCinematic(false);
    });
}

// Global Keyboard Shortcuts: 'H' for Cinematic Mode, 'O' for Orbit Lines, 'Escape' to exit Cinematic
window.addEventListener('keydown', (e) => {
    // If typing in an input (e.g. search bar or contact terminal), ignore shortcuts
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    
    if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        toggleCinematic();
    } else if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        toggleOrbits();
    } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        toggleConstellations();
    } else if (e.key === 'Escape' && isCinematicActive) {
        e.preventDefault();
        e.stopImmediatePropagation();
        toggleCinematic(false);
    }
});

// ==========================================
// CINEMATIC AUTOPILOT TOUR MODE (SUN + 9 PLANETS + MOON)
// ==========================================
const tourStops = [
    { id: 'sun' },
    { id: 'Mercury' },
    { id: 'Venus' },
    { id: 'Earth' },
    { id: 'moon' },
    { id: 'Mars' },
    { id: 'Jupiter' },
    { id: 'Saturn' },
    { id: 'Uranus' },
    { id: 'Neptune' },
    { id: 'Pluto' }
];

let isTourActive = false;
let tourIndex = 0;
let isTourPaused = false;
let tourTimer = null;
let tourProgressInterval = null;
const TOUR_STEP_DURATION_MS = 9000;
let tourStepStart = 0;
let tourElapsed = 0;

const tourHud = document.getElementById('tour-hud');
const tourBadgeText = document.getElementById('tour-badge-text');
const tourCounterText = document.getElementById('tour-counter-text');
const tourExitBtn = document.getElementById('tour-exit-btn');
const tourStopIcon = document.getElementById('tour-stop-icon');
const tourTitleText = document.getElementById('tour-title-text');
const tourRoleText = document.getElementById('tour-role-text');
const tourProgressFill = document.getElementById('tour-progress-fill');
const tourPrevBtn = document.getElementById('tour-prev-btn');
const tourPlayBtn = document.getElementById('tour-play-btn');
const tourNextBtn = document.getElementById('tour-next-btn');
const tourDetailBtn = document.getElementById('tour-detail-btn');
const tourPlayIcon = document.getElementById('tour-play-icon');
const tourPlayLabel = document.getElementById('tour-play-label');
const tourPrevLabel = document.getElementById('tour-prev-label');
const tourNextLabel = document.getElementById('tour-next-label');
const tourDetailLabel = document.getElementById('tour-detail-label');
const tourToggleBtn = document.getElementById('tour-toggle-btn');

function clearTourTimers() {
    if (tourTimer) {
        clearTimeout(tourTimer);
        tourTimer = null;
    }
    if (tourProgressInterval) {
        clearInterval(tourProgressInterval);
        tourProgressInterval = null;
    }
}

function startTour(fromIndex = 0) {
    playUiClick();
    isTourActive = true;
    isTourPaused = false;
    tourIndex = fromIndex;
    tourElapsed = 0;

    // Close any open modals: info panel, catalog, onboarding modal, and hints
    hideInfo();
    closeCatalog();
    const guideModal = document.getElementById('guide-modal-container');
    if (guideModal) {
        guideModal.classList.add('hidden');
        guideModal.style.display = 'none';
    }
    if (typeof dismissControlHints === 'function') {
        dismissControlHints();
    }

    if (tourToggleBtn) tourToggleBtn.classList.add('active');
    if (tourHud) {
        tourHud.classList.remove('hidden');
        tourHud.style.display = 'block';
    }

    goToTourStop(tourIndex);
}

function exitTour(shouldReset = true) {
    if (!isTourActive) return;
    playUiClick();
    isTourActive = false;
    isTourPaused = false;
    clearTourTimers();

    if (tourToggleBtn) tourToggleBtn.classList.remove('active');
    if (tourHud) {
        tourHud.classList.add('hidden');
        tourHud.style.display = 'none';
    }

    if (shouldReset) {
        resetView();
    }
}

function toggleTourPlayPause() {
    playUiClick();
    if (!isTourActive) {
        startTour();
        return;
    }
    isTourPaused = !isTourPaused;
    updateTourControlsUI();
    if (isTourPaused) {
        clearTourTimers();
    } else {
        hideInfo();
        startTourCountdown();
    }
}

function startTourCountdown() {
    clearTourTimers();
    if (isTourPaused) return;

    tourStepStart = Date.now() - tourElapsed;
    const totalDuration = TOUR_STEP_DURATION_MS;

    tourProgressInterval = setInterval(() => {
        if (isTourPaused) return;
        const now = Date.now();
        tourElapsed = now - tourStepStart;
        const pct = Math.min(100, Math.max(0, (tourElapsed / totalDuration) * 100));
        if (tourProgressFill) tourProgressFill.style.width = `${pct}%`;
        if (tourElapsed >= totalDuration) {
            clearTourTimers();
            nextTourStop();
        }
    }, 50);
}

function goToTourStop(index) {
    if (!isTourActive) return;
    tourIndex = (index + tourStops.length) % tourStops.length;
    tourElapsed = 0;
    if (tourProgressFill) tourProgressFill.style.width = '0%';

    hideInfo();

    const stop = tourStops[tourIndex];
    let targetObj = null;
    if (stop.id === 'sun') {
        targetObj = sun;
    } else if (stop.id === 'moon') {
        targetObj = interactableObjects.find(o => o.userData && o.userData.isMoon);
    } else {
        targetObj = interactableObjects.find(o => o.userData && o.userData.id === stop.id);
    }

    if (targetObj) {
        focusOnObject(targetObj, true);
    }

    updateTourHud();
    updateTourControlsUI();

    if (!isTourPaused) {
        startTourCountdown();
    }
}

function nextTourStop() {
    playUiClick();
    goToTourStop(tourIndex + 1);
}

function prevTourStop() {
    playUiClick();
    goToTourStop(tourIndex - 1);
}

function updateTourHud() {
    if (!isTourActive) return;
    const stop = tourStops[tourIndex];
    const uiTexts = translations.ui[currentLang] || translations.ui.uz;
    const tourUi = uiTexts.tour || translations.ui.uz.tour;
    const stopTrans = tourUi.stops?.[stop.id.toLowerCase()] || {};

    if (tourBadgeText) tourBadgeText.innerText = tourUi.badge || "KINEMATIK AVTO-SAYOHAT";
    if (tourCounterText) tourCounterText.innerText = `${String(tourIndex + 1).padStart(2, '0')} / ${String(tourStops.length).padStart(2, '0')}`;
    if (tourStopIcon) tourStopIcon.innerHTML = `<span class="planet-orb orb-${stop.id.toLowerCase()}"></span>`;

    let cData = null;
    if (stop.id === 'sun') cData = translations.celestial.sun?.[currentLang];
    else if (stop.id === 'moon') cData = translations.celestial.moon?.[currentLang];
    else cData = translations.celestial[stop.id]?.[currentLang];

    const planetName = stopTrans.name || stop.id;
    const projTitle = cData?.title ? cData.title.split('•')[0].trim() : (stopTrans.role || '');
    
    if (tourTitleText) tourTitleText.innerText = `${planetName} • ${projTitle}`;
    if (tourRoleText) tourRoleText.innerText = stopTrans.role || cData?.subtitle || '';

    if (tourPrevLabel) tourPrevLabel.innerText = tourUi.prev || "Oldingi";
    if (tourNextLabel) tourNextLabel.innerText = tourUi.next || "Keyingi";
    if (tourDetailLabel) tourDetailLabel.innerText = tourUi.details || "Batafsil";
}

function updateTourControlsUI() {
    const uiTexts = translations.ui[currentLang] || translations.ui.uz;
    const tourUi = uiTexts.tour || translations.ui.uz.tour;
    if (tourPlayIcon) {
        tourPlayIcon.innerHTML = isTourPaused 
            ? '<svg class="btn-svg" viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>'
            : '<svg class="btn-svg" viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><rect x="6" y="4" width="3.5" height="16" rx="1"/><rect x="14.5" y="4" width="3.5" height="16" rx="1"/></svg>';
    }
    if (tourPlayLabel) tourPlayLabel.innerText = isTourPaused ? (tourUi.play || "Davom ettirish") : (tourUi.pause || "To'xtatish");
}

if (tourToggleBtn) {
    tourToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isTourActive) {
            exitTour();
        } else {
            startTour();
        }
    });
}

if (tourExitBtn) {
    tourExitBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        exitTour();
    });
}

if (tourPlayBtn) {
    tourPlayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleTourPlayPause();
    });
}

if (tourPrevBtn) {
    tourPrevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        prevTourStop();
    });
}

if (tourNextBtn) {
    tourNextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        nextTourStop();
    });
}

if (tourDetailBtn) {
    tourDetailBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playUiClick();
        isTourPaused = true;
        clearTourTimers();
        updateTourControlsUI();
        const stop = tourStops[tourIndex];
        let targetObj = null;
        if (stop.id === 'sun') targetObj = sun;
        else if (stop.id === 'moon') targetObj = interactableObjects.find(o => o.userData && o.userData.isMoon);
        else targetObj = interactableObjects.find(o => o.userData && o.userData.id === stop.id);
        if (targetObj) showInfo(targetObj.userData);
    });
}

// All Projects Catalog Modal Controls
const catalogContainer = document.getElementById('catalog-container');
const catalogBtn = document.getElementById('catalog-btn');
const catalogModal = document.getElementById('catalog-modal');
const catalogClose = document.getElementById('catalog-close');

function openCatalog() {
    if (!catalogModal) return;
    playUiClick();
    if (typeof isTourActive !== 'undefined' && isTourActive && !isTourPaused) {
        toggleTourPlayPause();
    }
    catalogModal.classList.remove('hidden');
    if (catalogContainer) catalogContainer.style.pointerEvents = 'auto';
    applyCatalogFilters();
}

function closeCatalog() {
    if (!catalogModal || catalogModal.classList.contains('hidden')) return;
    playUiClick();
    catalogModal.classList.add('hidden');
    if (catalogContainer) catalogContainer.style.pointerEvents = 'none';
}

if (catalogBtn && catalogModal) {
    catalogBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openCatalog();
    });
}

if (catalogClose && catalogModal) {
    catalogClose.addEventListener('click', (e) => {
        e.stopPropagation();
        closeCatalog();
    });
}

if (catalogContainer) {
    catalogContainer.addEventListener('click', (e) => {
        if (e.target === catalogContainer) {
            closeCatalog();
        }
    });
}

// Attach hover and click sounds to all interactive elements
document.querySelectorAll('.nav-btn, .header-link, .lang-btn, .close-btn, #back-button, .cat-filter-btn').forEach(el => {
    el.addEventListener('mouseenter', () => playUiHover());
});

// Click on any card in the catalog modal to focus on that celestial body
document.querySelectorAll('.catalog-card, .catalog-star-card').forEach(card => {
    card.addEventListener('mouseenter', () => playUiHover());
    card.addEventListener('click', (e) => {
        if (e.target.closest('a')) return;
        playUiClick();
        const targetId = card.getAttribute('data-target');
        if (!targetId) return;
        
        let found = null;
        if (targetId === 'sun') {
            found = sun;
        } else if (targetId === 'moon') {
            found = interactableObjects.find(obj => obj.userData && obj.userData.isMoon);
        } else {
            found = interactableObjects.find(obj => obj.userData && obj.userData.id === targetId);
        }
        
        if (found) {
            closeCatalog();
            focusOnObject(found);
        }
    });
});

// Navigation HUD Listeners
let starCycleIdx = 0;
document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetId = btn.getAttribute('data-target');
        
        let found = null;
        if (targetId === 'sun') {
            found = sun;
        } else if (targetId === 'moon') {
            found = interactableObjects.find(obj => obj.userData && obj.userData.isMoon);
        } else if (targetId === 'star') {
            const allStars = interactableObjects.filter(obj => obj.userData && obj.userData.isStar);
            if (allStars.length > 0) {
                found = allStars[starCycleIdx % allStars.length];
                starCycleIdx++;
            }
        } else {
            found = interactableObjects.find(obj => obj.userData && obj.userData.id === targetId);
        }
        
        if (found) {
            focusOnObject(found);
            updateNavActiveState(btn);
        }
    });
});

function updateNavActiveState(activeBtn) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active-state'));
    if (activeBtn) {
        activeBtn.classList.add('active-state');
        activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
}

if (modalClose) {
    modalClose.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof isTourActive !== 'undefined' && isTourActive) {
            hideInfo();
        } else {
            resetView();
        }
    });
}

if (backBtn) {
    backBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetView();
    });
}

// Touch & Click Raycasting
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let pointerStartX = 0;
let pointerStartY = 0;
let pointerStartTime = 0;

window.addEventListener('pointerdown', (e) => {
    pointerStartX = e.clientX;
    pointerStartY = e.clientY;
    pointerStartTime = performance.now();
});

window.addEventListener('pointerup', (e) => {
    if (isAnimating) return;
    
    if (e.target.closest('#nav-container') || e.target.closest('#info-panel') || e.target.closest('#brand-header') || e.target.closest('#catalog-modal') || e.target.closest('#tour-hud') || e.target.closest('#guide-modal-container')) {
        return;
    }
    
    const dx = e.clientX - pointerStartX;
    const dy = e.clientY - pointerStartY;
    const dt = performance.now() - pointerStartTime;
    
    if (Math.hypot(dx, dy) > 10 || dt > 350) return;
    
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(interactableObjects, true);
    
    if (intersects.length > 0) {
        let hitObj = null;
        for (let i = 0; i < intersects.length; i++) {
            let candidate = intersects[i].object;
            // Climb up until we find an interactable object that has valid celestial data
            while (candidate && (!candidate.userData || !candidate.userData.title) && candidate.parent && candidate.parent !== scene) {
                candidate = candidate.parent;
            }
            if (candidate && candidate.userData && candidate.userData.title) {
                hitObj = candidate;
                break;
            }
        }
        if (hitObj) {
            focusOnObject(hitObj);
        }
    }
});

// Keyboard controls
window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === 'Escape') {
        if (typeof currentSurfaceMode !== 'undefined' && currentSurfaceMode) {
            setSurfaceView(null);
            return;
        }
        if (typeof isSkyViewActive !== 'undefined' && isSkyViewActive) {
            toggleSkyView(false);
            return;
        }
        if (typeof isScaleModeActive !== 'undefined' && isScaleModeActive) {
            toggleScaleComparison(false);
            return;
        }
        if (infoPanel && !infoPanel.classList.contains('hidden')) {
            hideInfo();
            if (typeof isTourActive === 'undefined' || !isTourActive) {
                resetView();
            }
        } else if (catalogModal && !catalogModal.classList.contains('hidden')) {
            closeCatalog();
        } else if (guideModalContainer && !guideModalContainer.classList.contains('hidden')) {
            hideGuide();
        } else if (typeof isTourActive !== 'undefined' && isTourActive) {
            exitTour();
        } else {
            resetView();
        }
    } else if (typeof isTourActive !== 'undefined' && isTourActive) {
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            nextTourStop();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            prevTourStop();
        } else if (e.key === ' ' || e.code === 'Space') {
            e.preventDefault();
            toggleTourPlayPause();
        }
    }
});

function focusOnObject(object, isTourCall = false) {
    if (!object || !object.userData || !object.userData.title) return;
    if (typeof currentSurfaceMode !== 'undefined' && currentSurfaceMode) setSurfaceView(null);
    if (typeof isSkyViewActive !== 'undefined' && isSkyViewActive) toggleSkyView(false);
    if (typeof isScaleModeActive !== 'undefined' && isScaleModeActive) toggleScaleComparison(false);
    if (!isTourCall && isTourActive) {
        exitTour(false);
    }
    if (!isTourCall && currentTarget === object) return;
    currentTarget = object;
    
    // Hide previous object modal while camera transitions to the new target
    hideInfo();

    // Hide label on focused object so it doesn't obstruct close-up view
    interactableObjects.forEach(obj => {
        obj.children.forEach(c => {
            if (c.isSprite) c.visible = (obj !== object);
        });
        if (obj.userData && obj.userData.starGroup) {
            const lbl = obj.userData.starGroup.children[2];
            if (lbl && lbl.isSprite) lbl.visible = (obj !== object);
        }
    });
    
    const targetWorldPos = new THREE.Vector3();
    object.getWorldPosition(targetWorldPos);
    
    const rad = Number(object.userData.radius) || 1.0;
    let camOffsetDist = 12;
    if (object.userData.isSun) {
        camOffsetDist = 24;
    } else if (object.userData.isPlanet) {
        const ringExtent = Number(object.userData.ringOuter) || 0;
        camOffsetDist = Math.max(rad * 4.6, ringExtent * 2.2);
    } else if (object.userData.isMoon) {
        camOffsetDist = Math.max(rad * 10.0, 5.0);
    } else if (object.userData.isStar) {
        camOffsetDist = 18.0;
    } else if (object.userData.isProbe) {
        camOffsetDist = 8.0;
    } else if (object.userData.isComet) {
        camOffsetDist = 14.0;
    } else if (object.userData.isBlackHole) {
        camOffsetDist = 28.0;
    }
    
    const dir = targetWorldPos.clone().normalize();
    if (dir.lengthSq() === 0) dir.set(0, 0, 1);
    
    const isMobile = window.innerWidth < 768;
    let finalCamPos;
    let finalTargetPos = targetWorldPos.clone();
    
    if (object.userData.isSun) {
        finalCamPos = targetWorldPos.clone().add(new THREE.Vector3(0, 4, 22));
    } else {
        // Tangent and inward vectors to view the gloriously sunlit hemisphere
        const inward = dir.clone().negate();
        const tangent = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
        // 3/4 sunlit gibbous phase framing against deep space starfield
        const camDir = inward.clone().multiplyScalar(0.42).add(tangent.clone().multiplyScalar(0.88)).normalize();
        finalCamPos = targetWorldPos.clone().add(camDir.multiplyScalar(camOffsetDist));
        finalCamPos.y += Math.max(rad * 1.6, 2.4);
    }

    // On desktop, frame the 3D planet cleanly in open space alongside the info panel; on mobile, lift framing above bottom sheet
    if (!isMobile) {
        const tangent = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
        const sideOffset = camOffsetDist * 0.28;
        finalCamPos.add(tangent.clone().multiplyScalar(sideOffset));
        finalTargetPos.add(tangent.clone().multiplyScalar(sideOffset));
    } else {
        const verticalLift = object.userData.isSun ? 4.2 : Math.max(rad * 1.8, 2.5);
        finalTargetPos.y -= verticalLift * 0.45;
        finalCamPos.y += verticalLift * 0.45;
    }

    // Highlight corresponding button in HUD
    const btn = document.querySelector(`.nav-btn[data-target="${object.userData.id}"]`) ||
                (object.userData.isSun ? document.querySelector('.nav-btn[data-target="sun"]') : null) ||
                (object.userData.isMoon ? document.querySelector('.nav-btn[data-target="moon"]') : null) ||
                (object.userData.isStar ? document.querySelector('.nav-btn[data-target="star"]') : null) ||
                (object.userData.isProbe ? document.querySelector('.nav-btn[data-target="Voyager"]') : null) ||
                (object.userData.isBlackHole ? document.querySelector('.nav-btn[data-target="BlackHole"]') : null);
    if (btn) updateNavActiveState(btn);

    animateCamera(finalCamPos, finalTargetPos, object.userData);
}

function resetView() {
    if (typeof currentSurfaceMode !== 'undefined' && currentSurfaceMode) setSurfaceView(null);
    if (typeof isSkyViewActive !== 'undefined' && isSkyViewActive) toggleSkyView(false);
    if (typeof isScaleModeActive !== 'undefined' && isScaleModeActive) toggleScaleComparison(false);
    if (isTourActive) {
        isTourActive = false;
        isTourPaused = false;
        clearTourTimers();
        if (tourToggleBtn) tourToggleBtn.classList.remove('active');
        if (tourHud) {
            tourHud.classList.add('hidden');
            tourHud.style.display = 'none';
        }
    }
    hideInfo();
    closeCatalog();
    currentTarget = null;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active-state'));
    
    // Restore all labels
    interactableObjects.forEach(obj => {
        obj.children.forEach(c => {
            if (c.isSprite) c.visible = true;
        });
        if (obj.userData && obj.userData.starGroup) {
            const lbl = obj.userData.starGroup.children[2];
            if (lbl && lbl.isSprite) lbl.visible = true;
        }
    });
    
    const isMobile = window.innerWidth < 768;
    // Complete Solar System overview: ALL 9 PLANETS fully visible in view frustum
    const finalCamPos = isMobile ? new THREE.Vector3(0, 225, 235) : new THREE.Vector3(0, 165, 195);
    const targetWorldPos = new THREE.Vector3(0, 0, 0);
    
    animateCamera(finalCamPos, targetWorldPos, null);
}

let activeCameraTween = null;
function animateCamera(finalCamPos, targetWorldPos, data) {
    if (activeCameraTween) {
        activeCameraTween.kill();
        activeCameraTween = null;
    }
    isAnimating = true;
    const startCam = camera.position.clone();
    const startTarget = controls.target.clone();
    
    // Elevated midpoint arc to avoid collision
    const midCam = startCam.clone().add(finalCamPos).multiplyScalar(0.5);
    midCam.y += Math.max(25, (startCam.distanceTo(finalCamPos)) * 0.22);
    
    const animObj = { t: 0 };
    
    activeCameraTween = gsap.to(animObj, {
        t: 1,
        duration: 1.4,
        ease: "power2.inOut",
        onUpdate: () => {
            const t = animObj.t;
            const u = 1 - t;
            camera.position.x = u * u * startCam.x + 2 * u * t * midCam.x + t * t * finalCamPos.x;
            camera.position.y = u * u * startCam.y + 2 * u * t * midCam.y + t * t * finalCamPos.y;
            camera.position.z = u * u * startCam.z + 2 * u * t * midCam.z + t * t * finalCamPos.z;
            
            controls.target.lerpVectors(startTarget, targetWorldPos, t);
            controls.update();
        },
        onComplete: () => {
            isAnimating = false;
            activeCameraTween = null;
            camera.position.copy(finalCamPos);
            controls.target.copy(targetWorldPos);
            controls.update();
            if (data && !isTourActive) {
                showInfo(data);
            }
        }
    });
}

function showInfo(data) {
    if (!infoPanel || !data || !data.title) return;
    infoBadge.innerText = data.badge || 'KOSMIK OBYEKT';
    infoTitle.innerText = data.title || '';
    infoSubtitle.innerText = data.subtitle || '';
    infoContent.innerText = data.content || '';
    
    // Direct AI / Telegram Message Terminal for Moon
    const termContainer = document.getElementById('moon-terminal-container');
    if (data.isMoon) {
        renderMoonTerminal();
    } else {
        if (termContainer) {
            termContainer.classList.add('hidden');
            termContainer.style.display = 'none';
        }
    }

    // Sun Resume Download Button
    const sunResumeBtn = document.getElementById('sun-resume-btn');
    if (sunResumeBtn) {
        if (data.isSun) {
            sunResumeBtn.style.display = 'inline-flex';
        } else {
            sunResumeBtn.style.display = 'none';
        }
    }
    
    infoTags.innerHTML = '';
    if (data.tags && data.tags.length > 0) {
        data.tags.forEach(tag => {
            const span = document.createElement('span');
            span.className = 'tag-item';
            span.innerText = `#${tag}`;
            infoTags.appendChild(span);
        });
    }
    
    if (data.actionUrl) {
        infoActionBtn.href = data.actionUrl;
        infoActionBtn.innerText = data.actionText || 'Ko\'rish';
        infoActionBtn.style.display = 'inline-flex';
    } else {
        infoActionBtn.style.display = 'none';
    }

    if (data.githubUrl && infoGithubBtn) {
        infoGithubBtn.href = data.githubUrl;
        infoGithubBtn.innerText = data.githubText ? data.githubText : 'GitHub Repo';
        infoGithubBtn.style.display = 'inline-flex';
    } else if (infoGithubBtn) {
        infoGithubBtn.style.display = 'none';
    }
    
    infoPanel.classList.remove('hidden');
}

function hideInfo() {
    if (infoPanel) infoPanel.classList.add('hidden');
    const container = document.getElementById('moon-terminal-container');
    if (container) {
        container.classList.add('hidden');
        container.style.display = 'none';
    }
}

// Window resize handling
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

// Cinematic Initial Dive
function startInitialDive() {
    const isMobile = window.innerWidth < 768;
    const finalPos = isMobile ? { x: 0, y: 225, z: 235 } : { x: 0, y: 165, z: 195 };
    
    gsap.to(camera.position, {
        x: finalPos.x,
        y: finalPos.y,
        z: finalPos.z,
        duration: 2.6,
        ease: "power2.out",
        onUpdate: () => {
            controls.update();
        }
    });
}

// ==============================================================================
// 🤖 REAL-TIME AI VISION HAND GESTURE CONTROL (MEDIAPIPE HANDS)
// ==============================================================================
let isGestureActive = false;
let gestureStream = null;
let handsInstance = null;
let gestureAnimFrameId = null;
let isProcessingFrame = false;

// Exponential Smoothing & Motion Filter States
let smoothedPalmX = null;
let smoothedPalmY = null;
let prevPalmPos = null;

let smoothedReticleX = null;
let smoothedReticleY = null;

let currentGesture = 'none'; // 'palm', 'pointing', 'pinch', 'fist', 'none'
let isPinchingActive = false;
let pinchDidSelect = false;
let pinchStartY = null;
let gestureHoveredObject = null;
let lastPinchTriggerTime = 0;
let isStartingGesture = false;

function detectHandGesture(lm) {
    if (!lm || lm.length < 21) return { gesture: 'none' };

    const d = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
    const wrist = lm[0];
    const indexMcp = lm[5];

    // Distance from fingertip to wrist vs PIP joint to wrist
    const isIndexExt = d(lm[8], wrist) > d(lm[6], wrist) * 1.15;
    const isMiddleExt = d(lm[12], wrist) > d(lm[10], wrist) * 1.15;
    const isRingExt = d(lm[16], wrist) > d(lm[14], wrist) * 1.15;
    const isPinkyExt = d(lm[20], wrist) > d(lm[18], wrist) * 1.15;

    // Pinch: distance between thumb tip (4) and index tip (8)
    const pinchDist = d(lm[4], lm[8]);
    const isPinch = pinchDist < 0.065;

    // Biomechanical distinction: In pinch, index reaches outward from knuckle (MCP),
    // whereas in a tight fist, index tip is curled down into the palm closer to wrist than MCP
    const isIndexReachingOut = d(lm[8], wrist) >= d(indexMcp, wrist) * 0.95;

    const extCount = (isIndexExt ? 1 : 0) + (isMiddleExt ? 1 : 0) + (isRingExt ? 1 : 0) + (isPinkyExt ? 1 : 0);

    // 1. Chimchilash (Pinch): Thumb & Index tips touching AND index reaching out
    if (isPinch && isIndexReachingOut) {
        return { gesture: 'pinch', lm, pinchDist };
    }

    // 2. Ko'rsatkich barmog'i (Pointing / Reticle): Only index extended
    if (isIndexExt && !isMiddleExt && !isRingExt && !isPinkyExt) {
        return { gesture: 'pointing', lm };
    }

    // 3. Musht (Fist / Freeze): All 4 fingers curled into palm
    if (extCount === 0) {
        return { gesture: 'fist', lm };
    }

    // 4. Ochiq kaft (Open Palm / Orbit): 3 or more fingers extended
    if (extCount >= 3) {
        return { gesture: 'palm', lm };
    }

    return { gesture: 'none', lm };
}

function drawGestureCanvas(lm, gestureName) {
    const canvas = document.getElementById('gesture-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const video = document.getElementById('gesture-video');
    if (video && video.readyState >= 2) {
        ctx.save();
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, w, h);
        ctx.restore();
        ctx.fillStyle = 'rgba(2, 8, 20, 0.52)';
        ctx.fillRect(0, 0, w, h);
    } else {
        ctx.fillStyle = '#050a14';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
        ctx.lineWidth = 1;
        for (let x = 0; x < w; x += 18) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let y = 0; y < h; y += 18) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }
    }

    if (!lm) return;

    const CONNECTIONS = [
        [0, 1], [1, 2], [2, 3], [3, 4],
        [0, 5], [5, 6], [6, 7], [7, 8],
        [0, 9], [9, 10], [10, 11], [11, 12],
        [0, 13], [13, 14], [14, 15], [15, 16],
        [0, 17], [17, 18], [18, 19], [19, 20],
        [5, 9], [9, 13], [13, 17]
    ];

    let strokeColor = '#00f0ff';
    if (gestureName === 'pinch') strokeColor = '#ffd700';
    else if (gestureName === 'fist') strokeColor = '#ff6b4a';
    else if (gestureName === 'pointing') strokeColor = '#00ffaa';

    ctx.save();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = strokeColor;
    ctx.shadowColor = strokeColor;
    ctx.shadowBlur = 6;

    for (const [i, j] of CONNECTIONS) {
        const p1 = lm[i];
        const p2 = lm[j];
        if (p1 && p2) {
            ctx.beginPath();
            ctx.moveTo((1 - p1.x) * w, p1.y * h);
            ctx.lineTo((1 - p2.x) * w, p2.y * h);
            ctx.stroke();
        }
    }

    const tips = [4, 8, 12, 16, 20];
    for (let i = 0; i < lm.length; i++) {
        const pt = lm[i];
        const px = (1 - pt.x) * w;
        const py = pt.y * h;
        const isTip = tips.includes(i);

        ctx.beginPath();
        if (isTip) {
            ctx.fillStyle = (i === 8 && (gestureName === 'pointing' || gestureName === 'pinch')) ? '#00ffaa' : '#ffffff';
            ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        } else {
            ctx.fillStyle = strokeColor;
            ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        }
        ctx.fill();
    }
    ctx.restore();
}

function processGestureLandmarks(lm) {
    const uiTexts = translations.ui[currentLang] || translations.ui.uz;
    const dot = document.getElementById('gesture-status-dot');
    const stateText = document.getElementById('gesture-state-text');
    const indicatorIcon = document.getElementById('gesture-indicator-icon');
    const reticleEl = document.getElementById('gesture-reticle');

    if (!lm) {
        currentGesture = 'none';
        if (dot) dot.className = 'gesture-live-dot';
        if (stateText) stateText.innerText = uiTexts.gestures?.searching || "Qo'l qidirilmoqda...";
        if (indicatorIcon) indicatorIcon.innerText = '🔍';
        if (reticleEl) reticleEl.classList.add('hidden');
        smoothedPalmX = null;
        smoothedPalmY = null;
        prevPalmPos = null;
        isPinchingActive = false;
        gestureHoveredObject = null;
        drawGestureCanvas(null, 'none');
        return;
    }

    if (dot) dot.className = 'gesture-live-dot status-active';
    const detection = detectHandGesture(lm);
    currentGesture = detection.gesture;

    drawGestureCanvas(lm, detection.gesture);

    switch (detection.gesture) {
        case 'palm':
            if (indicatorIcon) indicatorIcon.innerText = '🖐';
            if (stateText) stateText.innerText = uiTexts.gestures?.palm || "Ochiq Kaft • Orbit";
            if (reticleEl) reticleEl.classList.add('hidden');
            isPinchingActive = false;
            pinchStartY = null;
            gestureHoveredObject = null;
            handlePalmMovement(lm);
            break;

        case 'pointing':
            if (indicatorIcon) indicatorIcon.innerText = '👆';
            if (stateText) stateText.innerText = uiTexts.gestures?.pointing || "Ko'rsatish • Reticle";
            smoothedPalmX = null;
            smoothedPalmY = null;
            prevPalmPos = null;
            isPinchingActive = false;
            pinchStartY = null;
            handlePointingMovement(lm);
            break;

        case 'pinch':
            if (indicatorIcon) indicatorIcon.innerText = '🤏';
            if (stateText) stateText.innerText = uiTexts.gestures?.pinch || "Chimchilash • Zoom / Tanlash";
            smoothedPalmX = null;
            smoothedPalmY = null;
            prevPalmPos = null;
            handlePinchAction(lm);
            break;

        case 'fist':
            if (indicatorIcon) indicatorIcon.innerText = '✊';
            if (stateText) stateText.innerText = uiTexts.gestures?.fist || "Musht • To'xtatish";
            if (reticleEl) reticleEl.classList.add('hidden');
            if (activeCameraTween) {
                activeCameraTween.kill();
                activeCameraTween = null;
                isAnimating = false;
            }
            smoothedPalmX = null;
            smoothedPalmY = null;
            prevPalmPos = null;
            isPinchingActive = false;
            pinchDidSelect = false;
            pinchStartY = null;
            gestureHoveredObject = null;
            break;

        default:
            if (indicatorIcon) indicatorIcon.innerText = '🖐';
            if (stateText) stateText.innerText = uiTexts.gestures?.searching || "Qo'l qidirilmoqda...";
            if (reticleEl) reticleEl.classList.add('hidden');
            smoothedPalmX = null;
            smoothedPalmY = null;
            prevPalmPos = null;
            isPinchingActive = false;
            pinchDidSelect = false;
            pinchStartY = null;
            gestureHoveredObject = null;
            break;
    }
}

function rotateCameraAroundTarget(deltaTheta, deltaPhi) {
    if (activeCameraTween) {
        activeCameraTween.kill();
        activeCameraTween = null;
        isAnimating = false;
    }
    const target = controls.target || new THREE.Vector3(0, 0, 0);
    const offset = camera.position.clone().sub(target);

    // Use Three.js Spherical coordinates to ensure smooth polar clamping and eliminate gimbal flips
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta += deltaTheta;
    spherical.phi = Math.max(0.08, Math.min(Math.PI - 0.08, spherical.phi + deltaPhi));
    spherical.radius = Math.max(controls.minDistance || 15, Math.min(controls.maxDistance || 550, spherical.radius));

    offset.setFromSpherical(spherical);
    camera.position.copy(target).add(offset);
    camera.lookAt(target);
    controls.update();
}

function zoomCamera(factor) {
    if (activeCameraTween) {
        activeCameraTween.kill();
        activeCameraTween = null;
        isAnimating = false;
    }
    const target = controls.target || new THREE.Vector3(0, 0, 0);
    const offset = camera.position.clone().sub(target);
    const currentDist = offset.length();
    const newDist = Math.max(controls.minDistance || 15, Math.min(controls.maxDistance || 550, currentDist * factor));
    offset.setLength(newDist);
    camera.position.copy(target).add(offset);
    camera.lookAt(target);
    controls.update();
}

function handlePalmMovement(lm) {
    const rawPalmX = (1 - (lm[0].x + lm[9].x) / 2) * window.innerWidth;
    const rawPalmY = ((lm[0].y + lm[9].y) / 2) * window.innerHeight;

    smoothedPalmX = (smoothedPalmX === null) ? rawPalmX : (smoothedPalmX * 0.70 + rawPalmX * 0.30);
    smoothedPalmY = (smoothedPalmY === null) ? rawPalmY : (smoothedPalmY * 0.70 + rawPalmY * 0.30);

    if (prevPalmPos) {
        const dx = smoothedPalmX - prevPalmPos.x;
        const dy = smoothedPalmY - prevPalmPos.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= 1.5 && dist < 120) {
            rotateCameraAroundTarget(-dx * 0.005, dy * 0.0035);
        }
    }
    prevPalmPos = { x: smoothedPalmX, y: smoothedPalmY };
}

function handlePointingMovement(lm) {
    const reticleEl = document.getElementById('gesture-reticle');
    const labelEl = document.getElementById('reticle-target-label');
    if (!reticleEl) return;

    const rawX = (1 - lm[8].x) * window.innerWidth;
    const rawY = lm[8].y * window.innerHeight;

    smoothedReticleX = (smoothedReticleX === null) ? rawX : (smoothedReticleX * 0.65 + rawX * 0.35);
    smoothedReticleY = (smoothedReticleY === null) ? rawY : (smoothedReticleY * 0.65 + rawY * 0.35);

    reticleEl.style.transform = `translate3d(${smoothedReticleX}px, ${smoothedReticleY}px, 0)`;
    reticleEl.classList.remove('hidden');
    reticleEl.classList.remove('reticle-pinching');

    const mouseNorm = new THREE.Vector2(
        (smoothedReticleX / window.innerWidth) * 2 - 1,
        -(smoothedReticleY / window.innerHeight) * 2 + 1
    );
    raycaster.setFromCamera(mouseNorm, camera);
    const intersects = raycaster.intersectObjects(interactableObjects, true);

    let hit = null;
    for (let i = 0; i < intersects.length; i++) {
        let cand = intersects[i].object;
        while (cand && (!cand.userData || !cand.userData.title) && cand.parent && cand.parent !== scene) {
            cand = cand.parent;
        }
        if (cand && cand.userData && cand.userData.title) {
            hit = cand;
            break;
        }
    }

    gestureHoveredObject = hit;
    if (hit) {
        reticleEl.classList.add('reticle-hovering');
        if (labelEl) {
            labelEl.innerText = hit.userData.title;
            labelEl.style.display = 'block';
        }
    } else {
        reticleEl.classList.remove('reticle-hovering');
        if (labelEl) {
            labelEl.innerText = '';
            labelEl.style.display = 'none';
        }
    }
}

function handlePinchAction(lm) {
    const reticleEl = document.getElementById('gesture-reticle');
    if (!reticleEl) return;

    const midX = (lm[4].x + lm[8].x) / 2;
    const midY = (lm[4].y + lm[8].y) / 2;
    const rawX = (1 - midX) * window.innerWidth;
    const rawY = midY * window.innerHeight;

    smoothedReticleX = (smoothedReticleX === null) ? rawX : (smoothedReticleX * 0.65 + rawX * 0.35);
    smoothedReticleY = (smoothedReticleY === null) ? rawY : (smoothedReticleY * 0.65 + rawY * 0.35);

    reticleEl.style.transform = `translate3d(${smoothedReticleX}px, ${smoothedReticleY}px, 0)`;
    reticleEl.classList.remove('hidden');
    reticleEl.classList.add('reticle-pinching');

    if (!isPinchingActive) {
        isPinchingActive = true;
        pinchStartY = smoothedReticleY;
        pinchDidSelect = false;

        // Ensure raycasting check for target under reticle if not already cached
        if (!gestureHoveredObject) {
            const mouseNorm = new THREE.Vector2(
                (smoothedReticleX / window.innerWidth) * 2 - 1,
                -(smoothedReticleY / window.innerHeight) * 2 + 1
            );
            raycaster.setFromCamera(mouseNorm, camera);
            const intersects = raycaster.intersectObjects(interactableObjects, true);
            for (let i = 0; i < intersects.length; i++) {
                let cand = intersects[i].object;
                while (cand && (!cand.userData || !cand.userData.title) && cand.parent && cand.parent !== scene) {
                    cand = cand.parent;
                }
                if (cand && cand.userData && cand.userData.title) {
                    gestureHoveredObject = cand;
                    break;
                }
            }
        }

        if (gestureHoveredObject) {
            pinchDidSelect = true;
            const now = performance.now();
            if (now - lastPinchTriggerTime > 600) {
                lastPinchTriggerTime = now;
                focusOnObject(gestureHoveredObject);
            }
        }
    } else {
        // Only zoom if this pinch gesture did not select/focus on a planet
        if (!pinchDidSelect && pinchStartY !== null) {
            const dy = smoothedReticleY - pinchStartY;
            if (Math.abs(dy) > 10) {
                zoomCamera(dy < 0 ? 0.96 : 1.04);
                pinchStartY = smoothedReticleY;
            }
        }
    }
}

function onGestureResults(results) {
    if (!results) return;
    const lm = (results.multiHandLandmarks && results.multiHandLandmarks[0]) || null;
    processGestureLandmarks(lm);
}

function updateGestureButtonUI(active) {
    const btn = document.getElementById('gesture-toggle-btn');
    const textEl = document.getElementById('gesture-toggle-text');
    const uiTexts = translations.ui[currentLang] || translations.ui.uz;
    if (!btn) return;

    if (active) {
        btn.classList.add('gesture-active');
        btn.classList.remove('gesture-inactive');
        if (textEl) textEl.innerText = uiTexts.gestureOn || "Qo'l: Yoniq";
    } else {
        btn.classList.remove('gesture-active');
        btn.classList.add('gesture-inactive');
        if (textEl) textEl.innerText = uiTexts.gestureBtn || "Qo'l Boshqaruvi";
    }
}

function initHandsInstance() {
    if (!handsInstance && window.Hands) {
        try {
            handsInstance = new window.Hands({
                locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
            });
            handsInstance.setOptions({
                maxNumHands: 1,
                modelComplexity: 0, // Lite model: ultra fast sub-30ms execution, perfect 60fps concurrent with Three.js WebGL
                minDetectionConfidence: 0.60,
                minTrackingConfidence: 0.60
            });
            handsInstance.onResults(onGestureResults);
        } catch (e) {
            console.warn("Hands init error:", e);
        }
    }
    return handsInstance;
}

async function startGestureControl() {
    if (isGestureActive || isStartingGesture) return;
    isStartingGesture = true;
    const hud = document.getElementById('gesture-hud');
    const dot = document.getElementById('gesture-status-dot');
    const stateText = document.getElementById('gesture-state-text');
    const uiTexts = translations.ui[currentLang] || translations.ui.uz;

    if (hud) hud.classList.remove('hidden');
    if (dot) dot.className = 'gesture-live-dot';
    if (stateText) stateText.innerText = "Kamera yoqilmoqda...";

    initHandsInstance();

    const video = document.getElementById('gesture-video');
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("getUserMedia not supported in this browser");
        }
        let stream = null;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 320, max: 640 },
                    height: { ideal: 240, max: 480 },
                    facingMode: 'user'
                },
                audio: false
            });
        } catch (cErr) {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        gestureStream = stream;

        if (!isStartingGesture) {
            if (gestureStream) {
                gestureStream.getTracks().forEach(t => t.stop());
                gestureStream = null;
            }
            return;
        }

        if (video) {
            video.srcObject = gestureStream;
            await video.play();
        }

        isGestureActive = true;
        updateGestureButtonUI(true);
        if (dot) dot.className = 'gesture-live-dot status-active';
        if (stateText) stateText.innerText = uiTexts.gestures?.searching || "Qo'l qidirilmoqda...";

        startProcessingLoop();
    } catch (err) {
        console.warn("Camera access failed or denied:", err);
        isGestureActive = false;
        updateGestureButtonUI(false);
        if (dot) dot.className = 'gesture-live-dot status-error';
        const isDenied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
        if (stateText) {
            stateText.innerText = isDenied
                ? (uiTexts.gestures?.camDenied || "Kamera ruxsati berilmadi")
                : (uiTexts.gestures?.camError || "Kamera ulanishida xatolik");
        }
        setTimeout(() => {
            if (!isGestureActive && hud) hud.classList.add('hidden');
        }, 3500);
    } finally {
        isStartingGesture = false;
    }
}

function startProcessingLoop() {
    const video = document.getElementById('gesture-video');
    const pump = async () => {
        if (!isGestureActive) return;
        if (!handsInstance && window.Hands) {
            initHandsInstance();
        }
        if (video && video.readyState >= 2 && !isProcessingFrame && handsInstance) {
            isProcessingFrame = true;
            try {
                await handsInstance.send({ image: video });
            } catch (e) {
                // ignore transient frame skip
            } finally {
                isProcessingFrame = false;
            }
        }
        gestureAnimFrameId = requestAnimationFrame(pump);
    };
    gestureAnimFrameId = requestAnimationFrame(pump);
}

function stopGestureControl() {
    isStartingGesture = false;
    isGestureActive = false;
    if (gestureAnimFrameId) {
        cancelAnimationFrame(gestureAnimFrameId);
        gestureAnimFrameId = null;
    }
    if (gestureStream) {
        gestureStream.getTracks().forEach(t => t.stop());
        gestureStream = null;
    }
    const video = document.getElementById('gesture-video');
    if (video) {
        video.srcObject = null;
    }

    document.getElementById('gesture-hud')?.classList.add('hidden');
    
    const reticleEl = document.getElementById('gesture-reticle');
    if (reticleEl) {
        reticleEl.classList.add('hidden');
        reticleEl.classList.remove('reticle-hovering', 'reticle-pinching');
    }
    const labelEl = document.getElementById('reticle-target-label');
    if (labelEl) {
        labelEl.innerText = '';
        labelEl.style.display = 'none';
    }

    updateGestureButtonUI(false);

    const canvas = document.getElementById('gesture-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }

    smoothedPalmX = null;
    smoothedPalmY = null;
    prevPalmPos = null;
    smoothedReticleX = null;
    smoothedReticleY = null;
    currentGesture = 'none';
    isPinchingActive = false;
    pinchDidSelect = false;
    pinchStartY = null;
    gestureHoveredObject = null;
}

function toggleGestureControl() {
    if (isGestureActive) {
        stopGestureControl();
    } else {
        startGestureControl();
    }
}

const gestureToggleBtn = document.getElementById('gesture-toggle-btn');
if (gestureToggleBtn) {
    gestureToggleBtn.addEventListener('click', toggleGestureControl);
}

const gestureCloseBtn = document.getElementById('gesture-close-btn');
if (gestureCloseBtn) {
    gestureCloseBtn.addEventListener('click', stopGestureControl);
}

// Animation Loop
let clockTime = 0;
function animate() {
    requestAnimationFrame(animate);
    
    clockTime += 0.008;
    sunUniforms.uTime.value = clockTime;
    if (typeof milkyWayUniforms !== 'undefined' && milkyWayUniforms.uTime) {
        milkyWayUniforms.uTime.value = clockTime;
    }

    const shouldRotate = !currentTarget && !isOrbitPaused && currentGesture !== 'fist' && !isScaleModeActive;
    const effectiveSpeed = shouldRotate ? orbitSpeedMultiplier : 0.2;
    
    planets.forEach(p => {
        if (shouldRotate) {
            p.orbitGroup.rotation.y += p.speed * orbitSpeedMultiplier;
        }
        if (!p.isMoonData) {
            p.mesh.rotateY(0.005);
        } else {
            p.mesh.rotateY(0.015);
        }
        if (p.cloudsMesh) {
            p.cloudsMesh.rotateY(0.007);
        }
    });

    const isCometFocused = currentTarget && (currentTarget.userData?.id === 'Comet' || currentTarget.userData?.isComet);
    const isVoyagerFocused = currentTarget && (currentTarget.userData?.id === 'Voyager' || currentTarget.userData?.isProbe);

    if (typeof updateSaturnRingShadow === 'function') {
        updateSaturnRingShadow();
    }
    if (typeof updateComet === 'function') {
        updateComet(isCometFocused ? 0.0 : effectiveSpeed);
    }
    if (typeof updateSolarWind === 'function') {
        updateSolarWind(effectiveSpeed);
    }
    if (typeof updateVoyager === 'function') {
        updateVoyager(isVoyagerFocused ? 0.0 : effectiveSpeed);
    }

    // Solar Eclipse: Update Moon world position for Earth umbra shader
    if (moonMeshRef && typeof earthEclipseUniforms !== 'undefined' && earthEclipseUniforms.uMoonWorldPos) {
        const mPos = new THREE.Vector3();
        moonMeshRef.getWorldPosition(mPos);
        earthEclipseUniforms.uMoonWorldPos.value.copy(mPos);
    }

    // Black Hole: Animate accretion disk plasma flow & align lensing plane to camera
    if (typeof accretionMat !== 'undefined' && accretionMat.uniforms?.uTime) {
        accretionMat.uniforms.uTime.value = clockTime;
    }
    if (typeof lensingMesh !== 'undefined' && lensingMesh) {
        lensingMesh.lookAt(camera.position);
    }

    // Perseid Meteor Shower: Real-time shooting stars update
    if (typeof perseidShower !== 'undefined' && perseidShower) {
        perseidShower.update(0.016 * effectiveSpeed);
    }

    // Surface View Mode: Dynamic surface camera tracking while planets orbit
    if (currentSurfaceMode === 'earthrise') {
        if (moonMeshRef) {
            const mPos = new THREE.Vector3();
            moonMeshRef.getWorldPosition(mPos);
            const earthObj = planets.find(p => p.mesh.userData && p.mesh.userData.id === 'Earth');
            if (earthObj) {
                const ePos = new THREE.Vector3();
                earthObj.mesh.getWorldPosition(ePos);
                const dir = ePos.clone().sub(mPos).normalize();
                const targetCam = mPos.clone().add(dir.clone().multiplyScalar(0.55)).add(new THREE.Vector3(0, 0.25, 0));
                camera.position.lerp(targetCam, 0.12);
                controls.target.lerp(ePos, 0.12);
            }
        }
    } else if (currentSurfaceMode === 'mars_sunset') {
        const marsObj = planets.find(p => p.mesh.userData && p.mesh.userData.id === 'Mars');
        if (marsObj) {
            const marsPos = new THREE.Vector3();
            marsObj.mesh.getWorldPosition(marsPos);
            const dir = new THREE.Vector3(0, 0, 0).sub(marsPos).normalize();
            const targetCam = marsPos.clone().add(dir.clone().multiplyScalar(1.68)).add(new THREE.Vector3(0, 0.4, 0));
            camera.position.lerp(targetCam, 0.12);
            controls.target.lerp(new THREE.Vector3(0, 0, 0), 0.12);
        }
    }
    
    if (shouldRotate) {
        stars.rotation.y += 0.0001;
        if (typeof milkyWaySphere !== 'undefined' && milkyWaySphere) {
            milkyWaySphere.rotation.y += 0.00004;
        }
        if (typeof asteroidBeltGroup !== 'undefined' && asteroidBeltGroup) {
            asteroidBeltGroup.rotation.y += 0.0009;
        }
    }

    // Natural astronomical scintillation (twinkling)
    interactiveStars.forEach(s => {
        const tw = 0.88 + 0.22 * Math.sin(clockTime * s.speed + s.phase) + 0.08 * Math.cos(clockTime * s.speed * 2.3 + s.phase);
        s.sprite.scale.set(4.5 * tw, 4.5 * tw, 1);
        s.core.scale.set(1.4 * tw, 1.4 * tw, 1);
        s.sprite.material.opacity = 0.84 + 0.14 * Math.sin(clockTime * s.speed * 1.5 + s.phase);
    });

    if (prominenceMesh) {
        prominenceMesh.quaternion.copy(camera.quaternion);
        coronaUniforms.uTime.value = clockTime;
    }

    if (!isSkyViewActive) {
        controls.update();
    }
    composer.render();
}

// Global debug exposure
window.__interactableObjects = interactableObjects;
window.__focusOnObject = focusOnObject;
window.__resetView = resetView;
window.__showInfo = showInfo;
window.__setLanguage = setLanguage;
window.__toggleAudio = toggleAudio;
Object.defineProperty(window, '__isAudioMuted', { get: () => isAudioMuted, configurable: true });
Object.defineProperty(window, '__orbitSpeedMultiplier', { get: () => orbitSpeedMultiplier, configurable: true });
window.__setOrbitSpeed = setOrbitSpeed;
window.__toggleOrbits = toggleOrbits;
window.__toggleCinematic = toggleCinematic;
window.__orbitLinesGroup = typeof orbitLinesGroup !== 'undefined' ? orbitLinesGroup : null;
window.__comet = typeof cometGroup !== 'undefined' ? cometGroup : null;
window.__voyager = typeof voyagerGroup !== 'undefined' ? voyagerGroup : null;
window.__milkyWaySphere = typeof milkyWaySphere !== 'undefined' ? milkyWaySphere : null;
window.__applyCatalogFilters = applyCatalogFilters;
window.__renderMoonTerminal = renderMoonTerminal;
window.__closeCatalog = closeCatalog;
window.__showGuide = showGuide;
window.__hideGuide = hideGuide;
window.__camera = camera;
window.__controls = controls;
window.__startTour = startTour;
window.__exitTour = exitTour;
window.__goToTourStop = goToTourStop;
window.__toggleTourPlayPause = toggleTourPlayPause;
window.__tourStops = tourStops;
window.__asteroidBeltGroup = typeof asteroidBeltGroup !== 'undefined' ? asteroidBeltGroup : null;
window.__asteroidBeltMesh = typeof asteroidBeltMesh !== 'undefined' ? asteroidBeltMesh : null;
Object.defineProperty(window, '__isTourActive', { get: () => isTourActive, configurable: true });
Object.defineProperty(window, '__tourIndex', { get: () => tourIndex, configurable: true });
Object.defineProperty(window, '__isTourPaused', { get: () => isTourPaused, configurable: true });

// Gesture Control Test Hooks
window.__startGestureControl = startGestureControl;
window.__stopGestureControl = stopGestureControl;
window.__toggleGestureControl = toggleGestureControl;
window.__feedGestureLandmarks = (lm) => {
    if (!isGestureActive) {
        isGestureActive = true;
        updateGestureButtonUI(true);
        document.getElementById('gesture-hud')?.classList.remove('hidden');
    }
    processGestureLandmarks(lm);
};
Object.defineProperty(window, '__isGestureActive', { get: () => isGestureActive, configurable: true });
Object.defineProperty(window, '__currentGesture', { get: () => currentGesture, configurable: true });
Object.defineProperty(window, '__gestureHoveredObject', { get: () => gestureHoveredObject, configurable: true });

// Cosmic Realism Boost Test Hooks
window.__blackHole = typeof blackHoleGroup !== 'undefined' ? blackHoleGroup : null;
window.__jupiterMoons = typeof jupiterMoonsList !== 'undefined' ? jupiterMoonsList : null;
window.__saturnMoons = typeof saturnMoonsList !== 'undefined' ? saturnMoonsList : null;
window.__toggleSurfaceView = setSurfaceView;
Object.defineProperty(window, '__surfaceMode', { get: () => currentSurfaceMode, configurable: true });
window.__toggleScaleComparison = toggleScaleComparison;
Object.defineProperty(window, '__isScaleModeActive', { get: () => isScaleModeActive, configurable: true });
window.__toggleConstellations = toggleConstellations;
window.__constellationsGroup = typeof constellationsGroup !== 'undefined' ? constellationsGroup : null;
Object.defineProperty(window, '__areConstellationsVisible', { get: () => areConstellationsVisible, configurable: true });
window.__toggleSkyView = toggleSkyView;
Object.defineProperty(window, '__isSkyViewActive', { get: () => isSkyViewActive, configurable: true });
window.__meteorShower = typeof perseidShower !== 'undefined' ? perseidShower : null;
window.__earthEclipseUniforms = typeof earthEclipseUniforms !== 'undefined' ? earthEclipseUniforms : null;


// Initialize localized UI & object states
setLanguage(currentLang);

hideInfo();
animate();
setTimeout(startInitialDive, 300);
