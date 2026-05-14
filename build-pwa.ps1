$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$distPath = Join-Path $projectRoot "pwa-dist"
$resolvedProjectRoot = (Resolve-Path $projectRoot).Path

if (Test-Path $distPath) {
  $resolvedDistPath = (Resolve-Path $distPath).Path
  if (-not $resolvedDistPath.StartsWith($resolvedProjectRoot)) {
    throw "A pasta de destino esta fora do projeto: $resolvedDistPath"
  }

  Remove-Item -LiteralPath $distPath -Recurse -Force
}

New-Item -ItemType Directory -Path $distPath | Out-Null

$staticFiles = @(
  "index.html",
  "styles.css",
  "sync-config.js",
  "app.js",
  "manifest.json",
  "service-worker.js",
  "icon.svg"
)

foreach ($file in $staticFiles) {
  Copy-Item -LiteralPath (Join-Path $projectRoot $file) -Destination (Join-Path $distPath $file) -Force
}

Write-Host "PWA pronta em: $distPath"
