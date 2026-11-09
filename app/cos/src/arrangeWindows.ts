// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Vizualizare → Fereastră → 🗗 Aranjează toate (Docs, Sheets, Slides): ferestrele Cyber Office Studio așezate pe ecran.
// O fereastră nouă se face din clic dreapta pe tab → ⧉ Mută în fereastră nouă.
import { api } from './api';
import type { RMenuItem } from './ribbon/Ribbon';

type Mode = 'tile' | 'vertical' | 'horizontal' | 'cascade';

async function arrange(mode: Mode) {
  const n = await api.arrangeWindows!(mode);
  if (n < 2) alert('E deschisă o singură fereastră. Ca să ai mai multe: clic dreapta pe un tab → ⧉ Mută în fereastră nouă, apoi aranjează-le.');
}

export const canArrange = () => !!api.arrangeWindows;

export const ARRANGE_TITLE = 'Aranjează toate ferestrele programului pe ecran: în grilă, alăturate, una sub alta sau în cascadă (o fereastră nouă: clic dreapta pe tab → ⧉ Mută în fereastră nouă)';

export const arrangeItems = (): RMenuItem[] => [
  { label: '▦ În grilă', title: 'Toate ferestrele împart ecranul în părți egale', run: () => void arrange('tile') },
  { label: '◫ Alăturate', title: 'Ferestrele una lângă alta, de la stânga la dreapta', run: () => void arrange('vertical') },
  { label: '⊟ Una sub alta', title: 'Ferestrele una sub alta, fiecare pe toată lățimea ecranului', run: () => void arrange('horizontal') },
  { label: '🗗 Cascadă', title: 'Ferestrele în trepte, una peste alta, cu titlurile vizibile', run: () => void arrange('cascade') },
];
