# K.G.B. — Etapa 3 (Documente și foi de calcul): raport și propunere de poartă

**Data:** 7 nov. 2026 · **Statut:** **APROBAT** de proprietar (D-041, „Aprob”). Pasul 3.11 a fost făcut după aprobare, pe fișierele trimise atunci.
**Poarta cerută de Master Plan §13:** „scenarii reale și set de fișiere de test trec fără coruperea documentelor”.
**Plan:** `docs/ETAPA3_PLAN.md` · **Necorupere:** `docs/etapa3/NECORUPERE.md` · **Șabloane:** `docs/etapa3/SABLOANE.md`

## Pe scurt
| Cerință | Rezultat |
|---|---|
| **PDF** | Modulul „Documente PDF” (beta): afișare, miniaturi, rotire, scoatere, extragere și unire de pagini, versiuni, export |
| **Foi de calcul** | Modulul „Foi de calcul” (beta): deschide XLSX/XLSM/XLS/XLSB/ODS/CSV, editează XLSX cu formule recalculate, o foaie de 100.000 de rânduri se deschide în ~0,6 s |
| **Șabloane** | 5 șabloane (buget, factură, registru de casă, cost/km, rate credit), cu formule verificate prin calcule de mână |
| **Import/export** | Dialogurile Windows; export CSV în stil românesc sau standard; conversie în .xlsx editabil |
| **Extragere inițială de date** | Modulul „Extragere date” (beta): facturi din PDF cu text și din foi de calcul, cu sursă, nivel de încredere, confirmare obligatorie și jurnal |
| **Fără coruperea documentelor** | **189 de fișiere** (27 proprii și 162 reale) și **905 variante stricate intenționat**: **0 originale modificate, 0 opriri ale aplicației** |

**Teste:**
- 147 de teste automate, iar CI-ul pe GitHub e verde la fiecare pas;
- 5 scenarii în fereastra reală, toate trecute:

| Scenariu | Verificări trecute |
|---|---|
| Foi de calcul | 23/23 |
| PDF | 20/20 |
| Extragere | 8/8 |
| Poarta Etapei 1 | 15/15 |
| Backup | 8/8 |

## Ce s-a construit
| Pas | Ce | Rezultat |
|---|---|---|
| 3.1 | Set de fișiere de test (`testdata/etapa3`) | 35 de fișiere generate fără bibliotecile evaluate; plus 161 de fișiere publice reale copiate doar în citire din corpusul suitei proprietarului (D-037) |
| 3.2 | Spike S4: biblioteci PDF → D-032 | lopdf (operații), pdf.js (afișare), hayro (miniaturi), plus o **verificare strictă proprie**. Bibliotecile „repară” în tăcere PDF-urile stricate (R18) |
| 3.3 | Spike S5: foi de calcul → D-033 | calamine (citire), umya (salvare), IronCalc (formule: 95,9% la fel ca Excel), rust_xlsxwriter (export), plus protecție anti-„bombă zip” |
| 3.4 | Documente versionate (D-034) | Originalul importat nu se schimbă niciodată; fiecare salvare e o versiune nouă. Verificat cu 25 de opriri forțate |
| 3.5 | Modulul PDF | Previzualizare înainte de orice schimbare; rezultatul e verificat înainte de salvare (paginile și textul fiecărei pagini) |
| 3.6 | Modulul Foi de calcul | Înainte de salvare arată ce s-ar pierde (grafice, imagini) și ce formule nu pot fi recalculate sigur (D-039) |
| 3.7 | Șabloane (D-036) | Originalele sunt în cod; „Folosește” creează o copie |
| 3.8 | Import/export | Rezultatul fiecărei conversii e recitit și comparat celulă cu celulă |
| 3.9 | Extragere de date (D-040) | Sursă, încredere și verificări independente (total = net + TVA, CUI, dată reală). Tot ce nu e „sigur” se confirmă |
| 3.10 | Test de necorupere | Vezi mai sus. Nucleul prinde orice oprire neașteptată a unui modul; arhivele Excel/ODS sunt verificate CRC pe toate părțile |

## 3.11 — Fișierele reale ale proprietarului (după aprobare)
**Ce a trimis proprietarul:**
- 1 PDF de tranzacție bancară;
- 4 registre Excel, făcute cu Microsoft Excel, Excel pe Android și un program .NET;
- 5 poze ale unor documente: carte de vizită, extras bancar pe telefon, tabel, borderou de achiziții, fotografie.

Fișierele conțin date reale și personale: sunt păstrate doar local (`testdata/proprietar/`, ignorat de Git), iar aici apar doar cifre. Testul este `modules/kgb-extract/tests/proprietar.rs`.

