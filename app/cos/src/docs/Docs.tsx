// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hasHeaderRow, selectTablePart, setTableFit, sortTable, splitCellInto, splitTable, tableToText } from './tableOps';
import { unsavedLabel, useUnsaved } from '../unsaved';
import { signedNote } from '../officeFile';
import { EditorContent, useEditor, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Underline, UNDERLINE_STYLES, UNDERLINE_COLORS, type UnderlineStyle } from './underlineStyle';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import TextStyle from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { DocImage, ImageRibbonSlot, imageFilesFrom, insertImageFiles } from './image';
import { captureScreen } from '../screenshot';
import { drawSketchEx } from '../sketch';
import { SHAPES, shapeToPng } from './shapes';
import { makeQr, qrPng } from '../qr';
import { TextBox } from './textBox';
import ShapePicker from './ShapePicker';
import { insertChart } from './chart';
import { insertDiagram } from './diagram';
import { insertEquation } from './equation';
import { FontSize, WORD_SIZES } from './fontSize';
import { Search, getSearch } from './search';
import { api, BinaryFile, fileName, OpenedFile } from '../api';
import { insertFromFile, readImportedDoc } from './readImport';
import { insertSheet, linkedFileAtCursor, linkedTables, pickSheetFile, refreshLinkedSheets, staleLinkedSheets, type SheetFile } from './sheetInsert';
import { FILE_SAVED, openPath, samePath, type FileSaved } from '../fileKinds';
import { LineNumbers } from './LineNumbers';
import { pageHeaderImage, HF_FIELDS, HF_GALLERY, withHfFields, lineNums, LINE_NUM_STEPS, DOC_PROPS, docProps, type DocProps, labelMarkOf, markLabel, type LabelMark, emptyDoc, hasLayout, hasPageSetup, MARGINS, NO_PAGE_SETUP, PageSetup, pageColumns, pageColLine, pageEven, pageFirst, pageMargin, pageNumAt, pageNumStyle, numTokens, hfSlots, NUM_ATS, NUM_STYLES, type NumAt, type NumStyle, pageMargins, pagePaper, paperSize, PAPERS, type Paper, parseDoc, serializeDoc, pageWatermark, pageWatermarkColor, pageWatermarkFont, pageWatermarkImage, WATERMARKS, WATERMARK_COLORS, WATERMARK_FONTS, pageBackground, PAGE_COLORS, pageBorder, PAGE_BORDERS, type PageBorder } from './format';
import { LabelBadge, LabelRow } from './LabelRow';
import { safeFileName } from '../notes/format';
import VersionsDialog, { Compare } from '../Versions';
import PrintPreview from './PrintPreview';
import PageMarks from './PageMarks';
import DraftsDialog, { adoptDraft, draftOf, dropDraft, openDraftIds, useDraft } from '../Drafts';
import { DiffLine, diffLines, textLines } from '../versionText';
import { DOC_TEMPLATES, DocTemplate, nextPlaceholder, PLACEHOLDER_RE } from './templates';
import { amountWords } from '../sheets/words';
import { TableOfContents } from './toc';
import { PageBreak } from './pageBreak';
import { ColumnBreak } from './columnBreak';
import { breakBefore, SectionBreak, SECTION_KINDS, SECTION_MENU, SECTION_ORIENT_MENU, SECTION_TIPS, sectionHf, sectionHfList } from './sectionBreak';
import MergeDialog from './MergeDialog';
import TablePropsDialog from './TablePropsDialog';
import Ruler from './Ruler';
import LabelsDialog from './LabelsDialog';
import EnvelopeDialog from './EnvelopeDialog';
import { ADDRESS_FIELD, GREETING_FIELD, mergeAll, MergeData } from './merge';
import { applyImportedComments, Comment, listComments } from './comment';
import CommentsPanel from './CommentsPanel';
import NavPane from './NavPane';
import SplitPane from './SplitPane';
import A11yPane from './A11yPane';
import GrammarPane from './GrammarPane';
import ThesaurusPane, { wordAtCursor, replaceWord } from './ThesaurusPane';
import { synonyms } from '../thesaurus';
import InspectDialog from './InspectDialog';
import CompatDialog from './CompatDialog';
import ReadBar from './ReadMode';
import Immersive from './Immersive';
import GoToBar from './GoToBar';
import { Deletion, FormatChange, Insertion, listChanges, nearChange, TrackChanges, type DocChange } from './track';
import { RestrictDialog, UnrestrictDialog, type RestrictMode } from './RestrictDialog';
import type { SheetPw } from '../sheets/sheetPassword';
import { applyImportedChanges } from './markers';
import { continueNumber, listStart, setListStart } from './listNumbering';
import { loadProfile } from '../pdf/profile';
import { LINE_HEIGHTS, ParagraphFormat, Subscript, Superscript } from './paragraphFormat';
import { ParaStyleAttr } from './paraStyle';
import StylesPane from './StylesPane';
import ColorMenu from './ColorMenu';
import Ribbon, { RGroup, RMore, RMenu, RPop } from '../ribbon/Ribbon';
import { ARRANGE_TITLE, arrangeItems, canArrange } from '../arrangeWindows';
import { ClipboardGroup } from '../ribbon/Clipboard';
import MiniBar from '../ribbon/MiniBar';
import { useArrange } from '../ribbon/Arrange';
import { useContextMenu, ribbonClick, type CtxItem } from '../ribbon/contextMenu';
import { NodeSelection as PmNodeSelection, TextSelection as PmTextSelection } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';
import type { EditorView } from '@tiptap/pm/view';
import { Footnote, footnotePositions } from './footnote';
import { DocLink, normalizeHref } from './link';
import { CELL_COLORS, CellColor, CellVAlign } from './cellColor';
import { BORDER_KINDS, CellLines, PEN_STYLES, applyCellBorders, paintCell, sideAt, type BorderKind, type Pen } from './cellLines';
import { BorderTableView, TableBorders } from './tableBorders';
import { LINE_COLORS, LINE_SETS, LINE_STYLES } from './tableLines';
import { applyTableStyle, parseOpts, TABLE_STYLES, TableLook } from './tableStyles';
import { TableHeaderRepeat, isRepeatOn, toggleRepeatHeader } from './tableHeaderRepeat';
import { TableRowHeight, rowHeightAt, setRowHeight } from './tableRowHeight';
import FootnotesList from './FootnotesList';
import { FormatPainter, painterOf } from './formatPainter';
import SymbolPicker from './SymbolPicker';
import DateTimePicker from './DateTimePicker';
import QuickParts from './QuickParts';
import SignatureLine from './SignatureLine';
import { fillSignatureLine } from './signFill';
import BookmarkPicker from './BookmarkPicker';
import CrossRefPicker from './CrossRefPicker';
import CaptionPicker from './CaptionPicker';
import { CaptionNum } from './caption';
import { FormCheck } from './formCheck';
import { FormDrop, parseDropItems } from './formDrop';
import { FormDate } from './formDate';
import { TableOfFigures } from './figuresTable';
import { DocIndex, IndexEntry } from './indexEntry';
import IndexPicker from './IndexPicker';
import { AuthEntry, DocAuthorities } from './authorities';
import AuthPicker from './AuthPicker';
import CitationPicker from './CitationPicker';
import { Bibliography, Citation } from './citation';
import { updateXrefs } from './crossRef';
import { Bookmark, goToBookmark, isHiddenBookmark, listBookmarks } from './bookmark';
import ParagraphSpacing, { ParagraphQuick } from './ParagraphSpacing';
import StylePicker from './StylePicker';
import StyleGallery from './StyleGallery';
import FontDialog from './FontDialog';
import DocFormatGroup from './DocFormatGroup';
import { FamiliarKeys } from './familiarKeys';
import { SimilarSelection, selectSimilar } from './similarSel';
import { stylesCss, type DocStyles } from './docStyles';
import CoverPicker from './CoverPicker';
import { TabChar, TabStops } from './tabStops';
import ListStylePicker from './ListStylePicker';
import { ListStyle } from './listStyle';
import TablePicker from './TablePicker';
import DrawTable from './DrawTable';
import { PastePlain, pastePlainText } from './pastePlain';
import { SortParagraphs } from './sortParagraphs';
import { FormattingMarks, marksShown } from './formattingMarks';
import { GrammarMarks } from './grammarMarks';
import { Hyphenation } from './hyphenate';
import { Collapse, outlineLevel, collapsedCount } from './collapse';
import { DateTime } from './dateTime';
import { DocField, fieldPages, findMacroForBtn, insertMacroBtn, MacroBtn, macroBtnAt, updateFields } from './field';
import FieldPicker from './FieldPicker';
import { ChangeCase } from './changeCase';
import { TEXT_CASES, type TextCase } from '../textCase';
import { LETTER_SPACINGS, LetterFormat, PROOF_LANGS, TEXT_EFFECTS, type TextEffect } from './letterFormat';
import { detectDocLangs, dropAutoLang } from './langDetect';
import { BOX_LINES, BOX_SIDES, type BoxLine, type BoxLook, type BoxSides, PARAGRAPH_SHADES, ParagraphBox, parseBoxLook } from './paragraphBox';
import { fitPageZoom, fitZoom } from '../zoom';
import ZoomControl, { useZoom } from '../ZoomControl';
import { speak, stopSpeaking } from '../speak';
import { AutoCorrect } from './autoCorrect';
import { AutoComplete } from './autoComplete';
import AutoCorrectDialog from './AutoCorrectDialog';
import OptionsDialog from './OptionsDialog';
import DiacriticsDialog from '../DiacriticsDialog';
import { applyDia, DiaBlocks, diaBlocks } from './diacriticsDoc';
import { measurePages, pagePositions, setPageHeight } from './pageCount';
import { isCurrent, useTabKey } from '../active';
import { ask, askDiscard, askText, askYes } from '../ask';
import { OfficeSignDialog, signPackage } from '../OfficeSign';
import type { DigitalId, TsaClient } from '../pdf/digisign';
import { importedName, importedSave, keptStore, takeTabStart, useOpenInTab, useTabContent, useTabTitle } from '../tabs';
import IconsDialog from '../icons/IconsDialog';
import Model3DDialog from '../Model3DDialog';
import { keepModel } from '../model3d';
import type { Step as PmStep } from '@tiptap/pm/transform';
import type { Transaction as PmTransaction } from '@tiptap/pm/state';
import { useCommands } from '../commands';
import { DocMacroListDialog, DocMacroRecordDialog } from './MacrosDialog';
import { cleanDocMacros, docMacroForKey, endSelection, MAX_MACRO_STEPS, playSteps, recordSteps, type DocMacro } from './macros';

const AUTHOR_KEY = 'suite.docs.author';

// Numele pus pe comentarii: cel ales în panou, altfel cel din profilul de date (PDF), altfel gol.
function initialAuthor(): string {
  try {
    const saved = localStorage.getItem(AUTHOR_KEY);
    if (saved) return saved;
  } catch { /* fără acces la memoria locală */ }
  const p = loadProfile();
  return p ? `${p.prenume} ${p.nume}`.trim() : '';
}

const AUTOSAVE_MS = 1500;
/** Documentul deschis rămâne în memorie când treci în alt modul și îl regăsești la întoarcere, chiar nesalvat. */
const kept = keptStore<{ content: string; path: string | null; dirty: boolean }>();

interface Props {
  initial: OpenedFile | null;
  onConsumed(): void;
}

/** Numărul paginii cum se vede pe ecran, în forma aleasă (totalul de pagini se știe abia la PDF: „…”). */
const numText = (page: PageSetup, n: number) => numTokens(pageNumStyle(page)).map((t) => (t === 'P' ? String(n) : t === 'T' ? '…' : t)).join('');

