// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Liste derulante în celule (validarea datelor din Excel): o zonă de celule primește valorile permise,
// iar în celulă se alege din ▾ sau se scrie doar o valoare din listă.
// O zonă poate primi în loc de listă o verificare de cod (doar CNP, CUI sau IBAN corecte).
// Tot aici: regulile pe numere întregi / zecimale / date / lungimea textului (între, mai mare decât…), mesajul arătat
// când selectezi celula și mesajul de eroare (Oprire / Avertisment / Informare), ca în Excel.
import { validCnp, validCui, validIban } from './ids';
import { formatNumber } from './formula';
import { parseEntry, serialToDate } from './numfmt';

export type CodeKind = 'cnp' | 'cui' | 'iban';
export type RuleType = 'whole' | 'decimal' | 'date' | 'length' | 'custom';
export type RuleOp = 'between' | 'notBetween' | 'eq' | 'ne' | 'gt' | 'lt' | 'ge' | 'le';
/** La `custom`, `f` e formula (scrisă pentru prima celulă a zonei, ca =ȘI(A2>0;A2<B2)); valoarea se primește când dă ADEVĂRAT. */
export interface ValRule { type: RuleType; op: RuleOp; a: number; b?: number; f?: string }
export interface ValMsg { title?: string; text: string }
export type ErrStyle = 'stop' | 'warning' | 'info';
export interface ValError { style: ErrStyle; title?: string; text?: string }

export const RULE_TYPES: [RuleType, string][] = [['whole', 'număr întreg'], ['decimal', 'număr (și cu zecimale)'], ['date', 'dată'], ['length', 'text cu lungimea'], ['custom', 'valori pentru care o formulă e adevărată']];
export const RULE_OPS: [RuleOp, string][] = [
  ['between', 'între'], ['notBetween', 'în afara intervalului'], ['eq', 'egal cu'], ['ne', 'diferit de'],
  ['gt', 'mai mare decât'], ['lt', 'mai mic decât'], ['ge', 'cel puțin'], ['le', 'cel mult'],
];
export const ERR_STYLES: [ErrStyle, string][] = [['stop', 'Oprire (nu se primește)'], ['warning', 'Avertisment (întreabă)'], ['info', 'Informare (se primește, cu mesaj)']];
const two = (op: RuleOp) => op === 'between' || op === 'notBetween';

export interface SheetList {
  /** Zona, de exemplu "B2:B50". */
  range: string;
  values: string[];
  /** Dacă e pus, celula primește doar coduri corecte de felul acesta (iar `values` e gol). */
  kind?: CodeKind;
  /** Regulă pe număr / dată / lungime (iar `values` e gol). */
  rule?: ValRule;
  /** Mesajul arătat când selectezi celula. */
  prompt?: ValMsg;
  /** Ce se întâmplă când valoarea nu respectă regula sau lista. */
  error?: ValError;
}

/** Valoarea scrisă respectă regula? (celula goală e mereu permisă) */
export function ruleOk(rule: ValRule, typed: string, custom?: (f: string) => boolean): boolean {
  const t = typed.trim();
  if (!t) return true;
  // Regula cu formulă se calculează în foaie (vezi Sheets.tsx: customOk); fără foaie, valoarea se primește.
  if (rule.type === 'custom') return custom ? custom(rule.f ?? '') : true;
  let n: number;
  if (rule.type === 'length') n = t.length;
  else {
    const e = parseEntry(t);
    n = /^[-+]?\d+([.,]\d+)?$/.test(e.raw.trim()) ? Number(e.raw.trim().replace(',', '.')) : NaN;
    if (!Number.isFinite(n)) return false;
    if (rule.type === 'whole' && !Number.isInteger(n)) return false;
    // O dată se scrie ca dată (17.10.2026), nu ca număr oarecare.
    if (rule.type === 'date' && !(e.fmt === 'date' || e.fmt === 'datetime')) return false;
  }
  const { a, b = a } = rule;
  switch (rule.op) {
    case 'between': return n >= Math.min(a, b) && n <= Math.max(a, b);
    case 'notBetween': return n < Math.min(a, b) || n > Math.max(a, b);
    case 'eq': return n === a;
    case 'ne': return n !== a;
    case 'gt': return n > a;
    case 'lt': return n < a;
    case 'ge': return n >= a;
    case 'le': return n <= a;
  }
}

