// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Extrasul de cont (exportul CSV / tabelul unei bănci) → tabel curat: Data, Partener, Descriere, Încasări, Plăți, Sold, Categorie, Luna,
// plus o foaie Rezumat pe luni și categorii, o foaie Parteneri (totalurile pe fiecare client / furnizor) (cu formule, ca o categorie schimbată de mână să schimbe și rezumatul).
// Băncile din România își scriu extrasele diferit; aici recunoaștem coloanele după numele lor (în română sau engleză), fără să
// știm banca: o coloană de sumă cu semn sau două (debit / credit), datele în mai multe forme, numerele cu virgulă sau cu punct.
// (Formatele urmărite, doar pentru noi: exporturile CSV ale băncilor mari din România, cu antet pe câteva rânduri deasupra tabelului.)
import { emptySheet, emptySheetDoc } from './format';
import type { CellStyle, Sheet, SheetDoc } from './format';

export interface BankTx {
  /** AAAA-LL-ZZ */
  date: string;
  /** Clientul / furnizorul / persoana (din coloana lui sau din fața contului IBAN din descriere); gol la comisioane, numerar etc. */
  partner: string;
  desc: string;
  /** Intrări în cont (pozitiv) */
  credit: number;
  /** Ieșiri din cont (pozitiv) */
  debit: number;
  /** Soldul după operațiune, dacă extrasul îl are. */
  balance: number | null;
  category: string;
}

export interface BankRead { txs: BankTx[]; currency: string; warnings: string[]; printed?: BankPrinted }

const plain = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Numele coloanelor (fără diacritice, litere mici). Ordinea contează: primele sunt cele mai sigure.
const COLS = {
  date: [/^data( (tranzactiei|tranzactie|operatiunii|operatiei|inregistrarii|inregistrare|contabila|contabilizarii|procesarii))?$/, /^(booking|transaction|posting|value) date$/, /^date$/, /^data valutei$/, /^data/],
  desc: [/^(descriere|detalii|explicatii|explicatie|detalii tranzactie|descrierea tranzactiei|description|details|narrative|mentiuni)/, /^(beneficiar|ordonator|partener|contrapartida|payee|counterparty)/],
  amount: [/^(suma|valoare|amount|sum|valoarea)( tranzactiei| operatiunii| \(.*\))?$/],
  debit: [/^(debit|suma debit|debitare|retrageri|plati|iesiri|cheltuieli|withdrawals?|debit amount|paid out)/],
  credit: [/^(credit|suma credit|creditare|depuneri|incasari|intrari|deposits?|credit amount|paid in)/],
  balance: [/^(sold|balance|soldul|sold final|sold disponibil|running balance)/],
  type: [/^(tip|tipul|debit\/credit|d\/c|type|sens)$/],
  currency: [/^(moneda|valuta|currency|ccy)$/],
};

function findCol(head: string[], pats: RegExp[], skip: Set<number>): number {
  for (const p of pats) {
    const i = head.findIndex((h, j) => !skip.has(j) && p.test(h));
    if (i >= 0) return i;
  }
  return -1;
}

