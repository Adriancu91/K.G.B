# Etapa 3, pasul 3.1: verificare independentă a PDF-urilor de test cu
# cititorul PDF inclus în Windows (Windows.Data.Pdf). Afișează pentru fiecare
# fișier numărul de pagini văzut de Windows sau eroarea.
#   powershell -File testdata/etapa3/validate-windows-pdf.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Data.Pdf.PdfDocument, Windows.Data.Pdf, ContentType = WindowsRuntime]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
function Await($op, [Type]$t) {
    $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op))
    if (-not $task.Wait(20000)) { throw 'timeout' }
    $task.Result
}
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Get-ChildItem -Path (Join-Path $root 'files'), (Join-Path $root 'large') -Recurse -Filter *.pdf | Sort-Object FullName | ForEach-Object {
    $rel = $_.FullName.Substring($root.Length + 1).Replace('\', '/')
    try {
        $f = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($_.FullName)) ([Windows.Storage.StorageFile])
        $d = Await ([Windows.Data.Pdf.PdfDocument]::LoadFromFileAsync($f)) ([Windows.Data.Pdf.PdfDocument])
        "{0}`tpagini={1}" -f $rel, $d.PageCount
    } catch {
        $m = $_.Exception.InnerException
        while ($m -and $m.InnerException) { $m = $m.InnerException }
        "{0}`tEROARE {1}" -f $rel, ($(if ($m) { $m.Message } else { $_.Exception.Message }) -replace '\s+', ' ')
    }
}
