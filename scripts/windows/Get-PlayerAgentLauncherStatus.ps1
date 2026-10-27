$ErrorActionPreference='Continue'
$taskName='Yukari Player Agent Launcher'
$task=Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if($task){$info=Get-ScheduledTaskInfo -TaskName $taskName -ErrorAction SilentlyContinue;Write-Host "Login task: $($task.State); last result: $($info.LastTaskResult)"}
else{$null=& schtasks.exe /Query /TN $taskName 2>$null;if($LASTEXITCODE -eq 0){Write-Host 'Login task: present; Task Scheduler state is unavailable in this PowerShell context.'}else{Write-Host 'Login task: status unknown in this PowerShell context; Task Scheduler query was denied or unavailable.'}}
$lockPath=Join-Path $env:LOCALAPPDATA 'YukariPlayerAgent/runtime-v2/launcher.lock'
if(Test-Path -LiteralPath $lockPath){
    try{$record=Get-Content -LiteralPath $lockPath -Raw|ConvertFrom-Json;$proc=Get-Process -Id ([int]$record.pid) -ErrorAction Stop
        $node=(Get-Command node.exe -ErrorAction Stop).Source;$lockStart=[datetimeoffset]::FromUnixTimeMilliseconds([long]$record.startedAt).LocalDateTime
        if($proc.ProcessName -eq 'node' -and $proc.Path -eq $node -and [math]::Abs(($proc.StartTime-$lockStart).TotalSeconds) -lt 3){Write-Host "Launcher process: verified running (PID $($record.pid))"}else{Write-Host 'Launcher process: PID is live but identity does not match; do not remove its lock.'}
    }catch{Write-Host 'Launcher process: status cannot be verified; check the local logs before changing the lock.'}
}else{Write-Host 'Launcher process: not running'}
Write-Host 'Local logs: %LOCALAPPDATA%\YukariPlayerAgent\logs\launcher.log and agent.stderr.log'
