@echo off
rem Laedt den aktuellen Stand der App zu GitHub (Konto CTST-Wehner) hoch.
rem Es werden nur Programmdateien hochgeladen - keine Personendaten.
pushd "%~dp0"
rem Ordner liegt auf dem Netzlaufwerk - Git die Sicherheitspruefung nur fuer diese Befehle erlauben
set GIT="C:\Users\DW\AppData\Local\Programs\Git\cmd\git.exe" -c safe.directory=*
echo.
echo === Personen-App zu GitHub hochladen (CTST-Wehner) ===
echo.
%GIT% add -A
if errorlevel 1 goto fehler
%GIT% diff --cached --quiet
if errorlevel 1 (
  %GIT% commit -m "Aktualisierung" -q
  if errorlevel 1 goto fehler
  echo Neue Aenderungen gespeichert.
) else (
  echo Keine neuen Aenderungen - lade vorhandenen Stand hoch.
)
%GIT% push -u origin main
if errorlevel 1 goto fehler
echo.
echo Fertig. Die App ist in 1-2 Minuten unter https://ctst-wehner.github.io/personen-app/ aktuell.
goto ende
:fehler
echo.
echo FEHLER beim Hochladen - bitte einen Screenshot von diesem Fenster an Claude schicken.
:ende
popd
echo.
pause
