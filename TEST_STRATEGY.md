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
