@echo off
REM Serve the trainer locally and open it in the default browser.
start "" http://localhost:8391
python -m http.server 8391 --directory "%~dp0"