| Fișier | Rezultat |
|---|---|
| PDF de tranzacție | intact, 1 pagină; rotirea a fost salvată și verificată; nu e factură, deci extragerea nu găsește câmpuri de factură (corect) |
| Catalog (5 foi, ~7.000 de celule, scris de un program .NET) | **Problemă găsită și corectată:** biblioteca de salvare vedea **0 foi**. Modulul refuza salvarea, deci nu se pierdea nimic. Cauza: XML cu prefix de spațiu de nume (`<x:sheet>`) și legături interne cu căi absolute, ambele valide. Acum fișierul e adus la forma obișnuită înainte de editare și se salvează **fără nicio pierdere** |
| Prețuri (Excel) | Editat fără pierderi. Alarma inițială „formate de număr pierdute” era falsă: erau formatele standard ale Excel, redeclarate explicit. Acum se compară doar formatele proprii |
| Plăți (Excel Android), registrul 2026 (Excel) | Editate fără pierderi |
| **Formule** | **226 din 226 dau exact rezultatul din Excel (100%)** |
| Originale | Identice octet cu octet după toate operațiile |
| Poze (5) | Formatul nu e acceptat: cer OCR (D-035), care nu face parte din Etapa 3. Borderoul și extrasul bancar arată ce trebuie să știe să citească modulele de business (Etapa 5) |

## Ce a costat
- **Mărimea installerului:** 2,1 MB → 7,9 MB. Programul: 9 → 28 MB. Vin din bibliotecile de documente (R20).
- **O dependență beta:** umya 4.0.0-beta.1, fixată exact. Versiunea stabilă 3.1 depindea de o bibliotecă zip cu vulnerabilități; beta-ul dă aceleași rezultate.
- **Lărgirea minimă a politicii de securitate a ferestrei** (D-038), doar pentru pdf.js: lucrătorul propriu și WebAssembly. `eval` și rețeaua rămân interzise.

## Ce NU e făcut sau dovedit (sincer)
- 🔒 **Fișierele reale ale proprietarului** (3.11) nu sunt testate încă. Compatibilitatea cu fișiere produse de Excel e verificată pe 63 de fișiere publice, nu pe fișierele firmei.
- **OCR** (PDF-uri scanate): testat (tesseract.js + română, D-035). Textul iese bine, tabelele slab. **Nu e în aplicație.** PDF-urile scanate sunt refuzate clar la extragere.
- **Stricăciunile din formatele fără sume de control** (CSV, PDF, XLS vechi) nu pot fi detectate de niciun program. K.G.B. păstrează originalul cum a fost primit și nu înrăutățește nimic (`docs/etapa3/NECORUPERE.md`).
- **Foi de calcul:**
  - Formulele se scriu cu nume englezești (`SUM`, nu `SUMĂ`).
  - Coloanele au lățime fixă, iar formatarea (culori, formate de număr) nu se afișează.
  - Se văd cel mult primele 100 de coloane.
  - Nu există grafice.
  - Calculul nu acoperă numele definite, `XLOOKUP` și formulele pe mai multe foi. Aceste formule sunt marcate, nu inventate.
- **Ce se pierde la salvarea unui XLSX** (graficele noi, imaginile din celule, o parte din tabelele pivot) e anunțat înainte de salvare; utilizatorul confirmă sau renunță.
- **PDF:**
  - Fără editare de text, formulare, semnare sau redactare. Acestea sunt funcții din Master Plan §6.1 pentru etape viitoare.
  - Fără reparare automată a PDF-urilor stricate (D-032).
- **Șabloane:** doar 5 din categoriile cerute de §6.3. Restul (cash-flow, stocuri, HR, construcții…) rămân de făcut.
- **Extragere:** doar facturi (antet și totaluri), fără liniile de produse. Extrasele, contractele și pontajele nu sunt făcute.
- **Testele în fereastra reală rulează doar pe laptop**, nu în CI.

## Ce s-a aflat pe drum
- **R15 (erori trecătoare de compilare):** cauza e **memoria virtuală plină**, nu Defender. `ctfmon.exe` (serviciul Windows de introducere a textului) ocupă 7,3 GB din 26 oct. O repornire a laptopului îl rezolvă.
- **Teste care au prins greșeli reale:**
  - IronCalc a găsit 3 greșeli în propriul nostru fișier de test;
  - testul pe corpus a găsit o oprire a bibliotecii calamine și o tăiere greșită a textului cu diacritice;
  - testul de necorupere a arătat că bibliotecile nu verifică sumele de control ale tuturor părților unui XLSX.

  Toate au fost corectate.

## Decizii cerute proprietarului
| # | Decizie | Recomandare |
|---|---|---|
| D-032 … D-040 | Confirmi alegerile Etapei 3 (bibliotecile, versiunile documentelor, regula de recalculare, extragerea cu confirmare)? | Da |
| 3.11 | Trimiți câteva fișiere reale, fără date confidențiale (facturi PDF, tabele Excel ale firmei), pentru o verificare finală? | Da. Se poate face și în paralel cu Etapa 4 |
| D-035 | OCR în română (tesseract.js, ~6 MB în plus în installer) într-o etapă următoare? | Da, cu confirmarea fiecărei valori, la Extragere date |
| Poartă | Considerăm Etapa 3 încheiată și trecem la **Etapa 4 (Organizare și productivitate: planner, taskuri, notificări, bibliotecă de documente, formulare)**? | Da |
