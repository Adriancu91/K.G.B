// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Panoul „Accesibilitate” (Word: Revizuire → Verificare accesibilitate): problemele găsite, cu sfatul pentru fiecare;
// click pe una te duce la locul ei. Se reface la fiecare modificare, deci o problemă rezolvată dispare singură.
import type { Editor } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import { checkAccessibility } from './accessibility';

const LABEL = { alt: 'Fără text alternativ', heading: 'Titlu sărit', emptyHeading: 'Titlu gol', tableHeader: 'Tabel fără antet', contrast: 'Contrast slab', link: 'Legătură greu de citit' };

export default function A11yPane({ editor, pageColor, onClose }: { editor: Editor; pageColor?: string; onClose(): void }) {
  const issues = checkAccessibility(editor.state.doc, pageColor);
  const go = (pos: number) => {
    const node = editor.state.doc.nodeAt(pos);
    const chain = editor.chain().focus();
    if (node?.type.name === 'image') chain.setNodeSelection(pos);
    else if (node?.isTextblock) chain.setTextSelection(pos + 1);
    else if (node?.type.name === 'table') chain.setTextSelection(TextSelection.near(editor.state.doc.resolve(pos + 1)).from);
    else chain.setTextSelection(pos);
    chain.scrollIntoView().run();
  };
  return (
    <aside className="doc-nav doc-a11y" aria-label="Accesibilitate">
      <div className="doc-nav-head">
        <b>Accesibilitate</b>
        <button className="doc-nav-x" onClick={onClose} title="Închide panoul" aria-label="Închide panoul de accesibilitate">×</button>
      </div>
      {issues.length === 0 ? (
        <p className="doc-nav-empty">✓ Nicio problemă găsită: pozele au text alternativ, titlurile sunt în ordine, tabelele au antet și textul se citește bine.</p>
      ) : (
        <ul className="doc-nav-list">
          <li className="doc-nav-empty">{issues.length} {issues.length === 1 ? 'problemă' : 'probleme'}. Click pe una ca s-o vezi.</li>
          {issues.map((x, i) => (
            <li key={`${x.kind}${x.pos}${i}`}>
              <button className="doc-nav-row doc-a11y-row" onClick={() => go(x.pos)} title={x.tip}>
                <b>{LABEL[x.kind]}</b>: {x.text}
                <small>{x.tip}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
