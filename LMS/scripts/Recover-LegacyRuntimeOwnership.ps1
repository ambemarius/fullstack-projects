# Reconcile a listener launched outside the tracked launcher. A fresh static
# challenge proves it serves this exact checkout before any process is stopped.
$ErrorActionPreference='Stop'
$runtimeRoot=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if($runtimeRoot -ne 'C:\Users\amben\Desktop\FS_PROJECTS\LMS'){throw 'Unexpected workspace'}
$runtimeListeners=@(Get-NetTCPConnection -LocalPort 2026 -State Listen -ErrorAction Stop)
if($runtimeListeners.Count -ne 1){throw 'Ambiguous original listener'}
$runtimeProcess=Get-CimInstance Win32_Process -Filter "ProcessId = $($runtimeListeners[0].OwningProcess)"
if($runtimeProcess.ExecutablePath -ne 'C:\Program Files\nodejs\node.exe' -or $runtimeProcess.CommandLine -notmatch '[\s"]server\.js"?\s*$'){throw 'Unexpected process; no restart performed'}
$runtimeProof=[guid]::NewGuid().ToString('N')
$runtimeName='lms-runtime-proof-'+[guid]::NewGuid().ToString('N')+'.txt'
$runtimePath=Join-Path $runtimeRoot ('public/'+$runtimeName)
if([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($runtimePath)) -ne (Join-Path $runtimeRoot 'public')){throw 'Invalid proof path'}
try{
    [IO.File]::WriteAllText($runtimePath,$runtimeProof)
    $runtimeResponse=Invoke-WebRequest -Uri ('http://localhost:2026/'+$runtimeName) -UseBasicParsing -TimeoutSec 10
    if($runtimeResponse.StatusCode -ne 200 -or $runtimeResponse.Content -cne $runtimeProof){throw 'Listener does not serve this checkout; no restart performed'}
    $runtimeAgain=@(Get-NetTCPConnection -LocalPort 2026 -State Listen -ErrorAction Stop)
    $runtimeCurrent=Get-CimInstance Win32_Process -Filter "ProcessId = $($runtimeProcess.ProcessId)"
    if($runtimeAgain.Count -ne 1 -or $runtimeAgain[0].OwningProcess -ne $runtimeProcess.ProcessId -or $runtimeCurrent.CreationDate -ne $runtimeProcess.CreationDate -or $runtimeCurrent.CommandLine -cne $runtimeProcess.CommandLine){throw 'Process changed during verification'}
}finally{
    if(Test-Path -LiteralPath $runtimePath){Remove-Item -LiteralPath $runtimePath}
}
Stop-Process -Id $runtimeProcess.ProcessId -ErrorAction Stop
& (Join-Path $PSScriptRoot 'Start-LmsRuntime.ps1') -Target legacy
