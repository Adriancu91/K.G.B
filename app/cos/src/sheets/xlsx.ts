// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
import { docProps, type DocProps, customPropsXml, labelFromCustom, CUSTOM_PROPS_TYPE, CUSTOM_PROPS_REL } from '../docs/format';
import { cleanScenarios, type SheetScenario } from './scenario';
import { cleanDataTables, type SheetDataTable } from './datatable';
import { isThreadStub, legacyThreadText, personsFromXml, personsXml, threadedXml, threadsFromXml, topId, type ThreadCell } from './comments';
import { solverFromNames, solverNames, type SheetSolver } from './solver';
import { cleanSparks, type SheetSpark, type SparkKind } from './sparkline';
// Import și export .xlsx (Excel), scrise de noi peste JSZip (MIT), fără o bibliotecă grea de Excel.
// Se păstrează: valorile, formulele (traduse între română și Excel), aldin/cursiv/subliniat, culorile,
// alinierea, formatele (număr, lei, procent, dată), lățimea coloanelor și înghețarea rândului 1.
import JSZip from 'jszip';
import { bookLockFrom, bookLockXml, sheetPwAttrs, sheetPwFrom, type SheetPw } from './sheetPassword';
import { isRepaired, officeSigners, openOfficeZip } from '../officeFile';
import { CellStyle, cellId, cleanLink, COL_W, colName, COLS, isNumber, MAX_COL_W, MAX_NOTE, MAX_ROW_H, MIN_COL_W, MIN_ROW_H, ROWS, Sheet, lastUsedRow, lastUsedCol, STYLE_COLS, MAX_SZ, MIN_SZ, MAX_IND, cleanFreeze, MAX_FREEZE_ROWS, MAX_FREEZE_COLS, CELL_STYLE_KEYS, cleanCellStyles, type UserCellStyle, FilterColor, FilterCond, FilterOp, SheetFilter } from './format';
import { cellText, colIndex, columnValues, EMPTY, filterEnd, hiddenRows } from './filter';
import { DefinedName, formatNumber, functionNames, keepCachedResults, lambdaParams, nameKey, normName, PivotDef, Result, sheetRef, shiftFormula, SPILL_RE } from './formula';
import { ExcelTable, expandStructuredRefs } from './structref';
import { extFromExcel, externalLinkXml, extToExcel, linkTarget, MAX_LINKS } from './extLinks';
import type { ExtBook } from './formula';
import { cleanTableStyles, isCustomTheme, registerTableStyles, SheetTable, TABLE_THEMES, tableColumns, tableLook, tableXml, themeFromStyle, validTableName, type CustomTableLook, type CustomTableStyle } from './table';
import { keepText, type NumFmt } from './numfmt';
import type { LineStyle } from './border';
import { lighten } from './chartSvg';
import { cleanTheme, indexedPalette, resolveXmlColors, themeFontsFromXml, themeFontsOf, themeName, themePalette, themeXml, type BookTheme } from './themeColors';
import { chartDataOf, canHideSeries, canSwitchRC } from './chart';
import { ChartData, ChartType, isCombo, isStat, statData, parseRangeText, SheetChart, paletteOf, PALETTES, WF_DOWN, WF_UP, cleanAt, cleanAxis, isHex, chartFontOk, type ChartAt } from './chart';
import { fromBase64, isMetafileExt, metafileToUrl } from '../metafile';
import { MAX_PICS, picAnchorsXml, picMime, picPart, picPlace, type SheetPic } from './pics';
import { shapeAnchorXml, shapeFromSp, shapeSvgUrl } from './shapeXml';
import { renderShapeBox } from './shapeBox';
import { shapeSvg } from '../docs/shapes';
import { cleanExtra, MAX_LISTS, parseValues, RuleOp, RuleType, SheetList } from './lists';
import { BAR_COLORS, COND_LOOKS, CondLook, CondOp, ICON_SETS, MAX_RULES, SCALES, SheetRule, suiteOnly, topCount } from './cond';
import { cleanMerges } from './merge';
import { maxLevel } from './group';
import { fromExcelHF, MARGINS, MAX_HEAD_ROWS, MAX_LEFT_COLS, MIN_PRINT_SCALE, MAX_PRINT_SCALE, type PrintMargin, type PrintPaper, SheetPrint, toExcelHF } from './print';

type Cells = Record<string, string>;
type Styles = Record<string, CellStyle>;

// ---------- XML (citire simplă: elemente, atribute, text) ----------

interface XNode {
  name: string;
  attrs: Record<string, string>;
  kids: XNode[];
  text: string;
}

function unescapeXml(s: string): string {
  if (!s.includes('&')) return s;
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e.toLowerCase()] ?? '';
  });
}

/** Textul unui fișier XML → arbore. Prefixele de spațiu de nume („x:c”) se scot. */
export function parseXml(src: string): XNode {
  const root: XNode = { name: '#root', attrs: {}, kids: [], text: '' };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<(\/?)([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const top = stack[stack.length - 1];
    if (m[1] !== undefined) top.text += m[1];
    else if (m[6] !== undefined) top.text += unescapeXml(m[6]);
    else if (m[3]) {
      const name = m[3].includes(':') ? m[3].replace(/^.*:/, '') : m[3];
      if (m[2]) {
        if (stack.length > 1) stack.pop();
        continue;
      }
      const attrs: Record<string, string> = {};
      for (const a of m[4].matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
        attrs[a[1].includes(':') ? a[1].replace(/^.*:/, '') : a[1]] = unescapeXml(a[2] ?? a[3] ?? '');
      }
      const node: XNode = { name, attrs, kids: [], text: '' };
      top.kids.push(node);
      if (!m[5]) stack.push(node);
    }
  }
  return root;
}

const kid = (n: XNode | undefined, name: string) => n?.kids.find((k) => k.name === name);
const kids = (n: XNode | undefined, name: string) => n?.kids.filter((k) => k.name === name) ?? [];

function find(n: XNode, name: string): XNode | undefined {
  for (const k of n.kids) {
    if (k.name === name) return k;
    const f = find(k, name);
    if (f) return f;
  }
  return undefined;
}

function escapeXml(s: string): string {
  return s
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------- Formule: română ↔ Excel ----------

// Numele românești (SUMA, DACĂ, RÂND…) devin cele englezești cu aceeași listă ca la calcul (normName din formula.ts).


/** Funcțiile apărute după Excel 2007: în fișier se scriu cu „_xlfn.” în față. */
// Funcțiile apărute după Excel 2007 se scriu în fișier cu prefixul „_xlfn.” (iar SORT și FILTER cu „_xlfn._xlws.”).
const XLFN = new Set(['XLOOKUP', 'IFS', 'IFNA', 'TEXTJOIN', 'CONCAT', 'XMATCH', 'SEQUENCE', 'UNIQUE', 'SORTBY', 'XOR', 'DAYS',
  'ISOWEEKNUM', 'NUMBERVALUE', 'BASE', 'DECIMAL', 'ARABIC', 'COT', 'CSC', 'SEC', 'ACOT', 'COTH', 'CSCH', 'SECH', 'ACOTH',
  'BITAND', 'BITOR', 'BITXOR', 'BITLSHIFT', 'BITRSHIFT', 'PERMUTATIONA', 'COMBINA', 'CEILING.MATH', 'FLOOR.MATH',
  'CEILING.PRECISE', 'FLOOR.PRECISE', 'NETWORKDAYS.INTL', 'WORKDAY.INTL', 'FORECAST.LINEAR', 'PHI', 'GAUSS', 'UNICHAR', 'UNICODE',
  'NORM.DIST', 'NORM.S.DIST', 'NORM.INV', 'NORM.S.INV', 'BINOM.DIST', 'POISSON.DIST', 'EXPON.DIST',
  'STDEV.S', 'STDEV.P', 'VAR.S', 'VAR.P', 'IFS', 'SWITCH', 'MAXIFS', 'MINIFS',
  'GAMMA', 'GAMMALN.PRECISE', 'GAMMA.DIST', 'GAMMA.INV', 'CHISQ.DIST', 'CHISQ.DIST.RT', 'CHISQ.INV', 'CHISQ.INV.RT', 'CHISQ.TEST',
  'BETA.DIST', 'BETA.INV', 'F.DIST', 'F.DIST.RT', 'F.INV', 'F.INV.RT', 'F.TEST', 'T.DIST', 'T.DIST.2T', 'T.DIST.RT', 'T.INV',
  'T.INV.2T', 'T.TEST', 'HYPGEOM.DIST', 'NEGBINOM.DIST', 'WEIBULL.DIST', 'LOGNORM.DIST', 'LOGNORM.INV', 'CONFIDENCE.NORM',
  'CONFIDENCE.T', 'Z.TEST', 'PERCENTILE.INC', 'PERCENTILE.EXC', 'QUARTILE.INC', 'QUARTILE.EXC', 'PERCENTRANK.INC',
  'PERCENTRANK.EXC', 'RANK.EQ', 'RANK.AVG', 'SKEW.P', 'COVARIANCE.P', 'COVARIANCE.S', 'MODE.SNGL', 'MODE.MULT', 'BINOM.INV',
  'BINOM.DIST.RANGE', 'PDURATION', 'RRI',
  // Excel 2010–365.
  'AGGREGATE', 'RANDARRAY', 'ERF.PRECISE', 'ERFC.PRECISE', 'ISFORMULA', 'FORMULATEXT', 'SHEET', 'SHEETS', 'ISO.CEILING',
  'LET', 'LAMBDA', 'MAP', 'REDUCE', 'SCAN', 'BYROW', 'BYCOL', 'MAKEARRAY', 'ISOMITTED', 'TEXTBEFORE', 'TEXTAFTER', 'TEXTSPLIT',
  'TAKE', 'DROP', 'CHOOSECOLS', 'CHOOSEROWS', 'VSTACK', 'HSTACK', 'TOCOL', 'TOROW', 'EXPAND', 'WRAPROWS', 'WRAPCOLS',
  'REGEXTEST', 'REGEXEXTRACT', 'REGEXREPLACE', 'PERCENTOF', 'VALUETOTEXT', 'ARRAYTOTEXT', 'IMSINH', 'IMCOSH', 'IMTAN', 'IMCOT',
  'IMSEC', 'IMCSC', 'IMSECH', 'IMCSCH', 'FORECAST.ETS', 'FORECAST.ETS.CONFINT', 'FORECAST.ETS.SEASONALITY', 'FORECAST.ETS.STAT',
  'GROUPBY', 'PIVOTBY', 'TRIMRANGE', 'ENCODEURL', 'FILTERXML', 'WEBSERVICE', 'IMAGE', 'DETECTLANGUAGE']);
const XLWS = new Set(['SORT', 'FILTER']);

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

/**
 * Formula din Suite → formula Excel (fără „=”): nume de funcții în engleză, iar dacă formula
 * folosește „;”, separatorul devine „,” și virgula zecimală devine punct (=ROTUNJIRE(2,5;0) → ROUND(2.5,0)).
 */
let FN_NAMES_CACHE: Set<string> | null = null;
const FN_NAMES = { has: (n: string) => (FN_NAMES_CACHE ??= new Set(functionNames())).has(n) };

export function toExcelFormula(f: string): string {
  const src = f.replace(/^=/, '');
  const semi = src.includes(';');
  // Parametrii din LET / LAMBDA se scriu în fișier cu „_xlpm.” în față.
  const params = lambdaParams(src);
  const lambdaArgs = /(?:GROUPBY|PIVOTBY|MAP|REDUCE|SCAN|BYROW|BYCOL|MAKEARRAY)\s*\(/i.test(src);
  let out = '';
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"') {
      const end = src.indexOf('"', i + 1);
      let j = end < 0 ? src.length : end + 1;
      while (src[j] === '"') { const e2 = src.indexOf('"', j + 1); j = e2 < 0 ? src.length : e2 + 1; }
      out += src.slice(i, j);
      i = j;
      continue;
    }
    // Numele de foi rămân neschimbate; Excel vrea între apostrofuri numele cu diacritice sau spații.
    if (ch === "'") {
      let j = i + 1;
      while (j < src.length && (src[j] !== "'" || src[j + 1] === "'")) j += src[j] === "'" ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    const id = /^[\p{L}_][\p{L}\d_.]*/u.exec(src.slice(i));
    if (id && src[i + id[0].length] === '!') {
      out += /^[A-Za-z_][A-Za-z0-9_.]*$/.test(id[0]) && !/^[A-Z]{1,3}\d+$/i.test(id[0]) ? id[0] : `'${id[0]}'`;
      i += id[0].length;
      continue;
    }
    if (id) {
      const up = plain(id[0]);
      const isFn = /^\s*\(/.test(src.slice(i + id[0].length));
      const name = isFn || up === 'ADEVARAT' || up === 'FALS' || up === 'TRUE' || up === 'FALSE' ? normName(id[0]) : id[0];
      // Numele unei funcții dat ca argument (GROUPBY(…; SUM)) se scrie „_xleta.SUM”.
      const eta = lambdaArgs && !isFn && !params.has(nameKey(name)) && /[,;(]$/.test(out.trimEnd()) && /^\s*[,;)]/.test(src.slice(i + id[0].length)) && FN_NAMES.has(normName(id[0]));
      out += eta ? '_xleta.' + normName(id[0]) : isFn && XLWS.has(name) ? '_xlfn._xlws.' + name : isFn && XLFN.has(name) ? '_xlfn.' + name : !isFn && params.has(nameKey(name)) ? '_xlpm.' + name : name;
      i += id[0].length;
      continue;
    }
    const num = /^(\d+(?:[.,]\d+)?|[.,]\d+)/.exec(src.slice(i));
    if (num) {
      out += semi ? num[0].replace(',', '.') : num[0];
      i += num[0].length;
      continue;
    }
    // „~” (unirea de zone din LibreOffice) e „,” în Excel: AREAS((A1:B3~F2)) → AREAS((A1:B3,F2)).
    out += semi && ch === ';' ? ',' : ch === '|' ? ';' : ch === '\\' || ch === '~' ? ',' : ch;
    i++;
  }
  return out;
}

/** Formula din Excel → formula Suite (cu „=”). Prefixele „_xlfn.” ale funcțiilor noi se scot. */
export function fromExcelFormula(f: string): string {
  const src = f.replace(/_xlfn\.|_xlws\.|_xlpm\.|_xleta\./g, '');
  // Dacă un text din formulă are „;”, Suite ar citi „,” ca virgulă zecimală; trecem atunci la „;”.
  const strings = src.match(/"(?:[^"]|"")*"/g) ?? [];
  // La fel dacă are constante matrice: {1,2;3,4} din Excel devine {1;2|3;4} (coloanele cu „;”, rândurile cu „|”).
  const hasArray = src.replace(/"(?:[^"]|"")*"/g, '').includes('{');
  if (!hasArray && !strings.some((s) => s.includes(';'))) return '=' + src;
  // În Excel „,” e mereu separator și „.” mereu virgulă zecimală; în acolade „;” desparte rândurile (la noi „|”).
  let out = '', quote = '', brace = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      out += ch;
      if (ch === quote) { if (src[i + 1] === quote) out += src[++i]; else quote = ''; }
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; out += ch; continue; }
    if (ch === '{') brace = true;
    else if (ch === '}') brace = false;
    if (ch === ',') out += ';';
    else if (ch === ';' && brace) out += '|';
    else if (ch === '.' && /\d/.test(src[i - 1] ?? '') && /\d/.test(src[i + 1] ?? '')) out += ',';
    else out += ch;
  }
  return '=' + out;
}

// ---------- Formatele numerelor ----------

const BUILTIN_FMT: Record<number, string> = {
  1: '0', 2: '0.00', 3: '#,##0', 4: '#,##0.00', 9: '0%', 10: '0.00%', 14: 'dd.mm.yyyy',
};

