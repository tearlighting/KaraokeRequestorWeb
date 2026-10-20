param([string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path)
$ErrorActionPreference = 'Stop'
$configDir = Join-Path $env:LOCALAPPDATA 'YukariPlayerAgent'
$pidFile = Join-Path $configDir 'agent-process.json'
if (-not (Test-Path -LiteralPath $pidFile)) { Write-Host 'Player Agent is not recorded as running.'; return }
$record = Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json
$process = Get-Process -Id ([int]$record.processId) -ErrorAction SilentlyContinue
if (-not $process) { Remove-Item -LiteralPath $pidFile -Force; Write-Host 'Player Agent is already stopped.'; return }
if ($process.StartTime.ToUniversalTime().Ticks -ne [long]$record.startUtcTicks -or $process.Path -ne [string]$record.executable) {
    throw 'PID identity no longer matches the recorded Player Agent; refusing to stop another process.'
}
$pipe = '\\.\pipe\yukari-agent-' + [string]$record.agentId
$node = [string]$record.executable
$stopHelper = Join-Path $PSScriptRoot 'stop-player-agent.mjs'
& $node $stopHelper $pipe
if ($LASTEXITCODE -ne 0) { throw 'Could not deliver a graceful stop over the Player Agent local pipe.' }
Wait-Process -Id $process.Id -Timeout 10 -ErrorAction SilentlyContinue
$process.Refresh()
if (-not $process.HasExited) { throw 'Player Agent did not acknowledge graceful stop; it was not force-killed.' }
Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
Write-Host 'Player Agent stopped gracefully; mpv was asked to stop through its Agent.'
