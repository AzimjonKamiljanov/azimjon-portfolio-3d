import fs from 'fs';
import { execSync } from 'child_process';

console.log("Generating completely continuous square prominences...");

execSync("magick assets/sun_disk_square.jpg -depth 8 /tmp/disk_square.rgba");
const raw = fs.readFileSync("/tmp/disk_square.rgba");

const W = 1024, H = 1024;
const cx = 512, cy = 512, R = 482;

const outBuf = Buffer.alloc(W * H * 4);

for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const idx = (y * W + x) * 4;
        const r = raw[idx];
        const g = raw[idx+1];
        const b = raw[idx+2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        
        if (dist < R - 4) {
            // Inside sun sphere: transparent so 3D sphere renders
            outBuf[idx] = 0;
            outBuf[idx+1] = 0;
            outBuf[idx+2] = 0;
            outBuf[idx+3] = 0;
        } else if (dist < R + 2) {
            // Smooth transition at limb
            const fade = (dist - (R - 4)) / 6;
            outBuf[idx] = r;
            outBuf[idx+1] = g;
            outBuf[idx+2] = b;
            outBuf[idx+3] = Math.min(255, Math.floor(lum * 0.9 * fade));
        } else if (dist <= R + 90 && lum > 18) {
            // Outside limb: continuous smooth falloff
            const normLum = (lum - 18) / (255 - 18);
            const radialFade = Math.max(0, 1.0 - Math.pow((dist - R) / 90, 1.4));
            let alpha = Math.floor(Math.pow(normLum, 0.70) * 255 * radialFade);
            
            // Boost coronal loop contrast at top-left quadrant
            if (dx < -30 && dy < -30 && r > g * 1.1) {
                alpha = Math.min(255, Math.floor(alpha * 1.5));
            }
            
            outBuf[idx] = r;
            outBuf[idx+1] = g;
            outBuf[idx+2] = b;
            outBuf[idx+3] = Math.min(255, Math.max(0, alpha));
        } else {
            outBuf[idx] = 0;
            outBuf[idx+1] = 0;
            outBuf[idx+2] = 0;
            outBuf[idx+3] = 0;
        }
    }
}

fs.writeFileSync("/tmp/prominences_continuous.rgba", outBuf);
execSync(`magick -size ${W}x${H} -depth 8 /tmp/prominences_continuous.rgba assets/sun_prominences_exact.png`);
console.log("✓ Created seamless continuous assets/sun_prominences_exact.png!");
