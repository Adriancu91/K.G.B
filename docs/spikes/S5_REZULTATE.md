# Spike S5 — foi de calcul (Etapa 3, pasul 3.3)

**Data:** 7 nov. 2026 · **Cod:** `spikes/s5-sheets` (prototip, nu se distribuie)
**Fișiere de test:**
- setul propriu `testdata/etapa3`: 10 XLSX, inclusiv 4 stricate, plus 100k rânduri și o bombă zip;
- **corpusul extern**: 63 XLSX, 32 ODS, 2 XLS, 2 XLSM și 1 XLSB, fișiere reale produse de Excel, LibreOffice și alte programe. Sursele sunt Apache POI, LibreOffice și XlsxWriter, copiate doar în citire din corpusul suitei proprietarului (D-037).

**Întrebarea:** ce bibliotecă folosim pentru foi de calcul (D-033), fără să stricăm fișierele utilizatorului?

## Candidați
| Bibliotecă | Versiune | Licență | Ce face |
|---|---|---|---|
| **calamine** | 0.38.0 | MIT | doar citire: XLSX, XLSM, XLSB, XLS, ODS |
| **umya-spreadsheet** | 3.1.1 → **4.0.0-beta.1** | MIT | citire + scriere XLSX, păstrând structura |
| **IronCalc** | 0.9.1 | MIT OR Apache-2.0 | motor de formule + citire/scriere XLSX |
| **rust_xlsxwriter** | 0.102.0 | MIT OR Apache-2.0 | doar scriere (fișiere noi, exporturi) |

**Dependențe:** 148 de crate-uri, toate permisive, **niciun motor de baze de date**. O bibliotecă bzip2 (licență „bzip2-1.0.6”) venea doar din opțiunile implicite ale `zip` folosit direct de spike; le-am oprit, pentru că XLSX folosește doar deflate.

**Observație din suita proprietarului:** aceasta folosește SheetJS (Apache-2.0) în JavaScript și sql.js. sql.js este SQLite, deci nu e permis în K.G.B. (D-005/D-018) și nu îl preluăm.

**De ce versiunea beta a umya:**
- umya 3.1.1 depinde de `zip` 8.6, care are 4 vulnerabilități publicate (RUSTSEC-2026-0367/0368/0369/0429). CI (`cargo-deny`) a oprit build-ul.
- Toate vulnerabilitățile sunt în funcția `ZipArchive::extract` (dezarhivare pe disc), pe care umya nu o apelează (verificat în sursă). Totuși, nu ascundem vulnerabilități în CI.
- umya 4.0.0-beta.1 folosește `zip` 9, versiunea corectată. Testul de salvare a fost repetat cu 4.0.0-beta.1 și **dă aceleași rezultate**:
  - setul propriu: 6/6 identice;
  - corpusul: aceleași pierderi;
  - aceleași 2 fișiere ostile o prăbușesc.
- **Risc:** e o versiune beta. Înainte de modulul Foi de calcul (3.6) verificăm dacă a apărut 4.0 stabilă. Altfel rămânem pe beta, fixată exact (`=4.0.0-beta.1`).

## 1. Citire
**Setul propriu.** Toate trei bibliotecile citesc corect toate valorile din manifest și refuză cele 4 fișiere stricate.

| | calamine | umya | IronCalc |
|---|---|---|---|
| 100k rânduri × 6 coloane (600k celule) | **0,98 s / 150 MB** | 2,17 s / 239 MB | 1,55 s / **69 MB** |
| Bomba zip (200 MB după dezarhivare) | încarcă tot: 272 MB | încarcă tot: **625 MB** | încarcă tot: 272 MB |

**Corpusul extern** (fiecare fișier într-un proces separat):

