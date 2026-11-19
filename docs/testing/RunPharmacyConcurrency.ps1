$ErrorActionPreference = 'Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '../..'))
# Local development only. No clinic records are changed by this test.
$config = Get-Content 'src/main/resources/application.yml' -Raw
$env:PHARMACY_TEST_JDBC_URL = 'jdbc:postgresql://127.0.0.1:5432/ulwembut?connectTimeout=60&socketTimeout=120&sslmode=disable'
$env:PHARMACY_TEST_DB_USER = 'postgres'
$env:PHARMACY_TEST_DB_PASSWORD = [regex]::Match($config, '\$\{DB_PASSWORD:([^}]+)\}').Groups[1].Value
if (!$env:PHARMACY_TEST_DB_PASSWORD) { throw 'Local database password is not configured.' }
$env:JAVA_HOME = 'C:/Program Files/Microsoft/jdk-25.0.2.10-hotspot'
$maven = Join-Path $env:USERPROFILE 'tools/apache-maven-3.9.16/bin/mvn.cmd'
$report = 'target/surefire-reports/TEST-co.ehealth.platform.pharmacy.stock.DispensingConcurrencyTest.xml'
try {
    if (Test-Path $report) { Remove-Item -LiteralPath $report }
    & $maven '-q' '-Dtest=DispensingConcurrencyTest' 'test' *> 'target/pharmacy-concurrency.log'
    if ($LASTEXITCODE -ne 0) { throw 'Concurrency test failed. See target/pharmacy-concurrency.log.' }
    [xml]$result = Get-Content $report -Raw
    if ([int]$result.testsuite.tests -ne 1 -or [int]$result.testsuite.failures -ne 0 -or [int]$result.testsuite.errors -ne 0 -or [int]$result.testsuite.skipped -ne 0) { throw 'Concurrency test did not pass.' }
    Write-Output 'PASS: 30 - 7 - 11 = 12; ledger consistent; insufficient stock and rollback verified.'
} finally {
    Remove-Item Env:PHARMACY_TEST_DB_PASSWORD -ErrorAction SilentlyContinue
}
