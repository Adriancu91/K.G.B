# Cod preluat din Cyber Office Studio (D-071)

Cyber Office Studio (COS) e aplicația proprietarului; codul ei se preia direct în K.G.B. Aici stă, **neschimbat** și în
aceeași structură de foldere ca în COS (`src/notes/…`, `src/docs/…`, `src/sheets/…`), împreună cu testele lui
(`tests/`, tot neschimbate), ca importurile dintre fișiere și căile din teste să rămână ca în original.

- Fiecare fișier copiat începe cu o notă și `// @ts-nocheck`: K.G.B. verifică tablourile mai strict
  (`noUncheckedIndexedAccess`) decât COS; corectitudinea e dată de testele lui.
- Testele COS își împachetau codul cu esbuild, care nu e în K.G.B. `hooks.mjs` le rulează așa cum sunt:
  `esbuild` → `esbuild-shim.mjs` (scrie un fișier care reexportă sursa), TypeScript → JavaScript cu oxc
  (din rolldown, deja în aplicație prin vite), căile Windows absolute și fișierele `.svg` se încarcă.
- Rulare (în `app/cos/`): `node --import ./hooks.mjs tests/notes-pages.test.mjs`
- Singura schimbare într-un test: `notes-organize` compară și cu `electron/main.cjs` din COS, care aici nu există;
  partea aceea rulează doar dacă fișierul e de față (memento-urile notelor se fac în nucleul K.G.B.).
- Uneltele PDF copiate mai înainte stau în `app/src/modules/pdf/` (7.4l-1b…1e), cu testele în `app/tests/`.
