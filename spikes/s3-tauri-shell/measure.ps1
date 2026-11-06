# S3 measurement: time until the main window exists, and memory of the app plus its WebView2 processes.
# Usage: powershell -File measure.ps1 [-Runs 5]
param([int]$Runs = 5)
$exe = Join-Path $PSScriptRoot 'src-tauri\target\release\kgb-s3-tauri-shell.exe'

function Get-Tree([int]$root) {
    $all = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, Name, WorkingSetSize, PrivatePageCount
    $ids = @($root); $i = 0
    while ($i -lt $ids.Count) {
        $parent = $ids[$i]
        $ids += @($all | Where-Object { $_.ParentProcessId -eq $parent } | ForEach-Object { [int]$_.ProcessId })
        $i++
    }
    $all | Where-Object { $ids -contains $_.ProcessId }
}

"| Rulare | Fereastră vizibilă (ms) | Procese | Working set total (MB) | Privat total (MB) | Doar exe (MB) |"
"|---|---|---|---|---|---|"
for ($r = 1; $r -le $Runs; $r++) {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    $p = Start-Process $exe -PassThru
    while ($p.MainWindowHandle -eq 0 -and $sw.ElapsedMilliseconds -lt 30000) { Start-Sleep -Milliseconds 10; $p.Refresh() }
    $win = $sw.ElapsedMilliseconds
    Start-Sleep -Seconds 5
    $tree = Get-Tree $p.Id
    $ws = ($tree | Measure-Object WorkingSetSize -Sum).Sum / 1MB
    $pv = ($tree | Measure-Object PrivatePageCount -Sum).Sum / 1MB
    $own = ($tree | Where-Object ProcessId -eq $p.Id).WorkingSetSize / 1MB
    "| $r | $win | $($tree.Count) | $([math]::Round($ws,1)) | $([math]::Round($pv,1)) | $([math]::Round($own,1)) |"
    $p.CloseMainWindow() | Out-Null
    if (-not $p.WaitForExit(5000)) { Stop-Process -Id $p.Id -Force }
    Start-Sleep -Seconds 1
}
