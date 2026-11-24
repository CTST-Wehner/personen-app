@echo off
rem Startet die Personen-App zum Testen am PC und oeffnet sie im Browser.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-server.ps1" -Oeffnen
pause
