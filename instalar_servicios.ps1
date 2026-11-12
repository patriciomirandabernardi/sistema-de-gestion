# Zero-Touch Deployment Script for IMCAYPER
# Automatically detects paths and configures NSSM services

$ErrorActionPreference = "Stop"

# Dynamic path detection
$ProjectRoot = $PSScriptRoot
$BackendDir = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$LogsDir = Join-Path $ProjectRoot "logs"
$NssmPath = "C:\nssm\nssm.exe"

# Service names
$BackendService = "IMCAYPER_Backend"
$FrontendService = "IMCAYPER_Frontend"

# Ports (detected from project configuration)
$BackendPort = 8001
$FrontendPort = 5173

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Zero-Touch Deployment for IMCAYPER" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Validate paths
Write-Host "[1/7] Validating project structure..." -ForegroundColor Yellow
if (-not (Test-Path $BackendDir)) {
    throw "Backend directory not found: $BackendDir"
}
if (-not (Test-Path $FrontendDir)) {
    throw "Frontend directory not found: $FrontendDir"
}
if (-not (Test-Path $NssmPath)) {
    throw "NSSM not found at: $NssmPath. Please install NSSM to C:\nssm\"
}
Write-Host "Project structure validated." -ForegroundColor Green
Write-Host ""

# Create logs directory
Write-Host "[2/7] Creating logs directory..." -ForegroundColor Yellow
if (-not (Test-Path $LogsDir)) {
    New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
}
Write-Host "Logs directory created: $LogsDir" -ForegroundColor Green
Write-Host ""

# Stop and remove existing services
Write-Host "[3/7] Cleaning up existing services..." -ForegroundColor Yellow
& $NssmPath stop $BackendService 2>$null
& $NssmPath remove $BackendService confirm 2>$null
& $NssmPath stop $FrontendService 2>$null
& $NssmPath remove $FrontendService confirm 2>$null
Write-Host "Existing services cleaned up." -ForegroundColor Green
Write-Host ""

# Install Backend Service
Write-Host "[4/7] Installing Backend Service..." -ForegroundColor Yellow
$PythonVenv = Join-Path $BackendDir "venv\Scripts\python.exe"
if (-not (Test-Path $PythonVenv)) {
    throw "Python venv not found: $PythonVenv"
}

& $NssmPath install $BackendService $PythonVenv
& $NssmPath set $BackendService AppDirectory $BackendDir
& $NssmPath set $BackendService AppParameters "-m uvicorn main:app --host 0.0.0.0 --port $BackendPort"
& $NssmPath set $BackendService DisplayName "IMCAYPER Backend API"
& $NssmPath set $BackendService Description "FastAPI Backend for IMCAYPER Stock Management System"
& $NssmPath set $BackendService Start SERVICE_AUTO_START
& $NssmPath set $BackendService AppStdout (Join-Path $LogsDir "backend_stdout.log")
& $NssmPath set $BackendService AppStderr (Join-Path $LogsDir "backend_stderr.log")
& $NssmPath set $BackendService AppRotateFiles 1
& $NssmPath set $BackendService AppRotateBytes 1048576
Write-Host "Backend service installed on port $BackendPort." -ForegroundColor Green
Write-Host ""

# Install Frontend Service
Write-Host "[5/7] Installing Frontend Service..." -ForegroundColor Yellow
$NodePath = "node.exe"
$NpmPath = "npm.cmd"

# Check if frontend dist exists, if not build it
$DistDir = Join-Path $FrontendDir "dist"
if (-not (Test-Path $DistDir)) {
    Write-Host "Building frontend (dist not found)..." -ForegroundColor Yellow
    Push-Location $FrontendDir
    & $NpmPath run build
    Pop-Location
    if (-not (Test-Path $DistDir)) {
        throw "Frontend build failed. dist directory not created."
    }
}

& $NssmPath install $FrontendService $NpmPath
& $NssmPath set $FrontendService AppDirectory $FrontendDir
& $NssmPath set $FrontendService AppParameters "run preview -- --host --port $FrontendPort"
& $NssmPath set $FrontendService DisplayName "IMCAYPER Frontend Web"
& $NssmPath set $FrontendService Description "React/Vite Frontend for IMCAYPER Stock Management System"
& $NssmPath set $FrontendService Start SERVICE_AUTO_START
& $NssmPath set $FrontendService AppStdout (Join-Path $LogsDir "frontend_stdout.log")
& $NssmPath set $FrontendService AppStderr (Join-Path $LogsDir "frontend_stderr.log")
& $NssmPath set $FrontendService AppRotateFiles 1
& $NssmPath set $FrontendService AppRotateBytes 1048576
Write-Host "Frontend service installed on port $FrontendPort." -ForegroundColor Green
Write-Host ""

# Configure Firewall
Write-Host "[6/7] Configuring Windows Firewall..." -ForegroundColor Yellow
try {
    netsh advfirewall firewall add rule name="IMCAYPER Backend" dir=in action=allow protocol=TCP localport=$BackendPort 2>$null | Out-Null
    netsh advfirewall firewall add rule name="IMCAYPER Frontend" dir=in action=allow protocol=TCP localport=$FrontendPort 2>$null | Out-Null
    Write-Host "Firewall rules added for ports $BackendPort and $FrontendPort." -ForegroundColor Green
} catch {
    Write-Host "Warning: Could not configure firewall. Run as Administrator to enable network access." -ForegroundColor Yellow
}
Write-Host ""

# Start Services
Write-Host "[7/7] Starting services..." -ForegroundColor Yellow
& $NssmPath start $BackendService
Start-Sleep -Seconds 2
& $NssmPath start $FrontendService
Write-Host "Services started." -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Backend: http://localhost:$BackendPort" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:$FrontendPort" -ForegroundColor Cyan
Write-Host "Logs: $LogsDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "To manage services:" -ForegroundColor Yellow
Write-Host "  Start: nssm start $BackendService" -ForegroundColor White
Write-Host "  Stop: nssm stop $BackendService" -ForegroundColor White
Write-Host "  Status: nssm status $BackendService" -ForegroundColor White
Write-Host ""
Write-Host "To uninstall services:" -ForegroundColor Yellow
Write-Host "  nssm stop $BackendService" -ForegroundColor White
Write-Host "  nssm remove $BackendService confirm" -ForegroundColor White
Write-Host ""
