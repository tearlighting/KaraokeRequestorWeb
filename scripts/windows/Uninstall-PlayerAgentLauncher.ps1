$ErrorActionPreference='Stop'
$taskName='Yukari Player Agent Launcher'
$task=Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if(-not $task){Write-Host 'Player Agent Launcher login task is not installed.';exit 0}
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
Write-Host 'Login task removed. An already running launcher is left untouched; stop it from Admin before closing the user session.'
