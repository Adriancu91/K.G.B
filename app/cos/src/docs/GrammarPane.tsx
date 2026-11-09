// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Panoul „Gramatică” (Revizuire → Verificare): greșelile găsite de src/grammar.ts în tot documentul, cu explicația și forma
// corectă. Clic pe una te duce la ea; ✓ Corectează pune forma corectă, Ignoră o ascunde (și sublinierea ei), Corectează tot le repară pe toate
// cele care au o formă corectă, într-un singur pas de Ctrl+Z. Se reface la fiecare modificare.
import { useMemo, useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { GrammarIssue } from '../grammar';
import { docGrammar, grammarIgnored, type DocGrammarIssue } from './grammarMarks';

const LABEL: Record<GrammarIssue['kind'], string> = {
  repeat: 'Cuvânt repetat', space: 'Spații', punct: 'Punctuație', capital: 'Literă mare', oldI: 'Scriere veche', form: 'Formă greșită', pleonasm: 'Exprimare', agree: 'Acord',
};

export default function GrammarPane({ editor, readOnly, onClose }: { editor: Editor; readOnly?: boolean; onClose(): void }) {
  // Greșelile ignorate se țin în extensia de subliniere (dispar și din text); tick reface panoul după Ignoră.
  const [tick, setTick] = useState(0);
  const doc = editor.state.doc;
  const ignored = grammarIgnored(editor.state);
  const issues = useMemo(() => docGrammar(doc).filter((x) => !ignored.has(x.key)), [doc, ignored, tick]);
  const fixable = issues.filter((x) => x.fix !== undefined);
  const go = (x: DocGrammarIssue) => editor.chain().focus().setTextSelection({ from: x.from, to: x.to }).scrollIntoView().run();
  const fix = (x: DocGrammarIssue) => {
    if (readOnly || x.fix === undefined) return;
    editor.view.dispatch(editor.state.tr.insertText(x.fix, x.from, x.to).scrollIntoView());
    editor.commands.focus();
  };
  const fixAll = () => {
    if (readOnly) return;
    const tr = editor.state.tr;
    for (const x of [...fixable].sort((a, b) => b.from - a.from)) tr.insertText(x.fix!, x.from, x.to);
    editor.view.dispatch(tr);
    editor.commands.focus();
  };
  return (
    <aside className="doc-nav doc-grammar" aria-label="Gramatică">
      <div className="doc-nav-head">
        <b>Gramatică</b>
        <button className="doc-nav-x" onClick={onClose} title="Închide panoul" aria-label="Închide panoul de gramatică">×</button>
      </div>
      {issues.length === 0 ? (
        <p className="doc-nav-empty">✓ Nicio greșeală găsită: fără cuvinte repetate, spații în plus, punctuație lipită, litere mici la început de propoziție, scriere veche sau exprimări greșite cunoscute.</p>
      ) : (
        <ul className="doc-nav-list">
          <li className="doc-nav-empty doc-grammar-top">
            <span>{issues.length} {issues.length === 1 ? 'greșeală' : 'greșeli'}. Clic pe una ca s-o vezi.</span>
            {fixable.length > 1 && !readOnly && <button onClick={fixAll} title="Pune forma corectă la toate greșelile care au una (un singur pas de Ctrl+Z)">{`✓ Corectează tot (${fixable.length})`}</button>}
          </li>
          {issues.map((x) => (
            <li key={x.key} className="doc-grammar-item">
              <button className="doc-nav-row" onClick={() => go(x)} title={x.msg}>
                <b>{LABEL[x.kind]}</b>: {x.msg}
                <small>{x.context}</small>
              </button>
              <div className="doc-grammar-acts">
                {x.fix !== undefined && !readOnly && (
                  <button onClick={() => fix(x)} title="Pune forma corectă în document">✓ {x.fix ? `„${x.fix}”` : 'Șterge'}</button>
                )}
                <button onClick={() => { editor.commands.ignoreGrammar(x.key); setTick(tick + 1); }} title="Nu mai arăta această greșeală">Ignoră</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
