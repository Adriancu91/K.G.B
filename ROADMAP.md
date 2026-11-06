# K.G.B. — Roadmap

Sursa: Master Plan §13. Nu se trece la etapa următoare doar pentru că etapa curentă compilează.

| Etapă | Conținut | Stare |
|---|---|---|
| 0 | Specificație și validare tehnică (spike-uri stocare, rețea, Tauri) | **În lucru** — plan aprobat (D-013) |
| 1 | Nucleul desktop | Neînceput |
| 2 | Storage Engine | Neînceput |
| 3 | Documente și foi de calcul | Neînceput |
| 4 | Organizare și productivitate | Neînceput |
| 5 | Business | Neînceput |
| 6 | Echipe și rețea | Neînceput |
| 7 | Informații și proceduri | Neînceput |
| 8 | Comercializare | Neînceput |
| 9 | Extindere | Neînceput |

## Etapa 0 — progres

| Pas | Descriere | Stare |
|---|---|---|
| 0.1 | Fundație repo și documente | Făcut: repo privat GitHub Adriancu91/K.G.B, documente-schelet, CI |
| 0.2 | Toolchain MSVC | Instalat (VS Build Tools 2022 + Rust MSVC); build blocat de Smart App Control (D-020) |
| 0.3 | Spike S1 — stocare fără DB | **Testat în CI** (20/20 teste, 300 opriri forțate fără pierderi, benchmark 10k/100k/1M) — vezi `docs/spikes/S1_REZULTATE.md`; de repetat pe PC țintă; filtrarea fără index nu atinge pragul |
| 0.4 | Spike S2 — rețea între 2 PC-uri | Cercetare făcută (`docs/spikes/S2_RETEA_MATRICE.md`): iroh prim candidat, Nebula comparație; cod neînceput; lipsește al doilea PC |
| 0.5 | Spike S3 — Tauri 2 + React/TS | Neînceput; depinde de 0.2 |
| 0.6 | Instalare componentă de rețea | Doar dacă se alege un VPN |
| 0.7 | Registru licențe | Început: dependențele S1 verificate (`LICENSES.md`) |
| 0.8 | Prototip UI minimal | Neînceput |
| 0.9 | Raport final și poartă | Neînceput |
