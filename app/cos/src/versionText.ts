// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Compararea unei versiuni vechi cu varianta de acum: din fișier (JSON-ul oricărui modul) se scot rândurile de text,
// apoi se arată ce s-a scos și ce s-a adăugat (ca „Compară documente” din Word, dar pentru toate aplicațiile).

/** Câmpurile care țin text scris de om (Docs, Notițe, Slides); restul (culori, poziții, poze) nu contează la comparare. */
const TEXT_KEYS = new Set(['text', 'title', 'body', 'notes', 'name']);

/** Rândurile de text dintr-un fișier Suite (orice modul), în ordinea din fișier. */
export function textLines(content: string): string[] {
  let data: unknown;
  try { data = JSON.parse(content); } catch { return content.split(/\r?\n/); }
  const out: string[] = [];
  const push = (s: string) => { for (const l of s.split(/\r?\n/)) if (l.trim()) out.push(l.trim()); };
  // Docs (ProseMirror): textul unui paragraf sau titlu se adună într-un singur rând.
  const inline = (n: Record<string, unknown>): string =>
    typeof n.text === 'string' ? n.text : Array.isArray(n.content) ? n.content.map((c) => (c && typeof c === 'object' ? inline(c as Record<string, unknown>) : '')).join('') : '';
  const walk = (v: unknown, depth: number): void => {
    if (depth > 40 || v === null || typeof v !== 'object') return;
    if (Array.isArray(v)) { for (const x of v) walk(x, depth + 1); return; }
    const o = v as Record<string, unknown>;
    if (typeof o.type === 'string' && Array.isArray(o.content) && o.content.some((c) => c && typeof (c as { text?: unknown }).text === 'string')) {
      push(inline(o));
      return;
    }
    // Sheets: celulele unei foi, rând cu rând („A1: Total”).
    if (o.cells && typeof o.cells === 'object' && !Array.isArray(o.cells)) {
      const sheet = typeof o.name === 'string' ? o.name : '';
      const ids = Object.keys(o.cells as object).filter((id) => /^[A-Z]+\d+$/.test(id));
      const pos = (id: string) => { const m = /^([A-Z]+)(\d+)$/.exec(id)!; return Number(m[2]) * 1000 + [...m[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0); };
      for (const id of ids.sort((a, b) => pos(a) - pos(b))) {
        const val = (o.cells as Record<string, unknown>)[id];
        if (typeof val === 'string' && val.trim()) out.push(`${sheet ? sheet + ' › ' : ''}${id}: ${val.trim()}`);
      }
      return;
    }
    for (const [k, val] of Object.entries(o)) {
      if (typeof val === 'string') {
        if (TEXT_KEYS.has(k) && !val.startsWith('data:') && val.length < 20000) push(val);
      } else walk(val, depth + 1);
    }
  };
  walk(data, 0);
  return out;
}

/** Un rezumat scurt (4 litere) al unui text lung: se schimbă când se schimbă poza sau formatarea. */
function shortHash(v: string): string {
  let h = 2166136261;
  for (let i = 0; i < v.length; i++) { h ^= v.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 4);
}
// Cuvintele rândurilor de comparare, în limba interfeței (rândurile se fac aici, nu se traduc pe ecran).
const WORDS = {
  ro: { title: 'Titlu', subtitle: 'Subtitlu', body: 'Text', text: 'Casetă de text', image: 'Poză', shape: 'Formă', table: 'Tabel', chart: 'Grafic', media: 'Clip', box: 'Casetă',
    slide: 'Slide', untitled: 'Slide fără titlu', at: 'la', hidden: 'ascuns în prezentare', adv: 'trece singur după', rot: 'rotită', color: 'culoare', pic: 'poză', file: 'fișier', look: 'formatare', notes: 'Notițe' },
  en: { title: 'Title', subtitle: 'Subtitle', body: 'Text', text: 'Text box', image: 'Picture', shape: 'Shape', table: 'Table', chart: 'Chart', media: 'Clip', box: 'Box',
    slide: 'Slide', untitled: 'Untitled slide', at: 'at', hidden: 'hidden in the slide show', adv: 'advances by itself after', rot: 'rotated', color: 'color', pic: 'picture', file: 'file', look: 'formatting', notes: 'Notes' },
};
type Words = typeof WORDS.ro;
const KINDS = ['title', 'subtitle', 'body', 'text', 'image', 'shape', 'table', 'chart', 'media'] as const;

/** Rândurile pentru „Compară”: la prezentări, slide cu slide, cu locul și aspectul casetelor (vezi slideLines); altfel ca textLines. */
export function compareLines(content: string, en = false): string[] {
  let data: unknown;
  try { data = JSON.parse(content); } catch { return textLines(content); }
  return data && typeof data === 'object' && (data as { format?: unknown }).format === 'suite-slides'
    ? slideLines(data as Record<string, unknown>, en ? WORDS.en : WORDS.ro) : textLines(content);
}
// Câmpurile care nu țin de aspectul casetei (sau care se arată separat).
const NOT_LOOK = new Set(['id', 'kind', 'x', 'y', 'w', 'h', 'text', 'src', 'rot', 'fill', 'poster', 'cells', 'alt']);

/**
 * Prezentările, slide cu slide: titlul slide-ului ca reper, apoi pentru fiecare casetă textul ei și un rând cu locul, mărimea,
 * rotirea, culoarea și (prin câte un rezumat scurt) poza și restul formatării; plus notițele, slide-ul ascuns și avansul automat.
 * Așa „Compară” arată și casetele mutate, mărite, recolorate sau cu altă poză, nu doar textul schimbat.
 */
function slideLines(deck: Record<string, unknown>, W: Words): string[] {
  const out: string[] = [];
  const lines = (v: unknown) => (typeof v === 'string' ? v.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) : []);
  const slides = Array.isArray(deck.slides) ? deck.slides as Record<string, unknown>[] : [];
  for (const sl of slides) {
    if (!sl || typeof sl !== 'object') continue;
    const els = Array.isArray(sl.els) ? sl.els as Record<string, unknown>[] : [];
    const title = lines(els.find((e) => e?.kind === 'title')?.text)[0];
    out.push(title ? `▣ ${W.slide} „${title.slice(0, 60)}”` : '▣ ' + W.untitled);
    if (sl.hidden === true) out.push('  ' + W.hidden);
    if (typeof sl.advance === 'number' && sl.advance > 0) out.push(`  ${W.adv} ${sl.advance} s`);
    for (const e of els) {
      if (!e || typeof e !== 'object') continue;
      for (const l of lines(e.text)) if (!(typeof e.text === 'string' && e.text.startsWith('data:'))) out.push(l);
      if (Array.isArray(e.cells)) for (const row of e.cells) if (Array.isArray(row)) { const t = row.map((c) => (typeof c === 'string' ? c.trim() : '')).join(' | '); if (t.replace(/[ |]/g, '')) out.push(t); }
      const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0);
      const kind = KINDS.find((k) => k === e.kind);
      const parts = [`  ◦ ${kind ? W[kind] : W.box} ${W.at} ${num(e.x)}, ${num(e.y)} · ${num(e.w)}×${num(e.h)}`];
      if (num(e.rot)) parts.push(`${W.rot} ${num(e.rot)}°`);
      if (typeof e.fill === 'string') parts.push(`${W.color} ${e.fill}`);
      if (typeof e.src === 'string') parts.push(`${e.kind === 'media' ? W.file : W.pic} ${shortHash(e.src)}`);
      const look = Object.keys(e).filter((k) => !NOT_LOOK.has(k)).sort().map((k) => k + '=' + JSON.stringify(e[k])).join(';');
      if (look) parts.push(`${W.look} ${shortHash(look)}`);
      out.push(parts.join(' · '));
    }
    for (const l of lines(sl.notes)) out.push(`  ${W.notes}: ${l}`);
  }
  return out;
}

