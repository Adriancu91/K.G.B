# Spike S4 — biblioteci PDF (Etapa 3, pasul 3.2)

**Data:** 7 nov. 2026 · **Cod:** `spikes/s4-pdf` (prototip, nu se distribuie) · **Fișiere:** `testdata/etapa3` (17 PDF-uri, inclusiv 6 stricate sau ostile)
**Întrebarea:** ce bibliotecă PDF folosim (D-032), fără licențe copyleft, fără DLL-uri externe și fără să stricăm documente?

## Candidați
| Bibliotecă | Versiune | Licență | Ce face | Rezultat |
|---|---|---|---|---|
| **lopdf** | 0.47.0 | MIT | citește, modifică, salvează (operații) | **ales pentru operații** |
| pdf (pdf-rs) | 0.10.0 | MIT | doar citire | cititor strict, util ca a doua opinie în teste |
| pdf-extract | 0.12.1 | MIT | text (peste lopdf 0.42) | respins: spații false în text (vezi mai jos) |
| **hayro** | 0.9.0 | Apache-2.0 OR MIT | randare pagini în imagini, 100% Rust | **ales pentru miniaturi și comparații vizuale** |
| **pdf.js** (pdfjs-dist) | 6.4.299 | Apache-2.0 | afișare în fereastră, text | **ales pentru afișare** |
| pdfium (pdfium-render) | 0.9.5 | MIT/Apache + DLL PDFium | totul | doar documentat: cere un DLL extern descărcat separat (🔒) |
| MuPDF | 0.8.0 | **AGPL-3.0** | totul | respins (Master Plan §12.3) |

**Dependențe:** 182 de crate-uri în total, toate cu licențe permisive. Sunt MIT/Apache/BSD/Zlib/ISC și 4 cu Unicode-3.0, care e deja permisă în `deny.toml`. **Niciun motor de baze de date.**

Câteva fișiere incluse au licențe care trebuie respectate:
- **hayro** include fonturile standard din PDFium (BSD-3, cer atribuire) și profiluri de culoare CC0.
- **pdf.js** a fost ales în versiunea de acum o lună, nu în cea de acum 6 zile.

## 1. Citire: fiecare bibliotecă, fiecare fișier, în proces separat
Comanda: `s4 read`. Un fișier ostil care ar prăbuși programul ar opri doar procesul de test, nu și testul.

| Bibliotecă | Verdict corect | Text așteptat găsit | Prăbușiri | 500 de pagini | Memorie maximă |
|---|---|---|---|---|---|
| lopdf | 14/17 | 11/11 | 0 | 17 ms (cu tot textul) | 9 MB |
| pdf-rs | 16/17 | — | 0 | 11 ms | 7 MB |
| pdf-extract | 14/17 | 10/11 | 0 | 201 ms | 8 MB |
| hayro | 15/17 | — | 0 | 126 ms (randează 50 de pagini) | 10 MB |
| pdf.js (Node) | 16/17 | 11/11 | 0 | 69 ms | 88 MB (tot procesul Node) |

**Ce înseamnă „greșit” aici:**
- **Toate valide:** toate bibliotecile au deschis corect toate PDF-urile valide, inclusiv:
  - actualizarea incrementală (versiunea nouă, nu cea veche);
  - PDF 1.5 cu obiecte comprimate;
  - formularul;
  - fișierul de 500 de pagini;
  - PDF-urile reale din Edge.
- **Erorile apar doar la fișierele stricate.** Bibliotecile tolerante (lopdf, hayro, parțial pdf.js) „recuperează” **în tăcere** fișiere trunchiate sau alterate. De exemplu, lopdf raportează 10 pagini pentru un fișier tăiat la 60%. Pentru K.G.B. asta e periculos: utilizatorul ar crede că documentul e întreg.
- **Fișierul ostil** (200.000 de niveluri de imbricare) **nu a prăbușit nicio bibliotecă**.
- **pdf-extract** pune spații false în textul facturii din Edge („Data emi teri i : 0 7 . 1 1”). lopdf și pdf.js extrag textul corect, cu diacritice (ă, ș, ț cu virgulă).

## 2. Verificare strictă a integrității (propria noastră regulă)
Pentru că bibliotecile tolerante ascund stricăciunile, spike-ul conține o verificare strictă, `strict_check`, care trece doar dacă:
- antetul e `%PDF-`;
- fișierul se termină cu `%%EOF`;
- `startxref` indică un tabel xref real;
- fiecare intrare xref indică exact obiectul declarat, pe tot lanțul de revizii;
- toate fluxurile se decomprimă;
- documentul are cel puțin o pagină.

**Rezultat: 17/17 corect.** Toate fișierele valide trec (inclusiv cel cu revizii incrementale, xref comprimat și cele din Edge). Toate cele 6 stricate sunt refuzate, fiecare cu un motiv clar:
- „lipsește %%EOF la final (fișier trunchiat?)”;
- „obiectul 5 nu e la offsetul din xref”;
- „nu începe cu %PDF-”;
- „documentul nu are nicio pagină”.

