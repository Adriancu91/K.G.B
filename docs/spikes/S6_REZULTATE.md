# Spike S6 — generarea documentelor (Etapa 4, pasul 4.7)

**Data:** 7 nov. 2026 · **Cod:** `spikes/s6-docgen` (prototip, nu se distribuie) și `spikes/s6-docgen/webview2-pdf.mjs`
**Întrebarea:** cum facem documente Word (DOCX) și PDF din modele (contracte, facturi, adrese), fără să stricăm modelul și fără să umflăm aplicația (D-045, riscul R20)?

## Candidați
| Variantă | Ce face | Licență | Cât adaugă la installer* |
|---|---|---|---|
| **A. Completator DOCX propriu** (zip + quick-xml, deja în proiect) | înlocuiește câmpurile `{{camp}}` dintr-un model Word existent | MIT (bibliotecile) | **~0,3 MB** |
| **B. docx-rs** 0.4.22 | creează DOCX de la zero (paragrafe, tabele, antet) | MIT | ~0,3 MB în plus |
| **C. Typst** 0.15.1 ca bibliotecă | PDF dintr-un model Typst (paginare, tabele, numerotare) | Apache-2.0 | **~11,7 MB** (15,4 MB cu fonturile proprii) |
| **D. Motorul Edge (WebView2)** pe care aplicația îl are deja | PDF dintr-un model HTML (aceeași funcție ca „Imprimă în PDF”) | parte din Windows | **0 MB** |

\* Comprimat cu xz, ca în installer. Aplicația de azi: exe 30,9 MB, comprimat 8,3 MB.

**Dependențe:** varianta completă (A+B+C) are 363 de crate-uri, toate cu licențe permise de `deny.toml`. Nu există niciun motor de baze de date. Fără Typst rămân 136 de crate-uri, iar doar pentru completator, 108. Fonturile Typst sunt sub licența OFL-1.1, permisivă pentru fonturi. Spike-ul e adăugat în verificarea `cargo-deny` din CI.

## 1. DOCX: completarea unui model
**Modelul de test** a fost făcut cu docx-rs.
- Câmpurile au fost tăiate intenționat în mai multe bucăți: `{{` + `cli` (îngroșat) + `ent}}`, exact cum le taie Word după editare.
- Au fost puse câmpuri în antet și în tabel.
- O valoare are caractere speciale: `< & "`.

Rezultat: **9/9 verificări** (`s6 selftest`).
- Toate cele 6 câmpuri cu valoare au fost înlocuite, inclusiv cel tăiat în 3 bucăți; fiecare bucată își păstrează formatarea.
- Caracterele speciale sunt scrise corect și nu strică fișierul.
- Câmpul fără valoare (`{{iban}}`) e **raportat** și lăsat vizibil, nu golit pe ascuns.
- **Restul fișierului nu se atinge:** 18 din 20 de părți sunt identice octet cu octet. Se schimbă doar `document.xml` și antetul, adică exact părțile cu câmpuri.
- Rezultatul se deschide cu alt cititor DOCX (docx-rs). Completat a doua oară, nu mai găsește nimic de schimbat.
- Durată: sub 1 ms.

**Corpusul extern:** 50 de fișiere DOCX din corpusul suitei proprietarului, folosit doar în citire (D-037). Sunt fișiere Apache POI, inclusiv cazuri de fuzzing.
- **46 au rămas neschimbate**: fiecare parte e identică după o trecere fără valori.
- **4 au fost refuzate** cu mesaj clar (arhivă trunchiată sau deteriorată, fișier cu parolă).
- **0 prăbușiri.** Cel mai lent fișier a durat 94 ms.

Fișierul se verifică înainte de deschidere, la fel ca la foile de calcul: număr de părți, mărime totală după dezarhivare și raport de compresie (bombă zip).

## 2. PDF: același model de factură, două variante
**Modelul:** antet cu firma, client, obiect și un tabel cu 40 de rânduri cu diacritice, deci pe 2 pagini, plus „Pagina X din Y”. Una dintre valori e cod: `#panic("x") ]* _ <b>nu e bold</b>`.

| | C. Typst | D. WebView2 |
|---|---|---|
| Arată bine, diacritice corecte (ș ț ă î â) | da (`docs/spikes/s6/factura-typst.png`) | da (`docs/spikes/s6/factura-webview2.png`) |
| Diacriticele se pot căuta în PDF | da | da |
| Valoarea cu cod e tipărită ca text | da (`sys.inputs`) | da (`textContent`) |
| Capul tabelului repetat pe pagina 2 | nu în model (se poate cu `table.header`) | da (CSS) |
| Durată | 26 ms prima dată, 5 ms apoi | 217 ms prima dată, 141 ms apoi |
| Mărime PDF | 51 KB (fonturile Typst), 84 KB (Arial) | 109 KB |
| Poate citi fișiere de pe calculator | nu: refuzat de lumea Typst (testat) | nu, dacă rulează într-o fereastră ascunsă fără acces la comenzile aplicației și fără rețea (CSP) |
| Aceleași PDF-uri peste ani | da, totul e în aplicație | depinde de versiunea Edge de pe calculator; poate varia puțin |
| Cât adaugă | ~11,7 MB | 0 MB |

**Fonturi:** Typst poate folosi fonturile Windows deja instalate (testat cu Arial), fără să le distribuie. Fonturile proprii Typst adaugă încă ~3,7 MB. WebView2 folosește fonturile Windows.

## Ce nu se poate
- **DOCX → PDF fără Word sau LibreOffice:** nicio bibliotecă liberă nu așază un DOCX ca Word. Un model are deci forma lui: DOCX pentru documente de editat mai departe, HTML (sau Typst) pentru PDF-uri finale.
- **Verificarea vizuală a DOCX-ului în Word:** Word nu e instalat pe acest calculator. Structura e verificată automat, iar aspectul îl verifică proprietarul la 4.8.

## Recomandare (D-045, de confirmat la poarta Etapei 4)
1. **DOCX:** completatorul propriu (A), cu bibliotecile deja aprobate (zip, quick-xml). Modelele incluse în aplicație sunt fișiere DOCX. docx-rs (B) rămâne doar unealtă de test, pentru modelele de probă, nu intră în aplicație.
2. **PDF:** **motorul WebView2 (D)**, pe care aplicația îl are deja. Nu adaugă nimic la installer, calitatea e bună și modelele sunt HTML. Rulează într-o fereastră ascunsă, separată, fără acces la comenzile aplicației, fără rețea, cu valorile puse doar ca text.
3. **Typst (C)** rămâne alternativa documentată, dacă va fi nevoie de PDF-uri identice peste ani (arhivare) sau de paginare mai fină. Costul e de ~11,7 MB, iar decizia o ia proprietarul.
4. **Verificarea fiecărui document generat:** DOCX-ul se recitește, iar PDF-ul se deschide cu verificarea strictă a modulului PDF și se caută în el valorile completate. Abia apoi documentul e salvat ca versiune nouă (D-034).
