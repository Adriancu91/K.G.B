// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Caietul de notițe (Notițe v2): toate notițele într-un singur fișier, salvat singur, ca în Google Keep.
// Fișierul e JSON (`suite-notes`), în Documente\Suite, deci se poate copia sau sincroniza cu OneDrive.
import { cleanImages } from './images';
import { cleanInk } from './ink';
import { parseDiagram } from '../docs/diagram';
import { cleanM3d } from '../model3d';
import { isSecret, Secret } from './secret';
import { BACKGROUNDS } from './backgrounds';
import { INK_FONTS } from './inline';
import { boxesText, CanvasBox, cleanBoxes } from './freeCanvas';

export interface Note {
  id: string;
  title: string;
  body: string;
  created: string;
  updated: string;
  /** Calea fișierului .snote din care a fost adusă notița (Notițe v1), ca să nu fie adusă de două ori. */
  source?: string;
  /** Fixată sus în listă. */
  pinned?: boolean;
  /** Culoarea notiței (cheie din COLORS); lipsă = fără culoare. */
  color?: string;
  /** Fundalul ilustrat (cheie din BACKGROUNDS, ca în Keep); lipsă = fără. */
  bg?: string;
  /** Pozele notiței (JPEG micșorat, ca „data:image/…”). */
  images?: string[];
  /**
   * Textul citit cu OCR din fiecare poză (aceeași ordine ca `images`), ca bonurile și actele să se găsească la căutare.
   * Lipsă sau `null` = poza încă n-a fost citită; „” = poza nu are text.
   */
  imageText?: (string | null)[];
  /** Liniile desenelor de mână (aceeași ordine ca `images`, JSON din ink.ts), ca desenul să se poată schimba din nou; null = poză obișnuită. */
  imageInk?: (string | null)[];
  /** Schemele puse cu ◇ Schemă (aceeași ordine ca `images`, JSON din docs/diagram.ts), ca schema să se poată schimba din nou; null = altă poză. */
  imageDiagram?: (string | null)[];
  /** Cât de mari se arată pozele în notiță: mici (s) sau mari (l); lipsă = mijlocii. */
  imageSize?: ImageSize;
  /** Foaia de sub text (ca „Linii de riglă” din OneNote): cu linii sau cu pătrățele; lipsă = simplă. */
  paper?: NotePaper;
  /** Fontul întregii notițe (unul din INK_FONTS, în câmpul de scris, Lectură și la export); lipsă = fontul obișnuit. */
  font?: string;
  /** Locul în „Ordinea mea” (notițe mutate cu mouse-ul); mai mic = mai sus. */
  pos?: number;
  /** PDF-urile atașate (păstrate lângă caiet, vezi `api.addAttachment`). */
  files?: NoteFile[];
  /** Notiță blocată cu parolă: textul, pozele și atașamentele sunt criptate aici (iar `body` e gol). */
  secret?: Secret;
  /** Mementoul: data și ora (ISO) la care Windows arată o notificare. */
  remind?: string;
  /** Mementoul se repetă (ca în Keep): după fiecare notificare vine următoarea, socotită de la data din `remind`. */
  repeat?: Repeat;
  /** Arhivată: nu mai apare în listă (doar în „Arhivă” și la căutare), ca în Google Keep. */
  archived?: boolean;
  /** Secțiunea notiței (ca în OneNote); lipsă = fără secțiune. */
  section?: string;
  /** Caietul notiței (ca mai multe caiete în OneNote); lipsă = caietul principal, „Caietul meu”. */
  book?: string;
  /** Subpagină: id-ul notiței sub care stă în listă (vezi pages.ts); lipsă = pagină de sus. */
  parent?: string;
  /** Doar în coș: când a fost ștearsă (ISO). */
  deleted?: string;
  /** Previzualizările legăturilor web din text (titlul, descrierea și site-ul paginii), aduse la cerere. */
  previews?: LinkPreview[];
  /** Tabelele puse cu ▦ Foaie de calcul: fișierul, foaia și textul pus, ca ↻ Reîmprospătează să le citească din nou. */
  sheetLinks?: SheetLink[];
  /** Casetele puse oriunde pe pânza liberă a notiței (freeCanvas.ts). */
  boxes?: CanvasBox[];
}

/** Legătura unui tabel din notiță cu foaia din care a venit (calea pe disc, numele foii, textul tabelului pus). */
export interface SheetLink { path: string; sheet: string; text: string }

function cleanSheetLinks(raw: unknown): SheetLink[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const list = raw
    .filter((x) => x && typeof x.path === 'string' && x.path && typeof x.text === 'string' && x.text && x.text.length < 40000)
    .slice(-20)
    .map((x) => ({ path: (x.path as string).slice(0, 1000), sheet: typeof x.sheet === 'string' ? (x.sheet as string).slice(0, 200) : '', text: x.text as string }));
  return list.length ? list : undefined;
}

