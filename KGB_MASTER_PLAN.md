# K.G.B. --- KRONOS GLOBAL BUSINESS

## MASTER PLAN --- document de referință al proiectului

**Versiune:** 1.0 --- 6 noiembrie 2026\
**Statut:** Specificație de produs și arhitectură preliminară; deciziile
marcate „de validat" nu sunt încă aprobate definitiv.\
**Nume de lucru:** K.G.B. --- Kronos Global Business

------------------------------------------------------------------------

## 0. Cum trebuie folosit acest document

Acest document este sursa principală de adevăr pentru proiectul K.G.B.
Claude Code trebuie să îl citească înainte de orice implementare și să
îl consulte ori de câte ori ia o decizie care afectează arhitectura,
securitatea, stocarea, rețeaua, modulele sau experiența utilizatorului.

Reguli:

1.  Nu modifica deciziile aprobate fără acordul explicit al
    proprietarului proiectului.
2.  Nu interpreta o propunere tehnică drept decizie finală.
3.  Orice schimbare arhitecturală se consemnează în `DECISION_LOG.md`,
    cu motiv, alternative, impact și aprobarea necesară.
4.  Dacă două cerințe intră în conflict, oprește implementarea acelei
    părți și explică exact conflictul.
5.  Nu construi toate modulele simultan. Construiește nucleul și
    validează fiecare etapă prin teste.
6.  Nu declara o funcție terminată doar pentru că interfața ei există.
    Funcția trebuie să lucreze, să fie testată și să aibă criterii de
    acceptare îndeplinite.
7.  Nu introduce dependențe, servicii cloud, servere sau baze de date
    care contrazic acest plan fără aprobare.

### Etichete folosite

-   **DECIS:** cerință stabilită de proprietarul proiectului.
-   **PROPUS:** soluție recomandată, încă supusă validării.
-   **DE VALIDAT:** necesită test tehnic, juridic sau comercial.
-   **ULTERIOR:** nu intră în prima versiune funcțională.

------------------------------------------------------------------------

# 1. Viziune și poziționare

K.G.B. este o platformă desktop modulară, local-first, concepută ca un
birou digital universal pentru persoane, profesioniști și companii.

Nu este un chatbot și nu este un produs construit în jurul AI. Nucleul
este o platformă software care organizează instrumente de lucru,
documente, date, procese și colaborarea între calculatoare. AI poate fi
adăugat ulterior ca modul opțional, cu permisiuni explicite.

Obiectivul este să ofere într-o singură aplicație un mediu de lucru
configurabil, extensibil și coerent: documente, foi de calcul, extragere
de date, planificare, activități de echipă, stocuri, financiar,
informații și alte module.

Ținta comercială pe termen lung este o platformă internațională cu
potențial de creștere. Orice evaluare financiară este o aspirație, nu o
garanție. Produsul trebuie validat prin utilizatori reali, retenție,
venituri, costuri de suport și conformitate.

## 1.1 Principii nenegociabile

1.  **Local-first:** datele și documentele companiei sunt păstrate pe
    calculatoarele autorizate ale utilizatorilor.
2.  **Fără cloud obligatoriu pentru datele de lucru:** utilizatorul
    poate folosi funcțiile locale fără un cont cloud al furnizorului
    K.G.B.
3.  **Fără server central de date/aplicație:** K.G.B. nu trebuie să
    depindă de un server central care găzduiește baza de date
    operațională sau documentele companiei.
4.  **Fără motor de baze de date:** decizie explicită --- nu se folosesc
    SQLite, PostgreSQL, MySQL sau alte motoare DB, nici local, nici
    central. Se construiește un motor propriu de stocare bazat pe
    fișiere structurate, indexuri și jurnalizare.
5.  **Offline-first:** funcțiile locale continuă să funcționeze când
    internetul sau rețeaua dintre calculatoare nu este disponibilă.
6.  **Controlul utilizatorului:** transferurile externe, accesul la date
    și permisiunile trebuie să fie explicite și vizibile.
7.  **Modularitate:** modulele sunt independente și comunică prin
    contracte/API-uri stabile.
8.  **Securitate implicită:** least privilege, identități de dispozitiv,
    criptare, audit și revocare.
9.  **Zero configurare tehnică pentru utilizatorul obișnuit:**
    instalarea trebuie să includă și să configureze automat componentele
    necesare. Utilizatorul nu trebuie să instaleze separat un VPN și să
    configureze IP-uri, porturi, DNS sau routere.
10. **Transparență:** aplicația nu trebuie să pretindă că o funcție
    există dacă este doar prototip sau mock-up.

