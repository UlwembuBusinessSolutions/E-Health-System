$ErrorActionPreference = 'Stop'
$destination = 'D:/Dev/E-Health-System-dev-frontend-ulwembu/src/pharmacy'
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'manifest.json') -Raw | ConvertFrom-Json
foreach ($file in $manifest) {
    if ((Get-FileHash -LiteralPath (Join-Path $destination $file.name)).Hash -ne $file.hash) { throw "File changed: $($file.name)" }
}
if (Test-Path -LiteralPath (Join-Path $destination 'PharmacyWorkflowGuide.tsx')) { throw 'Guide component already exists.' }
foreach ($file in Get-ChildItem -LiteralPath $PSScriptRoot -Filter '*.tsx') {
    Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $destination $file.Name)
}
Set-Location -LiteralPath 'D:/Dev/E-Health-System-dev-frontend-ulwembu'
& npm.cmd run lint
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& npm.cmd run build
exit $LASTEXITCODE