export default function Docs({ initial, onConsumed }: Props) {
  // Cheia tabului: pot fi mai multe documente deschise, fiecare în tabul lui.
  const tab = useTabKey('doc');
  const [path, setPath] = useState<string | null>(null);
  // Fișierul adus prin import (.xlsx, .docx, .pptx…): numele lui stă pe tab până la prima salvare.
  const [fromFile, setFromFile] = useState<string | null>(null);
  useEffect(() => { if (path) setFromFile(null); }, [path]);
  const [verDlg, setVerDlg] = useState(false);
  const [draftDlg, setDraftDlg] = useState(false);
  // Previzualizare înaintea imprimării: PDF-ul paginilor (null = închisă).
  const [preview, setPreview] = useState<Uint8Array | null>(null);
  /** Previzualizarea e deschisă din Zoom → Mai multe pagini (grila, cu clic care duce la pagină). */
  const [previewMany, setPreviewMany] = useState(false);
  // Compararea cu un fișier Word primit înapoi: ce e doar în el (roșu) și ce e doar aici (verde).
  const [cmpFile, setCmpFile] = useState<{ name: string; diff: DiffLine[] | null; author?: string; date?: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  useUnsaved(tab, dirty ? unsavedLabel('Docs', path) : null);
  useTabTitle(tab, path || importedName(fromFile));
  const openInTab = useOpenInTab();
  useTabContent(tab, () => (editorRef.current ? serializeDoc(editorRef.current.getJSON(), page) : ''));
  const [status, setStatus] = useState('');
  const [signDlg, setSignDlg] = useState(false);
  const [, force] = useState(0);
  const [search, setSearch] = useState<'find' | 'replace' | null>(null);
  const [spell, setSpell] = useState(true);
  // Din lista ＋ → Din șablon…: tabul nou pornește cu fereastra de șabloane deschisă.
  const [tplDlg, setTplDlg] = useState(() => takeTabStart(tab) === 'template');
  const [sumDlg, setSumDlg] = useState(false);
  const [acDlg, setAcDlg] = useState(false);
  const [optDlg, setOptDlg] = useState(false);
  // Fișier → Opțiuni → Salvare automată (setarea aplicației; implicit pornită).
  const [autoSave, setAutoSave] = useState(true);
  const [autoLang, setAutoLang] = useState(true);
  const autoLangRef = useRef(true);
  const langTimer = useRef(0);
  // Revizuire › Diacritice: paragrafele de verificat (null = fereastra închisă).
  const [diaDlg, setDiaDlg] = useState<DiaBlocks | null>(null);
  const [showA11y, setShowA11y] = useState(false);
  const [showGrammar, setShowGrammar] = useState(false);
  const [showThes, setShowThes] = useState(false);
  const [showStyles, setShowStylesState] = useState(() => { try { return localStorage.getItem('suite.docs.styles') === '1'; } catch { return false; } });
  const setShowStyles = (on: boolean) => { setShowStylesState(on); try { localStorage.setItem('suite.docs.styles', on ? '1' : '0'); } catch { /* fără memorie locală */ } };
  const [linkDlg, setLinkDlg] = useState(false);
  const [mergeDlg, setMergeDlg] = useState(false);
  const [labelsDlg, setLabelsDlg] = useState(false);
  const [envDlg, setEnvDlg] = useState(false);
  // Tabelul ales pentru îmbinare rămâne ales cât e deschis modulul (nu se salvează în document).
  const [mergeData, setMergeData] = useState<MergeData | null>(null);
  const [showComments, setShowComments] = useState(true);
  const [goTo, setGoTo] = useState(false);
  // Citește cu voce tare (ca în Word: Revizuire → Citește cu voce tare): selecția, sau de la cursor până la sfârșit.
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => () => stopSpeaking(), []);
  const readAloud = () => {
    if (!editor) return;
    if (speaking) { stopSpeaking(); setSpeaking(false); return; }
    const { doc, selection } = editor.state;
    let from = selection.from, to = selection.to;
    if (from === to) { to = doc.content.size; if (!doc.textBetween(from, to, ' ', ' ').trim()) from = 0; }
    const text = doc.textBetween(from, to, String.fromCharCode(10), ' ').trim();
    if (!text) { setStatus('Documentul nu are text de citit.'); return; }
    setSpeaking(speak(text, () => setSpeaking(false)));
  };
  // Panoul de navigare rămâne deschis sau închis și la pornirea următoare.
  const [showNav, setShowNavState] = useState(() => { try { return localStorage.getItem('suite.docs.nav') === '1'; } catch { return false; } });
  const setShowNav = (on: boolean) => { setShowNavState(on); try { localStorage.setItem('suite.docs.nav', on ? '1' : '0'); } catch { /* fără memorie locală */ } };
  const [tracking, setTracking] = useState(false);
  // Cum se văd modificările urmărite (ca Afișare pentru revizuire): tot marcajul, marcaj simplu (doar o bară pe margine),
  // fără marcaj (textul final) sau originalul (textul de dinainte de modificări). Doar pe ecran și la tipărire; documentul nu se schimbă.
  const [markup, setMarkup] = useState<'all' | 'simple' | 'none' | 'orig'>('all');
  // Filtrul marcajului (ca Afișare marcaj): felurile și autorii ale căror modificări NU se mai marchează (se văd ca text final).
  const [mkOff, setMkOff] = useState<string[]>([]);
  const [mkMenu, setMkMenu] = useState(false);
  const [page, setPage] = useState<PageSetup>(NO_PAGE_SETUP);
  const [pageDlg, setPageDlg] = useState<boolean | string>(false);
  const [propsDlg, setPropsDlg] = useState(false);
  const [restrictDlg, setRestrictDlg] = useState(false);
  const [unrestrictDlg, setUnrestrictDlg] = useState(false);
  // Vizualizare → Macrocomenzi (macros.ts): fereastra deschisă, cele pentru toate documentele (din setări) și înregistrarea în curs.
  const [macroDlg, setMacroDlg] = useState<'rec' | 'list' | null>(null);
  const [myMacros, setMyMacros] = useState<DocMacro[]>([]);
  useEffect(() => { void api.getSettings().then((st) => setMyMacros(cleanDocMacros(st.docsMacros))).catch(() => {}); }, []);
  const recRef = useRef<{ name: string; rel: boolean; note: string; key: string; all: boolean; base: number; steps: PmStep[]; end: [number, number] | null } | null>(null);
  const [recName, setRecName] = useState<string | null>(null);
  const macroKeysRef = useRef<{ doc: DocMacro[]; mine: DocMacro[]; play(m: DocMacro): void } | null>(null);
  const [inspectDlg, setInspectDlg] = useState(false);
  const [compatDlg, setCompatDlg] = useState(false);
  // Mod concentrare: doar pagina, pe tot ecranul, fără bare (Esc iese).
  const [focusMode, setFocusMode] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  // Fiecare document are foaia lui de stil (Modifică stilul), ca stilurile schimbate să nu treacă în alte taburi.
  const styleScope = useRef('ds' + Math.random().toString(36).slice(2, 9)).current;
  const setDocStyles = (styles: DocStyles | undefined) => {
    setPage((p) => ({ ...p, styles }));
    setDirty(true);
    setStatus(path ? 'Se salvează…' : 'Nesalvat');
  };
  // Mod citire: textul pe coloane, întors ca paginile unei cărți, fără modificări.
  const [readMode, setReadMode] = useState(false);
  // Scindare (Vizualizare › Fereastră): partea de jos arată alt loc din același document.
  const [split, setSplit] = useState(false);
  // ✎ Desenare tabel (Inserare › Tabele): creionul de tabel e activ.
  const [drawTable, setDrawTable] = useState(false);
  const closeDrawTable = useCallback(() => setDrawTable(false), []);
  const [splitRatio, setSplitRatio] = useState(0.5);
  // 👓 Lectură (ca Cititorul imersiv): coloana de citit, literă mare, fundal liniștit, paragraful curent și citirea cu voce.
  const [immersive, setImmersive] = useState(false);
  const splitOn = split && !readMode && !focusMode && !immersive;
  // Aspect web: textul pe toată lățimea ferestrei, fără foaie și margini (doar pe ecran; tipărirea rămâne pe pagini). Se ține minte.
  const [webLayout, setWebLayout] = useState(() => { try { return localStorage.getItem('suite.docs.web') === '1'; } catch { return false; } });
  // Rigla de deasupra paginii (margini, retrageri, opriri de tabulator). Se ține minte.
  const [ruler, setRuler] = useState(() => { try { return localStorage.getItem('suite.docs.ruler') === '1'; } catch { return false; } });
  const toggleRuler = () => setRuler((r) => { try { localStorage.setItem('suite.docs.ruler', r ? '0' : '1'); } catch { /* */ } return !r; });
  // Ciornă (ca vizualizarea Draft): doar textul, pe toată lățimea, fără antet, subsol, filigran, coloane și imagini plutitoare. Se ține minte.
  const [draft, setDraft] = useState(() => { try { return localStorage.getItem('suite.docs.draft') === '1'; } catch { return false; } });
  const keepDraft = (on: boolean) => { try { localStorage.setItem('suite.docs.draft', on ? '1' : '0'); } catch { /* */ } };
  const toggleWeb = () => {
    setDraft(false); keepDraft(false);
    setWebLayout((w) => { try { localStorage.setItem('suite.docs.web', w ? '0' : '1'); } catch { /* */ } return !w; });
  };
  const toggleDraft = () => {
    setWebLayout(false);
    try { localStorage.setItem('suite.docs.web', '0'); } catch { /* */ }
    setDraft((d) => { keepDraft(!d); return !d; });
  };
  const exitRead = useCallback(() => { setReadMode(false); }, []);
  // Ctrl+Alt+P / O (familiarKeys.ts): aceleași vizualizări ca butoanele din fila Vizualizare.
  const layoutRef = useRef<((to: 'print' | 'web' | 'draft' | 'outline') => void) | null>(null);
  const readPage = useCallback(() => (rootRef.current?.querySelector('.page') as HTMLElement | null) ?? null, []);
  useEffect(() => {
    if (!focusMode) return;
    const off = () => { if (!document.fullscreenElement) setFocusMode(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.fullscreenElement) setFocusMode(false); };
    document.addEventListener('fullscreenchange', off);
    window.addEventListener('keydown', esc);
    return () => { document.removeEventListener('fullscreenchange', off); window.removeEventListener('keydown', esc); };
  }, [focusMode]);
  const toggleFocus = () => {
    if (focusMode) { setFocusMode(false); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); return; }
    setFocusMode(true);
    // Dacă ecranul întreg nu e voie, rămâne măcar fără bare.
    rootRef.current?.requestFullscreen().catch(() => {});
    editor?.commands.focus();
  };
  const [focusCmt, setFocusCmt] = useState<string | null>(null);
  const [author, setAuthorState] = useState(initialAuthor);
  const setAuthor = (a: string) => {
    setAuthorState(a);
    editorRef.current?.commands.setTracking(tracking, a);
    try { localStorage.setItem(AUTHOR_KEY, a); } catch { /* rămâne până închizi */ }
  };
  const clearFocusCmt = useCallback(() => setFocusCmt(null), []);
  const timer = useRef<number>();
  // Zoom-ul paginii (doar pe ecran): Ctrl + rotița mouse-ului sau butoanele din bara de jos.
  const areaRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useZoom('suite.docs.zoom', areaRef);
  const fitWidth = () => { if (areaRef.current) setZoom(fitZoom(areaRef.current.clientWidth, pageWidth(page))); };
  const fitPage = () => {
    const a = areaRef.current, ps = paperSize(page);
    if (a) setZoom(fitPageZoom(a.clientWidth, a.clientHeight, pageWidth(page), pageWidth(page) * (ps.h / ps.w)));
  };
  const pathRef = useRef(path);
  pathRef.current = path;
  const editorRef = useRef<Editor | null>(null);
  // La plecarea din modul, documentul trece în `kept` (efectul e înaintea editorului, deci rulează cât editorul încă există).
  const keepRef = useRef({ path, dirty, page });
  keepRef.current = { path, dirty, page };
  // Documentul fără fișier se păstrează ca ciornă (Fișier → Recuperează…); gol, ciorna se șterge.
  const [restored] = useState(() => !!kept.get(tab));
  useDraft(tab, 'doc', restored, dirty && !path, () => {
    const ed = editorRef.current;
    if (!ed) return undefined;
    if (ed.isEmpty) return null;
    return { title: (ed.state.doc.firstChild?.textContent ?? '').trim() || 'Document nou', content: serializeDoc(ed.getJSON(), keepRef.current.page) };
  });
  useEffect(() => () => {
    const ed = editorRef.current;
    if (!ed) return;
    try { kept.set(tab, { content: serializeDoc(ed.getJSON(), keepRef.current.page), ...keepRef.current }); } catch { /* editorul s-a închis deja */ }
  }, []);

  // Butonul cu macrocomandă (MACROBUTTON) de la poziția pos: cursorul trece după buton și macrocomanda rulează de acolo.
  const runMacroBtn = (view: EditorView, pos: number): boolean => {
    const b = macroBtnAt(view.state.doc, pos);
    const k = macroKeysRef.current;
    if (!b || !k) return false;
    const m = findMacroForBtn([k.doc, k.mine], b.macro);
    if (!m) { setStatus(`Macrocomanda „${b.macro}” nu există în acest document și nici pentru toate documentele: înregistreaz-o din Vizualizare → Macrocomenzi.`); return true; }
    // Anularea (Ctrl+Z) ia doar ce face macrocomanda, nu și ce s-a scris chiar înainte (de exemplu butonul abia pus).
    view.dispatch(closeHistory(view.state.tr.setSelection(PmTextSelection.create(view.state.doc, b.end))));
    k.play(m);
    return true;
  };
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] } }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      FamiliarKeys,
      SimilarSelection,
      Placeholder.configure({ placeholder: () => (document.documentElement.lang === 'en' ? 'Start typing…' : 'Începe să scrii…') }),
      TextStyle,
      FontFamily,
      FontSize,
      DateTime,
      DocField,
      MacroBtn,
      ChangeCase,
      PastePlain,
      SortParagraphs,
      FormattingMarks,
      GrammarMarks,
      Hyphenation,
      Collapse,
      Color,
      Highlight.configure({ multicolor: true }),
      Table.configure({ resizable: true, View: BorderTableView }),
      TableRow,
      TableHeader,
      TableCell,
      DocImage,
      TextBox,
      Search,
      TableOfContents,
      PageBreak,
      ColumnBreak,
      SectionBreak,
      Comment,
      Insertion,
      Deletion,
      FormatChange,
      TrackChanges,
      Superscript,
      Subscript,
      ParagraphFormat,
      ParaStyleAttr,
      Footnote,
      DocLink,
      Bookmark,
      CaptionNum,
      FormCheck,
      FormDrop,
      FormDate,
      TableOfFigures,
      IndexEntry,
      DocIndex,
      AuthEntry,
      DocAuthorities,
      Citation,
      Bibliography,
      CellColor,
      CellVAlign,
      CellLines,
      TableBorders,
      TableLook,
      TableHeaderRepeat,
      TableRowHeight,
      FormatPainter,
      LetterFormat,
      ParagraphBox,
      AutoCorrect,
      AutoComplete,
      ListStyle,
      TabChar,
      TabStops,
    ],
    content: emptyDoc().content,
    autofocus: true,
    editorProps: {
      attributes: { lang: 'ro', spellcheck: 'true' },
      // Imagini trase din Explorer: intră exact unde le lași.
      handleDrop: (view, event, _slice, moved) => {
        const files = imageFilesFrom(event.dataTransfer?.files);
        if (moved || !files.length || !editorRef.current) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        insertImageFiles(editorRef.current, files, pos);
        return true;
      },
      // Ctrl+clic pe o legătură o deschide în browser (clicul simplu doar pune cursorul, ca în Word).
      handleClick: (_view, _pos, event) => {
        const a = (event.target as HTMLElement).closest?.('a.doc-link') as HTMLAnchorElement | null;
        if (!a || !(event.ctrlKey || event.metaKey)) return false;
        event.preventDefault();
        // Legătura spre un semn de carte (#nume) duce la el, în document.
        const href = a.getAttribute('href') ?? '';
        if (href.startsWith('#')) { if (editorRef.current) goToBookmark(editorRef.current, decodeURIComponent(href.slice(1))); }
        else window.open(a.href, '_blank');
        return true;
      },
      // Dublu clic pe un buton cu macrocomandă (câmpul MACROBUTTON): cursorul trece după buton și macrocomanda rulează de acolo.
      handleDoubleClick: (view, pos) => runMacroBtn(view, pos),
      handlePaste: (view, event) => {
        const files = imageFilesFrom(event.clipboardData?.files);
        if (!files.length || !editorRef.current) {
          // Textul lipit în altă limbă primește limba lui (Fișier → Opțiuni → Detectează limba textului lipit), fără pas nou în Anulează.
          const text = event.clipboardData?.getData('text/plain') ?? '';
          if (autoLangRef.current && text.trim().length >= 20) {
            const from = view.state.selection.from;
            setTimeout(() => { const ed = editorRef.current; if (ed && !ed.isDestroyed) detectDocLangs(ed, { from, to: ed.state.selection.to }, false); }, 0);
          }
          return false;
        }
        insertImageFiles(editorRef.current, files);
        return true;
      },
      // Paragraful scris de la tastatură primește și el limba lui la Enter (aceeași opțiune ca la lipire), fără pas nou în Anulează.
      handleKeyDown: (view, event) => {
        // Scurtătura unei macrocomenzi (Ctrl+Shift+literă) are întâietate, ca în programele cunoscute.
        if (event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey && macroKeysRef.current) {
          const k = macroKeysRef.current;
          const m = docMacroForKey(k.doc, event.code) ?? docMacroForKey(k.mine, event.code);
          if (m) { event.preventDefault(); k.play(m); return true; }
        }
        // Alt+Shift+F9 (clic pe câmp): butonul cu macrocomandă de la cursor rulează, ca la dublu clic.
        if (event.key === 'F9' && event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey) {
          if (runMacroBtn(view, view.state.selection.from)) { event.preventDefault(); return true; }
        }
        if (event.ctrlKey || event.altKey || event.metaKey || !autoLangRef.current) return false;
        // În timp ce scrii: după un spațiu sau un semn de punctuație și o scurtă pauză, paragraful de la cursor (de cel puțin
        // 6 cuvinte) primește limba lui; literele scrise după aceea o păstrează.
        if (/^[ .,;:!?]$/.test(event.key)) {
          window.clearTimeout(langTimer.current);
          langTimer.current = window.setTimeout(() => {
            const ed = editorRef.current;
            if (!ed || ed.isDestroyed) return;
            const { $from: $c } = ed.state.selection;
            if (!$c.parent.isTextblock || ($c.parent.textContent.match(/[\p{L}']+/gu)?.length ?? 0) < 6) return;
            const s = $c.start();
            detectDocLangs(ed, { from: s, to: s }, false);
          }, 700);
          return false;
        }
        if (event.key !== 'Enter' || event.shiftKey) return false;
        window.clearTimeout(langTimer.current);
        const { $from } = view.state.selection;
        if (!$from.parent.isTextblock) return false;
        const at = $from.start(), long = $from.parent.textContent.trim().length >= 20;
        setTimeout(() => {
          const ed = editorRef.current;
          if (!ed || ed.isDestroyed) return;
          if (long) detectDocLangs(ed, { from: at, to: at }, false);
          // Paragraful nou nu moștenește limba găsită singură (se recunoaște din nou ce scrii în el);
          // „Nu verifica” și limbile alese de mână care nu se pot recunoaște rămân.
          dropAutoLang(ed);
        }, 0);
        return false;
      },
    },
    onUpdate: () => {
      setDirty(true);
      setStatus(pathRef.current ? 'Se salvează…' : 'Nesalvat');
    },
    // Re-desenăm bara de unelte ca butoanele active (B, I…) să urmeze cursorul.
    onSelectionUpdate: () => force((n) => n + 1),
    onTransaction: () => force((n) => n + 1),
  });
  useEffect(() => {
    const dom = editor?.view.dom;
    if (!dom) return;
    const on = (e: Event) => { const to = (e as CustomEvent).detail; if (to === 'split') setSplit((v) => !v); else layoutRef.current?.(to); };
    dom.addEventListener('suite-docs-view', on);
    return () => dom.removeEventListener('suite-docs-view', on);
  }, [editor]);
  editorRef.current = editor;

  const load = useCallback((file: OpenedFile) => {
    if (!editor) return;
    try {
      const doc = parseDoc(file.content);
      editor.commands.setContent(doc.content, false);
      setPage(doc.page ?? NO_PAGE_SETUP);
      if (file.draft) adoptDraft(tab, file.draft);
      else if (file.path) draftOf(tab, 'doc', true);
      // Fără cale = document nou adus din alt modul (de exemplu o notiță), încă nesalvat.
      setPath(file.path || null);
      setDirty(file.dirty ?? !file.path);
      setStatus(file.path ? 'Deschis' : 'Document nou (nesalvat): salvează-l cu Ctrl+S.');
      // Tabelele legate de fișiere (▦ Foaie de calcul…): dacă fișierele s-au schimbat de atunci, se spune jos (documentul rămâne cum e).
      if (file.path) void staleLinkedSheets(editor).then((n) => {
        if (n) setStatus(n === 1 ? 'Deschis. Un tabel legat s-a schimbat în fișierul lui: Inserare → ↻ Actualizează foile legate îl aduce la zi.'
          : `Deschis. ${n} tabele legate s-au schimbat în fișierele lor: Inserare → ↻ Actualizează foile legate le aduce la zi.`);
      });
    } catch (e) {
      alert((e as Error).message);
    }
  }, [editor, tab]);

  // Verificarea ortografică: alegerea se păstrează în setări.
  useEffect(() => {
    api.getSettings().then((s) => { setSpell(s.spellcheck !== false); setAutoSave(s.docsOpts?.autosave !== false); setAutoLang(s.docsOpts?.autoLang !== false); autoLangRef.current = s.docsOpts?.autoLang !== false; });
  }, []);

  // Fișierul unui tabel legat salvat în Sheets (după ✎ Deschide foaia legată): tabelele legate se aduc singure la zi (Ctrl+Z le readuce).
  useEffect(() => {
    if (!editor) return;
    const on = (e: Event) => {
      const p = (e as CustomEvent<FileSaved>).detail.path;
      if (editor.isDestroyed || !linkedTables(editor).some((t) => samePath(t.path, p))) return;
      void refreshLinkedSheets(editor).then((m) => setStatus(m), () => {});
    };
    window.addEventListener(FILE_SAVED, on);
    return () => window.removeEventListener(FILE_SAVED, on);
  }, [editor]);

  useEffect(() => {
    editor?.setOptions({ editorProps: { attributes: { lang: 'ro', spellcheck: String(spell) } } });
    // Greșelile de gramatică se subliniază cât e pornită verificarea.
    if (editor && !editor.isDestroyed) editor.commands.setGrammarMarks(spell);
  }, [editor, spell]);

  const toggleSpell = () => {
    const next = !spell;
    setSpell(next);
    api.setSettings({ spellcheck: next });
    editor?.commands.focus();
  };

  useEffect(() => {
    if (!editor) return;
    const k = kept.take(tab);
    if (initial) {
      // Un document nou venit din alt modul nu înlocuiește fără întrebare unul nesalvat.
      // (Docs rămâne de obicei deschis în spate, deci „nesalvat” e chiar starea de acum; „kept” vine doar după o închidere.)
      const next = initial;
      // Un .docx / .odt adus dintr-un alt tab (Import cu tabul acela ocupat): se citește aici.
      if (next.imported) { if (!(k ? k.dirty : dirty)) importBinary({ path: next.path, data: next.imported }); }
      else if (!(k ? k.dirty : dirty)) load(next);
      else {
        if (k) { load({ path: k.path ?? '', content: k.content }); setDirty(true); }
        askYes('Ai în Docs un document nesalvat. Îl înlocuiești cu cel nou?', 'Înlocuiește', 'Păstrează-l pe cel vechi').then((ok) => { if (ok) load(next); });
      }
      onConsumed();
    } else if (k) {
      load({ path: k.path ?? '', content: k.content });
      setDirty(k.dirty);
      setStatus(k.dirty ? 'Documentul tău nesalvat e tot aici.' : '');
    }
  }, [initial, editor, load, onConsumed]);

  // Un document deschis dintr-un .docx / .odt / .rtf / .txt de pe disc: Ctrl+S întreabă o dată dacă scrie înapoi în el (peste fișier, cu copia
  // veche păstrată în Versiuni) sau îl face document Cyber Office Studio; după „În .docx”, Ctrl+S scrie direct acolo.
  const [docxOut, setDocxOut] = useState<string | null>(null);
  useEffect(() => { if (path || !fromFile) setDocxOut(null); }, [path, fromFile]);
  // Un .txt se scrie înapoi în codificarea lui (Windows-1250, UTF-16, UTF-8 cu sau fără semnătură), aflată din fișierul de pe disc;
  // dacă textul are litere pe care ea nu le are, tot fișierul trece în UTF-8 cu semnătură, fără pierderi.
  const txtBytes = async (file: string, text: string) => {
    const { detectEncoding, encodeText, hasBom } = await import('../sheets/textImport');
    let old: Uint8Array | null = null;
    // Felul „sheettable” citește fișierul fără să-l treacă în Fișiere recente.
    try { old = (await api.readBinary(file, 'sheettable' as Parameters<typeof api.readBinary>[1])).data; } catch { /* lipsește: UTF-8 */ }
    if (!old) return encodeText(text, 'utf-8', true).data;
    const enc = detectEncoding(old);
    const e = encodeText(text, enc, hasBom(old) || (enc === 'utf-8' && old.every((b) => b < 0x80)));
    return e.lost ? encodeText(text, 'utf-8', true).data : e.data;
  };
  const saveDocxBack = async (file: string) => {
    if (!editor) return;
    const ext = (file.match(/[.](odt|rtf|txt)$/i)?.[1].toLowerCase() ?? 'docx') as 'docx' | 'odt' | 'rtf' | 'txt';
    setStatus(`Salvez în .${ext}…`);
    try {
      const plain = ext === 'rtf' || ext === 'txt' ? await import('./plainExport') : null;
      const data = ext === 'odt' ? await (await import('./odtExport')).docToOdt(editor.getJSON(), hfPage)
        : plain && ext === 'txt' ? await txtBytes(file, plain.docToText(editor.getJSON()))
        : plain ? new TextEncoder().encode(plain.docJsonToRtf(editor.getJSON()))
          : await (await import('./docx')).docToDocx(editor.getJSON(), hfPage);
      await api.overwriteFile!({ path: file, format: ext, data });
      setDocxOut(file);
      setDirty(false);
      setStatus(`Salvat în ${fileName(file)} la ${new Date().toLocaleTimeString('ro-RO')}. Copia de dinainte e păstrată în Versiuni.`);
    } catch {
      setStatus(`Fișierul .${ext} nu s-a putut salva peste cel vechi (poate e deschis în alt program sau e doar pentru citire). Folosește Salvează ca.`);
    }
  };
  const save = useCallback(async (saveAs = false) => {
    if (!editor) return;
    if (!saveAs && !path && docxOut) { await saveDocxBack(docxOut); return; }
    const ext = fromFile?.match(/[.](docx|odt|rtf|txt)$/i)?.[1].toLowerCase();
    if (!saveAs && !path && fromFile && api.overwriteFile && ext) {
      const into = ext === 'odt' ? 'În .odt' : ext === 'rtf' ? 'În .rtf' : ext === 'txt' ? 'În .txt' : 'În .docx';
      const i = await ask('Unde salvezi?', `Documentul a fost deschis din „${fileName(fromFile)}”. Îl salvezi înapoi în acest fișier .${ext} (copia de dinainte rămâne în Versiuni) sau ca document Cyber Office Studio (.sdoc), care păstrează tot ce ai făcut în Suite?`
        + (ext === 'txt' ? ' Într-un .txt rămâne doar textul, fără formatare, poze și tabele.' : ''), ['Renunță', 'Ca .sdoc…', into], 2);
      if (i < 1) return;
      if (i === 2) { await saveDocxBack(fromFile); return; }
    }
    const firstLine = editor.state.doc.firstChild?.textContent ?? '';
    const res = await api.saveFile({
      path: saveAs ? null : path,
      content: serializeDoc(editor.getJSON(), page),
      kind: 'doc',
      suggestedName: safeFileName(firstLine || 'Document'),
      ...(path ? {} : importedSave(fromFile)),
    });
    if (!res) return;
    if (!path) dropDraft(tab, 'doc');
    setPath(res.path);
    setDirty(false);
    setStatus(`Salvat la ${new Date().toLocaleTimeString('ro-RO')}`);
  }, [editor, path, page, fromFile, tab, docxOut]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmDiscard = async () => !dirty || askDiscard();

  const newDoc = async () => {
    if (!editor || !(await confirmDiscard())) return;
    editor.commands.setContent(emptyDoc().content, false);
    draftOf(tab, 'doc', true);
    setPage(NO_PAGE_SETUP);
    setPath(null);
    setFromFile(null);
    setDirty(false);
    setStatus('');
  };

  // Șablonul devine un document nou, nesalvat; primul câmp [ ] e deja ales, ca să scrii direct peste el.
  const fromTemplate = async (t: DocTemplate) => {
    if (!editor || !(await confirmDiscard())) return;
    setTplDlg(false);
    editor.commands.setContent(t.html, false);
    draftOf(tab, 'doc', true);
    setPath(null);
    setFromFile(null);
    setDirty(true);
    setStatus(`Șablon: ${t.name}. Scrie peste textele dintre [ ]; F2 te duce la următorul.`);
    editor.commands.setTextSelection(0);
    gotoPlaceholder();
  };

  // Urmărirea modificărilor: textul scris apare verde, cel șters rămâne tăiat, până le accepți sau le respingi.
  const toggleTracking = () => {
    if (!editor) return;
    if (page.trackLock && tracking) { setStatus('Urmărirea e blocată: deblochează-o întâi cu 🔒'); return; }
    const on = !tracking;
    setTracking(on);
    editor.chain().focus().setTracking(on, author).run();
    if (on) setShowComments(true);
    setStatus(on ? 'Urmărirea modificărilor e pornită: ce scrii apare verde, ce ștergi rămâne tăiat' : 'Urmărirea modificărilor e oprită');
  };

  // Blocarea urmăririi (ca Blocare urmărire): urmărirea rămâne pornită, iar modificările nu se pot accepta sau respinge.
  // Se păstrează în document și în .docx; un document deschis blocat pornește singur urmărirea.
  useEffect(() => {
    if (!page.trackLock || !editor || tracking) return;
    setTracking(true);
    editor.commands.setTracking(true, author);
    setShowComments(true);
  }, [page.trackLock, editor]); // eslint-disable-line react-hooks/exhaustive-deps
  // Despărțirea în silabe se vede doar pe ecran (cratime „moi” între silabe), deci o pornim din setarea paginii.
  useEffect(() => { editor?.commands.setHyphenation(!!page.hyphenate); }, [page.hyphenate, editor]);
  const toggleLock = () => {
    const lock = !page.trackLock;
    setPage({ ...page, trackLock: lock || undefined });
    setDirty(true);
    if (lock && !tracking && editor) { setTracking(true); editor.commands.setTracking(true, author); }
    setStatus(lock ? 'Urmărirea e blocată: rămâne pornită, iar modificările nu se pot accepta sau respinge până la deblocare' : 'Urmărirea e deblocată');
  };

  // Comentariu nou pe textul ales; panoul se deschide cu căsuța lui gata de scris.
  const addComment = () => {
    if (!editor) return;
    if (editor.state.selection.empty) { setStatus('Alege întâi textul pe care vrei să-l comentezi'); return; }
    const id = `c${Date.now().toString(36)}`;
    editor.chain().focus().addComment({ id, author }).run();
    setShowComments(true);
    setFocusCmt(id);
  };

  // F2: alege următorul text de tipul [ ... ] (de la cursor încolo, apoi de la început).
  const gotoPlaceholder = () => {
    if (!editor) return;
    const r = nextPlaceholder(editor.state.doc, editor.state.selection.to);
    if (!r) { setStatus('Nu mai sunt câmpuri [ ] de completat'); return; }
    editor.chain().focus().setTextSelection(r).scrollIntoView().run();
  };

  // Tabul are deja ceva (un fișier sau text scris): Deschide / Import duc fișierul nou într-un tab nou, nu peste acesta.
  const busy = () => !!path || dirty || !(editor?.isEmpty ?? true);
  // Un fișier din Fișier › Recente: în tab nou dacă documentul de acum are ceva în el (ca la Deschide).
  const openRecentDoc = async (p: string) => {
    let file: OpenedFile;
    try { file = await api.readFile(p, 'doc'); } catch { setStatus('Fișierul nu mai există sau nu poate fi deschis: ' + p); return; }
    if (busy() && openInTab) { openInTab('doc', file); return; }
    if (!(await confirmDiscard())) return;
    load(file);
  };

  const open = async () => {
    if (busy() && openInTab) { const file = await api.openFile('doc'); if (file) openInTab('doc', file); return; }
    if (!(await confirmDiscard())) return;
    const file = await api.openFile('doc');
    if (file) load(file);
  };

  // Fișier → Recuperează…: ciorna se deschide într-un tab nou dacă acesta are ceva în el (ca la Deschide).
  const openDraft = async (id: string, content: string) => {
    setDraftDlg(false);
    const file: OpenedFile = { path: '', content, dirty: true, draft: id };
    if (busy() && openInTab) { openInTab('doc', file); return; }
    if (!(await confirmDiscard())) return;
    load(file);
    setStatus('Document recuperat. Salvează-l cu Ctrl+S ca să-l păstrezi.');
  };

  useEffect(() => {
    if (!dirty || !path || !autoSave) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => save(), AUTOSAVE_MS);
    return () => window.clearTimeout(timer.current);
  }, [dirty, path, save, autoSave]);
  const pickAutoSave = (on: boolean) => { setAutoSave(on); void api.setSettings({ docsOpts: { autosave: on, autoLang: autoLangRef.current } }).catch(() => {}); };
  const pickAutoLang = (on: boolean) => { setAutoLang(on); autoLangRef.current = on; void api.setSettings({ docsOpts: { autosave: autoSave, autoLang: on } }).catch(() => {}); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isCurrent(tab)) return;
      if (e.key === 'F7' && e.shiftKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); setShowThes((v) => !v); return; }
      if (e.key === 'F2' && e.ctrlKey && !e.altKey && !e.shiftKey) { e.preventDefault(); void printPreview(); return; }
      if (e.key === 'F2' && !e.ctrlKey && !tplDlg && !sumDlg && !mergeDlg && !linkDlg) { e.preventDefault(); gotoPlaceholder(); return; }
      // F9: actualizează trimiterile (ca actualizarea câmpurilor).
      if (e.key === 'F9' && !e.ctrlKey && editor && !page.final) {
        e.preventDefault();
        const m = pageMargins(page);
        const ph = (paperSize(page).h - m.top - m.bottom) * 3.78;
        const r = updateXrefs(editor, ph);
        const nf = updateFields(editor, { file: path ? fileName(path) : '', props: docProps(page), pageOf: fieldPages(editor, ph) });
        setStatus(r.changed || nf ? `Actualizate: ${r.changed} trimiteri, ${nf} câmpuri` : r.broken ? `${r.broken} trimiteri duc la un loc care nu mai există` : 'Trimiterile și câmpurile sunt la zi');
        return;
      }
      // F12: Salvare ca; F5: Salt la (ca în procesorul de text cunoscut).
      if (e.key === 'F12' && !e.ctrlKey && !e.altKey && !e.shiftKey) { e.preventDefault(); save(true); return; }
      if (e.key === 'F5' && !e.ctrlKey && !e.altKey && !e.shiftKey) { e.preventDefault(); setGoTo(true); return; }
      if (!e.ctrlKey) return;
      const k = e.key.toLowerCase();
      // Ctrl+Shift+E: urmărirea modificărilor; Ctrl+Shift+G: numărul de cuvinte (în fereastra Proprietăți).
      if (e.shiftKey && !e.altKey && (k === 'e' || e.code === 'KeyE') && !locked) { e.preventDefault(); toggleTracking(); return; }
      if (e.shiftKey && !e.altKey && (k === 'g' || e.code === 'KeyG')) { e.preventDefault(); setPropsDlg(true); return; }
      // Ctrl+Shift+Alt+S: panoul Stiluri (ca în programul de referință).
      if (k === 's' && e.altKey && e.shiftKey) { e.preventDefault(); setShowStyles(!showStyles); }
      else if (k === 's') { e.preventDefault(); save(e.shiftKey); }
      // Cu Alt, O / P sunt alte comenzi (Ctrl+Alt+O Schiță, Ctrl+Alt+P Aspect imprimare: familiarKeys.ts).
      else if (k === 'o' && !e.altKey) { e.preventDefault(); open(); }
      else if (k === 'n' && !e.altKey) { e.preventDefault(); newDoc(); }
      else if (k === 'f' && !e.altKey) { e.preventDefault(); setSearch('find'); }
      else if (k === 'h') { e.preventDefault(); setSearch('replace'); }
      else if (k === 'g' && !e.altKey && !e.shiftKey) { e.preventDefault(); setGoTo(true); }
      else if (k === 'm' && e.altKey) { e.preventDefault(); addComment(); }
      else if (k === 'p' && !e.altKey) { e.preventDefault(); print(); }
      // Ctrl+K: Legătură pe textul ales (ca în procesoarele de text cunoscute).
      else if ((k === 'k' || e.code === 'KeyK') && !e.altKey && !e.shiftKey && !locked) { e.preventDefault(); setLinkDlg(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Antetele cu câmpurile ({data}, {fisier}, {autor}, {titlu}) înlocuite, pentru ecran, tipărire și export.
  const hfPage = useMemo(() => withHfFields(page, path ? fileName(path) : ''), [page, path]);
  // Benzile de pe ecran cu antetul / subsolul secțiunilor (sectionBreak.ts) pornesc de la ale documentului.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const st = editor.storage.sectionBreak as { header: string; footer: string; fill: (t: string) => string };
    st.header = page.header; st.footer = page.footer;
    st.fill = (t) => withHfFields({ ...page, header: t, footer: '' }, path ? fileName(path) : '').header;
    editor.view.dispatch(editor.state.tr.setMeta('secHf', true).setMeta('addToHistory', false));
  }, [editor, page, path]);
  const baseName = () => {
    const first = editor?.state.doc.firstChild?.textContent ?? '';
    return path ? fileName(path).replace(/\.sdoc$/i, '') : safeFileName(first || 'Document');
  };

  // Pentru PDF și previzualizare: și antetul / subsolul secțiunilor cu antet propriu (main.cjs le pune pe paginile lor).
  const pdfPage = () => {
    const breaks: { hdr: unknown; ftr: unknown }[] = [];
    editor?.state.doc.forEach((n) => { if (n.type.name === 'sectionBreak') breaks.push({ hdr: n.attrs.hdr, ftr: n.attrs.ftr }); });
    const sections = sectionHfList(breaks, page.header, page.footer);
    if (!sections.length) return hasPageSetup(page) ? hfPage : undefined;
    return withHfFields({ ...page, sections }, path ? fileName(path) : '');
  };
  // Ctrl+P: cu numere, siglă, prima pagină / paginile pare diferite sau antet pe secțiuni se tipărește chiar PDF-ul
  // aplicației (rasterPrint.ts); altfel tipărirea obișnuită, cu antetul și subsolul ca un rând de text.
  const print = async (ready?: Uint8Array) => {
    const pp = pdfPage();
    const special = !!pp && (pp.numbers || !!(pp as { sections?: unknown[] }).sections?.length || !!pageFirst(page) || !!pageEven(page) || !!pageHeaderImage(page));
    if (!special || !api.docPdfBytes) return api.print(hasPageSetup(page) ? hfPage : undefined);
    setStatus('Se pregătesc paginile pentru tipărire…');
    try {
      const { printPdfPages } = await import('./rasterPrint');
      await printPdfPages(ready ?? await api.docPdfBytes(pp), () => api.print({ header: '', footer: '', numbers: false, raw: true }));
      setStatus('');
    } catch { setStatus('Tipărirea nu a putut fi pregătită.'); }
    return true;
  };
  // Ctrl+F2: paginile se fac întâi (fereastra apare după, ca să nu intre în PDF); în browser rămâne tipărirea obișnuită.
  const printPreview = async () => {
    if (!api.docPdfBytes) { void print(); return; }
    setStatus('Se pregătesc paginile…');
    try { setPreviewMany(false); setPreview(await api.docPdfBytes(pdfPage())); setStatus(''); } catch { setStatus('Previzualizarea nu a putut fi făcută.'); }
  };
  // Zoom → Mai multe pagini: toate paginile alăturate (cum ies la tipărire); clic pe una duce cursorul la începutul ei.
  const multiPages = async () => {
    if (!api.docPdfBytes) { setStatus('Mai multe pagini merge doar în aplicația instalată.'); return; }
    setStatus('Se pregătesc paginile…');
    try { setPreviewMany(true); setPreview(await api.docPdfBytes(pdfPage())); setStatus(''); } catch { setStatus('Paginile nu au putut fi pregătite.'); }
  };
  const goToPage = (page: number) => {
    setPreview(null);
    if (!editor) return;
    window.setTimeout(() => {
      try {
        const starts = pagePositions(editor.view);
        const pos = starts[Math.min(page, starts.length) - 1] ?? 0;
        editor.chain().focus().setTextSelection(PmTextSelection.near(editor.state.doc.resolve(pos)).from).scrollIntoView().run();
        // Pagina sus pe ecran, ca la Mergi la → Pagină.
        let box: HTMLElement | null = editor.view.dom.parentElement;
        while (box && !(box.scrollHeight > box.clientHeight && /auto|scroll/.test(getComputedStyle(box).overflowY))) box = box.parentElement;
        if (box) box.scrollTop += editor.view.coordsAtPos(pos).top - box.getBoundingClientRect().top - 40;
      } catch { /* documentul s-a schimbat între timp */ }
    }, 30);
  };

  const exportPdf = async () => {
    if (!editor) return;
    const res = await api.exportPdf(baseName(), pdfPage());
    if (res) setStatus(`PDF salvat: ${fileName(res.path)}`);
  };

  const exportDocx = async (withPassword = false) => {
    if (!editor) return;
    setStatus('Se pregătește fișierul .docx…');
    try {
      const { docToDocx } = await import('./docx');
      let data: Uint8Array | null = await docToDocx(editor.getJSON(), hfPage);
      // Cu parolă: fișierul se deschide doar cu ea (și în alte programe de birou).
      if (withPassword) data = await (await import('../protect')).lockOffice(data, 'docx');
      if (!data) { setStatus(''); return; }
      const res = await api.exportFile({ format: 'docx', suggestedName: baseName(), data });
      setStatus(res ? `Document .docx salvat${withPassword ? ' cu parolă' : ''}: ${fileName(res.path)}` : '');
    } catch (e) {
      setStatus('');
      alert('Exportul .docx a eșuat: ' + (e as Error).message);
    }
  };

  // ✉ Trimite prin e-mail: un mesaj nou (.eml) cu documentul .docx atașat, deschis în programul de e-mail al calculatorului;
  // omul scrie adresa și apasă Trimite (Suite nu trimite nimic singur).
  const mailDocx = async () => {
    if (!editor) return;
    setStatus('Se pregătește mesajul…');
    try {
      const { docToDocx } = await import('./docx');
      const { buildEml } = await import('./eml');
      const data = await docToDocx(editor.getJSON(), hfPage);
      const name = `${baseName()}.docx`;
      const safe = name.split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;');
      const eml = buildEml({ to: '', subject: baseName(), text: `Vă trimit atașat documentul „${name}”.`, html: `<p>Vă trimit atașat documentul „${safe}”.</p>`,
        attachments: [{ name, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', data }] });
      // În aplicație, mesajul se deschide direct; în browser (fără program de e-mail legat) se salvează.
      const bytes = new TextEncoder().encode(eml);
      const res = api.composeMail ? await api.composeMail(baseName(), bytes) : await api.exportFile({ format: 'eml', suggestedName: baseName(), data: bytes });
      if (!res) { setStatus(''); return; }
      const opened = 'opened' in res ? res.opened : await api.openMail?.(res.path);
      setStatus(opened ? `Mesajul cu „${name}” atașat e deschis în programul de e-mail: scrie adresa și apasă Trimite` : `Mesaj salvat: ${fileName(res.path)}. Deschide-l cu dublu clic: documentul e deja atașat`);
    } catch (e) {
      setStatus('');
      alert('Mesajul nu a putut fi făcut: ' + (e as Error).message);
    }
  };

  // Export .docx semnat digital: semnătura (XML-DSig) se pune în interiorul fișierului exportat.
  const signDocx = async (id: DigitalId, tsa?: TsaClient) => {
    if (!editor) return;
    const { docToDocx } = await import('./docx');
    // Linia de semnătură (✍) din copia semnată primește numele din certificat și data.
    const signed = fillSignatureLine(editor.getJSON(), id.owner.name, new Date());
    const data = await signPackage(await docToDocx(signed.doc, hfPage), id, tsa);
    const res = await api.exportFile({ format: 'docx', suggestedName: `${baseName()} (semnat)`, data });
    if (!res) throw new Error('Nu ai ales unde se salvează: documentul nu s-a semnat.');
    setSignDlg(false);
    setStatus(`Document .docx semnat digital salvat: ${fileName(res.path)}.${signed.filled ? ' Linia de semnătură e completată cu numele și data.' : ''} Nu-l mai modifica: orice schimbare strică semnătura.`);
  };

  // Salvare ca document LibreOffice (.odt), text simplu (.txt, UTF-8 cu BOM, ca să-l recunoască și programele vechi) sau pagină web (.html).
  const exportOther = async (format: 'txt' | 'html' | 'odt' | 'rtf') => {
    if (!editor) return;
    if (format === 'odt') {
      try {
        const data = await (await import('./odtExport')).docToOdt(editor.getJSON(), hfPage);
        const res = await api.exportFile({ format, suggestedName: baseName(), data });
        if (res) setStatus(`Document .odt salvat: ${fileName(res.path)}`);
      } catch (e) { alert('Exportul .odt a eșuat: ' + (e as Error).message); }
      return;
    }
    const { docToText, docToHtmlPage, docJsonToRtf } = await import('./plainExport');
    const text = format === 'txt' ? String.fromCharCode(0xfeff) + docToText(editor.getJSON())
      : format === 'rtf' ? docJsonToRtf(editor.getJSON())
        : docToHtmlPage(editor.getHTML(), docProps(page)?.title ?? baseName(), docProps(page));
    const res = await api.exportFile({ format, suggestedName: baseName(), data: new TextEncoder().encode(text) });
    if (res) setStatus(`${format === 'txt' ? 'Text salvat' : format === 'rtf' ? 'Document .rtf salvat' : 'Pagina web salvată'}: ${fileName(res.path)}`);
  };

  const compareWord = async () => {
    if (!editor) return;
    const file = await api.importFile('docx');
    if (!file) return;
    setStatus('Se citește fișierul .docx…');
    try {
      const { docxLines, docxAuthor } = await import('./compareFile');
      const other = await docxLines(file.data);
      const who = await docxAuthor(file.data);
      setCmpFile({ name: fileName(file.path), diff: diffLines(other, textLines(serializeDoc(editor.getJSON(), page))), ...who });
      setStatus('');
    } catch (e) {
      setStatus('');
      alert('Documentul .docx nu a putut fi citit: ' + (e as Error).message);
    }
  };

  // Compară → 📝 Document marcat: fișierul primit transformat în documentul de acum, cu modificări urmărite, într-un tab nou.
  const openMarked = async () => {
    if (!cmpFile?.diff) return;
    const { markedDoc } = await import('./compareMarked');
    const content = serializeDoc(markedDoc(cmpFile.diff, author || 'Autor', new Date().toISOString()), NO_PAGE_SETUP);
    setCmpFile(null);
    if (openInTab) openInTab('doc', { path: '', content });
    else if (await confirmDiscard()) load({ path: '', content });
  };

  // Compară → 🔀 Combină: documentul de acum, cu modificările din fișierul primit puse peste el ca modificări urmărite,
  // pe numele celui care a lucrat ultimul la fișier (sau al fișierului), ca să le accepți / respingi una câte una.
  const openCombined = async () => {
    if (!cmpFile?.diff) return;
    const { markedDoc, flipDiff } = await import('./compareMarked');
    const who = cmpFile.author || cmpFile.name.replace(/\.docx$/i, '');
    const content = serializeDoc(markedDoc(flipDiff(cmpFile.diff), who, cmpFile.date || new Date().toISOString()), NO_PAGE_SETUP);
    setCmpFile(null);
    if (openInTab) openInTab('doc', { path: '', content });
    else if (await confirmDiscard()) load({ path: '', content });
  };

  // Compară → 🔀 Combină mai multe .docx…: copiile corectate de mai mulți oameni, puse toate deodată peste documentul de acum,
  // fiecare cu modificările pe numele lui, într-un tab nou.
  const combineMany = async () => {
    if (!editor) return;
    const files = await api.importMany('docx');
    if (!files.length) return;
    setStatus('Se citesc fișierele .docx…');
    try {
      const { docxLines, docxAuthor } = await import('./compareFile');
      const { combinedDoc } = await import('./compareMarked');
      const base = textLines(serializeDoc(editor.getJSON(), page));
      const reviewers = [];
      const big: string[] = [];
      for (const f of files) {
        const name = fileName(f.path);
        const diff = diffLines(base, await docxLines(f.data));
        if (!diff) { big.push(name); continue; }
        const who = await docxAuthor(f.data);
        reviewers.push({ diff, author: who.author || name.replace(/\.docx$/i, ''), date: who.date || new Date().toISOString() });
      }
      setStatus(big.length ? `Prea mari ca să fie comparate: ${big.join(', ')}` : '');
      if (!reviewers.length) return;
      const content = serializeDoc(combinedDoc(base, reviewers), NO_PAGE_SETUP);
      if (openInTab) openInTab('doc', { path: '', content });
      else if (await confirmDiscard()) load({ path: '', content });
    } catch (e) {
      setStatus('');
      alert('Documentul .docx nu a putut fi citit: ' + (e as Error).message);
    }
  };

  // Fișierul Word devine un document nou, nesalvat; originalul .docx rămâne neatins.
  const importDocx = async () => {
    if (!editor) return;
    if (busy() && openInTab) {
      const file = await api.importFile('docx');
      if (file) openInTab('doc', { path: file.path, content: '', imported: file.data });
      return;
    }
    if (!(await confirmDiscard())) return;
    const file = await api.importFile('docx');
    if (file) await importBinary(file);
  };
  const importBinary = async (file: BinaryFile) => {
    if (!editor) return;
    setStatus('Se citește fișierul .docx…');
    try {
      // După extensie: .odt / .fodt, .doc (doar textul), .rtf, .txt, altfel .docx (readImport.ts).
      const imported = await readImportedDoc(file);
      const { html, warnings, comments, changes, simplified, repaired } = imported;
      const signers = 'signers' in imported ? imported.signers : undefined;
      editor.commands.setContent(html, false);
      // Documentul adus începe fără antetul celui de dinainte, cu pagina lui (orientare, margini) din Word.
      const layout = 'layout' in imported ? imported.layout : undefined;
      setPage({ ...NO_PAGE_SETUP, ...(layout ?? {}) });
      const nCmt = comments.length ? applyImportedComments(editor, comments) : 0;
      const nChg = changes.length ? applyImportedChanges(editor, changes) : 0;
      if (nCmt || nChg) setShowComments(true);
      setPath(null);
      setFromFile(file.path);
      setDirty(true);
      const notes = [
        nCmt ? `${nCmt} ${nCmt === 1 ? 'comentariu' : 'comentarii'}` : '',
        nChg ? `${nChg} ${nChg === 1 ? 'modificare urmărită' : 'modificări urmărite'}` : '',
      ].filter(Boolean);
      const cmtNote = notes.length ? `, cu ${notes.join(' și ')}` : '';
      setStatus(`${repaired ? 'Fișierul era deteriorat și a fost reparat: s-a adus tot ce era întreg. ' : ''}${signedNote(signers)}Importat din ${fileName(file.path)}${cmtNote}${simplified ? ' (documentul era prea complicat: s-a adus doar textul, fără formatare)' : warnings ? ' (unele detalii de formatare nu au putut fi păstrate)' : ''}. Salvează cu Ctrl+S.`);
    } catch (e) {
      setStatus('');
      alert('Documentul .docx nu a putut fi citit: ' + (e as Error).message);
    }
  };

  // „Pagina X din Y” din bara de stare: se recalculează puțin după fiecare modificare, ca scrisul să rămână rapid.
  const [pageInfo, setPageInfo] = useState({ page: 1, pages: 1 });
  // Antetul / subsolul editat direct pe pagină (dublu clic în marginea de sus / de jos), cu fila contextuală „Antet și subsol”.
  const [hfEdit, setHfEdit] = useState<null | 'header' | 'footer'>(null);
  const hfInput = useRef<HTMLInputElement>(null);
  const hfFirst = hfEdit === 'header' && !!pageFirst(page);
  const hfRaw = hfEdit === 'header' ? (pageFirst(page) ? pageFirst(page)!.header : page.header) : hfEdit === 'footer' ? page.footer : '';
  const setHfRaw = (t: string) => {
    if (hfEdit === 'header') { const fp = pageFirst(page); setPage(fp ? { ...page, firstPage: { ...fp, header: t } } : { ...page, header: t }); }
    else if (hfEdit === 'footer') setPage({ ...page, footer: t });
    setDirty(true); setStatus(path ? 'Se salvează…' : 'Nesalvat');
  };
  const closeHf = () => { setHfEdit(null); editor?.commands.focus(); };
  useEffect(() => {
    if (!hfEdit || !editor) return;
    setTimeout(() => hfInput.current?.focus(), 0);
    // Un clic în textul documentului închide editarea antetului, ca în procesorul de text cunoscut.
    const dom = editor.view.dom;
    const down = () => setHfEdit(null);
    dom.addEventListener('mousedown', down);
    return () => dom.removeEventListener('mousedown', down);
  }, [hfEdit, editor]);
  const hfField = (tok: string) => {
    const i = hfInput.current;
    const a = i?.selectionStart ?? hfRaw.length, b = i?.selectionEnd ?? hfRaw.length;
    setHfRaw(hfRaw.slice(0, a) + tok + hfRaw.slice(b));
    setTimeout(() => { if (i) { i.focus(); i.setSelectionRange(a + tok.length, a + tok.length); } }, 0);
  };
  const hfUpd = (p: PageSetup) => { setPage(p); setDirty(true); setStatus(path ? 'Se salvează…' : 'Nesalvat'); };
  // Marginea de sus / de jos a paginii: dublu clic acolo (în afara textului) deschide antetul / subsolul.
  const onPageDbl = (e: React.MouseEvent<HTMLDivElement>) => {
    if (locked || !editor?.isEditable || webLayout || draft) return;
    const t = e.target as HTMLElement;
    if (t.closest('.ProseMirror') || t.closest('.doc-hf-edit')) return;
    const el = e.currentTarget, r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    const z = r.height / el.offsetHeight || 1;
    const top = parseFloat(cs.paddingTop) * z, bottom = parseFloat(cs.paddingBottom) * z;
    if (e.clientY - r.top <= Math.max(top, 40)) setHfEdit('header');
    else if (r.bottom - e.clientY <= Math.max(bottom, 40)) setHfEdit('footer');
  };
  useEffect(() => {
    if (!editor) return;
    let t = 0;
    const run = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        const m = pageMargins(page);
        const pageH = (paperSize(page).h - m.top - m.bottom) * 3.78;
        setPageHeight(editor.view, pageH);
        const next = measurePages(editor.view, pageH);
        setPageInfo((old) => (old.page === next.page && old.pages === next.pages ? old : next));
      }, 150);
    };
    run();
    editor.on('transaction', run);
    return () => { window.clearTimeout(t); editor.off('transaction', run); };
  }, [editor, page, zoom]);

  // Marcat ca final: documentul se deschide doar pentru citire (ca în Word), până la „Editează oricum”.
  // Restricționat (doar citire / doar comentarii): la fel, fără editare, până la „Oprește protecția” (cu parola, dacă are).
  const locked = !!page.final || !!page.restrict;
  useEffect(() => { if (editor && editor.isEditable === locked) editor.setEditable(!locked); }, [editor, locked]);

  // Vizualizare → Macrocomenzi: înregistrarea ține pașii fiecărei schimbări din document (cei care intră în Anulează);
  // pașii la rând de același fel (literele scrise una după alta) se unesc într-unul.
  useEffect(() => {
    if (!editor) return;
    const on = ({ transaction: tr }: { transaction: PmTransaction }) => {
      const r = recRef.current;
      if (!r) return;
      if (tr.docChanged && tr.getMeta('addToHistory') !== false) for (const st of tr.steps) {
        const last = r.steps[r.steps.length - 1];
        const merged = last?.merge(st);
        if (merged) r.steps[r.steps.length - 1] = merged; else if (r.steps.length < MAX_MACRO_STEPS) r.steps.push(st);
      }
      if (tr.docChanged || tr.selectionSet) r.end = [editor.state.selection.anchor, editor.state.selection.head];
    };
    editor.on('transaction', on);
    return () => { editor.off('transaction', on); };
  }, [editor]);
  const docMacros = page.macros ?? [];
  const setMacros = (macros: DocMacro[]) => {
    setPage((p) => { const n: PageSetup = { ...p, macros }; if (!macros.length) delete n.macros; return n; });
    setDirty(true);
  };
  const saveMine = (list: DocMacro[]) => { setMyMacros(list); void api.setSettings({ docsMacros: list }).catch(() => {}); };
  const startRec = (name: string, rel: boolean, note: string, key: string, all: boolean) => {
    if (!editor) return;
    recRef.current = { name, rel, note, key, all, base: editor.state.selection.from, steps: [], end: null };
    setRecName(name);
    setMacroDlg(null);
    setStatus(`Se înregistrează macrocomanda „${name}”: scrie și formatează, apoi Vizualizare → ⏹ Oprește înregistrarea.`);
    editor.commands.focus();
  };
  const stopRec = () => {
    const r = recRef.current;
    recRef.current = null;
    setRecName(null);
    if (!r) return;
    if (!r.steps.length) { setStatus(`Macrocomanda „${r.name}” n-a fost păstrată: nu s-a schimbat nimic în document cât timp s-a înregistrat.`); editor?.commands.focus(); return; }
    const base = r.rel ? r.base : 0;
    const m: DocMacro = { name: r.name, rel: r.rel, steps: recordSteps(r.steps, base), ...(r.end ? { end: [r.end[0] - base, r.end[1] - base] as [number, number] } : {}), ...(r.note.trim() ? { note: r.note.trim() } : {}), ...(r.key ? { key: r.key } : {}) };
    if (r.all) saveMine([...myMacros, m]); else setMacros([...docMacros, m]);
    setStatus(`Macrocomanda „${r.name}” e gata (${m.steps.length === 1 ? 'un pas' : `${m.steps.length} pași`}): ${r.key ? `Ctrl+Shift+${r.key} sau ` : ''}Vizualizare → Macrocomenzi → ▶ Rulează.`);
    editor?.commands.focus();
  };
  const playMacro = (m: DocMacro) => {
    if (!editor) return;
    setMacroDlg(null);
    if (locked) { setStatus('Documentul e doar pentru citire: macrocomanda nu poate schimba nimic.'); return; }
    const { state } = editor;
    const tr = state.tr;
    const base = state.selection.from;
    const res = playSteps(tr, state.schema, m, base);
    if (!res.done) { setStatus(`Macrocomanda „${m.name}” nu s-a putut rula aici: primul pas nu se potrivește cu documentul în acest loc.`); editor.commands.focus(); return; }
    const end = res.failed ? null : endSelection(m, base, tr.doc.content.size);
    if (end) { try { tr.setSelection(PmTextSelection.between(tr.doc.resolve(end[0]), tr.doc.resolve(end[1]))); } catch { /* cursorul rămâne unde l-au dus pașii */ } }
    editor.view.dispatch(tr.setMeta('docMacro', m.name).scrollIntoView());
    editor.commands.focus();
    setStatus(res.failed ? `Macrocomanda „${m.name}” s-a oprit la pasul ${res.failed} din ${m.steps.length}: documentul e altfel în acest loc (Ctrl+Z anulează ce s-a făcut).` : `Macrocomanda „${m.name}” a rulat${m.rel ? ' de la cursor' : ''} (Ctrl+Z o anulează).`);
  };
  macroKeysRef.current = { doc: docMacros, mine: myMacros, play: playMacro };
  // Căutarea de comenzi (Ctrl+K / Alt+Q): fiecare macrocomandă e o comandă, cu scurtătura ei.
  useCommands(tab, [...docMacros, ...myMacros].map((m) => ({ label: `Macrocomandă: ${m.name}`, keys: m.key ? `Ctrl+Shift+${m.key}` : undefined,
    hint: m.note || 'Rulează macrocomanda de la cursor', run: () => playMacro(m) })), 'macros');
  const applyRestrict = (mode: RestrictMode, pw?: SheetPw) => {
    setRestrictDlg(false);
    setDirty(true);
    if (mode === 'tracked') {
      setPage({ ...page, trackLock: true, restrict: undefined });
      if (!tracking && editor) { setTracking(true); editor.commands.setTracking(true, author); setShowComments(true); }
      setStatus('🔐 Protejat: orice schimbare se urmărește, iar modificările nu se pot accepta sau respinge până la oprirea protecției (🔒)');
      return;
    }
    setPage({ ...page, restrict: { mode, ...(pw ? { pw } : {}) } });
    if (mode === 'comments') setShowComments(true);
    setStatus(`🔐 Protejat: ${mode === 'read' ? 'doar citire' : 'doar comentarii'}${pw ? ', cu parolă' : ''}. Salvează ca să rămână așa.`);
  };
  const stopRestrict = () => {
    setUnrestrictDlg(false);
    setPage({ ...page, restrict: undefined });
    setDirty(true);
    setStatus('Protecția e oprită: documentul se poate modifica din nou');
  };
  const editAnyway = () => { setPage({ ...page, final: undefined }); setDirty(true); setStatus(path ? 'Se salvează…' : 'Nesalvat'); editor?.commands.focus(); };

  if (!editor) return null;
  const text = editor.state.doc.textContent;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const placeholders = (text.match(PLACEHOLDER_RE) ?? []).length;
  const comments = listComments(editor.state.doc);
  const changes = listChanges(editor.state.doc);

  return (
    <div className={`editor${focusMode ? ' docs-focus' : ''}${readMode ? ' docs-read' : ''}${webLayout || draft ? ' docs-web' : ''}${draft ? ' docs-draft' : ''}${markup !== 'all' ? ' docs-mk-' + markup : ''}`} ref={rootRef} data-docstyles={styleScope}>
      {page.styles && <style>{stylesCss(page.styles, `[data-docstyles="${styleScope}"]`)}</style>}
      {readMode && <ReadBar editor={editor} page={readPage} onExit={exitRead} />}
      {immersive && <Immersive editor={editor} onClose={() => { setImmersive(false); editor.commands.focus(); }} />}
      {outlineLevel(editor.state) > 0 && !readMode && (
        <div className="docs-outline-bar" role="toolbar" aria-label="Schiță">
          <b>☰ Schiță</b>
          <label>Arată
            <select value={outlineLevel(editor.state)} onChange={(e) => editor.chain().focus().setOutlineLevel(Number(e.target.value)).run()} aria-label="Ce arată schița">
              <option value={1}>Titlurile de nivel 1</option>
              <option value={2}>Titlurile de nivel 1–2</option>
              <option value={3}>Titlurile de nivel 1–3</option>
              <option value={6}>Toate titlurile</option>
              <option value={9}>Tot textul</option>
            </select>
          </label>
          <button onClick={() => editor.chain().focus().collapseAllHeadings(true).run()} title="Strânge toate titlurile: se văd doar titlurile de sus">⊟ Strânge tot</button>
          <button onClick={() => editor.chain().focus().collapseAllHeadings(false).run()} disabled={!collapsedCount(editor.state)} title="Desface toate titlurile strânse">⊞ Desface tot</button>
          <span className="docs-outline-move" role="group" aria-label="Mută și schimbă nivelul">
            <button onClick={() => editor.chain().focus().moveOutlineBlock(-1).run()} title="Mută titlul (cu tot ce e sub el) mai sus (Alt+Shift+↑)" aria-label="Mută mai sus">↑</button>
            <button onClick={() => editor.chain().focus().moveOutlineBlock(1).run()} title="Mută titlul (cu tot ce e sub el) mai jos (Alt+Shift+↓)" aria-label="Mută mai jos">↓</button>
            <button onClick={() => editor.chain().focus().shiftOutlineLevel(-1).run()} title="Ridică nivelul: Titlu 2 → Titlu 1; un paragraf devine titlu (Alt+Shift+←)" aria-label="Ridică nivelul">←</button>
            <button onClick={() => editor.chain().focus().shiftOutlineLevel(1).run()} title="Coboară nivelul: Titlu 1 → Titlu 2 (Alt+Shift+→)" aria-label="Coboară nivelul">→</button>
          </span>
          <span className="docs-outline-hint">Clic pe ▾ / ▸ din fața unui titlu îl strânge sau îl desface. La tipărire și în PDF se vede tot textul.</span>
          <button onClick={() => editor.chain().focus().setOutlineLevel(0).run()} title="Înapoi la aspectul obișnuit (titlurile strânse rămân strânse)">✕ Închide schița</button>
        </div>
      )}
      {focusMode && <button className="docs-focus-exit" onClick={toggleFocus} title="Ieși din modul concentrare (Esc)">✕ Ieși (Esc)</button>}
      <FormatBar onDrawTable={() => setDrawTable(true)} editor={editor} locked={locked} recent={{ kind: 'doc', open: (p) => void openRecentDoc(p) }} onSave={() => save()} onComment={addComment} onLink={() => setLinkDlg(true)} columns={pageColumns(page)} pageH={(paperSize(page).h - pageMargins(page).top - pageMargins(page).bottom) * 3.78} props={docProps(page)} file={path ? fileName(path) : ''} onStatus={setStatus} styles={page.styles} onStyles={setDocStyles} onStylesPane={() => setShowStyles(!showStyles)}
        hfTab={hfEdit && !locked ? (
<>
        <RGroup label="Antet și subsol">
          <RMenu label="▤ Antet" ariaLabel="Antet (fila Antet și subsol)" active={!!page.header} title="Antet: modifici textul de sus sau îl elimini" items={[
            { label: 'Editare antet', run: () => setHfEdit('header') },
            { label: 'Eliminare antet', run: () => { hfUpd({ ...page, header: '' }); } },
            ...HF_GALLERY.header.map(([l, t], i) => ({ label: l, sep: i === 0, title: 'Model gata făcut: câmpurile (titlu, autor, dată, fișier) se completează singure din document', checked: page.header === t, run: () => hfUpd({ ...page, header: t }) })),
          ]} />
          <RMenu label="▁ Subsol" ariaLabel="Subsol (fila Antet și subsol)" active={!!page.footer} title="Subsol: modifici textul de jos sau îl elimini" items={[
            { label: 'Editare subsol', run: () => setHfEdit('footer') },
            { label: 'Eliminare subsol', run: () => { hfUpd({ ...page, footer: '' }); } },
            ...HF_GALLERY.footer.map(([l, t], i) => ({ label: l, sep: i === 0, title: 'Model gata făcut: câmpurile (titlu, autor, dată, fișier) se completează singure din document', checked: page.footer === t, run: () => hfUpd({ ...page, footer: t }) })),
          ]} />
          <RMenu label="# Număr de pagină" ariaLabel="Număr de pagină (fila Antet și subsol)" active={page.numbers} title="Numărul paginii: unde stă" items={[
            { label: 'Fără numere', checked: !page.numbers, run: () => hfUpd({ ...page, numbers: false }) },
            ...NUM_ATS.map(([k, l]) => ({ label: l[0].toUpperCase() + l.slice(1), checked: page.numbers && pageNumAt(page) === k, run: () => hfUpd({ ...page, numbers: true, numAt: k === 'br' ? undefined : k }) })),
          ]} />
        </RGroup>
        <RGroup label="Inserare">
          {HF_FIELDS.map(([tok, what]) => (
            <button key={tok} className="fmt hf-field-btn" onMouseDown={(e) => e.preventDefault()} onClick={() => hfField(tok)} title={`Pune la cursor câmpul ${tok}: ${what}`}>
              {tok === '{data}' ? '📅 Dată' : tok === '{fisier}' ? '📄 Nume fișier' : tok === '{autor}' ? '👤 Autor' : '🔤 Titlu'}
            </button>
          ))}
        </RGroup>
        <RGroup label="Navigare">
          <button className={hfEdit === 'header' ? 'fmt active' : 'fmt'} onClick={() => setHfEdit('header')} title="Salt la antet: textul de sus al paginii">⤒ Salt la antet</button>
          <button className={hfEdit === 'footer' ? 'fmt active' : 'fmt'} onClick={() => setHfEdit('footer')} title="Salt la subsol: textul de jos al paginii">⤓ Salt la subsol</button>
          {/* Legat de anterior: secțiunea cursorului (după o întrerupere de secțiune) poate avea antetul și subsolul ei. */}
          {(() => {
            const pos = editor ? breakBefore(editor.state, 'sectionBreak') : -1;
            const node = pos >= 0 ? editor!.state.doc.nodeAt(pos) : null;
            if (!node) return null;
            const hdr = sectionHf(node.attrs.hdr), ftr = sectionHf(node.attrs.ftr), linked = hdr === null && ftr === null;
            const set = (h: string | null, f: string | null) => { editor!.commands.setSectionHf(h, f); force((n) => n + 1); };
            return (
<>
              <label className="hf-opt" title="Legat de anterior: secțiunea în care e cursorul are același antet și subsol ca secțiunea de dinainte; debifat, îi scrii antetul și subsolul ei">
                <input type="checkbox" aria-label="Legat de anterior" checked={linked} onChange={(e) => set(e.target.checked ? null : page.header, e.target.checked ? null : page.footer)} /> 🔗 Legat de anterior
              </label>
              {!linked && <input className="hf-sec-in" aria-label="Antetul secțiunii" placeholder="Antetul secțiunii" value={hdr ?? ''} onChange={(e) => set(e.target.value, ftr ?? '')} />}
              {!linked && <input className="hf-sec-in" aria-label="Subsolul secțiunii" placeholder="Subsolul secțiunii" value={ftr ?? ''} onChange={(e) => set(hdr ?? '', e.target.value)} />}
</>
            );
          })()}
        </RGroup>
        <RGroup label="Opțiuni">
          <label className="hf-opt" title="Prima pagină are antetul și subsolul ei (de exemplu o copertă fără antet)">
            <input type="checkbox" aria-label="Prima pagină diferită" checked={!!pageFirst(page)} onChange={(e) => hfUpd({ ...page, firstPage: e.target.checked ? { header: '', footer: '', numbers: false } : undefined })} /> Prima pagină diferită
          </label>
          <label className="hf-opt" title="Paginile pare (2, 4, 6…) au antetul și subsolul lor, de exemplu la o carte tipărită față-verso">
            <input type="checkbox" aria-label="Pagini pare și impare diferite" checked={!!pageEven(page)} onChange={(e) => hfUpd({ ...page, evenPage: e.target.checked ? { header: page.header, footer: page.footer } : undefined })} /> Pagini pare și impare diferite
          </label>
          <button className="fmt" onClick={() => setPageDlg(hfEdit === 'footer' ? 'Subsol (jos)' : 'Antet (sus)')} title="Toate opțiunile antetului și subsolului (fereastra Pagină): antetul paginilor pare, al primei pagini, forma numărului">⚙ Mai multe…</button>
        </RGroup>
        <RGroup label="Închidere">
          <button className="fmt hf-close" onClick={closeHf} title="Închidere antet și subsol (Esc): înapoi la textul documentului">✕ Închidere antet și subsol</button>
        </RGroup>
</>
        ) : null}
        top={{
          file: (
<>
        <button onClick={newDoc} title="Ctrl+N">Nou</button>
        <button onClick={() => setTplDlg(true)} title="Contracte, cerere, proces-verbal, împuternicire, ofertă de preț, CV, scrisoare de intenție, demisie, declarație, minută de ședință, cerere de concediu, notificare de plată, contract de vânzare auto, contract de comodat, adeverință de salariat, scrisoare de recomandare, reclamație, contract de împrumut, acord de confidențialitate, cerere de reziliere, plângere împotriva unei amenzi, proces-verbal de constatare a pagubei, notificare de retragere (retur online), cerere de restituire a garanției (chirie), invitație de nuntă, invitație la botez, referat de necesitate, proces-verbal de recepție, decizie internă, felicitare de sărbători, contract de voluntariat, proces-verbal de predare a locuinței, anunț de schimbare a sediului, fișa postului, acord de încetare a contractului de muncă, fișa de evaluare a performanțelor, felicitare de ziua de naștere, cerere de eșalonare a plății, proces-verbal de compensare, proces-verbal de casare, proces-verbal de inventariere, ordin de deplasare (delegație), act adițional la contract, cerere de ofertă, comandă către furnizor, notificare de neconformitate la livrare, proces-verbal de eliminare din arhivă, notă explicativă a gestionarului, confirmare de sold, raport lunar al agentului de vânzări">Din șablon…</button>
        <button onClick={open} title="Ctrl+O">Deschide</button>
        <button onClick={() => save()} title="Ctrl+S">Salvează</button>
        <button onClick={() => save(true)} title="Ctrl+Shift+S">Salvează ca…</button>
        <button onClick={() => setVerDlg(true)} title="Variantele mai vechi ale documentului, păstrate automat la salvare">Versiuni</button>
        <button onClick={() => setDraftDlg(true)} title="Recuperează documentele nesalvate: copiile păstrate automat în ultimele 7 zile, și după închiderea fără salvare">Recuperează…</button>
        <button onClick={importDocx} title="Deschide un document .docx (și cele vechi .doc, doar textul), .odt, .rtf sau .txt ca document nou">Import .docx</button>
        <button onClick={exportPdf} title="Salvează documentul ca PDF">Export PDF</button>
        <button onClick={() => exportDocx()} title="Salvează documentul ca fișier .docx">Export .docx</button>
        <button onClick={() => void mailDocx()} title="Trimite prin e-mail: un mesaj nou cu documentul atașat ca .docx, deschis în programul tău de e-mail (scrii adresa și apeși Trimite)">✉ Trimite prin e-mail…</button>
        <select className="tb-other" value="" onChange={(e) => { const v = e.target.value; e.target.value = ''; if (v === 'docxpw') void exportDocx(true); else if (v === 'docxsig') setSignDlg(true); else if (v === 'txt' || v === 'html' || v === 'odt' || v === 'rtf') void exportOther(v); }} title="Salvează documentul în alt format" aria-label="Export în alt format">
          <option value="">Alt format…</option>
          <option value="docxpw">.docx cu parolă</option>
          <option value="docxsig">.docx semnat digital…</option>
          <option value="odt">OpenDocument (.odt)</option>
          <option value="rtf">Text formatat (.rtf)</option>
          <option value="txt">Text simplu (.txt)</option>
          <option value="html">Pagină web (.html)</option>
        </select>
        <button onClick={printPreview} title="Previzualizare înaintea imprimării: paginile exact cum ies la tipărire (Ctrl+F2)">Previzualizare</button>
        <button onClick={() => void print()} title="Ctrl+P">Tipărește</button>
        <button className={docProps(page) || page.final ? 'active' : ''} onClick={() => setPropsDlg(true)} title="Proprietățile documentului: titlu, subiect, autor, cuvinte cheie (se salvează și în fișierul .docx)">ⓘ Proprietăți</button>
        <button onClick={() => setOptDlg(true)} title="Opțiuni: numele tău, ortografia, AutoCorect, salvarea automată, rigla și panourile">⚙ Opțiuni</button>
</>
),
          nav: (
<>
        <button className={showNav ? 'active' : ''} onClick={() => setShowNav(!showNav)} title="Panoul de navigare: titlurile documentului, cu click te duce la ele">☰ Navigare</button>
</>
),
          stylesPane: (
<>
        <button className={showStyles ? 'active' : ''} onClick={() => setShowStyles(!showStyles)} title="Panoul Stiluri: toate stilurile cu cum arată, clic pune stilul; seturi de stiluri pentru tot documentul (Ctrl+Shift+Alt+S)">¶ Stiluri</button>
</>
),
          speak: (
<>
        <button className={speaking ? 'active' : ''} onClick={readAloud} title={speaking ? 'Oprește citirea' : 'Citește cu voce tare textul selectat sau de la cursor până la sfârșit (cu vocile instalate în sistem, fără internet)'} aria-label="Citește cu voce tare">{speaking ? '⏹' : '🔊'}</button>
</>
),
          // Inserare › Antet și subsol, ca în procesorul de text cunoscut: Antet ▾, Subsol ▾, Număr de pagină ▾.
          insertHf: (() => {
            const upd = (p: PageSetup) => { setPage(p); setDirty(true); setStatus(path ? 'Se salvează…' : 'Nesalvat'); editor?.commands.focus(); };
            return (
<>
          <RMenu label="▤ Antet" ariaLabel="Antet" keytip="H" active={!!page.header} title="Antet: textul de sus al fiecărei pagini (de exemplu numele firmei sau titlul)" items={[
            { label: 'Editare antet…', title: 'Textul de sus, cu câmpuri ca data sau numele fișierului (fereastra Pagină)', run: () => setPageDlg('Antet (sus)') },
            { label: 'Eliminare antet', run: () => upd({ ...page, header: '' }) },
            ...HF_GALLERY.header.map(([l, t], i) => ({ label: l, sep: i === 0, title: 'Model gata făcut: câmpurile (titlu, autor, dată, fișier) se completează singure din document', checked: page.header === t, run: () => upd({ ...page, header: t }) })),
          ]} />
          <RMenu label="▁ Subsol" ariaLabel="Subsol" keytip="O" active={!!page.footer} title="Subsol: textul de jos al fiecărei pagini" items={[
            { label: 'Editare subsol…', title: 'Textul de jos (fereastra Pagină)', run: () => setPageDlg('Subsol (jos)') },
            { label: 'Eliminare subsol', run: () => upd({ ...page, footer: '' }) },
            ...HF_GALLERY.footer.map(([l, t], i) => ({ label: l, sep: i === 0, title: 'Model gata făcut: câmpurile (titlu, autor, dată, fișier) se completează singure din document', checked: page.footer === t, run: () => upd({ ...page, footer: t }) })),
          ]} />
          <RMenu label="# Număr de pagină" ariaLabel="Număr de pagină" keytip="NU" active={page.numbers} title="Numărul paginii: unde stă și cum arată" items={[
            { label: 'Fără numere', checked: !page.numbers, run: () => upd({ ...page, numbers: false }) },
            ...NUM_ATS.map(([k, l]) => ({ label: l[0].toUpperCase() + l.slice(1), checked: page.numbers && pageNumAt(page) === k, run: () => upd({ ...page, numbers: true, numAt: k === 'br' ? undefined : k }) })),
            { label: 'Formatare numere de pagină…', sep: true, title: 'De exemplu „Pagina 1 din 5” sau doar „1” (fereastra Pagină)', run: () => { if (!page.numbers) setPage({ ...page, numbers: true }); setPageDlg('Forma numărului paginii'); } },
          ]} />
</>
            );
          })(),
          layoutQuick: (() => {
            // Fila Aspect: alegerile rapide pun direct valoarea; „…” deschide aceeași fereastră Pagină, la rândul potrivit.
            const upd = (p: PageSetup) => { setPage(p); setDirty(true); setStatus(path ? 'Se salvează…' : 'Nesalvat'); editor?.commands.focus(); };
            const m = page.margins ? -1 : pageMargin(page);
            const ln = lineNums(page);
            return (
<>
        <RGroup label="Inițializare pagină">
          <RMenu label="Margini" title="Marginile paginii: înguste, obișnuite, late sau diferite pe fiecare latură" items={[
            ...MARGINS.map((v) => ({ label: `${(v / 10).toLocaleString('ro-RO')} cm${v === 20 ? ' (obișnuite)' : v === 10 ? ' (înguste)' : v === 30 ? ' (late)' : ''}`, checked: m === v, title: `Margini de ${(v / 10).toLocaleString('ro-RO')} cm pe toate laturile`, run: () => upd({ ...page, margin: v, margins: undefined }) })),
            { label: 'Margini particularizate…', checked: m === -1, sep: true, title: 'Margini diferite sus, jos, stânga și dreapta (fereastra Pagină)', run: () => setPageDlg('Marginile paginii') },
            ...MARGINS.map((v, i) => ({ label: `Doar secțiunea aceasta: ${(v / 10).toLocaleString('ro-RO')} cm`, sep: i === 0, title: 'Doar secțiunea în care e cursorul; dacă e prima, pune aici o întrerupere de secțiune (Pagina următoare) și schimbă de aici înainte', run: () => { editor?.chain().focus().setSectionMargin(v).run(); } })),
            { label: 'Doar secțiunea aceasta: ca documentul', title: 'Secțiunea în care e cursorul ia din nou marginile documentului', run: () => { editor?.chain().focus().setSectionMargin(0).run(); } },
          ]} />
          <RMenu label="Orientare" title="Pagina în picioare (verticală) sau culcată (orizontală, peisaj)" items={[
            { label: 'Verticală', checked: !page.landscape, run: () => upd({ ...page, landscape: false }) },
            { label: 'Orizontală (peisaj)', checked: !!page.landscape, run: () => upd({ ...page, landscape: true }) },
            // Doar secțiunea cursorului (pe întreruperea de secțiune dinaintea lui; în prima secțiune pune una aici).
            ...(['portrait', 'landscape'] as const).map((o, i) => ({ label: SECTION_ORIENT_MENU[o], sep: i === 0, title: 'Doar secțiunea în care e cursorul; dacă e prima, pune aici o întrerupere de secțiune (Pagina următoare) și schimbă de aici înainte', run: () => { editor?.chain().focus().setSectionOrient(o).run(); } })),
          ]} />
          <RMenu label="Mărime" title="Mărimea hârtiei: A4, A5, A3, Letter, plicuri" items={PAPERS.map(([k, l]) => ({ label: l, checked: pagePaper(page) === k, run: () => upd({ ...page, paper: k }) }))} />
          <RMenu label="Coloane" title="Textul pe una, două sau trei coloane (ca la ziare și pliante)" items={[...[1, 2, 3].map((n) => ({ label: n === 1 ? 'Una' : n === 2 ? 'Două' : 'Trei', checked: pageColumns(page) === n, run: () => upd({ ...page, columns: n }) })),
            { label: 'Linie între coloane', sep: true, checked: pageColLine(page), title: 'O linie subțire între coloane, ca la ziare (și la tipărire, .docx, .odt); doar când textul e pe două sau trei coloane', run: () => { if (pageColumns(page) > 1) upd({ ...page, colLine: !pageColLine(page) || undefined }); } }]} />
          {/* Întreruperi ▾, ca în procesorul de text cunoscut: de pagină și de secțiune. */}
          <RMenu label="Întreruperi" keytip="B" title="Întreruperi: textul de după începe pe pagina următoare, în coloana următoare sau pe rândul următor" items={[
            { label: 'Pagină (Ctrl+Enter)', title: 'Textul de după începe pe pagina următoare', run: () => { editor?.chain().focus().setPageBreak().run(); } },
            { label: 'Coloană (Ctrl+Shift+Enter)', title: 'Textul de după începe în coloana următoare (când pagina are mai multe coloane)', run: () => { editor?.chain().focus().setColumnBreak().run(); } },
            { label: 'Încadrare text (Shift+Enter)', title: 'Rând nou în același paragraf', run: () => { editor?.chain().focus().setHardBreak().run(); } },
            ...SECTION_KINDS.map((k, i) => ({ label: SECTION_MENU[k], sep: i === 0, title: SECTION_TIPS[k], run: () => { editor?.chain().focus().setSectionBreak(k).run(); } })),
          ]} />
          <RMenu label="Despărțire în silabe" title="Desparte automat cuvintele lungi în silabe la capăt de rând, cu cratimă (rândurile aliniate stânga-dreapta au spații mai egale)" active={!!page.hyphenate} items={[
            { label: 'Fără', checked: !page.hyphenate, run: () => upd({ ...page, hyphenate: undefined }) },
            { label: 'Automat', checked: !!page.hyphenate, run: () => upd({ ...page, hyphenate: true }) },
          ]} />
          <RMenu label="Numere de rând" title="Un număr în stânga fiecărui rând, ca în contracte și textele juridice" active={!!ln} items={[
            { label: 'Fără', checked: !ln, run: () => upd({ ...page, lineNums: undefined }) },
            { label: 'Continuu, în tot documentul', checked: !!ln && !ln.page, run: () => upd({ ...page, lineNums: { ...ln, page: undefined } }) },
            { label: 'De la 1 pe fiecare pagină', checked: !!ln?.page, run: () => upd({ ...page, lineNums: { ...ln, page: true } }) },
          ]} />
        </RGroup>
        <RGroup label="Antet și subsol">
          <button className={page.header || page.footer ? 'active' : ''} onClick={() => setPageDlg('Antet (sus)')} title="Antet și subsol: textul de sus și de jos al fiecărei pagini, cu prima pagină sau paginile pare diferite (fereastra Pagină)">▤ Antet și subsol</button>
          <RMenu label="Numere de pagină" active={page.numbers} title="Numărul paginii: unde stă și cum arată" items={[
            { label: 'Fără numere', checked: !page.numbers, run: () => upd({ ...page, numbers: false }) },
            ...NUM_ATS.map(([k, l]) => ({ label: l[0].toUpperCase() + l.slice(1), checked: page.numbers && pageNumAt(page) === k, run: () => upd({ ...page, numbers: true, numAt: k === 'br' ? undefined : k }) })),
            { label: 'Forma numărului…', sep: true, title: 'De exemplu „Pagina 1 din 5” sau doar „1” (fereastra Pagină)', run: () => { if (!page.numbers) setPage({ ...page, numbers: true }); setPageDlg('Forma numărului paginii'); } },
          ]} />
        </RGroup>
</>
            );
          })(),
          // Aspect › Aranjare (ca în procesorul de text cunoscut): lucrează pe imaginea aleasă, prin butoanele filei ei; fără imagine, oprite.
          arrange: (() => {
            const on = !!editor && !locked && editor.isEditable && editor.isActive('image');
            const al = on ? String(editor.getAttributes('image').align ?? 'center') : '';
            const fl = al === 'front' || al === 'behind';
            const go = (title: string) => () => {
              const pane = editor?.view.dom.closest('.module-pane') ?? document;
              [...pane.querySelectorAll<HTMLElement>('.ribbon-panel[data-tab="image"] button')].find((x) => x.title.startsWith(title))?.click();
            };
            const off = 'Alegeți întâi o imagine (clic pe ea)';
            // Panoul de selecție: imaginile și casetele de text din document, în ordine; un clic alege obiectul și îl aduce în fereastră.
            const objs: { pos: number; label: string }[] = [];
            if (editor) {
              let ni = 0, nb = 0;
              editor.state.doc.descendants((n, pos) => {
                if (n.type.name === 'image') { const alt = String(n.attrs.alt ?? '').trim(); objs.push({ pos, label: `Imagine ${++ni}${alt ? ': ' + alt.slice(0, 40) : ''}` }); return false; }
                if (n.type.name === 'textBox') { const t = n.textContent.trim(); objs.push({ pos, label: `Casetă text ${++nb}${t ? ': ' + t.slice(0, 40) : ''}` }); return false; }
                return true;
              });
            }
            const pickObj = (pos: number) => {
              if (!editor) return;
              editor.chain().focus().setNodeSelection(pos).scrollIntoView().run();
            };
            const wrap: [string, string, string][] = [
              ['center', 'În rând cu textul', 'Centrat'], ['wrapLeft', 'Pătrat, imaginea în stânga', 'Imagine în stânga'],
              ['wrapRight', 'Pătrat, imaginea în dreapta', 'Imagine în dreapta'], ['behind', 'În spatele textului', 'În spatele textului'], ['front', 'În fața textului', 'În fața textului'],
            ];
            return (
        <RGroup label="Aranjare">
          <RMenu label="Poziție" disabled={!on} title={on ? 'Poziția imaginii pe pagină: în rând cu textul sau într-o parte, cu textul în jurul ei' : off} items={[
            { label: 'În rând cu textul', checked: al === 'center' || al === 'left' || al === 'right', run: go('Centrat') },
            { label: 'Sus în stânga, cu textul în jur', checked: al === 'wrapLeft', run: go('Imagine în stânga') },
            { label: 'Sus în dreapta, cu textul în jur', checked: al === 'wrapRight', run: go('Imagine în dreapta') },
          ]} />
          <RMenu label="Încadrare text" disabled={!on} title={on ? 'Cum stă textul față de imagine: în rând, în jurul ei, peste ea sau sub ea' : off}
            items={wrap.map(([k, l, t]) => ({ label: l, checked: k === 'center' ? ['center', 'left', 'right'].includes(al) : al === k, run: go(t) }))} />
          <RMenu label="Aducere în față" disabled={!fl} title={fl ? 'Imaginea deasupra celorlalte imagini' : 'Merge pentru imaginile puse „În fața textului” sau „În spatele textului” (Încadrare text ▾)'} items={[
            { label: 'Aducere în față', run: go('Adu în față') },
            { label: 'Aducere mai în față', run: go('Adu mai în față') },
          ]} />
          <RMenu label="Trimitere în spate" disabled={!fl} title={fl ? 'Imaginea sub celelalte imagini' : 'Merge pentru imaginile puse „În fața textului” sau „În spatele textului” (Încadrare text ▾)'} items={[
            { label: 'Trimitere în spate', run: go('Trimite în spate') },
            { label: 'Trimitere mai în spate', run: go('Trimite mai în spate') },
          ]} />
          <RMenu label="Aliniere" disabled={!on} title={on ? 'Imaginea la stânga, la centru sau la dreapta paginii' : off} items={[
            { label: 'Aliniere la stânga', checked: al === 'left', run: go('Aliniere stânga') },
            { label: 'Aliniere la centru', checked: al === 'center', run: go('Centrat') },
            { label: 'Aliniere la dreapta', checked: al === 'right', run: go('Aliniere dreapta') },
          ]} />
          <RMenu label="Rotire" disabled={!on} title={on ? 'Rotește sau răstoarnă imaginea' : off} items={[
            { label: 'Rotire la dreapta cu 90°', run: go('Rotește 90° spre dreapta') },
            { label: 'Rotire la stânga cu 90°', run: go('Rotește 90° spre stânga') },
            { label: 'Răsturnare pe verticală', run: go('Oglindește sus') },
            { label: 'Răsturnare pe orizontală', run: go('Oglindește stânga') },
          ]} />
          <RPop icon="▤ Panou de selecție" label="Panou de selecție" title={objs.length ? 'Panou de selecție: imaginile și casetele de text din document; clic pe unul îl alege' : 'Panou de selecție: documentul nu are încă imagini sau casete de text'}>
            {objs.length ? objs.map((o) => (
              <button key={o.pos} className="ribbon-menu-item" title={o.label} onMouseDown={(e) => e.preventDefault()} onClick={() => pickObj(o.pos)}>
                <span className="ribbon-menu-check" />{o.label}
              </button>
            )) : <span className="ribbon-menu-empty">Nicio imagine și nicio casetă de text în document</span>}
          </RPop>
        </RGroup>
            );
          })(),
          // Proiectare › Fundal pagină (ca în procesorul de text cunoscut): Filigran, Culoarea paginii, Chenarul paginii.
          pageBg: (() => {
            const upd = (p: PageSetup) => { setPage(p); setDirty(true); setStatus(path ? 'Se salvează…' : 'Nesalvat'); editor?.commands.focus(); };
            const wm = page.watermark?.trim() ?? '';
            return (
<>
          <RMenu label="Filigran" active={!!wm || !!pageWatermarkImage(page)} title="Un text mare, palid, pe fiecare pagină (CIORNĂ, CONFIDENȚIAL…)" items={[
            { label: 'Fără filigran', checked: !wm && !pageWatermarkImage(page), run: () => upd({ ...page, watermark: undefined, watermarkImage: undefined }) },
            ...WATERMARKS.map((w) => ({ label: w, checked: wm === w, run: () => upd({ ...page, watermark: w }) })),
            { label: 'Filigran din imagine…', checked: !!pageWatermarkImage(page), run: () => pickWatermarkImage((img) => upd({ ...page, watermarkImage: img })) },
            { label: 'Alt text, culoare, orizontal…', sep: true, checked: !!wm && !WATERMARKS.includes(wm), run: () => setPageDlg('Filigran') },
          ]} />
          <RMenu label="Culoarea paginii" active={!!pageBackground(page)} title="Culoarea foii (pe ecran și în .docx; la tipărire rămâne albă)" items={PAGE_COLORS.map(([c, l]) => ({ label: l, checked: pageBackground(page) === c, run: () => upd({ ...page, background: c || undefined }) }))} />
          <RMenu label="Chenarul paginii" active={!!pageBorder(page)} title="Chenar în jurul fiecărei pagini (la PDF, tipărire, .docx și .odt)" items={PAGE_BORDERS.map(([k, l]) => ({ label: l, checked: pageBorder(page) === k, run: () => upd({ ...page, border: (k || undefined) as PageBorder | undefined }) }))} />
</>
            );
          })(),
          page: (
<>
        <button className={hasPageSetup(page) || hasLayout(page) ? 'active' : ''} onClick={() => setPageDlg(true)} title="Pagina: vertical sau orizontal, marginile, textul de sus și de jos și numerele paginilor (la PDF, tipărire și .docx)">Pagină…</button>
</>
),
          restrict: (
<>
        <button className={page.restrict || page.trackLock ? 'active' : ''} onClick={() => (page.restrict ? (page.restrict.pw ? setUnrestrictDlg(true) : stopRestrict()) : setRestrictDlg(true))}
          title={page.restrict ? 'Documentul e protejat: clic ca să oprești protecția' : 'Restricționează editarea: doar citire, doar comentarii sau doar cu urmărirea modificărilor, cu parolă opțională (se păstrează și în .docx)'}>
          🔐 {page.restrict ? 'Protejat' : 'Restricționează…'}
        </button>
</>
),
          search: (
<>
        {/* Grupul Editare, ca în procesorul de text cunoscut: Găsire ▾, Înlocuire, Selectare ▾, unul sub altul. */}
        <div className="rb-rows doc-edit-rows">
        <RMenu label="🔍 Găsire" ariaLabel="Găsire" keytip="FD" title="Găsire: caută un cuvânt sau o expresie în document (Ctrl+F)" items={[
          { label: 'Găsire (Ctrl+F)', title: 'Bara de căutare deasupra documentului; rezultatele se evidențiază', run: () => setSearch('find') },
          { label: 'Găsire complexă…', title: 'Căutare cu opțiuni: litere mari / mici, cuvinte întregi, înlocuire (Ctrl+H)', run: () => setSearch('replace') },
          { label: 'Salt la… (Ctrl+G)', title: 'Mergi la o pagină, un titlu, un tabel, o imagine, un comentariu', run: () => setGoTo(true) },
        ]} />
        <button data-keytip="R" onClick={() => setSearch('replace')} title="Înlocuire: caută un text și îl schimbă cu altul (Ctrl+H)">↔ Înlocuire</button>
        <RMenu label="⬚ Selectare" ariaLabel="Selectare" keytip="SL" title="Selectare: tot documentul, paragraful de la cursor sau tot textul cu aceeași formatare" items={[
          { label: 'Selectare tot (Ctrl+A)', run: () => { editor.chain().focus().selectAll().run(); } },
          { label: 'Selectare paragraf', title: 'Alege tot paragraful în care e cursorul', run: () => { const { $from } = editor.state.selection; const d = $from.depth > 0 ? $from.depth : 1; editor.chain().focus().setTextSelection({ from: $from.start(d), to: $from.end(d) }).run(); } },
          { label: 'Selectare obiecte', title: 'Alege următoarea imagine, formă, grafic sau schemă din document (după cursor); apasă din nou pentru următorul obiect', run: () => {
            // Obiectele din Docs sunt toate imagini (pozele, formele, graficele, schemele, ecuațiile, textul artistic).
            const list: number[] = [];
            editor.state.doc.descendants((n, p) => { if (n.type.name === 'image') list.push(p); return true; });
            if (!list.length) { setStatus('Documentul nu are imagini, forme sau grafice.'); return; }
            const sel = editor.state.selection;
            const after = sel instanceof PmNodeSelection && sel.node.type.name === 'image' ? sel.from + 1 : sel.from;
            // După ultimul obiect se ia iar primul.
            const pos = list.find((p) => p >= after) ?? list[0];
            editor.chain().focus().setNodeSelection(pos).scrollIntoView().run();
            setStatus(`Obiectul ${list.indexOf(pos) + 1} din ${list.length} (Selectare obiecte din nou: următorul)`);
          } },
          { label: 'Selectare text cu formatare similară', title: 'Alege tot textul care arată ca textul de la cursor (același font, mărime, culoare, aldin, cursiv…), ca să-l schimbi deodată', run: () => { editor.commands.focus(); const n = selectSimilar(editor.view); setStatus(n ? `Am ales ${n} ${n === 1 ? 'bucată' : 'bucăți'} de text cu aceeași formatare.` : 'Nu e text de ales.'); } },
        ]} />
        </div>
</>
),
          mail: (
<>
        <button onClick={() => setMergeDlg(true)} title="Același document completat pentru fiecare rând dintr-un tabel (Cyber Office Studio, .xlsx sau CSV)">Îmbinare…</button>
        <button onClick={() => setLabelsDlg(true)} title="Etichete: același text (o adresă, un nume) pe o foaie de etichete autocolante, ca document nou">Etichete…</button>
        <button onClick={() => setEnvDlg(true)} title="Plic: adresa destinatarului și a expeditorului pe un plic DL, C6, C5 sau C4, ca document nou">Plic…</button>
</>
),
          // Corespondență, în cele 5 grupuri ale procesorului de text cunoscut; pașii îmbinării se fac în fereastra Îmbinare de corespondență.
          mailGroups: (() => {
            const field = (f: string) => { editor.chain().focus().insertContent(`«${f}»`).run(); };
            const noData = 'Alegeți întâi destinatarii (tabelul cu date): Selectare destinatari';
            return (
<>
        <RGroup label="Creare">
          <RvBtn on={() => setEnvDlg(true)} title="Plicuri: adresa destinatarului și a expeditorului pe un plic DL, C6, C5 sau C4, ca document nou">✉ Plicuri</RvBtn>
          <RvBtn on={() => setLabelsDlg(true)} title="Etichete: același text (o adresă, un nume) pe o foaie de etichete autocolante, ca document nou">🏷 Etichete</RvBtn>
        </RGroup>
        <RGroup label="Începere îmbinare corespondență">
          <RvBtn on={() => setMergeDlg(true)} title="Începere îmbinare corespondență: același document completat pentru fiecare rând dintr-un tabel (scrisori, diplome, contracte)">📨 Începere îmbinare</RvBtn>
          <RMenu label="Selectare destinatari" title="Tabelul cu destinatari: o foaie de calcul Cyber Office Studio, un .xlsx sau un .csv (primul rând are numele coloanelor)" items={[
            { label: 'Utilizare listă existentă…', run: () => setMergeDlg(true) },
            ...(mergeData ? [{ label: `Lista de acum: ${mergeData.source} (${mergeData.rows.length})`, checked: true, run: () => setMergeDlg(true) }] : []),
          ]} />
          <RvBtn on={() => setMergeDlg(true)} disabled={!mergeData} title={mergeData ? 'Editare listă destinatari: bifezi cine primește, filtrezi și ordonezi' : noData}>☑ Editare listă destinatari</RvBtn>
        </RGroup>
        <RGroup label="Scriere și inserare câmpuri">
          <RvBtn on={() => field(ADDRESS_FIELD)} title="Bloc de adrese: numele, firma, strada, codul și localitatea, județul, țara, fiecare pe rândul lui (din coloanele cu aceste nume)">📮 Bloc de adrese</RvBtn>
          <RvBtn on={() => field(GREETING_FIELD)} title="Linie de salut: „Stimate domnule Popescu,” / „Stimată doamnă Ionescu,” după coloana Titlu sau Gen; altfel „Bună ziua, Ion Popescu,”">👋 Linie de salut</RvBtn>
          <RMenu label="Inserare câmp de îmbinare" disabled={!mergeData?.headers.length} title={mergeData ? 'Pune în document un câmp din tabel, de exemplu «Nume»' : noData}
            items={(mergeData?.headers ?? []).map((h) => ({ label: `«${h}»`, run: () => field(h) }))} />
          <RvBtn on={() => setMergeDlg(true)} disabled={!mergeData} title={mergeData ? 'Reguli: un text dacă o coloană are o anumită valoare, sau sări peste unele rânduri (în fereastra Îmbinare)' : noData}>⚙ Reguli</RvBtn>
        </RGroup>
        <RGroup label="Examinare rezultate">
          <RvBtn on={() => setMergeDlg(true)} disabled={!mergeData} title={mergeData ? 'Examinare rezultate: cum arată documentul pentru fiecare destinatar (în fereastra Îmbinare)' : noData}>👁 Examinare rezultate</RvBtn>
        </RGroup>
        <RGroup label="Finalizare">
          <RvBtn on={() => setMergeDlg(true)} disabled={!mergeData} title={mergeData ? 'Terminare și îmbinare: un document cu toate exemplarele, câte un fișier pentru fiecare rând sau o listă' : noData}>✔ Terminare și îmbinare</RvBtn>
        </RGroup>
</>
            );
          })(),
          track: (
<>
        <button className={tracking ? 'active' : ''} onClick={toggleTracking} title="Urmărește modificările: ce scrii și ce ștergi se vede, apoi accepți sau respingi fiecare modificare">
          Urmărește modificările {tracking ? '✓' : ''}
        </button>
        {(tracking || page.trackLock) && (
          <button className={page.trackLock ? 'active' : ''} onClick={toggleLock} aria-pressed={!!page.trackLock} aria-label="Blochează urmărirea"
            title={page.trackLock ? 'Urmărirea e blocată: clic ca s-o deblochezi' : 'Blochează urmărirea: nimeni nu o mai poate opri și nu poate accepta / respinge modificări până la deblocare (se păstrează și în .docx)'}>
            {page.trackLock ? '🔒' : '🔓'}
          </button>
        )}
        {(tracking || changes.length > 0 || markup !== 'all') && (
          <select className="docs-markup" value={markup} onChange={(e) => setMarkup(e.target.value as typeof markup)} aria-label="Afișarea modificărilor"
            title="Cum se văd modificările urmărite: tot marcajul (verde = scris, roșu tăiat = șters), marcaj simplu (textul final, cu o bară roșie pe margine la rândurile schimbate), fără marcaj (textul final) sau originalul (textul de dinainte). Documentul nu se schimbă.">
            <option value="all">Tot marcajul</option>
            <option value="simple">Marcaj simplu</option>
            <option value="none">Fără marcaj</option>
            <option value="orig">Originalul</option>
          </select>
        )}
        {markup === 'all' && changes.length > 0 && (
          <span className="docs-mk-filter">
            <button className={mkOff.length ? 'active' : ''} onClick={() => setMkMenu(!mkMenu)} aria-expanded={mkMenu}
              title="Ce modificări se marchează: inserările, ștergerile și autorii bifați; cele debifate se văd ca text final">Arată ▾</button>
            {mkMenu && (
              <div className="docs-mk-menu" role="menu" onKeyDown={(e) => { if (e.key === 'Escape') setMkMenu(false); }}>
                {[['k:insertion', 'Inserările'], ['k:deletion', 'Ștergerile'], ['k:format', 'Formatarea'], ...[...new Set(changes.map((c) => c.author || ''))].map((a) => ['a:' + a, a ? `De la ${a}` : 'Fără autor'])].map(([k, label]) => (
                  <label key={k}>
                    <input type="checkbox" checked={!mkOff.includes(k)} onChange={(e) => setMkOff((o) => (e.target.checked ? o.filter((x) => x !== k) : [...o, k]))} /> {label}
                  </label>
                ))}
              </div>
            )}
          </span>
        )}
        {markup === 'all' && mkOff.length > 0 && (
          <style>{mkOff.map((k) => {
            const sel = (cls: string) => k.startsWith('a:') ? `.page .ProseMirror .${cls}[data-author="${CSS.escape(k.slice(2))}"]` : `.page .ProseMirror .${cls}`;
            if (k === 'k:insertion') return `${sel('doc-ins')} { color: inherit; text-decoration: none; }`;
            if (k === 'k:deletion') return `${sel('doc-del')} { display: none; }`;
            if (k === 'k:format') return `${sel('doc-fmt')} { border-bottom: 0; } .page .ProseMirror .doc-pchg { box-shadow: none; }`;
            return `${sel('doc-ins')} { color: inherit; text-decoration: none; } ${sel('doc-del')} { display: none; } ${sel('doc-fmt')} { border-bottom: 0; }`;
          }).join(' ')}</style>
        )}
</>
),
          // Revizuire › Comentarii și Modificări (ca în procesorul de text cunoscut): salt înainte / înapoi, ștergere, acceptare, respingere.
          cmts: (() => {
            const cur = (editor.getAttributes('comment').id as string | undefined) ?? null;
            const go = (dir: 1 | -1) => {
              const c = nearChange(comments as unknown as DocChange[], editor.state.selection.from, dir) as unknown as (typeof comments)[number] | null;
              if (c) { setShowComments(true); editor.chain().focus().setTextSelection({ from: c.from, to: c.to }).scrollIntoView().run(); }
            };
            return (
<>
        <RvBtn on={addComment} title="Comentariu nou la textul ales (Ctrl+Alt+M)">💬 Comentariu nou</RvBtn>
        <RMenu label="Ștergere" disabled={!comments.length} title="Șterge comentariul de la cursor sau toate comentariile din document" items={[
          ...(cur ? [{ label: 'Ștergere', title: 'Șterge comentariul de la cursor', run: () => { editor.chain().focus().removeComment(cur).run(); } }] : []),
          { label: 'Ștergere toate comentariile din document', run: () => { const ch = editor.chain().focus(); comments.forEach((c) => ch.removeComment(c.id)); ch.run(); } },
        ]} />
        <RvBtn on={() => go(-1)} disabled={!comments.length} title="Comentariul anterior">⮜ Anterior</RvBtn>
        <RvBtn on={() => go(1)} disabled={!comments.length} title="Comentariul următor">Următor ⮞</RvBtn>
        <RvBtn on={() => setShowComments(!showComments)} active={showComments} title="Afișează sau ascunde panoul cu comentarii și modificări, din dreapta paginii">🗨 Afișare comentarii</RvBtn>
</>
            );
          })(),
          chgs: (() => {
            const lock = !!page.trackLock;
            const at = () => { const { from, to } = editor.state.selection; return changes.find((c) => c.from <= from && to <= c.to) ?? changes.find((c) => c.from <= from && from <= c.to) ?? null; };
            const go = (dir: 1 | -1) => { const c = nearChange(changes, editor.state.selection.from, dir); if (c) editor.chain().focus().setTextSelection({ from: c.from, to: c.to }).scrollIntoView().run(); };
            const decide = (accept: boolean, next: boolean) => {
              const c = at() ?? nearChange(changes, editor.state.selection.from, 1);
              if (!c) return;
              const ch = editor.chain().focus();
              (accept ? ch.acceptChange(c.from, c.to, c.kind) : ch.rejectChange(c.from, c.to, c.kind)).run();
              if (next) { const left = listChanges(editor.state.doc); const n = left.find((x) => x.from >= c.from) ?? left[0]; if (n) editor.chain().setTextSelection({ from: n.from, to: n.to }).scrollIntoView().run(); }
            };
            const off = !changes.length || lock;
            const why = lock ? 'Urmărirea e blocată: modificările nu se pot accepta sau respinge până la deblocare' : '';
            return (
<>
        <RMenu label="Acceptare" disabled={off} title={why || 'Păstrează modificarea aleasă (sau pe toate)'} items={[
          { label: 'Acceptare și trecere la următoarea', run: () => decide(true, true) },
          { label: 'Acceptare această modificare', run: () => decide(true, false) },
          { label: 'Acceptare toate modificările', sep: true, run: () => { editor.chain().focus().acceptAllChanges().run(); } },
          ...(tracking ? [{ label: 'Acceptare toate modificările și oprire urmărire', run: () => { editor.chain().focus().acceptAllChanges().run(); toggleTracking(); } }] : []),
        ]} />
        <RMenu label="Respingere" disabled={off} title={why || 'Anulează modificarea aleasă (sau pe toate): textul revine cum era'} items={[
          { label: 'Respingere și trecere la următoarea', run: () => decide(false, true) },
          { label: 'Respingere această modificare', run: () => decide(false, false) },
          { label: 'Respingere toate modificările', sep: true, run: () => { editor.chain().focus().rejectAllChanges().run(); } },
          ...(tracking ? [{ label: 'Respingere toate modificările și oprire urmărire', run: () => { editor.chain().focus().rejectAllChanges().run(); toggleTracking(); } }] : []),
        ]} />
        <RvBtn on={() => go(-1)} disabled={!changes.length} title="Modificarea anterioară">⮜ Anterior</RvBtn>
        <RvBtn on={() => go(1)} disabled={!changes.length} title="Modificarea următoare">Următor ⮞</RvBtn>
</>
            );
          })(),
          words: (
<>
        <RvBtn on={() => setPropsDlg(true)} title={`Număr de cuvinte (Ctrl+Shift+G): ${words.toLocaleString('ro-RO')} cuvinte; fereastra arată și caracterele, paragrafele și paginile`}>🔢 Număr de cuvinte</RvBtn>
</>
),
          sum: (
<>
        <button onClick={() => setSumDlg(true)} title="Scrie o sumă de bani în litere (pentru contracte, chitanțe, facturi)">Sumă în litere</button>
</>
),
          spell: (
<>
        <button
          className={spell ? 'active' : ''}
          onClick={toggleSpell}
          title={spell
            ? 'Verificarea ortografică e pornită: cuvintele greșite sunt subliniate cu roșu. Click dreapta pe ele pentru sugestii. Apasă ca s-o oprești.'
            : 'Verificarea ortografică e oprită. Apasă ca s-o pornești.'}
        >
          Ortografie {spell ? '✓' : '✗'}
        </button>
        <select className="fmt" aria-label="Limba textului ales" value={(editor.getAttributes('textStyle').proofLang as string) ?? ''}
          onChange={(e) => editor.chain().focus().setProofLang(e.target.value || null).run()}
          title="Limba de verificare a textului ales: de exemplu un pasaj în engleză, sau „Nu verifica ortografia” pentru nume, coduri și adrese. Se păstrează în .docx.">
          <option value="">Limba: a documentului</option>
          {PROOF_LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button data-testid="docs-detect-lang" onClick={() => {
          const found = detectDocLangs(editor);
          const n = Object.values(found).reduce((x, y) => x + y, 0);
          setStatus(n ? `Limba pusă pe ${n} paragrafe scrise în altă limbă; verificarea în română le sare` : 'N-am găsit paragrafe scrise în altă limbă');
          editor.commands.focus();
        }} title="Detectează limba fiecărui paragraf (engleză, franceză, germană, italiană, spaniolă, maghiară) și o pune pe el, ca verificarea în română să nu sublinieze textele scrise în altă limbă; paragrafele cu limba aleasă de mână rămân cum sunt">🌐 Detectează limba</button>
</>
),
          grammar: (
<>
        <button className={showGrammar ? 'active' : ''} onClick={() => setShowGrammar(!showGrammar)} title="Verificare gramaticală în română: cuvinte repetate, spații și punctuație, literă mare la început de propoziție, scriere veche cu „î”, forme și exprimări greșite; fiecare cu forma corectă">✓ Gramatică</button>
</>
),
          thes: (
<>
        <button className={showThes ? 'active' : ''} onClick={() => setShowThes(!showThes)} title="Sinonime (Shift+F7): alte cuvinte cu același înțeles pentru cuvântul de la cursor; clic pe unul îl pune în locul lui">📚 Sinonime</button>
</>
),
          a11y: (
<>
        <button className={showA11y ? 'active' : ''} onClick={() => setShowA11y(!showA11y)} title="Verifică accesibilitatea: poze fără text alternativ, titluri sărite, tabele fără antet, text greu de citit">♿ Accesibilitate</button>
</>
),
          modes: (
<>
        <button onClick={() => setReadMode(true)} title="Mod citire: textul pe coloane cât ecranul, dai pagina cu săgețile ca într-o carte; nu se poate modifica (Esc iese)">📖 Citire</button>
        <button onClick={() => { stopSpeaking(); setSpeaking(false); setImmersive(true); }} title="Lectură: documentul doar de citit, pe o coloană îngustă, cu literă mare, spațiere largă, fundal sepia sau întunecat, paragraful curent evidențiat și citire cu voce tare (Esc iese)">👓 Lectură</button>
        <button onClick={toggleFocus} title="Mod concentrare: doar pagina, pe tot ecranul, fără bare și panouri, ca să scrii liniștit (Esc iese)">◎ Concentrare</button>
</>
),
          // Vizualizare (ca în procesorul de text cunoscut): Vizualizări, Imersiv, Zoom; aceleași comenzi ca în bara de jos.
          views: (() => {
            const ol = outlineLevel(editor.state) > 0;
            const print = !webLayout && !draft && !ol;
            const layout = layoutRef.current = (to: 'print' | 'web' | 'draft' | 'outline') => {
              if (ol && to !== 'outline') editor.chain().setOutlineLevel(0).run();
              if (to === 'print') { if (webLayout) toggleWeb(); if (draft) toggleDraft(); }
              else if (to === 'web') { if (!webLayout) toggleWeb(); }
              else if (to === 'draft') { if (!draft) toggleDraft(); }
              else { if (webLayout) toggleWeb(); if (draft) toggleDraft(); if (!ol) editor.chain().setOutlineLevel(3).run(); }
              editor.commands.focus();
            };
            return (
<>
        <RvBtn on={() => setReadMode(true)} title="Mod citire: textul pe coloane cât ecranul, dai pagina cu săgețile ca într-o carte; nu se poate modifica (Esc iese)">📖 Mod citire</RvBtn>
        <RvBtn on={() => layout('print')} active={print} title="Aspect imprimare: paginile cum ies la tipărire, cu margini, antet și subsol">📄 Aspect imprimare</RvBtn>
        <RvBtn on={() => layout('web')} active={webLayout} title="Aspect web: textul pe toată lățimea ferestrei, fără foaie și margini (la tipărire rămân paginile)">🌐 Aspect web</RvBtn>
        <RvBtn on={() => layout('outline')} active={ol} title="Schiță: doar titlurile documentului, pe niveluri, cu ▾ / ▸ ca să strângi sau să desfaci ce e sub ele (doar pe ecran)">☰ Schiță</RvBtn>
        <RvBtn on={() => layout('draft')} active={draft} title="Ciornă: doar textul, fără antet, subsol, filigran și coloane, cu sfârșiturile de pagină ca linii punctate (la tipărire rămân paginile)">📝 Ciornă</RvBtn>
</>
            );
          })(),
          immersive: (
<>
        <RvBtn on={toggleFocus} active={focusMode} title="Focus: doar pagina, pe tot ecranul, fără bare și panouri, ca să scrii liniștit (Esc iese)">◎ Focus</RvBtn>
        <RvBtn on={() => { stopSpeaking(); setSpeaking(false); setImmersive(true); }} title="Cititor imersiv: documentul doar de citit, pe o coloană îngustă, cu literă mare, spațiere largă, fundal sepia sau întunecat, paragraful curent evidențiat și citire cu voce tare (Esc iese)">👓 Cititor imersiv</RvBtn>
</>
),
          macrosGrp: (
<>
        <RvBtn on={() => { if (recName) stopRec(); else setMacroDlg('list'); }} active={!!recName}
          title={recName ? `Se înregistrează „${recName}” (${recRef.current?.steps.length === 1 ? 'un pas' : `${recRef.current?.steps.length ?? 0} pași`}): apasă ca să oprești și să păstrezi macrocomanda` : 'Macrocomenzi: pașii înregistrați (text, ștergeri, formatare), repetați cu un clic de la cursor'}>
          {recName ? '⏹ Oprește înregistrarea' : `▶ Macrocomenzi${docMacros.length + myMacros.length ? ` (${docMacros.length + myMacros.length})` : ''}`}</RvBtn>
        {!recName && <RvBtn on={() => setMacroDlg('rec')} title="Înregistrează macrocomandă: tot ce scrii și formatezi în document se ține minte, ca să-l repeți apoi cu un clic">⏺ Înregistrează</RvBtn>}
</>
),
          windowGrp: (
<>
        <RvBtn on={() => setSplit((v) => !v)} active={split} title={split ? 'Eliminare scindare: documentul din nou într-o singură parte (Ctrl+Alt+S)' : 'Scindare (Ctrl+Alt+S): documentul în două părți ale ferestrei, fiecare derulată separat, ca să vezi un loc în timp ce scrii în altul (dublu clic jos = scrii acolo)'}>{split ? '▭ Eliminare scindare' : '⊟ Scindare'}</RvBtn>
        {canArrange() && <RMenu label="🗗 Aranjează toate" title={ARRANGE_TITLE} items={arrangeItems()} />}
</>
),
          zoomGrp: (
<>
        <RMenu label="Zoom" title={`Mărimea paginii pe ecran (acum ${Math.round(zoom)}%; Ctrl + rotița mouse-ului); tipărirea nu se schimbă`}
          items={[50, 75, 100, 125, 150, 200].map((v) => ({ label: `${v}%`, checked: Math.round(zoom) === v, run: () => setZoom(v) }))} />
        <RvBtn on={() => setZoom(100)} active={Math.round(zoom) === 100} title="Pagina la mărimea ei adevărată (100%)">🔍 100%</RvBtn>
        <RvBtn on={fitPage} title="O pagină: toată pagina încape în fereastră">▯ O pagină</RvBtn>
        <RvBtn on={() => void multiPages()} title="Mai multe pagini: toate paginile, mici, una lângă alta, cum ies la tipărire; clic pe una ca să mergi la ea">▦ Mai multe pagini</RvBtn>
        <RvBtn on={fitWidth} title="Lățime pagină: pagina cât lățimea ferestrei">↔ Lățime pagină</RvBtn>
</>
),
          ruler: (
<>
        <button className={ruler ? 'active' : ''} onClick={toggleRuler} title="Riglă deasupra paginii: marginile, retragerile paragrafului (trase cu mouse-ul) și opririle de tabulator (clic pe riglă pune una nouă)">📏 Riglă</button>
</>
),
          inspect: (
<>
        <button onClick={() => setInspectDlg(true)} title="Inspectează documentul înainte să-l trimiți: comentarii, modificări urmărite, autorul, antet / subsol, datele ascunse din poze (de ex. locul GPS)">🕵 Inspectează</button>
</>
),
          compat: (
<>
        <button onClick={() => setCompatDlg(true)} title="Verifică compatibilitatea: ce se schimbă sau se pierde când salvezi documentul ca .docx, .odt sau .txt">⚖ Compatibilitate</button>
</>
),
          dia: (
<>
        <button onClick={() => { if (!editor.isEditable) return; const b = diaBlocks(editor); if (!b.items.length) { setStatus('Nu e text fără diacritice aici.'); return; } setDiaDlg(b); }} disabled={!editor.isEditable} title="Diacritice automate: „sedinta de sambata” → „ședința de sâmbătă”, în selecție sau în tot documentul; cuvintele cu mai multe forme corecte se arată pentru alegere">Diacritice</button>
</>
),
          autocorrect: (
<>
        <button onClick={() => setAcDlg(true)} title="AutoCorect: ghilimele „”, simboluri, ș/ț corecte, majuscula de la început de propoziție și înlocuirile din timpul scrisului">AutoCorect…</button>
</>
),
          compare: (
<>
        <button onClick={compareWord} title="Compară documentul de acum cu un document .docx (de exemplu contractul primit înapoi): ce e doar în fișier (roșu) și ce e doar aici (verde)">Compară cu un .docx…</button>
        <button data-testid="docs-combine-many" onClick={() => void combineMany()} title="Alege mai multe .docx corectate de oameni diferiți: modificările tuturor se pun peste documentul de acum, într-un tab nou, fiecare pe numele celui care a lucrat la fișier, de acceptat sau respins una câte una">🔀 Combină mai multe .docx…</button>
</>
),
          filename: (
<>
        <span className="toolbar-file">{path ? fileName(path) : 'Document nou'}{dirty ? ' •' : ''}</span>
</>
),
        }}
      />
      {page.restrict && (
        <div className="doc-final-bar doc-restrict-bar" role="status">
          <b>🔐 Document protejat: {page.restrict.mode === 'read' ? 'doar citire.' : 'doar comentarii.'}</b>
          {page.restrict.mode === 'comments' ? ' Alege un text și apasă „💬 Comentează”; textul nu se poate schimba.' : ' Textul nu se poate schimba.'}
          {page.restrict.mode === 'comments' && <button onClick={addComment}>💬 Comentează</button>}
          <button onClick={() => (page.restrict?.pw ? setUnrestrictDlg(true) : stopRestrict())}>Oprește protecția{page.restrict.pw ? '…' : ''}</button>
        </div>
      )}
      {page.final && (
        <div className="doc-final-bar" role="status">
          <b>Marcat ca final.</b> Autorul a marcat documentul ca terminat, ca să nu fie modificat din greșeală.
          <button onClick={editAnyway}>Editează oricum</button>
        </div>
      )}
      {search && <SearchBar editor={editor} mode={search} setMode={setSearch} />}
      {goTo && <GoToBar editor={editor} onClose={() => setGoTo(false)} />}
      {drawTable && <DrawTable editor={editor} onClose={closeDrawTable} />}
      <div className="doc-body">
        {showNav && <NavPane editor={editor} onClose={() => setShowNav(false)} />}
        {showStyles && editor && <StylesPane editor={editor} styles={page.styles} onStyles={setDocStyles} onClose={() => setShowStyles(false)} />}
        {showThes && editor && <ThesaurusPane editor={editor} readOnly={locked || !editor.isEditable} onClose={() => setShowThes(false)} />}
        {showGrammar && editor && <GrammarPane editor={editor} readOnly={locked || !editor.isEditable} onClose={() => setShowGrammar(false)} />}
        {showA11y && <A11yPane editor={editor} pageColor={pageBackground(page)} onClose={() => setShowA11y(false)} />}
        <div className="page-area" ref={areaRef} style={splitOn ? { alignSelf: 'flex-start', height: `${splitRatio * 100}%` } : undefined}>
          {ruler && !webLayout && !draft && !focusMode && editor && <Ruler editor={editor} areaRef={areaRef} />}
          {/* Mărimea și marginile paginii la PDF și tipărire (Chromium folosește @page). */}
          <style>{`@page { size: ${paperSize(page).w}mm ${paperSize(page).h}mm; margin: ${marginCss(page)}; }`
            // Secțiunile cu orientarea lor (Aspect → Orientare → Doar secțiunea aceasta) au pagina lor cu nume.
            + (['landscape', 'portrait'] as const).map((o) => { const s = paperSize({ ...page, landscape: o === 'landscape' } as PageSetup); return `@page doc-sect-${o} { size: ${s.w}mm ${s.h}mm; margin: ${marginCss(page)}; } @media print { .page .ProseMirror .doc-sect-${o} { page: doc-sect-${o}; } }`; }).join('')
            // Și cele cu marginile lor (Aspect → Margini → Doar secțiunea aceasta), în picioare, culcate sau ca documentul.
            + (['landscape', 'portrait', 'same'] as const).flatMap((o) => MARGINS.map((mm) => { const s = paperSize(o === 'same' ? page : { ...page, landscape: o === 'landscape' } as PageSetup), n = `doc-sect-${o}-m${mm}`; return `@page ${n} { size: ${s.w}mm ${s.h}mm; margin: ${mm}mm; } @media print { .page .ProseMirror .${n} { page: ${n}; } }`; })).join('')
            + (pageColumns(page) > 1 ? `.page .ProseMirror { column-count: ${pageColumns(page)}; column-gap: 1.25cm;${pageColLine(page) ? ' column-rule: 1px solid #808080;' : ''} }` : '')
            + '@media print { .page { zoom: 1 !important; } }'}</style>
          <div className={hfEdit ? 'page hf-editing' : 'page'} onDoubleClick={onPageDbl} data-border={pageBorder(page) || undefined} style={zoom === 100 ? pageStyle(page) : { ...pageStyle(page), width: pageWidth(page), maxWidth: 'none', zoom: zoom / 100 }}>
            {pageWatermarkImage(page) && <div className="doc-watermark-img" aria-hidden="true"><img src={pageWatermarkImage(page)} alt="" draggable={false} /></div>}
            {pageWatermark(page) && !pageWatermarkImage(page) && (
              <div className={page?.watermarkFlat ? 'doc-watermark flat' : 'doc-watermark'} aria-hidden="true"
                style={{ ...(pageWatermarkColor(page) ? { color: `color-mix(in srgb, ${pageWatermarkColor(page)} 24%, transparent)` } : {}), ...(pageWatermarkFont(page) ? { fontFamily: `"${pageWatermarkFont(page)}", sans-serif` } : {}) }}>{pageWatermark(page)}</div>
            )}
            {/* Sus e prima pagină: cu „Prima pagină diferită” se vede antetul ei. */}
            {hfEdit === 'header' && <HfEditBox kind="header" first={hfFirst} value={hfRaw} inputRef={hfInput} onChange={setHfRaw} onClose={closeHf} />}
            {hfEdit !== 'header' && (() => {
              const f = pageFirst(hfPage), text = f ? f.header : hfPage.header, on = f ? f.numbers : page.numbers;
              const slots = hfSlots(text, true, on, pageNumAt(page));
              return (slots.some((s) => s.text || s.num) || !!pageHeaderImage(page)) && <div className="doc-hf doc-hf-top doc-hf-3" title={(f ? 'Antetul primei pagini' : 'Antetul paginilor') + ': dublu clic ca să-l modifici'} onDoubleClick={(e) => { e.stopPropagation(); if (!locked) setHfEdit('header'); }}>{pageHeaderImage(page) && <img className="doc-hf-logo" src={pageHeaderImage(page)} alt="" draggable={false} />}{slots.map((s, i) => <span key={i}>{s.text}{s.text && s.num ? ' · ' : ''}{s.num ? numText(page, 1) : ''}</span>)}</div>;
            })()}
            <EditorContent editor={editor} />
            {editor && !webLayout && !draft && pageColumns(page) <= 1 && outlineLevel(editor.state) === 0 && (
              <PageMarks editor={editor} pageH={(paperSize(page).h - pageMargins(page).top - pageMargins(page).bottom) * 3.78} />
            )}
            {editor && lineNums(page) && !webLayout && !draft && (
              <LineNumbers editor={editor} setup={lineNums(page)!} columns={pageColumns(page)} pageH={(paperSize(page).h - pageMargins(page).top - pageMargins(page).bottom) * 3.78} />
            )}
            <FootnotesList editor={editor} />
            <FootnotesList editor={editor} end />
            {hfEdit === 'footer' && <HfEditBox kind="footer" first={false} value={hfRaw} inputRef={hfInput} onChange={setHfRaw} onClose={closeHf} />}
            {hfEdit !== 'footer' && (() => {
              // Jos e ultima pagină: cu antet pe secțiuni, subsolul ultimei secțiuni.
              const breaks: { hdr: unknown; ftr: unknown }[] = [];
              editor?.state.doc.forEach((n) => { if (n.type.name === 'sectionBreak') breaks.push({ hdr: n.attrs.hdr, ftr: n.attrs.ftr }); });
              const last = sectionHfList(breaks, page.header, page.footer).at(-1);
              const slots = hfSlots(last ? withHfFields({ ...page, header: '', footer: last.footer }, path ? fileName(path) : '').footer : hfPage.footer, false, page.numbers, pageNumAt(page));
              return slots.some((s) => s.text || s.num) && (
                <div className="doc-hf doc-hf-bottom doc-hf-3" title="Subsolul paginilor: dublu clic ca să-l modifici" onDoubleClick={(e) => { e.stopPropagation(); if (!locked) setHfEdit('footer'); }}>
                  {slots.map((s, i) => <span key={i}>{s.text}{s.text && s.num ? ' · ' : ''}{s.num ? numText(page, 1) : ''}</span>)}
                </div>
              );
            })()}
          </div>
        </div>
        {splitOn && editor && <SplitPane editor={editor} areaRef={areaRef} ratio={splitRatio} setRatio={setSplitRatio} onClose={() => setSplit(false)} />}
        {showComments && (comments.length > 0 || changes.length > 0) && (
          <CommentsPanel
            editor={editor}
            comments={comments}
            changes={changes}
            activeId={(editor.getAttributes('comment').id as string | undefined) ?? null}
            focusId={focusCmt}
            onFocused={clearFocusCmt}
            author={author}
            setAuthor={setAuthor}
            locked={!!page.trackLock}
            onClose={() => setShowComments(false)}
          />
        )}
      </div>
      {cmpFile && (
        <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setCmpFile(null); }}>
          <div className="print-dlg list-dlg versions-dlg" role="dialog" aria-label="Comparare" onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setCmpFile(null); } }}>
            <Compare title={`Diferențe față de „${cmpFile.name}”`} diff={cmpFile.diff} other={cmpFile.name} backLabel="Închide" onBack={() => setCmpFile(null)}
              actions={cmpFile.diff && cmpFile.diff.some((d) => d.kind !== 'same') ? <><button className="cmp-marked" onClick={() => void openMarked()} title="Un document nou, în tab nou: ce e doar în fișier apare tăiat (șters), ce e doar aici apare subliniat (inserat), ca modificări de acceptat sau respins una câte una">📝 Document marcat</button>
                <button className="cmp-combined" onClick={() => void openCombined()} title="Un document nou, în tab nou: documentul de acum cu modificările din fișier puse peste el, pe numele celui care le-a făcut, de acceptat sau respins una câte una">🔀 Combină</button></> : undefined} />
          </div>
        </div>
      )}
      {preview && <PrintPreview data={preview} startMany={previewMany} onPick={previewMany ? goToPage : undefined} onClose={() => setPreview(null)} onPrint={() => { const d = preview; setPreview(null); window.setTimeout(() => void print(d), 50); }} onPdf={() => { setPreview(null); window.setTimeout(() => void exportPdf(), 50); }} />}
      {draftDlg && <DraftsDialog kind="doc" exclude={openDraftIds()} onOpen={openDraft} onClose={() => setDraftDlg(false)} />}
      {verDlg && (
        <VersionsDialog
          path={path}
          current={() => serializeDoc(editor.getJSON(), page)}
          onRestore={(content, label) => {
            try {
              const old = parseDoc(content);
              setVerDlg(false);
              // Intră în istoricul de anulare al editorului, deci Ctrl+Z aduce înapoi textul de acum.
              editor.chain().focus().setContent(old.content, true).run();
              setDirty(true);
              setStatus(`Ai deschis versiunea din ${label}. Salvează ca s-o păstrezi (Ctrl+Z te întoarce)`);
            } catch (e) { alert((e as Error).message); }
          }}
          onClose={() => { setVerDlg(false); editor.commands.focus(); }}
        />
      )}
      {tplDlg && (
        <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setTplDlg(false); }}>
          <div className="print-dlg tpl-dlg" role="dialog" aria-label="Șabloane" onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setTplDlg(false); } }}>
            <h3>Șabloane</h3>
            <p className="print-info">Documente gata așezate. Scrie peste textele dintre [ ]; tasta F2 te duce la următorul. Sunt modele orientative: citește-le înainte de semnare.</p>
            <div className="tpl-grid">
              {DOC_TEMPLATES.map((t, i) => (
                <button key={t.id} className="tpl-card" onClick={() => fromTemplate(t)} autoFocus={i === 0}>
                  <b>{t.name}</b>
                  <span>{t.desc}</span>
                </button>
              ))}
            </div>
            <div className="print-actions">
              <button onClick={() => setTplDlg(false)}>Închide</button>
            </div>
          </div>
        </div>
      )}
      {envDlg && (
        <EnvelopeDialog
          initial={editor.state.selection.empty ? '' : editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, String.fromCharCode(10))}
          onClose={() => { setEnvDlg(false); editor.commands.focus(); }}
          onCreate={async (content) => {
            setEnvDlg(false);
            if (openInTab) openInTab('doc', { path: '', content });
            else if (await confirmDiscard()) load({ path: '', content });
          }}
        />
      )}
      {labelsDlg && (
        <LabelsDialog
          initial={editor.state.selection.empty ? '' : editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, String.fromCharCode(10))}
          onClose={() => { setLabelsDlg(false); editor.commands.focus(); }}
          onCreate={async (content) => {
            setLabelsDlg(false);
            // Etichetele se deschid într-un tab nou; documentul de acum rămâne cum era.
            if (openInTab) openInTab('doc', { path: '', content });
            else if (await confirmDiscard()) load({ path: '', content });
          }}
        />
      )}
      {mergeDlg && (
        <MergeDialog
          editor={editor}
          data={mergeData}
          setData={setMergeData}
          onClose={() => { setMergeDlg(false); editor.commands.focus(); }}
          onPrint={async (doc, rows) => {
            // Ca la „Termină și îmbină → Tipărește”: exemplarele se pun în document doar cât se tipăresc, apoi revine modelul.
            const count = rows.length, wasDirty = dirty, sel = editor.state.selection.from;
            setMergeDlg(false);
            // Fără pas în Ctrl+Z: nici exemplarele, nici întoarcerea la model.
            const noUndo = ({ tr }: { tr: import('@tiptap/pm/state').Transaction }) => { tr.setMeta('addToHistory', false); return true; };
            editor.chain().command(noUndo).setContent(mergeAll(doc, mergeData!, rows), false).run();
            try { await print(); } finally {
              editor.chain().command(noUndo).setContent(doc, false).setTextSelection(Math.min(sel, editor.state.doc.content.size)).run();
              setDirty(wasDirty);
            }
            setStatus(`Am trimis la tipărire ${count} ${count === 1 ? 'exemplar' : 'exemplare'}. Documentul a rămas modelul cu câmpuri`);
          }}
          pdfOf={api.docPdfBytes ? async (filled) => {
            // Exemplarul pus în editor doar cât se face PDF-ul (cu aspectul paginii documentului), apoi revine modelul; fără pas în Ctrl+Z.
            const wasDirty = dirty, sel = editor.state.selection.from, model = editor.getJSON();
            const noUndo = ({ tr }: { tr: import('@tiptap/pm/state').Transaction }) => { tr.setMeta('addToHistory', false); return true; };
            editor.chain().command(noUndo).setContent(filled, false).run();
            try { return await api.docPdfBytes!(pdfPage()); } finally {
              editor.chain().command(noUndo).setContent(model, false).setTextSelection(Math.min(sel, editor.state.doc.content.size)).run();
              setDirty(wasDirty);
            }
          } : undefined}
          onCombined={(doc, rows, list) => {
            const count = rows.length;
            setMergeDlg(false);
            // Rezultatul e un document nou, nesalvat: modelul cu câmpuri rămâne neatins în fișierul lui (Ctrl+Z îl aduce înapoi).
            editor.chain().focus().setContent(mergeAll(doc, mergeData!, rows, list), true).setTextSelection(0).run();
            setPath(null);
            setFromFile(null);
            setDirty(true);
            setStatus(`Am făcut ${count} ${count === 1 ? 'exemplar' : 'exemplare'}, ${list ? 'unul sub altul (listă)' : 'fiecare de la pagină nouă'}. Salvează, tipărește sau fă PDF (Ctrl+Z te întoarce la model)`);
          }}
        />
      )}
      {pageDlg && (
        <PageDialog
          value={page}
          focus={typeof pageDlg === 'string' ? pageDlg : undefined}
          onSave={(p) => { setPage(p); setPageDlg(false); setDirty(true); setStatus(path ? 'Se salvează…' : 'Nesalvat'); editor.commands.focus(); }}
          onClose={() => { setPageDlg(false); editor.commands.focus(); }}
        />
      )}
      {inspectDlg && (
        <InspectDialog
          editor={editor}
          page={page}
          onPage={(p) => { setPage(p); setDirty(true); setStatus(path ? 'Se salvează…' : 'Nesalvat'); }}
          onClose={() => { setInspectDlg(false); editor.commands.focus(); }}
        />
      )}
      {compatDlg && <CompatDialog editor={editor} page={page} onClose={() => { setCompatDlg(false); editor.commands.focus(); }} />}
      {signDlg && <OfficeSignDialog name={`${baseName()}.docx`} onSign={signDocx} onClose={() => setSignDlg(false)} />}
      {restrictDlg && <RestrictDialog onApply={applyRestrict} onClose={() => { setRestrictDlg(false); editor?.commands.focus(); }} />}
      {macroDlg === 'rec' && <DocMacroRecordDialog list={[...docMacros, ...myMacros]} onStart={startRec} onClose={() => { setMacroDlg(null); editor?.commands.focus(); }} />}
      {macroDlg === 'list' && <DocMacroListDialog list={docMacros} mine={myMacros} onRun={playMacro}
        onButton={(m) => { setMacroDlg(null); if (editor && !locked) { insertMacroBtn(editor, m.name, m.name); setStatus(`Buton pus: dublu clic pe „${m.name}” rulează macrocomanda de după el (în .docx e câmpul MACROBUTTON).`); } }}
        onChange={(l, mine) => { if (JSON.stringify(l) !== JSON.stringify(docMacros)) setMacros(l); if (JSON.stringify(mine) !== JSON.stringify(myMacros)) saveMine(mine); }} onClose={() => { setMacroDlg(null); editor?.commands.focus(); }} />}
      {unrestrictDlg && page.restrict?.pw && <UnrestrictDialog pw={page.restrict.pw} onDone={stopRestrict} onClose={() => setUnrestrictDlg(false)} />}
      {propsDlg && (
        <PropsDialog
          value={docProps(page) ?? {}}
          final={!!page.final}
          mark0={labelMarkOf(page)}
          stats={docStats(editor.state.doc.textBetween(0, editor.state.doc.content.size, ' ', ' '))}
          onSave={(props, final, mark) => { setPage(markLabel({ ...page, props, final: final || undefined }, props.label, mark)); setPropsDlg(false); setDirty(true); setStatus(path ? 'Se salvează…' : 'Nesalvat'); editor.commands.focus(); }}
          onClose={() => { setPropsDlg(false); editor.commands.focus(); }}
        />
      )}
      {linkDlg && (
        <LinkDialog
          initial={(editor.getAttributes('link').href as string | undefined) ?? ''}
          bookmarks={listBookmarks(editor.state.doc).map((b) => b.name).filter((n) => !isHiddenBookmark(n))}
          onSave={(href) => { setLinkDlg(false); if (href) editor.chain().focus().setDocLink(href).run(); else editor.chain().focus().unsetDocLink().run(); }}
          onClose={() => { setLinkDlg(false); editor.commands.focus(); }}
        />
      )}
      {diaDlg && <DiacriticsDialog items={diaDlg.items} where={diaDlg.from > 0 || diaDlg.to < editor.state.doc.content.size ? 'selecție' : 'document'}
        onApply={(res) => { const n = applyDia(editor, diaDlg, res); setDiaDlg(null); setStatus(n ? `Diacritice puse în ${n} cuvinte (Ctrl+Z le scoate)` : 'Nicio schimbare'); editor.commands.focus(); }}
        onClose={() => { setDiaDlg(null); editor.commands.focus(); }} />}
      {optDlg && (
        <OptionsDialog author={author} setAuthor={setAuthor} spell={spell} onSpell={toggleSpell} autoSave={autoSave} onAutoSave={pickAutoSave} autoLang={autoLang} onAutoLang={pickAutoLang}
          ruler={ruler} onRuler={toggleRuler} nav={showNav} onNav={setShowNav} styles={showStyles} onStyles={setShowStyles}
          comments={showComments} onComments={setShowComments} marks={marksShown(editor.state)} onMarks={() => editor.commands.toggleFormattingMarks()}
          onAutoCorrect={() => { setOptDlg(false); setAcDlg(true); }} onClose={() => { setOptDlg(false); editor.commands.focus(); }} />
      )}
      {acDlg && <AutoCorrectDialog onClose={() => { setAcDlg(false); editor.commands.focus(); }} />}
      {sumDlg && (
        <SumDialog
          onInsert={(t) => { setSumDlg(false); editor.chain().focus().insertContent(t).run(); }}
          onClose={() => { setSumDlg(false); editor.commands.focus(); }}
        />
      )}
      <div className="statusbar">
        <button className="status-link" onClick={() => setGoTo(true)} title="Pagina pe care e cursorul și câte pagini are documentul la tipărire (aproximativ). Click: Mergi la (Ctrl+G)">
          Pagina {pageInfo.page} din {pageInfo.pages}
        </button>
        <span>{words} {words === 1 ? 'cuvânt' : 'cuvinte'} · {text.length} caractere</span>
        <LabelBadge value={docProps(page)?.label} onClick={() => setPropsDlg(true)} />
        {(comments.length > 0 || changes.length > 0) && !showComments && (
          <button className="status-link" onClick={() => setShowComments(true)} title="Arată panoul cu comentarii și modificări">
            {changes.length > 0 && `✎ ${changes.length} ${changes.length === 1 ? 'modificare' : 'modificări'} `}
            {comments.length > 0 && `💬 ${comments.length} ${comments.length === 1 ? 'comentariu' : 'comentarii'}`}
          </button>
        )}
        {placeholders > 0 && (
          <button className="status-link" onClick={gotoPlaceholder} title="Alege următorul text de completat dintre [ ] (F2)">
            {placeholders} {placeholders === 1 ? 'câmp' : 'câmpuri'} [ ] de completat · F2
          </button>
        )}
        <span>{status === 'Se salvează…' && !autoSave ? 'Nesalvat (Ctrl+S salvează)' : status}</span>
        <button className={`status-link${outlineLevel(editor.state) ? ' active' : ''}`} onClick={() => editor.chain().focus().setOutlineLevel(outlineLevel(editor.state) ? 0 : 3).run()} aria-pressed={outlineLevel(editor.state) > 0}
          title="Schiță: doar titlurile documentului, pe niveluri, cu ▾ / ▸ ca să strângi sau să desfaci ce e sub ele (doar pe ecran)">☰ Schiță</button>
        <button className={`status-link${webLayout ? ' active' : ''}`} onClick={toggleWeb} aria-pressed={webLayout}
          title="Aspect web: textul pe toată lățimea ferestrei, fără foaie și margini (la tipărire rămân paginile). Click din nou: aspect pagină">🌐 Web</button>
        <button className={`status-link${draft ? ' active' : ''}`} onClick={toggleDraft} aria-pressed={draft}
          title="Ciornă: doar textul, pe toată lățimea, fără antet, subsol, filigran și coloane, cu sfârșiturile de pagină ca linii punctate (bun la scris repede; la tipărire rămân paginile). Click din nou: aspect pagină">📝 Ciornă</button>
        <ZoomControl zoom={zoom} setZoom={setZoom} what="pagina" onFit={fitWidth} onFitPage={fitPage} />
      </div>
    </div>
  );
}

