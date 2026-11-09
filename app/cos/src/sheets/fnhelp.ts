// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Lista pentru fereastra „fx Inserează funcție”: funcțiile folosite des, cu explicații în română.
// Restul funcțiilor (peste 500) apar la „Toate”, doar cu numele.
import { EN_FN } from './fnhelp-en';

export type FnCat = 'Uzuale' | 'Matematică' | 'Statistică' | 'Text' | 'Dată și oră' | 'Logice' | 'Căutare' | 'Financiare' | 'Informații';
export const FN_CATS: FnCat[] = ['Uzuale', 'Matematică', 'Statistică', 'Text', 'Dată și oră', 'Logice', 'Căutare', 'Financiare', 'Informații'];

export interface FnHelp { name: string; cat: FnCat; args: string; desc: string; common?: boolean }

export const FN_HELP: FnHelp[] = [
  { name: 'SUM', cat: 'Matematică', args: 'număr1; [număr2]; …', desc: 'Adună numerele (de exemplu o coloană: SUM(B2:B20)).', common: true },
  { name: 'AVERAGE', cat: 'Statistică', args: 'număr1; [număr2]; …', desc: 'Media numerelor.', common: true },
  { name: 'COUNT', cat: 'Statistică', args: 'valoare1; [valoare2]; …', desc: 'Câte celule conțin numere.', common: true },
  { name: 'COUNTA', cat: 'Statistică', args: 'valoare1; [valoare2]; …', desc: 'Câte celule nu sunt goale.', common: true },
  { name: 'MAX', cat: 'Statistică', args: 'număr1; [număr2]; …', desc: 'Cel mai mare număr.', common: true },
  { name: 'MIN', cat: 'Statistică', args: 'număr1; [număr2]; …', desc: 'Cel mai mic număr.', common: true },
  { name: 'IF', cat: 'Logice', args: 'condiție; dacă_da; [dacă_nu]', desc: 'Alege între două valori după o condiție, de exemplu IF(B2>1000; "mare"; "mic").', common: true },
  { name: 'IFERROR', cat: 'Logice', args: 'valoare; dacă_eroare', desc: 'Arată altceva în loc de o eroare (#DIV/0!, #N/A…).', common: true },
  { name: 'SUMIF', cat: 'Matematică', args: 'zonă; criteriu; [zonă_sumă]', desc: 'Adună doar ce îndeplinește criteriul, de exemplu SUMIF(A:A; "Ion"; B:B).', common: true },
  { name: 'COUNTIF', cat: 'Statistică', args: 'zonă; criteriu', desc: 'Câte celule îndeplinesc criteriul.', common: true },
  { name: 'VLOOKUP', cat: 'Căutare', args: 'ce_cauți; tabel; nr_coloană; [aproximativ]', desc: 'Caută o valoare în prima coloană a unui tabel și întoarce ce e pe același rând, în coloana cerută.', common: true },
  { name: 'XLOOKUP', cat: 'Căutare', args: 'ce_cauți; unde_cauți; ce_întorci; [dacă_lipsește]', desc: 'Căutare modernă: în orice coloană, în orice direcție.', common: true },
  { name: 'IMAGE', cat: 'Căutare', args: 'sursă; [text_alternativ]; [mărime]; [înălțime]; [lățime]', desc: 'Pune în celulă o poză de la o adresă web (http / https). Mărimea: 0 încape în celulă, 1 o umple, 2 mărimea pozei, 3 înălțimea și lățimea date.' },
  { name: 'WEBSERVICE', cat: 'Text', args: 'adresă', desc: 'Aduce textul de la o adresă web (http / https), de exemplu un curs valutar sau un XML; cu FILTERXML scoți din el ce-ți trebuie. Cât se aduce, celula arată #BUSY!.' },
  { name: 'DETECTLANGUAGE', cat: 'Text', args: 'text', desc: 'Limba în care e scris textul, ca cod de două litere (ro, en, fr, de, it, es, hu, pt, nl, pl), ghicită pe calculator, fără internet.' },
  { name: 'ROUND', cat: 'Matematică', args: 'număr; zecimale', desc: 'Rotunjește la numărul de zecimale cerut (de exemplu la bani: 2).', common: true },
  { name: 'TODAY', cat: 'Dată și oră', args: '', desc: 'Data de azi (se schimbă singură în fiecare zi).', common: true },
  { name: 'CONCAT', cat: 'Text', args: 'text1; [text2]; …', desc: 'Lipește mai multe texte într-unul singur.', common: true },
  { name: 'SUMIFS', cat: 'Matematică', args: 'zonă_sumă; zonă1; criteriu1; …', desc: 'Adună ce îndeplinește mai multe criterii deodată.' },
  { name: 'COUNTIFS', cat: 'Statistică', args: 'zonă1; criteriu1; …', desc: 'Câte rânduri îndeplinesc mai multe criterii deodată.' },
  { name: 'AVERAGEIF', cat: 'Statistică', args: 'zonă; criteriu; [zonă_medie]', desc: 'Media doar pentru ce îndeplinește criteriul.' },
  { name: 'PRODUCT', cat: 'Matematică', args: 'număr1; [număr2]; …', desc: 'Înmulțește numerele.' },
  { name: 'ABS', cat: 'Matematică', args: 'număr', desc: 'Valoarea fără semn (−5 devine 5).' },
  { name: 'ROUNDUP', cat: 'Matematică', args: 'număr; zecimale', desc: 'Rotunjește mereu în sus.' },
  { name: 'ROUNDDOWN', cat: 'Matematică', args: 'număr; zecimale', desc: 'Rotunjește mereu în jos.' },
  { name: 'INT', cat: 'Matematică', args: 'număr', desc: 'Partea întreagă (în jos).' },
  { name: 'MOD', cat: 'Matematică', args: 'număr; împărțitor', desc: 'Restul împărțirii.' },
  { name: 'POWER', cat: 'Matematică', args: 'număr; putere', desc: 'Ridică la putere.' },
  { name: 'SQRT', cat: 'Matematică', args: 'număr', desc: 'Radicalul.' },
  { name: 'SUMPRODUCT', cat: 'Matematică', args: 'zonă1; [zonă2]; …', desc: 'Înmulțește zonele element cu element și adună rezultatele (de exemplu cantitate × preț).' },
  { name: 'RANDBETWEEN', cat: 'Matematică', args: 'de_la; până_la', desc: 'Un număr întreg la întâmplare între două valori.' },
  { name: 'LET', cat: 'Logice', args: 'nume1; valoare1; [nume2; valoare2]; …; calcul', desc: 'Dă nume unor rezultate intermediare și le folosește în calcul, de exemplu LET(x; A1*2; x+x*0,19).' },
  { name: 'GROUPBY', cat: 'Căutare', args: 'chei; valori; funcție; [antete]; [totaluri]; [sortare]; [filtru]', desc: 'Rezumatul valorilor pe fiecare grup de chei (ca un tabel pivot într-o formulă), de exemplu GROUPBY(A2:A50; C2:C50; SUM): totalul pe fiecare zonă, plus totalul general.' },
  { name: 'PIVOTBY', cat: 'Căutare', args: 'chei rânduri; chei coloane; valori; funcție; [antete]; [totaluri rânduri]; [sortare rânduri]; [totaluri coloane]; [sortare coloane]; [filtru]', desc: 'Un tabel pivot într-o formulă: grupurile pe rânduri și pe coloane, de exemplu PIVOTBY(A2:A50; B2:B50; C2:C50; SUM) dă suma pe fiecare zonă (rânduri) și lună (coloane), cu totaluri.' },
  { name: 'ISOMITTED', cat: 'Logice', args: 'parametru', desc: 'ADEVĂRAT dacă parametrul unui LAMBDA n-a primit valoare, ca să-i dai una implicită: LET(f; LAMBDA(x; [y]; IF(ISOMITTED(y); x; x*y)); f(5)).' },
  { name: 'LAMBDA', cat: 'Logice', args: 'param1; [param2]; …; calcul', desc: 'O funcție proprie, folosită în LET sau în MAP / REDUCE / BYROW, de exemplu MAP(A1:A5; LAMBDA(x; x*2)).' },
  { name: 'MAP', cat: 'Logice', args: 'zonă1; [zonă2]; …; LAMBDA', desc: 'Calculează LAMBDA-ul pentru fiecare celulă din zonă (rezultatul are aceeași formă).' },
  { name: 'REDUCE', cat: 'Logice', args: 'valoare_inițială; zonă; LAMBDA(total; x)', desc: 'Strânge zona într-o singură valoare, celulă cu celulă (de exemplu o sumă cu condiții proprii).' },
  { name: 'SCAN', cat: 'Logice', args: 'valoare_inițială; zonă; LAMBDA(total; x)', desc: 'Ca REDUCE, dar arată totalul după fiecare celulă (de exemplu soldul cumulat).' },
  { name: 'BYROW', cat: 'Logice', args: 'zonă; LAMBDA(rând)', desc: 'Câte un rezultat pentru fiecare rând (de exemplu maximul fiecărui rând).' },
  { name: 'BYCOL', cat: 'Logice', args: 'zonă; LAMBDA(coloană)', desc: 'Câte un rezultat pentru fiecare coloană.' },
  { name: 'MAKEARRAY', cat: 'Logice', args: 'rânduri; coloane; LAMBDA(r; c)', desc: 'Un tabel nou, cu fiecare celulă calculată din numărul rândului și al coloanei (de exemplu tabla înmulțirii).' },
  { name: 'WRAPROWS', cat: 'Căutare', args: 'listă; câte; [umplere]', desc: 'Așază o listă lungă pe rânduri de câte N (de exemplu o coloană de nume în tabel cu 3 coloane).' },
  { name: 'WRAPCOLS', cat: 'Căutare', args: 'listă; câte; [umplere]', desc: 'Așază o listă lungă pe coloane de câte N.' },
  { name: 'EXPAND', cat: 'Căutare', args: 'zonă; rânduri; [coloane]; [umplere]', desc: 'Mărește o zonă la numărul dat de rânduri și coloane; celulele noi primesc umplerea.' },
  { name: 'RAND', cat: 'Matematică', args: '', desc: 'Un număr la întâmplare între 0 și 1 (se schimbă la fiecare recalculare).' },
  { name: 'PERCENTOF', cat: 'Matematică', args: 'parte; tot', desc: 'Cât la sută din total e partea (de exemplu PERCENTOF(B2; B2:B10), cu format procent).' },
  { name: 'REGEXTEST', cat: 'Text', args: 'text; tipar; [fără_litere_mari]', desc: 'Verifică dacă textul se potrivește cu un tipar (expresie regulată), de exemplu un cod poștal din 6 cifre: REGEXTEST(A2; "^[0-9]{6}$").' },
  { name: 'REGEXEXTRACT', cat: 'Text', args: 'text; tipar; [mod]; [fără_litere_mari]', desc: 'Scoate din text bucata care se potrivește cu tiparul (mod 1: toate, mod 2: grupurile).' },
  { name: 'REGEXREPLACE', cat: 'Text', args: 'text; tipar; înlocuire; [a_câta]; [fără_litere_mari]', desc: 'Înlocuiește bucățile care se potrivesc cu tiparul ($1, $2 = grupurile din tipar).' },
  { name: 'VALUETOTEXT', cat: 'Text', args: 'valoare; [strict]', desc: 'Valoarea ca text (cu strict = 1, textele apar între ghilimele).' },
  { name: 'ARRAYTOTEXT', cat: 'Text', args: 'zonă; [strict]', desc: 'Toate valorile unei zone într-un singur text („1, 2, a”); cu strict = 1, ca o constantă matrice cu acolade.' },
  { name: 'TREND', cat: 'Statistică', args: 'y_cunoscuți; [x_cunoscuți]; [x_noi]; [cu_constantă]', desc: 'Prognoză după o dreaptă potrivită prin puncte (de exemplu vânzările lunilor următoare).' },
  { name: 'GROWTH', cat: 'Statistică', args: 'y_cunoscuți; [x_cunoscuți]; [x_noi]; [cu_constantă]', desc: 'Prognoză după o creștere exponențială (de exemplu o creștere cu un procent constant).' },
  { name: 'LINEST', cat: 'Statistică', args: 'y_cunoscuți; [x_cunoscuți]; [cu_constantă]; [statistici]', desc: 'Panta și punctul de pornire ale dreptei potrivite prin puncte; cu statistici: erori, R², F și sumele de pătrate.' },
  { name: 'LOGEST', cat: 'Statistică', args: 'y_cunoscuți; [x_cunoscuți]; [cu_constantă]; [statistici]', desc: 'Factorul de creștere și valoarea de pornire ale curbei exponențiale potrivite prin puncte (y = b·m^x).' },
  { name: 'AGGREGATE', cat: 'Matematică', args: 'funcție; opțiuni; zonă; [k]', desc: 'Sumă, medie, maxim, al k-lea cel mai mare… (19 calcule) care poate sări peste erori, rânduri ascunse și alte subtotaluri.' },
  { name: 'RANDARRAY', cat: 'Matematică', args: '[rânduri]; [coloane]; [min]; [max]; [întregi]', desc: 'Un tabel de numere la întâmplare (de exemplu 5 zaruri: RANDARRAY(5; 1; 1; 6; ADEVĂRAT)).' },
  { name: 'MEDIAN', cat: 'Statistică', args: 'număr1; [număr2]; …', desc: 'Valoarea din mijloc.' },
  { name: 'MODE', cat: 'Statistică', args: 'număr1; [număr2]; …', desc: 'Valoarea care apare cel mai des.' },
  { name: 'STDEV', cat: 'Statistică', args: 'număr1; [număr2]; …', desc: 'Abaterea standard (cât de împrăștiate sunt valorile).' },
  { name: 'LARGE', cat: 'Statistică', args: 'zonă; k', desc: 'A k-a cea mai mare valoare.' },
  { name: 'SMALL', cat: 'Statistică', args: 'zonă; k', desc: 'A k-a cea mai mică valoare.' },
  { name: 'RANK', cat: 'Statistică', args: 'număr; zonă; [crescător]', desc: 'Locul unui număr în clasament.' },
  { name: 'COUNTBLANK', cat: 'Statistică', args: 'zonă', desc: 'Câte celule sunt goale.' },
  { name: 'LEN', cat: 'Text', args: 'text', desc: 'Câte caractere are textul.' },
  { name: 'LEFT', cat: 'Text', args: 'text; [câte]', desc: 'Primele caractere din stânga.' },
  { name: 'RIGHT', cat: 'Text', args: 'text; [câte]', desc: 'Ultimele caractere din dreapta.' },
  { name: 'MID', cat: 'Text', args: 'text; de_unde; câte', desc: 'O bucată din mijlocul textului.' },
  { name: 'UPPER', cat: 'Text', args: 'text', desc: 'Totul cu litere mari.' },
  { name: 'LOWER', cat: 'Text', args: 'text', desc: 'Totul cu litere mici.' },
  { name: 'PROPER', cat: 'Text', args: 'text', desc: 'Prima literă a fiecărui cuvânt mare (ion popescu → Ion Popescu).' },
  { name: 'TRIM', cat: 'Text', args: 'text', desc: 'Scoate spațiile în plus.' },
  { name: 'SUBSTITUTE', cat: 'Text', args: 'text; vechi; nou; [a_câta]', desc: 'Înlocuiește o bucată de text cu alta.' },
  { name: 'TEXT', cat: 'Text', args: 'valoare; format', desc: 'Scrie un număr sau o dată în formatul dorit, de exemplu TEXT(A1; "dd.mm.yyyy").' },
  { name: 'TEXTJOIN', cat: 'Text', args: 'separator; sari_goale; text1; …', desc: 'Lipește texte cu un separator între ele.' },
  { name: 'FIND', cat: 'Text', args: 'ce_cauți; în_text; [de_la]', desc: 'Poziția unui text în alt text (ține cont de litere mari/mici).' },
  { name: 'SEARCH', cat: 'Text', args: 'ce_cauți; în_text; [de_la]', desc: 'Poziția unui text în alt text (nu contează literele mari/mici).' },
  { name: 'VALUE', cat: 'Text', args: 'text', desc: 'Transformă un text care arată ca un număr în număr.' },
  { name: 'SUMAINLITERE', cat: 'Text', args: 'sumă; [monedă]', desc: 'Suma scrisă în litere, pentru facturi și chitanțe (125,50 → o sută douăzeci și cinci lei și cincizeci de bani); moneda poate fi și EUR, USD, GBP, CHF, MDL, HUF, PLN.' },
  { name: 'NOW', cat: 'Dată și oră', args: '', desc: 'Data și ora de acum.' },
  { name: 'DATE', cat: 'Dată și oră', args: 'an; lună; zi', desc: 'Face o dată din an, lună și zi.' },
  { name: 'YEAR', cat: 'Dată și oră', args: 'dată', desc: 'Anul dintr-o dată.' },
  { name: 'MONTH', cat: 'Dată și oră', args: 'dată', desc: 'Luna dintr-o dată (1–12).' },
  { name: 'DAY', cat: 'Dată și oră', args: 'dată', desc: 'Ziua din lună.' },
  { name: 'WEEKDAY', cat: 'Dată și oră', args: 'dată; [tip]', desc: 'Ziua săptămânii (cu tipul 2: luni = 1).' },
  { name: 'DATEDIF', cat: 'Dată și oră', args: 'început; sfârșit; unitate', desc: 'Diferența dintre două date în ani ("Y"), luni ("M") sau zile ("D"); de exemplu vârsta.' },
  { name: 'EDATE', cat: 'Dată și oră', args: 'dată; luni', desc: 'Data de peste câteva luni (de exemplu scadența).' },
  { name: 'EOMONTH', cat: 'Dată și oră', args: 'dată; luni', desc: 'Ultima zi a lunii.' },
  { name: 'NETWORKDAYS', cat: 'Dată și oră', args: 'început; sfârșit; [sărbători]', desc: 'Câte zile lucrătoare sunt între două date.' },
  { name: 'WORKDAY', cat: 'Dată și oră', args: 'început; zile; [sărbători]', desc: 'Data după un număr de zile lucrătoare.' },
  { name: 'AND', cat: 'Logice', args: 'condiție1; [condiție2]; …', desc: 'ADEVĂRAT dacă toate condițiile sunt îndeplinite.' },
  { name: 'OR', cat: 'Logice', args: 'condiție1; [condiție2]; …', desc: 'ADEVĂRAT dacă măcar o condiție e îndeplinită.' },
  { name: 'NOT', cat: 'Logice', args: 'condiție', desc: 'Inversează ADEVĂRAT și FALS.' },
  { name: 'IFS', cat: 'Logice', args: 'condiție1; valoare1; …', desc: 'Mai multe condiții la rând; se ia prima îndeplinită.' },
  { name: 'SWITCH', cat: 'Logice', args: 'valoare; caz1; rezultat1; …; [altfel]', desc: 'Alege rezultatul după valoare.' },
  { name: 'HLOOKUP', cat: 'Căutare', args: 'ce_cauți; tabel; nr_rând; [aproximativ]', desc: 'Ca VLOOKUP, dar caută în primul rând.' },
  { name: 'INDEX', cat: 'Căutare', args: 'zonă; rând; [coloană]', desc: 'Valoarea de la rândul și coloana date dintr-o zonă.' },
  { name: 'MATCH', cat: 'Căutare', args: 'ce_cauți; zonă; [tip]', desc: 'Pe ce poziție e o valoare într-o zonă.' },
  { name: 'FILTER', cat: 'Căutare', args: 'zonă; condiție; [dacă_nimic]', desc: 'Doar rândurile care îndeplinesc condiția (rezultatul se varsă în celulele de dedesubt).' },
  { name: 'SORT', cat: 'Căutare', args: 'zonă; [coloană]; [ordine]', desc: 'Zona sortată (rezultatul se varsă în celulele de dedesubt).' },
  { name: 'UNIQUE', cat: 'Căutare', args: 'zonă', desc: 'Valorile fără repetări.' },
  { name: 'PMT', cat: 'Financiare', args: 'dobândă; nr_rate; valoare_credit', desc: 'Rata lunară a unui credit (dobânda anuală / 12).' },
  { name: 'FV', cat: 'Financiare', args: 'dobândă; nr_perioade; plată; [valoare_inițială]', desc: 'Cât strângi după un număr de depuneri.' },
  { name: 'PV', cat: 'Financiare', args: 'dobândă; nr_perioade; plată', desc: 'Valoarea de azi a unor plăți viitoare.' },
  { name: 'NPV', cat: 'Financiare', args: 'dobândă; flux1; [flux2]; …', desc: 'Valoarea actualizată netă a unei investiții.' },
  { name: 'IRR', cat: 'Financiare', args: 'fluxuri; [estimare]', desc: 'Rata internă de rentabilitate.' },
  { name: 'ISBLANK', cat: 'Informații', args: 'valoare', desc: 'ADEVĂRAT dacă celula e goală.' },
  { name: 'ISNUMBER', cat: 'Informații', args: 'valoare', desc: 'ADEVĂRAT dacă e număr.' },
  { name: 'ISERROR', cat: 'Informații', args: 'valoare', desc: 'ADEVĂRAT dacă e o eroare.' },
  { name: 'VALIDCNP', cat: 'Informații', args: 'cnp', desc: 'Verifică dacă un CNP e corect (cifra de control).' },
  { name: 'VALIDIBAN', cat: 'Informații', args: 'iban', desc: 'Verifică dacă un IBAN e corect.' },
  { name: 'VALIDCUI', cat: 'Informații', args: 'cui', desc: 'Verifică dacă un CUI (cod fiscal) e corect.' },
];

