# K.G.B. — Etapa 4 (Organizare și productivitate): raport și propunere de poartă

**Data:** 7 nov. 2026 · **Statut:** **APROBAT** de proprietar (D-048, „aprob”), pe 8 nov. 2026. Pentru PDF din modele proprietarul a ales Typst (D-045).
**Poarta cerută de Master Plan §13:** utilizatorul poate **crea, atribui, urmări și raporta** activități.
**Plan:** `docs/ETAPA4_PLAN.md` · **Spike S6:** `docs/spikes/S6_REZULTATE.md`

## Pe scurt
| Cerința porții | Cum se face în aplicație |
|---|---|
| **Creez** activități | Planificator: taskuri cu descriere, termen, prioritate, checklist, proiect; taskuri care se repetă (zilnic, săptămânal pe zile, lunar, anual) |
| **Atribui** | Fiecare task are un responsabil din lista locală de persoane (D-042). Atribuirea între calculatoare vine cu rețeaua, în Etapa 6 |
| **Urmăresc** | Listă cu filtre, Kanban cu tragere între coloane, calendar pe lună și săptămână, întârzieri marcate, memento-uri cu o zi înainte, în ziua termenului și la întârziere, notificări în aplicație și în Windows, panoul „De făcut azi” pe ecranul de start |
| **Raportez** | Fila „Rapoarte”: pe persoane și pe proiecte, pe stări, cu întârzieri și totaluri; export în Excel (3 foi) sau CSV, verificat celulă cu celulă |

Pe lângă poartă, etapa a mai adus documentele și formularele cerute de Master Plan §6.5. Modulul nou „Documente și modele” are 5 modele Word, datele firmei completate o singură dată, documente generate și verificate, plus formulare cu răspunsuri salvate și export.

**Teste:**
- **179 de teste automate** trec pe laptop (147 la sfârșitul Etapei 3).
- 6 scenarii în fereastra reală, toate trecute:

| Scenariu | Verificări trecute |
|---|---|
| Planificator (taskuri, Kanban, calendar, repetare, notificări, rapoarte) | 22/22 |
| Memento-uri (la pornire, fără repetare după repornire) | 4/4 |
| Documente și formulare | 13/13 |
| Ecranul de start (panouri) | 7/7 |
| Poarta Etapei 1 (regresie) | 15/15 |
| Backup (regresie) | 8/8 |

- ⚠️ **CI-ul pe GitHub nu mai rulează de la pasul 4.7.** Nu e o problemă de cod: GitHub spune că „plata contului a eșuat sau s-a atins limita de cheltuieli” (Settings → Billing & plans). Asta înseamnă că verificarea automată a licențelor și a vulnerabilităților noilor biblioteci (quick-xml, plus cele din spike-ul S6) nu a mai rulat pe GitHub. Licențele au fost verificate local, prin listare, și sunt toate permise; vulnerabilitățile nu au putut fi verificate local, pentru că unealta `cargo-deny` nu e instalată aici.

## Ce s-a construit
| Pas | Ce | Rezultat |
|---|---|---|
| 4.1 | Planificator (beta): taskuri, persoane, proiecte, checklist, filtre | Modificările făcute în paralel sunt refuzate, nu pierdute; datele rămân după oprire forțată |
| 4.2 | Kanban și calendar | Tragere între coloane și pe zile; butoane ← → pentru tastatură |
| 4.3 | Taskuri care se repetă (D-046) | Ziua 31 → ultima zi a lunii și înapoi la 31; 29 februarie → 28 în anii obișnuiți. La „Gata” apare următorul task, o singură dată, cu checklistul debifat |
| 4.4 | Notificări în nucleu (D-043) | Permisiunea nouă „notify.send”; refuzul ajunge în jurnal; fără dubluri; lista ține cel mult 500; clopoțel în aplicație |
| 4.5 | Memento-uri (D-044) | Termene de taskuri și scadențe de facturi; niciodată de două ori, nici după repornire sau ștergere; notificări Windows doar cât rulează aplicația |
| 4.6 | Rapoarte și export | Totaluri verificate de teste; un titlu care arată ca o formulă Excel rămâne text |
| 4.7 | Spike S6: documente Word și PDF (D-045 propus) | Completator Word propriu (~0,3 MB). PDF: motorul Edge deja prezent (0 MB) sau Typst (+11,7 MB) |
| 4.8 | Documente și modele (beta) | 5 modele (cerere, ofertă, contract, adeverință, proces-verbal) și modele proprii. Datele firmei vin doar din „Date firmă”; câmpurile lipsă opresc generarea; modelul original nu se schimbă |
| 4.9 | Formulare | Câmpuri text, număr, dată, listă. Fiecare răspuns e verificat; un formular modificat primește o versiune nouă, iar răspunsurile vechi o păstrează pe a lor |
| 4.10 | Panouri pe ecranul de start (D-047) | Mutare și redimensionare cu mouse-ul sau cu butoanele; aranjamentul rămâne după repornire |

## Ce a costat
- **Mărimea:** installer 7,9 → 8,4 MB; programul 28 → 30 MB.
- **Biblioteci noi în aplicație:** `tauri-plugin-notification` 2.8.0 (notificări Windows, folosit doar din Rust) și `quick-xml` 0.42 (modelele Word, deja prezent prin bibliotecile Etapei 3). Ambele au licențe permisive și sunt trecute în `LICENSES.md`.
- **Permisiuni noi cerute de module:**
  - Planificatorul cere și „notify.send” (memento-uri) și „files.own” (export);
  - Extragerea de date cere „notify.send” (scadențe).

  Dacă un modul era deja activat, catalogul arată permisiunea nouă și butonul „Vezi și acordă…”. Până o acorzi, modulul merge fără funcția respectivă.
