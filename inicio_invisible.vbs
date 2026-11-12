Set WshShell = CreateObject("WScript.Shell")

' Arrancar backend en modo invisible
WshShell.CurrentDirectory = "C:\Users\USUARIO\Desktop\PATRICIO\SISTEMAS\sistema-control-de-stock\backend"
WshShell.Run "venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8001", 0, False

' Esperar 2 segundos para que el backend inicie
WScript.Sleep 2000

' Arrancar frontend en modo invisible
WshShell.CurrentDirectory = "C:\Users\USUARIO\Desktop\PATRICIO\SISTEMAS\sistema-control-de-stock\frontend"
WshShell.Run "npm run dev -- --host", 0, False
