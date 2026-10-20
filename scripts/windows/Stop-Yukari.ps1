$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
. (Join-Path $PSScriptRoot 'Use-DockerCompose.ps1') -RepoRoot $repoRoot
$logRoot = Join-Path $env:LOCALAPPDATA 'Yukari/logs'
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
$logFile = Join-Path $logRoot ("stop-{0}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
try {
    & (Join-Path $PSScriptRoot 'Stop-PlayerAgent.ps1') -RepoRoot $repoRoot 2>&1 | Tee-Object -FilePath $logFile -Append
    Push-Location $repoRoot
    try {
        & docker.exe compose -f (Join-Path $repoRoot 'docker/compose.yaml') stop api-server web 2>&1 | Tee-Object -FilePath $logFile -Append
        if ($LASTEXITCODE -ne 0) { throw "Docker Compose stop exited with code $LASTEXITCODE" }
    } finally { Pop-Location }
    Write-Host "Yukari stopped. Containers and volumes are preserved. Log: $logFile"
} catch { $_ | Tee-Object -FilePath $logFile -Append; Write-Error "Stop incomplete. See $logFile"; exit 1 }
