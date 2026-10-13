# Windows (PowerShell) version of speculos.sh. Run with: npm run speculos:win
# Starts the emulated Ledger (Nano S Plus, Ethereum app) with its REST API and web UI on :5001.
# --pki-prod is required: without it the device rejects Ledger's token metadata
# and every ERC-20 transfer falls back to blind signing. Needs Docker Desktop running.
$root = Split-Path -Parent $PSScriptRoot

$appElf = if ($env:ETH_APP_ELF) { $env:ETH_APP_ELF } else { Join-Path $root 'speculos\ethereum-nanosp.elf' }
if (-not (Test-Path $appElf)) {
  Write-Error "Ethereum app not found at $appElf"
  exit 1
}
$appElf = (Resolve-Path $appElf).Path

# The seed decides the wallet address. Without one Speculos uses its default seed, which is public.
$seed = $env:SPECULOS_SEED
$envFile = Join-Path $root '.env'
if (-not $seed -and (Test-Path $envFile)) {
  $line = Get-Content $envFile | Where-Object { $_ -match '^SPECULOS_SEED=' } | Select-Object -Last 1
  if ($line) { $seed = ($line -replace '^SPECULOS_SEED=', '').Trim().Trim('"').Trim("'") }
}
if (-not $seed) { Write-Warning 'No SPECULOS_SEED set: using the public default seed' }

# Replace any emulator left running (cmd /c keeps docker's "no such container" quiet in PowerShell 5.1)
cmd /c "docker rm -f speculos-eth >nul 2>&1"

$dockerArgs = @(
  'run', '--rm', '--name', 'speculos-eth',
  '-v', "${appElf}:/app.elf:ro", '-p', '127.0.0.1:5001:5000',
  '--entrypoint', 'speculos', 'ghcr.io/ledgerhq/ledger-app-builder/ledger-app-dev-tools:latest',
  '--model', 'nanosp', '--display', 'headless', '--pki-prod', '--api-port', '5000'
)
if ($seed) { $dockerArgs += @('--seed', $seed) }
$dockerArgs += '/app.elf'

& docker @dockerArgs
exit $LASTEXITCODE
