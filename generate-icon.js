const { Jimp } = require('jimp');
const path = require('path');
const fs = require('fs');

// ICO file format constants
const ICO_HEADER_SIZE = 6;
const ICO_DIR_ENTRY_SIZE = 16;

async function generateIcon() {
  try {
    // Read the original PNG
    const img = await Jimp.read('assets/MarkdownPlus.png');
    console.log('Original dimensions:', img.bitmap.width, 'x', img.bitmap.height);
    
    // Create a new image with padding (256x256 is a good size for Windows icons)
    const size = 256;
    const padding = 48; // Add generous padding around the icon
    
    // Create a transparent background
    const paddedImg = new Jimp({width: size, height: size, color: 0x00000000});
    
    // Calculate the size for the inner image (with padding)
    const innerSize = size - (padding * 2);
    
    // Resize the original image to fit within the padded area
    const resized = await img.clone().scaleToFit({w: innerSize, h: innerSize});
    
    // Center the image
    const x = Math.floor((size - resized.bitmap.width) / 2);
    const y = Math.floor((size - resized.bitmap.height) / 2);
    
    // Composite the resized image onto the padded background
    paddedImg.composite(resized, x, y);
    
    // Save the padded version
    await paddedImg.write('assets/MarkdownPlus-padded.png');
    console.log('Created padded icon: assets/MarkdownPlus-padded.png');
    console.log('New dimensions: 256x256 with padding');

    // Generate multiple sizes for ICO file
    const icoSizes = [16, 24, 32, 48, 64, 128, 256];
    const pngBuffers = [];

    console.log('Generating ICO file with multiple resolutions...');
    
    for (const icoSize of icoSizes) {
      const scaledImg = paddedImg.clone().resize({w: icoSize, h: icoSize});
      const pngBuffer = await scaledImg.getBuffer('image/png');
      pngBuffers.push({ size: icoSize, buffer: pngBuffer });
      console.log(`  Generated ${icoSize}x${icoSize} icon`);
    }

    // Build ICO file
    const icoBuffer = buildIcoFile(pngBuffers);
    fs.writeFileSync('assets/icon.ico', icoBuffer);
    console.log('Created ICO file: assets/icon.ico');
    
  } catch (error) {
    console.error('Error generating icon:');
    console.error(error.message || error);
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
