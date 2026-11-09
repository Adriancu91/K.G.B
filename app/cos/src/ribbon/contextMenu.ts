// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Clic dreapta cu comenzile potrivite locului (INTERFATA.md): text, tabel, imagine, celulă, slide, strat, clip.
// Meniul e cel al sistemului (ca sugestiile de ortografie să rămână sus): la `contextmenu` interfața trimite sincron
// lista de comenzi, procesul principal o pune în meniu (electron/ctxmenu.cjs) și trimite înapoi ce s-a ales.
// Comenzile au aceleași nume ca în panglică; multe doar apasă butonul din panglică (`ribbonClick`), deci nu se dublează codul.
import { useEffect, useRef } from 'react';
import { api } from '../api';
import { revealInRibbon } from './Ribbon';

export interface CtxItem {
  label: string;
  run?(): void;
  enabled?: boolean;
  checked?: boolean;
  sep?: boolean;
  submenu?: CtxItem[];
}
interface Sent { id?: string; label?: string; enabled?: boolean; checked?: boolean; sep?: boolean; submenu?: Sent[] }

let handlers = new Map<string, () => void>();
let lastSent: Sent[] = [];
let listening = false;

function serialize(items: CtxItem[], out: Map<string, () => void>): Sent[] {
  return items.map((it) => {
    if (it.sep) return { sep: true };
    if (it.submenu) return { label: it.label, submenu: serialize(it.submenu, out) };
    const id = 'c' + out.size;
    if (it.run) out.set(id, it.run);
    return { id, label: it.label, enabled: it.enabled !== false && !!it.run, checked: it.checked };
  });
}

function listen() {
  if (listening) return;
  listening = true;
  api.onContextCommand?.((id) => handlers.get(id)?.());
}

/** Comenzile modulului la clic dreapta în `target`; `items(e)` le alege după locul clicului. */
export function useContextMenu(target: HTMLElement | null, items: (e: MouseEvent) => CtxItem[]) {
  const ref = useRef(items);
  ref.current = items;
  useEffect(() => {
    if (!target) return;
    listen();
    const onCtx = (e: MouseEvent) => {
      const map = new Map<string, () => void>();
      let list: CtxItem[] = [];
      try { list = ref.current(e); } catch { list = []; }
      lastSent = serialize(list, map);
      handlers = map;
      try { api.setContextItems?.(lastSent); } catch { /* fără Electron: rămâne meniul obișnuit */ }
    };
    target.addEventListener('contextmenu', onCtx);
    return () => target.removeEventListener('contextmenu', onCtx);
  }, [target]);
}

/** Apasă butonul din panglica acestui modul care are titlul începând cu `title` (deschide întâi fila lui); `tab`: doar pe fila aceea. */
export function ribbonClick(from: Element, title: string, tab?: string): boolean {
  const pane = from.closest('.module-pane') ?? document;
  const b = [...pane.querySelectorAll<HTMLElement>(tab ? `.ribbon-panel[data-tab="${tab}"] button` : '.ribbon button')].find((x) => x.title.startsWith(title));
  if (!b) return false;
  revealInRibbon(b);
  b.click();
  return true;
}

// Ajutor pentru teste: ultimul meniu trimis și alegerea unei comenzi după nume (fără să apară meniul pe ecran).
declare global { interface Window { __suiteCtx?: unknown } }
window.__suiteCtx = {
  items: () => lastSent,
  labels: () => {
    const walk = (l: Sent[]): string[] => l.flatMap((x) => (x.sep ? ['—'] : x.submenu ? [x.label + ' ▸', ...walk(x.submenu).map((y) => '  ' + y)] : [x.label + (x.enabled === false ? ' (oprit)' : '')]));
    return walk(lastSent);
  },
  run: (label: string) => {
    const find = (l: Sent[]): Sent | undefined => { for (const x of l) { if (x.label === label && x.id) return x; const s = x.submenu && find(x.submenu); if (s) return s; } return undefined; };
    const it = find(lastSent);
    const h = it?.id ? handlers.get(it.id) : undefined;
    if (h) h();
    return !!h;
  },
};
