// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
import { cleanTheme, type BookTheme } from './themeColors';
import { cleanThread, type CellComment } from './comments';
import { docProps, type DocProps } from '../docs/format';
import { cleanSolver, type SheetSolver } from './solver';
import { cleanPics, type SheetPic } from './pics';
import { cleanSparks, type SheetSpark } from './sparkline';
import { cleanScenarios, type SheetScenario } from './scenario';
import { cleanDataTables, type SheetDataTable } from './datatable';
import type { NumFmt } from './numfmt';
import { chartFontOk, cleanAt, cleanAxis, cleanHide, isHex, type ChartType, type SheetChart } from './chart';
import { cleanPrint, SheetPrint } from './print';
import { cleanLists, SheetList } from './lists';
import { cleanRules, SheetRule } from './cond';
import type { TimeLevel } from './timeline';
import { cleanMerges } from './merge';
import { cleanBorder, cleanLineStyle, type LineStyle } from './border';
import type { DefinedName, ExtBook, PivotDef } from './formula';
import { cleanLinks } from './extLinks';
import { cleanRels, type SheetRel } from './relations';
import { cleanMacros, type SheetMacro } from './macros';
import { cleanLevels, Levels } from './group';
import { cleanBookLock, cleanSheetPw, type SheetPw } from './sheetPassword';
import { cleanTables, cleanTableStyles, type CustomTableStyle, type SheetTable } from './table';
import { cleanQuery, type SheetQuery } from './query';
import { cleanChanges, type CellChange } from './changes';
import { sheetBaseName } from './tabs';

// Formatul fișierelor .ssheet. Celulele sunt păstrate doar dacă au conținut ("A1": "text").
export interface CellStyle {
  b?: boolean;
  i?: boolean;
  u?: boolean;
  /** Text tăiat cu o linie (Ctrl+5 în Excel). */
  s?: boolean;
  /** Rotirea textului în grade (ca Orientare din Excel): pozitiv = în sus, negativ = în jos, între -90 și 90; STACKED (255) = literă sub literă. */
  rot?: number;
  /** Exponent (x²) sau indice (x₂): textul celulei e mai mic, sus sau jos. */
  pos?: 'sup' | 'sub';
  /** Alinierea verticală în celulă; lipsă = ca înainte (la mijloc, iar textul încadrat sus). */
  va?: 'top' | 'middle' | 'bottom';
  /** Retragerea textului de la margine, în trepte (ca Mărește retragerea din Excel), 1–15. */
  ind?: number;
  /** Fontul celulei (de exemplu „Arial”); lipsă = fontul obișnuit al tabelului. */
  font?: string;
  /** Mărimea textului, în puncte (ca în Excel: 11, 14…); lipsă = mărimea obișnuită. */
  sz?: number;
  color?: string;
  bg?: string;
  /** „across”: centrat peste celulele goale de alături care au și ele „across” (centrare pe selecție, fără îmbinare). */
  align?: 'left' | 'center' | 'right' | 'across';
  fmt?: NumFmt;
  /** Format particularizat, scris ca cod (de exemplu „#,##0.00 "buc."”, „[Red]-0;0”); are întâietate față de `fmt`. */
  code?: string;
  /** Zecimale afișate (pentru număr, lei, procent). */
  dec?: number;
  /** Textul lung se rupe pe mai multe rânduri în celulă. */
  wrap?: boolean;
  /** Chenarul: laturile trase („t” sus, „b” jos, „l” stânga, „r” dreapta), de exemplu „tblr”. */
  bd?: string;
  /** Felul liniei chenarului (lipsă = subțire) și culoarea ei (lipsă = culoarea textului), pe toate laturile celulei. */
  bdStyle?: LineStyle;
  bdColor?: string;
  /** Nota (comentariul) celulei, arătată când treci cu mouse-ul peste ea. */
  note?: string;
  /** Comentariul cu fir de discuție (comentariu + răspunsuri, cu autor și oră) și dacă e marcat rezolvat. */
  cmt?: CellComment[];
  cdone?: boolean;
  /** Celula se poate modifica și când foaia e protejată (în Excel: Format celule → Protecție → fără „Blocat”). */
  unlock?: boolean;
  /** Casetă de bifat în celulă: valoarea e ADEVĂRAT (bifată) sau FALS; clic sau Spațiu o schimbă. */
  chk?: boolean;
  /** Buton rotativ (săgețile ▲ ▼) sau bară de defilare în celulă: valoarea crește / scade cu `step`, între `min` și `max`. */
  spin?: CellSpin;
  /** Butoane de opțiune sau listă combo în celulă: valoarea e numărul variantei alese (1, 2, …), ca legătura de celulă a controalelor de formular. */
  opt?: CellOpt;
  /** Buton în celulă care rulează o macrocomandă (ca butonul din controalele de formular, cu macrocomanda atribuită). */
  btn?: CellBtn;
  /** Legătura celulei (adresă web sau e-mail), deschisă cu Ctrl+clic. */
  link?: string;
  /** Ignorare eroare: celula cu număr scris ca text nu mai are triunghiul verde (ignoredErrors în .xlsx). */
  ign?: boolean;
  /** Numele stilului de celulă al utilizatorului pus pe celulă: când stilul se modifică, celula îl urmează. */
  sty?: string;
}

