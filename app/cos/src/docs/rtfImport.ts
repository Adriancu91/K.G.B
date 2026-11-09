// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Import .rtf (Rich Text Format, după specificația publică 1.9), scris de noi: paragrafe, aldin / cursiv / subliniat / tăiat,
// indici, culoarea textului și evidențierea (din tabelul de culori), rânduri noi, tabele simple, diacritice (u-escape și octeți
// în pagina de cod a fișierului) și pozele PNG / JPEG / bitmap (pict, cu mărimea lor). Desenele WMF / EMF devin PNG (metafile.ts); obiectele (object) se sar.
import { htmlWithMetafiles, metafileToSvg } from '../metafile';

const B = String.fromCharCode(92);
// Grupurile care nu sunt text de afișat (tabele de fonturi și culori, stiluri, informații, poze, antete, câmpuri…).
const SKIP = new Set(['fonttbl', 'stylesheet', 'info', 'object', 'header', 'footer', 'headerl', 'headerr', 'headerf',
  'footerl', 'footerr', 'footerf', 'fldinst', 'generator', 'listtable', 'listoverridetable', 'themedata', 'colorschememapping', 'datastore',
  'latentstyles', 'rsidtbl', 'xmlnstbl', 'mmathPr', 'filetbl', 'revtbl', 'footnote', 'annotation', 'atnid', 'atnauthor', 'bkmkstart', 'bkmkend',
  'nonshppict', 'pgdsctbl', 'listtext', 'pntext', 'pntxta', 'pntxtb', 'docvar', 'userprops', 'template', 'operator', 'xe', 'tc']);
const SYMBOLS: Record<string, string> = { emdash: '—', endash: '–', bullet: '•', lquote: '‘', rquote: '’', ldblquote: '“', rdblquote: '”', emspace: ' ', enspace: ' ', qmspace: ' ' };

/** `fg` / `bg`: culoarea textului și a evidențierii, ca număr din tabelul de culori (0 = automat); `ctbl`: suntem în tabelul de culori. */
interface St { b: boolean; i: boolean; u: boolean; s: boolean; sub: boolean; sup: boolean; skip: boolean; uc: number; fg: number; bg: number; ctbl?: boolean }
/** O poză în curs de citire: felul, mărimea (picw/pich în pixeli, picwgoal/pichgoal în twips, scara în %), datele (hex sau bin). */
interface Pic { kind: string; w: number; h: number; gw: number; gh: number; sx: number; sy: number; hex: string[]; bin: string[]; depth: number }
// Toate pozele unui fișier, la un loc: peste atât se sar (cu avertisment), ca să nu umple memoria.
const MAX_PIC_BYTES = 40 * 1024 * 1024;
const PIC_KINDS: Record<string, string> = { pngblip: 'png', jpegblip: 'jpeg', dibitmap: 'dib', emfblip: 'emf', wmetafile: 'wmf', wbitmap: 'ddb', macpict: 'mac' };

/** Un DIB (antet BITMAPINFOHEADER + paletă + pixeli) devine fișier .bmp: îi punem în față antetul de fișier de 14 octeți. */
export function dibToBmp(b: Uint8Array): Uint8Array | null {
  if (b.length < 40) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const hs = dv.getUint32(0, true), bits = dv.getUint16(14, true), comp = dv.getUint32(16, true), used = dv.getUint32(32, true);
  if (hs < 40 || hs > b.length) return null;
  const pal = (used || (bits <= 8 ? 1 << bits : 0)) * 4 + (comp === 3 && hs === 40 ? 12 : 0);
  const out = new Uint8Array(14 + b.length);
  const ov = new DataView(out.buffer);
  out[0] = 0x42; out[1] = 0x4d;
  ov.setUint32(2, out.length, true);
  ov.setUint32(10, 14 + hs + pal, true);
  out.set(b, 14);
  return out;
}

