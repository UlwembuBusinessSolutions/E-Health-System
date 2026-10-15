$ErrorActionPreference = 'Stop'
$frontend = 'D:/Dev/E-Health-System-dev-frontend-ulwembu'
$stockTest = Join-Path $frontend 'tests/stock-control.smoke.mjs'
$expected = (Get-Content -LiteralPath (Join-Path $PSScriptRoot 'stock-test.sha256') -Raw).Trim()
if ((Get-FileHash -LiteralPath $stockTest).Hash -ne $expected) { throw 'Stock smoke test changed since inspection.' }
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'stock-control.smoke.mjs') -Destination $stockTest
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'pharmacy-duty.smoke.mjs') -Destination (Join-Path $frontend 'tests/pharmacy-duty.smoke.mjs')
$backend = 'D:/Dev/E-Health-System-dev-backend-ulwembu'
$jar = Join-Path $backend 'tmp/backend-verification/target/platform-duty.jar'
if (-not (Test-Path -LiteralPath $jar)) { throw 'Verified backend JAR is missing.' }
$listener = Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
    $serverProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
    if ($serverProcess.CommandLine -notmatch 'tmp[/\\]backend-verification[/\\]target[/\\]platform\.jar') {
        throw 'Port 8081 belongs to a different process. It was not stopped.'
    }
    Stop-Process -Id $listener.OwningProcess
    Wait-Process -Id $listener.OwningProcess -Timeout 15 -ErrorAction SilentlyContinue
}
$runtime = 'C:/Users/GoodKid/.vscode/extensions/redhat.java-1.56.0-win32-x64/jre/21.0.12.1-win32-x86_64/bin/java.exe'
$started = Start-Process -FilePath $runtime -ArgumentList '-jar',$jar -WorkingDirectory $backend -WindowStyle Hidden -RedirectStandardOutput (Join-Path $backend 'tmp/backend-verification/duty-server.log') -RedirectStandardError (Join-Path $backend 'tmp/backend-verification/duty-server-error.log') -PassThru
Write-Output "Started updated backend process $($started.Id)."