------------------------------------------------------------------------

# 2. Public și scenarii de utilizare

## 2.1 Public inițial

-   firme mici și mijlocii;
-   profesioniști independenți;
-   echipe administrative și operaționale;
-   utilizatori care lucrează cu documente, tabele, inventare, proiecte
    și date.

Piața inițială: România și Europa. Arhitectura trebuie să permită
localizare și pachete specifice altor țări.

## 2.2 Scenarii esențiale

-   Un utilizator lucrează pe un singur PC, complet offline.
-   Administratorul creează un spațiu de lucru al firmei și invită
    angajați.
-   Angajații lucrează de pe PC-uri diferite, inclusiv din locații
    diferite.
-   Fiecare PC păstrează local datele și documentele la care are acces.
-   Modificările se transmit când există conectivitate și permisiuni.
-   Un angajat își poate continua activitatea offline, iar schimbările
    se sincronizează ulterior.
-   Administratorul poate suspenda sau revoca un dispozitiv sau un cont.
-   Utilizatorul își personalizează spațiul de lucru și activează doar
    modulele necesare.

------------------------------------------------------------------------

# 3. Platformă și tehnologie

## 3.1 Sisteme de operare

-   **DECIS:** Windows este prima platformă.
-   **ULTERIOR:** macOS.
-   Arhitectura trebuie să evite dependențele inutile de Windows, cu
    excepția integrărilor OS specifice.

## 3.2 Stack preliminar

Acestea sunt alegeri candidate, nu licență de a implementa fără test:

-   **Desktop shell:** Tauri 2 --- PROPUS.
-   **Interfață:** React + TypeScript --- PROPUS.
-   **UI:** componente proprii și sistem de design coerent; Tailwind
    poate fi folosit dacă nu afectează mentenabilitatea.
-   **Backend local:** servicii native/logică Rust prin Tauri sau un
    proces local separat, în funcție de testele de securitate și
    performanță.
-   **PDF/Excel/OCR:** biblioteci specializate, evaluate separat pentru
    compatibilitate, licențe, performanță și calitatea fișierelor
    produse.
-   **Actualizări:** pachete semnate și verificabile.
-   **Instalare:** installer Windows care include aplicația și
    componentele aprobate.

Claude Code trebuie să compare alternativele și să documenteze motivele
alegerii. Nu trebuie să schimbe stack-ul doar pentru că o bibliotecă
este mai comodă.

------------------------------------------------------------------------

# 4. Arhitectură logică

Arhitectura conceptuală:

``` text
K.G.B. Desktop Shell
    |
    +-- Workspace Engine
    +-- Module Manager
    +-- Identity & Permissions
    +-- Local Storage Engine (propriu, fără DB)
    +-- Search & Index Engine
    +-- Audit & Recovery Engine
    +-- Network & Sync Engine
    +-- Notifications Engine
    +-- Import / Export Engine
    |
    +-- Module API / SDK
            |
            +-- Documents
            +-- Spreadsheet
            +-- Data Extraction
            +-- Templates
            +-- Planner / Tasks
            +-- Workforce
            +-- Finance / Inventory
            +-- Market / Information
            +-- Permits / Authorizations
```

## 4.1 Regula nucleului

Nucleul oferă servicii generale și contracte stabile. Nu trebuie să
conțină logica de business a fiecărui modul.

Modulele: - nu accesează direct fișierele interne ale altor module; - nu
ocolesc verificarea permisiunilor; - nu își creează mecanisme proprii de
identitate, sincronizare sau jurnalizare; - folosesc API-urile
nucleului; - declară permisiunile și tipurile de date necesare; - pot fi
dezactivate fără ștergerea datelor.

## 4.2 Module independente

Fiecare modul trebuie să aibă: - identificator unic și versiune; -
manifest; - permisiuni declarate; - interfață și logică separabile; -
contract API documentat; - teste unitare și de integrare; - format de
date și reguli de migrare; - comportament clar la dezactivare; -
verificări de compatibilitate cu versiunea nucleului.

Un modul incomplet nu trebuie afișat ca funcțional în catalogul
utilizatorului. În mediul de dezvoltare poate fi marcat clar ca
experimental.

------------------------------------------------------------------------

# 5. Interfață și experiență de utilizare

## 5.1 Desktop workspace

Interfața este un spațiu de lucru configurabil: - panouri
redimensionabile și repoziționabile; - drag-and-drop; - dock/catalog de
module; - teme și culori configurabile; - dimensiuni și densitate de
afișare; - comenzi rapide; - notificări și alerte; - salvarea
configurațiilor de workspace.

