// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Fereastra „Semnează digital” (Pdf.tsx): ID-ul digital (creat aici, autosemnat, cu cheia păzită de parolă) și semnarea PDF-ului
// într-un câmp de semnătură gol sau într-unul nou, invizibil. Semnarea propriu-zisă e în digisign.ts.
import { useState } from 'react';
import { certOwner, createDigitalId, importPfxId, loadStoredId, openStoredId, saveStoredId, storeId, type DigitalId, type StoredId } from './digisign';
import { loadProfile } from './profile';
import { api, type WinCert } from '../api';

// Certificatul din Windows ales ultima dată (amprenta și datele publice; cheia rămâne în Windows / pe token).
const WIN_KEY = 'suite.pdf.winCert';
function loadWin(): WinCert | null {
  try { const v = JSON.parse(localStorage.getItem(WIN_KEY) ?? 'null'); return v && typeof v.thumb === 'string' && typeof v.der === 'string' ? v : null; } catch { return null; }
}
function saveWin(c: WinCert | null) {
  try { if (c) localStorage.setItem(WIN_KEY, JSON.stringify(c)); else localStorage.removeItem(WIN_KEY); } catch { /* fără memorie */ }
}
const fromB64 = (t: string) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
const today = () => new Date().toISOString().slice(0, 10);

export interface SignRequest {
  id: DigitalId;
  field: string;
  reason: string;
  location: string;
  /** Aspectul câmpului vizibil (PNG), dacă s-a ales un câmp cu loc pe pagină. */
  appearance?: Uint8Array;
  /** Semnătura vizibilă nouă: locul se alege pe pagină, după fereastră (Pdf.tsx), apoi vine `place`. */
  pick?: boolean;
  place?: { page: number; x: number; y: number; w: number; h: number };
  /** Certificarea (DocMDP): 0 = semnătură obișnuită. */
  certify: 0 | 1 | 2 | 3;
  /** Adresa serverului de marcă temporală (RFC 3161), dacă s-a cerut marca. */
  tsa?: string;
  /** La .docx / .xlsx / .pptx: semnătura separată (.p7s) în loc de cea din interiorul documentului. */
  separate?: boolean;
}

/** Valoarea care spune „câmp nou, vizibil, în locul ales pe pagină” în lista Unde. */
export const NEW_SPOT = '\u0000loc';

/**
 * Poza care apare în câmpul semnat, ca în programul de PDF cunoscut: în stânga numele semnatarului, mare (pe rânduri),
 * în dreapta „Semnat digital de”, numele, data cu ora și fusul orar (și motivul, dacă e). `rot` = rotirea paginii (0/90/180/270):
 * poza se desenează întoarsă invers, ca pe pagina văzută să apară dreaptă.
 */