/** O adresă bună pentru o legătură din celulă: web, e-mail sau un loc din tabel („#Foaia 2!A1”); altfel null. */
export function cleanLink(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().slice(0, 2000);
  if (/^(https?:\/\/|mailto:)\S+$/i.test(t) || /^#.+!\$?[A-Z]{1,3}\$?\d+$/i.test(t)) return t;
  if (/^www\.\S+$/i.test(t)) return 'https://' + t;
  if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(t)) return 'mailto:' + t;
  return null;
}

export interface Sheet {
  name: string;
  cells: Record<string, string>;
  /** Formatarea celulelor; doar celulele formatate apar aici. */
  styles: Record<string, CellStyle>;
  /** Lățimea coloanelor schimbate de utilizator, în pixeli ("B": 160). */
  colW: Record<string, number>;
  /** Înălțimea rândurilor schimbate de utilizator, în pixeli ("5": 60 pentru rândul 5). */
  rowH?: Record<string, number>;
  /** Rândurile ascunse de mână (numerele lor, de la 1), ca în Excel (Ascunde / Afișează). */
  hideRows?: number[];
  /** Coloanele ascunse de mână (numerele lor, de la 1: A = 1). */
  hideCols?: number[];
  /** Rândurile și coloanele grupate (nivelul fiecăruia, de la 1; vezi group.ts). */
  rowLvl?: Levels;
  colLvl?: Levels;
  /** Foaia e protejată: celulele blocate (toate, în afară de cele cu `unlock`) nu se pot modifica. */
  protect?: boolean;
  /** Hash-ul parolei protecției (fără ea, protecția se oprește cu un clic). */
  protectPw?: SheetPw;
  /** Câte rânduri de sus rămân pe loc la derulare (0 = niciunul, cel mult MAX_FREEZE_ROWS). */
  freeze?: number;
  /** Câte coloane din stânga rămân pe loc la derularea spre dreapta (cel mult MAX_FREEZE_COLS). */
  freezeCol?: number;
  /** Filtrul pe coloane, dacă e pornit. */
  filter?: SheetFilter;
  /** Graficele foii (se redesenează singure când se schimbă datele). */
  charts?: SheetChart[];
  /** Pozele puse peste celule (vezi pics.ts). */
  pics?: SheetPic[];
  /** Setările de tipărire (zonă, orientare, potrivire pe pagină). */
  print?: SheetPrint;
  /** Listele derulante (valorile permise pe zone de celule). */
  lists?: SheetList[];
  /** Formatarea condiționată (celule colorate singure după valoare). */
  rules?: SheetRule[];
  /** Celulele îmbinate, ca zone („A1:C1”); conținutul stă în celula din stânga-sus. */
  merges?: string[];
  /** Culoarea filei de jos (ca „Culoare filă” în Excel). */
  tab?: string;
  /** Liniile grilei nu se văd pe ecran (ca Vizualizare → Linii de grilă în Excel); chenarele puse rămân. */
  noGrid?: boolean;
  /** Literele coloanelor și numerele rândurilor nu se văd (ca Vizualizare → Titluri); se păstrează în .xlsx. */
  noHead?: boolean;
  /** Valorile zero nu se arată (celula pare goală), ca Opțiuni → „Afișează zero în celulele cu valoare zero” debifat; se păstrează în .xlsx. */
  noZero?: boolean;
  /** Butoanele de filtrare (ca Slicer în Excel): coloanele filtrului care au câte un panou cu butoane, unul pe fiecare valoare. */
  slicers?: string[];
  /** Pe foaia unui rezumat cu filtru de raport: panoul cu butoane pentru valorile filtrului din B3 (slicer legat de rezumat). */
  pvSlicer?: boolean;
  /** Pe foaia unui rezumat cu filtru de raport pe o coloană cu date: cronologia (nivelul ei) legată de filtrul din B3. */
  pvTimeline?: TimeLevel;
  /** Cronologiile (ca Timeline în Excel): coloanele cu date ale filtrului care au un panou cu perioade, cu nivelul ales. */
  timelines?: { col: string; level: TimeLevel }[];
  /** Minigraficele din celule (linie, coloane, câștig / pierdere), vezi sparkline.ts. */
  sparks?: SheetSpark[];
  /** Scenariile foii (Manager de scenarii): seturi de valori cu nume pentru aceleași celule, vezi scenario.ts. */
  scenarios?: SheetScenario[];
  /** Tabelele de date (Ce-ar fi dacă) care se recalculează singure. */
  dataTables?: SheetDataTable[];
  /** Modelul Rezolvitorului (obiectiv, celule schimbate, condiții), vezi solver.ts. */
  solver?: SheetSolver;
  /** Foaia e ascunsă: fila ei nu se vede (formulele o folosesc mai departe). Cel puțin o foaie rămâne vizibilă. */
  hidden?: boolean;
  /** Tabelele cu nume (Inserare → Tabel), vezi table.ts. */
  tables?: SheetTable[];
  /** Foaia e rezultatul unei interogări (Date → Preluare date → Din tabel / zonă): sursa și pașii, refăcuți la Reîmprospătare. */
  query?: SheetQuery;
}

