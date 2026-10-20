param([string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path)
$ErrorActionPreference = 'Stop'
$configDir = Join-Path $env:LOCALAPPDATA 'YukariPlayerAgent'
$configFile = Join-Path $configDir 'agent-config.json'
$tokenFile = Join-Path $RepoRoot '.local/player-agent-token'
$entry = Join-Path $RepoRoot 'apps/player-agent/dist/main.js'
$pidFile = Join-Path $configDir 'agent-process.json'
if (-not (Test-Path -LiteralPath $configFile)) { throw 'Missing local Agent settings. Run Configure-PlayerAgent.cmd.' }
if (-not (Test-Path -LiteralPath $tokenFile)) { throw 'Missing .local/player-agent-token. Start Yukari Compose once to initialize the Agent credential.' }
if (-not (Test-Path -LiteralPath $entry)) { throw 'Missing Player Agent build. Run npm.cmd --prefix apps/player-agent run build.' }

if (Test-Path -LiteralPath $pidFile) {
    try {
        $previous = Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json
        $process = Get-Process -Id ([int]$previous.processId) -ErrorAction Stop
        if ($process.StartTime.ToUniversalTime().Ticks -eq [long]$previous.startUtcTicks) {
            Write-Host "Player Agent already running (PID $($process.Id))."
            return
        }
    } catch { }
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
}

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
