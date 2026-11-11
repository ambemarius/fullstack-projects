param([Parameter(Mandatory=$true)][string]$Email,[switch]$Apply,[switch]$ValidateOnly)
$ErrorActionPreference='Stop'
if($Email -notmatch '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'){throw 'Use a standard teacher email address.'}
if($Apply -and $ValidateOnly){throw 'Choose Apply or ValidateOnly, not both.'}
$lmsRoot=Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $lmsRoot
try{
 $lmsReviewText=& node (Join-Path $PSScriptRoot 'recoverTeacherPassword.js') --email $Email
 if($LASTEXITCODE -ne 0){throw 'Account/target review failed; nothing changed.'}
 $lmsReview=$lmsReviewText | ConvertFrom-Json
 $lmsReview | Format-List
 if(-not $Apply -and -not $ValidateOnly){Write-Host 'Review only. No password changed. Use -Apply to reset this reviewed teacher account.';return}
 Write-Host 'Enter the password privately. Apply updates both credential copies and invalidates old logins; status and permissions remain unchanged.'
 $lmsFirst=Read-Host 'New password (12 characters minimum; 72 UTF-8 bytes maximum)' -AsSecureString
 $lmsSecond=Read-Host 'Confirm new password' -AsSecureString
 function Get-LmsPrivateText([Security.SecureString]$Value){$lmsPointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value);try{return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($lmsPointer)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($lmsPointer)}}
 $lmsNewPassword=Get-LmsPrivateText $lmsFirst
 $lmsConfirmPassword=Get-LmsPrivateText $lmsSecond
 if($lmsNewPassword -cne $lmsConfirmPassword){throw 'Passwords differ; nothing changed.'}
 if($lmsNewPassword.Length -lt 12 -or [Text.Encoding]::UTF8.GetByteCount($lmsNewPassword) -gt 72){throw 'Use at least 12 characters and at most 72 UTF-8 bytes. Nothing changed.'}
 $lmsInfo=[Diagnostics.ProcessStartInfo]::new()
 $lmsInfo.FileName=(Get-Command node.exe).Source
 $lmsInfo.WorkingDirectory=$lmsRoot
 $lmsInfo.UseShellExecute=$false
 $lmsInfo.CreateNoWindow=$true
 $lmsInfo.RedirectStandardInput=$true
 $lmsInfo.RedirectStandardOutput=$true
 $lmsInfo.RedirectStandardError=$true
 $lmsNodeScript=Join-Path $PSScriptRoot 'recoverTeacherPassword.js'
 $lmsOperation=if($ValidateOnly){'--check-input'}else{'--apply'}
 $lmsInfo.Arguments='"'+$lmsNodeScript+'" '+$lmsOperation+' --email "'+$Email+'" --expected-id '+[string][int]$lmsReview.teacherId+' --expected-version '+[string][int]$lmsReview.securityVersion
 $lmsChild=[Diagnostics.Process]::Start($lmsInfo)
 $lmsChild.StandardInput.WriteLine((@{password=$lmsNewPassword}|ConvertTo-Json -Compress))
 $lmsChild.StandardInput.Close()
 $lmsOutput=$lmsChild.StandardOutput.ReadToEnd()
 $lmsError=$lmsChild.StandardError.ReadToEnd()
 $lmsChild.WaitForExit()
 if($lmsChild.ExitCode -ne 0){
  $lmsSafe=$null;try{$lmsSafe=$lmsError.Trim()|ConvertFrom-Json}catch{}
  $lmsCodes=@('PASSWORD_TOO_SHORT','PASSWORD_TOO_LONG','INVALID_REVIEW','INVALID_EMAIL','TEACHER_NOT_FOUND','OPERATOR_REQUIRED','RUNTIME_NOT_READY','REVIEW_CHANGED','WRONG_TARGET','INPUT_FORMAT','DATABASE_LOGIN_FAILED','DATABASE_ERROR','RECOVERY_FAILED')
  if($lmsSafe -and $lmsSafe.code -in $lmsCodes){throw ($lmsSafe.code+': '+$lmsSafe.message)}
  throw 'Recovery failed; credentials withheld. No successful reset is claimed.'
 }
 $lmsOutput|ConvertFrom-Json|Format-List
}finally{
 $lmsNewPassword=$null;$lmsConfirmPassword=$null
 if($lmsFirst){$lmsFirst.Dispose()};if($lmsSecond){$lmsSecond.Dispose()}
 Pop-Location
}