/** Un format de număr din Excel („#,##0.00 "lei"”, „0%”, „dd.mm.yyyy”) → formatul nostru. */
export function excelFmtToOurs(id: number, code: string | undefined): { fmt?: NumFmt; dec?: number } {
  // Formatele de oră și dată-oră din Excel (18–21, 45–47, 22).
  if ((id >= 18 && id <= 21) || (id >= 45 && id <= 47)) return { fmt: 'time', ...(id === 19 || id === 21 || id === 46 || id === 47 ? { dec: 1 } : {}) };
  if (id === 22) return { fmt: 'datetime' };
  if (id === 49) return { fmt: 'text' };
  if (id === 11 || id === 48) return { fmt: 'sci', dec: id === 11 ? 2 : 1 };
  if (id === 12 || id === 13) return { fmt: 'fraction' };
  if ((id >= 14 && id <= 17) || (id >= 27 && id <= 36) || (id >= 50 && id <= 58)) return { fmt: 'date' };
  const c = code ?? BUILTIN_FMT[id];
  if (!c || /^general$/i.test(c)) return {};
  if (c.trim() === '@') return { fmt: 'text' };
  const first = c.split(';')[0];
  // Fără text între ghilimele, caractere scăpate (\x), spații de lățimea unui caracter (_x), umpluturi (*x) și [culori / limbă].
  const bare = first.replace(/"[^"]*"|\\.|_.|\*.|\[[^\]]*\]/g, '');
  const decM = /\.(0+)/.exec(bare);
  const dec = decM ? decM[1].length : 0;
  // Contabil: umplutura cu spații (*) și zero scris cu liniuță.
  if (/lei|ron/i.test(first)) return { fmt: first.includes('*') || (id >= 41 && id <= 44) ? 'acct' : 'lei', dec };
  if (/€|eur/i.test(first)) return { fmt: 'eur', dec };
  if (bare.includes('%')) return { fmt: 'percent', dec };
  if (/E[+-]/i.test(bare) && /0/.test(bare)) return { fmt: 'sci', dec };
  if (/\?\/\?|#\s*\?+\/|\d\/\d/.test(bare) && !/[dmy]/i.test(bare)) return { fmt: 'fraction' };
  const hasTime = /h/i.test(bare) || /s/i.test(bare) || /\[[hms]+\]/i.test(first);
  const sec = /s/i.test(bare) ? { dec: 1 } : {};
  if (hasTime && /[dy]/i.test(bare)) return { fmt: 'datetime', ...sec };
  if (hasTime) return { fmt: 'time', ...sec };
  if (/mmmm/i.test(bare) && /[dy]/i.test(bare)) return { fmt: 'datelong' };
  if (/[dy]/i.test(bare) || /m/i.test(bare)) return { fmt: 'date' };
  if (/#,##0|0,0/.test(bare) || (id >= 5 && id <= 8) || (id >= 37 && id <= 44)) return { fmt: 'number', dec };
  if (dec) return { fmt: 'number', dec };
  return {};
}

function oursToExcelFmt(st: CellStyle): string | null {
  if (st.code) return st.code;
  const zeros = (d: number) => (d > 0 ? '.' + '0'.repeat(d) : '');
  switch (st.fmt) {
    case 'number': return '#,##0' + zeros(st.dec ?? 2);
    case 'lei': return '#,##0' + zeros(st.dec ?? 2) + ' "lei"';
    case 'acct': { const n = '#,##0' + zeros(st.dec ?? 2); return `_-* ${n} "lei"_-;-* ${n} "lei"_-;_-* "-"?? "lei"_-;_-@_-`; }
    case 'text': return '@';
    case 'eur': return '#,##0' + zeros(st.dec ?? 2) + ' "€"';
    case 'percent': return '0' + zeros(st.dec ?? 0) + '%';
    case 'date': return 'dd.mm.yyyy';
    case 'datelong': return '[$-418]d mmmm yyyy';
    case 'time': return st.dec ? 'hh:mm:ss' : 'hh:mm';
    case 'datetime': return st.dec ? 'dd.mm.yyyy hh:mm:ss' : 'dd.mm.yyyy hh:mm';
    case 'sci': return '0' + zeros(st.dec ?? 2) + 'E+00';
    case 'fraction': return '# ?/?';
    default: return null;
  }
}

// ---------- Import ----------

/** O foaie adusă din Excel. */
export interface XlsxSheet {
  name: string;
  cells: Cells;
  styles: Styles;
  colW: Record<string, number>;
  freeze?: number;
  freezeCol?: number;
  /** Graficele foii (coloane/bare, linie, plăcintă). */
  charts: SheetChart[];
  /** Pozele de pe foaie (xdr:pic). */
  pics?: SheetPic[];
  /** Listele derulante (validare de tip listă). */
  lists: SheetList[];
  /** Formatarea condiționată pe care o știm (comparații, „conține”, goale/completate). */
  rules: SheetRule[];
  /** Celulele îmbinate („A1:C1”). */
  merges: string[];
  /** Filtrul automat (capul de tabel cu ▾ și ce e ascuns). */
  filter?: SheetFilter;
  /** Înălțimile alese de mână ("5": 60). */
  rowH: Record<string, number>;
  /** Rândurile ascunse (numerele lor, de la 1). */
  hideRows?: number[];
  /** Coloanele ascunse (numerele lor, de la 1). */
  hideCols?: number[];
  /** Nivelurile grupurilor de rânduri / coloane (outlineLevel). */
  rowLvl?: Record<string, number>;
  colLvl?: Record<string, number>;
  /** Foaia era protejată în Excel. */
  protect?: boolean;
  protectPw?: SheetPw;
  /** Culoarea filei. */
  tab?: string;
  /** Foaia era ascunsă. */
  hidden?: boolean;
  /** Tabelele cu nume ale foii (zona, numele, stilul), vezi table.ts. */
  tables?: SheetTable[];
  /** Liniile grilei erau ascunse. */
  noGrid?: boolean;
  noHead?: boolean;
  /** Valorile zero erau ascunse (sheetView showZeros="0"). */
  noZero?: boolean;
  /** Minigraficele din celule (x14:sparklineGroups). */
  sparks?: SheetSpark[];
  /** Scenariile foii (Manager de scenarii). */
  scenarios?: SheetScenario[];
  dataTables?: SheetDataTable[];
  /** Modelul Rezolvitorului (din numele ascunse solver_*). */
  solver?: SheetSolver;
  /** Setările de tipărire (orientare, hârtie, margini, antet și subsol, zona de tipărit). */
  print?: SheetPrint;
  rows: number;
  cols: number;
}

export interface XlsxImport {
  sheets: XlsxSheet[];
  /** Foaia care era deschisă în Excel. */
  active: number;
  /** Rânduri sau coloane care nu au încăput în tabel. */
  cut: boolean;
  /** Formule pe care Suite nu le știe; s-a păstrat rezultatul lor din Excel. */
  asValues: number;
  /** Câteva dintre ele (foaia, celula, formula, eroarea), pentru raportul de compatibilitate. */
  asValuesSamples?: string[];
  /** Grafice care nu s-au putut aduce (alt tip sau date din alte foi). */
  chartsSkipped: number;
  /** Câte poze nu s-au putut aduce (EMF / WMF, prea mari, legate din afară). */
  picsSkipped?: number;
  /** Proprietățile registrului (docProps/core.xml): titlu, subiect, autor, cuvinte cheie. */
  props?: DocProps;
  /** Foi care nu s-au putut aduce (foi care sunt doar un grafic, peste limita de foi). */
  skipped: number;
  /** Arhiva era deteriorată (tăiată) și s-a reparat: s-a adus ce era întreg. */
  repaired?: boolean;
  /** Semnatarii, dacă fișierul e semnat digital (semnătura nu se păstrează la salvare). */
  signers?: import('../xmlSig').XmlSigCheck[];
  /** Numele definite (ExpDat = 'general dump'!$E$11), fără cele interne ale Excel (_xlnm.Print_Area…). */
  names?: DefinedName[];
  /** Tabelele pivot (pentru GETPIVOTDATA). */
  pivots?: PivotDef[];
  /** Condițiile sunt expresii regulate (fișierele LibreOffice). */
  match?: 'regex';
  /** Fișierul cerea calcul manual (calcPr calcMode="manual"). */
  calc?: 'manual';
  /** Fișierul cerea calcul iterativ (calcPr iterate="1"), cu numărul de treceri și schimbarea maximă. */
  iter?: { max: number; delta: number };
  /** Structura registrului era protejată (workbookProtection lockStructure). */
  lockBook?: { pw?: SheetPw };
  /** Stilurile de celulă cu nume ale fișierului (cellStyles fără builtinId). */
  cellStyles?: UserCellStyle[];
  /** Tema fișierului, când culorile ei diferă de cele obișnuite. */
  theme?: BookTheme;
  /** Registrele externe folosite de formule, cu valorile păstrate în fișier. */
  links?: ExtBook[];
  /** Stilurile de tabel proprii ale fișierului (tableStyles din styles.xml). */
  tableStyles?: CustomTableStyle[];
}

export const MAX_IMPORT_SHEETS = 50;

function cellPos(ref: string): { r: number; c: number } | null {
  const m = /^\$?([A-Z]{1,3})\$?(\d+)$/i.exec(ref);
  if (!m) return null;
  let c = 0;
  for (const ch of m[1].toUpperCase()) c = c * 26 + (ch.charCodeAt(0) - 64);
  return { r: Number(m[2]) - 1, c: c - 1 };
}

function rgb(n: XNode | undefined): string | undefined {
  const v = n?.attrs.rgb;
  return v && /^[0-9a-f]{8}$/i.test(v) ? '#' + v.slice(2).toLowerCase() : v && /^[0-9a-f]{6}$/i.test(v) ? '#' + v.toLowerCase() : undefined;
}

function readStyles(xml: string | null, checkboxes = false, list: 'cellXfs' | 'cellStyleXfs' = 'cellXfs'): CellStyle[] {
  if (!xml) return [];
  const doc = parseXml(xml);
  const styleNameOf = new Map<number, string>();
  for (const c of kids(find(doc, 'cellStyles'), 'cellStyle')) {
    if (c.attrs.builtinId === undefined && c.attrs.name && !BUILTIN_COPY.test(c.attrs.name.trim()) && c.attrs.name.length <= 60) styleNameOf.set(Number(c.attrs.xfId ?? 0), c.attrs.name);
  }
  const codes: Record<number, string> = {};
  for (const f of kids(find(doc, 'numFmts'), 'numFmt')) codes[Number(f.attrs.numFmtId)] = f.attrs.formatCode;
  const fontEls = kids(find(doc, 'fonts'), 'font');
  // Fontul și mărimea se țin minte doar când diferă de fontul obișnuit al fișierului (primul din listă).
  const baseName = kid(fontEls[0], 'name')?.attrs.val;
  const baseSz = Number(kid(fontEls[0], 'sz')?.attrs.val) || 11;
  const fonts = fontEls.map((f) => {
    const s: CellStyle = {};
    const name = kid(f, 'name')?.attrs.val;
    const sz = Number(kid(f, 'sz')?.attrs.val);
    if (name && baseName && name !== baseName && /^[\w .\-]{1,48}$/u.test(name)) s.font = name;
    if (sz && Math.abs(sz - baseSz) >= 0.5) s.sz = Math.round(Math.min(MAX_SZ, Math.max(MIN_SZ, sz)) * 2) / 2;
    const on = (n: string) => { const k = kid(f, n); return k && k.attrs.val !== '0' && k.attrs.val !== 'false' && k.attrs.val !== 'none'; };
    if (on('b')) s.b = true;
    if (on('i')) s.i = true;
    if (on('u')) s.u = true;
    if (on('strike')) s.s = true;
    const va = kid(f, 'vertAlign')?.attrs.val;
    if (va === 'superscript') s.pos = 'sup'; else if (va === 'subscript') s.pos = 'sub';
    const col = rgb(kid(f, 'color'));
    if (col && col !== '#000000') s.color = col;
    return s;
  });
  const fills = kids(find(doc, 'fills'), 'fill').map((f) => {
    const p = kid(f, 'patternFill');
    return p?.attrs.patternType === 'solid' ? rgb(kid(p, 'fgColor')) : undefined;
  });
  // Chenarele: laturile trase, cu felul și culoarea primei laturi (medie, groasă, dublă, întreruptă, punctată; restul subțiri).
  const borders = kids(find(doc, 'borders'), 'border').map((b) => {
    const drawn = [['left', 'l'], ['right', 'r'], ['top', 't'], ['bottom', 'b']].filter(([n]) => { const k = kid(b, n); return !!k?.attrs.style && k.attrs.style !== 'none'; });
    const first = drawn.length ? kid(b, drawn[0][0]) : undefined;
    const xs = first?.attrs.style ?? '';
    const st: LineStyle | undefined = xs === 'medium' ? 'medium' : xs === 'thick' ? 'thick' : xs === 'double' ? 'double'
      : /dash/i.test(xs) ? 'dashed' : xs === 'dotted' || xs === 'hair' ? 'dotted' : undefined;
    const col = rgb(kid(first, 'color'));
    return { sides: drawn.map(([, k]) => k).join(''), st, col: col && col !== '#000000' ? col : undefined };
  });
  return kids(find(doc, list), 'xf').map((x) => {
    const s: CellStyle = { ...fonts[Number(x.attrs.fontId ?? 0)] };
    const bd = borders[Number(x.attrs.borderId ?? 0)];
    if (bd?.sides) {
      s.bd = [...'tblr'].filter((k) => bd.sides.includes(k)).join('');
      if (bd.st) s.bdStyle = bd.st;
      if (bd.col) s.bdColor = bd.col;
    }
    const bg = fills[Number(x.attrs.fillId ?? 0)];
    if (bg && bg !== '#ffffff') s.bg = bg;
    const al = kid(x, 'alignment')?.attrs;
    const h = al?.horizontal;
    if (h === 'left' || h === 'center' || h === 'right') s.align = h;
    else if (h === 'centerContinuous') s.align = 'across';
    if (al?.wrapText === '1' || al?.wrapText === 'true') s.wrap = true;
    const v = al?.vertical;
    if (v === 'top' || v === 'bottom') s.va = v;
    else if (v === 'center') s.va = 'middle';
    // Rotirea: 1–90 în sus, 91–180 în jos (90 + grade); 255 = literele una sub alta.
    const tr = Number(al?.textRotation);
    if (tr >= 1 && tr <= 90) s.rot = Math.round(tr); else if (tr > 90 && tr <= 180) s.rot = -Math.round(tr - 90); else if (tr === 255) s.rot = 255;
    const ind = Number(al?.indent);
    if (ind >= 1) s.ind = Math.min(MAX_IND, Math.round(ind));
    const pr = kid(x, 'protection')?.attrs;
    if (pr?.locked === '0' || pr?.locked === 'false') s.unlock = true;
    if (checkboxes && find(x, 'xfComplement')) s.chk = true;
    const id = Number(x.attrs.numFmtId ?? 0);
    const nf = excelFmtToOurs(id, codes[id]);
    if (nf.fmt) {
      s.fmt = nf.fmt;
      if (nf.fmt !== 'date' && nf.dec !== undefined) {
        const def = nf.fmt === 'percent' || nf.fmt === 'time' || nf.fmt === 'datetime' ? 0 : 2;
        if (nf.dec !== def) s.dec = nf.dec;
      }
    }
    // Codul formatului se păstrează întocmai (afișare și salvare înapoi exact ca în fișier), dacă formatul nostru apropiat nu-l scrie la fel.
    if (codes[id] && !/^general$/i.test(codes[id].trim()) && codes[id].length <= 200 && oursToExcelFmt(s) !== codes[id]) s.code = codes[id];
    // Celula legată de un stil cu nume pus de om (xfId spre el): ține minte numele, ca la ✎ Modifică un stil.
    const own = list === 'cellXfs' ? styleNameOf.get(Number(x.attrs.xfId ?? 0)) : undefined;
    if (own) s.sty = own;
    return s;
  });
}

const BUILTIN_COPY = /^(Normal|Comma( \[0\])?|Currency( \[0\])?|Percent|(Followed )?Hyperlink|Good|Bad|Neutral|Input|Output|Calculation|Check Cell|Linked Cell|Note|Warning Text|Title|Heading [1-4]|Total|Explanatory Text|([246]0% - )?Accent[1-6])( \d+)*$/i;

/** Stilurile de celulă cu nume puse de om (cellStyle fără builtinId), cu formatul lor din cellStyleXfs; cele goale („Normal 2”) se sar. */
function readUserStyles(xml: string | null): UserCellStyle[] {
  if (!xml || !/<(?:\w+:)?cellStyle\b/.test(xml)) return [];
  // Copiile stilurilor gata făcute rămase din alte fișiere („Normal 2”, „Comma 2”, „20% - Accent1 2”) nu sunt stiluri ale omului.
  const named = kids(find(parseXml(xml), 'cellStyles'), 'cellStyle').filter((c) => c.attrs.builtinId === undefined && c.attrs.name && !BUILTIN_COPY.test(c.attrs.name.trim()));
  if (!named.length) return [];
  const base = readStyles(xml, false, 'cellStyleXfs');
  const out: UserCellStyle[] = [];
  for (const c of named) {
    const all = base[Number(c.attrs.xfId ?? 0)] as Record<string, unknown> | undefined;
    const st: Record<string, unknown> = {};
    for (const k of CELL_STYLE_KEYS) if (all?.[k] !== undefined) st[k] = all[k];
    if (Object.keys(st).length) out.push({ name: c.attrs.name, st: st as Partial<CellStyle> });
  }
  return cleanCellStyles(out);
}

/** Excel ține cel mult atâtea caractere într-o celulă; un fișier care pune mai mult (de exemplu un text de 1 MB în 12.000 de celule) ar umple memoria. */
const MAX_CELL_CHARS = 32767;

function stringItem(si: XNode): string {
  const t = kid(si, 't') ? kid(si, 't')!.text : kids(si, 'r').map((r) => kid(r, 't')?.text ?? '').join('');
  return t.length > MAX_CELL_CHARS ? t.slice(0, MAX_CELL_CHARS) : t;
}

/** Octeții unui .xlsx → foile lui, ca celule Suite. */
/** docProps/core.xml: titlul, subiectul, autorul și cuvintele cheie. */
export function coreXml(p: DocProps): string {
  const el = (tag: string, v?: string) => (v?.trim() ? `<${tag}>${escapeXml(v.trim())}</${tag}>` : '');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
    + el('dc:title', p.title) + el('dc:subject', p.subject) + el('dc:creator', p.author) + el('cp:keywords', p.keywords)
    + `<dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString().replace(/[.]\d+Z$/, 'Z')}</dcterms:modified></cp:coreProperties>`;
}

/** Proprietățile din docProps/core.xml (citite înapoi); undefined dacă nu e niciuna. */
export function propsFromCore(xml: string): DocProps | undefined {
  const root = parseXml(xml);
  const get = (n: string) => find(root, n)?.text.trim() ?? '';
  return docProps({ props: { title: get('title'), subject: get('subject'), author: get('creator'), keywords: get('keywords') } });
}

export async function readXlsx(data: Uint8Array): Promise<XlsxImport> {
  const zip = await openOfficeZip(data, 'xlsx', 'Fișierul nu este un tabel .xlsx valid.');
  const text = (p: string) => zip.file(p)?.async('string') ?? Promise.resolve(null);
  const wbXml = await text('xl/workbook.xml');
  if (!wbXml) throw new Error('Fișierul nu este un tabel .xlsx valid.');
  const wb = parseXml(wbXml);
  // Numele ascunse _xlchart.v1.0 … : zonele de date ale graficelor de tip nou (cx:chart).
  const xlChartNames = new Map(kids(find(wb, 'definedNames'), 'definedName').filter((d) => /^_xlchart\./i.test(d.attrs.name ?? '')).map((d) => [d.attrs.name!, d.text.trim()]));
  const sheetsN = kids(find(wb, 'sheets'), 'sheet');
  const rels = await text('xl/_rels/workbook.xml.rels');
  const wbRels = rels ? kids(parseXml(rels).kids[0], 'Relationship') : [];
  const shared = (await text('xl/sharedStrings.xml'));
  const strings = shared ? kids(find(parseXml(shared), 'sst'), 'si').map(stringItem) : [];
  // Culorile din temă (theme="4" tint=…) și cele indexate devin rgb înainte de citire.
  const themeRel = wbRels.find((r) => /\/theme$/i.test(r.attrs.Type ?? ''))?.attrs.Target;
  const themeTxt = (themeRel ? await text(themeRel.startsWith('/') ? themeRel.slice(1) : 'xl/' + themeRel.replace(/^\.\//, '')) : null) ?? await text('xl/theme/theme1.xml');
  const palette = themePalette(themeTxt);
  const bookTheme = cleanTheme({ name: themeName(themeTxt), colors: palette, fonts: themeFontsFromXml(themeTxt) });
  const rawStyles = await text('xl/styles.xml');
  const indexed = indexedPalette(rawStyles);
  const stylesXml = resolveXmlColors(rawStyles, palette, indexed);
  // Casetele de bifat din celule: stilul celulei trimite (xfComplement) la o „pungă” de tip Checkbox.
  const bagRel = wbRels.find((r) => /FeaturePropertyBag$/i.test(r.attrs.Type ?? ''));
  const bagTarget = bagRel?.attrs.Target ?? 'featurePropertyBag/featurePropertyBag.xml';
  const bagXml = await text(bagTarget.startsWith('/') ? bagTarget.slice(1) : 'xl/' + bagTarget.replace(/^\.\//, ''));
  const xfs = readStyles(stylesXml, !!bagXml && /type\s*=\s*["']Checkbox["']/.test(bagXml));
  const userStyles = readUserStyles(stylesXml);
  const dxfLooks = readDxfLooks(stylesXml);
  const dxfColors = readDxfColors(stylesXml);
  const ownTableStyles = readTableStyles(stylesXml);
  let cut = false;
  let asValues = 0;
  let chartsSkipped = 0;
  let picsSkipped = 0;
  // Rezultatele din Excel ale formulelor, pe foi (în ordinea foilor aduse).
  const cachedBy: Record<string, string>[] = [];
  // Liste ale căror valori stau în celule (=$D$1:$D$5 sau =Liste!A1:A9), citite după ce avem toate foile.
  const pendingLists: { sheet: number; range: string; src: string; extra: Partial<SheetList> }[] = [];
  const out: XlsxSheet[] = [];
  const relsOf = async (part: string) => {
    const slash = part.lastIndexOf('/');
    const xml = await text(`${part.slice(0, slash)}/_rels/${part.slice(slash + 1)}.rels`);
    return xml ? kids(parseXml(xml).kids[0], 'Relationship') : [];
  };
  const resolve = (from: string, target: string) => {
    if (target.startsWith('/')) return target.slice(1);
    const parts = from.split('/').slice(0, -1);
    for (const seg of target.split('/')) {
      if (seg === '..') parts.pop();
      else if (seg !== '.') parts.push(seg);
    }
    return parts.join('/');
  };
  // Pozele puse în celule (<c t="e" vm="1">): vm → xl/metadata.xml (valueMetadata → futureMetadata XLRICHVALUE → rvb i)
  // → xl/richData/rdrichvalue.xml (structura cu _rvRel:LocalImageIdentifier) → richValueRel.xml → poza din xl/media.
  const richPics = new Map<number, Promise<{ src: string; alt?: string } | null>>();
  const richXml = async (p: string) => { const x = await text(p); return x ? parseXml(x).kids[0] : undefined; };
  const metaRoot = await richXml('xl/metadata.xml');
  const richRoots = metaRoot ? await Promise.all(['xl/richData/rdrichvalue.xml', 'xl/richData/rdrichvaluestructure.xml', 'xl/richData/richValueRel.xml'].map(richXml)) : [];
  const richRels = metaRoot ? await relsOf('xl/richData/richValueRel.xml') : [];
  const cellPic = (vm: number) => {
    if (!richPics.has(vm)) richPics.set(vm, (async () => {
      const [rvData, rvStruct, rvRel] = richRoots;
      if (!metaRoot || !rvData || !rvStruct || !rvRel) return null;
      const types = kids(find(metaRoot, 'metadataTypes'), 'metadataType');
      const tRich = types.findIndex((x) => x.attrs.name === 'XLRICHVALUE') + 1;
      const rc = kids(kids(find(metaRoot, 'valueMetadata'), 'bk')[vm - 1], 'rc').find((x) => Number(x.attrs.t) === tRich);
      const fm = metaRoot.kids.find((x) => x.name === 'futureMetadata' && x.attrs.name === 'XLRICHVALUE');
      const bk = rc && fm ? kids(fm, 'bk')[Number(rc.attrs.v)] : undefined;
      const rvb = bk ? find(bk, 'rvb') : undefined;
      const rv = rvb ? kids(rvData, 'rv')[Number(rvb.attrs.i)] : undefined;
      const keys = rv ? kids(kids(rvStruct, 's')[Number(rv.attrs.s)], 'k').map((k) => k.attrs.n ?? '') : [];
      const vals = rv ? kids(rv, 'v').map((v) => v.text) : [];
      const ri = keys.indexOf('_rvRel:LocalImageIdentifier');
      const rel = ri >= 0 ? kids(rvRel, 'rel')[Number(vals[ri])] : undefined;
      const rid = rel ? Object.entries(rel.attrs).find(([k]) => /(^|:)id$/.test(k))?.[1] : undefined;
      const target = rid ? richRels.find((r) => r.attrs.Id === rid) : undefined;
      if (!target?.attrs.Target || target.attrs.TargetMode === 'External') return null;
      const path = resolve('xl/richData/richValueRel.xml', target.attrs.Target);
      const mime = picMime(path);
      const b64 = mime ? await zip.file(path)?.async('base64') : null;
      if (!b64 || b64.length > 11_000_000) return null;
      const ti = keys.indexOf('Text');
      const alt = ti >= 0 ? vals[ti]?.trim().slice(0, 500) : '';
      return { src: `data:${mime};base64,${b64}`, ...(alt ? { alt } : {}) };
    })());
    return richPics.get(vm)!;
  };

  // Registrele externe ([1], [2]… din formule): fișierul fiecăruia (xl/externalLinks/_rels), ca formula să-l scrie pe nume.
  const extRefs = kids(find(wb, 'externalReferences'), 'externalReference');
  const extParts = extRefs.map((x) => { const t = wbRels.find((r) => r.attrs.Id === x.attrs.id)?.attrs.Target; return t ? resolve('xl/workbook.xml', t) : ''; });
  const extPaths = await Promise.all(extParts.map(async (p) => (p ? (await relsOf(p)).find((r) => /externalLinkPath$/i.test(r.attrs.Type ?? ''))?.attrs.Target : undefined) ?? ''));
  const extFile = (n: number) => {
    let p = extPaths[n - 1] ?? '';
    try { p = decodeURIComponent(p); } catch { /* rămâne cum e */ }
    p = p.replace(/^file:\/+(?=[A-Za-z]:)/i, '');
    return { path: p, name: p.split(/[\\/]/).pop() ?? '' };
  };
  const extUsed = new Set<number>();
  const extName = (n: number) => { const nm = extFile(n).name; return nm && !/[[\]]/.test(nm) ? nm : null; };

  // O foaie: celule, formatare, lățimi, înghețare și grafice.
  const readSheet = async (sheetPath: string, sheetXml: string, sheetName: string): Promise<XlsxSheet> => {
    const ws = parseXml(resolveXmlColors(sheetXml, palette, indexed) ?? sheetXml);
    const cells: Cells = {};
    const styles: Styles = {};
    const cached: Record<string, string> = {};
    const sharedF: Record<string, { f: string; r: number; c: number }> = {};
    const spillZones: { r: number; c: number; r2: number; c2: number }[] = [];
    // Tabelele de date (<f t="dataTable" ref="E2:E4" r1="A1"/> în prima celulă de rezultat): zona cu marginea de valori și formulă.
    const dataTables: SheetDataTable[] = [];
    let maxR = -1;
    let maxC = -1;
    let rowIdx = -1;
    const rowH: Record<string, number> = {};
    const hideRows: number[] = [];
    const rowLvl: Record<string, number> = {};
    const inCell: { r: number; c: number; src: string; alt?: string }[] = [];
    for (const row of kids(find(ws, 'sheetData'), 'row')) {
      rowIdx = row.attrs.r ? Number(row.attrs.r) - 1 : rowIdx + 1;
      const ol = Number(row.attrs.outlineLevel);
      if (Number.isInteger(ol) && ol >= 1 && rowIdx < ROWS) rowLvl[String(rowIdx + 1)] = Math.min(7, ol);
      if ((row.attrs.hidden === '1' || row.attrs.hidden === 'true') && rowIdx < ROWS) hideRows.push(rowIdx + 1);
      if (row.attrs.customHeight === '1' || row.attrs.customHeight === 'true') {
        const px = Math.round(Number(row.attrs.ht) / 0.75);
        if (px > MIN_ROW_H && px <= MAX_ROW_H && rowIdx < ROWS) rowH[String(rowIdx + 1)] = px;
      }
      let colIdx = -1;
      for (const c of kids(row, 'c')) {
        const pos = c.attrs.r ? cellPos(c.attrs.r) : null;
        const r = pos ? pos.r : rowIdx;
        colIdx = pos ? pos.c : colIdx + 1;
        const t = c.attrs.t;
        const v = kid(c, 'v')?.text;
        const fNode = kid(c, 'f');
        let value: string | undefined;
        // Un text care arată ca un număr (telefon 0722…, cod 00123) sau ca o formulă rămâne text (cu apostroful de text).
        if (t === 's') value = v !== undefined && strings[Number(v)] !== undefined ? keepText(strings[Number(v)]) : undefined;
        else if (t === 'inlineStr') value = keepText(stringItem(kid(c, 'is') ?? { name: '', attrs: {}, kids: [], text: '' }));
        else if (t === 'b') value = v === '1' ? 'ADEVĂRAT' : v === '0' ? 'FALS' : undefined;
        else if (t === 'str' || t === 'e') value = v;
        else if (v !== undefined && v !== '' && Number.isFinite(Number(v))) value = formatNumber(Number(v));
        // Poza din celulă: celula rămâne goală, poza se pune în ea (mai jos, după pozele de pe foaie).
        if (t === 'e' && c.attrs.vm && !kid(c, 'f') && r < ROWS && colIdx < COLS && inCell.length < MAX_PICS) {
          const img = await cellPic(Number(c.attrs.vm));
          if (img) { inCell.push({ r, c: colIdx, ...img }); value = undefined; }
        }
        let formula: string | undefined;
        if (fNode) {
          const si = fNode.attrs.si;
          if (fNode.text.trim()) {
            formula = fromExcelFormula(extFromExcel(expandStructuredRefs(fNode.text.trim(), tables, r, sheetName), extName, extUsed));
            if (fNode.attrs.t === 'shared' && si !== undefined) sharedF[si] = { f: formula, r, c: colIdx };
            if (fNode.attrs.t === 'array' && fNode.attrs.ref?.includes(':') && SPILL_RE.test(formula)) {
              const end = cellPos(fNode.attrs.ref.split(':')[1]);
              if (end) spillZones.push({ r, c: colIdx, r2: end.r, c2: end.c });
            }
          } else if (fNode.attrs.t === 'shared' && si !== undefined && sharedF[si]) {
            const m = sharedF[si];
            formula = shiftFormula(m.f, r - m.r, colIdx - m.c);
          } else if (fNode.attrs.t === 'dataTable') {
            const [a, b] = (fNode.attrs.ref ?? '').split(':').map((x) => cellPos(x));
            const r1 = fNode.attrs.r1?.replace(/\$/g, ''), r2 = fNode.attrs.r2?.replace(/\$/g, '');
            if (a && a.r > 0 && a.c > 0) {
              const end = b ?? a;
              const io = fNode.attrs.dt2D === '1' ? { row: r1, col: r2 } : fNode.attrs.dtr === '1' ? { row: r1 } : { col: r1 };
              dataTables.push(...cleanDataTables([{ zone: `${cellId(a.r - 1, a.c - 1)}:${cellId(end.r, end.c)}`, ...io }]));
            }
          }
        }
        const content = formula ?? value;
        const st = xfs[Number(c.attrs.s ?? 0)];
        if ((content === undefined || content === '') && !(st && Object.keys(st).length)) continue;
        if (r >= ROWS || colIdx >= COLS) {
          if (content !== undefined && content !== '') cut = true;
          continue;
        }
        const id = cellId(r, colIdx);
        if (content !== undefined && content !== '') {
          cells[id] = content;
          if (formula && value !== undefined) cached[id] = value;
          maxR = Math.max(maxR, r);
          maxC = Math.max(maxC, colIdx);
        }
        if (st && Object.keys(st).length) styles[id] = { ...st };
      }
    }

    for (const z of spillZones) {
      for (let rr = z.r; rr <= Math.min(z.r2, ROWS - 1); rr++) {
        for (let cc = z.c; cc <= Math.min(z.c2, COLS - 1); cc++) {
          if (rr === z.r && cc === z.c) continue;
          const id = cellId(rr, cc);
          if (!cells[id]?.startsWith('=')) { delete cells[id]; delete cached[id]; }
        }
      }
    }
    cachedBy.push(cached);

    const colW: Record<string, number> = {};
    const hideCols: number[] = [];
    const colLvl: Record<string, number> = {};
    const colEnd = Math.min(COLS, Math.max(STYLE_COLS, lastUsedCol(cells) + 2));
    for (const col of kids(find(ws, 'cols'), 'col')) {
      const w = Number(col.attrs.width);
      const ol = Number(col.attrs.outlineLevel);
      if (Number.isInteger(ol) && ol >= 1) for (let c = Math.max(1, Number(col.attrs.min)); c <= Math.min(Number(col.attrs.max), colEnd); c++) colLvl[String(c)] = Math.min(7, ol);
      if (col.attrs.hidden === '1' || col.attrs.hidden === 'true') {
        for (let c = Number(col.attrs.min) - 1; c < Math.min(Number(col.attrs.max), colEnd); c++) if (c >= 0) hideCols.push(c + 1);
        // Lățimea unei coloane ascunse se păstrează pentru când se afișează (Excel pune des 0: atunci rămâne cea obișnuită).
        if (!(w > 0)) continue;
      }
      if (!Number.isFinite(w)) continue;
      const px = Math.round(Math.min(MAX_COL_W, Math.max(MIN_COL_W, w * 7 + 5)));
      if (Math.abs(px - COL_W) < 4) continue;
      for (let c = Number(col.attrs.min) - 1; c < Math.min(Number(col.attrs.max), colEnd); c++) colW[colName(c)] = px;
    }
    const pane = find(ws, 'pane');
    // Panourile înghețate: câte rânduri (ySplit) și câte coloane (xSplit).
    const frozenPane = !!pane && !!pane.attrs.state?.startsWith('frozen');
    const freeze = frozenPane ? cleanFreeze(Number(pane!.attrs.ySplit), MAX_FREEZE_ROWS) || undefined : undefined;
    const freezeCol = frozenPane ? cleanFreeze(Number(pane!.attrs.xSplit), MAX_FREEZE_COLS) || undefined : undefined;
    const sp = find(ws, 'sheetProtection')?.attrs;
    const protect = !!sp && (sp.sheet === '1' || sp.sheet === 'true') ? true : undefined;
    const protectPw = protect ? sheetPwFrom(sp) : undefined;
    const tab = rgb(kid(find(ws, 'sheetPr'), 'tabColor'));
    const sv = find(ws, 'sheetView')?.attrs.showGridLines;
    const noGrid = sv === '0' || sv === 'false';
    const sh = find(ws, 'sheetView')?.attrs.showRowColHeaders;
    const noHead = sh === '0' || sh === 'false';
    const sz = find(ws, 'sheetView')?.attrs.showZeros;
    const noZero = sz === '0' || sz === 'false';
    const print = printFrom(ws);
    // Erorile ignorate (numberStoredAsText): numerele scrise ca text din aceste zone nu au triunghiul verde.
    for (const ie of find(ws, 'ignoredErrors')?.kids ?? []) {
      if (ie.name !== 'ignoredError' || !(ie.attrs.numberStoredAsText === '1' || ie.attrs.numberStoredAsText === 'true')) continue;
      const zones = (ie.attrs.sqref ?? '').split(/\s+/).map((ref) => ref.replace(/[$]/g, '').split(':').map((x) => cellPos(x))).filter((z) => z[0]);
      for (const id of Object.keys(cells)) {
        if (!cells[id].startsWith("'") || !isNumber(cells[id].slice(1))) continue;
        const q = cellPos(id);
        if (q && zones.some(([a, b]) => { const z = b ?? a!; return q.r >= Math.min(a!.r, z!.r) && q.r <= Math.max(a!.r, z!.r) && q.c >= Math.min(a!.c, z!.c) && q.c <= Math.max(a!.c, z!.c); })) styles[id] = { ...styles[id], ign: true };
      }
    }

    for (const [id, st] of Object.entries(styles)) {
      // Celulele goale contează doar dacă au fundal, chenar sau centrare pe selecție (de exemplu rândurile goale ale unui tabel tipărit).
      if (!cells[id] && !st.bg && !st.bd && st.align !== 'across') delete styles[id];
    }

    // Graficele foii: foaie → desen → grafice, prin fișierele de legături (.rels).
    const charts: SheetChart[] = [];
    const pics: SheetPic[] = [];
    for (const x of inCell) {
      const w = Math.max(8, (colW[colName(x.c)] ?? COL_W) - 4), h = Math.max(8, (rowH[String(x.r + 1)] ?? 24) - 4);
      pics.push({ id: `p${Date.now().toString(36)}c${pics.length}`, src: x.src, r: x.r, c: x.c, dx: 0, dy: 0, w, h, cell: true, ...(x.alt ? { alt: x.alt } : {}) });
    }
    const drawingNode = kid(ws.kids.find((k) => k.name === 'worksheet'), 'drawing');
    if (drawingNode) {
      const sRels = await relsOf(sheetPath);
      const dRel = sRels.find((r) => r.attrs.Id === drawingNode.attrs.id);
      if (dRel) {
        const drawingPath = resolve(sheetPath, dRel.attrs.Target);
        const dXml = await text(drawingPath);
        const cRels = await relsOf(drawingPath);
        const dTree = dXml ? parseXml(dXml) : null;
        // Pozele de pe foaie (xdr:pic într-un oneCellAnchor / twoCellAnchor): fișierul din xl/media, ca data: URL.
        // Varianta nouă din mc:AlternateContent (Choice) se sare; se ia rezerva, ca o poză să nu apară de două ori.
        const anchors: XNode[] = [];
        const collect = (n: XNode) => { for (const k of n.kids) { if (k.name === 'oneCellAnchor' || k.name === 'twoCellAnchor' || k.name === 'absoluteAnchor') anchors.push(k); else if (k.name !== 'Choice') collect(k); } };
        if (dTree) collect(dTree);
        // Locul unei ancore (celula din colț, depărtarea, mărimea în pixeli); `inner` = poza / forma / cadrul graficului.
        const placeOf = (a: XNode, inner: XNode) => {
          const fr = kid(a, 'from');
          // Ancora absolută (de exemplu graficul unei foi-grafic): locul (pos) și mărimea (ext) în EMU, de la colțul foii.
          if (!fr && a.name === 'absoluteAnchor') {
            const pos = kid(a, 'pos'), ax = kid(a, 'ext');
            const w = Number(ax?.attrs.cx), h = Number(ax?.attrs.cy);
            return w > 0 && h > 0 ? picPlace({ col: 0, colOff: Number(pos?.attrs.x) || 0, row: 0, rowOff: Number(pos?.attrs.y) || 0 }, w, h) : null;
          }
          const num = (n: string) => Number(kid(fr, n)?.text ?? NaN);
          const ext = kid(find(inner, 'xfrm'), 'ext') ?? kid(a, 'ext');
          let cx = Number(ext?.attrs.cx), cy = Number(ext?.attrs.cy);
          // Fără mărime scrisă (unele programe lasă xfrm gol): din celula de sfârșit (to), cu lățimile coloanelor și înălțimile rândurilor.
          const to = kid(a, 'to');
          if (!(cx > 0 && cy > 0) && fr && to) {
            const tn = (n: string) => Number(kid(to, n)?.text ?? NaN);
            let w = 0, h = 0;
            for (let c = num('col'); c < Math.min(tn('col'), COLS); c++) w += colW[colName(c)] ?? COL_W;
            for (let r = num('row'); r < Math.min(tn('row'), num('row') + 2000); r++) h += rowH[String(r + 1)] ?? MIN_ROW_H;
            cx = w * 9525 - num('colOff') + tn('colOff'); cy = h * 9525 - num('rowOff') + tn('rowOff');
          }
          return fr ? picPlace({ col: num('col'), colOff: num('colOff'), row: num('row'), rowOff: num('rowOff') }, cx, cy) : null;
        };
        // Graficele: fiecare din cadrul lui (xdr:graphicFrame), cu locul de pe foaie; cele fără ancoră rămân în panou.
        const chartAt = new Map<string, ChartAt>();
        for (const a of anchors) {
          // Graficele de tip nou (cascadă, histogramă…) stau în mc:AlternateContent / Choice, cu o casetă de rezervă în Fallback.
          const gf = kid(a, 'graphicFrame') ?? kid(kid(kid(a, 'AlternateContent'), 'Choice'), 'graphicFrame');
          const cid = gf ? find(gf, 'chart')?.attrs.id : undefined;
          const p = cid ? placeOf(a, gf!) : null;
          const at = p && cleanAt(p, ROWS, COLS);
          if (cid && at) chartAt.set(cid, at);
        }
        const chartIds: string[] = [];
        const walk = (n: XNode) => { for (const k of n.kids) { if (k.name === 'chart' && k.attrs.id) chartIds.push(k.attrs.id); else walk(k); } };
        if (dTree) walk(dTree);
        for (const rid of chartIds) {
          const rel = cRels.find((r) => r.attrs.Id === rid);
          const cXml = rel ? await text(resolve(drawingPath, rel.attrs.Target)) : null;
          const cid0 = `g${Date.now().toString(36)}${charts.length}`;
          const ch = !cXml ? null : /<(?:\w+:)?chartSpace[^>]*chartex/.test(cXml.slice(0, 2000)) ? chartExFromXml(cXml, sheetName, cid0, xlChartNames) : chartFromXml(cXml, sheetName, cid0);
          const at = chartAt.get(rid);
          if (ch && charts.length < 20) charts.push(at ? { ...ch, at } : ch); else chartsSkipped++;
        }
        for (const a of anchors) {
          // O poză (xdr:pic) sau o formă / casetă de text (xdr:sp, citită de shapeXml.ts).
          const sp = kid(a, 'pic') ? undefined : kid(a, 'sp');
          const pic = kid(a, 'pic') ?? sp;
          if (!pic || (sp && find(sp, 'cNvPr')?.attrs.hidden === '1')) continue;
          const rid = sp ? undefined : find(pic, 'blip')?.attrs.embed;
          const rel = rid ? cRels.find((r) => r.attrs.Id === rid) : undefined;
          const path = rel && rel.attrs.TargetMode !== 'External' ? resolve(drawingPath, rel.attrs.Target) : null;
          const mime = path ? picMime(path) : null;
          const place = placeOf(a, pic);
          if (sp) {
            const sh = shapeFromSp(sp);
            if (!sh || !place || pics.length >= MAX_PICS) continue;
            // În fereastră: desenul cu text (PNG); altfel (teste) doar forma, ca SVG, fără text.
            let src = '';
            try { src = typeof document !== 'undefined' ? await renderShapeBox(sh, place.w, place.h) : ''; } catch { src = ''; }
            if (!src) src = shapeSvgUrl(shapeSvg(sh, place.w, place.h));
            const salt = find(sp, 'cNvPr')?.attrs.descr?.trim();
            pics.push({ id: `p${Date.now().toString(36)}${pics.length}`, src, ...place, ...(salt ? { alt: salt.slice(0, 500) } : {}), sh });
            continue;
          }
          const meta = !!path && isMetafileExt(path.split('.').pop() ?? '');
          const file = path && (mime || meta) && place && pics.length < MAX_PICS ? zip.file(path) : null;
          const b64 = file ? await file.async('base64') : null;
          // Desenele .wmf / .emf (des întâlnite în foile vechi) devin poze PNG.
          const src = !b64 || b64.length > 11_000_000 ? null : meta ? await metafileToUrl(fromBase64(b64)) : `data:${mime};base64,${b64}`;
          if (!src || !place) { picsSkipped++; continue; }
          const alt = find(pic, 'cNvPr')?.attrs.descr?.trim();
          pics.push({ id: `p${Date.now().toString(36)}${pics.length}`, src, ...place, ...(alt ? { alt: alt.slice(0, 500) } : {}) });
        }
      }
    }
    // Comentariile (notele) din Excel: fișierul comments legat de foaie.
    const cRel = (await relsOf(sheetPath)).find((r) => /\/comments$/.test(r.attrs.Type ?? ''));
    const cXml = cRel ? await text(resolve(sheetPath, cRel.attrs.Target)) : null;
    if (cXml) {
      for (const [id, note] of Object.entries(notesFromXml(cXml))) {
        const p = cellPos(id);
        if (p && p.r < ROWS && p.c < COLS) styles[id] = { ...styles[id], note };
      }
    }
    // Comentariile cu fir (Excel 365): înlocuiesc comentariul clasic „[Threaded comment]” pus doar ca loc al lor.
    const tcRel = (await relsOf(sheetPath)).find((r) => /\/threadedComment$/i.test(r.attrs.Type ?? ''));
    const tcXml = tcRel ? await text(resolve(sheetPath, tcRel.attrs.Target)) : null;
    if (tcXml) {
      const pRel = wbRels.find((r) => /\/person$/i.test(r.attrs.Type ?? ''));
      const pXml = pRel ? await text(resolve('xl/workbook.xml', pRel.attrs.Target)) : null;
      for (const [id, t] of Object.entries(threadsFromXml(parseXml(tcXml), pXml ? personsFromXml(parseXml(pXml)) : {}))) {
        const p = cellPos(id);
        if (!p || p.r >= ROWS || p.c >= COLS) continue;
        const { note, ...rest } = styles[id] ?? {};
        styles[id] = { ...rest, ...(note && !isThreadStub(note) ? { note } : {}), cmt: t.th, ...(t.done ? { cdone: true } : {}) };
      }
    }
    // Legăturile (hyperlink): adresa e în legăturile foii (r:id) sau, pentru un loc din tabel, în „location”.
    const linkRels = (await relsOf(sheetPath)).filter((r) => /\/hyperlink$/.test(r.attrs.Type ?? ''));
    for (const h of kids(find(ws, 'hyperlinks'), 'hyperlink').slice(0, 5000)) {
      const target = h.attrs.id ? linkRels.find((r) => r.attrs.Id === h.attrs.id)?.attrs.Target : h.attrs.location ? '#' + h.attrs.location : undefined;
      const link = cleanLink(target);
      const p = cellPos((h.attrs.ref ?? '').split(':')[0]);
      if (link && p && p.r < ROWS && p.c < COLS) styles[cellId(p.r, p.c)] = { ...styles[cellId(p.r, p.c)], link };
    }
    // Listele derulante: valori scrise direct ("Da,Nu") sau luate dintr-o zonă de celule (rezolvată la final).
    const lists: SheetList[] = [];
    for (const dv of kids(find(ws, 'dataValidations'), 'dataValidation')) {
      if (lists.length >= MAX_LISTS) continue;
      const type = dv.attrs.type ?? 'none';
      const f = kid(dv, 'formula1')?.text.trim() ?? '';
      const extra = validationExtra(dv.attrs, type, f, kid(dv, 'formula2')?.text.trim() ?? '');
      for (const ref of (dv.attrs.sqref ?? '').split(/\s+/)) {
        const g = sqrefRange(ref);
        if (!g) continue;
        if (type !== 'list') {
          // Reguli pe număr / dată / lungime, sau doar mesajul la selectare.
          if (extra.rule) lists.push({ range: g, values: [], ...extra });
          else if (type === 'none' && extra.prompt) lists.push({ range: g, values: [], prompt: extra.prompt });
        } else if (f.startsWith('"')) {
          const values = parseValues(f.replace(/^"|"$/g, '').replace(/""/g, '"').split(',').join('\n'));
          if (values.length) lists.push({ range: g, values, ...extra });
        } else if (f) {
          pendingLists.push({ sheet: out.length, range: g, src: f, extra });
        }
      }
    }
    // Formatarea condiționată: regulile simple devin reguli Suite, cu stilul cel mai apropiat de culoarea din Excel.
    const rules: SheetRule[] = [];
    for (const cf of kids(ws.kids.find((k) => k.name === 'worksheet') ?? ws, 'conditionalFormatting')) {
      const cfRules = kids(cf, 'cfRule').sort((a, b) => Number(b.attrs.priority ?? 0) - Number(a.attrs.priority ?? 0));
      for (const ref of (cf.attrs.sqref ?? '').split(/\s+/)) {
        const g = sqrefRange(ref);
        if (!g) continue;
        for (const x of cfRules) {
          const rule = ruleFromXml(x, g, dxfLooks);
          if (rule && rules.length < MAX_RULES) rules.push(rule);
        }
      }
    }
    // Celulele îmbinate.
    const merges = cleanMerges(kids(find(ws, 'mergeCells'), 'mergeCell').map((m) => m.attrs.ref ?? ''));
    // Filtrul automat: rândurile ascunse de el nu rămân ascunse „de mână” (altfel n-ar mai apărea după scoaterea filtrului).
    const filter = autoFilterFrom(find(ws, 'autoFilter'), cells, styles, dxfColors);
    if (filter && (Object.keys(filter.hidden).length || filter.cond || filter.color)) {
      const end = Math.max(filterEnd(cells, filter), filter.r);
      for (let i = hideRows.length - 1; i >= 0; i--) if (hideRows[i] - 1 > filter.r && hideRows[i] - 1 <= end) hideRows.splice(i, 1);
    }
    const sparks = sparksFrom(ws.kids.find((k) => k.name === 'worksheet') ?? ws, sheetName);
    const scenarios = scenariosFrom(find(ws, 'scenarios'));
    return { ...(sparks.length ? { sparks } : {}), ...(scenarios.length ? { scenarios } : {}), ...(dataTables.length ? { dataTables } : {}), name: sheetName, cells, styles, colW, rowH, hideRows, hideCols, ...(Object.keys(rowLvl).length ? { rowLvl } : {}), ...(Object.keys(colLvl).length ? { colLvl } : {}), protect, ...(protectPw ? { protectPw } : {}), ...(filter ? { filter } : {}), ...(tab ? { tab } : {}), ...(noGrid ? { noGrid } : {}), ...(noHead ? { noHead } : {}), ...(noZero ? { noZero } : {}), ...(print ? { print } : {}), freeze, freezeCol, charts, ...(pics.length ? { pics } : {}), lists, rules, merges, rows: maxR + 1, cols: maxC + 1 };
  };

  // Tabelele cu nume (Tabel1[Suma]) din toate foile, citite înainte, ca formulele să le poată folosi de pe orice foaie.
  const tables: ExcelTable[] = [];
  // Aceleași tabele, pe foi, cu stilul lor: rămân tabele în Suite și se scriu înapoi la salvare.
  const ownTables = new Map<string, SheetTable[]>();
  for (const node of sheetsN.slice(0, MAX_IMPORT_SHEETS)) {
    const rel = wbRels.find((r) => r.attrs.Id === node.attrs.id);
    if (!rel || !/\/worksheet$/.test(rel.attrs.Type ?? '/worksheet')) continue;
    const sheetPath = resolve('xl/workbook.xml', rel.attrs.Target);
    for (const tr of (await relsOf(sheetPath)).filter((x) => /\/table$/.test(x.attrs.Type ?? ''))) {
      const xml = await text(resolve(sheetPath, tr.attrs.Target ?? ''));
      const t = xml ? find(parseXml(xml), 'table') : undefined;
      const [a, b] = (t?.attrs.ref ?? '').split(':').map((x) => cellPos(x));
      const name = t?.attrs.displayName ?? t?.attrs.name;
      if (!t || !a || !b || !name) continue;
      tables.push({
        name, sheet: (node.attrs.name ?? '').slice(0, 31).trim(), r0: a.r, c0: a.c, r1: b.r, c1: b.c,
        cols: kids(find(t, 'tableColumns'), 'tableColumn').map((c) => c.attrs.name ?? ''),
        head: t.attrs.headerRowCount === '0' ? 0 : 1, totals: Number(t.attrs.totalsRowCount ?? 0) > 0 ? 1 : 0,
      });
      const si = find(t, 'tableStyleInfo')?.attrs ?? {};
      const on = (v: string | undefined) => v === '1' || v === 'true';
      const totalsN = Number(t.attrs.totalsRowCount ?? 0) > 0 ? 1 : 0;
      // Rândul de total din .xlsx rămâne în celule (cu formulele lui), sub zona tabelului.
      const own: SheetTable = { name, r0: a.r, c0: a.c, r1: Math.max(a.r, b.r - totalsN), c1: b.c, theme: ownTableStyles.find((u) => u.label === si.name)?.id ?? themeFromStyle(si.name),
        opts: { head: t.attrs.headerRowCount !== '0', bandRows: si.name ? on(si.showRowStripes) : false, bandCols: on(si.showColumnStripes), firstCol: on(si.showFirstColumn), lastCol: on(si.showLastColumn), total: false, filter: !!find(t, 'autoFilter') },
        ...(!si.name ? { style: 'TableStyleNone' } : /^TableStyle[A-Za-z0-9]{1,20}$/.test(si.name) ? { style: si.name } : {}) };
      const key = (node.attrs.name ?? '').slice(0, 31).trim();
      if (validTableName(name) && (ownTables.get(key)?.length ?? 0) < 200) ownTables.set(key, [...(ownTables.get(key) ?? []), own]);
    }
  }

  let skipped = 0;
  const used = new Set<string>();
  const nameAt: (string | undefined)[] = []; // numele dat în Cyber Office Studio foii cu numărul acesta din Excel
  for (const node of sheetsN) {
    nameAt.push(undefined);
    if (out.length >= MAX_IMPORT_SHEETS) { skipped++; continue; }
    const rel = wbRels.find((r) => r.attrs.Id === node.attrs.id);
    const sheetPath = rel ? resolve('xl/workbook.xml', rel.attrs.Target) : `xl/worksheets/sheet${out.length + 1}.xml`;
    // Foaia care e doar un grafic (chartsheet): o foaie goală cu graficul pe ea, în colțul de sus (datele lui sunt pe altă foaie).
    const chartSheet = !!rel && /\/chartsheet$/.test(rel.attrs.Type ?? '');
    const sheetXml = rel && !chartSheet && !/\/worksheet$/.test(rel.attrs.Type ?? '/worksheet') ? null
      : chartSheet ? (await text(sheetPath))?.replace(/<(\/?)chartsheet\b/g, '<$1worksheet') ?? null : await text(sheetPath);
    if (!sheetXml) { skipped++; continue; }
    // Numele ca în Excel (cel mult 31 de caractere), fără două foi cu același nume.
    const base = (node.attrs.name ?? '').slice(0, 31).trim() || `Foaia ${out.length + 1}`;
    let name = base;
    for (let n = 2; used.has(name.toLocaleLowerCase('ro-RO')); n++) name = `${base.slice(0, 26)} (${n})`;
    used.add(name.toLocaleLowerCase('ro-RO'));
    const read = await readSheet(sheetPath, sheetXml, name);
    const own = ownTables.get(base);
    if (own?.length) {
      read.tables = own;
      // Stilul tabelului nu e scris în celule în .xlsx: capul colorat și rândurile alternate se pun aici (doar unde celula n-are fundal).
      if (own.length <= 50) for (const t of own) Object.assign(read.styles, tableLook(t, read.styles));
    }
    if (node.attrs.state === 'hidden' || node.attrs.state === 'veryHidden') read.hidden = true;
    out.push(read);
    nameAt[nameAt.length - 1] = name;
  }
  if (!out.length) throw new Error('Nu am găsit nicio foaie de calcul în fișierul .xlsx.');
  const names: DefinedName[] = [];
  const solverAt: Record<string, Record<string, string>> = {};
  for (const d of kids(find(wb, 'definedNames'), 'definedName')) {
    const name = d.attrs.name ?? '';
    // Modelul Rezolvitorului: nume ascunse, locale foii (solver_opt, solver_adj, solver_lhs1…).
    if (/^solver_\w+$/i.test(name) && d.attrs.localSheetId !== undefined) { (solverAt[d.attrs.localSheetId] ??= {})[name.toLowerCase()] = d.text.trim(); continue; }
    const ref = expandStructuredRefs(d.text.trim(), tables, -1, '');
    if (/^_xlnm\.Print_Area$/i.test(name) && d.attrs.localSheetId !== undefined) {
      // Zona de tipărit a foii: doar o zonă simplă („'Foaie'!$A$1:$F$30”).
      const target = out[Number(d.attrs.localSheetId)];
      const m = /!\$?([A-Z]{1,3})\$?(\d+):\$?([A-Z]{1,3})\$?(\d+)$/i.exec(ref);
      const area = m ? sqrefRange(`${m[1]}${m[2]}:${m[3]}${m[4]}`) : null;
      if (target && area && !ref.includes(',')) target.print = { ...target.print, area };
      continue;
    }
    if (/^_xlnm\.Print_Titles$/i.test(name) && d.attrs.localSheetId !== undefined) {
      // Rândurile repetate pe fiecare pagină („'Foaie'!$1:$3”, uneori și coloane: „'Foaie'!$A:$A,'Foaie'!$1:$3”).
      const target = out[Number(d.attrs.localSheetId)];
      const m = /!\$?(\d+):\$?(\d+)(?:,|$)/.exec(ref);
      const n = m ? Number(m[2]) - Number(m[1]) + 1 : 0;
      if (target && n >= 1) target.print = { ...target.print, head: true, headRows: Math.min(MAX_HEAD_ROWS, n) };
      // Coloanele repetate în stânga („$A:$B”); se repetă de la începutul zonei, deci contează câte sunt.
      const mc = /!\$?([A-Z]{1,3}):\$?([A-Z]{1,3})(?:,|$)/i.exec(ref);
      const nc = mc ? colIndex(mc[2].toUpperCase()) - colIndex(mc[1].toUpperCase()) + 1 : 0;
      if (target && nc >= 1) target.print = { ...target.print, leftCols: Math.min(MAX_LEFT_COLS, nc) };
      continue;
    }
    if (!name || !ref || /^_xlnm\./i.test(name) || d.attrs.hidden === '1' || names.length >= 5000) continue;
    const local = d.attrs.localSheetId === undefined ? undefined : nameAt[Number(d.attrs.localSheetId)];
    if (d.attrs.localSheetId !== undefined && local === undefined) continue; // numele unei foi care n-a fost adusă
    names.push(local === undefined ? { name, ref } : { name, ref, sheet: local });
  }
  for (const [k, list] of Object.entries(solverAt)) {
    const target = out[Number(k)], sv = solverFromNames(list);
    if (target && sv) target.solver = sv;
  }
  // Registrele externe ([1], [2]… din formule și nume): valorile lor păstrate în fișier (xl/externalLinks/externalLinkN.xml),
  // citite doar dacă o listă derulantă le folosește. Numărul registrului → numele foii (cu litere mici) → celula → valoarea.
  const extCache = new Map<number, Map<string, Map<string, string>> | null>();
  const extBook = async (n: number) => {
    if (extCache.has(n)) return extCache.get(n)!;
    let book: Map<string, Map<string, string>> | null = null;
    const rel = wbRels.find((r) => r.attrs.Id === extRefs[n - 1]?.attrs.id);
    const xml = rel?.attrs.Target ? await text(resolve('xl/workbook.xml', rel.attrs.Target)) : null;
    const eb = xml ? find(parseXml(xml), 'externalBook') : undefined;
    if (eb) {
      book = new Map();
      const sheetNames = kids(find(eb, 'sheetNames'), 'sheetName').map((x) => (x.attrs.val ?? '').toLowerCase());
      for (const sd of kids(find(eb, 'sheetDataSet'), 'sheetData')) {
        const vals = new Map<string, string>();
        for (const row of kids(sd, 'row')) for (const c of kids(row, 'cell')) {
          const v = kid(c, 'v')?.text;
          if (c.attrs.r && v) vals.set(c.attrs.r.toUpperCase(), v);
        }
        const nm = sheetNames[Number(sd.attrs.sheetId)];
        if (nm !== undefined) book.set(nm, vals);
      }
    }
    extCache.set(n, book);
    return book;
  };
  for (const pl of pendingLists) {
    let src = pl.src.replace(/^=/, '').trim();
    // Lista ia valorile dintr-un nume definit (=Judete): întâi numele foii, apoi cel al registrului.
    if (/^[A-Za-z_\\][\w.\\]*$/.test(src) && !cellPos(src.toUpperCase())) {
      const sheetName = out[pl.sheet]?.name, low = src.toLowerCase();
      const nm = names.find((x) => x.sheet === sheetName && x.name.toLowerCase() === low) ?? names.find((x) => x.sheet === undefined && x.name.toLowerCase() === low);
      if (!nm) continue;
      src = nm.ref.replace(/^=/, '').trim();
    }
    // O zonă dintr-un registru extern ([1]Coduri!$A$2:$A$90 sau '[1]Foaia mea'!A1:A9): valorile păstrate în fișier.
    const ext = /^(?:'\[(\d+)\]((?:[^']|'')+)'|\[(\d+)\]([^!$:']+))!\$?([A-Z]{1,3})\$?(\d+)(?::\$?([A-Z]{1,3})\$?(\d+))?$/i.exec(src);
    if (ext) {
      const vals = (await extBook(Number(ext[1] ?? ext[3])))?.get((ext[2]?.replace(/''/g, "'") ?? ext[4]).toLowerCase());
      const a = cellPos((ext[5] + ext[6]).toUpperCase());
      const b = cellPos(((ext[7] ?? ext[5]) + (ext[8] ?? ext[6])).toUpperCase());
      if (!vals || !a || !b) continue;
      const got: [number, number, string][] = [];
      for (const [ref, v] of vals) {
        const q = cellPos(ref);
        if (q && q.r >= Math.min(a.r, b.r) && q.r <= Math.max(a.r, b.r) && q.c >= Math.min(a.c, b.c) && q.c <= Math.max(a.c, b.c)) got.push([q.r, q.c, v]);
      }
      const values = parseValues(got.sort((x, y) => x[0] - y[0] || x[1] - y[1]).map((g) => g[2]).join('\n'));
      const target = out[pl.sheet];
      if (values.length && target && target.lists.length < MAX_LISTS) target.lists.push({ range: pl.range, values, ...pl.extra });
      continue;
    }
    const m = /^(?:(?:'((?:[^']|'')+)'|([^!$:']+))!)?\$?([A-Z]{1,3})\$?(\d+)(?::\$?([A-Z]{1,3})\$?(\d+))?$/i.exec(src);
    if (!m) continue;
    const name = m[1]?.replace(/''/g, "'") ?? m[2];
    const from = name ? out.find((x) => x.name.toLowerCase() === name.toLowerCase()) : out[pl.sheet];
    const a = cellPos(m[3] + m[4]);
    const b = cellPos((m[5] ?? m[3]) + (m[6] ?? m[4]));
    if (!from || !a || !b) continue;
    const vals: string[] = [];
    for (let r = Math.min(a.r, b.r); r <= Math.min(Math.max(a.r, b.r), lastUsedRow(from.cells)); r++) {
      for (let c = Math.min(a.c, b.c); c <= Math.min(Math.max(a.c, b.c), COLS - 1); c++) {
        const v = from.cells[cellId(r, c)];
        if (v && !v.startsWith('=')) vals.push(v);
      }
    }
    const values = parseValues(vals.join('\n'));
    const target = out[pl.sheet];
    if (values.length && target && target.lists.length < MAX_LISTS) target.lists.push({ range: pl.range, values, ...pl.extra });
  }
  // Formulele pe care Suite nu le poate calcula (funcții necunoscute) păstrează rezultatul din Excel.
  // Se verifică după ce sunt aduse toate foile, ca formulele care iau valori din alte foi să meargă.
  const asValuesSamples: string[] = [];
  // Tabelele pivot (foaie → pivotTable → pivotCacheDefinition), pentru GETPIVOTDATA. Pivotul în sine e deja în celule, ca valori.
  const pivots: PivotDef[] = [];
  for (const [i, node] of sheetsN.entries()) {
    const sheet = nameAt[i];
    const rel = wbRels.find((r) => r.attrs.Id === node.attrs.id);
    if (!sheet || !rel) continue;
    const sheetPath = resolve('xl/workbook.xml', rel.attrs.Target);
    for (const pr of (await relsOf(sheetPath)).filter((x) => /\/pivotTable$/.test(x.attrs.Type ?? ''))) {
      if (pivots.length >= 500) break;
      const ptPath = resolve(sheetPath, pr.attrs.Target ?? '');
      const ptXml = await text(ptPath);
      const pt = ptXml ? find(parseXml(ptXml), 'pivotTableDefinition') : undefined;
      const cRel = (await relsOf(ptPath)).find((x) => /\/pivotCacheDefinition$/.test(x.attrs.Type ?? ''));
      const cXml = cRel ? await text(resolve(ptPath, cRel.attrs.Target ?? '')) : null;
      const cache = cXml ? find(parseXml(cXml), 'pivotCacheDefinition') : undefined;
      const ws = cache && find(cache, 'worksheetSource');
      const target = pt && find(pt, 'location')?.attrs.ref;
      if (!pt || !cache || !ws || !target) continue;
      let source = '';
      if (ws.attrs.ref) {
        const from = ws.attrs.sheet ? out.find((x) => x.name.toLowerCase() === ws.attrs.sheet.slice(0, 31).trim().toLowerCase()) : out[i];
        if (from) source = sheetRef(from.name) + '!' + ws.attrs.ref;
      } else if (ws.attrs.name) source = expandStructuredRefs(ws.attrs.name + '[#All]', tables, -1, '') || ws.attrs.name;
      if (!source) continue;
      const cf = kids(find(cache, 'cacheFields'), 'cacheField');
      const fieldName = (x: string | undefined) => cf[Number(x)]?.attrs.name ?? '';
      // Elementele din cache, ca text (datele ca număr Excel, cum sunt în celule).
      const itemText = (k: number, x: number) => {
        const items = cf[k] && find(cf[k], 'sharedItems');
        const it = items?.kids[x];
        if (!it) return '';
        if (it.name === 'd') {
          const t = Date.parse((it.attrs.v ?? '') + (/Z|[+-]\d\d:\d\d$/.test(it.attrs.v ?? '') ? '' : 'Z'));
          return Number.isNaN(t) ? it.attrs.v ?? '' : formatNumber((t - Date.UTC(1899, 11, 30)) / 86400000);
        }
        return it.name === 'n' ? formatNumber(Number(it.attrs.v)) : it.attrs.v ?? '';
      };
      const fields = (tag: string) => kids(find(pt, tag), 'field').map((x) => fieldName(x.attrs.x)).filter(Boolean);
      const p: PivotDef = { sheet, target, source, rows: fields('rowFields'), cols: fields('colFields'), data: [] };
      for (const d of kids(find(pt, 'dataFields'), 'dataField')) {
        const field = fieldName(d.attrs.fld);
        if (field) p.data.push({ field, fn: d.attrs.subtotal ?? 'sum', ...(d.attrs.name ? { name: d.attrs.name } : {}) });
      }
      kids(find(pt, 'pivotFields'), 'pivotField').forEach((pf, k) => {
        const name = cf[k]?.attrs.name;
        if (!name) return;
        const hidden = kids(find(pf, 'items'), 'item').filter((it) => it.attrs.h === '1' && it.attrs.x !== undefined).map((it) => itemText(k, Number(it.attrs.x)));
        if (hidden.length) (p.hide ??= {})[name] = hidden;
      });
      for (const pg of kids(find(pt, 'pageFields'), 'pageField')) {
        const k = Number(pg.attrs.fld);
        if (pg.attrs.item !== undefined && cf[k]) (p.page ??= {})[cf[k].attrs.name ?? ''] = itemText(k, Number(pg.attrs.item));
      }
      if (p.data.length) pivots.push(p);
    }
  }
  for (const nm of names) nm.ref = extFromExcel(nm.ref, extName, extUsed);
  const links: ExtBook[] = [];
  for (const n of [...extUsed].sort((a, b) => a - b).slice(0, MAX_LINKS)) {
    const rel = wbRels.find((r) => r.attrs.Id === extRefs[n - 1]?.attrs.id);
    const xml = rel?.attrs.Target ? await text(resolve('xl/workbook.xml', rel.attrs.Target)) : null;
    const eb = xml ? find(parseXml(xml), 'externalBook') : undefined;
    if (!eb) continue;
    const names2 = kids(find(eb, 'sheetNames'), 'sheetName').map((x) => x.attrs.val ?? '');
    const sheets = names2.map((name) => ({ name, cells: {} as Record<string, string> }));
    for (const sd of kids(find(eb, 'sheetDataSet'), 'sheetData')) {
      const sh = sheets[Number(sd.attrs.sheetId)];
      if (!sh) continue;
      for (const row of kids(sd, 'row')) for (const c of kids(row, 'cell')) {
        const v = kid(c, 'v')?.text, id = c.attrs.r?.toUpperCase();
        if (!id || v === undefined || v === '' || !cellPos(id)) continue;
        const t = c.attrs.t;
        sh.cells[id] = t === 'str' || t === 's' ? keepText(v) : t === 'b' ? (v === '1' ? 'ADEVĂRAT' : 'FALS') : t === 'e' ? v : Number.isFinite(Number(v)) ? formatNumber(Number(v)) : keepText(v);
      }
    }
    const f = extFile(n);
    links.push({ name: f.name, ...(f.path && f.path !== f.name ? { path: f.path } : {}), sheets });
  }
  asValues += keepCachedResults(out, cachedBy, names, (v) => v.startsWith('#'), asValuesSamples, pivots, undefined, links);
  if (out.every((s) => s.hidden)) delete out[0].hidden;
  const tab = Number(find(wb, 'workbookView')?.attrs.activeTab ?? 0);
  const coreTxt = await text('docProps/core.xml');
  const props0 = coreTxt ? propsFromCore(coreTxt) : undefined;
  const label = labelFromCustom(await text('docProps/custom.xml'));
  const props = label ? { ...(props0 ?? {}), label } : props0;
  const signers = await officeSigners(zip).catch(() => undefined);
  return { ...(props ? { props } : {}), ...(signers ? { signers } : {}), sheets: out, active: Number.isInteger(tab) && tab >= 0 && tab < out.length ? tab : 0, cut, asValues, asValuesSamples, chartsSkipped, ...(picsSkipped ? { picsSkipped } : {}), skipped, repaired: isRepaired(zip), names,
    ...(pivots.length ? { pivots } : {}), ...(find(wb, 'calcPr')?.attrs.calcMode === 'manual' ? { calc: 'manual' as const } : {}), ...iterOf(find(wb, 'calcPr')?.attrs), ...(bookLockFrom(find(wb, 'workbookProtection')?.attrs) ? { lockBook: bookLockFrom(find(wb, 'workbookProtection')?.attrs) } : {}), ...(userStyles.length ? { cellStyles: userStyles } : {}), ...(bookTheme ? { theme: bookTheme } : {}), ...(ownTableStyles.length ? { tableStyles: ownTableStyles } : {}),
    ...(links.length ? { links } : {}) };
}

