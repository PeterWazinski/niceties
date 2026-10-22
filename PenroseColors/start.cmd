@echo off
rem Starts the local web server for Penrose Colors and opens it in the default browser.
cd /d "%~dp0"
start "" cmd /c "timeout /t 1 /nobreak >nul & start http://localhost:4175/color_tool/"
node server.mjs
echo.
echo The server has stopped.
pause