## 5.2 Profiluri de lucru

Exemple de profiluri predefinite: - Birou; - Management; - Depozit; -
Investiții; - Proiecte; - Personal.

Profilurile sunt configurații de interfață și module active, nu conturi
sau spații de date separate în mod implicit.

## 5.3 Panouri configurabile

Utilizatorul poate adăuga, elimina sau rearanja: - InfoNews; - cote și
alerte bursiere; - taskuri și reminder; - stocuri și praguri; - facturi
și scadențe; - indicatori financiari; - comenzi rapide; - activități
recente; - dispozitive conectate și starea sincronizării.

------------------------------------------------------------------------

# 6. Catalogul de module

Toate modulele aprobate pentru versiunea distribuită pot fi incluse în
installer. Utilizatorul activează modulele de care are nevoie. Modulele
nefinalizate nu trebuie prezentate drept funcții complete.

## 6.1 Document Studio

Funcții vizate: - citire, creare și editare PDF; - combinare și separare
PDF; - extragere pagini; - OCR din scanări și imagini; - conversii de
formate; - completare formulare; - șabloane și câmpuri reutilizabile; -
comparare documente; - redactare/mascare date confidențiale; - semnare,
doar după alegerea unui mecanism legal și tehnic adecvat; - arhivare și
căutare.

Criteriu: nu trebuie să deterioreze conținutul sau structura
documentelor la operații de bază. Operațiile destructive trebuie să aibă
preview și copie de siguranță.

## 6.2 Spreadsheet Studio

Funcții vizate: - deschidere și editare XLSX, CSV și, dacă este fezabil,
XLS/ODS; - formule uzuale; - formatare și validare; - grafice; - tabele
pivot sau funcționalitate echivalentă, după evaluare; - import/export; -
extragere de tabele din PDF și imagini; - comparare de fișiere; -
actualizare controlată a tabelelor.

Compatibilitatea Excel trebuie testată pe fișiere reale. Nu se promite
compatibilitate completă cu toate funcțiile Microsoft Excel fără teste.

## 6.3 Biblioteca de șabloane de calcul

Categorii: - financiar: buget, cash-flow, profit și pierdere, bilanț
simplificat; - contabilitate primară: registru de casă, bancă, jurnale
de cumpărări/vânzări; - facturare: factură, proformă, chitanță, situație
clienți; - costuri: cost unitar, adaos, marjă, break-even; - stocuri:
inventar, intrări/ieșiri, stoc minim, rotație; - achiziții: comenzi
furnizori, comparație oferte, cost transport; - vânzări: vânzări
zilnice, comisioane, obiective; - HR: pontaj, ture, ore suplimentare,
concedii; - proiecte: buget, Gantt, progres, costuri și resurse; -
transport: cost/km, combustibil, cost cursă, profitabilitate; -
construcții: deviz, situație lucrări, necesar materiale, manoperă; -
investiții: randament, portofoliu, dividende, evaluare; - credite: rate,
amortizare, dobânzi; - agricultură: cost/hectar, inputuri, producție; -
producție: BOM, cost fabricație, consum, rebuturi; - marketing: buget
publicitate, cost/client, ROI.

Originalele sunt protejate. Utilizatorul creează o copie
personalizabilă; editarea copiei nu alterează șablonul sursă. Formulele
trebuie documentate și testate.

## 6.4 Data Extraction Studio

Flux: 1. selectarea fișierelor; 2. identificarea tipului de
document/date; 3. extragerea câmpurilor; 4. afișarea sursei și a
poziției valorii; 5. scor/indicator de încredere; 6. validare de către
utilizator pentru valori incerte; 7. alegerea destinației; 8. import și
jurnalizare.

Surse: facturi, oferte, extrase, contracte, pontaje, PDF-uri, imagini și
foi de calcul.

Nu se importă în tăcere valori incerte. Utilizatorul trebuie să poată
corecta rezultatul înainte de import.

## 6.5 Document & Forms Library

-   modele administrative;
-   modele comerciale;
-   modele HR;
-   modele tehnice;
-   câmpuri comune reutilizabile;
-   completare automată numai din date autorizate;
-   istoric de versiuni și sursa modelului.

## 6.6 Permits & Authorization Center

Domenii posibile: - autorizații de construire; - mediu; - ISU; -
funcționare; - sanitare; - transport; - activități comerciale și alte
autorizații pentru firme.

Pentru fiecare procedură: - instituția competentă; - condiții și
criterii; - documente necesare; - cereri-model și formulare; - taxe și
termene, cu dată de verificare; - checklist; - linkuri către surse
oficiale; - istoric legislativ și jurisdicție.