// `columns`: câte coloane are pagina (butonul „Coloană” apare doar la textul pe 2–3 coloane).
function FormatBar({ onDrawTable, editor, locked, recent, onSave, top, onComment, onLink, columns, pageH, props, file, onStatus, styles, onStyles, onStylesPane, hfTab }: { onDrawTable?(): void; hfTab?: React.ReactNode; editor: Editor; locked: boolean; recent?: { kind: 'doc'; open(p: string): void }; onSave(): void; top: Record<string, React.ReactNode>; onComment(): void; onLink(): void; columns: number; pageH: number; props?: DocProps; file?: string; onStatus?(s: string): void; styles?: DocStyles; onStyles(s: DocStyles | undefined): void; onStylesPane(): void }) {
  const [tablePropsDlg, setTablePropsDlg] = useState(false);
  // Inserare → ▦ Foaie de calcul…: fișierul citit și foaia aleasă (fereastra apare doar când are mai multe foi).
  const [sheetPick, setSheetPick] = useState<(SheetFile & { i: number }) | null>(null);
  // Inserare → ☺ Pictograme: cele alese intră la cursor ca poze.
  const [iconsDlg, setIconsDlg] = useState(false);
  const [model3dDlg, setModel3dDlg] = useState(false);
  const insertSheetFile = async () => {
    try {
      const f = await pickSheetFile();
      if (!f) return;
      if (f.list.length === 1) onStatus?.(insertSheet(editor, f, 0));
      else setSheetPick({ ...f, i: f.active });
    } catch (e) { onStatus?.(`Foaia de calcul nu a putut fi citită: ${e instanceof Error ? e.message : String(e)}`); }
  };
  const chain = () => editor.chain().focus();
  // Stiloul pentru bordurile celulelor (felul și culoarea liniei), ultimul fel de bordură ales și pensula pentru borduri.
  const [pen, setPen] = useState<Pen>({ style: 'single', color: '#000000' });
  const [lastKind, setLastKind] = useState<BorderKind>('bottom');
  const [painter, setPainter] = useState(false);
  useEffect(() => {
    if (!painter) return;
    const dom = editor.view.dom as HTMLElement;
    dom.classList.add('border-painting');
    // Clic lângă o margine de celulă: doar latura aceea; clic în mijloc: toate cele patru laturi.
    const down = (e: MouseEvent) => {
      const td = (e.target as HTMLElement).closest?.('td, th') as HTMLElement | null;
      if (!td || !dom.contains(td)) return;
      e.preventDefault();
      e.stopPropagation();
      paintCell(editor.view, td, sideAt(td.getBoundingClientRect(), e.clientX, e.clientY), pen);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setPainter(false); };
    dom.addEventListener('mousedown', down, true);
    window.addEventListener('keydown', esc);
    return () => { dom.classList.remove('border-painting'); dom.removeEventListener('mousedown', down, true); window.removeEventListener('keydown', esc); };
  }, [painter, pen, editor]);
  // Profilul de meniu (▦ Aranjare): panglica sau meniurile clasice.
  const arrange = useArrange('docs', 'doc');
  // Ultimele culori alese: clicul pe „A” / „ab” le pune din nou (ca butoanele cu ▾ din bara de format).
  const [lastColor, setLastColor] = useState('#c00000');
  const [lastHl, setLastHl] = useState('#ffff00');

  const Btn = ({ on, active, title, children, tip }: { on(): void; active?: boolean; title: string; children: React.ReactNode; tip?: string }) => (
    <button className={`fmt ${active ? 'active' : ''}`} data-keytip={tip} onMouseDown={(e) => e.preventDefault()} onClick={on} title={title}>{children}</button>
  );

  // Clic dreapta: comenzile locului (text, tabel, imagine), cu aceleași nume ca în panglică (INTERFATA.md).
  // Fereastra Font: Ctrl+D (din editor) sau ⇲ din colțul grupului Font.
  const [fontDlg, setFontDlg] = useState(false);
  useEffect(() => {
    const dom = editor.view.dom;
    const show = () => setFontDlg(true);
    dom.addEventListener('suite-font-dialog', show);
    return () => dom.removeEventListener('suite-font-dialog', show);
  }, [editor]);
  useContextMenu(editor.view.dom, (e) => {
    const dom = editor.view.dom;
    const rb = (title: string, tab?: string) => () => { ribbonClick(dom, title, tab); };
    if (locked || !editor.isEditable) return [{ label: '💬 Comentariu nou', run: onComment }];
    // Pe o imagine: întâi o alegem (ca la clic), apoi comenzile ei din fila Imagine.
    const img = (e.target as Element | null)?.closest('.doc-image');
    if (img) {
      const at = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
      const pos = at && at.inside >= 0 ? at.inside : null;
      if (pos !== null && editor.state.doc.nodeAt(pos)?.type.name === 'image') editor.view.dispatch(editor.state.tr.setSelection(PmNodeSelection.create(editor.state.doc, pos)));
      if (editor.isActive('image')) {
        const fl = ['front', 'behind'].includes(String(editor.getAttributes('image').align));
        return [
          { label: '✂ Decupează', run: rb('Decupează: tai marginile', 'image') },
          { label: 'Text alternativ…', run: rb('Text alternativ: descrierea pozei', 'image') },
          { label: 'Legendă', run: rb('Legendă sub imagine', 'image') },
          { sep: true, label: '' },
          { label: 'Încadrare', submenu: [
            { label: 'În rând cu textul', run: rb('Centrat', 'image') },
            { label: 'În stânga, cu textul în dreapta', run: rb('Imagine în stânga', 'image') },
            { label: 'În dreapta, cu textul în stânga', run: rb('Imagine în dreapta', 'image') },
            { label: 'În fața textului', run: rb('În fața textului', 'image') },
            { label: 'În spatele textului', run: rb('În spatele textului', 'image') },
          ] },
          { label: '⤒ Adu în față', run: fl ? rb('Adu în față', 'image') : undefined },
          { label: '⤓ Trimite în spate', run: fl ? rb('Trimite în spate', 'image') : undefined },
          { sep: true, label: '' },
          { label: '🗑 Șterge imaginea', run: rb('Șterge imaginea', 'image') },
        ];
      }
    }
    const at = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
    const cw = editor.state.selection.empty && at ? wordAtCursor(editor, at.pos) : wordAtCursor(editor);
    const syn = cw ? synonyms(cw.text).groups.flatMap((g) => g.words).filter((w, i, a) => a.indexOf(w) === i).slice(0, 8) : [];
    const items: CtxItem[] = [
      { label: 'Sinonime', submenu: [
        ...(syn.length ? syn.map((w) => ({ label: w, run: () => { if (cw) replaceWord(editor, cw, w); } })) : [{ label: 'Niciun sinonim' }]),
        { sep: true, label: '' },
        { label: '📚 Dicționar de sinonime…', run: () => { if (!dom.closest('.module-pane')?.querySelector('.doc-thes')) ribbonClick(dom, 'Sinonime (Shift+F7)'); } },
      ] },
      { label: '📋 Lipește doar textul', run: () => { void pastePlainText(editor); } },
      { sep: true, label: '' },
      { label: '🔗 Legătură…', run: onLink },
      { label: '💬 Comentariu nou', run: onComment },
      { sep: true, label: '' },
      { label: '⇕ Paragraf…', run: rb('Paragraf: spațiu înainte') },
      { label: 'Stil…', run: rb('Modifică stilul') },
    ];
    if (editor.isActive('table')) {
      const c = () => editor.chain().focus();
      items.push(
        { sep: true, label: '' },
        { label: 'Inserează', submenu: [
          { label: 'Rând deasupra', run: () => c().addRowBefore().run() },
          { label: 'Rând dedesubt', run: () => c().addRowAfter().run() },
          { label: 'Coloană la stânga', run: () => c().addColumnBefore().run() },
          { label: 'Coloană la dreapta', run: () => c().addColumnAfter().run() },
        ] },
        { label: '− Șterge rândul', run: () => c().deleteRow().run() },
        { label: '− Șterge coloana', run: () => c().deleteColumn().run() },
        { label: '⊞ Unește / desparte celulele', run: () => c().mergeOrSplit().run() },
        { label: 'Împarte celula', submenu: [
          { label: '◫ În 2 coloane', run: () => { splitCellInto('cols')(editor.state, editor.view.dispatch); editor.view.focus(); } },
          { label: '⊟ În 2 rânduri', run: () => { splitCellInto('rows')(editor.state, editor.view.dispatch); editor.view.focus(); } },
        ] },
        { label: 'Tabel → text', run: rb('Transformă tabelul în text') },
        { label: '✕ Șterge tabelul', run: () => c().deleteTable().run() },
      );
    }
    return items;
  });

  const T = top;
  const lockNote = <span className="muted ribbon-locked">Documentul e protejat: textul și formatarea nu se pot schimba.</span>;
  const home = locked ? lockNote : (
    <>
        <ClipboardGroup focus={() => editor.commands.focus()}
          pasteItems={[{ label: 'Lipire doar text', title: 'Lipește doar textul, fără formatul copiat (Ctrl+Alt+V)', run: () => { void pastePlainText(editor); } }]}
          painter={<button
            className={`fmt ${painterOf(editor).marks ? 'active' : ''}`}
            data-keytip="FP" data-txt="Format pensulă" aria-label="Format pensulă"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => (painterOf(editor).marks ? editor.commands.stopFormatPainter() : chain().pickFormat(false).run())}
            onDoubleClick={() => chain().pickFormat(true).run()}
            title="Format pensulă: ia formatul textului de la cursor, apoi alege cu mouse-ul textul care îl primește. Dublu click: rămâne pornită (Esc o oprește). Ctrl+Shift+C / Ctrl+Shift+V"
          >🖌</button>} />
        <RGroup label="Font" launcher={{ title: 'Font: toate opțiunile fontului (Ctrl+D)', run: () => setFontDlg(true) }}>
<div className="rb-rows">
<div className="rb-row">
      <select
        value={(editor.getAttributes('textStyle').fontFamily as string) ?? ''}
        onChange={(e) => (e.target.value ? chain().setFontFamily(e.target.value).run() : chain().unsetFontFamily().run())}
        title="Font"
        data-keytip="FF"
        className="font-select"
      >
        {FONTS.map(([label, value]) => <option key={label} value={value}>{label}</option>)}
      </select>
      <select
        value={(editor.getAttributes('textStyle').fontSize as string) ?? ''}
        onChange={(e) => (e.target.value ? chain().setFontSize(e.target.value).run() : chain().unsetFontSize().run())}
        title="Mărime"
        data-keytip="FS"
        className="size-select font-size"
      >
        <option value="">Mărime</option>
        {SIZES.map((s) => <option key={s} value={`${s}pt`}>{s}</option>)}
        {(() => {
          // O mărime care nu e în listă (de exemplu 13 după Ctrl+]) apare și ea, ca să se vadă ce e scris.
          const cur = editor.getAttributes('textStyle').fontSize as string | undefined;
          return cur && !SIZES.some((s) => `${s}pt` === cur) ? <option value={cur}>{cur.replace(/pt$/, '')}</option> : null;
        })()}
      </select>
      <Btn on={() => chain().growFontSize(1).run()} tip="FG" title="Mărește fontul (Ctrl+Shift+>; câte 1 punct: Ctrl+])">A<sup>+</sup></Btn>
      <Btn on={() => chain().growFontSize(-1).run()} tip="FK" title="Micșorează fontul (Ctrl+Shift+<; câte 1 punct: Ctrl+[)">A<sup>−</sup></Btn>
      <select
        value=""
        onChange={(e) => { const c = [...TEXT_CASES, ['toggle', '']].find(([k]) => k === e.target.value)?.[0] as TextCase | undefined; if (c) chain().changeCase(c).run(); }}
        title="Schimbă literele textului selectat sau ale cuvântului de la cursor (Shift+F3 le schimbă pe rând)"
        aria-label="Schimbă literele" data-keytip="7" style={{ width: 54 }}
      >
        <option value="">Aa▾</option>
        {TEXT_CASES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        <option value="toggle">iNVERSEAZĂ lITERELE</option>
      </select>
      <Btn on={() => chain().unsetAllMarks().clearNodes().run()} tip="E" title="Șterge formatarea">⌫</Btn>
</div>
<div className="rb-row">
      <Btn on={() => chain().toggleBold().run()} active={editor.isActive('bold')} tip="1" title="Aldin (Ctrl+B)"><b>B</b></Btn>
      <Btn on={() => chain().toggleItalic().run()} active={editor.isActive('italic')} tip="2" title="Cursiv (Ctrl+I)"><i>I</i></Btn>
      <Btn on={() => chain().toggleUnderline().run()} active={editor.isActive('underline')} tip="3" title="Subliniat (Ctrl+U)"><u>U</u></Btn>
      <select
        className="fmt-mini"
        value=""
        onChange={(e) => {
          const v = e.target.value; e.target.value = '';
          const cur = editor.getAttributes('underline') as { style?: UnderlineStyle | null; color?: string | null };
          if (v.startsWith('s:')) chain().setUnderlineStyle(v.slice(2) as UnderlineStyle, cur.color ?? null).run();
          else if (v.startsWith('c:')) chain().setUnderlineStyle(cur.style ?? 'single', v.slice(2) || null).run();
          else if (v === 'none') chain().unsetUnderline().run();
        }}
        title="Stilul și culoarea sublinierii (dublă, groasă, punctată, ondulată…)"
        aria-label="Stilul sublinierii"
      >
        <option value="">▾</option>
        <optgroup label="Stil">
          {UNDERLINE_STYLES.map(([k, label]) => <option key={k} value={'s:' + k}>{(editor.isActive('underline') && (editor.getAttributes('underline').style ?? 'single') === k ? '✓ ' : '') + label}</option>)}
        </optgroup>
        <optgroup label="Culoare">
          {UNDERLINE_COLORS.map(([k, label]) => <option key={k || 'auto'} value={'c:' + k}>{(editor.isActive('underline') && (editor.getAttributes('underline').color ?? '') === k ? '✓ ' : '') + label}</option>)}
        </optgroup>
        <option value="none">Fără subliniere</option>
      </select>
      <Btn on={() => chain().toggleStrike().run()} active={editor.isActive('strike')} tip="4" title="Tăiat"><s>S</s></Btn>
      <Btn on={() => chain().toggleSubscript().run()} active={editor.isActive('subscript')} tip="5" title="Indice, de exemplu H₂O (Ctrl+,)">x₂</Btn>
      <Btn on={() => chain().toggleSuperscript().run()} active={editor.isActive('superscript')} tip="6" title="Exponent, de exemplu m² (Ctrl+.)">x²</Btn>
      <select
        value={(editor.getAttributes('textStyle').textEffect as string) ?? ''}
        onChange={(e) => chain().setTextEffect((e.target.value || null) as TextEffect | null).run()}
        title="Efecte de text: contur (litere goale), umbră, relief sau gravat; se păstrează în .docx și .odt"
        aria-label="Efecte de text"
        className="size-select doc-narrow"
      >
        <option value="">Efect</option>
        {TEXT_EFFECTS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
      </select>
      <ColorMenu kind="highlight" keytip="I" styles={styles} current={editor.getAttributes('highlight').color as string | undefined} last={lastHl}
        onPick={(c) => { if (c) { setLastHl(c); chain().setHighlight({ color: c }).run(); } else chain().unsetHighlight().run(); }}>
        <span style={{ background: lastHl, padding: '0 3px', color: '#000' }}>ab</span>
      </ColorMenu>
      <ColorMenu kind="text" keytip="FC" styles={styles} current={editor.getAttributes('textStyle').color as string | undefined} last={lastColor}
        onPick={(c) => { if (c) { setLastColor(c); chain().setColor(c).run(); } else chain().unsetColor().run(); }}>
        <span style={{ borderBottom: `3px solid ${lastColor}` }}>A</span>
      </ColorMenu>
<RMore label="Mai multe despre font">
      <Btn on={() => chain().toggleSmallCaps().run()} active={editor.getAttributes('textStyle').fontVariant === 'small-caps'} title="Majuscule mici, ca la numele din acte (Ctrl+Shift+K). MAJUSCULE afișate: Ctrl+Shift+A"><span style={{ fontVariant: 'small-caps' }}>Aa</span></Btn>
      <select
        value={(editor.getAttributes('textStyle').letterSpacing as string) ?? ''}
        onChange={(e) => chain().setLetterSpacing(e.target.value || null).run()}
        title="Spațierea dintre litere: condensat (mai strâns) sau extins (mai rar)"
        className="size-select"
      >
        {LETTER_SPACINGS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        {(() => { const v = editor.getAttributes('textStyle').letterSpacing as string | undefined; return v && !LETTER_SPACINGS.some(([x]) => x === v) ? <option value={v}>{v}</option> : null; })()}
      </select>
</RMore>
</div>
</div>
        </RGroup>
        <RGroup label="Paragraf">
<div className="rb-rows">
<div className="rb-row">
      <Btn on={() => chain().toggleBulletList().run()} active={editor.isActive('bulletList')} tip="U" title="Listă cu buline">• ≡</Btn>
      <Btn on={() => chain().toggleOrderedList().run()} active={editor.isActive('orderedList')} tip="N" title="Listă numerotată">1. ≡</Btn>
      <ListStylePicker editor={editor} keytip="M" />
      <Btn on={() => chain().changeIndent(-1).run()} tip="AO" title="Micșorează retragerea paragrafului">⇤</Btn>
      <Btn on={() => chain().changeIndent(1).run()} tip="AI" title="Mărește retragerea paragrafului (1,25 cm)">⇥</Btn>
      <select
        value=""
        onChange={(e) => { if (e.target.value) chain().sortParagraphs(e.target.value === 'desc').run(); }}
        title="Sortează paragrafele selectate (sau elementele listei) în ordine alfabetică" style={{ width: 44 }} data-keytip="SO"
        aria-label="Sortează"
      >
        <option value="">⇅</option>
        <option value="asc">Sortează A → Z</option>
        <option value="desc">Sortează Z → A</option>
      </select>
      <Btn on={() => chain().toggleFormattingMarks().run()} active={marksShown(editor.state)} tip="8" title="Arată / ascunde semnele de formatare: ¶ la sfârșit de paragraf, · la spații, → la Tab (nu se tipăresc)">¶</Btn>
      {editor.isActive('orderedList') && <ListTools editor={editor} />}
</div>
<div className="rb-row">
      <Btn on={() => chain().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} tip="AL" title="Aliniere stânga">⯇</Btn>
      <Btn on={() => chain().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} tip="AC" title="Centrat">≡</Btn>
      <Btn on={() => chain().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} tip="AR" title="Aliniere dreapta">⯈</Btn>
      <Btn on={() => chain().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} tip="AJ" title="Stânga-dreapta">☰</Btn>
      <ParagraphSpacing editor={editor} keytip="K" />
      <select
        value={(editor.getAttributes('paragraph').lineHeight ?? editor.getAttributes('heading').lineHeight ?? '') as string}
        onChange={(e) => chain().setLineHeight(e.target.value || null).run()}
        title="Spațierea dintre rânduri"
        className="size-select doc-narrow"
      >
        <option value="">↕ Rânduri</option>
        {[...LINE_HEIGHTS, ...lineHeightExtra(editor)].map((v) => <option key={v} value={v}>{v.replace('.', ',')}</option>)}
      </select>
      <select
        value={(editor.getAttributes('paragraph').shade ?? editor.getAttributes('heading').shade ?? '') as string}
        aria-label="Fundal paragraf"
        data-keytip="H"
        onChange={(e) => {
          // „Altă culoare…”: alegătorul de culori al sistemului, cu culoarea de acum.
          if (e.target.value === '__more') { const i = e.currentTarget.parentElement?.querySelector<HTMLInputElement>('input.shade-more'); if (i) { i.value = (editor.getAttributes('paragraph').shade ?? editor.getAttributes('heading').shade ?? '#fef9c3') as string; i.click(); } return; }
          chain().setParagraphShade(e.target.value || null).run();
        }}
        title="Fundalul paragrafului (de exemplu galben pentru o notă importantă)"
        className="size-select doc-narrow"
      >
        {PARAGRAPH_SHADES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        {(() => { const v = (editor.getAttributes('paragraph').shade ?? editor.getAttributes('heading').shade) as string | undefined; return v && !PARAGRAPH_SHADES.some(([x]) => x === v) ? <option value={v}>{v}</option> : null; })()}
        <option value="__more">Altă culoare…</option>
      </select>
      <input type="color" className="shade-more" aria-label="Altă culoare de fundal" tabIndex={-1}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        onChange={(e) => chain().setParagraphShade(e.target.value).run()} />
<RMore label="Mai multe despre paragraf">
      <Btn on={() => chain().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Citat">❝</Btn>
      <Btn on={() => chain().toggleParagraphBox().run()} active={!!(editor.getAttributes('paragraph').box || editor.getAttributes('heading').box)} tip="B" title="Chenar în jurul paragrafului (paragrafele vecine cu chenar formează o singură casetă)">▢</Btn>
      {(() => {
        // Chenarul paragrafului: laturile, linia și culoarea (Borders and Shading).
        const a = editor.getAttributes('paragraph').box ? editor.getAttributes('paragraph') : editor.getAttributes('heading');
        const on = !!a.box;
        const l = parseBoxLook(a.boxLook);
        const set = (p: Partial<BoxLook>) => chain().setParagraphBorder({ ...l, ...p }).run();
        return (
          <>
            <select className="size-select" aria-label="Chenarul paragrafului" title="Chenarul paragrafului: complet, doar o linie sus sau jos, sus și jos, ori o bară în stânga (pentru citate și note)"
              value={on ? l.sides : ''} onChange={(e) => (e.target.value ? set({ sides: e.target.value as BoxSides }) : chain().setParagraphBorder(null).run())}>
              <option value="">Fără chenar</option>
              {BOX_SIDES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
            {on && (
              <>
                <select className="size-select" aria-label="Linia chenarului" title="Linia chenarului" value={l.line} onChange={(e) => set({ line: e.target.value as BoxLine })}>
                  {BOX_LINES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                </select>
                <input type="color" aria-label="Culoarea chenarului" title="Culoarea chenarului" value={l.color} onChange={(e) => set({ color: e.target.value })} />
              </>
            )}
          </>
        );
      })()}
</RMore>
</div>
</div>
        </RGroup>
        <RGroup label="Stiluri" launcher={{ title: 'Panoul Stiluri: toate stilurile, seturi de stiluri, stil nou (Ctrl+Shift+Alt+S)', run: onStylesPane }}>
      {/* Galeria cu previzualizare, ca în procesorul de text cunoscut; alături, în coloană: Modifică stilul și panoul Stiluri. */}
      <StyleGallery editor={editor} styles={styles} onPane={onStylesPane} />
      <div className="rb-rows">
      <StylePicker editor={editor} styles={styles} fonts={FONTS} onChange={onStyles} />
{T.stylesPane}
      </div>
        </RGroup>
        <RGroup label="Editare">
{T.search}
        </RGroup>
    </>
  );
  const insert = locked ? lockNote : (
    <>
        <RGroup label="Pagini">
          <div className="rb-rows rb-stack"><div className="rb-row">
      <CoverPicker editor={editor} title={props?.title} author={props?.author} />
      </div><div className="rb-row">
          <Btn on={() => chain().insertBlankPage().run()} title="Pagină goală: pune o pagină albă întreagă aici (de exemplu înaintea unui capitol), cu cursorul pe ea">▢ Pagină necompletată</Btn>
      </div><div className="rb-row">
          <Btn on={() => chain().setPageBreak().run()} title="Pagină nouă (Ctrl+Enter): textul de după începe pe pagina următoare la tipărire și PDF">⤓ Sfârșit de pagină</Btn>
      {columns > 1 && <Btn on={() => chain().setColumnBreak().run()} title="Sfârșit de coloană (Ctrl+Shift+Enter): textul de după începe în coloana următoare">⫼ Coloană</Btn>}</div></div>
        </RGroup>
        <RGroup label="Tabele">
      <TablePicker editor={editor} onDraw={onDrawTable} />
      <Btn on={() => void insertSheetFile()}
        title="Foaie de calcul: o foaie dintr-un fișier .xlsx, .ods sau .csv intră la cursor ca tabel, cu valorile formulelor calculate și formatarea ei (sume, culori, aldin, celule îmbinate)">▦ Foaie de calcul…</Btn>
      <Btn on={() => void refreshLinkedSheets(editor).then((m) => onStatus?.(m), (e) => onStatus?.(`Foile legate nu au putut fi citite: ${e instanceof Error ? e.message : String(e)}`))}
        title="Actualizează foile legate: tabelele puse din fișiere .xlsx, .ods sau .csv se citesc din nou din fișier, cu valorile de acum (bordurile și alinierea alese în document rămân)">↻ Actualizează foile legate</Btn>
      <Btn on={() => {
        const l = linkedFileAtCursor(editor);
        if (!l) { onStatus?.(linkedTables(editor).length ? 'Pune cursorul în tabelul legat pe care vrei să-l schimbi.' : 'Documentul nu are tabele legate de fișiere. Pune unul cu Inserare → ▦ Foaie de calcul….'); return; }
        openPath(l.path, l.sheet);
        onStatus?.(`Foaia „${l.sheet}” e deschisă în Sheets: schimb-o și salveaz-o, iar tabelul de aici se aduce singur la zi.`);
      }} title="Deschide foaia legată: fișierul tabelului în care e cursorul se deschide în Sheets, într-un tab nou; după ce îl schimbi și îl salvezi, tabelul de aici se aduce singur la zi">✎ Deschide foaia legată</Btn>
      {sheetPick && (
        <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setSheetPick(null); }}>
          <div className="print-dlg" role="dialog" aria-label="Alege foaia" onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setSheetPick(null); } }}>
            <h3>Alege foaia</h3>
            <p className="print-info">{sheetPick.file} are {sheetPick.list.length} foi. Care intră în document?</p>
            <select autoFocus size={Math.min(8, sheetPick.list.length)} value={sheetPick.i} aria-label="Foaia" style={{ width: '100%' }}
              onChange={(e) => setSheetPick({ ...sheetPick, i: Number(e.target.value) })}
              onDoubleClick={() => { onStatus?.(insertSheet(editor, sheetPick, sheetPick.i)); setSheetPick(null); }}>
              {sheetPick.list.map((t, i) => <option key={i} value={i}>{t.name}</option>)}
            </select>
            <div className="print-actions">
              <button onClick={() => setSheetPick(null)}>Renunță</button>
              <button className="primary" onClick={() => { onStatus?.(insertSheet(editor, sheetPick, sheetPick.i)); setSheetPick(null); }}>Inserează</button>
            </div>
          </div>
        </div>
      )}
        </RGroup>
        <RGroup label="Ilustrații">
          <div className="rb-rows rb-stack"><div className="rb-row">
      <Btn on={() => insertImage(editor)} title="Inserează imagine">🖼 Imagini</Btn>
      <ShapePicker editor={editor} />
      <Btn on={() => setModel3dDlg(true)} title="Model 3D: un .obj sau .stl, rotit cu mouse-ul cum vrei și pus la cursor ca poză transparentă">🧊 Modele 3D</Btn>
      {model3dDlg && <Model3DDialog onClose={() => { setModel3dDlg(false); editor.commands.focus(); }} onInsert={(blob, name, src) => { setModel3dDlg(false); const keep = keepModel(src.name, src.data, src.view); void insertImageFiles(editor, [new File([blob], name.replace(/\.(obj|stl|glb|gltf|ply)$/i, '') + '.png', { type: 'image/png' })], undefined, 240, keep ? { model3d: JSON.stringify(keep) } : undefined); }} />}
      <Btn on={() => void insertOnlineVideo(editor)} title="Video online: adresa unui clip; intră coperta lui (poza, ▶ și titlul) și legătura spre el">▶ Video online</Btn>
      </div><div className="rb-row">
          <Btn on={() => setIconsDlg(true)} title="Pictograme: desene simple (telefon, e-mail, oameni, săgeți, semne), în culoarea aleasă; intră la cursor ca poze">☺ Pictograme</Btn>
      {iconsDlg && <IconsDialog onClose={() => { setIconsDlg(false); editor.commands.focus(); }} onInsert={(blobs, names, specs) => { setIconsDlg(false); void insertImageFiles(editor, blobs.map((b, i) => new File([b], names[i] + '.png', { type: 'image/png' })), undefined, 96, (i) => ({ icon: JSON.stringify(specs[i]) })); }} />}
      <Btn on={() => void insertDiagram(editor)} title="Diagramă: proces, săgeți, listă, ciclu, piramidă, ierarhie; textul se schimbă din bara ei (✎ Text)">◇ Diagramă</Btn>
      <Btn on={() => void insertChart(editor)} title="Grafic: coloane, bare, linie, plăcintă…; felul și datele se schimbă din bara lui (✎ Date)">📊 Grafic</Btn>
      <Btn on={() => void insertScreenshot(editor)} title="Captură de ecran: poza unei ferestre deschise sau o bucată decupată din ecran">📸 Instantaneu</Btn>
      </div><div className="rb-row">
          <Btn on={() => void insertSketch(editor)} title="Desen: desenează de mână cu creionul, markerul și radiera; desenul se pune la cursor, ca poză">✏ Desen</Btn>
      <Btn on={() => void insertQr(editor)} title="Cod QR: o adresă web, un telefon sau orice text scurt, ca un pătrat care se citește cu camera telefonului">▣ Cod QR</Btn></div></div>
        </RGroup>
        <RGroup label="Linkuri">
      <Btn on={onLink} active={editor.isActive('link')} title="Legătură (Ctrl+K): adresă web, e-mail sau semn de carte pe textul ales; Ctrl+clic pe ea o deschide">🔗 Link</Btn>
      <BookmarkPicker editor={editor} />
      <CrossRefPicker editor={editor} pageH={pageH} />
        </RGroup>
        <RGroup label="Comentarii">
      <Btn on={onComment} title="Comentariu pe textul ales (Ctrl+Alt+M)">💬 Comentariu</Btn>
        </RGroup>
        <RGroup label="Antet și subsol">
<div className="rb-rows rb-stack">{T.insertHf}</div>
        </RGroup>
        <RGroup label="Text">
          <div className="rb-rows rb-stack"><div className="rb-row">
      <Btn on={() => chain().insertTextBox().run()} title="Casetă de text: un chenar cu text propriu, în dreapta paginii, cu textul documentului în jur (textul ales intră în casetă)">▭ Casetă</Btn>
      <QuickParts editor={editor} />
      <Btn on={() => chain().toggleDropCap().run()} active={!!editor.getAttributes('paragraph').dropCap} title="Letrină: prima literă a paragrafului mare, pe trei rânduri, ca la începutul capitolelor (se păstrează și în .docx / .odt)"><span style={{ fontSize: '1.2em', fontWeight: 700 }}>A</span>≡</Btn>
      <SignatureLine editor={editor} />
      </div><div className="rb-row">
          <DateTimePicker editor={editor} />
      <Btn on={() => chain().insertFormCheck().run()} title="Casetă de selectare: ☐ la cursor, bifată sau debifată cu un clic (bună pentru liste de verificare și formulare); se păstrează în .docx">☐ Casetă de selectare</Btn>
      <Btn on={() => void insertDropList(editor)} title="Listă verticală: la cursor, o alegere dintr-o listă de variante scrise de tine (bună pentru formulare); se păstrează în .docx">▾ Listă verticală</Btn>
      <Btn on={() => chain().insertFormDate().run()} title="Selector de dată: la cursor, o dată aleasă dintr-un calendar cu un clic (bună pentru formulare); se păstrează în .docx">📅 Selector de dată</Btn>
      </div><div className="rb-row">
          <FieldPicker editor={editor} ctx={{ file, props }} pageH={pageH} onStatus={onStatus} />
      <Btn on={() => void insertFromFile(editor)} title="Text din fișier: tot conținutul altui document (.docx, .odt, .rtf, .txt) sau al unui e-mail (.eml, .msg), cu formatarea, tabelele și pozele, pus la cursor">📄 Din fișier</Btn>
{T.sum}</div></div>
        </RGroup>
        <RGroup label="Simboluri">
      <Btn on={() => void insertEquation(editor)} title="Ecuație: fracții, puteri, radicali, sume, integrale, litere grecești; se schimbă din bara ei (✎ Ecuație)">√x Ecuație</Btn>
      <SymbolPicker editor={editor} />
      <Btn on={() => chain().setHorizontalRule().run()} title="Linie orizontală">―</Btn>
        </RGroup>
    </>
  );
  const refs = locked ? lockNote : (
    <>
        {/* Grupurile și butoanele din procesorul de text cunoscut: Cuprins (Cuprins, Adăugare text ▾, Actualizare tabel), Note de subsol, Citări și bibliografie, Legende, Index. */}
        <RGroup label="Cuprins">
      <Btn on={() => chain().insertTableOfContents().run()} title="Inserează cuprins (se completează singur cu titlurile; click pe un rând duce la titlu)">Cuprins</Btn>
      <RMenu label="Adăugare text" title="Paragraful cu cursorul apare în cuprins ca titlu de nivelul 1, 2 sau 3, sau nu apare deloc" items={[
        { label: 'Nu se afișează în cuprins', checked: !editor.isActive('heading'), run: () => { chain().setParagraph().run(); } },
        ...([1, 2, 3] as const).map((l) => ({ label: `Nivelul ${l}`, checked: editor.isActive('heading', { level: l }), run: () => { chain().setHeading({ level: l }).run(); } })),
      ]} />
      <Btn on={() => { editor.view.dom.dispatchEvent(new Event('suite-pages')); editor.commands.focus(); }} title="Actualizare tabel: cuprinsul ia din nou titlurile și numerele de pagină (se actualizează și singur, la fiecare modificare)">⟳ Actualizare tabel</Btn>
        </RGroup>
        <RGroup label="Note de subsol">
      <Btn on={() => chain().insertFootnote().run()} title="Inserare notă de subsol (Ctrl+Alt+F): un număr mic în text, iar textul notei îl scrii sub document">¹ Inserare notă de subsol</Btn>
      <Btn on={() => chain().insertEndnote().run()} title="Inserare notă de final (Ctrl+Alt+D): numerotată i, ii, iii; textul ei stă la sfârșitul documentului (se păstrează și în .docx)">ⁱ Inserare notă de final</Btn>
      {(() => {
        // Nota următoare / anterioară, ca în procesorul de text cunoscut: cursorul sare la numărul notei din text.
        const go = (end: boolean, dir: 1 | -1) => {
          const ps = footnotePositions(editor.state.doc, end);
          const at = editor.state.selection.from;
          const p = dir === 1 ? (ps.find((x) => x >= at) ?? ps[0]) : ([...ps].reverse().find((x) => x < at - 1) ?? ps[ps.length - 1]);
          if (p !== undefined) chain().setTextSelection(p + 1).scrollIntoView().run();
        };
        return (
          <RMenu label="Nota următoare" title="Mergi la nota de subsol sau de final următoare / anterioară din text" items={[
            { label: 'Nota de subsol următoare', run: () => go(false, 1) },
            { label: 'Nota de subsol anterioară', run: () => go(false, -1) },
            { label: 'Nota de final următoare', sep: true, run: () => go(true, 1) },
            { label: 'Nota de final anterioară', run: () => go(true, -1) },
          ]} />
        );
      })()}
      <Btn on={() => { const n = editor.view.dom.closest('.module-pane')?.querySelector('.doc-footnotes'); if (n) n.scrollIntoView({ block: 'center' }); }} title="Afișare note: arată lista cu textul notelor, de sub document">☷ Afișare note</Btn>
        </RGroup>
        <RGroup label="Citări și bibliografie">
      <CitationPicker editor={editor} />
        </RGroup>
        <RGroup label="Legende">
      <CaptionPicker editor={editor} />
      <CrossRefPicker editor={editor} pageH={pageH} />
        </RGroup>
        <RGroup label="Index">
      <IndexPicker editor={editor} />
        </RGroup>
        <RGroup label="Tabel de autorități">
      <AuthPicker editor={editor} />
        </RGroup>
    </>
  );
  const review = (
    <>
        {/* Ordinea grupurilor din procesorul de text cunoscut: Verificare, Vorbire, Accesibilitate, Comentarii, Urmărire, Modificări, Comparare, Protejare. */}
        <RGroup label="Verificare">
{T.spell}
{T.grammar}
{T.thes}
{T.words}
{T.dia}
{T.autocorrect}
        </RGroup>
        <RGroup label="Vorbire">
{T.speak}
        </RGroup>
        <RGroup label="Accesibilitate">
{T.a11y}
        </RGroup>
        <RGroup label="Comentarii">
{T.cmts}
        </RGroup>
        <RGroup label="Urmărire">
{T.track}
        </RGroup>
        <RGroup label="Modificări">
{T.chgs}
        </RGroup>
        <RGroup label="Comparare">
{T.compare}
        </RGroup>
        <RGroup label="Protejare">
{T.restrict}
{T.inspect}
{T.compat}
        </RGroup>
    </>
  );
  // Filele contextuale ale tabelului, ca în procesorul de text cunoscut: „Proiectare tabel” (cum arată) și „Aspect” (cum e construit).
  const tAttrs = editor.getAttributes('table');
  const tOpts = parseOpts(tAttrs.tableOpts ?? undefined);
  const tableDesign = locked ? lockNote : (
    <>
        <RGroup label="Opțiuni stil tabel" className="table-tools">
          <Btn on={() => chain().toggleHeaderRow().run()} active={hasHeaderRow(editor.state)} title="Primul rând e rând de antet (scris aldin, pe fond gri, citit ca antet de cititoarele de ecran)">▤ Rând antet</Btn>
          <div className="table-style-opts">{([['head', 'Antet'], ['total', 'Rând de total'], ['band', 'Rânduri alternante'], ['first', 'Prima coloană'], ['last', 'Ultima coloană'], ['bandCol', 'Coloane alternante']] as const).map(([k, label]) => (
            <label key={k} className="table-style-opt" title={tAttrs.tableStyle ? `${label}: cu culoarea stilului` : `${label}: alege întâi un stil din Stiluri tabel`}>
              <input type="checkbox" checked={!!tOpts[k]} disabled={!tAttrs.tableStyle} aria-label={label} onChange={(e) => { applyTableStyle(tAttrs.tableStyle, { ...tOpts, [k]: e.target.checked })(editor.state, editor.view.dispatch); editor.view.focus(); }} />
              {label}
            </label>
          ))}</div>
        </RGroup>
        <RGroup label="Stiluri tabel" className="table-tools">
          <select
            className="fmt table-style"
            value={tAttrs.tableStyle ?? ''}
            aria-label="Stilul tabelului"
            title="Stil de tabel: culori pentru rândul de antet, rândurile alternante, prima coloană și rândul de total (se păstrează în .docx, .odt și PDF)"
            onChange={(e) => { applyTableStyle(e.target.value || null, tOpts)(editor.state, editor.view.dispatch); editor.view.focus(); }}
          >
            <option value="">🎨 Fără stil</option>
            {TABLE_STYLES.map((s) => <option key={s.id} value={s.id} style={{ background: s.head }}>{s.name}</option>)}
          </select>
        </RGroup>
        <RGroup label="Umbrire" className="table-tools">
          {CELL_COLORS.map((c) => (
            <button
              key={c || 'none'}
              className="fmt cell-color"
              style={{ background: c || undefined }}
              aria-label={c ? `Fundal celulă ${c}` : 'Fără fundal'}
              title={c ? 'Umbrire: culoarea de fundal a celulelor alese' : 'Fără umbrire (fără culoare de fundal)'}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => chain().setCellAttribute('backgroundColor', c || null).run()}
            >{c ? '' : '∅'}</button>
          ))}
        </RGroup>
        <RGroup label="Borduri" className="table-tools">
          <div className="rb-rows rb-stack"><div className="rb-row">
          <Btn
            on={() => chain().updateAttributes('table', { borders: tAttrs.borders === 'none' ? null : 'none' }).run()}
            active={tAttrs.borders === 'none'}
            title="Tabel fără borduri: liniile nu se mai tipăresc (bun pentru text așezat pe coloane, de exemplu semnături una lângă alta). Încă un click le pune la loc"
          >▦ Fără borduri</Btn>
          <select className="fmt-select" aria-label="Liniile tabelului" title="Borduri: care linii ale tabelului se văd (și la tipărire, PDF, .docx)"
            value={tAttrs.bset ?? ''} disabled={tAttrs.borders === 'none'}
            onChange={(e) => chain().updateAttributes('table', { bset: e.target.value || null }).run()}>
            {LINE_SETS.map(([k, l]) => <option key={l} value={k ?? ''}>{l}</option>)}
          </select>
          </div><div className="rb-row">
          <select className="fmt-select" aria-label="Felul liniilor" title="Stilul liniei: felul liniilor tabelului"
            value={tAttrs.bstyle ?? ''} disabled={tAttrs.borders === 'none'}
            onChange={(e) => chain().updateAttributes('table', { bstyle: e.target.value || null }).run()}>
            {LINE_STYLES.map(([k, l]) => <option key={l} value={k ?? ''}>{l}</option>)}
          </select>
          {LINE_COLORS.map((c) => (
            <button key={c} className={`fmt cell-color ${(tAttrs.bcolor ?? '#000000') === c ? 'active' : ''}`} style={{ background: c }}
              aria-label={`Culoarea liniilor ${c}`} title="Culoarea stiloului: culoarea liniilor tabelului" disabled={tAttrs.borders === 'none'}
              onMouseDown={(e) => e.preventDefault()} onClick={() => chain().updateAttributes('table', { bcolor: c === '#000000' ? null : c }).run()} />
          ))}</div></div>
        </RGroup>
        <RGroup label="Borduri celule" className="table-tools">
          <div className="rb-rows rb-stack"><div className="rb-row">
          <select className="fmt-select" aria-label="Stilul stiloului" title="Stilul liniei: felul liniei pentru Borduri ▾ și Pensula pentru borduri"
            value={pen.style} onChange={(e) => setPen({ ...pen, style: e.target.value as Pen['style'] })}>
            {PEN_STYLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <input type="color" className="fmt cell-pen-color" aria-label="Culoarea stiloului" title="Culoarea stiloului: culoarea liniei pentru Borduri ▾ și Pensula pentru borduri"
            value={pen.color} onChange={(e) => setPen({ ...pen, color: e.target.value })} />
          </div><div className="rb-row">
          <Btn on={() => chain().command(({ state, dispatch }) => applyCellBorders(lastKind, pen)(state, dispatch)).run()}
            title={`${BORDER_KINDS.find((k) => k[0] === lastKind)?.[1] ?? ''}: pe celulele alese, cu stiloul ales`}>▣ {BORDER_KINDS.find((k) => k[0] === lastKind)?.[1]}</Btn>
          <select className="fmt-select" value="" aria-label="Borduri pe celulele alese" title="Borduri ▾: pune linii pe laturile celulelor alese (jos, sus, contur, interior...), cu stilul și culoarea stiloului"
            onChange={(e) => {
              const k = e.target.value as BorderKind;
              if (!k) return;
              setLastKind(k);
              chain().command(({ state, dispatch }) => applyCellBorders(k, pen)(state, dispatch)).run();
            }}>
            <option value="">Borduri ▾</option>
            {BORDER_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <Btn on={() => setPainter(!painter)} active={painter}
            title="Pensula pentru borduri: clic lângă marginea unei celule pune linia stiloului pe latura aceea; clic în mijlocul celulei, pe toate laturile. Esc sau încă un clic o oprește">🖌 Pensulă borduri</Btn></div></div>
        </RGroup>
    </>
  );
  const tableLayout = locked ? lockNote : (
    <>
        {tablePropsDlg && <TablePropsDialog editor={editor} onClose={() => { setTablePropsDlg(false); editor.commands.focus(); }} />}
        <RGroup label="Tabel" className="table-tools">
          <select
            className="fmt table-select"
            value=""
            aria-label="Selectează în tabel"
            title="Selectare: celula, rândul, coloana sau tot tabelul în care e cursorul"
            onChange={(e) => {
              const v = e.target.value as 'cell' | 'row' | 'col' | 'table' | '';
              if (!v) return;
              selectTablePart(v)(editor.state, editor.view.dispatch);
              editor.view.focus();
            }}
          >
            <option value="">⬚ Selectare ▾</option>
            <option value="cell">Selectare celulă</option>
            <option value="row">Selectare rând</option>
            <option value="col">Selectare coloană</option>
            <option value="table">Selectare tabel</option>
          </select>
          <Btn on={() => setTablePropsDlg(true)} title="Proprietăți tabel: așezarea și lățimea tabelului, înălțimea rândului, rândul care nu se rupe între pagini, lățimea coloanei, alinierea în celulă">⚙ Proprietăți</Btn>
        </RGroup>
        <RGroup label="Rânduri și coloane" className="table-tools">
          <div className="rb-rows rb-stack"><div className="rb-row">
          <RMenu label="✕ Ștergere" keytip="D" title="Ștergere: rândul, coloana sau tot tabelul în care e cursorul" items={[
            { label: 'Ștergere coloane', run: () => chain().deleteColumn().run() },
            { label: 'Ștergere rânduri', run: () => chain().deleteRow().run() },
            { label: 'Ștergere tabel', run: () => chain().deleteTable().run() },
          ]} />
          <Btn on={() => chain().addRowBefore().run()} title="Inserare deasupra: rând nou deasupra celui cu cursorul">⬒ Inserare deasupra</Btn>
          </div><div className="rb-row">
          <Btn on={() => chain().addRowAfter().run()} title="Inserare dedesubt: rând nou sub cel cu cursorul">⬓ Inserare dedesubt</Btn>
          <Btn on={() => chain().addColumnBefore().run()} title="Inserare la stânga: coloană nouă la stânga celei cu cursorul">◧ Inserare la stânga</Btn>
          </div><div className="rb-row">
          <Btn on={() => chain().addColumnAfter().run()} title="Inserare la dreapta: coloană nouă la dreapta celei cu cursorul">◨ Inserare la dreapta</Btn></div></div>
        </RGroup>
        <RGroup label="Îmbinare" className="table-tools">
          <div className="rb-rows rb-stack"><div className="rb-row">
          <Btn on={() => chain().mergeOrSplit().run()} title="Îmbinare celule: celulele alese devin una (pe o celulă îmbinată o desparte la loc)">⊞ Îmbinare celule</Btn>
          <Btn on={() => { splitCellInto('cols')(editor.state, editor.view.dispatch); editor.view.focus(); }} title="Împarte celula în 2 coloane (celula nouă vine la dreapta)">◫ Scindare în coloane</Btn>
          </div><div className="rb-row">
          <Btn on={() => { splitCellInto('rows')(editor.state, editor.view.dispatch); editor.view.focus(); }} title="Împarte celula în 2 rânduri (celula nouă vine dedesubt)">⊟ Scindare în rânduri</Btn>
          <Btn on={() => { splitTable(editor.state, editor.view.dispatch); editor.view.focus(); }} title="Scindare tabel: împarte tabelul în două, deasupra rândului în care e cursorul">⇳ Scindare tabel</Btn></div></div>
        </RGroup>
        <RGroup label="Dimensiune celulă" className="table-tools">
          <div className="rb-rows rb-stack"><div className="rb-row">
          <select
            className="fmt table-fit"
            value=""
            aria-label="Potrivire automată"
            title="Potrivire automată: tabelul cât textul din el sau pe toată lățimea paginii, cu coloane egale"
            onChange={(e) => {
              const v = e.target.value;
              if (v !== 'content' && v !== 'window') return;
              setTableFit(v)(editor.state, editor.view.dispatch);
              editor.view.focus();
            }}
          >
            <option value="">↔ Potrivire automată ▾</option>
            <option value="content">Potrivire automată la conținut</option>
            <option value="window">Potrivire automată la fereastră (coloane egale)</option>
          </select>
          </div><div className="rb-row">
          <label className="muted row-height" title="Înălțimea rândului cu cursorul (sau a rândurilor alese), în cm: cel puțin atât, crește dacă textul nu încape. Gol = automată">
            ↕ Înălțime
            <input
              key={String(rowHeightAt(editor.state))}
              className="fmt row-h"
              type="text"
              inputMode="decimal"
              placeholder="auto"
              defaultValue={rowHeightAt(editor.state)?.toLocaleString('ro-RO') ?? ''}
              aria-label="Înălțimea rândului (cm)"
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); editor.view.focus(); }
                if (e.key === 'Escape') { e.preventDefault(); e.currentTarget.value = rowHeightAt(editor.state)?.toLocaleString('ro-RO') ?? ''; editor.view.focus(); }
              }}
              onBlur={(e) => {
                const t = e.currentTarget.value.trim().replace(',', '.');
                const v = t ? Number(t) : null;
                if (v !== null && !(v >= 0)) { e.currentTarget.value = rowHeightAt(editor.state)?.toLocaleString('ro-RO') ?? ''; return; }
                if ((v || null) !== rowHeightAt(editor.state)) setRowHeight(v)(editor.state, editor.view.dispatch);
              }}
            />
            cm
          </label>
          </div><div className="rb-row">
          <Btn on={() => { setTableFit('window')(editor.state, editor.view.dispatch); editor.view.focus(); }} title="Distribuire coloane: toate coloanele la fel de late, pe toată lățimea paginii">⇹ Distribuire coloane</Btn></div></div>
        </RGroup>
        <RGroup label="Aliniere" className="table-tools">
          <div className="rb-rows rb-stack"><div className="rb-row">
          <select
            className="fmt table-valign"
            value={(editor.isActive('tableHeader') ? editor.getAttributes('tableHeader') : editor.getAttributes('tableCell')).verticalAlign ?? ''}
            aria-label="Alinierea verticală în celulă"
            title="Unde stă textul în celulă pe înălțime: sus, la mijloc sau jos (pe celulele alese)"
            onChange={(e) => chain().setCellAttribute('verticalAlign', e.target.value || null).run()}
          >
            <option value="">⤒ Sus</option>
            <option value="middle">⇕ Mijloc</option>
            <option value="bottom">⤓ Jos</option>
          </select>
          </div><div className="rb-row">
          <Btn on={() => chain().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Textul din celulă la stânga">⯇</Btn>
          <Btn on={() => chain().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Textul din celulă la centru">≡</Btn>
          <Btn on={() => chain().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Textul din celulă la dreapta">⯈</Btn>
          </div><div className="rb-row">
          <select
            className="fmt table-align"
            value={tAttrs.align ?? ''}
            aria-label="Așezarea tabelului pe pagină"
            title="Unde stă pe pagină un tabel mai îngust decât pagina: la stânga, la centru sau la dreapta"
            onChange={(e) => chain().updateAttributes('table', { align: e.target.value || null }).run()}
          >
            <option value="">⇤ Tabel la stânga</option>
            <option value="center">↔ Tabel la centru</option>
            <option value="right">⇥ Tabel la dreapta</option>
          </select></div></div>
        </RGroup>
        <RGroup label="Date" className="table-tools">
          <div className="rb-rows rb-stack"><div className="rb-row">
          <select
            className="fmt table-sort"
            value=""
            aria-label="Sortează tabelul"
            title="Sortare: rândurile după coloana în care e cursorul (numerele ca numere, datele ca date, textul alfabetic); rândul de antet rămâne sus"
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              sortTable(v.startsWith('za') ? -1 : 1, v.endsWith('1'))(editor.state, editor.view.dispatch);
              editor.view.focus();
            }}
          >
            <option value="">⇅ Sortare ▾</option>
            <option value="az">A → Z (crescător)</option>
            <option value="za">Z → A (descrescător)</option>
            <option value="az1">A → Z, primul rând rămâne sus</option>
            <option value="za1">Z → A, primul rând rămâne sus</option>
          </select>
          </div><div className="rb-row">
          <Btn on={() => { toggleRepeatHeader(editor.state, editor.view.dispatch); editor.view.focus(); }} active={isRepeatOn(editor.state)} title="Repetare rânduri antet pe fiecare pagină (la tipărire și PDF): se repetă rândurile de sus până la cel cu cursorul">⇈ Repetare rânduri antet</Btn>
          </div><div className="rb-row">
          <Btn on={() => { tableToText(editor.state, editor.view.dispatch); editor.view.focus(); }} title="Conversie în text: un rând pe paragraf, celulele despărțite prin tab">⇄ Conversie în text</Btn></div></div>
        </RGroup>
    </>
  );
  // Mini-bara de lângă textul ales: aceleași comenzi ca pe Pornire (font, mărime, B I U, culori), plus legătură, comentariu, pensula.
  const mini = (
    <MiniBar target={editor.view.dom} disabled={locked || !editor.isEditable || !!painterOf(editor).marks}>
      <select value={(editor.getAttributes('textStyle').fontFamily as string) ?? ''} title="Font" aria-label="Font (mini-bara)" className="font-select"
        onChange={(e) => (e.target.value ? chain().setFontFamily(e.target.value).run() : chain().unsetFontFamily().run())}>
        {FONTS.map(([label, value]) => <option key={label} value={value}>{label}</option>)}
      </select>
      <select value={(editor.getAttributes('textStyle').fontSize as string) ?? ''} title="Mărime" aria-label="Mărime (mini-bara)" className="size-select"
        onChange={(e) => (e.target.value ? chain().setFontSize(e.target.value).run() : chain().unsetFontSize().run())}>
        <option value="">Mărime</option>
        {SIZES.map((s) => <option key={s} value={`${s}pt`}>{s}</option>)}
      </select>
      <Btn on={() => chain().growFontSize(1).run()} title="Mărește fontul (Ctrl+Shift+>)">A<sup>+</sup></Btn>
      <Btn on={() => chain().growFontSize(-1).run()} title="Micșorează fontul (Ctrl+Shift+<)">A<sup>−</sup></Btn>
      <span className="sep" />
      <Btn on={() => chain().toggleBold().run()} active={editor.isActive('bold')} title="Aldin (Ctrl+B)"><b>B</b></Btn>
      <Btn on={() => chain().toggleItalic().run()} active={editor.isActive('italic')} title="Cursiv (Ctrl+I)"><i>I</i></Btn>
      <Btn on={() => chain().toggleUnderline().run()} active={editor.isActive('underline')} title="Subliniat (Ctrl+U)"><u>U</u></Btn>
      <ColorMenu kind="text" styles={styles} current={editor.getAttributes('textStyle').color as string | undefined} last={lastColor}
        onPick={(c) => { if (c) { setLastColor(c); chain().setColor(c).run(); } else chain().unsetColor().run(); }}>
        <span style={{ borderBottom: `3px solid ${lastColor}` }}>A</span>
      </ColorMenu>
      <ColorMenu kind="highlight" styles={styles} current={editor.getAttributes('highlight').color as string | undefined} last={lastHl}
        onPick={(c) => { if (c) { setLastHl(c); chain().setHighlight({ color: c }).run(); } else chain().unsetHighlight().run(); }}>
        <span style={{ background: lastHl, padding: '0 3px', color: '#000' }}>ab</span>
      </ColorMenu>
      <span className="sep" />
      <Btn on={onLink} active={editor.isActive('link')} title="Legătură (adresă web, e-mail sau semn de carte) pe textul ales">🔗</Btn>
      <Btn on={onComment} title="Comentariu nou la textul ales (Ctrl+Alt+M)">💬</Btn>
      <Btn on={() => chain().pickFormat(false).run()} title="Pensula de formatare: ia formatul textului ales, apoi alege cu mouse-ul textul care îl primește">🖌</Btn>
    </MiniBar>
  );
  return (<>
    {mini}
    {fontDlg && <FontDialog editor={editor} fonts={FONTS} onClose={() => setFontDlg(false)} />}
    <Ribbon module="docs" layout={arrange.layout} className="toolbar formatbar" recent={recent}
      quick={<>
        <button onMouseDown={(e) => e.preventDefault()} onClick={onSave} title="Salvează (Ctrl+S)" aria-label="Salvează">💾</button>
      <Btn on={() => chain().undo().run()} title="Anulează (Ctrl+Z)">↶</Btn>
      <Btn on={() => chain().redo().run()} title="Refă (Ctrl+Y)">↷</Btn>
      </>}
      file={T.file}
      right={<>{arrange.menu}{T.filename}</>}
      tabs={[
        { id: 'home', label: 'Pornire', content: home },
        { id: 'insert', label: 'Inserare', content: insert },
        { id: 'design', label: 'Proiectare', content: <>{!locked && <DocFormatGroup styles={styles} onStyles={onStyles} />}<RGroup label="Fundal pagină">{T.pageBg}</RGroup></> },
        { id: 'layout', label: 'Aspect', content: <>{T.layoutQuick}{!locked && <RGroup label="Paragraf"><ParagraphQuick editor={editor} /></RGroup>}{!locked && T.arrange}<RGroup label="Pagină">{T.page}</RGroup></> },
        { id: 'refs', label: 'Referințe', content: refs },
        { id: 'mail', label: 'Corespondență', content: T.mailGroups },
        { id: 'review', label: 'Revizuire', content: review },
        { id: 'view', label: 'Vizualizare', content: <><RGroup label="Vizualizări">{T.views}</RGroup><RGroup label="Imersiv">{T.immersive}</RGroup><RGroup label="Afișare">{T.ruler}{T.nav}</RGroup><RGroup label="Zoom">{T.zoomGrp}</RGroup><RGroup label="Fereastră">{T.windowGrp}</RGroup><RGroup label="Macrocomenzi">{T.macrosGrp}</RGroup></> },
        { id: 'tabledesign', label: 'Proiectare tabel', contextual: true, shown: editor.isActive('table'), content: tableDesign },
        { id: 'tablelayout', label: 'Aspect', contextual: true, shown: editor.isActive('table'), content: tableLayout },
        { id: 'hf', label: 'Antet și subsol', contextual: true, autoOpen: true, shown: !!hfTab, content: hfTab },
        { id: 'image', label: imageTabLabel(editor), contextual: true, autoOpen: true, shown: !locked && editor.isEditable && editor.isActive('image'), content: <ImageRibbonSlot editor={editor} /> },
      ]}
    />
  </>);
}

