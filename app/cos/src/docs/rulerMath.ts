// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Calculele riglei din Docs (fără desen): unde stau retragerile paragrafului și cum se rotunjesc pozițiile trase cu mouse-ul.
// Pozițiile sunt în cm, de la marginea din stânga a textului (ca pe rigla procesoarelor de text: 0 = marginea).
import { INDENT_CM, MAX_FIRST, MAX_INDENT, MAX_RIGHT } from './paragraphFormat';
import { MAX_TAB_CM, TabAlign, TabStop } from './tabStops';

/** Pasul la care se oprește un marcaj tras pe riglă. */
export const RULER_STEP = 0.25;

export const snapCm = (cm: number) => Math.round(cm / RULER_STEP) * RULER_STEP;

/** Unde încep rândurile paragrafului (retragerea la stânga) și unde începe primul rând. */
export function indentMarks(indent: unknown, firstLine: unknown): { body: number; first: number } {
  const ind = Math.max(0, Math.min(MAX_INDENT, Number(indent) || 0)) * INDENT_CM;
  const fl = Number(firstLine) || 0;
  // Agățat (negativ): primul rând stă la retragere, restul mai la dreapta; retras (pozitiv): primul rând mai la dreapta.
  const body = ind + (fl < 0 ? -fl : 0);
  return { body, first: body + fl };
}

/** Prima linie (cm, ca atributul firstLine) când marcajul primului rând e tras la `first`, iar restul rândurilor rămân la `body`. */
export function firstLineFor(first: number, body: number): number | null {
  const v = Math.max(-MAX_FIRST, Math.min(MAX_FIRST, snapCm(first - body)));
  return Math.abs(v) < 0.01 ? null : Math.round(v * 100) / 100;
}

/**
 * Retragerea (atributul `indent`, în trepte de 1,25 cm, poate fi fracționar) când marcajul de jos e tras la `cm` (rotunjit la 0,25 cm):
 * primul rând se mută odată cu restul, ca pe riglă. Întoarce retragerea nouă și prima linie păstrată.
 */
export function indentFor(cm: number, firstLine: unknown): { indent: number; firstLine: number | null } {
  const fl = Number(firstLine) || 0;
  const left = Math.max(0, snapCm(cm) - (fl < 0 ? -fl : 0));
  const ind = Math.min(MAX_INDENT, Math.round((left / INDENT_CM) * 10000) / 10000);
  return { indent: ind, firstLine: fl || null };
}

/** Retragerea la dreapta (cm) când marcajul din dreapta e tras la `cm`, pe un rând de text lat de `width` cm. */
export function rightFor(cm: number, width: number): number | null {
  const v = Math.max(0, Math.min(MAX_RIGHT, snapCm(width - cm)));
  return v < 0.01 ? null : Math.round(v * 100) / 100;
}

/** Oprirea mutată la `cm` (sau scoasă cu null), restul rămân; o oprire nouă de tipul `align` cu `add`. */
export function moveStop(stops: TabStop[], from: number | null, cm: number | null, align: TabAlign = 'l'): TabStop[] {
  const old = from === null ? undefined : stops.find((t) => Math.abs(t.pos - from) < 0.01);
  const rest = stops.filter((t) => t !== old);
  if (cm === null) return rest;
  const pos = Math.round(snapCm(cm) * 100) / 100;
  if (!(pos > 0 && pos <= MAX_TAB_CM)) return rest;
  return [...rest.filter((t) => Math.abs(t.pos - pos) >= 0.01), { pos, align: old?.align ?? align, leader: old?.leader ?? '' }].sort((a, b) => a.pos - b.pos);
}

/** Semnul de pe riglă al fiecărui fel de oprire (ca pe riglele obișnuite: └ ┴ ┘ ┴·). */
export const TAB_GLYPH: Record<TabAlign, string> = { l: '└', c: '┴', r: '┘', d: '╨' };
export const TAB_ORDER: TabAlign[] = ['l', 'c', 'r', 'd'];