Trebuie diferențiate cerințele legale obligatorii de recomandările
orientative. Informația juridică trebuie datată și legată de surse
oficiale. Modulul nu trebuie să pretindă că înlocuiește consultanța
juridică sau confirmarea instituției.

## 6.7 Finance & Inventory

Stocuri: - produse, categorii și coduri de bare; - depozite; - recepții,
livrări și transferuri; - inventar; - stoc minim; - loturi și serii; -
cost mediu; - furnizori și comenzi.

Financiar și contabilitate primară: - casă și bancă; - facturi,
chitanțe; - încasări și plăți; - avansuri și deconturi; - cheltuieli; -
jurnale; - scadențare; - situații clienți/furnizori; - rapoarte și
profitabilitate.

Nu se prezintă drept contabilitate completă, certificată sau conformă
automat cu toate obligațiile fiscale. Cerințele fiscale și e-Factura
trebuie validate separat pentru România și actualizate pe baza surselor
oficiale.

## 6.8 Workforce Control Center

-   angajați și roluri;
-   sarcini, responsabili, termene și priorități;
-   status și verificare;
-   pontaj, ture, ore suplimentare;
-   absențe și concedii;
-   activități și rapoarte;
-   notificări și istoric;
-   documente asociate.

Accesul la datele angajaților trebuie limitat pe roluri. Monitorizarea
trebuie să respecte legislația muncii și protecția datelor.

## 6.9 Planner & Task Studio

-   calendar;
-   taskuri și checklist;
-   activități recurente;
-   proiecte;
-   Gantt/Kanban;
-   responsabili și termene;
-   reminder și notificări;
-   export și rapoarte.

## 6.10 Market & Information Center

-   acțiuni, indici, ETF-uri, FX, crypto și commodities;
-   watchlist;
-   grafice, istoric și alerte;
-   dividende și evenimente;
-   InfoNews pe surse și categorii alese.

Datele de piață pot necesita licențe. Se folosesc API-uri sau metode de
extragere numai când sunt permise de termenii sursei. Nu se presupune că
scraping-ul este întotdeauna legal sau stabil. Se afișează sursa, ora și
eventualele întârzieri ale cotațiilor.

## 6.11 Notification Engine

Alerte pentru: - stocuri; - facturi și scadențe; - taskuri și termene; -
contracte; - bursă; - știri; - bugete și praguri de formule.

Canale: notificări în aplicație și notificări desktop. Email sau alte
canale externe sunt opționale și necesită conectare și permisiune.

## 6.12 Module viitoare posibile

Calculator universal, conversii unități, manager fișiere, contacte,
email, QR/barcode, scanare imagini, backup, clipboard, password vault,
viewer de fișiere structurate, web research, prezentări, printare,
import/export avansat, bibliotecă de formule și notițe.

Acestea nu sunt automat incluse în prima versiune.

------------------------------------------------------------------------

# 7. Identitate, utilizatori și permisiuni

## 7.1 Model de utilizatori

-   un utilizator individual pe un PC;
-   administrator de organizație;
-   angajați invitați;
-   roluri și permisiuni personalizate;
-   mai multe dispozitive asociate aceluiași utilizator, dacă politica
    organizației permite.

## 7.2 Identitate de dispozitiv

Fiecare dispozitiv trebuie să aibă: - identificator unic; - chei
criptografice generate local; - asociere explicită cu organizația; -
stare: în așteptare, aprobat, suspendat, revocat; - istoric de
autorizare.

Nu se include o cheie privată comună sau un secret permanent în
installer.

## 7.3 Administrare

Administratorul poate: - invita utilizatori; - aproba dispozitive; -
atribui roluri; - limita accesul la module, spații și tipuri de date; -
suspenda sau revoca accesul; - consulta jurnalul de audit.

Revocarea trebuie propagată către dispozitivele conectate. Când un
dispozitiv este offline, revocarea se aplică la următoarea verificare.
Pentru operațiuni sensibile trebuie prevăzute permisiuni cu expirare sau
revalidare.

------------------------------------------------------------------------

# 8. Rețea și colaborare între PC-uri

## 8.1 Cerință de produs

**DECIS:** calculatoarele autorizate trebuie să poată colabora de
oriunde prin internet, fără ca utilizatorul să configureze manual o
rețea VPN, IP-uri, porturi, DNS sau router.

Installerul K.G.B. trebuie să includă și să configureze automat
componenta de rețea aprobată. Utilizatorul nu trebuie să instaleze
separat NetBird, Tailscale sau altă aplicație.

