// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Formatul fișierelor .sdoc: conținutul editorului (JSON ProseMirror) plus metadate.
import type { JSONContent } from '@tiptap/react';
import { cleanSheetPw, type SheetPw } from '../sheets/sheetPassword';
import { cleanStyles, type DocStyles } from './docStyles';
import { cleanDocMacros, type DocMacro } from './macros';

/** Antetul și subsolul paginilor (la PDF, tipărire și Word); numerele de pagină sunt „Pagina 1 din 3”. */
export interface PageSetup {
  header: string;
  footer: string;
  numbers: boolean;
  /** Pagina A4 culcată (peisaj). */
  landscape?: boolean;
  /** Mărimea hârtiei (lipsă = A4). */
  paper?: Paper;
  /** Marginile paginii, în milimetri (aceleași pe toate laturile). */
  margin?: number;
  /** Margini diferite pe fiecare latură, în milimetri (Word: Margini particularizate); dacă lipsesc, toate sunt `margin`. */
  margins?: Margins;
  /** Stilurile schimbate ale documentului (Modifică stilul): Text normal, Titlu document, Titlu 1–3. */
  styles?: DocStyles;
  /** Textul pe coloane, ca la ziare și pliante (1–3; lipsă = o coloană). */
  columns?: number;
  /** Linie subțire între coloane (Aspect → Coloane → Linie între coloane). */
  colLine?: boolean;
  /** Numerele rândurilor în marginea din stânga (contracte, texte juridice): din `by` în `by`, de la 1 pe fiecare pagină sau continuu. */
  lineNums?: LineNums;
  /** Filigranul: text mare, deschis la culoare, pe diagonala fiecărei pagini („CIORNĂ”, „CONFIDENȚIAL”). */
  watermark?: string;
  /** Culoarea filigranului („#c62828”); lipsă = gri. Și dacă stă orizontal în loc de pe diagonală. */
  watermarkColor?: string;
  watermarkFlat?: boolean;
  /** Fontul filigranului (dintre WATERMARK_FONTS); lipsă = fontul implicit. */
  watermarkFont?: string;
  /** Filigranul din imagine (data:image/png sau jpeg), decolorat, în mijlocul fiecărei pagini; are întâietate față de text. */
  watermarkImage?: string;
  /** Imaginea din antet (data:image/png sau jpeg, de exemplu sigla firmei), în stânga antetului, pe fiecare pagină. */
  headerImage?: string;
  /** Despărțirea automată în silabe la capăt de rând (Word: Aspect → Despărțire în silabe → Automat). */
  hyphenate?: boolean;
  /** Culoarea paginii („#fff2cc”), ca în Word (Proiectare → Culoare pagină); lipsă = albă. */
  background?: string;
  /** Proprietățile documentului (Word: Fișier → Informații): titlu, subiect, autor, cuvinte cheie. */
  props?: DocProps;
  /** Chenarul paginii (Word: Proiectare → Chenare pagină): linie, linie dublă sau groasă, pe fiecare pagină. */
  border?: PageBorder;
  /** Prima pagină diferită (Word: Antet și subsol → Prima pagină diferită): antetul, subsolul și numărul ei, de obicei goale (copertă). */
  firstPage?: FirstPage;
  /** Pagini pare și impare diferite (Word: Antet și subsol → Pagini pare și impare diferite): antetul și subsolul paginilor pare. */
  evenPage?: EvenPage;
  /** Unde stă numărul paginii (Word: Număr pagină → Partea de sus / de jos): lipsă = jos, în dreapta. */
  numAt?: NumAt;
  /** Cum se scrie numărul paginii: lipsă = „Pagina 1 din 3”. */
  numStyle?: NumStyle;
  /** Marcat ca final (Word: Fișier → Informații → Protejare document): se deschide doar pentru citire, până la „Editează oricum”. */
  final?: boolean;
  /** Urmărirea modificărilor e blocată (Word: Revizuire → Blocare urmărire): rămâne pornită, iar modificările nu se pot accepta / respinge până la deblocare. */
  trackLock?: boolean;
  /** Restricționarea editării (Word: Revizuire → Restricționare editare): doar citire sau doar comentarii, cu parolă opțională. */
  restrict?: Restrict;
  /** Vizualizare → Macrocomenzi: macrocomenzile păstrate în document (macros.ts). */
  macros?: DocMacro[];
}

