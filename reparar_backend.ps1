# Fix Backend Service Configuration
$ErrorActionPreference = "Stop"

# Check for Administrator privileges
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "Este script requiere privilegios de Administrador." -ForegroundColor Red
    Write-Host "Reiniciando con privilegios elevados..." -ForegroundColor Yellow
    Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

$ProjectRoot = $PSScriptRoot
$BackendDir = Join-Path $ProjectRoot "backend"
$NssmPath = "C:\nssm\nssm.exe"
$BackendService = "IMCAYPER_Backend"

Write-Host "Reparando configuración del servicio Backend..." -ForegroundColor Yellow

# Stop service
Write-Host "Deteniendo servicio..." -ForegroundColor Yellow
& $NssmPath stop $BackendService

# Correct AppDirectory
Write-Host "Configurando AppDirectory correcto..." -ForegroundColor Yellow
& $NssmPath set $BackendService AppDirectory $BackendDir

# Verify configuration
Write-Host "Verificando configuración..." -ForegroundColor Yellow
$CurrentDir = & $NssmPath get $BackendService AppDirectory
Write-Host "AppDirectory actual: $CurrentDir" -ForegroundColor Cyan

# Start service
Write-Host "Iniciando servicio..." -ForegroundColor Yellow
& $NssmPath start $BackendService

# Check status
Start-Sleep -Seconds 3
$Status = & $NssmPath status $BackendService
Write-Host "Estado del servicio: $Status" -ForegroundColor Cyan

if ($Status -eq "SERVICE_RUNNING") {
    Write-Host "Backend corriendo correctamente." -ForegroundColor Green
} else {
    Write-Host "Error: Backend no pudo iniciarse. Revisa los logs en $ProjectRoot\logs" -ForegroundColor Red
}
