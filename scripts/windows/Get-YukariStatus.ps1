$ErrorActionPreference = 'Continue'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
. (Join-Path $PSScriptRoot 'Use-DockerCompose.ps1') -RepoRoot $repoRoot
Write-Host 'Docker Compose:'
Push-Location $repoRoot
try { & docker.exe compose -f (Join-Path $repoRoot 'docker/compose.yaml') ps }
finally { Pop-Location }
foreach ($endpoint in @('http://127.0.0.1:8080/app/', 'http://127.0.0.1:8080/user/', 'http://127.0.0.1:8080/admin/', 'http://127.0.0.1:3000/health')) {
    try { $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 -Uri $endpoint; Write-Host ("HTTP {0} {1}" -f [int]$response.StatusCode, $endpoint) }
    catch { Write-Host ("DOWN {0}" -f $endpoint) }
}
$agentPid = Join-Path $env:LOCALAPPDATA 'YukariPlayerAgent/agent-process.json'
if (Test-Path -LiteralPath $agentPid) {
    try { $record = Get-Content -LiteralPath $agentPid -Raw | ConvertFrom-Json; $process = Get-Process -Id ([int]$record.processId) -ErrorAction Stop; if ($process.StartTime.ToUniversalTime().Ticks -eq [long]$record.startUtcTicks) { Write-Host "Player Agent process: running (PID $($process.Id), id $($record.agentId))" } else { Write-Host 'Player Agent process: stale PID record' } }
    catch { Write-Host 'Player Agent process: stopped or stale PID record' }
} else { Write-Host 'Player Agent process: not started' }
Write-Host 'Agent logs: %LOCALAPPDATA%\YukariPlayerAgent\logs'