/** Fișa unei legături web: adresa, titlul paginii, descrierea și numele site-ului. */
export interface LinkPreview {
  url: string; title: string; desc?: string; site?: string;
  /** Adresa pozei paginii (og:image), doar cât se aduce poza; nu se păstrează în caiet. */
  image?: string;
  /** Poza paginii, micșorată (data:image/jpeg), păstrată în caiet, ca fișa să nu mai ceară nimic de pe internet. */
  thumb?: string;
  /** Pagina e un clip video online: fișa are ▶ peste poză și se deschide în browser. */
  video?: boolean;
}
const THUMB_RE = /^data:image[/](jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

function cleanPreviews(raw: unknown): LinkPreview[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const list = raw
    .filter((x) => x && typeof x.url === 'string' && typeof x.title === 'string')
    .slice(0, 50)
    .map((x) => ({ url: (x.url as string).slice(0, 2000), title: (x.title as string).slice(0, 300),
      ...(typeof x.desc === 'string' && x.desc ? { desc: (x.desc as string).slice(0, 600) } : {}),
      ...(typeof x.site === 'string' && x.site ? { site: (x.site as string).slice(0, 100) } : {}),
      ...(typeof x.thumb === 'string' && x.thumb.length < 200000 && THUMB_RE.test(x.thumb) ? { thumb: x.thumb as string } : {}),
      ...(x.video === true ? { video: true } : {}) }));
  return list.length ? list : undefined;
}

export type ImageSize = 's' | 'l';
export type NotePaper = 'lines' | 'grid';
export const NOTE_PAPERS: Record<'' | NotePaper, string> = { '': '▤ Foaie simplă', lines: '▤ Foaie cu linii', grid: '▦ Foaie cu pătrățele' };
export const IMAGE_SIZES: Record<'' | ImageSize, string> = { s: 'Poze mici', '': 'Poze mijlocii', l: 'Poze mari' };

/** Un PDF atașat: numele fișierului păstrat lângă caiet, numele original și mărimea în octeți. */
export interface NoteFile {
  id: string; name: string; size: number;
  /** Textul din PDF (primele pagini), ca să se găsească la căutare. */
  text?: string;
  /** Atașamentul unei notițe blocate e criptat cu cheia ei: aici e iv-ul (fără el, fișierul e în clar). */
  enc?: string;
}

function cleanFiles(raw: unknown): NoteFile[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const list = raw
    .filter((f) => f && typeof f.id === 'string' && /^[a-z0-9]+[.](pdf|webm|bin)$/.test(f.id) && typeof f.name === 'string')
    .map((f) => ({ id: f.id as string, name: (f.name as string).slice(0, 200), size: Number(f.size) || 0, ...(typeof f.text === 'string' && f.text ? { text: (f.text as string).slice(0, 20000) } : {}), ...(typeof f.enc === 'string' && f.enc ? { enc: f.enc as string } : {}) }));
  return list.length ? list : undefined;
}

/** O notiță fără titlu, text, poze și atașamente (dispare singură). */
export const isEmpty = (n: Note) => !n.title.trim() && !n.body.trim() && !n.images?.length && !n.files?.length && !n.secret && !n.boxes?.some((b) => b.text.trim() || b.img);

/** Culorile notițelor, ca în Google Keep: [nume, fundal în tema luminoasă, fundal în tema întunecată]. */
export const COLORS: Record<string, [string, string, string]> = {
  rosu: ['Roșu', '#fde2e1', '#4a2427'],
  portocaliu: ['Portocaliu', '#feead0', '#4a3420'],
  galben: ['Galben', '#fdf6c3', '#45401c'],
  verde: ['Verde', '#dcf5dc', '#1f3d27'],
  albastru: ['Albastru', '#dbeafe', '#1f2f4d'],
  mov: ['Mov', '#ede4fd', '#33264f'],
  gri: ['Gri', '#e9e9ee', '#33333d'],
};

export type Repeat = 'zilnic' | 'saptamanal' | 'lunar' | 'anual';
export const REPEATS: Record<Repeat, string> = { zilnic: 'Zilnic', saptamanal: 'Săptămânal', lunar: 'Lunar', anual: 'Anual' };

/** A k-a repetare a mementoului (k = 0 e data aleasă); lunar/anual pe 31 cade pe ultima zi a lunii mai scurte. */
export function occurrence(iso: string, repeat: Repeat, k: number): Date {
  const a = new Date(iso);
  if (repeat === 'zilnic' || repeat === 'saptamanal') {
    const d = new Date(a);
    d.setDate(a.getDate() + k * (repeat === 'zilnic' ? 1 : 7));
    return d;
  }
  const months = k * (repeat === 'lunar' ? 1 : 12);
  const y = a.getFullYear() + Math.floor((a.getMonth() + months) / 12), m = (a.getMonth() + months) % 12;
  const last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(a.getDate(), last), a.getHours(), a.getMinutes(), a.getSeconds());
}

/** Ultima notificare trecută (sau null) și următoarea, pentru o notiță cu memento. */
export function remindTimes(n: Pick<Note, 'remind' | 'repeat'>, now = new Date()): { last: Date | null; next: Date | null } {
  if (!n.remind || Number.isNaN(Date.parse(n.remind))) return { last: null, next: null };
  const first = new Date(n.remind);
  if (!n.repeat) return first > now ? { last: null, next: first } : { last: first, next: null };
  if (first > now) return { last: null, next: first };
  // Pornim de la o estimare (zile trecute / pasul) și mergem înainte până trecem de acum.
  const step = { zilnic: 1, saptamanal: 7, lunar: 31, anual: 366 }[n.repeat];
  let k = Math.max(0, Math.floor((now.getTime() - first.getTime()) / 864e5 / step) - 2);
  while (occurrence(n.remind, n.repeat, k + 1) <= now) k++;
  return { last: occurrence(n.remind, n.repeat, k), next: occurrence(n.remind, n.repeat, k + 1) };
}

export interface NoteStore {
  format: 'suite-notes';
  version: 1;
  notes: Note[];
  /** Secțiunile caietului, în ordinea din listă (și cele încă goale). */
  sections?: string[];
  /** Culoarea fiecărei secțiuni (cheie din COLORS), ca filele colorate din OneNote. */
  sectionColors?: Record<string, string>;
  /** Grupul fiecărei secțiuni (ca grupurile de secțiuni din OneNote): secțiune → numele grupului. */
  sectionGroups?: Record<string, string>;
  /** Coșul de gunoi (ca în Keep): notițele șterse, păstrate TRASH_DAYS zile. */
  trash?: Note[];
  /** Celelalte caiete, în ordinea din listă (și cele încă goale); caietul principal nu apare aici. */
  books?: string[];
  /** Culoarea fiecărui caiet (cheie din COLORS; „” = caietul principal), ca în OneNote. */
  bookColors?: Record<string, string>;
}

export const emptyStore = (): NoteStore => ({ format: 'suite-notes', version: 1, notes: [] });

