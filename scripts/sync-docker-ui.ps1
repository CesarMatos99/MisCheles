$ErrorActionPreference = 'Stop'
$sourceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$targetRoot = 'C:\Proyectos\MisCheles'
$files = @(
  'src/features/savings/SavingsView.tsx',
  'src/features/dashboard/AnalyticsView.tsx',
  'src/features/dashboard/AnalyticsFilters.tsx',
  'src/features/transactions/TransactionsView.tsx',
  'src/features/transactions/TransactionModal.tsx',
  'src/domain/transactionFilters.ts',
  'src/domain/transactionFilters.test.ts',
  'src/App.tsx',
  'src/components/layout/BottomNav.tsx',
  'src/i18n/catalog.ts',
  'src/i18n/analyticsFilterLabels.ts',
  'src/i18n/analyticsFilterLabels.test.ts',
  'src/navigation/routes.ts',
  'src/navigation/routes.test.ts',
  'vite.config.ts',
  'package.json'
)
foreach ($relativePath in $files) {
  $sourceFile = Join-Path $sourceRoot $relativePath
  $destinationFile = Join-Path $targetRoot $relativePath
  if (-not (Test-Path -LiteralPath $sourceFile -PathType Leaf)) { throw "No encuentro $sourceFile" }
  $destinationDirectory = Split-Path -Parent $destinationFile
  if (-not (Test-Path -LiteralPath $destinationDirectory)) { New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null }
  Copy-Item -LiteralPath $sourceFile -Destination $destinationFile -Force
}
$deadline = (Get-Date).AddSeconds(45)
do {
  try {
    $savings = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:5174/src/features/savings/SavingsView.tsx' -TimeoutSec 5
    $analytics = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:5174/src/features/dashboard/AnalyticsView.tsx' -TimeoutSec 5
    $filters = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:5174/src/features/dashboard/AnalyticsFilters.tsx' -TimeoutSec 5
    $transactions = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:5174/src/features/transactions/TransactionsView.tsx' -TimeoutSec 5
    $transactionModal = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:5174/src/features/transactions/TransactionModal.tsx' -TimeoutSec 5
    $filterDomain = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:5174/src/domain/transactionFilters.ts' -TimeoutSec 5
    $navigation = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:5174/src/components/layout/BottomNav.tsx' -TimeoutSec 5
    if ($savings.StatusCode -eq 200 -and $savings.Content.Contains('Saldo total ahorrado') -and -not $savings.Content.Contains('rounded-3xl border border-slate-200 bg-white p-5 shadow-sm') -and -not $savings.Content.Contains('Pasar al mes') -and $analytics.StatusCode -eq 200 -and $analytics.Content.Contains('Tus estadísticas') -and $analytics.Content.Contains('Comparado con ') -and $filters.StatusCode -eq 200 -and $filters.Content.Contains('setDraft(defaults)') -and $transactions.StatusCode -eq 200 -and $transactions.Content.Contains('Tus movimientos') -and $transactions.Content.Contains('Filtros de movimientos') -and $transactions.Content.Contains('Filtros activos') -and $transactions.Content.Contains('Limpiar filtros') -and $transactionModal.StatusCode -eq 200 -and $transactionModal.Content.Contains('addTransaction') -and $filterDomain.StatusCode -eq 200 -and $filterDomain.Content.Contains('filterTransactionRecords') -and $navigation.StatusCode -eq 200 -and $navigation.Content.Contains('focus-visible:ring-2')) {
      Write-Host 'Cambios de navegación, filtros y vistas aplicados en la instancia existente de MisCheles en http://localhost:5174.' -ForegroundColor Green
      return
    }
  } catch { Start-Sleep -Milliseconds 750 }
  Start-Sleep -Milliseconds 500
} while ((Get-Date) -lt $deadline)
throw 'No pude confirmar el HMR en localhost:5174. Revisa los errores del navegador y del contenedor web.'


