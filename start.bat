@echo off
REM Double-click entrypoint for start.ps1.
REM Forces the working directory to the script location and pauses on error
REM so any startup failure stays visible.

setlocal
title EduSpace - dev stack
cd /d "%~dp0"

powershell -NoLogo -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
set EXITCODE=%ERRORLEVEL%

if not "%EXITCODE%"=="0" (
    echo.
    echo start.ps1 exited with code %EXITCODE%
    pause
)

endlocal & exit /b %EXITCODE%
