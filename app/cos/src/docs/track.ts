// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Urmărirea modificărilor (ca „Track Changes” din Word): cât e pornită, textul scris e marcat ca adăugat (verde, subliniat),
// iar textul șters nu dispare, ci rămâne tăiat cu roșu. Fiecare modificare se poate accepta sau respinge.
// Ce ai adăugat chiar tu și ștergi apoi dispare de-a binelea (nu e nevoie să rămână ca propunere).
// Schimbările de format (aldin, cursiv, culoare, font…) se urmăresc și ele (Track formatting): textul primește un semn
// „formatChange” care ține minte ce s-a pus și ce s-a scos, ca respingerea să readucă formatul de dinainte.
import { Extension, Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection, Transaction } from '@tiptap/pm/state';
import { AddMarkStep, AttrStep, RemoveMarkStep, ReplaceAroundStep, ReplaceStep } from '@tiptap/pm/transform';
import { Fragment, Slice, Node as PMNode, Mark as PMMark, MarkType, Schema } from '@tiptap/pm/model';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    trackChanges: {
      setTracking: (on: boolean, author?: string) => ReturnType;
      acceptChange: (from: number, to: number, kind: ChangeKind) => ReturnType;
      rejectChange: (from: number, to: number, kind: ChangeKind) => ReturnType;
      acceptAllChanges: () => ReturnType;
      rejectAllChanges: () => ReturnType;
    };
  }
}

export type ChangeKind = 'insertion' | 'deletion' | 'format' | 'paragraph';

export interface DocChange {
  kind: ChangeKind;
  author: string;
  date: string;
  from: number;
  to: number;
  text: string;
  /** La schimbările de format: ce s-a schimbat, pe scurt („Aldin, fără Cursiv”), și pe bucăți (pentru afișare). */
  desc?: string;
  parts?: { label: string; not: boolean }[];
}

/** O schimbare de format: un semn pus (add) sau scos (remove), cu atributele lui. */
export interface FormatOp { op: 'add' | 'remove'; type: string; attrs?: Record<string, unknown> }

/** Semnele de format care se urmăresc (nu și comentariile, legăturile sau semnele urmăririi). */
export const TRACKED_FORMATS: Record<string, string> = {
  bold: 'Aldin', italic: 'Cursiv', underline: 'Subliniat', strike: 'Tăiat', textStyle: 'Font / culoare', highlight: 'Evidențiere',
  subscript: 'Indice', superscript: 'Exponent', code: 'Cod',
};

const sameOp = (a: FormatOp, b: FormatOp) => a.type === b.type && JSON.stringify(a.attrs ?? {}) === JSON.stringify(b.attrs ?? {});

/** Lista de schimbări după încă una: o schimbare care o anulează pe una de dinainte (pus apoi scos) le scoate pe amândouă. */
export function mergeFormatOps(ops: FormatOp[], next: FormatOp): FormatOp[] {
  const i = ops.findIndex((o) => o.op !== next.op && sameOp(o, next));
  if (i >= 0) return ops.filter((_, k) => k !== i);
  return [...ops, next];
}

/** Bucățile descrierii: numele formatului și dacă a fost scos („fără”); „Font / culoare” o singură dată (scos + pus = schimbat). */
export function formatParts(ops: FormatOp[]): { label: string; not: boolean }[] {
  const out: { label: string; not: boolean }[] = [];
  for (const o of ops) {
    const label = TRACKED_FORMATS[o.type] ?? o.type;
    const not = o.op === 'remove' && !ops.some((x) => x.type === o.type && x.op === 'add');
    if (!out.some((p) => p.label === label && p.not === not)) out.push({ label, not });
  }
  return out;
}

/** Descrierea scurtă a schimbărilor: „Aldin, fără Cursiv”. */
export function describeFormat(ops: FormatOp[]): string {
  return formatParts(ops).map((p) => (p.not ? 'fără ' : '') + p.label).join(', ');
}

/**
 * Schimbarea urmărită a unui paragraf (alinierea sau stilul: paragraf / titlu), ținută în atributul pchange al paragrafului
 * (JSON): autorul, data și cum era paragraful înainte; respingerea îl readuce așa.
 */
export interface ParaChange { author: string; date: string; old: ParaLook }