export function newNote(patch: Partial<Note> = {}): Note {
  const now = new Date().toISOString();
  return { id: `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, title: '', body: '', created: now, updated: now, ...patch };
}

/** O copie a notiței (ca „Fă o copie” din Keep): același conținut, titlul cu „(copie)”, fără memento și fără legătura cu fișierul .snote. */
export function duplicateNote(n: Note): Note {
  const { id: _id, created: _c, updated: _u, source: _s, remind: _r, repeat: _rp, ...rest } = n;
  const copy = newNote({ ...structuredClone(rest), title: n.title.trim() ? `${n.title.trim()} (copie)` : '' });
  return copy;
}

function cleanNote(n: Record<string, unknown>): Note {
  return {
    ...newNote(),
    ...(typeof n.id === 'string' && n.id ? { id: n.id } : {}),
    title: String(n.title ?? ''),
    body: String(n.body ?? ''),
    created: String(n.created ?? n.updated ?? new Date().toISOString()),
    updated: String(n.updated ?? new Date().toISOString()),
    ...(typeof n.source === 'string' ? { source: n.source } : {}),
    ...(n.pinned === true ? { pinned: true } : {}),
    ...(typeof n.color === 'string' && n.color in COLORS ? { color: n.color } : {}),
    ...(typeof n.bg === 'string' && n.bg in BACKGROUNDS ? { bg: n.bg } : {}),
    ...(cleanImages(n.images) ? { images: cleanImages(n.images) } : {}),
    ...(cleanImages(n.images) && Array.isArray(n.imageText)
      ? { imageText: n.imageText.slice(0, cleanImages(n.images)!.length).map((t) => (typeof t === 'string' ? t : null)) }
      : {}),
    ...(cleanInk(n.imageInk, cleanImages(n.images)?.length ?? 0) ? { imageInk: cleanInk(n.imageInk, cleanImages(n.images)!.length) } : {}),
    ...(cleanDiagrams(n.imageDiagram, cleanImages(n.images)?.length ?? 0) ? { imageDiagram: cleanDiagrams(n.imageDiagram, cleanImages(n.images)!.length) } : {}),
    ...(cleanImages(n.images) && (n.imageSize === 's' || n.imageSize === 'l') ? { imageSize: n.imageSize } : {}),
    ...(n.paper === 'lines' || n.paper === 'grid' ? { paper: n.paper } : {}),
    ...(typeof n.font === 'string' && INK_FONTS.some(([f]) => f === n.font) ? { font: n.font } : {}),
    ...(typeof n.pos === 'number' && Number.isFinite(n.pos) ? { pos: n.pos } : {}),
    ...(cleanFiles(n.files) ? { files: cleanFiles(n.files) } : {}),
    ...(cleanPreviews(n.previews) ? { previews: cleanPreviews(n.previews) } : {}),
    ...(cleanSheetLinks(n.sheetLinks) ? { sheetLinks: cleanSheetLinks(n.sheetLinks) } : {}),
    ...(cleanBoxes(n.boxes) ? { boxes: cleanBoxes(n.boxes) } : {}),
    ...(isSecret(n.secret) ? { secret: n.secret } : {}),
    ...(typeof n.remind === 'string' && !Number.isNaN(Date.parse(n.remind)) ? { remind: n.remind } : {}),
    ...(typeof n.remind === 'string' && typeof n.repeat === 'string' && n.repeat in REPEATS ? { repeat: n.repeat as Repeat } : {}),
    ...(n.archived === true ? { archived: true } : {}),
    ...(cleanSection(n.section) ? { section: cleanSection(n.section) } : {}),
    ...(cleanSection(n.book) ? { book: cleanSection(n.book) } : {}),
    ...(typeof n.parent === 'string' && n.parent && n.parent !== n.id ? { parent: n.parent } : {}),
  };
}

export function parseStore(text: string): NoteStore {
  const data = JSON.parse(text);
  if (data?.format !== 'suite-notes' || !Array.isArray(data.notes)) throw new Error('Fișierul nu este un caiet de notițe Cyber Office Studio.');
  const notes: Note[] = data.notes
    .filter((n: unknown) => n && typeof n === 'object')
    .map(cleanNote);
  const sections = sectionsOf({ format: 'suite-notes', version: 1, notes, sections: Array.isArray(data.sections) ? data.sections.map(cleanSection).filter(Boolean) : [] });
  const colors: Record<string, string> = {};
  if (data.sectionColors && typeof data.sectionColors === 'object') {
    for (const [k, v] of Object.entries(data.sectionColors as Record<string, unknown>)) {
      if (sections.includes(k) && typeof v === 'string' && v in COLORS) colors[k] = v;
    }
  }
  const groups: Record<string, string> = {};
  if (data.sectionGroups && typeof data.sectionGroups === 'object') {
    for (const [k, v] of Object.entries(data.sectionGroups as Record<string, unknown>)) {
      if (sections.includes(k) && cleanSection(v)) groups[k] = cleanSection(v);
    }
  }
  const trash = purgeTrash(Array.isArray(data.trash)
    ? data.trash.filter((n: unknown) => n && typeof n === 'object').map((n: Record<string, unknown>) => ({ ...cleanNote(n), deleted: typeof n.deleted === 'string' && !Number.isNaN(Date.parse(n.deleted)) ? n.deleted : new Date().toISOString() }))
    : []);
  const books = booksOf({ format: 'suite-notes', version: 1, notes, books: Array.isArray(data.books) ? data.books.map(cleanSection).filter(Boolean) : [] }).filter(Boolean);
  const bookColors: Record<string, string> = {};
  if (data.bookColors && typeof data.bookColors === 'object') {
    for (const [k, v] of Object.entries(data.bookColors as Record<string, unknown>)) {
      if ((k === '' || books.includes(k)) && typeof v === 'string' && v in COLORS) bookColors[k] = v;
    }
  }
  return { format: 'suite-notes', version: 1, notes, ...(sections.length ? { sections } : {}), ...(Object.keys(colors).length ? { sectionColors: colors } : {}), ...(Object.keys(groups).length ? { sectionGroups: groups } : {}), ...(trash.length ? { trash } : {}), ...(books.length ? { books } : {}), ...(Object.keys(bookColors).length ? { bookColors } : {}) };
}

/** Numele caietului principal (notițele fără `book`). */
export const MAIN_BOOK = 'Caietul meu';

/** Caietele: „” (cel principal) primul, apoi cele salvate, în ordinea lor, apoi cele folosite de notițe și nesalvate în listă. */
export function booksOf(s: NoteStore): string[] {
  const out = ['', ...new Set((s.books ?? []).filter((b) => b && b !== MAIN_BOOK))];
  for (const n of s.notes) if (n.book && !out.includes(n.book)) out.push(n.book);
  return out;
}

/** Notițele unui caiet („” = cel principal). */
export const inBook = (notes: Note[], book: string) => notes.filter((n) => (n.book ?? '') === book);

/** Secțiunile care se arată într-un caiet: cele cu notițe în el și cele încă goale (fără notițe în niciun caiet). */
export function sectionsIn(s: NoteStore, book: string): string[] {
  const here = new Set(inBook(s.notes, book).map((n) => n.section).filter(Boolean));
  const used = new Set(s.notes.map((n) => n.section).filter(Boolean));
  return sectionsOf(s).filter((x) => here.has(x) || !used.has(x));
}

/** Adaugă un caiet (dacă nu există deja, fără să conteze literele mari). Întoarce caietul de notițe și numele folosit. */
export function addBook(s: NoteStore, name: string): [NoteStore, string] {
  const clean = cleanSection(name);
  if (!clean) return [s, ''];
  if (plain(clean) === plain(MAIN_BOOK)) return [s, ''];
  const have = booksOf(s).find((x) => x && plain(x) === plain(clean));
  if (have) return [s, have];
  return [{ ...s, books: [...booksOf(s).filter(Boolean), clean] }, clean];
}

/** Redenumește un caiet (și în notițele lui). Dacă noul nume există deja, caietele se unesc. Caietul principal nu se redenumește. */
export function renameBook(s: NoteStore, old: string, name: string): NoteStore {
  const clean = cleanSection(name);
  if (!old || !clean || clean === old) return s;
  const to = plain(clean) === plain(MAIN_BOOK) ? '' : booksOf(s).find((x) => x && x !== old && plain(x) === plain(clean)) ?? clean;
  const books = booksOf(s).filter(Boolean).map((x) => (x === old ? to : x)).filter((x, i, a) => x && a.indexOf(x) === i);
  const notes = s.notes.map((n) => (n.book === old ? moveBook(n, to) : n));
  const color = s.bookColors?.[to] ?? s.bookColors?.[old];
  return setBookColor(setBookColor({ ...dropBooks(s), notes, ...(books.length ? { books } : {}) }, old, undefined), to, color);
}

/** Șterge caietul; notițele lui nu se pierd, ci trec în caietul principal. */
export function removeBook(s: NoteStore, name: string): NoteStore {
  if (!name) return s;
  const books = booksOf(s).filter((x) => x && x !== name);
  return setBookColor({ ...dropBooks(s), notes: s.notes.map((n) => (n.book === name ? moveBook(n, '') : n)), ...(books.length ? { books } : {}) }, name, undefined);
}

const dropBooks = (s: NoteStore): NoteStore => { const { books: _, ...rest } = s; return rest; };
const moveBook = (n: Note, to: string): Note => { const { book: _, ...rest } = n; return to ? { ...rest, book: to } : rest; };

/** Culoarea unui caiet („” = cel principal); fără culoare = se scoate. */
export function setBookColor(s: NoteStore, name: string, color: string | undefined): NoteStore {
  const colors = { ...(s.bookColors ?? {}) };
  if (color && color in COLORS) colors[name] = color; else delete colors[name];
  const { bookColors: _, ...rest } = s;
  return Object.keys(colors).length ? { ...rest, bookColors: colors } : rest;
}

/** Mută notițele cu aceste id-uri în alt caiet („” = cel principal). */
export function moveToBook(s: NoteStore, ids: Set<string>, to: string): NoteStore {
  return { ...s, notes: s.notes.map((n) => (ids.has(n.id) ? moveBook(n, to) : n)) };
}

/** Câte zile stă o notiță în coș până se șterge de tot. */
export const TRASH_DAYS = 30;

/** Scoate din coș notițele mai vechi de TRASH_DAYS zile. */
export function purgeTrash(trash: Note[], now = new Date()): Note[] {
  const limit = now.getTime() - TRASH_DAYS * 864e5;
  return trash.filter((n) => Date.parse(n.deleted ?? '') > limit);
}

/** Șterge o notiță: ajunge în coș (cea mai nouă prima). */
export function trashNote(s: NoteStore, id: string, now = new Date()): NoteStore {
  const n = s.notes.find((x) => x.id === id);
  if (!n) return s;
  return { ...s, notes: s.notes.filter((x) => x.id !== id), trash: [{ ...n, deleted: now.toISOString() }, ...(s.trash ?? [])] };
}

/** Readuce o notiță din coș în caiet (în secțiunea ei, dacă mai există). */
export function restoreNote(s: NoteStore, id: string): NoteStore {
  const n = s.trash?.find((x) => x.id === id);
  if (!n) return s;
  const { deleted: _d, ...note } = n;
  return withTrash({ ...s, notes: [...s.notes, note] }, s.trash!.filter((x) => x.id !== id));
}

/** Șterge de tot din coș o notiță (sau, fără id, tot coșul). */
export function purgeNote(s: NoteStore, id?: string): NoteStore {
  return withTrash(s, id ? (s.trash ?? []).filter((x) => x.id !== id) : []);
}

function withTrash(s: NoteStore, trash: Note[]): NoteStore {
  const { trash: _t, ...rest } = s;
  return trash.length ? { ...rest, trash } : rest;
}

/** Schimbă culoarea unei secțiuni (`undefined` = fără culoare). */
export function setSectionColor(s: NoteStore, name: string, color: string | undefined): NoteStore {
  const colors = { ...(s.sectionColors ?? {}) };
  if (color && color in COLORS) colors[name] = color; else delete colors[name];
  const { sectionColors: _, ...rest } = s;
  return Object.keys(colors).length ? { ...rest, sectionColors: colors } : rest;
}

/** Numele unei secțiuni: fără spații la capete, cel mult 40 de caractere; altceva decât text → „”. */
export const cleanSection = (s: unknown) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, 40) : '');

/** Secțiunile caietului: cele salvate, în ordinea lor, apoi cele folosite de notițe și nesalvate în listă. */
export function sectionsOf(s: NoteStore): string[] {
  const out = [...new Set((s.sections ?? []).filter(Boolean))];
  for (const n of s.notes) if (n.section && !out.includes(n.section)) out.push(n.section);
  return out;
}

/** Adaugă o secțiune (dacă nu există deja, fără să conteze literele mari). Întoarce caietul și numele folosit. */
export function addSection(s: NoteStore, name: string): [NoteStore, string] {
  const clean = cleanSection(name);
  if (!clean) return [s, ''];
  const have = sectionsOf(s).find((x) => plain(x) === plain(clean));
  if (have) return [s, have];
  return [{ ...s, sections: [...sectionsOf(s), clean] }, clean];
}

/** Redenumește o secțiune (și în notițele ei). Dacă noul nume există deja, secțiunile se unesc. */
export function renameSection(s: NoteStore, old: string, name: string): NoteStore {
  const clean = cleanSection(name);
  if (!clean || clean === old) return s;
  const have = sectionsOf(s).find((x) => x !== old && plain(x) === plain(clean)) ?? clean;
  const sections = sectionsOf(s).map((x) => (x === old ? have : x)).filter((x, i, a) => a.indexOf(x) === i);
  // Culoarea merge cu secțiunea (dacă secțiunile se unesc, rămâne culoarea celei existente).
  const color = s.sectionColors?.[have] ?? s.sectionColors?.[old];
  const group = s.sectionGroups?.[have] ?? s.sectionGroups?.[old];
  const moved = setSectionGroup(setSectionGroup(setSectionColor(setSectionColor(s, old, undefined), have, color), old, ''), have, group ?? '');
  return { ...moved, sections, notes: s.notes.map((n) => (n.section === old ? { ...n, section: have } : n)) };
}

/** Șterge secțiunea; notițele ei rămân în caiet, fără secțiune. */
export function removeSection(s: NoteStore, name: string): NoteStore {
  return {
    ...setSectionGroup(setSectionColor(s, name, undefined), name, ''),
    sections: sectionsOf(s).filter((x) => x !== name),
    notes: s.notes.map((n) => (n.section === name ? (({ section: _, ...rest }) => rest)(n) : n)),
  };
}

/** Pune secțiunea într-un grup de secțiuni (ca în OneNote); grup gol = o scoate din grup. */
export function setSectionGroup(s: NoteStore, section: string, group: string): NoteStore {
  const g = cleanSection(group);
  const map = { ...(s.sectionGroups ?? {}) };
  if (g) map[section] = g; else delete map[section];
  const { sectionGroups: _, ...rest } = s;
  return Object.keys(map).length ? { ...rest, sectionGroups: map } : rest;
}

/** Ce se scrie în câmpul secțiunii: „Grup / Secțiune” pune secțiunea în grup; fără „/” secțiunea n-are grup. */
export function splitSectionPath(text: string): { group: string; name: string; grouped: boolean } {
  const i = text.indexOf('/');
  if (i < 0) return { group: '', name: cleanSection(text), grouped: false };
  return { group: cleanSection(text.slice(0, i)), name: cleanSection(text.slice(i + 1)), grouped: true };
}

/** Numele secțiunii cu grupul în față („Școală / Mate”), cum apare în câmpul de redenumire. */
export const sectionPath = (s: NoteStore, section: string) => (s.sectionGroups?.[section] ? `${s.sectionGroups[section]} / ${section}` : section);

/** Redenumește un grup de secțiuni (pentru toate secțiunile lui); nume gol = desface grupul (secțiunile rămân). */
export function renameGroup(s: NoteStore, old: string, name: string): NoteStore {
  const g = cleanSection(name);
  const have = Object.values(s.sectionGroups ?? {}).find((x) => x !== old && plain(x) === plain(g)) ?? g;
  let out = s;
  for (const [sec, grp] of Object.entries(s.sectionGroups ?? {})) if (grp === old) out = setSectionGroup(out, sec, have);
  return out;
}

/**
 * Secțiunile din listă, așezate pe grupuri: întâi cele fără grup (group „”), apoi fiecare grup, în ordinea în care
 * apare prima lui secțiune, cu secțiunile lui în ordinea listei.
 */
export function sectionTree(s: NoteStore, list: string[]): { group: string; sections: string[] }[] {
  const free: string[] = [];
  const groups = new Map<string, string[]>();
  for (const x of list) {
    const g = s.sectionGroups?.[x];
    if (!g) { free.push(x); continue; }
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(x);
  }
  return [...(free.length ? [{ group: '', sections: free }] : []), ...[...groups].map(([group, sections]) => ({ group, sections }))];
}

export const serializeStore = (s: NoteStore) => JSON.stringify(s, null, 1);

/** Fără diacritice și cu litere mici: „Ședința” → „sedinta” (și pentru ş/ţ cu sedilă). */
export const plain = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Unde apare căutarea în text, fără să conteze literele mari și diacriticele: perechi [început, sfârșit) în textul original. */
export function findAll(text: string, query: string): [number, number][] {
  const q = plain(query.trim());
  if (!q) return [];
  // Textul fără diacritice, cu poziția din original a fiecărui caracter.
  let flat = '';
  const at: number[] = [];
  for (let i = 0; i < text.length; i++) { const c = plain(text[i]); flat += c; for (let k = 0; k < c.length; k++) at.push(i); }
  at.push(text.length);
  const out: [number, number][] = [];
  for (let i = flat.indexOf(q); i >= 0 && out.length < 5000; i = flat.indexOf(q, i + q.length)) out.push([at[i], at[i + q.length - 1] + 1]);
  return out;
}

/** Titlul afișat: cel scris sau primul rând al textului. */
export const shownTitle = (n: Note) => n.title.trim() || n.body.trim().split('\n')[0].slice(0, 80) || 'Notiță fără titlu';

/** Etichetele unei notițe: cuvintele scrise cu # în titlu sau text („#acte”, „#Ședință”), fără diacritice și litere mari. */
export function tagsOf(n: Note): string[] {
  const out = new Set<string>();
  for (const m of `${n.title}\n${n.body}`.matchAll(/(?:^|[\s(,;])#([\p{L}\p{N}_-]{1,40})/gu)) out.add(plain(m[1]));
  return [...out];
}

/** Numele scris pentru o etichetă: fără „#”, spațiile devin „-”, doar litere, cifre, „_” și „-” (cel mult 40). */
export function cleanTag(name: string): string {
  return name.trim().replace(/^#+/, '').replace(/\s+/g, '-').replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 40);
}

/**
 * Redenumește eticheta `old` în toate notițele (ca în Keep: „Editează etichetele”); cu numele gol o șterge:
 * cuvântul rămâne în text, doar fără „#”. Data notițelor nu se schimbă. Notițele blocate se schimbă doar în titlu.
 */
export function retag(s: NoteStore, old: string, name: string): NoteStore {
  const to = cleanTag(name);
  if (name.trim() && !to) return s;
  const re = /(^|[\s(,;])#([\p{L}\p{N}_-]{1,40})/gu;
  const fix = (text: string) => text.replace(re, (m, pre: string, word: string) => (plain(word) === old ? (to ? `${pre}#${to}` : `${pre}${word}`) : m));
  let changed = false;
  const notes = s.notes.map((n) => {
    const title = fix(n.title), body = n.secret ? n.body : fix(n.body);
    if (title === n.title && body === n.body) return n;
    changed = true;
    return { ...n, title, body };
  });
  return changed ? { ...s, notes } : s;
}

/** Un rând din rezumat: notița și rândul ei. */
export interface SummaryLine { id: string; title: string; line: string }

/**
 * Rezumatul etichetelor (ca „Tag Summary” din OneNote): pentru fiecare #etichetă, rândurile care o conțin, din toate notițele
 * nearhivate (cele blocate doar după titlu); primul grup e „De făcut”: toate rândurile ☐ nebifate.
 */
export function tagSummary(notes: Note[]): { name: string; tag: string; lines: SummaryLine[] }[] {
  const live = notes.filter((n) => !n.archived);
  const rows = (n: Note) => [n.title, ...(n.secret ? [] : n.body.split(String.fromCharCode(10)))].map((l) => l.trim()).filter(Boolean);
  const todo: SummaryLine[] = [];
  for (const n of live) for (const l of rows(n)) if (l.startsWith('☐')) todo.push({ id: n.id, title: shownTitle(n), line: l.slice(1).trim() });
  const groups = allTags(live).map(([tag]) => {
    const lines: SummaryLine[] = [];
    for (const n of live) for (const l of rows(n)) if (tagsOf({ ...n, title: l, body: '' }).includes(tag)) lines.push({ id: n.id, title: shownTitle(n), line: l });
    return { name: '#' + tag, tag, lines };
  });
  // Semnele pe rând (⭐ Important, ❓ Întrebare…), puse din bara notiței.
  const marks = ([['⭐', 'Important'], ['❓', 'Întrebare'], ['💡', 'Idee'], ['📞', 'De sunat'], ['📌', 'De ținut minte']] as const).map(([mk, label]) => {
    const lines: SummaryLine[] = [];
    for (const n of live) for (const l of rows(n)) if (l.startsWith(mk + ' ')) lines.push({ id: n.id, title: shownTitle(n), line: l.slice(mk.length + 1) });
    return { name: `${mk} ${label}`, tag: '', lines };
  }).filter((g) => g.lines.length);
  return [...(todo.length ? [{ name: '☐ De făcut', tag: '', lines: todo }] : []), ...marks, ...groups];
}

/** Toate etichetele din caiet, cu numărul de notițe, cele mai folosite întâi. */
export function allTags(notes: Note[]): [string, number][] {
  const count = new Map<string, number>();
  for (const n of notes) for (const t of tagsOf(n)) count.set(t, (count.get(t) ?? 0) + 1);
  return [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ro'));
}

/**
 * Notițele care conțin toate cuvintele căutate (în titlu sau text) și, dacă e aleasă, eticheta dată.
 * Cele fixate sunt primele, apoi cele mai noi.
 */
/**
 * Notițele arătate în listă: în „Arhivă” doar cele arhivate; altfel cele nearhivate,
 * iar la căutare sau după etichetă și cele arhivate (ca în Keep, ca să le găsești).
 */
export function inView(notes: Note[], archive: boolean, query: string, tag = ''): Note[] {
  const found = search(notes, query, tag);
  if (archive) return found.filter((n) => n.archived);
  return query.trim() || tag ? found : found.filter((n) => !n.archived);
}

export function search(notes: Note[], query: string, tag = ''): Note[] {
  const words = plain(query).split(/\s+/).filter(Boolean);
  const sorted = [...notes].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updated.localeCompare(a.updated));
  return sorted.filter((n) => {
    if (tag && !tagsOf(n).includes(tag)) return false;
    const hay = plain(`${n.title}\n${n.body}\n${boxesText(n.boxes)}\n${photoText(n)}\n${(n.files ?? []).map((f) => `${f.name} ${f.text ?? ''}`).join('\n')}\n${previewText(n)}`);
    return words.every((w) => hay.includes(w));
  });
}

/** Filtrul după tip sau culoare (ca în Keep): „bifat”, „poze”, „pdf”, „memento”, „blocate”, „legaturi” sau „culoare:<cheie>”. */
export const KINDS: [string, string][] = [['bifat', '☐ Cu listă de bifat'], ['poze', '🖼 Cu poze sau desene'], ['pdf', '📎 Cu PDF'], ['memento', '⏰ Cu memento'], ['legaturi', '🔗 Cu legături web'], ['blocate', '🔒 Blocate cu parolă'],
  // Modificări recente (ca în OneNote): după data ultimei schimbări.
  ['azi', '🕘 Modificate azi'], ['7zile', '🕘 Modificate în ultimele 7 zile'], ['30zile', '🕘 Modificate în ultimele 30 de zile']];
export function matchesKind(n: Note, kind: string, now = new Date()): boolean {
  if (!kind) return true;
  if (kind === 'azi' || kind === '7zile' || kind === '30zile') {
    const from = new Date(now);
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (kind === 'azi' ? 0 : kind === '7zile' ? 6 : 29));
    return Date.parse(n.updated) >= from.getTime();
  }
  if (kind.startsWith('culoare:')) return (n.color ?? '') === kind.slice(8);
  switch (kind) {
    case 'bifat': return /^ *[☐☑]/m.test(n.body);
    case 'poze': return !!n.images?.length;
    case 'pdf': return !!n.files?.length;
    case 'memento': return !!n.remind;
    case 'legaturi': return webLinksOf(n).length > 0;
    case 'blocate': return !!n.secret;
    default: return true;
  }
}

