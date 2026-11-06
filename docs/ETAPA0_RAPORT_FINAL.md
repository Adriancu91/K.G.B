# K.G.B. — Etapa 0: raport final și propunere de poartă

**Data:** 6 nov. 2026 · **Statut:** APROBAT de proprietar (6 nov. 2026, D-022): toate recomandările acceptate; Etapa 1 începe, S2.3 rămâne de făcut.
**Poarta cerută de Master Plan:** „deciziile tehnice riscante sunt testate, iar rezultatele sunt documentate”.

## Pe scurt
| Întrebare | Răspuns | Dovadă |
|---|---|---|
| Putem stoca date fiabil **fără bază de date**? | **Da.** 1.000 de opriri forțate fără nicio tranzacție pierdută sau parțială; volum de 1.000.000 de înregistrări suportat | `docs/spikes/S1_REZULTATE.md` |
| Putem face o aplicație desktop **mică și rapidă** cu Tauri + React/TS? | **Da.** Installer 1,2 MB, pornire ~1 s, ~156 MB RAM | `docs/spikes/S3_REZULTATE.md` |
| Pot **două PC-uri** să comunice criptat, fără server central și fără driver? | **Da pe același PC; neverificat între PC-uri reale.** Lipsește al doilea PC | `docs/spikes/S2_REZULTATE.md` |
| Sunt licențele în regulă? | **Da**, fără GPL/AGPL și fără biblioteci DB, verificat automat în CI. MPL-2.0 de confirmat | `LICENSES.md`, `deny.toml` |

## Recomandări de stack (de aprobat)
1. **Interfață:** Tauri 2 + React 19 + TypeScript strict (D-010 → propun DECIS).
2. **Stocare:** jurnal propriu append-only cu CRC, tranzacții atomice, keydir în memorie, indexuri regenerabile, compactare, blobs BLAKE3, backup cu hash-uri (designul S1). Pentru Etapa 2: format binar în loc de JSON, compactare incrementală.
3. **Rețea:** **iroh** (D-015 → propun DECIS), relay propriu `iroh-relay` în producție (D-017). **Nu Nebula:** cere driver + drepturi de administrator și un server obligatoriu.
4. **Distribuție:** semnare de cod prin **firmă** (Azure Artifact Signing, eligibil pentru firme din UE). Fără ea, K.G.B. nu pornește pe PC-urile cu Smart App Control (R11).

## Praguri — rezultat pe laptop (i5-1135G7, 8 GB, SSD NVMe)
| Prag propus | Rezultat | Propunere |
|---|---|---|
| Scriere durabilă p95 < 10 ms | 0,84–0,98 ms ✅ | păstrat |
| Lot 1.000 scrieri < 200 ms | 15–19 ms ✅ | păstrat |
| Pornire 100k < 2 s | 0,34 s (0,59 s cu index) ✅ | păstrat |
| Pornire 1M < 20 s | 3,1 s (6,8 s cu index) ✅ | păstrat |
| Căutare indexată < 5 ms | 2,3 ms la 200 rezultate; 25 ms la 2.000 | **redefinit:** „< 5 ms pentru ≤ 1.000 de rezultate” |
| Filtrare fără index 100k < 200 ms | **913 ms ❌** | **țintă pentru Etapa 2** (format binar / cache de coloane), nu blochează Etapa 1 |
| Disc după compactare < 2× | 1,76–1,78× ✅ | păstrat |
| *(nou)* Installer | 1,18 MB | — |
| *(nou)* RAM aplicație goală | ~156 MB privat | de urmărit (R12) |

## Ce NU e dovedit încă (sincer)
- 🔒 **Rețea între 2 PC-uri reale**, în LAN și prin internet (NAT traversal, cât trafic trece prin relay). E cel mai mare risc rămas (R2, R8).
- **Pierderea alimentării** (nu doar oprirea procesului): cere o mașină virtuală.
- Consumul de RAM al motorului S1 la 1M înregistrări.
- Pornirea „la rece” a aplicației, după restartul PC-ului.
- Aplicație semnată pe un PC cu Smart App Control pornit.

## Decizii cerute proprietarului
| # | Decizie | Recomandare |
|---|---|---|
| D-021 | Acceptăm bibliotecile MPL-2.0 aduse de Tauri și iroh? | Da, cu regula „nu le modificăm” |
| Praguri | Aprobăm pragurile cu cele 2 modificări de mai sus? | Da |
| D-010, D-015 | Tauri + React/TS și iroh devin DECISE? | Da |
| Poartă | Trecem la Etapa 1 **înainte** de testul cu 2 PC-uri? | **Da, în paralel:** Etapa 1 (nucleul desktop) nu depinde de rețea; testul S2.3 se face când există al doilea PC, înainte de Etapa 6 |
| Semnare | Pregătim firma pentru Azure Artifact Signing? | Da, validarea durează 1–20 zile lucrătoare |

## Ce s-a livrat
- `spikes/s1-storage`: motorul de stocare, 20 de teste, test cu opriri forțate, benchmark.
- `spikes/s2-network`: program P2P cu iroh și scripturile de test `test-local.ps1` și `test-failures.ps1`.
- `spikes/s3-tauri-shell`: aplicația Tauri cu installer și o schiță de spațiu de lucru (0.8).
- CI GitHub: testele S1 pe Windows și `cargo-deny` pentru toate crate-urile.
- Documente: `DECISION_LOG.md` (D-001…D-021), `RISK_REGISTER.md` (R1…R14), `LICENSES.md`, `ROADMAP.md`, rapoartele S1/S2/S3.

Toate spike-urile sunt **prototipuri**: demonstrează fezabilitatea, nu sunt cod de producție și nu se folosesc pentru date reale.
