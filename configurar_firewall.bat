@echo off
echo Configurando firewall de Windows para permitir conexiones al puerto 8001...
netsh advfirewall firewall add rule name="IMCAYPER Backend" dir=in action=allow protocol=TCP localport=8001
echo.
echo Regla de firewall agregada exitosamente.
echo.
pause