/** Ce se mai poate face într-un document protejat: „read” = doar citire, „comments” = doar comentarii. Parola: doar hash-ul. */
export interface Restrict { mode: 'read' | 'comments'; pw?: SheetPw }
export function cleanRestrict(v: unknown): Restrict | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  if (o.mode !== 'read' && o.mode !== 'comments') return undefined;
  const pw = cleanSheetPw(o.pw);
  return { mode: o.mode, ...(pw ? { pw } : {}) };
}

export interface DocProps { title?: string; subject?: string; author?: string; keywords?: string; /** Clasificarea documentului (cât de confidențial e). */ label?: DocLabel }
/** Clasificarea (eticheta de confidențialitate): [id, nume, culoarea etichetei]. În .docx: proprietatea „Clasificare” din docProps/custom.xml. */
export type DocLabel = 'public' | 'general' | 'confidential' | 'strict';
export const DOC_LABELS: [DocLabel, string, string][] = [
  ['public', 'Public', '#2e7d32'],
  ['general', 'Uz general', '#1565c0'],
  ['confidential', 'Confidențial', '#e65100'],
  ['strict', 'Strict confidențial', '#b71c1c'],
];
/** docProps/custom.xml cu „Marcat ca final” (_MarkAsFinal) și / sau clasificarea (proprietatea „Clasificare”, cu numele etichetei). */
export const CUSTOM_PROPS_TYPE = 'application/vnd.openxmlformats-officedocument.custom-properties+xml';
export const CUSTOM_PROPS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties';
export function customPropsXml(final: boolean, label?: DocLabel): string {
  const name = label ? DOC_LABELS.find(([k]) => k === label)?.[1] : undefined;
  const FMT = 'fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}"';
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
    + (final ? `<property ${FMT} pid="2" name="_MarkAsFinal"><vt:bool>true</vt:bool></property>` : '')
    + (name ? `<property ${FMT} pid="${final ? 3 : 2}" name="Clasificare"><vt:lpwstr>${name}</vt:lpwstr></property>` : '')
    + '</Properties>';
}
/** Clasificarea scrisă în docProps/custom.xml (undefined dacă lipsește sau nu e una cunoscută). */
export function labelFromCustom(xml: string | null | undefined): DocLabel | undefined {
  return docLabel(/name="Clasificare"[^>]*>[ \t\r\n]*<vt:lpwstr>([^<]*)</.exec(xml ?? '')?.[1]);
}
/** Clasificarea după id sau după nume (cum e scrisă în .docx); undefined dacă nu e una cunoscută. */
export function docLabel(v: unknown): DocLabel | undefined {
  const s = String(v ?? '').trim().toLowerCase();
  return s ? DOC_LABELS.find(([k, n]) => k === s || n.toLowerCase() === s)?.[0] : undefined;
}
/** Marcajul clasificării pe pagină: numele etichetei în subsol și / sau ca filigran (cu majuscule). */
export interface LabelMark { footer: boolean; watermark: boolean }
const SEP = ' · ';
const labelNames = () => DOC_LABELS.map(([, n]) => n);
/** Ce marcaj al clasificării are acum pagina (subsolul e numele unei etichete sau se termină cu „ · <eticheta>”; filigranul e o etichetă). */
export function labelMarkOf(p: Pick<PageSetup, 'footer' | 'watermark'>): LabelMark {
  const f = p.footer ?? '', w = (p.watermark ?? '').trim();
  return {
    footer: labelNames().some((n) => f === n || f.endsWith(SEP + n)),
    watermark: labelNames().some((n) => w === n.toLocaleUpperCase('ro-RO')),
  };
}
/** Pagina cu marcajul clasificării pus sau scos: cel vechi (numele altei etichete) se înlocuiește, restul subsolului rămâne neatins. */
export function markLabel<T extends PageSetup>(p: T, label: DocLabel | undefined, mark: LabelMark): T {
  const name = label ? DOC_LABELS.find(([k]) => k === label)?.[1] : undefined;
  // Subsolul fără marcajul vechi.
  let base = p.footer ?? '';
  for (const n of labelNames()) { if (base === n) base = ''; else if (base.endsWith(SEP + n)) base = base.slice(0, -(SEP + n).length); }
  const footer = mark.footer && name ? (base.trim() ? base + SEP + name : name) : base;
  const out: T = { ...p, footer };
  const oldW = labelMarkOf(p).watermark;
  if (mark.watermark && name) out.watermark = name.toLocaleUpperCase('ro-RO');
  else if (oldW) delete out.watermark;
  return out;
}
export const DOC_PROPS: [Exclude<keyof DocProps, 'label'>, string][] = [['title', 'Titlu'], ['subject', 'Subiect'], ['author', 'Autor'], ['keywords', 'Cuvinte cheie']];