export function sigAppearance(who: string, when: Date, reason: string, w: number, h: number, rot = 0): Uint8Array {
  const scale = 4, c = document.createElement('canvas');
  const vw = Math.max(30, Math.round(w * scale)), vh = Math.max(12, Math.round(h * scale));
  const side = rot === 90 || rot === 270;
  c.width = side ? vh : vw; c.height = side ? vw : vh;
  const ctx = c.getContext('2d')!;
  if (rot === 90) { ctx.translate(0, c.height); ctx.rotate(-Math.PI / 2); }
  else if (rot === 180) { ctx.translate(c.width, c.height); ctx.rotate(Math.PI); }
  else if (rot === 270) { ctx.translate(c.width, 0); ctx.rotate(Math.PI / 2); }
  const p = (n: number) => String(n).padStart(2, '0');
  const off = -when.getTimezoneOffset(), tz = `${off < 0 ? '-' : '+'}${p(Math.floor(Math.abs(off) / 60))}'${p(Math.abs(off) % 60)}'`;
  const font = (px: number, bold = false) => `${bold ? 'bold ' : ''}${px}px Arial, "Segoe UI", sans-serif`;
  // Cuvintele puse pe rânduri care încap în lățimea dată (un cuvânt prea lung se rupe la cratimă sau oriunde).
  const wrap = (text: string, maxW: number, px: number, bold = false) => {
    ctx.font = font(px, bold);
    const out: string[] = [];
    for (const word of text.split(/\s+/).filter(Boolean)) {
      let wd = word;
      const last = out.length ? out[out.length - 1] : '';
      if (last && ctx.measureText(last + ' ' + wd).width <= maxW) { out[out.length - 1] = last + ' ' + wd; continue; }
      while (ctx.measureText(wd).width > maxW && wd.length > 1) {
        let k = wd.length - 1;
        while (k > 1 && ctx.measureText(wd.slice(0, k)).width > maxW) k--;
        const dash = wd.lastIndexOf('-', k);
        const cut = dash > 0 ? dash + 1 : k;
        out.push(wd.slice(0, cut)); wd = wd.slice(cut);
      }
      out.push(wd);
    }
    return out;
  };
  const pad = vh * 0.06;
  const leftW = who ? vw * 0.46 : 0, rightX = leftW ? leftW + pad : pad, rightW = vw - rightX - pad;
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'top';
  // Stânga: numele, cât de mare încape.
  if (leftW) {
    let px = vh * 0.32, lines: string[] = [];
    for (; px > 6; px *= 0.92) { lines = wrap(who, leftW - pad, px); if (lines.length * px * 1.12 <= vh - 2 * pad) break; }
    ctx.font = font(px);
    const top = (vh - lines.length * px * 1.12) / 2;
    lines.forEach((t, i) => ctx.fillText(t, pad, top + i * px * 1.12));
  }
  // Dreapta: textul semnăturii, mai mic.
  const date = `${when.getFullYear()}.${p(when.getMonth() + 1)}.${p(when.getDate())} ${p(when.getHours())}:${p(when.getMinutes())}:${p(when.getSeconds())} ${tz}`;
  // Textul de pe pagină în limba interfeței de acum.
  const en = document.documentElement.lang === 'en';
  const parts = [en ? 'Digitally signed by' : 'Semnat digital de', who, `${en ? 'Date' : 'Data'}: ${date}`, ...(reason ? [`${en ? 'Reason' : 'Motiv'}: ${reason}`] : [])];
  let px = vh * 0.2, lines: string[] = [];
  for (; px > 5; px *= 0.92) { lines = parts.flatMap((t) => wrap(t, rightW, px)); if (lines.length * px * 1.15 <= vh - 2 * pad) break; }
  ctx.font = font(px);
  const top = (vh - lines.length * px * 1.15) / 2;
  lines.forEach((t, i) => ctx.fillText(t, rightX, top + i * px * 1.15));
  const url = c.toDataURL('image/png');
  return Uint8Array.from(atob(url.slice(url.indexOf(',') + 1)), (ch) => ch.charCodeAt(0));
}

