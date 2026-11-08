# K.G.B. — Etapa 6 (Echipe și rețea): raport intermediar

**Data:** 8 nov. 2026 · **Statut:** PARȚIAL. Partea care se poate face pe un singur PC e gata (pașii 6.1–6.9). **Poarta nu se poate propune încă**: Master Plan §13 cere testul pe minimum două PC-uri, în LAN și prin internet (🔒 6.10, fostul S2.3).
**Plan:** `docs/ETAPA6_PLAN.md` · Capturi: `docs/etapa6/e2e-*`

## Pe scurt
| Cerința porții (Master Plan §13) | Stare |
|---|---|
| Test pe minimum două PC-uri | **Nefăcut**: lipsește al doilea PC (🔒 6.10) |
| În LAN și prin internet | **Nefăcut**: un singur laptop nu poate dovedi asta |
| Cu întreruperi și reconectare | **Dovedit pe același laptop**, cu procese reale oprite brusc (6.6, 6.8) |

**Teste:** 213 teste automate trec pe laptop. În fereastra reală: rețea 15/15, organizație 11/11, invitație 11/11, conflicte 6/6, testul general 15/15.

## Ce s-a construit
| Pas | Ce | Dovada |
|---|---|---|
| 6.1 | Organizație, persoane, roluri pe module (fără acces / doar citire / scriere); fără organizație nu se schimbă nimic | 3 teste + e2e |
| 6.2 | Invitații (expirare, o singură folosire, fără chei private), cererea semnată a PC-ului nou, aprobare cu compararea amprentei; **registru de membri semnat** (D-058) | 2 teste (cod modificat, expirat, altă organizație, registru falsificat) + e2e |
| 6.3 | Protocolul de sincronizare, independent de rețea (D-057): mesaje semnate; fiecare PC primește doar ce rolul lui poate citi, restul doar ca „marcaj” fără conținut (D-059); fiecare schimbare e verificată după autor și rolul lui din acel moment | 1 test în stocare + 2 în nucleu |
| 6.4 | Conflictele în aplicație; decizia ajunge pe toate PC-urile | 2 teste în stocare + 1 în nucleu + e2e cu un conflict real |
| 6.5 | Rețeaua cu iroh: cheia rețelei e chiar cheia PC-ului; pornește doar cu organizație; implicit fără server extern; sincronizare la un minut și la cerere | 2 teste prin rețea reală (și cu 2 procese) + e2e aplicație ↔ al doilea nod |
| 6.6 | Offline și reluare: primitorul oprit brusc de 19 ori în mijlocul aplicării a 12.000 de note, cel care trimite oprit în timpul trimiterii — nimic pierdut, nimic dublat | 2 teste cu procese oprite brusc |
| 6.7 | Revocarea unui PC (D-060), care ajunge la toate PC-urile | 1 test cu 3 PC-uri + e2e |
| 6.8 | Fișierele atașate: separat, cu reluare și verificare BLAKE3; doar pentru rolurile care pot citi modulul | 2 teste (60 MB, procesul care trimite oprit brusc) + e2e |
| 6.9 | Pagina „Dispozitive și sincronizare” | e2e |

**Mărimea:** installerul a crescut de la 21,3 la 24,3 MB (iroh, +3 MB).

## Ce NU e făcut sau dovedit (sincer)
- **Două PC-uri reale, LAN și internet (🔒 6.10):** totul a rulat pe același laptop, cu conexiuni reale, dar locale. Nu știm încă cum se comportă rețeaua Wi-Fi, routerul, firewall-ul Windows de pe alt PC sau traversarea NAT prin internet. Dacă iroh nu trece acest test, D-015 se redeschide; protocolul și restul etapei rămân valabile (D-057).
- **Relay de producție (D-017):** pentru folosire prin internet e nevoie de un relay propriu (server și cost lunar), o decizie 🔒 a proprietarului. Relay-ul public n0 e doar pentru teste.
- **Găsirea celuilalt PC:** fără relay, PC-urile se găsesc din adresele schimbate la invitație și la fiecare sincronizare. Dacă amândouă își schimbă adresa în același timp, nu se mai găsesc până la relay.
- **Schimbări transmise printr-un al treilea PC:** sunt verificate după drepturile autorului, dar nu sunt semnate individual de autor. Un membru rău-intenționat ar putea trece o schimbare în numele altuia, în limita modulelor acelui om. E o îmbunătățire pentru mai târziu.
- **Revocarea:** ce a copiat un PC revocat rămâne pe el; un PC care nu știe încă de revocare mai poate primi schimbări de la el (D-060).
- **Ora PC-urilor:** un ceas foarte greșit poate face ca o schimbare să fie refuzată până la corectare (nu se pierde).
- **Date reale:** tot nu. 🔒 Testul de pierdere a curentului (2.12) rămâne obligatoriu.
- **CI-ul pe GitHub** e tot oprit din cauza facturării contului.

## Ce s-a aflat pe drum
- **Motorul de stocare presupunea copii complete.** Pentru roluri a fost nevoie de „marcaje” care țin locul schimbărilor nepermise, fără găuri în numărătoare (6.3).
- **Un conflict se putea pierde la o oprire bruscă** între salvarea schimbării și înregistrarea conflictului. Acum conflictul se scrie primul (6.6).
- **Testele de oprire bruscă trebuie țintite:** cu întârzieri fixe, nicio oprire n-a nimerit mijlocul aplicării; urmărind creșterea jurnalului, toate au nimerit (6.6).
- **Codul invitației conține adresele de rețea ale laptopului:** testele îl ascund în capturi.

## Ce cere poarta Etapei 6
| # | Decizie / acțiune | Recomandare |
|---|---|---|
| 6.10 🔒 | Un al doilea PC (în aceeași rețea, apoi în altă rețea, de ex. alt Wi-Fi sau internet mobil) pentru testul real | Pregătește-l; testul durează aproximativ o oră |
| D-056 … D-060 | Confirmi regulile Etapei 6: roluri pe module, sincronizare separată de rețea, registru semnat, doar datele permise de rol, revocare fără ștergere de la distanță? | Da |
| D-017 | Relay propriu pentru folosire prin internet (cost lunar) sau, deocamdată, doar rețea locală | De decis după testul 6.10 |
