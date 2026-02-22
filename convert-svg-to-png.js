const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const INPUT = path.join('assets', 'markdown-nexus.svg');
const OUTPUT = path.join('assets', 'markdown-nexus.png');

async function convert() {
  if (!fs.existsSync(INPUT)) {
    console.error(`Source SVG not found: ${INPUT}`);
    process.exitCode = 1;
    return;
  }

  const svgBuffer = fs.readFileSync(INPUT);

  await sharp(svgBuffer)
    .resize(1024, 1024)
    .png()
    .toFile(OUTPUT);

  const stats = fs.statSync(OUTPUT);
  console.log(`Created ${OUTPUT} (1024x1024, ${(stats.size / 1024).toFixed(1)} KB)`);
}

convert().catch(err => {
  console.error('Conversion failed:', err.message || err);
  process.exitCode = 1;
});
