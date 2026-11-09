// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Butonul ¶ din Docs: spațiul înainte / după paragraf și prima linie (retrasă sau agățată), ca fereastra „Paragraf” din Word.
import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { FIRST_LINE_STEPS, INDENT_CM, MAX_INDENT, MAX_RIGHT, SPACE_STEPS } from './paragraphFormat';
import { ALIGN_NAMES, LEADER_NAMES, MAX_TAB_CM, parseStops, type TabAlign, type TabLeader } from './tabStops';

const comma = (n: number) => String(n).replace('.', ',');

export default function ParagraphSpacing({ editor, keytip }: { editor: Editor; keytip?: string }) {
  const [open, setOpen] = useState(false);
  const [tabPos, setTabPos] = useState('');
  const [tabAlign, setTabAlign] = useState<TabAlign>('l');
  const [tabLeader, setTabLeader] = useState<TabLeader>('');
  const box = useRef<HTMLDivElement>(null);
  // Ce se scrie acum în căsuțele de retragere (se aplică la Enter sau la ieșirea din căsuță).
  const [leftTxt, setLeftTxt] = useState<string | null>(null);
  const [rightTxt, setRightTxt] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); editor.commands.focus(); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open, editor]);

  const type = editor.isActive('heading') ? 'heading' : 'paragraph';
  const a = editor.getAttributes(type);
  const before = a.spaceBefore as number | null ?? null;
  const after = a.spaceAfter as number | null ?? null;
  const first = Number(a.firstLine) || 0;
  const kind = first > 0 ? 'first' : first < 0 ? 'hang' : '';
  const stops = parseStops(a.tabStops as string | null);
  const pos = Number(tabPos.replace(',', '.'));
  const posOk = pos > 0 && pos <= MAX_TAB_CM;
  const addStop = () => { if (!posOk) return; editor.chain().focus().setTabStops([...stops.filter((t) => Math.abs(t.pos - pos) >= 0.01), { pos, align: tabAlign, leader: tabLeader }]).run(); setTabPos(''); };
  const set = (attrs: Record<string, number | boolean | null>) => editor.chain().focus().setParagraphSpacing(attrs).run();
  const leftCm = Math.round((Number(a.indent) || 0) * INDENT_CM * 100) / 100;
  const rightCm = Number(a.indentRight) || 0;
  const cm = (t: string, max: number) => { const n = Number(t.trim().replace(',', '.')); return Number.isFinite(n) ? Math.min(max, Math.max(0, Math.round(n * 100) / 100)) : null; };
  const applyLeft = () => { if (leftTxt === null) return; const n = cm(leftTxt, MAX_INDENT * INDENT_CM); setLeftTxt(null); if (n !== null) set({ indent: Math.round((n / INDENT_CM) * 10000) / 10000 }); };
  const applyRight = () => { if (rightTxt === null) return; const n = cm(rightTxt, MAX_RIGHT); setRightTxt(null); if (n !== null) set({ indentRight: n || null }); };
  // Valorile din afara listei (de exemplu 10 pt dintr-un fișier Word) apar și ele, ca să se vadă ce e scris.
  const spaces = (v: number | null) => (v !== null && !SPACE_STEPS.includes(v) ? [...SPACE_STEPS, v].sort((x, y) => x - y) : SPACE_STEPS);
  const amounts = Math.abs(first) && !FIRST_LINE_STEPS.includes(Math.abs(first)) ? [...FIRST_LINE_STEPS, Math.abs(first)].sort((x, y) => x - y) : FIRST_LINE_STEPS;

  return (
    <div className="sym-wrap" ref={box}>
      <button className={`fmt ${open ? 'active' : ''}`} data-keytip={keytip} onMouseDown={(e) => e.preventDefault()} onClick={() => setOpen(!open)}
        title="Paragraf: spațiu înainte / după, prima linie (retrasă sau agățată) și tabulatori">⇕</button>
      {open && (
        <div className="sym-pop para-pop" role="dialog" aria-label="Paragraf">
          <div className="sym-head">Spațiere (puncte)</div>
          <label>Înainte
            <select aria-label="Spațiu înainte" value={before ?? ''} onChange={(e) => set({ spaceBefore: e.target.value === '' ? null : Number(e.target.value) })}>
              <option value="">Obișnuit</option>
              {spaces(before).map((v) => <option key={v} value={v}>{comma(v)} pt</option>)}
            </select>
          </label>
          <label>După
            <select aria-label="Spațiu după" value={after ?? ''} onChange={(e) => set({ spaceAfter: e.target.value === '' ? null : Number(e.target.value) })}>
              <option value="">Obișnuit</option>
              {spaces(after).map((v) => <option key={v} value={v}>{comma(v)} pt</option>)}
            </select>
          </label>
          <div className="sym-head">Retragere (cm)</div>
          <label>La stânga
            <input aria-label="Retragerea la stânga (cm)" value={leftTxt ?? comma(leftCm)} onChange={(e) => setLeftTxt(e.target.value)} onBlur={applyLeft}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyLeft(); } }} />
          </label>
          <label>La dreapta
            <input aria-label="Retragerea la dreapta (cm)" value={rightTxt ?? comma(rightCm)} onChange={(e) => setRightTxt(e.target.value)} onBlur={applyRight}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyRight(); } }} />
          </label>
          <div className="sym-head">Prima linie</div>
          <label>Fel
            <select aria-label="Prima linie" value={kind} onChange={(e) => {
              const k = e.target.value, n = Math.abs(first) || 1.25;
              set({ firstLine: k === 'first' ? n : k === 'hang' ? -n : null });
            }}>
              <option value="">Fără</option>
              <option value="first">Retrasă (ca la romane)</option>
              <option value="hang">Agățată (ca la bibliografie)</option>
            </select>
          </label>
          <label>Cu
            <select aria-label="Cât de retrasă" disabled={!kind} value={Math.abs(first) || 1.25}
              onChange={(e) => set({ firstLine: (kind === 'hang' ? -1 : 1) * Number(e.target.value) })}>
              {amounts.map((v) => <option key={v} value={v}>{comma(v)} cm</option>)}
            </select>
          </label>
          <div className="sym-head">Pagini</div>
          <label className="para-check" title="Paragraful stă pe aceeași pagină cu următorul (de exemplu un titlu cu textul lui)"><input type="checkbox" checked={!!a.keepNext} onChange={(e) => set({ keepNext: e.target.checked })} /> Păstrează cu următorul</label>
          <label className="para-check" title="Paragraful nu se rupe pe două pagini"><input type="checkbox" checked={!!a.keepLines} onChange={(e) => set({ keepLines: e.target.checked })} /> Păstrează liniile împreună</label>
          <label className="para-check" title="Control rânduri văduve / orfane: primul sau ultimul rând al paragrafului nu rămâne singur jos sau sus pe pagină (pornit de la sine)"><input type="checkbox" checked={!a.noWidow} onChange={(e) => set({ noWidow: !e.target.checked })} /> Control rânduri văduve / orfane</label>
          <div className="sym-head" title="Tasta Tab sare la oprirea următoare. Fără opriri proprii, sare din 1,25 în 1,25 cm.">Tabulatori (cm de la margine)</div>
          {stops.map((t) => (
            <div className="tab-stop-row" key={t.pos}>
              <span>{comma(t.pos)} cm · {ALIGN_NAMES[t.align]}{t.leader ? ` · ${LEADER_NAMES[t.leader]}` : ''}</span>
              <button className="fmt" title="Șterge oprirea" aria-label={`Șterge oprirea de la ${comma(t.pos)} cm`} onMouseDown={(e) => e.preventDefault()}
                onClick={() => editor.chain().focus().setTabStops(stops.filter((x) => x !== t)).run()}>✕</button>
            </div>
          ))}
          <div className="tab-stop-row">
            <input aria-label="Poziția opririi (cm)" placeholder="cm" value={tabPos} onChange={(e) => setTabPos(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addStop(); } }} />
            <select aria-label="Alinierea opririi" value={tabAlign} onChange={(e) => setTabAlign(e.target.value as TabAlign)}>
              {(Object.keys(ALIGN_NAMES) as TabAlign[]).map((k) => <option key={k} value={k}>{ALIGN_NAMES[k]}</option>)}
            </select>
            <select aria-label="Umplerea până la oprire" value={tabLeader} onChange={(e) => setTabLeader(e.target.value as TabLeader)}>
              {Object.keys(LEADER_NAMES).map((k) => <option key={k} value={k}>{LEADER_NAMES[k]}</option>)}
            </select>
            <button className="fmt" disabled={!posOk} onMouseDown={(e) => e.preventDefault()} onClick={addStop}>Adaugă</button>
          </div>
          {stops.length > 0 && <button className="para-reset" onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().setTabStops([]).run()}>Șterge toate opririle</button>}
          <button className="para-reset" onMouseDown={(e) => e.preventDefault()}
            onClick={() => set({ spaceBefore: null, spaceAfter: null, firstLine: null, indent: 0, indentRight: null })}>Ca de obicei</button>
        </div>
      )}
    </div>
  );
}

