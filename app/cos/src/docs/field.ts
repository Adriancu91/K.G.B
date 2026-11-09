// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Câmpuri în text (Insert → Quick Parts → Field): data, ora, autorul, titlul, numele fișierului, numărul paginii, al paginilor,
// al cuvintelor. Un câmp e text obișnuit cu semnul `docField` (instrucțiunea Word, de exemplu NUMPAGES), deci se vede,
// se tipărește și se exportă ca textul din jur; F9 îl rescrie cu valoarea de acum. În .docx devine câmp Word adevărat.
import { Mark, mergeAttributes } from '@tiptap/core';
import type { Editor } from '@tiptap/react';
import type { Node as PMNode } from '@tiptap/pm/model';
import { pageMap } from './pageCount';

export type FieldKind = 'DATE' | 'TIME' | 'AUTHOR' | 'TITLE' | 'SUBJECT' | 'KEYWORDS' | 'FILENAME' | 'PAGE' | 'NUMPAGES' | 'NUMWORDS' | 'NUMCHARS';
/** [felul, numele din meniu, ce arată când nu are valoare]. */
export const FIELD_KINDS: [FieldKind, string, string][] = [
  ['DATE', 'Data de azi', ''],
  ['TIME', 'Ora', ''],
  ['AUTHOR', 'Autorul', '[Autor]'],
  ['TITLE', 'Titlul', '[Titlu]'],
  ['SUBJECT', 'Subiectul', '[Subiect]'],
  ['KEYWORDS', 'Cuvintele cheie', '[Cuvinte cheie]'],
  ['FILENAME', 'Numele fișierului', '[Fișier nesalvat]'],
  ['PAGE', 'Numărul paginii', ''],
  ['NUMPAGES', 'Numărul de pagini', ''],
  ['NUMWORDS', 'Numărul de cuvinte', ''],
  ['NUMCHARS', 'Numărul de caractere', ''],
];

/** Instrucțiunea scrisă în .docx (cu formatul românesc la dată și oră). */
export const FIELD_INSTR: Record<FieldKind, string> = {
  DATE: 'DATE \\@ dd.MM.yyyy', TIME: 'TIME \\@ HH:mm', AUTHOR: 'AUTHOR', TITLE: 'TITLE', SUBJECT: 'SUBJECT', KEYWORDS: 'KEYWORDS',
  FILENAME: 'FILENAME', PAGE: 'PAGE', NUMPAGES: 'NUMPAGES', NUMWORDS: 'NUMWORDS', NUMCHARS: 'NUMCHARS',
};

/** Felul câmpului dintr-o instrucțiune Word („ DATE \@ "d MMMM" ” → DATE); null pentru câmpurile pe care nu le știm. */
export function fieldKindOf(instr: string): FieldKind | null {
  const k = String(instr).trim().split(/\s+/)[0]?.toUpperCase() ?? '';
  return FIELD_KINDS.some(([f]) => f === k) ? (k as FieldKind) : null;
}

export interface FieldCtx {
  file?: string;
  props?: { title?: string; subject?: string; author?: string; keywords?: string };
  date?: Date;
  /** Pagina unei poziții și numărul de pagini (măsurate pe ecran); fără ele, 1 din 1. */
  pageOf?: (pos: number) => { page: number; pages: number };
}

const p2 = (n: number) => String(n).padStart(2, '0');

