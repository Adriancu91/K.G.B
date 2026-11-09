// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Plicuri (Word: Corespondență → Plicuri): adresa expeditorului sus în stânga, cu litere mai mici, și adresa destinatarului
// spre dreapta jos, pe o pagină cât plicul (DL, C6, C5, C4), culcată. Rezultatul e un document nou, gata de tipărit pe plic.
import type { JSONContent } from '@tiptap/react';
import { NO_PAGE_SETUP, PAPERS, serializeDoc, type PageSetup, type Paper } from './format';
import { INDENT_CM, MAX_INDENT } from './paragraphFormat';
import { labelText, MAX_MERGE_LABELS } from './labels';
import type { MergeData } from './merge';

export type EnvelopeSize = Extract<Paper, 'DL' | 'C6' | 'C5' | 'C4'>;
export const ENVELOPES: EnvelopeSize[] = ['DL', 'C6', 'C5', 'C4'];
export const envelopeName = (s: EnvelopeSize) => PAPERS.find(([k]) => k === s)![1];

const MARGIN = { top: 12, bottom: 10, left: 15, right: 12 };
const lines = (t: string) => t.replace(/\r/g, '').split('\n').map((l) => l.trimEnd()).filter((l, i, a) => l || (i > 0 && i < a.length - 1)).slice(0, 12);

export function envelopeDoc(to: string, from: string, size: EnvelopeSize): { doc: JSONContent; page: PageSetup } {
  const [, , short, long] = PAPERS.find(([k]) => k === size)!;
  const sender = lines(from);
  const recipient = lines(to);
  const content: JSONContent[] = sender.map((l) => ({
    type: 'paragraph', attrs: { spaceBefore: 0, spaceAfter: 0 },
    content: l ? [{ type: 'text', text: l, marks: [{ type: 'textStyle', attrs: { fontSize: '9pt' } }] }] : [],
  }));
  // Destinatarul începe cam la 45% din înălțime și puțin după jumătatea lățimii, ca pe plicurile obișnuite.
  const used = MARGIN.top + sender.length * 4.5;
  const before = Math.max(6, Math.round((short * 0.45 - used) * 2.835));
  const indent = Math.max(0, Math.min(MAX_INDENT, Math.round(((long * 0.45 - MARGIN.left) / 10) / INDENT_CM)));
  recipient.forEach((l, i) => content.push({
    type: 'paragraph', attrs: { indent, spaceBefore: i === 0 ? before : 0, spaceAfter: 0 },
    content: l ? [{ type: 'text', text: l, marks: [{ type: 'textStyle', attrs: { fontSize: '12pt' } }] }] : [],
  }));
  if (!content.length) content.push({ type: 'paragraph' });
  return { doc: { type: 'doc', content }, page: { ...NO_PAGE_SETUP, paper: size, landscape: true, margins: { ...MARGIN } } };
}

export function envelopeFile(to: string, from: string, size: EnvelopeSize): string {
  const { doc, page } = envelopeDoc(to, from, size);
  return serializeDoc(doc, page);
}

/** Plicuri din tabel: câte un plic (o pagină) pentru fiecare rând, cu destinatarul completat din câmpuri; rândurile goale se sar. */
export function envelopesMergeDoc(to: string, from: string, size: EnvelopeSize, data: MergeData, rows: number[]): { doc: JSONContent; page: PageSetup; count: number } {
  const list = rows.filter((r) => (data.rows[r] ?? []).some((v) => String(v ?? '').trim())).slice(0, MAX_MERGE_LABELS).map((r) => labelText(to, data, r)).filter((t) => t.trim());
  const content: JSONContent[] = [];
  let page = envelopeDoc('', from, size).page;
  list.forEach((t, i) => {
    const one = envelopeDoc(t, from, size);
    page = one.page;
    if (i) content.push({ type: 'pageBreak' });
    content.push(...(one.doc.content ?? []));
  });
  if (!content.length) content.push({ type: 'paragraph' });
  return { doc: { type: 'doc', content }, page, count: list.length };
}
