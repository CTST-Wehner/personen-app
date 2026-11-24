# Kleiner lokaler Webserver zum Testen der App am PC (nur von diesem PC aus erreichbar).
# Start: Doppelklick auf start.cmd  -  Beenden: Fenster schliessen oder Strg+C
param([int]$Port = 8080, [switch]$Oeffnen)

$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'; '.webmanifest' = 'application/manifest+json'
  '.png' = 'image/png'; '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon'; '.txt' = 'text/plain; charset=utf-8'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try {
  $listener.Start()
} catch {
  # Port belegt: Laeuft die App dort schon? Dann nur den Browser oeffnen.
  $laeuftSchon = $false
  try {
    $antwort = Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 "http://localhost:$Port/manifest.webmanifest"
    $laeuftSchon = $antwort.RawContent -match '"short_name"\s*:\s*"Personen"'
  } catch { }
  if ($laeuftSchon) {
    Write-Host "Die Personen-App laeuft bereits auf http://localhost:$Port/ - der Browser wird geoeffnet."
    if ($Oeffnen) { Start-Process "http://localhost:$Port/" }
    exit 0
  }
  Write-Host ""
  Write-Host "FEHLER: Port $Port ist von einem anderen Programm belegt." -ForegroundColor Red
  Write-Host "Bitte das andere Programm beenden oder den PC neu starten und es dann noch einmal versuchen."
  Write-Host "(Ein anderer Port wuerde einen leeren Datenspeicher bedeuten, deshalb wird keiner automatisch gewaehlt.)"
  exit 1
}
Write-Host "Personen-App laeuft auf http://localhost:$Port/"
Write-Host "Dieses Fenster offen lassen. Beenden: Fenster schliessen oder Strg+C."
if ($Oeffnen) { Start-Process "http://localhost:$Port/" }

try {
  while ($listener.IsListening) {
    $task = $listener.GetContextAsync()
    while (-not $task.AsyncWaitHandle.WaitOne(300)) { }
    $ctx = $task.Result
    $res = $ctx.Response
    try {
      $pfad = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
      if ($pfad -eq '' -or $pfad.EndsWith('/')) { $pfad += 'index.html' }
      $voll = [IO.Path]::GetFullPath((Join-Path $root $pfad))
      if (-not $voll.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $voll -PathType Leaf)) {
        $res.StatusCode = 404
        $bytes = [Text.Encoding]::UTF8.GetBytes('Nicht gefunden')
      } else {
        $ext = [IO.Path]::GetExtension($voll).ToLower()
        if ($mime.ContainsKey($ext)) { $res.ContentType = $mime[$ext] } else { $res.ContentType = 'application/octet-stream' }
        $res.Headers.Add('Cache-Control', 'no-cache')
        $bytes = [IO.File]::ReadAllBytes($voll)
      }
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } catch {
      Write-Warning $_
    } finally {
      $res.Close()
    }
  }
} finally {
  $listener.Stop()
}
