// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Mesajele de stare din Sheets, partea 3: analiza datelor (📈 Corelație, Regresie, Histogramă, Testul t, Prognoză…).
// Pictograma din față (📈, 📉, 📊) e păstrată de traducător; numele coloanelor, foilor și zonele rămân cum sunt.
import type { Pattern } from './i18n';

const LABELS: Record<string, string> = {
  'Corelație': 'Correlation', 'Covarianță': 'Covariance', 'Regresie': 'Regression', 'Histogramă': 'Histogram',
  'ANOVA cu doi factori': 'Two-Factor ANOVA', 'ANOVA': 'ANOVA', 'Rang și percentilă': 'Rank and Percentile', 'Testul F': 'F-Test',
  'Testul t pe perechi': 'Paired t-Test', 'Testul t': 't-Test', 'Testul z': 'z-Test', 'Foaie de prognoză': 'Forecast Sheet',
  'Eșantion periodic': 'Periodic Sample', 'Eșantion aleator': 'Random Sample', 'Media mobilă': 'Moving Average', 'Netezire exponențială': 'Exponential Smoothing',
};
// Cele mai lungi întâi, ca „Testul t pe perechi” să nu fie prins ca „Testul t”.
const L = '(' + Object.keys(LABELS).sort((a, b) => b.length - a.length).join('|') + ')';
const Z = '[(]([A-Z]+[0-9]+:[A-Z]+[0-9]+)[)]';
const DROP = '(?:; (un rând cu celule goale sau text a fost sărit|([0-9]+) rânduri cu celule goale sau text au fost sărite))?';
const FIRST = '(; s-a folosit doar prima coloană cu numere)?';
const re = (s: string) => new RegExp('^' + s + '$', 's');
const lb = (x: string) => LABELS[x] ?? x;
const drop = (m: RegExpExecArray, i: number) => (m[i] ? (m[i + 1] ? `; ${m[i + 1]} rows with empty cells or text were skipped` : '; one row with empty cells or text was skipped') : '');
const first = (x: string | undefined) => (x ? '; only the first column with numbers was used' : '');
const dot = (x: string) => x.replace(',', '.');

/** Mesajele fără numere de după „Analiză: ”. */
const TAILS: Record<string, string> = {
  'selectează întâi coloanele cu numere (cu capul de tabel, dacă are)': 'first select the columns with numbers (with the header, if it has one)',
  'zona aleasă nu are numere': 'the chosen range has no numbers',
  'alege două coloane, datele (sau numerele perioadelor) și valorile, cu cel puțin 3 rânduri': 'choose two columns, the dates (or the period numbers) and the values, with at least 3 rows',
  'datele din prima coloană trebuie să fie la pași egali (în fiecare zi, săptămână, lună…), fără să se repete': 'the dates in the first column must be evenly spaced (every day, week, month…), without repeating',
  'alege două coloane cu numere, cu măcar două valori fiecare (se compară primele două)': 'choose two columns with numbers, with at least two values each (the first two are compared)',
  'alege o coloană cu cel puțin două numere': 'choose a column with at least two numbers',
  'alege un tabel cu cel puțin două rânduri și două coloane de numere (etichetele rândurilor în prima coloană)': 'choose a table with at least two rows and two columns of numbers (the row labels in the first column)',
  'alege două coloane cu numere, cu măcar două rânduri completate în amândouă': 'choose two columns with numbers, with at least two rows filled in both',
  'alege cel puțin două coloane cu numere, cu măcar două valori fiecare': 'choose at least two columns with numbers, with at least two values each',
  'alege cel puțin două coloane cu numere, cu măcar două valori fiecare (se compară primele două)': 'choose at least two columns with numbers, with at least two values each (the first two are compared)',
  'alege cel puțin două coloane cu numere': 'choose at least two columns with numbers',
  'alege cel puțin două coloane cu numere (ultima e rezultatul Y, celelalte sunt X)': 'choose at least two columns with numbers (the last one is the result Y, the others are X)',
  'e nevoie de cel puțin 3 rânduri cu numere în toate coloanele': 'at least 3 rows with numbers in all columns are needed',
  'nu se poate calcula (prea puține rânduri față de coloane, sau o coloană X se poate scrie din celelalte)': 'cannot be calculated (too few rows for the columns, or an X column can be written from the others)',
};