/** Filtru: capul de tabel e pe rândul r, între coloanele c0 și c1; `hidden` are valorile debifate pe coloane ("B": ["5"]). */
export interface SheetFilter {
  r: number;
  c0: number;
  c1: number;
  hidden: Record<string, string[]>;
  /** Filtrele cu condiție pe coloane ("C": mai mare decât 1000), ca Filtre numerice / de text din Excel. */
  cond?: Record<string, FilterCond>;
  /** Filtrele după culoare ("C": doar celulele cu fundal galben), ca Filtrare după culoare din Excel. */
  color?: Record<string, FilterColor>;
}

/** Culoarea după care se filtrează: a fundalului sau a textului; "none" = fără fundal / textul obișnuit. */
export interface FilterColor { kind: 'bg' | 'fg'; color: string }

/** Condiția unui filtru: aceleași comparații ca la Evidențiere (mai mare, între, conține, primele N, peste medie). */
export interface FilterCond { op: FilterOp; v1: string; v2?: string }
export type FilterOp = 'gt' | 'lt' | 'ge' | 'le' | 'between' | 'eq' | 'ne' | 'text' | 'top' | 'bottom' | 'above' | 'below';
export const FILTER_OPS: FilterOp[] = ['gt', 'lt', 'ge', 'le', 'between', 'eq', 'ne', 'text', 'top', 'bottom', 'above', 'below'];

export interface SheetDoc {
  format: 'suite-sheet';
  version: 1;
  title: string;
  sheets: Sheet[];
  updatedAt: string;
  /** Numele definite (ca în Excel: ExpDat = 'Date'!$E$11), folosite în formule. */
  names?: DefinedName[];
  /** Tabelele pivot din fișierele importate, pentru GETPIVOTDATA. */
  pivots?: PivotDef[];
  /** „regex”: căutările folosesc expresii regulate, ca în fișierul LibreOffice din care s-a importat tabelul. */
  match?: 'regex';
  /** „manual”: formulele se recalculează doar la F9 (ca Opțiuni de calcul → Manual); lipsă = automat. */
  calc?: 'manual';
  /** Calculul iterativ pornit (referințele circulare se calculează pe rând): numărul maxim de treceri și schimbarea maximă. */
  iter?: { max: number; delta: number };
  /** Structura registrului e protejată: foile nu se pot adăuga, șterge, redenumi, muta, ascunde sau colora. */
  lockBook?: { pw?: SheetPw };
  /** Proprietățile registrului (Fișier → Proprietăți): subiectul, autorul, cuvintele cheie; titlul e `title`. */
  props?: Omit<DocProps, 'title'>;
  /** Stilurile de celulă făcute de utilizator (Stiluri celulă → Stil nou…): numele și formatul. */
  cellStyles?: UserCellStyle[];
  /** Tema registrului (Aspect pagină → Teme): culorile paletei; lipsă = tema obișnuită. */
  theme?: BookTheme;
  /** Registrele externe din formule ([Buget.xlsx]Foaie1!A1), cu valorile lor de la ultima citire (Date → Editare legături). */
  links?: ExtBook[];
  /** Stilurile de tabel făcute de utilizator (Proiectare tabel → ＋ Stil de tabel nou…). */
  tableStyles?: CustomTableStyle[];
  /** Revizuire → Afișare modificări: celulele schimbate (cele mai noi întâi). */
  changes?: CellChange[];
  /** Date → 🔗 Relații: legăturile dintre tabele (cheia din tabelul cu multe rânduri → cheia din tabelul de căutare). */
  rels?: SheetRel[];
  /** Vizualizare ? Macrocomenzi: pa?ii ?nregistra?i (valori, formule, formatare), repeta?i cu un clic. */
  macros?: SheetMacro[];
}

export interface UserCellStyle { name: string; st: Partial<CellStyle> }
/** Câmpurile de format pe care le ține un stil de celulă (aceleași ca în fereastra Formatare celule). */
export const CELL_STYLE_KEYS = ['fmt', 'dec', 'code', 'align', 'va', 'wrap', 'ind', 'rot', 'font', 'sz', 'b', 'i', 'u', 's', 'pos', 'color', 'bg', 'unlock'] as const;