/** Antetul sau subsolul editat direct pe pagină: eticheta lui, câmpul de text; Esc sau Enter închid. */
function HfEditBox({ kind, first, value, inputRef, onChange, onClose }: { kind: 'header' | 'footer'; first: boolean; value: string; inputRef: React.RefObject<HTMLInputElement>; onChange(t: string): void; onClose(): void }) {
  const name = kind === 'header' ? (first ? 'Antetul primei pagini' : 'Antet') : 'Subsol';
  return (
    <div className={`doc-hf doc-hf-edit ${kind === 'header' ? 'doc-hf-top' : 'doc-hf-bottom'}`}>
      <input ref={inputRef} className="doc-hf-input" aria-label={`Textul: ${name}`} value={value} maxLength={200}
        placeholder={kind === 'header' ? 'Scrie antetul (de exemplu numele firmei)' : 'Scrie subsolul'}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); onClose(); }
          // Tab trece la locul următor (mijloc, apoi dreapta), ca în antetul procesorului de text cunoscut.
          else if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && value.split('\t').length < 3) {
            e.preventDefault();
            const el = e.currentTarget, a = el.selectionStart ?? value.length, b = el.selectionEnd ?? value.length;
            onChange(value.slice(0, a) + '\t' + value.slice(b));
            requestAnimationFrame(() => el.setSelectionRange(a + 1, a + 1));
          }
        }} />
      <span className="doc-hf-tag">{name}</span>
    </div>
  );
}

