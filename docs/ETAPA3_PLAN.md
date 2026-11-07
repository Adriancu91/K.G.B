# K.G.B. — Planul Etapei 3: Documente și foi de calcul

**Data:** 7 nov. 2026 · **Statut:** ÎN LUCRU. Etapa a fost aprobată de proprietar (D-031); deciziile noi apar mai jos ca PROPUSE.
**Sursa:** Master Plan §3.2 (PDF/Excel evaluate separat), §6.1–6.4, §13 (Etapa 3); Metaprompt §4.1 (fără DB, nici ascunse în biblioteci), §10 (dependențe justificate și licențe verificate).

## Ce cere Master Plan-ul
PDF, foi de calcul, șabloane, import/export, extragere inițială de date.

**Poarta:** scenarii reale și un set de fișiere de test trec **fără coruperea documentelor**.

Criterii din catalog:
- §6.1: operațiile de bază nu deteriorează conținutul sau structura documentelor. Operațiile destructive au previzualizare și copie de siguranță.
- §6.2: compatibilitatea Excel se testează pe fișiere reale. Nu promitem compatibilitate completă fără teste.
- §6.3: șabloanele originale sunt protejate, iar formulele sunt documentate și testate.
- §6.4: nimic incert nu se importă în tăcere. Utilizatorul corectează înainte de import.

## Punct de plecare
- Din Etapa 2 există: fișiere atașate pentru module (`files.own`, BLAKE3 la citire), interogări, scheme, indexuri, backup.
- Nu există încă nicio bibliotecă PDF sau de foi de calcul. Alegerea lor este decizia riscantă a etapei, așa că o testăm întâi separat (spike-uri, ca în Etapa 0).

## Reguli pentru biblioteci (Metaprompt §4.1, §10)
- Se acceptă **doar licențe permisive** (MIT, Apache-2.0, BSD, Zlib), verificate pe versiunea exactă și cu `cargo-deny`.
- Se respinge orice bibliotecă care folosește intern un motor de baze de date.
- **AGPL/GPL** (de exemplu MuPDF, Ghostscript) se resping fără aprobare juridică (Master Plan §12.3).
- Bibliotecile care cer **programe sau DLL-uri externe descărcate separat** (pdfium, Tesseract) sunt 🔒: le propun, dar nu le descarc fără acordul proprietarului.
- O alegere permisivă, făcută pe baza măsurătorilor, se aplică (ca D-028) și se confirmă la poartă.

