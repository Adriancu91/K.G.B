// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Liste în notițe, ca în Google Keep și OneNote: rândurile care încep cu „☐ ” sunt de făcut, cele cu „☑ ” sunt bifate,
// cele cu „• ” (sau „- ”, „* ”) sunt cu buline, iar cele cu „1. ” / „1) ” sunt numerotate.
// Schimbările se fac cu „insertText”, ca Ctrl+Z din câmpul de text să le poată anula.
export const BOX = '☐';
export const DONE = '☑';
export const BULLET = '•';
// Rândurile de bifat pot avea spații în față: sunt sub-elemente (Tab), ca în Keep.
const ITEM_RE = /^( *)([☐☑])/;
const isItem = (line: string) => ITEM_RE.test(line);
/** Rândul e un element de bifat bifat (☑), cu sau fără spații în față. */
export const isDone = (line: string) => ITEM_RE.exec(line)?.[2] === DONE;
const indentOf = (line: string) => /^ */.exec(line)![0].length;
/** Cât de mult se poate retrage un paragraf obișnuit: 8 trepte de câte 4 spații. */
export const PARA_INDENT_MAX = 32;

/** Câte rânduri de bifat are textul și câte sunt bifate. */
export function progress(body: string): { done: number; total: number } {
  let done = 0, total = 0;
  for (const l of body.split('\n')) {
    if (!isItem(l)) continue;
    total++;
    if (isDone(l)) done++;
  }
  return { done, total };
}

/** O schimbare de text: zona [from, to) se înlocuiește cu `text`, apoi cursorul ajunge la `caret`. */
export interface Edit { from: number; to: number; text: string; caret: number }

/** Înlocuiește zona [from, to) din câmp cu textul dat, păstrând anularea (Ctrl+Z). */
function replace(el: HTMLTextAreaElement, from: number, to: number, text: string) {
  if (from === to && !text) return;
  el.focus();
  el.setSelectionRange(from, to);
  // Un text gol se scrie ca ștergere: „insertText” cu nimic lasă cursorul cu o poziție prea în stânga.
  if (!document.execCommand(text ? 'insertText' : 'delete', false, text)) {
    el.setRangeText(text, from, to, 'end');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  el.setSelectionRange(from + text.length, from + text.length);
}

export function apply(el: HTMLTextAreaElement, e: Edit | null): boolean {
  if (!e) return false;
  replace(el, e.from, e.to, e.text);
  el.setSelectionRange(e.caret, e.caret);
  return true;
}

const lineStart = (v: string, i: number) => v.lastIndexOf('\n', i - 1) + 1;
const lineEnd = (v: string, i: number) => { const e = v.indexOf('\n', i); return e < 0 ? v.length : e; };

/** Rândurile atinse de selecție: [început, sfârșit). */
function selLines(v: string, s: number, e: number): [number, number] {
  const a = lineStart(v, s);
  const b = lineEnd(v, Math.max(s, e - (e > s && v[e - 1] === '\n' ? 1 : 0)));
  return [a, b];
}

// Bulinele și numerele pot avea spații în față (sub-liste, cu Tab).
const BULLET_RE = /^(\s*)([•*-]) (.*)$/;
const NUM_RE = /^(\s*)(\d{1,3})([.)]) (.*)$/;

/** Rândul fără marcajul de listă (bulină, număr, căsuță). */
function stripMark(l: string): string {
  const m = BULLET_RE.exec(l) ?? NUM_RE.exec(l);
  if (m) return m[m.length - 1];
  return l.replace(/^ *[☐☑] ?/, '');
}

/** Butonul „Listă de bifat”: rândurile selectate devin de bifat; dacă erau deja toate, redevin text obișnuit. */
export function toggleList(el: HTMLTextAreaElement) {
  const v = el.value;
  const [a, b] = selLines(v, el.selectionStart, el.selectionEnd);
  const lines = v.slice(a, b).split('\n');
  const all = lines.every((l) => isItem(l) || !l.trim()) && lines.some(isItem);
  const out = lines.map((l) => (all ? l.replace(/^( *)[☐☑] ?/, '$1') : isItem(l) || (!l.trim() && lines.length > 1) ? l : `${' '.repeat(indentOf(l))}${BOX} ${stripMark(l.trimStart())}`)).join('\n');
  replace(el, a, b, out);
  // Cursorul rămâne la sfârșitul ultimului rând schimbat (pe un rând gol, gata de scris).
  el.setSelectionRange(a + out.length, a + out.length);
}

