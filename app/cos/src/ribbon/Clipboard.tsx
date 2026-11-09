// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Grupul Clipboard comun (Pornire, primul grup), așezat ca în programele de birou cunoscute: Lipire mare în stânga
// (cu ▾ pentru variantele de lipire), apoi pe trei rânduri Decupare, Copiere (cu ▾ dacă are variante) și Format pensulă.
// Literele tastelor de acces sunt cele cunoscute: V, X, C, FP. Comenzile implicite trimit cut / copy / paste
// la locul în care e cursorul (aplicația le prinde ca pe Ctrl+X / Ctrl+C / Ctrl+V).
import { ReactNode } from 'react';
import { RGroup, RMenu, RMenuItem, RSplit } from './Ribbon';
import { clipCmd } from '../clipCmd';

const run = (cmd: 'cut' | 'copy' | 'paste', focus?: () => void) => () => { focus?.(); clipCmd(cmd); };

export function ClipboardGroup({ focus, pasteItems, copyItems, painter, children, launcher }: {
  /** Pune cursorul înapoi în document / tabel înainte de comandă. */
  focus?: () => void;
  /** Variantele din ▾ Lipire (de exemplu Lipire specială…, Doar text). */
  pasteItems?: RMenuItem[];
  /** Variantele din ▾ Copiere (de exemplu Copiere ca imagine…). */
  copyItems?: RMenuItem[];
  /** Butonul Format pensulă al aplicației (fiecare își are pensula ei). */
  painter?: ReactNode;
  /** Comenzile noastre în plus, după cele standard. */
  children?: ReactNode;
  launcher?: { title: string; run(): void };
}) {
  const paste = run('paste', focus);
  return (
    <RGroup label="Clipboard" keep launcher={launcher}>
      <RSplit icon="📋" label="Lipire" title="Lipire (Ctrl+V)" keytip="V" run={paste}
        items={[{ label: 'Lipire', title: 'Lipire (Ctrl+V)', run: paste }, ...(pasteItems ?? [])]} />
      <div className="rb-stack">
        <button className="rb-small" data-keytip="X" onMouseDown={(e) => e.preventDefault()} onClick={run('cut', focus)} title="Decupare (Ctrl+X)" aria-label="Decupare">
          <span className="rb-ico">✂</span><span className="rb-txt rb-opt">Decupare</span>
        </button>
        {copyItems?.length ? (
          <RMenu label="⧉ Copiere" title="Copiere (Ctrl+C) și variantele ei" keytip="C"
            items={[{ label: 'Copiere', title: 'Copiere (Ctrl+C)', run: run('copy', focus) }, ...copyItems]} />
        ) : (
          <button className="rb-small" data-keytip="C" onMouseDown={(e) => e.preventDefault()} onClick={run('copy', focus)} title="Copiere (Ctrl+C)" aria-label="Copiere">
            <span className="rb-ico">⧉</span><span className="rb-txt rb-opt">Copiere</span>
          </button>
        )}
        {painter}
      </div>
      {children}
    </RGroup>
  );
}