/** „un număr întreg între 1 și 10”, „o dată după 01.01.2026”, „un text de cel mult 20 de caractere”. */
export function describeValRule(rule: ValRule): string {
  const v = (x: number) => (rule.type === 'date' ? serialToDate(x) : formatNumber(x));
  if (rule.type === 'custom') return `o valoare pentru care formula ${(rule.f ?? '').startsWith('=') ? rule.f : '=' + (rule.f ?? '')} dă ADEVĂRAT`;
  const what = rule.type === 'whole' ? 'un număr întreg' : rule.type === 'decimal' ? 'un număr' : rule.type === 'date' ? 'o dată' : 'un text';
  const date = rule.type === 'date';
  const len = rule.type === 'length';
  const unit = len ? (rule.op === 'between' || rule.op === 'notBetween' ? ' caractere' : rule.a === 1 ? ' caracter' : ' de caractere') : '';
  const words: Record<RuleOp, string> = {
    between: date ? 'între' : len ? 'cu lungimea între' : 'între',
    notBetween: len ? 'cu lungimea în afara intervalului' : 'în afara intervalului',
    eq: date ? 'egală cu' : len ? 'de exact' : 'egal cu',
    ne: len ? 'cu lungimea diferită de' : date ? 'diferită de' : 'diferit de',
    gt: date ? 'după' : len ? 'mai lung de' : 'mai mare decât',
    lt: date ? 'înainte de' : len ? 'mai scurt de' : 'mai mic decât',
    ge: date ? 'cel mai devreme' : len ? 'de cel puțin' : 'cel puțin',
    le: date ? 'cel mai târziu' : len ? 'de cel mult' : 'cel mult',
  };
  return two(rule.op) ? `${what} ${words[rule.op]} ${v(rule.a)} și ${v(rule.b ?? rule.a)}${unit}` : `${what} ${words[rule.op]} ${v(rule.a)}${unit}`;
}

export const CODE_KINDS: [CodeKind, string][] = [['cnp', 'CNP'], ['cui', 'CUI (cod fiscal)'], ['iban', 'IBAN']];
const CHECK: Record<CodeKind, (s: string) => boolean> = { cnp: validCnp, cui: validCui, iban: validIban };

interface Box { r0: number; c0: number; r1: number; c1: number }

export const MAX_LISTS = 100;
export const MAX_VALUES = 200;
export const MAX_VALUE_LEN = 100;

function box(range: string): Box | null {
  const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(range);
  if (!m) return null;
  const col = (s: string) => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  const [a, b, r0, r1] = [col(m[1]), col(m[3]), Number(m[2]) - 1, Number(m[4]) - 1];
  return { r0: Math.min(r0, r1), r1: Math.max(r0, r1), c0: Math.min(a, b), c1: Math.max(a, b) };
}

const inside = (g: Box, r: number, c: number) => r >= g.r0 && r <= g.r1 && c >= g.c0 && c <= g.c1;
const overlaps = (a: Box, b: Box) => a.r0 <= b.r1 && b.r0 <= a.r1 && a.c0 <= b.c1 && b.c0 <= a.c1;
const contains = (outer: Box, g: Box) => g.r0 >= outer.r0 && g.r1 <= outer.r1 && g.c0 >= outer.c0 && g.c1 <= outer.c1;

/** Lista care se aplică celulei (cea pusă ultima, dacă se suprapun). */
/** Prima celulă a zonei listei (rândul și coloana, de la 0), de la care se mută formula regulii. */
export function listOrigin(list: SheetList): { r: number; c: number } | null {
  const g = box(list.range);
  return g ? { r: g.r0, c: g.c0 } : null;
}

export function listAt(lists: SheetList[] | undefined, r: number, c: number): SheetList | null {
  if (!lists) return null;
  for (let i = lists.length - 1; i >= 0; i--) {
    const g = box(lists[i].range);
    if (g && inside(g, r, c)) return lists[i];
  }
  return null;
}

/**
 * Celulele care nu respectă validarea zonei lor (Excel: Încercuiește datele nevalide), de exemplu valori scrise înainte de regulă
 * sau venite din fișiere. Se verifică textul afișat (la formule, rezultatul); celulele goale sunt mereu bune.
 */