/** Click pe căsuța de la începutul unui rând: o bifează sau o debifează. Întoarce true dacă a fost un click pe căsuță. */
export function clickBox(el: HTMLTextAreaElement): boolean {
  if (el.selectionStart !== el.selectionEnd) return false;
  const v = el.value, pos = el.selectionStart, a = lineStart(v, pos);
  const m = ITEM_RE.exec(v.slice(a, lineEnd(v, a)));
  if (!m) return false;
  const box = boxAt(v, pos);
  if (box < 0) return false;
  replace(el, box, box + 1, m[2] === BOX ? DONE : BOX);
  const end = lineEnd(el.value, a);
  el.setSelectionRange(end, end);
  return true;
}

/** Rând de listă gol: cu spații în față urcă un nivel (ca în Word), fără spații lista se încheie. */
function endItem(a: number, end: number, indent: string): Edit {
  if (!indent) return { from: a, to: end, text: '', caret: a };
  const k = Math.min(4, indent.length);
  return { from: a, to: a + k, text: '', caret: end - k };
}

/** Ce schimbă Enter pe poziția `pos`, sau null dacă rândul nu e de listă. */
export function enterEdit(v: string, pos: number): Edit | null {
  const a = lineStart(v, pos), end = lineEnd(v, a);
  const line = v.slice(a, end);
  const it = ITEM_RE.exec(line);
  if (it) {
    if (!line.slice(it[0].length).trim()) return endItem(a, end, it[1]);
    const t = `\n${it[1]}${BOX} `;
    return { from: pos, to: pos, text: t, caret: pos + t.length };
  }
  const b = BULLET_RE.exec(line);
  if (b && pos >= a + b[1].length + 2) {
    if (!b[3].trim()) return endItem(a, end, b[1]);
    const t = `\n${b[1]}${b[2]} `;
    return { from: pos, to: pos, text: t, caret: pos + t.length };
  }
  const n = NUM_RE.exec(line);
  if (n && pos >= a + n[1].length + n[2].length + 2) {
    if (!n[4].trim()) return endItem(a, end, n[1]);
    // Rândul nou ia numărul următor, iar rândurile de după (din aceeași listă) se renumerotează.
    let k = Number(n[2]) + 1;
    const head = `\n${n[1]}${k}${n[3]} `;
    let text = head + v.slice(pos, end);
    let to = end;
    while (to < v.length) {
      const s = to + 1, e = lineEnd(v, s);
      const m = NUM_RE.exec(v.slice(s, e));
      if (!m || m[1] !== n[1]) break;
      k++;
      text += `\n${m[1]}${k}${m[3]} ${m[4]}`;
      to = e;
    }
    return { from: pos, to, text, caret: pos + head.length };
  }
  return null;
}

/** Enter pe un rând de listă continuă lista; pe un rând de listă gol, o încheie. Întoarce true dacă s-a ocupat de tastă. */
export function enterInList(el: HTMLTextAreaElement): boolean {
  if (el.selectionStart !== el.selectionEnd) return false;
  return apply(el, enterEdit(el.value, el.selectionStart));
}

/** Butoanele „• Listă” și „1. Numerotată”: rândurile selectate devin listă; dacă erau deja așa, redevin text obișnuit. */
export function bulletEdit(v: string, s: number, e: number, kind: 'bullet' | 'number'): Edit {
  const [a, b] = selLines(v, s, e);
  const lines = v.slice(a, b).split('\n');
  const re = kind === 'bullet' ? BULLET_RE : NUM_RE;
  const all = lines.every((l) => re.test(l) || !l.trim()) && lines.some((l) => re.test(l));
  let k = 0;
  const out = lines.map((l) => {
    if (all) return /^\s*/.exec(l)![0] + stripMark(l);
    if (!l.trim() && lines.length > 1) return l;
    const indent = /^\s*/.exec(l)![0];
    const rest = stripMark(l.slice(indent.length));
    return kind === 'bullet' ? `${indent}${BULLET} ${rest}` : `${indent}${++k}. ${rest}`;
  }).join('\n');
  return { from: a, to: b, text: out, caret: a + out.length };
}