/** calcPr iterate="1" iterateCount="100" iterateDelta="0.001" → setările calculului iterativ. */
function iterOf(a: Record<string, string> | undefined): { iter?: { max: number; delta: number } } {
  if (!a || !/^(1|true|on)$/i.test(a.iterate ?? '')) return {};
  const m = Number(a.iterateCount), d = Number(a.iterateDelta);
  return { iter: { max: Number.isFinite(m) && m >= 1 ? Math.min(32767, Math.round(m)) : 100, delta: Number.isFinite(d) && d >= 0 ? d : 0.001 } };
}

/** O valoare logică scrisă în celulă (ca în Excel, și în română). */
const BOOL_RE = /^(TRUE|FALSE|ADEV[ĂA]RAT|FALS)$/i;

// ---------- Tipărire ----------

const PAPER_CODES: Record<string, PrintPaper> = { 1: 'Letter', 5: 'Legal', 8: 'A3', 9: 'A4', 11: 'A5' };

/** Setările de tipărire ale unei foi .xlsx (pageSetup, pageMargins, printOptions, headerFooter). */
function printFrom(ws: XNode): SheetPrint | undefined {
  const p: SheetPrint = {};
  const ps = find(ws, 'pageSetup')?.attrs;
  if (ps?.orientation === 'landscape') p.landscape = true;
  const paper = ps?.paperSize ? PAPER_CODES[ps.paperSize] : undefined;
  if (paper && paper !== 'A4') p.paper = paper;
  // Mărimea la tipărire (scale="80" = 80%), doar când foaia nu e „potrivită pe pagină” (fitToPage).
  const fitToPage = find(find(ws, 'sheetPr') ?? ws, 'pageSetUpPr')?.attrs.fitToPage;
  // „Potrivește pe pagină” cu o pagină pe lățime și una pe înălțime (lipsa atributelor înseamnă 1): totul pe o singură pagină.
  if ((fitToPage === '1' || fitToPage === 'true') && (ps?.fitToWidth ?? '1') === '1' && (ps?.fitToHeight ?? '1') === '1') p.onePage = true;
  const pct = Number(ps?.scale);
  if (fitToPage !== '1' && fitToPage !== 'true' && Number.isInteger(pct) && pct !== 100 && pct >= MIN_PRINT_SCALE && pct <= MAX_PRINT_SCALE) {
    p.fit = false;
    p.scale = pct;
  }
  const po = find(ws, 'printOptions')?.attrs;
  if (po) p.grid = po.gridLines === '1' || po.gridLines === 'true';
  if (po?.headings === '1' || po?.headings === 'true') p.headings = true;
  const pm = find(ws, 'pageMargins')?.attrs;
  if (pm) {
    const mm = ((Number(pm.left) || 0) + (Number(pm.right) || 0)) / 2 * 25.4;
    if (mm > 0) p.margin = mm < 9 ? 'narrow' : mm > 20 ? 'wide' : 'normal';
  }
  const hf = find(ws, 'headerFooter');
  if (hf) {
    const head = fromExcelHF(find(hf, 'oddHeader')?.text ?? '');
    const foot = fromExcelHF(find(hf, 'oddFooter')?.text ?? '');
    if (head.text) p.header = head.text;
    if (foot.text) p.footer = foot.text;
    if (head.numbers || foot.numbers) p.numbers = true;
  }
  // Sfârșiturile de pagină puse de mână: <brk id="10"/> = pagina nouă începe după rândul 10 (rândul 11, adică 10 de la 0).
  const rb = find(ws, 'rowBreaks');
  if (rb) {
    const b = rb.kids.filter((c) => c.name === 'brk' && c.attrs.man !== '0').map((c) => Number(c.attrs.id)).filter((x) => Number.isInteger(x) && x > 0);
    if (b.length) p.breaks = [...new Set(b)].sort((a, z) => a - z);
  }
  // Pe coloane: <brk id="3"/> = pagina alăturată nouă începe cu coloana D (3 de la 0).
  const cb = find(ws, 'colBreaks');
  if (cb) {
    const b = cb.kids.filter((c) => c.name === 'brk' && c.attrs.man !== '0').map((c) => Number(c.attrs.id)).filter((x) => Number.isInteger(x) && x > 0 && x < COLS);
    if (b.length) p.colBreaks = [...new Set(b)].sort((a, z) => a - z);
  }
  return Object.keys(p).length ? p : undefined;
}

