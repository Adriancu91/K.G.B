// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// „Găsește și înlocuiește” în PDF: textul găsit se acoperă cu alb și în locul lui se scrie textul nou, ca text adevărat
// (se poate selecta, copia și căuta), cu același început de rând, aceeași mărime a literelor și aceeași înclinare.
// Fontul: întâi chiar fontul vechi, dacă e pus în PDF (TrueType / OpenType) și are toate literele textului nou (originalFont);
// altfel urmează felul celui vechi (fontStyleOf): cu serife sau monospațiat, cu fonturile standard ale PDF-ului (Times, Courier),
// când textul nou are doar litere pe care ele le pot scrie; altfel Liberation Sans (SIL OFL, vine cu pdf.js), care are și ă, ș, ț.
// Aldinul și cursivul se păstrează în ambele cazuri.
// Textul vechi se scoate din pagină când bucata lui e toată sub acoperire (textRemove.ts); altfel rămâne acoperit.
// Cu „scoate definitiv” pagina trece întâi prin redactare (rămâne text; devine imagine doar când sub zonă sunt poze sau desene).
import fontkit from '@pdf-lib/fontkit';
import { beginText, decodePDFRawStream, degrees, endText, moveText, PDFArray, PDFDict, type PDFDocument, type PDFFont, PDFName, PDFOperator, PDFOperatorNames, type PDFPage, PDFRawStream, popGraphicsState, pushGraphicsState, type RGB, rgb, setFillingColor, setFontAndSize, StandardFonts } from 'pdf-lib';
import { open } from './edit';
import { wrapLines } from './paragraphs';
import { type Box, removeTextInPage } from './textRemove';
import type { ParaAlign } from './TextEdit';

/** O bucată de text de la pdf.js: matricea textului (puncte PDF) și lățimea ei. */
export interface RItem { str: string; transform: number[]; width: number }

/**
 * Locul unei bucăți înlocuite, în sistemul de coordonate în care se desenează: începutul rândului (pe linia de bază),
 * unghiul textului (grade), mărimea literelor și lățimea textului vechi.
 */
export interface Seg {
  page: number; x: number; y: number; angle: number; size: number; width: number; first: boolean; bold?: boolean;
  /** Cursiv; `family`: fontul vechi era cu serife sau monospațiat (lipsă = fără serife). */
  italic?: boolean; family?: 'serif' | 'mono';
  /** Numele fontului vechi în PDF (BaseFont), ca să-l refolosim când se poate. */
  font?: string;
  /** Culoarea textului nou și a acoperirii (0–1); lipsă = negru pe alb. */
  color?: [number, number, number]; bg?: [number, number, number];
  /** Mărimea textului nou, aleasă de mână (puncte); lipsă = cea veche, micșorată ca să încapă în locul vechi. */
  textSize?: number;
  /** La paragrafe: textul vechi al bucății și, dacă e scrisă altfel decât restul paragrafului (un cuvânt aldin), stilul ei. */
  str?: string; run?: Pick<Seg, 'bold' | 'italic' | 'font'>;
}

/**
 * Bucata dintre literele [from, to) ale unui text pdf.js: unde începe, ce unghi are, cât de mare e și cât de lată.
 * `map` duce un punct din coordonatele PDF în cele în care desenăm (identitate dacă pagina rămâne cum e).
 */