export function toggleBullets(el: HTMLTextAreaElement, kind: 'bullet' | 'number') {
  apply(el, bulletEdit(el.value, el.selectionStart, el.selectionEnd, kind));
}

/** Tab / Shift+Tab: rândurile de listă și paragrafele obișnuite trec o treaptă la dreapta sau la stânga. Null dacă nu se schimbă nimic. */
export function indentEdit(v: string, s: number, e: number, out: boolean): Edit | null {
  const [a, b] = selLines(v, s, e);
  const lines = v.slice(a, b).split('\n');
  // Și rândurile de bifat: cu spații în față devin sub-elemente.
  const isList = (l: string) => BULLET_RE.test(l) || NUM_RE.test(l) || isItem(l);
  // Paragrafele obișnuite se retrag și ele cu câte 4 spații (ca Tab din OneNote), până la PARA_INDENT_MAX;
  // titlurile, rândurile de tabel și rândurile goale rămân pe loc.
  const isPara = (l: string) => !!l.trim() && !isList(l) && !/^#{1,3} /.test(l) && !/^\s*\|./.test(l);
  if (!lines.some((l) => isList(l) || isPara(l))) return null;
  const text = lines.map((l) => (!isList(l) && !isPara(l) ? l : out ? l.replace(/^ {1,4}/, '')
    : isPara(l) && indentOf(l) + 4 > PARA_INDENT_MAX ? l : `    ${l}`)).join('\n');
  if (text === lines.join('\n')) return null;
  const caret = s === e ? Math.max(a, s + (text.length - (b - a))) : a + text.length;
  return { from: a, to: b, text, caret };
}

/**
 * Mută rândurile atinse de selecție cu un loc mai sus (dir = -1) sau mai jos (1), ca Alt+Shift+↑/↓ din OneNote.
 * Un element de listă se mută împreună cu sub-elementele lui și sare peste vecinul întreg (cu sub-elementele acestuia).
 */
export function moveLinesEdit(v: string, s: number, e: number, dir: -1 | 1): Edit | null {
  const lines = v.split('\n');
  const lineOf = (p: number) => v.slice(0, p).split('\n').length - 1;
  const offset = (i: number) => lines.slice(0, i).reduce((n, l) => n + l.length + 1, 0);
  const a = lineOf(s);
  let b = lineOf(e > s && v[e - 1] === '\n' ? e - 1 : e);
  const ind = indentOf(lines[a]);
  // Sub-elementele (rândurile de sub el, mai la dreapta) merg împreună cu el.
  while (b + 1 < lines.length && lines[b + 1].trim() && indentOf(lines[b + 1]) > ind) b++;
  let na: number;
  let nb: number;
  if (dir < 0) {
    if (a === 0) return null;
    nb = a - 1;
    na = nb;
    while (na > 0 && lines[na].trim() && indentOf(lines[na]) > ind) na--;
  } else {
    if (b + 1 >= lines.length) return null;
    na = b + 1;
    nb = na;
    while (nb + 1 < lines.length && lines[nb + 1].trim() && indentOf(lines[nb + 1]) > indentOf(lines[na])) nb++;
  }
  const block = lines.slice(a, b + 1).join('\n');
  const other = lines.slice(na, nb + 1).join('\n');
  if (dir < 0) {
    const from = offset(na);
    return { from, to: offset(b) + lines[b].length, text: block + '\n' + other, caret: s - (offset(a) - from) };
  }
  return { from: offset(a), to: offset(nb) + lines[nb].length, text: other + '\n' + block, caret: s + other.length + 1 };
}

export function moveLines(el: HTMLTextAreaElement, dir: -1 | 1): boolean {
  return apply(el, moveLinesEdit(el.value, el.selectionStart, el.selectionEnd, dir));
}

