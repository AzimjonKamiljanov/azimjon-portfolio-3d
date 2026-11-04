import * as THREE from "three";
import profileData from "../data/profile.json";

// Photosphere Shader (5772 K Blackbody, Eddington Limb Darkening, Chromosphere Rim, Differential Rotation)
const sunVertexShader = `
varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
varying vec3 vLocalPosition;

void main() {
    vUv = uv;
    vLocalPosition = position;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const sunFragmentShader = `
uniform float uTime;
uniform sampler2D uPhotosphereTexture;

varying vec2 vUv;
varying vec3 vWorldNormal;
varying vec3 vWorldPosition;
varying vec3 vLocalPosition;

// 3D Simplex noise
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
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float cosTheta = clamp(dot(vWorldNormal, viewDir), 0.0, 1.0);

    // Differential solar rotation: equator ~25d, poles ~35d
    float lat = asin(clamp(vLocalPosition.y / 7.2, -1.0, 1.0));
    float diffSpeed = 1.0 - 0.28 * sin(lat) * sin(lat);
    float angle = atan(vLocalPosition.z, vLocalPosition.x) + uTime * 0.025 * diffSpeed;
    vec2 rotUv = vec2(angle / (2.0 * 3.14159265) + 0.5, lat / 3.14159265 + 0.5);

    // Sample SDO continuum photospheric map
    vec4 texCol = texture2D(uPhotosphereTexture, rotUv);

    // Convective solar granulation cells (Voronoi/turbulent cells)
    vec3 granPos = vLocalPosition * 2.8 + vec3(0.0, uTime * 0.015, 0.0);
    float gran = snoise(granPos) * 0.6 + snoise(granPos * 2.5) * 0.4;

    // Photosphere Blackbody color (~5772 K: clean white-yellow core, not cartoon orange)
    vec3 coreColor = vec3(1.0, 0.985, 0.935);
    vec3 limbWarm = vec3(0.96, 0.78, 0.52);

    // Eddington Limb Darkening approximation: I(mu) / I_0 = 1 - u*(1 - mu)
    float uCoeff = 0.62;
    float eddington = 1.0 - uCoeff * (1.0 - pow(cosTheta, 0.74));
    vec3 photoColor = mix(limbWarm, coreColor, eddington);

    // Modulate with photospheric sunspot continuum texture
    float spotIntensity = smoothstep(0.15, 0.85, texCol.r);
    photoColor *= (0.35 + 0.65 * spotIntensity);

    // Add fine granulation texture
    photoColor += vec3(0.045, 0.035, 0.015) * gran;

    // Thin red H-alpha chromosphere rim (656.3 nm emission at extreme grazing angle)
    float chromosphere = smoothstep(0.14, 0.0, cosTheta) * smoothstep(0.0, 0.015, cosTheta);
    photoColor = mix(photoColor, vec3(0.92, 0.14, 0.06), chromosphere * 0.75);

    // HDR disc emission (> 2.0 so only the Sun blooms in UnrealBloomPass with threshold >= 1.0)
    photoColor *= 2.45;

    gl_FragColor = vec4(photoColor, 1.0);
}
`;

// Coronal Streamers & Prominences Shader (Radially symmetric, no square artifacts)
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

varying vec2 vUv;
varying vec3 vWorldPosition;

vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
float snoise2(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
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

    // Disc radius in billboard normalized coordinates
    float sunR = 0.20;

    // Discard inside the solar disc so photosphere renders in full depth
    if (dist < sunR - 0.005) {
        discard;
    }

    // Coronal streamers (magnetic field lines extending radially)
    float t = uTime * 0.08;
    float rays1 = sin(angle * 12.0 + snoise2(vec2(angle * 4.0, t * 0.3)) * 1.5 + t * 0.2);
    float rays2 = cos(angle * 24.0 - t * 0.4 + snoise2(vec2(angle * 8.0, t * 0.4)) * 1.2);
    float streamerPattern = pow(0.5 + 0.5 * (rays1 * 0.6 + rays2 * 0.4), 2.5);

    // Radial exponential decay
    float normDist = clamp((dist - sunR) / (0.48 - sunR), 0.0, 1.0);
    float coronaFalloff = exp(-normDist * 4.8) * (1.0 - smoothstep(0.75, 1.0, normDist));

    // Pale pearl-white coronal streamer light
    vec3 coronaColor = mix(vec3(1.0, 0.96, 0.88), vec3(0.92, 0.90, 0.86), normDist);
    vec3 col = coronaColor * streamerPattern * coronaFalloff * 0.65;

    // Small realistic prominences right at the solar limb (H-alpha 656nm plasma arches)
    float promDist = dist - sunR;
    if (promDist > 0.0 && promDist < 0.038) {
        float promNoise = snoise2(vec2(angle * 18.0 + t * 0.5, dist * 60.0));
        float promArch = smoothstep(0.25, 0.85, promNoise) * (1.0 - promDist / 0.038);
        vec3 promColor = vec3(0.95, 0.18, 0.08); // Real red H-alpha emission
        col += promColor * promArch * 1.35;
    }

    // Pure radial alpha feathering: strictly eliminates any square artifact
    float alpha = coronaFalloff * (0.3 + 0.7 * streamerPattern);
    alpha *= smoothstep(sunR - 0.005, sunR + 0.012, dist);
    alpha *= smoothstep(0.49, 0.38, dist);

    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}
`;

