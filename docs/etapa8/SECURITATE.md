# K.G.B. — Verificarea de securitate înainte de livrare (pasul 8.11)

**Data:** 13 nov. 2026 · **Pe codul din:** `main` după 8.1–8.2, 8.8, 8.10, 8.18–8.20.
**Cum:** citirea codului și a configurației, plus testele care o dovedesc (numite la fiecare punct). Unde ceva nu s-a putut verifica, scrie aici.

## Pe scurt
- **Reparat acum:** „Setări › Internet” oprit nu oprea și sursele pornite (cursul BNR, vremea, știrile, căutarea ANAF). Acum le oprește pe toate. Test: e2e `privacy`.
- **Deschis, cere acordul proprietarului:** scanarea dependențelor după vulnerabilități cunoscute. Unealta (`cargo-deny`) rula în GitHub Actions, oprite din 8 nov. din cauza plății contului. Pe laptop nu e instalată, iar instalarea unei unelte noi cere acordul lui.
- **Restul e în regulă** (detalii mai jos).

## 1. Conținutul ferestrei (CSP)
`tauri.conf.json`: `default-src 'self'`; scripturi doar din aplicație (plus `wasm-unsafe-eval` pentru motorul de calcul); imagini `self`/`data:`/`blob:`; media `self`/`blob:`; conexiuni doar spre aplicație și IPC. **Neschimbat în Etapa 8.** Ferestrele web și radioul nu l-au lărgit: rulează în ferestre separate.

## 2. Permisiunile ferestrelor
| Fereastra | Ce poate chema | Dovada |
|---|---|---|
| `main` (aplicația) | comenzile aplicației, plus dialogurile Deschide/Salvează ale Windows | `capabilities/default.json` (doar `main`) |
| `print-*` (tipărire, ascunsă) | doar cele două comenzi de tipărire | filtrul din `main.rs` |
| `clip-*` (Ferestre web), `radio-*` | **nimic** | filtrul din `main.rs` refuză orice comandă; în plus, Tauri o refuză prin ACL. e2e `webclips`: „Command app_info not allowed by ACL” |

Modulele au permisiuni declarate în manifest, acordate la activare (neschimbat).

## 3. Căile spre internet
Toate pleacă prin nucleu (Rust), niciodată direct din pagină:

| Ce | Când pleacă | Reguli |
|---|---|---|
| „Din web…”, marca temporală a semnăturii | la clic | D-086: fără adrese locale (verificate după DNS), fără cookie-uri, fără proxy, cel mult 10 MB, jurnal fără query |
| Curs BNR, vremea, știrile, ANAF | la deschiderea panoului sau la căutare | sursa pornită în „Surse externe” (D-063) **și** „Setări › Internet” pornit (reparat acum) |
| Programul de facturare online | la clic | doar două cereri de citire (test `invoicing_guard`), cheia sigilată DPAPI (D-089) |
| Radio | la căutare sau pornire | sursa pornită, internetul pornit, doar adrese https publice (`web_guard`, test unitar) |
| Ferestre web | la deschidere; reîncărcare doar dacă omul alege | doar https publice, fără descărcări, pop-up-uri sau permisiuni; linkurile în browser; InPrivate (D-099) |
| Sincronizarea între PC-uri (iroh) | când organizația e pornită | criptat, doar între dispozitivele semnate ale organizației. Releul pentru producție e decizia D-017 (🔒) |

**Telemetrie: niciuna (D-096).** e2e `privacy`: cu setările implicite, după un tur prin pagini nu pleacă nicio cerere. Cu internetul oprit nu pleacă nici cele ale surselor pornite. Controlul arată că proxy-ul testului chiar vede cererile.

## 4. Ce rămâne în jurnal și în pachetul de diagnostic
- **Jurnalul de pe disc** (`logs/`) e local. `net_fetch` scrie doar gazda și calea, fără query. Cheile și parolele nu se scriu.
- **Pachetul de diagnostic** (8.10) trece prin `log::scrub`, care ascunde: șirurile de 10+ cifre (CNP, card, telefon), IBAN-urile, adresele de e-mail, tokenurile lungi și numele utilizatorului Windows din căi. Test unitar `scrub_tests` și e2e `privacy` pe fișierul salvat. Pachetul rămâne pe calculator; îl trimite omul, dacă vrea.

## 5. Cheile
- **Cheia dispozitivului** (cu ea se semnează registrul organizației și se autentifică sincronizarea): sigilată cu DPAPI pentru utilizatorul Windows (`identity.rs`, `dpapi::protect`).
- **Cheia programului de facturare online:** DPAPI, doar pe acest PC, nu se dă înapoi paginii, nu se sincronizează (D-089).
- **Cheile de semnare a programului, a actualizărilor și a licențelor** (8.5–8.7): nu există încă. Le va ține proprietarul, nu repo-ul.
- **În repo:** nicio cheie sau parolă. Datele de test sunt generate; fișierele proprietarului stau doar în `testdata/proprietar/`, ignorat de git.

## 6. Dependențele
- **Licențe:** verificate în 8.1 (`docs/LICENTE_COMPONENTE.md`): 768 de componente, nicio licență necunoscută sau neacceptată.
- **Vulnerabilități cunoscute:** **neverificat acum**; vezi „Pe scurt”. Variante: reluarea GitHub Actions (plata contului) sau acordul pentru `cargo install cargo-deny` pe laptop.
- **Biblioteci noi în Etapa 8:** niciuna. `url` era deja în arbore, la aceeași versiune.

## 7. De știut
- **SmartScreen:** wry (stratul Tauri peste WebView2) oprește implicit SmartScreen în toate ferestrele aplicației, deci și în Ferestre web. Am încercat să-l las pornit cu un profil de browser separat; WebView2 a refuzat al doilea proces (0x8007139F). Paginile din Ferestre web rămân limitate la https public, fără descărcări și fără permisiuni.
- **Installerul nu e semnat** (8.5, 🔒): Windows avertizează la instalare.