/** Numele filei contextuale după obiectul ales: Imagine, Formă, Grafic, Diagramă, Ecuație sau Text artistic. */
function imageTabLabel(editor: Editor): string {
  const a = editor.getAttributes('image');
  return a.chart ? 'Grafic' : a.diagram ? 'Diagramă' : a.equation ? 'Ecuație' : a.wordart ? 'Format formă' : a.shape ? 'Format formă' : 'Format imagine';
}

// O spațiere venită din Word care nu e în listă (de exemplu 1,08) se arată și ea.
function lineHeightExtra(editor: Editor): string[] {
  const v = (editor.getAttributes('paragraph').lineHeight ?? editor.getAttributes('heading').lineHeight) as string | undefined;
  return v && !LINE_HEIGHTS.includes(v) ? [v] : [];
}

/** „1.250,50” sau „1250.5” → 1250.5 (formatul românesc are virgula zecimală). */
export function parseAmount(raw: string): number | null {
  let t = raw.replace(/\s|lei|ron/gi, '');
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// Numerotarea listei în care e cursorul: continuă lista de dinainte sau reîncepe de la 1.
function ListTools({ editor }: { editor: Editor }) {
  const start = listStart(editor) ?? 1;
  const next = continueNumber(editor);
  return (
    <div className="table-tools">
      <span className="muted">Numerotare: de la {start}</span>
      {next !== null && next !== start && (
        <button className="fmt" onMouseDown={(e) => e.preventDefault()} onClick={() => setListStart(editor, next)} title="Lista continuă numerotarea listei de mai sus (de exemplu după o imagine sau un tabel)">
          Continuă ({next}, {next + 1}…)
        </button>
      )}
      {start !== 1 && (
        <button className="fmt" onMouseDown={(e) => e.preventDefault()} onClick={() => setListStart(editor, 1)} title="Lista începe din nou de la 1">De la 1</button>
      )}
    </div>
  );
}

// Pe ecran: A4 la 96 de puncte pe inch (210 mm = 794 px), cu marginile alese.
/** Lățimea paginii pe ecran la 100% (A4: 816 px în picioare, 1123 px culcată). La zoom pagina o păstrează, ca rândurile să se rupă la fel. */
function pageWidth(p: PageSetup): number {
  if (pagePaper(p) !== 'A4') return Math.round(paperSize(p).w * 3.78);
  return hasLayout(p) && p.landscape ? 1123 : 816;
}

/** Marginile pentru @page (tipărire și PDF): sus dreapta jos stânga. */
function marginCss(p: PageSetup): string {
  const m = pageMargins(p);
  return `${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm`;
}

function pageStyle(p: PageSetup): React.CSSProperties | undefined {
  if (!hasLayout(p)) return undefined;
  const m = pageMargins(p);
  const px = (mm: number) => `${Math.round(mm * 3.78)}px`;
  const padding = `${px(m.top)} ${px(m.right)} ${px(m.bottom)} ${px(m.left)}`;
  // Pe o pagină colorată textul rămâne negru, și în tema întunecată.
  const bg = pageBackground(p) ? { background: pageBackground(p), color: '#000' } : {};
  return p.landscape
    ? { maxWidth: pageWidth(p), minHeight: Math.round(paperSize(p).h * 3.78), padding, ...bg }
    : pagePaper(p) !== 'A4' ? { maxWidth: pageWidth(p), minHeight: Math.round(paperSize(p).h * 3.78), padding, ...bg } : { padding, ...bg };
}

const docStats = (text: string) => ({ words: (text.match(/\S+/g) ?? []).length, chars: text.replace(/\s/g, '').length });

/** Proprietățile documentului, ca în Word (Fișier → Informații → Proprietăți). */
function PropsDialog({ value, final, mark0, stats, onSave, onClose }: { value: DocProps; final: boolean; mark0: LabelMark; stats: { words: number; chars: number }; onSave(p: DocProps, final: boolean, mark: LabelMark): void; onClose(): void }) {
  const [p, setP] = useState<DocProps>(value);
  const [fin, setFin] = useState(final);
  const [mark, setMark] = useState<LabelMark>(mark0);
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg" role="dialog" aria-label="Proprietăți" onKeyDown={(e) => {
        if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        else if (e.key === 'Enter' && !(e.target instanceof HTMLInputElement && e.target.type === 'checkbox')) { e.preventDefault(); onSave(p, fin, mark); }
      }}>
        <h3>Proprietățile documentului</h3>
        {DOC_PROPS.map(([k, label], i) => (
          <div className="print-row" key={k}>
            <span className="print-label">{label}</span>
            <input className="print-area page-hf-input" autoFocus={i === 0} value={p[k] ?? ''} maxLength={200} aria-label={label}
              onChange={(e) => setP({ ...p, [k]: e.target.value })}
              placeholder={k === 'keywords' ? 'de exemplu: contract, 2026, client' : k === 'author' ? 'numele tău' : ''} />
          </div>
        ))}
        <LabelRow value={p.label} onChange={(label) => setP({ ...p, label })} />
        {p.label && <>
          <label className="print-row" title="Numele clasificării apare jos pe fiecare pagină (la tipărire, PDF și .docx), după textul subsolului">
            <input type="checkbox" data-label-mark="footer" checked={mark.footer} onChange={(e) => setMark({ ...mark, footer: e.target.checked })} /> Scrie clasificarea în subsol
          </label>
          <label className="print-row" title="Numele clasificării, cu litere mari, pe diagonala fiecărei pagini">
            <input type="checkbox" data-label-mark="watermark" checked={mark.watermark} onChange={(e) => setMark({ ...mark, watermark: e.target.checked })} /> Scrie clasificarea ca filigran
          </label>
        </>}
        <label className="print-row" title="Documentul se deschide doar pentru citire, cu o bară galbenă și butonul „Editează oricum” (se păstrează și în .docx)">
          <input type="checkbox" checked={fin} onChange={(e) => setFin(e.target.checked)} /> Marchează ca final (doar citire)
        </label>
        <p className="print-info">{stats.words.toLocaleString('ro-RO')} cuvinte, {stats.chars.toLocaleString('ro-RO')} caractere (fără spații). Proprietățile se salvează în document și în fișierul .docx exportat, iar titlul apare și la pagina web.</p>
        <div className="print-actions">
          <button onClick={onClose}>Închide</button>
          <button className="primary" onClick={() => onSave(p, fin, mark)}>Gata (Enter)</button>
        </div>
      </div>
    </div>
  );
}