/** Ordinea listei (ca în OneNote): după ultima modificare, după data creării sau după titlu; cele fixate rămân primele. */
export type SortMode = 'updated' | 'created' | 'title' | 'manual';
export const SORT_LABELS: Record<SortMode, string> = { updated: 'Modificate recent', created: 'Create recent', title: 'Titlu (A–Z)', manual: 'Ordinea mea (trage cu mouse-ul)' };
const collator = new Intl.Collator('ro', { sensitivity: 'base', numeric: true });
export function sortNotes(notes: Note[], mode: SortMode): Note[] {
  if (mode === 'updated') return notes; // ordinea din search()
  const key = (n: Note) => (n.secret ? n.title : shownTitle(n)).trim();
  // Notițele noi (fără loc) stau deasupra celor aranjate, ca în Keep.
  const pos = (n: Note) => n.pos ?? Number.NEGATIVE_INFINITY;
  return [...notes].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned)
    || (mode === 'manual' ? (pos(a) === pos(b) ? b.updated.localeCompare(a.updated) : pos(a) - pos(b)) : 0)
    || (mode === 'manual' ? 0 : mode === 'title' ? collator.compare(key(a), key(b)) || b.updated.localeCompare(a.updated) : b.created.localeCompare(a.created)));
}

/**
 * Mută notița `dragId` în locul notiței `targetId` în „Ordinea mea” (ca tragerea cardurilor în Keep). Ordinea se socotește pe tot caietul,
 * ca mutările făcute într-o secțiune să rămână la locul lor și în „Toate”; fiecare notiță primește apoi locul ei (pos).
 */
