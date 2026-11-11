# K.G.B. — Etapa 7: raport (ciornă, partea sesiunii COS)

**Data:** 11 nov. 2026 · **Statut:** CIORNĂ. Secțiunile de mai jos sunt ale sesiunii COS; sesiunea K.G.B. adaugă restul (nucleul, Business, Permise, telefonul, piața, poarta).
**Cum s-a lucrat:** fiecare pas pe o ramură `kgb/cos-*`, construit și încercat în fereastra reală (e2e pe build-ul release, cu date separate), apoi trecut prin poarta sesiunii K.G.B. și unit în `main`. Deciziile s-au luat de comun acord (D-074).

## Module noi pentru tipuri de firme (7.9e)
Cele cinci module sunt propuse la profilurile de activitate potrivite (Situații de lucrări: construcții, servicii, producție); e2e activity 12/12.

| Modul | Ce face | Dovada |
|---|---|---|
| Programări (`kgb.appointments`) | Resurse (oameni, săli, echipamente) cu program și pauze, servicii cu durată și preț, orele libere găsite singure, fără suprapuneri pe același PC; programările făcute pe două PC-uri fără internet la aceeași oră apar „suprapusă”, nu se ascund; stări; memento-uri fără nume sau telefoane | 3 teste Rust + e2e appointments 7/7 |
| Contracte și abonamente (`kgb.contracts`) | Contracte cu clienți și furnizori; liniile facturate lunar / trimestrial / semestrial / anual, cu indexare anuală la aniversare; lista „De facturat”; „Emite factura” prin Business (partenerul găsit după CUI); prelungirea automată și indexarea calculate, nu scrise; calendarul de preaviz și prelungiri; o perioadă facturată de două ori pe două PC-uri e arătată | 3 teste Rust + e2e contracts 8/8 |
| Mentenanța echipamentelor (`kgb.maintenance`) | Echipamente cu contor (ore, km, cicluri); planuri pe zile și/sau contor, iar scadența spune de unde vine („la 250 ore”, „la 16.11.2026”); „fără citire” în loc de „în regulă” când nu există citire; intervenții cu cost fără TVA și ore de oprire; citirile nu scad (cele venite mai mici de pe alt PC sunt arătate); costuri pe an; la vehicule, actele (ITP, RCA) rămân în Permise | 3 teste Rust + e2e maintenance 10/10 |
| Rețete și costuri (`kgb.recipes`) | Ingrediente cu preț, data prețului și pierdere la curățare; cantitatea netă din rețetă (brut = net / (1 − pierdere)); semipreparate fără cicluri; cost pe porție în precizie mare, preț propus rotunjit o singură dată; marjă și food cost; cei 14 alergeni din Reg. (UE) nr. 1169/2011, anexa II (numele verificate pe EUR-Lex), bifați de om, „nebifat” dacă nu e nimic bifat; cota de TVA o alege omul („cota o stabilești cu contabilul”); consumul exportat .xlsx / .csv, fără legătură directă cu stocul | 2 teste Rust + e2e recipes 10/10 |
| Situații de lucrări (`kgb.works`) | Devizul (ofertă sau contract) cu articolele lui, lipite dintr-un tabel (tab sau „;”, numere scrise „1.234,56”; rândurile greșite arătate cu motivul, nimic adăugat fără confirmare); suplimentări de cantitate, fiecare cu motiv; situațiile lunare de plată: anterior, curent, cumulat, rest, valori, TVA aleasă de om, reținerea de garanție pe valoarea fără TVA (implicit) sau cu TVA, „cum scrie în contract”; depășirea devizului refuzată până la o suplimentare; o situație emisă nu se mai schimbă, una greșită se anulează cu motiv (rămâne vizibilă, iese din cumulat, numărul nu se refolosește); depășirea și numărul dublu venite de pe alt PC sunt arătate; prețul unui articol din situații emise nu se mai schimbă; PDF (Typst, în modul) și .xlsx | 3 teste Rust cu cifrele calculate de mână (de ex. situația 1: 18.413,09 lei, TVA 3.866,75, reținere 920,65, de plată 21.359,19) + e2e works 16/16 (aceleași cifre în fereastră) |

## Catalogul de proceduri, lotul 2 (7.9a, D-088)
- **Ce s-a adăugat:** 7 proceduri noi în „Permise și autorizații” › Proceduri › „Din catalog…”, catalogul are acum 26: ISCIR (autorizarea funcționării, verificările periodice, responsabilul RSVTI), ANPC (ce se afișează la deschiderea unui magazin; ANPC nu dă autorizație, doar verifică), licența IGPR de pază și de sisteme de alarmare, acordul prealabil și autorizația de acces în zona drumului public (CNAIR prin DRDP, consiliul județean sau local), autorizarea firmei de pe clădire și taxa pentru afișaj (Legea 185/2013, Codul fiscal art. 478), autorizația de transport în regim de taxi și autorizația taxi (Legea 38/2003), clasificarea structurilor de primire turistice.
- **Regula:** doar surse oficiale (legislatie.just.ro, turism.gov.ro, iscir.ro, DRDP Timișoara – CNAIR, primăriile Cluj-Napoca și Brașov ca exemple locale), fiecare cu data verificării (11.11.2026); ce nu spun sursele a rămas gol (de exemplu taxele la ANPC, IGPR și turism). Cifrele importante (amenzi, termene, limite) au fost verificate în textul legii, nu doar în rezumate.
- **Dovada:** testul catalogului (surse oficiale, limitele schemei) trece; e2e permits-catalog 11/11 (26 de proceduri, căutarea „taxi” găsește procedura nouă cu data verificării).

