param([Parameter(Mandatory = $true)][string]$RepoRoot)

# Some Windows installations cannot read the per-user Docker CLI plugin directory.
# Prefer the user's explicit Docker config/context; only fall back when Compose itself
# is unavailable and this checkout has the isolated, ignored CLI plugin copy.
if (-not $env:DOCKER_CONFIG -and -not $env:DOCKER_CONTEXT) {
    & docker.exe compose version *> $null
    if ($LASTEXITCODE -ne 0) {
        $localConfig = Join-Path $RepoRoot '.local/empty-docker-config'
        $plugin = Join-Path $localConfig 'cli-plugins/docker-compose.exe'
        if (Test-Path -LiteralPath $plugin) {
            $env:DOCKER_CONFIG = $localConfig
            & docker.exe compose version *> $null
            if ($LASTEXITCODE -ne 0) { throw 'Docker Compose is unavailable even with the local CLI plugin.' }
        }
    }
}
