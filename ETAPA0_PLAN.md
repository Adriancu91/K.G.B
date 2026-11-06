# K.G.B. — Raport de audit și plan tehnic pentru Etapa 0

**Data:** 6 noiembrie 2026 · **Statut:** PROPUS — așteaptă aprobarea proprietarului
**Documente de referință:** `KGB_MASTER_PLAN.md` v1.0, `KGB_CLAUDE_CODE_METAPROMPT.md` v1.0

> Nimic din acest document nu este implementat. Este un plan. Toate pragurile și alegerile tehnice sunt PROPUSE.

---

## 1. Starea actuală (ce am inspectat)

### 1.1 Folderul proiectului
| Element | Stare |
|---|---|
| `KGB_MASTER_PLAN.md`, `KGB_CLAUDE_CODE_METAPROMPT.md` | Există, citite integral |
| `DECISION_LOG.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `MODULE_CONTRACT.md`, `RISK_REGISTER.md`, `TEST_STRATEGY.md` | Lipsesc |
| Cod sursă | Nu există |
| Git | Folderul **nu** este repository git; nu e legat de repo-ul GitHub „K.G.B” |
| `gh` (GitHub CLI) | Neinstalat — nu am putut verifica repo-ul GitHub |

### 1.2 Mediul de dezvoltare (acest PC)
| Componentă | Versiune / stare | Impact |
|---|---|---|
| Windows 11 Pro | 10.0.26300 | OK |
| Node.js / npm | 24.20.0 / 11.19.0 | OK pentru React + TS |
| Rust / cargo | 1.99.1, **doar toolchain GNU** (`x86_64-pc-windows-gnu`) | **Blocaj Tauri** — vezi §3.1 |
| Visual Studio Build Tools (MSVC) | **Lipsă** | Necesare pentru Tauri pe Windows |
| WebView2 Runtime | 156.0.4314.58 | OK (motorul de afișare al Tauri) |
| Git / Python | 2.55 / 3.12.10 | OK |
| Hardware | ~8 GB RAM, SSD 250 GB (121 GB liberi) | Folosit ca „hardware țintă minim” pentru praguri |

### 1.3 Celelalte proiecte de pe Desktop (inventar superficial — **nu am citit cod**)
| Folder | Ce pare să fie | Relevanță pentru K.G.B. |
|---|---|---|
| `workspace/` | Cyber Office Studio 0.9.x — Electron 33 + React 18 + TypeScript + Vite, git, are `CLAUDE.md`, `COMPATIBILITATE.md`, formate proprii `.ssheet`/`.sdoc`, installer | **Mare** — componente UI React, motor spreadsheet/documente, experiență de installer și auto-update (Etapele 0-UI, 3, 8) |
| `nexus-chat/` | Node: server WebSocket (`ws`) + web, git | Mică — idei pentru protocolul de mesaje; serverul în sine contrazice D-004 |
| `cyber army/` | Aplicație Python, are subfolder `licensing/` | Mică/medie — doar pentru Etapa 8 (licențiere) |
| `gpu/` | Workspace Rust cu crate-uri, CI, documentație | Mică — convenții Rust/CI |
| `auto update/` | Gol | — |
| `kituri versiuni cos/`, `Office Suite Test 0.9.2/` | Pachete compilate / installere | Fără surse |
| `LUCRU/`, `modele/`, fișiere de pe Desktop | Documente reale de firmă (salarii, extrase bancare, stocuri) | **Nu le ating.** Pot servi la Etapa 3 ca fișiere de test doar cu aprobare și ca copii anonimizate |

---

## 2. Structura propusă a repository-ului

Documentele directoare rămân la rădăcină (nu le mut). Prototipurile (spike-urile) sunt izolate, ca să nu devină accidental „produsul”.

```text
Kronos-Global-Business/            (repo git → GitHub „K.G.B”)
├─ KGB_MASTER_PLAN.md
├─ KGB_CLAUDE_CODE_METAPROMPT.md
├─ DECISION_LOG.md                 D-001…D-012 preluate + decizii noi
├─ ARCHITECTURE.md · ROADMAP.md · MODULE_CONTRACT.md
├─ RISK_REGISTER.md · TEST_STRATEGY.md · LICENSES.md (SBOM)
├─ docs/spikes/                    rapoarte cu măsurători pentru fiecare spike
├─ spikes/
│  ├─ s1-storage/                  crate Rust izolat + benchmark + teste de crash
│  ├─ s2-network/                  două programe CLI „peer” + test de transfer
│  └─ s3-tauri-shell/              fereastră Tauri 2 + React/TS minimal
├─ crates/                         (gol — nucleul vine în Etapa 1)
└─ app/                            (gol — interfața vine în Etapa 1)
```

---

## 3. Fezabilitate și riscuri

### 3.1 Tauri 2 + React + TypeScript (D-010, PROPUS)
- **Fezabil.** WebView2 este prezent pe Windows 11.
- **Blocaj:** Tauri pe Windows cere compilatorul Microsoft (MSVC Build Tools, workload „Desktop development with C++”) și toolchain-ul Rust `stable-x86_64-pc-windows-msvc`. Instalarea cere UAC → **aprobarea ta**.
- Notă licență: VS Build Tools sunt gratuite pentru persoane și firme mici; o firmă mare (>250 PC-uri sau >1 mil. USD venit) ar avea nevoie de licență Visual Studio. De consemnat.
- Notă „fără DB”: WebView2 (ca orice browser) are intern stocare proprie pentru cache. **Nu o folosim pentru date** (fără IndexedDB/localStorage pentru date operaționale); se documentează.
- Proiectul existent Cyber Office Studio e pe **Electron**. Componentele React se pot reutiliza; shell-ul diferă. Tauri dă installer mult mai mic și memorie mai mică — de măsurat în spike.

### 3.2 Motorul de stocare fără DB (D-005, D-006, DECIS) — **risc tehnic #1**
**Fezabil, dar este cea mai costisitoare piesă de inginerie.** Practic construim propriul motor de stocare minimal. Design propus pentru spike:

| Componentă | Propunere |
|---|---|
| Jurnal | Append-only, segmentat (ex. 64 MB/segment). Fiecare intrare: lungime + checksum (CRC32C) + antet (ID obiect UUIDv7, versiune, ID dispozitiv, ceas hibrid HLC, tip operație) + conținut |
| Format conținut | JSON în prototip; CBOR/MessagePack măsurat comparativ (§9.2-B din plan) |
| Snapshot / compactare | Fișier nou scris în temp → `FlushFileBuffers` → `MoveFileExW(REPLACE_EXISTING \| WRITE_THROUGH)`; un `manifest` indică snapshot-ul curent + segmentele active |
| Index | În memorie, reconstruit din snapshot + jurnal; index persistent opțional, mereu regenerabil |
| Recovery | La pornire: scanează coada jurnalului; o intrare incompletă/coruptă se **mută în carantină**, nu se șterge |
| Concurență | Un singur proces scriitor per spațiu de lucru (`LockFileEx`); în proces, scrieri serializate; verificare optimistă de versiune (`expected_version`) |
| Fișiere / atașamente | Stocare după hash (BLAKE3) în `blobs/`, metadate în înregistrări; numele fișierului nu e ID |
| Sincronizare 2 copii | Schimb de evenimente din jurnal; merge determinist pe câmpuri; conflict ambiguu → marcat pentru utilizator |

Riscuri specifice Windows: antivirusul/Defender sau indexarea pot bloca temporar `rename`; foldere OneDrive/Dropbox corup semantica atomică → spațiul de lucru **nu** are voie să stea într-un folder sincronizat în cloud (verificare la pornire).

**Biblioteci interzise** (sunt motoare DB embedded): `rusqlite/sqlite`, `sled`, `redb`, `rocksdb`, `lmdb/heed`, `fjall`, `sea-orm`/`diesel` etc.
**Zonă gri (decizie ulterioară, nu în Etapa 0):** `tantivy` — bibliotecă de căutare full-text cu propriile fișiere de index; nu e DB, dar va cere aprobare înainte de Etapa 2.

**Praguri PROPUSE** (pe hardware ca acesta: 8 GB RAM, SSD; înregistrări ~1 KB) — se fixează abia după măsurare și aprobarea ta:

| Măsurătoare | Prag propus |
|---|---|
| Scriere unitară durabilă (cu flush pe disc), p95 | < 10 ms |
| Lot de 1.000 scrieri într-o tranzacție | < 200 ms |
| Pornire + reconstruire index, 100.000 înregistrări | < 2 s |
| Pornire + reconstruire index, 1.000.000 înregistrări | < 20 s |
| Căutare după câmp indexat | < 5 ms |
| Filtrare fără index, 100.000 înregistrări | < 200 ms |
| Spațiu pe disc după compactare | < 2× volumul datelor |
| 1.000 de opriri forțate aleatoare în timpul scrierii | 0 pierderi de tranzacții confirmate, 0 corupere nedetectată |

### 3.3 Rețeaua între PC-uri (D-007, D-008 DECIS; D-009 PROPUS) — **risc tehnic #2**
Ce trebuie să știi: pentru conectare „de oriunde” prin NAT/firewall, **orice** soluție are nevoie de un serviciu auxiliar pe internet (coordonare și/sau relay). Întrebarea reală e **cine îl operează** și **ce află** el.

Comparație preliminară (din cunoștințele mele; licențele și modelele trebuie re-verificate pe versiunile actuale în spike — conform §12.3):

| Candidat | Licență (de verificat) | Control-plane / relay | Instalare pe Windows | Probleme față de plan |
|---|---|---|---|---|
| **NetBird** | Client BSD-3; serverele (management, signal, relay) trecute pe **AGPL-3.0** | Cloud NetBird sau self-host | Serviciu + driver WireGuard/wintun → UAC | Serverul de management self-host folosește **SQLite/Postgres** → conflict cu D-005 dacă îl operăm noi; AGPL cere analiză juridică |
| **Tailscale** | Client BSD-3; control-plane **proprietar (SaaS)** | Tailscale Inc. | Serviciu + driver → UAC | Dependență comercială de terț; Headscale (alternativa self-host) folosește SQLite/Postgres |
| **Nebula** | MIT | „Lighthouse” + relay operate de noi; **fără DB**, certificate semnate de admin | Driver wintun → UAC | NAT traversal mai slab; trebuie operat un server cu IP public |
| **iroh** (propunere nouă) | MIT / Apache-2.0 | Relay-uri publice n0 sau propriul `iroh-relay` (fără DB) | **Bibliotecă Rust în aplicație — fără driver, fără serviciu, fără UAC** | Nu e VPN (nu creează rețea privată pentru alte programe — nu ne trebuie); API mai tânăr, de verificat stabilitatea |

**Recomandarea mea:** în Etapa 0 să testăm **iroh** (conexiune directă criptată QUIC/TLS 1.3 între dispozitive, cu ocolire NAT și relay de rezervă) ca prim candidat, și **un** candidat de tip VPN (Nebula sau NetBird) pentru comparație. Motiv: planul spune deja că VPN-ul nu oferă sincronizarea (§8.2) și că sincronizarea se face prin protocol de aplicație (§9.5). O conexiune integrată direct în aplicație îndeplinește D-007 și D-008 fără driver, fără UAC și fără un al doilea program instalat. **Asta modifică raționamentul din D-009 → cere aprobarea ta.**

### 3.4 Comunicare securizată și identitate
- Fără criptografie proprie: TLS 1.3 / QUIC (`rustls`) sau WireGuard (Noise), după candidat.
- Fiecare PC generează local o pereche de chei Ed25519; cheia privată protejată prin Windows DPAPI.
- Pairing: invitație aleatoare, unică, cu expirare; adminul aprobă (semnează) dispozitivul; nicio cheie în installer.
- Permisiunile se verifică în aplicație, la fiecare mesaj, nu doar la nivel de rețea.

### 3.5 Contradicții / ambiguități găsite
1. **D-005 vs. server de coordonare** — NetBird/Headscale self-host folosesc DB pe serverul de coordonare. Acolo nu sunt date de business, dar litera deciziei interzice DB „nici central”. Ai nevoie să decizi dacă se aplică și infrastructurii de rețea (dacă alegem iroh sau Nebula, problema dispare).
2. **Cine operează relay-ul** — Kronos (cost lunar, responsabilitate de operare) sau terț (dependență, metadate: IP-uri și chei publice, nu conținut).
3. **Prototip UI în Etapa 0** — planul îl cere; propun un prototip minimal, marcat clar „prototip”, eventual cu componente reutilizate din Cyber Office Studio (necesită aprobare pentru citirea folderului).

### 3.6 Registru inițial de riscuri (va deveni `RISK_REGISTER.md`)
| # | Risc | Probabilitate | Impact | Măsură în Etapa 0 |
|---|---|---|---|---|
| R1 | Motorul de stocare pierde/corupe date | Medie | Critic | Spike S1 cu teste de oprire forțată și corupere |
| R2 | Conexiunea nu trece prin anumite NAT/firewall | Medie | Mare | Test LAN + internet (hotspot telefon) + relay oprit |
| R3 | Licență incompatibilă (AGPL, condiții comerciale) | Medie | Mare | Matrice licențe + `cargo-deny` + SBOM |
| R4 | Dependență de serviciu extern (relay/control-plane) | Mare | Mediu | Documentare + variantă self-host |
| R5 | Toolchain Windows (MSVC) | Sigur | Mic | Instalare aprobată |
| R6 | Scope prea mare | Mare | Mare | Porți de acceptare; fără module în Etapa 0 |
| R7 | Antivirus / foldere cloud interferă cu scrierile atomice | Medie | Mare | Test cu Defender activ; refuz folder sincronizat |
| R8 | Lipsa unui al doilea PC pentru teste reale | ? | Mare | Ai nevoie de al doilea PC/laptop, ideal pe altă rețea |

---

## 4. Planul Etapei 0 (în ordinea recomandată)

Ordinea respectă recomandarea ta: **întâi stocarea și conectivitatea**, interfața după.

| Pas | Ce | Livrabil | Criteriu de acceptare |
|---|---|---|---|
| 0.1 | Fundație | `git init`, `.gitignore`, legare la GitHub „K.G.B”, documentele lipsă, `DECISION_LOG.md` cu D-001…D-012 | Repo publicat, documente prezente |
| 0.2 | Toolchain | VS Build Tools (C++) + Rust MSVC | `cargo build` cu MSVC reușește |
| 0.3 | **Spike S1 – Stocare** | Crate Rust izolat: jurnal, snapshot, index, recovery, lock, blobs, sync 2 copii | Teste de volum 10k/100k/1M, crash aleator, fișier corupt, index șters, 2 procese, conflict offline — toate rulate, cu raport de măsurători |
| 0.4 | **Spike S2 – Rețea** | Matrice licențe/control-plane; 2 programe CLI peer (iroh + 1 candidat VPN); pairing cu invitație; mesaje criptate; transfer fișier cu hash și reluare | Funcționează: 2 procese pe același PC, 2 PC-uri în LAN, 2 PC-uri prin internet, relay indisponibil → eșec clar, nu blocaj |
| 0.5 | Spike S3 – Tauri | Fereastră Tauri 2 + React/TS strict, apel către S1; installer nesemnat | Build reușit; măsurat: mărime installer, timp pornire, RAM |
| 0.6 | Instalare componentă rețea | Doar dacă se alege un VPN: instalare automată serviciu/driver cu UAC | Instalare/dezinstalare curată pe Windows |
| 0.7 | Licențe | `LICENSES.md`, `cargo-deny`, verificare npm | Nicio dependență cu licență neverificată |
| 0.8 | Prototip UI minimal | Schiță workspace marcată „prototip” | Nicio funcție falsă prezentată ca reală |
| 0.9 | Raport final + poartă | Rezultate, praguri propuse, recomandare stack și rețea | Aprobarea ta pentru Etapa 1 |

Dependențe noi propuse pentru spike-uri (toate de verificat la licență): `serde`, `serde_json`, `crc32c`, `blake3`, `uuid`, `windows-sys` (S1); `iroh`, `tokio`, `rustls` (S2); `tauri`, `react`, `vite`, `typescript` (S3).

---

## 5. Decizii necesare de la tine
1. Aprobi planul Etapei 0 și structura de directoare?
2. Aprobi instalarea VS Build Tools + toolchain Rust MSVC (cere UAC)?
3. Aprobi adăugarea **iroh** (conexiune integrată, fără VPN/driver) ca prim candidat de rețea, alături de un candidat VPN?
4. Pentru testul prin internet: accepți folosirea temporară a relay-urilor publice ale furnizorului (văd IP-uri și chei publice, nu conținut), sau vrei de la început un relay propriu?
5. Care e adresa exactă a repo-ului GitHub (utilizator/K.G.B)? Instalez `gh` sau folosesc doar `git`?
6. Îmi dai acces la `workspace/` (Cyber Office Studio) pentru analiza codului reutilizabil? Opțional și `cyber army/licensing`.
7. Ai un al doilea PC/laptop pentru testul de rețea (ideal unul care poate ieși pe internet prin hotspot de telefon)?
