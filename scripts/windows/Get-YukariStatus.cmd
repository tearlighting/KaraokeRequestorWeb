@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Get-YukariStatus.ps1" %*
pause