export function DigiSignDialog(props: {
  fields: { name: string; page: number; w?: number; h?: number }[];
  field?: string;
  /** Semnătura .p7s a unui fișier oarecare (numele lui), nu a PDF-ului: fără câmp, motiv și certificare. */
  file?: string;
  /** Fișierul e .docx / .xlsx / .pptx: semnătura se poate pune și în interiorul lui. */
  office?: boolean;
  /** Semnarea unui document exportat chiar acum din Docs / Sheets / Slides (fără varianta .p7s). */
  exporting?: boolean;
  hasSigs: boolean;
  /** PDF-ul e deja certificat (sau are drepturi speciale): nu se mai poate certifica. */
  certified?: boolean;
  onSign: (r: SignRequest) => Promise<void>;
  onClose: () => void;
}) {
  const [stored, setStored] = useState<StoredId | null>(() => loadStoredId());
  const prof = loadProfile();
  const [owner, setOwner] = useState({ name: [prof?.prenume, prof?.nume].filter(Boolean).join(' '), org: prof?.firma ?? '', email: prof?.email ?? '' });
  const [pass, setPass] = useState('');
  const [separate, setSeparate] = useState(false);
  const inside = !!props.office && !separate;
  const [pass2, setPass2] = useState('');
  // Fără câmpuri goale în PDF, semnătura se pune vizibilă, în locul ales pe pagină (ca în programul de PDF cunoscut).
  const [field, setField] = useState(props.field ?? props.fields[0]?.name ?? NEW_SPOT);
  const [reason, setReason] = useState(() => { try { return localStorage.getItem('suite.pdf.sigReason') ?? ''; } catch { return ''; } });
  const [location, setLocation] = useState(() => { try { return localStorage.getItem('suite.pdf.sigPlace') ?? prof?.localitate ?? ''; } catch { return ''; } });
  const [certify, setCertify] = useState<0 | 1 | 2 | 3>(0);
  // Marca temporală: ora semnării confirmată de un server ales de utilizator (de obicei cel al furnizorului certificatului).
  const [useTsa, setUseTsa] = useState(() => { try { return localStorage.getItem('suite.pdf.tsaOn') === '1'; } catch { return false; } });
  const [tsa, setTsa] = useState(() => { try { return localStorage.getItem('suite.pdf.tsaUrl') ?? ''; } catch { return ''; } });
  const [busy, setBusy] = useState('');
  // Fără ID: „nou” = îl face Suite; „pfx” = certificatul din fișierul ales (octeții lui, până la parolă).
  const [mode, setMode] = useState<'nou' | 'pfx'>('nou');
  const [pfx, setPfx] = useState<{ name: string; data: Uint8Array } | null>(null);
  const [msg, setMsg] = useState('');
  // Certificatul din Windows (și de pe token / card): ales (win) sau lista din care alegi (winList).
  const [win, setWin] = useState<WinCert | null>(() => (api.signWinCert ? loadWin() : null));
  const [winList, setWinList] = useState<WinCert[] | null>(null);
  const [winPick, setWinPick] = useState('');
  const findWin = async () => {
    if (!api.listWinCerts) { setMsg('Certificatele de pe calculator se pot folosi doar în aplicația instalată.'); return; }
    setBusy('Se caută certificatele de pe calculator…'); setMsg('');
    try {
      const l = (await api.listWinCerts()).sort((a, b) => Number(a.to < today()) - Number(b.to < today()) || a.name.localeCompare(b.name, 'ro'));
      setWinList(l);
      setWinPick(l.find((c) => c.to >= today())?.thumb ?? l[0]?.thumb ?? '');
      if (!l.length) setMsg('Nu am găsit niciun certificat cu cheie pe acest calculator. Dacă ai un token sau un card, pune-l în calculator (cu programul lui instalat) și caută din nou.');
    } catch (e) { setMsg((e as Error).message); }
    setBusy('');
  };
  const useWin = () => {
    const c = winList?.find((x) => x.thumb === winPick);
    if (!c) return;
    if (c.to < today()) { setMsg(`Certificatul a expirat pe ${c.to}: nu mai poate semna.`); return; }
    saveWin(c); setWin(c); setWinList(null); setMsg('');
  };

  const create = async () => {
    if (!owner.name.trim()) { setMsg('Scrie numele.'); return; }
    if (pass.length < 6) { setMsg('Parola trebuie să aibă cel puțin 6 caractere.'); return; }
    if (pass !== pass2) { setMsg('Parolele nu sunt la fel.'); return; }
    setBusy('Se creează ID-ul digital…'); setMsg('');
    try {
      const id = await createDigitalId(owner);
      const s = await storeId(id, pass);
      saveStoredId(s);
      setStored(s);
      setPass(''); setPass2('');
    } catch (e) { setMsg((e as Error).message); }
    setBusy('');
  };
  const pickPfx = async () => {
    setMsg('');
    const f = await api.importFile('pfx');
    if (!f) return;
    setPfx({ name: f.path.split(/[/]|[\\]/).pop() ?? f.path, data: f.data });
    setMode('pfx');
  };
  const usePfx = async () => {
    if (!pfx) return;
    setBusy('Se citește certificatul…'); setMsg('');
    try {
      const id = await importPfxId(pfx.data, pass);
      // Cheia se păstrează criptată cu aceeași parolă ca a fișierului .pfx.
      const s = await storeId(id, pass);
      saveStoredId(s);
      setStored(s);
      setPfx(null); setPass(''); setMode('nou');
    } catch (e) { setMsg((e as Error).message); }
    setBusy('');
  };
  const sign = async () => {
    if (!stored && !win) return;
    if (useTsa && !/^https?:[/][/][^ ]+$/i.test(tsa.trim())) { setMsg('Scrie adresa serverului de marcă temporală (începe cu http:// sau https://).'); return; }
    try { localStorage.setItem('suite.pdf.tsaOn', useTsa ? '1' : '0'); if (useTsa) localStorage.setItem('suite.pdf.tsaUrl', tsa.trim()); } catch { /* */ }
    setBusy(win ? 'Se semnează… Dacă certificatul e pe token sau card, sistemul îți cere PIN-ul în fereastra lui.' : useTsa ? 'Se semnează și se cere marca temporală…' : 'Se semnează…'); setMsg('');
    try {
      let id: DigitalId;
      if (win) {
        if (win.to < today()) throw new Error(`Certificatul a expirat pe ${win.to}: nu mai poate semna.`);
        const cert = fromB64(win.der);
        const sw = api.signWinCert!;
        id = { owner: certOwner(cert), cert, chain: win.chain.map(fromB64), ec: win.ec, signer: (data) => sw(win.thumb, data, win.ec) };
      } else id = await openStoredId(stored!, pass);
      try { localStorage.setItem('suite.pdf.sigReason', reason.trim()); localStorage.setItem('suite.pdf.sigPlace', location.trim()); } catch { /* */ }
      const f = props.fields.find((x) => x.name === field);
      const pick = !props.file && field === NEW_SPOT;
      const appearance = !pick && f?.w && f?.h ? sigAppearance(id.owner.name, new Date(), reason.trim(), f.w, f.h) : undefined;
      await props.onSign({ id, field: pick ? '' : field, reason: reason.trim(), location: location.trim(), appearance, certify, ...(pick ? { pick } : {}), ...(useTsa ? { tsa: tsa.trim() } : {}), ...(separate ? { separate } : {}) });
    } catch (e) { setMsg((e as Error).message); setBusy(''); }
  };
  const exportCert = async () => {
    if (!stored) return;
    await api.exportFile({ format: 'cer', suggestedName: `Certificat ${stored.owner.name}`, data: Uint8Array.from(atob(stored.cert), (c) => c.charCodeAt(0)) });
  };
  const forget = () => {
    if (!confirm('Ștergi ID-ul digital de pe acest calculator? PDF-urile semnate deja rămân semnate, dar nu mai poți semna cu el.')) return;
    saveStoredId(null); setStored(null);
  };

  const stampRow = (
    <>
      <label className="pdf-extract-row" title="Ora semnării confirmată de un server de marcă temporală (RFC 3161): dovedește că semnătura exista la acea oră, chiar și după ce certificatul expiră. Serverului i se trimite doar amprenta semnăturii, nu documentul.">
        <input type="checkbox" aria-label="Adaugă marca temporală" checked={useTsa} onChange={(e) => setUseTsa(e.target.checked)} /> Adaugă marca temporală (ora confirmată de un server)
      </label>
      {useTsa && <label className="pdf-extract-row">Serverul:<input aria-label="Serverul de marcă temporală" value={tsa} placeholder="adresa primită de la furnizorul certificatului" onChange={(e) => setTsa(e.target.value)} /></label>}
    </>
  );
  const where = <>{props.file ? (props.exporting ? (
    <p className="print-info">Documentul se salvează ca <b>{props.file}</b>, cu semnătura digitală în interior: cine îl deschide vede cine a semnat și dacă s-a schimbat ceva. După semnare nu-l mai modifica: orice schimbare strică semnătura.</p>
  ) : props.office ? (
    <>
      <p className="print-info">Fișierul: <b>{props.file}</b>. {inside ? 'Semnătura se pune în interiorul documentului, ca în programele de birou: cine îl deschide vede cine a semnat și dacă s-a schimbat ceva. Se salvează o copie „(semnat)”; fișierul tău rămâne neschimbat.' : 'Semnătura se salvează alături, ca fișier .p7s separat (CMS, SHA-256); fișierul rămâne neschimbat. Cine îl primește are nevoie de amândouă.'}</p>
      <label className="pdf-extract-row"><input type="checkbox" aria-label="Semnătura separată (.p7s)" checked={separate} onChange={(e) => setSeparate(e.target.checked)} /> Semnătura separată, ca fișier .p7s (documentul nu se schimbă deloc)</label>
    </>
  ) : (
    <p className="print-info">Fișierul: <b>{props.file}</b>. Semnătura se salvează alături, ca fișier .p7s separat (CMS, SHA-256); fișierul rămâne neschimbat. Cine îl primește are nevoie de amândouă.</p>
  )) : (
    <>
      <label className="pdf-extract-row">Unde:
        <select aria-label="Câmpul de semnătură" value={field} onChange={(e) => setField(e.target.value)}>
          {props.fields.map((f) => <option key={f.name} value={f.name}>câmpul „{f.name}”{f.page ? `, pagina ${f.page}` : ''}</option>)}
          <option value={NEW_SPOT}>pe pagină, unde aleg eu (trag un dreptunghi)</option>
          <option value="">semnătură invizibilă (fără câmp pe pagină)</option>
        </select>
      </label>
      <label className="pdf-extract-row">Motivul:<input aria-label="Motivul" value={reason} placeholder="de ex. Sunt de acord cu acest document" onChange={(e) => setReason(e.target.value)} /></label>
      <label className="pdf-extract-row">Locul:<input aria-label="Locul" value={location} onChange={(e) => setLocation(e.target.value)} /></label>
      {!props.hasSigs && !props.certified && (
        <label className="pdf-extract-row" title="Certificarea: tu, ca autor, garantezi conținutul; cine îl deschide vede dacă s-a schimbat altceva decât ce ai permis">Felul:
          <select aria-label="Felul semnăturii" style={{ flex: 1, minWidth: 0 }} value={certify} onChange={(e) => setCertify(Number(e.target.value) as 0 | 1 | 2 | 3)}>
            <option value={0}>semnătură obișnuită</option>
            <option value={2}>certifică documentul: se mai pot completa formularul și pune semnături</option>
            <option value={3}>certifică documentul: formular, semnături și comentarii</option>
            <option value={1}>certifică documentul: nu se mai poate schimba nimic</option>
          </select>
        </label>
      )}
    </>
  )}{stampRow}</>;

  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) props.onClose(); }}>
      <div className="print-dlg pdf-extract pdf-digisign" role="dialog" aria-label="Semnează digital" onKeyDown={(e) => { if (e.key === 'Escape' && !busy) { e.preventDefault(); props.onClose(); } }}>
        <h3>🔏 Semnează digital (cu certificat)</h3>
        {winList ? (
          <>
            <p className="print-info">Certificatele tale instalate pe calculator, cu tot cu cele de pe token USB sau card (dacă e pus în calculator).
              Cheia secretă rămâne pe calculator sau pe token: la semnare, sistemul îți cere PIN-ul în fereastra lui, iar Cyber Office Studio nu-l vede.</p>
            {winList.length > 0 && (
              <label className="pdf-extract-row">Certificatul:
                <select autoFocus aria-label="Certificatul de pe calculator" value={winPick} onChange={(e) => setWinPick(e.target.value)}>
                  {winList.map((c) => <option key={c.thumb} value={c.thumb}>{c.name} · emis de {c.issuer} · {c.to < today() ? `expirat pe ${c.to}` : `valabil până la ${c.to}`}</option>)}
                </select>
              </label>
            )}
          </>
        ) : win ? (
          <>
            <p className="print-info">Certificat de pe calculator: <b>{win.name}</b>, emis de {win.issuer}, valabil până la {win.to} ·
              {' '}<button className="link" onClick={findWin}>Alt certificat…</button> ·
              {' '}<button className="link" onClick={() => { saveWin(null); setWin(null); }}>Nu mai folosi certificatul de pe calculator</button></p>
            {where}
            <p className="print-info">{props.file ? 'Semnătura se face cu cheia de pe calculator: dacă certificatul e pe token sau card, ține-l pus și scrie PIN-ul în fereastra care apare. Apoi alegi unde se salvează semnătura.' : 'Semnătura se face cu cheia de pe calculator: dacă certificatul e pe token sau card, ține-l pus și scrie PIN-ul în fereastra care apare. Apoi alegi unde se salvează PDF-ul semnat; semnăturile de dinainte rămân valabile.'}</p>
          </>
        ) : !stored && mode === 'pfx' && pfx ? (
          <>
            <p className="print-info">Certificatul din <b>{pfx.name}</b>. Scrie parola fișierului; cheia se păstrează pe acest calculator, criptată cu aceeași parolă, iar la semnare îți ceri tot parola asta.</p>
            <label className="pdf-extract-row">Parola fișierului .pfx:<input autoFocus type="password" aria-label="Parola fișierului .pfx" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); usePfx(); } }} /></label>
          </>
        ) : !stored ? (
          <>
            <p className="print-info">Ca să semnezi digital ai nevoie de un ID digital. Cyber Office Studio îți face unul aici: un certificat cu numele tău și o cheie secretă,
              păstrate pe acest calculator și păzite de o parolă. Semnătura arată cine a semnat și dacă PDF-ul s-a schimbat după aceea.
              ID-ul e făcut de tine (autosemnat); pentru acte care cer semnătură electronică calificată ai nevoie de un certificat de la un furnizor autorizat.</p>
            <label className="pdf-extract-row">Numele:<input autoFocus aria-label="Numele" value={owner.name} onChange={(e) => setOwner({ ...owner, name: e.target.value })} /></label>
            <label className="pdf-extract-row">Organizația (dacă e cazul):<input aria-label="Organizația" value={owner.org} onChange={(e) => setOwner({ ...owner, org: e.target.value })} /></label>
            <label className="pdf-extract-row">E-mail:<input aria-label="E-mail" value={owner.email} onChange={(e) => setOwner({ ...owner, email: e.target.value })} /></label>
            <label className="pdf-extract-row">Parola ID-ului:<input type="password" aria-label="Parola ID-ului" value={pass} onChange={(e) => setPass(e.target.value)} /></label>
            <label className="pdf-extract-row">Încă o dată:<input type="password" aria-label="Parola din nou" value={pass2} onChange={(e) => setPass2(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create(); } }} /></label>
            <p className="print-info">Valabil 5 ani. Dacă uiți parola, ID-ul nu mai poate fi folosit (faci altul).</p>
            <p className="print-info">Ai deja un certificat (de la un furnizor sau exportat din alt program)? <button className="link" onClick={pickPfx}>Folosește un certificat .pfx / .p12…</button></p>
            {api.listWinCerts && <p className="print-info">Ai un certificat calificat pe token USB sau card, ori unul instalat pe calculator? <button className="link" onClick={findWin}>Folosește un certificat de pe calculator sau token…</button></p>}
          </>
        ) : (
          <>
            <p className="print-info">{stored.fromPfx ? 'Certificat din .pfx' : 'ID digital'}: <b>{stored.owner.name}</b>{stored.owner.org ? ` (${stored.owner.org})` : ''}{stored.owner.email ? `, ${stored.owner.email}` : ''} ·
              {' '}<button className="link" onClick={exportCert} title="Salvează certificatul (fără cheia secretă), ca să-l dai celor care vor să verifice semnăturile tale">Exportă certificatul (.cer)</button> ·
              {' '}<button className="link" onClick={forget}>Șterge ID-ul</button>
              {api.listWinCerts && <> · <button className="link" onClick={findWin}>Folosește un certificat de pe calculator sau token…</button></>}</p>
            {where}
            <label className="pdf-extract-row">Parola ID-ului:<input autoFocus type="password" aria-label="Parola ID-ului" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sign(); } }} /></label>
            {!props.file && <p className="print-info">Semnătura se pune în ultimul pas: alegi unde se salvează PDF-ul semnat. Ea se adaugă la sfârșitul fișierului, deci semnăturile de dinainte rămân valabile. După semnare nu mai schimba PDF-ul (orice modificare strică semnătura).</p>}
          </>
        )}
        {busy && <p className="print-info" role="status">{busy}</p>}
        {msg && <p className="pdf-attach-msg" role="alert">{msg}</p>}
        <div className="print-actions">
          {winList ? <button onClick={() => { setWinList(null); setMsg(''); }} disabled={!!busy}>Înapoi</button> : <button onClick={props.onClose} disabled={!!busy}>Renunță</button>}
          {winList
            ? <button className="primary" onClick={useWin} disabled={!!busy || !winPick}>Folosește certificatul</button>
            : win
            ? <button className="primary" onClick={sign} disabled={!!busy}>{!props.file && field === NEW_SPOT ? 'Alege locul pe pagină…' : 'Semnează și salvează…'}</button>
            : !stored && mode === 'pfx' && pfx
            ? <button className="primary" onClick={usePfx} disabled={!!busy || !pass}>Folosește certificatul</button>
            : !stored
            ? <button className="primary" onClick={create} disabled={!!busy}>Creează ID-ul digital</button>
            : <button className="primary" onClick={sign} disabled={!!busy || !pass}>{!props.file && field === NEW_SPOT ? 'Alege locul pe pagină…' : 'Semnează și salvează…'}</button>}
        </div>
      </div>
    </div>
  );
}
