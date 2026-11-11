param([Parameter(Mandatory=$true)][ValidateSet('attendance','inventory')][string]$Target)
$ErrorActionPreference='Stop'
$practiceRoot=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if($practiceRoot -ne 'C:\Users\amben\Desktop\FS_PROJECTS\LMS'){throw 'Unexpected workspace'}
$practicePort=if($Target -eq 'attendance'){2029}else{2030}
$practiceScript=if($Target -eq 'attendance'){'scripts/attendancePreview.js'}else{'scripts/schoolPractice.js'}
$practiceListeners=@(Get-NetTCPConnection -LocalPort $practicePort -State Listen -ErrorAction SilentlyContinue)
if($practiceListeners.Count -ne 1){throw 'Expected exactly one existing practice listener'}
$practiceOld=Get-CimInstance Win32_Process -Filter "ProcessId = $($practiceListeners[0].OwningProcess)"
$practicePattern=[regex]::Escape($practiceScript).Replace('/','[/\\]')
$practiceExpected='[\s"]'+$practicePattern+'"?\s*$'
if($practiceOld.ExecutablePath -ne 'C:\Program Files\nodejs\node.exe' -or $practiceOld.CommandLine -notmatch $practiceExpected){throw 'Practice process ownership check failed'}
Stop-Process -Id $practiceOld.ProcessId
$practiceRun=[guid]::NewGuid().ToString('N')
$practiceNew=Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList $practiceScript -WorkingDirectory $practiceRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $practiceRoot "backups/runtime/$practiceRun.stdout.log") -RedirectStandardError (Join-Path $practiceRoot "backups/runtime/$practiceRun.stderr.log")
[pscustomobject]@{port=$practicePort;processId=$practiceNew.Id;script=$practiceScript;runId=$practiceRun} | ConvertTo-Json | Set-Content -Encoding utf8 -LiteralPath (Join-Path $practiceRoot "backups/runtime/$Target-practice-process.json")
Write-Output "$Target practice listener restarted with process $($practiceNew.Id)"