Poate fi necesară o singură aprobare Windows/UAC pentru instalarea unui
serviciu sau driver de rețea. Nu promite instalare fără privilegii dacă
Windows cere elevare.

## 8.2 Separarea conceptelor

VPN/mesh networking oferă conectivitate privată între dispozitive. Nu
oferă automat: - sincronizare de fișiere; - replicarea datelor; -
rezolvarea conflictelor; - permisiuni la nivel de document; - istoric de
modificări.

Acestea sunt responsabilitatea K.G.B. Network & Sync Engine.

## 8.3 Candidat tehnic

NetBird este un candidat pentru testare, nu o decizie finală.
Alternativele includ Tailscale, Headscale și Nebula. Înainte de
integrare trebuie verificate: - modelul de control-plane și relay; -
funcționarea fără server central de date K.G.B.; - NAT traversal și
comportamentul în rețele restrictive; - instalarea
silențioasă/automatizată permisă; - compatibilitatea Windows; - consumul
de resurse; - securitatea; - licențele și obligațiile de
redistribuire; - posibilitatea de a ascunde complexitatea față de
utilizator.

**Clarificare importantă:** „fără server central de date/aplicație" nu
înseamnă automat „fără niciun server auxiliar din lume". Conectivitatea
globală poate necesita servicii de coordonare și/sau relay. Un relay
poate transmite trafic criptat fără să găzduiască documentele sau baza
de date a companiei. Orice dependență externă trebuie documentată și
aprobată.

## 8.4 Mod de conectare

-   descoperire locală în LAN când este posibil;
-   conectare remote prin rețeaua mesh;
-   utilizatorul vede o listă unificată de dispozitive;
-   aplicația selectează automat calea disponibilă;
-   funcțiile locale continuă când rețeaua cade.

## 8.5 Pairing

Flux propus: 1. administratorul creează organizația locală; 2. aplicația
generează o invitație cu expirare și utilizare limitată; 3. angajatul
instalează K.G.B.; 4. dispozitivul generează identitatea și cheile
proprii; 5. administratorul aprobă dispozitivul; 6. se aplică rolurile
și permisiunile; 7. conexiunea se configurează automat.

Invitațiile nu trebuie să conțină chei private sau credențiale
permanente.

## 8.6 Sincronizare și conflicte

-   datele se păstrează local;
-   nu se copiază automat toate documentele pe toate dispozitivele;
-   sincronizarea respectă permisiunile și selecția de spații/date;
-   modificările se păstrează într-un jurnal replicabil;
-   fiecare obiect are ID unic, versiune, autor și moment de modificare;
-   conflictele nu se rezolvă prin suprascriere oarbă;
-   pentru modificări neconflictuale se poate aplica o regulă
    deterministă;
-   conflictele ambigue se prezintă utilizatorului pentru decizie;
-   fișierele mari se transferă separat, cu verificare de integritate și
    reluare.

Nu se partajează direct același fișier intern de stocare între mai multe
PC-uri. Nu se presupune că sincronizarea de directoare este suficientă
pentru date tranzacționale.

------------------------------------------------------------------------

# 9. Motor propriu de stocare --- fără baze de date

## 9.1 Decizie explicită

**DECIS:** K.G.B. nu va utiliza niciun motor de baze de date, local sau
central. Nu se folosesc SQLite, PostgreSQL, MySQL, MongoDB sau alte
sisteme DB pentru datele operaționale ale aplicației.

Stocarea se construiește din: - fișiere structurate; - documente și
atașamente în filesystem; - indexuri proprii regenerabile; - jurnal de
modificări; - mecanisme de integritate și recuperare.

Această decizie nu înseamnă că datele pot fi aruncate în fișiere JSON
fără arhitectură. Este obligatoriu un proiect tehnic riguros.

## 9.2 Componente obligatorii

### A. File Storage

Păstrează documentele și fișierele utilizatorilor. Folosește
identificatori stabili, metadate și reguli de acces. Nu folosi numele
fișierului ca unic identificator.

### B. Structured Records

Păstrează înregistrări structurate într-un format versionat. JSON poate
fi folosit inițial pentru prototip sau date mici, dar Claude Code
trebuie să testeze costul de parsare, scriere, dimensiune și migrare.
Pentru volum mare poate fi necesar un format binar propriu/documentat.

### C. Index Engine

Indexurile accelerează căutarea și filtrarea. Trebuie să fie
regenerabile din sursele autoritative. Un index corupt nu trebuie să
ducă la pierderea datelor.

