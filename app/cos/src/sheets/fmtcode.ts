// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Formatele de număr scrise ca „cod” (ca în fișierele .xlsx și în fereastra Formatare celule → Particularizat):
// „#,##0.00 "lei"”, „0%”, „[Red]-#,##0;[Blue]#,##0”, „dd mmmm yyyy”, „hh:mm:ss”, „[h]:mm”, „# ?/?”, „0.00E+00”, „@”.
// Codul e scris ca în fișiere (punct = zecimale, virgulă = mii); rezultatul se afișează românește (virgulă la zecimale, punct la mii).
// Scris de la zero, după descrierea publică a formatului (secțiuni pozitiv;negativ;zero;text, condiții, culori, cifre 0 # ?).

export interface FmtResult { text: string; color?: string }

const MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
const DAYS = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];
const COLORS: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff', yellow: '#ffff00', magenta: '#ff00ff', cyan: '#00ffff',
};
const DAY_MS = 86400000;
const EPOCH = Date.UTC(1899, 11, 30);

type Tok = { t: 'lit'; v: string } | { t: 'ph'; v: string };
interface Section { toks: Tok[]; color?: string; cond?: { op: string; n: number }; elapsed: boolean }

/** Împarte codul în secțiuni (pe „;” din afara ghilimelelor și parantezelor drepte) și în bucăți: text de afișat și semne de format. */
function parse(code: string): Section[] {
  const out: Section[] = [];
  let cur: Section = { toks: [], elapsed: false };
  const lit = (v: string) => { const l = cur.toks[cur.toks.length - 1]; if (l?.t === 'lit') l.v += v; else cur.toks.push({ t: 'lit', v }); };
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c === ';') { out.push(cur); cur = { toks: [], elapsed: false }; continue; }
    if (c === '"') { const j = code.indexOf('"', i + 1); lit(code.slice(i + 1, j < 0 ? code.length : j)); i = j < 0 ? code.length : j; continue; }
    if (c === '\\') { if (i + 1 < code.length) lit(code[++i]); continue; }
    if (c === '_') { i++; lit(' '); continue; }
    if (c === '*') { i++; continue; }
    if (c === '[') {
      const j = code.indexOf(']', i + 1);
      const inner = code.slice(i + 1, j < 0 ? code.length : j);
      i = j < 0 ? code.length : j;
      const low = inner.toLowerCase();
      const cond = /^(<=|>=|<>|<|>|=)\s*(-?[\d.]+)$/.exec(inner);
      if (COLORS[low]) cur.color = COLORS[low];
      else if (/^color\s*\d+$/i.test(inner)) cur.color = undefined;
      else if (cond) cur.cond = { op: cond[1], n: Number(cond[2]) };
      else if (/^(h+|m+|s+)$/i.test(inner)) { cur.elapsed = true; cur.toks.push({ t: 'ph', v: '[' + low + ']' }); }
      else if (inner.startsWith('$')) lit(inner.slice(1).split('-')[0]);
      continue;
    }
    if (/^general/i.test(code.slice(i))) { cur.toks.push({ t: 'ph', v: 'General' }); i += 6; continue; }
    if (/^(am\/pm|a\/p)/i.test(code.slice(i))) { const k = /^am\/pm/i.test(code.slice(i)) ? 5 : 3; cur.toks.push({ t: 'ph', v: code.slice(i, i + k) }); i += k - 1; continue; }
    if (/[0#?.,%@eE/yYmMdDhHsS]/.test(c)) {
      if ((c === 'e' || c === 'E') && /[+-]/.test(code[i + 1] ?? '')) { cur.toks.push({ t: 'ph', v: 'E' + code[i + 1] }); i++; continue; }
      if (c === 'e' || c === 'E') { lit(c); continue; }
      cur.toks.push({ t: 'ph', v: /[yYmMdDhHsS]/.test(c) ? c.toLowerCase() : c });
      continue;
    }
    lit(c);
  }
  out.push(cur);
  return out;
}

