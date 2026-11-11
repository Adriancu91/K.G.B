# K.G.B. — Etapa 7: raport (ciornă)

**Data:** 12 nov. 2026 · **Statut:** FINAL, în așteptarea porții proprietarului (poarta Etapei 7, mai jos: toate testele trecute pe un singur build). Au lucrat două sesiuni: sesiunea K.G.B. (nucleul, Business, Permise, telefonul, profilul firmei din documente, programul de facturare online, porțile) și sesiunea COS (ce s-a mutat din Cyber Office Studio, modulele noi pentru tipuri de firme, depozitul și dublurile). Fiecare pas are în `WORKLIST.md` dovada lui: commit-ul și testele trecute în fereastra reală.
**Cum s-a lucrat:** fiecare pas pe o ramură `kgb/cos-*`, construit și încercat în fereastra reală (e2e pe build-ul release, cu date separate), apoi trecut prin poarta sesiunii K.G.B. și unit în `main`. Deciziile s-au luat de comun acord (D-074).

## Pe scurt
- **Ce s-a cerut:** Etapa 7 a pornit ca „module de afaceri” (surse externe, permise, echipă, calculator, știri, piață). Pe drum, proprietarul a cerut în plus:
  - agenda de parteneri, datele firmei după CUI, completarea automată;
  - Acasă ca centru de control, mesaje, telefonul;
  - funcțiile mutate din Cyber Office Studio;
  - profiluri pe tipuri de firme și module noi pentru ele;
  - avize și autorizații cu dosar;
  - depozitul de documente cu profilul firmei din documente.
- **Ce s-a făcut:** toți pașii fără 🔒 din 7.1–7.10. Rămân doar probele proprietarului și decizia despre e-mail (lista la „Ce NU e făcut”).
- **Cum s-a verificat:** fiecare schimbare a fost construită și încercată în fereastra reală (e2e pe build-ul release, cu date de test separate), cu traducerea în engleză fără text netradus și cu testele Rust și clippy fără avertismente, înainte de a intra în `main`.
- **Decizii noi:** D-062…D-090; cele mai importante sunt în secțiunile de mai jos.

## Nucleul, Business și paginile comune (sesiunea K.G.B.)
- **Surse externe (7.1, D-062/D-063):** fiecare sursă din afară are adresă, condiții, licență și dată de verificare. Nimic nu e activ din fabrică.
- **Internetul (D-086):** cererile pleacă doar la clicul omului, prin nucleu, doar spre adrese din afară, cu „Setări › Internet” pornit.
- **Module noi:** Permise și autorizații (7.2), Echipă și pontaj (7.3, D-064: pontaj declarat, fără supraveghere), Calculator și conversii (7.4, D-065), Știri (7.5).
- **Pagini comune:**
  - agenda de parteneri, comună tuturor modulelor (7.4a, D-066);
  - „Caută la ANAF” după CUI (7.4b);
  - completarea din agendă și din documentele anterioare (7.4c);
  - Acasă ca centru de control, cu panouri noi (7.4d, 7.4e);
  - mesaje în echipă (7.4f) și „Echipa pe scurt” doar pentru administratori (7.4h);
  - profilurile pe tipuri de activitate (7.4n, apoi 7.9c, care propun și avizele).
- **Business:**
  - plăți legate de mai multe facturi;
  - oferte cu valabilitate, comenzi cu aprobare, stoc rezervat și blocat, livrări urmărite;
  - parc auto cu actele care expiră (7.4j, 7.4k).
- **Telefonul (7.4m, D-068/D-069):**
  - pagina locală pentru telefoane, pe orice PC, cu preluare automată;
  - fișa de recepție pe linii, inventarul numărat, pontajul, livrările șoferului, taskurile și mesajele;
  - K.G.B. lângă ceas pe PC-ul care servește telefoanele.
