@echo off
setlocal
cd /d "%~dp0"
py -3 -c "import sys; assert sys.version_info >= (3,10)" >nul 2>nul
if not errorlevel 1 (
    py -3 web_server.py --open %*
    goto finish
)
python -c "import sys; assert sys.version_info >= (3,10)" >nul 2>nul
if not errorlevel 1 (
    python web_server.py --open %*
    goto finish
)
set "CAMPUS_PYTHON=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if exist "%CAMPUS_PYTHON%" (
    "%CAMPUS_PYTHON%" web_server.py --open %*
    goto finish
)
echo Can Python 3.10+ de chay backend.
pause
exit /b 1
:finish
if errorlevel 1 pause
