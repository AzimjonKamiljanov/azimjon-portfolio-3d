import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const assetsDir = path.resolve("assets");
const files = fs.readdirSync(assetsDir);

console.log("Optimizing audio...");
const mp3Path = path.join(assetsDir, "space_ambient.mp3");
if (fs.existsSync(mp3Path)) {
  const tmpMp3 = "/tmp/space_ambient_opt.mp3";
  execSync(`ffmpeg -y -i "${mp3Path}" -b:a 64k "${tmpMp3}"`, {
    stdio: "ignore",
  });
  const beforeSize = fs.statSync(mp3Path).size;
  const afterSize = fs.statSync(tmpMp3).size;
  fs.copyFileSync(tmpMp3, mp3Path);
  console.log(
    `✓ Audio compressed: ${(beforeSize / 1024 / 1024).toFixed(2)} MB -> ${(afterSize / 1024 / 1024).toFixed(2)} MB`,
  );
}

console.log("Converting textures to modern WebP format...");
let totalSavedBytes = 0;

for (const file of files) {
  if (file.endsWith(".jpg") || file.endsWith(".png")) {
    const inputPath = path.join(assetsDir, file);
    const webpName = file.replace(/\.(jpg|png)$/, ".webp");
    const outputPath = path.join(assetsDir, webpName);

    try {
      // Quality 82 provides virtually lossless visual fidelity for 3D textures
      execSync(`ffmpeg -y -i "${inputPath}" -q:v 82 "${outputPath}"`, {
        stdio: "ignore",
      });
      if (fs.existsSync(outputPath)) {
        const inSize = fs.statSync(inputPath).size;
        const outSize = fs.statSync(outputPath).size;
        totalSavedBytes += inSize - outSize;
        console.log(
          `  ${file} (${(inSize / 1024).toFixed(0)}KB) -> ${webpName} (${(outSize / 1024).toFixed(0)}KB)`,
        );
      }
    } catch (e) {
      console.error(`Failed to convert ${file}:`, e.message);
    }
  }
}

console.log(
  `✓ Texture optimization complete! Saved ${(totalSavedBytes / 1024 / 1024).toFixed(2)} MB.`,
);
