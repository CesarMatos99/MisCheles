$ErrorActionPreference = 'Stop'
$sourceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$targetRoot = 'C:\Proyectos\MisCheles'
if (-not (Test-Path -LiteralPath (Join-Path $targetRoot 'compose.yaml'))) { throw "No encuentro compose.yaml en $targetRoot" }
if ($sourceRoot -eq (Resolve-Path $targetRoot).Path) { throw 'Origen y destino son la misma carpeta.' }
# Verify Docker Compose and target write access before copying any files.
try {
  $composeVersion = & docker compose version 2>&1
  $composeExitCode = $LASTEXITCODE
} catch {
  throw 'Docker Compose no está disponible en esta sesión. Abre PowerShell como Mateo y confirma que Docker Desktop está iniciado.'
}
if ($composeExitCode -ne 0) { throw 'Docker Compose no está disponible en esta sesión. Abre PowerShell como Mateo y confirma que Docker Desktop está iniciado.' }
$probePath = Join-Path $targetRoot ('.mischeles-write-check-' + [guid]::NewGuid().ToString('N') + '.tmp')
try {
  $probe = [System.IO.File]::Open($probePath, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write, [System.IO.FileShare]::None)
  $probe.Dispose()
} catch {
  throw "Windows denegó la escritura en $targetRoot. Ejecuta este script desde tu PowerShell habitual como Mateo; no cambies ACL ni permisos globales. Detalle: $($_.Exception.Message)"
} finally {
  if (Test-Path -LiteralPath $probePath) { Remove-Item -LiteralPath $probePath -Force }
}
$excludedDirs = @('.git', 'node_modules', 'dist', 'coverage', '.dart_tool', 'build') | ForEach-Object { Join-Path $sourceRoot $_ }
Write-Host "Sincronizando $sourceRoot -> $targetRoot (sin tocar .git, node_modules ni archivos .env)..."
$copyOutput = & robocopy $sourceRoot $targetRoot /E /COPY:DAT /R:2 /W:2 /XD $excludedDirs /XF '.env' '.env.*' 2>&1
$copyOutput | ForEach-Object { Write-Host $_ }
$copyCode = $LASTEXITCODE
$copyErrors = $copyOutput | Select-String -Pattern '(?i)\bERROR\s+[1-9]\b'
if ($copyCode -ge 8 -or $copyErrors) { throw "Robocopy reportó errores (código $copyCode); Docker no se actualizó. Corrige el acceso de escritura en $targetRoot y vuelve a ejecutar." }
Push-Location $targetRoot
try {
  Write-Host 'Construyendo y actualizando únicamente el servicio web en 5174...'
  & docker compose up --build -d web
  if ($LASTEXITCODE -ne 0) { throw "docker compose terminó con código $LASTEXITCODE" }
  $deadline = (Get-Date).AddSeconds(120)
  $checks = @(
    @{ Path = '/'; Contains = 'MisCheles' },
    @{ Path = '/src/features/dashboard/AnalyticsView.tsx'; Contains = 'AnalyticsFilters' },
    @{ Path = '/src/features/transactions/TransactionsView.tsx'; Contains = 'FilterPanel' },
    @{ Path = '/src/features/savings/SavingsView.tsx'; Contains = 'PageHeader' },
    @{ Path = '/src/domain/financialClassification.ts'; Contains = 'isSavingsContributionTransaction' },
    @{ Path = '/src/components/layout/PageHeader.tsx'; Contains = 'PageHeader' }
  )
  do {
    try {
      $allPassed = $true
      foreach ($check in $checks) {
        $response = Invoke-WebRequest -UseBasicParsing -Uri ('http://localhost:5174' + $check.Path) -TimeoutSec 5
        if ($response.StatusCode -ne 200 -or -not $response.Content.Contains($check.Contains)) { $allPassed = $false; break }
      }
      if ($allPassed) {
        Write-Host 'Listo: MisCheles actualizado responde en http://localhost:5174 con los módulos web, filtros y clasificación financiera actuales.' -ForegroundColor Green
        & docker compose ps web
        return
      }
    } catch { }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)
  throw 'El contenedor no confirmó la versión nueva en 120 segundos. Revisa docker compose logs web.'
} finally { Pop-Location }
