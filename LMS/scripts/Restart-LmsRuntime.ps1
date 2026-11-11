param([Parameter(Mandatory=$true)][ValidateSet('legacy','canonical')][string]$Target)
$ErrorActionPreference='Stop'
$lmsRoot=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if($lmsRoot -ne 'C:\Users\amben\Desktop\FS_PROJECTS\LMS'){throw 'Unexpected workspace'}
$lmsPort=if($Target -eq 'legacy'){2026}else{2027}
$lmsFile=if($Target -eq 'legacy'){'server-state.json'}else{'canonical-school-process.json'}
$lmsScript=if($Target -eq 'legacy'){'server.js'}else{'scripts/canonicalSchool.js'}
$lmsStatePath=Join-Path $lmsRoot "backups/runtime/$lmsFile"
$lmsState=Get-Content -LiteralPath $lmsStatePath -Raw | ConvertFrom-Json
$lmsOld=Get-CimInstance Win32_Process -Filter "ProcessId = $($lmsState.processId)"
$lmsListeners=@(Get-NetTCPConnection -LocalPort $lmsPort -State Listen -ErrorAction SilentlyContinue)
$lmsExpected=if($Target -eq 'legacy'){'[\s"]server\.js"?\s*$'}else{'scripts[/\\]canonicalSchool\.js"?\s*$'}
if(-not $lmsOld -or $lmsOld.ExecutablePath -ne 'C:\Program Files\nodejs\node.exe' -or $lmsOld.CommandLine -notmatch $lmsExpected -or $lmsListeners.Count -ne 1 -or $lmsListeners[0].OwningProcess -ne $lmsState.processId){throw 'Tracked listener ownership check failed'}
Stop-Process -Id $lmsState.processId
$lmsRun=[guid]::NewGuid().ToString('N')
$lmsNew=Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList $lmsScript -WorkingDirectory $lmsRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $lmsRoot "backups/runtime/$lmsRun.stdout.log") -RedirectStandardError (Join-Path $lmsRoot "backups/runtime/$lmsRun.stderr.log")
$lmsPolicy=Get-Content -LiteralPath (Join-Path $lmsRoot 'config/runtimePolicy.json') -Raw | ConvertFrom-Json
[pscustomobject]@{port=$lmsPort;processId=$lmsNew.Id;runId=$lmsRun;target=$Target;policy=$lmsPolicy} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $lmsStatePath
Write-Output "$Target listener restarted: $($lmsNew.Id)"
