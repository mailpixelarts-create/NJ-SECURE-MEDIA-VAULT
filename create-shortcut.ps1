# Secure Media Vault - Desktop Shortcut Creator (PowerShell)
# Run this script to create a desktop shortcut with icon

$ErrorActionPreference = "Stop"

$AppName = "Secure Media Vault"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$VbsLauncher = Join-Path $ScriptDir "launcher.vbs"
$IconPath = Join-Path $ScriptDir "resources\icons\app.ico"

Write-Host ""
Write-Host "  =========================================" -ForegroundColor Cyan
Write-Host "   Secure Media Vault - Shortcut Creator" -ForegroundColor Cyan
Write-Host "  =========================================" -ForegroundColor Cyan
Write-Host ""

# Verify launcher exists
if (-not (Test-Path $VbsLauncher)) {
    Write-Host "  [ERROR] launcher.vbs not found at: $VbsLauncher" -ForegroundColor Red
    exit 1
}

# Create shortcut using WScript
$WshShell = New-Object -ComObject WScript.Shell
$ShortcutPath = Join-Path $DesktopPath "$AppName.lnk"
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)

$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = "`"$VbsLauncher`""
$Shortcut.WorkingDirectory = $ScriptDir
$Shortcut.Description = "Secure Media Vault - Encrypted Media Downloader"
$Shortcut.WindowStyle = 7  # Minimized

# Set icon if it exists
if (Test-Path $IconPath) {
    $Shortcut.IconLocation = "$IconPath,0"
    Write-Host "  [OK] Icon: $IconPath" -ForegroundColor Green
} else {
    Write-Host "  [!] Custom icon not found, using default" -ForegroundColor Yellow
}

$Shortcut.Save()

Write-Host ""
Write-Host "  [OK] Desktop shortcut created!" -ForegroundColor Green
Write-Host ""
Write-Host "  =========================================" -ForegroundColor Cyan
Write-Host "   Double-click '$AppName' on your Desktop" -ForegroundColor White
Write-Host "   to launch the app silently." -ForegroundColor White
Write-Host "  =========================================" -ForegroundColor Cyan
Write-Host ""

# Cleanup
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($WshShell) | Out-Null
