param([string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path)
$ErrorActionPreference = 'Stop'
$configDir = Join-Path $env:LOCALAPPDATA 'YukariPlayerAgent'
$configFile = Join-Path $configDir 'agent-config.json'
$tokenFile = Join-Path $RepoRoot '.local/player-agent-token'
$entry = Join-Path $RepoRoot 'agents/player-agent/dist/main.js'
$pidFile = Join-Path $configDir 'agent-process.json'
if (-not (Test-Path -LiteralPath $configFile)) { throw 'Missing local Agent settings. Run Configure-PlayerAgent.cmd.' }
if (-not (Test-Path -LiteralPath $tokenFile)) { throw 'Missing .local/player-agent-token. Start Yukari Compose once to initialize the Agent credential.' }
if (-not (Test-Path -LiteralPath $entry)) { throw 'Missing Player Agent build. Run npm.cmd --prefix agents/player-agent run build.' }

function Get-ProcessIfPresent([int]$ProcessId) {
    try { return Get-Process -Id $ProcessId -ErrorAction Stop }
    catch {
        if ($_.CategoryInfo.Category -eq 'ObjectNotFound') { return $null }
        throw 'Cannot verify whether the recorded Player Agent process is still running.'
    }
}

$confirmedPreviousStopped = $false
if (Test-Path -LiteralPath $pidFile) {
    try {
        $previous = Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json
        if ([string]$previous.processId -notmatch '^\d+$' -or [string]$previous.startUtcTicks -notmatch '^\d+$') { throw 'invalid process record' }
        $previousPid = [int]$previous.processId
        $previousTicks = [long]$previous.startUtcTicks
        $previousProcess = Get-ProcessIfPresent $previousPid
        if ($null -eq $previousProcess) { $confirmedPreviousStopped = $true }
        elseif ($previousProcess.StartTime.ToUniversalTime().Ticks -eq $previousTicks) {
            Write-Host "Player Agent already running (PID $($previousProcess.Id))."
            return
        } else { $confirmedPreviousStopped = $true }
    } catch { throw 'Cannot verify the previous Player Agent process record; it was preserved. Check the process and local Agent logs before retrying.' }
}

$lockFile = Join-Path $configDir 'runtime-v2/agent.lock'
if (Test-Path -LiteralPath $lockFile) {
    $lockOwner = $null
    try { $lockOwner = (Get-Content -LiteralPath $lockFile -Raw | ConvertFrom-Json).pid } catch { }
    if ([string]$lockOwner -match '^\d+$' -and [int]$lockOwner -gt 0) {
        $lockOwnerPid = [int]$lockOwner
        $lockProcess = Get-ProcessIfPresent $lockOwnerPid
        if ($null -ne $lockProcess) { throw "Player Agent lock belongs to a live process (PID $lockOwnerPid); it was not removed." }
        Remove-Item -LiteralPath $lockFile -Force -ErrorAction Stop
    } elseif ($confirmedPreviousStopped) {
        # Older Agent builds created an empty lock. Remove it only after the
        # launcher's PID + process start time proved that process is gone.
        Remove-Item -LiteralPath $lockFile -Force -ErrorAction Stop
    } else { throw 'Legacy Agent lock has no verifiable PID. It was not removed; verify the Agent process and logs first.' }
}
if ($confirmedPreviousStopped) { Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue }

$node = (Get-Command node.exe -ErrorAction Stop).Source
$config = Get-Content -LiteralPath $configFile -Raw | ConvertFrom-Json
$safeHost = $env:COMPUTERNAME -replace '[^A-Za-z0-9_-]', '_'
$agentId = if ($config.agentId) { [string]$config.agentId } else { 'host_' + $safeHost.Substring(0, [Math]::Min(44, $safeHost.Length)) }
$logDir = Join-Path $configDir 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$stdout = Join-Path $logDir 'agent.stdout.log'
$stderr = Join-Path $logDir 'agent.stderr.log'
$process = Start-Process -FilePath $node -ArgumentList ('"' + $entry + '"') -WorkingDirectory $RepoRoot -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
$record = [ordered]@{ processId = $process.Id; startUtcTicks = $process.StartTime.ToUniversalTime().Ticks; executable = $node; agentId = $agentId }
[IO.File]::WriteAllText($pidFile, ($record | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
Start-Sleep -Milliseconds 700
$process.Refresh()
if ($process.HasExited) {
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
    throw "Player Agent exited during startup. See $stderr"
}
Write-Host "Player Agent started (PID $($process.Id)); logs: $logDir"