function PageDialog({ value, onSave, onClose, focus }: { value: PageSetup; onSave(p: PageSetup): void; onClose(): void; focus?: string }) {
  const [p, setP] = useState(value);
  const dlgRef = useRef<HTMLDivElement>(null);
  // Deschisă dintr-un buton rapid (Aspect → Filigran…): duce cursorul la rândul acela.
  useEffect(() => {
    if (!focus) return;
    const el = [...(dlgRef.current?.querySelectorAll<HTMLElement>('input, select') ?? [])].find((x) => x.getAttribute('aria-label') === focus);
    if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); }
  }, [focus]);
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg" ref={dlgRef} role="dialog" aria-label="Pagină" onKeyDown={(e) => {
        if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        else if (e.key === 'Enter') { e.preventDefault(); onSave(p); }
      }}>
        <h3>Pagină</h3>
        <div className="print-row">
          <span className="print-label">Orientare</span>
          <label><input type="radio" name="orient" checked={!p.landscape} onChange={() => setP({ ...p, landscape: false })} /> Verticală</label>
          <label><input type="radio" name="orient" checked={!!p.landscape} onChange={() => setP({ ...p, landscape: true })} /> Orizontală (peisaj)</label>
        </div>
        <div className="print-row">
          <span className="print-label">Hârtie</span>
          <select value={pagePaper(p)} onChange={(e) => setP({ ...p, paper: e.target.value as Paper })} aria-label="Mărimea hârtiei">
            {PAPERS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
        <div className="print-row">
          <span className="print-label">Margini</span>
          <select value={p.margins ? 'custom' : pageMargin(p)} aria-label="Marginile paginii"
            onChange={(e) => setP(e.target.value === 'custom'
              ? { ...p, margins: pageMargins(p) }
              : { ...p, margin: Number(e.target.value), margins: undefined })}>
            {[...new Set([...MARGINS, pageMargin(p)])].sort((a, b) => a - b).map((m) => (
              <option key={m} value={m}>{(m / 10).toLocaleString('ro-RO')} cm{m === 20 ? ' (obișnuit)' : m === 10 ? ' (înguste)' : m === 30 ? ' (late)' : ''}</option>
            ))}
            <option value="custom">Diferite pe fiecare latură…</option>
          </select>
        </div>
        {p.margins && (
          <div className="print-row page-margins">
            <span className="print-label" />
            {(['top', 'bottom', 'left', 'right'] as const).map((k) => (
              <label key={k}>{{ top: 'Sus', bottom: 'Jos', left: 'Stânga', right: 'Dreapta' }[k]}
                <input type="number" min={0} max={10} step={0.1} value={pageMargins(p)[k] / 10} aria-label={`Marginea ${{ top: 'de sus', bottom: 'de jos', left: 'din stânga', right: 'din dreapta' }[k]} (cm)`}
                  onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) setP({ ...p, margins: { ...pageMargins(p), [k]: Math.min(100, Math.max(0, Math.round(v * 100) / 10)) } }); }} /> cm
              </label>
            ))}
          </div>
        )}
        <div className="print-row">
          <span className="print-label">Coloane</span>
          {[1, 2, 3].map((n) => (
            <label key={n}><input type="radio" name="cols" checked={pageColumns(p) === n} onChange={() => setP({ ...p, columns: n })} /> {n === 1 ? 'Una' : n === 2 ? 'Două' : 'Trei'}</label>
          ))}
        </div>
        <div className="print-row">
          <span className="print-label">Numere de rând</span>
          <select value={!lineNums(p) ? '' : lineNums(p)!.page ? 'page' : 'cont'} aria-label="Numere de rând" title="Un număr în stânga fiecărui rând, ca în contracte și textele juridice (tabelele nu se numerotează)"
            onChange={(e) => setP({ ...p, lineNums: e.target.value ? { ...lineNums(p), page: e.target.value === 'page' || undefined } : undefined })}>
            <option value="">Fără</option>
            <option value="cont">Continuu, în tot documentul</option>
            <option value="page">De la 1 pe fiecare pagină</option>
          </select>
          <label>din <select value={lineNums(p)?.by ?? 1} disabled={!lineNums(p)} aria-label="Din câte în câte rânduri apare numărul"
            onChange={(e) => setP({ ...p, lineNums: { ...lineNums(p), by: Number(e.target.value) } })}>
            {LINE_NUM_STEPS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select> în {lineNums(p)?.by ?? 1}</label>
        </div>
        <div className="print-row">
          <span className="print-label">Filigran</span>
          <input className="print-area page-hf-input" list="doc-watermarks" value={p.watermark ?? ''} maxLength={40} onChange={(e) => setP({ ...p, watermark: e.target.value })} placeholder="nimic, sau de exemplu: CIORNĂ" aria-label="Filigran" />
          <datalist id="doc-watermarks">{WATERMARKS.map((w) => <option key={w} value={w} />)}</datalist>
          <select value={pageWatermarkColor(p)} onChange={(e) => setP({ ...p, watermarkColor: e.target.value || undefined })} aria-label="Culoarea filigranului" disabled={!p.watermark?.trim()}>
            {WATERMARK_COLORS.map(([c, label]) => <option key={c} value={c}>{label}</option>)}
          </select>
          <select value={pageWatermarkFont(p)} onChange={(e) => setP({ ...p, watermarkFont: e.target.value || undefined })} aria-label="Fontul filigranului" title="Fontul filigranului" disabled={!p.watermark?.trim()}>
            {WATERMARK_FONTS.map(([f, label]) => <option key={f} value={f} style={f ? { fontFamily: f } : undefined}>{label}</option>)}
          </select>
          <label title="Filigranul stă drept, de-a latul paginii, în loc de pe diagonală"><input type="checkbox" checked={!!p.watermarkFlat} disabled={!p.watermark?.trim()}
            onChange={(e) => setP({ ...p, watermarkFlat: e.target.checked || undefined })} aria-label="Filigran orizontal" /> orizontal</label>
        </div>
        <div className="print-row">
          <span className="print-label">Filigran din imagine</span>
          <button type="button" onClick={() => pickWatermarkImage((img) => setP({ ...p, watermarkImage: img }))} title="O poză (.png sau .jpg), decolorată, în mijlocul fiecărei pagini (de exemplu sigla firmei); are întâietate față de filigranul cu text; se păstrează în .docx">🖼 Alege imaginea…</button>
          {pageWatermarkImage(p) && <><img className="wm-thumb" src={pageWatermarkImage(p)} alt="Filigranul din imagine" /><button type="button" onClick={() => setP({ ...p, watermarkImage: undefined })}>Scoate imaginea</button></>}
        </div>
        <div className="print-row">
          <span className="print-label">Imagine în antet</span>
          <button type="button" onClick={() => pickWatermarkImage((img) => setP({ ...p, headerImage: img }), 'Imagine în antet')} title="O poză (.png sau .jpg), de exemplu sigla firmei, mică, în stânga antetului, pe fiecare pagină; se păstrează în .docx și în PDF">🖼 Alege imaginea…</button>
          {pageHeaderImage(p) && <><img className="wm-thumb" src={pageHeaderImage(p)} alt="Imaginea din antet" /><button type="button" onClick={() => setP({ ...p, headerImage: undefined })}>Scoate imaginea</button></>}
        </div>
        <div className="print-row">
          <span className="print-label">Culoare pagină</span>
          <select value={pageBackground(p)} onChange={(e) => setP({ ...p, background: e.target.value || undefined })} aria-label="Culoarea paginii">
            {[...PAGE_COLORS, ...(pageBackground(p) && !PAGE_COLORS.some(([c]) => c === pageBackground(p)) ? [[pageBackground(p), 'Din fișier']] : [])].map(([c, name]) => (
              <option key={c} value={c}>{name}</option>
            ))}
          </select>
          {pageBackground(p) && <span className="page-color-swatch" style={{ background: pageBackground(p) }} aria-hidden="true" />}
        </div>
        <div className="print-row">
          <span className="print-label">Chenar pagină</span>
          <select value={pageBorder(p)} onChange={(e) => setP({ ...p, border: (e.target.value || undefined) as PageBorder | undefined })} aria-label="Chenarul paginii" title="Chenar în jurul fiecărei pagini (la PDF, tipărire, .docx și .odt)">
            {PAGE_BORDERS.map(([k, name]) => <option key={k || 'none'} value={k}>{name}</option>)}
          </select>
        </div>
        <div className="print-row">
          <span className="print-label">Antet (sus)</span>
          <input className="print-area page-hf-input" autoFocus={!focus} aria-label="Antet (sus)" value={p.header} maxLength={200} onChange={(e) => setP({ ...p, header: e.target.value })} placeholder="de exemplu: SC Exemplu SRL · Contract nr. 12" />
        </div>
        <div className="print-row">
          <span className="print-label">Subsol (jos)</span>
          <input className="print-area page-hf-input" aria-label="Subsol (jos)" value={p.footer} maxLength={200} onChange={(e) => setP({ ...p, footer: e.target.value })} placeholder="de exemplu: Confidențial" />
        </div>
        <div className="print-row page-hf-fields">
          <span className="print-label">Câmpuri</span>
          <span>
            {HF_FIELDS.map(([tok, what]) => (
              <span key={tok} className="page-hf-field">
                <button onClick={() => setP({ ...p, header: (p.header.trim() ? p.header.trimEnd() + ' · ' : '') + tok })} title={`Pune în antet: ${what}`}>{tok} ↑</button>
                <button onClick={() => setP({ ...p, footer: (p.footer.trim() ? p.footer.trimEnd() + ' · ' : '') + tok })} title={`Pune în subsol: ${what}`}>↓</button>
              </span>
            ))}
          </span>
        </div>
        <div className="print-row">
          <span className="print-label">Pagini</span>
          <label><input type="checkbox" checked={p.numbers} onChange={(e) => setP({ ...p, numbers: e.target.checked })} /> Numerotează paginile</label>
        </div>
        {p.numbers && (
          <div className="print-row">
            <span className="print-label">Numărul</span>
            <select aria-label="Locul numărului paginii" value={pageNumAt(p)} onChange={(e) => setP({ ...p, numAt: e.target.value === 'br' ? undefined : e.target.value as NumAt })}>
              {NUM_ATS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
            <select aria-label="Forma numărului paginii" value={pageNumStyle(p)} onChange={(e) => setP({ ...p, numStyle: e.target.value === 'full' ? undefined : e.target.value as NumStyle })}>
              {NUM_STYLES.map(([k, label]) => <option key={k} value={k}>„{label}”</option>)}
            </select>
          </div>
        )}
        <div className="print-row">
          <span className="print-label">Prima pagină</span>
          <label title="De exemplu o copertă fără antet și fără număr de pagină"><input type="checkbox" aria-label="Prima pagină diferită" checked={!!pageFirst(p)} onChange={(e) => setP({ ...p, firstPage: e.target.checked ? { header: '', footer: '', numbers: false } : undefined })} /> Diferită (de obicei fără antet, subsol și număr: copertă)</label>
        </div>
        {pageFirst(p) && (
          <>
            <div className="print-row">
              <span className="print-label">Antet pagina 1</span>
              <input className="print-area page-hf-input" aria-label="Antetul primei pagini" value={pageFirst(p)!.header} maxLength={200} onChange={(e) => setP({ ...p, firstPage: { ...pageFirst(p)!, header: e.target.value } })} placeholder="gol: fără antet pe prima pagină" />
            </div>
            <div className="print-row">
              <span className="print-label">Subsol pagina 1</span>
              <input className="print-area page-hf-input" aria-label="Subsolul primei pagini" value={pageFirst(p)!.footer} maxLength={200} onChange={(e) => setP({ ...p, firstPage: { ...pageFirst(p)!, footer: e.target.value } })} placeholder="gol: fără subsol pe prima pagină" />
            </div>
            <div className="print-row">
              <span className="print-label" />
              <label><input type="checkbox" aria-label="Număr pe prima pagină" checked={pageFirst(p)!.numbers} onChange={(e) => setP({ ...p, firstPage: { ...pageFirst(p)!, numbers: e.target.checked } })} /> Și numărul paginii pe prima pagină</label>
            </div>
          </>
        )}
        <div className="print-row">
          <span className="print-label">Paginile pare</span>
          <label title="De exemplu la o carte tipărită față-verso: titlul cărții pe paginile pare, capitolul pe cele impare"><input type="checkbox" aria-label="Pagini pare diferite" checked={!!pageEven(p)} onChange={(e) => setP({ ...p, evenPage: e.target.checked ? { header: p.header, footer: p.footer } : undefined })} /> Diferite (antet și subsol separate pe paginile 2, 4, 6…)</label>
        </div>
        {pageEven(p) && (
          <>
            <div className="print-row">
              <span className="print-label">Antet pagini pare</span>
              <input className="print-area page-hf-input" aria-label="Antetul paginilor pare" value={pageEven(p)!.header} maxLength={200} onChange={(e) => setP({ ...p, evenPage: { ...pageEven(p)!, header: e.target.value } })} placeholder="gol: fără antet pe paginile pare" />
            </div>
            <div className="print-row">
              <span className="print-label">Subsol pagini pare</span>
              <input className="print-area page-hf-input" aria-label="Subsolul paginilor pare" value={pageEven(p)!.footer} maxLength={200} onChange={(e) => setP({ ...p, evenPage: { ...pageEven(p)!, footer: e.target.value } })} placeholder="gol: fără subsol pe paginile pare" />
            </div>
          </>
        )}
        <p className="print-info">Antetul, subsolul și numerele apar pe fiecare pagină la Export PDF, Tipărește și Export .docx. Prima pagină diferită și paginile pare diferite se văd la Export PDF, .docx și .odt (la Tipărește direct, toate paginile au antetul obișnuit: pentru copertă sau față-verso tipărește PDF-ul). Coloanele (ca la ziare și pliante), filigranul și culoarea paginii se aplică întregului document. Culoarea paginii se vede pe ecran și în .docx; la tipărire și PDF pagina rămâne albă.</p>
        <div className="print-actions">
          <button onClick={onClose}>Închide</button>
          <button onClick={() => onSave({ ...p, header: '', footer: '', numbers: false, firstPage: undefined })}>Fără antet și subsol</button>
          <button className="primary" onClick={() => onSave(p)}>Gata (Enter)</button>
        </div>
      </div>
    </div>
  );
}

