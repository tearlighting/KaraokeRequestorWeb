[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$envFile = Join-Path $repoRoot '.env'
$composeFile = Join-Path $repoRoot 'compose.yaml'

if (-not (Test-Path -LiteralPath $envFile -PathType Leaf)) {
    throw "Root .env was not found at '$envFile'. Create/configure the repository root .env first."
}
if (-not (Test-Path -LiteralPath $composeFile -PathType Leaf)) {
    throw "The canonical Compose file was not found at '$composeFile'."
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'Docker CLI is unavailable. Start Docker Desktop and retry.'
}

$composeArgs = @('compose', '--env-file', $envFile, '-f', $composeFile)
$tunnelComposeArgs = $composeArgs + @('--profile', 'tunnel')

function Invoke-Compose {
    param(
        [Parameter(Mandatory)][string[]]$Prefix,
        [Parameter(Mandatory)][string[]]$CommandArgs,
        [switch]$Capture
    )

    if ($Capture) {
        $output = & docker @Prefix @CommandArgs
        if ($LASTEXITCODE -ne 0) { throw "Docker Compose failed ($($CommandArgs -join ' ')). See the Docker output above." }
        return $output
    }

    & docker @Prefix @CommandArgs
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose failed ($($CommandArgs -join ' ')). See the Docker output above." }
}

function Test-ComposeServiceRunning {
    param([Parameter(Mandatory)][string[]]$Prefix, [Parameter(Mandatory)][string]$Service)
    $ids = Invoke-Compose -Prefix $Prefix -CommandArgs @('ps', '--status', 'running', '-q', $Service) -Capture
    return (@($ids | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }).Count -gt 0)
}

function Get-UserBundleName {
    param([Parameter(Mandatory)][string[]]$Prefix, [Parameter(Mandatory)][string]$Service)
    $html = (Invoke-Compose -Prefix $Prefix -CommandArgs @('exec', '-T', $Service, 'cat', '/usr/share/nginx/html/user/index.html') -Capture) -join "`n"
    $match = [regex]::Match($html, 'assets/index-[^"\s]+\.js')
    if (-not $match.Success) { throw "Could not read the User Web bundle fingerprint from '$Service'." }
    return $match.Value
}

# Compose project identity and interpolation are anchored to the repository's
# root .env. The tunnel profile is enabled only for read/build/update commands;
# this script never starts cloudflared.
$null = Invoke-Compose -Prefix $composeArgs -CommandArgs @('ps', '--all') -Capture
$tunnelWasRunning = Test-ComposeServiceRunning -Prefix $tunnelComposeArgs -Service 'gateway-tunnel'

if ($WhatIfPreference) {
    Write-Host 'WhatIf: would build user-lan and gateway-tunnel from the root .env.'
    Write-Host 'WhatIf: would recreate user-lan only; gateway-tunnel would be recreated only if it is running now.'
    Write-Host "Tunnel Gateway currently running: $tunnelWasRunning. cloudflared is never started or restarted by this script."
    return
}

if (-not $PSCmdlet.ShouldProcess('User Web static Gateway images', 'Build user-lan and gateway-tunnel')) { return }
Invoke-Compose -Prefix $tunnelComposeArgs -CommandArgs @('build', 'user-lan', 'gateway-tunnel')

if (-not $PSCmdlet.ShouldProcess('LAN User Gateway (user-lan)', 'Recreate without dependencies using the newly built image')) { return }
Invoke-Compose -Prefix $composeArgs -CommandArgs @('up', '-d', '--no-deps', '--no-build', 'user-lan')

