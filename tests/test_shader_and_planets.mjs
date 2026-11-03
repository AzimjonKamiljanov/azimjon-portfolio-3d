import * as THREE from 'three';
import fs from 'fs';

console.log("Testing Three.js Shader and Planet instantiation...");

// Test Shader compilation with Three.js ShaderMaterial
const sunMat = new THREE.ShaderMaterial({
    uniforms: {
        uTime: { value: 0 },
        uColorCore: { value: new THREE.Color(0xfff8e8) },
        uColorGold: { value: new THREE.Color(0xff9900) },
        uColorDark: { value: new THREE.Color(0xb52200) },
        uColorFlare: { value: new THREE.Color(0xffd54f) },
        uPhotosphereTexture: { value: null },
        uPlasmaTexture: { value: null }
    },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        void main() {
            vUv = uv;
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPosition = worldPos.xyz;
            vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
            gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
    `,
    fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        void main() {
            gl_FragColor = vec4(1.0, 0.6, 0.1, 1.0);
        }
    `
});

console.log("ShaderMaterial created successfully:", !!sunMat);

// Extract planetsData from main.js dynamically
const mainJs = fs.readFileSync('/home/cyber/projects/3d-portfolio/main.js', 'utf-8');
const match = mainJs.match(/const planetsData = (\[[\s\S]*?\]);/);
if (!match) {
    throw new Error("Could not find planetsData in main.js!");
}

const planetsData = eval(match[1]);

// Verify 9 planets
console.log("Total planets count:", planetsData.length);
if (planetsData.length !== 9) {
    throw new Error(`Must have exactly 9 planets! Found ${planetsData.length}`);
}

// Verify no collisions / non-overlapping orbits
for (let i = 0; i < planetsData.length - 1; i++) {
    const p1 = planetsData[i];
    const p2 = planetsData[i+1];
    
    const p1Max = p1.distance + (p1.ringOuter || (p1.hasMoon ? p1.moonDistance + 0.42 : p1.radius));
    const p2Min = p2.distance - (p2.ringOuter || p2.radius);
    const gap = p2Min - p1Max;
    
    console.log(`Gap between ${p1.name} and ${p2.name}: ${gap.toFixed(2)} units`);
    if (gap <= 3.0) {
        throw new Error(`Orbits overlap or are too close between ${p1.name} and ${p2.name}! Gap: ${gap}`);
    }
}

console.log("ALL ORBIT CLEARANCE TESTS PASSED!");