export function moveNote(notes: Note[], dragId: string, targetId: string): Note[] {
  const order = sortNotes(notes, 'manual').map((n) => n.id);
  const from = order.indexOf(dragId);
  const to = order.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return notes;
  order.splice(from, 1);
  order.splice(to, 0, dragId);
  const at = new Map(order.map((id, i) => [id, i]));
  return notes.map((n) => (n.pos === at.get(n.id) ? n : { ...n, pos: at.get(n.id) }));
}

/** Tot textul citit din pozele notiței, pe un singur șir. */
export const photoText = (n: Note) => (n.imageText ?? []).filter(Boolean).join('\n');
/** Textul fișelor de legături (site, titlu, descriere), ca o pagină pusă în notiță să se găsească după titlul ei. */
export const previewText = (n: Note) => (n.previews ?? []).map((x) => `${x.site ?? ''} ${x.title} ${x.desc ?? ''}`).join('\n');

/** Pozele care încă n-au fost citite cu OCR: [notița, poziția pozei], cele mai noi notițe întâi. */
export function unreadPhotos(notes: Note[]): [Note, number][] {
  const out: [Note, number][] = [];
  for (const n of [...notes].sort((a, b) => b.updated.localeCompare(a.updated))) {
    (n.images ?? []).forEach((_, i) => { if (typeof n.imageText?.[i] !== 'string') out.push([n, i]); });
  }
  return out;
}

