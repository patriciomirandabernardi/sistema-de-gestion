@echo off
REM Detiene SOLO el proceso que escucha en el puerto 8001 (servidor IMCAYPER).
REM No toca otros procesos de python/node (sistemas de Camiones y Mantenimiento).
echo Deteniendo el servidor IMCAYPER (puerto 8001)...
set "encontrado="
for /f "tokens=5" %%p in ('netstat -ano -p tcp ^| findstr "LISTENING" ^| findstr ":8001 "') do (
    taskkill /F /PID %%p
    set "encontrado=1"
)
if not defined encontrado echo El servidor no estaba corriendo.
echo Listo.
pause
