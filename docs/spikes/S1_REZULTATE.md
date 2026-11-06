# S1 — Motorul de stocare fără DB: rezultate

**Data:** 7 nov. 2026 · **Cod:** `spikes/s1-storage` · **Rulare:** GitHub Actions, run 42140861380 (Windows curat, `windows-latest`)
**Statut:** PROTOTIP. Măsurătorile sunt reale, dar pe hardware-ul CI, nu pe PC-urile țintă.

## Hardware de test
GitHub Actions `windows-latest`: AMD EPYC 7763 (procesor virtual), 8 GB RAM, disc virtual (SAS), Windows Server.
Măsurătorile nu au rulat pe PC-ul tău, pentru că acolo Smart App Control blochează build-ul (D-020). Discul virtual din CI poate raporta scrieri durabile mai rapide decât un SSD real. **Trebuie repetate pe un PC țintă.**

## Ce s-a testat și rezultatul

| Test | Rezultat |
|---|---|
| 20 de teste funcționale și de defecte (`tests/storage.rs`) + 1 test unitar | **20/20 + 1/1 trec** |
| Creare/citire/actualizare, persistență după redeschidere | trece |
| Concurență optimistă: un editor cu versiune veche este refuzat | trece |
| Lot atomic: un element invalid → nimic din lot nu se aplică, fără găuri în numerotare | trece |
| Ștergere logică + restaurare, datele rămân | trece |
| Al doilea proces pe același spațiu de lucru → refuzat (`Locked`) | trece |
| Scriere întreruptă la coadă → mutată în carantină, nu ștearsă | trece |
| Tranzacție incompletă (3 operații, ultima tăiată) → nicio operație vizibilă | trece |
| Octeți corupți în mijlocul jurnalului → deschidere refuzată, fișier nemodificat; reparare doar explicită, cu original salvat | trece |
| Manifest lipsă → eroare, fără ghicire | trece |
| Index: căutare, actualizare, ștergere, reconstruire completă din jurnal | trece |
| Compactare: starea se păstrează, spațiul scade | trece |
| Backup → verificare hash → restaurare; modificarea unui octet în backup e detectată | trece |
| Atașament (blob) modificat pe disc → detectat | trece |
| Folder OneDrive → refuzat | trece |
| Sincronizare 2 copii: fast-forward, deduplicare la retrimitere | trece |
| Editări offline pe **câmpuri diferite** → îmbinare automată, ambele copii identice | trece |
| Editări offline pe **același câmp** → conflict pentru utilizator, același ID de conflict pe ambele copii, decizia se propagă | trece |
| Ștergere pe un PC + editare pe celălalt → conflict | trece |
| Gaură în secvența de sincronizare / istoric compactat → erori explicite | trece |
| **300 de opriri forțate** (TerminateProcess) în timpul scrierii | **0 tranzacții confirmate pierdute, 0 tranzacții parțiale** (25.015 tranzacții verificate) |

### Bug găsit doar pe Windows
Primul build a arătat că `FlushFileBuffers` cere un handle cu drept de scriere. Un fișier deschis doar pentru citire dă *Access denied*. Am corectat backup-ul și repararea. Exact pentru astfel de diferențe trebuie testat pe Windows real.

## Măsurători (înregistrări de ~1 KB, 10 câmpuri)

| Măsurătoare | 10.000 | 100.000 | 1.000.000 | Prag propus | Verdict |
|---|---|---|---|---|---|
| Încărcare în loturi de 1.000 | 157 ms | 1,4 s | 12,0 s (83.500 înreg./s) | — | — |
| Deschidere + reconstruire keydir | 30 ms | 277 ms | 2,9 s | 100k < 2 s; 1M < 20 s | ✅ |
| Deschidere cu un index | 54 ms | 516 ms | 5,8 s | idem | ✅ |
| Construire index nou | 115 ms | 1,2 s | 12,3 s | — | ⚠️ lent la 1M |
| Scriere unitară durabilă p50 / p95 | 0,36 / 0,48 ms | 0,32 / 0,47 ms | 0,33 / 0,47 ms | p95 < 10 ms | ✅ (de reverificat pe SSD real) |
| Lot de 1.000 actualizări durabile | 26 ms | 16 ms | 16 ms | < 200 ms | ✅ |
| Citire după ID p50 / p95 | 0,009 / 0,018 ms | 0,009 / 0,018 ms | 0,010 / 0,017 ms | — | ✅ |
| Căutare indexată (2% din înregistrări) | 2,4 ms (200 rez.) | 24,7 ms (2.000 rez.) | 287 ms (20.000 rez.) | < 5 ms | ✅ pentru rezultate mici; timpul crește cu numărul de rezultate citite |
| Filtrare fără index | 84 ms | **888 ms** | 9,1 s | 100k < 200 ms | ❌ |
| Compactare | 170 ms | 1,8 s | 18,5 s | — | ⚠️ blochează scrierile |
| Disc după compactare / date utile | 1,78× | 1,78× | 1,77× | < 2× | ✅ (la limită) |

## Repetare pe PC țintă (laptopul proprietarului)

**Data:** 6 nov. 2026, după oprirea Smart App Control de către proprietar (D-020, varianta a).
**Hardware:** Intel Core i5-1135G7 (4 nuclee, laptop), 7,8 GB RAM, SSD NVMe Kingston A2000 250 GB, Windows 11 Pro, Defender activ.