export function segOf(it: RItem, from: number, to: number, page: number, first: boolean, map: (x: number, y: number) => [number, number] = (x, y) => [x, y],
  measure?: (s: string) => number): Seg {
  const [ta, tb, tc, td, te, tf] = it.transform;
  const len = it.str.length || 1;
  const size = Math.hypot(tc, td) || 10;
  const dl = Math.hypot(ta, tb) || 1;
  const ux = ta / dl, uy = tb / dl;
  // Cu `measure` (lățimea unui șir cu un font asemănător) locul literelor e mult mai exact decât lățimea împărțită egal.
  const total = measure ? measure(it.str) : 0;
  const at = (k: number) => (total > 0 ? (it.width * measure!(it.str.slice(0, k))) / total : (it.width * k) / len);
  const x0 = at(from), x1 = at(to);
  const [ax, ay] = map(te + ux * x0, tf + uy * x0);
  const [bx, by] = map(te + ux * x1, tf + uy * x1);
  const width = Math.hypot(bx - ax, by - ay);
  // Unghiul după capetele bucății; la o bucată goală, după direcția textului.
  const [cx, cy] = width > 0.01 ? [bx - ax, by - ay] : (() => { const [px, py] = map(te + ux * (x0 + 1), tf + uy * (x0 + 1)); return [px - ax, py - ay]; })();
  return { page, x: ax, y: ay, angle: (Math.atan2(cy, cx) * 180) / Math.PI, size, width, first };
}

