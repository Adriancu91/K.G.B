// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Butonul ✍ din Docs: „Linie de semnătură”: un loc de semnat (linia), sub el numele, funcția și, la cerere, data,
// aliniate la stânga sau la dreapta. Sunt paragrafe obișnuite, deci se păstrează la tipărire, PDF, .docx și .odt.
// Numele se completează din profilul de formulare (dacă există), ca să nu-l scrii de fiecare dată.
import { useEffect, useRef, useState } from 'react';
import type { Editor, JSONContent } from '@tiptap/react';
import { loadProfile } from '../pdf/profile';
import { SIGN_LINE } from './signFill';

export { SIGN_LINE };

export interface SignatureOpts { name: string; title: string; date: boolean; align: 'left' | 'right' | 'center' }

/** Paragrafele liniei de semnătură: un rând gol (loc pentru semnătură), linia, numele aldin, funcția, data. */
export function signatureBlock(o: SignatureOpts): JSONContent[] {
  const attrs = { textAlign: o.align };
  const p = (text: string, bold = false): JSONContent => ({
    type: 'paragraph', attrs, content: text ? [{ type: 'text', text, ...(bold ? { marks: [{ type: 'bold' }] } : {}) }] : undefined,
  });
  const out = [p(''), p(SIGN_LINE)];
  if (o.name.trim()) out.push(p(o.name.trim(), true));
  if (o.title.trim()) out.push(p(o.title.trim()));
  if (o.date) out.push(p('Data: ' + '_'.repeat(14)));
  return out;
}

const KEY = 'suite.docs.semnatura';

export default function SignatureLine({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [o, setO] = useState<SignatureOpts>({ name: '', title: '', date: true, align: 'left' });
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); editor.commands.focus(); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open, editor]);

  const show = () => {
    // Ultimele alegeri; numele, la prima folosire, din profilul de formulare.
    let last: Partial<SignatureOpts> = {};
    try { last = JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { /* */ }
    const pr = loadProfile();
    const who = [pr?.prenume, pr?.nume].map((s) => s?.trim()).filter(Boolean).join(' ');
    setO({ name: last.name ?? who, title: last.title ?? '', date: last.date ?? true, align: last.align ?? 'left' });
    setOpen(true);
  };
  const insert = () => {
    editor.chain().focus().insertContent(signatureBlock(o)).run();
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* */ }
    setOpen(false);
  };

  return (
    <div className="sym-wrap" ref={box}>
      <button className={`fmt ${open ? 'active' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => (open ? setOpen(false) : show())}
        title="Linie de semnătură: locul de semnat, cu numele, funcția și data sub el">✍</button>
      {open && (
        <div className="sym-pop sign-pop" role="dialog" aria-label="Linie de semnătură">
          <div className="sym-head">Linie de semnătură</div>
          <label>Numele <input autoFocus value={o.name} onChange={(e) => setO({ ...o, name: e.target.value })} placeholder="de ex. Ion Popescu"
            onKeyDown={(e) => { if (e.key === 'Enter') insert(); }} /></label>
          <label>Funcția <input value={o.title} onChange={(e) => setO({ ...o, title: e.target.value })} placeholder="de ex. Administrator (opțional)"
            onKeyDown={(e) => { if (e.key === 'Enter') insert(); }} /></label>
          <label className="sign-check"><input type="checkbox" checked={o.date} onChange={(e) => setO({ ...o, date: e.target.checked })} /> rând pentru dată</label>
          <label>Așezare <select value={o.align} onChange={(e) => setO({ ...o, align: e.target.value as SignatureOpts['align'] })}>
            <option value="left">la stânga</option>
            <option value="center">la mijloc</option>
            <option value="right">la dreapta</option>
          </select></label>
          <div className="sign-actions">
            <button onClick={() => setOpen(false)}>Renunță</button>
            <button className="primary" onClick={insert}>Inserează</button>
          </div>
        </div>
      )}
    </div>
  );
}
