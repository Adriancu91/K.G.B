// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Completarea automată în timp ce scrii (Word: AutoComplete / AutoText): după primele litere ale unei luni, ale unei zile,
// ale datei de azi („22 oct” → „22 octombrie 2026”) sau ale unui cuvânt lung care există deja în document, restul cuvântului
// apare gri după cursor. Enter sau Tab îl pune în text, Esc sau orice altă tastă îl ignoră. Se oprește din Revizuire → AutoCorect.
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import { loadAutoCorrect } from './autoCorrect';

export const MONTHS = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
const DAYS = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];
/** Cuvintele fixe propuse (lunile și zilele, doar cele unde completarea scutește litere). */
const FIXED = [...MONTHS, ...DAYS].filter((w) => w.length >= 6);
/** Câte litere trebuie scrise înainte de propunere și cât de lung trebuie să fie un cuvânt din document ca să fie propus. */
const MIN_PREFIX = 4;
const MIN_DOC_WORD = 8;

const MARKS = new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g');
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(MARKS, '');
const keepCase = (typed: string, full: string) => {
  if (typed.length > 1 && typed === typed.toUpperCase() && typed !== typed.toLowerCase()) return full.toUpperCase();
  if (typed[0] !== typed[0].toLowerCase()) return full[0].toUpperCase() + full.slice(1);
  return full;
};

/** Data de azi scrisă în cuvinte: „22 octombrie 2026”. */
export const longDate = (d = new Date()) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

/**
 * Ce se propune pentru textul de dinaintea cursorului: `before` e textul paragrafului până la cursor, `words` cuvintele lungi
 * din document. Întoarce restul de adăugat (fără ce s-a scris deja) și cuvântul întreg, sau null.
 */
export function completion(before: string, words: Iterable<string> = [], today = new Date()): { rest: string; full: string; del: number } | null {
  // Data de azi: „22 oct” → „22 octombrie 2026” (ziua de azi + cel puțin 3 litere din luna curentă).
  const month = MONTHS[today.getMonth()];
  const dm = /(?:^|[^\p{L}\p{N}])(\d{1,2}) (\p{L}{3,})$/u.exec(before);
  if (dm && Number(dm[1]) === today.getDate() && fold(month).startsWith(fold(dm[2]))) {
    const full = `${keepCase(dm[2], month)} ${today.getFullYear()}`;
    if (full.length > dm[2].length) return { rest: full.slice(dm[2].length), full, del: dm[2].length };
  }
  const m = /(?:^|[^\p{L}\p{N}'’-])(\p{L}[\p{L}'’-]*)$/u.exec(before);
  if (!m) return null;
  const typed = m[1];
  if (typed.length < MIN_PREFIX) return null;
  const key = fold(typed);
  const pick = (w: string) => {
    const f = fold(w);
    // Cuvântul trebuie să continue ce s-a scris și să mai aibă cel puțin două litere (altfel nu scutește nimic).
    return f.startsWith(key) && w.length >= typed.length + 2 ? keepCase(typed, w) : null;
  };
  for (const w of FIXED) { const full = pick(w); if (full) return { rest: full.slice(typed.length), full, del: typed.length }; }
  let best: string | null = null;
  for (const w of words) {
    const full = pick(w);
    // Dintre cuvintele documentului, cel mai scurt care se potrivește (cel mai probabil cel dorit).
    // Cel puțin trei litere de adăugat, ca Enter de la capătul unui cuvânt întreg („administrator” → „-ul”) să rămână rând nou.
    if (full && full.length >= typed.length + 3 && (!best || full.length < best.length)) best = full;
  }
  return best ? { rest: best.slice(typed.length), full: best, del: typed.length } : null;
}