- **Printre altele:**
  - tipărirea pe hârtie și PDF-ul paginilor ferestrelor (D-081, D-084);
  - semnătura digitală cu certificatele din Windows (D-085);
  - „Trimite o observație” cu poza ferestrei și cu capturile omului.

## Avize, autorizații și dosare (7.2, 7.9a–7.9d)
- **Catalogul de proceduri (D-088):** 26 de proceduri, doar din surse oficiale, fiecare cu sursele și data verificării. Câmpurile pe care sursa nu le spune rămân goale.
- **Dosarul de depus:** din procedură, cu lista de verificare. „Exportă dosarul” face un folder cu opisul PDF, adresa de înaintare completată din datele firmei și documentele atașate, numerotate.
- **„Autorizațiile firmei”:** autorizațiile pe care firma le are. Cele expirate și cele care expiră curând apar sus, cu memento-uri pe intervale (în ultimele 30 de zile, în ultima săptămână, în ziua expirării, apoi săptămânal). Se pot completa din actele din depozit.
- **Documente și modele:** 22 de modele pe categorii (administrative, comerciale, HR, tehnice, juridice, avize). Foile de calcul au 12 șabloane cu formule verificate de mână.

## Profilul firmei din documente (7.10b)
Totul e o propunere. Omul o vede lângă ce există deja și o confirmă; nimic nu se scrie pe tăcute.
- **Datele firmei**, din certificatul constatator: denumirea, CUI-ul (doar cu cifra de control corectă), nr. Registrului Comerțului (forma veche și cea nouă) și sediul.
- **Factura de achiziție** se înregistrează în Business, iar Business refuză aceeași factură a doua oară.
- **Autorizațiile** trec în Permise.
- **Contractele** trec în Contracte (sesiunea COS).
- **Chitanțele** trec în casă: plată sau încasare după CUI-ul firmei. Aceeași chitanță deja în casă e numită.
- **Liniile unei facturi e-Factura de achiziție** devin o recepție (NIR). Fiecare linie e potrivită cu produsul după codul furnizorului sau după nume; altfel devine produs nou, adăugat doar la înregistrare.
- **Facturile PDF:** liniile lor nu se citesc sigur, deci recepția se face doar din XML.

## Programul de facturare online, doar citire (7.10c, D-089)
- **Ce oferă API-ul programului (verificat pe documentația lui oficială):** nu listează facturile emise; dă doar valoarea și linkul PDF pentru o factură cerută după serie și număr. Cheia lui poate tot, inclusiv să anuleze și să șteargă.
- **De aceea, în K.G.B.:**
  - cheia e sigilată cu DPAPI doar pe acest PC și nu se dă înapoi paginii;
  - există doar două cereri de citire, iar un test pică dacă în cod apare vreo cerere de scriere;
  - se citesc cel mult 500 de numere odată, una pe secundă, cu oprire după 5 numere lipsă la rând;
  - PDF-ul se aduce doar de pe site-ul programului;
  - cererile pleacă doar la clic, cu internetul pornit și programul aprobat în Surse externe.
- **Testul:** e2e cu un server local care imită programul. Proba cu contul proprietarului rămâne la el.

## Istoricul de pe acest PC după blocarea unei notițe (D-090, nucleu)
- **`forget_history`:** compactează jurnalul, retrage fișierele fără referință și șterge `retired/`. `quarantine/` rămâne pentru diagnoză.
- **Testul:** caută pe tot dosarul textul și atașamentul de dinainte de blocare. Le găsește înainte de ștergere și nu le mai găsește după.
- **Ce nu șterge:** nimic de pe alte PC-uri și nimic din backupuri. Un PC rămas în urmă face apoi o sincronizare completă.

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
- **Programul de facturare online:** e încercat doar cu un server local care imită documentația. Linkul PDF poate cere autentificare, iar ce se întâmplă la depășirea limitei nu e spus în documentație; ambele se văd abia cu contul proprietarului (🔒).
- **Cotele de TVA (21 / 11 / 0)** rămân de confirmat cu un contabil (D-052).
- **Etapa 6:** proba cu al doilea PC (6.10) și poarta 6.12 sunt tot 🔒. Sincronizarea între PC-uri e verificată doar pe un singur PC (noduri de test).
- **Profilul firmei din documente:** citește formulările obișnuite. Un act scris altfel dă câmpuri goale, pe care omul le completează.

