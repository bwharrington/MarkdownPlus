# Stop any running Nexus instance before building/installing
$process = Get-Process -Name "Nexus" -ErrorAction SilentlyContinue
if ($process) {
    Write-Host "Stopping running Nexus instance..."
    $process | Stop-Process -Force
    Start-Sleep -Seconds 1
}

Write-Host "Building..."
npm run package
if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed (exit code $LASTEXITCODE)"
    exit $LASTEXITCODE
}

$installer = Join-Path $PSScriptRoot "release\Nexus-Setup.exe"
Write-Host "Launching installer: $installer"
Start-Process -FilePath $installer
