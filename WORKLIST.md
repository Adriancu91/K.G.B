# K.G.B. — Listă de lucru continuu

Reguli pentru fiecare pas (se aplică după FIECARE pas încheiat):
1. Verifică: build/teste rulate, rezultat real notat (nimic „gata” fără verificare).
2. Actualizează documentele afectate: `ROADMAP.md`, `LICENSES.md`, raportul spike-ului, `DECISION_LOG.md` / `RISK_REGISTER.md` dacă e cazul.
3. Commit + push pe `main` (mesaj în română, cu Co-Authored-By).
4. Bifează pasul aici și trece la următorul pas neblocat.
5. Pașii marcați 🔒 cer proprietarul (al doilea PC, aprobare, setări de securitate) — se sar și se raportează, nu se ghicesc.

Interdicții permanente: fără baze de date (D-005, D-018), fără schimbări de arhitectură, fără funcții incomplete prezentate drept terminate, fără modificări de setări de securitate, fără acces la alte foldere neaprobate.

## Etapa 0 — pași

- [x] S3.1 Schelet Tauri 2 + React/TS strict (`spikes/s3-tauri-shell`), icon generat
- [x] S3.2 `npm install`, `tsc` strict, build frontend
- [x] S3.3 Build Rust (MSVC) cu legătură la S1; comenzi status/list/add/delete
- [x] S3.4 Installer NSIS nesemnat; măsurat mărime installer + exe
- [x] S3.5 Măsurat timp pornire (până la fereastră) și RAM (proces + WebView2), 5 rulări
- [x] S3.6 Licențe npm + cargo pentru S3 în `LICENSES.md`
- [x] S3.7 Raport `docs/spikes/S3_REZULTATE.md`, ROADMAP 0.5
- [x] S1.x Corectare cele 3 avertismente clippy din S1
- [x] 0.7 `cargo-deny` (licențe + advisories) pentru S1 și S3
- [x] S2.1 Spike rețea iroh: 2 procese pe același PC (pairing cu invitație, mesaj criptat, transfer fișier cu hash + reluare)
- [x] S2.2 Relay indisponibil → eșec clar, nu blocaj (test local)
- [ ] 🔒 S2.3 2 PC-uri în LAN și prin internet — cere al doilea PC
- [x] S2.4 Comparație Nebula — documentată în `S2_REZULTATE.md`; testul practic cere driver + UAC → 🔒 doar dacă proprietarul vrea
- [x] 0.8 Prototip UI minimal marcat „prototip” (fără funcții false)
- [x] 0.9 Raport final Etapa 0 + recomandare stack/rețea (`docs/ETAPA0_RAPORT_FINAL.md`)
- [x] Poartă Etapa 0: aprobată de proprietar (D-022, 6 nov. 2026)

## Etapa 1 — pași (plan: `docs/ETAPA1_PLAN.md`)

- [x] 1.1 Workspace Cargo + CI pentru codul de produs
- [x] 1.2 `kgb-store` preluat din S1 (20 teste trec)
- [x] 1.3 Loguri și diagnosticare
- [x] 1.4 Workspace (folder, manifest, o singură instanță, refuz cloud)
- [x] 1.5 Setări tipizate și versionate
- [x] 1.6 Identitate locală (proprietar + cheie dispozitiv DPAPI)
- [x] 1.7 Module manager + contract
- [x] 1.8 Permission framework + audit
- [x] 1.9 Modul demonstrativ „Note” prin contract
- [x] 1.10 Shell UI (navigare, catalog, stare, setări, diagnostic, panouri)
- [x] 1.11 Installer (upgrade, dezinstalare cu păstrarea datelor)
- [x] 1.12 Demonstrația porții + `docs/ETAPA1_RAPORT.md`
- [x] 1.13 Poarta Etapei 1: aprobată (D-027)
- [ ] 🔒 S2.3 (din Etapa 0) 2 PC-uri, LAN + internet — înainte de Etapa 6

## Etapa 2 — pași (plan: `docs/ETAPA2_PLAN.md`)

- [x] 2.1 Benchmark extins (RAM, filtre) — tabel de bază
- [x] 2.2 Keydir pe colecții + scan doar pe înregistrările vii
- [x] 2.3 Interogări structurate cu decodare parțială — 5 teste; ținta atinsă după 2.4 (116 ms)
- [x] 2.4 Format binar v2 (D-028), compatibil cu v1, conversie doar la compactare (D-029) — 6 teste, 300 opriri forțate fără pierderi
- [x] 2.5 Compactare incrementală (pas ≤ 1 segment de 8 MB ≈ 91 ms; 4 teste; 300 opriri forțate cu compactare: 0 pierderi)
- [x] 2.6 Schema colecțiilor (tipuri, obligatorii, limite, enum; verificată la fiecare scriere a modulului; 3 teste; kgb.notes are schemă)
- [x] 2.7 Indexuri declarate în manifest (create la activare, reconstruite la deschidere, folosite automat de ctx.query; kgb.notes listează prin query; 2 teste; e2e 15/15)
- [x] 2.8 Fișiere atașate pentru module (files.own; proprietar per modul, BLAKE3 la citire, limită 64 MB, colectare explicită a blob-urilor fără referință; 4 teste)
- [x] 2.9 Backup/restore în aplicație (backup verificat; restaurare ca spațiu NOU, D-030; backup automat înainte de migrări și de conversia v1→v2; păstrate ultimele 5 automate; compactare, colectare fișiere, ștergerea resturilor la cerere; 6 teste + e2e 8/8)
- [x] 2.10 Teste de concurență (6 fire cu transferuri optimiste + conflicte reale, cititor care verifică invarianta, compactare și backup în paralel, a doua deschidere refuzată, un singur câștigător pe versiune; 3 teste, stabile la 5 rulări)
- [x] 2.11 Volum + corupere + opriri forțate pe laptop (10k/100k/1M pe v2; 1.000 opriri + 300 cu compactare: 0 pierderi; praguri D-022 toate atinse la 100k — vezi docs/etapa2/BENCH.md)
- [ ] 🔒 2.12 Pierderea alimentării pe VM — amânat (D-031, varianta b), obligatoriu înainte de date reale
- [x] 2.13 Raport Etapa 2 (`docs/ETAPA2_RAPORT.md`)
- [x] 2.14 Poarta Etapei 2: aprobată (D-031)

