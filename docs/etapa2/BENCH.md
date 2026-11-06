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
