# Set de fișiere de test — Etapa 3

Folosit de spike-urile S4 (PDF) și S5 (foi de calcul) și de testele de necorupere ale modulelor.

**Nu conține date personale sau ale firmei.** Toate datele sunt fictive.

## Cum se obține
```
python testdata/etapa3/generate.py           # regenerează files/ și large/ + MANIFEST.json
python testdata/etapa3/generate.py --check   # verifică hash-urile
powershell -File testdata/etapa3/validate-windows-pdf.ps1
```
- `files/` (~0,6 MB) se publică în repo.
- `large/` (~7 MB) nu se publică; se regenerează identic, octet cu octet. Conține:
  - un PDF de 500 de pagini;
  - un XLSX și un CSV cu 100.000 de rânduri;
  - o „bombă zip” de 200 MB după dezarhivare.

## Ce conține
| Tip | Fișiere | Producător |
|---|---|---|
| PDF valide | 1 pagină; 50 de pagini; pagini rotite și de formate diferite; actualizare incrementală; PDF 1.5 cu obiecte și xref comprimate; formular; imagine; semne de carte, legături, metadate | `generate.py` (PDF scris de mână, doar biblioteca standard) |
| PDF reale | factură cu diacritice românești și tabel; raport cu grafic vectorial pe 2 pagini | Microsoft Edge (`--print-to-pdf`, motorul Skia) — fonturi încorporate |
| PDF stricate | trunchiat, octeți alterați, xref greșit (recuperabil), nu e PDF, gol, imbricare de 200.000 de niveluri | `generate.py` |
| XLSX valide | simplu; diacritice și foi multiple cu referințe între foi; 13 formule uzuale cu valori în cache; formate (dată, lei, procent, celule unite, panou înghețat, lățimi); funcții care se pierd ușor (formatare condiționată, validare, legătură, nume definit); tipuri de celule (inline, bool, eroare, spații, rânduri noi) | `generate.py` (structura pe care o scrie Excel) |
| XLSX stricate | trunchiat, nu e ZIP, ZIP fără registru, CRC-uri greșite | `generate.py` |
| CSV | UTF-8 cu BOM; „;” cu virgulă zecimală românească; Windows-1250; ghilimele și text pe mai multe rânduri; rânduri inegale | `generate.py` |

`MANIFEST.json` notează pentru fiecare fișier ce trebuie să citească un program corect: pagini, text, celule, formule, formate, sau că fișierul trebuie refuzat (`broken`).

## Verificare independentă (7 nov. 2026)
- **Cititorul PDF inclus în Windows** (`Windows.Data.Pdf`):
  - deschide toate PDF-urile valide cu numărul de pagini din manifest, inclusiv pe cel de 500 de pagini;
  - refuză toate PDF-urile stricate;
  - recuperează fișierul cu xref greșit (10 pagini), cum se aștepta.
- **XLSX:** arhivele ZIP și toate părțile XML sunt corecte, iar cele stricate sunt refuzate.

## Limite
- Pe laptop nu există Microsoft Excel sau LibreOffice, deci XLSX-urile **nu sunt verificate în Excel**. Fișierele reale de la proprietar (pasul 🔒 3.11) acoperă acest gol.
- **Lipsesc:** PDF-uri scanate (pentru OCR), PDF-uri criptate și fișiere XLS vechi.

## Corpus extern (nepublicat)
`python testdata/etapa3/extern.py` copiază **doar în citire** fișierele publice de test din corpusul suitei de birou a proprietarului (`Desktop/workspace/test-corpus`, D-037) în `extern/` (ignorat de Git).

Conține 161 de fișiere: 48 PDF, 63 XLSX, 32 ODS, 13 CSV, 2 XLS, 2 XLSM, 1 XLSB. Proveniența fiecărui fișier e în `extern/MANIFEST.json`:
- Apache POI;
- LibreOffice;
- pdf.js;
- Apache Commons CSV;
- XlsxWriter;
- formulare publice ANAF.

Fișierele nu se publică în acest repo, pentru că au licențe diferite.
