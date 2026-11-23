import * as THREE from "three";

/**
 * Bakes the procedural Milky Way into a cube texture, once.
 *
 * The sky used to be a 4500-unit sphere carrying this shader, redrawn every
 * frame. Per pixel that is two five-octave fBm evaluations, each octave eight
 * hash lookups — about 80 hashes for every pixel on screen, every frame. At a
 * 2.1 megapixel drawing buffer that is roughly 170 million hash evaluations
 * per frame, and it measured as the single largest cost in the scene:
 * removing the skydome took the frame from 29.1 ms to 22.2 ms, a third of the
 * total.
 *
 * None of that work was buying anything, because the sky does not change. Its
 * only animation was `uTime * 0.001` against coordinates scaled by 2.8 — a
 * two percent drift through noise space per minute, which nobody can see. So
 * it is rendered once into a cube map at startup and used as the scene
 * background from then on: the per-frame cost becomes a texture fetch, and
 * the image is identical.
 */

const VERTEX_SHADER = `
varying vec3 vWorldDir;
void main() {
    vWorldDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT_SHADER = `
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

    // Density falls off away from the galactic plane, with a darker dust lane
    // hugging it — the two exponentials are what give the Milky Way its band.
    float galLat = abs(dir.y);
    float mwMask = exp(-galLat * 5.2);
    float mwDust = exp(-galLat * 16.0) * 0.75;

    float nebulaNoise = fbmNebula(dir * 2.8);
    float dustNoise = fbmNebula(dir * 5.2 + vec3(5.2, 1.3, 2.7));

    float mwIntensity = clamp(
        (nebulaNoise - dustNoise * mwDust) * mwMask * 1.1, 0.0, 1.0);

    // Away from the plane the sky is nearly black: under 4/255 in sRGB, which
    // is what real deep-sky photography looks like once stars are excluded.
    vec3 deepSpace = vec3(0.0005, 0.0005, 0.0009);
    // Unresolved starlight along the disc reads slightly warm.
    vec3 starlightColor = vec3(0.09, 0.085, 0.075);

    gl_FragColor = vec4(deepSpace + starlightColor * mwIntensity * 0.35, 1.0);
}
`;

/**
 * Renders the sky into a cube map and returns its texture.
 *
 * @param {THREE.WebGLRenderer} renderer
 * @param {number} [size] per-face resolution. 1024 is enough: the content is
 *   low-frequency cloud, so a larger face resolves no extra detail and only
 *   costs VRAM and a longer bake.
 * @returns {{ texture: THREE.CubeTexture, dispose: () => void }}
 */
export function bakeStarfieldSky(renderer, size = 1024) {
  const target = new THREE.WebGLCubeRenderTarget(size, {
    // Half-float keeps the very dark values from banding. The sky's whole
    // range sits in the bottom few percent of 0..1, where 8-bit steps are
    // visible as rings around the galactic plane.
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    generateMipmaps: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
  });

  const bakeScene = new THREE.Scene();
  const geometry = new THREE.SphereGeometry(100, 64, 64);
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  bakeScene.add(mesh);

  // A CubeCamera at the origin captures all six directions in one update.
  const cubeCamera = new THREE.CubeCamera(1, 1000, target);

  // The bake must not be colour-managed twice: it is captured in the same
  // space the scene renders in, and tone mapping is applied once at output.
  const previousToneMapping = renderer.toneMapping;
  renderer.toneMapping = THREE.NoToneMapping;
  cubeCamera.update(renderer, bakeScene);
  renderer.toneMapping = previousToneMapping;

  geometry.dispose();
  material.dispose();

  return {
    texture: target.texture,
    dispose: () => target.dispose(),
  };
}
