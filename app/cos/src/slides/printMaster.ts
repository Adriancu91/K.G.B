// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Coordonatorii paginilor tipărite (Handout Master și Notes Master din PowerPoint): ce scrie în colțurile fiecărei pagini
// de pliante și de notițe: antetul (stânga sus), data (dreapta sus), subsolul (stânga jos) și numărul paginii (dreapta jos).
// Coordonatorul de pliante ține minte și câte slide-uri intră pe o pagină; cel de notițe poate ascunde poza slide-ului sau notițele.
import { HANDOUTS, type Handout } from './handout';

export interface PrintMaster {
  header?: string;
  footer?: string;
  /** Data de azi în dreapta sus. */
  date?: boolean;
  /** Numărul paginii în dreapta jos; lipsă = da. */
  noNum?: boolean;
}
export interface HandoutMaster extends PrintMaster {
  /** Câte slide-uri pe o pagină (Slide-uri pe pagină); lipsă = 3. */
  per?: Handout;
}
export interface NotesMaster extends PrintMaster {
  /** Fără poza slide-ului pe pagină (Imagine diapozitiv debifat). */
  noImage?: boolean;
  /** Fără notițe pe pagină (Corp debifat). */
  noBody?: boolean;
}

export interface Corners { tl?: string; tr?: string; bl?: string; br?: string }

/** Ce scrie în cele patru colțuri ale paginii `page` (de la 1). `today` = data de pus când e bifată. */
export function pageCorners(m: PrintMaster | undefined, page: number, today: string): Corners {
  const c: Corners = {};
  if (m?.header?.trim()) c.tl = m.header.trim();
  if (m?.date) c.tr = today;
  if (m?.footer?.trim()) c.bl = m.footer.trim();
  if (!m?.noNum) c.br = String(page);
  return c;
}

const txt = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? v.slice(0, n) : undefined);

function cleanBase(v: Record<string, unknown>): PrintMaster {
  const header = txt(v.header, 200), footer = txt(v.footer, 200);
  return { ...(header ? { header } : {}), ...(footer ? { footer } : {}), ...(v.date === true ? { date: true } : {}), ...(v.noNum === true ? { noNum: true } : {}) };
}

/** Coordonatorul de pliante curățat; undefined dacă e cel implicit (nimic de ținut minte). */
export function cleanHandoutMaster(v: unknown): HandoutMaster | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const per = HANDOUTS.includes(o.per as Handout) && o.per !== 3 ? (o.per as Handout) : undefined;
  const m: HandoutMaster = { ...cleanBase(o), ...(per ? { per } : {}) };
  return Object.keys(m).length ? m : undefined;
}

/** Coordonatorul de notițe curățat; undefined dacă e cel implicit. */
export function cleanNotesMaster(v: unknown): NotesMaster | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  const m: NotesMaster = { ...cleanBase(o), ...(o.noImage === true ? { noImage: true } : {}), ...(o.noBody === true ? { noBody: true } : {}) };
  return Object.keys(m).length ? m : undefined;
}

/** Câte slide-uri pe pagină la pliante, după coordonator. */
export const handoutPer = (m: HandoutMaster | undefined): Handout => m?.per ?? 3;
