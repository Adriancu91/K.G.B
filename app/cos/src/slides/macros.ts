// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Vizualizare → Macrocomenzi în Slides (ca View / Macros): ce schimbi pe slide cât timp se înregistrează se ține minte ca pași
// față de casetele alese: formatul și textul lor (proprietățile schimbate), mutarea și mărirea (cu cât, nu unde), ștergerea lor,
// casetele noi puse pe slide (cu locul lor) și ce s-a schimbat la slide (fundal, tranziție, aspect). La rulare pașii se pun pe
// slide-ul de acum și pe casetele alese acum, într-un singur pas de Anulează. Fără cod: nu se poate rula nimic altceva decât
// aceste schimbări. Un slide nou pus cât timp se înregistrează e și el un pas: la rulare intră un slide la fel după slide-ul de acum,
// iar pașii de după el se pun pe slide-ul nou. Testat în tests/slides-macros.test.mjs.

import type { Slide, SlideEl } from './model';

type Props = Record<string, unknown>;

export interface SlideMacroStep {
  /** Proprietățile schimbate ale casetelor alese (null = scoasă; „+x” = cu cât s-a mutat / mărit). */
  sel?: Props;
  /** Caseta pusă pe slide (fără id; la rulare primește unul nou). */
  add?: Props;
  /** Proprietățile schimbate ale casetei puse de al `n`-lea pas „add” al macrocomenzii. */
  upd?: { n: number; p: Props };
  /** Casetele alese au fost șterse. */
  del?: true;
  /** Proprietățile schimbate ale slide-ului (fundal, tranziție, aspect…). */
  slide?: Props;
  /** Un slide nou, pus după cel de atunci (fără id, cu casetele lui fără id); pașii următori se pun pe el. */
  newSlide?: Props;
}

export interface SlideMacro {
  name: string;
  steps: SlideMacroStep[];
  note?: string;
  key?: string;
}

/** Mărimile care se țin ca diferență („cu cât”), ca macrocomanda să mute casetele alese, nu să le pună una peste alta. */
const DELTA = ['x', 'y', 'w', 'h'];
const MAX_STEPS = 500;
/** Cele mai multe slide-uri noi puse de o rulare. */
const MAX_NEW_SLIDES = 50;

/** Pasul „slide nou”: slide-ul fără id-uri (el și casetele lui primesc altele la rulare). Casetele lui intră în `created`,
 *  ca schimbările de după pe ele (titlul scris) să fie pași „upd”, ca la casetele puse de macrocomandă. */
export function newSlideStep(s: Slide, created?: Map<string, number>): SlideMacroStep {
  for (const e of s.els) created?.set(e.id, created.size);
  const { id: _id, els, ...rest } = s;
  return { newSlide: { ...rest, els: els.map(({ id: _e, ...e }) => e) } };
}

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** Proprietățile schimbate de la `a` la `b` (fără cele din `skip`), sau null dacă nu s-a schimbat nimic. */
export function propDiff(a: Props, b: Props, skip: string[], delta: string[] = []): Props | null {
  const out: Props = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (skip.includes(k) || same(a[k], b[k])) continue;
    if (delta.includes(k) && typeof a[k] === 'number' && typeof b[k] === 'number') out['+' + k] = (b[k] as number) - (a[k] as number);
    else out[k] = k in b && b[k] !== undefined ? b[k] : null;
  }
  return Object.keys(out).length ? out : null;
}

/** Pune proprietățile pe un obiect (null scoate; „+x” adună). */
export function applyProps<T extends Props>(o: T, p: Props): T {
  const out: Props = { ...o };
  for (const [k, v] of Object.entries(p)) {
    if (k === 'id' || k === 'els') continue;
    if (k.startsWith('+')) { const n = k.slice(1); if (typeof out[n] === 'number' && typeof v === 'number') out[n] = Math.round(((out[n] as number) + v) * 100) / 100; }
    else if (v === null) delete out[k];
    else out[k] = v;
  }
  return out as T;
}