// Cu interfața în engleză, argumentele și explicația vin din fnhelp-en.ts (la fiecare citire, deci și după schimbarea limbii).
for (const h of FN_HELP) {
  const ro = { args: h.args, desc: h.desc };
  // Limba se citește din <html lang> (pusă de i18n.ts), ca fișierul să meargă și în testele fără pagină.
  const en = () => (typeof document !== 'undefined' && document.documentElement.lang === 'en' ? EN_FN[h.name] : undefined);
  Object.defineProperties(h, {
    args: { get: () => en()?.[0] ?? ro.args, enumerable: true },
    desc: { get: () => en()?.[1] ?? ro.desc, enumerable: true },
  });
}

/** Funcțiile din listă care se potrivesc cu textul căutat (în nume sau în explicație), cele care încep cu el primele. */
export function searchFns(all: string[], q: string, cat: FnCat | 'Toate'): { name: string; help?: FnHelp }[] {
  const byName = new Map(FN_HELP.map((h) => [h.name, h]));
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const nq = norm(q.trim());
  let list = cat === 'Toate' ? [...new Set([...FN_HELP.map((h) => h.name), ...all])].sort()
    : cat === 'Uzuale' ? FN_HELP.filter((h) => h.common).map((h) => h.name)
      : FN_HELP.filter((h) => h.cat === cat).map((h) => h.name);
  if (nq) {
    const starts = list.filter((n) => norm(n).startsWith(nq));
    const rest = list.filter((n) => !norm(n).startsWith(nq) && (norm(n).includes(nq) || norm(byName.get(n)?.desc ?? '').includes(nq)));
    list = [...starts, ...rest];
  }
  return list.map((name) => ({ name, help: byName.get(name) }));
}

