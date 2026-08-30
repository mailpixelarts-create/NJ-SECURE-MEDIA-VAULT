' Secure Media Vault - Silent Launcher
' Runs the Electron app without showing a console window

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Check for built unpacked exe
exePath = scriptDir & "\release\win-unpacked\Secure Media Vault.exe"

If fso.FileExists(exePath) Then
    WshShell.Run """" & exePath & """", 0, False
Else
    ' Run via electron in dev mode (hidden)
    WshShell.Run "cmd.exe /c cd """ & scriptDir & """ && npx electron .", 0, False
End If

Set WshShell = Nothing
Set fso = Nothing