export type DiffLine = { kind: 'same' | 'old' | 'new'; text: string };

/**
 * Diferența pe rânduri (cea mai lungă subsecvență comună). Pentru texte foarte mari (peste ~4 milioane de perechi)
 * întoarce null, ca să nu blocheze aplicația.
 */
export function diffLines(a: string[], b: string[]): DiffLine[] | null {
  // Începutul și finalul comune se sar (de obicei se schimbă doar câteva rânduri la mijloc).
  let s = 0;
  while (s < a.length && s < b.length && a[s] === b[s]) s++;
  let e = 0;
  while (e < a.length - s && e < b.length - s && a[a.length - 1 - e] === b[b.length - 1 - e]) e++;
  const A = a.slice(s, a.length - e), B = b.slice(s, b.length - e);
  if (A.length * B.length > 4_000_000) return null;
  const m = A.length, n = B.length;
  const L = new Uint32Array((m + 1) * (n + 1));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      L[i * (n + 1) + j] = A[i] === B[j] ? L[(i + 1) * (n + 1) + j + 1] + 1 : Math.max(L[(i + 1) * (n + 1) + j], L[i * (n + 1) + j + 1]);
    }
  }
  const mid: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && A[i] === B[j]) { mid.push({ kind: 'same', text: A[i] }); i++; j++; }
    // La egalitate întâi rândul scos, apoi cel pus în loc (ca în Word).
    else if (i < m && (j === n || L[(i + 1) * (n + 1) + j] >= L[i * (n + 1) + j + 1])) { mid.push({ kind: 'old', text: A[i] }); i++; }
    else { mid.push({ kind: 'new', text: B[j] }); j++; }
  }
  return [
    ...a.slice(0, s).map((text) => ({ kind: 'same' as const, text })),
    ...mid,
    ...a.slice(a.length - e).map((text) => ({ kind: 'same' as const, text })),
  ];
}
