// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
import { normalizeUrl, nameFromUrl, isTextData, webHtml } from './webTables';
import { clipCmd } from '../clipCmd';
import CommentDialog from './CommentDialog';
import { threadText, type CellComment } from './comments';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { autoComplete, columnTexts } from './autocomplete';
import { autoCorrect, loadAutoCorrect } from '../docs/autoCorrect';
import AutoCorrectDialog from '../docs/AutoCorrectDialog';
import { formulaSteps, literalOf } from './evalformula';
import { CONS_FNS, ConsCell, ConsFn, consolidate } from './consolidate';
import { unsavedLabel, useUnsaved } from '../unsaved';
import { signedNote } from '../officeFile';
import { api, BinaryFile, fileName, OpenedFile, type FileKind, type PagePrint } from '../api';
import { imageToDataUrl } from '../slides/image';
import { MAX_PICS, resized, startSize, type SheetPic } from './pics';
import { SHAPES } from '../docs/shapes';
import { renderShapeBox, TEXT_BOX, TEXT_MAX, type ShapeBox } from './shapeBox';
import { parseWordArt, renderWordArt, WORDART_MAX, WORDART_STYLES, type WordArtSpec } from '../docs/wordArt';
import { safeFileName } from '../notes/format';
import VersionsDialog from '../Versions';
import DraftsDialog, { adoptDraft, draftOf, dropDraft, openDraftIds, useDraft } from '../Drafts';
import ZoomControl, { useZoom } from '../ZoomControl';
import { clampZoom } from '../zoom';
import SymbolPicker from '../docs/SymbolPicker';
import ColorMenu from '../docs/ColorMenu';
import { BOOK_THEMES, DEFAULT_FONTS, THEME_FONTS, recolorStyles, refontStyles, sheetPalette, themeColorMap, themeColorsOf, themeFontsOf, type BookTheme, type ThemeFonts } from './themeColors';
import EquationDialog from '../docs/EquationDialog';
import { captureScreen } from '../screenshot';
import IconsDialog from '../icons/IconsDialog';
import IconRecolorBar from '../icons/IconRecolor';
import { iconById, iconPng, type IconSpec } from '../icons/iconLib';
import Model3DDialog, { type Model3DSource } from '../Model3DDialog';
import { keepModel, keptModel } from '../model3d';
import { drawSketchEx } from '../sketch';
import DiagramDialog from '../docs/DiagramDialog';
import { diagramAlt, diagramSvg, diagramToPng, DIAGRAM_W, newDiagram, type DocDiagram } from '../docs/diagram';
import { equationAlt, equationToPng } from '../docs/equation';
import Ribbon, { RGroup, RMenu, RMore, RPop, RSplit } from '../ribbon/Ribbon';
import { ARRANGE_TITLE, arrangeItems, canArrange } from '../arrangeWindows';
import MiniBar from '../ribbon/MiniBar';
import { useArrange } from '../ribbon/Arrange';
import { useContextMenu } from '../ribbon/contextMenu';
import {
  CellStyle, cellId, FilterColor, FilterCond, FilterOp, FONT_SIZES, MAX_IND, FONTS, parseCellId, MAX_ROW_H, MIN_ROW_H, ROTATIONS, STACKED, COL_W, colName, COLS, emptySheetDoc, emptySheet, isNumber, MAX_COL_W, MIN_COL_W, parseSheetDoc, ROWS,
  serializeSheetDoc, Sheet, SheetDoc, MAX_NOTE, lastUsedRow, VIEW_COLS, WORK_ROWS, cleanLink, cleanFreeze, MAX_FREEZE_ROWS, MAX_FREEZE_COLS, sheetProps, CELL_STYLE_KEYS, type UserCellStyle, cleanOpt, optIndex, OPT_MAX, cleanBtn } from './format';
import { labelMarkOf, markLabel, NO_PAGE_SETUP, docProps } from '../docs/format';
import PropsDialog from './PropsDialog';
import { LabelBadge } from '../docs/LabelRow';
import TextImportDialog, { DocTablesDialog } from './TextImportDialog';
import QueryDialog from './QueryDialog';
import ChangesPane from './ChangesPane';
import { addChanges, diffCells, type CellChange } from './changes';
import { combineTables, qTableCells, readQTable, runQuery, type QOther, type QStep, type QTable, type SheetQuery } from './query';
import { analyzeText, encodeText, ENCODINGS, hasBom, importText, rowsToCells, sepName, splitText as splitTextRows, type TextImportResult, type TextOptions } from './textImport';
import { ClipboardGroup } from '../ribbon/Clipboard';
import { matches } from '../keys';
import { DATE_FMTS, dateToSerial, DEFAULT_DEC, NUM_FORMATS, NumFmt, asText, parseEntry, serialToDate, serialToTime } from './numfmt';
import { customLists, fillRange, fillStyles, fillTargetFor, LISTS, listsText, parseLists, Range, setCustomLists } from './fill';
import { currentRegion, hasHeader, SortKey, sortRange, sortRangeBy } from './sort';
import { advancedMatch, copyRows } from './advfilter';
import { bestLevel, columnSerials, periods, rangeLabel, rangeParts, TIME_LEVELS, TimeLevel, TimePeriod } from './timeline';
import { cellCodeColor, cellText, colIndex, colorOf, columnColors, columnValues, EMPTY, filterEnd, fold, hiddenRows, valueAt } from './filter';
import { Group, groupAt, groupsOf, isShut, maxLevel, regroup, showLevel, toggleGroup } from './group';
import { cellsToCsv, decodeCsv, detectDelimiter, parseCsv } from './csv';
import { fileSaved } from '../fileKinds';
import { isNumText, sheetErrors } from './errcheck';
import { cycleRef, functionNames, DefinedName, renameNameInFormula, ERROR_HELP, evaluateAll, formatNumber, nameKey, PivotDef, Result, sheetRef, shiftFormula, formulaRanges, complexOf, type ExtBook } from './formula';
import { CellImageView, imageKey } from './cellImage';
import { onWebData, setWebFetcher } from './webService';
import { extBooksIn, linkSheetsFrom, renameExtBook, resultCellText } from './extLinks';
import { LinksDialog } from './LinksDialog';
import { RelationsDialog } from './RelationsDialog';
import { MacroListDialog, MacroRecordDialog } from './MacrosDialog';
import { addStep, cleanMacros, diffStep, filterAt, filterStep, insAt, layoutStep, macroForKey, macroSegments, runLayout, runMacro, sortAt, sortStep, type MacroStep, type SheetMacro } from './macros';
import { detectRels, modelSteps, relProblem, type SheetRel } from './relations';
import { QUICK_ITEMS, QUICK_TABS, colShares, numericPart, rowTotals, type QuickTab } from './quick';
import { CHART_STYLES, CHART_FILLS, CHART_INKS, CHART_LINES, recommendCharts, LEGEND_POS, PALETTES, SHEET_CHART_TYPES, canHideSeries, canSwitchRC, chartData, chartDataOf, chartSvg, isXY, ChartType, parseRangeText, rangeText, SheetChart, svgToPng, CHART_W, CHART_H, CHART_MIN, CHART_MAX, type ChartAt } from './chart';
import { DEFAULT_PRINT, fillHF, HF_FIELDS, MARGIN_NAMES, MARGINS, pageSizeMm, PAPERS, type PrintMargin, type PrintPaper, printRange, printRows, printWidths, SheetPrint, autoBreaks, headCount, MAX_HEAD_ROWS, MAX_LEFT_COLS, MIN_PRINT_SCALE, MAX_PRINT_SCALE, printScale, printColGroups, colPages } from './print';
import { cleanSparks, SheetSpark, SPARK_KINDS, SparkKind, sparkMap, sparkPlace } from './sparkline';
import { COND_LOOKS, COND_OPS, CondLook, condLooks, formulaMatches, CondOp, dataBars, describeRule, iconUrl, ICON_SETS, MAX_RULES, needsValue, SCALES, SheetRule, suiteOnly } from './cond';
import { Template, TEMPLATES } from './templates';
import { buildPivot, categories, recommendPivots, PIVOT_DATE_GROUPS, PIVOT_OPS, PIVOT_SHOWS, PIVOT_TOTALS, PivotOp, PivotShow, PivotSpec, PivotTotals, PivotValue, MAX_PIVOT_VALUES, SPREAD, PivotCalc, MAX_PIVOT_CALCS, PIVOT_FILTER_CELL, PIVOT_ALL, PIVOT_MULTI, PIVOT_LAYOUTS, PivotLayout, BASED, COLS2_SHOWS, PivotTextGroup } from './pivot';
import { calcColumns, DEFAULT_TABLE_OPTS, formatAsTable, growTables, tableDataRange, nextTableName, SheetTable, tableAt, validTableName, subtotalOf, TABLE_THEMES, galleryThemes, customStyleId, registerTableStyles, isCustomTheme, type CustomTableLook, TableOpts, TableTheme, TOTAL_FNS } from './table';
import { FindOpts, findCells, replaceText } from './find';
import SpellDialog from '../SpellDialog';
import { spellCells, spellPatch } from './spell';
import { checkGrammar } from '../grammar';
import { Axis, Band, bandBlockedBy, insertDelete, wouldPushOut } from './insert';
import { countLines, wrapHeight } from './wrap';
import { eachCell, RowTops, ShownRows } from './rows';
import { CopiedCell, parseHtmlTable, parseTsv, PastedCell, tableHtml } from './paste';
import { tableToPng } from './rangeImage';
import { BORDER_KINDS, borderPatch, edges, Edges, LINE_STYLES, LineStyle, printLine, withLook } from './border';
import { addMerge, mergeAt, mergeLayout, mergesOf, overlaps, removeMerges, RowMerge } from './merge';
import { CODE_KINDS, CodeKind, describeValRule, ERR_STYLES, ErrStyle, hasValues, invalidCells, listAt, listOrigin, matchValue, parseValues, removeLists, ruleOk, RULE_OPS, RULE_TYPES, RuleOp, RuleType, setList, SheetList, ValError, ValMsg, ValRule } from './lists';
import { AUTO_FNS, AutoFn, autoFill, autoFormula, Cellish } from './autosum';
import { PASTE_OPS, PASTE_WHAT, PasteOp, PasteOpts, pasteSpecial, PasteWhat } from './pasteSpecial';
import { removeDuplicates } from './dedupe';
import FormatCellsDialog, { type FormatTab } from './FormatCellsDialog';
import { CELL_STYLES, formatCellsPatch, type StyleChanges } from './cellsFormat';
import { enterPicks, FN_CATS, FN_HELP, FnCat, FnHelp, FormulaHint, formulaHint, hintArgs, searchFns } from './fnhelp';
import { DELIMS, guessDelim, splitText } from './textcols';
import { flashFill, type FlashRow } from './flashfill';
import { namesFromRange, parseGoto } from './goto';
import { checkSheets, type SheetIssue } from './a11y';
import { gotoSpecial, SPECIAL_KINDS, SpecialKind, VALUE_TYPES, ValueType } from './gotospecial';
import { DateUnit, MAX_SERIES, SeriesOpts, SeriesType, seriesValues } from './series';
import { goalSeek, GoalSeekResult } from './goalseek';
import { prepareSeries, timeAfter } from './ets';
import { parseCells, solve, solverMessage, solverLimits, solverRanges, solverSensitivity, type SheetSolver, type SolverGoal, type SolverOp } from './solver';
import { MAX_DATA_TABLES, planDataTable, type DTJob } from './datatable';
import { MAX_SCENARIOS, parseCellList, scenarioSummary, type SheetScenario } from './scenario';
import { addSubtotals, MAX_GROUPS, removeSubtotals, SUBTOTAL_FNS, SubtotalOpts, subtotalRows } from './subtotal';
import { columnsOf, describe } from './descstats';
import { anovaOne, correlation, covariance, fTest, histogram, regress, regressionTable, rowsOf, tTest, movingAverage, expSmoothing, anovaTwo, anovaRep, rankPercentile, zTest, sample, fourier, randomNumbers, seededRandom, type RandOpts } from './analysis';
import { moveCells, moveTarget } from './move';
import { placeSheet, addSheet, copyName, MAX_SHEETS, removeSheet, renameSheet, sheetBaseName, sheetIsEmpty, sheetNameError } from './tabs';
import { isCurrent, useTabKey } from '../active';
import { useCommands } from '../commands';
import { ask, askDiscard, askPassword, askText, askYes } from '../ask';
import { isInvoiceSheet } from './invoiceSheet';
import { isStatementDoc } from './bankStatement';
import { checkSheetPw, makeSheetPw, type SheetPw } from './sheetPassword';
import { OfficeSignDialog, signPackage } from '../OfficeSign';
import type { DigitalId, TsaClient } from '../pdf/digisign';
import { importedName, importedSave, keptStore, takeTabStart, useOpenInTab, useTabContent, useTabMarks, useTabTitle } from '../tabs';
import SheetSplit from './SheetSplit';
import { translate, useLang } from '../i18n';
import PageLayout, { CELL_LINK } from './PageLayout';

const AUTOSAVE_MS = 1500;
/** Tabelul deschis rămâne în memorie când treci în alt modul și îl regăsești la întoarcere, chiar nesalvat. */
const kept = keptStore<{ doc: SheetDoc; path: string | null; dirty: boolean; active: number }>();
const PAGE = 20;
/** Alt+PageUp / Alt+PageDown: cu câte coloane se mută (un ecran spre stânga / dreapta). */
const PAGE_C = 8;
const HISTORY = 100;
const ROW_HEAD_W = 48;
// Rândurile înghețate stau lipite imediat sub capul cu literele coloanelor (înalt de 24 px).
const FROZEN_TOP = 24;
// Unde se ține minte dacă bara de formule e ascunsă.
const FXBAR_KEY = 'suite.sheets.fxbar';

type Cells = Record<string, string>;
type Styles = Record<string, CellStyle>;
type Results = Record<string, Result>;
interface Pos { r: number; c: number }
/** Un pas de anulare: toate foile și foaia pe care erai. */
interface Snap { sheets: Sheet[]; active: number }

interface Props {
  initial: OpenedFile | null;
  onConsumed(): void;
}

const clamp = (v: number, max: number) => Math.max(0, Math.min(max - 1, v));

/** Data de azi („22.10.2026”) sau ora de acum („15:07”), cum le scrie Ctrl+; / Ctrl+Shift+:. */
function nowText(what: 'date' | 'time'): string {
  const d = new Date(), p = (n: number) => String(n).padStart(2, '0');
  return what === 'date' ? `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}` : `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Fișierele text cu date (Import din text) și documentele din care se aduc tabelele. */
const TEXT_EXT = /\.(csv|txt|tsv|tab|prn|dat)$/i;
const DOC_EXT = /\.(docx|docm|f?odt|doc|rtf)$/i;

/** Registrele care pot fi sursa unei interogări (restul fișierelor alese sunt citite ca text / CSV). */
const QUERY_BOOK = /\.(xlsx|xlsm|xls|xlsb|f?ods)$/i;

/** Export CSV: separatorul (cu „,” și „|” numerele au punct zecimal, altfel virgulă) și codificarea fișierului. */
interface CsvExportOpts { sep: string; enc: 'utf-8-bom' | 'utf-8' | 'windows-1250' | 'utf-16le'; all?: boolean }
const CSV_SEPS: [string, string][] = [
  [';', 'Punct și virgulă „;” (virgulă zecimală)'],
  [',', 'Virgulă „,” (punct zecimal)'],
  [String.fromCharCode(9), 'Tab'],
  ['|', 'Bară verticală „|” (punct zecimal)'],
];
const CSV_ENCS: [CsvExportOpts['enc'], string][] = [
  ['utf-8-bom', 'UTF-8 cu semnătură (recomandat)'],
  ['utf-8', 'UTF-8 fără semnătură'],
  ['windows-1250', 'Windows-1250 (programe mai vechi)'],
  ['utf-16le', 'UTF-16 (text Unicode)'],
];

/** Fundalul celulelor recunoscute nesigur la Din imagine. */
const UNSURE_BG = '#ffd8a8';

export default function Sheets({ initial, onConsumed }: Props) {
  // Cheia tabului (pot fi mai multe tabele deschise) și ce a rămas ținut minte de data trecută.
  const tab = useTabKey('sheets');
  const [k0] = useState(() => kept.get(tab));
  const [doc, setDoc] = useState<SheetDoc>(() => k0?.doc ?? emptySheetDoc());
  const [path, setPath] = useState<string | null>(() => k0?.path ?? null);
  // Fișierul adus prin import (.xlsx, .docx, .pptx…): numele lui stă pe tab până la prima salvare.
  const [fromFile, setFromFile] = useState<string | null>(null);
  useEffect(() => { if (path) setFromFile(null); }, [path]);
  // ✎ Deschide foaia legată (Docs / Slides): foaia de arătat după ce registrul e adus, după nume.
  const showSheet = useRef<{ name: string; from: string } | null>(null);
  const [dirty, setDirty] = useState(() => k0?.dirty ?? false);
  // Registrul nou, încă neatins (fără fișier, o singură foaie goală cu numele implicit): când se schimbă limba, foaia își
  // schimbă și ea numele („Foaia 1” ↔ „Sheet1”), ca și cum registrul ar fi fost deschis direct în limba nouă.
  const uiLang = useLang();
  useEffect(() => {
    if (path || dirty) return;
    setDoc((d) => {
      const s = d.sheets.length === 1 ? d.sheets[0] : null, nm = sheetBaseName(1);
      return s && s.name !== nm && (s.name === 'Foaia 1' || s.name === 'Sheet1') && sheetIsEmpty(s) ? { ...d, sheets: [{ ...s, name: nm }] } : d;
    });
  }, [uiLang]); // eslint-disable-line react-hooks/exhaustive-deps
  useUnsaved(tab, dirty ? unsavedLabel('Sheets', path) : null);
  useTabTitle(tab, path || importedName(fromFile));
  const openInTab = useOpenInTab();
  useTabContent(tab, () => serializeSheetDoc(doc));
  // Tabelul fără fișier se păstrează ca ciornă (Fișier → Recuperează…); gol, ciorna se șterge.
  useDraft(tab, 'sheets', !!k0, dirty && !path, () => {
    const s = doc.sheets.find((x) => Object.keys(x.cells).length > 0);
    if (!s) return null;
    const first = [s.cells.A1, ...Object.values(s.cells)].find((v) => v && !v.startsWith('=')) ?? '';
    return { title: doc.title || first || 'Tabel nou', content: serializeSheetDoc(doc) };
  });
  const [draftDlg, setDraftDlg] = useState(false);
  const [status, setStatus] = useState('');
  const [signDlg, setSignDlg] = useState(false);
  const [seriesDlg, setSeriesDlg] = useState(false);
  // Fereastra Liste proprii (pentru umplerea automată); listele se țin minte în setările aplicației.
  const [listsDlg, setListsDlg] = useState(false);
  const [linksDlg, setLinksDlg] = useState(false);
  const [relDlg, setRelDlg] = useState(false);
  // Vizualizare ? Macrocomenzi: fereastra deschis? ?i ?nregistrarea ?n curs (foaia, celula de start, pa?ii de p?n? acum).
  const [macroDlg, setMacroDlg] = useState<'rec' | 'list' | null>(null);
  // Macrocomenzile pentru toate registrele, păstrate în setările de pe acest calculator.
  const [myMacros, setMyMacros] = useState<SheetMacro[]>([]);
  useEffect(() => { void api.getSettings().then((st) => setMyMacros(cleanMacros(st.sheetsMacros))).catch(() => {}); }, []);
  const saveMine = (list: SheetMacro[]) => { setMyMacros(list); void api.setSettings({ sheetsMacros: list }).catch(() => {}); };
  const [rec, setRec] = useState<{ name: string; rel: boolean; note: string; key: string; all: boolean; from: { r: number; c: number }; sheet: string; steps: MacroStep[] } | null>(null);
  // Sortarea care urmează să ajungă în applySheet: în macrocomandă intră ca pas „sortează tabelul”, nu ca valorile mutate.
  const recSort = useRef<{ g: Range; head: boolean; levels: SortKey[]; picked: boolean } | null>(null);
  const [linkMsg, setLinkMsg] = useState<Record<string, string>>({});
  // Bara de sus la deschiderea unui registru cu legături: valorile vin din ultima citire, se pot citi din nou cu un clic.
  const [linkBar, setLinkBar] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [goalDlg, setGoalDlg] = useState(false);
  const [solverDlg, setSolverDlg] = useState(false);
  const [randDlg, setRandDlg] = useState(false);
  // Ultimul model al Rezolvitorului, pe foaie (se reia la redeschiderea ferestrei).
  const solverModels = useRef<Record<string, SolverModel>>({});
  const [scDlg, setScDlg] = useState(false);
  const [dtDlg, setDtDlg] = useState<{ r0: number; c0: number; r1: number; c1: number } | null>(null);
  const [advDlg, setAdvDlg] = useState<{ list: string } | null>(null);
  const [cellsDlg, setCellsDlg] = useState<{ del: boolean } | null>(null);
  /** Fereastra Sortare (pe mai multe niveluri): zona, capul de tabel și coloana de pornire. */
  const [sortDlg, setSortDlg] = useState<{ g: Range; head: boolean; col: number } | null>(null);
  const [subDlg, setSubDlg] = useState<{ g: Range; col: number } | null>(null);
  /** Arată formulele în celule în loc de rezultate (Ctrl+`), ca în Excel; nu se salvează. */
  const [showF, setShowF] = useState(false);
  // Arată toate notele (ca Revizuire → Arată toate notele): fiecare notă stă lângă celula ei, nu doar la trecerea mouse-ului.
  const [showNotes, setShowNotes] = useState(false);
  /** Textul scris în caseta de nume (null = arată celula selectată). */
  const [nameEdit, setNameEdit] = useState<string | null>(null);
  const nameBoxRef = useRef<HTMLInputElement>(null);
  // Ora ultimei salvări; starea salvării („Nesalvat”, „Se salvează…”) are locul ei în bara de jos,
  // ca să nu acopere mesajele utile (de exemplu „nu e un CNP corect”).
  const [savedAt, setSavedAt] = useState<string | null>(null);
  // Celula activă (sel) și colțul opus al zonei selectate (ext).
  const [sel, setSel] = useState<Pos>({ r: 0, c: 0 });
  const [ext, setExt] = useState<Pos>({ r: 0, c: 0 });
  // Zonele adăugate cu Ctrl+click / Ctrl+tragere, pe lângă zona curentă (selecție din mai multe bucăți, ca în Excel).
  const [extra, setExtra] = useState<Range[]>([]);
  // Unde e mouse-ul cât tragi de pătrățelul de umplere.
  const [fillTo, setFillTo] = useState<Pos | null>(null);
  const drag = useRef<'sel' | 'fill' | 'ref' | 'move' | null>(null);
  // Mutarea selecției trasă de margine: de unde a fost apucată și cât s-a deplasat până acum.
  const moveGrab = useRef<Pos | null>(null);
  const [moveBy, setMoveBy] = useState<{ dr: number; dc: number } | null>(null);
  const follow = useRef(true);
  // Textul celulei în curs de editare (null = nu se editează).
  const [edit, setEdit] = useState<string | null>(null);
  const [editInBar, setEditInBar] = useState(false);
  const editRef = useRef<string | null>(null);
  const past = useRef<Snap[]>([]);
  const future = useRef<Snap[]>([]);
  // Foaia afișată (fila de jos) și meniul unei file (click dreapta) sau redenumirea ei.
  const [active, setActive] = useState(() => Math.min(k0?.active ?? 0, (k0?.doc.sheets.length ?? 1) - 1));
  // Foile alese împreună cu cea activă (Ctrl / Shift + clic pe file, ca în programul cunoscut): ce scrii, ștergi sau formatezi
  // pe foaia activă se face la fel, în aceleași celule, și pe ele; la tipărire se pot tipări toate.
  const [group, setGroup] = useState<number[]>([]);
  const [tabMenu, setTabMenu] = useState<{ i: number; x: number; y: number } | null>(null);
  // Meniul de pe numărul rândului sau litera coloanei (click dreapta): inserare și ștergere.
  const [headMenu, setHeadMenu] = useState<{ axis: Axis; x: number; y: number } | null>(null);
  const [renaming, setRenaming] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  // Vizualizare › Fereastră › ⊟ Scindare: a doua parte a foii, jos (SheetSplit.tsx); partea de sus ocupă splitRatio.
  const [splitOn, setSplitOn] = useState(false);
  // 'h' = sus / jos (⊟ Scindare), 'v' = stânga / dreapta (◫ Scindare stânga-dreapta), 'q' = ⊞ Patru panouri;
  // splitRatio = partea foii adevărate (la 'q' din înălțime), splitRatioX = la 'q' partea ei din lățime.
  const [splitDir, setSplitDir] = useState<'h' | 'v' | 'q'>('h');
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [splitRatioX, setSplitRatioX] = useState(0.5);
  // Zoom-ul tabelului (doar pe ecran): Ctrl + rotița sau butoanele din bara de jos. Pozițiile (derulare, rânduri) rămân în pixelii de la 100%.
  const [zoom, setZoom] = useZoom('suite.sheets.zoom', gridRef);
  // Se desenează doar rândurile care se văd (plus câteva în jur), ca tabelul să poată avea mii de rânduri.
  // view: cât e derulat tabelul și cât de înaltă e fereastra lui; rowPx/headPx: înălțimea măsurată a unui rând.
  const [view, setView] = useState({ top: 0, h: 800, left: 0, w: 1600 });
  // Fereastra vizibilă a părții de jos la Scindare (SheetSplit.tsx): rândurile ei se desenează și ele, ca să apară în copie.
  const [view2, setView2] = useState<{ top: number; h: number } | null>(null);
  const sizes = useRef({ rowPx: 25, headPx: 25 });
  const timer = useRef<number>();

  const sheet = doc.sheets[active] ?? doc.sheets[0];
  const { cells, styles, colW } = sheet;
  const selId = cellId(sel.r, sel.c);
  const selStyle: CellStyle = styles[selId] ?? {};
  // Lățimea unei coloane cât o tragi de margine (înainte să fie salvată în tabel).
  const [liveW, setLiveW] = useState<{ c: number; w: number } | null>(null);
  // Coloanele ascunse de mână au lățimea 0 (și nu se desenează).
  // Fără literele coloanelor și numerele rândurilor: capul nu ia loc (lățime / înălțime 0).
  const noHead = !!sheet.noHead;
  const headW = noHead ? 0 : ROW_HEAD_W;
  const headH = () => (noHead ? 0 : sizes.current.headPx);
  const hiddenC = useMemo(() => new Set((sheet.hideCols ?? []).map((k) => k - 1)), [sheet.hideCols]);
  const widthOf = (c: number) => (hiddenC.has(c) ? 0 : liveW?.c === c ? liveW.w : colW[colName(c)] ?? COL_W);
  const range: Range = useMemo(() => ({
    r0: Math.min(sel.r, ext.r), r1: Math.max(sel.r, ext.r), c0: Math.min(sel.c, ext.c), c1: Math.max(sel.c, ext.c),
  }), [sel, ext]);
  const multi = range.r0 !== range.r1 || range.c0 !== range.c1;
  // Toate zonele selectate: cele adăugate cu Ctrl plus zona curentă.
  const allRanges = useMemo(() => [...extra, range], [extra, range]);
  const fillT = fillTo ? fillTargetFor(range, fillTo) : null;
  const moveT = moveBy ? moveTarget(range, moveBy.dr, moveBy.dc) : null;
  // Rezultatele formulelor, recalculate la fiecare schimbare.
  // Formulele pot lua valori și din celelalte foi (=Costuri!B2).
  const sheetName = sheet.name;
  // F9 („Calculează acum”) reface toate formulele, de exemplu ca RAND(), NOW() și TODAY() să dea valori noi.
  const [calcTick, setCalcTick] = useState(0);
  // WEBSERVICE: adresele se aduc prin procesul principal; când sosește un răspuns, foaia se recalculează.
  useEffect(() => {
    if (api.webGet) setWebFetcher((u) => api.webGet!(u));
    return onWebData(() => setCalcTick((t) => t + 1));
  }, []);
  // Calculul manual: rezultatele rămân cele de la ultimul F9; se calculează doar formulele scrise sau schimbate între timp.
  const manual = doc.calc === 'manual';
  const frozen = useRef<{ tick: number; sheet: string; cells: Record<string, string>; res: Record<string, Result>; stale: boolean } | null>(null);
  const baseResults = useMemo(() => {
    const book = { self: sheetName, sheets: doc.sheets, names: doc.names, pivots: doc.pivots, match: doc.match, iterate: doc.iter, ext: doc.links };
    const f = frozen.current;
    if (!manual || !f || f.tick !== calcTick || f.sheet !== sheetName) {
      const res = evaluateAll(cells, book);
      frozen.current = { tick: calcTick, sheet: sheetName, cells, res, stale: false };
      return res;
    }
    const changed = Object.keys(cells).filter((id) => cells[id] !== f.cells[id]);
    const removed = Object.keys(f.cells).filter((id) => !(id in cells));
    f.stale = changed.length > 0 || removed.length > 0;
    if (!f.stale) return f.res;
    const out = { ...f.res };
    for (const id of removed) delete out[id];
    for (const id of changed) delete out[id];
    return Object.assign(out, evaluateAll(cells, book, undefined, changed));
  }, [cells, sheetName, doc.sheets, doc.names, doc.pivots, doc.match, doc.iter, doc.links, calcTick, manual]);
  const calcStale = manual && !!frozen.current?.stale;
  // Fereastra mică a calculului iterativ (din bara de jos).
  const [iterDlg, setIterDlg] = useState(false);
  const setIter = (it: { max: number; delta: number } | undefined) => {
    setDoc((d) => { const n = { ...d }; if (it) n.iter = it; else delete n.iter; return n; });
    markDirty();
  };
  // Filtrul pe coloane: rândurile ascunse și lista de bifat deschisă (coloana și unde apare pe ecran).
  const filter = sheet.filter;
  const fHidden = useMemo(() => hiddenRows(cells, baseResults, styles, filter), [cells, baseResults, styles, filter]);
  // Rândurile care nu se văd: cele ascunse de filtru și cele ascunse de mână.
  const hidden = useMemo(() => {
    if (!sheet.hideRows?.length) return fHidden;
    const h = new Set(fHidden);
    for (const k of sheet.hideRows) h.add(k - 1);
    return h;
  }, [fHidden, sheet.hideRows]);
  // Rândurile care nu sunt ascunse de filtru, în ordine, și locul fiecăruia printre ele (pentru derulare).
  const shown = useMemo(() => new ShownRows(ROWS, hidden), [hidden]);
  // Celulele îmbinate ale foii și, pe fiecare rând, cum se desenează (o îmbinare cu primul rând ascuns de filtru nu se desenează îmbinată).
  const merges = useMemo(() => mergesOf(sheet.merges), [sheet.merges]);
  const mlay = useMemo(() => mergeLayout(merges.filter((g) => !hidden.has(g.r0)), hidden), [merges, hidden]);

  // Cu rânduri ascunse de filtru, SUBTOTAL se recalculează fără ele (de exemplu totalul unui tabel filtrat).
  const results = useMemo(() => (hidden.size && Object.values(cells).some((v) => /SUBTOTAL\s*\(/i.test(v))
    ? evaluateAll(cells, { self: sheetName, sheets: doc.sheets, names: doc.names, pivots: doc.pivots, match: doc.match, iterate: doc.iter, ext: doc.links }, hidden)
    : baseResults), [hidden, cells, sheetName, doc.sheets, doc.names, doc.pivots, doc.match, doc.iter, doc.links, baseResults]);
  // Rândurile mai înalte: cele cu text încadrat care nu încape pe un singur rând (ca „potrivire automată” din Excel).
  const autoTall = useMemo(() => {
    const out = new Map<number, number>();
    // Textul mai mare decât de obicei face rândul mai înalt (ca în Excel).
    for (const [id, st] of Object.entries(styles)) {
      if (!st.sz || st.sz <= 11 || !cells[id]) continue;
      const p = parseCellId(id);
      if (!p || hidden.has(p.r) || mergeAt(merges, p.r, p.c)) continue;
      out.set(p.r, Math.max(out.get(p.r) ?? 0, Math.round(st.sz * 13 / 11 * 1.25 + 8)));
    }
    const wrapped = Object.entries(styles).filter(([id, st]) => st.wrap && cells[id]);
    // Textul rotit face rândul cât e nevoie ca să încapă (ca în Excel).
    const rotated = Object.entries(styles).filter(([id, st]) => st.rot && cells[id]);
    if (!wrapped.length && !rotated.length) return out;
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return out;
    const family = getComputedStyle(document.body).fontFamily;
    for (const [id, st] of rotated) {
      const p = parseCellId(id);
      if (!p || hidden.has(p.r) || mergeAt(merges, p.r, p.c)) continue;
      const px = st.sz ? Math.round(st.sz * 13 / 11) : 13;
      ctx.font = `${st.b ? 'bold ' : ''}${st.i ? 'italic ' : ''}${px}px ${st.font ? `"${st.font}", ` : ''}${family}`;
      const text = cellText(cells[id], results[id], st);
      // Literă sub literă: câte un rând de literă pentru fiecare caracter.
      if (st.rot === STACKED) { out.set(p.r, Math.max(out.get(p.r) ?? 0, Math.min(MAX_ROW_H, Math.round([...text].length * px * 1.15 + 10)))); continue; }
      const a = Math.abs(st.rot!) * Math.PI / 180;
      const w = ctx.measureText(text).width;
      out.set(p.r, Math.max(out.get(p.r) ?? 0, Math.min(MAX_ROW_H, Math.round(w * Math.sin(a) + px * 1.3 * Math.cos(a) + 10))));
    }
    for (const [id, st] of wrapped) {
      const p = parseCellId(id);
      if (!p || hidden.has(p.r) || mergeAt(merges, p.r, p.c)) continue;
      ctx.font = `${st.b ? 'bold ' : ''}${st.i ? 'italic ' : ''}${st.sz ? Math.round(st.sz * 13 / 11) : 13}px ${st.font ? `"${st.font}", ` : ''}${family}`;
      const lines = countLines(cellText(cells[id], results[id], st), widthOf(p.c) - 11, (t) => ctx.measureText(t).width);
      if (lines > 1) out.set(p.r, Math.max(out.get(p.r) ?? 0, st.sz ? Math.round(lines * st.sz * 13 / 11 * 1.3 + 7) : wrapHeight(lines)));
    }
    return out;
  }, [styles, cells, results, colW, liveW, merges, hidden]);
  // Peste înălțimea calculată vine cea trasă cu mouse-ul (ca în Excel, înălțimea aleasă de mână are întâietate).
  const [liveH, setLiveH] = useState<{ r: number; h: number } | null>(null);
  const tall = useMemo(() => {
    if (!sheet.rowH && !liveH) return autoTall;
    const out = new Map(autoTall);
    for (const [k, h] of Object.entries(sheet.rowH ?? {})) if (!hidden.has(Number(k) - 1)) out.set(Number(k) - 1, h);
    if (liveH) out.set(liveH.r, liveH.h);
    for (const [r, h] of out) if (h <= sizes.current.rowPx) out.delete(r);
    return out;
  }, [autoTall, sheet.rowH, liveH, hidden]);
  // Unde începe fiecare rând vizibil (doar dacă există rânduri mai înalte; altfel toate au aceeași înălțime).
  const tops = useMemo(() => (tall.size ? new RowTops(shown, tall, sizes.current.rowPx) : null), [shown, tall]);
  const heightOf = (r: number) => tall.get(r) ?? sizes.current.rowPx;
  // 📄 Vedere pagini (ca Examinare sfârșit de pagină): ce nu se tipărește e gri, sfârșiturile automate de pagină sunt linii punctate.
  const [pageView, setPageView] = useState(false);
  // Sfârșiturile de pagină pe coloane puse de mână, ca text (rândurile rămân memo până se schimbă).
  const colBreakKey = (sheet.print?.colBreaks ?? []).join(',');
  const pageInfo = useMemo(() => {
    if (!pageView) return null;
    const g = printRange(cells, sheet.print, sheet.pics);
    if (!g) return null;
    const br = autoBreaks(printRows(g, hidden), heightOf, printWidths(g, colW), g.c0, sheet.print);
    const across = br.cols.length + 1;
    return { g, rows: new Set(br.rows), cols: br.cols.join(','), pages: (br.rows.length + (sheet.print?.breaks ?? []).filter((r) => r > g.r0 && r <= g.r1).length + 1) * across };
  }, [pageView, cells, sheet.print, hidden, colW, tall]); // eslint-disable-line react-hooks/exhaustive-deps
  const topOf = (i: number) => (tops ? tops.top(i) : i * sizes.current.rowPx);
  // Înălțimea pe hârtie a zonei tipărite (la 100%), cu titlul de deasupra.
  const printTall = (g: Range) => printRows(g, hidden).reduce((a, r) => a + heightOf(r), 0);
  const indexAt = (y: number) => (tops ? tops.indexAt(y) : Math.floor(y / sizes.current.rowPx));
  // Ultimul rând completat. Copierea unei coloane întregi se oprește la el, iar chenarul pe coloane întregi la cel puțin 10.000 de rânduri.
  const usedR = useMemo(() => lastUsedRow(cells), [cells]);
  const upTo = (g: Range, end: number): Range => ({ ...g, r1: Math.min(g.r1, Math.max(g.r0, end)) });
  // Formatarea condiționată: ce stil gata făcut primește fiecare celulă atinsă de o regulă.
  // ⚡ Analiză rapidă → Formatare: cât mouse-ul stă pe o evidențiere, foaia o arată cu ea (fără s-o pună; qaPrev = regulile de probă).
  const [qaPrev, setQaPrev] = useState<SheetRule[] | null>(null);
  const rules = sheet.rules, shownRules = qaPrev ?? rules;
  const looks = useMemo(() => condLooks(shownRules, cells, results, { self: sheetName, sheets: doc.sheets, names: doc.names, pivots: doc.pivots, match: doc.match, iterate: doc.iter, ext: doc.links }), [shownRules, cells, results, sheetName, doc.sheets, doc.names, doc.pivots, doc.match, doc.iter]);
  // Celulele diferite găsite de „Compară” (două tabele alăturate), pe rânduri: rândul → coloanele lui („1,4”).
  const cmpMarks = useTabMarks(tab)?.get(sheetName);
  const cmpRows = useMemo(() => {
    const m = new Map<number, number[]>();
    for (const id of cmpMarks ?? []) { const p = parseCellId(id); if (p) m.set(p.r, [...(m.get(p.r) ?? []), p.c]); }
    return m;
  }, [cmpMarks]);
  // ⚡ Analiză rapidă → Minigrafice: cât mouse-ul stă pe un fel de minigrafic, foaia îl arată (qaSparks = lista de probă).
  const [qaSparks, setQaSparks] = useState<SheetSpark[] | null>(null);
  const sparks = qaSparks ?? sheet.sparks;
  const bars = useMemo(() => ({ ...dataBars(shownRules, cells, results), ...sparkMap(sparks, cells, results) }), [shownRules, cells, results, sparks]);
  const [menu, setMenu] = useState<{ c: number; x: number; y: number } | null>(null);
  const [showCharts, setShowCharts] = useState(true);
  // Fereastra cu setările de tipărire și tipărirea în curs (pe hârtie sau în PDF).
  const [printDlg, setPrintDlg] = useState(false);
  // Bara de căutare (Ctrl+F) sau de înlocuire (Ctrl+H); tick o readuce în față când apeși din nou scurtătura.
  const [find, setFind] = useState<{ mode: 'find' | 'replace'; tick: number } | null>(null);
  // layout: doar PDF-ul paginilor pentru Vizualizare → Aspect pagină (nu se tipărește și nu se salvează nimic).
  const [printing, setPrinting] = useState<{ pdf: boolean; layout?: boolean } | null>(null);
  const [layoutOn, setLayoutOn] = useState(false);
  const [layoutPdf, setLayoutPdf] = useState<Uint8Array | null>(null);
  const [layoutErr, setLayoutErr] = useState('');
  // Ce se tipărește: foaia activă (zona ei), doar selecția, foile alese sau tot registrul.
  const [printWhat, setPrintWhat] = useState<PrintWhat>('sheet');
  // Listele derulante: fereastra în care le scrii și lista deschisă pe o celulă (▾).
  const [listDlg, setListDlg] = useState(false);
  const [noteDlg, setNoteDlg] = useState(false);
  const [cmtDlg, setCmtDlg] = useState(false);
  const [linkDlg, setLinkDlg] = useState(false);
  const [psDlg, setPsDlg] = useState(false);
  // Fereastra „Mergi la special” (celulele goale, formulele, notele…).
  const [gsDlg, setGsDlg] = useState(false);
  const [fxDlg, setFxDlg] = useState(false);
  // Formule › Utilizate recent: ultimele funcții puse din fx sau din bibliotecă (păstrate pe acest calculator).
  const [recentFns, setRecentFns] = useState<string[]>(() => { try { const v = JSON.parse(localStorage.getItem('suite.sheets.recentFns') ?? '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 10) : []; } catch { return []; } });
  // Formula care se scria când s-a apăsat fx (căsuța de editare pierde focusul când se deschide fereastra).
  const fxBase = useRef<string | null>(null);
  const [splitDlg, setSplitDlg] = useState<{ c: number; r0: number; r1: number } | null>(null);
  // Pensula de formatare: formatarea luată din zona sursă (se repetă pe zona țintă); `keep` = rămâne pornită (dublu-click).
  // Profilul de meniu (▦ Aranjare): panglica sau meniurile clasice.
  const arrange = useArrange('sheets', 'sheets');
  const [painter, setPainter] = useState<{ grid: (CellStyle | undefined)[][]; keep: boolean } | null>(null);
  const [dedupe, setDedupe] = useState<{ g: Range; head: boolean } | null>(null);
  // Editorul de interogare: zona sursă (cu capul de tabel), tabelul cu nume, datele citite; `at` = foaia rezultatului, la editare.
  const [queryDlg, setQueryDlg] = useState<{ g: Range; table?: string; file?: string; fsheet?: string; names?: string[]; data: QTable; at?: number } | null>(null);
  // Fereastra Evidențiere: true = lista regulilor; un CondOp = regulă nouă de felul acela (din Formatare condiționată ▾).
  const [condDlg, setCondDlg] = useState<boolean | CondOp>(false);
  const [namesDlg, setNamesDlg] = useState(false);
  // Ctrl+Shift+U / ˅: bara de formule extinsă (mai multe rânduri, pentru formule lungi).
  const [fxTall, setFxTall] = useState(false);
  // Din lista ＋ → Din șablon…: tabul nou pornește cu fereastra de șabloane deschisă.
  const [tplDlg, setTplDlg] = useState(() => takeTabStart(tab) === 'template');
  const [verDlg, setVerDlg] = useState(false);
  const [propsDlg, setPropsDlg] = useState(false);
  // Import din text: fișierul ales, textul lui decodat și alegerile ghicite (fereastra TextImportDialog).
  const [textDlg, setTextDlg] = useState<{ file: BinaryFile; text: string; options: TextOptions } | null>(null);
  // Import .docx (tabele): documentul citit ca HTML și câte tabele are.
  const [docDlg, setDocDlg] = useState<{ file: BinaryFile; html: string; tables: number } | null>(null);
  // Rezumatul (pivot): tabelul sursă găsit în jurul cursorului, cât e deschisă fereastra.
  const [pivotSrc, setPivotSrc] = useState<Range | null>(null);
  // Fereastra Rezumat deschisă din Grafic pivot: bifa „și un grafic” pornește pusă.
  const [pivotChart, setPivotChart] = useState(false);
  // Tabelul cu nume din care se face rezumatul (cursorul era în el), ca reîmprospătarea să-i ia zona de acum.
  const [pivotTable, setPivotTable] = useState<string | null>(null);
  const [pick, setPick] = useState<{ r: number; c: number; x: number; y: number; vals?: string[] } | null>(null);
  // Ce am copiat ultima dată din tabel, ca formulele lipite în altă parte să-și mute referințele.
  const clip = useRef<{ text: string; r: number; c: number; cut: boolean; styles: (CellStyle | undefined)[][]; raw: string[][]; values: string[][] } | null>(null);

  const load = useCallback((file: OpenedFile) => {
    try {
      const opened = parseSheetDoc(file.content);
      setDoc(opened);
      setLinkBar(!!opened.links?.length);
      if (file.draft) adoptDraft(tab, file.draft);
      else if (file.path) draftOf(tab, 'sheets', true);
      setActive(0);
      // Fără cale = tabel nou adus din alt modul (de exemplu lista unei notițe), încă nesalvat.
      setPath(file.path || null);
      setDirty(file.dirty ?? !file.path);
      setSavedAt(null);
      selectRange({ r: 0, c: 0 });
      editRef.current = null;
      setEdit(null);
      past.current = [];
      future.current = [];
      setStatus(file.path ? 'Deschis' : 'Tabel nou (nesalvat): salvează-l cu Ctrl+S.');
    } catch (e) {
      alert((e as Error).message);
    }
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Un tabel nou venit din alt modul nu înlocuiește fără întrebare unul nesalvat.
    if (!initial) return;
    const next = initial;
    // Un .xlsx / .csv adus dintr-un alt tab (Import cu tabul acela ocupat): se citește aici.
    // Din Import cu tabul ocupat (wizard): textul trece prin fereastra Import din text, documentul prin Import tabele.
    showSheet.current = next.sheet && next.imported ? { name: next.sheet, from: next.path } : null;
    const take = () => {
      if (!next.imported) return load(next);
      const file = { path: next.path, data: next.imported };
      if (TEXT_EXT.test(next.path)) return next.wizard ? openTextDialog(file) : importCsvData(file);
      if (DOC_EXT.test(next.path)) return openDocTables(file);
      return importXlsxData(file);
    };
    if (!dirty) take();
    else askYes('Ai în Sheets un tabel nesalvat. Îl înlocuiești cu cel nou?', 'Înlocuiește', 'Păstrează-l pe cel vechi').then((ok) => { if (ok) take(); });
    onConsumed();
  }, [initial, load, onConsumed]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { kept.set(tab, { doc, path, dirty, active }); }, [tab, doc, path, dirty, active]);
  useEffect(() => {
    const want = showSheet.current;
    if (!want || fromFile !== want.from) return;
    const i = doc.sheets.findIndex((s) => s.name === want.name);
    if (i < 0) return;
    showSheet.current = null;
    if (i !== active) setActive(i);
  }, [doc, fromFile]); // eslint-disable-line react-hooks/exhaustive-deps

  // Un registru deschis dintr-un .xlsx / .ods de pe disc: Ctrl+S întreabă o dată dacă scrie înapoi în el (peste fișier, cu copia
  // veche păstrată în Versiuni) sau îl face registru Cyber Office Studio; după „În .xlsx”, Ctrl+S scrie direct acolo.
  const [xlsxOut, setXlsxOut] = useState<string | null>(null);
  useEffect(() => { if (path || !fromFile) setXlsxOut(null); }, [path, fromFile]);
  // Un .csv adus (dublu-clic, ✎ Deschide foaia legată din Docs / Slides) se scrie înapoi cu separatorul lui: doar valorile foii de acum.
  const csvSep = useRef(';');
  // ... și cu codificarea lui (UTF-8 cu sau fără semnătură, Windows-1250, UTF-16…), ca programul care l-a făcut să-l citească la fel.
  const csvEnc = useRef<{ enc: TextOptions['encoding']; bom: boolean }>({ enc: 'utf-8', bom: true });
  const saveXlsxBack = async (file: string) => {
    const ext = /[.]ods$/i.test(file) ? 'ods' : /[.]csv$/i.test(file) ? 'csv' : 'xlsx';
    setStatus(`Salvez în .${ext}…`);
    try {
      let data: Uint8Array;
      let lost = '';
      if (ext === 'csv') {
        const text = cellsToCsv(cells, results, styles, csvSep.current);
        const e = encodeText(text, csvEnc.current.enc, csvEnc.current.bom);
        // Litere pe care codificarea veche nu le are (de exemplu „ș” în Windows-1252): tot fișierul trece în UTF-8, fără pierderi.
        if (e.lost) { lost = csvEnc.current.enc; csvEnc.current = { enc: 'utf-8', bom: true }; data = encodeText(text, 'utf-8', true).data; } else data = e.data;
      } else data = await bookBytes(ext);
      await api.overwriteFile!({ path: file, format: ext, data });
      setXlsxOut(file);
      setDirty(false);
      setSavedAt(new Date().toLocaleTimeString('ro-RO'));
      setStatus(lost ? `Salvat în ${fileName(file)} cu codificarea UTF-8: are litere pe care codificarea lui de până acum (${lost}) nu le poate scrie. Copia de dinainte e păstrată în Versiuni.`
        : `Salvat în ${fileName(file)}. Copia de dinainte e păstrată în Versiuni.`);
      // Tabelele legate de acest fișier (Docs, Slides, Notițe deschise) se aduc singure la zi.
      fileSaved(file);
    } catch {
      setStatus(`Fișierul .${ext} nu s-a putut salva peste cel vechi (poate e deschis în alt program sau e doar pentru citire). Folosește Salvează ca.`);
    }
  };
  const save = useCallback(async (saveAs = false) => {
    if (!saveAs && !path && xlsxOut) { await saveXlsxBack(xlsxOut); return; }
    const ext = fromFile?.match(/[.](xlsx|ods|csv)$/i)?.[1].toLowerCase();
    if (!saveAs && !path && fromFile && api.overwriteFile && ext) {
      const i = await ask('Unde salvezi?', ext === 'csv'
        ? `Tabelul a fost deschis din „${fileName(fromFile)}”. Îl salvezi înapoi în acest fișier .csv (doar valorile foii de acum, fără formule și formatare; copia de dinainte rămâne în Versiuni) sau ca registru Cyber Office Studio (.ssheet), care păstrează tot ce ai făcut în Suite?`
        : `Registrul a fost deschis din „${fileName(fromFile)}”. Îl salvezi înapoi în acest fișier .${ext} (copia de dinainte rămâne în Versiuni) sau ca registru Cyber Office Studio (.ssheet), care păstrează tot ce ai făcut în Suite?`,
      ['Renunță', 'Ca .ssheet…', ext === 'ods' ? 'În .ods' : ext === 'csv' ? 'În .csv' : 'În .xlsx'], 2);
      if (i < 1) return;
      if (i === 2) { await saveXlsxBack(fromFile); return; }
    }
    const res = await api.saveFile({
      path: saveAs ? null : path,
      content: serializeSheetDoc(doc),
      kind: 'sheets',
      suggestedName: safeFileName(doc.title || 'Tabel'),
      ...(path ? {} : importedSave(fromFile)),
    });
    if (!res) return;
    if (!path) dropDraft(tab, 'sheets');
    setPath(res.path);
    setDirty(false);
    setSavedAt(new Date().toLocaleTimeString('ro-RO'));
  }, [doc, path, fromFile, tab, xlsxOut]); // eslint-disable-line react-hooks/exhaustive-deps

  const markDirty = () => setDirty(true);

  // Mesajele dispar singure după 10 secunde (cât să le citești), ca să nu rămână unele vechi.
  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(''), 10000);
    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => { setGroup([]); }, [doc.sheets.length]);
  // Aceeași schimbare de celule și pe celelalte foi din grup (cele protejate se sar).
  const applyToGroup = (patch: Cells, stylePatch: Styles) => {
    const others = group.filter((j) => j !== active);
    if (!others.length) return;
    setDoc((d) => ({ ...d, sheets: d.sheets.map((x, j) => {
      if (!others.includes(j) || x.protect) return x;
      const c2 = { ...x.cells }; const s2 = { ...x.styles };
      for (const [id, v] of Object.entries(patch)) { if (v === '') delete c2[id]; else c2[id] = v; }
      for (const [id, st] of Object.entries(stylePatch)) { if (!Object.keys(st).length) delete s2[id]; else s2[id] = st; }
      return { ...x, cells: c2, styles: s2 };
    }) }));
  };
  const setSheet = (next: Sheet) => {
    const i = active;
    setDoc((d) => ({ ...d, sheets: d.sheets.map((s, j) => (j === i ? next : s)) }));
    markDirty();
  };

  const remember = () => {
    past.current = [...past.current.slice(-HISTORY + 1), { sheets: doc.sheets, active }];
    future.current = [];
  };
  // Revizuire → Afișare modificări: o schimbare a foilor e a utilizatorului dacă starea de dinainte e chiar ultima ținută
  // minte pentru Ctrl+Z (deschiderile golesc istoria, anulările o scot), și atunci celulele schimbate intră în jurnal.
  const prevSheets = useRef(doc.sheets);
  const [changesOpen, setChangesOpen] = useState(false);
  useEffect(() => {
    const before = prevSheets.current;
    prevSheets.current = doc.sheets;
    if (before === doc.sheets || past.current[past.current.length - 1]?.sheets !== before) return;
    const key = (n: string) => n.toLocaleLowerCase('ro-RO');
    let who = '';
    try { who = localStorage.getItem('suite.docs.author') ?? ''; } catch { /* fără nume */ }
    const t = Date.now(), more: CellChange[] = [];
    for (const x of doc.sheets) {
      const o = before.find((y) => key(y.name) === key(x.name));
      if (o && o.cells !== x.cells) more.push(...diffCells(x.name, o.cells, x.cells, t, who.trim()));
    }
    if (more.length) setDoc((d) => ({ ...d, changes: addChanges(d.changes, more) }));
  }, [doc.sheets]);

  // Schimbă foaia și ține minte starea de dinainte, pentru Ctrl+Z (conținut, formatare și lățimi).
  // Pe o foaie protejată, schimbările pe celulele blocate se refuză (ca în Excel). Întoarce mesajul, sau null dacă se poate.
  const lockedChange = (from: Sheet, to: Sheet): string | null => {
    if (!from.protect || !to.protect) return null;
    const bad = (id: string) => !from.styles[id]?.unlock;
    for (const id of new Set([...Object.keys(from.cells), ...Object.keys(to.cells)])) if ((from.cells[id] ?? '') !== (to.cells[id] ?? '') && bad(id)) return id;
    if (from.styles !== to.styles) for (const id of new Set([...Object.keys(from.styles), ...Object.keys(to.styles)])) if (JSON.stringify(from.styles[id]) !== JSON.stringify(to.styles[id]) && bad(id)) return id;
    const same = (k: keyof Sheet) => JSON.stringify(from[k] ?? null) === JSON.stringify(to[k] ?? null);
    if (!same('merges') || !same('hideRows') || !same('hideCols') || !same('rowLvl') || !same('colLvl') || !same('lists') || !same('rules') || !same('charts') || !same('pics')) return 'foaia';
    return null;
  };
  const protectMsg = (where: string) => setStatus(`Foaia e protejată: ${where === 'foaia' ? 'nu se poate schimba așezarea ei' : `celula ${where} nu se poate modifica`}. Oprește protecția din Revizuire › Anulare protejare foaie.`);
  const applySheet = (next: Sheet) => {
    const bad = lockedChange(sheet, next);
    if (bad) { protectMsg(bad); return; }
    remember();
    const srt = recSort.current;
    recSort.current = null;
    if (rec && rec.sheet === sheet.name) {
      const st = srt ? sortStep(srt.g, srt.head, srt.levels, srt.picked, rec.from, rec.rel) ?? diffStep(sheet, next, rec.from, rec.rel) : diffStep(sheet, next, rec.from, rec.rel);
      // Filtrul pus / schimbat / oprit e un pas al lui (la rulare se pune același filtru, pe datele de atunci).
      const ft = filterStep(sheet.filter, next.filter, rec.from, rec.rel);
      // La fel lățimile coloanelor, înălțimile rândurilor și rândurile / coloanele ascunse.
      const ly = layoutStep(sheet, next, rec.from, rec.rel);
      if (st || ft || ly) setRec((r) => (r ? { ...r, steps: [st, ft, ly].reduce((a, x) => (x ? addStep(a, x) : a), r.steps) } : r));
    }
    setSheet(next);
  };

  // Treci pe altă foaie: editarea în curs se termină în foaia veche, cursorul pornește din A1.
  useEffect(() => {
    if (doc.sheets[active]?.hidden) {
      const v = doc.sheets.findIndex((s) => !s.hidden);
      if (v >= 0) setActive(v);
    }
  }, [doc.sheets, active]);

  // ♿ Accesibilitate: lista problemelor din toate foile (foaia de acum cu ce s-a scris în ea), cu salt la fiecare.
  const [a11y, setA11y] = useState<SheetIssue[] | null>(null);
  // ABC Ortografie (F7): cuvintele din celulele cu text, de la celula aleasă.
  const [spellOpen, setSpellOpen] = useState(false);
  // Revizuire › ✓ Gramatică: greșelile din celulele cu text ale foii (la zi cu foaia); textele ignorate nu se mai arată.
  const [gramOpen, setGramOpen] = useState(false);
  const [gramIgnored, setGramIgnored] = useState<string[]>([]);
  const runA11y = () => { finishEdit(); setA11y(checkSheets(doc.sheets.map((x, i) => (i === active ? { ...x, cells, styles } : x)))); };
  const goIssue = (it: SheetIssue) => {
    setA11y(null);
    if (it.sheet !== active) switchSheet(it.sheet);
    const p = it.cell ? parseCellId(it.cell) : null;
    if (p) selectRange({ r: p.r, c: p.c });
    focusGrid();
  };
  const switchSheet = (i: number) => {
    finishEdit();
    setMenu(null);
    setTabMenu(null);
    if (i === active || i < 0 || i >= doc.sheets.length) { focusGrid(); return; }
    setActive(i);
    selectRange({ r: 0, c: 0 });
    focusGrid();
  };

  // Adăugare, ștergere, mutare, redenumire de foi: tot un pas de anulare (Ctrl+Z aduce foaia înapoi).
  const applySheets = (next: { sheets: Sheet[]; active: number }, pivot?: PivotDef) => {
    finishEdit();
    // Inserarea / ștergerea de rânduri pe o foaie protejată (aceeași foaie, aceleași foi).
    if (next.sheets.length === doc.sheets.length && next.sheets[active] && next.sheets[active].name === sheet.name) {
      const bad = lockedChange(sheet, next.sheets[active]);
      if (bad) { protectMsg(bad); setHeadMenu(null); focusGrid(); return; }
    }
    // Structura registrului protejată: foile rămân aceleași (nume, ordine, ascunse, culori).
    const shape = (ss: Sheet[]) => JSON.stringify(ss.map((s) => [s.name, !!s.hidden, s.tab ?? '']));
    if (doc.lockBook && shape(next.sheets) !== shape(doc.sheets)) {
      setStatus('Structura registrului e protejată: foile nu se pot adăuga, șterge, redenumi, muta, ascunde sau colora. Oprește protecția din Revizuire › Anulare protejare registru.');
      setTabMenu(null); focusGrid(); return;
    }
    remember();
    // Un rezumat nou înlocuiește definiția veche a unei foi cu același nume (de exemplu după o anulare).
    setDoc((d) => ({ ...d, sheets: next.sheets,
      ...(pivot ? { pivots: [...(d.pivots ?? []).filter((p) => p.sheet.toLocaleLowerCase('ro-RO') !== pivot.sheet.toLocaleLowerCase('ro-RO')), pivot] } : {}) }));
    markDirty();
    if (next.active !== active) { setActive(next.active); selectRange({ r: 0, c: 0 }); }
    setTabMenu(null);
    focusGrid();
  };

  const newTab = () => {
    if (doc.sheets.length >= MAX_SHEETS) { setStatus(`Un tabel poate avea cel mult ${MAX_SHEETS} de foi`); return; }
    applySheets(addSheet(doc.sheets, active));
  };

  /** Prima foaie vizibilă de la i în direcția dir (fără i); i dacă nu mai e alta. */
  const visibleFrom = (i: number, dir: number) => {
    for (let j = i + dir; j >= 0 && j < doc.sheets.length; j += dir) if (!doc.sheets[j].hidden) return j;
    return i;
  };
  const visibleCount = doc.sheets.filter((s) => !s.hidden).length;

  const hideTab = (i: number) => {
    setTabMenu(null);
    if (visibleCount <= 1) { setStatus('Cel puțin o foaie trebuie să rămână vizibilă'); return; }
    const to = visibleFrom(i, 1) !== i ? visibleFrom(i, 1) : visibleFrom(i, -1);
    applySheets({ sheets: doc.sheets.map((s, j) => (j === i ? { ...s, hidden: true } : s)), active: to });
    setStatus(`Foaia „${doc.sheets[i].name}” e ascunsă (click dreapta pe o filă → Afișează foaia ascunsă)`);
  };

  const unhideTab = (i: number) => {
    setTabMenu(null);
    const { hidden: _h, ...rest } = doc.sheets[i];
    applySheets({ sheets: doc.sheets.map((s, j) => (j === i ? rest : s)), active: i });
    setStatus(`Foaia „${doc.sheets[i].name}” se vede din nou`);
  };

  const colorTab = (i: number, color: string | undefined) => {
    const { tab: _t, ...rest } = doc.sheets[i];
    applySheets({ sheets: doc.sheets.map((s, j) => (j === i ? (color ? { ...rest, tab: color } : rest) : s)), active });
  };

  const deleteTab = async (i: number) => {
    setTabMenu(null);
    if (doc.sheets.length <= 1) { setStatus('Tabelul trebuie să aibă cel puțin o foaie'); return; }
    if (!doc.sheets[i].hidden && visibleCount <= 1) { setStatus('Nu poți șterge singura foaie vizibilă: afișează întâi una ascunsă'); return; }
    const s = doc.sheets[i];
    if (!sheetIsEmpty(s) && !(await askYes(`Ștergi foaia „${s.name}” cu tot ce e în ea? (Ctrl+Z o aduce înapoi)`, 'Șterge foaia'))) return;
    applySheets(removeSheet(doc.sheets, i));
    setStatus(`Foaia „${s.name}” a fost ștearsă (Ctrl+Z o aduce înapoi)`);
  };

  // Întoarce false dacă numele nu e bun, ca fila să rămână în modul de redenumire.
  const renameTab = (i: number, name: string) => {
    if (name.trim() === doc.sheets[i].name) { setRenaming(null); focusGrid(); return true; }
    const err = sheetNameError(name, doc.sheets, i);
    if (err) { setStatus(err); return false; }
    setRenaming(null);
    applySheets({ sheets: renameSheet(doc.sheets, i, name), active: i });
    return true;
  };

  // Schimbă mai multe celule deodată (și, dacă e cazul, formatul lor) într-un singur pas de anulare.
  // În stylePatch, un format gol ({}) șterge formatarea celulei.
  const applyCells = (patch: Cells, stylePatch: Styles = {}) => {
    const next = { ...cells };
    let changed = false;
    for (const [id, v] of Object.entries(patch)) {
      if ((next[id] ?? '') === v) continue;
      changed = true;
      if (v === '') delete next[id]; else next[id] = v;
    }
    let nextStyles = styles;
    for (const [id, st] of Object.entries(stylePatch)) {
      const empty = !Object.keys(st).length;
      if (empty ? !(id in nextStyles) : JSON.stringify(nextStyles[id]) === JSON.stringify(st)) continue;
      if (nextStyles === styles) nextStyles = { ...styles };
      if (empty) delete nextStyles[id]; else nextStyles[id] = st;
    }
    if (!changed && nextStyles === styles) return;
    applyToGroup(patch, stylePatch);
    // Ce scrii pe rândul de sub un tabel cu nume intră în tabel (cu dungile și formatul lui), ca în programele cunoscute.
    const grow = changed ? growTables(sheet.tables, next, nextStyles, Object.keys(patch)) : null;
    // Coloanele calculate: formula scrisă într-o coloană goală a tabelului se completează pe toată coloana,
    // iar rândurile noi ale tabelului primesc formulele coloanelor calculate (un singur pas de anulare).
    const calc = changed && sheet.tables?.length ? calcColumns(sheet.tables, grow?.tables ?? sheet.tables, cells, next, Object.keys(patch)) : null;
    if (calc) {
      for (const [id, v] of Object.entries(calc.cells)) next[id] = v;
      if (calc.filled.length) setStatus('Coloană calculată: formula s-a completat pe toată coloana tabelului (Ctrl+Z o anulează).');
    }
    if (grow) {
      nextStyles = { ...nextStyles, ...grow.styles };
      applySheet({ ...sheet, cells: next, styles: nextStyles, tables: grow.tables });
      return;
    }
    applySheet({ ...sheet, cells: next, styles: nextStyles });
  };

  // Aplică o schimbare de formatare pe toată zona selectată.
  // Ultima formatare pusă (F4 o repetă pe celulele alese după ea).
  const lastFmt = useRef<((s: CellStyle) => CellStyle) | null>(null);
  const styleRange = (fn: (s: CellStyle) => CellStyle) => {
    lastFmt.current = fn;
    const next = { ...styles };
    // Pe toate zonele selectate (și cele adăugate cu Ctrl); o celulă din două zone se schimbă o singură dată.
    const done = new Set<string>();
    for (const g of allRanges) {
      eachCell(g, [cells, styles], (r, c) => {
        const id = cellId(r, c);
        if (done.has(id)) return;
        done.add(id);
        const s = Object.fromEntries(Object.entries(fn({ ...next[id] })).filter(([, v]) => v !== undefined && v !== false));
        if (Object.keys(s).length) next[id] = s; else delete next[id];
      });
    }
    applySheet({ ...sheet, styles: next });
    focusGrid();
  };

  // Legătura celulei curente: adresa (web, e-mail sau un loc din tabel) și, dacă celula e goală, textul arătat.
  const saveLink = (url: string, text: string) => {
    const { link: _old, ...rest } = styles[selId] ?? {};
    const u = url.trim();
    const link = u ? cleanLink(u.startsWith('#') || /^[a-z]+:/i.test(u) || /^www[.]/i.test(u) || u.includes('@') ? u : 'https://' + u) : null;
    if (u && !link) { setStatus('Adresa nu e bună: scrie de exemplu www.exemplu.ro, nume@exemplu.ro sau #Foaia 1!A1'); return; }
    const shown = text.trim() || (!(cells[selId] ?? '').trim() && link ? link.replace(/^mailto:/i, '').replace(/^#/, '') : '');
    applyCells(shown ? { [selId]: shown } : {}, { [selId]: link ? { ...rest, link } : rest });
    setLinkDlg(false);
    setStatus(link ? `Legătură pusă pe ${selId}: Ctrl+clic pe celulă o deschide` : `Legătura de pe ${selId} a fost scoasă`);
    focusGrid();
  };
  // Ω Simbol: în celula care se scrie, la cursor; altfel celula curentă intră în scriere cu simbolul la final.
  const insertSymbol = (ch: string) => {
    const t = document.activeElement;
    if (edit !== null && (t instanceof HTMLTextAreaElement || t instanceof HTMLInputElement) && t.value === edit) {
      const a = t.selectionStart ?? edit.length, b = t.selectionEnd ?? a;
      changeEdit(edit.slice(0, a) + ch + edit.slice(b));
      requestAnimationFrame(() => t.setSelectionRange(a + ch.length, a + ch.length));
      return;
    }
    if (edit !== null) { changeEdit(edit + ch); return; }
    setExt(sel);
    startEdit(editTextOf(selId) + ch);
    enterMode.current = true;
  };
  // Ctrl+clic pe o celulă cu legătură: adresele web / e-mail în browser, locurile din tabel aici.
  const followLink = (link: string) => {
    if (link.startsWith('#')) {
      const m = /^#(?:'((?:[^']|'')+)'|([^!]+))![$]?([A-Z]{1,3})[$]?([0-9]+)$/i.exec(link);
      if (!m) return;
      const name = (m[1]?.replace(/''/g, "'") ?? m[2]).trim().toLowerCase();
      const i = doc.sheets.findIndex((x) => x.name.toLowerCase() === name);
      const at = parseCellId(m[3].toUpperCase() + m[4]);
      if (i < 0 || !at) { setStatus('Locul din legătură nu mai există'); return; }
      if (i !== active) switchSheet(i);
      setTimeout(() => selectRange(at), 0);
      return;
    }
    window.open(link, '_blank');
  };

  // Nota se pune doar pe celula curentă (ca în Excel); un text gol o șterge.
  const saveNote = (text: string) => {
    const note = text.trim() ? text.replace(/\s+$/, '').slice(0, MAX_NOTE) : undefined;
    const { note: _old, ...rest } = styles[selId] ?? {};
    applyCells({}, { [selId]: note ? { ...rest, note } : rest });
    setNoteDlg(false);
    setStatus(note ? `Notă pusă pe ${selId}` : `Nota de pe ${selId} a fost ștearsă (Ctrl+Z o aduce înapoi)`);
    focusGrid();
  };

  // Comentariul cu fir al celulei curente: un fir gol îl șterge; fereastra rămâne deschisă după un răspuns.
  const saveComment = (th: CellComment[], done: boolean) => {
    const { cmt: _c, cdone: _d, ...rest } = styles[selId] ?? {};
    applyCells({}, { [selId]: th.length ? { ...rest, cmt: th, ...(done ? { cdone: true } : {}) } : rest });
    if (!th.length) { setCmtDlg(false); focusGrid(); }
    setStatus(th.length ? (done ? `Firul de pe ${selId} e rezolvat` : `Comentariu salvat pe ${selId}`) : `Comentariul de pe ${selId} a fost șters (Ctrl+Z îl aduce înapoi)`);
  };
  // Revizuire › Comentarii: comentariul anterior / următor, pe rânduri, de sus în jos.
  const goComment = (dir: 1 | -1) => {
    const list = Object.keys(styles).filter((id) => styles[id]?.cmt?.length).map((id) => parseCellId(id)).filter((p): p is { r: number; c: number } => !!p)
      .sort((a, b) => a.r - b.r || a.c - b.c);
    if (!list.length) { setStatus('Foaia nu are comentarii: le pui cu Comentariu nou (Ctrl+Alt+M)'); focusGrid(); return; }
    const after = list.filter((p) => (dir > 0 ? p.r > sel.r || (p.r === sel.r && p.c > sel.c) : p.r < sel.r || (p.r === sel.r && p.c < sel.c)));
    const p = dir > 0 ? after[0] ?? list[0] : after[after.length - 1] ?? list[list.length - 1];
    finishEdit(); selectRange(p, p);
    const st = styles[cellId(p.r, p.c)];
    setStatus(`Comentariul din ${cellId(p.r, p.c)}: ${st?.cmt ? threadText(st.cmt, st.cdone).replace(/\n/g, ' · ') : ''}`);
  };

  const toggleStyle = (k: 'b' | 'i' | 'u' | 's') => {
    const on = !selStyle[k];
    styleRange((s) => ({ ...s, [k]: on }));
  };
  // x² / x₂: încă o apăsare pe același buton scoate exponentul / indicele.
  const togglePos = (pos: 'sup' | 'sub') => {
    const on = selStyle.pos !== pos;
    styleRange((s) => { const n = { ...s }; if (on) n.pos = pos; else delete n.pos; return n; });
  };

  // Linia de chenar aleasă (felul și culoarea); schimbarea ei se pune și pe chenarele deja trase în selecție.
  const [lineLook, setLineLook] = useState<{ st?: LineStyle; col?: string }>({});
  // Ultimele culori alese din paletă (le pune clicul pe butonul mare): galben la umplere, roșu la font, ca de obicei.
  const [lastFill, setLastFill] = useState('#ffff00');
  const [lastInk, setLastInk] = useState('#ff0000');
  const palette = useMemo(() => sheetPalette(themeColorsOf(doc.theme), doc.theme?.name), [doc.theme]);
  // Tema registrului: paleta nouă, iar celulele (și filele) colorate cu culori sau nuanțe din tema veche iau culoarea din același loc.
  const applyBookTheme = (t: BookTheme | undefined) => {
    finishEdit();
    const map = themeColorMap(themeColorsOf(doc.theme), themeColorsOf(t));
    remember();
    let changed = 0;
    const sheets = doc.sheets.map((s) => {
      const styles = recolorStyles(s.styles, map);
      const tab = s.tab && map.get(s.tab.toLowerCase());
      if (styles === s.styles && !tab) return s;
      changed++;
      return { ...s, styles, ...(tab ? { tab } : {}) };
    });
    setDoc((d) => {
      const n: SheetDoc = { ...d, sheets }, fonts = d.theme?.fonts;
      // Fonturile temei rămân la schimbarea culorilor.
      if (t || fonts) n.theme = { name: (t ?? BOOK_THEMES[0]).name, colors: [...themeColorsOf(t)], ...(fonts ? { fonts } : {}) }; else delete n.theme;
      return n;
    });
    markDirty();
    setStatus('Tema: ' + (t?.name ?? BOOK_THEMES[0].name) + (changed ? ' (culorile din paletă s-au schimbat pe ' + changed + (changed === 1 ? ' foaie)' : ' foi)') : ''));
  };
  // Fonturile temei (Titluri / Corp): celulele cu fontul de Titluri vechi îl iau pe cel nou; cele cu Corp urmează fontul obișnuit.
  const themeFonts = themeFontsOf(doc.theme);
  const applyThemeFonts = (to: ThemeFonts) => {
    finishEdit();
    const from = themeFontsOf(doc.theme);
    remember();
    let changed = 0;
    const sheets = doc.sheets.map((s) => {
      const styles = refontStyles(s.styles, from, to);
      if (styles === s.styles) return s;
      changed++;
      return { ...s, styles };
    });
    const plain = to.major === DEFAULT_FONTS.major && to.minor === DEFAULT_FONTS.minor;
    setDoc((d) => {
      const n: SheetDoc = { ...d, sheets };
      const colors = themeColorsOf(d.theme);
      if (!plain || colors.join() !== themeColorsOf(undefined).join()) n.theme = { name: d.theme?.name ?? BOOK_THEMES[0].name, colors: [...colors], ...(plain ? {} : { fonts: { ...to } }) };
      else delete n.theme;
      return n;
    });
    markDirty();
    setStatus('Fonturile temei: ' + to.major + ' / ' + to.minor + (changed ? ' (fonturile s-au schimbat pe ' + changed + (changed === 1 ? ' foaie)' : ' foi)') : ''));
  };
  const setLine = (look: { st?: LineStyle; col?: string }) => {
    setLineLook(look);
    const patch: Styles = {};
    for (const g of allRanges) eachCell(g, [styles], (r, c) => { const id = cellId(r, c); if (styles[id]?.bd) patch[id] = styles[id]; });
    if (Object.keys(patch).length) applyCells({}, withLook(patch, look));
  };
  const setFormat = (fmt: NumFmt) => styleRange((s) => ({ ...s, fmt: fmt === 'general' ? undefined : fmt, dec: undefined, code: undefined }));
  // Format particularizat (cod): fereastra cu codul, exemple și previzualizare pe celula curentă.
  const [codeDlg, setCodeDlg] = useState<string | null>(null);
  // Fereastra Formatare celule (Ctrl+1): schimbările atinse în ea se pun pe toată selecția, chenarul ales la fel.
  const [fmtCellsDlg, setFmtCellsDlg] = useState<FormatTab | null>(null);
  // Stilurile de celulă ale utilizatorului (ținute în registru): ca la cele gata făcute, stilul înlocuiește tot formatul
  // celulelor alese (câmpurile pe care stilul nu le are se scot), chenarele rămân.
  const applyUserStyle = (u: UserCellStyle) => {
    finishEdit();
    const ch: StyleChanges = Object.fromEntries(CELL_STYLE_KEYS.map((k) => [k, u.st[k]]));
    // Celula ține minte stilul, ca să urmeze schimbările lui (✎ Modifică un stil…).
    applyCellsDlg({ ...ch, sty: u.name } as StyleChanges, null);
    setStatus(`Stilul de celulă „${u.name}” (Ctrl+Z îl scoate)`);
  };
  const newUserStyle = () => {
    finishEdit();
    const cur = styles[selId] ?? {};
    const st = Object.fromEntries(CELL_STYLE_KEYS.filter((k) => cur[k] !== undefined).map((k) => [k, cur[k]])) as Partial<CellStyle>;
    void askText('Stil nou', `Numele stilului (formatul celulei ${selId}: font, culori, număr, aliniere)`, `Stilul meu ${(doc.cellStyles?.length ?? 0) + 1}`).then((txt) => {
      const name = txt?.trim().slice(0, 60);
      if (!name) { focusGrid(); return; }
      if (CELL_STYLES.some((c) => c.label.toLocaleLowerCase('ro') === name.toLocaleLowerCase('ro'))) { setStatus(`Stil nou: „${name}” e numele unui stil gata făcut; alege alt nume`); focusGrid(); return; }
      setDoc((d) => {
        const list = (d.cellStyles ?? []).filter((x) => x.name.toLocaleLowerCase('ro') !== name.toLocaleLowerCase('ro'));
        return { ...d, cellStyles: [...list, { name, st }].slice(-100) };
      });
      setDirty(true);
      setStatus(`Stilul „${name}” e în Stiluri celulă (se păstrează în registru)`);
      focusGrid();
    });
  };
  // ✎ Modifică un stil: stilul ia formatul celulei curente, iar toate celulele care îl au (pe toate foile) se schimbă odată cu el.
  const modifyUserStyle = () => {
    finishEdit();
    const list = doc.cellStyles ?? [];
    const cur = styles[selId] ?? {};
    const mine = list.filter((x) => !isBuiltinName(x.name)).map((x) => x.name);
    void askText('Modifică un stil', `Care stil ia formatul celulei ${selId}? (${[...mine, 'sau unul gata făcut, de exemplu Bun, Titlu 1, Notă'].join(', ')}). Celulele care îl au se schimbă toate.`, cur.sty ?? mine[mine.length - 1] ?? '').then((txt) => {
      const key = txt?.trim().toLocaleLowerCase('ro');
      // Numele gata făcute se recunosc și în engleză (Good, Heading 1…), ca în lista de pe ecran.
      const builtin = key ? CELL_STYLES.find((c) => c.label.toLocaleLowerCase('ro') === key || translate(c.label)?.toLowerCase() === key) : undefined;
      const old = key ? list.find((x) => x.name.toLocaleLowerCase('ro') === key) ?? (builtin ? { name: builtin.label, st: {} } : undefined) : undefined;
      if (!old) { if (key) setStatus(`Nu există stilul „${txt!.trim()}”`); focusGrid(); return; }
      const st = Object.fromEntries(CELL_STYLE_KEYS.filter((k) => cur[k] !== undefined).map((k) => [k, cur[k]])) as Partial<CellStyle>;
      let count = 0;
      const sheets = doc.sheets.map((s) => {
        let next: Styles | null = null;
        for (const [id, c] of Object.entries(s.styles)) {
          if (c.sty !== old.name) continue;
          const n: CellStyle = { ...c };
          for (const k of CELL_STYLE_KEYS) delete n[k];
          Object.assign(n, st);
          (next ??= { ...s.styles })[id] = n;
          count++;
        }
        return next ? { ...s, styles: next } : s;
      });
      // Și celula curentă intră în stil (de la ea s-a luat formatul).
      if (cur.sty !== old.name) { const s = sheets[active]; sheets[active] = { ...s, styles: { ...s.styles, [selId]: { ...cur, sty: old.name } } }; }
      applySheets({ sheets, active });
      setDoc((d) => {
        const own = d.cellStyles ?? [];
        return { ...d, cellStyles: own.some((x) => x.name === old.name) ? own.map((x) => (x.name === old.name ? { name: x.name, st } : x)) : [...own, { name: old.name, st }].slice(-100) };
      });
      setStatus(`Stilul „${old.name}” a fost modificat${count ? ` (${count} ${count === 1 ? 'celulă s-a schimbat' : 'celule s-au schimbat'})` : ''}`);
    });
  };
  // Stilurile gata făcute modificate de om se țin în cellStyles cu numele lor (și în .xlsx, ca stiluri cu nume).
  const isBuiltinName = (name: string) => CELL_STYLES.some((c) => c.label.toLocaleLowerCase('ro') === name.toLocaleLowerCase('ro'));
  const builtinOverride = (label: string) => doc.cellStyles?.find((x) => x.name.toLocaleLowerCase('ro') === label.toLocaleLowerCase('ro'));
  const deleteUserStyle = () => {
    finishEdit();
    const list = doc.cellStyles ?? [];
    void askText('Șterge un stil nou', `Care stil îl ștergi? (${list.map((x) => x.name).join(', ')})`, list[list.length - 1]?.name ?? '').then((txt) => {
      const name = txt?.trim().toLocaleLowerCase('ro');
      if (!name) { focusGrid(); return; }
      if (!list.some((x) => x.name.toLocaleLowerCase('ro') === name)) { setStatus(`Nu există stilul „${txt!.trim()}”`); focusGrid(); return; }
      setDoc((d) => { const n: SheetDoc = { ...d, cellStyles: (d.cellStyles ?? []).filter((x) => x.name.toLocaleLowerCase('ro') !== name) }; if (!n.cellStyles?.length) delete n.cellStyles; return n; });
      setDirty(true);
      setStatus('Stilul a fost șters; celulele care îl aveau își păstrează formatul');
      focusGrid();
    });
  };
  const applyCellsDlg = (ch: StyleChanges, border: Parameters<typeof formatCellsPatch>[4]) => {
    setFmtCellsDlg(null);
    const ranges = allRanges.map((g) => upTo(g, Math.max(WORK_ROWS - 1, usedR)));
    const patch = formatCellsPatch(cells, styles, ranges, ch, border);
    if (Object.keys(patch).length) applyCells({}, patch);
    focusGrid();
  };
  const applyCode = (raw: string) => { const c = raw.trim(); styleRange((s) => ({ ...s, code: c || undefined, ...(c ? { fmt: undefined, dec: undefined } : {}) })); setCodeDlg(null); };

  // ,0 / ,00: mai puține sau mai multe zecimale; un număr „General” trece la formatul Număr.
  const changeDecimals = (d: number) => {
    // La oră (și dată cu oră), ,00 adaugă secundele și ,0 le scoate; la fracție și dată nu se schimbă nimic.
    const fmt: NumFmt = selStyle.fmt === 'datetime' || selStyle.fmt === 'time' ? selStyle.fmt
      : selStyle.fmt && !DATE_FMTS.includes(selStyle.fmt) && selStyle.fmt !== 'fraction' ? selStyle.fmt : 'number';
    const dec = Math.max(0, Math.min(fmt === 'time' || fmt === 'datetime' ? 1 : 10, (selStyle.dec ?? DEFAULT_DEC[fmt]) + d));
    styleRange((s) => ({ ...s, fmt, dec, code: undefined }));
  };

  const setColWidth = (c: number, w: number) => {
    const name = colName(c);
    if ((colW[name] ?? COL_W) === w) return;
    const next = { ...colW };
    if (w === COL_W) delete next[name]; else next[name] = w;
    applySheet({ ...sheet, colW: next });
  };

  // Tragi de marginea din dreapta a literei coloanei ca s-o lățești sau s-o îngustezi.
  const startResize = (c: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const x0 = e.clientX;
    const w0 = widthOf(c);
    const z = zoom / 100;
    const at = (x: number) => Math.round(Math.max(MIN_COL_W, Math.min(MAX_COL_W, w0 + (x - x0) / z)));
    const onMove = (ev: MouseEvent) => setLiveW({ c, w: at(ev.clientX) });
    const onUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMove);
      setLiveW(null);
      latest.current.setColWidth(c, at(ev.clientX));
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp, { once: true });
  };

  // Tragi de marginea de jos a numărului rândului ca să-l faci mai înalt; dublu-click îl readuce la înălțimea automată.
  const setRowHeight = (r: number, h: number | null) => {
    const key = String(r + 1);
    const next = { ...sheet.rowH };
    if (h === null) { if (!(key in next)) return; delete next[key]; } else { if (next[key] === h) return; next[key] = h; }
    const s: Sheet = { ...sheet, rowH: next };
    if (!Object.keys(next).length) delete s.rowH;
    applySheet(s);
  };
  const startRowResize = (r: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const y0 = e.clientY;
    const h0 = tall.get(r) ?? sizes.current.rowPx;
    const z = zoom / 100;
    const at = (y: number) => Math.round(Math.max(MIN_ROW_H, Math.min(MAX_ROW_H, h0 + (y - y0) / z)));
    const onMove = (ev: MouseEvent) => setLiveH({ r, h: at(ev.clientY) });
    const onUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMove);
      setLiveH(null);
      latest.current.setRowHeight(r, at(ev.clientY));
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp, { once: true });
  };

  // Dublu-click pe margine: coloana se potrivește după cel mai lung text din ea.
  // Mărimea mai multor coloane / rânduri deodată, într-un singur pas de anulare (Format ▾, Potrivire automată pe o zonă).
  const setColWidths = (cols: number[], w: (c: number) => number) => {
    const next = { ...colW };
    for (const c of cols) { const v = w(c); if (v === COL_W) delete next[colName(c)]; else next[colName(c)] = v; }
    applySheet({ ...sheet, colW: next });
  };
  const setRowHeights = (r0: number, r1: number, h: number | null) => {
    const next = { ...sheet.rowH };
    for (let r = r0; r <= r1; r++) { if (h === null) delete next[String(r + 1)]; else next[String(r + 1)] = h; }
    const s: Sheet = { ...sheet, rowH: next };
    if (!Object.keys(next).length) delete s.rowH;
    applySheet(s);
  };
  const colsIn = (c0: number, c1: number) => Array.from({ length: c1 - c0 + 1 }, (_, i) => c0 + i);
  const autoFit = (c: number) => setColWidth(c, fitWidth(c));
  const fitWidth = (c: number) => {
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return COL_W;
    const family = gridRef.current ? getComputedStyle(gridRef.current).fontFamily : 'sans-serif';
    let max = 0;
    for (let r = 0; r <= usedR; r++) {
      const id = cellId(r, c);
      if (!cells[id]) continue;
      const st = styles[id];
      ctx.font = `${st?.b ? 'bold ' : ''}${st?.i ? 'italic ' : ''}${st?.sz ? Math.round(st.sz * 13 / 11) : 13}px ${st?.font ? `"${st.font}", ` : ''}${family}`;
      max = Math.max(max, ctx.measureText(cellText(cells[id], results[id], st)).width);
    }
    return max ? Math.round(Math.max(MIN_COL_W, Math.min(MAX_COL_W, max + 16))) : COL_W;
  };
  // Fereastra Înălțime rând… / Lățime coloană… (Format ▾): lățimea în caractere și înălțimea în puncte, ca în fișierele .xlsx.
  const [sizeDlg, setSizeDlg] = useState<{ kind: 'col' | 'row'; value: string } | null>(null);
  // Fișier → Opțiuni: încotro merge cursorul după Enter (setare a aplicației, aceeași în toate tabelele).
  const [optDlg, setOptDlg] = useState(false);
  const [enterDir, setEnterDir] = useState<EnterDir>('down');
  useEffect(() => { void api.getSettings().then((st) => { if (st.sheetsEnter && ENTER_DIRS.some(([k]) => k === st.sheetsEnter)) setEnterDir(st.sheetsEnter); }).catch(() => {}); }, []);
  const pickEnterDir = (d: EnterDir) => { setEnterDir(d); void api.setSettings({ sheetsEnter: d }).catch(() => {}); };
  // Fișier → Opțiuni: completarea automată din coloană, AutoCorect în celule și salvarea automată (setări ale aplicației; lipsă = pornite).
  const [shOpts, setShOpts] = useState({ complete: true, correct: true, autosave: true });
  useEffect(() => { void api.getSettings().then((st) => setShOpts({ complete: st.sheetsOpts?.complete !== false, correct: st.sheetsOpts?.correct !== false, autosave: st.sheetsOpts?.autosave !== false })).catch(() => {}); }, []);
  const pickShOpts = (o: { complete: boolean; correct: boolean; autosave: boolean }) => { setShOpts(o); void api.setSettings({ sheetsOpts: o }).catch(() => {}); };
  const [acDlg, setAcDlg] = useState(false);
  const openSizeDlg = (kind: 'col' | 'row') => {
    finishEdit();
    const v = kind === 'col' ? (colW[colName(range.c0)] ?? COL_W) : (sheet.rowH?.[String(range.r0 + 1)] ?? MIN_ROW_H);
    setSizeDlg({ kind, value: (kind === 'col' ? Math.max(0, (v - 5) / 7) : v * 0.75).toFixed(2).replace(/.?0+$/, '').replace('.', ',') });
  };
  const applySizeDlg = () => {
    if (!sizeDlg) return;
    const n = Number(sizeDlg.value.trim().replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) { setStatus('Scrie un număr mai mare ca zero'); return; }
    if (sizeDlg.kind === 'col') {
      const px = Math.round(Math.max(MIN_COL_W, Math.min(MAX_COL_W, n * 7 + 5)));
      setColWidths(colsIn(range.c0, range.c1), () => px);
      setStatus(`Lățimea coloanelor ${colName(range.c0)}${range.c1 > range.c0 ? '–' + colName(range.c1) : ''}: ${sizeDlg.value} caractere`);
    } else {
      const px = Math.round(Math.max(MIN_ROW_H, Math.min(MAX_ROW_H, n / 0.75)));
      setRowHeights(range.r0, range.r1, px);
      setStatus(`Înălțimea rândurilor ${range.r0 + 1}${range.r1 > range.r0 ? '–' + (range.r1 + 1) : ''}: ${sizeDlg.value} puncte`);
    }
    setSizeDlg(null);
    focusGrid();
  };

  // Sortează după coloana celulei active. Cu o zonă selectată, sortează exact zona; altfel tot tabelul
  // de date din jur, iar primul rând rămâne pe loc dacă pare cap de tabel (de exemplu „Nume | Preț”).
  // Din lista filtrului (fromMenu) sau cu cursorul în tabelul filtrat, se sortează tot tabelul filtrat.
  /** Zona care se sortează (filtrul, selecția sau tabelul din jurul celulei) și dacă are cap de tabel. */
  const sortZone = (col: number, fromMenu: boolean) => {
    const fr = filter ? { r0: filter.r, r1: filterEnd(cells, filter), c0: filter.c0, c1: filter.c1 } : null;
    const inF = !!fr && (fromMenu || (!multi && sel.r >= fr.r0 && sel.r <= fr.r1 && col >= fr.c0 && col <= fr.c1));
    const g = inF ? fr : multi ? range : currentRegion(cells, sel.r, col);
    if (!g) return null;
    const head = inF || (!multi && (hasHeader(cells, styles, results, g) || (!!sheet.freeze && g.r0 === 0)));
    return { g, head };
  };

  const openSortDlg = () => {
    finishEdit();
    const z = sortZone(sel.c, false);
    if (!z) { setStatus('Nu e nimic de sortat aici: pune cursorul într-un tabel sau selectează zona'); focusGrid(); return; }
    setSortDlg({ ...z, col: Math.min(Math.max(sel.c, z.g.c0), z.g.c1) });
  };

  // Date → Subtotal: fereastra pe tabelul din jurul cursorului (primul rând e capul de tabel).
  const openSubDlg = () => {
    finishEdit();
    const z = sortZone(sel.c, false);
    if (!z || z.g.r1 <= z.g.r0) { setStatus('Pune cursorul într-un tabel cu cap de tabel (sortat după coloana de grupare) sau selectează-l'); focusGrid(); return; }
    setSubDlg({ g: z.g, col: Math.min(Math.max(sel.c, z.g.c0), z.g.c1) });
  };
  const runSubtotal = (g: Range, o: SubtotalOpts | null) => {
    setSubDlg(null);
    if (!o) {
      const out = removeSubtotals(doc.sheets, active, g);
      if (!out.removed) { setStatus('Nu sunt subtotaluri în tabel'); focusGrid(); return; }
      applySheets({ sheets: out.sheets, active });
      setStatus(`Am scos ${out.removed} ${out.removed === 1 ? 'rând' : 'rânduri'} de subtotal (Ctrl+Z anulează)`);
      focusGrid();
      return;
    }
    const textOf = (r: number, c: number) => { const id = cellId(r, c); return cellText(cells[id], results[id], styles[id]); };
    const groups = (() => { let n = 0, prev: string | null = null; for (let r = g.r0 + 1; r <= g.r1; r++) { const k = textOf(r, o.groupCol).trim().toLocaleLowerCase('ro-RO'); if (k !== prev) n++; prev = k; } return n; })();
    if (groups > MAX_GROUPS) { setStatus(`Prea multe grupuri (${groups}); cel mult ${MAX_GROUPS}. Sortează tabelul după coloana de grupare.`); focusGrid(); return; }
    if (sheet.cells && Object.keys(sheet.cells).some((id) => { const p = parseCellId(id); return !!p && p.r >= ROWS - groups - 1; })) {
      setStatus('Nu pot adăuga rândurile de total: ultimele rânduri ale tabelului au date'); focusGrid(); return;
    }
    const out = addSubtotals(doc.sheets, active, g, o, textOf);
    applySheets({ sheets: out.sheets, active });
    selectRange({ r: g.r0, c: g.c0 }, { r: out.last, c: g.c1 }, false);
    setStatus(`Subtotal: ${out.groups} ${out.groups === 1 ? 'grup' : 'grupuri'} după coloana ${colName(o.groupCol)}, plus Total general (Ctrl+Z anulează)`);
    focusGrid();
  };

  const sortBy = (g: Range, head: boolean, levels: SortKey[]) => {
    setSortDlg(null);
    const body = head ? { ...g, r0: g.r0 + 1 } : g;
    if (body.r1 <= body.r0) { setStatus('E nevoie de cel puțin două rânduri ca să sortezi'); focusGrid(); return; }
    const out = sortRangeBy(cells, styles, results, body, levels);
    recSort.current = { g, head, levels, picked: multi };
    applySheet({ ...sheet, cells: out.cells, styles: out.styles });
    selectRange({ r: body.r0, c: body.c0 }, { r: body.r1, c: body.c1 }, false);
    setStatus(`Sortat ${cellId(body.r0, body.c0)}:${cellId(body.r1, body.c1)} după ${levels.map((k) => colName(k.col) + (k.on ? (k.on === 'bg' ? ' (fundal ' : ' (text ') + (k.color === 'none' ? 'fără culoare' : k.color) + (k.desc ? ' jos)' : ' sus)') : k.desc ? ' ↓' : ' ↑')).join(', apoi ')}`);
    focusGrid();
  };

  // Căutare rezultat (Goal Seek): verifică celulele scrise în fereastră; întoarce mesajul de eroare sau null.
  const goalRef = (s: string) => {
    const p = parseCellId(s.trim().replace(/\$/g, '').toUpperCase());
    return p && p.r < ROWS && p.c < COLS ? cellId(p.r, p.c) : null;
  };
  const checkGoal = (setText: string, changeText: string): string | null => {
    const set = goalRef(setText), change = goalRef(changeText);
    if (!set) return 'Scrie celula cu formula, de exemplu B5.';
    if (!(cells[set] ?? '').trim().startsWith('=')) return `Celula ${set} trebuie să aibă o formulă.`;
    if (!change) return 'Scrie celula care se schimbă, de exemplu A1.';
    if (change === set) return 'Celula schimbată trebuie să fie alta decât cea cu formula.';
    const raw = (cells[change] ?? '').trim();
    if (raw.startsWith('=')) return `Celula ${change} trebuie să conțină un număr, nu o formulă.`;
    if (raw && !isNumber(raw)) return `Celula ${change} trebuie să conțină un număr.`;
    return null;
  };
  // Valoarea găsită se scrie cu toate cifrele (ca în Excel), altfel formula ar da 1499,9999998 în loc de 1500.
  const fullNumber = (x: number) => (Math.abs(x) >= 1e-6 && Math.abs(x) < 1e15 ? String(Number(x.toPrecision(15))).replace('.', ',') : formatNumber(x));
  const runGoalSeek = (setText: string, target: number, changeText: string): GoalSeekResult & { set: string; change: string; raw: string } => {
    const set = goalRef(setText)!, change = goalRef(changeText)!;
    const raw = (cells[change] ?? '').trim();
    const book = { self: sheetName, sheets: doc.sheets, names: doc.names, pivots: doc.pivots, match: doc.match, iterate: doc.iter, ext: doc.links };
    const r = goalSeek((x) => {
      const res = evaluateAll({ ...cells, [change]: fullNumber(x) }, book, undefined, [set])[set];
      return res && res.num && res.value !== undefined && !res.err ? res.value : undefined;
    }, target, raw ? Number(raw.replace(',', '.')) : 0);
    return { ...r, set, change, raw: fullNumber(r.x) };
  };

  // 🧮 Rezolvitor: verifică modelul, apoi caută valorile celulelor schimbate (vezi solver.ts). Întoarce un mesaj de eroare
  // sau rezultatul, cu valorile de scris în foaie.
  const runSolver = (m: SolverModel): string | SolverRun => {
    const obj = goalRef(m.obj);
    if (!obj) return 'Scrie celula obiectiv, de exemplu D10.';
    if (!(cells[obj] ?? '').trim().startsWith('=')) return `Celula obiectiv ${obj} trebuie să aibă o formulă.`;
    const vars = parseCells(m.vars);
    if (typeof vars === 'string') return 'Celulele schimbate: ' + vars;
    for (const id of vars) {
      if (id === obj) return 'Celula obiectiv nu poate fi și celulă schimbată.';
      const raw = (cells[id] ?? '').trim();
      if (raw.startsWith('=')) return `Celula ${id} trebuie să conțină un număr, nu o formulă.`;
      if (raw && !isNumber(raw)) return `Celula ${id} trebuie să conțină un număr.`;
    }
    const plain = (t: string) => Number(t.trim().split(' ').join('').replace(',', '.'));
    const target = m.goal === 'value' ? plain(m.target) : 0;
    if (m.goal === 'value' && (!m.target.trim() || !Number.isFinite(target))) return 'Valoarea dorită pentru obiectiv trebuie să fie un număr.';
    const pairs: [string, string | number][] = [], ops: ('<=' | '>=' | '=')[] = [], ints: number[] = [], bins: number[] = [];
    for (const [k, c] of m.cons.entries()) {
      if (!c.l.trim() && !c.r.trim()) continue;
      const where = `Condiția ${k + 1}: `;
      const L = parseCells(c.l);
      if (typeof L === 'string') return where + L;
      if (c.op === 'int' || c.op === 'bin') {
        for (const id of L) { const i = vars.indexOf(id); if (i < 0) return `${where}${id} trebuie să fie una dintre celulele schimbate.`; (c.op === 'int' ? ints : bins).push(i); }
        continue;
      }
      const rt = c.r.trim(), rn = plain(rt);
      let R: (string | number)[];
      if (rt && Number.isFinite(rn)) R = L.map(() => rn);
      else {
        const rc = parseCells(rt);
        if (typeof rc === 'string') return `${where}în dreapta scrie un număr sau o celulă (de exemplu 100 sau E5).`;
        if (rc.length !== 1 && rc.length !== L.length) return `${where}zona din dreapta trebuie să aibă tot atâtea celule ca cea din stânga.`;
        R = L.map((_, i) => rc[rc.length === 1 ? 0 : i]);
      }
      L.forEach((id, i) => { pairs.push([id, R[i]]); ops.push(c.op as '<=' | '>=' | '='); });
    }
    const book = { self: sheetName, sheets: doc.sheets, names: doc.names, pivots: doc.pivots, match: doc.match, iterate: doc.iter, ext: doc.links };
    const ids = [obj, ...pairs.flatMap(([l, r]) => (typeof r === 'string' ? [l, r] : [l]))];
    const formulaIds = [...new Set(ids.filter((id) => (cells[id] ?? '').trim().startsWith('=')))];
    const varIdx = new Map(vars.map((id, i) => [id, i]));
    const measure = (x: number[]): number[] | undefined => {
      const patch: Cells = {};
      vars.forEach((id, i) => (patch[id] = fullNumber(x[i])));
      const R = formulaIds.length ? evaluateAll({ ...cells, ...patch }, book, undefined, formulaIds) : {};
      const val = (id: string): number | undefined => {
        const i = varIdx.get(id);
        if (i !== undefined) return x[i];
        const raw = (cells[id] ?? '').trim();
        if (raw.startsWith('=')) { const r = R[id]; return r && r.num && !r.err && r.value !== undefined ? r.value : undefined; }
        if (!raw) return 0;
        return isNumber(raw) ? Number(raw.replace(',', '.')) : undefined;
      };
      const out: number[] = [];
      for (const v of [val(obj), ...pairs.flatMap(([l, r]) => [val(l), typeof r === 'number' ? r : val(r)])]) { if (v === undefined || !Number.isFinite(v)) return undefined; out.push(v); }
      return out;
    };
    const x0 = vars.map((id) => { const raw = (cells[id] ?? '').trim(); return raw ? Number(raw.replace(',', '.')) : 0; });
    const prob = { n: vars.length, x0, measure, ops, ints, bins, nonneg: m.nonneg, goal: m.goal, target, method: m.method };
    const r = solve(prob);
    const patch: Cells = {};
    if (r.status === 'optim' || r.status === 'aproape') vars.forEach((id, i) => (patch[id] = fullNumber(r.x[i])));
    // Raportul de răspuns: obiectivul și celulele înainte / după, apoi fiecare condiție cu valoarea, starea și diferența.
    const F0 = measure(x0), F1 = measure(r.x);
    const report: (string | number)[][] = [];
    if (F0 && F1) {
      const rhsText = (v: string | number) => (typeof v === 'number' ? formatNumber(v) : v);
      const opText = { '<=': '≤', '>=': '≥', '=': '=' } as const;
      report.push(['Raportul Rezolvitorului', '', '', '', '', ''], [solverMessage(r, m.goal), '', '', '', '', ''], ['', '', '', '', '', '']);
      report.push(['Obiectivul', 'Celula', 'Valoarea inițială', 'Valoarea finală', '', '']);
      report.push([m.goal === 'max' ? 'cât mai mare' : m.goal === 'min' ? 'cât mai mic' : 'egal cu ' + formatNumber(target), obj, F0[0], F1[0], '', '']);
      report.push(['', '', '', '', '', ''], ['Celulele schimbate', 'Celula', 'Valoarea inițială', 'Valoarea finală', 'Întreg', '']);
      vars.forEach((id, i) => report.push(['', id, x0[i], r.x[i], bins.includes(i) ? '0 sau 1' : ints.includes(i) ? 'întreg' : 'continuu', '']));
      report.push(['', '', '', '', '', ''], ['Condițiile', 'Celula', 'Valoarea', 'Condiția', 'Starea', 'Diferența']);
      pairs.forEach(([l, rv], k) => {
        const lv = F1[1 + 2 * k], rvv = F1[2 + 2 * k], gap = Math.abs(lv - rvv);
        report.push(['', l, lv, `${l} ${opText[ops[k]]} ${rhsText(rv)}`, gap <= 1e-9 * Math.max(1, Math.abs(rvv)) ? 'Atinsă (limitează)' : 'Neatinsă', gap]);
      });
      // Limitele (ca Limits Report): cât poate scădea / crește fiecare celulă când celelalte rămân la valoarea finală.
      const lim = r.status === 'optim' ? solverLimits(prob, r.x) : null;
      if (lim) {
        report.push(['', '', '', '', '', ''], ['Cât poate scădea / crește fiecare celulă schimbată, cu celelalte la valoarea finală și toate condițiile respectate:', '', '', '', '', ''], ['Limitele', 'Celula', 'Limita de jos', 'Obiectivul atunci', 'Limita de sus', 'Obiectivul atunci']);
        const nb = (v: number | null) => (v === null ? 'fără limită' : v);
        vars.forEach((id, i) => report.push(['', id, nb(lim[i].lo), lim[i].loObj ?? '', nb(lim[i].hi), lim[i].hiObj ?? '']));
      }
      // Sensibilitatea (ca Sensitivity Report): costurile reduse, prețurile umbră și intervalele permise (cât pot crește / scădea
      // coeficienții obiectivului fără să se schimbe soluția și părțile drepte fără să se schimbe prețul umbră).
      const sens = r.status === 'optim' ? solverSensitivity(prob, r.x, r.obj) : null;
      const rng = sens ? solverRanges(prob) : null;
      const nl = (v: number | null | undefined) => (v === undefined ? '' : v === null ? 'fără limită' : v);
      if (sens) {
        report.push(['', '', '', '', '', ''], ['Cât se schimbă obiectivul dacă o celulă aflată la 0 crește cu 1 (costul redus) sau dacă partea dreaptă a unei condiții crește cu 1 (prețul umbră):', '', '', '', '', '']);
        if (rng) report.push(['Creștere / scădere permisă: cât se poate schimba coeficientul celulei în obiectiv fără să se schimbe soluția, respectiv partea dreaptă a condiției fără să se schimbe prețul umbră.', '', '', '', '', '']);
        report.push(['Sensibilitatea', 'Celula', 'Valoarea finală', 'Costul redus', ...(rng ? ['Coeficientul în obiectiv', 'Creștere permisă', 'Scădere permisă'] : ['', ''])]);
        // Coeficientul fiecărei celule în obiectiv: cât crește obiectivul dacă celula crește cu 1 (modelul e liniar).
        const coefOf = (i: number) => { const a = measure(r.x), b = measure(r.x.map((v, j) => (j === i ? v + 1 : v))); return a && b ? Number((b[0] - a[0]).toPrecision(10)) : ''; };
        vars.forEach((id, i) => report.push(['', id, r.x[i], sens.reduced[i] ?? '', ...(rng ? [coefOf(i), nl(rng.cInc[i]), nl(rng.cDec[i])] : ['', ''])]));
        if (pairs.length) {
          report.push(['Condițiile', 'Celula', 'Valoarea', 'Condiția', 'Prețul umbră', ...(rng ? ['Creștere permisă', 'Scădere permisă'] : [''])]);
          pairs.forEach(([l, rv], k) => report.push(['', l, F1[1 + 2 * k], `${l} ${opText[ops[k]]} ${rhsText(rv)}`, sens.shadow[k] ?? '', ...(rng ? [nl(rng.rInc[k]), nl(rng.rDec[k])] : [''])]));
        }
      }
    }
    return { ok: Object.keys(patch).length > 0, msg: solverMessage(r, m.goal), patch, obj, objText: Number.isFinite(r.obj) ? formatNumber(r.obj) : '', report };
  };

  // Tabel de date (What-If): aceeași formulă pentru mai multe valori ale uneia sau a două celule de intrare.
  const openDataTable = () => {
    finishEdit();
    if (!multi || range.r1 === range.r0 || range.c1 === range.c0) { setStatus('Tabel de date: selectează întâi tabelul, cu valorile pe margine și formula sus sau în stânga (cel puțin 2 × 2 celule)'); focusGrid(); return; }
    setDtDlg({ r0: range.r0, c0: range.c0, r1: Math.min(range.r1, usedR + 1), c1: range.c1 });
  };
  const runDataTable = (rowText: string, colText: string): string | null => {
    if (!dtDlg) return null;
    const z = dtDlg;
    const rowIn = rowText.trim() ? goalRef(rowText) : null, colIn = colText.trim() ? goalRef(colText) : null;
    if (rowText.trim() && !rowIn) return 'Celula de intrare din rând nu e bună (de exemplu B1).';
    if (colText.trim() && !colIn) return 'Celula de intrare din coloană nu e bună (de exemplu B2).';
    for (const id of [rowIn, colIn]) {
      if (!id) continue;
      const p = parseCellId(id)!;
      if (p.r >= z.r0 && p.r <= z.r1 && p.c >= z.c0 && p.c <= z.c1) return `Celula de intrare ${id} trebuie să fie în afara tabelului.`;
      if ((cells[id] ?? '').trim().startsWith('=')) return `Celula de intrare ${id} trebuie să aibă o valoare, nu o formulă.`;
    }
    if (rowIn && rowIn === colIn) return 'Cele două celule de intrare trebuie să fie diferite.';
    const jobs = planDataTable(z, rowIn, colIn);
    if (typeof jobs === 'string') return jobs;
    const { patch, stylePatch, formulas } = dtCompute(jobs);
    if (!formulas) return rowIn && colIn
      ? 'Cu două celule de intrare, formula trebuie să fie în colțul din stânga sus al tabelului.'
      : colIn ? 'Pune formula (sau formulele) în primul rând al tabelului, la dreapta primei celule.' : 'Pune formula (sau formulele) în prima coloană a tabelului, sub prima celulă.';
    // Tabelul rămâne ținut minte în foaie (în locul altuia pe aceeași zonă): rezultatele se refac singure după fiecare schimbare.
    const zone = `${cellId(z.r0, z.c0)}:${cellId(z.r1, z.c1)}`;
    const keep = (sheet.dataTables ?? []).filter((t) => { const g = parseRangeText(t.zone); return g && !overlaps(g, z); });
    const dataTables = [...keep, { zone, ...(rowIn ? { row: rowIn } : {}), ...(colIn ? { col: colIn } : {}) }].slice(-MAX_DATA_TABLES);
    applySheet({ ...sheet, cells: { ...cells, ...patch }, styles: { ...styles, ...stylePatch }, dataTables });
    setDtDlg(null);
    setStatus(`Tabel de date: ${Object.keys(patch).length} rezultate în ${cellId(z.r0 + 1, z.c0 + 1)}:${cellId(z.r1, z.c1)} (se recalculează singure când schimbi formula sau datele; Ctrl+Z anulează)`);
    focusGrid();
    return null;
  };
  /** Rezultatele unui tabel de date: formula calculată cu valorile de pe margine puse în celulele de intrare. */
  const dtCompute = (jobs: DTJob[]) => {
    const book = { self: sheetName, sheets: doc.sheets, names: doc.names, pivots: doc.pivots, match: doc.match, iterate: doc.iter, ext: doc.links };
    const valueOf = (r: number, c: number) => {
      const id = cellId(r, c), raw = cells[id] ?? '';
      if (!raw.trim().startsWith('=')) return raw;
      const res = results[id];
      return res?.num && res.value !== undefined ? fullNumber(res.value) : res?.text ?? '';
    };
    const patch: Cells = {};
    const stylePatch: Styles = {};
    let formulas = 0;
    for (const j of jobs) {
      const fid = cellId(j.formula.r, j.formula.c);
      if (!(cells[fid] ?? '').trim().startsWith('=')) continue;
      formulas++;
      const over: Cells = { ...cells };
      for (const k of j.inputs) over[k.cell] = valueOf(k.value.r, k.value.c);
      const res = evaluateAll(over, book, undefined, [fid])[fid];
      // Rezultatul ia formatul formulei (lei, %, zecimale), dacă celula lui nu are unul.
      if (styles[fid] && !styles[cellId(j.r, j.c)]) stylePatch[cellId(j.r, j.c)] = styles[fid];
      patch[cellId(j.r, j.c)] = !res ? '' : res.err ? res.err : res.num && res.value !== undefined ? fullNumber(res.value) : res.text;
    }
    return { patch, stylePatch, formulas };
  };
  // Tabelele de date ținute minte se refac după fiecare recalculare (se scriu doar rezultatele schimbate, fără pas de anulare).
  // Un tabel ale cărui rezultate le golești tu (Delete pe zona lui) nu mai e ținut minte; dtFull: zonele care aveau rezultate
  // data trecută (golirea făcută de recalculare, de exemplu cu formula pe o celulă goală, nu-l scoate). dtWrote: dacă tot nu se
  // potrivește după ce le-am scris (formula depinde chiar de rezultate), ne oprim, ca să nu calculăm la nesfârșit.
  const dtWrote = useRef<Cells | null>(null);
  const dtFull = useRef(new Map<string, boolean>());
  useEffect(() => {
    const dts = sheet.dataTables;
    if (!dts?.length) return;
    const diff: Cells = {};
    let gone = false;
    const left = dts.filter((t) => {
      const g = parseRangeText(t.zone);
      let any = false;
      if (g) for (let r = g.r0 + 1; r <= g.r1 && !any; r++) for (let c = g.c0 + 1; c <= g.c1 && !any; c++) any = !!cells[cellId(r, c)];
      if (!g) { gone = true; return false; }
      const jobs = planDataTable(g, t.row ?? null, t.col ?? null);
      const patch = typeof jobs === 'string' ? {} : dtCompute(jobs).patch;
      // Golit de tine: zona avea rezultate, acum e goală, deși formula dă ceva.
      if (!any && dtFull.current.get(t.zone) !== false && dtWrote.current !== cells && Object.values(patch).some(Boolean)) { gone = true; return false; }
      for (const [id, v] of Object.entries(patch)) if ((cells[id] ?? '') !== v) diff[id] = v;
      dtFull.current.set(t.zone, Object.keys(patch).length ? Object.values(patch).some(Boolean) : any);
      return true;
    });
    const changed = Object.keys(diff).length > 0 && dtWrote.current !== cells;
    if (!gone && !changed) return;
    const next: Sheet = { ...sheet, cells: changed ? { ...cells, ...diff } : cells };
    if (left.length) next.dataTables = left; else delete next.dataTables;
    dtWrote.current = changed ? next.cells : null;
    setSheet(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, sheet.dataTables]);

  // Manager de scenarii: seturi de valori cu nume pentru aceleași celule, păstrate în foaie.
  const saveScenarios = (list: SheetScenario[]) => {
    const { scenarios: _s, ...rest } = sheet;
    applySheet(list.length ? { ...rest, scenarios: list } : rest);
  };
  const showScenario = (s: SheetScenario) => {
    applyCells(s.cells);
    setStatus(`Scenariul „${s.name}”: ${Object.keys(s.cells).length} celule schimbate (Ctrl+Z le readuce)`);
  };
  const scenarioReport = (resText: string): string | null => {
    const list = sheet.scenarios ?? [];
    const res = resText.trim() ? parseCellList(resText, ROWS, COLS) : [];
    if (typeof res === 'string') return res;
    if (doc.sheets.length >= MAX_SHEETS) return `Un tabel poate avea cel mult ${MAX_SHEETS} de foi`;
    const book = { self: sheetName, sheets: doc.sheets, names: doc.names, pivots: doc.pivots, match: doc.match, iterate: doc.iter, ext: doc.links };
    const shown = (r: Result | undefined) => (!r ? '' : r.err ? r.err : r.num && r.value !== undefined ? fullNumber(r.value) : r.text);
    const rows = scenarioSummary(list, (id) => cells[id] ?? '', res, (over, id) => shown(evaluateAll({ ...cells, ...over }, book, undefined, [id])[id]));
    let name = 'Rezumat scenarii';
    for (let k = 2; doc.sheets.some((s) => s.name.toLocaleLowerCase('ro') === name.toLocaleLowerCase('ro')); k++) name = `Rezumat scenarii (${k})`;
    const out = emptySheet(name);
    rows.forEach((row, r) => row.forEach((v, c) => { if (v !== '') out.cells[cellId(r, c)] = v; }));
    out.styles = Object.fromEntries(rows[0].map((_, c) => [cellId(0, c), { b: true }]));
    rows.forEach((row, r) => { if (row[0].endsWith(':')) out.styles[cellId(r, 0)] = { i: true }; });
    const next = [...doc.sheets];
    next.splice(active + 1, 0, out);
    setScDlg(false);
    applySheets({ sheets: next, active: active + 1 });
    setStatus(`Rezumat scenarii: foaia „${name}” (${list.length} scenarii)`);
    return null;
  };

  // Umplere → Serie: din prima celulă a fiecărei coloane (în jos) sau a fiecărui rând (la dreapta).
  const runSeries = (down: boolean, o: SeriesOpts) => {
    setSeriesDlg(false);
    const patch: Cells = {};
    const stylePatch: Styles = {};
    let lines = 0, skipped = 0, filled = 0;
    const outer = down ? [range.c0, range.c1] : [range.r0, range.r1];
    for (let k = outer[0]; k <= outer[1]; k++) {
      const r = down ? range.r0 : k, c = down ? k : range.c0;
      const id = cellId(r, c);
      const raw = cells[id] ?? '';
      const start = results[id]?.num && results[id].value !== undefined ? results[id].value! : isNumber(raw) ? Number(raw.trim().replace(',', '.')) : NaN;
      if (!Number.isFinite(start)) { skipped++; continue; }
      lines++;
      // Fără zonă selectată, valoarea de oprire hotărăște cât de departe merge seria (ca în Excel).
      const len = down ? (multi ? range.r1 - range.r0 + 1 : ROWS - r) : (multi ? range.c1 - range.c0 + 1 : COLS - c);
      const vals = seriesValues(start, Math.min(len, MAX_SERIES), o);
      vals.forEach((v, i) => {
        const to = down ? cellId(r + i + 1, c) : cellId(r, c + i + 1);
        patch[to] = formatNumber(v);
        if (styles[id]) stylePatch[to] = styles[id];
      });
      filled += vals.length;
    }
    if (!lines) { setStatus('Prima celulă trebuie să aibă un număr sau o dată de la care pornește seria'); focusGrid(); return; }
    if (!filled) { setStatus(o.stop === undefined && !multi ? 'Selectează celulele de umplut sau scrie o valoare de oprire' : 'Valoarea de oprire e deja depășită de prima celulă'); focusGrid(); return; }
    applyCells(patch, stylePatch);
    setStatus(`Serie: ${filled} ${filled === 1 ? 'celulă umplută' : 'celule umplute'}${skipped ? `; ${skipped} ${down ? 'coloane' : 'rânduri'} fără număr la început au rămas cum erau` : ''}`);
    focusGrid();
  };

  const sort = (desc: boolean, col = sel.c, fromMenu = false) => {
    finishEdit();
    setMenu(null);
    const z = sortZone(col, fromMenu);
    if (!z) { setStatus('Nu e nimic de sortat aici'); focusGrid(); return; }
    const { g, head } = z;
    const body = head ? { ...g, r0: g.r0 + 1 } : g;
    if (body.r1 <= body.r0) { setStatus('E nevoie de cel puțin două rânduri ca să sortezi'); focusGrid(); return; }
    const out = sortRange(cells, styles, results, body, col, desc);
    recSort.current = { g, head, levels: [{ col, desc }], picked: multi && !fromMenu };
    applySheet({ ...sheet, cells: out.cells, styles: out.styles });
    selectRange({ r: body.r0, c: col }, { r: body.r1, c: col }, false);
    setStatus(`Sortat ${cellId(body.r0, body.c0)}:${cellId(body.r1, body.c1)} după coloana ${colName(col)}`
      + `${desc ? ' (descrescător)' : ''}${head ? '; rândul de sus a rămas cap de tabel' : ''}`);
    focusGrid();
  };

  // AutoSum (Σ, Alt+=): pe o celulă propune formula (Enter o confirmă); pe o zonă pune totalurile direct.
  const numLook = (): Cellish => ({
    filled: (r, c) => r >= 0 && c >= 0 && r < ROWS && c < COLS && !!cells[cellId(r, c)],
    num: (r, c) => {
      if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return false;
      const id = cellId(r, c);
      const v = cells[id];
      if (!v) return false;
      return v.startsWith('=') ? !!results[id]?.num : isNumber(v) || !!results[id]?.num;
    },
  });
  const autoSum = (fn: AutoFn) => {
    finishEdit();
    const look = numLook();
    if (range.r0 === range.r1 && range.c0 === range.c1) {
      setExt(sel);
      startEdit(autoFormula(sel.r, sel.c, look, fn) ?? `=${fn}(`);
      return;
    }
    const patch = autoFill(range, look, fn);
    if (!Object.keys(patch).length) { setStatus('În zona selectată nu sunt numere de adunat'); return; }
    applyCells(patch);
    setStatus(`Am pus ${Object.keys(patch).length === 1 ? 'formula' : Object.keys(patch).length + ' formule'} în ${Object.keys(patch).join(', ')}`);
  };

  // Eliminare dubluri: pe zona selectată sau pe tabelul din jurul cursorului.
  // ⊕ Consolidare: mai multe zone (din foaia asta sau din altele) adunate într-un singur tabel, începând din celula aleasă.
  const [consDlg, setConsDlg] = useState(false);
  const zoneValues = (ref: string): ConsCell[][] | null => {
    const at = ref.lastIndexOf('!');
    const name = at < 0 ? sheetName : ref.slice(0, at).replace(/^'(.*)'$/, '$1').split("''").join("'");
    const g = parseRangeText(ref.slice(at + 1).trim().toUpperCase().split('$').join(''));
    const sh = name === sheetName ? null : doc.sheets.find((x) => x.name.toLocaleLowerCase('ro') === name.toLocaleLowerCase('ro'));
    if (!g || (name !== sheetName && !sh)) return null;
    const cs = sh ? sh.cells : cells;
    let rs: typeof results = results;
    if (sh) { try { rs = evaluateAll(sh.cells, { self: sh.name, sheets: doc.sheets, names: doc.names, pivots: doc.pivots, match: doc.match, iterate: doc.iter, ext: doc.links }); } catch { rs = {}; } }
    const out: ConsCell[][] = [];
    for (let r = g.r0; r <= g.r1; r++) {
      const row: ConsCell[] = [];
      for (let c = g.c0; c <= g.c1; c++) {
        const id = cellId(r, c), raw = cs[id] ?? '', res = rs[id];
        if (raw.startsWith('=')) row.push(res?.num && typeof res.value === 'number' ? res.value : res?.text || null);
        else if (/^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(raw.trim())) row.push(Number(raw));
        else row.push(raw.trim() ? raw.trim() : null);
      }
      out.push(row);
    }
    return out;
  };
  const doConsolidate = (refs: string[], fn: ConsFn, top: boolean, left: boolean) => {
    const tables: ConsCell[][][] = [];
    for (const ref of refs) {
      const v = zoneValues(ref);
      if (!v) { setStatus(`Zona „${ref}” nu e bună: scrie-o ca A1:C5 sau Foaie2!A1:C5`); return; }
      tables.push(v);
    }
    const res = consolidate(tables, fn, top, left);
    if (!res.length) { setStatus('Zonele alese sunt goale'); return; }
    const patch: Cells = {};
    res.forEach((row, i) => row.forEach((v, j) => {
      if (sel.r + i < ROWS && sel.c + j < COLS) patch[cellId(sel.r + i, sel.c + j)] = v === null ? '' : typeof v === 'number' ? String(Math.round(v * 1e10) / 1e10) : v;
    }));
    applyCells(patch);
    setConsDlg(false);
    setStatus(`Consolidare (${CONS_FNS.find(([k]) => k === fn)?.[1]}): ${refs.length} zone → ${res.length} × ${res[0].length} celule din ${selId} (Ctrl+Z anulează)`);
    focusGrid();
  };
  // Zona pentru statistici și analize: selecția (dacă sunt mai multe celule) sau tabelul în care e celula; numere sau text.
  const statZone = (what: string) => {
    finishEdit();
    if (doc.sheets.length >= MAX_SHEETS) { setStatus(`Un tabel poate avea cel mult ${MAX_SHEETS} de foi`); return null; }
    const g = multi ? range : currentRegion(cells, sel.r, sel.c);
    if (!g) { setStatus(`${what}: selectează întâi coloanele cu numere (cu capul de tabel, dacă are)`); focusGrid(); return null; }
    if (g.c1 - g.c0 >= 50) { setStatus(`${what}: alege cel mult 50 de coloane`); return null; }
    const grid: (number | string | null)[][] = [];
    for (let r = g.r0; r <= g.r1; r++) {
      const row: (number | string | null)[] = [];
      for (let c = g.c0; c <= g.c1; c++) {
        const id = cellId(r, c), raw = cells[id] ?? '', res = results[id];
        row.push(res?.num && typeof res.value === 'number' ? res.value : isNumber(raw) ? Number(raw.trim().replace(',', '.')) : raw.trim() ? res?.text || raw : null);
      }
      grid.push(row);
    }
    return { g, grid, where: `${colName(g.c0)}${g.r0 + 1}:${colName(g.c1)}${g.r1 + 1}` };
  };
  // Pune tabelul rezultat într-o foaie nouă, după cea curentă (numele: „Statistici”, „Corelație (2)”…); Ctrl+Z o scoate.
  const addResultSheet = (base: string, table: (string | number)[][], bold: [number, number][], colW: Record<string, number>, extra: Record<string, CellStyle> = {}, cur?: Sheet, more: Partial<Sheet> = {}) => {
    let name = base;
    for (let k = 2; doc.sheets.some((x) => x.name.toLocaleLowerCase('ro') === name.toLocaleLowerCase('ro')); k++) name = `${base} (${k})`;
    const out = emptySheet(name);
    table.forEach((row, r) => row.forEach((v, c) => { if (v !== '') out.cells[cellId(r, c)] = typeof v === 'number' ? String(Math.round(v * 1e12) / 1e12) : v; }));
    out.styles = Object.fromEntries(bold.map(([r, c]) => [cellId(r, c), { b: true }]));
    for (const [id, st] of Object.entries(extra)) out.styles[id] = { ...out.styles[id], ...st };
    out.colW = colW;
    Object.assign(out, more);
    const next = [...doc.sheets];
    if (cur) next[active] = cur;
    next.splice(active + 1, 0, out);
    applySheets({ sheets: next, active: active + 1 });
    return name;
  };
  // 📊 Statistici descriptive: pentru fiecare coloană de numere din zona aleasă (sau din tabelul în care e celula), o foaie nouă
  // cu media, mediana, abaterea standard, quartilele și restul (ca la Analiza datelor din alte programe).
  const descStats = () => {
    const z = statZone('📊 Statistici descriptive');
    if (!z) return;
    const { g, grid } = z;
    const { cols, skipped } = columnsOf(grid, (i) => colName(g.c0 + i));
    const used = cols.filter((c) => c.values.length);
    if (!used.length) { setStatus('📊 Statistici descriptive: zona aleasă nu are numere. Selectează coloanele cu numere (cu capul de tabel, dacă are).'); focusGrid(); return; }
    const table = describe(used);
    const name = addResultSheet('Statistici', table, table[0].map((_, c) => [0, c] as [number, number]), { A: 190 });
    setStatus(`📊 Statistici descriptive pentru ${used.length === 1 ? 'o coloană' : used.length + ' coloane'} (${z.where}) în foaia „${name}”`
      + (skipped ? `; ${skipped === 1 ? 'o celulă cu text a fost sărită' : skipped + ' celule cu text au fost sărite'}` : '')
      + (cols.length > used.length ? `; ${cols.length - used.length === 1 ? 'o coloană fără numere a fost lăsată deoparte' : (cols.length - used.length) + ' coloane fără numere au fost lăsate deoparte'}` : ''));
  };
  // 📈 Generare numere aleatoare: o foaie nouă cu câte o coloană pe variabilă. La „Discretă”, valorile și probabilitățile
  // vin din primele două coloane ale selecției (sau ale tabelului în care ești). Întoarce mesajul de eroare pentru fereastră.
  const runRandom = (o: RandOpts, seed?: number): string | null => {
    const label = '📈 Numere aleatoare';
    if (doc.sheets.length >= MAX_SHEETS) return `Un tabel poate avea cel mult ${MAX_SHEETS} de foi`;
    if (o.dist === 'discrete') {
      const z = statZone(label);
      if (!z) return 'Selectează întâi două coloane: valorile și probabilitățile lor';
      o = { ...o, table: rowsOf(z.grid.map((r) => r.slice(0, 2)), (i) => colName(z.g.c0 + i)).rows.map(([v, q]) => [v, q] as [number, number]) };
    }
    const res = randomNumbers(o, seededRandom(seed));
    if (typeof res === 'string') return res;
    const head = Array.from({ length: res[0]?.length ?? 0 }, (_, i) => `Variabila ${i + 1}`);
    const name = addResultSheet('Numere aleatoare', [head, ...res], head.map((_, c) => [0, c] as [number, number]), {});
    setRandDlg(false);
    setStatus(`${label}: ${res.length} ${res.length === 1 ? 'număr' : 'numere'} × ${head.length} ${head.length === 1 ? 'variabilă' : 'variabile'}, în foaia „${name}”`);
    focusGrid();
    return null;
  };
  // 📈 Analiza datelor: corelație, covarianță, regresie liniară (ultima coloană = rezultatul Y, celelalte = X) și histogramă
  // (pentru prima coloană cu numere, cu clase alese automat). Rezultatul: o foaie nouă.
  // Foaia de prognoză (după fereastra ei): istoricul, prognoza cu FORECAST.ETS și limitele intervalului de încredere ales
  // (formule, deci se schimbă dacă schimbi valorile), statisticile modelului (FORECAST.ETS.STAT) și un grafic cu linii.
  const makeForecast = (d: NonNullable<typeof fcDlg>) => {
    const label = '📉 Foaie de prognoză';
    const { names, rows, dropped, tStyle } = d;
    const k = Number(d.k.trim()), conf = Number(d.conf.trim().replace(',', '.')), sn = Number(d.seasonN.trim());
    const maxSeason = Math.min(8760, Math.floor(rows.length / 2));
    if (!Number.isInteger(k) || k < 1 || k > 1000) return 'Scrie un număr întreg de perioade, între 1 și 1000.';
    if (!(conf > 0 && conf < 100)) return 'Intervalul de încredere: un procent mai mare decât 0 și mai mic decât 100 (de exemplu 95).';
    if (d.season === 'manual' && !(Number.isInteger(sn) && sn >= 2 && sn <= maxSeason)) return `Sezonul: un număr întreg de perioade între 2 și ${maxSeason} (cel mult jumătate din valori).`;
    const ser = prepareSeries(rows.map(([t, v]) => [v, t] as [number, number]), d.fill, d.agg);
    if (typeof ser === 'string') return 'Datele din prima coloană trebuie să fie la pași egali (în fiecare zi, săptămână, lună…).';
    const season = d.season === 'auto' ? 1 : d.season === 'none' ? 0 : sn;
    const opt = `${season},${d.fill},${d.agg}`;
    const pct = String(conf).replace('.', ',');
    const sorted = [...rows].sort((a, b) => a[0] - b[0]), n = sorted.length, last = n + 1;
    const V = `$B$2:$B$${last}`, T = `$A$2:$A$${last}`;
    const table: (string | number)[][] = [[names[0], names[1], 'Prognoză', `Limita de jos (${pct}%)`, `Limita de sus (${pct}%)`]];
    // Ultima valoare cunoscută e și începutul prognozei, ca liniile să se lege pe grafic.
    sorted.forEach(([t, v], i) => table.push([t, v, i === n - 1 ? v : '', i === n - 1 ? v : '', i === n - 1 ? v : '']));
    for (let j = 1; j <= k; j++) {
      const r = last + j, ci = `FORECAST.ETS.CONFINT(A${r},${V},${T},${conf / 100},${opt})`;
      table.push([timeAfter(ser, sorted[n - 1][0], j), '', `=FORECAST.ETS(A${r},${V},${T},${opt})`, `=C${r}-${ci}`, `=C${r}+${ci}`]);
    }
    const extra: Record<string, CellStyle> = {};
    if (tStyle) for (let r = 1; r < table.length; r++) extra[cellId(r, 0)] = { ...tStyle };
    const chart = { id: 'prognoza-' + Date.now().toString(36), type: 'line' as const, range: `A1:E${table.length}`, title: `Prognoză: ${names[1]}` };
    if (d.stats) {
      // Statisticile modelului (FORECAST.ETS.STAT), în dreapta: parametrii și cât de mult greșește pe datele cunoscute.
      const stats = ['α (nivelul)', 'β (tendința)', 'γ (sezonul)', 'MASE (eroarea față de „ca data trecută”)', 'SMAPE (eroarea în procente)', 'MAE (eroarea medie)', 'RMSE (eroarea pătratică)', 'Pasul'];
      while (table.length < stats.length + 1) table.push(['', '', '', '', '']);
      table[0].push('', 'Statistica prognozei', 'Valoarea');
      stats.forEach((st, i) => table[i + 1].push('', st, `=FORECAST.ETS.STAT(${V},${T},${i + 1},${opt})`));
    }
    const name = addResultSheet('Prognoză', table, table[0].map((_, c) => [0, c] as [number, number]), { A: 110, B: 110, C: 110, D: 150, E: 150, F: 30, G: 280, H: 100 }, extra, undefined, { charts: [chart] });
    const droppedTxt = dropped ? `; ${dropped === 1 ? 'un rând cu celule goale sau text a fost sărit' : dropped + ' rânduri cu celule goale sau text au fost sărite'}` : '';
    setStatus(`${label}: ${k} ${k === 1 ? 'perioadă' : 'perioade'} după ultima valoare din „${names[1]}”, cu grafic, în foaia „${name}”${droppedTxt}`);
    return null;
  };
  const analyze = (kind: string) => {
    if (kind === 'rand') { finishEdit(); setRandDlg(true); return; }
    const label = ({ cor: '📈 Corelație', cov: '📈 Covarianță', reg: '📈 Regresie', hist: '📈 Histogramă', anova: '📈 ANOVA', anova2: '📈 ANOVA cu doi factori', anovarep: '📈 ANOVA cu replicare', rank: '📈 Rang și percentilă', ftest: '📈 Testul F', tpair: '📈 Testul t pe perechi', tequal: '📈 Testul t', tunequal: '📈 Testul t', ztest: '📈 Testul z', fcast: '📉 Foaie de prognoză', sper: '📈 Eșantion periodic', fft: '📈 Analiza Fourier', ifft: '📈 Fourier invers', srand: '📈 Eșantion aleator' } as Record<string, string>)[kind] ?? (/^mavg\d+$/.test(kind) ? '📈 Media mobilă' : /^exp\d$/.test(kind) ? '📈 Netezire exponențială' : undefined);
    if (!label) return;
    const z = statZone(label);
    if (!z) return;
    const { g, grid } = z;
    const letter = (i: number) => colName(g.c0 + i);
    const droppedMsg = (d: number) => (d ? `; ${d === 1 ? 'un rând cu celule goale sau text a fost sărit' : d + ' rânduri cu celule goale sau text au fost sărite'}` : '');
    if (kind === 'hist') {
      const used = columnsOf(grid, letter).cols.filter((c) => c.values.length);
      if (!used.length) { setStatus(`${label}: zona aleasă nu are numere`); focusGrid(); return; }
      const table = histogram(used[0].name, used[0].values);
      const name = addResultSheet('Histogramă', table, [[0, 0], [0, 1], [0, 2]], { A: 190, B: 90, C: 90 });
      setStatus(`${label} pentru „${used[0].name}” (${used[0].values.length} valori, ${table.length - 1} clase) în foaia „${name}”`
        + (used.length > 1 ? '; s-a folosit doar prima coloană cu numere' : ''));
      return;
    }
    if (kind.startsWith('mavg') || kind.startsWith('exp')) {
      // Serii în timp: prima coloană cu numere, în ordinea rândurilor; prognoza și eroarea standard alături.
      const used = columnsOf(grid, letter).cols.filter((c) => c.values.length);
      const mavg = kind.startsWith('mavg'), k = Number(kind.replace(/\D/g, ''));
      const table = used.length ? (mavg ? movingAverage(used[0].name, used[0].values, k) : expSmoothing(used[0].name, used[0].values, k / 10)) : null;
      if (!table) { setStatus(`${label}: alege o coloană cu cel puțin ${mavg ? k : 2} numere`); focusGrid(); return; }
      const name = addResultSheet(mavg ? 'Media mobilă' : 'Netezire', table, table[0].map((_, c) => [0, c] as [number, number]), { A: 120, B: 230, C: 130 });
      setStatus(`${label} pentru „${used[0].name}” (${used[0].values.length} valori, ${z.where}), în foaia „${name}”${used.length > 1 ? '; s-a folosit doar prima coloană cu numere' : ''}`);
      return;
    }
    if (kind === 'fcast') {
      // Foaia de prognoză: datele (sau numerele perioadelor) în prima coloană, valorile în a doua. Foaia nouă are istoricul,
      // prognoza cu FORECAST.ETS și limitele de 95% (formule, deci se schimbă dacă schimbi valorile) și un grafic cu linii.
      const { names, rows, dropped } = rowsOf(grid.map((r) => r.slice(0, 2)), letter);
      if (names.length < 2 || rows.length < 3) { setStatus(`${label}: alege două coloane, datele (sau numerele perioadelor) și valorile, cu cel puțin 3 rânduri`); focusGrid(); return; }
      const ser = prepareSeries(rows.map(([t, v]) => [v, t] as [number, number]));
      if (typeof ser === 'string') { setStatus(`${label}: datele din prima coloană trebuie să fie la pași egali (în fiecare zi, săptămână, lună…), fără să se repete`); focusGrid(); return; }
      const src = grid.findIndex((r) => typeof r[0] === 'number');
      const tStyle = src >= 0 ? styles[cellId(g.r0 + src, g.c0)] : undefined;
      finishEdit();
      setFcDlg({ names, rows, dropped, tStyle, k: String(Math.max(1, Math.round(rows.length / 3))), conf: '95', season: 'auto', seasonN: '12', fill: 1, agg: 1, stats: true });
      return;
    }
    if (kind === 'sper' || kind === 'srand') {
      // Eșantionul: prima coloană cu numere; numărul (pasul sau câte valori) se cere într-o fereastră.
      const used = columnsOf(grid, letter).cols.filter((c) => c.values.length);
      if (!used.length) { setStatus(`${label}: zona aleasă nu are numere`); focusGrid(); return; }
      const col0 = used[0], per = kind === 'sper';
      void askText(label.slice(3), per ? `Din câte în câte valori iei una? (${col0.values.length} valori în „${col0.name}”)` : `Câte valori alegi la întâmplare? (din ${col0.values.length} valori în „${col0.name}”)`, per ? '2' : String(Math.min(10, col0.values.length))).then((txt) => {
        if (txt == null) { focusGrid(); return; }
        const n = Number(txt.trim().replace(',', '.'));
        const table = Number.isInteger(n) && n >= 1 ? sample(col0.name, col0.values, per ? 'periodic' : 'random', n) : null;
        if (!table) { setStatus(`${label}: scrie un număr întreg între 1 și ${col0.values.length}`); focusGrid(); return; }
        const name = addResultSheet('Eșantion', table, [[0, 0], [0, 1]], { A: 160, B: 130 });
        setStatus(`${label} din „${col0.name}”: ${table.length - 1} valori, în foaia „${name}”${used.length > 1 ? '; s-a folosit doar prima coloană cu numere' : ''}`);
      });
      return;
    }
    if (kind === 'fft' || kind === 'ifft') {
      // Prima coloană a zonei: numere reale sau complexe („3+4i”); un cap de tabel cu text se folosește ca nume.
      const col = grid.map((r) => r[0]).filter((x): x is string | number => x !== null && String(x).trim() !== '');
      const head = col.length && typeof col[0] === 'string' && !complexOf(col[0]) ? String(col.shift()).trim() : `Coloana ${letter(0)}`;
      const table = fourier(head, col, kind === 'ifft');
      if (typeof table === 'string') { setStatus(`${label}: ${table}`); focusGrid(); return; }
      const name = addResultSheet('Fourier', table, [[0, 0]], { A: 220 });
      setStatus(`${label} pentru „${head}” (${col.length} valori, ${z.where}), în foaia „${name}”`);
      return;
    }
    if (kind === 'ztest') {
      const used = columnsOf(grid, letter).cols.filter((c) => c.values.length);
      const table = used.length >= 2 ? zTest(used[0], used[1]) : null;
      if (!table) { setStatus(`${label}: alege două coloane cu numere, cu măcar două valori fiecare (se compară primele două)`); focusGrid(); return; }
      const name = addResultSheet('Testul z', table, table[0].map((_, c) => [0, c] as [number, number]), { A: 250, B: 120, C: 120 });
      setStatus(`${label}: ${used[0].name} și ${used[1].name} (${z.where}), în foaia „${name}”`);
      return;
    }
    if (kind === 'rank') {
      const used = columnsOf(grid, letter).cols.filter((c) => c.values.length);
      const table = used.length ? rankPercentile(used[0].name, used[0].values) : null;
      if (!table) { setStatus(`${label}: alege o coloană cu cel puțin două numere`); focusGrid(); return; }
      // Procentul ca procent (0,75 → 75,00%).
      const pct = Object.fromEntries(table.slice(1).map((_, r) => [cellId(r + 1, 3), { fmt: 'percent', dec: 2 } as CellStyle]));
      const name = addResultSheet('Rang', table, table[0].map((_, c) => [0, c] as [number, number]), { A: 80, B: 120, C: 80, D: 90 }, pct);
      setStatus(`${label} pentru „${used[0].name}” (${used[0].values.length} valori, ${z.where}), în foaia „${name}”${used.length > 1 ? '; s-a folosit doar prima coloană cu numere' : ''}`);
      return;
    }
    if (kind === 'anova2') {
      // Rândurile = un factor (etichetele din prima coloană, dacă are text), coloanele = celălalt factor.
      const res = anovaTwo(grid, letter);
      if (!res) { setStatus(`${label}: alege un tabel cu cel puțin două rânduri și două coloane de numere (etichetele rândurilor în prima coloană)`); focusGrid(); return; }
      const bold: [number, number][] = [[0, 0]];
      res.table.forEach((row, r) => { if (row[0] === 'Rezumat' || row[0] === 'Sursa variației') row.forEach((_, c) => bold.push([r, c])); });
      const name = addResultSheet('ANOVA', res.table, bold, { A: 190, B: 120, C: 120, D: 120, E: 100, F: 100, G: 100 });
      setStatus(`${label} (${z.where}), în foaia „${name}”${droppedMsg(res.dropped)}`);
      return;
    }
    if (kind === 'anovarep') {
      // Blocuri de rânduri (eticheta pe primul rând al fiecărui bloc, în prima coloană) × coloane; fără etichete, se cere câte rânduri are o grupă.
      const show = (res: ReturnType<typeof anovaRep>) => {
        if ('error' in res) {
          setStatus(res.error === 'text' ? `${label}: toate celulele cu date trebuie să fie numere`
            : `${label}: alege un tabel cu capul coloanelor și cu cel puțin două grupe de rânduri la fel de lungi (de cel puțin 2 rânduri), cu eticheta fiecărei grupe în prima coloană, pe primul ei rând`);
          focusGrid(); return;
        }
        const bold: [number, number][] = [[0, 0]];
        res.table.forEach((row, r) => { if (row[0] === 'Rezumat' || row[0] === 'ANOVA' || row[0] === 'Sursa variației') row.forEach((_, c) => bold.push([r, c])); });
        const name = addResultSheet('ANOVA', res.table, bold, { A: 190, B: 120, C: 120, D: 120, E: 100, F: 100, G: 100 });
        setStatus(`${label} (${z.where}), în foaia „${name}”`);
      };
      const res = anovaRep(grid, letter);
      if (!('error' in res) || res.error !== 'labels') { show(res); return; }
      void askText(label.slice(3), 'Prima coloană nu are etichetele grupelor. Câte rânduri are fiecare grupă?', '2').then((txt) => {
        if (txt == null) { focusGrid(); return; }
        const n = Number(txt.trim());
        show(anovaRep(grid, letter, Number.isInteger(n) ? n : undefined));
      });
      return;
    }
    if (kind === 'tpair') {
      // Pe perechi: primele două coloane ale zonei, doar rândurile cu numere în amândouă.
      const { names, rows, dropped } = rowsOf(grid.map((r) => r.slice(0, 2)), letter);
      const table = names.length === 2 && rows.length >= 2
        ? tTest({ name: names[0], values: rows.map((r) => r[0]) }, { name: names[1], values: rows.map((r) => r[1]) }, 'paired') : null;
      if (!table) { setStatus(`${label}: alege două coloane cu numere, cu măcar două rânduri completate în amândouă`); focusGrid(); return; }
      const name = addResultSheet('Testul t', table, table[0].map((_, c) => [0, c] as [number, number]), { A: 230, B: 120, C: 120 });
      setStatus(`${label}: ${names[0]} și ${names[1]}, ${rows.length} perechi (${z.where}), în foaia „${name}”${droppedMsg(dropped)}`);
      return;
    }
    if (kind === 'tequal' || kind === 'tunequal') {
      const used = columnsOf(grid, letter).cols.filter((c) => c.values.length);
      const table = used.length >= 2 ? tTest(used[0], used[1], kind === 'tequal' ? 'equal' : 'unequal') : null;
      if (!table) { setStatus(`${label}: alege două coloane cu numere, cu măcar două valori fiecare (se compară primele două)`); focusGrid(); return; }
      const name = addResultSheet('Testul t', table, table[0].map((_, c) => [0, c] as [number, number]), { A: 230, B: 120, C: 120 });
      setStatus(`${label}: ${used[0].name} și ${used[1].name} (${z.where}), în foaia „${name}”`);
      return;
    }
    if (kind === 'anova' || kind === 'ftest') {
      // Grupele sunt coloanele (pot avea lungimi diferite); celulele goale și textul se sar.
      const used = columnsOf(grid, letter).cols.filter((c) => c.values.length);
      const table = kind === 'anova' ? anovaOne(used) : used.length >= 2 ? fTest(used[0], used[1]) : null;
      if (!table) { setStatus(`${label}: alege cel puțin două coloane cu numere, cu măcar două valori fiecare${kind === 'ftest' ? ' (se compară primele două)' : ''}`); focusGrid(); return; }
      const bold: [number, number][] = [[0, 0]];
      table.forEach((row, r) => { if (row[0] === 'Rezumat' || row[0] === 'Sursa variației') row.forEach((_, c) => bold.push([r, c])); });
      if (kind === 'ftest') table[0].forEach((_, c) => bold.push([0, c]));
      const name = addResultSheet(kind === 'anova' ? 'ANOVA' : 'Testul F', table, bold, { A: 190, B: 120, C: 120, D: 120, E: 100, F: 100, G: 100 });
      setStatus(`${label}: ${kind === 'anova' ? used.length + ' grupe' : used[0].name + ' și ' + used[1].name} (${z.where}), în foaia „${name}”`);
      return;
    }
    const { names, rows, dropped } = rowsOf(grid, letter);
    if (names.length < 2) { setStatus(`${label}: alege cel puțin două coloane cu numere${kind === 'reg' ? ' (ultima e rezultatul Y, celelalte sunt X)' : ''}`); focusGrid(); return; }
    if (rows.length < 3) { setStatus(`${label}: e nevoie de cel puțin 3 rânduri cu numere în toate coloanele`); focusGrid(); return; }
    if (kind === 'reg') {
      const reg = regress(rows);
      if (!reg) { setStatus(`${label}: nu se poate calcula (prea puține rânduri față de coloane, sau o coloană X se poate scrie din celelalte)`); focusGrid(); return; }
      const table = regressionTable(names, reg);
      const bold: [number, number][] = [[0, 0], [2, 0]];
      table.forEach((row, r) => { if (row[0] === 'ANOVA' || row[1] === 'Coeficient') row.forEach((_, c) => bold.push([r, c])); });
      const name = addResultSheet('Regresie', table, bold, { A: 170, B: 120, C: 120, D: 120, E: 110, F: 110, G: 110 });
      setStatus(`${label}: ${names[names.length - 1]} după ${names.slice(0, -1).join(', ')}: R² = ${(Math.round(reg.r2 * 10000) / 10000).toLocaleString('ro')}, ${rows.length} rânduri (${z.where}), în foaia „${name}”${droppedMsg(dropped)}`);
      return;
    }
    const table = kind === 'cor' ? correlation(names, rows) : covariance(names, rows);
    const bold: [number, number][] = [...table[0].map((_, c) => [0, c] as [number, number]), ...table.slice(1).map((_, r) => [r + 1, 0] as [number, number])];
    const name = addResultSheet(kind === 'cor' ? 'Corelație' : 'Covarianță', table, bold, { A: 150 });
    setStatus(`${label} între ${names.length} coloane, ${rows.length} rânduri (${z.where}), în foaia „${name}”${droppedMsg(dropped)}`);
  };
  const openDedupe = () => {
    finishEdit();
    const g = multi ? { ...range, r1: Math.min(range.r1, usedR) } : currentRegion(cells, sel.r, sel.c);
    if (!g || g.r1 <= g.r0) { setStatus('Selectează tabelul (cel puțin două rânduri) din care vrei să elimini rândurile care se repetă'); focusGrid(); return; }
    const head = hasHeader(cells, styles, results, g) || (!!sheet.freeze && g.r0 === 0);
    setDedupe({ g, head });
  };
  const doDedupe = (cols: number[], head: boolean) => {
    if (!dedupe) return;
    const g = head ? { ...dedupe.g, r0: dedupe.g.r0 + 1 } : dedupe.g;
    setDedupe(null);
    const out = removeDuplicates(cells, styles, results, g, cols);
    if (out.removed) applySheet({ ...sheet, cells: out.cells, styles: out.styles });
    selectRange({ r: g.r0, c: g.c0 }, { r: Math.max(g.r0, g.r0 + out.kept - 1), c: g.c1 }, false);
    setStatus(out.removed ? `Am eliminat ${out.removed === 1 ? 'un rând care se repeta' : out.removed + ' rânduri care se repetau'}; au rămas ${out.kept} unice (Ctrl+Z anulează)` : `Nu am găsit rânduri care se repetă (${out.kept} rânduri, toate unice)`);
    focusGrid();
  };

  // Pensula de formatare (ca în Excel): un click ia formatarea zonei selectate, apoi selectezi unde o pui.
  // Dublu-click o lasă pornită pentru mai multe zone; Esc sau încă un click o oprește.
  const togglePainter = (keep = false) => {
    finishEdit();
    if (painter && !keep) { setPainter(null); setStatus(''); focusGrid(); return; }
    const g = upTo(range, Math.min(range.r0 + 999, Math.max(usedR, range.r0)));
    const grid: (CellStyle | undefined)[][] = [];
    for (let r = g.r0; r <= g.r1; r++) {
      const row: (CellStyle | undefined)[] = [];
      for (let c = g.c0; c <= Math.min(g.c1, g.c0 + 199); c++) row.push(styles[cellId(r, c)]);
      grid.push(row);
    }
    setPainter({ grid, keep });
    setStatus(keep ? 'Pensula rămâne pornită: selectează pe rând zonele care primesc formatarea (Esc o oprește)' : 'Selectează celulele care primesc formatarea (Esc renunță)');
    focusGrid();
  };
  const applyPaint = () => {
    if (!painter) return;
    const { grid, keep } = painter;
    const g = upTo(range, Math.max(WORK_ROWS - 1, usedR));
    const patch: Styles = {};
    for (let r = g.r0; r <= g.r1; r++) {
      for (let c = g.c0; c <= g.c1; c++) {
        const id = cellId(r, c);
        const src = grid[(r - g.r0) % grid.length][(c - g.c0) % grid[0].length];
        // Nota celulei nu e formatare: rămâne cea a celulei țintă.
        const { note: _n, cmt: _c, cdone: _d, ...look } = src ?? {};
        const { note, cmt, cdone } = styles[id] ?? {};
        patch[id] = { ...look, ...(note ? { note } : {}), ...(cmt ? { cmt, ...(cdone ? { cdone } : {}) } : {}) };
      }
    }
    applyCells({}, patch);
    if (!keep) { setPainter(null); setStatus(`Formatarea a fost copiată pe ${cellId(g.r0, g.c0)}${g.r1 > g.r0 || g.c1 > g.c0 ? ':' + cellId(g.r1, g.c1) : ''}`); }
  };

  // Umplere rapidă (Ctrl+E): în coloana cursorului, din exemplele scrise lângă date, completează celulele goale cu aceeași regulă.
  const doFlashFill = () => {
    finishEdit();
    const c = sel.c;
    if (c === 0) { setStatus('Umplerea rapidă are nevoie de date în coloanele din stânga'); focusGrid(); return; }
    const txt = (r: number, cc: number) => { const id = cellId(r, cc); return cellText(cells[id], results[id], styles[id]).trim(); };
    // Rândurile: blocul cu date în coloana din stânga, din jurul cursorului.
    const has = (r: number) => r >= 0 && r < ROWS && txt(r, c - 1) !== '';
    let r0 = sel.r, r1 = sel.r;
    if (!has(r0) && !txt(r0, c)) { setStatus('Pune cursorul lângă date, în coloana de completat'); focusGrid(); return; }
    while (has(r0 - 1)) r0--;
    while (has(r1 + 1)) r1++;
    // Coloanele sursă: cele lipite în stânga, cu date pe primul rând al blocului.
    let c0 = c - 1;
    while (c0 > 0 && txt(r0, c0 - 1) !== '') c0--;
    const rows: FlashRow[] = [];
    for (let r = r0; r <= r1; r++) {
      const src: string[] = [];
      for (let cc = c0; cc < c; cc++) src.push(txt(r, cc));
      const own = cells[cellId(r, c)] ?? '';
      rows.push({ src, out: own.trim() && !own.startsWith('=') ? txt(r, c) : null });
    }
    if (!rows.some((x) => x.out)) { setStatus('Scrie întâi în coloană un exemplu de rezultat (de exemplu prenumele din „Ion Popescu”), apoi Ctrl+E'); focusGrid(); return; }
    const res = flashFill(rows);
    if (!res) { setStatus('N-am găsit o regulă care să se potrivească cu toate exemplele: mai scrie un exemplu sau verifică-le'); focusGrid(); return; }
    const patch: Cells = {};
    let n = 0;
    res.forEach((v, i) => { if (rows[i].out === null && v && !cells[cellId(r0 + i, c)]) { patch[cellId(r0 + i, c)] = v; n++; } });
    if (!n) { setStatus('Nu mai sunt celule goale de completat în această coloană'); focusGrid(); return; }
    applyCells(patch);
    selectRange({ r: r0, c }, { r: r1, c }, false);
    setStatus(`Umplere rapidă: ${n} ${n === 1 ? 'celulă completată' : 'celule completate'} după exemple (Ctrl+Z anulează)`);
    focusGrid();
  };

  // Text în coloane: pe coloana selectată (sau pe blocul de celule completate din jurul cursorului).
  const openSplit = () => {
    finishEdit();
    if (range.c1 > range.c0) { setStatus('Text în coloane merge pe o singură coloană: selectează celulele dintr-o coloană'); focusGrid(); return; }
    const c = range.c0;
    const has = (r: number) => r >= 0 && r < ROWS && !!cells[cellId(r, c)];
    let r0 = range.r0, r1 = Math.min(range.r1, usedR);
    if (range.r0 === range.r1) { while (has(r0 - 1)) r0--; while (has(r1 + 1)) r1++; }
    let any = false;
    for (let r = r0; r <= r1 && !any; r++) any = has(r) && !cells[cellId(r, c)].startsWith('=');
    if (!any) { setStatus('În coloana selectată nu e text de împărțit'); focusGrid(); return; }
    setSplitDlg({ c, r0, r1 });
  };
  const doSplit = async (delim: string, merge: boolean) => {
    if (!splitDlg) return;
    const { c, r0, r1 } = splitDlg;
    const patch: Cells = {};
    const stylePatch: Styles = {};
    let width = 1;
    let busy = 0;
    for (let r = r0; r <= r1; r++) {
      const v = cells[cellId(r, c)];
      if (!v || v.startsWith('=')) continue;
      const parts = splitText(v, delim, merge);
      width = Math.max(width, parts.length);
      parts.forEach((p, j) => {
        if (c + j >= COLS) return;
        const id = cellId(r, c + j);
        if (j > 0 && cells[id]) busy++;
        const e = parseEntry(p);
        patch[id] = e.raw;
        if (e.fmt && (!styles[id]?.fmt || styles[id]?.fmt === 'general')) stylePatch[id] = { ...styles[id], fmt: e.fmt };
      });
    }
    if (busy && !(await askYes(`În coloanele din dreapta sunt deja ${busy} celule cu date, care vor fi înlocuite. Continui? (Ctrl+Z le aduce înapoi)`, 'Înlocuiește'))) return;
    setSplitDlg(null);
    applyCells(patch, stylePatch);
    selectRange({ r: r0, c }, { r: r1, c: Math.min(COLS - 1, c + width - 1) }, false);
    setStatus(`Textul a fost împărțit în ${width} ${width === 1 ? 'coloană' : 'coloane'} (Ctrl+Z anulează)`);
    focusGrid();
  };

  // fx: funcția aleasă se scrie în celulă (sau se adaugă la formula pe care o scrii) și rămâi în editare, să completezi argumentele.
  const insertFn = (name: string, help?: FnHelp) => {
    setFxDlg(false);
    setRecentFns((r) => { const n = [name, ...r.filter((x) => x !== name)].slice(0, 10); try { localStorage.setItem('suite.sheets.recentFns', JSON.stringify(n)); } catch { /* fără stocare */ } return n; });
    const cur = fxBase.current ?? editRef.current;
    fxBase.current = null;
    const text = cur !== null && cur.startsWith('=') ? `${cur}${/[(;,+\-*/&=<>^]$/.test(cur) ? '' : '+'}${name}(` : `=${name}(`;
    if (cur === null) setExt(sel);
    startEdit(text, editInBar);
    setStatus(`${name}(${help?.args ?? '…'})${help ? ' · ' + help.desc : ''} · Separă argumentele cu „;”, apoi Enter.`);
  };

  // Formule › Utilizare în formulă: numele se adaugă la formula pe care o scrii (sau începe una nouă).
  const putName = (name: string) => {
    const cur = editRef.current;
    const text = cur !== null && cur.startsWith('=') ? cur + (/[(;,+\-*/&=<>^]$/.test(cur) ? '' : '+') + name : '=' + name;
    if (cur === null) setExt(sel);
    startEdit(text, editInBar);
    setStatus('Numele „' + name + '” e în formulă; Enter o termină.');
  };

  // Protecția foii: întâi alegi celulele care rămân libere (de completat), apoi protejezi foaia.
  // Parola e opțională: se păstrează doar hash-ul ei (sheetPassword.ts); fără parolă, protecția se oprește cu un clic.
  // Parola nouă (opțională; gol = fără parolă): SheetPw, null = fără parolă, false = Renunță.
  const newProtectPw = async (title: string): Promise<SheetPw | null | false> => {
    let note = '';
    for (;;) {
      const a = await askPassword(title, `${note}Parola e opțională: cu ea, protecția se poate opri doar de cine o știe. Lasă câmpul gol pentru protecție fără parolă. Literele mari și mici contează.`, 'Protejează');
      if (a === null) return false;
      if (!a) return null;
      const b2 = await askPassword('Scrie parola încă o dată', 'Ca să fim siguri că n-ai greșit o literă.', 'Protejează');
      if (b2 === null) return false;
      if (a === b2) { setStatus('Se pune parola…'); return makeSheetPw(a); }
      note = 'Parolele nu erau la fel. Încearcă din nou. ';
    }
  };
  // Cere parola protecției până e bună: true = se poate opri, false = Renunță.
  const oldProtectPw = async (title: string, what: string, p: SheetPw): Promise<boolean> => {
    let wrong = false;
    for (;;) {
      const a = await askPassword(wrong ? 'Parola nu e bună' : title, wrong ? 'Parola scrisă nu se potrivește. Încearcă din nou (literele mari și mici contează).' : `${what} e protejat(ă) cu parolă. Scrie parola ca să oprești protecția.`, 'Oprește protecția');
      if (a === null) return false;
      setStatus('Se verifică parola…');
      if (await checkSheetPw(a, p)) return true;
      wrong = true;
    }
  };
  const protection = async (what: string) => {
    finishEdit();
    if (what === 'book-on' || what === 'book-off') {
      let pw: SheetPw | null = null;
      if (what === 'book-on') { const r = await newProtectPw('Protejează structura registrului'); if (r === false) { focusGrid(); return; } pw = r; }
      else if (doc.lockBook?.pw && !(await oldProtectPw('Oprește protecția registrului', 'Structura registrului', doc.lockBook.pw))) { setStatus('Structura registrului rămâne protejată'); focusGrid(); return; }
      remember();
      setDoc((d) => { const n = { ...d }; if (what === 'book-on') n.lockBook = pw ? { pw } : {}; else delete n.lockBook; return n; });
      markDirty();
      setStatus(what === 'book-on' ? `Structura registrului e protejată${pw ? ' cu parolă' : ''}: foile nu se mai pot adăuga, șterge, redenumi, muta sau ascunde` : 'Protecția registrului a fost oprită');
      focusGrid();
      return;
    }
    if (what === 'on' || what === 'off') {
      const i = active;
      let pw: SheetPw | undefined;
      if (what === 'on') {
        const r = await newProtectPw('Protejează foaia');
        if (r === false) { focusGrid(); return; }
        if (r) pw = r;
      } else if (sheet.protectPw && !(await oldProtectPw('Oprește protecția foii', 'Foaia', sheet.protectPw))) { setStatus('Foaia rămâne protejată'); focusGrid(); return; }
      remember();
      setDoc((d) => ({ ...d, sheets: d.sheets.map((s, j) => {
        if (j !== i) return s;
        const n: Sheet = { ...s };
        delete n.protectPw;
        if (what === 'on') { n.protect = true; if (pw) n.protectPw = pw; } else delete n.protect;
        return n;
      }) }));
      markDirty();
      const free = Object.values(styles).filter((s) => s.unlock).length;
      setStatus(what === 'on' ? `Foaia e protejată${pw ? ' cu parolă' : ''}: se pot modifica doar ${free ? free + ' celule libere' : 'celulele deblocate (acum niciuna)'}` : 'Protecția foii a fost oprită');
    } else if (sheet.protect) { setStatus('Oprește întâi protecția foii, apoi schimbă celulele libere'); }
    else { styleRange((s) => { const n = { ...s }; if (what === 'unlock') n.unlock = true; else delete n.unlock; return n; }); setStatus(what === 'unlock' ? 'Celulele selectate vor rămâne libere când protejezi foaia' : 'Celulele selectate vor fi blocate când protejezi foaia'); }
    focusGrid();
  };

  // Pornește filtrul pe tabelul din jurul cursorului (primul rând = cap de tabel) sau îl oprește.
  const toggleFilter = () => {
    finishEdit();
    setMenu(null);
    if (filter) {
      const next = { ...sheet };
      delete next.filter;
      delete next.slicers;
      delete next.timelines;
      applySheet(next);
      setStatus('Filtrul a fost oprit; se văd toate rândurile');
      focusGrid();
      return;
    }
    const g = multi ? range : currentRegion(cells, sel.r, sel.c);
    if (!g) {
      setStatus('Scrie întâi un tabel cu cap de tabel pe primul rând, apoi pornește filtrul');
      focusGrid();
      return;
    }
    const c1 = multi ? Math.min(g.c1, g.c0 + 25) : g.c1;
    applySheet({ ...sheet, filter: { r: g.r0, c0: g.c0, c1, hidden: {} } });
    setStatus(`Filtru pornit pe ${cellId(g.r0, g.c0)}:${cellId(g.r1, c1)}; apasă ▾ din capul de tabel`);
    focusGrid();
  };

  // Filtrul avansat: zona listei se propune din tabelul din jurul cursorului.
  const openAdvFilter = () => {
    finishEdit();
    const g = multi ? range : currentRegion(cells, sel.r, sel.c);
    setAdvDlg({ list: g ? rangeText(g) : '' });
  };
  const zoneOf = (t: string) => parseRangeText(t.trim().replace(/\$/g, '').toUpperCase());
  /** Rulează filtrul avansat; întoarce mesajul de eroare sau null. */
  const runAdvFilter = (o: { list: string; crit: string; copy: boolean; dest: string; unique: boolean }): string | null => {
    const list = zoneOf(o.list);
    const crit = zoneOf(o.crit);
    if (!list || list.r1 <= list.r0) return 'Scrie zona listei, cu titlurile pe primul rând (de exemplu A1:D50).';
    if (!crit || crit.r1 <= crit.r0) return 'Scrie zona criteriilor: titlurile pe primul rând și condițiile sub ele (de exemplu F1:G2).';
    const overlap = !(crit.r1 < list.r0 || crit.r0 > list.r1 || crit.c1 < list.c0 || crit.c0 > list.c1);
    if (overlap) return 'Zona criteriilor trebuie să fie în afara listei (de exemplu deasupra sau în dreapta ei).';
    let rows: number[];
    try { rows = advancedMatch(cells, results, list, crit, o.unique); } catch (e) { return (e as Error).message; }
    if (o.copy) {
      const p = parseCellId(o.dest.trim().replace(/\$/g, '').toUpperCase().split(':')[0]);
      if (!p || p.r >= ROWS || p.c >= COLS) return 'Scrie celula unde se copiază rezultatul (de exemplu J1).';
      if (p.r + rows.length >= ROWS || p.c + list.c1 - list.c0 >= COLS) return 'Rezultatul nu încape de la celula aleasă.';
      const out = copyRows(cells, styles, results, list, rows, p.r, p.c);
      applySheet({ ...sheet, cells: out.cells, styles: out.styles });
      selectRange({ r: out.to.r0, c: out.to.c0 }, { r: out.to.r1, c: out.to.c1 }, false);
      setStatus(`Filtru avansat: ${rows.length} ${rows.length === 1 ? 'rând copiat' : 'rânduri copiate'} în ${rangeText(out.to)}`);
    } else {
      const keep = new Set(rows);
      const hide = new Set(sheet.hideRows ?? []);
      for (let r = list.r0 + 1; r <= list.r1; r++) { if (keep.has(r)) hide.delete(r + 1); else hide.add(r + 1); }
      const next = { ...sheet };
      if (hide.size) next.hideRows = [...hide].sort((a, b) => a - b); else delete next.hideRows;
      applySheet(next);
      setStatus(`Filtru avansat: se văd ${rows.length} din ${list.r1 - list.r0} rânduri; Avansat… → Afișează tot le arată din nou`);
    }
    setAdvDlg(null);
    focusGrid();
    return null;
  };
  // Arată din nou toate rândurile listei ascunse de filtrul avansat (ca Golește în Excel).
  const clearAdvFilter = (listText: string) => {
    const list = zoneOf(listText);
    setAdvDlg(null);
    if (list && sheet.hideRows?.length) {
      const left = sheet.hideRows.filter((k) => k - 1 <= list.r0 || k - 1 > list.r1);
      const next = { ...sheet };
      if (left.length) next.hideRows = left; else delete next.hideRows;
      applySheet(next);
      setStatus('Se văd din nou toate rândurile listei');
    }
    focusGrid();
  };

  // Golește filtrele (ca Șterge din Excel): toate rândurile se văd din nou, butoanele ▾ rămân.
  const clearFilters = () => {
    finishEdit();
    setMenu(null);
    if (!filter) return;
    applySheet({ ...sheet, filter: { r: filter.r, c0: filter.c0, c1: filter.c1, hidden: {} } });
    setStatus('Filtrele au fost golite: se văd toate rândurile; butoanele ▾ rămân');
    focusGrid();
  };

  // Reaplicare: filtrul se reface după datele de acum (al nostru e mereu la zi, deci recalculăm și spunem ce se vede).
  const reapplyFilter = () => {
    finishEdit();
    if (!filter) return;
    applySheet({ ...sheet, filter: { ...filter } });
    setCalcTick((t) => t + 1);
    setStatus('Am reaplicat filtrul pe datele de acum');
    focusGrid();
  };
  // Încercuire date nevalide: celulele care nu respectă validarea, încercuite cu roșu (Golire cercuri le scoate).
  const circleInvalid = () => {
    finishEdit();
    const n = invalidCells(sheet.lists, cells, (x) => (cells[x]?.startsWith('=') ? results[x]?.text ?? '' : cells[x] ?? ''), (l, id, f) => customOk(l, id, f)).length;
    setCircle(true);
    setStatus(!lists.length ? 'Foaia nu are validări (Validare date ▾ › Validare date…).' : n ? `${n} ${n === 1 ? 'celulă nu respectă' : 'celule nu respectă'} validarea: sunt încercuite cu roșu.` : 'Toate celulele respectă validarea.');
    focusGrid();
  };
  // Golire schiță: scoate toate grupările de pe foaie (ce era strâns rămâne ascuns, ca în programul cunoscut).
  const clearOutline = () => {
    finishEdit();
    if (!sheet.rowLvl && !sheet.colLvl) { setStatus('Foaia nu are grupări'); focusGrid(); return; }
    const next: Sheet = { ...sheet };
    delete next.rowLvl; delete next.colLvl;
    applySheet(next);
    setStatus('Am scos toate grupările de pe foaie');
    focusGrid();
  };

  // Butoanele de filtrare (Slicer): un panou pe coloana cu cursorul; pornesc și filtrul dacă nu e.
  const addSlicer = () => {
    finishEdit();
    // Pe foaia unui rezumat: butoanele câmpului de filtru (B3), legate de rezumat.
    if (pivotHere) {
      if (pvFilter === undefined) { setStatus('Rezumatul nu are câmp de filtru: alege-l la Inserare → Tabel Pivot → Filtru deasupra rezumatului, apoi apasă din nou'); focusGrid(); return; }
      if (!sheet.pvSlicer) applySheet({ ...sheet, pvSlicer: true });
      setStatus('Butoane de filtrare pentru rezumat: clic = doar valoarea aceea, Ctrl+clic = mai multe, ⊘ = toate');
      focusGrid(); return;
    }
    let f = filter;
    let next = { ...sheet };
    if (!f) {
      const g = currentRegion(cells, sel.r, sel.c);
      if (!g || g.r1 <= g.r0) { setStatus('Pune cursorul într-un tabel cu cap de tabel pe primul rând, apoi apasă din nou'); focusGrid(); return; }
      f = { r: g.r0, c0: g.c0, c1: g.c1, hidden: {} };
      next = { ...next, filter: f };
    }
    if (sel.c < f.c0 || sel.c > f.c1) { setStatus('Pune cursorul într-o coloană a tabelului filtrat'); focusGrid(); return; }
    const name = colName(sel.c);
    if (sheet.slicers?.includes(name)) { setStatus(`Coloana ${name} are deja butoane de filtrare`); focusGrid(); return; }
    applySheet({ ...next, slicers: [...(sheet.slicers ?? []), name].slice(-12) });
    setStatus(`Butoane de filtrare pentru coloana ${name}: clic = doar valoarea aceea, Ctrl+clic = mai multe`);
    focusGrid();
  };
  const removeSlicer = (name: string) => {
    const left = (sheet.slicers ?? []).filter((x) => x !== name);
    const next = { ...sheet };
    if (left.length) next.slicers = left; else delete next.slicers;
    applySheet(next);
    focusGrid();
  };
  // Cronologia (Timeline): un panou cu perioadele unei coloane cu date (ani, trimestre, luni, zile); pornește filtrul dacă nu e.
  const [tlAnchor, setTlAnchor] = useState<{ col: string; from: number; to: number } | null>(null);
  const addTimeline = () => {
    finishEdit();
    // Pe foaia unui rezumat: cronologia câmpului de filtru (dacă are date calendaristice), legată de B3.
    if (pivotHere) {
      if (pvFilter === undefined) { setStatus('Rezumatul nu are câmp de filtru: alege-l la Inserare → Tabel Pivot → Filtru deasupra rezumatului, apoi apasă din nou'); focusGrid(); return; }
      const ds = pvDates();
      if (!ds.length) { setStatus('Câmpul de filtru al rezumatului nu are date calendaristice: cronologia merge doar pe o coloană cu date'); focusGrid(); return; }
      if (!sheet.pvTimeline) applySheet({ ...sheet, pvTimeline: bestLevel(ds) });
      setStatus('Cronologie pentru rezumat: clic pe o perioadă = doar zilele din ea, Shift+clic = până la ea, ⊘ = toate');
      focusGrid(); return;
    }
    let f = filter;
    let next = { ...sheet };
    if (!f) {
      const g = currentRegion(cells, sel.r, sel.c);
      if (!g || g.r1 <= g.r0) { setStatus('Pune cursorul într-un tabel cu cap de tabel pe primul rând și o coloană cu date, apoi apasă din nou'); focusGrid(); return; }
      f = { r: g.r0, c0: g.c0, c1: g.c1, hidden: {} };
      next = { ...next, filter: f };
    }
    if (sel.c < f.c0 || sel.c > f.c1) { setStatus('Pune cursorul într-o coloană a tabelului filtrat'); focusGrid(); return; }
    const name = colName(sel.c);
    if (sheet.timelines?.some((t) => t.col === name)) { setStatus(`Coloana ${name} are deja o cronologie`); focusGrid(); return; }
    const serials = columnSerials(cells, results, styles, sel.c, f.r + 1, filterEnd(cells, f));
    if (!serials.length) { setStatus('Coloana cu cursorul nu are date calendaristice: cronologia merge doar pe o coloană cu date'); focusGrid(); return; }
    applySheet({ ...next, timelines: [...(sheet.timelines ?? []), { col: name, level: bestLevel(serials) }].slice(-6) });
    setStatus(`Cronologie pentru coloana ${name}: clic pe o perioadă = doar rândurile din ea, Shift+clic = până la ea`);
    focusGrid();
  };
  const removeTimeline = (name: string) => {
    const left = (sheet.timelines ?? []).filter((t) => t.col !== name);
    const next = { ...sheet };
    if (left.length) next.timelines = left; else delete next.timelines;
    applySheet(next);
    focusGrid();
  };
  const setTimeLevel = (name: string, level: TimeLevel) => {
    applySheet({ ...sheet, timelines: (sheet.timelines ?? []).map((t) => (t.col === name ? { ...t, level } : t)) });
  };
  /** Clic pe o perioadă: doar rândurile din ea; cu Shift, de la perioada aleasă înainte până la aceasta. */
  const pickPeriod = (c: number, pd: TimePeriod, extend: boolean) => {
    if (!filter) return;
    const name = colName(c);
    let from = pd.from, to = pd.to;
    if (extend && tlAnchor?.col === name) { from = Math.min(from, tlAnchor.from); to = Math.max(to, tlAnchor.to); }
    else setTlAnchor({ col: name, from: pd.from, to: pd.to });
    applyFilter(c, [], { op: 'between', v1: String(from), v2: String(to) });
  };
  /** Clic pe un buton: doar valoarea lui; cu Ctrl, se adaugă / se scoate din cele arătate. */
  const pickSlice = (c: number, v: string, add: boolean) => {
    if (!filter) return;
    const all = columnValues(cells, results, styles, filter, c).map((x) => x.text);
    const off = new Set(filter.hidden[colName(c)] ?? []);
    let hide: string[];
    if (add) {
      if (off.has(v)) off.delete(v); else off.add(v);
      hide = all.filter((x) => off.has(x));
      if (hide.length >= all.length) { setStatus('Măcar o valoare rămâne arătată'); return; }
    } else hide = all.filter((x) => x !== v);
    applyFilter(c, hide);
  };

  // Clic dreapta › Filtrare ▸: doar rândurile cu aceeași valoare / culoare ca celula aleasă (pornește filtrul dacă nu e).
  const filterByCell = (kind: 'value' | 'bg' | 'fg') => {
    finishEdit();
    let f = filter;
    if (!f) {
      const g = currentRegion(cells, sel.r, sel.c);
      if (!g || g.r1 <= g.r0) { setStatus('Pune cursorul într-un tabel cu cap de tabel pe primul rând'); focusGrid(); return; }
      f = { r: g.r0, c0: g.c0, c1: Math.min(g.c1, g.c0 + 25), hidden: {} };
    }
    if (sel.c < f.c0 || sel.c > f.c1 || sel.r <= f.r) { setStatus('Alege o celulă din tabel, sub capul de tabel'); focusGrid(); return; }
    const n = colName(sel.c);
    const h = { ...f.hidden }, cd = { ...f.cond }, cl = { ...f.color };
    delete h[n]; delete cd[n]; delete cl[n];
    let what: string;
    if (kind === 'value') {
      const v = valueAt(cells, results, styles, sel.r, sel.c);
      const hide = columnValues(cells, results, styles, f, sel.c).map((x) => x.text).filter((x) => x !== v);
      if (hide.length) h[n] = hide;
      what = `valoarea „${v}”`;
    } else {
      const color = colorOf(styles[cellId(sel.r, sel.c)], kind);
      cl[n] = { kind, color };
      what = kind === 'bg' ? 'culoarea celulei' : 'culoarea fontului';
    }
    const { cond: _c, color: _k, ...rest } = f;
    applySheet({ ...sheet, filter: { ...rest, hidden: h, ...(Object.keys(cd).length ? { cond: cd } : {}), ...(Object.keys(cl).length ? { color: cl } : {}) } });
    setStatus(`Filtru pe coloana ${n} după ${what}; Date › Golire le arată din nou pe toate`);
    focusGrid();
  };

  // Valorile debifate în lista coloanei c (lista goală = se văd toate).
  const applyFilter = (c: number, vals: string[], cond?: FilterCond, color?: FilterColor) => {
    setMenu(null);
    if (!filter) return;
    const h = { ...filter.hidden };
    if (vals.length) h[colName(c)] = vals; else delete h[colName(c)];
    // O condiție sau o culoare înlocuiește bifele coloanei (ca în Excel); altfel se scot cele vechi.
    const cd = { ...filter.cond };
    if (cond) { cd[colName(c)] = cond; delete h[colName(c)]; } else delete cd[colName(c)];
    const cl = { ...filter.color };
    if (color) { cl[colName(c)] = color; delete h[colName(c)]; delete cd[colName(c)]; } else delete cl[colName(c)];
    const { cond: _old, color: _oldColor, ...rest } = filter;
    applySheet({ ...sheet, filter: { ...rest, hidden: h, ...(Object.keys(cd).length ? { cond: cd } : {}), ...(Object.keys(cl).length ? { color: cl } : {}) } });
    focusGrid();
  };

  const openMenu = (c: number, x: number, y: number) => {
    finishEdit();
    setMenu((m) => (m?.c === c ? null : { c, x, y }));
  };


  // Bara de formule se ascunde pentru toate tabelele (alegerea se ține minte pe acest calculator).
  const [fxBar, setFxBar] = useState(() => { try { return localStorage.getItem(FXBAR_KEY) !== '0'; } catch { return true; } });
  const toggleFxBar = () => {
    finishEdit();
    const on = !fxBar;
    setFxBar(on);
    try { localStorage.setItem(FXBAR_KEY, on ? '1' : '0'); } catch { /* fără setări: ține până la închidere */ }
    focusGrid();
  };

  const toggleHead = () => {
    const next = { ...sheet };
    if (sheet.noHead) delete next.noHead; else next.noHead = true;
    applySheet(next);
    focusGrid();
  };

  const toggleGrid = () => {
    const next = { ...sheet };
    if (sheet.noGrid) delete next.noGrid; else next.noGrid = true;
    applySheet(next);
    focusGrid();
  };

  // Înghețare rând de sus / prima coloană (Vizualizare › Înghețare panouri ▾): doar acela rămâne înghețat.
  const freezeOnly = (what: 'r' | 'c') => {
    finishEdit();
    const next = { ...sheet };
    delete next.freeze; delete next.freezeCol;
    if (what === 'r') next.freeze = 1; else next.freezeCol = 1;
    applySheet(next);
    setStatus(what === 'r' ? 'Primul rând rămâne pe loc la derulare' : 'Prima coloană rămâne pe loc la derulare');
    focusGrid();
  };
  // Revizuire › Note ▾: nota anterioară / următoare (pe rânduri, de sus în jos), toate notele la vedere.
  const goNote = (dir: 1 | -1) => {
    finishEdit();
    const list = Object.keys(styles).filter((id) => styles[id]?.note).map((id) => parseCellId(id)).filter((p): p is { r: number; c: number } => !!p)
      .sort((a, b) => a.r - b.r || a.c - b.c);
    if (!list.length) { setStatus('Foaia nu are note: le pui cu Note ▾ › Notă nouă (Shift+F2)'); focusGrid(); return; }
    const at = (p: { r: number; c: number }) => p.r * COLS + p.c, cur = sel.r * COLS + sel.c;
    const p = dir > 0 ? list.find((x) => at(x) > cur) ?? list[0] : [...list].reverse().find((x) => at(x) < cur) ?? list[list.length - 1];
    selectRange({ r: p.r, c: p.c });
    setStatus(`Nota din ${cellId(p.r, p.c)}: ${styles[cellId(p.r, p.c)]?.note ?? ''}`);
    focusGrid();
  };
  const toggleAllNotes = () => {
    const n = Object.values(styles).filter((x) => x?.note).length;
    setShowNotes(!showNotes);
    setStatus(showNotes ? 'Notele apar din nou doar la trecerea mouse-ului' : n ? `Se văd toate notele (${n})` : 'Foaia nu are note: le pui cu Note ▾ › Notă nouă');
    focusGrid();
  };
  // Revizuire › Statistici registru de lucru: un rezumat al registrului, în bara de jos.
  const bookStats = () => {
    finishEdit();
    const all = doc.sheets.map((x, i) => (i === active ? { ...x, cells, styles } : x));
    const sum = (f: (x: Sheet) => number) => all.reduce((a, x) => a + f(x), 0);
    const filled = sum((x) => Object.values(x.cells).filter((v) => v !== '').length);
    const fx = sum((x) => Object.values(x.cells).filter((v) => v.startsWith('=')).length);
    const notes = sum((x) => Object.values(x.styles ?? {}).filter((st) => st?.note).length);
    const charts = sum((x) => x.charts?.length ?? 0), pics = sum((x) => x.pics?.length ?? 0), tables = sum((x) => x.tables?.length ?? 0);
    const here = Object.values(cells).filter((v) => v !== '').length;
    setStatus(`Registrul are ${all.length} ${all.length === 1 ? 'foaie' : 'foi'}, ${filled} celule cu date (${here} pe foaia aceasta), ${fx} formule, ${notes} note, ${tables} tabele, ${charts} grafice, ${pics} imagini`);
    focusGrid();
  };

  // Îngheață la selecție: rândurile de deasupra celulei alese și coloanele din stânga ei rămân pe loc.
  // Dacă ceva e deja înghețat, același buton dezgheață tot.
  const freezeAtSel = () => {
    finishEdit();
    const next = { ...sheet };
    if (sheet.freeze || sheet.freezeCol) {
      delete next.freeze;
      delete next.freezeCol;
      applySheet(next);
      setStatus('Panourile nu mai sunt înghețate');
      focusGrid();
      return;
    }
    const rows = Math.min(MAX_FREEZE_ROWS, sel.r);
    const cols = Math.min(MAX_FREEZE_COLS, sel.c);
    if (!rows && !cols) {
      setStatus('Alege celula de sub rândurile și din dreapta coloanelor care să rămână pe loc (de exemplu B3 îngheață rândurile 1–2 și coloana A)');
      focusGrid();
      return;
    }
    if (rows) next.freeze = rows;
    if (cols) next.freezeCol = cols;
    applySheet(next);
    const what = [rows ? (rows === 1 ? 'rândul 1' : `rândurile 1–${rows}`) : '', cols ? (cols === 1 ? 'coloana A' : `coloanele A–${colName(cols - 1)}`) : ''].filter(Boolean).join(' și ');
    const cut = sel.r > MAX_FREEZE_ROWS || sel.c > MAX_FREEZE_COLS ? ` (cel mult ${MAX_FREEZE_ROWS} de rânduri și ${MAX_FREEZE_COLS} de coloane)` : '';
    setStatus(`Înghețat: ${what}${cut}`);
    focusGrid();
  };

  // Anularea se face pe tot tabelul: dacă pasul anulat era în altă foaie, treci pe foaia aceea.
  const restore = (snap: Snap) => {
    setDoc((d) => ({ ...d, sheets: snap.sheets }));
    markDirty();
    if (snap.active !== active) { setActive(snap.active); selectRange({ r: 0, c: 0 }); }
  };

  const undo = () => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push({ sheets: doc.sheets, active });
    restore(prev);
  };

  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push({ sheets: doc.sheets, active });
    restore(next);
  };

  const focusGrid = () => gridRef.current?.focus({ preventScroll: true });

  // Caseta de nume: Enter duce la celula, zona sau numele scris; un nume nou devine numele zonei selectate.
  const runGoto = (text: string) => {
    setNameEdit(null);
    const r = parseGoto(text, doc.sheets.map((s) => s.name), sheet.name, doc.names ?? []);
    if (r.kind === 'error') { setStatus(r.msg); focusGrid(); return; }
    if (r.kind === 'name') {
      const abs = (rr: number, cc: number) => `${colName(cc)}${rr + 1}`;
      const ref = `${sheetRef(sheet.name)}!${abs(range.r0, range.c0)}${multi ? ':' + abs(range.r1, range.c1) : ''}`;
      setDoc((d) => ({ ...d, names: [...(d.names ?? []), { name: r.name, ref }] }));
      markDirty();
      setStatus(`Numele „${r.name}” înseamnă acum ${ref}: îl poți folosi în formule (=SUM(${r.name})) sau scrie-l aici ca să ajungi la zonă`);
      focusGrid();
      return;
    }
    if (r.sheet) {
      const i = doc.sheets.findIndex((s) => s.name === r.sheet);
      if (doc.sheets[i].hidden) { setStatus(`Foaia „${r.sheet}” e ascunsă: afișeaz-o întâi (click dreapta pe o filă)`); focusGrid(); return; }
      switchSheet(i);
    }
    selectRange({ r: r.r0, c: r.c0 }, { r: r.r1, c: r.c1 });
    focusGrid();
  };

  // Mergi la special: selectează dintr-odată toate celulele de felul ales (în selecție sau, de la o singură celulă, în toată foaia).
  const runGotoSpecial = (kind: SpecialKind, types: ValueType[]) => {
    setGsDlg(false);
    const found = gotoSpecial(kind, types, {
      cells, results: baseResults, styles, rules: sheet.rules, lists: sheet.lists, hiddenRows: hidden, hiddenCols: hiddenC,
      sel: allRanges, at: sel, region: (r, c) => currentRegion(cells, r, c),
    });
    focusGrid();
    if (!found.length) { setStatus('Nu am găsit nicio celulă de felul acesta'); return; }
    const [first, ...rest] = found;
    follow.current = true;
    setSel({ r: first.r0, c: first.c0 });
    setExt({ r: first.r1, c: first.c1 });
    setExtra(rest);
    let n = 0;
    for (const g of found) n += (g.r1 - g.r0 + 1) * (g.c1 - g.c0 + 1);
    setStatus(`Am selectat ${n.toLocaleString('ro-RO')} ${n === 1 ? 'celulă' : 'celule'}: acum le poți colora, umple sau șterge dintr-odată`);
  };

  // Grafice: din zona selectată (sau, pentru o singură celulă, din tabelul în care se află), afișate în panoul din dreapta.
  const charts = sheet.charts ?? [];
  const chartSrcs = useMemo(() => chartSrcsOf(charts, sheetName, doc), [charts, sheetName, doc]);
  const setCharts = (next: SheetChart[], undoable = true) => {
    const s = { ...sheet };
    if (next.length) s.charts = next; else delete s.charts;
    if (undoable) applySheet(s); else setSheet(s);
  };
  // Graficul ales cu clic în panou: deschide fila contextuală „Grafic” din panglică.
  const [selChart, setSelChart] = useState<string | null>(null);
  const chartOn = charts.find((ch) => ch.id === selChart && (ch.at || showCharts)) || null;
  // Graficele de pe foaie (cu `at`) stau peste celule, ca pozele; celelalte, în panoul din dreapta.
  const panelCharts = charts.filter((ch) => !ch.at);
  const [chartDrag, setChartDrag] = useState<{ id: string; x: number; y: number; w: number; h: number } | null>(null);
  // 🖼 Imagine: pozele de peste celule, prinse de colțul unei celule (vezi pics.ts). Se aleg cu click, se mută trăgând,
  // se măresc din colțul din dreapta jos (Shift = fără proporții), se șterg cu Delete.
  const pics = sheet.pics ?? [];
  const [selPic, setSelPic] = useState<string | null>(null);
  const [picDrag, setPicDrag] = useState<{ id: string; x: number; y: number; w: number; h: number } | null>(null);
  const setPics = (next: SheetPic[], undoable = true) => {
    const s = { ...sheet };
    if (next.length) s.pics = next; else delete s.pics;
    if (undoable) applySheet(s); else setSheet(s);
  };
  const colX = (c: number) => { let x = headW; for (let k = 0; k < c; k++) x += widthOf(k); return x; };
  const picBox = (p: Pick<SheetPic, 'r' | 'c' | 'dx' | 'dy' | 'w' | 'h'> & { cell?: true }) => {
    const pos = shown.indexOf(p.r);
    if (pos === undefined || pos < 0) return null;
    // Poza în celulă ia mărimea celulei de acum (cu 2 px margine), deci urmează lățimea coloanei și înălțimea rândului.
    if (p.cell) return { x: colX(p.c) + 2, y: headH() + topOf(pos) + 2, w: Math.max(4, widthOf(p.c) - 4), h: Math.max(4, topOf(pos + 1) - topOf(pos) - 4) };
    return { x: colX(p.c) + p.dx, y: headH() + topOf(pos) + p.dy, w: p.w, h: p.h };
  };
  // Punctul din tabel (în pixeli, fără zoom) → celula de care se prinde poza și cât de departe e de colțul ei.
  const anchorOf = (x: number, y: number) => {
    let c = 0, cx = headW;
    while (c < COLS - 1 && cx + widthOf(c) <= x) { cx += widthOf(c); c++; }
    const pos = Math.max(0, indexAt(Math.max(0, y - headH())));
    const r = shown.at(pos) ?? 0;
    return { r, c, dx: Math.max(0, Math.round(x - cx)), dy: Math.max(0, Math.round(y - headH() - topOf(pos))) };
  };
  /** Inserare → ▣ În celulă: poza aleasă intră în celula ei (sau una nouă în celula aleasă); ⧉ Peste celule o scoate înapoi peste foaie. */
  const cellPic = async () => {
    const cur = pics.find((q) => q.id === selPic);
    if (cur?.cell) {
      const b = picBox(cur);
      setPics(pics.map((q) => { if (q.id !== cur.id) return q; const { cell: _c, ...rest } = q; return { ...rest, dx: 0, dy: 0, ...(b ? { w: Math.max(24, b.w * 3), h: Math.max(24, b.h * 3) } : {}) }; }));
      setStatus('Poza e acum peste celule: se mută și se mărește cu mouse-ul');
      return;
    }
    if (cur) {
      const r = cur.r;
      const fit = picBox({ ...cur, r, cell: true });
      setPics(pics.map((q) => (q.id === cur.id ? { ...q, r, dx: 0, dy: 0, cell: true, ...(fit ? { w: fit.w, h: fit.h } : {}) } : q)));
      setStatus(`Poza e în celula ${colName(cur.c)}${r + 1}: se mută odată cu celula și ia mărimea ei`);
      return;
    }
    if (pics.length >= MAX_PICS) { setStatus(`O foaie poate avea cel mult ${MAX_PICS} de poze`); return; }
    const f = await api.importFile('image');
    if (!f) return;
    let img: { src: string; w: number; h: number };
    try { img = await imageToDataUrl(new Blob([f.data as BlobPart])); } catch { setStatus('Poza nu a putut fi citită (merg JPG, PNG, WebP, BMP, GIF).'); return; }
    const alt = fileName(f.path ?? '').split('.').slice(0, -1).join('.') || undefined;
    const base = { r: sel.r, c: sel.c, dx: 0, dy: 0, w: 1, h: 1, cell: true as const };
    const fit = picBox(base);
    const p: SheetPic = { id: 'p' + Date.now().toString(36), src: img.src, ...base, ...(fit ? { w: fit.w, h: fit.h } : startSize(img.w, img.h)), ...(alt ? { alt } : {}) };
    setPics([...pics, p]);
    setSelPic(p.id);
    setStatus(`Poza e în celula ${colName(sel.c)}${sel.r + 1}: mărește coloana sau rândul ca s-o vezi mai mare; Delete o șterge`);
  };
  const addPic = async () => {
    if (pics.length >= MAX_PICS) { setStatus(`O foaie poate avea cel mult ${MAX_PICS} de poze`); return; }
    const f = await api.importFile('image');
    if (!f) return;
    let img: { src: string; w: number; h: number };
    try { img = await imageToDataUrl(new Blob([f.data as BlobPart])); } catch { setStatus('Poza nu a putut fi citită (merg JPG, PNG, WebP, BMP, GIF).'); return; }
    const alt = fileName(f.path ?? '').split('.').slice(0, -1).join('.') || undefined;
    const p: SheetPic = { id: 'p' + Date.now().toString(36), src: img.src, r: sel.r, c: sel.c, dx: 0, dy: 0, ...startSize(img.w, img.h), ...(alt ? { alt } : {}) };
    setPics([...pics, p]);
    setSelPic(p.id);
    setStatus('Poza e pe foaie: trage de ea ca s-o muți, de colțul din dreapta jos ca s-o mărești; Delete o șterge');
  };
  // ☺ Pictograme: fereastra cu biblioteca; cele alese intră una lângă alta de la celula aleasă, de 96 px.
  const [iconsDlg, setIconsDlg] = useState(false);
  const addIcons = async (blobs: Blob[], names: string[], specs: IconSpec[] = []) => {
    const room = MAX_PICS - pics.length;
    if (room <= 0) { setStatus(`O foaie poate avea cel mult ${MAX_PICS} de poze`); return; }
    const add: SheetPic[] = [];
    for (const [i, b] of blobs.slice(0, room).entries()) {
      const { src } = await imageToDataUrl(b);
      add.push({ id: 'p' + Date.now().toString(36) + i, src, r: sel.r, c: sel.c, dx: i * 106, dy: 0, w: 96, h: 96, alt: names[i], ...(specs[i] ? { ic: specs[i] } : {}) });
    }
    setPics([...pics, ...add]);
    setSelPic(add[add.length - 1].id);
    setStatus(add.length === 1 ? `Pictograma „${names[0]}” e pe foaie: trage de ea ca s-o muți, de colț ca s-o mărești` : `${add.length} pictograme puse pe foaie`);
  };
  // Recolorarea unei pictograme de pe foaie: desenată din nou din bibliotecă, la aceeași mărime și în același loc.
  const recolorIcon = async (id: string, spec: IconSpec, patch: Partial<IconSpec>) => {
    const ic = iconById(spec.id);
    if (!ic) return;
    const next = { ...spec, ...patch };
    const { src } = await imageToDataUrl(await iconPng(ic, next.c, next.s));
    setPics(pics.map((p) => (p.id === id ? { ...p, src, ic: next } : p)));
  };
  // 🧊 Modele 3D: un .obj / .stl / .glb / .gltf / .ply rotit cu mouse-ul, pus pe foaie ca poză care ține minte modelul
  // (dublu-click pe ea redeschide fereastra, cu modelul în poziția de atunci, ca să fie rotit altfel).
  const [m3dDlg, setM3dDlg] = useState<{ id: string | null; init?: Model3DSource } | null>(null);
  const putModel3d = async (blob: Blob, name: string, src: Model3DSource) => {
    const at = m3dDlg;
    setM3dDlg(null);
    let img: { src: string; w: number; h: number };
    try { img = await imageToDataUrl(blob); } catch { setStatus('Modelul 3D nu a putut fi pus pe foaie'); return; }
    const keep = keepModel(src.name, src.data, src.view);
    const old = at?.id ? pics.find((p) => p.id === at.id) : undefined;
    if (old) {
      const h = Math.max(8, Math.round(old.w * img.h / Math.max(1, img.w)));
      setPics(pics.map((p) => (p.id === old.id ? { ...p, src: img.src, h, ...(keep ? { m3d: keep } : {}) } : p)));
      setStatus('Modelul 3D e în noua poziție');
      return;
    }
    if (pics.length >= MAX_PICS) { setStatus(`O foaie poate avea cel mult ${MAX_PICS} de poze`); return; }
    const alt = name.replace(/[.](obj|stl|glb|gltf|ply)$/i, '') || 'Model 3D';
    const p: SheetPic = { id: 'p' + Date.now().toString(36), src: img.src, r: sel.r, c: sel.c, dx: 0, dy: 0, ...startSize(img.w, img.h), alt, ...(keep ? { m3d: keep } : {}) };
    setPics([...pics, p]);
    setSelPic(p.id);
    setStatus('Modelul 3D e pe foaie: trage de el ca să-l muți, de colț ca să-l mărești; dublu-click îl rotește altfel');
  };
  // 📸 Captură de ecran: poza unei ferestre deschise sau o bucată decupată din ecran, pusă pe foaie ca o poză obișnuită.
  const addShot = async () => {
    if (pics.length >= MAX_PICS) { setStatus(`O foaie poate avea cel mult ${MAX_PICS} de poze`); return; }
    const b = await captureScreen();
    if (!b) return;
    let img: { src: string; w: number; h: number };
    try { img = await imageToDataUrl(b); } catch { setStatus('Captura nu a putut fi citită'); return; }
    const p: SheetPic = { id: 'p' + Date.now().toString(36), src: img.src, r: sel.r, c: sel.c, dx: 0, dy: 0, ...startSize(img.w, img.h), alt: 'Captură de ecran' };
    setPics([...pics, p]);
    setSelPic(p.id);
    setStatus('Captura e pe foaie: trage de ea ca s-o muți, de colțul din dreapta jos ca s-o mărești; Delete o șterge');
  };
  // ✏ Desen: o schiță făcută de mână (creion, marker, radieră), pusă pe foaie ca o poză obișnuită, doar cu liniile.
  // O singură formă îndreptată cu ◇ În formă intră ca formă (ca din ⬠ Forme): dublu-click îi schimbă culorile și textul.
  const addSketch = async () => {
    if (pics.length >= MAX_PICS) { setStatus(`O foaie poate avea cel mult ${MAX_PICS} de poze`); return; }
    const r = await drawSketchEx();
    if (!r) return;
    if (r.shape) {
      const { k, stroke, sw, w, h } = r.shape;
      const spec: ShapeBox = { k, fill: '', stroke, sw, text: '', tc: '#000000', fs: 14, al: 'c' };
      let src: string;
      try { src = await renderShapeBox(spec, w, h); } catch { setStatus('Forma nu a putut fi desenată'); return; }
      const name = SHAPES.find((x) => x.k === k)?.name ?? '';
      const p: SheetPic = { id: 'p' + Date.now().toString(36), src, r: sel.r, c: sel.c, dx: 0, dy: 0, w, h, alt: `Formă: ${name.toLowerCase()}`, sh: spec };
      setPics([...pics, p]);
      setSelPic(p.id);
      setStatus('Forma e pe foaie: trage de ea ca s-o muți, de colț ca s-o mărești; dublu-click o schimbă (text, culori); Delete o șterge');
      return;
    }
    let img: { src: string; w: number; h: number };
    try { img = await imageToDataUrl(r.blob); } catch { setStatus('Desenul nu a putut fi pus pe foaie'); return; }
    const p: SheetPic = { id: 'p' + Date.now().toString(36), src: img.src, r: sel.r, c: sel.c, dx: 0, dy: 0, ...startSize(img.w, img.h), alt: 'Desen' };
    setPics([...pics, p]);
    setSelPic(p.id);
    setStatus('Desenul e pe foaie: trage de el ca să-l muți, de colțul din dreapta jos ca să-l mărești; Delete îl șterge');
  };
  // 𝒜 Text artistic: un titlu desenat cu stilurile din Docs, pus pe foaie ca poză; dublu-click pe el îi schimbă textul sau stilul.
  const [waDlg, setWaDlg] = useState<{ id: string | null; text: string; s: string } | null>(null);
  const putWordArt = (spec: WordArtSpec, id: string | null) => {
    const ok = parseWordArt(spec);
    if (!ok) { setStatus('Scrie întâi textul'); return; }
    const img = renderWordArt(ok);
    const h = 72; // poza are 144 px înălțime și se arată la jumătate, ca să fie clară
    const old = id ? pics.find((q) => q.id === id) : undefined;
    if (old) {
      // La schimbare rămâne înălțimea aleasă; lățimea urmează textul nou.
      const k = old.h / h;
      setPics(pics.map((q) => (q.id === id ? { ...q, src: img.src, w: Math.max(8, Math.round(img.width * k)), alt: ok.text, wa: { ...q.wa, ...ok } } : q)));
      setSelPic(id);
      setStatus('Textul artistic s-a schimbat (Ctrl+Z îl aduce înapoi)');
      return;
    }
    if (pics.length >= MAX_PICS) { setStatus(`O foaie poate avea cel mult ${MAX_PICS} de poze`); return; }
    const p: SheetPic = { id: 'p' + Date.now().toString(36), src: img.src, r: sel.r, c: sel.c, dx: 0, dy: 0, w: img.width, h, alt: ok.text, wa: ok };
    setPics([...pics, p]);
    setSelPic(p.id);
    setStatus('Textul artistic e pe foaie: trage de el ca să-l muți; dublu-click îl schimbă; Delete îl șterge');
  };
  // √x Ecuație: scrisă pe un rând (fereastra din Docs), desenată ca poză clară peste celule; poza ține minte textul ecuației,
  // deci dublu-click pe ea o redeschide. La schimbare, literele revin la mărimea obișnuită (poza crește sau scade cât desenul nou).
  const [eqDlg, setEqDlg] = useState<{ id: string | null; src: string } | null>(null);
  const putEquation = async (src: string, id: string | null) => {
    const old = id ? pics.find((q) => q.id === id) : undefined;
    if (!old && pics.length >= MAX_PICS) { setStatus(`O foaie poate avea cel mult ${MAX_PICS} de poze`); return; }
    let img: { src: string; w: number; h: number };
    try { img = await equationToPng({ src }, 28, 2, '#000'); } catch { setStatus('Ecuația nu a putut fi desenată'); return; }
    const alt = equationAlt({ src });
    // Poza e desenată de două ori mai mare (ca să fie clară) și se arată la jumătate.
    const w = Math.max(8, Math.round(img.w / 2)), h = Math.max(8, Math.round(img.h / 2));
    if (old) {
      setPics(pics.map((q) => (q.id === id ? { ...q, src: img.src, w, h, alt, eq: src } : q)));
      setSelPic(id);
      setStatus('Ecuația s-a schimbat (Ctrl+Z o aduce înapoi)');
      return;
    }
    const p: SheetPic = { id: 'p' + Date.now().toString(36), src: img.src, r: sel.r, c: sel.c, dx: 0, dy: 0, w, h, alt, eq: src };
    setPics([...pics, p]);
    setSelPic(p.id);
    setStatus('Ecuația e pe foaie: trage de ea ca s-o muți; dublu-click o schimbă; Delete o șterge');
  };
  // ◇ Schemă (proces, listă, ciclu, piramidă, ierarhie), desenată ca poză clară peste celule, ca în Docs; poza ține minte
  // schema, deci dublu-click pe ea redeschide fereastra. La schimbare rămâne lățimea aleasă, înălțimea urmează desenul nou.
  const [dgDlg, setDgDlg] = useState<{ id: string | null; d: DocDiagram } | null>(null);
  const putDiagram = async (d: DocDiagram, id: string | null) => {
    const old = id ? pics.find((q) => q.id === id) : undefined;
    if (!old && pics.length >= MAX_PICS) { setStatus(`O foaie poate avea cel mult ${MAX_PICS} de poze`); return; }
    let src: string;
    try { src = await diagramToPng(d); } catch { setStatus('Schema nu a putut fi desenată'); return; }
    const nh = diagramSvg(d).h, alt = diagramAlt(d);
    if (old) {
      setPics(pics.map((q) => (q.id === id ? { ...q, src, h: Math.max(8, Math.round((q.w * nh) / DIAGRAM_W)), alt, dg: d } : q)));
      setSelPic(id);
      setStatus('Schema s-a schimbat (Ctrl+Z o aduce înapoi)');
      return;
    }
    const p: SheetPic = { id: 'p' + Date.now().toString(36), src, r: sel.r, c: sel.c, dx: 0, dy: 0, ...startSize(DIAGRAM_W, nh), alt, dg: d };
    setPics([...pics, p]);
    setSelPic(p.id);
    setStatus('Schema e pe foaie: trage de ea ca s-o muți; dublu-click o schimbă; Delete o șterge');
  };
  // ⬠ Forme și ▤ Casetă de text: forma (cu text în ea) desenată ca poză; dublu-click pe ea o schimbă, la mărire se redesenează clar.
  const [shDlg, setShDlg] = useState<{ id: string | null; sh: ShapeBox } | null>(null);
  const putShape = async (spec: ShapeBox, id: string | null) => {
    const old = id ? pics.find((q) => q.id === id) : undefined;
    if (!old && pics.length >= MAX_PICS) { setStatus(`O foaie poate avea cel mult ${MAX_PICS} de poze și forme`); return; }
    const base = SHAPES.find((x) => x.k === spec.k) ?? SHAPES[0];
    const w = old?.w ?? base.w, h = old?.h ?? base.h;
    let src: string;
    try { src = await renderShapeBox(spec, w, h); } catch { setStatus('Forma nu a putut fi desenată'); return; }
    const alt = spec.text.trim() ? spec.text.trim().slice(0, 200) : `Formă: ${base.name.toLowerCase()}`;
    if (old) {
      setPics(pics.map((q) => (q.id === id ? { ...q, src, alt, sh: spec } : q)));
      setSelPic(id);
      setStatus('Forma s-a schimbat (Ctrl+Z o aduce înapoi)');
      return;
    }
    const p: SheetPic = { id: 'p' + Date.now().toString(36), src, r: sel.r, c: sel.c, dx: 0, dy: 0, w, h, alt, sh: spec };
    setPics([...pics, p]);
    setSelPic(p.id);
    setStatus('Forma e pe foaie: trage de ea ca s-o muți, de colț ca s-o mărești; dublu-click o schimbă (text, culori); Delete o șterge');
  };
  const picDown = (e: React.PointerEvent, p: SheetPic, mode: 'move' | 'size') => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setSelPic(p.id);
    (e.currentTarget.closest('.sh-pic') as HTMLElement | null)?.focus({ preventScroll: true });
    const b0 = picBox(p);
    if (!b0 || sheet.protect || p.cell) return;
    const k = zoom / 100, mx = e.clientX, my = e.clientY;
    let cur = b0, moved = false;
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - mx) / k, dy = (ev.clientY - my) / k;
      if (!moved && Math.hypot(dx, dy) < 3) return;
      moved = true;
      cur = mode === 'move' ? { ...b0, x: Math.max(headW, b0.x + dx), y: Math.max(headH(), b0.y + dy) } : { ...b0, ...resized(b0, dx, dy, !ev.shiftKey) };
      setPicDrag({ id: p.id, ...cur });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (!moved) { setPicDrag(null); return; }
      const place = (src?: string) => {
        setPicDrag(null);
        setPics(pics.map((q) => (q.id === p.id ? { ...q, ...anchorOf(cur.x, cur.y), w: cur.w, h: cur.h, ...(src ? { src } : {}) } : q)));
      };
      // O formă mărită se redesenează la noua mărime (conturul și textul rămân clare, nu întinse).
      if (mode === 'size' && p.sh && (cur.w !== p.w || cur.h !== p.h)) void renderShapeBox(p.sh, cur.w, cur.h).then(place, () => place());
      else place();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const picKey = (e: React.KeyboardEvent, p: SheetPic) => {
    // Ctrl+Z / Ctrl+Y merg și cu poza aleasă (ajung la foaie).
    if ((e.ctrlKey || e.metaKey) && /^[zy]$/i.test(e.key)) return;
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); setSelPic(null); focusGrid(); return; }
    if (sheet.protect) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      setPics(pics.filter((q) => q.id !== p.id));
      setSelPic(null);
      focusGrid();
      setStatus('Poză ștearsă (Ctrl+Z o aduce înapoi)');
      return;
    }
    const step = e.shiftKey ? 10 : 1;
    const d = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] } as Record<string, number[]>)[e.key];
    const b = d && !p.cell && picBox(p);
    if (!d || !b) return;
    e.preventDefault();
    setPics(pics.map((q) => (q.id === p.id ? { ...q, ...anchorOf(Math.max(headW, b.x + d[0]), Math.max(headH(), b.y + d[1])) } : q)));
  };
  const chartDown = (e: React.PointerEvent, ch: SheetChart, mode: 'move' | 'size') => {
    if (e.button !== 0 || !ch.at) return;
    e.preventDefault();
    e.stopPropagation();
    setSelChart(ch.id);
    (e.currentTarget.closest('.sh-chart') as HTMLElement | null)?.focus({ preventScroll: true });
    const b0 = picBox(ch.at);
    if (!b0 || sheet.protect) return;
    const k = zoom / 100, mx = e.clientX, my = e.clientY;
    let cur = b0, moved = false;
    const lim = (v: number) => Math.min(CHART_MAX, Math.max(CHART_MIN, Math.round(v)));
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - mx) / k, dy = (ev.clientY - my) / k;
      if (!moved && Math.hypot(dx, dy) < 3) return;
      moved = true;
      if (mode === 'move') cur = { ...b0, x: Math.max(headW, b0.x + dx), y: Math.max(headH(), b0.y + dy) };
      else if (ev.shiftKey) { const q = Math.max((b0.w + dx) / b0.w, (b0.h + dy) / b0.h); cur = { ...b0, w: lim(b0.w * q), h: lim(b0.h * q) }; }
      else cur = { ...b0, w: lim(b0.w + dx), h: lim(b0.h + dy) };
      setChartDrag({ id: ch.id, ...cur });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setChartDrag(null);
      if (moved) updateChart(ch.id, { at: { ...anchorOf(cur.x, cur.y), w: cur.w, h: cur.h } });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const chartKey = (e: React.KeyboardEvent, ch: SheetChart) => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); setSelChart(null); focusGrid(); return; }
    if (sheet.protect || !ch.at) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeChart(ch); focusGrid(); return; }
    const step = e.shiftKey ? 10 : 1;
    const d = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] } as Record<string, number[]>)[e.key];
    const b = d && picBox(ch.at);
    if (!d || !b) return;
    e.preventDefault();
    updateChart(ch.id, { at: { ...ch.at, ...anchorOf(Math.max(headW, b.x + d[0]), Math.max(headH(), b.y + d[1])) } });
  };
  // Mutare diagramă: pe foaie (peste celule, în dreapta datelor ei, sau lângă celula aleasă) ori înapoi în panoul din dreapta.
  const placeChart = (ch: SheetChart, onSheet: boolean) => {
    if (!onSheet) {
      const { at: _at, ...rest } = ch;
      setCharts(charts.map((x) => (x.id === ch.id ? rest : x)));
      setShowCharts(true);
      setStatus('Graficul e acum în panoul de grafice din dreapta');
      return;
    }
    if (ch.at) return;
    const g = parseRangeText(ch.range);
    const at: ChartAt = g ? { r: g.r0, c: Math.min(COLS - 1, g.c1 + 2), dx: 0, dy: 0, w: CHART_W, h: CHART_H } : { r: sel.r, c: sel.c, dx: 0, dy: 0, w: CHART_W, h: CHART_H };
    updateChart(ch.id, { at });
    setStatus('Graficul e pe foaie: trage de el ca să-l muți, de colțul din dreapta jos ca să-l mărești; Delete îl șterge');
  };
  // Mutare diagramă → Foaie nouă: graficul pleacă pe o foaie doar a lui (Diagramă1, Diagramă2…), fără grilă și titluri,
  // mare cât ecranul; datele rămân unde erau (src), deci graficul se schimbă când schimbi datele.
  const chartToNewSheet = (ch: SheetChart) => {
    finishEdit();
    if (doc.sheets.length >= MAX_SHEETS) { setStatus(`Un tabel poate avea cel mult ${MAX_SHEETS} de foi`); return; }
    const low = (n: string) => n.toLocaleLowerCase('ro-RO');
    let k = 1;
    while (doc.sheets.some((x) => low(x.name) === low(`Diagramă${k}`))) k++;
    const name = `Diagramă${k}`;
    const out = emptySheet(name);
    out.noGrid = true;
    out.noHead = true;
    out.charts = [{ ...ch, src: ch.src ?? sheetName, at: { r: 0, c: 0, dx: 8, dy: 8, w: 960, h: 600 } }];
    const next = [...doc.sheets];
    const left = charts.filter((x) => x.id !== ch.id);
    const cur = { ...next[active] };
    if (left.length) cur.charts = left; else delete cur.charts;
    next[active] = cur;
    next.splice(active + 1, 0, out);
    setSelChart(null);
    applySheets({ sheets: next, active: active + 1 });
    setStatus(`Graficul e acum pe foaia „${name}”; datele au rămas pe foaia „${sheetName}”`);
  };
  const chartRange = (): Range | null => {
    const g = multi ? range : currentRegion(cells, sel.r, sel.c);
    return g && (g.r1 > g.r0 || g.c1 > g.c0 || cells[cellId(g.r0, g.c0)]) ? g : null;
  };
  // Minigrafice: pentru fiecare rând al zonei alese (sau pentru o coloană) un desen mic în celula de alături; pe o celulă cu minigrafic, lista îi schimbă felul.
  const setSparks = (next: SheetSpark[]) => {
    const s = { ...sheet };
    if (next.length) s.sparks = next; else delete s.sparks;
    applySheet(s);
  };
  /** Minigraficele noi pentru zona aleasă (unul pe rând, în celula din dreapta) și lista foii cu ele (aceeași pentru clic și previzualizare). */
  const sparksFor = (kind: SparkKind) => {
    const made = range.c1 > range.c0
      ? Array.from({ length: range.r1 - range.r0 + 1 }, (_, i) => sparkPlace({ r0: range.r0 + i, r1: range.r0 + i, c0: range.c0, c1: range.c1 }))
      : [sparkPlace(range)];
    const fresh = made.map((m) => ({ ...m, kind }));
    const ats = new Set(fresh.map((x) => x.at));
    return { fresh, next: cleanSparks([...(sheet.sparks ?? []).filter((x) => !ats.has(x.at)), ...fresh]) };
  };
  const sparkAction = (v: string) => {
    finishEdit();
    const list = sheet.sparks ?? [];
    const here = list.find((x) => x.at === cellId(sel.r, sel.c));
    if (v === 'remove') {
      const ids = new Set<string>();
      for (let rr = range.r0; rr <= range.r1; rr++) for (let cc = range.c0; cc <= range.c1; cc++) ids.add(cellId(rr, cc));
      const left = list.filter((x) => !ids.has(x.at));
      if (left.length === list.length) { setStatus('Celulele alese nu au minigrafice'); return; }
      setSparks(left);
      setStatus('Minigraficele alese au fost scoase (Ctrl+Z le aduce înapoi)');
      return focusGrid();
    }
    const kind = v as SparkKind;
    if (!multi && here) {
      setSparks(list.map((x) => (x === here ? { ...x, kind } : x)));
      setStatus(`Minigraficul din ${here.at} e acum: ${SPARK_KINDS.find(([k]) => k === kind)?.[1]}`);
      return focusGrid();
    }
    if (!multi) { setStatus('Selectează întâi numerele (un rând sau mai multe rânduri); minigraficul apare în celula din dreapta lor'); return; }
    const { fresh, next } = sparksFor(kind);
    setSparks(next);
    setStatus(fresh.length === 1 ? `Minigrafic nou în ${fresh[0].at}, din ${fresh[0].range}` : `${fresh.length} minigrafice noi, în ${fresh[0].at} … ${fresh[fresh.length - 1].at}`);
    focusGrid();
  };
  /** Culoarea minigraficelor din zona aleasă (sau a celui din celula curentă). */
  const sparkHere = (sheet.sparks ?? []).find((x) => x.at === cellId(sel.r, sel.c));
  const sparkColor = (color: string) => {
    const list = sheet.sparks ?? [];
    const ids = new Set<string>([cellId(sel.r, sel.c)]);
    for (let rr = range.r0; rr <= range.r1; rr++) for (let cc = range.c0; cc <= range.c1; cc++) ids.add(cellId(rr, cc));
    setSparks(cleanSparks(list.map((x) => (ids.has(x.at) ? { ...x, color } : x))));
  };
  // ★ Recomandate: fereastra cu cele mai potrivite 4 grafice pentru datele alese (previzualizate), clic pe unul îl pune.
  const [recDlg, setRecDlg] = useState<{ range: string; types: ChartType[]; svgs: string[] } | null>(null);
  const openRecommended = () => {
    finishEdit();
    const g = chartRange();
    if (!g) { setStatus('Selectează întâi datele graficului (de exemplu numele în prima coloană și numerele alături)'); return; }
    const data = chartData(cells, results, styles, g);
    // Prima coloană cu numere și cap de tabel (Preț, Vânzări…): poate fi și axa X a unui grafic cu puncte sau bule.
    const xy = chartData(cells, results, styles, g, true);
    const extra = xy.where?.labels && !data.where?.labels ? recommendCharts(xy).filter(isXY) : [];
    const types = [...new Set([...extra, ...recommendCharts(data)])].slice(0, 4);
    setRecDlg({ range: rangeText(g), types, svgs: types.map((t) => chartSvg(t, '', isXY(t) ? xy : data, 260, 170)) });
  };
  /** Desenul graficului de probă din Analiză rapidă → Grafice („rec” = primul grafic recomandat); null = zona nu e bună de grafic. */
  const quickChartSvg = (key: string): string | null => {
    const g = chartRange();
    if (!g) return null;
    const data = chartData(cells, results, styles, g);
    const xy = chartData(cells, results, styles, g, true);
    const type: ChartType = key === 'rec'
      ? [...(xy.where?.labels && !data.where?.labels ? recommendCharts(xy).filter(isXY) : []), ...recommendCharts(data)][0] ?? 'col'
      : key as ChartType;
    return chartSvg(type, '', isXY(type) ? xy : data, 300, 190);
  };
  const addChart = (type: ChartType = 'col') => {
    finishEdit();
    const g = chartRange();
    if (!g) { setStatus('Selectează întâi datele graficului (de exemplu numele în prima coloană și numerele alături)'); return; }
    if (charts.length >= 20) { setStatus('O foaie poate avea cel mult 20 de grafice'); return; }
    const id = `g${Date.now().toString(36)}`;
    setCharts([...charts, { id, type, range: rangeText(g), title: '' }]);
    setShowCharts(true);
    setStatus(`Grafic nou din ${rangeText(g)}`);
    focusGrid();
  };
  // Din tabel / zonă: interogarea pornește pe tabelul din jurul cursorului (sau pe zona selectată), cu capul de tabel sus.
  // Pe foaia unei interogări, fereastra se deschide cu pașii ei, pe datele de acum ale sursei.
  const openQuery = async () => {
    finishEdit();
    if (sheet.query?.file) {
      const data = await queryFileData(sheet.query.file, sheet.query.fsheet);
      if (!data) { setStatus(`Nu pot citi fișierul sursă al interogării („${sheet.query.file}”)`); return; }
      setQueryDlg({ g: data.g, data: data.data, fsheet: data.fsheet, names: data.names, file: sheet.query.file, at: active });
      return;
    }
    if (sheet.query) {
      const data = querySource(doc.sheets, sheet.query);
      if (!data) { setStatus(`Nu mai găsesc foaia sursă a interogării („${sheet.query.src}”)`); return; }
      setQueryDlg({ g: data.g, table: sheet.query.table, data: data.t, at: active });
      return;
    }
    const t = multi ? undefined : tableAt(sheet.tables, sel.r, sel.c);
    const g = multi ? range : t ? tableDataRange(t, cells) : currentRegion(cells, sel.r, sel.c);
    if (!g || g.r1 - g.r0 < 1) { setStatus('Pune cursorul într-un tabel cu cap de tabel (cel puțin un rând de date sub el), apoi alege Din tabel / zonă'); return; }
    setQueryDlg({ g, table: t?.name, data: readQTable(cells, results, g) });
  };
  // Preluare date → Din fișier text/CSV ca interogare: fișierul (cu separatorul, zecimalele și codificarea ghicite) e sursa;
  // pașii se fac pe foaia nouă, iar Reîmprospătare totală citește din nou fișierul de pe disc (de exemplu extrasul de luna asta).
  const queryFileData = async (p: string, fsheet?: string): Promise<{ g: Range; data: QTable; fsheet?: string; names?: string[] } | null> => {
    if (/[\\/]$/.test(p)) return queryFolderData(p, fsheet);
    let f: BinaryFile;
    try { f = await api.readBinary(p, 'sheettable' as FileKind); } catch { return null; }
    return QUERY_BOOK.test(p) ? queryBookData(f, fsheet) : queryTextData(f.data);
  };
  // Din registru: foaia ținută minte (sau, prima dată, foaia deschisă în registru), cu tabelul din jurul primei celule cu date;
  // formulele din registru se calculează, ca în rezultat să ajungă valorile.
  const queryBookData = async (f: BinaryFile, fsheet?: string): Promise<{ g: Range; data: QTable; fsheet: string; names: string[] } | null> => {
    let out: import('./xlsx').XlsxImport;
    try {
      out = /\.f?ods$/i.test(f.path) ? await (await import('./ods')).readOds(f.data)
        : /\.xls[b]?$/i.test(f.path) ? await (await import('./xls')).readXls(f.data)
          : await (await import('./xlsx')).readXlsx(f.data);
    } catch { return null; }
    const key = (n: string) => n.toLocaleLowerCase('ro-RO');
    const src = (fsheet ? out.sheets.find((x) => key(x.name) === key(fsheet)) : out.sheets[out.active]) ?? out.sheets[0];
    if (!src) return null;
    let first: { r: number; c: number } | null = null;
    for (const id of Object.keys(src.cells)) {
      const rc = src.cells[id] === '' ? null : parseCellId(id);
      if (rc && (!first || rc.r < first.r || (rc.r === first.r && rc.c < first.c))) first = rc;
    }
    const g = first ? currentRegion(src.cells, first.r, first.c) : null;
    if (!g || g.r1 <= g.r0) return null;
    const res = evaluateAll(src.cells, { self: src.name, sheets: out.sheets.map((x) => ({ name: x.name, cells: x.cells })) });
    return { g, data: readQTable(src.cells, res, g), fsheet: src.name, names: out.sheets.map((x) => x.name) };
  };
  // Din dosar: toate fișierele cu tabele din dosar (și din subdosare) puse unul sub altul, cu coloana Fișier în față;
  // din registre se ia foaia aleasă (dacă o au), altfel foaia lor deschisă. Fișierele fără tabel se sar și se numără.
  const queryFolderData = async (dir: string, fsheet?: string): Promise<{ g: Range; data: QTable; fsheet?: string; names?: string[]; count: number; skipped: number } | null> => {
    const base = dir.replace(/[\\/]+$/, '');
    let list: string[];
    try { list = (await api.listTables?.(base)) ?? []; } catch { return null; }
    const parts: { name: string; t: QTable }[] = [];
    const names = new Set<string>();
    let skipped = 0;
    for (const p of list) {
      let f: BinaryFile;
      try { f = await api.readBinary(p, 'sheettable' as FileKind); } catch { skipped++; continue; }
      const d = QUERY_BOOK.test(p) ? await queryBookData(f, fsheet) : queryTextData(f.data);
      if (!d) { skipped++; continue; }
      (d as { names?: string[] }).names?.forEach((n) => names.add(n));
      parts.push({ name: p.toLowerCase().startsWith(base.toLowerCase()) ? p.slice(base.length).replace(/^[\\/]+/, '') : fileName(p), t: d.data });
    }
    if (!parts.length) return null;
    const data = combineTables(parts);
    return { g: { r0: 0, c0: 0, r1: data.rows.length, c1: data.head.length - 1 }, data, ...(fsheet ? { fsheet } : {}), ...(names.size > 1 ? { names: [...names] } : {}), count: parts.length, skipped };
  };
  const queryTextData = (bytes: Uint8Array): { g: Range; data: QTable } | null => {
    const out = importText(bytes);
    if (out.rows < 2 || out.cols < 1) return null;
    const g = { r0: 0, c0: 0, r1: out.rows - 1, c1: out.cols - 1 };
    return { g, data: readQTable(out.cells, {}, g) };
  };
  const openQueryFile = async (book?: boolean) => {
    finishEdit();
    const f = await api.importFile(book ? 'xlsx' : 'textdata');
    if (!f) return;
    const data = QUERY_BOOK.test(f.path) ? await queryBookData({ path: f.path, data: f.data }) : queryTextData(f.data);
    if (!data) { setStatus(`${fileName(f.path)} nu are un cap de tabel și cel puțin un rând de date`); return; }
    setQueryDlg({ ...data, file: f.path });
  };
  // Preluare date → Interogare din dosar: dosarul ales e sursa (calea ținută cu \ la capăt), citit din nou la Reîmprospătare totală,
  // ca fișierele adăugate între timp (de exemplu exportul lunii noi) să intre singure în rezultat.
  const openQueryFolder = async () => {
    finishEdit();
    if (!api.listTables) { setStatus('Interogarea din dosar merge doar în aplicația de pe calculator'); return; }
    const dir = await api.pickFolder('Ce dosar unesc? (toate fișierele .csv, .txt, .xlsx, .xls, .ods din el)');
    if (!dir) return;
    const key = dir.replace(/[\\/]+$/, '') + (dir.includes('\\') || !dir.includes('/') ? '\\' : '/');
    const d = await queryFolderData(key);
    if (!d) { setStatus(`Dosarul ${fileName(dir)} nu are fișiere .csv / .txt / .xlsx / .xls / .ods cu un cap de tabel și cel puțin un rând de date`); return; }
    const { count, skipped, ...rest } = d;
    setQueryDlg({ ...rest, file: key });
    setStatus(`${count} ${count === 1 ? 'fișier unit' : 'fișiere unite'}` + (skipped ? `, ${skipped} ${skipped === 1 ? 'sărit' : 'sărite'} (fără tabel)` : ''));
  };
  // Altă foaie din registrul sursă, aleasă în fereastră: pașii rămân, datele se schimbă.
  const queryFileSheet = async (name: string) => {
    const file = queryDlg?.file;
    if (!file) return;
    const d = await queryFileData(file, name);
    if (!d) { setStatus(`Foaia „${name}” nu are un tabel cu cap de tabel și cel puțin un rând de date`); return; }
    const { g, data, fsheet } = d;
    setQueryDlg((q) => (q && q.file === file ? { ...q, g, data, ...(fsheet ? { fsheet } : {}) } : q));
  };
  // Datele de acum ale sursei unei interogări: zona tabelului cu nume sau zona din jurul colțului ținut minte (cu rândurile noi).
  const querySource = (sheets: Sheet[], q: SheetQuery): { g: Range; t: QTable } | null => {
    const key = (n: string) => n.toLocaleLowerCase('ro-RO');
    const src = sheets.find((s) => key(s.name) === key(q.src));
    if (!src) return null;
    const tb = q.table ? src.tables?.find((x) => key(x.name) === key(q.table!)) : undefined;
    const cur = currentRegion(src.cells, q.range.r0, q.range.c0);
    const g = tb ? tableDataRange(tb, src.cells)
      : cur && cur.r0 === q.range.r0 && cur.c0 === q.range.c0 ? { ...q.range, r1: Math.max(cur.r1, q.range.r0), c1: Math.max(cur.c1, q.range.c1) } : q.range;
    const res = evaluateAll(src.cells, { self: src.name, sheets, names: doc.names, pivots: doc.pivots, match: doc.match, iterate: doc.iter, ext: doc.links });
    return { g, t: readQTable(src.cells, res, g) };
  };
  // Celelalte tabele pentru Îmbină / Adaugă dedesubt: un tabel cu nume (din orice foaie) sau o foaie întreagă
  // (zona din jurul primei celule cu date); citite o singură dată pe fereastră / reîmprospătare.
  const queryOther = (sheets: Sheet[]): QOther => {
    const key = (n: string) => n.toLocaleLowerCase('ro-RO');
    const memo = new Map<string, QTable | undefined>();
    const read = (src: Sheet, g: Range) => readQTable(src.cells, evaluateAll(src.cells, { self: src.name, sheets, names: doc.names, pivots: doc.pivots, match: doc.match, iterate: doc.iter, ext: doc.links }), g);
    return (name) => {
      const k = key(name);
      if (memo.has(k)) return memo.get(k);
      let out: QTable | undefined;
      for (const src of sheets) {
        const tb = src.tables?.find((x) => key(x.name) === k);
        if (tb) { out = read(src, tableDataRange(tb, src.cells)); break; }
      }
      const src = out ? undefined : sheets.find((x) => key(x.name) === k);
      if (src) {
        let first: { r: number; c: number } | null = null;
        for (const id of Object.keys(src.cells)) {
          const rc = src.cells[id] === '' ? null : parseCellId(id);
          if (rc && (!first || rc.r < first.r || (rc.r === first.r && rc.c < first.c))) first = rc;
        }
        const g = first ? currentRegion(src.cells, first.r, first.c) : null;
        if (g && g.r1 > g.r0) out = read(src, g);
      }
      memo.set(k, out);
      return out;
    };
  };
  const queryOtherFn = useMemo(() => (queryDlg ? queryOther(doc.sheets) : () => undefined), [queryDlg, doc]);
  const querySources = useMemo(() => {
    if (!queryDlg) return [];
    const self = queryDlg.at !== undefined ? doc.sheets[queryDlg.at].name : null;
    const tbs = doc.sheets.flatMap((x) => (x.tables ?? []).map((t) => t.name));
    const shs = doc.sheets.filter((x) => x.name !== self && Object.values(x.cells).some((v) => v !== '')).map((x) => x.name);
    return [...tbs, ...shs.filter((n) => !tbs.some((t) => t.toLocaleLowerCase('ro-RO') === n.toLocaleLowerCase('ro-RO')))];
  }, [queryDlg, doc]);
  const loadQuery = (steps: QStep[]) => {
    const dlg = queryDlg;
    if (!dlg) return;
    setQueryDlg(null);
    const { table: out, skipped } = runQuery(dlg.data, steps, queryOther(doc.sheets));
    const { cells: qc, styles: qs } = qTableCells(out);
    const next = [...doc.sheets];
    if (dlg.at !== undefined) {
      const old = next[dlg.at];
      next[dlg.at] = { ...old, cells: qc, styles: qs, query: { ...old.query!, ...(dlg.fsheet ? { fsheet: dlg.fsheet } : {}), range: dlg.g, steps } };
      applySheets({ sheets: next, active: dlg.at });
    } else {
      if (doc.sheets.length >= MAX_SHEETS) { setStatus(`Un tabel poate avea cel mult ${MAX_SHEETS} de foi`); return; }
      const taken = doc.sheets.some((x) => x.name.toLocaleLowerCase('ro-RO') === 'interogare');
      const name = taken ? copyName('Interogare', doc.sheets) : 'Interogare';
      next.splice(active + 1, 0, { ...emptySheet(name), cells: qc, styles: qs, query: dlg.file ? { src: fileName(dlg.file.replace(/[\\/]+$/, '')), file: dlg.file, ...(dlg.fsheet ? { fsheet: dlg.fsheet } : {}), range: dlg.g, steps } : { src: sheetName, ...(dlg.table ? { table: dlg.table } : {}), range: dlg.g, steps } });
      applySheets({ sheets: next, active: active + 1 });
    }
    setStatus(`Interogare încărcată: ${out.rows.length} ${out.rows.length === 1 ? 'rând' : 'rânduri'}, ${out.head.length} coloane. Date → Reîmprospătare totală o face din nou din datele de acum.`
      + (skipped.length ? ` Pași săriți (coloana lor nu mai există): ${skipped.join(', ')}.` : ''));
    focusGrid();
  };
  // Date → 🔗 Relații: tabelele cu nume și foile cu date pot fi legate; tabelul din model e o interogare cu pași Îmbină.
  const relOther = useMemo(() => (relDlg ? queryOther(doc.sheets) : () => undefined), [relDlg, doc]);
  const relTables = useMemo(() => {
    if (!relDlg) return [];
    const tbs = doc.sheets.flatMap((x) => (x.tables ?? []).map((t) => t.name));
    const shs = doc.sheets.filter((x) => !x.query && Object.values(x.cells).some((v) => v !== '')).map((x) => x.name);
    return [...tbs, ...shs.filter((n) => !tbs.some((t) => t.toLocaleLowerCase('ro-RO') === n.toLocaleLowerCase('ro-RO')))].filter((n) => !!relOther(n));
  }, [relDlg, doc, relOther]);
  const setRels = (rels: SheetRel[]) => {
    remember();
    setDoc((d) => { const n: SheetDoc = { ...d, rels }; if (!rels.length) delete n.rels; return n; });
    markDirty();
  };
  // Vizualizare → Macrocomenzi: înregistrarea ține fiecare schimbare a foii (applySheet) ca pas, față de celula de start.
  // Lista macrocomenzilor nu intră în Ctrl+Z (anularea ține doar foile), deci nici nu lasă acolo un pas gol.
  const setMacros = (macros: SheetMacro[]) => {
    setDoc((d) => { const n: SheetDoc = { ...d, macros }; if (!macros.length) delete n.macros; return n; });
    markDirty();
  };
  const startRec = (name: string, rel: boolean, note: string, key: string, all: boolean) => {
    finishEdit();
    setMacroDlg(null);
    setRec({ name, rel, note: note.trim(), key, all, from: { r: sel.r, c: sel.c }, sheet: sheet.name, steps: [] });
    setStatus(`Se înregistrează macrocomanda „${name}” de la ${selId}: scrie și formatează, apoi Vizualizare → ⏹ Oprește înregistrarea.`);
    focusGrid();
  };
  const stopRec = () => {
    finishEdit();
    const r = rec;
    setRec(null);
    if (!r) return;
    if (!r.steps.length) { setStatus(`Macrocomanda „${r.name}” n-a fost păstrată: nu s-a schimbat nimic în foaie cât timp s-a înregistrat.`); focusGrid(); return; }
    const m: SheetMacro = { name: r.name, rel: r.rel, steps: r.steps, from: cellId(r.from.r, r.from.c), ...(r.note ? { note: r.note } : {}), ...(r.key ? { key: r.key } : {}) };
    if (r.all) saveMine([...myMacros, m]); else setMacros([...(doc.macros ?? []), m]);
    setStatus(`Macrocomanda „${r.name}” e gata (${r.steps.length === 1 ? 'un pas' : `${r.steps.length} pași`}): ${r.key ? `Ctrl+Shift+${r.key} sau ` : ''}Vizualizare → Macrocomenzi → ▶ Rulează.`);
    focusGrid();
  };
  const playMacro = (m: SheetMacro) => {
    finishEdit();
    setMacroDlg(null);
    const at0 = { r: sel.r, c: sel.c };
    let sheets = doc.sheets.map((x, i) => (i === active ? { ...sheet, cells, styles } : x));
    let outside = 0, blocked = 0, unsorted = 0;
    for (const seg of macroSegments(m)) {
      if ('lay' in seg) {
        const { outside: o, ...lay } = runLayout(m, seg.lay, sheets[active], at0);
        outside += o;
        sheets = sheets.map((x, i) => {
          if (i !== active) return x;
          const y = { ...x, ...lay };
          if (!lay.rowH) delete y.rowH;
          if (!lay.hideRows) delete y.hideRows;
          if (!lay.hideCols) delete y.hideCols;
          return y;
        });
        continue;
      }
      if ('filt' in seg) {
        const f = filterAt(m, seg.filt, at0);
        if (f === 'out') { outside++; continue; }
        sheets = sheets.map((x, i) => {
          if (i !== active) return x;
          const y = { ...x };
          if (f) y.filter = f; else { delete y.filter; delete y.slicers; delete y.timelines; }
          return y;
        });
        continue;
      }
      if ('sort' in seg) {
        // Sortarea se face pe datele de acum: tabelul din jurul celulei (sau zona de aceeași mărime, dacă fusese aleasă de mână).
        const p = sortAt(m, seg.sort, at0);
        const sh = sheets[active];
        const z = !p ? null : seg.sort.size ? { r0: p.r, c0: p.c, r1: Math.min(ROWS - 1, p.r + seg.sort.size.h - 1), c1: Math.min(COLS - 1, p.c + seg.sort.size.w - 1) } : currentRegion(sh.cells, p.r, p.c);
        const body = z && (seg.sort.head ? { ...z, r0: z.r0 + 1 } : z);
        const levels = z ? seg.sort.levels.map((k) => ({ ...k, col: z.c0 + k.col })) : [];
        if (!z || !body || body.r1 <= body.r0 || levels.some((k) => k.col > z.c1)) { unsorted++; continue; }
        const res = evaluateAll(sh.cells, { self: sh.name, sheets, names: doc.names, pivots: doc.pivots, match: doc.match, iterate: doc.iter, ext: doc.links });
        const out = sortRangeBy(sh.cells, sh.styles, res, body, levels);
        sheets = sheets.map((x, i) => (i === active ? { ...x, cells: out.cells, styles: out.styles } : x));
        continue;
      }
      if ('ins' in seg) {
        const x = insAt(m, seg.ins, at0);
        if (x === null) { outside++; continue; }
        if (seg.ins.n > 0 && wouldPushOut(sheets[active], seg.ins.axis, seg.ins.n)) { blocked++; continue; }
        sheets = insertDelete(sheets, active, seg.ins.axis, x, seg.ins.n);
        continue;
      }
      const res = runMacro({ ...m, steps: seg.steps }, sheets[active], at0);
      outside += res.outside;
      sheets = sheets.map((x, i) => (i === active ? { ...x, cells: res.cells, styles: res.styles } : x));
    }
    if (m.steps.some((st) => st.ins)) applySheets({ sheets, active }); else applySheet(sheets[active]);
    setStatus(`Macrocomanda „${m.name}” a rulat${m.rel ? ` de la ${selId}` : ''}${outside ? `; ${outside === 1 ? 'o celulă ar fi ieșit' : `${outside} celule ar fi ieșit`} din foaie și a fost sărită` : ''}${blocked ? '; o inserare a fost sărită (datele de la capătul foii ar fi ieșit afară)' : ''}${unsorted ? '; o sortare a fost sărită (nu era un tabel de sortat acolo)' : ''} (Ctrl+Z o anulează).`);
    focusGrid();
  };
  // Căutarea de comenzi (Ctrl+K / Alt+Q): fiecare macrocomandă e o comandă, cu scurtătura ei.
  useCommands(tab, [...(doc.macros ?? []), ...myMacros].map((m) => ({ label: `Macrocomandă: ${m.name}`, keys: m.key ? `Ctrl+Shift+${m.key}` : undefined,
    hint: m.note || 'Rulează macrocomanda de la celula aleasă', run: () => playMacro(m) })), 'macros');
  const loadModel = (base: string, pick: Record<string, string[]>, pivot: boolean) => {
    const key = (n: string) => n.toLocaleLowerCase('ro-RO');
    let q: SheetQuery | null = null;
    for (const s of doc.sheets) {
      const tb = s.tables?.find((x) => key(x.name) === key(base));
      if (tb) { q = { src: s.name, table: tb.name, range: tableDataRange(tb, s.cells), steps: [] }; break; }
    }
    const bs = q ? undefined : doc.sheets.find((x) => key(x.name) === key(base));
    if (bs) {
      let first: { r: number; c: number } | null = null;
      for (const id of Object.keys(bs.cells)) {
        const rc = bs.cells[id] === '' ? null : parseCellId(id);
        if (rc && (!first || rc.r < first.r || (rc.r === first.r && rc.c < first.c))) first = rc;
      }
      const g = first ? currentRegion(bs.cells, first.r, first.c) : null;
      if (g) q = { src: bs.name, range: g, steps: [] };
    }
    const data = q && querySource(doc.sheets, q);
    if (!q || !data) { setStatus(`Nu găsesc tabelul „${base}”`); return; }
    if (doc.sheets.length >= MAX_SHEETS) { setStatus(`Un tabel poate avea cel mult ${MAX_SHEETS} de foi`); return; }
    const other = queryOther(doc.sheets);
    const steps = modelSteps(base, doc.rels ?? [], pick, other);
    const { table: out } = runQuery(data.t, steps, other);
    const { cells: qc, styles: qs } = qTableCells(out);
    const taken = doc.sheets.some((x) => key(x.name) === 'model');
    const name = taken ? copyName('Model', doc.sheets) : 'Model';
    const next = [...doc.sheets];
    next.splice(active + 1, 0, { ...emptySheet(name), cells: qc, styles: qs, query: { ...q, range: data.g, steps } });
    setRelDlg(false);
    applySheets({ sheets: next, active: active + 1 });
    if (pivot && out.rows.length && out.head.length > 1) {
      setPivotChart(false);
      setPivotTable(null);
      setPivotSrc({ r0: 0, c0: 0, r1: out.rows.length, c1: out.head.length - 1 });
    }
    setStatus(`Tabelul din model e pe foaia „${name}”: ${out.rows.length} ${out.rows.length === 1 ? 'rând' : 'rânduri'}, ${out.head.length} coloane. Date → Reîmprospătare totală îl face din nou din tabelele de acum.`);
  };
  // Rezumat: fereastra pornește pe tabelul din jurul cursorului (sau pe zona selectată), cu capul de tabel sus.
  const openPivot = (chart?: boolean) => {
    finishEdit();
    setPivotChart(chart === true);
    const t = multi ? undefined : tableAt(sheet.tables, sel.r, sel.c);
    const g = multi ? range : t ? tableDataRange(t, cells) : currentRegion(cells, sel.r, sel.c);
    setPivotTable(t ? t.name : null);
    if (!g || g.r1 - g.r0 < 1 || g.c1 === g.c0) {
      setStatus('Pune cursorul într-un tabel cu cap de tabel (cel puțin două coloane și un rând de date), apoi apasă Rezumat');
      return;
    }
    setPivotSrc(g);
  };
  const makePivot = (spec0: PivotSpec, chart?: boolean) => {
    setPivotSrc(null);
    const spec = pivotTable ? { ...spec0, table: pivotTable } : spec0;
    if (doc.sheets.length >= MAX_SHEETS) { setStatus(`Un tabel poate avea cel mult ${MAX_SHEETS} de foi`); return; }
    const taken = doc.sheets.some((x) => x.name.toLocaleLowerCase('ro-RO') === 'rezumat');
    const name = taken ? copyName('Rezumat', doc.sheets) : 'Rezumat';
    const out = buildPivot(sheet, results, spec, name);
    const next = [...doc.sheets];
    // Graficul pivot: coloane din cifrele rezumatului (fără totaluri), pe foaie, în dreapta tabelului; id-ul „pv…” îl
    // leagă de rezumat, ca la Reîmprospătare să ia noua zonă.
    next.splice(active + 1, 0, chart ? { ...out.sheet, charts: [{ id: `pv${Date.now().toString(36)}`, type: 'col', range: out.chartRange, title: '',
      at: { r: 3, c: Math.min(COLS - 1, out.lastCol + 2), dx: 0, dy: 0, w: 480, h: 300 } }] } : out.sheet);
    applySheets({ sheets: next, active: active + 1 }, out.pivot);
    setStatus(`Rezumat în foaia „${name}”: ${out.rows} ${out.rows === 1 ? 'rând' : 'rânduri'}`
      + (spec.colCol !== undefined ? ` × ${out.cols} coloane` : '')
      + (out.cut ? '. Atenție: au fost prea multe categorii, nu toate au încăput' : '')
      + '. Cifrele se schimbă singure când schimbi datele.');
  };
  // Reîmprospătare (Alt+F5 = rezumatul din foaia curentă; Ctrl+Alt+F5 / Date → Reîmprospătare totală = toate): rezumatul
  // se face din nou din tabelul sursă, cu categoriile noi și cu rândurile adăugate sub tabel. Lățimile de coloane rămân.
  // Face din nou rezumatul `def` în lista de foi `next` (pe loc), din datele de acum. `over` schimbă setări (de exemplu
  // elementele bifate la filtru), `pick` = valoarea pusă în B3 (altfel rămâne cea de acum). Întoarce definiția nouă.
  const rebuildPivot = (next: Sheet[], def: PivotDef, over?: Partial<PivotSpec>, pick?: string): PivotDef | null => {
    const key = (n: string) => n.toLocaleLowerCase('ro-RO');
    const at = next.findIndex((s) => key(s.name) === key(def.sheet));
    const src = next.find((s) => key(s.name) === key(def.make!.src));
    if (at < 0 || !src) return null;
    const res = evaluateAll(src.cells, { self: src.name, sheets: next, names: doc.names, pivots: doc.pivots, match: doc.match, iterate: doc.iter, ext: doc.links });
    const base: PivotSpec = { ...def.make!.spec, ...over };
    if (over && 'filterItems' in over && !over.filterItems?.length) delete base.filterItems;
    const { range } = base;
    // Din tabelul cu nume: zona lui de acum (cu rândurile și coloanele adăugate), fără rândul de total.
    const tn = base.table?.toLocaleLowerCase('ro-RO');
    const tb = tn ? src.tables?.find((x) => x.name.toLocaleLowerCase('ro-RO') === tn) : undefined;
    const g = tb ? tableDataRange(tb, src.cells) : currentRegion(src.cells, range.r0, range.c0);
    const spec = tb && g && g.r1 > g.r0 ? { ...base, range: g }
      : g && g.r0 === range.r0 && g.c0 === range.c0 && g.c1 >= range.c1 ? { ...base, range: { ...range, r1: Math.max(g.r1, range.r0 + 1) } } : base;
    const out = buildPivot(src, res, spec, next[at].name);
    const picked = pick ?? next[at].cells[PIVOT_FILTER_CELL];
    if (spec.filterCol !== undefined && picked && out.sheet.cells[PIVOT_FILTER_CELL]) out.sheet.cells[PIVOT_FILTER_CELL] = picked;
    const keep = next[at].charts?.map((ch) => (ch.id.startsWith('pv') ? { ...ch, range: out.chartRange } : ch));
    next[at] = { ...out.sheet, colW: { ...out.sheet.colW, ...next[at].colW }, ...(next[at].tab ? { tab: next[at].tab } : {}), ...(keep?.length ? { charts: keep } : {}),
      ...(next[at].pvSlicer && spec.filterCol !== undefined ? { pvSlicer: true } : {}), ...(next[at].pvTimeline && spec.filterCol !== undefined ? { pvTimeline: next[at].pvTimeline } : {}) };
    return out.pivot;
  };
  // Butoanele de filtrare ale rezumatului din foaia curentă (slicer legat de rezumat): câte un buton pe fiecare valoare a
  // câmpului de filtru. Clic = doar valoarea aceea (în B3), Ctrl+clic = mai multe („(Mai multe elemente)”), ⊘ = toate.
  const pivotHere = (doc.pivots ?? []).find((p) => p.make && p.sheet.toLocaleLowerCase('ro-RO') === sheetName.toLocaleLowerCase('ro-RO'));
  const pvFilter = pivotHere?.make?.spec.filterCol;
  const pvShown = !!sheet.pvSlicer && pvFilter !== undefined;
  const pvTl = pvFilter !== undefined ? sheet.pvTimeline : undefined;
  const pvVals = pvShown || pvTl ? (sheet.lists?.find((l) => l.range === PIVOT_FILTER_CELL)?.values ?? []).filter((v) => v !== PIVOT_ALL && v !== PIVOT_MULTI) : [];
  const pvB3 = cells[PIVOT_FILTER_CELL] ?? PIVOT_ALL;
  const pvPicked: string[] = pvB3 === PIVOT_MULTI ? pivotHere?.make?.spec.filterItems ?? [] : pvB3 === PIVOT_ALL ? [] : [pvB3];
  // Zilele din câmpul de filtru (din tabelul sursă), pentru cronologia rezumatului; null = câmpul nu are date calendaristice.
  const pvDates = (): number[] => {
    const make = pivotHere?.make;
    const src = make && doc.sheets.find((s) => s.name.toLocaleLowerCase('ro-RO') === make.src.toLocaleLowerCase('ro-RO'));
    return src && pvFilter !== undefined ? columnSerials(src.cells, {}, src.styles, pvFilter, make.spec.range.r0 + 1, make.spec.range.r1) : [];
  };
  const pvNum = (v: string) => Number(v.replace(',', '.'));
  // Perioada aleasă în cronologia rezumatului: de la prima la ultima zi bifată în filtru.
  const pvOn = pvTl && pvPicked.length && pvPicked.every((v) => Number.isFinite(pvNum(v)))
    ? { from: Math.min(...pvPicked.map(pvNum)), to: Math.max(...pvPicked.map(pvNum)) } : null;
  const pickPvPeriod = (pd: TimePeriod, extend: boolean) => {
    let from = pd.from, to = pd.to;
    if (extend && tlAnchor?.col === '#pv') { from = Math.min(from, tlAnchor.from); to = Math.max(to, tlAnchor.to); }
    else setTlAnchor({ col: '#pv', from: pd.from, to: pd.to });
    const items = pvVals.filter((v) => { const n = Math.floor(pvNum(v)); return n >= from && n <= to; });
    if (!items.length) { setStatus('Nicio dată în perioada aleasă'); focusGrid(); return; }
    setPivotItems(items);
  };
  const pickPivotSlice = (v: string | null, add: boolean) => {
    setPivotItems(v === null ? [] : add ? (pvPicked.includes(v) ? pvPicked.filter((x) => x !== v) : [...pvPicked, v]) : [v]);
  };
  const setPivotItems = (items0: string[]) => {
    if (!pivotHere) return;
    finishEdit();
    let items = items0;
    if (items.length === pvVals.length && pvVals.length > 1) items = [];
    const pick = items.length > 1 ? PIVOT_MULTI : items[0] ?? PIVOT_ALL;
    const had = !!pivotHere.make!.spec.filterItems?.length;
    if (items.length <= 1 && !had) applyCells({ [PIVOT_FILTER_CELL]: pick });
    else {
      // Mai multe valori: rezumatul se face din nou cu lista lor (formulele trec prin FILTER), într-un singur pas de anulare.
      const next = [...doc.sheets];
      const pv = rebuildPivot(next, pivotHere, { filterItems: items.length > 1 ? items : [] }, pick);
      if (!pv) { setStatus('Nu mai găsesc tabelul sursă al rezumatului'); focusGrid(); return; }
      remember();
      const key = (n: string) => n.toLocaleLowerCase('ro-RO');
      setDoc((d) => ({ ...d, sheets: next, pivots: [...(d.pivots ?? []).filter((p) => key(p.sheet) !== key(pivotHere.sheet)), pv] }));
      markDirty();
    }
    setStatus(items.length ? `Rezumatul arată doar: ${items.join(', ')}` : 'Rezumatul arată toate valorile');
    focusGrid();
  };
  const refreshPivots = async (all: boolean) => {
    finishEdit();
    const key = (n: string) => n.toLocaleLowerCase('ro-RO');
    const defs = (doc.pivots ?? []).filter((p) => p.make && (all || key(p.sheet) === key(sheetName)));
    const qs = doc.sheets.map((s, i) => ({ s, i })).filter(({ s }) => s.query && (all || key(s.name) === key(sheetName)));
    if (qs.length) {
      // Interogările întâi (un rezumat poate lua datele dintr-o interogare), apoi rezumatele, din aceeași listă de foi.
      const next = [...doc.sheets];
      const lostQ: string[] = [];
      // Fișierele sursă (.csv) se citesc întâi de pe disc; foile se schimbă apoi toate deodată.
      const fromFile = new Map<number, { g: Range; t: QTable } | null>();
      for (const { s, i } of qs) if (s.query!.file) { const d = await queryFileData(s.query!.file, s.query!.fsheet); fromFile.set(i, d && { g: d.g, t: d.data }); }
      for (const { s, i } of qs) {
        const src = s.query!.file ? fromFile.get(i) ?? null : querySource(next, s.query!);
        if (!src) { lostQ.push(s.name); continue; }
        const { cells: qc, styles: qst } = qTableCells(runQuery(src.t, s.query!.steps, queryOther(next)).table);
        next[i] = { ...next[i], cells: qc, styles: qst, query: { ...s.query!, range: src.g } };
      }
      let pivots = [...(doc.pivots ?? [])];
      for (const def of defs) {
        const pv = rebuildPivot(next, def);
        if (pv) pivots = [...pivots.filter((p) => key(p.sheet) !== key(def.sheet)), pv];
      }
      remember();
      setDoc((d) => ({ ...d, sheets: next, pivots }));
      markDirty();
      const n = qs.length - lostQ.length;
      setStatus((n === 1 ? 'Am reîmprospătat interogarea' : `Am reîmprospătat ${n} interogări`)
        + (defs.length ? (defs.length === 1 ? ' și rezumatul' : ` și ${defs.length} rezumate`) : '')
        + ' din datele de acum' + (lostQ.length ? `. Nu mai găsesc foaia sau fișierul sursă pentru: ${lostQ.join(', ')}` : ''));
      focusGrid(); return;
    }
    if (!defs.length) {
      setStatus(all ? 'Registrul nu are rezumate făcute cu Inserare → Tabel Pivot' : 'Foaia aceasta nu e un rezumat făcut cu Inserare → Tabel Pivot');
      focusGrid(); return;
    }
    const next = [...doc.sheets];
    let pivots = [...(doc.pivots ?? [])], done = 0;
    const lost: string[] = [];
    for (const def of defs) {
      const pv = rebuildPivot(next, def);
      if (!pv) { lost.push(def.sheet); continue; }
      pivots = [...pivots.filter((p) => key(p.sheet) !== key(def.sheet)), pv];
      done++;
    }
    if (done) {
      remember();
      setDoc((d) => ({ ...d, sheets: next, pivots }));
      markDirty();
    }
    setStatus((done === 1 ? 'Am reîmprospătat rezumatul din datele de acum' : done ? `Am reîmprospătat ${done} rezumate din datele de acum` : 'Niciun rezumat reîmprospătat')
      + (lost.length ? `. Nu mai găsesc tabelul sursă pentru: ${lost.join(', ')}` : ''));
    focusGrid();
  };

  // Formatează ca tabel: cap colorat, rânduri alternate, filtru și rând de total, într-un singur pas de anulare.
  // Rândul de total: celula cu =SUBTOTAL(…) poate calcula sumă, medie, număr, minim sau maxim.
  const selTotal = edit === null ? subtotalOf(cells[selId]) : null;
  const setTotalFn = (code: number) => {
    if (!selTotal) return;
    const st = styles[selId] ?? {};
    // Numărul de rânduri nu e o sumă de bani: scoatem formatul lei / procent; la celelalte îl păstrăm.
    const { fmt: _fmt, dec: _dec, ...plain } = st;
    applyCells({ [selId]: `=SUBTOTAL(${code};${selTotal.area})` }, code === 3 ? { [selId]: plain } : {});
    setStatus(`Totalul din ${selId} calculează acum: ${TOTAL_FNS.find(([c]) => c === code)?.[1].toLowerCase()}`);
    focusGrid();
  };

  // Fereastra „▤ Tabel…”: culoarea și părțile tabelului (opțiunile de stil), ținute minte pentru tabelul următor.
  const [tblDlg, setTblDlg] = useState<{ theme: TableTheme; opts: TableOpts } | null>(null);
  // Proiectare tabel → ＋ Stil de tabel nou…: numele și culorile stilului propriu (gol = fără culoarea aceea).
  const [tsDlg, setTsDlg] = useState<CustomTableLook | null>(null);
  // Fereastra „Foaie de prognoză”: datele alese și opțiunile (perioade, încredere, sezon, goluri, dubluri, statistici).
  const [fcDlg, setFcDlg] = useState<{ names: string[]; rows: number[][]; dropped: number; tStyle?: CellStyle; k: string; conf: string; season: 'auto' | 'none' | 'manual'; seasonN: string; fill: number; agg: number; stats: boolean } | null>(null);
  const lastTable = useRef<{ theme: TableTheme; opts: TableOpts }>({ theme: 'blue', opts: DEFAULT_TABLE_OPTS });
  // Inserare → Tabel (Ctrl+L): ca în programele cunoscute, fără rând de total la început (se bifează în fereastră).
  const newTableDlg = () => ({ ...lastTable.current, opts: { ...lastTable.current.opts, total: false } });
  /** Deschide fereastra stilului propriu, cu culorile stilului de acum (al tabelului) ca punct de plecare. */
  const openTableStyle = (from: TableTheme) => {
    const th = TABLE_THEMES[from] ?? TABLE_THEMES.blue;
    const n = (doc.tableStyles?.length ?? 0) + 1;
    setTsDlg({ label: isCustomTheme(from) ? th.label : `Stilul meu de tabel ${n}`, head: th.head, ink: th.ink, band: th.band, body: th.body, total: th.total, line: th.line, grid: th.grid });
  };
  /** Salvează stilul propriu în registru (același nume = îl înlocuiește) și îl pune pe tabelul cu cursorul. */
  const saveTableStyle = (look: CustomTableLook) => {
    const label = look.label.trim().replace(/[<>&"]/g, '').slice(0, 60);
    if (!label) { setStatus('Stilul de tabel are nevoie de un nume.'); return; }
    if (/^TableStyle/i.test(label)) { setStatus('Numele e folosit de stilurile gata făcute; alege altul.'); return; }
    const clean: CustomTableLook = { label, head: look.head, band: look.band, total: look.total };
    if (look.ink) clean.ink = look.ink;
    if (look.body) clean.body = look.body;
    if (look.line) clean.line = look.line;
    if (look.line && look.grid) clean.grid = look.grid;
    const st = { id: customStyleId(clean), ...clean };
    registerTableStyles([st]);
    setDoc((d) => ({ ...d, tableStyles: [...(d.tableStyles ?? []).filter((x) => x.label.toLocaleLowerCase('ro') !== label.toLocaleLowerCase('ro')), st].slice(-50) }));
    setTsDlg(null);
    if (curTable) makeTable(st.id, { ...curTable.opts, total: false }, tableArea(curTable));
    setStatus(`Stilul de tabel „${label}” e gata; îl găsești la capătul galeriei Stiluri tabel.`);
  };
  /** Scoate stilul propriu din registru (după cheie și după nume: după Ctrl+Z tabelul poate avea varianta dinainte a stilului); tabelul cu cursorul trece pe stilul albastru (ceilalți își păstrează culorile din celule). */
  const deleteTableStyle = (id: TableTheme) => {
    const label = TABLE_THEMES[id]?.label ?? '';
    setDoc((d) => { const n: SheetDoc = { ...d, tableStyles: (d.tableStyles ?? []).filter((x) => x.id !== id && x.label.toLocaleLowerCase('ro') !== label.toLocaleLowerCase('ro')) }; if (!n.tableStyles?.length) delete n.tableStyles; return n; });
    if (curTable) makeTable('blue', { ...curTable.opts, total: false }, tableArea(curTable));
    setStatus(`Stilul de tabel „${label}” s-a șters din registru.`);
  };
  const makeTable = (theme: TableTheme = 'blue', opts: TableOpts = DEFAULT_TABLE_OPTS, area?: Range) => {
    finishEdit();
    const g = area ?? (multi ? range : currentRegion(cells, sel.r, sel.c));
    if (!g || g.r1 <= g.r0) { setStatus('Pune cursorul într-un tabel (cap de tabel și cel puțin un rând de date), apoi apasă Tabel'); return; }
    lastTable.current = { theme, opts };
    const out = formatAsTable(cells, styles, results, g, theme, opts);
    const nextCells = { ...cells, ...out.cells };
    const nextStyles = { ...styles };
    for (const [id, st] of Object.entries(out.styles)) {
      if (Object.keys(st).length) nextStyles[id] = st; else delete nextStyles[id];
    }
    const next: Sheet = { ...sheet, cells: nextCells, styles: nextStyles };
    // Filtrul stă pe cap; fără cap sau fără filtru, filtrul acestui tabel se scoate.
    if (opts.head && opts.filter) next.filter = { r: g.r0, c0: g.c0, c1: Math.min(g.c1, g.c0 + 25), hidden: {} };
    else if (sheet.filter && sheet.filter.r === g.r0) delete next.filter;
    if (g.r0 === 0 && opts.head && !sheet.freeze) next.freeze = 1;
    // Tabelul cu nume: dacă zona atinge un tabel existent, îl înlocuiește (cu același nume); altfel primește TabelN.
    const old = (sheet.tables ?? []).find((t) => t.r0 <= g.r1 && g.r0 <= t.r1 && t.c0 <= g.c1 && g.c0 <= t.c1);
    const tname = old?.name ?? nextTableName(doc.sheets.flatMap((s) => (s.tables ?? []).map((t) => t.name)));
    next.tables = [...(sheet.tables ?? []).filter((t) => t !== old), { name: tname, r0: g.r0, c0: g.c0, r1: g.r1, c1: g.c1, theme, opts: { ...opts }, ...(old?.style && old.style !== 'TableStyleNone' ? { style: old.style } : {}) }];
    applySheet(next);
    const parts = [opts.head ? 'cap de tabel' : '', opts.bandRows ? 'rânduri alternate' : '', opts.bandCols ? 'coloane alternate' : '', opts.firstCol ? 'prima coloană aldină' : '', opts.lastCol ? 'ultima coloană aldină' : '', opts.head && opts.filter ? 'filtru (▾)' : ''].filter(Boolean);
    setStatus(`${tname} (${rangeText(g)}): ${parts.length ? parts.join(', ') : 'fără culori'}`
      + (out.totalRow !== null ? `; rândul ${out.totalRow + 1} are totalul${out.summed.length ? ` pe ${out.summed.join(', ')}` : ''}` : '')
      + '. Ctrl+Z anulează.');
    focusGrid();
  };
  // Fila contextuală „Proiectare tabel”: tabelul cu nume în care e cursorul.
  const curTable = tableAt(sheet.tables, sel.r, sel.c);
  const tableArea = (t: SheetTable): Range => ({ r0: t.r0, c0: t.c0, r1: t.r1, c1: t.c1 });
  const renameTable = (t: SheetTable, name: string) => {
    const n = name.trim();
    if (n === t.name) return;
    if (!validTableName(n)) { setStatus(`„${n}” nu poate fi nume de tabel: începe cu o literă, fără spații și semne, și nu arată ca o celulă (de exemplu Vânzări_2026)`); return; }
    const taken = doc.sheets.some((s) => (s.tables ?? []).some((x) => x !== t && x.name.toLowerCase() === n.toLowerCase())) || (doc.names ?? []).some((d) => d.name.toLowerCase() === n.toLowerCase());
    if (taken) { setStatus(`Numele „${n}” e deja folosit`); return; }
    applySheet({ ...sheet, tables: (sheet.tables ?? []).map((x) => (x === t ? { ...x, name: n } : x)) });
    setStatus(`Tabelul se numește acum „${n}”`);
  };
  const unTable = (t: SheetTable) => {
    const left = (sheet.tables ?? []).filter((x) => x !== t);
    const next: Sheet = { ...sheet };
    if (left.length) next.tables = left; else delete next.tables;
    applySheet(next);
    setStatus(`${t.name} e acum o zonă obișnuită (culorile rămân; Ctrl+Z anulează)`);
  };

  // Reguli de evidențiere: se adaugă pe zona selectată și se pot șterge din fereastră (Ctrl+Z le aduce înapoi).
  const setRules = (next: SheetRule[]) => {
    const s = { ...sheet };
    if (next.length) s.rules = next.slice(-MAX_RULES); else delete s.rules;
    applySheet(s);
  };
  const addRule = (rule: SheetRule) => {
    setRules([...(rules ?? []), rule]);
    setStatus(`Evidențiere nouă: ${describeRule(rule)}`);
  };
  const openCond = (op: true | CondOp) => { finishEdit(); setCondDlg(op); };
  // Regulile fără valoare (dubluri, peste medie, bare, scale, pictograme) se pun direct pe selecție, din meniu.
  const quickRule = (op: CondOp, look: CondLook) => {
    finishEdit();
    if ((rules ?? []).length >= MAX_RULES) { setStatus(`Foaia are deja ${MAX_RULES} reguli de evidențiere`); return; }
    addRule({ range: rangeText(range), op, v1: '', look });
    focusGrid();
  };
  // Golire reguli: doar cele care ating selecția, sau toate din foaie.
  const clearRules = (inSel: boolean) => {
    finishEdit();
    const all = rules ?? [];
    const keep = inSel ? all.filter((r) => { const g = parseRangeText(r.range); return !g || !allRanges.some((s) => overlaps(g, s)); }) : [];
    const gone = all.length - keep.length;
    if (!gone) { setStatus(inSel ? 'În celulele selectate nu e nicio regulă de evidențiere' : 'Foaia nu are reguli de evidențiere'); return; }
    setRules(keep);
    setStatus(`Am scos ${gone === 1 ? 'o regulă' : gone + ' reguli'} de evidențiere (Ctrl+Z le aduce înapoi)`);
    focusGrid();
  };

  // ⚡ Analiză rapidă (Ctrl+Q sau butonul de lângă colțul zonei): evidențieri, grafice, totaluri, tabel, minigrafice (quick.ts).
  const [qa, setQa] = useState<{ x: number; y: number; tab: QuickTab } | null>(null);
  // Fila folosită ultima dată: fereastra se redeschide pe ea.
  const qaTab = useRef<QuickTab>('fmt');
  const openQuick = (x?: number, y?: number) => {
    finishEdit();
    if (!multi) { setStatus('Analiză rapidă: selectează întâi o zonă cu date (de exemplu un tabel cu cap)'); return; }
    if (x === undefined || y === undefined) {
      const b = document.querySelector('.sheet-grid .fill-handle, .fill-handle')?.getBoundingClientRect();
      x = b ? b.right : window.innerWidth / 2 - 180;
      y = b ? b.bottom + 4 : window.innerHeight / 3;
    }
    setQa({ x: Math.max(8, Math.min(x, window.innerWidth - 400)), y: Math.max(8, Math.min(y, window.innerHeight - 190)), tab: qaTab.current });
  };
  /** Regulile foii după evidențierea „key” din fila Formatare (aceeași pentru clic și pentru previzualizare); null = zona n-are numere. */
  const quickFmtRules = (key: string): SheetRule[] | null => {
    const all = sheet.rules ?? [];
    const np = numericPart(range, numLook());
    const zone = (g: Range) => `${cellId(g.r0, g.c0)}:${cellId(g.r1, g.c1)}`;
    if (key === 'clear') return all.filter((x) => { const g = parseRangeText(x.range); return !(g && g.r0 >= range.r0 && g.r1 <= range.r1 && g.c0 >= range.c0 && g.c1 <= range.c1); });
    if (key === 'dup') return [...all, { range: zone({ ...range, r0: np && range.r1 > range.r0 ? np.r0 : range.r0 }), op: 'dup', v1: '', look: 'red' }];
    if (!np) return null;
    const op = key as SheetRule['op'];
    return [...all, { range: zone(np), op, v1: op === 'top' ? '10' : '', look: op === 'databar' ? 'blue' : 'green' }];
  };
  /** Ce pune un buton din fila Totaluri: formulele noi și, la % din total, formatul procent al celulelor lor. */
  const quickTotalPatch = (key: string): { patch: Record<string, string>; pct: Styles } => {
    const look = numLook(), np = numericPart(range, look);
    if (key === 'pct' || key === 'run') {
      const patch = np ? colShares(np, look, key) : {};
      const pct: Styles = key === 'pct' ? Object.fromEntries(Object.keys(patch).map((id) => [id, { ...(styles[id] ?? {}), fmt: 'percent', dec: 1 } as CellStyle])) : {};
      return { patch, pct };
    }
    if (key === 'row') return { patch: np ? rowTotals(np, look) : {}, pct: {} };
    return { patch: autoFill(range, look, key as AutoFn), pct: {} };
  };
  // Totalurile de probă se arată doar în desenul rândurilor (qaCells), nu în datele foii, ca restul calculelor să nu le vadă.
  const [qaCells, setQaCells] = useState<{ cells: Record<string, string>; results: Record<string, Result>; styles: Styles } | null>(null);
  // Graficul de probă se arată lângă fereastră (nu pe foaie), cât mouse-ul stă pe un buton din fila Grafice.
  const [qaChart, setQaChart] = useState<string | null>(null);
  const quickPreview = (tab: QuickTab, key: string | null) => {
    setQaPrev(tab === 'fmt' && key ? quickFmtRules(key) : null);
    setQaSparks(tab === 'spark' && key && SPARK_KINDS.some(([k]) => k === key) ? sparksFor(key as SparkKind).next : null);
    setQaChart(tab === 'chart' && key ? quickChartSvg(key) : null);
    // Tabel: culorile capului, benzile și rândul de total de probă, cu stilul folosit ultima dată (ca la clic).
    const tbl = tab === 'table' && key === 'table' && range.r1 > range.r0 ? formatAsTable(cells, styles, results, range, lastTable.current.theme, lastTable.current.opts) : null;
    if (tbl) {
      const st: Styles = { ...styles };
      for (const [id, s] of Object.entries(tbl.styles)) { if (Object.keys(s).length) st[id] = s; else delete st[id]; }
      if (!Object.keys(tbl.cells).length) { setQaCells({ cells, results, styles: st }); return; }
      const all = { ...cells, ...tbl.cells };
      const book = { self: sheetName, sheets: doc.sheets, names: doc.names, pivots: doc.pivots, match: doc.match, iterate: doc.iter, ext: doc.links };
      setQaCells({ cells: all, results: { ...results, ...evaluateAll(all, book, hidden.size ? hidden : undefined, Object.keys(tbl.cells)) }, styles: st });
      return;
    }
    const t = tab === 'total' && key ? quickTotalPatch(key) : null;
    if (!t || !Object.keys(t.patch).length) { setQaCells(null); return; }
    const all = { ...cells, ...t.patch };
    const book = { self: sheetName, sheets: doc.sheets, names: doc.names, pivots: doc.pivots, match: doc.match, iterate: doc.iter, ext: doc.links };
    setQaCells({ cells: all, results: { ...results, ...evaluateAll(all, book, hidden.size ? hidden : undefined, Object.keys(t.patch)) }, styles: { ...styles, ...t.pct } });
  };
  const quickEnd = () => { setQaPrev(null); setQaCells(null); setQaSparks(null); setQaChart(null); };
  const quickDo = (tab: QuickTab, key: string) => {
    setQa(null);
    quickEnd();
    qaTab.current = tab;
    const look = numLook();
    const np = numericPart(range, look);
    if (tab === 'fmt') {
      const all = sheet.rules ?? [];
      if (key === 'clear') {
        const left = quickFmtRules(key) ?? all;
        if (left.length === all.length) setStatus('Zona aleasă nu are evidențieri');
        else { setRules(left); setStatus(`Am scos ${all.length - left.length === 1 ? 'o evidențiere' : `${all.length - left.length} evidențieri`} (Ctrl+Z le aduce înapoi)`); }
        return focusGrid();
      }
      const next = quickFmtRules(key);
      if (!next) { setStatus('În zona aleasă nu sunt numere'); return focusGrid(); }
      addRule(next[next.length - 1]);
      return focusGrid();
    }
    if (tab === 'chart') return key === 'rec' ? openRecommended() : addChart(key as ChartType);
    if (tab === 'total') {
      if (key === 'pct' || key === 'run') {
        const { patch, pct } = quickTotalPatch(key);
        if (!Object.keys(patch).length) { setStatus('Sub zonă nu e loc liber sau zona nu are numere'); return focusGrid(); }
        applyCells(patch, pct);
        setStatus(`${key === 'pct' ? '% din total' : 'Total cumulat'} în ${Object.keys(patch).join(', ')}`);
        return focusGrid();
      }
      if (key !== 'row') return autoSum(key as AutoFn);
      const patch = np ? rowTotals(np, look) : {};
      if (!Object.keys(patch).length) { setStatus('În zona aleasă nu sunt numere de adunat pe rânduri (sau coloana din dreapta e deja scrisă)'); return focusGrid(); }
      applyCells(patch);
      setStatus(`Totalul pe rând în ${Object.keys(patch)[0]}${Object.keys(patch).length > 1 ? ` … ${Object.keys(patch).pop()}` : ''}`);
      return focusGrid();
    }
    if (tab === 'table') return key === 'pivot' ? openPivot() : makeTable();
    sparkAction(key);
  };

  // Liste derulante pe zona selectată (sau doar pe celula activă).
  const lists = sheet.lists ?? [];
  const selList = listAt(lists, sel.r, sel.c);
  // Încercuiește datele nevalide: celulele care nu respectă validarea, încercuite cu roșu până apeși din nou butonul.
  const [circle, setCircle] = useState(false);
  const badRows = useMemo(() => {
    const m = new Map<number, number[]>();
    if (!circle) return m;
    for (const id of invalidCells(sheet.lists, cells, (x) => (cells[x]?.startsWith('=') ? results[x]?.text ?? '' : cells[x] ?? ''), (l, id, f) => customOk(l, id, f))) {
      const p = parseCellId(id);
      if (p) m.set(p.r, [...(m.get(p.r) ?? []), p.c]);
    }
    return m;
  }, [circle, sheet.lists, cells, results]);
  // Urmărirea formulelor: celulele folosite de formula celulei alese (albastru) sau celulele care o folosesc (verde), până la ✕.
  const [trace, setTrace] = useState<{ id: string; kind: 'p' | 'd' } | null>(null);
  const traceIds = useMemo(() => {
    const out = new Set<string>();
    if (!trace) return out;
    const at = parseCellId(trace.id);
    if (!at) return out;
    if (trace.kind === 'p') {
      for (const g of formulaRanges(cells[trace.id] ?? '')) for (let r = g.r0; r <= Math.min(g.r1, g.r0 + 2000); r++) for (let c = g.c0; c <= Math.min(g.c1, g.c0 + 200); c++) out.add(cellId(r, c));
    } else {
      for (const [id, v] of Object.entries(cells)) {
        if (!v.startsWith('=')) continue;
        if (formulaRanges(v).some((g) => at.r >= g.r0 && at.r <= g.r1 && at.c >= g.c0 && at.c <= g.c1)) out.add(id);
      }
    }
    return out;
  }, [trace, cells]);
  const traceRows = useMemo(() => {
    const m = new Map<number, number[]>();
    for (const id of traceIds) { const p = parseCellId(id); if (p) m.set(p.r, [...(m.get(p.r) ?? []), p.c]); }
    return m;
  }, [traceIds]);
  // 👁 Urmărire valori (ca Fereastra de urmărire): celule alese, din orice foaie, cu valoarea și formula lor la zi.
  const [watch, setWatch] = useState<{ sheet: string; id: string }[]>([]);
  const [watchOpen, setWatchOpen] = useState(false);
  // ⚠ Erori: panoul cu formulele care dau eroare pe foaia curentă (se calculează doar cât e deschis).
  const [errOpen, setErrOpen] = useState(false);
  const errRep = useMemo(() => (errOpen ? sheetErrors(cells, results) : null), [errOpen, cells, results]);
  // 🔍 Evaluează formula (ca Evaluate Formula): pașii calculului formulei din celula aleasă, de la celule la valoarea finală.
  const [evalWin, setEvalWin] = useState<{ id: string; steps: string[] } | null>(null);
  const doEvaluate = () => {
    const raw = cells[selId] ?? '';
    if (!raw.startsWith('=')) { setStatus('Celula aleasă nu are formulă. Alege o celulă cu formulă și apasă din nou 🔍 Evaluează.'); return; }
    const book = { self: sheetName, sheets: doc.sheets, names: doc.names, pivots: doc.pivots, match: doc.match, iterate: doc.iter, ext: doc.links };
    // Bucățile se calculează într-o celulă de lucru goală, cu aceleași celule și foi.
    const tmp = cells[cellId(ROWS - 1, COLS - 1)] === undefined ? cellId(ROWS - 1, COLS - 1) : cellId(ROWS - 1, COLS - 2);
    const evalExpr = (expr: string) => literalOf(evaluateAll({ ...cells, [tmp]: '=' + expr }, book, undefined, [tmp])[tmp]);
    setEvalWin({ id: selId, steps: formulaSteps(raw, evalExpr) });
  };
  const watchRows = useMemo(() => {
    if (!watchOpen) return [];
    return watch.map((w) => {
      if (w.sheet === sheetName) return { ...w, raw: cells[w.id] ?? '', text: cellText(cells[w.id], results[w.id], styles[w.id]) };
      const sh = doc.sheets.find((x) => x.name === w.sheet);
      if (!sh) return { ...w, raw: '', text: '(foaia nu mai există)' };
      const raw = sh.cells[w.id] ?? '';
      let res;
      try { res = raw.startsWith('=') ? evaluateAll(sh.cells, { self: sh.name, sheets: doc.sheets, names: doc.names, pivots: doc.pivots, match: doc.match, iterate: doc.iter, ext: doc.links }, undefined, [w.id])[w.id] : undefined; } catch { res = undefined; }
      return { ...w, raw, text: cellText(raw, res, sh.styles[w.id]) };
    });
  }, [watchOpen, watch, sheetName, cells, results, styles, doc.sheets, doc.names, doc.pivots, doc.match, doc.iter]);
  const addWatch = () => {
    finishEdit();
    const ids: string[] = [];
    for (let r = range.r0; r <= Math.min(range.r1, range.r0 + 49); r++) for (let c = range.c0; c <= Math.min(range.c1, range.c0 + 19); c++) ids.push(cellId(r, c));
    const add = ids.filter((id) => !watch.some((w) => w.sheet === sheetName && w.id === id)).map((id) => ({ sheet: sheetName, id }));
    setWatch([...watch, ...add].slice(0, 100));
    setWatchOpen(true);
    focusGrid();
  };
  const doTrace = (kind: 'p' | 'd') => {
    finishEdit();
    const id = cellId(sel.r, sel.c);
    if (kind === 'p' && !(cells[id] ?? '').startsWith('=')) { setTrace(null); setStatus(`${id} nu are formulă: nu folosește alte celule`); focusGrid(); return; }
    setTrace({ id, kind });
    focusGrid();
  };
  useEffect(() => {
    if (!trace) return;
    const n = traceIds.size;
    const list = [...traceIds].slice(0, 12).join(', ') + (n > 12 ? ' …' : '');
    setStatus(trace.kind === 'p'
      ? (n ? `${trace.id} folosește ${n === 1 ? 'celula' : n + ' celule'} (în albastru): ${list}` : `Formula din ${trace.id} nu folosește celule din această foaie`)
      : (n ? `${n === 1 ? 'O formulă folosește' : n + ' formule folosesc'} ${trace.id} (în verde): ${list}` : `Nicio formulă din foaie nu folosește ${trace.id}`));
  }, [trace, traceIds]);

  // Mesajul de la validarea datelor („Scrie suma în lei”), arătat sub celula selectată, ca în Excel.
  const [promptPos, setPromptPos] = useState<{ x: number; y: number } | null>(null);
  const selPrompt = !multi && edit === null ? selList?.prompt ?? null : null;
  useEffect(() => {
    if (!selPrompt) { setPromptPos(null); return; }
    const td = gridRef.current?.querySelector(`tr[data-r="${sel.r}"]`)?.children[sel.c + 1] as HTMLElement | undefined;
    const b = td?.getBoundingClientRect();
    setPromptPos(b ? { x: b.left + 8, y: b.bottom + 4 } : null);
  }, [selPrompt, sel.r, sel.c]);
  // Regula cu formulă: formula (scrisă pentru prima celulă a zonei) se mută la celula verificată și se calculează
  // cu valoarea nouă pusă în celulă; ADEVĂRAT sau un număr diferit de 0 = se primește (ca în Excel).
  const customOk = (list: SheetList, id: string, f: string, value?: string): boolean => {
    const o = listOrigin(list), m = /^([A-Z]+)([0-9]+)$/.exec(id);
    const p = m ? { r: Number(m[2]) - 1, c: [...m[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1 } : null;
    if (!o || !p || !f.trim()) return true;
    const src = f.trim().startsWith('=') ? f.trim() : '=' + f.trim();
    const book = { self: sheetName, sheets: doc.sheets, names: doc.names, pivots: doc.pivots, match: doc.match, iterate: doc.iter, ext: doc.links };
    const cells2 = value === undefined ? cells : { ...cells, [id]: value.trim() };
    try { return formulaMatches(shiftFormula(src, p.r - o.r, p.c - o.c), { r0: p.r, r1: p.r, c0: p.c, c1: p.c }, cells2, book).length > 0; } catch { return true; }
  };
  const saveList = (values: string[], kind?: CodeKind, extra: { rule?: ValRule; prompt?: ValMsg; error?: ValError } = {}) => {
    setListDlg(false);
    const g = rangeText(range);
    const s = { ...sheet };
    if (kind) {
      s.lists = setList(lists, g, [], kind, extra);
      setStatus(`Pe ${g} se primesc acum doar coduri ${codeName(kind)} corecte`);
    } else if (extra.rule) {
      s.lists = setList(lists, g, [], undefined, extra);
      setStatus(`Pe ${g} se primește acum doar ${describeValRule(extra.rule)}`);
    } else if (values.length || extra.prompt) {
      s.lists = setList(lists, g, values, undefined, extra);
      setStatus(values.length ? `Listă pusă pe ${g}: ${values.length} ${values.length === 1 ? 'valoare' : 'valori'}. Alege din ▾ sau apasă Alt+↓ în celulă` : `Mesaj pus pe ${g}: apare când selectezi celula`);
    } else {
      const out = removeLists(lists, g);
      if (!out.removed.length) { focusGrid(); return; }
      if (out.lists.length) s.lists = out.lists; else delete s.lists;
      setStatus(`Lista de pe ${out.removed.join(', ')} a fost scoasă (valorile din celule rămân)`);
    }
    applySheet(s);
    focusGrid();
  };
  const openPick = (r: number, c: number, fromColumn = false) => {
    finishEdit();
    let vals: string[] | undefined;
    if (!hasValues(listAt(lists, r, c))) {
      if (!fromColumn) return;
      // Textele deja scrise în coloană (fără numere și formule), o dată fiecare, în ordine alfabetică.
      const seen = new Set<string>();
      for (let i = 0; i <= Math.min(usedR, 20000); i++) { const v = (cells[cellId(i, c)] ?? '').trim(); if (i !== r && v && !v.startsWith('=') && !isNumber(v)) seen.add(v); }
      vals = [...seen].sort((a, b) => a.localeCompare(b, 'ro')).slice(0, 500);
      if (!vals.length) { setStatus('În coloana aceasta nu e niciun text de ales'); return; }
    }
    const td = gridRef.current?.querySelector(`tr[data-r="${r}"]`)?.children[c + 1] as HTMLElement | undefined;
    const b = td?.getBoundingClientRect();
    setPick({ r, c, x: b ? b.left : 100, y: b ? b.bottom + 2 : 100, vals });
  };
  const choose = (v: string) => {
    if (!pick) return;
    const id = cellId(pick.r, pick.c);
    setPick(null);
    applyCells({ [id]: v });
    focusGrid();
  };

  // Tipărire: setările foii (cu valorile implicite) și zona care iese pe hârtie.
  const printSet = { ...DEFAULT_PRINT, ...sheet.print };
  const setPrint = (patch: Partial<SheetPrint>) => {
    const p: SheetPrint = { ...sheet.print, ...patch };
    if (!p.area) delete p.area;
    if (!p.header) delete p.header;
    if (!p.footer) delete p.footer;
    setSheet({ ...sheet, print: p });
  };
  // Sfârșit de pagină (ca Aspect pagină → Întreruperi): pagina nouă începe cu rândul selectat; încă o apăsare îl scoate.
  const toggleBreak = () => {
    finishEdit();
    const r = sel.r;
    if (r === 0) { setStatus('Pe primul rând nu se poate pune sfârșit de pagină: alege rândul cu care vrei să înceapă pagina nouă'); focusGrid(); return; }
    const cur = sheet.print?.breaks ?? [];
    const has = cur.includes(r);
    const next = has ? cur.filter((x) => x !== r) : [...cur, r].sort((a, b) => a - b);
    remember();
    const p: SheetPrint = { ...sheet.print, breaks: next };
    if (!next.length) delete p.breaks;
    setSheet({ ...sheet, print: Object.keys(p).length ? p : undefined });
    setStatus(has ? `Sfârșitul de pagină de deasupra rândului ${r + 1} a fost scos` : `La tipărire, rândul ${r + 1} începe o pagină nouă (linia punctată)`);
    focusGrid();
  };
  // Sfârșit de pagină pe coloane: pagina alăturată nouă începe cu coloana selectată; încă o apăsare îl scoate.
  const toggleColBreak = (want?: boolean) => {
    finishEdit();
    const c = sel.c;
    if (c === 0) { setStatus('Pe prima coloană nu se poate pune sfârșit de pagină: alege coloana cu care vrei să înceapă pagina nouă'); focusGrid(); return; }
    const cur = sheet.print?.colBreaks ?? [];
    const has = cur.includes(c);
    if (want === true && has) { setStatus(`Înaintea coloanei ${colName(c)} e deja o întrerupere de pagină`); return; }
    if (want === false && !has) { setStatus(`Înaintea coloanei ${colName(c)} nu e nicio întrerupere de pagină`); return; }
    const next = has ? cur.filter((x) => x !== c) : [...cur, c].sort((a, b) => a - b);
    remember();
    const p: SheetPrint = { ...sheet.print, colBreaks: next };
    if (!next.length) delete p.colBreaks;
    setSheet({ ...sheet, print: Object.keys(p).length ? p : undefined });
    setStatus(has ? `Sfârșitul de pagină dinaintea coloanei ${colName(c)} a fost scos` : `La tipărire, coloana ${colName(c)} începe o pagină alăturată nouă`);
    focusGrid();
  };
  // În Examinare sfârșit de pagină liniile de pagină se trag cu mouse-ul: linia trasă devine sfârșit de mână,
  // iar un sfârșit de mână tras în afara zonei tipărite dispare.
  const pbDrag = useRef<{ kind: 'r' | 'c'; from: number; to: number; manual: boolean } | null>(null);
  const pbLine = useRef<HTMLDivElement>(null);
  const colAtX = (table: HTMLTableElement, x: number) => {
    const ths = table.tHead?.rows[0]?.cells;
    if (!ths) return null;
    for (let i = 1; i < ths.length; i++) { const b = ths[i].getBoundingClientRect(); if (b.width > 0 && x >= b.left && x < b.right) return i - 1; }
    return null;
  };
  const breakAt = (table: HTMLTableElement, target: EventTarget | null, x: number, y: number): { kind: 'r' | 'c'; at: number; manual: boolean } | null => {
    const td = (target as HTMLElement | null)?.closest?.('td, th') as HTMLTableCellElement | null;
    const tr = td?.parentElement as HTMLTableRowElement | null;
    if (!td || !tr) return null;
    const b = td.getBoundingClientRect();
    if (tr.dataset.r && (tr.classList.contains('auto-break') || tr.classList.contains('page-break')) && y - b.top <= 5) return { kind: 'r', at: +tr.dataset.r, manual: tr.classList.contains('page-break') };
    if (td.tagName === 'TD' && (td.classList.contains('pv-col') || td.classList.contains('col-break')) && x - b.left <= 5) {
      const c = colAtX(table, b.left + Math.min(6, b.width / 2));
      if (c !== null) return { kind: 'c', at: c, manual: td.classList.contains('col-break') };
    }
    return null;
  };
  const pbTarget = (table: HTMLTableElement, kind: 'r' | 'c', x: number, y: number) => {
    if (kind === 'c') return colAtX(table, x);
    const tr = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest('tr[data-r]') as HTMLTableRowElement | null;
    if (!tr) return null;
    const b = tr.getBoundingClientRect();
    return +tr.dataset.r! + (y > b.top + b.height / 2 ? 1 : 0);
  };
  const showPbLine = (table: HTMLTableElement, kind: 'r' | 'c', at: number) => {
    const ln = pbLine.current;
    if (!ln) return;
    const tb = table.getBoundingClientRect();
    if (kind === 'r') {
      const tr = table.querySelector(`tr[data-r="${at}"]`) as HTMLElement | null;
      if (!tr) { ln.hidden = true; return; }
      Object.assign(ln.style, { left: tb.left + 'px', top: tr.getBoundingClientRect().top - 1 + 'px', width: tb.width + 'px', height: '3px' });
    } else {
      const th = table.tHead?.rows[0]?.cells[at + 1];
      if (!th) { ln.hidden = true; return; }
      Object.assign(ln.style, { left: th.getBoundingClientRect().left - 1 + 'px', top: tb.top + 'px', width: '3px', height: tb.height + 'px' });
    }
    ln.hidden = false;
  };
  const moveBreak = (kind: 'r' | 'c', from: number, to: number, manual: boolean) => {
    const g = pageInfo?.g;
    if (!g || from === to) return;
    const key = kind === 'r' ? 'breaks' : 'colBreaks';
    const lo = kind === 'r' ? g.r0 : g.c0, hi = kind === 'r' ? g.r1 : g.c1;
    const inside = to > lo && to <= hi;
    if (!manual && !inside) { setStatus('Liniile automate nu se pot scoate: ele arată unde se termină hârtia (micșorează din Aspect pagină → Potrivire)'); return; }
    const next = (sheet.print?.[key] ?? []).filter((x) => x !== from);
    if (inside && !next.includes(to)) next.push(to);
    next.sort((a, b) => a - b);
    remember();
    const p: SheetPrint = { ...sheet.print, [key]: next };
    if (!next.length) delete p[key];
    setSheet({ ...sheet, print: Object.keys(p).length ? p : undefined });
    const what = kind === 'r' ? `rândul ${to + 1}` : `coloana ${colName(to)}`;
    setStatus(!inside ? 'Sfârșitul de pagină a fost scos (tras în afara zonei tipărite)'
      : !manual && to > from ? `Acum ${what} începe o pagină nouă; pagina de dinainte nu încape pe hârtie, deci linia automată rămâne (micșorează din Aspect pagină → Potrivire)`
      : `Acum ${what} începe o pagină nouă`);
  };
  const pbDown = (e: React.PointerEvent<HTMLTableElement>) => {
    if (!pageInfo || sheet.protect || e.button !== 0) return;
    const hit = breakAt(e.currentTarget, e.target, e.clientX, e.clientY);
    if (!hit) return;
    e.preventDefault();
    e.stopPropagation();
    finishEdit();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pbDrag.current = { kind: hit.kind, from: hit.at, to: hit.at, manual: hit.manual };
    showPbLine(e.currentTarget, hit.kind, hit.at);
  };
  const pbMove = (e: React.PointerEvent<HTMLTableElement>) => {
    if (!pageInfo) return;
    const d = pbDrag.current, t = e.currentTarget;
    if (!d) {
      const hit = breakAt(t, e.target, e.clientX, e.clientY);
      const cur = hit ? (hit.kind === 'r' ? 'row-resize' : 'col-resize') : '';
      if (t.style.cursor !== cur) t.style.cursor = cur;
      return;
    }
    const to = pbTarget(t, d.kind, e.clientX, e.clientY);
    if (to === null || to === d.to) return;
    d.to = to;
    showPbLine(t, d.kind, to);
  };
  const pbUp = (e: React.PointerEvent<HTMLTableElement>) => {
    const d = pbDrag.current;
    if (!d) return;
    pbDrag.current = null;
    if (pbLine.current) pbLine.current.hidden = true;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    moveBreak(d.kind, d.from, d.to, d.manual);
    focusGrid();
  };
  const startPrint = (pdf: boolean) => {
    if (printWhat === 'sheet' && !printRange(cells, sheet.print, sheet.pics)) { setStatus('Tabelul e gol, nu am ce tipări'); return; }
    if (printWhat !== 'sheet' && printWhat !== 'selection' && !printTargets().some((t) => t.g)) { setStatus('Foile alese sunt goale, nu am ce tipări'); return; }
    setPrintDlg(false);
    setPrinting({ pdf });
  };
  // După ce vederea de tipărire e pe pagină: orientarea foii, apoi fereastra de tipărire sau salvarea PDF.
  useEffect(() => {
    if (!printing) return;
    const page = document.createElement('style');
    const [pw, ph] = pageSizeMm(printSet.landscape, printSet.paper);
    // Antetul și subsolul (cu „Pagina 1 din 3”) le scrie Chromium în marginea de sus / jos, care trebuie să le încapă.
    const file = fileName(path ?? '') || doc.title || 'Tabel';
    const header = fillHF(printSet.header, file, sheet.name);
    const footer = fillHF(printSet.footer, file, sheet.name);
    const hf: PagePrint | undefined = header || footer || printSet.numbers ? { header, footer, numbers: printSet.numbers, numAt: 'bc' } : undefined;
    const m = MARGINS[printSet.margin];
    const mv = hf ? Math.max(m, 12) : m;
    page.textContent = `@page { size: ${pw}mm ${ph}mm; margin: ${mv}mm ${m}mm; }`;
    document.head.appendChild(page);
    (async () => {
      try {
        if (printing.layout) {
          if (!api.docPdfBytes) setLayoutErr('Paginile se văd doar în aplicație (aici folosește Tipărire).');
          else if (!printRange(cells, sheet.print, sheet.pics)) { setLayoutPdf(null); setLayoutErr('Foaia e goală: nu are încă pagini.'); }
          else { setLayoutPdf(await api.docPdfBytes(hf)); setLayoutErr(''); }
        } else if (printing.pdf) {
          const res = await api.exportPdf(safeFileName(doc.title || 'Tabel'), hf);
          if (res) setStatus(`PDF salvat: ${fileName(res.path)}`);
        } else {
          await api.print(hf);
        }
      } catch {
        if (printing.layout) setLayoutErr('Paginile nu au putut fi pregătite.');
      } finally {
        page.remove();
        setPrinting(null);
        if (!printing.layout) focusGrid();
      }
    })();
  }, [printing]);
  // Aspect pagină: paginile se refac (puțin după ultima schimbare) când se schimbă foaia sau setările de tipărire.
  useEffect(() => {
    if (!layoutOn) return;
    const t = window.setTimeout(() => setPrinting((p) => p ?? { pdf: false, layout: true }), 250);
    return () => window.clearTimeout(t);
  }, [layoutOn, active, sheet.print, cells, styles]); // eslint-disable-line react-hooks/exhaustive-deps
  // Aspect pagină și a doua parte a scindării: ce scrii în caseta deschisă pe celulă intră în ea (numerele, datele și procentele
  // recunoscute ca la scris în foaie). Celulele cu listă / reguli de validare se completează în foaia obișnuită, unde se văd lista și mesajele lor.
  const writeCellDirect = (id: string, text: string): boolean => {
    const p = parseCellId(id);
    if (!p) return false;
    selectRange(p, p, false);
    if (sheet.protect && !styles[id]?.unlock) { protectMsg(id); return false; }
    if (listAt(sheet.lists, p.r, p.c)) { showLayout(false); setStatus(`Celula ${id} are reguli de validare: am ales-o în foaie, scrie în ea aici.`); return false; }
    const st = styles[id] ?? {};
    const entry = st.fmt === 'text' ? { raw: asText(text) } as ReturnType<typeof parseEntry> : parseEntry(text);
    const keep = st.fmt && st.fmt !== 'general';
    applyCells({ [id]: entry.raw }, entry.fmt && !keep ? { [id]: { ...st, fmt: entry.fmt, ...(entry.dec ? { dec: entry.dec } : {}) } } : {});
    return true;
  };
  const showLayout = (on: boolean) => {
    finishEdit();
    setLayoutOn(on);
    if (on) { setPageView(false); setLayoutErr(''); } else { setLayoutPdf(null); focusGrid(); }
  };
  const printTargets = (what: PrintWhat = printWhat): PrintViewProps[] => {
    const one = (i: number): PrintViewProps => {
      if (i === active) {
        const g = what === 'selection' ? range : printRange(cells, sheet.print, pics);
        return { title: '', set: printSet, g, tall: g ? printTall(g) : 0, cells, results, styles: withLooks(styles, looks), colW, hidden, hiddenCols: hiddenC,
          charts: printSet.charts && what !== 'selection' ? charts : [], srcs: chartSrcs, pics, merges, bars, brk: what === 'selection' ? undefined : sheet.print?.breaks, cbrk: what === 'selection' ? undefined : sheet.print?.colBreaks, nz: !!sheet.noZero };
      }
      const x = doc.sheets[i];
      const b = { self: x.name, sheets: doc.sheets, names: doc.names, pivots: doc.pivots, match: doc.match, iterate: doc.iter, ext: doc.links };
      const hid = new Set((x.hideRows ?? []).map((k) => k - 1));
      const res = evaluateAll(x.cells, b, hid.size ? hid : undefined);
      const lk = condLooks(x.rules ?? [], x.cells, res, b);
      const set = { ...DEFAULT_PRINT, ...x.print };
      const g = printRange(x.cells, x.print, x.pics);
      return { title: '', set, g, tall: g ? printRows(g, hid).length * 21 : 0, cells: x.cells, results: res, styles: withLooks(x.styles, lk), colW: x.colW ?? {}, hidden: hid,
        hiddenCols: new Set((x.hideCols ?? []).map((k) => k - 1)), charts: set.charts ? x.charts ?? [] : [], srcs: chartSrcsOf(set.charts ? x.charts ?? [] : [], x.name, doc), pics: x.pics, merges: mergesOf(x.merges),
        bars: { ...dataBars(x.rules ?? [], x.cells, res), ...sparkMap(x.sparks ?? [], x.cells, res) }, brk: x.print?.breaks, cbrk: x.print?.colBreaks, nz: !!x.noZero };
    };
    const list = what === 'book' ? doc.sheets.map((_, j) => j).filter((j) => !doc.sheets[j].hidden)
      : what === 'group' && group.length > 1 ? [...group].sort((a, b) => a - b) : [active];
    return list.map(one);
  };
  const updateChart = (id: string, patch: Partial<SheetChart>, undoable = true) =>
    setCharts(charts.map((ch) => (ch.id === id ? { ...ch, ...patch } : ch)), undoable);
  const chartUseSel = (ch: SheetChart) => { const g = chartRange(); if (g) updateChart(ch.id, { range: rangeText(g) }); };
  const showChartRange = (ch: SheetChart) => {
    const g = parseRangeText(ch.range);
    if (!g) return;
    const show = () => { selectRange({ r: g.r0, c: g.c0 }, { r: g.r1, c: g.c1 }); focusGrid(); };
    // Datele de pe altă foaie (ch.src): ducem acolo; foaia ascunsă se poate doar reafișa.
    const si = ch.src && ch.src !== sheetName ? doc.sheets.findIndex((x) => x.name === ch.src) : active;
    if (si < 0 || si === active) { show(); return; }
    if (doc.sheets[si].hidden) { setStatus(`Datele graficului sunt pe foaia ascunsă „${ch.src}”: clic dreapta pe o filă → Reafișare… ca s-o vezi`); return; }
    switchSheet(si);
    setTimeout(show, 0);
  };
  const removeChart = (ch: SheetChart) => {
    setCharts(charts.filter((x) => x.id !== ch.id));
    if (selChart === ch.id) setSelChart(null);
    setStatus('Grafic șters (Ctrl+Z îl aduce înapoi)');
  };
  const chartImage = async (ch: SheetChart) => svgToPng(chartSvgFor(ch, cells, results, styles, chartSrcs));
  // Copiază ca imagine: celulele selectate (rândurile ascunse nu), cu valorile afișate, formatarea și liniile grilei, ca poză PNG.
  const copyRangeImage = async () => {
    finishEdit();
    const g = upTo(range, usedR);
    if ((g.r1 - g.r0 + 1) * (g.c1 - g.c0 + 1) > 5000) { setStatus('Zona e prea mare pentru o poză (cel mult 5000 de celule)'); return; }
    const rows: CopiedCell[][] = [];
    for (let r = g.r0; r <= g.r1; r++) {
      if (hidden.has(r)) continue;
      const row: CopiedCell[] = [];
      for (let c = g.c0; c <= g.c1; c++) {
        const id = cellId(r, c), v = cells[id] ?? '', res = results[id];
        row.push({ text: cellText(cells[id], res, styles[id]), style: styles[id], num: res ? res.num && !res.err : isNumber(v) });
      }
      rows.push(row);
    }
    try {
      const { png } = await tableToPng(tableHtml(rows, Array.from({ length: g.c1 - g.c0 + 1 }, (_, i) => widthOf(g.c0 + i))));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      setStatus(`Celulele ${rangeText(g)} au fost copiate ca imagine; le poți lipi (Ctrl+V) în Docs, Slides, Notițe sau într-un e-mail`);
    } catch (e) {
      setStatus(`Nu s-a putut copia ca imagine: ${(e as Error).message}`);
    }
  };
  const copyChart = async (ch: SheetChart) => {
    try {
      const png = await chartImage(ch);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      setStatus('Graficul a fost copiat ca imagine; îl poți lipi (Ctrl+V) în Docs, în alt document sau într-un e-mail');
    } catch (e) {
      setStatus(`Nu s-a putut copia graficul: ${(e as Error).message}`);
    }
  };
  const saveChartPng = async (ch: SheetChart) => {
    try {
      const png = await chartImage(ch);
      const res = await api.exportFile({
        format: 'png',
        suggestedName: safeFileName(ch.title || doc.title || 'Grafic'),
        data: new Uint8Array(await png.arrayBuffer()),
      });
      if (res) setStatus(`Grafic salvat: ${fileName(res.path)}`);
    } catch (e) {
      setStatus(`Nu s-a putut salva graficul: ${(e as Error).message}`);
    }
  };

  // Selectează zona dintre a (celula activă) și b. Fără `scroll`, tabelul nu sare la celula b.
  function selectRange(a: Pos, b: Pos = a, scroll = true) {
    follow.current = scroll;
    setExtra([]);
    // Un click pe o celulă îmbinată selectează toată îmbinarea (ca în Excel).
    const m = a.r === b.r && a.c === b.c ? mergeAt(merges, a.r, a.c) : undefined;
    if (m) { a = { r: m.r0, c: m.c0 }; b = { r: m.r1, c: m.c1 }; }
    setSel(a);
    setExt(b);
  }

  const move = (dr: number, dc: number, extend = false) => {
    // Săgețile sar peste rândurile ascunse de filtru.
    const step = (from: number) => {
      let r = clamp(from + dr, ROWS);
      while (dr && hidden.has(r) && r > 0 && r < ROWS - 1) r += Math.sign(dr);
      return hidden.has(r) ? from : r;
    };
    // …și peste coloanele ascunse.
    const stepC = (from: number) => {
      let c = clamp(from + dc, COLS);
      while (dc && hiddenC.has(c) && c > 0 && c < COLS - 1) c += Math.sign(dc);
      return hiddenC.has(c) ? from : c;
    };
    if (extend) { setExt((e) => ({ r: step(e.r), c: stepC(e.c) })); return; }
    // Din celula îmbinată se pleacă de la marginea ei (altfel săgeata ar rămâne pe loc).
    const m = mergeAt(merges, sel.r, sel.c);
    const fromR = m ? (dr > 0 ? m.r1 : m.r0) : sel.r;
    const fromC = m ? (dc > 0 ? m.c1 : m.c0) : sel.c;
    selectRange({ r: step(fromR), c: stepC(fromC) });
  };

  // Îmbinarea celulelor selectate, în cele 4 feluri din meniul Îmbinare: „center” (textul din stânga-sus, centrat; pe o
  // îmbinare existentă o desface), „across” (fiecare rând separat), „plain” (fără schimbarea alinierii), „off” (desface).
  const mergeCells = (mode: 'center' | 'across' | 'plain' | 'off') => {
    finishEdit();
    const g = range;
    const has = merges.some((m) => overlaps(m, g));
    if (mode === 'off' || (mode === 'center' && has)) {
      if (!has) { setStatus('În selecție nu e nicio îmbinare'); return; }
      applySheet({ ...sheet, merges: removeMerges(sheet.merges, g) });
      setStatus('Celulele au fost despărțite');
      focusGrid();
      return;
    }
    const parts = mode === 'across' ? Array.from({ length: g.r1 - g.r0 + 1 }, (_, i) => ({ ...g, r0: g.r0 + i, r1: g.r0 + i })) : [g];
    if (!multi || (mode === 'across' && g.c1 === g.c0)) { setStatus(mode === 'across' ? 'Selectează mai multe coloane ca să le îmbini pe fiecare rând' : 'Selectează mai multe celule ca să le îmbini'); return; }
    let list = mode === 'across' ? removeMerges(sheet.merges, g) : sheet.merges;
    const lost: string[] = [];
    const nextStyles = { ...styles };
    for (const p of parts) {
      const res = addMerge(list, p, cells);
      list = res.merges;
      lost.push(...res.lost);
      const top = cellId(p.r0, p.c0);
      if (mode === 'center') nextStyles[top] = { ...styles[top], align: 'center' };
    }
    const nextCells = { ...cells };
    for (const id of lost) delete nextCells[id];
    applySheet({ ...sheet, cells: nextCells, merges: list, styles: nextStyles });
    setStatus(lost.length
      ? `Celule îmbinate. Am păstrat doar textul din stânga-sus; ${lost.length === 1 ? 'celula' : 'celulele'} ${lost.slice(0, 4).join(', ')}${lost.length > 4 ? '…' : ''} ${lost.length === 1 ? 's-a golit (Ctrl+Z o aduce înapoi)' : 's-au golit (Ctrl+Z le aduce înapoi)'}`
      : 'Celule îmbinate (Îmbinare ▾ › Anulare îmbinare celule le desparte)');
    focusGrid();
  };
  const toggleMerge = () => mergeCells('center');
  // Mărire / Micșorare font: treapta următoare din lista de mărimi (11 când celula n-are mărime).
  const stepFontSize = (dir: 1 | -1) => {
    const now = selStyle.sz ?? 11;
    const next = dir > 0 ? FONT_SIZES.find((n) => n > now) : [...FONT_SIZES].reverse().find((n) => n < now);
    if (!next) return;
    styleRange((s) => { const n = { ...s }; if (next === 11) delete n.sz; else n.sz = next; return n; });
  };

  // Ctrl+săgeată, ca în Excel: sare la capătul blocului cu date, sau la următoarea celulă completată,
  // sau la marginea tabelului. Rândurile ascunse de filtru nu se iau în seamă.
  const jump = (dr: number, dc: number, extend = false) => {
    const from = extend ? ext : sel;
    const has = (r: number, c: number) => !!cells[cellId(r, c)];
    const next = (p: Pos): Pos | null => {
      let { r, c } = p;
      do { r += dr; c += dc; } while ((dr && r >= 0 && r < ROWS && hidden.has(r)) || (dc && c >= 0 && c < COLS && hiddenC.has(c)));
      return r < 0 || r >= ROWS || c < 0 || c >= COLS ? null : { r, c };
    };
    let p = from;
    let n = next(p);
    if (n && has(p.r, p.c) && has(n.r, n.c)) {
      while (n && has(n.r, n.c)) { p = n; n = next(p); }
    } else {
      while (n) { p = n; if (has(p.r, p.c)) break; n = next(p); }
    }
    if (extend) setExt(p); else selectRange(p);
  };
  // Ctrl+End: ultimul rând și ultima coloană folosite.
  const lastUsed = (): Pos => {
    let r = 0, c = 0;
    for (const id of Object.keys(cells)) {
      const p = parseCellId(id);
      if (p && !hidden.has(p.r)) { r = Math.max(r, p.r); c = Math.max(c, p.c); }
    }
    return { r, c };
  };

  // Ca în Excel, ștergerea și copierea pe o zonă filtrată se fac doar pe rândurile vizibile.
  // La tăiere (Ctrl+X) pleacă și formatarea, ca să ajungă odată cu valorile acolo unde lipești.
  // Umplere ▾ / Ctrl+D / Ctrl+R: primul rând (prima coloană) al selecției se copiază în jos (la dreapta) pe toată zona.
  const fillDir = (dir: 'down' | 'right') => {
    finishEdit();
    // Un singur rând selectat (de exemplu o celulă): se copiază rândul de deasupra (Ctrl+R: coloana din stânga), ca în programul cunoscut.
    const one = dir === 'down' ? range.r1 <= range.r0 : range.c1 <= range.c0;
    if (one && (dir === 'down' ? range.r0 === 0 : range.c0 === 0)) { setStatus(dir === 'down' ? 'Deasupra nu e niciun rând de copiat' : 'În stânga nu e nicio coloană de copiat'); return; }
    let dest = range;
    if (one && dir === 'down') { let r = range.r0 - 1; while (r > 0 && hidden.has(r)) r--; dest = { ...range, r0: r }; }
    if (one && dir === 'right') dest = { ...range, c0: range.c0 - 1 };
    const src = dir === 'down' ? { ...dest, r1: dest.r0 } : { ...dest, c1: dest.c0 };
    applyCells(fillRange(cells, src, dest), fillStyles(styles, src, dest));
    focusGrid();
  };
  // Numerele scrise ca text (triunghiul verde): butonul ⚠ și clic dreapta le transformă în numere sau ascund semnul.
  const [ntMenu, setNtMenu] = useState<{ x: number; y: number } | null>(null);
  const numTextIds = () => {
    const ids: string[] = [];
    for (const g of allRanges) eachCell(g, [cells], (r, c) => { const id = cellId(r, c); if (!hidden.has(r) && isNumText(cells[id]) && !styles[id]?.ign) ids.push(id); });
    return ids;
  };
  const convertNumText = () => {
    const ids = numTextIds();
    if (sheet.protect) { const bad = ids.find((id) => !styles[id]?.unlock); if (bad) { protectMsg(bad); return; } }
    const patch: Cells = {};
    for (const id of ids) patch[id] = cells[id].slice(1).trim();
    applyCells(patch);
    setNtMenu(null);
    setStatus(ids.length === 1 ? 'Textul a devenit număr' : `${ids.length} texte au devenit numere`);
    focusGrid();
  };
  const ignoreNumText = () => {
    const ids = numTextIds();
    const stylePatch: Styles = {};
    for (const id of ids) stylePatch[id] = { ...styles[id], ign: true };
    applyCells({}, stylePatch);
    setNtMenu(null);
    focusGrid();
  };

  const clearRange = (withStyles = false) => {
    const patch: Cells = {};
    const stylePatch: Styles = {};
    // Se schimbă doar celulele care au ceva (o coloană întreagă are un milion de celule goale).
    for (const g of allRanges) {
      eachCell(g, withStyles ? [cells, styles] : [cells], (r, c) => {
        const id = cellId(r, c);
        if (hidden.has(r)) return;
        if (cells[id]) patch[id] = '';
        if (withStyles && styles[id]) stylePatch[id] = {};
      });
    }
    applyCells(patch, stylePatch);
  };

  // Casetele de bifat: ☑ pune o casetă în fiecare celulă selectată (cele goale primesc FALS) sau, dacă toate au deja, le scoate.
  const toggleCheckboxes = () => {
    const ids: string[] = [];
    for (const g of allRanges) {
      if ((g.r1 - g.r0 + 1) * (g.c1 - g.c0 + 1) > 20000) { setStatus('Zona e prea mare pentru casete de bifat (cel mult 20.000 de celule)'); return; }
      for (let r = g.r0; r <= g.r1; r++) for (let c = g.c0; c <= g.c1; c++) if (!hidden.has(r)) ids.push(cellId(r, c));
    }
    if (sheet.protect) { const bad = ids.find((id) => !styles[id]?.unlock); if (bad) { protectMsg(bad); return; } }
    const remove = ids.length > 0 && ids.every((id) => styles[id]?.chk);
    const patch: Cells = {};
    const stylePatch: Styles = {};
    for (const id of ids) {
      const { chk: _c, spin: _s, opt: _o, btn: _b, ...rest } = styles[id] ?? {};
      stylePatch[id] = remove ? rest : { ...rest, chk: true };
      if (!remove && !(cells[id] ?? '').trim()) patch[id] = 'FALS';
    }
    applyCells(patch, stylePatch);
    setStatus(remove ? 'Casetele de bifat au fost scoase (valorile ADEVĂRAT / FALS rămân)' : 'Casete de bifat puse: clic pe ele sau Spațiu le bifează; în formule sunt ADEVĂRAT / FALS');
    focusGrid();
  };
  // Butonul rotativ / bara de defilare (Inserare → Controale → ⇕ Buton rotativ): fereastra cu minim, maxim, pas și felul lui,
  // pusă pe celulele alese; numerele din celule se aduc între minim și maxim (cele goale primesc minimul).
  const [spinDlg, setSpinDlg] = useState<{ min: string; max: string; step: string; bar: boolean; has: boolean } | null>(null);
  const openSpin = () => {
    finishEdit();
    const sp = styles[selId]?.spin;
    setSpinDlg(sp ? { min: String(sp.min), max: String(sp.max), step: String(sp.step), bar: !!sp.bar, has: true } : { min: '0', max: '100', step: '1', bar: false, has: false });
  };
  const spinNum = (s: string) => Number(s.trim().replace(',', '.'));
  const spinError = !spinDlg ? '' : ![spinDlg.min, spinDlg.max, spinDlg.step].every((s) => s.trim() && Number.isFinite(spinNum(s))) ? 'Scrie minimul, maximul și pasul ca numere.'
    : !(spinNum(spinDlg.min) < spinNum(spinDlg.max)) ? 'Minimul trebuie să fie mai mic decât maximul.'
    : !(spinNum(spinDlg.step) > 0 && spinNum(spinDlg.step) <= spinNum(spinDlg.max) - spinNum(spinDlg.min)) ? 'Pasul trebuie să fie pozitiv și cel mult cât diferența dintre maxim și minim.' : '';
  const applySpin = (remove: boolean) => {
    if (!spinDlg || (!remove && spinError)) return;
    const ids: string[] = [];
    for (const g of allRanges) {
      if ((g.r1 - g.r0 + 1) * (g.c1 - g.c0 + 1) > 20000) { setStatus('Zona e prea mare (cel mult 20.000 de celule)'); return; }
      for (let r = g.r0; r <= g.r1; r++) for (let c = g.c0; c <= g.c1; c++) if (!hidden.has(r)) ids.push(cellId(r, c));
    }
    if (sheet.protect) { const bad = ids.find((id) => !styles[id]?.unlock); if (bad) { protectMsg(bad); return; } }
    const sp = { min: spinNum(spinDlg.min), max: spinNum(spinDlg.max), step: spinNum(spinDlg.step), ...(spinDlg.bar ? { bar: true } : {}) };
    const patch: Cells = {};
    const stylePatch: Styles = {};
    for (const id of ids) {
      const { spin: _s, chk: _c, opt: _o, btn: _b, ...rest } = styles[id] ?? {};
      stylePatch[id] = remove ? rest : { ...rest, spin: sp };
      const raw = cells[id] ?? '';
      if (remove || raw.startsWith('=')) continue;
      const n = spinNum(raw);
      const v = raw.trim() && Number.isFinite(n) ? Math.min(sp.max, Math.max(sp.min, n)) : sp.min;
      if (String(v) !== raw.trim()) patch[id] = String(v);
    }
    setSpinDlg(null);
    applyCells(patch, stylePatch);
    setStatus(remove ? 'Butoanele rotative au fost scoase (numerele rămân)'
      : `${spinDlg.bar ? 'Bară de defilare' : 'Buton rotativ'} pus: ${spinDlg.bar ? 'trage bara' : 'clic pe ▲ / ▼'} (sau Alt+↑ / Alt+↓) schimbă numărul între ${sp.min} și ${sp.max}, cu pasul ${sp.step}`);
    focusGrid();
  };
  // Butoanele de opțiune / lista combo (Inserare → Controale → ◉ Butoane de opțiune): variantele scrise cu „;” (sau o zonă, de exemplu
  // A1:A5, din care se iau textele), puse pe celulele alese; valoarea celulei e numărul variantei alese, ca legătura de celulă din
  // controalele de formular, ca să fie folosită în formule (de exemplu ALEGE / CHOOSE sau INDEX).
  const [choiceDlg, setChoiceDlg] = useState<{ text: string; combo: boolean; has: boolean } | null>(null);
  const openOpt = () => {
    finishEdit();
    const o = styles[selId]?.opt;
    setChoiceDlg(o ? { text: o.items.join('; '), combo: !!o.combo, has: true } : { text: '', combo: false, has: false });
  };
  const optItems = (text: string): string[] => {
    const t = text.trim().replace(/^=/, '').replace(/\$/g, '').toUpperCase();
    const g = /^[A-Z]+\d+:[A-Z]+\d+$/.test(t) ? parseRangeText(t) : null;
    if (g && g.r1 < ROWS && g.c1 < COLS) {
      const out: string[] = [];
      for (let r = g.r0; r <= g.r1 && out.length <= OPT_MAX; r++) for (let c = g.c0; c <= g.c1 && out.length <= OPT_MAX; c++) {
        const id = cellId(r, c), v = cellText(cells[id], results[id], styles[id]).trim();
        if (v) out.push(v);
      }
      return out;
    }
    return text.split(/[;\n]/).map((x) => x.trim()).filter(Boolean);
  };
  const optList = choiceDlg ? optItems(choiceDlg.text) : [];
  const optError = !choiceDlg ? '' : optList.length < 2 ? 'Scrie cel puțin două variante, despărțite prin „;” (sau o zonă, de exemplu A1:A5).'
    : optList.length > OPT_MAX ? `Cel mult ${OPT_MAX} de variante.` : '';
  const applyOpt = (remove: boolean) => {
    if (!choiceDlg || (!remove && optError)) return;
    const ids: string[] = [];
    for (const g of allRanges) {
      if ((g.r1 - g.r0 + 1) * (g.c1 - g.c0 + 1) > 20000) { setStatus('Zona e prea mare (cel mult 20.000 de celule)'); return; }
      for (let r = g.r0; r <= g.r1; r++) for (let c = g.c0; c <= g.c1; c++) if (!hidden.has(r)) ids.push(cellId(r, c));
    }
    if (sheet.protect) { const bad = ids.find((id) => !styles[id]?.unlock); if (bad) { protectMsg(bad); return; } }
    const o = cleanOpt({ items: optList, combo: choiceDlg.combo })!;
    const patch: Cells = {};
    const stylePatch: Styles = {};
    for (const id of ids) {
      const { spin: _s, chk: _c, opt: _o, btn: _b, ...rest } = styles[id] ?? {};
      stylePatch[id] = remove ? rest : { ...rest, opt: o };
      const raw = cells[id] ?? '';
      if (remove || raw.startsWith('=')) continue;
      // Un text care e chiar una din variante devine numărul ei; altfel celula rămâne fără alegere.
      const k = optIndex(raw, o.items.length) || o.items.findIndex((x) => x.toLowerCase() === raw.trim().toLowerCase()) + 1;
      const v = k ? String(k) : '';
      if (v !== raw.trim()) patch[id] = v;
    }
    setChoiceDlg(null);
    applyCells(patch, stylePatch);
    setStatus(remove ? 'Variantele au fost scoase (numerele rămân)'
      : `${o.combo ? 'Listă combo pusă: alege din listă' : 'Butoane de opțiune puse: clic pe o variantă'} (sau Alt+↑ / Alt+↓); în celulă se scrie numărul variantei alese, de la 1 la ${o.items.length}`);
    focusGrid();
  };
  // Alege varianta k (1…n) sau, cu d = ±1, pe cea următoare / dinainte; celulele cu formulă nu se schimbă.
  const optCell = (r: number, c: number, k: number, d = 0) => {
    const id = cellId(r, c), o = styles[id]?.opt;
    if (!o) return false;
    if ((cells[id] ?? '').startsWith('=')) { setStatus('Celula arată rezultatul unei formule; variantele schimbă doar numere scrise'); return true; }
    if (sheet.protect && !styles[id]?.unlock) { protectMsg(id); return true; }
    const now = optIndex(cells[id], o.items.length);
    const next = d ? Math.min(o.items.length, Math.max(1, (now || (d > 0 ? 0 : o.items.length + 1)) + d)) : k;
    const v = next >= 1 && next <= o.items.length ? String(next) : '';
    if (v !== (cells[id] ?? '').trim()) applyCells({ [id]: v });
    return true;
  };
  // Butonul cu macrocomandă (Inserare → Controale → ▶ Buton macro): în celulele alese apare un buton care, la clic (sau Spațiu
  // pe celulă), rulează macrocomanda atribuită, de la celula aleasă atunci, ca butonul din controalele de formular.
  const [btnDlg, setBtnDlg] = useState<{ macro: string; label: string; has: boolean } | null>(null);
  const allMacros = [...(doc.macros ?? []), ...myMacros];
  const openBtn = () => {
    finishEdit();
    const b = styles[selId]?.btn;
    setBtnDlg(b ? { macro: b.macro, label: b.label ?? '', has: true } : { macro: allMacros[0]?.name ?? '', label: '', has: false });
  };
  const applyBtn = (remove: boolean) => {
    if (!btnDlg) return;
    const b = cleanBtn({ macro: btnDlg.macro, label: btnDlg.label });
    if (!remove && !b) return;
    const ids: string[] = [];
    for (const g of allRanges) {
      if ((g.r1 - g.r0 + 1) * (g.c1 - g.c0 + 1) > 20000) { setStatus('Zona e prea mare (cel mult 20.000 de celule)'); return; }
      for (let r = g.r0; r <= g.r1; r++) for (let c = g.c0; c <= g.c1; c++) if (!hidden.has(r)) ids.push(cellId(r, c));
    }
    if (sheet.protect) { const bad = ids.find((id) => !styles[id]?.unlock); if (bad) { protectMsg(bad); return; } }
    const stylePatch: Styles = {};
    for (const id of ids) {
      const { spin: _s, chk: _c, opt: _o, btn: _b, ...rest } = styles[id] ?? {};
      stylePatch[id] = remove ? rest : { ...rest, btn: b! };
    }
    setBtnDlg(null);
    applyCells({}, stylePatch);
    setStatus(remove ? 'Butoanele au fost scoase (textul din celule rămâne)' : `Buton pus: clic pe el (sau Spațiu pe celulă) rulează macrocomanda „${b!.macro}” de la celula aleasă`);
    focusGrid();
  };
  const runBtn = (r: number, c: number) => {
    const b = styles[cellId(r, c)]?.btn;
    if (!b) return false;
    if (rec) { setStatus('Cât se înregistrează o macrocomandă, butoanele nu rulează alte macrocomenzi'); return true; }
    const m = (doc.macros ?? []).find((x) => x.name === b.macro) ?? myMacros.find((x) => x.name === b.macro);
    if (!m) { setStatus(`Macrocomanda „${b.macro}” nu mai există: alege alta din Inserare → Controale → ▶ Buton macro`); return true; }
    playMacro(m);
    return true;
  };
  // Un pas în sus / în jos (d = +1 / −1) sau o valoare anume (bara trasă), între minim și maxim; celulele cu formulă nu se schimbă.
  const spinCell = (r: number, c: number, d: number, set?: number) => {
    const id = cellId(r, c), sp = styles[id]?.spin;
    if (!sp) return false;
    if ((cells[id] ?? '').startsWith('=')) { setStatus('Celula arată rezultatul unei formule; butonul rotativ schimbă doar numere scrise'); return true; }
    if (sheet.protect && !styles[id]?.unlock) { protectMsg(id); return true; }
    const n = spinNum(cells[id] ?? '');
    const base = Number.isFinite(n) && (cells[id] ?? '').trim() ? n : sp.min;
    const v = Math.min(sp.max, Math.max(sp.min, +(set ?? base + d * sp.step).toPrecision(12)));
    if (String(v) !== (cells[id] ?? '').trim()) applyCells({ [id]: String(v) });
    return true;
  };
  // Bifează / debifează casetele din zona selectată (Spațiu) sau doar celula apăsată (clic); celulele cu formulă nu se schimbă.
  const flipChecks = (at?: { r: number; c: number }) => {
    const ids: string[] = [];
    if (at) ids.push(cellId(at.r, at.c));
    else for (const g of allRanges) eachCell(g, [styles], (r, c) => { const id = cellId(r, c); if (styles[id]?.chk && !hidden.has(r)) ids.push(id); });
    const ok = ids.filter((id) => styles[id]?.chk && !(cells[id] ?? '').startsWith('='));
    if (!ok.length) { if (ids.some((id) => (cells[id] ?? '').startsWith('='))) setStatus('Caseta arată rezultatul unei formule; schimbă formula ca s-o bifezi'); return; }
    if (sheet.protect) { const bad = ok.find((id) => !styles[id]?.unlock); if (bad) { protectMsg(bad); return; } }
    // Ca în Excel: dacă măcar una nu e bifată, toate se bifează; altfel toate se debifează.
    const on = ok.some((id) => !isCheckedValue(cells[id]));
    applyCells(Object.fromEntries(ok.map((id) => [id, on ? 'ADEVĂRAT' : 'FALS'])));
  };

  // Umple zona t pornind de la selecție și selectează rezultatul.
  const applyFill = (t: Range | null) => {
    if (!t) return;
    applyCells(fillRange(cells, range, t), fillStyles(styles, range, t));
    selectRange({ r: t.r0, c: t.c0 }, { r: t.r1, c: t.c1 }, false);
  };

  const finishFill = () => {
    setFillTo(null);
    applyFill(fillT);
  };

  // Dublu-click pe pătrățel: umple în jos cât are date coloana vecină, ca în Excel.
  const autoFillDown = () => {
    const has = (r: number, c: number) => c >= 0 && c < COLS && !!cells[cellId(r, c)];
    const side = has(range.r1, range.c0 - 1) ? range.c0 - 1 : has(range.r1, range.c1 + 1) ? range.c1 + 1 : -1;
    if (side < 0) return;
    let end = range.r1;
    while (end + 1 < ROWS && has(end + 1, side)) end++;
    if (end > range.r1) applyFill({ ...range, r1: end });
  };

  // Introducere (scris direct în celulă: săgețile trec la celula vecină) sau Editare (F2, dublu-clic: săgețile mută cursorul).
  const enterMode = useRef(false);
  const startEdit = (text: string, inBar = false, at: Pos = sel) => {
    if (sheet.protect && !styles[cellId(at.r, at.c)]?.unlock) { protectMsg(cellId(at.r, at.c)); return; }
    enterMode.current = false;
    editRef.current = text;
    setEditInBar(inBar);
    setEdit(text);
  };

  const changeEdit = (text: string) => { editRef.current = text; setEdit(text); };
  // Completarea automată din coloană: cât scrii (literă cu literă, cu cursorul la sfârșit), restul unui text deja scris
  // mai sus / mai jos în coloană apare selectat; Enter îl primește, o literă nouă scrie peste el, Backspace îl scoate.
  const typeEdit = (text: string, typed?: boolean, input?: HTMLTextAreaElement) => {
    // AutoCorect în celule, doar regulile sigure pentru tabele: ș / ț cu virgulă, DOuă MAjuscule și lista de înlocuiri
    // (fără ghilimele, fracții, simboluri ca >= și majuscula de la început, care ar strica datele și criteriile). Nu în formule.
    const prev = editRef.current ?? '';
    if (typed && shOpts.correct && input && text.length === prev.length + 1 && text.startsWith(prev) && input.selectionStart === text.length && !/^[=+\-@]/.test(prev)) {
      const fix = autoCorrect(prev, text.slice(-1), { ...loadAutoCorrect(), quotes: false, symbols: false, fractions: false, sentence: false });
      if (fix && fix.del - 1 <= prev.length) text = prev.slice(0, prev.length - (fix.del - 1)) + fix.text;
    }
    changeEdit(text);
    if (!typed || !shOpts.complete || !input || input.selectionStart !== text.length || input.selectionEnd !== text.length) return;
    const full = autoComplete(text, columnTexts((r, c) => cells[cellId(r, c)], sel.r, sel.c, ROWS));
    if (!full) return;
    changeEdit(full);
    requestAnimationFrame(() => { if (document.activeElement === input) input.setSelectionRange(text.length, full.length); });
  };

  // Sugestii cât scrii o formulă: după „=SU” apar SUM, SUMIF…; în parantezele unei funcții, argumentele ei (cel curent aldin).
  // ↑ ↓ aleg, Tab pune funcția cu paranteza deschisă, Esc ascunde lista (încă un Esc renunță la scriere).
  // `nav`: alegerea a fost mutată cu săgețile sau cu mausul (atunci Enter o primește mereu).
  const [hint, setHint] = useState<{ h: FormulaHint; x: number; y: number; pick: number; nav?: boolean } | null>(null);
  const hintRef = useRef(hint);
  hintRef.current = hint;
  const hintOff = useRef('');
  const updateHint = useCallback(() => {
    const t = document.activeElement;
    const text = editRef.current;
    if (!(t instanceof HTMLTextAreaElement) || text === null || !text.startsWith('=') || !(t.classList.contains('cell-input') || t.closest('.formula-bar'))) { setHint(null); return; }
    const h = formulaHint(text, t.selectionStart ?? text.length, ALL_FNS);
    if (h?.word && hintOff.current === `${h.word.start}:${h.word.text}`) delete h.word;
    if (!h || (!h.word && !h.call)) { setHint(null); return; }
    const r = t.getBoundingClientRect();
    setHint((old) => {
      const same = !!(old?.h.word && h.word && old.h.word.start === h.word.start);
      return { h, x: Math.round(r.left), y: Math.round(r.bottom + 2), pick: same ? Math.min(old!.pick, h.word!.list.length - 1) : 0, nav: same && old!.nav };
    });
  }, []);
  useLayoutEffect(() => { updateHint(); }, [edit, updateHint]);
  const editing = edit !== null;
  useEffect(() => {
    if (!editing) return;
    document.addEventListener('selectionchange', updateHint);
    return () => document.removeEventListener('selectionchange', updateHint);
  }, [editing, updateHint]);
  const acceptHint = (name: string) => {
    const t = document.activeElement;
    const text = editRef.current;
    const w = hintRef.current?.h.word;
    if (text === null || !w) return;
    const end = w.start + w.text.length;
    changeEdit(text.slice(0, w.start) + name + '(' + text.slice(end));
    const pos = w.start + name.length + 1;
    requestAnimationFrame(() => { if (t instanceof HTMLTextAreaElement) { t.focus(); t.setSelectionRange(pos, pos); updateHint(); } });
  };
  // Referința pusă ultima dată în formulă cu click pe o celulă (ca un click nou s-o înlocuiască).
  // ar / ac: colțul fix al zonei alese cu Shift+săgeți (lipsă = celula r, c).
  const refPick = useRef<{ a: number; b: number; text: string; r: number; c: number; ar?: number; ac?: number } | null>(null);
  // Cursorul din formulă stă imediat după „=” sau după un semn (ori după adresa pusă tocmai cu săgețile): săgeata alege o celulă.
  const canPoint = (e: React.KeyboardEvent) => {
    const t = editRef.current ?? '';
    const el = e.currentTarget instanceof HTMLTextAreaElement || e.currentTarget instanceof HTMLInputElement ? e.currentTarget : null;
    const c = el?.selectionStart ?? t.length;
    const l = refPick.current;
    return (!!l && l.b === c && l.text === t) || /[=+\-*/^(;,:<>&]\s*$/.test(t.slice(0, c));
  };

  // Scrie textul editat în celulă. Folosim o referință ca o a doua chemare (de exemplu
  // la pierderea focusului) să nu mai facă nimic.
  // Întoarce false când valoarea a fost refuzată (validare), ca selecția să rămână pe celulă, ca în Excel.
  const finishEdit = (): boolean | void => {
    const text = editRef.current;
    if (text === null) return;
    editRef.current = null;
    // „17.10.2026”, „15%”, „250 lei” devin numere, iar celula primește formatul potrivit (dacă nu avea altul).
    const list = listAt(sheet.lists, sel.r, sel.c);
    let note = '';
    if (list?.rule && !text.startsWith('=') && !ruleOk(list.rule, text, (f) => customOk(list, cellId(sel.r, sel.c), f, text))) {
      // Regula pe număr / dată / lungime: Oprire refuză, Avertisment întreabă, Informare primește cu mesaj.
      const style = list.error?.style ?? 'stop';
      const msg = list.error?.text?.trim() || `Aici se primește doar ${describeValRule(list.rule)}.`;
      if (style === 'stop') { setEdit(null); setStatus(`„${text.trim()}” nu se primește. ${msg}`); return false; }
      if (style === 'warning' && !window.confirm(`${list.error?.title?.trim() || 'Valoare neobișnuită'}\n\n${msg}\n\nPăstrezi totuși „${text.trim()}”?`)) {
        setEdit(null); setStatus('Valoarea nu a fost păstrată'); return false;
      }
      note = `${list.error?.title?.trim() ? list.error.title.trim() + ': ' : ''}${msg}`;
    }
    if (list && !list.rule && (list.kind || list.values.length) && !text.startsWith('=')) {
      // Celula are listă: se primește doar o valoare din ea (scrisă cu litere mari sau mici).
      const v = matchValue(list, text);
      setEdit(null);
      if (v === null && list.error?.text?.trim() && list.error.style === 'stop') {
        setStatus(`„${text.trim()}” nu se primește. ${list.error.text.trim()}`);
        return false;
      }
      if (v === null && list.kind) {
        setStatus(`„${text.trim()}” nu e un ${codeName(list.kind)} corect (cifra de control nu se potrivește). Verifică cifrele și scrie din nou.`);
        return false;
      }
      if (v === null) {
        setStatus(`„${text.trim()}” nu e în lista celulei. Alege din ▾ (Alt+↓): ${list.values.slice(0, 8).join(', ')}${list.values.length > 8 ? '…' : ''}`);
        return false;
      }
      applyCells({ [selId]: v });
      return;
    }
    // În celulele cu formatul Text, ce scrii rămâne text (00123 nu devine 123, =1+1 nu se calculează).
    const entry = selStyle.fmt === 'text' ? { raw: asText(text) } as ReturnType<typeof parseEntry> : parseEntry(text);
    const keep = selStyle.fmt && selStyle.fmt !== 'general';
    // Un text cu rânduri noi (Alt+Enter) se încadrează singur, ca să se vadă toate rândurile.
    const wrap = entry.raw.includes('\n') && !selStyle.wrap;
    const st = { ...selStyle, ...(entry.fmt && !keep ? { fmt: entry.fmt, ...(entry.dec ? { dec: entry.dec } : {}) } : {}), ...(wrap ? { wrap: true } : {}) };
    applyCells({ [selId]: entry.raw }, (entry.fmt && !keep) || wrap ? { [selId]: st } : {});
    setEdit(null);
    if (note) setStatus(note);
  };

  // Textul de editat: o dată se arată ca dată, un procent ca procent, nu ca numărul din spate.
  const editTextOf = (id: string) => {
    const raw = cells[id] ?? '';
    const fmt = styles[id]?.fmt;
    // La formatul Text apostroful se pune singur, deci nu se arată la editare.
    if (fmt === 'text' && raw.startsWith("'")) return raw.slice(1);
    if (!isNumber(raw) || !fmt || !['date', 'datelong', 'time', 'datetime', 'percent'].includes(fmt)) return raw;
    const n = Number(raw.trim().replace(',', '.'));
    // Secundele se arată la editare doar dacă există, ca ora să nu se piardă.
    const secs = Math.round((n - Math.floor(n)) * 86400) % 60 !== 0;
    if (fmt === 'time') return serialToTime(n, secs);
    if (fmt === 'datetime') return `${serialToDate(n)} ${serialToTime(n, secs)}`;
    return fmt === 'percent' ? `${formatNumber(n * 100)}%` : serialToDate(n);
  };

  const commit = (dr = 0, dc = 0) => {
    const ok = finishEdit() !== false;
    if (ok && (dr || dc)) move(dr, dc);
    focusGrid();
  };

  // Ctrl+Enter, ca în Excel: textul scris intră în toate celulele selectate (și în zonele adăugate cu Ctrl).
  // O formulă își mută referințele pentru fiecare celulă, ca la copiere. Rândurile ascunse de filtru se sar.
  const commitAll = () => {
    const text = editRef.current;
    const cellsCount = allRanges.reduce((n, g) => n + (g.r1 - g.r0 + 1) * (g.c1 - g.c0 + 1), 0);
    if (text === null || cellsCount <= 1) { commit(); return; }
    editRef.current = null;
    setEdit(null);
    const entry = parseEntry(text);
    const patch: Cells = {};
    const stylePatch: Styles = {};
    for (const g of allRanges) {
      eachCell(g, [cells, styles], (r, c) => {
        if (hidden.has(r)) return;
        const id = cellId(r, c);
        const st = styles[id] ?? {};
        patch[id] = st.fmt === 'text' ? asText(text) : entry.raw.startsWith('=') ? shiftFormula(entry.raw, r - sel.r, c - sel.c) : entry.raw;
        if (entry.fmt && (!st.fmt || st.fmt === 'general')) stylePatch[id] = { ...st, fmt: entry.fmt };
      });
    }
    applyCells(patch, stylePatch);
    setStatus(`Am pus „${text.length > 30 ? text.slice(0, 30) + '…' : text}” în ${Object.keys(patch).length} celule`);
    focusGrid();
  };

  const cancel = () => { editRef.current = null; setEdit(null); focusGrid(); };

  const confirmDiscard = async () => !dirty || askDiscard('în tabel');

  const newSheet = async () => {
    if (!(await confirmDiscard())) return;
    draftOf(tab, 'sheets', true);
    setDoc(emptySheetDoc());
    setLinkBar(false);
    setActive(0);
    setPath(null);
    setFromFile(null);
    setDirty(false);
    setSavedAt(null);
    selectRange({ r: 0, c: 0 });
    editRef.current = null;
    setEdit(null);
    past.current = [];
    future.current = [];
    setStatus('');
  };

  // Un șablon se deschide ca tabel nou, nesalvat (la Salvează alegi unde îl pui).
  const fromTemplate = async (t: Template) => {
    setTplDlg(false);
    if (!(await confirmDiscard())) { focusGrid(); return; }
    draftOf(tab, 'sheets', true);
    setDoc(t.build());
    setActive(0);
    setPath(null);
    setFromFile(null);
    setDirty(true);
    selectRange({ r: 1, c: 0 });
    editRef.current = null;
    setEdit(null);
    past.current = [];
    future.current = [];
    setStatus(`Șablon „${t.name}”: completează rândurile, formulele calculează singure. Apasă Salvează ca să-l păstrezi.`);
    focusGrid();
  };

  // Tabul are deja ceva (un fișier sau celule scrise): Deschide / Import duc fișierul nou într-un tab nou, nu peste acesta.
  const busy = () => !!path || dirty || doc.sheets.some((s) => Object.keys(s.cells).length > 0);
  const open = async () => {
    if (busy() && openInTab) { const file = await api.openFile('sheets'); if (file) openInTab('sheets', file); return; }
    if (!(await confirmDiscard())) return;
    const file = await api.openFile('sheets');
    if (file) load(file);
  };
  // Fișier → Recuperează…: ciorna se deschide într-un tab nou dacă acesta are ceva în el (ca la Deschide).
  const openDraft = async (id: string, content: string) => {
    setDraftDlg(false);
    const file: OpenedFile = { path: '', content, dirty: true, draft: id };
    if (busy() && openInTab) { openInTab('sheets', file); return; }
    if (!(await confirmDiscard())) return;
    load(file);
    setStatus('Tabel recuperat. Salvează-l cu Ctrl+S ca să-l păstrezi.');
  };
  const openRecent = async (p: string) => {
    let file: OpenedFile;
    try { file = await api.readFile(p, 'sheets'); } catch { setStatus('Fișierul nu mai există sau nu poate fi deschis: ' + p); return; }
    if (busy() && openInTab) { openInTab('sheets', file); return; }
    if (!(await confirmDiscard())) return;
    load(file);
  };
  const importElsewhere = async (kind: 'textdata' | 'xlsx' | 'doctables') => {
    const file = await api.importFile(kind);
    if (file) openInTab!('sheets', { path: file.path, content: '', imported: file.data, ...(kind !== 'xlsx' ? { wizard: true } : {}) });
  };

  // Import din text (.csv, .txt, .tsv, .prn): fereastra Import din text arată ce s-a ghicit (codificare, separator, zecimale,
  // date, cap de tabel) și primele rânduri; de obicei ajunge Încarcă. Se deschide ca tabel nou (nesalvat), fișierul rămâne neatins.
  const importCsv = async () => {
    if (busy() && openInTab) return importElsewhere('textdata');
    if (!(await confirmDiscard())) return;
    const file = await api.importFile('textdata');
    if (file) openTextDialog(file);
  };
  const openTextDialog = (file: BinaryFile) => {
    const a = analyzeText(file.data);
    setTextDlg({ file, text: a.text, options: a.options });
  };
  // Dublu-clic pe un .csv / .txt cu date, „Deschide un fișier…”, tragere: direct, cu alegerile ghicite (fără fereastră).
  const importCsvData = (file: BinaryFile) => {
    const out = importText(file.data);
    putTextImport(file, out, out.options);
  };
  const putTextImport = (file: BinaryFile, out: TextImportResult, o: TextOptions) => {
    const d = emptySheetDoc();
    d.title = fileName(file.path).replace(TEXT_EXT, '');
    d.sheets[0] = { ...d.sheets[0], cells: out.cells, styles: out.styles, ...(Object.keys(out.colW).length ? { colW: out.colW } : {}) };
    setDoc(d);
    setActive(0);
    setPath(null);
    setFromFile(file.path);
    csvSep.current = o.sep.length === 1 && o.sep !== ' ' ? o.sep : ';';
    // Un fișier doar cu litere englezești n-are de unde arăta codificarea: primește semnătura UTF-8, ca diacriticele scrise acum să se citească bine.
    csvEnc.current = { enc: o.encoding, bom: hasBom(file.data) || (o.encoding === 'utf-8' && file.data.every((b) => b < 0x80)) };
    setDirty(true);
    selectRange({ r: 0, c: 0 });
    editRef.current = null;
    setEdit(null);
    past.current = [];
    future.current = [];
    const enc = ENCODINGS.find(([k]) => k === o.encoding)?.[1] ?? o.encoding;
    setStatus(`Importat din ${fileName(file.path)}: ${out.rows} rânduri, ${out.cols} coloane (separator ${sepName(o.sep)}, ${enc}, zecimale cu ${o.decimal === ',' ? 'virgulă' : 'punct'})`
      + (out.cut ? `. Atenție: tabelul are loc pentru ${ROWS} rânduri și ${COLS} coloane, restul nu a fost adus` : '')
      + '. Apasă Salvează ca să-l păstrezi ca tabel Cyber Office Studio.');
  };
  const finishTextImport = (o: TextOptions, text: string) => {
    const dlg = textDlg;
    setTextDlg(null);
    if (!dlg) return;
    putTextImport(dlg.file, rowsToCells(splitTextRows(text, o), o), o);
    focusGrid();
  };

  // Preluare date → Din imagine: un tabel fotografiat sau scanat, citit cu recunoașterea textului (OCR, pe calculator, fără
  // internet), devine foaie (pictureTable.ts). Imaginile mari se micșorează la 3000 px, ca recunoașterea să nu ia prea mult.
  // Din clipboard: o captură de ecran (Win+Shift+S) sau o poză copiată din browser, citită direct, fără fișier.
  const importPicture = async (clip = false) => {
    let file: BinaryFile | null = null;
    if (clip) {
      let blob: Blob | null = null;
      try {
        for (const it of await navigator.clipboard.read()) {
          const t = it.types.find((x) => x.startsWith('image/'));
          if (t) { blob = await it.getType(t); break; }
        }
      } catch { /* fără acces la clipboard */ }
      if (!blob) { setStatus('În clipboard nu e nicio poză. Fă o captură de ecran (Win+Shift+S) sau copiază poza unui tabel, apoi alege din nou.'); return; }
      if (!(await confirmDiscard())) return;
      file = { path: 'Din clipboard', data: new Uint8Array(await blob.arrayBuffer()) };
    } else {
      if (!(await confirmDiscard())) return;
      file = await api.importFile('image');
    }
    if (!file) return;
    const from = clip ? 'clipboard' : fileName(file.path);
    let canvas: HTMLCanvasElement;
    try {
      const bmp = await createImageBitmap(new Blob([file.data.slice()]));
      const k = Math.min(1, 3000 / Math.max(bmp.width, bmp.height));
      canvas = document.createElement('canvas');
      canvas.width = Math.round(bmp.width * k); canvas.height = Math.round(bmp.height * k);
      const g = canvas.getContext('2d')!;
      g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height);
      g.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      bmp.close();
    } catch {
      setStatus(`${from} nu e o imagine care se poate citi aici (.png, .jpg, .webp, .bmp, .gif).`);
      return;
    }
    setStatus('Se recunoaște textul din imagine…');
    try {
      const { recognize } = await import('../pdf/ocr');
      const { boxesToGrid, rowsToHtml } = await import('./pictureTable');
      const { docTablesToBook } = await import('./docTables');
      const { words } = await recognize(canvas, (p) => setStatus(`Se recunoaște textul din imagine… ${Math.round(p * 100)}%`));
      const { rows, unsure } = boxesToGrid(words.map((w) => ({ text: w.text, ...w.box, conf: w.conf })));
      if (!rows.length) { setStatus(`În ${from} nu s-a găsit niciun text.`); return; }
      const book = docTablesToBook(rowsToHtml(rows), { layout: 'sheets', paragraphs: false });
      book.sheets[0].name = 'Din imagine';
      // Celulele recunoscute nesigur primesc fundal portocaliu deschis, ca să fie văzute și verificate (tabelul începe în A1).
      const st = book.sheets[0].styles;
      for (const [r, c] of unsure) { const id = cellId(r, c); if (book.sheets[0].cells[id]) st[id] = { ...st[id], bg: UNSURE_BG }; }
      await importXlsxData(file, book);
      const n = unsure.filter(([r, c]) => book.sheets[0].cells[cellId(r, c)]).length;
      setStatus(`Importat din ${from}: ${rows.length} rânduri și ${rows[0].length} coloane. `
        + (n ? `${n} ${n === 1 ? 'celulă e recunoscută nesigur și e colorată cu portocaliu: verifică-o' : 'celule sunt recunoscute nesigur și sunt colorate cu portocaliu: verifică-le'} (Pornire → Culoare de umplere → Fără umplere scoate culoarea).`
          : 'Verifică celulele: recunoașterea poate greși unele litere sau cifre.'));
      focusGrid();
    } catch (e) {
      setStatus('Textul din imagine nu a putut fi recunoscut: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  // Import .docx (tabele): tabelele unui document (.docx, .odt, .doc, .rtf), citit cu cititorii din Docs, aduse ca foi
  // (fiecare pe foaia lui sau toate pe una), cu celulele unite, capul îngroșat și numerele ca numere.
  // Din PDF: tabelele PDF-ului devin un tabel nou (nesalvat), cu numerele recunoscute ca numere; PDF-ul rămâne neatins.
  const importPdfTables = async () => {
    if (!busy() || !openInTab) { if (!(await confirmDiscard())) return; }
    const file = await api.importFile('pdf');
    if (!file) return;
    const name = fileName(file.path);
    try {
      const { pdfFileToSheet } = await import('./pdfImport');
      const r = await pdfFileToSheet(file.data, name.replace(/[.]pdf$/i, ''), (n, all) => setStatus(`Se citesc tabelele din ${name}: pagina ${n} din ${all}…`));
      if (r.scanned === r.pages) { setStatus(`${name} nu are text (paginile sunt scanări sau poze). Fă-l întâi căutabil în modulul PDF sau folosește «Din imagine…».`); return; }
      if (!r.rows) { setStatus(`În ${name} nu am găsit text de pus în tabel.`); return; }
      const opened = { path: '', content: r.content };
      if (busy() && openInTab) openInTab('sheets', opened); else load(opened);
      setStatus(r.tables ? `Importat din ${name}: ${r.rows} rânduri, din ${r.tables} ${r.tables === 1 ? 'tabel' : 'tabele'}. Numerele sunt gata de adunat.`
        : `Importat din ${name}: ${r.rows} rânduri. N-am găsit tabele, așa că fiecare rând de text e un rând în tabel.`);
    } catch {
      setStatus(`Tabelele din ${name} nu au putut fi citite.`);
    }
  };
  const importDocTables = async () => {
    if (busy() && openInTab) return importElsewhere('doctables');
    if (!(await confirmDiscard())) return;
    const file = await api.importFile('doctables');
    if (file) await openDocTables(file);
  };
  const openDocTables = async (file: BinaryFile) => {
    try {
      const { readImportedDoc } = await import('../docs/readImport');
      const { countTables } = await import('./docTables');
      const { html } = await readImportedDoc(file);
      const tables = countTables(html);
      if (!tables) { setStatus(`${fileName(file.path)} nu are niciun tabel. Pentru textul lui folosește Docs.`); return; }
      setDocDlg({ file, html, tables });
    } catch (e) {
      setStatus('Documentul nu a putut fi citit: ' + (e instanceof Error ? e.message : String(e)));
    }
  };
  // Preluare date → Din web: adresa unei pagini; tabelele ei vin ca foi (aceeași fereastră ca la documente), un .csv ca text.
  const [webDlg, setWebDlg] = useState<{ url: string; busy: boolean; err: string } | null>(null);
  const importWeb = async () => {
    if (!(await confirmDiscard())) return;
    setWebDlg({ url: '', busy: false, err: '' });
  };
  const fetchWeb = async () => {
    if (!webDlg || webDlg.busy) return;
    const u = normalizeUrl(webDlg.url);
    if (typeof u === 'string') { setWebDlg({ ...webDlg, err: u }); return; }
    setWebDlg({ ...webDlg, busy: true, err: '' });
    try {
      const r = api.webGet ? await api.webGet(u.href) : await (async () => {
        const res = await fetch(u.href);
        if (!res.ok) throw new Error(`Site-ul a răspuns cu eroarea ${res.status}.`);
        return { data: new Uint8Array(await res.arrayBuffer()), type: res.headers.get('content-type') ?? '', url: res.url || u.href };
      })();
      const fu = new URL(r.url);
      const file = { path: nameFromUrl(fu), data: r.data };
      if (isTextData(r.type, fu)) { setWebDlg(null); openTextDialog(file); return; }
      const html = webHtml(r.data, r.type);
      const { countTables } = await import('./docTables');
      const tables = countTables(html);
      if (!tables) {
        setWebDlg({ url: webDlg.url, busy: false, err: 'Pagina nu are niciun tabel. Unele site-uri își desenează tabelele abia în browser: încearcă o pagină mai simplă sau adresa unui .csv.' });
        return;
      }
      setWebDlg(null);
      setDocDlg({ file, html, tables });
    } catch (e) {
      const m = (e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
      setWebDlg({ url: webDlg.url, busy: false, err: m || 'Pagina nu a putut fi adusă.' });
    }
  };
  const finishDocTables = async (o: { layout: 'sheets' | 'stack'; paragraphs: boolean }) => {
    const dlg = docDlg;
    setDocDlg(null);
    if (!dlg) return;
    const { docTablesToBook } = await import('./docTables');
    let book;
    try { book = docTablesToBook(dlg.html, o); } catch (e) { setStatus(e instanceof Error ? e.message : String(e)); return; }
    await importXlsxData(dlg.file, book);
    setStatus(`Importat din ${fileName(dlg.file.path)}: ${book.tables === 1 ? 'un tabel' : `${book.tables} tabele`}`
      + (o.layout === 'sheets' && book.sheets.length > 1 ? `, fiecare pe foaia lui (filele de jos)` : ', pe o foaie')
      + '. Apasă Salvează ca să-l păstrezi ca tabel Cyber Office Studio.');
    focusGrid();
  };

  // Export .csv cu „;” și virgulă zecimală, cum îl citește Excel în română (cu BOM, ca să rămână diacriticele).
  // Fișier › Export e-Factura (XML) / Factură PDF, din foaia făcută cu modelul Factură (invoiceSheet.ts, efacturaOut.ts).
  // Întâi verificarea locală; PDF-ul se face din același XML (cu desenul din modulul PDF), ca să arate exact ce e în e-Factura.
  const exportInvoice = async (kind: 'xml' | 'pdf') => {
    finishEdit();
    const { readInvoice, rememberInvoice } = await import('./invoiceSheet');
    const { invoiceUbl, validateInvoice } = await import('./efacturaOut');
    const inv = readInvoice(cells);
    const errs = validateInvoice(inv);
    if (errs.length) {
      await ask('Factura are greșeli', errs.slice(0, 12).join('\n') + (errs.length > 12 ? `\n… și încă ${errs.length - 12}` : ''), ['Bine']);
      focusGrid();
      return;
    }
    const xml = invoiceUbl(inv);
    let data: Uint8Array;
    if (kind === 'xml') data = new TextEncoder().encode(xml);
    else {
      const { parseInvoice, invoicePdf } = await import('../pdf/efactura');
      data = await invoicePdf(parseInvoice(xml));
    }
    const res = await api.exportFile({ format: kind, suggestedName: safeFileName(`Factura ${inv.series} ${inv.number}`.trim()), data });
    if (res) {
      rememberInvoice(cells);
      setStatus(kind === 'xml' ? `e-Factura salvată: ${fileName(res.path)} (o încarci tu în SPV)` : `Factura PDF salvată: ${fileName(res.path)}`);
    }
    focusGrid();
  };

  // Fișier › Import e-Factura (XML): factura din SPV (XML sau arhiva ZIP) se deschide ca foaie Factură nouă, nesalvată, ca s-o
  // poți corecta sau refolosi și exporta din nou (efacturaIn.ts). Fișierul primit rămâne neatins.
  const importInvoice = async () => {
    finishEdit();
    if (!(await confirmDiscard())) { focusGrid(); return; }
    const file = await api.importFile('efactura');
    if (!file) { focusGrid(); return; }
    let read: import('./efacturaIn').InvoiceRead;
    try {
      const { invoiceXml } = await import('../pdf/efactura');
      const { readUbl } = await import('./efacturaIn');
      read = readUbl(await invoiceXml(file.data));
    } catch (e) {
      await ask('Nu pot citi factura', (e as Error).message, ['Bine']);
      focusGrid();
      return;
    }
    const { invoiceToCells } = await import('./invoiceSheet');
    const d = TEMPLATES.find((t) => t.id === 'factura')!.build();
    const nc = { ...d.sheets[0].cells };
    for (const [k, v] of Object.entries(invoiceToCells(read.invoice))) { if (v === '') delete nc[k]; else nc[k] = v; }
    d.sheets[0] = { ...d.sheets[0], cells: nc };
    d.title = fileName(file.path).replace(/\.(xml|zip)$/i, '');
    setDoc(d);
    setActive(0);
    setPath(null);
    setFromFile(file.path);
    setDirty(true);
    selectRange({ r: 2, c: 1 });
    editRef.current = null;
    setEdit(null);
    past.current = [];
    future.current = [];
    setStatus(`Factura adusă din ${fileName(file.path)}: o poți corecta și exporta din nou (Fișier → Export e-Factura).`);
    if (read.warnings.length) await ask('Verifică factura', read.warnings.join('\n'), ['Bine']);
    focusGrid();
  };

  // Fișier › Import extras de cont: CSV-ul exportat din bancă → tabel nou cu foile Extras (operațiunile, cu categorii)
  // și Rezumat (pe luni și categorii), nesalvat (bankStatement.ts). Fișierul băncii rămâne neatins.
  const importStatement = async () => {
    finishEdit();
    if (!(await confirmDiscard())) { focusGrid(); return; }
    const file = await api.importFile('statement');
    if (!file) { focusGrid(); return; }
    const { readStatement, statementDoc, cellsToRows, pdfToRows, savedRules } = await import('./bankStatement');
    const rules = savedRules();
    let read: import('./bankStatement').BankRead;
    try {
      if (/\.pdf$/i.test(file.path)) {
        // Extrasul PDF: textul din pagini, strâns în rânduri și coloane după antetul tabelului.
        const { pdfWords } = await import('./pdfWords');
        const { words } = await pdfWords(file.data);
        if (!words.length) throw new Error('PDF-ul nu are text (e scanat, doar poze). Fă-i întâi recunoașterea textului (OCR) în modulul PDF, salvează-l și încearcă din nou.');
        read = readStatement(pdfToRows(words), rules);
      } else if (/\.(xlsx|xlsm|xls|xlsb|f?ods)$/i.test(file.path)) {
        // Tabelul băncii (.xlsx / .xls / .ods): prima foaie în care se găsește tabelul cu operațiuni.
        const out = /\.f?ods$/i.test(file.path) ? await (await import('./ods')).readOds(file.data)
          : /\.xls[b]?$/i.test(file.path) ? await (await import('./xls')).readXls(file.data)
            : await (await import('./xlsx')).readXlsx(file.data);
        let found: import('./bankStatement').BankRead | null = null;
        let err: unknown = null;
        for (const s of out.sheets) {
          try { found = readStatement(cellsToRows(s.cells, s.styles), rules); break; } catch (e) { err ??= e; }
        }
        if (!found) throw err ?? new Error('Tabelul nu are nicio foaie.');
        read = found;
      } else {
        const text = decodeCsv(file.data);
        read = readStatement(parseCsv(text, detectDelimiter(text)), rules);
      }
    } catch (e) {
      await ask('Nu pot citi extrasul', (e as Error).message, ['Bine']);
      focusGrid();
      return;
    }
    setDoc(statementDoc(read, fileName(file.path).replace(/\.(pdf|csv|txt|xlsx|xlsm|xls|xlsb|f?ods)$/i, ''), rules));
    setActive(0);
    setPath(null);
    setFromFile(file.path);
    setDirty(true);
    selectRange({ r: 1, c: 0 });
    editRef.current = null;
    setEdit(null);
    past.current = [];
    future.current = [];
    setStatus(`Extras adus din ${fileName(file.path)}: ${read.txs.length} operațiuni. Rezumatul pe luni e în foaia Rezumat.`);
    if (read.warnings.length) await ask('Verifică extrasul', read.warnings.join('\n'), ['Bine']);
    focusGrid();
  };

  // Fișier › Aplică regulile de categorii (în tabelul unui extras): categoriile din foaia Extras se refac după foaia Reguli,
  // la fel Rezumatul; regulile se țin minte pentru extrasele următoare. Se poate anula cu Ctrl+Z.
  const applyBankRules = async () => {
    finishEdit();
    const { applyRules, saveRules } = await import('./bankStatement');
    const res = applyRules(doc);
    if (!res.rules.length) {
      await ask('Nu sunt reguli', 'Foaia Reguli nu are niciun rând cu cuvânt și categorie.', ['Bine']);
      focusGrid();
      return;
    }
    past.current.push({ sheets: doc.sheets, active });
    future.current = [];
    setDoc((d) => ({ ...d, sheets: res.sheets }));
    markDirty();
    saveRules(res.rules);
    setStatus(`Regulile s-au aplicat: ${res.changed} din ${res.total} operațiuni au altă categorie. Regulile se țin minte pentru extrasele următoare.`);
    focusGrid();
  };

  // Export CSV: fereastra cu separatorul și codificarea (alegerea rămâne pentru exportul următor, cât e deschisă aplicația).
  const [csvDlg, setCsvDlg] = useState<CsvExportOpts | null>(null);
  const csvLast = useRef<CsvExportOpts>({ sep: ';', enc: 'utf-8-bom' });
  const exportCsv = () => { finishEdit(); setCsvDlg({ ...csvLast.current }); };
  const doExportCsv = async (o: CsvExportOpts) => {
    csvLast.current = o;
    setCsvDlg(null);
    const enc = o.enc === 'utf-8-bom' ? 'utf-8' : o.enc;
    // Litere pe care codificarea aleasă nu le are (de exemplu „€” sau „ő” în altă limbă): tot fișierul în UTF-8, fără pierderi.
    const bytesOf = (text: string) => {
      const e = encodeText(text, enc, o.enc === 'utf-8-bom' || o.enc === 'utf-16le');
      return e.lost ? { data: encodeText(text, 'utf-8', true).data, lost: true } : { data: e.data, lost: false };
    };
    const base = safeFileName(doc.title || (path ? fileName(path).replace(/\.ssheet$/i, '') : 'Tabel'));
    if (o.all && doc.sheets.length > 1) {
      // Toate foile: câte un fișier „<registru> - <foaie>.csv”; primul se alege cu Salvează, celelalte se scriu lângă el (fără să înlocuiască nimic).
      const files = doc.sheets.map((s, i) => ({
        name: s.name,
        ...bytesOf(i === active ? cellsToCsv(cells, results, styles, o.sep)
          : cellsToCsv(s.cells, evaluateAll(s.cells, { self: s.name, sheets: doc.sheets, names: doc.names, pivots: doc.pivots, match: doc.match, iterate: doc.iter, ext: doc.links }), s.styles, o.sep)),
      }));
      const res = await api.exportFile({ format: 'csv', suggestedName: safeFileName(`${base} - ${files[0].name}`), data: files[0].data });
      if (!res) { focusGrid(); return; }
      const dir = res.path.slice(0, Math.max(res.path.lastIndexOf('/'), res.path.lastIndexOf('\\')));
      try {
        for (const f of files.slice(1)) await api.writeToFolder(dir, safeFileName(`${base} - ${f.name}`) + '.csv', f.data);
        setStatus(files.some((f) => f.lost) ? `Exportate ${files.length} fișiere .csv, câte unul pentru fiecare foaie, lângă ${fileName(res.path)} (unele în UTF-8: au litere pe care codificarea aleasă nu le poate scrie)`
          : `Exportate ${files.length} fișiere .csv, câte unul pentru fiecare foaie, lângă ${fileName(res.path)}`);
      } catch {
        setStatus(`Prima foaie e exportată în ${fileName(res.path)}, dar celelalte nu s-au putut scrie în același dosar.`);
      }
      focusGrid();
      return;
    }
    const { data, lost } = bytesOf(cellsToCsv(cells, results, styles, o.sep));
    const res = await api.exportFile({ format: 'csv', suggestedName: base, data });
    if (res) setStatus(lost ? `Exportat CSV în UTF-8: ${fileName(res.path)} (tabelul are litere pe care codificarea aleasă nu le poate scrie)`
      : `Exportat CSV: ${fileName(res.path)} (se scriu valorile, nu formulele`
      + `${doc.sheets.length > 1 ? `; doar foaia „${sheet.name}”` : ''})`);
    focusGrid();
  };

  // Import .xlsx: toate foile se deschid ca tabel nou (nesalvat); fișierul Excel rămâne neatins.
  // ---------- Date → Editare legături (registrele externe din formule) ----------
  /** Câte formule din registru iau valori din fiecare fișier legat. */
  const linkUses = (name: string) => {
    let n = 0;
    for (const s of doc.sheets) for (const t of Object.values(s.cells)) if (t.startsWith('=') && extBooksIn(t).includes(name.trim().toLocaleLowerCase('ro-RO'))) n++;
    for (const d of doc.names ?? []) if (extBooksIn(d.ref).includes(name.trim().toLocaleLowerCase('ro-RO'))) n++;
    return n;
  };
  /** Unde poate fi fișierul legat: calea ținută minte, apoi același nume lângă registrul de acum. */
  const linkCandidates = (l: ExtBook) => {
    const out: string[] = [];
    const abs = (p: string) => /^([A-Za-z]:[\\/]|[\\/]{2})/.test(p);
    const here = path ?? fromFile;
    const dir = here && /[\\/]/.test(here) ? here.replace(/[\\/][^\\/]*$/, '') : '';
    if (l.path && abs(l.path)) out.push(l.path);
    if (dir) {
      if (l.path && !abs(l.path)) out.push(dir + '\\' + l.path.replace(/^[.][\\/]/, '').replace(/[\\/]/g, '\\'));
      out.push(dir + '\\' + l.name);
    }
    return [...new Set(out)];
  };
  /** Citește un registru de pe disc și întoarce valorile foilor lui (formulele calculate). */
  const readLinkSheets = async (file: BinaryFile) => {
    const out = /\.f?ods$/i.test(file.path) ? await (await import('./ods')).readOds(file.data)
      : /\.xls[b]?$/i.test(file.path) ? await (await import('./xls')).readXls(file.data)
      : await (await import('./xlsx')).readXlsx(file.data);
    return linkSheetsFrom(out.sheets, 'links' in out ? out.links : undefined);
  };
  const setLink = (i: number, l: ExtBook) => {
    setDoc((d) => ({ ...d, links: (d.links ?? []).map((x, k) => (k === i ? l : x)) }));
    markDirty();
    setCalcTick((t) => t + 1);
  };
  const updateLink = async (i: number, quiet = false) => {
    const l = doc.links?.[i];
    if (!l) return false;
    for (const p of linkCandidates(l)) {
      let file: BinaryFile;
      try { file = await api.readBinary(p, 'sheets'); } catch { continue; }
      try {
        const sheets = await readLinkSheets(file);
        setLink(i, { ...l, path: file.path, sheets });
        setLinkMsg((m) => ({ ...m, [l.name]: 'Actualizat acum' }));
        if (!quiet) setStatus(`Am citit din nou valorile din „${l.name}” (${sheets.length} ${sheets.length === 1 ? 'foaie' : 'foi'})`);
        return true;
      } catch (e) {
        setLinkMsg((m) => ({ ...m, [l.name]: 'Nu se poate citi' }));
        if (!quiet) setStatus(`„${l.name}” nu a putut fi citit: ${e instanceof Error ? e.message : String(e)}`);
        return false;
      }
    }
    setLinkMsg((m) => ({ ...m, [l.name]: 'Fișierul nu e găsit' }));
    if (!quiet) setStatus(`Nu găsesc fișierul „${l.name}”. Alege-l cu Schimbă sursa…; până atunci formulele folosesc valorile păstrate.`);
    return false;
  };
  const runLink = async (job: () => Promise<unknown>) => { setLinkBusy(true); try { await job(); } finally { setLinkBusy(false); } };
  /** Deschide fișierul legat într-un tab nou (de la calea ținută minte sau de lângă registru). */
  const openLinkSource = (i: number) => runLink(async () => {
    const l = doc.links?.[i];
    if (!l) return;
    for (const p of linkCandidates(l)) {
      let file: BinaryFile;
      try { file = await api.readBinary(p, 'sheets'); } catch { continue; }
      if (!openInTab) { setStatus(`„${l.name}” e la ${file.path}; deschide-l dintr-o fereastră Cyber Office Studio nouă.`); return; }
      setLinksDlg(false);
      openInTab('sheets', { path: file.path, content: '', imported: file.data });
      return;
    }
    setLinkMsg((m) => ({ ...m, [l.name]: 'Fișierul nu e găsit' }));
    setStatus(`Nu găsesc fișierul „${l.name}”. Alege-l cu Schimbă sursa….`);
  });
  const updateAllLinks = () => runLink(async () => {
    let n = 0;
    for (let i = 0; i < (doc.links ?? []).length; i++) if (await updateLink(i, true)) n++;
    setStatus(`Am actualizat ${n} din ${doc.links?.length ?? 0} fișiere legate`);
  });
  const changeLink = (i: number) => runLink(async () => {
    const l = doc.links?.[i];
    if (!l) return;
    const file = await api.importFile('xlsx');
    if (!file) return;
    let sheets: ExtBook['sheets'];
    try { sheets = await readLinkSheets(file); } catch (e) { setStatus(`Fișierul nu a putut fi citit: ${e instanceof Error ? e.message : String(e)}`); return; }
    const name = fileName(file.path);
    if (/[[\]]/.test(name)) { setStatus('Numele fișierului nu poate avea paranteze drepte [ ].'); return; }
    remember();
    const ren = (t: string) => (t.startsWith('=') ? renameExtBook(t, l.name, name) : t);
    setDoc((d) => ({ ...d,
      sheets: d.sheets.map((s) => ({ ...s, cells: Object.fromEntries(Object.entries(s.cells).map(([id, t]) => [id, ren(t)])) })),
      ...(d.names ? { names: d.names.map((x) => ({ ...x, ref: renameExtBook(x.ref, l.name, name) })) } : {}),
      links: (d.links ?? []).filter((x, k) => k === i || x.name.toLocaleLowerCase('ro-RO') !== name.toLocaleLowerCase('ro-RO')).map((x) => (x === l ? { name, path: file.path, sheets } : x)) }));
    markDirty();
    setCalcTick((t) => t + 1);
    setLinkMsg((m) => ({ ...m, [name]: 'Sursă nouă' }));
    setStatus(`Formulele spre „${l.name}” iau acum valorile din „${name}”`);
  });
  const breakLink = (i: number) => {
    const l = doc.links?.[i];
    if (!l) return;
    const key = l.name.trim().toLocaleLowerCase('ro-RO');
    remember();
    let n = 0;
    const sheets = doc.sheets.map((s) => {
      const ids = Object.entries(s.cells).filter(([, t]) => t.startsWith('=') && extBooksIn(t).includes(key)).map(([id]) => id);
      if (!ids.length) return s;
      const res = evaluateAll(s.cells, { self: s.name, sheets: doc.sheets, names: doc.names, pivots: doc.pivots, match: doc.match, iterate: doc.iter, ext: doc.links });
      const cells = { ...s.cells };
      for (const id of ids) { cells[id] = resultCellText(res[id]); n++; }
      return { ...s, cells };
    });
    setDoc((d) => ({ ...d, sheets, ...(d.names ? { names: d.names.filter((x) => !extBooksIn(x.ref).includes(key)) } : {}), links: (d.links ?? []).filter((_, k) => k !== i) }));
    markDirty();
    setStatus(`Legătura cu „${l.name}” e ruptă: ${n} ${n === 1 ? 'formulă a devenit valoare' : 'formule au devenit valori'} (Ctrl+Z o aduce înapoi)`);
  };

  const importXlsx = async () => {
    if (busy() && openInTab) return importElsewhere('xlsx');
    if (!(await confirmDiscard())) return;
    const file = await api.importFile('xlsx');
    if (file) await importXlsxData(file);
  };
  const importXlsxData = async (file: BinaryFile, given?: import('./xlsx').XlsxImport) => {
    let out = given;
    if (!out) try {
      // .ods / .fods (LibreOffice) au propriul cititor, cu același rezultat ca la Excel.
      if (/\.f?ods$/i.test(file.path)) out = await (await import('./ods')).readOds(file.data);
      // .xls (Excel 97–2003) și .xlsb: SheetJS le transformă în .xlsx în memorie.
      else if (/[.]xls[b]?$/i.test(file.path)) out = await (await import('./xls')).readXls(file.data);
      else out = await (await import('./xlsx')).readXlsx(file.data);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Tabelul .xlsx nu a putut fi citit.');
      return;
    }
    const d = emptySheetDoc();
    d.title = fileName(file.path).replace(/\.(xlsx|xlsm|xlsb|xls|f?ods|docx|docm|f?odt|doc|rtf)$/i, '');
    d.sheets = out.sheets.map((x) => ({
      name: x.name, cells: x.cells, styles: x.styles, colW: x.colW,
      ...(x.freeze ? { freeze: x.freeze } : {}),
      ...(x.freezeCol ? { freezeCol: x.freezeCol } : {}),
      ...(x.charts.length ? { charts: x.charts } : {}),
      ...(x.pics?.length ? { pics: x.pics } : {}),
      ...(x.lists.length ? { lists: x.lists } : {}),
      ...(x.rules.length ? { rules: x.rules } : {}),
      ...(x.merges.length ? { merges: x.merges } : {}),
      ...(x.filter ? { filter: x.filter } : {}),
      ...(Object.keys(x.rowH).length ? { rowH: x.rowH } : {}),
      ...(x.hideRows?.length ? { hideRows: x.hideRows } : {}),
      ...(x.hideCols?.length ? { hideCols: x.hideCols } : {}),
      ...(x.rowLvl ? { rowLvl: x.rowLvl } : {}),
      ...(x.colLvl ? { colLvl: x.colLvl } : {}),
      ...(x.protect ? { protect: true } : {}),
      ...(x.protect && x.protectPw ? { protectPw: x.protectPw } : {}),
      ...(x.tab ? { tab: x.tab } : {}),
      ...(x.hidden ? { hidden: true } : {}),
      ...(x.noGrid ? { noGrid: true } : {}),
      ...(x.noHead ? { noHead: true } : {}),
      ...(x.noZero ? { noZero: true } : {}),
      ...(x.sparks?.length ? { sparks: x.sparks } : {}),
      ...(x.tables?.length ? { tables: x.tables } : {}),
      ...(x.scenarios?.length ? { scenarios: x.scenarios } : {}),
      ...(x.dataTables?.length ? { dataTables: x.dataTables } : {}),
      ...(x.solver ? { solver: x.solver } : {}),
      ...(x.print ? { print: x.print } : {}),
    }));
    if (out.names?.length) d.names = out.names;
    if (out.calc) d.calc = out.calc;
    // Proprietățile din fișier: titlul lui (dacă are) și subiectul, autorul, cuvintele cheie.
    if ('props' in out && out.props) {
      if (out.props.title) d.title = out.props.title;
      const pr = sheetProps(out);
      if (pr) d.props = pr;
    }
    if (out.iter) d.iter = out.iter;
    if ('links' in out && out.links?.length) d.links = out.links;
    if (out.lockBook) d.lockBook = out.lockBook;
    if ('cellStyles' in out && out.cellStyles?.length) d.cellStyles = out.cellStyles;
    if ('theme' in out && out.theme) d.theme = out.theme;
    if ('tableStyles' in out && out.tableStyles?.length) d.tableStyles = out.tableStyles;
    if (out.pivots?.length) d.pivots = out.pivots;
    if (out.match) d.match = out.match;
    setDoc(d);
    setActive(out.active);
    setPath(null);
    setFromFile(file.path);
    setDirty(true);
    selectRange({ r: 0, c: 0 });
    editRef.current = null;
    setEdit(null);
    past.current = [];
    future.current = [];
    setLinkBar(!!d.links?.length);
    const shown = out.sheets[out.active];
    const nCharts = out.sheets.reduce((n, x) => n + x.charts.length, 0);
    setStatus((out.repaired ? 'Fișierul era deteriorat și a fost reparat: s-a adus tot ce era întreg. ' : '') + signedNote(out.signers) + `Importat din ${fileName(file.path)}: `
      + (out.sheets.length > 1 ? `${out.sheets.length} foi (filele de jos); „${shown.name}” are ` : '')
      + `${shown.rows} rânduri, ${shown.cols} coloane`
      + (out.skipped ? `. ${out.skipped} ${out.skipped === 1 ? 'foaie nu a putut fi adusă' : 'foi nu au putut fi aduse'} (foi care sunt doar un grafic sau prea multe foi)` : '')
      + (nCharts ? `. ${nCharts === 1 ? 'Un grafic' : `${nCharts} grafice`} în panoul din dreapta` : '')
      + (out.chartsSkipped ? `. ${out.chartsSkipped} ${out.chartsSkipped === 1 ? 'grafic nu a putut fi adus' : 'grafice nu au putut fi aduse'} (tip necunoscut sau date din alte foi)` : '')
      + (out.picsSkipped ? `. ${out.picsSkipped} ${out.picsSkipped === 1 ? 'poză nu a putut fi adusă' : 'poze nu au putut fi aduse'} (desene EMF / WMF, poze legate din afară sau prea mari)` : '')
      + (out.asValues ? `. ${out.asValues} formule necunoscute în Cyber Office Studio au fost aduse ca valori` : '')
      + (d.links?.length ? `. Formulele iau valori din ${d.links.length === 1 ? 'alt fișier' : `${d.links.length} alte fișiere`} (păstrate în tabel; Date → 🔗 Editare legături le citește din nou)` : '')
      + (out.cut ? `. Atenție: tabelul are loc pentru ${ROWS} rânduri și ${COLS} coloane, restul nu a fost adus` : '')
      + '. Apasă Salvează ca să-l păstrezi ca tabel Cyber Office Studio.');
  };

  // Export .xlsx: toate foile; formulele rămân formule (cu nume englezești, cum le citește Excel), cu tot cu formatare.
  // Export .ods (OpenDocument): la fel, cu formulele în sintaxa OpenFormula (odsExport.ts); graficele și formatarea condiționată nu intră încă.
  // Octeții registrului ca .xlsx / .ods, cu foaia activă la zi (pentru Export și pentru Ctrl+S înapoi în .xlsx).
  const bookBytes = async (kind: 'xlsx' | 'ods') => {
    const book = doc.sheets.map((s, i) => (i === active
      ? { sheet: { ...s, cells, styles }, results }
      : { sheet: s, results: evaluateAll(s.cells, { self: s.name, sheets: doc.sheets, names: doc.names, pivots: doc.pivots, match: doc.match, iterate: doc.iter, ext: doc.links }) }));
    return kind === 'ods'
      ? await (await import('./odsExport')).writeOds(book, active, doc.links)
      : await (await import('./xlsx')).writeXlsx(book, active, doc.names, doc.calc === 'manual', doc.iter, doc.lockBook, docProps({ props: { ...doc.props, title: doc.title } }), doc.cellStyles, doc.theme, doc.links, doc.tableStyles);
  };
  const exportXlsx = async (kind: 'xlsx' | 'ods' = 'xlsx', withPassword = false, sign?: DigitalId, tsa?: TsaClient) => {
    finishEdit();
    const data = await bookBytes(kind);
    // Cu parolă: tabelul se deschide doar cu ea (și în alte programe de tabele).
    // Semnat digital: semnătura (XML-DSig) se pune în interiorul fișierului exportat.
    const locked = sign ? await signPackage(data, sign, tsa) : withPassword ? await (await import('../protect')).lockOffice(data, 'xlsx') : data;
    if (!locked) { focusGrid(); return; }
    const res = await api.exportFile({
      format: kind,
      suggestedName: safeFileName(doc.title || (path ? fileName(path).replace(/\.ssheet$/i, '') : 'Tabel')) + (sign ? ' (semnat)' : ''),
      data: locked,
    });
    if (sign) {
      if (!res) throw new Error('Nu ai ales unde se salvează: documentul nu s-a semnat.');
      setSignDlg(false);
      setStatus(`Tabel .xlsx semnat digital salvat: ${fileName(res.path)}. Nu-l mai modifica: orice schimbare strică semnătura.`);
      return;
    }
    if (res) setStatus(`Exportat .${kind}${withPassword ? ' cu parolă' : ''}: ${fileName(res.path)}`
      + (doc.sheets.length > 1 ? ` (${doc.sheets.length} foi)` : '')
      + (doc.sheets.some((x) => x.rules?.some((r) => suiteOnly(r.op))) ? '. Evidențierea codurilor CNP/CUI/IBAN greșite rămâne doar în Cyber Office Studio (alte programe nu le pot verifica).' : ''));
    focusGrid();
  };

  useEffect(() => {
    if (!dirty || !path || !shOpts.autosave) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => save(), AUTOSAVE_MS);
    return () => window.clearTimeout(timer.current);
  }, [dirty, path, save, shOpts.autosave]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isCurrent(tab)) return;
      // F12 = Salvare ca; Shift+F3 = Inserare funcție (și când se scrie o formulă).
      if (e.key === 'F12' && !e.ctrlKey && !e.altKey) { e.preventDefault(); finishEdit(); save(true); return; }
      if (e.key === 'F3' && e.shiftKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); fxBase.current = editRef.current; setFxDlg(true); return; }
      if (!e.ctrlKey) return;
      const k = e.key.toLowerCase();
      if (k === 's') { e.preventDefault(); save(e.shiftKey); }
      else if (k === 'o') { e.preventDefault(); open(); }
      else if (k === 'n') { e.preventDefault(); newSheet(); }
      else if (k === 'p') { e.preventDefault(); finishEdit(); setPrintDlg(true); }
      else if (k === 'f' || k === 'h') {
        e.preventDefault();
        finishEdit();
        setFind((f) => ({ mode: k === 'h' ? 'replace' : f?.mode ?? 'find', tick: (f?.tick ?? 0) + 1 }));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => { focusGrid(); }, []);

  // Capătul selecției rămâne mereu vizibil.
  useLayoutEffect(() => {
    if (!follow.current) { follow.current = true; return; }
    const wrap = gridRef.current;
    if (!wrap) return;
    const headPx = headH();
    const pos = shown.indexOf(ext.r);
    if (pos !== undefined) {
      // Rândurile înghețate acoperă o bucată de sus.
      const cover = headPx + (pos >= fzK ? topOf(fzK) : 0);
      const y = headPx + topOf(pos);
      const h = heightOf(ext.r);
      if (y < wrap.scrollTop + cover) wrap.scrollTop = Math.max(0, y - cover);
      else if (y + h > wrap.scrollTop + wrap.clientHeight) wrap.scrollTop = y + h - wrap.clientHeight;
    }
    let x = headW;
    for (let c = 0; c < ext.c; c++) x += widths[c];
    const w = widths[ext.c];
    // Coloanele înghețate acoperă o bucată din stânga.
    const coverX = ext.c >= fzLefts.length ? fzLeftEnd : headW;
    if (x - coverX < wrap.scrollLeft) wrap.scrollLeft = Math.max(0, x - coverX);
    else if (x + w > wrap.scrollLeft + wrap.clientWidth) wrap.scrollLeft = x + w - wrap.clientWidth;
    // Rândurile desenate se actualizează imediat după derularea de aici, fără să aștepte evenimentul de derulare
    // (care întârzie sau lipsește când fereastra e minimizată); altfel celula aleasă poate rămâne nedesenată.
    onGridScroll();
  }, [sel, ext]);

  // Înălțimea reală a unui rând și a capului (depinde de fontul din Windows), apoi fereastra vizibilă.
  useLayoutEffect(() => {
    const wrap = gridRef.current;
    if (!wrap) return;
    const row = wrap.querySelector('tbody tr[data-r]:not(.tall)');
    const head = wrap.querySelector('thead tr');
    // Pe ecran rândul apare de zoom ori mai mare; noi lucrăm în pixelii de la 100%.
    const z = zoom / 100;
    if (row && row.getBoundingClientRect().height > 0) sizes.current.rowPx = row.getBoundingClientRect().height / z;
    if (head && head.getBoundingClientRect().height > 0) sizes.current.headPx = head.getBoundingClientRect().height / z;
    const measure = () => setView((v) => (v.top === wrap.scrollTop && v.h === wrap.clientHeight && v.left === wrap.scrollLeft && v.w === wrap.clientWidth ? v : { top: wrap.scrollTop, h: wrap.clientHeight, left: wrap.scrollLeft, w: wrap.clientWidth }));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);
  // La alt zoom încap alte rânduri în fereastră.
  useEffect(() => {
    const wrap = gridRef.current;
    if (wrap) setView({ top: wrap.scrollTop, h: wrap.clientHeight, left: wrap.scrollLeft, w: wrap.clientWidth });
  }, [zoom]);
  const onGridScroll = () => {
    const wrap = gridRef.current;
    if (!wrap) return;
    // Pe orizontală contează doar la foile late (vezi colWin): acolo se desenează doar coloanele din jurul ecranului.
    const sameX = viewCols <= WIDE_COLS || (Math.abs(wrap.scrollLeft - view.left) < 200 && wrap.clientWidth === view.w);
    if (Math.abs(wrap.scrollTop - view.top) < sizes.current.rowPx * 3 && wrap.clientHeight === view.h && sameX) return;
    setView({ top: wrap.scrollTop, h: wrap.clientHeight, left: wrap.scrollLeft, w: wrap.clientWidth });
  };

  // Tragerea cu mouse-ul (selecție sau umplere) se termină oriunde ai da drumul butonului.
  useEffect(() => {
    const up = (e: MouseEvent) => {
      if (drag.current === 'fill') latest.current.finishFill();
      if (drag.current === 'move') latest.current.finishMove(e.ctrlKey);
      if (drag.current === 'sel') latest.current.applyPaint();
      drag.current = null;
    };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  const onGridKey = (e: React.KeyboardEvent) => {
    // Literele scrise foarte repede, înainte să apară căsuța de editare, nu se pierd.
    // (Orice tastă care nu ajunge într-o căsuță de text în timpul editării se adaugă la text.)
    if (editRef.current !== null && !(e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement)) {
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey) { e.preventDefault(); changeEdit(editRef.current + e.key); }
      else onEditKey(e);
      return;
    }
    if (edit !== null) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key;
    let handled = true;
    const sh = e.shiftKey;
    if (k === 'Escape' && painter) { setPainter(null); setStatus(''); }
    else if (k === 'Escape' && trace) { setTrace(null); setStatus(''); }
    // Scurtătura unei macrocomenzi (Ctrl+Shift+literă) are întâietate, ca în programele cunoscute.
    else if (ctrl && sh && !e.altKey && (macroForKey(doc.macros, e.code) ?? macroForKey(myMacros, e.code))) playMacro((macroForKey(doc.macros, e.code) ?? macroForKey(myMacros, e.code))!);
    // Ctrl+; data de azi, Ctrl+Shift+: ora (valori fixe, ca în programele cunoscute; merg și Ctrl+ș / Ctrl+Shift+, pe tastatura românească).
    else if (matches(e, 'Ctrl+;')) startEdit(nowText('date'));
    else if (matches(e, 'Ctrl+Shift+:')) startEdit(nowText('time'));
    // Formatele rapide cu Ctrl+Shift+semn, ca în programele cunoscute (pe tastatura românească: Ctrl+Shift+cifra de sub semn).
    else if (matches(e, 'Ctrl+Shift+~')) setFormat('general');
    else if (matches(e, 'Ctrl+Shift+!')) setFormat('number');
    else if (matches(e, 'Ctrl+Shift+@')) setFormat('time');
    else if (matches(e, 'Ctrl+Shift+#')) setFormat('date');
    else if (matches(e, 'Ctrl+Shift+$')) setFormat('lei');
    else if (matches(e, 'Ctrl+Shift+%')) setFormat('percent');
    else if (matches(e, 'Ctrl+Shift+^')) setFormat('sci');
    else if (matches(e, 'Ctrl+Shift+&')) applyCells({}, withLook(borderPatch(styles, upTo(range, Math.max(WORK_ROWS - 1, usedR)), 'outline'), lineLook));
    else if (matches(e, 'Ctrl+Shift+_')) applyCells({}, withLook(borderPatch(styles, upTo(range, Math.max(WORK_ROWS - 1, usedR)), 'none'), lineLook));
    else if (matches(e, 'Ctrl+1')) { finishEdit(); setFmtCellsDlg('num'); }
    // Ctrl+' : formula din celula de deasupra (exact cum e scrisă); Ctrl+Shift+" : valoarea ei. Se intră în editare.
    else if (matches(e, "Ctrl+'") && sel.r > 0) { setExt(sel); startEdit(editTextOf(cellId(sel.r - 1, sel.c))); }
    else if (matches(e, 'Ctrl+Shift+"') && sel.r > 0) { const up = cellId(sel.r - 1, sel.c); setExt(sel); startEdit(cells[up]?.startsWith('=') ? results[up]?.text ?? '' : cells[up] ?? ''); }
    else if (matches(e, 'Alt+F1')) addChart();
    else if (matches(e, 'Shift+F11') || matches(e, 'Alt+Shift+F1')) newTab();
    else if (matches(e, 'Shift+F9') || matches(e, 'Ctrl+Alt+F9')) { setCalcTick((t) => t + 1); setStatus(sh ? 'Am recalculat foaia (Shift+F9)' : 'Am recalculat tot registrul (Ctrl+Alt+F9)'); }
    else if (matches(e, 'Ctrl+F3') || matches(e, 'Ctrl+Shift+F3')) { finishEdit(); setNamesDlg(true); }
    else if (matches(e, 'Ctrl+Shift+U')) { setFxTall((v) => !v); if (!fxBar) setFxBar(true); }
    else if (matches(e, 'Ctrl+Shift+Home')) setExt({ r: 0, c: 0 });
    else if (matches(e, 'Ctrl+Backspace')) { gridRef.current?.querySelector(`tr[data-r="${sel.r}"]`)?.children[sel.c + 1]?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
    else if (e.altKey && !ctrl && (k === 'PageUp' || k === 'PageDown')) move(0, k === 'PageUp' ? -PAGE_C : PAGE_C, sh);
    else if (matches(e, 'Ctrl+2')) toggleStyle('b');
    else if (matches(e, 'Ctrl+3')) toggleStyle('i');
    else if (matches(e, 'Ctrl+4')) toggleStyle('u');
    // Shift+Space: rândul întreg; Ctrl+Space: coloana întreagă (pe toată înălțimea selecției / lățimea ei).
    else if (k === ' ' && sh && !ctrl) selectRange({ r: range.r0, c: 0 }, { r: range.r1, c: COLS - 1 }, false);
    else if (k === ' ' && ctrl && !sh) selectRange({ r: 0, c: range.c0 }, { r: ROWS - 1, c: range.c1 }, false);
    // F4 în afara editării repetă ultima formatare (pe celulele alese acum).
    else if (k === 'F4' && !ctrl && !sh && !e.altKey && lastFmt.current) styleRange(lastFmt.current);
    else if (e.altKey && sh && !ctrl && k === 'ArrowRight') groupIn(groupAxis(), 1);
    else if (e.altKey && sh && !ctrl && k === 'ArrowLeft') groupIn(groupAxis(), -1);
    // Alt+↑ / Alt+↓ pe o celulă cu buton rotativ: un pas în sus / în jos (altfel Alt+↓ deschide lista celulei).
    else if (e.altKey && !ctrl && !sh && (k === 'ArrowUp' || k === 'ArrowDown') && styles[selId]?.spin) spinCell(sel.r, sel.c, k === 'ArrowUp' ? 1 : -1);
    else if (e.altKey && !ctrl && !sh && (k === 'ArrowUp' || k === 'ArrowDown') && styles[selId]?.opt) optCell(sel.r, sel.c, 0, k === 'ArrowUp' ? -1 : 1);
    else if (e.altKey && k === 'ArrowDown') openPick(sel.r, sel.c, true);
    // Ctrl+Shift+* (și Ctrl+* de pe tastatura numerică): zona curentă din jurul celulei.
    else if (ctrl && !e.altKey && (k === '*' || e.code === 'NumpadMultiply' || (sh && e.code === 'Digit8'))) { const g = currentRegion(cells, sel.r, sel.c); finishEdit(); if (g) selectRange({ r: g.r0, c: g.c0 }, { r: g.r1, c: g.c1 }); }
    // Ctrl+[ : celulele folosite direct de formula celulei (cu mai multe zone, toate alese).
    else if (ctrl && !sh && !e.altKey && (k === '[' || e.code === 'BracketLeft')) {
      const gs = formulaRanges(cells[selId] ?? '');
      if (!gs.length) setStatus(`${selId} nu are formulă cu celule din foaia aceasta`);
      else { finishEdit(); selectRange({ r: gs[0].r0, c: gs[0].c0 }, { r: gs[0].r1, c: gs[0].c1 }); if (gs.length > 1) setExtra(gs.slice(1)); }
    }
    // Ctrl+Shift+O: toate celulele cu note.
    else if (ctrl && sh && !e.altKey && (k.toLowerCase() === 'o' || e.code === 'KeyO')) {
      const ps = Object.entries(styles).filter(([, st]) => st?.note).map(([id]) => parseCellId(id)).filter((p): p is Pos => !!p).sort((a, b) => a.r - b.r || a.c - b.c);
      if (!ps.length) setStatus('Pe foaia aceasta nu e nicio notă');
      else { finishEdit(); selectRange(ps[0], ps[0]); if (ps.length > 1) setExtra(ps.slice(1).map((p) => ({ r0: p.r, c0: p.c, r1: p.r, c1: p.c }))); setStatus(`${ps.length} ${ps.length === 1 ? 'celulă cu notă' : 'celule cu note'}`); }
    }
    else if (e.altKey && k === '=') autoSum('SUM');
    else if (ctrl && sh && k.toLowerCase() === 'l') toggleFilter();
    else if (ctrl && e.altKey && k.toLowerCase() === 'v') openPasteSpecial();
    else if (ctrl && (k === '9' || k === '(' || e.code === 'Digit9')) hideRowsIn(range.r0, range.r1, !sh);
    else if (ctrl && (k === '0' || k === ')' || e.code === 'Digit0')) hideColsIn(range.c0, range.c1, !sh);
    else if (ctrl && k.toLowerCase() === 'z') undo();
    else if (ctrl && k.toLowerCase() === 'y') redo();
    else if (ctrl && k.toLowerCase() === 'a') {
      const g = currentRegion(cells, sel.r, sel.c);
      const same = g && range.r0 === g.r0 && range.r1 === g.r1 && range.c0 === g.c0 && range.c1 === g.c1;
      if (g && !same && (g.r1 > g.r0 || g.c1 > g.c0)) selectRange({ r: g.r0, c: g.c0 }, { r: g.r1, c: g.c1 }, false);
      else selectRange({ r: 0, c: 0 }, { r: ROWS - 1, c: COLS - 1 }, false);
    }
    else if (ctrl && !sh && !e.altKey && k.toLowerCase() === 'q') openQuick();
    // Ctrl+T și Ctrl+L: Inserare → Tabel (tab nou e Ctrl+Alt+T). Ctrl+K: Legătură pe celula curentă.
    else if (ctrl && !sh && !e.altKey && (k.toLowerCase() === 'l' || k.toLowerCase() === 't' || e.code === 'KeyT')) { finishEdit(); setTblDlg(newTableDlg()); }
    else if (ctrl && !sh && !e.altKey && (k.toLowerCase() === 'k' || e.code === 'KeyK')) { finishEdit(); setLinkDlg(true); }
    else if (ctrl && !sh && !e.altKey && k.toLowerCase() === 'e') doFlashFill();
    else if (ctrl && !e.altKey && (k.toLowerCase() === 'd' || e.code === 'KeyD')) fillDir('down');
    else if (ctrl && !e.altKey && (k.toLowerCase() === 'r' || e.code === 'KeyR')) fillDir('right');
    else if (ctrl && k.toLowerCase() === 'g') nameBoxRef.current?.focus();
    else if (ctrl && (k === '`' || e.code === 'Backquote')) setShowF((v) => !v);
    else if (ctrl && k.toLowerCase() === 'b') toggleStyle('b');
    else if (ctrl && k.toLowerCase() === 'i') toggleStyle('i');
    else if (ctrl && k.toLowerCase() === 'u') toggleStyle('u');
    else if (ctrl && (k === '5' || e.code === 'Digit5')) toggleStyle('s');
    else if (ctrl && k === 'Home') selectRange({ r: 0, c: 0 });
    else if (ctrl && k === 'End') { if (sh) setExt(lastUsed()); else selectRange(lastUsed()); }
    else if (ctrl && k === 'ArrowUp') jump(-1, 0, sh);
    else if (ctrl && k === 'ArrowDown') jump(1, 0, sh);
    else if (ctrl && k === 'ArrowLeft') jump(0, -1, sh);
    else if (ctrl && k === 'ArrowRight') jump(0, 1, sh);
    else if (ctrl && (k === '+' || k === '-' || (k === '=' && sh))) insertKey(k === '-');
    else if (ctrl && sh && (k === 'PageDown' || k === 'PageUp')) { const next = visibleFrom(active, k === 'PageDown' ? 1 : -1); if (next !== active) { setGroup((g) => [...new Set([...(g.length ? g : [active]), next])]); switchSheet(next); } }
    else if (ctrl && k === 'PageDown') switchSheet(visibleFrom(active, 1));
    else if (ctrl && k === 'PageUp') switchSheet(visibleFrom(active, -1));
    else if (k === 'F5' && e.altKey) refreshPivots(e.ctrlKey);
    else if (k === 'F5' && !ctrl) nameBoxRef.current?.focus();
    else if (e.ctrlKey && e.altKey && (k.toLowerCase() === 'm' || e.code === 'KeyM')) { finishEdit(); setCmtDlg(true); }
    else if (ctrl) handled = false;
    else if (k === 'ArrowUp') move(-1, 0, sh);
    else if (k === 'ArrowDown') move(1, 0, sh);
    else if (k === 'ArrowLeft') move(0, -1, sh);
    else if (k === 'ArrowRight') move(0, 1, sh);
    else if (k === 'Tab') move(0, sh ? -1 : 1);
    else if (k === 'PageUp') move(-PAGE, 0, sh);
    else if (k === 'PageDown') move(PAGE, 0, sh);
    else if (k === 'Home') selectRange({ r: sel.r, c: 0 });
    else if (k === 'F7') { setSpellOpen(true); }
    else if (k === 'F9') { setCalcTick((t) => t + 1); setStatus('Am recalculat toate formulele (F9)'); }
    else if (sh && k === 'F2') setNoteDlg(true);
    else if (k === 'Enter' || k === 'F2') { setExt(sel); startEdit(editTextOf(selId)); }
    else if (k === 'Delete') clearRange();
    else if (k === 'Backspace') { setExt(sel); startEdit(''); enterMode.current = true; }
    else if (k === ' ' && styles[selId]?.chk) flipChecks();
    else if (k === ' ' && styles[selId]?.btn) runBtn(sel.r, sel.c);
    else if (k.length === 1 && !e.altKey) { setExt(sel); startEdit(k); enterMode.current = true; }
    else handled = false;
    if (handled) e.preventDefault();
  };

  const onEditKey = (e: React.KeyboardEvent) => {
    const hw = hintRef.current?.h.word;
    if (hw && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      const n = hw.list.length, by = e.key === 'ArrowDown' ? 1 : -1;
      setHint((h) => h && { ...h, pick: (h.pick + by + n) % n, nav: true });
      return;
    }
    // Enter pune funcția aleasă (ca Tab) când ce ai scris nu e deja o celulă, o funcție întreagă sau un nume definit.
    if (hw && e.key === 'Enter' && !e.altKey && !e.ctrlKey && !e.shiftKey && (hintRef.current!.nav || enterPicks(hw.text, ALL_FNS, (doc.names ?? []).map((n) => n.name)))) {
      e.preventDefault(); acceptHint(hw.list[Math.min(hintRef.current!.pick, hw.list.length - 1)].name); return;
    }
    if (hw && e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); acceptHint(hw.list[Math.min(hintRef.current!.pick, hw.list.length - 1)].name); return; }
    if (hw && e.key === 'Escape') { e.preventDefault(); hintOff.current = `${hw.start}:${hw.text}`; updateHint(); return; }
    if (matches(e, 'Ctrl+;') || matches(e, 'Ctrl+Shift+:')) {
      // În editare, data / ora se scriu la cursor.
      const t = e.currentTarget;
      if (!(t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement)) return;
      e.preventDefault();
      const ins = nowText(matches(e, 'Ctrl+;') ? 'date' : 'time');
      const s = t.selectionStart ?? t.value.length, en = t.selectionEnd ?? s;
      changeEdit(t.value.slice(0, s) + ins + t.value.slice(en));
      requestAnimationFrame(() => t.setSelectionRange(s + ins.length, s + ins.length));
      return;
    }
    if (e.key === 'F4') {
      e.preventDefault();
      const input = e.currentTarget;
      if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return;
      const res = cycleRef(input.value, input.selectionStart ?? input.value.length);
      if (res) {
        changeEdit(res.text);
        requestAnimationFrame(() => input.setSelectionRange(res.caret, res.caret));
      }
    } else if (e.key === 'Enter' && e.altKey) {
      // Alt+Enter: rând nou în celulă (ca în Excel); celula se încadrează singură la sfârșit.
      e.preventDefault();
      const t = e.currentTarget;
      const text = editRef.current ?? '';
      if (t instanceof HTMLTextAreaElement) {
        const a = t.selectionStart ?? text.length;
        const b = t.selectionEnd ?? a;
        changeEdit(text.slice(0, a) + '\n' + text.slice(b));
        requestAnimationFrame(() => t.setSelectionRange(a + 1, a + 1));
      } else changeEdit(text + '\n');
    } else if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); commitAll(); }
    else if (e.key === 'Enter') { e.preventDefault(); const [dr, dc] = ENTER_STEP[enterDir]; commit(e.shiftKey ? -dr : dr, e.shiftKey ? -dc : dc); }
    else if (e.key === 'Tab') { e.preventDefault(); commit(0, e.shiftKey ? -1 : 1); }
    else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    else if (e.key === 'F2' && !e.shiftKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); enterMode.current = !enterMode.current; }
    // Formula scrisă direct în celulă: după „=”, „+”, „(”, „;” etc. săgețile pun adresa celulei vecine în formulă (încă o săgeată o mută,
    // Shift+săgeată face o zonă A1:B5), ca în programul cunoscut; altfel formula se salvează și cursorul trece mai departe.
    // În bara de formulă și după dublu-clic / F2 săgețile aleg celule doar imediat după „=” sau un semn; în rest mută cursorul în text.
    else if (ARROW_STEP[e.key] && !e.ctrlKey && !e.altKey && (editRef.current ?? '').startsWith('=') && ((enterMode.current && !editInBar) || canPoint(e))) {
      const text = editRef.current ?? '';
      const input = e.currentTarget instanceof HTMLTextAreaElement || e.currentTarget instanceof HTMLInputElement ? e.currentTarget : null;
      const caret = input?.selectionStart ?? text.length;
      const last = refPick.current;
      const again = !!last && last.b === caret && last.text === text;
      const [dr, dc] = ARROW_STEP[e.key];
      e.preventDefault();
      if (again || /[=+\-*/^(;,:<>&]\s*$/.test(text.slice(0, caret))) {
        const from = again ? { r: last!.r, c: last!.c } : { r: sel.r, c: sel.c };
        const head = { r: clamp(from.r + dr, ROWS), c: clamp(from.c + dc, COLS) };
        const anchor = e.shiftKey ? (again ? { r: last!.ar ?? last!.r, c: last!.ac ?? last!.c } : from) : head;
        const r0 = Math.min(anchor.r, head.r), r1 = Math.max(anchor.r, head.r), c0 = Math.min(anchor.c, head.c), c1 = Math.max(anchor.c, head.c);
        const ref = r0 === r1 && c0 === c1 ? cellId(r0, c0) : `${cellId(r0, c0)}:${cellId(r1, c1)}`;
        const a = again ? last!.a : caret, b = again ? last!.b : caret;
        const next = text.slice(0, a) + ref + text.slice(b);
        changeEdit(next);
        refPick.current = { a, b: a + ref.length, text: next, r: head.r, c: head.c, ar: anchor.r, ac: anchor.c };
        if (input) requestAnimationFrame(() => input.setSelectionRange(a + ref.length, a + ref.length));
      } else if (!e.shiftKey) commit(dr, dc);
    }
    else if (ARROW_STEP[e.key] && enterMode.current && !editInBar && !e.shiftKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault(); const [dr, dc] = ARROW_STEP[e.key]; commit(dr, dc);
    }
  };

  // Zona copiată ajunge în clipboard ca tabel (coloane separate prin Tab), deci se poate lipi și în Excel.
  const onCopy = (e: React.ClipboardEvent, cut = false) => {
    if (edit !== null) return;
    e.preventDefault();
    if (extra.length) {
      // Ca în Excel: zonele separate nu se pot lipi corect ca un singur tabel.
      setStatus(`${cut ? 'Tăierea' : 'Copierea'} nu merge pe mai multe zone separate. Selectează o singură zonă (fără Ctrl) și încearcă din nou.`);
      return;
    }
    const lines: string[] = [];
    const copied: (CellStyle | undefined)[][] = [];
    // Pentru Word, Docs, Excel și e-mail: tabelul cu valorile afișate și formatarea (HTML).
    const shown: CopiedCell[][] = [];
    // Pentru Lipire specială: textul scris și valoarea afișată (rezultatul formulei, ca număr simplu).
    const raw: string[][] = [];
    const values: string[][] = [];
    for (let r = range.r0; r <= upTo(range, usedR).r1; r++) {
      if (hidden.has(r)) continue;
      const row: string[] = [];
      const rowStyles: (CellStyle | undefined)[] = [];
      const rowShown: CopiedCell[] = [];
      const rowRaw: string[] = [];
      const rowVal: string[] = [];
      for (let c = range.c0; c <= range.c1; c++) {
        // Ca în Excel: celula cu rânduri noi, Tab sau ghilimele se pune între ghilimele.
        const id = cellId(r, c);
        const v = cells[id] ?? '';
        row.push(/[\t\n"]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
        rowStyles.push(styles[id]);
        const res = results[id];
        rowShown.push({ text: cellText(cells[id], res, styles[id]), style: styles[id], num: res ? res.num && !res.err : isNumber(v) });
        rowRaw.push(v);
        rowVal.push(v.startsWith('=') && res ? (res.num && !res.err && res.value !== undefined ? String(res.value) : res.text) : v);
      }
      raw.push(rowRaw);
      values.push(rowVal);
      copied.push(rowStyles);
      lines.push(row.join('\t'));
      shown.push(rowShown);
    }
    const text = lines.join('\n');
    e.clipboardData.setData('text/plain', text);
    const widths = Array.from({ length: range.c1 - range.c0 + 1 }, (_, i) => widthOf(range.c0 + i));
    e.clipboardData.setData('text/html', tableHtml(shown, widths));
    clip.current = { text, r: range.r0, c: range.c0, cut, styles: copied, raw, values };
    if (cut) clearRange(true);
  };

  // Lipirea dintr-un tabel (Excel, Google Sheets, alt tabel Suite) umple mai multe celule.
  const onPaste = (e: React.ClipboardEvent) => {
    if (edit !== null) return;
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n').replace(/\n$/, '');
    if (!clip.current || clip.current.text !== text) {
      pasteOutside(text, e.clipboardData.getData('text/html'));
      return;
    }
    const patch: Cells = {};
    // Formulele copiate din tabel își mută referințele relative odată cu ele (doar la copiere, nu la tăiere).
    const from = clip.current;
    const own = from && from.text === text && !from.cut ? from : null;
    const dr = own ? range.r0 - own.r : 0;
    const dc = own ? range.c0 - own.c : 0;
    // Formatarea vine doar când lipești ce ai copiat sau tăiat chiar din Suite (din afară vine doar textul).
    const fromStyles = from && from.text === text ? from.styles : null;
    const stylePatch: Styles = {};
    const styleAt = (i: number, j: number) => {
      const st = fromStyles?.[i % fromStyles.length]?.[j % fromStyles[0].length];
      return st ? { ...st } : {};
    };
    const grid = parseTsv(text);
    if (grid.length === 1 && grid[0].length === 1 && multi) {
      // O singură celulă lipită peste o zonă selectată umple toată zona.
      eachCell(range, [cells, styles], (r, c) => {
        patch[cellId(r, c)] = own ? shiftFormula(grid[0][0], r - own.r, c - own.c) : grid[0][0];
        if (fromStyles) stylePatch[cellId(r, c)] = styleAt(0, 0);
      });
      applyCells(patch, stylePatch);
      return;
    }
    grid.forEach((line, i) => {
      line.forEach((v, j) => {
        const r = range.r0 + i;
        const c = range.c0 + j;
        if (r < ROWS && c < COLS) {
          patch[cellId(r, c)] = shiftFormula(v, dr, dc);
          if (fromStyles) stylePatch[cellId(r, c)] = styleAt(i, j);
        }
      });
    });
    applyCells(patch, stylePatch);
    if (grid.length > 1 || grid[0].length > 1) {
      const end = { r: clamp(range.r0 + grid.length - 1, ROWS), c: clamp(range.c0 + grid[0].length - 1, COLS) };
      selectRange({ r: range.r0, c: range.c0 }, end, false);
    }
  };

  // Lipire specială (Ctrl+Alt+V): merge cu ce s-a copiat în Suite.
  const openPasteSpecial = () => {
    finishEdit();
    const from = clip.current;
    if (!from) { setStatus('Copiază întâi celulele (Ctrl+C), apoi alege Lipire specială'); return; }
    if (from.cut) { setStatus('Lipirea specială merge după Copiere (Ctrl+C), nu după Tăiere'); return; }
    setPsDlg(true);
  };
  const doPasteSpecial = (o: PasteOpts) => {
    setPsDlg(false);
    const from = clip.current;
    if (!from) return;
    const out = pasteSpecial(from, { r: range.r0, c: range.c0 }, o, {
      raw: (id) => cells[id] ?? '',
      num: (id) => {
        const v = cells[id];
        if (!v) return null;
        const res = results[id];
        if (v.startsWith('=')) return res?.num && !res.err && res.value !== undefined ? res.value : null;
        return isNumber(v) ? Number(v.trim().replace(',', '.')) : null;
      },
      style: (id) => styles[id],
      shift: shiftFormula,
    });
    // Formatarea lipită se pune peste cea veche doar unde s-a cerut (la „Doar valorile” rămâne cea a celulei).
    applyCells(out.cells, out.styles);
    const rows = o.transpose ? from.raw[0].length : from.raw.length;
    const cols = o.transpose ? from.raw.length : from.raw[0].length;
    if (rows > 1 || cols > 1) selectRange({ r: range.r0, c: range.c0 }, { r: clamp(range.r0 + rows - 1, ROWS), c: clamp(range.c0 + cols - 1, COLS) }, false);
    focusGrid();
  };

  // Lipire din alt program: tabelul HTML (Excel, Google Sheets, web) aduce și formatarea simplă; altfel textul
  // cu Tab-uri. Numerele „1.234,56”, datele și procentele se recunosc ca la scris, iar celulele cu rânduri noi se încadrează.
  const pasteOutside = (text: string, html: string) => {
    const table = html ? parseHtmlTable(html) : null;
    const grid: PastedCell[][] = table ?? parseTsv(text).map((row) => row.map((t) => ({ text: t, style: {} })));
    const patch: Cells = {};
    const stylePatch: Styles = {};
    const put = (r: number, c: number, cell: PastedCell) => {
      const id = cellId(r, c);
      const entry = parseEntry(cell.text);
      patch[id] = entry.raw;
      const own = styles[id] ?? {};
      const next: CellStyle = { ...own, ...cell.style };
      if (entry.fmt && (!own.fmt || own.fmt === 'general')) next.fmt = entry.fmt;
      if (entry.raw.includes('\n')) next.wrap = true;
      if (JSON.stringify(next) !== JSON.stringify(own)) stylePatch[id] = next;
    };
    const single = grid.length === 1 && grid[0].length === 1;
    if (single && multi) {
      eachCell(range, [cells, styles], (r, c) => put(r, c, grid[0][0]));
      applyCells(patch, stylePatch);
      return;
    }
    let width = 0;
    grid.forEach((row, i) => {
      width = Math.max(width, row.length);
      row.forEach((cell, j) => {
        const r = range.r0 + i;
        const c = range.c0 + j;
        if (r < ROWS && c < COLS) put(r, c, cell);
      });
    });
    applyCells(patch, stylePatch);
    if (!single) {
      const end = { r: clamp(range.r0 + grid.length - 1, ROWS), c: clamp(range.c0 + width - 1, COLS) };
      selectRange({ r: range.r0, c: range.c0 }, end, false);
      if (range.r0 + grid.length > ROWS || range.c0 + width > COLS) setStatus('O parte din tabelul lipit nu a încăput în foaie și a fost lăsată deoparte.');
    }
  };

  // Click pe celulă: o selectează și începe tragerea; cu Shift, întinde selecția până la ea.
  const selectCell = (r: number, c: number, shift: boolean, ctrl = false, edges = '') => {
    // Apucată de marginea selecției: începe mutarea (cu Ctrl la eliberare, copierea).
    if (!shift && !ctrl && editRef.current === null && isMoveEdge(r, c, edges)) {
      drag.current = 'move';
      moveGrab.current = { r, c };
      setMoveBy({ dr: 0, dc: 0 });
      focusGrid();
      return;
    }
    // Ca în Excel: când scrii o formulă și ai pus „=”, „+”, „(”, „;” etc., click pe altă celulă îi pune referința
    // în formulă (în loc să închidă editarea). Încă un click pe altă celulă schimbă referința tocmai pusă.
    const text = editRef.current;
    if (text !== null && text.startsWith('=') && !(r === sel.r && c === sel.c)) {
      const input = document.activeElement instanceof HTMLTextAreaElement ? document.activeElement : null;
      const caret = input?.selectionStart ?? text.length;
      const last = refPick.current;
      const again = !!last && last.b === caret && last.text === text;
      if (again || /[=+\-*/^(;,:<>&]\s*$/.test(text.slice(0, caret))) {
        const a = again ? last!.a : caret;
        const b = again ? last!.b : caret;
        const ref = cellId(r, c);
        const next = text.slice(0, a) + ref + text.slice(b);
        changeEdit(next);
        refPick.current = { a, b: a + ref.length, text: next, r, c };
        if (input) requestAnimationFrame(() => input.setSelectionRange(a + ref.length, a + ref.length));
        // Ținând butonul apăsat și trăgând, referința devine o zonă (A1:B5).
        drag.current = 'ref';
        return;
      }
    }
    refPick.current = null;
    finishEdit();
    if (shift) setExt({ r, c });
    else if (ctrl) {
      // Ctrl+click: zona de până acum rămâne selectată, iar de aici începe una nouă (se poate și trage).
      const keep = [...extra, range];
      selectRange({ r, c });
      setExtra(keep);
      drag.current = 'sel';
    }
    else { selectRange({ r, c }); drag.current = 'sel'; }
    focusGrid();
  };

  const enterCell = (r: number, c: number) => {
    if (drag.current === 'sel') { follow.current = false; setExt({ r, c }); }
    else if (drag.current === 'fill') setFillTo({ r, c });
    else if (drag.current === 'move' && moveGrab.current) setMoveBy({ dr: r - moveGrab.current.r, dc: c - moveGrab.current.c });
    else if (drag.current === 'ref') {
      const last = refPick.current;
      if (!last || editRef.current !== last.text) return;
      const r0 = Math.min(last.r, r), r1 = Math.max(last.r, r), c0 = Math.min(last.c, c), c1 = Math.max(last.c, c);
      const ref = r0 === r1 && c0 === c1 ? cellId(r0, c0) : cellId(r0, c0) + ':' + cellId(r1, c1);
      const next = last.text.slice(0, last.a) + ref + last.text.slice(last.b);
      changeEdit(next);
      refPick.current = { ...last, b: last.a + ref.length, text: next };
      const input = document.activeElement instanceof HTMLTextAreaElement ? document.activeElement : null;
      const end = last.a + ref.length;
      if (input) requestAnimationFrame(() => input.setSelectionRange(end, end));
    }
  };

  const startFill = () => { finishEdit(); drag.current = 'fill'; setFillTo(null); focusGrid(); };

  // Marginea selecției (o singură zonă, fără rânduri sau coloane întregi) pe care stă mouse-ul: de acolo se poate trage.
  // edges: marginile celulei lângă care e mouse-ul („t” sus, „b” jos, „l” stânga, „r” dreapta).
  const isMoveEdge = (r: number, c: number, edges: string) => {
    if (!edges || extra.length || edit !== null || r < range.r0 || r > range.r1 || c < range.c0 || c > range.c1) return false;
    if (range.r1 - range.r0 >= ROWS - 1 || range.c1 - range.c0 >= COLS - 1) return false;
    return (edges.includes('t') && r === range.r0) || (edges.includes('b') && r === range.r1)
      || (edges.includes('l') && c === range.c0) || (edges.includes('r') && c === range.c1);
  };
  // Eliberarea după tragerea de margine: mută (sau, cu Ctrl, copiază) celulele în locul nou; formulele le urmează.
  const finishMove = (copy: boolean) => {
    const to = moveT;
    setMoveBy(null);
    moveGrab.current = null;
    if (!to || (to.r0 === range.r0 && to.c0 === range.c0)) return;
    if (sheet.protect) { setStatus('Foaia e protejată: celulele nu se pot muta'); return; }
    const overlaps = (m: string) => {
      const [a, b = a] = m.split(':'), p = parseCellId(a), q = parseCellId(b);
      return !!p && !!q && [range, to].some((g) => p.r <= g.r1 && q.r >= g.r0 && p.c <= g.c1 && q.c >= g.c0);
    };
    if ((sheet.merges ?? []).some(overlaps)) { setStatus('Mutarea nu merge peste celule îmbinate: anulează întâi îmbinarea'); return; }
    const out = moveCells(doc.sheets, active, range, to, copy);
    applySheets({ sheets: out.sheets, active });
    selectRange({ r: to.r0, c: to.c0 }, { r: to.r1, c: to.c1 }, false);
    const n = (range.r1 - range.r0 + 1) * (range.c1 - range.c0 + 1);
    const where = to.r0 === to.r1 && to.c0 === to.c1 ? cellId(to.r0, to.c0) : `${cellId(to.r0, to.c0)}:${cellId(to.r1, to.c1)}`;
    setStatus(`${copy ? 'Copiat' : 'Mutat'} ${n === 1 ? 'o celulă' : n + ' celule'} în ${where}`
      + (out.overwritten ? `; ${out.overwritten === 1 ? 'o celulă cu date a fost înlocuită' : out.overwritten + ' celule cu date au fost înlocuite'}` : '')
      + ' (Ctrl+Z anulează)');
  };

  // Tragerea peste literele coloanelor / numerele rândurilor: de unde a pornit și ce era ales înainte (cu Ctrl).
  const headDrag = useRef<{ axis: 'r' | 'c'; from: number; keep: Range[] | null } | null>(null);
  useEffect(() => { const up = () => { headDrag.current = null; }; window.addEventListener('mouseup', up); return () => window.removeEventListener('mouseup', up); }, []);
  const dragHead = (axis: 'r' | 'c', i: number) => {
    const d = headDrag.current;
    if (!d || d.axis !== axis) return;
    if (axis === 'c') selectRange({ r: 0, c: d.from }, { r: ROWS - 1, c: i }, false);
    else selectRange({ r: d.from, c: 0 }, { r: i, c: COLS - 1 }, false);
    if (d.keep) setExtra(d.keep);
  };
  // Click pe litera coloanei (r = -1) sau pe numărul rândului (c = -1) selectează toată coloana / tot rândul.
  const selectHead = (r: number, c: number, shift: boolean, ctrl = false) => {
    finishEdit();
    // Cu Ctrl, rândul / coloana se adaugă la selecția de până acum.
    const keep = ctrl ? [...extra, range] : null;
    headDrag.current = shift ? null : { axis: r < 0 ? 'c' : 'r', from: r < 0 ? c : r, keep };
    if (r < 0) selectRange({ r: 0, c: shift ? sel.c : c }, { r: ROWS - 1, c }, false);
    else selectRange({ r: shift ? sel.r : r, c: 0 }, { r, c: COLS - 1 }, false);
    if (keep) setExtra(keep);
    focusGrid();
  };

  // Click dreapta pe un rând (sau o coloană): dacă nu e deja în selecție, se selectează el.
  const openHeadMenu = (axis: Axis, i: number, x: number, y: number) => {
    finishEdit();
    const full = axis === 'r' ? range.c0 === 0 && range.c1 === COLS - 1 : range.r0 === 0 && range.r1 === ROWS - 1;
    const inSel = axis === 'r' ? i >= range.r0 && i <= range.r1 : i >= range.c0 && i <= range.c1;
    if (!full || !inSel) selectHead(axis === 'r' ? i : -1, axis === 'c' ? i : -1, false);
    setHeadMenu({ axis, x, y });
  };

  // Ascunde (sau afișează) coloanele c0..c1, ca în Excel (Ctrl+0 / Ctrl+Shift+0).
  const hideColsIn = (c0: number, c1: number, hide: boolean) => {
    setHeadMenu(null);
    finishEdit();
    const set = new Set(sheet.hideCols ?? []);
    let n = 0;
    for (let c = c0; c <= c1; c++) {
      if (hide ? !set.has(c + 1) : set.has(c + 1)) n++;
      if (hide) set.add(c + 1); else set.delete(c + 1);
    }
    if (hide && set.size >= COLS) { setStatus('Nu se pot ascunde toate coloanele'); return; }
    if (!n) { setStatus(hide ? 'Coloanele sunt deja ascunse' : 'În selecție nu sunt coloane ascunse. Selectează coloanele din stânga și din dreapta, apoi Afișează.'); focusGrid(); return; }
    const list = [...set].sort((a, b) => a - b);
    const next: Sheet = { ...sheet };
    if (list.length) next.hideCols = list; else delete next.hideCols;
    applySheet(next);
    if (hide) {
      let c = c1 + 1;
      while (c < COLS && set.has(c + 1)) c++;
      if (c >= COLS) { c = c0 - 1; while (c > 0 && set.has(c + 1)) c--; }
      selectRange({ r: sel.r, c: Math.max(0, c) });
    }
    setStatus(`${hide ? 'Am ascuns' : 'Am afișat'} ${n === 1 ? 'o coloană' : n + ' coloane'}${hide ? ' (clic dreapta pe coloanele din jur → Afișează, sau Ctrl+Shift+0)' : ''}`);
    focusGrid();
  };

  // Ascunde (sau afișează) rândurile r0..r1, ca în Excel (Ctrl+9 / Ctrl+Shift+9).
  const hideRowsIn = (r0: number, r1: number, hide: boolean) => {
    setHeadMenu(null);
    finishEdit();
    const set = new Set(sheet.hideRows ?? []);
    let n = 0;
    for (let r = r0; r <= r1; r++) {
      if (hide ? !set.has(r + 1) : set.has(r + 1)) n++;
      if (hide) set.add(r + 1); else set.delete(r + 1);
    }
    if (hide && set.size >= ROWS) { setStatus('Nu se pot ascunde toate rândurile'); return; }
    if (!n) { setStatus(hide ? 'Rândurile sunt deja ascunse' : 'În selecție nu sunt rânduri ascunse. Selectează rândurile de deasupra și de dedesubt, apoi Afișează.'); focusGrid(); return; }
    const list = [...set].sort((a, b) => a - b);
    const next: Sheet = { ...sheet };
    if (list.length) next.hideRows = list; else delete next.hideRows;
    applySheet(next);
    if (hide) {
      // Selecția trece pe primul rând vizibil de sub cele ascunse.
      let r = r1 + 1;
      while (r < ROWS && set.has(r + 1)) r++;
      if (r >= ROWS) { r = r0 - 1; while (r > 0 && set.has(r + 1)) r--; }
      selectRange({ r: Math.max(0, r), c: sel.c });
    }
    setStatus(`${hide ? 'Am ascuns' : 'Am afișat'} ${n === 1 ? 'un rând' : n + ' rânduri'}${hide ? ' (clic dreapta pe rândurile din jur → Afișează, sau Ctrl+Shift+9)' : ''}`);
    focusGrid();
  };

  // Gruparea rândurilor / coloanelor (Shift+Alt+→ / ←, ca Group din Excel): ⊟ / ⊞ pe rândul de sub grup (coloana din dreapta lui)
  // strânge sau desface grupul, iar butoanele 1, 2, 3… din colț arată doar nivelurile de sus (1 = doar totalurile).
  const rowGroups = useMemo(() => groupsOf(sheet.rowLvl), [sheet.rowLvl]);
  const colGroups = useMemo(() => groupsOf(sheet.colLvl), [sheet.colLvl]);
  const hideRowSet = useMemo(() => new Set(sheet.hideRows ?? []), [sheet.hideRows]);
  const hideColSet = useMemo(() => new Set(sheet.hideCols ?? []), [sheet.hideCols]);
  /** Ce se grupează din selecție: coloanele, dacă sunt selectate coloane întregi; altfel rândurile. */
  const groupAxis = (): Axis => (range.r0 === 0 && range.r1 >= ROWS - 1 && !(range.c0 === 0 && range.c1 >= COLS - 1) ? 'c' : 'r');
  const groupIn = (axis: Axis, by: 1 | -1) => {
    setHeadMenu(null);
    finishEdit();
    const key = axis === 'r' ? 'rowLvl' : 'colLvl', hk = axis === 'r' ? 'hideRows' : 'hideCols';
    const [a, b] = axis === 'r' ? [range.r0, range.r1] : [range.c0, range.c1];
    if (b - a + 1 >= (axis === 'r' ? ROWS : COLS)) { setStatus(axis === 'r' ? 'Selectează doar rândurile de grupat' : 'Selectează doar coloanele de grupat'); focusGrid(); return; }
    const { levels, changed } = regroup(sheet[key], a, b, by);
    const word = axis === 'r' ? (changed === 1 ? 'un rând' : changed + ' rânduri') : (changed === 1 ? 'o coloană' : changed + ' coloane');
    if (!changed) { setStatus(by > 0 ? 'Selecția e deja grupată de 7 ori (cel mai mult)' : 'În selecție nu e nimic grupat'); focusGrid(); return; }
    const next: Sheet = { ...sheet };
    if (levels) next[key] = levels; else delete next[key];
    if (by < 0 && sheet[hk]?.length) {
      // Ce era strâns în grupul scos se arată din nou (ca în Excel).
      const was = sheet[key] ?? {};
      const list = sheet[hk]!.filter((k) => !(k - 1 >= a && k - 1 <= b && (levels?.[String(k)] ?? 0) < (was[String(k)] ?? 0)));
      if (list.length) next[hk] = list; else delete next[hk];
    }
    applySheet(next);
    const btn = axis === 'r' ? `rândul ${b + 2}` : `coloana ${colName(b + 1)}`;
    setStatus(by > 0 ? `Am grupat ${word}: ⊟ de pe ${btn} le strânge (Shift+Alt+← degrupează)` : `Am degrupat ${word}`);
    focusGrid();
  };
  /** Strânge sau desface grupul al cărui buton e pe rândul (coloana) i. */
  const flipGroup = (axis: Axis, i: number) => {
    const g: Group | undefined = groupAt(axis === 'r' ? rowGroups : colGroups, i);
    if (!g) return;
    finishEdit();
    const hk = axis === 'r' ? 'hideRows' : 'hideCols';
    const shut = !isShut(g, axis === 'r' ? hideRowSet : hideColSet);
    const list = toggleGroup(sheet[hk], g, shut);
    const next: Sheet = { ...sheet };
    if (list.length) next[hk] = list; else delete next[hk];
    applySheet(next);
    if (shut && axis === 'r' && sel.r >= g.from && sel.r <= g.to) selectRange({ r: g.to + 1, c: sel.c });
    if (shut && axis === 'c' && sel.c >= g.from && sel.c <= g.to) selectRange({ r: sel.r, c: g.to + 1 });
    const n = g.to - g.from + 1;
    setStatus(`${shut ? 'Am strâns' : 'Am desfăcut'} grupul: ${axis === 'r' ? (n === 1 ? 'un rând' : n + ' rânduri') : (n === 1 ? 'o coloană' : n + ' coloane')}`);
    focusGrid();
  };
  /** Butonul n din colț: rândurile grupate cu nivel ≥ n se strâng, celelalte se desfac. */
  const groupLevel = (n: number) => {
    finishEdit();
    const list = showLevel(sheet.rowLvl, sheet.hideRows, n);
    const next: Sheet = { ...sheet };
    if (list.length) next.hideRows = list; else delete next.hideRows;
    applySheet(next);
    const now = new Set(list);
    if (now.has(sel.r + 1)) { let r = sel.r; while (r < ROWS - 1 && now.has(r + 1)) r++; selectRange({ r, c: sel.c }); }
    setStatus(n > maxLevel(sheet.rowLvl) ? 'Se văd toate rândurile grupate' : `Se vede nivelul ${n}${n === 1 ? ' (doar rândurile din afara grupurilor, de exemplu totalurile)' : ''}`);
    focusGrid();
  };
  /** Ce arată capul rândului (coloanei) i: nivelul grupului și butonul „-” / „+” dacă e rândul de sub un grup. */
  const olMark = (axis: Axis, i: number) => {
    const lv = (axis === 'r' ? sheet.rowLvl : sheet.colLvl)?.[String(i + 1)] ?? 0;
    const gs = axis === 'r' ? rowGroups : colGroups;
    const g = gs.length ? groupAt(gs, i) : undefined;
    return lv || g ? `${lv}${g ? (isShut(g, axis === 'r' ? hideRowSet : hideColSet) ? '+' : '-') : ''}` : '';
  };

  // Inserare (n > 0) sau ștergere (n < 0) de rânduri/coloane, într-un singur pas de anulare.
  const insertOrDelete = (axis: Axis, at: number, n: number) => {
    setHeadMenu(null);
    finishEdit();
    const what = axis === 'r' ? (Math.abs(n) === 1 ? 'rând' : 'rânduri') : (Math.abs(n) === 1 ? 'coloană' : 'coloane');
    if (n > 0 && wouldPushOut(sheet, axis, n)) {
      setStatus(`Nu pot insera: ultimele ${axis === 'r' ? 'rânduri' : 'coloane'} ale tabelului au date, care ar ieși afară`);
      focusGrid();
      return;
    }
    applySheets({ sheets: insertDelete(doc.sheets, active, axis, at, n), active });
    // Macrocomanda în înregistrare ține inserarea ca pas (la rulare se inserează din nou, cu formulele actualizate).
    if (rec && rec.sheet === sheet.name) setRec((r) => (r ? { ...r, steps: addStep(r.steps, { ins: { axis, at: r.rel ? at - (axis === 'r' ? r.from.r : r.from.c) : at, n } }) } : r));
    if (axis === 'r') selectRange({ r: at, c: 0 }, { r: at + Math.abs(n) - 1, c: COLS - 1 }, false);
    else selectRange({ r: 0, c: at }, { r: ROWS - 1, c: at + Math.abs(n) - 1 }, false);
    setStatus(`${n > 0 ? 'Am inserat' : 'Am șters'} ${Math.abs(n)} ${what}; formulele au fost actualizate (Ctrl+Z anulează)`);
  };

  // Ctrl+„+” / Ctrl+„-” pe rânduri sau coloane întregi selectate (ca în Excel).
  const insertKey = (del: boolean) => {
    const rows = range.c0 === 0 && range.c1 === COLS - 1;
    const cols = range.r0 === 0 && range.r1 === ROWS - 1;
    if (rows && !cols) insertOrDelete('r', range.r0, (del ? -1 : 1) * (range.r1 - range.r0 + 1));
    else if (cols && !rows) insertOrDelete('c', range.c0, (del ? -1 : 1) * (range.c1 - range.c0 + 1));
    else if (!rows && !cols) { finishEdit(); setCellsDlg({ del }); }
  };

  // Inserare / Ștergere celule (ca în Excel): mută doar celulele de sub selecție (în jos / în sus) sau din dreapta ei.
  const insertCells = (del: boolean, mode: CellShift) => {
    setCellsDlg(null);
    const h = range.r1 - range.r0 + 1, w = range.c1 - range.c0 + 1;
    if (mode === 'row') { insertOrDelete('r', range.r0, del ? -h : h); focusGrid(); return; }
    if (mode === 'col') { insertOrDelete('c', range.c0, del ? -w : w); focusGrid(); return; }
    const axis: Axis = mode === 'down' ? 'r' : 'c';
    const band: Band = axis === 'r' ? [range.c0, range.c1] : [range.r0, range.r1];
    const at = axis === 'r' ? range.r0 : range.c0;
    const n = (axis === 'r' ? h : w) * (del ? -1 : 1);
    if (n > 0 && wouldPushOut(sheet, axis, n, band)) {
      setStatus(`Nu pot insera: celulele de la capătul tabelului au date, care ar ieși afară`);
      focusGrid();
      return;
    }
    const merge = bandBlockedBy(sheet, axis, at, band);
    if (merge) {
      setStatus(`Nu pot muta celulele: îmbinarea ${merge} e tăiată de marginea selecției. Selectează și coloanele / rândurile ei sau anulează îmbinarea.`);
      focusGrid();
      return;
    }
    applySheets({ sheets: insertDelete(doc.sheets, active, axis, at, n, band), active });
    const zone = `${cellId(range.r0, range.c0)}${multi ? ':' + cellId(range.r1, range.c1) : ''}`;
    const where = del ? (axis === 'r' ? 'celulele de dedesubt au urcat' : 'celulele din dreapta s-au mutat la stânga')
      : (axis === 'r' ? 'celulele au coborât' : 'celulele s-au mutat la dreapta');
    setStatus(`${del ? 'Am șters' : 'Am inserat'} celulele ${zone}; ${where}, iar formulele au fost actualizate (Ctrl+Z anulează)`);
    focusGrid();
  };

  const startEditAt = (r: number, c: number) => {
    finishEdit();
    selectRange({ r, c });
    startEdit(editTextOf(cellId(r, c)), false, { r, c });
  };

  // Rândurile memorate primesc funcții care nu se schimbă, dar care cheamă mereu varianta nouă.
  const fresh = {
    selectCell, enterCell, startFill, autoFillDown, finishFill, finishMove, isMoveEdge, applyPaint, selectHead, dragHead, startEditAt, changeEdit, typeEdit, onEditKey, finishEdit,
    setColWidth, openMenu, openPick, openHeadMenu, setRowHeight, startRowResize, flipGroup, flipChecks, spinCell, optCell, runBtn, followLink, openQuick, setNtMenu,
  };
  const latest = useRef(fresh);
  latest.current = fresh;
  const handlers = useRef<RowHandlers>({
    onSelect: (r, c, shift, ctrl, edges) => latest.current.selectCell(r, c, shift, ctrl, edges),
    onMoveEdge: (r, c, edges) => latest.current.isMoveEdge(r, c, edges),
    onEnter: (r, c) => latest.current.enterCell(r, c),
    onFillStart: () => latest.current.startFill(),
    onFillAuto: () => latest.current.autoFillDown(),
    onRowHead: (r, shift, ctrl) => latest.current.selectHead(r, -1, shift, ctrl),
    onRowHeadEnter: (r) => latest.current.dragHead('r', r),
    onStartEdit: (r, c) => latest.current.startEditAt(r, c),
    onEdit: (v, typed, input) => latest.current.typeEdit(v, typed, input),
    onEditKey: (e) => latest.current.onEditKey(e),
    onBlurEdit: () => latest.current.finishEdit(),
    onFilterMenu: (c, x, y) => latest.current.openMenu(c, x, y),
    onPick: (r, c) => latest.current.openPick(r, c),
    onCheck: (r, c) => latest.current.flipChecks({ r, c }),
    onSpin: (r, c, d, set) => latest.current.spinCell(r, c, d, set),
    onOpt: (r, c, k) => latest.current.optCell(r, c, k),
    onBtn: (r, c) => latest.current.runBtn(r, c),
    onLink: (link) => latest.current.followLink(link),
    onRowMenu: (r, x, y) => latest.current.openHeadMenu('r', r, x, y),
    onRowResize: (r, e) => latest.current.startRowResize(r, e),
    onRowAuto: (r) => latest.current.setRowHeight(r, null),
    onOutline: (r) => latest.current.flipGroup('r', r),
    onQuick: (x, y) => latest.current.openQuick(x, y),
    onNumText: (x, y) => latest.current.setNtMenu({ x, y }),
  }).current;

  // Coloanele desenate: 40 ca înainte, iar foaia se lărgește singură (până la COLS) când are date sau cursorul mai la dreapta.
  // Toate coloanele desenate apar pe fiecare rând, deci mai puține coloane înseamnă derulare mai rapidă.
  const usedC = useMemo(() => {
    let c = -1;
    for (const m of [cells, styles]) for (const id of Object.keys(m)) { const p = parseCellId(id); if (p && p.c > c) c = p.c; }
    for (const g of merges) if (g.c1 > c) c = g.c1;
    return c;
  }, [cells, styles, merges]);
  const viewCols = Math.min(COLS, Math.max(VIEW_COLS, usedC + 2, sel.c + 2, ext.c + 2));
  const widths = Array.from({ length: viewCols }, (_, c) => widthOf(c));
  // Panourile înghețate: primele fzK rânduri vizibile stau lipite sus (sub literele coloanelor), fiecare la locul lui,
  // iar primele coloane stau lipite în stânga (lângă numerele rândurilor). fzLefts: unde începe fiecare coloană înghețată.
  const fzRows = cleanFreeze(sheet.freeze, MAX_FREEZE_ROWS);
  const fzCols = Math.min(cleanFreeze(sheet.freezeCol, MAX_FREEZE_COLS), viewCols);
  let fzK = 0;
  while (fzK < shown.length && shown.at(fzK)! < fzRows) fzK++;
  const fzLefts: number[] = [];
  let fzLeftEnd = headW;
  for (let c = 0; c < fzCols; c++) { fzLefts.push(fzLeftEnd); if (!hiddenC.has(c)) fzLeftEnd += widths[c]; }
  const fzLeftKey = fzLefts.join(',');
  // La foile late (peste WIDE_COLS coloane desenate) se desenează doar coloanele din jurul ecranului (cu 600 px în plus în
  // fiecare parte) și cele înghețate; celelalte sunt câte o celulă goală cât ele de lată. colWin = [fzCols, prima, ultima].
  const colWin = (() => {
    if (viewCols <= WIDE_COLS) return '';
    const lo = view.left - 600, hi = view.left + view.w + 600;
    let x = headW, b = fzCols, d = fzCols;
    for (let c = 0; c < viewCols; c++) {
      const w = hiddenC.has(c) ? 0 : widths[c];
      if (c >= fzCols && x + w <= lo) b = c + 1;
      if (x < hi) d = c;
      x += w;
    }
    b = Math.min(b, viewCols - 1); d = Math.max(b, d);
    // O celulă îmbinată se desenează întreagă: fereastra o cuprinde dacă o atinge.
    for (let k = 0; k < 3; k++) for (const g of merges) {
      if (g.c0 < b && g.c1 >= b) b = Math.max(fzCols, g.c0);
      if (g.c0 <= d && g.c1 > d) d = Math.min(viewCols - 1, g.c1);
    }
    return b > fzCols || d < viewCols - 1 ? `${fzCols}|${b}|${d}` : '';
  })();
  const fzTopOf = new Map<number, number>();
  for (let i = 0; i < fzK; i++) fzTopOf.set(shown.at(i)!, (noHead ? 0 : FROZEN_TOP) + topOf(i));
  const fzLast = fzK ? shown.at(fzK - 1)! : -1;
  // Săgețile urmăririi formulelor (ca Trace Precedents / Dependents): de la celulele folosite spre formulă,
  // sau de la celulă spre formulele care o folosesc; o zonă de mai multe celule are un chenar, iar săgeata pleacă din colțul ei.
  // Când scrii o formulă, celulele și zonele din ea au chenare colorate pe tabel (ca în programul cunoscut); cea aleasă
  // chiar acum cu săgețile sau cu clicul are chenarul punctat, care se mișcă, ca să se vadă unde ești.
  const formulaBoxes = (() => {
    if (edit === null || !edit.startsWith('=')) return null;
    const at = (r: number, c: number) => {
      if (c >= viewCols || hidden.has(r) || hiddenC.has(c)) return null;
      const pos = shown.indexOf(r);
      if (pos === undefined || pos < 0) return null;
      let x = headW;
      for (let k = 0; k < c; k++) if (!hiddenC.has(k)) x += widths[k];
      return { x, y: headH() + topOf(pos), w: widths[c], h: heightOf(r) };
    };
    const p = refPick.current && refPick.current.text === edit ? refPick.current : null;
    const live = p ? { r0: Math.min(p.r, p.ar ?? p.r), r1: Math.max(p.r, p.ar ?? p.r), c0: Math.min(p.c, p.ac ?? p.c), c1: Math.max(p.c, p.ac ?? p.c) } : null;
    const out: { x: number; y: number; w: number; h: number; color: string; live: boolean }[] = [];
    formulaRanges(edit).slice(0, 40).forEach((g, i) => {
      const a = at(g.r0, g.c0), b = at(g.r1, g.c1);
      if (!a || !b) return;
      out.push({ x: a.x, y: a.y, w: b.x + b.w - a.x, h: b.y + b.h - a.y, color: REF_COLORS[i % REF_COLORS.length],
        live: !!live && live.r0 === g.r0 && live.r1 === g.r1 && live.c0 === g.c0 && live.c1 === g.c1 });
    });
    return out.length ? out : null;
  })();
  const traceArrows = (() => {
    if (!trace) return null;
    const box = (r: number, c: number) => {
      if (c >= viewCols || hidden.has(r) || hiddenC.has(c)) return null;
      const pos = shown.indexOf(r);
      if (pos === undefined || pos < 0) return null;
      let x = headW;
      for (let k = 0; k < c; k++) if (!hiddenC.has(k)) x += widths[k];
      return { x, y: headH() + topOf(pos), w: widths[c], h: heightOf(r) };
    };
    const at = parseCellId(trace.id);
    const t = at && box(at.r, at.c);
    if (!at || !t) return null;
    const mid = (b: { x: number; y: number; w: number; h: number }) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
    const out: { from: { x: number; y: number }; to: { x: number; y: number }; area?: { x: number; y: number; w: number; h: number } }[] = [];
    if (trace.kind === 'p') {
      for (const g of formulaRanges(cells[trace.id] ?? '').slice(0, 100)) {
        const a = box(g.r0, g.c0);
        if (!a) continue;
        const multi = g.r1 > g.r0 || g.c1 > g.c0;
        const b = multi ? box(Math.min(g.r1, ROWS - 1), Math.min(g.c1, viewCols - 1)) : a;
        out.push({ from: mid(a), to: mid(t), area: multi && b ? { x: a.x, y: a.y, w: b.x + b.w - a.x, h: b.y + b.h - a.y } : undefined });
      }
    } else {
      for (const id of [...traceIds].slice(0, 200)) { const p = parseCellId(id); const b = p && box(p.r, p.c); if (b) out.push({ from: mid(t), to: mid(b) }); }
    }
    return out.length ? out : null;
  })();
  const notePops: { id: string; c: number; pos: number; note: string }[] = [];
  if (showNotes) {
    for (const [id, st] of Object.entries(styles)) {
      if (!st?.note) continue;
      const p = parseCellId(id);
      if (!p || p.c >= viewCols || hidden.has(p.r) || hiddenC.has(p.c)) continue;
      const pos = shown.indexOf(p.r);
      if (pos === undefined) continue;
      notePops.push({ id, c: p.c, pos, note: st.note });
      if (notePops.length >= 300) break;
    }
  }
  const widthsKey = widths.join(',');
  const across = useMemo(() => acrossWidths(cells, styles, widths), [cells, styles, widthsKey]);
  // Fereastra de rânduri desenate: cele vizibile plus 8 deasupra și dedesubt; restul e un spațiu gol cât ele.
  // Rândurile înghețate se desenează mereu primele (vezi mai jos).
  let winFirst = Math.max(0, indexAt(view.top) - 8);
  let winLast = Math.min(shown.length, indexAt(view.top + view.h) + 1 + 8);
  // O celulă îmbinată pe mai multe rânduri se desenează din primul ei rând, deci fereastra îl cuprinde mereu.
  for (const g of merges) {
    const a = shown.indexOf(g.r0);
    if (a === undefined || g.r0 === g.r1) continue;
    if (a < winFirst && g.r1 >= (shown.at(winFirst) ?? ROWS)) winFirst = a;
    if (a < winLast && g.r1 >= (shown.at(winLast) ?? ROWS)) winLast = Math.min(shown.length, (shown.indexOf(g.r1) ?? a) + 1);
  }
  // Rândurile înghețate de deasupra ferestrei se desenează mereu primele, ca să rămână lipite sus.
  const pinned = Math.min(fzK, winFirst);
  const winRows = shown.slice(0, pinned).concat(shown.slice(winFirst, winLast));
  const padTop = topOf(winFirst) - topOf(pinned);
  // Scindare: încă o fereastră de rânduri, cea a părții de jos (după fereastra de sus, cu un spațiu gol între ele dacă nu se ating).
  let win2First = winLast, win2Last = winLast;
  if (splitOn && view2) {
    const a = Math.max(0, indexAt(view2.top) - 8), b = Math.min(shown.length, indexAt(view2.top + view2.h) + 1 + 8);
    if (b > winLast) { win2First = Math.max(a, winLast); win2Last = b; }
    else if (a < winFirst) { win2First = Math.max(a, pinned); win2Last = Math.min(b, winFirst); }
    if (win2Last <= win2First) win2First = win2Last = winLast;
  }
  const before2 = win2Last <= winFirst;
  const rows2 = shown.slice(win2First, win2Last);
  const padMid = before2 ? topOf(winFirst) - topOf(win2Last) : topOf(win2First) - topOf(winLast);
  const padTop2 = before2 ? topOf(win2First) - topOf(pinned) : padTop;
  const padBottom = topOf(shown.length) - topOf(before2 ? winLast : win2Last);
  const rowEl = (r: number) => {
    const inR = r >= range.r0 && r <= range.r1;
    const ghost = fillT ?? moveT;
    const inF = ghost !== null && r >= ghost.r0 && r <= ghost.r1;
    return (
      <Row
        key={r}
        r={r}
        cells={qaCells?.cells ?? cells}
        results={qaCells?.results ?? results}
        styles={qaCells?.styles ?? styles}
        selCol={r === sel.r ? sel.c : -1}
        rc0={inR ? range.c0 : -1}
        rc1={inR ? range.c1 : -2}
        xr={extra.filter((x) => r >= x.r0 && r <= x.r1).map((x) => `${x.c0}-${x.c1}`).join(',')}
        fc0={inF ? ghost.c0 : -1}
        fc1={inF ? ghost.c1 : -2}
        handleCol={r === range.r1 && edit === null ? range.c1 : -1}
        qa={multi && r === range.r1 && edit === null && !qa}
        edit={r === sel.r && !editInBar ? edit : null}
        hidden={hidden.has(r)}
        gap={r > 0 && hidden.has(r - 1)}
        ol={olMark('r', r)}
        drop={filter && r === filter.r ? { c0: filter.c0, c1: filter.c1, on: filtered } : null}
        pick={r === sel.r && hasValues(selList) && !multi}
        looks={looks}
        bars={bars}
        across={across}
        mk={cmpRows.get(r)?.join(',') ?? ''}
        bad={badRows.get(r)?.join(',') ?? ''}
        trc={trace ? (traceRows.get(r)?.join(',') ?? '') : ''}
        pb={!!sheet.print?.breaks?.includes(r)}
        cpb={colBreakKey}
        pv={pageInfo ? `${r < pageInfo.g.r0 || r > pageInfo.g.r1 ? 'x' : pageInfo.rows.has(r) ? 'a' : ''}|${pageInfo.g.c0}|${pageInfo.g.c1}|${pageInfo.cols}` : ''}
        trk={trace?.kind ?? ''}
        mg={mlay.get(r)}
        height={tall.get(r)}
        n={viewCols}
        showF={showF}
        nz={!!sheet.noZero}
        ft={fzTopOf.get(r) ?? -1}
        fb={r === fzLast}
        fl={fzLeftKey}
        cw={colWin}
        h={handlers}
      />
    );
  };
  // Zoom pe selecție (ca Zoom la selecție): zona aleasă umple fereastra, apoi se derulează la ea.
  const zoomToSel = () => {
    const box = gridRef.current?.parentElement?.getBoundingClientRect();
    if (!box) return;
    let w = headW, h = headH();
    for (let c = range.c0; c <= Math.min(range.c1, range.c0 + 200); c++) w += widthOf(c);
    for (let r = range.r0, n = 0; r <= range.r1 && n < 5000; r++, n++) if (!hidden.has(r)) h += heightOf(r);
    const z = Math.floor(Math.min((box.width - 20) / w, (box.height - 20) / h) * 100);
    setZoom(z);
    setStatus(`Zoom pe selecție: ${clampZoom(z)}%`);
    requestAnimationFrame(() => {
      const wrap = gridRef.current;
      if (!wrap) return;
      let x = 0;
      for (let c = 0; c < range.c0; c++) x += widthOf(c);
      wrap.scrollLeft = x;
      wrap.scrollTop = topOf(shown.indexOf(range.r0) ?? 0);
    });
    focusGrid();
  };
  const filled = Object.keys(cells).length;
  const selRes = results[selId];
  // Pentru o zonă selectată, bara de jos arată suma, media și câte celule au ceva (ca în Excel).
  const stats = useMemo(() => {
    if (!multi && !extra.length) return null;
    let count = 0;
    let n = 0;
    let sum = 0;
    // Toate zonele (și cele adăugate cu Ctrl); o celulă din două zone se numără o singură dată.
    const seen = new Set<string>();
    for (const g of allRanges) {
      eachCell(upTo(g, usedR), [cells], (r, c) => {
        if (hidden.has(r)) return;
        const id = cellId(r, c);
        const raw = cells[id];
        if (!raw || seen.has(id)) return;
        seen.add(id);
        count++;
        const res = results[id];
        const x = res ? (res.err ? NaN : res.value ?? NaN) : isNumber(raw) ? Number(raw.trim().replace(',', '.')) : NaN;
        if (Number.isFinite(x)) { n++; sum += x; }
      });
    }
    return { count, n, sum };
  }, [multi, extra, allRanges, cells, results, hidden, usedR]);
  const filterRows = filter ? filterEnd(cells, filter) - filter.r : 0;
  // Clic dreapta pe o celulă: comenzile locului (aceleași ca în panglică).
  const [gridEl, setGridEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => { setGridEl(gridRef.current); }, []);
  useContextMenu(gridEl, (e) => {
    if (!(e.target instanceof Element) || !e.target.closest('td') || edit !== null) return [];
    const clip = (cmd: 'cut' | 'copy' | 'paste') => () => { focusGrid(); clipCmd(cmd); };
    const x = e.clientX, y = e.clientY;
    const hasList = hasValues(listAt(lists, sel.r, sel.c));
    const note = !!selStyle.note;
    const numText = numTextIds().length > 0;
    return [
      ...(numText ? [
        { label: 'Conversie în număr', run: convertNumText },
        { label: 'Ignorare eroare', run: ignoreNumText },
        { sep: true, label: '' },
      ] : []),
      { label: 'Decupare', run: clip('cut') },
      { label: 'Copiere', run: clip('copy') },
      { label: 'Lipire', run: clip('paste') },
      { label: 'Lipire specială…', run: openPasteSpecial },
      { label: 'Copiere ca imagine', run: () => void copyRangeImage() },
      { sep: true, label: '' },
      { label: 'Inserare…', run: () => { finishEdit(); setCellsDlg({ del: false }); } },
      { label: 'Ștergere…', run: () => { finishEdit(); setCellsDlg({ del: true }); } },
      { label: 'Golire conținut', run: () => { finishEdit(); clearRange(); focusGrid(); } },
      { sep: true, label: '' },
      { label: 'Analiză rapidă', enabled: multi, run: () => openQuick(x, y) },
      { label: 'Filtrare', submenu: [
        { label: 'Reaplicare', enabled: !!filter, run: reapplyFilter },
        { label: 'Golire filtru', enabled: !!filter, run: clearFilters },
        { sep: true, label: '' },
        { label: 'Filtrare după valoarea celulei selectate', run: () => filterByCell('value') },
        { label: 'Filtrare după culoarea celulei selectate', run: () => filterByCell('bg') },
        { label: 'Filtrare după culoarea fontului celulei selectate', run: () => filterByCell('fg') },
      ] },
      { label: 'Sortare', submenu: [
        { label: 'Sortare de la A la Z', run: () => sort(false) },
        { label: 'Sortare de la Z la A', run: () => sort(true) },
        { sep: true, label: '' },
        { label: 'Sortare particularizată…', run: openSortDlg },
      ] },
      { sep: true, label: '' },
      { label: selStyle.cmt?.length ? 'Răspunde la comentariu' : 'Comentariu nou', run: () => { finishEdit(); setCmtDlg(true); } },
      ...(selStyle.cmt?.length ? [{ label: 'Ștergere comentariu', run: () => { finishEdit(); saveComment([], false); } }] : []),
      { label: note ? 'Editare notă' : 'Notă nouă', run: () => { finishEdit(); setNoteDlg(true); } },
      ...(note ? [{ label: 'Ștergere notă', run: () => { finishEdit(); saveNote(''); } }] : []),
      { sep: true, label: '' },
      { label: 'Formatare celule…', run: () => { finishEdit(); setFmtCellsDlg('num'); } },
      { label: 'Alegere din listă verticală…', enabled: hasList, run: () => openPick(sel.r, sel.c) },
      { label: 'Definire nume…', run: () => { finishEdit(); setNamesDlg(true); } },
      { label: selStyle.link ? 'Editare link…' : 'Link…', run: () => { finishEdit(); setLinkDlg(true); } },
    ];
  });
  // Calcul automat / manual (din bara de stare și din Formule › Calcul).
  const toggleCalc = () => {
    setDoc((d) => { const n = { ...d }; if (manual) delete n.calc; else n.calc = 'manual'; return n; });
    markDirty();
    if (manual) setCalcTick((t) => t + 1);
    setStatus(manual ? 'Calcul automat: formulele se refac singure la fiecare schimbare' : 'Calcul manual: formulele se refac doar când apeși F9 (bun la tabele mari și lente)');
    focusGrid();
  };
  const filtered = filter ? [...Object.keys(filter.hidden), ...Object.keys(filter.cond ?? {}), ...Object.keys(filter.color ?? {})].join(',') : '';

  return (
    <div className="editor">
      <div className="sh-ribbon" onMouseDown={(e) => {
          // Butoanele nu iau focusul, ca tastele să meargă în continuare în tabel.
          if (!(e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement)) e.preventDefault();
        }}>
      <Ribbon module="sheets" layout={arrange.layout} className="toolbar formatbar" recent={{ kind: 'sheets', open: (p) => void openRecent(p) }}
        quick={<>
          <button onClick={() => save()} title="Salvează (Ctrl+S)" aria-label="Salvează">💾</button>
          <button onClick={undo} title="Ctrl+Z" aria-label="Anulează">↶</button>
          <button onClick={redo} title="Ctrl+Y" aria-label="Refă">↷</button>
        </>}
        file={<>
        <button onClick={newSheet} title="Ctrl+N">Nou</button>
        <button onClick={() => setTplDlg(true)} title="Tabele gata făcute: registru de casă, facturi, buget, inventar, deviz, salariu, decont de deplasare, plan de proiect, concedii, credit, consum carburant">Șabloane</button>
        <button onClick={open} title="Ctrl+O">Deschide</button>
        <button onClick={() => save()} title="Ctrl+S">Salvează</button>
        <button onClick={() => save(true)} title="F12 / Ctrl+Shift+S">Salvează ca…</button>
        <button onClick={() => { finishEdit(); setVerDlg(true); }} title="Variantele mai vechi ale fișierului, păstrate automat la salvare">Versiuni</button>
        <button onClick={() => { finishEdit(); setDraftDlg(true); }} title="Recuperează tabelele nesalvate: copiile păstrate automat în ultimele 7 zile, și după închiderea fără salvare">Recuperează…</button>
        <button onClick={() => { finishEdit(); setPropsDlg(true); }} title="Titlul, subiectul, autorul și cuvintele cheie ale tabelului (se păstrează și în .xlsx)">Proprietăți…</button>
        <button onClick={importCsv} title="Import din text: un fișier .csv, .txt, .tsv sau .prn (exportat din alt program, din bancă, din contabilitate). Codificarea, separatorul și zecimalele se recunosc singure; vezi primele rânduri înainte">Import CSV</button>
        <button onClick={importDocTables} title="Tabelele dintr-un document .docx, .odt, .doc sau .rtf, aduse ca foi: celulele unite rămân unite, numerele devin numere">Import .docx (tabele)</button>
        <button onClick={exportCsv} title="Salvează foaia ca .csv: alegi separatorul (de obicei „;”, cum îl citesc programele de tabele în română) și codificarea (UTF-8 sau Windows-1250 pentru programele vechi)">Export CSV…</button>
        <button onClick={importStatement} title="Extrasul de cont (fișierul .pdf, .csv, .xlsx sau .xls descărcat din bancă) ca tabel: data, descriere, încasări, plăți, sold, categorie și rezumat pe luni">Import extras de cont</button>
        {isStatementDoc(doc) && <button onClick={applyBankRules} title="Refă categoriile din foaia Extras după regulile din foaia Reguli (și Rezumatul); categoriile schimbate de mână se înlocuiesc. Regulile se țin minte pentru extrasele următoare">Aplică regulile de categorii</button>}
        <button onClick={importInvoice}title="Deschide o factură e-Factura (XML sau arhiva ZIP din SPV) ca foaie Factură, de corectat sau refolosit">Import e-Factura (XML)</button>
        {isInvoiceSheet(sheet) && <button onClick={() => exportInvoice('xml')} title="Fișierul e-Factura (XML UBL 2.1, CIUS-RO) al facturii din foaie, verificat înainte; îl încarci tu în SPV (nu se trimite nimic pe internet)">Export e-Factura (XML)</button>}
        {isInvoiceSheet(sheet) && <button onClick={() => exportInvoice('pdf')} title="Factura ca PDF pentru client, cu aceleași date ca în e-Factura">Factură PDF</button>}
        <button onClick={importXlsx} title="Deschide un tabel .xlsx (și cele vechi .xls / .xlsb) sau .ods, cu toate foile lui">Import .xlsx</button>
        <button onClick={() => exportXlsx()} title="Salvează tabelul ca fișier .xlsx, cu formule și formatare">Export .xlsx</button>
        <button onClick={() => exportXlsx('xlsx', true)} title="Export .xlsx cu parolă: tabelul se deschide doar cu parola (și în alte programe de tabele)" aria-label="Export .xlsx cu parolă">🔒</button>
        <button onClick={() => setSignDlg(true)} title="Export .xlsx semnat digital: semnătura (cu certificatul tău, de pe calculator sau token) stă în interiorul fișierului" aria-label="Export .xlsx semnat digital">🔏</button>
        <button onClick={() => exportXlsx('ods')} title="Salvează tabelul ca fișier OpenDocument (.ods), cu formule, formatare, îmbinări și note (graficele și formatarea condiționată nu intră încă)">Export .ods</button>
        <button onClick={() => { finishEdit(); setPrintDlg(true); }} title="Tipărește tabelul sau salvează-l ca PDF (Ctrl+P)">Tipărește / PDF</button>
        <button onClick={() => { finishEdit(); setOptDlg(true); }} title="Setările tabelului: încotro merge cursorul după Enter, valorile zero, liniile de grilă, titlurile, calculul">Opțiuni</button>
        </>}
        right={<>
        <input
          className="sheet-title"
          placeholder="Titlu tabel"
          value={doc.title}
          onChange={(e) => { setDoc((d) => ({ ...d, title: e.target.value })); markDirty(); }}
        />
        {arrange.menu}
        <span className="toolbar-file">{path ? fileName(path) : 'Tabel nou'}{dirty ? ' •' : ''}</span>
        </>}
        tabs={[
          { id: 'home', label: 'Pornire', content: <>
<ClipboardGroup focus={focusGrid}
        pasteItems={[{ label: 'Lipire specială…', title: 'Lipire specială (Ctrl+Alt+V): doar valorile, doar formatarea, transpunere, adună / înmulțește peste ce e în celule', run: openPasteSpecial }]}
        copyItems={[{ label: 'Copiere ca imagine', title: 'Copiere ca imagine: celulele selectate, cum se văd (valori, culori, chenare, grila), ca poză de lipit în documente, prezentări sau e-mail', run: () => void copyRangeImage() }]}
        launcher={{ title: 'Lipire specială (Ctrl+Alt+V)', run: openPasteSpecial }}
        painter={<button
          className={`fmt ${painter ? 'active' : ''}`}
          data-keytip="FP" data-txt="Format pensulă" aria-label="Format pensulă"
          onClick={() => togglePainter()}
          onDoubleClick={() => togglePainter(true)}
          title="Format pensulă: copiază formatarea celulelor selectate pe alte celule (click, apoi selectezi unde o pui; dublu-click o lasă pornită)"
        >🖌</button>} />
<RGroup label="Font" launcher={{ title: 'Formatare celule: font (Ctrl+1)', run: () => { finishEdit(); setFmtCellsDlg('font'); } }}>
<div className="rb-rows">
<div className="rb-row">
        <select data-keytip="FF"
          className="font-pick"
          value={selStyle.font ?? ''}
          onChange={(e) => { const v = e.target.value; styleRange((s) => { const n = { ...s }; if (v) n.font = v; else delete n.font; return n; }); focusGrid(); }}
          title="Fontul textului din celulele selectate"
          style={{ width: 120, fontFamily: selStyle.font ? `"${selStyle.font}"` : undefined }}
        >
          <option value="" title="Fontul de Corp al temei (fontul obișnuit al celulelor)">{themeFonts.minor + ' (Corp)'}</option>
          {themeFonts.major !== themeFonts.minor && <option value={themeFonts.major} title="Fontul de Titluri al temei" style={{ fontFamily: `"${themeFonts.major}"` }}>{themeFonts.major + ' (Titluri)'}</option>}
          {[...FONTS.filter((f) => f !== themeFonts.major), ...(selStyle.font && selStyle.font !== themeFonts.major && !FONTS.includes(selStyle.font) ? [selStyle.font] : [])].map((f) => <option key={f} value={f} style={{ fontFamily: `"${f}"` }}>{f}</option>)}
        </select>
        <select data-keytip="FS"
          value={selStyle.sz ?? ''}
          onChange={(e) => { const v = Number(e.target.value); styleRange((s) => { const n = { ...s }; if (v) n.sz = v; else delete n.sz; return n; }); focusGrid(); }}
          title="Mărimea textului (puncte)"
          style={{ width: 54 }}
        >
          <option value="">11</option>
          {[...FONT_SIZES.filter((n) => n !== 11), ...(selStyle.sz && !FONT_SIZES.includes(selStyle.sz) ? [selStyle.sz] : [])].sort((a, b) => a - b).map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <button className="fmt" data-keytip="FG" onClick={() => stepFontSize(1)} title="Mărire font" aria-label="Mărire font">A<sup>^</sup></button>
        <button className="fmt" data-keytip="FK" onClick={() => stepFontSize(-1)} title="Micșorare font" aria-label="Micșorare font">A<sub>˅</sub></button>
</div>
<div className="rb-row">
        <button className={`fmt ${selStyle.b ? 'active' : ''}`} data-keytip="1" onClick={() => toggleStyle('b')} title="Aldin (Ctrl+B)" aria-label="Aldin"><b>B</b></button>
        <button className={`fmt ${selStyle.i ? 'active' : ''}`} data-keytip="2" onClick={() => toggleStyle('i')} title="Cursiv (Ctrl+I)" aria-label="Cursiv"><i>I</i></button>
        <button className={`fmt ${selStyle.u ? 'active' : ''}`} data-keytip="3" onClick={() => toggleStyle('u')} title="Subliniere (Ctrl+U)" aria-label="Subliniere"><u>U</u></button>
        <RPop icon="▦" label="Borduri" keytip="B" title="Borduri: linii în jurul sau între celulele selectate, cu felul și culoarea liniei alese din aceeași listă">
          {BORDER_KINDS.map(([v, label]) => (
            <button key={v} role="menuitem" className="ribbon-menu-item" onMouseDown={(e) => e.preventDefault()}
              onClick={() => { applyCells({}, withLook(borderPatch(styles, upTo(range, Math.max(WORK_ROWS - 1, usedR)), v), lineLook)); focusGrid(); }}>
              <span className="ribbon-menu-check" />{label}
            </button>
          ))}
          <label className="rb-pop-field" title="Felul liniei de chenar: subțire, medie, groasă, dublă, întreruptă sau punctată (se pune și pe chenarele celulelor selectate)">
            Stil linie
            <select value={lineLook.st ?? ''} aria-label="Linia chenarului"
              onChange={(e) => setLine({ ...lineLook, st: (e.target.value || undefined) as LineStyle | undefined })}>
              {LINE_STYLES.map(([v, label]) => <option key={v || 'thin'} value={v}>{label}</option>)}
            </select>
          </label>
          <label className="rb-pop-field" title="Culoarea liniei de chenar (se pune și pe chenarele celulelor selectate)">
            Culoare linie
            <input type="color" aria-label="Culoarea chenarului" value={lineLook.col ?? '#000000'} onChange={(e) => setLine({ ...lineLook, col: e.target.value === '#000000' ? undefined : e.target.value })} />
          </label>
          <button role="menuitem" className="ribbon-menu-item" onMouseDown={(e) => e.preventDefault()} onClick={() => { finishEdit(); setFmtCellsDlg('border'); }}>
            <span className="ribbon-menu-check" />Mai multe borduri…
          </button>
        </RPop>
        <ColorMenu kind="fill" keytip="H" styles={undefined} palette={palette} current={selStyle.bg} last={lastFill}
          onPick={(c) => { if (c) setLastFill(c); styleRange((s) => { const n = { ...s }; if (c) n.bg = c; else delete n.bg; return n; }); }}>
          <span className="bg-swatch" style={{ background: lastFill }} />
        </ColorMenu>
        <ColorMenu kind="text" keytip="FC" styles={undefined} palette={palette} current={selStyle.color} last={lastInk}
          onPick={(c) => { if (c) setLastInk(c); styleRange((s) => { const n = { ...s }; if (c) n.color = c; else delete n.color; return n; }); }}>
          <span style={{ borderBottom: `3px solid ${lastInk}` }}>A</span>
        </ColorMenu>
<RMore>
        <button className={`fmt ${selStyle.s ? 'active' : ''}`} onClick={() => toggleStyle('s')} title="Tăiat (Ctrl+5)"><s>S</s></button>
        <button className={`fmt ${selStyle.pos === 'sup' ? 'active' : ''}`} onClick={() => togglePos('sup')} title="Exponent: textul celulei mai mic, sus (de exemplu m², 10³)" aria-label="Exponent">x²</button>
        <button className={`fmt ${selStyle.pos === 'sub' ? 'active' : ''}`} onClick={() => togglePos('sub')} title="Indice: textul celulei mai mic, jos (de exemplu H₂O)" aria-label="Indice">x₂</button>
</RMore>
</div>
</div>
</RGroup>
<RGroup label="Aliniere" launcher={{ title: 'Formatare celule: aliniere (Ctrl+1)', run: () => { finishEdit(); setFmtCellsDlg('align'); } }}>
<div className="rb-rows">
<div className="rb-row">
        {(['top', 'middle', 'bottom'] as const).map((a) => (
          <button
            key={a}
            className={`fmt ${selStyle.va === a ? 'active' : ''}`}
            data-keytip={{ top: 'AT', middle: 'AM', bottom: 'AB' }[a]}
            onClick={() => styleRange((s) => ({ ...s, va: s.va === a ? undefined : a }))}
            title={{ top: 'Aliniere sus', middle: 'Aliniere la mijloc', bottom: 'Aliniere jos' }[a]}
            aria-label={{ top: 'Aliniere sus', middle: 'Aliniere la mijloc', bottom: 'Aliniere jos' }[a]}
          >
            {{ top: '⤒', middle: '⇳', bottom: '⤓' }[a]}
          </button>
        ))}
        <RMenu label="⟲" keytip="FQ" ariaLabel="Orientare" active={!!selStyle.rot}
          title="Orientare: textul înclinat sau vertical (pentru capete de tabel înguste); rândul se face singur mai înalt"
          items={ROTATIONS.map(([v, label]) => ({ label, checked: (selStyle.rot ?? 0) === v, run: () => { styleRange((s) => { const n = { ...s }; if (v) n.rot = v; else delete n.rot; return n; }); focusGrid(); } }))} />
        <button
          className={`fmt ${selStyle.wrap ? 'active' : ''}`}
          data-keytip="W" aria-label="Încadrare text"
          onClick={() => styleRange((s) => ({ ...s, wrap: s.wrap ? undefined : true }))}
          title="Încadrare text: textul lung se rupe pe mai multe rânduri în celulă, iar rândul se face mai înalt"
        >
          ↵<span className="rb-opt"> Încadrare text</span>
        </button>
</div>
<div className="rb-row">
        {(['left', 'center', 'right'] as const).map((a) => (
          <button
            key={a}
            className={`fmt ${selStyle.align === a ? 'active' : ''}`}
            data-keytip={{ left: 'AL', center: 'AC', right: 'AR' }[a]}
            onClick={() => styleRange((s) => ({ ...s, align: s.align === a ? undefined : a }))}
            title={{ left: 'Aliniere la stânga', center: 'Centrare', right: 'Aliniere la dreapta' }[a]}
            aria-label={{ left: 'Aliniere la stânga', center: 'Centrare', right: 'Aliniere la dreapta' }[a]}
          >
            {{ left: '⯇', center: '≡', right: '⯈' }[a]}
          </button>
        ))}
        <button className="fmt" data-keytip="5" onClick={() => styleRange((s) => { const n = { ...s }; const v = (s.ind ?? 0) - 1; if (v > 0) n.ind = v; else delete n.ind; return n; })} disabled={!selStyle.ind} title="Micșorare indent (textul vine spre margine)" aria-label="Micșorare indent">⇤</button>
        <button className="fmt" data-keytip="6" onClick={() => styleRange((s) => ({ ...s, align: s.align === 'right' ? 'right' : 'left', ind: Math.min(MAX_IND, (s.ind ?? 0) + 1) }))} title="Mărire indent (textul se depărtează de margine)" aria-label="Mărire indent">⇥</button>
        <button
          className={`fmt ${mergeAt(merges, sel.r, sel.c) ? 'active' : ''}`}
          aria-label="Îmbinare și centrare"
          onClick={toggleMerge}
          title="Îmbinare și centrare: celulele selectate devin una singură, cu textul centrat (încă un clic le desparte)"
        >
          ⊞<span className="rb-opt"> Îmbinare și centrare</span>
        </button>
        <RMenu label="" keytip="M" ariaLabel="Îmbinare: variante" title="Îmbinare: variante"
          items={[
            { label: 'Îmbinare și centrare', run: () => mergeCells('center') },
            { label: 'Îmbinare în lățime', title: 'Îmbinare în lățime: fiecare rând al selecției se îmbină separat', run: () => mergeCells('across') },
            { label: 'Îmbinare celule', title: 'Îmbinare celule, fără să schimbe alinierea textului', run: () => mergeCells('plain') },
            { label: 'Anulare îmbinare celule', run: () => mergeCells('off') },
            { label: 'Centrare pe selecție (fără îmbinare)', sep: true, checked: selStyle.align === 'across', title: 'Textul din prima celulă se centrează peste celulele goale selectate, fără îmbinare (sortarea și filtrul merg mai departe)', run: () => { const on = selStyle.align !== 'across'; styleRange((s) => ({ ...s, align: on ? 'across' : undefined })); } },
          ]} />
</div>
</div>
</RGroup>
<RGroup label="Număr" launcher={{ title: 'Formatare celule: număr (Ctrl+1)', run: () => { finishEdit(); setFmtCellsDlg('num'); } }}>
<div className="rb-rows">
<div className="rb-row">
        <select data-keytip="N" value={selStyle.code ? 'custom' : selStyle.fmt ?? 'general'} title="Formatul numerelor" aria-label="Formatul numerelor" style={{ width: 150 }}
          onChange={(e) => { if (e.target.value === 'custom') setCodeDlg(selStyle.code ?? ''); else setFormat(e.target.value as NumFmt); }}>
          {NUM_FORMATS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          <option value="custom">Particularizat…</option>
        </select>
</div>
<div className="rb-row">
        <RMenu label="lei" keytip="AN" title="Format număr contabil: lei sau euro, cu zero scris ca „-”"
          items={[
            { label: 'Contabil 1.234,56 lei', run: () => setFormat('acct') },
            { label: 'Lei 1.234,56 lei', run: () => setFormat('lei') },
            { label: 'Euro 1.234,56 €', run: () => setFormat('eur') },
          ]} />
        <button className="fmt" data-keytip="P" onClick={() => setFormat('percent')} title="Stil procent (Ctrl+Shift+%)" aria-label="Stil procent">%</button>
        <button className="fmt" data-keytip="K" onClick={() => setFormat('number')} title="Stil virgulă: număr cu separator de mii și două zecimale (1.234,50)" aria-label="Stil virgulă">000</button>
        <button className="fmt" data-keytip="0" onClick={() => changeDecimals(1)} title="Mărire zecimale" aria-label="Mărire zecimale">,00</button>
        <button className="fmt" data-keytip="9" onClick={() => changeDecimals(-1)} title="Micșorare zecimale" aria-label="Micșorare zecimale">,0</button>
<RMore>
        <button className="fmt" onClick={() => setFormat('eur')} title="Format euro (1.234,56 €)">€</button>
        <button className="fmt" onClick={() => { finishEdit(); setFmtCellsDlg('num'); }} title="Formatare celule: număr, aliniere, font, chenar, umplere, protecție, toate într-o fereastră (Ctrl+1)" aria-label="Formatare celule">▦ Format…</button>
</RMore>
</div>
</div>
</RGroup>
<RGroup label="Stiluri">
        <RSplit icon="▥" label="Formatare condiționată" keytip="L"
          title="Formatare condiționată: celulele se colorează singure după valoare (de exemplu roșu dacă scrie „Neîncasat”), cu bare, scale de culori sau pictograme"
          items={[
            { label: 'Evidențiere reguli celule: Mai mare decât…', run: () => openCond('gt') },
            { label: 'Evidențiere reguli celule: Mai mic decât…', run: () => openCond('lt') },
            { label: 'Evidențiere reguli celule: Între…', run: () => openCond('between') },
            { label: 'Evidențiere reguli celule: Egal cu…', run: () => openCond('eq') },
            { label: 'Evidențiere reguli celule: Text care conține…', run: () => openCond('text') },
            { label: 'Evidențiere reguli celule: Valori dublate', run: () => quickRule('dup', 'red') },
            { label: 'Reguli primele / ultimele: Primele 10 elemente…', sep: true, run: () => openCond('top') },
            { label: 'Reguli primele / ultimele: Ultimele 10 elemente…', run: () => openCond('bottom') },
            { label: 'Reguli primele / ultimele: Peste medie', run: () => quickRule('above', 'green') },
            { label: 'Reguli primele / ultimele: Sub medie', run: () => quickRule('below', 'red') },
            ...(['blue', 'green', 'red', 'yellow'] as CondLook[]).map((k, i) => ({ label: `Bare de date: ${({ blue: 'albastru', green: 'verde', red: 'roșu', yellow: 'portocaliu', bold: '' } as Record<CondLook, string>)[k]}`, sep: i === 0, run: () => quickRule('databar', k) })),
            ...(Object.keys(SCALES) as CondLook[]).map((k, i) => ({ label: `Scale de culori: ${SCALES[k].label}`, sep: i === 0, run: () => quickRule('scale', k) })),
            ...(Object.keys(ICON_SETS) as CondLook[]).map((k, i) => ({ label: `Seturi de pictograme: ${ICON_SETS[k].label}`, sep: i === 0, run: () => quickRule('icons', k) })),
            { label: 'Regulă nouă…', sep: true, run: () => openCond('gt') },
            { label: 'Golire reguli din celulele selectate', run: () => clearRules(true) },
            { label: 'Golire reguli din toată foaia', run: () => clearRules(false) },
            { label: 'Gestionare reguli…', run: () => openCond(true) },
          ]} />
        <RSplit icon="▤" label="Formatare ca tabel" keytip="T"
          title="Formatare ca tabel: cap de tabel colorat, rânduri alternate, filtru și rând de total; alegi culoarea din listă"
          items={[
            ...galleryThemes(doc.tableStyles).map((k) => ({ label: `Stil tabel: ${TABLE_THEMES[k].label}`, run: () => { finishEdit(); setTblDlg({ theme: k, opts: lastTable.current.opts }); } })),
            { label: 'Mai multe opțiuni de tabel…', sep: true, run: () => { finishEdit(); setTblDlg({ ...lastTable.current }); } },
          ]} />
        <RSplit icon="◩" label="Stiluri celulă" keytip="J"
          title="Stiluri celulă: Bun, Rău, Neutru, titluri, Total, Intrare, Calcul, Notă… (tot formatul dintr-un clic)"
          items={[
            ...CELL_STYLES.map((cs) => ({ label: cs.label, run: () => { const own = builtinOverride(cs.label); if (own) { applyUserStyle(own); return; } finishEdit(); applyCellsDlg({ ...cs.ch, sty: cs.label } as StyleChanges, cs.border ?? null); setStatus('Stilul de celulă „' + cs.label + '” (Ctrl+Z îl scoate)'); } })),
            ...(doc.cellStyles ?? []).filter((u) => !isBuiltinName(u.name)).map((u, i) => ({ label: u.name, sep: i === 0, run: () => applyUserStyle(u) })),
            { label: 'Stil nou din celula curentă…', sep: true, run: newUserStyle },
            { label: '✎ Modifică un stil din celula curentă…', run: modifyUserStyle },
            ...(doc.cellStyles?.length ? [{ label: 'Șterge un stil nou…', run: deleteUserStyle }] : []),
          ]} />
</RGroup>
<RGroup label="Celule">
        <RSplit icon="⊞" label="Inserare" keytip="I" title="Inserare celule (Ctrl+„+”): celulele de dedesubt sau din dreapta se mută" run={() => { finishEdit(); setCellsDlg({ del: false }); }}
          items={[
            { label: 'Inserare celule…', run: () => { finishEdit(); setCellsDlg({ del: false }); } },
            { label: 'Inserare rânduri foaie', run: () => insertOrDelete('r', range.r0, range.r1 - range.r0 + 1) },
            { label: 'Inserare coloane foaie', run: () => insertOrDelete('c', range.c0, range.c1 - range.c0 + 1) },
          ]} />
        <RSplit icon="⊟" label="Ștergere" keytip="D" title="Ștergere celule (Ctrl+„-”): celulele de dedesubt sau din dreapta vin în loc" run={() => { finishEdit(); setCellsDlg({ del: true }); }}
          items={[
            { label: 'Ștergere celule…', run: () => { finishEdit(); setCellsDlg({ del: true }); } },
            { label: 'Ștergere rânduri foaie', run: () => insertOrDelete('r', range.r0, -(range.r1 - range.r0 + 1)) },
            { label: 'Ștergere coloane foaie', run: () => insertOrDelete('c', range.c0, -(range.c1 - range.c0 + 1)) },
          ]} />
        <RSplit icon="▦" label="Format" keytip="O" title="Format: mărimea rândurilor și coloanelor, ascundere și reafișare"
          items={[
            { label: 'Înălțime rând…', keytip: 'H', run: () => openSizeDlg('row') },
            { label: 'Potrivire automată înălțime rând', keytip: 'A', run: () => { for (const g of allRanges) setRowHeights(g.r0, g.r1, null); focusGrid(); } },
            { label: 'Lățime coloană…', keytip: 'W', run: () => openSizeDlg('col') },
            { label: 'Potrivire automată lățime coloană', keytip: 'I', run: () => { finishEdit(); setColWidths([...new Set(allRanges.flatMap((g) => colsIn(g.c0, g.c1)))], fitWidth); focusGrid(); } },
            { label: 'Lățime implicită', keytip: 'D', title: 'Coloanele selectate revin la lățimea obișnuită', run: () => { finishEdit(); setColWidths([...new Set(allRanges.flatMap((g) => colsIn(g.c0, g.c1)))], () => COL_W); focusGrid(); } },
            { label: 'Ascundere rânduri', keytip: 'UR', sep: true, run: () => hideRowsIn(range.r0, range.r1, true) },
            { label: 'Ascundere coloane', keytip: 'UC', run: () => hideColsIn(range.c0, range.c1, true) },
            { label: 'Reafișare rânduri', keytip: 'UO', run: () => hideRowsIn(range.r0, range.r1, false) },
            { label: 'Reafișare coloane', keytip: 'UL', run: () => hideColsIn(range.c0, range.c1, false) },
            { label: 'Redenumire foaie', keytip: 'R', sep: true, run: () => { finishEdit(); setRenaming(active); } },
            { label: 'Mutare, copiere, culoare filă…', keytip: 'M', title: 'Meniul foii curente: mutare, copiere, culoare filă, ascundere', run: () => { finishEdit(); const b = document.querySelector('.sheet-tab.active')?.getBoundingClientRect(); setTabMenu({ i: active, x: b ? b.left : 200, y: b ? b.top - 8 : 300 }); } },
            { label: sheet.protect ? 'Oprire protecție foaie…' : 'Protejare foaie…', keytip: 'P', run: () => void protection(sheet.protect ? 'off' : 'on') },
            { label: 'Blocare celulă', keytip: 'L', checked: !selStyle.unlock, title: 'Celulele blocate nu se pot schimba când foaia e protejată', run: () => void protection(selStyle.unlock ? 'lock' : 'unlock') },
            { label: 'Formatare celule… (Ctrl+1)', keytip: 'E', sep: true, run: () => { finishEdit(); setFmtCellsDlg('num'); } },
          ]} />
</RGroup>
<RGroup label="Editare">
<div className="rb-stack">
        <span className="rb-row">
          <button className="rb-small" data-keytip="US" onMouseDown={(e) => e.preventDefault()} onClick={() => autoSum('SUM')} aria-label="Însumare automată"
            title="Însumare automată (Alt+=): adună numerele de deasupra sau din stânga. Pe o zonă selectată pune totalul sub fiecare coloană">
            <span className="rb-ico">Σ</span><span className="rb-txt rb-opt">Însumare automată</span>
          </button>
          <RMenu label="" ariaLabel="Însumare automată: variante" title="Însumare automată: sumă, medie, contorizare numere, max, min"
            items={AUTO_FNS.map(([v, label]) => ({ label, run: () => autoSum(v) }))} />
        </span>
        <RMenu label="⇣ Umplere" keytip="FI" ariaLabel="Umplere" title="Umplere: copiază în jos sau la dreapta, serie de numere sau date, umplere rapidă"
          items={[
            { label: 'În jos (Ctrl+D)', run: () => fillDir('down') },
            { label: 'La dreapta (Ctrl+R)', run: () => fillDir('right') },
            { label: 'Serie…', run: () => { finishEdit(); setSeriesDlg(true); } },
            { label: 'Umplere rapidă (Ctrl+E)', run: () => doFlashFill() },
          ]} />
        <RMenu label="⌫ Golire" keytip="E" ariaLabel="Golire" title="Golire: conținutul, formatarea, notele sau legăturile celulelor selectate"
          items={[
            { label: 'Golire totală', run: () => { finishEdit(); clearRange(true); focusGrid(); } },
            { label: 'Golire formate', run: () => styleRange((s) => ({ ...(s.note ? { note: s.note } : {}), ...(s.cmt ? { cmt: s.cmt, ...(s.cdone ? { cdone: true } : {}) } : {}), ...(s.unlock ? { unlock: true } : {}), ...(s.link ? { link: s.link } : {}) })) },
            { label: 'Golire conținut (Delete)', run: () => { finishEdit(); clearRange(); focusGrid(); } },
            { label: 'Golire note', run: () => styleRange((s) => { const n = { ...s }; delete n.note; return n; }) },
            { label: 'Golire hyperlinkuri', run: () => styleRange((s) => { const n = { ...s }; delete n.link; return n; }) },
          ]} />
</div>
        <RSplit icon="⇅" label="Sortare și filtrare" keytip="S" title="Sortare și filtrare: A → Z, Z → A, sortare particularizată, filtru"
          items={[
            { label: 'Sortare de la A la Z', run: () => sort(false) },
            { label: 'Sortare de la Z la A', run: () => sort(true) },
            { label: 'Sortare particularizată…', run: openSortDlg },
            { label: 'Filtru (Ctrl+Shift+L)', sep: true, checked: !!filter, run: toggleFilter },
            { label: 'Golire filtre', run: clearFilters },
          ]} />
        <RSplit icon="🔍" label="Găsire și selectare" keytip="FD" title="Găsire și selectare: găsire, înlocuire, salt la o celulă, selectarea celulelor de un anumit fel"
          items={[
            { label: 'Găsire… (Ctrl+F)', run: () => { finishEdit(); setFind({ mode: 'find', tick: Date.now() }); } },
            { label: 'Înlocuire… (Ctrl+H)', run: () => { finishEdit(); setFind({ mode: 'replace', tick: Date.now() }); } },
            { label: 'Salt la… (Ctrl+G)', run: () => { finishEdit(); nameBoxRef.current?.focus(); nameBoxRef.current?.select(); } },
            { label: 'Salt la special…', run: () => { finishEdit(); setGsDlg(true); } },
            { label: 'Formule', sep: true, run: () => runGotoSpecial('formulas', ['num', 'text', 'bool', 'err']) },
            { label: 'Note', run: () => runGotoSpecial('notes', []) },
            { label: 'Formatare condiționată', run: () => runGotoSpecial('cond', []) },
            { label: 'Constante', run: () => runGotoSpecial('constants', ['num', 'text', 'bool', 'err']) },
            { label: 'Validare date', run: () => runGotoSpecial('valid', []) },
          ]} />
</RGroup>
          </> },
          { id: 'insert', label: 'Inserare', content: <>
{/* Ordinea grupurilor ca în programul de tabele cunoscut: Tabele · Ilustrații · Controale · Diagrame · Minidiagrame · Filtre · Linkuri · Comentarii · Text · Simboluri. */}
<RGroup label="Tabele">
        <button className="rb-big" data-keytip="V" onMouseDown={(e) => e.preventDefault()} onClick={() => openPivot()} title="Rezumat (tabel pivot): sume, numărări sau medii pe categorii, într-o foaie nouă" aria-label="Tabel Pivot">
          <span className="rb-ico">⊞</span><span className="rb-txt">Tabel Pivot</span>
        </button>
        <button className="rb-big" data-keytip="SP" onMouseDown={(e) => e.preventDefault()} onClick={() => openPivot()} title="Rezumate (tabele pivot) recomandate pentru datele tale: fereastra Rezumat, cu propunerile făcute dintr-un clic" aria-label="Tabele Pivot recomandate">
          <span className="rb-ico">★</span><span className="rb-txt">Tabele Pivot recomandate</span>
        </button>
        <button className="rb-big" data-keytip="T" onMouseDown={(e) => e.preventDefault()} onClick={() => { finishEdit(); setTblDlg(newTableDlg()); }} title="Tabel (Ctrl+T sau Ctrl+L): zona în care e cursorul devine tabel cu nume (Tabel1), cap colorat, filtru și rânduri alternante; se păstrează în .xlsx" aria-label="Tabel">
          <span className="rb-ico">▦</span><span className="rb-txt">Tabel</span>
        </button>
</RGroup>
<RGroup label="Ilustrații">
        <button className="rb-big" data-keytip="P" onMouseDown={(e) => e.preventDefault()} onClick={() => void addPic()} title="Imagine: o poză (siglă, fotografie) pusă peste celule, din dreptul celulei alese; se mută și se mărește cu mouse-ul" aria-label="Imagini">
          <span className="rb-ico">🖼</span><span className="rb-txt">Imagini</span>
        </button>
        {pics.find((q) => q.id === selPic)?.cell ? (
          <button className="rb-big" onMouseDown={(e) => e.preventDefault()} onClick={() => void cellPic()} title="Peste celule: poza aleasă iese din celulă și se poate muta și mări liber" aria-label="Peste celule">
            <span className="rb-ico">⧉</span><span className="rb-txt">Peste celule</span>
          </button>
        ) : (
          <button className="rb-big" onMouseDown={(e) => e.preventDefault()} onClick={() => void cellPic()} title="În celulă: poza aleasă (sau una nouă) intră în celulă, ia mărimea ei și se mută odată cu ea" aria-label="În celulă">
            <span className="rb-ico">▣</span><span className="rb-txt">În celulă</span>
          </button>
        )}
        <button className="rb-big" data-keytip="SH" onMouseDown={(e) => e.preventDefault()} onClick={() => { finishEdit(); setShDlg({ id: null, sh: { k: 'rect', fill: '#5b8def', stroke: '#1e3a8a', sw: 2, text: '', tc: '#ffffff', fs: 14, al: 'c' } }); }} title="Forme: dreptunghi, cerc, săgeți, stea, balon de vorbire, cu text în ele, puse peste celule (dublu-click pe formă o schimbă)" aria-label="Forme">
          <span className="rb-ico">⬠</span><span className="rb-txt">Forme</span>
        </button>
        <button className="rb-big" data-keytip="SA" onMouseDown={(e) => e.preventDefault()} onClick={() => { finishEdit(); setDgDlg({ id: null, d: newDiagram() }); }} title="Schemă: proces cu săgeți, listă, ciclu, piramidă sau ierarhie, din textele scrise câte unul pe rând, pusă peste celule (dublu-click pe ea o schimbă)" aria-label="Schemă">
          <span className="rb-ico">◇</span><span className="rb-txt">Schemă</span>
        </button>
        <button className="rb-big" data-keytip="IC" data-insert-icons onMouseDown={(e) => e.preventDefault()} onClick={() => { finishEdit(); setIconsDlg(true); }} title="Pictograme: desene simple (telefon, e-mail, oameni, săgeți, semne), în culoarea aleasă, puse peste celule ca poze" aria-label="Pictograme">
          <span className="rb-ico">☺</span><span className="rb-txt">Pictograme</span>
        </button>
        {iconsDlg && <IconsDialog onClose={() => setIconsDlg(false)} onInsert={(blobs, names, specs) => { setIconsDlg(false); void addIcons(blobs, names, specs); }} />}
        <button className="rb-big" data-keytip="3D" data-insert-model3d onMouseDown={(e) => e.preventDefault()} onClick={() => { finishEdit(); setM3dDlg({ id: null }); }} title="Modele 3D: un model .obj, .stl, .glb, .gltf sau .ply, rotit cu mouse-ul, pus peste celule ca poză (dublu-click pe el îl rotește altfel)" aria-label="Modele 3D">
          <span className="rb-ico">🧊</span><span className="rb-txt">Modele 3D</span>
        </button>
        {m3dDlg && <Model3DDialog initial={m3dDlg.init} onClose={() => setM3dDlg(null)} onInsert={(blob, name, src) => void putModel3d(blob, name, src)} />}
        <button className="rb-big" data-keytip="SC" onMouseDown={(e) => e.preventDefault()} onClick={() => { finishEdit(); void addShot(); }} title="Captură de ecran: poza unei ferestre deschise sau o bucată decupată din ecran, pusă peste celule" aria-label="Captură de ecran">
          <span className="rb-ico">📸</span><span className="rb-txt">Captură de ecran</span>
        </button>
        <button className="rb-big" data-keytip="DS" data-testid="sh-sketch" onMouseDown={(e) => e.preventDefault()} onClick={() => { finishEdit(); void addSketch(); }} title="Desen: desenează de mână cu creionul, markerul și radiera; desenul se pune peste celule, ca poză" aria-label="Desen">
          <span className="rb-ico">✏</span><span className="rb-txt">Desen</span>
        </button>
</RGroup>
<RGroup label="Controale">
        <button className="rb-big" data-keytip="CB" onMouseDown={(e) => e.preventDefault()} onClick={toggleCheckboxes} title="Casete de selectare în celulele alese (încă o dată le scoate). Bifate = ADEVĂRAT, nebifate = FALS, ca să le numeri cu COUNTIF sau să le folosești în formule" aria-label="Casetă de selectare">
          <span className="rb-ico">☑</span><span className="rb-txt">Casetă de selectare</span>
        </button>
        <button className="rb-big" data-keytip="CR" data-testid="sh-spin" onMouseDown={(e) => e.preventDefault()} onClick={openSpin} title="Buton rotativ sau bară de defilare în celulele alese: săgețile ▲ ▼ (sau bara trasă) schimbă numărul din celulă între un minim și un maxim, ca să încerci repede valori în formule" aria-label="Buton rotativ">
          <span className="rb-ico">⇕</span><span className="rb-txt">Buton rotativ</span>
        </button>
        <button className="rb-big" data-keytip="CO" data-testid="sh-opt" onMouseDown={(e) => e.preventDefault()} onClick={openOpt} title="Butoane de opțiune sau listă combo în celulele alese: alegi o variantă dintr-o listă, iar în celulă se scrie numărul ei (1, 2, …), ca să-l folosești în formule, de exemplu cu ALEGE sau INDEX" aria-label="Butoane de opțiune">
          <span className="rb-ico">◉</span><span className="rb-txt">Butoane de opțiune</span>
        </button>
        <button className="rb-big" data-keytip="CM" data-testid="sh-btn" onMouseDown={(e) => e.preventDefault()} onClick={openBtn} title="Buton cu macrocomandă în celulele alese: clic pe buton rulează macrocomanda aleasă, de la celula aleasă atunci" aria-label="Buton macro">
          <span className="rb-ico">▶</span><span className="rb-txt">Buton macro</span>
        </button>
</RGroup>
<RGroup label="Diagrame">
        <button className="rb-big" data-keytip="R" onMouseDown={(e) => e.preventDefault()} onClick={openRecommended} title="Diagrame recomandate: cele mai potrivite grafice pentru datele alese, cu previzualizare; clic pe unul îl pune" aria-label="Diagrame recomandate">
          <span className="rb-ico">★</span><span className="rb-txt">Diagrame recomandate</span>
        </button>
<div className="rb-stack">
        <button className="rb-small" data-keytip="PC" onMouseDown={(e) => e.preventDefault()} onClick={() => openPivot(true)} title="Grafic pivot: un rezumat (tabel pivot) al tabelului cu cursorul, într-o foaie nouă, cu un grafic din cifrele lui; se reîmprospătează împreună (Alt+F5)" aria-label="Grafic pivot">
          <span className="rb-ico">📶</span><span className="rb-txt">Grafic pivot</span>
        </button>
        <button className="rb-small" data-keytip="N" onMouseDown={(e) => e.preventDefault()} onClick={() => addChart()} title="Diagramă (grafic) din celulele selectate (sau din tabelul în care e cursorul)" aria-label="Diagramă">
          <span className="rb-ico">📊</span><span className="rb-txt">Diagramă</span>
        </button>
        {panelCharts.length > 0 && (
          <button className={`rb-small ${showCharts ? 'active' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => setShowCharts((v) => !v)} title="Arată sau ascunde panoul cu grafice" aria-label="Panoul cu grafice">
            <span className="rb-ico">▣</span><span className="rb-txt">Grafice ({panelCharts.length})</span>
          </button>
        )}
</div>
</RGroup>
<RGroup label="Minidiagrame">
        <button className="rb-big" data-keytip="SN" onMouseDown={(e) => e.preventDefault()} onClick={() => sparkAction('line')} title="Minidiagramă linie: o linie mică în celula din dreapta fiecărui rând de numere selectat" aria-label="Linie">
          <span className="rb-ico">📈</span><span className="rb-txt">Linie</span>
        </button>
        <button className="rb-big" data-keytip="SO" onMouseDown={(e) => e.preventDefault()} onClick={() => sparkAction('col')} title="Minidiagramă coloană: coloane mici în celula din dreapta fiecărui rând de numere selectat" aria-label="Coloană">
          <span className="rb-ico">📶</span><span className="rb-txt">Coloană</span>
        </button>
        <button className="rb-big" data-keytip="SL" onMouseDown={(e) => e.preventDefault()} onClick={() => sparkAction('winloss')} title="Minidiagramă câștig / pierdere: sus pentru plus, jos pentru minus, în celula din dreapta fiecărui rând selectat" aria-label="Câștig/ pierdere">
          <span className="rb-ico">±</span><span className="rb-txt">Câștig/ pierdere</span>
        </button>
<RMore>
        <select
          className="fmt"
          value=""
          aria-label="Minigrafic"
          title="Minigrafic: o linie sau coloane mici chiar în celulă, din numerele selectate (câte unul pe fiecare rând, în celula din dreapta); pe o celulă cu minigrafic îi schimbă felul"
          onChange={(e) => { if (e.target.value) sparkAction(e.target.value); }}
        >
          <option value="">Minigrafic…</option>
          {SPARK_KINDS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          <option value="remove">Scoate minigraficul</option>
        </select>
</RMore>
        {sparkHere && (
          <input type="color" className="fmt" value={sparkHere.color ?? '#2f6fdf'} aria-label="Culoarea minigraficului"
            title="Culoarea minigraficului (și a celorlalte minigrafice din zona aleasă); valorile negative rămân roșii"
            onChange={(e) => sparkColor(e.target.value)} style={{ width: 30, padding: 1 }} />
        )}
</RGroup>
<RGroup label="Filtre">
        <button className="rb-big" data-keytip="SF" onMouseDown={(e) => e.preventDefault()} onClick={addSlicer} title="Butoane de filtrare (slicer) pentru coloana cu cursorul: câte un buton pe fiecare valoare, un clic arată doar rândurile cu ea" aria-label="Slicer">
          <span className="rb-ico">▤</span><span className="rb-txt">Slicer</span>
        </button>
        <button className="rb-big" data-keytip="TI" onMouseDown={(e) => e.preventDefault()} onClick={addTimeline} title="Cronologie pentru coloana cu date de sub cursor: perioadele (ani, trimestre, luni, zile) ca butoane, un clic arată doar rândurile din perioada aceea" aria-label="Cronologie">
          <span className="rb-ico">🗓</span><span className="rb-txt">Cronologie</span>
        </button>
</RGroup>
<RGroup label="Linkuri">
        <button className="rb-big" data-keytip="I" onMouseDown={(e) => e.preventDefault()} onClick={() => { finishEdit(); setLinkDlg(true); }} title="Link pe celula curentă (Ctrl+K): o adresă web, un e-mail sau un loc din tabel (Ctrl+clic pe celulă o deschide)" aria-label="Link">
          <span className="rb-ico">🔗</span><span className="rb-txt">Link</span>
        </button>
</RGroup>
<RGroup label="Comentarii">
        <button className={`rb-big ${selStyle.note ? 'active' : ''}`} data-keytip="M" onMouseDown={(e) => e.preventDefault()} onClick={() => { finishEdit(); setNoteDlg(true); }}
          title="Notă pe celulă: un comentariu care apare când treci cu mouse-ul peste ea (Shift+F2)" aria-label="Notă">
          <span className="rb-ico">💬</span><span className="rb-txt">Notă</span>
        </button>
</RGroup>
<RGroup label="Text">
        <button className="rb-big" data-keytip="X" onMouseDown={(e) => e.preventDefault()} onClick={() => { finishEdit(); setShDlg({ id: null, sh: { ...TEXT_BOX } }); }} title="Casetă de text: un text liber pus peste celule, oriunde pe foaie (dublu-click pe ea îi schimbă textul)" aria-label="Casetă text">
          <span className="rb-ico">▤</span><span className="rb-txt">Casetă text</span>
        </button>
        <button className="rb-big" data-keytip="H" onMouseDown={(e) => e.preventDefault()} onClick={() => { finishEdit(); setPrintDlg(true); }} title="Antet și subsol la tipărire (cu data, ora, numele fișierului și „Pagina 1 din N”): fereastra Tipărește" aria-label="Antet și subsol">
          <span className="rb-ico">▭</span><span className="rb-txt">Antet și subsol</span>
        </button>
        <button className="rb-big" data-keytip="W" onMouseDown={(e) => e.preventDefault()} onClick={() => { finishEdit(); setWaDlg({ id: null, text: '', s: 'blue' }); }} title="Text artistic: un titlu cu degrade, contur sau umbră, pus peste celule (dublu-click pe el îl schimbă)" aria-label="Text artistic">
          <span className="rb-ico">𝒜</span><span className="rb-txt">Text artistic</span>
        </button>
</RGroup>
<RGroup label="Simboluri">
        <button className="rb-big" data-keytip="E" onMouseDown={(e) => e.preventDefault()} onClick={() => { finishEdit(); setEqDlg({ id: null, src: '' }); }} title="Ecuație: fracții, puteri, radicali, sume, integrale, litere grecești, scrisă pe un rând și pusă peste celule (dublu-click pe ea o schimbă)" aria-label="Ecuație">
          <span className="rb-ico">π</span><span className="rb-txt">Ecuație</span>
        </button>
        <SymbolPicker onInsert={insertSymbol} keytip="U" />
</RGroup>
          </> },
          { id: 'layout', label: 'Aspect pagină', content: <>
<RGroup label="Teme">
        <RSplit icon="🎨" label="Teme" keytip="TH" title="Teme: culorile paletei registrului; celulele colorate din paletă se schimbă odată cu tema"
          items={[...BOOK_THEMES.map((t, i) => ({ label: t.name, checked: i === 0 ? themeColorsOf(doc.theme).join() === t.colors.join() : doc.theme?.name === t.name && doc.theme.colors.join() === t.colors.join(), run: () => applyBookTheme(i === 0 ? undefined : t) })),
            ...(doc.theme && !BOOK_THEMES.some((t) => t.colors.join() === doc.theme!.colors.join()) ? [{ label: doc.theme.name, checked: true, sep: true, run: () => setStatus('Tema din fișier: ' + doc.theme!.name) }] : [])]} />
        <RSplit icon="Aa" label="Fonturi" keytip="TF" title="Fonturile temei: Titluri și Corp (Corp e fontul obișnuit al celulelor)"
          items={[...THEME_FONTS.map((p) => ({ label: p.name + ': ' + p.fonts.major + ' / ' + p.fonts.minor, checked: p.fonts.major === themeFonts.major && p.fonts.minor === themeFonts.minor, run: () => applyThemeFonts(p.fonts) })),
            ...(!THEME_FONTS.some((p) => p.fonts.major === themeFonts.major && p.fonts.minor === themeFonts.minor) ? [{ label: 'Din fișier: ' + themeFonts.major + ' / ' + themeFonts.minor, checked: true, sep: true, run: () => setStatus('Fonturile temei: ' + themeFonts.major + ' / ' + themeFonts.minor) }] : [])]} />
</RGroup>
{/* Ca în programul de tabele cunoscut: Inițializare pagină · Scalare pentru a se potrivi · Opțiuni foaie (+ Pagini). */}
<RGroup label="Inițializare pagină" launcher={{ title: 'Inițializare pagină: toate setările de tipărire (fereastra Tipărește)', run: () => { finishEdit(); setPrintDlg(true); } }}>
        <RSplit icon="▭" label="Margini" keytip="M" title="Margini: cât loc gol rămâne pe marginea paginii la tipărire"
          items={[...(Object.keys(MARGINS) as PrintMargin[]).map((m) => ({ label: MARGIN_NAMES[m], checked: printSet.margin === m, run: () => setPrint({ margin: m }) })),
            { label: 'Margini particularizate…', sep: true, run: () => { finishEdit(); setPrintDlg(true); } }]} />
        <RSplit icon="⤾" label="Orientare" keytip="O" title="Orientare: pagina în picioare (portret) sau culcată (peisaj)"
          items={[{ label: 'Portret', checked: !printSet.landscape, run: () => setPrint({ landscape: false }) },
            { label: 'Peisaj', checked: !!printSet.landscape, run: () => setPrint({ landscape: true }) }]} />
        <RSplit icon="🗎" label="Dimensiune" keytip="SZ" title="Dimensiune: mărimea hârtiei la tipărire"
          items={(Object.keys(PAPERS) as PrintPaper[]).map((p) => ({ label: p + ' (' + String(PAPERS[p][0] / 10).replace('.', ',') + ' × ' + String(PAPERS[p][1] / 10).replace('.', ',') + ' cm)', checked: printSet.paper === p, run: () => setPrint({ paper: p }) }))} />
        <RSplit icon="⬚" label="Zonă de imprimare" keytip="R" title="Zonă de imprimare: doar celulele alese ies pe hârtie"
          items={[
            { label: 'Setare zonă de imprimare', run: () => { finishEdit(); if (!multi) { setStatus('Alege întâi cu mouse-ul celulele care vrei să iasă pe hârtie'); return; } setPrint({ area: rangeText(range) }); setStatus('Zona de imprimare: ' + rangeText(range)); } },
            { label: 'Golire zonă de imprimare', run: () => { setPrint({ area: undefined }); setStatus('Se tipărește din nou tot ce e completat'); } },
          ]} />
        <RSplit icon="⤓" label="Întreruperi" keytip="B" title="Întreruperi: pagina nouă începe cu rândul ales (linie punctată deasupra lui)"
          items={[
            { label: 'Inserare întrerupere de pagină', run: () => { if ((sheet.print?.breaks ?? []).includes(sel.r)) { setStatus('Deasupra rândului ' + (sel.r + 1) + ' e deja o întrerupere de pagină'); return; } toggleBreak(); } },
            { label: 'Eliminare întrerupere de pagină', run: () => { if (!(sheet.print?.breaks ?? []).includes(sel.r)) { setStatus('Deasupra rândului ' + (sel.r + 1) + ' nu e nicio întrerupere de pagină'); return; } toggleBreak(); } },
            { label: 'Inserare întrerupere de pagină pe coloană', title: 'Pagina alăturată nouă începe cu coloana selectată', sep: true, run: () => toggleColBreak(true) },
            { label: 'Eliminare întrerupere de pagină pe coloană', run: () => toggleColBreak(false) },
            { label: 'Reinițializare toate întreruperile de pagină', sep: true, run: () => { finishEdit(); if (!sheet.print?.breaks?.length && !sheet.print?.colBreaks?.length) { setStatus('Nu e nicio întrerupere de pagină pusă de mână'); return; } remember(); const p: SheetPrint = { ...sheet.print }; delete p.breaks; delete p.colBreaks; setSheet({ ...sheet, print: Object.keys(p).length ? p : undefined }); setStatus('Toate întreruperile de pagină puse de mână au fost scoase'); } },
          ]} />
        <button className="rb-big" data-keytip="I" onMouseDown={(e) => e.preventDefault()} onClick={() => { finishEdit(); setPrintDlg(true); }}
          title="Imprimare titluri: rândurile de sus (capul de tabel) și coloanele din stânga care se repetă pe fiecare pagină (fereastra Tipărește)" aria-label="Imprimare titluri">
          <span className="rb-ico">☰</span><span className="rb-txt">Imprimare titluri</span>
        </button>
</RGroup>
<RGroup label="Scalare pentru a se potrivi" launcher={{ title: 'Scalare: toate opțiunile (fereastra Tipărește)', run: () => { finishEdit(); setPrintDlg(true); } }}>
<div className="rb-stack sh-scale">
        <label className="rb-row" title="Lățime: Automat = mărimea reală; 1 pagină = tabelul se micșorează ca să încapă pe lățimea paginii">
          <span className="rb-txt">↔ Lățime:</span>
          <select data-keytip="W" aria-label="Lățime la tipărire" value={printSet.fit ? '1' : 'auto'} onChange={(e) => setPrint(e.target.value === '1' ? { fit: true } : { fit: false, onePage: false })}>
            <option value="auto">Automat</option><option value="1">1 pagină</option>
          </select>
        </label>
        <label className="rb-row" title="Înălțime: 1 pagină = tot tabelul încape pe o singură pagină">
          <span className="rb-txt">↕ Înălțime:</span>
          <select data-keytip="H" aria-label="Înălțime la tipărire" value={printSet.fit && printSet.onePage ? '1' : 'auto'} onChange={(e) => setPrint(e.target.value === '1' ? { fit: true, onePage: true } : { onePage: false })}>
            <option value="auto">Automat</option><option value="1">1 pagină</option>
          </select>
        </label>
        <label className="rb-row" title={'Scară: mărimea la tipărire, în procente (' + MIN_PRINT_SCALE + '–' + MAX_PRINT_SCALE + '%), când lățimea e Automat'}>
          <span className="rb-txt">Scară:</span>
          <input type="number" data-keytip="SC" aria-label="Scară la tipărire" min={MIN_PRINT_SCALE} max={MAX_PRINT_SCALE} step={5} disabled={printSet.fit} value={printSet.scale} style={{ width: 52 }}
            onChange={(e) => { const v = Math.round(Number(e.target.value)); if (Number.isFinite(v) && v >= MIN_PRINT_SCALE && v <= MAX_PRINT_SCALE) setPrint({ scale: v }); }} />
          <span>%</span>
        </label>
</div>
</RGroup>
<RGroup label="Opțiuni foaie" launcher={{ title: 'Opțiuni foaie: toate setările de tipărire (fereastra Tipărește)', run: () => { finishEdit(); setPrintDlg(true); } }}>
<div className="sh-sheetopts" role="group" aria-label="Opțiuni foaie">
        <span /><b>Linii de grilă</b><b>Titluri</b>
        <span>Vizualizare</span>
        <input type="checkbox" data-keytip="VG" aria-label="Linii de grilă: vizualizare" title="Liniile dintre celule, pe ecran" checked={!sheet.noGrid} onChange={toggleGrid} />
        <input type="checkbox" data-keytip="VH" aria-label="Titluri: vizualizare" title="Literele coloanelor și numerele rândurilor, pe ecran" checked={!noHead} onChange={toggleHead} />
        <span>Imprimare</span>
        <input type="checkbox" data-keytip="PG" aria-label="Linii de grilă: imprimare" title="Liniile dintre celule, pe hârtie" checked={!!printSet.grid} onChange={(e) => setPrint({ grid: e.target.checked })} />
        <input type="checkbox" data-keytip="PH" aria-label="Titluri: imprimare" title="Literele coloanelor și numerele rândurilor, pe hârtie" checked={!!printSet.headings} onChange={(e) => setPrint({ headings: e.target.checked })} />
</div>
</RGroup>
<RGroup label="Pagini">
        <button
          className={'fmt ' + (pageView ? 'active' : '')}
          onClick={() => { setPageView((v) => !v); focusGrid(); }}
          title="Vedere pagini: ce nu se tipărește devine gri, iar liniile punctate albastre arată unde începe singură o pagină nouă (cele trase sunt sfârșiturile puse de tine)"
        >
          📄 Pagini{pageInfo ? ' (' + pageInfo.pages + ')' : ''}
        </button>
</RGroup>
          </> },
          { id: 'formulas', label: 'Formule', content: <>
{/* Ca în programul de tabele cunoscut: Bibliotecă de funcții · Nume definite · Audit formule · Calcul. */}
<RGroup label="Bibliotecă de funcții">
        <button className="rb-big" data-keytip="F" onMouseDown={(e) => e.preventDefault()} onClick={() => { fxBase.current = editRef.current; setFxDlg(true); }}
          title="Inserare funcție (Shift+F3): cauți după nume sau după ce face (de exemplu „rată”, „vârstă”, „caută”), cu explicații în română" aria-label="Inserare funcție">
          <span className="rb-ico"><i>fx</i></span><span className="rb-txt">Inserare funcție</span>
        </button>
        <RSplit icon="Σ" label="Însumare automată" keytip="U" title="Însumare automată (Alt+=): adună numerele de deasupra sau din stânga; ▾ pentru medie, contorizare, max, min"
          run={() => autoSum('SUM')} items={AUTO_FNS.map(([v, label]) => ({ label, run: () => autoSum(v) }))} />
        {(() => {
          const lib = (cat: string, label: string, keytip: string, icon: string) => {
            const fns = FN_HELP.filter((h) => (cat === 'Uzuale' ? h.common : h.cat === cat));
            return (
              <RMenu key={cat} label={icon + ' ' + label} ariaLabel={label} keytip={keytip} title={'Funcțiile ' + (cat === 'Uzuale' ? 'folosite des' : 'din categoria ' + label) + ': clic pe una o pune în celulă, cu explicația argumentelor'}
                items={[...fns.map((h) => ({ label: h.name, title: h.name + '(' + h.args + '): ' + h.desc, run: () => { fxBase.current = editRef.current; insertFn(h.name, h); } })),
                  { label: 'Inserare funcție…', title: 'Toate funcțiile, cu căutare după nume sau după ce fac', sep: true, run: () => { fxBase.current = editRef.current; setFxDlg(true); } }]} />
            );
          };
          const recent = recentFns.map((n) => FN_HELP.find((h) => h.name === n)).filter((h): h is FnHelp => !!h);
          const more = FN_HELP.filter((h) => h.cat === 'Statistică' || h.cat === 'Informații');
          return <>
            <div className="rb-stack">
              <RMenu label="★ Utilizate recent" ariaLabel="Utilizate recent" keytip="R" title="Funcțiile folosite de curând (la început, cele folosite des)"
                items={[...(recent.length ? recent : FN_HELP.filter((h) => h.common)).map((h) => ({ label: h.name, title: h.name + '(' + h.args + '): ' + h.desc, run: () => { fxBase.current = editRef.current; insertFn(h.name, h); } })),
                  { label: 'Inserare funcție…', sep: true, run: () => { fxBase.current = editRef.current; setFxDlg(true); } }]} />
              {lib('Financiare', 'Financiare', 'I', '€')}
              {lib('Logice', 'Logice', 'L', '?')}
            </div>
            <div className="rb-stack">
              {lib('Text', 'Text', 'T', 'A')}
              {lib('Dată și oră', 'Dată și oră', 'E', '◷')}
              {lib('Căutare', 'Căutare și referință', 'O', '⌕')}
            </div>
            <div className="rb-stack">
              {lib('Matematică', 'Matematice și trigonometrice', 'G', 'θ')}
              <RMenu label="⋯ Mai multe funcții" ariaLabel="Mai multe funcții" keytip="Q" title="Mai multe funcții: statistice și de informații"
                items={[...more.map((h, i) => ({ label: h.name, title: h.name + '(' + h.args + '): ' + h.desc, sep: i > 0 && more[i - 1].cat !== h.cat, run: () => { fxBase.current = editRef.current; insertFn(h.name, h); } })),
                  { label: 'Inserare funcție…', sep: true, run: () => { fxBase.current = editRef.current; setFxDlg(true); } }]} />
            </div>
          </>;
        })()}
</RGroup>
<RGroup label="Nume definite">
        <button className={'rb-big' + (doc.names?.length ? ' active' : '')} data-keytip="N" onMouseDown={(e) => e.preventDefault()} onClick={() => { finishEdit(); setNamesDlg(true); }}
          title="Manager nume: dai un nume unei celule sau zone (de exemplu TVA = E11) și îl folosești în formule: =B2*TVA" aria-label="Manager nume">
          <span className="rb-ico">🏷</span><span className="rb-txt">Manager nume</span>
        </button>
        <div className="rb-stack">
          <button className="rb-small" data-keytip="M" onMouseDown={(e) => e.preventDefault()} onClick={() => { finishEdit(); setNamesDlg(true); }} title="Definire nume: un nume nou pentru celulele alese (fereastra Nume)" aria-label="Definire nume">
            <span className="rb-ico">＋</span><span className="rb-txt">Definire nume</span>
          </button>
          <RMenu label="ƒ Utilizare în formulă" ariaLabel="Utilizare în formulă" keytip="S" title="Utilizare în formulă: pune un nume definit în formula pe care o scrii (sau începe una)"
            items={doc.names?.length
              ? doc.names.map((n) => ({ label: n.name, title: n.name + ' = ' + n.ref, run: () => putName(n.name) }))
              : [{ label: 'Niciun nume încă: Definire nume…', run: () => { finishEdit(); setNamesDlg(true); } }]} />
          <button className="rb-small" data-keytip="C" onMouseDown={(e) => e.preventDefault()} onClick={() => { finishEdit(); setNamesDlg(true); }} title="Creare din selecție: numele zonelor se iau din primul rând sau prima coloană a celulelor alese (fereastra Nume)" aria-label="Creare din selecție">
            <span className="rb-ico">▦</span><span className="rb-txt">Creare din selecție</span>
          </button>
        </div>
</RGroup>
<RGroup label="Audit formule">
        <div className="rb-stack">
          <button className="rb-small" data-keytip="P" onMouseDown={(e) => e.preventDefault()} onClick={() => doTrace('p')} title="Urmărire precedente: evidențiază cu albastru celulele folosite de formula din celula selectată" aria-label="Urmărire precedente">
            <span className="rb-ico">⇠</span><span className="rb-txt">Urmărire precedente</span>
          </button>
          <button className="rb-small" data-keytip="D" onMouseDown={(e) => e.preventDefault()} onClick={() => doTrace('d')} title="Urmărire dependente: evidențiază cu verde celulele ale căror formule folosesc celula selectată" aria-label="Urmărire dependente">
            <span className="rb-ico">⇢</span><span className="rb-txt">Urmărire dependente</span>
          </button>
          <button className="rb-small" data-keytip="AA" disabled={!trace} onMouseDown={(e) => e.preventDefault()} onClick={() => { setTrace(null); setStatus(''); focusGrid(); }} title="Eliminare săgeți: scoate evidențierea urmăririi formulelor" aria-label="Eliminare săgeți">
            <span className="rb-ico">✕</span><span className="rb-txt">Eliminare săgeți</span>
          </button>
        </div>
        <div className="rb-stack">
          <button className={'rb-small' + (showF ? ' active' : '')} data-keytip="H" onMouseDown={(e) => e.preventDefault()} onClick={() => { setShowF((v) => !v); focusGrid(); }} title="Afișare formule (Ctrl+`): în celule se văd formulele, nu rezultatele; încă o apăsare revine" aria-label="Afișare formule">
            <span className="rb-ico">=fx</span><span className="rb-txt">Afișare formule</span>
          </button>
          <button className={'rb-small' + (errOpen ? ' active' : '')} data-keytip="K" onMouseDown={(e) => e.preventDefault()} onClick={() => setErrOpen(!errOpen)} title="Verificare erori: lista celulelor de pe foaie cu formule care dau eroare (#DIV/0!, #N/A, #REF!…) și referințele circulare, cu explicația; clic pe una te duce la ea" aria-label="Verificare erori">
            <span className="rb-ico">⚠</span><span className="rb-txt">Verificare erori</span>
          </button>
          <button className={'rb-small' + (evalWin ? ' active' : '')} data-keytip="V" onMouseDown={(e) => e.preventDefault()} onClick={() => (evalWin ? setEvalWin(null) : doEvaluate())} title="Evaluare formulă: arată calculul formulei din celula aleasă pas cu pas (întâi valorile celulelor, apoi fiecare funcție), ca să găsești unde apare o greșeală" aria-label="Evaluare formulă">
            <span className="rb-ico">🔍</span><span className="rb-txt">Evaluare formulă</span>
          </button>
        </div>
        <button className={'rb-big' + (watchOpen ? ' active' : '')} data-keytip="W" onMouseDown={(e) => e.preventDefault()} onClick={() => setWatchOpen(!watchOpen)} title="Fereastră de urmărire: celulele alese (din orice foaie) și valorile lor la zi, ca să vezi cum se schimbă un total când modifici altceva" aria-label="Fereastră de urmărire">
          <span className="rb-ico">👁</span><span className="rb-txt">Fereastră de urmărire</span>
        </button>
</RGroup>
<RGroup label="Calcul">
        <RSplit icon="⚙" label="Opțiuni de calcul" keytip="X" title="Opțiuni de calcul: automat (formulele se refac la fiecare schimbare) sau manual (doar la F9)"
          items={[
            { label: 'Automat', title: 'Formulele se refac singure la fiecare schimbare', checked: !manual, run: () => { if (manual) toggleCalc(); } },
            { label: 'Manual', title: 'Formulele se refac doar când apeși F9 (bun la tabele mari și lente)', checked: manual, run: () => { if (!manual) toggleCalc(); } },
          ]} />
        <div className="rb-stack">
          <button className="rb-small" data-keytip="B" onMouseDown={(e) => e.preventDefault()} onClick={() => { setCalcTick((t) => t + 1); setStatus('Am recalculat toate formulele'); focusGrid(); }} title="Calculare acum (F9): refă toate formulele din registru" aria-label="Calculare acum">
            <span className="rb-ico">↻</span><span className="rb-txt">Calculare acum</span>
          </button>
          <button className="rb-small" data-keytip="J" onMouseDown={(e) => e.preventDefault()} onClick={() => { setCalcTick((t) => t + 1); setStatus('Am recalculat formulele foii'); focusGrid(); }} title="Calculare foaie (Shift+F9): refă formulele foii" aria-label="Calculare foaie">
            <span className="rb-ico">▤</span><span className="rb-txt">Calculare foaie</span>
          </button>
        </div>
</RGroup>
          </> },
          { id: 'data', label: 'Date', content: <>
{/* Ca în programul de tabele cunoscut: Preluare și transformare date · Sortare și filtrare · Instrumente de date · Prognoză · Schiță · Analiză. */}
<RGroup label="Preluare și transformare date">
        <RSplit icon="⇩" label="Preluare date" keytip="PN" title="Preluare date: aduce datele dintr-un fișier .csv / .txt sau dintr-un alt registru (.xlsx, .xls, .ods)"
          items={[
            { label: 'Din text/CSV…', title: 'Un fișier .csv sau .txt (de exemplu exportat din bancă sau din alt program)', run: importCsv },
            { label: 'Din registru (.xlsx, .xls, .ods)…', title: 'Un alt registru, cu toate foile lui', run: importXlsx },
            { label: 'Din document (.docx, .odt)…', title: 'Tabelele unui document .docx, .odt, .doc sau .rtf, ca foi', run: importDocTables },
            { label: 'Din PDF…', title: 'Tabelele unui PDF (facturi, extrase de cont, liste de prețuri), cu numerele gata de adunat', run: importPdfTables },
            { label: 'Din imagine…', title: 'Un tabel fotografiat sau scanat (.png, .jpg): textul se recunoaște pe calculator, fără internet, și ajunge în celule', run: () => void importPicture() },
            { label: 'Din imagine din clipboard', title: 'Poza unui tabel copiată (de exemplu o captură de ecran cu Win+Shift+S): textul se recunoaște pe calculator, fără internet, și ajunge în celule', run: () => void importPicture(true) },
            { label: 'Din web…', title: 'Tabelele unei pagini de pe internet (de exemplu un curs valutar sau o listă de prețuri): scrii adresa, iar tabelele vin ca foi', run: () => void importWeb() },
            { label: 'Interogare din fișier text/CSV…', title: 'Editorul de interogare pe un fișier .csv / .txt de pe calculator: pașii se fac pe o foaie nouă, iar Reîmprospătare totală citește din nou fișierul (de exemplu exportul de luna asta)', run: () => openQueryFile() },
            { label: 'Interogare din registru (.xlsx, .ods)…', title: 'Editorul de interogare pe o foaie dintr-un registru de pe calculator (foaia deschisă ultima dată în el): pașii se fac pe o foaie nouă, iar Reîmprospătare totală citește din nou registrul', run: () => openQueryFile(true) },
            { label: 'Interogare din dosar…', title: 'Editorul de interogare pe toate fișierele .csv / .txt / .xlsx / .xls / .ods dintr-un dosar, puse unul sub altul (coloanele după nume, cu numele fișierului în față): Reîmprospătare totală citește din nou dosarul, cu fișierele adăugate între timp', run: () => openQueryFolder() },
            { label: 'Din tabel / zonă…', title: 'Editorul de interogare: tabelul din jurul cursorului trece prin pași (alege coloane, filtrează, sortează, scoate dublurile) și ajunge pe o foaie nouă, refăcută la Reîmprospătare', run: openQuery },
          ]} />
        <div className="rb-stack">
          <button className="rb-small" data-keytip="FT" onMouseDown={(e) => e.preventDefault()} onClick={importCsv} title="Din text/CSV: deschide un fișier .csv sau .txt" aria-label="Din text/CSV">
            <span className="rb-ico">▤</span><span className="rb-txt">Din text/CSV</span>
          </button>
          <button className="rb-small" data-keytip="FW" onMouseDown={(e) => e.preventDefault()} onClick={importXlsx} title="Din registru: deschide un .xlsx (și cele vechi .xls / .xlsb) sau .ods, cu toate foile lui" aria-label="Din registru">
            <span className="rb-ico">▦</span><span className="rb-txt">Din registru</span>
          </button>
        </div>
</RGroup>
<RGroup label="Interogări și conexiuni">
        <button className="rb-big" data-keytip="RA" onMouseDown={(e) => e.preventDefault()} onClick={() => refreshPivots(true)} title="Reîmprospătare totală (Ctrl+Alt+F5): face din nou toate rezumatele (tabelele pivot) din datele de acum, cu categoriile noi și rândurile adăugate sub tabel. Alt+F5 = doar rezumatul din foaia curentă." aria-label="Reîmprospătare totală">
          <span className="rb-ico">⟳</span><span className="rb-txt">Reîmprospătare totală</span>
        </button>
        <button className="rb-small" data-keytip="K" onMouseDown={(e) => e.preventDefault()} onClick={() => { finishEdit(); setLinkMsg({}); setLinksDlg(true); }}
          title="Editare legături: fișierele din care formulele iau valori ([Buget.xlsx]Foaie1!A1): actualizează valorile, schimbă sursa sau rupe legătura" aria-label="Editare legături">
          <span className="rb-ico">🔗</span><span className="rb-txt">Editare legături{doc.links?.length ? ` (${doc.links.length})` : ''}</span>
        </button>
</RGroup>
<RGroup label="Sortare și filtrare">
        <div className="rb-stack">
          <button className="rb-small" data-keytip="SA" onMouseDown={(e) => e.preventDefault()} onClick={() => sort(false)} title="Sortare de la A la Z (de la cel mai mic la cel mai mare), după coloana cu cursorul" aria-label="Sortare de la A la Z">
            <span className="rb-ico">A↓</span><span className="rb-txt">A→Z</span>
          </button>
          <button className="rb-small" data-keytip="SD" onMouseDown={(e) => e.preventDefault()} onClick={() => sort(true)} title="Sortare de la Z la A (de la cel mai mare la cel mai mic), după coloana cu cursorul" aria-label="Sortare de la Z la A">
            <span className="rb-ico">Z↓</span><span className="rb-txt">Z→A</span>
          </button>
        </div>
        <RSplit icon="⇅" label="Sortare" keytip="SS" title="Sortare pe mai multe niveluri: de exemplu după Oraș, apoi după Sumă (descrescător)" run={openSortDlg}
          items={[
            { label: 'Sortare particularizată…', title: 'Mai multe niveluri, după valori, culoarea celulei sau a fontului', run: openSortDlg },
            { label: 'Liste particularizate…', title: 'Liste proprii pentru sortare și umplerea automată: scrii o dată „Nord, Sud, Est, Vest” și, tras de colțul celulei, Nord continuă singur', run: () => { finishEdit(); setListsDlg(true); } },
          ]} />
        <button className={'rb-big' + (filter ? ' active' : '')} data-keytip="T" onMouseDown={(e) => e.preventDefault()} onClick={toggleFilter} title="Filtru pe coloane (Ctrl+Shift+L): alegi ce valori se văd" aria-label="Filtru">
          <span className="rb-ico">⏷</span><span className="rb-txt">Filtru</span>
        </button>
        <div className="rb-stack">
          <button className="rb-small" data-keytip="C" disabled={!filter || !(Object.keys(filter.hidden).length > 0 || !!filter.cond || !!filter.color)} onMouseDown={(e) => e.preventDefault()} onClick={clearFilters} title="Golire: se văd toate rândurile, dar filtrul rămâne pornit (butoanele ▾)" aria-label="Golire">
            <span className="rb-ico">⊘</span><span className="rb-txt">Golire</span>
          </button>
          <button className="rb-small" data-keytip="Y" disabled={!filter} onMouseDown={(e) => e.preventDefault()} onClick={reapplyFilter} title="Reaplicare: filtrul și sortarea se refac după datele de acum (de exemplu după ce ai schimbat valori)" aria-label="Reaplicare">
            <span className="rb-ico">↻</span><span className="rb-txt">Reaplicare</span>
          </button>
          <button className="rb-small" data-keytip="Q" onMouseDown={(e) => e.preventDefault()} onClick={openAdvFilter} title="Complex: condițiile scrise într-o zonă de criterii (toate de pe un rând, oricare dintre rânduri), pe loc sau copiat în altă parte" aria-label="Complex">
            <span className="rb-ico">⚙</span><span className="rb-txt">Complex</span>
          </button>
        </div>
</RGroup>
<RGroup label="Instrumente de date">
        <div className="rb-stack">
          <button className="rb-small" data-keytip="E" onMouseDown={(e) => e.preventDefault()} onClick={openSplit} title="Text în coloane: împarte textul dintr-o coloană (de exemplu „Popescu;Ion;35”) în mai multe coloane, după un separator" aria-label="Text în coloane">
            <span className="rb-ico">⫼</span><span className="rb-txt">Text în coloane</span>
          </button>
          <button className="rb-small" data-keytip="FF" onMouseDown={(e) => e.preventDefault()} onClick={doFlashFill} title="Umplere rapidă (Ctrl+E): scrie lângă date unul-două exemple de rezultat (de exemplu prenumele din „Ion Popescu”), iar restul coloanei se completează la fel" aria-label="Umplere rapidă">
            <span className="rb-ico">⚡</span><span className="rb-txt">Umplere rapidă</span>
          </button>
          <button className="rb-small" data-keytip="M" onMouseDown={(e) => e.preventDefault()} onClick={openDedupe} title="Eliminare dubluri: scoate rândurile care se repetă din tabel (alegi după ce coloane se compară)" aria-label="Eliminare dubluri">
            <span className="rb-ico">⧉</span><span className="rb-txt">Eliminare dubluri</span>
          </button>
        </div>
        <div className="rb-stack">
          <RMenu label="☑ Validare date" ariaLabel="Validare date" keytip="V" active={!!selList || circle}
            title="Validarea datelor: listă derulantă (Da / Nu, Încasat / Neîncasat), doar numere întregi / zecimale / date între anumite valori, text cu lungime limitată, coduri CNP / CUI / IBAN corecte; plus mesaj la selectare și mesaj de eroare"
            items={[
              { label: 'Validare date…', title: 'Regula pentru celulele alese: listă, numere, date, lungime, coduri', run: () => { finishEdit(); setListDlg(true); } },
              { label: 'Încercuire date nevalide', title: 'Celulele care nu respectă validarea (de exemplu scrise înainte de regulă) sunt încercuite cu roșu', run: circleInvalid },
              { label: 'Golire cercuri de validare', run: () => { setCircle(false); setStatus(''); focusGrid(); } },
            ]} />
          <button className="rb-small" data-keytip="N" onMouseDown={(e) => e.preventDefault()} onClick={() => { finishEdit(); setConsDlg(true); }} title="Consolidare: adună mai multe tabele (de exemplu câte unul pe lună, pe foi diferite) într-unul singur, după poziție sau după numele rândurilor și coloanelor" aria-label="Consolidare">
            <span className="rb-ico">⊕</span><span className="rb-txt">Consolidare</span>
          </button>
          <button className="rb-small" data-keytip="RL" onMouseDown={(e) => e.preventDefault()} onClick={() => { finishEdit(); setRelDlg(true); }}
            title="Relații: leagă tabelele între ele (de exemplu Vânzări.Cod client → Clienți.Cod), apoi fă un tabel sau un rezumat cu coloane din toate tabelele legate" aria-label="Relații">
            <span className="rb-ico">🔗</span><span className="rb-txt">Relații{doc.rels?.length ? ` (${doc.rels.length})` : ''}</span>
          </button>
        </div>
</RGroup>
<RGroup label="Prognoză">
        <RSplit icon="❓" label="Analiză circumstanțială" keytip="W" title="Analiză circumstanțială: ce se întâmplă cu rezultatul dacă schimbi valorile (scenarii, căutare rezultat, tabel de date)"
          items={[
            { label: 'Manager scenarii…', title: 'Seturi de valori cu nume (de exemplu Optimist / Pesimist) pentru aceleași celule, afișate cu un clic, plus un rezumat cu rezultatele', run: () => { finishEdit(); setScDlg(true); } },
            { label: 'Căutare rezultat…', title: 'Ce valoare trebuie într-o celulă ca formula să dea rezultatul dorit', run: () => { finishEdit(); setGoalDlg(true); } },
            { label: 'Tabel de date…', title: 'Aceeași formulă calculată pentru mai multe valori ale uneia sau a două celule (de exemplu rata pentru mai multe dobânzi și perioade). Selectează întâi tabelul', run: openDataTable },
          ]} />
        <button className="rb-big" data-keytip="FC" onMouseDown={(e) => e.preventDefault()} onClick={() => analyze('fcast')} title="Foaie de prognoză: din datele alese (datele calendaristice + valorile) se face o foaie nouă cu prognoza, cu sezon și grafic" aria-label="Foaie de prognoză">
          <span className="rb-ico">📉</span><span className="rb-txt">Foaie de prognoză</span>
        </button>
</RGroup>
<RGroup label="Schiță">
        <RSplit icon="⊞" label="Grupare" keytip="G" title="Grupare (Shift+Alt+→): rândurile alese (sau coloanele întregi alese) intră într-un grup care se strânge cu ⊟" run={() => groupIn(groupAxis(), 1)}
          items={[
            { label: 'Grupare rânduri', run: () => groupIn('r', 1) },
            { label: 'Grupare coloane', run: () => groupIn('c', 1) },
          ]} />
        <RSplit icon="⊟" label="Anulare grupare" keytip="U" title="Anulare grupare (Shift+Alt+←): scoate rândurile (coloanele) alese din grup" run={() => groupIn(groupAxis(), -1)}
          items={[
            { label: 'Anulare grupare rânduri', run: () => groupIn('r', -1) },
            { label: 'Anulare grupare coloane', run: () => groupIn('c', -1) },
            { label: 'Golire schiță', title: 'Scoate toate grupările de pe foaie (rândurile strânse rămân ascunse)', sep: true, run: clearOutline },
          ]} />
        <button className="rb-big" data-keytip="B" onMouseDown={(e) => e.preventDefault()} onClick={openSubDlg} title="Subtotal: sub fiecare grup de rânduri (de exemplu fiecare oraș) se pune un rând cu suma / media / numărul, plus Total general" aria-label="Subtotal">
          <span className="rb-ico">Σ</span><span className="rb-txt">Subtotal</span>
        </button>
</RGroup>
<RGroup label="Analiză">
        <div className="rb-stack">
          <select className="fmt" value="" onChange={(e) => analyze(e.target.value)} aria-label="Analiza datelor" data-keytip="AD" title="Analiză date pentru coloanele alese (sau tabelul în care ești); rezultatul apare într-o foaie nouă">
            <option value="">📈 Analiză date…</option>
            <option value="cor">Corelație (între coloane)</option>
            <option value="cov">Covarianță (între coloane)</option>
            <option value="reg">Regresie liniară (ultima coloană = rezultatul)</option>
            <option value="hist">Histogramă (prima coloană, clase automate)</option>
            <option value="anova">ANOVA cu un factor (fiecare coloană e o grupă)</option>
            <option value="anova2">ANOVA cu doi factori (rânduri × coloane, fără replicare)</option>
            <option value="anovarep">ANOVA cu doi factori cu replicare (grupe de rânduri × coloane)</option>
            <option value="ftest">Testul F pentru două variații (primele două coloane)</option>
            <option value="tpair">Testul t pe perechi (înainte / după, primele două coloane)</option>
            <option value="tequal">Testul t pentru două medii, varianțe egale</option>
            <option value="tunequal">Testul t pentru două medii, varianțe diferite</option>
            <option value="fcast">📉 Foaie de prognoză (datele + valorile, cu sezon și grafic)</option>
            <option value="ztest">Testul z pentru două medii (eșantioane mari)</option>
            <option value="rank">Rang și percentilă (prima coloană)</option>
            <option value="sper">Eșantion periodic (fiecare a n-a valoare)</option>
            <option value="srand">Eșantion aleator (n valori la întâmplare)</option>
            <option value="fft">Analiza Fourier (prima coloană, 2, 4, 8… valori)</option>
            <option value="ifft">Fourier invers (prima coloană, numere complexe)</option>
            <option value="rand">Generare numere aleatoare… (uniformă, normală, Poisson…)</option>
            <option value="mavg3">Media mobilă pe 3 valori (prima coloană)</option>
            <option value="mavg6">Media mobilă pe 6 valori</option>
            <option value="mavg12">Media mobilă pe 12 valori</option>
            <option value="exp3">Netezire exponențială (amortizare 0,3: urmărește repede)</option>
            <option value="exp7">Netezire exponențială (amortizare 0,7: mai lină)</option>
          </select>
          <button className="rb-small" data-keytip="AS" onMouseDown={(e) => e.preventDefault()} onClick={descStats} title="Statistici descriptive: pentru coloanele cu numere alese (sau tabelul în care ești), o foaie nouă cu media, mediana, modul, abaterea standard, varianța, boltirea, asimetria, minimul, maximul, suma, quartilele și nivelul de încredere de 95%" aria-label="Statistici descriptive">
            <span className="rb-ico">📊</span><span className="rb-txt">Statistici descriptive</span>
          </button>
          <button className="rb-small" data-keytip="AR" onMouseDown={(e) => e.preventDefault()} onClick={() => { finishEdit(); setSolverDlg(true); }} title="Rezolvitor: găsește valorile mai multor celule pentru care o formulă e cât mai mare, cât mai mică sau egală cu o valoare, cu condiții (de exemplu cel mai mare profit cu materialele avute)" aria-label="Rezolvitor">
            <span className="rb-ico">🧮</span><span className="rb-txt">Rezolvitor</span>
          </button>
        </div>
</RGroup>
          </> },
          { id: 'review', label: 'Revizuire', content: <>
{/* Ca în programul de tabele cunoscut: Verificare · Accesibilitate · Note · Protejare. */}
<RGroup label="Verificare">
        <button className="rb-big" data-keytip="S" onMouseDown={(e) => e.preventDefault()} onClick={() => { finishEdit(); setSpellOpen(true); }} title="Ortografie (F7): caută cuvintele scrise greșit în celulele cu text, cu sugestii din dicționarul românesc" aria-label="Ortografie">
          <span className="rb-ico">ABC✓</span><span className="rb-txt">Ortografie</span>
        </button>
        <button className="rb-small" data-keytip="G" onMouseDown={(e) => e.preventDefault()} onClick={() => { finishEdit(); setGramOpen(true); }} title="Gramatică: cuvinte repetate, spații, punctuație, forme greșite, pleonasme și acordul verbului, în celulele cu text ale foii" aria-label="Gramatică">
          <span className="rb-ico">✓</span><span className="rb-txt">Gramatică</span>
        </button>
        <button className="rb-big" data-keytip="W" onMouseDown={(e) => e.preventDefault()} onClick={bookStats} title="Statistici registru de lucru: câte foi, celule cu date, formule, note, tabele, grafice și imagini are registrul" aria-label="Statistici registru de lucru">
          <span className="rb-ico">123</span><span className="rb-txt">Statistici registru de lucru</span>
        </button>
</RGroup>
<RGroup label="Accesibilitate">
        <button className="rb-big" data-keytip="A1" onMouseDown={(e) => e.preventDefault()} onClick={runA11y} title="Verificare accesibilitate: text greu de citit pe fundalul lui, celule îmbinate, foi fără nume potrivit sau ascunse, grafice fără titlu, legături care arată doar adresa" aria-label="Verificare accesibilitate">
          <span className="rb-ico">♿</span><span className="rb-txt">Verificare accesibilitate</span>
        </button>
</RGroup>
<RGroup label="Modificări">
        <button className={'rb-big' + (changesOpen ? ' active' : '')} data-keytip="H" onMouseDown={(e) => e.preventDefault()} onClick={() => { finishEdit(); setChangesOpen((v) => !v); }}
          title="Afișare modificări: celulele schimbate în registru, cu ce era înainte, ce e acum, când și cine; doar pentru foaia sau zona aleasă, dacă vrei" aria-label="Afișare modificări">
          <span className="rb-ico">🕘</span><span className="rb-txt">Afișare modificări</span>
        </button>
</RGroup>
<RGroup label="Comentarii">
        <button className={`rb-big ${selStyle.cmt?.length ? 'active' : ''}`} data-keytip="C" onMouseDown={(e) => e.preventDefault()} onClick={() => { finishEdit(); setCmtDlg(true); }}
          title="Comentariu nou pe celula aleasă (Ctrl+Alt+M): o discuție cu autor și oră, la care ceilalți pot răspunde" aria-label="Comentariu nou">
          <span className="rb-ico">💬</span><span className="rb-txt">{selStyle.cmt?.length ? 'Răspunde' : 'Comentariu nou'}</span>
        </button>
<div className="rb-stack">
        <button className="rb-small" onMouseDown={(e) => e.preventDefault()} onClick={() => goComment(-1)} title="Comentariul anterior" aria-label="Comentariul anterior">
          <span className="rb-ico">◀</span><span className="rb-txt">Anterior</span>
        </button>
        <button className="rb-small" onMouseDown={(e) => e.preventDefault()} onClick={() => goComment(1)} title="Comentariul următor" aria-label="Comentariul următor">
          <span className="rb-ico">▶</span><span className="rb-txt">Următor</span>
        </button>
</div>
</RGroup>
<RGroup label="Note">
        <RSplit icon="🗨" label="Note" keytip="T" title="Note: notă nouă, mers la nota anterioară sau următoare, toate notele la vedere"
          items={[
            { label: selStyle.note ? 'Editare notă' : 'Notă nouă', title: 'Nota celulei alese (Shift+F2)', run: () => { finishEdit(); setNoteDlg(true); } },
            { label: 'Notă anterioară', run: () => goNote(-1) },
            { label: 'Notă următoare', run: () => goNote(1) },
            { label: 'Afișare toate notele', title: 'Fiecare notă stă lângă celula ei, nu doar când treci cu mouse-ul peste ea (încă un clic le ascunde)', sep: true, run: toggleAllNotes },
          ]} />
</RGroup>
<RGroup label="Protejare">
        <button className={'rb-big' + (sheet.protect ? ' active' : '')} data-keytip="PS" data-state={sheet.protect ? (sheet.protectPw ? 'pw' : 'on') : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => protection(sheet.protect ? 'off' : 'on')}
          title={sheet.protect ? (sheet.protectPw ? 'Foaia e protejată cu parolă: clic ca să oprești protecția' : 'Foaia e protejată: clic ca să oprești protecția') : 'Protejare foaie: formulele și capul de tabel nu se mai pot strica din greșeală; se pot completa doar celulele lăsate libere (Permitere editare zone)'} aria-label="Protejare foaie">
          <span className="rb-ico">{sheet.protect ? '🔒' : '🛡'}</span><span className="rb-txt">{sheet.protect ? 'Anulare protejare foaie' : 'Protejare foaie'}</span>
        </button>
        <button className={'rb-big' + (doc.lockBook ? ' active' : '')} data-keytip="PW" data-state={doc.lockBook ? 'on' : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => protection(doc.lockBook ? 'book-off' : 'book-on')}
          title={doc.lockBook ? 'Structura registrului e protejată: clic ca să oprești protecția' : 'Protejare registru: foile nu se mai pot adăuga, șterge, redenumi, muta sau ascunde'} aria-label="Protejare registru">
          <span className="rb-ico">{doc.lockBook ? '🔒' : '📚'}</span><span className="rb-txt">{doc.lockBook ? 'Anulare protejare registru' : 'Protejare registru'}</span>
        </button>
        <RMenu label="▦ Permitere editare zone" ariaLabel="Permitere editare zone" keytip="U" title="Ce celule rămân de completat când foaia e protejată"
          items={[
            { label: 'Celulele selectate rămân libere', title: 'Se pot completa și cu foaia protejată', run: () => protection('unlock') },
            { label: 'Celulele selectate se blochează', title: 'Nu se mai pot schimba când foaia e protejată (așa sunt toate la început)', run: () => protection('lock') },
          ]} />
</RGroup>
          </> },
          { id: 'view', label: 'Vizualizare', content: <>
{/* Ca în programul de tabele cunoscut: Vizualizări registru de lucru · Afișare · Zoom · Fereastră. */}
<RGroup label="Vizualizări registru de lucru">
        <button className={'rb-big' + (pageView || layoutOn ? '' : ' active')} data-keytip="L" onMouseDown={(e) => e.preventDefault()} onClick={() => { setPageView(false); showLayout(false); }} title="Normal: foaia obișnuită, fără marginile paginilor" aria-label="Normal">
          <span className="rb-ico">▦</span><span className="rb-txt">Normal</span>
        </button>
        <button className={'rb-big' + (pageView ? ' active' : '')} data-keytip="I" onMouseDown={(e) => e.preventDefault()} onClick={() => { if (layoutOn) showLayout(false); setPageView(true); focusGrid(); }} title="Examinare sfârșit de pagină: ce nu se tipărește devine gri, iar liniile punctate albastre arată unde începe o pagină nouă" aria-label="Examinare sfârșit de pagină">
          <span className="rb-ico">📄</span><span className="rb-txt">Examinare sfârșit de pagină</span>
        </button>
        <button className={'rb-big' + (layoutOn ? ' active' : '')} data-keytip="A" onMouseDown={(e) => e.preventDefault()} onClick={() => showLayout(!layoutOn)} title="Aspect pagină: foaia pe paginile de hârtie, cu antetul, subsolul și marginile, exact cum se tipărește" aria-label="Aspect pagină">
          <span className="rb-ico">📃</span><span className="rb-txt">Aspect pagină</span>
        </button>
</RGroup>
<RGroup label="Afișare">
<div className="rb-stack">
        <label className="rb-check" title="Liniile gri dintre celule (chenarele puse de tine rămân). Se păstrează și în .xlsx."><input type="checkbox" data-keytip="VG" aria-label="Linii de grilă" checked={!sheet.noGrid} onChange={toggleGrid} /> Linii de grilă</label>
        <label className="rb-check" title="Rândul de sus cu adresa celulei și formula ei (ține minte alegerea)"><input type="checkbox" data-keytip="VF" aria-label="Bară de formule" checked={fxBar} onChange={toggleFxBar} /> Bară de formule</label>
        <label className="rb-check" title="Literele coloanelor (A, B, C…) și numerele rândurilor (1, 2, 3…). Se păstrează și în .xlsx."><input type="checkbox" data-keytip="VH" aria-label="Titluri" checked={!sheet.noHead} onChange={toggleHead} /> Titluri</label>
</div>
</RGroup>
<RGroup label="Zoom">
        <RSplit icon="🔍" label="Zoom" keytip="Q" title="Zoom: cât de mare se vede foaia"
          items={[200, 150, 100, 75, 50].map((z) => ({ label: z + '%', checked: Math.round(zoom) === z, run: () => { setZoom(z); focusGrid(); } }))} />
        <button className="rb-big" data-keytip="J" onMouseDown={(e) => e.preventDefault()} onClick={() => { setZoom(100); focusGrid(); }} title="100%: mărimea obișnuită" aria-label="100%">
          <span className="rb-ico">1:1</span><span className="rb-txt">100%</span>
        </button>
        <button className="rb-big" data-keytip="G" onMouseDown={(e) => e.preventDefault()} onClick={zoomToSel} title="Zoom la selecție: zona selectată umple fereastra (între 50% și 200%)" aria-label="Zoom la selecție">
          <span className="rb-ico">⤢</span><span className="rb-txt">Zoom la selecție</span>
        </button>
</RGroup>
<RGroup label="Fereastră">
        <RSplit icon="❄" label="Înghețare panouri" keytip="F" title="Înghețare panouri: rândurile de sus și coloanele din stânga rămân pe loc când derulezi"
          items={[
            sheet.freeze || sheet.freezeCol
              ? { label: 'Anulare înghețare panouri', title: 'Rândurile și coloanele înghețate se derulează din nou', run: freezeAtSel }
              : { label: 'Înghețare panouri', title: 'Rândurile de deasupra celulei alese și coloanele din stânga ei rămân pe loc (de exemplu din B3: rândurile 1–2 și coloana A)', run: freezeAtSel },
            { label: 'Înghețare rând de sus', title: 'Primul rând rămâne vizibil când derulezi în jos', run: () => freezeOnly('r') },
            { label: 'Înghețare prima coloană', title: 'Prima coloană (A) rămâne vizibilă când derulezi spre dreapta', run: () => freezeOnly('c') },
          ]} />
        <button className={'rb-small' + (splitOn && splitDir === 'h' ? ' active' : '')} data-keytip="S" aria-pressed={splitOn && splitDir === 'h'} onMouseDown={(e) => e.preventDefault()} onClick={() => { const on = !(splitOn && splitDir === 'h'); setSplitDir('h'); setSplitOn(on); setView2(null); focusGrid(); }}
          title="Scindare: aceeași foaie în două părți, sus și jos, derulate separat (de exemplu capul tabelului sus și rândurile de la capăt jos). Încă un clic = Eliminare scindare" aria-label="Scindare">
          <span className="rb-ico">⊟</span><span className="rb-txt">Scindare</span>
        </button>
        <button className={'rb-small' + (splitOn && splitDir === 'v' ? ' active' : '')} data-keytip="D" aria-pressed={splitOn && splitDir === 'v'} onMouseDown={(e) => e.preventDefault()} onClick={() => { const on = !(splitOn && splitDir === 'v'); setSplitDir('v'); setSplitOn(on); setView2(null); focusGrid(); }}
          title="Scindare stânga-dreapta: aceeași foaie în două părți, una lângă alta, derulate separat (de exemplu coloanele de la început în stânga și cele de la capăt în dreapta). Încă un clic = Eliminare scindare" aria-label="Scindare stânga-dreapta">
          <span className="rb-ico">◫</span><span className="rb-txt">Stânga-dreapta</span>
        </button>
        <button className={'rb-small' + (splitOn && splitDir === 'q' ? ' active' : '')} data-keytip="U" aria-pressed={splitOn && splitDir === 'q'} onMouseDown={(e) => e.preventDefault()} onClick={() => { const on = !(splitOn && splitDir === 'q'); setSplitDir('q'); setSplitOn(on); setView2(null); focusGrid(); }}
          title="Patru panouri: aceeași foaie în patru părți; cele de sus se derulează împreună în jos, cele din stânga împreună spre dreapta (de exemplu capul tabelului și prima coloană rămân la vedere oriunde te duci). Încă un clic = Eliminare scindare" aria-label="Patru panouri">
          <span className="rb-ico">⊞</span><span className="rb-txt">Patru panouri</span>
        </button>
        {canArrange() && <RMenu label="🗗 Aranjează toate" title={ARRANGE_TITLE} items={arrangeItems()} />}
</RGroup>
<RGroup label="Macrocomenzi">
        <button className={'rb-big' + (rec ? ' active' : '')} data-keytip="M" onMouseDown={(e) => e.preventDefault()} onClick={() => { if (rec) stopRec(); else { finishEdit(); setMacroDlg('list'); } }}
          title={rec ? `Se înregistrează „${rec.name}” (${rec.steps.length === 1 ? 'un pas' : `${rec.steps.length} pași`}): apasă ca să oprești și să păstrezi macrocomanda` : 'Macrocomenzi: pașii înregistrați (valori, formule, formatare), repetați cu un clic de la celula aleasă'}
          aria-label={rec ? 'Oprește înregistrarea' : 'Macrocomenzi'}>
          <span className="rb-ico">{rec ? '⏹' : '▶'}</span><span className="rb-txt">{rec ? 'Oprește înregistrarea' : `Macrocomenzi${(doc.macros?.length ?? 0) + myMacros.length ? ` (${(doc.macros?.length ?? 0) + myMacros.length})` : ''}`}</span>
        </button>
        {!rec && (
          <button className="rb-small" data-keytip="R" onMouseDown={(e) => e.preventDefault()} onClick={() => { finishEdit(); setMacroDlg('rec'); }}
            title="Înregistrează macrocomandă: tot ce scrii și formatezi în foaie se ține minte, ca să-l repeți apoi cu un clic" aria-label="Înregistrează macrocomandă">
            <span className="rb-ico">⏺</span><span className="rb-txt">Înregistrează</span>
          </button>
        )}
</RGroup>
          </> },
          { id: 'tabledesign', label: 'Proiectare tabel', contextual: true, shown: !!curTable, content: curTable ? <>
{/* Ca în programul de tabele cunoscut: Proprietăți · Instrumente · Opțiuni stil tabel · Stiluri tabel. */}
<RGroup label="Proprietăți">
<div className="rb-stack">
        <label className="tbl-name" title="Numele tabelului (se păstrează în .xlsx). Enter îl schimbă">Nume tabel: <input key={curTable.name} defaultValue={curTable.name} aria-label="Nume tabel" size={12}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); renameTable(curTable, e.currentTarget.value); focusGrid(); } else if (e.key === 'Escape') { e.currentTarget.value = curTable.name; focusGrid(); } }}
          onBlur={(e) => renameTable(curTable, e.currentTarget.value)} /></label>
        <button className="rb-small" data-keytip="E" onMouseDown={(e) => e.preventDefault()} aria-label="Redimensionare tabel" title={`Redimensionare tabel: selectează noua zonă (cu capul tabelului), apoi apasă aici. Acum: ${rangeText(tableArea(curTable))}`}
          onClick={() => { if (!multi) { setStatus(`Selectează întâi noua zonă a tabelului (acum ${rangeText(tableArea(curTable))}), apoi apasă Redimensionare tabel`); return; } makeTable(curTable.theme, { ...curTable.opts, total: false }, range); }}>
          <span className="rb-ico">⤡</span><span className="rb-txt">Redimensionare tabel</span>
        </button>
</div>
</RGroup>
<RGroup label="Instrumente">
<div className="rb-stack">
        <button className="rb-small" data-keytip="P" onMouseDown={(e) => e.preventDefault()} onClick={() => openPivot()} title="Rezumare cu tabel Pivot: sume, numărări sau medii ale tabelului, într-o foaie nouă" aria-label="Rezumare cu tabel Pivot">
          <span className="rb-ico">▦</span><span className="rb-txt">Rezumare cu tabel Pivot</span>
        </button>
        <button className="rb-small" data-keytip="M" onMouseDown={(e) => e.preventDefault()} onClick={openDedupe} title="Eliminare dubluri: scoate rândurile care se repetă din tabel" aria-label="Eliminare dubluri din tabel">
          <span className="rb-ico">⧉</span><span className="rb-txt">Eliminare dubluri</span>
        </button>
        <button className="rb-small" data-keytip="G" onMouseDown={(e) => e.preventDefault()} onClick={() => unTable(curTable)} title="Conversie în zonă: tabelul nu mai are nume și nu se mai lungește singur; culorile rămân" aria-label="Conversie în zonă">
          <span className="rb-ico">⇲</span><span className="rb-txt">Conversie în zonă</span>
        </button>
</div>
        <button className="rb-big" data-keytip="SF" onMouseDown={(e) => e.preventDefault()} onClick={addSlicer} title="Inserare slicer: butoane de filtrare pentru coloana cu cursorul, câte unul pe fiecare valoare" aria-label="Inserare slicer">
          <span className="rb-ico">▤</span><span className="rb-txt">Inserare slicer</span>
        </button>
        <button className="rb-big" data-keytip="TI" onMouseDown={(e) => e.preventDefault()} onClick={addTimeline} title="Inserare cronologie: perioadele coloanei cu date de sub cursor, ca butoane de filtrare" aria-label="Inserare cronologie">
          <span className="rb-ico">🗓</span><span className="rb-txt">Inserare cronologie</span>
        </button>
</RGroup>
<RGroup label="Opțiuni stil tabel">
<div className="tbl-opts">
        {([['head', 'Rând antet'], ['bandRows', 'Rânduri alternante'], ['filter', 'Buton filtrare'], ['firstCol', 'Prima coloană'], ['lastCol', 'Ultima coloană'], ['bandCols', 'Coloane alternante']] as [keyof TableOpts, string][]).map(([k, label]) => (
          <label key={k} className="tbl-opt rb-check"><input type="checkbox" aria-label={label} checked={!!curTable.opts[k]} onChange={(e) => makeTable(curTable.theme, { ...curTable.opts, total: false, [k]: e.target.checked }, tableArea(curTable))} /> {label}</label>
        ))}
</div>
</RGroup>
<RGroup label="Stiluri tabel">
<div className="tbl-gallery" role="group" aria-label="Stiluri tabel">
        {galleryThemes(doc.tableStyles).map((k) => (
          <button key={k} className={`tbl-swatch${curTable.theme === k ? ' on' : ''}`} title={TABLE_THEMES[k].label} aria-label={`Stil ${TABLE_THEMES[k].label}`}
            style={{ background: `linear-gradient(${TABLE_THEMES[k].head || '#ffffff'} 0 34%, ${TABLE_THEMES[k].band || '#ffffff'} 34% 67%, ${TABLE_THEMES[k].body ?? '#fff'} 67%)`, ...gridLook(k) }}
            onClick={() => makeTable(k, { ...curTable.opts, total: false }, tableArea(curTable))} />
        ))}
</div>
        <button className="rb-small tbl-newstyle" onMouseDown={(e) => e.preventDefault()} onClick={() => openTableStyle(curTable.theme)}
          title="Stil de tabel nou: alegi culorile capului, ale dungilor, ale totalului și liniile; stilul se ține în registru și în .xlsx" aria-label="Stil de tabel nou">
          ＋ {isCustomTheme(curTable.theme) ? 'Modifică stilul…' : 'Stil de tabel nou…'}
        </button>
        {isCustomTheme(curTable.theme) && (
          <button className="rb-small tbl-newstyle" onMouseDown={(e) => e.preventDefault()} onClick={() => deleteTableStyle(curTable.theme)}
            title="Șterge stilul propriu din registru; tabelul acesta primește stilul albastru obișnuit, celelalte își păstrează culorile" aria-label="Șterge stilul de tabel">
            ✕ Șterge stilul
          </button>
        )}
</RGroup>
          </> : null },
          { id: 'chart', label: 'Proiectare diagramă', contextual: true, autoOpen: true, shown: !!chartOn, content: chartOn ? <ChartRibbon
            chart={chartOn}
            series={chartSeriesOf(chartOn, cells, results, styles, chartSrcs)}
            onTitle={(title) => updateChart(chartOn.id, { title }, false)}
            onType={(type) => updateChart(chartOn.id, { type })}
            onLook={(patch, undoable) => updateChart(chartOn.id, patch, undoable)}
            onUseSelection={() => chartUseSel(chartOn)}
            onShowRange={() => showChartRange(chartOn)}
            onCopy={() => copyChart(chartOn)}
            onSave={() => saveChartPng(chartOn)}
            onRemove={() => removeChart(chartOn)}
            onPlace={(onSheet) => placeChart(chartOn, onSheet)}
            onNewSheet={() => chartToNewSheet(chartOn)}
          /> : null },
        ]} />
        {codeDlg !== null && (
          <div className="sh-code-dlg" role="dialog" aria-label="Format particularizat" onKeyDown={(e) => { if (e.key === 'Escape') setCodeDlg(null); }}>
            <b>Format particularizat</b>
            <input autoFocus value={codeDlg} onChange={(e) => setCodeDlg(e.target.value)} aria-label="Codul formatului" placeholder='de exemplu #,##0.00 "buc."' maxLength={200}
              onKeyDown={(e) => { if (e.key === 'Enter') applyCode(codeDlg); }} />
            <span className="sh-code-prev" aria-label="Previzualizare">{cellText(cells[selId], results[selId], { ...selStyle, code: codeDlg.trim() || undefined }) || '(celula e goală)'}</span>
            <select value="" aria-label="Exemple de coduri" onChange={(e) => { if (e.target.value) setCodeDlg(e.target.value); }}>
              <option value="">Exemple…</option>
              {CODE_EXAMPLES.map(([c, label]) => <option key={c} value={c}>{label}: {c}</option>)}
        </select>
            <small>0 = cifră obligatorie, # = cifră dacă există, „,” = mii, „.” = zecimale, text între ghilimele; secțiuni: pozitiv;negativ;zero;text.</small>
            <span>
              <button onClick={() => applyCode(codeDlg)}>Aplică</button>
              <button onClick={() => setCodeDlg(null)}>Renunță</button>
            </span>
          </div>
        )}
      </div>
      {linkBar && !!doc.links?.length && (
        <div className="doc-final-bar sheets-link-bar" role="status">
          <b>🔗 Legături spre alte fișiere.</b> Formulele folosesc valorile păstrate la ultima citire.
          <button disabled={linkBusy} onClick={() => { setLinkBar(false); void updateAllLinks(); }}>↻ Actualizează valorile</button>
          <button className="sheets-link-bar-x" onClick={() => setLinkBar(false)} title="Păstrează valorile de acum">Închide</button>
        </div>
      )}
      <div className="formula-bar" hidden={!fxBar}>
        <button
          className="fx-btn"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { fxBase.current = editRef.current; setFxDlg(true); }}
          title="Inserează o funcție (Shift+F3): cauți după nume sau după ce face (de exemplu „rată”, „vârstă”, „caută”), cu explicații în română"
        >
          <i>fx</i>
        </button>
        <input
          ref={nameBoxRef}
          className="cell-name"
          list="sheet-defined-names"
          value={nameEdit ?? (multi ? `${cellId(range.r0, range.c0)}:${cellId(range.r1, range.c1)}` : selId)}
          // select() mută și focusul: dacă Enter a dus deja la celulă (înaintea cadrului următor), caseta nu se mai alege.
          onFocus={(e) => { finishEdit(); setNameEdit(e.target.value); const el = e.target; requestAnimationFrame(() => { if (document.activeElement === el) el.select(); }); }}
          onChange={(e) => setNameEdit(e.target.value)}
          onBlur={() => setNameEdit(null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); runGoto(e.currentTarget.value); }
            else if (e.key === 'Escape') { e.preventDefault(); setNameEdit(null); focusGrid(); }
          }}
          aria-label="Caseta de nume"
          title="Caseta de nume (F5 / Ctrl+G; ⇲ alături = Mergi la special): scrie o celulă (B12), o zonă (A1:C5, Foaia 2!D4) sau un nume și apasă Enter ca să ajungi acolo. Un nume nou, scris cu o zonă selectată, devine numele zonei."
          spellCheck={false}
        />
        <datalist id="sheet-defined-names">
          {(doc.names ?? []).filter((d) => d.sheet === undefined || d.sheet === sheet.name).map((d) => <option key={(d.sheet ?? '') + d.name} value={d.name} />)}
        </datalist>
        <button className="gs-btn" onClick={() => { finishEdit(); setGsDlg(true); }} title="Mergi la special: selectează dintr-odată celulele goale, formulele, valorile, notele, zona curentă, celulele vizibile…" aria-label="Mergi la special">⇲</button>
        {!multi && selTotal && (
          <select
            className="total-fn"
            value={selTotal.code}
            onChange={(e) => setTotalFn(Number(e.target.value))}
            aria-label="Ce calculează totalul"
            title="Ce calculează rândul de total pe coloana aceasta (doar rândurile care se văd)"
          >
            {TOTAL_FNS.map(([c, label]) => <option key={c} value={c}>Σ {label}</option>)}
          </select>
        )}
        <textarea
          rows={1}
          aria-label="Conținutul celulei"
          value={edit ?? editTextOf(selId)}
          onFocus={() => { if (edit === null) { setExt(sel); startEdit(editTextOf(selId), true); } }}
          onChange={(e) => { setEditInBar(true); changeEdit(e.target.value); }}
          onKeyDown={onEditKey}
          onBlur={() => { if (editInBar) finishEdit(); }}
          className={fxTall ? 'fx-tall' : undefined}
        />
        <button className="fx-expand" onMouseDown={(e) => e.preventDefault()} onClick={() => setFxTall((v) => !v)}
          title={fxTall ? 'Restrângere bară de formule (Ctrl+Shift+U)' : 'Extindere bară de formule (Ctrl+Shift+U)'} aria-label={fxTall ? 'Restrângere bară de formule' : 'Extindere bară de formule'}>{fxTall ? '˄' : '˅'}</button>
      </div>
      {find && (
        <SheetFind
          mode={find.mode}
          tick={find.tick}
          onMode={(mode) => setFind({ mode, tick: find.tick + 1 })}
          cells={cells}
          results={results}
          styles={styles}
          hidden={hidden}
          sel={sel}
          sheets={doc.sheets}
          active={active}
          bookOf={(sh) => evaluateAll(sh.cells, { self: sh.name, sheets: doc.sheets, names: doc.names, pivots: doc.pivots, match: doc.match, iterate: doc.iter, ext: doc.links })}
          onGo={(p, s) => {
            if (s === undefined || s === active) { selectRange(p); return; }
            switchSheet(s);
            setTimeout(() => selectRange(p), 0);
          }}
          onApplyBook={(next, n) => {
            if (n) applySheets({ sheets: next, active });
            setStatus(n ? `Am înlocuit de ${n} ${n === 1 ? 'dată' : 'ori'} în tot registrul (Ctrl+Z anulează)` : 'Nimic de înlocuit în ce e scris în celule');
          }}
          onApply={(patch, n) => {
            applyCells(patch);
            setStatus(n ? `Am înlocuit de ${n} ${n === 1 ? 'dată' : 'ori'} (Ctrl+Z anulează)` : 'Nimic de înlocuit în ce e scris în celule');
          }}
          onClose={() => { setFind(null); focusGrid(); }}
        />
      )}
      <MiniBar target={gridEl} disabled={edit !== null || !!painter} onContext={(e) => !!(e.target as Element).closest?.('tr[data-r] td')}>
        {/* Ca în programul de tabele cunoscut: rândul 1 font, mărime, A^ A˅, contabil, %, stil virgulă, pensula; rândul 2 B I, centrat, culori, borduri, îmbinare, zecimale. */}
        <div className="mb-rows">
        <div className="mb-row">
          <select value={selStyle.font ?? ''} aria-label="Fontul celulelor" title="Fontul textului din celulele selectate"
            onChange={(e) => { const v = e.target.value; styleRange((s) => { const n = { ...s }; if (v) n.font = v; else delete n.font; return n; }); focusGrid(); }}>
            <option value="">Font obișnuit</option>
            {[...FONTS, ...(selStyle.font && !FONTS.includes(selStyle.font) ? [selStyle.font] : [])].map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <select className="size-select" value={selStyle.sz ?? ''} aria-label="Mărimea textului" title="Mărimea textului (puncte)"
            onChange={(e) => { const v = Number(e.target.value); styleRange((s) => { const n = { ...s }; if (v) n.sz = v; else delete n.sz; return n; }); focusGrid(); }}>
            <option value="">11</option>
            {[...FONT_SIZES.filter((n) => n !== 11), ...(selStyle.sz && !FONT_SIZES.includes(selStyle.sz) ? [selStyle.sz] : [])].sort((a, b) => a - b).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <button onClick={() => stepFontSize(1)} title="Mărire font" aria-label="Mărire font">A<sup>^</sup></button>
          <button onClick={() => stepFontSize(-1)} title="Micșorare font" aria-label="Micșorare font">A<sub>˅</sub></button>
          <button onClick={() => setFormat('acct')} title="Format număr contabil (lei, cu zero scris ca „-”)" aria-label="Format număr contabil">lei</button>
          <button onClick={() => setFormat('percent')} title="Stil procent (Ctrl+Shift+%)" aria-label="Stil procent">%</button>
          <button onClick={() => setFormat('number')} title="Stil virgulă: separator de mii și două zecimale (1.234,50)" aria-label="Stil virgulă">000</button>
          <button className={painter ? 'active' : ''} onClick={() => togglePainter()} title="Descriptor de formate: copiază formatarea pe alte celule" aria-label="Descriptor de formate">🖌</button>
        </div>
        <div className="mb-row">
          <button className={selStyle.b ? 'active' : ''} onClick={() => toggleStyle('b')} title="Aldin (Ctrl+B)" aria-label="Aldin"><b>B</b></button>
          <button className={selStyle.i ? 'active' : ''} onClick={() => toggleStyle('i')} title="Cursiv (Ctrl+I)" aria-label="Cursiv"><i>I</i></button>
          <button className={selStyle.align === 'center' ? 'active' : ''} onClick={() => styleRange((s) => ({ ...s, align: s.align === 'center' ? undefined : 'center' }))} title="Centrare" aria-label="Centrare">≡</button>
          <label className="color-pick" title="Culoare umplere (fundalul celulei)">
            <span className="bg-swatch" style={{ background: selStyle.bg ?? '#fff59d' }} />
            <input type="color" aria-label="Culoare umplere" value={selStyle.bg ?? '#fff59d'} onChange={(e) => styleRange((s) => ({ ...s, bg: e.target.value }))} />
          </label>
          <label className="color-pick" title="Culoare font">
            <span style={{ borderBottom: `3px solid ${selStyle.color ?? 'currentColor'}` }}>A</span>
            <input type="color" aria-label="Culoare font" value={selStyle.color ?? '#000000'} onChange={(e) => styleRange((s) => ({ ...s, color: e.target.value }))} />
          </label>
          <button onClick={() => { applyCells({}, withLook(borderPatch(styles, upTo(range, Math.max(WORK_ROWS - 1, usedR)), 'all'), lineLook)); focusGrid(); }} title="Borduri: toate bordurile pe celulele alese (celelalte feluri sunt în Pornire › Font › Borduri)" aria-label="Borduri">▦</button>
          <button className={mergeAt(merges, sel.r, sel.c) ? 'active' : ''} onClick={toggleMerge} title="Îmbinare și centrare (încă un clic desparte celulele)" aria-label="Îmbinare și centrare">⊞</button>
          <button onClick={() => changeDecimals(1)} title="Mărire zecimale" aria-label="Mărire zecimale">,00</button>
          <button onClick={() => changeDecimals(-1)} title="Micșorare zecimale" aria-label="Micșorare zecimale">,0</button>
        </div>
        </div>
      </MiniBar>
      <div className={(splitOn ? 'sheet-body split-on' + (splitDir === 'v' ? ' split-v' : '') : 'sheet-body') + (layoutOn ? ' layout-on' : '')}>
      {layoutOn && <PageLayout data={layoutPdf} busy={!!printing?.layout} error={layoutErr} set={printSet} onChange={setPrint} onNormal={() => showLayout(false)}
        textOf={editTextOf} onWrite={writeCellDirect} />}
      {/* Alegerea din copie nu e începutul unei trageri: fără drag = null, mouse-ul peste foaie ar lăți selecția. */}
      {splitOn && splitDir === 'h' && <SheetSplit gridRef={gridRef} ratio={splitRatio} setRatio={setSplitRatio} onClose={() => { setSplitOn(false); setView2(null); }} onView={setView2} rowPx={sizes.current.rowPx}
        onPick={(r, c) => { selectCell(r, c, false); drag.current = null; focusGrid(); }} textOf={editTextOf} onWrite={writeCellDirect} />}
      <div
        className={`sheet-wrap ${fzRows ? 'frozen' : ''} ${fzCols ? 'frozen-col' : ''}${painter ? ' painting' : ''}${sheet.noGrid ? ' no-grid' : ''}${noHead ? ' no-head' : ''}`}
        ref={gridRef}
        style={{ ...(zoom === 100 ? {} : { zoom: zoom / 100 }), ...(splitOn ? (splitDir === 'v' ? { flex: `${splitRatio} 1 0` } : splitDir === 'q' ? { flex: `${splitRatioX} 1 0`, height: `${splitRatio * 100}%` } : { height: `${splitRatio * 100}%` }) : {}) }}
        tabIndex={0}
        onKeyDown={onGridKey}
        onCopy={(e) => onCopy(e)}
        onCut={(e) => onCopy(e, true)}
        onPaste={onPaste}
        onScroll={onGridScroll}
        onMouseDown={() => { if (selChart) setSelChart(null); }}
      >
        {pics.map((p) => {
          const b = picDrag?.id === p.id ? picDrag : picBox(p);
          if (!b) return null;
          return (
            <div key={p.id} className={'sh-pic' + (p.cell ? ' in-cell' : '') + (selPic === p.id ? ' on' : '')} style={{ left: b.x, top: b.y, width: b.w, height: b.h }} tabIndex={-1}
              role="img" aria-label={p.alt || 'Poză'} title={p.alt || undefined}
              onPointerDown={(e) => picDown(e, p, 'move')} onKeyDown={(e) => picKey(e, p)}
              onDoubleClick={sheet.protect ? undefined : p.wa ? () => setWaDlg({ id: p.id, text: p.wa!.text, s: p.wa!.s }) : p.sh ? () => setShDlg({ id: p.id, sh: p.sh! }) : p.eq ? () => setEqDlg({ id: p.id, src: p.eq! }) : p.dg ? () => setDgDlg({ id: p.id, d: p.dg! }) : p.m3d ? () => setM3dDlg({ id: p.id, init: keptModel(p.m3d!) }) : undefined}
              onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setSelPic((s) => (s === p.id ? null : s)); }}>
              <img src={p.src} alt="" draggable={false} />
              {selPic === p.id && !sheet.protect && p.ic && <IconRecolorBar spec={p.ic} onChange={(q) => void recolorIcon(p.id, p.ic!, q)} />}
              {selPic === p.id && !sheet.protect && !p.cell && <span className="sh-pic-size" title="Trage ca să mărești (Shift: fără proporții)" onPointerDown={(e) => picDown(e, p, 'size')} />}
            </div>
          );
        })}
        {charts.map((ch) => {
          if (!ch.at) return null;
          const b = chartDrag?.id === ch.id ? chartDrag : picBox(ch.at);
          if (!b) return null;
          const on = selChart === ch.id;
          return (
            <div key={ch.id} className={'sh-pic sh-chart' + (on ? ' on' : '')} style={{ left: b.x, top: b.y, width: b.w, height: b.h }} tabIndex={-1}
              role="img" aria-label={'Grafic' + (ch.title ? ': ' + ch.title : '')} data-chart={ch.id}
              onPointerDown={(e) => chartDown(e, ch, 'move')} onKeyDown={(e) => chartKey(e, ch)}>
              <div className="sh-chart-svg" dangerouslySetInnerHTML={{ __html: chartSvgFor(ch, cells, results, styles, chartSrcs) }} />
              {on && !sheet.protect && <span className="sh-pic-size" title="Trage ca să mărești (Shift: cu aceleași proporții)" onPointerDown={(e) => chartDown(e, ch, 'size')} />}
            </div>
          );
        })}
        {pageInfo && <div ref={pbLine} className="pb-drag-line" hidden />}
        <table className="grid" onPointerDownCapture={pageInfo ? pbDown : undefined} onPointerMove={pageInfo ? pbMove : undefined} onPointerUp={pageInfo ? pbUp : undefined} onPointerCancel={pageInfo ? pbUp : undefined} style={{ width: headW + widths.reduce((a, b) => a + b, 0), ...(doc.theme?.fonts ? { '--cell-font': `"${doc.theme.fonts.minor}", system-ui, sans-serif` } as React.CSSProperties : {}) }}>
          <colgroup>
            <col style={{ width: headW }} />
            {drawnCols(colWin, viewCols).map((c) => {
              // La foile late, coloanele de sub o celulă goală sunt un singur <col span> cu lățimea lor medie.
              const pad = colWin ? padCell(colWin, c, viewCols) : 0;
              if (pad > 0) return padParts(c, pad).map(([c0, n]) => { let sum = 0; for (let k = c0; k < c0 + n; k++) if (!hiddenC.has(k)) sum += widths[k]; return <col key={'p' + c0} span={n} style={{ width: sum / n }} />; });
              return <col key={c} style={hiddenC.has(c) ? { width: 0, visibility: 'collapse' } : { width: widths[c] }} />;
            })}
          </colgroup>
          <thead>
            <tr>
              <th className="corner">
                {maxLevel(sheet.rowLvl) > 0 && (
                  <span className="ol-levels">
                    {Array.from({ length: maxLevel(sheet.rowLvl) + 1 }, (_, i) => (
                      <button key={i} className="ol-lvl" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => groupLevel(i + 1)}
                        title={i === 0 ? 'Nivelul 1: strânge toate grupurile de rânduri' : i === maxLevel(sheet.rowLvl) ? 'Desface toate grupurile de rânduri' : `Arată rândurile grupate până la nivelul ${i + 1}`}>{i + 1}</button>
                    ))}
                  </span>
                )}
              </th>
              {drawnCols(colWin, viewCols).map((c) => (colWin && padCell(colWin, c, viewCols)) ? (padCell(colWin, c, viewCols) < 0 ? null : padParts(c, padCell(colWin, c, viewCols)).map(([c0, n]) => <th key={'p' + c0} className="col-pad" aria-hidden colSpan={n} />)) : (
                <th
                  key={c}
                  className={`${allRanges.some((g) => g.r0 === 0 && g.r1 === ROWS - 1 ? c >= g.c0 && c <= g.c1 : c >= g.c0 && c <= g.c1 && g === range) ? 'on' : ''}${c > 0 && hiddenC.has(c - 1) && !hiddenC.has(c) ? ' gap-left' : ''}${c < fzCols ? ' fzc' : ''}${c === fzCols - 1 ? ' fzc-last' : ''}`}
                  style={c < fzCols ? { left: fzLefts[c] } : undefined}
                  title={c > 0 && hiddenC.has(c - 1) ? 'În stânga sunt coloane ascunse: selectează coloanele din jur, clic dreapta → Afișează' : undefined}
                  onMouseDown={(e) => { e.preventDefault(); if (e.button === 0) selectHead(-1, c, e.shiftKey, e.ctrlKey); }}
                  onMouseEnter={(e) => { if (e.buttons & 1) dragHead('c', c); }}
                  onContextMenu={(e) => { e.preventDefault(); openHeadMenu('c', c, e.clientX, e.clientY); }}
                >
                  {colName(c)}
                  {(() => {
                    const ol = olMark('c', c);
                    if (!ol) return null;
                    return (<>
                      {parseInt(ol) > 0 && <span className="ol-mark col" style={{ height: parseInt(ol) * 3 }} />}
                      {/[+-]/.test(ol) && <button className="ol-btn col" tabIndex={-1} title={ol.endsWith('+') ? 'Desface grupul de coloane din stânga' : 'Strânge grupul de coloane din stânga'}
                        onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); flipGroup('c', c); }}>{ol.endsWith('+') ? '+' : '−'}</button>}
                    </>);
                  })()}
                  <span
                    className="col-resize"
                    title="Trage ca să schimbi lățimea (dublu-click: potrivește după text)"
                    onMouseDown={(e) => startResize(c, e)}
                    onDoubleClick={(e) => { e.stopPropagation(); autoFit(c); }}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {winRows.slice(0, pinned).map(rowEl)}
            {padTop2 > 0 && <tr className="pad" aria-hidden><td colSpan={viewCols + 1} style={{ height: padTop2 }} /></tr>}
            {before2 && rows2.map(rowEl)}
            {before2 && padMid > 0 && <tr className="pad" aria-hidden><td colSpan={viewCols + 1} style={{ height: padMid }} /></tr>}
            {winRows.slice(pinned).map(rowEl)}
            {!before2 && padMid > 0 && <tr className="pad" aria-hidden><td colSpan={viewCols + 1} style={{ height: padMid }} /></tr>}
            {!before2 && rows2.map(rowEl)}
            {padBottom > 0 && <tr className="pad" aria-hidden><td colSpan={viewCols + 1} style={{ height: padBottom }} /></tr>}
          </tbody>
        </table>
        {traceArrows && (
          <svg className={`trace-arrows ${trace?.kind === 'p' ? 'p' : 'd'}`} aria-hidden width="1" height="1">
            <defs>
              <marker id="trace-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 z" />
              </marker>
            </defs>
            {traceArrows.map((a, i) => (
              <g key={i}>
                {a.area && <rect x={a.area.x + 1} y={a.area.y + 1} width={Math.max(0, a.area.w - 2)} height={Math.max(0, a.area.h - 2)} />}
                <circle cx={a.from.x} cy={a.from.y} r="3" />
                {(a.from.x !== a.to.x || a.from.y !== a.to.y) && <line x1={a.from.x} y1={a.from.y} x2={a.to.x} y2={a.to.y} markerEnd="url(#trace-head)" />}
              </g>
            ))}
          </svg>
        )}
        {formulaBoxes && (
          <svg className="formula-refs" aria-hidden width="1" height="1">
            {formulaBoxes.map((f, i) => <rect key={i} className={f.live ? 'live' : undefined} x={f.x + 1} y={f.y + 1} width={Math.max(0, f.w - 2)} height={Math.max(0, f.h - 2)} style={{ stroke: f.color }} />)}
          </svg>
        )}
        {notePops.map((n) => {
          let x = headW;
          for (let c = 0; c <= n.c; c++) x += widths[c];
          return (
            <div key={n.id} className="note-pop" style={{ left: x + 8, top: headH() + topOf(n.pos) }} title={`Nota din ${n.id}`}>
              {n.note}
            </div>
          );
        })}
      </div>
      {splitOn && splitDir === 'v' && <SheetSplit dir="v" gridRef={gridRef} ratio={splitRatio} setRatio={setSplitRatio} onClose={() => { setSplitOn(false); setView2(null); }} onView={setView2} rowPx={sizes.current.rowPx}
        onPick={(r, c) => { selectCell(r, c, false); drag.current = null; focusGrid(); }} textOf={editTextOf} onWrite={writeCellDirect} />}
      {splitOn && splitDir === 'q' && <SheetSplit dir="q" gridRef={gridRef} ratio={splitRatio} setRatio={setSplitRatio} ratioX={splitRatioX} setRatioX={setSplitRatioX}
        onClose={() => { setSplitOn(false); setView2(null); }} onView={setView2} rowPx={sizes.current.rowPx}
        onPick={(r, c) => { selectCell(r, c, false); drag.current = null; focusGrid(); }} textOf={editTextOf} onWrite={writeCellDirect} />}
      {(pvShown || !!pvTl || (filter && [...(sheet.slicers ?? []), ...(sheet.timelines ?? []).map((t) => t.col)].some((n) => { const c = colIndex(n); return c >= filter.c0 && c <= filter.c1; }))) && (
        <div className="slicer-panel" aria-label="Butoane de filtrare">
          {pvShown && (
            <div className="slicer pv-slicer" role="group" aria-label="Butoane de filtrare ale rezumatului">
              <div className="slicer-head">
                <b title="Filtrul rezumatului (B3)">{cellText(cells.A3, results.A3, styles.A3).trim() || 'Filtru'}</b>
                <button className="slicer-clear" disabled={!pvPicked.length} onClick={() => pickPivotSlice(null, false)} title="Arată toate valorile în rezumat" aria-label="Toate valorile din rezumat">⊘</button>
                <button className="slicer-close" onClick={() => { const n = { ...sheet }; delete n.pvSlicer; applySheet(n); focusGrid(); }} title="Închide butoanele (filtrul rămâne)" aria-label="Închide butoanele rezumatului">×</button>
              </div>
              <div className="slicer-items">
                {pvVals.map((v) => (
                  <button key={v} className={'slicer-item' + (!pvPicked.length || pvPicked.includes(v) ? ' on' : '')} aria-pressed={!pvPicked.length || pvPicked.includes(v)}
                    onClick={(e) => pickPivotSlice(v, e.ctrlKey || e.metaKey)} title={v + ' (Ctrl+clic: alegi mai multe)'}>{v}</button>
                ))}
              </div>
            </div>
          )}
          {pvTl && (() => {
            const head = cellText(cells.A3, results.A3, styles.A3).trim() || 'Filtru';
            const list = periods(pvDates(), pvTl, pvOn ? [pvOn.from, pvOn.to] : []);
            const groups: { name: string; items: TimePeriod[] }[] = [];
            for (const pd of list ?? []) { const g = groups[groups.length - 1]; if (g && g.name === pd.group) g.items.push(pd); else groups.push({ name: pd.group, items: [pd] }); }
            return (
              <div className="slicer timeline pv-timeline" role="group" aria-label="Cronologia rezumatului">
                <div className="slicer-head">
                  <b title="Filtrul rezumatului (B3)">🗓 {head}</b>
                  <button className="slicer-clear" disabled={!pvPicked.length} onClick={() => pickPivotSlice(null, false)} title="Arată toate perioadele în rezumat" aria-label="Toate perioadele din rezumat">⊘</button>
                  <button className="slicer-close" onClick={() => { const n = { ...sheet }; delete n.pvTimeline; applySheet(n); focusGrid(); }} title="Închide cronologia (filtrul rămâne)" aria-label="Închide cronologia rezumatului">×</button>
                </div>
                <div className="tl-sub">
                  <span className="tl-range">{pvOn ? rangeParts(pvOn.from, pvOn.to, pvTl).map((x, i) => <span key={i}>{i ? ' – ' : ''}<span>{x.label}</span>{x.group ? ' ' + x.group : ''}</span>) : <span>Toate perioadele</span>}</span>
                  <select value={pvTl} onChange={(e) => { applySheet({ ...sheet, pvTimeline: e.target.value as TimeLevel }); focusGrid(); }} aria-label="Nivelul cronologiei rezumatului" title="Câte perioade arată cronologia: ani, trimestre, luni sau zile">
                    {TIME_LEVELS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                  </select>
                </div>
                {!list ? <div className="tl-note">Prea multe perioade: alege Luni sau Ani</div> : (
                  <div className="tl-items">
                    {groups.map((g) => (
                      <div className={'tl-group tl-' + pvTl} key={g.name || 'all'}>
                        {g.name && <div className="tl-year">{g.name}</div>}
                        <div className="tl-row">
                          {g.items.map((pd) => {
                            const sel1 = !!pvOn && pd.to >= pvOn.from && pd.from <= pvOn.to;
                            return (
                              <button key={pd.from} className={'tl-item' + (sel1 ? ' on' : '') + (pd.count === 0 ? ' empty' : '')} aria-pressed={sel1}
                                onClick={(e) => pickPvPeriod(pd, e.shiftKey)} title={pd.label + (pd.group ? ' ' + pd.group : '') + ' (Shift+clic: până la ea)'}>{pd.label}</button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
          {filter && (sheet.timelines ?? []).map((t) => {
            const c = colIndex(t.col);
            if (c < filter.c0 || c > filter.c1) return null;
            const head = cellText(cells[cellId(filter.r, c)], results[cellId(filter.r, c)], styles[cellId(filter.r, c)]).trim() || `Coloana ${t.col}`;
            const cur = filter.cond?.[t.col];
            const on = cur?.op === 'between' ? { from: Math.min(Number(cur.v1), Number(cur.v2)), to: Math.max(Number(cur.v1), Number(cur.v2)) } : null;
            const any = !!cur || !!filter.hidden[t.col]?.length || !!filter.color?.[t.col];
            const serials = columnSerials(cells, results, styles, c, filter.r + 1, filterEnd(cells, filter), hiddenRows(cells, results, styles, filter, c));
            const list = periods(serials, t.level, on ? [on.from, on.to] : []);
            const groups: { name: string; items: TimePeriod[] }[] = [];
            for (const pd of list ?? []) { const g = groups[groups.length - 1]; if (g && g.name === pd.group) g.items.push(pd); else groups.push({ name: pd.group, items: [pd] }); }
            return (
              <div className="slicer timeline" key={'tl-' + t.col} role="group" aria-label={`Cronologie: ${head}`}>
                <div className="slicer-head">
                  <b title={head}>🗓 {head}</b>
                  <button className="slicer-clear" disabled={!any} onClick={() => applyFilter(c, [])} title="Arată toate perioadele (scoate filtrul de pe coloană)" aria-label={`Toate perioadele: ${head}`}>⊘</button>
                  <button className="slicer-close" onClick={() => removeTimeline(t.col)} title="Închide cronologia (filtrul rămâne)" aria-label={`Închide cronologia: ${head}`}>×</button>
                </div>
                <div className="tl-sub">
                  <span className="tl-range" title={on ? rangeLabel(on.from, on.to, t.level) : undefined}>{on ? rangeParts(on.from, on.to, t.level).map((x, i) => <span key={i}>{i ? ' – ' : ''}<span>{x.label}</span>{x.group ? ' ' + x.group : ''}</span>) : 'Toate perioadele'}</span>
                  <select value={t.level} onChange={(e) => setTimeLevel(t.col, e.target.value as TimeLevel)} aria-label={`Nivelul cronologiei: ${head}`} title="Câte perioade arată cronologia: ani, trimestre, luni sau zile">
                    {TIME_LEVELS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                  </select>
                </div>
                {!list ? <div className="tl-note">Prea multe perioade: alege Luni sau Ani</div> : !list.length ? <div className="tl-note">Nicio dată în rândurile arătate</div> : (
                  <div className="tl-items">
                    {groups.map((g) => (
                      <div className={`tl-group tl-${t.level}`} key={g.name || 'all'}>
                        {g.name && <div className="tl-year">{g.name}</div>}
                        <div className="tl-row">
                          {g.items.map((pd) => {
                            const sel1 = !on || (pd.to >= on.from && pd.from <= on.to);
                            return (
                              <button key={pd.from}
                                className={`tl-item${on && sel1 ? ' on' : ''}${pd.count === 0 ? ' empty' : ''}`}
                                aria-pressed={!!on && sel1}
                                onClick={(e) => pickPeriod(c, pd, e.shiftKey)}
                                title={`${pd.label}${pd.group ? ' ' + pd.group : ''}: ${pd.count} ${pd.count === 1 ? 'rând' : 'rânduri'} (Shift+clic: până la ea)`}
                              >{pd.label}</button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {filter && (sheet.slicers ?? []).map((n) => {
            const c = colIndex(n);
            if (c < filter.c0 || c > filter.c1) return null;
            const head = cellText(cells[cellId(filter.r, c)], results[cellId(filter.r, c)], styles[cellId(filter.r, c)]).trim() || `Coloana ${n}`;
            const vals = columnValues(cells, results, styles, filter, c);
            const off = new Set(filter.hidden[n] ?? []);
            const any = off.size > 0 || !!filter.cond?.[n] || !!filter.color?.[n];
            return (
              <div className="slicer" key={n} role="group" aria-label={`Butoane de filtrare: ${head}`}>
                <div className="slicer-head">
                  <b title={head}>{head}</b>
                  <button className="slicer-clear" disabled={!any} onClick={() => applyFilter(c, [])} title="Arată toate valorile (scoate filtrul de pe coloană)" aria-label={`Arată tot: ${head}`}>⊘</button>
                  <button className="slicer-close" onClick={() => removeSlicer(n)} title="Închide butoanele (filtrul rămâne)" aria-label={`Închide butoanele: ${head}`}>×</button>
                </div>
                <div className="slicer-items">
                  {vals.map((v) => (
                    <button
                      key={v.text}
                      className={`slicer-item${!any || !off.has(v.text) ? ' on' : ''}${v.count === 0 ? ' empty' : ''}`}
                      aria-pressed={!any || !off.has(v.text)}
                      onClick={(e) => pickSlice(c, v.text, e.ctrlKey || e.metaKey)}
                      title={`${v.text}: ${v.count} ${v.count === 1 ? 'rând' : 'rânduri'} (Ctrl+clic: alegi mai multe)`}
                    >{v.text}</button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {showCharts && panelCharts.length > 0 && (
        <div className="chart-panel">
          {panelCharts.map((ch) => (
            <ChartCard
              key={ch.id}
              chart={ch}
              selected={chartOn?.id === ch.id}
              onSelect={() => setSelChart(ch.id)}
              svg={chartSvgFor(ch, cells, results, styles, chartSrcs)}
              onTitle={(title) => updateChart(ch.id, { title }, false)}
              onType={(type) => updateChart(ch.id, { type })}
              onLook={(patch, undoable) => updateChart(ch.id, patch, undoable)}
              onUseSelection={() => chartUseSel(ch)}
              onShowRange={() => showChartRange(ch)}
              onCopy={() => copyChart(ch)}
              onSave={() => saveChartPng(ch)}
              onRemove={() => removeChart(ch)}
            />
          ))}
        </div>
      )}
      </div>
      <div className="sheet-tabs" role="tablist" aria-label="Foile tabelului">
        <button className="sheet-tab-add" onClick={newTab} title="Foaie nouă">+</button>
        {doc.sheets.map((s, i) => (
          s.hidden ? null : renaming === i ? (
            <TabRename
              key={i}
              name={s.name}
              onDone={(name) => renameTab(i, name)}
              onCancel={() => { setRenaming(null); focusGrid(); }}
            />
          ) : (
            <button
              key={i}
              role="tab"
              aria-selected={i === active}
              className={`sheet-tab ${i === active ? 'active' : ''}${group.length > 1 && group.includes(i) ? ' grouped' : ''}`}
              aria-selected-group={group.length > 1 && group.includes(i) ? 'true' : undefined}
              style={s.tab ? { boxShadow: `${i === active ? 'inset 0 2px 0 var(--accent), ' : ''}inset 0 -4px 0 ${s.tab}` } : undefined}
              onClick={(e) => {
                if (e.ctrlKey && i !== active) { finishEdit(); setGroup((g) => (g.includes(i) ? g.filter((x) => x !== i) : [...g.filter((x) => x !== active), i, active])); return; }
                if (e.shiftKey && i !== active) { finishEdit(); const a = Math.min(i, active), b = Math.max(i, active); setGroup(doc.sheets.map((_, j) => j).filter((j) => j >= a && j <= b && !doc.sheets[j].hidden)); return; }
                setGroup([]); switchSheet(i);
              }}
              onDoubleClick={() => { setGroup([]); switchSheet(i); setRenaming(i); }}
              onContextMenu={(e) => { e.preventDefault(); switchSheet(i); setTabMenu({ i, x: e.clientX, y: e.clientY }); }}
              title="Click: deschide foaia · Ctrl+click: alege mai multe foi (ce scrii apare în toate) · Shift+click: toate foile până aici · Dublu-click: redenumește · Click dreapta: mai multe (Ctrl+PageUp / PageDown)"
            >
              {s.name}
            </button>
          )
        ))}
      </div>
      <div className="statusbar">
        <span>{filled} {filled === 1 ? 'celulă completată' : 'celule completate'}</span>
        <LabelBadge value={doc.props?.label} onClick={() => { finishEdit(); setPropsDlg(true); }} />
        {stats ? (
          <span>
            {stats.n > 0 && <>Sumă: {formatNumber(stats.sum)} · Medie: {formatNumber(stats.sum / stats.n)} · </>}
            Număr: {stats.count}
          </span>
        ) : selRes?.err ? (
          <span className="sheet-err-help">{selRes.err}: {ERROR_HELP[selRes.err]}</span>
        ) : selRes ? <span className="no-i18n">{selId} = {selRes.text}</span> : null}
        {filter && fHidden.size > 0 && (
          <span className="sheet-filter-info">Filtru: se văd {filterRows - fHidden.size} din {filterRows} rânduri</span>
        )}
        <span>{status}</span>
        {calcStale && (
          <button className="calc-now" onClick={() => { setCalcTick((t) => t + 1); setStatus('Am recalculat toate formulele'); focusGrid(); }} title="În calculul manual formulele nu se refac singure: clic (sau F9) ca să le recalculezi">
            Calculează (F9)
          </button>
        )}
        <button
          className={`calc-mode${manual ? ' on' : ''}`}
          onClick={toggleCalc}
          title="Opțiuni de calcul: automat (formulele se refac la fiecare schimbare) sau manual (doar la F9). Se păstrează în fișier și în .xlsx."
        >
          {manual ? 'Calcul: manual' : 'Calcul: automat'}
        </button>
        <span className="calc-iter-wrap">
          <button className={`calc-mode calc-iter${doc.iter ? ' on' : ''}`} onClick={() => setIterDlg(!iterDlg)} aria-expanded={iterDlg}
            title="Calculul iterativ: formulele care depind de ele însele (referințe circulare, de exemplu un comision calculat din total) se calculează pe rând, până nu se mai schimbă">
            ↻ Iterativ{doc.iter ? ' ✓' : ''}
          </button>
          {iterDlg && (
            <div className="calc-iter-pop" role="dialog" aria-label="Calcul iterativ" onKeyDown={(e) => { if (e.key === 'Escape') { setIterDlg(false); focusGrid(); } }}>
              <label><input type="checkbox" checked={!!doc.iter} onChange={(e) => { setIter(e.target.checked ? { max: 100, delta: 0.001 } : undefined); setStatus(e.target.checked ? 'Calcul iterativ pornit: referințele circulare se calculează pe rând' : 'Calcul iterativ oprit: o referință circulară dă #CIRC!'); }} /> Pornește calculul iterativ</label>
              <label>Număr maxim de treceri
                <input type="number" min={1} max={32767} disabled={!doc.iter} value={doc.iter?.max ?? 100} onChange={(e) => doc.iter && setIter({ ...doc.iter, max: Math.max(1, Math.min(32767, Math.round(+e.target.value) || 1)) })} />
              </label>
              <label>Schimbare maximă
                <input type="number" min={0} step={0.001} disabled={!doc.iter} value={doc.iter?.delta ?? 0.001} onChange={(e) => doc.iter && setIter({ ...doc.iter, delta: Math.max(0, +e.target.value || 0) })} />
              </label>
              <p>Calculul se oprește după numărul de treceri sau când nicio valoare nu se mai schimbă mai mult decât atât. Se păstrează și în .xlsx.</p>
              <button onClick={() => { setIterDlg(false); focusGrid(); }}>Gata</button>
            </div>
          )}
        </span>
        <ZoomControl zoom={zoom} setZoom={setZoom} what="tabelul" onFit={zoomToSel} fitLabel="⤢ Selecția" fitTitle="Zoom pe selecție: zona selectată umple fereastra (între 50% și 200%)" />
        <span className="save-state">{dirty ? (path ? (shOpts.autosave ? 'Se salvează…' : 'Nesalvat (Ctrl+S salvează)') : 'Nesalvat') : savedAt ? `Salvat la ${savedAt}` : ''}</span>
      </div>
      {menu && filter && menu.c >= filter.c0 && menu.c <= filter.c1 && (
        <FilterMenu
          key={menu.c}
          x={menu.x}
          y={menu.y}
          col={colName(menu.c)}
          values={columnValues(cells, results, styles, filter, menu.c)}
          off={filter.hidden[colName(menu.c)] ?? []}
          cond={filter.cond?.[colName(menu.c)]}
          colors={columnColors(cells, results, styles, filter, menu.c)}
          color={filter.color?.[colName(menu.c)]}
          onApply={(vals, cond, color) => applyFilter(menu.c, vals, cond, color)}
          onSort={(desc) => sort(desc, menu.c, true)}
          active={!!(filter.hidden[colName(menu.c)]?.length || filter.cond?.[colName(menu.c)] || filter.color?.[colName(menu.c)])}
          onClearCol={() => applyFilter(menu.c, [])}
          onClose={() => { setMenu(null); focusGrid(); }}
        />
      )}
      {ntMenu && (
        <div className="numtext-back" onMouseDown={() => { setNtMenu(null); focusGrid(); }}>
          <div className="numtext-pop" role="menu" aria-label="Număr stocat ca text" style={{ left: ntMenu.x, top: ntMenu.y }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="numtext-head">Număr stocat ca text</div>
            <button role="menuitem" onClick={convertNumText} title="Șterge apostroful din față: valoarea se adună și se sortează ca un număr">Conversie în număr</button>
            <button role="menuitem" onClick={ignoreNumText} title="Lasă textul așa și ascunde triunghiul verde">Ignorare eroare</button>
          </div>
        </div>
      )}
      {textDlg && (
        <TextImportDialog name={fileName(textDlg.file.path)} size={textDlg.file.data.length} data={textDlg.file.data}
          initial={{ text: textDlg.text, options: textDlg.options }}
          onClose={() => { setTextDlg(null); focusGrid(); }} onImport={finishTextImport} />
      )}
      {docDlg && (
        <DocTablesDialog name={fileName(docDlg.file.path)} tables={docDlg.tables}
          onClose={() => { setDocDlg(null); focusGrid(); }} onImport={(o) => void finishDocTables(o)} />
      )}
      {propsDlg && (
        <PropsDialog value={{ ...doc.props, title: doc.title }}
          stats={{ sheets: doc.sheets.length, cells: doc.sheets.reduce((n, s, i) => n + Object.values(i === active ? cells : s.cells).filter(Boolean).length, 0) }}
          mark={{ on: labelMarkOf({ footer: sheet.print?.footer ?? '' }).footer, text: 'Scrie clasificarea în subsol la tipărire', hint: 'Numele clasificării apare jos pe fiecare pagină tipărită sau în PDF, pe toate foile, după textul subsolului' }}
          onClose={() => setPropsDlg(false)}
          onSave={(p, markOn) => {
            const clean = docProps({ props: p });
            const rest = sheetProps({ props: clean });
            // Subsolul de tipărire al fiecărei foi, cu clasificarea pusă, schimbată sau scoasă (restul textului rămâne).
            const marked = (sh: Sheet): Sheet => {
              const old = sh.print?.footer ?? '';
              const footer = markLabel({ ...NO_PAGE_SETUP, footer: old }, clean?.label, { footer: markOn, watermark: false }).footer;
              if (footer === old) return sh;
              const print: SheetPrint = { ...sh.print, footer };
              if (!footer) delete print.footer;
              return { ...sh, print };
            };
            setDoc((d) => { const n = { ...d, title: clean?.title ?? '', sheets: d.sheets.map(marked) }; if (rest) n.props = rest; else delete n.props; return n; });
            markDirty();
            setPropsDlg(false);
          }} />
      )}
      {draftDlg && <DraftsDialog kind="sheets" exclude={openDraftIds()} onOpen={openDraft} onClose={() => setDraftDlg(false)} />}
      {verDlg && (
        <VersionsDialog
          path={path}
          current={() => serializeSheetDoc(doc)}
          onRestore={(content, label) => {
            try {
              const old = parseSheetDoc(content);
              setVerDlg(false);
              applySheets({ sheets: old.sheets, active: 0 });
              setStatus(`Ai deschis versiunea din ${label}. Salvează ca s-o păstrezi (Ctrl+Z te întoarce)`);
            } catch (e) { alert((e as Error).message); }
          }}
          onClose={() => { setVerDlg(false); focusGrid(); }}
        />
      )}
      {acDlg && <AutoCorrectDialog onClose={() => { setAcDlg(false); focusGrid(); }} />}
      {optDlg && (
        <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) { setOptDlg(false); focusGrid(); } }}>
          <div className="print-dlg sh-opt-dlg" role="dialog" aria-label="Opțiuni"
            onKeyDown={(e) => { if (e.key === 'Escape' || (e.key === 'Enter' && !(e.target instanceof HTMLSelectElement))) { e.preventDefault(); setOptDlg(false); focusGrid(); } }}>
            <h3>Opțiuni</h3>
            <h4>Editare</h4>
            <label className="print-row">După Enter, cursorul merge:
              <select autoFocus aria-label="Direcția după Enter" value={enterDir} onChange={(e) => pickEnterDir(e.target.value as EnterDir)}>
                {ENTER_DIRS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </label>
            <p className="print-info">Shift+Enter merge în sens invers. Setarea e a aplicației: se păstrează pentru toate tabelele.</p>
            <label className="print-row"><input type="checkbox" aria-label="AutoCorect în celule" checked={shOpts.correct} onChange={() => pickShOpts({ ...shOpts, correct: !shOpts.correct })} /> AutoCorect cât scrii în celule: ș / ț cu virgulă, DOuă MAjuscule, lista de înlocuiri (nu în formule)</label>
            <div className="print-row"><button onClick={() => { setOptDlg(false); setAcDlg(true); }}>Opțiuni AutoCorect…</button></div>
            <label className="print-row"><input type="checkbox" aria-label="Completare automată" checked={shOpts.complete} onChange={() => pickShOpts({ ...shOpts, complete: !shOpts.complete })} /> Completare automată a valorilor din celule (restul unui text deja scris în coloană apare cât scrii)</label>
            <h4>Salvare</h4>
            <label className="print-row"><input type="checkbox" aria-label="Salvare automată" checked={shOpts.autosave} onChange={() => pickShOpts({ ...shOpts, autosave: !shOpts.autosave })} /> Salvare automată: tabelul deja salvat într-un fișier se salvează singur după fiecare schimbare (debifat: doar la Ctrl+S)</label>
            <h4>Afișare (pentru foaia aleasă)</h4>
            <label className="print-row"><input type="checkbox" aria-label="Afișează zero" checked={!sheet.noZero} onChange={() => { const next = { ...sheet }; if (sheet.noZero) delete next.noZero; else next.noZero = true; applySheet(next); }} /> Afișează zero în celulele cu valoare zero (debifat: celula pare goală; se păstrează și în .xlsx)</label>
            <label className="print-row"><input type="checkbox" aria-label="Afișează liniile de grilă" checked={!sheet.noGrid} onChange={toggleGrid} /> Afișează liniile de grilă</label>
            <label className="print-row"><input type="checkbox" aria-label="Afișează titlurile" checked={!sheet.noHead} onChange={toggleHead} /> Afișează literele coloanelor și numerele rândurilor</label>
            <h4>Formule</h4>
            <label className="print-row"><input type="checkbox" aria-label="Calcul automat" checked={!manual} onChange={toggleCalc} /> Calcul automat (debifat: formulele se refac doar la F9)</label>
            <div className="print-actions">
              <button onClick={() => { setOptDlg(false); focusGrid(); }}>OK</button>
            </div>
          </div>
        </div>
      )}
      {csvDlg && (
        <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) { setCsvDlg(null); focusGrid(); } }}>
          <div className="print-dlg" role="dialog" aria-label="Export CSV"
            onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setCsvDlg(null); focusGrid(); } }}>
            <h3>Export CSV</h3>
            <label className="print-row">Separator:
              <select autoFocus value={csvDlg.sep} onChange={(e) => setCsvDlg({ ...csvDlg, sep: e.target.value })}>
                {CSV_SEPS.map(([v, l]) => <option key={l} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="print-row">Codificare:
              <select value={csvDlg.enc} onChange={(e) => setCsvDlg({ ...csvDlg, enc: e.target.value as CsvExportOpts['enc'] })}>
                {CSV_ENCS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            {doc.sheets.length > 1 && (
              <label className="print-row"><input type="checkbox" checked={!!csvDlg.all} onChange={(e) => setCsvDlg({ ...csvDlg, all: e.target.checked })} /> Toate foile (câte un fișier .csv pentru fiecare)</label>
            )}
            <p className="print-info">{csvDlg.all && doc.sheets.length > 1 ? `Se scriu valorile celor ${doc.sheets.length} foi, nu formulele și nici formatarea.` : `Se scriu valorile foii „${sheet.name}”, nu formulele și nici formatarea.`}</p>
            <div className="print-actions">
              <button onClick={() => void doExportCsv(csvDlg)}>Exportă…</button>
              <button onClick={() => { setCsvDlg(null); focusGrid(); }}>Anulare</button>
            </div>
          </div>
        </div>
      )}
      {sizeDlg && (
        <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) { setSizeDlg(null); focusGrid(); } }}>
          <div className="print-dlg" role="dialog" aria-label={sizeDlg.kind === 'col' ? 'Lățime coloană' : 'Înălțime rând'}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setSizeDlg(null); focusGrid(); } else if (e.key === 'Enter') { e.preventDefault(); applySizeDlg(); } }}>
            <h3>{sizeDlg.kind === 'col' ? 'Lățime coloană' : 'Înălțime rând'}</h3>
            <label className="print-row">{sizeDlg.kind === 'col' ? 'Lățime coloană (caractere):' : 'Înălțime rând (puncte):'}
              <input autoFocus value={sizeDlg.value} onChange={(e) => setSizeDlg({ ...sizeDlg, value: e.target.value })} style={{ width: 80 }} />
            </label>
            <div className="print-actions">
              <button onClick={applySizeDlg}>OK</button>
              <button onClick={() => { setSizeDlg(null); focusGrid(); }}>Anulare</button>
            </div>
          </div>
        </div>
      )}
      {fcDlg && (
        <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) { setFcDlg(null); focusGrid(); } }}>
          <div className="print-dlg" role="dialog" aria-label="Foaie de prognoză"
            onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setFcDlg(null); focusGrid(); } }}>
            <h3>Foaie de prognoză</h3>
            <p className="print-info">{`${fcDlg.rows.length} valori în „${fcDlg.names[1]}”. Foaia nouă are istoricul, prognoza, limitele și un grafic.`}</p>
            <div className="print-opts">
              <label>Perioade de prognoză după ultima dată <input type="number" min={1} max={1000} aria-label="Perioade de prognoză" value={fcDlg.k} autoFocus onChange={(e) => setFcDlg({ ...fcDlg, k: e.target.value })} /></label>
              <label>Interval de încredere (%) <input type="number" min={1} max={99.9} step="any" aria-label="Interval de încredere" value={fcDlg.conf} onChange={(e) => setFcDlg({ ...fcDlg, conf: e.target.value })} /></label>
              <label>Sezonul <select aria-label="Sezonul" value={fcDlg.season} onChange={(e) => setFcDlg({ ...fcDlg, season: e.target.value as 'auto' | 'none' | 'manual' })}>
                <option value="auto">Găsit automat</option><option value="manual">Ales de mine</option><option value="none">Fără sezon</option>
              </select></label>
              {fcDlg.season === 'manual' && <label>Lungimea sezonului (perioade) <input type="number" min={2} aria-label="Lungimea sezonului" value={fcDlg.seasonN} onChange={(e) => setFcDlg({ ...fcDlg, seasonN: e.target.value })} /></label>}
              <label>Golurile din date se completează cu <select aria-label="Golurile din date" value={fcDlg.fill} onChange={(e) => setFcDlg({ ...fcDlg, fill: Number(e.target.value) })}>
                <option value={1}>Interpolare (linie dreaptă)</option><option value={0}>Zero</option>
              </select></label>
              <label>Datele care se repetă se combină prin <select aria-label="Datele care se repetă" value={fcDlg.agg} onChange={(e) => setFcDlg({ ...fcDlg, agg: Number(e.target.value) })}>
                {([[1, 'Medie'], [7, 'Sumă'], [2, 'Număr'], [5, 'Mediană'], [4, 'Maxim'], [6, 'Minim']] as [number, string][]).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select></label>
              <label><input type="checkbox" aria-label="Include statisticile prognozei" checked={fcDlg.stats} onChange={(e) => setFcDlg({ ...fcDlg, stats: e.target.checked })} /> Include statisticile prognozei</label>
            </div>
            <div className="print-actions">
              <button className="primary" onClick={() => { const err = makeForecast(fcDlg); if (err) { setStatus('📉 Foaie de prognoză: ' + err); return; } setFcDlg(null); focusGrid(); }}>Creează</button>
              <button onClick={() => { setFcDlg(null); focusGrid(); }}>Renunță</button>
            </div>
          </div>
        </div>
      )}
      {tblDlg && (
        <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) { setTblDlg(null); focusGrid(); } }}>
          <div
            className="print-dlg"
            role="dialog"
            aria-label="Formatează ca tabel"
            onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setTblDlg(null); focusGrid(); } }}
          >
            <h3>Formatează ca tabel</h3>
            <p className="print-info">Pentru {multi ? rangeText(range) : 'tabelul în care e cursorul'}. Poți aplica din nou pe același tabel ca să schimbi culoarea sau părțile.</p>
            <div className="tbl-swatches" role="radiogroup" aria-label="Culoarea tabelului">
              {galleryThemes(doc.tableStyles).map((k) => (
                <button key={k} role="radio" aria-checked={tblDlg.theme === k} className={`tbl-swatch${tblDlg.theme === k ? ' on' : ''}`} title={TABLE_THEMES[k].label}
                  onClick={() => setTblDlg({ ...tblDlg, theme: k })}>
                  <span style={{ background: TABLE_THEMES[k].head || '#ffffff', ...(TABLE_THEMES[k].line ? { borderBottom: `2px solid ${TABLE_THEMES[k].line}` } : {}), ...gridLook(k) }} /><span style={{ background: TABLE_THEMES[k].band || '#ffffff', ...gridLook(k) }} /><span style={{ ...(TABLE_THEMES[k].body ? { background: TABLE_THEMES[k].body } : {}), ...gridLook(k) }} />
                  <small>{TABLE_THEMES[k].label}</small>
                </button>
              ))}
            </div>
            <div className="print-opts">
              {([['head', 'Rândul de cap (primul rând, colorat și aldin)'], ['bandRows', 'Rânduri alternate'], ['bandCols', 'Coloane alternate'], ['firstCol', 'Prima coloană aldină'], ['lastCol', 'Ultima coloană aldină'], ['total', 'Rând de total (sub tabel)'], ['filter', 'Butoanele de filtrare (▾) pe cap']] as [keyof TableOpts, string][]).map(([k, label]) => (
                <label key={k}><input type="checkbox" checked={tblDlg.opts[k]} disabled={k === 'filter' && !tblDlg.opts.head}
                  onChange={(e) => setTblDlg({ ...tblDlg, opts: { ...tblDlg.opts, [k]: e.target.checked } })} /> {label}</label>
              ))}
            </div>
            <div className="print-actions">
              <button className="primary" autoFocus onClick={() => { const t = tblDlg; setTblDlg(null); makeTable(t.theme, t.opts); }}>Aplică</button>
              <button onClick={() => { setTblDlg(null); focusGrid(); }}>Renunță</button>
            </div>
          </div>
        </div>
      )}
      {tsDlg && (
        <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) { setTsDlg(null); focusGrid(); } }}>
          <div className="print-dlg ts-dlg" role="dialog" aria-label="Stil de tabel nou"
            onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setTsDlg(null); focusGrid(); } }}>
            <h3>Stil de tabel nou</h3>
            <p className="print-info">Culorile se aplică tabelului cu cursorul. Debifează o culoare ca partea aceea să rămână fără fundal.</p>
            <label className="ts-name">Nume <input autoFocus value={tsDlg.label} maxLength={60} onChange={(e) => setTsDlg({ ...tsDlg, label: e.target.value })} /></label>
            <div className="ts-grid">
              {([['head', 'Capul tabelului'], ['ink', 'Literele capului'], ['band', 'Rândurile alternate (dungile)'], ['body', 'Celelalte rânduri'], ['total', 'Rândul de total'], ['line', 'Liniile']] as [keyof CustomTableLook, string][]).map(([k, label]) => {
                const v = tsDlg[k] as string | undefined;
                return (
                  <label key={k} className="ts-row">
                    <input type="checkbox" aria-label={`Folosește: ${label}`} checked={!!v} onChange={(e) => setTsDlg({ ...tsDlg, [k]: e.target.checked ? (k === 'ink' ? '#ffffff' : k === 'line' ? '#4472c4' : '#dde7f5') : (k === 'ink' || k === 'body' || k === 'line' ? undefined : '') })} />
                    <span>{label}</span>
                    <input type="color" aria-label={label} value={v || '#ffffff'} disabled={!v} onChange={(e) => setTsDlg({ ...tsDlg, [k]: e.target.value })} />
                  </label>
                );
              })}
              <label className="ts-row"><span />
                <span>Chenar</span>
                <select aria-label="Chenar" value={tsDlg.grid ?? ''} disabled={!tsDlg.line} onChange={(e) => setTsDlg({ ...tsDlg, grid: (e.target.value || undefined) as CustomTableLook['grid'] })}>
                  <option value="">Doar sub cap și deasupra totalului</option>
                  <option value="rows">Contur și o linie sub fiecare rând</option>
                  <option value="all">Linii în jurul fiecărei celule</option>
                </select>
              </label>
            </div>
            <div className="ts-preview" aria-label="Previzualizare">
              {[0, 1, 2, 3, 4].map((r) => (
                <div key={r} className="ts-prow">
                  {[0, 1, 2].map((c) => {
                    const bg = r === 0 ? tsDlg.head : r === 4 ? tsDlg.total : r % 2 === 0 ? tsDlg.band : tsDlg.body;
                    const ln = tsDlg.line;
                    const bd = ln && tsDlg.grid === 'all' ? `1px solid ${ln}` : undefined;
                    const txt = r === 0 ? ['Nume', 'Oraș', 'Sumă'][c] : r === 4 ? ['Total', '', '1.200'][c] : [['Ana', 'Iași', '300'], ['Dan', 'Cluj', '450'], ['Ion', 'Arad', '450']][r - 1][c];
                    return <span key={c} style={{ background: bg || '#ffffff', color: r === 0 && tsDlg.ink ? tsDlg.ink : undefined, fontWeight: r === 0 || r === 4 ? 700 : 400,
                      border: bd, borderBottom: bd ?? (ln && (r === 0 || tsDlg.grid === 'rows') ? `1px solid ${ln}` : undefined), borderTop: bd ?? (ln && r === 4 ? `1px solid ${ln}` : undefined) }}>{txt}</span>;
                  })}
                </div>
              ))}
            </div>
            <div className="print-actions">
              <button className="primary" onClick={() => saveTableStyle(tsDlg)}>Salvează și aplică</button>
              <button onClick={() => { setTsDlg(null); focusGrid(); }}>Renunță</button>
            </div>
          </div>
        </div>
      )}
      {tplDlg && (
        <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) { setTplDlg(false); focusGrid(); } }}>
          <div
            className="print-dlg tpl-dlg"
            role="dialog"
            aria-label="Șabloane"
            onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setTplDlg(false); focusGrid(); } }}
          >
            <h3>Șabloane</h3>
            <p className="print-info">Tabele gata făcute, cu formule, lei și date. Se deschid ca tabel nou.</p>
            <div className="tpl-grid">
              {TEMPLATES.map((t, i) => (
                <button key={t.id} className="tpl-card" onClick={() => fromTemplate(t)} autoFocus={i === 0}>
                  <b>{t.name}</b>
                  <span>{t.desc}</span>
                </button>
              ))}
            </div>
            <div className="print-actions">
              <button onClick={() => { setTplDlg(false); focusGrid(); }}>Închide</button>
            </div>
          </div>
        </div>
      )}
      {pivotSrc && (
        <PivotDialog
          src={pivotSrc}
          heads={Array.from({ length: pivotSrc.c1 - pivotSrc.c0 + 1 }, (_, i) => {
            const c = pivotSrc.c0 + i;
            const id = cellId(pivotSrc.r0, c);
            return { c, label: `${colName(c)}: ${(results[id]?.text ?? cells[id] ?? '').trim() || '(fără nume)'}` };
          })}
          numeric={(c) => {
            for (let r = pivotSrc.r0 + 1; r <= pivotSrc.r1; r++) {
              const id = cellId(r, c);
              if (results[id]?.num || (!results[id] && isNumber(cells[id] ?? ''))) return true;
            }
            return false;
          }}
          dateCol={(c) => ['date', 'datelong', 'datetime'].includes(styles[cellId(pivotSrc.r0 + 1, c)]?.fmt ?? '')}
          distinct={(c) => categories(cells, results, pivotSrc, c).length}
          values={(c) => categories(cells, results, pivotSrc, c).slice(0, 500).map((k) => k.v)}
          chart={pivotChart}
          onMake={makePivot}
          onClose={() => { setPivotSrc(null); focusGrid(); }}
        />
      )}
      {condDlg && (
        <CondDialog
          range={rangeText(range)}
          initOp={typeof condDlg === 'string' ? condDlg : undefined}
          rules={rules ?? []}
          onAdd={addRule}
          onRemove={(i) => { const all = rules ?? []; setRules(all.filter((_, j) => j !== i)); setStatus(`Evidențiere ștearsă: ${describeRule(all[i])} (Ctrl+Z o aduce înapoi)`); }}
          onSet={(next, msg) => { setRules(next); setStatus(msg); }}
          onClose={() => { setCondDlg(false); focusGrid(); }}
        />
      )}
      {namesDlg && (
        <NamesDialog
          names={doc.names ?? []}
          here={`${sheetRef(sheetName)}!${[...new Set(rangeText(range).split(':'))].join(':').replace(/([A-Z]+)(\d+)/g, (_, c, r) => `$${c}$${r}`)}`}
          onChange={(names) => { setDoc((d) => ({ ...d, names })); markDirty(); }}
          onEdit={(i, def) => {
            const old = (doc.names ?? [])[i];
            if (!old) return '';
            const renamed = old.name !== def.name;
            let count = 0;
            const sheets = renamed ? doc.sheets.map((s) => {
              if (old.sheet !== undefined && s.name !== old.sheet) return s;
              let changed = false;
              const cells2 = { ...s.cells };
              for (const [id, v] of Object.entries(s.cells)) {
                if (!v.startsWith('=')) continue;
                const nv = renameNameInFormula(v, old.name, def.name);
                if (nv !== v) { cells2[id] = nv; changed = true; count++; }
              }
              return changed ? { ...s, cells: cells2 } : s;
            }) : doc.sheets;
            remember();
            setDoc((d) => ({ ...d, sheets, names: (d.names ?? []).map((x, j) => (j === i ? { ...x, name: def.name, ref: def.ref } : x)) }));
            markDirty();
            return renamed ? `„${old.name}” se numește acum „${def.name}”${count ? ` (schimbat în ${count} ${count === 1 ? 'formulă' : 'formule'})` : ''}` : `„${def.name}” = ${def.ref}`;
          }}
          selection={multi ? `${cellId(range.r0, range.c0)}:${cellId(range.r1, range.c1)}` : null}
          onFromSelection={(where) => {
            const text = (r: number, c: number) => cellText(cells[cellId(r, c)], results[cellId(r, c)], styles[cellId(r, c)]);
            const { add, skipped } = namesFromRange(range, where, sheetRef(sheetName), text, doc.names ?? []);
            if (add.length) { setDoc((d) => ({ ...d, names: [...(d.names ?? []), ...add] })); markDirty(); }
            return add.length
              ? `Am creat ${add.length} nume: ${add.map((d) => d.name).join(', ')}${skipped.length ? `. Existau deja: ${skipped.join(', ')}` : ''}`
              : skipped.length ? `Numele existau deja: ${skipped.join(', ')}` : `Nu am găsit texte în ${where === 'top' ? 'primul rând' : 'prima coloană'} al selecției`;
          }}
          onClose={() => { setNamesDlg(false); focusGrid(); }}
        />
      )}
      {hint && edit !== null && (
        <div className="fx-hint" style={{ left: hint.x, top: hint.y }} onMouseDown={(e) => e.preventDefault()}>
          {hint.h.call && (() => {
            const { parts, on } = hintArgs(hint.h.call.help, hint.h.call.arg);
            return (
              <div className="fx-hint-call" title={hint.h.call.help?.desc}>
                {hint.h.call.name}({parts.map((p, i) => <span key={i}>{i ? '; ' : ''}{i === on ? <b>{p}</b> : p}</span>)})
                {hint.h.call.help && !hint.h.word && <div className="fx-hint-desc">{hint.h.call.help.desc}</div>}
              </div>
            );
          })()}
          {hint.h.word && (
            <div role="listbox" aria-label="Funcții potrivite">
              {hint.h.word.list.map((fn, i) => (
                <div key={fn.name} role="option" aria-selected={i === hint.pick} className={`fx-hint-row${i === hint.pick ? ' on' : ''}`}
                  onMouseMove={() => { if (i !== hint.pick) setHint((h) => h && { ...h, pick: i, nav: true }); }} onClick={() => acceptHint(fn.name)}>
                  <b>{fn.name}</b>{fn.en && <i>{fn.en}</i>}{fn.help && <span>{fn.help.desc}</span>}
                </div>
              ))}
              <div className="fx-hint-keys">↑ ↓ alegi · Enter sau Tab pune funcția · Esc ascunde</div>
            </div>
          )}
        </div>
      )}
      {signDlg && <OfficeSignDialog name={`${safeFileName(doc.title || (path ? fileName(path).replace(/[.]ssheet$/i, '') : 'Tabel'))}.xlsx`} onSign={(id, tsa) => exportXlsx('xlsx', false, id, tsa)} onClose={() => { setSignDlg(false); focusGrid(); }} />}
      {fxDlg && <FxDialog onPick={insertFn} onClose={() => { setFxDlg(false); if (editRef.current === null) focusGrid(); }} />}
      {splitDlg && (
        <SplitDialog
          lines={Array.from({ length: Math.min(splitDlg.r1 - splitDlg.r0 + 1, 200) }, (_, i) => cells[cellId(splitDlg.r0 + i, splitDlg.c)] ?? '').filter((v) => !v.startsWith('='))}
          where={`${cellId(splitDlg.r0, splitDlg.c)}:${cellId(splitDlg.r1, splitDlg.c)}`}
          onOk={doSplit}
          onClose={() => { setSplitDlg(null); focusGrid(); }}
        />
      )}
      {fmtCellsDlg && (
        <FormatCellsDialog
          start={selStyle}
          tab={fmtCellsDlg}
          where={allRanges.length > 1 ? allRanges.map(rangeText).join(', ') : range.r0 === range.r1 && range.c0 === range.c1 ? selId : rangeText(range)}
          preview={(st) => cellText(cells[selId], results[selId], st)}
          onOk={applyCellsDlg}
          onClose={() => { setFmtCellsDlg(null); focusGrid(); }}
        />
      )}
      {consDlg && (
        <ConsolidateDialog
          start={selId}
          current={(sheetName.includes(' ') ? "'" + sheetName + "'" : sheetName) + '!' + rangeText(range)}
          onOk={doConsolidate}
          onClose={() => { setConsDlg(false); focusGrid(); }}
        />
      )}
      {choiceDlg && (
        <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) { setChoiceDlg(null); focusGrid(); } }}>
          <div className="print-dlg" role="dialog" aria-label="Butoane de opțiune" data-testid="opt-dlg" onKeyDown={(e) => {
            if (e.key === 'Escape') { e.preventDefault(); setChoiceDlg(null); focusGrid(); }
            if (e.key === 'Enter') { e.preventDefault(); applyOpt(false); }
          }}>
            <h3>Butoane de opțiune / listă combo</h3>
            <p className="print-info">În celulă se scrie numărul variantei alese (1 pentru prima, 2 pentru a doua…), ca să-l folosești în formule.</p>
            <label className="print-row"><span className="print-label">Variante</span><input aria-label="Variante" placeholder="Mic; Mediu; Mare  sau  A1:A5" value={choiceDlg.text} onChange={(e) => setChoiceDlg({ ...choiceDlg, text: e.target.value })} autoFocus /></label>
            {optList.length > 0 && <p className="print-info">{optList.length} variante: {optList.slice(0, 6).join(', ')}{optList.length > 6 ? ', …' : ''}</p>}
            <label className="print-row"><input type="radio" name="opt-kind" checked={!choiceDlg.combo} onChange={() => setChoiceDlg({ ...choiceDlg, combo: false })} /> Butoane de opțiune (○ ◉, toate la vedere)</label>
            <label className="print-row"><input type="radio" name="opt-kind" aria-label="Listă combo" checked={choiceDlg.combo} onChange={() => setChoiceDlg({ ...choiceDlg, combo: true })} /> Listă combo (derulantă)</label>
            {optError && choiceDlg.text.trim() && <p className="print-info" style={{ color: '#b91c1c' }}>{optError}</p>}
            <div className="print-actions">
              {choiceDlg.has && <button onClick={() => applyOpt(true)}>Scoate</button>}
              <button onClick={() => { setChoiceDlg(null); focusGrid(); }}>Renunță</button>
              <button className="primary" data-testid="opt-ok" disabled={!!optError} onClick={() => applyOpt(false)}>Pune</button>
            </div>
          </div>
        </div>
      )}
      {btnDlg && (
        <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) { setBtnDlg(null); focusGrid(); } }}>
          <div className="print-dlg" role="dialog" aria-label="Buton macro" data-testid="btn-dlg" onKeyDown={(e) => {
            if (e.key === 'Escape') { e.preventDefault(); setBtnDlg(null); focusGrid(); }
            if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'SELECT') { e.preventDefault(); applyBtn(false); }
          }}>
            <h3>Buton cu macrocomandă</h3>
            {allMacros.length ? (
              <>
                <p className="print-info">Clic pe buton rulează macrocomanda, de la celula aleasă atunci (cele cu referințe relative), ca Vizualizare → Macrocomenzi → ▶ Rulează.</p>
                <label className="print-row"><span className="print-label">Macrocomanda</span>
                  <select aria-label="Macrocomanda" data-testid="btn-macro" value={btnDlg.macro} onChange={(e) => setBtnDlg({ ...btnDlg, macro: e.target.value })} autoFocus>
                    {!allMacros.some((m) => m.name === btnDlg.macro) && btnDlg.macro && <option value={btnDlg.macro}>{btnDlg.macro} (nu mai există)</option>}
                    {allMacros.map((m, i) => <option key={i} value={m.name}>{m.name}</option>)}
                  </select>
                </label>
                <label className="print-row"><span className="print-label">Text pe buton</span><input aria-label="Text pe buton" data-testid="btn-label" maxLength={60} placeholder="(textul celulei sau numele macrocomenzii)" value={btnDlg.label} onChange={(e) => setBtnDlg({ ...btnDlg, label: e.target.value })} /></label>
              </>
            ) : (
              <p className="print-info">Nu ai încă macrocomenzi. Înregistrează una din Vizualizare → Macrocomenzi → ⏺ Înregistrează, apoi pune butonul.</p>
            )}
            <div className="print-actions">
              {btnDlg.has && <button onClick={() => applyBtn(true)}>Scoate</button>}
              <button onClick={() => { setBtnDlg(null); focusGrid(); }}>Renunță</button>
              <button className="primary" data-testid="btn-ok" disabled={!btnDlg.macro.trim()} onClick={() => applyBtn(false)}>Pune</button>
            </div>
          </div>
        </div>
      )}
      {spinDlg && (
        <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) { setSpinDlg(null); focusGrid(); } }}>
          <div className="print-dlg" role="dialog" aria-label="Buton rotativ" data-testid="spin-dlg" onKeyDown={(e) => {
            if (e.key === 'Escape') { e.preventDefault(); setSpinDlg(null); focusGrid(); }
            if (e.key === 'Enter') { e.preventDefault(); applySpin(false); }
          }}>
            <h3>Buton rotativ</h3>
            <p className="print-info">Numărul din celulele alese crește sau scade cu pasul ales, fără să-l scrii de mână; formulele care îl folosesc se schimbă pe loc.</p>
            <label className="print-row"><span className="print-label">Minim</span><input aria-label="Minim" value={spinDlg.min} onChange={(e) => setSpinDlg({ ...spinDlg, min: e.target.value })} autoFocus /></label>
            <label className="print-row"><span className="print-label">Maxim</span><input aria-label="Maxim" value={spinDlg.max} onChange={(e) => setSpinDlg({ ...spinDlg, max: e.target.value })} /></label>
            <label className="print-row"><span className="print-label">Pas</span><input aria-label="Pas" value={spinDlg.step} onChange={(e) => setSpinDlg({ ...spinDlg, step: e.target.value })} /></label>
            <label className="print-row"><input type="radio" name="spin-kind" checked={!spinDlg.bar} onChange={() => setSpinDlg({ ...spinDlg, bar: false })} /> Săgeți ▲ ▼ (buton rotativ)</label>
            <label className="print-row"><input type="radio" name="spin-kind" aria-label="Bară de defilare" checked={spinDlg.bar} onChange={() => setSpinDlg({ ...spinDlg, bar: true })} /> Bară de defilare (trasă cu mouse-ul)</label>
            {spinError && <p className="print-info" style={{ color: '#b91c1c' }}>{spinError}</p>}
            <div className="print-actions">
              {spinDlg.has && <button onClick={() => applySpin(true)}>Scoate</button>}
              <button onClick={() => { setSpinDlg(null); focusGrid(); }}>Renunță</button>
              <button className="primary" data-testid="spin-ok" disabled={!!spinError} onClick={() => applySpin(false)}>Pune</button>
            </div>
          </div>
        </div>
      )}
      {webDlg && (
        <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !webDlg.busy) { setWebDlg(null); focusGrid(); } }}>
          <div className="print-dlg" role="dialog" aria-label="Din web" data-testid="web-dlg" onKeyDown={(e) => {
            if (e.key === 'Escape' && !webDlg.busy) { e.preventDefault(); setWebDlg(null); focusGrid(); }
            if (e.key === 'Enter') { e.preventDefault(); void fetchWeb(); }
          }}>
            <h3>Din web</h3>
            <p className="print-info">Scrie adresa unei pagini cu tabele (de exemplu un curs valutar, o listă de prețuri sau un clasament). Pagina e doar citită: nu se trimite nimic și nu rulează nimic din ea.</p>
            <label className="print-row"><span className="print-label">Adresă</span><input aria-label="Adresă" data-testid="web-url" style={{ width: 320 }} placeholder="https://..." value={webDlg.url} disabled={webDlg.busy} onChange={(e) => setWebDlg({ ...webDlg, url: e.target.value, err: '' })} autoFocus /></label>
            {webDlg.busy && <p className="print-info">Se aduce pagina…</p>}
            {webDlg.err && <p className="print-info" data-testid="web-err" style={{ color: '#b91c1c' }}>{webDlg.err}</p>}
            <div className="print-actions">
              <button disabled={webDlg.busy} onClick={() => { setWebDlg(null); focusGrid(); }}>Renunță</button>
              <button className="primary" data-testid="web-ok" disabled={webDlg.busy} onClick={() => void fetchWeb()}>Adu tabelele</button>
            </div>
          </div>
        </div>
      )}
      {queryDlg && (
        <QueryDialog source={queryDlg.file ? queryDlg.file + (queryDlg.fsheet ? ` → ${queryDlg.fsheet}` : '') : queryDlg.at !== undefined ? doc.sheets[queryDlg.at].query!.src : sheetName} table={queryDlg.data}
          initial={queryDlg.at !== undefined ? doc.sheets[queryDlg.at].query!.steps : undefined} sources={querySources} other={queryOtherFn}
          onLoad={loadQuery} onClose={() => { setQueryDlg(null); focusGrid(); }}
          fileSheets={queryDlg.names} fileSheet={queryDlg.fsheet} onFileSheet={queryFileSheet} />
      )}
      {dedupe && (
        <DedupeDialog
          g={dedupe.g}
          head={dedupe.head}
          label={(c) => (cells[cellId(dedupe.g.r0, c)] ? results[cellId(dedupe.g.r0, c)]?.text ?? cells[cellId(dedupe.g.r0, c)] : '')}
          onOk={doDedupe}
          onClose={() => { setDedupe(null); focusGrid(); }}
        />
      )}
      {gsDlg && <GotoSpecialDialog onGo={runGotoSpecial} onClose={() => { setGsDlg(false); focusGrid(); }} />}
      {psDlg && <PasteSpecialDialog onPaste={doPasteSpecial} onClose={() => { setPsDlg(false); focusGrid(); }} />}
      {linkDlg && (
        <LinkDialog
          cell={selId}
          current={styles[selId]?.link ?? ''}
          text={cells[selId]?.startsWith('=') ? '' : cells[selId] ?? ''}
          onSave={saveLink}
          onClose={() => { setLinkDlg(false); focusGrid(); }}
        />
      )}
      {cmtDlg && (
        <CommentDialog
          key={selId}
          cell={selId}
          thread={styles[selId]?.cmt ?? []}
          done={!!styles[selId]?.cdone}
          onSave={saveComment}
          onClose={() => { setCmtDlg(false); focusGrid(); }}
        />
      )}
      {noteDlg && (
        <NoteDialog
          cell={selId}
          current={styles[selId]?.note ?? ''}
          onSave={saveNote}
          onClose={() => { setNoteDlg(false); focusGrid(); }}
        />
      )}
      {listDlg && (
        <ListDialog
          range={rangeText(range)}
          current={selList}
          onSave={saveList}
          onClose={() => { setListDlg(false); focusGrid(); }}
        />
      )}
      {selPrompt && promptPos && !pick && (
        <div className="val-prompt" role="tooltip" style={{ left: promptPos.x, top: promptPos.y }}>
          {selPrompt.title && <b>{selPrompt.title}</b>}
          <span>{selPrompt.text}</span>
        </div>
      )}
      {pick && (pick.vals || listAt(lists, pick.r, pick.c)) && (
        <ListPick
          x={pick.x}
          y={pick.y}
          values={pick.vals ?? listAt(lists, pick.r, pick.c)!.values}
          current={cells[cellId(pick.r, pick.c)] ?? ''}
          onChoose={choose}
          onClose={() => { setPick(null); focusGrid(); }}
        />
      )}
      {headMenu && (
        <HeadMenu
          x={headMenu.x}
          y={headMenu.y}
          axis={headMenu.axis}
          a={headMenu.axis === 'r' ? range.r0 : range.c0}
          b={headMenu.axis === 'r' ? range.r1 : range.c1}
          onAction={insertOrDelete}
          hiddenIn={headMenu.axis === 'r' ? (sheet.hideRows ?? []).some((k) => k - 1 >= range.r0 && k - 1 <= range.r1) : (sheet.hideCols ?? []).some((k) => k - 1 >= range.c0 && k - 1 <= range.c1)}
          onHide={(hide) => (headMenu.axis === 'r' ? hideRowsIn(range.r0, range.r1, hide) : hideColsIn(range.c0, range.c1, hide))}
          grouped={Object.keys((headMenu.axis === 'r' ? sheet.rowLvl : sheet.colLvl) ?? {}).some((k) => { const i = Number(k) - 1; return headMenu.axis === 'r' ? i >= range.r0 && i <= range.r1 : i >= range.c0 && i <= range.c1; })}
          onGroup={(by) => groupIn(headMenu.axis, by)}
          onClip={(cmd) => { setHeadMenu(null); focusGrid(); clipCmd(cmd); }}
          onClear={() => { setHeadMenu(null); finishEdit(); clearRange(); focusGrid(); }}
          onFormat={() => { setHeadMenu(null); finishEdit(); setFmtCellsDlg('num'); }}
          onSize={() => { setHeadMenu(null); openSizeDlg(headMenu.axis === 'r' ? 'row' : 'col'); }}
          onClose={() => { setHeadMenu(null); focusGrid(); }}
        />
      )}
      {relDlg && (
        <RelationsDialog tables={relTables} headOf={(n) => relOther(n)?.head} problem={(r, rs) => relProblem(r, relOther, rs)} detect={() => detectRels(relTables, relOther, doc.rels ?? [])}
          rels={doc.rels ?? []} onChange={setRels} onModel={loadModel} onClose={() => { setRelDlg(false); focusGrid(); }} />
      )}
      {macroDlg === 'rec' && <MacroRecordDialog list={[...(doc.macros ?? []), ...myMacros]} at={selId} onStart={startRec} onClose={() => { setMacroDlg(null); focusGrid(); }} />}
      {macroDlg === 'list' && <MacroListDialog list={doc.macros ?? []} mine={myMacros} at={selId} onRun={playMacro}
        onChange={(l, mine) => { if (JSON.stringify(l) !== JSON.stringify(doc.macros ?? [])) setMacros(l); if (JSON.stringify(mine) !== JSON.stringify(myMacros)) saveMine(mine); }} onClose={() => { setMacroDlg(null); focusGrid(); }} />}
      {linksDlg && (
        <LinksDialog
          rows={(doc.links ?? []).map((l) => ({ link: l, uses: linkUses(l.name), msg: linkMsg[l.name] }))}
          busy={linkBusy}
          onUpdate={(i) => runLink(() => updateLink(i))}
          onUpdateAll={updateAllLinks}
          onChange={changeLink}
          onOpen={openLinkSource}
          onBreak={breakLink}
          onClose={() => { setLinksDlg(false); focusGrid(); }}
        />
      )}
      {listsDlg && (
        <ListsDialog
          onSave={(l) => {
            setCustomLists(l);
            try { localStorage.setItem(LISTS_KEY, JSON.stringify(customLists())); } catch { /* fără setări: listele țin până la închidere */ }
            setListsDlg(false);
            setStatus(customLists().length ? `Am păstrat ${customLists().length} ${customLists().length === 1 ? 'listă proprie' : 'liste proprii'}: scrie o valoare din listă și trage de colțul celulei` : 'Nu mai ai liste proprii');
            focusGrid();
          }}
          onClose={() => { setListsDlg(false); focusGrid(); }}
        />
      )}
      {seriesDlg && (
        <SeriesDialog
          down={multi ? range.r1 - range.r0 >= range.c1 - range.c0 : true}
          date={styles[selId]?.fmt === 'date' || styles[selId]?.fmt === 'datelong'}
          zone={multi ? `${cellId(range.r0, range.c0)}:${cellId(range.r1, range.c1)}` : null}
          onRun={runSeries}
          onClose={() => { setSeriesDlg(false); focusGrid(); }}
        />
      )}
      {cellsDlg && (
        <CellsDialog
          del={cellsDlg.del}
          zone={`${cellId(range.r0, range.c0)}${multi ? ':' + cellId(range.r1, range.c1) : ''}`}
          wide={range.c1 - range.c0 >= range.r1 - range.r0}
          onRun={insertCells}
          onClose={() => { setCellsDlg(null); focusGrid(); }}
        />
      )}
      {subDlg && (
        <SubtotalDialog
          g={subDlg.g}
          col={subDlg.col}
          has={subtotalRows(sheet, subDlg.g).length > 0}
          label={(c) => {
            const id = cellId(subDlg.g.r0, c);
            const t = cellText(cells[id], results[id], styles[id]).trim();
            return `Coloana ${colName(c)}${t ? ` (${t.length > 24 ? t.slice(0, 24) + '…' : t})` : ''}`;
          }}
          numeric={(c) => { for (let r = subDlg.g.r0 + 1; r <= Math.min(subDlg.g.r1, subDlg.g.r0 + 50); r++) { const x = results[cellId(r, c)]; if (x?.num || isNumber(cells[cellId(r, c)] ?? '')) return true; } return false; }}
          onRun={(o) => runSubtotal(subDlg.g, o)}
          onClose={() => { setSubDlg(null); focusGrid(); }}
        />
      )}
      {advDlg && (
        <AdvFilterDialog list={advDlg.list} onRun={runAdvFilter} onClear={clearAdvFilter} onClose={() => { setAdvDlg(null); focusGrid(); }} />
      )}
      {shDlg && (() => {
        const d = shDlg.sh;
        const set = (patch: Partial<ShapeBox>) => setShDlg({ ...shDlg, sh: { ...d, ...patch } });
        const done = () => { const x = shDlg; setShDlg(null); void putShape(x.sh, x.id); };
        return (
          <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShDlg(null); }}>
            <div className="print-dlg sh-dlg" role="dialog" aria-label="Formă" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setShDlg(null); } }}>
              <h3>{shDlg.id ? 'Schimbă forma' : d.k === 'rect' && d.al === 'l' ? 'Casetă de text' : 'Formă'}</h3>
              <div className="sh-grid">
                {SHAPES.map((s) => (
                  <button key={s.k} data-shape={s.k} className={d.k === s.k ? 'on' : ''} title={s.name} onClick={() => set({ k: s.k, ...(s.k === 'line' ? { fill: '', sw: Math.max(2, d.sw) } : {}) })}>{s.icon}</button>
                ))}
              </div>
              <div className="sh-row">
                <label>Umplere <input type="color" aria-label="Umplerea formei" value={d.fill || '#ffffff'} disabled={!d.fill} onChange={(e) => set({ fill: e.target.value })} /></label>
                <label><input type="checkbox" aria-label="Fără umplere" checked={!d.fill} onChange={(e) => set({ fill: e.target.checked ? '' : '#ffffff' })} /> fără</label>
                <label>Contur <input type="color" aria-label="Conturul formei" value={d.stroke || '#000000'} disabled={!d.stroke} onChange={(e) => set({ stroke: e.target.value })} /></label>
                <label><input type="checkbox" aria-label="Fără contur" checked={!d.stroke} onChange={(e) => set({ stroke: e.target.checked ? '' : '#000000' })} /> fără</label>
                <select aria-label="Grosimea conturului" value={d.sw} disabled={!d.stroke} onChange={(e) => set({ sw: Number(e.target.value) })}>
                  {[1, 2, 3, 4, 6, 8].map((n) => <option key={n} value={n}>{n} px</option>)}
                </select>
              </div>
              <textarea autoFocus aria-label="Textul din formă" rows={4} value={d.text} maxLength={TEXT_MAX} placeholder="Textul din formă (poate rămâne gol; Ctrl+Enter pune forma)"
                onChange={(e) => set({ text: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); done(); } }} />
              <div className="sh-row">
                <label>Text <input type="color" aria-label="Culoarea textului" value={d.tc} onChange={(e) => set({ tc: e.target.value })} /></label>
                <select aria-label="Mărimea textului" value={d.fs} onChange={(e) => set({ fs: Number(e.target.value) })}>
                  {[9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <button className={d.b ? 'on' : ''} aria-pressed={!!d.b} title="Aldin" onClick={() => set({ b: !d.b })}><b>B</b></button>
                {(['l', 'c', 'r'] as const).map((a) => (
                  <button key={a} className={(d.al ?? 'c') === a ? 'on' : ''} aria-pressed={(d.al ?? 'c') === a} data-al={a}
                    title={a === 'l' ? 'Aliniat la stânga' : a === 'c' ? 'Centrat' : 'Aliniat la dreapta'} onClick={() => set({ al: a })}>{a === 'l' ? '⫷' : a === 'c' ? '≡' : '⫸'}</button>
                ))}
              </div>
              <div className="print-actions">
                <button onClick={() => setShDlg(null)}>Renunță</button>
                <button className="primary" onClick={done}>{shDlg.id ? 'Schimbă' : 'Pune pe foaie'}</button>
              </div>
            </div>
          </div>
        );
      })()}
      {dgDlg && <DiagramDialog diagram={dgDlg.d} onClose={() => setDgDlg(null)} onDone={(d) => { const x = dgDlg; setDgDlg(null); void putDiagram(d, x.id); }} />}
      {eqDlg && <EquationDialog equation={{ src: eqDlg.src }} onClose={() => setEqDlg(null)} onDone={(e) => { const x = eqDlg; setEqDlg(null); void putEquation(e.src, x.id); }} />}
      {waDlg && (
        <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setWaDlg(null); }}>
          <div className="print-dlg wa-dlg" role="dialog" aria-label="Text artistic" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setWaDlg(null); } }}>
            <h3>{waDlg.id ? 'Schimbă textul artistic' : 'Text artistic'}</h3>
            <input autoFocus aria-label="Textul artistic" value={waDlg.text} maxLength={WORDART_MAX} placeholder="Scrie titlul…"
              onChange={(e) => setWaDlg({ ...waDlg, text: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const d = waDlg; setWaDlg(null); putWordArt({ text: d.text, s: d.s }, d.id); } }} />
            <div className="wa-styles">
              {WORDART_STYLES.map((st) => (
                <button key={st.id} data-wa={st.id} className={waDlg.s === st.id ? 'on' : ''} onClick={() => setWaDlg({ ...waDlg, s: st.id })} title={st.name}>
                  {waDlg.text.trim() ? <img src={renderWordArt({ text: waDlg.text.slice(0, 24), s: st.id }).src} alt={st.name} /> : st.name}
                </button>
              ))}
            </div>
            <div className="print-actions">
              <button onClick={() => setWaDlg(null)}>Renunță</button>
              <button className="primary" disabled={!waDlg.text.trim()} onClick={() => { const d = waDlg; setWaDlg(null); putWordArt({ text: d.text, s: d.s }, d.id); }}>{waDlg.id ? 'Schimbă' : 'Pune pe foaie'}</button>
            </div>
          </div>
        </div>
      )}
      {qa && (
        <>
          <div className="qa-back" onMouseDown={() => { setQa(null); quickEnd(); }} />
          <div className="qa-pop" role="dialog" aria-label="Analiză rapidă" style={{ left: qa.x, top: qa.y }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); setQa(null); quickEnd(); focusGrid(); }
              else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const i = QUICK_TABS.findIndex(([t]) => t === qa.tab), n = QUICK_TABS.length;
                setQa({ ...qa, tab: QUICK_TABS[(i + (e.key === 'ArrowRight' ? 1 : n - 1)) % n][0] });
              }
            }}>
            <div className="qa-tabs" role="tablist">
              {QUICK_TABS.map(([t, n]) => (
                <button key={t} role="tab" aria-selected={qa.tab === t} className={qa.tab === t ? 'on' : ''} onClick={() => { quickEnd(); setQa({ ...qa, tab: t }); }}>{n}</button>
              ))}
            </div>
            <div className="qa-items" role="tabpanel">
              {QUICK_ITEMS[qa.tab].map((it, i) => (
                <button key={it.key} data-qa={`${qa.tab}:${it.key}`} title={it.title} autoFocus={i === 0} onClick={() => quickDo(qa.tab, it.key)}
                  onMouseEnter={() => quickPreview(qa.tab, it.key)} onMouseLeave={() => quickPreview(qa.tab, null)}>
                  <span className="qa-ic">{it.icon}</span>{it.name}
                </button>
              ))}
            </div>
            <div className="qa-hint">Săgețile ← → schimbă fila · Esc închide · Ctrl+Z anulează</div>
          </div>
          {qaChart && (
            <div className="qa-chart" aria-hidden="true" dangerouslySetInnerHTML={{ __html: qaChart }}
              style={{ left: qa.x + 388 + 312 <= window.innerWidth ? qa.x + 388 : Math.max(8, qa.x - 320), top: qa.y }} />
          )}
        </>
      )}
      {recDlg && (
        <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) { setRecDlg(null); focusGrid(); } }}>
          <div className="print-dlg sh-rec-dlg" role="dialog" aria-label="Grafice recomandate" onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); setRecDlg(null); focusGrid(); } }}>
            <h3>Grafice recomandate</h3>
            <p className="print-info">Pentru datele din {recDlg.range}, de la cel mai potrivit. Clic pe un grafic ca să-l pui (felul se poate schimba și după).</p>
            <div className="sh-rec-grid">
              {recDlg.types.map((t, i) => (
                <button key={t} className="sh-rec-card" autoFocus={i === 0} onClick={() => { setRecDlg(null); addChart(t); }} title={SHEET_CHART_TYPES.find(([k]) => k === t)?.[1]}>
                  <span className="sh-rec-svg" dangerouslySetInnerHTML={{ __html: recDlg.svgs[i] }} />
                  <span>{SHEET_CHART_TYPES.find(([k]) => k === t)?.[1] ?? t}</span>
                </button>
              ))}
            </div>
            <div className="print-actions"><button onClick={() => { setRecDlg(null); focusGrid(); }}>Închide</button></div>
          </div>
        </div>
      )}
      {a11y && (
        <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) { setA11y(null); focusGrid(); } }}>
          <div className="print-dlg sl-a11y-dlg" role="dialog" aria-label="Verifică accesibilitatea" onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); setA11y(null); focusGrid(); } }}>
            <h3>Verifică accesibilitatea</h3>
            <p className="print-info">{a11y.length ? `Am găsit ${a11y.length} ${a11y.length === 1 ? 'lucru' : 'lucruri'} de îmbunătățit, ca tabelul să poată fi citit și cu un cititor de ecran sau de cine vede mai greu. Clic pe unul te duce la el.` : 'Nu am găsit nimic de îmbunătățit: textul se citește bine, foile au nume potrivite, graficele au titlu și nu sunt celule îmbinate.'}</p>
            {a11y.length > 0 && (
              <ul className="sl-a11y-list">
                {a11y.map((it, i) => (
                  <li key={i}>
                    <button onClick={() => goIssue(it)} autoFocus={i === 0}>
                      <b>{doc.sheets[it.sheet]?.name}{it.cell ? ` · ${it.cell}` : ''}</b> {it.text}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="print-actions">
              <button onClick={runA11y}>Verifică din nou</button>
              <button onClick={() => { setA11y(null); focusGrid(); }} autoFocus={!a11y.length}>Închide</button>
            </div>
          </div>
        </div>
      )}
      {changesOpen && (
        <ChangesPane log={doc.changes} sheet={sheetName} range={range} rangeText={rangeText(range)}
          onGo={(name, id) => {
            const i = doc.sheets.findIndex((x) => x.name.toLocaleLowerCase('ro-RO') === name.toLocaleLowerCase('ro-RO'));
            const pos = parseCellId(id);
            if (i < 0 || !pos) { setStatus(`Foaia „${name}” nu mai există`); return; }
            setChangesOpen(false);
            if (i !== active) switchSheet(i);
            selectRange({ r: pos.r, c: pos.c });
            focusGrid();
          }}
          onClear={() => { setDoc((d) => ({ ...d, changes: undefined })); markDirty(); }}
          onClose={() => { setChangesOpen(false); focusGrid(); }} />
      )}
      {gramOpen && (() => {
        // Litera mică la începutul celulei nu e greșeală într-un tabel („total”, „buc.”); se verifică doar după punct, în celulă.
        const locked = (id: string) => !!sheet.protect && !styles[id]?.unlock;
        const list = spellCells(cells, undefined, hidden).flatMap((it) => checkGrammar(it.text)
          .filter((x) => !(x.kind === 'capital' && !it.text.slice(0, x.from).trim()) && !gramIgnored.includes(x.text))
          .map((x) => ({ ...x, id: it.id, r: it.r, c: it.c, src: it.text, fix: locked(it.id) ? undefined : x.fix })));
        const fixOne = (x: (typeof list)[number]) => { if (x.fix !== undefined) applyCells(spellPatch(cells, { [x.id]: x.src.slice(0, x.from) + x.fix + x.src.slice(x.to) })); };
        const fixAll = () => {
          const patch: Record<string, string> = {};
          for (const x of [...list].reverse()) if (x.fix !== undefined) { const t = patch[x.id] ?? x.src; patch[x.id] = t.slice(0, x.from) + x.fix + t.slice(x.to); }
          if (Object.keys(patch).length) { applyCells(spellPatch(cells, patch)); setStatus('Greșelile s-au corectat (Ctrl+Z le readuce).'); }
        };
        const close = () => { setGramOpen(false); focusGrid(); };
        return (
          <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
            <div className="print-dlg sl-a11y-dlg sl-grammar-dlg" role="dialog" aria-label="Gramatică" onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); close(); } }}>
              <h3>✓ Gramatică</h3>
              <p className="print-info">{list.length ? `Am găsit ${list.length} ${list.length === 1 ? 'greșeală' : 'greșeli'} în foaie. Clic pe una te duce la celula ei.` : 'Nu am găsit greșeli în foaie.'}</p>
              {list.length > 0 && (
                <ul className="sl-a11y-list">
                  {list.map((x) => (
                    <li key={x.id + ':' + x.from}>
                      <button onClick={() => selectRange({ r: x.r, c: x.c })}>
                        <b>{x.id}</b> „{x.text.trim() || x.text}”: {x.msg}
                      </button>
                      <span className="sl-grammar-acts">
                        {x.fix !== undefined && <button onClick={() => fixOne(x)}>✓ {x.fix.trim() ? x.fix : 'Corectează'}</button>}
                        <button onClick={() => setGramIgnored([...gramIgnored, x.text])} title="Nu mai arăta această greșeală în tabel">Ignoră</button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="print-actions">
                {list.some((x) => x.fix !== undefined) && <button onClick={fixAll} title="Pune forma corectă peste tot (Ctrl+Z le readuce)">✓ Corectează tot</button>}
                <button onClick={close} autoFocus={!list.length}>Închide</button>
              </div>
            </div>
          </div>
        );
      })()}
      {spellOpen && (
        <SpellDialog items={spellCells(cells, sel, hidden)} where={(it) => `celula ${it.id}`}
          locked={(id) => !!sheet.protect && !styles[id]?.unlock}
          onGo={(it) => selectRange({ r: it.r, c: it.c })}
          onApply={(patch) => applyCells(spellPatch(cells, patch))}
          onClose={(msg) => { setSpellOpen(false); if (msg) setStatus(msg); focusGrid(); }} />
      )}
      {scDlg && (
        <ScenarioDialog list={sheet.scenarios ?? []} cellsHint={multi ? rangeText(range) : selId} current={(id) => cells[id] ?? ''}
          onSave={saveScenarios} onShow={showScenario} onReport={scenarioReport} onClose={() => { setScDlg(false); focusGrid(); }} />
      )}
      {dtDlg && (
        <DataTableDialog zone={`${cellId(dtDlg.r0, dtDlg.c0)}:${cellId(dtDlg.r1, dtDlg.c1)}`} onRun={runDataTable} onClose={() => { setDtDlg(null); focusGrid(); }} />
      )}
      {randDlg && <RandomDialog onRun={runRandom} onClose={() => { setRandDlg(false); focusGrid(); }} />}
      {solverDlg && (
        <SolverDialog
          initial={solverModels.current[sheetName] ?? sheet.solver ?? { obj: cells[selId]?.trim().startsWith('=') ? selId : '', goal: 'max', target: '', vars: '', cons: [], nonneg: true }}
          run={runSolver}
          onKeep={(m, run, report) => {
            solverModels.current[sheetName] = m; setSolverDlg(false);
            const cur = { ...sheet, cells: { ...sheet.cells, ...run.patch }, solver: m };
            if (report) {
              const bold: [number, number][] = [[0, 0]];
              run.report.forEach((row, r) => { if (row[1] === 'Celula') row.forEach((_, c) => bold.push([r, c])); });
              const name = addResultSheet('Raport Rezolvitor', run.report, bold, { A: 170, B: 90, C: 120, D: 160, E: 150, F: 120, G: 120 }, {}, cur);
              setStatus(`🧮 Rezolvitor: ${run.msg} Raportul e în foaia „${name}”.`);
            } else { applySheet(cur); setStatus('🧮 Rezolvitor: ' + run.msg); }
            focusGrid();
          }}
          onClose={(m) => { solverModels.current[sheetName] = m; setSolverDlg(false); focusGrid(); }}
        />
      )}
      {goalDlg && (
        <GoalSeekDialog
          setCell={cells[selId]?.trim().startsWith('=') ? selId : ''}
          check={checkGoal}
          seek={runGoalSeek}
          onKeep={(id, v) => { setGoalDlg(false); applyCells({ [id]: v }); setStatus(`Căutare rezultat: ${id} = ${v}`); focusGrid(); }}
          onClose={() => { setGoalDlg(false); focusGrid(); }}
        />
      )}
      {sortDlg && (
        <SortDialog
          g={sortDlg.g}
          head={sortDlg.head}
          col={sortDlg.col}
          label={(c, head) => {
            const t = head ? cellText(cells[cellId(sortDlg.g.r0, c)], results[cellId(sortDlg.g.r0, c)], styles[cellId(sortDlg.g.r0, c)]).trim() : '';
            return `Coloana ${colName(c)}${t ? ` (${t.length > 24 ? t.slice(0, 24) + '…' : t})` : ''}`;
          }}
          colors={(c, kind, head) => {
            const seen = new Set<string>();
            for (let r = sortDlg.g.r0 + (head ? 1 : 0); r <= sortDlg.g.r1; r++) seen.add(colorOf(styles[cellId(r, c)], kind));
            return [...seen].sort((a, b) => (a === 'none' ? 1 : b === 'none' ? -1 : 0));
          }}
          onSort={(head, levels) => sortBy(sortDlg.g, head, levels)}
          onClose={() => { setSortDlg(null); focusGrid(); }}
        />
      )}
      {tabMenu && (
        <TabMenu
          x={tabMenu.x}
          y={tabMenu.y}
          first={tabMenu.i === 0}
          last={tabMenu.i === doc.sheets.length - 1}
          only={doc.sheets.length === 1}
          lastVisible={visibleCount <= 1}
          color={doc.sheets[tabMenu.i]?.tab}
          hidden={doc.sheets.map((s, i) => [s, i] as const).filter(([s]) => s.hidden).map(([s, i]) => ({ i, name: s.name }))}
          onColor={(c) => colorTab(tabMenu.i, c)}
          onHide={() => hideTab(tabMenu.i)}
          onUnhide={unhideTab}
          onRename={() => { setRenaming(tabMenu.i); setTabMenu(null); }}
          onInsert={() => { setTabMenu(null); newTab(); }}
          names={doc.sheets.map((x) => x.name)}
          index={tabMenu.i}
          onPlace={(before, copy) => {
            if (copy && doc.sheets.length >= MAX_SHEETS) { setStatus(`Un tabel poate avea cel mult ${MAX_SHEETS} de foi`); return; }
            const name = doc.sheets[tabMenu.i].name;
            applySheets(placeSheet(doc.sheets, tabMenu.i, before, copy));
            setStatus(copy ? `Foaia „${name}” a fost copiată` : `Foaia „${name}” a fost mutată`);
          }}
          protectedSheet={!!sheet.protect}
          onProtect={() => { setTabMenu(null); void protection(sheet.protect ? 'off' : 'on'); }}
          onDelete={() => deleteTab(tabMenu.i)}
          onClose={() => { setTabMenu(null); focusGrid(); }}
        />
      )}
      {printDlg && (
        <PrintDialog
          set={printSet}
          used={printRange(cells, undefined)}
          selection={multi ? range : null}
          widths={(g) => printWidths(g, colW)}
          tall={printTall}
          area={printRange(cells, sheet.print, sheet.pics)}
          hasCharts={charts.length > 0}
          onChange={setPrint}
          onPrint={startPrint}
          onClose={() => { setPrintDlg(false); focusGrid(); }}
          what={printWhat}
          onWhat={setPrintWhat}
          selText={rangeText(range)}
          groupCount={group.length > 1 ? group.length : 0}
          sheetCount={doc.sheets.filter((x) => !x.hidden).length}
        />
      )}
      {evalWin && (
        <div className="watch-win eval-win" role="dialog" aria-label="Evaluează formula">
          <div className="watch-head">
            <b>🔍 Evaluează formula din {evalWin.id}</b>
            <button onClick={doEvaluate} title="Calculează din nou, pentru celula aleasă acum">↻ Celula aleasă</button>
            <button onClick={() => setEvalWin(null)} aria-label="Închide evaluarea">✕</button>
          </div>
          <ol className="eval-steps">
            {evalWin.steps.map((s, i) => (
              <li key={i} className={i === evalWin.steps.length - 1 && i > 0 ? 'eval-final' : ''}>{i === evalWin.steps.length - 1 && i > 0 ? 'Rezultat: ' : ''}<code>{s}</code></li>
            ))}
          </ol>
        </div>
      )}
      {errRep && (
        <div className="watch-win err-win" role="dialog" aria-label="Verificarea erorilor">
          <div className="watch-head">
            <b>⚠ Erori pe foaia „{sheetName}”</b>
            <button onClick={() => setErrOpen(false)} aria-label="Închide verificarea erorilor">✕</button>
          </div>
          {errRep.items.length === 0 ? <p className="err-none">✓ Nicio formulă cu eroare pe această foaie.</p> : (
            <>
              <p className="err-sum">{errRep.items.length} {errRep.items.length === 1 ? 'formulă' : 'formule'} cu eroare: {errRep.counts.map(([e, n]) => `${e} × ${n}`).join(', ')}.{errRep.items.some((i) => !i.source) ? ' Repară întâi celulele marcate „sursă”; celelalte doar primesc eroarea mai departe.' : ''}</p>
              {errRep.circular.length > 0 && <p className="err-circ" aria-label="Referințe circulare">Referințe circulare: {errRep.circular.map((id) => <button key={id} className="link" onClick={() => { const p = parseCellId(id); if (p) selectRange(p, p, false); }}>{id}</button>)}</p>}
              <table>
                <thead><tr><th>Celula</th><th>Eroarea</th><th>Ce înseamnă</th><th>Formula</th></tr></thead>
                <tbody>
                  {errRep.items.slice(0, 500).map((it) => (
                    <tr key={it.id} onClick={() => { const p = parseCellId(it.id); if (p) selectRange(p, p, false); }} title="Du-te la celulă">
                      <td>{it.id}{it.source ? <span className="err-src"> sursă</span> : ''}</td><td>{it.err}</td><td className="err-help">{it.help}</td><td className="watch-f">{it.formula}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {errRep.items.length > 500 && <p>… și încă {errRep.items.length - 500}.</p>}
            </>
          )}
        </div>
      )}
      {watchOpen && (
        <div className="watch-win" role="dialog" aria-label="Urmărire valori">
          <div className="watch-head">
            <b>👁 Urmărire valori</b>
            <button onClick={addWatch} title="Adaugă celulele selectate în listă">＋ Adaugă selecția</button>
            <button onClick={() => setWatchOpen(false)} aria-label="Închide urmărirea">✕</button>
          </div>
          {watchRows.length === 0 ? <p>Selectează o celulă (de exemplu un total) și apasă „＋ Adaugă selecția”.</p> : (
            <table>
              <thead><tr><th>Foaia</th><th>Celula</th><th>Valoarea</th><th>Formula</th><th /></tr></thead>
              <tbody>
                {watchRows.map((w, i) => (
                  <tr key={w.sheet + '!' + w.id} onClick={() => { if (w.sheet === sheetName) { const p = parseCellId(w.id); if (p) selectRange(p, p, false); } }}>
                    <td>{w.sheet}</td><td>{w.id}</td><td className="watch-val">{w.text}</td><td className="watch-f">{w.raw.startsWith('=') ? w.raw : ''}</td>
                    <td><button onClick={(e) => { e.stopPropagation(); setWatch(watch.filter((_, j) => j !== i)); }} aria-label={'Scoate ' + w.id}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {printing && printTargets(printing.layout ? 'sheet' : printWhat).map((t, k) => (
        <div key={k} className={`sheet-print-wrap${k ? ' print-next-sheet' : ''}`}><PrintView {...t} cellLinks={!!printing.layout} /></div>
      ))}
    </div>
  );
}

// Fereastra rezumatului: după ce coloană grupez, (opțional) pe coloane după ce, ce adun și cum.
function PivotDialog({ src, heads, numeric, dateCol, distinct, values, chart, onMake, onClose }: {
  src: Range; heads: { c: number; label: string }[]; numeric(c: number): boolean; dateCol(c: number): boolean; distinct?(c: number): number;
  /** Categoriile unei coloane (pentru elementul de bază la „% din elementul ales”). */
  values?(c: number): string[]; chart?: boolean; onMake(spec: PivotSpec, chart?: boolean): void; onClose(): void;
}) {
  const [withChart, setWithChart] = useState(!!chart);
  // ★ Recomandate: rezumatele potrivite datelor, făcute dintr-un clic (numele coloanei fără litera ei).
  const recs = distinct ? recommendPivots(heads.map((h) => h.c), (c) => (heads.find((h) => h.c === c)?.label ?? '').replace(/^[A-Z]+: /, ''), numeric, dateCol, distinct) : [];
  const nums = heads.filter((h) => numeric(h.c));
  const texts = heads.filter((h) => !numeric(h.c));
  const [rowCol, setRowCol] = useState((texts[0] ?? heads[0]).c);
  const [colCol, setColCol] = useState(-1);
  // Al doilea câmp pe rânduri (-1 = fără), aspectul raportului și subtotalurile grupurilor.
  const [rowCol2, setRowCol2] = useState(-1);
  const [rowCol3, setRowCol3] = useState(-1);
  // Al doilea câmp pe coloane (-1 = fără).
  const [colCol2, setColCol2] = useState(-1);
  const [layout, setLayout] = useState<PivotLayout>('compact');
  const [subtotals, setSubtotals] = useState(true);
  const [valCol, setValCol] = useState((nums[nums.length - 1] ?? heads[heads.length - 1]).c);
  const [op, setOp] = useState<PivotOp>(nums.length ? 'sum' : 'count');
  const [show, setShow] = useState<PivotShow>('value');
  const [base, setBase] = useState('');
  const [totals, setTotals] = useState<PivotTotals>('both');
  // Filtrul de raport: -1 = fără.
  const [filterCol, setFilterCol] = useState(-1);
  // Elementele bifate la filtru (niciunul = se alege din B3 o singură valoare sau toate).
  const [filterItems, setFilterItems] = useState<string[]>([]);
  // Valorile în plus (fiecare în coloana ei), doar fără grupare pe coloane.
  const [more, setMore] = useState<PivotValue[]>([]);
  const setMoreAt = (i: number, v: Partial<PivotValue>) => setMore((m) => m.map((x, k) => (k === i ? { ...x, ...v } : x)));
  // Câmpurile calculate: numele coloanei noi și formula cu numele coloanelor (Suma / Bucăți), pe sumele fiecărui grup.
  const [calcs, setCalcs] = useState<PivotCalc[]>([]);
  const setCalcAt = (i: number, v: Partial<PivotCalc>) => setCalcs((m) => m.map((x, k) => (k === i ? { ...x, ...v } : x)));
  // Gruparea rândurilor: datele pe luni / trimestre / ani, numerele pe intervale de mărimea scrisă.
  const [grp, setGrp] = useState('');
  const [step, setStep] = useState('100');
  const [cgrp, setCgrp] = useState('');
  const [cstep, setCstep] = useState('100');
  // Grupurile alese de mână pe rânduri (doar la un câmp cu texte): numele grupului și categoriile bifate.
  const [tgroups, setTgroups] = useState<PivotTextGroup[]>([]);
  const setTgAt = (i: number, v: Partial<PivotTextGroup>) => setTgroups((m) => m.map((x, k) => (k === i ? { ...x, ...v } : x)));
  // Elementele calculate: un rând nou cu o formulă din categoriile de pe rânduri (Cluj - Iași).
  const [citems, setCitems] = useState<PivotCalc[]>([]);
  const setCiAt = (i: number, v: Partial<PivotCalc>) => setCitems((m) => m.map((x, k) => (k === i ? { ...x, ...v } : x)));
  const rowIsDate = dateCol(rowCol);
  const rowIsNum = !rowIsDate && numeric(rowCol);
  const grpOk = rowIsDate ? (PIVOT_DATE_GROUPS.some(([k]) => k === grp) ? grp : '') : rowIsNum && grp === 'step' ? 'step' : '';
  const stepNum = Number(step.trim().replace(',', '.'));
  const badStep = grpOk === 'step' && !(stepNum > 0 && Number.isFinite(stepNum));
  const same = colCol === rowCol;
  const r2Ok = colCol < 0 && rowCol2 >= 0 && rowCol2 !== rowCol ? rowCol2 : -1;
  const r3Ok = r2Ok >= 0 && rowCol3 >= 0 && rowCol3 !== rowCol && rowCol3 !== r2Ok ? rowCol3 : -1;
  // Gruparea coloanelor (ca la rânduri): datele pe luni / trimestre / ani, numerele pe intervale.
  const colIsDate = colCol >= 0 && colCol !== rowCol && dateCol(colCol);
  const colIsNum = colCol >= 0 && colCol !== rowCol && !colIsDate && numeric(colCol);
  const cgrpOk = colIsDate ? (PIVOT_DATE_GROUPS.some(([k]) => k === cgrp) ? cgrp : '') : colIsNum && cgrp === 'step' ? 'step' : '';
  const cstepNum = Number(cstep.trim().replace(',', '.'));
  const badCStep = cgrpOk === 'step' && !(cstepNum > 0 && Number.isFinite(cstepNum));
  const c2Ok = colCol >= 0 && !cgrpOk && colCol2 >= 0 && colCol2 !== rowCol && colCol2 !== colCol ? colCol2 : -1;
  // Procentele și restul: doar la Sumă și Număr; cele pe rând / coloană doar când grupezi și pe coloane.
  // Rangul nu merge cu gruparea pe intervale (rândurile nu mai au o etichetă de căutat).
  const shows = (SPREAD(op) ? PIVOT_SHOWS.slice(0, 1) : colCol >= 0 ? PIVOT_SHOWS : PIVOT_SHOWS.filter(([k]) => k !== 'pctRow' && k !== 'pctCol' && k !== 'index'))
    .filter(([k]) => !grpOk || !k.startsWith('rank'))
    .filter(([k]) => (r2Ok < 0 ? k !== 'pctParent' : k === 'value' || k === 'pctTotal' || k === 'pctParent'))
    .filter(([k]) => !BASED(k) || (!!values && !grpOk))
    .filter(([k]) => c2Ok < 0 || COLS2_SHOWS(k));
  const showOk = shows.some(([k]) => k === show) ? show : 'value';
  // Elementul de bază: una dintre categoriile câmpului de pe rânduri (prima, dacă nu s-a ales alta).
  const baseList = BASED(showOk) && values ? values(rowCol) : [];
  const baseOk = baseList.includes(base) ? base : baseList[0] ?? '';
  const moreOk = c2Ok < 0 && showOk === 'value' ? more : [];
  const calcOk = c2Ok < 0 && showOk === 'value' ? calcs.filter((k) => k.name.trim() && k.expr.trim()) : [];
  const fieldNames = heads.map((h) => h.label.replace(/^[A-Z]+: /, ''));
  // Grupurile de mână merg cu un singur câmp pe rânduri cu texte și fără rang / față de elementul ales.
  const tgList = values && !rowIsDate && !rowIsNum ? values(rowCol) : [];
  const tgAllowed = tgList.length > 1 && r2Ok < 0 && !showOk.startsWith('rank') && !BASED(showOk);
  const tgOk = tgAllowed ? tgroups.map((g) => ({ name: g.name.trim(), items: g.items.filter((x) => tgList.includes(x)) })).filter((g) => g.name && g.items.length) : [];
  // O categorie stă într-un singur grup: în celelalte grupuri nu se mai poate bifa.
  // Filtrul de raport: coloana aleasă (dacă nu e folosită pe rânduri / coloane) și elementele bifate (fără celula goală).
  const fcOk = filterCol >= 0 && filterCol !== rowCol && filterCol !== colCol && filterCol !== c2Ok && filterCol !== r2Ok && filterCol !== r3Ok ? filterCol : -1;
  const fList = fcOk >= 0 && values ? values(fcOk).filter((x) => x !== '') : [];
  const fItemsOk = filterItems.filter((x) => fList.includes(x));
  const ciAllowed = c2Ok < 0 && r2Ok < 0 && showOk === 'value' && !!values;
  const ciOk = ciAllowed ? citems.filter((k) => k.name.trim() && k.expr.trim()) : [];
  // Formula propusă: primele două categorii ale câmpului de pe rânduri (cu apostrofuri dacă au spații).
  const ciDefault = () => {
    const l = values ? values(rowCol).filter((x) => x !== '').slice(0, 2) : [];
    return l.map((n) => (/[\s'+\-*/^()&<>=;,]/.test(n) ? `'${n}'` : n)).join(' - ');
  };
  const takenBy = (x: string, i: number) => tgroups.findIndex((g, k) => k !== i && g.items.includes(x)) >= 0;
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="print-dlg pivot-dlg"
        role="dialog"
        aria-label="Rezumat"
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}
      >
        <h3>Rezumat (tabel pivot)</h3>
        <p className="print-info">
          Din tabelul {colName(src.c0)}{src.r0 + 1}:{colName(src.c1)}{src.r1 + 1} (primul rând e capul de tabel). Rezultatul apare într-o foaie nouă.
        </p>
        {recs.length > 0 && (
          <div className="pivot-recs" role="group" aria-label="Rezumate recomandate">
            <span>★ Recomandate (un clic):</span>
            {recs.map((r) => <button key={r.label} className="pivot-rec" onClick={() => onMake({ range: src, ...r.spec }, withChart)}>{r.label}</button>)}
            <span>sau alege tu:</span>
          </div>
        )}
        <label className="pivot-row">
          <span>Grupează pe rânduri după</span>
          <select value={rowCol} onChange={(e) => setRowCol(Number(e.target.value))} autoFocus>
            {heads.map((h) => <option key={h.c} value={h.c}>{h.label}</option>)}
          </select>
        </label>
        {(rowIsDate || rowIsNum) && (
          <label className="pivot-row">
            <span>{rowIsDate ? 'Grupează datele pe' : 'Grupează numerele'}</span>
            <span className="pivot-group">
              <select value={grpOk} onChange={(e) => setGrp(e.target.value)} aria-label="Grupare">
                <option value="">{rowIsDate ? 'zile (fiecare dată separat)' : 'fiecare număr separat'}</option>
                {rowIsDate ? PIVOT_DATE_GROUPS.map(([k, label]) => <option key={k} value={k}>{label}</option>) : <option value="step">pe intervale de…</option>}
              </select>
              {grpOk === 'step' && <input value={step} onChange={(e) => setStep(e.target.value)} aria-label="Mărimea intervalului" size={6} />}
            </span>
          </label>
        )}
        {tgAllowed && tgroups.map((g, i) => (
          <div key={i} className="pivot-tg" role="group" aria-label="Grup ales de mână">
            <div className="pivot-row">
              <span>Grup</span>
              <span className="pivot-group">
                <input value={g.name} onChange={(e) => setTgAt(i, { name: e.target.value })} aria-label="Numele grupului" style={{ width: 'auto', flex: '1 1 auto' }} />
                <button onClick={() => setTgroups((x) => x.filter((_, k) => k !== i))} title="Scoate grupul" aria-label="Scoate grupul">✕</button>
              </span>
            </div>
            <div className="pivot-tg-items">
              {tgList.map((x) => (
                <label key={x} className={takenBy(x, i) ? 'off' : ''}>
                  <input type="checkbox" checked={g.items.includes(x)} disabled={takenBy(x, i)}
                    onChange={(e) => setTgAt(i, { items: e.target.checked ? [...g.items, x] : g.items.filter((y) => y !== x) })} /> {x || '(gol)'}
                </label>
              ))}
            </div>
          </div>
        ))}
        {values && !rowIsDate && !rowIsNum && (
          <div className="pivot-row">
            <span />
            <button disabled={!tgAllowed || tgroups.length >= 20}
              onClick={() => setTgroups((m) => [...m, { name: `Grup${m.length + 1}`, items: [] }])}
              title={tgAllowed ? 'Grup ales de mână: bifezi categoriile care se adună pe un singur rând (de exemplu Nord = Cluj + Iași); celelalte rămân pe rândul lor' : 'Grupurile alese de mână merg cu un singur câmp pe rânduri, cu cel puțin două categorii, și fără rang sau „față de elementul ales”'}>
              + Grupează categorii
            </button>
          </div>
        )}
        <label className="pivot-row">
          <span>Și pe coloane după (opțional)</span>
          <select value={colCol} onChange={(e) => setColCol(Number(e.target.value))}>
            <option value={-1}>(nimic)</option>
            {heads.map((h) => <option key={h.c} value={h.c}>{h.label}</option>)}
          </select>
        </label>
        {(colIsDate || colIsNum) && (
          <label className="pivot-row">
            <span>{colIsDate ? 'Grupează coloanele pe' : 'Grupează numerele de pe coloane'}</span>
            <span className="pivot-group">
              <select value={cgrpOk} onChange={(e) => setCgrp(e.target.value)} aria-label="Gruparea coloanelor">
                <option value="">{colIsDate ? 'zile (fiecare dată separat)' : 'fiecare număr separat'}</option>
                {colIsDate ? PIVOT_DATE_GROUPS.map(([k, label]) => <option key={k} value={k}>{label}</option>) : <option value="step">pe intervale de…</option>}
              </select>
              {cgrpOk === 'step' && <input value={cstep} onChange={(e) => setCstep(e.target.value)} aria-label="Mărimea intervalului pe coloane" size={6} />}
            </span>
          </label>
        )}
        {colCol >= 0 && !cgrpOk && (
          <label className="pivot-row" title="Al doilea câmp pe coloane: fiecare coloană a primului câmp se împarte după valorile acestei coloane, cu o coloană de subtotal pentru fiecare grup">
            <span>Încă un câmp pe coloane</span>
            <select value={c2Ok} onChange={(e) => setColCol2(Number(e.target.value))} aria-label="Al doilea câmp pe coloane">
              <option value={-1}>(nimic)</option>
              {heads.filter((h) => h.c !== rowCol && h.c !== colCol).map((h) => <option key={h.c} value={h.c}>{h.label}</option>)}
            </select>
          </label>
        )}
        {c2Ok >= 0 && (
          <label className="pivot-row pivot-check" title="O coloană „… Total” după fiecare grup al primului câmp de pe coloane">
            <span><input type="checkbox" checked={subtotals} onChange={(e) => setSubtotals(e.target.checked)} aria-label="Subtotaluri pe coloane" /> Subtotaluri pe coloane</span>
          </label>
        )}
        <label className="pivot-row" title="Al doilea câmp pe rânduri: fiecare grup al primului câmp se împarte după valorile acestei coloane, cu subtotalul grupului">
          <span>Încă un câmp pe rânduri (sub primul)</span>
          <select value={r2Ok} onChange={(e) => setRowCol2(Number(e.target.value))} disabled={colCol >= 0} aria-label="Al doilea câmp pe rânduri">
            <option value={-1}>(nimic)</option>
            {heads.filter((h) => h.c !== rowCol).map((h) => <option key={h.c} value={h.c}>{h.label}</option>)}
          </select>
        </label>
        {r2Ok >= 0 && (
          <label className="pivot-row" title="Al treilea câmp pe rânduri: fiecare valoare a celui de-al doilea câmp se împarte după valorile acestei coloane, cu subtotalul ei">
            <span>Al treilea câmp pe rânduri</span>
            <select value={r3Ok} onChange={(e) => setRowCol3(Number(e.target.value))} aria-label="Al treilea câmp pe rânduri">
              <option value={-1}>(nimic)</option>
              {heads.filter((h) => h.c !== rowCol && h.c !== r2Ok).map((h) => <option key={h.c} value={h.c}>{h.label}</option>)}
            </select>
          </label>
        )}
        {r2Ok >= 0 && (
          <label className="pivot-row" title="Compact: ambele câmpuri în prima coloană, al doilea retras; Schiță: câte o coloană pe câmp, subtotalul pe rândul grupului; Tabelar: câte o coloană pe câmp, subtotalul pe un rând Total sub grup">
            <span>Aspectul raportului</span>
            <span className="pivot-group">
              <select value={layout} onChange={(e) => setLayout(e.target.value as PivotLayout)} aria-label="Aspectul raportului">
                {PIVOT_LAYOUTS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
              <span><input type="checkbox" checked={subtotals} onChange={(e) => setSubtotals(e.target.checked)} aria-label="Subtotaluri pe grupuri" /> Subtotaluri</span>
            </span>
          </label>
        )}
        <label className="pivot-row">
          <span>Ce calculez</span>
          <select value={op} onChange={(e) => setOp(e.target.value as PivotOp)}>
            {PIVOT_OPS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </label>
        <label className="pivot-row">
          <span>{op === 'count' ? 'Numără rândurile (coloana nu contează)' : 'Din coloana'}</span>
          <select value={valCol} onChange={(e) => setValCol(Number(e.target.value))} disabled={op === 'count'}>
            {heads.map((h) => <option key={h.c} value={h.c}>{h.label}</option>)}
          </select>
        </label>
        {moreOk.map((m, i) => (
          <div key={i} className="pivot-row pivot-more">
            <span>Încă o valoare</span>
            <span className="pivot-group">
              <select value={m.op} onChange={(e) => setMoreAt(i, { op: e.target.value as PivotOp })} aria-label="Ce calculez">
                {PIVOT_OPS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
              <select value={m.valCol} onChange={(e) => setMoreAt(i, { valCol: Number(e.target.value) })} disabled={m.op === 'count'} aria-label="Din coloana">
                {heads.map((h) => <option key={h.c} value={h.c}>{h.label}</option>)}
              </select>
              <button onClick={() => setMore((x) => x.filter((_, k) => k !== i))} title="Scoate valoarea" aria-label="Scoate valoarea">✕</button>
            </span>
          </div>
        ))}
        <div className="pivot-row">
          <span />
          <button disabled={c2Ok >= 0 || showOk !== 'value' || more.length >= MAX_PIVOT_VALUES - 1}
            onClick={() => setMore((m) => [...m, { valCol: (nums[0] ?? heads[0]).c, op: nums.length ? 'avg' : 'count' }])}
            title={c2Ok >= 0 || showOk !== 'value' ? 'Mai multe valori merg doar cu cel mult un câmp pe coloane și cu valorile arătate ca cifre' : 'Încă o coloană cu un calcul (de exemplu media cantității lângă suma vânzărilor)'}>
            + Încă o valoare
          </button>
        </div>
        {(c2Ok < 0 && showOk === 'value' ? calcs : []).map((k, i) => (
          <div key={i} className="pivot-row pivot-more">
            <span>Câmp calculat</span>
            <span className="pivot-group">
              <input value={k.name} onChange={(e) => setCalcAt(i, { name: e.target.value })} aria-label="Numele câmpului calculat" style={{ width: 90 }} />
              <input value={k.expr} onChange={(e) => setCalcAt(i, { expr: e.target.value })} aria-label="Formula câmpului calculat" style={{ width: 140 }}
                title={`Formula cu numele coloanelor, calculată pe sumele fiecărui rând din rezumat (de exemplu ${fieldNames.slice(-2).map((n) => (n.includes(' ') || n.includes("'") ? `'${n}'` : n)).join(' / ')}). Numele cu spații se scriu între apostrofuri.`} />
              <button onClick={() => setCalcs((x) => x.filter((_, n) => n !== i))} title="Scoate câmpul calculat" aria-label="Scoate câmpul calculat">✕</button>
            </span>
          </div>
        ))}
        <div className="pivot-row">
          <span />
          <button disabled={c2Ok >= 0 || showOk !== 'value' || calcs.length >= MAX_PIVOT_CALCS}
            onClick={() => setCalcs((m) => [...m, { name: `Câmp${m.length + 1}`, expr: fieldNames.length >= 2 ? fieldNames.slice(-2).map((n) => (n.includes(' ') || n.includes("'") ? `'${n}'` : n)).join(' / ') : '' }])}
            title={c2Ok >= 0 || showOk !== 'value' ? 'Câmpurile calculate merg doar cu cel mult un câmp pe coloane și cu valorile arătate ca cifre' : 'Câmp calculat: o coloană nouă cu o formulă din celelalte coloane (de exemplu Suma / Bucăți = prețul mediu), calculată pe sumele fiecărui rând'}>
            + Câmp calculat
          </button>
        </div>
        {(ciAllowed ? citems : []).map((k, i) => (
          <div key={i} className="pivot-row pivot-more">
            <span>Element calculat</span>
            <span className="pivot-group">
              <input value={k.name} onChange={(e) => setCiAt(i, { name: e.target.value })} aria-label="Numele elementului calculat" style={{ width: 90 }} />
              <input value={k.expr} onChange={(e) => setCiAt(i, { expr: e.target.value })} aria-label="Formula elementului calculat" style={{ width: 140 }}
                title="Formula cu numele categoriilor de pe rânduri (de exemplu Cluj - Iași), pe fiecare coloană a rezumatului. Numele cu spații se scriu între apostrofuri. Rândul Total nu îl include." />
              <button onClick={() => setCitems((x) => x.filter((_, n) => n !== i))} title="Scoate elementul calculat" aria-label="Scoate elementul calculat">✕</button>
            </span>
          </div>
        ))}
        <div className="pivot-row">
          <span />
          <button disabled={!ciAllowed || citems.length >= MAX_PIVOT_CALCS}
            onClick={() => setCitems((m) => [...m, { name: `Element${m.length + 1}`, expr: ciDefault() }])}
            title={ciAllowed ? 'Element calculat: un rând nou, sub categorii, cu o formulă din alte rânduri (de exemplu Cluj - Iași = diferența dintre ele); rândul Total rămâne totalul categoriilor' : 'Elementele calculate merg doar cu un singur câmp pe rânduri, cel mult unul pe coloane și cu valorile arătate ca cifre'}>
            + Element calculat
          </button>
        </div>
        <label className="pivot-row" title="Filtru de raport: deasupra rezumatului apare o listă cu valorile coloanei alese; alegi una și cifrele se refac doar pentru ea">
          <span>Filtru deasupra rezumatului</span>
          <select value={filterCol === rowCol || filterCol === colCol || filterCol === c2Ok || filterCol === r2Ok || filterCol === r3Ok ? -1 : filterCol} onChange={(e) => { setFilterCol(Number(e.target.value)); setFilterItems([]); }} aria-label="Filtru de raport">
            <option value={-1}>(fără)</option>
            {heads.filter((h) => h.c !== rowCol && h.c !== colCol && h.c !== c2Ok && h.c !== r2Ok && h.c !== r3Ok).map((h) => <option key={h.c} value={h.c}>{h.label}</option>)}
          </select>
        </label>
        {fcOk >= 0 && fList.length > 1 && (
          <div className="pivot-tg" role="group" aria-label="Elementele filtrului"
            title="Bifează unul sau mai multe elemente: deasupra rezumatului apare „(Mai multe elemente)” și cifrele țin cont doar de ele. Fără bife, alegi din listă o singură valoare sau toate.">
            <div className="pivot-row"><span>Doar elementele bifate</span><span>{filterItems.length ? `${filterItems.length} din ${fList.length}` : '(niciunul: toate)'}</span></div>
            <div className="pivot-tg-items">
              {fList.map((x) => (
                <label key={x}>
                  <input type="checkbox" checked={filterItems.includes(x)}
                    onChange={(e) => setFilterItems((m) => (e.target.checked ? [...m, x] : m.filter((y) => y !== x)))} /> {x}
                </label>
              ))}
            </div>
          </div>
        )}
        <label className="pivot-row">
          <span>Arată valorile ca</span>
          <select value={showOk} onChange={(e) => setShow(e.target.value as PivotShow)} disabled={shows.length === 1} aria-label="Arată valorile ca">
            {shows.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </label>
        {baseList.length > 0 && (
          <label className="pivot-row" title="Elementul de bază: fiecare rând se compară cu valoarea acestui rând (100% sau diferența 0 la el)">
            <span>Față de</span>
            <select value={baseOk} onChange={(e) => setBase(e.target.value)} aria-label="Elementul de bază">
              {baseList.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
        )}
        <label className="pivot-row">
          <span>Totaluri generale</span>
          <select value={colCol >= 0 ? totals : totals === 'both' || totals === 'cols' ? 'both' : 'none'} onChange={(e) => setTotals(e.target.value as PivotTotals)} aria-label="Totaluri generale"
            title="Rândul Total de jos (totalul fiecărei coloane) și coloana Total din dreapta (totalul fiecărui rând, când grupezi și pe coloane)">
            {(colCol >= 0 ? PIVOT_TOTALS : PIVOT_TOTALS.filter(([k]) => k === 'both' || k === 'none')).map(([k, label]) => <option key={k} value={k}>{colCol < 0 && k === 'both' ? 'Cu rândul Total' : label}</option>)}
          </select>
        </label>
        <label className="pivot-row pivot-check" title="Grafic pivot: un grafic cu coloane din cifrele rezumatului, pus lângă el; se reîmprospătează odată cu rezumatul">
          <span><input type="checkbox" checked={withChart} onChange={(e) => setWithChart(e.target.checked)} aria-label="Și un grafic pivot" /> Și un grafic pivot</span>
        </label>
        {same && <p className="print-info">Alege altă coloană pentru „pe coloane” decât cea de pe rânduri.</p>}
        {(badStep || badCStep) && <p className="print-info">Mărimea intervalului trebuie să fie un număr mai mare ca 0.</p>}
        <div className="print-actions">
          <button onClick={onClose}>Anulează</button>
          <button
            className="primary"
            disabled={same || badStep || badCStep}
            onClick={() => onMake({ range: src, rowCol, ...(colCol >= 0 ? { colCol, ...(c2Ok >= 0 ? { colCol2: c2Ok, ...(subtotals ? {} : { subtotals: false }) } : {}), ...(cgrpOk === 'step' ? { colGroup: cstepNum } : cgrpOk ? { colGroup: cgrpOk as 'month' | 'quarter' | 'year' } : {}) } : {}), valCol, op, ...(showOk !== 'value' ? { show: showOk, ...(BASED(showOk) ? { base: baseOk } : {}) } : {}), ...(moreOk.length ? { more: moreOk } : {}), ...(calcOk.length ? { calc: calcOk } : {}),
              ...(fcOk >= 0 ? { filterCol: fcOk, ...(fItemsOk.length ? { filterItems: fItemsOk } : {}) } : {}),
              ...(r2Ok >= 0 ? { rowCol2: r2Ok, ...(r3Ok >= 0 ? { rowCol3: r3Ok } : {}), ...(layout !== 'compact' ? { layout } : {}), ...(subtotals ? {} : { subtotals: false }) } : {}),
              ...(totals !== 'both' ? { totals: colCol >= 0 ? totals : totals === 'cols' ? 'both' : 'none' } : {}),
              ...(tgOk.length ? { rowGroups: tgOk } : {}), ...(ciOk.length ? { calcItems: ciOk } : {}),
              ...(grpOk === 'step' ? { group: stepNum } : grpOk ? { group: grpOk as 'month' | 'quarter' | 'year' } : {}) }, withChart)}
          >
            Fă rezumatul
          </button>
        </div>
      </div>
    </div>
  );
}

// Stilurile celulelor cu evidențierea pusă peste (pentru tipărire).
function withLooks(styles: Styles, looks: Record<string, CondLook>): Styles {
  if (!Object.keys(looks).length) return styles;
  const out = { ...styles };
  for (const [id, look] of Object.entries(looks)) out[id] = { ...styles[id], ...COND_LOOKS[look].style };
  return out;
}

// Fereastra cu regulile de evidențiere ale foii și formularul pentru una nouă (pe zona selectată).
// Fereastra numelor definite: lista lor, plus adăugare (pentru zona selectată) și ștergere.
function NamesDialog({ names, here, selection, onChange, onEdit, onFromSelection, onClose }: {
  names: DefinedName[]; here: string; selection: string | null; onChange(names: DefinedName[]): void;
  /** Schimbă numele i (numele și / sau ce înseamnă); formulele care îl folosesc se redenumesc. Întoarce mesajul de arătat. */
  onEdit(i: number, def: { name: string; ref: string }): string;
  /** Creează din selecție; întoarce mesajul de arătat. */
  onFromSelection(where: 'top' | 'left'): string;
  onClose(): void;
}) {
  const [fromMsg, setFromMsg] = useState('');
  const [name, setName] = useState('');
  const [ref, setRef] = useState(here);
  // Numele care se schimbă (indicele lui), sau null când se adaugă unul nou.
  const [editing, setEditing] = useState<number | null>(null);
  const [editMsg, setEditMsg] = useState('');
  const n = name.trim();
  const problem = !n ? ''
    : !/^[\p{L}_][\p{L}\d_.]*$/u.test(n) ? 'Numele începe cu o literă și are doar litere, cifre, „_” și „.” (fără spații).'
      : /^[A-Z]{1,3}\d+$/i.test(n) || /^(TRUE|FALSE|ADEVARAT|ADEVĂRAT|FALS)$/i.test(n) ? 'Numele nu poate arăta ca o celulă (A1) sau ca ADEVĂRAT/FALS.'
        : names.some((d, i) => i !== editing && d.sheet === (editing === null ? undefined : names[editing].sheet) && nameKey(d.name) === nameKey(n)) ? 'Există deja un nume la fel.' : '';
  const ok = !!n && !problem && !!ref.trim();
  const add = () => {
    if (!ok) return;
    if (editing !== null) { setEditMsg(onEdit(editing, { name: n, ref: ref.trim().replace(/^=/, '') })); setEditing(null); setRef(here); }
    else { onChange([...names, { name: n, ref: ref.trim().replace(/^=/, '') }]); setEditMsg(''); }
    setName('');
  };
  const startEdit = (i: number) => { setEditing(i); setName(names[i].name); setRef(names[i].ref); setEditMsg(''); };
  const cancelEdit = () => { setEditing(null); setName(''); setRef(here); };
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="print-dlg cond-dlg"
        role="dialog"
        aria-label="Nume definite"
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); onClose(); }
          else if (e.key === 'Enter' && e.target instanceof HTMLInputElement) { e.preventDefault(); add(); }
        }}
      >
        <h3>Nume definite</h3>
        <p className="print-info">Dai un nume unei celule sau zone și îl folosești în formule, de exemplu <b>=B2*TVA</b> în loc de <b>=B2*$E$11</b>.</p>
        <div className="cond-form">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="TVA" aria-label="Numele" autoFocus />
          = <input value={ref} onChange={(e) => setRef(e.target.value)} aria-label="Celula sau zona" title="Celula, zona sau valoarea; implicit zona selectată" />
        </div>
        {problem && <p className="print-info" role="alert">{problem}</p>}
        <div className="print-actions">
          {editing !== null && <button onClick={cancelEdit}>Renunță</button>}
          <button className="primary" disabled={!ok} onClick={add}>{editing !== null ? 'Salvează schimbarea' : 'Adaugă numele'}</button>
        </div>
        {editMsg && <p className="print-info" role="status">{editMsg}</p>}
        <h4>Creează din selecție</h4>
        {selection ? (
          <>
            <p className="print-info">Textele din capul zonei <b>{selection}</b> devin nume pentru coloanele sau rândurile lor (de exemplu <b>=SUM(Preț)</b>).</p>
            <div className="print-actions names-from">
              <button onClick={() => setFromMsg(onFromSelection('top'))}>Din primul rând (coloane)</button>
              <button onClick={() => setFromMsg(onFromSelection('left'))}>Din prima coloană (rânduri)</button>
            </div>
            {fromMsg && <p className="print-info" role="status">{fromMsg}</p>}
          </>
        ) : <p className="print-info">Selectează un tabel cu cap (de exemplu A1:C20) ca să faci nume din titlurile coloanelor.</p>}
        <h4>Numele tabelului</h4>
        {names.length ? (
          <ul className="cond-list">
            {names.map((d, i) => (
              <li key={i}>
                <span className="cond-text"><b>{d.name}</b> = {d.ref}{d.sheet !== undefined ? ` (doar în foaia „${d.sheet}”)` : ''}</span>
                <button title="Schimbă numele sau ce înseamnă (formulele care îl folosesc primesc numele nou)" aria-label={`Schimbă ${d.name}`} onClick={() => startEdit(i)}>✎</button>
                <button title="Șterge numele (formulele care îl folosesc vor arăta #NAME?)" onClick={() => onChange(names.filter((_, j) => j !== i))}>✕</button>
              </li>
            ))}
          </ul>
        ) : <p className="print-info">Niciun nume încă.</p>}
        <div className="print-actions">
          <button onClick={onClose}>Închide</button>
        </div>
      </div>
    </div>
  );
}

function CondDialog({ range, rules, onAdd, onRemove, onSet, onClose, initOp }: {
  range: string; rules: SheetRule[]; initOp?: CondOp; onAdd(rule: SheetRule): void; onRemove(i: number): void;
  /** Toată lista de reguli schimbată (editare, ordine, ștergere totală), cu mesajul pentru bara de stare. */
  onSet(rules: SheetRule[], msg: string): void; onClose(): void;
}) {
  const [op, setOp] = useState<CondOp>(initOp ?? 'gt');
  const [v1, setV1] = useState('');
  const [v2, setV2] = useState('');
  const [look, setLook] = useState<CondLook>('red');
  // Regula care se editează (indicele ei) și zona ei, care se poate schimba.
  const [editing, setEditing] = useState<number | null>(null);
  const [zone, setZone] = useState(range);
  const ok = (!needsValue(op) || (v1.trim() !== '' && (op !== 'between' || v2.trim() !== ''))) && /^\$?[A-Z]{1,3}\$?\d+(:\$?[A-Z]{1,3}\$?\d+)?$/i.test(zone.trim());
  const add = () => {
    if (!ok) return;
    const rule: SheetRule = { range: editing === null ? range : zone.trim().toUpperCase(), op, v1: needsValue(op) ? v1.trim() : '', ...(op === 'between' ? { v2: v2.trim() } : {}), look };
    if (editing === null) onAdd(rule);
    else { onSet(rules.map((r, j) => (j === editing ? rule : r)), `Evidențiere schimbată: ${describeRule(rule)}`); setEditing(null); setZone(range); }
    setV1('');
    setV2('');
  };
  const edit = (i: number) => {
    const r = rules[i];
    setEditing(i); setZone(r.range); setOp(r.op); setV1(r.v1 ?? ''); setV2(r.v2 ?? ''); setLook(r.look);
  };
  // Regulile de mai jos din listă câștigă când două se potrivesc pe aceeași celulă; ↑ / ↓ schimbă ordinea.
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= rules.length) return;
    const next = [...rules];
    [next[i], next[j]] = [next[j], next[i]];
    onSet(next, `Ordinea regulilor schimbată (${describeRule(rules[i])})`);
    if (editing === i) setEditing(j); else if (editing === j) setEditing(i);
  };
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="print-dlg cond-dlg"
        role="dialog"
        aria-label="Evidențiere"
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); onClose(); }
          else if (e.key === 'Enter' && e.target instanceof HTMLInputElement) { e.preventDefault(); add(); }
        }}
      >
        <h3>Evidențiere automată</h3>
        {editing === null ? <p className="print-info">Celulele din <b>{range}</b> se colorează singure când:</p> : (
          <p className="print-info cond-editing">Schimbi regula {editing + 1}: celulele din{' '}
            <input value={zone} onChange={(e) => setZone(e.target.value)} aria-label="Zona regulii" size={10} /> se colorează când:</p>
        )}
        <div className="cond-form">
          <select value={op} onChange={(e) => { const v = e.target.value as CondOp; setOp(v); if (v === 'scale' || v === 'icons') setLook('green'); }} aria-label="Condiția" autoFocus>
            {COND_OPS.map(([k, label]) => <option key={k} value={k}>{k === 'formula' ? label : `valoarea ${label}`}</option>)}
          </select>
          {needsValue(op) && (
            <input value={v1} onChange={(e) => setV1(e.target.value)} placeholder={op === 'text' ? 'Neîncasat' : op === 'top' || op === 'bottom' ? '10' : op === 'formula' ? '=$C2>1000' : '1000'} aria-label={op === 'formula' ? 'Formula (pentru prima celulă a zonei)' : 'Valoarea'} />
          )}
          {op === 'between' && (
            <>și <input value={v2} onChange={(e) => setV2(e.target.value)} placeholder="5000" aria-label="Capătul de sus" /></>
          )}
        </div>
        <div className="cond-looks" role="radiogroup" aria-label="Culoarea">
          {(Object.keys(COND_LOOKS) as CondLook[]).map((k) => (
            <button
              key={k}
              role="radio"
              aria-checked={look === k}
              className={`cond-look ${look === k ? 'on' : ''}`}
              style={op === 'icons' ? { background: 'var(--bg)', color: 'var(--text)' } : op === 'scale'
                ? { background: `linear-gradient(90deg, ${SCALES[k].colors.join(', ')})`, color: '#222' }
                : { background: COND_LOOKS[k].style.bg, color: COND_LOOKS[k].style.color, fontWeight: COND_LOOKS[k].style.b ? 700 : undefined }}
              onClick={() => setLook(k)}
            >
              {op === 'icons' ? (<>{[0, 1, 2].map((i) => <span key={i} className="cond-icon" style={{ backgroundImage: iconUrl(k, i) }} />)} {ICON_SETS[k].label}</>)
                : op === 'scale' ? SCALES[k].label : COND_LOOKS[k].label}
            </button>
          ))}
        </div>
        <div className="print-actions">
          {editing !== null && <button onClick={() => { setEditing(null); setZone(range); setV1(''); setV2(''); }}>Renunță la schimbare</button>}
          <button className="primary" disabled={!ok} onClick={add}>{editing === null ? 'Adaugă regula' : 'Salvează regula'}</button>
        </div>
        <h4>Regulile foii</h4>
        {rules.length > 1 && <p className="print-info">Când două reguli se potrivesc pe aceeași celulă, câștigă cea de mai jos; ↑ ↓ schimbă ordinea.</p>}
        {rules.length ? (
          <ul className="cond-list">
            {rules.map((r, i) => (
              <li key={i}>
                <span className="cond-swatch" style={r.op === 'icons' ? { background: `${iconUrl(r.look, 0)} center / 13px no-repeat`, color: 'transparent' } : r.op === 'scale' ? { background: `linear-gradient(90deg, ${SCALES[r.look].colors.join(', ')})`, color: '#222' } : { background: COND_LOOKS[r.look].style.bg ?? 'transparent', color: COND_LOOKS[r.look].style.color }}>Ab</span>
                <span className="cond-text">{describeRule(r)}</span>
                <button title="Mai sus (contează mai puțin)" aria-label="Mută regula mai sus" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button title="Mai jos (câștigă față de cele de deasupra)" aria-label="Mută regula mai jos" disabled={i === rules.length - 1} onClick={() => move(i, 1)}>↓</button>
                <button title="Schimbă regula: condiția, valoarea, culoarea și zona" aria-label="Schimbă regula" className={editing === i ? 'on' : ''} onClick={() => edit(i)}>✎</button>
                <button title="Șterge regula" onClick={() => { if (editing !== null) { setEditing(null); setZone(range); } onRemove(i); }}>✕</button>
              </li>
            ))}
          </ul>
        ) : <p className="print-info">Nicio regulă încă.</p>}
        <div className="print-actions">
          {rules.length > 1 && <button onClick={() => { setEditing(null); setZone(range); onSet([], `Toate evidențierile foii au fost șterse (${rules.length}; Ctrl+Z le aduce înapoi)`); }}>Șterge toate</button>}
          <button onClick={onClose}>Închide</button>
        </div>
      </div>
    </div>
  );
}

// Fereastra în care scrii valorile listei, câte una pe rând.
const ALL_FNS = functionNames();

function FxDialog({ onPick, onClose }: { onPick(name: string, help?: FnHelp): void; onClose(): void }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<FnCat | 'Toate'>('Uzuale');
  const list = useMemo(() => searchFns(ALL_FNS, q, q.trim() ? 'Toate' : cat), [q, cat]);
  const [pick, setPick] = useState(0);
  const cur = list[Math.min(pick, list.length - 1)];
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setPick(0); }, [q, cat]);
  useEffect(() => { listRef.current?.querySelector('.on')?.scrollIntoView({ block: 'nearest' }); }, [pick]);
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="print-dlg fx-dlg"
        role="dialog"
        aria-label="Inserează funcție"
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); onClose(); }
          else if (e.key === 'ArrowDown') { e.preventDefault(); setPick((p) => Math.min(list.length - 1, p + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setPick((p) => Math.max(0, p - 1)); }
          else if (e.key === 'Enter' && cur) { e.preventDefault(); onPick(cur.name, cur.help); }
        }}
      >
        <h3><i>fx</i> Inserează funcție</h3>
        <input autoFocus className="fx-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Caută: sumă, medie, rată, vârstă, caută, text…" />
        {!q.trim() && (
          <div className="fx-cats">
            {[...FN_CATS, 'Toate' as const].map((c) => <button key={c} className={c === cat ? 'active' : ''} onClick={() => setCat(c)}>{c}</button>)}
          </div>
        )}
        <div className="fx-list" ref={listRef}>
          {list.map((f, i) => (
            <div
              key={f.name}
              className={`fx-item ${i === Math.min(pick, list.length - 1) ? 'on' : ''}`}
              onClick={() => setPick(i)}
              onDoubleClick={() => onPick(f.name, f.help)}
            >
              <b>{f.name}</b>{f.help && <span> · {f.help.desc}</span>}
            </div>
          ))}
          {!list.length && <p className="print-info">Nu am găsit nicio funcție. Încearcă alt cuvânt.</p>}
        </div>
        {cur && (
          <p className="fx-sig">
            <b>{cur.name}</b>({cur.help?.args ?? '…'})<br />
            {cur.help?.desc ?? 'Funcție compatibilă cu fișierele .xlsx (lista completă are explicații doar pentru cele folosite des).'}
          </p>
        )}
        <div className="print-actions">
          <button onClick={onClose}>Anulează</button>
          <button className="primary" disabled={!cur} onClick={() => cur && onPick(cur.name, cur.help)}>Inserează</button>
        </div>
      </div>
    </div>
  );
}

function SplitDialog({ lines, where, onOk, onClose }: { lines: string[]; where: string; onOk(delim: string, merge: boolean): void; onClose(): void }) {
  const guess = useMemo(() => guessDelim(lines), [lines]);
  const known = DELIMS.some(([d]) => d === guess);
  const [kind, setKind] = useState(known ? guess : 'other');
  const [other, setOther] = useState(known ? '' : guess);
  const [merge, setMerge] = useState(false);
  const delim = kind === 'other' ? other : kind;
  const preview = lines.filter((l) => l.trim()).slice(0, 5).map((l) => splitText(l, delim, merge));
  const cols = Math.max(1, ...preview.map((p) => p.length));
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="print-dlg list-dlg paste-special split-dlg"
        role="dialog"
        aria-label="Text în coloane"
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}
      >
        <h3>Text în coloane</h3>
        <p className="print-info">Textul din {where} se împarte în coloanele din dreapta. Numerele și datele se recunosc singure.</p>
        <fieldset>
          <legend>Separatorul</legend>
          {DELIMS.map(([d, label]) => (
            <label key={label} className="print-check"><input type="radio" name="split-d" checked={kind === d} onChange={() => setKind(d)} /> {label}</label>
          ))}
          <label className="print-check">
            <input type="radio" name="split-d" checked={kind === 'other'} onChange={() => setKind('other')} /> Altul:{' '}
            <input className="split-other" value={other} maxLength={5} onChange={(e) => { setOther(e.target.value); setKind('other'); }} placeholder="de ex. | sau -" />
          </label>
        </fieldset>
        <label className="print-check"><input type="checkbox" checked={merge} onChange={(e) => setMerge(e.target.checked)} /> Separatorii la rând contează ca unul singur</label>
        <div className="split-preview">
          <table>
            <tbody>
              {preview.map((p, i) => <tr key={i}>{Array.from({ length: cols }, (_, j) => <td key={j}>{p[j] ?? ''}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
        <div className="print-actions">
          <button onClick={onClose}>Anulează</button>
          <button className="primary" disabled={!delim} onClick={() => onOk(delim, merge)}>Împarte</button>
        </div>
      </div>
    </div>
  );
}

function ConsolidateDialog({ start, current, onOk, onClose }: {
  start: string; current: string; onOk(refs: string[], fn: ConsFn, top: boolean, left: boolean): void; onClose(): void;
}) {
  const [refs, setRefs] = useState<string[]>([]);
  const [ref, setRef] = useState(current);
  const [fn, setFn] = useState<ConsFn>('sum');
  const [top, setTop] = useState(true);
  const [left, setLeft] = useState(true);
  const add = () => { const v = ref.trim(); if (v && !refs.includes(v)) setRefs([...refs, v]); setRef(''); };
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg list-dlg cons-dlg" role="dialog" aria-label="Consolidare" onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}>
        <h3>⊕ Consolidare</h3>
        <p className="print-info">Adună mai multe zone într-un singur tabel, începând din {start}. Scrie fiecare zonă (de exemplu Ianuarie!A1:C10) și apasă Adaugă.</p>
        <label className="print-check">Funcția{' '}
          <select value={fn} onChange={(e) => setFn(e.target.value as ConsFn)} aria-label="Funcția consolidării">
            {CONS_FNS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
        </label>
        <div className="cons-add">
          <input value={ref} onChange={(e) => setRef(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} placeholder="Foaie2!A1:C10" aria-label="Zona de adăugat" />
          <button onClick={add} disabled={!ref.trim()}>＋ Adaugă</button>
        </div>
        <ul className="cons-list" aria-label="Zonele alese">
          {refs.map((r) => <li key={r}>{r} <button onClick={() => setRefs(refs.filter((x) => x !== r))} aria-label={'Scoate ' + r}>✕</button></li>)}
          {!refs.length && <li className="print-info">Nicio zonă încă.</li>}
        </ul>
        <label className="print-check"><input type="checkbox" checked={top} onChange={(e) => setTop(e.target.checked)} /> Etichete în rândul de sus (coloanele cu același nume se adună împreună)</label>
        <label className="print-check"><input type="checkbox" checked={left} onChange={(e) => setLeft(e.target.checked)} /> Etichete în coloana din stânga (rândurile cu același nume se adună împreună)</label>
        <div className="print-actions">
          <button onClick={onClose}>Anulează</button>
          <button className="primary" disabled={!refs.length} onClick={() => onOk(refs, fn, top, left)}>Consolidează</button>
        </div>
      </div>
    </div>
  );
}

function DedupeDialog({ g, head: head0, label, onOk, onClose }: {
  g: Range; head: boolean; label(c: number): string; onOk(cols: number[], head: boolean): void; onClose(): void;
}) {
  const all = Array.from({ length: g.c1 - g.c0 + 1 }, (_, i) => g.c0 + i);
  const [head, setHead] = useState(head0);
  const [cols, setCols] = useState<number[]>(all);
  const toggle = (c: number) => setCols((xs) => (xs.includes(c) ? xs.filter((x) => x !== c) : [...xs, c].sort((a, b) => a - b)));
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="print-dlg list-dlg paste-special dedupe-dlg"
        role="dialog"
        aria-label="Elimină dublurile"
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}
      >
        <h3>Elimină rândurile care se repetă</h3>
        <p className="print-info">Zona {cellId(g.r0, g.c0)}:{cellId(g.r1, g.c1)}. Rămâne primul rând din fiecare grup; celelalte se șterg, iar rândurile de sub ele urcă. Literele mari și mici nu contează.</p>
        <label className="print-check"><input type="checkbox" checked={head} onChange={(e) => setHead(e.target.checked)} /> Primul rând e cap de tabel (nu se șterge)</label>
        <fieldset>
          <legend>Se compară coloanele</legend>
          <div className="dedupe-cols">
            {all.map((c) => (
              <label key={c} className="print-check">
                <input type="checkbox" checked={cols.includes(c)} onChange={() => toggle(c)} /> {head && label(c) ? `${label(c)} (${colName(c)})` : `Coloana ${colName(c)}`}
              </label>
            ))}
          </div>
          <button onClick={() => setCols(cols.length === all.length ? [] : all)}>{cols.length === all.length ? 'Niciuna' : 'Toate'}</button>
        </fieldset>
        <div className="print-actions">
          <button onClick={onClose}>Anulează</button>
          <button className="primary" disabled={!cols.length} onClick={() => onOk(cols, head)}>Elimină dublurile</button>
        </div>
      </div>
    </div>
  );
}

function GotoSpecialDialog({ onGo, onClose }: { onGo(k: SpecialKind, t: ValueType[]): void; onClose(): void }) {
  const [kind, setKind] = useState<SpecialKind>('blanks');
  const [types, setTypes] = useState<ValueType[]>(['num', 'text', 'bool', 'err']);
  const go = () => onGo(kind, types);
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="print-dlg list-dlg goto-special"
        role="dialog"
        aria-label="Mergi la special"
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); onClose(); }
          else if (e.key === 'Enter') { e.preventDefault(); go(); }
        }}
      >
        <h3>Mergi la special</h3>
        <fieldset>
          <legend>Selectează</legend>
          {SPECIAL_KINDS.map(([v, label], i) => (
            <label key={v} className="print-check">
              <input type="radio" name="gs-kind" autoFocus={i === 0} checked={kind === v} onChange={() => setKind(v)} /> {label}
            </label>
          ))}
        </fieldset>
        <fieldset disabled={kind !== 'constants' && kind !== 'formulas'}>
          <legend>La valori și formule: ce fel</legend>
          {VALUE_TYPES.map(([v, label]) => (
            <label key={v} className="print-check">
              <input type="checkbox" checked={types.includes(v)} onChange={(e) => setTypes((t) => (e.target.checked ? [...t, v] : t.filter((x) => x !== v)))} /> {label}
            </label>
          ))}
        </fieldset>
        <p className="print-info">Cu o singură celulă selectată se caută în toată foaia; cu o zonă selectată, doar în ea.</p>
        <div className="print-actions">
          <button onClick={onClose}>Anulează</button>
          <button className="primary" onClick={go}>Selectează</button>
        </div>
      </div>
    </div>
  );
}

function PasteSpecialDialog({ onPaste, onClose }: { onPaste(o: PasteOpts): void; onClose(): void }) {
  const [what, setWhat] = useState<PasteWhat>('values');
  const [op, setOp] = useState<PasteOp>('none');
  const [transpose, setTranspose] = useState(false);
  const [skipBlanks, setSkipBlanks] = useState(false);
  const go = () => onPaste({ what, op, transpose, skipBlanks });
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="print-dlg list-dlg paste-special"
        role="dialog"
        aria-label="Lipire specială"
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); onClose(); }
          else if (e.key === 'Enter') { e.preventDefault(); go(); }
        }}
      >
        <h3>Lipire specială</h3>
        <fieldset>
          <legend>Ce lipești</legend>
          {PASTE_WHAT.map(([v, label], i) => (
            <label key={v} className="print-check">
              <input type="radio" name="ps-what" autoFocus={i === 1} checked={what === v} onChange={() => setWhat(v)} /> {label}
            </label>
          ))}
        </fieldset>
        <fieldset disabled={what === 'formats'}>
          <legend>Operație cu ce e deja în celule</legend>
          {PASTE_OPS.map(([v, label]) => (
            <label key={v} className="print-check">
              <input type="radio" name="ps-op" checked={op === v} onChange={() => setOp(v)} /> {label}
            </label>
          ))}
        </fieldset>
        <label className="print-check"><input type="checkbox" checked={skipBlanks} onChange={(e) => setSkipBlanks(e.target.checked)} /> Sari peste celulele goale</label>
        <label className="print-check"><input type="checkbox" checked={transpose} onChange={(e) => setTranspose(e.target.checked)} /> Transpune (rândurile devin coloane)</label>
        <p className="print-info">Se lipește ce ai copiat ultima dată din tabel, începând cu celula selectată.</p>
        <div className="print-actions">
          <button onClick={onClose}>Anulează</button>
          <button className="primary" onClick={go}>Lipește</button>
        </div>
      </div>
    </div>
  );
}

function LinkDialog({ cell, current, text: text0, onSave, onClose }: {
  cell: string; current: string; text: string; onSave(url: string, text: string): void; onClose(): void;
}) {
  const [url, setUrl] = useState(current);
  const [text, setText] = useState(text0);
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="print-dlg list-dlg"
        role="dialog"
        aria-label="Legătură"
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); onClose(); }
          else if (e.key === 'Enter') { e.preventDefault(); onSave(url, text); }
        }}
      >
        <h3>Legătură pe celula {cell}</h3>
        <label>Adresa{' '}
          <input className="print-hf" aria-label="Adresa legăturii" autoFocus value={url} placeholder="www.exemplu.ro, nume@exemplu.ro sau #Foaia 1!A1" onChange={(e) => setUrl(e.target.value)} />
        </label>
        <label>Textul din celulă{' '}
          <input className="print-hf" aria-label="Textul legăturii" value={text} placeholder="(rămâne ce e în celulă)" onChange={(e) => setText(e.target.value)} />
        </label>
        <p className="print-info">Ctrl+clic pe celulă deschide legătura: paginile web și e-mailurile în programul lor, locurile din tabel aici.</p>
        <div className="print-actions">
          {current && <button onClick={() => onSave('', '')}>Scoate legătura</button>}
          <button onClick={onClose}>Anulează</button>
          <button className="primary" onClick={() => onSave(url, text)}>Gata</button>
        </div>
      </div>
    </div>
  );
}

function NoteDialog({ cell, current, onSave, onClose }: {
  cell: string; current: string; onSave(text: string): void; onClose(): void;
}) {
  const [text, setText] = useState(current);
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="print-dlg list-dlg"
        role="dialog"
        aria-label="Notă pe celulă"
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); onClose(); }
          else if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); onSave(text); }
        }}
      >
        <h3>Notă pe celula {cell}</h3>
        <p className="print-info">Nota apare când treci cu mouse-ul peste celulă. Celulele cu notă au un triunghi roșu în colț.</p>
        <textarea
          autoFocus
          rows={6}
          maxLength={MAX_NOTE}
          value={text}
          placeholder="De exemplu: plătit parțial, restul în martie"
          onChange={(e) => setText(e.target.value)}
        />
        <p className="print-info">Ctrl+Enter salvează.</p>
        <div className="print-actions">
          {current && <button onClick={() => onSave('')}>Șterge nota</button>}
          <button onClick={onClose}>Anulează</button>
          <button className="primary" onClick={() => onSave(text)}>Gata</button>
        </div>
      </div>
    </div>
  );
}

const codeName = (k: CodeKind) => (k === 'cui' ? 'CUI' : k.toUpperCase());

type ValKind = 'list' | 'any' | CodeKind | RuleType;

function ListDialog({ range, current, onSave, onClose }: {
  range: string; current: SheetList | null;
  onSave(values: string[], kind?: CodeKind, extra?: { rule?: ValRule; prompt?: ValMsg; error?: ValError }): void; onClose(): void;
}) {
  const [text, setText] = useState((current?.values ?? []).join('\n'));
  const [kind, setKind] = useState<ValKind>(current?.kind ?? current?.rule?.type ?? (current && !current.values.length ? 'any' : 'list'));
  const r0 = current?.rule;
  const show = (x: number | undefined) => (x === undefined ? '' : r0?.type === 'date' ? serialToDate(x) : formatNumber(x));
  const [op, setOp] = useState<RuleOp>(r0?.op ?? 'between');
  const [aText, setA] = useState(show(r0?.a));
  const [bText, setB] = useState(show(r0?.b));
  const [fText, setF] = useState(r0?.type === 'custom' ? '=' + (r0.f ?? '') : '=');
  const [pTitle, setPTitle] = useState(current?.prompt?.title ?? '');
  const [pText, setPText] = useState(current?.prompt?.text ?? '');
  const [eStyle, setEStyle] = useState<ErrStyle>(current?.error?.style ?? 'stop');
  const [eTitle, setETitle] = useState(current?.error?.title ?? '');
  const [eText, setEText] = useState(current?.error?.text ?? '');
  const values = parseValues(text);
  const isRule = kind === 'whole' || kind === 'decimal' || kind === 'date' || kind === 'length';
  const isCustom = kind === 'custom';
  const isCode = CODE_KINDS.some(([k]) => k === kind);
  const two = op === 'between' || op === 'notBetween';
  const num = (s: string) => {
    if (kind === 'date') return dateToSerial(s.trim()) ?? NaN;
    const x = s.trim().replace(/\s/g, '');
    return x ? Number(x.includes(',') ? x.replace(/\./g, '').replace(',', '.') : x) : NaN;
  };
  const okNum = (s: string) => Number.isFinite(num(s)) && (kind !== 'length' || (Number.isInteger(num(s)) && num(s) >= 0));
  const ruleErr = !isRule ? null : !okNum(aText) || (two && !okNum(bText))
    ? (kind === 'date' ? 'Scrie data ca 17.10.2026.' : kind === 'length' ? 'Lungimea e un număr întreg de caractere (0, 1, 2…).' : 'Scrie un număr.')
    : null;
  const save = () => {
    if (ruleErr) return;
    if (isCustom && !fText.trim().replace(/^=/, '')) return;
    const prompt = pText.trim() ? { text: pText.trim(), ...(pTitle.trim() ? { title: pTitle.trim() } : {}) } : undefined;
    const error: ValError = { style: eStyle, ...(eTitle.trim() ? { title: eTitle.trim() } : {}), ...(eText.trim() ? { text: eText.trim() } : {}) };
    if (isCustom) onSave([], undefined, { rule: { type: 'custom', op: 'between', a: 0, f: fText.trim().replace(/^=/, '') }, prompt, error });
    else if (isRule) onSave([], undefined, { rule: { type: kind as RuleType, op, a: num(aText), ...(two ? { b: num(bText) } : {}) }, prompt, error });
    else if (isCode) onSave([], kind as CodeKind, { prompt, error });
    else if (kind === 'any') onSave([], undefined, { prompt });
    else onSave(values, undefined, { prompt, error });
  };
  const hint = kind === 'date' ? 'de exemplu 01.01.2026' : kind === 'length' ? 'de exemplu 10' : 'de exemplu 1';
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="print-dlg list-dlg"
        role="dialog"
        aria-label="Validarea datelor"
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}
      >
        <h3>Ce se poate scrie în {range}</h3>
        <label className="print-info">
          Se primesc:{' '}
          <select value={kind} onChange={(e) => setKind(e.target.value as ValKind)} aria-label="Ce se primește">
            <option value="list">doar valorile din listă</option>
            {RULE_TYPES.map(([k, label]) => <option key={k} value={k}>{k === 'length' ? 'text cu lungimea…' : k === 'custom' ? 'doar ' + label + '…' : 'doar ' + label}</option>)}
            {CODE_KINDS.map(([k, label]) => <option key={k} value={k}>doar coduri {label} corecte</option>)}
            <option value="any">orice valoare (doar mesaj)</option>
          </select>
        </label>
        {isRule && (
          <div className="series-grid val-rule">
            <span>{kind === 'length' ? 'Lungimea' : 'Valoarea'}</span>
            <select value={op} onChange={(e) => setOp(e.target.value as RuleOp)} aria-label="Condiția">
              {RULE_OPS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
            <span>{two ? 'De la' : 'Valoarea'}</span>
            <input type="text" value={aText} onChange={(e) => setA(e.target.value)} placeholder={hint} aria-label="Prima valoare" autoFocus />
            {two && (<>
              <span>Până la</span>
              <input type="text" value={bText} onChange={(e) => setB(e.target.value)} placeholder={kind === 'date' ? 'de exemplu 31.12.2026' : 'de exemplu 10'} aria-label="A doua valoare" />
            </>)}
          </div>
        )}
        {isCustom && (
          <>
            <p className="print-info">Formula e scrisă pentru prima celulă a zonei și se mută pentru celelalte, ca la copiere. Valoarea se primește când formula dă ADEVĂRAT, de exemplu <b>=ȘI(A2&gt;0;A2&lt;=B2)</b> sau <b>=COUNTIF($A:$A;A2)=1</b> (fără dubluri).</p>
            <input type="text" value={fText} onChange={(e) => setF(e.target.value)} placeholder="=A2>0" aria-label="Formula regulii" autoFocus />
          </>
        )}
        {isRule && ruleErr && (aText || bText) && <p className="print-warn" role="alert">{ruleErr}</p>}
        {isCode && (
          <p className="print-info">
            Un {codeName(kind as CodeKind)} scris greșit (o cifră schimbată sau lipsă) nu se primește în celulă, iar jos apare de ce.
            Se verifică doar cifra de control, nu dacă {kind === 'cnp' ? 'persoana' : kind === 'cui' ? 'firma' : 'contul'} există.
          </p>
        )}
        {kind === 'list' && (
          <>
            <p className="print-info">Scrie valorile permise, câte una pe rând. În celule se va putea alege doar dintre ele.</p>
            <textarea
              autoFocus
              rows={6}
              value={text}
              placeholder={'Încasat\nNeîncasat\nParțial'}
              onChange={(e) => setText(e.target.value)}
            />
            <p className="print-info">
              {values.length ? `${values.length} ${values.length === 1 ? 'valoare' : 'valori'}` : 'Fără valori, lista se scoate din celulele selectate.'}
            </p>
          </>
        )}
        <details className="val-msg" open={!!current?.prompt || kind === 'any'}>
          <summary>Mesaj când selectezi celula</summary>
          <input type="text" value={pTitle} maxLength={32} onChange={(e) => setPTitle(e.target.value)} placeholder="Titlu (opțional)" aria-label="Titlul mesajului" />
          <textarea rows={2} value={pText} maxLength={255} onChange={(e) => setPText(e.target.value)} placeholder="de exemplu: Scrie suma în lei, fără TVA" aria-label="Mesajul la selectare" />
        </details>
        {kind !== 'any' && (
          <details className="val-msg" open={!!current?.error}>
            <summary>Când valoarea e greșită</summary>
            <select value={eStyle} onChange={(e) => setEStyle(e.target.value as ErrStyle)} aria-label="Felul mesajului de eroare">
              {ERR_STYLES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
            <input type="text" value={eTitle} maxLength={32} onChange={(e) => setETitle(e.target.value)} placeholder="Titlu (opțional)" aria-label="Titlul erorii" />
            <textarea rows={2} value={eText} maxLength={255} onChange={(e) => setEText(e.target.value)} placeholder="Mesaj propriu (opțional)" aria-label="Mesajul de eroare" />
          </details>
        )}
        <div className="print-actions">
          {current && <button onClick={() => onSave([])}>{current.kind || current.rule ? 'Scoate verificarea' : 'Scoate lista'}</button>}
          <button onClick={onClose}>Anulează</button>
          <button className="primary" disabled={!!ruleErr} onClick={save}>Gata</button>
        </div>
      </div>
    </div>
  );
}

// Lista deschisă din ▾: săgețile mută alegerea, Enter alege, Esc închide.
function ListPick({ x, y, values, current, onChoose, onClose }: {
  x: number; y: number; values: string[]; current: string; onChoose(v: string): void; onClose(): void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close.current(); };
    window.addEventListener('mousedown', down);
    const btns = ref.current?.querySelectorAll('button');
    const at = values.findIndex((v) => v === current);
    (btns?.[at >= 0 ? at + 1 : 1] ?? btns?.[0])?.focus();
    return () => window.removeEventListener('mousedown', down);
  }, []);
  const top = Math.min(y, window.innerHeight - Math.min(260, 30 + values.length * 28) - 8);
  return (
    <div
      className="filter-menu list-pick"
      ref={ref}
      role="listbox"
      style={{ left: Math.min(x, window.innerWidth - 220), top: Math.max(8, top) }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        const btns = [...(ref.current?.querySelectorAll('button') ?? [])];
        const i = btns.indexOf(document.activeElement as HTMLButtonElement);
        btns[Math.max(0, Math.min(btns.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
      }}
    >
      <button className="list-clear" onClick={() => onChoose('')}>(golește celula)</button>
      {values.map((v) => (
        <button key={v} role="option" aria-selected={v === current} className={v === current ? 'on' : ''} onClick={() => onChoose(v)}>
          {v}
        </button>
      ))}
    </div>
  );
}

// Redenumirea unei file direct pe ea: Enter păstrează numele (dacă e bun), Esc renunță.
interface SheetFindProps {
  mode: 'find' | 'replace';
  tick: number;
  onMode(mode: 'find' | 'replace'): void;
  cells: Cells;
  results: Results;
  styles: Styles;
  hidden: Set<number>;
  sel: Pos;
  sheets: Sheet[];
  active: number;
  /** Valorile calculate ale unei alte foi (pentru căutarea în tot registrul). */
  bookOf(sh: Sheet): Results;
  onGo(p: Pos, sheet?: number): void;
  onApply(patch: Cells, n: number): void;
  onApplyBook(sheets: Sheet[], n: number): void;
  onClose(): void;
}

// Căutare și înlocuire: Enter duce la următoarea celulă găsită, Shift+Enter la cea dinainte.
// Opțiunile (⚙): toată celula, unde se caută (formule / valori) și în ce foi (foaia curentă sau tot registrul).
function SheetFind({ mode, tick, onMode, cells, results, styles, hidden, sel, sheets, active, bookOf, onGo, onApply, onApplyBook, onClose }: SheetFindProps) {
  const [q, setQ] = useState('');
  const [repl, setRepl] = useState('');
  const [matchCase, setCase] = useState(false);
  const [whole, setWhole] = useState(false);
  const [lookIn, setLookIn] = useState<'all' | 'formulas' | 'values'>('all');
  const [book, setBook] = useState(false);
  const [more, setMore] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const opts: FindOpts = { matchCase, whole, lookIn };
  // Valorile celorlalte foi se calculează doar când cauți în tot registrul.
  const others = useMemo(() => (book ? sheets.map((sh, i) => (i === active || sh.hidden ? null : bookOf(sh))) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [book, sheets, active]);
  const matches = useMemo(() => {
    const here = (s: number) => findCells(cells, results, styles, q, opts, hidden).map((p) => ({ ...p, s }));
    if (!book) return here(active);
    const out: (Pos & { s: number })[] = [];
    sheets.forEach((sh, i) => {
      if (i === active) { out.push(...here(i)); return; }
      const res = others[i];
      if (!res) return;
      const hid = new Set((sh.hideRows ?? []).map((k) => k - 1));
      out.push(...findCells(sh.cells, res, sh.styles, q, opts, hid).map((p) => ({ ...p, s: i })));
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cells, results, styles, q, matchCase, whole, lookIn, hidden, book, others, sheets, active]);
  const cur = matches.findIndex((m) => m.s === active && m.r === sel.r && m.c === sel.c);
  useEffect(() => { input.current?.focus(); input.current?.select(); }, [tick]);

  // Următoarea (sau precedenta) celulă găsită, pornind de la cursor.
  const nextFrom = (d: 1 | -1) => {
    const n = matches.length;
    if (!n) return -1;
    if (cur >= 0) return (cur + d + n) % n;
    const after = matches.findIndex((m) => m.s > active || (m.s === active && (m.r > sel.r || (m.r === sel.r && m.c > sel.c))));
    if (d > 0) return after >= 0 ? after : 0;
    const before = after >= 0 ? after - 1 : n - 1;
    return before >= 0 ? before : n - 1;
  };
  const go = (d: 1 | -1) => { const i = nextFrom(d); if (i >= 0) onGo(matches[i], matches[i].s); };
  const replaceOne = () => {
    if (cur < 0) { go(1); return; }
    const id = cellId(sel.r, sel.c);
    const { text, n } = replaceText(cells[id] ?? '', q, repl, opts);
    const next = matches.length > 1 ? matches[(cur + 1) % matches.length] : null;
    onApply(n ? { [id]: text } : {}, n);
    if (next) onGo(next, next.s);
  };
  const replaceAll = () => {
    if (book) {
      // În tot registrul: un singur pas de anulare; pe foile protejate se sar celulele blocate.
      let total = 0;
      const next = sheets.map((sh, i) => {
        const mine = matches.filter((m) => m.s === i);
        if (!mine.length) return sh;
        const src = i === active ? cells : sh.cells;
        const nc = { ...src };
        const n0 = total;
        for (const m of mine) {
          const id = cellId(m.r, m.c);
          if (sh.protect && !sh.styles[id]?.unlock) continue;
          const { text, n } = replaceText(src[id] ?? '', q, repl, opts);
          if (n) { if (text === '') delete nc[id]; else nc[id] = text; total += n; }
        }
        return total === n0 ? sh : { ...sh, cells: nc };
      });
      onApplyBook(next, total);
      return;
    }
    const patch: Cells = {};
    let total = 0;
    for (const m of matches) {
      const id = cellId(m.r, m.c);
      const { text, n } = replaceText(cells[id] ?? '', q, repl, opts);
      if (n) { patch[id] = text; total += n; }
    }
    onApply(patch, total);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') { e.preventDefault(); go(e.shiftKey ? -1 : 1); }
  };

  return (
    <div className="searchbar" onKeyDown={onKey}>
      <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Caută în foaie" aria-label="Caută în foaie" />
      <span className="muted search-count">
        {q ? (matches.length ? `${cur >= 0 ? `${cur + 1} din ` : ''}${matches.length} ${matches.length === 1 ? 'celulă' : 'celule'}` : 'Nimic găsit') : ''}
      </span>
      <button className="fmt" onClick={() => go(-1)} disabled={!matches.length} title="Anterior (Shift+Enter)">↑</button>
      <button className="fmt" onClick={() => go(1)} disabled={!matches.length} title="Următor (Enter)">↓</button>
      <label className="search-case" title="Ține cont de literele mari și mici și de diacritice">
        <input type="checkbox" checked={matchCase} onChange={(e) => setCase(e.target.checked)} /> Aa
      </label>
      <button className={`fmt${more || whole || lookIn !== 'all' || book ? ' on' : ''}`} onClick={() => setMore((v) => !v)}
        title="Opțiuni de căutare: toată celula, în formule sau în valori, în tot registrul. În text, * ține locul oricâtor litere, ? al uneia (~* caută chiar steluța)"
        aria-expanded={more}>⚙</button>
      {more && (
        <span className="search-more">
          <label className="search-case" title="Doar celulele în care textul întreg e cel căutat">
            <input type="checkbox" checked={whole} onChange={(e) => setWhole(e.target.checked)} /> Toată celula
          </label>
          <select className="fmt" value={lookIn} onChange={(e) => setLookIn(e.target.value as typeof lookIn)} aria-label="Caută în" title="Caută în">
            <option value="all">În formule și valori</option>
            <option value="formulas">Doar în formule</option>
            <option value="values">Doar în valori</option>
          </select>
          <select className="fmt" value={book ? 'book' : 'sheet'} onChange={(e) => setBook(e.target.value === 'book')} aria-label="În ce foi" title="În ce foi">
            <option value="sheet">Foaia aceasta</option>
            <option value="book">Tot registrul</option>
          </select>
        </span>
      )}
      {mode === 'replace' ? (
        <>
          <span className="sep" />
          <input value={repl} onChange={(e) => setRepl(e.target.value)} placeholder="Înlocuiește cu" aria-label="Înlocuiește cu" />
          <button className="fmt" onClick={replaceOne} disabled={!matches.length}>Înlocuiește</button>
          <button className="fmt" onClick={replaceAll} disabled={!matches.length}>Înlocuiește tot</button>
        </>
      ) : (
        <button className="fmt" onClick={() => onMode('replace')}>Înlocuire…</button>
      )}
      <button className="fmt search-close" onClick={onClose} title="Închide (Esc)">✕</button>
    </div>
  );
}

function TabRename({ name, onDone, onCancel }: { name: string; onDone(name: string): boolean; onCancel(): void }) {
  const [v, setV] = useState(name);
  const done = useRef(false);
  const finish = (cancel: boolean) => {
    if (done.current) return;
    if (cancel) { done.current = true; onCancel(); return; }
    if (onDone(v)) done.current = true;
  };
  return (
    <input
      className="sheet-tab-edit"
      autoFocus
      aria-label="Numele foii"
      value={v}
      maxLength={31}
      size={Math.max(6, v.length + 1)}
      onFocus={(e) => e.target.select()}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); finish(false); }
        else if (e.key === 'Escape') { e.preventDefault(); finish(true); }
      }}
      onBlur={() => { finish(false); finish(true); }}
    />
  );
}

interface TabMenuProps {
  x: number;
  y: number;
  first: boolean;
  last: boolean;
  only: boolean;
  /** E singura foaie vizibilă (nu se poate ascunde). */
  lastVisible: boolean;
  /** Culoarea filei, dacă are. */
  color?: string;
  /** Foile ascunse (poziția și numele). */
  hidden: { i: number; name: string }[];
  onColor(color: string | undefined): void;
  onHide(): void;
  onUnhide(i: number): void;
  onRename(): void;
  onInsert(): void;
  /** Numele tuturor foilor și poziția celei cu meniul (pentru Mutare sau copiere). */
  names: string[];
  index: number;
  onPlace(before: number, copy: boolean): void;
  protectedSheet: boolean;
  onProtect(): void;
  onDelete(): void;
  onClose(): void;
}

interface HeadMenuProps {
  x: number;
  y: number;
  axis: Axis;
  /** Primul și ultimul rând (sau coloană) selectat. */
  a: number;
  b: number;
  onAction(axis: Axis, at: number, n: number): void;
  /** Decupare / Copiere / Lipire, Golire conținut, Formatare celule…, Înălțime rând… / Lățime coloană… (ca la clic dreapta pe cap în programul cunoscut). */
  onClip(cmd: 'cut' | 'copy' | 'paste'): void;
  onClear(): void;
  onFormat(): void;
  onSize(): void;
  /** În selecție sunt rânduri ascunse (apare „Afișează”). */
  hiddenIn: boolean;
  onHide(hide: boolean): void;
  /** În selecție sunt rânduri grupate (apare „Degrupează”). */
  grouped: boolean;
  onGroup(by: 1 | -1): void;
  onClose(): void;
}

function HeadMenu({ x, y, axis, a, b, onAction, hiddenIn, onHide, grouped, onGroup, onClip, onClear, onFormat, onSize, onClose }: HeadMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close.current(); };
    window.addEventListener('mousedown', down);
    ref.current?.querySelector('button')?.focus();
    return () => window.removeEventListener('mousedown', down);
  }, []);
  const n = b - a + 1;
  const name = (i: number) => (axis === 'r' ? String(i + 1) : colName(i));
  const which = n === 1 ? name(a) : `${name(a)}–${name(b)}`;
  const unit = axis === 'r' ? (n === 1 ? 'un rând' : `${n} rânduri`) : (n === 1 ? 'o coloană' : `${n} coloane`);
  return (
    <div
      className="filter-menu tab-menu head-menu"
      ref={ref}
      style={{ left: Math.min(x, window.innerWidth - 260), top: Math.max(4, Math.min(y, window.innerHeight - 380)) }}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}
    >
      <button onClick={() => onClip('cut')}>Decupare (Ctrl+X)</button>
      <button onClick={() => onClip('copy')}>Copiere (Ctrl+C)</button>
      <button onClick={() => onClip('paste')}>Lipire (Ctrl+V)</button>
      <hr />
      <button onClick={() => onAction(axis, a, n)}>Inserează {unit} {axis === 'r' ? 'deasupra' : 'la stânga'}</button>
      <button onClick={() => onAction(axis, b + 1, n)}>Inserează {unit} {axis === 'r' ? 'dedesubt' : 'la dreapta'}</button>
      <button onClick={() => onAction(axis, a, -n)}>Șterge {axis === 'r' ? (n === 1 ? 'rândul' : 'rândurile') : (n === 1 ? 'coloana' : 'coloanele')} {which}</button>
      <button onClick={onClear}>Golire conținut</button>
      <hr />
      <button onClick={onFormat}>Formatare celule… (Ctrl+1)</button>
      <button onClick={onSize}>{axis === 'r' ? 'Înălțime rând…' : 'Lățime coloană…'}</button>
      <button onClick={() => onHide(true)}>Ascundere {axis === 'r' ? (n === 1 ? 'rândul' : 'rândurile') : (n === 1 ? 'coloana' : 'coloanele')} {which} ({axis === 'r' ? 'Ctrl+9' : 'Ctrl+0'})</button>
      {hiddenIn && <button onClick={() => onHide(false)}>Reafișare {axis === 'r' ? 'rânduri ascunse (Ctrl+Shift+9)' : 'coloane ascunse (Ctrl+Shift+0)'}</button>}
      <button onClick={() => onGroup(1)}>⊞ Grupează {axis === 'r' ? (n === 1 ? 'rândul' : 'rândurile') : (n === 1 ? 'coloana' : 'coloanele')} {which} (Shift+Alt+→)</button>
      {grouped && <button onClick={() => onGroup(-1)}>Degrupează (Shift+Alt+←)</button>}
    </div>
  );
}

// Liste proprii: câte una pe rând, valorile despărțite prin virgulă (ca Opțiuni → Liste particularizate).
const LISTS_KEY = 'suite.sheets.lists';
// Listele proprii se încarcă o dată, la prima deschidere a modulului.
try { setCustomLists(JSON.parse(localStorage.getItem(LISTS_KEY) ?? '[]')); } catch { /* fără setări sau setări stricate */ }

function ListsDialog({ onSave, onClose }: { onSave(l: string[][]): void; onClose(): void }) {
  const [text, setText] = useState(() => listsText(customLists()));
  const parsed = parseLists(text);
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg series-dlg" role="dialog" aria-label="Liste proprii" onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}>
        <h3>Liste proprii</h3>
        <p className="print-info">Câte o listă pe rând, cu valorile despărțite prin virgulă. Scrii într-o celulă o valoare din listă, tragi de colțul ei
          și urmează celelalte, în ordine (ca la zilele săptămânii și la luni, care sunt deja știute).</p>
        <textarea className="lists-text" value={text} onChange={(e) => setText(e.target.value)} rows={8} autoFocus aria-label="Listele proprii"
          placeholder={`Nord, Sud, Est, Vest
Mic, Mediu, Mare
Ana, Ion, Maria`} />
        <p className="print-info">{parsed.length ? `${parsed.length} ${parsed.length === 1 ? 'listă' : 'liste'} (o listă are nevoie de cel puțin două valori).` : 'Nicio listă încă.'}</p>
        <div className="print-actions">
          <button onClick={onClose}>Renunță</button>
          <button className="primary" onClick={() => onSave(parsed)}>Păstrează</button>
        </div>
      </div>
    </div>
  );
}

function SeriesDialog({ down: down0, date, zone, onRun, onClose }: {
  down: boolean; date: boolean; zone: string | null; onRun(down: boolean, o: SeriesOpts): void; onClose(): void;
}) {
  const [down, setDown] = useState(down0);
  const [type, setType] = useState<SeriesType>(date ? 'date' : 'linear');
  const [unit, setUnit] = useState<DateUnit>('day');
  const [step, setStep] = useState('1');
  const [stop, setStop] = useState('');
  const num = (s: string) => Number(s.trim().replace(',', '.'));
  const stepOk = step.trim() !== '' && Number.isFinite(num(step)) && (type !== 'growth' || num(step) > 0);
  const stopOk = stop.trim() === '' || Number.isFinite(num(stop));
  const run = () => { if (stepOk && stopOk) onRun(down, { type, unit, step: num(step), ...(stop.trim() ? { stop: num(stop) } : {}) }); };
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg series-dlg" role="dialog" aria-label="Serie"
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } else if (e.key === 'Enter' && e.target instanceof HTMLInputElement && e.target.type === 'text') { e.preventDefault(); run(); } }}>
        <h3>Umplere cu serie</h3>
        <p className="print-info">{zone ? <>Pornește din prima celulă a zonei <b>{zone}</b>.</> : <>Pornește din celula selectată; scrie o valoare de oprire ca să știu până unde.</>}</p>
        <div className="series-grid">
          <span>Direcția</span>
          <span>
            <label><input type="radio" checked={down} onChange={() => setDown(true)} /> În jos (pe coloane)</label>
            <label><input type="radio" checked={!down} onChange={() => setDown(false)} /> La dreapta (pe rânduri)</label>
          </span>
          <span>Tipul</span>
          <span>
            <label><input type="radio" checked={type === 'linear'} onChange={() => setType('linear')} /> Liniară (+pas)</label>
            <label><input type="radio" checked={type === 'growth'} onChange={() => setType('growth')} /> Creștere (×pas)</label>
            <label><input type="radio" checked={type === 'date'} onChange={() => setType('date')} /> Dată</label>
          </span>
          {type === 'date' && (<>
            <span>Pe</span>
            <select value={unit} onChange={(e) => setUnit(e.target.value as DateUnit)} aria-label="Unitatea de dată">
              <option value="day">zile</option>
              <option value="weekday">zile lucrătoare (fără sâmbătă și duminică)</option>
              <option value="month">luni</option>
              <option value="year">ani</option>
        </select>
          </>)}
          <span>Pasul</span>
          <input type="text" value={step} onChange={(e) => setStep(e.target.value)} aria-label="Pasul" autoFocus />
          <span>Oprire la</span>
          <input type="text" value={stop} onChange={(e) => setStop(e.target.value)} placeholder={zone ? '(capătul zonei)' : 'de exemplu 100'} aria-label="Valoarea de oprire" />
        </div>
        {!stepOk && <p className="print-warn">{type === 'growth' ? 'La creștere, pasul trebuie să fie un număr mai mare ca 0.' : 'Pasul trebuie să fie un număr.'}</p>}
        <div className="print-actions">
          <button onClick={onClose}>Renunță</button>
          <button className="primary" disabled={!stepOk || !stopOk} onClick={run}>Umple</button>
        </div>
      </div>
    </div>
  );
}

// Fereastra Subtotal: coloana de grupare, funcția și coloanele care primesc subtotal; „Elimină tot” le scoate.
function SubtotalDialog({ g, col, has, label, numeric, onRun, onClose }: {
  g: Range; col: number; has: boolean; label(c: number): string; numeric(c: number): boolean; onRun(o: SubtotalOpts | null): void; onClose(): void;
}) {
  const cols: number[] = [];
  for (let c = g.c0; c <= g.c1; c++) cols.push(c);
  const [groupCol, setGroupCol] = useState(col);
  const [fn, setFn] = useState(9);
  const [pick, setPick] = useState<number[]>(() => {
    const nums = cols.filter((c) => c !== col && numeric(c));
    return nums.length ? [nums[nums.length - 1]] : cols.filter((c) => c !== col).slice(-1);
  });
  const toggle = (c: number) => setPick((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c].sort((a, b) => a - b)));
  const chosen = pick.filter((c) => c !== groupCol);
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg sort-dlg" role="dialog" aria-label="Subtotal" onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}>
        <h3>Subtotal</h3>
        <p className="print-info">Tabelul <b>{cellId(g.r0, g.c0)}:{cellId(g.r1, g.c1)}</b>; primul rând e capul de tabel. Sortează-l întâi după coloana de grupare.</p>
        <div className="series-grid">
          <span>La fiecare schimbare în</span>
          <select value={groupCol} onChange={(e) => setGroupCol(Number(e.target.value))} aria-label="Coloana de grupare">
            {cols.map((c) => <option key={c} value={c}>{label(c)}</option>)}
          </select>
          <span>Funcția</span>
          <select value={fn} onChange={(e) => setFn(Number(e.target.value))} aria-label="Funcția">
            {SUBTOTAL_FNS.map(([k, name]) => <option key={k} value={k}>{name}</option>)}
          </select>
          <span>Subtotal la</span>
          <span className="cells-modes sub-cols">
            {cols.filter((c) => c !== groupCol).map((c) => (
              <label key={c}><input type="checkbox" checked={pick.includes(c)} onChange={() => toggle(c)} /> {label(c)}</label>
            ))}
          </span>
        </div>
        <div className="print-actions">
          {has && <button onClick={() => onRun(null)}>Elimină tot</button>}
          <button onClick={onClose}>Renunță</button>
          <button className="primary" disabled={!chosen.length} onClick={() => onRun({ groupCol, fn, cols: chosen })}>OK</button>
        </div>
      </div>
    </div>
  );
}

type CellShift = 'down' | 'right' | 'row' | 'col';

// Fereastra Inserare / Ștergere celule: încotro se mută celelalte celule, sau rânduri / coloane întregi.
function CellsDialog({ del: del0, zone, wide, onRun, onClose }: {
  del: boolean; zone: string; wide: boolean; onRun(del: boolean, mode: CellShift): void; onClose(): void;
}) {
  const [del, setDel] = useState(del0);
  const [mode, setMode] = useState<CellShift>(wide ? 'down' : 'right');
  const opts: [CellShift, string][] = del
    ? [['down', 'Mută celulele în sus'], ['right', 'Mută celulele la stânga'], ['row', 'Rândul întreg'], ['col', 'Coloana întreagă']]
    : [['down', 'Mută celulele în jos'], ['right', 'Mută celulele la dreapta'], ['row', 'Rândul întreg'], ['col', 'Coloana întreagă']];
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg series-dlg" role="dialog" aria-label={del ? 'Ștergere celule' : 'Inserare celule'}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } else if (e.key === 'Enter') { e.preventDefault(); onRun(del, mode); } }}>
        <h3>{del ? 'Ștergere celule' : 'Inserare celule'}</h3>
        <p className="print-info">Selecția: <b>{zone}</b></p>
        <div className="series-grid">
          <span>Ce faci</span>
          <span>
            <label><input type="radio" checked={!del} onChange={() => setDel(false)} /> Inserez</label>
            <label><input type="radio" checked={del} onChange={() => setDel(true)} /> Șterg</label>
          </span>
          <span>Cum</span>
          <span className="cells-modes">
            {opts.map(([k, label]) => (
              <label key={k}><input type="radio" name="cell-shift" checked={mode === k} onChange={() => setMode(k)} autoFocus={mode === k} /> {label}</label>
            ))}
          </span>
        </div>
        <div className="print-actions">
          <button onClick={onClose}>Renunță</button>
          <button className="primary" onClick={() => onRun(del, mode)}>{del ? 'Șterge' : 'Inserează'}</button>
        </div>
      </div>
    </div>
  );
}

// Fereastra 📈 Generare numere aleatoare: distribuția, câte variabile (coloane) și câte numere, parametrii și sămânța.
const RAND_DISTS: [RandOpts['dist'], string][] = [
  ['uniform', 'Uniformă'], ['normal', 'Normală'], ['bernoulli', 'Bernoulli'], ['binomial', 'Binomială'], ['poisson', 'Poisson'],
  ['patterned', 'După un model'], ['discrete', 'Discretă (din selecție)'],
];
function RandomDialog({ onRun, onClose }: { onRun(o: RandOpts, seed?: number): string | null; onClose(): void }) {
  const [dist, setDist] = useState<RandOpts['dist']>('uniform');
  const [f, setF] = useState<Record<string, string>>({ vars: '1', count: '10', ua: '0', ub: '1', nm: '0', ns: '1', bp: '0,5', bn: '10', pl: '1', from: '1', to: '10', step: '1', repNum: '1', repSeq: '1', seed: '' });
  const [err, setErr] = useState('');
  const n = (k: string) => (f[k].trim() === '' ? NaN : Number(f[k].trim().replace(',', '.')));
  const field = (k: string, label: string, title?: string) => (
    <>
      <span>{label}</span>
      <input value={f[k]} onChange={(e) => { setF({ ...f, [k]: e.target.value }); setErr(''); }} aria-label={label} title={title} size={10} />
    </>
  );
  const run = () => {
    const o: RandOpts = { dist, vars: n('vars'), count: n('count') };
    if (dist === 'uniform') { o.a = n('ua'); o.b = n('ub'); }
    else if (dist === 'normal') { o.a = n('nm'); o.b = n('ns'); }
    else if (dist === 'bernoulli') o.a = n('bp');
    else if (dist === 'binomial') { o.a = n('bp'); o.b = n('bn'); }
    else if (dist === 'poisson') o.a = n('pl');
    else if (dist === 'patterned') Object.assign(o, { from: n('from'), to: n('to'), step: n('step'), repNum: n('repNum'), repSeq: n('repSeq') });
    const seed = f.seed.trim() === '' ? undefined : n('seed');
    if (seed !== undefined && !Number.isFinite(seed)) { setErr('Sămânța trebuie să fie un număr (sau goală)'); return; }
    setErr(onRun(o, seed) ?? '');
  };
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg series-dlg" role="dialog" aria-label="Generare numere aleatoare"
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } else if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') { e.preventDefault(); run(); } }}>
        <h3>Generare numere aleatoare</h3>
        <p className="print-info">Numerele apar într-o foaie nouă, câte o coloană pe variabilă. Ctrl+Z o scoate.</p>
        <div className="series-grid">
          <span>Distribuția</span>
          <select value={dist} onChange={(e) => { setDist(e.target.value as RandOpts['dist']); setErr(''); }} aria-label="Distribuția" autoFocus>
            {RAND_DISTS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          {field('vars', 'Numărul de variabile', 'Câte coloane de numere')}
          {dist !== 'patterned' && field('count', 'Câte numere', 'Câte numere în fiecare coloană')}
          {dist === 'uniform' && <>{field('ua', 'Între')}{field('ub', 'și')}</>}
          {dist === 'normal' && <>{field('nm', 'Media')}{field('ns', 'Abaterea standard')}</>}
          {(dist === 'bernoulli' || dist === 'binomial') && field('bp', 'Probabilitatea (p)', 'Între 0 și 1: șansa unui „1” (a unei reușite)')}
          {dist === 'binomial' && field('bn', 'Numărul de încercări')}
          {dist === 'poisson' && field('pl', 'Media (λ)', 'Câte se întâmplă în medie (de exemplu clienți pe oră)')}
          {dist === 'patterned' && <>{field('from', 'De la')}{field('to', 'Până la')}{field('step', 'Pasul')}{field('repNum', 'Repetă fiecare număr (ori)')}{field('repSeq', 'Repetă șirul (ori)')}</>}
          {dist === 'discrete' && <><span /><span className="print-info">Valorile și probabilitățile lor (cu suma 1) se iau din primele două coloane ale selecției.</span></>}
          {field('seed', 'Sămânța (opțional)', 'Cu aceeași sămânță ies mereu aceleași numere; goală = de fiecare dată altele')}
        </div>
        {err && <p className="print-info" role="alert" style={{ color: 'var(--danger, #b42318)' }}>{err}</p>}
        <div className="print-actions">
          <button onClick={onClose}>Renunță</button>
          <button className="primary" onClick={run}>OK</button>
        </div>
      </div>
    </div>
  );
}

// Fereastra Căutare rezultat (Goal Seek): celula cu formula, valoarea dorită, celula care se schimbă; apoi Păstrează / Renunță.
type SolverModel = SheetSolver;
interface SolverRun { ok: boolean; msg: string; patch: Cells; obj: string; objText: string; report: (string | number)[][] }

// Fereastra 🧮 Rezolvitor: obiectivul (max / min / valoare), celulele schimbate, condițiile (rânduri cu celulă, semn, valoare).
function SolverDialog({ initial, run, onKeep, onClose }: {
  initial: SolverModel;
  run(m: SolverModel): string | SolverRun;
  onKeep(m: SolverModel, run: SolverRun, report: boolean): void; onClose(m: SolverModel): void;
}) {
  const [m, setM] = useState<SolverModel>(initial);
  const [withReport, setWithReport] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<SolverRun | null>(null);
  const upd = (p: Partial<SolverModel>) => { setM((o) => ({ ...o, ...p })); setErr(null); };
  const updCon = (i: number, p: Partial<SolverModel['cons'][number]>) => upd({ cons: m.cons.map((c, k) => (k === i ? { ...c, ...p } : c)) });
  const go = () => {
    if (res) { if (res.ok) onKeep(m, res, withReport && res.report.length > 0); return; }
    const r = run(m);
    if (typeof r === 'string') setErr(r); else setRes(r);
  };
  const opLabel: Record<SolverOp, string> = { '<=': '≤', '>=': '≥', '=': '=', int: 'întreg', bin: '0 sau 1' };
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(m); }}>
      <div className="print-dlg series-dlg" role="dialog" aria-label="Rezolvitor" style={{ maxWidth: 580 }}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(m); } else if (e.key === 'Enter' && e.target instanceof HTMLInputElement && e.target.type === 'text') { e.preventDefault(); go(); } }}>
        <h3>🧮 Rezolvitor</h3>
        {!res ? (<>
          <p className="print-info">Găsește valorile celulelor schimbate pentru care formula din celula obiectiv e cât mai mare, cât mai mică sau egală cu o valoare, respectând condițiile de mai jos.</p>
          <div className="series-grid">
            <span>Celula obiectiv</span>
            <input type="text" value={m.obj} onChange={(e) => upd({ obj: e.target.value })} placeholder="de exemplu D10" aria-label="Celula obiectiv" autoFocus />
            <span>Să fie</span>
            <span style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {(['max', 'min', 'value'] as SolverGoal[]).map((g) => (
                <label key={g}><input type="radio" name="solver-goal" value={g} checked={m.goal === g} onChange={() => upd({ goal: g })} /> {g === 'max' ? 'cât mai mare' : g === 'min' ? 'cât mai mică' : 'egală cu'}</label>
              ))}
              {m.goal === 'value' && <input type="text" value={m.target} onChange={(e) => upd({ target: e.target.value })} aria-label="Valoarea dorită" style={{ width: 90 }} />}
            </span>
            <span>Schimbând celulele</span>
            <input type="text" value={m.vars} onChange={(e) => upd({ vars: e.target.value })} placeholder="de exemplu B2:B4" aria-label="Celulele schimbate" />
          </div>
          <div style={{ margin: '8px 0 4px', fontWeight: 600 }}>Condiții</div>
          <div aria-label="Condițiile" style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflow: 'auto' }}>
            {!m.cons.length && <div className="print-info">Nicio condiție încă (de exemplu: B5 ≤ 100, sau B2:B4 întreg).</div>}
            {m.cons.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="text" value={c.l} onChange={(e) => updCon(i, { l: e.target.value })} placeholder="celula, de ex. B5" aria-label={`Condiția ${i + 1}: celula`} style={{ width: 120 }} />
                <select value={c.op} onChange={(e) => updCon(i, { op: e.target.value as SolverOp })} aria-label={`Condiția ${i + 1}: semnul`}>
                  {(Object.keys(opLabel) as SolverOp[]).map((o) => <option key={o} value={o}>{opLabel[o]}</option>)}
                </select>
                {c.op !== 'int' && c.op !== 'bin' && <input type="text" value={c.r} onChange={(e) => updCon(i, { r: e.target.value })} placeholder="număr sau celulă" aria-label={`Condiția ${i + 1}: valoarea`} style={{ width: 120 }} />}
                <button onClick={() => upd({ cons: m.cons.filter((_, k) => k !== i) })} title="Scoate condiția" aria-label={`Scoate condiția ${i + 1}`}>×</button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
            <button onClick={() => upd({ cons: [...m.cons, { l: '', op: '<=', r: '' }] })}>＋ Adaugă o condiție</button>
            <label><input type="checkbox" checked={m.nonneg} onChange={(e) => upd({ nonneg: e.target.checked })} /> Celulele schimbate să nu fie negative</label>
            <label title="Automată: exactă (simplex) când formulele sunt liniare, altfel căutare în pantă. Evolutivă: o populație de soluții care se amestecă, pentru formule cu salturi (condiții DACĂ, rotunjiri, căutări în tabele), unde căutarea în pantă rămâne pe loc; mai lentă.">Metoda{' '}
              <select value={m.method ?? 'auto'} onChange={(e) => upd({ method: e.target.value === 'evo' ? 'evo' : undefined })} aria-label="Metoda de rezolvare">
                <option value="auto">Automată</option>
                <option value="evo">Evolutivă (formule cu salturi)</option>
              </select>
            </label>
          </div>
          {err && <p className="print-warn" role="alert">{err}</p>}
          <div className="print-actions">
            <button onClick={() => onClose(m)}>Renunță</button>
            <button className="primary" onClick={go}>Rezolvă</button>
          </div>
        </>) : (<>
          <p className="print-info" role="status">{res.msg}</p>
          {res.ok && (
            <p className="print-info">
              {Object.entries(res.patch).map(([id, v]) => <span key={id} style={{ marginRight: 10 }}><b>{id}</b> = {v}</span>)}
              {res.objText && <><br />Obiectivul <b>{res.obj}</b> = <b>{res.objText}</b></>}
            </p>
          )}
          {res.ok && res.report.length > 0 && (
            <label><input type="checkbox" checked={withReport} onChange={(e) => setWithReport(e.target.checked)} aria-label="Raport de răspuns" /> Pune și un raport (valorile înainte și după, condițiile atinse, limitele, sensibilitatea) într-o foaie nouă</label>
          )}
          <div className="print-actions">
            <button onClick={() => setRes(null)}>Înapoi</button>
            {res.ok && <button className="primary" onClick={go} autoFocus>Păstrează soluția</button>}
          </div>
        </>)}
      </div>
    </div>
  );
}

function GoalSeekDialog({ setCell, check, seek, onKeep, onClose }: {
  setCell: string;
  check(set: string, change: string): string | null;
  seek(set: string, target: number, change: string): GoalSeekResult & { set: string; change: string; raw: string };
  onKeep(id: string, value: string): void; onClose(): void;
}) {
  const [set, setSet] = useState(setCell);
  const [target, setTarget] = useState('');
  const [change, setChange] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<(GoalSeekResult & { set: string; change: string; raw: string }) | null>(null);
  // 1.500 și 1.500,25 sunt mii (ca în română); 12.5 rămâne zecimal.
  const num = (s: string) => { const t = s.trim().replace(/\s/g, ''); return Number(t.includes(',') || /^-?\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t); };
  const run = () => {
    if (res) { if (res.ok) onKeep(res.change, res.raw); return; }
    const e = check(set, change) ?? (target.trim() === '' || !Number.isFinite(num(target)) ? 'Valoarea dorită trebuie să fie un număr.' : null);
    setErr(e);
    if (!e) setRes(seek(set, num(target), change));
  };
  const back = () => setRes(null);
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg series-dlg" role="dialog" aria-label="Căutare rezultat"
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } else if (e.key === 'Enter' && e.target instanceof HTMLInputElement) { e.preventDefault(); run(); } }}>
        <h3>Căutare rezultat</h3>
        {!res ? (<>
          <p className="print-info">Găsește ce număr trebuie pus într-o celulă ca o formulă să dea rezultatul dorit (de exemplu: ce dobândă face rata 1.500 lei).</p>
          <div className="series-grid">
            <span>Celula cu formula</span>
            <input type="text" value={set} onChange={(e) => { setSet(e.target.value); setErr(null); }} placeholder="de exemplu B5" aria-label="Celula cu formula" autoFocus={!setCell} />
            <span>Să aibă valoarea</span>
            <input type="text" value={target} onChange={(e) => { setTarget(e.target.value); setErr(null); }} placeholder="de exemplu 1500" aria-label="Valoarea dorită" autoFocus={!!setCell} />
            <span>Schimbând celula</span>
            <input type="text" value={change} onChange={(e) => { setChange(e.target.value); setErr(null); }} placeholder="de exemplu A1" aria-label="Celula care se schimbă" />
          </div>
          {err && <p className="print-warn" role="alert">{err}</p>}
          <div className="print-actions">
            <button onClick={onClose}>Renunță</button>
            <button className="primary" onClick={run}>Caută</button>
          </div>
        </>) : (<>
          <p className="print-info" role="status">
            {res.ok
              ? <>Am găsit o soluție pentru <b>{res.set}</b>: dacă <b>{res.change}</b> = <b>{formatNumber(res.x)}</b>, formula dă <b>{formatNumber(res.y)}</b>.</>
              : <>N-am găsit o valoare pentru care <b>{res.set}</b> să dea exact ce ai cerut ({res.iterations} încercări). Cea mai apropiată: <b>{res.change}</b> = <b>{formatNumber(res.x)}</b> dă <b>{Number.isFinite(res.y) ? formatNumber(res.y) : 'eroare'}</b>. Încearcă altă valoare de pornire în {res.change}.</>}
          </p>
          <div className="print-actions">
            <button onClick={res.ok ? onClose : back}>{res.ok ? 'Renunță' : 'Înapoi'}</button>
            {res.ok && <button className="primary" onClick={run} autoFocus>Păstrează</button>}
          </div>
        </>)}
      </div>
    </div>
  );
}

// Fereastra Manager de scenarii: lista, Adaugă / Editează (nume, celule, valori), Afișează, Șterge, Rezumat.
function ScenarioDialog({ list, cellsHint, current, onSave, onShow, onReport, onClose }: {
  list: SheetScenario[]; cellsHint: string; current(id: string): string;
  onSave(list: SheetScenario[]): void; onShow(s: SheetScenario): void; onReport(results: string): string | null; onClose(): void;
}) {
  const [pick, setPick] = useState(0);
  const [mode, setMode] = useState<'list' | 'edit' | 'report'>('list');
  const [editing, setEditing] = useState(-1);
  const [name, setName] = useState('');
  const [where, setWhere] = useState('');
  const [note, setNote] = useState('');
  const [vals, setVals] = useState<Record<string, string>>({});
  const [resText, setResText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const ids = parseCellList(where, ROWS, COLS);
  const startEdit = (i: number) => {
    const s = list[i];
    setEditing(i); setName(s ? s.name : `Scenariul ${list.length + 1}`); setWhere(s ? Object.keys(s.cells).join(', ') : cellsHint);
    setNote(s?.note ?? ''); setVals(s ? { ...s.cells } : {}); setErr(null); setMode('edit');
  };
  const save = () => {
    const n = name.trim();
    if (!n) { setErr('Scrie un nume pentru scenariu.'); return; }
    if (typeof ids === 'string') { setErr(ids); return; }
    if (list.some((s, i) => i !== editing && s.name.toLocaleLowerCase('ro') === n.toLocaleLowerCase('ro'))) { setErr(`Există deja un scenariu „${n}”.`); return; }
    const sc: SheetScenario = { name: n, cells: Object.fromEntries(ids.map((id) => [id, vals[id] ?? current(id)])), ...(note.trim() ? { note: note.trim() } : {}) };
    const next = editing >= 0 ? list.map((s, i) => (i === editing ? sc : s)) : [...list, sc];
    onSave(next); setPick(editing >= 0 ? editing : next.length - 1); setMode('list'); setErr(null);
  };
  const back = () => { setMode('list'); setErr(null); };
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg series-dlg" role="dialog" aria-label="Manager de scenarii"
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); if (mode === 'list') onClose(); else back(); } }}>
        <h3>🗂 Manager de scenarii</h3>
        {mode === 'list' && (<>
          <p className="print-info">Un scenariu ține valori pentru câteva celule (de exemplu prețul și cantitatea „Optimist” și „Pesimist”). „Afișează” le pune în foaie.</p>
          <div role="listbox" aria-label="Scenariile foii" style={{ maxHeight: 180, overflow: 'auto', border: '1px solid rgba(127, 127, 127, 0.4)', borderRadius: 6, padding: 4 }}>
            {!list.length && <div className="print-info">Nu e niciun scenariu încă. Apasă Adaugă.</div>}
            {list.map((s, i) => (
              <div key={s.name} role="option" aria-selected={i === pick} onClick={() => setPick(i)} onDoubleClick={() => onShow(s)}
                style={{ padding: '3px 6px', borderRadius: 4, cursor: 'pointer', background: i === pick ? 'rgba(37, 99, 235, 0.14)' : undefined }}>
                <b>{s.name}</b> <span style={{ opacity: 0.7 }}>· {Object.keys(s.cells).join(', ')}{s.note ? ' · ' + s.note : ''}</span>
              </div>
            ))}
          </div>
          <div className="print-actions" style={{ flexWrap: 'wrap' }}>
            <button onClick={() => startEdit(-1)} disabled={list.length >= MAX_SCENARIOS}>Adaugă…</button>
            <button onClick={() => startEdit(pick)} disabled={!list[pick]}>Editează…</button>
            <button onClick={() => { onSave(list.filter((_, i) => i !== pick)); setPick(Math.max(0, pick - 1)); }} disabled={!list[pick]}>Șterge</button>
            <button onClick={() => { setErr(null); setMode('report'); }} disabled={!list.length}>Rezumat…</button>
            <button className="primary" onClick={() => list[pick] && onShow(list[pick])} disabled={!list[pick]}>Afișează</button>
            <button onClick={onClose}>Închide</button>
          </div>
        </>)}
        {mode === 'edit' && (<>
          <div className="series-grid">
            <span>Numele scenariului</span>
            <input type="text" value={name} onChange={(e) => { setName(e.target.value); setErr(null); }} aria-label="Numele scenariului" autoFocus />
            <span>Celulele care se schimbă</span>
            <input type="text" value={where} onChange={(e) => { setWhere(e.target.value); setErr(null); }} placeholder="de exemplu B1:B3" aria-label="Celulele care se schimbă" />
            <span>Comentariu</span>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Comentariul scenariului" />
            {Array.isArray(ids) && ids.flatMap((id) => [
              <span key={id + '-l'}>Valoarea pentru {id}</span>,
              <input key={id} type="text" value={vals[id] ?? current(id)} onChange={(e) => setVals({ ...vals, [id]: e.target.value })} aria-label={`Valoarea pentru ${id}`} />,
            ])}
          </div>
          {err && <p className="print-warn" role="alert">{err}</p>}
          <div className="print-actions">
            <button onClick={back}>Înapoi</button>
            <button className="primary" onClick={save}>Salvează scenariul</button>
          </div>
        </>)}
        {mode === 'report' && (<>
          <p className="print-info">Se face o foaie nouă cu valorile fiecărui scenariu și, pentru celulele cu formule alese aici, rezultatul lor în fiecare scenariu.</p>
          <div className="series-grid">
            <span>Celulele cu rezultate</span>
            <input type="text" value={resText} onChange={(e) => { setResText(e.target.value); setErr(null); }} placeholder="de exemplu B5 sau B5:B6" aria-label="Celulele cu rezultate" autoFocus />
          </div>
          {err && <p className="print-warn" role="alert">{err}</p>}
          <div className="print-actions">
            <button onClick={back}>Înapoi</button>
            <button className="primary" onClick={() => setErr(onReport(resText))}>Fă rezumatul</button>
          </div>
        </>)}
      </div>
    </div>
  );
}

// Fereastra Tabel de date: celula de intrare din rând și / sau din coloană.
function DataTableDialog({ zone, onRun, onClose }: { zone: string; onRun(row: string, col: string): string | null; onClose(): void }) {
  const [row, setRow] = useState('');
  const [col, setCol] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const run = () => setErr(onRun(row, col));
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg series-dlg" role="dialog" aria-label="Tabel de date"
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } else if (e.key === 'Enter' && e.target instanceof HTMLInputElement) { e.preventDefault(); run(); } }}>
        <h3>▦ Tabel de date ({zone})</h3>
        <p className="print-info">Formula se calculează pentru fiecare valoare de pe marginea tabelului, puse pe rând în celulele de intrare.
          Cu o singură celulă din coloană: valorile în prima coloană, formulele în primul rând. Cu ambele: formula în colțul din stânga sus.</p>
        <div className="series-grid">
          <span>Celula de intrare din rând</span>
          <input type="text" value={row} onChange={(e) => { setRow(e.target.value); setErr(null); }} placeholder="valorile din primul rând merg aici" aria-label="Celula de intrare din rând" autoFocus />
          <span>Celula de intrare din coloană</span>
          <input type="text" value={col} onChange={(e) => { setCol(e.target.value); setErr(null); }} placeholder="valorile din prima coloană merg aici" aria-label="Celula de intrare din coloană" />
        </div>
        {err && <p className="print-warn" role="alert">{err}</p>}
        <div className="print-actions">
          <button onClick={onClose}>Renunță</button>
          <button className="primary" onClick={run}>Calculează</button>
        </div>
      </div>
    </div>
  );
}

// Fereastra Sortare: niveluri (coloană + sens), ca în Excel; primul nivel decide, următoarele doar la egalitate.
/** Fereastra Filtru avansat: zona listei, zona criteriilor, pe loc sau copiat în altă parte, doar rândurile unice. */
function AdvFilterDialog({ list: list0, onRun, onClear, onClose }: {
  list: string;
  onRun(o: { list: string; crit: string; copy: boolean; dest: string; unique: boolean }): string | null;
  onClear(list: string): void;
  onClose(): void;
}) {
  const [list, setList] = useState(list0);
  const [crit, setCrit] = useState('');
  const [copy, setCopy] = useState(false);
  const [dest, setDest] = useState('');
  const [unique, setUnique] = useState(false);
  const [err, setErr] = useState('');
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg adv-filter-dlg" role="dialog" aria-label="Filtru avansat" onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}>
        <h3>Filtru avansat</h3>
        <p className="print-info">
          Scrie undeva în afara tabelului titlurile coloanelor după care filtrezi și, sub ele, condițiile (de exemplu <b>Oraș</b> / <b>Cluj</b>,
          <b> Sumă</b> / <b>&gt;1000</b>). Condițiile de pe același rând trebuie îndeplinite toate; cele de pe rânduri diferite, oricare.
          Un text simplu găsește tot ce începe cu el; merg și * și ?.
        </p>
        <label className="print-row">Zona listei <input value={list} onChange={(e) => setList(e.target.value)} aria-label="Zona listei" placeholder="A1:D50" /></label>
        <label className="print-row">Zona criteriilor <input autoFocus value={crit} onChange={(e) => setCrit(e.target.value)} aria-label="Zona criteriilor" placeholder="F1:G2" /></label>
        <label className="print-row"><input type="radio" name="adv-where" checked={!copy} onChange={() => setCopy(false)} /> Filtrează lista pe loc (ascunde celelalte rânduri)</label>
        <label className="print-row"><input type="radio" name="adv-where" checked={copy} onChange={() => setCopy(true)} aria-label="Copiază rezultatul în altă parte" /> Copiază rezultatul în altă parte</label>
        {copy && <label className="print-row">Începând din celula <input value={dest} onChange={(e) => setDest(e.target.value)} aria-label="Celula de destinație" placeholder="J1" /></label>}
        <label className="print-row"><input type="checkbox" checked={unique} onChange={(e) => setUnique(e.target.checked)} aria-label="Doar rândurile unice" /> Doar rândurile unice (fără dubluri)</label>
        {err && <p className="adv-filter-err" role="alert">{err}</p>}
        <div className="print-actions">
          <button onClick={() => onClear(list)} title="Arată din nou toate rândurile listei">Afișează tot</button>
          <button onClick={onClose}>Renunță</button>
          <button className="primary" onClick={() => setErr(onRun({ list, crit, copy, dest, unique }) ?? '')}>Filtrează</button>
        </div>
      </div>
    </div>
  );
}

const cap = (w: string) => w[0].toUpperCase() + w.slice(1);
/** Valoarea din lista „Ordinea” a unui nivel: A→Z, Z→A, o listă cunoscută (sau inversă) ori lista proprie. */
function orderValue(l: SortKey): string {
  if (l.on || !l.list) return l.desc ? 'desc' : 'asc';
  const k = LISTS.indexOf(l.list);
  return k < 0 ? 'custom' : `${l.desc ? 'rev' : 'list'}:${k}`;
}

function SortDialog({ g, head: head0, col, label, colors, onSort, onClose }: {
  g: Range; head: boolean; col: number; label(c: number, head: boolean): string;
  /** Culorile de fundal / text din coloana c (sub capul de tabel), pentru sortarea după culoare. */
  colors(c: number, kind: 'bg' | 'fg', head: boolean): string[];
  onSort(head: boolean, levels: SortKey[]): void; onClose(): void;
}) {
  const [head, setHead] = useState(head0);
  const [levels, setLevels] = useState<SortKey[]>([{ col, desc: false }]);
  const cols: number[] = [];
  for (let c = g.c0; c <= g.c1; c++) cols.push(c);
  const set = (i: number, k: Partial<SortKey>) => setLevels((ls) => ls.map((l, j) => (j === i ? { ...l, ...k } : l)));
  const free = cols.find((c) => !levels.some((l) => l.col === c));
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg sort-dlg" role="dialog" aria-label="Sortare" onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}>
        <h3>Sortare</h3>
        <p className="print-info">Zona <b>{cellId(g.r0, g.c0)}:{cellId(g.r1, g.c1)}</b>. Rândurile se mută întregi; al doilea nivel decide doar între rândurile egale la primul.</p>
        <label className="print-row"><input type="checkbox" checked={head} onChange={(e) => setHead(e.target.checked)} /> Primul rând e cap de tabel (nu se sortează)</label>
        <div className="sort-levels">
          {levels.map((l, i) => (
            <div className="sort-level" key={i}>
              <span className="sort-level-name">{i === 0 ? 'Sortează după' : 'Apoi după'}</span>
              <select value={l.col} onChange={(e) => set(i, { col: Number(e.target.value), ...(l.on ? { color: colors(Number(e.target.value), l.on, head).find((x) => x !== 'none') ?? 'none' } : {}) })} aria-label={`Coloana pentru nivelul ${i + 1}`} autoFocus={i === 0}>
                {cols.map((c) => <option key={c} value={c}>{label(c, head)}</option>)}
              </select>
              <select
                value={l.on ?? 'value'}
                onChange={(e) => {
                  const on = e.target.value === 'value' ? undefined : e.target.value as 'bg' | 'fg';
                  const list = on ? colors(l.col, on, head) : [];
                  set(i, { on, color: on ? list.find((x) => x !== 'none') ?? list[0] ?? 'none' : undefined });
                }}
                aria-label={`Sortează după, la nivelul ${i + 1}`}
              >
                <option value="value">Valori</option>
                <option value="bg">Culoarea fundalului</option>
                <option value="fg">Culoarea textului</option>
              </select>
              {l.on && (
                <select
                  value={l.color ?? 'none'}
                  onChange={(e) => set(i, { color: e.target.value })}
                  aria-label={`Culoarea pentru nivelul ${i + 1}`}
                  style={l.color && l.color !== 'none' ? (l.on === 'bg' ? { background: l.color } : { color: l.color, fontWeight: 700 }) : undefined}
                >
                  {[...new Set([...colors(l.col, l.on, head), l.color ?? 'none'])].map((x) => (
                    <option key={x} value={x} style={x !== 'none' ? (l.on === 'bg' ? { background: x } : { color: x }) : undefined}>
                      {x === 'none' ? (l.on === 'bg' ? 'Fără fundal' : 'Text obișnuit') : x}
                    </option>
                  ))}
                </select>
              )}
              <select
                value={orderValue(l)}
                onChange={(e) => {
                  const v = e.target.value;
                  const m = /^(list|rev):(\d+)$/.exec(v);
                  if (m) set(i, { desc: m[1] === 'rev', list: LISTS[Number(m[2])] });
                  else if (v === 'custom') set(i, { desc: false, list: l.list && !LISTS.includes(l.list) ? l.list : [] });
                  else set(i, { desc: v === 'desc', list: undefined });
                }}
                aria-label={`Ordinea pentru nivelul ${i + 1}`}
              >
                {l.on ? <>
                  <option value="asc">Sus</option>
                  <option value="desc">Jos</option>
                </> : <>
                  <option value="asc">A → Z, 1 → 9</option>
                  <option value="desc">Z → A, 9 → 1</option>
                  {LISTS.map((ls, k) => <option key={'l' + k} value={`list:${k}`}>{cap(ls[0])}, {ls[1]}, … {ls[ls.length - 1]}</option>)}
                  {LISTS.map((ls, k) => <option key={'r' + k} value={`rev:${k}`}>{cap(ls[ls.length - 1])}, {ls[ls.length - 2]}, … {ls[0]}</option>)}
                  <option value="custom">Listă proprie…</option>
                </>}
              </select>
              {!l.on && l.list && !LISTS.includes(l.list) && (
                <input
                  className="sort-list-input"
                  defaultValue={l.list.join(', ')}
                  placeholder="de exemplu: Mic, Mediu, Mare"
                  aria-label={`Lista proprie pentru nivelul ${i + 1}`}
                  onChange={(e) => set(i, { list: e.target.value.split(/[,;]/).map((x) => x.trim()).filter(Boolean) })}
                />
              )}
              <button onClick={() => setLevels((ls) => ls.filter((_, j) => j !== i))} disabled={levels.length === 1} title="Scoate nivelul">✕</button>
            </div>
          ))}
        </div>
        <button onClick={() => setLevels((ls) => [...ls, { col: free ?? g.c0, desc: false }])} disabled={levels.length >= 8}>＋ Adaugă nivel</button>
        <div className="print-actions">
          <button onClick={onClose}>Renunță</button>
          <button className="primary" onClick={() => {
            if (levels.some((l) => l.list && !l.list.length)) { alert('Scrie valorile listei proprii, în ordine, despărțite prin virgulă.'); return; }
            onSort(head, levels);
          }}>Sortează</button>
        </div>
      </div>
    </div>
  );
}

/** Culorile de filă din meniu (ca primele culori din Excel). */
const TAB_COLORS = ['#c00000', '#ff0000', '#ffc000', '#ffff00', '#92d050', '#00b050', '#00b0f0', '#0070c0', '#002060', '#7030a0'];

function TabMenu({ x, y, only, lastVisible, color, hidden, onColor, onHide, onUnhide, onRename, onInsert, names, index, onPlace, protectedSheet, onProtect, onDelete, onClose }: TabMenuProps) {
  const [showHidden, setShowHidden] = useState(false);
  const [showColor, setShowColor] = useState(false);
  const [place, setPlace] = useState<{ before: number; copy: boolean } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close.current(); };
    window.addEventListener('mousedown', down);
    ref.current?.querySelector('button')?.focus();
    return () => window.removeEventListener('mousedown', down);
  }, []);
  // Meniul se deschide deasupra filei, pentru că filele sunt jos. Comenzile și ordinea sunt cele din programul de tabele cunoscut.
  return (
    <div
      className="filter-menu tab-menu"
      ref={ref}
      style={{ left: Math.min(x, window.innerWidth - 240), bottom: Math.max(8, window.innerHeight - y + 4) }}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}
    >
      <button onClick={onInsert} title="O foaie nouă, goală, după aceasta">Inserare foaie</button>
      <button onClick={onDelete} disabled={only}>Ștergere</button>
      <button onClick={onRename}>Redenumire</button>
      <button onClick={() => setPlace((p) => (p ? null : { before: Math.min(index + 1, names.length), copy: false }))} aria-expanded={!!place}>Mutare sau copiere…</button>
      {place && (
        <div className="tab-place" role="group" aria-label="Mutare sau copiere">
          <label>Înaintea foii:
            <select size={Math.min(6, names.length + 1)} value={place.before} onChange={(e) => setPlace({ ...place, before: Number(e.target.value) })}>
              {names.map((n, i) => <option key={i} value={i}>{n}</option>)}
              <option value={names.length}>(mutare la sfârșit)</option>
            </select>
          </label>
          <label className="tab-place-copy"><input type="checkbox" checked={place.copy} onChange={(e) => setPlace({ ...place, copy: e.target.checked })} /> Se creează o copie</label>
          <button className="primary" onClick={() => onPlace(place.before, place.copy)}>OK</button>
        </div>
      )}
      <button onClick={onProtect}>{protectedSheet ? 'Anulare protejare foaie…' : 'Protejare foaie…'}</button>
      <button onClick={() => setShowColor((v) => !v)} aria-expanded={showColor}>Culoare filă ▸</button>
      {showColor && <>
        <div className="tab-colors" role="group" aria-label="Culoarea filei">
          {TAB_COLORS.map((c) => (
            <button key={c} className={`tab-color ${color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => onColor(c)} title={`Culoarea filei: ${c}`} aria-label={`Culoarea filei ${c}`} />
          ))}
          <label className="tab-color tab-color-more" title="Altă culoare a filei">
            ＋<input type="color" value={color ?? '#4472c4'} onChange={(e) => onColor(e.target.value)} />
          </label>
        </div>
        <button className="tab-unhide" onClick={() => onColor(undefined)} disabled={!color}>Fără culoare</button>
      </>}
      <button onClick={onHide} disabled={lastVisible}>Ascundere</button>
      <button onClick={() => setShowHidden((v) => !v)} disabled={!hidden.length}>
        Reafișare…{hidden.length ? ` (${hidden.length})` : ''}
      </button>
      {showHidden && hidden.map((h) => (
        <button key={h.i} className="tab-unhide" onClick={() => onUnhide(h.i)} title="Afișează foaia">↳ {h.name}</button>
      ))}
    </div>
  );
}

interface PrintDialogProps {
  set: Required<Omit<SheetPrint, 'area' | 'breaks' | 'colBreaks'>> & { area?: string };
  /** Tot ce e completat în tabel. */
  used: Range | null;
  selection: Range | null;
  widths(g: Range): number[];
  /** Înălțimea rândurilor tipărite din zonă, la 100% (pentru „Totul pe o singură pagină”). */
  tall(g: Range): number;
  /** Zona care se tipărește acum. */
  area: Range | null;
  hasCharts: boolean;
  onChange(patch: Partial<SheetPrint>): void;
  onPrint(pdf: boolean): void;
  onClose(): void;
  what: PrintWhat;
  onWhat(w: PrintWhat): void;
  /** Selecția de acum, ca text („B2:D10”). */
  selText: string;
  /** Câte foi sunt în grup (0 = niciun grup). */
  groupCount: number;
  sheetCount: number;
}

type PrintWhat = 'sheet' | 'selection' | 'group' | 'book';

// Setările de tipărire: ce zonă, cum se așază pe pagină, plus o estimare a încadrării în lățime.
function PrintDialog({ set, used, selection, widths, tall, area, hasCharts, onChange, onPrint, onClose, what, onWhat, selText, groupCount, sheetCount }: PrintDialogProps) {
  const [areaText, setAreaText] = useState(set.area ?? '');
  const w = area ? widths(area) : [];
  const scale = printScale(w, set, area && set.onePage ? tall(area) : undefined);
  // Paginile alăturate, cu loc pentru coloanele repetate în stânga.
  const across = colPages(w, set, scale).length;
  const applyArea = (text: string) => {
    const t = text.trim().toUpperCase().replace(/\s+/g, '');
    setAreaText(t);
    if (!t) onChange({ area: undefined });
    else if (parseRangeText(t)) onChange({ area: t });
  };
  const bad = areaText !== '' && !parseRangeText(areaText);
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="print-dlg"
        role="dialog"
        aria-label="Tipărire"
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}
      >
        <h3>Tipărire</h3>
        <div className="print-row">
          <span className="print-label">Ce tipăresc</span>
          <div className="print-opts print-what">
            <label className="radio"><input type="radio" name="print-what" checked={what === 'sheet'} onChange={() => onWhat('sheet')} /> Foaia aceasta</label>
            <label className="radio"><input type="radio" name="print-what" checked={what === 'selection'} onChange={() => onWhat('selection')} /> Doar selecția ({selText})</label>
            {groupCount > 0 && <label className="radio"><input type="radio" name="print-what" checked={what === 'group'} onChange={() => onWhat('group')} /> Foile alese ({groupCount})</label>}
            {sheetCount > 1 && <label className="radio"><input type="radio" name="print-what" checked={what === 'book'} onChange={() => onWhat('book')} /> Tot registrul ({sheetCount} foi)</label>}
          </div>
        </div>
        {what === 'sheet' && <div className="print-row">
          <span className="print-label">Din foaie</span>
          <div className="print-opts">
            <label className="radio">
              <input type="radio" checked={!set.area} onChange={() => applyArea('')} />
              Tot tabelul{used ? ` (${rangeText(used)})` : ' (gol)'}
            </label>
            <label className="radio">
              <input type="radio" checked={!!set.area} onChange={() => applyArea(selection ? rangeText(selection) : areaText || (used ? rangeText(used) : 'A1:A1'))} />
              Doar zona
              <input
                className={`print-area ${bad ? 'bad' : ''}`}
                value={areaText}
                placeholder="A1:F30"
                onChange={(e) => applyArea(e.target.value)}
                title="Scrie zona, de exemplu A1:F30"
              />
            </label>
            {selection && (
              <button className="link" onClick={() => applyArea(rangeText(selection))}>
                Folosește selecția ({rangeText(selection)})
              </button>
            )}
          </div>
        </div>}
        <div className="print-row">
          <span className="print-label">Pagina</span>
          <div className="print-opts">
            <label className="radio"><input type="radio" checked={!set.landscape} onChange={() => onChange({ landscape: false })} /> Portret (în picioare)</label>
            <label className="radio"><input type="radio" checked={set.landscape} onChange={() => onChange({ landscape: true })} /> Peisaj (culcată)</label>
            <label>Hârtie{' '}
              <select aria-label="Hârtie" value={set.paper} onChange={(e) => onChange({ paper: e.target.value as PrintPaper })}>
                {(Object.keys(PAPERS) as PrintPaper[]).map((p) => <option key={p} value={p}>{p} ({String(PAPERS[p][0] / 10).replace('.', ',')} × {String(PAPERS[p][1] / 10).replace('.', ',')} cm)</option>)}
              </select>
            </label>
            <label>Margini{' '}
              <select aria-label="Margini" value={set.margin} onChange={(e) => onChange({ margin: e.target.value as PrintMargin })}>
                {(Object.keys(MARGINS) as PrintMargin[]).map((m) => <option key={m} value={m}>{MARGIN_NAMES[m]}</option>)}
              </select>
            </label>
          </div>
        </div>
        <div className="print-row">
          <span className="print-label">Antet și subsol</span>
          <div className="print-opts">
            <label>Sus{' '}
              <input className="print-hf" aria-label="Antet" value={set.header} maxLength={200} placeholder="de exemplu: Raport lunar · [Data]" onChange={(e) => onChange({ header: e.target.value })} />
            </label>
            <label>Jos{' '}
              <input className="print-hf" aria-label="Subsol" value={set.footer} maxLength={200} placeholder="de exemplu: [Fișier] · [Foaie]" onChange={(e) => onChange({ footer: e.target.value })} />
            </label>
            <span className="print-fields">
              Pune în antet:{' '}
              {HF_FIELDS.map((f) => (
                <button key={f} className="link" title={`Adaugă ${f} la textul de sus (se completează la tipărire)`} onClick={() => onChange({ header: (set.header ? set.header + ' ' : '') + f })}>{f}</button>
              ))}
            </span>
            <label><input type="checkbox" checked={set.numbers} onChange={(e) => onChange({ numbers: e.target.checked })} /> Numerotează paginile („Pagina 1 din 3”, jos la mijloc)</label>
          </div>
        </div>
        <div className="print-row">
          <span className="print-label">Așezare</span>
          <div className="print-opts">
            <label><input type="checkbox" checked={set.fit} onChange={(e) => onChange({ fit: e.target.checked })} /> Potrivește pe lățimea paginii</label>
            {set.fit && (
              <label className="print-sub"><input type="checkbox" checked={set.onePage} onChange={(e) => onChange({ onePage: e.target.checked })} /> și pe înălțime: totul pe o singură pagină</label>
            )}
            {!set.fit && (
              <label>
                Mărime la tipărire:{' '}
                <input type="number" className="print-head-n print-scale" min={MIN_PRINT_SCALE} max={MAX_PRINT_SCALE} step={5} defaultValue={set.scale} aria-label="Mărimea la tipărire, în procente"
                  onChange={(e) => { const n = Math.round(Number(e.target.value)); if (n >= MIN_PRINT_SCALE && n <= MAX_PRINT_SCALE) onChange({ scale: n }); }} />
                % (între {MIN_PRINT_SCALE} și {MAX_PRINT_SCALE}; 100 = mărimea de pe ecran)
              </label>
            )}
            <label>
              <input type="checkbox" checked={set.head} onChange={(e) => onChange({ head: e.target.checked })} /> Repetă {set.headRows === 1 ? 'primul' : 'primele'}{' '}
              <input type="number" className="print-head-n" min={1} max={MAX_HEAD_ROWS} value={set.headRows} disabled={!set.head} aria-label="Câte rânduri se repetă"
                onChange={(e) => { const n = Math.round(Number(e.target.value)); if (n >= 1 && n <= MAX_HEAD_ROWS) onChange({ headRows: n }); }} />{' '}
              {set.headRows === 1 ? 'rând' : 'rânduri'} (capul de tabel) pe fiecare pagină
            </label>
            <label title="Când tabelul e mai lat decât pagina și continuă pe pagini alăturate, primele coloane (de exemplu numele) apar în stânga pe fiecare pagină">
              <input type="checkbox" checked={set.leftCols > 0} onChange={(e) => onChange({ leftCols: e.target.checked ? 1 : 0 })} /> Repetă în stânga {set.leftCols > 1 ? 'primele' : 'prima'}{' '}
              <input type="number" className="print-head-n" min={1} max={MAX_LEFT_COLS} value={Math.max(1, set.leftCols)} disabled={!set.leftCols} aria-label="Câte coloane se repetă"
                onChange={(e) => { const n = Math.round(Number(e.target.value)); if (n >= 1 && n <= MAX_LEFT_COLS) onChange({ leftCols: n }); }} />{' '}
              {set.leftCols > 1 ? 'coloane' : 'coloană'} pe paginile alăturate
            </label>
            <label><input type="checkbox" checked={set.grid} onChange={(e) => onChange({ grid: e.target.checked })} /> Linii între celule</label>
            <label><input type="checkbox" checked={set.headings} onChange={(e) => onChange({ headings: e.target.checked })} /> Literele coloanelor și numerele rândurilor (A, B, C… și 1, 2, 3…)</label>
            {hasCharts && (
              <label><input type="checkbox" checked={set.charts} onChange={(e) => onChange({ charts: e.target.checked })} /> Tipărește și graficele (după tabel)</label>
            )}
          </div>
        </div>
        <p className="print-info">
          {!area ? 'Tabelul e gol.'
            : bad ? 'Zona nu e scrisă corect (exemplu: A1:F30).'
            : across > 1 ? `Coloanele nu încap pe lățime: tabelul se întinde pe ${across} pagini alăturate${set.leftCols ? ` (cu ${set.leftCols === 1 ? 'prima coloană repetată' : `primele ${set.leftCols} coloane repetate`} pe fiecare)` : ''}. Bifează „Potrivește”, micșorează mărimea sau alege Peisaj.`
            : set.fit && set.onePage && scale < 1 ? `Tabelul se micșorează la ${Math.round(scale * 100)}% ca să încapă tot pe o singură pagină.`
            : !set.fit && scale !== 1 ? `Tabelul se tipărește la ${Math.round(scale * 100)}% și încape pe lățimea paginii (${set.paper}).`
            : scale < 1 ?`Tabelul se micșorează la ${Math.round(scale * 100)}% ca să încapă pe lățime.`
            : `Tabelul încape pe lățimea paginii (${set.paper}).`}
        </p>
        <div className="print-actions">
          <button onClick={onClose}>Anulează</button>
          <button disabled={!area || bad} onClick={() => onPrint(true)}>Salvează PDF</button>
          <button className="primary" disabled={!area || bad} onClick={() => onPrint(false)} autoFocus>Tipărește…</button>
        </div>
      </div>
    </div>
  );
}

interface PrintViewProps {
  title: string;
  /** Valorile zero nu se tipăresc (Opțiuni → Afișează zero, debifat). */
  nz?: boolean;
  set: Required<Omit<SheetPrint, 'area' | 'breaks' | 'colBreaks'>>;
  g: Range | null;
  /** Înălțimea rândurilor tipărite, la 100%. */
  tall: number;
  cells: Cells;
  results: Results;
  styles: Styles;
  colW: Record<string, number>;
  hidden: Set<number>;
  /** Coloanele ascunse (de la 0), care nu se tipăresc. */
  hiddenCols?: Set<number>;
  charts: SheetChart[];
  /** Foile de date ale graficelor cu datele pe altă foaie. */
  srcs?: ChartSrcs;
  pics?: SheetPic[];
  merges: Range[];
  bars: Record<string, string>;
  /** Sfârșiturile de pagină puse de mână (rânduri, coloane). */
  brk?: number[];
  cbrk?: number[];
  /**
   * Doar pentru Aspect pagină: fiecare celulă primește o legătură invizibilă cât ea (cell.invalid/A1), care ajunge în PDF ca zonă
   * de legătură; așa pagina desenată știe ce celulă e sub clic. La tipărire și la Export PDF nu se pun.
   */
  cellLinks?: boolean;
}

// Ce iese pe hârtie: doar zona aleasă, cu formatarea celulelor, fără grilă de editare. Se vede doar la tipărire.
function PrintView({ set, g, tall, cells, results, styles, colW, hidden, hiddenCols, charts, srcs: chartSrcs, pics, merges, bars, brk, cbrk, nz, cellLinks }: PrintViewProps) {
  if (!g) return null;
  // Pozele se desenează în celula de care sunt prinse, deci urmează paginile, zoom-ul și coloanele tipărite.
  const picsAt = new Map<string, SheetPic[]>();
  for (const p of pics ?? []) { const id = cellId(p.r, p.c); picsAt.set(id, [...(picsAt.get(id) ?? []), p]); }
  // Coloanele ascunse nu se tipăresc (lățime 0, scoase din fiecare pagină), ca în programul cunoscut.
  const widths = printWidths(g, colW).map((w, i) => (hiddenCols?.has(g.c0 + i) ? 0 : w));
  const scale = printScale(widths, set, tall);
  const rows = printRows(g, hidden);
  const headRows = rows.slice(0, headCount(set, rows.length));
  const bodyRows = rows.slice(headRows.length);
  const breaks = new Set(brk ?? []);
  // Tabelul mai lat decât pagina (fără potrivire pe lățime): câte un tabel pe fiecare pagină alăturată, cu coloanele repetate în față.
  const groups = printColGroups(widths, { ...set, colBreaks: cbrk }, scale, g.c0).map((cols) => cols.filter((i) => widths[i] > 0)).filter((cols) => cols.length);
  const row = (r: number, cols: number[]) => {
    // Centrarea pe selecție: titlul ocupă pe hârtie și celulele goale de alături (ultima coloană acoperită).
    let coverTo = -1;
    return (
    <tr key={r} className={breaks.has(r) && r !== bodyRows[0] ? 'print-break' : undefined}>
      {set.headings && <th className="print-rh">{r + 1}</th>}
      {cols.map((i, k) => {
        const c = g.c0 + i;
        if (c <= coverTo) return null;
        // Câte coloane la rând (fără goluri) sunt în tabelul acestei pagini, de la c încolo.
        let run = 1;
        while (cols[k + run] === i + run) run++;
        const after = k > 0 && cols[k - 1] === i - 1;
        // Celulele îmbinate se tipăresc pe lățimea lor (pe fiecare rând al îmbinării, textul doar pe primul).
        const m = mergeAt(merges, r, c);
        if (m && c > m.c0 && after) return null;
        let span = m ? Math.min(m.c1, g.c1, c + run - 1) - c + 1 : 1;
        if (m && r > m.r0) return <td key={c} colSpan={span > 1 ? span : undefined} />;
        const id = cellId(r, c);
        const res = results[id];
        const st = styles[id];
        if (!m && st?.align === 'across' && (cells[id] ?? '').trim()) {
          let e = c;
          while (e < Math.min(g.c1, c + run - 1) && styles[cellId(r, e + 1)]?.align === 'across' && !cells[cellId(r, e + 1)] && !mergeAt(merges, r, e + 1)) e++;
          span = e - c + 1;
          coverTo = e;
        }
        const num = res ? res.num : isNumber(cells[id] ?? '');
        return (
          <td key={c} colSpan={span > 1 ? span : undefined} className={[res?.err ? 'err' : num ? 'num' : '', picsAt.has(id) ? 'has-pic' : '', cellLinks ? 'has-link' : ''].filter(Boolean).join(' ') || undefined} style={withBar(printEdges(st && cellCss(st), styles, r, c, rows[0], g.c0), bars[id])}>
            {cellLinks && <a className="print-cell-link" href={CELL_LINK + id} aria-hidden="true" tabIndex={-1} />}
            {nz && isZeroCell(cells[id], res) ? '' : st?.rot ? <RotText rot={st.rot} text={cellText(cells[id], res, st)} print /> : cellText(cells[id], res, st)}
            {picsAt.get(id)?.map((p) => <img key={p.id} className="print-pic" src={p.src} alt={p.alt ?? ''} style={{ left: p.dx, top: p.dy, width: p.w, height: p.h }} />)}
          </td>
        );
      })}
    </tr>
    );
  };
  return (
    <div className={`sheet-print ${set.grid ? 'lines' : ''}`} style={{ zoom: scale }}>
      {groups.map((cols, k) => (
        <table key={k} className={k ? 'print-colpage' : undefined} style={{ width: cols.reduce((a, i) => a + widths[i], 0) + (set.headings ? HEAD_W : 0) }}>
          <colgroup>{set.headings && <col style={{ width: HEAD_W }} />}{cols.map((i) => <col key={i} style={{ width: widths[i] }} />)}</colgroup>
          {(headRows.length > 0 || set.headings) && (
            <thead>
              {set.headings && <tr className="print-ch"><th />{cols.map((i) => <th key={i}>{colName(g.c0 + i)}</th>)}</tr>}
              {headRows.map((r) => row(r, cols))}
            </thead>
          )}
          <tbody>{bodyRows.map((r) => row(r, cols))}</tbody>
        </table>
      ))}
      {charts.map((ch) => (
        <div key={ch.id} className="sheet-print-chart" dangerouslySetInnerHTML={{ __html: chartSvgFor(ch, cells, results, styles, chartSrcs) }} />
      ))}
    </div>
  );
}

/** Lățimea coloanei cu numerele rândurilor la tipărire, în pixeli. */
const HEAD_W = 36;

/** Fonturile din lista graficului (cele care sunt pe orice Windows; lipsă = Segoe UI). */
const CHART_FONTS = ['Arial', 'Calibri', 'Cambria', 'Georgia', 'Times New Roman', 'Verdana', 'Courier New'];

/** Graficul are exact aspectul stilului rapid (efectul, fundalul, conturul, textul, grila; valorile doar dacă stilul le cere). */
const chartStyleOn = (ch: SheetChart, st: (typeof CHART_STYLES)[number][1]) => (ch.fx ?? '') === (st.fx ?? '') && (ch.bg ?? '') === (st.bg ?? '')
  && (ch.line ?? '') === (st.line ?? '') && (ch.ink ?? '') === (st.ink ?? '') && !!ch.noGrid === !!st.noGrid && (!st.labels || !!ch.labels);
/** Mostra unui stil de tabel cu chenar / grilă: liniile lui pe marginile mostrei. */
const gridLook = (k: TableTheme): React.CSSProperties => (TABLE_THEMES[k].grid ? { boxShadow: `inset 0 0 0 1px ${TABLE_THEMES[k].line}` } : {});
const lookOf = (ch: SheetChart) => ({ xTitle: ch.xTitle, yTitle: ch.yTitle, palette: ch.palette, labels: ch.labels, legend: ch.legend, bg: ch.bg, line: ch.line, noGrid: ch.noGrid, font: ch.font, ink: ch.ink, axMin: ch.axMin, axMax: ch.axMax, axStep: ch.axStep, fx: ch.fx });

/** O căsuță de număr pentru scara axei: se aplică la Enter sau la ieșire; goală = automat. Primește și virgula zecimală. */
function AxisNum({ label, aria, title, value, onSet }: { label: string; aria: string; title: string; value?: number; onSet(v: number | undefined): void }) {
  const [txt, setTxt] = useState(value === undefined ? '' : String(value).replace('.', ','));
  useEffect(() => { setTxt(value === undefined ? '' : String(value).replace('.', ',')); }, [value]);
  const apply = () => {
    const s = txt.trim().replace(/\s/g, '').replace(',', '.');
    const v = s === '' ? undefined : Number(s);
    if (v !== undefined && !Number.isFinite(v)) { setTxt(value === undefined ? '' : String(value).replace('.', ',')); return; }
    if (v !== value) onSet(v);
  };
  return (
    <label className="sh-axis-row" title={title}>
      <span>{label}</span>
      <input className="fmt" inputMode="decimal" placeholder="Automat" aria-label={aria} value={txt}
        onChange={(e) => setTxt(e.target.value)} onBlur={apply}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } else if (e.key === 'Escape') setTxt(value === undefined ? '' : String(value).replace('.', ',')); }} />
    </label>
  );
}

/** Foile de date ale graficelor care iau datele de pe altă foaie (SheetChart.src): celulele, valorile calculate și formatul lor. */
type ChartSrcs = Map<string, { cells: Cells; results: Results; styles: Styles }>;
function chartSrcsOf(charts: SheetChart[], self: string, doc: SheetDoc): ChartSrcs {
  const out: ChartSrcs = new Map();
  for (const ch of charts) {
    if (!ch.src || ch.src === self || out.has(ch.src)) continue;
    const sh = doc.sheets.find((s) => s.name === ch.src);
    if (!sh) continue;
    let rs: Results = {};
    try { rs = evaluateAll(sh.cells, { self: sh.name, sheets: doc.sheets, names: doc.names, pivots: doc.pivots, match: doc.match, iterate: doc.iter, ext: doc.links }); } catch { rs = {}; }
    out.set(ch.src, { cells: sh.cells, results: rs, styles: sh.styles });
  }
  return out;
}

function chartSvgFor(ch: SheetChart, cells0: Cells, results0: Results, styles0: Styles, srcs?: ChartSrcs): string {
  const { cells, results, styles } = (ch.src && srcs?.get(ch.src)) || { cells: cells0, results: results0, styles: styles0 };
  const g = parseRangeText(ch.range);
  return chartSvg(ch.type, ch.title, g ? chartDataOf(cells, results, styles, g, ch) : { categories: [], series: [] }, undefined, undefined, lookOf(ch));
}

/** Toate seriile din zona de date a graficului (și cele ascunse): coloana foii și numele, pentru lista Serii. */
function chartSeriesOf(ch: SheetChart, cells0: Cells, results0: Results, styles0: Styles, srcs?: ChartSrcs): [number, string][] {
  const { cells, results, styles } = (ch.src && srcs?.get(ch.src)) || { cells: cells0, results: results0, styles: styles0 };
  const g = parseRangeText(ch.range);
  if (!g || !canHideSeries(ch.type)) return [];
  const d = chartData(cells, results, styles, g, isXY(ch.type), !!ch.byRow && canSwitchRC(ch.type));
  return d.where ? d.where.cols.map((c, i) => [c, d.series[i].name]) : [];
}

interface ChartCardProps {
  chart: SheetChart;
  /** Graficul e cel ales (are fila „Grafic” deschisă în panglică). */
  selected: boolean;
  onSelect(): void;
  svg: string;
  onTitle(title: string): void;
  onType(type: ChartType): void;
  onLook(patch: Partial<SheetChart>, undoable: boolean): void;
  onUseSelection(): void;
  onShowRange(): void;
  onCopy(): void;
  onSave(): void;
  onRemove(): void;
}

// Fila contextuală „Grafic”: comenzile graficului ales în panou, grupate ca în panglică (aceleași ca pe cardul lui).
function ChartRibbon({ chart, series, onTitle, onType, onLook, onUseSelection, onShowRange, onCopy, onSave, onRemove, onPlace, onNewSheet }: Omit<ChartCardProps, 'svg' | 'selected' | 'onSelect'> & { onPlace(onSheet: boolean): void; onNewSheet(): void; series: [number, string][] }) {
  // Ca fila „Proiectare diagramă” din programul de tabele cunoscut: Aspecte diagramă · Stiluri diagramă · Titluri · Date · Tip, plus Imagine și Ștergere.
  const axes = chart.type !== 'pie' && chart.type !== 'doughnut';
  const canLabels = axes && chart.type !== 'box';
  const legend = chart.legend ?? 'b';
  return (
    <>
      <RGroup label="Aspecte diagramă">
        <RSplit icon="➕" label="Adăugare element diagramă" keytip="A" title="Adăugare element diagramă: etichetele de date și locul legendei"
          items={[
            ...(canLabels ? [{ label: 'Etichete de date', title: 'Scrie valoarea fiecărui punct pe grafic (deasupra coloanelor, lângă puncte)', checked: !!chart.labels, run: () => onLook({ labels: chart.labels ? undefined : true }, true) }] : []),
            ...(axes ? [{ label: 'Linii de grilă', title: 'Liniile gri deschis dintre valori, pe toată lățimea graficului', checked: !chart.noGrid, run: () => onLook({ noGrid: chart.noGrid ? undefined : true }, true) }] : []),
            ...LEGEND_POS.map(([v, name], i) => ({ label: 'Legendă: ' + name, sep: i === 0 && canLabels, checked: legend === v, run: () => onLook({ legend: v === 'b' ? undefined : v }, true) })),
          ]} />
        <RSplit icon="▥" label="Aspect rapid" keytip="L" title="Aspect rapid: legenda și etichetele de date puse dintr-un clic"
          items={[
            { label: 'Aspect 1: legenda jos', run: () => onLook({ legend: undefined, labels: undefined }, true) },
            { label: 'Aspect 2: legenda în dreapta', run: () => onLook({ legend: 'r', labels: undefined }, true) },
            ...(canLabels ? [{ label: 'Aspect 3: fără legendă, cu valori', run: () => onLook({ legend: 'none', labels: true }, true) }] : []),
          ]} />
      </RGroup>
      <RGroup label="Stiluri diagramă">
        <RSplit icon="✨" label="Stiluri rapide" keytip="S" title="Stiluri rapide: umbre, degrade, fundal și grilă puse dintr-un clic (se păstrează și în .xlsx)"
          items={CHART_STYLES.map(([name, st]) => ({ label: name, checked: chartStyleOn(chart, st),
            run: () => onLook({ fx: st.fx, bg: st.bg, line: st.line, ink: st.ink, noGrid: st.noGrid, labels: canLabels ? st.labels : chart.labels }, true) }))} />
        <RSplit icon="🎨" label="Modificare culori" keytip="H" title="Modificare culori: setul de culori al graficului"
          items={PALETTES.map(([name], i) => ({ label: name, checked: (chart.palette ?? 0) === i, run: () => onLook({ palette: i || undefined }, true) }))} />
        <div className="chart-palette sh-chart-pal" role="group" aria-label="Culorile graficului ales">
          {PALETTES.map(([name, cols], i) => (
            <button key={name} className={(chart.palette ?? 0) === i ? 'on' : ''} title={`Culorile graficului: ${name}`} aria-label={`Culori ${name} pentru graficul ales`}
              onClick={() => onLook({ palette: i || undefined }, true)}>
              {cols.slice(0, 4).map((c) => <span key={c} style={{ background: c }} />)}
            </button>
          ))}
        </div>
      </RGroup>
      <RGroup label="Stiluri forme">
        <div className="rb-stack">
          <RSplit icon="🪣" label="Umplere formă" keytip="F" title="Umplere formă: culoarea de fundal a zonei diagramei"
            items={CHART_FILLS.map(([name, c], i) => ({ label: name, checked: (chart.bg ?? '#ffffff') === c, run: () => onLook({ bg: i ? c : undefined }, true) }))} />
          <RSplit icon="▭" label="Contur formă" keytip="O" title="Contur formă: chenarul din jurul zonei diagramei"
            items={[{ label: 'Fără contur', checked: !chart.line, run: () => onLook({ line: undefined }, true) }, ...CHART_LINES.map(([name, c]) => ({ label: name, checked: chart.line === c, run: () => onLook({ line: c }, true) }))]} />
        </div>
        <div className="rb-stack">
          <RSplit icon="𝐀" label="Font" keytip="N" title="Fontul textului din grafic: titlul, legenda, axele și valorile (se păstrează și în .xlsx)"
            items={[{ label: 'Segoe UI', checked: !chart.font, run: () => onLook({ font: undefined }, true) }, ...CHART_FONTS.map((f) => ({ label: f, checked: chart.font === f, run: () => onLook({ font: f }, true) }))]} />
          <RSplit icon="🖍" label="Culoare text" keytip="X" title="Culoarea textului din grafic: titlul, legenda, axele și valorile (se păstrează și în .xlsx)"
            items={CHART_INKS.map(([name, c]) => ({ label: name, checked: (chart.ink ?? '') === c, run: () => onLook({ ink: c || undefined }, true) }))} />
        </div>
      </RGroup>
      <RGroup label="Titluri">
        <div className="rb-stack">
          <input className="fmt sh-chart-in" placeholder="Titlul diagramei" aria-label="Titlul graficului ales" value={chart.title} onChange={(e) => onTitle(e.target.value)} />
          {axes && <input className="fmt sh-chart-in" placeholder="Titlul axei orizontale" aria-label="Titlul axei orizontale a graficului ales" value={chart.xTitle ?? ''} onChange={(e) => onLook({ xTitle: e.target.value || undefined }, false)} />}
          {axes && <input className="fmt sh-chart-in" placeholder="Titlul axei verticale" aria-label="Titlul axei verticale a graficului ales" value={chart.yTitle ?? ''} onChange={(e) => onLook({ yTitle: e.target.value || undefined }, false)} />}
        </div>
      </RGroup>
      {axes && (
        <RGroup label="Formatare axă">
          <div className="rb-stack sh-axis">
            <AxisNum label="Minim" aria="Minim axă" title="Minimul axei valorilor (gol = automat)" value={chart.axMin} onSet={(v) => onLook({ axMin: v }, true)} />
            <AxisNum label="Maxim" aria="Maxim axă" title="Maximul axei valorilor (gol = automat)" value={chart.axMax} onSet={(v) => onLook({ axMax: v }, true)} />
            <AxisNum label="Pas" aria="Pas axă" title="Distanța dintre gradațiile axei valorilor (gol = automat)" value={chart.axStep} onSet={(v) => onLook({ axStep: v !== undefined && v > 0 ? v : undefined }, true)} />
          </div>
        </RGroup>
      )}
      <RGroup label="Date">
        <button className="rb-big" data-keytip="E" onMouseDown={(e) => e.preventDefault()} onClick={onUseSelection} title="Selectare date: graficul ia datele din celulele selectate acum" aria-label="Selectare date">
          <span className="rb-ico">⇲</span><span className="rb-txt">Selectare date</span>
        </button>
        <div className="rb-stack">
          {series.length > 1 && <RMenu label="☑ Serii" ariaLabel="Serii" keytip="R" title="Seriile graficului: debifează o serie ca să n-o mai arate graficul (datele rămân în tabel)"
            items={series.map(([c, name]) => {
              const off = !!chart.hide?.includes(c);
              const shown = series.filter(([k]) => !chart.hide?.includes(k)).length;
              return { label: name, checked: !off,
                run: () => { if (!off && shown <= 1) return; const h = off ? (chart.hide ?? []).filter((k) => k !== c) : [...(chart.hide ?? []), c].sort((a, b) => a - b); onLook({ hide: h.length ? h : undefined }, true); } };
            })} />}
          {canSwitchRC(chart.type) && <button className={'rb-small' + (chart.byRow ? ' active' : '')} data-keytip="W" onMouseDown={(e) => e.preventDefault()} onClick={() => onLook({ byRow: chart.byRow ? undefined : true, hide: undefined }, true)}
            title="Comutare rând/coloană: seriile devin rândurile tabelului, iar etichetele de pe axă vin din capul de tabel" aria-label="Comutare rând/coloană" aria-pressed={!!chart.byRow}>
            <span className="rb-ico">⇄</span><span className="rb-txt">Comutare rând/coloană</span>
          </button>}
          <button className="rb-small" data-keytip="D" onMouseDown={(e) => e.preventDefault()} onClick={onShowRange} title={`Arată în tabel datele graficului (${chart.range})`} aria-label="Datele graficului">
            <span className="rb-ico">▦</span><span className="rb-txt">{chart.range}</span>
          </button>
        </div>
      </RGroup>
      <RGroup label="Tip" keep>
        <RSplit icon="📊" label="Modificare tip diagramă" keytip="C" title="Modificare tip diagramă: coloane, linie, plăcintă, puncte…"
          items={SHEET_CHART_TYPES.map(([v, label]) => ({ label, checked: chart.type === v, run: () => onType(v) }))} />
      </RGroup>
      <RGroup label="Locație">
        <RSplit icon="⇱" label="Mutare diagramă" keytip="M" title="Mutare diagramă: pe foaie, peste celule, sau în panoul de grafice din dreapta"
          items={[
            { label: 'Obiect pe foaie (peste celule)', checked: !!chart.at, run: () => onPlace(true) },
            { label: 'În panoul de grafice', checked: !chart.at, run: () => onPlace(false) },
            { label: 'Foaie nouă (doar graficul)', title: 'Graficul se mută pe o foaie a lui, mare cât ecranul; datele rămân pe foaia lor', run: onNewSheet },
          ]} />
      </RGroup>
      <RGroup label="Imagine">
        <div className="rb-stack">
          <button className="rb-small" data-keytip="I" onMouseDown={(e) => e.preventDefault()} onClick={onCopy} title="Copiază graficul ca imagine, ca să-l lipești în Docs sau în alt program" aria-label="Copiere ca imagine">
            <span className="rb-ico">📋</span><span className="rb-txt">Copiere ca imagine</span>
          </button>
          <button className="rb-small" data-keytip="S" onMouseDown={(e) => e.preventDefault()} onClick={onSave} title="Salvează graficul ca imagine .png" aria-label="Salvare ca PNG">
            <span className="rb-ico">💾</span><span className="rb-txt">Salvare ca PNG</span>
          </button>
        </div>
      </RGroup>
      <RGroup label="Ștergere">
        <button className="rb-big" data-keytip="X" onMouseDown={(e) => e.preventDefault()} onClick={onRemove} title="Ștergere diagramă (Ctrl+Z o aduce înapoi)" aria-label="Ștergere diagramă">
          <span className="rb-ico">✕</span><span className="rb-txt">Ștergere diagramă</span>
        </button>
      </RGroup>
    </>
  );
}

// Un grafic din panou: imaginea (redesenată la fiecare schimbare a datelor) și comenzile lui.
function ChartCard({ chart, selected, onSelect, svg, onTitle, onType, onLook, onUseSelection, onShowRange, onCopy, onSave, onRemove }: ChartCardProps) {
  return (
    <div className={`chart-card${selected ? ' sel' : ''}`} onMouseDown={onSelect} data-chart={chart.id}>
      <div className="chart-head">
        <input
          className="chart-title"
          placeholder="Titlul graficului"
          value={chart.title}
          onChange={(e) => onTitle(e.target.value)}
        />
        <select value={chart.type} onChange={(e) => onType(e.target.value as ChartType)} title="Tipul graficului">
          {SHEET_CHART_TYPES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
        <button className="chart-x" onClick={onRemove} title="Șterge graficul">✕</button>
      </div>
      <div className="chart-img" dangerouslySetInnerHTML={{ __html: svg }} />
      {chart.type !== 'pie' && chart.type !== 'doughnut' && chart.type !== 'radar' && chart.type !== 'radarFill' ? (
        <div className="chart-axes">
          <input placeholder="Titlul axei orizontale" aria-label="Titlul axei orizontale" value={chart.xTitle ?? ''} onChange={(e) => onLook({ xTitle: e.target.value || undefined }, false)} />
          <input placeholder="Titlul axei verticale" aria-label="Titlul axei verticale" value={chart.yTitle ?? ''} onChange={(e) => onLook({ yTitle: e.target.value || undefined }, false)} />
        </div>
      ) : null}
      {chart.type !== 'pie' && chart.type !== 'doughnut' && chart.type !== 'box' ? (
        <label className="chart-labels" title="Scrie valoarea fiecărui punct pe grafic (deasupra coloanelor, lângă puncte)">
          <input type="checkbox" checked={!!chart.labels} onChange={(e) => onLook({ labels: e.target.checked || undefined }, true)} /> Valori pe grafic
        </label>
      ) : null}
      <label className="chart-labels" title="Unde stă legenda (numele seriilor) — apare când graficul are cel puțin două serii, și la plăcintă">
        Legenda
        <select aria-label="Locul legendei" value={chart.legend ?? 'b'} onChange={(e) => onLook({ legend: e.target.value === 'b' ? undefined : e.target.value as SheetChart['legend'] }, true)}>
          {LEGEND_POS.map(([v, name]) => <option key={v} value={v}>{name}</option>)}
        </select>
      </label>
      <div className="chart-palette" role="group" aria-label="Culorile graficului">
        {PALETTES.map(([name, cols], i) => (
          <button key={name} className={(chart.palette ?? 0) === i ? 'on' : ''} title={`Culorile graficului: ${name}`} aria-label={`Culori ${name}`}
            onClick={() => onLook({ palette: i || undefined }, true)}>
            {cols.slice(0, 4).map((c) => <span key={c} style={{ background: c }} />)}
          </button>
        ))}
      </div>
      <div className="chart-foot">
        <button className="link" onClick={onShowRange} title="Selectează în tabel datele graficului">Date: {chart.range}</button>
        <button onClick={onUseSelection} title="Graficul ia datele din celulele selectate acum">Folosește selecția</button>
        <button onClick={onCopy} title="Copiază graficul ca imagine, ca să-l lipești în Docs sau în alt program">Copiază</button>
        <button onClick={onSave} title="Salvează graficul ca imagine .png">Salvează PNG</button>
      </div>
    </div>
  );
}

interface FilterMenuProps {
  x: number;
  y: number;
  col: string;
  values: { text: string; count: number }[];
  /** Valorile debifate acum. */
  off: string[];
  /** Condiția pusă acum pe coloană, dacă e. */
  cond?: FilterCond;
  /** Culorile de fundal și de text din coloană (goale dacă toată coloana arată la fel). */
  colors: Record<FilterColor['kind'], { color: string; count: number }[]>;
  /** Culoarea după care se filtrează acum coloana, dacă e. */
  color?: FilterColor;
  onApply(off: string[], cond?: FilterCond, color?: FilterColor): void;
  onSort(desc: boolean): void;
  /** Coloana are acum un filtru (valori debifate, condiție sau culoare). */
  active: boolean;
  /** Scoate filtrul de pe coloană. */
  onClearCol(): void;
  onClose(): void;
}

// Lista de bifat a unei coloane filtrate, ca în Excel: sortare, căutare, „Selectează tot”, valorile cu câte apar.
/** Condițiile din meniul filtrului (Filtre numerice / de text din Excel). */
const FILTER_LABELS: [FilterOp, string][] = [
  ['gt', 'mai mare decât'], ['ge', 'cel puțin'], ['lt', 'mai mic decât'], ['le', 'cel mult'], ['between', 'între'],
  ['eq', 'egal cu'], ['ne', 'diferit de'], ['text', 'conține textul'],
  ['top', 'cele mai mari (câte?)'], ['bottom', 'cele mai mici (câte?)'], ['above', 'peste medie'], ['below', 'sub medie'],
];

function FilterMenu({ x, y, col, values, off, cond: cond0, colors, color, onApply, onSort, active, onClearCol, onClose }: FilterMenuProps) {
  const [unchecked, setUnchecked] = useState(() => new Set(off));
  const [cop, setCop] = useState<FilterOp | ''>(cond0?.op ?? '');
  const [cv1, setCv1] = useState(cond0?.v1 ?? '');
  const [cv2, setCv2] = useState(cond0?.v2 ?? '');
  const condNeeds = cop !== '' && cop !== 'above' && cop !== 'below';
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const shown = q ? values.filter((v) => fold(v.text).includes(fold(q))) : values;
  const allOn = shown.every((v) => !unchecked.has(v.text));

  useEffect(() => {
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    window.addEventListener('mousedown', down);
    return () => window.removeEventListener('mousedown', down);
  }, [onClose]);

  // Nu ieșim din fereastră dacă meniul e lângă marginea din dreapta sau de jos.
  const left = Math.max(4, Math.min(x, window.innerWidth - 264));
  const top = Math.max(4, Math.min(y, window.innerHeight - 420));

  const toggle = (t: string) => setUnchecked((s) => {
    const n = new Set(s);
    if (n.has(t)) n.delete(t); else n.add(t);
    return n;
  });

  const toggleAll = () => setUnchecked((s) => {
    const n = new Set(s);
    for (const v of shown) if (allOn) n.add(v.text); else n.delete(v.text);
    return n;
  });

  // Cu o căutare scrisă, rămân vizibile doar valorile găsite și bifate (ca în Excel).
  const apply = () => {
    if (cop) {
      if (condNeeds && cop !== 'top' && cop !== 'bottom' && (!cv1.trim() || (cop === 'between' && !cv2.trim()))) { alert('Scrie valoarea pentru condiție.'); return; }
      onApply([], { op: cop, v1: cv1.trim(), ...(cop === 'between' ? { v2: cv2.trim() } : {}) });
      return;
    }
    const out = q
      ? values.filter((v) => !shown.includes(v) || unchecked.has(v.text)).map((v) => v.text)
      : values.filter((v) => unchecked.has(v.text)).map((v) => v.text);
    if (out.length === values.length) { alert('Lasă bifată măcar o valoare, altfel tabelul ar rămâne gol.'); return; }
    onApply(out);
  };

  return (
    <div
      className="filter-menu"
      ref={ref}
      style={{ left, top }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        else if (e.key === 'Enter') { e.preventDefault(); apply(); }
      }}
    >
      <div className="filter-menu-head">Filtru pe coloana {col}</div>
      <button onClick={() => onSort(false)}>Sortează A→Z</button>
      <button onClick={() => onSort(true)}>Sortează Z→A</button>
      <button onClick={onClearCol} disabled={!active}>Scoate filtrul de pe coloana {col}</button>
      {(colors.bg.length > 0 || colors.fg.length > 0) && (
        <div className="filter-colors">
          {(['bg', 'fg'] as const).filter((k) => colors[k].length).map((k) => (
            <div key={k} className="filter-colors-row">
              <span>{k === 'bg' ? 'Fundal:' : 'Text:'}</span>
              {colors[k].map((v) => {
                const on = color?.kind === k && color.color === v.color;
                const label = `${k === 'bg' ? (v.color === 'none' ? 'Fără fundal' : 'Fundal ' + v.color) : (v.color === 'none' ? 'Text obișnuit' : 'Text ' + v.color)} (${v.count})`;
                return (
                  <button
                    key={v.color}
                    className={`filter-swatch${on ? ' on' : ''}${v.color === 'none' ? ' none' : ''}`}
                    title={on ? label + ' · clic ca să scoți filtrul' : label}
                    aria-label={label}
                    aria-pressed={on}
                    style={k === 'bg' ? { background: v.color === 'none' ? undefined : v.color } : { color: v.color === 'none' ? undefined : v.color }}
                    onClick={() => onApply([], undefined, on ? undefined : { kind: k, color: v.color })}
                  >
                    {k === 'fg' ? 'A' : ''}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
      <div className="filter-cond">
        <select value={cop} onChange={(e) => setCop(e.target.value as FilterOp | '')} aria-label="Filtru după condiție">
          <option value="">Filtru după condiție: niciuna</option>
          {FILTER_LABELS.map(([k, label]) => <option key={k} value={k}>Arată doar: {label}</option>)}
        </select>
        {condNeeds && (
          <span className="filter-cond-vals">
            <input value={cv1} onChange={(e) => setCv1(e.target.value)} placeholder={cop === 'text' ? 'text' : cop === 'top' || cop === 'bottom' ? '10' : 'valoare'} aria-label="Valoarea condiției" />
            {cop === 'between' && <input value={cv2} onChange={(e) => setCv2(e.target.value)} placeholder="și" aria-label="A doua valoare" />}
          </span>
        )}
      </div>
      <input autoFocus placeholder="Caută…" value={q} onChange={(e) => setQ(e.target.value)} disabled={!!cop} />
      <div className={`filter-list${cop ? ' off' : ''}`}>
        <label className="filter-all">
          <input type="checkbox" checked={allOn} onChange={toggleAll} />
          {q ? '(Selectează tot ce s-a găsit)' : '(Selectează tot)'}
        </label>
        {shown.map((v) => (
          <label key={v.text} className={v.text === EMPTY ? 'filter-empty' : ''}>
            <input type="checkbox" checked={!unchecked.has(v.text)} onChange={() => toggle(v.text)} />
            <span className="filter-val">{v.text}</span>
            <span className="filter-count">{v.count}</span>
          </label>
        ))}
        {!shown.length && <div className="filter-none">Nu s-a găsit nimic</div>}
      </div>
      <div className="filter-actions">
        <button className="primary" onClick={apply}>OK</button>
        <button onClick={onClose}>Renunță</button>
      </div>
    </div>
  );
}

interface RowHandlers {
  onSelect(r: number, c: number, shift: boolean, ctrl: boolean, edges?: string): void;
  /** Mouse-ul e pe marginea selecției (de unde se poate trage ca să muți celulele). */
  onMoveEdge(r: number, c: number, edges: string): boolean;
  onEnter(r: number, c: number): void;
  onFillStart(): void;
  onFillAuto(): void;
  /** Butonul ⚡ Analiză rapidă de lângă colțul zonei. */
  onQuick(x: number, y: number): void;
  /** Butonul ⚠ de lângă un număr scris ca text: Conversie în număr / Ignorare eroare. */
  onNumText(x: number, y: number): void;
  onRowHead(r: number, shift: boolean, ctrl: boolean): void;
  onRowHeadEnter(r: number): void;
  onEdit(v: string, typed?: boolean, input?: HTMLTextAreaElement): void;
  onEditKey(e: React.KeyboardEvent): void;
  onStartEdit(r: number, c: number): void;
  onBlurEdit(): void;
  onFilterMenu(c: number, x: number, y: number): void;
  onPick(r: number, c: number): void;
  /** Clic pe caseta de bifat a unei celule. */
  onCheck(r: number, c: number): void;
  onSpin(r: number, c: number, d: number, set?: number): void;
  /** Clic pe o variantă (1…n) a butoanelor de opțiune / listei combo din celulă. */
  onOpt(r: number, c: number, k: number): void;
  /** Clic pe butonul cu macrocomandă din celulă. */
  onBtn(r: number, c: number): void;
  /** Ctrl+clic pe o celulă cu legătură. */
  onLink(link: string): void;
  onRowMenu(r: number, x: number, y: number): void;
  onRowResize(r: number, e: React.MouseEvent): void;
  onRowAuto(r: number): void;
  /** Click pe „-” / „+” din capul rândului: strânge sau desface grupul de deasupra. */
  onOutline(r: number): void;
}

interface RowProps {
  r: number;
  /** Valorile zero nu se arată (Opțiuni → Afișează zero, debifat). */
  nz?: boolean;
  /** Rând înghețat: la ce distanță de sus stă lipit (-1 = nu e înghețat); fb = ultimul rând înghețat. */
  ft: number;
  fb: boolean;
  /** Unde încep coloanele înghețate (pixeli de la stânga), despărțite prin virgulă. */
  fl: string;
  /** Fereastra de coloane desenate la foile late („înghețate|prima|ultima”), gol = toate. */
  cw: string;
  /** Coloanele celulelor nevalide de pe rând (încercuite), despărțite prin virgulă. */
  bad: string;
  /** Urmărirea formulelor: coloanele evidențiate pe rând și felul (p = folosite de formulă, d = care o folosesc). */
  trc: string;
  trk: string;
  /** Deasupra rândului e un sfârșit de pagină pus de mână. */
  pb: boolean;
  /** Coloanele cu sfârșit de pagină pus de mână în fața lor („3,6”), linie punctată verticală. */
  cpb: string;
  /** Vedere pagini: „felul rândului|prima coloană tipărită|ultima|coloanele cu care începe o pagină”; felul: x = nu se tipărește, a = începe o pagină. */
  pv: string;
  /** Arată formulele în loc de rezultate. */
  showF: boolean;
  cells: Cells;
  results: Results;
  styles: Styles;
  selCol: number;
  /** Coloanele selectate pe acest rând (rc0 > rc1 dacă rândul nu e în selecție). */
  rc0: number;
  rc1: number;
  /** Zonele adăugate cu Ctrl care trec prin acest rând, ca „c0-c1,c0-c1” (gol dacă nu e niciuna). */
  xr: string;
  /** Coloanele în care ajunge umplerea trasă cu mouse-ul. */
  fc0: number;
  fc1: number;
  /** Coloana cu pătrățelul de umplere (colțul de jos-dreapta al selecției), sau -1. */
  handleCol: number;
  /** Lângă pătrățelul de umplere apare butonul ⚡ Analiză rapidă (zonă de mai multe celule). */
  qa?: boolean;
  edit: string | null;
  /** Rând ascuns de filtru. */
  hidden: boolean;
  /** Deasupra lui sunt rânduri ascunse (capul rândului are o linie dublă, ca în Excel). */
  gap: boolean;
  /** Grupul: nivelul rândului și „-” / „+” dacă rândul are butonul grupului de deasupra („2-”, „0+”, gol). */
  ol: string;
  /** Pe rândul cu capul de tabel filtrat: coloanele cu ▾ și literele coloanelor filtrate („A,C”). */
  drop: { c0: number; c1: number; on: string } | null;
  /** Celula activă de pe rând are listă derulantă (se arată ▾ lângă ea). */
  pick: boolean;
  /** Evidențierea automată a celulelor (doar celulele atinse de o regulă). */
  looks: Record<string, CondLook>;
  /** Barele de date: „culoare:procent” pe celulă. */
  bars: Record<string, string>;
  /** Centrarea pe selecție: lățimea (px) peste care se centrează textul celulei. */
  across: Record<string, number>;
  /** Celulele îmbinate de pe rând (unde încep și ce coloane acoperă). */
  mg?: RowMerge;
  /** Înălțimea rândului, dacă e mai înalt decât de obicei (text încadrat). */
  height?: number;
  /** Câte coloane se desenează. */
  n: number;
  /** Coloanele marcate de „Compară” pe acest rând („1,4”). */
  mk: string;
  h: RowHandlers;
}

// O celulă al cărei rezultat e numărul 0 (scris de mână sau dat de o formulă), nu una goală sau cu eroare.
function isZeroCell(raw: string | undefined, res: Result | undefined): boolean {
  if (res) return !res.err && res.num && res.value === 0;
  return !!raw && isNumber(raw) && Number(raw.trim().replace(',', '.')) === 0;
}

// Încotro merge cursorul după Enter (Fișier → Opțiuni).
type EnterDir = 'down' | 'right' | 'up' | 'left' | 'none';
const ENTER_DIRS: [EnterDir, string][] = [['down', 'În jos'], ['right', 'La dreapta'], ['up', 'În sus'], ['left', 'La stânga'], ['none', 'Rămâne pe loc']];
/** Pasul săgeților în modul Introducere (rând, coloană). */
const ARROW_STEP: Record<string, [number, number]> = { ArrowDown: [1, 0], ArrowUp: [-1, 0], ArrowRight: [0, 1], ArrowLeft: [0, -1] };
const ENTER_STEP: Record<EnterDir, [number, number]> = { down: [1, 0], right: [0, 1], up: [-1, 0], left: [0, -1], none: [0, 0] };

// Marginile celulei lângă care e mouse-ul (cel mult 4 px): „t” sus, „b” jos, „l” stânga, „r” dreapta.
function edgesAt(e: React.MouseEvent<HTMLElement>): string {
  const b = e.currentTarget.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top, k = 4;
  return (y <= k ? 't' : '') + (y >= b.height - k ? 'b' : '') + (x <= k ? 'l' : '') + (x >= b.width - k ? 'r' : '');
}

// Un rând se redesenează doar dacă s-a schimbat ceva în el (se desenează doar rândurile vizibile, cu coloanele din viewCols).
// Culorile chenarelor pentru celulele dintr-o formulă scrisă acum (prima referință albastră, a doua roșie...).
const REF_COLORS = ['#1e6fd9', '#d93025', '#8e44ad', '#188038', '#c26401', '#00838f'];

/** De la câte coloane desenate se desenează doar cele din jurul ecranului. */
const WIDE_COLS = 150;
/** Pentru coloana c, la fereastra cw („înghețate|prima|ultima”): 0 = se desenează, -1 = e acoperită de o celulă goală,
 *  altfel câte coloane cuprinde celula goală care începe aici (în stânga ferestrei sau în dreapta ei). */
function padCell(cw: string, c: number, n: number): number {
  const [fz, b, d] = cw.split('|').map(Number);
  if (c >= fz && c < b) return c === fz ? b - fz : -1;
  if (c > d) return c === d + 1 ? n - d - 1 : -1;
  return 0;
}

/** Cel mult atâtea coloane cuprinde o celulă sau un <col span>: browserul taie la 1000, iar atunci tabelul (cu lățimea
 *  tuturor coloanelor) își împarte restul pe coloanele desenate și toate ies de ~16 ori mai late (rând întreg ales, coloana ALL). */
const MAX_SPAN = 1000;
/** Celula goală de n coloane care începe la c, în bucăți [început, câte] de cel mult MAX_SPAN coloane. */
function padParts(c: number, n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 0; k < n; k += MAX_SPAN) out.push([c + k, Math.min(MAX_SPAN, n - k)]);
  return out;
}

/** Coloanele prin care trece un rând: toate, sau la fereastra cw cele înghețate, începutul celulelor goale și fereastra. */
function drawnCols(cw: string, n: number): number[] {
  if (!cw) return Array.from({ length: n }, (_, c) => c);
  const [fz, b, d] = cw.split('|').map(Number);
  const out: number[] = [];
  for (let c = 0; c < fz; c++) out.push(c);
  if (b > fz) out.push(fz);
  for (let c = b; c <= d; c++) out.push(c);
  if (d < n - 1) out.push(d + 1);
  return out;
}

const Row = memo(function Row({ r, cells, results, styles, selCol, rc0, rc1, xr, fc0, fc1, handleCol, qa, edit, hidden, gap, ol, drop, pick, looks, bars, across, mg, height, n, showF, mk, bad, trc, trk, pb, cpb, pv, ft, fb, fl, cw, h, nz }: RowProps) {
  const fls = fl ? fl.split(',').map(Number) : [];
  // Celulele înghețate stau lipite (sus și/sau în stânga); cele din colțul înghețat deasupra tuturor.
  const stick = (c: number): React.CSSProperties | undefined => {
    const left = c < fls.length ? fls[c] : undefined;
    if (left === undefined && ft < 0) return undefined;
    return { position: 'sticky', ...(left !== undefined ? { left } : {}), ...(ft >= 0 ? { top: ft } : {}), zIndex: (left !== undefined ? 2 : 0) + (ft >= 0 ? 3 : 0) };
  };
  const [pvKind, pvC0, pvC1, pvCols] = pv ? pv.split('|') : [];
  const pvBreak = pvCols ? new Set(pvCols.split(',').map(Number)) : null;
  const colBreak = cpb ? new Set(cpb.split(',').map(Number)) : null;
  const marked = mk ? new Set(mk.split(',').map(Number)) : null;
  const invalid = bad ? new Set(bad.split(',').map(Number)) : null;
  const traced = trc ? new Set(trc.split(',').map(Number)) : null;
  const { onSelect, onMoveEdge, onEnter, onFillStart, onFillAuto, onQuick, onRowHead, onRowHeadEnter, onEdit, onEditKey, onStartEdit, onBlurEdit, onFilterMenu, onPick, onCheck, onSpin, onOpt, onBtn, onLink, onRowMenu, onRowResize, onRowAuto, onOutline, onNumText } = h;
  const filteredCols = drop ? drop.on.split(',') : [];
  const xs = xr ? xr.split(',').map((p) => p.split('-').map(Number) as [number, number]) : [];
  return (
    <tr data-r={r} className={[hidden ? 'filtered-out' : height ? 'tall' : '', pb ? 'page-break' : '', pvKind === 'a' ? 'auto-break' : '', ft >= 0 ? 'fzr' : '', fb ? 'fzr-last' : ''].filter(Boolean).join(' ') || undefined} style={height ? { height } : undefined}>
      <th
        className={`${rc1 >= 0 || xr ? 'on' : ''}${gap ? ' gap-above' : ''}`}
        style={ft >= 0 ? { top: ft, zIndex: 6 } : undefined}
        title={gap ? 'Deasupra sunt rânduri ascunse: selectează rândurile din jur, clic dreapta → Afișează' : undefined}
        onMouseDown={(e) => { e.preventDefault(); if (e.button === 0) onRowHead(r, e.shiftKey, e.ctrlKey); }}
        onMouseEnter={(e) => { if (e.buttons & 1) onRowHeadEnter(r); }}
        onContextMenu={(e) => { e.preventDefault(); onRowMenu(r, e.clientX, e.clientY); }}
      >
        {r + 1}
        {parseInt(ol) > 0 && <span className="ol-mark" style={{ width: parseInt(ol) * 3 }} />}
        {/[+-]/.test(ol) && (
          <button className="ol-btn" tabIndex={-1} title={ol.endsWith('+') ? 'Desface grupul de rânduri de deasupra' : 'Strânge grupul de rânduri de deasupra'}
            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onOutline(r); }}>{ol.endsWith('+') ? '+' : '−'}</button>
        )}
        <span
          className="row-resize"
          title="Trage ca să schimbi înălțimea rândului (dublu-click: înălțime automată)"
          onMouseDown={(e) => onRowResize(r, e)}
          onDoubleClick={(e) => { e.stopPropagation(); onRowAuto(r); }}
        />
      </th>
      {drawnCols(cw, n).map((c) => {
        const pad = cw ? padCell(cw, c, n) : 0;
        if (pad) return pad < 0 ? null : padParts(c, pad).map(([c0, k]) => <td key={'p' + c0} className="col-pad" aria-hidden colSpan={k} />);
        if (mg?.covered.has(c)) return null;
        const span = mg?.start[c];
        const id = cellId(r, c);
        const res = results[id];
        const st = styles[id];
        const formula = showF && cells[id]?.startsWith('=');
        const v = formula ? cells[id] : nz && isZeroCell(cells[id], res) ? '' : cellText(cells[id], res, st);
        const look = looks[id];
        const link = st?.link ?? formulaLink(cells[id]);
        const codeColor = st?.code && !look ? cellCodeColor(cells[id], res, st) : undefined;
        const css0 = withBar(withEdges(look ? cellCss({ ...st, ...COND_LOOKS[look].style }) : st && cellCss(codeColor ? { ...st, color: codeColor } : st), edges(styles, r, c)), bars[id]);
        const selected = c === selCol;
        // Centrarea pe selecție: textul trece peste celulele goale de alături (nu și cât timp e editat).
        const aw = selected && edit !== null ? undefined : across[id];
        const css1: React.CSSProperties | undefined = aw ? { ...css0, overflow: 'visible', zIndex: 1 } : css0;
        const fz = stick(c);
        const css = fz ? { ...css1, ...fz } : css1;
        const nt = !formula && isNumText(cells[id]) && !st?.ign;
        const cls = (formula ? 'show-f' : res?.err ? 'err' : (res ? res.num : isNumber(cells[id] ?? '')) ? 'num' : '') + (nt ? ' num-text' : '');
        const inRange = (c >= rc0 && c <= rc1) || xs.some(([a, b]) => c >= a && c <= b);
        const inFill = c >= fc0 && c <= fc1 && !inRange;
        return (
          <td
            key={c}
            colSpan={span && span.cs > 1 ? span.cs : undefined}
            rowSpan={span && span.rs > 1 ? span.rs : undefined}
            className={`${selected ? 'sel' : inRange ? 'in' : ''} ${inFill ? 'fill' : ''} ${cls}${st?.note ? ' has-note' : ''}${st?.cmt ? (st.cdone ? ' has-cmt cmt-done' : ' has-cmt') : ''}${marked?.has(c) ? ' cmp-diff' : ''}${invalid?.has(c) ? ' cell-invalid' : ''}${traced?.has(c) ? (trk === 'p' ? ' trace-p' : ' trace-d') : ''}${link ? ' cell-link' : ''}${res?.img && !formula ? ' has-img' : ''}${pv && (pvKind === 'x' || c < +pvC0 || c > +pvC1) ? ' pv-out' : ''}${pvBreak?.has(c) ? ' pv-col' : ''}${colBreak?.has(c) ? ' col-break' : ''}${c < fls.length ? ' fzc' : ''}${c === fls.length - 1 ? ' fzc-last' : ''}`}
            style={css}
            title={link ? `Ctrl+clic: deschide ${link.replace(/^mailto:/i, '')}` + (st?.note ? ` (notă: ${st.note})` : '') : res?.err ? ERROR_HELP[res.err] + (st?.note ? `

Notă: ${st.note}` : '') : st?.note ?? (st?.cmt ? threadText(st.cmt, st.cdone) : undefined)}
            onMouseDown={(e) => {
              if (link && e.ctrlKey && e.button === 0 && !(selected && edit !== null)) { e.preventDefault(); onLink(link); return; }
              if (e.button === 2 && (selected || inRange)) { e.preventDefault(); return; }
              if (!(selected && edit !== null)) { e.preventDefault(); onSelect(r, c, e.shiftKey, e.ctrlKey, (selected || inRange) && e.button === 0 ? edgesAt(e) : ''); }
            }}
            onMouseMove={selected || inRange ? (e) => { const el = e.currentTarget, on = onMoveEdge(r, c, edgesAt(e)); if (on !== (el.dataset.mv === '1')) { el.dataset.mv = on ? '1' : ''; el.style.cursor = on ? 'move' : ''; } } : undefined}
            onMouseEnter={() => onEnter(r, c)}
            onDoubleClick={() => onStartEdit(r, c)}
          >
            {c === handleCol && (
              <span
                className="fill-handle"
                title="Trage ca să umpli celulele (dublu-click: umple în jos)"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onFillStart(); }}
                onDoubleClick={(e) => { e.stopPropagation(); onFillAuto(); }}
              />
            )}
            {selected && nt && edit === null && (
              <button className="numtext-btn" tabIndex={-1} title="Numărul din celulă e scris ca text" aria-label="Număr stocat ca text"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); const b = e.currentTarget.getBoundingClientRect(); onNumText(b.left, b.bottom + 4); }}>⚠</button>
            )}
            {c === handleCol && qa && (
              <button className="qa-btn" title="Analiză rapidă (Ctrl+Q): evidențieri, grafice, totaluri, tabel, minigrafice" aria-label="Analiză rapidă"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); const b = e.currentTarget.getBoundingClientRect(); onQuick(b.left, b.bottom + 4); }}>⚡</button>
            )}
            {drop && c >= drop.c0 && c <= drop.c1 && (
              <button
                className={`filter-drop ${filteredCols.includes(colName(c)) ? 'on' : ''}`}
                title={filteredCols.includes(colName(c)) ? 'Coloana e filtrată; click ca să schimbi' : 'Filtrează sau sortează coloana'}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const b = e.currentTarget.getBoundingClientRect();
                  onFilterMenu(c, b.left, b.bottom + 2);
                }}
              >
                ▾
              </button>
            )}
            {selected && pick && edit === null && (
              <button
                className="list-drop"
                title="Alege din listă (Alt+↓)"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onPick(r, c); }}
              >
                ▾
              </button>
            )}
            {selected && edit !== null ? (
              <textarea
                className="cell-input"
                // Formulele nu se verifică ortografic (fără linia roșie sub =B2*C2).
                spellCheck={!edit.startsWith('=')}
                // Focus și cursor la final imediat ce apare căsuța (autoFocus lăsa cursorul înaintea primei litere,
                // iar literele următoare intrau în fața ei sau se pierdeau). Doar când nu are deja focus,
                // ca să nu mutăm cursorul cât scrii în mijlocul textului.
                ref={(t) => {
                  if (t && document.activeElement !== t) {
                    t.focus();
                    t.setSelectionRange(t.value.length, t.value.length);
                  }
                }}
                rows={1}
                value={edit}
                onChange={(e) => { const k = (e.nativeEvent as InputEvent).inputType; onEdit(e.target.value, k === 'insertText' || k === 'insertCompositionText', e.target); }}
                onKeyDown={onEditKey}
                onBlur={onBlurEdit}
              />
            ) : st?.chk && !formula ? (
              <span
                className={`cell-check${res?.text === 'ADEVĂRAT' || isCheckedValue(cells[id]) ? ' on' : ''}`}
                role="checkbox"
                aria-checked={res?.text === 'ADEVĂRAT' || isCheckedValue(cells[id])}
                onMouseDown={(e) => { if (e.button !== 0 || e.shiftKey || e.ctrlKey) return; e.preventDefault(); e.stopPropagation(); onSelect(r, c, false, false); onCheck(r, c); }}
              >
                {res?.text === 'ADEVĂRAT' || isCheckedValue(cells[id]) ? '☑' : '☐'}
              </span>
            ) : st?.btn ? (
              <span className="cell-btn-wrap">
                <button type="button" className="cell-btn" tabIndex={-1} title={`Rulează macrocomanda „${st.btn.macro}”`}
                  onMouseDown={(e) => { if (e.button !== 0 || e.shiftKey || e.ctrlKey) return; e.preventDefault(); e.stopPropagation(); }}
                  onClick={(e) => { if (e.shiftKey || e.ctrlKey) return; e.stopPropagation(); onBtn(r, c); }}>
                  {st.btn.label || v || st.btn.macro}
                </button>
              </span>
            ) : st?.opt && !formula ? (
              st.opt.combo ? (
                <select className="cell-opt-combo" aria-label="Listă combo" value={String(optIndex(cells[id], st.opt.items.length))}
                  onMouseDown={(e) => { if (e.button !== 0) return; e.stopPropagation(); onSelect(r, c, false, false); }}
                  onChange={(e) => onOpt(r, c, Number(e.target.value))}>
                  <option value="0">—</option>
                  {st.opt.items.map((x, i) => <option key={i} value={i + 1}>{x}</option>)}
                </select>
              ) : (
                <span className="cell-opt" role="radiogroup">
                  {st.opt.items.map((x, i) => {
                    const on = optIndex(cells[id], st.opt!.items.length) === i + 1;
                    return (
                      <span key={i} role="radio" aria-checked={on} className={on ? 'on' : undefined}
                        onMouseDown={(e) => { if (e.button !== 0 || e.shiftKey || e.ctrlKey) return; e.preventDefault(); e.stopPropagation(); onSelect(r, c, false, false); onOpt(r, c, i + 1); }}>
                        {on ? '◉' : '○'} {x}
                      </span>
                    );
                  })}
                </span>
              )
            ) : st?.spin && !formula ? (
              <span className="cell-spin">
                {st.spin.bar && (
                  <input type="range" aria-label="Bară de defilare" min={st.spin.min} max={st.spin.max} step={st.spin.step}
                    value={Number.isFinite(Number(String(cells[id] ?? '').replace(',', '.'))) ? Number(String(cells[id] ?? '').replace(',', '.')) : st.spin.min}
                    onMouseDown={(e) => { e.stopPropagation(); onSelect(r, c, false, false); }}
                    onChange={(e) => onSpin(r, c, 0, Number(e.target.value))} />
                )}
                <span className="cell-spin-v">{v}</span>
                {!st.spin.bar && (
                  <span className="cell-spin-btns">
                    <span role="button" aria-label="Crește" title="Crește cu un pas"
                      onMouseDown={(e) => { if (e.button !== 0) return; e.preventDefault(); e.stopPropagation(); onSelect(r, c, false, false); onSpin(r, c, 1); }}>▲</span>
                    <span role="button" aria-label="Scade" title="Scade cu un pas"
                      onMouseDown={(e) => { if (e.button !== 0) return; e.preventDefault(); e.stopPropagation(); onSelect(r, c, false, false); onSpin(r, c, -1); }}>▼</span>
                  </span>
                )}
              </span>
            ) : res?.img && !formula ? <CellImageView img={res.img} />
              : aw ? <span className="across-text" style={{ width: aw }}>{v}</span>
              : st?.rot ? <RotText rot={st.rot} text={v} />
              : v}
          </td>
        );
      })}
    </tr>
  );
}, (a, b) => {
  if (a.selCol !== b.selCol || a.edit !== b.edit || a.rc0 !== b.rc0 || a.rc1 !== b.rc1 || a.xr !== b.xr) return false;
  if (a.fc0 !== b.fc0 || a.fc1 !== b.fc1 || a.handleCol !== b.handleCol || a.qa !== b.qa) return false;
  if (a.cw !== b.cw) return false;
  if (a.pick !== b.pick || a.mg?.key !== b.mg?.key || a.height !== b.height || a.n !== b.n || a.showF !== b.showF || a.nz !== b.nz || a.mk !== b.mk || a.bad !== b.bad || a.trc !== b.trc || a.trk !== b.trk || a.pb !== b.pb || a.cpb !== b.cpb || a.pv !== b.pv) return false;
  if (a.hidden !== b.hidden || a.gap !== b.gap || a.ol !== b.ol || a.drop?.c0 !== b.drop?.c0 || a.drop?.c1 !== b.drop?.c1 || a.drop?.on !== b.drop?.on) return false;
  if (a.cells === b.cells && a.results === b.results && a.styles === b.styles && a.looks === b.looks && a.bars === b.bars && a.across === b.across) return true;
  for (const c of drawnCols(a.cw, a.n)) {
    const id = cellId(a.r, c);
    if (a.cells[id] !== b.cells[id] || a.styles[id] !== b.styles[id] || a.looks[id] !== b.looks[id] || a.bars[id] !== b.bars[id] || a.across[id] !== b.across[id]) return false;
    // Linia de sus a celulei de dedesubt se desenează ca linie de jos a acestui rând.
    const below = cellId(a.r + 1, c);
    if (a.styles[below]?.bd !== b.styles[below]?.bd) return false;
    const ra = a.results[id];
    const rb = b.results[id];
    if (ra?.text !== rb?.text || ra?.err !== rb?.err || imageKey(ra?.img) !== imageKey(rb?.img)) return false;
  }
  return true;
});

/** Adresa dintr-o formulă =HYPERLINK("adresa"; …) scrisă direct (nu calculată); altfel null. */
function formulaLink(raw: string | undefined): string | null {
  const m = raw ? /^=[ ]*HYPERLINK[ ]*[(][ ]*"([^"]+)"/i.exec(raw) : null;
  return m ? cleanLink(m[1]) : null;
}

/** Valoarea unei casete de bifat e bifată (ADEVĂRAT / TRUE). */
function isCheckedValue(raw: string | undefined): boolean {
  return /^(TRUE|ADEV[ĂA]RAT)$/i.test((raw ?? '').trim());
}

/** Centrarea pe selecție: pentru fiecare celulă cu text și „across”, lățimea ei plus a celulelor goale „across” din dreapta. */
function acrossWidths(cells: Cells, styles: Styles, widths: number[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, st] of Object.entries(styles)) {
    if (st.align !== 'across' || !(cells[id] ?? '').trim()) continue;
    const p = parseCellId(id);
    if (!p) continue;
    let w = widths[p.c] ?? COL_W;
    let c = p.c + 1;
    while (c < COLS && styles[cellId(p.r, c)]?.align === 'across' && !cells[cellId(p.r, c)]) w += widths[c++] ?? COL_W;
    if (c > p.c + 1) out[id] = w;
  }
  return out;
}

/** Bara de date: o bandă colorată de la stânga, cât procentul valorii (sub text, peste fundal). */
function withBar(css: React.CSSProperties | undefined, bar: string | undefined): React.CSSProperties | undefined {
  if (!bar) return css;
  // Minigraficul: desenul pe toată celula, peste fundal.
  if (bar.startsWith('sp:')) return { ...css, backgroundImage: bar.slice(3), backgroundRepeat: 'no-repeat', backgroundSize: 'calc(100% - 6px) calc(100% - 6px)', backgroundPosition: 'center' };
  // Scala de culori: doar fundalul celulei.
  if (bar.startsWith('bg:')) return { ...css, backgroundColor: bar.slice(3) };
  // Pictograma: în stânga celulei, ca în Excel (numărul rămâne aliniat la dreapta).
  if (bar.startsWith('ic:')) {
    const [, look, level] = bar.split(':');
    return { ...css, backgroundImage: iconUrl(look as CondLook, Number(level)), backgroundRepeat: 'no-repeat', backgroundSize: '13px 13px', backgroundPosition: '3px center', paddingLeft: 19 };
  }
  const [color, pct] = bar.split(':');
  const fill = `linear-gradient(90deg, ${color}cc 0%, ${color}66 ${pct}%, transparent ${pct}%)`;
  return { ...css, backgroundImage: fill, backgroundRepeat: 'no-repeat', backgroundSize: '100% 70%', backgroundPosition: 'left center' };
}

/**
 * Liniile de chenar ale unei celule, peste liniile obișnuite ale grilei (aceeași grosime, deci rândurile nu se mișcă).
 * Liniile medii, groase și duble se îngroașă spre interiorul celulei cu umbre (dubla: linie, gol, linie).
 */
function withEdges(css: React.CSSProperties | undefined, e: Edges): React.CSSProperties | undefined {
  if (!e.t && !e.b && !e.l && !e.r) return css;
  const col = (k: 't' | 'b' | 'l' | 'r') => e.look?.[k]?.col ?? 'var(--text)';
  const bg = String(css?.backgroundColor ?? 'var(--bg)');
  const shadows: string[] = [];
  // dx, dy: spre interior; pentru dreapta / jos linia de bază e chenarul grilei, pentru sus / stânga o umbră de 1px.
  const side = (k: 't' | 'b' | 'l' | 'r', dx: number, dy: number, base: boolean) => {
    const st = e.look?.[k]?.st, c = col(k);
    const at = (n: number, color: string) => `inset ${dx * n}px ${dy * n}px 0 ${color}`;
    const o = base ? 0 : 1;
    if (!base) shadows.push(at(1, c));
    if (st === 'medium') shadows.push(at(1 + o, c));
    else if (st === 'thick') shadows.push(at(2 + o, c));
    else if (st === 'double') shadows.push(at(1 + o, bg), at(2 + o, c));
  };
  if (e.t) side('t', 0, 1, false);
  if (e.l) side('l', 1, 0, false);
  if (e.r) side('r', -1, 0, true);
  if (e.b) side('b', 0, -1, true);
  const dash = (k: 'r' | 'b') => (e.look?.[k]?.st === 'dashed' ? 'dashed' : e.look?.[k]?.st === 'dotted' ? 'dotted' : undefined);
  return {
    ...css,
    ...(e.r ? { borderRightColor: col('r'), ...(dash('r') ? { borderRightStyle: dash('r') } : {}) } : {}),
    ...(e.b ? { borderBottomColor: col('b'), ...(dash('b') ? { borderBottomStyle: dash('b') } : {}) } : {}),
    ...(shadows.length ? { boxShadow: shadows.join(', ') } : {}),
  };
}

/**
 * Textul rotit dintr-o celulă: vertical (scris de jos în sus sau de sus în jos) sau înclinat. La tipărire, textul înclinat
 * își păstrează loc deasupra (rândul tipărit crește cu cât urcă textul), fiindcă acolo rândurile nu au înălțimea de pe ecran.
 */
function RotText({ rot, text, print }: { rot: number; text: string; print?: boolean }) {
  // Pe ecran textul vertical rămâne în înălțimea rândului; la tipărire rândul crește după text.
  if (rot === STACKED) return <span className="cell-rot v stack" style={print ? { maxHeight: 'none' } : undefined}>{text}</span>;
  if (Math.abs(rot) === 90) return <span className="cell-rot v" style={{ ...(rot > 0 ? { transform: 'rotate(180deg)' } : {}), ...(print ? { maxHeight: 'none' } : {}) }}>{text}</span>;
  const rise = print ? Math.round(text.length * 0.55 * Math.sin(Math.abs(rot) * Math.PI / 180) * 10) / 10 : 0;
  return <span className="cell-rot" style={{ transform: `rotate(${-rot}deg)`, ...(rise ? { marginTop: `${rise}em` } : {}) }}>{text}</span>;
}

/** La tipărire, chenarele se desenează ca linii negre; sus și stânga și pe primul rând / prima coloană tipărite. */
function printEdges(css: React.CSSProperties | undefined, styles: Styles, r: number, c: number, r0: number, c0: number): React.CSSProperties | undefined {
  const e = edges(styles, r, c);
  const own = styles[cellId(r, c)]?.bd ?? '';
  const t = own.includes('t') && r === r0;
  const l = own.includes('l') && c === c0;
  if (!e.b && !e.r && !t && !l) return css;
  const me = styles[cellId(r, c)];
  const mine = { st: me?.bdStyle, col: me?.bdColor };
  return {
    ...css,
    ...(e.r ? { borderRight: printLine(e.look?.r) } : {}),
    ...(e.b ? { borderBottom: printLine(e.look?.b) } : {}),
    ...(t ? { borderTop: printLine(mine) } : {}),
    ...(l ? { borderLeft: printLine(mine) } : {}),
  };
}

/** Coduri de format propuse în fereastra Format particularizat. */
const CODE_EXAMPLES: [string, string][] = [
  ['#,##0.00 "buc."', 'Bucăți'], ['#,##0.00;[Red]-#,##0.00', 'Negativele cu roșu'], ['0.0%', 'Procent cu o zecimală'], ['#,##0,"K"', 'În mii'],
  ['0.00E+00', 'Științific'], ['# ?/?', 'Fracție'], ['dd.mm.yyyy', 'Dată'], ['dddd, d mmmm yyyy', 'Dată lungă cu ziua'], ['[h]:mm', 'Ore adunate (peste 24)'],
  ['000000', 'Cu zerouri în față'], ['0;-0;"—"', 'Zero ca liniuță'], ['"Cod: "@', 'Text cu prefix'],
];

function cellCss(st: CellStyle): React.CSSProperties {
  return {
    fontWeight: st.b ? 700 : undefined,
    fontStyle: st.i ? 'italic' : undefined,
    textDecoration: st.u || st.s ? [st.u && 'underline', st.s && 'line-through'].filter(Boolean).join(' ') : undefined,
    ...(st.font ? { fontFamily: `"${st.font}", system-ui, sans-serif` } : {}),
    ...(st.sz ? { fontSize: `${Math.round(st.sz * 13 / 11 * 10) / 10}px`, ...(st.wrap ? { lineHeight: 1.3 } : {}) } : {}),
    color: st.color,
    // backgroundColor, nu background: scoaterea proprietății scurte ar șterge și desenul barei de date (backgroundImage).
    backgroundColor: st.bg,
    textAlign: st.align === 'across' ? 'center' : st.align,
    ...(st.wrap ? { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: '17px', verticalAlign: 'top', paddingTop: 3, textOverflow: 'clip' } : {}),
    ...(st.va ? { verticalAlign: st.va } : {}),
    // Exponentul / indicele: textul cu o treime mai mic, lipit de partea de sus / de jos a celulei.
    ...(st.pos ? { fontSize: `${Math.round((st.sz ? st.sz * 13 / 11 : 13) * 0.7 * 10) / 10}px`, verticalAlign: st.pos === 'sup' ? 'top' : 'bottom' } : {}),
    // O treaptă de retragere e cât trei litere (ca în Excel); la textul aliniat la dreapta, retragerea e din dreapta.
    ...(st.ind ? (st.align === 'right' ? { paddingRight: 5 + st.ind * 9 } : { paddingLeft: 5 + st.ind * 9 }) : {}),
  };
}