/** Stilurile utilizatorului, curățate: cel mult 100, nume unice de cel mult 60 de litere, doar câmpurile de format simple. */
export function cleanCellStyles(raw: unknown): UserCellStyle[] {
  if (!Array.isArray(raw)) return [];
  const out: UserCellStyle[] = [];
  for (const x of raw.slice(0, 100)) {
    const name = typeof x?.name === 'string' ? x.name.trim().slice(0, 60) : '';
    if (!name || out.some((o) => o.name.toLocaleLowerCase('ro') === name.toLocaleLowerCase('ro')) || !x.st || typeof x.st !== 'object') continue;
    const st: Record<string, unknown> = {};
    for (const k of CELL_STYLE_KEYS) { const v = x.st[k]; if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') st[k] = v; }
    out.push({ name, st: st as Partial<CellStyle> });
  }
  return out;
}

// A–XFD (16.384), cât .xlsx. Coloanele desenate pe fiecare rând vizibil sunt cele folosite (minim VIEW_COLS); la foile
// late, doar cele din jurul ecranului (Sheets.tsx colWin).
export const COLS = 16384;
/** Numele ultimei coloane (XFD), pentru mesaje. */
export const LAST_COL = 'XFD';
/** Lățimile, ascunderea și stilurile date în fișier pentru coloane întregi sau celule goale repetate se citesc doar până aici
 *  (sau până la ultima coloană folosită): fișierele le scriu des până la ultima coloană, iar 16.384 ar umple foaia degeaba. */
export const STYLE_COLS = 1024;
/** Cel mult atâtea rânduri / coloane înghețate (restul ecranului trebuie să rămână pentru derulare). */
export const MAX_FREEZE_ROWS = 100;
export const MAX_FREEZE_COLS = 30;
/** Numărul de rânduri sau coloane înghețate, curățat: întreg între 1 și max, altfel 0. */
export function cleanFreeze(n: unknown, max: number): number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 1 ? Math.min(max, Math.floor(n)) : 0;
}
/** Câte coloane are o foaie goală pe ecran (A–AN, destul pentru un pontaj pe 31 de zile). */
export const VIEW_COLS = 40;
// Cât Excel (1.048.576): se desenează doar rândurile vizibile, iar zonele A:A se opresc la ultimul rând scris.
export const ROWS = 1048576;
/** Până unde se aplică o formatare pe coloane întregi într-un tabel mic (cât era foaia înainte); mai jos, până la ultimul rând folosit. */
export const WORK_ROWS = 10000;

/** Ultima coloană (de la 0) care are ceva în una din colecții; -1 dacă sunt goale. */
export function lastUsedCol(...maps: Record<string, unknown>[]): number {
  let c = -1;
  for (const m of maps) for (const id of Object.keys(m)) { const p = parseCellId(id); if (p && p.c > c) c = p.c; }
  return Math.min(c, COLS - 1);
}

/** Ultimul rând (de la 0) care are ceva în una din colecții (celule, formatări); -1 dacă sunt goale. */
export function lastUsedRow(...maps: Record<string, unknown>[]): number {
  let last = -1;
  for (const m of maps) {
    for (const id of Object.keys(m)) {
      let i = 0;
      while (i < id.length && id.charCodeAt(i) >= 65) i++;
      const r = Number(id.slice(i)) - 1;
      if (r > last) last = r;
    }
  }
  return last;
}

/** Ultimul rând pe care îl atinge o operație pe o zonă care poate fi o coloană întreagă (A1:A1048576). */
export function workEnd(...maps: Record<string, unknown>[]): number {
  return Math.max(WORK_ROWS - 1, lastUsedRow(...maps));
}

export function emptySheetDoc(): SheetDoc {
  return {
    format: 'suite-sheet',
    version: 1,
    title: '',
    sheets: [emptySheet(sheetBaseName(1))],
    updatedAt: new Date().toISOString(),
  };
}

export function emptySheet(name: string): Sheet {
  return { name, cells: {}, styles: {}, colW: {} };
}

/** Butonul rotativ / bara de defilare din celulă (ca Spin Button / Scroll Bar din controalele de formular). */
export interface CellSpin { min: number; max: number; step: number; bar?: boolean }

/** Setările butonului rotativ, curățate: minimul sub maxim, pasul pozitiv (cel mult cât toată plaja). */
export function cleanSpin(raw: unknown): CellSpin | undefined {
  const v = raw as CellSpin;
  if (!v || typeof v !== 'object') return undefined;
  const { min, max, step } = v;
  if (![min, max, step].every((n) => typeof n === 'number' && Number.isFinite(n)) || min >= max || step <= 0 || step > max - min) return undefined;
  return { min, max, step, ...(v.bar === true ? { bar: true } : {}) };
}

/** Butoanele de opțiune / lista combo din celulă (ca Option Button / Combo Box): variantele și felul (combo = listă derulantă). */
export interface CellOpt { items: string[]; combo?: boolean }
export const OPT_MAX = 50;

/** Variantele curățate: texte nevide, cel mult 50, fiecare de cel mult 100 de semne. */
export function cleanOpt(raw: unknown): CellOpt | undefined {
  const v = raw as CellOpt;
  if (!v || typeof v !== 'object' || !Array.isArray(v.items)) return undefined;
  const items = v.items.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim().slice(0, 100)).slice(0, OPT_MAX);
  if (!items.length) return undefined;
  return { items, ...(v.combo === true ? { combo: true } : {}) };
}

/** Butonul din celulă: numele macrocomenzii pe care o rulează și textul de pe el (lipsă = textul celulei sau numele macrocomenzii). */
export interface CellBtn { macro: string; label?: string }

/** Butonul curățat: numele macrocomenzii nevid (cel mult 60 de semne), textul de cel mult 60 de semne. */
export function cleanBtn(raw: unknown): CellBtn | undefined {
  const v = raw as CellBtn;
  if (!v || typeof v !== 'object' || typeof v.macro !== 'string' || !v.macro.trim() || v.macro.length > 60) return undefined;
  const label = typeof v.label === 'string' ? v.label.trim().slice(0, 60) : '';
  return { macro: v.macro.trim(), ...(label ? { label } : {}) };
}

/** Numărul variantei alese dintr-o valoare de celulă (1…n), sau 0 dacă nu e aleasă niciuna. */
export function optIndex(raw: string | undefined, n: number): number {
  const k = Number(String(raw ?? '').trim());
  return Number.isInteger(k) && k >= 1 && k <= n ? k : 0;
}

