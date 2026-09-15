@echo off
REM Serve the trainer locally and open it in the default browser.
REM Port 8391 is squatted by a wedged http.server on this machine, so default to 8392;
REM override with:  set PORT=8395 && run.bat
if "%PORT%"=="" set PORT=8392
start "" http://localhost:%PORT%
python "%~dp0serve.py"
