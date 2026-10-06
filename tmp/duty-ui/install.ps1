$ErrorActionPreference = 'Stop'
$destination = 'D:/Dev/E-Health-System-dev-frontend-ulwembu'
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'manifest.json') -Raw | ConvertFrom-Json
foreach ($entry in $manifest.PSObject.Properties) {
    if ((Get-FileHash -LiteralPath (Join-Path $destination $entry.Name)).Hash -ne $entry.Value) {
        throw "File changed since inspection: $($entry.Name)"
    }
}
$files = Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'src') -Recurse -File
foreach ($file in $files) {
    $relative = $file.FullName.Substring($PSScriptRoot.Length + 1).Replace('\','/')
    $target = Join-Path $destination $relative
    if ((Test-Path -LiteralPath $target) -and -not $manifest.PSObject.Properties[$relative]) {
        throw "Unexpected existing file: $relative"
    }
}
foreach ($file in $files) {
    $relative = $file.FullName.Substring($PSScriptRoot.Length + 1)
    Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $destination $relative)
}
Set-Location -LiteralPath $destination
& npm.cmd run lint
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& npm.cmd run build
exit $LASTEXITCODE
