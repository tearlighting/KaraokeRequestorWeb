$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName Microsoft.VisualBasic
$configDir = Join-Path $env:LOCALAPPDATA 'YukariPlayerAgent'
New-Item -ItemType Directory -Force -Path $configDir | Out-Null

$mediaDialog = [Windows.Forms.FolderBrowserDialog]::new()
$mediaDialog.Description = 'Select the one local media folder allowed to the Player Agent. No other folders are scanned.'
$mediaDialog.ShowNewFolderButton = $false
if ($mediaDialog.ShowDialog() -ne [Windows.Forms.DialogResult]::OK) { Write-Host 'Canceled; no settings saved.'; exit 0 }
$mediaRoot = (Resolve-Path -LiteralPath $mediaDialog.SelectedPath).Path

$mpvDialog = [Windows.Forms.OpenFileDialog]::new()
$mpvDialog.Title = 'Select mpv.exe'
$mpvDialog.Filter = 'mpv.exe|mpv.exe|Executable (*.exe)|*.exe'
$mpvDialog.CheckFileExists = $true
$knownMpv = Join-Path (Join-Path $env:ProgramFiles 'MPV Player') 'mpv.exe'
if (Test-Path -LiteralPath $knownMpv) { $mpvDialog.FileName = $knownMpv }
if ($mpvDialog.ShowDialog() -ne [Windows.Forms.DialogResult]::OK) { Write-Host 'Canceled; no settings saved.'; exit 0 }
$mpvPath = (Resolve-Path -LiteralPath $mpvDialog.FileName).Path

$testVideo = ''
$videoDialog = [Windows.Forms.OpenFileDialog]::new()
$videoDialog.Title = 'Optional test video under the selected media root'
$videoDialog.Filter = 'Video files|*.mp4;*.mkv;*.avi;*.mov;*.wmv|All files|*.*'
$videoDialog.InitialDirectory = $mediaRoot
$videoDialog.CheckFileExists = $true
if ($videoDialog.ShowDialog() -eq [Windows.Forms.DialogResult]::OK) {
    $selected = (Resolve-Path -LiteralPath $videoDialog.FileName).Path
    $rootPrefix = $mediaRoot.TrimEnd([char]92) + [char]92
    if (-not $selected.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'The test video must be inside the selected media root.' }
    $testVideo = $selected.Substring($rootPrefix.Length)
}

$sourceRoot = [Microsoft.VisualBasic.Interaction]::InputBox('Enter an exact, verified Legacy POSIX fullpath root prefix. Leave empty to keep POSIX paths unmapped.', 'POSIX path mapping', '')
$mappings = @()
if (-not [string]::IsNullOrWhiteSpace($sourceRoot)) {
    $normalizedSource = $sourceRoot.TrimEnd('/')
    if (-not $sourceRoot.StartsWith('/') -or $sourceRoot.Contains('//') -or $sourceRoot.IndexOf([char]92) -ge 0 -or
        @($normalizedSource.Split('/') | Where-Object { $_ -in @('.', '..') }).Count -gt 0 -or $normalizedSource.Length -lt 2) {
        throw 'Mapping source must be a specific normalized absolute POSIX directory.'
    }
    $mappings = @(@{ source = $normalizedSource; target = $mediaRoot })
}
$safeHost = $env:COMPUTERNAME -replace '[^A-Za-z0-9_-]', '_'
$agentId = 'host_' + $safeHost.Substring(0, [Math]::Min(44, $safeHost.Length))
$config = [ordered]@{ agentId = $agentId; apiUrl = 'http://127.0.0.1:3000'; mpvPath = $mpvPath; mediaRoot = $mediaRoot; testVideo = $testVideo; pathMappings = $mappings }
$path = Join-Path $configDir 'agent-config.json'
[IO.File]::WriteAllText($path, ($config | ConvertTo-Json -Depth 6), [Text.UTF8Encoding]::new($false))
Write-Host "Local settings saved to $path"
Write-Host 'The file contains no Agent credential. Empty POSIX mapping means queue files remain unavailable until mapped.'
Write-Host 'Run Start-PlayerAgent.cmd or Start-Yukari.cmd to start the Agent.'
