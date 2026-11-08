# K.G.B. — Planul Etapei 6: Echipe și rețea

**Data:** 8 nov. 2026 · **Statut:** ÎN LUCRU. Proprietarul a aprobat poarta Etapei 5 (D-055) și a cerut să începem **cu partea care se poate face pe un singur PC**. Deciziile noi apar mai jos ca PROPUSE și se confirmă la poartă.
**Sursa:** Master Plan §8 (rețea, pairing, sincronizare), §6.10 (organizație și roluri), §13 (Etapa 6); spike-urile S1 (sincronizare) și S2 (iroh).

## Ce cere Master Plan-ul
Pairing, identitatea dispozitivelor, roluri, rețea mesh, sincronizare, lucru offline, rezolvarea conflictelor, revocare.

**Poarta:** test pe **minimum două PC-uri**, în LAN și prin internet, cu întreruperi și reconectare. Acest test cere al doilea PC (🔒 6.10, fostul S2.3); fără el etapa nu se poate închide.

## Atenție: iroh nu e încă dovedit între două PC-uri
D-015 a ales iroh cu condiția ca testul pe două PC-uri reale (S2.3) să se facă înainte de Etapa 6. Proprietarul a ales să începem totuși, pe un singur PC. De aceea:
- **ordinea pașilor pune întâi tot ce nu depinde de iroh**: organizație, roluri, invitații, protocolul de sincronizare. Toate se testează între două spații de lucru pe același PC;
- **protocolul de sincronizare nu știe ce rețea îl transportă** (D-057). Dacă testul pe două PC-uri arată că iroh nu merge, se schimbă doar stratul de transport, nu restul etapei;
- testele „rețea reală” de pe un singur PC (două procese, ca în S2) **nu dovedesc** nimic despre LAN sau internet și vor fi raportate ca atare.

## Reguli pentru toată etapa
- **Funcțiile locale merg și fără rețea.** Rețeaua căzută nu blochează nimic; modificările așteaptă și pleacă la reconectare.
- **Nimic nu se suprascrie orbește.** Câmpuri diferite modificate offline se îmbină automat; același câmp modificat pe două PC-uri devine un conflict arătat utilizatorului (deja dovedit în S1).
- **Nu se trimite tot peste tot.** Fiecare dispozitiv primește doar datele pe care rolul lui le poate vedea (§8.6).
- **Invitațiile nu conțin chei private sau parole permanente** (§8.5): au expirare, se pot folosi o singură dată, iar dispozitivul nou intră doar după aprobarea administratorului.
- **Fără server central de date** (D-004). Un relay poate trece trafic criptat, dar nu păstrează date (D-017: relay public doar pentru teste; în producție, relay propriu, decizie 🔒 de cost).
- **Fără setări de securitate Windows schimbate de noi.** Dacă firewall-ul cere permisiune, o cere Windows, iar utilizatorul decide.

## Pași
| Pas | Ce | Criteriu de acceptare | Pe un PC? |
|---|---|---|---|
| 6.1 | **Organizație și roluri:** organizația locală (creată de primul administrator), persoane, roluri implicite (Administrator, Membru, Doar citire) și roluri proprii, cu acces pe module (D-056); ecranul „Organizație” | Teste: un rol fără acces la un modul nu îl poate folosi; ultimul administrator nu poate fi scos | da |
| 6.2 | **Invitații și aprobarea dispozitivelor:** invitație cu expirare și o singură folosire, fără chei private; dispozitivul nou își face singur cheile; administratorul vede amprenta și aprobă; aprobarea e semnată cu cheia administratorului (D-058) | Teste: invitație expirată, refolosită sau modificată → refuzată; dispozitiv neaprobat nu primește nimic | da (două spații de lucru) |
| 6.3 | **Protocolul de sincronizare:** mesaje semnate, independente de rețea (D-057); schimb de „ce ai / ce-ți lipsește” pe baza vectorilor de versiune din S1; doar datele permise de rol (D-059) | Teste între două spații de lucru: același rezultat în ambele sensuri; un membru nu primește datele unui modul interzis | da |
| 6.4 | **Conflicte:** lista de conflicte în aplicație, alegerea unei variante, iar decizia ajunge pe toate dispozitivele (problema rămasă din S1) | Teste: conflict rezolvat pe un PC dispare și pe celălalt; aceeași decizie peste tot | da |
| 6.5 | **Transportul cu iroh în aplicație:** conexiuni criptate între dispozitivele aprobate, descoperire în rețeaua locală, relay doar pentru teste (D-017); stare vizibilă (conectat, prin relay, offline) | Teste cu două procese pe același PC (ca S2); dimensiunea installerului măsurată | parțial: LAN și internet rămân la 6.10 |
| 6.6 | **Offline și reconectare:** coadă de modificări, reluare după întrerupere, sincronizare oprită brusc la mijloc | Teste: proces oprit în mijlocul sincronizării → nimic pierdut, nimic dublat, reluare corectă | da (două procese) |
| 6.7 | **Revocare:** un dispozitiv revocat nu mai primește și nu mai poate trimite nimic; revocarea ajunge la toate dispozitivele | Teste: dispozitiv revocat refuzat, chiar dacă are adresa | da |
| 6.8 | **Fișiere mari:** atașamente transferate separat, cu reluare și verificare BLAKE3 (ca în S2) | Teste: transfer întrerupt și reluat, fișier identic | da (două procese) |
| 6.9 | **Modulul „Dispozitive și sincronizare”:** listă unificată de dispozitive, invitare, aprobare, revocare, conflicte, starea sincronizării | e2e în fereastra reală | da |
| 6.10 | 🔒 **Test pe două PC-uri** (fostul S2.3): LAN, internet (rețele diferite), întreruperi, reconectare | Cere al doilea PC; dacă iroh eșuează, D-015 se redeschide | **nu** |
| 6.11 | Raport `docs/ETAPA6_RAPORT.md` | — | da |
| 6.12 | 🔒 Poarta Etapei 6 | Aprobarea proprietarului | — |

