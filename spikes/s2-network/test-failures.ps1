# S2.2: failure behaviour. Every case must end with a clear error in bounded time, never hang.
# Usage: powershell -File test-failures.ps1
$ErrorActionPreference = "Stop"
$exe = Join-Path $PSScriptRoot "target\release\kgb-net-spike.exe"
$root = Join-Path $env:TEMP "kgb-s2-fail-$(Get-Random)"
$deadRelay = "http://127.0.0.1:9"   # nothing listens there
$failed = $false

function Start-Listener($dir, $extra) {
    New-Item -ItemType Directory -Force $dir | Out-Null
    $log = Join-Path $dir "listener.log"
    $p = Start-Process $exe -ArgumentList "listen `"$dir`" $extra" -RedirectStandardOutput $log -PassThru -WindowStyle Hidden
    $t0 = Get-Date
    while (-not (Select-String -Path $log -Pattern '^READY' -Quiet -ErrorAction SilentlyContinue)) {
        if (((Get-Date) - $t0).TotalSeconds -gt 60) { Stop-Process -Id $p.Id -Force; throw "listener not ready: $extra" }
        Start-Sleep -Milliseconds 200
    }
    $invite = ((Select-String -Path $log -Pattern '^INVITE ').Line -split ' ', 2)[1]
    $startup = ((Select-String -Path $log -Pattern '^STARTUP ').Line -split ' ')[1]
    return @{ Proc = $p; Invite = $invite; Startup = $startup }
}

function Case($label, [scriptblock]$run, $pattern, $maxSeconds) {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    $out = & $run
    $s = [math]::Round($sw.Elapsed.TotalSeconds, 1)
    $last = (($out | Select-Object -Last 1) -replace '\|', '/')
    $ok = (($out -join "`n") -match $pattern) -and $s -le $maxSeconds
    if (-not $ok) { $script:failed = $true }
    "| $label | $(if ($ok) { 'PASS' } else { 'FAIL' }) | $s s (max $maxSeconds) | $last |"
}

"| Caz | Rezultat | Timp | Mesaj |"
"|---|---|---|---|"

# 1. Paired peer goes offline -> clear error after the connect timeout.
$l = Start-Listener (Join-Path $root "A1") "--relay none"
& $exe pair (Join-Path $root "B1") $l.Invite --relay none | Out-Null
Stop-Process -Id $l.Proc.Id -Force
Case "Peer oprit (fără relay)" { & $exe msg (Join-Path $root "B1") "hello?" --relay none } '^FAIL conexiune' 20

# 2. Relay configured but unreachable: listener still starts; direct LAN path still works.
$l = Start-Listener (Join-Path $root "A2") "--relay $deadRelay"
"| Pornire listener cu relay mort | INFO | $($l.Startup) ms | pornește și dă invitație cu adrese directe |"
Case "Relay mort, cale directă disponibilă" { & $exe pair (Join-Path $root "B2") $l.Invite --relay $deadRelay } '^OK paired' 20
Stop-Process -Id $l.Proc.Id -Force

# 3. Relay is the ONLY path and it is down -> clear error, bounded time.
$l = Start-Listener (Join-Path $root "A3") "--relay $deadRelay --relay-only"
Case "Doar relay, relay mort" { & $exe pair (Join-Path $root "B3") $l.Invite --relay $deadRelay } '^FAIL conexiune' 20
Stop-Process -Id $l.Proc.Id -Force

# 4. Garbage invitation -> immediate, clear error.
Case "Invitație coruptă" { & $exe pair (Join-Path $root "B4") "NOTAVALIDINVITE" --relay none } '^FAIL invitație ilizibilă' 2

# 5. Message before pairing -> immediate, clear error.
Case "Mesaj fără asociere" { & $exe msg (Join-Path $root "B5") "hi" --relay none } '^FAIL nu există un peer asociat' 2

Get-Process kgb-net-spike -ErrorAction SilentlyContinue | Stop-Process -Force
if ($failed) { exit 1 }