const isDate = (s: Section) => s.toks.some((k) => k.t === 'ph' && (/^[ymdhs]$/.test(k.v) || k.v.startsWith('[') || /\//.test(k.v) && k.v.length > 1));

/** Formatează valoarea `v` după cod. Textele trec prin secțiunea a patra (sau prin „@”); restul rămân cum sunt. */
export function formatCode(v: number | string | boolean, code: string, general: (n: number) => string = (n) => String(n).replace('.', ',')): FmtResult {
  const secs = parse(code);
  if (typeof v === 'boolean') return { text: v ? 'ADEVĂRAT' : 'FALS' };
  if (typeof v === 'string') {
    const s = secs[3] ?? (secs.length === 1 && secs[0].toks.some((k) => k.t === 'ph' && k.v === '@') ? secs[0] : undefined);
    if (!s) return { text: v };
    return { text: s.toks.map((k) => (k.t === 'lit' ? k.v : k.v === '@' ? v : '')).join(''), color: s.color };
  }
  if (!Number.isFinite(v)) return { text: String(v) };
  // Alegerea secțiunii: după condiții, dacă există; altfel pozitiv / negativ / zero.
  let sec: Section, n = v, minus = false;
  const test = (c: { op: string; n: number }) => ({ '<': v < c.n, '<=': v <= c.n, '>': v > c.n, '>=': v >= c.n, '=': v === c.n, '<>': v !== c.n }[c.op] ?? false);
  const num = secs.slice(0, 3);
  if (num.some((s) => s.cond)) {
    const hit = num.find((s) => s.cond && test(s.cond));
    sec = hit ?? num.find((s) => !s.cond) ?? num[num.length - 1];
    // Fără secțiune potrivită pentru un negativ: semnul se scrie în față (ca la o singură secțiune).
    if (v < 0 && !(hit && hit.cond && hit.cond.n < 0 || hit && hit.cond && /</.test(hit.cond.op))) minus = true;
    n = Math.abs(v);
    if (!minus && v < 0 && !hit) minus = true;
  } else if (v < 0 && num.length >= 2) { sec = num[1]; n = -v; }
  else if (v === 0 && num.length >= 3) sec = num[2];
  else { sec = num[0]; if (v < 0) { minus = true; n = -v; } }
  const r = isDate(sec) ? dateText(v, sec) : numberText(n, sec, general);
  // Un număr care se rotunjește la zero nu mai are minus („-0”).
  const showMinus = minus && /[1-9]/.test(r) && !isDate(sec);
  return { text: (showMinus ? '-' : '') + r, color: sec.color };
}

/** Partea de număr: cifrele întregi, zecimalele, mii, procent, științific, fracție. */
function numberText(n: number, sec: Section, general: (n: number) => string): string {
  const toks = sec.toks;
  if (toks.some((k) => k.t === 'ph' && k.v === 'General')) return toks.map((k) => (k.t === 'lit' ? k.v : k.v === 'General' ? general(n) : '')).join('');
  const phs = toks.map((k, i) => ({ k, i })).filter(({ k }) => k.t === 'ph' && /^[0#?]$/.test(k.v));
  if (!phs.length) return toks.map((k) => (k.t === 'lit' ? k.v : k.v === '%' ? '%' : '')).join('');
  const pct = toks.filter((k) => k.t === 'ph' && k.v === '%').length;
  let x = n * 100 ** pct;
  // Virgulele de după ultima cifră împart la o mie fiecare (#,##0, = mii).
  const lastPh = phs[phs.length - 1].i;
  let scale = 0;
  for (let i = lastPh + 1; i < toks.length && toks[i].t === 'ph' && toks[i].v === ','; i++) scale++;
  x /= 1000 ** scale;
  const sciAt = toks.findIndex((k) => k.t === 'ph' && /^E[+-]$/.test(k.v));
  const slashAt = toks.findIndex((k) => k.t === 'ph' && k.v === '/');
  if (slashAt >= 0) return fractionText(x, toks, slashAt);
  const firstPh = phs[0].i;
  const end = sciAt >= 0 ? sciAt : lastPh + 1;
  const dot = toks.findIndex((k, i) => i > firstPh && i < end && k.t === 'ph' && k.v === '.');
  const intToks = toks.slice(firstPh, dot >= 0 ? dot : end);
  const fracToks = dot >= 0 ? toks.slice(dot + 1, end) : [];
  const group = intToks.some((k, i) => k.t === 'ph' && k.v === ',' && i > 0 && i < intToks.length - 1);
  const fracN = fracToks.filter((k) => k.t === 'ph' && /^[0#?]$/.test(k.v)).length;
  let exp = '';
  if (sciAt >= 0) {
    const intN = intToks.filter((k) => k.t === 'ph' && /^[0#?]$/.test(k.v)).length;
    let e = x === 0 ? 0 : Math.floor(Math.log10(Math.abs(x)));
    if (intN > 1 && intToks.some((k) => k.t === 'ph' && k.v === '#')) e = Math.floor(e / intN) * intN;
    else e = e - (Math.max(1, intN) - 1);
    let m = x / 10 ** e;
    if (Number(m.toFixed(fracN)) >= 10 ** Math.max(1, intN)) { m /= 10; e++; }
    x = m;
    const expToks = toks.slice(sciAt + 1).filter((k) => k.t === 'ph' && /^[0#?]$/.test(k.v));
    const ed = String(Math.abs(e)).padStart(expToks.filter((k) => k.v === '0').length || 1, '0');
    exp = 'E' + (e < 0 ? '-' : toks[sciAt].v === 'E+' ? '+' : '') + ed;
  }
  const [ip, fp = ''] = (Math.round(x * 10 ** fracN) / 10 ** fracN).toFixed(fracN).split('.');
  // Cifrele întregi, puse de la dreapta la stânga în semne; ce rămâne în plus intră la primul semn.
  let digits = ip === '0' ? '' : ip;
  const intPh = intToks.filter((k) => k.t === 'ph' && /^[0#?]$/.test(k.v));
  let need = 0;
  for (const k of intPh) if (k.v !== '#') need = Math.max(need, intPh.length - intPh.indexOf(k));
  if (digits.length < need) digits = digits.padStart(need, '0');
  // Semnele „?” fără cifră devin spații (aliniere).
  let intStr = digits;
  const qPad = intPh.length - digits.length;
  if (qPad > 0) intStr = ' '.repeat(intPh.slice(0, qPad).filter((k) => k.v === '?').length) + digits;
  const hasLitInside = intToks.some((k) => k.t === 'lit');
  let intOut: string;
  if (hasLitInside) {
    // Cod cu text între cifre (de exemplu „000-000”): fiecare semn ia o cifră, de la dreapta.
    const d = digits.split('');
    const parts: string[] = [];
    const phIdx = intToks.map((k, i) => (k.t === 'ph' && /^[0#?]$/.test(k.v) ? i : -1)).filter((i) => i >= 0);
    for (let i = intToks.length - 1; i >= 0; i--) {
      const k = intToks[i];
      if (k.t === 'lit') { parts.unshift(k.v); continue; }
      if (!/^[0#?]$/.test(k.v)) continue;
      const take = i === phIdx[0] ? d.splice(0).join('') : d.pop() ?? (k.v === '0' ? '0' : k.v === '?' ? ' ' : '');
      parts.unshift(take);
    }
    intOut = parts.join('');
  } else intOut = group ? intStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : intStr;
  let fracOut = '';
  if (dot >= 0) {
    const fd = fp.split('');
    // Zerourile de la sfârșit dispar la „#” și devin spații la „?”.
    const fph = fracToks.filter((k) => k.t === 'ph' && /^[0#?]$/.test(k.v));
    let keep = fd.length;
    while (keep > 0 && fd[keep - 1] === '0' && fph[keep - 1]?.v !== '0') keep--;
    let j = 0;
    fracOut = fracToks.map((k) => {
      if (k.t === 'lit') return k.v;
      if (!/^[0#?]$/.test(k.v)) return k.v === '%' ? '%' : '';
      const idx = j++;
      return idx < keep ? fd[idx] : k.v === '?' ? ' ' : '';
    }).join('');
    fracOut = ',' + fracOut;
  }
  const before = toks.slice(0, firstPh).map((k) => (k.t === 'lit' ? k.v : k.v === '%' ? '%' : '')).join('');
  const after = toks.slice(sciAt >= 0 ? sciAt + 1 : end).map((k) => (k.t === 'lit' ? k.v : k.v === '%' ? '%' : '')).join('');
  return before + intOut + fracOut + exp + after;
}

/** Fracții: „# ?/?”, „?/??”, „# ?/8” (numitor fix). */
function fractionText(x: number, toks: Tok[], slashAt: number): string {
  const ph = (k: Tok) => k.t === 'ph' && /^[0#?]$/.test(k.v);
  const denToks: Tok[] = [];
  let i = slashAt + 1;
  let fixed = '';
  for (; i < toks.length; i++) {
    const k = toks[i];
    if (ph(k)) denToks.push(k);
    else if (k.t === 'lit' && /^\d+/.test(k.v) && !denToks.length) { fixed = /^\d+/.exec(k.v)![0]; break; }
    else break;
  }
  // Numărătorul: semnele lipite de „/”, înaintea lor (după un spațiu) partea întreagă, dacă există.
  let j = slashAt - 1;
  while (j >= 0 && ph(toks[j])) j--;
  const numToks = toks.slice(j + 1, slashAt);
  const intPart = toks.slice(0, j + 1).some(ph);
  const whole = intPart ? Math.floor(x) : 0;
  const frac = x - whole;
  let num: number, den: number;
  if (fixed) { den = Number(fixed); num = Math.round(frac * den); }
  else {
    const maxDen = 10 ** Math.max(1, denToks.length) - 1;
    [num, den] = [Math.round(frac), 1];
    let best = Math.abs(frac - num);
    for (let d = 2; d <= maxDen && best > 1e-12; d++) {
      const nn = Math.round(frac * d);
      const err = Math.abs(frac - nn / d);
      if (err < best - 1e-12) { best = err; num = nn; den = d; }
    }
  }
  let w = whole;
  if (intPart && num === den) { w++; num = 0; }
  const pre = toks.slice(0, j + 1).map((k) => (k.t === 'lit' ? k.v : '')).join('');
  const lead = intPart ? pre.replace(/\s+$/, '') : pre;
  const post = toks.slice(fixed ? slashAt + 1 : i).map((k) => (k.t === 'lit' ? (fixed ? k.v.replace(/^\d+/, '') : k.v) : '')).join('');
  if (intPart && num === 0) return (lead + (w || (numToks.some((k) => k.t === 'ph' && k.v === '0') ? '0' : '0'))).trim() + post;
  const fracStr = String(num).padStart(numToks.length, ' ') + '/' + (fixed || String(den).padEnd(denToks.length, ' '));
  return (intPart ? lead + (w ? w + ' ' : '') : pre) + fracStr + post;
}

/** Partea de dată și oră: zile, luni (cu nume românești), ani, ore, minute, secunde, AM/PM, ore trecute ([h]). */
function dateText(v: number, sec: Section): string {
  const toks = sec.toks;
  const fracSec = (() => { const i = toks.findIndex((k) => k.t === 'ph' && k.v === 's'); if (i < 0) return 0; let n = 0; let j = i; while (toks[j + 1]?.t === 'ph' && toks[j + 1].v === 's') j++; if (toks[j + 1]?.t === 'ph' && toks[j + 1].v === '.') { j += 2; while (toks[j]?.t === 'ph' && toks[j].v === '0') { n++; j++; } } return n; })();
  const unit = 1 / 10 ** fracSec;
  const totalSec = Math.round((v * 86400) / unit) * unit;
  const days = Math.floor(totalSec / 86400);
  const secOfDay = totalSec - days * 86400;
  const dt = new Date(EPOCH + days * DAY_MS);
  const ampm = toks.some((k) => k.t === 'ph' && /^(am\/pm|a\/p)$/i.test(k.v));
  const H = Math.floor(secOfDay / 3600), Mi = Math.floor((secOfDay % 3600) / 60), S = secOfDay % 60;
  // Grupăm literele la fel: „yyyy”, „mm”, „dd”…
  const runs: { v: string; n: number; lit?: string }[] = [];
  for (let i = 0; i < toks.length; i++) {
    const k = toks[i];
    if (k.t === 'lit') { runs.push({ v: '', n: 0, lit: k.v }); continue; }
    const last = runs[runs.length - 1];
    if (last && !last.lit && last.v === k.v && /^[ymdhs0]$/.test(k.v)) last.n++;
    else runs.push({ v: k.v, n: 1 });
  }
  const pad = (x: number, n: number) => String(x).padStart(n, '0');
  const out: string[] = [];
  for (let i = 0; i < runs.length; i++) {
    const r = runs[i];
    if (r.lit !== undefined) { out.push(r.lit); continue; }
    switch (r.v) {
      case 'y': out.push(r.n <= 2 ? pad(dt.getUTCFullYear() % 100, 2) : String(dt.getUTCFullYear())); break;
      case 'd':
        out.push(r.n === 1 ? String(dt.getUTCDate()) : r.n === 2 ? pad(dt.getUTCDate(), 2) : r.n === 3 ? DAYS[dt.getUTCDay()].slice(0, 3) : DAYS[dt.getUTCDay()]);
        break;
      case 'm': {
        // „m” înseamnă minute după „h” sau înainte de „s”, altfel lună.
        const prev = runs.slice(0, i).reverse().find((x) => !x.lit && x.v !== '.' && x.v !== '0');
        const next = runs.slice(i + 1).find((x) => !x.lit && x.v !== '.' && x.v !== '0');
        const minute = r.n <= 2 && (prev?.v === 'h' || prev?.v === '[h]' || next?.v === 's' || next?.v === '[s]');
        if (minute) out.push(r.n === 2 ? pad(Mi, 2) : String(Mi));
        else out.push(r.n === 1 ? String(dt.getUTCMonth() + 1) : r.n === 2 ? pad(dt.getUTCMonth() + 1, 2) : r.n === 3 ? MONTHS[dt.getUTCMonth()].slice(0, 3) : r.n === 5 ? MONTHS[dt.getUTCMonth()][0] : MONTHS[dt.getUTCMonth()]);
        break;
      }
      case 'h': { const h = ampm ? (H % 12 || 12) : H; out.push(r.n >= 2 ? pad(h, 2) : String(h)); break; }
      case 's': out.push(r.n >= 2 ? pad(Math.floor(S), 2) : String(Math.floor(S))); break;
      case '.': {
        const zs = runs[i + 1]?.v === '0' ? runs[i + 1].n : 0;
        if (zs) { out.push(',' + pad(Math.round((S - Math.floor(S)) * 10 ** zs), zs)); i++; } else out.push('.');
        break;
      }
      case '[h]': out.push(String(Math.floor(totalSec / 3600))); break;
      case '[hh]': out.push(pad(Math.floor(totalSec / 3600), 2)); break;
      case '[m]': case '[mm]': out.push(r.v === '[mm]' ? pad(Math.floor(totalSec / 60), 2) : String(Math.floor(totalSec / 60))); break;
      case '[s]': case '[ss]': out.push(r.v === '[ss]' ? pad(Math.floor(totalSec), 2) : String(Math.floor(totalSec))); break;
      default:
        if (/^am\/pm$/i.test(r.v)) out.push(H < 12 ? (r.v[0] === 'a' ? 'am' : 'AM') : (r.v[0] === 'a' ? 'pm' : 'PM'));
        else if (/^a\/p$/i.test(r.v)) out.push(H < 12 ? (r.v[0] === 'a' ? 'a' : 'A') : (r.v[0] === 'a' ? 'p' : 'P'));
        else if (r.v === '0') out.push('0'.repeat(r.n));
        else if (r.v === '/' || r.v === ',' || r.v === '%') out.push(r.v);
    }
  }
  return out.join('');
}

/**
 * Un cod scris „românește” (cum se scrie în TEXT într-o foaie românească: „#.##0,00”, „zz.ll.aaaa”) → codul obișnuit
 * („#,##0.00”, „dd.mm.yyyy”). Separatorul zecimal e cel care apare ultimul; o singură virgulă e zecimală dacă nu e urmată de exact trei cifre după un „#”.
 */
export function codeFromLocal(code: string): string {
  // Bucățile dintre ghilimele și paranteze drepte rămân neatinse.
  const parts = code.split(/("[^"]*"|\[[^\]]*\]|\\.)/);
  const plain = parts.filter((_, i) => i % 2 === 0).join('');
  const isNum = /[0#?]/.test(plain);
  let swap = false;
  if (isNum) {
    const lastDot = plain.lastIndexOf('.'), lastComma = plain.lastIndexOf(',');
    if (lastDot >= 0 && lastComma >= 0) swap = lastComma > lastDot;
    else if (lastComma >= 0) swap = !/#,[#0]{3}(?![#0])/.test(plain) && /[0#?],[0#?]/.test(plain);
  }
  return parts.map((p, i) => {
    if (i % 2 === 1) return p;
    let s = p;
    if (swap) s = s.replace(/[.,]/g, (c) => (c === '.' ? ',' : '.'));
    // Literele românești de dată (zz, ll, aaaa); „AM/PM” și „A/P” rămân cum sunt.
    if (!isNum) s = s.split(/(am\/pm|a\/p)/i).map((q, k) => (k % 2 ? q : q.replace(/z/gi, 'd').replace(/l/gi, 'm').replace(/a/gi, 'y'))).join('');
    return s;
  }).join('');
}
