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
- **Data:** 7 nov. 2026 · **Statut:** PROPUS — detalii și alternative în `docs/ETAPA3_PLAN.md`
- D-032: biblioteca PDF se alege după spike-ul S4 (licență, fidelitate, viteză);
- D-033: biblioteca pentru foi de calcul se alege după spike-ul S5;
- D-034: documentele nu se suprascriu niciodată. Fiecare salvare creează o versiune nouă, iar originalul importat rămâne neatins;
- D-035: OCR-ul (text din scanări și imagini) se evaluează separat și nu intră în Etapa 3 dacă cere programe externe sau licențe neclare;
- D-036: șabloanele originale sunt doar de citire. Utilizatorul lucrează pe o copie.
