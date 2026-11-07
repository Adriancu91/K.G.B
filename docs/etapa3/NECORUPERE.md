# Testul de necorupere (Etapa 3, pasul 3.10)

**Poarta Etapei 3 (Master Plan §13):** „scenarii reale și set de fișiere de test trec fără coruperea documentelor”.
**Test:** `modules/kgb-extract/tests/necorupere.rs`. Rulează prin modulele reale (PDF, Foi de calcul, Extragere date), ca în aplicație.
**Rulat local:** 7 nov. 2026, în varianta release, pe setul propriu și pe corpusul extern (`python testdata/etapa3/extern.py`). În CI rulează doar pe setul propriu, pentru că fișierele corpusului nu sunt publicate.

## Ce se verifică pentru fiecare fișier
1. **Fișierul de pe disc nu se schimbă niciodată:** SHA-256 identic înainte și după.
2. **Originalul importat** (versiunea 1) se păstrează octet cu octet.
3. **O operație reală:**
   - PDF: rotirea unei pagini;
   - XLSX: modificarea unei celule;
   - celelalte formate: conversia în .xlsx.

   Operația fie e refuzată, fie salvează o versiune nouă **verificată**, iar versiunea 1 rămâne identică.
4. **Extragerea de date** rulează pe același fișier fără să oprească programul.
5. **Cinci variante stricate intenționat:**
   - tăiat la 10%, 50% și 90%;
   - 8 octeți schimbați;
   - mijlocul fișierului șters (zerouri).

   Fiecare trebuie refuzată clar sau deschisă cum a fost primită, niciodată „reparată” în tăcere și niciodată cu oprirea aplicației.

## Rezultat (189 de fișiere, 905 variante stricate)
| | Număr |
|---|---|
| Fișiere testate | **189**: 27 din setul propriu și 162 reale din corpus (PDF, XLSX, XLSM, XLS, ODS, CSV) |
| Importate | 173. Celelalte **16 refuzate clar**: stricate, protejate cu parolă, bombă zip, PDF fără text la extragere |
| Operații salvate și verificate | 159. Alte 14 au fost refuzate, pentru că erau PDF-uri criptate sau deteriorate, doar pentru citire |
| **Originale modificate** | **0**: fișierele de pe disc și versiunile 1 sunt identice octet cu octet |
| Variante stricate refuzate clar | 533 |
| Variante deschise doar pentru citire | 230 |
| Variante deschise și modificate (rezultat verificat) | 142 (vezi mai jos) |
| **Opriri ale aplicației** | **0**. Erori interne prinse de nucleu: 0 |

## Ce a schimbat acest pas
- **Nucleul prinde orice oprire neașteptată a unui modul.** O bibliotecă care cade pe un fișier ostil produce un mesaj și o intrare în jurnalul de audit, nu închiderea aplicației. Scrierile sunt atomice, deci nu rămâne nimic pe jumătate. Test: `crates/kgb-core/tests/module_panic.rs`.
- **Verificarea CRC a tuturor părților arhivelor XLSX/XLSM/ODS.** Bibliotecile verificau doar părțile citite efectiv. Înainte, 20 de variante XLSX/ODS cu octeți schimbați într-o imagine sau într-un stil erau acceptate și ar fi putut ajunge într-o versiune salvată. **Acum sunt refuzate toate.**

## Ce nu poate fi detectat (sincer)
Cele 142 de variante deschise și modificate sunt numai din formate **fără sume de control**:

| Format | Variante | De ce |
|---|---|---|
| CSV | 60 | Un CSV tăiat sau cu un caracter schimbat este tot un CSV valid. Formatul nu are cum să arate stricăciunea |
| PDF | 80 | PDF-ul nu are sume de control. Zerourile sau octeții schimbați în datele unei imagini sau ale unui text păstrează structura validă: tabelele xref, lungimile și fluxurile comprimate trec toate verificările. Niciun cititor nu le poate deosebi de un fișier întreg |
| XLS (format vechi) | 2 | Formatul binar vechi nu are sume de control pe date |

**Ce garantează K.G.B. și în aceste cazuri:**
- fișierul primit e păstrat exact cum a fost primit;
- fiecare operație lucrează pe o copie;
- rezultatul e verificat față de ce s-a putut citi: aceleași pagini, același text pe fiecare pagină, aceleași celule.

K.G.B. **nu înrăutățește** niciodată un document. Nu poate însă ghici că un fișier a fost deja stricat înainte să ajungă la el, dacă formatul nu păstrează nicio urmă.

## Cum se repetă
```
python testdata/etapa3/generate.py     # fișierele mari (opțional)
python testdata/etapa3/extern.py       # corpusul extern (opțional, doar local)
cargo test -p kgb-extract --test necorupere --release -- --nocapture
```
