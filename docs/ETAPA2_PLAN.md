# K.G.B. — Planul Etapei 2: Storage Engine

**Data:** 6 nov. 2026 · **Statut:** ÎN LUCRU. Etapa a fost aprobată de proprietar (D-027); deciziile noi apar mai jos ca PROPUSE.
**Sursa:** Master Plan §9, §11, §12.2, §13 (Etapa 2), Metaprompt §7, raportul Etapei 0 (pragurile aprobate, D-022).

## Ce cere Master Plan-ul
Înregistrări structurate, stocare de fișiere, index, jurnal, recuperare, backup/restore.

**Poarta:** trec testele de volum, de corupere, de recuperare și de concurență.

## Punct de plecare
Motorul din S1 (`crates/kgb-store`) îndeplinește deja pragurile, cu o excepție. Ce are:
- jurnal cu CRC și tranzacții atomice;
- recuperare după 1.000 de opriri forțate fără pierderi;
- indexuri regenerabile;
- compactare;
- blobs BLAKE3;
- backup verificat;
- sincronizare între două copii (testată).

Ce lipsește:
1. **Filtrarea fără index:** 913 ms la 100k înregistrări; ținta aprobată e < 200 ms.
   - Cauza găsită în cod: `scan` citește **toate** segmentele, inclusiv versiunile vechi și celelalte colecții, și decodează fiecare cadru JSON **de două ori**.
   - `count` și `ids` parcurg toate cheile din toate colecțiile.
2. **Compactarea blochează** totul: 22,5 s la 1M înregistrări.
3. **Modulele nu au încă acces** la indexuri, fișiere, interogări structurate sau backup. Acum au doar `get`/`scan`/`write` pe colecțiile proprii.
4. **Backup/restore nu se poate face din aplicație.** Nu există nici backup automat înainte de migrări (Master Plan §12.2).
5. **Nemăsurate:** RAM la 1M înregistrări; pierderea alimentării.

## Pași
| Pas | Ce | Criteriu de acceptare |
|---|---|---|
| 2.1 | Benchmark extins: RAM (keydir + indexuri) la 10k/100k/1M, filtrare pe mai multe forme, timpi pe laptop | Tabel de bază în `docs/etapa2/BENCH.md` |
| 2.2 | Keydir pe colecții și `scan` doar pe înregistrările vii ale colecției, citite în ordinea de pe disc, o singură decodare | Toate testele S1 trec; filtrarea măsurată din nou |
| 2.3 | Interogări structurate (`Query`: egal, interval, conține, și/sau, sortare, limită), evaluate cu decodare parțială (doar câmpurile folosite); dacă există index, îl folosește | Teste de corectitudine față de `scan`; **filtrare 100k < 200 ms** pe laptop |
| 2.4 | 🔁 **Decizie D-028 (format binar)** pe baza măsurătorilor din 2.2–2.3: trecem jurnalul la un format binar (CBOR, RFC 8949) doar dacă JSON-ul rămâne gâtul de sticlă | Măsurători comparative; decizie consemnată |
| 2.5 | Compactare incrementală: segment cu segment, cu pauze scurte între pași, fără blocarea scrierilor mai mult de ~100 ms | Test: scrieri în timpul compactării; nicio pierdere la oprire forțată în timpul compactării |
| 2.6 | Schema colecțiilor (înregistrări structurate): tipuri de câmpuri, câmpuri obligatorii, limite, declarate în manifestul modulului și validate de nucleu la fiecare scriere | Teste: date invalide refuzate; migrare de schemă |
| 2.7 | Indexuri declarate în manifest, construite de nucleu, folosite automat de interogări | Teste: index șters → reconstruit; aceleași rezultate cu și fără index |
| 2.8 | Fișiere atașate pentru module (permisiunea `files.own`): BLAKE3, limită de mărime, ștergerea fișierelor fără referință doar la compactare, niciodată imediat | Teste: hash verificat la citire, fișier corupt detectat, colectarea fișierelor orfane |
| 2.9 | Backup/restore în aplicație: backup manual și automat înainte de migrări, verificarea backupului, restaurare într-un spațiu de lucru nou (nu peste cel curent) | Teste + scenariu e2e: backup → modificări → restaurare → date corecte |
| 2.10 | Teste de concurență: mai multe fire pe același workspace, conflicte de versiune, citiri în timpul scrierilor | Teste fără blocaje sau corupere; conflictele raportate |
| 2.11 | Teste de volum și corupere pe laptop: 1M înregistrări, 1.000 de opriri forțate (și în timpul compactării), octeți corupți, index șters | Raport de măsurători |
| 2.12 | 🔒 Pierderea alimentării pe mașină virtuală | Cere o mașină virtuală (Hyper-V cere drepturi de administrator) — proprietarul decide |
| 2.13 | Raport `docs/ETAPA2_RAPORT.md` | — |
| 2.14 | 🔒 Poarta Etapei 2 | Aprobarea proprietarului |

## Decizii propuse
| ID | Decizie | Recomandare |
|---|---|---|
| D-028 | Format binar al jurnalului | **Se decide după măsurători (pasul 2.4)**. Nu schimbăm formatul fără motiv măsurat |
| D-029 | Compatibilitatea formatului | Orice format nou citește jurnalele vechi. Conversia se face doar la compactare, după backup automat |
| D-030 | Restaurarea creează un spațiu de lucru nou, nu suprascrie pe cel curent | Da: nu există suprascriere a singurei copii valide (Metaprompt §7) |

## Riscuri
- **Schimbarea formatului de pe disc e cea mai riscantă operație a proiectului.** Se face doar cu backup automat, citirea formatului vechi rămâne mereu posibilă, iar testele cu opriri forțate se repetă pe formatul nou.
- **RAM:** keydir-ul ține toate cheile în memorie. La 1M înregistrări trebuie măsurat (pasul 2.1) înainte de alte optimizări.
