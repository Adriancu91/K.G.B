# K.G.B. — Registrul deciziilor (DECISION_LOG)

Format: fiecare decizie are ID, dată, statut (DECIS / PROPUS / DE VALIDAT / ULTERIOR / RESPINS), motiv, alternative, impact și cine a aprobat.
Deciziile DECIS se schimbă doar cu aprobarea explicită a proprietarului (Master Plan §0, regula 1).

---

## Decizii preluate din `KGB_MASTER_PLAN.md` v1.0 (6 nov. 2026)

| ID | Decizie | Statut |
|---|---|---|
| D-001 | Numele de lucru este K.G.B. — Kronos Global Business | DECIS |
| D-002 | Windows este prima platformă; macOS ulterior | DECIS |
| D-003 | Local-first, fără cloud obligatoriu pentru datele de lucru | DECIS |
| D-004 | Fără server central de date/aplicație K.G.B. | DECIS |
| D-005 | Fără niciun motor de baze de date, inclusiv local | DECIS |
| D-006 | Stocare proprie prin fișiere structurate, indexuri și jurnal | DECIS |
| D-007 | Conectare între PC-uri oriunde prin internet | DECIS |
| D-008 | Installerul include și configurează automat componenta de rețea | DECIS |
| D-009 | NetBird este candidat de evaluare, nu alegere finală | ÎNLOCUIT de D-015 (iroh) |
| D-010 | Tauri 2 + React + TypeScript | DECIS (6 nov. 2026, după S3) |
| D-011 | Module activate/dezactivate fără ștergerea datelor | DECIS |
| D-012 | Sincronizarea și VPN-ul sunt subsisteme distincte | DECIS |

---

## Decizii noi

### D-013 — Aprobarea planului Etapei 0
- **Data:** 6 nov. 2026 · **Statut:** DECIS · **Aprobat de:** proprietar (în sesiunea de lucru)
- **Conținut:** planul din `ETAPA0_PLAN.md`: ordinea spike-urilor stocare → rețea → Tauri, structura de directoare propusă.
- **Notă:** aprobarea planului nu aprobă automat deciziile D-014…D-018 de mai jos.

### D-014 — Toolchain de compilare MSVC pe PC-ul de dezvoltare
- **Statut:** DECIS (6 nov. 2026, aprobat de proprietar) — varianta (a)
- **Problemă:** Tauri pe Windows cere Visual Studio Build Tools (C++) și Rust `stable-x86_64-pc-windows-msvc`; acum există doar toolchain-ul GNU.
- **Alternative:** (a) instalare MSVC Build Tools — varianta oficial susținută; (b) rămânem pe GNU — Tauri nu e susținut oficial așa.
- **Impact:** instalare cu UAC pe PC-ul de dezvoltare; licență Build Tools gratuită pentru persoane/firme mici, de reverificat la creșterea firmei.
- **Recomandare:** (a).

### D-015 — iroh ca prim candidat de rețea (modifică raționamentul D-009)
- **Statut:** DECIS pentru Etapa 0 (6 nov. 2026, aprobat de proprietar): spike cu iroh + un candidat VPN de comparație. Alegerea finală rămâne deschisă până la rezultatele spike-ului.
- **Problemă:** NetBird/Headscale self-host folosesc SQLite/Postgres pe serverul de coordonare (conflict posibil cu D-005); serverele NetBird sunt AGPL-3.0; orice VPN cere driver + UAC.
- **Alternative:** iroh (bibliotecă de conectare în aplicație, MIT/Apache-2.0, fără driver); Nebula (VPN, MIT, fără DB); NetBird; Tailscale.
- **Impact:** iroh nu creează o rețea privată pentru alte programe (nu e necesar — sincronizarea e protocol de aplicație, Master Plan §8.2, §9.5); D-007 și D-008 rămân îndeplinite.
- **Recomandare:** spike cu iroh + un candidat VPN pentru comparație. Licențele se verifică pe versiunile exacte.
- **Statut final:** DECIS (6 nov. 2026, aprobat de proprietar după raportul Etapei 0): **iroh** e componenta de rețea; Nebula/NetBird respinse (driver + UAC, server obligatoriu). Condiție: testul S2.3 cu 2 PC-uri reale se face înainte de Etapa 6; dacă eșuează, decizia se redeschide.

### D-016 — Se aplică D-005 și infrastructurii de rețea (coordonare/relay)?
- **Statut:** DE VALIDAT — cere decizia proprietarului
- **Context:** serverele de coordonare nu țin date de business, dar unele folosesc un motor DB.
- **Notă (6 nov. 2026):** proprietarul a acceptat recomandările; cu iroh sau Nebula întrebarea nu se pune (fără DB). Rămâne deschisă doar dacă spike-ul ar recomanda NetBird/Headscale.

### D-017 — Cine operează relay-ul / serviciul de coordonare
- **Statut:** DECIS (6 nov. 2026, aprobat de proprietar) — varianta (c): relay public al furnizorului **doar pentru teste**; producția cere relay propriu (decizie de cost/operare ulterioară).
- **Alternative:** (a) relay propriu Kronos (cost lunar, operare); (b) relay public al furnizorului (dependență, vede IP-uri și chei publice, nu conținut); (c) (b) doar pentru teste, (a) în producție.
- **Recomandare:** (c).

