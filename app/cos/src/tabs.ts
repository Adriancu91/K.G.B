// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Ce arată bara de taburi pentru fiecare tab deschis: numele fișierului („Raport.docx”). Aplicația îl spune prin
// `useTabTitle`; bara îl citește prin `useTabTitles`. Tot aici: lucrul ținut minte al fiecărui tab (`keptStore`), uitat când tabul
// se închide „fără să salvez” (sau când se închide un tab în plus, de exemplu al doilea document Docs).
//
// Cheia unui tab: numele aplicației („doc”) pentru primul tab al ei, „doc:2”, „doc:3”… pentru celelalte (vezi App.tsx).
import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import type { OpenedFile } from './api';
import type { ModuleId } from './modules';

export interface TabFile { name: string; /** Calea întreagă, când aplicația o știe (pentru „e deja deschis” și refacerea taburilor). */ path: string }
const titles = new Map<string, TabFile>();
let snapshot: ReadonlyMap<string, TabFile> = new Map();
const subs = new Set<() => void>();
const changed = () => { snapshot = new Map(titles); subs.forEach((f) => f()); };

/** Numele fișierului deschis acum în tab (calea întreagă sau doar numele; null = niciun fișier). */
export function useTabTitle(tab: string, file: string | null | undefined) {
  const full = file ?? '';
  useEffect(() => {
    const name = full.split(/[\\/]/).pop() ?? '';
    const path = /[\\/]/.test(full) ? full : '';
    const old = titles.get(tab);
    if ((old?.name ?? '') === name && (old?.path ?? '') === path) return;
    if (name) titles.set(tab, { name, path }); else titles.delete(tab);
    changed();
  }, [tab, full]);
  useEffect(() => () => { if (titles.delete(tab)) changed(); }, [tab]);
}

/** Fișier adus prin import (.xlsx, .docx, .pptx…): numele lui pe tab și, la Salvează, același nume (fără extensie) în același dosar. */
const lastSep = (p: string) => Math.max(p.lastIndexOf('/'), p.lastIndexOf(String.fromCharCode(92)));
export const importedName = (p: string | null) => (p ? p.slice(lastSep(p) + 1) : '');
export function importedSave(p: string | null): { suggestedName?: string; suggestedDir?: string } {
  if (!p) return {};
  const file = importedName(p);
  const dot = file.lastIndexOf('.');
  const name = dot > 0 ? file.slice(0, dot) : file;
  const cut = lastSep(p);
  return { suggestedName: name || undefined, suggestedDir: cut > 0 ? p.slice(0, cut) : undefined };
}

/** Tabul în care e deschis acum fișierul cu calea asta (dacă e). */
export const tabWithFile = (path: string): string | null => {
  const p = path.toLowerCase();
  for (const [id, t] of titles) if (t.path && t.path.toLowerCase() === p) return id;
  return null;
};
export const tabTitleOf = (tab: string) => titles.get(tab) ?? null;

export function useTabTitles() {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => snapshot);
}

// Conținutul de acum al fiecărui tab (fișierul Suite, ca text), pentru „Compară” între două taburi alăturate.
const contents = new Map<string, () => string>();
/** Aplicația spune cum se ia conținutul ei de acum (aceeași formă ca la salvare). */
export function useTabContent(tab: string, get: () => string) {
  useEffect(() => { contents.set(tab, get); });
  useEffect(() => () => { contents.delete(tab); }, [tab]);
}
export const tabContent = (tab: string): string | null => { try { return contents.get(tab)?.() ?? null; } catch { return null; } };

// Textul unui tab care se citește în timp (PDF: textul paginilor), pentru „Compară”; celelalte aplicații dau conținutul de mai sus.
const texts = new Map<string, () => Promise<string>>();
export function useTabText(tab: string, get: () => Promise<string>) {
  useEffect(() => { texts.set(tab, get); });
  useEffect(() => () => { texts.delete(tab); }, [tab]);
}
export const tabText = async (tab: string): Promise<string | null> => {
  const f = texts.get(tab);
  if (!f) return tabContent(tab);
  try { return await f(); } catch { return null; }
};

// Lucrul ținut minte când aplicația se descarcă din memorie (documentul, tabelul), câte unul pe tab.
const forgotten = new Set<string>();
const stores: Map<string, unknown>[] = [];
export function keptStore<T>() {
  const m = new Map<string, T>();
  stores.push(m as Map<string, unknown>);
  return {
    get: (tab: string) => m.get(tab) ?? null,
    set: (tab: string, v: T) => { if (!forgotten.has(tab)) m.set(tab, v); },
    take: (tab: string) => { const v = m.get(tab) ?? null; m.delete(tab); return v; },
  };
}
/** Tab închis „fără să salvez” (sau tab în plus închis): lucrul lui se uită, iar ce mai scrie aplicația la închidere se ignoră. */
export const forgetTab = (tab: string) => { forgotten.add(tab); stores.forEach((s) => s.delete(tab)); };
/** Tabul se deschide din nou: poate ține minte iar. */
export const reviveTab = (tab: string) => { forgotten.delete(tab); };

// Deschide / Import dintr-o aplicație al cărei tab are deja un fișier (sau ceva scris): fișierul nou merge într-un tab nou de același fel
// (sau în tabul unde e deja deschis), nu peste cel de acum. App.tsx dă funcția; fără ea (teste), aplicația deschide la ea.
export const OpenInTab = createContext<((kind: ModuleId, file: OpenedFile) => void) | null>(null);
export const useOpenInTab = () => useContext(OpenInTab);

// Ce face un tab nou imediat ce pornește, cerut din lista ＋: „template” deschide fereastra de șabloane (Docs, Sheets, Slides),
// „blank” face un fișier gol acolo unde e nevoie de unul (PDF: o pagină A4 albă). Se ia o singură dată.
export type TabStart = 'template' | 'blank';
const starts = new Map<string, TabStart>();
export const askTabStart = (tab: string, what: TabStart) => { starts.set(tab, what); };
export const takeTabStart = (tab: string): TabStart | null => { const w = starts.get(tab) ?? null; starts.delete(tab); return w; };

// Celulele diferite găsite de „Compară” între două tabele alăturate: tab → foaie → celule („B3”), colorate în tabel
// cât timp cele două taburi stau alăturate.
const marks = new Map<string, ReadonlyMap<string, ReadonlySet<string>>>();
const markSubs = new Set<() => void>();
export const setTabMarks = (tab: string, m: ReadonlyMap<string, ReadonlySet<string>> | null) => {
  if (m) marks.set(tab, m);
  else if (!marks.delete(tab)) return;
  markSubs.forEach((fn) => fn());
};
export function useTabMarks(tab: string) {
  return useSyncExternalStore((fn) => { markSubs.add(fn); return () => { markSubs.delete(fn); }; }, () => marks.get(tab) ?? null);
}
