// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Linia de semnătură completată la semnarea digitală (Docs → Export .docx semnat digital…): în copia semnată, rândul gol de
// deasupra liniei primește „✓ Semnat digital de <nume>” (din certificat), iar rândul „Data: ____” de sub ea primește data.
// Se alege linia cu numele semnatarului sub ea; dacă nu e niciuna, prima linie încă necompletată. Documentul din editor rămâne neschimbat.
import type { JSONContent } from '@tiptap/react';

/** Linia pe care se semnează (cam 6 cm la litere de 11). */
export const SIGN_LINE = '_'.repeat(32);
export const SIGNED_PREFIX = '✓ Semnat digital de ';

const textOf = (n: JSONContent | undefined): string => (n?.text ?? '') + (n?.content ?? []).map(textOf).join('');
const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
const dateRo = (d: Date) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;

/** Copia documentului `doc` cu o linie de semnătură completată pentru `name` la data `when`; `filled` = s-a găsit o linie. */
export function fillSignatureLine(doc: JSONContent, name: string, when: Date): { doc: JSONContent; filled: boolean } {
  const copy: JSONContent = JSON.parse(JSON.stringify(doc));
  const blocks = copy.content ?? [];
  // Liniile de semnătură încă nesemnate: rândul liniei, cu un rând gol (sau deja completat de altcineva: sărit) deasupra.
  const lines: number[] = [];
  blocks.forEach((b, i) => {
    if (b.type !== 'paragraph' || textOf(b).trim() !== SIGN_LINE) return;
    const above = blocks[i - 1];
    if (above?.type === 'paragraph' && !textOf(above).trim()) lines.push(i);
  });
  if (!lines.length) return { doc: copy, filled: false };
  const who = norm(name);
  const at = lines.find((i) => who && norm(textOf(blocks[i + 1])) === who) ?? lines[0];
  const above = blocks[at - 1];
  above.content = [{ type: 'text', text: SIGNED_PREFIX + (name.trim() || 'semnatar'), marks: [{ type: 'italic' }] }];
  // Rândul pentru dată: în primele trei paragrafe de sub linie (după nume și funcție), înainte de altă linie.
  for (let i = at + 1; i <= at + 3 && i < blocks.length; i++) {
    const t = textOf(blocks[i]);
    if (t.trim() === SIGN_LINE) break;
    if (/^Data: _+$/.test(t.trim())) { blocks[i].content = [{ type: 'text', text: 'Data: ' + dateRo(when) }]; break; }
  }
  return { doc: copy, filled: true };
}