### D-018 — Interzicerea bibliotecilor cu motor DB embedded
- **Statut:** PROPUS (aplicare directă a D-005)
- **Listă:** `rusqlite`/SQLite, `sled`, `redb`, `rocksdb`, `lmdb`/`heed`, `fjall`, ORM-uri (`diesel`, `sea-orm`), IndexedDB/localStorage pentru date operaționale.
- **Zonă gri, decizie înainte de Etapa 2:** `tantivy` (indexare full-text cu fișiere proprii de index).
- **Statut actualizat:** DECIS (6 nov. 2026, proprietarul a acceptat recomandările).

### D-020 — Mediu de compilare cu Smart App Control pornit
- **Data:** 6 nov. 2026 · **Statut:** DECIS — varianta (a): proprietarul a oprit SAC pe laptop (6 nov. 2026); build-ul local funcționează
- **Problemă:** Smart App Control (SAC) e pornit pe PC-ul de dezvoltare și blochează programele generate de compilator (build scripts, teste, aplicația). Nu se poate compila nimic în Rust.
- **Alternative:**
  (a) proprietarul oprește SAC din Windows Security → App & browser control → Smart App Control. Atenție: Windows nu permite repornirea SAC fără reinstalarea sistemului; Defender rămâne activ;
  (b) un PC sau o mașină virtuală dedicată dezvoltării, cu SAC oprit; PC-ul principal rămâne neschimbat;
  (c) compilare și teste în WSL2 (Linux). Merge pentru logica de stocare, dar nu testează comportamentul Windows (MoveFileExW, Defender) și nu poate produce aplicația Tauri pentru Windows.
- **Recomandare:** (b) dacă există un al doilea PC/VM; altfel (a). (c) doar ca soluție temporară pentru S1.
- **Notă:** Claude nu modifică setări de securitate; schimbarea o face proprietarul.
- **Actualizare (cercetare 6 nov. 2026, `docs/spikes/S2_RETEA_MATRICE.md`):** din aprilie 2026, SAC se poate reporni fără reinstalare (dacă datele de diagnostic opționale sunt pornite), deci varianta (a) nu mai e ireversibilă.
- **Soluție provizorie folosită:** build și teste pe GitHub Actions (Windows curat) în repo-ul privat `Adriancu91/K.G.B`. Necesită permisiunea `workflow` pentru `gh`.
- **Implicație pentru produs:** semnare cu Azure Artifact Signing prin firma proprietarului (persoanele fizice din RO nu sunt eligibile) — decizie de luat înainte de testele pe PC-uri curate.

### D-019 — Acces la proiectul existent `workspace/` (Cyber Office Studio)
- **Data:** 6 nov. 2026 · **Statut:** DECIS · **Aprobat de:** proprietar
- **Conținut:** citire și analiză a codului pentru reutilizare. Codul se preia doar cu proveniență și licență verificate (proiect propriu al proprietarului) și se consemnează în `LICENSES.md`.

### D-021 — Biblioteci MPL-2.0 aduse de Tauri
- **Data:** 6 nov. 2026 · **Statut:** DECIS (6 nov. 2026, aprobat de proprietar) — acceptat cu regula „nu modificăm aceste biblioteci”
- **Context:** Tauri 2 include tranzitiv `cssparser`, `selectors`, `dtoa-short`, `option-ext` (MPL-2.0). Vite folosește `lightningcss` (MPL-2.0), doar la build. iroh include `attohttpc` (MPL-2.0) pentru UPnP.
- **Ce înseamnă:** MPL-2.0 e copyleft la nivel de fișier. Doar modificările *acelor fișiere* trebuie publicate; codul K.G.B. rămâne închis. Se păstrează notice-urile.
- **Recomandare:** acceptat, cu regula „nu modificăm aceste biblioteci”. Alternativa (fără Tauri) ar schimba stack-ul aprobat.

### D-022 — Poarta Etapei 0
- **Data:** 6 nov. 2026 · **Statut:** DECIS · **Aprobat de:** proprietar („Da la toate recomandările”)
- **Conținut:** recomandările din `docs/ETAPA0_RAPORT_FINAL.md` sunt acceptate:
  1. D-021 (MPL-2.0) acceptat, fără modificarea acelor biblioteci;
  2. pragurile de performanță aprobate, cu 2 modificări: căutare indexată „< 5 ms pentru ≤ 1.000 de rezultate”; filtrarea fără index (100k < 200 ms) devine țintă a Etapei 2;
  3. D-010 (Tauri 2 + React + TypeScript) și D-015 (iroh) → DECIS;
  4. **Etapa 1 începe acum**, în paralel cu testul 🔒 S2.3 (2 PC-uri), care rămâne obligatoriu înainte de Etapa 6;
  5. semnarea codului se pregătește prin firmă (Azure Artifact Signing) — pașii îi face proprietarul, înainte ca aplicația să ajungă la alți utilizatori.
