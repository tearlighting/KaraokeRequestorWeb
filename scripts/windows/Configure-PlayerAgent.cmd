@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Configure-PlayerAgent.ps1" %*
pause
