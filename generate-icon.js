const { Jimp } = require('jimp');
const path = require('path');
const fs = require('fs');

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
    
  } catch (error) {
    console.error('Error generating icon:');
    console.error(error.message || error);
  }
}

generateIcon();
