@echo off
REM Servidor de produccion IMCAYPER: API + frontend compilado en el puerto 8001.
REM Usado por la tarea programada "IMCAYPER-Servidor" (arranca con Windows).
cd /d "%~dp0"
if not exist logs mkdir logs
echo === Inicio %date% %time% === >> logs\imcayper-servidor.log
venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8001 >> logs\imcayper-servidor.log 2>&1
echo === Detenido %date% %time% (codigo %errorlevel%) === >> logs\imcayper-servidor.log
