// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Dicționar de sinonime în română (Word / PowerPoint: Revizuire → Dicționar de sinonime, Shift+F7). Lista e scrisă de noi,
// cu cuvintele folosite des în scrisori, contracte, rapoarte și prezentări. Fiecare rând e un sens: cuvintele de pe el se pot
// înlocui unul cu altul. Un cuvânt cu mai multe sensuri apare pe mai multe rânduri. Folosit de Docs și de Slides.
const DATA = `
bun, excelent, foarte bun, reușit, de calitate
bun, binevoitor, blând, amabil, generos
rău, slab, prost, nereușit, necorespunzător
rău, răutăcios, crud, nemilos, aspru
mare, întins, vast, amplu, considerabil
mare, înalt, uriaș, enorm, imens
mic, redus, mărunt, minor, neînsemnat
mic, scund, micuț, minuscul
nou, recent, proaspăt, actual, modern
vechi, bătrân, învechit, demodat, depășit
vechi, străvechi, antic, vechime
frumos, plăcut, atrăgător, încântător, minunat
urât, neplăcut, respingător, dezagreabil
important, esențial, principal, semnificativ, major
important, crucial, vital, decisiv, hotărâtor
ușor, simplu, facil, lesnicios, accesibil
greu, dificil, anevoios, complicat, complex
greu, apăsător, masiv, ponderos
repede, rapid, iute, grabnic, prompt
încet, lent, domol, agale, tărăgănat
corect, exact, precis, just, fără greșeală
corect, cinstit, onest, drept, echitabil
greșit, eronat, incorect, inexact, fals
clar, limpede, evident, lămurit, explicit
neclar, confuz, ambiguu, vag, nelămurit
sigur, cert, neîndoielnic, garantat, asigurat
sigur, protejat, ferit, la adăpost
nesigur, incert, îndoielnic, ezitant
fericit, bucuros, mulțumit, vesel, încântat
trist, abătut, mâhnit, necăjit, posomorât
calm, liniștit, senin, potolit, relaxat
nervos, agitat, iritat, neliniștit, tensionat
puternic, tare, robust, viguros, solid
slab, firav, fragil, plăpând, debil
bogat, înstărit, avut, prosper, înfloritor
sărac, nevoiaș, sărăcăcios, lipsit
scump, costisitor, piperat, prețios
ieftin, accesibil, avantajos, convenabil
util, folositor, practic, eficient, benefic
inutil, nefolositor, zadarnic, de prisos
necesar, obligatoriu, indispensabil, trebuincios, esențial
posibil, realizabil, fezabil, probabil
imposibil, irealizabil, de neconceput, exclus
diferit, deosebit, distinct, altfel, variat
asemănător, similar, apropiat, analog, la fel
același, identic, egal, echivalent
special, deosebit, aparte, particular, specific
general, comun, obișnuit, global, de ansamblu
obișnuit, normal, uzual, curent, firesc
ciudat, straniu, bizar, neobișnuit, curios
interesant, captivant, atractiv, palpitant, incitant
plictisitor, monoton, anost, banal, fad
curat, igienic, îngrijit, impecabil
murdar, mânjit, pătat, neîngrijit
liber, disponibil, neocupat, liber de obligații
ocupat, prins, angajat, luat
plin, complet, încărcat, ticsit
gol, liber, pustiu, deșert
complet, întreg, integral, total, desăvârșit
parțial, incomplet, fragmentar, limitat
deschis, comunicativ, sincer, prietenos
închis, ferecat, încuiat, zăvorât
cald, călduros, fierbinte, încins
rece, răcoros, înghețat, friguros
bătrân, vârstnic, în vârstă, vechi
tânăr, june, tinerel, crud
deștept, inteligent, isteț, ager, priceput
prost, neghiob, nătâng, nepriceput
harnic, muncitor, sârguincios, silitor, activ
leneș, trândav, inactiv, comod
politicos, amabil, curtenitor, respectuos, manierat
grosolan, nepoliticos, obraznic, necioplit
cinstit, onest, sincer, corect, de încredere
mincinos, necinstit, fals, înșelător
atent, grijuliu, vigilent, concentrat, prudent
neatent, distrat, neglijent, nepăsător
eficient, productiv, eficace, randament bun
rapid, prompt, expeditiv, operativ
suficient, destul, îndestulător, satisfăcător
insuficient, puțin, neîndestulător, redus
principal, de bază, central, fundamental, primordial
secundar, auxiliar, accesoriu, minor
final, ultim, definitiv, concluziv
inițial, primar, de început, original
actual, prezent, curent, de azi, contemporan
viitor, următor, ulterior, apropiat
trecut, anterior, precedent, fost
permanent, constant, continuu, neîntrerupt, statornic
temporar, provizoriu, trecător, vremelnic
frecvent, des, adesea, deseori, regulat
rar, sporadic, ocazional, uneori
evident, vădit, clar, limpede, de netăgăduit
ascuns, tăinuit, secret, dosit
public, deschis, oficial, cunoscut
privat, personal, confidențial, particular
oficial, formal, autorizat, legal
legal, legitim, permis, în regulă
ilegal, nelegal, interzis, ilicit
gratuit, fără plată, gratis, pe degeaba
acum, în prezent, astăzi, actualmente
imediat, îndată, numaidecât, pe loc, de îndată
apoi, după aceea, ulterior, pe urmă
înainte, anterior, mai devreme, în prealabil
mereu, întotdeauna, permanent, constant
niciodată, nicicând, în niciun caz
uneori, câteodată, din când în când, ocazional
foarte, extrem de, deosebit de, tare, nespus de
aproape, lângă, alături, în apropiere
departe, la distanță, îndepărtat, depărtat
mult, numeros, bogat, abundent, din belșug
puțin, redus, limitat, insuficient
totul, tot, întregul, ansamblul
și, precum și, de asemenea, totodată
dar, însă, totuși, cu toate acestea, în schimb
deci, așadar, prin urmare, în consecință
pentru că, deoarece, fiindcă, întrucât, din cauză că
de exemplu, de pildă, spre exemplu, cum ar fi
în plus, mai mult, pe lângă aceasta, suplimentar
în concluzie, în final, pe scurt, rezumând
probabil, poate, posibil, după toate aparențele
desigur, bineînțeles, firește, evident, cu siguranță
face, realiza, efectua, executa, îndeplini
face, crea, produce, construi, fabrica
avea, deține, poseda, dispune de
fi, exista, se afla, se găsi
spune, zice, afirma, declara, menționa
spune, povesti, relata, istorisi, nara
vorbi, discuta, conversa, sta de vorbă
întreba, chestiona, interoga, se interesa
răspunde, replica, reacționa, a da răspuns
explica, lămuri, clarifica, detalia, preciza
arăta, prezenta, demonstra, ilustra, expune
vedea, observa, privi, zări, remarca
privi, se uita, contempla, examina
auzi, asculta, percepe, afla
ști, cunoaște, fi la curent, stăpâni
înțelege, pricepe, sesiza, desluși, interpreta
gândi, cugeta, medita, reflecta, chibzui
crede, considera, socoti, presupune, aprecia
vrea, dori, voi, ține să, avea de gând
putea, fi în stare, reuși, izbuti
trebui, fi necesar, se cuveni, fi obligatoriu
începe, porni, demara, iniția, lansa
termina, încheia, finaliza, sfârși, isprăvi
continua, prelungi, urma, merge mai departe
opri, întrerupe, suspenda, sista, stopa
schimba, modifica, transforma, ajusta, corecta
păstra, menține, conserva, reține, salva
crește, mări, spori, amplifica, extinde
scădea, reduce, micșora, diminua, coborî
pune, așeza, plasa, aranja, poziționa
lua, apuca, prinde, ridica
da, oferi, acorda, dărui, furniza
primi, obține, căpăta, încasa, dobândi
trimite, expedia, transmite, înainta
aduce, transporta, căra, livra
merge, umbla, se deplasa, păși
veni, sosi, ajunge, se apropia
pleca, porni, părăsi, se îndepărta
intra, pătrunde, accede
ieși, părăsi, evacua
ajuta, sprijini, susține, asista, încuraja
lucra, munci, activa, trudi, opera
folosi, utiliza, întrebuința, aplica, apela la
alege, selecta, opta, prefera, desemna
decide, hotărî, stabili, determina, conchide
încerca, testa, proba, verifica, experimenta
verifica, controla, examina, inspecta, analiza
căuta, cerceta, explora, investiga
găsi, descoperi, identifica, depista, afla
pierde, rătăci, scăpa, risipi
câștiga, obține, dobândi, cuceri, realiza
cumpăra, achiziționa, procura
vinde, comercializa, valorifica
plăti, achita, onora, deconta
costa, valora, ajunge la
cere, solicita, pretinde, revendica
oferi, propune, prezenta, pune la dispoziție
accepta, aproba, consimți, admite, încuviința
refuza, respinge, declina, nega
permite, lăsa, îngădui, autoriza, aproba
interzice, opri, împiedica, prohibi
promite, garanta, asigura, angaja
amâna, tergiversa, reprograma, întârzia
grăbi, accelera, urgenta, zori
organiza, planifica, coordona, aranja, structura
conduce, dirija, administra, gestiona, coordona
crea, inventa, concepe, elabora, proiecta
scrie, redacta, nota, consemna, compune
citi, parcurge, lectura, studia
învăța, studia, deprinde, asimila
preda, învăța pe alții, instrui, preda lecții
aminti, reaminti, evoca, menționa
uita, omite, scăpa din vedere, neglija
iubi, îndrăgi, adora, ține la
plăcea, agrea, aprecia, prefera
ura, detesta, displăcea, antipatiza
râde, zâmbi, surâde, se amuza
plânge, lăcrima, se jeli
mânca, consuma, servi, se hrăni
bea, sorbi, consuma
dormi, se odihni, ațipi, moțăi
locui, sta, domicilia, trăi
construi, clădi, ridica, edifica
distruge, strica, dărâma, nimici, ruina
repara, depana, remedia, reface, restaura
curăța, spăla, igieniza, șterge
deschide, descuia, desface
închide, încuia, ferma, sigila
adăuga, insera, completa, include, anexa
elimina, șterge, înlătura, scoate, exclude
include, cuprinde, conține, îngloba
compara, confrunta, pune față în față
compune, alcătui, forma, constitui
depinde, ține de, fi condiționat de
rezolva, soluționa, remedia, lămuri
analiza, examina, studia, evalua, cerceta
evalua, aprecia, estima, cântări, nota
estima, aprecia, evalua, aproxima
calcula, socoti, număra, determina
măsura, cântări, dimensiona
prezenta, expune, înfățișa, descrie
descrie, prezenta, caracteriza, zugrăvi
recomanda, sfătui, sugera, propune, indica
sugera, propune, insinua, recomanda
anunța, informa, comunica, înștiința, notifica
confirma, adeveri, atesta, certifica
semna, parafa, contrasemna
mulțumi, aprecia, fi recunoscător
scuza, ierta, a trece cu vederea
casă, locuință, cămin, domiciliu, reședință
om, persoană, individ, ființă
oameni, persoane, lume, public
copil, prunc, micuț, fiu, fiică
prieten, amic, tovarăș, camarad, coleg
coleg, colaborator, partener, tovarăș de muncă
șef, conducător, director, manager, superior
client, cumpărător, beneficiar, consumator
lucru, obiect, element, chestie
lucru, muncă, activitate, treabă, sarcină
muncă, efort, trudă, activitate, serviciu
loc, spațiu, poziție, zonă, amplasament
timp, vreme, perioadă, durată, interval
moment, clipă, ocazie, prilej
zi, dată, termen
început, debut, pornire, demaraj, start
sfârșit, final, încheiere, capăt, terminare
problemă, dificultate, obstacol, chestiune, necaz
problemă, întrebare, temă, subiect
soluție, rezolvare, variantă, răspuns, remediu
idee, gând, concept, noțiune, propunere
scop, țel, obiectiv, intenție, finalitate
plan, proiect, program, strategie, schemă
rezultat, efect, urmare, consecință, rod
cauză, motiv, pricină, rațiune
motiv, cauză, temei, justificare, argument
avantaj, beneficiu, câștig, plus, privilegiu
dezavantaj, neajuns, inconvenient, minus, lipsă
greșeală, eroare, scăpare, inexactitate, gafă
succes, reușită, izbândă, realizare, triumf
eșec, insucces, nereușită, înfrângere
schimbare, modificare, transformare, prefacere
creștere, sporire, mărire, dezvoltare, avans
scădere, reducere, micșorare, diminuare, declin
dezvoltare, evoluție, progres, creștere, extindere
calitate, valoare, însușire, caracteristică
cantitate, număr, volum, mărime
preț, cost, valoare, tarif
bani, fonduri, sumă, resurse, capital
plată, achitare, decont, rambursare
contract, acord, înțelegere, convenție, tranzacție
document, act, înscris, hârtie, dosar
raport, dare de seamă, referat, informare
scrisoare, mesaj, epistolă, corespondență
întâlnire, ședință, reuniune, adunare, întrevedere
discuție, conversație, dialog, dezbatere
decizie, hotărâre, rezoluție, alegere
regulă, normă, principiu, prevedere, lege
lege, act normativ, normă, reglementare
drept, dreptate, justiție, prerogativă
datorie, obligație, îndatorire, sarcină, responsabilitate
responsabilitate, răspundere, obligație, datorie
condiție, cerință, clauză, stipulație
informație, dată, veste, știre, detaliu
exemplu, model, mostră, caz
tip, fel, gen, categorie, varietate
parte, porțiune, bucată, fragment, segment
grup, echipă, colectiv, formație, ansamblu
firmă, companie, societate, întreprindere, organizație
serviciu, slujbă, post, loc de muncă, funcție
produs, marfă, articol, bun
drum, cale, traseu, rută, itinerar
metodă, mod, procedeu, tehnică, manieră
efort, strădanie, străduință, osteneală
ajutor, sprijin, asistență, susținere, suport
încredere, siguranță, convingere, credință
teamă, frică, spaimă, neliniște, îngrijorare
bucurie, fericire, veselie, încântare, mulțumire
tristețe, mâhnire, durere, amărăciune
dragoste, iubire, afecțiune, atașament
liniște, calm, pace, tăcere, seninătate
zgomot, gălăgie, larmă, vacarm
putere, forță, tărie, energie, vigoare
viteză, iuțeală, rapiditate, repeziciune
sănătate, vigoare, formă bună
boală, afecțiune, maladie, suferință
pericol, risc, primejdie, amenințare
siguranță, securitate, protecție, garanție
adevăr, realitate, certitudine, exactitate
minciună, neadevăr, falsitate, înșelăciune
întrebare, nelămurire, interogare
răspuns, replică, reacție, soluție
nevoie, necesitate, cerință, trebuință, lipsă
dorință, poftă, aspirație, năzuință, vis
vis, visare, aspirație, ideal
istorie, poveste, relatare, narațiune
știre, noutate, veste, informație
oraș, localitate, urbe, municipiu
țară, stat, patrie, națiune
lume, univers, planetă, omenire
natură, mediu, peisaj, fire
apă, lichid, umezeală
foc, flacără, incendiu, văpaie
lumină, strălucire, luminozitate, claritate
întuneric, beznă, obscuritate, umbră
culoare, nuanță, ton, colorit
formă, aspect, contur, structură, configurație
imagine, poză, fotografie, ilustrație, figură
text, conținut, scriere, redactare
cuvânt, termen, vorbă, expresie
titlu, denumire, nume, antet
nume, denumire, apelativ, titlu
listă, enumerare, inventar, tabel, registru
tabel, grilă, situație, centralizator
pagină, foaie, filă
carte, volum, lucrare, tom
prezentare, expunere, demonstrare, prezentare publică
proiect, plan, lucrare, inițiativă
obiectiv, scop, țintă, țel
termen, scadență, dată limită, termen-limită
cost, cheltuială, preț, valoare
profit, câștig, beneficiu, venit
venit, încasare, câștig, salariu
salariu, retribuție, leafă, remunerație
cheltuială, cost, plată, consum
economie, cruțare, păstrare
risc, pericol, incertitudine, hazard
șansă, oportunitate, ocazie, posibilitate
experiență, practică, pricepere, vechime
abilitate, aptitudine, talent, îndemânare, pricepere
cunoștințe, știință, pregătire, informații
educație, învățătură, instruire, formare
școală, instituție de învățământ, liceu, colegiu
profesor, dascăl, învățător, educator, îndrumător
elev, școlar, învățăcel, ucenic
student, studentă, cursant
medic, doctor, specialist
ușă, intrare, poartă, acces
fereastră, geam
masă, birou, pupitru
mașină, autoturism, automobil, vehicul
calculator, computer, PC
telefon, mobil, aparat
`;

