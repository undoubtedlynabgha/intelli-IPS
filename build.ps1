<#
.SYNOPSIS
  One-click build script for Intelli IPS.
  Builds the Python backend exe, React frontend, and the Electron NSIS installer.

.USAGE
  Open PowerShell in the project root (a:\intelli IPS\) and run:
    .\build.ps1

  Optional flags:
    -SkipBackend   Skip PyInstaller step (use existing backend\dist\ips_backend.exe)
    -SkipFrontend  Skip Vite build step (use existing dist\)

.NOTES
  Prerequisites:
    - Node.js + npm  (for Electron / Vite)
    - Python 3.9+    (for PyInstaller)
    - pip install pyinstaller scikit-learn fastapi uvicorn pydantic numpy
#>

param(
    [switch]$SkipBackend,
    [switch]$SkipFrontend
)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "   INTELLI IPS -- FULL BUILD PIPELINE" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""

# --- 1. Verify .env.local has the API key ------------------------------------
Write-Host "[ 1/5 ] Checking .env.local for GROQ_API_KEY..." -ForegroundColor Yellow

$envFile = Join-Path $PSScriptRoot ".env.local"
if (-not (Test-Path $envFile)) {
    Write-Host "  [!] .env.local not found. Creating a template..." -ForegroundColor Red
    Set-Content -Path $envFile -Value "GROQ_API_KEY=YOUR_KEY_HERE"
    Write-Host ""
    Write-Host "  ACTION REQUIRED: Open .env.local and replace YOUR_KEY_HERE with" -ForegroundColor Red
    Write-Host "  your real Groq API key from https://console.groq.com/keys" -ForegroundColor Red
    Write-Host "  Then re-run this script." -ForegroundColor Red
    exit 1
}

$envContent = Get-Content $envFile -Raw
if ($envContent -notmatch "GROQ_API_KEY\s*=\s*[A-Za-z0-9_\-]{10,}") {
    Write-Host "  [!] GROQ_API_KEY appears to be missing or invalid in .env.local" -ForegroundColor Red
    Write-Host "  Get your key from: https://console.groq.com/keys" -ForegroundColor Red
    Write-Host "  The app will build but Groq AI features will not work." -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host "  [OK] GROQ_API_KEY found in .env.local" -ForegroundColor Green
}

# --- 2. Build Python backend with PyInstaller ---------------------------------
if (-not $SkipBackend) {
    Write-Host ""
    Write-Host "[ 2/5 ] Building Python backend (PyInstaller)..." -ForegroundColor Yellow

    $backendDir = Join-Path $PSScriptRoot "backend"
    Set-Location $backendDir

    # Prefer venv python
    $pythonExe = "python"
    $venvPython = Join-Path $backendDir "venv\Scripts\python.exe"
    if (Test-Path $venvPython) {
        $pythonExe = $venvPython
        Write-Host "  Using venv Python: $pythonExe" -ForegroundColor DarkGray
    }

    # Install / upgrade pyinstaller in case it's missing
    Write-Host "  Installing/upgrading PyInstaller..." -ForegroundColor DarkGray
    & $pythonExe -m pip install --quiet --upgrade pyinstaller 2>&1 | Out-Null

    # Clean previous build artifacts
    if (Test-Path "build") { Remove-Item -Recurse -Force "build" }
    if (Test-Path "dist")  { Remove-Item -Recurse -Force "dist" }

    Write-Host "  Running PyInstaller..." -ForegroundColor DarkGray
    & $pythonExe -m PyInstaller ips_backend.spec --clean --noconfirm

    $exePath = Join-Path $backendDir "dist\ips_backend.exe"
    if (-not (Test-Path $exePath)) {
        Write-Host "  [FAIL] PyInstaller FAILED -- ips_backend.exe not found at:" -ForegroundColor Red
        Write-Host "     $exePath" -ForegroundColor Red
        exit 1
    }

    $exeSizeMB = [math]::Round((Get-Item $exePath).Length / 1MB, 1)
    Write-Host "  [OK] Backend built successfully ($exeSizeMB MB): $exePath" -ForegroundColor Green
    Set-Location $PSScriptRoot
} else {
    Write-Host "[ 2/5 ] Skipping backend build (-SkipBackend flag)" -ForegroundColor DarkGray
}

# --- 3. Verify backend exe exists --------------------------------------------
Write-Host ""
Write-Host "[ 3/5 ] Verifying backend executable..." -ForegroundColor Yellow
$backendExe = Join-Path $PSScriptRoot "backend\dist\ips_backend.exe"
if (-not (Test-Path $backendExe)) {
    Write-Host "  [FAIL] backend\dist\ips_backend.exe not found!" -ForegroundColor Red
    Write-Host "     Run without -SkipBackend to build it first." -ForegroundColor Red
    exit 1
}
Write-Host "  [OK] Backend exe verified." -ForegroundColor Green

# --- 4. Build the React/Vite frontend ----------------------------------------
if (-not $SkipFrontend) {
    Write-Host ""
    Write-Host "[ 4/5 ] Building React frontend (Vite)..." -ForegroundColor Yellow

    & npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [FAIL] Vite build failed." -ForegroundColor Red
        exit 1
    }
    Write-Host "  [OK] Frontend built into dist\" -ForegroundColor Green
} else {
    Write-Host "[ 4/5 ] Skipping frontend build (-SkipFrontend flag)" -ForegroundColor DarkGray
}

# --- 5. Package with Electron Builder (NSIS installer) -----------------------
Write-Host ""
Write-Host "[ 5/5 ] Packaging Electron app (NSIS installer)..." -ForegroundColor Yellow
& npm run electron:build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [FAIL] Electron build failed." -ForegroundColor Red
    exit 1
}

# --- Done --------------------------------------------------------------------
Write-Host ""
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "   BUILD COMPLETE" -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green

$releaseDir = Join-Path $PSScriptRoot "release"
$installers = Get-ChildItem -Path $releaseDir -Filter "*.exe" -ErrorAction SilentlyContinue
if ($installers) {
    Write-Host ""
    Write-Host "  Installer(s) ready in: $releaseDir" -ForegroundColor Cyan
    foreach ($ins in $installers) {
        $insSizeMB = [math]::Round($ins.Length / 1MB, 1)
        Write-Host "    >> $($ins.Name)  ($insSizeMB MB)" -ForegroundColor Cyan
    }
} else {
    Write-Host "  Output directory: $releaseDir" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "  The installer will auto-launch Intelli IPS after installation." -ForegroundColor DarkGray
Write-Host "  The backend (ips_backend.exe) starts automatically in the background." -ForegroundColor DarkGray
Write-Host ""
