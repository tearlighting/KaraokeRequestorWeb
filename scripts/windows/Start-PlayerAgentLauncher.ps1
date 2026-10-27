[CmdletBinding()]
param([string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path)
$ErrorActionPreference = 'Stop'

$configDir = Join-Path $env:LOCALAPPDATA 'YukariPlayerAgent'
$configFile = Join-Path $configDir 'agent-config.json'
$logDir = Join-Path $configDir 'logs'
$lockFile = Join-Path $configDir 'runtime-v2/launcher.lock'
$entry = Join-Path $RepoRoot 'agents/player-agent/dist/launcher.js'
$tokenFile = Join-Path $RepoRoot '.local/player-agent-token'
$node = (Get-Command node.exe -ErrorAction Stop).Source

if (-not (Test-Path -LiteralPath $configFile)) { throw 'Player Agent is not configured. Run Configure-PlayerAgent.cmd once.' }
if (-not (Test-Path -LiteralPath $tokenFile)) { throw 'Player Agent credential is missing. Start Yukari Compose once first.' }
if (-not (Test-Path -LiteralPath $entry)) { throw 'Launcher build is missing. Run Start-Yukari.cmd to build it.' }
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

# Reuse only a process whose PID, executable and start time match its lock.
# A live or unreadable owner is never killed and its lock is never removed.
if (Test-Path -LiteralPath $lockFile) {
    try {
        $record = Get-Content -LiteralPath $lockFile -Raw | ConvertFrom-Json
        if ([string]$record.pid -notmatch '^\d+$' -or [long]$record.startedAt -le 0) { throw 'Invalid launcher lock.' }
        try { $process = Get-Process -Id ([int]$record.pid) -ErrorAction Stop }
        catch {
            if ($_.CategoryInfo.Category -ne 'ObjectNotFound') { throw 'Cannot verify the existing Launcher process; preserving its lock.' }
            Remove-Item -LiteralPath $lockFile -Force
            $process = $null
        }
        if ($null -ne $process) {
            $startedAt = [DateTimeOffset]::FromUnixTimeMilliseconds([long]$record.startedAt).LocalDateTime
            if ($process.Path -eq $node -and [Math]::Abs(($process.StartTime - $startedAt).TotalSeconds) -lt 5) {
                Write-Host 'Windows Launcher is already running in the background.'
                exit 0
            }
            throw 'Launcher lock belongs to a different or unverifiable process; it was preserved.'
        }
    } catch { throw "Cannot safely verify existing Launcher: $($_.Exception.Message)" }
}

$stdout = Join-Path $logDir 'launcher.stdout.log'
$stderr = Join-Path $logDir 'launcher.stderr.log'
$process = Start-Process -FilePath $node -ArgumentList ('"{0}"' -f $entry) -WorkingDirectory $RepoRoot -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
Start-Sleep -Milliseconds 500
$process.Refresh()
if ($process.HasExited) { throw 'Windows Launcher exited during startup. Check %LOCALAPPDATA%\YukariPlayerAgent\logs.' }
Write-Host 'Windows Launcher started in the background. Manage the Agent from Admin → System.'
