@echo off
rem local.ai+ uninstaller. Your characters, chats and settings are not touched.
chcp 65001 >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\uninstall.ps1" %*
echo.
pause