/**
 * Numele românești ale funcțiilor, cum apar în listă (cu diacritice), și funcția lor. Se pot scrie și fără diacritice
 * (DACA = DACĂ); calculul și exportul .xlsx le traduc cu normName din formula.ts (testat în formula-hint.test.mjs).
 */
export const RO_FNS: [string, string][] = [
  ['SUMĂ', 'SUM'], ['MEDIE', 'AVERAGE'], ['DACĂ', 'IF'], ['ȘI', 'AND'], ['SAU', 'OR'], ['NU', 'NOT'],
  ['PRODUS', 'PRODUCT'], ['ROTUNJIRE', 'ROUND'], ['ABSOLUT', 'ABS'], ['RADICAL', 'SQRT'],
  ['SUMĂDACĂ', 'SUMIF'], ['CONTORDACĂ', 'COUNTIF'], ['MEDIEDACĂ', 'AVERAGEIF'], ['DACĂEROARE', 'IFERROR'],
  ['LUNGIME', 'LEN'], ['MAJUSCULE', 'UPPER'], ['MINUSCULE', 'LOWER'], ['CONCATENARE', 'CONCATENATE'], ['CONTOR', 'COUNT'],
  ['CĂUTAREV', 'VLOOKUP'], ['CĂUTAREH', 'HLOOKUP'], ['CĂUTAREX', 'XLOOKUP'], ['POTRIVIRE', 'MATCH'], ['ALEGE', 'CHOOSE'], ['IMAGINE', 'IMAGE'],
  ['AZI', 'TODAY'], ['DATA', 'DATE'], ['AN', 'YEAR'], ['LUNA', 'MONTH'], ['ZI', 'DAY'], ['ZIUASĂPTĂMÂNII', 'WEEKDAY'],
  ['DEPLASARE', 'OFFSET'], ['ACUM', 'NOW'], ['ORA', 'HOUR'], ['TIMP', 'TIME'], ['SECUNDA', 'SECOND'],
  ['CAR', 'CHAR'], ['COD', 'CODE'], ['ADRESA', 'ADDRESS'], ['CĂUTARE', 'LOOKUP'], ['PLATA', 'PMT'],
  ['ALEATOR', 'RAND'], ['ALEATORÎNTRE', 'RANDBETWEEN'], ['RÂND', 'ROW'], ['COLOANA', 'COLUMN'], ['RÂNDURI', 'ROWS'], ['COLOANE', 'COLUMNS'],
  ['ZILE', 'DAYS'], ['ZILE360', 'DAYS360'], ['MEDIANA', 'MEDIAN'], ['TRUNCHIERE', 'TRUNC'], ['SUBSTITUIRE', 'SUBSTITUTE'],
  ['VALOARE', 'VALUE'], ['ESTEEROARE', 'ISERROR'],
];