- **Setările** au trecut la schema 2 (aranjamentul ecranului de start). Setările vechi se migrează automat.

## Ce NU e făcut sau dovedit (sincer)
- 🔒 **PDF din modele (4.8b)** nu e făcut. Aștept confirmarea deciziei D-045 (motorul Edge, 0 MB, sau Typst, +12 MB).
- **Atribuirea e doar evidență pe acest calculator:** persoana nu primește nimic pe alt PC până la rețeaua din Etapa 6.
- **Notificările Windows propriu-zise nu sunt verificate automat**, pentru că țin de Windows și de setările lui (de exemplu „Nu deranja”). Testul verifică centrul de notificări din aplicație. Le vezi la prima pornire cu un task care are termen azi sau mâine.
- **Memento-urile apar doar cât rulează aplicația**, fără serviciu în fundal (D-044). La pornire se recuperează tot ce a fost scadent cât a stat închisă.
- **Facturi:** aplicația nu știe dacă o factură a fost plătită, deci nu trimite memento de „restanță”, doar înainte de scadență și în ziua ei.
- **Modele Word:**
  - Aspectul documentelor generate nu a fost văzut în Word, pentru că Word nu e instalat pe laptop; structura e verificată automat.
  - Modelele incluse sunt simple, de pornire, nu modele juridice verificate de un avocat.
- **Formulare:** fără câmpuri condiționale, fără fișiere atașate, fără completare de către alte persoane, care vine cu rețeaua.
- **Ecranul de start:** doar 5 panouri, fără panouri ale altor module, acestea vin pe măsură ce apar module noi.
- **Testele în fereastra reală rulează doar pe laptop**, nu în CI; iar CI-ul e oprit acum din cauza facturării GitHub.
- Rămân în așteptare, de dinainte: 🔒 testul cu 2 PC-uri (S2.3, înainte de Etapa 6) și 🔒 testul de pierdere a curentului (2.12, obligatoriu înainte de date reale).

## Ce s-a aflat pe drum
- **Ferestrele de editare ascundeau erorile:** mesajul apărea în spatele ferestrei deschise, deci utilizatorul nu-l vedea, deși nimic nu se pierdea. Testul pentru formulare a prins problema. Acum mesajul apare în fereastră, la task, la document și la formular.
- **Numere scrise românește:** „1.500” înseamnă 1500 și „1.234,5” înseamnă 1234,5. La început „1.500” era citit ca 1,5. Corectat, cu test.
- **Testul Planificatorului se putea strica singur** dacă, în timpul lui, porneau memento-urile, care rulează o dată pe minut. Testul folosește acum termene care nu declanșează memento-uri.
- **Typst** (PDF de foarte bună calitate) cântărește ~42 MB necomprimat chiar și fără fonturi. De aceea recomandarea pentru PDF e motorul Edge, care e deja în aplicație.

## Decizii cerute proprietarului
| # | Decizie | Recomandare |
|---|---|---|
| D-042 … D-047 | Confirmi alegerile Etapei 4 (persoane locale, notificări în nucleu, notificări Windows doar cu aplicația pornită, repetare simplă, aranjament salvat în setări)? | Da |
| D-045 | PDF din modele: **motorul Edge** (0 MB, deja în aplicație) sau **Typst** (+12 MB, PDF identic peste ani)? | Motorul Edge; Typst doar dacă e nevoie de arhivare pe termen lung |
| CI | Verifici facturarea GitHub (Settings → Billing & plans), ca verificările automate să ruleze din nou? Repo-ul e privat, iar minutele gratuite pentru Actions sunt limitate. | Da. Alternativ, repo-ul ar putea deveni public, dar nu recomand, codul e al firmei |
| Poartă | Considerăm Etapa 4 încheiată și trecem la **Etapa 5 (Business)**? | Da, după D-045 și 4.8b, sau cu 4.8b mutat la începutul Etapei 5 |

## După aprobare: pasul 4.8b (PDF cu Typst)
- **Ce:** 3 modele PDF incluse (ofertă comercială, proces-verbal de recepție, adeverință de salariat), cu aceleași câmpuri `{{…}}` ca modelele Word. Valorile intră ca text, nu pot rula cod, iar modelul nu poate citi fișiere de pe calculator.
- **Același model și aceleași valori dau exact același PDF**, octet cu octet, pentru că fonturile sunt incluse în aplicație. PDF-ul e recitit și verificat (fiecare valoare apare în text) înainte de salvare.
- **Cost:** installerul crește de la 8,4 la **21,8 MB**, iar programul de la 30 la 73 MB (Typst cu fonturile lui).
- **Limită:** modelele PDF proprii nu se pot importa; un model Typst e un mic program și ar putea rula la nesfârșit. Modelele proprii rămân fișiere Word.
- **Teste:** 1 test nou; documente și formulare 15/15, ecran de start 7/7, Planificator 22/22 în fereastra reală. Testul Planificatorului depindea de ziua săptămânii (o duminică muta ziua țintă în săptămâna următoare); corectat.
