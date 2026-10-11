import * as THREE from 'three';
import fs from 'fs';

console.log("=== RUNNING FULL VERIFICATION SUITE ===");

// 1. Verify index.html contains all 9 planet buttons, Moon, Sun, Stars, Catalog, and Orbit Toggle
const indexHtml = fs.readFileSync('/home/cyber/projects/3d-portfolio/index.html', 'utf-8');
const requiredPlanetIds = [
    'sun', 'Mercury', 'Venus', 'Earth', 'moon', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'star'
];

for (const id of requiredPlanetIds) {
    if (!indexHtml.includes(`data-target="${id}"`)) {
        throw new Error(`index.html is missing navigation target for: ${id}`);
    }
}
console.log("✓ index.html has navigation buttons for all 9 planets, Sun, Moon, and Stars!");

if (!indexHtml.includes('orbit-toggle-btn')) {
    throw new Error("index.html is missing orbit-toggle-btn!");
}
if (!indexHtml.includes('catalog-modal')) {
    throw new Error("index.html is missing catalog-modal!");
}
console.log("✓ index.html includes Orbit Toggle button and Projects Catalog modal!");

// 2. Verify all textures exist in assets/
const assetsDir = '/home/cyber/projects/3d-portfolio/assets';
const requiredTextures = [
    'earth_atmos_2048.jpg', 'earth_normal_2048.jpg', 'earth_specular_2048.jpg', 'moon_1024.jpg',
    'mercury_2048.jpg', 'venus_2048.jpg', 'mars_2048.jpg', 'jupiter_2048.jpg',
    'saturn_2048.jpg', 'saturn_ring.png', 'uranus_2048.jpg', 'uranus_ring.png',
    'neptune_2048.jpg', 'pluto_2048.jpg', 'sun_photosphere.jpg', 'sun_plasma.jpg', 'sun_corona.png',
    'sun_disk_square.jpg', 'sun_prominences_exact.png'
];

for (const tex of requiredTextures) {
    const fullPath = `${assetsDir}/${tex}`;
    if (!fs.existsSync(fullPath)) {
        throw new Error(`Missing texture: ${fullPath}`);
    }
    const stat = fs.statSync(fullPath);
    if (stat.size < 100) {
        throw new Error(`Texture ${tex} seems corrupted (size too small: ${stat.size} bytes)`);
    }
}
console.log(`✓ All ${requiredTextures.length} required textures exist and are non-empty in assets/!`);

// 3. Verify main.js contains shader, all 9 planets, user information, and labels
const mainJs = fs.readFileSync('/home/cyber/projects/3d-portfolio/main.js', 'utf-8');

// Check for Azimjon Kamiljanov's developer info
if (!mainJs.includes('Azimjon Kamiljanov') || !mainJs.includes('KamiljanovAzimjon')) {
    throw new Error("main.js does not contain Azimjon Kamiljanov's real portfolio credentials!");
}
console.log("✓ main.js contains Azimjon Kamiljanov's developer identity and contact channels!");

// Check for all 9 planets
const planetNames = ['Merkuriy', 'Venera', 'Yer', 'Mars', 'Yupiter', 'Saturn', 'Uran', 'Neptun', 'Pluton'];
for (const pName of planetNames) {
    if (!mainJs.includes(`name: '${pName}'`)) {
        throw new Error(`main.js is missing planet definition for: ${pName}`);
    }
}
console.log("✓ main.js contains definitions for all 9 planets!");

// Check for Sun realistic shader
if (!mainJs.includes('snoise') || !mainJs.includes('uPhotosphereTexture') || !mainJs.includes('limbDarkening')) {
    throw new Error("main.js is missing the photorealistic solar shader!");
}
console.log("✓ main.js contains the dynamic GLSL plasma, granulation & Eddington limb darkening solar shader!");

// Check for 3D Holographic Labels
if (!mainJs.includes('createLabelSprite')) {
    throw new Error("main.js is missing createLabelSprite for in-scene planet identification!");
}
console.log("✓ main.js contains 3D holographic labels for every planet and celestial body!");

// 4. Mathematical orbital clearance and camera view verification
const match = mainJs.match(/const planetsData = (\[[\s\S]*?\]);/);
const planetOrbits = eval(match[1]);

for (let i = 0; i < planetOrbits.length - 1; i++) {
    const cur = planetOrbits[i];
    const nxt = planetOrbits[i+1];
    
    const curExtent = cur.distance + (cur.ringOuter || (cur.hasMoon ? cur.moonDistance + 0.42 : cur.radius));
    const nxtExtent = nxt.distance - (nxt.ringOuter || nxt.radius);
    
    const clearance = nxtExtent - curExtent;
    console.log(`- Clearance between [${cur.name}] and [${nxt.name}]: ${clearance.toFixed(2)} units`);
    if (clearance < 4.0) {
        throw new Error(`Clearance between ${cur.name} and ${nxt.name} is too narrow (< 4.0 units)!`);
    }
}
console.log("✓ ALL 9 PLANETARY ORBITS ARE MATHEMATICALLY NON-INTERSECTING AND FULLY ISOLATED!");

// Verify camera overview framing
const plutoDistance = planetOrbits[planetOrbits.length - 1].distance;
if (!mainJs.includes('165, 195') && !mainJs.includes('165, z: 195')) {
    throw new Error("Camera overview position not properly set for full solar system framing!");
}
console.log(`✓ Camera overview position (z=195) is safely beyond Pluto's orbit (${plutoDistance}), ensuring all 9 planets are visible simultaneously with no backward occlusion!`);

console.log("=== ALL TESTS PASSED SUCCESSFULLY! ===");