/** Ce arată lista de sub celulă cât scrii o formulă: funcțiile care încep cu cuvântul de la cursor și funcția în care ești. */
export interface FormulaHint {
  /**
   * Cuvântul de dinaintea cursorului (de la `start`) și funcțiile care încep cu el, cele uzuale primele.
   * La numele românești, `en` e funcția lor (MEDIE → AVERAGE), iar `help` e explicația ei.
   */
  word?: { text: string; start: number; list: { name: string; help?: FnHelp; en?: string }[] };
  /** Funcția în parantezele căreia e cursorul și al câtelea argument se scrie acum (de la 0). */
  call?: { name: string; arg: number; help?: FnHelp };
}

/** Fără diacritice, cu litere mari: „Dacă” → „DACA”. */
const plainUp = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
// RÂND (ROW) se scrie doar cu diacritice: RAND simplu e funcția englezească (număr la întâmplare).
const RO_TO_EN = new Map(RO_FNS.filter(([ro]) => ro !== 'RÂND').map(([ro, en]) => [plainUp(ro), en]));
/** Numele englezesc al unei funcții scrise în română (sau același nume, cu litere mari). */
export const fnEnglish = (name: string) => (name.toUpperCase() === 'RÂND' ? 'ROW' : RO_TO_EN.get(plainUp(name)) ?? plainUp(name));