// Cuvintele lungi ale fiecărui paragraf, ținute minte pe nodul lui: un paragraf neschimbat nu se mai citește la fiecare tastă.
const perBlock = new WeakMap<PMNode, string[]>();
function blockWords(node: PMNode): string[] {
  let w = perBlock.get(node);
  if (!w) {
    const set = new Set<string>();
    for (const m of node.textContent.matchAll(/\p{L}[\p{L}'’-]*\p{L}/gu)) if (m[0].length >= MIN_DOC_WORD) set.add(m[0]);
    w = [...set];
    perBlock.set(node, w);
  }
  return w;
}
function* docWords(doc: PMNode, skip: PMNode | null): Generator<string> {
  const seen = new Set<string>();
  const walk = function* (n: PMNode): Generator<string> {
    if (n.isTextblock) {
      if (n === skip) return;
      for (const w of blockWords(n)) if (!seen.has(w)) { seen.add(w); yield w; }
      return;
    }
    for (let i = 0; i < n.childCount; i++) yield* walk(n.child(i));
  };
  yield* walk(doc);
}

/** pos: cursorul; rest: ce se vede gri; full și del: la acceptare, ultimele del litere devin full (cu diacriticele lipsă). */
interface Hint { pos: number; rest: string; full: string; del: number }
const key = new PluginKey<Hint | null>('autoComplete');

function computeHint(state: EditorState): Hint | null {
  const { selection } = state;
  if (!selection.empty) return null;
  const $p = selection.$from;
  if ($p.parent.type.spec.code || !$p.parent.isTextblock) return null;
  // Doar la capăt de cuvânt: după cursor nu trebuie să mai urmeze o literă.
  const after = $p.parent.textBetween($p.parentOffset, Math.min($p.parent.content.size, $p.parentOffset + 1), undefined, '￼');
  if (/[\p{L}\p{N}]/u.test(after)) return null;
  const before = $p.parent.textBetween(Math.max(0, $p.parentOffset - 60), $p.parentOffset, undefined, '￼');
  // Paragraful curent se citește separat, fără cuvântul pe care îl scrii acum.
  const own = $p.parent.textContent.slice(0, $p.parentOffset).replace(/\p{L}[\p{L}'’-]*$/u, '') + ' ' + $p.parent.textContent.slice($p.parentOffset);
  const ownWords = [...own.matchAll(/\p{L}[\p{L}'’-]*\p{L}/gu)].map((m) => m[0]).filter((w) => w.length >= MIN_DOC_WORD);
  const words = (function* () { yield* ownWords; yield* docWords(state.doc, $p.parent); })();
  const c = completion(before, words);
  return c ? { pos: selection.from, ...c } : null;
}

export const AutoComplete = Extension.create({
  name: 'autoComplete',
  // Înaintea listelor și a tabelelor: Enter / Tab acceptă propunerea doar când ea e pe ecran.
  priority: 1050,
  addKeyboardShortcuts() {
    const accept = () => {
      const view = this.editor.view;
      const hint = key.getState(view.state);
      if (!hint || view.state.selection.from !== hint.pos) return false;
      view.dispatch(view.state.tr.insertText(hint.full, hint.pos - hint.del, hint.pos).setMeta(key, null));
      return true;
    };
    const dismiss = () => {
      const view = this.editor.view;
      if (!key.getState(view.state)) return false;
      view.dispatch(view.state.tr.setMeta(key, null));
      return true;
    };
    return { Enter: accept, Tab: accept, Escape: dismiss };
  },
  addProseMirrorPlugins() {
    return [new Plugin<Hint | null>({
      key,
      state: {
        init: () => null,
        apply(tr, _prev, _old, state) {
          const meta = tr.getMeta(key);
          if (meta !== undefined) return meta;
          // Propunerea apare doar după litere tastate (nu la mutarea cursorului, lipire sau anulare).
          if (!tr.docChanged || tr.getMeta('paste') || tr.getMeta('uiEvent') === 'paste' || tr.getMeta('history$')) return null;
          if (!loadAutoCorrect().complete) return null;
          return computeHint(state);
        },
      },
      props: {
        decorations(state) {
          const hint = key.getState(state);
          if (!hint || state.selection.from !== hint.pos) return null;
          const widget = () => {
            const s = document.createElement('span');
            s.className = 'ac-ghost';
            s.textContent = hint.rest;
            s.title = 'Enter sau Tab: completează · Esc: ignoră';
            s.setAttribute('aria-hidden', 'true');
            s.contentEditable = 'false';
            return s;
          };
          return DecorationSet.create(state.doc, [Decoration.widget(hint.pos, widget, { side: 1, key: 'ac:' + hint.rest, ignoreSelection: true })]);
        },
      },
    })];
  },
});
