// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Fereastra proprie de întrebare, cu butoane în română („Rămân”, „Închide fără să salvez”), în locul lui confirm() din sistem.
// `ask(...)` întoarce numărul butonului ales (sau -1 la Esc / clic pe fundal); `<AskHost />` stă o singură dată în App.
import { useEffect, useRef, useState } from 'react';
import { setPasswordAsker } from './passwordAsk';

interface Request { title: string; message: string; buttons: string[]; primary: number; done: (i: number) => void; pw?: (v: string) => void; plain?: boolean; initial?: string }
let show: ((r: Request | null) => void) | null = null;

/** Butonul `primary` e cel apăsat cu Enter; Esc alege -1 (ca și cum ai rămâne). */
export function ask(title: string, message: string, buttons: string[], primary = 0): Promise<number> {
  return new Promise((resolve) => {
    // Fără fereastră, sau într-un test care a înlocuit confirm(): întrebarea simplă (ultimul buton = da).
    if (!show || !(/native code/.test(String(window.confirm)) || (window.confirm as { suiteWrapped?: boolean }).suiteWrapped)) { resolve(window.confirm(`${title}\n\n${message}`) ? buttons.length - 1 : 0); return; }
    show({ title, message, buttons, primary, done: resolve });
  });
}

/**
 * O parolă cerută în fereastra proprie (de exemplu la un .docx / .xlsx / .pptx protejat): textul scris, sau null la Renunță / Esc.
 * Parola nu se păstrează nicăieri.
 */
export function askPassword(title: string, message: string, ok = 'Deschide'): Promise<string | null> {
  return new Promise((resolve) => {
    if (!show) { resolve(window.prompt(title + String.fromCharCode(10, 10) + message)); return; }
    let v = '';
    show({ title, message, buttons: ['Renunță', ok], primary: 1, pw: (x) => { v = x; }, done: (i) => resolve(i === 1 ? v : null) });
  });
}

/** Un text scurt cerut în fereastra proprie (de exemplu textul unui cod QR): textul scris, sau null la Renunță / Esc. */
export function askText(title: string, message: string, initial = '', ok = 'OK'): Promise<string | null> {
  return new Promise((resolve) => {
    if (!show) { resolve(window.prompt(title + String.fromCharCode(10, 10) + message, initial)); return; }
    let v = initial;
    show({ title, message, buttons: ['Renunță', ok], primary: 1, plain: true, initial, pw: (x) => { v = x; }, done: (i) => resolve(i === 1 ? v : null) });
  });
}

export function AskHost() {
  const [req, setReq] = useState<Request | null>(null);
  const [pw, setPw] = useState('');
  const first = useRef<HTMLButtonElement>(null);
  const pwBox = useRef<HTMLInputElement>(null);
  useEffect(() => {
    show = setReq;
    setPasswordAsker((kind, wrong) => askPassword(wrong ? 'Parola nu e bună' : 'Fișier protejat cu parolă',
      `${wrong ? 'Parola scrisă nu se potrivește. Încearcă din nou' : `Fișierul .${kind} e protejat cu parolă. Scrie parola ca să-l deschizi`} (literele mari și mici contează). Parola nu se păstrează nicăieri; ca să rămână cu parolă, salvează-l cu „Export … cu parolă” (🔒).`));
    return () => { show = null; setPasswordAsker(null); };
  }, []);
  useEffect(() => { setPw(req?.initial ?? ''); (req?.pw ? pwBox : first).current?.focus(); if (req?.plain) pwBox.current?.select(); }, [req]);
  if (!req) return null;
  const pick = (i: number) => { req.pw?.(pw); setPw(''); setReq(null); req.done(i); };
  return (
    <div className="print-overlay ask-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) pick(-1); }}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); pick(-1); } }}>
      <div className="print-dlg ask-dlg" role="alertdialog" aria-modal="true" aria-label={req.title || req.message.split(String.fromCharCode(10))[0]}>
        {req.title && <h3>{req.title}</h3>}
        <p className="ask-msg">{req.message}</p>
        {req.pw && <input ref={pwBox} type={req.plain ? 'text' : 'password'} className="ask-pw" value={pw} onChange={(e) => setPw(e.target.value)} aria-label={req.plain ? 'Textul' : 'Parola'}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); pick(req.primary); } }} autoComplete="off" />}
        <div className="print-actions">
          {req.buttons.map((b, i) => (
            <button key={b} ref={i === req.primary ? first : undefined} className={i === req.primary ? 'primary' : ''} onClick={() => pick(i)}>{b}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** „Ai modificări nesalvate…” înainte de a deschide altceva: true = continui (modificările se pierd), false = rămâi. */
export async function askDiscard(where = '') {
  return (await ask('Continui fără să salvezi?', `Ai modificări nesalvate${where ? ' ' + where : ''}. Dacă continui, se pierd.`, ['Rămân', 'Continui fără să salvez'])) === 1;
}

/** O întrebare cu „Renunță” și un buton care spune ce se întâmplă („Șterge foaia”): true = s-a ales butonul. */
export async function askYes(message: string, yes: string, no = 'Renunță') {
  return (await ask('', message, [no, yes])) === 1;
}