/** Poziția căsuței (☐ / ☑) pe care stă cursorul `pos` (înainte sau imediat după ea), sau -1. */
export function boxAt(v: string, pos: number): number {
  const a = lineStart(v, pos);
  const m = ITEM_RE.exec(v.slice(a, lineEnd(v, a)));
  if (!m) return -1;
  const box = a + m[1].length;
  return pos < box || pos - box > 1 ? -1 : box;
}

/**
 * Tragerea unui element de bifat cu mouse-ul (ca în Keep): elementul de pe poziția `from`, cu sub-elementele lui,
 * ajunge pe rândul de sub mouse (`to`): în fața lui când urcă, după el (și după sub-elementele lui) când coboară.
 * Null dacă `from` nu e pe un element sau `to` cade chiar în elementul tras.
 */
export function moveItemEdit(v: string, from: number, to: number): Edit | null {
  const lines = v.split('\n');
  const lineOf = (p: number) => v.slice(0, p).split('\n').length - 1;
  const offset = (i: number) => lines.slice(0, i).reduce((n, l) => n + l.length + 1, 0);
  const kidsEnd = (i: number) => {
    const ind = indentOf(lines[i]);
    while (i + 1 < lines.length && lines[i + 1].trim() && indentOf(lines[i + 1]) > ind) i++;
    return i;
  };
  const a = lineOf(from);
  if (!isItem(lines[a])) return null;
  const b = kidsEnd(a);
  let t = lineOf(Math.max(0, Math.min(to, v.length)));
  if (t >= a && t <= b) return null;
  const block = lines.slice(a, b + 1);
  let lo: number, hi: number, mid: string[], head: number;
  if (t < a) {
    lo = t; hi = b;
    mid = [...block, ...lines.slice(t, a)];
    head = 0;
  } else {
    t = kidsEnd(t);
    lo = a; hi = t;
    mid = [...lines.slice(b + 1, t + 1), ...block];
    head = t - b;
  }
  const text = mid.join('\n');
  const start = offset(lo);
  const caret = start + mid.slice(0, head).reduce((n, l) => n + l.length + 1, 0) + mid[head].length;
  return { from: start, to: offset(hi) + lines[hi].length, text, caret };
}

/** Scrie textul la cursor (în locul selecției), cu anulare (Ctrl+Z). */
export function insertAtCursor(el: HTMLTextAreaElement, text: string) {
  const s = el.selectionStart;
  apply(el, { from: s, to: el.selectionEnd, text, caret: s + text.length });
}

/** Ctrl+K în notiță: textul ales devine „text (https://)”, cu cursorul unde se scrie adresa
 *  (forma recunoscută de notițe ca legătură web). Fără text ales se scrie „legătură (https://)”. */
export function insertLink(el: HTMLTextAreaElement) {
  const s = el.selectionStart, e = el.selectionEnd;
  const label = el.value.slice(s, e).trim() || 'legătură';
  const text = `${label} (https://)`;
  apply(el, { from: s, to: e, text, caret: s + text.length - 1 });
}