function LinkDialog({ initial, bookmarks, onSave, onClose }: { initial: string; bookmarks: string[]; onSave(href: string | null): void; onClose(): void }) {
  const [raw, setRaw] = useState(initial.replace(/^mailto:/i, ''));
  const href = normalizeHref(raw);
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg" role="dialog" aria-label="Legătură" onKeyDown={(e) => {
        if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        else if (e.key === 'Enter' && href) { e.preventDefault(); onSave(href); }
      }}>
        <h3>Legătură</h3>
        <div className="print-row">
          <span className="print-label">Adresa</span>
          <input className="print-area page-hf-input" autoFocus value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="www.exemplu.ro sau nume@firma.ro" aria-label="Adresa legăturii" />
        </div>
        {bookmarks.length > 0 && (
          <div className="print-row">
            <span className="print-label">Sau un loc din document</span>
            <select className="size-select" aria-label="Semn de carte" value={raw.startsWith('#') && bookmarks.includes(raw.slice(1)) ? raw.slice(1) : ''}
              onChange={(e) => setRaw(e.target.value ? '#' + e.target.value : '')}>
              <option value="">— semn de carte —</option>
              {bookmarks.map((b) => <option key={b} value={b}>🔖 {b}</option>)}
            </select>
          </div>
        )}
        <p className="print-info">{raw && !href ? 'Scrie o adresă web (www.exemplu.ro), de e-mail sau alege un semn de carte.' : 'Se aplică pe textul ales; fără text ales, adresa se scrie în document.'}</p>
        <div className="print-actions">
          <button onClick={onClose}>Închide</button>
          {initial && <button onClick={() => onSave(null)}>Elimină legătura</button>}
          <button className="primary" disabled={!href} onClick={() => href && onSave(href)}>Gata (Enter)</button>
        </div>
      </div>
    </div>
  );
}