const toBase64 = (b: Uint8Array) => { let s = ''; for (let k = 0; k < b.length; k += 0x8000) s += String.fromCharCode(...b.subarray(k, k + 0x8000)); return btoa(s); };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function rtfToHtml(data: Uint8Array): Promise<{ html: string; warnings: number; comments: never[]; changes: never[]; simplified?: boolean; repaired?: boolean }> {
  let src = '';
  for (let k = 0; k < data.length; k += 8192) src += String.fromCharCode(...data.subarray(k, k + 8192));
  if (!src.trimStart().startsWith('{' + B + 'rtf')) throw new Error('Fișierul nu este un document .rtf.');
  let decoder = new TextDecoder('windows-1252');
  const byte = (n: number) => (n < 128 ? String.fromCharCode(n) : decoder.decode(new Uint8Array([n])));
  let st: St = { b: false, i: false, u: false, s: false, sub: false, sup: false, skip: false, uc: 1, fg: 0, bg: 0 };
  // Tabelul de culori: {\colortbl;\red255\green0\blue0;…}; prima intrare (goală) e culoarea automată.
  const colors: (string | null)[] = [];
  let rgb: number[] | null = null;
  const stack: St[] = [];
  const out: string[] = [];
  let para = '', run = '', runKey = '', skipChars = 0, warnings = 0;
  let cell = '', row: string[] = [], rows: string[][] = [], inTbl = false;
  let pic: Pic | null = null, picBytes = 0;
  const finishPic = () => {
    const p = pic!; pic = null;
    let bytes: Uint8Array;
    if (p.bin.length) bytes = Uint8Array.from(p.bin.join(''), (c) => c.charCodeAt(0) & 255);
    else {
      const h = p.hex.join('').replace(/[^0-9a-fA-F]/g, '');
      bytes = new Uint8Array(h.length >> 1);
      for (let k = 0; k < bytes.length; k++) bytes[k] = parseInt(h.substr(k * 2, 2), 16);
    }
    // Felul se ia din cuvântul de control, dar și din primii octeți (unele programe scriu greșit).
    let kind = p.kind;
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) kind = 'png';
    else if (bytes[0] === 0xff && bytes[1] === 0xd8) kind = 'jpeg';
    let mime = kind === 'png' ? 'image/png' : kind === 'jpeg' ? 'image/jpeg' : '';
    if (kind === 'dib') { const bmp = dibToBmp(bytes); if (bmp) { bytes = bmp; mime = 'image/bmp'; } }
    // Desenele .wmf / .emf: le lăsăm cu felul lor, iar la final htmlWithMetafiles le face PNG (doar dacă au ce desena).
    if ((kind === 'wmf' || kind === 'emf') && metafileToSvg(bytes)) mime = `image/x-${kind}`;
    if (!mime || !bytes.length || picBytes + bytes.length > MAX_PIC_BYTES) { warnings++; return; }
    picBytes += bytes.length;
    // Mărimea afișată: picwgoal în twips (1 px = 15 twips la 96 dpi), altfel picw în pixeli; apoi scara.
    const w = (p.gw > 0 ? p.gw / 15 : p.w) * (p.sx > 0 ? p.sx / 100 : 1);
    const img = `<img src="data:${mime};base64,${toBase64(bytes)}"${w >= 1 ? ` width="${Math.round(w)}"` : ''} alt="">`;
    flushRun();
    if (inTbl) cell += img; else para += img;
  };
  const key = () => `${+st.b}${+st.i}${+st.u}${+st.s}${+st.sub}${+st.sup}|${st.fg}|${st.bg}`;
  const flushRun = () => {
    if (!run) return;
    let h = esc(run);
    const [flags, fg, bg] = runKey.split('|');
    const [b, i, u, s, sub, sup] = flags.split('').map((x) => x === '1');
    if (sub) h = `<sub>${h}</sub>`; if (sup) h = `<sup>${h}</sup>`;
    const fc = colors[Number(fg)], bc = colors[Number(bg)];
    if (fc && Number(fg)) h = `<span style="color: ${fc}">${h}</span>`;
    if (bc && Number(bg)) h = `<mark data-color="${bc}" style="background-color: ${bc}">${h}</mark>`;
    if (s) h = `<s>${h}</s>`; if (u) h = `<u>${h}</u>`; if (i) h = `<em>${h}</em>`; if (b) h = `<strong>${h}</strong>`;
    if (inTbl) cell += h; else para += h;
    run = '';
  };
  const text = (t: string) => {
    if (st.skip) return;
    if (skipChars > 0) { skipChars--; return; }
    const k = key();
    if (k !== runKey) { flushRun(); runKey = k; }
    run += t;
  };
  const flushTable = () => {
    if (!rows.length) return;
    const cols = Math.max(...rows.map((r) => r.length));
    out.push('<table><tbody>' + rows.map((r) => '<tr>' + Array.from({ length: cols }, (_, c) => `<td><p>${r[c] ?? ''}</p></td>`).join('') + '</tr>').join('') + '</tbody></table>');
    rows = [];
  };
  const endPara = () => { flushRun(); if (inTbl) { cell += '<br>'; return; } flushTable(); out.push(`<p>${para}</p>`); para = ''; };
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (ch === '{') { flushRun(); stack.push({ ...st }); i++; continue; }
    if (ch === '}') { flushRun(); st = stack.pop() ?? st; i++; if (pic && stack.length < pic.depth) finishPic(); continue; }
    if (pic && stack.length === pic.depth && ch !== B && ch !== '{') {
      let j = i;
      while (j < n && src[j] !== B && src[j] !== '{' && src[j] !== '}') j++;
      pic.hex.push(src.slice(i, j)); i = j; continue;
    }
    if (ch === '\r' || ch === '\n') { i++; continue; }
    if (st.ctbl && ch === ';') { colors.push(rgb ? '#' + rgb.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('') : null); rgb = null; i++; continue; }
    if (ch !== B) { if (skipChars > 0 && !st.skip) { skipChars--; i++; continue; } text(byte(ch.charCodeAt(0))); i++; continue; }
    // Bara inversă: simbol de control sau cuvânt de control.
    const nx = src[i + 1] ?? '';
    if (!/[a-zA-Z]/.test(nx)) {
      i += 2;
      if (nx === "'") { const h = parseInt(src.slice(i, i + 2), 16); i += 2; if (!Number.isNaN(h)) text(byte(h)); }
      else if (nx === B || nx === '{' || nx === '}') text(nx);
      else if (nx === '~') text(String.fromCharCode(160));
      else if (nx === '*') { st.skip = true; }
      else if (nx === '\n' || nx === '\r') { if (!st.skip) endPara(); }
      else if (nx === '_') text('-');
      continue;
    }
    let j = i + 1;
    while (j < n && /[a-zA-Z]/.test(src[j])) j++;
    const word = src.slice(i + 1, j);
    let num: number | null = null;
    const m = /^-?[0-9]+/.exec(src.slice(j, j + 12));
    if (m) { num = Number(m[0]); j += m[0].length; }
    if (src[j] === ' ') j++;
    i = j;
    if (word === 'colortbl') { st.skip = true; st.ctbl = true; continue; }
    if (st.ctbl) { const k = ['red', 'green', 'blue'].indexOf(word); if (k >= 0) { rgb ??= [0, 0, 0]; rgb[k] = num ?? 0; } continue; }
    // O poză: grupul pict cu pngblip / jpegblip, picwgoal, pichgoal și datele hex; în shppict e varianta bună, în nonshppict rezerva veche.
    if (word === 'pict') { if (!st.skip) pic = { kind: '', w: 0, h: 0, gw: 0, gh: 0, sx: 100, sy: 100, hex: [], bin: [], depth: stack.length }; else warnings++; st.skip = true; continue; }
    if (word === 'shppict') { st.skip = stack[stack.length - 1]?.skip ?? false; continue; }
    if (pic && stack.length === pic.depth) {
      if (PIC_KINDS[word]) pic.kind = PIC_KINDS[word];
      else if (word === 'bin' && num) { pic.bin.push(src.slice(i, i + num)); i += num; }
      else if (word === 'picw') pic.w = num ?? 0; else if (word === 'pich') pic.h = num ?? 0;
      else if (word === 'picwgoal') pic.gw = num ?? 0; else if (word === 'pichgoal') pic.gh = num ?? 0;
      else if (word === 'picscalex') pic.sx = num ?? 100; else if (word === 'picscaley') pic.sy = num ?? 100;
      continue;
    }
    if (SKIP.has(word)) { st.skip = true; continue; }
    if (word === 'ansicpg' && num) { try { decoder = new TextDecoder('windows-' + num); } catch { warnings++; } continue; }
    if (st.skip) continue;
    const on = num === null || num !== 0;
    switch (word) {
      case 'par': case 'sect': endPara(); break;
      case 'page': endPara(); if (!inTbl) out.push('<p></p>'); break;
      case 'line': flushRun(); if (inTbl) cell += '<br>'; else para += '<br>'; break;
      case 'tab': text(String.fromCharCode(9)); break;
      case 'b': flushRun(); st.b = on; break;
      case 'i': flushRun(); st.i = on; break;
      case 'ul': flushRun(); st.u = on; break;
      case 'ulnone': flushRun(); st.u = false; break;
      case 'strike': case 'striked': flushRun(); st.s = on; break;
      case 'sub': flushRun(); st.sub = on; st.sup = false; break;
      case 'super': flushRun(); st.sup = on; st.sub = false; break;
      case 'nosupersub': flushRun(); st.sub = false; st.sup = false; break;
      case 'plain': flushRun(); Object.assign(st, { b: false, i: false, u: false, s: false, sub: false, sup: false, fg: 0, bg: 0 }); break;
      case 'cf': flushRun(); st.fg = num ?? 0; break;
      case 'highlight': case 'cb': case 'chcbpat': flushRun(); st.bg = num ?? 0; break;
      case 'uc': st.uc = num ?? 1; break;
      case 'u': if (num !== null) { text(String.fromCharCode(num < 0 ? num + 65536 : num)); skipChars = st.uc; } break;
      case 'intbl': if (!inTbl) { flushRun(); if (para) { out.push(`<p>${para}</p>`); para = ''; } inTbl = true; } break;
      case 'cell': flushRun(); row.push(cell.replace(/(<br>)+$/, '')); cell = ''; break;
      case 'row': flushRun(); rows.push(row); row = []; cell = ''; inTbl = false; break;
      case 'pard': flushRun(); if (inTbl && !src.slice(i, i + 40).includes(B + 'intbl')) inTbl = false; break;
      case 'object': warnings++; st.skip = true; break;
      default: if (SYMBOLS[word]) text(SYMBOLS[word]);
    }
  }
  flushRun();
  if (para) out.push(`<p>${para}</p>`);
  flushTable();
  // Fișierul se termină de obicei cu un paragraf gol după ultimul \par; nu-l păstrăm.
  while (out.length > 1 && out[out.length - 1] === '<p></p>') out.pop();
  return { html: (await htmlWithMetafiles(out.join(''))) || '<p></p>', warnings, comments: [], changes: [] };
}