/** Fila Aspect › Paragraf: retragerile (cm) și spațiul înainte / după (pt) scrise direct în panglică, fără fereastră. */
export function ParagraphQuick({ editor }: { editor: Editor }) {
  const [leftTxt, setLeftTxt] = useState<string | null>(null);
  const [rightTxt, setRightTxt] = useState<string | null>(null);
  const type = editor.isActive('heading') ? 'heading' : 'paragraph';
  const a = editor.getAttributes(type);
  const before = a.spaceBefore as number | null ?? null;
  const after = a.spaceAfter as number | null ?? null;
  const set = (attrs: Record<string, number | boolean | null>) => editor.chain().focus().setParagraphSpacing(attrs).run();
  const leftCm = Math.round((Number(a.indent) || 0) * INDENT_CM * 100) / 100;
  const rightCm = Number(a.indentRight) || 0;
  const cm = (t: string, max: number) => { const n = Number(t.trim().replace(',', '.')); return Number.isFinite(n) ? Math.min(max, Math.max(0, Math.round(n * 100) / 100)) : null; };
  const applyLeft = () => { if (leftTxt === null) return; const n = cm(leftTxt, MAX_INDENT * INDENT_CM); setLeftTxt(null); if (n !== null) set({ indent: Math.round((n / INDENT_CM) * 10000) / 10000 }); };
  const applyRight = () => { if (rightTxt === null) return; const n = cm(rightTxt, MAX_RIGHT); setRightTxt(null); if (n !== null) set({ indentRight: n || null }); };
  const spaces = (v: number | null) => (v !== null && !SPACE_STEPS.includes(v) ? [...SPACE_STEPS, v].sort((x, y) => x - y) : SPACE_STEPS);
  const enter = (apply: () => void) => (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } else if (e.key === 'Escape') { setLeftTxt(null); setRightTxt(null); editor.commands.focus(); } };
  return (
    <span className="para-quick">
      <span className="para-quick-col">
        <label title="Retragerea paragrafului la stânga, în centimetri (Enter aplică)">⇤ <input aria-label="Retragere stânga (cm)" value={leftTxt ?? comma(leftCm)} onChange={(e) => setLeftTxt(e.target.value)} onBlur={applyLeft} onKeyDown={enter(applyLeft)} /> cm</label>
        <label title="Retragerea paragrafului la dreapta, în centimetri (Enter aplică)">⇥ <input aria-label="Retragere dreapta (cm)" value={rightTxt ?? comma(rightCm)} onChange={(e) => setRightTxt(e.target.value)} onBlur={applyRight} onKeyDown={enter(applyRight)} /> cm</label>
      </span>
      <span className="para-quick-col">
        <label title="Spațiul de deasupra paragrafului, în puncte">↥ <select aria-label="Spațiu înainte (pt)" value={before ?? ''} onChange={(e) => set({ spaceBefore: e.target.value === '' ? null : Number(e.target.value) })}>
          <option value="">Obișnuit</option>
          {spaces(before).map((v) => <option key={v} value={v}>{comma(v)} pt</option>)}
        </select></label>
        <label title="Spațiul de sub paragraf, în puncte">↧ <select aria-label="Spațiu după (pt)" value={after ?? ''} onChange={(e) => set({ spaceAfter: e.target.value === '' ? null : Number(e.target.value) })}>
          <option value="">Obișnuit</option>
          {spaces(after).map((v) => <option key={v} value={v}>{comma(v)} pt</option>)}
        </select></label>
      </span>
    </span>
  );
}