### D. Change Journal

Înregistrează operațiile: - creare; - modificare; - ștergere logică; -
restaurare; - import; - sincronizare; - schimbare de permisiuni.

Fiecare eveniment trebuie să includă ID, tip, autor/dispozitiv, moment,
versiune, referință la obiect și informații de integritate.

### E. Recovery Engine

Trebuie să poată: - detecta scrieri incomplete; - valida integritatea; -
recupera ultima stare validă; - reconstrui indexurile; - detecta fișiere
orfane; - raporta erorile fără a șterge automat datele suspecte.

## 9.3 Cerințe de siguranță

1.  Scrieri atomice: scrie într-un fișier temporar, validează și apoi
    înlocuiește controlat.
2.  Jurnal append-only sau mecanism echivalent cu protecție împotriva
    coruperii.
3.  Checksum/hash pentru detectarea modificărilor neașteptate.
4.  Versionare de schemă și migrare repetabilă.
5.  Snapshot-uri și backup-uri verificabile.
6.  Indexuri regenerabile.
7.  Tratarea explicită a ștergerilor și restaurărilor.
8.  Teste pentru întreruperea alimentării și închiderea forțată.
9.  Blocare/coordonare pentru scrieri concurente pe același obiect.
10. Criptare pentru date sensibile și chei protejate prin mecanisme OS.

## 9.4 Test tehnic obligatoriu înainte de extindere

Claude Code trebuie să construiască un prototip izolat și să măsoare: -
10.000, 100.000 și, unde este fezabil, 1.000.000 de înregistrări; - timp
de citire și scriere; - căutare și filtrare; - reconstruirea
indexului; - recuperarea după întrerupere; - două procese care încearcă
să modifice același obiect; - sincronizarea a două copii; - spațiu pe
disc; - comportament la fișiere corupte.

Pragurile de performanță trebuie propuse pe baza hardware-ului țintă și
aprobate înainte de a fi considerate criterii oficiale.

## 9.5 Limită arhitecturală

Nu partaja direct fișierele interne de stocare prin rețea și nu permite
mai multor calculatoare să editeze simultan același fișier fizic de
date. Comunicarea se face prin operații/protocoale de nivel aplicație și
schimb de evenimente.

------------------------------------------------------------------------

# 10. Securitate și confidențialitate

Cerințe: - least privilege; - permisiuni explicite pentru fiecare
modul; - autentificare și identitate de dispozitiv; - criptare în
tranzit; - criptare la repaus pentru datele sensibile; - gestionarea
sigură a cheilor; - jurnal de audit; - protecție împotriva replay și a
invitațiilor reutilizate; - revocare dispozitive; - actualizări
semnate; - verificarea integrității pachetelor; - protecție la importul
fișierelor malițioase; - validarea inputurilor; - separarea datelor
organizațiilor; - export și ștergere controlate.

Nu implementa criptografie proprie. Folosește biblioteci și protocoale
consacrate, evaluate și actualizate.

------------------------------------------------------------------------

# 11. Import, export, backup și migrare

-   importul trebuie să aibă preview și validare;
-   exportul trebuie să fie într-un format documentat și portabil;
-   backup-ul local trebuie criptat și verificabil;
-   restaurarea trebuie testată, nu doar backup-ul creat;
-   utilizatorul trebuie să poată alege locația backup-ului;
-   migrarea formatelor trebuie să păstreze originalul până la validare;
-   ștergerea datelor trebuie să aibă confirmare și politică de
    retenție;
-   nu se pierde istoricul fără o acțiune explicită.

------------------------------------------------------------------------

# 12. Instalare, actualizare și licențiere

## 12.1 Installer

Installerul Windows trebuie: - să instaleze K.G.B. și componentele
aprobate; - să configureze automat serviciile necesare; - să verifice
compatibilitatea OS; - să gestioneze upgrade și rollback; - să nu
instaleze module neterminate ca funcții active; - să ofere dezinstalare
și opțiuni clare privind păstrarea datelor; - să explice orice
permisiune administrativă solicitată.

## 12.2 Actualizări

-   pachete semnate;
-   verificare de integritate;
-   canal stabil și canal de test;
-   backup sau snapshot înainte de migrare;
-   rollback în caz de eșec;
-   compatibilitate între nucleu și module.

## 12.3 Licențiere și distribuție

Înainte de distribuirea oricărei componente open-source: - verifică
licența exactă a versiunii; - verifică obligațiile de redistribuire,
modificare și publicare a codului; - verifică dependențele tranzitive; -
păstrează notices și atribuiri; - obține opinie juridică pentru
componentele cu obligații copyleft sau condiții speciale.

