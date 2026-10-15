$ErrorActionPreference = 'Stop'
$frontend = 'D:\Dev\E-Health-System-dev-frontend-ulwembu'
$routerPath = Join-Path $frontend 'src/app/router.tsx'
$detailPath = Join-Path $frontend 'src/patient/PatientDetailPage.tsx'
$router = [IO.File]::ReadAllText($routerPath)
$detail = [IO.File]::ReadAllText($detailPath)
$anchor = '{!patient.archived && !isStartingVisit && !startedVisit && ('
if (!$router.Contains('path="/print/ticket/:tokenId"') -or !$detail.Contains($anchor)) { throw 'Integration anchors changed; review before applying.' }
if (!$router.Contains('PatientLabelPrintPage')) {
  $router = 'import { PatientLabelPrintPage } from "@/patient/PatientLabelPrintPage";' + "`n" + $router
  $router = $router.Replace('path="/print/ticket/:tokenId"', 'path="/print/patient-label/:patientId" element={<RequireAuth><PatientLabelPrintPage /></RequireAuth>} />' + "`n      <Route " + 'path="/print/ticket/:tokenId"')
}
if (!$detail.Contains('/print/patient-label/')) {
  $detail = $detail.Replace($anchor, '<Link to={`/print/patient-label/${patient.id}`} className="inline-flex h-11 items-center gap-2 rounded-lg border border-border-strong px-4 text-[14px] font-semibold"><Printer className="size-4" aria-hidden />Print label / PDF</Link>' + "`n                " + $anchor)
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'src/patient/PatientLabelPrintPage.tsx') -Destination (Join-Path $frontend 'src/patient/PatientLabelPrintPage.tsx')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'src/patient/patientLabel.ts') -Destination (Join-Path $frontend 'src/patient/patientLabel.ts')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'label-smoke.mjs') -Destination (Join-Path $frontend 'tests/patient-label.smoke.mjs')
[IO.File]::WriteAllText($routerPath, $router)
[IO.File]::WriteAllText($detailPath, $detail)
Set-Location $frontend
npm.cmd install jsbarcode jspdf
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed' }
npm.cmd install --save-dev @types/jsbarcode
if ($LASTEXITCODE -ne 0) { throw 'Type installation failed' }
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
