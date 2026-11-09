// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Tabelele Excel vechi (.xls, Excel 97–2003) și cele binare (.xlsb): le citește SheetJS CE (Apache-2.0), le rescrie în memorie
// ca .xlsx și le dăm cititorului nostru obișnuit, deci ajung în Sheets la fel ca un .xlsx (valori, formule, foi, celule unite).
// Se pierde o parte din formatare (culori, chenare), pe care SheetJS CE nu o citește din formatele vechi.
import { readXlsx, XlsxImport } from './xlsx';

export async function readXls(data: Uint8Array): Promise<XlsxImport> {
  // Un raport „.xls” care e de fapt o pagină web cu tabele (îl salvează așa multe programe de gestiune): cititorul nostru de tabele HTML.
  const html = await import('./htmlTable');
  if (html.looksLikeHtmlTable(data)) return html.readHtmlTable(data);
  const XLSX = await import('xlsx');
  let wb: import('xlsx').WorkBook;
  try {
    wb = XLSX.read(data, { type: 'array', cellFormula: true, cellNF: true, cellDates: false, WTF: false });
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (/password|encrypt/i.test(msg)) throw new Error('Tabelul e protejat cu parolă. Deschide-l în programul în care a fost făcut, scoate parola și salvează-l din nou.');
    throw new Error('Fișierul nu pare un tabel .xls / .xlsb valid sau e deteriorat.');
  }
  if (!wb.SheetNames.length) throw new Error('Tabelul nu are nicio foaie pe care s-o pot citi.');
  // Numele foilor citite greșit din fișiere ciudate (caractere de control, prea lungi) nu s-ar putea scrie în .xlsx:
  // le curățăm și, dacă nu rămâne nimic citibil, le numim „Foaia N”.
  const used = new Set<string>();
  wb.SheetNames = wb.SheetNames.map((old, i) => {
    let name = old.replace(/[\u0000-\u001f\u007f-\u009f\ud800-\udfff:\\/?*[\]]/g, '').trim().slice(0, 31);
    if (!name || /[\u0000-\u001f]/.test(old)) name = `Foaia ${i + 1}`;
    while (used.has(name.toLowerCase())) name = `${name.slice(0, 28)} ${i + 1}`;
    used.add(name.toLowerCase());
    if (name !== old) { wb.Sheets[name] = wb.Sheets[old]; delete wb.Sheets[old]; }
    return name;
  });
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx', compression: true }) as ArrayBuffer;
  return readXlsx(new Uint8Array(out));
}
