Option Explicit
Dim shell, fso, scriptPath, powershell, command, arg, i
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptPath = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), "Start-Yukari.ps1")
powershell = shell.ExpandEnvironmentStrings("%SystemRoot%") & "\System32\WindowsPowerShell\v1.0\powershell.exe"
command = Chr(34) & powershell & Chr(34) & " -NoProfile -ExecutionPolicy Bypass -File " & Chr(34) & scriptPath & Chr(34)
For i = 0 To WScript.Arguments.Count - 1
  arg = WScript.Arguments(i)
  command = command & " " & Chr(34) & Replace(arg, Chr(34), Chr(34) & Chr(34)) & Chr(34)
Next
' Hide the startup console. The PowerShell script logs progress and shows a
' dialog only on failure; on success it opens the local web portal.
shell.Run command, 0, False
