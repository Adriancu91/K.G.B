// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Paragrafele unei pagini PDF, pentru „Editează text”: bucățile de text (pdf.js) de pe aceeași linie de bază se adună în rânduri,
// iar rândurile așezate unul sub altul, cu aceeași margine din stânga, aceeași mărime și același pas între ele, în paragrafe.
// Primul rând poate fi retras (alineat). Un rând scurt terminat cu punct, urmat de unul lung, încheie paragraful.
// Se recunosc și paragrafele aliniate la dreapta, la centru sau stânga-dreapta (`align`).
// Merge doar pe textul orizontal (`flat`); restul rămâne pe rânduri, ca înainte.
import type { TextBlock } from './TextEdit';

/** Un rând: bucățile lui (de la stânga la dreapta), dreptunghiul și textul lor. */
interface Line { blocks: TextBlock[]; x: number; y: number; w: number; h: number; size: number; str: string; base: number }

const lineOf = (blocks: TextBlock[]): Line => {
  const bs = [...blocks].sort((a, b) => a.x - b.x);
  // Lățimea și locul rândului după cuvinte (spațiile de la capete nu contează).
  const ink = bs.filter((b) => !b.ws);
  const x = Math.min(...ink.map((b) => b.x)), y = Math.min(...ink.map((b) => b.y));
  const r = Math.max(...ink.map((b) => b.x + b.w)), bot = Math.max(...ink.map((b) => b.y + b.h));
  let str = '';
  bs.forEach((b, k) => {
    // Între bucăți depărtate se pune un spațiu, dacă nu e deja unul.
    if (k && b.x - (bs[k - 1].x + bs[k - 1].w) > b.size * 0.15 && !/\s$/.test(str) && !/^\s/.test(b.str)) str += ' ';
    str += b.str;
  });
  return { blocks: bs, x, y, w: r - x, h: bot - y, size: ink[0].size, str: str.replace(/\s+/g, ' ').trim(), base: bot };
};

/** Rândurile paginii: bucățile cu aceeași linie de bază, apropiate pe orizontală. */
function linesOf(blocks: TextBlock[]): Line[] {
  const flat = blocks.filter((b) => b.flat).sort((a, b) => a.y + a.h - (b.y + b.h) || a.x - b.x);
  const groups: TextBlock[][] = [];
  for (const b of flat) {
    const g = groups.find((g) => {
      const last = g[g.length - 1];
      return Math.abs(last.y + last.h - (b.y + b.h)) < Math.min(last.size, b.size) * 0.3 && b.x - (last.x + last.w) < Math.max(last.size, b.size) * 1.2 && b.x + b.w > last.x;
    });
    if (g) g.push(b); else groups.push([b]);
  }
  return groups.filter((g) => g.some((b) => !b.ws)).map(lineOf);
}

/** Paragraful format din rândurile date: un bloc cu tot textul, dreptunghiul lor și bucățile (`lines`), pasul rândurilor în `lead`. */
function paraBlock(ls: Line[]): TextBlock {
  const x = Math.min(...ls.map((l) => l.x)), y = Math.min(...ls.map((l) => l.y));
  const r = Math.max(...ls.map((l) => l.x + l.w)), bot = Math.max(...ls.map((l) => l.y + l.h));
  let str = '';
  for (const l of ls) {
    // Cuvântul despărțit la capăt de rând („docu-” + „mentul”) se lipește la loc.
    if (str.endsWith('-') && /^\p{Ll}/u.test(l.str) && /\p{L}-$/u.test(str)) str = str.slice(0, -1) + l.str;
    else str += (str ? ' ' : '') + l.str;
  }
  const b0 = ls[0].blocks.find((b) => !b.ws)!;
  return {
    i: b0.i, str, x, y, w: r - x, h: bot - y, size: ls[0].size, ...(b0.bold ? { bold: true } : {}), ...(b0.italic ? { italic: true } : {}),
    flat: true, lines: ls.flatMap((l) => l.blocks), lead: (ls[ls.length - 1].base - ls[0].base) / (ls.length - 1),
  };
}

/** Alinierea unui paragraf: după marginea stângă (cu alineat), cea dreaptă sau mijlocul rândurilor. */
type Mode = 'left' | 'right' | 'center';

