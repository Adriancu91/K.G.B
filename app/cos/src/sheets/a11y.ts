// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
/**
 * Verificarea accesibilității unui tabel (ca Verificare accesibilitate din aplicațiile mari): ce i-ar încurca pe cei care folosesc
 * un cititor de ecran sau văd mai greu.
 * - text greu de citit pe fundalul lui (contrast sub 4,5 : 1, sau sub 3 : 1 la textul mare);
 * - celule îmbinate (cititorul de ecran se pierde în rânduri și coloane);
 * - foi cu numele dat la pornire („Foaia 1”) și foi ascunse;
 * - grafice fără titlu;
 * - legături care arată doar adresa în loc de un text care spune unde duc.
 */
import { contrast } from '../docs/accessibility';
import type { Sheet } from './format';

export interface SheetIssue { sheet: number; cell?: string; text: string }
export const MAX_ISSUES = 200;

const short = (t: string) => { const s = t.replace(/\s+/g, ' ').trim(); return s.length > 30 ? s.slice(0, 29) + '…' : s; };
const DEFAULT_NAME = /^(Foaia|Sheet|Foaie)\s*\d+$/i;

export function checkSheets(sheets: Sheet[]): SheetIssue[] {
  const out: SheetIssue[] = [];
  const add = (x: SheetIssue) => { if (out.length < MAX_ISSUES) out.push(x); };
  sheets.forEach((s, si) => {
    if (DEFAULT_NAME.test(s.name.trim()) && sheets.some((o) => Object.keys(o.cells).length)) {
      add({ sheet: si, text: `Foaia are numele de la pornire („${s.name}”): dă-i un nume care spune ce conține (dublu clic pe filă).` });
    }
    if (s.hidden) add({ sheet: si, text: 'Foaie ascunsă: cine folosește un cititor de ecran poate să nu afle de ea. Afișeaz-o sau mută datele pe o foaie vizibilă.' });
    for (const m of s.merges ?? []) add({ sheet: si, cell: m.split(':')[0], text: `Celule îmbinate (${m}): cititoarele de ecran se încurcă în ele. Folosește „Centrare pe selecție” în loc de îmbinare.` });
    for (const ch of s.charts ?? []) {
      if (!ch.title?.trim()) add({ sheet: si, cell: ch.range.split(':')[0], text: `Grafic fără titlu (datele ${ch.range}): titlul e ce se aude despre grafic. Scrie un titlu.` });
    }
    const ids = Object.keys(s.styles).sort((a, b) => {
      const ra = Number(a.replace(/^[A-Z]+/, '')), rb = Number(b.replace(/^[A-Z]+/, ''));
      return ra - rb || a.length - b.length || a.localeCompare(b);
    });
    for (const id of ids) {
      const st = s.styles[id];
      const text = s.cells[id];
      if (!text?.trim()) continue;
      if (st.color || st.bg) {
        const fg = st.color ?? '#000000', bg = st.bg ?? '#ffffff';
        const big = (st.sz ?? 11) >= 18 || (st.b && (st.sz ?? 11) >= 14);
        const need = big ? 3 : 4.5;
        const k = contrast(fg, bg);
        if (k < need) add({ sheet: si, cell: id, text: `Text greu de citit („${short(text)}”): contrast ${k.toFixed(1).replace('.', ',')} : 1, ar trebui cel puțin ${String(need).replace('.', ',')} : 1. Alege o culoare a textului sau a fundalului mai închisă / mai deschisă.` });
      }
      if (st.link && /^(https?:\/\/|www\.|mailto:)/i.test(text.trim()) && text.trim().length > 25) {
        add({ sheet: si, cell: id, text: `Legătura arată doar adresa („${short(text)}”): scrie în celulă un text care spune unde duce (de exemplu „Pagina firmei”).` });
      }
    }
  });
  return out;
}
