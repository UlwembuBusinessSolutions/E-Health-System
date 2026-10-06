$ErrorActionPreference = 'Stop'
$frontend = 'D:\Dev\E-Health-System-dev-frontend-ulwembu'
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'install-manifest.json') -Raw | ConvertFrom-Json
# Check every destination before writing any file so newer IDE edits are preserved.
foreach ($item in $manifest) {
    $target = Join-Path $frontend $item.destination
    $current = if (Test-Path -LiteralPath $target) { (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash } else { $null }
    if ($current -ne $item.expectedHash) { throw "Frontend file changed since review: $($item.destination)" }
}
foreach ($item in $manifest) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $item.source) -Destination (Join-Path $frontend $item.destination) -Force
}
Set-Location $frontend
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
