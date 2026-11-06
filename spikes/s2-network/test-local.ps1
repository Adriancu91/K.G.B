# S2 local test: two peers on the same PC.
# Usage: powershell -File test-local.ps1 [-Relay none|n0] [-SizeMB 50]
param([string]$Relay = "none", [int]$SizeMB = 50)
$ErrorActionPreference = "Stop"
$exe = Join-Path $PSScriptRoot "target\release\kgb-net-spike.exe"
$root = Join-Path $env:TEMP "kgb-s2-$Relay-$(Get-Random)"
$a = Join-Path $root "A"; $b = Join-Path $root "B"
New-Item -ItemType Directory -Force $a, $b | Out-Null
$log = Join-Path $root "listener.log"

function Check($label, $out, $pattern) {
    $ok = ($out -join "`n") -match $pattern
    "| $label | $(if ($ok) { 'PASS' } else { 'FAIL' }) | $((($out | Select-Object -Last 1) -replace '\|','/'))"
    if (-not $ok) { $script:failed = $true }
}
$failed = $false

$listener = Start-Process $exe -ArgumentList "listen `"$a`" --relay $Relay" -RedirectStandardOutput $log -PassThru -WindowStyle Hidden
$t0 = Get-Date
while (-not (Select-String -Path $log -Pattern '^READY' -Quiet -ErrorAction SilentlyContinue)) {
    if (((Get-Date) - $t0).TotalSeconds -gt 30) { throw "listener not ready" }
    Start-Sleep -Milliseconds 200
}
$invite = ((Select-String -Path $log -Pattern '^INVITE ').Line -split ' ', 2)[1]

try {
"| Test (relay=$Relay) | Rezultat | Detaliu |"
"|---|---|---|"
Check "Asociere cu invitație" (& $exe pair $b $invite --relay $Relay) '^OK paired'
Check "Invitația nu se poate refolosi" (& $exe pair (Join-Path $root "C") $invite --relay $Relay) 'FAIL .*invalid'
Check "Mesaj criptat" (& $exe msg $b "salut din B" --relay $Relay) '^OK delivered'
Check "Dispozitiv neasociat refuzat" (& {
    New-Item -ItemType Directory -Force (Join-Path $root "D") | Out-Null
    $st = Get-Content (Join-Path $b "state.json") -Raw | ConvertFrom-Json
    @{ trusted = @(); invites = @(); remote = $st.remote } | ConvertTo-Json -Depth 10 | Set-Content -Encoding ascii (Join-Path $root "D\state.json")
    & $exe msg (Join-Path $root "D") "intrus" --relay $Relay
}) 'FAIL .*neasociat'

$file = Join-Path $root "test.bin"
$bytes = New-Object byte[] ($SizeMB * 1MB); (New-Object Random 42).NextBytes($bytes); [IO.File]::WriteAllBytes($file, $bytes)
$abort = [int]($SizeMB * 1MB * 0.4)
Check "Transfer întrerupt la ~40%" (& $exe send $b $file --abort-after $abort --relay $Relay) '^ABORTED'
Start-Sleep -Milliseconds 500
Check "Reluare transfer + BLAKE3" (& $exe send $b $file --relay $Relay) 'OK file .* resumed from [1-9]'
$recv = Join-Path $a "incoming\test.bin"
$same = $false; $sw = [Diagnostics.Stopwatch]::StartNew()
while (-not $same -and $sw.Elapsed.TotalSeconds -lt 30) {
    # The file may be locked for a while right after the rename (antivirus scan).
    try { $same = (Get-FileHash $recv -ErrorAction Stop).Hash -eq (Get-FileHash $file).Hash; break } catch { Start-Sleep -Milliseconds 250 }
}
Check "Fișier identic la destinație (SHA256 independent)" @("identic=$same, fișier blocat $([int]$sw.Elapsed.TotalMilliseconds) ms după primire") 'identic=True'
Check "Transfer complet (fără reluare)" (& {
    $f2 = Join-Path $root "test2.bin"; (New-Object Random 7).NextBytes($bytes); [IO.File]::WriteAllBytes($f2, $bytes)
    & $exe send $b $f2 --relay $Relay
}) 'OK file .* resumed from 0'

} finally {
    Stop-Process -Id $listener.Id -Force -ErrorAction SilentlyContinue
}
""
"Listener events:"
Get-Content $log | Where-Object { $_ -match '^EVENT' } | ForEach-Object { "    $_" }
if ($failed) { exit 1 }