/** Dreptunghiul (aliniat la axe) pe care îl acoperă albul unei bucăți: [x0, y0, x1, y1], în coordonatele de desen. */
export function segBox(s: Seg): [number, number, number, number] {
  const r = (s.angle * Math.PI) / 180, ux = Math.cos(r), uy = Math.sin(r), nx = -uy, ny = ux;
  const pad = s.size * 0.06, down = s.size * 0.28, up = s.size * 0.98;
  const pts = [[-pad, -down], [s.width + pad, -down], [-pad, up], [s.width + pad, up]].map(([a, u]) => [s.x + ux * a + nx * u, s.y + uy * a + ny * u]);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/** Fonturile textului nou: obișnuit, aldin, cursiv și aldin cursiv (octeții fișierelor .ttf). */
export interface ReplaceFonts { regular: ArrayBuffer | Uint8Array; bold?: ArrayBuffer | Uint8Array; italic?: ArrayBuffer | Uint8Array; boldItalic?: ArrayBuffer | Uint8Array }

/** Felul fontului după numele lui din PDF („ABCDEF+TimesNewRomanPS-BoldItalicMT” → cu serife, aldin, cursiv). */
export function fontStyleOf(name: string): Pick<Seg, 'bold' | 'italic' | 'family' | 'font'> {
  const n = name.replace(/^[A-Z]{6}\+/, '');
  const bold = /bold|black|heavy|semibold|demi/i.test(n);
  const italic = /italic|oblique|[-,]it\b|[-,]ital/i.test(n);
  const family = /courier|mono|consol|fixed|typewriter/i.test(n) ? 'mono'
    : !/sans|arial|helvet|verdana|tahoma|calibri|segoe|gothic|grotesk/i.test(n) && /times|serif|roman|georgia|garamond|cambria|bookman|book\b|minion|palatino|century|baskerville|caslon/i.test(n) ? 'serif' : undefined;
  return { bold, italic, family, ...(name ? { font: name } : {}) };
}

/** Fontul cu numele `name` din resursele paginii (și ale desenelor din ea), ca dicționar PDF. */
function findFontDict(doc: PDFDocument, pageIndex: number, name: string): PDFDict | null {
  const want = name;
  const seen = new Set<PDFDict>();
  const visit = (res: PDFDict | undefined, depth: number): PDFDict | null => {
    if (!res || seen.has(res) || depth > 4) return null;
    seen.add(res);
    const fonts = res.lookupMaybe(PDFName.of('Font'), PDFDict);
    for (const [, ref] of fonts?.entries() ?? []) {
      const fd = doc.context.lookup(ref);
      if (fd instanceof PDFDict && fd.lookupMaybe(PDFName.of('BaseFont'), PDFName)?.decodeText() === want) return fd;
    }
    const xo = res.lookupMaybe(PDFName.of('XObject'), PDFDict);
    for (const [, ref] of xo?.entries() ?? []) {
      const x = doc.context.lookup(ref);
      const sub = x instanceof PDFRawStream ? x.dict.lookupMaybe(PDFName.of('Resources'), PDFDict) : undefined;
      const hit = visit(sub, depth + 1);
      if (hit) return hit;
    }
    return null;
  };
  return visit(doc.getPage(pageIndex).node.Resources(), 0);
}

/** Octeții fontului vechi (TrueType sau OpenType pus în PDF), dacă are toate literele din `text`; altfel null. */
export function originalFontBytes(doc: PDFDocument, pageIndex: number, name: string, text: string): Uint8Array | null {
  try {
    let fd = findFontDict(doc, pageIndex, name);
    if (!fd) return null;
    const desc = fd.lookupMaybe(PDFName.of('DescendantFonts'), PDFArray)?.lookup(0);
    if (desc instanceof PDFDict) fd = desc;
    const fdesc = fd.lookupMaybe(PDFName.of('FontDescriptor'), PDFDict);
    const file = fdesc?.lookup(PDFName.of('FontFile2')) ?? fdesc?.lookup(PDFName.of('FontFile3'));
    if (!(file instanceof PDFRawStream)) return null;
    const sub = file.dict.lookupMaybe(PDFName.of('Subtype'), PDFName)?.decodeText();
    if (sub && sub !== 'OpenType') return null; // CFF simplu (Type1C) nu se poate pune din nou cu fontkit
    const bytes = decodePDFRawStream(file).decode();
    const f = fontkit.create(bytes as unknown as Buffer) as unknown as { hasGlyphForCodePoint(c: number): boolean; glyphForCodePoint(c: number): { path: { commands: unknown[] }; advanceWidth: number } };
    // Un font „decupat” (doar literele folosite în PDF) trebuie să aibă desenul fiecărei litere noi, nu doar locul ei.
    for (const ch of new Set([...text])) {
      const c = ch.codePointAt(0)!;
      if (!f.hasGlyphForCodePoint(c)) return null;
      const g = f.glyphForCodePoint(c);
      if (!g.advanceWidth || (ch.trim() && !g.path.commands.length)) return null;
    }
    return bytes;
  } catch { return null; }
}

/** Literele pe care le pot scrie fonturile standard ale PDF-ului (WinAnsi): ASCII, Latin-1 și câteva semne în plus. */
const WIN_EXTRA = new Set([...'€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ']);
const winAnsi = (t: string) => [...t].every((ch) => { const c = ch.charCodeAt(0); return (c >= 32 && c < 127) || (c >= 160 && c <= 255) || WIN_EXTRA.has(ch); });
const STD: Record<'serif' | 'mono', [StandardFonts, StandardFonts, StandardFonts, StandardFonts]> = {
  serif: [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold, StandardFonts.TimesRomanItalic, StandardFonts.TimesRomanBoldItalic],
  mono: [StandardFonts.Courier, StandardFonts.CourierBold, StandardFonts.CourierOblique, StandardFonts.CourierBoldOblique],
};

/** Fontul textului nou pentru o bucată (încărcat în document o singură dată). */
function fontPicker(doc: PDFDocument, fonts: ReplaceFonts, text: string) {
  const got = new Map<string, Promise<PDFFont>>();
  const load = (key: string, make: () => Promise<PDFFont>) => { let p = got.get(key); if (!p) { p = make(); got.set(key, p); } return p; };
  const orig = new Map<string, Uint8Array | null>();
  return (s: Seg): Promise<PDFFont> => {
    if (s.font) {
      const k = s.page + '/' + s.font;
      if (!orig.has(k)) orig.set(k, originalFontBytes(doc, s.page - 1, s.font, text));
      const b = orig.get(k);
      if (b) return load('orig:' + k, () => doc.embedFont(b, { subset: true }));
    }
    const v = (s.bold ? 1 : 0) + (s.italic ? 2 : 0);
    if (s.family && winAnsi(text)) { const std = STD[s.family][v]; return load(std, () => doc.embedFont(std)); }
    const bytes = [fonts.regular, fonts.bold, fonts.italic, fonts.boldItalic ?? fonts.bold][v] ?? (s.bold ? fonts.bold : undefined) ?? fonts.regular;
    const key = 'ttf' + [fonts.regular, fonts.bold, fonts.italic, fonts.boldItalic].indexOf(bytes);
    return load(key, () => doc.embedFont(bytes, { subset: true }));
  };
}

/**
 * Acoperă fiecare bucată cu alb, apoi scrie textul nou pe prima bucată a fiecărei potriviri. Dacă textul nou e mai lat
 * decât cel vechi, literele se micșorează puțin (până la 80%), ca să nu calce peste ce urmează pe rând.
 */
export async function replaceTextPdf(bytes: Uint8Array, segs: Seg[], text: string, fonts: ReplaceFonts, para: boolean | ParaAlign = false): Promise<Uint8Array> {
  const doc = await open(bytes);
  doc.registerFontkit(fontkit);
  const pick = fontPicker(doc, fonts, text);
  // Bucățile de text aflate în întregime sub o acoperire se scot de-adevăratelea din pagină (textRemove.ts),
  // ca textul vechi să nu mai apară la căutare sau la copiere; restul rămâne doar acoperit.
  const byPage = new Map<number, Box[]>();
  for (const s of segs) if (s.page >= 1 && s.page <= doc.getPageCount()) byPage.set(s.page, [...(byPage.get(s.page) ?? []), segBox(s)]);
  for (const [p, boxes] of byPage) { try { removeTextInPage(doc, p - 1, boxes); } catch { /* conținut neobișnuit: rămâne doar acoperirea */ } }
  for (const s of segs) {
    if (s.page < 1 || s.page > doc.getPageCount()) continue;
    const page = doc.getPage(s.page - 1);
    const r = (s.angle * Math.PI) / 180;
    const nx = -Math.sin(r), ny = Math.cos(r); // „în sus”, perpendicular pe rând
    const pad = s.size * 0.06;
    // Albul acoperă și codițele (ș, g, p) și accentele de sus.
    const down = s.size * 0.28, up = s.size * 0.98;
    page.drawRectangle({
      x: s.x - Math.cos(r) * pad - nx * down, y: s.y - Math.sin(r) * pad - ny * down,
      width: s.width + 2 * pad, height: down + up, rotate: degrees(s.angle), color: s.bg ? rgb(...s.bg) : rgb(1, 1, 1),
    });
  }
  // Textele noi după toate acoperirile, ca un alb de alături să nu taie din ele.
  if (para && text && segs.length) {
    const al = para === true ? undefined : para;
    if (segs.some((s) => s.run)) await drawStyledParagraph(doc, segs, text, pick, al);
    else await drawParagraph(doc, segs, text, await pick(segs[0]), al);
    return doc.save();
  }
  for (const s of segs) {
    if (!s.first || !text || s.page < 1 || s.page > doc.getPageCount()) continue;
    const page = doc.getPage(s.page - 1);
    const font = await pick(s);
    let size = s.textSize ?? s.size;
    const w = font.widthOfTextAtSize(text, size);
    if (!s.textSize && w > s.width && s.width > 0) size = Math.max(s.size * 0.8, (s.size * s.width) / w);
    page.drawText(text, { x: s.x, y: s.y, size, font, rotate: degrees(s.angle), color: s.color ? rgb(...s.color) : rgb(0, 0, 0) });
  }
  return doc.save();
}

/**
 * Paragraful nou, în locul rândurilor vechi `segs` (text orizontal, primul = începutul paragrafului): aceeași margine stângă
 * (și retragerea primului rând), aceeași margine dreaptă și același pas între rânduri; cuvintele se reașază pe rânduri
 * (wrapLines). Dacă textul e mai lung, paragraful crește în jos. `align`: la centru, la dreapta sau stânga-dreapta (rândurile
 * pline se întind până la margine, cuvânt cu cuvânt; ultimul rând al fiecărui paragraf rămâne la stânga).
 */
async function drawParagraph(doc: PDFDocument, segs: Seg[], text: string, font: PDFFont, align?: ParaAlign) {
  const s0 = segs[0];
  if (s0.page < 1 || s0.page > doc.getPageCount()) return;
  const page = doc.getPage(s0.page - 1);
  const { x0, xr, top, lead, size, width, color } = paraFrame(segs, align);
  const measure = (t: string) => font.widthOfTextAtSize(t, size);
  // Rândurile fiecărui paragraf din casetă („\n”), ca să știm care e ultimul (la stânga-dreapta nu se întinde).
  let k = 0;
  for (const part of text.split('\n')) {
    const base = k;
    const lines = wrapLines(part, (j) => width(base + j), measure);
    lines.forEach((t, j) => {
      const n = base + j, x = n ? xr : x0, y = top - n * lead, w = measure(t), room = width(n);
      if (!t) return;
      if (align === 'center') page.drawText(t, { x: x + (room - w) / 2, y, size, font, color });
      else if (align === 'right') page.drawText(t, { x: x + room - w, y, size, font, color });
      else if (align === 'justify' && j < lines.length - 1 && t.includes(' ')) justifiedLine(doc, page, t, x, y, room, size, font, color);
      else page.drawText(t, { x, y, size, font, color });
    });
    k += lines.length;
  }
}

/** Locul paragrafului vechi: marginea primului rând și a celorlalte, linia de bază de sus, pasul, mărimea și lățimea rândului k. */
function paraFrame(segs: Seg[], align?: ParaAlign) {
  const s0 = segs[0];
  // Rândurile vechi, după linia de bază (de sus în jos).
  const rows: Seg[][] = [];
  for (const s of [...segs].sort((a, b) => b.y - a.y)) {
    const r = rows.find((r) => Math.abs(r[0].y - s.y) < s.size * 0.3);
    if (r) r.push(s); else rows.push([s]);
  }
  const left = (r: Seg[]) => Math.min(...r.map((s) => s.x));
  const right = Math.max(...segs.map((s) => s.x + s.width));
  // La centru și la dreapta nu există alineat: toate rândurile au aceeași lățime, de la cea mai din stânga margine.
  const minX = Math.min(...segs.map((s) => s.x));
  const x0 = align === 'center' || align === 'right' ? minX : left(rows[0]);
  const xr = align === 'center' || align === 'right' ? minX : rows.length > 1 ? Math.min(...rows.slice(1).map(left)) : x0;
  const size = s0.textSize ?? s0.size;
  const lead = (rows.length > 1 ? (rows[0][0].y - rows[rows.length - 1][0].y) / (rows.length - 1) : s0.size * 1.2) * (size / s0.size);
  const width = (k: number) => right - (k ? xr : x0);
  const color = s0.color ? rgb(...s0.color) : rgb(0, 0, 0);
  return { x0, xr, top: rows[0][0].y, lead, size, width, color };
}

/** Un cuvânt cu stilul fiecărei litere (0 = ca paragraful, altfel 1 + al câtelea stil din `runs`). */
interface Word { t: string; st: number[] }

/**
 * Cuvintele vechi ale paragrafului (în ordinea bucăților), cu stilul literelor: bucățile scrise altfel (`run`, de exemplu
 * un cuvânt aldin) primesc stilul lor. Între bucăți depărtate sau pe rânduri diferite vine un spațiu.
 */
function oldWords(segs: Seg[], styleOf: (s: Seg) => number): Word[] {
  let chars = '', st: number[] = [];
  segs.forEach((s, k) => {
    const p = segs[k - 1];
    if (p && (Math.abs(p.y - s.y) > s.size * 0.3 || s.x - (p.x + p.width) > s.size * 0.15)) { chars += ' '; st.push(0); }
    const v = styleOf(s);
    for (const ch of s.str ?? '') { chars += ch; st.push(v); }
  });
  const out: Word[] = [];
  let cur: Word = { t: '', st: [] };
  [...chars].forEach((ch, i) => {
    if (/\s/.test(ch)) { if (cur.t) out.push(cur); cur = { t: '', st: [] }; return; }
    cur.t += ch; cur.st.push(st[i] ?? 0);
  });
  if (cur.t) out.push(cur);
  return out;
}

/** Cuvântul fără semnele de punctuație de la capete și locul lui în cuvânt (în litere UTF-16, ca indicii stilurilor). */
const core = (w: string) => { const m = /^\p{P}*(.*?)\p{P}*$/u.exec(w)!; return { s: m[1] || w, at: m[1] ? w.indexOf(m[1]) : 0 }; };

/** Perechile (vechi, nou) de cuvinte identice, în aceeași ordine (cea mai lungă potrivire, ca la „compară”). */
function matchWords(a: string[], b: string[]): Map<number, number> {
  const n = a.length, m = b.length;
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = new Map<number, number>();
  for (let i = 0, j = 0; i < n && j < m;) {
    if (a[i] === b[j]) { out.set(j, i); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
  }
  return out;
}

/**
 * Paragraful reașezat, când în el sunt cuvinte scrise altfel (aldin, cursiv, alt font): cuvintele noi care se regăsesc
 * neschimbate în textul vechi își păstrează stilul, literă cu literă; cele noi sau schimbate se scriu ca paragraful.
 * Așezarea e ca la drawParagraph, cu lățimile măsurate pe fontul fiecărei bucăți; rândurile întinse se scriu cuvânt cu cuvânt.
 */
async function drawStyledParagraph(doc: PDFDocument, segs: Seg[], text: string, pick: (s: Seg) => Promise<PDFFont>, align?: ParaAlign) {
  const s0 = segs[0];
  if (s0.page < 1 || s0.page > doc.getPageCount()) return;
  const page = doc.getPage(s0.page - 1);
  const { x0, xr, top, lead, size, width, color } = paraFrame(segs, align);
  // Stilurile: 0 = al paragrafului (cu formatul ales în bară); restul, cele ale bucăților scrise altfel.
  const runs: Seg['run'][] = [];
  const key = (r: NonNullable<Seg['run']>) => `${!!r.bold}/${!!r.italic}/${r.font ?? ''}`;
  const styleOf = (s: Seg) => {
    if (!s.run) return 0;
    const k = runs.findIndex((r) => key(r!) === key(s.run!));
    if (k >= 0) return k + 1;
    runs.push(s.run);
    return runs.length;
  };
  const old = oldWords(segs, styleOf);
  // Fontul fiecărui stil: același fel ca paragraful (fontul ales în bară), doar aldin / cursiv / fontul vechi al bucății.
  const fonts = await Promise.all([s0, ...runs.map((r) => ({ ...s0, bold: r!.bold, italic: r!.italic, font: s0.font ? r!.font : undefined }))].map(pick));
  const parts = text.split('\n').map((p) => p.split(/\s+/).filter(Boolean));
  const flat = parts.flat();
  const pairs = matchWords(old.map((w) => core(w.t).s), flat.map((t) => core(t).s));
  let at = 0;
  const words: Word[][] = parts.map((p) => p.map((t) => {
    const i = pairs.get(at++), st = [...t].map(() => 0);
    // Literele cuvântului găsit iau stilul celor vechi; semnele de la capete (virgula de după) rămân ca paragraful.
    if (i !== undefined) { const a = core(old[i].t), b = core(t); for (let k = 0; k < b.s.length; k++) st[b.at + k] = old[i].st[a.at + k] ?? 0; }
    return { t, st };
  }));
  // Bucățile unui cuvânt cu același stil, ca să se scrie dintr-o dată.
  const pieces = (w: Word) => {
    const out: { t: string; f: PDFFont }[] = [];
    [...w.t].forEach((ch, i) => { const f = fonts[w.st[i] ?? 0] ?? fonts[0]; const last = out[out.length - 1]; if (last?.f === f) last.t += ch; else out.push({ t: ch, f }); });
    return out;
  };
  const wordW = (w: Word) => pieces(w).reduce((a, p) => a + p.f.widthOfTextAtSize(p.t, size), 0);
  const space = fonts[0].widthOfTextAtSize(' ', size);
  let n = 0;
  for (const part of words) {
    // Cuvintele pe rânduri, cât încap (ca wrapLines); un rând gol pentru un paragraf gol.
    const lines: Word[][] = [];
    let cur: Word[] = [], cw = 0;
    for (const w of part) {
      const ww = wordW(w);
      if (cur.length && cw + space + ww > width(n + lines.length) + 0.01) { lines.push(cur); cur = [w]; cw = ww; } else { cw += (cur.length ? space : 0) + ww; cur.push(w); }
    }
    lines.push(cur);
    lines.forEach((ln, j) => {
      const k = n + j, x = k ? xr : x0, y = top - k * lead, room = width(k);
      if (!ln.length) return;
      const ws = ln.map(wordW), w = ws.reduce((a, b) => a + b, 0) + space * (ln.length - 1);
      const stretch = align === 'justify' && j < lines.length - 1 && ln.length > 1;
      const gap = stretch ? (room - (w - space * (ln.length - 1))) / (ln.length - 1) : space;
      let cx = align === 'center' ? x + (room - w) / 2 : align === 'right' ? x + room - w : x;
      if (stretch) {
        // Rândul întins: cuvânt cu cuvânt, cu spațiul mărit între ele.
        ln.forEach((wd) => { for (const p of pieces(wd)) { page.drawText(p.t, { x: cx, y, size, font: p.f, color }); cx += p.f.widthOfTextAtSize(p.t, size); } cx += gap; });
        return;
      }
      // Altfel rândul se scrie în bucăți cât mai lungi cu același font (spațiile cu fontul paragrafului), ca să se copieze și să se caute ca text.
      const all: { t: string; f: PDFFont }[] = [];
      ln.forEach((wd, i) => {
        for (const p of [...pieces(wd), ...(i < ln.length - 1 ? [{ t: ' ', f: fonts[0] }] : [])]) {
          const last = all[all.length - 1];
          if (last?.f === p.f) last.t += p.t; else all.push({ ...p });
        }
      });
      for (const p of all) { page.drawText(p.t, { x: cx, y, size, font: p.f, color }); cx += p.f.widthOfTextAtSize(p.t, size); }
    });
    n += lines.length;
  }
}

/**
 * Un rând întins între margini (stânga-dreapta): un singur text (TJ), cu spațiul dintre cuvinte mărit cât trebuie, ca textul
 * să se copieze și să se caute ca un rând. Dacă fontul nu se poate pune așa, cuvintele se scriu unul câte unul.
 */
function justifiedLine(doc: PDFDocument, page: PDFPage, t: string, x: number, y: number, room: number, size: number, font: PDFFont, color: RGB) {
  const words = t.split(' ');
  const measure = (s: string) => font.widthOfTextAtSize(s, size);
  const gap = (room - words.reduce((a, s) => a + measure(s), 0)) / (words.length - 1);
  page.setFont(font);
  const key = (page as unknown as { fontKey?: PDFName }).fontKey;
  if (key) {
    const extra = -((gap - measure(' ')) * 1000) / size;
    const arr = words.flatMap((w, k) => (k < words.length - 1 ? [font.encodeText(w + ' '), doc.context.obj(extra)] : [font.encodeText(w)]));
    page.pushOperators(pushGraphicsState(), setFillingColor(color), beginText(), setFontAndSize(key, size), moveText(x, y),
      PDFOperator.of(PDFOperatorNames.ShowTextAdjusted, [doc.context.obj(arr)]), endText(), popGraphicsState());
    return;
  }
  let cx = x;
  for (const w of words) { page.drawText(w, { x: cx, y, size, font, color }); cx += measure(w) + gap; }
}
