# K.G.B. — Arhitectură tehnică

**Statut:** CIORNĂ. Se completează pe baza rezultatelor spike-urilor din Etapa 0. Până atunci, arhitectura logică este cea din Master Plan §4.

## Principii obligatorii (rezumat)
- Local-first, offline-first, fără server central de date (D-003, D-004).
- Fără motor de baze de date (D-005, D-018); stocare proprie din jurnal, snapshot-uri, indexuri regenerabile (D-006).
- Sincronizarea este protocol de aplicație prin schimb de evenimente; fișierele interne de stocare nu se partajează (Master Plan §9.5).
- Fără criptografie proprie (Master Plan §10).

## Secțiuni de completat după spike-uri
1. Storage Engine — format jurnal, snapshot, index, recovery, concurență (după S1)
2. Network & Sync — transport, identitate, pairing, relay (după S2)
3. Desktop shell — Tauri/React, granița UI ↔ Rust (după S3)
4. Module Manager și contractul modulelor (Etapa 1)

## Implementat în Etapa 1
- `crates/kgb-store` — stocarea (S1). `crates/kgb-core` — workspace, setări, identitate, module, permisiuni, profiluri, loguri. `modules/kgb-notes` — modulul demonstrativ. `app/` — Tauri: un strat subțire de comenzi peste `kgb-core` și interfața React.
- Interfața nu atinge fișierele. Fiecare acțiune e o comandă Rust care trece prin nucleu. Modulele ajung la date doar prin `ModuleContext` (vezi `MODULE_CONTRACT.md`).
- Date: `%LOCALAPPDATA%\ro.kronos.kgb\` (`device/`, `logs/`, `workspaces/<id>/`, `workspaces.json`).

## Adăugat în Etapele 2–3
- **`kgb-core::files`:** fișiere atașate pentru module (`core.files`, blob-uri BLAKE3).
- **`kgb-core::backup`:** backup și restaurare (`<rădăcină>/backups/`).
- **`kgb-core::schema`:** scheme și indexuri declarate în manifest.
- **`kgb-core::documents`** (Etapa 3, D-034): documente versionate.
  - Fiecare document are o înregistrare în `core.documents`, iar fiecare versiune una în `core.document_versions`. Id-ul versiunii e derivat din document și număr, deci o versiune nu poate fi scrisă de două ori.
  - Conținutul stă în blob-uri BLAKE3. Versiunile vechi și originalul nu se modifică niciodată.
- **Biblioteci pentru documente** (alese prin spike-urile S4/S5, D-032/D-033):
  - PDF: lopdf (operații), pdf.js (afișare), hayro (miniaturi), plus o verificare strictă proprie;
  - foi de calcul: calamine (citire), umya (salvare, cu comparație înainte/după), IronCalc (formule), rust_xlsxwriter (export), plus o protecție proprie anti-„bombă zip”.
- **Modulul `modules/kgb-pdf`** (`kgb.pdf`, beta):
  - logica: verificare strictă, operații, verificarea rezultatului;
  - interfața: `app/src/modules/pdf/` (pdf.js);
  - fișierele intră prin comanda aplicației `module_import_file` (dialogul sistemului) și ies prin export în calea aleasă.
  - Politica de securitate a ferestrei permite acum `worker-src 'self'` (lucrătorul pdf.js) și `wasm-unsafe-eval` (decodoarele de imagini din pdf.js). `eval` rămâne interzis.
- **Modulul `modules/kgb-sheets`** (`kgb.sheets`, beta):
  - logica:
    - `book.rs`: citire, verificarea anti-bombă, CSV;
    - `save.rs`: editare cu umya, recalculare IronCalc (D-039), verificarea rezultatului, lista pierderilor;
  - interfața: `app/src/modules/sheets/`, un tabel care încarcă doar rândurile de pe ecran;
  - modulul ține în memorie ultimul registru citit, ca derularea să nu recitească fișierul;
  - IronCalc rulează pe un fir separat, cu limită de 30 s și protecție la panică.
- **Modulul `modules/kgb-extract`** (`kgb.extract`, beta): extragere de date (D-040).
  - `fields.rs` găsește câmpurile după etichetă și le verifică independent: total fără TVA + TVA = total, cifra de control a CUI, data din calendar.
  - Modulul are colecțiile proprii `facturi` și `jurnal`, cu scheme.
  - Folosește ca biblioteci funcțiile pure de citire din `kgb-pdf` și `kgb-sheets`, fără să le vadă datele.

## Adăugat în Etapa 4
- **Modulul `modules/kgb-planner`** (`kgb.planner`, beta):
  - colecțiile `persoane`, `proiecte` și `taskuri`, cu scheme;
  - indexuri pe stare, responsabil și proiect;
  - datele calendaristice (`dates.rs`) fără fus orar: termenul e o zi, nu un moment.
  - „Azi” vine din calculatorul utilizatorului, ca parametru.
  - Interfața: `app/src/modules/planner/`.
