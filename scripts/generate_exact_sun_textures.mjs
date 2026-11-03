import fs from 'fs';
import { execSync } from 'child_process';

console.log("Generating seamless prominence texture...");

execSync("magick assets/sun_reference.jpg -depth 8 /tmp/sun_raw.rgba");
const raw = fs.readFileSync("/tmp/sun_raw.rgba");

const srcW = 1024, srcH = 696;
const cx = 512, cy = 340, R = 241;

function getPixel(x, y) {
    if (x < 0 || x >= srcW || y < 0 || y >= srcH) return [0, 0, 0, 0];
    const idx = (Math.floor(y) * srcW + Math.floor(x)) * 4;
    return [raw[idx], raw[idx+1], raw[idx+2], raw[idx+3]];
}

const pSize = 1024;
const pBuf = Buffer.alloc(pSize * pSize * 4);
const halfP = pSize / 2;
const scale = 256 / R;

for (let py = 0; py < pSize; py++) {
    for (let px = 0; px < pSize; px++) {
        const dx = (px - halfP) / scale;
        const dy = (py - halfP) / scale;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const srcX = cx + dx;
        const srcY = cy + dy;
        
        const [r, g, b] = getPixel(srcX, srcY);
        const pIdx = (py * pSize + px) * 4;
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        
        if (dist < R - 2) {
            // Inside sun sphere: transparent so 3D sphere renders through
            pBuf[pIdx] = 0;
            pBuf[pIdx+1] = 0;
            pBuf[pIdx+2] = 0;
            pBuf[pIdx+3] = 0;
        } else {
            // Smooth natural thresholding for coronal features and prominences
            if (lum <= 18 || dist > R + 95) {
                pBuf[pIdx] = 0;
                pBuf[pIdx+1] = 0;
                pBuf[pIdx+2] = 0;
                pBuf[pIdx+3] = 0;
            } else {
                // Smooth falloff based on brightness above noise floor
                const normLum = (lum - 18) / (255 - 18);
                const radialFade = Math.max(0, 1.0 - Math.pow((dist - R) / 95, 1.5));
                let alpha = Math.floor(Math.pow(normLum, 0.75) * 255 * radialFade);
                
                // Boost red-orange prominence prominence
                if (r > g * 1.15 && r > 30) {
                    alpha = Math.min(255, Math.floor(alpha * 1.5));
                }
                
                pBuf[pIdx] = r;
                pBuf[pIdx+1] = g;
                pBuf[pIdx+2] = b;
                pBuf[pIdx+3] = Math.min(255, Math.max(0, alpha));
            }
        }
    }
}

fs.writeFileSync("/tmp/prominences_smooth.rgba", pBuf);
execSync(`magick -size ${pSize}x${pSize} -depth 8 /tmp/prominences_smooth.rgba assets/sun_prominences_corona.png`);
console.log("✓ Seamless assets/sun_prominences_corona.png created!");
