# Etapa 2 — benchmark-ul motorului de stocare

Laptop: i5-1135G7, 7,8 GB RAM, SSD NVMe Kingston A2000, Windows 11, Defender activ. Înregistrări de ~1 KB, 10 câmpuri. Fiecare mărime rulează într-un proces separat (`target/release/bench.exe <dir> <n>`).

## Linia de bază (motorul S1, înainte de Etapa 2) — 6 nov. 2026

| Măsurătoare | 10k | 100k | 1M |
|---|---|---|---|
| Încărcare în loturi de 1.000 | 188 ms (53257 rec/s) | 1443 ms (69301 rec/s) | 15419 ms (64856 rec/s) |
| Deschidere + reconstruire keydir | 37 ms | 349 ms | 5725 ms |
| Construire index `category` | 108 ms | 1067 ms | 89620 ms |
| Deschidere + reconstruire keydir și index | 56 ms | 537 ms | 8204 ms |
| Scriere unitară durabilă p50 / p95 | 0.42 / 1.10 ms | 0.42 / 0.95 ms | 0.52 / 0.96 ms |
| Lot de 1.000 actualizări durabile | 17 ms | 15 ms | 18 ms |
| Citire după ID p50 / p95 | 0.008 / 0.018 ms | 0.008 / 0.019 ms | 0.084 / 0.227 ms |
| Căutare indexată | 2.2 ms | 21.9 ms | 2333.5 ms |
| Filtrare fără index | 78 ms | 983 ms | 11806 ms |
| Filtrare fără index, 20% | 83 ms | 918 ms | 12491 ms |
| Numărare colecție | 0.16 ms | 1.89 ms | 77.29 ms |
| Memorie proces | 5 MB | 25 MB | 386 MB |
| Compactare | 188 ms | 2133 ms | 23301 ms |
| Spațiu pe disc înainte / după compactare | 18.1 / 15.8 MB | 172.2 / 157.8 MB | 1727.1 / 1592.1 MB |
| Raport disc / date utile | 1.77× | 1.77× | 1.78× |

**Ce arată:**
- Filtrarea fără index e proporțională cu tot jurnalul: 0,95 s la 100k, 12 s la 1M. Ținta aprobată: < 200 ms la 100k.
- Construirea unui index la 1M durează 90 s, iar căutarea indexată cu 20.000 de rezultate 2,3 s: fiecare înregistrare e citită separat, în ordine aleatoare, de pe disc.
- Memoria la 1M e 386 MB: fiecare cheie din keydir își repetă numele colecției.

## După 2.2–2.3 (keydir pe colecții, citire în ordinea de pe disc, interogări) — 6 nov. 2026

| Măsurătoare | 100k | 1M |
|---|---|---|
| Construire index `category` | 694–947 ms | **15,9 s** (era 89,6 s) |
| Căutare indexată (2.000 / 20.000 rezultate) | 20–23 ms | **0,42 s** (era 2,3 s) |
| Filtrare fără index (`scan`) | 593–602 ms (era 983) | 6,7 s (era 11,8) |
| Interogare fără index (`query`, decodare parțială) | 455–609 ms | — |
| Numărare colecție | 0,8 ms | 5,9 ms (era 77) |
| Memorie proces | 21–22 MB | 566 MB (*) |

* La 1M, după reconstruirea indexului fără a ține toate înregistrările în memorie, trebuie măsurat din nou (pasul 2.11).

### Unde se duce timpul la 100k (măsurare temporară, scoasă din cod)
| Etapă | Timp |
|---|---|
| Doar citirea de pe disc (în bucăți de 4 MB, în ordinea de pe disc) | **89 ms** |
| + validarea JSON fără a construi nimic | **241 ms** |
| + câmpurile ca referințe (decodare parțială) | 486 ms |
| + decodarea completă | 583 ms |

**Concluzie (dovada pentru D-028):** discul nu e problema. Simpla trecere prin JSON a fiecărei înregistrări depășește singură ținta de 200 ms. Ținta se poate atinge doar cu un format în care câmpurile nefolosite de filtru se sar după lungime, fără a fi citite caracter cu caracter.

## După 2.4 — format binar v2 (D-028), 100k înregistrări — 6 nov. 2026

| Măsurătoare | JSON (v1) | Binar (v2) |
|---|---|---|
| **Interogare fără index, 200 de rezultate** (pragul aprobat: < 200 ms) | 455–609 ms | **116 ms ✅** |
| Interogare fără index, 20% (20.000 de rezultate, toate decodate complet) | 599–636 ms | 251 ms |
| Deschidere + reconstruire keydir | 349–393 ms | 166 ms |
| Construire index | 694–947 ms | 603 ms |
| Scriere unitară durabilă p50 / p95 | 0,42 / 0,95 ms | 0,41 / 0,96 ms |
| Compactare | 2.061 ms | 1.701 ms |
| Raport disc / date utile | 1,78× | 1,71× |
| Opriri forțate (300) | — | **0 pierdute, 0 parțiale**, 26.377 de tranzacții |

`scan` (care decodează complet fiecare înregistrare) rămâne ~0,5 s. Modulele vor folosi `query`.

## După 2.5 — compactare incrementală — 6 nov. 2026

