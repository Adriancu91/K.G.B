// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Câmpurile care calculează din formularele PDF (totaluri, medii, produse), fără motor de scripturi:
// citim doar formele standard pe care le scriu programele de PDF în acțiunea „Calculate” a câmpului:
//  - AFSimple_Calculate("SUM", new Array("A", "B")) — sumă, medie, produs, minim, maxim dintre câmpuri;
//  - notația simplificată: /** BVCALC (Pret * Cantitate) - Reducere EVCALC **/ — o expresie cu + − × ÷ și paranteze.
// Restul scripturilor nu se rulează (sunt cod arbitrar). Formatul afișat vine din AFNumber_Format / AFPercent_Format.

export type CalcOp = 'SUM' | 'AVG' | 'PRD' | 'MIN' | 'MAX';
export type Calc = { op: CalcOp; fields: string[] } | { expr: Expr };
export type Expr = number | string | { o: '+' | '-' | '*' | '/'; a: Expr; b: Expr } | { neg: Expr };

/** Un câmp așa cum îl dă pdf.js (getFieldObjects): id, tip, valoare, acțiunile JavaScript. */
export type FieldObj = { id?: string; name?: string; type?: string; value?: unknown; exportValues?: string; actions?: Record<string, string[]> | null };

const OPS: CalcOp[] = ['SUM', 'AVG', 'PRD', 'MIN', 'MAX'];

/** Șirurile dintre ghilimele dintr-un fragment de cod ("A", 'B'), cu \" și \\ înțelese. */
function quoted(s: string): string[] {
  const out: string[] = [];
  const re = /"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g;
  for (let m; (m = re.exec(s)); ) out.push((m[1] ?? m[2]).replace(/\\(.)/g, '$1'));
  return out;
}