// Adrese web scrise în text: „https://…”, „http://…” sau „www.…”. Punctuația de la capăt (punct, virgulă, paranteză) nu intră.
const WEB_RE = /(?:https?:\/\/|www\.)[^\s<>"'«»„”]+/gi;
const trimUrl = (u: string) => {
  let s = u.replace(/[.,;:!?…]+$/, '');
  // O paranteză de închidere rămâne doar dacă are pereche în adresă (de exemplu Wikipedia: „…_(film)”).
  while (s.endsWith(')') && (s.match(/\(/g)?.length ?? 0) < (s.match(/\)/g)?.length ?? 0)) s = s.slice(0, -1).replace(/[.,;:!?…]+$/, '');
  return s;
};
/** Adresa completă de deschis („www.x.ro” → „https://www.x.ro”). */
export const webHref = (u: string) => (/^https?:\/\//i.test(u) ? u : `https://${u}`);

/** Legăturile web din notiță, în ordine, fără repetări (cel mult 20). */
export function webLinksOf(n: Note): string[] {
  const out = new Set<string>();
  for (const m of `${n.title}\n${n.body}`.matchAll(WEB_RE)) {
    const u = trimUrl(m[0]);
    if (/[a-z0-9]\.[a-z]{2,}/i.test(u)) out.add(u);
    if (out.size >= 20) break;
  }
  return [...out];
}

/** Textul împărțit în bucăți simple și adrese web (pentru → Docs, unde adresele devin hyperlink-uri). */
export function webSpans(text: string): { s: string; url?: string }[] {
  const out: { s: string; url?: string }[] = [];
  let at = 0;
  for (const m of text.matchAll(WEB_RE)) {
    const u = trimUrl(m[0]);
    if (!/[a-z0-9]\.[a-z]{2,}/i.test(u)) continue;
    if (m.index! > at) out.push({ s: text.slice(at, m.index) });
    out.push({ s: u, url: webHref(u) });
    at = m.index! + u.length;
  }
  if (at < text.length) out.push({ s: text.slice(at) });
  return out;
}

/** Legătura web de pe poziția `pos` din text (pentru Ctrl+click), sau null. */
export function webLinkAt(text: string, pos: number): string | null {
  for (const m of text.matchAll(WEB_RE)) {
    const u = trimUrl(m[0]);
    if (pos >= m.index! && pos <= m.index! + u.length) return u;
  }
  return null;
}

/** Legăturile scrise în notiță ca [[Titlul altei notițe]], în ordine, fără repetări. */
export function linksOf(n: Note): string[] {
  const out = new Map<string, string>();
  for (const m of n.body.matchAll(/\[\[([^[\]\n]{1,80})\]\]/g)) {
    const t = m[1].trim();
    if (t && !out.has(plain(t))) out.set(plain(t), t);
  }
  return [...out.values()];
}

/** Notița cu acest titlu (fără diacritice și litere mari), dacă există. */
export function findByTitle(notes: Note[], title: string): Note | undefined {
  const key = plain(title.trim());
  return notes.find((n) => plain(shownTitle(n).trim()) === key);
}

/** Notițele care trimit la aceasta cu [[...]] („Menționată în”). */
export function backlinks(notes: Note[], n: Note): Note[] {
  const key = plain(shownTitle(n).trim());
  return notes.filter((o) => o.id !== n.id && linksOf(o).some((t) => plain(t) === key));
}

/** Vederea „Azi”: notițele cu memento azi sau deja trecut, cele mai vechi primele. */
export function dueToday(notes: Note[], now = new Date()): Note[] {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  // Cele fără repetare: azi sau trecute (nefăcute). Cele care se repetă: dacă una dintre repetări cade azi.
  const at = (n: Note): number | null => {
    if (!n.remind) return null;
    const { last, next } = remindTimes(n, now);
    if (!n.repeat) return Date.parse(n.remind) <= end.getTime() ? Date.parse(n.remind) : null;
    if (last && last >= start) return last.getTime();
    return next && next <= end ? next.getTime() : null;
  };
  return notes
    .filter((n) => at(n) !== null)
    .sort((a, b) => at(a)! - at(b)!);
}

/** O bucată din text în jurul primului cuvânt găsit (sau începutul textului), pe un singur rând. */
export function snippet(n: Note, query: string): string {
  if (n.secret) return '🔒 Notiță blocată cu parolă';
  const body = n.title.trim() ? n.body : n.body.split('\n').slice(1).join('\n');
  const flat = body.replace(/\s+/g, ' ').trim();
  const words = plain(query).split(/\s+/).filter(Boolean);
  // plain() păstrează lungimea textului (literele cu diacritice devin o singură literă), deci pozițiile se potrivesc.
  const at = words.length ? Math.min(...words.map((w) => plain(flat).indexOf(w)).filter((i) => i >= 0)) : -1;
  if (words.length && !Number.isFinite(at)) {
    // Cuvântul e doar în textul unei poze: arătăm bucata de acolo.
    const ph = photoText(n).replace(/\s+/g, ' ').trim();
    const p = Math.min(...words.map((w) => plain(ph).indexOf(w)).filter((i) => i >= 0));
    if (Number.isFinite(p)) return '📷 ' + (p < 30 ? '' : '…') + ph.slice(Math.max(0, p - 30), p + 90);
    // …sau în textul unui PDF atașat.
    for (const f of n.files ?? []) {
      const ft = (f.text ?? '').replace(/\s+/g, ' ');
      const q = Math.min(...words.map((w) => plain(ft).indexOf(w)).filter((i) => i >= 0));
      if (Number.isFinite(q)) return `📎 ${f.name}: ` + (q < 30 ? '' : '…') + ft.slice(Math.max(0, q - 30), q + 90);
    }
    // …sau în fișa unei legături web.
    for (const x of n.previews ?? []) {
      const t = `${x.title} — ${x.desc ?? ''}`.replace(/\s+/g, ' ');
      if (words.some((w) => plain(t).includes(w))) return `🔗 ${t.slice(0, 120)}`;
    }
  }
  if (!Number.isFinite(at) || at < 40) return flat.slice(0, 120);
  return '…' + flat.slice(at - 30, at + 90);
}

/** „azi, 14:05”, „ieri, 09:12” sau „12.10.2026”. */
export function when(iso: string): string {
  const d = new Date(iso);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(new Date()) - day(d)) / 86400000);
  const time = d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  if (diff === 0) return `azi, ${time}`;
  if (diff === 1) return `ieri, ${time}`;
  return d.toLocaleDateString('ro-RO');
}