/** Numerele scrise ca text cu „Ignorare eroare”: <ignoredErrors> (după sfârșiturile de pagină, înaintea desenului). */
function ignoredXml(sheet: Sheet): string {
  const ids = Object.keys(sheet.styles).filter((id) => sheet.styles[id]?.ign && sheet.cells[id]?.startsWith("'") && isNumber(sheet.cells[id].slice(1)));
  return ids.length ? `<ignoredErrors><ignoredError sqref="${ids.slice(0, 5000).join(' ')}" numberStoredAsText="1"/></ignoredErrors>` : '';
}

/** Setările de tipărire ale foii, ca elemente .xlsx (în ordinea cerută de format). */
export function printXml(p: SheetPrint | undefined): string {
  if (!p) return '';
  const mIn = ((MARGINS[p.margin as PrintMargin] ?? MARGINS.normal) / 25.4).toFixed(2);
  const code = Object.entries(PAPER_CODES).find(([, v]) => v === (p.paper ?? 'A4'))?.[0] ?? '9';
  const head = toExcelHF(p.header);
  const foot = toExcelHF(p.footer, p.numbers === true);
  return `<printOptions${p.headings ? ' headings="1"' : ''} gridLines="${p.grid ? 1 : 0}"/>`
    + `<pageMargins left="${mIn}" right="${mIn}" top="${mIn}" bottom="${mIn}" header="0.3" footer="0.3"/>`
    + `<pageSetup paperSize="${code}" orientation="${p.landscape ? 'landscape' : 'portrait'}"${p.fit !== false ? ` fitToWidth="1" fitToHeight="${p.onePage ? 1 : 0}"` : p.scale && p.scale !== 100 ? ` scale="${p.scale}"` : ''}/>`
    + (head || foot ? `<headerFooter>${head ? `<oddHeader>${escapeXml(head)}</oddHeader>` : ''}${foot ? `<oddFooter>${escapeXml(foot)}</oddFooter>` : ''}</headerFooter>` : '')
    + (p.breaks?.length ? `<rowBreaks count="${p.breaks.length}" manualBreakCount="${p.breaks.length}">${p.breaks.map((r) => `<brk id="${r}" max="16383" man="1"/>`).join('')}</rowBreaks>` : '')
    + (p.colBreaks?.length ? `<colBreaks count="${p.colBreaks.length}" manualBreakCount="${p.colBreaks.length}">${p.colBreaks.map((c) => `<brk id="${c}" max="1048575" man="1"/>`).join('')}</colBreaks>` : '');
}

/** Zonele de tipărit ale foilor, ca nume interne Excel (_xlnm.Print_Area, legate de foaie). */
function printAreas(sheets: Sheet[], excelNames: string[]): DefinedName[] {
  const out: DefinedName[] = [];
  sheets.forEach((sh, i) => {
    const g = sh.print?.area ? parseRangeText(sh.print.area) : null;
    if (!g) return;
    const abs = (r: number, c: number) => `$${colName(c)}$${r + 1}`;
    out.push({ name: '_xlnm.Print_Area', ref: `${sheetRef(excelNames[i])}!${abs(g.r0, g.c0)}:${abs(g.r1, g.c1)}`, sheet: sh.name });
  });
  // Rândurile repetate pe fiecare pagină, când sunt mai multe (unul singur e felul nostru obișnuit, nu se scrie), și coloanele repetate.
  sheets.forEach((sh, i) => {
    const n = sh.print?.head === false ? 0 : sh.print?.headRows ?? 1;
    const nc = sh.print?.leftCols ?? 0;
    if (n < 2 && nc < 1) return;
    const g = sh.print?.area ? parseRangeText(sh.print.area) : null;
    const r0 = (g?.r0 ?? 0) + 1, c0 = g?.c0 ?? 0;
    // Coloanele repetate în stânga (de la începutul zonei) și rândurile repetate sus, despărțite de virgulă.
    const parts: string[] = [];
    if (nc >= 1) parts.push(`${sheetRef(excelNames[i])}!$${colName(c0)}:$${colName(c0 + nc - 1)}`);
    if (n >= 2) parts.push(`${sheetRef(excelNames[i])}!$${r0}:$${r0 + n - 1}`);
    out.push({ name: '_xlnm.Print_Titles', ref: parts.join(','), sheet: sh.name });
  });
  return out;
}

// ---------- Export ----------

/** O zonă din Excel („B2”, „B2:B1048576”) tăiată la mărimea tabelului nostru, ca „B2:B200”; null dacă e în afara lui. */
function sqrefRange(ref: string): string | null {
  const [p, q] = ref.split(':');
  const a = p ? cellPos(p) : null;
  const b = q ? cellPos(q) : a;
  if (!a || !b) return null;
  const r0 = Math.min(a.r, b.r);
  const c0 = Math.min(a.c, b.c);
  if (r0 >= ROWS || c0 >= COLS) return null;
  return `${cellId(r0, c0)}:${cellId(Math.min(Math.max(a.r, b.r), ROWS - 1), Math.min(Math.max(a.c, b.c), COLS - 1))}`;
}

/**
 * Listele derulante ale foii, ca validări Excel. Excel ține valorile într-un text de cel mult 255 de caractere,
 * separate prin virgulă, deci listele cu virgule în valori sau prea lungi nu se pot scrie (le sărim).
 */
export function listsXml(lists: SheetList[]): string {
  const items: string[] = [];
  for (const l of lists) {
    // Verificarea CNP/CUI/IBAN nu există în Excel, deci zonele acelea nu primesc validare acolo.
    if (l.kind) continue;
    const msgs = validationMsgXml(l);
    if (l.rule?.type === 'custom') {
      items.push(`<dataValidation type="custom" allowBlank="1"${msgs} sqref="${l.range}"><formula1>${escapeXml(toExcelFormula('=' + (l.rule.f ?? '')).replace(/^=/, ''))}</formula1></dataValidation>`);
    } else if (l.rule) {
      const op = OP_XLSX[l.rule.op];
      const two = l.rule.op === 'between' || l.rule.op === 'notBetween';
      items.push(`<dataValidation type="${l.rule.type === 'length' ? 'textLength' : l.rule.type}"${op === 'between' ? '' : ` operator="${op}"`} allowBlank="1"${msgs} sqref="${l.range}">`
        + `<formula1>${l.rule.a}</formula1>${two ? `<formula2>${l.rule.b ?? l.rule.a}</formula2>` : ''}</dataValidation>`);
    } else if (l.values.length) {
      if (l.values.some((v) => v.includes(',')) || l.values.join(',').length > 255) continue;
      items.push(`<dataValidation type="list" allowBlank="1"${msgs} sqref="${l.range}">`
        + `<formula1>${escapeXml('"' + l.values.join(',').replace(/"/g, '""') + '"')}</formula1></dataValidation>`);
    } else if (l.prompt) {
      items.push(`<dataValidation allowBlank="1"${msgs} sqref="${l.range}"/>`);
    }
  }
  return items.length ? `<dataValidations count="${items.length}">${items.join('')}</dataValidations>` : '';
}

const OP_XLSX: Record<RuleOp, string> = {
  between: 'between', notBetween: 'notBetween', eq: 'equal', ne: 'notEqual', gt: 'greaterThan', lt: 'lessThan', ge: 'greaterThanOrEqual', le: 'lessThanOrEqual',
};
const TYPE_XLSX: Record<string, RuleType> = { whole: 'whole', decimal: 'decimal', date: 'date', textLength: 'length' };

/** Mesajul la selectare și mesajul de eroare ca atribute Excel. */
function validationMsgXml(l: SheetList): string {
  let s = '';
  if (l.prompt) s += ` showInputMessage="1"${l.prompt.title ? ` promptTitle="${escapeXml(l.prompt.title)}"` : ''} prompt="${escapeXml(l.prompt.text)}"`;
  if (l.rule || l.values.length) {
    const e = l.error;
    // „Informare” fără text = Excel nu arată nimic (showErrorMessage lipsă); altfel mesajul cu stilul lui.
    if (!(e?.style === 'info' && !e.text && !e.title)) {
      s += ' showErrorMessage="1"';
      if (e?.style === 'warning') s += ' errorStyle="warning"';
      if (e?.style === 'info') s += ' errorStyle="information"';
      if (e?.title) s += ` errorTitle="${escapeXml(e.title)}"`;
      if (e?.text) s += ` error="${escapeXml(e.text)}"`;
    }
  }
  return s;
}

/** Regula și mesajele unei validări din Excel (formulele cu referințe la celule nu se pot păstra ca regulă). */
function validationExtra(a: Record<string, string>, type: string, f1: string, f2: string): Partial<SheetList> {
  const rt = TYPE_XLSX[type];
  const op = (Object.keys(OP_XLSX) as RuleOp[]).find((k) => OP_XLSX[k] === (a.operator ?? 'between')) ?? 'between';
  const n1 = /^[-+]?\d+(\.\d+)?$/.test(f1) ? Number(f1) : NaN;
  const n2 = /^[-+]?\d+(\.\d+)?$/.test(f2) ? Number(f2) : NaN;
  const two = op === 'between' || op === 'notBetween';
  const rule = type === 'custom' && f1 ? { type: 'custom', op: 'between', a: 0, f: fromExcelFormula(f1).replace(/^=/, '') }
    : rt && Number.isFinite(n1) && (!two || Number.isFinite(n2)) ? { type: rt, op, a: n1, ...(two ? { b: n2 } : {}) } : undefined;
  const prompt = a.showInputMessage === '1' && a.prompt ? { text: a.prompt, title: a.promptTitle } : undefined;
  const error = a.showErrorMessage !== '1'
    ? { style: 'info' }
    : { style: a.errorStyle === 'warning' ? 'warning' : a.errorStyle === 'information' ? 'info' : 'stop', title: a.errorTitle, text: a.error };
  return cleanExtra(rule, prompt, error);
}

// ---------- Formatare condiționată ----------

const LOOK_ORDER = Object.keys(COND_LOOKS) as CondLook[];
const CF_OPS: Partial<Record<CondOp, string>> = {
  gt: 'greaterThan', lt: 'lessThan', ge: 'greaterThanOrEqual', le: 'lessThanOrEqual', eq: 'equal', ne: 'notEqual', between: 'between',
};

/**
 * Stilurile evidențierii, ca „dxf” Excel (în ordinea din COND_LOOKS; dxfId = poziția), apoi culorile filtrelor după culoare
 * (dxfId = LOOK_ORDER.length + poziția lor în `colors`).
 */
function dxfsXml(colors: FilterColor[] = [], extra: string[] = []): string {
  const argb = (c: string) => 'FF' + c.slice(1).toUpperCase();
  const items = LOOK_ORDER.map((k) => {
    const st = COND_LOOKS[k].style;
    return '<dxf><font>' + (st.b ? '<b/>' : '') + (st.color ? `<color rgb="${argb(st.color)}"/>` : '') + '</font>'
      + (st.bg ? `<fill><patternFill><bgColor rgb="${argb(st.bg)}"/></patternFill></fill>` : '') + '</dxf>';
  });
  for (const fc of colors) {
    if (fc.kind === 'fg') items.push(fc.color === 'none' ? '<dxf><font/></dxf>' : `<dxf><font><color rgb="${argb(fc.color)}"/></font></dxf>`);
    else items.push(fc.color === 'none' ? '<dxf><fill><patternFill/></fill></dxf>'
      : `<dxf><fill><patternFill patternType="solid"><fgColor rgb="${argb(fc.color)}"/><bgColor rgb="${argb(fc.color)}"/></patternFill></fill></dxf>`);
  }
  items.push(...extra);
  return `<dxfs count="${items.length}">${items.join('')}</dxfs>`;
}

/**
 * Un stil de tabel propriu ca <tableStyle> din styles.xml: câte un dxf pentru tot tabelul (fundal și linii), cap, prima dungă
 * de rânduri și rândul de total. `dxf0` = primul dxfId liber. Întoarce dxf-urile și elementul tableStyle.
 */
