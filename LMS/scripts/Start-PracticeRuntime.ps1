param([Parameter(Mandatory=$true)][ValidateSet('attendance','inventory')][string]$Target)
$ErrorActionPreference='Stop'
$practiceRoot=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if($practiceRoot -ne 'C:\Users\amben\Desktop\FS_PROJECTS\LMS'){throw 'Unexpected workspace'}
$practicePort=if($Target -eq 'attendance'){2029}else{2030}
$practiceScript=if($Target -eq 'attendance'){'scripts/attendancePreview.js'}else{'scripts/schoolPractice.js'}
$practiceNode='C:\Program Files\nodejs\node.exe'
$practiceStatePath=Join-Path $practiceRoot "backups/runtime/$Target-practice-process.json"
$practiceExpected='[\s"]'+[regex]::Escape($practiceScript).Replace('/','[/\\]')+'"?\s*$'
if(@(Get-NetTCPConnection -State Listen | Where-Object LocalPort -eq $practicePort).Count){throw 'Port already listening; cold start refused'}
if(Test-Path -LiteralPath $practiceStatePath){
    $practiceState=Get-Content -LiteralPath $practiceStatePath -Raw | ConvertFrom-Json
    $practiceOld=Get-CimInstance Win32_Process -Filter "ProcessId = $([int]$practiceState.processId)"
    if($practiceOld -and $practiceOld.ExecutablePath -eq $practiceNode -and $practiceOld.CommandLine -match $practiceExpected){throw 'Tracked process still exists; cold start refused'}
}
$practiceRun=[guid]::NewGuid().ToString('N')
# Entry points enforce the approved synthetic database marker before sample setup.
$practiceNew=Start-Process -FilePath $practiceNode -ArgumentList $practiceScript -WorkingDirectory $practiceRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $practiceRoot "backups/runtime/$practiceRun.stdout.log") -RedirectStandardError (Join-Path $practiceRoot "backups/runtime/$practiceRun.stderr.log")
for($practiceAttempt=0;$practiceAttempt -lt 40;$practiceAttempt++){
    if($practiceNew.HasExited){throw "Practice startup failed; review run $practiceRun"}
    $practiceListeners=@(Get-NetTCPConnection -State Listen | Where-Object LocalPort -eq $practicePort)
    if($practiceListeners.Count){
        $practiceCurrent=Get-CimInstance Win32_Process -Filter "ProcessId = $($practiceNew.Id)"
        if($practiceListeners.Count -ne 1 -or $practiceListeners[0].OwningProcess -ne $practiceNew.Id -or $practiceCurrent.ExecutablePath -ne $practiceNode -or $practiceCurrent.CommandLine -notmatch $practiceExpected){throw 'Listener ownership mismatch'}
        [pscustomobject]@{port=$practicePort;processId=$practiceNew.Id;script=$practiceScript;runId=$practiceRun} | ConvertTo-Json | Set-Content -Encoding utf8 -LiteralPath $practiceStatePath
        Write-Output "$Target practice ready on $practicePort (verified PID $($practiceNew.Id))";return
    }
    Start-Sleep -Milliseconds 400
}
throw "Startup timed out; no process stopped. Review PID $($practiceNew.Id) and run $practiceRun"
