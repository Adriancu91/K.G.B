// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Ce e nesalvat în fiecare aplicație, într-un singur loc. De aici vine întrebarea „Salvezi modificările?”:
// - la închiderea ferestrei Suite (procesul principal arată fereastra cu lista, vezi `will-prevent-unload` în main.cjs);
// (trecerea în altă aplicație nu mai pierde nimic: aplicațiile deschise rămân în memorie, ascunse; vezi App.tsx).
import { useEffect, useSyncExternalStore } from 'react';

export interface Unsaved {
  /** Ce se pierde, pentru mesaj: „Imagini („vacanță.jpg”)”. */
  what: string;
  /** Se pierde la trecerea în altă aplicație. */
  lostOnLeave: boolean;
}

const list = new Map<string, Unsaved>();
let version = 0;
const subs = new Set<() => void>();
/** Se schimbă la fiecare schimbare a listei (pentru punctul de pe tab). */
export function useUnsavedVersion() {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => version);
}

function notify() {
  const s = (window as unknown as { suite?: { setUnsaved?: (names: string[]) => void } }).suite;
  s?.setUnsaved?.([...list.values()].map((u) => u.what));
}

export function setUnsaved(id: string, u: Unsaved | null) {
  const before = list.get(id);
  if (u) list.set(id, u); else list.delete(id);
  if (before?.what !== u?.what) { notify(); version++; subs.forEach((f) => f()); }
}
export const unsavedOf = (id: string) => list.get(id) ?? null;
export const unsavedAll = () => [...list.values()];

/** „Docs („Raport.docx”)” sau doar „Docs” pentru un fișier nou. */
export const unsavedLabel = (app: string, file: string | null | undefined) => {
  const name = (file ?? '').split(/[\\/]/).pop();
  return name ? `${app} („${name}”)` : app;
};

/** Aplicația spune aici, la fiecare schimbare, ce are nesalvat (null = nimic). */
export function useUnsaved(id: string, what: string | null, lostOnLeave = false) {
  useEffect(() => { setUnsaved(id, what ? { what, lostOnLeave } : null); }, [id, what, lostOnLeave]);
  // Când aplicația se închide: dacă nu-și ține lucrul în memorie, s-a întrebat deja înainte, deci nu mai e nimic de salvat.
  useEffect(() => () => { if (list.get(id)?.lostOnLeave) setUnsaved(id, null); }, [id]);
}


// Închiderea ferestrei (sau reîncărcarea): cu ceva nesalvat, oprim închiderea; procesul principal întreabă.
window.addEventListener('beforeunload', (e) => {
  if (!list.size) return;
  e.preventDefault();
  e.returnValue = '';
});
