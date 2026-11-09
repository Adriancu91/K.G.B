// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Fereastra „Inspectează documentul”: arată ce informații ascunse pleacă odată cu fișierul și le scoate, pe rând,
// înainte să-l trimiți cuiva. Nimic nu se șterge fără clic pe „Elimină” (și se poate anula cu Ctrl+Z, în afară de pagină).
import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { PageSetup } from './format';
import { bytesDataUrl, dataUrlBytes, inspectDoc, stripImageMeta, withoutHeadFoot } from './inspect';

export default function InspectDialog({ editor, page, onPage, onClose }: { editor: Editor; page: PageSetup; onPage(p: PageSetup): void; onClose(): void }) {
  const [, redraw] = useState(0);
  const [done, setDone] = useState<string[]>([]);
  const f = inspectDoc(editor.state.doc, page);
  const mark = (what: string) => { setDone((d) => [...d, what]); redraw((x) => x + 1); };

  const removeComments = () => {
    const { tr, schema, doc } = editor.state;
    tr.removeMark(0, doc.content.size, schema.marks.comment);
    editor.view.dispatch(tr);
    mark('comentariile');
  };
  const acceptChanges = () => { editor.commands.acceptAllChanges(); mark('modificările urmărite (acceptate)'); };
  const removeImageMeta = () => {
    const { tr } = editor.state;
    for (const pos of f.images) {
      const node = tr.doc.nodeAt(pos);
      const d = node && dataUrlBytes(String(node.attrs.src ?? ''));
      if (node && d) tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: bytesDataUrl(d.mime, stripImageMeta(d.bytes)) });
    }
    editor.view.dispatch(tr);
    mark('datele din poze');
  };

  const rows: { key: string; name: string; info: string; found: boolean; action: string; run(): void }[] = [
    { key: 'c', name: 'Comentarii', info: f.comments ? `${f.comments} comentarii, cu numele celor care le-au scris` : 'Niciun comentariu.', found: f.comments > 0, action: 'Elimină', run: removeComments },
    { key: 't', name: 'Modificări urmărite', info: f.changes ? `${f.changes} bucăți de text adăugate / șterse, cu autorul și data` : 'Nicio modificare urmărită.', found: f.changes > 0, action: 'Acceptă toate', run: acceptChanges },
    { key: 'p', name: 'Proprietățile documentului', info: f.props.length ? f.props.join(' · ') : 'Fără titlu, autor sau cuvinte cheie.', found: f.props.length > 0, action: 'Elimină', run: () => { onPage({ ...page, props: undefined }); mark('proprietățile'); } },
    { key: 'h', name: 'Antet, subsol și filigran', info: f.headFoot.length ? f.headFoot.join(' · ') : 'Fără antet, subsol sau filigran.', found: f.headFoot.length > 0, action: 'Elimină', run: () => { onPage(withoutHeadFoot(page)); mark('antetul, subsolul și filigranul'); } },
    { key: 'i', name: 'Date ascunse în poze', info: f.images.length ? `${f.images.length} poze cu date despre ele (aparatul, data, uneori locul GPS)` : 'Pozele nu au date ascunse.', found: f.images.length > 0, action: 'Elimină', run: removeImageMeta },
  ];

  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg inspect-dlg" role="dialog" aria-label="Inspectează documentul" onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}>
        <h3>Inspectează documentul</h3>
        <p className="print-info">Înainte să trimiți fișierul cuiva: ce informații pleacă odată cu el, pe care nu le vezi neapărat în pagină.</p>
        <ul className="inspect-list">
          {rows.map((r) => (
            <li key={r.key} className={r.found ? 'found' : ''} data-inspect={r.key}>
              <span className="inspect-mark" aria-hidden>{r.found ? '!' : '✓'}</span>
              <div className="inspect-text"><b>{r.name}</b><span>{r.info}</span></div>
              {r.found && <button onClick={r.run}>{r.action}</button>}
            </li>
          ))}
        </ul>
        {done.length > 0 && <p className="print-info" role="status">Am eliminat: {done.join(', ')}. Salvează documentul ca să rămână așa.</p>}
        <div className="print-actions">
          <button className="primary" autoFocus onClick={onClose}>Închide</button>
        </div>
      </div>
    </div>
  );
}
