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
- Ștampila editabilă (7.4l-0a, D-078): `src/pdf/{sign,stampAnnot,Marks,Guides,erase,calc,barcodeField,stampBg}.ts(x)`
  și `src/qr.ts`, neschimbate. `src/pdf/edit.ts` e cel scurt din K.G.B. (doar deschiderea cu pdf-lib), iar `src/pdf/marks.css` conține doar
  regulile stratului de ștampile din `pdf.css`. Testele `pdf-stamp` și `pdf-stampline` trec neschimbate.
  K.G.B. le folosește în `app/src/modules/pdf/StampEdit.tsx`.
- `hooks.mjs` găsește pachetele (pdf-lib…) din `app/node_modules` și când fișierul de intrare al testului stă în `%TEMP%`.
  Shim-ul creează dosarul fișierului de ieșire (de ex. `node_modules/.cache`).
- Editarea textului la clic (7.4l-0b, D-078): `src/pdf/{TextEdit.tsx,paragraphs,replaceText,textRemove,find}.ts`, neschimbate,
  cu `src/pdf/textedit.css` (regulile `.pdf-textedit` din `pdf.css`). Testele `pdf-paragraph-edit` și `pdf-replacetext` trec
  neschimbate (`hooks.mjs` leagă `node_modules/pdfjs-dist` de aici de pachetul aplicației, pentru fonturile citite după cale).
  K.G.B. are pdf.js 6, fără `convertToViewportRectangle`: `app/src/modules/pdf/pdfjs.ts` (`viewportCompat`) o pune înapoi.
  K.G.B. le folosește în `app/src/modules/pdf/TextEditPage.tsx`.