/** Calculul din codul acțiunii „Calculate” a unui câmp, dacă e unul dintre cele standard (altfel null). */
export function parseCalc(js: string): Calc | null {
  const simple = /BVCALC([\s\S]*?)EVCALC/.exec(js);
  if (simple) {
    const expr = parseExpr(simple[1]);
    return expr === null ? null : { expr };
  }
  const m = /AFSimple_Calculate\s*\(\s*(["'])(\w+)\1\s*,([\s\S]*)\)/.exec(js);
  if (!m) return null;
  const op = m[2].toUpperCase() as CalcOp;
  if (!OPS.includes(op)) return null;
  // Lista câmpurilor: new Array("A", "B"), ["A", "B"] sau un singur șir cu virgule "A, B".
  const names = quoted(m[3]);
  const fields = (names.length === 1 ? names[0].split(',') : names).map((n) => n.trim()).filter(Boolean);
  return fields.length ? { op, fields } : null;
}

/** Expresia din notația simplificată: nume de câmpuri (spațiile și semnele din nume se scriu cu \ înainte), numere, + - * / ( ). */
export function parseExpr(src: string): Expr | null {
  const toks: (string | number | { f: string })[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if ('+-*/()'.includes(c)) { toks.push(c); i++; continue; }
    if (/[0-9.]/.test(c)) {
      const m = /^\d*\.?\d+(?:[eE][+-]?\d+)?/.exec(src.slice(i));
      if (!m) return null;
      toks.push(Number(m[0])); i += m[0].length; continue;
    }
    let name = '';
    while (i < src.length && (src[i] === '\\' || !/[\s+\-*/()]/.test(src[i]))) {
      if (src[i] === '\\' && i + 1 < src.length) { name += src[i + 1]; i += 2; } else name += src[i++];
    }
    if (!name) return null;
    toks.push({ f: name });
  }
  let p = 0;
  const atom = (): Expr | null => {
    const t = toks[p++];
    if (t === undefined) return null;
    if (t === '-') { const e = atom(); return e === null ? null : { neg: e }; }
    if (t === '+') return atom();
    if (t === '(') { const e = sum(); if (toks[p++] !== ')') return null; return e; }
    if (typeof t === 'number') return t;
    if (typeof t === 'object') return t.f;
    return null;
  };
  const prod = (): Expr | null => {
    let a = atom();
    while (a !== null && (toks[p] === '*' || toks[p] === '/')) {
      const o = toks[p++] as '*' | '/';
      const b = atom();
      a = b === null ? null : { o, a, b };
    }
    return a;
  };
  const sum = (): Expr | null => {
    let a = prod();
    while (a !== null && (toks[p] === '+' || toks[p] === '-')) {
      const o = toks[p++] as '+' | '-';
      const b = prod();
      a = b === null ? null : { o, a, b };
    }
    return a;
  };
  const e = sum();
  return e !== null && p === toks.length ? e : null;
}

/** Numărul dintr-un text scris de om: „1.234,56”, „1,234.56”, „12,5”, „15 lei”, „-3”. Gol sau fără cifre → 0. */
export function parseNum(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v ?? '').replace(/[\s ']/g, '');
  const neg = /^\(.*\)$/.test(s) || /^-/.test(s.replace(/^[^\d-]+/, ''));
  s = s.replace(/[^\d.,]/g, '');
  if (!/\d/.test(s)) return 0;
  const lastDot = s.lastIndexOf('.'), lastComma = s.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    // Ambele: ultimul e separatorul zecimal.
    const dec = lastDot > lastComma ? '.' : ',';
    s = s.split(dec === '.' ? ',' : '.').join('').replace(',', '.');
  } else if (lastComma >= 0) {
    // Doar virgule: una singură e virgula zecimală (ca la noi); mai multe despart miile.
    s = s.split(',').length > 2 ? s.split(',').join('') : s.replace(',', '.');
  } else if (s.split('.').length > 2) s = s.split('.').join('');
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : 0;
}

/** Numărul scris după formatul câmpului (AFNumber_Format / AFPercent_Format); fără format: cu virgulă, fără zecimale inutile. */
export function formatNum(n: number, formatJs?: string): string {
  const num = /AF(Number|Percent)_Format\s*\(\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(["'])(.*?)\6\s*,\s*(true|false))?/.exec(formatJs ?? '');
  if (!num) return String(Math.round(n * 1e10) / 1e10).replace('.', ',');
  const pct = num[1] === 'Percent';
  const dec = Math.min(10, Number(num[2])), sep = Number(num[3]);
  const neg = Number(num[4] ?? 0), cur = num[7] ?? '', prepend = num[8] === 'true';
  const v = pct ? n * 100 : n;
  const [int, frac] = Math.abs(v).toFixed(dec).split('.');
  // Stilul separatorilor: 0 → 1,234.56; 1 → 1234.56; 2 → 1.234,56; 3 → 1234,56; 4 → 1'234.56.
  const thou = sep === 0 ? ',' : sep === 2 ? '.' : sep === 4 ? "'" : '';
  const point = sep === 2 || sep === 3 ? ',' : '.';
  let s = int.replace(/\B(?=(\d{3})+(?!\d))/g, thou) + (frac ? point + frac : '');
  if (pct) s += '%';
  else if (cur) s = prepend ? cur + s : s + cur;
  const minus = v < 0 && Number(s.replace(/\D/g, '')) !== 0;
  // Negativele: 0 → -1, 1 și 3 → (1) (roșul nu se poate pune în text), 2 → -1.
  return minus ? (neg === 1 || neg === 3 ? `(${s})` : `-${s}`) : s;
}

function evalExpr(e: Expr, val: (name: string) => number): number {
  if (typeof e === 'number') return e;
  if (typeof e === 'string') return val(e);
  if ('neg' in e) return -evalExpr(e.neg, val);
  const a = evalExpr(e.a, val), b = evalExpr(e.b, val);
  return e.o === '+' ? a + b : e.o === '-' ? a - b : e.o === '*' ? a * b : b === 0 ? 0 : a / b;
}

/** Rezultatul unui calcul, cu valorile câmpurilor (null = câmpul nu există). */
export function runCalc(c: Calc, val: (name: string) => number[] | null): number {
  if ('expr' in c) return evalExpr(c.expr, (n) => (val(n) ?? [0]).reduce((s, x) => s + x, 0));
  const nums = c.fields.flatMap((f) => val(f) ?? []);
  if (!nums.length) return 0;
  switch (c.op) {
    case 'SUM': return nums.reduce((s, x) => s + x, 0);
    case 'AVG': return nums.reduce((s, x) => s + x, 0) / nums.length;
    case 'PRD': return nums.reduce((s, x) => s * x, 1);
    case 'MIN': return Math.min(...nums);
    case 'MAX': return Math.max(...nums);
  }
}

/**
 * Recalculează câmpurile cu calcul standard din formular. `get` dă valoarea curentă a unui widget (ce a scris omul),
 * `set` scrie rezultatul. Se repetă până nu se mai schimbă nimic (un total poate depinde de alte totaluri).
 * Întoarce câte valori s-au schimbat.
 */
export function recalcForm(fields: Record<string, FieldObj[]>, get: (o: FieldObj) => unknown, set: (o: FieldObj, value: string) => void): number {
  const calcs: { name: string; calc: Calc; format?: string; widgets: FieldObj[] }[] = [];
  for (const [name, list] of Object.entries(fields)) {
    const widgets = list.filter((o) => o.id && o.type);
    const withCalc = widgets.find((o) => o.actions?.Calculate?.length);
    if (!withCalc) continue;
    const calc = parseCalc(withCalc.actions!.Calculate.join('\n'));
    if (calc) calcs.push({ name, calc, format: withCalc.actions?.Format?.join('\n'), widgets });
  }
  if (!calcs.length) return 0;
  const names = Object.keys(fields);
  // Valorile unui nume: câmpul însuși sau, dacă e un părinte („Rand”), toți copiii lui („Rand.1”, „Rand.2”…).
  const val = (name: string): number[] | null => {
    const own = names.filter((n) => n === name || n.startsWith(name + '.'));
    if (!own.length) return null;
    return own.flatMap((n) => {
      // Părintele însuși (fără widget) nu are valoare; contează doar copiii lui.
      const ws = fields[n].filter((o) => o.id && o.type);
      if (!ws.length) return [];
      if (ws[0].type === 'checkbox' || ws[0].type === 'radiobutton') {
        return ws.reduce((s, o) => s + (get(o) === true ? parseNum(o.exportValues) : 0), 0);
      }
      return parseNum(get(ws[0]));
    });
  };
  let changed = 0;
  for (let pass = 0; pass < 10; pass++) {
    let any = false;
    for (const c of calcs) {
      const text = formatNum(runCalc(c.calc, val), c.format);
      for (const w of c.widgets) {
        if (String(get(w) ?? '') === text) continue;
        set(w, text);
        any = true;
        changed++;
      }
    }
    if (!any) break;
  }
  return changed;
}
