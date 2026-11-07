# K.G.B. — Planul Etapei 5: Business

**Data:** 8 nov. 2026 · **Statut:** ÎN LUCRU. Etapa a fost aprobată de proprietar (D-048); deciziile noi apar mai jos ca PROPUSE și se confirmă la poartă.
**Sursa:** Master Plan §6.7 (Finance & Inventory), §13 (Etapa 5), §1.1 (principii), §9 (stocare fără baze de date).

## Ce cere Master Plan-ul
Stocuri, financiar, contabilitate primară, rapoarte.

**Poarta:** calculele sunt **testate, auditabile** și **delimitate clar** față de contabilitatea certificată.

## Reguli pentru toată etapa
- **Banii nu se calculează cu numere cu virgulă mobilă.** Sumele sunt numere întregi de bani (1 leu = 100 de bani), iar cantitățile au precizie fixă. Fiecare rotunjire are o regulă scrisă și un test (D-049).
- **Nimic contabil nu se șterge și nu se modifică după înregistrare.** O greșeală se corectează cu o operație inversă (storno), care rămâne vizibilă. Așa orice sold se poate reface din istoric (D-051).
- **Fiecare total se poate verifica:** soldul de stoc este suma mișcărilor, iar soldul unui client este suma facturilor minus încasările. Aplicația are o verificare de consistență care reface totul din istoric și compară.
- **Delimitare clară:** pe fiecare ecran scrie „evidență primară, nu contabilitate certificată”. Cotele de TVA, e-Factura și SAF-T se verifică separat, cu un contabil și pe surse oficiale (D-052).
- **Întâi ce se vede:** fiecare pas se termină cu ceva ce se poate folosi în aplicație.

## Pași
| Pas | Ce | Criteriu de acceptare |
|---|---|---|
| 5.1 | **Modulul Business (beta), stocuri, partea 1:** produse (cod, cod de bare, unitate, categorie), depozite, recepții și ieșiri ca mișcări care nu se mai modifică, stocul pe depozit, stoc minim cu notificare | Teste: stocul = suma mișcărilor; ieșire peste stoc refuzată; e2e |
| 5.2 | **Stocuri, partea 2:** transferuri între depozite, inventar (diferențele devin mișcări de corecție), cost mediu ponderat (D-050), loturi și serii unde e nevoie | Teste: cost mediu calculat de mână pe exemple; inventar cu plus și minus |
| 5.3 | **Parteneri și facturi emise:** clienți și furnizori (CUI verificat ca format), facturi cu serie și numere fără goluri (D-054), linii cu TVA, storno, chitanțe; factura PDF din model Typst (D-045) | Teste: totaluri și TVA pe exemple calculate de mână; numerotare fără goluri și după oprire forțată |
| 5.4 | **Facturi primite și cheltuieli:** introducere manuală și preluare din registrul Extragere date (prin export/import, fără acces direct între module) | Teste: aceeași factură nu intră de două ori |
| 5.5 | **Casă și bancă:** registru de casă, conturi bancare, import de extrase CSV, încasări și plăți legate de facturi, avansuri și deconturi | Teste: soldul de casă nu devine negativ fără avertisment; o plată se leagă de o factură o singură dată |
| 5.6 | **Scadențar și situații:** facturi neîncasate sau neplătite pe vechime, fișa partenerului, memento-uri pentru scadențe | Teste: solduri pe partener = facturi − plăți |
| 5.7 | **Rapoarte:** vânzări și cheltuieli pe perioadă, client, produs; stoc valoric; profitabilitate simplă; export XLSX/CSV verificat | Teste: rapoartele refăcute din istoric dau aceleași cifre |
| 5.8 | **Audit și consistență:** jurnalul tuturor operațiilor, verificarea care reface soldurile din istoric, setul de exemple calculate de mână | Teste: 0 diferențe pe setul de exemple și după 1.000 de operații aleatoare |
| 5.9 | Raport `docs/ETAPA5_RAPORT.md` | — |
| 5.10 | 🔒 Poarta Etapei 5 | Aprobarea proprietarului |

## Decizii propuse
| ID | Decizie | Recomandare |
|---|---|---|
| D-049 | **Bani și cantități:** sume în bani (întregi), cantități cu 3 zecimale fixe; TVA calculat pe linie și rotunjit la ban, totalul documentului = suma liniilor; doar RON la început, alte valute cu curs introdus de mână și păstrat pe document | Da. Fără virgulă mobilă nu apar diferențe de un ban care nu se pot explica |
| D-050 | **Costul stocului:** cost mediu ponderat, pe depozit; FIFO mai târziu, dacă e nevoie | Da. Cel mai simplu de verificat și cel mai folosit în firmele mici |
| D-051 | **Istoric care nu se schimbă:** fiecare document înregistrat (recepție, factură, plată) rămâne cum a fost; corecturile sunt storno, vizibile | Da. Asta face calculele auditabile |
| D-052 | **Delimitare:** „evidență primară”, nu contabilitate certificată; cotele de TVA se pot configura, cu dată de început, iar valorile implicite (21%, 11%, 0%) se confirmă de proprietar sau de contabil; e-Factura (ANAF) și SAF-T nu fac parte din Etapa 5 | Da. Obligațiile fiscale cer validare pe surse oficiale (Master Plan §6.7) |
| D-053 | **Un singur modul „Business”** pentru stocuri și financiar, nu două: factura scade stocul, iar modulele nu au acces unul la datele altuia | Da. Separarea în două module ar cere o legătură între module, care încă nu există |
| D-054 | **Numerotarea facturilor:** pe serii, cu numere consecutive, fără goluri și fără refolosire, alocate în aceeași scriere atomică cu factura | Da. Cerință legală obișnuită pentru facturi |

## Riscuri
- **Fiscalitatea se schimbă** (cote de TVA, e-Factura, SAF-T). Aplicația nu promite conformitate automată; cotele sunt date configurabile, cu dată.
- **Datele reale ale firmei** pot intra în aplicație abia după 🔒 testul de pierdere a curentului (2.12), care rămâne obligatoriu.
- **Volum:** zeci de mii de mișcări de stoc pe an. Indexurile din Etapa 2 trebuie verificate pe acest volum (pasul 5.8).
- **Mărimea installerului** nu ar trebui să crească în această etapă: nu sunt necesare biblioteci noi.