export function parseSheetDoc(text: string): SheetDoc {
  const data = JSON.parse(text);
  if (data?.format !== 'suite-sheet') throw new Error('Fișierul nu este un tabel Cyber Office Studio.');
  // Întâi stilurile de tabel proprii, ca tabelele care le folosesc să le găsească.
  const tableStyles = cleanTableStyles(data.tableStyles);
  const sheets: Sheet[] = Array.isArray(data.sheets) && data.sheets.length
    ? data.sheets.map((s: Sheet, i: number) => ({
      name: String(s?.name ?? `Foaia ${i + 1}`),
      cells: cleanCells(s?.cells),
      styles: cleanStyles(s?.styles),
      colW: cleanWidths(s?.colW),
      ...(Object.keys(cleanHeights(s?.rowH)).length ? { rowH: cleanHeights(s?.rowH) } : {}),
      ...(cleanHideRows(s?.hideRows).length ? { hideRows: cleanHideRows(s?.hideRows) } : {}),
      ...(cleanHideRows(s?.hideCols, COLS).length ? { hideCols: cleanHideRows(s?.hideCols, COLS) } : {}),
      ...(cleanLevels(s?.rowLvl, ROWS) ? { rowLvl: cleanLevels(s?.rowLvl, ROWS) } : {}),
      ...(cleanLevels(s?.colLvl, COLS) ? { colLvl: cleanLevels(s?.colLvl, COLS) } : {}),
      ...(s?.protect === true ? { protect: true } : {}),
      ...(s?.protect === true && cleanSheetPw(s?.protectPw) ? { protectPw: cleanSheetPw(s?.protectPw) } : {}),
      ...(cleanFreeze(s?.freeze, MAX_FREEZE_ROWS) ? { freeze: cleanFreeze(s?.freeze, MAX_FREEZE_ROWS) } : {}),
      ...(cleanFreeze(s?.freezeCol, MAX_FREEZE_COLS) ? { freezeCol: cleanFreeze(s?.freezeCol, MAX_FREEZE_COLS) } : {}),
      ...(cleanFilter(s?.filter) ? { filter: cleanFilter(s?.filter) } : {}),
      ...(cleanCharts(s?.charts).length ? { charts: cleanCharts(s?.charts) } : {}),
      ...(cleanPics(s?.pics, ROWS, COLS).length ? { pics: cleanPics(s?.pics, ROWS, COLS) } : {}),
      ...(cleanPrint(s?.print) ? { print: cleanPrint(s?.print) } : {}),
      ...(cleanLists(s?.lists).length ? { lists: cleanLists(s?.lists) } : {}),
      ...(cleanRules(s?.rules).length ? { rules: cleanRules(s?.rules) } : {}),
      ...(cleanMerges(s?.merges).length ? { merges: cleanMerges(s?.merges) } : {}),
      ...(typeof s?.tab === 'string' && COLOR.test(s.tab) ? { tab: s.tab } : {}),
      ...(s?.hidden === true ? { hidden: true } : {}),
      ...(cleanSparks(s?.sparks).length ? { sparks: cleanSparks(s?.sparks) } : {}),
      ...(cleanScenarios(s?.scenarios).length ? { scenarios: cleanScenarios(s?.scenarios) } : {}),
      ...(cleanDataTables(s?.dataTables).length ? { dataTables: cleanDataTables(s?.dataTables) } : {}),
      ...(cleanTables(s?.tables).length ? { tables: cleanTables(s?.tables) } : {}),
      ...(cleanSolver(s?.solver) ? { solver: cleanSolver(s?.solver)! } : {}),
      ...(s?.noGrid === true ? { noGrid: true } : {}),
      ...(s?.noHead === true ? { noHead: true } : {}),
      ...(s?.noZero === true ? { noZero: true } : {}),
      ...(Array.isArray(s?.slicers) && s.slicers.some((x: unknown) => typeof x === 'string' && /^[A-Z]{1,3}$/.test(x))
        ? { slicers: [...new Set((s.slicers as unknown[]).filter((x): x is string => typeof x === 'string' && /^[A-Z]{1,3}$/.test(x)))].slice(0, 12) } : {}),
      ...(cleanTimelines(s?.timelines).length ? { timelines: cleanTimelines(s?.timelines) } : {}),
      ...(s?.pvSlicer === true ? { pvSlicer: true } : {}),
      ...(cleanQuery(s?.query) ? { query: cleanQuery(s?.query)! } : {}),
      ...(['y', 'q', 'm', 'd'].includes(String(s?.pvTimeline)) ?{ pvTimeline: s.pvTimeline as TimeLevel } : {}),
    }))
    : [emptySheet('Foaia 1')];
  if (sheets.every((s) => s.hidden)) delete sheets[0].hidden;
  const names = cleanNames(data.names);
  const pivots = cleanPivots(data.pivots);
  const cellStyles = cleanCellStyles(data.cellStyles);
  const theme = cleanTheme(data.theme);
  const links = cleanLinks(data.links);
  const changes = cleanChanges(data.changes);
  const rels = cleanRels(data.rels);
  const macros = cleanMacros(data.macros);
  return { ...emptySheetDoc(), title: String(data.title ?? ''), ...(sheetProps(data) ? { props: sheetProps(data) } : {}), sheets, updatedAt: String(data.updatedAt ?? ''), ...(names.length ? { names } : {}),
    ...(pivots.length ? { pivots } : {}), ...(data.calc === 'manual' ? { calc: 'manual' as const } : {}), ...(cleanIter(data.iter) ? { iter: cleanIter(data.iter) } : {}),
    ...(cleanBookLock(data.lockBook) ? { lockBook: cleanBookLock(data.lockBook) } : {}), ...(cellStyles.length ? { cellStyles } : {}), ...(theme ? { theme } : {}),
    ...(links.length ? { links } : {}), ...(tableStyles.length ? { tableStyles } : {}), ...(changes.length ? { changes } : {}), ...(rels.length ? { rels } : {}), ...(macros.length ? { macros } : {}) };
}

