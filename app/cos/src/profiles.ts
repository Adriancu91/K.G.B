// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Profilurile de meniu (PLAN, „Finalul cerut” a2): aceleași comenzi, așezate altfel. Un profil nu adaugă și nu scoate butoane:
// folosește aceleași file ale panglicii (deci aceleași acțiuni și aceleași scurtături), doar le pune în alt loc pe ecran.
// Alegerea se ține minte pentru fiecare aplicație, în setări („profiles”: { pdf: 'airy' }), și se schimbă din butonul
// mic din colțul ferestrei sau din ☰ Meniu / Fișier.
import { useEffect, useState } from 'react';
import { api } from './api';

export interface Profile { id: string; label: string; title: string }

/** Profilurile comune ale aplicațiilor cu panglică (Sheets, Docs, Slides, Notițe): aceleași file, ca panglică, ca meniuri de sus sau aerisite. */
function OFFICE(of: string, what: string): Profile[] {
  return [
    { id: 'ribbon', label: 'Panglică', title: `File cu butoane mari, grupate pe teme, deasupra ${of} (așezarea implicită)` },
    { id: 'menus', label: 'Meniuri clasice', title: `Un rând subțire de meniuri (Fișier, Pornire, Inserare…); fiecare se deschide ca listă, cu scurtăturile scrise în dreapta, iar ${what} are mai mult loc` },
    { id: 'airy', label: 'Aerisit', title: `Sus meniurile și o singură bară subțire cu butoanele folosite des (Pornire); comenzile rare stau în meniuri, iar Ctrl+F1 ascunde bara, ca ${what} să aibă tot locul` },
    { id: 'simple', label: 'Simplu', title: `Câteva moduri de lucru în loc de file (Scrie, Inserează…); se vede doar bara subțire a modului ales, iar celelalte file stau în „Mai mult”` },
  ];
}

/** Modurile de lucru ale profilului „Simplu”: fila pe care o arată fiecare (aceleași butoane) și numele lui scurt. */
export const SIMPLE_MODES: Record<string, { id: string; label: string; title: string }[]> = {
  sheets: [
    { id: 'home', label: 'Scrie', title: 'Scrie și formatează celulele (fila Pornire)' },
    { id: 'insert', label: 'Inserează', title: 'Tabele, diagrame, poze, legături (fila Inserare)' },
    { id: 'formulas', label: 'Calculează', title: 'Funcții și formule (fila Formule)' },
    { id: 'data', label: 'Date', title: 'Sortare, filtre, importuri (fila Date)' },
    { id: 'view', label: 'Vezi', title: 'Zoom, înghețare, linii de grilă (fila Vizualizare)' },
  ],
  docs: [
    { id: 'home', label: 'Scrie', title: 'Scrie și formatează textul (fila Pornire)' },
    { id: 'insert', label: 'Inserează', title: 'Tabele, poze, legături, antet și subsol (fila Inserare)' },
    { id: 'layout', label: 'Pagina', title: 'Margini, orientare, coloane (fila Aspect)' },
    { id: 'review', label: 'Revizuiește', title: 'Ortografie, comentarii, urmărirea modificărilor (fila Revizuire)' },
  ],
  slides: [
    { id: 'home', label: 'Scrie', title: 'Diapozitive noi, text și formatare (fila Pornire)' },
    { id: 'insert', label: 'Inserează', title: 'Poze, forme, tabele, video (fila Inserare)' },
    { id: 'design', label: 'Aspect', title: 'Teme, culori, fundal (fila Proiectare)' },
    { id: 'show', label: 'Prezintă', title: 'Pornește expunerea și pregătește-o (fila Expunere diapozitive)' },
  ],
  notes: [
    { id: 'home', label: 'Scrie', title: 'Scrie și formatează notița (fila Pornire)' },
    { id: 'insert', label: 'Inserează', title: 'Tabele, poze, fișiere (fila Inserare)' },
    { id: 'draw', label: 'Desenează', title: 'Stilouri, forme, radieră (fila Desenare)' },
  ],
};

/** Profilurile fiecărei aplicații; primul e cel implicit (așezarea de până acum). */
export const PROFILES: Record<string, Profile[]> = {
  pdf: [
    { id: 'tools', label: 'Unelte în stânga', title: 'Bara globală sus, panoul cu toate uneltele în stânga, miniaturile și panourile în dreapta (așezarea implicită)' },
    { id: 'airy', label: 'Aerisit', title: 'Miniaturile în stânga, uneltele folosite des sus, restul în panoul „Avansat” din dreapta; fiecare bară se poate ascunde, iar Ctrl+H lasă doar pagina' },
    { id: 'side', label: 'Panouri laterale', title: 'O coloană cu sarcinile în stânga (Editează, Comentează, Semnează, Pagini…); uneltele sarcinii alese se deschid lângă ea' },
    { id: 'simple', label: 'Simplu', title: 'O bară subțire cu modurile de lucru Citește, Adnotează, Editează, Semnează și Pagini; se văd doar uneltele modului ales' },
  ],
  sheets: OFFICE('tabelului', 'tabelul'),
  docs: OFFICE('documentului', 'documentul'),
  slides: OFFICE('prezentării', 'diapozitivul'),
  notes: OFFICE('paginii', 'pagina'),
};

const chosen: Record<string, string> = {};
let loaded: Promise<void> | null = null;
const EVT = 'suite-profile';

/** Profilul ales pentru aplicație (cel implicit până se citesc setările) și funcția care îl schimbă (în toate taburile ei). */
export function useProfile(module: string): [string, (id: string) => void] {
  const list = PROFILES[module] ?? [];
  const def = list[0]?.id ?? '';
  const valid = (id: string | undefined) => (id && list.some((p) => p.id === id) ? id : def);
  const [cur, setCur] = useState(valid(chosen[module]));
  useEffect(() => {
    loaded ??= api.getSettings().then((s) => { Object.assign(chosen, s.profiles ?? {}); }).catch(() => {});
    let live = true;
    void loaded.then(() => { if (live) setCur(valid(chosen[module])); });
    const on = (e: Event) => { const d = (e as CustomEvent<{ module: string; id: string }>).detail; if (d.module === module) setCur(valid(d.id)); };
    window.addEventListener(EVT, on);
    return () => { live = false; window.removeEventListener(EVT, on); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module]);
  const set = (id: string) => {
    chosen[module] = id;
    void api.setSettings({ profiles: { ...chosen } }).catch(() => {});
    window.dispatchEvent(new CustomEvent(EVT, { detail: { module, id } }));
  };
  return [cur, set];
}