/**
 * Forma unui paragraf care se urmărește: felul (paragraf / titlu cu nivel), alinierea, retragerea la stânga (trepte)
 * și spațierea (înainte / după în puncte, rândurile în „rânduri”; null = cea obișnuită). Câmpurile lipsă nu s-au schimbat.
 */
export interface ParaLook { type: string; level?: number; textAlign?: string; indent?: number; indentRight?: number | null; firstLine?: number | null; spaceBefore?: number | null; spaceAfter?: number | null; lineHeight?: number | null }

export function parsePara(s: unknown): ParaChange | null {
  try { const v = JSON.parse(String(s || '')); return v && typeof v === 'object' && v.old ? v : null; } catch { return null; }
}

const alignOf = (a: unknown) => (a === 'center' || a === 'right' || a === 'justify' ? a : 'left');
const numOf = (v: unknown) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const SPACING = ['spaceBefore', 'spaceAfter', 'lineHeight'] as const;
/** Retragerea la dreapta și prima linie (cm; negativ = agățată), alături de treptele de retragere. */
const INDENTS = ['indentRight', 'firstLine'] as const;

/** Forma de acum a paragrafului. */
export function paraLook(n: PMNode): ParaLook {
  return {
    type: n.type.name, ...(n.type.name === 'heading' ? { level: Number(n.attrs.level) || 1 } : {}), textAlign: alignOf(n.attrs.textAlign),
    indent: Number(n.attrs.indent) || 0, indentRight: numOf(n.attrs.indentRight) || null, firstLine: numOf(n.attrs.firstLine) || null, spaceBefore: numOf(n.attrs.spaceBefore), spaceAfter: numOf(n.attrs.spaceAfter), lineHeight: numOf(n.attrs.lineHeight),
  };
}

/** Ce s-a schimbat la paragraf față de forma veche: „Stil de paragraf”, „Aliniere”, „Retragere”, „Spațiere” (gol = nimic). */
function paraDiff(old: ParaLook, node: PMNode): string[] {
  const now = paraLook(node);
  const out: string[] = [];
  if (old.type !== now.type || (now.type === 'heading' && Number(old.level) !== Number(now.level))) out.push('Stil de paragraf');
  if (alignOf(old.textAlign) !== now.textAlign) out.push('Aliniere');
  if (('indent' in old && (Number(old.indent) || 0) !== now.indent) || INDENTS.some((k) => k in old && (numOf(old[k]) || null) !== now[k])) out.push('Retragere');
  if (SPACING.some((k) => k in old && numOf(old[k]) !== now[k])) out.push('Spațiere');
  return out;
}

/** Ce s-a schimbat la paragraf față de cum era (sau doar „Paragraf”, dacă nimic nu mai diferă). */
export function paraParts(node: PMNode, p: ParaChange): { label: string; not: boolean }[] {
  const out = paraDiff(p.old, node).map((label) => ({ label, not: false }));
  return out.length ? out : [{ label: 'Paragraf', not: false }];
}

export function parseOps(s: unknown): FormatOp[] {
  try { const v = JSON.parse(String(s || '[]')); return Array.isArray(v) ? v : []; } catch { return []; }
}

export const trackKey = new PluginKey('trackChanges');

const changeMark = (name: ChangeKind, cls: string) => Mark.create({
  name,
  // Textul scris lângă o modificare nu o moștenește (îl marcăm noi, doar când urmărirea e pornită).
  inclusive: false,
  addAttributes() {
    const attr = (a: string) => ({
      default: '',
      parseHTML: (el: HTMLElement) => el.getAttribute(`data-${a}`) ?? '',
      renderHTML: (v: Record<string, string>) => ({ [`data-${a}`]: v[a] }),
    });
    return { author: attr('author'), date: attr('date') };
  },
  parseHTML() {
    return [{ tag: `span.${cls}` }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: cls }), 0];
  },
});