/** Proprietățile curățate (text de cel mult 200 de litere, fără câmpurile goale); undefined dacă nu e niciuna. */
export function docProps(p: { props?: unknown } | undefined): DocProps | undefined {
  const src = (p?.props && typeof p.props === 'object' ? p.props : {}) as Record<string, unknown>;
  const out: DocProps = {};
  for (const [k] of DOC_PROPS) { const v = String(src[k] ?? '').trim().slice(0, 200); if (v) out[k] = v; }
  const label = docLabel(src.label);
  if (label) out.label = label;
  return Object.keys(out).length ? out : undefined;
}

export const DEFAULT_MARGIN = 20;

/** Mărimile de hârtie (în mm, în picioare), ca în Word: Aspect → Dimensiune. */
export type Paper = 'A4' | 'A5' | 'A3' | 'Letter' | 'Legal' | 'DL' | 'C6' | 'C5' | 'C4';
export const PAPERS: [Paper, string, number, number][] = [
  ['A4', 'A4 (21 × 29,7 cm)', 210, 297], ['A5', 'A5 (14,8 × 21 cm)', 148, 210], ['A3', 'A3 (29,7 × 42 cm)', 297, 420],
  ['Letter', 'Letter (SUA, 21,6 × 27,9 cm)', 215.9, 279.4], ['Legal', 'Legal (SUA, 21,6 × 35,6 cm)', 215.9, 355.6],
  // Plicurile (Corespondență → Plicuri), puse de obicei culcat.
  ['DL', 'Plic DL (11 × 22 cm)', 110, 220], ['C6', 'Plic C6 (11,4 × 16,2 cm)', 114, 162], ['C5', 'Plic C5 (16,2 × 22,9 cm)', 162, 229], ['C4', 'Plic C4 (22,9 × 32,4 cm)', 229, 324],
];
export function pagePaper(p: PageSetup | undefined): Paper {
  return PAPERS.some(([k]) => k === p?.paper) ? p!.paper! : 'A4';
}
/** Lățimea și înălțimea hârtiei în mm, cu orientarea aplicată. */
export function paperSize(p: PageSetup | undefined): { w: number; h: number } {
  const [, , w, h] = PAPERS.find(([k]) => k === pagePaper(p))!;
  return p?.landscape ? { w: h, h: w } : { w, h };
}
/** Mărimea hârtiei dintr-un fișier (mm, în orice orientare); A4 dacă nu se potrivește cu niciuna (±3 mm). */
export function paperFrom(wmm: number, hmm: number): Paper {
  const a = Math.min(wmm, hmm), b = Math.max(wmm, hmm);
  return PAPERS.find(([, , w, h]) => Math.abs(w - a) <= 3 && Math.abs(h - b) <= 3)?.[0] ?? 'A4';
}
export interface Margins { top: number; bottom: number; left: number; right: number }
const SIDES = ['top', 'bottom', 'left', 'right'] as const;
const okMm = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 10) / 10 : null; };

