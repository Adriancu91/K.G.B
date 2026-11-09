// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Vizualizare → Macrocomenzi în Docs (ca View / Macros / Record Macro): tot ce schimbi în document cât timp se înregistrează
// (textul scris, ștergerile, Enter, formatarea din bară, stilurile, tabelele) se ține minte ca pașii editorului, cu pozițiile
// față de locul cursorului de la pornire. La rulare pașii se pun din nou, de la cursorul de acum (sau exact în aceleași locuri,
// fără „relativ”), într-un singur pas de Anulează. Un pas care nu se mai potrivește (documentul e altfel acolo) oprește rularea
// fără să strice nimic. Fără cod: nu se poate rula nimic altceva decât aceste schimbări. Testat în tests/docs-macros.test.mjs.

import { Step } from '@tiptap/pm/transform';
import type { Node as PMNode, Schema } from '@tiptap/pm/model';

export interface DocMacro {
  name: string;
  /** Relativ: pașii se pun de la cursorul de la rulare; altfel exact în aceleași locuri din document. */
  rel: boolean;
  /** Pașii editorului (JSON), cu pozițiile față de cursorul de la pornire la `rel`. */
  steps: Record<string, unknown>[];
  /** Cursorul la sfârșitul înregistrării, față de același loc (ancora și capătul selecției). */
  end?: [number, number];
  note?: string;
  /** Scurtătura Ctrl+Shift+literă (A–Z). */
  key?: string;
}

const POS_FIELDS = ['from', 'to', 'gapFrom', 'gapTo', 'pos'] as const;
const MAX_STEPS = 2000;

/** Pasul cu pozițiile mutate cu `d` (doar câmpurile care sunt poziții în document; `insert` e în bucata pusă, nu se mută). */
export function shiftStep(json: Record<string, unknown>, d: number): Record<string, unknown> {
  if (!d) return json;
  const out = { ...json };
  for (const f of POS_FIELDS) if (typeof out[f] === 'number') out[f] = (out[f] as number) + d;
  return out;
}

/** Pașii unei tranzacții, gata de ținut în macrocomandă (`base` = cursorul de la pornire, 0 la absolut). */
export function recordSteps(steps: readonly Step[], base: number): Record<string, unknown>[] {
  return steps.map((s) => shiftStep(s.toJSON() as Record<string, unknown>, -base));
}

export interface MacroRun {
  /** Câți pași s-au pus. */
  done: number;
  /** Pasul (de la 1) care nu s-a mai potrivit, dacă s-a oprit. */
  failed?: number;
}

/** Pune pașii macrocomenzii în tranzacția `tr` (de la `base`, la cele relative). Se oprește la primul pas care nu se potrivește:
 *  ce s-a pus până atunci rămâne, într-un singur pas de Anulează. */
export function playSteps(tr: { doc: PMNode; maybeStep(s: Step): { failed: string | null } }, schema: Schema, m: DocMacro, base: number): MacroRun {
  const d = m.rel ? base : 0;
  let done = 0;
  for (const json of m.steps) {
    let st: Step;
    try { st = Step.fromJSON(schema, shiftStep(json, d)); } catch { return { done, failed: done + 1 }; }
    let r: { failed: string | null };
    try { r = tr.maybeStep(st); } catch { return { done, failed: done + 1 }; }
    if (r.failed) return { done, failed: done + 1 };
    done++;
  }
  return { done };
}

/** Unde ajunge cursorul după rulare (strâns în document), sau null dacă macrocomanda nu ține minte asta. */
export function endSelection(m: DocMacro, base: number, size: number): [number, number] | null {
  if (!m.end) return null;
  const d = m.rel ? base : 0;
  const clamp = (x: number) => Math.max(0, Math.min(size, x + d));
  return [clamp(m.end[0]), clamp(m.end[1])];
}

/** Macrocomanda pornită de Ctrl+Shift+tasta apăsată (după e.code, ca să meargă pe orice așezare a tastaturii). */
export function docMacroForKey(list: DocMacro[] | undefined, code: string): DocMacro | undefined {
  const m = /^Key([A-Z])$/.exec(code);
  return m ? list?.find((x) => x.key === m[1]) : undefined;
}

/** Macrocomenzile citite din fișier sau din setări, doar cu câmpurile cunoscute (ce e stricat se sare). */
export function cleanDocMacros(v: unknown): DocMacro[] {
  if (!Array.isArray(v)) return [];
  const out: DocMacro[] = [];
  for (const x of v.slice(0, 200)) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name.trim().slice(0, 60) : '';
    if (!name || out.some((m) => m.name === name) || !Array.isArray(o.steps)) continue;
    const steps = o.steps.filter((s): s is Record<string, unknown> => !!s && typeof s === 'object' && typeof (s as { stepType?: unknown }).stepType === 'string').slice(0, MAX_STEPS);
    if (!steps.length) continue;
    const m: DocMacro = { name, rel: o.rel !== false, steps };
    if (Array.isArray(o.end) && o.end.length === 2 && o.end.every((n) => Number.isInteger(n))) m.end = [o.end[0] as number, o.end[1] as number];
    if (typeof o.note === 'string' && o.note.trim()) m.note = o.note.trim().slice(0, 300);
    if (typeof o.key === 'string' && /^[A-Z]$/.test(o.key) && !out.some((k) => k.key === o.key)) m.key = o.key;
    out.push(m);
  }
  return out;
}

/** Ce e greșit la numele unei macrocomenzi noi (sau redenumite; `self` = poziția ei în listă), '' dacă e bun. */
export function docMacroNameError(name: string, list: { name: string }[], self = -1): string {
  const n = name.trim();
  if (!n) return 'Scrie un nume pentru macrocomandă.';
  if (list.some((m, i) => i !== self && m.name.toLowerCase() === n.toLowerCase())) return `Există deja o macrocomandă „${n}”.`;
  return '';
}

/** Câte litere scrie macrocomanda (pentru coloana din listă): textul pus de pași. */
export function macroChars(m: DocMacro): number {
  let n = 0;
  const walk = (c: unknown) => {
    if (Array.isArray(c)) c.forEach(walk);
    else if (c && typeof c === 'object') {
      const o = c as { text?: unknown; content?: unknown };
      if (typeof o.text === 'string') n += o.text.length;
      walk(o.content);
    }
  };
  for (const s of m.steps) walk((s.slice as { content?: unknown } | undefined)?.content);
  return n;
}

export const MAX_MACRO_STEPS = MAX_STEPS;