| Măsurătoare (100k) | Valoare |
|---|---|
| Un pas de compactare cu segmente de 64 MB | 656 ms |
| **Un pas cu segmente de 8 MB (noua valoare implicită)** | **91 ms** |
| Compactare completă (toată colecția odată) | 2,5 s |
| Deschidere cu segmente de 8 MB | 199 ms |
| Interogare fără index | 135–140 ms ✅ |

**300 de opriri forțate cu compactare în timpul scrierilor** (`crashtest run <dir> 300 compact`: rescrieri, un pas de compactare la fiecare 10 tranzacții, o compactare completă la 250, segmente de 64 KB): **0 pierdute, 0 parțiale**, 6.696 de tranzacții. Au rămas, raportate, nu șterse: 11 segmente orfane (0,6 MB) și 341 de fișiere temporare în carantină (20 MB), de la scrierile întrerupte. Trebuie o curățare explicită, inițiată de utilizator (pasul 2.9).

## 2.11 — Măsurători finale pe laptop (format v2, segmente de 8 MB) — 6 nov. 2026

| Măsurătoare | 10k | 100k | 1M |
|---|---|---|---|
| Încărcare în loturi de 1.000 | 231 ms (43330 rec/s) | 2400 ms (41664 rec/s) | 23477 ms (42595 rec/s) |
| Deschidere + reconstruire keydir | 24 ms | 201 ms | 3589 ms |
| Construire index `category` | 101 ms | 730 ms | 8489 ms |
| Deschidere + reconstruire keydir și index | 79 ms | 551 ms | 6916 ms |
| Scriere unitară durabilă p50 / p95 | 0.51 / 1.18 ms | 0.75 / 1.22 ms | 0.75 / 1.30 ms |
| Lot de 1.000 actualizări durabile | 22 ms | 18 ms | 17 ms |
| Citire după ID p50 / p95 | 0.011 / 0.023 ms | 0.009 / 0.023 ms | 0.021 / 0.276 ms |
| Căutare indexată | 2.2 ms | 20.6 ms | 1136.2 ms |
| Filtrare fără index | 70 ms | 630 ms | 8076 ms |
| Filtrare fără index, 20% | 113 ms | 691 ms | 9286 ms |
| Interogare fără index | 21 ms | 139 ms | 2752 ms |
| Interogare fără index, 20% | 49 ms | 295 ms | 4322 ms |
| Numărare colecție | 0.08 ms | 0.84 ms | 14.70 ms |
| Memorie proces | 6 MB | 22 MB | 240 MB |
| Pas de compactare incrementală | 105 ms (8.3 → 7.1 MB) | 90 ms (8.3 → 7.1 MB) | 150 ms (8.3 → 7.1 MB) |
| Compactare | 257 ms | 2044 ms | 24066 ms |
| Spațiu pe disc înainte / după compactare | 16.4 / 15.2 MB | 165.3 / 151.2 MB | 1656.0 / 1513.2 MB |
| Raport disc / date utile | 1.71× | 1.70× | 1.70× |

**Opriri forțate (TerminateProcess):**
- 1.000 de opriri în timpul scrierilor: **0 pierdute, 0 parțiale**; 40.386 de tranzacții intacte, 466 confirmate pe disc înainte să ajungă confirmarea la program (permis).
- 300 de opriri cu compactare și rescrieri în timpul scrierilor: **0 pierdute, 0 parțiale**; 6.957 de tranzacții.

**Corupere și recuperare:** testele automate (`crates/kgb-store/tests/storage.rs`, `format.rs`) rulează acum pe formatul v2:
- octeți corupți în jurnal → detectați prin CRC, motorul refuză să deschidă, reparare doar explicită;
- index șters → reconstruit;
- blob alterat → detectat;
- backup alterat → refuzat;
- prefixe trunchiate de v2 → eroare, nu blocare.

**Față de pragurile aprobate (D-022):**
| Prag | Rezultat |
|---|---|
| Scriere durabilă p95 < 10 ms | 1,2–1,3 ms ✅ |
| Lot 1.000 < 200 ms | 17–22 ms ✅ |
| Pornire 100k < 2 s | 0,20 s ✅ |
| Pornire 1M < 20 s | 3,6 s ✅ (era 5,1–5,7) |
| Căutare indexată < 5 ms pentru ≤ 1.000 de rezultate | 2,2 ms la 200 ✅; 21 ms la 2.000; 1,1 s la 20.000 (1M) |
| **Filtrare fără index 100k < 200 ms** (ținta Etapei 2) | **139 ms ✅** cu `query` (`scan` complet: 630 ms) |
| Disc după compactare < 2× | 1,70× ✅ |

**Ce s-a înrăutățit sau rămâne de urmărit (sincer):**
- Încărcarea în masă: ~42k înregistrări/s, față de ~65k cu JSON. Cauzele: codificarea câmpurilor una câte una și segmentele mai mici, cu închideri mai dese. Rămâne mult peste nevoi: 100k în 2,4 s.
- La 1M înregistrări (1,6 GB), interogările fără index cresc liniar (2,8 s), iar căutarea indexată cu 20.000 de rezultate durează 1,1 s, pentru că citește din tot fișierul. Pentru volume atât de mari, modulele trebuie să folosească indexuri și paginare (`limit`).
- Memoria la 1M: 240 MB (era 386 MB, înainte de keydir pe colecții).