export function customTableStyleXml(th: CustomTableLook, dxf0: number): { dxfs: string[]; xml: string } {
  const argb = (c: string) => 'FF' + c.slice(1).toUpperCase();
  const fill = (c?: string) => (c ? `<fill><patternFill patternType="solid"><fgColor rgb="${argb(c)}"/><bgColor rgb="${argb(c)}"/></patternFill></fill>` : '');
  const side = (n: string) => `<${n} style="thin"><color rgb="${argb(th.line!)}"/></${n}>`;
  const border = th.line && th.grid ? `<border>${side('left')}${side('right')}${side('top')}${side('bottom')}${th.grid === 'all' ? side('vertical') : ''}${side('horizontal')}</border>` : '';
  const parts: [string, string][] = [];
  if (th.body || border) parts.push(['wholeTable', '<dxf>' + fill(th.body) + border + '</dxf>']);
  if (th.head || th.ink || th.line) parts.push(['headerRow', '<dxf><font><b/>' + (th.ink ? `<color rgb="${argb(th.ink)}"/>` : '') + '</font>' + fill(th.head)
    + (!th.grid && th.line ? `<border><bottom style="thin"><color rgb="${argb(th.line)}"/></bottom></border>` : '') + '</dxf>']);
  if (th.band) parts.push(['firstRowStripe', '<dxf>' + fill(th.band) + '</dxf>']);
  if (th.total || th.line) parts.push(['totalRow', '<dxf><font><b/></font>' + fill(th.total)
    + (!th.grid && th.line ? `<border><top style="thin"><color rgb="${argb(th.line)}"/></top></border>` : '') + '</dxf>']);
  return { dxfs: parts.map((p) => p[1]),
    xml: `<tableStyle name="${escapeXml(th.label)}" pivot="0" count="${parts.length}">${parts.map((p, i) => `<tableStyleElement type="${p[0]}" dxfId="${dxf0 + i}"/>`).join('')}</tableStyle>` };
}

/** O valoare din regulă ca formulă Excel: număr (cu punct) sau text între ghilimele. */
function cfValue(v: string): string {
  return isNumber(v) ? String(Number(v.trim().replace(',', '.'))) : `"${v.replace(/"/g, '""')}"`;
}

/** Minigraficele foii ca extensia x14:sparklineGroups (un grup pe minigrafic), la sfârșitul foii. */
/** Scenariile foii: <scenarios> cu câte un <scenario> și celulele lui (<inputCells r="B1" val="12"/>), după <sheetProtection>. */
export function scenariosXml(list: SheetScenario[] | undefined): string {
  if (!list?.length) return '';
  return `<scenarios current="0">${list.map((s) => {
    const ids = Object.keys(s.cells);
    return `<scenario name="${escapeXml(s.name)}" count="${ids.length}"${s.note ? ` comment="${escapeXml(s.note)}"` : ''}>`
      + ids.map((id) => `<inputCells r="${id}" val="${escapeXml(xNum(s.cells[id]))}"/>`).join('') + '</scenario>';
  }).join('')}</scenarios>`;
}
function scenariosFrom(n: XNode | undefined): SheetScenario[] {
  if (!n) return [];
  return cleanScenarios(n.kids.filter((k) => k.name === 'scenario').map((s) => ({
    name: s.attrs.name ?? '',
    ...(s.attrs.comment ? { note: s.attrs.comment } : {}),
    cells: Object.fromEntries(s.kids.filter((k) => k.name === 'inputCells' && k.attrs.r).map((k) => [k.attrs.r.replace(/[$]/g, '').toUpperCase(), k.attrs.val ?? ''])),
  })));
}

function sparksXml(list: SheetSpark[] | undefined, sheetName: string): string {
  if (!list?.length) return '';
  const q = "'" + sheetName.split("'").join("''") + "'";
  const groups = list.map((s) => {
    const col = 'FF' + (s.color ?? '#2f6fdf').slice(1).toUpperCase(), neg = 'FFD93025';
    const type = s.kind === 'col' ? ' type="column"' : s.kind === 'winloss' ? ' type="stacked"' : '';
    const marks = s.kind === 'line' ? ' high="1" low="1"' : ' negative="1"';
    return `<x14:sparklineGroup${type} displayEmptyCellsAs="gap"${marks}><x14:colorSeries rgb="${col}"/><x14:colorNegative rgb="${neg}"/><x14:colorAxis rgb="FF000000"/>`
      + `<x14:colorMarkers rgb="${col}"/><x14:colorFirst rgb="${col}"/><x14:colorLast rgb="${col}"/><x14:colorHigh rgb="${col}"/><x14:colorLow rgb="${neg}"/>`
      + `<x14:sparklines><x14:sparkline><xm:f>${escapeXml(q + '!' + s.range)}</xm:f><xm:sqref>${s.at}</xm:sqref></x14:sparkline></x14:sparklines></x14:sparklineGroup>`;
  });
  return '<extLst><ext uri="{05C60535-1F16-4fd2-B633-F4F36F0B64E0}" xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main">'
    + '<x14:sparklineGroups xmlns:xm="http://schemas.microsoft.com/office/excel/2006/main">' + groups.join('') + '</x14:sparklineGroups></ext></extLst>';
}

/** Minigraficele citite din foaie: doar cele cu datele pe aceeași foaie (cele care iau date din altă foaie se sar). */
function sparksFrom(ws: XNode, sheetName: string): SheetSpark[] {
  const groups: XNode[] = [];
  const walk = (n: XNode) => { for (const k of n.kids) { if (k.name === 'sparklineGroup') groups.push(k); else if (groups.length < 500) walk(k); } };
  walk(ws);
  const raw: Partial<SheetSpark>[] = [];
  for (const g of groups) {
    const kind: SparkKind = g.attrs.type === 'column' ? 'col' : g.attrs.type === 'stacked' ? 'winloss' : 'line';
    const rgb = kid(g, 'colorSeries')?.attrs.rgb;
    const color = rgb && /^[0-9a-f]{8}$/i.test(rgb) ? '#' + rgb.slice(2).toLowerCase() : undefined;
    for (const s of kids(kid(g, 'sparklines'), 'sparkline')) {
      const f = (kid(s, 'f')?.text ?? '').trim(), at = (kid(s, 'sqref')?.text ?? '').trim();
      const i = f.lastIndexOf('!');
      const sh = i >= 0 ? f.slice(0, i).replace(/^'|'$/g, '').split("''").join("'") : sheetName;
      if (sh.toLowerCase() !== sheetName.toLowerCase()) continue;
      raw.push({ at, range: f.slice(i + 1), kind, ...(color ? { color } : {}) });
    }
  }
  return cleanSparks(raw);
}

/** Regulile foii ca <conditionalFormatting>. Regula pusă ultima are prioritatea cea mai mare, ca în Suite. */
export function rulesXml(all: SheetRule[]): string {
  const rules = all.filter((r) => !suiteOnly(r.op));
  return rules.map((r, i) => {
    const dxf = LOOK_ORDER.indexOf(r.look);
    const pri = rules.length - i;
    const tl = r.range.split(':')[0];
    let rule: string;
    if (r.op === 'icons') {
      const set = ICON_SETS[r.look].xlsx;
      rule = `<cfRule type="iconSet" priority="${pri}"><iconSet${set === '3TrafficLights1' ? '' : ` iconSet="${set}"`}>`
        + '<cfvo type="percent" val="0"/><cfvo type="percent" val="33"/><cfvo type="percent" val="67"/></iconSet></cfRule>';
    } else if (r.op === 'scale') {
      const cs = SCALES[r.look].colors;
      rule = `<cfRule type="colorScale" priority="${pri}"><colorScale><cfvo type="min"/>${cs.length === 3 ? '<cfvo type="percentile" val="50"/>' : ''}<cfvo type="max"/>`
        + cs.map((c) => `<color rgb="FF${c.slice(1).toUpperCase()}"/>`).join('') + '</colorScale></cfRule>';
    } else if (r.op === 'databar') {
      rule = `<cfRule type="dataBar" priority="${pri}"><dataBar><cfvo type="min"/><cfvo type="max"/>`
        + `<color rgb="FF${BAR_COLORS[r.look].slice(1).toUpperCase()}"/></dataBar></cfRule>`;
    } else if (r.op === 'formula') {
      rule = `<cfRule type="expression" dxfId="${dxf}" priority="${pri}"><formula>${escapeXml(toExcelFormula(r.v1.trim().startsWith('=') ? r.v1.trim() : '=' + r.v1.trim()))}</formula></cfRule>`;
    } else if (r.op === 'text') {
      const t = escapeXml(r.v1);
      rule = `<cfRule type="containsText" dxfId="${dxf}" priority="${pri}" operator="containsText" text="${t}">`
        + `<formula>${escapeXml(`NOT(ISERROR(SEARCH("${r.v1.replace(/"/g, '""')}",${tl})))`)}</formula></cfRule>`;
    } else if (r.op === 'top' || r.op === 'bottom') {
      rule = `<cfRule type="top10" dxfId="${dxf}" priority="${pri}" rank="${topCount(r.v1)}"${r.op === 'bottom' ? ' bottom="1"' : ''}/>`;
    } else if (r.op === 'above' || r.op === 'below') {
      rule = `<cfRule type="aboveAverage" dxfId="${dxf}" priority="${pri}"${r.op === 'below' ? ' aboveAverage="0"' : ''}/>`;
    } else if (r.op === 'dup' || r.op === 'unique') {
      rule = `<cfRule type="${r.op === 'dup' ? 'duplicateValues' : 'uniqueValues'}" dxfId="${dxf}" priority="${pri}"/>`;
    } else if (r.op === 'empty' || r.op === 'filled') {
      rule = `<cfRule type="${r.op === 'empty' ? 'containsBlanks' : 'notContainsBlanks'}" dxfId="${dxf}" priority="${pri}">`
        + `<formula>${escapeXml(`LEN(TRIM(${tl}))${r.op === 'empty' ? '=' : '>'}0`)}</formula></cfRule>`;
    } else {
      rule = `<cfRule type="cellIs" dxfId="${dxf}" priority="${pri}" operator="${CF_OPS[r.op]}">`
        + `<formula>${escapeXml(cfValue(r.v1))}</formula>`
        + (r.op === 'between' ? `<formula>${escapeXml(cfValue(r.v2 ?? ''))}</formula>` : '')
        + '</cfRule>';
    }
    return `<conditionalFormatting sqref="${r.range}">${rule}</conditionalFormatting>`;
  }).join('');
}

/** Culorile fiecărui „dxf” din Excel, pentru filtrele după culoare („none” când dxf-ul nu are culoare). */
/**
 * Stilurile de tabel proprii din styles.xml (<tableStyles>, fără cele pentru tabele pivot): culorile din dxf-urile lor
 * (tot tabelul = fundal și linii, cap, prima dungă, total), puse în lista stilurilor noastre.
 */
export function readTableStyles(xml: string | null): CustomTableStyle[] {
  if (!xml) return [];
  const doc = parseXml(xml);
  const dx = kids(find(doc, 'dxfs'), 'dxf');
  const hex = (n: XNode | undefined) => { const v = n?.attrs.rgb; return v && /^[0-9a-f]{6,8}$/i.test(v) ? '#' + v.slice(-6).toLowerCase() : undefined; };
  const bgOf = (d?: XNode) => { const p = kid(kid(d, 'fill'), 'patternFill'); return p ? (p.attrs.patternType === 'solid' ? hex(kid(p, 'fgColor')) ?? hex(kid(p, 'bgColor')) : hex(kid(p, 'bgColor')) ?? hex(kid(p, 'fgColor'))) : undefined; };
  const raw: unknown[] = [];
  for (const ts of kids(find(doc, 'tableStyles'), 'tableStyle')) {
    if (!ts.attrs.name || ts.attrs.table === '0') continue;
    const el = (type: string) => { const e = kids(ts, 'tableStyleElement').find((x) => x.attrs.type === type); return e ? dx[Number(e.attrs.dxfId)] : undefined; };
    const whole = el('wholeTable'), head = el('headerRow'), band = el('firstRowStripe'), total = el('totalRow');
    const bd = kid(whole, 'border') ?? kid(head, 'border');
    const line = bd ? ['horizontal', 'bottom', 'top', 'left'].map((n) => hex(kid(kid(bd, n), 'color'))).find(Boolean) : undefined;
    const grid = kid(whole, 'border') ? (kid(kid(whole, 'border'), 'vertical') ? 'all' : 'rows') : undefined;
    raw.push({ label: ts.attrs.name, head: bgOf(head) ?? '', ink: hex(kid(kid(head, 'font'), 'color')), band: bgOf(band) ?? '', body: bgOf(whole), total: bgOf(total) ?? '', line, grid });
  }
  return cleanTableStyles(raw);
}

function readDxfColors(xml: string | null): { bg: string; fg: string }[] {
  if (!xml) return [];
  const hex = (n: XNode | undefined) => {
    const v = n?.attrs.rgb;
    return v && /^[0-9a-f]{6,8}$/i.test(v) ? '#' + v.slice(-6).toLowerCase() : undefined;
  };
  return kids(find(parseXml(xml), 'dxfs'), 'dxf').map((d) => {
    const p = kid(kid(d, 'fill'), 'patternFill');
    // La umplerea plină, culoarea se vede în fgColor; Excel scrie adesea aceeași culoare și în bgColor.
    const bg = (p?.attrs.patternType === 'solid' ? hex(kid(p, 'fgColor')) ?? hex(kid(p, 'bgColor')) : hex(kid(p, 'bgColor')) ?? hex(kid(p, 'fgColor'))) ?? 'none';
    const fg = hex(kid(kid(d, 'font'), 'color')) ?? 'none';
    return { bg: bg === '#ffffff' ? 'none' : bg, fg: fg === '#000000' ? 'none' : fg };
  });
}

/** Pentru fiecare „dxf” din Excel, stilul nostru cel mai apropiat (după culoarea fundalului sau a textului). */
function readDxfLooks(xml: string | null): CondLook[] {
  if (!xml) return [];
  const hex = (n: XNode | undefined) => {
    const v = n?.attrs.rgb;
    return v && /^[0-9a-f]{6,8}$/i.test(v) ? v.slice(-6).toLowerCase() : undefined;
  };
  const dist = (a: string, b: string) => [0, 2, 4].reduce((s, i) => s + (parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i + 1, i + 3), 16)) ** 2, 0);
  return kids(find(parseXml(xml), 'dxfs'), 'dxf').map((d) => {
    const p = kid(kid(d, 'fill'), 'patternFill');
    const bg = hex(kid(p, 'bgColor')) ?? hex(kid(p, 'fgColor'));
    const fg = hex(kid(kid(d, 'font'), 'color'));
    const withBg = LOOK_ORDER.filter((k) => COND_LOOKS[k].style.bg);
    if (bg) return withBg.reduce((best, k) => (dist(bg, COND_LOOKS[k].style.bg!) < dist(bg, COND_LOOKS[best].style.bg!) ? k : best), withBg[0]);
    if (fg) return LOOK_ORDER.reduce((best, k) => (dist(fg, COND_LOOKS[k].style.color!) < dist(fg, COND_LOOKS[best].style.color!) ? k : best), LOOK_ORDER[0]);
    return 'yellow';
  });
}

/** O regulă Excel → regula noastră, sau null dacă e de un fel pe care nu-l avem (bare de date, scale de culori…). */
function ruleFromXml(x: XNode, range: string, looks: CondLook[]): SheetRule | null {
  const look = looks[Number(x.attrs.dxfId)] ?? 'yellow';
  const fs = kids(x, 'formula').map((f) => f.text.trim());
  const val = (f: string | undefined) => {
    if (f === undefined) return null;
    if (/^"(?:[^"]|"")*"$/.test(f)) return f.slice(1, -1).replace(/""/g, '"');
    return /^-?\d+(\.\d+)?$/.test(f) ? formatNumber(Number(f)) : null;
  };
  const t = x.attrs.type;
  if (t === 'containsText' && x.attrs.text) return { range, op: 'text', v1: x.attrs.text, look };
  if (t === 'containsBlanks') return { range, op: 'empty', v1: '', look };
  if (t === 'dataBar') {
    // Culoarea barei din Excel → stilul nostru cu culoarea cea mai apropiată.
    const rgbText = (kid(kid(x, 'dataBar'), 'color')?.attrs.rgb ?? '').slice(-6).toLowerCase();
    const dist = (h: string) => [0, 2, 4].reduce((d, i) => d + Math.abs(parseInt(h.slice(i, i + 2), 16) - parseInt(rgbText.slice(i, i + 2), 16)), 0);
    const near = /^[0-9a-f]{6}$/.test(rgbText)
      ? (['blue', 'green', 'red', 'yellow'] as CondLook[]).sort((a, b) => dist(BAR_COLORS[a].slice(1)) - dist(BAR_COLORS[b].slice(1)))[0]
      : 'blue';
    return { range, op: 'databar', v1: '', look: near };
  }
  if (t === 'iconSet') {
    // Doar seturile cu 3 pictograme pe care le avem (altele: 3ArrowsGray → săgeți, 3TrafficLights2 / 3Signs → semafoare, 3Symbols → bife).
    const name = kid(x, 'iconSet')?.attrs.iconSet ?? '3TrafficLights1';
    const alias: Record<string, string> = { '3ArrowsGray': '3Arrows', '3TrafficLights2': '3TrafficLights1', '3Signs': '3TrafficLights1', '3Symbols': '3Symbols2', '3Flags': '3TrafficLights1' };
    const near = (Object.keys(ICON_SETS) as CondLook[]).find((k) => ICON_SETS[k].xlsx === (alias[name] ?? name));
    return near ? { range, op: 'icons', v1: '', look: near } : null;
  }
  if (t === 'colorScale') {
    // Scala din Excel → scala noastră cu același număr de culori și culorile cele mai apropiate.
    const cs = kids(kid(x, 'colorScale'), 'color').map((c) => (c.attrs.rgb ?? '').slice(-6).toLowerCase()).filter((h) => /^[0-9a-f]{6}$/.test(h));
    if (cs.length < 2) return null;
    const dist = (a: string, b: string) => [0, 2, 4].reduce((d, i) => d + Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)), 0);
    const score = (k: CondLook) => { const s = SCALES[k].colors; return s.length !== cs.length ? Infinity : s.reduce((d, c, i) => d + dist(c.slice(1), cs[i]), 0); };
    const near = (Object.keys(SCALES) as CondLook[]).sort((a, b) => score(a) - score(b))[0];
    return Number.isFinite(score(near)) ? { range, op: 'scale', v1: '', look: near } : null;
  }
  if (t === 'notContainsBlanks') return { range, op: 'filled', v1: '', look };
  const on = (v: string | undefined) => v === '1' || v === 'true';
  // „Primele 10 %” (percent) și abaterile standard (stdDev) nu le avem: regula se lasă deoparte.
  if (t === 'top10' && !on(x.attrs.percent)) return { range, op: on(x.attrs.bottom) ? 'bottom' : 'top', v1: String(topCount(x.attrs.rank ?? '10')), look };
  if (t === 'aboveAverage' && !x.attrs.stdDev && !on(x.attrs.equalAverage)) return { range, op: x.attrs.aboveAverage === '0' || x.attrs.aboveAverage === 'false' ? 'below' : 'above', v1: '', look };
  if (t === 'duplicateValues') return { range, op: 'dup', v1: '', look };
  if (t === 'uniqueValues') return { range, op: 'unique', v1: '', look };
  // Regula cu formulă (scrisă pentru prima celulă a zonei).
  if (t === 'expression') return fs[0] ? { range, op: 'formula', v1: fromExcelFormula(fs[0]).slice(0, 200), look } : null;
  if (t !== 'cellIs') return null;
  const op = (Object.keys(CF_OPS) as CondOp[]).find((k) => CF_OPS[k] === x.attrs.operator);
  const v1 = val(fs[0]);
  if (!op || v1 === null) return null;
  if (op === 'between') {
    const v2 = val(fs[1]);
    return v2 === null ? null : { range, op, v1, v2, look };
  }
  return { range, op, v1, look };
}

/** Numele foilor așa cum le acceptă Excel (fără [ ] : * ? / \, cel mult 31 de caractere, fără dubluri). */
export function excelSheetNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map((n, i) => {
    const base = n.replace(/[[\]:*?/\\]/g, ' ').replace(/^'+|'+$/g, '').slice(0, 31).trim() || `Foaia ${i + 1}`;
    let name = base;
    for (let k = 2; used.has(name.toLowerCase()); k++) name = `${base.slice(0, 26)} (${k})`;
    used.add(name.toLowerCase());
    return name;
  });
}

/** O foaie de exportat, cu rezultatele formulelor ei. */
export interface XlsxOut { sheet: Sheet; results: Record<string, Result> }

/** Foile → octeții unui .xlsx. Formulele se scriu ca formule Excel, împreună cu rezultatul calculat de noi. */
/** Numele definite pentru workbook.xml; cele ale unei foi care nu se mai găsește se sar. */
function definedNamesXml(defined: (DefinedName & { hidden?: boolean })[], sheetNames: string[]): string {
  const out: string[] = [];
  for (const d of defined) {
    const local = d.sheet === undefined ? -1 : sheetNames.findIndex((n) => n.toLowerCase() === d.sheet!.toLowerCase());
    if (d.sheet !== undefined && local < 0) continue;
    out.push(`<definedName name="${escapeXml(d.name)}"${local >= 0 ? ` localSheetId="${local}"` : ''}${d.hidden ? ' hidden="1"' : ''}>${escapeXml(d.ref.replace(/^=/, ''))}</definedName>`);
  }
  return out.length ? `<definedNames>${out.join('')}</definedNames>` : '';
}

