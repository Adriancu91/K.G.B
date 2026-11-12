# K.G.B. — Planul Etapei 8: Comercializare

**Data:** 12 nov. 2026 · **Statut:** PROPUS. Proprietarul a aprobat poarta Etapei 7 (D-091) și a cerut planul Etapei 8. Deciziile noi apar mai jos ca PROPUSE; unele cer alegerea, banii sau semnătura proprietarului (🔒).
**Sursa:** Master Plan §12 (instalare, actualizare, licențiere), §13 (Etapa 8), §16 (decizii deschise: licențierea comercială, modelul de actualizare și semnare, numele și domeniile).

## Ce cere Master Plan-ul
**Etapa 8:**
- installer stabil;
- semnare;
- licențiere;
- actualizare și revenire la versiunea anterioară (rollback);
- telemetrie doar dacă e justificată, minimă și transparentă;
- documentație și suport.

**Poarta:** instalare, upgrade, dezinstalare, backup și restaurare, testate pe medii curate.

## De unde pornim
- **Installerul:** există un installer NSIS (`KGB_0.1.0_x64-setup.exe`), instalat pentru utilizatorul curent, fără drepturi de administrator. Nu e semnat, iar Windows avertizează la instalare.
- **WebView2:** installerul presupune că există deja pe calculator. Pe Windows 11 există; pe unele Windows 10 poate lipsi.
- **Datele** stau separat de program, în dosarul de date al utilizatorului. Backupul verificat și restaurarea ca spațiu nou există (D-030). Backupul automat se face înainte de migrări și zilnic.
- **Ce lipsește:**
  - actualizarea din aplicație;
  - licența;
  - documentația pentru utilizator;
  - lista completă a licențelor componentelor livrate (există `LICENSES.md` și `deny.toml` pentru verificare, nu un fișier de atribuiri livrat cu programul).
- **Versiunea:** e încă 0.1.0, cu banda „Versiune de dinainte de lansare”.
- **GitHub Actions** sunt oprite din 8 nov. din cauza limitei de plată a contului. Build-urile se fac pe laptop.

## Reguli pentru toată etapa
- **Datele omului nu sunt niciodată ținute ostatice.** Fără licență, cu licența expirată sau după dezinstalare, datele rămân pe calculator, se pot deschide și se pot exporta. Licența poate opri funcții, nu accesul la date.
- **Nimic nu „sună acasă”.** Fără telemetrie și fără verificarea licenței pe internet. Actualizările se caută doar la clicul omului (sau periodic, doar dacă omul pornește asta), prin nucleu (D-086).
- **Orice pachet de actualizare e semnat și verificat** înainte de instalare. Înaintea oricărei migrări de date se face backup. O actualizare eșuată se poate întoarce la versiunea de dinainte.
- **Cheile de semnare** (pentru program și pentru actualizări) le ține proprietarul, nu repo-ul și nu agenții. Semnarea o face el sau o mașină pe care o aprobă el.
- **Fără setări de securitate schimbate de noi.** Mediile curate de test (Windows Sandbox, o mașină virtuală, al doilea PC) le pornește proprietarul.
- **Nicio bibliotecă nouă fără acordul proprietarului.** Licențele copyleft (LGPL, GPL) cer acordul lui separat și, la livrare, opinie juridică (Master Plan §12.3).