/** Data și ora ca în Word pentru România: „18.10.2026”, „21:58”. */
export function dateStamp(d: Date, what: 'date' | 'time' | 'both'): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const date = `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
  const time = `${p(d.getHours())}:${p(d.getMinutes())}`;
  return what === 'date' ? date : what === 'time' ? time : `${date}, ${time}`;
}

export function indentList(el: HTMLTextAreaElement, out: boolean): boolean {
  return apply(el, indentEdit(el.value, el.selectionStart, el.selectionEnd, out));
}

/** Comenzile pentru bifate (ca în Google Keep): mută bifatele jos, debifează tot, șterge bifatele. Null dacă nu se schimbă nimic. */
export function checkedEdit(v: string, what: 'bottom' | 'uncheck' | 'remove'): Edit | null {
  const lines = v.split('\n');
  let out: string[];
  if (what === 'uncheck') out = lines.map((l) => (isDone(l) ? l.replace(DONE, BOX) : l));
  else if (what === 'remove') {
    // Un element bifat pleacă împreună cu sub-elementele lui.
    out = [];
    for (let i = 0; i < lines.length; i++) {
      if (!isDone(lines[i])) { out.push(lines[i]); continue; }
      const ind = indentOf(lines[i]);
      while (i + 1 < lines.length && isItem(lines[i + 1]) && indentOf(lines[i + 1]) > ind) i++;
    }
  }
  else {
    // În fiecare grup de rânduri de bifat la rând, cele bifate trec la sfârșitul grupului (ordinea lor rămâne).
    out = [];
    for (let i = 0; i < lines.length;) {
      if (!isItem(lines[i])) { out.push(lines[i++]); continue; }
      const group: string[] = [];
      while (i < lines.length && isItem(lines[i])) group.push(lines[i++]);
      out.push(...doneLast(group));
    }
  }
  const text = out.join('\n');
  if (text === v) return null;
  // Se înlocuiește doar bucata care diferă, ca anularea și cursorul să rămână firești.
  let a = 0;
  while (a < v.length && a < text.length && v[a] === text[a]) a++;
  let b = 0;
  while (b < v.length - a && b < text.length - a && v[v.length - 1 - b] === text[text.length - 1 - b]) b++;
  const mid = text.slice(a, text.length - b);
  return { from: a, to: v.length - b, text: mid, caret: a + mid.length };
}

/** Bifatele la sfârșit, pe fiecare nivel: un element se mută împreună cu sub-elementele lui. */
function doneLast(lines: string[]): string[] {
  if (!lines.length) return lines;
  const base = Math.min(...lines.map(indentOf));
  const blocks: string[][] = [];
  for (const l of lines) {
    if (indentOf(l) <= base || !blocks.length) blocks.push([l]);
    else blocks[blocks.length - 1].push(l);
  }
  const sorted = blocks.map(([head, ...kids]) => [head, ...doneLast(kids)]);
  return [...sorted.filter((b) => !isDone(b[0])), ...sorted.filter((b) => isDone(b[0]))].flat();
}

export function applyChecked(el: HTMLTextAreaElement, what: 'bottom' | 'uncheck' | 'remove'): boolean {
  return apply(el, checkedEdit(el.value, what));
}

/** Etichete pe rând (ca în OneNote): un semn la începutul rândului, adunat apoi în 🏷 Rezumat. */
export const LINE_MARKS: [string, string][] = [['⭐', 'Important'], ['❓', 'Întrebare'], ['💡', 'Idee'], ['📞', 'De sunat'], ['📌', 'De ținut minte']];

/** Pune semnul pe rândurile selectate (după spațiile din față); dacă îl aveau toate, îl scoate. */
export function markEdit(v: string, s: number, e: number, mark: string): Edit {
  const [a, b] = selLines(v, s, e);
  const lines = v.slice(a, b).split(String.fromCharCode(10));
  const has = (l: string) => l.trimStart().startsWith(mark + ' ');
  const all = lines.filter((l) => l.trim()).every(has);
  const text = lines.map((l) => {
    if (!l.trim() && lines.length > 1) return l;
    const ind = ' '.repeat(indentOf(l));
    return all ? ind + l.trimStart().slice(mark.length + 1) : has(l) ? l : ind + mark + ' ' + l.trimStart();
  }).join(String.fromCharCode(10));
  return { from: a, to: b, text, caret: a + text.length };
}

export function toggleMark(el: HTMLTextAreaElement, mark: string) {
  apply(el, markEdit(el.value, el.selectionStart, el.selectionEnd, mark));
}

/** Ctrl+0: scoate de pe rândurile selectate căsuțele și etichetele (⭐ ❓ 💡 📞 📌), păstrând spațiile din față. */
export function unmarkEdit(v: string, s: number, e: number): Edit {
  const [a, b] = selLines(v, s, e);
  const NLc = String.fromCharCode(10);
  const text = v.slice(a, b).split(NLc).map((l) => {
    const ind = ' '.repeat(indentOf(l));
    let t = l.trimStart();
    for (let again = true; again;) {
      again = false;
      if (/^[☐☑]/.test(t)) { t = t.replace(/^[☐☑] ?/, ''); again = true; }
      for (const [mk] of LINE_MARKS) if (t.startsWith(mk + ' ')) { t = t.slice(mk.length + 1); again = true; }
    }
    return l.trim() ? ind + t : l;
  }).join(NLc);
  return { from: a, to: b, text, caret: a + text.length };
}