- **Ce rămâne deschis din Etapa 0:** S2.3; pierderea alimentării (VM); RAM-ul S1 la 1M; pornirea la rece; aplicație semnată pe PC cu Smart App Control.

### D-023 … D-026 — Structura și componentele Etapei 1
- **Data:** 6 nov. 2026 · **Statut:** DECIS (6 nov. 2026, aprobat de proprietar odată cu poarta Etapei 1, D-027) — detalii și alternative în `docs/ETAPA1_PLAN.md`
- D-023 structura codului de produs (`crates/kgb-store`, `crates/kgb-core`, `app/`);
- D-024 modulele Etapelor 1–5 sunt incluse în aplicație, declarate prin manifest, fără pluginuri încărcate la rulare;
- D-025 cheia dispozitivului este Ed25519, protejată cu Windows DPAPI;
- D-026 logurile se scriu cu `tracing` și o rotație proprie pe mărime.

### D-027 — Poarta Etapei 1
- **Data:** 6 nov. 2026 · **Statut:** DECIS · **Aprobat de:** proprietar („Da aprob … mergi înainte”), pe baza `docs/ETAPA1_RAPORT.md`
- **Conținut:** Etapa 1 se încheie. D-023…D-026 devin DECISE. Panourile mutabile prin drag-and-drop și ecranul cu mai multe panouri trec în **Etapa 4**. **Începe Etapa 2** (Storage Engine).
- **Notă:** proprietarul nu a testat personal aplicația (nu avea acces la laptop). Aprobarea se bazează pe testele automate și pe capturile de ecran.

### D-028 … D-030 — Etapa 2 (Storage Engine)
- **Data:** 6 nov. 2026 · **Statut:** PROPUS — detalii în `docs/ETAPA2_PLAN.md`
- D-028: format binar al jurnalului — se decide după măsurători (pasul 2.4);
- D-029: orice format nou citește jurnalele vechi; conversia se face doar la compactare, după backup automat;
- D-030: restaurarea creează un spațiu de lucru nou, nu suprascrie pe cel curent.

### D-028 — Format binar al jurnalului (v2)
- **Data:** 6 nov. 2026 · **Statut:** DECIS. Formatul binar era deja recomandat în raportul Etapei 0 („Pentru Etapa 2: format binar în loc de JSON”), aprobat de proprietar prin D-022. S-a aplicat după dovada măsurată.
- **Dovada** (`docs/etapa2/BENCH.md`): la 100k înregistrări, doar validarea JSON durează 241 ms, peste pragul de 200 ms, iar citirea de pe disc 89 ms.
- **Ce s-a ales:** antet binar + câmpuri cu lungimea în față. **Valorile rămân JSON**, deci semnificația datelor nu se schimbă. Nu s-a folosit nicio bibliotecă nouă.
- **Alternative respinse:** CBOR sau MessagePack, care ar fi cerut o dependență nouă și oricum citesc fiecare octet; o coloană separată în memorie, care costă mult RAM.
- **Rezultat:** interogare 100k: 116 ms ✅; deschidere: 166 ms (era 349).
- **Compatibilitate (D-029, aplicată):** jurnalele v1 se citesc în continuare. Un spațiu de lucru existent rămâne pe v1 până la prima compactare. La compactare, manifestul trece pe formatul 2, iar o aplicație veche îl refuză clar, fără să-l modifice. **Backup automat înainte de conversie:** pasul 2.9.

### D-030 — Restaurarea creează un spațiu de lucru nou (aplicată)
- **Data:** 6 nov. 2026 · **Statut:** DECIS, aplicat în pasul 2.9 (era PROPUS în planul Etapei 2, conform regulii din Metaprompt §7 „nu suprascrie singura copie validă”).
- **Ce face aplicația:** verifică backupul fișier cu fișier, apoi îl deschide ca spațiu nou, numit „… (restaurat <dată>)”. Originalul rămâne neatins și se redeschide din „Date și backup”.
- **Backupuri automate:** înainte de migrarea datelor unui modul și înainte de conversia formatului jurnalului. Se păstrează ultimele 5 automate; cele manuale rămân până le șterge utilizatorul. Ștergerea backupurilor din interfață nu există încă.

### D-031 — Poarta Etapei 2
- **Data:** 7 nov. 2026 · **Statut:** DECIS · **Aprobat de:** proprietar („Aprob”), ca răspuns la întrebarea din `docs/ETAPA2_RAPORT.md` (poartă + D-028…D-030 + varianta recomandată pentru 2.12)
- **Conținut:** Etapa 2 se încheie. D-028, D-029, D-030 sunt confirmate. **Începe Etapa 3** (documente și foi de calcul).
- **2.12, pierderea alimentării:** varianta (b). Testul se amână, dar rămâne **obligatoriu înainte de prima utilizare cu date reale** (R17 rămâne deschis).
- **Notă:** proprietarul nu a testat personal aplicația. Aprobarea se bazează pe raport și pe testele automate.

