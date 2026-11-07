# K.G.B. — Roadmap

Sursa: Master Plan §13. Nu se trece la etapa următoare doar pentru că etapa curentă compilează.

| Etapă | Conținut | Stare |
|---|---|---|
| 0 | Specificație și validare tehnică (spike-uri stocare, rețea, Tauri) | **Încheiată** — poartă aprobată de proprietar (D-022, 6 nov. 2026); rămâne testul 🔒 S2.3 cu 2 PC-uri, obligatoriu înainte de Etapa 6 |
| 1 | Nucleul desktop | **Încheiată** — poartă aprobată (D-027, 6 nov. 2026); drag-and-drop panouri → Etapa 4 |
| 2 | Storage Engine | **Încheiată** — poartă aprobată (D-031, 7 nov. 2026); 🔒 testul de pierdere a alimentării amânat, obligatoriu înainte de date reale |
| 3 | Documente și foi de calcul | **Încheiată** — poartă aprobată (D-041, 7 nov. 2026); module beta: PDF, foi de calcul (+5 șabloane), extragere date; fișierele reale ale proprietarului trec fără pierderi |
| 4 | Organizare și productivitate | **În lucru** — plan `docs/ETAPA4_PLAN.md` (preia și panourile drag-and-drop din Etapa 1) |
| 5 | Business | Neînceput |
| 6 | Echipe și rețea | Neînceput |
| 7 | Informații și proceduri | Neînceput |
| 8 | Comercializare | Neînceput |
| 9 | Extindere | Neînceput |

## Etapa 0 — progres

| Pas | Descriere | Stare |
|---|---|---|
| 0.1 | Fundație repo și documente | Făcut: repo privat GitHub Adriancu91/K.G.B, documente-schelet, CI |
| 0.2 | Toolchain MSVC | Făcut: build local funcțional după oprirea Smart App Control de către proprietar (D-020) |
| 0.3 | Spike S1 — stocare fără DB | **Testat în CI și pe laptop** (20/20 teste, 1.000 opriri forțate fără pierderi, benchmark 10k/100k/1M pe SSD NVMe) — vezi `docs/spikes/S1_REZULTATE.md`; filtrarea fără index nu atinge pragul (țintă Etapa 2) |
| 0.4 | Spike S2 — rețea între 2 PC-uri | **Parțial:** iroh testat cu 2 procese pe același PC (asociere cu invitație, mesaje criptate, transfer cu reluare + BLAKE3, eșecuri clare) — vezi `docs/spikes/S2_REZULTATE.md`; 🔒 LAN și internet cer al doilea PC; Nebula doar documentat |
| 0.5 | Spike S3 — Tauri 2 + React/TS | **Făcut pe laptop:** installer 1,18 MB, exe 3,2 MB, ~156 MB RAM privat, pornire ~1 s; UI → Rust → S1 verificat — vezi `docs/spikes/S3_REZULTATE.md`; MPL-2.0 de confirmat |
| 0.6 | Instalare componentă de rețea | Doar dacă se alege un VPN |
| 0.7 | Registru licențe | Făcut: S1, S2, S3 în `LICENSES.md`; `cargo-deny` în CI (licențe, crate-uri DB interzise, vulnerabilități); MPL-2.0 de confirmat (D-021) |
| 0.8 | Prototip UI minimal | Făcut: schiță de spațiu de lucru în prototipul S3; module cu stare reală („prototip” / „Etapa N — neimplementat”); temă salvată în S1 și verificată după oprire forțată |
| 0.9 | Raport final și poartă | Făcut: raport `docs/ETAPA0_RAPORT_FINAL.md`; poartă aprobată (D-022) |
