# K.G.B. — Etapa 8: raport

**Data:** 13 nov. 2026 · **Statut:** CIORNĂ. Partea care nu cere banii, cheile sau deciziile proprietarului e făcută. Restul așteaptă deciziile lui (lista de la final). Planul: `docs/ETAPA8_PLAN.md`.
Au lucrat două sesiuni: sesiunea K.G.B. (nucleul, installerul, securitatea, documentația, porțile) și sesiunea COS (modelele, procedurile, modulele noi). Fiecare pas are în `WORKLIST.md` dovada lui (commit-ul și testele trecute în fereastra reală).

## Pe scurt
- **Comercializare, partea fără bani și fără decizii:**
  - licențele tuturor componentelor (8.1);
  - versiunea într-un singur loc, cu canalul de test (8.2);
  - fără telemetrie, dovedit cu un test (8.8);
  - ghidul utilizatorului în aplicație și ca PDF, plus ghidul de instalare (8.9);
  - pachetul de diagnostic fără date personale (8.10);
  - verificarea de securitate (8.11);
  - installerul în română, cu WebView2 adus doar dacă lipsește și cu datele păstrate la dezinstalare (8.3, fără proba pe mediul curat).
- **Cerute de proprietar pe 13 nov.:**
  - știri pe Acasă (8.18);
  - radio gratuit (8.19);
  - „Ferestre web”, o parte dintr-o pagină înghețată și văzută live (8.20);
  - 10 modele de documente noi (8.15);
  - catalogul de proceduri cu 42 de proceduri, cele de construcții după noul cod (8.16);
  - 6 tipuri noi de activitate și 4 module noi: Service auto, Cursuri și cursanți, Membri și cotizații, Spații și chiriași (8.17).
- **Decizii noi:**
  - D-095: WebView2 adus doar dacă lipsește;
  - D-096: fără telemetrie;
  - D-097: datele rămân la dezinstalare;
  - D-098: radio;
  - D-099: Ferestre web.

  Toate sunt DECISE de comun acord de cele două sesiuni (D-074). D-092, D-093 și D-094 rămân ale proprietarului.

## Ce s-a făcut
| Pas | Ce | Dovada |
|---|---|---|
| 8.1 | 768 de componente (615 Rust, 153 JavaScript), niciuna fără licență sau cu licență neacceptată; atribuirile se livrează cu programul și se văd în „Diagnostic” | `tools/licenses.mjs`, `docs/LICENTE_COMPONENTE.md` |
| 8.2 | Versiunea doar în `Cargo.toml`; canalul „stabil” sau „test”, ales la build; banda doar pe canalul de test | test `version_tests` |
| 8.3 | Installer pentru utilizatorul curent, fără administrator; WebView2 adus doar dacă lipsește; textele în română, cu ce e de făcut fără internet; bifa de ștergere a datelor debifată; scenariul automat instalare → upgrade → dezinstalare → reinstalare | `app/e2e/installer.mjs` (de rulat pe mediul curat, 8.4) |
| 8.8 | Nicio cerere fără clic; cu internetul oprit nu pleacă nici cererile surselor pornite | e2e `privacy` 6/6 |
| 8.9 | „Ajutor”: capitole generale și un capitol pentru fiecare modul, căutare, PDF, RO/EN; ghidul de instalare și administrare | e2e `help` 12/12, `docs/GHID_INSTALARE.md` |
| 8.10 | Raportul de diagnostic ascunde CNP-uri, carduri, telefoane, IBAN-uri, e-mailuri, chei și numele utilizatorului Windows; „Probleme cunoscute” | test `scrub_tests`, e2e `privacy` |
| 8.11 | CSP, permisiunile ferestrelor, căile spre internet, jurnalul, cheile. Reparat: „Setări › Internet” oprit oprește acum toate cererile | `docs/etapa8/SECURITATE.md` |
| 8.15 | 10 modele PDF noi și categoria „Protecția datelor” | e2e docs 15/15, pdf 52/52 |
| 8.16 | 42 de proceduri; cele 7 de construcții rescrise după Legea 169/2026 | e2e permits-catalog 14/14 |
| 8.17 | 6 activități noi; modulele `kgb.autoservice`, `kgb.courses`, `kgb.members`, `kgb.rentals` | e2e autoservice 9/9, courses 8/8, members 7/7, rentals 7/7 |
| 8.18 | Panoul „Știri”; 5 surse RSS propuse, verificate pe 13 nov., oprite din fabrică | e2e home-news-radio 8/8 |
| 8.19 | Panoul „Radio” (Radio Browser), într-o fereastră ascunsă, izolată | e2e home-news-radio 8/8 |
| 8.20 | „Ferestre web”: fără acces la K.G.B., InPrivate, doar https publice, fără descărcări, pop-up-uri sau permisiuni | e2e webclips 7/7 |

## Ce NU e făcut și de ce
- **8.3, proba installerului:** instalarea, upgrade-ul și dezinstalarea nu se încearcă pe laptopul proprietarului, fiindcă ar atinge K.G.B.-ul lui instalat. Rulează în mediul curat (8.4).
- **8.4 🔒 Mediul curat:** Windows Sandbox, o mașină virtuală sau al doilea PC, pornite de proprietar.
- **8.5 🔒 Semnarea (D-092):** certificatul sau serviciul, ales și plătit de proprietar.
- **8.6, actualizarea din aplicație (D-094 🔒):** cere locul unde stau actualizările, cheia de semnare a proprietarului și acordul pentru biblioteca oficială de actualizare Tauri.
- **8.7, licența (D-093 🔒):** cere modelul comercial și cheia proprietarului.
- **8.10, adresa de contact pentru suport 🔒:** o alege proprietarul.
- **8.11, scanarea vulnerabilităților din dependențe 🔒:** `cargo-deny` rula în GitHub Actions, oprite din cauza plății contului. Pe laptop, instalarea lui cere acordul proprietarului.
- **8.12 🔒:** numele comercial, domeniile, contractul de licență (EULA) și nota de confidențialitate.
- **Limite cunoscute** (sunt și în „Probleme cunoscute” din aplicație):
  - ferestrele web nu îngheață paginile care se derulează într-o zonă interioară;
  - radioul arată doar posturile pe https;
  - orele știrilor de la gov.ro nu au fus orar;
  - muzica de pe PC nu e încă făcută.

## Ce decide proprietarul
1. **D-092, semnarea:** certificat OV pe numele firmei sau serviciul Microsoft (verificăm costurile și eligibilitatea când alege).
2. **D-093, licența:** gratuit în perioada de probă acum; la lansare, abonament sau licență perpetuă.
3. **D-094, actualizările:** repo GitHub separat, domeniu propriu sau fără actualizare din aplicație; plus acordul pentru biblioteca de actualizare Tauri.
4. **Mediul curat (8.4):** pornirea Windows Sandbox sau a unei mașini virtuale, ori folosirea celui de-al doilea PC.
5. **Scanarea dependențelor:** reluarea GitHub Actions sau acordul pentru instalarea `cargo-deny` pe laptop.
6. **Adresa de contact** pentru suport.