## 3. Operații (lopdf) și verificarea de necorupere
Comanda: `s4 ops`. Pentru fiecare PDF valid: salvare fără modificări, rotire cu 90°, extragerea primei și ultimei pagini, separare pe pagini, apoi **unirea tuturor** într-un singur fișier.

Fiecare rezultat este redeschis de **trei cititori independenți**:
- **lopdf**: număr de pagini și rotiri;
- **pdf-rs**: număr de pagini;
- **pdf-extract**: textul fiecărei pagini.

Apoi, **randarea hayro** a paginilor din rezultat este comparată pixel cu pixel cu originalul (hash pe imagine).

| Rezultat | Valoare |
|---|---|
| Operații | 49 |
| Corecte | 48 |
| Singurul „eșec” | fișierul cu xref greșit: cititorul strict pdf-rs refuză originalul, deci nu are referință (corect) |
| Originalul după operație | **neschimbat (SHA-256) în toate cazurile** |
| Unire (14 fișiere, 69 de pagini) | text identic pe toate paginile, 0,9 ms |
| 500 de pagini: salvare / rotire / extragere | 3,0 / 4,3 / 2,8 ms |
| Verificare independentă | cititorul PDF din Windows deschide toate cele 30 de fișiere rezultate, cu numărul corect de pagini |

**Ce nu se păstrează la unire:** semnele de carte, formularele și legăturile între documente, pentru că unirea copiază doar paginile. La salvarea simplă se păstrează (verificat pentru `AcroForm` și `Outlines`). Modulul trebuie să spună asta înainte de unire.

## 4. „Reparare” ca fișier nou: nu e de încredere
lopdf poate reconstrui un fișier stricat și îl poate salva ca **copie** (originalul rămâne neschimbat, verificat). Rezultatul:
- **xref greșit:** recuperat complet, 10 pagini cu tot textul. Windows vede tot 10.
- **trunchiat la 60%:** copia are 10 pagini, dar **paginile 7–10 sunt goale**. Windows vede 7. Cititorii nu sunt de acord.
- **octeți alterați:** paginile 1–2 și-au pierdut conținutul. lopdf vede 10 pagini, Windows 9.

**Concluzie:** reparația ascunde pierderi. Propun ca modulul PDF să **nu ofere reparare automată** în Etapa 3. Un fișier care nu trece verificarea strictă este afișat (cu pdf.js, doar pentru citire) cu mesajul „fișier deteriorat”. Eventual, mai târziu, o recuperare ca fișier nou, cu raport pe fiecare pagină (goală / cu text) pe care utilizatorul îl confirmă.

## 5. Afișare: pdf.js
- Deschide corect 16/17 fișiere.
- Pe fișierul cu octeți alterați raportează 2 pagini și apoi o eroare. Verificarea strictă îl prinde înainte.
- Textul facturii din Edge e corect.
- Setări de siguranță folosite: fără `eval`, fără fonturi de sistem, fără rețea.
- **Mărime adăugată** în aplicație: ~1,75 MB (pdf.min + worker), plus încă ~2,3 MB dacă includem hărțile de caractere (cmaps) și fonturile standard. Le măsurăm în installer la pasul 3.5.
- **Notă tehnică:** pdf.js 6 folosește `Uint8Array.toHex`. Node 24 nu îl are, deci testul folosește build-ul „legacy”. WebView2 actual (Chromium 156) îl are; verificăm în fereastră la 3.5.

## 6. Randare: hayro
- Prima pagină a facturii la scara 2 (1224×1584 px) se randează în **6 ms**, corect, cu diacritice și tabel (`docs/spikes/s4/factura-hayro.png`).
- 50 de pagini în 95 ms.
- Util pentru miniaturi și pentru testele automate de necorupere (comparație vizuală înainte/după), fără fereastră.

## 7. OCR (D-035): OCR-ul inclus în Windows
- Testat `Windows.Media.Ocr`, inclus în Windows, **fără nimic descărcat** (`spikes/s4-pdf/ocr-windows.ps1`).
- Pe imaginea facturii: 109 ms, toate rândurile găsite. Dar pe laptop **e instalată doar limba engleză pentru OCR**, așa că:
  - diacriticele ies greșit (ă→ä, ș→s, ț→t);
  - apar confuzii între zero și litera „o” („1.026,oo”, „ROOOOOOOOO”).
- Pentru română e nevoie de pachetul de limbă OCR română din Windows. E o **setare de sistem**, deci 🔒: o decide și o face proprietarul.
- Tesseract (Apache-2.0) ar cere programe și date descărcate separat, deci tot 🔒.
- **Propunere:** OCR nu intră în Etapa 3. Extragerea inițială de date (3.9) lucrează pe PDF-uri cu text și pe foi de calcul. OCR cu Windows + limba română se reia după decizia proprietarului. Orice valoare din OCR va cere oricum confirmarea utilizatorului (§6.4).

