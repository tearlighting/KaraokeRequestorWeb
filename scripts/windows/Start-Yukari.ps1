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
    Write-Host '[1/4] Checking that Docker Desktop is running...'
    Push-Location $repoRoot
    try {
        & docker.exe info --format '{{.ServerVersion}}' 2>&1 | Tee-Object -FilePath $logFile -Append
        if ($LASTEXITCODE -ne 0) { throw 'Docker Engine is unavailable. Start Docker Desktop, wait until it says Running, then run Start-Yukari.cmd again.' }
    } finally { Pop-Location }

    Write-Host '[2/4] Checking safe playback settings...'
    $composeText = Get-Content -LiteralPath $composeFile -Raw
    if ($composeText -notmatch 'YUKARI_NODE_AUTOPLAY:\s*["'']?0') {
        throw 'Startup refused: docker/compose.yaml must keep YUKARI_NODE_AUTOPLAY set to 0.'
    }
    Push-Location $repoRoot
    try {
        # MySQL development credentials have Compose-local defaults. An ignored
        # root .env may override them, but startup never reads protected secret files.
        $node = (Get-Command node.exe -ErrorAction Stop).Source
        & $node (Join-Path $repoRoot 'docker/prepare-player-agent-token.mjs') 2>&1 | Tee-Object -FilePath $logFile -Append
        if ($LASTEXITCODE -ne 0) { throw 'Could not prepare the local Player Agent credential file.' }
        $envFile = Join-Path $repoRoot '.env'
        $composeCommand = 'compose --env-file "{0}" -f "{1}" up -d' -f $envFile, $composeFile
        if (-not $NoBuild) { $composeCommand += ' --build' }
        $stdoutFile = Join-Path $env:TEMP 'yukari-compose-start.out'
        $stderrFile = Join-Path $env:TEMP 'yukari-compose-start.err'
        try {
            $composeProcess = Start-Process -FilePath 'docker.exe' -ArgumentList $composeCommand -NoNewWindow -Wait -PassThru -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile
            if (Test-Path -LiteralPath $stdoutFile) { Get-Content -LiteralPath $stdoutFile | Tee-Object -FilePath $logFile -Append }
            if (Test-Path -LiteralPath $stderrFile) { Get-Content -LiteralPath $stderrFile | Tee-Object -FilePath $logFile -Append }
            if ($composeProcess.ExitCode -ne 0) { throw "Docker Compose exited with code $($composeProcess.ExitCode)" }
        } finally {
            Remove-Item -LiteralPath $stdoutFile,$stderrFile -Force -ErrorAction SilentlyContinue
        }
    } finally { Pop-Location }

    Write-Host '[3/4] Waiting for Fastify, PHP, and both Vite development servers...'
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        try {
            $api = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri 'http://127.0.0.1:3000/health'
            $web = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri 'http://127.0.0.1:8180/app/'
            $user = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri 'http://127.0.0.1:8180/user/'
            $admin = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri 'http://127.0.0.1:8180/admin/'
            $userVite = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri 'http://127.0.0.1:5173/'
            $adminVite = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri 'http://127.0.0.1:5174/'
            if ($api.StatusCode -eq 200 -and $web.StatusCode -eq 200 -and $user.StatusCode -eq 200 -and $admin.StatusCode -eq 200 -and $userVite.StatusCode -eq 200 -and $adminVite.StatusCode -eq 200) {
                $ready = $true
                break
            }
        } catch { }
        Start-Sleep -Seconds 2
    }
    if (-not $ready) { throw 'Services did not become ready within 120 seconds. Check Docker Desktop and the startup log.' }

    if (-not $NoPlayerAgent) {
        $agentConfig = Join-Path $env:LOCALAPPDATA 'YukariPlayerAgent/agent-config.json'
        $agentToken = Join-Path $repoRoot '.local/player-agent-token'
        if ((Test-Path -LiteralPath $agentConfig) -and (Test-Path -LiteralPath $agentToken)) {
            $previousErrorPreference = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            if (-not (Test-Path -LiteralPath (Join-Path $repoRoot 'agents/player-agent/node_modules'))) {
                $installStderr = Join-Path $env:TEMP "yukari-agent-install-$PID.err"
                & npm.cmd --prefix (Join-Path $repoRoot 'agents/player-agent') ci 2> $installStderr | Tee-Object -FilePath $logFile -Append
                $installExitCode = $LASTEXITCODE
                if ($installExitCode -ne 0 -and (Test-Path -LiteralPath $installStderr)) { Get-Content -LiteralPath $installStderr | Add-Content -LiteralPath $logFile }
                Remove-Item -LiteralPath $installStderr -Force -ErrorAction SilentlyContinue
                if ($installExitCode -ne 0) { $ErrorActionPreference = $previousErrorPreference; throw 'Player Agent dependencies failed to install.' }
            }
            $buildStderr = Join-Path $env:TEMP "yukari-agent-build-$PID.err"
            & npm.cmd --prefix (Join-Path $repoRoot 'agents/player-agent') run build 2> $buildStderr | Tee-Object -FilePath $logFile -Append
            $buildExitCode = $LASTEXITCODE
            if ($buildExitCode -ne 0 -and (Test-Path -LiteralPath $buildStderr)) { Get-Content -LiteralPath $buildStderr | Add-Content -LiteralPath $logFile }
            Remove-Item -LiteralPath $buildStderr -Force -ErrorAction SilentlyContinue
            $ErrorActionPreference = $previousErrorPreference
            if ($buildExitCode -ne 0) { throw 'Player Agent build failed.' }
            # The Launcher is the host-side bridge for Admin's fixed start/stop
            # commands. Keep it hidden in the background; do not start the Agent
            # directly here, otherwise the Admin start button has no purpose.
            $launcherScript = Join-Path $PSScriptRoot 'Start-PlayerAgentLauncher.ps1'
            $ErrorActionPreference = 'Continue'
            $launcherStderr = Join-Path $env:TEMP "yukari-launcher-start-$PID.err"
            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $launcherScript -RepoRoot $repoRoot 2> $launcherStderr | Tee-Object -FilePath $logFile -Append
            $launcherExitCode = $LASTEXITCODE
            if ($launcherExitCode -ne 0 -and (Test-Path -LiteralPath $launcherStderr)) { Get-Content -LiteralPath $launcherStderr | Add-Content -LiteralPath $logFile }
            Remove-Item -LiteralPath $launcherStderr -Force -ErrorAction SilentlyContinue
            $ErrorActionPreference = $previousErrorPreference
            if ($launcherExitCode -ne 0) { throw 'Windows Launcher did not start; inspect its local logs.' }
        } else {
            'Windows Launcher not started: configure Player Agent once with Configure-PlayerAgent.cmd first.' | Tee-Object -FilePath $logFile -Append
        }
    }
    Write-Host '[4/4] Services are responding.'
    if (-not $NoOpenBrowser) { Start-Process 'http://127.0.0.1:8180/app/' }
    Write-Host 'Ready. Player Agent can be started/stopped from Admin → System.'
    Write-Host "Yukari started. Log: $logFile"
    Write-Host 'Navicat read-only connection details are stored in .local/phase16-mysql/navicat-connection.txt.'
    Write-Host 'Production pages: http://127.0.0.1:8180/user/ and /admin/'
    Write-Host 'Vite development: http://127.0.0.1:5173/ (user), http://127.0.0.1:5174/ (admin)'
    Write-Host 'Legacy portal: http://127.0.0.1:8180/app/'
} catch {
    $message = $_.Exception.Message
    if (-not $message) { $message = $_.ToString() }
    ("ERROR: " + $message) | Tee-Object -FilePath $logFile -Append
    ("ERROR DETAILS: " + $_.ScriptStackTrace) | Tee-Object -FilePath $logFile -Append
    try {
        $dialog = New-Object -ComObject WScript.Shell
        $null = $dialog.Popup("Yukari could not start. See the startup log:`r`n$logFile`r`n`r`n$message", 0, 'Yukari startup failed', 16)
    } catch { }
    exit 1
}