export async function writeXlsx(book: XlsxOut[], active = 0, defined: DefinedName[] = [], manual = false, iter?: { max: number; delta: number }, lockBook?: { pw?: SheetPw }, props?: DocProps, cellStyles: UserCellStyle[] = [], theme?: BookTheme, links: ExtBook[] = [], tableStyles: CustomTableStyle[] = []): Promise<Uint8Array> {
  // Registrele externe: formulele le scriu pe număr ([1]Foaie1!A1); cele noi, scrise de mână, se adaugă la listă.
  const xlinks: ExtBook[] = links.map((l) => ({ ...l, sheets: l.sheets.map((s) => ({ ...s })) }));
  const xf = (f: string) => extToExcel(toExcelFormula(f), xlinks);
  // Fontul obișnuit al celulelor e fontul de Corp al temei.
  const body = escapeXml(themeFontsOf(theme).minor), scheme = theme ? '<scheme val="minor"/>' : '';
  const fonts = [`<font><sz val="11"/><name val="${body}"/>${scheme}</font>`];
  const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  const borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
  const numFmts: string[] = [];
  const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  // Stilurile cu nume ale omului (xfId-ul lor în cellStyleXfs = poziția + 1); celulele legate de ele le arată prin xfId.
  const named = cleanCellStyles(cellStyles);
  const namedXf = new Map(named.map((u, k) => [u.name, k + 1]));
  const index = new Map<string, number>();
  const pick = (list: string[], item: string, base = 0) => {
    const i = list.indexOf(item);
    if (i >= 0) return i + base;
    list.push(item);
    return list.length - 1 + base;
  };
  const argb = (c: string) => 'FF' + c.slice(1).toUpperCase();
  const styleIndex = (st0: CellStyle | undefined): number => {
    // „Ignorare eroare” nu e format: se scrie separat, în ignoredErrors.
    const st = st0?.ign ? (({ ign: _ign, ...rest }) => rest)(st0) : st0;
    if (!st || !Object.keys(st).length) return 0;
    const key = JSON.stringify(st);
    const known = index.get(key);
    if (known !== undefined) return known;
    const i = xfs.push(xfXml(st)) - 1;
    index.set(key, i);
    return i;
  };
  /** Un <xf> pentru formatul dat (fontul, umplerea, chenarul și formatul numărului se adaugă în listele lor). */
  const xfXml = (st: CellStyle): string => {
    let font = 0;
    if (st.b || st.i || st.u || st.s || st.pos || st.color || st.font || st.sz) {
      font = pick(fonts, '<font>' + (st.b ? '<b/>' : '') + (st.i ? '<i/>' : '') + (st.s ? '<strike/>' : '') + (st.u ? '<u/>' : '')
        + (st.pos ? `<vertAlign val="${st.pos === 'sup' ? 'superscript' : 'subscript'}"/>` : '')
        + `<sz val="${st.sz ?? 11}"/>` + (st.color ? `<color rgb="${argb(st.color)}"/>` : '') + (st.font ? `<name val="${escapeXml(st.font)}"/>` : `<name val="${body}"/>${scheme}`) + '</font>');
    }
    const fill = st.bg ? pick(fills, `<fill><patternFill patternType="solid"><fgColor rgb="${argb(st.bg)}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
    const code = oursToExcelFmt(st);
    const fmtId = code ? pick(numFmts, code, 164) : 0;
    const lineColor = st.bdColor ? `<color rgb="${argb(st.bdColor)}"/>` : '<color auto="1"/>';
    const side = (name: string, k: string) => (st.bd?.includes(k) ? `<${name} style="${st.bdStyle ?? 'thin'}">${lineColor}</${name}>` : `<${name}/>`);
    const border = st.bd ? pick(borders, `<border>${side('left', 'l')}${side('right', 'r')}${side('top', 't')}${side('bottom', 'b')}<diagonal/></border>`) : 0;
    const al = st.align || st.wrap || st.va || st.ind || st.rot;
    const xf = `<xf numFmtId="${fmtId}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="${(st.sty && namedXf.get(st.sty)) || 0}"`
      + (fmtId ? ' applyNumberFormat="1"' : '') + (font ? ' applyFont="1"' : '') + (fill ? ' applyFill="1"' : '') + (border ? ' applyBorder="1"' : '')
      + (al ? ' applyAlignment="1"' : '') + (st.unlock ? ' applyProtection="1"' : '')
      + (al || st.unlock
        ? `>${al ? `<alignment${st.align ? ` horizontal="${st.align === 'across' ? 'centerContinuous' : st.align}"` : ''}${st.va ? ` vertical="${st.va === 'middle' ? 'center' : st.va}"` : ''}${st.ind ? ` indent="${st.ind}"` : ''}${st.rot ? ` textRotation="${st.rot > 0 ? st.rot : 90 - st.rot}"` : ''}${st.wrap ? ' wrapText="1"' : ''}/>` : ''}${st.unlock ? '<protection locked="0"/>' : ''}</xf>`
        : '/>');
    return xf;
  };

  const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const rels = (items: string[]) => head + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + items.join('') + '</Relationships>';
  const names = excelSheetNames(book.map((b) => b.sheet.name));
  // Fila activă din Excel trebuie să fie o foaie vizibilă.
  let tab = Math.max(0, Math.min(book.length - 1, active));
  if (book[tab].sheet.hidden) tab = Math.max(0, book.findIndex((b) => !b.sheet.hidden));
  const zip = new JSZip();
  const types: string[] = [];
  // Textele merg în tabelul comun (sharedStrings), ca în Excel: un text repetat în mii de celule se scrie o singură dată.
  const sst: string[] = [];
  const sstIdx = new Map<string, number>();
  const sIndex = (t: string) => {
    let k = sstIdx.get(t);
    if (k === undefined) { k = sst.length; sst.push(t); sstIdx.set(t, k); }
    return k;
  };
  let chartN = 0;
  let drawingN = 0;
  let tableN = 0;
  // Autorii comentariilor cu fir, din tot registrul (xl/persons/person.xml).
  const persons = new Set<string>();
  const tableNames = new Set<string>();
  let imageN = 0;
  // Pozele în celule (SheetPic.cell) din tot registrul: în xl/richData, celula le arată cu vm="n" (n de la 1).
  const richImgs: { ext: string; mime: string; b64: string; alt?: string }[] = [];

  // Culorile filtrelor după culoare, scrise ca „dxf” după stilurile evidențierii.
  const filterColors: FilterColor[] = [];
  // Stilurile de tabel proprii folosite de tabelele scrise (și cele ale registrului), scrise în <tableStyles>.
  registerTableStyles(tableStyles);
  const usedCustom = new Set<string>(tableStyles.map((s) => s.id));
  const filterDxf = (fc: FilterColor) => {
    let k = filterColors.findIndex((x) => x.kind === fc.kind && x.color === fc.color);
    if (k < 0) { k = filterColors.length; filterColors.push(fc); }
    return LOOK_ORDER.length + k;
  };

  book.forEach(({ sheet, results }, si) => {
    const rowsXml: string[] = [];
    // Tabelele de date: în prima celulă de rezultat, <f t="dataTable"> cu zona rezultatelor și celulele de intrare
    // (r1 / r2; dtr = valorile pe rând, dt2D = cu două variabile); celelalte rezultate rămân valori, ca în Excel.
    const dtF = new Map<string, string>();
    for (const t of sheet.dataTables ?? []) {
      const g = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(t.zone);
      const a = g && cellPos(g[1] + g[2]), b = g && cellPos(g[3] + g[4]);
      if (!a || !b || b.r < a.r + 1 || b.c < a.c + 1) continue;
      const first = cellId(a.r + 1, a.c + 1);
      const io = t.row && t.col ? ` dt2D="1" dtr="1" r1="${t.row}" r2="${t.col}"` : t.row ? ` dt2D="0" dtr="1" r1="${t.row}"` : ` dt2D="0" dtr="0" r1="${t.col}"`;
      dtF.set(first, `<f t="dataTable" ref="${first}:${cellId(b.r, b.c)}"${io}/>`);
    }
    // Poza în celulă se scrie „în celulă” doar dacă celula e goală (altfel rămâne poză peste celulă, cât celula).
    const cellVm = new Map<string, number>();
    const richPics = new Set<SheetPic>();
    for (const p of sheet.pics ?? []) {
      const id = cellId(p.r, p.c);
      const part = p.cell && !p.sh && !sheet.cells[id] && !results[id] && !cellVm.has(id) ? picPart(p.src) : null;
      if (!part) continue;
      richImgs.push({ ...part, ...(p.alt ? { alt: p.alt } : {}) });
      cellVm.set(id, richImgs.length);
      richPics.add(p);
    }
    const hid = new Set(sheet.hideRows ?? []);
    // Rândurile ascunse de filtru se scriu ascunse, ca Excel să arate tabelul la fel.
    for (const r of sheet.filter ? hiddenRows(sheet.cells, results, sheet.styles, sheet.filter) : []) hid.add(r + 1);
    const lastR = Math.min(ROWS - 1, Math.max(lastUsedRow(sheet.cells, sheet.styles), ...(sheet.hideRows ?? []).map((k) => k - 1), ...Object.keys(sheet.rowLvl ?? {}).map((k) => Number(k) - 1), ...[...richPics].map((p) => p.r)));
    const lastC = Math.max(lastUsedCol(sheet.cells, sheet.styles, results), ...[...richPics].map((p) => p.c));
    for (let r = 0; r <= lastR; r++) {
      const cs: string[] = [];
      for (let c = 0; c <= lastC; c++) {
        const id = cellId(r, c);
        const raw = sheet.cells[id];
        const st = sheet.styles[id];
        const spilled = !raw ? results[id] : undefined; // valoare vărsată de o formulă SORT/FILTER… de deasupra
        const vm = cellVm.get(id);
        if (vm) { const s0 = styleIndex(st ? withoutNote(st) : st); cs.push(`<c r="${id}"${s0 ? ` s="${s0}"` : ''} t="e" vm="${vm}"><v>#VALUE!</v></c>`); continue; }
        if (!raw && !st && !spilled) continue;
        const s = styleIndex(st?.note || st?.link || st?.chk || st?.cmt || st?.cdone ? withoutNote(st) : st);
        const sa = s ? ` s="${s}"` : '';
        if (spilled) {
          if (spilled.err) cs.push(`<c r="${id}"${sa} t="e"><v>${escapeXml(spilled.text)}</v></c>`);
          else if (spilled.num && spilled.value !== undefined) cs.push(`<c r="${id}"${sa}><v>${spilled.value}</v></c>`);
          else cs.push(`<c r="${id}"${sa} t="str"><v>${escapeXml(spilled.text)}</v></c>`);
          continue;
        }
        if (!raw) { cs.push(`<c r="${id}"${sa}/>`); continue; }
        if (raw.startsWith('=') && /(SUM[AĂ][IÎ]NLITERE|LITERE|VALIDCNP|VALIDCUI|VALIDIBAN)\s*\(/i.test(raw)) {
          // Excel nu are suma în litere și verificările de CNP/CUI/IBAN: scriem rezultatul calculat de noi.
          cs.push(`<c r="${id}"${sa} t="inlineStr"><is><t xml:space="preserve">${escapeXml(results[id]?.text ?? '')}</t></is></c>`);
        } else if (raw.startsWith('=') && raw.length > 1) {
          const res = results[id];
          // Formula care se varsă devine în Excel o formulă matrice pe toată zona rezultatului.
          const sp = res?.spill;
          const f = sp ? `<f t="array" ref="${id}:${cellId(r + sp.rows - 1, c + sp.cols - 1)}">${escapeXml(xf(raw))}</f>`
            : `<f>${escapeXml(xf(raw))}</f>`;
          if (res?.err) cs.push(`<c r="${id}"${sa}>${f}</c>`);
          else if (res?.num && res.value !== undefined) cs.push(`<c r="${id}"${sa}>${f}<v>${res.value}</v></c>`);
          else if (res && (res.text === 'ADEVĂRAT' || res.text === 'FALS')) cs.push(`<c r="${id}"${sa} t="b">${f}<v>${res.text === 'FALS' ? 0 : 1}</v></c>`);
          else cs.push(`<c r="${id}"${sa} t="str">${f}<v>${escapeXml(res?.text ?? '')}</v></c>`);
        } else if (isNumber(raw)) {
          cs.push(`<c r="${id}"${sa}>${dtF.get(id) ?? ''}<v>${Number(raw.trim().replace(',', '.'))}</v></c>`);
        } else if (BOOL_RE.test(raw.trim())) {
          // ADEVĂRAT / FALS (și casetele de bifat) sunt valori logice, nu text.
          cs.push(`<c r="${id}"${sa} t="b"><v>${/^(TRUE|ADEV)/i.test(raw.trim()) ? 1 : 0}</v></c>`);
        } else {
          // Textul cu apostrof (00123, 0722…) se scrie ca text, fără apostrof.
          cs.push(`<c r="${id}"${sa} t="s"><v>${sIndex(raw.startsWith("'") ? raw.slice(1) : raw)}</v></c>`);
        }
      }
      // Înălțimea aleasă de mână: în Excel se scrie în puncte (1 px = 0,75 pt).
      const h = sheet.rowH?.[String(r + 1)];
      const ht = h ? ` ht="${Math.round(h * 0.75 * 100) / 100}" customHeight="1"` : '';
      const hd = hid.has(r + 1) ? ' hidden="1"' : '';
      const lv = sheet.rowLvl?.[String(r + 1)];
      const ol = lv ? ` outlineLevel="${lv}"` : '';
      if (cs.length || ht || hd || ol) rowsXml.push(`<row r="${r + 1}"${ht}${hd}${ol}>${cs.join('')}</row>`);
    }

    // Lățimile alese de mână și coloanele ascunse (o coloană ascunsă își păstrează lățimea pentru când se afișează).
    const hidC = new Set(sheet.hideCols ?? []);
    const colNums = new Set([...Object.keys(sheet.colW).map((k) => cellPos(k + '1')!.c + 1), ...hidC, ...Object.keys(sheet.colLvl ?? {}).map(Number)]);
    const cols = [...colNums]
      .map((c) => { const px = sheet.colW[colName(c - 1)]; const w = px ? Math.max(1, (px - 5) / 7).toFixed(2) : '8.43'; return `<col min="${c}" max="${c}" width="${w}"${px ? ' customWidth="1"' : ''}${hidC.has(c) ? ' hidden="1"' : ''}${sheet.colLvl?.[String(c)] ? ` outlineLevel="${sheet.colLvl[String(c)]}"` : ''}/>`; })
      .sort((a, b) => Number(/min="(\d+)"/.exec(a)![1]) - Number(/min="(\d+)"/.exec(b)![1]));
    // Panourile înghețate: primele rânduri (ySplit), primele coloane (xSplit) sau amândouă.
    const fr = cleanFreeze(sheet.freeze, MAX_FREEZE_ROWS);
    const fc = cleanFreeze(sheet.freezeCol, MAX_FREEZE_COLS);
    const corner = cellId(fr, fc);
    const active = fr && fc ? 'bottomRight' : fr ? 'bottomLeft' : 'topRight';
    const pane = fr || fc
      ? `<pane${fc ? ` xSplit="${fc}"` : ''}${fr ? ` ySplit="${fr}"` : ''} topLeftCell="${corner}" activePane="${active}" state="frozen"/><selection pane="${active}" activeCell="${corner}" sqref="${corner}"/>`
      : '';

    // Graficele: câte un fișier chartN.xml, așezate într-un desen la dreapta datelor.
    const chartFiles: string[] = [];
    const chartAts: (ChartAt | undefined)[] = [];
    for (const ch of sheet.charts ?? []) {
      const g = parseRangeText(ch.range);
      if (!g) continue;
      // Datele de pe altă foaie (ch.src): celulele și numele acelei foi.
      const sj = ch.src ? book.findIndex((b) => b.sheet.name === ch.src) : -1;
      const from = sj >= 0 ? book[sj] : { sheet, results };
      const x = chartXml(ch, chartDataOf(from.sheet.cells, from.results, from.sheet.styles, g, ch), names[sj >= 0 ? sj : si], ch.byRow && canSwitchRC(ch.type) ? g.r0 : g.c0);
      if (x) { chartFiles.push(x); chartAts.push(ch.at); }
    }
    // Pozele foii (fără SVG, care nu se poate pune în .xlsx).
    // Formele și casetele de text (cu `sh`) se scriu ca forme adevărate (shapeXml.ts), nu ca poze.
    const picOut = (sheet.pics ?? []).flatMap((p) => { const part = p.sh || richPics.has(p) ? null : picPart(p.src); return part ? [{ p, part }] : []; });
    const shapeOut = (sheet.pics ?? []).filter((p) => p.sh);
    let lastCol = 0;
    for (const id of Object.keys(sheet.cells)) { const p = cellPos(id); if (p && sheet.cells[id]) lastCol = Math.max(lastCol, p.c); }
    const n = si + 1;
    // Notele devin comentarii Excel: comments.xml (textul) + un desen VML (căsuța galbenă), legate de foaie.
    // Comentariile cu fir: în threadedComments, plus un comentariu clasic cu tot textul (autorul „tc=…” leagă cele două).
    // O celulă cu notă și cu fir păstrează firul (în Excel o celulă are doar unul din ele).
    const threads: ThreadCell[] = Object.entries(sheet.styles).filter(([, st]) => st.cmt?.length).map(([id, st]) => ({ id, th: st.cmt!, done: st.cdone }));
    for (const t of threads) for (const m of t.th) persons.add(m.a);
    const notes = [...Object.entries(sheet.styles).filter(([, st]) => st.note && !st.cmt?.length).map(([id, st]) => ({ id, text: st.note! })),
      ...threads.map((t) => ({ id: t.id, text: legacyThreadText(t.th), author: `tc=${topId(t.id, n)}` }))];
    // Tabelele cu nume: xl/tables/tableN.xml + <tableParts>. Cele cu cap gol / repetat, suprapuse sau peste celule îmbinate
    // rămân doar cu culorile (altfel programul care deschide fișierul l-ar „repara”).
    const tableRels: string[] = [];
    const written: { r0: number; c0: number; r1: number; c1: number; filter: boolean }[] = [];
    const mergeG = (sheet.merges ?? []).map((m) => parseRangeText(m)).filter((g): g is NonNullable<typeof g> => !!g);
    const hits = (a: { r0: number; c0: number; r1: number; c1: number }, b: { r0: number; c0: number; r1: number; c1: number }) => a.r0 <= b.r1 && b.r0 <= a.r1 && a.c0 <= b.c1 && b.c0 <= a.c1;
    for (const t of sheet.tables ?? []) {
      const colsT = tableColumns(t, sheet.cells);
      if (!colsT || tableNames.has(t.name.toLowerCase()) || defined.some((d) => d.name.toLowerCase() === t.name.toLowerCase()) || written.some((w) => hits(w, t)) || mergeG.some((g) => hits(g, t))) continue;
      tableNames.add(t.name.toLowerCase());
      if (isCustomTheme(t.theme) && TABLE_THEMES[t.theme]) usedCustom.add(t.theme);
      written.push({ r0: t.r0, c0: t.c0, r1: t.r1, c1: t.c1, filter: t.opts.head && t.opts.filter });
      const k = ++tableN;
      zip.file(`xl/tables/table${k}.xml`, tableXml(t, k, colsT));
      types.push(`<Override PartName="/xl/tables/table${k}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>`);
      tableRels.push(`<Relationship Id="rIdT${tableRels.length + 1}" Type="${REL}/table" Target="../tables/table${k}.xml"/>`);
    }
    // Filtrul foii nu are voie să atingă un tabel (filtrul tabelului e în fișierul lui).
    const sheetFilter = sheet.filter && !written.some((w) => hits(w, { r0: sheet.filter!.r, c0: sheet.filter!.c0, r1: sheet.filter!.r, c1: sheet.filter!.c1 }));
    const sheetRels: string[] = [];
    // Legăturile din celule: adresele web / e-mail în legăturile foii (rIdH…), locurile din tabel direct („location”).
    const links = Object.entries(sheet.styles).filter(([, st]) => st.link).slice(0, 5000);
    const linksXml = links.length ? '<hyperlinks>' + links.map(([id, st], k) => {
      const l = st.link!;
      if (l.startsWith('#')) return `<hyperlink ref="${id}" location="${escapeXml(l.slice(1))}"/>`;
      sheetRels.push(`<Relationship Id="rIdH${k + 1}" Type="${REL}/hyperlink" Target="${escapeXml(l)}" TargetMode="External"/>`);
      return `<hyperlink ref="${id}" r:id="rIdH${k + 1}"/>`;
    }).join('') + '</hyperlinks>' : '';
    if (chartFiles.length || picOut.length || shapeOut.length) sheetRels.push(`<Relationship Id="rId1" Type="${REL}/drawing" Target="../drawings/drawing${drawingN + 1}.xml"/>`);
    let vmlId = 0;
    if (notes.length) {
      const k = sheetRels.length;
      vmlId = k + 2;
      sheetRels.push(`<Relationship Id="rId${k + 1}" Type="${REL}/comments" Target="../comments${n}.xml"/>`);
      sheetRels.push(`<Relationship Id="rId${k + 2}" Type="${REL}/vmlDrawing" Target="../drawings/vmlDrawing${n}.vml"/>`);
      zip.file(`xl/comments${n}.xml`, commentsXml(notes));
      zip.file(`xl/drawings/vmlDrawing${n}.vml`, notesVml(notes, n));
      types.push(`<Override PartName="/xl/comments${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"/>`);
    }
    if (threads.length) {
      sheetRels.push(`<Relationship Id="rIdTC1" Type="http://schemas.microsoft.com/office/2017/10/relationships/threadedComment" Target="../threadedComments/threadedComment${n}.xml"/>`);
      zip.file(`xl/threadedComments/threadedComment${n}.xml`, threadedXml(threads, n));
      types.push(`<Override PartName="/xl/threadedComments/threadedComment${n}.xml" ContentType="application/vnd.ms-excel.threadedcomments+xml"/>`);
    }
    zip.file(`xl/worksheets/sheet${n}.xml`, head + `<worksheet ${NS}>${sheet.tab || (sheet.print && sheet.print.fit !== false) ? `<sheetPr>${sheet.tab ? `<tabColor rgb="${argb(sheet.tab)}"/>` : ''}${sheet.print && sheet.print.fit !== false ? '<pageSetUpPr fitToPage="1"/>' : ''}</sheetPr>` : ''}<sheetViews><sheetView${si === tab ? ' tabSelected="1"' : ''}${sheet.noGrid ? ' showGridLines="0"' : ''}${sheet.noHead ? ' showRowColHeaders="0"' : ''}${sheet.noZero ? ' showZeros="0"' : ''} workbookViewId="0">${pane}</sheetView></sheetViews>`
      + `<sheetFormatPr defaultRowHeight="15"${maxLevel(sheet.rowLvl) ? ` outlineLevelRow="${maxLevel(sheet.rowLvl)}"` : ''}${maxLevel(sheet.colLvl) ? ` outlineLevelCol="${maxLevel(sheet.colLvl)}"` : ''}/>`
      + (cols.length ? `<cols>${cols.join('')}</cols>` : '')
      + `<sheetData>${rowsXml.join('')}</sheetData>`
      + (sheet.protect ? `<sheetProtection${sheetPwAttrs(sheet.protectPw, escapeXml)} sheet="1" objects="1" scenarios="1"/>` : '')
      + scenariosXml(sheet.scenarios)
      + (sheetFilter ? autoFilterXml(sheet, results, filterDxf) : '')
      + (sheet.merges?.length ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : '')
      + rulesXml(sheet.rules ?? [])
      + listsXml(sheet.lists ?? [])
      + linksXml
      + printXml(sheet.print)
      + ignoredXml(sheet)
      + (chartFiles.length || picOut.length || shapeOut.length ? '<drawing r:id="rId1"/>' : '')
      + (vmlId ? `<legacyDrawing r:id="rId${vmlId}"/>` : '')
      + (tableRels.length ? `<tableParts count="${tableRels.length}">${tableRels.map((_, i) => `<tablePart r:id="rIdT${i + 1}"/>`).join('')}</tableParts>` : '')
      + sparksXml(sheet.sparks, sheet.name)
      + '</worksheet>');
    sheetRels.push(...tableRels);
    if (sheetRels.length) zip.file(`xl/worksheets/_rels/sheet${n}.xml.rels`, rels(sheetRels));
    types.push(`<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
    if (chartFiles.length || picOut.length || shapeOut.length) {
      const d = ++drawingN;
      const first = chartN + 1;
      zip.file(`xl/drawings/drawing${d}.xml`, drawingXml(chartFiles.length, Math.min(lastCol + 2, COLS), picOut.map((x) => x.p), shapeOut, chartAts, sheet));
      zip.file(`xl/drawings/_rels/drawing${d}.xml.rels`,
        rels([...chartFiles.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/chart" Target="../charts/chart${first + i}.xml"/>`),
          ...picOut.map(({ part }, k) => {
            const m = ++imageN, file = `media/image${m}.${part.ext}`;
            zip.file(`xl/${file}`, part.b64, { base64: true });
            types.push(`<Override PartName="/xl/${file}" ContentType="${part.mime}"/>`);
            return `<Relationship Id="rIdP${k + 1}" Type="${REL}/image" Target="../${file}"/>`;
          })]));
      types.push(`<Override PartName="/xl/drawings/drawing${d}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`);
      chartFiles.forEach((x) => {
        const c = ++chartN;
        zip.file(`xl/charts/chart${c}.xml`, x);
        types.push(`<Override PartName="/xl/charts/chart${c}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`);
      });
    }
  });

  // Stilurile se scriu la urmă, după ce toate foile și-au adăugat formatările.
  // Stilurile cu nume ale omului: câte un <xf> în cellStyleXfs și numele lui în cellStyles (apar în lista de stiluri a fișierului).
  const styleXfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>', ...named.map((u) => xfXml(u.st as CellStyle).replace(' xfId="0"', ''))];
  const styleNames = ['<cellStyle name="Normal" xfId="0" builtinId="0"/>', ...named.map((u, k) => `<cellStyle name="${escapeXml(u.name)}" xfId="${k + 1}"/>`)];
  const customDxfs: string[] = [], customXml: string[] = [];
  for (const id of usedCustom) {
    const th = TABLE_THEMES[id as CustomTableStyle['id']];
    if (!th) continue;
    const out = customTableStyleXml(th, LOOK_ORDER.length + filterColors.length + customDxfs.length);
    customDxfs.push(...out.dxfs);
    customXml.push(out.xml);
  }
  const fmtXml = numFmts.map((code, i) => `<numFmt numFmtId="${164 + i}" formatCode="${escapeXml(code)}"/>`);
  zip.file('xl/styles.xml', head + `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
    + (fmtXml.length ? `<numFmts count="${fmtXml.length}">${fmtXml.join('')}</numFmts>` : '')
    + `<fonts count="${fonts.length}">${fonts.join('')}</fonts>`
    + `<fills count="${fills.length}">${fills.join('')}</fills>`
    + `<borders count="${borders.length}">${borders.join('')}</borders>`
    + `<cellStyleXfs count="${styleXfs.length}">${styleXfs.join('')}</cellStyleXfs>`
    + `<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>`
    + `<cellStyles count="${styleNames.length}">${styleNames.join('')}</cellStyles>`
    + (book.some((b) => b.sheet.rules?.length) || filterColors.length || customXml.length ? dxfsXml(filterColors, customDxfs) : '')
    + (customXml.length ? `<tableStyles count="${customXml.length}">${customXml.join('')}</tableStyles>` : '')
    + '</styleSheet>');
  // Numele definite (cu registrele externe trecute pe număr), înainte de lista registrelor, ca s-o completeze.
  const definedOut = [...defined.map((d) => ({ ...d, ref: extToExcel(d.ref, xlinks) })), ...printAreas(book.map((b) => b.sheet), names),
    ...book.flatMap((b, i) => (b.sheet.solver ? solverNames(b.sheet.solver, sheetRef(names[i])).map((n) => ({ ...n, sheet: b.sheet.name, hidden: true })) : []))];
  xlinks.forEach((l, k) => {
    zip.file(`xl/externalLinks/externalLink${k + 1}.xml`, externalLinkXml(l));
    zip.file(`xl/externalLinks/_rels/externalLink${k + 1}.xml.rels`, rels([`<Relationship Id="rId1" Type="${REL}/externalLinkPath" Target="${escapeXml(linkTarget(l))}" TargetMode="External"/>`]));
  });
  const richRels: string[] = [];
  if (richImgs.length) {
    const RD = 'http://schemas.microsoft.com/office/spreadsheetml/2017/richdata';
    const bks = (f: (k: number) => string) => richImgs.map((_, k) => f(k)).join('');
    zip.file('xl/metadata.xml', head + `<metadata xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:xlrd="${RD}">`
      + '<metadataTypes count="1"><metadataType name="XLRICHVALUE" minSupportedVersion="120000" copy="1" pasteAll="1" pasteValues="1" merge="1" splitFirst="1" rowColShift="1" clearFormats="1" clearComments="1" assign="1" coerce="1"/></metadataTypes>'
      + `<futureMetadata name="XLRICHVALUE" count="${richImgs.length}">${bks((k) => `<bk><extLst><ext uri="{3e2802c4-a4d2-4d8b-9148-e3be6c30e623}"><xlrd:rvb i="${k}"/></ext></extLst></bk>`)}</futureMetadata>`
      + `<valueMetadata count="${richImgs.length}">${bks((k) => `<bk><rc t="1" v="${k}"/></bk>`)}</valueMetadata></metadata>`);
    // Structura 0: poza; structura 1: poza cu text alternativ. CalcOrigin 5 = pusă de utilizator.
    zip.file('xl/richData/rdrichvaluestructure.xml', head + `<rvStructures xmlns="${RD}" count="2">`
      + '<s t="_localImage"><k n="_rvRel:LocalImageIdentifier" t="i"/><k n="CalcOrigin" t="i"/></s>'
      + '<s t="_localImage"><k n="_rvRel:LocalImageIdentifier" t="i"/><k n="CalcOrigin" t="i"/><k n="Text" t="s"/></s></rvStructures>');
    zip.file('xl/richData/rdrichvalue.xml', head + `<rvData xmlns="${RD}" count="${richImgs.length}">`
      + bks((k) => richImgs[k].alt ? `<rv s="1"><v>${k}</v><v>5</v><v>${escapeXml(richImgs[k].alt!)}</v></rv>` : `<rv s="0"><v>${k}</v><v>5</v></rv>`) + '</rvData>');
    zip.file('xl/richData/rdRichValueTypes.xml', head + '<rvTypesInfo xmlns="http://schemas.microsoft.com/office/spreadsheetml/2017/richdata2"><global><keyFlags>'
      + '<key name="_Self"><flag name="ExcludeFromFile" value="1"/><flag name="ExcludeFromCalcComparison" value="1"/></key></keyFlags></global></rvTypesInfo>');
    zip.file('xl/richData/richValueRel.xml', head + `<richValueRels xmlns="http://schemas.microsoft.com/office/spreadsheetml/2022/richvaluerel" xmlns:r="${REL}">${bks((k) => `<rel r:id="rId${k + 1}"/>`)}</richValueRels>`);
    zip.file('xl/richData/_rels/richValueRel.xml.rels', rels(richImgs.map((x, k) => {
      const m = ++imageN, file = `media/image${m}.${x.ext}`;
      zip.file(`xl/${file}`, x.b64, { base64: true });
      types.push(`<Override PartName="/xl/${file}" ContentType="${x.mime}"/>`);
      return `<Relationship Id="rId${k + 1}" Type="${REL}/image" Target="../${file}"/>`;
    })));
    types.push('<Override PartName="/xl/metadata.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheetMetadata+xml"/>',
      '<Override PartName="/xl/richData/rdRichValueTypes.xml" ContentType="application/vnd.ms-excel.rdrichvaluetypes+xml"/>',
      '<Override PartName="/xl/richData/rdrichvalue.xml" ContentType="application/vnd.ms-excel.rdrichvalue+xml"/>',
      '<Override PartName="/xl/richData/rdrichvaluestructure.xml" ContentType="application/vnd.ms-excel.rdrichvaluestructure+xml"/>',
      '<Override PartName="/xl/richData/richValueRel.xml" ContentType="application/vnd.ms-excel.richvaluerel+xml"/>');
    richRels.push(`<Relationship Id="rIdMeta" Type="${REL}/sheetMetadata" Target="metadata.xml"/>`,
      '<Relationship Id="rIdRvRel" Type="http://schemas.microsoft.com/office/2022/10/relationships/richValueRel" Target="richData/richValueRel.xml"/>',
      '<Relationship Id="rIdRv" Type="http://schemas.microsoft.com/office/2017/06/relationships/rdRichValue" Target="richData/rdrichvalue.xml"/>',
      '<Relationship Id="rIdRvS" Type="http://schemas.microsoft.com/office/2017/06/relationships/rdRichValueStructure" Target="richData/rdrichvaluestructure.xml"/>',
      '<Relationship Id="rIdRvT" Type="http://schemas.microsoft.com/office/2017/06/relationships/rdRichValueTypes" Target="richData/rdRichValueTypes.xml"/>');
  }
  zip.file('[Content_Types].xml', head + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + (sst.length ? '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>' : '')
    + types.join('')
    + xlinks.map((_, k) => `<Override PartName="/xl/externalLinks/externalLink${k + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.externalLink+xml"/>`).join('')
    + (persons.size ? '<Override PartName="/xl/persons/person.xml" ContentType="application/vnd.ms-excel.person+xml"/>' : '')
    + (props ? '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' : '')
    + (props?.label ? `<Override PartName="/docProps/custom.xml" ContentType="${CUSTOM_PROPS_TYPE}"/>` : '')
    + (theme ? '<Override PartName="/xl/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' : '')
    + '</Types>');
  // Tema registrului (Aspect pagină → Teme), ca paleta să fie aceeași și în alt program.
  if (theme) zip.file('xl/theme/theme1.xml', themeXml(theme));
  // Proprietățile registrului (titlu, subiect, autor, cuvinte cheie) în docProps/core.xml.
  if (props) zip.file('docProps/core.xml', coreXml(props));
  // Clasificarea registrului (Fișier → Proprietăți… → Clasificare) în docProps/custom.xml, ca la .docx.
  if (props?.label) zip.file('docProps/custom.xml', customPropsXml(false, props.label));
  zip.file('_rels/.rels', rels([`<Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/>`,
    ...(props ? ['<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'] : []),
    ...(props?.label ? [`<Relationship Id="rId3" Type="${CUSTOM_PROPS_REL}" Target="docProps/custom.xml"/>`] : [])]));
  zip.file('xl/workbook.xml', head + `<workbook ${NS}>${bookLockXml(lockBook, escapeXml)}<bookViews><workbookView activeTab="${tab}"/></bookViews><sheets>`
    + names.map((nm, i) => `<sheet name="${escapeXml(nm)}"${book[i].sheet.hidden ? ' state="hidden"' : ''} sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')
    + '</sheets>' + (xlinks.length ? `<externalReferences>${xlinks.map((_, k) => `<externalReference r:id="rIdExt${k + 1}"/>`).join('')}</externalReferences>` : '')
    + definedNamesXml(definedOut, book.map((b) => b.sheet.name))
    + `<calcPr calcId="0"${manual ? ' calcMode="manual"' : ''}${iter ? ` iterate="1" iterateCount="${iter.max}" iterateDelta="${iter.delta}"` : ''} fullCalcOnLoad="1"/></workbook>`);
  zip.file('xl/_rels/workbook.xml.rels', rels([
    ...names.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`),
    `<Relationship Id="rId${names.length + 1}" Type="${REL}/styles" Target="styles.xml"/>`,
    ...(sst.length ? [`<Relationship Id="rId${names.length + 2}" Type="${REL}/sharedStrings" Target="sharedStrings.xml"/>`] : []),
    ...(persons.size ? ['<Relationship Id="rIdPers" Type="http://schemas.microsoft.com/office/2017/10/relationships/person" Target="persons/person.xml"/>'] : []),
    ...(theme ? [`<Relationship Id="rIdTheme" Type="${REL}/theme" Target="theme/theme1.xml"/>`] : []),
    ...xlinks.map((_, k) => `<Relationship Id="rIdExt${k + 1}" Type="${REL}/externalLink" Target="externalLinks/externalLink${k + 1}.xml"/>`),
    ...richRels,
  ]));
  if (persons.size) zip.file('xl/persons/person.xml', personsXml([...persons]));
  if (sst.length) {
    zip.file('xl/sharedStrings.xml', head + `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sst.length}" uniqueCount="${sst.length}">`
      + sst.map((t) => `<si><t xml:space="preserve">${escapeXml(t)}</t></si>`).join('') + '</sst>');
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

// ---------- Grafice (DrawingML) ----------

const CHART_COLORS = ['4F6BED', 'E8743B', '19A979', 'D64A8F', '945ECF', '13A4B4', 'D4A01C', '6C8893'];
const C_NS = 'xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

/** Referința Excel la o zonă din foaie: 'Foaia 1'!$B$2:$B$5. */
function absRef(sheetName: string, r0: number, c0: number, r1: number, c1: number): string {
  const cell = (r: number, c: number) => `$${colName(c)}$${r + 1}`;
  const q = `'${sheetName.replace(/'/g, "''")}'`;
  return `${q}!${cell(r0, c0)}` + (r1 !== r0 || c1 !== c0 ? `:${cell(r1, c1)}` : '');
}

/** Umbra de sub forme (Stiluri diagramă → cu umbre): jos, ușor estompată, negru 35%. */
const SHADOW_XML = '<a:effectLst><a:outerShdw blurRad="38100" dist="25400" dir="5400000" algn="t" rotWithShape="0"><a:prstClr val="black"><a:alpha val="35000"/></a:prstClr></a:outerShdw></a:effectLst>';
/** Degradeul de sus în jos: culoarea amestecată cu alb, apoi culoarea plină (RRGGBB). */
const gradXml = (c: string) => `<a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:srgbClr val="${lighten('#' + c, 0.45).slice(1).toUpperCase()}"/></a:gs>`
  + `<a:gs pos="100000"><a:srgbClr val="${c}"/></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill>`;
const DL_VALUES = '<c:dLbls><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/>'
  + '<c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>';

/** XML-ul unui grafic Excel, cu referințe la celule și valorile de acum (ca Excel să-l arate și fără recalculare). */
export function chartXml(ch: SheetChart, data: ChartData, sheetName: string, labelCol: number): string | null {
  const w = data.where;
  if (!w || !data.series.length || !data.categories.length) return null;
  // Comutare rând / coloană: zona e citită întoarsă, deci referințele se întorc la loc (rândul ↔ coloana).
  const ref = (r0: number, c0: number, r1: number, c1: number) => (w.byRow ? absRef(sheetName, c0, r0, c1, r1) : absRef(sheetName, r0, c0, r1, c1));
  const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  // Histograma și Pareto: se scriu ca grafic obișnuit (coloane, respectiv coloane + linie în % pe axa din dreapta), cu valorile
  // calculate puse direct în grafic (c:strLit / c:numLit), plus un semn al nostru (c:extLst) cu felul și zona, ca Suite să-l refacă.
  const stat = isStat(ch.type) ? { kind: ch.type, range: ch.range } : null;
  if (stat) {
    data = { ...statData(ch.type, data), where: w };
    ch = { ...ch, type: ch.type === 'hist' ? 'col' : ch.type === 'box' || ch.type === 'waterfall' ? 'stack' : ch.type === 'funnel' || ch.type === 'treemap' ? 'bar' : ch.type === 'sunburst' ? 'doughnut' : ch.type === 'stock' ? 'line' : 'combo2' };
    if (!data.series.length || !data.categories.length) return null;
  }
  const pie = ch.type === 'pie' || ch.type === 'doughnut';
  // Bulele: seriile merg în perechi (Y, mărimea bulei), ca pe ecran; axele sunt ca la puncte.
  const bub = ch.type === 'bubble';
  const sc = ch.type === 'scatter' || bub;
  const series = pie ? data.series.slice(0, 1) : data.series;
  const n = data.categories.length;
  // Combinat: ultima serie e linie (într-un c:lineChart separat), celelalte coloane; „combo2” pune linia pe a doua axă (dreapta).
  const combo = isCombo(ch.type) && series.length > 1;
  const lineSer = (i: number) => ch.type === 'line' || ch.type === 'radar' || (combo && i === series.length - 1);
  const strCache = (vals: string[]) => `<c:strCache><c:ptCount val="${vals.length}"/>`
    + vals.map((v, i) => `<c:pt idx="${i}"><c:v>${escapeXml(v)}</c:v></c:pt>`).join('') + '</c:strCache>';
  const lit = (tag: 'strLit' | 'numLit', vals: string[]) => `<c:${tag}>${tag === 'numLit' ? '<c:formatCode>General</c:formatCode>' : ''}<c:ptCount val="${vals.length}"/>`
    + vals.map((v, i) => `<c:pt idx="${i}"><c:v>${escapeXml(v)}</c:v></c:pt>`).join('') + `</c:${tag}>`;
  const cat = stat ? `<c:cat>${lit('strLit', data.categories)}</c:cat>` : w.labels
    ? `<c:cat><c:strRef><c:f>${escapeXml(ref(w.r0, labelCol, w.r1, labelCol))}</c:f>${strCache(data.categories)}</c:strRef></c:cat>`
    : '';
  // Paleta aleasă (Schimbă culorile) și titlurile axelor (c:title în axă, după axPos / liniile de grilă).
  const pal = ch.palette ? paletteOf(ch.palette).map((x) => x.slice(1).toUpperCase()) : CHART_COLORS;
  const axTitle = (t?: string) => (t?.trim() ? '<c:title><c:tx><c:rich><a:bodyPr/><a:p><a:pPr><a:defRPr sz="1000" b="0"/></a:pPr>'
    + `<a:r><a:rPr lang="ro-RO" sz="1000" b="0"/><a:t>${escapeXml(t.trim())}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>` : '');
  const serArr = series.map((s, i) => {
    const c = w.cols[i];
    const tx = w.header && !stat
      ? `<c:tx><c:strRef><c:f>${escapeXml(ref(w.r0 - 1, c, w.r0 - 1, c))}</c:f>${strCache([s.name])}</c:strRef></c:tx>`
      : `<c:tx><c:v>${escapeXml(s.name)}</c:v></c:tx>`;
    // La cutia cu mustăți, prima serie (Q1) e doar baza nevăzută a cutiilor.
    // Cascada: baza nevăzută, apoi creșterile (verde) și scăderile (roșu).
    const color = stat?.kind === 'waterfall' && i ? (i === 1 ? WF_UP : WF_DOWN).slice(1).toUpperCase() : pal[(bub ? i / 2 : i) % pal.length];
    const hidden = (stat?.kind === 'box' || stat?.kind === 'waterfall') && i === 0;
    const fill = hidden ? '<a:noFill/>' : `<a:solidFill><a:srgbClr val="${color}"/></a:solidFill>`;
    // Stiluri diagramă: degradeul (de sus deschis în jos plin) pe formele pline și umbra sub forme (a:effectLst după umplere / linie).
    const area = hidden ? fill : ch.fx === 'grad' ? gradXml(color) : fill;
    const fx = ch.fx === 'shadow' && !hidden ? SHADOW_XML : '';
    const sp = bub ? `<c:spPr>${area}${fx}</c:spPr><c:invertIfNegative val="0"/>`
      : sc
      ? `<c:spPr><a:ln w="19050"><a:noFill/></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="6"/><c:spPr>${area}${fx}</c:spPr></c:marker>`
      : lineSer(i)
      ? `<c:spPr><a:ln w="28575" cap="rnd">${fill}<a:round/></a:ln>${fx}</c:spPr><c:marker><c:symbol val="circle"/><c:size val="5"/><c:spPr>${fill}</c:spPr></c:marker>`
      : pie ? '' : ch.type === 'area' || ch.type === 'radarFill' ? `<c:spPr>${area}${fx}</c:spPr>` : `<c:spPr>${area}${fx}</c:spPr><c:invertIfNegative val="0"/>`;
    const slices = pie
      ? data.categories.map((_, k) => `<c:dPt><c:idx val="${k}"/><c:bubble3D val="0"/><c:spPr>${ch.fx === 'grad' ? gradXml(pal[k % pal.length]) : `<a:solidFill><a:srgbClr val="${pal[k % pal.length]}"/></a:solidFill>`}`
        + `<a:ln><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln>${ch.fx === 'shadow' ? SHADOW_XML : ''}</c:spPr></c:dPt>`).join('')
        + '<c:dLbls><c:showLegendKey val="0"/><c:showVal val="0"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="1"/><c:showBubbleSize val="0"/><c:showLeaderLines val="1"/></c:dLbls>'
      : '';
    // Valorile pe grafic (Valori pe grafic): c:dLbls cu showVal, după culori și înaintea categoriilor.
    const dl = ch.labels && !pie && stat?.kind !== 'box' && !(stat?.kind === 'waterfall' && i === 0) ? DL_VALUES : '';
    const pts = s.values.map((v, k) => (Number.isFinite(v) ? `<c:pt idx="${k}"><c:v>${v}</c:v></c:pt>` : '')).join('');
    const numRef = (col: number, p: string) => `<c:numRef><c:f>${escapeXml(ref(w.r0, col, w.r1, col))}</c:f>`
      + `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${n}"/>${p}</c:numCache></c:numRef>`;
    const val = stat ? `<c:val>${lit('numLit', s.values.map((v) => (Number.isFinite(v) ? String(v) : '0')))}</c:val>` : `<c:val>${numRef(c, pts)}</c:val>`;
    if (bub) {
      if (i % 2) return '';
      const sz = series[i + 1];
      const size = sz ? numRef(w.cols[i + 1], sz.values.map((v, k) => (Number.isFinite(v) ? `<c:pt idx="${k}"><c:v>${v}</c:v></c:pt>` : '')).join('')) : lit('numLit', s.values.map(() => '1'));
      return `<c:ser><c:idx val="${i / 2}"/><c:order val="${i / 2}"/>${tx}${sp}${dl}${cat.replace('<c:cat>', '<c:xVal>').replace('</c:cat>', '</c:xVal>')}${val.replace('<c:val>', '<c:yVal>').replace('</c:val>', '</c:yVal>')}<c:bubbleSize>${size}</c:bubbleSize><c:bubble3D val="0"/></c:ser>`;
    }
    // La puncte (X–Y), etichetele sunt valorile X, iar numerele valorile Y.
    if (sc) return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${tx}${sp}${dl}${cat.replace('<c:cat>', '<c:xVal>').replace('</c:cat>', '</c:xVal>')}${val.replace('<c:val>', '<c:yVal>').replace('</c:val>', '</c:yVal>')}<c:smooth val="0"/></c:ser>`;
    return `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>${tx}${sp}${slices}${dl}${cat}${val}`
      + (lineSer(i) && ch.type !== 'radar' ? '<c:smooth val="0"/>' : '') + '</c:ser>';
  });
  const sers = (combo ? serArr.slice(0, -1) : serArr).join('');
  const axIds = '<c:axId val="111"/><c:axId val="222"/>';
  const bar = (dir: string, grouping: string) => `<c:barChart><c:barDir val="${dir}"/><c:grouping val="${grouping}"/><c:varyColors val="0"/>${sers}<c:gapWidth val="80"/>${grouping !== 'clustered' ? '<c:overlap val="100"/>' : ''}${axIds}</c:barChart>`;
  const ax2 = ch.type === 'combo2';
  const plot = combo ? bar('col', 'clustered') + `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${serArr[serArr.length - 1]}<c:marker val="1"/>`
      + (ax2 ? '<c:axId val="333"/><c:axId val="444"/>' : axIds) + '</c:lineChart>'
    : ch.type === 'col' || isCombo(ch.type) ? bar('col', 'clustered')
    : ch.type === 'stack' ? bar('col', 'stacked')
    : ch.type === 'stack100' ? bar('col', 'percentStacked')
      : ch.type === 'bar' ? bar('bar', 'clustered')
      : ch.type === 'barStack' ? bar('bar', 'stacked')
      : ch.type === 'barStack100' ? bar('bar', 'percentStacked')
        : ch.type === 'line' ? `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${sers}<c:marker val="1"/>${axIds}</c:lineChart>`
          : ch.type === 'area' ? `<c:areaChart><c:grouping val="standard"/><c:varyColors val="0"/>${sers}${axIds}</c:areaChart>`
          : ch.type === 'radar' || ch.type === 'radarFill' ? `<c:radarChart><c:radarStyle val="${ch.type === 'radar' ? 'marker' : 'filled'}"/><c:varyColors val="0"/>${sers}${axIds}</c:radarChart>`
            : bub ? `<c:bubbleChart><c:varyColors val="0"/>${sers}<c:bubbleScale val="100"/><c:showNegBubbles val="0"/>${axIds}</c:bubbleChart>`
            : sc ? `<c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>${sers}${axIds}</c:scatterChart>`
              : ch.type === 'doughnut' ? `<c:doughnutChart><c:varyColors val="1"/>${sers}<c:firstSliceAng val="0"/><c:holeSize val="55"/></c:doughnutChart>`
                : `<c:pieChart><c:varyColors val="1"/>${sers}<c:firstSliceAng val="0"/></c:pieChart>`;
  // Barele orizontale au categoriile în stânga; la puncte, și axa X e de numere.
  const hz = ch.type === 'bar' || ch.type === 'barStack' || ch.type === 'barStack100';
  const axes = pie ? '' : (sc ? '<c:valAx><c:axId val="111"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/>' + axTitle(ch.xTitle)
    + '<c:numFmt formatCode="General" sourceLinked="1"/><c:tickLblPos val="nextTo"/><c:crossAx val="222"/><c:crosses val="autoZero"/><c:crossBetween val="midCat"/></c:valAx>'
    : '<c:catAx><c:axId val="111"/><c:scaling><c:orientation val="' + (hz ? 'maxMin' : 'minMax') + '"/></c:scaling><c:delete val="0"/>'
    + `<c:axPos val="${hz ? 'l' : 'b'}"/>` + axTitle(hz ? ch.yTitle : ch.xTitle) + '<c:numFmt formatCode="General" sourceLinked="1"/><c:tickLblPos val="low"/><c:crossAx val="222"/>'
    + '<c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx>')
    + `<c:valAx><c:axId val="222"/><c:scaling><c:orientation val="minMax"/>${num(ch.axMax) ? `<c:max val="${ch.axMax}"/>` : ''}${num(ch.axMin) ? `<c:min val="${ch.axMin}"/>` : ''}</c:scaling><c:delete val="0"/><c:axPos val="${hz ? 'b' : 'l'}"/>`
    + (ch.noGrid ? '' : '<c:majorGridlines><c:spPr><a:ln><a:solidFill><a:srgbClr val="E3E3E3"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>') + axTitle(hz ? ch.xTitle : ch.yTitle)
    + '<c:numFmt formatCode="General" sourceLinked="1"/><c:tickLblPos val="nextTo"/><c:crossAx val="111"/><c:crosses val="autoZero"/>'
    + `<c:crossBetween val="between"/>${num(ch.axStep) && ch.axStep! > 0 ? `<c:majorUnit val="${ch.axStep}"/>` : ''}</c:valAx>`
    // A doua axă (dreapta) a graficului combinat: categoriile ascunse, valorile liniei în dreapta.
    + (combo && ax2 ? '<c:catAx><c:axId val="333"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="1"/><c:axPos val="b"/><c:numFmt formatCode="General" sourceLinked="1"/>'
      + '<c:tickLblPos val="nextTo"/><c:crossAx val="444"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx>'
      + '<c:valAx><c:axId val="444"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="r"/><c:numFmt formatCode="General" sourceLinked="1"/>'
      + '<c:tickLblPos val="nextTo"/><c:crossAx val="333"/><c:crosses val="max"/><c:crossBetween val="between"/></c:valAx>' : '');
  const t = ch.title.trim();
  const title = t
    ? '<c:title><c:tx><c:rich><a:bodyPr/><a:p><a:pPr><a:defRPr sz="1400" b="1"/></a:pPr>'
      + `<a:r><a:rPr lang="ro-RO" sz="1400" b="1"/><a:t>${escapeXml(t)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>`
    : '<c:autoTitleDeleted val="1"/>';
  // Legenda: locul ales (la plăcintă, implicit în dreapta, ca pe ecran); „Fără” = nicio legendă.
  const legend = (pie || series.length > 1) && ch.legend !== 'none'
    ? `<c:legend><c:legendPos val="${ch.legend === 't' || ch.legend === 'r' ? ch.legend : pie ? 'r' : 'b'}"/><c:overlay val="0"/></c:legend>` : '';
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + `<c:chartSpace ${C_NS}><c:roundedCorners val="0"/><c:chart>${title}<c:plotArea><c:layout/>${plot}${axes}</c:plotArea>`
    + `${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>`
    // Zona diagramei: umplerea și conturul alese (fără ele, albă și fără contur, ca pe ecran).
    + `<c:spPr><a:solidFill><a:srgbClr val="${isHex(ch.bg) ? ch.bg.slice(1).toUpperCase() : 'FFFFFF'}"/></a:solidFill>`
    + (isHex(ch.line) ? `<a:ln w="19050"><a:solidFill><a:srgbClr val="${ch.line.slice(1).toUpperCase()}"/></a:solidFill></a:ln>` : '<a:ln><a:noFill/></a:ln>') + '</c:spPr>'
    // Fontul și culoarea textului alese: pe tot graficul (titlu, legendă, axe, valori).
    + (chartFontOk(ch.font) || isHex(ch.ink) ? '<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr>' + (isHex(ch.ink) ? `<a:solidFill><a:srgbClr val="${ch.ink.slice(1).toUpperCase()}"/></a:solidFill>` : '')
      + (chartFontOk(ch.font) ? `<a:latin typeface="${escapeXml(ch.font)}"/>` : '') + '</a:defRPr></a:pPr><a:endParaRPr lang="ro-RO"/></a:p></c:txPr>' : '')
    + (stat ? `<c:extLst><c:ext uri="{6F1D2A7B-3C4E-4B5A-9E8D-7A6B5C4D3E2F}" xmlns:s="urn:suite:chart"><s:stat kind="${stat.kind}" range="${escapeXml(stat.range)}"/></c:ext></c:extLst>` : '')
    + '</c:chartSpace>';
}

/** Desenul foii: fiecare grafic într-un cadru la dreapta tabelului, unul sub altul (8 coloane × 16 rânduri). */
export function drawingXml(count: number, firstCol: number, pics: SheetPic[] = [], shapes: SheetPic[] = [], ats: (ChartAt | undefined)[] = [], sheet?: Pick<Sheet, 'colW' | 'rowH'>): string {
  const pos = (c: number, r: number, dc = 0, dr = 0) => `<xdr:col>${c}</xdr:col><xdr:colOff>${dc}</xdr:colOff><xdr:row>${r}</xdr:row><xdr:rowOff>${dr}</xdr:rowOff>`;
  const E = 9525;
  // Celula (și depărtarea în EMU) în care cade un punct aflat la `px` pixeli de colțul celulei (r, c), pe orizontală sau pe verticală.
  const walkTo = (start: number, px: number, size: (k: number) => number, max: number) => {
    let k = start;
    while (k < max - 1 && px >= size(k)) { px -= size(k); k++; }
    return [k, Math.round(px * E)] as const;
  };
  const cw = (c: number) => sheet?.colW?.[colName(c)] ?? COL_W;
  const rh = (r: number) => sheet?.rowH?.[String(r + 1)] ?? MIN_ROW_H;
  const anchors: string[] = [];
  for (let i = 0; i < count; i++) {
    const row = 1 + i * 17;
    const at = ats[i];
    let place = `<xdr:from>${pos(firstCol, row)}</xdr:from><xdr:to>${pos(firstCol + 8, row + 16)}</xdr:to>`;
    let ext = '<a:ext cx="0" cy="0"/>';
    if (at) {
      const [c1, dc1] = walkTo(at.c, at.dx + at.w, cw, COLS), [r1, dr1] = walkTo(at.r, at.dy + at.h, rh, ROWS);
      place = `<xdr:from>${pos(at.c, at.r, at.dx * E, at.dy * E)}</xdr:from><xdr:to>${pos(c1, r1, dc1, dr1)}</xdr:to>`;
      ext = `<a:ext cx="${at.w * E}" cy="${at.h * E}"/>`;
    }
    anchors.push(`<xdr:twoCellAnchor editAs="oneCell">${place}`
      + `<xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="Grafic ${i + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>`
      + `<xdr:xfrm><a:off x="0" y="0"/>${ext}</xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">`
      + `<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId${i + 1}"/>`
      + '</a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>');
  }
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">'
    + anchors.join('') + picAnchorsXml(pics, count + 2)
    + shapes.map((s, k) => shapeAnchorXml(s, s.sh!, count + 2 + pics.length + k, k + 1)).join('') + '</xdr:wsDr>';
}

/** O referință dintr-un grafic Excel („Foaia1!$A$2:$A$5”) → foaia și zona. */
export function parseChartRef(f: string): { sheet: string; r0: number; c0: number; r1: number; c1: number } | null {
  const m = /^(?:'((?:[^']|'')+)'|([^!]+))!\$?([A-Z]{1,3})\$?(\d+)(?::\$?([A-Z]{1,3})\$?(\d+))?$/i.exec(f.trim().replace(/^\(|\)$/g, ''));
  if (!m) return null;
  const a = cellPos(m[3] + m[4]);
  const b = m[5] ? cellPos(m[5] + m[6]) : a;
  if (!a || !b) return null;
  return {
    sheet: m[1] !== undefined ? m[1].replace(/''/g, "'") : m[2],
    r0: Math.min(a.r, b.r), c0: Math.min(a.c, b.c), r1: Math.max(a.r, b.r), c1: Math.max(a.c, b.c),
  };
}

// ---------- Note (comentarii Excel) ----------

/** Formatarea celulei fără ce nu ține de stilul Excel (nota, legătura, caseta de bifat se scriu separat). */
function withoutNote(st: CellStyle): CellStyle {
  const { note: _note, link: _link, chk: _chk, cmt: _cmt, cdone: _cdone, ...rest } = st;
  return rest;
}

export function commentsXml(notes: { id: string; text: string; author?: string }[]): string {
  const authors = ['Cyber Office Studio', ...new Set(notes.flatMap((x) => (x.author ? [x.author] : [])))];
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + `<comments xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><authors>${authors.map((a) => `<author>${escapeXml(a)}</author>`).join('')}</authors><commentList>`
    + notes.map((x) => `<comment ref="${x.id}" authorId="${x.author ? authors.indexOf(x.author) : 0}"><text><r><t xml:space="preserve">${escapeXml(x.text)}</t></r></text></comment>`).join('')
    + '</commentList></comments>';
}

/** Căsuțele galbene ale notelor (ascunse până treci cu mouse-ul), în formatul VML pe care îl cere Excel. */
export function notesVml(notes: { id: string }[], sheetN: number): string {
  const shapes = notes.map((x, i) => {
    const p = cellPos(x.id)!;
    return `<v:shape id="_x0000_s${sheetN * 1024 + i + 1}" type="#_x0000_t202" style="position:absolute;margin-left:80pt;margin-top:2pt;width:140pt;height:60pt;z-index:${i + 1};visibility:hidden" fillcolor="#ffffe1" o:insetmode="auto">`
      + '<v:fill color2="#ffffe1"/><v:shadow on="t" color="black" obscured="t"/><v:path o:connecttype="none"/>'
      + '<v:textbox style="mso-direction-alt:auto"><div style="text-align:left"></div></v:textbox>'
      + `<x:ClientData ObjectType="Note"><x:MoveWithCells/><x:SizeWithCells/><x:Anchor>${p.c + 1}, 15, ${p.r}, 2, ${p.c + 3}, 15, ${p.r + 4}, 16</x:Anchor>`
      + `<x:AutoFill>False</x:AutoFill><x:Row>${p.r}</x:Row><x:Column>${p.c}</x:Column></x:ClientData></v:shape>`;
  });
  return '<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">'
    + `<o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="${sheetN}"/></o:shapelayout>`
    + '<v:shapetype id="_x0000_t202" coordsize="21600,21600" o:spt="202" path="m,l,21600r21600,l21600,xe"><v:stroke joinstyle="miter"/><v:path gradientshapeok="t" o:connecttype="rect"/></v:shapetype>'
    + shapes.join('') + '</xml>';
}

/** Notele dintr-un comments.xml: celulă → text. Numele autorului pus de Excel în față („Ion:”, cu aldin) se scoate. */
export function notesFromXml(xml: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of kids(find(parseXml(xml), 'commentList'), 'comment')) {
    const ref = (c.attrs.ref ?? '').toUpperCase();
    const t = kid(c, 'text');
    if (!/^[A-Z]{1,3}[1-9]\d*$/.test(ref) || !t) continue;
    const runs = kids(t, 'r');
    let parts = runs.length ? runs : [t];
    if (runs.length > 1 && kid(kid(runs[0], 'rPr'), 'b') && /:\s*$/.test(allText(runs[0]))) parts = runs.slice(1);
    const text = parts.map(allText).join('').replace(/\r\n?/g, '\n').trim().slice(0, MAX_NOTE);
    if (text) out[ref] = text;
  }
  return out;
}

