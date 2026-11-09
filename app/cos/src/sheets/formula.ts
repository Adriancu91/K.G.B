// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Motorul de formule pentru Sheets, scris de noi (fără biblioteci).
// O formulă începe cu „=”. Știe: + - * / ^ & %, comparații (= <> < > <= >=), referințe A1 / $A$1,
// zone A1:B5 și coloane întregi A:A, plus funcțiile uzuale (în engleză sau în română: SUMA, MEDIE, DACA…).
// Separatorul de argumente e „;” sau „,”. Dacă formula are „;”, virgula devine separator zecimal (=ROUND(2,5;0)).
// Celulele din alte foi: =Costuri!B2, ='Foaia 1'!A1:B5 (numele cu spații sau semne stau între apostrofuri).

import { cellId, COLS, isNumber, parseCellId, ROWS } from './format';
import { amountWords, intWords } from './words';
import { detectLang } from '../docs/langDetect';
import { webText } from './webService';
import { validCnp, validCui, validIban } from './ids';
import { codeFromLocal, formatCode } from './fmtcode';
import { etsConfint, etsForecast, etsStat, fitEts, prepareSeries, stepsAhead, type EtsModel, type EtsSeries } from './ets';

export class FErr {
  constructor(public code: string) {}
}

export type Scalar = number | string | boolean | null | FErr;
type Value = Scalar | Scalar[][];

export const ERROR_HELP: Record<string, string> = {
  '#DIV/0!': 'Împărțire la zero (sau la o celulă goală).',
  '#VALUE!': 'Un text a fost folosit acolo unde trebuia un număr.',
  '#NAME?': 'Funcție sau nume necunoscut. Verifică scrierea.',
  '#REF!': 'Referință la o celulă care nu există.',
  '#CIRC!': 'Referință circulară: formula depinde, direct sau indirect, de propria celulă.',
  '#NUM!': 'Rezultat numeric imposibil (de exemplu radical dintr-un număr negativ).',
  '#N/A': 'Valoarea căutată nu a fost găsită (CAUTAREV, POTRIVIRE…) sau numărul de argumente nu e potrivit.',
  '#EROARE!': 'Formula nu e scrisă corect: verifică parantezele, ghilimelele și operatorii.',
  '#SPILL!': 'Rezultatul are nevoie de mai multe celule, dar unele dintre ele (dedesubt sau în dreapta) nu sunt goale. Golește-le.',
  '#CALC!': 'Rezultatul ar fi gol (de exemplu FILTER nu găsește nimic). Poți da un al treilea argument pentru acest caz.',
  '#BUSY!': 'Se aduc datele de la adresa web (WEBSERVICE); rezultatul apare singur în câteva clipe.',
};

// ---------- Citirea formulei (tokeni) ----------

type Tok =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'bool'; v: boolean }
  | { t: 'ref'; r: number; c: number; sh?: string }
  | { t: 'range'; r1: number; c1: number; r2: number; c2: number; sh?: string; sh2?: string }
  | { t: 'fn'; v: string }
  | { t: 'name'; v: string; raw: string }
  | { t: 'op'; v: string }
  | { t: 'arr'; v: Scalar[][] }
  | { t: 'err'; v: string };

/** Erorile care se pot scrie ca valoare, în celulă sau în formulă (=IF(A1;#N/A;3), un .xlsx cu celula #DIV/0!). */
const ERR_LIT = /#(?:NULL!|DIV\/0!|VALUE!|REF!|NAME\?|NUM!|N\/A|SPILL!|CALC!|GETTING_DATA)/iy;

function colIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

const RANGE_RE = /\$?([A-Z]{1,3})\$?(\d+):\$?([A-Z]{1,3})\$?(\d+)/iy;
const COLRANGE_RE = /\$?([A-Z]{1,3}):\$?([A-Z]{1,3})(?![\d\p{L}(])/iuy;
const ROWRANGE_RE = /\$?(\d{1,7}):\$?(\d{1,7})(?![\d\p{L}_(.,])/uy;
const REF_RE =/\$?([A-Z]{1,3})\$?(\d+)(?![\p{L}\d_(])/iuy;
const IDENT_RE = /[\p{L}_][\p{L}\d_.]*/uy;
const SHEET_RE = /([\p{L}_][\p{L}\d_.]*)!/uy;
/** Referința pe mai multe foi (Foaie1:Foaie3!A1): de la prima foaie la ultima, în ordinea filelor. */
const SHEET3D_RE = new RegExp(`${SHEET_RE.source.slice(0, -1)}:${SHEET_RE.source.slice(0, -1)}!`, 'uy');

/** Cheia unei foi: numele fără spații la capete, cu litere mici (ca în Excel, „Costuri” = „costuri”). */
export const sheetKey = (name: string) => name.trim().toLocaleLowerCase('ro-RO');

/** Foaia unui alt fișier, scrisă în formulă ca [Buget.xlsx]Foaie1! sau 'C:\Dosar\[Buget.xlsx]Foaia 1'!. */
const EXT_RE = /\[([^\[\]]+)\]([\p{L}_][\p{L}\d_.]*)!/uy;
/** Cheia foii unui registru extern: „[buget.xlsx]foaie1”, fără dosar (fișierul se recunoaște după nume, ca în Excel). */
export function extSheetKey(name: string): string | null {
  const m = /^(?:.*[\\/])?\[([^\[\]]+)\](.+)$/.exec(name.trim());
  return m ? '[' + sheetKey(m[1]) + ']' + sheetKey(m[2]) : null;
}

/** Numele foii cum se scrie într-o formulă: Costuri, sau 'Foaia 1' dacă are spații, semne sau arată ca o celulă. */
export function sheetRef(name: string): string {
  return /^[\p{L}_][\p{L}\d_.]*$/u.test(name) && !/^[A-Z]{1,3}\d+$/i.test(name) && !/^(TRUE|FALSE|ADEVARAT|FALS)$/i.test(name)
    ? name
    : `'${name.replace(/'/g, "''")}'`;
}

/** 'Foaia 1' de la poziția i (apostroful dublat înseamnă apostrof în nume) → numele și unde se termină. */
function quotedName(src: string, i: number): { name: string; end: number } {
  let name = '';
  let j = i + 1;
  while (j < src.length) {
    if (src[j] === "'") {
      if (src[j + 1] === "'") { name += "'"; j += 2; continue; }
      return { name, end: j + 1 };
    }
    name += src[j++];
  }
  return { name, end: j };
}

/** Unde se închide constanta matrice care începe la i (acolada din texte nu contează). */
function arrayEnd(src: string, i: number): number {
  for (let j = i + 1, q = false; j < src.length; j++) {
    if (src[j] === '"') q = !q;
    else if (!q && src[j] === '}') return j;
  }
  throw new FErr('#EROARE!');
}

/**
 * Constanta matrice {1;2;3}. În formulele cu „;” (românește): „;” sau „\” între coloane, „|” între rânduri, virgulă zecimală.
 * În cele scrise ca în Excel în engleză (fără „;”): „,” între coloane, „|” între rânduri, punct zecimal.
 * La import, constantele din Excel ({1,2;3,4}) se trec în forma românească ({1;2|3;4}), vezi fromExcelFormula.
 */
function arrayConst(body: string, semi: boolean): Scalar[][] {
  const rows: Scalar[][] = [[]];
  let cur = '', q = false;
  const push = () => {
    const s = cur.trim();
    cur = '';
    let v: Scalar;
    if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) v = s.slice(1, -1).replace(/""/g, '"');
    else if (/^(TRUE|ADEVARAT)$/.test(normName(s))) v = true;
    else if (/^(FALSE|FALS)$/.test(normName(s))) v = false;
    else if (/^#[A-Z0-9/!?]+$/i.test(s)) v = new FErr(s.toUpperCase());
    else {
      const t = semi ? s.replace(',', '.') : s;
      if (!/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?%?$/.test(t)) throw new FErr('#EROARE!');
      v = t.endsWith('%') ? Number(t.slice(0, -1)) / 100 : Number(t);
    }
    rows[rows.length - 1].push(v);
  };
  for (const ch of body) {
    if (ch === '"') { q = !q; cur += ch; continue; }
    if (q) { cur += ch; continue; }
    const col = ch === '\\' || (semi ? ch === ';' : ch === ',');
    const row = ch === '|';
    if (col) push();
    else if (row) { push(); rows.push([]); }
    else cur += ch;
  }
  push();
  if (rows.some((r) => r.length !== rows[0].length) || rows.length * rows[0].length > 100000) throw new FErr('#EROARE!');
  return rows;
}

function tokenize(src: string): Tok[] {
  const semi = src.includes(';');
  const numRe = semi ? /(\d+(?:[.,]\d+)?|[.,]\d+)(?:[eE][+-]?\d+)?/y : /(\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?/y;
  const out: Tok[] = [];
  let i = 0;
  const at = (re: RegExp) => { re.lastIndex = i; return re.exec(src); };
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '"') {
      let s = '';
      i++;
      for (;;) {
        if (i >= src.length) throw new FErr('#EROARE!');
        if (src[i] === '"') {
          if (src[i + 1] === '"') { s += '"'; i += 2; continue; }
          i++;
          break;
        }
        s += src[i++];
      }
      out.push({ t: 'str', v: s });
      continue;
    }
    if (ch === '#') {
      ERR_LIT.lastIndex = i;
      const e = ERR_LIT.exec(src);
      if (e) { out.push({ t: 'err', v: e[0].toUpperCase() }); i += e[0].length; continue; }
    }
    if (ch === '{') {
      const end = arrayEnd(src, i);
      out.push({ t: 'arr', v: arrayConst(src.slice(i + 1, end), semi) });
      i = end + 1;
      continue;
    }
    let m: RegExpExecArray | null;
    // Prefixul altei foi (Costuri! sau 'Foaia 1'!); după el trebuie să vină o celulă sau o zonă.
    let sh: string | undefined, sh2: string | undefined;
    if (ch === "'") {
      const q = quotedName(src, i);
      if (src[q.end] !== '!' || !q.name.trim()) throw new FErr('#EROARE!');
      const ext = extSheetKey(q.name);
      // Numele foilor nu pot avea „:”, deci 'Foaia 1:Foaia 3'! e o referință pe mai multe foi (dar „C:\” e dosarul unui fișier extern).
      const two = ext ? [q.name] : q.name.split(':');
      sh = ext ?? sheetKey(two[0]);
      if (two.length === 2 && two[1].trim()) sh2 = sheetKey(two[1]);
      i = q.end + 1;
    } else if (ch === '[' && (m = at(EXT_RE))) {
      sh = '[' + sheetKey(m[1]) + ']' + sheetKey(m[2]);
      i += m[0].length;
    } else if ((m = at(SHEET3D_RE))) {
      sh = sheetKey(m[1]);
      sh2 = sheetKey(m[2]);
      i += m[0].length;
    } else if ((m = at(SHEET_RE))) {
      sh = sheetKey(m[1]);
      i += m[0].length;
    }
    const where = sh === undefined ? {} : { sh };
    if (sh2 !== undefined && sh2 !== sh) {
      // Pe mai multe foi merg doar zona sau celula (fără coloane / rânduri întregi): o zonă cu foaia de sfârșit.
      if ((m = at(RANGE_RE))) {
        const [a, b] = [colIndex(m[1]), colIndex(m[3])];
        const [r1, r2] = [Number(m[2]) - 1, Number(m[4]) - 1];
        out.push({ t: 'range', r1: Math.min(r1, r2), c1: Math.min(a, b), r2: Math.max(r1, r2), c2: Math.max(a, b), sh, sh2 });
      } else if ((m = at(REF_RE))) {
        const [r, c] = [Number(m[2]) - 1, colIndex(m[1])];
        out.push({ t: 'range', r1: r, c1: c, r2: r, c2: c, sh, sh2 });
      } else throw new FErr('#EROARE!');
      i += m[0].length;
      continue;
    }
    if ((m = at(RANGE_RE))) {
      const [a, b] = [colIndex(m[1]), colIndex(m[3])];
      const [r1, r2] = [Number(m[2]) - 1, Number(m[4]) - 1];
      out.push({ t: 'range', r1: Math.min(r1, r2), c1: Math.min(a, b), r2: Math.max(r1, r2), c2: Math.max(a, b), ...where });
      i += m[0].length;
      continue;
    }
    if ((m = at(COLRANGE_RE))) {
      const [a, b] = [colIndex(m[1]), colIndex(m[2])];
      out.push({ t: 'range', r1: 0, c1: Math.min(a, b), r2: ROWS - 1, c2: Math.max(a, b), ...where });
      i += m[0].length;
      continue;
    }
    if ((m = at(REF_RE))) {
      out.push({ t: 'ref', r: Number(m[2]) - 1, c: colIndex(m[1]), ...where });
      i += m[0].length;
      continue;
    }
    if ((m = at(ROWRANGE_RE))) {
      // Rânduri întregi (2:5), ca în Excel.
      const [r1, r2] = [Number(m[1]) - 1, Number(m[2]) - 1];
      if (Math.min(r1, r2) < 0) throw new FErr('#EROARE!');
      out.push({ t: 'range', r1: Math.min(r1, r2), c1: 0, r2: Math.max(r1, r2), c2: COLS - 1, ...where });
      i += m[0].length;
      continue;
    }
    if (sh !== undefined) throw new FErr('#EROARE!');
    if ((m = at(numRe))) {
      out.push({ t: 'num', v: Number(m[0].replace(',', '.')) });
      i += m[0].length;
      continue;
    }
    if ((m = at(IDENT_RE))) {
      const word = normName(m[0]);
      i += m[0].length;
      let j = i;
      while (/\s/.test(src[j] ?? '')) j++;
      if (src[j] === '(') out.push({ t: 'fn', v: word });
      else if (word === 'TRUE' || word === 'ADEVARAT') out.push({ t: 'bool', v: true });
      else if (word === 'FALSE' || word === 'FALS') out.push({ t: 'bool', v: false });
      else out.push({ t: 'name', v: word, raw: m[0] });
      continue;
    }
    // Parametru opțional al unui LAMBDA: LAMBDA(x; [y]; …) e același nume y (lipsa lui o vede ISOMITTED).
    const prev = out[out.length - 1];
    if (ch === '[' && prev?.t === 'op' && (prev.v === '(' || prev.v === ',') && (m = at(/\[\s*([\p{L}_][\p{L}\p{N}_.]*)\s*\](?=\s*[;,)])/uy))) {
      out.push({ t: 'name', v: normName(m[1]), raw: m[1] });
      i += m[0].length;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (two === '<=' || two === '>=' || two === '<>') { out.push({ t: 'op', v: two }); i += 2; continue; }
    if ('+-*/^&%=<>(),;:~'.includes(ch)) { out.push({ t: 'op', v: ch === ';' ? ',' : ch }); i++; continue; }
    throw new FErr('#EROARE!');
  }
  return out;
}

/** SUMĂ → SUMA, apoi numele românești devin cele englezești. */
export function normName(s: string): string {
  // „RÂND” (cu diacritice) e numele românesc pentru ROW; „RAND” simplu e funcția RAND din fișiere (număr la întâmplare).
  if (s.toUpperCase() === 'RÂND') return 'ROW';
  const up = s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  return ALIASES[up] ?? up;
}

const ALIASES: Record<string, string> = {
  SUMA: 'SUM', MEDIE: 'AVERAGE', DACA: 'IF', SI: 'AND', SAU: 'OR', NU: 'NOT',
  PRODUS: 'PRODUCT', ROTUNJIRE: 'ROUND', ABSOLUT: 'ABS', RADICAL: 'SQRT',
  SUMADACA: 'SUMIF', CONTORDACA: 'COUNTIF', MEDIEDACA: 'AVERAGEIF',
  DACAEROARE: 'IFERROR', LUNGIME: 'LEN', MAJUSCULE: 'UPPER', MINUSCULE: 'LOWER',
  CONCATENARE: 'CONCATENATE', CONTOR: 'COUNT',
  CAUTAREV: 'VLOOKUP', CAUTAREH: 'HLOOKUP', CAUTAREX: 'XLOOKUP', POTRIVIRE: 'MATCH', ALEGE: 'CHOOSE', IMAGINE: 'IMAGE',
  AZI: 'TODAY', DATA: 'DATE', AN: 'YEAR', LUNA: 'MONTH', ZI: 'DAY', ZIUASAPTAMANII: 'WEEKDAY',
  ADEVARAT: 'TRUE', FALS: 'FALSE', DEPLASARE: 'OFFSET', ACUM: 'NOW', ORA: 'HOUR', TIMP: 'TIME', SECUNDA: 'SECOND',
  CAR: 'CHAR', COD: 'CODE', ADRESA: 'ADDRESS', CAUTARE: 'LOOKUP', PLATA: 'PMT', ALEATOR: 'RAND', ALEATORINTRE: 'RANDBETWEEN', COLOANA: 'COLUMN', RANDURI: 'ROWS', COLOANE: 'COLUMNS', ZILE: 'DAYS', ZILE360: 'DAYS360',
  MEDIANA: 'MEDIAN', TRUNCHIERE: 'TRUNC', SUBSTITUIRE: 'SUBSTITUTE', VALOARE: 'VALUE', ESTEEROARE: 'ISERROR',
};

// ---------- Arborele formulei ----------

type Node =
  | { k: 'lit'; v: Scalar }
  | { k: 'ref'; r: number; c: number; sh?: string }
  | { k: 'range'; r1: number; c1: number; r2: number; c2: number; sh?: string; sh2?: string }
  | { k: 'un'; op: string; a: Node }
  | { k: 'pct'; a: Node }
  | { k: 'bin'; op: string; a: Node; b: Node }
  | { k: 'fn'; name: string; args: Node[] }
  | { k: 'name'; v: string }
  | { k: 'arr'; v: Scalar[][] };

/** Cheia unui nume definit (ExpDat = 'general dump'!$E$11): fără litere mari/mici și diacritice, ca în Excel. */
export const nameKey = (s: string) => s.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

function parse(src: string): Node {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => { const t = toks[p]; return t?.t === 'op' && t.v === v; };
  const expect = (v: string) => { if (!isOp(v)) throw new FErr('#EROARE!'); p++; };

  const binLevel = (ops: string[], next: () => Node) => (): Node => {
    let a = next();
    for (;;) {
      const t = peek();
      if (t?.t !== 'op' || !ops.includes(t.v)) return a;
      p++;
      a = { k: 'bin', op: t.v, a, b: next() };
    }
  };

  const primary = (): Node => {
    const t = toks[p++];
    if (!t) throw new FErr('#EROARE!');
    switch (t.t) {
      case 'num': return { k: 'lit', v: t.v };
      case 'str': return { k: 'lit', v: t.v };
      case 'bool': return { k: 'lit', v: t.v };
      case 'err': return { k: 'lit', v: new FErr(t.v) };
      case 'ref': return { k: 'ref', r: t.r, c: t.c, sh: t.sh };
      case 'range': return { k: 'range', r1: t.r1, c1: t.c1, r2: t.r2, c2: t.c2, sh: t.sh, ...(t.sh2 ? { sh2: t.sh2 } : {}) };
      case 'name': return { k: 'name', v: nameKey(t.raw) };
      case 'arr': return { k: 'arr', v: t.v };
      case 'fn': {
        expect('(');
        const args: Node[] = [];
        if (!isOp(')')) {
          for (;;) {
            args.push(isOp(',') || isOp(')') ? { k: 'lit', v: null } : compare());
            if (isOp(',')) { p++; continue; }
            break;
          }
        }
        expect(')');
        return { k: 'fn', name: t.v, args };
      }
      case 'op':
        if (t.v === '(') {
          // (A1:B3,F2): unirea de zone din Excel, scrisă între paranteze.
          const e = compare();
          if (!isOp(',')) { expect(')'); return e; }
          const parts = [e];
          while (isOp(',')) { p++; parts.push(compare()); }
          expect(')');
          return { k: 'fn', name: '_UNION', args: parts };
        }
        if (t.v === '-' || t.v === '+') return { k: 'un', op: t.v, a: postfix() };
    }
    throw new FErr('#EROARE!');
  };
  // A1:INDEX(…) sau OFFSET(…):B9: zona dintre două referințe calculate (A1:B9 scris direct e deja o zonă din tokenizer).
  const span = (): Node => {
    let a = primary();
    while (isOp(':')) { p++; a = { k: 'fn', name: '_SPAN', args: [a, primary()] }; }
    return a;
  };
  // A1:B3~F2: unirea de zone din LibreOffice („~”), cu prioritate mai mare decât restul operatorilor.
  const union = (): Node => {
    const a = span();
    if (!isOp('~')) return a;
    const parts = [a];
    while (isOp('~')) { p++; parts.push(span()); }
    return { k: 'fn', name: '_UNION', args: parts };
  };
  const postfix = (): Node => {
    let a = union();
    while (isOp('%')) { p++; a = { k: 'pct', a }; }
    return a;
  };
  const power = binLevel(['^'], postfix);
  const mul = binLevel(['*', '/'], power);
  const add = binLevel(['+', '-'], mul);
  const concat = binLevel(['&'], add);
  const compare = binLevel(['=', '<>', '<', '>', '<=', '>='], concat);

  const root = compare();
  if (p !== toks.length) throw new FErr('#EROARE!');
  return root;
}

// ---------- Calculul ----------

function rawValue(text: string | undefined): Scalar {
  if (text === undefined || text === '') return null;
  // Un apostrof în față ('0722…, '00123) înseamnă text, ca în Excel: zerourile din față rămân, nu se calculează.
  if (text.startsWith("'")) return text.slice(1);
  if (isNumber(text)) return Number(text.trim().replace(',', '.'));
  // ADEVĂRAT / FALS scrise în celulă (și casetele de bifat) sunt valori logice, ca în Excel.
  if (/^(TRUE|FALSE|ADEV[ĂA]RAT|FALS)$/i.test(text.trim())) return /^(TRUE|ADEV)/i.test(text.trim());
  // O eroare scrisă singură în celulă (#N/A, #DIV/0!…) e o eroare, ca în Excel (ISNA, ERROR.TYPE o recunosc).
  if (text[0] === '#') { ERR_LIT.lastIndex = 0; const e = ERR_LIT.exec(text.trim()); if (e && e[0].length === text.trim().length) return new FErr(e[0].toUpperCase()); }
  return text;
}

function toNum(v: Scalar): number {
  if (v instanceof FErr) throw v;
  if (v === null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  // Textul gol ("" dintr-o formulă) nu e număr: =""+1 dă #VALUE!, ca în aplicația mare. Celula goală e null, deci 0, mai sus.
  if (v.trim() === '') throw new FErr('#VALUE!');
  if (isNumber(v)) return Number(v.trim().replace(',', '.'));
  const d = textSerial(v);
  if (d !== null) return d;
  throw new FErr('#VALUE!');
}

/** Text cu dată și/sau oră → numărul Excel (2014-04-21, 18.10.2026 13:45, 17:20:00, 4 PM); altfel null. */
function textSerial(s: string): number | null {
  const t = s.trim();
  if (!/\d/.test(t) || t.length > 40) return null;
  const d = parseDateText(t);
  if (d !== null) return d;
  const TIME = /^\d{1,2}(?::\d{2}(?::\d{2}(?:[.,]\d+)?)?\s*(?:am|pm)?|\s*(?:am|pm))$/i;
  if (TIME.test(t)) return parseTimeText(t);
  const m = /^(.+?)[\sT]+(\d{1,2}(?::\d{2}(?::\d{2}(?:[.,]\d+)?)?\s*(?:am|pm)?|\s*(?:am|pm)))$/i.exec(t);
  if (!m) return null;
  const day = parseDateText(m[1]), time = parseTimeText(m[2]);
  return day !== null && time !== null ? day + time : null;
}

function toStr(v: Scalar): string {
  if (v instanceof FErr) throw v;
  if (v === null) return '';
  if (typeof v === 'number') return formatNumber(v);
  if (typeof v === 'boolean') return v ? 'ADEVĂRAT' : 'FALS';
  return v;
}

function toBool(v: Scalar): boolean {
  if (v instanceof FErr) throw v;
  if (typeof v === 'string') {
    const u = normName(v);
    if (u === 'TRUE' || u === 'ADEVARAT') return true;
    if (u === 'FALSE' || u === 'FALS' || u === '') return false;
    throw new FErr('#VALUE!');
  }
  return toNum(v) !== 0;
}

const scalar = (v: Value): Scalar => (Array.isArray(v) ? (v[0]?.[0] ?? null) : v);

/** Toate valorile dintr-o listă de argumente; din zone luăm doar ce e completat. */
function flatten(vals: Value[]): { v: Scalar; direct: boolean }[] {
  const out: { v: Scalar; direct: boolean }[] = [];
  for (const v of vals) {
    if (Array.isArray(v)) for (const row of v) for (const x of row) out.push({ v: x, direct: false });
    else out.push({ v, direct: true });
  }
  return out;
}

/**
 * Valorile logice pentru AND / OR, ca în Excel: din zone (și din celulele date prin referință) textul și celulele goale se sar;
 * textul scris direct trebuie să fie ADEVĂRAT / FALS; fără nicio valoare logică: #VALUE!.
 */
function logicals(vals: Value[]): boolean[] {
  const out: boolean[] = [];
  for (const { v, direct } of flatten(vals)) {
    if (v instanceof FErr) throw v;
    if (v === null || (typeof v === 'string' && !direct)) continue;
    out.push(toBool(v));
  }
  if (!out.length) throw new FErr('#VALUE!');
  return out;
}

/** Numerele pentru SUM, AVERAGE, MIN…: din zone doar numerele, direct orice se poate transforma în număr. */
function numbers(vals: Value[]): number[] {
  const out: number[] = [];
  for (const { v, direct } of flatten(vals)) {
    if (v instanceof FErr) throw v;
    if (direct) out.push(toNum(v));
    else if (typeof v === 'number') out.push(v);
  }
  return out;
}

/** Comparare românească fără litere mari/mici și diacritice (un singur obiect: localeCompare cu opțiuni e de zeci de ori mai lent). */
const RO_BASE = new Intl.Collator('ro', { sensitivity: 'base' });
function compareVals(op: string, a: Scalar, b: Scalar): boolean {
  if (a instanceof FErr) throw a;
  if (b instanceof FErr) throw b;
  if (a === null) a = typeof b === 'string' ? '' : 0;
  if (b === null) b = typeof a === 'string' ? '' : 0;
  let d: number;
  if (typeof a === 'number' && typeof b === 'number') d = a - b;
  else if (typeof a === 'string' && typeof b === 'string') d = a === b ? 0 : RO_BASE.compare(a, b);
  else if (typeof a === 'boolean' && typeof b === 'boolean') d = Number(a) - Number(b);
  else {
    // Ca în Excel: numere < texte < valori logice.
    const rank = (x: Scalar) => (typeof x === 'number' ? 0 : typeof x === 'string' ? 1 : 2);
    d = rank(a) - rank(b);
  }
  switch (op) {
    case '=': return d === 0;
    case '<>': return d !== 0;
    case '<': return d < 0;
    case '>': return d > 0;
    case '<=': return d <= 0;
    default: return d >= 0;
  }
}

/**
 * Căutările cu expresii regulate, ca în LibreOffice („testi..”, „^Ion.*”): fișierele .ods le au implicit
 * (Instrumente → Opțiuni → Calc → Calculează). Se pune pe durata unui evaluateAll, după tabel.
 */
let regexCrit = false;
const REGEX_CHARS = /[.*+?^$()[\]{}|\\]/;

/** Textul căutat ca expresie regulată pe toată celula (fără litere mari/mici); null dacă nu e o expresie validă. */
function regexOf(target: string): RegExp | null {
  try { return new RegExp('^(?:' + target + ')$', 'iu'); } catch { return null; }
}

/** Condiții ca în SUMIF: ">5", "<>gata", "mere", "m*re". */
function matcher(crit: Scalar): (v: Scalar) => boolean {
  // O eroare drept criteriu (=COUNTIF(A1:A9;#N/A), „#DIV/0!”) se potrivește cu celulele care au aceeași eroare, ca în Excel.
  if (crit instanceof FErr) return (v) => v instanceof FErr && v.code === crit.code;
  if (typeof crit !== 'string') return (v) => v !== null && compareVals('=', v, crit);
  const m = /^(<=|>=|<>|<|>|=)?(.*)$/s.exec(crit)!;
  const op = m[1] ?? '=';
  const target = rawValue(m[2]);
  if (target instanceof FErr && (op === '=' || op === '<>')) return (v) => (v instanceof FErr && v.code === target.code) === (op === '=');
  if (target instanceof FErr) return () => false;
  if (regexCrit && typeof target === 'string' && (op === '=' || op === '<>') && REGEX_CHARS.test(target)) {
    const re = regexOf(target);
    if (re) return (v) => (v !== null && !(v instanceof FErr) && re.test(String(v))) === (op === '=');
  }
  if (!regexCrit && typeof target === 'string' && (op === '=' || op === '<>') && /[*?]/.test(target)) {
    const re = new RegExp('^' + target.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
    return (v) => (typeof v === 'string' && re.test(v)) === (op === '=');
  }
  if (target === null) return (v) => (op === '<>' ? v !== null && v !== '' : v === null || v === '');
  return (v) => {
    if (v === null || v instanceof FErr) return op === '<>';
    if (typeof target === 'number' && typeof v !== 'number') return op === '<>';
    return compareVals(op, v, target);
  };
}

/**
 * CEILING / FLOOR. Excel: pasul negativ cu număr negativ rotunjește spre / dinspre zero, număr pozitiv cu pas negativ e eroare.
 * LibreOffice (al treilea argument, modul): pentru numere negative, mod ≠ 0 rotunjește dinspre zero (CEILING) sau spre zero (FLOOR).
 */
function roundStep(a: Value[], up: boolean): number {
  need(a, 1, 3);
  // Doar argumentul lipsă înseamnă pasul 1; o celulă goală e pasul 0, iar FLOOR cu pasul 0 dă #DIV/0!, ca în aplicația mare.
  const n = toNum(scalar(a[0])), s0 = a[1] === undefined ? 1 : toNum(scalar(a[1])), s = Math.abs(s0);
  if (!s && !up && n) throw new FErr('#DIV/0!');
  if (!s || !n) return 0;
  if (a.length < 3 && n > 0 && s0 < 0) throw new FErr('#NUM!');
  const q = Number((n / s).toPrecision(15));
  // Numerele negative cu pas negativ (Excel) sau cu mod diferit de 0 (LibreOffice) se rotunjesc invers: CEILING dinspre zero, FLOOR spre zero.
  const flip = n < 0 && (a.length === 3 ? toNum(scalar(a[2])) !== 0 : s0 < 0);
  return (up !== flip ? Math.ceil(q) : Math.floor(q)) * s;
}

function roundTo(n: number, digits: number, mode: 'near' | 'up' | 'down'): number {
  const f = 10 ** Math.trunc(digits);
  const x = Math.abs(n) * f;
  const fixed = Number(x.toPrecision(15));
  const r = mode === 'near' ? Math.round(fixed) : mode === 'up' ? Math.ceil(fixed) : Math.floor(fixed);
  return (Math.sign(n) * r) / f;
}

function need(args: Value[], min: number, max = min) {
  if (args.length < min || args.length > max) throw new FErr('#N/A');
}

const FUNCS: Record<string, (a: Value[]) => Scalar> = {
  SUM: (a) => numbers(a).reduce((s, x) => s + x, 0),
  // Fără niciun număr (celule goale) dă 0, nu 1.
  PRODUCT: (a) => { const v = numbers(a); return v.length ? v.reduce((s, x) => s * x, 1) : 0; },
  AVERAGE: (a) => {
    const n = numbers(a);
    if (!n.length) throw new FErr('#DIV/0!');
    return n.reduce((s, x) => s + x, 0) / n.length;
  },
  MIN: (a) => { const n = numbers(a); return n.length ? Math.min(...n) : 0; },
  MAX: (a) => { const n = numbers(a); return n.length ? Math.max(...n) : 0; },
  COUNT: (a) => flatten(a).filter(({ v, direct }) => typeof v === 'number' || (direct && typeof v === 'string' && isNumber(v))).length,
  // Textul gol dintr-o formulă ("") se numără, ca în aplicația mare; doar celulele goale de tot nu.
  COUNTA: (a) => flatten(a).filter(({ v }) => v !== null).length,
  COUNTBLANK: (a) => flatten(a).filter(({ v }) => v === null || v === '').length,
  ROUND: (a) => { need(a, 1, 2); return roundTo(toNum(scalar(a[0])), toNum(scalar(a[1] ?? 0)), 'near'); },
  ROUNDUP: (a) => { need(a, 1, 2); return roundTo(toNum(scalar(a[0])), toNum(scalar(a[1] ?? 0)), 'up'); },
  ROUNDDOWN: (a) => { need(a, 1, 2); return roundTo(toNum(scalar(a[0])), toNum(scalar(a[1] ?? 0)), 'down'); },
  INT: (a) => { need(a, 1); return Math.floor(toNum(scalar(a[0]))); },
  ABS: (a) => { need(a, 1); return Math.abs(toNum(scalar(a[0]))); },
  SQRT: (a) => {
    need(a, 1);
    const n = toNum(scalar(a[0]));
    if (n < 0) throw new FErr('#NUM!');
    return Math.sqrt(n);
  },
  POWER: (a) => { need(a, 2); return toNum(scalar(a[0])) ** toNum(scalar(a[1])); },
  MOD: (a) => {
    need(a, 2);
    const [n, d] = [toNum(scalar(a[0])), toNum(scalar(a[1]))];
    if (d === 0) throw new FErr('#DIV/0!');
    return n - d * Math.floor(n / d);
  },
  AND: (a) => logicals(a).every((v) => v),
  OR: (a) => logicals(a).some((v) => v),
  NOT: (a) => { need(a, 1); return !toBool(scalar(a[0])); },
  CONCAT: (a) => flatten(a).map(({ v }) => toStr(v)).join(''),
  CONCATENATE: (a) => flatten(a).map(({ v }) => toStr(v)).join(''),
  LEN: (a) => { need(a, 1); return toStr(scalar(a[0])).length; },
  UPPER: (a) => { need(a, 1); return toStr(scalar(a[0])).toLocaleUpperCase('ro'); },
  LOWER: (a) => { need(a, 1); return toStr(scalar(a[0])).toLocaleLowerCase('ro'); },
  TRIM: (a) => { need(a, 1); return toStr(scalar(a[0])).trim().replace(/\s+/g, ' '); },
  LEFT: (a) => { need(a, 1, 2); return toStr(scalar(a[0])).slice(0, Math.max(0, toNum(scalar(a[1] ?? 1)))); },
  RIGHT: (a) => {
    need(a, 1, 2);
    const s = toStr(scalar(a[0]));
    const n = Math.max(0, toNum(scalar(a[1] ?? 1)));
    return n ? s.slice(-n) : '';
  },
  SUMIF: (a) => sumIf(a).sum,
  COUNTIF: (a) => { need(a, 2); return sumIf([a[0], a[1], a[0]]).count; },
  AVERAGEIF: (a) => {
    const { sum, count } = sumIf(a);
    if (!count) throw new FErr('#DIV/0!');
    return sum / count;
  },
};

// ---------- Funcții de căutare, condiții multiple, date și texte ----------

const grid = (v: Value): Scalar[][] => (Array.isArray(v) ? v : [[v]]);
const DAY = 86400000;
const EPOCH = Date.UTC(1899, 11, 30);
/** Data Excel (numărul zilei) ↔ an, lună, zi. */
const serialOf = (y: number, m: number, d: number) => Math.round((Date.UTC(y, m - 1, d) - EPOCH) / DAY);
const partsOf = (serial: number) => {
  if (!Number.isFinite(serial) || serial < 0) throw new FErr('#NUM!');
  const d = new Date(EPOCH + Math.floor(serial) * DAY);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), wd: d.getUTCDay() };
};
const today = () => { const n = new Date(); return serialOf(n.getFullYear(), n.getMonth() + 1, n.getDate()); };
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const addMonths = (serial: number, months: number, end: boolean) => {
  const p = partsOf(serial);
  const t = p.m - 1 + Math.trunc(months);
  const y = p.y + Math.floor(t / 12);
  const m = ((t % 12) + 12) % 12 + 1;
  return serialOf(y, m, end ? daysIn(y, m) : Math.min(p.d, daysIn(y, m)));
};

/** Același fel de egalitate ca la „=”: fără litere mari/mici; celula goală nu se potrivește. */
const sameVal = (a: Scalar, b: Scalar) => a !== null && !(a instanceof FErr) && !(b instanceof FErr) && compareVals('=', a, b);

/** Poziția (de la 0) în listă: exact (0), cel mai mare ≤ x (1, listă crescătoare), cel mai mic ≥ x (-1). */
function lookupIndex(x: Scalar, list: Scalar[], mode: number): number {
  if (x instanceof FErr) throw x;
  if (mode === 0) {
    const crit = typeof x === 'string' && (regexCrit ? REGEX_CHARS.test(x) : /[*?]/.test(x)) ? matcher(x) : null;
    const i = list.findIndex((v) => (crit ? crit(v) : sameVal(v, x)));
    if (i < 0) throw new FErr('#N/A');
    return i;
  }
  let best = -1;
  if (mode > 0) {
    // Căutare binară, ca în Excel, printre valorile de același fel cu cel căutat: pe o listă neordonată dă același loc
    // ca acolo (=LOOKUP("DOUBLE";…) găsește „DOUBLE” chiar dacă după el vine „BLANK”). La egalitate merge pe ultimul egal la rând.
    const idx: number[] = [];
    list.forEach((v, i) => { if (v !== null && !(v instanceof FErr) && typeof v === typeof x) idx.push(i); });
    let lo = 0, hi = idx.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const v = list[idx[mid]];
      if (compareVals('=', v, x)) {
        let k = mid;
        while (k + 1 < idx.length && compareVals('=', list[idx[k + 1]], x)) k++;
        return idx[k];
      }
      if (compareVals('<', v, x)) { best = idx[mid]; lo = mid + 1; } else hi = mid - 1;
    }
    if (best < 0) throw new FErr('#N/A');
    return best;
  }
  for (let i = 0; i < list.length; i++) {
    const v = list[i];
    if (v === null || v instanceof FErr || typeof v !== typeof x) continue;
    if (compareVals('>=', v, x)) best = i;
  }
  if (best < 0) throw new FErr('#N/A');
  return best;
}

/**
 * Locul găsit de XLOOKUP (-1 = nimic). match: 0 exact, -1 exact sau următorul mai mic, 1 exact sau următorul mai mare,
 * 2 cu * și ?; search: 1 de la început, -1 de la sfârșit, 2 / -2 căutare binară în lista crescătoare / descrescătoare
 * (ca în Excel: numere < texte < valori logice; la căutarea binară, ce e între ele nu se sare).
 */
function xlookupIndex(x: Scalar, list: Scalar[], match: number, search: number): number {
  if (x instanceof FErr) throw x;
  const cmp = (v: Scalar) => (compareVals('=', v, x) ? 0 : compareVals('<', v, x) ? -1 : 1);
  if (search === 2 || search === -2) {
    let lo = 0, hi = list.length - 1, cand = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const v = list[mid];
      if (v instanceof FErr) { lo = mid + 1; continue; }
      const d = cmp(v) * (search === 2 ? 1 : -1);
      if (d === 0) return mid;
      if (d > 0) { if (match === (search === 2 ? 1 : -1)) cand = mid; hi = mid - 1; }
      else { if (match === (search === 2 ? -1 : 1)) cand = mid; lo = mid + 1; }
    }
    return cand;
  }
  const order = list.map((_, i) => i);
  if (search === -1) order.reverse();
  if (match === 2) { const test = matcher(x); return order.find((i) => !(list[i] instanceof FErr) && test(list[i])) ?? -1; }
  let best = -1;
  for (const i of order) {
    const v = list[i];
    if (v === null || v instanceof FErr) continue;
    if (sameVal(v, x)) return i;
    if (!match || typeof v !== typeof x) continue;
    const d = cmp(v);
    if (match === -1 && d < 0 && (best < 0 || compareVals('>', v, list[best]))) best = i;
    if (match === 1 && d > 0 && (best < 0 || compareVals('<', v, list[best]))) best = i;
  }
  return best;
}

/** Perechile (zonă, condiție) din SUMIFS / COUNTIFS: toate condițiile trebuie să fie îndeplinite. */
function multiMatch(pairs: Value[]): boolean[][] {
  if (!pairs.length || pairs.length % 2) throw new FErr('#N/A');
  const first = grid(pairs[0]);
  const ok = first.map((row) => row.map(() => true));
  for (let k = 0; k < pairs.length; k += 2) {
    const g = grid(pairs[k]);
    if (g.length !== first.length || (g[0]?.length ?? 0) !== (first[0]?.length ?? 0)) throw new FErr('#VALUE!');
    const test = matcher(scalar(pairs[k + 1]));
    g.forEach((row, i) => row.forEach((v, j) => { if (!test(v)) ok[i][j] = false; }));
  }
  return ok;
}

function sumIfs(vals: Value, pairs: Value[]): { sum: number; count: number } {
  const ok = multiMatch(pairs);
  const g = grid(vals);
  let sum = 0;
  let count = 0;
  ok.forEach((row, i) => row.forEach((y, j) => {
    if (!y) return;
    const x = g[i]?.[j];
    if (typeof x === 'number') { sum += x; count++; }
  }));
  return { sum, count };
}

/** TEXT(valoare; "format"): numere („0,00”, „#.##0,00”, „0%”) și date („zz.ll.aaaa”, „dd.mm.yyyy”). */

function textFormat(v: Scalar, fmt: string): string {
  // Codul se scrie ca într-o foaie românească („#.##0,00”, „zz.ll.aaaa”) sau ca în fișiere („#,##0.00”, „dd.mm.yyyy”): amândouă merg.
  // Un text care arată a număr („12”) se formatează ca număr; altfel rămâne text (sau trece prin secțiunea de text, „@”).
  let x: number | string | boolean = typeof v === 'boolean' ? v : typeof v === 'number' ? v : String(v ?? '');
  if (typeof x === 'string' && x.trim() !== '') { try { x = toNum(x); } catch { /* rămâne text */ } }
  else if (x === '') x = 0;
  return formatCode(x, codeFromLocal(fmt), formatNumber).text;
}

Object.assign(FUNCS, {
  VLOOKUP: (a: Value[]) => {
    need(a, 3, 4);
    const g = grid(a[1]);
    const col = Math.trunc(toNum(scalar(a[2])));
    if (col < 1 || col > (g[0]?.length ?? 0)) throw new FErr('#REF!');
    const exact = a[3] !== undefined && !toBool(scalar(a[3]));
    return g[lookupIndex(scalar(a[0]), g.map((r) => r[0]), exact ? 0 : 1)][col - 1];
  },
  HLOOKUP: (a: Value[]) => {
    need(a, 3, 4);
    const g = grid(a[1]);
    const row = Math.trunc(toNum(scalar(a[2])));
    if (row < 1 || row > g.length) throw new FErr('#REF!');
    const exact = a[3] !== undefined && !toBool(scalar(a[3]));
    return g[row - 1][lookupIndex(scalar(a[0]), g[0], exact ? 0 : 1)];
  },
  XLOOKUP: (a: Value[]) => {
    need(a, 3, 6);
    const look = grid(a[1]).flat();
    const ret = grid(a[2]);
    const flat = ret.length === 1 ? ret[0] : ret.map((r) => r[0]);
    const match = a[4] === undefined || scalar(a[4]) === null ? 0 : Math.trunc(toNum(scalar(a[4])));
    const search = a[5] === undefined || scalar(a[5]) === null ? 1 : Math.trunc(toNum(scalar(a[5])));
    if (![0, -1, 1, 2].includes(match) || ![1, -1, 2, -2].includes(search)) throw new FErr('#VALUE!');
    const i = xlookupIndex(scalar(a[0]), look, match, search);
    if (i >= 0) return flat[i] ?? null;
    const nf = a[3] === undefined ? null : scalar(a[3]);
    if (nf !== null) return nf;
    throw new FErr('#N/A');
  },
  MATCH: (a: Value[]) => {
    need(a, 2, 3);
    const g = grid(a[1]);
    const list = g.length === 1 ? g[0] : g.map((r) => r[0]);
    return lookupIndex(scalar(a[0]), list, a[2] === undefined ? 1 : Math.sign(toNum(scalar(a[2])))) + 1;
  },
  INDEX: (a: Value[]) => {
    need(a, 2, 3);
    const g = grid(a[0]);
    let r = Math.trunc(toNum(scalar(a[1])));
    let c = a[2] === undefined ? 1 : Math.trunc(toNum(scalar(a[2])));
    if (g.length === 1 && a[2] === undefined) { c = r; r = 1; }
    if (r < 1 || c < 1 || r > g.length || c > g[0].length) throw new FErr('#REF!');
    return g[r - 1][c - 1];
  },
  CHOOSE: (a: Value[]) => {
    if (a.length < 2) throw new FErr('#N/A');
    const i = Math.trunc(toNum(scalar(a[0])));
    if (i < 1 || i >= a.length) throw new FErr('#VALUE!');
    return scalar(a[i]);
  },
  SUMIFS: (a: Value[]) => sumIfs(a[0], a.slice(1)).sum,
  COUNTIFS: (a: Value[]) => multiMatch(a).flat().filter(Boolean).length,
  AVERAGEIFS: (a: Value[]) => {
    const { sum, count } = sumIfs(a[0], a.slice(1));
    if (!count) throw new FErr('#DIV/0!');
    return sum / count;
  },
  SUMPRODUCT: (a: Value[]) => {
    if (!a.length) throw new FErr('#N/A');
    const gs = a.map(grid);
    const [h, w] = [gs[0].length, gs[0][0]?.length ?? 0];
    if (gs.some((g) => g.length !== h || (g[0]?.length ?? 0) !== w)) throw new FErr('#VALUE!');
    let s = 0;
    for (let i = 0; i < h; i++) for (let j = 0; j < w; j++) {
      s += gs.reduce((p, g) => { const x = g[i][j]; if (x instanceof FErr) throw x; return p * (typeof x === 'number' ? x : 0); }, 1);
    }
    return s;
  },
  MEDIAN: (a: Value[]) => {
    const n = numbers(a).sort((x, y) => x - y);
    if (!n.length) throw new FErr('#NUM!');
    const h = Math.floor(n.length / 2);
    return n.length % 2 ? n[h] : (n[h - 1] + n[h]) / 2;
  },
  LARGE: (a: Value[]) => {
    need(a, 2);
    const n = numbers([a[0]]).sort((x, y) => y - x);
    const k = Math.trunc(toNum(scalar(a[1])));
    if (k < 1 || k > n.length) throw new FErr('#NUM!');
    return n[k - 1];
  },
  SMALL: (a: Value[]) => {
    need(a, 2);
    const n = numbers([a[0]]).sort((x, y) => x - y);
    const k = Math.trunc(toNum(scalar(a[1])));
    if (k < 1 || k > n.length) throw new FErr('#NUM!');
    return n[k - 1];
  },
  TRUNC: (a: Value[]) => { need(a, 1, 2); const f = 10 ** Math.trunc(toNum(scalar(a[1] ?? 0))); return Math.trunc(toNum(scalar(a[0])) * f) / f; },
  SIGN: (a: Value[]) => { need(a, 1); return Math.sign(toNum(scalar(a[0]))); },
  PI: (a: Value[]) => { need(a, 0); return Math.PI; },
  CEILING: (a: Value[]) => roundStep(a, true),
  FLOOR: (a: Value[]) => roundStep(a, false),
  // Date (numărul zilei, ca în Excel; în celulă se arată cu formatul Dată).
  TODAY: (a: Value[]) => { need(a, 0); return today(); },
  DATE: (a: Value[]) => {
    need(a, 3);
    const [y, m, d] = a.map((x) => Math.trunc(toNum(scalar(x))));
    const s = Math.round((Date.UTC(y, m - 1, d) - EPOCH) / DAY);
    if (s < 0) throw new FErr('#NUM!');
    return s;
  },
  YEAR: (a: Value[]) => { need(a, 1); return partsOf(toNum(scalar(a[0]))).y; },
  MONTH: (a: Value[]) => { need(a, 1); return partsOf(toNum(scalar(a[0]))).m; },
  DAY: (a: Value[]) => { need(a, 1); return partsOf(toNum(scalar(a[0]))).d; },
  // Ziua săptămânii: 1 = duminică (ca în Excel), iar cu al doilea argument 2: 1 = luni.
  WEEKDAY: (a: Value[]) => {
    need(a, 1, 2);
    const wd = partsOf(toNum(scalar(a[0]))).wd;
    return toNum(scalar(a[1] ?? 1)) === 2 ? ((wd + 6) % 7) + 1 : wd + 1;
  },
  EDATE: (a: Value[]) => { need(a, 2); return addMonths(toNum(scalar(a[0])), toNum(scalar(a[1])), false); },
  EOMONTH: (a: Value[]) => { need(a, 2); return addMonths(toNum(scalar(a[0])), toNum(scalar(a[1])), true); },
  // TRUE() și FALSE() scrise ca funcții (așa le salvează unele programe vechi).
  TRUE: (a: Value[]) => { need(a, 0); return true; },
  FALSE: (a: Value[]) => { need(a, 0); return false; },
  DAYS: (a: Value[]) => { need(a, 2); return Math.floor(toNum(scalar(a[0]))) - Math.floor(toNum(scalar(a[1]))); },
  // Zile între două date cu luni de 30 de zile (contabilitate, dobânzi). Metoda americană (implicit) sau europeană (al treilea argument ADEVĂRAT).
  DAYS360: (a: Value[]) => {
    need(a, 2, 3);
    const p = partsOf(toNum(scalar(a[0])));
    const q = partsOf(toNum(scalar(a[1])));
    const eu = a[2] !== undefined && toBool(scalar(a[2]));
    let d1 = p.d, d2 = q.d;
    if (eu) {
      if (d1 === 31) d1 = 30;
      if (d2 === 31) d2 = 30;
    } else {
      if (d1 === 31 || (p.m === 2 && d1 === daysIn(p.y, 2))) d1 = 30;
      if (d2 === 31 && d1 === 30) d2 = 30;
    }
    return (q.y - p.y) * 360 + (q.m - p.m) * 30 + (d2 - d1);
  },
  DATEDIF: (a: Value[]) => {
    need(a, 3);
    const [s, e] = [Math.floor(toNum(scalar(a[0]))), Math.floor(toNum(scalar(a[1])))];
    if (e < s) throw new FErr('#NUM!');
    const u = toStr(scalar(a[2])).toUpperCase();
    if (u === 'D' || u === 'Z') return e - s;
    const p = partsOf(s);
    const q = partsOf(e);
    const months = (q.y - p.y) * 12 + (q.m - p.m) - (q.d < p.d ? 1 : 0);
    if (u === 'M' || u === 'L') return months;
    if (u === 'Y' || u === 'A') return Math.floor(months / 12);
    // YM: lunile peste anii întregi; MD: zilele peste lunile întregi; YD: zilele peste anii întregi.
    if (u === 'YM') return months % 12;
    if (u === 'MD') return q.d >= p.d ? q.d - p.d : e - serialOf(q.y, q.m - 1, p.d);
    if (u === 'YD') { let st = serialOf(q.y, p.m, p.d); if (st > e) st = serialOf(q.y - 1, p.m, p.d); return e - st; }
    throw new FErr('#NUM!');
  },
  // Texte.
  MID: (a: Value[]) => {
    need(a, 3);
    const st = Math.trunc(toNum(scalar(a[1])));
    const n = Math.trunc(toNum(scalar(a[2])));
    if (st < 1 || n < 0) throw new FErr('#VALUE!');
    return toStr(scalar(a[0])).slice(st - 1, st - 1 + n);
  },
  FIND: (a: Value[]) => {
    need(a, 2, 3);
    const i = toStr(scalar(a[1])).indexOf(toStr(scalar(a[0])), Math.trunc(toNum(scalar(a[2] ?? 1))) - 1);
    if (i < 0) throw new FErr('#VALUE!');
    return i + 1;
  },
  SEARCH: (a: Value[]) => {
    need(a, 2, 3);
    const i = toStr(scalar(a[1])).toLocaleLowerCase('ro').indexOf(toStr(scalar(a[0])).toLocaleLowerCase('ro'), Math.trunc(toNum(scalar(a[2] ?? 1))) - 1);
    if (i < 0) throw new FErr('#VALUE!');
    return i + 1;
  },
  SUBSTITUTE: (a: Value[]) => {
    need(a, 3, 4);
    const [s, from, to] = [toStr(scalar(a[0])), toStr(scalar(a[1])), toStr(scalar(a[2]))];
    if (!from) return s;
    if (a[3] === undefined) return s.split(from).join(to);
    const k = Math.trunc(toNum(scalar(a[3])));
    if (k < 1) throw new FErr('#VALUE!');
    let at = -1;
    for (let i = 0; i < k; i++) { at = s.indexOf(from, at + 1); if (at < 0) return s; }
    return s.slice(0, at) + to + s.slice(at + from.length);
  },
  REPLACE: (a: Value[]) => {
    need(a, 4);
    const s = toStr(scalar(a[0]));
    const st = Math.trunc(toNum(scalar(a[1])));
    const n = Math.trunc(toNum(scalar(a[2])));
    if (st < 1 || n < 0) throw new FErr('#VALUE!');
    return s.slice(0, st - 1) + toStr(scalar(a[3])) + s.slice(st - 1 + n);
  },
  VALUE: (a: Value[]) => {
    need(a, 1);
    const v = scalar(a[0]);
    if (typeof v === 'number') return v;
    let s = toStr(v).trim().replace(/\s|lei$|ron$/gi, '');
    // Semnul monedei în față ($1,000 / €12,50): la „$” și „£”, virgula din grupele de câte 3 cifre desparte miile.
    const cur = /^-?[$£€]/.exec(s);
    if (cur) s = s.replace(/[$£€]/, '');
    const us = ((cur && cur[0].slice(-1) !== '€') || /^-?\d{1,3}(,\d{3})+\.\d+%?$/.test(s)) && /^-?\d{1,3}(,\d{3})+(\.\d+)?%?$/.test(s);
    if (us) s = s.replace(/,/g, '');
    const pct = s.endsWith('%');
    const t = us ? (pct ? s.slice(0, -1) : s) : (pct ? s.slice(0, -1) : s).replace(/\.(?=\d{3}(\D|$))/g, '');
    if (!isNumber(t)) throw new FErr('#VALUE!');
    const n = Number(t.replace(',', '.'));
    return pct ? n / 100 : n;
  },
  TEXT: (a: Value[]) => { need(a, 2); return textFormat(scalar(a[0]), toStr(scalar(a[1]))); },
  PROPER: (a: Value[]) => { need(a, 1); return toStr(scalar(a[0])).toLocaleLowerCase('ro').replace(/(^|[^\p{L}])(\p{L})/gu, (_, p, c) => p + c.toLocaleUpperCase('ro')); },
  REPT: (a: Value[]) => { need(a, 2); const n = Math.trunc(toNum(scalar(a[1]))); if (n < 0) throw new FErr('#VALUE!'); return toStr(scalar(a[0])).repeat(Math.min(n, 32767)); },
  EXACT: (a: Value[]) => { need(a, 2); return toStr(scalar(a[0])) === toStr(scalar(a[1])); },
  TEXTJOIN: (a: Value[]) => {
    if (a.length < 3) throw new FErr('#N/A');
    const sep = toStr(scalar(a[0]));
    const skip = toBool(scalar(a[1]));
    return flatten(a.slice(2)).map(({ v }) => toStr(v)).filter((s) => !skip || s !== '').join(sep);
  },
  ISBLANK: (a: Value[]) => { need(a, 1); return scalar(a[0]) === null; },
  ISNUMBER: (a: Value[]) => { need(a, 1); return typeof scalar(a[0]) === 'number'; },
  ISTEXT: (a: Value[]) => { need(a, 1); return typeof scalar(a[0]) === 'string'; },
  // Doar în Suite (Excel nu le are): suma în litere, pentru chitanțe și facturi.
  SUMAINLITERE: (a: Value[]) => {
    need(a, 1, 2);
    const w = amountWords(toNum(scalar(a[0])), a.length > 1 ? toStr(scalar(a[1])) : 'RON');
    if (w === null) throw new FErr('#NUM!');
    return w;
  },
  LITERE: (a: Value[]) => {
    need(a, 1);
    const n = toNum(scalar(a[0]));
    if (Math.abs(n) >= 1e12) throw new FErr('#NUM!');
    return (n < 0 && Math.floor(Math.abs(n)) > 0 ? 'minus ' : '') + intWords(n);
  },
  // Tot doar în Suite: verifică cifra de control a codurilor românești (ADEVĂRAT / FALS).
  VALIDCNP: (a: Value[]) => { need(a, 1); return validCnp(toStr(scalar(a[0]))); },
  VALIDCUI: (a: Value[]) => { need(a, 1); return validCui(toStr(scalar(a[0]))); },
  VALIDIBAN: (a: Value[]) => { need(a, 1); return validIban(toStr(scalar(a[0]))); },
});

/** Codurile din SUBTOTAL (1–11, sau 101–111 care în Excel sar și peste rândurile ascunse de mână). */
const SUBTOTAL_FNS: Record<number, string> = { 1: 'AVERAGE', 2: 'COUNT', 3: 'COUNTA', 4: 'MAX', 5: 'MIN', 6: 'PRODUCT', 9: 'SUM' };
/** Codurile din AGGREGATE: 1–13 cu una sau mai multe zone, 14–19 cu o zonă și „k”. */
const AGGREGATE_FNS: Record<number, string> = { 1: 'AVERAGE', 2: 'COUNT', 3: 'COUNTA', 4: 'MAX', 5: 'MIN', 6: 'PRODUCT', 7: 'STDEV.S', 8: 'STDEV.P', 9: 'SUM', 10: 'VAR.S',
  11: 'VAR.P', 12: 'MEDIAN', 13: 'MODE.SNGL', 14: 'LARGE', 15: 'SMALL', 16: 'PERCENTILE.INC', 17: 'QUARTILE.INC', 18: 'PERCENTILE.EXC', 19: 'QUARTILE.EXC' };

function sumIf(a: Value[]): { sum: number; count: number } {
  need(a, 2, 3);
  const grid = (v: Value): Scalar[][] => (Array.isArray(v) ? v : [[v]]);
  const test = matcher(scalar(a[1]));
  const crit = grid(a[0]);
  const vals = grid(a[2] ?? a[0]);
  let sum = 0;
  let count = 0;
  crit.forEach((row, i) => row.forEach((v, j) => {
    if (!test(v)) return;
    count++;
    const x = vals[i]?.[j];
    if (typeof x === 'number') sum += x;
  }));
  return { sum, count };
}

export interface Result {
  /** Textul afișat în celulă. */
  text: string;
  num: boolean;
  /** Valoarea numerică, ca să poată fi afișată în alt format (lei, %, dată). */
  value?: number;
  err?: string;
  /** La o formulă care se varsă (SORT, FILTER…): câte rânduri și coloane ocupă rezultatul. */
  spill?: { rows: number; cols: number };
  /** =IMAGE(…): poza din celulă (adresa http / https sau data:), felul în care intră în celulă și mărimea dată (px). */
  img?: CellImage;
}
/** sizing: 0 = încape în celulă, cu proporțiile păstrate; 1 = umple celula; 2 = mărimea ei; 3 = h × w alese. */
export interface CellImage { src: string; alt: string; sizing: 0 | 1 | 2 | 3; h?: number; w?: number }

// ---------- Funcții matematice, statistice și financiare ----------

/** Un rezultat imposibil (NaN, infinit) devine #NUM!, ca în Excel. */
const finite = (x: number) => { if (!Number.isFinite(x)) throw new FErr('#NUM!'); return x; };
const math1 = (f: (x: number) => number) => (a: Value[]) => { need(a, 1); return finite(f(toNum(scalar(a[0])))); };
const meanOf = (n: number[]) => n.reduce((s, x) => s + x, 0) / n.length;
const devsq = (n: number[]) => { const m = meanOf(n); return n.reduce((s, x) => s + (x - m) ** 2, 0); };
/** Varianța: `sample` = din eșantion (împarte la n-1, ca VAR/STDEV), altfel din toată populația (VARP/STDEVP). */
const variance = (a: Value[], sample: boolean) => {
  const n = numbers(a);
  if (n.length < (sample ? 2 : 1)) throw new FErr('#DIV/0!');
  return devsq(n) / (n.length - (sample ? 1 : 0));
};
const fact = (n: number) => { if (n < 0) throw new FErr('#NUM!'); let p = 1; for (let i = 2; i <= Math.floor(n); i++) p *= i; return finite(p); };
/** Valorile pentru MAXA/MINA: din zone și valorile logice (1/0) și textele (0). */
const numbersA = (a: Value[]) => flatten(a).filter(({ v }) => v !== null).map(({ v, direct }) => {
  if (v instanceof FErr) throw v;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return direct ? toNum(v) : 0;
});
/** Perechile (x, y) din două zone de aceeași mărime, pentru SUMX2MY2 și celelalte. */
const pairs = (a: Value[]) => {
  need(a, 2);
  const [x, y] = [grid(a[0]).flat(), grid(a[1]).flat()];
  if (x.length !== y.length) throw new FErr('#N/A');
  const out: [number, number][] = [];
  x.forEach((v, i) => { const w = y[i]; if (v instanceof FErr) throw v; if (w instanceof FErr) throw w; if (typeof v === 'number' && typeof w === 'number') out.push([v, w]); });
  return out;
};
const arg = (a: Value[], i: number, def = 0) => (a[i] === undefined || a[i] === null ? def : toNum(scalar(a[i])));
/** Secundele din ziua unei date Excel (partea zecimală), rotunjite la secundă. */
const daySeconds = (x: number) => { if (x < 0) throw new FErr('#NUM!'); return Math.round((x - Math.floor(x)) * 86400) % 86400; };
/**
 * Ce rânduri ale unei „baze de date” (primul rând = titlurile) îndeplinesc criteriile (primul rând = titluri, apoi condițiile),
 * ca la DSUM și la Filtrul avansat: pe un rând toate condițiile, între rânduri oricare. Întoarce câte o valoare pentru fiecare
 * rând de date (fără titluri). Un titlu de criteriu care nu e în bază dă #VALUE!.
 */
export function dbRowsMatch(db: Scalar[][], crit: Scalar[][]): boolean[] {
  const heads = (db[0] ?? []).map((h) => normName(toStr(h ?? '')));
  const tests = crit.slice(1).map((row) => (crit[0] ?? []).map((h, j) => {
    if (h === null || h === '' || row[j] === null || row[j] === '' || row[j] === undefined) return null;
    const at = heads.indexOf(normName(toStr(h)));
    if (at < 0) throw new FErr('#VALUE!');
    // Un text simplu („Pop”) se potrivește, ca în Excel, cu orice începe cu el („Popescu”).
    const c = row[j];
    const plain = typeof c === 'string' && !/^(<=|>=|<>|<|>|=)/.test(c) && typeof rawValue(c) === 'string' && !/\*$/.test(c);
    return { at, ok: matcher(plain ? c + '*' : c) };
  }).filter((t) => t !== null));
  return db.slice(1).map((r) => !tests.length || tests.some((t) => t.every(({ at, ok }) => ok(r[at] ?? null))));
}

/** CHAR și CODE folosesc, ca Excel pe un Windows în română, pagina de cod Windows-1250 (cu ă, â, î, ş, ţ). */
const WIN1250 = new TextDecoder('windows-1250').decode(Uint8Array.from({ length: 256 }, (_, i) => i));
/**
 * Funcțiile pe „baze de date” (DSUM, DCOUNT…): (baza cu rândul de titluri; coloana, după titlu sau număr; criteriile, tot cu titluri).
 * Un rând de criterii = condiții care trebuie îndeplinite toate; mai multe rânduri = oricare dintre ele (ca în Excel).
 */
function dbFunctions(): Record<string, (a: Value[]) => Scalar> {
  const pick = (a: Value[]) => {
    need(a, 3);
    const [db, crit] = [grid(a[0]), grid(a[2])];
    if (db.length < 1 || crit.length < 1) throw new FErr('#VALUE!');
    const heads = db[0].map((h) => normName(toStr(h ?? '')));
    const f = scalar(a[1]);
    const col = typeof f === 'number' ? Math.trunc(f) - 1 : heads.indexOf(normName(toStr(f)));
    if (col < 0 || col >= heads.length) throw new FErr('#VALUE!');
    const okRows = dbRowsMatch(db, crit);
    return db.slice(1).filter((_, i) => okRows[i]).map((r) => r[col] ?? null);
  };
  const nums = (v: Scalar[]) => v.filter((x): x is number => typeof x === 'number');
  // DCOUNT / DCOUNTA fără coloană (lipsă sau 0, ca în fișierele .ods): câte rânduri îndeplinesc criteriile.
  const allRows = (a: Value[]) => { const f = a.length >= 3 ? scalar(a[1]) : 1; return f === 0 || f === null || f === ''; };
  const countRows = (a: Value[]) => { need(a, 3); const db = grid(a[0]), crit = grid(a[2]); if (!db.length || !crit.length) throw new FErr('#VALUE!'); return dbRowsMatch(db, crit).filter(Boolean).length; };
  return {
    DSUM: (a) => nums(pick(a)).reduce((s, x) => s + x, 0),
    DCOUNT: (a) => (allRows(a) ? countRows(a) : nums(pick(a)).length),
    DCOUNTA: (a) => (allRows(a) ? countRows(a) : pick(a).filter((x) => x !== null && x !== '').length),
    DAVERAGE: (a) => { const n = nums(pick(a)); if (!n.length) throw new FErr('#DIV/0!'); return meanOf(n); },
    DMAX: (a) => { const n = nums(pick(a)); return n.length ? Math.max(...n) : 0; },
    DMIN: (a) => { const n = nums(pick(a)); return n.length ? Math.min(...n) : 0; },
    DPRODUCT: (a) => nums(pick(a)).reduce((s, x) => s * x, 1),
    DSTDEV: (a) => Math.sqrt(variance([[[...nums(pick(a))]]], true)),
    DSTDEVP: (a) => Math.sqrt(variance([[[...nums(pick(a))]]], false)),
    DVAR: (a) => variance([[[...nums(pick(a))]]], true),
    DVARP: (a) => variance([[[...nums(pick(a))]]], false),
    DGET: (a) => { const v = pick(a); if (!v.length) throw new FErr('#VALUE!'); if (v.length > 1) throw new FErr('#NUM!'); return v[0]; },
  };
}
/** Valoarea viitoare (FV) a unei serii de plăți: rata pe perioadă, numărul de perioade, plata, valoarea de acum, plata la început (1). */
const fv = (r: number, n: number, pmt: number, pv: number, t: number) => (r === 0 ? -(pv + pmt * n) : -(pv * (1 + r) ** n + pmt * (1 + r * t) * (((1 + r) ** n - 1) / r)));

Object.assign(FUNCS, {
  SIN: math1(Math.sin), COS: math1(Math.cos), TAN: math1(Math.tan),
  ASIN: math1(Math.asin), ACOS: math1(Math.acos), ATAN: math1(Math.atan),
  SINH: math1(Math.sinh), COSH: math1(Math.cosh), TANH: math1(Math.tanh),
  ASINH: math1(Math.asinh), ACOSH: math1(Math.acosh), ATANH: math1((x) => (Math.abs(x) >= 1 ? NaN : Math.atanh(x))),
  ATAN2: (a: Value[]) => { need(a, 2); const [x, y] = [toNum(scalar(a[0])), toNum(scalar(a[1]))]; if (!x && !y) throw new FErr('#DIV/0!'); return Math.atan2(y, x); },
  DEGREES: math1((x) => (x * 180) / Math.PI), RADIANS: math1((x) => (x * Math.PI) / 180),
  EXP: math1(Math.exp), LN: math1((x) => (x > 0 ? Math.log(x) : NaN)), LOG10: math1((x) => (x > 0 ? Math.log10(x) : NaN)),
  LOG: (a: Value[]) => {
    need(a, 1, 2);
    const [x, b] = [toNum(scalar(a[0])), arg(a, 1, 10)];
    if (x <= 0 || b <= 0) throw new FErr('#NUM!');
    if (b === 1) throw new FErr('#DIV/0!');
    return Math.log(x) / Math.log(b);
  },
  FACT: (a: Value[]) => { need(a, 1); return fact(toNum(scalar(a[0]))); },
  COMBIN: (a: Value[]) => {
    need(a, 2);
    const [n, k] = [Math.floor(toNum(scalar(a[0]))), Math.floor(toNum(scalar(a[1])))];
    if (n < 0 || k < 0 || k > n) throw new FErr('#NUM!');
    let c = 1;
    for (let i = 1; i <= Math.min(k, n - k); i++) c = (c * (n - i + 1)) / i;
    return finite(Math.round(c));
  },
  PERMUT: (a: Value[]) => {
    need(a, 2);
    const [n, k] = [Math.floor(toNum(scalar(a[0]))), Math.floor(toNum(scalar(a[1])))];
    if (n < 0 || k < 0 || k > n) throw new FErr('#NUM!');
    let p = 1;
    for (let i = n - k + 1; i <= n; i++) p *= i;
    return finite(p);
  },
  // EVEN/ODD: rotunjire în sus (de la zero) la următorul număr par / impar.
  EVEN: (a: Value[]) => { need(a, 1); const x = toNum(scalar(a[0])); const r = Math.ceil(Math.abs(x) / 2) * 2; return x < 0 ? -r : r; },
  ODD: (a: Value[]) => {
    need(a, 1);
    const x = toNum(scalar(a[0]));
    let r = Math.ceil(Math.abs(x));
    if (r % 2 === 0) r += 1;
    return x < 0 ? -r : r;
  },
  QUOTIENT: (a: Value[]) => { need(a, 2); const d = toNum(scalar(a[1])); if (!d) throw new FErr('#DIV/0!'); return Math.trunc(toNum(scalar(a[0])) / d); },
  GCD: (a: Value[]) => {
    const n = numbers(a).map(Math.floor);
    if (n.some((x) => x < 0)) throw new FErr('#NUM!');
    const g = (x: number, y: number): number => (y ? g(y, x % y) : x);
    return n.reduce((s, x) => g(s, x), 0);
  },
  LCM: (a: Value[]) => {
    const n = numbers(a).map(Math.floor);
    if (n.some((x) => x < 0)) throw new FErr('#NUM!');
    const g = (x: number, y: number): number => (y ? g(y, x % y) : x);
    return n.reduce((s, x) => (s && x ? (s * x) / g(s, x) : 0), 1);
  },
  SUMSQ: (a: Value[]) => numbers(a).reduce((s, x) => s + x * x, 0),
  DEVSQ: (a: Value[]) => { const n = numbers(a); if (!n.length) throw new FErr('#NUM!'); return devsq(n); },
  AVEDEV: (a: Value[]) => { const n = numbers(a); if (!n.length) throw new FErr('#NUM!'); const m = meanOf(n); return meanOf(n.map((x) => Math.abs(x - m))); },
  VAR: (a: Value[]) => variance(a, true), 'VAR.S': (a: Value[]) => variance(a, true),
  VARP: (a: Value[]) => variance(a, false), 'VAR.P': (a: Value[]) => variance(a, false),
  STDEV: (a: Value[]) => Math.sqrt(variance(a, true)), 'STDEV.S': (a: Value[]) => Math.sqrt(variance(a, true)),
  STDEVP: (a: Value[]) => Math.sqrt(variance(a, false)), 'STDEV.P': (a: Value[]) => Math.sqrt(variance(a, false)),
  // MODE: valoarea care apare cel mai des (la egalitate, prima găsită); #N/A dacă nicio valoare nu se repetă.
  MODE: (a: Value[]) => {
    const n = numbers(a);
    const count = new Map<number, number>();
    for (const x of n) count.set(x, (count.get(x) ?? 0) + 1);
    let best = NaN, most = 1;
    for (const x of n) { const c = count.get(x)!; if (c > most) { most = c; best = x; } }
    if (Number.isNaN(best)) throw new FErr('#N/A');
    return best;
  },
  MAXA: (a: Value[]) => { const n = numbersA(a); return n.length ? Math.max(...n) : 0; },
  MINA: (a: Value[]) => { const n = numbersA(a); return n.length ? Math.min(...n) : 0; },
  SUMX2MY2: (a: Value[]) => pairs(a).reduce((s, [x, y]) => s + x * x - y * y, 0),
  SUMX2PY2: (a: Value[]) => pairs(a).reduce((s, [x, y]) => s + x * x + y * y, 0),
  SUMXMY2: (a: Value[]) => pairs(a).reduce((s, [x, y]) => s + (x - y) ** 2, 0),
  ISLOGICAL: (a: Value[]) => { need(a, 1); return typeof scalar(a[0]) === 'boolean'; },
  ISNONTEXT: (a: Value[]) => { need(a, 1); return typeof scalar(a[0]) !== 'string'; },
  ISEVEN: (a: Value[]) => { need(a, 1); return Math.floor(Math.abs(toNum(scalar(a[0])))) % 2 === 0; },
  ISODD: (a: Value[]) => { need(a, 1); return Math.floor(Math.abs(toNum(scalar(a[0])))) % 2 === 1; },
  T: (a: Value[]) => { need(a, 1); const v = scalar(a[0]); if (v instanceof FErr) throw v; return typeof v === 'string' ? v : ''; },
  N: (a: Value[]) => { need(a, 1); const v = scalar(a[0]); if (v instanceof FErr) throw v; return typeof v === 'number' ? v : v === true ? 1 : 0; },
  // Finanțe (ca în Excel: banii plătiți sunt negativi, cei primiți pozitivi).
  FV: (a: Value[]) => { need(a, 3, 5); return finite(fv(arg(a, 0), arg(a, 1), arg(a, 2), arg(a, 3), arg(a, 4) ? 1 : 0)); },
  PV: (a: Value[]) => {
    need(a, 3, 5);
    const [r, n, pmt, f, t] = [arg(a, 0), arg(a, 1), arg(a, 2), arg(a, 3), arg(a, 4) ? 1 : 0];
    return finite(r === 0 ? -(f + pmt * n) : -(f + pmt * (1 + r * t) * (((1 + r) ** n - 1) / r)) / (1 + r) ** n);
  },
  PMT: (a: Value[]) => {
    need(a, 3, 5);
    const [r, n, pv, f, t] = [arg(a, 0), arg(a, 1), arg(a, 2), arg(a, 3), arg(a, 4) ? 1 : 0];
    if (!n) throw new FErr('#NUM!');
    return finite(r === 0 ? -(pv + f) / n : -(r * (pv * (1 + r) ** n + f)) / ((1 + r * t) * ((1 + r) ** n - 1)));
  },
  ...dbFunctions(),
  NPER: (a: Value[]) => {
    need(a, 3, 5);
    const [r, pmt, pv, f, t] = [arg(a, 0), arg(a, 1), arg(a, 2), arg(a, 3), arg(a, 4) ? 1 : 0];
    if (r === 0) { if (!pmt) throw new FErr('#NUM!'); return -(pv + f) / pmt; }
    const k = pmt * (1 + r * t);
    return finite(Math.log((k - f * r) / (k + pv * r)) / Math.log(1 + r));
  },
  // IRR: rata la care valoarea de acum a plăților e zero (metoda lui Newton, pornind de la presupunerea dată sau 10%).
  IRR: (a: Value[]) => {
    need(a, 1, 2);
    const cf = numbers([a[0]]);
    if (!cf.some((x) => x > 0) || !cf.some((x) => x < 0)) throw new FErr('#NUM!');
    let r = arg(a, 1, 0.1);
    for (let it = 0; it < 100; it++) {
      let f = 0, d = 0;
      cf.forEach((x, i) => { f += x / (1 + r) ** i; d -= (i * x) / (1 + r) ** (i + 1); });
      if (!d) break;
      const next = r - f / d;
      if (!Number.isFinite(next)) break;
      if (Math.abs(next - r) < 1e-10) return next;
      r = next;
    }
    throw new FErr('#NUM!');
  },
  // Ora: data Excel are ora ca parte zecimală (0,5 = 12:00).
  NOW: (a: Value[]) => { need(a, 0); const n = new Date(); return today() + (n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds()) / 86400; },
  TIME: (a: Value[]) => {
    need(a, 3);
    const s = Math.trunc(toNum(scalar(a[0]))) * 3600 + Math.trunc(toNum(scalar(a[1]))) * 60 + Math.trunc(toNum(scalar(a[2])));
    if (s < 0) throw new FErr('#NUM!');
    return (s % 86400) / 86400;
  },
  HOUR: (a: Value[]) => { need(a, 1); return Math.floor(daySeconds(toNum(scalar(a[0]))) / 3600); },
  MINUTE: (a: Value[]) => { need(a, 1); return Math.floor(daySeconds(toNum(scalar(a[0]))) / 60) % 60; },
  SECOND: (a: Value[]) => { need(a, 1); return daySeconds(toNum(scalar(a[0]))) % 60; },
  CHAR: (a: Value[]) => { need(a, 1); const n = Math.trunc(toNum(scalar(a[0]))); if (n < 1 || n > 255) throw new FErr('#VALUE!'); return WIN1250[n]; },
  CODE: (a: Value[]) => {
    need(a, 1);
    const s = toStr(scalar(a[0]));
    if (!s) throw new FErr('#VALUE!');
    const i = WIN1250.indexOf(s[0]);
    return i >= 0 ? i : s.codePointAt(0)!;
  },
  UNICHAR: (a: Value[]) => { need(a, 1); const n = Math.trunc(toNum(scalar(a[0]))); if (n < 1 || n > 0x10ffff) throw new FErr('#VALUE!'); return String.fromCodePoint(n); },
  UNICODE: (a: Value[]) => { need(a, 1); const s = toStr(scalar(a[0])); if (!s) throw new FErr('#VALUE!'); return s.codePointAt(0)!; },
  AVERAGEA: (a: Value[]) => { const n = numbersA(a); if (!n.length) throw new FErr('#DIV/0!'); return meanOf(n); },
  // LOOKUP(căutat; zona de căutare; [zona rezultatelor]): cel mai mare ≤ căutat, într-o listă crescătoare.
  LOOKUP: (a: Value[]) => {
    need(a, 2, 3);
    const g = grid(a[1]);
    const byRow = g.length >= (g[0]?.length ?? 0);
    const look = a[2] !== undefined ? grid(a[1]).flat() : byRow ? g.map((r) => r[0]) : (g[0] ?? []);
    const res = a[2] !== undefined ? grid(a[2]).flat() : byRow ? g.map((r) => r[r.length - 1]) : (g[g.length - 1] ?? []);
    return res[lookupIndex(scalar(a[0]), look, 1)] ?? new FErr('#N/A');
  },
  // ADDRESS(rând; coloană; [tip]; [stil A1]; [foaie]) → textul adresei, de exemplu $C$2.
  ADDRESS: (a: Value[]) => {
    need(a, 2, 5);
    const [r, c, abs] = [Math.trunc(arg(a, 0)), Math.trunc(arg(a, 1)), Math.trunc(arg(a, 2, 1))];
    if (r < 1 || c < 1 || c > COLS || abs < 1 || abs > 4) throw new FErr('#VALUE!');
    const col = cellId(0, c - 1).replace(/\d+$/, '');
    const ref = (abs === 1 || abs === 3 ? '$' : '') + col + (abs === 1 || abs === 2 ? '$' : '') + r;
    const sheet = a[4] === undefined || a[4] === null ? '' : toStr(scalar(a[4]));
    return sheet ? `${/^[\p{L}_][\p{L}\d_.]*$/u.test(sheet) ? sheet : `'${sheet.replace(/'/g, "''")}'`}!${ref}` : ref;
  },
  NPV: (a: Value[]) => {
    if (a.length < 2) throw new FErr('#N/A');
    const r = toNum(scalar(a[0]));
    return finite(numbers(a.slice(1)).reduce((s, x, i) => s + x / (1 + r) ** (i + 1), 0));
  },
});

// ---------- Statistică (repartiții), date, finanțe și texte mai rar folosite ----------

/** erf(x) cu precizie de ~1e-15: serie Taylor pentru |x| < 3, fracție continuă pentru erfc în rest. */
function erf(x: number): number {
  const ax = Math.abs(x);
  if (ax < 3) {
    let term = x, sum = x;
    for (let n = 1; n < 200; n++) {
      term *= (-x * x) / n;
      const add = term / (2 * n + 1);
      sum += add;
      if (Math.abs(add) < 1e-17 * Math.abs(sum)) break;
    }
    return (2 / Math.sqrt(Math.PI)) * sum;
  }
  // erfc(x) = exp(-x²)/√π · 1/(x + 1/2/(x + 1/(x + 3/2/(x + …))))
  let f = ax;
  for (let n = 60; n >= 1; n--) f = ax + (n / 2) / f;
  const c = Math.exp(-ax * ax) / Math.sqrt(Math.PI) / f;
  return x > 0 ? 1 - c : c - 1;
}
const normCdf = (z: number) => (z < -3 ? 0.5 * (1 - erf(z / Math.SQRT2)) : 0.5 * (1 + erf(z / Math.SQRT2)));
const normPdf = (z: number) => Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
/** Pentru analizele din Sheets (testul z): repartiția normală standard și inversa ei. */
export const normSDist = (z: number) => normCdf(z);
export const normSInv = (p: number) => normInv(p);
/** Inversa repartiției normale standard (Acklam), rafinată cu un pas Newton. */
function normInv(p: number): number {
  if (!(p > 0 && p < 1)) throw new FErr('#NUM!');
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const lo = 0.02425;
  let x: number;
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= 1 - lo) {
    const q = p - 0.5, r = q * q;
    x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  for (let i = 0; i < 2; i++) x -= (normCdf(x) - p) / normPdf(x);
  return x;
}
/** ln(n!) fără depășire (pentru repartițiile binomială și Poisson). */
const lnFact = (n: number) => { let s = 0; for (let i = 2; i <= n; i++) s += Math.log(i); return s; };
const binomPmf = (k: number, n: number, p: number) => {
  if (p === 0) return k === 0 ? 1 : 0;
  if (p === 1) return k === n ? 1 : 0;
  return Math.exp(lnFact(n) - lnFact(k) - lnFact(n - k) + k * Math.log(p) + (n - k) * Math.log(1 - p));
};
const poissonPmf = (k: number, m: number) => (m === 0 ? (k === 0 ? 1 : 0) : Math.exp(-m + k * Math.log(m) - lnFact(k)));

/** Panta și ordonata dreptei celor mai mici pătrate (SLOPE, INTERCEPT, RSQ, FORECAST). */
function regression(a: Value[], yi: number, xi: number) {
  const p = pairs([a[yi], a[xi]]);
  if (p.length < 2) throw new FErr('#DIV/0!');
  const my = meanOf(p.map((q) => q[0]));
  const mx = meanOf(p.map((q) => q[1]));
  let sxy = 0, sxx = 0, syy = 0;
  for (const [y, x] of p) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  if (!sxx) throw new FErr('#DIV/0!');
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx, r2: syy ? (sxy * sxy) / (sxx * syy) : NaN, sxy, sxx, syy };
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Text → dată Excel: 18.10.2026, 18/10/2026, 2026-10-18, 18-oct-2026, 18 octombrie 2026, Oct 18, 2026. */
const MONTHS: Record<string, number> = {};
['ian jan', 'feb', 'mar', 'apr', 'mai may', 'iun jun', 'iul jul', 'aug', 'sep', 'oct', 'noi nov', 'dec'].forEach((s, i) => {
  for (const k of s.split(' ')) MONTHS[k] = i + 1;
});
function parseDateText(s: string): number | null {
  const t = s.trim().toLowerCase();
  let y = 0, m = 0, d = 0;
  let r = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/.exec(t);
  if (r) { d = +r[1]; m = +r[2]; y = +r[3]; }
  else if ((r = /^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/.exec(t))) { y = +r[1]; m = +r[2]; d = +r[3]; }
  else if ((r = /^(\d{1,2})[\s./-]+([\p{L}]{3,})\.?[\s./-]+(\d{2,4})$/u.exec(t))) { d = +r[1]; m = MONTHS[r[2].slice(0, 3)] ?? 0; y = +r[3]; }
  else if ((r = /^([\p{L}]{3,})\.?\s+(\d{1,2}),?\s+(\d{2,4})$/u.exec(t))) { m = MONTHS[r[1].slice(0, 3)] ?? 0; d = +r[2]; y = +r[3]; }
  else return null;
  if (y < 100) y += y < 30 ? 2000 : 1900;
  if (m < 1 || m > 12 || d < 1 || d > daysIn(y, m)) return null;
  return serialOf(y, m, d);
}
/** Text → ora ca fracțiune de zi: 13:45, 13:45:30, 1:45 PM. */
function parseTimeText(s: string): number | null {
  const hOnly = /^(\d{1,2})\s*(am|pm)$/i.exec(s.trim());
  if (hOnly) { const h = +hOnly[1]; return h > 12 ? null : ((h % 12) + (hOnly[2].toLowerCase() === 'pm' ? 12 : 0)) / 24; }
  const r = /(\d{1,2}):(\d{2})(?::(\d{2}(?:[.,]\d+)?))?\s*(am|pm)?\s*$/i.exec(s.trim());
  if (!r) return null;
  let h = +r[1];
  const pm = r[4]?.toLowerCase();
  if (pm) { if (h > 12) return null; h = (h % 12) + (pm === 'pm' ? 12 : 0); }
  const sec = h * 3600 + +r[2] * 60 + Number((r[3] ?? '0').replace(',', '.'));
  return (sec / 86400) % 1;
}

/** Fracțiunea de an dintre două date, după convenția de zile (basis) din Excel. */
function yearFrac(s0: number, e0: number, basis: number): number {
  let s = Math.floor(s0), e = Math.floor(e0);
  if (s > e) [s, e] = [e, s];
  const p = partsOf(s), q = partsOf(e);
  if (basis === 0 || basis === 4) {
    let d1 = p.d, d2 = q.d;
    if (basis === 4) { if (d1 === 31) d1 = 30; if (d2 === 31) d2 = 30; }
    else {
      const lastFebP = p.m === 2 && d1 === daysIn(p.y, 2);
      const lastFebQ = q.m === 2 && d2 === daysIn(q.y, 2);
      if (lastFebP && lastFebQ) d2 = 30;
      if (lastFebP || d1 === 31) d1 = 30;
      if (d2 === 31 && d1 === 30) d2 = 30;
    }
    return ((q.y - p.y) * 360 + (q.m - p.m) * 30 + (d2 - d1)) / 360;
  }
  if (basis === 2) return (e - s) / 360;
  if (basis === 3) return (e - s) / 365;
  if (basis !== 1) throw new FErr('#NUM!');
  const withinYear = q.y === p.y || (q.y === p.y + 1 && (p.m > q.m || (p.m === q.m && p.d >= q.d)));
  if (withinYear) {
    let den = 365;
    if (q.y === p.y) den = isLeap(p.y) ? 366 : 365;
    else if ((isLeap(p.y) && s <= serialOf(p.y, 2, 29)) || (isLeap(q.y) && e >= serialOf(q.y, 2, 29))) den = 366;
    return (e - s) / den;
  }
  return (e - s) / ((serialOf(q.y + 1, 1, 1) - serialOf(p.y, 1, 1)) / (q.y - p.y + 1));
}

/** Dobânda dintr-o rată (IPMT), ca în Excel și LibreOffice. */
function ipmt(r: number, per: number, n: number, pv: number, f: number, t: number): number {
  if (per < 1 || per > n) throw new FErr('#NUM!');
  const pmt = r === 0 ? -(pv + f) / n : -(r * (pv * (1 + r) ** n + f)) / ((1 + r * t) * ((1 + r) ** n - 1));
  if (per === 1) return t === 1 ? 0 : -pv * r;
  return (t === 1 ? fv(r, per - 2, pmt, pv, 1) - pmt : fv(r, per - 1, pmt, pv, 0)) * r;
}
function pmtOf(r: number, n: number, pv: number, f: number, t: number): number {
  return r === 0 ? -(pv + f) / n : -(r * (pv * (1 + r) ** n + f)) / ((1 + r * t) * ((1 + r) ** n - 1));
}
function cumulative(a: Value[], principal: boolean): number {
  need(a, 6);
  const [r, n, pv, s, e, t] = [arg(a, 0), Math.trunc(arg(a, 1)), arg(a, 2), Math.trunc(arg(a, 3)), Math.trunc(arg(a, 4)), arg(a, 5)];
  if (r <= 0 || n <= 0 || pv <= 0 || s < 1 || e < s || e > n || (t !== 0 && t !== 1)) throw new FErr('#NUM!');
  const pmt = pmtOf(r, n, pv, 0, t);
  let sum = 0;
  for (let k = s; k <= e; k++) { const i = ipmt(r, k, n, pv, 0, t); sum += principal ? pmt - i : i; }
  return sum;
}

const ROMAN: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
const bits = (a: Value[], i: number) => {
  const x = toNum(scalar(a[i]));
  if (x < 0 || x !== Math.floor(x) || x >= 2 ** 48) throw new FErr('#NUM!');
  return BigInt(x);
};
const unary = (fn: (x: number) => number) => (a: Value[]) => { need(a, 1); return finite(fn(toNum(scalar(a[0])))); };
const prob = (a: Value[], i: number) => { const p = toNum(scalar(a[i])); if (p < 0 || p > 1) throw new FErr('#NUM!'); return p; };
const count = (a: Value[], i: number) => { const n = Math.trunc(toNum(scalar(a[i]))); if (n < 0) throw new FErr('#NUM!'); return n; };

Object.assign(FUNCS, {
  NA: (a: Value[]) => { need(a, 0); throw new FErr('#N/A'); },
  TYPE: (a: Value[]) => {
    need(a, 1);
    if (Array.isArray(a[0]) && (a[0].length > 1 || (a[0][0]?.length ?? 0) > 1)) return 64;
    const v = scalar(a[0]);
    return v instanceof FErr ? 16 : typeof v === 'string' ? 2 : typeof v === 'boolean' ? 4 : 1;
  },
  XOR: (a: Value[]) => {
    const v = flatten(a).filter(({ v }) => typeof v === 'number' || typeof v === 'boolean');
    if (!v.length) throw new FErr('#VALUE!');
    return v.filter(({ v }) => toBool(v)).length % 2 === 1;
  },
  // Texte.
  // ENCODEURL(text): textul pentru o adresă web; rămân doar literele, cifrele și - _ . ~ (ca în RFC 3986), restul devine %XX (UTF-8).
  ENCODEURL: (a: Value[]) => {
    need(a, 1);
    return encodeURIComponent(toStr(scalar(a[0]))).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  },
  // WEBSERVICE(adresă): textul de la o adresă http / https (sheets/webService.ts); cât se aduce, #BUSY!.
  WEBSERVICE: (a: Value[]) => {
    need(a, 1);
    const url = toStr(scalar(a[0])).trim();
    if (url.length > 2048 || !/^https?:\/\/[^\s]+$/i.test(url)) throw new FErr('#VALUE!');
    const g = webText(url);
    if (!g) throw new FErr('#BUSY!');
    if ('err' in g) throw new FErr(g.err);
    return g.text;
  },
  // DETECTLANGUAGE(text): codul limbii textului (ro, en, fr, de, it, es, hu, pt, nl, pl), ghicit local, fără internet
  // (docs/langDetect.ts); textul gol dă #VALUE!, cel din care nu se poate spune limba #N/A.
  DETECTLANGUAGE: (a: Value[]) => {
    need(a, 1);
    const t = toStr(scalar(a[0])).trim();
    if (!t) throw new FErr('#VALUE!');
    const l = detectLang(t, true);
    if (!l) throw new FErr('#N/A');
    return l.split('-')[0];
  },
  // PHONETIC(referință): citirea fonetică (furigana) a textului japonez; fără ea, chiar textul primei celule.
  PHONETIC: (a: Value[]) => {
    need(a, 1);
    const v = grid(a[0])[0]?.[0] ?? '';
    if (v instanceof FErr) throw v;
    return toStr(v);
  },
  CLEAN: (a: Value[]) => { need(a, 1); return [...toStr(scalar(a[0]))].filter((ch) => ch.charCodeAt(0) >= 32).join(''); },
  // DOLLAR / MONEDĂ: numărul scris ca sumă de bani, în lei (ca un Excel în română).
  DOLLAR: (a: Value[]) => {
    need(a, 1, 2);
    const dec = Math.trunc(arg(a, 1, 2));
    const n = roundTo(toNum(scalar(a[0])), dec, 'near');
    const s = Math.abs(n).toFixed(Math.max(0, dec)).split('.');
    return (n < 0 ? '-' : '') + s[0].replace(/\B(?=(\d{3})+$)/g, '.') + (s[1] ? ',' + s[1] : '') + ' lei';
  },
  ROMAN: (a: Value[]) => {
    need(a, 1, 2);
    let n = Math.trunc(toNum(scalar(a[0])));
    if (n < 0 || n > 3999) throw new FErr('#VALUE!');
    let out = '';
    for (const [v, s] of ROMAN) while (n >= v) { out += s; n -= v; }
    return out;
  },
  ARABIC: (a: Value[]) => {
    need(a, 1);
    const s = toStr(scalar(a[0])).trim().toUpperCase();
    const neg = s.startsWith('-');
    const t = neg ? s.slice(1) : s;
    if (!/^[MDCLXVI]*$/.test(t)) throw new FErr('#VALUE!');
    const val: Record<string, number> = { M: 1000, D: 500, C: 100, L: 50, X: 10, V: 5, I: 1 };
    let n = 0;
    for (let i = 0; i < t.length; i++) n += val[t[i]] < (val[t[i + 1]] ?? 0) ? -val[t[i]] : val[t[i]];
    return neg ? -n : n;
  },
  NUMBERVALUE: (a: Value[]) => {
    need(a, 1, 3);
    const dec = a[1] === undefined ? ',' : toStr(scalar(a[1]))[0] ?? ',';
    const grp = a[2] === undefined ? '.' : toStr(scalar(a[2]))[0] ?? '.';
    let s = toStr(scalar(a[0])).replace(/\s/g, '');
    if (!s) return 0;
    let pct = 0;
    while (s.endsWith('%')) { pct++; s = s.slice(0, -1); }
    const i = s.indexOf(dec);
    const whole = (i < 0 ? s : s.slice(0, i)).split(grp).join('');
    const frac = i < 0 ? '' : s.slice(i + 1);
    if (frac.includes(grp) || !/^[-+]?\d*$/.test(whole) || !/^\d*$/.test(frac) || (!whole.replace(/[-+]/, '') && !frac)) throw new FErr('#VALUE!');
    return Number(whole + '.' + (frac || '0')) / 100 ** pct;
  },
  BASE: (a: Value[]) => {
    need(a, 2, 3);
    const n = toNum(scalar(a[0])), radix = Math.trunc(arg(a, 1)), len = Math.trunc(arg(a, 2));
    if (n < 0 || n >= 2 ** 53 || radix < 2 || radix > 36 || len < 0) throw new FErr('#NUM!');
    return Math.trunc(n).toString(radix).toUpperCase().padStart(len, '0');
  },
  DECIMAL: (a: Value[]) => {
    need(a, 2);
    const s = toStr(scalar(a[0])).trim().toLowerCase(), radix = Math.trunc(arg(a, 1));
    if (radix < 2 || radix > 36) throw new FErr('#NUM!');
    let n = 0;
    for (const ch of s) {
      const d = parseInt(ch, 36);
      if (Number.isNaN(d) || d >= radix) throw new FErr('#NUM!');
      n = n * radix + d;
    }
    return n;
  },
  // HYPERLINK / HYPERLINK: în celulă se vede numele dat (sau adresa).
  HYPERLINK: (a: Value[]) => { need(a, 1, 2); return a[1] === undefined ? toStr(scalar(a[0])) : scalar(a[1]); },
  // Matematică.
  MROUND: (a: Value[]) => {
    need(a, 2);
    const n = toNum(scalar(a[0])), m = toNum(scalar(a[1]));
    if (!m) return 0;
    if (n * m < 0) throw new FErr('#NUM!');
    return Math.round(n / m + 1e-12 * Math.sign(n / m)) * m;
  },
  COT: unary((x) => { if (!x) throw new FErr('#DIV/0!'); return 1 / Math.tan(x); }),
  CSC: unary((x) => { if (!x) throw new FErr('#DIV/0!'); return 1 / Math.sin(x); }),
  SEC: unary((x) => 1 / Math.cos(x)),
  COTH: unary((x) => { if (!x) throw new FErr('#DIV/0!'); return 1 / Math.tanh(x); }),
  CSCH: unary((x) => { if (!x) throw new FErr('#DIV/0!'); return 1 / Math.sinh(x); }),
  SECH: unary((x) => 1 / Math.cosh(x)),
  ACOT: unary((x) => Math.PI / 2 - Math.atan(x)),
  FACTDOUBLE: (a: Value[]) => {
    need(a, 1);
    const n = Math.trunc(toNum(scalar(a[0])));
    if (n < -1) throw new FErr('#NUM!');
    let p = 1;
    for (let i = n; i > 1; i -= 2) p *= i;
    return finite(p);
  },
  PERMUTATIONA: (a: Value[]) => { need(a, 2); const n = count(a, 0), k = count(a, 1); return finite(n ** k); },
  BITAND: (a: Value[]) => { need(a, 2); return Number(bits(a, 0) & bits(a, 1)); },
  BITOR: (a: Value[]) => { need(a, 2); return Number(bits(a, 0) | bits(a, 1)); },
  BITXOR: (a: Value[]) => { need(a, 2); return Number(bits(a, 0) ^ bits(a, 1)); },
  BITLSHIFT: (a: Value[]) => {
    need(a, 2);
    const s = Math.trunc(arg(a, 1));
    const r = s >= 0 ? bits(a, 0) << BigInt(s) : bits(a, 0) >> BigInt(-s);
    if (r >= 2n ** 48n) throw new FErr('#NUM!');
    return Number(r);
  },
  BITRSHIFT: (a: Value[]) => {
    need(a, 2);
    const s = Math.trunc(arg(a, 1));
    const r = s >= 0 ? bits(a, 0) >> BigInt(s) : bits(a, 0) << BigInt(-s);
    if (r >= 2n ** 48n) throw new FErr('#NUM!');
    return Number(r);
  },
  // Date și ore.
  DATEVALUE: (a: Value[]) => {
    need(a, 1);
    const v = scalar(a[0]);
    const d = typeof v === 'string' ? parseDateText(v.replace(/\s+\d{1,2}:\d{2}(:\d{2})?\s*(am|pm)?$/i, '')) : null;
    if (d === null) throw new FErr('#VALUE!');
    return d;
  },
  TIMEVALUE: (a: Value[]) => {
    need(a, 1);
    const v = scalar(a[0]);
    const t = typeof v === 'string' ? parseTimeText(v) : null;
    if (t === null) throw new FErr('#VALUE!');
    return t;
  },
  WEEKNUM: (a: Value[]) => {
    need(a, 1, 2);
    const s = Math.floor(toNum(scalar(a[0])));
    const type = Math.trunc(arg(a, 1, 1));
    // 150 = ISO 8601 în formatul OpenDocument (.ods), la fel ca 21.
    if (type === 21 || type === 150) return isoWeek(s);
    const start = type === 1 || type === 17 ? 0 : type === 2 || type === 11 ? 1 : type >= 12 && type <= 16 ? type - 10 : -1;
    if (start < 0) throw new FErr('#NUM!');
    const jan1 = serialOf(partsOf(s).y, 1, 1);
    const off = (partsOf(jan1).wd - start + 7) % 7;
    return Math.floor((s - jan1 + off) / 7) + 1;
  },
  ISOWEEKNUM: (a: Value[]) => { need(a, 1, 2); return isoWeek(Math.floor(toNum(scalar(a[0])))); },
  YEARFRAC: (a: Value[]) => { need(a, 2, 3); return yearFrac(toNum(scalar(a[0])), toNum(scalar(a[1])), Math.trunc(arg(a, 2))); },
  DAYSINMONTH: (a: Value[]) => { need(a, 1); const p = partsOf(toNum(scalar(a[0]))); return daysIn(p.y, p.m); },
  DAYSINYEAR: (a: Value[]) => { need(a, 1); return isLeap(partsOf(toNum(scalar(a[0]))).y) ? 366 : 365; },
  ISLEAPYEAR: (a: Value[]) => { need(a, 1); return isLeap(partsOf(toNum(scalar(a[0]))).y); },
  // Statistică: regresie liniară.
  SLOPE: (a: Value[]) => { need(a, 2); return regression(a, 0, 1).slope; },
  INTERCEPT: (a: Value[]) => { need(a, 2); return regression(a, 0, 1).intercept; },
  RSQ: (a: Value[]) => { need(a, 2); const r = regression(a, 0, 1).r2; if (Number.isNaN(r)) throw new FErr('#DIV/0!'); return r; },
  CORREL: (a: Value[]) => {
    need(a, 2);
    const r = regression(a, 0, 1);
    if (!r.syy) throw new FErr('#DIV/0!');
    return r.sxy / Math.sqrt(r.sxx * r.syy);
  },
  FORECAST: (a: Value[]) => { need(a, 3); const r = regression(a, 1, 2); return r.intercept + r.slope * toNum(scalar(a[0])); },
  // Repartiții.
  'NORM.DIST': (a: Value[]) => {
    need(a, 4);
    const [x, m, s] = [arg(a, 0), arg(a, 1), arg(a, 2)];
    if (s <= 0) throw new FErr('#NUM!');
    return toBool(scalar(a[3])) ? normCdf((x - m) / s) : normPdf((x - m) / s) / s;
  },
  'NORM.S.DIST': (a: Value[]) => { need(a, 2); const z = arg(a, 0); return toBool(scalar(a[1])) ? normCdf(z) : normPdf(z); },
  NORMSDIST: (a: Value[]) => { need(a, 1); return normCdf(arg(a, 0)); },
  'NORM.INV': (a: Value[]) => { need(a, 3); const s = arg(a, 2); if (s <= 0) throw new FErr('#NUM!'); return arg(a, 1) + s * normInv(arg(a, 0)); },
  'NORM.S.INV': (a: Value[]) => { need(a, 1); return normInv(arg(a, 0)); },
  PHI: (a: Value[]) => { need(a, 1); return normPdf(arg(a, 0)); },
  GAUSS: (a: Value[]) => { need(a, 1); return normCdf(arg(a, 0)) - 0.5; },
  STANDARDIZE: (a: Value[]) => { need(a, 3); const s = arg(a, 2); if (s <= 0) throw new FErr('#NUM!'); return (arg(a, 0) - arg(a, 1)) / s; },
  'BINOM.DIST': (a: Value[]) => {
    need(a, 4);
    const k = count(a, 0), n = count(a, 1), p = prob(a, 2);
    if (k > n) throw new FErr('#NUM!');
    if (!toBool(scalar(a[3]))) return binomPmf(k, n, p);
    let s = 0;
    for (let i = 0; i <= k; i++) s += binomPmf(i, n, p);
    return Math.min(1, s);
  },
  'POISSON.DIST': (a: Value[]) => {
    need(a, 3);
    const k = count(a, 0), m = arg(a, 1);
    if (m < 0) throw new FErr('#NUM!');
    if (!toBool(scalar(a[2]))) return poissonPmf(k, m);
    let s = 0;
    for (let i = 0; i <= k; i++) s += poissonPmf(i, m);
    return Math.min(1, s);
  },
  'EXPON.DIST': (a: Value[]) => {
    need(a, 3);
    const x = arg(a, 0), l = arg(a, 1);
    if (x < 0 || l <= 0) throw new FErr('#NUM!');
    return toBool(scalar(a[2])) ? 1 - Math.exp(-l * x) : l * Math.exp(-l * x);
  },
  // Finanțe.
  IPMT: (a: Value[]) => { need(a, 4, 6); return finite(ipmt(arg(a, 0), Math.trunc(arg(a, 1)), arg(a, 2), arg(a, 3), arg(a, 4), arg(a, 5) ? 1 : 0)); },
  PPMT: (a: Value[]) => {
    need(a, 4, 6);
    const [r, per, n, pv, f, t] = [arg(a, 0), Math.trunc(arg(a, 1)), arg(a, 2), arg(a, 3), arg(a, 4), arg(a, 5) ? 1 : 0];
    return finite(pmtOf(r, n, pv, f, t) - ipmt(r, per, n, pv, f, t));
  },
  CUMIPMT: (a: Value[]) => cumulative(a, false),
  CUMPRINC: (a: Value[]) => cumulative(a, true),
  EFFECT: (a: Value[]) => { need(a, 2); const r = arg(a, 0), p = Math.trunc(arg(a, 1)); if (r <= 0 || p < 1) throw new FErr('#NUM!'); return (1 + r / p) ** p - 1; },
  NOMINAL: (a: Value[]) => { need(a, 2); const r = arg(a, 0), p = Math.trunc(arg(a, 1)); if (r <= 0 || p < 1) throw new FErr('#NUM!'); return p * ((1 + r) ** (1 / p) - 1); },
  // RATE: dobânda pe perioadă la care plățile acoperă suma (metoda lui Newton, ca IRR).
  RATE: (a: Value[]) => {
    need(a, 3, 6);
    const [n, pmt, pv, f, t] = [arg(a, 0), arg(a, 1), arg(a, 2), arg(a, 3), arg(a, 4) ? 1 : 0];
    if (n <= 0) throw new FErr('#NUM!');
    const g = (r: number) => (Math.abs(r) < 1e-12 ? pv + pmt * n + f : pv * (1 + r) ** n + pmt * (1 + r * t) * (((1 + r) ** n - 1) / r) + f);
    let r = arg(a, 5, 0.1);
    for (let it = 0; it < 200; it++) {
      const h = Math.max(1e-7, Math.abs(r) * 1e-7);
      const d = (g(r + h) - g(r - h)) / (2 * h);
      if (!d || !Number.isFinite(d)) break;
      const next = r - g(r) / d;
      if (!Number.isFinite(next) || next <= -1) break;
      if (Math.abs(next - r) < 1e-12) return next;
      r = next;
    }
    throw new FErr('#NUM!');
  },
  // XMATCH(căutat; listă; [potrivire: 0 exact, -1 exact sau mai mic, 1 exact sau mai mare, 2 cu * și ?]; [căutare: 1 de la început, -1 de la sfârșit]).
  XMATCH: (a: Value[]) => {
    need(a, 2, 4);
    const x = scalar(a[0]);
    if (x instanceof FErr) throw x;
    const g = grid(a[1]);
    const list = g.length === 1 ? g[0] : g.map((r) => r[0]);
    const mode = Math.trunc(arg(a, 2)), dir = Math.trunc(arg(a, 3, 1));
    const order = list.map((_, i) => i);
    if (dir < 0) order.reverse();
    const crit = mode === 2 && typeof x === 'string' ? matcher(x) : null;
    let best = -1;
    for (const i of order) {
      const v = list[i];
      if (crit ? crit(v) : sameVal(v, x)) return i + 1;
      if ((mode === -1 || mode === 1) && v !== null && !(v instanceof FErr) && typeof v === typeof x
        && compareVals(mode === -1 ? '<' : '>', v, x)
        && (best < 0 || compareVals(mode === -1 ? '>' : '<', v, list[best]))) best = i;
    }
    if (best < 0) throw new FErr('#N/A');
    return best + 1;
  },
});
// ---------- Repartițiile gamma, beta, χ², F, t și celelalte; percentile, ranguri, teste statistice ----------

/** ln Γ(x) pentru x > 0 (Lanczos, g = 7), precizie ~1e-15. */
function lnGamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lnGamma(1 - x);
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  x -= 1;
  let s = c[0];
  for (let i = 1; i < 9; i++) s += c[i] / (x + i);
  const t = x + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(s);
}
const lnBeta = (a: number, b: number) => lnGamma(a) + lnGamma(b) - lnGamma(a + b);
const lnComb = (n: number, k: number) => lnGamma(n + 1) - lnGamma(k + 1) - lnGamma(n - k + 1);
/** Funcția gamma incompletă regularizată P(a, x) (serie sau fracție continuă, ca în Numerical Recipes). */
function gammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  const lg = a * Math.log(x) - x - lnGamma(a);
  if (x < a + 1) {
    let sum = 1 / a, del = sum;
    for (let n = 1; n < 1000; n++) { del *= x / (a + n); sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-16) break; }
    return Math.min(1, sum * Math.exp(lg));
  }
  return 1 - gammaQcf(a, x, lg);
}
function gammaQcf(a: number, x: number, lg: number): number {
  const tiny = 1e-300;
  let b = x + 1 - a, c = 1 / tiny, d = 1 / b, h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c; if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-16) break;
  }
  return Math.exp(lg) * h;
}
/** Q(a, x) = 1 − P(a, x), calculat direct (precis și pentru cozi mici). */
const gammaQ = (a: number, x: number) => (x <= 0 ? 1 : x < a + 1 ? 1 - gammaP(a, x) : gammaQcf(a, x, a * Math.log(x) - x - lnGamma(a)));
/** Funcția beta incompletă regularizată I_x(a, b). */
function betaI(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lnBeta(a, b));
  if (x > (a + 1) / (a + b + 2)) return 1 - front * betaCf(1 - x, b, a) / b;
  return front * betaCf(x, a, b) / a;
}
function betaCf(x: number, a: number, b: number): number {
  const tiny = 1e-300;
  let c = 1, d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let m = 1; m < 1000; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d; if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c; if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-16) break;
  }
  return h;
}
/** Inversa unei funcții de repartiție crescătoare: caută x cu cdf(x) = p, prin înjumătățire (lent, dar sigur). */
function invert(cdf: (x: number) => number, p: number, lo: number, hi: number, maxHi = 1e300): number {
  while (cdf(hi) < p && hi < maxHi) { lo = hi; hi *= 2; }
  for (let i = 0; i < 400 && hi - lo > 1e-15 * Math.max(1, Math.abs(hi)); i++) {
    const mid = (lo + hi) / 2;
    if (cdf(mid) < p) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
const gammaPdf = (x: number, k: number, th: number) =>
  (x === 0 ? (k === 1 ? 1 / th : k < 1 ? Infinity : 0) : Math.exp((k - 1) * Math.log(x) - x / th - lnGamma(k) - k * Math.log(th)));
const fCdf = (x: number, d1: number, d2: number) => (x <= 0 ? 0 : betaI(d1 * x / (d1 * x + d2), d1 / 2, d2 / 2));
const tCdf = (t: number, v: number) => { const tail = 0.5 * betaI(v / (v + t * t), v / 2, 0.5); return t > 0 ? 1 - tail : tail; };
const tPdf = (t: number, v: number) => Math.exp(lnGamma((v + 1) / 2) - lnGamma(v / 2) - 0.5 * Math.log(v * Math.PI) - (v + 1) / 2 * Math.log(1 + t * t / v));
/** t cu P(|T| > t) = p (T.INV.2T). */
const tInv2 = (p: number, v: number) => invert((t) => 1 - betaI(v / (v + t * t), v / 2, 0.5), 1 - p, 0, 1);
const degrees = (a: Value[], i: number) => { const v = Math.trunc(arg(a, i)); if (v < 1 || v > 1e10) throw new FErr('#NUM!'); return v; };
const positive = (a: Value[], i: number) => { const v = arg(a, i); if (!(v > 0)) throw new FErr('#NUM!'); return v; };
const openProb = (a: Value[], i: number) => { const p = arg(a, i); if (!(p > 0 && p < 1)) throw new FErr('#NUM!'); return p; };
const sortedNums = (v: Value) => { const n = numbers([v]).sort((x, y) => x - y); if (!n.length) throw new FErr('#NUM!'); return n; };
/** Percentila cu interpolare: inclusiv (ca PERCENTILE) sau exclusiv (PERCENTILE.EXC). */
function percentile(n: number[], k: number, exc: boolean): number {
  const N = n.length;
  let h: number;
  if (exc) { h = k * (N + 1) - 1; if (h < 0 || h > N - 1) throw new FErr('#NUM!'); } else { if (k < 0 || k > 1) throw new FErr('#NUM!'); h = k * (N - 1); }
  const lo = Math.floor(h);
  return lo + 1 < N ? n[lo] + (h - lo) * (n[lo + 1] - n[lo]) : n[lo];
}
/** Rangul procentual: poziția lui x în listă (cu interpolare între valori), trunchiat la „cifre” zecimale, ca în Excel. */
function percentRank(a: Value[], exc: boolean): number {
  need(a, 2, 3);
  const n = sortedNums(a[0]), x = arg(a, 1), sig = Math.trunc(arg(a, 2, 3));
  if (sig < 1) throw new FErr('#NUM!');
  const N = n.length;
  if (x < n[0] || x > n[N - 1]) throw new FErr('#N/A');
  const pos = (i: number) => (exc ? (i + 1) / (N + 1) : N === 1 ? 1 : i / (N - 1));
  let r = 0;
  for (let i = 0; i < N; i++) {
    if (n[i] === x) { r = pos(i); break; }
    if (n[i] < x && n[i + 1] > x) { r = pos(i) + (x - n[i]) / (n[i + 1] - n[i]) * (pos(i + 1) - pos(i)); break; }
  }
  const f = 10 ** sig;
  return Math.floor(r * f + 1e-9) / f;
}
function rankOf(a: Value[], avg: boolean): number {
  need(a, 2, 3);
  const x = arg(a, 0), n = numbers([a[1]]), asc = arg(a, 2) !== 0;
  const better = n.filter((v) => (asc ? v < x : v > x)).length, same = n.filter((v) => v === x).length;
  if (!same) throw new FErr('#N/A');
  return avg ? better + (same + 1) / 2 : better + 1;
}
const sampleVar = (n: number[]) => { const m = meanOf(n); return n.reduce((s, x) => s + (x - m) ** 2, 0) / (n.length - 1); };
function covariance(a: Value[], sample: boolean): number {
  need(a, 2);
  const g1 = grid(a[0]).flat(), g2 = grid(a[1]).flat();
  if (g1.length !== g2.length) throw new FErr('#N/A');
  const p: [number, number][] = [];
  g1.forEach((x, i) => { const y = g2[i]; if (typeof x === 'number' && typeof y === 'number') p.push([x, y]); });
  if (p.length < (sample ? 2 : 1)) throw new FErr('#DIV/0!');
  const mx = meanOf(p.map((q) => q[0])), my = meanOf(p.map((q) => q[1]));
  return p.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0) / (p.length - (sample ? 1 : 0));
}
function skewness(a: Value[], pop: boolean): number {
  const n = numbers(a), N = n.length, m = meanOf(n);
  if (N < 3 && !pop) throw new FErr('#DIV/0!');
  const s = Math.sqrt(n.reduce((t, x) => t + (x - m) ** 2, 0) / (pop ? N : N - 1));
  if (!s) throw new FErr('#DIV/0!');
  const s3 = n.reduce((t, x) => t + ((x - m) / s) ** 3, 0);
  return pop ? s3 / N : s3 * N / ((N - 1) * (N - 2));
}

Object.assign(FUNCS, {
  GAMMA: (a: Value[]) => {
    need(a, 1);
    const x = arg(a, 0);
    if (x <= 0 && Number.isInteger(x)) throw new FErr('#NUM!');
    if (x < 0.5) return finite(Math.PI / (Math.sin(Math.PI * x) * Math.exp(lnGamma(1 - x))));
    return finite(Math.exp(lnGamma(x)));
  },
  GAMMALN: (a: Value[]) => { need(a, 1); return lnGamma(positive(a, 0)); },
  'GAMMA.DIST': (a: Value[]) => {
    need(a, 4);
    const x = arg(a, 0), k = positive(a, 1), th = positive(a, 2);
    if (x < 0) throw new FErr('#NUM!');
    return toBool(scalar(a[3])) ? gammaP(k, x / th) : finite(gammaPdf(x, k, th));
  },
  'GAMMA.INV': (a: Value[]) => {
    need(a, 3);
    const p = prob(a, 0), k = positive(a, 1), th = positive(a, 2);
    if (p === 0) return 0;
    if (p === 1) throw new FErr('#NUM!');
    return invert((x) => gammaP(k, x / th), p, 0, k * th);
  },
  'CHISQ.DIST': (a: Value[]) => {
    need(a, 3);
    const x = arg(a, 0), v = degrees(a, 1);
    if (x < 0) throw new FErr('#NUM!');
    return toBool(scalar(a[2])) ? gammaP(v / 2, x / 2) : finite(gammaPdf(x, v / 2, 2));
  },
  'CHISQ.DIST.RT': (a: Value[]) => { need(a, 2); const x = arg(a, 0), v = degrees(a, 1); if (x < 0) throw new FErr('#NUM!'); return gammaQ(v / 2, x / 2); },
  'CHISQ.INV': (a: Value[]) => { need(a, 2); const p = prob(a, 0), v = degrees(a, 1); if (p === 1) throw new FErr('#NUM!'); return p ? invert((x) => gammaP(v / 2, x / 2), p, 0, v) : 0; },
  'CHISQ.INV.RT': (a: Value[]) => {
    need(a, 2);
    const p = prob(a, 0), v = degrees(a, 1);
    if (p === 0) throw new FErr('#NUM!');
    return p === 1 ? 0 : invert((x) => -gammaQ(v / 2, x / 2), -p, 0, v);
  },
  'BETA.DIST': (a: Value[]) => {
    need(a, 4, 6);
    const x = arg(a, 0), al = positive(a, 1), be = positive(a, 2), A = arg(a, 4), B = arg(a, 5, 1);
    if (x < A || x > B || A >= B) throw new FErr('#NUM!');
    const z = (x - A) / (B - A);
    if (toBool(scalar(a[3]))) return betaI(z, al, be);
    return finite(Math.exp((al - 1) * Math.log(z) + (be - 1) * Math.log(1 - z) - lnBeta(al, be)) / (B - A));
  },
  BETADIST: (a: Value[]) => { need(a, 3, 5); return FUNCS['BETA.DIST']([a[0], a[1], a[2], true, a[3] ?? 0, a[4] ?? 1]); },
  'BETA.INV': (a: Value[]) => {
    need(a, 3, 5);
    const p = prob(a, 0), al = positive(a, 1), be = positive(a, 2), A = arg(a, 3), B = arg(a, 4, 1);
    if (A >= B) throw new FErr('#NUM!');
    return A + (B - A) * invert((z) => betaI(z, al, be), p, 0, 1, 1);
  },
  'F.DIST': (a: Value[]) => {
    need(a, 4);
    const x = arg(a, 0), d1 = degrees(a, 1), d2 = degrees(a, 2);
    if (x < 0) throw new FErr('#NUM!');
    if (toBool(scalar(a[3]))) return fCdf(x, d1, d2);
    if (x === 0) return d1 === 2 ? 1 : d1 < 2 ? Infinity : 0;
    return finite(Math.exp(0.5 * (d1 * Math.log(d1 * x) + d2 * Math.log(d2) - (d1 + d2) * Math.log(d1 * x + d2)) - Math.log(x) - lnBeta(d1 / 2, d2 / 2)));
  },
  'F.DIST.RT': (a: Value[]) => {
    need(a, 3);
    const x = arg(a, 0), d1 = degrees(a, 1), d2 = degrees(a, 2);
    if (x < 0) throw new FErr('#NUM!');
    return x === 0 ? 1 : betaI(d2 / (d2 + d1 * x), d2 / 2, d1 / 2);
  },
  'F.INV': (a: Value[]) => { need(a, 3); const p = prob(a, 0), d1 = degrees(a, 1), d2 = degrees(a, 2); if (p === 1) throw new FErr('#NUM!'); return p ? invert((x) => fCdf(x, d1, d2), p, 0, 1) : 0; },
  'F.INV.RT': (a: Value[]) => {
    need(a, 3);
    const p = prob(a, 0), d1 = degrees(a, 1), d2 = degrees(a, 2);
    if (p === 0) throw new FErr('#NUM!');
    return p === 1 ? 0 : invert((x) => -betaI(d2 / (d2 + d1 * x), d2 / 2, d1 / 2), -p, 0, 1);
  },
  'T.DIST': (a: Value[]) => {
    need(a, 3);
    const t = arg(a, 0), v = degrees(a, 1);
    return toBool(scalar(a[2])) ? tCdf(t, v) : tPdf(t, v);
  },
  'T.DIST.2T': (a: Value[]) => { need(a, 2); const t = arg(a, 0), v = degrees(a, 1); if (t < 0) throw new FErr('#NUM!'); return betaI(v / (v + t * t), v / 2, 0.5); },
  'T.DIST.RT': (a: Value[]) => { need(a, 2); const t = arg(a, 0), v = degrees(a, 1), h = 0.5 * betaI(v / (v + t * t), v / 2, 0.5); return t >= 0 ? h : 1 - h; },
  TDIST: (a: Value[]) => {
    need(a, 3);
    const t = arg(a, 0), v = degrees(a, 1), tails = Math.trunc(arg(a, 2));
    if (t < 0 || (tails !== 1 && tails !== 2)) throw new FErr('#NUM!');
    const two = betaI(v / (v + t * t), v / 2, 0.5);
    return tails === 2 ? two : two / 2;
  },
  'T.INV': (a: Value[]) => {
    need(a, 2);
    const p = openProb(a, 0), v = degrees(a, 1);
    if (p === 0.5) return 0;
    const t = tInv2(2 * Math.min(p, 1 - p), v);
    return p < 0.5 ? -t : t;
  },
  'T.INV.2T': (a: Value[]) => { need(a, 2); const p = arg(a, 0), v = degrees(a, 1); if (!(p > 0 && p <= 1)) throw new FErr('#NUM!'); return p === 1 ? 0 : tInv2(p, v); },
  'HYPGEOM.DIST': (a: Value[]) => {
    need(a, 4, 5);
    const s = count(a, 0), n = count(a, 1), K = count(a, 2), N = count(a, 3);
    if (n < 1 || n > N || K < 1 || K > N || s > Math.min(n, K) || s < Math.max(0, n - N + K)) throw new FErr('#NUM!');
    const pmf = (i: number) => Math.exp(lnComb(K, i) + lnComb(N - K, n - i) - lnComb(N, n));
    if (!toBool(scalar(a[4] ?? false))) return pmf(s);
    let sum = 0;
    for (let i = Math.max(0, n - N + K); i <= s; i++) sum += pmf(i);
    return Math.min(1, sum);
  },
  'NEGBINOM.DIST': (a: Value[]) => {
    need(a, 3, 4);
    const f = count(a, 0), s = Math.trunc(arg(a, 1)), p = prob(a, 2);
    if (s < 1) throw new FErr('#NUM!');
    if (toBool(scalar(a[3] ?? false))) return betaI(p, s, f + 1);
    if (p === 0 || p === 1) return p === 1 && f === 0 ? 1 : 0;
    return Math.exp(lnComb(f + s - 1, s - 1) + s * Math.log(p) + f * Math.log(1 - p));
  },
  'WEIBULL.DIST': (a: Value[]) => {
    need(a, 4);
    const x = arg(a, 0), k = positive(a, 1), l = positive(a, 2);
    if (x < 0) throw new FErr('#NUM!');
    const e = Math.exp(-((x / l) ** k));
    return toBool(scalar(a[3])) ? 1 - e : finite(k / l * (x / l) ** (k - 1) * e);
  },
  'LOGNORM.DIST': (a: Value[]) => {
    need(a, 3, 4);
    const x = positive(a, 0), m = arg(a, 1), s = positive(a, 2);
    const z = (Math.log(x) - m) / s;
    return toBool(scalar(a[3] ?? true)) ? normCdf(z) : normPdf(z) / (x * s);
  },
  'LOGNORM.INV': (a: Value[]) => { need(a, 3); const p = openProb(a, 0), m = arg(a, 1), s = positive(a, 2); return Math.exp(m + s * normInv(p)); },
  FISHER: (a: Value[]) => { need(a, 1); const x = arg(a, 0); if (!(x > -1 && x < 1)) throw new FErr('#NUM!'); return Math.atanh(x); },
  FISHERINV: (a: Value[]) => { need(a, 1); return Math.tanh(arg(a, 0)); },
  'CONFIDENCE.NORM': (a: Value[]) => {
    need(a, 3);
    const al = openProb(a, 0), s = positive(a, 1), n = Math.trunc(arg(a, 2));
    if (n < 1) throw new FErr('#NUM!');
    return normInv(1 - al / 2) * s / Math.sqrt(n);
  },
  'CONFIDENCE.T': (a: Value[]) => {
    need(a, 3);
    const al = openProb(a, 0), s = positive(a, 1), n = Math.trunc(arg(a, 2));
    if (n < 1) throw new FErr('#NUM!');
    if (n === 1) throw new FErr('#DIV/0!');
    return tInv2(al, n - 1) * s / Math.sqrt(n);
  },
  'Z.TEST': (a: Value[]) => {
    need(a, 2, 3);
    const n = numbers([a[0]]);
    if (n.length < 2 && a[2] === undefined) throw new FErr('#DIV/0!');
    if (!n.length) throw new FErr('#N/A');
    const s = a[2] === undefined || a[2] === null ? Math.sqrt(sampleVar(n)) : arg(a, 2);
    if (!s) throw new FErr('#DIV/0!');
    return 1 - normCdf((meanOf(n) - arg(a, 1)) / (s / Math.sqrt(n.length)));
  },
  'T.TEST': (a: Value[]) => {
    need(a, 4);
    const tails = Math.trunc(arg(a, 2)), type = Math.trunc(arg(a, 3));
    if ((tails !== 1 && tails !== 2) || type < 1 || type > 3) throw new FErr('#NUM!');
    let t: number, v: number;
    if (type === 1) {
      const g1 = grid(a[0]).flat(), g2 = grid(a[1]).flat();
      if (g1.length !== g2.length) throw new FErr('#N/A');
      const d: number[] = [];
      g1.forEach((x, i) => { const y = g2[i]; if (typeof x === 'number' && typeof y === 'number') d.push(x - y); });
      if (d.length < 2) throw new FErr('#DIV/0!');
      const sd = Math.sqrt(sampleVar(d));
      if (!sd) throw new FErr('#DIV/0!');
      t = meanOf(d) / (sd / Math.sqrt(d.length));
      v = d.length - 1;
    } else {
      const x = numbers([a[0]]), y = numbers([a[1]]), n1 = x.length, n2 = y.length;
      if (n1 < 2 || n2 < 2) throw new FErr('#DIV/0!');
      const v1 = sampleVar(x), v2 = sampleVar(y), diff = meanOf(x) - meanOf(y);
      if (type === 2) {
        v = n1 + n2 - 2;
        const sp = ((n1 - 1) * v1 + (n2 - 1) * v2) / v;
        t = diff / Math.sqrt(sp * (1 / n1 + 1 / n2));
      } else {
        const q1 = v1 / n1, q2 = v2 / n2;
        t = diff / Math.sqrt(q1 + q2);
        v = (q1 + q2) ** 2 / (q1 * q1 / (n1 - 1) + q2 * q2 / (n2 - 1));
      }
      if (!Number.isFinite(t)) throw new FErr('#DIV/0!');
    }
    t = Math.abs(t);
    const two = betaI(v / (v + t * t), v / 2, 0.5);
    return tails === 2 ? two : two / 2;
  },
  'F.TEST': (a: Value[]) => {
    need(a, 2);
    const x = numbers([a[0]]), y = numbers([a[1]]);
    if (x.length < 2 || y.length < 2) throw new FErr('#DIV/0!');
    const v1 = sampleVar(x), v2 = sampleVar(y);
    if (!v1 || !v2) throw new FErr('#DIV/0!');
    const c = fCdf(v1 / v2, x.length - 1, y.length - 1);
    return 2 * Math.min(c, 1 - c);
  },
  'CHISQ.TEST': (a: Value[]) => {
    need(a, 2);
    const o = grid(a[0]), e = grid(a[1]);
    const R = o.length, C = o[0]?.length ?? 0;
    if (e.length !== R || (e[0]?.length ?? 0) !== C) throw new FErr('#N/A');
    let chi = 0;
    for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
      const x = o[i][j], y = e[i][j];
      if (x instanceof FErr) throw x;
      if (y instanceof FErr) throw y;
      if (typeof x !== 'number' || typeof y !== 'number') continue;
      if (y === 0) throw new FErr('#DIV/0!');
      chi += (x - y) ** 2 / y;
    }
    const v = R > 1 && C > 1 ? (R - 1) * (C - 1) : R * C - 1;
    if (v < 1) throw new FErr('#N/A');
    return gammaQ(v / 2, chi / 2);
  },
  // Percentile, cuartile, ranguri.
  PERCENTILE: (a: Value[]) => { need(a, 2); return percentile(sortedNums(a[0]), arg(a, 1), false); },
  'PERCENTILE.EXC': (a: Value[]) => { need(a, 2); const k = arg(a, 1); if (!(k > 0 && k < 1)) throw new FErr('#NUM!'); return percentile(sortedNums(a[0]), k, true); },
  QUARTILE: (a: Value[]) => {
    need(a, 2);
    const q = Math.trunc(arg(a, 1));
    if (q < 0 || q > 4) throw new FErr('#NUM!');
    return percentile(sortedNums(a[0]), q / 4, false);
  },
  'QUARTILE.EXC': (a: Value[]) => {
    need(a, 2);
    const q = Math.trunc(arg(a, 1));
    if (q < 1 || q > 3) throw new FErr('#NUM!');
    return percentile(sortedNums(a[0]), q / 4, true);
  },
  PERCENTRANK: (a: Value[]) => percentRank(a, false),
  'PERCENTRANK.EXC': (a: Value[]) => percentRank(a, true),
  RANK: (a: Value[]) => rankOf(a, false),
  'RANK.AVG': (a: Value[]) => rankOf(a, true),
  // Medii și forma repartiției.
  GEOMEAN: (a: Value[]) => {
    const n = numbers(a);
    if (!n.length || n.some((x) => x <= 0)) throw new FErr('#NUM!');
    return Math.exp(n.reduce((s, x) => s + Math.log(x), 0) / n.length);
  },
  HARMEAN: (a: Value[]) => {
    const n = numbers(a);
    if (!n.length || n.some((x) => x <= 0)) throw new FErr('#NUM!');
    return n.length / n.reduce((s, x) => s + 1 / x, 0);
  },
  TRIMMEAN: (a: Value[]) => {
    need(a, 2);
    const n = sortedNums(a[0]), p = arg(a, 1);
    if (p < 0 || p >= 1) throw new FErr('#NUM!');
    const cut = Math.floor(n.length * p / 2);
    return meanOf(n.slice(cut, n.length - cut));
  },
  SKEW: (a: Value[]) => skewness(a, false),
  'SKEW.P': (a: Value[]) => skewness(a, true),
  KURT: (a: Value[]) => {
    const n = numbers(a), N = n.length;
    if (N < 4) throw new FErr('#DIV/0!');
    const m = meanOf(n), s = Math.sqrt(sampleVar(n));
    if (!s) throw new FErr('#DIV/0!');
    const s4 = n.reduce((t, x) => t + ((x - m) / s) ** 4, 0);
    return N * (N + 1) / ((N - 1) * (N - 2) * (N - 3)) * s4 - 3 * (N - 1) ** 2 / ((N - 2) * (N - 3));
  },
  COVAR: (a: Value[]) => covariance(a, false),
  'COVARIANCE.S': (a: Value[]) => covariance(a, true),
  STEYX: (a: Value[]) => {
    need(a, 2);
    const r = regression(a, 0, 1), n = pairs([a[0], a[1]]).length;
    if (n < 3) throw new FErr('#DIV/0!');
    return Math.sqrt((r.syy - r.sxy * r.sxy / r.sxx) / (n - 2));
  },
  // PROB(valori; probabilități; de la; [până la]): probabilitatea ca valoarea să fie în interval.
  PROB: (a: Value[]) => {
    need(a, 3, 4);
    const xs = grid(a[0]).flat(), ps = grid(a[1]).flat();
    if (xs.length !== ps.length) throw new FErr('#N/A');
    const lo = arg(a, 2), hi = a[3] === undefined || a[3] === null ? lo : arg(a, 3);
    let total = 0, s = 0;
    xs.forEach((x, i) => {
      const p = ps[i];
      if (typeof p !== 'number') return;
      if (p < 0 || p > 1) throw new FErr('#NUM!');
      total += p;
      if (typeof x === 'number' && x >= lo && x <= hi) s += p;
    });
    if (Math.abs(total - 1) > 1e-7) throw new FErr('#NUM!');
    return s;
  },
});
// ---------- Amortizare și alte funcții financiare, statistică „A”, conversii între baze, funcții LibreOffice ----------

/** Amortizarea degresivă pe o perioadă întreagă (ca DDB în Excel). */
function ddbOf(cost: number, salv: number, life: number, per: number, factor: number): number {
  let rate = factor / life, old: number;
  if (rate >= 1) { rate = 1; old = per === 1 ? cost : 0; } else old = cost * (1 - rate) ** (per - 1);
  const now = cost * (1 - rate) ** per;
  return Math.max(0, now < salv ? old - salv : old - now);
}
/** VDB pe perioadele 0…period, trecând la amortizarea liniară când aceasta devine mai mare. */
function interVdb(cost: number, salv: number, life: number, life1: number, period: number, factor: number): number {
  let vdb = 0, sln = 0, left = cost - salv, toSln = false;
  const end = Math.ceil(period);
  for (let i = 1; i <= end; i++) {
    let term: number;
    if (!toSln) {
      const ddb = ddbOf(cost, salv, life, i, factor);
      sln = left / (life1 - (i - 1));
      if (sln > ddb) { term = sln; toSln = true; } else { term = ddb; left -= ddb; }
    } else term = sln;
    if (i === end) term *= period + 1 - end;
    vdb += term;
  }
  return vdb;
}
/** Valoarea actuală a plăților la date oarecare (XNPV) și derivata ei după rată. */
function xnpvOf(r: number, v: number[], d: number[]): [number, number] {
  let f = 0, df = 0;
  v.forEach((x, i) => { const t = (d[i] - d[0]) / 365; f += x / (1 + r) ** t; df -= t * x / (1 + r) ** (t + 1); });
  return [f, df];
}
const flowsAndDates = (a: Value[], vi: number, di: number) => {
  const v = grid(a[vi]).flat(), d = grid(a[di]).flat();
  if (v.length !== d.length) throw new FErr('#NUM!');
  for (const x of [...v, ...d]) { if (x instanceof FErr) throw x; if (typeof x !== 'number') throw new FErr('#VALUE!'); }
  const dates = (d as number[]).map(Math.floor);
  if (dates.some((x) => x < dates[0])) throw new FErr('#NUM!');
  return { v: v as number[], d: dates };
};
/** Conversii între baze, ca în Excel: 10 cifre, iar numerele negative în complement față de baza^10. */
const BASE_MAX = { 2: 2 ** 9, 8: 2 ** 29, 16: 2 ** 39 } as Record<number, number>;
function fromBase(v: Value, base: number): number {
  const s = String(typeof v === 'number' ? v : toStr(scalar(v))).trim().toUpperCase();
  if (s.length > 10) throw new FErr('#NUM!');
  if (!s) return 0;
  const digits = '0123456789ABCDEF'.slice(0, base);
  for (const ch of s) if (!digits.includes(ch)) throw new FErr('#NUM!');
  const n = parseInt(s, base);
  return s.length === 10 && n >= base ** 10 / 2 ? n - base ** 10 : n;
}
function toBase(n: number, base: number, places: Value | undefined): string {
  n = Math.trunc(n);
  const max = BASE_MAX[base];
  if (n < -max || n >= max) throw new FErr('#NUM!');
  if (n < 0) return (base ** 10 + n).toString(base).toUpperCase();
  const s = n.toString(base).toUpperCase();
  if (places === undefined || places === null) return s;
  const p = Math.trunc(toNum(scalar(places)));
  if (p < 1 || p > 10 || s.length > p) throw new FErr('#NUM!');
  return s.padStart(p, '0');
}
const baseFns = () => {
  const out: Record<string, (a: Value[]) => Scalar> = {};
  const names: [string, number][] = [['BIN', 2], ['OCT', 8], ['DEC', 10], ['HEX', 16]];
  for (const [fa, ba] of names) for (const [fb, bb] of names) {
    if (fa === fb) continue;
    out[`${fa}2${fb}`] = (a: Value[]) => {
      need(a, 1, 2);
      const n = ba === 10 ? Math.trunc(toNum(scalar(a[0]))) : fromBase(a[0], ba);
      return bb === 10 ? n : toBase(n, bb, a[1]);
    };
  }
  return out;
};
/** Caracterele „late” (japoneze) ↔ cele obișnuite, pentru ASC și JIS. */
const widen = (s: string, toNarrow: boolean) => Array.from(s, (ch) => {
  const c = ch.charCodeAt(0);
  if (toNarrow) return c === 0x3000 ? ' ' : c >= 0xff01 && c <= 0xff5e ? String.fromCharCode(c - 0xfee0) : ch;
  return c === 0x20 ? String.fromCharCode(0x3000) : c >= 0x21 && c <= 0x7e ? String.fromCharCode(c + 0xfee0) : ch;
}).join('');
const monday = (s: number) => s - (partsOf(s).wd + 6) % 7;

Object.assign(FUNCS, {
  SLN: (a: Value[]) => { need(a, 3); const l = arg(a, 2); if (!l) throw new FErr('#DIV/0!'); return (arg(a, 0) - arg(a, 1)) / l; },
  SYD: (a: Value[]) => {
    need(a, 4);
    const [c, s, l, p] = [arg(a, 0), arg(a, 1), arg(a, 2), arg(a, 3)];
    if (l <= 0 || p <= 0 || p > l || s < 0) throw new FErr('#NUM!');
    return (c - s) * (l - p + 1) * 2 / (l * (l + 1));
  },
  // DB: amortizare cu rată fixă (rotunjită la 3 zecimale), cu prima perioadă parțială dacă luna nu e 12.
  DB: (a: Value[]) => {
    need(a, 4, 5);
    const [c, s, l, p, m] = [arg(a, 0), arg(a, 1), arg(a, 2), Math.trunc(arg(a, 3)), Math.trunc(arg(a, 4, 12))];
    if (c < 0 || s < 0 || l <= 0 || p <= 0 || m < 1 || m > 12 || p > l + (m < 12 ? 1 : 0)) throw new FErr('#NUM!');
    if (c === 0) return 0;
    const rate = Math.round((1 - (s / c) ** (1 / l)) * 1000) / 1000;
    let total = c * rate * m / 12, dep = total;
    for (let i = 2; i <= p; i++) {
      dep = i === l + 1 ? (c - total) * rate * (12 - m) / 12 : (c - total) * rate;
      total += dep;
    }
    return dep;
  },
  DDB: (a: Value[]) => {
    need(a, 4, 5);
    const [c, s, l, p, f] = [arg(a, 0), arg(a, 1), arg(a, 2), arg(a, 3), arg(a, 4, 2)];
    if (c < 0 || s < 0 || l <= 0 || p <= 0 || p > l || f <= 0) throw new FErr('#NUM!');
    return ddbOf(c, s, l, p, f);
  },
  VDB: (a: Value[]) => {
    need(a, 5, 7);
    let c = arg(a, 0);
    const [s, l, st, en, f] = [arg(a, 1), arg(a, 2), arg(a, 3), arg(a, 4), arg(a, 5, 2)];
    const noSwitch = a[6] !== undefined && a[6] !== null && toBool(scalar(a[6]));
    if (c < 0 || s < 0 || l <= 0 || st < 0 || en < st || en > l || f <= 0) throw new FErr('#NUM!');
    const is = Math.floor(st), ie = Math.ceil(en);
    if (noSwitch) {
      let v = 0;
      for (let i = is + 1; i <= ie; i++) {
        let term = ddbOf(c, s, l, i, f);
        if (i === is + 1) term *= Math.min(en, is + 1) - st;
        else if (i === ie) term *= en + 1 - ie;
        v += term;
      }
      return v;
    }
    let part = 0;
    if (st !== is) {
      const rest = c - interVdb(c, s, l, l, is, f);
      part += (st - is) * interVdb(rest, s, l, l - is, 1, f);
    }
    if (en !== ie) {
      const rest = c - interVdb(c, s, l, l, ie - 1, f);
      part += (ie - en) * interVdb(rest, s, l, l - (ie - 1), 1, f);
    }
    c -= interVdb(c, s, l, l, is, f);
    return interVdb(c, s, l, l - is, ie - is, f) - part;
  },
  MIRR: (a: Value[]) => {
    need(a, 3);
    const v = numbers([a[0]]), fr = arg(a, 1), rr = arg(a, 2), n = v.length;
    let pos = 0, neg = 0;
    v.forEach((x, i) => { if (x > 0) pos += x / (1 + rr) ** i; else neg += x / (1 + fr) ** i; });
    if (!pos || !neg || n < 2) throw new FErr('#DIV/0!');
    return finite((-pos * (1 + rr) ** (n - 1) / neg) ** (1 / (n - 1)) - 1);
  },
  XNPV: (a: Value[]) => {
    need(a, 3);
    const r = arg(a, 0), { v, d } = flowsAndDates(a, 1, 2);
    if (r <= -1) throw new FErr('#NUM!');
    return finite(xnpvOf(r, v, d)[0]);
  },
  XIRR: (a: Value[]) => {
    need(a, 2, 3);
    const { v, d } = flowsAndDates(a, 0, 1);
    if (!v.some((x) => x > 0) || !v.some((x) => x < 0)) throw new FErr('#NUM!');
    let r = arg(a, 2, 0.1);
    for (let it = 0; it < 200; it++) {
      const [f, df] = xnpvOf(r, v, d);
      if (!df || !Number.isFinite(df)) break;
      let next = r - f / df;
      if (next <= -1) next = (r - 1) / 2;
      if (Math.abs(next - r) < 1e-12) return next;
      r = next;
    }
    throw new FErr('#NUM!');
  },
  FVSCHEDULE: (a: Value[]) => {
    need(a, 2);
    let p = arg(a, 0);
    for (const x of grid(a[1]).flat()) { if (x instanceof FErr) throw x; p *= 1 + (typeof x === 'number' ? x : 0); }
    return p;
  },
  PDURATION: (a: Value[]) => {
    need(a, 3);
    const [r, pv, fvv] = [arg(a, 0), arg(a, 1), arg(a, 2)];
    if (r <= 0 || pv <= 0 || fvv <= 0) throw new FErr('#NUM!');
    return (Math.log(fvv) - Math.log(pv)) / Math.log(1 + r);
  },
  RRI: (a: Value[]) => {
    need(a, 3);
    const [n, pv, fvv] = [arg(a, 0), arg(a, 1), arg(a, 2)];
    if (n <= 0 || !pv) throw new FErr('#NUM!');
    return finite((fvv / pv) ** (1 / n) - 1);
  },
  ISPMT: (a: Value[]) => {
    need(a, 4);
    const [r, per, n, pv] = [arg(a, 0), arg(a, 1), arg(a, 2), arg(a, 3)];
    if (!n) throw new FErr('#DIV/0!');
    return pv * r * (per / n - 1);
  },
  // Statistică: variantele „A” iau și valorile logice (1/0) și textele din zone (0).
  VARA: (a: Value[]) => { const n = numbersA(a); if (n.length < 2) throw new FErr('#DIV/0!'); return devsq(n) / (n.length - 1); },
  VARPA: (a: Value[]) => { const n = numbersA(a); if (!n.length) throw new FErr('#DIV/0!'); return devsq(n) / n.length; },
  STDEVA: (a: Value[]) => { const n = numbersA(a); if (n.length < 2) throw new FErr('#DIV/0!'); return Math.sqrt(devsq(n) / (n.length - 1)); },
  STDEVPA: (a: Value[]) => { const n = numbersA(a); if (!n.length) throw new FErr('#DIV/0!'); return Math.sqrt(devsq(n) / n.length); },
  'BINOM.INV': (a: Value[]) => {
    need(a, 3);
    const n = count(a, 0), p = prob(a, 1), al = prob(a, 2);
    let s = 0;
    for (let k = 0; k <= n; k++) { s += binomPmf(k, n, p); if (s >= al - 1e-12) return k; }
    return n;
  },
  'BINOM.DIST.RANGE': (a: Value[]) => {
    need(a, 3, 4);
    const n = count(a, 0), p = prob(a, 1), s1 = count(a, 2), s2 = a[3] === undefined || a[3] === null ? s1 : count(a, 3);
    if (s1 > n || s2 > n || s2 < s1) throw new FErr('#NUM!');
    let s = 0;
    for (let k = s1; k <= s2; k++) s += binomPmf(k, n, p);
    return Math.min(1, s);
  },
  SERIESSUM: (a: Value[]) => {
    need(a, 4);
    const [x, n, m] = [arg(a, 0), arg(a, 1), arg(a, 2)];
    return finite(numbers([a[3]]).reduce((s, c, i) => s + c * x ** (n + i * m), 0));
  },
  ROT13: (a: Value[]) => {
    need(a, 1);
    return toStr(scalar(a[0])).replace(/[a-z]/gi, (ch) => {
      const b = ch <= 'Z' ? 65 : 97;
      return String.fromCharCode((ch.charCodeAt(0) - b + 13) % 26 + b);
    });
  },
  ASC: (a: Value[]) => { need(a, 1); return widen(toStr(scalar(a[0])), true); },
  JIS: (a: Value[]) => { need(a, 1); return widen(toStr(scalar(a[0])), false); },
  // Din LibreOffice: diferența în luni / săptămâni / ani (mod 0 = perioade întregi, 1 = după calendar).
  MONTHS: (a: Value[]) => {
    need(a, 3);
    const s = Math.floor(arg(a, 0)), e = Math.floor(arg(a, 1)), p = partsOf(s), q = partsOf(e);
    let d = (q.y - p.y) * 12 + q.m - p.m;
    if (!arg(a, 2)) { if (e > s && q.d < p.d) d--; else if (e < s && q.d > p.d) d++; }
    return d;
  },
  WEEKS: (a: Value[]) => {
    need(a, 3);
    const s = Math.floor(arg(a, 0)), e = Math.floor(arg(a, 1));
    return arg(a, 2) ? (monday(e) - monday(s)) / 7 : Math.trunc((e - s) / 7);
  },
  YEARS: (a: Value[]) => {
    need(a, 3);
    const s = Math.floor(arg(a, 0)), e = Math.floor(arg(a, 1)), p = partsOf(s), q = partsOf(e);
    let d = q.y - p.y;
    if (!arg(a, 2)) {
      const before = q.m < p.m || (q.m === p.m && q.d < p.d), after = q.m > p.m || (q.m === p.m && q.d > p.d);
      if (e > s && before) d--; else if (e < s && after) d++;
    }
    return d;
  },
  CHISQDIST: (a: Value[]) => { need(a, 2, 3); return FUNCS['CHISQ.DIST']([a[0], a[1], a[2] ?? true]); },
  ...baseFns(),
});
// ---------- Obligațiuni și titluri de stat (cupoane, preț, randament, durată), amortizarea franceză, EUROCONVERT ----------

const dateArg = (a: Value[], i: number) => Math.floor(arg(a, i));
const basisArg = (a: Value[], i: number) => { const b = Math.trunc(arg(a, i)); if (b < 0 || b > 4) throw new FErr('#NUM!'); return b; };
const freqArg = (a: Value[], i: number) => { const f = Math.trunc(arg(a, i)); if (f !== 1 && f !== 2 && f !== 4) throw new FErr('#NUM!'); return f; };
/** Zilele dintre două date după convenție: 30/360 (0 și 4) sau zile reale. */
const dayCount = (s: number, e: number, basis: number) => (basis === 0 || basis === 4 ? Math.round(yearFrac(s, e, basis) * 360) * Math.sign(e - s || 1) : e - s);
/** Datele cupoanelor: se numără înapoi de la scadență cu câte 12/frecvență luni (la sfârșit de lună rămân la sfârșit de lună). */
function coupons(settle: number, mat: number, freq: number) {
  if (settle >= mat) throw new FErr('#NUM!');
  const q = partsOf(mat), eom = q.d === daysIn(q.y, q.m), step = 12 / freq;
  const at = (k: number) => {
    const t = q.y * 12 + (q.m - 1) - k * step, y = Math.floor(t / 12), m = t - y * 12 + 1;
    return serialOf(y, m, eom ? daysIn(y, m) : Math.min(q.d, daysIn(y, m)));
  };
  let k = 1;
  while (at(k) > settle) k++;
  return { pcd: at(k), ncd: at(k - 1), n: k };
}
function couponDays(settle: number, mat: number, freq: number, basis: number) {
  const c = coupons(settle, mat, freq);
  const E = basis === 1 ? c.ncd - c.pcd : basis === 3 ? 365 / freq : 360 / freq;
  const A = dayCount(c.pcd, settle, basis);
  const DSC = basis === 0 || basis === 4 ? E - A : c.ncd - settle;
  return { ...c, E, A, DSC };
}
function bondArgs(a: Value[], from: number) {
  const settle = dateArg(a, 0), mat = dateArg(a, 1);
  const freq = freqArg(a, from), basis = basisArg(a, from + 1);
  return { settle, mat, freq, basis };
}
function priceOf(settle: number, mat: number, rate: number, yld: number, red: number, freq: number, basis: number): number {
  const { n, E, A, DSC } = couponDays(settle, mat, freq, basis);
  const cpn = 100 * rate / freq;
  if (n === 1) return (cpn + red) / (yld / freq * DSC / E + 1) - cpn * A / E;
  let p = red / (1 + yld / freq) ** (n - 1 + DSC / E);
  for (let k = 1; k <= n; k++) p += cpn / (1 + yld / freq) ** (k - 1 + DSC / E);
  return p - cpn * A / E;
}
function durationOf(settle: number, mat: number, cpn: number, yld: number, freq: number, basis: number): number {
  const { n, E, DSC } = couponDays(settle, mat, freq, basis);
  const c = cpn * 100 / freq, y = yld / freq + 1;
  let dur = 0, p = 0;
  for (let k = 1; k <= n; k++) {
    const t = k - 1 + DSC / E, cash = k === n ? c + 100 : c;
    dur += t * cash / y ** t;
    p += cash / y ** t;
  }
  return dur / p / freq;
}
/** Prețul unei obligațiuni cu prima perioadă de cupon neregulată (scurtă sau lungă), la 100 valoare nominală.
 *  Perioada de la emitere la primul cupon se împarte în perioade „virtuale” normale (numărate înapoi de la primul cupon);
 *  dobânda primului cupon și dobânda acumulată se adună pe bucăți din ele (formula Excel pentru ODDFPRICE, cazul lung o cuprinde și pe cel scurt). */
function oddFirstPrice(settle: number, mat: number, issue: number, first: number, rate: number, yld: number, red: number, freq: number, basis: number): number {
  const q = partsOf(first), eom = q.d === daysIn(q.y, q.m), step = 12 / freq;
  const at = (k: number) => {
    const t = q.y * 12 + (q.m - 1) - k * step, y = Math.floor(t / 12), m = t - y * 12 + 1;
    return serialOf(y, m, eom ? daysIn(y, m) : Math.min(q.d, daysIn(y, m)));
  };
  const len = (k: number) => (basis === 1 ? at(k - 1) - at(k) : basis === 3 ? 365 / freq : 360 / freq);
  const cpn = 100 * rate / freq, v = 1 + yld / freq;
  let dcSum = 0, aSum = 0, nq = 0, dsc = 0, e = 0;
  for (let k = 1; at(k - 1) > issue && k < 4000; k++) {
    const lo = Math.max(issue, at(k)), hi = at(k - 1), nl = len(k);
    dcSum += dayCount(lo, hi, basis) / nl;
    if (settle > lo) aSum += dayCount(lo, Math.min(settle, hi), basis) / nl;
    if (settle >= at(k) && settle < hi) { nq = k - 1; e = nl; dsc = dayCount(settle, hi, basis); }
  }
  const n = first < mat ? coupons(first, mat, freq).n : 0;
  let p = red / v ** (n + nq + dsc / e) + cpn * dcSum / v ** (nq + dsc / e);
  for (let k = 1; k <= n; k++) p += cpn / v ** (k + nq + dsc / e);
  return p - cpn * aSum;
}
function oddFirstArgs(a: Value[]) {
  const s = dateArg(a, 0), m = dateArg(a, 1), iss = dateArg(a, 2), first = dateArg(a, 3);
  if (!(iss < s && s < first && first <= m)) throw new FErr('#NUM!');
  return { s, m, iss, first };
}
/** Cursurile fixe față de euro (Excel și LibreOffice), cu zecimalele de calcul ale fiecărei monede. */
const EURO: Record<string, [number, number]> = {
  EUR: [1, 2], BEF: [40.3399, 0], LUF: [40.3399, 0], DEM: [1.95583, 2], ESP: [166.386, 0], FRF: [6.55957, 2], IEP: [0.787564, 2],
  ITL: [1936.27, 0], NLG: [2.20371, 2], ATS: [13.7603, 2], PTE: [200.482, 2], FIM: [5.94573, 2], GRD: [340.75, 2], SIT: [239.64, 2],
  MTL: [0.4293, 2], CYP: [0.585274, 2], SKK: [30.126, 2], EEK: [15.6466, 2], LVL: [0.702804, 2], LTL: [3.4528, 2], HRK: [7.5345, 2], BGN: [1.95583, 2],
};

Object.assign(FUNCS, {
  COUPPCD: (a: Value[]) => { need(a, 3, 4); const b = bondArgs(a, 2); return coupons(b.settle, b.mat, b.freq).pcd; },
  COUPNCD: (a: Value[]) => { need(a, 3, 4); const b = bondArgs(a, 2); return coupons(b.settle, b.mat, b.freq).ncd; },
  COUPNUM: (a: Value[]) => { need(a, 3, 4); const b = bondArgs(a, 2); return coupons(b.settle, b.mat, b.freq).n; },
  COUPDAYBS: (a: Value[]) => { need(a, 3, 4); const b = bondArgs(a, 2); return couponDays(b.settle, b.mat, b.freq, b.basis).A; },
  COUPDAYS: (a: Value[]) => { need(a, 3, 4); const b = bondArgs(a, 2); return couponDays(b.settle, b.mat, b.freq, b.basis).E; },
  COUPDAYSNC: (a: Value[]) => { need(a, 3, 4); const b = bondArgs(a, 2); return couponDays(b.settle, b.mat, b.freq, b.basis).DSC; },
  PRICE: (a: Value[]) => {
    need(a, 6, 7);
    const b = bondArgs(a, 5), rate = arg(a, 2), yld = arg(a, 3), red = arg(a, 4);
    if (rate < 0 || yld < 0 || red <= 0) throw new FErr('#NUM!');
    return priceOf(b.settle, b.mat, rate, yld, red, b.freq, b.basis);
  },
  YIELD: (a: Value[]) => {
    need(a, 6, 7);
    const b = bondArgs(a, 5), rate = arg(a, 2), pr = arg(a, 3), red = arg(a, 4);
    if (rate < 0 || pr <= 0 || red <= 0) throw new FErr('#NUM!');
    const { n, E, A, DSC } = couponDays(b.settle, b.mat, b.freq, b.basis);
    if (n === 1) {
      const k = pr / 100 + A / E * rate / b.freq;
      return (red / 100 + rate / b.freq - k) / k * b.freq * E / DSC;
    }
    let y = rate || 0.05;
    for (let it = 0; it < 100; it++) {
      const f = priceOf(b.settle, b.mat, rate, y, red, b.freq, b.basis) - pr;
      const h = 1e-7, d = (priceOf(b.settle, b.mat, rate, y + h, red, b.freq, b.basis) - f - pr) / h;
      if (!d) break;
      const next = y - f / d;
      if (Math.abs(next - y) < 1e-12) return next;
      y = next;
    }
    throw new FErr('#NUM!');
  },
  DURATION: (a: Value[]) => {
    need(a, 5, 6);
    const b = bondArgs(a, 4), c = arg(a, 2), y = arg(a, 3);
    if (c < 0 || y < 0) throw new FErr('#NUM!');
    return durationOf(b.settle, b.mat, c, y, b.freq, b.basis);
  },
  MDURATION: (a: Value[]) => {
    need(a, 5, 6);
    const b = bondArgs(a, 4), c = arg(a, 2), y = arg(a, 3);
    if (c < 0 || y < 0) throw new FErr('#NUM!');
    return durationOf(b.settle, b.mat, c, y, b.freq, b.basis) / (1 + y / b.freq);
  },
  // Dobânda acumulată: de la emitere până la decontare (ACCRINT cu calcul de la emitere, ACCRINTM la scadență).
  ACCRINT: (a: Value[]) => {
    need(a, 6, 8);
    const issue = dateArg(a, 0), settle = dateArg(a, 2), rate = arg(a, 3), par = arg(a, 4, 1000);
    freqArg(a, 5);
    const basis = basisArg(a, 6);
    if (rate <= 0 || par <= 0 || issue >= settle) throw new FErr('#NUM!');
    return par * rate * yearFrac(issue, settle, basis);
  },
  ACCRINTM: (a: Value[]) => {
    need(a, 3, 5);
    const issue = dateArg(a, 0), settle = dateArg(a, 1), rate = arg(a, 2), par = arg(a, 3, 1000), basis = basisArg(a, 4);
    if (rate <= 0 || par <= 0 || issue >= settle) throw new FErr('#NUM!');
    return par * rate * yearFrac(issue, settle, basis);
  },
  DISC: (a: Value[]) => {
    need(a, 4, 5);
    const s = dateArg(a, 0), m = dateArg(a, 1), pr = arg(a, 2), red = arg(a, 3), basis = basisArg(a, 4);
    if (s >= m || pr <= 0 || red <= 0) throw new FErr('#NUM!');
    return (red - pr) / red / yearFrac(s, m, basis);
  },
  INTRATE: (a: Value[]) => {
    need(a, 4, 5);
    const s = dateArg(a, 0), m = dateArg(a, 1), inv = arg(a, 2), red = arg(a, 3), basis = basisArg(a, 4);
    if (s >= m || inv <= 0 || red <= 0) throw new FErr('#NUM!');
    return (red - inv) / inv / yearFrac(s, m, basis);
  },
  RECEIVED: (a: Value[]) => {
    need(a, 4, 5);
    const s = dateArg(a, 0), m = dateArg(a, 1), inv = arg(a, 2), d = arg(a, 3), basis = basisArg(a, 4);
    if (s >= m || inv <= 0 || d <= 0) throw new FErr('#NUM!');
    return finite(inv / (1 - d * yearFrac(s, m, basis)));
  },
  PRICEDISC: (a: Value[]) => {
    need(a, 4, 5);
    const s = dateArg(a, 0), m = dateArg(a, 1), d = arg(a, 2), red = arg(a, 3), basis = basisArg(a, 4);
    if (s >= m || d <= 0 || red <= 0) throw new FErr('#NUM!');
    return red * (1 - d * yearFrac(s, m, basis));
  },
  YIELDDISC: (a: Value[]) => {
    need(a, 4, 5);
    const s = dateArg(a, 0), m = dateArg(a, 1), pr = arg(a, 2), red = arg(a, 3), basis = basisArg(a, 4);
    if (s >= m || pr <= 0 || red <= 0) throw new FErr('#NUM!');
    return (red - pr) / pr / yearFrac(s, m, basis);
  },
  PRICEMAT: (a: Value[]) => {
    need(a, 5, 6);
    const s = dateArg(a, 0), m = dateArg(a, 1), iss = dateArg(a, 2), rate = arg(a, 3), y = arg(a, 4), basis = basisArg(a, 5);
    if (s >= m || rate < 0 || y < 0) throw new FErr('#NUM!');
    return (100 + yearFrac(iss, m, basis) * rate * 100) / (1 + yearFrac(s, m, basis) * y) - yearFrac(iss, s, basis) * rate * 100;
  },
  YIELDMAT: (a: Value[]) => {
    need(a, 5, 6);
    const s = dateArg(a, 0), m = dateArg(a, 1), iss = dateArg(a, 2), rate = arg(a, 3), pr = arg(a, 4), basis = basisArg(a, 5);
    if (s >= m || rate < 0 || pr <= 0) throw new FErr('#NUM!');
    return ((1 + yearFrac(iss, m, basis) * rate) / (pr / 100 + yearFrac(iss, s, basis) * rate) - 1) / yearFrac(s, m, basis);
  },
  // Titluri de stat (T-bills): zile reale, an de 360 de zile, cel mult un an.
  TBILLPRICE: (a: Value[]) => {
    need(a, 3);
    const dsm = dateArg(a, 1) - dateArg(a, 0), d = arg(a, 2);
    if (dsm <= 0 || dsm > 366 || d <= 0) throw new FErr('#NUM!');
    return 100 * (1 - d * dsm / 360);
  },
  TBILLYIELD: (a: Value[]) => {
    need(a, 3);
    const dsm = dateArg(a, 1) - dateArg(a, 0), pr = arg(a, 2);
    if (dsm <= 0 || dsm > 366 || pr <= 0) throw new FErr('#NUM!');
    return (100 - pr) / pr * 360 / dsm;
  },
  TBILLEQ: (a: Value[]) => {
    need(a, 3);
    const dsm = dateArg(a, 1) - dateArg(a, 0), d = arg(a, 2);
    if (dsm <= 0 || dsm > 366 || d <= 0) throw new FErr('#NUM!');
    if (dsm <= 182) return 365 * d / (360 - d * dsm);
    const price = 100 * (1 - d * dsm / 360), t = dsm / 365;
    return (-2 * t + 2 * Math.sqrt(t * t - (2 * t - 1) * (1 - 100 / price))) / (2 * t - 1);
  },
  // Ultima perioadă de cupon e neregulată (ODDLPRICE, ODDLYIELD).
  ODDLPRICE: (a: Value[]) => {
    need(a, 7, 8);
    const s = dateArg(a, 0), m = dateArg(a, 1), last = dateArg(a, 2), rate = arg(a, 3), y = arg(a, 4), red = arg(a, 5);
    const f = freqArg(a, 6), basis = basisArg(a, 7);
    if (!(last < s && s < m) || rate < 0 || y < 0 || red <= 0) throw new FErr('#NUM!');
    const dc = yearFrac(last, m, basis) * f, dsc = yearFrac(s, m, basis) * f, ai = yearFrac(last, s, basis) * f;
    return (red + dc * 100 * rate / f) / (dsc * y / f + 1) - ai * 100 * rate / f;
  },
  ODDLYIELD: (a: Value[]) => {
    need(a, 7, 8);
    const s = dateArg(a, 0), m = dateArg(a, 1), last = dateArg(a, 2), rate = arg(a, 3), pr = arg(a, 4), red = arg(a, 5);
    const f = freqArg(a, 6), basis = basisArg(a, 7);
    if (!(last < s && s < m) || rate < 0 || pr <= 0 || red <= 0) throw new FErr('#NUM!');
    const dc = yearFrac(last, m, basis) * f, dsc = yearFrac(s, m, basis) * f, ai = yearFrac(last, s, basis) * f;
    return ((red + dc * 100 * rate / f) / (pr + ai * 100 * rate / f) - 1) * f / dsc;
  },
  // Prima perioadă de cupon e neregulată (ODDFPRICE, ODDFYIELD): scurtă sau lungă.
  ODDFPRICE: (a: Value[]) => {
    need(a, 8, 9);
    const d = oddFirstArgs(a), rate = arg(a, 4), y = arg(a, 5), red = arg(a, 6), f = freqArg(a, 7), basis = basisArg(a, 8);
    if (rate < 0 || y < 0 || red <= 0) throw new FErr('#NUM!');
    return finite(oddFirstPrice(d.s, d.m, d.iss, d.first, rate, y, red, f, basis));
  },
  ODDFYIELD: (a: Value[]) => {
    need(a, 8, 9);
    const d = oddFirstArgs(a), rate = arg(a, 4), pr = arg(a, 5), red = arg(a, 6), f = freqArg(a, 7), basis = basisArg(a, 8);
    if (rate < 0 || pr <= 0 || red <= 0) throw new FErr('#NUM!');
    const at = (y: number) => oddFirstPrice(d.s, d.m, d.iss, d.first, rate, y, red, f, basis) - pr;
    let y = rate || 0.05;
    for (let it = 0; it < 100; it++) {
      const fy = at(y), h = 1e-7, dy = (at(y + h) - fy) / h;
      if (!dy || !Number.isFinite(dy)) break;
      let next = y - fy / dy;
      if (next <= -f) next = (y - f) / 2;
      if (Math.abs(next - y) < 1e-12) return next;
      y = next;
    }
    throw new FErr('#NUM!');
  },
  // Amortizarea franceză (pe perioade contabile), ca în Excel.
  AMORLINC: (a: Value[]) => {
    need(a, 6, 7);
    const cost = arg(a, 0), buy = dateArg(a, 1), first = dateArg(a, 2), salv = arg(a, 3), per = Math.trunc(arg(a, 4)), rate = arg(a, 5);
    const basis = basisArg(a, 6);
    if (cost < 0 || salv < 0 || salv > cost || per < 0 || rate <= 0 || basis === 2) throw new FErr('#NUM!');
    const one = cost * rate, f0 = yearFrac(buy, first, basis) * rate * cost;
    const full = Math.trunc((cost - salv - f0) / one);
    if (per === 0) return f0;
    if (per <= full) return one;
    if (per === full + 1) return cost - salv - one * full - f0;
    return 0;
  },
  AMORDEGRC: (a: Value[]) => {
    need(a, 6, 7);
    let cost = arg(a, 0);
    const buy = dateArg(a, 1), first = dateArg(a, 2), salv = arg(a, 3), per = Math.trunc(arg(a, 4));
    let rate = arg(a, 5);
    const basis = basisArg(a, 6);
    if (cost < 0 || salv < 0 || salv > cost || per < 0 || rate <= 0 || basis === 2) throw new FErr('#NUM!');
    const life = 1 / rate;
    rate *= life < 3 ? 1 : life < 5 ? 1.5 : life <= 6 ? 2 : 2.5;
    let dep = Math.round(yearFrac(buy, first, basis) * rate * cost);
    cost -= dep;
    let rest = cost - salv;
    for (let n = 0; n < per; n++) {
      dep = Math.round(rate * cost);
      rest -= dep;
      if (rest < 0) return per - n <= 1 ? Math.round(cost * 0.5) : 0;
      cost -= dep;
    }
    return dep;
  },
  // EUROCONVERT(sumă; din; în; [precizie completă]; [zecimale la triangulare]): monedele înlocuite de euro, cu cursurile fixe.
  EUROCONVERT: (a: Value[]) => {
    need(a, 3, 5);
    const x = arg(a, 0), from = EURO[toStr(scalar(a[1])).toUpperCase()], to = EURO[toStr(scalar(a[2])).toUpperCase()];
    if (!from || !to) throw new FErr('#VALUE!');
    const full = a[3] !== undefined && a[3] !== null && toBool(scalar(a[3]));
    let eur = x / from[0];
    if (a[4] !== undefined && a[4] !== null) {
      const tp = Math.trunc(arg(a, 4));
      if (tp < 3) throw new FErr('#VALUE!');
      if (from[0] !== 1 && to[0] !== 1) eur = roundTo(eur, tp, 'near');
    }
    const r = eur * to[0];
    return full ? r : roundTo(r, to[1], 'near');
  },
});
// ---------- Numere complexe (ca text: „3+4i” sau „3+4j”), ca în Excel ----------

type Cx = { re: number; im: number; sfx: string };
/** „3+4i”, „-2,5j”, „i”, „7” → partea reală și cea imaginară. */
function parseCx(v: Value): Cx {
  const x = scalar(v);
  if (x instanceof FErr) throw x;
  if (typeof x === 'number') return { re: x, im: 0, sfx: 'i' };
  if (typeof x === 'boolean') throw new FErr('#VALUE!');
  const s = (x ?? '').trim().replace(/,/g, '.');
  if (!s) return { re: 0, im: 0, sfx: 'i' };
  const NUM = '(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?';
  let m = new RegExp(`^[+-]?${NUM}$`).exec(s);
  if (m) return { re: Number(s), im: 0, sfx: 'i' };
  const imag = (sign: string, n: string | undefined) => (sign === '-' ? -1 : 1) * (n ? Number(n) : 1);
  if ((m = new RegExp(`^([+-]?)(${NUM})?([ij])$`).exec(s))) return { re: 0, im: imag(m[1], m[2]), sfx: m[3] };
  if ((m = new RegExp(`^([+-]?${NUM})([+-])(${NUM})?([ij])$`).exec(s))) return { re: Number(m[1]), im: imag(m[2], m[3]), sfx: m[4] };
  throw new FErr('#NUM!');
}
// Ca Excel: 15 cifre semnificative (formatNumber s-ar opri la 10 zecimale).
const cxNum = (n: number) => String(Number(n.toPrecision(15))).replace('.', ',');
function cxText(z: Cx): string {
  const re = Math.abs(z.re) < 1e-15 ? 0 : z.re, im = Math.abs(z.im) < 1e-15 ? 0 : z.im;
  if (!im) return cxNum(re);
  const imTxt = im === 1 ? '' : im === -1 ? '-' : cxNum(im);
  if (!re) return imTxt + z.sfx;
  return cxNum(re) + (im > 0 ? '+' : '') + imTxt + z.sfx;
}
/** Pentru Analiza Fourier: un număr complex scris ca text („3+4i”) sau număr → partea reală și cea imaginară (null dacă nu e). */
export function complexOf(v: string | number): { re: number; im: number } | null {
  try { const z = parseCx(v); return { re: z.re, im: z.im }; } catch { return null; }
}
/** Numărul complex ca text, ca IMSUM / COMPLEX („3+4i”, „-2i”, „7”). */
export const complexText = (re: number, im: number) => cxText({ re, im, sfx: 'i' });
const cxArgs = (a: Value[]) => {
  const out: Cx[] = [];
  for (const v of a) for (const x of grid(v).flat()) if (x !== null && x !== '') out.push(parseCx(x));
  return out;
};
const cxMul = (p: Cx, q: Cx): Cx => ({ re: p.re * q.re - p.im * q.im, im: p.re * q.im + p.im * q.re, sfx: p.sfx });
const cxAbs = (z: Cx) => Math.hypot(z.re, z.im);
const cxArg = (z: Cx) => { if (!z.re && !z.im) throw new FErr('#DIV/0!'); return Math.atan2(z.im, z.re); };
const cxPolar = (r: number, t: number, sfx: string): Cx => ({ re: r * Math.cos(t), im: r * Math.sin(t), sfx });
const cx1 = (f: (z: Cx) => Cx | number) => (a: Value[]) => { need(a, 1); const r = f(parseCx(a[0])); return typeof r === 'number' ? r : cxText(r); };

function extremeIfs(a: Value[], pick: (...xs: number[]) => number): number {
  if (a.length < 3) throw new FErr('#N/A');
  const ok = multiMatch(a.slice(1));
  const g = grid(a[0]);
  const xs: number[] = [];
  ok.forEach((row, i) => row.forEach((y, j) => { const x = g[i]?.[j]; if (y && typeof x === 'number') xs.push(x); }));
  return xs.length ? pick(...xs) : 0;
}

function textAround(a: Value[], before: boolean): Scalar {
  need(a, 2, 6);
  const text = toStr(scalar(a[0]));
  const delim = toStr(scalar(a[1]));
  const n = Math.trunc(arg(a, 2, 1));
  const ci = arg(a, 3, 0) === 1;
  if (n === 0 || Math.abs(n) > text.length + 1) throw new FErr('#VALUE!');
  const hay = ci ? text.toLowerCase() : text;
  const d = ci ? delim.toLowerCase() : delim;
  const pos: number[] = [];
  if (d === '') pos.push(n > 0 ? 0 : text.length);
  else for (let i = hay.indexOf(d); i >= 0; i = hay.indexOf(d, i + d.length)) pos.push(i);
  const at = n > 0 ? pos[n - 1] : pos[pos.length + n];
  if (at === undefined) { if (a.length > 5 && a[5] !== null) return scalar(a[5]); throw new FErr('#N/A'); }
  return before ? text.slice(0, at) : text.slice(at + d.length);
}


function squareOf(v: Value): number[][] {
  const g = grid(v);
  if (!g.length || g.some((r) => r.length !== g.length)) throw new FErr('#VALUE!');
  return g.map((r) => r.map((x) => { if (typeof x !== 'number') throw new FErr('#VALUE!'); return x; }));
}

function det(m: number[][]): number {
  const a = m.map((r) => [...r]);
  const n = a.length;
  let d = 1;
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(a[i][k]) > Math.abs(a[p][k])) p = i;
    if (a[p][k] === 0) return 0;
    if (p !== k) { [a[p], a[k]] = [a[k], a[p]]; d = -d; }
    d *= a[k][k];
    for (let i = k + 1; i < n; i++) { const f = a[i][k] / a[k][k]; for (let j = k; j < n; j++) a[i][j] -= f * a[k][j]; }
  }
  return d;
}

Object.assign(FUNCS, {
  // MAXIFS / MINIFS(zonă_valori; zonă1; criteriu1; …): cel mai mare / mic număr care îndeplinește criteriile (0 dacă niciunul).
  MAXIFS: (a: Value[]) => extremeIfs(a, Math.max),
  MINIFS: (a: Value[]) => extremeIfs(a, Math.min),
  // TEXTBEFORE / TEXTAFTER(text; separator; [a_câta]; [fără_litere_mari]; [la_capăt]; [dacă_lipsește]).
  TEXTBEFORE: (a: Value[]) => textAround(a, true),
  TEXTAFTER: (a: Value[]) => textAround(a, false),
  DELTA: (a: Value[]) => { need(a, 1, 2); return toNum(scalar(a[0])) === arg(a, 1) ? 1 : 0; },
  GESTEP: (a: Value[]) => { need(a, 1, 2); return toNum(scalar(a[0])) >= arg(a, 1) ? 1 : 0; },
  // ERF(de_la; [până_la]), ERFC: funcția de eroare (din repartiția normală).
  ERF: (a: Value[]) => { need(a, 1, 2); const lo = erf(toNum(scalar(a[0]))); return a.length > 1 && a[1] !== null ? erf(toNum(scalar(a[1]))) - lo : lo; },
  'ERF.PRECISE': (a: Value[]) => { need(a, 1); return erf(toNum(scalar(a[0]))); },
  ERFC: (a: Value[]) => { need(a, 1); return 1 - erf(toNum(scalar(a[0]))); },
  'ERFC.PRECISE': (a: Value[]) => { need(a, 1); return 1 - erf(toNum(scalar(a[0]))); },
  // MDETERM(matrice): determinantul unei matrice pătrate.
  MDETERM: (a: Value[]) => { need(a, 1); return det(squareOf(a[0])); },
  // RANDBETWEEN(de_la; până_la): un întreg la întâmplare (se schimbă la fiecare recalculare, ca în Excel).
  RANDBETWEEN: (a: Value[]) => {
    need(a, 2);
    const lo = Math.ceil(toNum(scalar(a[0]))), hi = Math.floor(toNum(scalar(a[1])));
    if (hi < lo) throw new FErr('#NUM!');
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  },
  // SWITCH(valoare; caz1; rezultat1; …; [altfel]).
  SWITCH: (a: Value[]) => {
    if (a.length < 3) throw new FErr('#N/A');
    const v = scalar(a[0]);
    for (let i = 1; i + 1 < a.length; i += 2) if (compareVals('=', v, scalar(a[i]))) return scalar(a[i + 1]);
    if (a.length % 2 === 0) return scalar(a[a.length - 1]);
    throw new FErr('#N/A');
  },
});

Object.assign(FUNCS, {
  COMPLEX: (a: Value[]) => {
    need(a, 2, 3);
    const sfx = a[2] === undefined || a[2] === null ? 'i' : toStr(scalar(a[2])) || 'i';
    if (sfx !== 'i' && sfx !== 'j') throw new FErr('#VALUE!');
    return cxText({ re: arg(a, 0), im: arg(a, 1), sfx });
  },
  IMREAL: cx1((z) => z.re),
  IMAGINARY: cx1((z) => z.im),
  IMABS: cx1(cxAbs),
  IMARGUMENT: cx1(cxArg),
  IMCONJUGATE: cx1((z) => ({ ...z, im: -z.im })),
  IMSUM: (a: Value[]) => { const z = cxArgs(a); if (!z.length) throw new FErr('#VALUE!'); return cxText(z.reduce((p, q) => ({ re: p.re + q.re, im: p.im + q.im, sfx: p.sfx }))); },
  IMSUB: (a: Value[]) => { need(a, 2); const p = parseCx(a[0]), q = parseCx(a[1]); return cxText({ re: p.re - q.re, im: p.im - q.im, sfx: p.sfx }); },
  IMPRODUCT: (a: Value[]) => { const z = cxArgs(a); if (!z.length) throw new FErr('#VALUE!'); return cxText(z.reduce(cxMul)); },
  IMDIV: (a: Value[]) => {
    need(a, 2);
    const p = parseCx(a[0]), q = parseCx(a[1]), d = q.re * q.re + q.im * q.im;
    if (!d) throw new FErr('#NUM!');
    return cxText({ re: (p.re * q.re + p.im * q.im) / d, im: (p.im * q.re - p.re * q.im) / d, sfx: p.sfx });
  },
  IMPOWER: (a: Value[]) => {
    need(a, 2);
    const z = parseCx(a[0]), n = arg(a, 1), r = cxAbs(z);
    if (!r) { if (n <= 0) throw new FErr('#NUM!'); return '0'; }
    return cxText(cxPolar(r ** n, Math.atan2(z.im, z.re) * n, z.sfx));
  },
  IMSQRT: cx1((z) => cxPolar(Math.sqrt(cxAbs(z)), Math.atan2(z.im, z.re) / 2, z.sfx)),
  IMEXP: cx1((z) => cxPolar(Math.exp(z.re), z.im, z.sfx)),
  IMLN: cx1((z) => { const r = cxAbs(z); if (!r) throw new FErr('#NUM!'); return { re: Math.log(r), im: Math.atan2(z.im, z.re), sfx: z.sfx }; }),
  IMLOG10: cx1((z) => { const r = cxAbs(z); if (!r) throw new FErr('#NUM!'); return { re: Math.log10(r), im: Math.atan2(z.im, z.re) / Math.LN10, sfx: z.sfx }; }),
  IMLOG2: cx1((z) => { const r = cxAbs(z); if (!r) throw new FErr('#NUM!'); return { re: Math.log2(r), im: Math.atan2(z.im, z.re) / Math.LN2, sfx: z.sfx }; }),
  IMSIN: cx1((z) => ({ re: Math.sin(z.re) * Math.cosh(z.im), im: Math.cos(z.re) * Math.sinh(z.im), sfx: z.sfx })),
  IMCOS: cx1((z) => ({ re: Math.cos(z.re) * Math.cosh(z.im), im: -Math.sin(z.re) * Math.sinh(z.im), sfx: z.sfx })),
  // Funcțiile trigonometrice și hiperbolice complexe care lipseau (ca în Excel 2013): din sin, cos, sinh, cosh.
  IMSINH: cx1(cxSinh),
  IMCOSH: cx1(cxCosh),
  IMTAN: cx1((z) => cxQuot(cxSin(z), cxCos(z))),
  IMCOT: cx1((z) => cxQuot(cxCos(z), cxSin(z))),
  IMSEC: cx1((z) => cxQuot({ re: 1, im: 0, sfx: z.sfx }, cxCos(z))),
  IMCSC: cx1((z) => cxQuot({ re: 1, im: 0, sfx: z.sfx }, cxSin(z))),
  IMSECH: cx1((z) => cxQuot({ re: 1, im: 0, sfx: z.sfx }, cxCosh(z))),
  IMCSCH: cx1((z) => cxQuot({ re: 1, im: 0, sfx: z.sfx }, cxSinh(z))),
  // RAND(): un număr la întâmplare între 0 și 1 (se schimbă la fiecare recalculare).
  RAND: (a: Value[]) => { need(a, 0); return Math.random(); },
  // PERCENTOF(parte; tot): cât la sută din total e partea (ca fracție; 0,25 = 25%).
  PERCENTOF: (a: Value[]) => {
    need(a, 2);
    const part = numbers([a[0]]).reduce((s, x) => s + x, 0), all = numbers([a[1]]).reduce((s, x) => s + x, 0);
    if (!all) throw new FErr('#DIV/0!');
    return part / all;
  },
  // VALUETOTEXT(valoare; [strict]): valoarea ca text; strict (1) pune textele între ghilimele.
  VALUETOTEXT: (a: Value[]) => {
    need(a, 1, 2);
    const v = scalar(a[0]), strict = a.length > 1 && a[1] !== null && toNum(scalar(a[1])) === 1;
    return strict && typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : toStr(v);
  },
  // ARRAYTOTEXT(zonă; [strict]): zona ca text: 0 = „1, 2, a”; 1 = ca o constantă matrice, {1;2|"a";"b"} (textele între ghilimele).
  ARRAYTOTEXT: (a: Value[]) => {
    need(a, 1, 2);
    const strict = a.length > 1 && a[1] !== null && toNum(scalar(a[1])) === 1;
    if (a.length > 1 && a[1] !== null && ![0, 1].includes(toNum(scalar(a[1])))) throw new FErr('#VALUE!');
    const one = (x: Scalar) => (x instanceof FErr ? x.code : strict && typeof x === 'string' ? `"${x.replace(/"/g, '""')}"` : toStr(x));
    const g = Array.isArray(a[0]) ? a[0] : [[a[0] as Scalar]];
    return strict ? '{' + g.map((r) => r.map(one).join(';')).join('|') + '}' : g.flat().map(one).join(', ');
  },
  // REGEXTEST(text; tipar; [fără_litere_mari]): se potrivește textul cu tiparul (expresie regulată)?
  REGEXTEST: (a: Value[]) => { need(a, 2, 3); return regexArg(a, 1, 2).test(toStr(scalar(a[0]))); },
  // REGEXEXTRACT(text; tipar; [mod]; [fără_litere_mari]): 0 = prima potrivire, 1 = toate (în coloană), 2 = grupurile din prima.
  REGEXEXTRACT: (a: Value[]) => {
    need(a, 2, 4);
    const text = toStr(scalar(a[0]));
    const mode = a.length > 2 && a[2] !== null ? toNum(scalar(a[2])) : 0;
    if (mode !== 0 && mode !== 1 && mode !== 2) throw new FErr('#VALUE!');
    const re = regexArg(a, 1, 3, mode === 1);
    if (mode === 1) {
      const all = [...text.matchAll(re)].map((m) => [m[0]]);
      if (!all.length) throw new FErr('#N/A');
      return all;
    }
    const m = re.exec(text);
    if (!m) throw new FErr('#N/A');
    if (mode === 0) return m[0];
    const groups = m.slice(1).map((g) => g ?? '');
    return groups.length ? [groups] : m[0];
  },
  // REGEXREPLACE(text; tipar; înlocuire; [a_câta]; [fără_litere_mari]): înlocuiește potrivirile ($1, $2 = grupurile); 0 = toate.
  REGEXREPLACE: (a: Value[]) => {
    need(a, 3, 5);
    const text = toStr(scalar(a[0])), by = toStr(scalar(a[2]));
    const nth = a.length > 3 && a[3] !== null ? Math.trunc(toNum(scalar(a[3]))) : 0;
    const re = regexArg(a, 1, 4, true);
    if (!nth) return text.replace(re, by);
    const all = [...text.matchAll(re)];
    const m = all[nth > 0 ? nth - 1 : all.length + nth];
    if (!m || m.index === undefined) return text;
    return text.slice(0, m.index) + m[0].replace(new RegExp(re.source, re.flags.replace('g', '')), by) + text.slice(m.index + m[0].length);
  },
});

/**
 * Potrivirea pentru TREND / GROWTH / LINEST / LOGEST: y ≈ b0 + b1·x1 + … (pe ln y la GROWTH / LOGEST), prin cele mai mici pătrate.
 * Dacă y e o coloană, fiecare coloană din x e o variabilă și fiecare rând o observație; dacă y e un rând, invers.
 * `ci` = poziția argumentului „cu constantă” (3 la TREND, 2 la LINEST).
 */
function fitModel(a: Value[], log: boolean, ci: number) {
  const Y = numGrid(a[0]);
  const byRow = Y.length === 1 && (Y[0]?.length ?? 0) > 1;
  const ys = Y.flat(), n = ys.length;
  if (!n) throw new FErr('#VALUE!');
  if (log && ys.some((y) => y <= 0)) throw new FErr('#NUM!');
  const yv = log ? ys.map(Math.log) : ys;
  // Observațiile (câte un vector de variabile) dintr-un tabel de x.
  // `list`: un singur rând de x lângă o coloană de y (cu tot atâtea valori) e o singură variabilă.
  const obsOf = (g: number[][], list = false): number[][] => {
    if (byRow) return (g[0] ?? []).map((_, c) => g.map((r) => r[c]));
    if (list && g.length === 1 && g[0].length === n && n > 1) return g[0].map((x) => [x]);
    return g;
  };
  const xg = given(a[1]) ? numGrid(a[1]) : null;
  const X = xg ? obsOf(xg, true) : ys.map((_, i) => [i + 1]);
  if (X.length !== n) throw new FErr('#REF!');
  const k = X[0]?.length ?? 0;
  const withConst = a.length <= ci || a[ci] === null || toBool(scalar(a[ci]));
  const rows = X.map((x) => (withConst ? [1, ...x] : x));
  const m = rows[0].length;
  // Ecuațiile normale (XᵀX) b = Xᵀy, rezolvate prin Gauss–Jordan cu pivot; alături se obține și (XᵀX)⁻¹ (pentru erorile standard).
  const A = Array.from({ length: m }, (_, i) => [
    ...Array.from({ length: m }, (_, j) => rows.reduce((s, r) => s + r[i] * r[j], 0)),
    rows.reduce((s, r, q) => s + r[i] * yv[q], 0),
    ...Array.from({ length: m }, (_, j) => (i === j ? 1 : 0)),
  ]);
  for (let c = 0; c < m; c++) {
    let best = c;
    for (let r = c + 1; r < m; r++) if (Math.abs(A[r][c]) > Math.abs(A[best][c])) best = r;
    if (Math.abs(A[best][c]) < 1e-12) throw new FErr('#NUM!');
    [A[c], A[best]] = [A[best], A[c]];
    const d = A[c][c];
    for (let j = c; j <= 2 * m; j++) A[c][j] /= d;
    for (let r = 0; r < m; r++) {
      if (r === c) continue;
      const f = A[r][c];
      if (f) for (let j = c; j <= 2 * m; j++) A[r][j] -= f * A[c][j];
    }
  }
  const b = A.map((r) => r[m]);
  const inv = A.map((r) => r.slice(m + 1));
  return { byRow, n, yv, X, k, withConst, rows, m, b, inv, obsOf };
}
const given = (v: Value | undefined) => v !== undefined && v !== null && !(Array.isArray(v) && !v.length);

/** TREND / GROWTH: valorile potrivite pentru x-urile cunoscute sau prognoza pentru cele noi. */
function fitPredict(a: Value[], log: boolean): Scalar[][] {
  need(a, 1, 4);
  const { byRow, X, k, withConst, b, obsOf } = fitModel(a, log, 3);
  const predict = (x: number[]) => {
    if (x.length !== k) throw new FErr('#REF!');
    const v = (withConst ? b[0] : 0) + x.reduce((s, xi, i) => s + xi * b[i + (withConst ? 1 : 0)], 0);
    return log ? Math.exp(v) : v;
  };
  if (!given(a[2])) {
    const out = X.map(predict);
    return byRow ? [out] : out.map((v) => [v]);
  }
  const ng = numGrid(a[2]);
  // O singură variabilă: rezultatul are forma x-urilor noi; mai multe: câte unul pe observație.
  if (k === 1) return ng.map((r) => r.map((x) => predict([x])));
  const out = obsOf(ng).map(predict);
  return byRow ? [out] : out.map((v) => [v]);
}

/**
 * LINEST / LOGEST(y; [x]; [cu_constantă]; [statistici]): coeficienții, în ordinea mk … m1, b (la LOGEST e^coeficient).
 * Cu statistici: rândurile 2–5 au erorile standard, R² și eroarea lui y, F și gradele de libertate, sumele de pătrate.
 */
function linest(a: Value[], log: boolean): Scalar[][] {
  need(a, 1, 4);
  const { n, yv, k, withConst, rows, m, b, inv } = fitModel(a, log, 2);
  const coef = (i: number) => (log ? Math.exp(b[i]) : b[i]);
  // Ordinea din rezultat: ultima variabilă prima, constanta la sfârșit.
  const slopes = Array.from({ length: k }, (_, j) => k - 1 - j + (withConst ? 1 : 0));
  const first: Scalar[] = [...slopes.map(coef), withConst ? coef(0) : log ? 1 : 0];
  const stats = a.length > 3 && a[3] !== null && toBool(scalar(a[3]));
  if (!stats) return [first];
  const fit = rows.map((r) => r.reduce((s, x, i) => s + x * b[i], 0));
  const ssResid = yv.reduce((s, y, q) => s + (y - fit[q]) ** 2, 0);
  const mean = withConst ? yv.reduce((s, y) => s + y, 0) / n : 0;
  const ssTot = yv.reduce((s, y) => s + (y - mean) ** 2, 0);
  const ssReg = ssTot - ssResid;
  const df = n - m;
  const na = () => new FErr('#N/A');
  const sey2 = df > 0 ? ssResid / df : NaN;
  const se = (i: number): Scalar => (df > 0 ? Math.sqrt(Math.max(0, sey2 * inv[i][i])) : new FErr('#NUM!'));
  const pad = (r: Scalar[]) => [...r, ...Array.from({ length: k + 1 - r.length }, na)];
  return [
    first,
    [...slopes.map(se), withConst ? se(0) : na()],
    pad([ssTot ? ssReg / ssTot : 1, df > 0 ? Math.sqrt(sey2) : new FErr('#NUM!')]),
    pad([df > 0 && ssResid ? (ssReg / k) / (ssResid / df) : new FErr('#NUM!'), df]),
    pad([ssReg, ssResid]),
  ];
}

/** WRAPROWS / WRAPCOLS: lista (un singur rând sau o singură coloană) tăiată în bucăți de câte `n`, completate cu umplerea. */
function wrapList(a: Value[], cols: boolean): Scalar[][] {
  need(a, 2, 3);
  const g = grid(a[0]);
  if (g.length > 1 && (g[0]?.length ?? 0) > 1) throw new FErr('#VALUE!');
  const list = g.flat();
  const n = Math.trunc(toNum(scalar(a[1])));
  if (n < 1) throw new FErr('#NUM!');
  const fill: Scalar = a.length > 2 && a[2] !== null ? scalar(a[2]) : new FErr('#N/A');
  const out: Scalar[][] = [];
  for (let i = 0; i < list.length; i += n) out.push(Array.from({ length: n }, (_, k) => (i + k < list.length ? list[i + k] : fill)));
  return cols ? transpose(out) : out;
}

/** Tiparul (expresie regulată) din argumentul `i`; argumentul `ci` = 1 îl face să nu țină cont de literele mari. Tipar greșit → #VALUE!. */
function regexArg(a: Value[], i: number, ci: number, global = false): RegExp {
  const flags = (global ? 'g' : '') + (a.length > ci && a[ci] !== null && toNum(scalar(a[ci])) === 1 ? 'i' : '');
  try { return new RegExp(toStr(scalar(a[i])), flags); } catch { throw new FErr('#VALUE!'); }
}
function cxSin(z: Cx): Cx { return { re: Math.sin(z.re) * Math.cosh(z.im), im: Math.cos(z.re) * Math.sinh(z.im), sfx: z.sfx }; }
function cxCos(z: Cx): Cx { return { re: Math.cos(z.re) * Math.cosh(z.im), im: -Math.sin(z.re) * Math.sinh(z.im), sfx: z.sfx }; }
function cxSinh(z: Cx): Cx { return { re: Math.sinh(z.re) * Math.cos(z.im), im: Math.cosh(z.re) * Math.sin(z.im), sfx: z.sfx }; }
function cxCosh(z: Cx): Cx { return { re: Math.cosh(z.re) * Math.cos(z.im), im: Math.sinh(z.re) * Math.sin(z.im), sfx: z.sfx }; }
/** p / q pentru numere complexe (împărțire la 0 → #NUM!). */
function cxQuot(p: Cx, q: Cx): Cx {
  const d = q.re * q.re + q.im * q.im;
  if (!d) throw new FErr('#NUM!');
  return { re: (p.re * q.re + p.im * q.im) / d, im: (p.im * q.re - p.re * q.im) / d, sfx: p.sfx };
}
FUNCS['MODE.SNGL'] = FUNCS.MODE;
FUNCS.CRITBINOM = FUNCS['BINOM.INV'];
FUNCS.CHISQINV = FUNCS['CHISQ.INV'];
FUNCS['GAMMALN.PRECISE'] = FUNCS.GAMMALN;
FUNCS.GAMMADIST = FUNCS['GAMMA.DIST'];
FUNCS.GAMMAINV = FUNCS['GAMMA.INV'];
FUNCS.CHIDIST = FUNCS['CHISQ.DIST.RT'];
FUNCS.CHIINV = FUNCS['CHISQ.INV.RT'];
FUNCS.BETAINV = FUNCS['BETA.INV'];
// FDIST cu 4 argumente e funcția din LibreOffice (coada din stânga, ca F.DIST); cu 3 e cea veche din Excel (coada din dreapta).
FUNCS.FDIST = (a: Value[]) => (a.length === 4 ? FUNCS['F.DIST'](a) : FUNCS['F.DIST.RT'](a));
FUNCS.FINV = FUNCS['F.INV.RT'];
FUNCS.TINV = FUNCS['T.INV.2T'];
FUNCS.HYPGEOMDIST = FUNCS['HYPGEOM.DIST'];
FUNCS.NEGBINOMDIST = FUNCS['NEGBINOM.DIST'];
FUNCS.WEIBULL = FUNCS['WEIBULL.DIST'];
FUNCS.LOGNORMDIST = FUNCS['LOGNORM.DIST'];
FUNCS.LOGINV = FUNCS['LOGNORM.INV'];
FUNCS.CONFIDENCE = FUNCS['CONFIDENCE.NORM'];
FUNCS.ZTEST = FUNCS['Z.TEST'];
FUNCS.TTEST = FUNCS['T.TEST'];
FUNCS.FTEST = FUNCS['F.TEST'];
FUNCS.CHITEST = FUNCS['CHISQ.TEST'];
FUNCS['PERCENTILE.INC'] = FUNCS.PERCENTILE;
FUNCS['QUARTILE.INC'] = FUNCS.QUARTILE;
FUNCS['PERCENTRANK.INC'] = FUNCS.PERCENTRANK;
FUNCS['RANK.EQ'] = FUNCS.RANK;
FUNCS['COVARIANCE.P'] = FUNCS.COVAR;
FUNCS.NORMDIST = FUNCS['NORM.DIST'];
FUNCS.NORMINV = FUNCS['NORM.INV'];
FUNCS.NORMSINV = FUNCS['NORM.S.INV'];
FUNCS.BINOMDIST = FUNCS['BINOM.DIST'];
FUNCS.POISSON = FUNCS['POISSON.DIST'];
FUNCS.EXPONDIST = FUNCS['EXPON.DIST'];
FUNCS['FORECAST.LINEAR'] = FUNCS.FORECAST;
// Prognoza cu netezire exponențială (vezi ets.ts): valorile, cronologia, apoi sezonul (1 = găsit singur, 0 = fără),
// completarea golurilor (1 = linie dreaptă, 0 = zero) și regula pentru dublurile din cronologie (1 = medie … 7 = sumă).
const etsCache = new Map<string, EtsModel>();
const etsPrep = (a: Value[], vi: number, opt: number): { ser: EtsSeries; md: EtsModel } => {
  const p = pairs([a[vi], a[vi + 1]]);
  const ser = prepareSeries(p, Math.trunc(arg(a, opt + 1, 1)), Math.trunc(arg(a, opt + 2, 1)));
  if (typeof ser === 'string') throw new FErr(ser as '#NUM!');
  // Aceleași date (de exemplu o coloană de prognoze pe aceeași serie): modelul se potrivește o singură dată.
  const key = `${Math.trunc(arg(a, opt, 1))}|${ser.y.join(',')}`;
  const md = etsCache.get(key) ?? fitEts(ser.y, Math.trunc(arg(a, opt, 1)));
  if (typeof md !== 'string') { if (etsCache.size > 30) etsCache.clear(); etsCache.set(key, md); }
  if (typeof md === 'string') throw new FErr(md as '#NUM!');
  return { ser, md };
};
const etsSteps = (target: number, ser: EtsSeries) => {
  if (target < ser.t0) throw new FErr('#NUM!');
  return stepsAhead(ser, target);
};
FUNCS['FORECAST.ETS'] = (a) => {
  need(a, 3, 6);
  const target = toNum(scalar(a[0]));
  const { ser, md } = etsPrep(a, 1, 3);
  return etsForecast(md, etsSteps(target, ser));
};
FUNCS['FORECAST.ETS.CONFINT'] = (a) => {
  need(a, 3, 7);
  const target = toNum(scalar(a[0]));
  const conf = arg(a, 3, 0.95);
  if (!(conf > 0 && conf < 1)) throw new FErr('#NUM!');
  const { ser, md } = etsPrep(a, 1, 4);
  return etsConfint(md, etsSteps(target, ser), normInv((1 + conf) / 2));
};
FUNCS['FORECAST.ETS.SEASONALITY'] = (a) => {
  need(a, 2, 4);
  const { md } = etsPrep([a[0], a[1], 1, a[2] ?? null, a[3] ?? null] as Value[], 0, 2);
  return md.season;
};
FUNCS['FORECAST.ETS.STAT'] = (a) => {
  need(a, 3, 6);
  const type = Math.trunc(toNum(scalar(a[2])));
  if (!(type >= 1 && type <= 8)) throw new FErr('#NUM!');
  const { ser, md } = etsPrep([a[0], a[1], a[3] ?? null, a[4] ?? null, a[5] ?? null] as Value[], 0, 2);
  const v = etsStat(md, ser.y, ser.step, type);
  if (typeof v === 'string') throw new FErr(v as '#NUM!');
  return v;
};
FUNCS.PEARSON = FUNCS.CORREL;
FUNCS['ISO.WEEKNUM'] = FUNCS.ISOWEEKNUM;

/** Săptămâna ISO: luni e prima zi, iar săptămâna 1 e cea cu prima joi din an. */
function isoWeek(s: number): number {
  const wd = (partsOf(s).wd + 6) % 7; // 0 = luni
  const thu = s - wd + 3;
  const jan1 = serialOf(partsOf(thu).y, 1, 1);
  return Math.floor((thu - jan1) / 7) + 1;
}

// ---------- Zile lucrătoare, rotunjiri „precise” și alte funcții ----------

/** Zilele de weekend: numărul din Excel (1 = sâmbătă și duminică, 11 = doar duminică…) sau textul „0000011” (luni…duminică). */
function weekendDays(v: Value | undefined): boolean[] {
  const w = [false, false, false, false, false, false, false]; // 0 = duminică, ca getUTCDay
  const x = v === undefined ? 1 : scalar(v);
  if (x === null) { w[0] = w[6] = true; return w; }
  if (typeof x === 'string') {
    if (!/^[01]{7}$/.test(x) || x === '1111111') throw new FErr('#VALUE!');
    for (let i = 0; i < 7; i++) w[(i + 1) % 7] = x[i] === '1';
    return w;
  }
  const n = Math.trunc(toNum(x));
  if (n >= 1 && n <= 7) { w[(n + 5) % 7] = true; w[(n + 6) % 7] = true; return w; } // 1: sâm+dum, 2: dum+lun, …
  if (n >= 11 && n <= 17) { w[n - 11] = true; return w; } // 11: duminică, 12: luni, …, 17: sâmbătă
  throw new FErr('#NUM!');
}
const holidaySet = (v: Value | undefined) => new Set(v === undefined ? [] : grid(v).flat().filter((x): x is number => typeof x === 'number').map(Math.floor));
const isWorkday = (s: number, w: boolean[], hol: Set<number>) => !w[partsOf(s).wd] && !hol.has(s);

function networkDays(s0: number, e0: number, w: boolean[], hol: Set<number>): number {
  const [s, e] = [Math.floor(s0), Math.floor(e0)];
  const [lo, hi] = s <= e ? [s, e] : [e, s];
  let n = 0;
  for (let d = lo; d <= hi; d++) if (isWorkday(d, w, hol)) n++;
  return s <= e ? n : -n;
}
function workDay(s0: number, days: number, w: boolean[], hol: Set<number>): number {
  let d = Math.floor(s0);
  let left = Math.trunc(days);
  const step = left < 0 ? -1 : 1;
  if (Math.abs(left) > 1e6) throw new FErr('#NUM!');
  while (left) { d += step; if (isWorkday(d, w, hol)) left -= step; }
  return d;
}
/** Data Paștelui (ortodox sau catolic) pentru un an. */
function easter(y: number, orthodox: boolean): number {
  if (orthodox) {
    const a = y % 4, b = y % 7, c = y % 19, d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7;
    const m = Math.floor((d + e + 114) / 31), day = ((d + e + 114) % 31) + 1;
    return serialOf(y, m, day) + 13; // calendarul iulian → gregorian (1900–2099)
  }
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return serialOf(y, Math.floor((h + l - 7 * m + 114) / 31), ((h + l - 7 * m + 114) % 31) + 1);
}
const roundSig = (x: number, s: number, up: boolean) => {
  if (!s) return 0;
  const q = Number((x / s).toPrecision(15));
  return (up ? Math.ceil(q) : Math.floor(q)) * s;
};

Object.assign(FUNCS, {
  NETWORKDAYS: (a: Value[]) => { need(a, 2, 3); return networkDays(arg(a, 0), arg(a, 1), weekendDays(undefined), holidaySet(a[2])); },
  'NETWORKDAYS.INTL': (a: Value[]) => { need(a, 2, 4); return networkDays(arg(a, 0), arg(a, 1), weekendDays(a[2]), holidaySet(a[3])); },
  WORKDAY: (a: Value[]) => { need(a, 2, 3); return workDay(arg(a, 0), arg(a, 1), weekendDays(undefined), holidaySet(a[2])); },
  'WORKDAY.INTL': (a: Value[]) => { need(a, 2, 4); return workDay(arg(a, 0), arg(a, 1), weekendDays(a[2]), holidaySet(a[3])); },
  // Paștele: EASTERSUNDAY (LibreOffice, catolic) și PASTE (ortodox, specific românesc).
  EASTERSUNDAY: (a: Value[]) => { need(a, 1); const y = Math.trunc(arg(a, 0)); return easter(y < 100 ? y + (y < 30 ? 2000 : 1900) : y, false); },
  PASTE: (a: Value[]) => { need(a, 1); const y = Math.trunc(arg(a, 0)); if (y < 1900 || y > 2099) throw new FErr('#NUM!'); return easter(y, true); },
  WEEKSINYEAR: (a: Value[]) => { need(a, 1); return isoWeek(serialOf(partsOf(arg(a, 0)).y, 12, 28)); },
  // FIXED(număr; [zecimale]; [fără separator de mii]) → text, ca în Excel românesc: 1.234,57.
  FIXED: (a: Value[]) => {
    need(a, 1, 3);
    const dec = Math.trunc(arg(a, 1, 2));
    const n = roundTo(toNum(scalar(a[0])), dec, 'near');
    const s = Math.abs(n).toFixed(Math.max(0, dec)).split('.');
    const whole = a[2] !== undefined && toBool(scalar(a[2])) ? s[0] : s[0].replace(/\B(?=(\d{3})+$)/g, '.');
    return (n < 0 ? '-' : '') + whole + (s[1] ? ',' + s[1] : '');
  },
  'CEILING.PRECISE': (a: Value[]) => { need(a, 1, 2); return roundSig(arg(a, 0), Math.abs(arg(a, 1, 1)), true); },
  'FLOOR.PRECISE': (a: Value[]) => { need(a, 1, 2); return roundSig(arg(a, 0), Math.abs(arg(a, 1, 1)), false); },
  'CEILING.MATH': (a: Value[]) => {
    need(a, 1, 3);
    const x = arg(a, 0);
    return roundSig(x, Math.abs(arg(a, 1, 1)), !(x < 0 && arg(a, 2)));
  },
  'FLOOR.MATH': (a: Value[]) => {
    need(a, 1, 3);
    const x = arg(a, 0);
    return roundSig(x, Math.abs(arg(a, 1, 1)), x < 0 && !!arg(a, 2));
  },
  SQRTPI: (a: Value[]) => { need(a, 1); const x = arg(a, 0); if (x < 0) throw new FErr('#NUM!'); return Math.sqrt(x * Math.PI); },
  COMBINA: (a: Value[]) => {
    need(a, 2);
    const n = count(a, 0), k = count(a, 1);
    if (n === 0 && k === 0) return 1;
    return finite(Math.round(Math.exp(lnFact(n + k - 1) - lnFact(k) - lnFact(n - 1))));
  },
  MULTINOMIAL: (a: Value[]) => {
    const n = numbers(a).map(Math.trunc);
    if (n.some((x) => x < 0)) throw new FErr('#NUM!');
    return finite(Math.round(Math.exp(lnFact(n.reduce((s, x) => s + x, 0)) - n.reduce((s, x) => s + lnFact(x), 0))));
  },
  ACOTH: unary((x) => { if (Math.abs(x) <= 1) throw new FErr('#NUM!'); return 0.5 * Math.log((x + 1) / (x - 1)); }),
  // DOLLARDE(1,02; 16) = 1 + 2/16: prețuri scrise în fracții (bursă).
  DOLLARDE: (a: Value[]) => {
    need(a, 2);
    const x = arg(a, 0), f = Math.trunc(arg(a, 1));
    if (f < 0) throw new FErr('#NUM!');
    if (f === 0) throw new FErr('#DIV/0!');
    const digits = Math.ceil(Math.log10(f));
    const whole = Math.trunc(x);
    return whole + ((x - whole) * 10 ** digits) / f;
  },
  DOLLARFR: (a: Value[]) => {
    need(a, 2);
    const x = arg(a, 0), f = Math.trunc(arg(a, 1));
    if (f < 0) throw new FErr('#NUM!');
    if (f === 0) throw new FErr('#DIV/0!');
    const digits = Math.ceil(Math.log10(f));
    const whole = Math.trunc(x);
    return whole + ((x - whole) * f) / 10 ** digits;
  },
});
// Funcțiile cu „B” (octeți) sunt la fel ca cele obișnuite pentru textele românești.
FUNCS.LENB = FUNCS.LEN;
FUNCS.LEFTB = FUNCS.LEFT;
FUNCS.RIGHTB = FUNCS.RIGHT;
FUNCS.MIDB = FUNCS.MID;
FUNCS.FINDB = FUNCS.FIND;

// BAHTTEXT(număr): suma scrisă în cuvinte thailandeze, cu „baht” și „satang” (ca pe cecuri și facturi din Thailanda).
const TH_DIG = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const TH_POS = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน'];
/** Un număr întreg (sub un milion) în cuvinte; „เอ็ด” pentru 1 la unități după alte cifre, „ยี่สิบ” pentru 20. */
function thaiBelowMillion(n: number, more: boolean): string {
  const ds = String(n).split('').map(Number);
  let out = '';
  ds.forEach((d, i) => {
    const pos = ds.length - 1 - i;
    if (!d) return;
    if (pos === 0 && d === 1 && (ds.length > 1 || more)) out += 'เอ็ด';
    else if (pos === 1 && d === 1) out += 'สิบ';
    else if (pos === 1 && d === 2) out += 'ยี่สิบ';
    else out += TH_DIG[d] + TH_POS[pos];
  });
  return out;
}
function thaiWords(n: number): string {
  if (n < 1e6) return thaiBelowMillion(n, false);
  const hi = Math.floor(n / 1e6), lo = n % 1e6;
  return thaiWords(hi) + 'ล้าน' + (lo ? thaiBelowMillion(lo, true) : '');
}
FUNCS.BAHTTEXT = (a: Value[]) => {
  need(a, 1);
  const x = toNum(scalar(a[0]));
  if (!Number.isFinite(x) || Math.abs(x) >= 1e15) throw new FErr('#NUM!');
  const cents = Math.round(Math.abs(x) * 100);
  const baht = Math.floor(cents / 100), satang = cents % 100;
  const sign = x < 0 && cents ? 'ลบ' : '';
  if (!baht && !satang) return 'ศูนย์บาทถ้วน';
  return sign + (baht ? thaiWords(baht) + 'บาท' : '') + (satang ? thaiBelowMillion(satang, false) + 'สตางค์' : 'ถ้วน');
};
FUNCS.SEARCHB = FUNCS.SEARCH;
FUNCS.REPLACEB = FUNCS.REPLACE;
// DBCS e JIS sub alt nume: literele obișnuite devin „late” (pe două octeți).
FUNCS.DBCS = FUNCS.JIS;

// ---------- Funcțiile Bessel (inginerie): BESSELJ, BESSELY, BESSELI, BESSELK(x; n) ----------
// Calculate din integralele lor, cu metoda trapezelor pe o perioadă întreagă (foarte precisă pentru funcții periodice)
// și cu metoda lui Simpson pe intervale finite. n se trunchiază la un întreg; n < 0 dă #NUM!, ca în Excel.

/** Integrala lui f pe [a, b] cu metoda lui Simpson, pe m intervale (m par). */
function simpson(f: (t: number) => number, a: number, b: number, m: number): number {
  const h = (b - a) / m;
  let sum = f(a) + f(b);
  for (let i = 1; i < m; i++) sum += f(a + i * h) * (i % 2 ? 4 : 2);
  return (sum * h) / 3;
}

/** Media lui f pe o perioadă [0, 2π], cu N puncte egal depărtate (exactă pentru funcțiile periodice netede). */
function periodicMean(f: (t: number) => number, n: number): number {
  let sum = 0;
  for (let i = 0; i < n; i++) sum += f((2 * Math.PI * i) / n);
  return sum / n;
}

const besselOrder = (a: Value[]): number => {
  need(a, 2);
  const n = Math.trunc(arg(a, 1));
  if (n < 0) throw new FErr('#NUM!');
  return n;
};
const besselPoints = (x: number, n: number) => {
  const pts = 2 * Math.ceil(Math.abs(x) + n) + 64;
  if (pts > 4e6) throw new FErr('#NUM!');
  return pts;
};

/** J_n(x) = (1/2π) ∫ cos(nτ − x sin τ) dτ pe o perioadă. */
function besselJ(x: number, n: number): number {
  return periodicMean((t) => Math.cos(n * t - x * Math.sin(t)), besselPoints(x, n));
}

/** I_n(x) = (1/2π) ∫ e^{x cos τ} cos(nτ) dτ pe o perioadă. */
function besselI(x: number, n: number): number {
  return periodicMean((t) => Math.exp(x * Math.cos(t)) * Math.cos(n * t), besselPoints(x, n));
}

/** K_n(x) = ∫₀^∞ e^{−x cosh t} cosh(nt) dt (x > 0); integrandul scade foarte repede. */
function besselK(x: number, n: number): number {
  let T = 1;
  while (x * Math.cosh(T) - n * T < 60 && T < 50) T += 0.5;
  return simpson((t) => Math.exp(-x * Math.cosh(t) + n * t) / 2 + Math.exp(-x * Math.cosh(t) - n * t) / 2, 0, T, 4000);
}

/** Y_0 și Y_1 din integralele lor (x > 0); restul cu formula de recurență, care e stabilă în sus pentru Y. */
function besselY01(x: number, n: 0 | 1): number {
  const m = Math.max(2000, 2 * Math.ceil(x) + 2000);
  const first = simpson((t) => Math.sin(x * Math.sin(t) - n * t), 0, Math.PI, m) / Math.PI;
  let T = 1;
  while (x * Math.sinh(T) - n * T < 60 && T < 60) T += 0.5;
  const sign = n ? -1 : 1;
  const second = simpson((t) => (Math.exp(n * t - x * Math.sinh(t)) + sign * Math.exp(-n * t - x * Math.sinh(t))), 0, T, 8000) / Math.PI;
  return first - second;
}
function besselY(x: number, n: number): number {
  let y0 = besselY01(x, 0);
  if (n === 0) return y0;
  let y1 = besselY01(x, 1);
  for (let k = 1; k < n; k++) { const y2 = ((2 * k) / x) * y1 - y0; y0 = y1; y1 = y2; }
  return y1;
}

Object.assign(FUNCS, {
  BESSELJ: (a: Value[]) => { const n = besselOrder(a); return finite(besselJ(toNum(scalar(a[0])), n)); },
  BESSELI: (a: Value[]) => { const n = besselOrder(a); return finite(besselI(toNum(scalar(a[0])), n)); },
  BESSELK: (a: Value[]) => {
    const n = besselOrder(a), x = toNum(scalar(a[0]));
    if (x <= 0) throw new FErr('#NUM!');
    return finite(besselK(x, n));
  },
  BESSELY: (a: Value[]) => {
    const n = besselOrder(a), x = toNum(scalar(a[0]));
    if (x <= 0) throw new FErr('#NUM!');
    return finite(besselY(x, n));
  },
});
FUNCS['ISO.CEILING'] = FUNCS['CEILING.PRECISE'];

// ---------- Formule cu mai multe rezultate (matrice dinamice, ca în Excel 365) ----------

/** Formulele care își „varsă” rezultatul în celulele de sub și din dreapta lor. */
/** Funcțiile de adunare / statistică la care o celulă dată prin referință se socotește ca o zonă de o celulă. */
/** Funcțiile cu criterii: care argumente sunt criterii (o eroare acolo e o valoare de căutat, nu o eroare a formulei). */
const CRIT_ARGS: Record<string, (i: number) => boolean> = {
  COUNTIF: (i) => i === 1, SUMIF: (i) => i === 1, AVERAGEIF: (i) => i === 1, COUNTIFS: (i) => i % 2 === 1,
  SUMIFS: (i) => i > 0 && i % 2 === 0, AVERAGEIFS: (i) => i > 0 && i % 2 === 0, MAXIFS: (i) => i > 0 && i % 2 === 0, MINIFS: (i) => i > 0 && i % 2 === 0,
};

const REF_ZONE_FNS = new Set(('SUM PRODUCT MAX MIN AVERAGE COUNT MAXA MINA AVERAGEA VAR VARP VAR.P VAR.S VARA VARPA STDEV STDEVP STDEV.S STDEV.P '
  + 'STDEVA STDEVPA MEDIAN SUMSQ AND OR').split(' '));
/** Funcțiile cu argumente de o singură valoare, la care o zonă scrisă direct se citește prin intersecția implicită. */
const SCALAR_ARG_FNS = new Set(('ABS ACOS ACOSH ASIN ASINH ATAN ATAN2 ATANH COS COSH SIN SINH TAN TANH LN LOG LOG10 EXP SQRT MOD ROUND ROUNDUP '
  + 'ROUNDDOWN INT TRUNC RADIANS DEGREES COMBIN FACT SIGN POWER EVEN ODD LEN LEFT RIGHT MID UPPER LOWER TRIM VALUE').split(' '));
export const SPILL_RE = /(?:^|[^\p{L}\d_.])(?:SORT|SORTBY|UNIQUE|FILTER|SEQUENCE|TRANSPOSE|FREQUENCY|MODE\.MULT|TAKE|DROP|CHOOSECOLS|CHOOSEROWS|VSTACK|HSTACK|TOCOL|TOROW|MMULT|MUNIT|MINVERSE|TEXTSPLIT|REGEXEXTRACT|MAP|SCAN|BYROW|BYCOL|MAKEARRAY|GROUPBY|PIVOTBY|EXPAND|WRAPROWS|WRAPCOLS|TREND|GROWTH|LINEST|LOGEST|RANDARRAY|TRIMRANGE|FILTERXML)\s*\(/iu;
/** Funcțiile de căutare care, primind o zonă sau o listă ca valoare căutată (=ISNUMBER(MATCH(B1:B9;{"x";"z"};0))),
 *  dau câte un rezultat pe fiecare valoare, ca în Excel; altfel s-ar folosi doar prima. */
const LIFT_FIRST = new Set(['MATCH', 'XMATCH', 'VLOOKUP', 'HLOOKUP', 'ISNUMBER', 'ISTEXT', 'ISNONTEXT', 'ISLOGICAL', 'DETECTLANGUAGE']);
/** Elementul (i, j) al unei valori de rezervă: dintr-o listă de aceeași formă (sau un singur rând / o coloană), ori valoarea însăși. */
const pick = (fb: Value, i: number, j: number): Scalar => {
  if (!Array.isArray(fb)) return fb;
  const x = fb.length === 1 ? 0 : i, y = (fb[0]?.length ?? 0) === 1 ? 0 : j;
  return fb[x]?.[y] ?? new FErr('#N/A');
};
const isMulti = (v: Value): v is Scalar[][] => Array.isArray(v) && (v.length > 1 || (v[0]?.length ?? 0) > 1);
const safeOp = (f: () => Scalar): Scalar => { try { return f(); } catch (e) { if (e instanceof FErr) return e; throw e; } };

/** Operația dintre două valori: + - * / ^ & și comparațiile. */
function binOp(op: string, a: Scalar, b: Scalar): Scalar {
  switch (op) {
    case '+': return toNum(a) + toNum(b);
    case '-': return toNum(a) - toNum(b);
    case '*': return toNum(a) * toNum(b);
    case '/': { const d = toNum(b); const x = toNum(a); if (d === 0) throw new FErr('#DIV/0!'); return x / d; }
    case '^': return toNum(a) ** toNum(b);
    case '&': return toStr(a) + toStr(b);
    default: return compareVals(op, a, b);
  }
}
/** Operația pe fiecare element (A1:A3*2, (A1:A3>1)*B1:B3); un rând sau o coloană se repetă, ca în Excel. */
function broadcast(a: Value, b: Value, f: (x: Scalar, y: Scalar) => Scalar): Scalar[][] {
  const A = grid(a), B = grid(b);
  const rows = Math.max(A.length, B.length), cols = Math.max(A[0]?.length ?? 0, B[0]?.length ?? 0);
  if (rows * cols > 2_000_000) throw new FErr('#NUM!');
  const at = (G: Scalar[][], r: number, c: number): Scalar => {
    const i = G.length === 1 ? 0 : r, j = (G[0]?.length ?? 0) === 1 ? 0 : c;
    return i < G.length && j < (G[i]?.length ?? 0) ? G[i][j] : new FErr('#N/A'); // în afara zonei mai mici: #N/A, ca în Excel
  };
  const out: Scalar[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: Scalar[] = [];
    for (let c = 0; c < cols; c++) row.push(f(at(A, r, c), at(B, r, c)));
    out.push(row);
  }
  return out;
}

const transpose = (g: Scalar[][]): Scalar[][] => (g[0] ?? []).map((_, j) => g.map((row) => row[j] ?? null));
/** Ordinea din Excel la sortare: numere, texte, ADEVĂRAT/FALS, erori; celulele goale mereu la sfârșit. */
const sortRank = (v: Scalar) => (typeof v === 'number' ? 0 : typeof v === 'string' ? (v === '' ? 4 : 1) : typeof v === 'boolean' ? 2 : v instanceof FErr ? 3 : 4);
function sortCompare(x: Scalar, y: Scalar, order: number): number {
  const rx = sortRank(x), ry = sortRank(y);
  if (rx === 4 || ry === 4) return rx - ry;
  if (rx !== ry) return (rx - ry) * order;
  if (rx === 0) return ((x as number) - (y as number)) * order;
  if (rx === 1) return RO_BASE.compare(x as string, y as string) * order;
  if (rx === 2) return (Number(x) - Number(y)) * order;
  return 0;
}
const sortOrder = (v: Value | undefined) => {
  const o = v === undefined || v === null ? 1 : toNum(scalar(v));
  if (o !== 1 && o !== -1) throw new FErr('#VALUE!');
  return o;
};
const uniqueKey = (row: Scalar[]) => row.map((v) => (v instanceof FErr ? v.code : typeof v === 'string' ? 's' + v.toLocaleLowerCase('ro') : typeof v + String(v))).join('\u0001');

const pad = (r: Scalar[], w: number): Scalar[] => Array.from({ length: w }, (_, j) => (j < r.length ? r[j] : new FErr('#N/A')));
function cut(g: Scalar[][], rv: Value | undefined, cv: Value | undefined, take: boolean): Scalar[][] {
  const part = (len: number, v: Value | undefined): [number, number] => {
    if (v === undefined || v === null) return [0, len];
    const k = Math.trunc(toNum(scalar(v)));
    if (take) return k >= 0 ? [0, Math.min(k, len)] : [Math.max(0, len + k), len];
    return k >= 0 ? [Math.min(k, len), len] : [0, Math.max(0, len + k)];
  };
  const [r0, r1] = part(g.length, rv);
  const [c0, c1] = part(g[0]?.length ?? 0, cv);
  if (r1 <= r0 || c1 <= c0) throw new FErr('#CALC!');
  return g.slice(r0, r1).map((r) => r.slice(c0, c1));
}
function pickRows(g: Scalar[][], idx: Value[]): Scalar[][] {
  return idx.flatMap((v) => grid(v).flat()).map((x) => {
    const k = Math.trunc(toNum(x));
    const i = k > 0 ? k - 1 : g.length + k;
    if (k === 0 || i < 0 || i >= g.length) throw new FErr('#VALUE!');
    return g[i];
  });
}
function flatList(a: Value[]): Scalar[] {
  const ignore = Math.trunc(arg(a, 1, 0));
  const byCol = a[2] !== undefined && a[2] !== null && toBool(scalar(a[2]));
  const g = byCol ? transpose(grid(a[0])) : grid(a[0]);
  const out = g.flat().filter((v) => !((ignore & 1) && (v === null || v === '')) && !((ignore & 2) && v instanceof FErr));
  if (!out.length) throw new FErr('#CALC!');
  return out;
}
function numGrid(v: Value): number[][] {
  return grid(v).map((r) => r.map((x) => { if (typeof x !== 'number') throw new FErr('#VALUE!'); return x; }));
}

const ARR_FUNCS: Record<string, (a: Value[]) => Scalar[][]> = {
  // FREQUENCY(date; intervale): câte valori cad în fiecare interval (≤ limita lui), plus una pentru cele mai mari.
  FREQUENCY: (a) => {
    need(a, 2);
    const data = numbers([a[0]]), bins = numbers([a[1]]);
    const order = bins.map((b, i) => [b, i]).sort((p, q) => p[0] - q[0]);
    const out = new Array(bins.length + 1).fill(0);
    for (const x of data) { const k = order.find(([b]) => x <= b); out[k ? k[1] : bins.length]++; }
    return out.map((n) => [n]);
  },
  // MODE.MULT: toate valorile care apar cel mai des, în ordinea în care apar.
  'MODE.MULT': (a) => {
    const n = numbers(a), cnt = new Map<number, number>();
    for (const x of n) cnt.set(x, (cnt.get(x) ?? 0) + 1);
    const most = Math.max(0, ...cnt.values());
    if (most < 2) throw new FErr('#N/A');
    return [...cnt].filter(([, c]) => c === most).map(([x]) => [x]);
  },
  // SEQUENCE(rânduri; [coloane]; [start]; [pas]): 1, 2, 3…
  SEQUENCE: (a) => {
    need(a, 1, 4);
    const r = Math.trunc(arg(a, 0, 1)), c = Math.trunc(arg(a, 1, 1)), start = arg(a, 2, 1), step = arg(a, 3, 1);
    if (r < 1 || c < 1) throw new FErr('#CALC!');
    if (r * c > 1_000_000) throw new FErr('#NUM!');
    return Array.from({ length: r }, (_, i) => Array.from({ length: c }, (_, j) => start + (i * c + j) * step));
  },
  // RANDARRAY([rânduri]; [coloane]; [min]; [max]; [întregi]): un tabel de numere la întâmplare.
  RANDARRAY: (a) => {
    need(a, 0, 5);
    const r = Math.trunc(arg(a, 0, 1)), c = Math.trunc(arg(a, 1, 1)), lo = arg(a, 2, 0), hi = arg(a, 3, 1);
    const whole = a.length > 4 && a[4] !== null && toBool(scalar(a[4]));
    if (r < 1 || c < 1) throw new FErr('#CALC!');
    if (r * c > 1_000_000 || lo > hi) throw new FErr('#VALUE!');
    if (whole && (lo !== Math.trunc(lo) || hi !== Math.trunc(hi))) throw new FErr('#VALUE!');
    const one = () => (whole ? lo + Math.floor(Math.random() * (hi - lo + 1)) : lo + Math.random() * (hi - lo));
    return Array.from({ length: r }, () => Array.from({ length: c }, one));
  },
  TRANSPOSE: (a) => { need(a, 1); return transpose(grid(a[0])); },
  // TAKE / DROP(zonă; rânduri; [coloane]): primele (sau, cu minus, ultimele) rânduri și coloane; DROP le scoate.
  TAKE: (a) => { need(a, 2, 3); return cut(grid(a[0]), a[1], a[2], true); },
  DROP: (a) => { need(a, 2, 3); return cut(grid(a[0]), a[1], a[2], false); },
  // CHOOSECOLS / CHOOSEROWS(zonă; nr1; [nr2]; …): doar coloanele / rândurile alese (cu minus, de la capăt).
  CHOOSECOLS: (a) => { need(a, 2, 255); return transpose(pickRows(transpose(grid(a[0])), a.slice(1))); },
  CHOOSEROWS: (a) => { need(a, 2, 255); return pickRows(grid(a[0]), a.slice(1)); },
  // VSTACK / HSTACK(zonă1; zonă2; …): zonele puse una sub alta / una lângă alta (golurile devin #N/A).
  VSTACK: (a) => { need(a, 1, 255); const gs = a.map(grid); const w = Math.max(...gs.map((g) => g[0]?.length ?? 0)); return gs.flatMap((g) => g.map((r) => pad(r, w))); },
  HSTACK: (a) => { need(a, 1, 255); return transpose(ARR_FUNCS.VSTACK(a.map((v) => transpose(grid(v))))); },
  // TOCOL / TOROW(zonă; [ignoră: 1 goale, 2 erori, 3 ambele]; [pe coloane]).
  TOCOL: (a) => { need(a, 1, 3); return flatList(a).map((v) => [v]); },
  // TRIMRANGE(zonă; [rânduri]; [coloane]): zona fără rândurile / coloanele goale de la margini
  // (0 = nu taie, 1 = doar la început, 2 = doar la sfârșit, 3 = la amândouă, implicit).
  TRIMRANGE: (a) => {
    need(a, 1, 3);
    const g = grid(a[0]);
    const tr = Math.trunc(arg(a, 1, 3)), tc = Math.trunc(arg(a, 2, 3));
    if (tr < 0 || tr > 3 || tc < 0 || tc > 3) throw new FErr('#VALUE!');
    const full = (v: Scalar) => v !== null && v !== '';
    const rows = g.map((r) => r.some(full)), w = g[0]?.length ?? 0;
    const cols = Array.from({ length: w }, (_, c) => g.some((r) => full(r[c])));
    if (!rows.some(Boolean)) throw new FErr('#REF!');
    const r0 = tr & 1 ? rows.indexOf(true) : 0, r1 = tr & 2 ? rows.lastIndexOf(true) : g.length - 1;
    const c0 = tc & 1 ? cols.indexOf(true) : 0, c1 = tc & 2 ? cols.lastIndexOf(true) : w - 1;
    return g.slice(r0, r1 + 1).map((r) => r.slice(c0, c1 + 1));
  },
  TOROW: (a) => { need(a, 1, 3); return [flatList(a)]; },
  // WRAPROWS / WRAPCOLS(listă; câte; [umplere]): o listă (un rând sau o coloană) așezată pe rânduri / coloane de câte `câte`.
  // TREND / GROWTH(y_cunoscuți; [x_cunoscuți]; [x_noi]; [cu_constantă]): prognoza după dreapta (sau curba exponențială)
  // potrivită prin cele mai mici pătrate; merge și cu mai multe variabile (mai multe coloane de x).
  TREND: (a) => fitPredict(a, false),
  GROWTH: (a) => fitPredict(a, true),
  // LINEST / LOGEST(y_cunoscuți; [x_cunoscuți]; [cu_constantă]; [statistici]): coeficienții dreptei (curbei) potrivite
  LINEST: (a) => linest(a, false),
  LOGEST: (a) => linest(a, true),
  WRAPROWS: (a) => wrapList(a, false),
  WRAPCOLS: (a) => wrapList(a, true),
  // EXPAND(zonă; rânduri; [coloane]; [umplere]): zona mărită la rânduri × coloane; celulele noi primesc umplerea (altfel #N/A).
  EXPAND: (a) => {
    need(a, 2, 4);
    const g = grid(a[0]), h = g.length, w = g[0]?.length ?? 0;
    const rows = a[1] === null ? h : Math.trunc(toNum(scalar(a[1])));
    const cols = a.length > 2 && a[2] !== null ? Math.trunc(toNum(scalar(a[2]))) : w;
    if (rows < h || cols < w) throw new FErr('#VALUE!');
    if (rows * cols > 1e6) throw new FErr('#NUM!');
    const fill: Scalar = a.length > 3 && a[3] !== null ? scalar(a[3]) : new FErr('#N/A');
    return Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => (r < h && c < w ? g[r][c] : fill)));
  },
  // MMULT(matrice1; matrice2): produsul a două matrice.
  MMULT: (a) => {
    need(a, 2);
    const x = numGrid(a[0]), y = numGrid(a[1]);
    if ((x[0]?.length ?? 0) !== y.length) throw new FErr('#VALUE!');
    return x.map((r) => (y[0] ?? []).map((_, j) => r.reduce((s, v, k) => s + v * y[k][j], 0)));
  },
  // MUNIT(n): matricea unitate n × n.
  MUNIT: (a) => { need(a, 1); const n = Math.trunc(arg(a, 0)); if (n < 1 || n > 1000) throw new FErr('#VALUE!'); return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))); },
  // MINVERSE(matrice): inversa (Gauss-Jordan); #NUM! dacă nu are.
  MINVERSE: (a) => {
    need(a, 1);
    const m = squareOf(a[0]), n = m.length;
    const w = m.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
    for (let k = 0; k < n; k++) {
      let p = k;
      for (let i = k + 1; i < n; i++) if (Math.abs(w[i][k]) > Math.abs(w[p][k])) p = i;
      if (Math.abs(w[p][k]) < 1e-15) throw new FErr('#NUM!');
      [w[p], w[k]] = [w[k], w[p]];
      const f = w[k][k];
      for (let j = 0; j < 2 * n; j++) w[k][j] /= f;
      for (let i = 0; i < n; i++) if (i !== k) { const g = w[i][k]; for (let j = 0; j < 2 * n; j++) w[i][j] -= g * w[k][j]; }
    }
    return w.map((r) => r.slice(n));
  },
  // FILTERXML(xml; xpath): ce găsește expresia XPath în textul XML; mai multe noduri se varsă în jos, pe o coloană.
  FILTERXML: (a) => {
    need(a, 2);
    const xml = toStr(scalar(a[0])), path = toStr(scalar(a[1]));
    const g = globalThis as { DOMParser?: typeof DOMParser; XPathResult?: typeof XPathResult };
    if (!g.DOMParser || !g.XPathResult || !xml.trim() || !path.trim()) throw new FErr('#VALUE!');
    const doc = new g.DOMParser().parseFromString(xml, 'text/xml');
    if (doc.getElementsByTagName('parsererror').length || typeof doc.evaluate !== 'function') throw new FErr('#VALUE!');
    let r: XPathResult;
    try { r = doc.evaluate(path, doc, null, g.XPathResult.ANY_TYPE, null); } catch { throw new FErr('#VALUE!'); }
    const val = (t: string): Scalar => { const n = Number(t); return t.trim() !== '' && Number.isFinite(n) ? n : t; };
    if (r.resultType === g.XPathResult.NUMBER_TYPE) return [[r.numberValue]];
    if (r.resultType === g.XPathResult.STRING_TYPE) return [[val(r.stringValue)]];
    if (r.resultType === g.XPathResult.BOOLEAN_TYPE) return [[r.booleanValue]];
    const out: Scalar[] = [];
    for (let n = r.iterateNext(); n && out.length < 100000; n = r.iterateNext()) out.push(val(n.textContent ?? ''));
    if (!out.length) throw new FErr('#VALUE!');
    return out.map((x) => [x]);
  },
  // TEXTSPLIT(text; sep_coloane; [sep_rânduri]; [sari_goale]; [fără_litere_mari]; [completare]).
  TEXTSPLIT: (a) => {
    need(a, 2, 6);
    const text = toStr(scalar(a[0]));
    const seps = (v: Value | undefined) => (v === undefined || v === null ? [] : grid(v).flat().map((x) => toStr(x)).filter((x) => x !== ''));
    const cs = seps(a[1]), rs = seps(a[2]);
    const skip = a[3] !== undefined && a[3] !== null && toBool(scalar(a[3]));
    const ci = arg(a, 4, 0) === 1;
    const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const split = (t: string, list: string[]) => (list.length ? t.split(new RegExp(list.map(esc).join('|'), ci ? 'i' : '')) : [t]);
    let rows = split(text, rs).map((r) => split(r, cs).filter((x) => !skip || x !== ''));
    if (skip) rows = rows.filter((r) => r.length);
    if (!rows.length) throw new FErr('#CALC!');
    const w = Math.max(...rows.map((r) => r.length));
    const fill: Scalar = a.length > 5 && a[5] !== null ? scalar(a[5]) : new FErr('#N/A');
    return rows.map((r) => Array.from({ length: w }, (_, j) => (j < r.length ? r[j] : fill)));
  },
  // SORT(zonă; [coloana]; [1 crescător / -1 descrescător]; [pe coloane]).
  SORT: (a) => {
    need(a, 1, 4);
    const byCol = a[3] !== undefined && a[3] !== null && toBool(scalar(a[3]));
    const g = byCol ? transpose(grid(a[0])) : grid(a[0]).map((r) => [...r]);
    const idx = Math.trunc(arg(a, 1, 1)), order = sortOrder(a[2]);
    if (idx < 1 || idx > (g[0]?.length ?? 0)) throw new FErr('#VALUE!');
    const sorted = g.map((row, i) => ({ row, i })).sort((p, q) => sortCompare(p.row[idx - 1], q.row[idx - 1], order) || p.i - q.i).map((x) => x.row);
    return byCol ? transpose(sorted) : sorted;
  },
  // SORTBY(zonă; după1; [ordine1]; după2; [ordine2]…).
  SORTBY: (a) => {
    if (a.length < 2) throw new FErr('#N/A');
    const g = grid(a[0]);
    const keys: { v: Scalar[]; order: number }[] = [];
    let byCol: boolean | null = null;
    for (let i = 1; i < a.length; i += 2) {
      const k = grid(a[i]);
      const col: boolean = k.length === g.length && (k[0]?.length ?? 0) === 1 && (byCol === null || !byCol);
      const row: boolean = k.length === 1 && (k[0]?.length ?? 0) === (g[0]?.length ?? 0) && !col;
      if (!col && !row) throw new FErr('#VALUE!');
      byCol = row;
      keys.push({ v: col ? k.map((r) => r[0]) : k[0], order: sortOrder(a[i + 1]) });
    }
    const m = byCol ? transpose(g) : g;
    const sorted = m.map((row, i) => ({ row, i }))
      .sort((p, q) => { for (const k of keys) { const d = sortCompare(k.v[p.i], k.v[q.i], k.order); if (d) return d; } return p.i - q.i; })
      .map((x) => x.row);
    return byCol ? transpose(sorted) : sorted;
  },
  // UNIQUE(zonă; [pe coloane]; [doar cele care apar o singură dată]).
  UNIQUE: (a) => {
    need(a, 1, 3);
    const byCol = a[1] !== undefined && a[1] !== null && toBool(scalar(a[1]));
    const once = a[2] !== undefined && a[2] !== null && toBool(scalar(a[2]));
    const m = byCol ? transpose(grid(a[0])) : grid(a[0]);
    const seen = new Map<string, { row: Scalar[]; n: number }>();
    for (const row of m) {
      const k = uniqueKey(row);
      const e = seen.get(k);
      if (e) e.n++; else seen.set(k, { row, n: 1 });
    }
    const out = [...seen.values()].filter((e) => !once || e.n === 1).map((e) => e.row);
    if (!out.length) throw new FErr('#CALC!');
    return byCol ? transpose(out) : out;
  },
  // FILTER(zonă; condiție; [dacă nu e nimic]): rândurile (sau coloanele) pentru care condiția e adevărată.
  FILTER: (a) => {
    need(a, 2, 3);
    const g = grid(a[0]);
    const inc = grid(a[1]);
    const truth = (v: Scalar) => { if (v instanceof FErr) throw v; return v !== null && v !== '' && toBool(v); };
    let out: Scalar[][];
    if (inc.length === g.length && (inc[0]?.length ?? 0) === 1) out = g.filter((_, i) => truth(inc[i][0]));
    else if (inc.length === 1 && (inc[0]?.length ?? 0) === (g[0]?.length ?? 0)) {
      const keep = inc[0].map(truth);
      out = g.map((row) => row.filter((_, j) => keep[j]));
      if (!out[0]?.length) out = [];
    } else throw new FErr('#VALUE!');
    if (!out.length) {
      if (a[2] !== undefined) return [[scalar(a[2])]];
      throw new FErr('#CALC!');
    }
    return out;
  },
};

// ---------- CONVERT: unități de măsură (ca în Excel) ----------

/** Unitățile, pe categorii: factorul față de unitatea de bază a categoriei. Temperaturile se tratează separat. */
const UNITS: Record<string, [string, number, boolean]> = {}; // unitate → [categorie, factor, acceptă prefixe (k, m, µ…)]
([
  ['masa', { g: 1, sg: 14593.902937206, lbm: 453.59237, u: 1.66053906660e-24, ozm: 28.349523125, grain: 0.06479891, cwt: 45359.237, shweight: 45359.237, uk_cwt: 50802.34544, lcwt: 50802.34544, stone: 6350.29318, ton: 907184.74, uk_ton: 1016046.9088, LTON: 1016046.9088, brton: 1016046.9088 }, ['g', 'u']],
  ['lungime', { m: 1, mi: 1609.344, Nmi: 1852, in: 0.0254, ft: 0.3048, yd: 0.9144, ang: 1e-10, ell: 1.143, ly: 9460730472580800, parsec: 30856775814913700, pc: 30856775814913700, Pica: 0.0254 / 6, Picapt: 0.0254 / 72, pica: 0.0254 / 6, survey_mi: 1609.3472186944 }, ['m', 'ang', 'ly', 'parsec', 'pc']],
  ['timp', { sec: 1, s: 1, min: 60, mn: 60, hr: 3600, day: 86400, d: 86400, yr: 31557600 }, ['sec', 's']],
  ['presiune', { Pa: 1, p: 1, atm: 101325, at: 101325, mmHg: 133.322368421, psi: 6894.75729316836, Torr: 133.322368421 }, ['Pa', 'p', 'atm', 'at', 'mmHg']],
  ['forta', { N: 1, dyn: 1e-5, dy: 1e-5, lbf: 4.4482216152605, pond: 0.00980665 }, ['N', 'dyn', 'dy', 'pond']],
  ['energie', { J: 1, e: 1e-7, c: 4.184, cal: 4.1868, eV: 1.602176634e-19, ev: 1.602176634e-19, HPh: 2684519.53769617, hh: 2684519.53769617, Wh: 3600, wh: 3600, flb: 1.3558179483314, BTU: 1055.05585262, btu: 1055.05585262 }, ['J', 'e', 'c', 'cal', 'eV', 'ev', 'Wh', 'wh']],
  ['putere', { W: 1, w: 1, HP: 745.69987158227, h: 745.69987158227, PS: 735.49875 }, ['W', 'w']],
  ['magnetism', { T: 1, ga: 1e-4 }, ['T', 'ga']],
  ['volum', { l: 1e-3, L: 1e-3, lt: 1e-3, m3: 1, 'm^3': 1, tsp: 4.92892159375e-6, tspm: 5e-6, tbs: 1.478676478125e-5, oz: 2.95735295625e-5, cup: 2.365882365e-4, pt: 4.73176473e-4, us_pt: 4.73176473e-4, uk_pt: 5.6826125e-4, qt: 9.46352946e-4, uk_qt: 1.1365225e-3, gal: 3.785411784e-3, uk_gal: 4.54609e-3, ft3: 0.028316846592, 'ft^3': 0.028316846592, in3: 1.6387064e-5, 'in^3': 1.6387064e-5, yd3: 0.764554857984, 'yd^3': 0.764554857984, barrel: 0.158987294928, bushel: 0.03523907016688 }, ['l', 'L', 'lt', 'm3', 'm^3']],
  ['arie', { m2: 1, 'm^2': 1, ha: 10000, ar: 100, uk_acre: 4046.8564224, us_acre: 4046.87260987425, ft2: 0.09290304, 'ft^2': 0.09290304, in2: 6.4516e-4, 'in^2': 6.4516e-4, yd2: 0.83612736, 'yd^2': 0.83612736, mi2: 2589988.110336, 'mi^2': 2589988.110336, Morgen: 2500 }, ['m2', 'm^2', 'ar']],
  ['viteza', { 'm/s': 1, 'm/sec': 1, 'm/h': 1 / 3600, 'm/hr': 1 / 3600, mph: 0.44704, kn: 1852 / 3600, admkn: 0.514773333333333 }, ['m/s', 'm/sec', 'm/h', 'm/hr']],
  ['informatie', { bit: 1, byte: 8 }, ['bit', 'byte']],
] as [string, Record<string, number>, string[]][]).forEach(([cat, units, prefixed]) => {
  for (const [u, f] of Object.entries(units)) UNITS[u] = [cat, f, prefixed.includes(u)];
});
const PREFIX: Record<string, number> = {
  Y: 1e24, Z: 1e21, E: 1e18, P: 1e15, T: 1e12, G: 1e9, M: 1e6, k: 1e3, h: 1e2, da: 1e1, e: 1e1, d: 1e-1, c: 1e-2, m: 1e-3, u: 1e-6, n: 1e-9, p: 1e-12,
  f: 1e-15, a: 1e-18, z: 1e-21, y: 1e-24, Yi: 2 ** 80, Zi: 2 ** 70, Ei: 2 ** 60, Pi: 2 ** 50, Ti: 2 ** 40, Gi: 2 ** 30, Mi: 2 ** 20, ki: 2 ** 10,
};
PREFIX[String.fromCharCode(181)] = 1e-6; // „µ” (micro)
const TEMPS = ['C', 'cel', 'F', 'fah', 'K', 'kel', 'Rank', 'Reau'];
/** Unitatea → categoria și factorul (inclusiv cu prefix: km, mg, kWh, MiB…). */
function unitOf(u: string): [string, number] | null {
  const plain = UNITS[u];
  if (plain) return [plain[0], plain[1]];
  for (const len of [2, 1]) {
    const p = PREFIX[u.slice(0, len)], base = UNITS[u.slice(len)];
    if (p !== undefined && base?.[2] && (!u.slice(0, len).endsWith('i') || base[0] === 'informatie')) {
      // Unitățile la pătrat / cub primesc prefixul la putere (km2 = 1e6 m2).
      const pow = /(2|\^2)$/.test(u) && base[0] === 'arie' ? 2 : /(3|\^3)$/.test(u) && base[0] === 'volum' && !/^l|L|lt$/.test(u.slice(len)) ? 3 : 1;
      return [base[0], base[1] * p ** pow];
    }
  }
  return null;
}
const toKelvin = (x: number, u: string) => (u === 'C' || u === 'cel' ? x + 273.15 : u === 'F' || u === 'fah' ? (x - 32) * 5 / 9 + 273.15
  : u === 'Rank' ? x * 5 / 9 : u === 'Reau' ? x * 1.25 + 273.15 : x);
const fromKelvin = (k: number, u: string) => (u === 'C' || u === 'cel' ? k - 273.15 : u === 'F' || u === 'fah' ? (k - 273.15) * 9 / 5 + 32
  : u === 'Rank' ? k * 9 / 5 : u === 'Reau' ? (k - 273.15) * 0.8 : k);

FUNCS.CONVERT = (a: Value[]) => {
  need(a, 3);
  const x = toNum(scalar(a[0]));
  const from = toStr(scalar(a[1])), to = toStr(scalar(a[2]));
  const tempFrom = TEMPS.includes(from), tempTo = TEMPS.includes(to);
  if (TEMPS.includes(from) || TEMPS.includes(to)) {
    if (!tempFrom || !tempTo) throw new FErr('#N/A');
    return fromKelvin(toKelvin(x, from), to);
  }
  const ef = EURO[from.toUpperCase()], et = EURO[to.toUpperCase()];
  if (ef && et) return x / ef[0] * et[0];
  const f = unitOf(from), t = unitOf(to);
  if (!f || !t || f[0] !== t[0]) throw new FErr('#N/A');
  return (x * f[1]) / t[1];
};

/** R3C15, R[0]C[9], Foaie!R1C1:R2C2 → A1 (față de celula r, c); textul rămâne neschimbat dacă nu e R1C1. */
function r1c1ToA1(text: string, r: number, c: number): string {
  const bang = text.lastIndexOf('!');
  const pre = bang >= 0 ? text.slice(0, bang + 1) : '', body = bang >= 0 ? text.slice(bang + 1) : text;
  const one = (p: string) => {
    const m = /^R(\[-?\d+\]|\d+)?C(\[-?\d+\]|\d+)?$/i.exec(p.trim());
    if (!m) return null;
    const at = (s: string | undefined, base: number) => (!s ? base : s.startsWith('[') ? base + Number(s.slice(1, -1)) : Number(s) - 1);
    const rr = at(m[1], r), cc = at(m[2], c);
    return rr < 0 || cc < 0 ? null : cellId(rr, cc);
  };
  const parts = body.split(':').map(one);
  return parts.some((p) => p === null) ? text : pre + parts.join(':');
}

/** Toate foile tabelului, ca formulele să poată lua valori din alte foi; `self` e foaia calculată. */
export interface SheetBook {
  self: string;
  sheets: { name: string; cells: Record<string, string> }[];
  /** Numele definite ale tabelului (ca în Excel): fără `sheet` merg peste tot, cu `sheet` doar în foaia aceea. */
  names?: DefinedName[];
  /** Tabelele pivot (din fișierele importate sau făcute în Suite), pentru GETPIVOTDATA. */
  pivots?: PivotDef[];
  /** „regex”: textele din condiții (MATCH, COUNTIF, VLOOKUP…) sunt expresii regulate, ca în LibreOffice. */
  match?: 'regex';
  /** Registrele externe din formule ([Buget.xlsx]Foaie1!A1): valorile lor de la ultima citire a fișierului. */
  ext?: ExtBook[];
  /** Calculul iterativ (ca Opțiuni → Activare calcul iterativ): referințele circulare se calculează pe rând, de cel mult `max` ori,
   *  până când nicio valoare nu se mai schimbă cu mai mult de `delta`. Lipsă = o referință circulară dă #CIRC!. */
  iterate?: IterOpts;
}

export interface IterOpts { max: number; delta: number }

/**
 * Un registru extern (alt fișier) folosit în formule: numele lui („Buget.xlsx”), unde era pe disc și valorile foilor lui,
 * păstrate în tabel (ca în Excel), ca formulele să meargă și fără fișier. Se citesc din nou cu Date → Editare legături.
 */
export interface ExtBook { name: string; path?: string; sheets: { name: string; cells: Record<string, string> }[] }
export const DEFAULT_ITER: IterOpts = { max: 100, delta: 0.001 };

/** Un tabel pivot: unde stă, din ce date se face și ce calculează. */
export interface PivotDef {
  /** Foaia în care stă pivotul. */
  sheet: string;
  /** Zona ocupată de pivot pe foaie („S21:U27”). */
  target: string;
  /** Datele sursă, cu capul de tabel pe primul rând („Date!$A$1:$C$50”). */
  source: string;
  rows: string[];
  cols: string[];
  /** Câmpurile de date: coloana și operația (sum, count, average, max, min, product, countnums, stdev, stdevp, var, varp). */
  data: { field: string; fn: string; name?: string }[];
  /** Elementele ascunse, pe câmpuri. */
  hide?: Record<string, string[]>;
  /** Rezumatele făcute de noi: foaia sursă și ce s-a ales în fereastră, ca Reîmprospătare să-l facă din nou. */
  make?: { src: string; spec: import('./pivot').PivotSpec };
  /** Filtrele de pagină (câmp → elementul ales). */
  page?: Record<string, string>;
}

/** Operațiile din pivot, cu funcția care le face. */
const PIVOT_FNS: Record<string, string> = {
  sum: 'SUM', count: 'COUNTA', counta: 'COUNTA', countnums: 'COUNT', average: 'AVERAGE', avg: 'AVERAGE', max: 'MAX', min: 'MIN',
  product: 'PRODUCT', stdev: 'STDEV', stddev: 'STDEV', stdevp: 'STDEVP', stddevp: 'STDEVP', var: 'VAR', varp: 'VARP',
};

export interface DefinedName {
  name: string;
  /** Ce înseamnă, fără „=” în față: 'Foaia 1'!$B$2, Date!$A$2:$C$50 sau o valoare (0,19). */
  ref: string;
  sheet?: string;
}

/**
 * Calculează toate celulele. Celulele fără „=” rămân cum au fost scrise.
 * `hidden` = rândurile foii ascunse de filtru (SUBTOTAL nu le ia în calcul).
 */
/** Numele tuturor funcțiilor pe care le știm (pentru lista „fx Inserează funcție”). */
export function functionNames(): string[] {
  const special = ['LET', 'LAMBDA', 'ISOMITTED', 'GROUPBY', 'PIVOTBY', 'MAP', 'REDUCE', 'SCAN', 'BYROW', 'BYCOL', 'MAKEARRAY', 'IF', 'IFNA', 'IFS', 'IFERROR', 'ISERROR', 'ISERR', 'ISNA', 'TYPE', 'SUBTOTAL', 'AGGREGATE', 'OFFSET', 'INDIRECT', 'INDEX', 'ERRORTYPE',
    'GETPIVOTDATA', 'SHEET', 'SHEETS', 'FORMULA', 'ISFORMULA', 'CELL', 'ISREF', 'ROW', 'ROWS', 'COLUMN', 'COLUMNS', 'AREAS', 'INFO', 'IMAGE'];
  return [...new Set([...Object.keys(FUNCS), ...Object.keys(ARR_FUNCS), ...special])].filter((n) => /^[A-Z]/.test(n)).sort();
}

export function evaluateAll(cells: Record<string, string>, book?: SheetBook, hidden?: Set<number>, only?: string[]): Record<string, Result> {
  const was = regexCrit;
  regexCrit = book?.match === 'regex';
  try {
    if (!book?.iterate) return evaluateBook(cells, book, hidden, only);
    // Calcul iterativ: la o referință circulară se folosește valoarea de la trecerea de dinainte (la început 0);
    // se repetă până când valorile nu se mai schimbă (cu cel mult delta) sau până la numărul maxim de treceri.
    const max = Math.max(1, Math.min(32767, Math.round(book.iterate.max))), delta = Math.max(0, book.iterate.delta);
    let it: Iter = { prev: new Map(), next: new Map(), circ: false };
    let res = evaluateBook(cells, book, hidden, only, it);
    for (let n = 1; it.circ && n < max; n++) {
      const step: Iter = { prev: it.next, next: new Map(), circ: false };
      res = evaluateBook(cells, book, hidden, only, step);
      let moved = 0;
      for (const [k, v] of step.next) {
        const p = it.next.get(k);
        if (typeof v === 'number' && typeof p === 'number') moved = Math.max(moved, Math.abs(v - p));
        else if (v !== p && !(v instanceof FErr && p instanceof FErr && v.code === p.code)) moved = Infinity;
      }
      it = step;
      if (moved <= delta) break;
    }
    return res;
  } finally { regexCrit = was; }
}

/** Starea unei treceri a calculului iterativ: valorile de la trecerea trecută, cele noi și dacă s-a dat de o referință circulară. */
interface Iter { prev: Map<string, Scalar>; next: Map<string, Scalar>; circ: boolean }

function evaluateBook(cells: Record<string, string>, book?: SheetBook, hidden?: Set<number>, only?: string[], iter?: Iter): Record<string, Result> {
  const cache = new Map<string, Scalar>();
  const busy = new Set<string>();
  const self = book ? sheetKey(book.self) : '';
  const others = new Map<string, Record<string, string>>();
  for (const s of book?.sheets ?? []) others.set(sheetKey(s.name), s.cells);
  for (const b of book?.ext ?? []) for (const s of b.sheets) others.set('[' + sheetKey(b.name) + ']' + sheetKey(s.name), s.cells);
  others.set(self, cells);
  // Ultimul rând scris pe fiecare foaie: zonele până la capătul foii (A:A) se opresc acolo, ca să nu citim mii de celule goale.
  const lastRows = new Map<string, number>();
  const lastRow = (at: string) => {
    let v = lastRows.get(at);
    if (v === undefined) {
      v = -1;
      for (const [id, text] of Object.entries(others.get(at) ?? {})) { const p = text ? parseCellId(id) : null; if (p && p.r > v) v = p.r; }
      lastRows.set(at, v);
      // Rezultatele vărsate de SORT, FILTER… lungesc foaia.
      for (const p of anchorsOf(at)) {
        const key = at + '!' + cellId(p.r, p.c);
        if (busy.has(key)) continue;
        cellValue(at, p.r, p.c);
        const arr = spilled.get(key);
        if (arr) v = Math.max(v, p.r + arr.length - 1);
      }
      lastRows.set(at, v);
    }
    return v;
  };
  // Formulele care se „varsă” în celulele vecine (SORT, UNIQUE, FILTER, SEQUENCE, TRANSPOSE), ca în Excel 365.
  const spillAnchors = new Map<string, { r: number; c: number }[]>();
  const anchorsOf = (at: string) => {
    let list = spillAnchors.get(at);
    if (!list) {
      list = [];
      for (const [id, text] of Object.entries(others.get(at) ?? {})) {
        if (text.startsWith('=') && SPILL_RE.test(text)) { const p = parseCellId(id); if (p) list.push(p); }
      }
      spillAnchors.set(at, list);
    }
    return list;
  };
  const spilled = new Map<string, Scalar[][]>();
  /** Valoarea unei celule goale acoperite de rezultatul vărsat al unei formule de deasupra / din stânga. */
  const spillAt = (sh: string, r: number, c: number): Scalar | undefined => {
    for (const p of anchorsOf(sh)) {
      if (p.r > r || p.c > c || (p.r === r && p.c === c)) continue;
      const key = sh + '!' + cellId(p.r, p.c);
      if (busy.has(key)) continue;
      cellValue(sh, p.r, p.c);
      const arr = spilled.get(key);
      if (arr && r - p.r < arr.length && c - p.c < (arr[0]?.length ?? 0)) return arr[r - p.r][c - p.c] ?? 0;
    }
    return undefined;
  };
  /**
   * Intersecția implicită din Excel: în =A1:A9*2 scris în rândul 5, zona din afara unei funcții înseamnă celula de pe rândul formulei (A5).
   * Se aplică doar operatorilor de la nivelul de sus; în funcții (SUM(A1:A9*2)) zona rămâne întreagă.
   */
  const implicitEval = (n: Node, sh: string, r: number, c: number): Value => {
    if (n.k === 'bin') {
      const a = implicitEval(n.a, sh, r, c), b = implicitEval(n.b, sh, r, c);
      if (isMulti(a) || isMulti(b)) return broadcast(a, b, (x, y) => safeOp(() => binOp(n.op, x, y)));
      return binOp(n.op, scalar(a), scalar(b));
    }
    if (n.k === 'un' || n.k === 'pct') {
      const v = implicitEval(n.a, sh, r, c);
      if (n.k === 'un' && n.op === '+') return isMulti(v) ? v : scalar(v); // în Excel „+” nu schimbă nimic (nici textul)
      const neg = n.k === 'un' && n.op === '-';
      const one = (x: Scalar): Scalar => { const t = toNum(x); return n.k === 'pct' ? t / 100 : neg ? -t : t; };
      return isMulti(v) ? v.map((row) => row.map((x) => safeOp(() => one(x)))) : one(scalar(v));
    }
    // Funcțiile care așteaptă un singur număr / text (ABS, LN, ROUND…) primesc din zonă celula de pe rândul / coloana formulei
    // (=ABS(N88:N96) scris în rândul 96 = ABS(N96)); fără celulă comună: #VALUE!, ca în Excel.
    if (n.k === 'fn' && SCALAR_ARG_FNS.has(n.name) && n.args.some((x) => x.k === 'range' && !x.sh2)) {
      const args = n.args.map((x): Node => {
        if (x.k !== 'range' || x.sh2 || (x.r1 === x.r2 && x.c1 === x.c2)) return x;
        if (x.r1 === x.r2 && c >= x.c1 && c <= x.c2) return { k: 'ref', r: x.r1, c, sh: x.sh };
        if (x.c1 === x.c2 && r >= x.r1 && r <= x.r2) return { k: 'ref', r, c: x.c1, sh: x.sh };
        return { k: 'lit', v: new FErr('#VALUE!') };
      });
      return evalNode({ ...n, args }, sh);
    }
    if (n.k === 'range' && !n.sh2) {
      const at = n.sh ?? sh;
      if (n.r1 === n.r2 && c >= n.c1 && c <= n.c2) return cellValue(at, n.r1, c);
      if (n.c1 === n.c2 && r >= n.r1 && r <= n.r2) return cellValue(at, r, n.c1);
    }
    return evalNode(n, sh);
  };
  /** Rezultatul încape doar dacă celulele pe care le acoperă sunt goale și în foaie. */
  const spillFits = (sheet: Record<string, string>, r: number, c: number, arr: Scalar[][]) => {
    if (r + arr.length > ROWS || c + (arr[0]?.length ?? 0) > COLS) return false;
    for (let i = 0; i < arr.length; i++) {
      for (let j = 0; j < (arr[0]?.length ?? 0); j++) if ((i || j) && sheet[cellId(r + i, c + j)]) return false;
    }
    return true;
  };
  const ranges = new Map<string, Scalar[][]>();
  /** Pozele formulelor =IMAGE(…), pe „foaie!celulă”. */
  const images = new Map<string, CellImage>();
  const endRow = (at: string, r1: number, r2: number) => (r2 === ROWS - 1 ? Math.max(r1, Math.min(r2, lastRow(at))) : r2);

  // `sh` = foaia în care se află celula; formulele din altă foaie se calculează cu referințele foii lor.
  const cellValue = (sh: string, r: number, c: number): Scalar => {
    if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return new FErr('#REF!');
    const sheet = others.get(sh);
    if (!sheet) return new FErr('#REF!');
    const id = cellId(r, c);
    const text = sheet[id];
    if (!text) { const v = spillAt(sh, r, c); if (v !== undefined) return v; }
    if (!text?.startsWith('=') || text.length < 2) return rawValue(text);
    const key = sh + '!' + id;
    if (cache.has(key)) return cache.get(key)!;
    if (busy.has(key)) {
      if (!iter) return new FErr('#CIRC!');
      iter.circ = true;
      return iter.prev.get(key) ?? 0;
    }
    busy.add(key);
    const outerNames = usingName, outerHere = here;
    usingName = new Set();
    here = { r, c };
    let v: Scalar;
    try {
      const spills = SPILL_RE.test(text);
      const raw = spills ? evalNode(parseCached(text.slice(1)), sh) : implicitEval(parseCached(text.slice(1)), sh, r, c);
      if (isMulti(raw) && spills) {
        if (spillFits(sheet, r, c, raw)) { spilled.set(key, raw); v = raw[0][0] ?? 0; } else v = new FErr('#SPILL!');
      } else v = scalar(raw);
    } catch (e) {
      v = e instanceof FErr ? e : new FErr('#CIRC!'); // prea multe formule legate una de alta
    }
    usingName = outerNames;
    here = outerHere;
    busy.delete(key);
    cache.set(key, v);
    iter?.next.set(key, v);
    return v;
  };

  // Numele definite: întâi cele ale foii în care se află formula, apoi cele ale întregului tabel.
  const names = new Map<string, string>();
  for (const d of book?.names ?? []) names.set((d.sheet === undefined ? '' : sheetKey(d.sheet)) + '|' + nameKey(d.name), d.ref);
  // Numele în curs de calcul, ca să prindem un nume care se cere pe sine (Bucla = Bucla+1). Fiecare celulă calculată
  // pornește cu lista goală: buclele prin celule le prinde deja `busy`, iar un nume folosit și în celulele zonei lui e în regulă.
  let usingName = new Set<string>();
  // Numele date de LET(nume; valoare; …; calcul): valorile lor, cât se calculează LET-ul (au întâietate față de numele definite).
  const letVars = new Map<string, Value>();
  // Funcțiile LAMBDA date unui nume în LET (LET(f; LAMBDA(x; x*2); f(5))).
  type Lambda = { params: string[]; body: Node };
  const letLambdas = new Map<string, Lambda>();
  // Parametrii LAMBDA-ului care n-au primit valoare (pentru ISOMITTED).
  const omitted = new Set<string>();
  /** Argumentul ca LAMBDA: scris pe loc (LAMBDA(x; …)) sau un nume dat în LET; altfel #VALUE!. */
  const lambdaOf = (a: Node | undefined): Lambda => {
    if (a?.k === 'fn' && a.name === 'LAMBDA') {
      if (!a.args.length) throw new FErr('#VALUE!');
      const params = a.args.slice(0, -1).map((x) => { if (x.k !== 'name') throw new FErr('#VALUE!'); return x.v; });
      return { params, body: a.args[a.args.length - 1] };
    }
    if (a?.k === 'name' && letLambdas.has(a.v)) return letLambdas.get(a.v)!;
    // Doar numele unei funcții (GROUPBY(…; SUM)): un LAMBDA care o cheamă; PERCENTOF primește partea și totul.
    if (a?.k === 'name' && !letVars.has(a.v)) {
      const fn = normName(a.v);
      if (fn in FUNCS || fn in ARR_FUNCS) {
        const params = fn === 'PERCENTOF' ? [' ETA1', ' ETA2'] : [' ETA1'];
        return { params, body: { k: 'fn', name: fn, args: params.map((v): Node => ({ k: 'name', v })) } };
      }
    }
    throw new FErr('#VALUE!');
  };
  /** Calculează LAMBDA-ul cu valorile date (parametrii lipsă rămân goi). */
  const callLambda = (f: Lambda, vals: Value[], sh: string, skipped: boolean[] = []): Value => {
    if (vals.length > f.params.length) throw new FErr('#VALUE!');
    const before = new Map<string, Value | undefined>();
    const wasOmitted = new Map<string, boolean>();
    try {
      f.params.forEach((p, i) => {
        if (!before.has(p)) { before.set(p, letVars.get(p)); wasOmitted.set(p, omitted.has(p)); }
        letVars.set(p, vals[i] ?? null);
        if (i >= vals.length || skipped[i]) omitted.add(p); else omitted.delete(p);
      });
      return evalNode(f.body, sh);
    } finally {
      for (const [k, v] of before) if (v === undefined) letVars.delete(k); else letVars.set(k, v);
      for (const [k, v] of wasOmitted) if (v) omitted.add(k); else omitted.delete(k);
    }
  };
  const grid = (v: Value): Scalar[][] => (isMulti(v) ? v : [[scalar(v)]]);
  /** Rezultatul unui LAMBDA pus într-o celulă dintr-un tabel: o singură valoare (un tabel întreg → #CALC!, ca în Excel). */
  const one = (v: Value): Scalar => { if (isMulti(v) && (v.length > 1 || v[0].length > 1)) return new FErr('#CALC!'); return scalar(v); };
  /** MAP, REDUCE, SCAN, BYROW, BYCOL, MAKEARRAY (cu un LAMBDA ca ultim argument); null = nu e una dintre ele. */
  const lambdaFn = (n: { name: string; args: Node[] }, sh: string): Value | null => {
    const a = n.args, last = a[a.length - 1];
    switch (n.name) {
      case 'MAP': {
        if (a.length < 2) throw new FErr('#N/A');
        const f = lambdaOf(last), arrs = a.slice(0, -1).map((x) => grid(evalNode(x, sh)));
        return arrs[0].map((row, r) => row.map((_, c) => one(callLambda(f, arrs.map((g) => g[r]?.[c] ?? new FErr('#N/A')), sh))));
      }
      case 'REDUCE':
      case 'SCAN': {
        if (a.length !== 3) throw new FErr('#N/A');
        const f = lambdaOf(last), g = grid(evalNode(a[1], sh));
        let acc: Value = a[0].k === 'lit' && a[0].v === null ? 0 : evalNode(a[0], sh);
        const out = g.map((row) => row.map((x) => { acc = callLambda(f, [acc, x], sh); return one(acc); }));
        return n.name === 'REDUCE' ? acc : out;
      }
      case 'BYROW':
      case 'BYCOL': {
        if (a.length !== 2) throw new FErr('#N/A');
        const f = lambdaOf(last), g = grid(evalNode(a[0], sh));
        if (n.name === 'BYROW') return g.map((row) => [one(callLambda(f, [[row]], sh))]);
        return [g[0].map((_, c) => one(callLambda(f, [g.map((row) => [row[c]])], sh)))];
      }
      case 'MAKEARRAY': {
        if (a.length !== 3) throw new FErr('#N/A');
        const rows = Math.trunc(toNum(scalar(evalNode(a[0], sh)))), cols = Math.trunc(toNum(scalar(evalNode(a[1], sh))));
        if (rows < 1 || cols < 1 || rows * cols > 1e6) throw new FErr('#VALUE!');
        const f = lambdaOf(last);
        return Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => one(callLambda(f, [r + 1, c + 1], sh))));
      }
      case 'GROUPBY':
        return groupBy(a, sh);
      case 'PIVOTBY':
        return pivotBy(a, sh);
    }
    return null;
  };
  /** Cheia de grupare a unui rând de chei (fără litere mari / mici). */
  const groupKey = (k: Scalar[]) => k.map((x) => (typeof x === 'string' ? 's' + x.toLocaleLowerCase('ro-RO') : x instanceof FErr ? 'e' + x.code : typeof x + String(x))).join('\u0001');
  /**
   * PIVOTBY(chei rânduri; chei coloane; valori; funcție; [antete]; [totaluri rânduri]; [sortare rânduri]; [totaluri coloane];
   * [sortare coloane]; [filtru]): ca GROUPBY, dar cu grupuri și pe coloane (un tabel pivot într-o formulă).
   */
  const pivotBy = (a: Node[], sh: string): Scalar[][] => {
    if (a.length < 4 || a.length > 11) throw new FErr('#N/A');
    const given = (i: number) => a[i] !== undefined && !(a[i].k === 'lit' && a[i].v === null);
    const opt = (i: number, def: number) => (given(i) ? Math.trunc(toNum(scalar(evalNode(a[i], sh)))) : def);
    let rk = grid(evalNode(a[0], sh)), ck = grid(evalNode(a[1], sh)), vals = grid(evalNode(a[2], sh));
    if (rk.length !== vals.length || ck.length !== vals.length || !vals.length) throw new FErr('#VALUE!');
    const f = lambdaOf(a[3]);
    const kr = rk[0].length, kc = ck[0].length, vw = vals[0].length;
    let heads = opt(4, -1);
    if (heads === -1) {
      const isText = (x: Scalar) => typeof x === 'string' && x !== '';
      heads = vals.length > 1 && vals[0].every(isText) && vals[1].some((x) => typeof x === 'number') ? 1 : 0;
    }
    if (heads < 0 || heads > 3) throw new FErr('#VALUE!');
    const names = heads === 1 || heads === 3 ? { r: rk[0], v: vals[0] } : null;
    if (names) { rk = rk.slice(1); ck = ck.slice(1); vals = vals.slice(1); }
    const rDepth = opt(5, 1), rSort = opt(6, 1), cDepth = opt(7, 1), cSort = opt(8, 1);
    if (Math.abs(rDepth) > 1 || Math.abs(cDepth) > 1 || rSort === 0 || cSort === 0 || Math.abs(rSort) > kr || Math.abs(cSort) > kc) throw new FErr('#VALUE!');
    let rows = vals.map((_, i) => i);
    if (given(9)) {
      const fl = grid(evalNode(a[9], sh));
      const off = fl.length === vals.length ? 0 : fl.length === vals.length + 1 && names ? 1 : -1;
      if (off < 0) throw new FErr('#VALUE!');
      rows = rows.filter((i) => { const x = fl[i + off][0]; return x instanceof FErr ? false : toBool(x); });
    }
    rows = rows.filter((i) => rk[i].some((x) => x !== null && x !== '') || ck[i].some((x) => x !== null && x !== ''));
    if (!rows.length) throw new FErr('#CALC!');
    // Grupurile de pe rânduri și de pe coloane, sortate (după cheia aleasă, apoi după celelalte).
    const groupsOf = (keys: Scalar[][], sortBy: number) => {
      const m = new Map<string, Scalar[]>();
      for (const i of rows) { const t = groupKey(keys[i]); if (!m.has(t)) m.set(t, keys[i]); }
      const order = sortBy > 0 ? 1 : -1, sc = Math.abs(sortBy) - 1;
      return [...m.entries()].sort(([, p], [, q]) => {
        const d = sortCompare(p[sc], q[sc], order);
        if (d) return d;
        for (let j = 0; j < p.length; j++) { const e = sortCompare(p[j], q[j], 1); if (e) return e; }
        return 0;
      });
    };
    const rg = groupsOf(rk, rSort), cg = groupsOf(ck, cSort);
    const col = (list: number[], j: number): Scalar[][] => list.map((i) => [vals[i][j]]);
    const agg = (list: number[]): Scalar[] => Array.from({ length: vw }, (_, j) => {
      if (!list.length) return '';
      try { return one(callLambda(f, f.params.length > 1 ? [col(list, j), col(rows, j)] : [col(list, j)], sh)); } catch (e) { if (e instanceof FErr) return e; throw e; }
    });
    const cell = (rt: string | null, ct: string | null) => agg(rows.filter((i) => (rt === null || groupKey(rk[i]) === rt) && (ct === null || groupKey(ck[i]) === ct)));
    // Coloanele rezultatului: fiecare grup de coloane (cu toate valorile lui) și totalul.
    const colSlots: (string | null)[] = cg.map(([t]) => t);
    if (cDepth > 0) colSlots.push(null); else if (cDepth < 0) colSlots.unshift(null);
    const res: Scalar[][] = [];
    // Rândurile de antet: câte unul pe fiecare cheie de coloană, plus unul cu numele valorilor (când sunt mai multe).
    const headRows = kc + (vw > 1 ? 1 : 0);
    for (let h = 0; h < headRows; h++) {
      const isValueRow = vw > 1 && h === kc;
      const lastHead = h === headRows - 1;
      const row: Scalar[] = Array.from({ length: kr }, (_, j) => (lastHead && heads === 3 && names ? names.r[j] : ''));
      for (const slot of colSlots) {
        const key = slot === null ? null : cg.find(([t]) => t === slot)![1];
        for (let j = 0; j < vw; j++) {
          if (isValueRow) row.push(names ? names.v[j] : `Valoare ${j + 1}`);
          else if (j > 0) row.push('');
          else row.push(key === null ? (h === 0 ? 'Total' : '') : key[h]);
        }
      }
      res.push(row);
    }
    const body = (rt: string | null, key: Scalar[]) => {
      const row: Scalar[] = [...key];
      for (const slot of colSlots) row.push(...cell(rt, slot));
      return row;
    };
    const totalRow = () => body(null, ['Total', ...Array<Scalar>(kr - 1).fill('')]);
    if (rDepth < 0) res.push(totalRow());
    for (const [t, key] of rg) res.push(body(t, key));
    if (rDepth > 0) res.push(totalRow());
    return res;
  };
  /**
   * GROUPBY(chei; valori; funcție; [antete]; [totaluri]; [sortare]; [filtru]): rezumatul valorilor pe fiecare grup de chei.
   * Funcția e un LAMBDA sau doar numele unei funcții (SUM, AVERAGE, COUNT…); PERCENTOF primește și toate valorile.
   * Antete: 0 nu, 1 da (nu se arată), 2 nu (se scriu „Valoare”), 3 da și se arată; implicit se ghicește.
   * Totaluri: 0 fără, 1 total general (implicit), 2 și subtotaluri pe prima cheie; cu minus, totalurile stau sus.
   * Sortare: numărul coloanei rezultatului (cheile, apoi valorile); cu minus, descrescător.
   */
  const groupBy = (a: Node[], sh: string): Scalar[][] => {
    if (a.length < 3 || a.length > 8) throw new FErr('#N/A');
    const opt = (i: number, def: number) => (a[i] === undefined || (a[i].k === 'lit' && a[i].v === null) ? def : Math.trunc(toNum(scalar(evalNode(a[i], sh)))));
    let keys = grid(evalNode(a[0], sh)), vals = grid(evalNode(a[1], sh));
    if (keys.length !== vals.length || !keys.length) throw new FErr('#VALUE!');
    const f = lambdaOf(a[2]);
    const kw = keys[0].length, vw = vals[0].length;
    let heads = opt(3, -1);
    if (heads === -1) {
      // Fără „antete” scris: primul rând e antet dacă valorile lui sunt text, iar sub ele sunt numere.
      const isText = (x: Scalar) => typeof x === 'string' && x !== '';
      heads = vals.length > 1 && vals[0].every(isText) && vals[1].some((x) => typeof x === 'number') ? 1 : 0;
    }
    if (heads < 0 || heads > 3) throw new FErr('#VALUE!');
    const headRow: Scalar[] | null = heads === 1 || heads === 3 ? [...keys[0], ...vals[0]] : null;
    if (headRow) { keys = keys.slice(1); vals = vals.slice(1); }
    const depth = opt(4, 1), sortBy = opt(5, 1);
    if (Math.abs(depth) > 2 || sortBy === 0 || Math.abs(sortBy) > kw + vw) throw new FErr('#VALUE!');
    let rows = keys.map((_, i) => i);
    if (a[6] !== undefined && !(a[6].k === 'lit' && a[6].v === null)) {
      const fl = grid(evalNode(a[6], sh));
      if (fl.length !== keys.length + (headRow ? 1 : 0) && fl.length !== keys.length) throw new FErr('#VALUE!');
      const off = fl.length === keys.length ? 0 : 1;
      rows = rows.filter((i) => { const x = fl[i + off][0]; return x instanceof FErr ? false : toBool(x); });
    }
    // Rândurile goale de la capăt (zone întregi, A:A) nu formează un grup.
    rows = rows.filter((i) => keys[i].some((x) => x !== null && x !== ''));
    if (!rows.length) throw new FErr('#CALC!');
    const col = (list: number[], j: number): Scalar[][] => list.map((i) => [vals[i][j]]);
    const agg = (list: number[]): Scalar[] => Array.from({ length: vw }, (_, j) => {
      try { return one(callLambda(f, f.params.length > 1 ? [col(list, j), col(rows, j)] : [col(list, j)], sh)); } catch (e) { if (e instanceof FErr) return e; throw e; }
    });
    // Grupurile, în ordinea în care apar.
    const groups = new Map<string, { key: Scalar[]; list: number[] }>();
    for (const i of rows) {
      const t = groupKey(keys[i]);
      const g = groups.get(t);
      if (g) g.list.push(i); else groups.set(t, { key: keys[i], list: [i] });
    }
    const out = [...groups.values()].map((g) => ({ key: g.key, list: g.list, v: agg(g.list) }));
    const order = sortBy > 0 ? 1 : -1, sc = Math.abs(sortBy) - 1;
    const at = (x: { key: Scalar[]; v: Scalar[] }, j: number) => (j < kw ? x.key[j] : x.v[j - kw]);
    out.sort((p, q) => {
      // Cu subtotaluri, grupurile rămân strânse după prima cheie.
      if (Math.abs(depth) === 2 && kw > 1 && sc !== 0) { const d = sortCompare(p.key[0], q.key[0], 1); if (d) return d; }
      const d = sortCompare(at(p, sc), at(q, sc), order);
      if (d) return d;
      for (let j = 0; j < kw; j++) { const e = sortCompare(p.key[j], q.key[j], 1); if (e) return e; }
      return 0;
    });
    const res: Scalar[][] = [];
    const blankKeys = (first: Scalar): Scalar[] => [first, ...Array<Scalar>(kw - 1).fill('')];
    const total = (): Scalar[] => [...blankKeys('Total'), ...agg(rows)];
    if (depth < 0) res.push(total());
    if (Math.abs(depth) === 2 && kw > 1) {
      // Subtotalurile pe prima cheie: după (sau, cu minus, înaintea) fiecărui grup.
      for (let s = 0; s < out.length;) {
        let e = s;
        while (e < out.length && groupKey([out[e].key[0]]) === groupKey([out[s].key[0]])) e++;
        const part = out.slice(s, e);
        const sub = [...blankKeys(out[s].key[0]), ...agg(part.flatMap((x) => x.list))];
        if (depth < 0) res.push(sub);
        for (const x of part) res.push([...x.key, ...x.v]);
        if (depth > 0) res.push(sub);
        s = e;
      }
    } else {
      for (const x of out) res.push([...x.key, ...x.v]);
    }
    if (depth > 0) res.push(total());
    if (heads === 3 && headRow) res.unshift(headRow);
    if (heads === 2) res.unshift([...Array<Scalar>(kw).fill(''), ...Array.from({ length: vw }, (): Scalar => 'Valoare')]);
    return res;
  };
  let here = { r: 0, c: 0 };
  /** Ce înseamnă numele (arborele formulei lui); #NAME? dacă nu există, #REF! dacă trimite la ceva șters. */
  const nameNode = (key: string, sh: string): Node => {
    const ref = names.get(sh + '|' + key) ?? names.get('|' + key);
    if (ref === undefined) throw new FErr('#NAME?');
    try { return parseCached(ref.replace(/^=/, '')); } catch { throw new FErr('#REF!'); }
  };
  const withName = <T,>(key: string, sh: string, f: (n: Node) => T): T => {
    const k = sh + '|' + key;
    if (usingName.has(k)) throw new FErr('#CIRC!');
    usingName.add(k);
    try { return f(nameNode(key, sh)); } finally { usingName.delete(k); }
  };

  /** Zona la care trimite un argument: o celulă, o zonă, un nume definit sau un OFFSET (care poate primi la rândul lui un OFFSET). */
  /** INDIRECT("B2") / INDIRECT("'Foaia 2'!A1:A9"): adresa scrisă ca text devine referință (doar stilul A1). */
  const indirectNode = (n: { args: Node[] }, sh: string): Node => {
    if (n.args.length < 1 || n.args.length > 2) throw new FErr('#N/A');
    let text = toStr(scalar(evalNode(n.args[0], sh))).trim();
    if (n.args[1] !== undefined && !toBool(scalar(evalNode(n.args[1], sh)))) text = r1c1ToA1(text, here.r, here.c);
    let x: Node;
    try { x = parseCached(text); } catch { throw new FErr('#REF!'); }
    if (x.k !== 'ref' && x.k !== 'range' && x.k !== 'name') throw new FErr('#REF!');
    return x;
  };

  const refOf = (n: Node, sh: string): { sh: string; r1: number; c1: number; r2: number; c2: number } => {
    if (n.k === 'name') return withName(n.v, sh, (x) => refOf(x, sh));
    if (n.k === 'fn' && n.name === 'INDIRECT') return refOf(indirectNode(n, sh), sh);
    if (n.k === 'ref') return { sh: n.sh ?? sh, r1: n.r, c1: n.c, r2: n.r, c2: n.c };
    if (n.k === 'range') return { sh: n.sh ?? sh, r1: n.r1, c1: n.c1, r2: n.r2, c2: n.c2 };
    if (n.k === 'fn' && n.name === 'OFFSET') {
      if (n.args.length < 3 || n.args.length > 5) throw new FErr('#N/A');
      const base = refOf(n.args[0], sh);
      const num = (i: number, def: number) => {
        const a = n.args[i];
        return !a || (a.k === 'lit' && a.v === null) ? def : Math.trunc(toNum(scalar(evalNode(a, sh))));
      };
      const dr = num(1, 0), dc = num(2, 0);
      const h = num(3, base.r2 - base.r1 + 1), w = num(4, base.c2 - base.c1 + 1);
      if (h < 1 || w < 1) throw new FErr('#REF!');
      const r1 = base.r1 + dr, c1 = base.c1 + dc;
      if (r1 < 0 || c1 < 0 || r1 + h > ROWS || c1 + w > COLS) throw new FErr('#REF!');
      return { sh: base.sh, r1, c1, r2: r1 + h - 1, c2: c1 + w - 1 };
    }
    if (n.k === 'fn' && n.name === '_SPAN') {
      // A1:INDEX(A1:A9;3): dreptunghiul care cuprinde ambele capete; capătul fără foaie e pe foaia primului.
      const a = refOf(n.args[0], sh);
      const bn = n.args[1];
      const b = refOf(bn.k === 'ref' && !bn.sh ? { ...bn, sh: a.sh } : bn, sh);
      if (a.sh !== b.sh) throw new FErr('#REF!');
      return { sh: a.sh, r1: Math.min(a.r1, b.r1), c1: Math.min(a.c1, b.c1), r2: Math.max(a.r2, b.r2), c2: Math.max(a.c2, b.c2) };
    }
    if (n.k === 'fn' && n.name === 'INDEX' && (n.args.length === 2 || n.args.length === 3)) {
      // INDEX(zonă; rând; [coloană]) e tot o referință, ca în Excel: rândul 0 = toată coloana, coloana 0 = tot rândul.
      const base = refOf(n.args[0], sh);
      const h = base.r2 - base.r1 + 1, w = base.c2 - base.c1 + 1;
      const num = (a: Node | undefined) => (!a || (a.k === 'lit' && a.v === null) ? 0 : Math.trunc(toNum(scalar(evalNode(a, sh)))));
      let r = num(n.args[1]), c = num(n.args[2]);
      if (n.args.length === 2) {
        if (h === 1 && w > 1) { c = r; r = 1; } // un singur rând: al doilea argument e coloana
        else if (w === 1) c = 1;
      }
      if (r < 0 || c < 0 || r > h || c > w) throw new FErr('#REF!');
      return {
        sh: base.sh,
        r1: r ? base.r1 + r - 1 : base.r1, r2: r ? base.r1 + r - 1 : base.r2,
        c1: c ? base.c1 + c - 1 : base.c1, c2: c ? base.c1 + c - 1 : base.c2,
      };
    }
    throw new FErr('#VALUE!');
  };

  /**
   * GETPIVOTDATA(câmp de date; celulă din pivot; [câmp1; element1; …]) ca în Excel, sau GETPIVOTDATA(celulă; "câmp[element] …")
   * ca în LibreOffice. Rezultatul se calculează din datele sursă ale pivotului, cu aceeași operație (sumă, număr, medie…).
   */
  const pivotData = (n: Extract<Node, { k: 'fn' }>, sh: string): Value => {
    if (n.args.length < 2) throw new FErr('#N/A');
    const isRef = (a: Node) => a.k === 'ref' || a.k === 'range' || a.k === 'name' || (a.k === 'fn' && (a.name === 'OFFSET' || a.name === 'INDIRECT' || a.name === '_SPAN'));
    const short = n.args.length === 2 && isRef(n.args[0]) && !isRef(n.args[1]);
    const z = refOf(n.args[short ? 0 : 1], sh);
    const p = (book?.pivots ?? []).find((x) => {
      if (sheetKey(x.sheet) !== z.sh) return false;
      const t = /^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(x.target.toUpperCase().replace(/\$/g, ''));
      if (!t) return false;
      const r1 = Number(t[2]) - 1, c1 = colIndex(t[1]), r2 = t[4] ? Number(t[4]) - 1 : r1, c2 = t[3] ? colIndex(t[3]) : c1;
      return z.r1 >= r1 && z.r1 <= r2 && z.c1 >= c1 && z.c1 <= c2;
    });
    if (!p || !p.data.length) throw new FErr('#REF!');
    const src = grid(evalNode(parseCached(p.source), sh));
    const low = (s: string) => s.trim().toLocaleLowerCase('ro-RO');
    const heads = (src[0] ?? []).map((x) => low(x instanceof FErr ? '' : toStr(x)));
    const colOf = (f: string) => heads.indexOf(low(f));
    const shown = [...p.rows, ...p.cols].map(low);
    // Numele câmpului de date: „cantitate”, „Sum of cantitate” (Excel), „Sum - cantitate” (LibreOffice) sau numele dat în pivot.
    const dataOf = (s: string) => {
      const k = low(s);
      return p.data.find((d) => low(d.field) === k || (d.name && low(d.name) === k) || low(d.field) === k.replace(/^[a-z.]+\s+(?:of|-)\s+/, ''));
    };
    let data = p.data.length === 1 ? p.data[0] : undefined;
    const filters: [string, Scalar][] = [];
    const loose: Scalar[] = [];
    if (short) {
      // „fructe[mere] tip[A]”, sau doar „mere” când elementul e al unui singur câmp.
      const spec = toStr(scalar(evalNode(n.args[1], sh)));
      for (const m of spec.matchAll(/([^\s[\]]+)\s*\[([^\]]*)\]|(\S+)/g)) {
        if (m[3] === undefined) { filters.push([m[1], m[2]]); continue; }
        const d = dataOf(m[3]);
        if (d) data = d; else loose.push(m[3]);
      }
    } else {
      data = dataOf(toStr(scalar(evalNode(n.args[0], sh))));
      if (n.args.length % 2) throw new FErr('#REF!');
      for (let i = 2; i < n.args.length; i += 2) filters.push([toStr(scalar(evalNode(n.args[i], sh))), scalar(evalNode(n.args[i + 1], sh))]);
    }
    if (!data) throw new FErr('#REF!');
    const vc = colOf(data.field);
    if (vc < 0) throw new FErr('#REF!');
    const same = (a: Scalar, b: Scalar) => {
      if (a instanceof FErr || b instanceof FErr) return false;
      if (typeof a === 'number' || typeof b === 'number') {
        try { return toNum(a) === toNum(b); } catch { return false; }
      }
      return low(toStr(a)) === low(toStr(b));
    };
    const conds: [number, Scalar][] = [];
    for (const [f, item] of filters) {
      if (!shown.includes(low(f))) throw new FErr('#REF!');
      const c = colOf(f);
      if (c < 0) throw new FErr('#REF!');
      conds.push([c, item]);
    }
    for (const item of loose) {
      const c = shown.map(colOf).find((c) => c >= 0 && src.some((row, i) => i > 0 && same(row[c], item)));
      if (c === undefined) throw new FErr('#REF!');
      conds.push([c, item]);
    }
    // Elementele ascunse în pivot și filtrele de pagină.
    const hide = Object.entries(p.hide ?? {}).map(([f, v]) => [colOf(f), v.map(low)] as const).filter(([c]) => c >= 0);
    const page = Object.entries(p.page ?? {}).map(([f, v]) => [colOf(f), v] as const).filter(([c]) => c >= 0);
    const vals: Scalar[][] = [];
    for (let i = 1; i < src.length; i++) {
      const row = src[i];
      if (row.every((x) => x === null || x === '')) continue;
      if (!conds.every(([c, item]) => same(row[c], item))) continue;
      if (hide.some(([c, v]) => v.includes(low(row[c] instanceof FErr ? '' : toStr(row[c]))))) continue;
      if (!page.every(([c, v]) => same(row[c], v))) continue;
      vals.push([row[vc]]);
    }
    if (!vals.length) throw new FErr('#REF!');
    const fname = PIVOT_FNS[low(data.fn)] ?? 'SUM';
    return FUNCS[fname]([vals]);
  };

  const evalNode = (n: Node, sh: string): Value => {
    switch (n.k) {
      // O eroare scrisă în formulă (#REF!) e o valoare, ca o celulă cu eroare: CHOOSE(2;#REF!;3) = 3.
      case 'lit': return n.v;
      case 'arr': return n.v;
      case 'ref': return cellValue(n.sh ?? sh, n.r, n.c);
      case 'name': return letVars.has(n.v) ? letVars.get(n.v)! : withName(n.v, sh, (x) => evalNode(x, sh));
      case 'range': {
        if (n.r2 >= ROWS || n.c2 >= COLS) throw new FErr('#REF!');
        if (n.sh2) {
          // Pe mai multe foi (Foaie1:Foaie3!A1:B2): zona din fiecare foaie dintre cele două, puse una sub alta,
          // ca SUM / AVERAGE / COUNT / MAX… să le ia pe toate.
          const order = (book?.sheets ?? []).map((x) => sheetKey(x.name));
          const [i1, i2] = [order.indexOf(n.sh ?? sh), order.indexOf(n.sh2)];
          if (i1 < 0 || i2 < 0) throw new FErr('#REF!');
          const out: Scalar[][] = [];
          for (let i = Math.min(i1, i2); i <= Math.max(i1, i2); i++) {
            const part = evalNode({ k: 'range', r1: n.r1, c1: n.c1, r2: n.r2, c2: n.c2, sh: order[i] }, sh);
            if (Array.isArray(part)) out.push(...(part as Scalar[][])); else out.push([part as Scalar]);
          }
          return out;
        }
        const at = n.sh ?? sh;
        if (!others.has(at)) throw new FErr('#REF!');
        const end = endRow(at, n.r1, n.r2);
        // Aceeași zonă (de exemplu A:B din sute de VLOOKUP) se citește o singură dată pe calcul.
        const key = `${at}!${n.r1},${n.c1},${end},${n.c2}`;
        const known = ranges.get(key);
        if (known) return known;
        const out: Scalar[][] = [];
        for (let r = n.r1; r <= end; r++) {
          const row: Scalar[] = [];
          for (let c = n.c1; c <= n.c2; c++) row.push(cellValue(at, r, c));
          out.push(row);
        }
        ranges.set(key, out);
        return out;
      }
      case 'un': {
        const v = evalNode(n.a, sh);
        if (n.op === '+') return isMulti(v) ? v : scalar(v);
        if (isMulti(v)) return v.map((row) => row.map((x) => safeOp(() => { const t = toNum(x); return n.op === '-' ? -t : t; })));
        const x = toNum(scalar(v));
        return n.op === '-' ? -x : x;
      }
      case 'pct': return toNum(scalar(evalNode(n.a, sh))) / 100;
      case 'bin': {
        const av = evalNode(n.a, sh);
        const bv = evalNode(n.b, sh);
        if (isMulti(av) || isMulti(bv)) return broadcast(av, bv, (x, y) => safeOp(() => binOp(n.op, x, y)));
        return binOp(n.op, scalar(av), scalar(bv));
      }
      case 'fn': {
        if (n.name === 'LET') {
          // LET(nume1; valoare1; [nume2; valoare2]; …; calcul): fiecare valoare se calculează o dată și se folosește după nume.
          if (n.args.length < 3 || n.args.length % 2 === 0) throw new FErr('#N/A');
          const before = new Map<string, Value | undefined>();
          const lamBefore = new Map<string, Lambda | undefined>();
          try {
            for (let i = 0; i + 1 < n.args.length; i += 2) {
              const nm = n.args[i];
              if (nm.k !== 'name') throw new FErr('#VALUE!');
              const val = n.args[i + 1];
              if (!before.has(nm.v)) before.set(nm.v, letVars.get(nm.v));
              if (!lamBefore.has(nm.v)) lamBefore.set(nm.v, letLambdas.get(nm.v));
              // Un LAMBDA nu se calculează: se ține minte, ca să fie chemat după nume (f(5)).
              if (val.k === 'fn' && val.name === 'LAMBDA') { letLambdas.set(nm.v, lambdaOf(val)); letVars.delete(nm.v); continue; }
              letLambdas.delete(nm.v);
              letVars.set(nm.v, evalNode(val, sh));
            }
            return evalNode(n.args[n.args.length - 1], sh);
          } finally {
            for (const [k, v] of before) if (v === undefined) letVars.delete(k); else letVars.set(k, v);
            for (const [k, v] of lamBefore) if (v === undefined) letLambdas.delete(k); else letLambdas.set(k, v);
          }
        }
        // Un LAMBDA dat unui nume în LET, chemat cu argumente: f(5).
        if (letLambdas.has(n.name)) {
          // Un argument lăsat gol (f(1;)) contează ca lipsă: ISOMITTED îl vede.
          const skipped = n.args.map((x) => x.k === 'lit' && x.v === null);
          return callLambda(letLambdas.get(n.name)!, n.args.map((x) => evalNode(x, sh)), sh, skipped);
        }
        // ISOMITTED(parametru): parametrul LAMBDA-ului n-a primit valoare.
        if (n.name === 'ISOMITTED') {
          if (n.args.length !== 1) throw new FErr('#N/A');
          const a = n.args[0];
          return a.k === 'name' && omitted.has(a.v);
        }
        // Un LAMBDA singur într-o celulă nu are ce calcula (în Excel: #CALC!).
        if (n.name === 'LAMBDA') throw new FErr('#CALC!');
        const lam = lambdaFn(n, sh);
        if (lam !== null) return lam;
        if (n.name === 'IF') {
          if (n.args.length < 1 || n.args.length > 3) throw new FErr('#N/A');
          const cond = toBool(scalar(evalNode(n.args[0], sh)));
          if (n.args.length === 1) return cond;
          if (cond) return evalNode(n.args[1], sh);
          return n.args[2] ? evalNode(n.args[2], sh) : false;
        }
        if (n.name === 'ISERROR' || n.name === 'ISERR' || n.name === 'ISNA' || n.name === 'IFNA') {
          // Aceste funcții „prind” eroarea primului argument în loc să o dea mai departe.
          if (n.args.length !== (n.name === 'IFNA' ? 2 : 1)) throw new FErr('#N/A');
          let err: FErr | null = null;
          let v: Value = null;
          try {
            v = evalNode(n.args[0], sh);
            const x = scalar(v);
            if (x instanceof FErr) err = x;
          } catch (e) {
            if (!(e instanceof FErr)) throw e;
            err = e;
          }
          // Pe o listă (=SUM(--ISNA(MATCH(B1:B9;…;0)))), câte un răspuns pe element, ca în Excel.
          if (!err && isMulti(v)) {
            const test = (x: Scalar) => (n.name === 'ISERROR' ? x instanceof FErr : n.name === 'ISERR' ? x instanceof FErr && x.code !== '#N/A' : x instanceof FErr && x.code === '#N/A');
            if (n.name !== 'IFNA') return v.map((row) => row.map(test));
            const fb = evalNode(n.args[1], sh);
            return v.map((row, i) => row.map((x, j) => (test(x) ? pick(fb, i, j) : x)));
          }
          if (n.name === 'ISERROR') return err !== null;
          if (n.name === 'ISERR') return err !== null && err.code !== '#N/A';
          if (n.name === 'ISNA') return err?.code === '#N/A';
          if (err?.code === '#N/A') return evalNode(n.args[1], sh);
          if (err) throw err;
          return v;
        }
        if (n.name === 'TYPE' && n.args.length === 1) {
          // TYPE(NA()) = 16: eroarea argumentului e chiar răspunsul, nu se transmite mai departe.
          try { return FUNCS.TYPE([evalNode(n.args[0], sh)]); } catch (e) { if (e instanceof FErr) return 16; throw e; }
        }
        if (n.name === 'SUBTOTAL') {
          // SUBTOTAL(9; B2:B50): ca SUM, dar fără rândurile ascunse de filtru și fără alte SUBTOTAL din zonă.
          if (n.args.length < 2) throw new FErr('#N/A');
          const code = Math.trunc(toNum(scalar(evalNode(n.args[0], sh))));
          const fname = SUBTOTAL_FNS[code > 100 ? code - 100 : code];
          if (!fname) throw new FErr('#VALUE!');
          const vals = n.args.slice(1).map((a): Value => {
            if (a.k !== 'range' && a.k !== 'ref') return evalNode(a, sh);
            const at = a.sh ?? sh;
            const src = others.get(at);
            if (!src) throw new FErr('#REF!');
            const [r1, r2, c1, c2] = a.k === 'ref' ? [a.r, a.r, a.c, a.c] : [a.r1, a.r2, a.c1, a.c2];
            if (r2 >= ROWS || c2 >= COLS) throw new FErr('#REF!');
            const out: Scalar[][] = [];
            for (let r = r1, end = endRow(at, r1, r2); r <= end; r++) {
              if (at === self && hidden?.has(r)) continue;
              const row: Scalar[] = [];
              for (let c = c1; c <= c2; c++) {
                const text = src[cellId(r, c)];
                row.push(text && /SUBTOTAL\s*\(/i.test(text) ? null : cellValue(at, r, c));
              }
              out.push(row);
            }
            return out;
          });
          return FUNCS[fname](vals);
        }
        if (n.name === 'AGGREGATE') {
          // AGGREGATE(funcție; opțiuni; zonă1; [zonă2 sau k]…): ca SUBTOTAL, dar poate sări peste erori.
          // Opțiuni: 0–3 sar peste alte SUBTOTAL / AGGREGATE; 1, 3, 5, 7 peste rândurile ascunse; 2, 3, 6, 7 peste erori.
          if (n.args.length < 3) throw new FErr('#VALUE!');
          const code = Math.trunc(toNum(scalar(evalNode(n.args[0], sh))));
          const fname = AGGREGATE_FNS[code];
          if (!fname) throw new FErr('#VALUE!');
          const ov = scalar(evalNode(n.args[1], sh));
          const opt = ov === null ? 0 : Math.trunc(toNum(ov));
          if (opt < 0 || opt > 7) throw new FErr('#VALUE!');
          const skipNested = opt <= 3, skipHidden = opt % 2 === 1, skipErr = [2, 3, 6, 7].includes(opt);
          const withK = code >= 14;
          if (withK && n.args.length !== 4) throw new FErr('#VALUE!');
          const clean = (g: Scalar[][]) => (skipErr ? g.map((r) => r.map((x) => (x instanceof FErr ? null : x))) : g);
          const zone = (a: Node): Value => {
            if (a.k !== 'range' && a.k !== 'ref') {
              const v = evalNode(a, sh);
              return Array.isArray(v) ? clean(v) : skipErr && v instanceof FErr ? null : v;
            }
            const at = a.sh ?? sh;
            const src = others.get(at);
            if (!src) throw new FErr('#REF!');
            const [r1, r2, c1, c2] = a.k === 'ref' ? [a.r, a.r, a.c, a.c] : [a.r1, a.r2, a.c1, a.c2];
            if (r2 >= ROWS || c2 >= COLS) throw new FErr('#REF!');
            const out: Scalar[][] = [];
            for (let r = r1, end = endRow(at, r1, r2); r <= end; r++) {
              if (skipHidden && at === self && hidden?.has(r)) continue;
              const row: Scalar[] = [];
              for (let c = c1; c <= c2; c++) {
                const text = src[cellId(r, c)];
                row.push(skipNested && text && /(?:SUBTOTAL|AGGREGATE)\s*\(/i.test(text) ? null : cellValue(at, r, c));
              }
              out.push(row);
            }
            return clean(out);
          };
          const vals = withK ? [zone(n.args[2]), evalNode(n.args[3], sh)] : n.args.slice(2).map(zone);
          return FUNCS[fname](vals);
        }
        if (n.name === 'IFS') {
          // IFS(condiție1; valoare1; condiție2; valoare2…): prima condiție adevărată câștigă.
          if (!n.args.length || n.args.length % 2) throw new FErr('#N/A');
          for (let i = 0; i < n.args.length; i += 2) {
            if (toBool(scalar(evalNode(n.args[i], sh)))) return evalNode(n.args[i + 1], sh);
          }
          throw new FErr('#N/A');
        }
        if (n.name === 'IFERROR') {
          if (n.args.length !== 2) throw new FErr('#N/A');
          try {
            const all = evalNode(n.args[0], sh);
            // Pe o listă (=SUM(IFERROR(MATCH(B1:B9;…;0);0))), fiecare element greșit primește valoarea a doua.
            if (isMulti(all)) {
              const fb = all.some((row) => row.some((x) => x instanceof FErr)) ? evalNode(n.args[1], sh) : null;
              return all.map((row, i) => row.map((x, j) => (x instanceof FErr ? pick(fb, i, j) : x)));
            }
            const v = scalar(all);
            if (v instanceof FErr) throw v;
            return v;
          } catch (e) {
            if (!(e instanceof FErr)) throw e;
            return evalNode(n.args[1], sh);
          }
        }
        if (n.name === 'OFFSET') {
          // OFFSET(A1; rânduri; coloane; [înălțime]; [lățime]): zona mutată față de referință (DEPLASARE în Excel românesc).
          const z = refOf(n, sh);
          return evalNode({ k: 'range', r1: z.r1, c1: z.c1, r2: z.r2, c2: z.c2, sh: z.sh }, sh);
        }
        if (n.name === '_SPAN') {
          const z = refOf(n, sh);
          return evalNode(z.r1 === z.r2 && z.c1 === z.c2 ? { k: 'ref', r: z.r1, c: z.c1, sh: z.sh } : { k: 'range', r1: z.r1, c1: z.c1, r2: z.r2, c2: z.c2, sh: z.sh }, sh);
        }
        if (n.name === 'INDIRECT') return evalNode(indirectNode(n, sh), sh);
        if (n.name === 'INDEX' && n.args.length === 3) {
          // Pe o zonă din foaie, INDEX dă celula, rândul sau coloana (SUM(INDEX(A1:C9;0;2)) adună coloana B).
          const a = n.args[0];
          if (a.k === 'ref' || a.k === 'range' || (a.k === 'fn' && (a.name === 'OFFSET' || a.name === 'INDIRECT' || a.name === '_SPAN'))) {
            const z = refOf(n, sh);
            return evalNode(z.r1 === z.r2 && z.c1 === z.c2 ? { k: 'ref', r: z.r1, c: z.c1, sh: z.sh } : { k: 'range', r1: z.r1, c1: z.c1, r2: z.r2, c2: z.c2, sh: z.sh }, sh);
          }
        }
        if (n.name === 'ERROR.TYPE' || n.name === 'ERRORTYPE') {
          // Numărul erorii (1 = #NULL!, 2 = #DIV/0!, 3 = #VALUE!, 4 = #REF!, 5 = #NAME?, 6 = #NUM!, 7 = #N/A); fără eroare: #N/A.
          // ERRORTYPE din LibreOffice dă codurile lui interne (#N/A = 32767, argument greșit = 502, #DIV/0! = 532…).
          if (n.args.length !== 1) throw new FErr('#N/A');
          let err: FErr | null = null;
          try { const x = scalar(evalNode(n.args[0], sh)); if (x instanceof FErr) err = x; } catch (e) { if (!(e instanceof FErr)) throw e; err = e; }
          const i = err ? ['#NULL!', '#DIV/0!', '#VALUE!', '#REF!', '#NAME?', '#NUM!', '#N/A'].indexOf(err.code) : -1;
          if (i < 0) throw new FErr('#N/A');
          return n.name === 'ERRORTYPE' ? [521, 532, 519, 524, 525, 502, 32767][i] : i + 1;
        }
        const tbl = n.args[1];
        if ((n.name === 'VLOOKUP' || n.name === 'HLOOKUP') && n.args.length >= 3 && n.args.length <= 4
          && (tbl.k === 'ref' || tbl.k === 'range' || tbl.k === 'name' || (tbl.k === 'fn' && (tbl.name === 'OFFSET' || tbl.name === '_SPAN')))) {
          // Ca Excel: se citește doar coloana (rândul) de căutare și celula găsită, nu toată zona. Altfel două foi care se
          // caută una pe alta (fără să depindă cu adevărat una de alta) ar ieși „referință circulară”.
          let z: ReturnType<typeof refOf> | null = null;
          try { z = refOf(tbl, sh); } catch { /* un nume care e o valoare, nu o zonă: calculul obișnuit */ }
          if (z) {
            const v = n.name === 'VLOOKUP';
            const k = Math.trunc(toNum(scalar(evalNode(n.args[2], sh))));
            if (k < 1 || k > (v ? z.c2 - z.c1 + 1 : z.r2 - z.r1 + 1)) throw new FErr('#REF!');
            const exact = n.args[3] !== undefined && !toBool(scalar(evalNode(n.args[3], sh)));
            const key = grid(evalNode(v ? { k: 'range', r1: z.r1, c1: z.c1, r2: z.r2, c2: z.c1, sh: z.sh } : { k: 'range', r1: z.r1, c1: z.c1, r2: z.r1, c2: z.c2, sh: z.sh }, sh));
            const one = (x: Scalar) => {
              const i = lookupIndex(x, v ? key.map((r) => r[0]) : (key[0] ?? []), exact ? 0 : 1);
              return v ? cellValue(z!.sh, z!.r1 + i, z!.c1 + k - 1) : cellValue(z!.sh, z!.r1 + k - 1, z!.c1 + i);
            };
            // O zonă / listă căutată dă câte un rezultat pe element (vezi LIFT_FIRST).
            const look = evalNode(n.args[0], sh);
            if (isMulti(look)) {
              if (look.length * (look[0]?.length ?? 0) > 100_000) throw new FErr('#NUM!');
              return look.map((row) => row.map((x) => safeOp(() => scalar(one(x)))));
            }
            return one(scalar(look));
          }
        }
        if (n.name === 'GETPIVOTDATA') return pivotData(n, sh);
        if (n.name === 'INFO') {
          // INFO(fel): câteva date despre program (ca în Excel); „directory” nu are sens aici.
          if (n.args.length !== 1) throw new FErr('#N/A');
          const t = toStr(scalar(evalNode(n.args[0], sh))).trim().toLowerCase();
          const info: Record<string, Scalar> = { numfile: Math.max(1, book?.sheets.length ?? 1), origin: '$A:$A$1', osversion: 'Windows (64-bit) NT 10.00',
            recalc: 'Automatic', release: '16.0', system: 'pcdos' };
          if (t in info) return info[t];
          throw new FErr(['directory', 'memavail', 'memused', 'totmem'].includes(t) ? '#N/A' : '#VALUE!');
        }
        if (n.name === 'SHEET' || n.name === 'SHEETS') {
          // SHEET: numărul foii (1 = prima); SHEETS: câte foi are tabelul.
          if (n.args.length > 1) throw new FErr('#N/A');
          const order = (book?.sheets ?? []).map((x) => sheetKey(x.name));
          if (!order.includes(self)) order.push(self);
          if (n.name === 'SHEETS') { if (n.args.length) { refOf(n.args[0], sh); return 1; } return order.length; }
          const a = n.args[0];
          if (!a) return order.indexOf(sh) + 1 || 1;
          const at = a.k === 'lit' && typeof a.v === 'string' ? sheetKey(a.v) : refOf(a, sh).sh;
          const i = order.indexOf(at);
          if (i < 0) throw new FErr('#N/A');
          return i + 1;
        }
        if (n.name === 'ISFORMULA' || n.name === 'FORMULATEXT' || n.name === 'FORMULA') {
          // Dacă celula are formulă și textul formulei (FORMULA e numele din LibreOffice).
          if (n.args.length !== 1) throw new FErr('#N/A');
          const z = refOf(n.args[0], sh);
          const t = others.get(z.sh)?.[cellId(z.r1, z.c1)] ?? '';
          const isF = t.startsWith('=') && t.length > 1;
          if (n.name === 'ISFORMULA') return isF;
          if (!isF) throw new FErr('#N/A');
          return t;
        }
        if (n.name === 'CELL') {
          // CELL("address" / "row" / "col" / "contents" / "type" / "sheet"; celula).
          if (n.args.length !== 2) throw new FErr('#VALUE!');
          const what = toStr(scalar(evalNode(n.args[0], sh))).toLowerCase();
          const z = refOf(n.args[1], sh);
          const col = cellId(0, z.c1).replace(/\d+$/, '');
          if (what === 'row') return z.r1 + 1;
          if (what === 'col') return z.c1 + 1;
          if (what === 'address') {
            const name = (book?.sheets ?? []).find((x) => sheetKey(x.name) === z.sh)?.name;
            return (z.sh !== sh && name ? sheetRef(name) + '!' : '') + '$' + col + '$' + (z.r1 + 1);
          }
          if (what === 'contents') return cellValue(z.sh, z.r1, z.c1);
          if (what === 'type') {
            const raw = others.get(z.sh)?.[cellId(z.r1, z.c1)];
            if (!raw) return 'b';
            return raw.startsWith('=') ? (typeof cellValue(z.sh, z.r1, z.c1) === 'string' ? 'l' : 'v') : isNumber(raw) ? 'v' : 'l';
          }
          if (what === 'sheet') {
            const i = (book?.sheets ?? []).findIndex((x) => sheetKey(x.name) === z.sh);
            return i + 1 || 1;
          }
          throw new FErr('#VALUE!');
        }
        if (n.name === 'ISREF') {
          // ISREF: argumentul e o referință (celulă, zonă, nume al unei zone, OFFSET, INDIRECT)?
          if (n.args.length !== 1) throw new FErr('#N/A');
          try { refOf(n.args[0], sh); return true; } catch { return false; }
        }
        if (n.name === 'ROW' || n.name === 'COLUMN') {
          // Fără argument: rândul / coloana celulei cu formula.
          if (n.args.length > 1) throw new FErr('#N/A');
          if (!n.args.length) return n.name === 'ROW' ? here.r + 1 : here.c + 1;
          const z = refOf(n.args[0], sh);
          return n.name === 'ROW' ? z.r1 + 1 : z.c1 + 1;
        }
        if (n.name === 'IMAGE') {
          // IMAGE(sursa; [text_alternativ]; [mărime]; [înălțime]; [lățime]): poza o desenează foaia în celula formulei;
          // valoarea celulei e textul alternativ. Sursa: o adresă http / https sau o poză data:image/….
          if (!n.args.length || n.args.length > 5) throw new FErr('#VALUE!');
          const v = n.args.map((a) => scalar(evalNode(a, sh)));
          for (const x of v) if (x instanceof FErr) throw x;
          const src = typeof v[0] === 'string' ? v[0].trim() : '';
          if (!/^(https?:\/\/[^\s]+|data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+)$/i.test(src)) throw new FErr('#VALUE!');
          const alt = v[1] == null ? '' : toStr(v[1]);
          const sizing = v[2] == null ? 0 : toNum(v[2]);
          if (![0, 1, 2, 3].includes(sizing)) throw new FErr('#VALUE!');
          const dim = (x: Scalar | undefined) => {
            if (x == null) return undefined;
            const d = toNum(x);
            if (!(d > 0) || d > 2000) throw new FErr('#VALUE!');
            return Math.round(d);
          };
          const h = dim(v[3]), w = dim(v[4]);
          if (sizing === 3 ? h === undefined && w === undefined : h !== undefined || w !== undefined) throw new FErr('#VALUE!');
          images.set(sh + '!' + cellId(here.r, here.c), { src, alt, sizing: sizing as CellImage['sizing'], ...(h ? { h } : {}), ...(w ? { w } : {}) });
          return alt;
        }
        if (n.name === 'ROWS' || n.name === 'COLUMNS') {
          // Fără argument (LibreOffice primește așa ceva): 0, ca acolo.
          if (!n.args.length) return 0;
          if (n.args.length !== 1) throw new FErr('#N/A');
          const a = n.args[0];
          if (a.k === 'ref' || a.k === 'range' || a.k === 'name' || (a.k === 'fn' && (a.name === 'OFFSET' || a.name === '_SPAN'))) {
            const z = refOf(a, sh);
            return n.name === 'ROWS' ? z.r2 - z.r1 + 1 : z.c2 - z.c1 + 1;
          }
          const g = grid(evalNode(a, sh));
          return n.name === 'ROWS' ? g.length : (g[0]?.length ?? 0);
        }
        if (n.name === 'AREAS') {
          // Câte zone are referința: (A1:B3,F2) are 2; o referință simplă are 1; altceva decât o referință dă #VALUE!.
          if (n.args.length !== 1) throw new FErr('#N/A');
          const a = n.args[0];
          if (a.k === 'fn' && a.name === '_UNION') { for (const x of a.args) refOf(x, sh); return a.args.length; }
          refOf(a, sh);
          return 1;
        }
        if (n.name === '_UNION') throw new FErr('#VALUE!'); // o unire de zone singură, în afara unei funcții
        // În celelalte funcții, unirea (A1:B3,F2) se desface în argumente separate: SUM((A1:B3,F2)) = SUM(A1:B3,F2).
        const args = n.args.some((a) => a.k === 'fn' && a.name === '_UNION')
          ? n.args.flatMap((a) => (a.k === 'fn' && a.name === '_UNION' ? a.args : [a])) : n.args;
        const af = ARR_FUNCS[n.name];
        if (af) return af(args.map((a) => evalNode(a, sh)));
        const f = FUNCS[n.name];
        if (!f) throw new FErr('#NAME?');
        // La SUM, MAX, AVERAGEA… o celulă dată prin referință (=MAX(A1;B2)) se socotește ca o zonă: textul din ea nu dă eroare
        // (se sare, la funcțiile cu A se socotește 0), ca în Excel; doar textul scris direct în formulă se transformă în număr.
        if (REF_ZONE_FNS.has(n.name)) return f(args.map((a) => { const v = evalNode(a, sh); return a.k === 'ref' && !Array.isArray(v) ? [[v]] : v; }));
        // Criteriul care e chiar o eroare (=COUNTIF(A1:A9;1/0)) numără celulele cu acea eroare, nu dă eroarea mai departe.
        const crit = CRIT_ARGS[n.name];
        if (crit) {
          const vals = args.map((a, i) => { if (!crit(i)) return evalNode(a, sh); try { return evalNode(a, sh); } catch (e) { if (e instanceof FErr) return e; throw e; } });
          // O listă de criterii (=SUM(SUMIFS(C:C;A:A;{"a";"b"}))) dă câte un rezultat pe fiecare criteriu, ca în Excel.
          const multi = vals.map((v, i) => crit(i) && isMulti(v));
          if (!multi.some(Boolean)) return f(vals);
          const shape = vals.filter((_, i) => multi[i]).map((v) => grid(v));
          const rows = Math.max(...shape.map((g) => g.length)), cols = Math.max(...shape.map((g) => g[0]?.length ?? 0));
          if (rows * cols > 100_000) throw new FErr('#NUM!');
          return Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => safeOp(() => f(vals.map((v, i) => {
            if (!multi[i]) return v;
            const g = grid(v), x = g.length === 1 ? 0 : r, y = (g[0]?.length ?? 0) === 1 ? 0 : c;
            return x < g.length && y < (g[x]?.length ?? 0) ? g[x][y] : new FErr('#N/A');
          })))));
        }
        if (LIFT_FIRST.has(n.name) && args.length) {
          const vals = args.map((a) => evalNode(a, sh));
          if (!isMulti(vals[0])) return f(vals);
          const g = vals[0];
          if (g.length * (g[0]?.length ?? 0) > 100_000) throw new FErr('#NUM!');
          return g.map((row) => row.map((x) => safeOp(() => scalar(f([x, ...vals.slice(1)])))));
        }
        return f(args.map((a) => evalNode(a, sh)));
      }
    }
  };

  const out: Record<string, Result> = {};
  for (const id of only ?? Object.keys(cells)) {
    const text = cells[id];
    if (!text?.startsWith('=') || text.length < 2) continue;
    const m = /^([A-Z]+)(\d+)$/.exec(id)!;
    const v = cellValue(self, Number(m[2]) - 1, colIndex(m[1]));
    out[id] = toResult(v);
    const img = images.get(self + '!' + id);
    if (img && !out[id].err) out[id].img = img;
  }
  for (const p of anchorsOf(self)) {
    const arr = spilled.get(self + '!' + cellId(p.r, p.c));
    if (!arr) continue;
    arr.forEach((row, i) => row.forEach((x, j) => { if (i || j) out[cellId(p.r + i, p.c + j)] = toResult(x ?? 0); }));
    const a = out[cellId(p.r, p.c)];
    if (a) a.spill = { rows: arr.length, cols: arr[0]?.length ?? 1 };
  }
  return out;
}

/**
 * La import: formulele pe care Suite nu le poate calcula păstrează rezultatul salvat în fișier (`cachedBy`, pe foi).
 * Apoi fiecare formulă înlocuită e încercată din nou, pe rând: cele care greșeau doar din cauza alteia
 * (o sumă peste o celulă cu funcție necunoscută) se calculează acum și rămân formule. Întoarce câte au rămas valori.
 */
export function keepCachedResults(sheets: { name: string; cells: Record<string, string> }[], cachedBy: Record<string, string>[],
  names: DefinedName[] | undefined, isError: (v: string) => boolean, samples?: string[], pivots?: PivotDef[], match?: 'regex', ext?: ExtBook[]): number {
  const book = { self: '', sheets, names, pivots, match, ext };
  const replaced = sheets.map(() => new Map<string, string>());
  const errs = new Map<string, string>();
  sheets.forEach((sh, i) => {
    const res = evaluateAll(sh.cells, { ...book, self: sh.name });
    for (const [id, val] of Object.entries(cachedBy[i] ?? {})) {
      // #BUSY! = WEBSERVICE încă aduce datele: formula rămâne (rezultatul vine imediat), nu se înlocuiește cu valoarea salvată.
      if (res[id]?.err && res[id].err !== '#BUSY!' && !isError(val)) { replaced[i].set(id, sh.cells[id]); sh.cells[id] = val; errs.set(`${i}:${id}`, res[id].err!); }
    }
  });
  // Încercarea a doua (doar când sunt puține, ca importul să rămână rapid).
  if (replaced.reduce((n, m) => n + m.size, 0) <= 2000) {
    sheets.forEach((sh, i) => {
      for (const [id, f] of [...replaced[i]]) {
        sh.cells[id] = f;
        if (evaluateAll(sh.cells, { ...book, self: sh.name }, undefined, [id])[id]?.err) sh.cells[id] = cachedBy[i][id];
        else replaced[i].delete(id);
      }
    });
  }
  // Exemple pentru raportul de compatibilitate: foaia, celula, formula și eroarea pe care o dă la noi.
  if (samples) replaced.forEach((m, i) => { for (const [id, f] of m) if (samples.length < 50) samples.push(`${sheets[i].name}!${id} ${f} → ${errs.get(`${i}:${id}`) ?? '?'}`); });
  return replaced.reduce((n, m) => n + m.size, 0);
}

function toResult(v: Scalar): Result {
  if (v instanceof FErr) return { text: v.code, num: false, err: v.code };
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return { text: '#NUM!', num: false, err: '#NUM!' };
    return { text: formatNumber(v), num: true, value: v };
  }
  if (typeof v === 'boolean') return { text: v ? 'ADEVĂRAT' : 'FALS', num: false };
  return { text: v ?? '', num: false };
}

/** 12.5 → „12,5”; fără zecimale în plus din calculul în virgulă mobilă (0,1+0,2 = 0,3). */
const NUM_RO = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 10, useGrouping: false });

export function formatNumber(n: number): string {
  const clean = Number(n.toPrecision(15));
  // Calea scurtă (de ~50 de ori mai rapidă, contează la tabelele mari): numerele obișnuite doar își schimbă punctul în virgulă.
  const s = String(clean);
  if (/^-?\d+(\.\d{1,10})?$/.test(s)) return s.replace('.', ',');
  return NUM_RO.format(clean);
}

const parsedCache = new Map<string, Node | FErr>();
function parseCached(src: string): Node {
  let n = parsedCache.get(src);
  if (n === undefined) {
    try { n = parse(src); } catch (e) { n = e instanceof FErr ? e : new FErr('#EROARE!'); }
    if (parsedCache.size > 5000) parsedCache.clear();
    parsedCache.set(src, n);
  }
  if (n instanceof FErr) throw n;
  return n;
}

/** Numele de parametri din LET și LAMBDA ale unei formule (cu nameKey), ca la salvarea în .xlsx să primească „_xlpm.”. */
export function lambdaParams(formula: string): Set<string> {
  const out = new Set<string>();
  if (!/(?:LET|LAMBDA)\s*\(/i.test(formula)) return out;
  let root: Node;
  try { root = parseCached(formula.replace(/^=/, '')); } catch { return out; }
  const walk = (n: Node) => {
    if (n.k === 'fn') {
      const params = n.name === 'LAMBDA' ? n.args.slice(0, -1) : n.name === 'LET' ? n.args.filter((_, i) => i % 2 === 0 && i < n.args.length - 1) : [];
      for (const a of params) if (a.k === 'name') out.add(nameKey(a.v));
      n.args.forEach(walk);
    } else if (n.k === 'un' || n.k === 'pct') walk(n.a);
    else if (n.k === 'bin') { walk(n.a); walk(n.b); }
  };
  walk(root);
  return out;
}

// ---------- Unelte pentru editare ----------

// Referințele dintr-o formulă, în afara textelor dintre ghilimele și a numelor de foi dintre apostrofuri.
const REF_ANY = /(\$?)([A-Z]{1,3})(\$?)(\d+)(?![\p{L}\d_(!])/giu;

function mapRefsOutsideStrings(f: string, fn: (m: RegExpExecArray, start: number) => string): string {
  let out = '';
  const parts = f.split(/("(?:[^"]|"")*"?|'(?:[^']|'')*'?)/);
  let offset = 0;
  for (const part of parts) {
    if (part.startsWith('"') || part.startsWith("'")) out += part;
    else {
      out += part.replace(REF_ANY, (...args) => {
        const idx = args[args.length - 2] as number;
        const prev = part[idx - 1];
        if (prev && /[\p{L}\d_.]/u.test(prev)) return args[0];
        const m = Object.assign([...args.slice(0, 5)], { index: idx, input: part }) as unknown as RegExpExecArray;
        return fn(m, offset + idx);
      });
    }
    offset += part.length;
  }
  return out;
}

/** Celulele și zonele din aceeași foaie la care se referă formula (A1, $B$2, A1:C3), pentru urmărirea formulelor. */
export function formulaRanges(f: string): { r0: number; c0: number; r1: number; c1: number }[] {
  if (!f.startsWith('=')) return [];
  const body = f.slice(1);
  const found: { start: number; end: number; r: number; c: number }[] = [];
  mapRefsOutsideStrings(body, (m, start) => {
    if (body[start - 1] === '!') return m[0];
    found.push({ start, end: start + m[0].length, r: Number(m[4]) - 1, c: colIndex(m[2]) });
    return m[0];
  });
  const out: { r0: number; c0: number; r1: number; c1: number }[] = [];
  for (let i = 0; i < found.length; i++) {
    const a = found[i], b = found[i + 1];
    if (b && body.slice(a.end, b.start) === ':') {
      out.push({ r0: Math.min(a.r, b.r), c0: Math.min(a.c, b.c), r1: Math.max(a.r, b.r), c1: Math.max(a.c, b.c) });
      i++;
    } else out.push({ r0: a.r, c0: a.c, r1: a.r, c1: a.c });
  }
  return out.filter((x) => x.r0 >= 0 && x.c0 >= 0);
}

/** La lipirea unei formule mutate cu (dr, dc), referințele fără „$” se mută și ele, ca în Excel. */
export function shiftFormula(f: string, dr: number, dc: number): string {
  if (!f.startsWith('=') || (!dr && !dc)) return f;
  return '=' + mapRefsOutsideStrings(f.slice(1), (m) => {
    const [, cAbs, col, rAbs, row] = m;
    const c = cAbs ? colIndex(col) : colIndex(col) + dc;
    const r = rAbs ? Number(row) - 1 : Number(row) - 1 + dr;
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return '#REF!';
    return `${cAbs}${cellId(0, c).replace(/\d+$/, '')}${rAbs}${r + 1}`;
  });
}

/**
 * Tasta F4: referința de lângă cursor trece prin A1 → $A$1 → A$1 → $A1 → A1.
 * Întoarce textul nou și poziția cursorului, sau null dacă cursorul nu e pe o referință.
 */
export function cycleRef(f: string, caret: number): { text: string; caret: number } | null {
  if (!f.startsWith('=')) return null;
  let result: { text: string; caret: number } | null = null;
  mapRefsOutsideStrings(f.slice(1), (m, start) => {
    const s = start + 1;
    const e = s + m[0].length;
    if (!result && caret >= s && caret <= e) {
      const [, cAbs, col, rAbs, row] = m;
      const next = cAbs && rAbs ? `${col}$${row}` : !cAbs && rAbs ? `$${col}${row}` : cAbs ? `${col}${row}` : `$${col}$${row}`;
      const text = f.slice(0, s) + next + f.slice(e);
      result = { text, caret: s + next.length };
    }
    return m[0];
  });
  return result;
}

/** După redenumirea unei foi, formulele care o foloseau primesc numele nou (=Vechi!A1 → =Nou!A1), ca în Excel. */
export function renameSheetInFormula(f: string, from: string, to: string): string {
  if (!f.startsWith('=') || !f.includes('!')) return f;
  const key = sheetKey(from);
  // Cele două capete ale unei referințe pe mai multe foi, cu cel redenumit schimbat; ghilimele dacă vreunul le cere.
  const both = (a: string, b: string) => {
    const [x, y] = [a, b].map((s) => (sheetKey(s) === key ? to : s));
    return sheetRef(x) === x && sheetRef(y) === y ? `${x}:${y}` : `'${`${x}:${y}`.replace(/'/g, "''")}'`;
  };
  let out = '=';
  let i = 1;
  while (i < f.length) {
    const ch = f[i];
    if (ch === '"') {
      let j = i + 1;
      while (j < f.length) {
        if (f[j] === '"') { if (f[j + 1] === '"') { j += 2; continue; } j++; break; }
        j++;
      }
      out += f.slice(i, j);
      i = j;
      continue;
    }
    if (ch === "'") {
      const q = quotedName(f, i);
      const two = q.name.split(':');
      // 'Foaia 1:Foaia 3'!: referința pe mai multe foi, cu oricare capăt redenumit.
      if (f[q.end] === '!' && two.length === 2 && two.some((x) => sheetKey(x) === key)) out += both(two[0], two[1]);
      else out += f[q.end] === '!' && sheetKey(q.name) === key ? sheetRef(to) : f.slice(i, q.end);
      i = q.end;
      continue;
    }
    const m = /^[\p{L}_][\p{L}\d_.]*/u.exec(f.slice(i));
    // Foaie1:Foaie3!: referința pe mai multe foi, fără ghilimele.
    const m2 = m && f[i + m[0].length] === ':' ? /^[\p{L}_][\p{L}\d_.]*(?=!)/u.exec(f.slice(i + m[0].length + 1)) : null;
    if (m && m2 && [m[0], m2[0]].some((x) => sheetKey(x) === key)) {
      out += both(m[0], m2[0]);
      i += m[0].length + 1 + m2[0].length;
      continue;
    }
    if (m) {
      out += f[i + m[0].length] === '!' && sheetKey(m[0]) === key ? sheetRef(to) : m[0];
      i += m[0].length;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/** Redenumește un nume definit în formulă (=B2*TVA → =B2*TVA_RO); textele, numele de foi, funcțiile și coloanele de tabel rămân neatinse. */
export function renameNameInFormula(f: string, from: string, to: string): string {
  if (!f.startsWith('=')) return f;
  const key = nameKey(from);
  let out = '=';
  let i = 1;
  while (i < f.length) {
    const ch = f[i];
    if (ch === '"') {
      let j = i + 1;
      while (j < f.length) {
        if (f[j] === '"') { if (f[j + 1] === '"') { j += 2; continue; } j++; break; }
        j++;
      }
      out += f.slice(i, j);
      i = j;
      continue;
    }
    if (ch === "'") {
      const q = quotedName(f, i);
      out += f.slice(i, q.end);
      i = q.end;
      continue;
    }
    if (ch === '[') {
      // Coloanele unui tabel: Vânzări[Preț] sau [@Preț] (cu paranteze în paranteze).
      let depth = 0, j = i;
      for (; j < f.length; j++) { if (f[j] === '[') depth++; else if (f[j] === ']' && --depth === 0) { j++; break; } }
      out += f.slice(i, j);
      i = j;
      continue;
    }
    const m = /^[\p{L}_][\p{L}\d_.]*/u.exec(f.slice(i));
    if (m) {
      const after = f[i + m[0].length];
      out += nameKey(m[0]) === key && after !== '(' && after !== '!' && after !== '[' ? to : m[0];
      i += m[0].length;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}
