@echo off
REM Arranque manual del servidor de produccion IMCAYPER (puerto 8001, API + frontend).
REM Los logs quedan en backend\logs\imcayper-servidor.log
start "IMCAYPER Servidor" /min "%~dp0backend\servidor_imcayper.bat"
echo Servidor IMCAYPER iniciado. URL: http://140.191.1.137:8001
pause
