// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// AutoCorect în timp ce scrii (ca în Word: Fișier → Opțiuni → Verificare → Opțiuni AutoCorect): ghilimele românești „”,
// simboluri (-- → –, ... → …, (c) → ©), ş/ţ cu sedilă → ș/ț cu virgulă, DOuă MAjuscule, prima literă din propoziție
// și o listă de înlocuiri (cuvinte fără diacritice, greșeli dese). Ctrl+Z sau Backspace imediat după anulează doar corectura.
// Tot aici, formatarea automată din timpul scrisului (Word: AutoFormat în timp ce tastați): 1/2 → ½ și adresele web
// (https://…, www.…) sau de e-mail devin legături după spațiu.
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';
import { normalizeHref } from './link';

export interface AutoCorrectOptions {
  quotes: boolean;
  symbols: boolean;
  cedilla: boolean;
  capitals: boolean;
  sentence: boolean;
  replace: boolean;
  /** 1/2 → ½, 1/4 → ¼, 3/4 → ¾. */
  fractions: boolean;
  /** Adresele web și de e-mail devin legături. */
  links: boolean;
  /** Completarea automată: restul lunii, al zilei, al datei de azi sau al unui cuvânt lung din document (autoComplete.ts). */
  complete: boolean;
  list: [string, string][];
}

/** Înlocuirile de la început: doar cuvinte care fără diacritice nu sunt corecte. */
export const DEFAULT_LIST: [string, string][] = [
  ['multumesc', 'mulțumesc'], ['multumim', 'mulțumim'], ['fiindca', 'fiindcă'], ['intr-un', 'într-un'], ['intr-o', 'într-o'],
  ['astazi', 'astăzi'], ['maine', 'mâine'], ['sambata', 'sâmbătă'], ['romaneste', 'românește'], ['cateva', 'câteva'],
  ['catre', 'către'], ['dupa', 'după'], ['pentu', 'pentru'], ['insa', 'însă'], ['inca', 'încă'], ['niste', 'niște'],
  ['asa', 'așa'], ['decat', 'decât'], ['cand', 'când'], ['intre', 'între'], ['inainte', 'înainte'], ['impreuna', 'împreună'],
  ['intotdeauna', 'întotdeauna'], ['aceeasi', 'aceeași'], ['acelasi', 'același'], ['acelas', 'același'], ['oricand', 'oricând'],
  ['niciodata', 'niciodată'], ['totusi', 'totuși'], ['deasemenea', 'de asemenea'],
];

export const DEFAULT_OPTIONS: AutoCorrectOptions = {
  quotes: true, symbols: true, cedilla: true, capitals: true, sentence: true, replace: true, fractions: true, links: true, complete: true, list: DEFAULT_LIST,
};

const KEY = 'suite.docs.autocorrect';
let current: AutoCorrectOptions | null = null;

export function loadAutoCorrect(): AutoCorrectOptions {
  if (current) return current;
  let saved: Partial<AutoCorrectOptions> = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* fără setări salvate */ }
  current = { ...DEFAULT_OPTIONS, ...saved };
  if (!Array.isArray(current.list)) current.list = DEFAULT_LIST;
  return current;
}

export function saveAutoCorrect(o: AutoCorrectOptions) {
  current = o;
  try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* rămâne doar până la închidere */ }
}

const SYMBOLS: [string, string][] = [
  ['–-', '—'], ['--', '–'], ['...', '…'], ['(c)', '©'], ['(C)', '©'], ['(r)', '®'], ['(R)', '®'], ['(tm)', '™'], ['(TM)', '™'],
  ['(e)', '€'], ['←>', '↔'], ['->', '→'], ['<-', '←'], ['=>', '⇒'], ['<=', '≤'], ['>=', '≥'], ['!=', '≠'], ['+-', '±'],
];
const CEDILLA: Record<string, string> = { 'ş': 'ș', 'ţ': 'ț', 'Ş': 'Ș', 'Ţ': 'Ț' };
const OPENERS = /[\s([{„«—–/-]$/;
const LETTER = /\p{L}|\p{N}/u;
const WORD_END = /^[\s.,;:!?)\]}”»]$/;
/** Prescurtări după care nu începe o propoziție nouă. */
const ABBR = new Set(['etc', 'ex', 'nr', 'dl', 'dna', 'dra', 'pag', 'art', 'alin', 'lit', 'str', 'tel', 'prof', 'dr', 'ing', 'jud', 'bd', 'sc', 'ap', 'et', 'vs', 'cca', 'aprox', 'pct']);

const isLower = (w: string) => w === w.toLowerCase() && w !== w.toUpperCase();
const keepCase = (word: string, repl: string) => {
  if (word.length > 1 && word === word.toUpperCase() && word !== word.toLowerCase()) return repl.toUpperCase();
  if (word[0] !== word[0].toLowerCase()) return repl[0].toUpperCase() + repl.slice(1);
  return repl;
};

/**
 * Corectura pentru textul scris: `before` e textul paragrafului până la cursor, `typed` ce s-a tastat acum.
 * Întoarce câte caractere de la sfârșitul lui before + typed se înlocuiesc și cu ce, sau null dacă nu e nimic de corectat.
 */