function allText(n: XNode): string {
  return n.name === 't' ? n.text : n.kids.map(allText).join('');
}

/** Graficul dintr-un fișier Excel → graficul nostru (tip, titlu și zona care cuprinde toate referințele lui). */
export function chartFromXml(xml: string, sheetName: string, id: string): SheetChart | null {
  const doc = parseXml(xml);
  const plot = find(doc, 'plotArea');
  if (!plot) return null;
  let type: ChartType | null = null;
  let node: XNode | undefined;
  for (const k of plot.kids) {
    if (k.name === 'barChart' || k.name === 'bar3DChart') {
      const g = kid(k, 'grouping')?.attrs.val;
      const horiz = kid(k, 'barDir')?.attrs.val === 'bar';
      type = g === 'percentStacked' ? (horiz ? 'barStack100' : 'stack100') : g === 'stacked' ? (horiz ? 'barStack' : 'stack') : horiz ? 'bar' : 'col';
    } else if (k.name === 'lineChart' || k.name === 'line3DChart') type = 'line';
    else if (k.name === 'areaChart' || k.name === 'area3DChart') type = 'area';
    else if (k.name === 'scatterChart') type = 'scatter';
    else if (k.name === 'bubbleChart') type = 'bubble';
    else if (k.name === 'doughnutChart') type = 'doughnut';
    else if (k.name === 'radarChart') type = kid(k, 'radarStyle')?.attrs.val === 'filled' ? 'radarFill' : 'radar';
    else if (k.name === 'pieChart' || k.name === 'pie3DChart' || k.name === 'ofPieChart') type = 'pie';
    else continue;
    node = k;
    break;
  }
  if (!type || !node) return null;
  // Coloane + linie în același grafic = combinat; dacă linia are alte axe decât coloanele, e pe axa din dreapta.
  let lineNode = type === 'col' ? plot.kids.find((k) => k.name === 'lineChart') : undefined;
  if (type === 'line') {
    // Linia scrisă înaintea coloanelor (alte programe): tot combinat, cu nodul coloanelor ca principal.
    const bars = plot.kids.find((k) => k.name === 'barChart' && kid(k, 'barDir')?.attrs.val !== 'bar' && !/stacked/i.test(kid(k, 'grouping')?.attrs.val ?? ''));
    if (bars) { lineNode = node; node = bars; type = 'col'; }
  }
  if (lineNode) {
    const ids = (n: XNode) => kids(n, 'axId').map((a) => a.attrs.val).join(',');
    type = ids(lineNode) === ids(node) ? 'combo' : 'combo2';
  }
  const refs: XNode[] = [];
  const collect = (n: XNode) => { for (const k of n.kids) { if (k.name === 'f') refs.push(k); else collect(k); } };
  for (const ser of [...kids(node, 'ser'), ...(lineNode ? kids(lineNode, 'ser') : [])]) collect(ser);
  let box: { r0: number; c0: number; r1: number; c1: number } | null = null;
  for (const f of refs) {
    const ref = parseChartRef(f.text);
    // Datele pot sta pe altă foaie (src), dar toate pe aceeași.
    if (!ref || (refs[0] !== f && ref.sheet !== parseChartRef(refs[0].text)?.sheet)) return null;
    box = box
      ? { r0: Math.min(box.r0, ref.r0), c0: Math.min(box.c0, ref.c0), r1: Math.max(box.r1, ref.r1), c1: Math.max(box.c1, ref.c1) }
      : ref;
  }
  // Histograma / Pareto scrise de Suite: felul și zona de date stau în semnul nostru (valorile din grafic sunt calculate).
  const stat = /<s:stat kind="(hist|pareto|box|waterfall|funnel|treemap|sunburst|stock)" range="([A-Z]+[0-9]+:[A-Z]+[0-9]+)"/.exec(xml);
  if (stat) { const r = parseRangeText(stat[2]); if (r && r.r1 < ROWS && r.c1 < COLS) { type = stat[1] as ChartType; box = { r0: r.r0, c0: r.c0, r1: r.r1, c1: r.c1 }; } }
  if (!box || box.r1 >= ROWS || box.c1 >= COLS) return null;
  const titleNode = kid(find(doc, 'chart'), 'title');
  const title = titleNode ? allText(titleNode).trim() : '';
  // Titlurile axelor: după locul axei (jos / sus = orizontală, stânga / dreapta = verticală).
  const look: { xTitle?: string; yTitle?: string; palette?: number; labels?: boolean; legend?: 't' | 'r' | 'none'; bg?: string; line?: string; noGrid?: boolean; font?: string; ink?: string; axMin?: number; axMax?: number; axStep?: number; fx?: 'shadow' | 'grad' } = {};
  // Fontul și culoarea textului: din formatarea textului (c:txPr) a întregului grafic, a legendei sau a axelor, primul găsit;
  // griurile obișnuite nu se păstrează.
  const txPrs = [find(doc, 'chartSpace'), kid(find(doc, 'chart'), 'legend'), ...plot.kids.filter((k) => /^(catAx|valAx|dateAx)$/.test(k.name))]
    .map((n) => kid(n, 'txPr')).filter((n): n is XNode => !!n);
  const face = txPrs.map((t) => find(t, 'latin')?.attrs.typeface ?? '').find((f) => f && !f.startsWith('+'));
  if (face && face !== 'Segoe UI' && chartFontOk(face)) look.font = face;
  const inkV = txPrs.map((t) => find(t, 'srgbClr')?.attrs.val ?? '').find((v) => /^[0-9a-f]{6}$/i.test(v));
  if (inkV && !/^(222222|333333|444444|555555|666666)$/i.test(inkV)) look.ink = '#' + inkV.toLowerCase();
  // Zona diagramei (c:chartSpace/c:spPr): umplerea plină și conturul, dacă nu sunt alb / lipsă.
  const spaceSp = kid(find(doc, 'chartSpace'), 'spPr');
  const solid = (n?: XNode) => { const v = kid(kid(n, 'solidFill'), 'srgbClr')?.attrs.val; return v && /^[0-9a-f]{6}$/i.test(v) ? '#' + v.toLowerCase() : undefined; };
  const bgC = solid(spaceSp), lnC = solid(kid(spaceSp, 'ln'));
  if (bgC && bgC !== '#ffffff') look.bg = bgC;
  if (lnC) look.line = lnC;
  // Liniile de grilă: un grafic cu axe la care nicio axă de valori nu are c:majorGridlines.
  const valAxes = plot.kids.filter((k) => k.name === 'valAx');
  if (valAxes.length && !valAxes.some((a) => kid(a, 'majorGridlines'))) look.noGrid = true;
  // Formatare axă: minimul, maximul și pasul axei valorilor (la puncte, a celei verticale).
  const vAx = type === 'scatter' || type === 'bubble' ? valAxes.find((a) => /^[lr]$/.test(kid(a, 'axPos')?.attrs.val ?? '')) : valAxes[0];
  const axNum = (n?: XNode) => { const v = Number(n?.attrs.val); return n && Number.isFinite(v) ? v : undefined; };
  Object.assign(look, cleanAxis({ axMin: axNum(kid(kid(vAx, 'scaling'), 'min')), axMax: axNum(kid(kid(vAx, 'scaling'), 'max')), axStep: axNum(kid(vAx, 'majorUnit')) }));
  // Legenda: lipsă (la cel puțin două serii sau la plăcintă) = „Fără”; sus / dreapta (și stânga) se păstrează.
  const legEl = kid(find(doc, 'chart'), 'legend');
  const nSer = kids(node, 'ser').length + (lineNode ? kids(lineNode, 'ser').length : 0);
  const round = type === 'pie' || type === 'doughnut';
  if (!legEl) { if (round || nSer > 1) look.legend = 'none'; }
  else if (!round) { const lp = kid(legEl, 'legendPos')?.attrs.val; if (lp === 't') look.legend = 't'; else if (lp === 'r' || lp === 'l' || lp === 'tr') look.legend = 'r'; }
  // Valorile pe grafic: o serie cu c:dLbls / c:showVal = 1 (la plăcintă procentele se arată oricum).
  if (type !== 'pie' && type !== 'doughnut' && type !== 'box' && [...kids(node, 'ser'), ...(lineNode ? kids(lineNode, 'ser') : [])].some((s) => kid(kid(s, 'dLbls') as XNode, 'showVal')?.attrs.val === '1')) look.labels = true;
  for (const ax of plot.kids) {
    if (!/^(catAx|valAx|dateAx|serAx)$/.test(ax.name)) continue;
    const t = kid(ax, 'title');
    const text = t ? allText(t).trim().slice(0, 100) : '';
    if (!text) continue;
    const pos = kid(ax, 'axPos')?.attrs.val;
    if ((pos === 'b' || pos === 't') && !look.xTitle) look.xTitle = text;
    else if ((pos === 'l' || pos === 'r') && !look.yTitle) look.yTitle = text;
  }
  // Paleta: dacă prima serie are prima culoare a uneia dintre paletele noastre, o recunoaștem.
  const first = kids(node, 'ser')[0];
  const fillOf = (n?: XNode): string | undefined => { if (!n) return undefined; if (n.name === 'srgbClr') return n.attrs.val; for (const k of n.kids) { const v = fillOf(k); if (v) return v; } return undefined; };
  // Degradeul: culoarea plină e ultimul punct al lui (primul e cel deschis).
  const gsl = kids(kid(kid(kid(first, 'spPr') as XNode, 'gradFill') as XNode, 'gsLst') as XNode, 'gs');
  const c0 = (gsl.length ? fillOf(gsl[gsl.length - 1]) : fillOf(first))?.toUpperCase();
  // Stiluri diagramă: umbra (a:outerShdw) sau degradeul pe formele seriilor / feliilor.
  const sers = [...kids(node, 'ser'), ...(lineNode ? kids(lineNode, 'ser') : [])];
  const sps = sers.flatMap((s) => [kid(s, 'spPr'), kid(kid(s, 'marker') as XNode, 'spPr'), ...kids(s, 'dPt').map((d) => kid(d, 'spPr'))]).filter((n): n is XNode => !!n);
  if (sps.some((n) => find(n, 'outerShdw'))) look.fx = 'shadow';
  else if (sps.some((n) => kid(n, 'gradFill'))) look.fx = 'grad';
  const pi = c0 ? PALETTES.findIndex(([, cols]) => cols[0].slice(1).toUpperCase() === c0) : -1;
  if (pi > 0) look.palette = pi;
  // Seriile ascunse (Selectare date): coloanele dintre seriile scrise care nu au serie și nu sunt etichete.
  const serNodes = [...kids(node, 'ser'), ...(lineNode ? kids(lineNode, 'ser') : [])];
  // Comutare rând / coloană: valorile primei serii stau pe un rând (mai multe coloane, un singur rând).
  const refOf = (s: XNode, name: string) => { const fx = kid(s, name) ? find(kid(s, name)!, 'f') : undefined; return fx ? parseChartRef(fx.text) : null; };
  const v0 = serNodes.length ? refOf(serNodes[0], 'val') : null;
  const byRow = !stat && canSwitchRC(type) && !!v0 && v0.r0 === v0.r1 && v0.c1 > v0.c0;
  const colOf = (s: XNode, name: string) => { const r = refOf(s, name); return !r ? -1 : byRow ? (r.r0 === r.r1 ? r.r0 : -1) : r.c0 === r.c1 ? r.c0 : -1; };
  const valCols = serNodes.map((s) => colOf(s, 'val')).filter((c) => c >= 0), catCols = serNodes.map((s) => colOf(s, 'cat')).filter((c) => c >= 0);
  const hide: number[] = [];
  if (!stat && canHideSeries(type) && valCols.length) for (let c = Math.min(...valCols) + 1; c < Math.max(...valCols); c++) if (!valCols.includes(c) && !catCols.includes(c)) hide.push(c);
  const srcSheet = refs.length ? parseChartRef(refs[0].text)?.sheet : undefined;
  return { id, type, title, range: `${cellId(box.r0, box.c0)}:${cellId(box.r1, box.c1)}`, ...(srcSheet && srcSheet !== sheetName ? { src: srcSheet } : {}), ...look, ...(hide.length ? { hide: hide.slice(0, 50) } : {}), ...(byRow ? { byRow: true } : {}) };
}