if ($tunnelWasRunning) {
    # Re-check after the build: if the operator stopped the Tunnel meanwhile,
    # do not bring its Gateway back up.
    if (Test-ComposeServiceRunning -Prefix $tunnelComposeArgs -Service 'gateway-tunnel') {
        if ($PSCmdlet.ShouldProcess('Existing public User Gateway (gateway-tunnel)', 'Recreate without dependencies; leave cloudflared untouched')) {
            Invoke-Compose -Prefix $tunnelComposeArgs -CommandArgs @('up', '-d', '--no-deps', '--no-build', 'gateway-tunnel')
        }
    }
    else {
        Write-Host 'Tunnel Gateway was stopped during the build; it remains stopped.'
    }
}
else {
    Write-Host 'Tunnel Gateway was not running before this update; its image was built but the public Tunnel was not started.'
}

if (-not (Test-ComposeServiceRunning -Prefix $composeArgs -Service 'user-lan')) {
    throw 'LAN Gateway did not return to the running state after update.'
}
$lanBundle = Get-UserBundleName -Prefix $composeArgs -Service 'user-lan'

# Validate the actual LAN-served HTML and its no-store response header. This
# bypasses browser caches and confirms which hashed JS bundle the browser gets.
$publishedPorts = Invoke-Compose -Prefix $composeArgs -CommandArgs @('port', 'user-lan', '8080') -Capture
$portMatch = [regex]::Match(($publishedPorts | Select-Object -First 1), ':(\d+)\s*$')
if (-not $portMatch.Success) { throw 'Could not determine the published LAN Gateway port.' }
$lanUrl = "http://127.0.0.1:$($portMatch.Groups[1].Value)/user/"
Add-Type -AssemblyName System.Net.Http
$handler = [System.Net.Http.HttpClientHandler]::new()
$handler.UseProxy = $false
$client = [System.Net.Http.HttpClient]::new($handler)
try {
    $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Get, $lanUrl)
    $request.Headers.CacheControl = [System.Net.Http.Headers.CacheControlHeaderValue]::new()
    $request.Headers.CacheControl.NoCache = $true
    $response = $client.SendAsync($request).GetAwaiter().GetResult()
    if ([int]$response.StatusCode -ne 200) { throw "LAN User Web returned HTTP $([int]$response.StatusCode)." }
    $servedHtml = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    $servedBundleMatch = [regex]::Match($servedHtml, 'assets/index-[^"\s]+\.js')
    if (-not $servedBundleMatch.Success) { throw 'LAN User Web HTML did not reference a hashed JavaScript bundle.' }
    $servedBundle = $servedBundleMatch.Value
    if ($servedBundle -ne $lanBundle) { throw "LAN Gateway serves '$servedBundle' but its container contains '$lanBundle'." }
    $cacheControl = if ($response.Headers.CacheControl) { $response.Headers.CacheControl.ToString() } else { '' }
    if ($cacheControl -notmatch 'no-store') { throw "LAN User Web index did not send no-store Cache-Control (received '$cacheControl')." }
}
finally {
    if ($request) { $request.Dispose() }
    if ($response) { $response.Dispose() }
    $client.Dispose()
    $handler.Dispose()
}

Write-Host "LAN User Web: HTTP 200; bundle $servedBundle; Cache-Control: $cacheControl"

if ($tunnelWasRunning -and (Test-ComposeServiceRunning -Prefix $tunnelComposeArgs -Service 'gateway-tunnel')) {
    $tunnelBundle = Get-UserBundleName -Prefix $tunnelComposeArgs -Service 'gateway-tunnel'
    if ($tunnelBundle -ne $servedBundle) {
        throw "LAN/Tunnel bundle mismatch: LAN '$servedBundle', Tunnel '$tunnelBundle'."
    }
    Write-Host "Existing Tunnel User Gateway: bundle $tunnelBundle. The cloudflared connector was not restarted."
}
else {
    Write-Host 'Public User Gateway remains stopped; its image is updated and will use the new bundle when the Tunnel profile is explicitly started.'
}

Write-Host 'Update complete. MySQL, Fastify, Agent, mpv, Sunshine, Apache/PHP, and cloudflared were not rebuilt or restarted.'
