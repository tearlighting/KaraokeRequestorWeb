[CmdletBinding()]
param([Parameter(Mandatory = $true)][string]$RepoRoot)

$ErrorActionPreference = 'Stop'
$secretDir = Join-Path $RepoRoot '.local/phase16-mysql'
$envFile = Join-Path $RepoRoot '.env'
$legacyEnvFile = Join-Path $secretDir 'api.env'
New-Item -ItemType Directory -Force -Path $secretDir | Out-Null

# Keep the existing locally generated credentials, but materialize all MySQL
# passwords in the ignored project-root .env used by Compose interpolation.
$names = @{
    MYSQL_ROOT_PASSWORD = 'root-password'
    MYSQL_PASSWORD = 'app-password'
    MYSQL_VIEWER_PASSWORD = 'viewer-password'
}
$values = @{}
foreach ($key in $names.Keys) {
    $path = Join-Path $secretDir $names[$key]
    try {
        $value = [System.IO.File]::ReadAllText($path).Trim()
    } catch {
        throw "Cannot read the existing local MySQL credential ($($names[$key])); refusing to replace it."
    }
    if (-not $value -or $value -notmatch '^[A-Za-z0-9_-]{32,}$') {
        throw "The existing MySQL credential ($($names[$key])) is unavailable; restore access before starting."
    }
    $values[$key] = $value
}

$existing = ''
if (Test-Path -LiteralPath $envFile) {
    $existing = [System.IO.File]::ReadAllText($envFile)
} elseif (Test-Path -LiteralPath $legacyEnvFile) {
    $existing = [System.IO.File]::ReadAllText($legacyEnvFile)
}
$lines = @($existing -split "`r?`n" | Where-Object {
    $_ -and $_ -notmatch '^\s*(MYSQL_ROOT_PASSWORD|MYSQL_PASSWORD|MYSQL_VIEWER_PASSWORD)='
})
foreach ($key in @('MYSQL_ROOT_PASSWORD','MYSQL_PASSWORD','MYSQL_VIEWER_PASSWORD')) {
    $lines += "$key=$($values[$key])"
}
[System.IO.File]::WriteAllText($envFile, (($lines -join "`n") + "`n"), [System.Text.UTF8Encoding]::new($false))
$values.Clear()
Write-Host 'Prepared the ignored project-root .env from existing local MySQL credentials; values were not printed.'
