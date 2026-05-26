$ErrorActionPreference = "Stop"

$repo = Split-Path -Parent $PSScriptRoot
$mobile = Join-Path $repo "apps/mobile"
$port = 8081
$url = "http://localhost:$port"
$log = Join-Path $mobile "expo-server.log"

$connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if (-not $connection) {
  Start-Process -FilePath "powershell" -ArgumentList @(
    "-NoProfile",
    "-Command",
    "Set-Location '$mobile'; npx expo start --web --port $port *> '$log'"
  ) -WindowStyle Hidden
  Start-Sleep -Seconds 12
}

$edge = @(
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($edge) {
  Start-Process -FilePath $edge -ArgumentList @(
    "--new-window",
    "--window-size=430,932",
    "--app=$url"
  )
} else {
  Start-Process $url
}

Write-Host "HomeThread preview opened at $url"
