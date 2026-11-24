@echo off
rem Laedt den aktuellen Stand der App zu GitHub (Konto CTST-Wehner) hoch.
rem Es werden nur Programmdateien hochgeladen - keine Personendaten.
pushd "%~dp0"
set GIT="C:\Users\DW\AppData\Local\Programs\Git\cmd\git.exe"
echo.
echo === Personen-App zu GitHub hochladen (CTST-Wehner) ===
echo.
%GIT% add -A
%GIT% commit -m "Aktualisierung" >nul 2>&1
%GIT% push -u origin main
if errorlevel 1 (
  echo.
  echo FEHLER beim Hochladen - bitte die Meldung oben an Claude schicken.
) else (
  echo.
  echo Fertig. Die App ist in 1-2 Minuten unter https://ctst-wehner.github.io/personen-app/ aktuell.
)
popd
echo.
pause
