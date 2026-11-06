# K.G.B. — Planul Etapei 1: Nucleul desktop

**Data:** 6 nov. 2026 · **Statut:** ÎN LUCRU. Etapa a fost aprobată de proprietar (D-022). Deciziile D-023…D-026 sunt PROPUSE.
**Sursa:** Master Plan §4, §5, §7, §10, §12.1, §13 (Etapa 1) și Metaprompt §6 (Faza C), §9, §10, §11, §13.

## Ce cere Master Plan-ul
Shell, navigare, workspace, module manager, setări, identitate locală, permission framework, logging și diagnosticare.

**Poarta Etapei 1:** aplicația pornește, salvează configurarea, activează/dezactivează un modul demonstrativ și nu pierde datele acestuia.

## Ce NU intră în Etapa 1
- Rețea, sincronizare, pairing, roluri pentru alți utilizatori: Etapa 6.
- Formatul definitiv al stocării (binar, compactare incrementală, ținta de filtrare fără index): Etapa 2.
- Module reale (documente, taskuri, business): Etapele 3–5. În catalog apar doar ca „Neimplementat — Etapa N”.
- Semnarea codului: o pregătește proprietarul prin firmă. Installerul Etapei 1 rămâne nesemnat și marcat ca atare.

## Structura propusă (D-023)
```
Cargo.toml            workspace Rust
crates/kgb-store      motorul de stocare (preluat din spike-ul S1; se întărește în Etapa 2)
crates/kgb-core       servicii de nucleu, fără UI: workspace, setări, identitate, module, permisiuni, loguri
app/                  aplicația desktop Tauri 2 + React/TS (strat subțire peste kgb-core)
spikes/               rămân neschimbate, ca dovezi ale Etapei 0
```
De ce așa: logica nucleului se testează fără fereastră, iar interfața nu atinge direct fișierele (Master Plan §4.1).

## Pași
| Pas | Ce | Criteriu de acceptare |
|---|---|---|
| 1.1 | Workspace Cargo + CI (build, teste, clippy, cargo-deny) pentru codul de produs | CI verde pe Windows; spike-urile nu sunt afectate |
| 1.2 | `kgb-store` preluat din S1, cu proveniența notată | Cele 20 de teste S1 trec în noul crate |
| 1.3 | Loguri și diagnosticare: fișiere JSON-lines rotite (5 × 2 MB), fără conținut sensibil, panică prinsă și logată, raport de diagnostic exportabil | Teste: rotație, redactare, panică logată; raportul nu conține date de utilizator |
| 1.4 | Workspace: folder în `%LOCALAPPDATA%\ro.kronos.kgb\workspaces\<id>`, manifest `workspace.json` versionat, o singură instanță, refuz pentru foldere de cloud | Teste: creare, redeschidere, a doua instanță refuzată, manifest corupt → eroare clară fără ștergere |
| 1.5 | Setări tipizate și versionate (temă, densitate, limbă, profil de lucru), validate, salvate prin `kgb-store` | Teste: valori invalide refuzate, migrarea versiunii, persistență după oprire forțată |
| 1.6 | Identitate locală: profilul proprietarului + identitatea dispozitivului (cheie Ed25519 generată local, protejată cu Windows DPAPI) | Teste: cheia se creează o singură dată și supraviețuiește repornirii; fișierul cheii nu e lizibil fără DPAPI; nicio cheie în installer |
| 1.7 | Module manager + contract: manifest JSON validat, compatibilitate cu versiunea nucleului, stări `stable/beta/experimental/disabled`, activare/dezactivare persistentă | Teste: manifest invalid refuzat; dezactivarea nu șterge datele; modulul experimental nu apare ca funcțional |
| 1.8 | Permission framework: permisiunile declarate în manifest, acordate la activare, verificate la fiecare apel; refuzurile intră în jurnalul de audit | Teste: apel fără permisiune → refuzat și auditat; un modul nu poate citi colecțiile altui modul |
| 1.9 | Modul demonstrativ „Note” construit doar prin contract (UI separat de logică) | Teste unitare + integrare prin contract |
| 1.10 | Shell UI: navigare, catalog de module, bară de stare (stocare, offline), setări, diagnostic, panouri redimensionabile cu layout salvat, comenzi rapide, confirmare la operații destructive | Typecheck strict, build; verificare manuală pe laptop |
| 1.11 | Installer NSIS: versiune, upgrade peste versiunea veche, dezinstalare cu opțiunea de a păstra datele | Instalare, upgrade și dezinstalare testate pe laptop |
| 1.12 | Demonstrația porții: pornire, salvare configurare, activare/dezactivare „Note”, date păstrate după dezactivare, repornire și oprire forțată | Scenariu rulat și documentat în `docs/ETAPA1_RAPORT.md` |
| 1.13 | 🔒 Poarta Etapei 1: aprobarea proprietarului | — |

## Decizii propuse
| ID | Decizie | Alternative | Recomandare |
|---|---|---|---|
| D-023 | Structura codului de produs (de mai sus) | (a) un singur crate în aplicație; (b) crate-uri separate | (b): testabil fără UI, granițe clare |
| D-024 | Modulele din Etapele 1–5 sunt **incluse în aplicație** (compilate odată cu ea) și declarate prin manifest | (a) pluginuri DLL încărcate dinamic; (b) WebAssembly; (c) incluse în aplicație | (c): fără cod străin încărcat la rulare, mai sigur; pluginurile terților se reevaluează la Etapa 9 |
| D-025 | Cheia dispozitivului: Ed25519 (`ed25519-dalek`), protejată cu Windows DPAPI pe utilizator | (a) fișier simplu; (b) Windows Credential Manager; (c) DPAPI | (c): criptografie standard a sistemului, fără cod propriu; aceeași cheie poate servi rețelei iroh în Etapa 6 |
| D-026 | Logurile: `tracing` + scriere proprie în fișiere rotite | (a) `tracing-appender`; (b) scriere proprie mică | (b): rotație pe mărime, control total asupra redactării |

## Dependențe noi propuse (licențe verificate de `cargo-deny`)
`tracing`, `tracing-subscriber` (MIT), `ed25519-dalek` (BSD-3-Clause), `semver` (MIT/Apache-2.0), `windows-sys` cu DPAPI (MIT/Apache-2.0). Plus cele deja aprobate: `tauri`, `serde`, `uuid`, `blake3`.

## Riscuri
- **Interfața e greu de testat automat** pe Windows: testarea end-to-end cere `tauri-driver` + `msedgedriver`, unelte externe care trebuie aprobate. Până atunci, logica stă în `kgb-core` (testată automat), iar UI-ul se verifică manual.
- **Scope:** panourile mutabile cu drag-and-drop și profilurile complete pot crește mult. În Etapa 1 intră doar panourile redimensionabile, cu layout salvat, și profilurile ca presetări de module active. Restul se raportează ca neterminat.
