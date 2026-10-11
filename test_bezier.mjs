import * as THREE from 'three';

const startPos = new THREE.Vector3(25, 3, 0);
const finalCamPos = new THREE.Vector3(-25, 3, 0);

const midPos = startPos.clone().add(finalCamPos).multiplyScalar(0.5);
midPos.y += 20;
const centerDist = midPos.length();
if (centerDist < 25) {
    if (centerDist === 0) midPos.set(0, 1, 0);
    midPos.normalize().multiplyScalar(25);
}

for (let t = 0; t <= 1; t += 0.5) {
    const u = 1 - t;
    const x = u * u * startPos.x + 2 * u * t * midPos.x + t * t * finalCamPos.x;
    const y = u * u * startPos.y + 2 * u * t * midPos.y + t * t * finalCamPos.y;
    const z = u * u * startPos.z + 2 * u * t * midPos.z + t * t * finalCamPos.z;
    console.log(`t=${t} pos=`, {x,y,z});
}
