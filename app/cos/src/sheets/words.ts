// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Numere în litere, în română („o mie două sute treizeci și patru de lei și cincizeci de bani”),
// pentru chitanțe, facturi și contracte. Regula lui „de”: se pune când ultimele două cifre sunt 00 sau 20–99.

type Gender = 'm' | 'f' | 'n';

const UNITS_M = ['', 'unu', 'doi', 'trei', 'patru', 'cinci', 'șase', 'șapte', 'opt', 'nouă'];
const TEENS = ['zece', 'unsprezece', 'doisprezece', 'treisprezece', 'paisprezece', 'cincisprezece', 'șaisprezece',
  'șaptesprezece', 'optsprezece', 'nouăsprezece'];
const TENS = ['', '', 'douăzeci', 'treizeci', 'patruzeci', 'cincizeci', 'șaizeci', 'șaptezeci', 'optzeci', 'nouăzeci'];

function unit(u: number, g: Gender): string {
  if (u === 1) return g === 'f' ? 'una' : 'unu';
  if (u === 2) return g === 'm' ? 'doi' : 'două';
  return UNITS_M[u];
}

/** 0–999 în litere (fără „zero”). */
function group(n: number, g: Gender): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (h === 1) parts.push('o sută');
  else if (h === 2) parts.push('două sute');
  else if (h > 2) parts.push(`${UNITS_M[h]} sute`);
  if (r >= 20) {
    const u = r % 10;
    parts.push(TENS[Math.floor(r / 10)] + (u ? ` și ${unit(u, g)}` : ''));
  } else if (r >= 10) {
    parts.push(r === 12 && g !== 'm' ? 'douăsprezece' : TEENS[r - 10]);
  } else if (r > 0) {
    parts.push(unit(r, g));
  }
  return parts.join(' ');
}

const needsDe = (n: number) => n >= 20 && (n % 100 === 0 || n % 100 >= 20);

/** Un multiplu (mii, milioane, miliarde): „o mie”, „două mii”, „douăzeci de mii”. */
function scale(n: number, one: string, many: string, g: Gender): string {
  if (n === 1) return one;
  return `${group(n, g)} ${needsDe(n) ? 'de ' : ''}${many}`;
}

/** Numărul întreg în litere; `g` = genul lucrului numărat (lei: masculin). */
export function intWords(n: number, g: Gender = 'm'): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return 'zero';
  const parts: string[] = [];
  const bil = Math.floor(n / 1e9);
  const mil = Math.floor((n % 1e9) / 1e6);
  const th = Math.floor((n % 1e6) / 1e3);
  const rest = n % 1000;
  if (bil) parts.push(scale(bil, 'un miliard', 'miliarde', 'n'));
  if (mil) parts.push(scale(mil, 'un milion', 'milioane', 'n'));
  if (th) parts.push(scale(th, 'o mie', 'mii', 'f'));
  if (rest) parts.push(group(rest, g));
  return parts.join(' ');
}

/** Câte lucruri: „un leu”, „doi lei”, „douăzeci de lei”, „o sută unu lei”; la feminin „o liră”, „două lire”. */
function counted(n: number, one: string, many: string, g: Gender = 'm'): string {
  if (n === 1) return `${g === 'f' ? 'o' : 'un'} ${one}`;
  return `${intWords(n, g)} ${needsDe(n) ? 'de ' : ''}${many}`;
}

/** Monedele scrise în litere: unitatea (o / multe, genul) și subdiviziunea (o / multe). */
const CURRENCIES: Record<string, [string, string, Gender, string, string]> = {
  RON: ['leu', 'lei', 'm', 'ban', 'bani'],
  EUR: ['euro', 'euro', 'm', 'eurocent', 'eurocenți'],
  USD: ['dolar', 'dolari', 'm', 'cent', 'cenți'],
  GBP: ['liră sterlină', 'lire sterline', 'f', 'penny', 'pence'],
  CHF: ['franc elvețian', 'franci elvețieni', 'm', 'centim', 'centimi'],
  MDL: ['leu moldovenesc', 'lei moldovenești', 'm', 'ban', 'bani'],
  HUF: ['forint', 'forinți', 'm', 'filler', 'filleri'],
  PLN: ['zlot', 'zloți', 'm', 'grosz', 'groszy'],
};

/** Suma în lei și bani (sau în altă monedă: EUR, USD, GBP, CHF…), în litere. Peste 999 de miliarde sau monedă necunoscută: null. */
export function amountWords(x: number, currency = 'RON'): string | null {
  const cur = CURRENCIES[currency.trim().toUpperCase() || 'RON'];
  if (!cur || !Number.isFinite(x) || Math.abs(x) >= 1e12) return null;
  const [one, many, g, subOne, subMany] = cur;
  const cents = Math.round(Math.abs(x) * 100);
  const units = Math.floor(cents / 100);
  const sub = cents % 100;
  const minus = x < 0 && cents > 0 ? 'minus ' : '';
  const unitText = units === 0 && sub > 0 ? '' : counted(units, one, many, g);
  const subText = sub ? counted(sub, subOne, subMany) : '';
  return minus + [unitText, subText].filter(Boolean).join(' și ');
}