### D-032 … D-036 — Etapa 3 (Documente și foi de calcul)
- **Data:** 7 nov. 2026 · **Statut:** aplicate pe parcurs (vezi D-032 … D-040 mai jos); de confirmat la poarta Etapei 3 (`docs/ETAPA3_RAPORT.md`) — detalii și alternative în `docs/ETAPA3_PLAN.md`
- D-032: biblioteca PDF se alege după spike-ul S4 (licență, fidelitate, viteză);
- D-033: biblioteca pentru foi de calcul se alege după spike-ul S5;
- D-034: documentele nu se suprascriu niciodată. Fiecare salvare creează o versiune nouă, iar originalul importat rămâne neatins;
- D-035: OCR-ul (text din scanări și imagini) se evaluează separat și nu intră în Etapa 3 dacă cere programe externe sau licențe neclare;
- D-036: șabloanele originale sunt doar de citire. Utilizatorul lucrează pe o copie.

### D-032 — Biblioteci PDF (aplicată)
- **Data:** 7 nov. 2026 · **Statut:** DECIS după spike-ul S4, conform regulii din `docs/ETAPA3_PLAN.md`: licențe permisive, alegere măsurată, se confirmă la poarta Etapei 3. Detalii: `docs/spikes/S4_REZULTATE.md`.
- **Ce s-a ales:**
  - **lopdf 0.47 (MIT)** pentru operații: 48/48 fără corupere, originalele neatinse, 500 de pagini în câteva ms;
  - **pdf.js 6.4 (Apache-2.0)** pentru afișare în fereastră, fără `eval`;
  - **hayro 0.9 (Apache-2.0/MIT)** pentru miniaturi și comparații vizuale în teste;
  - **o verificare strictă proprie a integrității**, înainte de orice operație.
- **Respinse:**
  - MuPDF, din cauza licenței AGPL;
  - pdfium, care cere un DLL extern;
  - pdf-extract, care pune spații false în text.
- **Regulă nouă:** bibliotecile tolerante „recuperează” în tăcere fișiere stricate (un PDF tăiat la 60% apare cu 10 pagini, din care 4 goale). De aceea:
  - un PDF care nu trece verificarea strictă se arată doar pentru citire, marcat „deteriorat”;
  - nu se oferă reparare automată în Etapa 3.

### D-035 — OCR (propunere actualizată după S4)
- **Statut:** PROPUS, așteaptă proprietarul (🔒).
- **Ce am testat:** OCR-ul inclus în Windows (`Windows.Media.Ocr`) funcționează fără nimic descărcat: 109 ms pe o factură.
- **Problema:** pe laptop e instalată doar limba engleză pentru OCR, așa că diacriticele și unele cifre ies greșit.
- **Ce e nevoie:** limba română pentru OCR, o setare de sistem pe care o face proprietarul.
- **Recomandare actualizată (7 nov. 2026, după corpusul suitei proprietarului):** candidatul principal devine **tesseract.js 7 (Apache-2.0) cu datele pentru română `@tesseract.js-data/ron` (MIT)**:
  - e local, în fereastră, fără setări Windows;
  - e folosit deja de suita de birou a proprietarului.
- **Testat** cu acordul proprietarului („Da”, 7 nov. 2026):
  - textul obișnuit iese corect, cu diacritice, în ~0,6 s pe pagină;
  - tabelele ies slab, deci e nevoie de recunoaștere pe zone.
- **Recomandare:** tesseract.js + `ron` devine motorul OCR. Intră în extragerea de date doar cu confirmarea utilizatorului pentru fiecare valoare. Tabelele se recunosc pe zone într-un pas următor.
- **Până atunci:** OCR nu intră în extragerea de date. Orice valoare citită cu OCR cere confirmarea utilizatorului.

### D-037 — Office Suite Test (programul proprietarului) ca unealtă de testare
- **Data:** 7 nov. 2026 · **Statut:** DECIS · **Aprobat de:** proprietar („Poți folosi dacă ai nevoie unelte din cyber office suite”).
- **Ce e:** folderul `Desktop/Office Suite Test 0.9.2 - pentru testare` (programul proprietarului: Docs, Sheets, PDF; licență de testare). E aprobat pentru citire și folosire, ca al doilea program independent care deschide și produce XLSX/PDF în teste (S5, pasul 3.10).
- **Regula proprietarului:** „Fără să modifice ceva acolo, doar extragi ce ai nevoie”:
  - în acel folder nu se modifică, nu se instalează și nu se rulează nimic;
  - componentele necesare se extrag dintr-o copie, într-un folder temporar din afara proiectului și a folderului sursă.
- **Limite:**
  - nu se copiază codul lui în K.G.B.;
  - fișierele produse cu el intră în `testdata/` doar dacă nu conțin date personale.