/** Setările calculului iterativ, curățate: 1–32767 treceri, schimbarea maximă între 0 și 1000. */
export function cleanIter(raw: unknown): { max: number; delta: number } | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const { max, delta } = raw as { max?: unknown; delta?: unknown };
  const m = typeof max === 'number' && Number.isFinite(max) ? Math.max(1, Math.min(32767, Math.round(max))) : 100;
  const d = typeof delta === 'number' && Number.isFinite(delta) ? Math.max(0, Math.min(1000, delta)) : 0.001;
  return { max: m, delta: d };
}

function cleanPivots(raw: unknown): PivotDef[] {
  if (!Array.isArray(raw)) return [];
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 100) : []);
  const out: PivotDef[] = [];
  for (const p of raw.slice(0, 500)) {
    if (!p || !str(p.sheet) || !str(p.target) || !str(p.source) || !Array.isArray(p.data)) continue;
    const data = p.data.filter((d: unknown) => d && str((d as { field?: unknown }).field))
      .map((d: { field: string; fn?: unknown; name?: unknown }) => ({ field: d.field, fn: str(d.fn) || 'sum', ...(str(d.name) ? { name: str(d.name) } : {}) }));
    if (!data.length) continue;
    const def: PivotDef = { sheet: p.sheet, target: p.target, source: p.source, rows: strs(p.rows), cols: strs(p.cols), data };
    if (p.hide && typeof p.hide === 'object') def.hide = Object.fromEntries(Object.entries(p.hide).map(([k, v]) => [k, strs(v)]));
    if (p.page && typeof p.page === 'object') def.page = Object.fromEntries(Object.entries(p.page).filter(([, v]) => typeof v === 'string')) as Record<string, string>;
    const mk = p.make, sp = mk?.spec, rg = sp?.range;
    const int = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 0;
    if (mk && str(mk.src) && sp && rg && [rg.r0, rg.r1, rg.c0, rg.c1, sp.rowCol, sp.valCol].every(int) && str(sp.op)) def.make = { src: mk.src, spec: sp };
    out.push(def);
  }
  return out;
}

function cleanNames(raw: unknown): DefinedName[] {
  if (!Array.isArray(raw)) return [];
  const out: DefinedName[] = [];
  for (const d of raw.slice(0, 5000)) {
    if (!d || typeof d.name !== 'string' || typeof d.ref !== 'string' || !d.name.trim() || !d.ref.trim()) continue;
    out.push(typeof d.sheet === 'string' ? { name: d.name, ref: d.ref, sheet: d.sheet } : { name: d.name, ref: d.ref });
  }
  return out;
}

/** Cronologiile citite din fișier: coloane valide, câte una, cel mult 6. */
function cleanTimelines(raw: unknown): { col: string; level: TimeLevel }[] {
  if (!Array.isArray(raw)) return [];
  const out: { col: string; level: TimeLevel }[] = [];
  for (const t of raw as { col?: unknown; level?: unknown }[]) {
    if (!t || typeof t.col !== 'string' || !/^[A-Z]{1,3}$/.test(t.col) || out.some((x) => x.col === t.col)) continue;
    out.push({ col: t.col, level: ['y', 'q', 'm', 'd'].includes(t.level as string) ? t.level as TimeLevel : 'm' });
  }
  return out.slice(0, 6);
}

function cleanFilter(raw: unknown): SheetFilter | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const f = raw as Record<string, unknown>;
  const ok = (v: unknown, max: number): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < max;
  if (!ok(f.r, ROWS) || !ok(f.c0, COLS) || !ok(f.c1, COLS) || f.c1 < f.c0) return undefined;
  const hidden: Record<string, string[]> = {};
  if (f.hidden && typeof f.hidden === 'object') {
    for (const [k, v] of Object.entries(f.hidden)) {
      if (/^[A-Z]+$/.test(k) && Array.isArray(v) && v.length) hidden[k] = v.map(String);
    }
  }
  const cond: Record<string, FilterCond> = {};
  if (f.cond && typeof f.cond === 'object') {
    for (const [k, v] of Object.entries(f.cond as Record<string, Record<string, unknown>>)) {
      if (!/^[A-Z]+$/.test(k) || !v || !FILTER_OPS.includes(v.op as FilterOp)) continue;
      cond[k] = { op: v.op as FilterOp, v1: typeof v.v1 === 'string' ? v.v1.slice(0, 200) : '', ...(v.op === 'between' && typeof v.v2 === 'string' ? { v2: v.v2.slice(0, 200) } : {}) };
    }
  }
  const color: Record<string, FilterColor> = {};
  if (f.color && typeof f.color === 'object') {
    for (const [k, v] of Object.entries(f.color as Record<string, Record<string, unknown>>)) {
      if (!/^[A-Z]+$/.test(k) || !v || (v.kind !== 'bg' && v.kind !== 'fg') || typeof v.color !== 'string') continue;
      if (v.color === 'none' || /^#[0-9a-f]{6}$/.test(v.color)) color[k] = { kind: v.kind, color: v.color };
    }
  }
  return { r: f.r, c0: f.c0, c1: f.c1, hidden, ...(Object.keys(cond).length ? { cond } : {}), ...(Object.keys(color).length ? { color } : {}) };
}