/** Marginile pe fiecare latură (mm): cele particularizate, dacă sunt valide, altfel aceeași valoare peste tot. */
export function pageMargins(p: PageSetup | undefined): Margins {
  const m = p?.margins;
  if (m && typeof m === 'object' && SIDES.every((k) => okMm(m[k]) !== null)) {
    return { top: okMm(m.top)!, bottom: okMm(m.bottom)!, left: okMm(m.left)!, right: okMm(m.right)! };
  }
  const one = pageMargin(p);
  return { top: one, bottom: one, left: one, right: one };
}

/** Marginile citite dintr-un fișier: o singură valoare dacă sunt (aproape) egale, altfel pe fiecare latură. */
export function marginsFrom(m: Margins): { margin: number; margins?: Margins } {
  const v = SIDES.map((k) => okMm(m[k]) ?? DEFAULT_MARGIN);
  const fixed = { top: v[0], bottom: v[1], left: v[2], right: v[3] };
  const same = v.every((x) => Math.abs(x - v[0]) < 0.5);
  const one = Math.min(50, Math.max(5, Math.round(v[2])));
  return same && v[0] >= 5 && v[0] <= 50 ? { margin: Math.round(v[0]) } : { margin: one, margins: fixed };
}
export const MARGINS = [10, 15, 20, 25, 30];

export interface DocFile {
  format: 'suite-doc';
  version: 1;
  content: JSONContent;
  page?: PageSetup;
  updatedAt: string;
}

export interface FirstPage { header: string; footer: string; numbers: boolean }

/** Antetul / subsolul primei pagini, doar dacă e bifat „Prima pagină diferită”. */
export function pageFirst(p: PageSetup | undefined): FirstPage | undefined {
  const f = p?.firstPage as Partial<FirstPage> | undefined;
  if (!f || typeof f !== 'object') return undefined;
  return { header: String(f.header ?? '').slice(0, 200), footer: String(f.footer ?? '').slice(0, 200), numbers: f.numbers === true };
}

export interface EvenPage { header: string; footer: string }

export type NumAt = 'br' | 'bc' | 'bl' | 'tr' | 'tc' | 'tl';
export type NumStyle = 'full' | 'page' | 'num' | 'slash';
export const NUM_ATS: [NumAt, string][] = [['br', 'jos, în dreapta'], ['bc', 'jos, la mijloc'], ['bl', 'jos, în stânga'], ['tr', 'sus, în dreapta'], ['tc', 'sus, la mijloc'], ['tl', 'sus, în stânga']];
export const NUM_STYLES: [NumStyle, string][] = [['full', 'Pagina 1 din 3'], ['page', 'Pagina 1'], ['num', '1'], ['slash', '1 / 3']];
export const pageNumAt = (p: Pick<PageSetup, 'numAt'> | undefined): NumAt => (NUM_ATS.some(([k]) => k === p?.numAt) ? p!.numAt! : 'br');
export const pageNumStyle = (p: Pick<PageSetup, 'numStyle'> | undefined): NumStyle => (NUM_STYLES.some(([k]) => k === p?.numStyle) ? p!.numStyle! : 'full');
/** Bucățile numărului paginii: text, „P” = pagina curentă, „T” = câte pagini are documentul. */
export function numTokens(style: NumStyle): string[] {
  return { full: ['Pagina ', 'P', ' din ', 'T'], page: ['Pagina ', 'P'], num: ['P'], slash: ['P', ' / ', 'T'] }[style];
}
/** Un loc din antet / subsol (stânga, mijloc, dreapta): textul și dacă după el vine numărul paginii. */
export interface HfSlot { text: string; num: boolean }
/**
 * Cele trei locuri ale antetului (top) sau subsolului: textul antetului stă la mijloc, al subsolului în stânga, iar numărul
 * paginii în locul ales (dacă locul are deja text, numărul vine după el).
 * Un text cu Tab-uri se împarte ca în procesorul de text cunoscut: „stânga⇥mijloc⇥dreapta” (galeria Antet ▾ / Subsol ▾).
 */