## Pași
| Pas | Ce | Criteriu de acceptare |
|---|---|---|
| 3.1 | Set de fișiere de test `testdata/etapa3/`: PDF-uri și foi de calcul generate cu mai multe programe disponibile local (text, tabele, imagini, mai multe pagini, rotite, formulare, diacritice, fișiere mari, fișiere stricate), plus un manifest cu hash-uri | Fișiere și manifest în repo; nimic personal sau al firmei |
| 3.2 | **Spike S4 — PDF**: candidați `lopdf` (MIT), `pdf` (MIT), pdf.js (Apache-2.0, afișare în fereastră); pdfium și MuPDF doar documentați. Măsurăm: deschidere, unire, separare, extragere/rotire pagini, extragere text, pe setul 3.1 | Raport `docs/spikes/S4_REZULTATE.md`; după fiecare operație: originalul neschimbat (hash), rezultatul se redeschide, numărul paginilor și textul se păstrează → **D-032** |
| 3.3 | **Spike S5 — foi de calcul**: candidați `calamine` (citire), `rust_xlsxwriter` (scriere), `umya-spreadsheet` (citire + scriere), IronCalc (motor de formule). Măsurăm: fidelitate la deschidere → salvare (valori, formule, formate, foi multiple), formule uzuale, CSV, 100k rânduri | Raport `docs/spikes/S5_REZULTATE.md` → **D-033** |
| 3.4 | Documente versionate în spațiul de lucru (D-034): import ca fișier atașat, metadate în colecție cu schemă, fiecare salvare = versiune nouă, istoricul versiunilor, export ca **copie** | Teste: originalul rămâne identic (hash), oprire forțată în timpul salvării → nicio versiune pe jumătate |
| 3.5 | Modulul **PDF** (beta): afișare, unire, separare, extragere și rotire de pagini, extragere text. Rezultatul e un document nou, cu previzualizare înainte de confirmare | Teste pe setul 3.1 + e2e în fereastră |
| 3.6 | Modulul **Foi de calcul** (beta): deschidere XLSX/CSV, grilă cu derulare rapidă, editare, formule uzuale, salvare ca versiune nouă, export XLSX/CSV | Teste de fidelitate pe setul 3.1; 100k rânduri utilizabile; e2e |
| 3.7 | **Șabloane** (D-036): bibliotecă cu originale doar de citire, „Folosește” creează o copie. Primele șabloane: buget, factură, registru de casă, cost/km, rate credit, cu formulele documentate și testate | Teste: copia editată nu atinge originalul; formulele verificate cu valori calculate de mână |
| 3.8 | Import/export: CSV, XLSX, PDF, prin dialogul sistemului, doar în folderul ales de utilizator | Teste: diacritice, separatori, codificări; fișierele stricate sunt refuzate clar, fără blocare |
| 3.9 | **Extragere inițială de date** (§6.4) din PDF-uri cu text și din foi de calcul: câmpuri, sursă și poziție, scor de încredere, validare de către utilizator, import jurnalizat. OCR evaluat separat (D-035) | Teste: valorile incerte nu se importă fără confirmare; fiecare import apare în jurnal |
| 3.10 | Test de necorupere pe tot setul + fișiere stricate intenționat (trunchiate, octeți schimbați): aplicația refuză clar și nu se oprește | Raport de rezultate |
| 3.11 | 🔒 Fișiere reale, fără date confidențiale, primite de la proprietar | Cere proprietarul |
| 3.12 | Raport `docs/ETAPA3_RAPORT.md` | — |
| 3.13 | 🔒 Poarta Etapei 3 | Aprobarea proprietarului |

## Decizii propuse
| ID | Decizie | Recomandare |
|---|---|---|
| D-032 | Biblioteca PDF | **După spike-ul S4.** Preferință: bibliotecă Rust permisivă pentru operații + pdf.js pentru afișare, fără DLL-uri externe |
| D-033 | Biblioteca pentru foi de calcul | **După spike-ul S5.** Preferință: o singură bibliotecă pentru citire și scriere, care păstrează ce nu înțelege |
| D-034 | Documentele nu se suprascriu niciodată: versiuni noi, originalul importat neatins, export ca copie | Da: e chiar criteriul §6.1 „preview și copie de siguranță” |
| D-035 | OCR | Se evaluează în spike-ul S4. Dacă cere Tesseract/DLL-uri externe → 🔒, decide proprietarul; altfel intră în Etapa 3 doar dacă e testat |
| D-036 | Șabloanele originale sunt doar de citire; utilizatorul lucrează pe o copie | Da: Master Plan §6.3 |

## Riscuri
- **Fidelitatea XLSX:** majoritatea bibliotecilor pierd la salvare ce nu înțeleg (grafice, formatare condiționată, macro-uri). Măsurăm exact ce se pierde. Dacă se pierde ceva, aplicația avertizează înainte de salvare și nu promite compatibilitate completă.
- **Fișierele PDF stricate sau ostile** pot bloca sau umple memoria. Folosim limite de mărime, timp și memorie, iar parsarea are teste cu fișiere stricate.
- **Mărimea installerului** crește cu pdf.js (~3–4 MB). Măsurăm.
- **Lipsa fișierelor reale:** setul generat nu acoperă tot ce produc Excel și scanerele. De aceea pasul 3.11 rămâne 🔒 și e cerut proprietarului.