## Pași
| Pas | Ce | Criteriu de acceptare | Cine / ce cere |
|---|---|---|---|
| 8.1 | **Licențele componentelor:** lista tuturor bibliotecilor livrate (Rust și JavaScript, inclusiv cele aduse indirect), cu licența exactă a versiunii; fișierul de atribuiri (`THIRD-PARTY-NOTICES`) livrat cu installerul și arătat în „Despre”; semnalarea oricărei licențe copyleft sau neclare | Lista generată din `Cargo.lock` și `package-lock.json`, fără nicio componentă cu licență necunoscută; `cargo deny` curat | sesiunile; acord 🔒 pentru orice componentă cu obligații |
| 8.2 | **Versiuni și canale:** versiunea dintr-un singur loc (program, installer, „Despre”, raportul de diagnostic); canalul „stabil” și canalul „test”; banda „pre-lansare” doar pe canalul de test; note de versiune scrise pentru om | O versiune nouă schimbă un singur fișier; e2e verifică versiunea în „Despre” | sesiunile |
| 8.3 | **Installer stabil:** instalare pentru utilizatorul curent (fără administrator), verificarea Windows-ului și a WebView2 (D-095), upgrade peste o versiune veche cu datele păstrate, dezinstalare care **păstrează datele implicit** și spune clar unde sunt și cum se șterg, scurtături, asocieri de fișiere doar dacă le cere omul | Scenariu automat: instalare → date de test → upgrade → datele întregi → dezinstalare → datele încă acolo → reinstalare → datele deschise | sesiunile |
| 8.4 | 🔒 **Medii curate de test:** Windows Sandbox sau o mașină virtuală (pornite de proprietar), plus al doilea PC (6.10) | Proprietarul pornește mediul; noi rulăm scenariile din 8.3, 8.6, 8.7 acolo | proprietarul |
| 8.5 | 🔒 **Semnarea programului (D-092):** certificatul sau serviciul de semnare ales și plătit de proprietar; installerul și programul semnate la fiecare livrare; semnătura verificată după build | `signtool verify` pe installer și pe program; Windows nu mai arată „editor necunoscut” | proprietarul (certificat, cheie, cost) |
| 8.6 | **Actualizarea (D-094):** „Caută actualizări” în Setări (la clic); lista de versiuni semnată, de pe gazda aleasă de proprietar; pachetul descărcat și verificat (semnătura și amprenta) înainte de instalare; backup verificat înainte; după instalare, verificarea că spațiul de lucru se deschide; altfel, revenirea la versiunea de dinainte și la backup | Teste: pachet modificat → refuzat; semnătură greșită → refuzat; migrare eșuată → revenire automată la versiunea și datele de dinainte; e2e pe mediul curat | sesiunile; gazda și cheia 🔒 |
| 8.7 | **Licența (D-093):** fișier de licență semnat de proprietar (firma, CUI, numărul de PC-uri sau de persoane, data de expirare, ce module), verificat local, fără internet; pagina „Licență” (ce e acoperit, până când); la expirare doar funcțiile hotărâte în D-093 se opresc; datele se deschid și se exportă oricum | Teste: licență modificată → refuzată; expirată → funcțiile se opresc cum s-a decis, datele rămân deschise și exportabile; fără licență → modul hotărât (de probă / gratuit) | sesiunile; modelul și cheia 🔒 |
| 8.8 | **Telemetrie (D-096):** niciuna. Erorile rămân în jurnalul local; „Trimite o observație” și pachetul de diagnostic le salvează pe calculator, iar omul le trimite el | Testele verifică că nicio cerere nu pleacă fără clic (ca la D-086) | sesiunile |
| 8.9 | **Documentația:** ghidul utilizatorului (RO și EN), în aplicație (pagina „Ajutor”, căutabilă) și ca PDF: primii pași, fiecare modul, backup și restaurare, două PC-uri, telefonul, întrebări frecvente; ghidul de instalare și de administrare | Fiecare modul activ are pagina lui de ajutor; e2e verifică linkurile și limba | sesiunile |
| 8.10 | **Suport:** pachetul de diagnostic (versiunea, jurnalul fără date personale, starea spațiului de lucru) salvat local, pentru trimis de om; pagina „Probleme cunoscute”; adresa de contact aleasă de proprietar | Pachetul nu conține CNP, chei, parole sau conținutul documentelor (test) | sesiunile; adresa 🔒 |
| 8.11 | **Verificarea de securitate înainte de livrare:** dependențele (vulnerabilități cunoscute), CSP-ul, permisiunile modulelor, căile de internet (D-086), ce rămâne în jurnal, cheile (DPAPI) | Raport scurt cu ce s-a verificat și ce s-a reparat | sesiunile |
| 8.12 | 🔒 **Numele, marca și textele juridice:** numele comercial și domeniile (Master Plan §16), contractul de licență pentru utilizator (EULA) și nota de confidențialitate (ce date stau unde: totul local) | Verificate de proprietar, cu un jurist dacă vrea | proprietarul |
| 8.13 | Raport `docs/ETAPA8_RAPORT.md` | — | sesiunile |
| 8.14 | 🔒 **Poarta Etapei 8:** instalare, upgrade, dezinstalare, backup și restaurare testate pe medii curate | Aprobarea proprietarului | proprietarul |