## Poarta Etapei 7: toate testele pe un singur build
**Cum s-a verificat:** un singur build release din `main` (faa1f99, 12 nov. 2026), apoi toate testele de fereastră din `app/e2e`, la rând, fiecare cu date de test separate, pe același laptop. A rulat sesiunea COS; testul învechit `gate.mjs` l-a reparat ea, iar sesiunea K.G.B. a trecut reparația prin poartă (be3d8d8).

**Rezultat:** 62 de teste, **728 din 728 de verificări trecute**. Nicio regresie în cod. Un test era învechit (`gate.mjs` căuta vechea casetă „Notă nouă”) și a fost actualizat. Un test a fost sărit (`desktop.mjs`, vezi mai jos).

| Test | Verificări | Test | Verificări | Test | Verificări |
|---|---|---|---|---|---|
| activity | 12/12 | extract | 9/9 | pdf-sign | 8/8 |
| anaf | 8/8 | feedback | 11/11 | pdf | 52/52 |
| appointments | 7/7 | fleet | 6/6 | permits-catalog | 11/11 |
| autofill | 6/6 | gate | 15/15 | permits-held | 5/5 |
| backup | 8/8 | holds | 4/4 | permits | 6/6 |
| business | 28/28 | home | 17/17 | phone | 58/58 |
| calc | 7/7 | invite | 11/11 | planner | 22/22 |
| chat | 7/7 | lang | 8/8 | recipes | 10/10 |
| conflicts | 6/6 | maintenance | 10/10 | reminders | 4/4 |
| contracts | 8/8 | market | 7/7 | sheets | 20/20 |
| cos-dialogs | 11/11 | network | 15/15 | sources | 6/6 |
| cos-docs | 19/19 | news | 8/8 | team-overview | 7/7 |
| cos-efactura | 23/23 | offers | 6/6 | team | 5/5 |
| cos-folder | 4/4 | online-invoicing | 6/6 | tools | 11/11 |
| cos-merge | 4/4 | orders | 5/5 | vault-cash | 6/6 |
| cos-notes-full | 13/13 | org | 14/14 | vault-contract | 5/5 |
| cos-notes | 12/12 | panels | 9/9 | vault-profile | 8/8 |
| cos-ocr | 6/6 | partners | 9/9 | vault | 11/11 |
| cos-print | 16/16 | pdf-edittext | 12/12 | works | 16/16 |
| cos-sheets-import | 23/23 | | | | |
| cos-sheets | 19/19 | | | | |
| cos-web | 9/9 | | | | |
| deliveries | 4/4 | | | | |
| docs | 15/15 | | | | |

**Ce NU dovedesc aceste teste:**
- **Rețeaua reală între două PC-uri:** `network` și `invite` rulează pe același laptop, cu un nod de test.
- **Probele care cer hardware real sau prezența proprietarului:** stickul de semnătură, OCR-ul pe poza de telefon, foaia tipărită, contul real al programului de facturare online.
- **`desktop.mjs`:** scrie în lista de programe pornite odată cu Windows (o intrare de test, în lista utilizatorului) și verifică că pornește un singur K.G.B. Rulat acum, s-ar putea atinge de K.G.B.-ul deschis de proprietar. Rămâne 🔒, pentru o rulare cu el de față.

**Ce decide proprietarul:**
1. Poarta Etapei 7, pe baza acestui raport.
2. Ce rămâne 🔒 și dacă vrea să le închidă înainte de Etapa 8: probele de mai sus și e-mailul din aplicație („nimic trimis în numele lui”, deci o decizie separată).