### D-033 — Biblioteci pentru foi de calcul (aplicată)
- **Data:** 7 nov. 2026 · **Statut:** DECIS după spike-ul S5, conform regulii din `docs/ETAPA3_PLAN.md`: licențe permisive, alegere măsurată, se confirmă la poarta Etapei 3. Detalii: `docs/spikes/S5_REZULTATE.md`.
- **Ce s-a ales:**
  - **calamine 0.38 (MIT)** pentru citire și import: 0 prăbușiri pe XLSX reale, citește și ODS/XLS;
  - **umya-spreadsheet 4.0.0-beta.1 (MIT)** pentru editare și salvare XLSX: 61/65 fișiere reale cu valori și formule identice, 6/6 pe setul propriu. Versiunea 3.1 trage după ea `zip` 8.6, cu 4 vulnerabilități (CI oprit); beta-ul folosește `zip` 9 și dă aceleași rezultate. Se reverifică la 3.6 dacă a apărut 4.0 stabilă;
  - **IronCalc 0.9 (MIT/Apache)** pentru formule: 95,9% identic cu Excel pe formulele obișnuite, 12/12 pe cele uzuale;
  - **rust_xlsxwriter (MIT/Apache)** pentru fișiere noi, cu rezultatele formulelor scrise.
- **Reguli noi:**
  - salvarea compară fișierul înainte și după, anunță exact ce s-ar pierde (grafice noi, imagini din celule, pivot) și salvează ca versiune nouă (D-034);
  - când o formulă recalculată diferă de valoarea salvată de alt program, se arată valoarea salvată și celula e marcată;
  - verificarea proprie anti-„bombă zip” rulează înainte de orice bibliotecă.
- **Respinse:**
  - SheetJS, care e JavaScript; logica rămâne în Rust;
  - sql.js, folosit de suita proprietarului, pentru că e SQLite (D-018).

### D-034 — Documentele nu se suprascriu niciodată (aplicată)
- **Data:** 7 nov. 2026 · **Statut:** DECIS, aplicat în pasul 3.4 (era PROPUS în planul Etapei 3; e chiar criteriul Master Plan §6.1, „preview și copie de siguranță”).
- **Ce face nucleul:** serviciul `kgb_core::documents`, accesibil modulelor cu permisiunea `files.own`.
  - Importul devine versiunea 1, originalul.
  - Fiecare salvare adaugă o versiune nouă, într-o singură scriere atomică.
  - O salvare pe o versiune depășită e refuzată.
  - Restaurarea unei versiuni vechi creează o versiune nouă.
  - Exportul scrie o copie și nu înlocuiește un fișier existent fără confirmare.
- **Verificat:** 7 teste, inclusiv 25 de opriri forțate în timpul salvărilor, fără nicio versiune pe jumătate și cu originalul neatins.

### D-038 — Fișierele utilizatorului intră și ies prin dialogurile sistemului
- **Data:** 7 nov. 2026 · **Statut:** DECIS (pasul 3.5; detaliu de implementare a D-034, fără schimbare de arhitectură).
- **Import:** modulele nu primesc acces la disc. Aplicația citește fișierul ales de utilizator în dialogul sistemului (`tauri-plugin-dialog`, doar `allow-open`/`allow-save`; limita de 64 MB) și îl dă modulului ca nume + conținut.
- **Export:** se scrie o copie în calea aleasă în dialogul de salvare; dialogul sistemului confirmă înlocuirea unui fișier existent.
- **Politica de securitate a ferestrei (CSP), lărgită minim pentru pdf.js:**
  - `worker-src 'self'`: lucrătorul pdf.js vine din aplicație;
  - `wasm-unsafe-eval`: decodoarele de imagini pdf.js sunt WebAssembly;
  - `img-src blob:`.
- **Neschimbat:** `eval` rămâne interzis, iar rețeaua nu e permisă.

### D-039 — Recalcularea formulelor la salvare: doar unde e sigură
- **Data:** 7 nov. 2026 · **Statut:** DECIS (pasul 3.6, aplicare a regulii din D-033).
- **Problema:** IronCalc calculează ca Excel ~96% din formulele obișnuite (S5). Dacă K.G.B. ar scrie orbește rezultatele lui, ar putea strica valori corecte calculate de alt program.
- **Regula:** la salvare, K.G.B. calculează fișierul de două ori: așa cum a fost primit și după modificări.
  - O formulă afectată de modificări primește valoarea nouă doar dacă, pe fișierul original, K.G.B. obținea exact valoarea salvată de celălalt program.
  - Altfel își păstrează valoarea veche și e listată în previzualizare ca „nu poate fi recalculată sigur”.
  - O formulă scrisă de utilizator primește valoarea calculată de K.G.B.
- **Confirmare:** salvarea cu pierderi (grafice, imagini) sau cu formule nesigure cere confirmarea explicită a utilizatorului. Versiunile vechi rămân.

### D-036 — Șabloanele originale sunt doar de citire (aplicată)
- **Data:** 7 nov. 2026 · **Statut:** DECIS, aplicat în pasul 3.7 (Master Plan §6.3).
- **Ce s-a făcut:** originalele sunt scrise în codul modulului `kgb.sheets`, deci nu se pot modifica din aplicație. „Folosește” creează o copie a utilizatorului, un document nou cu versiunile lui.
- **Primele 5 șabloane:** buget lunar, factură, registru de casă, cost/km, rate credit.
- **Verificare:** formulele sunt documentate în `docs/etapa3/SABLOANE.md` și verificate cu valori calculate independent (7 teste, inclusiv toate cele 60 de luni ale graficului de rambursare).
- **Cota TVA din factură:** 21%, cota standard din 1 aug. 2025, într-o singură celulă modificabilă.
- **Nefăcut încă:** celelalte categorii din §6.3 (cash-flow, P&L, stocuri, HR, proiecte, construcții etc.).

