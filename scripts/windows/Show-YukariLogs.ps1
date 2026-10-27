param([ValidateSet('web','api-server')][string]$Service = 'api-server')
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
. (Join-Path $PSScriptRoot 'Use-DockerCompose.ps1') -RepoRoot $repoRoot
Push-Location $repoRoot
try { & docker.exe compose --env-file (Join-Path $repoRoot '.env') -f (Join-Path $repoRoot 'docker/compose.yaml') logs --tail 200 -f $Service }
finally { Pop-Location }
