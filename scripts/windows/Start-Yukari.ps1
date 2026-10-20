[CmdletBinding()]
param([switch]$NoBuild, [switch]$NoPlayerAgent, [switch]$NoOpenBrowser)
$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
. (Join-Path $PSScriptRoot 'Use-DockerCompose.ps1') -RepoRoot $repoRoot
$composeFile = Join-Path $repoRoot 'docker/compose.yaml'
$logRoot = Join-Path $env:LOCALAPPDATA 'Yukari/logs'
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
$logFile = Join-Path $logRoot ("startup-{0}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))

try {
    $composeText = Get-Content -LiteralPath $composeFile -Raw
    if ($composeText -notmatch 'YUKARI_NODE_AUTOPLAY:\s*["'']?0') {
        throw 'Startup refused: docker/compose.yaml must keep YUKARI_NODE_AUTOPLAY set to 0.'
    }
    Push-Location $repoRoot
    try {
        $node = (Get-Command node.exe -ErrorAction Stop).Source
        & $node (Join-Path $repoRoot 'docker/prepare-player-agent-token.mjs') 2>&1 | Tee-Object -FilePath $logFile -Append
        if ($LASTEXITCODE -ne 0) { throw 'Could not prepare the local Player Agent credential file.' }
        $composeArgs = @('compose', '-f', $composeFile, 'up', '-d')
        if (-not $NoBuild) { $composeArgs += '--build' }
        & docker.exe @composeArgs 2>&1 | Tee-Object -FilePath $logFile -Append
        if ($LASTEXITCODE -ne 0) { throw "Docker Compose exited with code $LASTEXITCODE" }
    } finally { Pop-Location }

    if (-not $NoPlayerAgent) {
        $agentConfig = Join-Path $env:LOCALAPPDATA 'YukariPlayerAgent/agent-config.json'
        $agentToken = Join-Path $repoRoot '.local/player-agent-token'
        if ((Test-Path -LiteralPath $agentConfig) -and (Test-Path -LiteralPath $agentToken)) {
            if (-not (Test-Path -LiteralPath (Join-Path $repoRoot 'apps/player-agent/node_modules'))) {
                & npm.cmd --prefix (Join-Path $repoRoot 'apps/player-agent') ci 2>&1 | Tee-Object -FilePath $logFile -Append
                if ($LASTEXITCODE -ne 0) { throw 'Player Agent dependencies failed to install.' }
            }
            & npm.cmd --prefix (Join-Path $repoRoot 'apps/player-agent') run build 2>&1 | Tee-Object -FilePath $logFile -Append
            if ($LASTEXITCODE -ne 0) { throw 'Player Agent build failed.' }
            & (Join-Path $PSScriptRoot 'Start-PlayerAgent.ps1') -RepoRoot $repoRoot 2>&1 | Tee-Object -FilePath $logFile -Append
            if ($LASTEXITCODE -ne 0) { throw 'Player Agent did not start; inspect its local logs.' }
        } else {
            'Player Agent not started: configure it with Configure-PlayerAgent.cmd first.' | Tee-Object -FilePath $logFile -Append
        }
    }
    if (-not $NoOpenBrowser) { Start-Process 'http://127.0.0.1:8080/app/' }
    Write-Host "Yukari started. Log: $logFile"
    Write-Host 'Entry: http://127.0.0.1:8080/app/  User: /user/  Admin: /admin/'
} catch {
    ("ERROR: " + $_.Exception.Message) | Tee-Object -FilePath $logFile -Append
    Write-Error "Yukari startup failed. See $logFile"
    exit 1
}