export interface SynGroup { /** Sensul (cuvântul care îl numește). */ sense: string; words: string[] }

const strip = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '');
const key = (s: string) => s.toLocaleLowerCase('ro-RO').replace(/ş/g, 'ș').replace(/ţ/g, 'ț').trim();

let index: Map<string, string[][]> | null = null;
let loose: Map<string, string[][]> | null = null;
function build() {
  index = new Map(); loose = new Map();
  for (const line of DATA.split('\n')) {
    const words = [...new Set(line.split(',').map((w) => w.trim()).filter(Boolean))];
    if (words.length < 2) continue;
    for (const w of words) {
      const k = key(w);
      for (const [m, kk] of [[index, k], [loose, strip(k)]] as const) {
        const l = m.get(kk) ?? [];
        if (!l.includes(words)) l.push(words);
        m.set(kk, l);
      }
    }
  }
}

// Formele articulate și de plural cele mai dese, ca „problema”, „clientului”, „documentele” să găsească forma de bază.
const ENDINGS = ['ului', 'ilor', 'elor', 'urilor', 'lor', 'ul', 'le', 'ii', 'uri', 'ele', 'a', 'i', 'e', 'ă'];

/** Sensurile cuvântului și sinonimele pentru fiecare (fără cuvântul căutat). `base` e forma găsită în dicționar. */
export function synonyms(word: string): { base: string; groups: SynGroup[] } {
  if (!index) build();
  const w = key(word);
  const tries = [w, ...ENDINGS.filter((e) => w.length > e.length + 2 && w.endsWith(e)).map((e) => w.slice(0, -e.length)),
    ...ENDINGS.filter((e) => w.length > e.length + 2 && w.endsWith(e)).map((e) => w.slice(0, -e.length) + (e === 'ii' ? 'ie' : 'ă'))];
  for (const t of tries) {
    const hit = index!.get(t) ?? loose!.get(strip(t));
    if (hit?.length) {
      const base = hit[0].find((x) => key(x) === t || strip(key(x)) === strip(t)) ?? t;
      const groups = hit.map((g) => {
        const words = g.filter((x) => key(x) !== key(base));
        return { sense: key(g[0]) === key(base) ? words[0] : g[0], words };
      }).filter((g) => g.words.length);
      return { base, groups };
    }
  }
  return { base: w, groups: [] };
}