export const Insertion = changeMark('insertion', 'doc-ins');
export const Deletion = changeMark('deletion', 'doc-del');
export const FormatChange = Mark.create({
  name: 'formatChange',
  inclusive: false,
  // Poate sta peste orice alt semn (și peste alt formatChange nu, ci se înlocuiește).
  addAttributes() {
    const attr = (a: string) => ({
      default: '',
      parseHTML: (el: HTMLElement) => el.getAttribute(`data-${a}`) ?? '',
      renderHTML: (v: Record<string, string>) => ({ [`data-${a}`]: v[a] }),
    });
    return { author: attr('author'), date: attr('date'), ops: attr('ops') };
  },
  parseHTML() {
    return [{ tag: 'span.doc-fmt' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'doc-fmt', title: 'Format schimbat: ' + describeFormat(parseOps(HTMLAttributes['data-ops'])) }), 0];
  },
});

/** Modificările documentului, în ordine; bucățile alăturate de același fel și autor formează o singură modificare. */
export function listChanges(doc: PMNode): DocChange[] {
  const out: DocChange[] = [];
  doc.descendants((node, pos) => {
    if (!node.isInline) {
      const p = node.isTextblock ? parsePara(node.attrs.pchange) : null;
      if (p) {
        const parts = paraParts(node, p);
        out.push({ kind: 'paragraph', author: p.author ?? '', date: p.date ?? '', from: pos + 1, to: pos + node.nodeSize - 1, text: node.textContent || ' ', desc: parts.map((x) => x.label).join(', '), parts });
      }
      return true;
    }
    for (const m of node.marks) {
      const kind = m.type.name;
      if (kind !== 'insertion' && kind !== 'deletion' && kind !== 'formatChange') continue;
      const k: ChangeKind = kind === 'formatChange' ? 'format' : kind;
      const parts = k === 'format' ? formatParts(parseOps(m.attrs.ops)) : undefined;
      const desc = parts?.map((p) => (p.not ? 'fără ' : '') + p.label).join(', ');
      const end = pos + node.nodeSize;
      const last = [...out].reverse().find((c) => c.kind === k);
      if (last && last.to === pos && last.author === m.attrs.author && last.desc === desc) {
        last.to = end;
        last.text += node.text ?? ' ';
      } else {
        out.push({ kind: k, author: m.attrs.author ?? '', date: m.attrs.date ?? '', from: pos, to: end, text: node.text ?? ' ', ...(parts ? { desc, parts } : {}) });
      }
    }
    return false;
  });
  return out.sort((a, b) => a.from - b.from);
}

/**
 * Modificarea următoare (dir = 1) sau anterioară (dir = -1) față de cursorul aflat la `from` (ca în Word: Revizuire → Următoarea / Anterioara).
 * După ultima se întoarce la prima (și invers). Null dacă nu sunt modificări.
 */
export function nearChange(changes: DocChange[], from: number, dir: 1 | -1): DocChange | null {
  if (!changes.length) return null;
  if (dir === 1) return changes.find((c) => c.from > from) ?? changes[0];
  return [...changes].reverse().find((c) => c.from < from) ?? changes[changes.length - 1];
}

// Data pe minute: textul scris în același minut rămâne o singură bucată.
const nowMinute = () => new Date().toISOString().slice(0, 16) + ':00Z';

/** Readuce formatul de dinainte pe [from, to]: schimbările se desfac de la ultima la prima. */
function undoFormat(tr: Transaction, schema: Schema, from: number, to: number, ops: FormatOp[]) {
  for (const o of [...ops].reverse()) {
    const type = schema.marks[o.type];
    if (!type) continue;
    const mark = type.create(o.attrs ?? {});
    // Semnul pus se scoate după fel (ca să meargă și când atributele lui nu se potrivesc întocmai, de exemplu la import).
    if (o.op === 'add') tr.removeMark(from, to, type);
    else tr.addMark(from, to, mark);
  }
}

