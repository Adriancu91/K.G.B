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
