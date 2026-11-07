# Spike S4 / D-035: OCR-ul inclus în Windows (Windows.Media.Ocr), fără programe
# descărcate. Afișează limbile OCR instalate și textul recunoscut dintr-o imagine.
#   powershell -File spikes/s4-pdf/ocr-windows.ps1 <imagine.png>
param([Parameter(Mandatory)][string]$Image)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
function Await($op, [Type]$t) {
    $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op))
    if (-not $task.Wait(30000)) { throw 'timeout' }
    $task.Result
}
"Limbi OCR disponibile: " + (([Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | ForEach-Object { $_.LanguageTag }) -join ', ')
$ro = [Windows.Globalization.Language]::new('ro')
if ([Windows.Media.Ocr.OcrEngine]::IsLanguageSupported($ro)) {
    "Folosesc: ro"
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($ro)
} else {
    "Româna nu e instalată pentru OCR; folosesc limbile profilului"
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
}
$file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync((Resolve-Path $Image).Path)) ([Windows.Storage.StorageFile])
$stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$sw = [Diagnostics.Stopwatch]::StartNew()
$result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
"Timp OCR: {0} ms; rânduri: {1}; limita imaginii: {2} px" -f $sw.ElapsedMilliseconds, $result.Lines.Count, [Windows.Media.Ocr.OcrEngine]::MaxImageDimension
$result.Lines | ForEach-Object { $_.Text }