### D-040 — Extragerea de date: reguli simple, sursa vizibilă, confirmare obligatorie
- **Data:** 7 nov. 2026 · **Statut:** DECIS (pasul 3.9, Master Plan §6.4).
- **Modulul `kgb.extract` (beta):** extrage datele facturilor din PDF-uri cu text și din foi de calcul. Câmpurile sunt număr, dată, scadență, furnizor, CUI, client, total fără TVA, TVA, total.
- **Cum găsește valorile:** reguli scrise de mână, după etichetă („Total de plată”, „Data emiterii”…), fără un model care ghicește. În foi de calcul, valoarea se caută doar la dreapta etichetei, pe același rând.
- **Sursa:** fiecare valoare arată de unde vine (pagina și rândul, sau celula) și textul din jur.
- **Niveluri de încredere:**
  - **sigur:** o verificare independentă a trecut: total fără TVA + TVA = total, cifra de control a CUI sau o dată existentă în calendar;
  - **de verificat:** eticheta a fost găsită, dar valoarea nu are o verificare independentă;
  - **incert:** o verificare a eșuat;
  - **lipsă:** câmpul nu a fost găsit.
- **Import:** orice valoare care nu e „sigur”, orice corectură și orice valoare scrisă de mână trebuie confirmate. Câmpurile obligatorii trebuie să existe, iar aceeași factură nu se importă de două ori din greșeală. Factura și intrarea în jurnal (automate, confirmate, corectate, sursa și versiunea ei) se scriu într-o singură operație atomică.
- **Destinația:** registrul de facturi al modulului, care se poate exporta ca CSV. Modulele de business (Etapa 5) vor putea prelua din el.
- **Cod:** modulul folosește funcțiile de citire din `kgb-pdf` (verificarea strictă) și `kgb-sheets` (citirea cu protecție anti-bombă), ca biblioteci. Între module nu circulă date: fiecare are documentele lui.
- **Nefăcut:**
  - PDF-urile scanate, care cer OCR (D-035);
  - liniile de produse ale facturii;
  - alte tipuri de documente: extrase, contracte, pontaje.

### D-041 — Poarta Etapei 3
- **Data:** 7 nov. 2026 · **Statut:** DECIS · **Aprobat de:** proprietar („Aprob”), ca răspuns la `docs/ETAPA3_RAPORT.md`.
- **Conținut:** Etapa 3 se încheie, iar D-032 … D-040 sunt confirmate. **Începe Etapa 4** (Organizare și productivitate).
- **3.11:** proprietarul a trimis odată cu aprobarea fișiere reale: un PDF de tranzacție bancară, 4 registre Excel și poze ale unor documente. Ele conțin date reale, inclusiv personale.
  - Se folosesc **doar local** (`testdata/proprietar/`, ignorat de Git) și nu se publică.
  - Rezultatele se raportează doar agregat, fără conținut.

### D-042 … D-047 — Etapa 4 (Organizare și productivitate)
- **Data:** 7 nov. 2026 · **Statut:** DECIS (confirmate la poarta Etapei 4, D-048) — detalii în `docs/ETAPA4_PLAN.md`
- D-042: taskurile se atribuie unei liste locale de persoane; conturile și rolurile vin în Etapa 6;
- D-043: notificările sunt un serviciu al nucleului (`ctx.notify`, permisiunea `notify.send`);
- D-044: notificări desktop Windows doar cât rulează aplicația; fără serviciu de fundal sau email fără acord;
- D-045: generarea documentelor — DOCX cu completator propriu; **PDF cu Typst** (ales de proprietar pe 8 nov. 2026, „Typst”, în locul WebView2 recomandat: PDF-uri identice peste ani, cu prețul de ~+11,7 MB la installer);
- D-046: recurență cu reguli simple;
- D-047: aranjamentul panourilor e salvat în setările spațiului de lucru (aplicat la 4.10: setări schema 2, migrare automată de la schema 1). Extins la 7.4d (cerut de proprietar, 9 nov. 2026): panouri așezate liber (poziție și lățime ca parte din lățimea paginii, înălțime în pixeli), setări schema 3, migrare automată de la grila din schema 2; pornirea depinde de rol.

### D-048 — Poarta Etapei 4
- **Data:** 8 nov. 2026 · **Statut:** DECIS · **Aprobat de:** proprietar („aprob”), ca răspuns la `docs/ETAPA4_RAPORT.md`.
- **Conținut:** Etapa 4 se încheie; D-042 … D-047 sunt confirmate, iar pentru D-045 proprietarul a ales **Typst** pentru PDF. Pasul 4.8b (PDF din modele) se face cu Typst. **Începe Etapa 5** (Business).
- **De rezolvat de proprietar:** facturarea GitHub (CI oprit de la pasul 4.7).

