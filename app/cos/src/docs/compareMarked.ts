// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Documentul marcat de la Compară: din diferențele pe rânduri (fișierul primit → documentul de acum) facem un document nou în care
// ce s-a scos e text șters, iar ce s-a pus e text inserat, ca modificări urmărite (se acceptă / resping una câte una și ajung în .docx
// ca w:del / w:ins). Un rând schimbat puțin se compară cuvânt cu cuvânt, ca în procesorul de text cunoscut.
import type { JSONContent } from '@tiptap/core';
import type { DiffLine } from '../versionText';

type Part = { kind: 'same' | 'old' | 'new'; text: string };

/** Cuvintele și spațiile dintre ele, în ordine (lipite la loc dau textul întreg). */
export function wordTokens(s: string): string[] {
  return s.match(/\s+|[^\s]+/g) ?? [];
}

/** Diferența cuvânt cu cuvânt între două rânduri; bucățile vecine de același fel se unesc. Rândurile foarte lungi: tot rândul. */
export function wordDiff(a: string, b: string): Part[] {
  const A = wordTokens(a), B = wordTokens(b);
  const out: Part[] = [];
  const push = (kind: Part['kind'], text: string) => {
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.text += text;
    else if (text) out.push({ kind, text });
  };
  if (A.length * B.length > 250_000) { push('old', a); push('new', b); return out; }
  const m = A.length, n = B.length, W = n + 1;
  const L = new Uint32Array((m + 1) * W);
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) L[i * W + j] = A[i] === B[j] ? L[(i + 1) * W + j + 1] + 1 : Math.max(L[(i + 1) * W + j], L[i * W + j + 1]);
  let i = 0, j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && A[i] === B[j]) { push('same', A[i]); i++; j++; }
    else if (i < m && (j === n || L[(i + 1) * W + j] >= L[i * W + j + 1])) { push('old', A[i]); i++; }
    else { push('new', B[j]); j++; }
  }
  // Un spațiu singur rămas „la fel” între două schimbări face citirea grea: intră și în textul șters, și în cel inserat.
  // Apoi fiecare șir de schimbări alăturate devine un singur text șters urmat de un singur text inserat (fiecare în ordinea lui).
  const tidy: Part[] = [];
  let del = '', ins = '';
  const flush = () => { if (del) tidy.push({ kind: 'old', text: del }); if (ins) tidy.push({ kind: 'new', text: ins }); del = ins = ''; };
  out.forEach((p, k) => {
    const lone = p.kind === 'same' && !p.text.trim() && k > 0 && k + 1 < out.length && out[k - 1].kind !== 'same' && out[k + 1].kind !== 'same';
    if (p.kind === 'same' && !lone) { flush(); tidy.push(p); return; }
    if (p.kind !== 'new') del += p.text;
    if (p.kind !== 'old') ins += p.text;
  });
  flush();
  return tidy;
}

/** Cât de asemănătoare sunt două rânduri (0–1): partea de cuvinte comune. Sub 0,3 nu le mai comparăm cuvânt cu cuvânt. */
function likeness(parts: Part[]): number {
  const len = (k: Part['kind']) => parts.filter((p) => p.kind === k).reduce((n, p) => n + p.text.trim().length, 0);
  const same = len('same'), all = same * 2 + len('old') + len('new');
  return all ? (same * 2) / all : 1;
}

/** Diferența privită invers (documentul de acum → fișierul primit), pentru Combină: modificările celuilalt peste documentul nostru. */
export function flipDiff(diff: DiffLine[]): DiffLine[] {
  return diff.map((d) => (d.kind === 'same' ? d : { ...d, kind: d.kind === 'old' ? 'new' : 'old' }));
}

