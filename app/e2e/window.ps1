# Helper for the e2e tests: is the "K.G.B." window of a process shown, and
# closing it the way the title-bar X does (WM_CLOSE). Looks for the window
# by its title: the windowing library also has an invisible helper window,
# which .NET's MainWindowHandle may pick instead.
param([int]$ProcId, [switch]$Close)
Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class KgbWin {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  public static IntPtr Find(uint want) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((h, l) => { uint p; GetWindowThreadProcessId(h, out p);
      if (p == want) { var t = new StringBuilder(64); GetWindowText(h, t, 64); if (t.ToString() == "K.G.B.") { found = h; return false; } }
      return true; }, IntPtr.Zero);
    return found;
  }
}
"@
$h = [KgbWin]::Find($ProcId)
if ($h -eq [IntPtr]::Zero) { "lipsa"; exit }
if ($Close) { [void][KgbWin]::PostMessage($h, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero); "inchis"; exit }
if ([KgbWin]::IsWindowVisible($h)) { "vizibil" } else { "ascuns" }