## 8. Corpus real: 48 de PDF-uri publice (copiate doar în citire din corpusul suitei proprietarului, D-037)
**Ce conține corpusul** (`testdata/etapa3/extern/`, nepublicat în repo; proveniența fiecărui fișier e în manifest):
- fișiere de test pdf.js (Apache-2.0) și Apache POI/PDFBox;
- **7 formulare reale ANAF** (XFA);
- o carte de 352 de pagini;
- fișiere criptate, deteriorate, cu imagini JPEG 2000 / CCITT / JBIG2, cu fonturi japoneze și arabe.

**Comanda:** `s4 scan` (rezultat în `spikes/s4-pdf/scan-extern.txt`).

| Ce | Rezultat |
|---|---|
| Salvare cu lopdf → pagini, text și randare identice | **43/48**, inclusiv toate cele 7 formulare ANAF și cartea de 352 de pagini |
| Prăbușiri ale programului | 0 (pdf-extract are o panică internă pe un font japonez, prinsă) |
| Verificarea strictă: refuzate | 4: 2 criptate (separate corect, doar citire) și 2 cu `startxref` greșit (deteriorate, doar citire) |
| lopdf nu extrage textul | `issue13343.pdf`, codare japoneză `90ms-RKSJ-H`. pdf.js îl afișează |
| Atenție | un PDF criptat salvat cu lopdf **iese diferit** (randare schimbată). Regulă: PDF-urile criptate nu se modifică, doar se citesc |

**Corecturi aduse verificării stricte după corpus.** Prima variantă respingea greșit 11 fișiere reale. Am făcut două corecturi:
- filtrele de imagine (JPEG, JPEG 2000, CCITT, JBIG2) nu mai sunt decomprimate de verificare;
- rândurile goale din tabelul xref sunt acceptate.

Setul propriu rămâne 17/17 corect.

## 9. OCR cu tesseract.js (descoperit în suita proprietarului)
- Suita de birou a proprietarului face deja OCR cu:
  - **tesseract.js 7.0.0 (Apache-2.0)**, care rulează ca WebAssembly, în fereastră;
  - datele de limbă **`@tesseract.js-data/ron` (MIT, 1,7 MB în varianta `best_int`)**.
- Asta înseamnă OCR în română **fără programe externe și fără setări Windows**. E mai bun decât OCR-ul din Windows, care pe laptop are doar engleza.
- Pachetele sunt instalate în `spikes/s4-pdf/ocr`. Toate licențele sunt permisive, iar scriptul de instalare (opencollective) nu a rulat.
- **Testul, rulat cu acordul proprietarului** (7 nov. 2026; `node spikes/s4-pdf/ocr/ocr.mjs docs/spikes/s4/factura-hayro.png ron`):
  - **Timp:** pornire 0,2–0,4 s, recunoaștere 0,5–0,7 s pe o pagină; încredere medie 83%.
  - **Text obișnuit: excelent.** Furnizorul, clientul și adresele ies corect, cu toate diacriticele (Țesături, Șerban, Școala, Mărășești, Brașov). Numărul și datele facturii sunt corecte.
  - **Tabelul: slab.** Capul de tabel iese deformat, rândurile 2–3 lipsesc, iar totalul „1.673,14 lei” lipsește. Totalul fără TVA (1.406,00) și TVA-ul (267,14) sunt corecte. Ambele variante ale datelor de limbă dau același rezultat.
  - **Ce înseamnă pentru K.G.B.:**
    - OCR-ul în română e utilizabil pentru text, fără setări Windows;
    - pentru tabele e nevoie de recunoaștere pe zone sau celule (pas viitor);
    - orice valoare citită cu OCR se arată utilizatorului spre confirmare (§6.4) și nu se importă niciodată singură.

## Decizia propusă (D-032)
| Rol | Alegere | De ce |
|---|---|---|
| Operații (unire, separare, extragere, rotire, salvare) | **lopdf 0.47** | MIT, rapid, 48/48 operații fără corupere, originalele neatinse |
| Integritate | **verificare strictă proprie** înainte de orice operație | bibliotecile tolerante ascund stricăciunile |
| Afișare în fereastră | **pdf.js 6.4** (fără eval) | Apache-2.0, cel mai matur cititor, text corect |
| Miniaturi și comparații vizuale în teste | **hayro 0.9** | 100% Rust, fără DLL-uri, randare corectă |
| Text pentru căutare și extragere | **lopdf** (pdf-extract respins) | textul fără spații false |
| Respinse | MuPDF (AGPL), pdfium (DLL extern), pdf-extract (calitatea textului) | — |

Alegerea e permisivă și măsurată, deci se aplică după regula din `docs/ETAPA3_PLAN.md` și se confirmă la poarta Etapei 3.

## Cum se reproduce
```
cd spikes/s4-pdf && cargo build --release
target/release/kgb-pdf-spike.exe read   ../../testdata/etapa3 read.json
target/release/kgb-pdf-spike.exe strict ../../testdata/etapa3
target/release/kgb-pdf-spike.exe ops    ../../testdata/etapa3 <folder-ieșire>
powershell -File ../../testdata/etapa3/validate-windows-pdf.ps1 <folder-ieșire>
cd pdfjs && npm ci && node read.mjs ../../../testdata/etapa3   (din spikes/s4-pdf/pdfjs)
```