**Ordinea propusă:** întâi ce nu cere bani sau decizii (8.1, 8.2, 8.3, 8.8, 8.9, 8.10, 8.11). Apoi, după deciziile proprietarului, 8.6 și 8.7. Semnarea (8.5) și mediile curate (8.4) se fac când le pornește proprietarul.

## Decizii propuse
| ID | Decizie | Variante | Recomandare |
|---|---|---|---|
| D-092 🔒 | **Semnarea programului** | (a) Certificat de semnare a codului de la o autoritate (OV), pe numele firmei; cheia stă obligatoriu pe un token hardware sau într-un serviciu în cloud. (b) Serviciul de semnare al Microsoft (Trusted / Artifact Signing), cu abonament lunar, dacă firma din România e eligibilă. (c) Fără semnare deocamdată: Windows avertizează la instalare | (b) dacă firma e eligibilă, altfel (a). Costurile și eligibilitatea le verificăm la furnizori când alegi; nu le dăm din memorie. Până atunci, (c) doar pentru testele tale |
| D-093 🔒 | **Modelul de licență** | (a) Gratuit în perioada de probă (beta), fără licență. (b) Abonament pe firmă (pe an), cu un număr de PC-uri sau persoane. (c) Licență perpetuă pe versiune, cu actualizări un an. Oricare: fișier semnat, verificat fără internet; la expirare, datele rămân deschise și exportabile | (a) acum, apoi (b) sau (c) la lansare. Decizia e comercială, a ta |
| D-094 🔒 | **Unde stau actualizările** | (a) Un repo GitHub separat, doar cu installerele și lista de versiuni semnată (codul rămâne privat). (b) Un domeniu propriu, cu găzduire statică. (c) Fără actualizare din aplicație: omul descarcă installerul nou | (a) la început (fără costuri noi), cu lista și pachetele semnate cu o cheie a ta. Pentru 8.6 e nevoie de o bibliotecă de actualizare: propunem modulul oficial al Tauri (licență MIT/Apache), cu acordul tău |
| D-095 | **WebView2 la instalare** | (a) Ca acum: presupus prezent (Windows 11 îl are). (b) Installerul îl aduce de pe internet dacă lipsește (installer mic). (c) Installerul îl conține (cu peste 100 MB mai mare, merge fără internet) | (b): installer mic; pe Windows 10 fără WebView2 îl descarcă, cu mesaj clar |
| D-096 | **Telemetrie** | (a) Niciuna. (b) Rapoarte de eroare trimise automat, cu acord | (a). Erorile rămân locale, iar omul le trimite el (deja așa) |
| D-097 | **Dezinstalarea** | Datele rămân implicit; ștergerea lor e o opțiune separată, debifată, cu calea arătată și cu backupul recomandat | Da |

## Riscuri
- **Semnarea costă și cere timp:** verificarea firmei de către autoritate poate dura zile. Fără ea, Windows avertizează la fiecare instalare, iar „Smart App Control” poate bloca programul nesemnat.
- **Actualizarea e partea cea mai delicată:** o versiune nouă care migrează datele și eșuează la mijloc. De aceea se face întâi backupul verificat, apoi verificarea că spațiul se deschide, apoi revenirea automată. Se testează cu migrări care eșuează intenționat.
- **Cheile proprietarului** (semnarea programului, a actualizărilor, a licențelor): pierdute sau furate, permit pachete false sau opresc actualizările. Le ține el, cu copie offline. Recomandăm chei separate pentru fiecare folosire.
- **GitHub Actions oprite:** build-urile de livrare se fac pe laptop (8 GB, ~20 min). Un build curat și repetabil cere fie reluarea CI-ului (plata contului), fie o mașină de build aprobată de tine.
- **Obligațiile licențelor open-source:** unele biblioteci livrate pot cere atribuiri sau publicarea modificărilor. Pasul 8.1 le găsește; ce are obligații speciale merge la jurist (Master Plan §12.3).