const CHART_TYPES: ChartType[] = ['col', 'line', 'pie', 'bar', 'barStack', 'barStack100', 'stack', 'stack100', 'area', 'doughnut', 'scatter', 'combo', 'combo2', 'hist', 'pareto', 'box', 'waterfall', 'funnel', 'treemap', 'sunburst', 'stock', 'bubble', 'radar', 'radarFill'];

function cleanCharts(raw: unknown): SheetChart[] {
  if (!Array.isArray(raw)) return [];
  const out: SheetChart[] = [];
  for (const ch of raw.slice(0, 20)) {
    if (!ch || typeof ch !== 'object') continue;
    const { id, type, range, src, title, xTitle, yTitle, palette, labels, legend, at, bg, line, noGrid, font, ink, axMin, axMax, axStep, fx, hide, byRow } = ch as Record<string, unknown>;
    const place = cleanAt(at, ROWS, COLS);
    if (typeof range !== 'string' || !/^[A-Z]+[1-9]\d*:[A-Z]+[1-9]\d*$/.test(range)) continue;
    out.push({
      id: typeof id === 'string' && id ? id.slice(0, 40) : `g${out.length + 1}`,
      type: CHART_TYPES.includes(type as ChartType) ? type as ChartType : 'col',
      range,
      ...(typeof src === 'string' && src.trim() ? { src: src.slice(0, 100) } : {}),
      title: typeof title === 'string' ? title.slice(0, 200) : '',
      ...(typeof xTitle === 'string' && xTitle.trim() ? { xTitle: xTitle.slice(0, 100) } : {}),
      ...(typeof yTitle === 'string' && yTitle.trim() ? { yTitle: yTitle.slice(0, 100) } : {}),
      ...(Number.isInteger(palette) && (palette as number) > 0 && (palette as number) < 6 ? { palette: palette as number } : {}),
      ...(labels === true ? { labels: true } : {}),
      ...(legend === 't' || legend === 'r' || legend === 'none' ? { legend } : {}),
      ...(place ? { at: place } : {}),
      ...(isHex(bg) ? { bg: bg.toLowerCase() } : {}),
      ...(isHex(line) ? { line: line.toLowerCase() } : {}),
      ...(noGrid === true ? { noGrid: true } : {}),
      ...(chartFontOk(font) ? { font } : {}),
      ...(isHex(ink) ? { ink: ink.toLowerCase() } : {}),
      ...cleanAxis({ axMin, axMax, axStep }),
      ...(fx === 'shadow' || fx === 'grad' ? { fx } : {}),
      ...(cleanHide(hide) ? { hide: cleanHide(hide) } : {}),
      ...(byRow === true ? { byRow: true } : {}),
    });
  }
  return out;
}

function cleanCells(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw)) {
      if (/^[A-Z]+[1-9]\d*$/.test(k) && v !== '' && v != null) out[k] = String(v);
    }
  }
  return out;
}

/** Cea mai lungă notă păstrată pe o celulă. */
export const MAX_NOTE = 2000;

const FMTS = ['general', 'number', 'lei', 'eur', 'percent', 'date', 'datelong', 'time', 'datetime', 'sci', 'fraction'];
const COLOR = /^#[0-9a-f]{6}$/i;
/** Mărimile de text permise (puncte). */
export const MIN_SZ = 6;
export const MAX_SZ = 72;
/** Fonturile din listă (cele care vin cu Windows); un font citit din Excel poate fi și altul. */
export const FONTS = ['Calibri', 'Arial', 'Segoe UI', 'Times New Roman', 'Cambria', 'Georgia', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Courier New', 'Consolas'];
/** Cea mai mare retragere (Excel permite 250, dar peste 15 textul iese din celulă). */
export const MAX_IND = 15;
export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72];

