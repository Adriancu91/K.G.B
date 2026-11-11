// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Notițe v2: toate notițele într-un caiet salvat singur, cu listă în stânga și căutare instant (și fără diacritice).
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { api, BinaryFile, OpenedFile, type FileKind, type WindowState } from '../api';
import type { LinkPreview, SheetLink } from './store';
import Model3DDialog, { type Model3DSource } from '../Model3DDialog';
import { cleanM3d, keepModel, keptModel, type Model3DKeep } from '../model3d';
import { NOTE_MODEL3D_MAX } from './store';

/** Modelul 3D ținut în locul schemei de lângă o poză ({"m3d": …}), sau null. */
function modelOf(slot: string): Model3DKeep | null {
  try { const o = JSON.parse(slot); return (o && typeof o === 'object' && cleanM3d(o.m3d)) || null; } catch { return null; }
}
import { parseNote, safeFileName } from './format';
import { noteToMarkdown, notesToMarkdown } from './markdown';
import { importKeep } from './keep';
import { importEnex } from './enex';
import { importDocx } from './onenote';
import { noteEquations, noteToDoc } from './todoc';
import EquationDialog from '../docs/EquationDialog';
import DiagramDialog from '../docs/DiagramDialog';
import IconsDialog from '../icons/IconsDialog';
import { DIAGRAM_W, diagramAlt, diagramSvg, newDiagram, parseDiagram, type DocDiagram } from '../docs/diagram';
import { svgToPng } from '../sheets/chartSvg';
import { noteToSheet, sheetRows } from './tosheet';
import { imageFiles, MAX_IMAGES, shrinkImage } from './images';
import { allTags, backlinks, COLORS, dueToday, findByTitle, linksOf, emptyStore, newNote, duplicateNote, Note, NoteStore, parseStore, plain, search, inView, sectionsOf, sectionsIn, booksOf, setSectionGroup, splitSectionPath, sectionPath, renameGroup, sectionTree, inBook, addBook, renameBook, removeBook, moveToBook, setBookColor, MAIN_BOOK, addSection, renameSection, removeSection, setSectionColor, tagSummary, findAll, matchesKind, KINDS, remindTimes, REPEATS, Repeat, trashNote, restoreNote, purgeNote, TRASH_DAYS, retag, cleanTag, tagsOf, sortNotes, moveNote, SortMode, SORT_LABELS, IMAGE_SIZES, ImageSize, NOTE_PAPERS, NotePaper, webHref, webLinkAt, webLinksOf, unreadPhotos, isEmpty, NoteFile, serializeStore, shownTitle, snippet, cardText, when } from './store';
import VersionsDialog from '../Versions';
import ZoomControl, { useZoom } from '../ZoomControl';
import { nextZoom } from '../zoom';
import SymbolPicker from '../docs/SymbolPicker';
import { packInk, unpackInk, type Ink } from './ink';
import DrawDialog, { COLORS as DRAW_COLORS, SIZES as DRAW_SIZES, TOOLS as DRAW_TOOLS, PAPERS as DRAW_PAPERS, type DrawStart, type Paper as DrawPaper, type Tool as DrawTool } from './Draw';
const DRAW_SHAPES: DrawTool[] = ['line', 'rect', 'ellipse'];
import Reader from './Reader';
import Canvas from './Canvas';
import { makeBox } from './freeCanvas';
import CropDialog, { rotateImage } from './Crop';
import { TEMPLATES } from './templates';
import { htmlImageSources, htmlToNoteText } from './htmlpaste';
import { noteToHtml } from './tohtml';
import { extractDataImages, htmlToMht } from './tomht';
import { applyIcsTasks, noteTasksIcs, parseIcsTasks } from './tasks';
import { noteMailText, noteMailto } from './mail';
import { BACKGROUNDS, backgroundImage } from './backgrounds';
import { clock, isAudio, isVideoName, MAX_RECORD_MIN, MAX_VIDEO_MIN, recordingName, startRecording, videoName, Recording } from './record';
import { deriveKey, newSalt, OpenSecret, seal, sealData, SecretPayload, unseal, unsealData } from './secret';
import { tableAt, tableOp, TableOp } from './table';
import { wrapEdit, headingEdit, paraStyleEdit, PARA_STYLES, clearEdit, tableText, Wrap, colorEdit, INK_COLORS, INK_SIZES, INK_FONTS, styleEdit, fontCss, alignEdit, equationAt, equationMark } from './inline';
import { captureScreen } from '../screenshot';
import { checkNote, type NoteIssue } from './a11y';
import { checkGrammar } from '../grammar';
import { childrenOf, indentTarget, MAX_DEPTH, nestNotes, outdentParent } from './pages';
import { ClipboardGroup } from '../ribbon/Clipboard';
import { apply as applyEdit, applyChecked, LINE_MARKS, toggleMark, unmarkEdit, clickBox, boxAt, moveItemEdit, dateStamp, DONE, enterInList, indentList, insertAtCursor, insertLink, progress, toggleBullets, toggleList, moveLines } from './checklist';
import './notes.css';
import DiacriticsDialog from '../DiacriticsDialog';
import { applyDiacritics } from '../diacritics';
import Ribbon, { RGroup, RMore } from '../ribbon/Ribbon';
import MiniBar from '../ribbon/MiniBar';
import { useArrange } from '../ribbon/Arrange';
import { useContextMenu, type CtxItem } from '../ribbon/contextMenu';
import { isCurrent } from '../active';
import { askYes } from '../ask';
import { canOpenBytes, FILE_SAVED, isRisky, openBytes, openPath, samePath, type FileSaved } from '../fileKinds';
import { LiveBody } from './LiveBody';
import type { SheetSrc, SheetTable } from './sheetTable';

/** După cât timp fără activitate se închide singură o notiță blocată deschisă (5 minute). */
const AUTO_LOCK_MS = 5 * 60_000;
const AUTOSAVE_MS = 700;
/** Cel mult atâtea PDF-uri pe notiță și atâția MB pe fiecare. */
const MAX_FILES = 20;
const MAX_FILE_MB = 100;
const sizeLabel = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toLocaleString('ro-RO', { maximumFractionDigits: 1 })} MB`);
/** Ultima cerere de notiță nouă îndeplinită (vezi `newNote`). */
let handledNewNote = 0;

interface Props {
  initial: OpenedFile | null;
  onConsumed(): void;
  /** Crește la fiecare cerere de notiță nouă venită din afară (Ctrl+Alt+N, butonul de pe Acasă). */
  newNote?: number;
  /** Notița de deschis (click pe notificarea unui memento). */
  openId?: string | null;
  onOpened?(): void;
  /** Deschide un PDF atașat în modulul PDF. */
  onOpenPdf?(f: BinaryFile): void;
  /** Deschide notița ca document nou în Docs. */
  onOpenDoc?(f: OpenedFile): void;
  /** Deschide lista notiței ca tabel nou în Sheets. */
  onOpenSheet?(f: OpenedFile): void;
}

/** Textul cu cuvintele căutate evidențiate (potrivirea e fără diacritice și fără litere mari). */
function Hl({ text, query }: { text: string; query: string }) {
  const words = plain(query).split(/\s+/).filter(Boolean);
  if (!words.length) return <>{text}</>;
  const p = plain(text);
  const on = new Uint8Array(text.length);
  for (const w of words) for (let i = p.indexOf(w); i >= 0; i = p.indexOf(w, i + 1)) on.fill(1, i, i + w.length);
  const parts: { s: string; hit: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const hit = !!on[i];
    if (parts.length && parts[parts.length - 1].hit === hit) parts[parts.length - 1].s += text[i];
    else parts.push({ s: text[i], hit });
  }
  return <>{parts.map((x, i) => (x.hit ? <mark key={i}>{x.s}</mark> : <Fragment key={i}>{x.s}</Fragment>))}</>;
}

/** Semnul din fața valorilor „Copiază în” din listele 📂 / 📓: un Tab (numele secțiunilor și caietelor nu pot avea Tab). */
const COPY = String.fromCharCode(9);

export default function Notes({ initial, onConsumed, newNote: newNoteReq = 0, openId, onOpened, onOpenPdf, onOpenDoc, onOpenSheet }: Props) {
  // Profilul de meniu (▦ Aranjare): panglica sau meniurile clasice.
  const arrange = useArrange('notes', 'note');
  const [store, setStore] = useState<NoteStore | null>(null);
  const [storePath, setStorePath] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [navShut, setNavShut] = useState(() => { try { return localStorage.getItem('suite.notes.navShut') === '1'; } catch { return false; } });
  useEffect(() => { try { localStorage.setItem('suite.notes.navShut', navShut ? '1' : '0'); } catch { /* fără stocare */ } }, [navShut]);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState('');
  const [status, setStatus] = useState('');
  const [verDlg, setVerDlg] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  // Poza aleasă cu un clic: apare fila contextuală Poză (dublu clic o mărește).
  const [picked, setPicked] = useState<number | null>(null);
  // true: desen nou; un număr: desen peste poza cu acel număr din notiță.
  const [drawing, setDrawing] = useState<boolean | number>(false);
  /** Pânza se deschide pentru ▶ Reluare (desenul pus în notiță se redesenează linie cu linie). */
  const [replayInk, setReplayInk] = useState(false);
  // Stiloul din fila Desenare (unealta, culoarea, grosimea, foaia), ținut minte; pânza pornește cu el.
  const [pen, setPen] = useState<Required<DrawStart>>(() => {
    const d: Required<DrawStart> = { tool: 'pen', color: DRAW_COLORS[0][0], size: DRAW_SIZES[0][0], paper: 'blank' };
    try { return { ...d, ...JSON.parse(localStorage.getItem('suite.notes.pen') || '{}') }; } catch { return d; }
  });
  const setPenWith = (p: DrawStart) => setPen((o) => { const n = { ...o, ...p }; try { localStorage.setItem('suite.notes.pen', JSON.stringify(n)); } catch { /* fără loc */ } return n; });
  const openDraw = (p: DrawStart) => { setPenWith(p); setDrawing(true); };
  const [reader, setReader] = useState(false);
  const [cropping, setCropping] = useState<number | null>(null);
  const dirty = useRef(false);
  const timer = useRef<number>();
  const latest = useRef<NoteStore | null>(null);
  /** Caietul de pe disc nu s-a putut citi: nu scriem peste el până nu readuci o versiune. */
  const blocked = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  // Tragerea unui element de bifat de căsuța lui (ca în Keep): clicul de după tragere nu mai bifează.
  const skipBoxClick = useRef(false);
  const startItemDrag = (t: HTMLTextAreaElement) => {
    let from = -1;
    let released = false;
    window.addEventListener('mouseup', () => {
      released = true;
      t.classList.remove('note-drag');
      if (from < 0) return;
      // Selecția făcută de tragere se termină pe rândul de sub mouse.
      const to = t.selectionDirection === 'backward' ? t.selectionStart : t.selectionEnd;
      if (applyEdit(t, moveItemEdit(t.value, from, to))) {
        skipBoxClick.current = true;
        setTimeout(() => { skipBoxClick.current = false; }, 0);
      }
    }, { once: true });
    // Cursorul e pus de browser după apăsare, deci îl citim imediat după.
    setTimeout(() => {
      const p = t.selectionStart;
      if (released || p !== t.selectionEnd || boxAt(t.value, p) < 0) return;
      from = p;
      t.classList.add('note-drag');
    }, 0);
  };
  // ♿ Verifică accesibilitatea: lista problemelor notiței deschise (null = panoul închis).
  const [a11y, setA11y] = useState<NoteIssue[] | null>(null);
  // Revizuire › ✓ Gramatică: panoul cu greșelile din textul notiței (la zi cu ce scrii); textele ignorate nu se mai arată.
  const [gramOn, setGramOn] = useState(false);
  const [gramIgnored, setGramIgnored] = useState<string[]>([]);
  // Revizuire › Diacritice: textul selectat din notiță (null = toată notița, cu titlu); undefined = fereastra închisă.
  const [diaSel, setDiaSel] = useState<[number, number] | null | undefined>(undefined);
  // Câmpul de scris ca stare: mini-bara are nevoie de el după ce apare pe ecran.
  const [bodyEl, setBodyEl] = useState<HTMLTextAreaElement | null>(null);
  useEffect(() => { if (bodyRef.current !== bodyEl) setBodyEl(bodyRef.current); });
  const wrapBody = (m: Wrap) => { const t = bodyRef.current; if (t) applyEdit(t, wrapEdit(t.value, t.selectionStart, t.selectionEnd, m)); };
  // Cursorul e într-un tabel din câmpul de scris: apare bara de tabel (rânduri, coloane, sortare).
  const [inTable, setInTable] = useState(false);
  const checkTable = (t: HTMLTextAreaElement) => { const v = !!tableAt(t.value, t.selectionStart); if (v !== inTable) setInTable(v); };
  const runTable = (op: TableOp) => { const t = bodyRef.current; if (!t) return false; const e = tableOp(t.value, t.selectionStart, op); if (!e) return false; applyEdit(t, e); checkTable(t); return true; };
  // Ecuația: fereastra din Docs; dacă cursorul e într-un {ecuație:…}, o deschide pe aceea și o înlocuiește.
  // Inserare → ◇ Schemă: fereastra de scheme din Docs; schema intră în notiță ca poză, cu elementele ei ca text de căutare.
  // false = închisă, true = schemă nouă, un număr = schimbarea schemei din poza cu acel număr.
  const [diagramOpen, setDiagramOpen] = useState<boolean | number>(false);
  // Inserare → ☺ Pictograme: cele alese intră în notiță ca poze, cu numele lor ca text de căutare.
  const [iconsOpen, setIconsOpen] = useState(false);
  /** Fereastra Model 3D: true = model nou, un număr = rotirea din nou a modelului din poza aceea. */
  const [model3dOpen, setModel3dOpen] = useState<boolean | number>(false);
  const [eqEdit, setEqEdit] = useState<{ from: number; to: number; src: string } | null>(null);
  const openEquation = () => {
    const t = bodyRef.current; if (!t) return;
    const hit = equationAt(t.value, t.selectionStart);
    setEqEdit(hit ?? { from: t.selectionStart, to: t.selectionEnd, src: t.value.slice(t.selectionStart, t.selectionEnd).trim() || 'x = (-b +- sqrt(b^2 - 4ac))/(2a)' });
  };
  const doneEquation = (src: string) => {
    const t = bodyRef.current, e = eqEdit; setEqEdit(null);
    if (!t || !e) return;
    const mark = equationMark(src);
    applyEdit(t, { from: e.from, to: e.to, text: mark, caret: e.from + mark.length });
  };
  const toDoc = async (n: Note) => {
    const { equationToPng } = await import('../docs/equation');
    const pngs = new Map<string, { src: string; w: number }>();
    for (const src of noteEquations(n)) { try { const r = await equationToPng({ src }); pngs.set(src, { src: r.src, w: r.w }); } catch { /* rămâne ca text */ } }
    return noteToDoc(n, pngs);
  };
  const insertTable = (cols: number, rows: number) => { const t = bodyRef.current; if (!t) return; const at = t.selectionStart; const before = at > 0 && t.value[at - 1] !== String.fromCharCode(10) ? String.fromCharCode(10) : ''; insertAtCursor(t, before + tableText(cols, rows) + String.fromCharCode(10)); };
  // Zoom-ul textului (titlu și notiță), ca în OneNote; pozele și lista rămân la fel. Ctrl + rotița peste notiță.
  const mainRef = useRef<HTMLElement>(null);
  const [textZoom, setTextZoom] = useZoom('suite.notes.zoom', mainRef);
  // Fereastra lipită pe marginea ecranului / mereu deasupra (fila Vizualizare → Fereastră).
  const [winSt, setWinSt] = useState<WindowState>({ docked: false, onTop: false });
  useEffect(() => { api.windowState?.().then((s) => { if (s) setWinSt({ docked: s.docked, onTop: s.onTop }); }).catch(() => {}); }, []);
  const toggleDock = async () => {
    const s = await api.dockWindow?.(!winSt.docked).catch(() => null);
    if (!s) return;
    setWinSt(s);
    setStatus(s.docked ? 'Fereastra e lipită pe marginea din dreapta, mereu deasupra. Încă un clic pe 📌 o pune înapoi.' : 'Fereastra e înapoi unde era.');
  };
  const toggleOnTop = async () => {
    const s = await api.setOnTop?.(!winSt.onTop).catch(() => null);
    if (s) setWinSt(s);
  };
  latest.current = store;

  useEffect(() => {
    let alive = true;
    api.loadNotes().then(({ path, content }) => {
      if (!alive) return;
      setStorePath(path);
      if (content === null) { setStore(emptyStore()); return; }
      try {
        // Notițele lăsate goale (de exemplu la ieșirea din modul) nu mai apar.
        const read = parseStore(content);
        const s = { ...read, notes: read.notes.filter((n) => !isEmpty(n)) };
        setStore(s);
        setSel(inView(s.notes, false, '')[0]?.id ?? null);
      } catch {
        // Nu scriem peste un caiet pe care nu-l putem citi: rămâne așa până îl readuci din Versiuni.
        blocked.current = true;
        setLoadError(`Caietul de notițe (${path}) nu a putut fi citit. Nu l-am modificat; poți aduce o variantă mai veche din Versiuni.`);
        setStore(emptyStore());
      }
    }, () => { if (alive) setLoadError('Caietul de notițe nu a putut fi deschis.'); });
    return () => { alive = false; };
  }, []);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    if (!dirty.current || !latest.current || blocked.current) return;
    dirty.current = false;
    try {
      await api.saveNotes(serializeStore(latest.current));
      setStatus(`Salvat la ${new Date().toLocaleTimeString('ro-RO')}`);
    } catch {
      dirty.current = true;
      setStatus('Nu s-a putut salva caietul de notițe!');
    }
  }, []);

  // Salvare automată, la scurt timp după ultima tastă; și la ieșirea din modul.
  useEffect(() => () => { flush(); }, [flush]);
  // Anulare / refacere pentru tot caietul (ștergeri, mutări, culori, bife, secțiuni, caiete…): Ctrl+Z / Ctrl+Y în afara câmpurilor
  // de scris (acolo rămâne anularea textului). Schimbările făcute una după alta, la mai puțin de o secundă, se anulează împreună.
  const undoPast = useRef<NoteStore[]>([]);
  const undoFuture = useRef<NoteStore[]>([]);
  const lastPush = useRef(0);
  const [undoN, setUndoN] = useState(0);
  const change = (fn: (s: NoteStore) => NoteStore) => {
    const before = latest.current;
    const now = Date.now();
    if (before && now - lastPush.current > 1000) {
      undoPast.current.push(before);
      if (undoPast.current.length > 50) undoPast.current.shift();
      undoFuture.current = [];
      setUndoN((x) => x + 1);
    }
    if (before) lastPush.current = now;
    setStore((s) => (s ? fn(s) : s));
    dirty.current = true;
    setStatus('Se salvează…');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, AUTOSAVE_MS);
  };

  const undoStore = (redo: boolean) => {
    const cur = latest.current;
    const s = (redo ? undoFuture : undoPast).current.pop();
    if (!s || !cur) { setStatus(redo ? 'Nu e nimic de refăcut.' : 'Nu e nimic de anulat.'); return; }
    (redo ? undoPast : undoFuture).current.push(cur);
    lastPush.current = 0;
    setStore(s);
    setUndoN((x) => x + 1);
    dirty.current = true;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, AUTOSAVE_MS);
    setStatus(redo ? 'Refăcut (Ctrl+Y).' : 'Anulat (Ctrl+Z). Ctrl+Y reface.');
  };

  // O notiță .snote veche (deschisă din Fișiere recente sau cu Deschide) intră în caiet o singură dată.
  const importFile = useCallback((file: OpenedFile) => {
    try {
      const old = parseNote(file.content);
      const have = latest.current?.notes.find((n) => n.source === file.path);
      if (have) { setSel(have.id); setQuery(''); return; }
      const n = newNote({ title: old.title, body: old.body, source: file.path, ...(old.updatedAt ? { created: old.updatedAt, updated: old.updatedAt } : {}) });
      change((s) => ({ ...s, notes: [...s.notes, n] }));
      setSel(n.id);
      setQuery('');
    } catch (e) {
      alert((e as Error).message);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (initial && store) { importFile(initial); onConsumed(); }
  }, [initial, store, importFile, onConsumed]);

  // După „Notiță nouă”, cursorul merge în titlu (după ce notița apare pe ecran).
  const wantFocus = useRef(false);
  useEffect(() => {
    if (wantFocus.current && titleRef.current) { titleRef.current.focus(); wantFocus.current = false; }
  }, [sel]);

  /** Trece la altă notiță; cea lăsată goală (fără titlu și text) dispare, ca în Google Keep. */
  const select = (id: string | null) => {
    const cur = latest.current?.notes.find((n) => n.id === sel);
    if (id !== sel) { setUnlocked({}); setPwError(''); setPw1(''); }
    if (cur && cur.id !== id && isEmpty(cur)) change((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== cur.id) }));
    setSel(id);
  };

  // Istoricul notițelor deschise (ca Înapoi / Înainte din OneNote și din browser): Alt+← / Alt+→ și butoanele ◀ ▶.
  const hist = useRef<{ back: string[]; fwd: string[]; prev: string | null; nav: boolean }>({ back: [], fwd: [], prev: null, nav: false });
  const [, setHistTick] = useState(0);
  useEffect(() => {
    const h = hist.current;
    if (h.prev && h.prev !== sel && !h.nav) { h.back = [...h.back.filter((x) => x !== h.prev), h.prev].slice(-50); h.fwd = []; }
    h.nav = false;
    h.prev = sel;
    setHistTick((t) => t + 1);
  }, [sel]);
  const exists = (id: string) => !!latest.current?.notes.some((n) => n.id === id);
  const goHistory = (dir: -1 | 1) => {
    const h = hist.current;
    const from = dir < 0 ? h.back : h.fwd, to = dir < 0 ? h.fwd : h.back;
    while (from.length && !exists(from[from.length - 1])) from.pop();
    const id = from.pop();
    if (!id) return;
    if (sel) to.push(sel);
    h.nav = true;
    // Notița poate fi în altă secțiune, în Arhivă sau ascunsă de un filtru: o deschidem oricum.
    select(id);
  };
  const canBack = hist.current.back.some(exists), canFwd = hist.current.fwd.some(exists);

  // Caietele (ca în OneNote): „” = caietul principal. Caietul ales se ține minte.
  const [book, setBookState] = useState(() => { try { return localStorage.getItem('suite.notes.book') ?? ''; } catch { return ''; } });
  const setBook = (b: string) => { setBookState(b); try { localStorage.setItem('suite.notes.book', b); } catch { /* fără memorie locală */ } };
  const books = useMemo(() => (store ? booksOf(store) : ['']), [store]);
  const activeBook = books.includes(book) ? book : '';
  const bookNotes = useMemo(() => (store ? inBook(store.notes, activeBook) : []), [store, activeBook]);
  // Căutarea în toate caietele (doar cât e scris ceva în căutare).
  const [allBooks, setAllBooks] = useState(false);
  // Bulinele de culoare pentru caietul principal (care nu se redenumește).
  const [bookColorsOpen, setBookColorsOpen] = useState(false);
  const [bookEdit, setBookEdit] = useState<{ old: string; name: string } | null>(null);
  const bookRef = useRef(bookEdit);
  bookRef.current = bookEdit;
  const tags = useMemo(() => allTags(bookNotes), [bookNotes]);
  // Eticheta aleasă dispare din filtru când nu mai e scrisă în nicio notiță.
  const activeTag = tags.some(([t]) => t === tag) ? tag : '';
  const [todayOnly, setTodayOnly] = useState(false);
  const [kind, setKind] = useState('');
  const [summary, setSummary] = useState(false);
  // 🏷 Rezumat apare și fără #etichete, dacă vreo notiță are de făcut (☐) sau semne pe rând.
  const hasMarks = useMemo(() => !!store?.notes.some((n) => !n.archived && /^ *(☐|⭐|❓|💡|📞|📌) /m.test(n.body)), [store]);
  // Găsește în notița deschisă (Ctrl+F din notiță): Enter / F3 merg la următoarea, Shift+F3 la cea dinainte, Esc închide.
  const [find, setFind] = useState<{ q: string; i: number } | null>(null);
  const findRef = useRef<HTMLInputElement>(null);
  const [archiveView, setArchiveView] = useState(false);
  const [trashView, setTrashView] = useState(false);
  // Ca în Keep („Mută elementele bifate jos”): la bifare, rândul coboară singur la sfârșitul listei. Se ține minte.
  // Formatarea la vedere: aldinul, cursivul, culorile și titlurile se văd direct în câmpul de scris (semnele rămân, estompate).
  const [liveFmt, setLiveFmtState] = useState(() => { try { return localStorage.getItem('suite.notes.liveFmt') !== '0'; } catch { return true; } });
  const setLiveFmt = (on: boolean) => { setLiveFmtState(on); try { localStorage.setItem('suite.notes.liveFmt', on ? '1' : '0'); } catch { /* fără memorie locală */ } };
  const [autoBottom, setAutoBottom] = useState(() => { try { return localStorage.getItem('suite.notes.autoBottom') === '1'; } catch { return false; } });
  // Secțiunile (ca în OneNote): „” = toate notițele.
  const [section, setSection] = useState('');
  const [secEdit, setSecEdit] = useState<{ old: string; name: string } | null>(null);
  // Enter închide câmpul, iar închiderea lui aduce și „blur”: ref-ul face ca numele să se folosească o singură dată.
  const secRef = useRef(secEdit);
  // Grupurile de secțiuni strânse (doar pe ecran) și grupul al cărui nume îl scrii acum.
  const [shutGroups, setShutGroups] = useState<Set<string>>(() => new Set());
  const [grpEdit, setGrpEdit] = useState<{ old: string; name: string } | null>(null);
  secRef.current = secEdit;
  const sections = useMemo(() => (store ? sectionsIn(store, activeBook) : []), [store, activeBook]);
  const activeSection = sections.includes(section) ? section : '';
  const trash = store?.trash ?? [];
  const archivedCount = useMemo(() => bookNotes.filter((n) => n.archived).length, [bookNotes]);
  const due = useMemo(() => dueToday(bookNotes), [bookNotes]);
  const [sortMode, setSortMode] = useState<SortMode>(() => { try { const v = localStorage.getItem('suite.notes.sort'); return v === 'created' || v === 'title' || v === 'manual' ? v : 'updated'; } catch { return 'updated'; } });
  // Vederea Grilă (ca în Google Keep): carduri pe toată lățimea, în coloane; click pe un card deschide notița. Se ține minte.
  const [board, setBoardState] = useState(() => { try { return localStorage.getItem('suite.notes.board') === '1'; } catch { return false; } });
  // „Ia o notiță…” deasupra cardurilor: primul rând devine titlul, restul textul; notița intră în caietul și secțiunea de acum, fără să părăsești cardurile.
  const [take, setTake] = useState('');
  const takeNote = () => {
    const t = take.trim();
    if (!t) return;
    const [first, ...rest] = t.split(/\r?\n/);
    const n = newNote({ title: first.trim(), body: rest.join('\n').trim(), ...(activeSection ? { section: activeSection } : {}), ...(activeBook ? { book: activeBook } : {}) });
    change((x) => ({ ...x, notes: [...x.notes, n] }));
    setTake('');
    setStatus(`Notiță nouă: „${shownTitle(n)}”.`);
  };
  /** 📌 de pe card: fixează sau desface o notiță fără să o deschizi. */
  const togglePinOf = (id: string) => change((x) => ({ ...x, notes: x.notes.map((m) => (m.id === id ? { ...m, pinned: m.pinned ? undefined : true } : m)) }));
  const setBoard = (on: boolean) => { setBoardState(on); try { localStorage.setItem('suite.notes.board', on ? '1' : '0'); } catch { /* fără memorie locală */ } };
  // Tragerea unei notiței peste alta o mută acolo și trece lista pe „Ordinea mea”.
  const dragNote = useRef<string | null>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);
  const dropNote = (targetId: string) => {
    const id = dragNote.current;
    dragNote.current = null;
    setDropOn(null);
    if (!id || id === targetId) return;
    change((s) => ({ ...s, notes: moveNote(s.notes, id, targetId) }));
    if (sortMode !== 'manual') { changeSort('manual'); setStatus('Lista e acum în „Ordinea mea”: notițele rămân unde le-ai tras.'); }
  };
  const changeSort = (m: SortMode) => { setSortMode(m); try { localStorage.setItem('suite.notes.sort', m); } catch { /* fără memorie locală */ } };
  const searchAll = allBooks && !!query.trim() && books.length > 1;
  const list = useMemo(() => {
    if (!store) return [];
    const all = sortNotes(inView(searchAll ? store.notes : bookNotes, archiveView, query, activeTag), sortMode);
    const found = all.filter((n) => (!activeSection || n.section === activeSection) && matchesKind(n, kind));
    if (!todayOnly) return found;
    const ids = new Set(found.map((n) => n.id));
    return due.filter((n) => ids.has(n.id));
  }, [store, bookNotes, searchAll, query, activeTag, todayOnly, due, archiveView, activeSection, sortMode, kind]);
  // Câte notițe găsite sunt în celelalte caiete (pentru butonul „În toate caietele”).
  const otherHits = useMemo(() => (store && query.trim() && books.length > 1 ? inView(store.notes.filter((n) => (n.book ?? '') !== activeBook), archiveView, query, '').length : 0), [store, books, activeBook, archiveView, query]);

  // Eticheta redenumită (dublu-click pe ea): numele nou se scrie în toate notițele; cu numele gol, eticheta se scoate.
  const [tagEdit, setTagEdit] = useState<{ old: string; name: string } | null>(null);
  const tagRef = useRef(tagEdit);
  tagRef.current = tagEdit;
  const finishTag = async () => {
    const cur = tagRef.current;
    if (!cur || !store) return;
    tagRef.current = null;
    setTagEdit(null);
    const { old, name } = cur;
    const count = store.notes.filter((n) => tagsOf(n).includes(old)).length;
    if (!name.trim()) {
      if (!(await askYes(`Scoți eticheta #${old} din ${count === 1 ? 'notița ei' : `cele ${count} notițe`}?
