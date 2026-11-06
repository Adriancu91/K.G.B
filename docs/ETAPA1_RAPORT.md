# K.G.B. — Etapa 1 (Nucleul desktop): raport și propunere de poartă

**Data:** 6 nov. 2026 · **Statut:** APROBAT de proprietar (6 nov. 2026, D-027). Drag-and-drop panouri → Etapa 4.
**Poarta cerută de Master Plan:** „aplicația pornește, salvează configurarea, activează/dezactivează un modul demonstrativ și nu pierde datele acestuia”.
**Planul etapei:** `docs/ETAPA1_PLAN.md`

## Pe scurt
Poarta e demonstrată de un **test automat în fereastra reală** a aplicației instalate (`app/e2e/gate.mjs`): **15/15 verificări trecute**, inclusiv după **două opriri forțate**. La nivel de nucleu trec încă **68 de teste automate** (`cargo test --workspace`), iar CI pe GitHub e verde.

## Demonstrația porții (aplicația instalată, laptopul proprietarului)
| # | Verificare | Rezultat |
|---|---|---|
| 1 | Prima pornire creează spațiul de lucru implicit | ✅ ~1,2–1,5 s până la interfață |
| 2 | Modulul demonstrativ nu e activ la început | ✅ |
| 3 | La activare, dialogul arată permisiunea cerută (`storage.own`) | ✅ |
| 4 | Modulul activat apare în meniu; se adaugă 2 note, una cu diacritice | ✅ |
| 5 | Se salvează configurarea: temă întunecată, densitate compactă, profil Management, panou lateral ascuns (Ctrl+B) | ✅ |
| 6 | **Oprire forțată** + repornire: configurarea și notele sunt păstrate | ✅ |
| 7 | Dezactivarea cere confirmare și spune că datele rămân (2 înregistrări) | ✅ |
| 8 | Modulul dispare din meniu; catalogul arată „dezactivat, 2 înregistrări” | ✅ |
| 9 | **Oprire forțată** + repornire: starea „dezactivat” e păstrată | ✅ |
| 10 | Reactivare: ambele note sunt acolo | ✅ |
| 11 | Jurnalul de audit conține activările și dezactivarea | ✅ |
| 12 | Raportul de diagnostic nu conține textul notelor | ✅ |

Capturi: `docs/etapa1/gate/01-pornire.png` … `08-diagnostic.png`.

## Ce s-a construit
| Pas | Componentă | Teste |
|---|---|---|
| 1.1 | Workspace Cargo (`crates/`, `modules/`, `app/`), CI cu build, fmt, clippy (avertismente = erori), teste, `cargo-deny` | CI verde |
| 1.2 | `kgb-store`: motorul S1, preluat neschimbat | 20 |
| 1.3 | Loguri JSON-lines cu rotație (5 × 2 MB), redactarea câmpurilor sensibile, panică logată, raport de diagnostic | 6 |
| 1.4 | Spațiu de lucru: manifest versionat, o singură instanță, refuz foldere cloud, fișiere deteriorate raportate fără modificare | 10 |
| 1.5 | Setări tipizate, validate, versionate, cu migrare din forma prototipului S3 | 7 |
| 1.6 | Identitate: cheia Ed25519 a PC-ului, sigilată cu **Windows DPAPI**; proprietar; dispozitivul înregistrat ca „aprobat” | 4 |
| 1.7 | Manager de module: manifest strict, compatibilitate cu nucleul, migrații în lanț, activare/dezactivare fără ștergerea datelor | 13 (împreună cu 1.8) |
| 1.8 | Permisiuni: verificate la fiecare operație, izolare pe colecții, refuzuri auditate | ↑ |
| 1.9 | Modulul demonstrativ `kgb.notes`, construit doar prin contract | 5 |
| 1.10 | Interfața: meniu pe profil, panou redimensionabil/ascuns, catalog, setări, diagnostic, bară de stare, comenzi rapide, confirmări | e2e 15/15; profiluri 2 |
| 1.11 | Installer NSIS, utilizator curent, fără UAC | testat manual, vezi mai jos |

## Installer (testat pe laptop)
| Test | Rezultat |
|---|---|
| Mărime installer | **2,07 MB** (S3: 1,18 MB; acum optimizat pentru viteză, nu pentru mărime) |
| Instalare silențioasă | 2,7 s; scurtături în meniul Start și pe Desktop; intrare în „Aplicații instalate” |
| Actualizare 0.1.0 → 0.1.1 peste instalarea existentă | 2,4 s; o singură intrare în listă; nota de test păstrată; versiunea afișată 0.1.1 |
| Dezinstalare silențioasă | aplicația și intrarea din listă dispar; **datele rămân** (`%LOCALAPPDATA%\ro.kronos.kgb`) |
| Reinstalare | datele vechi sunt regăsite |
| Opțiunea „șterge și datele” la dezinstalare | **Netestată**: o oferă fereastra standard Tauri (bifa e debifată implicit), dar n-am avut acces la ecran ca s-o apăs |

## Măsurători (aplicația instalată)
| | Valoare |
|---|---|
| Pornire până la interfață (din test) | 1,2–1,5 s |
| Pornire până la nucleu gata (măsurat în aplicație) | ~0,7 s |
| Memorie privată totală (7 procese) | **~153 MB**, din care aplicația propriu-zisă ~5 MB; restul e WebView2 (R12) |
| Executabil | 9,1 MB |

## Ce NU e făcut sau dovedit (sincer)
- **Panouri mutabile prin drag-and-drop și mai multe panouri pe ecran** (Master Plan §5.1): neimplementate. Doar panoul lateral e redimensionabil și ascuns. Propun mutarea lor în Etapa 4, când există mai multe module de pus pe ecran.
- **Notificări**: neimplementate (Etapa 4, Notification Engine).
- **Coș de gunoi în interfață:** nota ștearsă rămâne în stocare (ștergere logică), dar nu poate fi recuperată din interfață.
- **Mai mulți utilizatori, roluri, invitații**: Etapa 6. Acum există doar proprietarul.
- **Alt spațiu de lucru** (creare, comutare): nucleul îl suportă, interfața încă nu.
- **Magistrala de evenimente** dintre module: declarată în contract, neimplementată.
- **Testul e2e rulează doar local**, nu în CI (cere WebView2 cu fereastră).
- Eroarea trecătoare de compilare pe laptop (R15) a apărut de mai multe ori. A doua rulare trece de fiecare dată.
- Installerul e **nesemnat**. Pe PC-uri cu Smart App Control pornit nu va rula (R11).

## Decizii cerute proprietarului
| # | Decizie | Recomandare |
|---|---|---|
| D-023 | Structura codului (`crates/`, `modules/`, `app/`) | Aprobare: e deja folosită și testată |
| D-024 | Modulele sunt incluse în aplicație, fără pluginuri încărcate la rulare | Aprobare |
| D-025 | Cheia dispozitivului: Ed25519 + Windows DPAPI | Aprobare |
| D-026 | Loguri cu `tracing` și rotație proprie | Aprobare |
| Poartă | Considerăm Etapa 1 încheiată, cu panourile drag-and-drop mutate în Etapa 4? | Da |
| Următor | Etapa 2 (Storage Engine definitiv: format binar, compactare incrementală, ținta de filtrare fără index, backup/restore în interfață) | Da |