## Etapa 3 — pași (plan: `docs/ETAPA3_PLAN.md`)

- [x] 3.1 Set de fișiere de test `testdata/etapa3/` (35 fișiere: 33 generate determinist + 2 PDF din Edge, manifest SHA-256; verificat cu cititorul PDF din Windows)
- [x] 3.2 Spike S4 — PDF → D-032: lopdf (operații, 48/48 fără corupere), pdf.js (afișare), hayro (miniaturi), verificare strictă proprie 17/17; OCR Windows testat, română 🔒 (D-035) — `docs/spikes/S4_REZULTATE.md`
- [x] 3.3 Spike S5 — foi de calcul → D-033: calamine (citire, 0 prăbușiri pe XLSX reale), umya (salvare, 61/65 identice), IronCalc (formule, 95,9% ca Excel; 12/12 uzuale), rust_xlsxwriter (export); verificare anti-bombă zip proprie — `docs/spikes/S5_REZULTATE.md`
- [x] 3.4 Documente versionate în spațiul de lucru (D-034): `kgb_core::documents` prin `files.own`; original neatins, versiune nouă la fiecare salvare, salvare depășită refuzată, export ca copie; 7 teste (25 opriri forțate: nicio versiune pe jumătate); 108 teste în total
- [x] 3.5 Modulul PDF (beta) `kgb.pdf`: import prin dialog, miniaturi (hayro), afișare (pdf.js), rotire/scoatere/extragere/unire cu previzualizare și verificarea textului fiecărei pagini, versiuni + restaurare, export; deteriorate/criptate doar citire; 6 teste + e2e 20/20 (poarta 15/15, backup 8/8); installer 2,1 → 5,3 MB
- [x] 3.6 Modulul Foi de calcul (beta) `kgb.sheets`: XLSX/XLSM/XLS/XLSB/ODS/CSV (Windows-1250), tabel care încarcă doar rândurile vizibile (100k rânduri: deschidere ~0,6 s, salt la final ~0,3 s), editare XLSX cu previzualizare (ce se recalculează, ce s-ar pierde, ce formule nu se pot recalcula sigur — D-039), versiuni, export; bombă zip/parolă refuzate; 10 teste + e2e 18/18; installer 7,5 MB
- [x] 3.7 Șabloane (D-036): 5 șabloane (buget lunar, factură cu TVA 21%, registru de casă, cost/km, rate credit cu grafic pe 60 de luni), originale în cod, „Folosește” = copie nouă cu versiuni; formule documentate în `docs/etapa3/SABLOANE.md` și verificate cu valori calculate de mână (7 teste); e2e 21/21
- [x] 3.8 Import/export: import prin dialog (PDF, XLSX/XLSM/XLS/XLSB/ODS/CSV), export ca copie în formatul original, foaie → CSV (stil românesc sau standard, verificat prin reimport), CSV/ODS/XLS/XLSB/XLSM → .xlsx editabil (verificat celulă cu celulă; formulele altor formate devin valori); `ctx.export_bytes` în nucleu; 6 teste + e2e
- [x] 3.9 Extragere inițială de date (D-040) `kgb.extract`: facturi din PDF cu text și foi de calcul; sursă (pagină/rând sau celulă), încredere verificată independent (total = net + TVA, cifra de control CUI, dată reală), confirmare obligatorie pentru tot ce nu e „sigur”, jurnal atomic, duplicate refuzate, registru exportabil CSV; fără OCR (D-035); 8 teste (158 de fișiere reale fără oprire) + e2e 8/8
- [x] OCR în română: test tesseract.js + `ron` rulat cu acordul proprietarului (text corect cu diacritice ~0,6 s/pagină; tabele slabe → recunoaștere pe zone, pas viitor) — D-035
- [ ] 3.10 Test de necorupere pe tot setul + fișiere stricate
- [ ] 🔒 3.11 Fișiere reale, fără date confidențiale, de la proprietar
- [ ] 3.12 Raport Etapa 3 (`docs/ETAPA3_RAPORT.md`)
- [ ] 🔒 3.13 Poarta Etapei 3
