[CmdletBinding()]
param([switch]$Register)
$ErrorActionPreference='Stop'
$repoRoot=(Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$taskName='Yukari Player Agent Launcher'
$node=(Get-Command node.exe -ErrorAction Stop).Source
$entry=Join-Path $repoRoot 'agents/player-agent/dist/launcher.js'
if(-not(Test-Path -LiteralPath $entry)){throw 'Launcher build is missing. Run npm.cmd --prefix agents/player-agent run build first.'}
$existing=Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if($existing){throw "Task '$taskName' already exists; inspect it with Get-PlayerAgentLauncherStatus.ps1 and do not overwrite an unknown task."}
$account="$env:USERDOMAIN\$env:USERNAME"
Write-Host "Task name: $taskName"
Write-Host "Trigger: interactive sign-in for $account"
Write-Host "Executable: $node"
Write-Host "Fixed argument: $entry"
Write-Host "Working directory: $repoRoot"
Write-Host 'Run level: Limited; no password is stored.'
if(-not $Register){Write-Host 'Dry run only. Registration requires a separate explicit -Register invocation.';exit 0}
$action=New-ScheduledTaskAction -Execute $node -Argument ('"{0}"' -f $entry) -WorkingDirectory $repoRoot
$trigger=New-ScheduledTaskTrigger -AtLogOn -User $account
$principal=New-ScheduledTaskPrincipal -UserId $account -LogonType Interactive -RunLevel Limited
$settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Runs the fixed Yukari Windows Player Agent launcher; it does not start playback by itself.' | Out-Null
Start-ScheduledTask -TaskName $taskName
$deadline=(Get-Date).AddSeconds(15)
do { Start-Sleep -Seconds 1; $state=(Get-ScheduledTask -TaskName $taskName).State } while($state -ne 'Running' -and (Get-Date) -lt $deadline)
if($state -ne 'Running'){Write-Warning "Task was registered but did not reach Running state (state: $state). Check the local Launcher log.";exit 2}
Write-Host 'Launcher login task registered and started in the current Windows session.'
& (Join-Path $PSScriptRoot 'Get-PlayerAgentLauncherStatus.ps1')