function SumDialog({ onInsert, onClose }: { onInsert(text: string): void; onClose(): void }) {
  const [raw, setRaw] = useState('');
  const n = parseAmount(raw);
  const words = n === null ? null : amountWords(n);
  const both = n === null ? '' : `${n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lei (${words})`;
  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg" role="dialog" aria-label="Sumă în litere" onKeyDown={(e) => {
        if (e.key === 'Escape') { e.preventDefault(); onClose(); }
        else if (e.key === 'Enter' && words) { e.preventDefault(); onInsert(both); }
      }}>
        <h3>Sumă în litere</h3>
        <div className="print-row">
          <span className="print-label">Suma (lei)</span>
          <input className="print-area sum-input" autoFocus value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="1.250,50" />
        </div>
        <p className="print-info">{raw ? (words ?? 'Scrie un număr, de exemplu 1.250,50') : 'Scrie suma; textul în litere apare aici.'}</p>
        <div className="print-actions">
          <button onClick={onClose}>Închide</button>
          <button disabled={!words} onClick={() => words && onInsert(words)}>Doar în litere</button>
          <button className="primary" disabled={!words} onClick={() => words && onInsert(both)}>Inserează (Enter)</button>
        </div>
      </div>
    </div>
  );
}

function SearchBar({ editor, mode, setMode }: {
  editor: Editor; mode: 'find' | 'replace'; setMode(m: 'find' | 'replace' | null): void;
}) {
  const [term, setTerm] = useState(() => getSearch(editor.state).term);
  const [repl, setRepl] = useState('');
  const [caseSensitive, setCase] = useState(false);
  // Căutarea avansată (⚙): doar cuvinte întregi și semnele de înlocuire * și ?.
  const [wholeWord, setWhole] = useState(false);
  const [wildcards, setWild] = useState(false);
  const [format, setFormat] = useState('');
  const [more, setMore] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const s = getSearch(editor.state);

  useEffect(() => { input.current?.focus(); input.current?.select(); }, [mode]);
  useEffect(() => { editor.commands.setSearch(term, caseSensitive, { wholeWord, wildcards, format }); }, [editor, term, caseSensitive, wholeWord, wildcards, format]);
  // La închidere, ștergem evidențierile.
  useEffect(() => () => { editor.commands.setSearch(''); }, [editor]);

  const close = () => { setMode(null); editor.commands.focus(); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') close();
    else if (e.key === 'Enter') { e.preventDefault(); editor.commands.findNext(e.shiftKey ? -1 : 1); }
  };

  return (
    <div className="searchbar" onKeyDown={onKey}>
      <input ref={input} value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Caută în document" />
      <span className="muted search-count">
        {term ? (s.matches.length ? `${s.current + 1} din ${s.matches.length}` : 'Nimic găsit') : ''}
      </span>
      <button className="fmt" onClick={() => editor.commands.findNext(-1)} title="Anterior (Shift+Enter)">↑</button>
      <button className="fmt" onClick={() => editor.commands.findNext(1)} title="Următor (Enter)">↓</button>
      <label className="search-case" title="Ține cont de literele mari și mici">
        <input type="checkbox" checked={caseSensitive} onChange={(e) => setCase(e.target.checked)} /> Aa
      </label>
      <button className={`fmt${more || wholeWord || wildcards || format ? ' on' : ''}`} onClick={() => setMore((v) => !v)} aria-expanded={more}
        title="Căutare avansată: doar cuvinte întregi, semnele * și ?, doar textul cu o anumită formatare">⚙</button>
      {more && (
        <span className="search-more">
          <label className="search-case" title="„mare” nu găsește „marea” sau „amare”">
            <input type="checkbox" checked={wholeWord} onChange={(e) => setWhole(e.target.checked)} /> Cuvinte întregi
          </label>
          <label className="search-case" title="? ține locul unei litere, * al oricâtor litere: „c?r” găsește „car” și „cor”, „în*re” găsește „între” și „încercare”">
            <input type="checkbox" checked={wildcards} onChange={(e) => setWild(e.target.checked)} /> Semne * și ?
          </label>
          <select className="fmt" value={format} onChange={(e) => setFormat(e.target.value)} aria-label="Formatarea textului căutat" title="Doar textul cu această formatare">
            <option value="">Orice formatare</option>
            <option value="bold">Doar aldin</option>
            <option value="italic">Doar cursiv</option>
            <option value="underline">Doar subliniat</option>
            <option value="strike">Doar tăiat</option>
            <option value="highlight">Doar evidențiat</option>
            <option value="link">Doar legături</option>
          </select>
        </span>
      )}
      {mode === 'replace' ? (
        <>
          <span className="sep" />
          <input value={repl} onChange={(e) => setRepl(e.target.value)} placeholder="Înlocuiește cu" />
          <button className="fmt" onClick={() => editor.commands.replaceCurrent(repl)} disabled={!s.matches.length}>Înlocuiește</button>
          <button className="fmt" onClick={() => editor.commands.replaceAll(repl)} disabled={!s.matches.length}>Înlocuiește tot</button>
        </>
      ) : (
        <button className="fmt" onClick={() => setMode('replace')}>Înlocuire…</button>
      )}
      <button className="fmt search-close" onClick={close} title="Închide (Esc)">✕</button>
    </div>
  );
}

const FONTS: [string, string][] = [
  ['Font implicit', ''],
  ['Segoe UI', 'Segoe UI'],
  ['Arial', 'Arial'],
  ['Calibri', 'Calibri'],
  ['Cambria', 'Cambria'],
  ['Georgia', 'Georgia'],
  ['Times New Roman', 'Times New Roman'],
  ['Verdana', 'Verdana'],
  ['Courier New', 'Courier New'],
];

const SIZES = WORD_SIZES;

// Imaginea se păstrează în document, ca fișierul să fie complet și portabil.
async function insertScreenshot(editor: Editor) {
  const b = await captureScreen();
  if (b) await insertImageFiles(editor, [new File([b], 'captura.png', { type: 'image/png' })]);
  else editor.commands.focus();
}

// ✏ Desen: schița făcută de mână intră la cursor ca o poză obișnuită (se mută, se mărește, ajunge în .docx / PDF).
// Un desen care e o singură formă îndreptată cu ◇ În formă intră ca formă adevărată (Ink to Shape): se recolorează din bara ei.
async function insertSketch(editor: Editor) {
  const r = await drawSketchEx();
  const sh = r?.shape;
  // Dacă e aleasă o poză (de exemplu desenul de dinainte), desenul nou se pune după ea, nu în locul ei.
  const sel = editor.state.selection;
  const at = sel instanceof PmNodeSelection ? sel.to : undefined;
  if (sh) {
    const spec = { k: sh.k, fill: '', stroke: sh.stroke, sw: sh.sw };
    const name = SHAPES.find((s) => s.k === sh.k)?.name ?? '';
    const src = await shapeToPng(spec, sh.w, sh.h);
    const node = { type: 'image', attrs: { src, alt: `Formă: ${name.toLowerCase()}`, width: sh.w, align: 'center', shape: JSON.stringify(spec) } };
    if (at !== undefined) editor.chain().focus().insertContentAt(at, node).run();
    else editor.chain().focus().insertContent(node).run();
  } else if (r) await insertImageFiles(editor, [new File([r.blob], 'desen.png', { type: 'image/png' })], at);
  else editor.commands.focus();
}

// Lista verticală: variantele scrise despărțite prin „;”.
async function insertDropList(editor: Editor) {
  const t = await askText('Listă verticală', 'Variantele listei, despărțite prin punct și virgulă (;), de exemplu: Da; Nu; Poate', '');
  const items = parseDropItems(t ?? '');
  if (items.length) editor.chain().focus().insertFormDrop(items).run();
  else editor.commands.focus();
}

// Filigranul din imagine: o poză PNG sau JPEG citită ca data: URL (cele prea mari sunt refuzate cu un mesaj).
function pickWatermarkImage(done: (img: string) => void, title = 'Filigran din imagine') {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg';
  input.onchange = () => {
    const f = input.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const img = pageWatermarkImage({ watermarkImage: String(r.result ?? '').replace('data:image/jpg;', 'data:image/jpeg;') } as PageSetup);
      if (img) done(img);
      else void ask(title, 'Alege o poză .png sau .jpg de cel mult 2 MB (de exemplu sigla firmei).', ['Bine']);
    };
    r.readAsDataURL(f);
  };
  input.click();
}

// Codul QR intră ca o poză obișnuită (se poate muta, mări, exporta în .docx / PDF).
async function insertQr(editor: Editor) {
  const text = await askText('Cod QR', 'Scrie adresa web sau textul din cod (de exemplu https://… , un număr de telefon, un IBAN). Se citește cu camera telefonului.', 'https://');
  if (!text?.trim()) { editor.commands.focus(); return; }
  const q = makeQr(text.trim(), 'M');
  if (!q) { await ask('Text prea lung', 'Un cod QR poate avea aici cel mult ~210 caractere (literele cu diacritice contează dublu). Scurtează textul.', ['Bine']); editor.commands.focus(); return; }
  const b = await qrPng(q, Math.max(3, Math.round(240 / (q.size + 8))));
  await insertImageFiles(editor, [new File([b], 'cod-qr.png', { type: 'image/png' })]);
}

// ▶ Video online: coperta clipului (poza lui, ▶ și titlul) ca poză, iar sub ea legătura spre clip, care se deschide în browser.
async function insertOnlineVideo(editor: Editor) {
  const text = await askText('Video online', 'Lipește adresa clipului (de pe un site video). Intră în document coperta clipului și legătura spre el; clipul pornește în browser.', 'https://');
  if (!text?.trim()) { editor.commands.focus(); return; }
  const { videoCover } = await import('../onlineVideo');
  let v;
  try { v = await videoCover(text); } catch (e) {
    await ask('Video online', (e as Error).message || 'Pagina nu răspunde. Verifică adresa și legătura la internet.', ['Bine']); editor.commands.focus(); return;
  }
  await insertImageFiles(editor, [new File([v.blob], 'video.jpg', { type: 'image/jpeg' })], undefined, 480);
  // Poza abia pusă rămâne selectată: legătura merge după ea, nu în locul ei.
  editor.chain().focus().setTextSelection(editor.state.selection.to).insertContent({ type: 'paragraph', content: [{ type: 'text', text: '▶ ' + v.title, marks: [{ type: 'link', attrs: { href: v.href } }] }] }).run();
}

function insertImage(editor: Editor) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/png,image/jpeg,image/gif,image/webp';
  input.multiple = true;
  input.onchange = () => insertImageFiles(editor, imageFilesFrom(input.files));
  input.click();
}

/** Buton mic din fila Revizuire (păstrează selecția din document la clic; se poate opri). */
function RvBtn({ on, active, disabled, title, children }: { on(): void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode }) {
  return <button className={`fmt ${active ? 'active' : ''}`} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={on} title={title}>{children}</button>;
}
