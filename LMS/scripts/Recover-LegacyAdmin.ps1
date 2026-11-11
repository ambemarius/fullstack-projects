param(
    [Parameter(Mandatory=$true)][string]$Email,
    [switch]$Apply,
    [switch]$ValidateOnly
)
$ErrorActionPreference = 'Stop'
if ($Email -notmatch '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') { throw 'Use a standard administrator email address.' }
$lmsRoot = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $lmsRoot
try {
    $lmsReviewText = & node (Join-Path $PSScriptRoot 'recoverLegacyAdmin.js') --email $Email
    if ($LASTEXITCODE -ne 0) { throw 'Account/target review failed; nothing changed.' }
    $lmsReview = $lmsReviewText | ConvertFrom-Json
    $lmsReview | Format-List
    if ($Apply -and $ValidateOnly) { throw 'Choose Apply or ValidateOnly, not both.' }
    if (-not $Apply -and -not $ValidateOnly) { Write-Host 'Review only. No password changed. Use -Apply only to change this reviewed account.'; return }
    if ($ValidateOnly) { Write-Host 'Private input validation only; no password will be changed.' }
    else { Write-Host 'Changes only the displayed administrator password. Existing tokens keep their normal expiry.' }
    $lmsFirst = Read-Host 'Enter a new password (12 characters minimum; 72 UTF-8 bytes maximum)' -AsSecureString
    $lmsSecond = Read-Host 'Confirm the new password' -AsSecureString
    function Get-LmsPrivateText([Security.SecureString]$Value) {
        $lmsPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
        try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($lmsPointer) }
        finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($lmsPointer) }
    }
    $lmsNewPassword = Get-LmsPrivateText $lmsFirst
    $lmsConfirmPassword = Get-LmsPrivateText $lmsSecond
    if ($lmsNewPassword -cne $lmsConfirmPassword) { throw 'Passwords differ; nothing changed.' }
    if ($lmsNewPassword.Length -lt 12) { throw 'New password must contain at least 12 characters. Nothing changed.' }
    if ([Text.Encoding]::UTF8.GetByteCount($lmsNewPassword) -gt 72) { throw 'New password must not exceed 72 UTF-8 bytes. Nothing changed.' }
    $lmsProcessInfo = [Diagnostics.ProcessStartInfo]::new()
    $lmsProcessInfo.FileName = (Get-Command node.exe).Source
    $lmsProcessInfo.WorkingDirectory = $lmsRoot
    $lmsProcessInfo.UseShellExecute = $false
    $lmsProcessInfo.CreateNoWindow = $true
    $lmsProcessInfo.RedirectStandardInput = $true
    $lmsProcessInfo.RedirectStandardOutput = $true
    $lmsProcessInfo.RedirectStandardError = $true
    # Works in Windows PowerShell and PowerShell 7. No shell is involved, the
    # filename cannot contain quotes, and Email is restricted above to safe characters.
    $lmsNodeScript = Join-Path $PSScriptRoot 'recoverLegacyAdmin.js'
    $lmsOperation = if ($ValidateOnly) { '--check-input' } else { '--apply' }
    $lmsProcessInfo.Arguments = '"' + $lmsNodeScript + '" ' + $lmsOperation + ' --email "' + $Email + '" --expected-id ' + [string][int]$lmsReview.accountId
    $lmsRecoveryProcess = [Diagnostics.Process]::Start($lmsProcessInfo)
    $lmsRecoveryProcess.StandardInput.WriteLine((@{password=$lmsNewPassword} | ConvertTo-Json -Compress))
    $lmsRecoveryProcess.StandardInput.Close()
    $lmsOutput = $lmsRecoveryProcess.StandardOutput.ReadToEnd()
    $lmsErrorOutput = $lmsRecoveryProcess.StandardError.ReadToEnd()
    $lmsRecoveryProcess.WaitForExit()
    if ($lmsRecoveryProcess.ExitCode -ne 0) {
        $lmsSafeFailure = $null
        try { $lmsSafeFailure = $lmsErrorOutput.Trim() | ConvertFrom-Json } catch { }
        # Display only a closed set of structured safe error codes, never raw stderr.
        $lmsAllowedCodes = @('PASSWORD_TOO_SHORT','PASSWORD_TOO_LONG','INVALID_REVIEW','WRONG_TARGET','ACCOUNT_NOT_FOUND','ACCOUNT_CHANGED','CONCURRENT_CHANGE','CANONICAL_RECOVERY_REQUIRED','INPUT_FORMAT','DATABASE_LOGIN_FAILED','DATABASE_ERROR','RECOVERY_FAILED')
        if ($lmsSafeFailure -and $lmsSafeFailure.code -in $lmsAllowedCodes) { throw ($lmsSafeFailure.code + ': ' + $lmsSafeFailure.message) }
        throw 'Recovery failed without a recognised diagnostic. No credentials displayed.'
    }
    $lmsOutput | ConvertFrom-Json | Format-List
} finally {
    $lmsNewPassword = $null
    $lmsConfirmPassword = $null
    if ($lmsFirst) { $lmsFirst.Dispose() }
    if ($lmsSecond) { $lmsSecond.Dispose() }
    Pop-Location
}