/** Felul graficului de tip nou (cx:chart), după layoutId-ul seriilor. */
const CX_LAYOUTS: Record<string, ChartType> = { waterfall: 'waterfall', funnel: 'funnel', treemap: 'treemap', sunburst: 'sunburst', boxWhisker: 'box', clusteredColumn: 'hist' };

/**
 * Graficele de tip nou din .xlsx (cx:chartSpace: cascadă, pâlnie, hartă de suprafețe, soare, cutie, histogramă, Pareto).
 * Datele vin din cx:f, de obicei un nume ascuns (_xlchart.v1.0) care trimite la zonă. Harta regiunilor nu se aduce.
 */
export function chartExFromXml(xml: string, sheetName: string, id: string, names: Map<string, string>): SheetChart | null {
  const doc = parseXml(xml);
  const sers = kids(find(doc, 'plotAreaRegion'), 'series');
  const layouts = sers.map((x) => x.attrs.layoutId ?? '');
  let type: ChartType | undefined = CX_LAYOUTS[layouts[0]];
  if (type === 'hist' && layouts.includes('paretoLine')) type = 'pareto';
  if (!type) return null;
  let box: { r0: number; c0: number; r1: number; c1: number } | null = null;
  let sheet: string | undefined;
  for (const d of kids(find(doc, 'chartData'), 'data')) {
    for (const dim of d.kids) {
      const f = kid(dim, 'f')?.text.trim();
      if (!f) continue;
      const ref = parseChartRef(names.get(f) ?? f);
      if (!ref || (sheet !== undefined && ref.sheet !== sheet)) return null;
      sheet = ref.sheet;
      box = box ? { r0: Math.min(box.r0, ref.r0), c0: Math.min(box.c0, ref.c0), r1: Math.max(box.r1, ref.r1), c1: Math.max(box.c1, ref.c1) } : ref;
    }
  }
  if (!box || box.r1 >= ROWS || box.c1 >= COLS) return null;
  // Titlul: textul din cx:tx (cx:txData/cx:v sau cx:rich); cx:txPr are doar formatarea.
  const tx = kid(kid(find(doc, 'chart'), 'title'), 'tx');
  const title = tx ? (find(tx, 'v')?.text ?? allText(tx)).trim().slice(0, 200) : '';
  const look: { labels?: boolean; legend?: 'none' } = {};
  if (sers.some((x) => kid(kid(x, 'dataLabels'), 'visibility')?.attrs.value === '1')) look.labels = true;
  if (!kid(find(doc, 'chart'), 'legend') && type !== 'treemap' && type !== 'sunburst') look.legend = 'none';
  return { id, type, title, range: `${cellId(box.r0, box.c0)}:${cellId(box.r1, box.c1)}`, ...(sheet && sheet !== sheetName ? { src: sheet } : {}), ...look };
}

// Filtrul automat în .xlsx: valorile lăsate la vedere (<filters>), condițiile (<customFilters>, <top10>, <dynamicFilter>).
const F_OPS: [FilterOp, string][] = [['gt', 'greaterThan'], ['lt', 'lessThan'], ['ge', 'greaterThanOrEqual'], ['le', 'lessThanOrEqual'], ['eq', 'equal'], ['ne', 'notEqual']];
const xNum = (v: string) => { const s = v.trim(); return /^[-+]?\d+([.,]\d+)?$/.test(s) ? s.replace(',', '.') : s; };

function condXml(cond: FilterCond): string {
  const op = F_OPS.find(([k]) => k === cond.op)?.[1];
  if (op) return `<customFilters><customFilter${op === 'equal' ? '' : ` operator="${op}"`} val="${escapeXml(xNum(cond.v1))}"/></customFilters>`;
  if (cond.op === 'between') return `<customFilters and="1"><customFilter operator="greaterThanOrEqual" val="${escapeXml(xNum(cond.v1))}"/>`
    + `<customFilter operator="lessThanOrEqual" val="${escapeXml(xNum(cond.v2 ?? cond.v1))}"/></customFilters>`;
  if (cond.op === 'text') return `<customFilters><customFilter val="*${escapeXml(cond.v1)}*"/></customFilters>`;
  if (cond.op === 'top' || cond.op === 'bottom') {
    const n = Math.max(1, Math.round(Number(xNum(cond.v1))) || 10);
    return `<top10${cond.op === 'bottom' ? ' top="0"' : ''} val="${n}"/>`;
  }
  return `<dynamicFilter type="${cond.op === 'above' ? 'aboveAverage' : 'belowAverage'}"/>`;
}

export function autoFilterXml(sheet: Sheet, results: Record<string, Result>, dxfOf?: (fc: FilterColor) => number): string {
  const f = sheet.filter!;
  const end = Math.max(filterEnd(sheet.cells, f), f.r + 1);
  const cols: string[] = [];
  for (let c = f.c0; c <= f.c1; c++) {
    const name = colName(c);
    const cond = f.cond?.[name];
    if (cond) { cols.push(`<filterColumn colId="${c - f.c0}">${condXml(cond)}</filterColumn>`); continue; }
    const fc = f.color?.[name];
    if (fc && dxfOf) { cols.push(`<filterColumn colId="${c - f.c0}"><colorFilter dxfId="${dxfOf(fc)}"${fc.kind === 'fg' ? ' cellColor="0"' : ''}/></filterColumn>`); continue; }
    const hidden = new Set(f.hidden[name] ?? []);
    if (!hidden.size) continue;
    const shown = columnValues(sheet.cells, results, sheet.styles, f, c).filter((v) => !hidden.has(v.text));
    const blank = shown.some((v) => v.text === EMPTY);
    cols.push(`<filterColumn colId="${c - f.c0}"><filters${blank ? ' blank="1"' : ''}>`
      + shown.filter((v) => v.text !== EMPTY).map((v) => `<filter val="${escapeXml(v.text)}"/>`).join('') + '</filters></filterColumn>');
  }
  return `<autoFilter ref="${cellId(f.r, f.c0)}:${cellId(end, f.c1)}"${cols.length ? `>${cols.join('')}</autoFilter>` : '/>'}`;
}

/** Filtrul automat citit din Excel; valorile care nu sunt în lista celor „la vedere” devin debifate. */
function autoFilterFrom(af: XNode | undefined, cells: Cells, styles: Styles, dxfColors: { bg: string; fg: string }[] = []): SheetFilter | undefined {
  const m = /^\$?([A-Z]{1,3})\$?(\d+)(?::\$?([A-Z]{1,3})\$?(\d+))?$/i.exec(af?.attrs.ref ?? '');
  if (!af || !m) return undefined;
  const r = Number(m[2]) - 1, c0 = colIndex(m[1].toUpperCase()), c1 = colIndex((m[3] ?? m[1]).toUpperCase());
  const r1 = m[4] ? Number(m[4]) - 1 : r;
  if (r < 0 || r >= ROWS || c0 < 0 || c1 < c0 || c1 >= COLS) return undefined;
  const f: SheetFilter = { r, c0, c1, hidden: {} };
  const low = (s: string) => s.trim().toLocaleLowerCase('ro-RO');
  // Capătul tabelului se află o singură dată (pe un tabel lat, la fiecare rând ar dura minute).
  let endCache = -1;
  const endRow = () => (endCache >= 0 ? endCache : (endCache = Math.max(r1, filterEnd(cells, f))));
  for (const fc of kids(af, 'filterColumn')) {
    const c = c0 + Number(fc.attrs.colId ?? -1);
    if (!(c >= c0 && c <= c1)) continue;
    const name = colName(c);
    const list = kid(fc, 'filters');
    const custom = kids(kid(fc, 'customFilters'), 'customFilter');
    const top = kid(fc, 'top10');
    const dyn = kid(fc, 'dynamicFilter');
    const colorF = kid(fc, 'colorFilter');
    if (colorF) {
      const d = dxfColors[Number(colorF.attrs.dxfId)];
      const kind = colorF.attrs.cellColor === '0' || colorF.attrs.cellColor === 'false' ? 'fg' : 'bg';
      if (d) (f.color ??= {})[name] = { kind, color: d[kind] };
    } else if (list) {
      const shown = new Set(kids(list, 'filter').map((x) => low(x.attrs.val ?? '')));
      if (list.attrs.blank === '1' || list.attrs.blank === 'true') shown.add(low(EMPTY));
      const hidden = new Set<string>();
      const end = endRow();
      for (let rr = r + 1; rr <= end; rr++) {
        const id = cellId(rr, c);
        if ((cells[id] ?? '').startsWith('=')) continue;
        const v = cellText(cells[id], undefined, styles[id]).trim() || EMPTY;
        if (!shown.has(low(v))) hidden.add(v);
      }
      if (hidden.size) f.hidden[name] = [...hidden];
    } else if (custom.length) {
      const opOf = (x: XNode) => F_OPS.find(([, o]) => o === (x.attrs.operator ?? 'equal'))?.[0];
      const v = (x: XNode) => x.attrs.val ?? '';
      let cond: FilterCond | null = null;
      if (custom.length === 1) {
        const o = opOf(custom[0]);
        const w = /^\*(.+)\*$/.exec(v(custom[0]));
        if (o === 'eq' && w && !/[*?]/.test(w[1])) cond = { op: 'text', v1: w[1] };
        else if (o && !/[*?]/.test(v(custom[0]))) cond = { op: o, v1: v(custom[0]) };
      } else if (custom.length === 2 && kid(fc, 'customFilters')?.attrs.and === '1') {
        const [a, b] = custom.map(opOf);
        if ((a === 'ge' || a === 'gt') && (b === 'le' || b === 'lt')) cond = { op: 'between', v1: v(custom[0]), v2: v(custom[1]) };
      }
      if (cond) (f.cond ??= {})[name] = cond;
    } else if (top && top.attrs.percent !== '1') {
      (f.cond ??= {})[name] = { op: top.attrs.top === '0' ? 'bottom' : 'top', v1: top.attrs.val ?? '10' };
    } else if (dyn && (dyn.attrs.type === 'aboveAverage' || dyn.attrs.type === 'belowAverage')) {
      (f.cond ??= {})[name] = { op: dyn.attrs.type === 'aboveAverage' ? 'above' : 'below', v1: '' };
    }
  }
  return f;
}
