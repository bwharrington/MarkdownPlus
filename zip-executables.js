const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const releaseDir = path.join(__dirname, 'release');
const outputZip = path.join(releaseDir, 'MarkdownPlus-Installers.zip');

// Find all .exe files in the release folder
const exeFiles = fs.readdirSync(releaseDir)
  .filter(file => file.endsWith('.exe'))
  .map(file => path.join(releaseDir, file));

if (exeFiles.length === 0) {
  console.log('No .exe files found in release folder');
  process.exit(0);
}

console.log(`Found ${exeFiles.length} .exe file(s) to zip:`);
exeFiles.forEach(file => console.log(`  - ${path.basename(file)}`));

// Remove existing zip if it exists
if (fs.existsSync(outputZip)) {
  fs.unlinkSync(outputZip);
  console.log('Removed existing zip file');
}

// Create PowerShell command to zip the files
const filesList = exeFiles.map(f => `"${f}"`).join(',');
const psCommand = `Compress-Archive -Path ${filesList} -DestinationPath "${outputZip}"`;

try {
  execSync(psCommand, { 
    stdio: 'inherit',
    shell: 'powershell.exe'
  });
  console.log(`\nSuccessfully created: ${path.basename(outputZip)}`);
} catch (error) {
  console.error('Error creating zip file:', error.message);
  process.exit(1);
}
