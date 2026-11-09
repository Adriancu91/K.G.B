// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Fișier → Opțiuni în Docs (ca Opțiuni din procesoarele de text): numele autorului, corectarea, salvarea și afișarea.
// Fiecare schimbare se aplică pe loc și se păstrează (setările aplicației sau memoria locală, ca butoanele de pe panglică).

interface Props {
  author: string;
  setAuthor(a: string): void;
  spell: boolean;
  onSpell(): void;
  autoSave: boolean;
  onAutoSave(on: boolean): void;
  autoLang: boolean;
  onAutoLang(on: boolean): void;
  ruler: boolean;
  onRuler(): void;
  nav: boolean;
  onNav(on: boolean): void;
  styles: boolean;
  onStyles(on: boolean): void;
  comments: boolean;
  onComments(on: boolean): void;
  marks: boolean;
  onMarks(): void;
  onAutoCorrect(): void;
  onClose(): void;
}

export default function OptionsDialog(p: Props) {
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) p.onClose(); }}>
      <div className="print-dlg doc-opt-dlg" role="dialog" aria-label="Opțiuni"
        onKeyDown={(e) => { if (e.key === 'Escape' || (e.key === 'Enter' && e.target instanceof HTMLInputElement && e.target.type === 'text')) { e.preventDefault(); p.onClose(); } }}>
        <h3>Opțiuni</h3>
        <h4>General</h4>
        <label className="print-row">Numele tău:
          <input type="text" autoFocus aria-label="Numele autorului" value={p.author} maxLength={60} placeholder="de exemplu: Ana Popescu"
            onChange={(e) => p.setAuthor(e.target.value)} style={{ width: 220 }} />
        </label>
        <p className="print-info">Apare la comentarii și la modificările urmărite.</p>
        <h4>Corectare</h4>
        <label className="print-row"><input type="checkbox" aria-label="Ortografie la scris" checked={p.spell} onChange={p.onSpell} /> Verifică ortografia în timp ce scrii (cuvintele greșite subliniate cu roșu)</label>
        <div className="print-row"><button onClick={p.onAutoCorrect}>Opțiuni AutoCorect…</button></div>
        <h4>Salvare</h4>
        <label className="print-row"><input type="checkbox" aria-label="Detectează limba la lipire" checked={p.autoLang} onChange={(e) => p.onAutoLang(e.target.checked)} /> Detectează limba textului lipit sau scris: un pasaj lipit sau un paragraf scris (în timp ce scrii) în engleză, franceză, germană… primește limba lui, ca să nu fie subliniat ca greșit</label>
        <label className="print-row"><input type="checkbox" aria-label="Salvare automată" checked={p.autoSave} onChange={(e) => p.onAutoSave(e.target.checked)} /> Salvare automată: documentul deja salvat într-un fișier se salvează singur după fiecare schimbare</label>
        <p className="print-info">Debifat: schimbările se scriu în fișier doar la Ctrl+S. Documentele fără fișier se păstrează oricum ca ciornă (Fișier → Recuperează…).</p>
        <h4>Afișare</h4>
        <label className="print-row"><input type="checkbox" aria-label="Rigla" checked={p.ruler} onChange={p.onRuler} /> Rigla deasupra paginii</label>
        <label className="print-row"><input type="checkbox" aria-label="Panoul de navigare" checked={p.nav} onChange={(e) => p.onNav(e.target.checked)} /> Panoul de navigare (titlurile documentului)</label>
        <label className="print-row"><input type="checkbox" aria-label="Panoul Stiluri" checked={p.styles} onChange={(e) => p.onStyles(e.target.checked)} /> Panoul Stiluri</label>
        <label className="print-row"><input type="checkbox" aria-label="Panoul de comentarii" checked={p.comments} onChange={(e) => p.onComments(e.target.checked)} /> Panoul cu comentarii și modificări</label>
        <label className="print-row"><input type="checkbox" aria-label="Semnele de formatare" checked={p.marks} onChange={p.onMarks} /> Semnele de formatare (¶ la sfârșit de paragraf, · la spații, → la Tab)</label>
        <div className="print-actions">
          <button onClick={p.onClose}>OK</button>
        </div>
      </div>
    </div>
  );
}
