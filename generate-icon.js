const sharp = require('sharp');
const fs = require('fs');

// ICO file format constants
const ICO_HEADER_SIZE = 6;
const ICO_DIR_ENTRY_SIZE = 16;
const OUTPUT_DIR = 'assets';
const SOURCE_SVG = `${OUTPUT_DIR}/markdown-nexus.svg`;
const BRAND_PNG = `${OUTPUT_DIR}/markdown-nexus.png`;
const APP_ICON_PNG = `${OUTPUT_DIR}/icon.png`;
const PADDED_ICON_PNG = `${OUTPUT_DIR}/icon-padded.png`;
const ICO_OUTPUT = `${OUTPUT_DIR}/icon.ico`;
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

async function assertImageSize(filePath, expectedWidth, expectedHeight) {
  const metadata = await sharp(filePath).metadata();
  if (metadata.width !== expectedWidth || metadata.height !== expectedHeight) {
    throw new Error(
      `Invalid dimensions for ${filePath}. ` +
      `Expected ${expectedWidth}x${expectedHeight}, got ${metadata.width}x${metadata.height}.`
    );
  }
}

async function generateIcon() {
  try {
    if (!fs.existsSync(SOURCE_SVG)) {
      throw new Error(`Source SVG not found at ${SOURCE_SVG}`);
    }

    const svgBuffer = fs.readFileSync(SOURCE_SVG);
    console.log(`Using source SVG: ${SOURCE_SVG}`);

    // Generate high-res brand PNG for docs/marketing and renderer usage fallback.
    await sharp(svgBuffer)
      .resize(1024, 1024)
      .png()
      .toFile(BRAND_PNG);
    console.log(`Created ${BRAND_PNG} (1024x1024)`);

    // Generate unpadded app icon (used at runtime on non-Windows).
    await sharp(svgBuffer)
      .resize(512, 512)
      .png()
      .toFile(APP_ICON_PNG);
    console.log(`Created ${APP_ICON_PNG} (512x512)`);

    // Generate padded icon for packaging/file associations.
    const paddedCanvasSize = 256;
    // Keep a small margin to avoid edge clipping at 16x16 while remaining bold.
    const padding = 10;
    const innerSize = paddedCanvasSize - (padding * 2);
    const innerPng = await sharp(svgBuffer)
      .resize(innerSize, innerSize)
      .png()
      .toBuffer();

    await sharp({
      create: {
        width: paddedCanvasSize,
        height: paddedCanvasSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: innerPng, left: padding, top: padding }])
      .png()
      .toFile(PADDED_ICON_PNG);
    console.log(`Created ${PADDED_ICON_PNG} (256x256 with ${padding}px padding)`);

    // Generate multiple sizes for ICO file from padded icon.
    const pngBuffers = [];
    console.log(`Generating ICO file with sizes: ${ICO_SIZES.join(', ')}`);
    for (const icoSize of ICO_SIZES) {
      const pngBuffer = await sharp(PADDED_ICON_PNG)
        .resize(icoSize, icoSize)
        .png()
        .toBuffer();
      pngBuffers.push({ size: icoSize, buffer: pngBuffer });
      console.log(`  Generated ${icoSize}x${icoSize} icon`);
    }

    const icoBuffer = buildIcoFile(pngBuffers);
    fs.writeFileSync(ICO_OUTPUT, icoBuffer);
    console.log(`Created ${ICO_OUTPUT}`);

    // Validate core output dimensions before packaging.
    await assertImageSize(BRAND_PNG, 1024, 1024);
    await assertImageSize(APP_ICON_PNG, 512, 512);
    await assertImageSize(PADDED_ICON_PNG, 256, 256);
    console.log('Icon output validation passed.');
  } catch (error) {
    console.error('Error generating icon:');
    console.error(error.message || error);
    process.exitCode = 1;
  }
}

function buildIcoFile(pngBuffers) {
  const numImages = pngBuffers.length;
  
  // Calculate total size
  let totalSize = ICO_HEADER_SIZE + (numImages * ICO_DIR_ENTRY_SIZE);
  for (const { buffer } of pngBuffers) {
    totalSize += buffer.length;
  }
  
  const icoBuffer = Buffer.alloc(totalSize);
  let offset = 0;
  
  // ICO Header
  icoBuffer.writeUInt16LE(0, offset); // Reserved, must be 0
  offset += 2;
  icoBuffer.writeUInt16LE(1, offset); // Image type: 1 = ICO
  offset += 2;
  icoBuffer.writeUInt16LE(numImages, offset); // Number of images
  offset += 2;
  
  // Calculate where image data starts
  let imageDataOffset = ICO_HEADER_SIZE + (numImages * ICO_DIR_ENTRY_SIZE);
  
  // ICO Directory Entries
  for (const { size, buffer } of pngBuffers) {
    icoBuffer.writeUInt8(size < 256 ? size : 0, offset); // Width (0 means 256)
    offset += 1;
    icoBuffer.writeUInt8(size < 256 ? size : 0, offset); // Height (0 means 256)
    offset += 1;
    icoBuffer.writeUInt8(0, offset); // Color palette (0 = no palette)
    offset += 1;
    icoBuffer.writeUInt8(0, offset); // Reserved
    offset += 1;
    icoBuffer.writeUInt16LE(1, offset); // Color planes
    offset += 2;
    icoBuffer.writeUInt16LE(32, offset); // Bits per pixel
    offset += 2;
    icoBuffer.writeUInt32LE(buffer.length, offset); // Size of image data
    offset += 4;
    icoBuffer.writeUInt32LE(imageDataOffset, offset); // Offset to image data
    offset += 4;
    
    imageDataOffset += buffer.length;
  }
  
  // Image Data
  for (const { buffer } of pngBuffers) {
    buffer.copy(icoBuffer, offset);
    offset += buffer.length;
  }
  
  return icoBuffer;
}

generateIcon();
