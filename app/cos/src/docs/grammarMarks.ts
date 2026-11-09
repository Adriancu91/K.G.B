// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Sublinierea greșelilor de gramatică direct în text (linie ondulată albastră, ca la ortografie cea roșie), cu explicația
// și forma corectă la trecerea mouse-ului. Merge cât e pornită verificarea (Revizuire → Ortografie ✓). Paragrafele deja
// verificate se țin minte după text, ca la fiecare tastă să se verifice doar paragraful schimbat. Nu se tipăresc.
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import { checkGrammar, type GrammarIssue } from '../grammar';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    grammarMarks: { setGrammarMarks: (on: boolean) => ReturnType; ignoreGrammar: (key: string) => ReturnType };
  }
}

interface GState { on: boolean; ignored: Set<string>; deco: DecorationSet }
const key = new PluginKey<GState>('grammarMarks');
const OBJ = String.fromCharCode(65532);
const cache = new Map<string, GrammarIssue[]>();

function issuesOf(text: string) {
  let r = cache.get(text);
  if (!r) {
    r = checkGrammar(text);
    if (cache.size > 3000) cache.clear();
    cache.set(text, r);
  }
  return r;
}

/** Paragraful e scris în altă limbă sau marcat „Nu verifica ortografia”. */
function otherLang(node: PMNode) {
  let other = false;
  node.forEach((c) => { for (const m of c.marks) { const l = m.attrs.proofLang as string | undefined; if (l && !/^ro/i.test(l)) other = true; } });
  return other;
}

export interface DocGrammarIssue extends GrammarIssue { key: string; context: string }

/** Greșelile din tot documentul, cu locul lor în document (from / to). */
export function docGrammar(doc: PMNode): DocGrammarIssue[] {
  const out: DocGrammarIssue[] = [];
  // Cheia (pentru Ignoră) nu depinde de locul greșelii, ca să rămână aceeași când se schimbă textul din jur.
  const seen = new Map<string, number>();
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    if (node.type.name === 'codeBlock' || !node.content.size || otherLang(node)) return false;
    const text = node.textBetween(0, node.content.size, undefined, OBJ);
    for (const x of issuesOf(text)) {
      const a = Math.max(0, x.from - 25), b = Math.min(text.length, x.to + 25);
      out.push({ ...x, from: pos + 1 + x.from, to: pos + 1 + x.to, key: '', context: (a ? '…' : '') + text.slice(a, b).split(OBJ).join(' ') + (b < text.length ? '…' : '') });
    }
    return false;
  });
  for (const x of out) {
    const k = x.msg + '|' + x.text.toLocaleLowerCase('ro-RO');
    const n = (seen.get(k) ?? 0) + 1;
    seen.set(k, n);
    x.key = k + '|' + n;
  }
  return out;
}

export function grammarDecorations(doc: PMNode, ignored: Set<string>): DecorationSet {
  const decos = docGrammar(doc).filter((x) => !ignored.has(x.key)).map((x) =>
    Decoration.inline(x.from, x.to, { class: 'gram-err', title: x.msg + (x.fix !== undefined ? ` → „${x.fix}”` : '') }));
  return DecorationSet.create(doc, decos);
}

/** Cheile greșelilor ignorate în documentul deschis. */
export const grammarIgnored = (state: Parameters<typeof key.getState>[0]) => key.getState(state)?.ignored ?? new Set<string>();


export const GrammarMarks = Extension.create({
  name: 'grammarMarks',
  addCommands() {
    return {
      setGrammarMarks: (on: boolean) => ({ tr, dispatch }) => { dispatch?.(tr.setMeta(key, on)); return true; },
      ignoreGrammar: (k: string) => ({ tr, dispatch }) => { dispatch?.(tr.setMeta(key, { ignore: k })); return true; },
    };
  },
  addProseMirrorPlugins() {
    return [new Plugin<GState>({
      key,
      state: {
        init: () => ({ on: false, ignored: new Set<string>(), deco: DecorationSet.empty }),
        apply: (tr, prev, _old, state) => {
          const m = tr.getMeta(key);
          const on = typeof m === 'boolean' ? m : prev.on;
          const ignored = m?.ignore ? new Set(prev.ignored).add(m.ignore) : prev.ignored;
          if (!on) return { on, ignored, deco: DecorationSet.empty };
          if (m !== undefined || tr.docChanged) return { on, ignored, deco: grammarDecorations(state.doc, ignored) };
          return prev;
        },
      },
      props: { decorations: (state) => key.getState(state)?.deco ?? null },
    })];
  },
});