/**
 * Paragrafele cu cel puțin două rânduri, ca blocuri de editat (cu `lines` = bucățile lor de text, în ordine, și `align`).
 * Rândurile care nu fac parte dintr-un paragraf lipsesc din listă (se editează ca până acum, pe rând).
 * Alinierea: rândurile cu aceeași margine stângă sunt la stânga sau, de la trei rânduri, stânga-dreapta când și marginea
 * dreaptă e aceeași la toate în afară de ultimul; altfel la dreapta (aceeași margine dreaptă) sau la centru (același mijloc).
 */
export function paragraphsOf(blocks: TextBlock[]): TextBlock[] {
  const lines = linesOf(blocks).sort((a, b) => a.base - b.base || a.x - b.x);
  const paras: { ls: Line[]; mode?: Mode }[] = [];
  const right = (l: Line) => l.x + l.w, mid = (l: Line) => l.x + l.w / 2;
  for (const l of lines) {
    let best: { ls: Line[]; mode?: Mode } | null = null, bestGap = Infinity, bestMode: Mode = 'left';
    for (const p of paras) {
      const prev = p.ls[p.ls.length - 1];
      const gap = l.base - prev.base;
      const size = Math.max(prev.size, l.size);
      if (Math.abs(prev.size - l.size) > size * 0.15) continue;
      if (gap < size * 0.9 || gap > size * 1.8) continue;
      // Același pas ca între rândurile de până acum.
      if (p.ls.length > 1 && Math.abs(gap - (prev.base - p.ls[p.ls.length - 2].base)) > size * 0.25) continue;
      // Rândurile trebuie să se suprapună pe orizontală (nu două coloane alăturate).
      if (l.x > right(prev) || prev.x > right(l)) continue;
      // Aceeași margine din stânga (primul rând poate fi retras cu până la 4 litere mari), dreapta sau același mijloc.
      const dx = prev.x - l.x;
      const left = p.ls.length > 1 ? Math.abs(p.ls[1].x - l.x) < size * 0.4 : Math.abs(dx) < size * 0.4 || (dx > 0 && dx < size * 4);
      const modes: Mode[] = [];
      if (left) modes.push('left');
      if (Math.abs(right(prev) - right(l)) < size * 0.4) modes.push('right');
      if (Math.abs(mid(prev) - mid(l)) < size * 0.4) modes.push('center');
      const mode = p.mode ? (modes.includes(p.mode) ? p.mode : null) : modes[0] ?? null;
      if (!mode) continue;
      // Un rând scurt terminat cu punct, după care vine unul lung: acolo se încheie paragraful (la stânga).
      if (mode === 'left' && /[.:!?]$/.test(prev.str) && prev.w < l.w * 0.6) continue;
      if (gap < bestGap) { best = p; bestGap = gap; bestMode = mode; }
    }
    if (best) { best.ls.push(l); best.mode ??= bestMode; } else paras.push({ ls: [l] });
  }
  return paras.filter((p) => p.ls.length > 1).map((p) => {
    const b = paraBlock(p.ls);
    const ls = p.ls, size = ls[0].size;
    let align: TextBlock['align'] = p.mode === 'left' ? undefined : p.mode;
    if (p.mode === 'left' && ls.length > 2) {
      const rs = ls.slice(0, -1).map(right);
      if (Math.max(...rs) - Math.min(...rs) < size * 0.2 && right(ls[ls.length - 1]) < Math.min(...rs) - size * 0.4) align = 'justify';
    }
    return align ? { ...b, align } : b;
  });
}

/** Paragraful din care face parte bucata `b` (după indicele ei la pdf.js), dacă are. */
export const paragraphAt = (paras: TextBlock[], b: TextBlock): TextBlock | null => paras.find((p) => p.lines?.some((x) => x.i === b.i)) ?? null;

/**
 * Textul așezat pe rânduri: cuvintele intră pe rând cât încap în lățimea lui (`width(k)` = lățimea rândului k, în puncte;
 * `measure` = lățimea unui text). Un cuvânt mai lat decât rândul stă singur pe rând. „\n” începe un paragraf nou.
 */
export function wrapLines(text: string, width: (k: number) => number, measure: (s: string) => number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let cur = '';
    for (const w of para.split(/\s+/).filter(Boolean)) {
      const next = cur ? cur + ' ' + w : w;
      if (cur && measure(next) > width(out.length) + 0.01) { out.push(cur); cur = w; } else cur = next;
    }
    out.push(cur);
  }
  return out;
}
