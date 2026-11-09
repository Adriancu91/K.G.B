// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Decupare / Copiere / Lipire din butoane și din meniul de clic dreapta, la fel ca Ctrl+X / Ctrl+C / Ctrl+V.
// În Electron, „lipire” din cod e blocată pentru pagină (document.execCommand('paste') nu face nimic), așa că
// comanda trece prin procesul principal (webContents.cut / copy / paste), care o trimite elementului cu cursorul
// exact ca tastele: tabelul, documentul sau caseta își primesc evenimentele lor obișnuite de lipire.
export type ClipCmd = 'cut' | 'copy' | 'paste';

export function clipCmd(cmd: ClipCmd): void {
  const bridge = window.suite?.editCommand;
  if (typeof bridge === 'function') bridge(cmd);
  else document.execCommand(cmd);
}
