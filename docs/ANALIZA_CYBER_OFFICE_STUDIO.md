# Analiză: Cyber Office Studio (`Desktop\workspace\suite`) — reutilizare pentru K.G.B.

**Data:** 6 nov. 2026 · Analiză doar în citire (aprobare D-019). Niciun fișier nu a fost copiat.

## Ce este
Electron 33 + React 18 + TypeScript + Vite. ~766 fișiere / ~199k linii în `src/`.
Module: Sheets (~42.6k linii), Docs (~30.7k), PDF (~29.6k), Images, Slides, Notes, ERP „Suran” (stocuri, facturi, comenzi, casă/bancă, ~10.2k), Video.

## Stocare — conflicte cu D-005
- `.sdoc` / `.ssheet` = fișiere JSON (compatibile cu principiul K.G.B. de fișiere structurate).
- **ERP-ul folosește SQLite** (sql.js, `src/erp/db.ts`, `schema.ts`, SQL direct în pagini) → nu se poate prelua ca atare; logica trebuie mutată pe motorul K.G.B.
- `localStorage` în 49 de fișiere (mai ales preferințe UI), IndexedDB în versiunea web (`src/web/bridge.ts`).

## Candidați buni de reutilizare
1. Motorul de formule propriu `src/sheets/formula.ts` (+ pivot, solver, formate numerice) — TypeScript pur, testat fără UI.
2. Citire/scriere XLSX/ODS/CSV proprie (`src/sheets/xlsx.ts`, `ods.ts`, `csv.ts`) și modelul `.ssheet`.
3. Modelul de adaptor `src/api.ts` (tot accesul nativ trece printr-un singur obiect) → se poate înlocui cu comenzi Tauri.
4. Logica ERP pură (`src/erp/*Logic.ts`), e-Factura (`src/sheets/efacturaOut.ts`, `efacturaIn.ts`), validări CNP/CUI/IBAN (`src/sheets/ids.ts`).
5. Uneltele PDF pe pdf-lib/pdfjs și `src/docs/format.ts` (TipTap).

## Riscuri
- Fișiere monolitice (ex. `Sheets.tsx` 12.364 linii) — contrazic regula „fără fișiere monolitice”.
- Textele UI sunt în română direct în cod, iar traducerea se face printr-un observator DOM — nu se reutilizează.
- Licențe: `libheif-js` LGPL-3.0 (de evaluat), `jszip` dublă licență MIT/GPL (se alege MIT); SheetJS e luat de pe CDN, nu din npm.
- Teste: 629 de scripturi Node + ~1.900 de teste CDP; fără framework standard.
- Regula din `CLAUDE.md`-ul acelui proiect cere cod scris de la zero. Pentru K.G.B., preluarea codului propriu e permisă doar cu acordul tău (D-019), iar originea se consemnează în `LICENSES.md`.

## Când contează
Pentru Etapa 0 nu e nevoie de cod de aici. Devine relevant în Etapa 3 (foi de calcul, PDF) și Etapa 5 (stocuri, e-Factura).

## Comparație pe module cu K.G.B. (8 nov. 2026, doar citire)
| Modul | COS | K.G.B. | Verdict | Cum se preia |
|---|---|---|---|---|
| PDF | adnotări, formulare XFDF/FDF, redactare, OCR (tesseract.js, date incluse), semnare, PDF/A, filigran, antet/subsol, comprimare, n-up, comparare (~29,6k linii, 102 teste Node) | vizualizare, combinare/separare/extragere/rotire, versiuni | COS mult mai bun | unelte pure pdf-lib, una câte una; semnarea doar ca idee (certificatele Windows prin Electron); pdfjs 4 → 6 |
| Foi de calcul | motor propriu ~500 funcții, pivot, solver, formatare condițională, grafice SVG, citire/scriere XLSX/ODS/XLS/CSV (~42,6k linii, ~150 teste) | IronCalc (Rust), editare simplă, 5 modele | COS mai bun la interfață; K.G.B. la arhitectură | părți pure (grafice, pivot, completare, formate, sortare/filtrare); un singur motor de calcul |
| Documente | editor TipTap complet, DOCX import/export, ODT/RTF (~30,7k linii, 92 teste) | completare de modele DOCX, PDF Typst | se completează | editorul, salvat prin nucleu, legat de modelele {{câmpuri}} |
| Note | liste, Markdown, șabloane, criptare, importuri (~10,5k linii, 31 teste) | demonstrativ | COS mult mai bun | logica și interfața; o notă = o înregistrare |
| Imagini / Prezentări / Video | foarte complete | — | doar COS | mai târziu; `libheif-js` (LGPL-3.0) exclus; video cere ffmpeg extern |

**Riscuri:** fișiere monolitice (3,5k–12,4k linii) de împărțit; două motoare de calcul de evitat; React 18→19, pdfjs 4→6, TipTap 2; `jszip` cu alegerea licenței MIT; testele CDP legate de Electron se refac; textele UI în cod și traducerea prin observator DOM nu se preiau; `localStorage` (2–11 fișiere pe modul) mutat în setările K.G.B.
