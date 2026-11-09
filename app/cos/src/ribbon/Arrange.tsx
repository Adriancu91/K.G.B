// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Butonul mic ▦ (Aranjare) din colțul ferestrei: alege profilul de meniu al aplicației (profiles.ts).
// Sheets, Docs, Slides și Notițe au „Panglică” (implicit), „Meniuri clasice” (panglica în modul „menus”), „Aerisit” („airy”) și „Simplu” („simple”).
import type { ReactNode } from 'react';
import { RMenu } from './Ribbon';
import { PROFILES, useProfile } from '../profiles';
import { useCommands } from '../commands';
import { useTabKey } from '../active';
import type { ModuleId } from '../modules';

/** Profilul ales, așezarea panglicii care îi corespunde și butonul ▦ de pus în dreapta rândului de file.
 *  `tabKind`: felul tabului aplicației („doc” pentru Docs), ca alegerile să apară și în „Caută o comandă”. */
export function useArrange(module: string, tabKind: ModuleId): { profile: string; layout: 'menus' | 'airy' | 'simple' | undefined; menu: ReactNode } {
  const [profile, setProfile] = useProfile(module);
  const list = PROFILES[module] ?? [];
  // Aceleași alegeri în „Caută o comandă” (Alt+Q): „Aranjare: Meniuri clasice”.
  useCommands(useTabKey(tabKind), list.map((p) => ({ label: 'Aranjare: ' + p.label, hint: p.title, when: () => p.id !== profile, run: () => setProfile(p.id) })), 'arrange');
  const menu = (
    <RMenu label="▦" ariaLabel="Aranjare" title="Aranjare: aceleași comenzi, așezate altfel pe ecran (se ține minte)"
      items={list.map((p) => ({ label: p.label, title: p.title, checked: p.id === profile, run: () => setProfile(p.id) }))} />
  );
  return { profile, layout: profile === 'menus' || profile === 'airy' || profile === 'simple' ? profile : undefined, menu };
}
