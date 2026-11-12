' Arranca el servidor IMCAYPER sin mostrar ventana (usado desde la carpeta Inicio de Windows)
CreateObject("Wscript.Shell").Run """" & CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & "\servidor_imcayper.bat""", 0, False