function cleanStyles(raw: unknown): Record<string, CellStyle> {
  const out: Record<string, CellStyle> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, Record<string, unknown>>)) {
    if (!/^[A-Z]+[1-9]\d*$/.test(k) || !v || typeof v !== 'object') continue;
    const s: CellStyle = {};
    if (v.b === true) s.b = true;
    if (v.i === true) s.i = true;
    if (v.wrap === true) s.wrap = true;
    if (cleanBorder(v.bd)) s.bd = cleanBorder(v.bd);
    if (s.bd && cleanLineStyle(v.bdStyle)) s.bdStyle = cleanLineStyle(v.bdStyle);
    if (s.bd && typeof v.bdColor === 'string' && COLOR.test(v.bdColor)) s.bdColor = v.bdColor;
    if (v.u === true) s.u = true;
    if (v.s === true) s.s = true;
    if (v.pos === 'sup' || v.pos === 'sub') s.pos = v.pos;
    if (v.va === 'top' || v.va === 'middle' || v.va === 'bottom') s.va = v.va;
    if (typeof v.ind === 'number' && v.ind >= 1 && v.ind <= MAX_IND) s.ind = Math.round(v.ind);
    if (typeof v.rot === 'number' && Number.isFinite(v.rot) && Math.round(v.rot) && (Math.abs(v.rot) <= 90 || v.rot === STACKED)) s.rot = Math.round(v.rot);
    if (v.unlock === true) s.unlock = true;
    if (v.chk === true) s.chk = true;
    if (cleanSpin(v.spin)) s.spin = cleanSpin(v.spin)!;
    if (cleanOpt(v.opt)) s.opt = cleanOpt(v.opt)!;
    if (cleanBtn(v.btn)) s.btn = cleanBtn(v.btn)!;
    if (v.ign === true) s.ign = true;
    if (cleanLink(v.link)) s.link = cleanLink(v.link)!;
    if (typeof v.sty === 'string' && v.sty.trim() && v.sty.length <= 60) s.sty = v.sty;
    if (typeof v.font === 'string' && /^[\w .\-]{1,48}$/u.test(v.font.trim())) s.font = v.font.trim();
    if (typeof v.sz === 'number' && v.sz >= MIN_SZ && v.sz <= MAX_SZ) s.sz = Math.round(v.sz * 2) / 2;
    if (typeof v.color === 'string' && COLOR.test(v.color)) s.color = v.color;
    if (typeof v.bg === 'string' && COLOR.test(v.bg)) s.bg = v.bg;
    if (v.align === 'left' || v.align === 'center' || v.align === 'right' || v.align === 'across') s.align = v.align;
    if (typeof v.fmt === 'string' && FMTS.includes(v.fmt)) s.fmt = v.fmt as NumFmt;
    if (typeof v.code === 'string' && v.code.trim() && v.code.length <= 200 && !/^general$/i.test(v.code.trim())) s.code = v.code;
    if (typeof v.note === 'string' && v.note.trim()) s.note = v.note.slice(0, MAX_NOTE);
    const th = cleanThread(v.cmt);
    if (th) { s.cmt = th; if (v.cdone === true) s.cdone = true; }
    if (typeof v.dec === 'number' && v.dec >= 0 && v.dec <= 10) s.dec = Math.round(v.dec);
    if (Object.keys(s).length) out[k] = s;
  }
  return out;
}

function cleanWidths(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw)) {
    if (/^[A-Z]+$/.test(k) && typeof v === 'number' && v >= MIN_COL_W && v <= MAX_COL_W) out[k] = Math.round(v);
  }
  return out;
}

export const MIN_ROW_H = 24;
export const MAX_ROW_H = 400;
/** Orientările din bară (grade, ca în Excel). */
/** Textul scris literă sub literă (aceeași valoare ca în .xlsx). */
export const STACKED = 255;
export const ROTATIONS: [number, string][] = [[0, '⟲ Fără rotire'], [45, '↗ Înclinat în sus'], [-45, '↘ Înclinat în jos'], [90, '⤒ Vertical în sus'], [-90, '⤓ Vertical în jos'], [STACKED, '⇣ Literă sub literă']];

/** Numerele rândurilor ascunse: întregi între 1 și ROWS, fără dubluri, în ordine. */
export function cleanHideRows(raw: unknown, max = ROWS): number[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= max))].sort((a, b) => a - b);
}

export function cleanHeights(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw)) {
    if (/^[1-9]\d*$/.test(k) && Number(k) <= ROWS && typeof v === 'number' && v >= MIN_ROW_H && v <= MAX_ROW_H) out[k] = Math.round(v);
  }
  return out;
}

export const COL_W = 100;
export const MIN_COL_W = 30;
export const MAX_COL_W = 600;

export function serializeSheetDoc(doc: SheetDoc): string {
  return JSON.stringify({ ...doc, updatedAt: new Date().toISOString() }, null, 2);
}

export function colName(c: number): string {
  let s = '';
  for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

export function cellId(r: number, c: number): string {
  return colName(c) + (r + 1);
}

/** Invers față de cellId: „B12” → { r: 11, c: 1 }. */
export function parseCellId(id: string): { r: number; c: number } | null {
  const m = /^([A-Z]+)(\d+)$/.exec(id);
  if (!m) return null;
  let c = 0;
  for (const ch of m[1]) c = c * 26 + ch.charCodeAt(0) - 64;
  return { r: +m[2] - 1, c: c - 1 };
}

/** Textul „12,5” sau „12.5” e număr; îl aliniem la dreapta, ca în Excel. */
export function isNumber(v: string): boolean {
  return /^\s*[-+]?(\d+([.,]\d*)?|[.,]\d+)\s*$/.test(v);
}

/** Proprietățile registrului curățate (fără titlu, care e câmpul `title`); undefined dacă nu e niciuna. */
export function sheetProps(p: { props?: unknown } | undefined): Omit<DocProps, 'title'> | undefined {
  const d = docProps(p);
  if (!d) return undefined;
  const { title: _t, ...rest } = d;
  return Object.keys(rest).length ? rest : undefined;
}
