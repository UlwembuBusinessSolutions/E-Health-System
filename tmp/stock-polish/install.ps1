$ErrorActionPreference = 'Stop'
$files = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'hashes.json') -Raw | ConvertFrom-Json
foreach ($file in $files) {
    if ((Get-FileHash -LiteralPath $file.Path).Hash -ne $file.Hash) { throw "File changed: $($file.Path)" }
}
foreach ($file in $files) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot (Split-Path $file.Path -Leaf)) -Destination $file.Path
}
Set-Location -LiteralPath 'D:/Dev/E-Health-System-dev-frontend-ulwembu'
& npm.cmd run lint
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& npm.cmd run build
exit $LASTEXITCODE