/** Pune semnul formatChange pe textul ale cărui semne de format s-au schimbat (fără textul abia adăugat, deja marcat). */
function trackFormat(steps: (AddMarkStep | RemoveMarkStep)[], tr: Transaction, author: string): Transaction | null {
  const schema = tr.doc.type.schema;
  const fmt = schema.marks.formatChange, ins = schema.marks.insertion, del = schema.marks.deletion;
  if (!fmt) return null;
  const date = nowMinute();
  for (const s of steps) {
    const m = s.mark as PMMark;
    if (!(m.type.name in TRACKED_FORMATS)) continue;
    const op: FormatOp = { op: s instanceof AddMarkStep ? 'add' : 'remove', type: m.type.name, ...(Object.keys(m.attrs).length ? { attrs: m.attrs } : {}) };
    const parts: { from: number; to: number; ops: FormatOp[] }[] = [];
    tr.doc.nodesBetween(s.from, s.to, (n, pos) => {
      if (!n.isInline) return true;
      if (ins?.isInSet(n.marks) || del?.isInSet(n.marks)) return false;
      const old = fmt.isInSet(n.marks);
      parts.push({ from: Math.max(pos, s.from), to: Math.min(pos + n.nodeSize, s.to), ops: mergeFormatOps(old ? parseOps(old.attrs.ops) : [], op) });
      return false;
    });
    for (const p of parts) {
      if (p.to <= p.from) continue;
      tr.removeMark(p.from, p.to, fmt);
      if (p.ops.length) tr.addMark(p.from, p.to, fmt.create({ author, date, ops: JSON.stringify(p.ops) }));
    }
  }
  return tr.docChanged ? tr.setMeta(trackKey, true) : null;
}

/**
 * Paragrafele (și titlurile) al căror fel, nivel sau aliniere diferă de documentul de dinainte primesc semnul pchange
 * cu forma lor inițială; un paragraf readus la forma inițială îl pierde. Pozițiile sunt aceleași (doar atribute schimbate).
 */
function trackPara(before: PMNode, tr: Transaction, author: string) {
  const date = nowMinute();
  tr.doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    if (!('pchange' in node.attrs)) return false;
    const old = before.nodeAt(pos);
    if (!old?.isTextblock || old.textContent !== node.textContent) return false;
    const was = paraLook(old);
    if (!paraDiff(was, node).length && (node.attrs.pchange || '') === (old.attrs.pchange || '')) return false;
    // Forma inițială: cea ținută deja de paragraf (schimbat de mai multe ori) sau cea de dinainte de pasul acesta.
    const prev = parsePara(old.attrs.pchange) ?? parsePara(node.attrs.pchange);
    const orig = prev?.old ?? was;
    const val = !paraDiff(orig, node).length ? '' : JSON.stringify({ author: prev?.author || author, date: prev?.date || date, old: orig });
    if (val !== (node.attrs.pchange || '')) tr.setNodeMarkup(pos, undefined, { ...node.attrs, pchange: val });
    return false;
  });
}