export function hfSlots(text: string, top: boolean, numbers: boolean, at: NumAt): [HfSlot, HfSlot, HfSlot] {
  const slots: [HfSlot, HfSlot, HfSlot] = [{ text: '', num: false }, { text: '', num: false }, { text: '', num: false }];
  if (text.includes('\t')) {
    const parts = text.split('\t');
    // Mai mult de trei bucăți: tot ce e după a doua merge în dreapta.
    [parts[0], parts[1], parts.slice(2).join(' ')].forEach((p, i) => { slots[i].text = (p ?? '').trim(); });
  } else slots[top ? 1 : 0].text = text.trim();
  if (numbers && (at[0] === 't') === top) slots[{ l: 0, c: 1, r: 2 }[at[1] as 'l' | 'c' | 'r']].num = true;
  return slots;
}

/**
 * Galeria Antet ▾ / Subsol ▾ (modelele gata făcute din procesorul de text cunoscut): textul cu Tab-uri pune bucățile
 * în stânga, la mijloc și în dreapta, iar câmpurile se completează singure din document.
 */
export const HF_GALLERY: { header: [string, string][]; footer: [string, string][] } = {
  header: [
    ['Titlul la mijloc', '{titlu}'],
    ['Titlul în stânga, data în dreapta', '{titlu}\t\t{data}'],
    ['Trei locuri: fișier, titlu, dată', '{fisier}\t{titlu}\t{data}'],
    ['Autorul în stânga, titlul în dreapta', '{autor}\t\t{titlu}'],
  ],
  footer: [
    ['Numele fișierului în stânga', '{fisier}'],
    ['Autorul în stânga, data în dreapta', '{autor}\t\t{data}'],
    ['„Confidențial” la mijloc', '\tConfidențial'],
    ['Trei locuri: autor, titlu, dată', '{autor}\t{titlu}\t{data}'],
  ],
};

/** Câmpurile care se pot scrie în antet / subsol: se înlocuiesc la afișare, tipărire și export. */
export const HF_FIELDS: [string, string][] = [['{data}', 'data de azi'], ['{fisier}', 'numele fișierului'], ['{autor}', 'autorul (din ⓘ Proprietăți)'], ['{titlu}', 'titlul (din ⓘ Proprietăți)']];

/** Textul antetului cu câmpurile înlocuite; un câmp fără valoare (de exemplu fără autor) dispare cu tot cu „ · ” de lângă el. */
export function expandHf(text: string, ctx: { date: string; file: string; author?: string; title?: string }): string {
  if (!text.includes('{')) return text;
  // Fiecare loc (stânga / mijloc / dreapta) separat, ca Tab-urile dintre ele să rămână.
  if (text.includes('\t')) return text.split('\t').map((t) => expandHf(t, ctx)).join('\t');
  const vals: Record<string, string> = { data: ctx.date, fisier: ctx.file, autor: ctx.author ?? '', titlu: ctx.title || ctx.file.replace(/[.][^.]+$/, '') };
  return text.replace(/[{](data|fisier|autor|titlu)[}]/g, (_m, k: string) => vals[k] ?? '')
    .replace(/([ ]*·[ ]*){2,}/g, ' · ').replace(/^[ ]*·[ ]*|[ ]*·[ ]*$/g, '').trim();
}

