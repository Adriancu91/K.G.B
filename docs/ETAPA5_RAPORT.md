# K.G.B. — Etapa 5 (Business): raport și propunere de poartă

**Data:** 8 nov. 2026 · **Statut:** APROBAT de proprietar („aprob”, 8 nov. 2026, D-055).
**Poarta cerută de Master Plan §13:** calculele sunt **testate, auditabile** și **delimitate clar** față de contabilitatea certificată.
**Plan:** `docs/ETAPA5_PLAN.md` · Capturi: `docs/etapa5/e2e-business/`

## Pe scurt
| Cerința porții | Cum e îndeplinită |
|---|---|
| **Testate** | Fiecare calcul are teste cu exemple calculate de mână: TVA pe linie și rotunjirea la ban, costul mediu ponderat, transferuri și inventar, totaluri de facturi, scadențar pe intervale, rapoarte. Peste ele, un test face **1.000 de operații aleatoare**, multe refuzate intenționat, iar verificarea găsește **0 probleme**, și după redeschiderea spațiului de lucru |
| **Auditabile** | Nimic înregistrat nu se modifică și nu se șterge. Greșelile se corectează prin storno, vizibil și o singură dată (D-051). Stocurile, valorile, soldurile și rapoartele se refac de fiecare dată din istoric; nu sunt numere salvate care să poată devia. Fila „Audit” verifică tot pe loc și arată jurnalul operațiilor |
| **Delimitate** | Pe fiecare ecran: „Evidență primară, nu contabilitate certificată”. Cotele de TVA sunt setări de confirmat de tine sau de contabil (implicit 21%, 11%, 0%). Rezultatul din rapoarte e marcat ca indicator, nu rezultat contabil. e-Factura și SAF-T nu fac parte din etapă (D-052) |

**Teste:**
- **195 de teste automate** trec pe laptop, printre ele și testul cu 1.000 de operații;
- testul modulului Business în fereastra reală: **28/28 verificări**, cu repornire forțată.

## Ce s-a construit (modulul „Business”, beta)
| Pas | Ce | Reguli verificate |
|---|---|---|
| 5.1 | Produse, depozite, recepții, ieșiri, stoc minim | Stoc = suma mișcărilor; o ieșire peste stoc e refuzată și spune cât e; storno vizibil, refuzat dacă ar face stocul negativ |
| 5.2 | Transferuri, inventar, cost mediu ponderat (D-050) | Valoarea merge cu marfa; ultima ieșire ia exact ce a rămas, deci un stoc gol valorează 0 |
| 5.3 | Parteneri (CUI verificat), facturi emise, PDF cu Typst | Numere fără goluri și fără dubluri, și după repornire (D-054); TVA pe linie, rotunjit la ban (D-049); factura scade stocul în aceeași scriere, iar stornarea îl readuce |
| 5.4 | Facturi primite și cheltuieli; preluare din „Extragere date” | Total = net + TVA; același document nu intră de două ori; importul intră tot sau deloc |
| 5.5 | Casă și bancă: încasări, plăți, chitanțe, extrase CSV, avansuri și deconturi | Casa nu ajunge pe minus; o plată se leagă o singură dată, niciodată peste rest; extrasul intră o singură dată; decont = avans, exact |
| 5.6 | Scadențar și fișa partenerului; memento-uri de scadență | Intervale de întârziere; soldurile fișei sunt exact resturile de pe documente |
| 5.7 | Rapoarte (vânzări, cheltuieli, cost mărfuri, rezultat simplu, stoc valoric) și export | Refăcute din istoric; exportul e recitit celulă cu celulă |
| 5.8 | Audit: verificare de consistență (7 reguli) și jurnal | 0 probleme după 1.000 de operații aleatoare |

## Ce a costat
- **Mărimea:** fără schimbări notabile față de Etapa 4. Etapa nu a adus biblioteci noi; PDF-ul facturii folosește Typst, care era deja în aplicație.
- **Viteza** (modul optimizat), după aproape 800 de operații: o recepție durează sub 1 ms, iar afișarea stocului ~6 ms. Fiecare calcul se reface din tot istoricul, așa că timpul crește odată cu volumul. La zeci de mii de mișcări pe an trebuie folosite indexurile din Etapa 2 pe produs și depozit. Notat ca lucru de făcut când apar date reale.

## Ce NU e făcut sau dovedit (sincer)
- **Nu e contabilitate:** fără plan de conturi, note contabile, balanță, declarații, e-Factura (ANAF), SAF-T, salarii sau amortizări. Pentru acestea e nevoie de un contabil și de validare pe surse oficiale (D-052).
- **Cotele de TVA** (21%, 11%, 0%) sunt valori implicite; aplicația nu urmărește schimbările legislative. Confirmă-le cu contabilul.
- **Loturi și serii** (5.2b): amânate până apare un caz real.
- **O singură monedă (RON).** Alte valute ar cere curs pe document (D-049).
- **Facturile proforma, avizele de însoțire, NIR-ul tipărit și chitanța tipărită** nu au încă model PDF; are doar factura.
- **Datele firmei** apar de două ori: în „Documente și modele” și în setările de facturare din „Business”. Modulele nu își citesc datele unul altuia.
- **Extrase bancare:** formatul CSV e recunoscut după numele coloanelor (Data, Descriere/Detalii, Debit/Credit sau Sumă). Formatul fiecărei bănci românești trebuie încercat cu un extras real; datele scrise cu „/” nu sunt încă recunoscute.
- **Date reale:** nu încă. 🔒 Testul de pierdere a curentului (2.12) rămâne obligatoriu înainte de date reale ale firmei.
- **CI-ul pe GitHub** e oprit din cauza facturării contului (de la pasul 4.7). Testele trec pe laptop.

## Ce s-a aflat pe drum
- **Testele cu exemple de mână au prins greșeli de gândire:**
  - un stoc minim ar fi trimis memento-uri pentru depozite în care produsul n-a intrat niciodată;
  - în modelul Typst, numele `v` ascundea funcția de spațiere (a doua oară; acum e notat).
- **Testele în fereastra reală depindeau de timp:** o listă încă neîncărcată, ziua săptămânii. Au fost făcute să aștepte ce trebuie.

## Decizii cerute proprietarului
| # | Decizie | Recomandare |
|---|---|---|
| D-049 … D-054 | Confirmi regulile Etapei 5: sume în bani întregi, cost mediu, istoric fără modificări (storno), delimitare față de contabilitate, un singur modul Business, facturi fără goluri? | Da |
| TVA | Confirmi cotele implicite 21%, 11%, 0% (sau le corectezi cu contabilul)? | Da, după o verificare cu contabilul |
| Poartă | Considerăm Etapa 5 încheiată și trecem la **Etapa 6 (Echipe și rețea)**? Atenție: Etapa 6 cere al doilea PC pentru testul S2.3 | Da. Pregătește un al doilea calculator pentru testul de rețea |
