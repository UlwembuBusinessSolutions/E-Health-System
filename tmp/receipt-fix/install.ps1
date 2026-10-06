$ErrorActionPreference = 'Stop'
$destination = 'D:/Dev/E-Health-System-dev-frontend-ulwembu/src/pharmacy/stock/ReceiveStockScreen.tsx'
if ((Get-FileHash -LiteralPath $destination).Hash -ne (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'hash.txt') -Raw).Trim()) { throw 'Receipt form changed since inspection.' }
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'ReceiveStockScreen.tsx') -Destination $destination
Set-Location -LiteralPath 'D:/Dev/E-Health-System-dev-frontend-ulwembu'
& npm.cmd run lint
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& npm.cmd run build
exit $LASTEXITCODE
