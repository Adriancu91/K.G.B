# K.G.B. — Etapa 2 (Storage Engine): raport și propunere de poartă

**Data:** 6 nov. 2026 · **Statut:** PROPUNERE. Poarta se închide doar cu aprobarea proprietarului.
**Poarta cerută de Master Plan:** „testele de volum, corupere, recuperare și concurență trec”.
**Plan:** `docs/ETAPA2_PLAN.md` · **Măsurători:** `docs/etapa2/BENCH.md`

## Pe scurt
| Cerință a porții | Rezultat |
|---|---|
| **Volum** | 10k / 100k / 1M înregistrări măsurate pe laptop. Toate pragurile aprobate (D-022) sunt atinse la 100k, inclusiv ținta rămasă din Etapa 0: **filtrare fără index 139 ms** (prag < 200 ms; era 983 ms) |
| **Corupere** | CRC pe fiecare cadru, BLAKE3 pe fișiere și backupuri. Octeții corupți, blob-urile alterate, backupurile modificate și datele binare trunchiate sunt **detectate**, niciodată folosite pe ascuns |
| **Recuperare** | **1.000 de opriri forțate** în timpul scrierilor și **300 în timpul compactării**: 0 tranzacții pierdute, 0 parțiale. Backup → restaurare ca spațiu nou, verificat în aplicație |
| **Concurență** | 6 fire cu conflicte reale de versiune, citiri concurente fără stări parțiale, compactare și backup în paralel, a doua deschidere refuzată. Stabil la 5 rulări |

**Teste:** 101 teste automate (`cargo test --workspace`), CI verde. Plus două scenarii în fereastra reală: poarta Etapei 1 (15/15) și backup/restaurare (8/8).

## Ce s-a construit
| Pas | Ce | Efect |
|---|---|---|
| 2.1 | Benchmark extins (memorie, mai multe filtre) | Linie de bază măsurată înainte de orice schimbare |
| 2.2 | Keydir pe colecții; citire în ordinea de pe disc | Index la 1M: 90 s → 8,5 s; memorie la 1M: 386 → 240 MB |
| 2.3 | Interogări structurate (`Query`): egal, interval, conține, și/sau/nu, sortare, pagini | Date, nu cod: modulele și interfața le construiesc în siguranță |
| 2.4 | **Format binar v2** (D-028), fără bibliotecă nouă | Filtrare 100k: 455–609 ms → 139 ms; pornire 100k: 349 → 201 ms |
| 2.5 | Compactare incrementală (câte un segment de 8 MB) | Pauză ~90–150 ms în loc de 24 s la 1M |
| 2.6 | Schema colecțiilor (tipuri, obligatorii, limite, enum) | Nucleul refuză orice înregistrare greșită a unui modul |
| 2.7 | Indexuri declarate în manifest | Create de nucleu, folosite automat de interogări |
| 2.8 | Fișiere atașate (`files.own`) | Fiecare fișier aparține modulului care l-a salvat; BLAKE3 la fiecare citire; ștergerea doar marchează |
| 2.9 | Backup/restaurare în aplicație („Date și backup”) | Restaurare ca spațiu nou (D-030); backup automat înainte de migrări și de conversia formatului |
| 2.10 | Teste de concurență | Vezi mai sus |
| 2.11 | Volum, corupere și opriri forțate pe laptop | Vezi mai sus |

## Compatibilitate (D-029)
- Jurnalele scrise de Etapele 0/1 (JSON) se citesc în continuare.
- La prima deschidere în versiunea nouă, aplicația face întâi un **backup automat**, apoi convertește jurnalul la v2.
- Backupul păstrează formatul vechi.
- O aplicație veche refuză clar un jurnal v2, fără să-l modifice.

## Ce NU e făcut sau dovedit (sincer)
- 🔒 **Pierderea alimentării** (2.12) **nu e testată.** Opririle forțate pierd doar procesul, nu memoria cache a Windows. Pentru test e nevoie de o mașină virtuală (Hyper-V, cu drepturi de administrator). Codul face `sync_data` la fiecare tranzacție durabilă, ceea ce e mecanismul corect, dar nu e dovedit.
- **Încărcarea în masă e mai lentă:** ~42k înregistrări/s față de ~65k cu JSON. Rămâne mult peste nevoi.
- **Volume foarte mari (1M):**
  - interogarea fără index durează 2,8 s;
  - căutarea indexată cu 20.000 de rezultate durează 1,1 s.

  Pragurile aprobate erau pentru 100k. Modulele cu volume mari trebuie să folosească indexuri și `limit`.
- **Ștergerea unui backup manual din interfață** nu există încă.
- **Indexurile sunt doar de egalitate**, nu de interval sau text. Interogările pe interval parcurg colecția.
- **Testele în fereastra reală rulează doar local**, nu în CI.

## Decizii cerute proprietarului
| # | Decizie | Recomandare |
|---|---|---|
| D-028 | Confirmi formatul binar v2 al jurnalului? (aplicat pe baza recomandării aprobate în D-022 și a măsurătorilor) | Da |
| D-029, D-030 | Confirmi compatibilitatea (conversie doar cu backup) și restaurarea ca spațiu nou? | Da |
| 2.12 | Pierderea alimentării: (a) pornești Hyper-V și testăm acum; (b) amânăm testul înainte de prima utilizare cu date reale | (b): riscul e cunoscut și notat; testul rămâne obligatoriu înainte de date reale |
| Poartă | Considerăm Etapa 2 încheiată și trecem la **Etapa 3 (documente și foi de calcul)**? | Da |
