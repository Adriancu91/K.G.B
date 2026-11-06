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
| D-009 | NetBird este candidat de evaluare, nu alegere finală | PROPUS |
| D-010 | Tauri 2 + React + TypeScript | PROPUS |
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
