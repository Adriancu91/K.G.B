// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Căutare și înlocuire în tabel (Ctrl+F / Ctrl+H). Fără „Aa” bifat, nu contează literele mari
// și nici diacriticele: „sarbatoare” găsește „Sărbătoare”.
// Ca în Excel: „*” ține locul oricâtor litere, „?” al uneia singure, iar „~*”, „~?”, „~~” caută chiar semnul.
import { CellStyle, COLS, parseCellId, ROWS } from './format';
import { cellText } from './filter';
import type { Result } from './formula';

export interface FindOpts {
  matchCase: boolean;
  /** Doar celulele al căror conținut întreg e textul căutat (nu și cele care îl conțin). */
  whole?: boolean;
  /** Unde se caută: în ce e scris în celulă (formule), în ce se vede (valori) sau în amândouă (implicit). */
  lookIn?: 'all' | 'formulas' | 'values';
}

/** Textul pregătit pentru comparare și, pentru fiecare literă din el, poziția ei în textul original. */
function prep(s: string, opts: FindOpts): { text: string; pos: number[] } {
  if (opts.matchCase) return { text: s, pos: Array.from({ length: s.length + 1 }, (_, i) => i) };
  let text = '';
  const pos: number[] = [];
  let i = 0;
  for (const ch of s) {
    const f = ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    for (const x of f) { text += x; pos.push(i); }
    i += ch.length;
  }
  pos.push(i);
  return { text, pos };
}

const cache = new Map<string, RegExp | null>();

/** Expresia care caută textul (cu „*” și „?”), pe textul pregătit; null pentru o căutare goală. */
function matcher(q: string, opts: FindOpts): RegExp | null {
  const ck = `${opts.matchCase ? 1 : 0}${opts.whole ? 1 : 0}${q}`;
  if (cache.has(ck)) return cache.get(ck)!;
  const k = prep(q, opts).text;
  let src = '';
  for (let i = 0; i < k.length; i++) {
    const ch = k[i];
    if (ch === '~' && i + 1 < k.length && '*?~'.includes(k[i + 1])) { src += '\\' + k[++i]; continue; }
    if (ch === '*') src += '[\\s\\S]*';
    else if (ch === '?') src += '[\\s\\S]';
    else src += ch.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');
  }
  const re = k ? new RegExp(opts.whole ? `^(?:${src})$` : src, 'g') : null;
  if (cache.size > 50) cache.clear();
  cache.set(ck, re);
  return re;
}

export function textHas(s: string, q: string, opts: FindOpts): boolean {
  const re = matcher(q, opts);
  if (!re) return false;
  re.lastIndex = 0;
  const t = prep(s, opts).text;
  // „*” singur găsește orice celulă cu ceva în ea, nu și pe cele goale.
  for (let m = re.exec(t); m; m = re.exec(t)) {
    if (m[0].length || opts.whole) return true;
    re.lastIndex++;
    if (re.lastIndex > t.length) break;
  }
  return false;
}

/** Celulele care conțin textul căutat (în ce se vede sau în ce e scris în ele), rând cu rând, de sus în jos. */
export function findCells(
  cells: Record<string, string>, results: Record<string, Result>, styles: Record<string, CellStyle>,
  q: string, opts: FindOpts, hidden: Set<number> = new Set(),
): { r: number; c: number }[] {
  const out: { r: number; c: number }[] = [];
  if (!matcher(q, opts)) return out;
  const look = opts.lookIn ?? 'all';
  for (const [id, raw] of Object.entries(cells)) {
    const p = parseCellId(id);
    if (!p || p.r >= ROWS || p.c >= COLS || hidden.has(p.r)) continue;
    if ((look !== 'formulas' && textHas(cellText(raw, results[id], styles[id]), q, opts))
      || (look !== 'values' && textHas(raw, q, opts))) out.push(p);
  }
  return out.sort((a, b) => a.r - b.r || a.c - b.c);
}

/** Înlocuiește toate aparițiile din textul scris în celulă. Întoarce textul nou și de câte ori a înlocuit. */
export function replaceText(s: string, q: string, repl: string, opts: FindOpts): { text: string; n: number } {
  const re = matcher(q, opts);
  if (!re) return { text: s, n: 0 };
  const { text, pos } = prep(s, opts);
  let out = '';
  let last = 0;
  let n = 0;
  re.lastIndex = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (!m[0].length) {
      if (opts.whole && !s) break;
      re.lastIndex++;
      if (re.lastIndex > text.length) break;
      continue;
    }
    const a = pos[m.index];
    const b = pos[m.index + m[0].length] ?? s.length;
    if (a < last) continue;
    out += s.slice(last, a) + repl;
    last = b;
    n++;
  }
  return { text: out + s.slice(last), n };
}