| | calamine | umya | IronCalc |
|---|---|---|---|
| XLSX deschise | 57/63 | 58/63 | 53/63 |
| ODS / XLS / XLSB | 28/31 · 2/2 · 0/1 | — | — |
| Prăbușiri sau blocaje | **0 la XLSX**; 1 panică pe XLSB | **2** (bomba XML, șiruri ostile → oprire forțată a procesului) | **2** (o panică, un blocaj peste 120 s) |
| Fișiere refuzate pe drept | protejat cu parolă, ZIP-uri stricate, bombă XML | la fel, dar unele prin prăbușire | la fel |

**Concluzie:**
- **calamine** e cel mai sigur și cel mai rapid pentru citire și singurul care citește ODS/XLS.
- **umya** citește greșit, fără eroare, un fișier în format „strict OOXML”: îl deschide gol.

## 2. Deschidere → salvare: ce se pierde
Comanda: `s5 rt`, pe 65 de fișiere. Rezultatul e recitit cu calamine, ca cititor independent, și comparat celulă cu celulă (valori salvate și formule). Se compară și elementele care se pierd ușor: grafice, imagini, pivot, validare, formatare condiționată, legături, nume definite, celule unite, formate de număr, filtre, protecție, macro.

| | umya | IronCalc |
|---|---|---|
| Salvate | **65/65** | 60/65 |
| Valori + formule identice | **61/65** | 40/65 |
| Fără niciun element pierdut | **38/65** | 21/65 |
| Setul propriu (6 fișiere valide) | **6/6 identice**, inclusiv formatare condiționată, validare, legătură, nume definit, celule unite, panou înghețat | pierde validarea; taie spațiile de la capetele textului |
| Ce se pierde (în câte fișiere) | grafice noi de tip cascadă, pâlnie, sunburst, histogramă (11); imagini, inclusiv cele din celule (11); legături către alte fișiere (2); pivot parțial (3); unele formate de număr (4) | desene (21), grafice (13), imagini (8), validare, comentarii, pivot, tabele, macro |
| Originalul | **neatins în toate cazurile** (SHA-256) | neatins |

**Concluzie:**
- **Nicio bibliotecă nu salvează orice fișier fără pierderi.** umya e cea mai bună, dar pierde graficele noi și imaginile din celule.
- De aceea, K.G.B. trebuie să **compare fișierul înainte și după salvare**, cu aceeași verificare ca în spike. Apoi:
  - dacă s-ar pierde ceva, spune exact ce, înainte de salvare;
  - salvează mereu ca **versiune nouă** (D-034), cu originalul păstrat.
- Fișierele „strict OOXML” sunt detectate și deschise doar pentru citire.

## 3. Formule: IronCalc recalculează, comparăm cu valorile salvate de Excel
Comanda: `s5 calc`. Pentru fiecare formulă, valoarea salvată în fișier (calculată de Excel sau LibreOffice) este comparată cu rezultatul recalculat de IronCalc.

| | Rezultat |
|---|---|
| Formule verificate | 2.577 în 61 de fișiere |
| Același rezultat | **2.209 (85,7%)** |
| Fără cele 2 fișiere care testează funcția `TEXT` cu sute de formate | **95,9%** (2.116 din 2.207) |
| Setul propriu (`formule.xlsx`, 12 formule uzuale: SUM, AVERAGE, IF, ROUND, VLOOKUP, SUMIF, COUNTIF, PMT, …) | **12/12** |
| Calcul | sub 7 ms pentru 1.295 de formule |

**Bonus: IronCalc a găsit 3 greșeli în propriul nostru fișier de test**, toate corectate:
- o formulă `ROUND` aplicată unui text;
- un `IF` cu valoarea salvată calculată din altă celulă;
- rotunjirea lui 14,35, unde Python dă 14,3, iar programele de calcul dau 14,4.

**Ce nu calculează încă la fel:**
- formatarea cu `TEXT(...)` pentru multe formate de dată și număr;
- referințe pe mai multe foi (`SUM(Sheet1:Sheet3!A1)`);
- **nume definite** (`#NAME?`);
- `XLOOKUP`;
- conversii-limită (text în `STDEV`/`VAR`, `YEAR(0)`).

