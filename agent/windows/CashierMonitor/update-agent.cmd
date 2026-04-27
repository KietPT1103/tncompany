@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "PS_SCRIPT=%SCRIPT_DIR%upgrade-agent.ps1"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Start-Process -FilePath 'powershell.exe' -Verb RunAs -WorkingDirectory '%SCRIPT_DIR%' -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File ""%PS_SCRIPT%""'"

exit /b %errorlevel%