export function invalidCells(lists: SheetList[] | undefined, cells: Record<string, string>, shown: (id: string) => string,
  custom?: (list: SheetList, id: string, f: string) => boolean): string[] {
  if (!lists?.length) return [];
  const out: string[] = [];
  for (const id of Object.keys(cells)) {
    const m = /^([A-Z]+)(\d+)$/.exec(id);
    if (!m) continue;
    const list = listAt(lists, Number(m[2]) - 1, [...m[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1);
    if (!list || (!list.kind && !list.rule && !list.values.length)) continue;
    const v = shown(id);
    if (!v.trim()) continue;
    if (list.rule ? !ruleOk(list.rule, v, custom && ((f) => custom(list, id, f))) : matchValue(list, v) === null) out.push(id);
  }
  return out;
}

/** Textul scris de utilizator (o valoare pe rând, sau separate prin „;”) → valorile listei, fără dubluri. */
export function parseValues(text: string): string[] {
  const parts = text.includes('\n') ? text.split('\n') : text.split(';');
  const out: string[] = [];
  for (const p of parts) {
    const v = p.trim().slice(0, MAX_VALUE_LEN);
    if (v && !out.some((x) => same(x, v))) out.push(v);
    if (out.length >= MAX_VALUES) break;
  }
  return out;
}

const same = (a: string, b: string) => a.trim().toLocaleLowerCase('ro-RO') === b.trim().toLocaleLowerCase('ro-RO');

/** Valoarea scrisă, așa cum apare în listă („da” → „Da”), sau null dacă nu e în listă. Celula goală e mereu permisă. */
export function matchValue(list: SheetList, v: string): string | null {
  if (!v.trim()) return '';
  if (list.kind) return CHECK[list.kind](v) ? v.trim() : null;
  return list.values.find((x) => same(x, v)) ?? null;
}

/** Pune lista pe zonă; listele vechi aflate în întregime în zonă dispar (cea nouă le ia locul). */
export function setList(lists: SheetList[] | undefined, range: string, values: string[], kind?: CodeKind,
  extra: { rule?: ValRule; prompt?: ValMsg; error?: ValError } = {}): SheetList[] {
  const g = box(range);
  const kept = (lists ?? []).filter((l) => { const b = box(l.range); return !(g && b && contains(g, b)); });
  const base: SheetList = kind ? { range, values: [], kind } : extra.rule ? { range, values: [], rule: extra.rule } : { range, values };
  if (extra.prompt?.text.trim()) base.prompt = extra.prompt;
  if (extra.error && (extra.error.style !== 'stop' || extra.error.text?.trim() || extra.error.title?.trim())) base.error = extra.error;
  return [...kept, base].slice(-MAX_LISTS);
}

/** Celula are o listă de ales (▾), nu doar o verificare. */
export const hasValues = (l: SheetList | null): boolean => !!l && !l.kind && !l.rule && l.values.length > 0;

/** Scoate listele care ating zona; întoarce și zonele scoase, ca să le putem spune utilizatorului. */
export function removeLists(lists: SheetList[] | undefined, range: string): { lists: SheetList[]; removed: string[] } {
  const g = box(range);
  const removed: string[] = [];
  const kept = (lists ?? []).filter((l) => {
    const b = box(l.range);
    const hit = !!(g && b && overlaps(g, b));
    if (hit) removed.push(l.range);
    return !hit;
  });
  return { lists: kept, removed };
}

/** Curăță listele citite dintr-un fișier. */
export function cleanLists(raw: unknown): SheetList[] {
  if (!Array.isArray(raw)) return [];
  const out: SheetList[] = [];
  for (const l of raw.slice(0, MAX_LISTS)) {
    if (!l || typeof l !== 'object') continue;
    const { range, values, kind, rule, prompt, error } = l as Record<string, unknown>;
    if (typeof range !== 'string' || !box(range)) continue;
    const extra = cleanExtra(rule, prompt, error);
    if (typeof kind === 'string' && kind in CHECK) { out.push({ range, values: [], kind: kind as CodeKind, ...extra }); continue; }
    if (extra.rule) { out.push({ range, values: [], ...extra }); continue; }
    const vals = Array.isArray(values) ? parseValues(values.map(String).join('\n')) : [];
    if (vals.length || extra.prompt) out.push({ range, values: vals, ...extra });
  }
  return out;
}

const str = (x: unknown, max: number) => (typeof x === 'string' ? x.slice(0, max) : undefined);

/** Regula și mesajele citite din fișier (orice e greșit se lasă deoparte). */
export function cleanExtra(rule: unknown, prompt: unknown, error: unknown): { rule?: ValRule; prompt?: ValMsg; error?: ValError } {
  const out: { rule?: ValRule; prompt?: ValMsg; error?: ValError } = {};
  if (rule && typeof rule === 'object') {
    const r = rule as Record<string, unknown>;
    if (r.type === 'custom' && typeof r.f === 'string' && r.f.trim().replace(/^=/, '')) out.rule = { type: 'custom', op: 'between', a: 0, f: r.f.trim().replace(/^=/, '').slice(0, 255) };
    else if (r.type !== 'custom' && RULE_TYPES.some(([k]) => k === r.type) && RULE_OPS.some(([k]) => k === r.op) && typeof r.a === 'number' && Number.isFinite(r.a)) {
      out.rule = { type: r.type as RuleType, op: r.op as RuleOp, a: r.a, ...(two(r.op as RuleOp) && typeof r.b === 'number' && Number.isFinite(r.b) ? { b: r.b } : {}) };
    }
  }
  if (prompt && typeof prompt === 'object') {
    const text = str((prompt as Record<string, unknown>).text, 255);
    const title = str((prompt as Record<string, unknown>).title, 32);
    if (text?.trim()) out.prompt = { text, ...(title?.trim() ? { title } : {}) };
  }
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    const style = ERR_STYLES.some(([k]) => k === e.style) ? (e.style as ErrStyle) : 'stop';
    const text = str(e.text, 255), title = str(e.title, 32);
    if (style !== 'stop' || text?.trim() || title?.trim()) out.error = { style, ...(title?.trim() ? { title } : {}), ...(text?.trim() ? { text } : {}) };
  }
  return out;
}