const mergeProps = (a: Props, b: Props): Props => {
  const out: Props = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = k.startsWith('+') && typeof out[k] === 'number' && typeof v === 'number' ? (out[k] as number) + v : v;
  return out;
};

/** Pașii unei schimbări a slide-ului (`before` → `after`): `sel` = casetele alese acum, `created` = casetele puse de la
 *  pornirea înregistrării (id → al câtelea „add”), completată aici. */
export function diffSlide(before: Slide, after: Slide, sel: Set<string>, created: Map<string, number>): SlideMacroStep[] {
  const out: SlideMacroStep[] = [];
  const s = propDiff(before as unknown as Props, after as unknown as Props, ['id', 'els', 'comments']);
  if (s) out.push({ slide: s });
  const old = new Map(before.els.map((e) => [e.id, e]));
  const now = new Set(after.els.map((e) => e.id));
  if (before.els.some((e) => sel.has(e.id) && !now.has(e.id) && !created.has(e.id))) out.push({ del: true });
  let selDone = false;
  for (const e of after.els) {
    const o = old.get(e.id);
    if (!o) {
      created.set(e.id, created.size);
      const { id: _id, ...rest } = e;
      out.push({ add: rest as Props });
      continue;
    }
    const d = propDiff(o as unknown as Props, e as unknown as Props, ['id'], DELTA);
    if (!d) continue;
    const n = created.get(e.id);
    if (n !== undefined) out.push({ upd: { n, p: d } });
    // Mai multe casete alese schimbate deodată (de exemplu culoarea pusă pe toate): pasul se ține o dată, după prima.
    else if (sel.has(e.id) && !selDone) { out.push({ sel: d }); selDone = true; }
  }
  return out;
}

/** Câte casete puse are lista de pași: cele „add” și cele ale slide-urilor noi (numărul lor e `upd.n`). */
const madeCount = (steps: SlideMacroStep[]) => steps.reduce((k, x) => k + (x.add ? 1 : 0) + (Array.isArray(x.newSlide?.els) ? (x.newSlide!.els as unknown[]).length : 0), 0);

/** Adaugă pașii noi la cei de până acum, unind pașii la rând de același fel (literele scrise una după alta, tragerea). */
export function addSteps(list: SlideMacroStep[], steps: SlideMacroStep[]): SlideMacroStep[] {
  const out = [...list];
  for (const st of steps) {
    const last = out[out.length - 1];
    if (last?.sel && st.sel) out[out.length - 1] = { sel: mergeProps(last.sel, st.sel) };
    else if (last?.slide && st.slide) out[out.length - 1] = { slide: mergeProps(last.slide, st.slide) };
    else if (last?.upd && st.upd && last.upd.n === st.upd.n) out[out.length - 1] = { upd: { n: st.upd.n, p: mergeProps(last.upd.p, st.upd.p) } };
    else if (last?.add && st.upd && st.upd.n === madeCount(out) - 1) out[out.length - 1] = { add: applyProps(last.add, st.upd.p) };
    else if (out.length < MAX_STEPS) out.push(st);
  }
  return out;
}

export interface SlideMacroRun {
  slide: Slide;
  /** Slide-urile noi puse de macrocomandă, în ordine, de pus după slide-ul de acum. */
  added: Slide[];
  /** Casetele alese după rulare (cele puse de macrocomandă, altfel cele alese de la început, dacă mai sunt). */
  sel: string[];
  /** Pașii pe casetele alese care n-au avut pe ce să se pună (nicio casetă aleasă). */
  skipped: number;
}