export const SHEETS_STATUS3_PATTERNS: Pattern[] = [
  [re('Statistici descriptive pentru (o coloană|([0-9]+) coloane) ' + Z + ' în foaia „(.+)”'),
    (m) => `Descriptive Statistics for ${m[2] ? m[2] + ' columns' : 'one column'} (${m[3]}) in sheet “${m[4]}”`],
  [re(L + ': alege cel mult ([0-9]+) de coloane'), (m) => `${lb(m[1])}: choose at most ${m[2]} columns`],
  [re(L + ': alege o coloană cu cel puțin ([0-9]+) numere'), (m) => `${lb(m[1])}: choose a column with at least ${m[2]} numbers`],
  [re(L + ': scrie un număr întreg între 1 și ([0-9]+)'), (m) => `${lb(m[1])}: write a whole number between 1 and ${m[2]}`],
  [re(L + ' pentru „(.+)” [(]([0-9]+) valori, ([0-9]+) clase[)] în foaia „(.+)”' + FIRST),
    (m) => `${lb(m[1])} for “${m[2]}” (${m[3]} values, ${m[4]} bins) in sheet “${m[5]}”${first(m[6])}`],
  [re(L + ' pentru „(.+)” [(]([0-9]+) valori, ([A-Z]+[0-9]+:[A-Z]+[0-9]+)[)], în foaia „(.+)”' + FIRST),
    (m) => `${lb(m[1])} for “${m[2]}” (${m[3]} values, ${m[4]}), in sheet “${m[5]}”${first(m[6])}`],
  [re(L + ': ([0-9]+) (perioadă|perioade) după ultima valoare din „(.+)”, cu grafic, în foaia „(.+)”' + DROP),
    (m) => `${lb(m[1])}: ${m[2]} ${m[2] === '1' ? 'period' : 'periods'} after the last value of “${m[4]}”, with a chart, in sheet “${m[5]}”${drop(m, 6)}`],
  [re(L + ' din „(.+)”: ([0-9]+) valori, în foaia „(.+)”' + FIRST),
    (m) => `${lb(m[1])} of “${m[2]}”: ${m[3]} values, in sheet “${m[4]}”${first(m[5])}`],
  [re(L + ': ([0-9]+) grupe ' + Z + ', în foaia „(.+)”'), (m) => `${lb(m[1])}: ${m[2]} groups (${m[3]}), in sheet “${m[4]}”`],
  [re(L + ': (.+) și (.+), ([0-9]+) perechi ' + Z + ', în foaia „(.+)”' + DROP),
    (m) => `${lb(m[1])}: ${m[2]} and ${m[3]}, ${m[4]} pairs (${m[5]}), in sheet “${m[6]}”${drop(m, 7)}`],
  [re(L + ': (.+) după (.+): R² = ([0-9.,]+), ([0-9]+) rânduri ' + Z + ', în foaia „(.+)”' + DROP),
    (m) => `${lb(m[1])}: ${m[2]} by ${m[3]}: R² = ${dot(m[4])}, ${m[5]} rows (${m[6]}), in sheet “${m[7]}”${drop(m, 8)}`],
  [re(L + ': (.+) și (.+) ' + Z + ', în foaia „(.+)”'), (m) => `${lb(m[1])}: ${m[2]} and ${m[3]} (${m[4]}), in sheet “${m[5]}”`],
  [re(L + ' între ([0-9]+) coloane, ([0-9]+) rânduri ' + Z + ', în foaia „(.+)”' + DROP),
    (m) => `${lb(m[1])} between ${m[2]} columns, ${m[3]} rows (${m[4]}), in sheet “${m[5]}”${drop(m, 6)}`],
  [re(L + ' ' + Z + ', în foaia „(.+)”' + DROP), (m) => `${lb(m[1])} (${m[2]}), in sheet “${m[3]}”${drop(m, 4)}`],
  [re(L + ': (.+)'), (m) => (TAILS[m[2]] ? `${lb(m[1])}: ${TAILS[m[2]]}` : m[0])],
];