## Depozitul de documente (7.10a, 7.10d, 7.10b contractele)
- **Depozitul (`kgb.vault`):** un folder întreg sau fișiere alese intră neschimbate, o singură dată pentru același conținut (BLAKE3); fiecare document primește o categorie cu încredere și motiv (actele firmei, autorizații, contracte cu clienți / furnizori / de muncă, facturi de vânzare / achiziție, extrase, chitanțe și NIR, personal); cele nesigure le confirmă omul. Facturile se recunosc din e-Factura XML și din PDF cu text, în forma comună din D-089. CNP-ul e ascuns în textul păstrat. e2e vault 11/11.
- **Dublurile (7.10d):** aceeași factură din alt fișier, sau din Business (emisă ori cheltuială), e arătată: „există și în …” sau „posibil dublură”, cu ce diferă (alt total / altă dată). Aceleași reguli în modul (Rust) și în pagină (test vault-match).
- **Contractele din depozit (7.10b, partea COS):** „Propune contractul…” deschide în Contracte un contract nou completat din text (număr, început, sfârșit din durată, prelungire, preaviz, partenerul din agendă după CUI); nimic nu se salvează fără om. Funcție pură cu teste pe texte sintetice + e2e vault-contract 5/5.

## Ce s-a mutat din Cyber Office Studio (7.4l)
- Ferestrele COS în cadrul lor, cu codul neschimbat (D-071): **Foi de calcul** (7.4l-4), **Documente text** (7.4l-5), **Note** (7.4l-2), uneltele **PDF** (7.4l-1) și ce au testat oamenii (7.4l-0). Vorbesc cu nucleul doar prin `cosBridge` / `cosHost`.
- **Scrierea mai multor fișiere într-un dosar** (CSV pe foi, corespondență în documente separate): prin nucleu (`export_into`), doar în dosarul ales de om, niciodată peste alt fișier (se pune „ (2)”). e2e cos-folder 4/4, cos-merge 4/4.
- **Interfața în engleză:** orice text nou are traducere (verificarea „0 netraduse” la fiecare pas). Reparat pe drum în traducător (comun cu COS): după 25 de pagini titlul paginii nu se mai traducea.
- **Dialogurile** nu mai ies din ecran pe ecrane mici (observația proprietarului).
- **„Trimite o observație”** primește capturi (lipite cu Ctrl+V sau alese), în ambele aplicații; pe pagina web COS butonul nu apare, fiindcă acolo capturile nu s-ar păstra.

## Notițele blocate cu parolă (D-090)
- **Ce s-a găsit:** fișierele atașate (PDF, înregistrări) ale unei notițe blocate rămâneau necriptate, deși fereastra spunea că se criptează; în K.G.B. textul de dinainte de blocare rămânea în istoricul spațiului de lucru. Problema era și în COS.
- **Ce s-a făcut:** atașamentele se criptează cu cheia notiței (AES-256-GCM, cheia din parolă cu PBKDF2-SHA-256, 310.000 de pași), copia în clar se șterge; cele rămase din notițe blocate înainte se criptează la prima deschidere; în COS, textul notiței se scoate și din variantele vechi ale caietului; în K.G.B., după blocare omul e întrebat dacă șterge istoricul acestui PC (`forget_history`, partea sesiunii K.G.B.). Parola uitată înseamnă conținut pierdut: nimeni nu îl poate recupera.
- **Dovada:** COS cdp-notes-lockfiles 8/8; K.G.B. e2e cos-notes-full 13/13 (după „Șterge din istoric”, textul și atașamentul nu mai sunt în niciun fișier din dosarul de date).
- **Ce rămâne (spus în fereastră):** pe alte calculatoare care au primit notița și în backupurile făcute înainte, varianta neblocată rămâne până la curățarea lor.

## Probleme găsite pe drum și reparate
- Atașamentele notițelor se pierdeau în K.G.B. (numele lor nu treceau de verificarea caietului ferestrei).
- Exporturile Notelor (.md, .html, „Salvează o copie”) nu mergeau în K.G.B. (lipsea comanda modulului).
- După salvarea unui contract sau echipament nou, pagina arăta tot cardul vechi (Contracte, Mentenanță).
- Șabloanele de traducere cu valori lipite (`{6}{7}`) sau cu spațiu la început nu se potriveau.

## Ce NU e făcut sau dovedit (sincer)
- **Catalogul de proceduri:** site-ul Poliției Române și cnair.ro nu s-au putut citi la verificare; licența de pază se sprijină pe lege și pe normele de aplicare, accesul la drumurile naționale pe DRDP Timișoara (alte DRDP pot cere puțin altfel). La pază, normele (HG 301/2012) vorbesc încă de licență pe 3 ani, legea modificată prin OUG 37/2026 de licență pe perioadă nedeterminată: fișa o spune și trimite la poliție. Taxele locale și procedurile primăriilor diferă de la o localitate la alta.
- **Situații de lucrări:** nu sunt legate de facturare (factura după situație se face în Business, de mână) și nu au semnătură electronică.
- **Probele proprietarului** rămân 🔒: stickul de semnătură, poza de contract făcută cu telefonul (OCR), foaia tipărită, trimiterea pe e-mail (cere o decizie).
- **Imagini, prezentări și video** din COS nu s-au mutat (decizia proprietarului: mai târziu).
- **Citirea contractelor** se bazează pe formulările obișnuite; un contract scris altfel dă câmpuri goale („Nu am găsit: …”), pe care le completează omul.
- **Notițele blocate pe alte PC-uri:** istoricul lor se curăță doar când omul îl șterge acolo.
