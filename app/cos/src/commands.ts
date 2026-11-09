// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Registrul de comenzi: fiecare aplicație își pune aici comenzile (cu scurtătura lor), iar paleta Ctrl+K le găsește
// chiar dacă butonul lor nu se vede acum (e într-un panou închis sau există doar ca scurtătură de la tastatură).
// Butoanele vizibile le găsește paleta și singură, din pagină; aici intră cele pe care altfel nu le-ar vedea.
import { useEffect } from 'react';
import { currentModule } from './active';

export interface Command {
  label: string;
  /** Scurtătura de la tastatură, cum o scrie utilizatorul: „Ctrl+Shift+E”. */
  keys?: string;
  hint?: string;
  /** Comanda se poate folosi acum (de exemplu „Unește în jos” doar cu cel puțin două straturi). */
  when?: () => boolean;
  run: () => void;
}

const reg = new Map<string, { owner: string; cmds: Command[] }>();

/** Comenzile aplicației `owner`; se reînnoiesc la fiecare desenare (ca să vadă starea de acum) și dispar când aplicația se închide.
 *  `part`: o listă în plus a aceleiași aplicații (de exemplu comenzile Aranjare), care nu o înlocuiește pe cea principală. */
export function useCommands(owner: string, cmds: Command[], part = '') {
  useEffect(() => {
    const key = part ? owner + '|' + part : owner;
    const entry = { owner, cmds };
    reg.set(key, entry);
    return () => { if (reg.get(key) === entry) reg.delete(key); };
  });
}

/** Comenzile care se pot folosi acum, din aplicația din față (celelalte stau deschise în spate). */
export function activeCommands(): Command[] {
  const out: Command[] = [];
  for (const { owner, cmds } of reg.values()) if (owner === currentModule()) for (const c of cmds) {
    try { if (!c.when || c.when()) out.push(c); } catch { /* o comandă stricată nu strică paleta */ }
  }
  return out;
}

// Pentru teste: comenzile din registru ale aplicației din față.
(window as unknown as { __suiteCommands?: () => Command[] }).__suiteCommands = activeCommands;

/** Scurtătura scrisă în explicația unui buton („… (Ctrl+E)”), dacă are. */
export function keysFromTitle(title: string): string {
  const m = title.match(/\b(?:(?:Ctrl|Alt|Shift)\+)+(?:[A-Za-zĂÂÎȘȚăâîșț0-9]|F\d{1,2}|Enter|Delete|Tab|Space|Esc|[=+\-[\]<>`.,/])(?![A-Za-z])|\bF\d{1,2}\b/);
  return m ? m[0] : '';
}
