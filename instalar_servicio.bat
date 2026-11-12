@echo off
REM Instala el servidor IMCAYPER como tarea de Windows que arranca con la PC.
REM Se auto-eleva (pide permiso de Administrador una sola vez).
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Solicitando permisos de administrador...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)
schtasks /create /tn "IMCAYPER-Servidor" /sc onstart /ru SYSTEM /rl highest /tr "\"%~dp0backend\servidor_imcayper.bat\"" /f
if %errorlevel% equ 0 (
    echo.
    echo [OK] Tarea "IMCAYPER-Servidor" instalada: el sistema arranca solo al prender la PC.
    echo      Para verificar: taskschd.msc  -^>  Biblioteca del Programador de Tareas
) else (
    echo.
    echo [ERROR] No se pudo crear la tarea.
)
echo.
pause