Nu presupune că un proiect este redistribuibil comercial doar pentru că
este open-source.

------------------------------------------------------------------------

# 13. Roadmap și porți de acceptare

Nu se trece la etapa următoare doar pentru că etapa curentă compilează.
Fiecare etapă are demonstrație, teste și criterii de acceptare.

## Etapa 0 --- Specificație și validare tehnică

Livrabile: - repo și structură de proiect; - ADR/decision log; -
prototip UI; - spike tehnic Tauri/React; - prototip de stocare fără
DB; - prototip de rețea și instalare; - registru de riscuri și licențe.

Poartă: deciziile tehnice riscante sunt testate, iar rezultatele sunt
documentate.

## Etapa 1 --- Nucleul desktop

-   shell;
-   navigare;
-   workspace;
-   module manager;
-   setări;
-   identitate locală;
-   permission framework;
-   logging și diagnosticare.

Poartă: aplicația pornește, salvează configurarea,
activează/dezactivează un modul demonstrativ și nu pierde datele
acestuia.

## Etapa 2 --- Storage Engine

-   structured records;
-   file storage;
-   index;
-   journal;
-   recovery;
-   backup/restore.

Poartă: testele de volum, corupere, recuperare și concurență trec.

## Etapa 3 --- Documente și foi de calcul

-   PDF;
-   spreadsheet;
-   șabloane;
-   import/export;
-   extragere date inițială.

Poartă: scenarii reale și set de fișiere de test trec fără coruperea
documentelor.

## Etapa 4 --- Organizare și productivitate

-   planner;
-   taskuri;
-   reminders;
-   notificări;
-   document library;
-   formulare.

Poartă: utilizatorul poate crea, atribui, urmări și raporta activități.

## Etapa 5 --- Business

-   stocuri;
-   financiar;
-   contabilitate primară;
-   rapoarte.

Poartă: calculele sunt testate, auditabile și delimitate clar față de
contabilitatea certificată.

## Etapa 6 --- Echipe și rețea

-   pairing;
-   identitate dispozitive;
-   roluri;
-   rețea mesh;
-   sincronizare;
-   offline;
-   rezolvare conflicte;
-   revocare.

Poartă: test pe minimum două PC-uri, în LAN și prin internet, cu
întreruperi și reconectare.

## Etapa 7 --- Informații și proceduri

-   market data;
-   InfoNews;
-   permise și autorizații;
-   surse și licențe.

Poartă: fiecare informație externă are sursă, dată și condiții de
utilizare.

## Etapa 8 --- Comercializare

-   installer stabil;
-   semnare;
-   licențiere;
-   update/rollback;
-   telemetrie doar dacă este justificată, minimă și transparentă;
-   documentație și suport.

Poartă: instalare, upgrade, dezinstalare, backup și restaurare testate
pe medii curate.

## Etapa 9 --- Extindere

-   macOS;
-   module suplimentare;
-   localizări;
-   marketplace/SDK pentru module terțe, doar după maturizarea
    securității.

------------------------------------------------------------------------

# 14. Calitate, testare și criterii generale

Obligatoriu: - teste unitare; - teste de integrare; - teste end-to-end
pentru fluxurile principale; - teste de regresie; - teste de
securitate; - teste de performanță; - teste de recuperare; - teste pe
Windows curat; - testare cu fișiere reale și copii de test; - loguri
utile fără expunerea secretelor.

Nu accepta: - butoane fără acțiune; - date demo prezentate drept date
reale; - funcții mock în versiunea de producție; - erori ascunse; -
sincronizare care suprascrie date fără control; - permisiuni implicite
excesive; - chei secrete în cod sau installer; - dependențe
neverificate; - promisiuni de compatibilitate netestate.

------------------------------------------------------------------------