/** Pune înlocuitorul cu aceleași majuscule ca originalul: „Mare” → „Vast”, „MARE” → „VAST”. */
export function matchCase(original: string, repl: string): string {
  const letters = original.replace(/[^\p{L}]/gu, '');
  if (letters.length > 1 && letters === letters.toLocaleUpperCase('ro-RO')) return repl.toLocaleUpperCase('ro-RO');
  const first = original.match(/\p{L}/u)?.[0];
  if (first && first !== first.toLocaleLowerCase('ro-RO')) return repl.charAt(0).toLocaleUpperCase('ro-RO') + repl.slice(1);
  return repl;
}

/** Cuvântul din `text` care cuprinde poziția `at` (sau se termină chiar acolo): [început, sfârșit) ori null. */
export function wordAt(text: string, at: number): [number, number] | null {
  const isL = (c: string | undefined) => !!c && /[\p{L}\p{N}-]/u.test(c);
  let a = at, b = at;
  while (a > 0 && isL(text[a - 1])) a--;
  while (b < text.length && isL(text[b])) b++;
  while (a < b && text[a] === '-') a++;
  while (b > a && text[b - 1] === '-') b--;
  return b > a && /\p{L}/u.test(text.slice(a, b)) ? [a, b] : null;
}

/** Câte cuvinte are dicționarul (pentru teste și pentru textul din panou). */
export function thesaurusSize(): number { if (!index) build(); return index!.size; }
