# K.G.B. — Planul Etapei 4: Organizare și productivitate

**Data:** 7 nov. 2026 · **Statut:** ÎNCHEIATĂ — poartă aprobată (D-048, 8 nov. 2026). Deciziile de mai jos sunt confirmate; pentru D-045 s-a ales Typst.
**Sursa:** Master Plan §6.5 (bibliotecă de documente și formulare), §6.9 (Planner & Task Studio), §6.11 (Notification Engine), §5 (panouri drag-and-drop), §13 (Etapa 4).

## Ce cere Master Plan-ul
Planner, taskuri, remindere, notificări, bibliotecă de documente, formulare.

**Poarta:** utilizatorul poate **crea, atribui, urmări și raporta** activități.

## Ordinea: întâi ce se vede
Proprietarul a observat că Etapa 3 a avut mult lucru „invizibil” (spike-uri, verificări). În Etapa 4 rezultatul vizibil vine primul. Fiecare pas se termină cu ceva ce se poate folosi în aplicație și cu capturi de ecran.

## Pași
| Pas | Ce | Criteriu de acceptare |
|---|---|---|
| 4.1 | **Modulul Planner (beta), partea 1:** taskuri (titlu, descriere, responsabil, termen, prioritate, stare), proiecte, checklist; persoanele echipei (listă locală, D-042); vedere listă cu filtre | Teste + e2e: creez, atribui, schimb starea, filtrez după persoană și termen |
| 4.2 | **Kanban** (coloane pe stare, mutare prin drag-and-drop) și **calendar** (lună / săptămână) | e2e: mut un task între coloane; îl văd în calendar la termen |
| 4.3 | **Activități recurente:** zilnic, săptămânal, lunar, anual, cu interval (D-046) | Teste: următoarele apariții calculate corect (sfârșit de lună, an bisect) |
| 4.4 | **Notificări în nucleu** (D-043): serviciu de notificări pentru module (permisiunea `notify.send`), centrul de notificări în aplicație (clopoțel) | Teste: un modul trimite, utilizatorul vede, marchează citit; fără permisiune → refuz în audit |
| 4.5 | **Remindere:** termene de taskuri și **scadențe de facturi** din Extragere date; notificări desktop Windows doar când aplicația e pornită (D-044) | Teste: reminder la ora potrivită, fără dubluri după repornire; e2e |
| 4.6 | **Rapoarte și export:** pe persoană, stare, proiect, întârziate; export CSV și XLSX | Teste: totaluri corecte; exportul se redeschide identic |
| 4.7 | Spike S6: **generarea documentelor** (DOCX/PDF din modele) → D-045 | Raport cu licențe, fidelitate, mărime |
| 4.8 | **Bibliotecă de documente și modele** (§6.5): modele administrative, comerciale, HR, tehnice; câmpuri comune reutilizabile (firma, CUI, adresă) completate doar din date autorizate; versiuni și sursa modelului | Teste: modelul original nu se schimbă; documentul generat are câmpurile corecte |
| 4.9 | **Formulare:** definire de câmpuri (text, număr, dată, listă), completare, răspunsuri salvate cu schemă, export | Teste: validare; răspunsurile se exportă identic |
| 4.10 | **Panouri drag-and-drop** (preluate din Etapa 1): ecran de start cu panouri mutabile și redimensionabile (taskurile de azi, notificări, documente recente), aranjament salvat (D-047) | e2e: mut un panou, repornesc, aranjamentul rămâne |
| 4.11 | Raport `docs/ETAPA4_RAPORT.md` | — |
| 4.12 | 🔒 Poarta Etapei 4 | Aprobarea proprietarului |

## Decizii propuse
| ID | Decizie | Recomandare |
|---|---|---|
| D-042 | **Cui se atribuie** un task: până la Etapa 6 (rețea, conturi, roluri) există o **listă locală de persoane** în spațiul de lucru, nu conturi de utilizator | Da. Conturile și rolurile reale vin cu rețeaua (Master Plan §7, Etapa 6) |
| D-043 | **Notificările** sunt un serviciu al nucleului: modulele trimit prin `ctx.notify` (permisiunea nouă `notify.send`), iar nucleul le păstrează, le afișează și le auditează | Da. E primul serviciu folosit de mai multe module; magistrala de evenimente rămâne pentru când e nevoie de ea |
| D-044 | **Notificări desktop** prin notificările Windows, doar cât timp aplicația rulează. Fără serviciu permanent în fundal și fără email | Da. Un serviciu de fundal sau email ar cere setări de sistem sau conturi externe: doar cu acordul proprietarului |
| D-045 | **Generarea documentelor** (DOCX/PDF) | După S6 (`docs/spikes/S6_REZULTATE.md`): DOCX cu un completator propriu de câmpuri (zip + quick-xml, ~0,3 MB); PDF din modele HTML cu motorul WebView2 deja prezent (0 MB). Typst rămâne alternativa (+11,7 MB). De confirmat la poartă |
| D-046 | **Recurența:** reguli simple (zilnic, săptămânal pe zile, lunar pe zi, anual, la fiecare N), nu standardul complet iCalendar | Da. Acoperă nevoile obișnuite și se poate testa complet |
| D-047 | **Aranjamentul panourilor** e salvat în setările spațiului de lucru (format versionat) | Da |

## Riscuri
- **Notificările desktop** depind de setările Windows ale utilizatorului (Focus Assist / „Nu deranja”). Aplicația le arată oricum în centrul ei de notificări.
- **„Atribuirea” fără rețea** înseamnă doar evidență: persoana nu primește nimic pe alt PC până în Etapa 6. Se spune clar în interfață.
- **Mărimea installerului** (R20): Etapa 4 nu ar trebui să adauge biblioteci mari, cu excepția celei pentru generarea documentelor (S6).