/**
 * Enter primește sugestia doar dacă ce ai scris nu e deja ceva valid: o celulă (B12), o funcție întreagă (PI, MEDIE),
 * ADEVĂRAT / FALS sau un nume definit de tine. Altfel (=SU, =med) Enter pune funcția aleasă, ca Tab.
 */
export function enterPicks(word: string, all: string[], names: string[] = []): boolean {
  const w = plainUp(word);
  if (/^\$?[A-Z]{1,3}\$?\d+$/.test(w) || /^(TRUE|FALSE|ADEVARAT|FALS)$/.test(w)) return false;
  if (all.includes(fnEnglish(word)) || FN_HELP.some((h) => h.name === fnEnglish(word))) return false;
  return !names.some((n) => plainUp(n) === w);
}

const isWordChar = (ch: string) => /[\p{L}0-9_.]/u.test(ch);
const isDigit = (ch: string | undefined) => !!ch && ch >= '0' && ch <= '9';
// Virgula de la poziția i e între cifrele unui număr (nu după o celulă ca A1).
function decimalComma(t: string, i: number) {
  let j = i - 1;
  while (j > 0 && isDigit(t[j])) j--;
  return j < i - 1 && isDigit(t[i + 1]) && !/[A-Za-z$_.]/.test(t[j]);
}

