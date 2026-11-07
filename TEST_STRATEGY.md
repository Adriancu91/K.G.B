# K.G.B. — Strategia de testare

**Statut:** CIORNĂ pentru Etapa 0. Sursa: Master Plan §9.4, §14 și Metaprompt §11.

## Reguli generale
- Nu se raportează rezultate pentru teste nerulate.
- După fiecare schimbare relevantă: formatter/linter → typecheck → teste unitare → teste de integrare → build.
- Datele reale ale firmei se folosesc doar ca copii anonimizate, cu aprobare.

## Spike S1 — stocare
| Test | Ce dovedește |
|---|---|
| Volum 10k / 100k / 1M înregistrări | Timp scriere, citire, căutare, filtrare, reconstruire index, spațiu pe disc |
| Oprire forțată aleatoare în timpul scrierii (≥1.000 de repetări) | Nicio tranzacție confirmată pierdută; scrierea incompletă e detectată |
| Octeți corupți în jurnal/snapshot | Detectare prin checksum, carantină, fără ștergere automată |
| Index șters sau deteriorat | Reconstruire completă din sursa autoritativă |
| Două procese pe același spațiu de lucru | Al doilea e refuzat clar; fără corupere |
| Două scrieri concurente pe același obiect | Conflict de versiune detectat, fără suprascriere oarbă |
| Două copii modificate offline și sincronizate | Merge determinist; conflictul ambiguu ajunge la utilizator |
| Backup și restaurare | Restaurarea e verificată, nu doar backup-ul creat |

## Spike S2 — rețea
2 procese pe același PC → 2 PC-uri în LAN → 2 PC-uri prin internet (unul pe hotspot) → relay oprit → sleep/resume → invitație expirată/refolosită → dispozitiv revocat.

## Spike S3 — Tauri
Build reușit, mărime installer, timp de pornire, consum RAM, apel UI → Rust → stocare.

Pragurile de performanță sunt PROPUSE în ETAPA0_PLAN.md §3.2 și devin oficiale doar după aprobare.

## Etapa 1 — nucleul desktop
- `cargo test --workspace`: teste unitare și de integrare pentru stocare, loguri, workspace, setări, identitate, manifest, module, permisiuni, profiluri și modulul demonstrativ. Rulează în CI.
- `node app/e2e/gate.mjs <kgb-app.exe> <folder-capturi>`: scenariul porții în fereastra reală, prin portul de depanare WebView2 (doar `127.0.0.1`). Folosește un folder de date temporar (`KGB_DATA_DIR`), nu datele reale. Rulează local; nu rulează încă în CI.

## Etapa 2 — motorul de stocare
- `cargo test --workspace`: format v1/v2, interogări (aleatoare, comparate cu decodarea completă), compactare incrementală, scheme, indexuri, fișiere, backup/restaurare.
- `target/release/crashtest.exe run <dir> <n> [compact]`: opriri forțate, opțional cu compactare în timpul scrierilor.
- `target/release/bench.exe <dir> <n>`: măsurători; rezultatele sunt în `docs/etapa2/BENCH.md`.
- `node app/e2e/backup.mjs <kgb-app.exe> <folder-capturi>`: backup → modificare → verificare → restaurare ca spațiu nou → redeschiderea originalului.

## Etapa 3 — documente și foi de calcul
- Setul de fișiere de test este `testdata/etapa3/` (vezi `README.md` de acolo):
  - fișierele sunt generate doar cu biblioteca standard Python și cu Edge, deci nu de bibliotecile evaluate;
  - pentru fiecare fișier, `MANIFEST.json` notează hash-ul SHA-256 și ce trebuie să conțină (pagini, text, celule, formule) sau că trebuie refuzat.
- `python testdata/etapa3/generate.py --check`: verifică că fișierele nu s-au schimbat.
- `powershell -File testdata/etapa3/validate-windows-pdf.ps1`: verificare independentă cu cititorul PDF din Windows.
- Regula de necorupere pentru orice operație: originalul rămâne identic (același hash), rezultatul se redeschide și păstrează paginile, textul și valorile din manifest.
- `cargo test -p kgb-core --test documents` (pasul 3.4) verifică documentele versionate:
  - originalul rămâne identic după salvări și restaurări;
  - salvarea pe o versiune veche e refuzată;
  - documentele sunt izolate între module;
  - conținutul versiunilor e protejat de colectare;
  - exportul scrie o copie fără să înlocuiască fișiere existente;
  - conținutul alterat e detectat;
  - **25 de opriri forțate ale unui proces care salvează continuu**: nicio versiune pe jumătate, originalul neatins.
- `cargo test -p kgb-pdf` (pasul 3.5) rulează pe setul de test:
  - clasificarea fiecărui fișier: intact, deteriorat sau „nu e PDF”, cu originalul stocat octet cu octet;
  - PDF-urile deteriorate sunt doar pentru citire;
  - rotire, scoatere, extragere și unire, cu previzualizare, versiune nouă și verificarea textului pe fiecare pagină;
  - miniaturi, restaurare, export;
  - argumente greșite refuzate.
- `node app/e2e/pdf.mjs <kgb-app.exe> <folder-capturi>`: modulul PDF în fereastra reală (20 de verificări).
  - Testul nu poate acționa dialogul de fișiere al sistemului. Apelează aceeași comandă (`module_import_file`) care primește rezultatul dialogului.