/** Setarea paginii cu câmpurile din antete și subsoluri înlocuite (pentru ecran, tipărire, PDF, .docx și .odt). */
export function withHfFields<T extends PageSetup & { sections?: { header: string; footer: string }[] }>(p: T, file: string, date = new Date()): T {
  const props = docProps(p);
  const ctx = { date: `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`, file, author: props?.author, title: props?.title };
  const all = [p.header, p.footer, p.firstPage?.header, p.firstPage?.footer, p.evenPage?.header, p.evenPage?.footer, ...(p.sections ?? []).flatMap((x) => [x.header, x.footer])];
  if (!all.some((t) => t?.includes('{'))) return p;
  const x = (t: string) => expandHf(t, ctx);
  return {
    ...p, header: x(p.header), footer: x(p.footer),
    ...(p.firstPage ? { firstPage: { ...p.firstPage, header: x(p.firstPage.header), footer: x(p.firstPage.footer) } } : {}),
    ...(p.evenPage ? { evenPage: { ...p.evenPage, header: x(p.evenPage.header), footer: x(p.evenPage.footer) } } : {}),
    ...(p.sections ? { sections: p.sections.map((h) => ({ header: x(h.header), footer: x(h.footer) })) } : {}),
  };
}

/** Antetul / subsolul paginilor pare, doar dacă e bifat „Pagini pare diferite” (numărul paginii e ca pe celelalte). */
export function pageEven(p: PageSetup | undefined): EvenPage | undefined {
  const f = p?.evenPage as Partial<EvenPage> | undefined;
  if (!f || typeof f !== 'object') return undefined;
  return { header: String(f.header ?? '').slice(0, 200), footer: String(f.footer ?? '').slice(0, 200) };
}

export const NO_PAGE_SETUP: PageSetup = { header: '', footer: '', numbers: false, landscape: false, margin: DEFAULT_MARGIN };

export function hasPageSetup(p: PageSetup | undefined): p is PageSetup {
  return !!p && (!!p.header.trim() || !!p.footer.trim() || p.numbers || !!pageFirst(p) || !!pageEven(p) || !!pageHeaderImage(p));
}

/** Pagina are orientarea sau marginile schimbate față de A4 vertical cu 2 cm. */
export function hasLayout(p: PageSetup | undefined): boolean {
  const m = pageMargins(p);
  return !!p && (!!p.landscape || pagePaper(p) !== 'A4' || SIDES.some((k) => m[k] !== DEFAULT_MARGIN) || pageColumns(p) > 1 || !!lineNums(p) || !!pageWatermark(p) || !!pageWatermarkImage(p) || !!pageBackground(p) || !!pageBorder(p));
}

export type PageBorder = 'single' | 'double' | 'thick';
export const PAGE_BORDERS: [PageBorder | '', string][] = [['', 'Fără'], ['single', 'Linie'], ['double', 'Linie dublă'], ['thick', 'Linie groasă']];
/** Chenarul paginii, doar dacă e unul cunoscut. */
export function pageBorder(p: PageSetup | undefined): PageBorder | '' {
  const b = String(p?.border ?? '');
  return b === 'single' || b === 'double' || b === 'thick' ? b : '';
}

/** Culoarea paginii, doar dacă e o culoare #rrggbb validă și nu e albă. */
export function pageBackground(p: PageSetup | undefined): string {
  const c = String(p?.background ?? '').toLowerCase();
  return /^#[0-9a-f]{6}$/.test(c) && c !== '#ffffff' ? c : '';
}

/** Culorile de pagină propuse în fereastra Pagină (deschise, ca textul să se citească). */
export const PAGE_COLORS: [string, string][] = [
  ['', 'Albă'], ['#fff8e7', 'Crem'], ['#fff2cc', 'Galben deschis'], ['#deebf7', 'Albastru deschis'],
  ['#e2f0d9', 'Verde deschis'], ['#fce4ec', 'Roz deschis'], ['#f2f2f2', 'Gri deschis'],
];