| Test | Rezultat |
|---|---|
| 20 teste funcționale și de defecte + 1 unitar | **20/20 + 1/1 trec** (1,5 s) |
| **1.000 de opriri forțate** în timpul scrierii | **0 pierdute, 0 parțiale** (29.988 tranzacții verificate, 253 s) |

| Măsurătoare | 10.000 | 100.000 | 1.000.000 | Prag propus | Verdict |
|---|---|---|---|---|---|
| Încărcare în loturi de 1.000 | 171 ms | 1,7 s | 17,4 s (57.500 înreg./s) | — | — |
| Deschidere + reconstruire keydir | 35 ms | 341 ms | 3,1 s | 100k < 2 s; 1M < 20 s | ✅ |
| Deschidere cu un index | 57 ms | 593 ms | 6,8 s | idem | ✅ |
| Construire index nou | 123 ms | 1,2 s | 17,8 s | — | ⚠️ lent la 1M |
| Scriere unitară durabilă p50 / p95 | 0,53 / 0,91 ms | 0,64 / 0,84 ms | 0,67 / 0,98 ms | p95 < 10 ms | ✅ (de 10× sub prag pe SSD real) |
| Lot de 1.000 actualizări durabile | 19 ms | 17 ms | 15 ms | < 200 ms | ✅ |
| Citire după ID p50 / p95 | 0,010 / 0,019 ms | 0,009 / 0,018 ms | 0,010 / 0,019 ms | — | ✅ |
| Căutare indexată (2% din înregistrări) | 2,3 ms | 24,8 ms | 474 ms | < 5 ms | ✅ pentru rezultate mici |
| Filtrare fără index | 95 ms | **913 ms** | 11,1 s | 100k < 200 ms | ❌ (confirmat) |
| Compactare | 217 ms | 2,1 s | 22,5 s | — | ⚠️ blochează scrierile |
| Disc după compactare / date utile | 1,78× | 1,78× | 1,76× | < 2× | ✅ (la limită) |

**Comparație cu CI:** rezultatele de pe laptop sunt apropiate de cele din CI. Scrierea durabilă e ~2× mai lentă pe SSD-ul real, dar tot de 10× sub prag. Operațiile pe volum mare (încărcare, index, compactare la 1M) sunt cu 20–45% mai lente, iar concluziile rămân aceleași.

## Concluzii
1. **Arhitectura fără DB este fezabilă.** Durabilitatea și recuperarea la oprire forțată se comportă corect, iar volumul de 1.000.000 de înregistrări e suportat.
2. **Punct slab: filtrarea fără index** (888 ms la 100.000). Cauza: fiecare înregistrare e parsată din JSON. Remedii pentru Etapa 2: format binar (CBOR/MessagePack, de măsurat), mai multe indexuri, sau un cache de coloane regenerabil.
3. **JSON-ul costă spațiu:** ~1,78× față de datele utile, din cauza metadatelor per câmp pentru sincronizare. Un format binar ar reduce costul.
4. **Compactarea și construirea indexurilor la 1M durează 12–18 s** și blochează scrierile. În Etapa 2 trebuie făcute incremental sau în fundal.

## Ce NU a fost testat (limitări cunoscute)
- **Pierderea alimentării.** Oprirea procesului nu pierde cache-ul sistemului de operare. E nevoie de o mașină virtuală cu oprire bruscă (Etapa 2).
- **Consumul de RAM** la 1M înregistrări nu a fost măsurat; e important pentru PC-uri cu 8 GB.
- ~~SSD real cu Defender activ~~ → testat pe laptop (secțiunea de mai sus).
- ~~1.000 de opriri forțate~~ → rulate pe laptop. Nici în acestea nu s-a nimerit tăierea unei scrieri la coadă; cazul e acoperit de testele de mai sus.
- Sincronizarea a fost testată doar între **2 copii, în același proces**. Peste rețea vine în S2.
- După compactare, un dispozitiv rămas mult în urmă are nevoie de resincronizare completă (eroare explicită, neimplementată încă).
- Un conflict rezolvat pe un PC rămâne marcat ca nerezolvat pe celălalt până la rezolvarea acolo (ID identic pe ambele). De proiectat în Etapa 6.
- Identitatea dispozitivului e în MANIFEST, deci o restaurare pe alt PC clonează identitatea. În Etapa 1 identitatea se mută separat, cu chei protejate prin DPAPI.
- ~~Clippy: 3 avertismente~~ → corectate (6 nov. 2026); clippy fără avertismente, 20/20 teste trec.

## Dependențe (toate cu licențe permisive, niciun motor DB)
serde, serde_json, crc32fast, uuid, blake3, windows-sys (+ tranzitive) — MIT / Apache-2.0 / CC0 / Unlicense / Unicode-3.0. Detaliu în `LICENSES.md`.

## Praguri de aprobat
Pragurile din `ETAPA0_PLAN.md` §3.2 rămân PROPUSE. Recomand:
- „filtrare fără index 100k < 200 ms” ca țintă pentru Etapa 2, nu pentru Etapa 0;
- „căutare indexată” redefinită ca „< 5 ms pentru ≤ 1.000 de rezultate”.