## Decizii propuse
| ID | Decizie | Recomandare |
|---|---|---|
| D-056 | **Roluri pe module:** fiecare rol spune, pentru fiecare modul, „fără acces”, „citire” sau „scriere”. Roluri implicite: Administrator (tot, inclusiv organizația), Membru (scriere în modulele de lucru, fără organizație și fără Business), Doar citire. Permisiuni la nivel de document mai târziu, doar dacă e nevoie | Da. Simplu de înțeles și de verificat |
| D-057 | **Sincronizare separată de rețea** (D-012): protocolul lucrează cu mesaje; iroh doar le transportă. Testele protocolului nu au nevoie de rețea | Da. Protejează etapa dacă iroh pică testul pe două PC-uri |
| D-058 | **Încredere:** organizația are un registru de membri semnat. Primul administrator îl creează; orice adăugare, schimbare de rol sau revocare e semnată de un administrator și verificată pe fiecare dispozitiv. Un dispozitiv acceptă date doar de la dispozitive aflate în registru | Da. Nu e nevoie de server, iar un dispozitiv străin nu poate intra doar știind adresa |
| D-059 | **Ce se sincronizează:** datele modulelor la care rolul are acces, plus registrul organizației. Setările personale și cheile dispozitivului nu pleacă niciodată de pe PC | Da (§8.6) |
| D-060 | **Revocare:** dispozitivul revocat e scos din registru și refuzat de toți. Datele deja copiate pe el **nu pot fi șterse de la distanță** în mod garantat; aplicația spune asta clar | Da. Onest: nicio aplicație locală nu poate garanta ștergerea de la distanță |

## Ce s-a aflat pe drum
- **6.3 — sincronizare parțială:** motorul de stocare din Etapa 0 presupunea că fiecare copie primește *toate* schimbările (fiecare PC își numără schimbările, iar o gaură în numărătoare e o eroare). Ca să respectăm rolurile fără găuri, o schimbare pe care PC-ul nu o poate vedea ajunge ca **marcaj**: aceeași poziție în numărătoare, fără conținut. Marcajele se completează mai târziu, de la orice PC care are datele (de exemplu când rolul e lărgit). Schimbarea e în `crates/kgb-store/src/sync.rs` și are test propriu (`tests/redaction.rs`).
- **Limită cunoscută (6.3):** o schimbare care ajunge printr-un al treilea PC e verificată după drepturile autorului, dar nu e semnată individual de autor. Un membru rău-intenționat ar putea transmite o schimbare în numele altui membru, în limita modulelor în care acela putea scrie. Semnarea fiecărei schimbări e o îmbunătățire pentru mai târziu; până atunci, firmele mici sincronizează de obicei direct cu PC-ul administratorului.
- **6.5 — găsirea celuilalt PC:** iroh 1.4.1 nu are descoperire automată în rețeaua locală fără servere externe. K.G.B. ține o agendă de adrese locală: adresa administratorului vine în invitație, adresa PC-ului nou în cerere, iar fiecare mesaj de sincronizare o actualizează. Portul se păstrează între porniri. Dacă **ambele** PC-uri își schimbă adresa în același timp (alt Wi-Fi, IP nou de la router), nu se mai găsesc fără relay; cu relay-ul (de test sau propriu) se găsesc din nou. De verificat la 6.10.
- **6.5 — mărimea:** iroh adaugă ~2,9 MB la installer (21,3 → 24,2 MB) și ~11 MB la programul instalat.
- **Firewall-ul Windows** poate întreba la prima pornire a rețelei; aplicația nu îl configurează. Pe laptopul de dezvoltare testele pe aceeași mașină au mers fără întrebare.
- **Ora PC-urilor:** dreptul autorului se verifică la momentul schimbării, după ceasul hibrid al jurnalului. Un ceas foarte greșit pe un PC poate face ca o schimbare să fie refuzată (devine marcaj, nu se pierde) până la corectarea ceasului.

## Riscuri
- **iroh netestat între PC-uri reale.** Dacă eșuează la 6.10, se schimbă transportul (D-015 redeschis); pașii 6.1–6.4 rămân valabili.
- **Mărimea installerului:** iroh aduce ~270 de biblioteci. Se măsoară la 6.5 și se raportează.
- **Relay de producție** (D-017): cere un server propriu și un cost lunar, decizie 🔒 a proprietarului înainte de folosirea reală prin internet.
- **Date reale:** tot nu, până la 🔒 testul de pierdere a curentului (2.12).
- **Firewall-ul Windows** poate cere permisiune la prima pornire a rețelei; nu îl configurăm noi.