/** Valoarea câmpului pus la poziția `at` din document. */
export function fieldValue(kind: FieldKind, doc: PMNode, at: number, ctx: FieldCtx): string {
  const d = ctx.date ?? new Date();
  const empty = FIELD_KINDS.find(([k]) => k === kind)?.[2] ?? '';
  const text = () => doc.textBetween(0, doc.content.size, ' ', ' ');
  switch (kind) {
    case 'DATE': return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`;
    case 'TIME': return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
    case 'AUTHOR': return ctx.props?.author || empty;
    case 'TITLE': return ctx.props?.title || (ctx.file ? ctx.file.replace(/[.][^.]+$/, '') : '') || empty;
    case 'SUBJECT': return ctx.props?.subject || empty;
    case 'KEYWORDS': return ctx.props?.keywords || empty;
    case 'FILENAME': return ctx.file || empty;
    case 'PAGE': return String(ctx.pageOf?.(at).page ?? 1);
    case 'NUMPAGES': return String(ctx.pageOf?.(at).pages ?? 1);
    case 'NUMWORDS': return String((text().match(/\S+/g) ?? []).length);
    case 'NUMCHARS': return String(text().replace(/\s/g, '').length);
  }
}

export const DocField = Mark.create({
  name: 'docField',
  inclusive: false,
  excludes: '',
  addAttributes() {
    return {
      kind: {
        default: 'DATE',
        parseHTML: (el) => fieldKindOf(el.getAttribute('data-field') ?? '') ?? 'DATE',
        renderHTML: (a) => ({ 'data-field': a.kind }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-field]', getAttrs: (el) => (fieldKindOf((el as HTMLElement).getAttribute('data-field') ?? '') ? null : false) }];
  },
  renderHTML({ HTMLAttributes }) {
    const name = FIELD_KINDS.find(([k]) => k === HTMLAttributes['data-field'])?.[1] ?? 'Câmp';
    return ['span', mergeAttributes(HTMLAttributes, { class: 'doc-field', title: `Câmp: ${name} (F9 îl actualizează)` }), 0];
  },
});

/** Pune câmpul la cursor (în locul textului ales). */
export function insertField(editor: Editor, kind: FieldKind, ctx: FieldCtx): boolean {
  const { from } = editor.state.selection;
  const text = fieldValue(kind, editor.state.doc, from, ctx) || '0';
  const marks = editor.state.selection.$from.marks().filter((m) => m.type.name !== 'link' && m.type.name !== 'docField').map((m) => m.toJSON());
  return editor.chain().focus().insertContent({ type: 'text', text, marks: [...marks, { type: 'docField', attrs: { kind } }] })
    .unsetMark('docField').run();
}

/** Bucățile de text cu câmp (cele lipite, de același fel, sunt un singur câmp). */
export function fieldRuns(doc: PMNode): { from: number; to: number; kind: FieldKind; text: string }[] {
  const runs: { from: number; to: number; kind: FieldKind; text: string }[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText) return true;
    const m = node.marks.find((x) => x.type.name === 'docField');
    if (!m) return false;
    const kind = m.attrs.kind as FieldKind;
    const last = runs[runs.length - 1];
    if (last && last.to === pos && last.kind === kind) { last.to = pos + node.nodeSize; last.text += node.text; }
    else runs.push({ from: pos, to: pos + node.nodeSize, kind, text: node.text ?? '' });
    return false;
  });
  return runs;
}

/** Măsurarea paginilor din editor, pentru câmpurile PAGE / NUMPAGES. */
export const fieldPages = (editor: Editor, pageH: number) => pageMap(editor.view, pageH);

/** Rescrie toate câmpurile (F9). Întoarce câte s-au schimbat. */
export function updateFields(editor: Editor, ctx: FieldCtx): number {
  const { doc } = editor.state;
  const runs = fieldRuns(doc);
  if (!runs.length) return 0;
  const tr = editor.state.tr;
  let changed = 0;
  for (const r of runs.reverse()) {
    const text = fieldValue(r.kind, doc, r.from, ctx) || '0';
    if (text === r.text) continue;
    const marks = doc.nodeAt(r.from)?.marks ?? [];
    tr.replaceWith(r.from, r.to, editor.schema.text(text, marks));
    changed++;
  }
  if (changed) editor.view.dispatch(tr);
  return changed;
}

/**
 * Importul .docx: câmpurile cunoscute din document.xml (complete, begin / instrText / separate / end, sau fldSimple) primesc
 * semne în jurul rezultatului: `mark` Q<FEL> `mark` înainte și `mark` q `mark` după, ca să devină din nou câmpuri în editor.
 * Câmpurile din alte câmpuri (de exemplu dintr-un cuprins) rămân text obișnuit.
 */
export function markFieldsXml(xml: string, mark: string): string {
  const run = (t: string) => `<w:r><w:t xml:space="preserve">${mark}${t}${mark}</w:t></w:r>`;
  let out = xml.replace(/<w:fldSimple\b([^>]*)>([\s\S]*?)<\/w:fldSimple>/g, (m, attrs: string, inner: string) => {
    const instr = /w:instr="([^"]*)"/.exec(attrs)?.[1] ?? '';
    const kind = fieldKindOf(instr.replace(/&quot;/g, '"'));
    if (!kind) { const mb = parseMacroBtn(instr); if (mb) return `<w:fldSimple${attrs}>${run('M' + mb.macro)}<w:r><w:t xml:space="preserve">${mb.text}</w:t></w:r>${run('m')}</w:fldSimple>`; }
    return kind && inner.includes('<w:t') ? `<w:fldSimple${attrs}>${run('Q' + kind)}${inner}${run('q')}</w:fldSimple>` : m;
  });
  // Butoanele MACROBUTTON scrise ca <w:fldSimple … /> (fără rezultat): textul afișat e în instrucțiune.
  out = out.replace(/<w:fldSimple\b([^>]*?)\/>/g, (m, attrs: string) => {
    const mb = parseMacroBtn((/w:instr="([^"]*)"/.exec(attrs)?.[1] ?? '').replace(/&quot;/g, '"'));
    return mb ? `${run('M' + mb.macro)}<w:r><w:t xml:space="preserve">${mb.text}</w:t></w:r>${run('m')}` : m;
  });
  if (!out.includes('w:fldCharType')) return out;
  const re = /<w:fldChar\b[^>]*w:fldCharType="(begin|separate|end)"[^>]*>|<w:instrText\b[^>]*>([^<]*)<\/w:instrText>/g;
  const stack: { instr: string; kind: FieldKind | null; resultAt: number; mb?: { macro: string; text: string } | null }[] = [];
  const inserts: [number, string][] = [];
  const runStart = (at: number) => { const a = out.lastIndexOf('<w:r>', at), b = out.lastIndexOf('<w:r ', at); return Math.max(a, b); };
  let m: RegExpExecArray | null;
  while ((m = re.exec(out))) {
    if (m[2] !== undefined) { if (stack.length) stack[stack.length - 1].instr += m[2]; continue; }
    if (m[1] === 'begin') stack.push({ instr: '', kind: null, resultAt: -1 });
    else if (m[1] === 'separate') {
      const f = stack[stack.length - 1];
      if (!f) continue;
      f.kind = stack.length === 1 ? fieldKindOf(f.instr) : null;
      f.mb = stack.length === 1 && !f.kind ? parseMacroBtn(f.instr) : null;
      const close = out.indexOf('</w:r>', m.index);
      if ((f.kind || f.mb) && close >= 0) f.resultAt = close + 6;
    } else {
      const f = stack.pop();
      // MACROBUTTON: rezultatul (dacă are) sau textul din instrucțiune devine textul butonului.
      const mb = f && !f.kind && !stack.length ? (f.mb ?? parseMacroBtn(f.instr)) : null;
      if (mb) {
        const at = runStart(m.index);
        if (f!.resultAt >= 0 && at >= f!.resultAt) inserts.push([f!.resultAt, run('M' + mb.macro)], [at, run('m')]);
        else if (at >= 0) inserts.push([at, run('M' + mb.macro) + '<w:r><w:t xml:space="preserve">' + mb.text + '</w:t></w:r>' + run('m')]);
        continue;
      }
      if (!f?.kind || f.resultAt < 0) continue;
      const at = runStart(m.index);
      if (at < f.resultAt) continue;
      inserts.push([f.resultAt, run('Q' + f.kind)], [at, run('q')]);
    }
  }
  for (const [at, s] of inserts.sort((a, b) => b[0] - a[0])) out = out.slice(0, at) + s + out.slice(at);
  return out;
}

/** După importul .docx: semnele puse de markFieldsXml devin <span data-field> (rezultatul poate avea aldin, culori…, dar nu paragrafe). */
const BLOCK_TAG = new RegExp('<[/]?(p|h[1-6]|li|td|th|tr|table|ul|ol)[ >]');
export function fieldsFromMarks(html: string, mark: string): string {
  html = html.replace(new RegExp(mark + 'M([^' + mark + '<"]+)' + mark + '([^' + mark + ']*?)' + mark + 'm' + mark, 'g'),
    (_all, name: string, inner: string) => (inner && !BLOCK_TAG.test(inner) ? `<span data-macrobtn="${name}">${inner}</span>` : inner));
  return html.replace(new RegExp(mark + 'Q([A-Z]+)' + mark + '([^' + mark + ']*?)' + mark + 'q' + mark, 'g'),
    (_all, kind: string, inner: string) => (fieldKindOf(kind) && inner && !BLOCK_TAG.test(inner) ? `<span data-field="${kind}">${inner}</span>` : inner));
}

/** Câmpurile în .odt: elementul text:… pentru fiecare fel (cu atributele lui). */
export const ODF_FIELD: Record<FieldKind, [string, string]> = {
  DATE: ['date', ' text:fixed="false"'], TIME: ['time', ' text:fixed="false"'], AUTHOR: ['initial-creator', ''], TITLE: ['title', ''],
  SUBJECT: ['subject', ''], KEYWORDS: ['keywords', ''], FILENAME: ['file-name', ' text:display="name-and-extension"'],
  PAGE: ['page-number', ' text:select-page="current"'], NUMPAGES: ['page-count', ''], NUMWORDS: ['word-count', ''], NUMCHARS: ['character-count', ''],
};
/** Felul câmpului după numele elementului din .odt (author-name = numele celui care scrie, îl luăm tot ca autor). */
export function odfFieldKind(localName: string): FieldKind | null {
  if (localName === 'author-name' || localName === 'creator') return 'AUTHOR';
  const hit = (Object.keys(ODF_FIELD) as FieldKind[]).find((k) => ODF_FIELD[k][0] === localName);
  return hit ?? null;
}

/**
 * Câmpul MACROBUTTON (Insert → Quick Parts → Field → MacroButton): un text în document care, la dublu clic, rulează o
 * macrocomandă. E text obișnuit cu semnul `macroBtn` (numele macrocomenzii); în .docx devine câmpul MACROBUTTON adevărat,
 * cu textul afișat în instrucțiune (numele fără spații, ca în Word).
 */
export const MacroBtn = Mark.create({
  name: 'macroBtn',
  inclusive: false,
  excludes: 'docField',
  addAttributes() {
    return {
      macro: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-macrobtn') ?? '',
        renderHTML: (a) => ({ 'data-macrobtn': a.macro }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-macrobtn]', getAttrs: (el) => ((el as HTMLElement).getAttribute('data-macrobtn') ? null : false) }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'doc-macrobtn', title: `Buton macro: dublu clic rulează macrocomanda „${HTMLAttributes['data-macrobtn']}”` }), 0];
  },
});

/** Numele macrocomenzii în instrucțiunea MACROBUTTON: fără spații (Word citește numele până la primul spațiu). */
export const macroBtnName = (name: string) => name.trim().replace(/\s+/g, '_');

/** Instrucțiunea Word a butonului: „MACROBUTTON Nume Textul afișat”. */
export const macroBtnInstr = (name: string, text: string) => `MACROBUTTON ${macroBtnName(name)} ${text}`;

/** Numele și textul afișat dintr-o instrucțiune MACROBUTTON; null dacă nu e una. */
export function parseMacroBtn(instr: string): { macro: string; text: string } | null {
  const m = /^\s*MACROBUTTON\s+(\S+)\s*([\s\S]*?)\s*$/i.exec(instr);
  return m ? { macro: m[1], text: m[2] } : null;
}

/** Macrocomanda butonului, căutată după nume (cu spații sau cu „_” în locul lor, cum vine din .docx). */
export function findMacroForBtn<M extends { name: string }>(lists: M[][], name: string): M | undefined {
  for (const l of lists) { const m = l.find((x) => x.name === name); if (m) return m; }
  for (const l of lists) { const m = l.find((x) => macroBtnName(x.name) === macroBtnName(name)); if (m) return m; }
  return undefined;
}

/** Pune la cursor butonul care rulează macrocomanda `macro`, cu textul `text`. */
export function insertMacroBtn(editor: Editor, macro: string, text: string): boolean {
  const marks = editor.state.selection.$from.marks().filter((m) => !['link', 'docField', 'macroBtn'].includes(m.type.name)).map((m) => m.toJSON());
  return editor.chain().focus().insertContent({ type: 'text', text: text.trim() || macro, marks: [...marks, { type: 'macroBtn', attrs: { macro } }] })
    .unsetMark('macroBtn').run();
}

/** Butonul de la poziția `pos` (numele macrocomenzii și capătul lui de după), sau null. */
export function macroBtnAt(doc: PMNode, pos: number): { macro: string; end: number } | null {
  const $p = doc.resolve(Math.min(Math.max(pos, 0), doc.content.size));
  const node = $p.parent.childAfter($p.parentOffset).node ?? $p.nodeBefore;
  const mk = node?.marks.find((x) => x.type.name === 'macroBtn');
  if (!mk) return null;
  // Capătul butonului: bucățile de text lipite, cu același buton, care cuprind poziția; capătul ultimei dintre ele.
  let runFrom = -1, runEnd = -1, end = pos;
  $p.parent.forEach((child, offset) => {
    const at = $p.start() + offset;
    const same = child.marks.some((x) => x.type.name === 'macroBtn' && x.attrs.macro === mk.attrs.macro);
    if (!same) { runFrom = -1; return; }
    if (runFrom < 0 || at !== runEnd) runFrom = at;
    runEnd = at + child.nodeSize;
    if (runFrom <= pos && pos <= runEnd) end = runEnd;
  });
  return { macro: String(mk.attrs.macro), end };
}