### D-049 … D-054 — Etapa 5 (Business)
- **Data:** 8 nov. 2026 · **Statut:** DECIS (confirmate la poarta Etapei 5, D-055) — detalii în `docs/ETAPA5_PLAN.md`
- D-049: sume în bani (numere întregi), cantități cu 3 zecimale fixe, TVA pe linie rotunjit la ban; doar RON la început;
- D-050: costul stocului — cost mediu ponderat, pe depozit;
- D-051: documentele înregistrate nu se modifică; corecturile se fac prin storno, vizibil;
- D-052: „evidență primară”, nu contabilitate certificată; cotele de TVA se pot configura, cu dată de început (implicit 21%, 11%, 0%, de confirmat de proprietar sau de contabil); e-Factura și SAF-T nu fac parte din Etapa 5;
- D-053: un singur modul „Business” pentru stocuri și financiar;
- D-054: facturi pe serii, cu numere consecutive, fără goluri și fără refolosire.

### D-055 — Poarta Etapei 5
- **Data:** 8 nov. 2026 · **Statut:** DECIS · **Aprobat de:** proprietar („aprob”), ca răspuns la `docs/ETAPA5_RAPORT.md`.
- **Conținut:** Etapa 5 se încheie; D-049 … D-054 sunt confirmate. **Începe Etapa 6** (Echipe și rețea), la cererea proprietarului **întâi cu partea care se poate face pe un singur PC** („un singur pc”). Testul pe două PC-uri (S2.3, acum 6.10) rămâne 🔒 și e condiția porții Etapei 6 și a lui D-015.
- **De confirmat încă:** cotele de TVA 21/11/0 (cu contabilul); facturarea GitHub (CI oprit).

### D-056 … D-060 — Etapa 6 (Echipe și rețea)
- **Data:** 8 nov. 2026 · **Statut:** PROPUS — detalii în `docs/ETAPA6_PLAN.md`, de confirmat la poarta Etapei 6
- D-056: roluri pe module (fără acces / citire / scriere); implicite Administrator, Membru, Doar citire;
- D-057: protocolul de sincronizare e separat de rețea; iroh doar transportă mesajele;
- D-058: registru de membri semnat de administratori; un dispozitiv acceptă date doar de la dispozitive din registru;
- D-059: se sincronizează doar datele modulelor permise de rol, plus registrul; setările personale și cheile nu pleacă de pe PC;
- D-060: revocarea scoate dispozitivul din registru; datele deja copiate pe el nu pot fi șterse garantat de la distanță.

### D-061 — Etapa 7 începe înaintea porții Etapei 6
- **Data:** 8 nov. 2026 · **Statut:** DECIS · **Cerut de:** proprietar („Ok mergi mai departe adaugă mai multe module”), după raportul intermediar `docs/ETAPA6_RAPORT.md`.
- **Conținut:** Etapa 6 rămâne deschisă până la testul pe două PC-uri (🔒 6.10, programat luni seara, 9 nov. 2026) și poarta ei (🔒 6.12). Între timp începe Etapa 7 (`docs/ETAPA7_PLAN.md`), plus modulele „Echipă și pontaj” și „Calculator și conversii”, care nu depind de rezultatul testului de rețea.

### D-062 … D-065 — Etapa 7
- **Data:** 8 nov. 2026 · **Statut:** PROPUS — detalii în `docs/ETAPA7_PLAN.md`, de confirmat la poarta Etapei 7
- D-062: registru central de surse externe, cu condiții de folosire și dată de verificare; niciun modul nu folosește o sursă din afara lui;
- D-063: aplicația vine fără surse externe active; proprietarul le adaugă și le aprobă;
- D-064: pontaj declarativ, fără urmărirea calculatorului, ecranului sau locației;
- D-065: bani în bani întregi și în modulul de calcul; conversii cu factori exacți.

### D-066 — Agenda de parteneri, comună modulelor
- **Data:** 8 nov. 2026 · **Statut:** PROPUS (cerut de proprietar: fișa unui client/furnizor completată o dată, apoi folosită peste tot) — de confirmat la poarta Etapei 7
- **Conținut:** clienții și furnizorii stau într-o agendă din nucleu (ca registrul de surse), cu permisiuni `partners.read` / `partners.write` pentru module; fișa are datele de bază, câmpuri adăugate de mână (puncte de lucru, autorizații cu număr și date, licențe) și istoricul de unde a venit fiecare valoare (ANAF, document, mână). Modulele nu își citesc datele unul altuia (D-053 rămâne); agenda e un serviciu al nucleului, cu acces doar prin permisiune.
- **De ce:** fără ea, Business și „Documente și modele” ar ține fiecare propria listă de clienți și ar trebui completate de două ori.

### D-067 — Preluarea codului propriu din Cyber Office Studio și ERP
- **Data:** 8 nov. 2026 · **Statut:** DECIS pentru 5 module (proprietarul: „da confirm”, după analiza comparativă): PDF, Note, e-Factura + verificări CNP/CUI/IBAN, Foi de calcul, Editor de documente, în această ordine; imagini, prezentări și video lăsate pentru mai târziu
- **Conținut:** codul propriu al proprietarului din `Desktop\workspace\suite` poate fi adus în K.G.B. (D-019 cerea acordul lui; acesta e acordul de principiu), cu condițiile: în folderul sursă nu se modifică nimic (D-037); datele trec prin nucleul K.G.B. (fără sql.js/SQLite, localStorage, IndexedDB, API-uri Electron); licențele dependențelor verificate (fără GPL/AGPL/SSPL/BUSL; LGPL doar cu decizie separată; nimic încărcat de pe CDN); fișierele monolitice împărțite; testele refăcute în K.G.B.; originea consemnată în `LICENSES.md`.

