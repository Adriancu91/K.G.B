// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// 🔍 Evaluează formula (ca Evaluate Formula din Excel): formula se calculează pas cu pas, ca să vezi unde apare o greșeală.
// Pasul 1: fiecare celulă din formulă e înlocuită cu valoarea ei. Apoi, de fiecare dată, cea mai din interior pereche de paranteze
// (cu funcția ei, dacă are) e înlocuită cu rezultatul ei, până rămâne doar valoarea finală. Calculul îl face motorul de formule
// (evalExpr), deci pașii dau exact ce dă celula. Testat în tests/sheets-evalformula.test.mjs.

/** Rezultatul unei bucăți: scris ca text care se poate pune înapoi în formulă, sau null (de exemplu o listă de valori). */
export type Lit = string | null;

/** Cum se scrie o valoare în formulă: numerele cu punct, textul între ghilimele, adevărat / fals ca atare. */
export function literalOf(r: { text: string; num: boolean; value?: number; err?: string; spill?: unknown } | undefined): Lit {
  if (!r || r.spill) return null;
  if (r.err) return r.text || r.err;
  if (r.num && typeof r.value === 'number' && Number.isFinite(r.value)) return String(r.value);
  if (r.text === 'ADEVĂRAT' || r.text === 'FALS') return r.text;
  return '"' + r.text.split('"').join('""') + '"';
}

const isWord = (ch: string | undefined) => !!ch && /[\p{L}\d_.$]/u.test(ch);

/** Celulele simple din formulă (A1, $B$2), fără cele din zone (A1:B3), din alte foi (Foaie2!A1) sau din texte. */
export function cellRefs(f: string): { at: number; len: number; ref: string }[] {
  const out: { at: number; len: number; ref: string }[] = [];
  let inStr = false;
  for (let i = 0; i < f.length; i++) {
    const ch = f[i];
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr || isWord(f[i - 1]) || f[i - 1] === ':' || f[i - 1] === '!' || f[i - 1] === "'") continue;
    const m = /^\$?[A-Z]{1,3}\$?[1-9]\d*/.exec(f.slice(i));
    if (!m) continue;
    const next = f[i + m[0].length];
    if (isWord(next) || next === '(' || next === ':' || next === '!') continue;
    out.push({ at: i, len: m[0].length, ref: m[0] });
    i += m[0].length - 1;
  }
  return out;
}

/** Cea mai din interior pereche de paranteze (în afara textelor), cu numele funcției dinaintea ei: [început, sfârșit) sau null. */
export function innermost(f: string): { start: number; end: number } | null {
  let inStr = false, open = -1;
  for (let i = 0; i < f.length; i++) {
    const ch = f[i];
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '(') open = i;
    else if (ch === ')' && open >= 0) {
      let s = open;
      while (s > 0 && isWord(f[s - 1])) s--;
      return { start: s, end: i + 1 };
    }
  }
  return null;
}

/**
 * Pașii formulei f (cu „=” în față): primul e formula însăși, ultimul e valoarea finală (fără „=”).
 * evalExpr(expr) calculează o bucată de formulă (fără „=”) și întoarce valoarea ei ca text de formulă (vezi literalOf).
 */
export function formulaSteps(f: string, evalExpr: (expr: string) => Lit, max = 60): string[] {
  const steps = [f];
  if (!f.startsWith('=')) return steps;
  let s = f.slice(1);
  const final = () => { const v = evalExpr(f.slice(1)); if (v !== null) steps.push(v); return steps; };
  // 1. Celulele → valorile lor (de la dreapta la stânga, ca pozițiile să rămână bune).
  const refs = cellRefs(s);
  if (refs.length) {
    for (const r of [...refs].reverse()) {
      const v = evalExpr(r.ref);
      if (v === null) return final();
      s = s.slice(0, r.at) + v + s.slice(r.at + r.len);
    }
    steps.push('=' + s);
  }
  // 2. Parantezele, din interior spre exterior.
  for (let n = 0; n < max; n++) {
    const g = innermost(s);
    if (!g) break;
    const unit = s.slice(g.start, g.end);
    const v = evalExpr(unit);
    if (v === null) return final();
    s = s.slice(0, g.start) + v + s.slice(g.end);
    steps.push('=' + s);
  }
  // 3. Ce a rămas (de exemplu 2+3*4) → valoarea finală.
  const v = evalExpr(s);
  if (v === null) return final();
  if ('=' + v !== steps[steps.length - 1]) steps.push(v);
  else steps[steps.length - 1] = v;
  return steps;
}
