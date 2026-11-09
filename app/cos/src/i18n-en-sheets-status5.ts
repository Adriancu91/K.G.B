// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Mesajele de stare din Sheets, partea 5: sortarea, validarea datelor (regula spusă în cuvinte) și Rezolvitorul.
// Textele scrise de utilizator (mesajul de eroare al validării, valorile) rămân cum sunt.
import type { Pattern } from './i18n';

const re = (s: string) => new RegExp('^' + s + '$', 's');
const alt = (o: Record<string, string>) => '(' + Object.keys(o).sort((a, b) => b.length - a.length).join('|') + ')';

// ---------- Regula de validare, ca în describeValRule (sheets/lists.ts) ----------
const WHAT: Record<string, string> = { 'un număr întreg': 'a whole number', 'un număr': 'a number', 'o dată': 'a date', 'un text': 'a text' };
const OPS: Record<string, string> = {
  'între': 'between', 'cu lungimea între': 'with a length between', 'cu lungimea în afara intervalului': 'with a length outside', 'în afara intervalului': 'outside',
  'egală cu': 'equal to', 'egal cu': 'equal to', 'de exact': 'of exactly', 'cu lungimea diferită de': 'with a length other than', 'diferită de': 'other than', 'diferit de': 'other than',
  'după': 'after', 'mai lung de': 'longer than', 'mai mare decât': 'greater than', 'înainte de': 'before', 'mai scurt de': 'shorter than', 'mai mic decât': 'less than',
  'cel mai devreme': 'on or after', 'de cel puțin': 'of at least', 'cel puțin': 'at least', 'cel mai târziu': 'on or before', 'de cel mult': 'of at most', 'cel mult': 'at most',
};
const RULE = re(alt(WHAT) + ' ' + alt(OPS) + ' (.+?)(?: și (.+?))?( caractere| caracter| de caractere)?');
const CUSTOM = re('o valoare pentru care formula (=.+) dă ADEVĂRAT');
/** „un număr întreg între 1 și 10” → „a whole number between 1 and 10”; altfel null. */
export function valRuleEn(s: string): string | null {
  const c = CUSTOM.exec(s);
  if (c) return `a value for which the formula ${c[1]} gives TRUE`;
  const m = RULE.exec(s);
  if (!m) return null;
  const unit = m[5] ? (m[5] === ' caracter' ? ' character' : ' characters') : '';
  return `${WHAT[m[1]]} ${OPS[m[2]]} ${m[3]}${m[4] !== undefined ? ` and ${m[4]}` : ''}${unit}`;
}

// ---------- Sortarea pe mai multe niveluri: „B ↑, apoi C (fundal #ff0000 sus)” ----------
const level = (x: string) => {
  const m = /^([A-Z]+) [(](fundal|text) (.+) (sus|jos)[)]$/.exec(x);
  if (!m) return x;
  return `${m[1]} (${m[2] === 'fundal' ? 'fill' : 'font'} ${m[3] === 'fără culoare' ? 'no color' : m[3]} ${m[4] === 'sus' ? 'on top' : 'at the bottom'})`;
};

// ---------- Rezolvitorul ----------
const SOLVER: Record<string, string> = {
  'Am găsit o soluție care dă valoarea cerută și respectă toate condițiile.': 'I found a solution that gives the requested value and meets all the conditions.',
  'Am găsit soluția cea mai bună care respectă toate condițiile.': 'I found the best solution that meets all the conditions.',
  'Am găsit o soluție care respectă toate condițiile (pentru formule neliniare poate exista una și mai bună, pornind din alte valori).': 'I found a solution that meets all the conditions (for nonlinear formulas there may be an even better one, starting from other values).',
  'Am găsit o soluție aproape bună: condițiile sunt respectate doar aproximativ. Verifică valorile.': 'I found an almost good solution: the conditions are met only approximately. Check the values.',
  'Nu există nicio soluție care să respecte toate condițiile. Verifică condițiile (poate una se bate cap în cap cu alta).': 'There is no solution that meets all the conditions. Check the conditions (maybe one contradicts another).',
  'Obiectivul poate crește la nesfârșit: lipsește o condiție care să-l limiteze.': 'The objective can grow without end: a condition that limits it is missing.',
  'Obiectivul poate crește la nesfârșit în jos: lipsește o condiție care să-l limiteze.': 'The objective can decrease without end: a condition that limits it is missing.',
  'Formulele dau eroare pentru valorile de pornire. Corectează-le sau pune alte valori în celulele schimbate.': 'The formulas give an error for the starting values. Fix them or put other values in the changing cells.',
};

export const SHEETS_STATUS5_PATTERNS: Pattern[] = [
  // Ajutorul funcției alese din ƒx (argumentele și explicația vin deja în engleză din fnhelp-en.ts; aici doar coada).
  [re('([A-Z][A-Z0-9.]*)[(]([^)]*)[)](?: · (.+))? · Separă argumentele cu „;”, apoi Enter[.]'),
    (m) => `${m[1]}(${m[2]})${m[3] ? ' · ' + m[3] : ''} · Separate the arguments with “;”, then Enter.`],
  [re('Sortat ([A-Z]+[0-9]+:[A-Z]+[0-9]+) după coloana ([A-Z]+)( [(]descrescător[)])?(; rândul de sus a rămas cap de tabel)?'),
    (m) => `Sorted ${m[1]} by column ${m[2]}${m[3] ? ' (descending)' : ''}${m[4] ? '; the top row stayed as the header' : ''}`],
  [re('Sortat ([A-Z]+[0-9]+:[A-Z]+[0-9]+) după (.+)'), (m) => `Sorted ${m[1]} by ${m[2].split(', apoi ').map(level).join(', then ')}`],
  [re('Pe (.+) se primesc acum doar coduri (CNP|CUI|IBAN) corecte'), 'Now only valid $R2 codes are accepted in $R1'],
  [re('Pe (.+) se primește acum doar (.+)'), (m) => { const r = valRuleEn(m[2]); return r ? `Now only ${r} is accepted in ${m[1]}` : m[0]; }],
  [re('(.+)” nu se primește[.] Aici se primește doar (.+)[.]'), (m) => { const r = valRuleEn(m[2]); return `${m[1]}” is not accepted. ${r ? `Only ${r} is accepted here.` : m[2]}`; }],
  [re('(.+)” nu se primește[.] (.+)'), '$R1” is not accepted. $R2'],
  [re('(.+)” nu e un (CNP|CUI|IBAN) corect [(]cifra de control nu se potrivește[)][.] Verifică cifrele și scrie din nou[.]'),
    '$R1” is not a valid $R2 (the check digit does not match). Check the digits and type again.'],
  [re('Rezolvitor: (.+?)(?: Raportul e în foaia „(.+)”[.])?'),
    (m) => (SOLVER[m[1]] ? `Solver: ${SOLVER[m[1]]}${m[2] ? ` The report is in sheet “${m[2]}”.` : ''}` : m[0])],
];