Cuvântul rămâne în text, doar fără „#”.`, 'Scoate eticheta'))) return;
      change((x) => retag(x, old, ''));
      if (activeTag === old) setTag('');
      setStatus(`Eticheta #${old} a fost scoasă.`);
      return;
    }
    const to = cleanTag(name);
    if (!to || to === old) return;
    change((x) => retag(x, old, to));
    if (activeTag === old) setTag(plain(to));
    setStatus(`Eticheta #${old} se numește acum #${to}.`);
  };

  /** Termină scrierea numelui unei secțiuni: nouă (old = „”), redenumită sau, cu numele gol, ștearsă. */
  const finishSection = async () => {
    const cur = secRef.current;
    if (!cur || !store) return;
    secRef.current = null;
    const { old } = cur;
    const { group, name, grouped } = splitSectionPath(cur.name);
    setSecEdit(null);
    if (!old) {
      const [next, used] = addSection(store, name);
      if (!used) return;
      const withGroup = grouped ? setSectionGroup(next, used, group) : next;
      if (withGroup !== store) change(() => withGroup);
      setSection(used);
      return;
    }
    if (grouped && !name) return;
    if (!name.trim()) {
      const count = store.notes.filter((n) => n.section === old).length;
      if (count && !(await askYes(`Ștergi secțiunea „${old}”?\nNotițele ei (${count}) rămân în caiet, fără secțiune.`, 'Șterge secțiunea'))) return;
      change((s) => removeSection(s, old));
      if (activeSection === old) setSection('');
      return;
    }
    const usedOf = (s: NoteStore) => sectionsOf(s).find((x) => x.toLowerCase() === name.trim().toLowerCase()) ?? name;
    change((s) => { const r = renameSection(s, old, name); return setSectionGroup(r, usedOf(r), group); });
    if (activeSection === old) setSection(usedOf(renameSection(store, old, name)));
  };
  /** Termină scrierea numelui unui grup de secțiuni (gol = desface grupul; secțiunile rămân). */
  const finishGroup = () => {
    const cur = grpEdit;
    setGrpEdit(null);
    if (!cur || !store || cur.name.trim() === cur.old) return;
    change((s) => renameGroup(s, cur.old, cur.name));
    setStatus(cur.name.trim() ? `Grupul se numește acum „${cur.name.trim()}”.` : `Grupul „${cur.old}” s-a desfăcut; secțiunile lui au rămas.`);
  };

  const finishBook = async () => {
    const cur = bookRef.current;
    if (!cur || !store) return;
    bookRef.current = null;
    const { old, name } = cur;
    setBookEdit(null);
    if (old === '\u0000new') {
      const [next, used] = addBook(store, name);
      if (!used) { if (name.trim()) setStatus(`„${MAIN_BOOK}” există deja.`); return; }
      if (next !== store) change(() => next);
      setBook(used); setSection('');
      setStatus(`Caietul „${used}” e deschis. Notițele noi intră în el.`);
      return;
    }
    if (!name.trim()) {
      const count = store.notes.filter((n) => n.book === old).length;
      if (count && !(await askYes(`Ștergi caietul „${old}”?\nNotițele lui (${count}) nu se pierd: trec în „${MAIN_BOOK}”.`, 'Șterge caietul'))) return;
      change((s) => removeBook(s, old));
      if (activeBook === old) setBook('');
      return;
    }
    const next = renameBook(store, old, name);
    change(() => next);
    if (activeBook === old) setBook(booksOf(next).find((x) => x && x.toLowerCase() === name.trim().toLowerCase()) ?? '');
  };

  /** Mută notița deschisă (cu subpaginile ei) în alt caiet și trece în el, ca notița să rămână la vedere. */
  const moveToBookOf = (to: string) => {
    if (!note || !store) return;
    flush();
    const ids = new Set<string>([note.id]);
    for (const c of childrenOf(store.notes, note.id)) { ids.add(c.id); for (const g of childrenOf(store.notes, c.id)) ids.add(g.id); }
    change((s) => moveToBook(s, ids, to));
    setBook(to); setSection(''); setQuery(''); setTag('');
    setStatus(`Notița e acum în caietul „${to || MAIN_BOOK}”.`);
  };

  /** Mută notița deschisă în altă secțiune; dacă se vede o singură secțiune, trece în cea nouă, ca notița să rămână la vedere. */
  const moveTo = (to: string) => {
    if (!note) return;
    edit({ section: to || undefined }, false);
    // Subpaginile pleacă odată cu pagina lor.
    const sub = new Set<string>();
    for (const c of childrenOf(store?.notes ?? [], note.id)) { sub.add(c.id); for (const g of childrenOf(store?.notes ?? [], c.id)) sub.add(g.id); }
    if (sub.size) change((s) => ({ ...s, notes: s.notes.map((n) => (sub.has(n.id) ? { ...n, section: to || undefined } : n)) }));
    if (activeSection) setSection(to);
    setStatus(to ? `Notița e acum în secțiunea „${to}”.` : 'Notița nu mai e în nicio secțiune.');
  };
  /**
   * Copiază notița deschisă în altă secțiune sau alt caiet (ca „Copiază în” din OneNote): copia are același titlu și conținut,
   * originalul rămâne deschis unde era. Subpaginile nu se copiază.
   */
  const copyTo = (where: 'section' | 'book', to: string) => {
    if (!note) return;
    flush();
    const base = duplicateNote(note);
    const c: Note = where === 'section'
      ? { ...base, title: note.title, ...(to ? { section: to } : {}) }
      : (({ section: _s, book: _b, ...rest }) => ({ ...rest, title: note.title, ...(to ? { book: to } : {}) }))(base);
    if (where === 'section' && !to) delete c.section;
    change((s) => { const i = s.notes.findIndex((n) => n.id === note.id); const notes = [...s.notes]; notes.splice(i + 1, 0, c); return { ...s, notes }; });
    setStatus(where === 'section' ? `Am copiat notița în ${to ? `secțiunea „${to}”` : 'afara secțiunilor'}.` : `Am copiat notița în caietul „${to || MAIN_BOOK}”.`);
  };
  // Lista cu subpaginile puse sub pagina lor (în modul Carduri rămân pe rând, fără trepte).
  const shown = useMemo(() => nestNotes(list), [list]);
  // Grupul „Fixate” ține până la prima pagină de sus nefixată (subpaginile unei fixate stau cu ea).
  const pinnedCount = (() => { const k = shown.findIndex((x) => x.depth === 0 && !x.note.pinned); const head = k < 0 ? shown : shown.slice(0, k); return head.some((x) => x.note.pinned) ? head.length : 0; })();
  // Notițele blocate deschise cu parola: conținutul lor necriptat stă doar aici, în memorie, cât notița e aleasă.
  const [unlocked, setUnlocked] = useState<Record<string, OpenSecret>>({});
  const unlockedRef = useRef(unlocked);
  unlockedRef.current = unlocked;
  const stored = store?.notes.find((n) => n.id === sel) ?? null;
  const opened = stored?.secret ? unlocked[stored.id] : undefined;
  /** Notița arătată: pentru una blocată și deschisă, cu textul decriptat. */
  const note: Note | null = stored && opened ? { ...stored, ...opened.plain } : stored;
  // Poza aleasă pentru desen e un desen făcut aici: se redeschide cu liniile lui, nu ca poză de fundal.
  const drawnInk = typeof drawing === 'number' ? unpackInk(note?.imageInk?.[drawing]) : null;
  // Altă notiță: panoul de accesibilitate se închide (lista era a celei vechi).
  useEffect(() => { setA11y(null); setPicked(null); setGramOn(false); setGramIgnored([]); }, [note?.id]);
  // 🗗 Fereastră separată: notițele deschise și în fereastra lor. Ce se scrie acolo vine aici (și se salvează în caiet),
  // iar ce se schimbă aici la notița aleasă pleacă acolo. Notițele blocate nu se deschid separat (textul lor e criptat).
  const soloIds = useRef(new Set<string>());
  const soloLast = useRef(new Map<string, string>());
  const soloKey = (n: { title: string; body: string; color?: string }) => n.title + String.fromCharCode(0) + n.body + String.fromCharCode(0) + (n.color ?? '');
  useEffect(() => {
    void api.noteHolder?.(true);
    const off = api.onNoteSync?.((m) => {
      if (m.closed) return;
      soloIds.current.add(m.id);
      soloLast.current.set(m.id, soloKey(m));
      const cur = latest.current?.notes.find((n) => n.id === m.id);
      if (!cur || cur.secret || (cur.title === m.title && cur.body === m.body)) return;
      setStore((s) => (s ? { ...s, notes: s.notes.map((n) => (n.id === m.id ? { ...n, title: m.title, body: m.body, updated: m.updated || n.updated } : n)) } : s));
      dirty.current = true;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, AUTOSAVE_MS);
    });
    return () => { off?.(); void api.noteHolder?.(false); };
  }, [flush]);
  useEffect(() => {
    if (!stored || stored.secret || !soloIds.current.has(stored.id)) return;
    const msg = { id: stored.id, title: stored.title, body: stored.body, updated: stored.updated, color: stored.color };
    if (soloLast.current.get(stored.id) === soloKey(msg)) return;
    const t = window.setTimeout(() => { soloLast.current.set(msg.id, soloKey(msg)); void api.noteSync?.(msg); }, 300);
    return () => window.clearTimeout(t);
  }, [stored?.id, stored?.title, stored?.body, stored?.color]);
  const popOut = async () => {
    if (!stored || stored.secret || !api.notePopout) return;
    const msg = { id: stored.id, title: stored.title, body: stored.body, updated: stored.updated, color: stored.color };
    soloIds.current.add(msg.id);
    soloLast.current.set(msg.id, soloKey(msg));
    if (await api.notePopout(msg).catch(() => false)) setStatus('Notița e deschisă și într-o fereastră separată; ce scrii acolo se salvează aici, în caiet.');
  };
  const lockedView = !!stored?.secret && !opened;
  const sealSeq = useRef(0);

  // Click pe o legătură [[Titlu]]: deschide notița; dacă nu există, o face, cu acest titlu.
  const openLink = (title: string) => {
    if (!store) return;
    const found = findByTitle(store.notes, title);
    if (found) { setQuery(''); setTag(''); select(found.id); return; }
    const n = newNote({ title, ...(activeBook ? { book: activeBook } : {}) });
    select(n.id);
    change((s) => ({ ...s, notes: [...s.notes, n] }));
    setQuery('');
  };

  const add = (fromTemplate?: string) => {
    const tpl = TEMPLATES.find((t) => t.key === fromTemplate)?.make(new Date());
    const n = newNote({ ...(activeSection ? { section: activeSection } : {}), ...(activeBook ? { book: activeBook } : {}), ...(tpl ?? {}) });
    select(n.id);
    setBoard(false);
    setReader(false);
    change((s) => ({ ...s, notes: [...s.notes, n] }));
    setQuery('');
    wantFocus.current = true;
  };

  /** „+ Subpagină nouă” (Ctrl+Alt+Shift+N): o notiță nouă sub cea deschisă (sau lângă ea, dacă e deja pe ultimul nivel). */
  const addSub = () => {
    if (!note) { add(); return; }
    const d = shown.find((x) => x.note.id === note.id)?.depth ?? 0;
    const parent = d >= MAX_DEPTH ? note.parent : note.id;
    const n = newNote({ ...(parent ? { parent } : {}), ...(note.section ? { section: note.section } : {}), ...(note.book ? { book: note.book } : {}) });
    select(n.id);
    setBoard(false);
    setReader(false);
    change((s) => ({ ...s, notes: [...s.notes, n] }));
    setQuery('');
    wantFocus.current = true;
    const p = store?.notes.find((x) => x.id === parent);
    setStatus(p ? `Subpagină nouă sub „${shownTitle(p)}”.` : 'Notiță nouă.');
  };
  /** „→ Fă subpagină” (Ctrl+Alt+]) și „← Urcă un nivel” (Ctrl+Alt+[). */
  const indentNote = () => {
    if (!note || !store) return;
    const r = indentTarget(shown, store.notes, note.id);
    if ('error' in r) { setStatus(r.error); return; }
    edit({ parent: r.parent }, false);
    const p = store.notes.find((x) => x.id === r.parent);
    setStatus(`Notița e acum subpagină a „${p ? shownTitle(p) : ''}”.`);
  };
  const outdentNote = () => {
    if (!note || !store) return;
    const p = outdentParent(store.notes, note.id);
    if (p === null) { setStatus('Notița e deja pagină de sus.'); return; }
    edit({ parent: p }, false);
    setStatus(p ? 'Subpagina a urcat un nivel.' : 'Notița e acum pagină de sus.');
  };

  // Previzualizarea legăturilor web: doar la cerere (butonul 🔍), ca nimic să nu se ducă pe internet fără voia ta.
  // Pagina e doar citită (fără cookie-uri); din ea luăm titlul, descrierea și site-ul (linkPreview.ts).
  const [previewBusy, setPreviewBusy] = useState(false);
  const fetchPreviews = async (id: string, urls: string[]) => {
    if (previewBusy || !urls.length) return;
    setPreviewBusy(true);
    setStatus('Se aduc previzualizările legăturilor…');
    const { decodePage } = await import('../sheets/webTables');
    const { linkPreviewOf } = await import('./linkPreview');
    const got: LinkPreview[] = [];
    let bad = 0;
    for (const u of urls.slice(0, 10)) {
      try {
        const href = webHref(u);
        const r = api.webGet ? await api.webGet(href) : await (async () => {
          const res = await fetch(href);
          if (!res.ok) throw new Error(String(res.status));
          return { data: new Uint8Array(await res.arrayBuffer()), type: res.headers.get('content-type') ?? '', url: res.url || href };
        })();
        const html = !r.type || /html|xml/i.test(r.type) ? decodePage(r.data.subarray(0, 600000), r.type) : '';
        const { image, ...card } = linkPreviewOf(html, r.url || href);
        const thumb = image ? await pageThumb(image).catch(() => '') : '';
        got.push({ ...card, ...(thumb ? { thumb } : {}), url: u });
      } catch { bad++; }
    }
    setPreviewBusy(false);
    if (got.length) change((st) => ({ ...st, notes: st.notes.map((n) => (n.id === id
      ? { ...n, previews: [...(n.previews ?? []).filter((x) => !got.some((g) => g.url === x.url)), ...got] } : n)) }));
    setStatus(bad ? `${bad === 1 ? 'O legătură nu a răspuns' : `${bad} legături nu au răspuns`} (verifică adresa și legătura la internet).`
      : got.length === 1 ? 'Previzualizarea legăturii e gata.' : `Previzualizările celor ${got.length} legături sunt gata.`);
  };
  // Pozele din textul lipit dintr-o pagină web: cele puse direct în HTML intră îndată; cele de pe internet se aduc doar
  // la cerere (🖼 Adu pozele), tot doar citite, ca la previzualizări.
  const [pastePics, setPastePics] = useState<{ id: string; urls: string[] } | null>(null);
  const pastedImages = async (id: string, html: string) => {
    const srcs = htmlImageSources(html);
    const inline = srcs.filter((x) => x.startsWith('data:'));
    const web = srcs.filter((x) => !x.startsWith('data:'));
    // Poza din text se desface aici (fără fetch, pe care regulile ferestrei nu-l lasă pentru data:).
    const blob = (x: string) => { const [h, b64] = x.split(','); const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: /^data:([^;]+)/.exec(h)![1] }); };
    setPastePics(web.length ? { id, urls: web } : null);
    const blobs = inline.flatMap((x) => { try { return [blob(x)]; } catch { return []; } }); // base64 stricat: poza se sare
    if (blobs.length) await addImages(blobs);
  };
  const fetchPastePics = async () => {
    if (!pastePics || previewBusy) return;
    const { id, urls } = pastePics;
    setPreviewBusy(true);
    setStatus('Se aduc pozele din textul lipit…');
    const blobs: Blob[] = [];
    for (const u of urls) {
      try {
        const r = api.webGet ? await api.webGet(u) : await (async () => {
          const res = await fetch(u);
          if (!res.ok) throw new Error(String(res.status));
          return { data: new Uint8Array(await res.arrayBuffer()), type: res.headers.get('content-type') ?? '', url: u };
        })();
        if (/^image[/](jpeg|jpg|png|gif|webp|avif|bmp)/i.test(r.type) && r.data.length <= 15 * 1024 * 1024) blobs.push(new Blob([r.data as BlobPart], { type: r.type.split(';')[0] }));
      } catch { /* poza care nu răspunde rămâne pe dinafară */ }
    }
    setPreviewBusy(false);
    setPastePics(null);
    if (note?.id === id && blobs.length) await addImages(blobs);
    const bad = urls.length - blobs.length;
    setStatus(!blobs.length ? 'Pozele nu au putut fi aduse (verifică legătura la internet).'
      : bad ? `Am pus ${blobs.length} din ${urls.length} poze; celelalte nu au răspuns.` : blobs.length === 1 ? 'Poza a fost pusă în notiță.' : `Cele ${blobs.length} poze au fost puse în notiță.`);
  };
  /** Poza paginii, adusă tot doar citită și micșorată la cel mult 240 × 160 (JPEG), ca să nu umfle caietul. */
  const pageThumb = async (src: string): Promise<string> => {
    const r = api.webGet ? await api.webGet(src) : await (async () => {
      const res = await fetch(src);
      if (!res.ok) throw new Error(String(res.status));
      return { data: new Uint8Array(await res.arrayBuffer()), type: res.headers.get('content-type') ?? '', url: src };
    })();
    if (!/^image[/](jpeg|jpg|png|gif|webp|avif|bmp)/i.test(r.type) || r.data.length > 8 * 1024 * 1024) return '';
    const bmp = await createImageBitmap(new Blob([r.data as BlobPart], { type: r.type.split(';')[0] }));
    const k = Math.min(1, 240 / bmp.width, 160 / bmp.height);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close();
    return c.toDataURL('image/jpeg', 0.8);
  };
  const dropPreview = (id: string, url: string) => change((st) => ({ ...st, notes: st.notes.map((n) => (n.id === id
    ? (() => { const left = (n.previews ?? []).filter((x) => x.url !== url); const { previews: _p, ...rest } = n; return left.length ? { ...rest, previews: left } : rest; })() : n)) }));

  // ▣ Pânza liberă: arătată pentru notița care are casete sau după ▣ Casetă liberă; caseta nouă primește cursorul.
  const [canvasOn, setCanvasOn] = useState<string | null>(null);
  const [canvasFocus, setCanvasFocus] = useState<string | null>(null);
  const addCanvasBox = () => {
    if (!note) return;
    const list = note.boxes ?? [];
    const b = makeBox(16 + (list.length % 4) * 28, list.reduce((m, x) => Math.max(m, x.y + 80), 16));
    setCanvasOn(note.id); setCanvasFocus(b.id);
    edit({ boxes: [...list, b] });
  };
  // ✎ Desen pe pânză: fereastra de desen; gata = poză nouă pe pânză (sub cele de acum) sau desenul schimbat, pe locul lui.
  const [canvasDraw, setCanvasDraw] = useState<{ id?: string } | null>(null);
  const canvasInk = canvasDraw?.id ? unpackInk(note?.boxes?.find((b) => b.id === canvasDraw.id)?.ink) : null;
  const doneCanvasDraw = async (png: Blob, ink?: Ink) => {
    const at = canvasDraw; setCanvasDraw(null);
    if (!note || !at) return;
    const img = await shrinkImage(png), k = ink ? packInk(ink) : null;
    const list = note.boxes ?? [];
    if (at.id) { edit({ boxes: list.map((b) => (b.id === at.id ? { ...b, img, ...(k ? { ink: k } : {}) } : b)) }); return; }
    const b = { ...makeBox(16, list.reduce((m, x) => Math.max(m, x.y + (x.img ? x.w * 0.75 : 0) + 80), 16)), w: 320, img, ...(k ? { ink: k } : {}) };
    setCanvasOn(note.id);
    edit({ boxes: [...list, b] });
  };

  /** Schimbă notița deschisă; fixarea și culoarea nu o mută în listă (nu schimbă data). */
  const edit = (patch: Partial<Note>, touch = true) => {
    if (!note) return;
    const now = new Date().toISOString();
    const open = note.secret ? unlockedRef.current[note.id] : undefined;
    if (note.secret && !open) return;
    if (open) {
      // Notiță blocată: textul, pozele și atașamentele schimbate se criptează din nou; restul (titlu, culoare) rămâne la vedere.
      const hidden: (keyof SecretPayload)[] = ['body', 'images', 'imageText', 'imageInk', 'imageDiagram', 'files', 'boxes'];
      const plainPatch = Object.fromEntries(Object.entries(patch).filter(([k]) => hidden.includes(k as keyof SecretPayload))) as Partial<SecretPayload>;
      const rest = Object.fromEntries(Object.entries(patch).filter(([k]) => !hidden.includes(k as keyof SecretPayload)));
      if (Object.keys(plainPatch).length) {
        const next = { ...open, plain: { ...open.plain, ...plainPatch } };
        unlockedRef.current = { ...unlockedRef.current, [note.id]: next };
        setUnlocked(unlockedRef.current);
        const seq = ++sealSeq.current;
        const id = note.id;
        seal(next.key, next.salt, next.plain).then((secret) => {
          if (seq !== sealSeq.current) return; // a venit deja o schimbare mai nouă
          change((s) => ({ ...s, notes: s.notes.map((n) => (n.id === id ? { ...n, secret } : n)) }));
        });
      }
      patch = rest as Partial<Note>;
    }
    change((s) => ({ ...s, notes: s.notes.map((n) => (n.id === note.id ? { ...n, ...patch, ...(touch ? { updated: now } : {}) } : n)) }));
  };

  // Blocarea cu parolă: fereastra cere parola de două ori; deschiderea o cere o dată, în locul textului.
  const [lockDlg, setLockDlg] = useState(false);
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  // Atașamentele unei notițe blocate: fiecare fișier în clar devine o copie criptată cu cheia notiței (iv-ul în referință).
  // Cele în clar se șterg doar dacă nicio altă notiță nu le mai folosește (o copie neblocată a notiței, de exemplu).
  const sealFiles = async (key: CryptoKey, files: NoteFile[]) => {
    const old: string[] = [];
    const out: NoteFile[] = [];
    for (const f of files) {
      if (f.enc) { out.push(f); continue; }
      const { iv, data } = await sealData(key, await api.readAttachment(f.id));
      out.push({ ...f, id: await api.addAttachment(data, 'bin'), enc: iv });
      old.push(f.id);
    }
    return { files: out, old };
  };
  const dropPlainFiles = (ids: string[], noteId: string) => {
    if (!ids.length) return;
    // După ce caietul s-a salvat cu referințele noi (salvarea e la câteva clipe după schimbare).
    window.setTimeout(() => {
      const used = new Set((latest.current?.notes ?? []).filter((n) => n.id !== noteId).flatMap((n) => (n.files ?? []).map((f) => f.id)));
      for (const id of ids) if (!used.has(id)) void api.deleteAttachment?.(id).catch(() => {});
    }, 3000);
  };
  const extOf = (name: string): 'pdf' | 'webm' | 'bin' => (/[.]pdf$/i.test(name) ? 'pdf' : /[.]webm$/i.test(name) ? 'webm' : 'bin');
  /** Octeții unui atașament: unul criptat se decriptează cu cheia notiței deschise. */
  const readAtt = async (f: NoteFile) => {
    const data = await api.readAttachment(f.id);
    if (!f.enc) return data;
    if (!opened) throw new Error('Notița e blocată.');
    return unsealData(opened.key, f.enc, data);
  };

  const lockNote = async () => {
    if (!note || note.secret) return;
    if (pw1.length < 4) { setPwError('Parola trebuie să aibă cel puțin 4 caractere.'); return; }
    if (pw1 !== pw2) { setPwError('Parolele nu sunt la fel.'); return; }
    setPwBusy(true);
    try {
      const salt = newSalt();
      const key = await deriveKey(pw1, salt);
      const sealed = note.files ? await sealFiles(key, note.files) : { files: undefined, old: [] as string[] };
      const plain: SecretPayload = { body: note.body, ...(note.images ? { images: note.images } : {}), ...(note.imageText ? { imageText: note.imageText } : {}), ...(note.imageInk ? { imageInk: note.imageInk } : {}), ...(note.imageDiagram ? { imageDiagram: note.imageDiagram } : {}), ...(sealed.files ? { files: sealed.files } : {}), ...(note.boxes ? { boxes: note.boxes } : {}) };
      const secret = await seal(key, salt, plain);
      const id = note.id;
      change((s) => ({ ...s, notes: s.notes.map((n) => (n.id === id ? { ...n, body: '', images: undefined, imageText: undefined, imageInk: undefined, imageDiagram: undefined, files: undefined, sheetLinks: undefined, boxes: undefined, secret } : n)) }));
      dropPlainFiles(sealed.old, id);
      setLockDlg(false);
      setStatus('Notița e blocată cu parolă.');
    } catch (e) {
      setPwError('Notița nu s-a putut bloca: ' + ((e as Error).message || 'eroare'));
    } finally {
      setPw1(''); setPw2(''); setPwBusy(false);
    }
  };

  const unlockNote = async () => {
    if (!stored?.secret) return;
    setPwBusy(true);
    setPwError('');
    try {
      let open = await unseal(pw1, stored.secret);
      const left = (open.plain.files ?? []).filter((f) => !f.enc);
      if (left.length) {
        const sealed = await sealFiles(open.key, open.plain.files ?? []);
        open = { ...open, plain: { ...open.plain, files: sealed.files } };
        const secret = await seal(open.key, open.salt, open.plain);
        const id = stored.id;
        sealSeq.current++;
        change((s) => ({ ...s, notes: s.notes.map((n) => (n.id === id ? { ...n, secret } : n)) }));
        dropPlainFiles(sealed.old, id);
        setStatus('Am criptat și atașamentele rămase necriptate.');
      }
      const opened1 = open;
      setUnlocked((u) => ({ ...u, [stored.id]: opened1 }));
      setPw1('');
    } catch (e) {
      setPwError((e as Error).message || 'Notița nu s-a putut deschide.');
    } finally {
      setPwBusy(false);
    }
  };

  // Ca în OneNote: notițele blocate și deschise se închid singure după câteva minute fără nicio tastă sau mișcare de mouse.
  const anyOpen = Object.keys(unlocked).length > 0;
  useEffect(() => {
    if (!anyOpen) return;
    let ms = AUTO_LOCK_MS;
    try { const v = Number(localStorage.getItem('suite.notes.autoLockSec')); if (v > 0) ms = v * 1000; } catch { /* implicit */ }
    let t = 0;
    const arm = () => { window.clearTimeout(t); t = window.setTimeout(() => { setUnlocked({}); setStatus('Notița blocată s-a închis singură (câteva minute fără activitate).'); }, ms); };
    arm();
    const evs = ['keydown', 'mousedown', 'mousemove', 'wheel'] as const;
    for (const e of evs) window.addEventListener(e, arm, { passive: true });
    return () => { window.clearTimeout(t); for (const e of evs) window.removeEventListener(e, arm); };
  }, [anyOpen]);

  const findHits = useMemo(() => (find && note ? findAll(note.body, find.q) : []), [find, note]);
  /** Merge la potrivirea următoare (1) sau dinainte (-1) și o selectează în text. */
  const findGo = (dir: 1 | -1) => {
    const el = bodyRef.current;
    if (!find || !el || !findHits.length) return;
    const i = (find.i + dir + findHits.length) % findHits.length;
    setFind({ ...find, i });
    const [a, b] = findHits[i];
    el.focus();
    el.setSelectionRange(a, b);
    // Derulează câmpul până la potrivire: textul de dinainte, măsurat în rânduri.
    const line = el.value.slice(0, a).split(String.fromCharCode(10)).length;
    const lh = parseFloat(getComputedStyle(el).lineHeight) || 22;
    el.scrollTop = Math.max(0, (line - 3) * lh);
  };

  const relock = () => { if (stored) setUnlocked((u) => { const c = { ...u }; delete c[stored.id]; return c; }); };

  const removePassword = async () => {
    if (!stored || !opened || !(await askYes('Scoți parola? Notița va fi din nou la vedere pentru oricine deschide Cyber Office Studio.', 'Scoate parola'))) return;
    const key = opened.key;
    const files = opened.plain.files
      ? await Promise.all(opened.plain.files.map(async (f) => {
        if (!f.enc) return f;
        const { enc: _enc, ...rest } = f;
        return { ...rest, id: await api.addAttachment(await unsealData(key, f.enc, await api.readAttachment(f.id)), extOf(f.name)) };
      }))
      : undefined;
    const plain = { ...opened.plain, ...(files ? { files } : {}) };
    sealSeq.current++;
    change((s) => ({ ...s, notes: s.notes.map((n) => (n.id === stored.id ? { ...n, ...plain, secret: undefined } : n)) }));
    relock();
  };

  // Pozele se adaugă notiței în care au fost puse, chiar dacă între timp ai trecut la alta (micșorarea durează puțin).
  const addImages = async (files: Blob[], texts?: string[], inks?: (string | null)[], diagrams?: (string | null)[]) => {
    if (!note || !files.length) return;
    if (note.secret) { alert('Într-o notiță blocată cu parolă nu se pot pune poze. Scoate întâi parola.'); return; }
    const id = note.id;
    const room = MAX_IMAGES - (note.images?.length ?? 0);
    if (room <= 0) { alert(`O notiță poate avea cel mult ${MAX_IMAGES} poze.`); return; }
    const urls: string[] = [], read: (string | null)[] = [], drawn: (string | null)[] = [], schemes: (string | null)[] = [];
    for (const [k, f] of files.slice(0, room).entries()) {
      try { urls.push(await shrinkImage(f)); read.push(texts?.[k] || null); drawn.push(inks?.[k] || null); schemes.push(diagrams?.[k] || null); } catch { /* poză care nu se poate citi: o sărim */ }
    }
    if (!urls.length) return;
    const now = new Date().toISOString();
    // Textul deja știut (paginile unui PDF) intră direct în căutare; celelalte poze se citesc cu OCR.
    change((s) => ({ ...s, notes: s.notes.map((n) => (n.id === id ? { ...n, images: [...(n.images ?? []), ...urls],
      ...(read.some(Boolean) ? { imageText: [...(n.images ?? []).map((_, i) => n.imageText?.[i] ?? null), ...read] } : {}),
      ...(drawn.some(Boolean) ? { imageInk: [...(n.images ?? []).map((_, i) => n.imageInk?.[i] ?? null), ...drawn] } : {}),
      ...(schemes.some(Boolean) ? { imageDiagram: [...(n.images ?? []).map((_, i) => n.imageDiagram?.[i] ?? null), ...schemes] } : {}), updated: now } : n)) }));
  };

  const insertDiagram = async (d: ReturnType<typeof newDiagram>) => {
    setDiagramOpen(false);
    const { svg, h } = diagramSvg(d);
    const png = await svgToPng(svg, DIAGRAM_W, h, 2);
    // Schema schimbată ia locul pozei ei (cu schema nouă ținută minte); una nouă se adaugă la sfârșit.
    if (typeof diagramOpen === 'number') await replaceImage(diagramOpen, png, null, JSON.stringify(d));
    else await addImages([png], [diagramAlt(d)], undefined, [JSON.stringify(d)]);
  };

  /** Modelul 3D ținut lângă poza i (pus cu 🧊 Modele 3D), sau null. */
  const modelAt = (i: boolean | number | null) => (typeof i === 'number' && note?.imageDiagram?.[i] ? modelOf(note.imageDiagram[i]!) : null);
  const doneModel3d = async (blob: Blob, name: string, src: Model3DSource) => {
    const target = model3dOpen;
    setModel3dOpen(false);
    const keep = keepModel(src.name, src.data, src.view, NOTE_MODEL3D_MAX);
    const slot = keep ? JSON.stringify({ m3d: keep }) : null;
    if (typeof target === 'number') await replaceImage(target, blob, null, slot);
    else await addImages([blob], ['Model 3D ' + name], undefined, [slot]);
  };
  /** Schema ținută minte lângă poza i (pusă cu ◇ Schemă), sau null. */
  const diagramAt = (i: boolean | number | null): DocDiagram | null => {
    if (typeof i !== 'number' || !note?.imageDiagram?.[i]) return null;
    try { return parseDiagram(JSON.parse(note.imageDiagram[i]!)); } catch { return null; }
  };

  const pickShot = async () => {
    const b = await captureScreen();
    if (b) await addImages([b]);
  };
  const pickImages = async () => {
    const files = await api.importImages();
    await addImages(files.map((f) => new Blob([f.data as BlobPart])));
  };

  // Poza peste care s-a desenat ia locul celei vechi; textul citit din ea se citește din nou (OCR).
  // Desenul editabil (ink) ia locul liniilor vechi; fără el (poză rotită, decupată, desenată peste) poza nu mai e desen.
  const replaceImage = async (i: number, png: Blob, ink: string | null = null, diagram: string | null = null) => {
    if (!note?.images?.[i]) return;
    const id = note.id;
    const old = note.images[i];
    let url: string;
    try { url = await shrinkImage(png); } catch { return; }
    const now = new Date().toISOString();
    change((s) => ({ ...s, notes: s.notes.map((n) => {
      if (n.id !== id || n.images?.[i] !== old) return n;
      const images = n.images.map((x, k) => (k === i ? url : x));
      // La o schemă schimbată, textul de căutare e chiar al ei (fără OCR).
      const said = diagram ? parseDiagram(diagram) : null;
      const model = diagram ? modelOf(diagram) : null;
      const told = said ? diagramAlt(said) : model ? 'Model 3D ' + model.name : null;
      const imageText = n.imageText || told ? n.images.map((_, k) => (k === i ? told : n.imageText?.[k] ?? null)) : undefined;
      const marks = n.imageInk || ink ? n.images.map((_, k) => (k === i ? ink : n.imageInk?.[k] ?? null)) : undefined;
      const schemes = n.imageDiagram || diagram ? n.images.map((_, k) => (k === i ? diagram : n.imageDiagram?.[k] ?? null)) : undefined;
      return { ...n, images, imageText, imageInk: marks?.some(Boolean) ? marks : undefined, imageDiagram: schemes?.some(Boolean) ? schemes : undefined, updated: now };
    }) }));
  };

  const rotate = async (i: number) => {
    const src = note?.images?.[i];
    if (!src) return;
    try { await replaceImage(i, await rotateImage(src, 1)); } catch { setStatus('Poza nu s-a putut roti.'); }
  };

  const removeImage = (i: number) => {
    if (!note?.images) return;
    const images = note.images.filter((_, k) => k !== i);
    const imageText = (note.imageText ?? []).filter((_, k) => k !== i);
    const imageInk = (note.imageInk ?? []).filter((_, k) => k !== i);
    const imageDiagram = (note.imageDiagram ?? []).filter((_, k) => k !== i);
    edit({ images: images.length ? images : undefined, imageText: images.length && imageText.length ? imageText : undefined,
      imageInk: images.length && imageInk.some(Boolean) ? imageInk : undefined, imageDiagram: images.length && imageDiagram.some(Boolean) ? imageDiagram : undefined });
  };

  // OCR în fundal: pozele necitite se citesc pe rând (motorul pornește doar acum și se oprește după ultima),
  // iar textul lor intră în căutare. Rezultatul se pune doar dacă poza e încă în notiță, în același loc.
  const ocrBusy = useRef(false);
  const [ocrStatus, setOcrStatus] = useState('');
  useEffect(() => {
    if (!store || ocrBusy.current || blocked.current) return;
    const next = unreadPhotos(store.notes)[0];
    if (!next) return;
    ocrBusy.current = true;
    const [n, i] = next;
    const src = n.images![i];
    (async () => {
      let text = '';
      try {
        const img = new Image();
        img.src = src;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext('2d')!.drawImage(img, 0, 0);
        const { recognize } = await import('../pdf/ocr');
        setOcrStatus('Citesc textul din poze…');
        text = (await recognize(c)).text.replace(/[ \t]+\n/g, '\n').trim();
      } catch { /* poză care nu se poate citi: rămâne fără text */ }
      change((s) => ({
        ...s,
        notes: s.notes.map((o) => {
          if (o.id !== n.id || o.images?.[i] !== src) return o;
          const imageText = [...(o.imageText ?? [])];
          while (imageText.length < i) imageText.push(null);
          imageText[i] = text;
          return { ...o, imageText };
        }),
      }));
      ocrBusy.current = false;
      // Dacă nu mai e nimic de citit, efectul de mai sus nu mai pornește nimic, deci oprim motorul aici.
      const left = latest.current ? unreadPhotos(latest.current.notes).filter(([o, k]) => !(o.id === n.id && k === i)) : [];
      if (!left.length) {
        setOcrStatus('');
        (await import('../pdf/ocr')).stopOcr();
      }
    })();
  }, [store]); // eslint-disable-line react-hooks/exhaustive-deps

  // PDF-uri atașate: se păstrează lângă caiet (nu în el), deci caietul rămâne mic și se salvează repede.
  const addPdfs = async (files: { name: string; data: Uint8Array | Blob }[]) => {
    if (!note || !files.length) return;
    if (note.secret) { alert('Într-o notiță blocată cu parolă nu se pot atașa PDF-uri. Scoate întâi parola.'); return; }
    const id = note.id;
    const added: NoteFile[] = [];
    for (const f of files.slice(0, MAX_FILES - (note.files?.length ?? 0))) {
      try {
        const data = f.data instanceof Blob ? new Uint8Array(await f.data.arrayBuffer()) : f.data;
        if (data.length > MAX_FILE_MB * 1024 * 1024) { alert(`„${f.name}” are peste ${MAX_FILE_MB} MB și nu se poate atașa.`); continue; }
        if (String.fromCharCode(...data.subarray(0, 5)) !== '%PDF-') { alert(`„${f.name}” nu e un PDF.`); continue; }
        // Textul PDF-ului intră în căutare (doar dacă are text; scanările n-au).
        const text = await import('./pdftext').then((m) => m.pdfText(data)).catch(() => '');
        added.push({ id: await api.addAttachment(data), name: f.name.replace(/^.*[\\/]/, ''), size: data.length, ...(text ? { text } : {}) });
      } catch { alert(`„${f.name}” nu s-a putut atașa.`); }
    }
    if (!added.length) return;
    const now = new Date().toISOString();
    change((s) => ({ ...s, notes: s.notes.map((n) => (n.id === id ? { ...n, files: [...(n.files ?? []), ...added], updated: now } : n)) }));
  };

  // PDF ca imprimare (ca „Imprimare fișier” din alte caiete): paginile PDF-ului atașat intră în notiță ca poze, sub text.
  const pdfAsPrintout = async (f: NoteFile) => {
    if (!note) return;
    const room = MAX_IMAGES - (note.images?.length ?? 0);
    if (room <= 0) { alert(`O notiță poate avea cel mult ${MAX_IMAGES} poze.`); return; }
    try {
      const { pdfPageImages } = await import('./pdftext');
      const { images, texts, pages } = await pdfPageImages(await readAtt(f), room);
      await addImages(images, texts);
      if (pages > images.length) alert(`Au intrat primele ${images.length} pagini din ${pages} (o notiță are cel mult ${MAX_IMAGES} poze).`);
    } catch { alert(`Paginile din „${f.name}” nu au putut fi puse în notiță.`); }
  };

  // Orice alt fișier (Word, Excel, arhivă, poză RAW…): se păstrează lângă caiet cu numele lui; din notiță se salvează o copie.
  const addOthers = async (files: { name: string; data: Uint8Array | Blob }[]) => {
    if (!note || !files.length) return;
    if (note.secret) { alert('Într-o notiță blocată cu parolă nu se pot atașa fișiere. Scoate întâi parola.'); return; }
    const id = note.id;
    const added: NoteFile[] = [];
    for (const f of files.slice(0, MAX_FILES - (note.files?.length ?? 0))) {
      const name = f.name.replace(/^.*[\\/]/, '');
      try {
        const size = f.data instanceof Blob ? f.data.size : f.data.length;
        if (size > MAX_FILE_MB * 1024 * 1024) { alert(`„${name}” are peste ${MAX_FILE_MB} MB și nu se poate atașa.`); continue; }
        const data = f.data instanceof Blob ? new Uint8Array(await f.data.arrayBuffer()) : f.data;
        added.push({ id: await api.addAttachment(data, 'bin'), name, size: data.length });
      } catch { alert(`„${name}” nu s-a putut atașa.`); }
    }
    if (!added.length) return;
    const now = new Date().toISOString();
    change((s) => ({ ...s, notes: s.notes.map((n) => (n.id === id ? { ...n, files: [...(n.files ?? []), ...added], updated: now } : n)) }));
  };
  /** E-mailurile trase în notiță (.eml / .msg): textul lor scris la cursor, pozele și atașamentele lor puse în notiță. */
  const addMails = async (el: HTMLTextAreaElement, files: File[]) => {
    if (!note) return;
    const id = note.id;
    const { mailToNote } = await import('./mailImport');
    for (const f of files.slice(0, 20)) {
      try {
        if (f.size > MAX_FILE_MB * 1024 * 1024) { alert(`„${f.name}” are peste ${MAX_FILE_MB} MB și nu se poate pune în notiță.`); continue; }
        const m = await mailToNote(f.name, new Uint8Array(await f.arrayBuffer()));
        insertAtCursor(el, m.text);
        if (/<img\b/i.test(m.html)) await pastedImages(id, m.html);
        if (m.files.length) await addOthers(m.files.map((x) => ({ name: x.name, data: x.data })));
      } catch (err) { alert(`E-mailul „${f.name}” nu s-a putut citi: ${(err as Error).message}`); }
    }
  };
  /** Împarte fișierele aduse: poze → poze, PDF-uri → PDF, restul → atașamente oarecare. */
  const addAny = async (files: { name: string; data: Uint8Array | Blob }[]) => {
    const isPdf = (n: string) => /\.pdf$/i.test(n);
    const isImg = (n: string) => /\.(png|jpe?g|gif|webp|bmp)$/i.test(n);
    const imgs = files.filter((f) => isImg(f.name)).map((f) => (f.data instanceof Blob ? f.data : new Blob([f.data as BlobPart])));
    if (imgs.length) await addImages(imgs);
    const pdfs = files.filter((f) => isPdf(f.name));
    if (pdfs.length) await addPdfs(pdfs);
    const rest = files.filter((f) => !isPdf(f.name) && !isImg(f.name));
    if (rest.length) await addOthers(rest);
  };
  // Inserare → ▦ Foaie de calcul…: tabelul din .xlsx / .ods / .csv pus la cursor, cu valorile calculate.
  // Fișierul cu mai multe foi deschide fereastra „Alege foaia” (cu foaia activă la salvare aleasă de la început).
  const [sheetPick, setSheetPick] = useState<{ base: string; path: string; sheets: SheetSrc[]; i: number } | null>(null);
  const insertSheet = async () => {
    const f = await api.importFile('sheettable');
    if (!f) return;
    if (f.size) { alert(`Fișierul are peste ${MAX_FILE_MB} MB și nu se poate pune în notiță.`); return; }
    const base = f.path.split(/[\\/]/).pop() ?? f.path;
    try {
      const { sheetFileSheets, rowsToTable } = await import('./sheetTable');
      const fs = await sheetFileSheets(base, f.data);
      if (fs && !fs.rows && fs.sheets.length > 1) { setSheetPick({ base, path: f.path, sheets: fs.sheets, i: fs.active }); return; }
      await putSheet(base, fs?.rows ? rowsToTable(fs.rows) : fs ? fs.sheets[0] : null, f.path);
    } catch (e) {
      alert(`Fișierul „${base}” nu s-a putut citi: ${(e as Error).message}`);
    }
  };
  /** Pune la cursor tabelul (sau foaia, calculată acum) din fișierul `base`. */
  const putSheet = async (base: string, src: SheetTable | SheetSrc | null, path = '') => {
    try {
      const { sheetToTable, MAX_ROWS, MAX_COLS } = await import('./sheetTable');
      const tb = src && 'cells' in src ? await sheetToTable(src) : src;
      const t = bodyRef.current;
      if (!tb) { alert(`În „${base}” nu e niciun tabel de pus în notiță (foaia e goală).`); return; }
      if (!t) return;
      const pos = t.selectionStart;
      const before = pos > 0 && t.value[pos - 1] !== String.fromCharCode(10) ? String.fromCharCode(10) : '';
      insertAtCursor(t, before + tb.text + String.fromCharCode(10));
      // Legătura cu fișierul (doar cu calea întreagă de pe disc), pentru ↻ Reîmprospătează foile.
      const id = note?.id;
      if (id && (path.includes('/') || path.includes(String.fromCharCode(92)))) {
        const link: SheetLink = { path, sheet: tb.sheet, text: tb.text };
        change((st) => ({ ...st, notes: st.notes.map((n) => (n.id === id ? { ...n, sheetLinks: [...(n.sheetLinks ?? []).filter((x) => x.text !== tb.text), link].slice(-20) } : n)) }));
      }
      setStatus(tb.cut ? `Tabelul din „${base}” e pus în notiță, tăiat la ${MAX_ROWS} rânduri și ${MAX_COLS} coloane.` : `Tabelul din „${base}” e pus în notiță (${tb.rows} rânduri, ${tb.cols} coloane).`);
    } catch (e) {
      alert(`Fișierul „${base}” nu s-a putut citi: ${(e as Error).message}`);
    }
  };
  // ↻ Reîmprospătează foile: fiecare tabel pus din fișier se citește din nou (aceeași foaie, după nume) și ia locul celui vechi.
  // Tabelul schimbat de mână în notiță rămâne neatins (nu se mai găsește textul pus atunci).
  // `quiet` (la deschiderea notiței): se face singur, fără mesaj decât dacă un tabel chiar s-a schimbat în fișier.
  const [sheetBusy, setSheetBusy] = useState(false);
  const refreshSheets = async (quiet = false) => {
    const id = note?.id;
    const links = note?.sheetLinks ?? [];
    if (!id || !note || !links.length || sheetBusy) return;
    setSheetBusy(true);
    const body = note.body;
    const reps: [string, string][] = [];
    const next: SheetLink[] = [];
    let same = 0, changed = 0, gone = 0, edited = 0;
    try {
      const { sheetFileSheets, rowsToTable, sheetToTable } = await import('./sheetTable');
      for (const l of links) {
        if (!body.includes(l.text)) { edited++; continue; }
        const base = l.path.split(/[\\/]/).pop() ?? l.path;
        try {
          const f = await api.readBinary(l.path, 'sheettable' as FileKind);
          const fs = await sheetFileSheets(base, f.data);
          const sh = fs && !fs.rows ? (fs.sheets.find((x) => x.name === l.sheet) ?? null) : null;
          const tb = fs?.rows ? rowsToTable(fs.rows) : sh ? await sheetToTable(sh) : null;
          if (!tb) { gone++; next.push(l); continue; }
          if (tb.text === l.text) same++;
          else { reps.push([l.text, tb.text]); changed++; }
          next.push({ ...l, text: tb.text });
        } catch { gone++; next.push(l); }
      }
    } finally { setSheetBusy(false); }
    if (quiet && !changed) return;
    // Înlocuirile se fac pe textul de acum al notiței (poate ai scris între timp), nu pe cel de la început.
    if (changed || next.length !== links.length) change((st) => ({ ...st, notes: st.notes.map((n) => (n.id === id
      ? (() => { const { sheetLinks: _l, ...rest } = n; return { ...rest, body: reps.reduce((b, [o, nw]) => b.split(o).join(nw), n.body), ...(next.length ? { sheetLinks: next } : {}) }; })() : n)) }));
    // Întâi se termină salvarea, ca „Salvat la …” să nu acopere mesajul de mai jos.
    await new Promise((r) => window.setTimeout(r, 50));
    await flush();
    const parts = [
      changed ? (changed === 1 ? 'un tabel e adus la zi' : `${changed} tabele sunt aduse la zi`) : '',
      same ? (same === 1 ? 'un tabel era deja la zi' : `${same} tabele erau deja la zi`) : '',
      gone ? (gone === 1 ? 'un fișier nu s-a putut citi (mutat, șters sau cu foaia redenumită)' : `${gone} fișiere nu s-au putut citi (mutate, șterse sau cu foi redenumite)`) : '',
      edited ? (edited === 1 ? 'un tabel schimbat de mână rămâne cum e' : `${edited} tabele schimbate de mână rămân cum sunt`) : '',
    ].filter(Boolean);
    setStatus(quiet ? (changed === 1 ? 'Foile de calcul din notiță: un tabel e adus la zi din fișier.' : `Foile de calcul din notiță: ${changed} tabele sunt aduse la zi din fișier.`) : 'Foile de calcul: ' + parts.join('; ') + '.');
  };
  // La deschiderea unei notițe cu tabele puse din fișiere, ele se aduc singure la zi (ca legăturile de date).
  const sheetNoteId = note?.sheetLinks?.length ? note.id : null;
  useEffect(() => { if (sheetNoteId) void refreshSheets(true); }, [sheetNoteId]); // eslint-disable-line react-hooks/exhaustive-deps
  // Și când fișierul unui tabel e salvat în Sheets (după ✎ Deschide <fișier>), notița deschisă îl ia singură.
  const savedRef = useRef<(p: string) => void>(() => {});
  savedRef.current = (p) => { if (note?.sheetLinks?.some((l) => samePath(l.path, p))) void refreshSheets(true); };
  useEffect(() => {
    const on = (e: Event) => savedRef.current((e as CustomEvent<FileSaved>).detail.path);
    window.addEventListener(FILE_SAVED, on);
    return () => window.removeEventListener(FILE_SAVED, on);
  }, []);
  const pickPdf = async () => {
    const f = await api.importFile('any');
    if (!f) return;
    if (f.size) { alert(`Fișierul are peste ${MAX_FILE_MB} MB și nu se poate atașa.`); return; }
    await addAny([{ name: f.path, data: f.data }]);
  };
  const saveCopy = async (f: NoteFile) => {
    try {
      const saved = await api.exportFile({ format: 'any', suggestedName: f.name, data: await readAtt(f) });
      if (saved) setStatus(`Copia „${f.name}” e salvată.`);
    } catch { alert(`Fișierul „${f.name}” nu mai e lângă caiet (dosarul Notițe-atașamente).`); }
  };
  // Un .docx / .xlsx / .csv / .pptx / o poză atașată se deschide direct în aplicația lui, într-un tab nou (fileKinds.ts).
  const openInApp = async (f: NoteFile) => {
    try {
      openBytes(f.name, await readAtt(f));
      setStatus(`Deschis într-un tab nou: ${f.name}`);
    } catch { alert(`Fișierul „${f.name}” nu mai e lângă caiet (dosarul Notițe-atașamente).`); }
  };

  const openPdf = async (f: NoteFile) => {
    try {
      onOpenPdf?.({ path: f.name, data: await readAtt(f) });
    } catch {
      alert(`PDF-ul „${f.name}” nu mai e lângă caiet (dosarul Notițe-atașamente).`);
    }
  };

  // 🎙 Înregistrare audio: se oprește cu ⏹ (sau singură după MAX_RECORD_MIN minute) și intră în notița în care a pornit.
  const recRef = useRef<{ r: Recording; noteId: string } | null>(null);
  const [recSec, setRecSec] = useState<number | null>(null);
  const [audioUrl, setAudioUrl] = useState<Record<string, string>>({});
  useEffect(() => {
    if (recSec === null) return;
    const t = setTimeout(() => { if (recSec + 1 >= (recRef.current?.r.video ? MAX_VIDEO_MIN : MAX_RECORD_MIN) * 60) stopRecord(); else setRecSec(recSec + 1); }, 1000);
    return () => clearTimeout(t);
  }, [recSec]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { recRef.current?.r.cancel(); Object.values(audioUrl).forEach((u) => URL.revokeObjectURL(u)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // 📹 Video: la fel, cu camera; cât filmezi, imaginea camerei se vede într-un colț.
  const [recVideo, setRecVideo] = useState<MediaStream | null>(null);
  const startRecord = async (video = false) => {
    if (!note || recRef.current) return;
    if (note.secret) { alert('Într-o notiță blocată cu parolă nu se pot pune înregistrări. Scoate întâi parola.'); return; }
    if ((note.files?.length ?? 0) >= MAX_FILES) { alert(`O notiță poate avea cel mult ${MAX_FILES} atașamente.`); return; }
    try {
      recRef.current = { r: await startRecording(video), noteId: note.id };
      setRecVideo(video ? recRef.current.r.stream : null);
      setRecSec(0);
    } catch (e) { alert((e as Error).message); }
  };
  const stopRecord = async () => {
    const cur = recRef.current;
    if (!cur) return;
    recRef.current = null;
    setRecSec(null);
    setRecVideo(null);
    const { blob, sec, at } = await cur.r.stop();
    if (!blob.size) { setStatus('Înregistrarea e goală.'); return; }
    try {
      const data = new Uint8Array(await blob.arrayBuffer());
      const file: NoteFile = { id: await api.addAttachment(data, 'webm'), name: cur.r.video ? videoName(at, sec) : recordingName(at, sec), size: data.length };
      const now = new Date().toISOString();
      change((s) => ({ ...s, notes: s.notes.map((n) => (n.id === cur.noteId ? { ...n, files: [...(n.files ?? []), file], updated: now } : n)) }));
      setAudioUrl((m) => ({ ...m, [file.id]: URL.createObjectURL(blob) }));
      setStatus(`${cur.r.video ? 'Clipul video' : 'Înregistrarea'} (${clock(sec)}) a intrat în notiță.`);
    } catch { alert('Înregistrarea nu s-a putut păstra.'); }
  };
  const playAudio = async (f: NoteFile) => {
    if (audioUrl[f.id]) return;
    try {
      const data = await readAtt(f);
      setAudioUrl((m) => ({ ...m, [f.id]: URL.createObjectURL(new Blob([data as BlobPart], { type: isVideoName(f.name) ? 'video/webm' : 'audio/webm' })) }));
    } catch { alert(`Înregistrarea „${f.name}” nu mai e lângă caiet (dosarul Notițe-atașamente).`); }
  };

  const removeFile = (fid: string) => {
    if (!note?.files) return;
    const files = note.files.filter((f) => f.id !== fid);
    edit({ files: files.length ? files : undefined });
  };

  // Import din Google Keep (arhiva Takeout) sau Evernote (.enex): notițele aduse intră în caiet; un import repetat le sare pe cele deja aduse.
  const importFromKeep = async () => {
    const f = await api.importFile('keep');
    if (!f || !latest.current) return;
    setStatus('Se aduc notițele…');
    try {
      const known = new Set(latest.current.notes.map((n) => n.source).filter((s): s is string => !!s));
      const head = new TextDecoder().decode(f.data.subarray(0, 2000));
      const enex = head.includes('<en-export');
      const name = f.path.replace(/^.*[\\/]/, '');
      const docx = /\.docx$/i.test(name);
      const from = enex ? 'fișierul .enex' : docx ? 'fișierul .docx' : 'arhiva de notițe';
      const r = docx ? await importDocx(f.data, name, known) : enex ? await importEnex(new TextDecoder().decode(f.data), f.path.replace(/^.*[\\/]/, ''), known) : await importKeep(f.data, f.path.replace(/^.*[\\/]/, ''), known);
      if (r.notes.length) {
        change((s) => ({ ...s, notes: [...s.notes, ...r.notes] }));
        setQuery('');
        setTag('');
        setSel(search(r.notes, '')[0].id);
      }
      const extra = [r.trashed ? `${r.trashed} din coș sărite` : '', r.failed ? `${r.failed} nu s-au putut citi` : ''].filter(Boolean).join(', ');
      const msg = r.notes.length ? `Am adus ${r.notes.length} ${r.notes.length === 1 ? 'notiță' : 'notițe'} din ${from}` : 'Nicio notiță nouă (toate erau deja aduse)';
      // Mesajul din bara de jos ar fi înlocuit imediat de „Salvat la…”, deci rezultatul se arată într-o fereastră.
      setStatus('');
      alert(msg + (extra ? ` (${extra}).` : '.'));
    } catch (e) {
      setStatus('');
      alert((e as Error).message || 'Fișierul nu a putut fi citit.');
    }
  };

  const copyPhotoText = async (text: string) => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setStatus('Textul din poză a fost copiat.');
  };
  // Scris de mână → text: textul citit (OCR) dintr-o poză sau dintr-un desen intră în notiță la cursor, pe rândul lui.
  const photoTextToNote = (text: string) => {
    const t = bodyRef.current;
    if (!t || !text.trim()) return;
    const NL = String.fromCharCode(10);
    const pos = t.selectionStart;
    insertAtCursor(t, (pos > 0 && t.value[pos - 1] !== NL ? NL : '') + text.trim() + NL);
    setStatus('Textul din poză e pus în notiță, la cursor.');
  };

  const archive = () => {
    if (!note) return;
    const on = !note.archived;
    const i = list.findIndex((n) => n.id === note.id);
    const next = list[i + 1] ?? list[i - 1];
    edit(on ? { archived: true, pinned: undefined } : { archived: undefined }, false);
    setStatus(on ? 'Notița e în Arhivă (o găsești la căutare sau la 🗄 Arhivă).' : 'Notița a ieșit din Arhivă.');
    // În lista obișnuită notița arhivată dispare (dacă nu e o căutare); în Arhivă dispare cea scoasă.
    if (on !== archiveView && !query.trim() && !activeTag) setSel(next?.id ?? null);
  };

  const duplicate = () => {
    if (!note) return;
    flush();
    const c = duplicateNote(note);
    // Copia stă imediat după original și se deschide; o notiță blocată rămâne blocată cu aceeași parolă.
    change((s) => { const i = s.notes.findIndex((n) => n.id === note.id); const notes = [...s.notes]; notes.splice(i + 1, 0, c); return { ...s, notes }; });
    select(c.id);
    setStatus(`Am făcut o copie: „${shownTitle(c)}”.`);
  };

  const remove = () => {
    if (!note) return;
    // Ca în Keep: notița ștearsă ajunge în coș (🗑 Coș), de unde o readuci TRASH_DAYS zile.
    const i = list.findIndex((n) => n.id === note.id);
    const next = list[i + 1] ?? list[i - 1];
    flush();
    change((s) => trashNote(s, note.id));
    setStatus(`Notița „${shownTitle(note)}” e în 🗑 Coș (o poți readuce ${TRASH_DAYS} de zile).`);
    setSel(next?.id ?? null);
  };

  // Cererea de notiță nouă se îndeplinește o singură dată, după ce s-a încărcat caietul
  // (numărul îndeplinit ține minte și când modulul se închide și se redeschide).
  useEffect(() => {
    if (!store || newNoteReq <= handledNewNote) return;
    handledNewNote = newNoteReq;
    add();
  }, [store, newNoteReq]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!store || !openId) return;
    if (store.notes.some((n) => n.id === openId)) { setQuery(''); setTag(''); setSel(openId); }
    onOpened?.();
  }, [store, openId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [remindOpen, setRemindOpen] = useState(false);

  // Export Markdown: notița deschisă sau tot caietul, ca fișier .md (text simplu, se deschide oriunde).
  const exportMd = async (all: boolean) => {
    if (!store) return;
    flush();
    const text = all ? notesToMarkdown(store.notes) : note ? noteToMarkdown(note) : '';
    if (!text) return;
    const name = all ? 'Notițe' : safeFileName(shownTitle(note!) || 'Notiță');
    await api.exportFile({ format: 'md', suggestedName: name, data: new TextEncoder().encode(text) });
  };

  const exportHtml = async () => {
    if (!note) return;
    flush();
    await api.exportFile({ format: 'html', suggestedName: safeFileName(shownTitle(note) || 'Notiță'), data: new TextEncoder().encode(noteToHtml(note)) });
  };

  // Export .mht: aceeași pagină, cu pozele ca părți separate într-un singur fișier (MHTML).
  const exportMht = async () => {
    if (!note) return;
    flush();
    const title = shownTitle(note) || 'Notiță';
    await api.exportFile({ format: 'mht', suggestedName: safeFileName(title), data: new TextEncoder().encode(htmlToMht(noteToHtml(note), title)) });
  };
  // ✉ Trimite prin e-mail: un mesaj nou (.eml) cu notița formatată și pozele ei în text, deschis în programul de e-mail;
  // în browser (fără aplicație) rămâne mesajul mailto: doar cu textul. Nu se trimite nimic singur.
  const mailNote = async () => {
    if (!note) return;
    // Întâi se termină salvarea, ca „Salvat la …” să nu acopere mesajul de mai jos.
    await flush();
    if (!api.composeMail) { window.open(noteMailto(note)); return; }
    try {
      const { buildEml } = await import('../docs/eml');
      const title = shownTitle(note) || 'Notiță';
      const { page, parts } = extractDataImages(noteToHtml(note));
      const eml = buildEml({ to: '', subject: title, text: noteMailText(note), html: page, inline: parts.map((p) => ({ cid: p.loc, type: p.type, data: p.bytes })) });
      const res = await api.composeMail(safeFileName(title), new TextEncoder().encode(eml));
      setStatus(res.opened ? 'Mesajul cu notița e deschis în programul de e-mail: scrie adresa și apasă Trimite.' : `Mesajul e salvat în ${res.path}: deschide-l cu dublu clic.`);
    } catch (e) {
      setStatus('Mesajul nu a putut fi făcut: ' + (e as Error).message);
    }
  };
  // Export sarcini (.ics): rândurile de bifat devin sarcini pentru programul de e-mail / calendar.
  const exportTasks = async () => {
    if (!note) return;
    flush();
    const ics = noteTasksIcs(note);
    if (!ics) { alert('Notița nu are rânduri de bifat (☐). Pune-le cu butonul ☐ De făcut, apoi încearcă din nou.'); return; }
    await api.exportFile({ format: 'ics', suggestedName: safeFileName(shownTitle(note) || 'Sarcini'), data: new TextEncoder().encode(ics) });
  };
  // Import sarcini (.ics): starea sarcinilor din calendar (terminate / redeschise) pusă înapoi pe rândurile notiței.
  const importTasks = async () => {
    if (!note) return;
    flush();
    const f = await api.importFile('ics');
    if (!f) return;
    const list = parseIcsTasks(new TextDecoder().decode(f.data));
    const r = applyIcsTasks(note.body, note.id, list);
    if (!r.matched) {
      alert(!list.length ? 'Fișierul nu are sarcini (.ics fără VTODO).'
        : r.others ? 'Sarcinile din fișier sunt ale altei notițe: deschide notița din care le-ai exportat și încearcă din nou.'
        : 'N-am găsit în notiță sarcinile din fișier (au fost exportate din Suite, cu Export sarcini?).');
      return;
    }
    if (r.body !== note.body) {
      const el = bodyRef.current;
      if (el && el.value === note.body) {
        // O singură modificare, de la primul la ultimul rând schimbat, ca Ctrl+Z s-o anuleze.
        const a = note.body, b = r.body;
        let s = 0;
        while (s < a.length && a[s] === b[s]) s++;
        let e = 0;
        while (e < a.length - s && a[a.length - 1 - e] === b[b.length - 1 - e]) e++;
        applyEdit(el, { from: s, to: a.length - e, text: b.slice(s, b.length - e), caret: el.selectionStart });
      } else edit({ body: r.body });
    }
    setStatus(r.checked || r.unchecked
      ? `Din calendar: ${r.checked} ${r.checked === 1 ? 'sarcină bifată' : 'sarcini bifate'}, ${r.unchecked} ${r.unchecked === 1 ? 'redeschisă' : 'redeschise'}.`
      : `Sarcinile notiței erau deja la zi cu calendarul (${r.matched} găsite).`);
  };
  // Export .docx / .odt: notița ca document (titlu, text formatat, liste, tabele, poze, ecuații), direct, fără să treacă prin Docs.
  const exportDoc = async (format: 'docx' | 'odt') => {
    if (!note) return;
    flush();
    const title = shownTitle(note) || 'Notiță';
    try {
      const doc = JSON.parse(await toDoc(note)).content;
      let data: Uint8Array;
      if (format === 'docx') { const { docToDocx } = await import('../docs/docx'); data = await docToDocx(doc); }
      else { const { docToOdt } = await import('../docs/odtExport'); data = await docToOdt(doc); }
      const saved = await api.exportFile({ format, suggestedName: safeFileName(title), data });
      if (saved) setStatus(`Notița e salvată ca .${format}.`);
    } catch (e) {
      alert(`Notița nu s-a putut salva ca .${format}: ${(e as Error).message}`);
    }
  };

  // Export PDF: notițele de tipărit se pun într-o pagină separată (doar la tipărire se vede ea, nu aplicația),
  // apoi Chromium o salvează ca PDF. Fiecare notiță începe pe o pagină nouă.
  const [printing, setPrinting] = useState<Note[] | null>(null);
  const exportPdf = async (all: boolean) => {
    if (!store) return;
    flush();
    const list = all ? search(store.notes, '') : note ? [note] : [];
    if (!list.length) return;
    flushSync(() => setPrinting(list));
    document.body.classList.add('printing-notes');
    try {
      // Pozele trebuie să fie gata desenate înainte de PDF.
      await Promise.all([...document.querySelectorAll<HTMLImageElement>('.notes-print img')].map((i) => i.decode().catch(() => {})));
      await api.exportPdf(all ? 'Notițe' : safeFileName(shownTitle(list[0]) || 'Notiță'));
    } finally {
      document.body.classList.remove('printing-notes');
      setPrinting(null);
    }
  };

  const openOld = async () => {
    const file = await api.openFile('note');
    if (file) importFile(file);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isCurrent('note')) return;
      if (e.key === 'Escape' && picked !== null && !zoom) { setPicked(null); return; }
      if (e.key === 'F3' && find) { e.preventDefault(); findGo(e.shiftKey ? -1 : 1); return; }
      if (e.altKey && !e.ctrlKey && !e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); goHistory(e.key === 'ArrowLeft' ? -1 : 1); return; }
      const free = drawing === false && cropping === null && !zoom && !lockDlg && !summary;
      // Alt+PageUp / Alt+PageDown: prima / ultima pagină din listă; Ctrl+PageUp / Ctrl+PageDown: pagina dinainte / următoare.
      const order = shown.map((x) => x.note);
      if (free && (e.code === 'PageUp' || e.code === 'PageDown') && !e.shiftKey && e.altKey !== e.ctrlKey && order.length) {
        e.preventDefault();
        const at = order.findIndex((n) => n.id === sel), up = e.code === 'PageUp';
        const to = e.altKey ? (up ? 0 : order.length - 1) : at < 0 ? 0 : Math.max(0, Math.min(order.length - 1, at + (up ? -1 : 1)));
        if (order[to].id !== sel) select(order[to].id);
        return;
      }
      if (!e.ctrlKey) return;
      // O fereastră deschisă (desen, decupare, poza mărită) își are scurtăturile ei: Ctrl+Z din desen nu anulează și notița.
      if (drawing !== false || cropping !== null || zoom || lockDlg || summary) return;
      const k = e.key.toLowerCase();
      if ((k === 'z' || k === 'y') && !e.altKey) {
        // În câmpurile de scris, Ctrl+Z anulează textul (ca până acum); în rest anulează schimbările din caiet.
        const t = e.target as HTMLElement | null;
        if (t?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
        e.preventDefault();
        undoStore(k === 'y' || e.shiftKey);
        return;
      }
      if (k === 'e' && !e.altKey && !e.shiftKey) {
        // Ctrl+E: caută în toate caietele (cursorul trece în căutare).
        e.preventDefault();
        if (books.length > 1) setAllBooks(true);
        searchRef.current?.focus(); searchRef.current?.select();
        return;
      }
      if (e.code === 'KeyT' && !e.altKey && !e.shiftKey) { e.preventDefault(); setNavShut(false); setSecEdit({ old: '', name: '' }); return; }
      if (k === 'n' && e.altKey && e.shiftKey) { e.preventDefault(); addSub(); }
      else if (e.altKey && !e.shiftKey && (e.code === 'BracketRight' || e.code === 'BracketLeft') && !lockedView) { e.preventDefault(); if (e.code === 'BracketRight') indentNote(); else outdentNote(); }
      else if (k === 'n' && !e.shiftKey) { e.preventDefault(); add(); }
      else if (k === 'd' && e.shiftKey && !e.altKey) { e.preventDefault(); duplicate(); }
      else if (k === 'f') {
        e.preventDefault();
        const inNote = document.activeElement === bodyRef.current || document.activeElement === titleRef.current;
        if (inNote && note && !lockedView) { setFind((f) => f ?? { q: '', i: -1 }); setTimeout(() => { findRef.current?.focus(); findRef.current?.select(); }, 0); }
        else { searchRef.current?.focus(); searchRef.current?.select(); }
      }
      else if (k === 's') { e.preventDefault(); flush(); }
      else if (k === 'o') { e.preventDefault(); openOld(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Clic dreapta pe o pagină sau pe o secțiune din coloanele din stânga, cu comenzile din programul de notițe cunoscut.
  // Clicul dreapta alege întâi pagina; comenzile rulează după alegere, prin `act` (funcțiile din ultima desenare, cu notița nouă).
  const act = useRef({ remove, duplicate, addSub, indentNote, outdentNote, moveTo, copyTo, edit, store, note, activeBook });
  act.current = { remove, duplicate, addSub, indentNote, outdentNote, moveTo, copyTo, edit, store, note, activeBook };
  const [sideEl, setSideEl] = useState<HTMLElement | null>(null);
  useContextMenu(sideEl, (e): CtxItem[] => {
    const t = e.target as HTMLElement;
    const page = t.closest<HTMLElement>('.notes-item[data-note-id]');
    const sec = t.closest<HTMLElement>('[data-sec]');
    if (page && store) {
      const id = page.dataset.noteId!;
      const n = store.notes.find((x) => x.id === id);
      if (!n) return [];
      if (id !== sel) { select(id); setBoard(false); }
      const a = () => act.current;
      const secs = sectionsIn(store, activeBook);
      const kids = childrenOf(store.notes, id).length;
      return [
        { label: 'Ștergere', run: () => a().remove() },
        { label: 'Redenumire', run: () => setTimeout(() => { titleRef.current?.focus(); titleRef.current?.select(); }, 50), enabled: !n.secret },
        { label: 'Copiere link la pagină', run: () => { void navigator.clipboard?.writeText(`[[${shownTitle(n)}]]`); setStatus(`Am copiat legătura [[${shownTitle(n)}]]: lipește-o în altă notiță.`); } },
        { label: '', sep: true },
        { label: 'Mutare în secțiunea', submenu: [{ label: 'Fără secțiune', run: () => a().moveTo('') }, ...secs.filter((s) => s !== n.section).map((s) => ({ label: s, run: () => a().moveTo(s) }))] },
        { label: 'Copiere în secțiunea', submenu: [{ label: 'Fără secțiune', run: () => a().copyTo('section', '') }, ...secs.map((s) => ({ label: s, run: () => a().copyTo('section', s) }))] },
        { label: 'Duplicare pagină', run: () => a().duplicate() },
        { label: '', sep: true },
        { label: 'Pagină nouă', run: () => add() },
        { label: 'Creare subpagină', run: () => a().addSub() },
        { label: 'Retrogradare subpagină', run: () => a().indentNote() },
        { label: 'Promovare subpagină', run: () => a().outdentNote(), enabled: !!n.parent },
        { label: '', sep: true },
        { label: n.pinned ? 'Anulare fixare' : 'Fixare sus', run: () => { const c = a().note; if (c) a().edit({ pinned: c.pinned ? undefined : true }, false); } },
        ...(kids ? [{ label: `(${kids} subpagini)`, enabled: false }] : []),
      ];
    }
    if (sec && store) {
      const s = sec.dataset.sec!;
      const a = () => act.current;
      return [
        { label: 'Redenumire', run: () => setSecEdit({ old: s, name: sectionPath(a().store ?? store, s) }) },
        { label: 'Ștergere', run: async () => {
          const st = a().store; if (!st) return;
          const count = st.notes.filter((n) => n.section === s).length;
          if (count && !(await askYes(`Ștergi secțiunea „${s}”?\nNotițele ei (${count}) rămân în caiet, fără secțiune.`, 'Șterge secțiunea'))) return;
          change((x) => removeSection(x, s));
          if (activeSection === s) setSection('');
        } },
        { label: '', sep: true },
        { label: 'Pagină nouă în secțiune', run: () => {
          const n = newNote({ section: s, ...(a().activeBook ? { book: a().activeBook } : {}) });
          setSection(s); select(n.id); setBoard(false); setReader(false);
          change((x) => ({ ...x, notes: [...x.notes, n] }));
          setQuery(''); wantFocus.current = true;
        } },
        { label: 'Culoare secțiune', submenu: [
          { label: 'Fără culoare', run: () => change((x) => setSectionColor(x, s, undefined)), checked: !store.sectionColors?.[s] },
          ...Object.entries(COLORS).map(([k, [label]]) => ({ label, run: () => change((x) => setSectionColor(x, s, k)), checked: store.sectionColors?.[s] === k })),
        ] },
      ];
    }
    return [];
  });

  if (!store) return <div className="empty">{loadError || 'Se încarcă notițele…'}</div>;

  // Lista Titlu… (1–6), pe al doilea rând din Stiluri.
  const headingPick = (
    <select value="" onChange={(e) => {
      const v = e.target.value; e.target.value = '';
      const t = bodyRef.current;
      if (!t || !v) return;
      applyEdit(t, /^\d$/.test(v) ? headingEdit(t.value, t.selectionStart, t.selectionEnd, Number(v)) : paraStyleEdit(t.value, t.selectionStart, t.selectionEnd, v));
    }}
      title="Rândul cu cursorul devine titlu (Ctrl+Alt+1 … 6; Ctrl+Alt+0: text obișnuit; Ctrl+Shift+N: golire formatare)" aria-label="Titlu" data-keytip="L">
      <option value="">Titlu…</option>
      <option value="1">Titlu 1 (#)</option>
      <option value="2">Titlu 2 (##)</option>
      <option value="3">Titlu 3 (###)</option>
      <option value="4">Titlu 4</option>
      <option value="5">Titlu 5</option>
      <option value="6">Titlu 6</option>
      {PARA_STYLES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      <option value="0">Text obișnuit</option>
    </select>
  );

  const words = note?.body.trim() ? note.body.trim().split(/\s+/).length : 0;

  return (
    <div className="editor">
      {/* Panglica (INTERFATA.md, C.7): aceleași butoane ca bara veche, grupate în file. Notițele se salvează singure, deci fără 💾. */}
      <Ribbon module="notes" layout={arrange.layout} className="toolbar notes-toolbar"
        quick={<>
          <button onClick={() => goHistory(-1)} disabled={!canBack} title="Înapoi la notița deschisă înainte (Alt+←)" aria-label="Înapoi">◀</button>
          <button onClick={() => goHistory(1)} disabled={!canFwd} title="Înainte (Alt+→)" aria-label="Înainte">▶</button>
          <button onClick={() => undoStore(false)} disabled={!undoN || !undoPast.current.length} title="Anulează ultima schimbare din caiet: o notiță ștearsă, mutată, colorată, o bifă… (Ctrl+Z în afara textului)" aria-label="Anulează">↶</button>
          <button onClick={() => undoStore(true)} disabled={!undoN || !undoFuture.current.length} title="Reface ce ai anulat (Ctrl+Y)" aria-label="Reface">↷</button>
        </>}
        file={<>
          <button role="menuitem" onClick={openOld} title="Aduce în caiet o notiță salvată separat (.snote) — Ctrl+O">Deschide .snote…</button>
          <button role="menuitem" onClick={importFromKeep} title="Aduce notițe dintr-o arhivă de notițe (.zip/.json din Takeout), dintr-un export .enex sau din notițe exportate ca .docx">Importă notițe…</button>
          <div className="ribbon-head">Export</div>
          <button role="menuitem" onClick={() => exportMd(false)} disabled={!note} title="Salvează notița deschisă ca fișier Markdown (.md), pentru Obsidian, Joplin, Notepad">Export .md</button>
          <button role="menuitem" onClick={() => exportMd(true)} disabled={!store.notes.length} title="Toate notițele într-un singur fișier Markdown (.md)">Export toate (.md)</button>
          <button role="menuitem" onClick={exportHtml} disabled={!note || lockedView} title="Notița deschisă ca pagină web (.html), cu pozele incluse: se deschide în orice browser și se poate trimite oricui">Export .html</button>
          <button role="menuitem" onClick={exportMht} disabled={!note || lockedView} title="Notița ca pagină web într-un singur fișier (.mht), cu pozele în el: se deschide în browser și în programele de birou care citesc .mht">Export .mht</button>
          <button role="menuitem" className="notes-export-docx" onClick={() => exportDoc('docx')} disabled={!note || lockedView} title="Notița ca document .docx (titlu, text formatat, liste, tabele, poze), direct, fără să treacă prin Docs">Export .docx</button>
          <button role="menuitem" className="notes-export-odt" onClick={() => exportDoc('odt')} disabled={!note || lockedView} title="Notița ca document .odt (titlu, text formatat, liste, tabele, poze), direct, fără să treacă prin Docs">Export .odt</button>
          <button role="menuitem" className="notes-export-ics" onClick={exportTasks} disabled={!note || lockedView} title="Rândurile de bifat (☐ / ☑) ca sarcini într-un fișier .ics: programele de e-mail și de calendar le pun în lista lor de sarcini; mementoul notiței devine termenul">Export sarcini (.ics)</button>
          <button role="menuitem" className="notes-import-ics" onClick={() => void importTasks()} disabled={!note || lockedView} title="Sarcinile bifate în programul de calendar, aduse înapoi: alegi fișierul .ics cu ele (exportat de acolo), iar rândurile notiței se bifează sau se debifează la fel">Import sarcini (.ics)…</button>
          <button role="menuitem" onClick={() => exportPdf(false)} disabled={!note} title="Notița deschisă ca PDF (text, liste, poze)">Export PDF</button>
          <button role="menuitem" onClick={() => exportPdf(true)} disabled={!store.notes.length} title="Tot caietul într-un PDF, fiecare notiță pe pagina ei">PDF toate</button>
          <div className="ribbon-head">Trimite</div>
          <button role="menuitem" onClick={() => void mailNote()} disabled={!note || lockedView} title="Deschide un mesaj nou în programul tău de e-mail, cu titlul notiței ca subiect și notița în mesaj, cu formatarea și pozele ei. Nu se trimite nimic până nu apeși tu Trimite acolo">✉ Trimite prin e-mail</button>
          {note && (onOpenDoc || onOpenSheet) && <div className="ribbon-head">Fă din notiță</div>}
          {note && onOpenDoc && <button role="menuitem" onClick={async () => { flush(); onOpenDoc({ path: '', content: await toDoc(note) }); }} disabled={lockedView} title="Fă din notiță un document Docs (titlu, text, poze), ca să-l formatezi și să-l tipărești">→ Docs</button>}
          {note && onOpenSheet && <button role="menuitem" onClick={() => { flush(); onOpenSheet({ path: '', content: noteToSheet(note) }); }} disabled={lockedView || !sheetRows(note).length} title="Fă din lista de bifat un tabel Sheets (Nr., De făcut, Gata Da/Nu, câte sunt făcute); fără bife, fiecare rând devine un rând de tabel">→ Sheets</button>}
          <div className="ribbon-head">Istoric</div>
          <button role="menuitem" onClick={() => { flush(); setVerDlg(true); }} title="Variantele mai vechi ale caietului, păstrate automat">Versiuni</button>
        </>}
        right={<>{arrange.menu}<span className="toolbar-file" title={storePath ?? ''}>Salvare automată</span></>}
        tabs={[
          { id: 'home', label: 'Pornire', content: <>
            <ClipboardGroup focus={() => bodyRef.current?.focus()} />
            {note && !lockedView && !reader && (<>
              <RGroup label="Text de bază" keep>
                <div className="rb-rows notes-format" role="group" aria-label="Formatare">
                  <div className="rb-row">
                      <select value="" data-keytip="FF" className="notes-font" onChange={(e) => {
                        const v = e.target.value; e.target.value = ''; if (!v) return;
                        if (v[0] === 'n') { edit({ font: v.slice(2) || undefined }, false); return; }
                        const t = bodyRef.current; if (t) applyEdit(t, styleEdit(t.value, t.selectionStart, t.selectionEnd, v.slice(2), 'f'));
                      }}
                        title={'Fontul textului selectat ({font Georgia:text}) sau al întregii notițe' + (note.font ? ' (acum: ' + note.font + ')' : '')} aria-label="Font">
                        <option value="">𝐅 Font…</option>
                        <optgroup label="Textul selectat">
                          {INK_FONTS.map(([n, css]) => <option key={'s' + n} value={'s:' + n} style={{ fontFamily: css }}>{n}</option>)}
                          <option value="s:">Fontul obișnuit</option>
                        </optgroup>
                        <optgroup label="Toată notița">
                          {INK_FONTS.map(([n, css]) => <option key={'n' + n} value={'n:' + n} style={{ fontFamily: css }}>{(note.font === n ? '✓ ' : '') + n}</option>)}
                          <option value="n:">{(note.font ? '' : '✓ ') + 'Fontul obișnuit'}</option>
                        </optgroup>
                      </select>
                          <select value="" data-keytip="FS" className="notes-size" onChange={(e) => { const v = e.target.value; e.target.value = ''; const t = bodyRef.current; if (!t || !v) return; applyEdit(t, styleEdit(t.value, t.selectionStart, t.selectionEnd, v.slice(1), 'sz')); }}
                        title="Mărimea textului selectat: pune {mare:text} / {mic:text}; în Lectură, → Docs și .html se vede mai mare sau mai mic" aria-label="Mărimea textului">
                        <option value="">Aa Mărime…</option>
                        {INK_SIZES.map(([n, em]) => <option key={n} value={':' + n} style={{ fontSize: Math.min(em, 1.4) + 'em' }}>{n[0].toUpperCase() + n.slice(1)}</option>)}
                        <option value=":">Mărime obișnuită</option>
                      </select>
                          <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => bodyRef.current && toggleBullets(bodyRef.current, 'bullet')}
                        title="Rândurile selectate devin o listă cu buline (Ctrl+. sau Ctrl+Shift+8); Enter continuă lista, Tab face o sub-listă"
                       aria-label="• Listă" data-keytip="U"><span className="rb-ico">•</span><span className="rb-txt rb-opt">Listă</span></button>
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => bodyRef.current && toggleBullets(bodyRef.current, 'number')}
                        title="Rândurile selectate devin o listă numerotată (Ctrl+/ sau Ctrl+Shift+7); Enter pune numărul următor"
                       aria-label="1. Numerotată" data-keytip="N"><span className="rb-ico">1.</span><span className="rb-txt rb-opt">Numerotată</span></button>
                      <button onMouseDown={(e) => e.preventDefault()} onClick={() => { const t = bodyRef.current; if (t) applyEdit(t, clearEdit(t.value, t.selectionStart, t.selectionEnd)); }}
                        title="Golire formatare (Ctrl+Shift+N): rândul cu cursorul (sau rândurile selectate) redevine text obișnuit, fără titlu, aldin, culori sau aliniere" aria-label="⌫ Golire formatare" data-keytip="E"><span className="rb-ico">⌫</span><span className="rb-txt rb-opt">Golire formatare</span></button>
                      </div>
                  <div className="rb-row">
                      {([['**', 'Aldin (Ctrl+B)', <b key="b">B</b>], ['*', 'Cursiv (Ctrl+I)', <i key="i">I</i>], ['++', 'Subliniat (Ctrl+U)', <u key="u">U</u>], ['~~', 'Tăiat (Ctrl+− sau Ctrl+Shift+X)', <s key="s">S</s>], ['==', 'Evidențiat cu galben (Ctrl+Alt+H sau Ctrl+Shift+H)', <mark key="h">H</mark>]] as [Wrap, string, JSX.Element][]).map(([m, t, label]) => (
                        <button key={m} onMouseDown={(e) => e.preventDefault()} onClick={() => wrapBody(m)} title={`${t}: pune semnele în jurul textului selectat; în Lectură și la export se vede formatat. Din nou: le scoate.`} aria-label={t} data-keytip={({ '**': '1', '*': '2', '++': '3', '~~': '4', '==': 'I' } as Record<string, string>)[m]}>{label}</button>
                      ))}
                          <select value="" data-keytip="FC" className="notes-color" onChange={(e) => { const v = e.target.value; e.target.value = ''; const t = bodyRef.current; if (!t || !v) return; applyEdit(t, colorEdit(t.value, t.selectionStart, t.selectionEnd, v.slice(2), v[0] === 'b')); }}
                        title="Culoarea textului selectat sau a evidențierii lui: pune {roșu:text} / {fundal verde:text}; în Lectură, → Docs și .html se vede colorat" aria-label="Culoare">
                        <option value="">🎨 Culoare…</option>
                        <optgroup label="Culoarea textului">
                          {INK_COLORS.map(([n, fg]) => <option key={'t' + n} value={'t:' + n} style={{ color: fg }}>{n[0].toUpperCase() + n.slice(1)}</option>)}
                          <option value="t:">Fără culoare</option>
                        </optgroup>
                        <optgroup label="Evidențiere">
                          {INK_COLORS.map(([n, , bg]) => <option key={'b' + n} value={'b:' + n} style={{ background: bg }}>{'Fundal ' + n}</option>)}
                          <option value="b:">Fără evidențiere</option>
                        </optgroup>
                      </select>
                          <select value="" data-keytip="AL" className="notes-align" onChange={(e) => { const v = e.target.value; e.target.value = ''; const t = bodyRef.current; if (!t || !v) return; applyEdit(t, alignEdit(t.value, t.selectionStart, t.selectionEnd, v.slice(1))); }}
                        title="Alinierea rândului cu cursorul (sau a rândurilor selectate): pune {la centru:…}; în Lectură, → Docs și .html se vede aliniat (Ctrl+L / Ctrl+R / Ctrl+J)" aria-label="Aliniere">
                        <option value="">⇔ Aliniere…</option>
                        <option value=":">⯇ La stânga (Ctrl+L)</option>
                        <option value=":la centru">≡ La centru</option>
                        <option value=":la dreapta">⯈ La dreapta (Ctrl+R)</option>
                        <option value=":stânga-dreapta">☰ Stânga-dreapta (Ctrl+J)</option>
                      </select>
                      </div>
                </div>
              </RGroup>
              <RGroup label="Stiluri">
                <div className="rb-rows notes-format notes-styles" role="group" aria-label="Stiluri">
                  {[[[1, 'Titlu 1'], [2, 'Titlu 2']], [[0, 'Normal']]].map((row, ri) => (
                    <div className="rb-row" key={ri}>
                      {(row as [number, string][]).map(([lv, name]) => (
                        <button key={lv} className="notes-style" onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { const t = bodyRef.current; if (t) applyEdit(t, headingEdit(t.value, t.selectionStart, t.selectionEnd, lv)); }}
                          title={name + (lv ? ' (Ctrl+Alt+' + lv + ')' : ': text obișnuit (Ctrl+Alt+0)')}>{name}</button>
                      ))}
                      {ri === 1 && headingPick}
                    </div>
                  ))}
                </div>
              </RGroup>
            </>)}
            {note && (
              <RGroup label="Etichete">
                <div className="rb-rows">
                  <div className="rb-row">
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => bodyRef.current && toggleList(bodyRef.current)}
                      title="Rândurile selectate devin o listă de bifat (Ctrl+1 sau Ctrl+Shift+L); click pe căsuță o bifează"
                     aria-label="☐ Listă de bifat" data-keytip="TD"><span className="rb-ico">☐</span><span className="rb-txt rb-opt">De făcut</span></button>
                        {!lockedView && LINE_MARKS.slice(0, 2).map(([mk, label], i) => (
                      <button key={mk} onMouseDown={(e) => e.preventDefault()} onClick={() => bodyRef.current && toggleMark(bodyRef.current, mk)}
                        title={`${label} (Ctrl+${i + 2}): pune semnul la începutul rândului; din nou îl scoate`} aria-label={mk + ' ' + label}><span className="rb-ico">{mk}</span><span className="rb-txt rb-opt">{label}</span></button>
                    ))}
                      </div>
                  <div className="rb-row">
                    {!lockedView && (
                      <select
                        className="notes-marks"
                        value=""
                        onChange={(e) => { const mk = e.target.value; e.target.value = ''; if (mk && bodyRef.current) toggleMark(bodyRef.current, mk); }}
                        title="Pune un semn la începutul rândului; le găsești pe toate în 🏷 Rezumat. Din nou: îl scoate."
                        aria-label="Semn pe rând" data-keytip="TG"
                      >
                        <option value="">⭐ Semn pe rând…</option>
                        {LINE_MARKS.map(([mk, label], i) => <option key={mk} value={mk}>{mk} {label} (Ctrl+{i + 2})</option>)}
                      </select>
                    )}
                        {!lockedView && progress(note.body).total > 0 && (
                      <select
                        className="notes-checked"
                        value=""
                        onChange={(e) => {
                          const w = e.target.value as 'bottom' | 'uncheck' | 'remove' | 'auto';
                          e.target.value = '';
                          if (w === 'auto') {
                            const on = !autoBottom;
                            setAutoBottom(on);
                            try { localStorage.setItem('suite.notes.autoBottom', on ? '1' : '0'); } catch { /* fără memorie locală */ }
                            if (on && bodyRef.current) applyChecked(bodyRef.current, 'bottom');
                            setStatus(on ? 'Elementele bifate coboară singure la sfârșitul listei.' : 'Elementele bifate rămân pe loc.');
                          } else if (w && bodyRef.current) applyChecked(bodyRef.current, w);
                        }}
                        title="Ce faci cu elementele bifate din listă"
                        aria-label="Elementele bifate"
                      >
                        <option value="">☑ Bifate…</option>
                        <option value="bottom">Mută bifatele jos</option>
                        <option value="uncheck">Debifează tot</option>
                        <option value="remove">Șterge elementele bifate</option>
                        <option value="auto">{autoBottom ? '✓ ' : ''}Mută bifatele jos automat</option>
                      </select>
                    )}
                        <button onClick={() => setSummary(true)} title="Găsire etichete: tot ce e de făcut (☐) și rândurile cu semne, din toate notițele" aria-label="🏷 Găsire etichete"><span className="rb-ico">🏷</span><span className="rb-txt rb-opt">Găsire etichete</span></button>
                      </div>
                </div>
              </RGroup>
            )}
            <RGroup label="Notiță">
              <div className="rb-rows">
              <div className="rb-row">
              <button onClick={() => add()} title="Ctrl+N">+ Notiță nouă</button>
              <select className="notes-tpl" value="" onChange={(e) => { const k = e.target.value; e.target.value = ''; if (k) add(k); }}
                title="Notiță nouă dintr-un șablon: ședință, cumpărături, plan săptămânal, jurnal, rețetă, proiect, curs, bagaj, apel telefonic, priorități, carte citită, medic" aria-label="Notiță nouă din șablon">
                <option value="">📋 Din șablon…</option>
                {TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              {note && (
                <select className="notes-pages" value="" aria-label="Pagini și subpagini"
                  onChange={(e) => { const v = e.target.value; e.target.value = ''; if (v === 'new') addSub(); else if (v === 'in') indentNote(); else if (v === 'out') outdentNote(); }}
                  title="Subpagini: o notiță poate sta sub alta în listă (cel mult două niveluri), ca paginile unui caiet">
                  <option value="">📑 Subpagini…</option>
                  <option value="new">+ Subpagină nouă (Ctrl+Alt+Shift+N)</option>
                  <option value="in">→ Fă subpagină a celei de deasupra (Ctrl+Alt+])</option>
                  <option value="out">← Urcă un nivel (Ctrl+Alt+[)</option>
                </select>
              )}
              {note && (
                  <button
                    className={note.pinned ? 'on' : ''}
                    onClick={() => edit({ pinned: !note.pinned }, false)}
                    title={note.pinned ? 'Notița nu mai stă sus în listă' : 'Ține notița sus în listă'}
                  >📌 {note.pinned ? 'Desprinde' : 'Fixează'}</button>
              )}
              </div>
              <div className="rb-row">
              {note && (
                  <span className="notes-colors" role="group" aria-label="Culoarea notiței">
                    <button
                      className={`notes-swatch none ${!note.color ? 'on' : ''}`}
                      onClick={() => edit({ color: undefined }, false)}
                      title="Fără culoare"
                      aria-label="Fără culoare"
                    />
                    {Object.entries(COLORS).map(([k, [label]]) => (
                      <button
                        key={k}
                        className={`notes-swatch ${note.color === k ? 'on' : ''}`}
                        style={{ background: `var(--note-${k})` }}
                        onClick={() => edit({ color: k }, false)}
                        title={label}
                        aria-label={label}
                      />
                    ))}
                  </span>
              )}
              {note && books.length > 1 && (
                <select className="notes-move notes-move-book" value={note.book ?? ''} onChange={(e) => (e.target.value.startsWith(COPY) ? copyTo('book', e.target.value.slice(1)) : moveToBookOf(e.target.value))} title="Caietul notiței: alege altul ca s-o muți, sau „Copiază în” ca să faci o copie acolo" aria-label="Caietul notiței">
                  {books.map((b) => <option key={b} value={b}>📓 {b || MAIN_BOOK}</option>)}
                  <optgroup label="⧉ Copiază în caietul…">
                    {books.filter((b) => b !== (note.book ?? '')).map((b) => <option key={COPY + b} value={COPY + b}>⧉ {b || MAIN_BOOK}</option>)}
                  </optgroup>
                </select>
              )}
              {note && sections.length > 0 && (
                <select className="notes-move" value={note.section ?? ''} onChange={(e) => (e.target.value.startsWith(COPY) ? copyTo('section', e.target.value.slice(1)) : moveTo(e.target.value))} title="Secțiunea notiței: alege alta ca s-o muți, sau „Copiază în” ca să faci o copie acolo" aria-label="Secțiunea notiței">
                  <option value="">📂 Fără secțiune</option>
                  {sections.map((s) => <option key={s} value={s}>📂 {s}</option>)}
                  <optgroup label="⧉ Copiază în secțiunea…">
                    {sections.filter((s) => s !== note.section).map((s) => <option key={COPY + s} value={COPY + s}>⧉ {s}</option>)}
                  </optgroup>
                </select>
              )}
              </div>
              </div>
              <RMore>
                <button onClick={duplicate} disabled={!note} title="Fă o copie a notiței deschise (text, poze, PDF-uri, etichete), ca s-o folosești ca șablon (Ctrl+Shift+D)">⧉ Copie</button>
                {note && (
                  <button className={note.archived ? 'on' : ''} onClick={archive} title={note.archived ? 'Notița revine în lista obișnuită' : 'Ascunde notița din listă, fără s-o ștergi (o găsești la căutare sau la 🗄 Arhivă)'}>
                    🗄 {note.archived ? 'Scoate din arhivă' : 'Arhivează'}
                  </button>
                )}
                <button onClick={remove} disabled={!note} title="Șterge notița deschisă">Șterge</button>
              </RMore>
            </RGroup>
          </> },
          { id: 'insert', label: 'Inserare', content: <>
            {note && !lockedView && !reader && (
              <RGroup label="Tabel" keep>
                <span className="notes-format">
                  <select value="" onChange={(e) => { const [c, r] = e.target.value.split('x').map(Number); e.target.value = ''; if (c && bodyRef.current) insertTable(c, r); }}
                    title="Pune un tabel la cursor: rânduri „| a | b |”, primul rând e capul tabelului; în Lectură, la export în Docs și ca pagină web e un tabel adevărat" aria-label="Tabel">
                    <option value="">⊞ Tabel…</option>
                    {['2x2', '3x3', '4x3', '5x4'].map((v) => <option key={v} value={v}>{v.replace('x', ' coloane × ')} rânduri</option>)}
                  </select>
                </span>
                <button className="notes-sheettable" onClick={() => insertSheet()}
                  title="Foaie de calcul: o foaie dintr-un fișier .xlsx, .ods sau .csv intră în notiță ca tabel, cu valorile formulelor calculate">▦ Foaie de calcul…</button>
                {note?.sheetLinks?.length ? <button className="notes-sheetrefresh" disabled={sheetBusy} onClick={() => void refreshSheets()}
                  title="Reîmprospătează foile: tabelele puse din fișiere .xlsx / .ods / .csv se citesc din nou din fișier, cu valorile de acum (tabelele schimbate de mână rămân cum sunt)">↻ Reîmprospătează foile</button> : null}
                {/* ✎ Deschide: fișierul fiecărui tabel pus din foaie de calcul (cel mult 4), în Sheets, pe foaia lui; apoi ↻ Reîmprospătează foile. */}
                {[...new Map((note?.sheetLinks ?? []).map((l) => [l.path.toLowerCase(), l] as const)).values()].slice(0, 4).map((l) => (
                  <button key={l.path} className="notes-sheetopen" onClick={() => { openPath(l.path, l.sheet); setStatus(`Foaia „${l.sheet}” e deschisă în Sheets: schimb-o și salveaz-o, iar tabelul de aici se aduce singur la zi.`); }}
                    title="Deschide în Sheets fișierul din care e pus tabelul (într-un tab nou sau în cel deja deschis); după ce îl schimbi și îl salvezi, tabelul de aici se aduce singur la zi">✎ Deschide {l.path.split(/[\\/]/).pop()}</button>
                ))}
                <button className="notes-canvas" onClick={() => addCanvasBox()}
                  title="Casetă liberă: o casetă de text pe pânza de sub notiță, pe care o muți oriunde trăgând de bara ei (dublu clic pe pânză pune încă una)">▣ Casetă liberă</button>
                <button className="notes-canvas-draw" onClick={() => setCanvasDraw({})}
                  title="Desen pe pânză: un desen de mână pus pe pânza de sub notiță, pe care îl muți oriunde și îl redeschizi cu ✎">✎ Desen pe pânză</button>
                <button className="notes-diagram" onClick={() => setDiagramOpen(true)}
                  title="Schemă: proces, ciclu, piramidă, ierarhie, Venn, pâlnie, cronologie… Scrii elementele câte unul pe rând, iar schema intră în notiță ca poză (elementele se găsesc la căutare).">◇ Schemă…</button>
                <button className="notes-model3d" onClick={() => setModel3dOpen(true)}
                  title="Model 3D: un .obj sau .stl, rotit cu mouse-ul cum vrei și pus în notiță ca poză (numele fișierului se găsește la căutare)">🧊 Model 3D…</button>
                {sheetPick && (
                  <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setSheetPick(null); }}>
                    <div className="print-dlg" role="dialog" aria-label="Alege foaia" onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setSheetPick(null); } }}>
                      <h3>Alege foaia</h3>
                      <p className="print-info">{sheetPick.base} are {sheetPick.sheets.length} foi. Care intră în notiță?</p>
                      <select autoFocus size={Math.min(8, sheetPick.sheets.length)} value={sheetPick.i} aria-label="Foaia" style={{ width: '100%' }}
                        onChange={(e) => setSheetPick({ ...sheetPick, i: Number(e.target.value) })}
                        onDoubleClick={() => { setSheetPick(null); void putSheet(sheetPick.base, sheetPick.sheets[sheetPick.i], sheetPick.path); }}>
                        {sheetPick.sheets.map((x, i) => <option key={i} value={i}>{x.name}</option>)}
                      </select>
                      <div className="print-actions">
                        <button onClick={() => setSheetPick(null)}>Renunță</button>
                        <button className="primary" onClick={() => { setSheetPick(null); void putSheet(sheetPick.base, sheetPick.sheets[sheetPick.i], sheetPick.path); }}>Inserează</button>
                      </div>
                    </div>
                  </div>
                )}
              </RGroup>
            )}
            {/* Ordinea grupurilor ca în programul de notițe cunoscut: Tabele, Fișiere, Imagini, Linkuri, Înregistrare, Marcaj de timp, Simboluri. */}
            {note && !note.secret && (
              <RGroup label="Fișiere">
                <button onClick={pickPdf} title="Atașează un fișier de orice fel (sau trage-l în notiță): PDF-ul se deschide în Cyber Office Studio, celelalte se păstrează lângă caiet și le salvezi oricând o copie">📎 Fișier</button>
              </RGroup>
            )}
            {note && !note.secret && (
              <RGroup label="Imagini">
                <div className="rb-rows rb-stack">
                  <div className="rb-row"><button onClick={() => void pickShot()} title="Captură de ecran: poza unei ferestre deschise sau o bucată decupată din ecran">📸 Captură</button></div>
                  <div className="rb-row"><button onClick={pickImages} title="Pune poze în notiță (sau lipește cu Ctrl+V, ori trage-le aici)">🖼 Poză</button></div>
                  <div className="rb-row"><button onClick={() => setDrawing(true)} title="Desen de mână (mouse, creion sau deget); se pune în notiță ca poză">✎ Desen</button></div>
                  <div className="rb-row"><button data-insert-icons onClick={() => setIconsOpen(true)} title="Pictograme: desene simple (telefon, e-mail, oameni, săgeți, semne), în culoarea aleasă; intră în notiță ca poze">☺ Pictograme</button></div>
                </div>
              </RGroup>
            )}
            {note && !lockedView && !reader && (
              <RGroup label="Linkuri">
                <button onMouseDown={(e) => e.preventDefault()} onClick={() => bodyRef.current && insertLink(bodyRef.current)}
                  title="Legătură (Ctrl+K): textul ales devine „text (https://…)”; scrie adresa între paranteze">🔗 Legătură</button>
              </RGroup>
            )}
            {note && !note.secret && (
              <RGroup label="Înregistrare">
                {recSec === null
                  ? <div className="rb-rows rb-stack">
                    <div className="rb-row"><button onClick={() => void startRecord()} title="Înregistrează sunet cu microfonul (o ședință, un curs, o idee spusă); se pune în notiță">🎙 Înregistrează</button></div>
                    <div className="rb-row"><button onClick={() => void startRecord(true)} title="Filmează cu camera (cu sunet): o explicație, o demonstrație, un mesaj; clipul se pune în notiță">📹 Video</button></div>
                  </div>
                  : <button className="on notes-rec" onClick={stopRecord} title="Oprește înregistrarea și pune-o în notiță">⏹ Oprește {clock(recSec)}</button>}
              </RGroup>
            )}
            {note && !lockedView && (
              <RGroup label="Marcaj de timp">
                <div className="rb-rows rb-stack">
                  <div className="rb-row"><button onMouseDown={(e) => e.preventDefault()} onClick={() => bodyRef.current && insertAtCursor(bodyRef.current, dateStamp(new Date(), 'date'))}
                    title="Scrie data de azi la cursor (Alt+Shift+D)">📅 Dată</button></div>
                  <div className="rb-row"><button onMouseDown={(e) => e.preventDefault()} onClick={() => bodyRef.current && insertAtCursor(bodyRef.current, dateStamp(new Date(), 'time'))}
                    title="Scrie ora de acum la cursor (Alt+Shift+T)">🕐 Oră</button></div>
                  <div className="rb-row"><button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => bodyRef.current && insertAtCursor(bodyRef.current, dateStamp(new Date(), 'both'))}
                    title="Scrie data și ora de acum la cursor (Alt+Shift+D: doar data, Alt+Shift+T: doar ora)"
                  >📅 Dată și oră</button></div>
                </div>
              </RGroup>
            )}
            {note && !lockedView && (
              <RGroup label="Simboluri">
                <button onMouseDown={(e) => e.preventDefault()} onClick={openEquation}
                  title="Ecuație: fracții, puteri, radicali, sume, integrale, litere grecești. Se scrie în notiță ca {ecuație:…} și se vede desenată în 📖 Lectură, în .html și în → Docs. Cu cursorul pe o ecuație, o schimbi.">√x Ecuație</button>
                <SymbolPicker className="" onInsert={(ch) => bodyRef.current && insertAtCursor(bodyRef.current, ch)} />
              </RGroup>
            )}
            {note && (
              <RGroup label="Memento">
                <button className={note.remind ? 'on' : ''} onClick={() => setRemindOpen((o) => !o)} title="Memento: primești o notificare cu notița la data și ora alese (cât timp Cyber Office Studio e pornită)">
                  ⏰ {note.remind ? remindText(note) : 'Memento'}
                </button>
              </RGroup>
            )}
          </> },
          { id: 'draw', label: 'Desenare', keytip: 'D', content: <>
            {/* Ca în programul de notițe cunoscut: Unelte · Stilouri · Forme · Foaie · Desen. O unealtă aleasă deschide pânza de desen cu ea. */}
            {note && !note.secret && !lockedView && !reader && (<>
              <RGroup label="Unelte">
                {DRAW_TOOLS.filter(([t]) => !DRAW_SHAPES.includes(t)).map(([t, label, title]) => (
                  <button key={t} data-tool={t} className={pen.tool === t ? 'on' : ''} title={`${title} (deschide pânza de desen)`} onClick={() => openDraw({ tool: t })}>{label}</button>
                ))}
              </RGroup>
              <RGroup label="Stilouri" keep>
                <div className="rb-rows">
                  <div className="rb-row">
                    {DRAW_COLORS.map(([c, name]) => (
                      <button key={c} className={`notes-swatch ${pen.color === c ? 'on' : ''}`} style={{ background: c }} title={`Culoarea stiloului: ${name}`} aria-label={name}
                        onClick={() => setPenWith({ color: c, tool: pen.tool === 'erase' || pen.tool === 'lasso' ? 'pen' : pen.tool })} />
                    ))}
                  </div>
                  <div className="rb-row">
                    {DRAW_SIZES.map(([s, name]) => (
                      <button key={s} className={pen.size === s ? 'on' : ''} title={'Grosimea: ' + name} aria-label={name} onClick={() => setPenWith({ size: s })}>
                        <span className="notes-pen-dot" style={{ width: s + 2, height: s + 2 }} />
                      </button>
                    ))}
                  </div>
                </div>
              </RGroup>
              <RGroup label="Forme">
                {DRAW_TOOLS.filter(([t]) => DRAW_SHAPES.includes(t)).map(([t, label, title]) => (
                  <button key={t} data-tool={t} className={pen.tool === t ? 'on' : ''} title={`${title} (deschide pânza de desen)`} onClick={() => openDraw({ tool: t })}>{label}</button>
                ))}
              </RGroup>
              <RGroup label="Foaie" keep>
                <select value={pen.paper} onChange={(e) => setPenWith({ paper: e.target.value as DrawPaper })} title="Foaia pânzei de desen: albă, cu linii sau cu pătrățele" aria-label="Foaia de desen">
                  {DRAW_PAPERS.map(([p, name]) => <option key={p} value={p}>{name}</option>)}
                </select>
              </RGroup>
              <RGroup label="Desen">
                <button className="rb-big" onClick={() => openDraw({})} title="Deschide pânza de desen cu stiloul ales; desenul se pune în notiță și rămâne editabil (✎ pe el)" aria-label="Pânză de desen"><span className="rb-ico">✎</span><span className="rb-txt">Pânză de desen</span></button>
                {picked !== null && note.images?.[picked] && <button onClick={() => setDrawing(picked)} title="Desenează sau scrie peste poza aleasă (săgeți, cercuri, marker)">✎ Peste poza aleasă</button>}
              </RGroup>
            </>)}
            {(!note || note.secret || lockedView || reader) && <RGroup label="Desen"><span className="notes-hint">Deschide o notiță ca să desenezi în ea.</span></RGroup>}
          </> },
          { id: 'review', label: 'Revizuire', content: <>
            {note && !lockedView && !reader && (
              <RGroup label="Verificare" keep>
                <button onMouseDown={(e) => e.preventDefault()} onClick={() => { const t = bodyRef.current; setDiaSel(t && document.activeElement === t && t.selectionEnd > t.selectionStart ? [t.selectionStart, t.selectionEnd] : null); }}
                  title="Diacritice automate: „sedinta de sambata” → „ședința de sâmbătă”, în textul selectat sau în toată notița; cuvintele cu mai multe forme corecte se arată pentru alegere">Diacritice</button>
                <button onMouseDown={(e) => e.preventDefault()} onClick={() => setGramOn(!gramOn)} className={gramOn ? 'active' : undefined}
                  title="Gramatică: cuvinte repetate, spații, punctuație, literă mare, forme greșite, pleonasme și acordul verbului, cu forma corectă">✓ Gramatică</button>
              </RGroup>
            )}
            {note && !lockedView && !reader && (
              <RGroup label="Accesibilitate" keep>
                <span className="notes-format">
                  <button onMouseDown={(e) => e.preventDefault()} onClick={() => setA11y(a11y ? null : checkNote(note.title, note.body))} className={a11y ? 'active' : undefined}
                    title="Verifică accesibilitatea: titlul, ordinea titlurilor, tabelele fără cap, legăturile neclare, textul colorat greu de citit" aria-label="Verifică accesibilitatea">♿ Accesibilitate</button>
                </span>
              </RGroup>
            )}
            <RGroup label="Protecție">
              {note && !note.secret && <button onClick={() => { setPwError(''); setPw1(''); setPw2(''); setLockDlg(true); }} title="Blochează notița cu o parolă (textul, pozele și PDF-urile se criptează)">🔒 Blochează</button>}
              {opened && <button onClick={relock} title="Ascunde din nou conținutul notiței (se ascunde și singur după 5 minute fără activitate)">🔒 Blochează la loc</button>}
              {opened && <button onClick={removePassword} title="Notița nu mai cere parolă">Scoate parola</button>}
            </RGroup>
            <RGroup label="Istoric">
              <button onClick={() => { flush(); setVerDlg(true); }} title="Variantele mai vechi ale caietului, păstrate automat">Versiuni</button>
            </RGroup>
          </> },
          { id: 'view', label: 'Vizualizare', content: <>
            {/* Ordinea ca în programul de notițe cunoscut: Vizualizări, Configurare pagină, Zoom. */}
            {(
              <RGroup label="Vizualizări">
                <button className={!board ? 'on' : ''} aria-pressed={!board} onClick={() => setBoard(false)} title="Listă: paginile în coloana din stânga, notița deschisă alături">☰ Listă</button>
                <button className={board ? 'on' : ''} aria-pressed={board} onClick={() => setBoard(true)} title="Carduri: notițele ca niște cartonașe pe tot ecranul, cu cele fixate sus și „Ia o notiță…” deasupra">▦ Carduri</button>
                {note && <>
                <button className={reader ? 'on' : ''} onClick={() => setReader((r) => !r)} disabled={lockedView} title="Lectură: notița doar de citit, cu literă mare, spațiere largă, fundal sepia și citire cu voce tare (Esc iese)">📖 Lectură</button>
                {!lockedView && !reader && <button className={liveFmt ? 'on' : ''} aria-pressed={liveFmt} onClick={() => setLiveFmt(!liveFmt)} title="Formatare la vedere: aldinul, cursivul, culorile și titlurile se văd direct în câmpul de scris; semnele lor (**, acoladele) rămân estompate">𝐁 Formatare la vedere</button>}
                <button onClick={() => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else mainRef.current?.requestFullscreen().catch(() => setStatus('Ecranul întreg nu e disponibil aici.')); }} title="Notița pe tot ecranul, fără listă și bare, ca să scrii sau să citești liniștit (Esc iese)">⛶ Ecran complet</button>
                </>}
              </RGroup>
            )}
            {note && (
              <RGroup label="Configurare pagină" keep>
                <select className={`notes-bg ${note.bg ? 'on' : ''}`} value={note.bg ?? ''} onChange={(e) => edit({ bg: e.target.value || undefined }, false)}
                  title="Fundal ilustrat: un model discret sub text, care se vede și în listă" aria-label="Fundalul notiței">
                  <option value="">🖼 Fără fundal</option>
                  {Object.entries(BACKGROUNDS).map(([k, [label, a]]) => <option key={k} value={k}>{a} {label}</option>)}
                </select>
                {!lockedView && !reader && (
                  <select className={`notes-paper ${note.paper ? 'on' : ''}`} value={note.paper ?? ''} onChange={(e) => edit({ paper: (e.target.value || undefined) as NotePaper | undefined }, false)}
                    title="Foaia de sub text, ca într-un caiet: simplă, cu linii sau cu pătrățele" aria-label="Foaia notiței">
                    {(['', 'lines', 'grid'] as const).map((k) => <option key={k} value={k}>{NOTE_PAPERS[k]}</option>)}
                  </select>
                )}
              </RGroup>
            )}
            {note && (
              <RGroup label="Zoom">
                <button onClick={() => setTextZoom(nextZoom(textZoom, -1))} title="Micșorare: textul notiței mai mic (Ctrl + rotița în jos)">－ Micșorare</button>
                <button onClick={() => setTextZoom(nextZoom(textZoom, 1))} title="Mărire: textul notiței mai mare (Ctrl + rotița în sus)">＋ Mărire</button>
                <button className={textZoom === 100 ? 'on' : ''} onClick={() => setTextZoom(100)} title="Textul notiței la mărimea obișnuită">100%</button>
              </RGroup>
            )}
            {api.dockWindow && (
              <RGroup label="Fereastră">
                <button className={`notes-dock ${winSt.docked ? 'on' : ''}`} aria-pressed={winSt.docked} onClick={() => toggleDock()}
                  title="Lipește pe margine: fereastra devine o coloană îngustă pe marginea din dreapta a ecranului, mereu deasupra, ca să iei notițe lângă alt program. Din nou: revine unde era">📌 Lipește pe margine</button>
                <button className={`notes-ontop ${winSt.onTop ? 'on' : ''}`} aria-pressed={winSt.onTop} onClick={() => toggleOnTop()}
                  title="Mereu deasupra: fereastra rămâne peste celelalte programe, chiar când lucrezi în ele">⬆ Mereu deasupra</button>
                <button className="notes-popout" onClick={() => void popOut()} disabled={!stored || !!stored.secret}
                  title={stored?.secret ? 'Notițele blocate cu parolă nu se deschid într-o fereastră separată' : 'Fereastră separată: notița aleasă se deschide singură într-o fereastră mică, de ținut lângă alt program sau pe alt monitor; ce scrii acolo se salvează în caiet'}>🗗 Fereastră separată</button>
              </RGroup>
            )}
          </> },
          { id: 'table', label: 'Tabel', contextual: true, shown: !!note && !lockedView && !reader && inTable, content: (
            <div className="note-table-bar" role="toolbar" aria-label="Tabel" onMouseDown={(e) => e.preventDefault()}>
              <RGroup label="Rânduri" keep>
                <button onClick={() => runTable('rowAbove')} title="Rând nou deasupra">＋ Rând ↑</button>
                <button onClick={() => runTable('rowBelow')} title="Rând nou dedesubt (sau Enter la capătul rândului)">＋ Rând ↓</button>
                <button onClick={() => runTable('delRow')} title="Șterge rândul cu cursorul (capul tabelului rămâne)">− Rând</button>
              </RGroup>
              <RGroup label="Coloane" keep>
                <button onClick={() => runTable('colLeft')} title="Coloană nouă la stânga">＋ Coloană ←</button>
                <button onClick={() => runTable('colRight')} title="Coloană nouă la dreapta">＋ Coloană →</button>
                <button onClick={() => runTable('delCol')} title="Șterge coloana cu cursorul (ultima coloană șterge tot tabelul)">− Coloană</button>
              </RGroup>
              <RGroup label="Ordine" keep>
                <button onClick={() => runTable('sortAsc')} title="Sortează rândurile după coloana cu cursorul (A→Z, 1→9)">↑ A→Z</button>
                <button onClick={() => runTable('sortDesc')} title="Sortează rândurile după coloana cu cursorul (Z→A, 9→1)">↓ Z→A</button>
                <button onClick={() => runTable('align')} title="Aliniază coloanele tabelului">⇔ Aliniază</button>
              </RGroup>
              <span className="muted note-table-hint">Tab / Shift+Tab: celula următoare / de dinainte · Enter: rând nou</span>
            </div>
          ) },
          { id: 'photo', label: 'Poză', contextual: true, autoOpen: true, shown: !!(picked !== null && note?.images?.[picked]) && !lockedView && !reader, content: picked !== null && note?.images?.[picked] ? (
            <div className="note-photo-bar">
              <RGroup label="Poză" keep>
                <button onClick={() => setZoom(note.images![picked])} title="Arată poza mare (sau dublu clic pe ea)">🔍 Mărește</button>
                <button onClick={() => rotate(picked)} title="Rotește poza spre dreapta (un sfert de cerc)">⟳ Rotește</button>
                <button onClick={() => setCropping(picked)} title="Decupează poza: păstrezi doar o parte din ea">✂ Decupează</button>
                {note.imageInk?.[picked]
                  ? <><button data-act="edit-ink" onClick={() => setDrawing(picked)} title="Redeschide desenul cu liniile lui: le poți muta, șterge sau completa">✎ Editează desenul</button>
                    <button data-act="replay-ink" onClick={() => { setReplayInk(true); setDrawing(picked); }} title="Reluare: desenul se redesenează linie cu linie, în ordinea în care l-ai făcut">▶ Reluare</button></>
                  : <button onClick={() => setDrawing(picked)} title="Desenează sau scrie peste poză (săgeți, cercuri, marker)">✎ Desenează peste</button>}
                {modelAt(picked) && <button data-act="edit-model3d" onClick={() => setModel3dOpen(picked)} title="Rotește din nou modelul 3D, schimbă-i culoarea sau unghiul">🧊 Rotește modelul</button>}
                {diagramAt(picked) && <button data-act="edit-diagram" onClick={() => setDiagramOpen(picked)} title="Redeschide schema: schimbi felul, textele, nivelurile sau culoarea, iar poza se desenează din nou">◇ Schimbă schema</button>}
              </RGroup>
              {note.imageText?.[picked] ? (
                <RGroup label="Text" keep>
                  <button onClick={() => copyPhotoText(note.imageText![picked]!)} title="Copiază textul citit din poză">📋 Copiază textul</button>
                  <button className="notes-photo-text-in" onClick={() => photoTextToNote(note.imageText![picked]!)} disabled={lockedView}
                    title="Pune textul citit din poză în notiță, la cursor. Merge și la un desen ✏ scris de mână, dacă literele sunt citețe (scrisul de mână se citește mai greu decât tiparul: verifică textul).">↧ Pune în notiță</button>
                </RGroup>
              ) : null}
              <RGroup label="Șterge" keep>
                <button onClick={() => { const i = picked; setPicked(null); removeImage(i); }} title="Scoate poza din notiță">✕ Scoate poza</button>
              </RGroup>
            </div>
          ) : null },
        ]}
      />
      {/* Mini-bara la textul ales cu mouse-ul: semnele, culorile, mărimea și listele, ca în fila Pornire. */}
      <MiniBar target={bodyEl} disabled={!note || lockedView || reader}>
        {([['**', 'Aldin', <b key="b">B</b>], ['*', 'Cursiv', <i key="i">I</i>], ['++', 'Subliniat', <u key="u">U</u>], ['~~', 'Tăiat', <s key="s">S</s>], ['==', 'Evidențiat cu galben', <mark key="h">H</mark>]] as [Wrap, string, JSX.Element][]).map(([m, t, label]) => (
          <button key={m} onClick={() => wrapBody(m)} title={t} aria-label={t}>{label}</button>
        ))}
        <span className="sep" />
        {INK_COLORS.filter(([n]) => ['roșu', 'albastru', 'verde'].includes(n)).map(([n, fg]) => (
          <button key={n} onClick={() => { const t = bodyRef.current; if (t) applyEdit(t, colorEdit(t.value, t.selectionStart, t.selectionEnd, n, false)); }}
            title={'Text ' + n} aria-label={'Text ' + n}><span style={{ color: fg, fontWeight: 700 }}>A</span></button>
        ))}
        <button onClick={() => { const t = bodyRef.current; if (t) applyEdit(t, colorEdit(t.value, t.selectionStart, t.selectionEnd, '', false)); }} title="Fără culoare" aria-label="Fără culoare">⊘</button>
        <select value="" className="size-select" onChange={(e) => { const v = e.target.value; e.target.value = ''; const t = bodyRef.current; if (!t || !v) return; applyEdit(t, styleEdit(t.value, t.selectionStart, t.selectionEnd, v.slice(1), 'sz')); }}
          title="Mărimea textului ales" aria-label="Mărimea textului">
          <option value="">Aa</option>
          {INK_SIZES.map(([n]) => <option key={n} value={':' + n}>{n[0].toUpperCase() + n.slice(1)}</option>)}
          <option value=":">Mărime obișnuită</option>
        </select>
        <span className="sep" />
        <button onClick={() => bodyRef.current && toggleBullets(bodyRef.current, 'bullet')} title="Listă cu buline" aria-label="Listă cu buline">•</button>
        <button onClick={() => bodyRef.current && toggleList(bodyRef.current)} title="Listă de bifat" aria-label="Listă de bifat">☐</button>
      </MiniBar>
      {model3dOpen !== false && <Model3DDialog initial={(() => { const k = modelAt(model3dOpen); try { return k ? keptModel(k) : undefined; } catch { return undefined; } })()} onClose={() => setModel3dOpen(false)} onInsert={(blob, name, src) => void doneModel3d(blob, name, src)} />}
      {iconsOpen && <IconsDialog onClose={() => setIconsOpen(false)} onInsert={(blobs, names) => { setIconsOpen(false); void addImages(blobs, names); }} />}
      {diagramOpen !== false && <DiagramDialog diagram={diagramAt(diagramOpen) ?? newDiagram()} onClose={() => setDiagramOpen(false)} onDone={(d) => void insertDiagram(d)} />}
      {eqEdit && <EquationDialog equation={{ src: eqEdit.src }} onClose={() => { setEqEdit(null); bodyRef.current?.focus(); }} onDone={(e) => doneEquation(e.src)} />}
      {recVideo && <video className="notes-cam" autoPlay muted playsInline aria-label="Camera, cât filmezi" ref={(v) => { if (v && v.srcObject !== recVideo) v.srcObject = recVideo; }} />}
      {loadError && <div className="notes-error">{loadError}</div>}
      <div className={`notes-wrap ${board && !trashView ? 'board' : ''} ${winSt.docked ? 'docked' : ''}`}>
        <aside ref={setSideEl} className={`notes-side ${navShut ? 'nav-shut' : ''}`}>
          <div className="notes-navcol" aria-label="Caiete și secțiuni">
          <div className="notes-books" role="group" aria-label="Caiete">
            {bookEdit ? (
              <input
                autoFocus
                placeholder="Numele caietului"
                value={bookEdit.name}
                aria-label={bookEdit.old === '\u0000new' ? 'Numele caietului nou' : 'Numele caietului'}
                title={bookEdit.old === '\u0000new' ? 'Enter: faci caietul. Esc: renunți.' : 'Enter: redenumești caietul. Cu numele șters: îl ștergi (notițele trec în caietul principal).'}
                onChange={(e) => setBookEdit({ old: bookEdit.old, name: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') finishBook(); if (e.key === 'Escape') setBookEdit(null); }}
                onBlur={finishBook}
              />
            ) : (
              <select value={activeBook} style={store.bookColors?.[activeBook] ? { background: `var(--note-${store.bookColors[activeBook]})` } : undefined} onChange={(e) => { setBook(e.target.value); setSection(''); setQuery(''); setTag(''); setSel(null); }} aria-label="Caietul" title="Caietul deschis: fiecare caiet are notițele și secțiunile lui">
                {books.map((b) => <option key={b} value={b}>📓 {b || MAIN_BOOK} ({store.notes.filter((n) => (n.book ?? '') === b && !n.archived).length})</option>)}
              </select>
            )}
            <button onClick={() => setBookEdit({ old: '\u0000new', name: '' })} title="Caiet nou (de exemplu Serviciu, Școală, Casă): notițe și secțiuni separate">＋ Caiet</button>
            {!bookEdit && <button onClick={() => (activeBook ? setBookEdit({ old: activeBook, name: activeBook }) : setBookColorsOpen((o) => !o))}
              title={activeBook ? 'Redenumește caietul sau îi alegi culoarea; cu numele șters îl ștergi (notițele trec în caietul principal)' : 'Culoarea caietului principal'} aria-label={activeBook ? 'Redenumește caietul' : 'Culoarea caietului'}>✎</button>}
          </div>
          {((bookEdit && bookEdit.old !== '\u0000new') || (bookColorsOpen && !activeBook)) && (
            <span className="notes-colors notes-sec-colors notes-book-colors" role="group" aria-label="Culoarea caietului">
              <button className={`notes-swatch none ${!store.bookColors?.[activeBook] ? 'on' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => change((x) => setBookColor(x, activeBook, undefined))} title="Fără culoare" aria-label="Fără culoare" />
              {Object.entries(COLORS).map(([k, [label]]) => (
                <button key={k} className={`notes-swatch ${store.bookColors?.[activeBook] === k ? 'on' : ''}`} style={{ background: `var(--note-${k})` }}
                  onMouseDown={(e) => e.preventDefault()} onClick={() => change((x) => setBookColor(x, activeBook, k))} title={label} aria-label={label} />
              ))}
            </span>
          )}
          <div className="notes-tags notes-sections" role="group" aria-label="Secțiuni" title="Secțiuni. Dublu-click pe o secțiune: o redenumești, îi alegi culoarea sau (cu numele șters) o ștergi. Scrie „Grup / Secțiune” ca s-o pui într-un grup de secțiuni.">
            <button className={!activeSection ? 'on' : ''} onClick={() => setSection('')}>📚 Toate <span>{bookNotes.filter((n) => !n.archived).length}</span></button>
            {sectionTree(store, sections).map(({ group, sections: inGroup }) => {
            const renderSec = (s: string) => (secEdit && secEdit.old === s ? (
              <Fragment key={s}>
                <input
                  autoFocus
                  value={secEdit.name}
                  aria-label="Numele secțiunii"
                  onChange={(e) => setSecEdit({ old: s, name: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') finishSection(); if (e.key === 'Escape') setSecEdit(null); }}
                  onBlur={finishSection}
                />
                {/* Culoarea secțiunii: click pe o bulină (câmpul cu numele rămâne deschis). */}
                <span className="notes-colors notes-sec-colors" role="group" aria-label="Culoarea secțiunii">
                  <button className={`notes-swatch none ${!store.sectionColors?.[s] ? 'on' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={() => change((x) => setSectionColor(x, s, undefined))} title="Fără culoare" aria-label="Fără culoare" />
                  {Object.entries(COLORS).map(([k, [label]]) => (
                    <button key={k} className={`notes-swatch ${store.sectionColors?.[s] === k ? 'on' : ''}`} style={{ background: `var(--note-${k})` }}
                      onMouseDown={(e) => e.preventDefault()} onClick={() => change((x) => setSectionColor(x, s, k))} title={label} aria-label={label} />
                  ))}
                </span>
              </Fragment>
            ) : (
              <button key={s} data-sec={s} className={activeSection === s ? 'on' : ''} style={store.sectionColors?.[s] ? { background: `var(--note-${store.sectionColors[s]})` } : undefined}
                onClick={() => setSection(activeSection === s ? '' : s)} onDoubleClick={() => setSecEdit({ old: s, name: sectionPath(store, s) })}>
                📂 {s} <span>{bookNotes.filter((n) => n.section === s && !n.archived).length}</span>
              </button>
            ));
            if (!group) return inGroup.map(renderSec);
            const shut = shutGroups.has(group);
            return (
              <Fragment key={'§' + group}>
                {grpEdit && grpEdit.old === group ? (
                  <input autoFocus value={grpEdit.name} aria-label="Numele grupului de secțiuni" title="Numele grupului (cu numele șters, grupul se desface)"
                    onChange={(e) => setGrpEdit({ old: group, name: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') finishGroup(); if (e.key === 'Escape') setGrpEdit(null); }}
                    onBlur={finishGroup} />
                ) : (
                  <button className={`notes-sec-group ${inGroup.includes(activeSection) ? 'has-on' : ''}`} aria-expanded={!shut}
                    title={`Grupul de secțiuni „${group}”: click îl strânge sau îl desface; dublu-click îl redenumești`}
                    onClick={() => setShutGroups((g) => { const n = new Set(g); if (n.has(group)) n.delete(group); else n.add(group); return n; })}
                    onDoubleClick={() => setGrpEdit({ old: group, name: group })}>
                    {shut ? '▸' : '▾'} 🗂 {group} <span>{bookNotes.filter((n) => !n.archived && !!n.section && inGroup.includes(n.section)).length}</span>
                  </button>
                )}
                {inGroup.filter((s) => !shut || s === activeSection || secEdit?.old === s).map(renderSec)}
              </Fragment>
            );
            })}
            {secEdit && !secEdit.old ? (
              <input
                autoFocus
                placeholder="Numele secțiunii (Grup / Secțiune o pune într-un grup)"
                value={secEdit.name}
                aria-label="Numele secțiunii noi"
                onChange={(e) => setSecEdit({ old: '', name: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') finishSection(); if (e.key === 'Escape') setSecEdit(null); }}
                onBlur={finishSection}
              />
            ) : (
              <button onClick={() => setSecEdit({ old: '', name: '' })} title="Secțiune nouă (de exemplu Serviciu, Casă, Rețete)">＋ Secțiune</button>
            )}
          </div>
          {(due.length > 0 || todayOnly || archivedCount > 0 || archiveView || trash.length > 0 || trashView) && (
            <div className="notes-tags">
              {(trash.length > 0 || trashView) && (
                <button className={trashView ? 'on' : ''} onClick={() => setTrashView((t) => !t)} title={`Notițele șterse: le readuci sau le ștergi de tot (se golesc singure după ${TRASH_DAYS} de zile)`}>
                  🗑 Coș <span>{trash.length}</span>
                </button>
              )}
              {(archivedCount > 0 || archiveView) && (
                <button className={archiveView ? 'on' : ''} onClick={() => setArchiveView((a) => !a)} title="Notițele arhivate (ascunse din lista obișnuită)">
                  🗄 Arhivă <span>{archivedCount}</span>
                </button>
              )}
              {(due.length > 0 || todayOnly) && (
              <button className={todayOnly ? 'on' : ''} onClick={() => setTodayOnly((t) => !t)} title="Mementourile de azi și cele trecute, în ordinea orei">
                ⏰ Azi <span>{due.length}</span>
              </button>
              )}
            </div>
          )}
          {(tags.length > 0 || hasMarks) && (
            <div className="notes-tags" title="Scrie #cuvânt într-o notiță ca s-o etichetezi. Dublu-click pe o etichetă: o redenumești în toate notițele sau (cu numele șters) o scoți.">
              {tags.map(([t, c]) => (tagEdit && tagEdit.old === t ? (
                <input
                  key={t}
                  autoFocus
                  value={tagEdit.name}
                  aria-label="Numele etichetei (gol: o scoți)"
                  placeholder="gol = scoate eticheta"
                  onChange={(e) => setTagEdit({ old: t, name: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') finishTag(); if (e.key === 'Escape') setTagEdit(null); }}
                  onBlur={finishTag}
                />
              ) : (
                <button key={t} className={t === activeTag ? 'on' : ''} onClick={() => setTag(t === activeTag ? '' : t)} onDoubleClick={() => setTagEdit({ old: t, name: t })}>
                  #{t} <span>{c}</span>
                </button>
              )))}
              <button onClick={() => setSummary(true)} title="Rezumatul etichetelor: tot ce e de făcut (☐), rândurile cu semne (⭐ ❓ 💡 📞 📌) și cele cu #etichete, din toate notițele">🏷 Rezumat</button>
            </div>
          )}
          </div>
          <div className="notes-pagecol" aria-label="Pagini">
          <button className="notes-navtoggle" onClick={() => setNavShut((v) => !v)} aria-expanded={!navShut}
            title={navShut ? 'Arată caietele și secțiunile' : 'Strânge caietele și secțiunile (rămâne doar lista paginilor)'} aria-label={navShut ? 'Arată secțiunile' : 'Strânge secțiunile'}>{navShut ? '▶' : '◀'}</button>
          <div className="notes-search">
            <input
              ref={searchRef}
              type="search"
              placeholder="Caută în notițe (Ctrl+F)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setQuery('');
                if (e.key === 'Enter' && list[0]) select(list[0].id);
              }}
            />
            {query.trim() && books.length > 1 && (otherHits > 0 || allBooks) && (
              <button className={`notes-allbooks ${allBooks ? 'on' : ''}`} aria-pressed={allBooks} onClick={() => setAllBooks(!allBooks)}
                title={allBooks ? 'Caută doar în caietul deschis' : 'Caută și în celelalte caiete'}>
                📓 {allBooks ? 'Caut în toate caietele' : `Încă ${otherHits} în alte caiete`}
              </button>
            )}
            <div className="notes-sort-row">
            <select className="notes-sort" value={sortMode} onChange={(e) => changeSort(e.target.value as SortMode)} title="Ordinea notițelor din listă (cele fixate rămân sus)" aria-label="Ordinea notițelor">
              {(Object.keys(SORT_LABELS) as SortMode[]).map((m) => <option key={m} value={m}>↕ {SORT_LABELS[m]}</option>)}
            </select>
            <select className={`notes-sort ${kind ? 'on' : ''}`} value={kind} onChange={(e) => setKind(e.target.value)} title="Arată doar notițele de un anumit tip sau de o anumită culoare" aria-label="Filtru după tip">
              <option value="">⚲ Toate tipurile</option>
              {KINDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              {Object.entries(COLORS).map(([k, [label]]) => <option key={k} value={`culoare:${k}`}>● {label}</option>)}
            </select>
            <button className={`notes-view ${board ? 'on' : ''}`} onClick={() => setBoard(!board)} aria-pressed={board}
              title={board ? 'Înapoi la listă, cu notița deschisă alături' : 'Vedere Grilă: notițele ca niște carduri pe tot ecranul'}>{board ? '☰ Listă' : '▦ Grilă'}</button>
            </div>
          </div>
          {trashView ? (
            <div className="notes-list notes-trash" aria-label="Coșul de gunoi">
              {trash.length > 0 && (
                <div className="notes-trash-head">
                  <span className="muted">Se șterg singure după {TRASH_DAYS} de zile.</span>
                  <button onClick={async () => { if ((await askYes(`Ștergi de tot cele ${trash.length} notițe din coș?
Nu le mai poți readuce (decât din Versiuni).`, 'Golește coșul'))) change((x) => purgeNote(x)); }}>Golește coșul</button>
                </div>
              )}
              {trash.map((n) => (
                <div key={n.id} className="notes-item notes-trash-item" style={n.color ? { background: `var(--note-${n.color})` } : undefined}>
                  <span className="notes-item-title">{shownTitle(n)}</span>
                  <span className="notes-item-text">{snippet(n, '')}</span>
                  <span className="notes-item-date">ștearsă {when(n.deleted ?? n.updated)}</span>
                  <span className="notes-trash-actions">
                    <button onClick={() => { change((x) => restoreNote(x, n.id)); select(n.id); setStatus(`Notița „${shownTitle(n)}” a revenit din coș.`); }} title="Readu notița în caiet">↩ Readu</button>
                    <button onClick={async () => { if ((await askYes(`Ștergi de tot notița „${shownTitle(n)}”?`, 'Șterge definitiv'))) change((x) => purgeNote(x, n.id)); }} title="Șterge notița de tot">Șterge definitiv</button>
                  </span>
                </div>
              ))}
              {!trash.length && <p className="notes-none">Coșul e gol. Notițele șterse stau aici {TRASH_DAYS} de zile.</p>}
            </div>
          ) : (
          <div className="notes-list" role="listbox" aria-label="Notițe">
            {board && !archiveView && (<div className="notes-take">
              <textarea rows={take.includes('\n') ? 3 : 1} value={take} placeholder="Ia o notiță…" aria-label="Ia o notiță" title="Scrie și apasă Enter: primul rând e titlul (Shift+Enter: rând nou, Esc: golește)"
                onChange={(e) => setTake(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); takeNote(); } else if (e.key === 'Escape') setTake(''); }} />
              {take.trim() && <button onClick={takeNote}>Adaugă</button>}
            </div>)}
            {shown.map(({ note: n, depth, kids }, i) => (
              <Fragment key={n.id}>
              {pinnedCount > 0 && i === 0 && !archiveView && <div className="notes-group">📌 Fixate</div>}
              {pinnedCount > 0 && i === pinnedCount && <div className="notes-group">Celelalte</div>}
              <button
                role="option"
                aria-selected={n.id === sel}
                className={`notes-item ${n.id === sel ? 'active' : ''} ${dropOn === n.id ? 'drop-on' : ''}${depth && !board ? ` sub sub-${depth}` : ''}`}
                data-depth={depth || undefined} data-note-id={n.id}
                draggable={!n.archived}
                onDragStart={(e) => { dragNote.current = n.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/x-suite-note', n.id); }}
                onDragEnd={() => { dragNote.current = null; setDropOn(null); }}
                onDragOver={(e) => { if (dragNote.current && dragNote.current !== n.id) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dropOn !== n.id) setDropOn(n.id); } }}
                onDragLeave={() => { if (dropOn === n.id) setDropOn(null); }}
                onDrop={(e) => { e.preventDefault(); dropNote(n.id); }}
                style={n.color || n.bg ? { ...(n.color ? { backgroundColor: `var(--note-${n.color})` } : {}), ...(n.bg ? { backgroundImage: backgroundImage(n.bg), backgroundSize: '110px' } : {}) } : undefined}
                onClick={() => { select(n.id); if (board) setBoard(false); }}
              >
                {board && <span role="button" tabIndex={-1} className={`notes-card-pin ${n.pinned ? 'on' : ''}`} aria-label={n.pinned ? 'Anulează fixarea' : 'Fixează sus'} title={n.pinned ? 'Anulează fixarea' : 'Fixează sus (în grupul 📌 Fixate)'}
                  onClick={(e) => { e.stopPropagation(); togglePinOf(n.id); }}>📌</span>}
                {board && !n.secret && n.images?.[0] && <img className="notes-card-img" src={n.images[0]} alt="" />}
                <span className="notes-item-title">{depth > 0 && !board && <span className="notes-sub-mark" aria-hidden="true">↳ </span>}<Hl text={shownTitle(n)} query={query} />{kids > 0 && <span className="notes-kids" title={`${kids} subpagini`}> · 📑 {kids}</span>}</span>
                <span className="notes-item-text"><Hl text={board && !query ? cardText(n) : snippet(n, query)} query={query} /></span>
                {n.archived && !archiveView && <span className="notes-item-remind" title="Notiță arhivată">🗄 arhivată</span>}
                {searchAll && (n.book ?? '') !== activeBook && <span className="notes-item-remind" title="Caietul notiței">📓 {n.book || MAIN_BOOK}</span>}
                {n.section && !activeSection && <span className="notes-item-remind" title="Secțiunea notiței">📂 {n.section}</span>}
                {n.remind && <span className={`notes-item-remind ${!n.repeat && Date.parse(n.remind) < Date.now() ? 'late' : ''}`}>⏰ {remindText(n)}</span>}
                <span className="notes-item-date">
                  {when(n.updated)}
                  {(() => { const p = progress(n.body); return p.total ? ` · ${DONE} ${p.done}/${p.total}` : ''; })()}
                </span>
              </button>
              </Fragment>
            ))}
            {!list.length && (
              <p className="notes-none">
                {kind && !query && !activeTag ? <>Nicio notiță de tipul ales. Alege „⚲ Toate tipurile”.</> : activeSection && !archiveView && !query && !activeTag ? <>Secțiunea „{activeSection}” nu are notițe. Apasă <b>+ Notiță nouă</b>.</> : archiveView && !query && !activeTag ? <>Arhiva e goală. Butonul <b>🗄 Arhivează</b> ascunde o notiță aici, fără s-o ștergi.</> : query || activeTag ? <>Nicio notiță nu conține {query ? <>„{query}”</> : null}{query && activeTag ? ' și ' : ''}{activeTag ? <>#{activeTag}</> : null}.</> : <>Nicio notiță încă. Apasă <b>+ Notiță nouă</b>.</>}
              </p>
            )}
          </div>
          )}
          {!trashView && <button className="notes-addpage" onClick={() => add()} title="Pagină nouă în secțiunea aleasă (Ctrl+N)">＋ Adăugare pagină</button>}
          </div>
        </aside>
        <section ref={mainRef} className="notes-main" onMouseDown={(e) => { if (picked !== null && !(e.target as HTMLElement).closest('.note-image')) setPicked(null); }} style={{ ...(note?.color ? { backgroundColor: `var(--note-${note.color})` } : {}), ...(note?.bg ? { backgroundImage: backgroundImage(note.bg) } : {}), ['--nz' as string]: textZoom / 100 }}>
          {note ? (
            <>
              {find && !lockedView && (
                <div className="note-find" role="search">
                  <input
                    ref={findRef}
                    value={find.q}
                    placeholder="Găsește în notiță"
                    aria-label="Găsește în notiță"
                    onChange={(e) => setFind({ q: e.target.value, i: -1 })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); findGo(e.shiftKey ? -1 : 1); }
                      if (e.key === 'Escape') { e.preventDefault(); setFind(null); bodyRef.current?.focus(); }
                    }}
                  />
                  <span className="muted">{find.q.trim() ? (findHits.length ? `${find.i >= 0 ? find.i + 1 : 0} / ${findHits.length}` : 'nimic găsit') : ''}</span>
                  <button onClick={() => findGo(-1)} disabled={!findHits.length} title="Cea dinainte (Shift+F3)" aria-label="Cea dinainte">↑</button>
                  <button onClick={() => findGo(1)} disabled={!findHits.length} title="Următoarea (Enter, F3)" aria-label="Următoarea">↓</button>
                  <button onClick={() => setFind(null)} title="Închide (Esc)" aria-label="Închide căutarea">✕</button>
                </div>
              )}
              {!(reader && !lockedView) && <input
                ref={titleRef}
                className="note-title"
                placeholder="Titlu"
                value={note.title}
                onChange={(e) => edit({ title: e.target.value })}
              />}
              {remindOpen && (
                <div className="note-remind">
                  <span>⏰ Amintește-mi pe</span>
                  <input
                    type="datetime-local"
                    value={note.remind ? toLocalInput(note.remind) : ''}
                    onChange={(e) => edit({ remind: e.target.value ? new Date(e.target.value).toISOString() : undefined }, false)}
                  />
                  {[['Peste o oră', 60], ['Mâine la 9', -1]].map(([label, min]) => (
                    <button key={label as string} onClick={() => edit({ remind: quickTime(min as number) }, false)}>{label}</button>
                  ))}
                  <select
                    value={note.repeat ?? ''}
                    disabled={!note.remind}
                    onChange={(e) => edit({ repeat: (e.target.value || undefined) as Repeat | undefined }, false)}
                    title="Mementoul vine din nou: în fiecare zi, săptămână, lună sau an, la aceeași oră"
                    aria-label="Se repetă"
                  >
                    <option value="">🔁 Nu se repetă</option>
                    {(Object.keys(REPEATS) as Repeat[]).map((r) => <option key={r} value={r}>🔁 {REPEATS[r]}</option>)}
                  </select>
                  {note.remind && <button onClick={() => edit({ remind: undefined, repeat: undefined }, false)}>Fără memento</button>}
                  <button onClick={() => setRemindOpen(false)}>Gata</button>
                </div>
              )}
              {lockedView && (
                <form className="note-locked" onSubmit={(e) => { e.preventDefault(); unlockNote(); }}>
                  <div className="note-locked-icon">🔒</div>
                  <p>Notița e blocată cu parolă.</p>
                  <input type="password" autoFocus placeholder="Parola" value={pw1} onChange={(e) => { setPw1(e.target.value); setPwError(''); }} aria-label="Parola notiței" />
                  <button type="submit" className="primary" disabled={!pw1 || pwBusy}>{pwBusy ? 'Se deschide…' : 'Deschide'}</button>
                  {pwError && <p className="note-pw-error">{pwError}</p>}
                </form>
              )}
              {!lockedView && reader && <Reader title={note.title} body={note.body} font={note.font} boxes={note.boxes} onClose={() => setReader(false)} />}
              {note && !lockedView && !reader && a11y && (
                <div className="notes-a11y" role="region" aria-label="Accesibilitate">
                  <div className="notes-a11y-head">
                    <b>♿ Accesibilitate</b>
                    <button onClick={() => setA11y(checkNote(note.title, note.body))} title="Verifică din nou">↻</button>
                    <button onClick={() => setA11y(null)} aria-label="Închide verificarea">✕</button>
                  </div>
                  {a11y.length === 0 ? <p>✓ N-am găsit probleme în această notiță.</p> : (
                    <ul>
                      {a11y.map((x, i) => (
                        <li key={i}>
                          <button onClick={() => { const t = bodyRef.current; if (!t) return; t.focus(); t.setSelectionRange(x.pos, x.pos); }}>{x.text}</button>
                          <span>{x.tip}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {note && !lockedView && !reader && gramOn && (() => {
                const list = checkGrammar(note.body).filter((x) => !gramIgnored.includes(x.text));
                const fixAll = () => {
                  let b = note.body;
                  for (const x of [...list].reverse()) if (x.fix !== undefined) b = b.slice(0, x.from) + x.fix + b.slice(x.to);
                  if (b !== note.body) edit({ body: b });
                };
                return (
                  <div className="notes-a11y notes-grammar" role="region" aria-label="Gramatică">
                    <div className="notes-a11y-head">
                      <b>✓ Gramatică</b>
                      {list.some((x) => x.fix !== undefined) && <button onClick={fixAll} title="Pune forma corectă peste tot (↶ Anulează le scoate)">✓ Corectează tot</button>}
                      <button onClick={() => setGramOn(false)} aria-label="Închide gramatica">✕</button>
                    </div>
                    {list.length === 0 ? <p>✓ N-am găsit greșeli în această notiță.</p> : (
                      <ul>
                        {list.map((x) => (
                          <li key={x.from + ':' + x.text}>
                            <button onClick={() => { const t = bodyRef.current; if (!t) return; t.focus(); t.setSelectionRange(x.from, x.to); }}>„{x.text.trim() || x.text}”</button>
                            <span>{x.msg}</span>
                            <span className="notes-grammar-acts">
                              {x.fix !== undefined && <button onClick={() => edit({ body: note.body.slice(0, x.from) + x.fix + note.body.slice(x.to) })}>✓ {x.fix.trim() ? x.fix : 'Corectează'}</button>}
                              <button onClick={() => setGramIgnored([...gramIgnored, x.text])} title="Nu mai arăta această greșeală în notiță">Ignoră</button>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })()}
              {!lockedView && !reader && <div className="note-body-wrap">
              {liveFmt && <LiveBody area={bodyRef} text={note.body} />}
              <textarea
                ref={bodyRef}
                onSelect={(e) => checkTable(e.currentTarget)}
                className={`note-body ${liveFmt ? 'live' : ''} ${note.paper ? 'paper-' + note.paper : ''}`}
                style={note.font ? { fontFamily: fontCss(note.font) } : undefined}
                placeholder="Scrie aici…"
                value={note.body}
                onChange={(e) => edit({ body: e.target.value })}
                onMouseDown={(e) => { if (e.button === 0 && !e.shiftKey && !e.ctrlKey && !e.altKey) startItemDrag(e.currentTarget); }}
                onClick={(e) => {
                  if (skipBoxClick.current) return;
                  // Ctrl+click pe o adresă web o deschide în browser (ca în Word și OneNote).
                  const url = e.ctrlKey && e.currentTarget.selectionStart === e.currentTarget.selectionEnd ? webLinkAt(e.currentTarget.value, e.currentTarget.selectionStart) : null;
                  if (url) { window.open(webHref(url), '_blank'); return; }
                  if (clickBox(e.currentTarget) && autoBottom) applyChecked(e.currentTarget, 'bottom');
                }}
                onPaste={(e) => {
                  const f = imageFiles(e.clipboardData?.files);
                  if (f.length) { e.preventDefault(); addImages(f); return; }
                  // Din pagini web și din Word: listele, legăturile și tabelele își păstrează forma (• / 1. / ☐, „text (adresă)”, „ | ”).
                  const html = e.clipboardData?.getData('text/html');
                  const t = html ? htmlToNoteText(html) : null; // Ctrl+Shift+V lipește doar text simplu (fără HTML).
                  if (t) { e.preventDefault(); insertAtCursor(e.currentTarget, t); }
                  if (html && /<img\b/i.test(html)) void pastedImages(note.id, html);
                }}
                onDrop={(e) => {
                  const f = imageFiles(e.dataTransfer?.files);
                  const pdfs = Array.from(e.dataTransfer?.files ?? []).filter((x) => x.type === 'application/pdf' || /\.pdf$/i.test(x.name));
                  const mails = Array.from(e.dataTransfer?.files ?? []).filter((x) => /[.](eml|msg)$/i.test(x.name));
                  const rest = Array.from(e.dataTransfer?.files ?? []).filter((x) => !f.includes(x) && !pdfs.includes(x) && !mails.includes(x));
                  if (f.length || pdfs.length || rest.length || mails.length) e.preventDefault();
                  if (f.length) addImages(f);
                  if (pdfs.length) addPdfs(pdfs.map((x) => ({ name: x.name, data: x })));
                  if (rest.length) addOthers(rest.map((x) => ({ name: x.name, data: x })));
                  if (mails.length) void addMails(e.currentTarget, mails);
                }}
                onKeyDown={(e) => {
                  // În tabel: Tab / Shift+Tab trec de la o celulă la alta (la capăt fac rând nou), Enter face rând nou.
                  const plain = !e.ctrlKey && !e.altKey && !e.metaKey && e.currentTarget.selectionStart === e.currentTarget.selectionEnd;
                  if (plain && e.key === 'Tab' && runTable(e.shiftKey ? 'prev' : 'next')) e.preventDefault();
                  else if (plain && e.key === 'Enter' && !e.shiftKey && runTable('enter')) e.preventDefault();
                  else if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey && enterInList(e.currentTarget)) e.preventDefault();
                  else if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && indentList(e.currentTarget, e.shiftKey)) e.preventDefault();
                  // Alt+↑/↓ (și Alt+Shift+↑/↓, ca în OneNote): mută rândul sau elementul de listă, cu sub-elementele lui.
                  else if (e.altKey && !e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); moveLines(e.currentTarget, e.key === 'ArrowUp' ? -1 : 1); }
                  else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'l') { e.preventDefault(); toggleList(e.currentTarget); }
                  else if (e.ctrlKey && !e.shiftKey && !e.altKey && e.code === 'KeyK') { e.preventDefault(); insertLink(e.currentTarget); }
                  else if (e.altKey && e.shiftKey && !e.ctrlKey && (e.code === 'KeyD' || e.code === 'KeyT' || e.code === 'KeyF')) { e.preventDefault(); insertAtCursor(e.currentTarget, dateStamp(new Date(), e.code === 'KeyD' ? 'date' : e.code === 'KeyT' ? 'time' : 'both')); }
                  else if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.code === 'KeyB' || e.code === 'KeyI' || e.code === 'KeyU')) { e.preventDefault(); wrapBody(e.code === 'KeyB' ? '**' : e.code === 'KeyU' ? '++' : '*'); }
                  else if (e.ctrlKey && e.shiftKey && !e.altKey && (e.code === 'KeyX' || e.code === 'KeyH')) { e.preventDefault(); wrapBody(e.code === 'KeyX' ? '~~' : '=='); }
                  else if (e.ctrlKey && !e.shiftKey && !e.altKey && e.code === 'Minus') { e.preventDefault(); wrapBody('~~'); }
                  else if (e.ctrlKey && e.altKey && !e.shiftKey && e.code === 'KeyH' && !e.getModifierState?.('AltGraph')) { e.preventDefault(); wrapBody('=='); }
                  else if (e.ctrlKey && e.shiftKey && !e.altKey && e.code === 'KeyN') { e.preventDefault(); const t = e.currentTarget; applyEdit(t, clearEdit(t.value, t.selectionStart, t.selectionEnd)); }
                  else if (e.ctrlKey && !e.shiftKey && !e.altKey && /^Digit[0-6]$/.test(e.code)) {
                    // Etichetele pe rând, ca la programul de notițe cunoscut: Ctrl+1 De făcut (căsuță), Ctrl+2 Important, Ctrl+3 Întrebare,
                    // Ctrl+4 Idee, Ctrl+5 De sunat, Ctrl+6 De ținut minte; Ctrl+0 le scoate pe toate de pe rândurile alese.
                    e.preventDefault(); const t = e.currentTarget, d = Number(e.code.slice(5));
                    if (d === 1) toggleList(t);
                    else if (d > 1) toggleMark(t, LINE_MARKS[d - 2][0]);
                    else applyEdit(t, unmarkEdit(t.value, t.selectionStart, t.selectionEnd));
                  }
                  else if (e.ctrlKey && !e.shiftKey && !e.altKey && (e.code === 'Period' || e.code === 'Slash')) { e.preventDefault(); toggleBullets(e.currentTarget, e.code === 'Period' ? 'bullet' : 'number'); }
                  else if (e.ctrlKey && e.altKey && !e.shiftKey && /^Digit[0-6]$/.test(e.code) && !e.getModifierState?.('AltGraph')) { e.preventDefault(); const t = e.currentTarget; applyEdit(t, headingEdit(t.value, t.selectionStart, t.selectionEnd, Number(e.code.slice(5)))); }
                  else if (e.ctrlKey && !e.shiftKey && !e.altKey && ['KeyL', 'KeyR', 'KeyJ'].includes(e.code)) {
                    // Alinierea rândului: Ctrl+L stânga, Ctrl+R dreapta, Ctrl+J stânga-dreapta. Ctrl+E e căutarea în toate caietele (la centru: din buton).
                    e.preventDefault(); const t = e.currentTarget;
                    applyEdit(t, alignEdit(t.value, t.selectionStart, t.selectionEnd, ({ KeyL: '', KeyE: 'la centru', KeyR: 'la dreapta', KeyJ: 'stânga-dreapta' } as Record<string, string>)[e.code]));
                  }
                  else if (e.ctrlKey && e.shiftKey && e.key === '8') { e.preventDefault(); toggleBullets(e.currentTarget, 'bullet'); }
                  else if (e.ctrlKey && e.shiftKey && e.key === '7') { e.preventDefault(); toggleBullets(e.currentTarget, 'number'); }
                }}
              /></div>}
              {!lockedView && !reader && (canvasOn === note.id || !!note.boxes?.length) && (
                <Canvas boxes={note.boxes ?? []} font={note.font} focusId={canvasFocus} pen={pen}
                  onChange={(next) => edit({ boxes: next.length ? next : undefined })} onDraw={(id) => setCanvasDraw({ id })} />
              )}
              {!lockedView && pastePics?.id === note.id && (
                <div className="note-paste-pics" role="status">
                  <span>{pastePics.urls.length === 1 ? 'Textul lipit are o poză de pe internet.' : `Textul lipit are ${pastePics.urls.length} poze de pe internet.`}</span>
                  <button data-testid="note-paste-pics" disabled={previewBusy} onClick={() => void fetchPastePics()}
                    title="Aduce pozele din pagina de unde ai copiat (doar citite) și le pune în notiță">🖼 Adu pozele</button>
                  <button onClick={() => setPastePics(null)} title="Lasă notița fără aceste poze" aria-label="Fără poze">✕</button>
                </div>
              )}
              {(() => {
                const links = linksOf(note);
                const back = backlinks(store.notes, note);
                const web = lockedView ? [] : webLinksOf(note);
                if (!links.length && !back.length && !web.length) return null;
                return (
                  <div className="note-links">
                    {links.length > 0 && <span className="muted">Legături:</span>}
                    {links.map((t) => {
                      const exists = !!findByTitle(store.notes, t);
                      return (
                        <button key={t} className={exists ? '' : 'new'} onClick={() => openLink(t)} title={exists ? 'Deschide notița' : 'Notița nu există încă: click o face'}>
                          {exists ? '' : '＋ '}{t}
                        </button>
                      );
                    })}
                    {back.length > 0 && <span className="muted">Menționată în:</span>}
                    {back.map((b) => <button key={b.id} onClick={() => select(b.id)} title="Notița care trimite aici">↩ {shownTitle(b)}</button>)}
                    {web.length > 0 && <span className="muted">Web:</span>}
                    {web.map((u) => (
                      <button key={u} className="web" onClick={() => window.open(webHref(u), '_blank')} title={`Deschide în browser: ${webHref(u)} (sau Ctrl+click pe adresă în text)`}>
                        🔗 {u.replace(/^https?:[/][/]/i, '').replace(/^www[.]/i, '').slice(0, 40)}{u.replace(/^https?:[/][/]/i, '').replace(/^www[.]/i, '').length > 40 ? '…' : ''}
                      </button>
                    ))}
                    {web.some((u) => !note.previews?.some((x) => x.url === u)) && (
                      <button className="web-preview" data-testid="note-preview" disabled={previewBusy} onClick={() => void fetchPreviews(note.id, web.filter((u) => !note.previews?.some((x) => x.url === u)))}
                        title="Previzualizare: aduce titlul și descrierea fiecărei pagini (o singură dată, doar citită) și le arată ca fișe sub notiță">🔍 Previzualizare</button>
                    )}
                  </div>
                );
              })()}
              {!lockedView && note.previews?.some((x) => webLinksOf(note).includes(x.url)) ? (
                <div className="note-previews">
                  {note.previews.filter((x) => webLinksOf(note).includes(x.url)).map((x) => (
                    <div key={x.url} className={'note-preview' + (x.video ? ' np-video' : '')} data-testid="note-preview-card">
                      {x.thumb && (
                        <button className="np-thumb" onClick={() => window.open(webHref(x.url), '_blank')} title={x.video ? `Pornește clipul în browser: ${webHref(x.url)}` : `Deschide în browser: ${webHref(x.url)}`}>
                          <img src={x.thumb} alt="" />
                          {x.video && <span className="np-play" aria-hidden="true">▶</span>}
                        </button>
                      )}
                      <button className="np-open" onClick={() => window.open(webHref(x.url), '_blank')} title={`Deschide în browser: ${webHref(x.url)}`}>
                        <span className="np-site">{x.video ? '▶ Video · ' : ''}{x.site}</span>
                        <strong className="np-title">{x.title}</strong>
                        {x.desc && <span className="np-desc">{x.desc}</span>}
                      </button>
                      <button className="np-x" onClick={() => dropPreview(note.id, x.url)} title="Scoate fișa (legătura rămâne în text)" aria-label="Scoate fișa">✕</button>
                    </div>
                  ))}
                </div>
              ) : null}
              {note.files?.length ? (
                <div className="note-files">
                  {note.files.map((f) => (
                    /\.bin$/.test(f.id) ? (
                      <span key={f.id} className="note-file">
                        <button onClick={() => saveCopy(f)} title="Salvează o copie a fișierului unde vrei (de acolo îl deschizi cu programul lui)">📎 {f.name} <span className="muted">({sizeLabel(f.size)})</span></button>
                        {canOpenBytes(f.name) && !isRisky(f.name) && <button onClick={() => void openInApp(f)} title="Deschide fișierul în aplicația lui, într-un tab nou">Deschide</button>}
                        <button onClick={async () => { if ((await askYes(`Scoți fișierul „${f.name}” din notiță?`, 'Scoate fișierul'))) removeFile(f.id); }} title="Scoate fișierul din notiță" aria-label="Scoate fișierul">✕</button>
                      </span>
                    ) : isAudio(f.id) ? (
                      <span key={f.id} className="note-file note-audio">
                        {audioUrl[f.id]
                          ? isVideoName(f.name)
                            ? <><span className="note-audio-name">📹 {f.name.replace(/\.webm$/i, '')}</span><video className="note-video" src={audioUrl[f.id]} controls autoPlay={false} /></>
                            : <><span className="note-audio-name">🎙 {f.name.replace(/\.webm$/i, '')}</span><audio src={audioUrl[f.id]} controls autoPlay={false} /></>
                          : <button onClick={() => playAudio(f)} title={isVideoName(f.name) ? 'Vezi clipul' : 'Ascultă înregistrarea'}>▶ {f.name.replace(/\.webm$/i, '')} <span className="muted">({sizeLabel(f.size)})</span></button>}
                        <button onClick={async () => { if ((await askYes(`Scoți înregistrarea „${f.name}” din notiță?`, 'Scoate înregistrarea'))) removeFile(f.id); }} title="Scoate înregistrarea din notiță" aria-label="Scoate înregistrarea">✕</button>
                      </span>
                    ) : (
                    <span key={f.id} className="note-file">
                      <button onClick={() => openPdf(f)} title="Deschide PDF-ul în modulul PDF">📄 {f.name} <span className="muted">({sizeLabel(f.size)})</span></button>
                      <button onClick={() => void pdfAsPrintout(f)} title="Pune paginile PDF-ului în notiță, ca poze (ca o imprimare): le vezi direct, poți desena sau scrie peste ele" aria-label="Paginile PDF-ului în notiță">🖨 Pagini</button>
                      <button onClick={() => removeFile(f.id)} title="Scoate PDF-ul din notiță" aria-label="Scoate PDF-ul">✕</button>
                    </span>
                    )
                  ))}
                </div>
              ) : null}
              {note.images?.length ? (
                <div className={`note-images ${note.imageSize ? 'size-' + note.imageSize : ''}`}>
                  <select className="note-image-size" value={note.imageSize ?? ''} onChange={(e) => edit({ imageSize: (e.target.value || undefined) as ImageSize | undefined }, false)}
                    title="Cât de mari se arată pozele în notiță (poza păstrată rămâne aceeași)" aria-label="Mărimea pozelor">
                    {(['s', '', 'l'] as const).map((k) => <option key={k} value={k}>{IMAGE_SIZES[k]}</option>)}
                  </select>
                  {note.images.map((src, i) => (
                    <figure key={i} className={`note-image${picked === i ? ' picked' : ''}`}>
                      <img src={src} alt={`Poza ${i + 1}`} onClick={() => setPicked(i)} onDoubleClick={() => setZoom(src)} title="Clic: alege poza (fila Poză) · dublu clic: mărește" />
                      <button onClick={() => removeImage(i)} title="Scoate poza din notiță" aria-label="Scoate poza">✕</button>
                      <button className="rotate" onClick={() => rotate(i)} title="Rotește poza spre dreapta (un sfert de cerc)" aria-label="Rotește poza">⟳</button>
                      <button className="crop" onClick={() => setCropping(i)} title="Decupează poza: păstrezi doar o parte din ea" aria-label="Decupează poza">✂</button>
                      {note.imageInk?.[i]
                        ? <button className="draw-on" onClick={() => setDrawing(i)} title="Editează desenul (liniile se pot muta, șterge sau completa)" aria-label="Editează desenul">✎</button>
                        : <button className="draw-on" onClick={() => setDrawing(i)} title="Desenează sau scrie peste poză (săgeți, cercuri, marker)" aria-label="Desenează peste poză">✎</button>}
                      {diagramAt(i) ? <button className="edit-diagram" onClick={() => setDiagramOpen(i)} title="Schimbă schema (felul, textele, culoarea)" aria-label="Schimbă schema">◇</button> : null}
                      {note.imageText?.[i] ? (
                        <button className="copy-text" onClick={() => copyPhotoText(note.imageText![i]!)} title={`Textul din poză (se găsește la căutare):
${note.imageText[i]!.slice(0, 400)}`}>📋 Text</button>
                      ) : null}
                    </figure>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <div className="empty">
              <p>Alege o notiță din stânga sau apasă <b>+ Notiță nouă</b> (Ctrl+N).</p>
            </div>
          )}
        </section>
      </div>
      {printing && createPortal(
        <div className="notes-print">
          {printing.map((n) => (
            <article key={n.id}>
              <h1>{shownTitle(n)}</h1>
              <p className="np-date">Modificată {when(n.updated)}</p>
              <div className="np-body">{n.title.trim() ? n.body : n.body.split('\n').slice(1).join('\n')}</div>
              {n.files?.length ? <p className="np-files">Atașamente: {n.files.map((f) => f.name).join(', ')}</p> : null}
              {n.images?.map((src, i) => <img key={i} src={src} alt={`Poza ${i + 1}`} />)}
            </article>
          ))}
        </div>,
        document.body,
      )}
      {diaSel !== undefined && note && (
        <DiacriticsDialog where={diaSel ? 'selecție' : 'notiță'}
          items={diaSel ? [{ id: 'body', text: note.body }] : [{ id: 'title', text: note.title }, { id: 'body', text: note.body }]}
          onApply={(res) => {
            const patch: { title?: string; body?: string } = {};
            let n = 0;
            for (const r of res) {
              const ch = diaSel ? r.changes.filter((c) => c.start >= diaSel[0] && c.end <= diaSel[1]) : r.changes;
              if (!ch.length) continue;
              n += ch.length;
              patch[r.id as 'title' | 'body'] = applyDiacritics(r.id === 'title' ? note.title : note.body, ch);
            }
            setDiaSel(undefined);
            if (n) edit(patch);
            setStatus(n ? `Diacritice puse în ${n} cuvinte (↶ Anulează le scoate)` : 'Nicio schimbare');
          }}
          onClose={() => setDiaSel(undefined)} />
      )}
      {lockDlg && note && (
        <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !pwBusy) setLockDlg(false); }}>
          <form className="print-dlg note-lock-dlg" role="dialog" aria-label="Blochează notița" onSubmit={(e) => { e.preventDefault(); lockNote(); }}>
            <h3>🔒 Blochează „{shownTitle(note)}”</h3>
            <p className="print-info">Textul, pozele, PDF-urile și celelalte fișiere atașate ale notiței se criptează (AES-256). Titlul rămâne vizibil în listă.
              <b> Dacă uiți parola, notița nu mai poate fi deschisă de nimeni.</b></p>
            <input type="password" autoFocus placeholder="Parola" value={pw1} onChange={(e) => { setPw1(e.target.value); setPwError(''); }} aria-label="Parola" />
            <input type="password" placeholder="Parola, încă o dată" value={pw2} onChange={(e) => { setPw2(e.target.value); setPwError(''); }} aria-label="Parola, încă o dată" />
            {pwError && <p className="note-pw-error">{pwError}</p>}
            <p className="print-info">Atenție: variantele din Versiuni făcute înainte de blocare păstrează notița neblocată; la fel, până la curățarea lor, celelalte calculatoare care au primit notița și backupurile făcute înainte.</p>
            <div className="note-lock-actions">
              <button type="button" onClick={() => setLockDlg(false)} disabled={pwBusy}>Renunță</button>
              <button type="submit" className="primary" disabled={!pw1 || !pw2 || pwBusy}>{pwBusy ? 'Se blochează…' : 'Blochează'}</button>
            </div>
          </form>
        </div>
      )}
      {cropping !== null && note?.images?.[cropping] && (
        <CropDialog src={note.images[cropping]} onClose={() => setCropping(null)} onDone={(png) => { const at = cropping; setCropping(null); replaceImage(at, png); }} />
      )}
      {drawing !== false && (
        <DrawDialog
          background={typeof drawing === 'number' && !drawnInk ? note?.images?.[drawing] : undefined}
          ink={drawnInk}
          autoReplay={replayInk && !!drawnInk}
          start={pen}
          onClose={() => { setDrawing(false); setReplayInk(false); }}
          onDone={(png, ink) => { const at = drawing; setDrawing(false); setReplayInk(false); const k = ink ? packInk(ink) : null; if (typeof at === 'number') replaceImage(at, png, k); else addImages([png], undefined, [k]); }}
        />
      )}
      {canvasDraw && (
        <DrawDialog ink={canvasInk} start={pen} onClose={() => setCanvasDraw(null)} onDone={(png, ink) => void doneCanvasDraw(png, ink)} />
      )}
      {zoom && (
        <div className="print-overlay note-zoom" onClick={() => setZoom(null)} onKeyDown={(e) => { if (e.key === 'Escape') setZoom(null); }} tabIndex={-1} role="dialog" aria-label="Poza mărită">
          <img src={zoom} alt="Poza mărită" />
        </div>
      )}
      {summary && (
        <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setSummary(false); }} onKeyDown={(e) => { if (e.key === 'Escape') setSummary(false); }}>
          <div className="print-dlg notes-summary" role="dialog" aria-label="Rezumatul etichetelor">
            <h3>🏷 Rezumatul etichetelor</h3>
            <div className="notes-summary-list">
              {tagSummary(store.notes).map((g) => (
                <section key={g.name}>
                  <h4>{g.name} <span className="muted">{g.lines.length}</span></h4>
                  {g.lines.map((l, i) => (
                    <button key={i} onClick={() => { setSummary(false); setArchiveView(false); setTrashView(false); select(l.id); }} title={`Deschide notița „${l.title}”`}>
                      <span>{l.line}</span> <span className="muted">· {l.title}</span>
                    </button>
                  ))}
                </section>
              ))}
            </div>
            <div className="note-lock-actions"><button autoFocus onClick={() => setSummary(false)}>Închide</button></div>
          </div>
        </div>
      )}
      {verDlg && (
        <VersionsDialog
          path={storePath}
          current={() => serializeStore(store)}
          onRestore={(content, label) => {
            try {
              const old = parseStore(content);
              // Readucem notițele șterse de atunci și textul de atunci al notiței deschise; restul rămân cum sunt.
              const ids = new Set(store.notes.map((n) => n.id));
              const missing = old.notes.filter((n) => !ids.has(n.id));
              const back = missing.length;
              const prev = note && old.notes.find((n) => n.id === note.id);
              blocked.current = false;
              change((s) => ({ ...s, notes: [...s.notes.map((n) => (prev && n.id === prev.id ? { ...prev, updated: new Date().toISOString() } : n)), ...missing] }));
              if (!note && missing[0]) setSel(missing[0].id);
              setVerDlg(false);
              setLoadError('');
              setStatus(`Din versiunea de ${label}: ${back ? `${back} ${back === 1 ? 'notiță ștearsă a revenit' : 'notițe șterse au revenit'}` : 'nicio notiță ștearsă'}${note ? '; notița deschisă are textul de atunci' : ''}.`);
            } catch (e) { alert((e as Error).message); }
          }}
          onClose={() => setVerDlg(false)}
        />
      )}
      <div className="statusbar">
        <span>
          {store.notes.length} {store.notes.length === 1 ? 'notiță' : 'notițe'}
          {(query || activeTag || todayOnly || kind) && ` · ${list.length} găsite`}
          {archivedCount > 0 && ` · ${archivedCount} în arhivă`}
          {note && ` · ${words} ${words === 1 ? 'cuvânt' : 'cuvinte'}`}
        </span>
        <span>{ocrStatus ? `${ocrStatus} · ` : ''}{status} <ZoomControl zoom={textZoom} setZoom={setTextZoom} what="textul notiței" /></span>
      </div>
    </div>
  );
}

// Mementoul din listă și din bară: următoarea dată (la cele care se repetă) și 🔁.
function remindText(n: Note): string {
  if (!n.repeat) return remindLabel(n.remind!);
  const { next } = remindTimes(n);
  return `${next ? remindLabel(next.toISOString()) : ''} 🔁 ${REPEATS[n.repeat].toLowerCase()}`;
}

// Mementoul: „azi 15:00”, „mâine 09:00” sau „20.10 15:00”.
function remindLabel(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  const day = (x: Date) => x.toDateString();
  const tomorrow = new Date(Date.now() + 86400000);
  if (day(d) === day(new Date())) return `azi ${time}`;
  if (day(d) === day(tomorrow)) return `mâine ${time}`;
  return `${d.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' })} ${time}`;
}

// Data pentru câmpul „datetime-local” (ora locală, fără fus orar).
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Butoanele rapide: peste N minute, sau (N = -1) mâine la ora 9.
function quickTime(min: number): string {
  if (min >= 0) return new Date(Date.now() + min * 60000).toISOString();
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}