/** Sugestiile pentru formula `text`, cu cursorul la `caret`; null dacă nu e formulă sau nu e nimic de arătat. */
export function formulaHint(text: string, caret: number, all: string[], max = 8): FormulaHint | null {
  if (!text.startsWith('=')) return null;
  const before = text.slice(0, Math.max(1, Math.min(caret, text.length)));
  const stack: { name: string; arg: number }[] = [];
  let inStr = false, inQuote = false;
  for (let i = 1; i < before.length; i++) {
    const ch = before[i];
    if (inStr) { if (ch === '"') inStr = false; continue; }
    if (inQuote) { if (ch === "'") inQuote = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === "'") inQuote = true;
    else if (ch === '(') {
      let j = i;
      while (j > 1 && isWordChar(before[j - 1])) j--;
      stack.push({ name: before.slice(j, i).toUpperCase(), arg: 0 });
    } else if (ch === ')') stack.pop();
    // Argumentele se despart cu „;”; virgula doar când nu e virgula zecimală a unui număr (1,5; dar A1,2 sunt două argumente).
    else if (stack.length && (ch === ';' || (ch === ',' && !decimalComma(before, i)))) stack[stack.length - 1].arg++;
  }
  if (inStr || inQuote) return null;
  const out: FormulaHint = {};
  const top = [...stack].reverse().find((s) => s.name);
  const byName = new Map(FN_HELP.map((h) => [h.name, h]));
  if (top) out.call = { name: top.name, arg: top.arg, help: byName.get(fnEnglish(top.name)) };
  const m = /[\p{L}_][\p{L}0-9_.]*$/u.exec(before);
  const prev = m ? before[m.index - 1] : '';
  // Cuvântul trebuie să înceapă după un semn (=, (, ;, +, spațiu…), nu după o foaie (Foaia1!) sau în mijlocul unei referințe.
  if (m && m.index >= 1 && !/[\p{L}0-9_.:!$'"]/u.test(prev) && text[before.length] !== '(') {
    const w = plainUp(m[0]);
    const list: { name: string; help?: FnHelp; en?: string }[] = [...new Set([...FN_HELP.map((h) => h.name), ...all])]
      .filter((n) => n.startsWith(w) && n !== w).map((name) => ({ name, help: byName.get(name) }));
    // Numele românești (MEDIE, DACĂ…), cu explicația funcției lor; se găsesc și scrise fără diacritice (=daca).
    for (const [ro, en] of RO_FNS) {
      const p = plainUp(ro);
      if (p.startsWith(w) && p !== w && !list.some((x) => x.name === ro)) list.push({ name: ro, help: byName.get(en), en });
    }
    const rank = (x: { name: string; en?: string }) => { const h = byName.get(x.en ?? x.name); return h?.common ? 0 : h ? 1 : 2; };
    list.sort((a, b) => rank(a) - rank(b) || a.name.length - b.name.length || a.name.localeCompare(b.name));
    if (list.length) out.word = { text: m[0], start: m.index, list: list.slice(0, max) };
  }
  return out.word || out.call ? out : null;
}

/** Argumentele funcției despărțite, ca cel care se scrie acum să poată fi scris aldin. */
export function hintArgs(help: FnHelp | undefined, arg: number): { parts: string[]; on: number } {
  const parts = (help?.args ?? '…').split(';').map((p) => p.trim()).filter(Boolean);
  // La funcțiile cu argumente repetate („număr1; [număr2]; …”), argumentele de după cad pe cel repetat.
  const rep = parts[parts.length - 1] === '…' ? parts.length - 2 : -1;
  const on = arg < parts.length && parts[arg] !== '…' ? arg : rep >= 0 ? rep : -1;
  return { parts, on };
}