**Regulă:** când rezultatul IronCalc diferă de cel salvat în fișier, K.G.B. **arată valoarea salvată și marchează celula**. Nu suprascrie în tăcere valoarea calculată de alt program.

## 4. Scriere de fișiere noi
- rust_xlsxwriter: 100.000 de rânduri cu 2 formule pe rând în **0,47 s**, 3,2 MB, 122 MB memorie.
- **Atenție:** scrie formulele **fără rezultat** (calamine citește 0). Exporturile K.G.B. trebuie să scrie și rezultatul calculat (`set_result`), altfel programele care nu recalculează arată 0.

## 5. Protecție proprie la deschidere
Bibliotecile încarcă orice „bombă zip” fără limită. Spike-ul conține o verificare **înainte** de a da fișierul bibliotecii (`s5 guard`):
- mărimea totală după dezarhivare, maximum 256 MB;
- raportul de comprimare pe fiecare parte (peste 200× și peste 16 MB = refuz).

**Rezultat:**
- bomba e refuzată („comprimat de 1028×”);
- toate cele 66 de fișiere valide (setul propriu + corpus + 100k rânduri) sunt acceptate;
- ZIP-urile stricate sunt refuzate.

**Limită:** un fișier protejat cu parolă (format OLE criptat) apare ca „nu e o arhivă validă”. Mesajul trebuie să spună „protejat cu parolă”.

## Decizia propusă (D-033)
| Rol | Alegere | De ce |
|---|---|---|
| Citire / import (XLSX, XLSM, XLS, ODS) | **calamine 0.38** | 0 prăbușiri pe XLSX, cel mai rapid, singurul cu ODS/XLS |
| Editare și salvare XLSX | **umya-spreadsheet 4.0.0-beta.1** (fixată exact; 3.1 avea `zip` vulnerabil) + **comparație înainte/după** + salvare ca versiune nouă | păstrează cel mai mult (61/65 valori identice, 6/6 pe setul propriu); pierderile rămase sunt detectate și anunțate |
| Calculul formulelor | **IronCalc 0.9** | 95,9% identic cu Excel pe formule obișnuite, 12/12 pe formulele uzuale; diferențele sunt marcate, nu ascunse |
| Fișiere noi / export | **rust_xlsxwriter 0.102**, cu rezultatele formulelor scrise | rapid, corect |
| Siguranță | verificare proprie (mărime, raport de comprimare) + fiecare fișier necunoscut deschis întâi în proces separat | umya și IronCalc pot prăbuși procesul pe fișiere ostile |
| Respinse | SheetJS (JavaScript; logica rămâne în Rust), sql.js (SQLite, interzis) | — |

**Riscul principal (R19):** umya și IronCalc se pot prăbuși pe fișiere ostile. Regulă pentru modulul Foi de calcul (3.6):
- prima deschidere a unui fișier primit din afară se face cu **calamine**, după verificarea proprie;
- umya și IronCalc primesc doar fișiere care au trecut de acești pași.
- Se măsoară dacă e nevoie de un proces separat pentru import.

## Cum se reproduce
```
python testdata/etapa3/extern.py        # corpusul extern (doar citire)
cd spikes/s5-sheets && cargo build --release
target/release/kgb-sheets-spike.exe read  ../../testdata/etapa3
target/release/kgb-sheets-spike.exe rt    <folder cu .xlsx> <folder-ieșire>
target/release/kgb-sheets-spike.exe calc  <folder cu .xlsx>
target/release/kgb-sheets-spike.exe guard <folder>
target/release/kgb-sheets-spike.exe write <ieșire.xlsx> 100000
```
Rezultatele brute: `spikes/s5-sheets/read.txt`, `rt.txt`, `calc.txt`.