### D-068 — Pagina de telefon legată de K.G.B.
- **Data:** 8 nov. 2026 · **Statut:** DECIS (proprietarul: „da”) — cerut de proprietar: recepție, poze de la șoferi, scanare QR în depozit, extras de cont, de pe telefon
- **Propunere:** K.G.B. de pe un PC al firmei servește o pagină web mică în rețeaua locală; telefonul se asociază o dată, scanând un cod QR afișat de K.G.B. (cheie proprie a telefonului, aprobată de administrator, ca la invitațiile din Etapa 6); fiecare acțiune de pe telefon intră în modulul potrivit, cu rolul persoanei; fără server central (D-004). Din afara biroului: mai târziu, prin relay-ul propriu (D-017).
- **De știut:** Windows poate cere permisiunea firewall-ului la prima pornire; aplicația nu îl configurează singură. Camera telefonului se folosește din browser, cu permisiunea telefonului.

### D-069 — Pagina de telefon servită de toate PC-urile, cu preluare automată
- **Data:** 9 nov. 2026 · **Statut:** CERUT de proprietar („nu face aplicația de telefon dependentă de un singur laptop… dacă un laptop se stinge rămâne pe alt laptop”); FĂCUT la 7.4m-4 (9 nov. 2026)
- **Ce se schimbă față de 7.4m-1:** telefoanele aprobate și ce trimit nu mai rămân doar pe un PC: circulă prin sincronizarea organizației (ca mesajele echipei), iar orice PC pornit le primește; aprobarea și scoaterea unui telefon rămân la administratori.
- **Cum se găsește un PC pornit:** în rețeaua biroului, un nume comun (`kgb.local`) la care răspunde fiecare PC pornit, fără server central (D-004); pe 4G prin Tailscale, pagina ține lista adreselor PC-urilor și o încearcă pe următoarea dacă una nu răspunde. Limită: pe 4G, linkul salvat pe telefon arată spre un PC; dacă acela e stins când deschizi pagina, deschizi adresa altui PC (sau, mai târziu, relay-ul propriu D-017 dă o adresă fixă).
- **Cum s-a făcut (7.4m-4):**
  - comutatorul paginii e unul singur pentru toată organizația (`core.phone_service`, tabel al organizației: acceptat doar de la administratori) și e ținut minte: după repornire pagina revine singură;
  - telefoanele (`core.phones`, doar amprenta cheii) ajung la toți membrii; un PC al unui membru poate înregistra doar un telefon „care așteaptă”, aprobarea și scoaterea sunt acceptate numai de la administratori;
  - ce trimit telefoanele și pozele ajung la administratori (și rămân pe PC-ul care le-a primit), nu la ceilalți membri;
  - fiecare PC își scrie doar propria fișă cu adresele (`core.phone_hosts`: rețeaua biroului și, dacă există, Tailscale); „văzut ultima dată” rămâne local;
  - `kgb.local`: un răspuns mDNS minimal (doar acest nume, doar întrebări A/ANY, TTL 30 s, fără „cache-flush”, ca mai multe PC-uri să răspundă împreună), pe portul 5353 împărțit cu Windows;
  - pagina de pe telefon întreabă întâi „răspunzi?” și trece la primul PC care răspunde (cereri între PC-uri cu CORS deschis; cheia telefonului e doar în antet, niciodată cookie); după aprobare, în Wi-Fi-ul firmei, trece o dată la `kgb.local`;
  - asocierea se face la adresa PC-ului care a afișat codul (codul nu circulă între PC-uri);
  - o aprobare sau o scoatere ajunge la celelalte PC-uri la următoarea sincronizare (cel mult un minut).

### D-070 — Ce citește și ce scrie telefonul (7.4m-6)
- **Data:** 9 nov. 2026 · **Statut:** DECIS (în limitele D-068; proprietarul a cerut funcțiile: „Fă-le pe care crezi tu”)
- **Citește** doar ce îi trebuie persoanei lui: numele și unitățile produselor din Business (pentru fișe și inventar), livrările încărcate / în drum unde e trecută ca șofer, taskurile ei din Planificator cu termen azi sau întârziate, ultimele 30 de mesaje ale echipei.
- **Scrie** doar în „Primite de pe telefon” (fișe, documente, extrase, inventar, bonuri, pontaj, etape de livrare, „task terminat”), plus un mesaj al echipei, semnat „Nume (telefon)”.
- **Nu scrie direct în Business, Echipă sau Planificator:** pe PC, cineva cu drepturile lui aplică cu un clic (recepție, inventar, plată, pontaj, etapă de livrare, task gata). Așa un telefon pierdut nu poate modifica evidențele; se scoate din pagina „Telefon”.