/** „1.234,56”, „1,234.56”, „-123.45”, „123,45 RON”, „(12,00)” → număr; gol / text → NaN. */
export function parseAmount(s: string): number {
  let t = s.replace(/[\s ]/g, '').replace(/(lei|ron|eur|usd|gbp|chf)$/i, '').replace(/^(lei|ron|eur|usd|gbp|chf)/i, '');
  let neg = false;
  if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1); }
  if (/^[-−–]/.test(t)) { neg = true; t = t.slice(1); } else if (/-$/.test(t)) { neg = true; t = t.slice(0, -1); }
  t = t.replace(/^\+/, '');
  if (!/^[\d.,']+$/.test(t) || !/\d/.test(t)) return NaN;
  const lastC = t.lastIndexOf(','), lastD = t.lastIndexOf('.');
  // Separatorul zecimal e ultimul dintre „,” și „.”, dacă are 1–2 cifre după el (sau dacă e singurul fel de separator, nu de mii).
  let dec = '';
  if (lastC >= 0 && lastD >= 0) dec = lastC > lastD ? ',' : '.';
  else if (lastC >= 0) dec = /,\d{3}$/.test(t) && (t.match(/,/g) ?? []).length > 1 ? '' : /,\d{1,2}$/.test(t) || !/,\d{3}$/.test(t) ? ',' : '';
  else if (lastD >= 0) dec = /\.\d{3}$/.test(t) && (t.match(/\./g) ?? []).length > 1 ? '' : /\.\d{3}$/.test(t) ? '' : '.';
  const grp = dec === ',' ? /[.']/g : dec === '.' ? /[,']/g : /[.,']/g;
  t = t.replace(grp, '');
  if (dec === ',') t = t.replace(',', '.');
  const v = Number(t);
  return Number.isFinite(v) ? (neg ? -v : v) : NaN;
}

const MONTHS: Record<string, number> = {
  ian: 1, jan: 1, feb: 2, mar: 3, apr: 4, mai: 5, may: 5, iun: 6, jun: 6, iul: 7, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, noi: 11, nov: 11, dec: 12,
};

/** „26.10.2026”, „26/10/2026”, „2026-10-26”, „26-10-2026”, „26 oct 2026”, „26.10.26” (cu sau fără oră) → „2026-10-26”; altfel ''. */
export function parseBankDate(s: string): string {
  const t = plain(s).replace(/[ t]\d{1,2}:\d{2}(:\d{2})?.*$/, '').trim();
  const pad = (n: number) => String(n).padStart(2, '0');
  const ok = (y: number, m: number, d: number) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : '');
  let m = /^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/.exec(t);
  if (m) return ok(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[-./](\d{1,2})[-./](\d{2}|\d{4})$/.exec(t);
  if (m) return ok(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  m = /^(\d{1,2})[ -.]?([a-z]{3,})\.?[ -.]?(\d{4})$/.exec(t);
  if (m && MONTHS[m[2].slice(0, m[2].startsWith('sept') ? 4 : 3)]) return ok(+m[3], MONTHS[m[2].slice(0, m[2].startsWith('sept') ? 4 : 3)], +m[1]);
  return '';
}

/** Regulile de categorii: cuvântul căutat în descriere (fără diacritice, oriunde) → categoria. Prima potrivire câștigă. */
export const DEFAULT_RULES: [string, string][] = [
  ['salariu', 'Salariu'],
  // Impozitele pe salarii / chirii (plătite la trezorerie, la bugetul de stat) sunt taxe, nu salarii: înainte de „salar” și „chirie”.
  ['impozit', 'Taxe și impozite'], ['trezorer', 'Taxe și impozite'], ['bugetul de stat', 'Taxe și impozite'], ['buget de stat', 'Taxe și impozite'],
  ['contributii', 'Taxe și impozite'], ['amenda', 'Taxe și impozite'],
  ['salar', 'Salariu'], ['indemnizatie', 'Salariu'], ['pensie', 'Pensie'],
  ['chirie', 'Chirie'],
  ['comision', 'Comisioane bancare'], ['taxa administrare', 'Comisioane bancare'], ['taxa lunara', 'Comisioane bancare'],
  ['dobanda', 'Dobânzi'],
  ['energie', 'Utilități'], ['electric', 'Utilități'], ['gaz', 'Utilități'], ['apa ', 'Utilități'], ['canal', 'Utilități'], ['internet', 'Utilități'],
  ['telefon', 'Utilități'], ['abonament', 'Utilități'], ['intretinere', 'Utilități'], ['salubr', 'Utilități'],
  ['carburant', 'Transport'], ['benzin', 'Transport'], ['motorina', 'Transport'], ['parcare', 'Transport'], ['rovinieta', 'Transport'], ['taxi', 'Transport'],
  ['farmacie', 'Sănătate'], ['clinica', 'Sănătate'], ['spital', 'Sănătate'],
  ['retragere numerar', 'Numerar'], ['retragere atm', 'Numerar'], ['atm', 'Numerar'], ['depunere numerar', 'Numerar'],
  ['rata credit', 'Credite'], ['rata', 'Credite'], ['leasing', 'Credite'],
  ['asigurare', 'Asigurări'], ['rca', 'Asigurări'],
  ['supermarket', 'Cumpărături'], ['market', 'Cumpărături'], ['magazin', 'Cumpărături'], ['pos', 'Cumpărături'], ['plata card', 'Cumpărături'], ['card', 'Cumpărături'],
  ['transfer', 'Transferuri'], ['ordin de plata', 'Transferuri'], ['op ', 'Transferuri'], ['virament', 'Transferuri'], ['incasare', 'Încasări'],
];

/** Categoria unei operațiuni după reguli; fără potrivire: „Alte încasări” / „Alte plăți”. */
export function categorize(desc: string, isCredit: boolean, rules: [string, string][] = DEFAULT_RULES): string {
  const d = ` ${plain(desc)} `;
  for (const [w, c] of rules) {
    const k = plain(w);
    // Cuvintele scurte (atm, pos, rca, op) doar ca vorbe întregi, ca „pos” să nu prindă „depozit”.
    const hit = k.length <= 4 && !k.endsWith(' ') ? new RegExp(`(^|[^a-z0-9])${k}([^a-z0-9]|$)`).test(d) : d.includes(w.endsWith(' ') ? ` ${k} ` : k);
    if (hit) return c;
  }
  return isCredit ? 'Alte încasări' : 'Alte plăți';
}

// Coloanele cu numele celuilalt (Beneficiar, Ordonator, Partener...), când banca le dă separat de descriere.
const PARTNER_COL = /^(beneficiar|ordonator|partener|contrapartida|platitor|payee|payer|counterparty|nume)/;
// Un cont IBAN (RO49AAAA1B31007593840000) sau contul trezoreriei, în descriere.
const IBAN = /\b[A-Z]{2}\d{2}[A-Z]{4}[A-Z0-9]{8,26}\b/;

/** Descrierea unei operațiuni → numele partenerului și restul. La multe bănci descrierea începe cu numele celuilalt,
 *  urmat de contul lui IBAN, de banca lui și de detaliile plății („ALFA TRADE S R L RO49… Incasare factura 12”). Fără cont IBAN
 *  (comisioane, numerar, card) partenerul rămâne gol. */
export function splitPartner(desc: string): { partner: string; rest: string } {
  const m = IBAN.exec(desc);
  if (!m || m.index === 0) return { partner: '', rest: desc };
  let name = desc.slice(0, m.index).trim();
  // „Plata factura catre FIRMA X” / „Incasare de la FIRMA X”: doar numele de după „catre” / „de la”.
  const to = /^(.*?\b(catre|către|de la|from|to|beneficiar|ordonator)\s*:?\s+)(.+)$/i.exec(name);
  if (to && /^(plata|plată|incasare|încasare|transfer|ordin|op|virament|payment)\b/i.test(name)) name = to[3];
  // Codul fiscal lipit de nume („Trezoreria Exemplu/1234567”) nu face parte din nume.
  name = name.replace(/\s*\/\s*\d+$/, '').replace(/[\s,;:·-]+$/, '').trim();
  if (!/\p{L}{2}/u.test(name) || name.length > 90) return { partner: '', rest: desc };
  return { partner: name, rest: desc.slice(m.index).trim() };
}

/** Coloanele găsite într-un rând, dacă rândul e antetul tabelului (are Data și Suma, sau Debit și Credit); altfel null. */
function headerCols(row: string[]) {
  const head = row.map(plain);
  const used = new Set<number>();
  const take = (k: keyof typeof COLS) => { const i = findCol(head, COLS[k], used); if (i >= 0) used.add(i); return i; };
  const c = { date: take('date'), debit: -1, credit: -1, amount: -1, balance: -1, desc: -1, type: -1, currency: -1 };
  c.debit = take('debit'); c.credit = take('credit'); c.amount = take('amount'); c.balance = take('balance');
  c.desc = take('desc'); c.type = take('type'); c.currency = take('currency');
  return c.date >= 0 && (c.amount >= 0 || (c.debit >= 0 && c.credit >= 0)) ? c : null;
}

/** Cât de sigur e un antet: câte coloane cunoscute are. Unele extrase au deasupra un mic rezumat cu „Data / Număr / Suma”:
 *  tabelul adevărat (Data, Descriere, Debit, Credit, Sold) are mai multe și câștigă. */
function headerScore(c: ReturnType<typeof headerCols>) {
  return c ? [c.date, c.desc, c.amount, c.debit, c.credit, c.balance].filter((i) => i >= 0).length : 0;
}

/** Totalurile și soldurile scrise în extras (în rezumatul de deasupra tabelului sau în rândul Total), ca să le comparăm. */
export interface BankPrinted { credit: number | null; debit: number | null; opening: number | null; closing: number | null }

function lastAmount(cells: string[]): number {
  const toks = cells.join(' ').split(/\s+/).reverse();
  for (const t of toks) {
    // Numai sume cu zecimale („12,500.00”, „1.234,56”): numărul de operațiuni de lângă etichetă nu e o sumă.
    if (!/[.,]\d{2}\)?$/.test(t)) continue;
    const v = parseAmount(t);
    if (Number.isFinite(v)) return v;
  }
  return NaN;
}

/** O bucată de text din pagina unui PDF (din pdf.js): x, y = colțul din stânga-jos (y crește în sus), w = lățimea, h = înălțimea literelor. */
export interface PdfWord { str: string; x: number; y: number; w: number; h: number; page: number }

/**
 * Textul unui extras PDF → rândurile tabelului, ca la CSV. PDF-ul nu are tabel, doar bucăți de text puse la poziții:
 * le strângem în rânduri după înălțime, apoi în coloane după rândul de antet (fiecare bucată merge la coloana de sub care
 * se află cel mai mult). Antetul repetat pe paginile următoare, ce e deasupra lui (antetul băncii) și numerele de pagină se sar.
 */
export function pdfToRows(words: PdfWord[]): string[][] {
  type Seg = { text: string; x0: number; x1: number };
  type Line = { page: number; y: number; h: number; segs: Seg[] };
  const lines: Line[] = [];
  const pages = [...new Set(words.map((w) => w.page))].sort((a, b) => a - b);
  for (const p of pages) {
    const ws = words.filter((w) => w.page === p && w.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
    const pl: { y: number; h: number; ws: PdfWord[] }[] = [];
    for (const w of ws) {
      const l = pl.find((q) => Math.abs(q.y - w.y) <= Math.max(2, 0.45 * Math.max(q.h, w.h)));
      if (l) l.ws.push(w); else pl.push({ y: w.y, h: w.h || 10, ws: [w] });
    }
    for (const l of pl) {
      l.ws.sort((a, b) => a.x - b.x);
      const segs: Seg[] = [];
      for (const w of l.ws) {
        const s = segs[segs.length - 1];
        const gap = s ? w.x - s.x1 : Infinity;
        const h = w.h || l.h;
        // Literele aceleiași coloane sunt la cel mult un spațiu mai mare; între coloane e loc mai mult.
        if (s && gap < Math.max(2, 0.9 * h)) { s.text += (gap > 0.12 * h && !/\s$/.test(s.text) ? ' ' : '') + w.str; s.x1 = Math.max(s.x1, w.x + w.w); }
        else segs.push({ text: w.str, x0: w.x, x1: w.x + w.w });
      }
      for (const s of segs) s.text = s.text.replace(/\s+/g, ' ').trim();
      lines.push({ page: p, y: l.y, h: l.h, segs: segs.filter((s) => s.text) });
    }
  }
  const out: string[][] = [];
  const texts = (segs: Seg[]) => segs.map((s) => s.text);
  // Antetul tabelului: un rând, sau două rânduri apropiate (unele bănci scriu titlurile pe două rânduri, de exemplu
  // „Data procesării” deasupra lui „Referința băncii” și „Beneficiar” deasupra lui „Descriere”). Câștigă antetul cu cele
  // mai multe coloane cunoscute (un rezumat mic „Data / Număr / Suma” de deasupra tabelului pierde); la egalitate, primul.
  const isValue = (t: string) => !!parseBankDate(t) || Number.isFinite(parseAmount(t));
  const mergeHead = (a: Seg[], b: Seg[]) => {
    const segs = a.map((s) => ({ ...s }));
    for (const s of b) {
      const t = segs.find((q) => Math.min(q.x1, s.x1) - Math.max(q.x0, s.x0) > 0);
      if (t) { t.text += ' ' + s.text; t.x0 = Math.min(t.x0, s.x0); t.x1 = Math.max(t.x1, s.x1); } else segs.push({ ...s });
    }
    return segs.sort((p, q) => p.x0 - q.x0);
  };
  let hi = -1, hn = 1, best = 0;
  let head: Seg[] = [];
  lines.forEach((l, i) => {
    const one = headerScore(headerCols(texts(l.segs)));
    if (one > best) { best = one; hi = i; hn = 1; head = l.segs; }
    const n = lines[i + 1];
    if (n && n.page === l.page && l.y - n.y > 0 && l.y - n.y <= 2.6 * l.h && ![...l.segs, ...n.segs].some((s) => isValue(s.text))) {
      const m = mergeHead(l.segs, n.segs);
      const two = headerScore(headerCols(texts(m)));
      if (two > best) { best = two; hi = i; hn = 2; head = m; }
    }
  });
  if (hi < 0) return lines.map((l) => texts(l.segs));
  const key = plain(texts(lines[hi].segs).join(' '));
  const cols = headerCols(texts(head))!;
  // Marginile coloanelor: la mijlocul spațiului dintre două titluri de coloană.
  const edge = head.map((s, i) => (i ? (head[i - 1].x1 + s.x0) / 2 : -Infinity));
  const colOf = (s: Seg) => {
    let best = 0, bestOv = -Infinity;
    head.forEach((_, i) => {
      const a = edge[i], b = i + 1 < head.length ? edge[i + 1] : Infinity;
      const ov = Math.min(s.x1, b) - Math.max(s.x0, a);
      if (ov > bestOv) { bestOv = ov; best = i; }
    });
    return best;
  };
  // Ce e deasupra tabelului (antetul băncii, titularul, un eventual rezumat cu totaluri) rămâne câte un rând dintr-o bucată:
  // așa nu poate fi luat drept antetul tabelului, dar totalurile scrise acolo se pot compara cu operațiunile.
  for (const l of lines.slice(0, hi)) out.push([texts(l.segs).join(' ')]);
  out.push(texts(head));
  const start = hi + hn;
  const dA = edge[cols.date], dB = cols.date + 1 < head.length ? edge[cols.date + 1] : Infinity;
  const inDate = (s: Seg) => s.x0 >= dA && s.x0 < dB;
  // Pe paginile următoare, tot ce e deasupra antetului repetat (antetul băncii, titlul) se sare.
  const repeatAt = new Map<number, number>();
  lines.forEach((l, i) => { if (i >= start && plain(texts(l.segs).join(' ')) === key && !repeatAt.has(l.page)) repeatAt.set(l.page, i + hn - 1); });
  // Când antetul tabelului nu se repetă, antetul băncii de pe fiecare pagină (același text, la aceeași înălțime, pe mai
  // multe pagini) se sare dacă e deasupra primei operațiuni a paginii. Textul de sus care nu se repetă (continuarea
  // descrierii de pe pagina dinainte) rămâne.
  const posKey = (l: Line) => `${Math.round(l.y / 2)}|${plain(texts(l.segs).join(' '))}`;
  const onPages = new Map<string, Set<number>>();
  for (const l of lines) { const k = posKey(l); if (!onPages.has(k)) onPages.set(k, new Set()); onPages.get(k)!.add(l.page); }
  const firstTx = new Map<number, number>();
  lines.forEach((l, i) => { if (i >= start && !firstTx.has(l.page) && l.segs.some((s) => inDate(s) && parseBankDate(s.text))) firstTx.set(l.page, i); });
  lines.forEach((l, i) => {
    if (i < start) return;
    const rep = repeatAt.get(l.page);
    if (rep !== undefined && i <= rep) return;
    if (i < (firstTx.get(l.page) ?? Infinity) && onPages.get(posKey(l))!.size > 1) return;
    const txt = plain(texts(l.segs).join(' '));
    if (/^(pagina|pag\.?|page) ?\d+( ?(\/|\\|din|of) ?\d+)?$/.test(txt) || /^\d+ ?(\/|\\|din|of) ?\d+$/.test(txt)) return;
    const row: string[] = head.map(() => '');
    const inCol: Seg[][] = head.map(() => []);
    for (const s of l.segs) { const c = colOf(s); inCol[c].push(s); row[c] = row[c] ? `${row[c]} ${s.text}` : s.text; }
    // Un rând fără dată care începe în coloana Data și trece peste ea nu e continuarea descrierii (e text de sub tabel,
    // chiar dacă e lung și trece peste coloana Descriere): îl lăsăm doar acolo, ca să fie sărit.
    const off = l.segs.some((s) => (inDate(s) || inCol[cols.date].includes(s)) && !parseBankDate(s.text) && s.x1 > dB + 2);
    if (off) {
      const only = head.map(() => '');
      only[cols.date] = texts(l.segs).join(' ');
      out.push(only);
      return;
    }
    // Un text scurt, cuprins în coloana Data (numărul de referință scris de bancă sub dată): nu e din descriere; restul
    // rândului (descrierea de pe al doilea rând) rămâne.
    if (row[cols.date] && !parseBankDate(row[cols.date])) row[cols.date] = '';
    out.push(row);
  });
  return out;
}

/** Rândurile unui extras (din CSV sau din foaia unui .xlsx) → operațiunile. Antetul tabelului se caută în primele 40 de rânduri. */
export function readStatement(rows: string[][], rules: [string, string][] = DEFAULT_RULES): BankRead {
  const warnings: string[] = [];
  let hr = -1;
  let cols = { date: -1, desc: -1, amount: -1, debit: -1, credit: -1, balance: -1, type: -1, currency: -1 };
  let best = 0;
  for (let r = 0; r < Math.min(rows.length, 40); r++) {
    const c = headerCols(rows[r]);
    const sc = headerScore(c);
    if (c && sc > best) { hr = r; cols = c; best = sc; }
  }
  if (hr < 0) throw new Error('Nu găsesc tabelul cu operațiuni: trebuie un rând de antet cu Data și cu Suma (sau Debit și Credit).');
  // Descrierea: coloana găsită, plus celelalte coloane de text nefolosite (beneficiar, detalii), lipite.
  const known = new Set(Object.values(cols).filter((i) => i >= 0));
  const partnerCol = rows[hr].findIndex((h, i) => !known.has(i) && PARTNER_COL.test(plain(h ?? '')));
  if (partnerCol >= 0) known.add(partnerCol);
  const extra = rows[hr].map((_, i) => i).filter((i) => !known.has(i) && /^(beneficiar|ordonator|partener|contrapartida|detalii|referinta|payee|counterparty|nume)/.test(plain(rows[hr][i] ?? '')));
  const txs: BankTx[] = [];
  const curs = new Set<string>();
  let skipped = 0;
  for (const row of rows.slice(hr + 1)) {
    const g = (i: number) => (i >= 0 ? (row[i] ?? '').trim() : '');
    // În coloana Data, un număr ca 46296 e ziua din calendarul foilor de calcul (din .xlsx fără formatul de dată).
    const dv = g(cols.date);
    const date = parseBankDate(dv) || (/^\d{5}(\.\d+)?$/.test(dv) && +dv > 30000 && +dv < 80000
      ? new Date(Date.UTC(1899, 11, 30) + Math.floor(+dv) * 86400000).toISOString().slice(0, 10) : '');
    if (!date) {
      // Rândurile fără dată: continuarea descrierii operațiunii de mai sus (la unele bănci) sau totaluri / rânduri goale.
      const more = [g(cols.desc), ...extra.map(g)].filter(Boolean).join(' ');
      const morePartner = g(partnerCol);
      const hasMoney = [cols.amount, cols.debit, cols.credit].some((i) => Number.isFinite(parseAmount(g(i))));
      if (txs.length && more && !hasMoney) {
        const t = txs[txs.length - 1];
        // Un cuvânt rupt la cratimă la capăt de rând („a1b2c3d4-e5f6-” + „7a8b-…”) se lipește fără spațiu.
        t.desc = (t.desc + (/[\p{L}\d]-$/u.test(t.desc) ? '' : ' ') + more).trim();
        if (morePartner) t.partner = (t.partner + ' ' + morePartner).trim();
      } else if (txs.length && morePartner && !hasMoney) txs[txs.length - 1].partner = (txs[txs.length - 1].partner + ' ' + morePartner).trim();
      else if (row.some((x) => x.trim())) skipped++;
      continue;
    }
    let credit = 0, debit = 0;
    if (cols.debit >= 0 && cols.credit >= 0) {
      debit = Math.abs(parseAmount(g(cols.debit)) || 0);
      credit = Math.abs(parseAmount(g(cols.credit)) || 0);
    } else {
      const v = parseAmount(g(cols.amount));
      if (!Number.isFinite(v)) { skipped++; continue; }
      const t = plain(g(cols.type));
      const out = t ? /^(d|debit|plata|iesire|out|dr)/.test(t) : v < 0;
      if (out) debit = Math.abs(v); else credit = Math.abs(v);
    }
    if (!debit && !credit) { skipped++; continue; }
    const desc = [g(cols.desc), ...extra.map(g)].filter(Boolean).join(' · ').replace(/\s+/g, ' ');
    const bal = parseAmount(g(cols.balance));
    if (cols.currency >= 0 && g(cols.currency)) curs.add(g(cols.currency).toUpperCase());
    txs.push({ date, partner: g(partnerCol).replace(/\s+/g, ' '), desc, credit: r2(credit), debit: r2(debit), balance: Number.isFinite(bal) ? bal : null, category: '' });
  }
  // Fără coloană separată: partenerul se scoate din descriere, după ce s-au lipit și rândurile ei de continuare.
  if (partnerCol < 0) for (const t of txs) { const sp = splitPartner(t.desc); t.partner = sp.partner; t.desc = sp.rest; }
  for (const t of txs) t.category = categorize(`${t.partner} ${t.desc}`, t.credit > 0, rules);
  // Unele bănci scriu operațiunile de la cea mai nouă la cea mai veche: le punem în ordinea zilelor (stabil, cu ordinea din fișier).
  if (txs.length > 1 && txs[0].date > txs[txs.length - 1].date) txs.reverse();
  if (skipped) warnings.push(`${skipped} rânduri fără dată sau sumă au fost sărite (totaluri, rânduri goale).`);
  // Totalurile scrise în extras (rezumatul de sus sau rândul Total de sub tabel) și soldul inițial: dacă nu se potrivesc
  // cu operațiunile citite, spunem (poate s-a pierdut un rând).
  const printed: BankPrinted = { credit: null, debit: null, opening: null, closing: null };
  const g2 = (row: string[], i: number) => (i >= 0 ? (row[i] ?? '').trim() : '');
  rows.forEach((row, r) => {
    // Operațiunile adevărate (cu dată și sumă) nu sunt rânduri de total, chiar dacă descrierea începe cu „Total”.
    if (r > hr && parseBankDate(g2(row, cols.date)) && [cols.amount, cols.debit, cols.credit].some((i) => Number.isFinite(parseAmount(g2(row, i))))) return;
    const label =plain(row.join(' ')).replace(/^\d{1,4}[./-]\d{1,2}[./-]\d{1,4} /, '');
    const v = lastAmount(row);
    const set = (k: keyof BankPrinted, x: number) => { if (printed[k] === null && Number.isFinite(x)) printed[k] = x; };
    if (/^(total|rulaj)(ul)? (creditari|credit|incasari|intrari|depuneri|sume creditate)\b/.test(label)) set('credit', Math.abs(v));
    else if (/^(total|rulaj)(ul)? (debitari|debit|plati|iesiri|retrageri|sume debitate)\b/.test(label)) set('debit', Math.abs(v));
    else if (/^sold(ul)? (initial|anterior|de deschidere|precedent|la inceputul)/.test(label)) set('opening', v);
    else if (/^sold(ul)? (final|de inchidere|la sfarsitul)/.test(label)) set('closing', v);
    else if (r > hr && /^(total|rulaje)/.test(plain([g2(row, cols.desc), g2(row, cols.date)].join(' ').trim())) && cols.debit >= 0 && cols.credit >= 0) {
      set('debit', Math.abs(parseAmount(g2(row, cols.debit))));
      set('credit', Math.abs(parseAmount(g2(row, cols.credit))));
    }
  });
  const sumC = r2(txs.reduce((a, t) => a + t.credit, 0)), sumD = r2(txs.reduce((a, t) => a + t.debit, 0));
  const f2 = (x: number) => x.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (txs.length && printed.credit !== null && Math.abs(printed.credit - sumC) > 0.005) warnings.push(`Totalul încasărilor scris în extras (${f2(printed.credit)}) nu se potrivește cu suma operațiunilor citite (${f2(sumC)}).`);
  if (txs.length && printed.debit !== null && Math.abs(printed.debit - sumD) > 0.005) warnings.push(`Totalul plăților scris în extras (${f2(printed.debit)}) nu se potrivește cu suma operațiunilor citite (${f2(sumD)}).`);
  const lastBal = [...txs].reverse().find((t) => t.balance !== null)?.balance ?? null;
  const closing = printed.closing ?? lastBal;
  if (txs.length && printed.opening !== null && closing !== null && Math.abs(r2(printed.opening + sumC - sumD) - closing) > 0.005) {
    warnings.push(`Soldul inițial (${f2(printed.opening)}) plus încasările minus plățile nu dă soldul final (${f2(closing)}): poate lipsește o operațiune.`);
  }
  if (!txs.length) warnings.push('Tabelul nu are nicio operațiune cu dată și sumă.');
  if (curs.size > 1) warnings.push(`Extrasul are mai multe monede (${[...curs].join(', ')}): sumele se adună separat pe fiecare.`);
  return { txs, currency: curs.size === 1 ? [...curs][0] : 'RON', warnings, printed };
}

const r2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100;

/** O foaie citită din .xlsx / .xls / .ods → rândurile de text ale extrasului (datele ca 26.10.2026, sumele cu punct zecimal). */
export function cellsToRows(cells: Record<string, string>, styles: Record<string, CellStyle>): string[][] {
  const rows: string[][] = [];
  for (const [id, v] of Object.entries(cells)) {
    const m = /^([A-Z]+)(\d+)$/.exec(id);
    if (!m || v.startsWith('=')) continue;
    const c = [...m[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
    const r = Number(m[2]) - 1;
    if (r > 5000 || c > 60) continue;
    let t = v;
    // Cititorii de .xlsx / .ods păstrează numerele cu virgulă zecimală („3522,35”).
    const n = Number(/^-?\d+,\d+$/.test(v) ? v.replace(',', '.') : v);
    const fmt = styles[id]?.fmt;
    if (v.trim() && Number.isFinite(n)) {
      if ((fmt === 'date' || fmt === 'datelong' || fmt === 'datetime') && n > 0 && n < 200000) {
        const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000);
        t = `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;
      } else t = String(r2(n));
    }
    (rows[r] ??= [])[c] = t;
  }
  return Array.from(rows, (row) => Array.from(row ?? [], (x) => x ?? ''));
}

/** Tabelul Suite: foaia „Extras” cu operațiunile și foaia „Rezumat” pe luni și categorii (formule SUMIFS pe foaia Extras). */
export function statementDoc(read: BankRead, title: string, rules: [string, string][] = DEFAULT_RULES): SheetDoc {
  const d = emptySheetDoc();
  d.title = title;
  const ex = emptySheet('Extras');
  const H: CellStyle = { b: true, bg: '#dde7f5', align: 'center' };
  const MONEY: CellStyle = { fmt: 'number', dec: 2 };
  ['Data', 'Partener', 'Descriere', 'Încasări', 'Plăți', 'Sold', 'Categorie', 'Luna'].forEach((h, i) => {
    const id = String.fromCharCode(65 + i) + '1';
    ex.cells[id] = h; ex.styles[id] = H;
  });
  const n = read.txs.length;
  read.txs.forEach((t, i) => {
    const r = i + 2;
    ex.cells[`A${r}`] = String(Math.round((Date.UTC(+t.date.slice(0, 4), +t.date.slice(5, 7) - 1, +t.date.slice(8, 10)) - Date.UTC(1899, 11, 30)) / 86400000));
    ex.styles[`A${r}`] = { fmt: 'date' };
    if (t.partner) ex.cells[`B${r}`] = t.partner;
    ex.cells[`C${r}`] = t.desc;
    if (t.credit) ex.cells[`D${r}`] = String(t.credit);
    if (t.debit) ex.cells[`E${r}`] = String(t.debit);
    ex.styles[`D${r}`] = MONEY; ex.styles[`E${r}`] = MONEY; ex.styles[`F${r}`] = MONEY;
    if (t.balance !== null) ex.cells[`F${r}`] = String(t.balance);
    ex.cells[`G${r}`] = t.category;
    ex.cells[`H${r}`] = t.date.slice(0, 7);
  });
  const tot = n + 3;
  ex.cells[`C${tot}`] = 'Total'; ex.styles[`C${tot}`] = { b: true, align: 'right' };
  ex.cells[`D${tot}`] = `=SUM(D2:D${n + 1})`; ex.cells[`E${tot}`] = `=SUM(E2:E${n + 1})`;
  ex.styles[`D${tot}`] = { b: true, ...MONEY }; ex.styles[`E${tot}`] = { b: true, ...MONEY };
  ex.colW = { A: 95, B: 230, C: 380, D: 100, E: 100, F: 110, G: 150, H: 75 };
  ex.freeze = 1;
  ex.filter = { r: 0, c0: 0, c1: 7, hidden: {} };
  ex.lists = [{ range: `G2:G${n + 1}`, values: [...new Set([...rules.map(([, c]) => c), 'Alte încasări', 'Alte plăți'])] }];

  // Rezumat: categoriile pe rânduri, lunile pe coloane, plus total; încasări cu plus, plăți cu minus.
  const rz = emptySheet('Rezumat');
  const months = [...new Set(read.txs.map((t) => t.date.slice(0, 7)))].sort();
  const cats = [...new Set(read.txs.map((t) => t.category))].sort((a, b) => a.localeCompare(b, 'ro'));
  const col = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26)));
  const rng = (c: string) => `Extras!$${c}$2:$${c}$${n + 1}`;
  rz.cells.A1 = 'Categorie'; rz.styles.A1 = H;
  months.forEach((m, j) => { const id = `${col(j + 1)}1`; rz.cells[id] = m; rz.styles[id] = H; });
  const totCol = col(months.length + 1);
  rz.cells[`${totCol}1`] = 'Total'; rz.styles[`${totCol}1`] = H;
  cats.forEach((c, i) => {
    const r = i + 2;
    rz.cells[`A${r}`] = c;
    months.forEach((_, j) => {
      const id = `${col(j + 1)}${r}`;
      rz.cells[id] = `=SUMIFS(${rng('D')};${rng('G')};$A${r};${rng('H')};${col(j + 1)}$1)-SUMIFS(${rng('E')};${rng('G')};$A${r};${rng('H')};${col(j + 1)}$1)`;
      rz.styles[id] = MONEY;
    });
    rz.cells[`${totCol}${r}`] = `=SUM(B${r}:${col(months.length)}${r})`;
    rz.styles[`${totCol}${r}`] = { b: true, ...MONEY };
  });
  const last = cats.length + 1;
  const sumRow = (r: number, label: string, f: (c: string) => string) => {
    rz.cells[`A${r}`] = label; rz.styles[`A${r}`] = { b: true };
    for (let j = 1; j <= months.length + 1; j++) { const id = `${col(j)}${r}`; rz.cells[id] = f(col(j)); rz.styles[id] = { b: true, ...MONEY }; }
  };
  sumRow(last + 2, 'Încasări', (c) => (c === totCol ? `=SUM(B${last + 2}:${col(months.length)}${last + 2})` : `=SUMIFS(${rng('D')};${rng('H')};${c}$1)`));
  sumRow(last + 3, 'Plăți', (c) => (c === totCol ? `=SUM(B${last + 3}:${col(months.length)}${last + 3})` : `=SUMIFS(${rng('E')};${rng('H')};${c}$1)`));
  sumRow(last + 4, 'Diferența', (c) => `=${c}${last + 2}-${c}${last + 3}`);
  rz.cells[`A${last + 6}`] = 'Plățile sunt cu minus. Schimbi categoria unei operațiuni în foaia Extras (coloana G) și rezumatul se reface singur.';
  rz.styles[`A${last + 6}`] = { i: true, color: '#666666' };
  rz.colW = { A: 190 };
  rz.freeze = 1;
  // Parteneri: fiecare client / furnizor o dată, cu încasările, plățile și numărul de operațiuni (formule pe foaia Extras),
  // de la cel cu cele mai mari sume la cel cu cele mai mici.
  const pa = emptySheet('Parteneri');
  ['Partener', 'Încasări', 'Plăți', 'Diferența', 'Operațiuni'].forEach((h, i) => { const id = String.fromCharCode(65 + i) + '1'; pa.cells[id] = h; pa.styles[id] = H; });
  const turn = new Map<string, number>();
  for (const t of read.txs) if (t.partner) turn.set(t.partner, (turn.get(t.partner) ?? 0) + t.credit + t.debit);
  const partners = [...turn.keys()].sort((a, b) => turn.get(b)! - turn.get(a)! || a.localeCompare(b, 'ro'));
  partners.forEach((name, i) => {
    const r = i + 2;
    pa.cells[`A${r}`] = name;
    pa.cells[`B${r}`] = `=SUMIFS(${rng('D')};${rng('B')};$A${r})`;
    pa.cells[`C${r}`] = `=SUMIFS(${rng('E')};${rng('B')};$A${r})`;
    pa.cells[`D${r}`] = `=B${r}-C${r}`;
    pa.cells[`E${r}`] = `=COUNTIFS(${rng('B')};$A${r})`;
    for (const c of 'BCD') pa.styles[`${c}${r}`] = MONEY;
  });
  if (partners.length) {
    const r = partners.length + 3, e = partners.length + 1;
    pa.cells[`A${r}`] = 'Total'; pa.styles[`A${r}`] = { b: true };
    for (const c of 'BCDE') { pa.cells[`${c}${r}`] = `=SUM(${c}2:${c}${e})`; pa.styles[`${c}${r}`] = c === 'E' ? { b: true } : { b: true, ...MONEY }; }
  }
  pa.cells[`A${partners.length + 5}`] = 'Fără comisioane, numerar și plăți cu cardul (operațiunile fără partener). Sortezi sau filtrezi după partener și în foaia Extras (coloana B).';
  pa.styles[`A${partners.length + 5}`] = { i: true, color: '#666666' };
  pa.colW = { A: 300, B: 110, C: 110, D: 110, E: 105 };
  pa.freeze = 1;
  if (partners.length) pa.filter = { r: 0, c0: 0, c1: 4, hidden: {} };
  // Reguli: cuvântul căutat în descriere → categoria; se schimbă aici și se aplică din Fișier → Aplică regulile de categorii.
  const rg = emptySheet('Reguli');
  rg.cells.A1 = 'Cuvânt în partener sau descriere'; rg.styles.A1 = H;
  rg.cells.B1 = 'Categorie'; rg.styles.B1 = H;
  rules.forEach(([w, c], i) => { rg.cells[`A${i + 2}`] = w; rg.cells[`B${i + 2}`] = c; });
  rg.cells.D1 = 'Cum se folosesc';
  rg.styles.D1 = { b: true };
  rg.cells.D2 = 'Fiecare rând: un cuvânt (sau o bucată de cuvânt) din numele partenerului sau din descriere și categoria lui. Mari / mici și diacriticele nu contează.';
  rg.cells.D3 = 'Prima regulă care se potrivește câștigă: pune regulile mai precise mai sus. Cuvintele de până la 4 litere se caută doar întregi.';
  rg.cells.D4 = 'Adaugă, schimbă sau șterge rânduri, apoi Fișier → Aplică regulile de categorii: categoriile și Rezumatul se refac, iar regulile se țin minte pentru extrasele următoare.';
  for (const k of ['D2', 'D3', 'D4']) rg.styles[k] = { color: '#555555' };
  rg.colW = { A: 230, B: 170, C: 30, D: 640 };
  rg.freeze = 1;
  d.sheets = [ex, rz, pa, rg];
  return d;
}

/** E tabelul făcut de Import extras de cont (foile Extras și Reguli)? */
export function isStatementDoc(doc: SheetDoc) {
  const ex = doc.sheets.find((x) => x.name === 'Extras');
  if (!ex || !doc.sheets.some((x) => x.name === 'Reguli') || ex.cells.A1 !== 'Data') return false;
  const h = headOf(ex);
  return h.desc >= 0 && h.cat >= 0;
}

/** Regulile scrise în foaia Reguli (rândurile cu cuvânt și categorie, de sub antet). */
export function readRules(sheet: Sheet): [string, string][] {
  const out: [string, string][] = [];
  for (let r = 2; r < 2000; r++) {
    const w = (sheet.cells[`A${r}`] ?? '').trim(), c = (sheet.cells[`B${r}`] ?? '').trim();
    if (w && c && !w.startsWith('=')) out.push([w, c]);
  }
  return out;
}

/** Coloanele foii Extras după numele din antet (tabelele făcute înainte de 28.10 nu au coloana Partener). */
function headOf(ex: Sheet) {
  const names: string[] = [];
  for (let i = 0; i < 12; i++) names.push((ex.cells[String.fromCharCode(65 + i) + '1'] ?? '').trim());
  const at = (n: string) => names.indexOf(n);
  return { partner: at('Partener'), desc: at('Descriere'), credit: at('Încasări'), debit: at('Plăți'), bal: at('Sold'), cat: at('Categorie') };
}

/** Foaia Extras (poate schimbată de mână) → operațiunile, ca să refacem tabelul cu alte reguli. */
function sheetTxs(ex: Sheet): BankTx[] {
  const txs: BankTx[] = [];
  const h = headOf(ex);
  const cell = (i: number, r: number) => (i < 0 ? undefined : ex.cells[String.fromCharCode(65 + i) + r]);
  const num = (v: string | undefined) => { const x = Number(v ?? ''); return v?.trim() && Number.isFinite(x) ? x : null; };
  for (let r = 2; ex.cells[`A${r}`]; r++) {
    const day = num(ex.cells[`A${r}`]);
    if (day === null) continue;
    let partner = cell(h.partner, r) ?? '', desc = cell(h.desc, r) ?? '';
    if (h.partner < 0) { const sp = splitPartner(desc); partner = sp.partner; desc = sp.rest; }
    txs.push({
      date: new Date(Date.UTC(1899, 11, 30) + Math.floor(day) * 86400000).toISOString().slice(0, 10),
      partner, desc, credit: num(cell(h.credit, r)) ?? 0, debit: num(cell(h.debit, r)) ?? 0,
      balance: num(cell(h.bal, r)), category: cell(h.cat, r) ?? '',
    });
  }
  return txs;
}

/** Aplică regulile din foaia Reguli: categoriile din Extras și Rezumatul se refac; câte categorii s-au schimbat. */
export function applyRules(doc: SheetDoc): { sheets: Sheet[]; rules: [string, string][]; changed: number; total: number } {
  const ex = doc.sheets.find((x) => x.name === 'Extras')!;
  const rules = readRules(doc.sheets.find((x) => x.name === 'Reguli')!);
  const txs = sheetTxs(ex);
  let changed = 0;
  for (const t of txs) {
    const c = categorize(`${t.partner} ${t.desc}`, t.credit > 0, rules);
    if (c !== t.category) changed++;
    t.category = c;
  }
  const fresh = statementDoc({ txs, currency: 'RON', warnings: [] }, doc.title, rules).sheets;
  // Foile adăugate de utilizator rămân; Extras, Rezumat, Parteneri și Reguli se înlocuiesc pe loc (Parteneri se adaugă
  // după Rezumat la tabelele făcute înainte să existe).
  const sheets = doc.sheets.map((x) => fresh.find((y) => y.name === x.name) ?? x);
  if (!sheets.some((x) => x.name === 'Parteneri')) {
    const at = sheets.findIndex((x) => x.name === 'Rezumat');
    sheets.splice(at < 0 ? sheets.length : at + 1, 0, fresh.find((y) => y.name === 'Parteneri')!);
  }
  return { sheets, rules, changed, total: txs.length };
}

const RULES_KEY = 'suite.bankRules';
/** Regulile ținute minte (după ultima aplicare), altfel cele obișnuite. */
export function savedRules(): [string, string][] {
  try {
    const v = JSON.parse(localStorage.getItem(RULES_KEY) ?? 'null');
    if (Array.isArray(v) && v.length && v.every((x) => Array.isArray(x) && typeof x[0] === 'string' && typeof x[1] === 'string')) return v;
  } catch { /* fără memorie */ }
  return DEFAULT_RULES;
}
export function saveRules(rules: [string, string][]) {
  try { localStorage.setItem(RULES_KEY, JSON.stringify(rules)); } catch { /* fără memorie */ }
}