/** Textul de pe cardul din vederea Grilă (ca în Google Keep): primele rânduri ale notiței, cu rândurile păstrate. */
export function cardText(n: Note, maxLines = 10): string {
  if (n.secret) return '🔒 Notiță blocată cu parolă';
  const lines = (n.title.trim() ? n.body : n.body.split('\n').slice(1).join('\n')).split('\n').map((l) => l.trimEnd());
  while (lines.length && !lines[0].trim()) lines.shift();
  const out = lines.slice(0, maxLines).map((l) => (l.length > 140 ? l.slice(0, 140) + '…' : l));
  return out.join('\n').trimEnd() + (lines.length > maxLines ? '\n…' : '');
}

/** Notițele țin cel mult atâta din fișierul unui model 3D lângă poza lui (caietul se încarcă tot deodată). */
export const NOTE_MODEL3D_MAX = 1024 * 1024;

/** `imageDiagram` curățat la citirea caietului: aceeași lungime ca pozele, doar scheme bune (sau modele 3D, ca {"m3d": …}); undefined dacă nu e niciuna. */
export function cleanDiagrams(raw: unknown, count: number): (string | null)[] | undefined {
  if (!Array.isArray(raw) || !count) return undefined;
  const list = raw.slice(0, count).map((v) => {
    if (typeof v !== 'string' || v.length > NOTE_MODEL3D_MAX * 1.4 + 2000) return null;
    try {
      const o = JSON.parse(v);
      if (o && typeof o === 'object' && 'm3d' in o) { const k = cleanM3d(o.m3d); return k ? JSON.stringify({ m3d: k }) : null; }
      if (v.length > 20000) return null;
      const d = parseDiagram(o); return d ? JSON.stringify(d) : null;
    } catch { return null; }
  });
  return list.some(Boolean) ? list : undefined;
}
