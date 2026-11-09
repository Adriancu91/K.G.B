// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Documentele Word vechi (.doc, Word 97–2003 și Word 6/95): aducem textul, cu paragrafele și tabelele lui, fără formatare.
// Un .doc e un „dosar” binar (Compound File); containerul îl desface SheetJS CE (Apache-2.0, CFB), iar textul îl citim noi
// din fluxul WordDocument după „tabelul de bucăți” (piece table) din specificația publică Microsoft [MS-DOC].

const BAD = 'Fișierul nu pare un document .doc valid sau e deteriorat.';
const u16 = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u32 = (b: Uint8Array, i: number) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Textul principal al documentului (fără antete, note de subsol, comentarii), cu caracterele speciale Word încă în el. */
function mainText(word: Uint8Array, table: (name: string) => Uint8Array | null): string {
  const ident = u16(word, 0);
  const flags = u16(word, 0x0a);
  if (flags & 0x0100) throw new Error('Documentul e protejat cu parolă. Deschide-l în programul în care a fost făcut, scoate parola și salvează-l ca .docx.');
  const cp1252 = new TextDecoder('windows-1252');
  if (ident === 0xa5dc) {
    // Word 6 / 95: textul stă la rând în WordDocument (dacă documentul nu a fost salvat „rapid”, pe bucăți).
    if (flags & 0x0004) throw new Error('Documentul .doc (format foarte vechi) a fost salvat „rapid” (pe bucăți), iar textul lui nu se poate citi aici. Deschide-l în programul în care a fost făcut și salvează-l ca .docx.');
    const fcMin = u32(word, 0x18), ccp = u32(word, 0x34);
    return cp1252.decode(word.subarray(fcMin, fcMin + ccp));
  }
  if (ident !== 0xa5ec) throw new Error(BAD);
  const tbl = table(flags & 0x0200 ? '1Table' : '0Table');
  if (!tbl) throw new Error(BAD);
  const ccpText = u32(word, 0x4c);
  const fcClx = u32(word, 0x1a2), lcbClx = u32(word, 0x1a6);
  let i = fcClx;
  const end = Math.min(tbl.length, fcClx + lcbClx);
  // Clx: întâi grupuri de proprietăți (0x01), apoi tabelul de bucăți (0x02).
  while (i < end && tbl[i] === 0x01) i += 3 + u16(tbl, i + 1);
  if (tbl[i] !== 0x02) throw new Error(BAD);
  const lcb = u32(tbl, i + 1);
  const plc = i + 5;
  const n = Math.floor((lcb - 4) / 12);
  let out = '';
  for (let k = 0; k < n && out.length < ccpText; k++) {
    const cpStart = u32(tbl, plc + k * 4), cpEnd = u32(tbl, plc + (k + 1) * 4);
    const pcd = plc + (n + 1) * 4 + k * 8;
    let fc = u32(tbl, pcd + 2);
    const len = Math.max(0, Math.min(cpEnd, ccpText) - cpStart);
    if (fc & 0x40000000) {
      fc = (fc & 0x3fffffff) / 2;
      out += cp1252.decode(word.subarray(fc, fc + len));
    } else {
      out += new TextDecoder('utf-16le').decode(word.subarray(fc, fc + len * 2));
    }
  }
  return out.slice(0, ccpText);
}

export async function docToHtml(data: Uint8Array): Promise<{ html: string; warnings: number; comments: never[]; changes: never[]; simplified?: boolean; repaired?: boolean }> {
  const { CFB } = await import('xlsx');
  let cfb: ReturnType<typeof CFB.read>;
  try { cfb = CFB.read(data, { type: 'array' }); } catch { throw new Error(BAD); }
  const stream = (name: string) => {
    const e = CFB.find(cfb, name);
    return e?.content ? new Uint8Array(e.content as ArrayLike<number>) : null;
  };
  const word = stream('WordDocument');
  if (!word || word.length < 0x200) {
    if (stream('EncryptionInfo')) throw new Error('Documentul e protejat cu parolă. Deschide-l în programul în care a fost făcut, scoate parola și salvează-l din nou.');
    throw new Error(BAD);
  }
  const text = mainText(word, stream);

  // Câmpurile Word ({ PAGE }, cuprins, legături): păstrăm doar rezultatul, nu și instrucțiunea.
  let warnings = 0;
  let html = '';
  let para = '';
  let row: string[] = [];
  let rows: string[][] = [];
  let lastWasCell = false;
  const fields: boolean[] = []; // pentru fiecare câmp deschis: suntem încă în instrucțiune?
  const flushTable = () => {
    if (!rows.length) return;
    const cols = Math.max(...rows.map((r) => r.length));
    html += '<table>' + rows.map((r) => '<tr>' + Array.from({ length: cols }, (_, c) => `<td><p>${r[c] ?? ''}</p></td>`).join('') + '</tr>').join('') + '</table>';
    rows = [];
  };
  const endPara = () => {
    flushTable();
    html += `<p>${para}</p>`;
    para = '';
  };
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    if (c === 0x13) { fields.push(true); continue; }
    if (c === 0x14) { if (fields.length) fields[fields.length - 1] = false; continue; }
    if (c === 0x15) { fields.pop(); continue; }
    if (fields.some((inInstr) => inInstr)) continue;
    if (c === 0x07) {
      // Sfârșit de celulă; două la rând = sfârșitul rândului de tabel.
      if (lastWasCell && !para) { if (row.length) rows.push(row); row = []; lastWasCell = false; continue; }
      row.push(para);
      para = '';
      lastWasCell = true;
      continue;
    }
    lastWasCell = false;
    if (c === 0x0d) { if (row.length) { para += '<br>'; continue; } endPara(); continue; }
    if (c === 0x0c) { endPara(); continue; } // sfârșit de pagină / secțiune
    if (c === 0x0b) { para += '<br>'; continue; }
    if (c === 0x1e) { para += '-'; continue; }
    if (c === 0x01 || c === 0x08) { warnings++; continue; } // poză sau desen
    if (c < 0x20 && c !== 0x09) continue;
    para += esc(ch);
  }
  if (row.length) rows.push(row);
  if (para || rows.length) endPara();
  return { html: html || '<p></p>', warnings, comments: [], changes: [], simplified: true };
}
