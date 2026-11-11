param([Parameter(Mandatory=$true)][ValidateSet('legacy','canonical')][string]$Target)
$ErrorActionPreference='Stop'
$lmsRoot=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if($lmsRoot -ne 'C:\Users\amben\Desktop\FS_PROJECTS\LMS'){throw 'Unexpected LMS workspace'}
$lmsPort=if($Target -eq 'legacy'){2026}else{2027}
$lmsFile=if($Target -eq 'legacy'){'server-state.json'}else{'canonical-school-process.json'}
$lmsScript=if($Target -eq 'legacy'){'server.js'}else{'scripts/canonicalSchool.js'}
$lmsExpected=if($Target -eq 'legacy'){'[\s"]server\.js"?\s*$'}else{'scripts[/\\]canonicalSchool\.js"?\s*$'}
$lmsDir=Join-Path $lmsRoot 'backups/runtime'
$lmsStatePath=Join-Path $lmsDir $lmsFile
$lmsNode='C:\Program Files\nodejs\node.exe'
# Cold starts only. Do not kill a process, compete with a starting listener, or adopt another one.
$lmsListeners=@(Get-NetTCPConnection -State Listen | Where-Object LocalPort -eq $lmsPort)
if($lmsListeners.Count){throw "Port $lmsPort is already listening; cold start refused"}
if(Test-Path -LiteralPath $lmsStatePath){
    $lmsOld=Get-Content -LiteralPath $lmsStatePath -Raw | ConvertFrom-Json
    $lmsProcess=Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$lmsOld.processId)"
    if($lmsProcess -and $lmsProcess.ExecutablePath -eq $lmsNode -and $lmsProcess.CommandLine -match $lmsExpected){throw 'Tracked LMS process still exists; cold start refused'}
}
$lmsRun=[guid]::NewGuid().ToString('N')
$lmsPolicy=Get-Content -LiteralPath (Join-Path $lmsRoot 'config/runtimePolicy.json') -Raw | ConvertFrom-Json
$lmsNew=Start-Process -FilePath $lmsNode -ArgumentList $lmsScript -WorkingDirectory $lmsRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $lmsDir "$lmsRun.stdout.log") -RedirectStandardError (Join-Path $lmsDir "$lmsRun.stderr.log")
for($lmsAttempt=0;$lmsAttempt -lt 30;$lmsAttempt++){
    if($lmsNew.HasExited){throw "$Target did not start; review run $lmsRun"}
    $lmsListeners=@(Get-NetTCPConnection -State Listen | Where-Object LocalPort -eq $lmsPort)
    if($lmsListeners.Count){
        $lmsProcess=Get-CimInstance Win32_Process -Filter "ProcessId = $($lmsNew.Id)"
        if($lmsListeners.Count -ne 1 -or $lmsListeners[0].OwningProcess -ne $lmsNew.Id -or $lmsProcess.ExecutablePath -ne $lmsNode -or $lmsProcess.CommandLine -notmatch $lmsExpected){throw 'New listener ownership mismatch; state not replaced'}
        [pscustomobject]@{port=$lmsPort;processId=$lmsNew.Id;runId=$lmsRun;target=$Target;policy=$lmsPolicy} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $lmsStatePath
        Write-Output "$Target listening on port $lmsPort (verified PID $($lmsNew.Id))";return
    }
    Start-Sleep -Milliseconds 400
}
throw "$Target did not listen within the startup window; no process stopped. Check PID $($lmsNew.Id) and run $lmsRun."
