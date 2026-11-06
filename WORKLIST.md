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
- [ ] 1.11 Installer (upgrade, dezinstalare cu păstrarea datelor)
- [ ] 1.12 Demonstrația porții + `docs/ETAPA1_RAPORT.md`
- [ ] 🔒 1.13 Poarta Etapei 1: aprobarea proprietarului
- [ ] 🔒 S2.3 (din Etapa 0) 2 PC-uri, LAN + internet — înainte de Etapa 6
