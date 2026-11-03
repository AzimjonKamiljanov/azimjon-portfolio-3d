import * as THREE from "three";
import profileData from "../data/profile.json";

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

    vec2 diskUV = vec2(
        0.5 + vViewNormal.x * 0.4707 + totalFlow.x,
        0.5 + vViewNormal.y * 0.4707 + totalFlow.y
    );
    diskUV = clamp(diskUV, vec2(0.002), vec2(0.998));

    vec4 photo = texture2D(uPhotosphereExact, diskUV);

    vec3 granPos = vWorldPosition * 3.4;
    float gran1 = snoise(granPos + vec3(totalFlow * 28.0, t * 0.65));
    float gran2 = snoise(granPos * 2.2 + vec3(t * 0.45, 0.0, t * 0.35));
    float granulation = gran1 * 0.65 + gran2 * 0.35;

    float activeFlux = smoothstep(0.62, 0.95, (photo.r * 0.6 + photo.g * 0.4));
    float fluxBreathe = activeFlux * (0.12 + 0.09 * sin(uTime * 2.4 + vWorldPosition.x * 0.6 + vWorldPosition.y * 0.5));

    vec3 col = photo.rgb;
    col = pow(col, vec3(1.18));
    col = mix(col, vec3(col.r * 1.06, col.g * 0.85, col.b * 0.40), 0.35);

    col += vec3(0.08, 0.04, -0.02) * granulation;
    col += vec3(0.22, 0.16, 0.04) * fluxBreathe;

    float limbDarkening = 0.50 + 0.50 * pow(cosTheta, 0.70);
    col = mix(vec3(0.82, 0.24, 0.01), col, limbDarkening);

    float rim = pow(1.0 - cosTheta, 3.8);
    col += vec3(1.0, 0.90, 0.35) * rim * 0.75;
    col *= (0.985 + 0.015 * sin(uTime * 0.85));

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

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
    float sunRim = 0.1636;

    float innerFade = smoothstep(sunRim - 0.016, sunRim + 0.006, dist);
    if (innerFade <= 0.001) {
        discard;
    }

    float t = uTime * 0.15;
    float ray1 = sin(angle * 16.0 + snoise(vec2(angle * 3.2, t * 0.4)) * 2.4 + t * 0.32);
    float ray2 = cos(angle * 32.0 - t * 0.52 + snoise(vec2(angle * 6.5, t * 0.55)) * 1.8);
    float ray3 = sin(angle * 64.0 + t * 0.72 + snoise(vec2(angle * 12.0, t * 0.85)) * 1.2);

    float rawRays = ray1 * 0.48 + ray2 * 0.36 + ray3 * 0.16;
    float rayPattern = pow(0.5 + 0.5 * rawRays, 2.2);

    float normDist = clamp((dist - sunRim) / (0.45 - sunRim), 0.0, 1.0);
    float coronaFade = exp(-normDist * 5.0) * (1.0 - smoothstep(0.65, 0.98, normDist));

    float streamerLight = rayPattern * coronaFade * 0.74 * innerFade;
    float haloLight = pow(1.0 - normDist, 3.0) * 0.48 * innerFade;

    vec2 promUV = (vUv - 0.5) * 2.8766 + 0.5;
    vec4 promCol = vec4(0.0);
    if (promUV.x > 0.01 && promUV.x < 0.99 && promUV.y > 0.01 && promUV.y < 0.99) {
        float edgeFeather = smoothstep(0.01, 0.08, promUV.x) * smoothstep(0.99, 0.92, promUV.x) *
                            smoothstep(0.01, 0.08, promUV.y) * smoothstep(0.99, 0.92, promUV.y);
        
        vec2 promWarp = promUV + vec2(
            snoise(vec2(promUV.x * 12.0 + t * 0.7, promUV.y * 12.0)),
            snoise(vec2(promUV.x * 12.0, promUV.y * 12.0 + t * 0.7))
        ) * 0.010;
        
        promCol = texture2D(uProminenceTexture, promWarp) * edgeFeather;
        float plasmaScint = snoise(vec2(angle * 20.0 + t * 1.2, dist * 30.0 - t * 0.5));
        promCol.rgb *= (0.90 + 0.22 * plasmaScint);
    }

    vec3 rayColor = mix(
        vec3(1.0, 0.88, 0.38),
        vec3(0.96, 0.40, 0.04),
        pow(normDist, 0.65)
    );

    vec3 col = rayColor * (streamerLight + haloLight);
    col += promCol.rgb * promCol.a * 1.20;

    float alpha = clamp(coronaFade * (rayPattern * 0.6 + 0.4) * 0.78 + promCol.a * 0.88, 0.0, 1.0);
    col *= (0.975 + 0.025 * sin(uTime * 0.75));

    gl_FragColor = vec4(col, alpha);
}
`;

export function initSun(scene, textureLoader, interactableObjects) {
  // Load modern WebP textures
  const photosphereTex = textureLoader.load("assets/sun_disk_square.webp");
  photosphereTex.colorSpace = THREE.SRGBColorSpace;

  const prominencesTex = textureLoader.load(
    "assets/sun_prominences_exact.webp",
  );
  prominencesTex.colorSpace = THREE.SRGBColorSpace;

  const sunUniforms = {
    uTime: { value: 0 },
    uPhotosphereExact: { value: photosphereTex },
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

  const coronaUniforms = {
    uTime: { value: 0 },
    uProminenceTexture: { value: prominencesTex },
  };

  const coronaMaterial = new THREE.ShaderMaterial({
    uniforms: coronaUniforms,
    vertexShader: coronaVertexShader,
    fragmentShader: coronaFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
  });

  const prominenceGeo = new THREE.PlaneGeometry(44.0, 44.0);
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
      prominenceMesh.lookAt(camera.position);
    }
  }

  return { sun, prominenceMesh, update };
}