# 15. Riscuri majore și măsuri

  -----------------------------------------------------------------------
  Risc                                Măsură
  ----------------------------------- -----------------------------------
  Motorul propriu de stocare devine   Prototip izolat, teste de volum și
  prea complex                        recuperare înainte de extindere

  Coruperea fișierelor                Scrieri atomice, jurnal, checksum,
                                      backup verificat

  Conflicte între PC-uri              Jurnal de evenimente, versiuni,
                                      reguli deterministe și rezolvare
                                      manuală

  NAT/firewall blochează conexiunea   Mesh VPN cu fallback relay și
  directă                             testare în rețele diferite

  Dependență de control-plane extern  Documentarea dependenței,
                                      alternative și plan de continuitate

  Licențe open-source incompatibile   Audit juridic și software bill of
                                      materials

  Scope prea mare                     Roadmap etapizat, MVP real și porți
                                      de acceptare

  Date financiare/juridice greșite    Surse oficiale, dată de verificare,
                                      delimitări și avertismente

  Permisiuni incorecte                Teste de autorizare și audit

  UI complexă                         Teste cu utilizatori și profiluri
                                      predefinite
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 16. Registrul deciziilor

  -----------------------------------------------------------------------
  ID                      Decizie                 Statut
  ----------------------- ----------------------- -----------------------
  D-001                   Numele de lucru este    DECIS
                          K.G.B. --- Kronos       
                          Global Business         

  D-002                   Windows este prima      DECIS
                          platformă; macOS        
                          ulterior                

  D-003                   Local-first, fără cloud DECIS
                          obligatoriu pentru      
                          datele de lucru         

  D-004                   Fără server central de  DECIS
                          date/aplicație K.G.B.   

  D-005                   Fără niciun motor de    DECIS
                          baze de date, inclusiv  
                          local                   

  D-006                   Stocare proprie prin    DECIS
                          fișiere structurate,    
                          indexuri și jurnal      

  D-007                   Conectare între PC-uri  DECIS
                          oriunde prin internet   

  D-008                   Installerul include și  DECIS
                          configurează automat    
                          componenta de rețea     

  D-009                   NetBird este candidat   PROPUS
                          de evaluare, nu alegere 
                          finală                  

  D-010                   Tauri 2 + React +       PROPUS
                          TypeScript              

  D-011                   Module                  DECIS
                          activate/dezactivate    
                          fără ștergerea datelor  

  D-012                   Sincronizarea și VPN-ul DECIS
                          sunt subsisteme         
                          distincte               
  -----------------------------------------------------------------------

## 16.1 Decizii încă deschise

-   alegerea finală a stack-ului după prototip;
-   formatul exact al înregistrărilor structurate;
-   pragurile de performanță pentru storage engine;
-   tehnologia finală mesh și modelul de control-plane/relay;
-   protocolul de sincronizare și politica de conflict;
-   modelul de autentificare al utilizatorilor;
-   sistemul de licențiere comercială;
-   funcționalitățile exacte ale MVP;
-   numele juridic/marca și disponibilitatea domeniilor;
-   politica de backup, retenție și recuperare;
-   modelul de actualizare și semnare.

------------------------------------------------------------------------

# 17. Reguli pentru Claude Code

1.  Citește acest document și metapromptul înainte de lucru.
2.  Începe prin auditarea repository-ului și a stării existente. Nu
    suprascrie proiectul.
3.  Nu presupune că repository-ul este gol.
4.  Înainte de implementare, propune structura și planul fișierelor.
5.  Pentru o sarcină mare, împarte munca în pași mici și verificabili.
6.  Nu modifica deciziile marcate DECIS fără aprobare.
7.  Nu introduce DB, cloud obligatoriu sau server central de date.
8.  Nu implementa criptografie proprie.
9.  Nu integra o componentă open-source înainte de verificarea licenței
    și a modelului de distribuție.
10. Nu adăuga funcții necerute doar pentru că sunt ușor de implementat.
11. Nu ascunde limitări și nu marca mock-urile ca funcții complete.
12. După fiecare etapă: rulează build, teste, verificări statice și
    raportează rezultatele.
13. Actualizează documentația și `DECISION_LOG.md`.
14. Dacă o cerință este ambiguă și poate schimba arhitectura, oprește-te
    și cere clarificare.
15. Nu executa acțiuni distructive asupra fișierelor sau datelor fără
    confirmare.

------------------------------------------------------------------------

# 18. Formatul obligatoriu al rapoartelor de progres

La finalul fiecărei sesiuni, Claude Code raportează:

1.  **Ce a inspectat**
2.  **Ce a modificat**
3.  **Ce funcționează efectiv**
4.  **Ce teste a rulat și rezultatele**
5.  **Ce nu funcționează**
6.  **Riscuri sau decizii care cer aprobare**
7.  **Fișiere create/modificate**
8.  **Următorul pas recomandat**

Nu folosi formulări precum „gata" sau „complet" dacă nu există teste și
dovezi.

------------------------------------------------------------------------

## Încheiere

K.G.B. trebuie construit ca o platformă solidă, nu ca o colecție de
ecrane sau module lipite între ele. Prioritatea este un nucleu sigur,
verificabil, extensibil și capabil să păstreze datele corect.
Funcționalitățile comerciale se adaugă numai după ce fundația lor este
validată.