export function pageWatermark(p: PageSetup | undefined): string {
  return String(p?.watermark ?? '').trim().slice(0, 40);
}

/** Cea mai mare imagine de filigran primită (în octeți, după codare): fișierul nu crește mult din cauza ei. */
export const WATERMARK_IMAGE_MAX = 3 * 1024 * 1024;

/** Imaginea filigranului, doar PNG sau JPEG ca data: URL, nu mai mare de WATERMARK_IMAGE_MAX; altfel „”. */
export function pageWatermarkImage(p: PageSetup | undefined): string {
  const s = String(p?.watermarkImage ?? '');
  return s.length <= WATERMARK_IMAGE_MAX && /^data:image[/](png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(s) ? s : '';
}

/** Imaginea din antet, cu aceleași reguli ca filigranul din imagine (PNG / JPEG, cel mult WATERMARK_IMAGE_MAX); altfel „”. */
export function pageHeaderImage(p: PageSetup | undefined): string {
  return pageWatermarkImage({ watermarkImage: p?.headerImage } as PageSetup);
}
/** Înălțimea imaginii din antet pe pagină, în pixeli (aprox. 1 cm); lățimea urmează proporțiile, cel mult HEADER_IMAGE_MAX_W. */
export const HEADER_IMAGE_H = 38, HEADER_IMAGE_MAX_W = 240;

/** Culorile de filigran din fereastra Pagină (pe pagină apar foarte deschise). */
export const WATERMARK_COLORS: [string, string][] = [['', 'Gri'], ['#c62828', 'Roșu'], ['#1565c0', 'Albastru'], ['#2e7d32', 'Verde'], ['#ef6c00', 'Portocaliu']];

/** Culoarea filigranului, doar dintre cele știute (altfel gri, adică ''). */
export function pageWatermarkColor(p: PageSetup | undefined): string {
  const c = String(p?.watermarkColor ?? '').toLowerCase();
  return WATERMARK_COLORS.some(([x]) => x && x === c) ? c : '';
}

/** Fonturile de filigran din fereastra Pagină; primul (gol) e fontul implicit. */
export const WATERMARK_FONTS: [string, string][] = [['', 'Font implicit'], ['Arial', 'Arial'], ['Times New Roman', 'Times New Roman'], ['Georgia', 'Georgia'], ['Verdana', 'Verdana'], ['Courier New', 'Courier New']];

/** Fontul filigranului, doar dintre cele știute (altfel cel implicit, adică ''). */
export function pageWatermarkFont(p: PageSetup | undefined): string {
  const f = String(p?.watermarkFont ?? '').trim().toLowerCase();
  return WATERMARK_FONTS.find(([x]) => x && x.toLowerCase() === f)?.[0] ?? '';
}

/** Filigranele propuse în fereastra Pagină. */
export const WATERMARKS = ['CIORNĂ', 'CONFIDENȚIAL', 'COPIE', 'NU COPIAȚI', 'MODEL'];

export interface LineNums { page?: boolean; by?: number }
export const LINE_NUM_STEPS = [1, 2, 5, 10];
/** Numerotarea rândurilor, curățată (pas doar 1 / 2 / 5 / 10); undefined = fără numere. */
export function lineNums(p: PageSetup | undefined): LineNums | undefined {
  const l = p?.lineNums as LineNums | undefined;
  if (!l || typeof l !== 'object') return undefined;
  const by = Number(l.by);
  return { ...(l.page === true ? { page: true } : {}), ...(LINE_NUM_STEPS.includes(by) && by !== 1 ? { by } : {}) };
}

export function pageColumns(p: PageSetup | undefined): number {
  const n = Number(p?.columns);
  return n === 2 || n === 3 ? n : 1;
}

/** Linia dintre coloane: doar când textul e pe 2–3 coloane. */
export function pageColLine(p: PageSetup | undefined): boolean {
  return pageColumns(p) > 1 && p?.colLine === true;
}

export function pageMargin(p: PageSetup | undefined): number {
  const m = Number(p?.margin);
  return Number.isFinite(m) && m >= 5 && m <= 50 ? m : DEFAULT_MARGIN;
}

export function emptyDoc(): DocFile {
  return { format: 'suite-doc', version: 1, content: { type: 'doc', content: [{ type: 'paragraph' }] }, updatedAt: new Date().toISOString() };
}

export function parseDoc(text: string): DocFile {
  const data = JSON.parse(text);
  if (data?.format !== 'suite-doc' || data?.content?.type !== 'doc') throw new Error('Fișierul nu este un document Cyber Office Studio.');
  const p = data.page;
  const page: PageSetup | undefined = p && typeof p === 'object'
    ? { header: String(p.header ?? '').slice(0, 200), footer: String(p.footer ?? '').slice(0, 200), numbers: p.numbers === true, landscape: p.landscape === true, margin: pageMargin(p), ...(pageColumns(p) > 1 ? { columns: pageColumns(p) } : {}), ...(pageColLine(p) ? { colLine: true } : {}), ...(lineNums(p) ? { lineNums: lineNums(p) } : {}), ...(pagePaper(p) !== 'A4' ? { paper: pagePaper(p) } : {}),
      ...(p.margins ? { margins: pageMargins(p) } : {}), ...(pageWatermark(p) ? { watermark: pageWatermark(p), ...(pageWatermarkColor(p) ? { watermarkColor: pageWatermarkColor(p) } : {}), ...(p.watermarkFlat === true ? { watermarkFlat: true } : {}), ...(pageWatermarkFont(p) ? { watermarkFont: pageWatermarkFont(p) } : {}) } : {}), ...(pageWatermarkImage(p) ? { watermarkImage: pageWatermarkImage(p) } : {}), ...(pageHeaderImage(p) ? { headerImage: pageHeaderImage(p) } : {}), ...(p.hyphenate === true ? { hyphenate: true } : {}), ...(pageBackground(p) ? { background: pageBackground(p) } : {}), ...(pageBorder(p) ? { border: pageBorder(p) as PageBorder } : {}), ...(docProps(p) ? { props: docProps(p) } : {}), ...(pageFirst(p) ? { firstPage: pageFirst(p) } : {}), ...(pageEven(p) ? { evenPage: pageEven(p) } : {}), ...(pageNumAt(p) !== 'br' ? { numAt: pageNumAt(p) } : {}), ...(pageNumStyle(p) !== 'full' ? { numStyle: pageNumStyle(p) } : {}), ...(p.final === true ? { final: true } : {}), ...(p.trackLock === true ? { trackLock: true } : {}), ...(cleanRestrict(p.restrict) ? { restrict: cleanRestrict(p.restrict) } : {}), ...(cleanStyles(p.styles) ? { styles: cleanStyles(p.styles) } : {}), ...(cleanDocMacros(p.macros).length ? { macros: cleanDocMacros(p.macros) } : {}) }
    : undefined;
  return { ...emptyDoc(), content: data.content, page, updatedAt: String(data.updatedAt ?? '') };
}

export function serializeDoc(content: JSONContent, page?: PageSetup): string {
  const doc: DocFile = { format: 'suite-doc', version: 1, content, updatedAt: new Date().toISOString() };
  const final = page?.final === true || page?.trackLock === true || !!page?.restrict;
  const styled = !!cleanStyles(page?.styles) || page?.hyphenate === true;
  if (final || styled || !!page?.macros?.length || hasPageSetup(page) || hasLayout(page) || docProps(page)) doc.page = page;
  return JSON.stringify(doc);
}