export const TrackChanges = Extension.create<Record<string, never>, { enabled: boolean; author: string }>({
  name: 'trackChanges',

  addStorage() {
    return { enabled: false, author: '' };
  },

  // Semnul schimbării de paragraf (vezi ParaChange), cu o bară pe margine ca la celelalte modificări.
  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading'],
      attributes: {
        pchange: {
          default: '',
          keepOnSplit: false,
          parseHTML: (el: HTMLElement) => el.getAttribute('data-pchange') ?? '',
          renderHTML: (a: Record<string, unknown>) => (a.pchange ? { 'data-pchange': a.pchange, class: 'doc-pchg' } : {}),
        },
      },
    }];
  },

  addCommands() {
    const skip = (tr: Transaction) => tr.setMeta(trackKey, true);
    const types = (state: { schema: Schema }) => ({
      insertion: state.schema.marks.insertion, deletion: state.schema.marks.deletion, format: state.schema.marks.formatChange, schema: state.schema,
    });
    // Acceptă: „adăugat” rămâne text obișnuit, „șters” dispare. Respinge: invers.
    // Formatul: acceptat = rămâne cum e acum; respins = fiecare bucată revine la formatul ei de dinainte.
    const apply = (tr: Transaction, c: { from: number; to: number; kind: ChangeKind }, accept: boolean, t: Record<Exclude<ChangeKind, 'paragraph'>, MarkType> & { schema: Schema }) => {
      // Paragraful: acceptat = rămâne cum e și pierde semnul; respins = revine la felul (paragraf / titlu) și alinierea de dinainte.
      if (c.kind === 'paragraph') {
        const $a = tr.doc.resolve(c.from);
        const node = $a.parent, pos = $a.before();
        const p = node.isTextblock ? parsePara(node.attrs.pchange) : null;
        if (!p) return;
        if (accept) { tr.setNodeMarkup(pos, undefined, { ...node.attrs, pchange: '' }); return; }
        const type = t.schema.nodes[p.old.type] ?? node.type;
        const attrs: Record<string, unknown> = { ...node.attrs, pchange: '', textAlign: alignOf(p.old.textAlign) };
        if ('indent' in p.old) attrs.indent = Number(p.old.indent) || 0;
        for (const k of INDENTS) if (k in p.old) attrs[k] = numOf(p.old[k]) || null;
        for (const k of SPACING) if (k in p.old) attrs[k] = k === 'lineHeight' && numOf(p.old[k]) !== null ? String(p.old[k]) : numOf(p.old[k]);
        if (type.name === 'heading') attrs.level = Math.min(6, Math.max(1, Number(p.old.level) || 1));
        tr.setNodeMarkup(pos, type, attrs);
        return;
      }
      if (c.kind === 'format') {
        if (!t.format) return;
        if (!accept) {
          const parts: { from: number; to: number; ops: FormatOp[] }[] = [];
          tr.doc.nodesBetween(c.from, c.to, (n, pos) => {
            if (!n.isInline) return true;
            const m = t.format.isInSet(n.marks);
            if (m) parts.push({ from: Math.max(pos, c.from), to: Math.min(pos + n.nodeSize, c.to), ops: parseOps(m.attrs.ops) });
            return false;
          });
          for (const p of parts) undoFormat(tr, t.schema, p.from, p.to, p.ops);
        }
        tr.removeMark(c.from, c.to, t.format);
        return;
      }
      const keep = (c.kind === 'insertion') === accept;
      if (keep) { tr.removeMark(c.from, c.to, t[c.kind]); return; }
      // Un paragraf care era tot șters (la Acceptă) sau tot inserat (la Respinge) dispare cu totul, nu rămâne un rând gol.
      const $a = tr.doc.resolve(c.from), $b = tr.doc.resolve(c.to);
      const whole = $a.sameParent($b) && $a.parent.isTextblock && $a.parentOffset === 0 && $b.parentOffset === $a.parent.content.size
        && $a.depth >= 1 && $a.node($a.depth - 1).childCount > 1;
      if (whole) tr.delete($a.before(), $a.after());
      else tr.delete(c.from, c.to);
    };
    return {
      setTracking: (on, author) => () => {
        this.storage.enabled = on;
        if (author !== undefined) this.storage.author = author;
        return true;
      },
      acceptChange: (from, to, kind) => ({ tr, state, dispatch }) => {
        apply(skip(tr), { from, to, kind }, true, types(state));
        dispatch?.(tr);
        return true;
      },
      rejectChange: (from, to, kind) => ({ tr, state, dispatch }) => {
        apply(skip(tr), { from, to, kind }, false, types(state));
        dispatch?.(tr);
        return true;
      },
      acceptAllChanges: () => ({ tr, state, dispatch }) => {
        for (const c of listChanges(state.doc).reverse()) apply(skip(tr), { ...c, from: tr.mapping.map(c.from), to: tr.mapping.map(c.to) }, true, types(state));
        dispatch?.(tr);
        return true;
      },
      rejectAllChanges: () => ({ tr, state, dispatch }) => {
        for (const c of listChanges(state.doc).reverse()) apply(skip(tr), { ...c, from: tr.mapping.map(c.from), to: tr.mapping.map(c.to) }, false, types(state));
        dispatch?.(tr);
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const storage = this.storage;
    return [new Plugin({
      key: trackKey,
      props: {
        // Backspace / Delete le facem noi, cu poziții exacte (din DOM nu se știe sigur care din „00” s-a șters).
        // Peste textul deja tăiat doar trecem cu cursorul.
        handleKeyDown(view, event) {
          if (!storage.enabled || (event.key !== 'Backspace' && event.key !== 'Delete') || event.ctrlKey || event.altKey || event.metaKey) return false;
          const back = event.key === 'Backspace';
          const { state } = view;
          const sel = state.selection;
          const delType = state.schema.marks.deletion;
          if (!sel.empty) {
            view.dispatch(state.tr.deleteSelection().setMeta('trackDir', 'sel'));
            return true;
          }
          const $pos = sel.$head;
          const pos = $pos.pos;
          // La marginea paragrafului lăsăm comportamentul obișnuit (unirea paragrafelor nu se urmărește).
          if (back ? $pos.parentOffset === 0 : $pos.parentOffset === $pos.parent.content.size) return false;
          const from = back ? pos - 1 : pos;
          const node = state.doc.nodeAt(from);
          if (node && delType.isInSet(node.marks)) {
            view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, back ? from : from + 1)));
            return true;
          }
          view.dispatch(state.tr.delete(from, from + 1).setMeta('trackDir', back ? 'back' : 'fwd'));
          return true;
        },
      },
      appendTransaction(trs, oldState, newState) {
        if (!storage.enabled || trs.length !== 1) return null;
        const t = trs[0];
        const markStep = (s: unknown) => s instanceof AddMarkStep || s instanceof RemoveMarkStep;
        const paraStep = (s: unknown) => s instanceof ReplaceAroundStep || s instanceof AttrStep;
        // Alinierea / stilul paragrafelor schimbate (fără text mutat): paragraful ține minte cum era (ParaChange).
        if (t.docChanged && !t.getMeta(trackKey) && !t.getMeta('history$') && t.steps.some(paraStep) && t.steps.every((s) => paraStep(s) || markStep(s))
          && t.before.content.size === newState.doc.content.size) {
          const tr = newState.tr;
          trackPara(t.before, tr, storage.author);
          const marks = t.steps.filter(markStep) as (AddMarkStep | RemoveMarkStep)[];
          if (marks.length) trackFormat(marks, tr, storage.author);
          return tr.docChanged ? tr.setMeta(trackKey, true) : null;
        }
        if (t.docChanged && !t.getMeta(trackKey) && !t.getMeta('history$') && t.steps.every((s) => s instanceof AddMarkStep || s instanceof RemoveMarkStep)) {
          return trackFormat(t.steps as (AddMarkStep | RemoveMarkStep)[], newState.tr, storage.author);
        }
        // Doar modificările simple ale utilizatorului (scris, șters, lipit); nu și Anulează/Refă sau ce facem noi.
        if (!t.docChanged || t.getMeta(trackKey) || t.getMeta('history$') || t.steps.length !== 1 || !(t.steps[0] instanceof ReplaceStep)) return null;
        const step = t.steps[0] as ReplaceStep;
        const { from, to } = step;
        // Înlocuirea întregului document (deschidere, șablon, import) nu e o modificare de urmărit.
        if (from === 0 && to === t.before.content.size) return null;
        const { schema } = newState;
        const insType = schema.marks.insertion;
        const delType = schema.marks.deletion;
        const author = storage.author;
        const date = nowMinute();
        const tr = newState.tr;
        const insSize = step.slice.size;
        if (insSize > 0) {
          tr.removeMark(from, from + insSize, delType);
          tr.addMark(from, from + insSize, insType.create({ author, date }));
        }
        let restored = 0;
        if (to > from) {
          const deleted = t.before.slice(from, to);
          let hasText = false;
          // Textul șters revine tăiat; cel adăugat chiar de tine (încă neacceptat) dispare de-a binelea.
          const mapFrag = (frag: Fragment): Fragment => {
            const out: PMNode[] = [];
            frag.forEach((n) => {
              if (n.isInline) {
                if (n.marks.some((m) => m.type === insType && m.attrs.author === author)) return;
                hasText = true;
                out.push(n.mark(delType.create({ author, date }).addToSet(n.marks)));
              } else out.push(n.copy(mapFrag(n.content)));
            });
            return Fragment.fromArray(out);
          };
          const marked = new Slice(mapFrag(deleted.content), deleted.openStart, deleted.openEnd);
          if (hasText) {
            const size = tr.doc.content.size;
            tr.replace(from, from, marked);
            restored = tr.doc.content.size - size;
          }
        }
        if (!tr.docChanged) return null;
        // Cursorul: Backspace rămâne în fața textului tăiat, Delete trece după el, scrisul rămâne după textul nou.
        const dir = t.getMeta('trackDir') as string | undefined;
        const old = oldState.selection;
        let pos = from + restored + insSize;
        if (!insSize && (dir === 'back' || (!dir && old.empty && old.head === to))) pos = from;
        try { tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(pos, tr.doc.content.size)))); } catch { /* rămâne unde a pus-o ProseMirror */ }
        return tr.setMeta(trackKey, true);
      },
    })];
  },
});