/** Documentul marcat: un paragraf pe rând, cu textul șters / inserat marcat cu autorul și data date. */
export function markedDoc(diff: DiffLine[], author: string, date: string): JSONContent {
  const attrs = { author, date };
  const para = (parts: Part[]): JSONContent => ({
    type: 'paragraph',
    content: parts.filter((p) => p.text).map((p) => ({
      type: 'text', text: p.text,
      ...(p.kind === 'same' ? {} : { marks: [{ type: p.kind === 'old' ? 'deletion' : 'insertion', attrs }] }),
    })),
  });
  const content: JSONContent[] = [];
  for (let k = 0; k < diff.length;) {
    if (diff[k].kind === 'same') { content.push(para([{ kind: 'same', text: diff[k].text }])); k++; continue; }
    const olds: string[] = [], news: string[] = [];
    for (; k < diff.length && diff[k].kind !== 'same'; k++) (diff[k].kind === 'old' ? olds : news).push(diff[k].text);
    // Rândurile scoase și puse în același loc se potrivesc două câte două; restul sunt paragrafe întregi șterse / inserate.
    for (let p = 0; p < Math.max(olds.length, news.length); p++) {
      const o = olds[p], nw = news[p];
      if (o !== undefined && nw !== undefined) {
        const w = wordDiff(o, nw);
        if (likeness(w) >= 0.3) content.push(para(w));
        else content.push(para([{ kind: 'old', text: o }]), para([{ kind: 'new', text: nw }]));
      } else if (o !== undefined) content.push(para([{ kind: 'old', text: o }]));
      else content.push(para([{ kind: 'new', text: nw! }]));
    }
  }
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}

/** Un fișier primit înapoi pentru Combină: diferența documentul de acum → fișier și cine a lucrat la el. */
export type Reviewer = { diff: DiffLine[]; author: string; date: string };

/**
 * Combină mai multe fișiere deodată (fiecare o copie a documentului de acum, corectată de alt om): rândurile documentului
 * rămân reperul, iar modificările fiecăruia se pun peste ele ca modificări urmărite pe numele lui. Un rând schimbat de un
 * singur om se compară cuvânt cu cuvânt; schimbat de mai mulți: rândul vechi șters și variantele fiecăruia inserate,
 * ca să le alegi. Rândurile inserate la fel de doi oameni în același loc apar o singură dată.
 */
export function combinedDoc(base: string[], reviewers: Reviewer[]): JSONContent {
  const n = base.length;
  const marks = reviewers.map((r) => {
    const ins: string[][] = Array.from({ length: n + 1 }, () => []);
    const rep = new Map<number, string>(), del = new Set<number>();
    let bi = 0;
    for (let k = 0; k < r.diff.length;) {
      if (r.diff[k].kind === 'same') { bi++; k++; continue; }
      const olds: number[] = [], news: string[] = [];
      for (; k < r.diff.length && r.diff[k].kind !== 'same'; k++) {
        if (r.diff[k].kind === 'old') olds.push(bi++); else news.push(r.diff[k].text);
      }
      olds.forEach((o, p) => (p < news.length ? rep.set(o, news[p]) : del.add(o)));
      const at = Math.min(n, olds.length ? olds[olds.length - 1] + 1 : bi);
      ins[at].push(...news.slice(olds.length));
    }
    return { ins, rep, del, attrs: { author: r.author, date: r.date } };
  });
  type A = { author: string; date: string };
  const text = (t: string, kind: Part['kind'], attrs?: A): JSONContent =>
    ({ type: 'text', text: t, ...(kind === 'same' ? {} : { marks: [{ type: kind === 'old' ? 'deletion' : 'insertion', attrs }] }) });
  const content: JSONContent[] = [];
  const one = (t: string, kind: Part['kind'], attrs?: A) => content.push({ type: 'paragraph', content: [text(t, kind, attrs)] });
  for (let i = 0; i <= n; i++) {
    const seen = new Set<string>();
    for (const m of marks) for (const t of m.ins[i]) if (!seen.has(t)) { seen.add(t); one(t, 'new', m.attrs); }
    if (i === n) break;
    const who = marks.filter((m) => m.rep.has(i) || m.del.has(i));
    if (!who.length) { one(base[i], 'same'); continue; }
    if (who.length === 1 && who[0].rep.has(i)) {
      const w = wordDiff(base[i], who[0].rep.get(i)!);
      if (likeness(w) >= 0.3) { content.push({ type: 'paragraph', content: w.filter((p) => p.text).map((p) => text(p.text, p.kind, who[0].attrs)) }); continue; }
    }
    one(base[i], 'old', who[0].attrs);
    const alt = new Set<string>();
    for (const m of who) { const t = m.rep.get(i); if (t !== undefined && !alt.has(t)) { alt.add(t); one(t, 'new', m.attrs); } }
  }
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}