export function autoCorrect(before: string, typed: string, o: AutoCorrectOptions): { del: number; text: string } | null {
  if (typed.length !== 1) return null;
  const s = before + typed;
  if (o.cedilla && CEDILLA[typed]) return { del: 1, text: CEDILLA[typed] };
  if (o.quotes && typed === '"') return { del: 1, text: before === '' || OPENERS.test(before) ? '„' : '”' };
  if (o.quotes && typed === "'") {
    const prev = before.slice(-1);
    return { del: 1, text: prev && LETTER.test(prev) ? '’' : before === '' || OPENERS.test(before) ? '‘' : '’' };
  }
  if (o.symbols) {
    for (const [from, to] of SYMBOLS) if (s.endsWith(from)) return { del: from.length, text: to };
  }
  if (!WORD_END.test(typed)) return null;
  if (o.fractions) {
    const f = /(^|[^\p{N}/,.])([13])[/]([24])$/u.exec(before);
    const frac = f && ({ '1/2': '½', '1/4': '¼', '3/4': '¾' } as Record<string, string>)[f[2] + '/' + f[3]];
    if (frac) return { del: 4, text: frac + typed };
  }
  const m = /([\p{L}\p{N}][\p{L}\p{N}'’-]*)$/u.exec(before);
  if (!m) return null;
  const word = m[1];
  const head = before.slice(0, before.length - word.length);
  if (/[@/\\.:_]$/.test(head) || /\d/.test(word)) return null; // adrese, căi, numere
  let fixed = word;
  if (o.replace) {
    const hit = o.list.find(([from]) => from.toLowerCase() === word.toLowerCase());
    if (hit && hit[1]) fixed = keepCase(word, hit[1]);
  }
  if (o.capitals && fixed === word && fixed.length > 2 && /^\p{Lu}\p{Lu}\p{Ll}/u.test(fixed) && isLower(fixed.slice(2))) {
    fixed = fixed[0] + fixed[1].toLowerCase() + fixed.slice(2);
  }
  if (o.sentence && isLower(fixed[0])) {
    const prev = /([\p{L}]+)?([.!?…])[)"”»]*\s+$/u.exec(head);
    const start = head.trim() === '' || (prev && !(prev[2] === '.' && prev[1] && (ABBR.has(prev[1].toLowerCase()) || prev[1].length === 1)));
    if (start) fixed = fixed[0].toUpperCase() + fixed.slice(1);
  }
  if (fixed === word) return null;
  return { del: word.length + 1, text: fixed + typed };
}

/** Adresa web sau de e-mail de la sfârșitul lui `before` (fără punctuația de după ea): unde începe, unde se termină și legătura. */
export function linkBefore(before: string): { start: number; end: number; href: string } | null {
  const m = /(\S+)$/.exec(before);
  if (!m) return null;
  const tok = m[1].replace(/^[(\[„«"']+/, '');
  const core = tok.replace(/[.,;:!?)\]”»"']+$/, '');
  if (!/^(https?:[/][/]|www[.])\S+[.]\S+/i.test(core) && !/^[^@\s/:]+@[^@\s/:]+[.][a-z]{2,}$/i.test(core)) return null;
  const href = normalizeHref(core);
  if (!href) return null;
  const start = before.length - m[1].length + (m[1].length - tok.length);
  return { start, end: start + core.length, href };
}

interface Last { from: number; to: number; original: string }
const pluginKey = new PluginKey<Last | null>('autoCorrect');

export const AutoCorrect = Extension.create({
  name: 'autoCorrect',
  addKeyboardShortcuts() {
    return {
      // Backspace imediat după o corectură o anulează (ca în Word), în loc să șteargă un caracter.
      Backspace: ({ editor }) => {
        const last = pluginKey.getState(editor.state);
        const { selection } = editor.state;
        if (!last || !selection.empty || selection.from !== last.to) return false;
        editor.view.dispatch(editor.state.tr.insertText(last.original, last.from, last.to).setMeta(pluginKey, null));
        return true;
      },
    };
  },
  addProseMirrorPlugins() {
    return [new Plugin<Last | null>({
      key: pluginKey,
      state: {
        init: () => null,
        apply: (tr, last) => { const m = tr.getMeta(pluginKey); return m !== undefined ? m : tr.docChanged || tr.selectionSet ? null : last; },
      },
      props: {
        handleTextInput(view, from, to, text) {
          if (view.composing || from !== to) return false;
          const $from = view.state.doc.resolve(from);
          if ($from.parent.type.spec.code || $from.marks().some((m) => m.type.spec.code)) return false;
          const before = $from.parent.textBetween(Math.max(0, $from.parentOffset - 60), $from.parentOffset, undefined, '￼');
          const opts = loadAutoCorrect();
          const fix = autoCorrect(before, text, opts);
          if (!fix) {
            // Adresa de dinainte de spațiu devine legătură (Ctrl+Z o scoate, textul rămâne).
            const link = view.state.schema.marks.link;
            if (!opts.links || !link || !/^\s$/.test(text)) return false;
            const base = Math.max(0, $from.parentOffset - 300);
            const hit = linkBefore($from.parent.textBetween(base, $from.parentOffset, undefined, '￼'));
            if (!hit) return false;
            const a = $from.start() + base + hit.start, b = $from.start() + base + hit.end;
            if (view.state.doc.rangeHasMark(a, b, link)) return false;
            view.dispatch(view.state.tr.insertText(text, from, to));
            view.dispatch(closeHistory(view.state.tr).addMark(a, b, link.create({ href: hit.href })));
            return true;
          }
          // Întâi caracterul tastat, apoi corectura ca pas separat de anulare: Ctrl+Z o scoate doar pe ea.
          view.dispatch(view.state.tr.insertText(text, from, to));
          const end = from + text.length;
          const start = end - fix.del;
          if (start < $from.start()) return true;
          const original = view.state.doc.textBetween(start, end);
          const tr = closeHistory(view.state.tr).insertText(fix.text, start, end);
          view.dispatch(tr.setMeta(pluginKey, { from: start, to: start + fix.text.length, original }));
          return true;
        },
      },
    })];
  },
});