export function initSun(scene, textureLoader, interactableObjects) {
  // Use high-resolution photosphere continuum map
  const photosphereTex = textureLoader.load("assets/sun_photosphere.webp");
  photosphereTex.colorSpace = THREE.SRGBColorSpace;
  photosphereTex.wrapS = THREE.RepeatWrapping;
  photosphereTex.wrapT = THREE.ClampToEdgeWrapping;

  const sunUniforms = {
    uTime: { value: 0 },
    uPhotosphereTexture: { value: photosphereTex },
  };

  const sunGeometry = new THREE.SphereGeometry(7.2, 64, 64);
  const sunMaterial = new THREE.ShaderMaterial({
    uniforms: sunUniforms,
    vertexShader: sunVertexShader,
    fragmentShader: sunFragmentShader,
    depthWrite: true,
    transparent: false,
  });

  const sun = new THREE.Mesh(sunGeometry, sunMaterial);
  sun.renderOrder = 1;
  scene.add(sun);

  // Corona and Prominence Mesh
  const coronaUniforms = {
    uTime: { value: 0 },
  };

  const coronaMaterial = new THREE.ShaderMaterial({
    uniforms: coronaUniforms,
    vertexShader: coronaVertexShader,
    fragmentShader: coronaFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
  });

  // Billboard plane matching solar radius (7.2 / 0.20 = 36.0 units width)
  const prominenceGeo = new THREE.PlaneGeometry(36.0, 36.0);
  const prominenceMesh = new THREE.Mesh(prominenceGeo, coronaMaterial);
  prominenceMesh.renderOrder = 2;
  scene.add(prominenceMesh);

  // Truthful developer profile attached to Sun
  sun.userData = {
    id: "sun",
    isSun: true,
    badge: "Markaziy Yulduz • Developer Profili",
    title: `${profileData.name} (${profileData.title.uz})`,
    subtitle: `${profileData.title.uz} • PDP University Talabasi`,
    content: `${profileData.bio.uz}\n\nTa'lim:\n• PDP University — Sun'iy intellekt (AI) yo'nalishi (2-kurs talabasi)\n• School 21 Tashkent — Kiberxavfsizlik va tizimli dasturlash\n\nAsosiy Yo'nalishlar:\n• AI & Agentlar: Python, PyTorch, Whisper STT, Kokoro TTS, Gemini Flash, DeepSeek R1.\n• Frontend & 3D: Three.js / WebGL, GLSL Shaders, React, Vite, TypeScript.\n• Backend: Node.js, Express, FastAPI, PostgreSQL, Docker.\n• Tillar: O'zbek tili (Native), Ingliz tili (B1), Rus tili (A1).`,
    tags: [
      "Azimjon Kamiljanov",
      "Three.js / WebGL",
      "AI Agents",
      "PyTorch",
      "Docker",
      "PDP University",
      "School 21",
    ],
    actionUrl: profileData.links.telegramPersonal,
    actionText: "Telegramda Bog'lanish",
    githubUrl: profileData.links.github,
    githubText: "GitHub Profil",
    radius: 7.2,
  };

  interactableObjects.push(sun);

  function update(time, camera) {
    sunUniforms.uTime.value = time;
    coronaUniforms.uTime.value = time;
    if (camera) {
      prominenceMesh.quaternion.copy(camera.quaternion);
    }
  }

  return { sun, prominenceMesh, update };
}
