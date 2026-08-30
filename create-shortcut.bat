@echo off
title Creating Desktop Shortcut...
echo.
echo  ========================================
echo   Secure Media Vault - Shortcut Creator
echo  ========================================
echo.

set "APP_NAME=Secure Media Vault"
set "SCRIPT_DIR=%~dp0"
set "DESKTOP=%USERPROFILE%\Desktop"
set "VBS_LAUNCHER=%SCRIPT_DIR%launcher.vbs"
set "ICO_FILE=%SCRIPT_DIR%resources\icons\app.ico"

:: Check if icon exists
if not exist "%ICO_FILE%" (
    echo  [!] Icon file not found at: %ICO_FILE%
    echo      The shortcut will use a default icon.
    set "ICO_FILE="
)

:: Create the VBS script to make shortcut
echo  [*] Creating desktop shortcut...

(
echo Set WshShell = CreateObject^("WScript.Shell"^)
echo Set fso = CreateObject^("Scripting.FileSystemObject"^)
echo.
echo desktopPath = WshShell.SpecialFolders^("Desktop"^)
echo.
echo Set shortcut = WshShell.CreateShortcut^(desktopPath ^& "\%APP_NAME%.lnk"^)
echo shortcut.TargetPath = "%VBS_LAUNCHER%"
echo shortcut.WorkingDirectory = "%SCRIPT_DIR%"
echo shortcut.Description = "Secure Media Vault - Encrypted Media Downloader"
if defined ICO_FILE (
echo shortcut.IconLocation = "%ICO_FILE%,0"
)
echo shortcut.WindowStyle = 7
echo shortcut.Save
echo.
echo WScript.Echo "Desktop shortcut created successfully!"
) > "%TEMP%\create_shortcut.vbs"

:: Run the VBS script
cscript //nologo "%TEMP%\create_shortcut.vbs"
if %errorlevel% equ 0 (
    echo.
    echo  [OK] Shortcut created on Desktop!
    echo.
    echo  ========================================
    echo   You can now double-click "%APP_NAME%"
    echo   on your Desktop to launch the app.
    echo   No console window will appear.
    echo  ========================================
) else (
    echo.
    echo  [ERROR] Failed to create shortcut.
)

echo.
pause