/** Rulează macrocomanda pe slide-ul `slide`, cu casetele `sel` alese; `newId` dă id-urile casetelor noi. */
export function playSlideMacro(slide: Slide, sel: string[], m: SlideMacro, newId: () => string): SlideMacroRun {
  let els = slide.els;
  let s: Slide = slide;
  let cur = sel.filter((id) => els.some((e) => e.id === id));
  const made: string[] = [];
  let skipped = 0;
  const done: Slide[] = [];
  for (const st of m.steps) {
    if (st.newSlide) {
      if (done.length >= MAX_NEW_SLIDES) { skipped++; continue; }
      done.push({ ...s, els });
      const { els: nel, ...rest } = st.newSlide as Props & { els?: unknown };
      s = { ...(rest as unknown as Slide), id: newId() };
      // Toate casetele se numără (și cele stricate, ca numerele „upd.n” să se potrivească), dar intră doar cele bune.
      els = (Array.isArray(nel) ? nel : []).flatMap((e) => { const id = newId(); made.push(id); return e && typeof e === 'object' ? [{ ...(e as unknown as SlideEl), id }] : []; });
      cur = [];
      continue;
    }
    if (st.slide) s = applyProps(s as unknown as Props, st.slide) as unknown as Slide;
    if (st.sel) { if (cur.length) els = els.map((e) => (cur.includes(e.id) ? applyProps(e as unknown as Props, st.sel!) as unknown as SlideEl : e)); else skipped++; }
    if (st.del) { if (cur.length) { els = els.filter((e) => !cur.includes(e.id)); cur = []; } else skipped++; }
    if (st.add) { const id = newId(); made.push(id); els = [...els, { ...(st.add as unknown as SlideEl), id }]; }
    if (st.upd) { const id = made[st.upd.n]; if (id) els = els.map((e) => (e.id === id ? applyProps(e as unknown as Props, st.upd!.p) as unknown as SlideEl : e)); }
  }
  // Fără slide-uri noi, slide-ul de acum își păstrează id-ul; altfel el e primul din listă, iar cel nou de la urmă e `added`.
  const all = [...done, { ...s, els }];
  const first = { ...all[0], id: slide.id };
  const lastEls = all[all.length - 1].els;
  const sel2 = made.filter((id) => lastEls.some((e) => e.id === id));
  return { slide: first, added: all.slice(1), sel: sel2.length ? [sel2[sel2.length - 1]] : cur, skipped };
}

/** Macrocomenzile citite din fișier sau din setări, doar cu câmpurile cunoscute (ce e stricat se sare). */
export function cleanSlideMacros(v: unknown): SlideMacro[] {
  if (!Array.isArray(v)) return [];
  const out: SlideMacro[] = [];
  const obj = (x: unknown): x is Props => !!x && typeof x === 'object' && !Array.isArray(x);
  for (const x of v.slice(0, 200)) {
    if (!obj(x)) continue;
    const name = typeof x.name === 'string' ? x.name.trim().slice(0, 60) : '';
    if (!name || out.some((m) => m.name === name) || !Array.isArray(x.steps)) continue;
    const steps: SlideMacroStep[] = [];
    for (const st of x.steps.slice(0, MAX_STEPS)) {
      if (!obj(st)) continue;
      const k: SlideMacroStep = {};
      if (obj(st.sel)) k.sel = st.sel;
      if (obj(st.add) && typeof st.add.kind === 'string') k.add = st.add;
      if (obj(st.upd) && Number.isInteger(st.upd.n) && obj(st.upd.p)) k.upd = { n: st.upd.n as number, p: st.upd.p };
      if (st.del === true) k.del = true;
      if (obj(st.slide)) k.slide = st.slide;
      if (obj(st.newSlide) && Array.isArray(st.newSlide.els)) k.newSlide = st.newSlide;
      if (Object.keys(k).length) steps.push(k);
    }
    if (!steps.length) continue;
    const m: SlideMacro = { name, steps };
    if (typeof x.note === 'string' && x.note.trim()) m.note = x.note.trim().slice(0, 300);
    if (typeof x.key === 'string' && /^[A-Z]$/.test(x.key) && !out.some((o) => o.key === x.key)) m.key = x.key;
    out.push(m);
  }
  return out;
}
