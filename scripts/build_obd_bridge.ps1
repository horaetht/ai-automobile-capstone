<#
.SYNOPSIS
    Builds the Online Garage OBD Bridge Windows tray app with PyInstaller.

.DESCRIPTION
    Uses the committed obd_reader/OnlineGarageOBDBridge.spec file for a
    deterministic, windowed (no console), onedir build. Removes previous
    build/dist output under obd_reader/ first, then runs PyInstaller.
    Does not launch or install the resulting executable.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts/build_obd_bridge.ps1
#>

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ObdReaderDir = Join-Path $RepoRoot 'obd_reader'
$SpecFile = Join-Path $ObdReaderDir 'OnlineGarageOBDBridge.spec'
$AppName = 'OnlineGarageOBDBridge'

if (-not (Test-Path $SpecFile)) {
    throw "Spec file not found: $SpecFile"
}

# Prefer the project's own virtual environment if one exists, so this
# script doesn't depend on global PATH/interpreter state.
$VenvPython = Join-Path $RepoRoot '.venv\Scripts\python.exe'
if (Test-Path $VenvPython) {
    $PythonExe = $VenvPython
} else {
    $PythonExe = 'python'
}

Write-Host "Using Python: $PythonExe"

& $PythonExe -m PyInstaller --version *> $null
if ($LASTEXITCODE -ne 0) {
    throw "PyInstaller is not available for $PythonExe. Install build dependencies first:`n  $PythonExe -m pip install -r requirements.txt -r requirements-build.txt"
}

$DistDir = Join-Path $ObdReaderDir 'dist'
$BuildDir = Join-Path $ObdReaderDir 'build'

foreach ($dir in @($DistDir, $BuildDir)) {
    if (Test-Path $dir) {
        Write-Host "Removing previous build output: $dir"
        Remove-Item -Recurse -Force $dir
    }
}

Push-Location $ObdReaderDir
try {
    Write-Host 'Running PyInstaller...'
    & $PythonExe -m PyInstaller --noconfirm $SpecFile
    if ($LASTEXITCODE -ne 0) {
        throw "PyInstaller build failed (exit code $LASTEXITCODE)."
    }
}
finally {
    Pop-Location
}

$ExePath = Join-Path $DistDir "$AppName\$AppName.exe"
if (-not (Test-Path $ExePath)) {
    throw "Build completed but the expected executable was not found: $ExePath"
}

Write-Host ''
Write-Host 'Build succeeded.'
Write-Host "Executable: $ExePath"
