// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Tabul care se vede acum. Aplicațiile deschise rămân în memorie când treci în alta (doar ascunse), deci
// scurtăturile lor (pe window) trebuie să lucreze doar când sunt în față: fiecare verifică `isCurrent(tab)`.
// Cheia tabului e numele aplicației („doc”) sau, pentru al doilea document din aceeași aplicație, „doc:2” (vezi App.tsx);
// aplicația își află cheia cu `useTabKey('doc')`.
import { createContext, useContext, useSyncExternalStore } from 'react';
import type { ModuleId } from './modules';

let current = 'home';
const subs = new Set<() => void>();

export function setCurrentModule(id: string) {
  if (current === id) return;
  current = id;
  subs.forEach((f) => f());
}
export const currentModule = () => current;
export const isCurrent = (id: string) => current === id;

/** true cât timp aplicația e în față (de exemplu, Video oprește redarea când treci în altă aplicație). */
export function useIsCurrent(id: string) {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => current === id);
}

export const TabKey = createContext('');
/** Cheia tabului în care rulează aplicația („doc”, „doc:2”…). */
export const useTabKey = (kind: ModuleId) => useContext(TabKey) || kind;
/** Aplicația unui tab: „doc:2” → „doc”. */
export const kindOf = (tab: string) => tab.split(':')[0] as ModuleId;
