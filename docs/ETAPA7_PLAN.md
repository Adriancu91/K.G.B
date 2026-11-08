# K.G.B. — Planul Etapei 7: Informații, proceduri și module noi

**Data:** 8 nov. 2026 · **Statut:** ÎN LUCRU. Proprietarul a cerut să mergem mai departe cu module noi („Ok mergi mai departe adaugă mai multe module”, D-061), cât timp Etapa 6 așteaptă testul pe două PC-uri (🔒 6.10, programat luni seara, 9 nov. 2026). Deciziile noi apar mai jos ca PROPUSE și se confirmă la poartă.
**Sursa:** Master Plan §13 (Etapa 7), §6.6 (Permise și autorizații), §6.10 (Piață și informații), §6.8 (Echipă și pontaj), §6.12 (module viitoare posibile).

## Ce cere Master Plan-ul
Etapa 7: date de piață, InfoNews, permise și autorizații, surse și licențe.

**Poarta:** fiecare informație externă are **sursă, dată și condiții de utilizare**.

Pe lângă Etapa 7, adăugăm două module care folosesc direct ce există deja:
- **Echipă și pontaj** (Master Plan §6.8): folosește persoanele și rolurile din Etapa 6;
- **Calculator și conversii** (§6.12): util zilnic, fără date externe.

## Reguli pentru toată etapa
- **Nicio informație externă fără sursă.** Orice știre, cotație sau regulă are lângă ea sursa (cu link), data la care a fost luată sau verificată și condițiile de folosire ale sursei (D-062).
- **Aplicația nu ia singură de pe internet decât din surse alese de tine.** Fără surse alese, modulele merg doar cu date introduse de mână sau importate.
- **Fără scraping.** Doar fluxuri publice oferite chiar de sursă (RSS/Atom) sau API-uri ai căror termeni permit folosirea. Datele de bursă în timp real cer de obicei licență: alegerea furnizorului e decizia ta (🔒).
- **Informația juridică nu e consultanță.** Modulul de autorizații spune clar că se verifică la instituție și arată data ultimei verificări a fiecărei reguli.
- **Datele angajaților sunt date personale.** Le văd doar rolurile cărora le dai acces; pontajul respectă legislația muncii și GDPR, fără supraveghere ascunsă.
- **Întâi ce se vede:** fiecare pas se termină cu ceva ce se poate folosi în aplicație.

## Pași
| Pas | Ce | Criteriu de acceptare |
|---|---|---|
| 7.1 | **Registrul de surse și licențe** (în nucleu): pentru fiecare sursă externă — nume, link, tip (RSS, API, document oficial), condițiile de folosire (text și link), licența, data ultimei verificări, cine a aprobat-o | Teste: o sursă fără condiții de folosire nu poate fi activată; o sursă oprită nu mai e folosită de niciun modul |
| 7.2 | **Modulul „Permise și autorizații”**: biblioteca de proceduri (instituție, condiții, documente necesare, taxe și termene cu dată de verificare, checklist, surse oficiale cu link și dată, obligatoriu vs. recomandat); **dosare** pe proiect cu checklist bifat și documente atașate; memento-uri pentru termene; avertisment când o regulă n-a mai fost verificată de mult | Teste: o procedură fără sursă oficială e marcată „neverificată”; termenele trimit memento-uri; e2e |
| 7.3 | **Modulul „Echipă și pontaj”**: angajați (legați opțional de persoanele organizației), ture, pontaj zilnic (intrare/ieșire, pauze), ore suplimentare, concedii și absențe cu aprobare, raport lunar exportabil | Teste: orele calculate pe exemple de mână (inclusiv peste miezul nopții); un concediu peste altul refuzat; acces doar pe rol; e2e |
| 7.4 | **Modulul „Calculator și conversii”**: calculator cu istoric, conversii de unități (lungime, suprafață, volum, masă, temperatură, energie) și calcule uzuale (TVA, adaos/marjă, procente, dobândă simplă) | Teste cu exemple de mână; fără virgulă mobilă la bani; e2e |
| 7.5 | **InfoNews**: cititor RSS/Atom doar din sursele aprobate în registru; fiecare știre cu sursa, ora și linkul; categorii; citit/necitit; memento pentru cuvinte-cheie | Teste pe fluxuri RSS/Atom salvate local; o sursă neaprobată nu e citită; e2e cu un flux local de test |
| 7.6 | **Piață, partea 1**: listă de urmărire (acțiuni, indici, ETF, FX, crypto, mărfuri), cotații introduse de mână sau importate CSV, cu sursa și ora fiecărei cotații, grafic istoric, alerte de prag | Teste: alertele pe exemple; fiecare cotație are sursă și oră; e2e |
| 7.7 | 🔒 **Piață, partea 2**: cotații automate de la un furnizor ales de proprietar (termeni și licență verificate) | Decizia ta: ce furnizor, cu ce cost și ce întârziere |
| 7.8 | Raport `docs/ETAPA7_RAPORT.md` | — |
| 7.9 | 🔒 Poarta Etapei 7 | Aprobarea proprietarului |

## Decizii propuse
| ID | Decizie | Recomandare |
|---|---|---|
| D-061 | Etapa 7 începe înaintea porții Etapei 6, la cererea proprietarului; Etapa 6 rămâne deschisă până la testul pe două PC-uri | DECIS (cerut de proprietar) |
| D-062 | **Registru central de surse:** niciun modul nu folosește o sursă externă care nu e în registru, cu condiții de folosire și dată de verificare | Da. Asta e chiar poarta Etapei 7 |
| D-063 | **Fără date externe implicite:** aplicația vine fără surse active; le adaugi și aprobi tu (eventual dintr-o listă de surse propuse, fiecare cu termenii ei) | Da. Nicio cerere pe internet fără acordul tău |
| D-064 | **Pontaj declarativ:** angajatul (sau responsabilul) introduce orele; aplicația nu urmărește calculatorul, ecranul sau locația | Da. Supravegherea ascunsă e interzisă de Master Plan §6.8 și de GDPR |
| D-065 | **Calcule cu bani în bani întregi** și în modulul de calcul (ca D-049); conversiile de unități folosesc factori exacți, cu rotunjirea afișată | Da |

## Riscuri
- **Informația juridică se schimbă.** Fiecare regulă are data verificării; aplicația avertizează când e veche.
- **Fluxurile RSS se schimbă sau dispar.** Sursa apare ca „nu răspunde”, fără să blocheze nimic.
- **Date personale (pontaj, concedii).** Acces doar pe rol; exportul e o acțiune explicită și apare în jurnal.
- **Date reale:** tot nu, până la 🔒 testul de pierdere a curentului (2.12).
