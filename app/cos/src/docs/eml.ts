// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Îmbinarea de corespondență → mesaje de e-mail: câte un fișier .eml (formatul standard al unui mesaj, MIME) pentru fiecare rând,
// cu destinatarul, subiectul și textul completate. Suite nu trimite nimic: fișierul se deschide în programul de e-mail
// (X-Unsent: 1 îl face mesaj nou, gata de trimis), iar omul apasă Trimite.
import type { JSONContent } from '@tiptap/react';
import { fillDoc, MergeData } from './merge';
import { docJsonToHtml, docToText } from './plainExport';

const CRLF = String.fromCharCode(13, 10);

/** Coloana cu adresele de e-mail: după nume (E-mail, Email, Mail, Adresă e-mail) sau, altfel, cea cu cele mai multe „@”; -1 dacă nu e. */
export function emailColumn(data: MergeData): number {
  const byName = data.headers.findIndex((h) => /^(adres[aă] (de )?)?e-?mail$|^mail$|^email address$/i.test(h.trim()));
  if (byName >= 0) return byName;
  let best = -1, bestN = 0;
  data.headers.forEach((_, c) => {
    const n = data.rows.filter((r) => isEmail(r[c] ?? '')).length;
    if (n > bestN) { bestN = n; best = c; }
  });
  return best;
}

/** O adresă care arată a e-mail (nume@domeniu.ro), fără spații și fără rânduri noi. */
export function isEmail(s: string): boolean {
  return /^[^@ <>,;"]+@[^@ <>,;"]+[.][^@ <>,;".]+$/.test(s.trim());
}

/** Textul fără rânduri noi (un antet de e-mail e pe un singur rând). */
const oneLine = (s: string) => s.split(String.fromCharCode(13)).join(' ').split(String.fromCharCode(10)).join(' ').trim();

/** Octeții în base64, pe rânduri de cel mult 76 de caractere (cum cere MIME). */
export function base64Lines(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const b = btoa(bin), out: string[] = [];
  for (let i = 0; i < b.length; i += 76) out.push(b.slice(i, i + 76));
  return out.join(CRLF);
}

/** Un antet cu diacritice scris ca „=?UTF-8?B?…?=” (RFC 2047), în bucăți care nu taie o literă în două; ASCII rămâne cum e. */
export function encodeHeader(s: string): string {
  const t = oneLine(s);
  if (/^[ -~]*$/.test(t)) return t;
  const enc = new TextEncoder(), words: string[] = [];
  let cur = '';
  for (const ch of t) {
    if (enc.encode(cur + ch).length > 45) { words.push(cur); cur = ''; }
    cur += ch;
  }
  if (cur) words.push(cur);
  return words.map((w) => `=?UTF-8?B?${btoa(String.fromCharCode(...enc.encode(w)))}?=`).join(CRLF + ' ');
}

/** Un fișier atașat la mesaj: numele, felul (MIME) și octeții. */
export interface EmlFile { name: string; type: string; data: Uint8Array }
/** O poză din textul mesajului, cerută de HTML prin src="cid:<cid>". */
export interface EmlInline { cid: string; type: string; data: Uint8Array }
/**
 * `to` gol = mesaj fără destinatar (îl scrie omul în programul de e-mail). `html` e conținutul lui <body> sau o pagină întreagă
 * (care începe cu <!DOCTYPE sau <html); `inline`: pozele din text (HTML-ul și pozele merg împreună, multipart/related).
 */
export interface Eml { to: string; subject: string; text: string; html: string; attachments?: EmlFile[]; inline?: EmlInline[] }

/** Numele fișierului atașat: ASCII între ghilimele și, dacă are diacritice, și forma UTF-8 (RFC 2231). */
export function attachName(name: string): string {
  const n = oneLine(name).split('"').join("'");
  if (/^[ -~]*$/.test(n)) return `filename="${n}"`;
  // Fără diacritice: literele desfăcute (ș = s + semn), apoi semnele scoase; ce nu e ASCII devine _.
  const ascii = [...n.normalize('NFD')].filter((ch) => ch.charCodeAt(0) < 0x300 || ch.charCodeAt(0) > 0x36f).join('').replace(/[^ -~]/g, '_');
  const pct = [...new TextEncoder().encode(n)].map((b) => (/[A-Za-z0-9._-]/.test(String.fromCharCode(b)) ? String.fromCharCode(b) : '%' + b.toString(16).toUpperCase().padStart(2, '0'))).join('');
  return `filename="${ascii}"; filename*=UTF-8''${pct}`;
}

/** Mesajul complet (.eml): text simplu și HTML (multipart/alternative), plus fișierele atașate (multipart/mixed); UTF-8 în base64, rânduri CRLF. */
export function buildEml(m: Eml, boundary = 'suite-' + Math.random().toString(36).slice(2, 12)): string {
  const enc = new TextEncoder();
  const files = m.attachments ?? [];
  const alt = files.length ? boundary + '-alt' : boundary;
  const part = (type: string, body: string) => [
    `--${alt}`, `Content-Type: ${type}; charset=utf-8`, 'Content-Transfer-Encoding: base64', '', base64Lines(enc.encode(body)),
  ].join(CRLF);
  const html = /^<(!doctype|html)/i.test(m.html.trimStart()) ? m.html
    : `<!DOCTYPE html>${CRLF}<html><head><meta charset="utf-8"></head><body style="font-family: Calibri, Arial, sans-serif; font-size: 11pt;">${CRLF}${m.html}</body></html>`;
  const pics = m.inline ?? [], rel = boundary + '-rel';
  // Cu poze în text: HTML-ul și pozele lui sunt o singură parte „legată” (multipart/related) a variantei HTML.
  const htmlPart = pics.length ? [
    `--${alt}`, `Content-Type: multipart/related; type="text/html"; boundary="${rel}"`, '',
    `--${rel}`, 'Content-Type: text/html; charset=utf-8', 'Content-Transfer-Encoding: base64', '', base64Lines(enc.encode(html)),
    ...pics.flatMap((p) => [`--${rel}`, `Content-Type: ${p.type}`, 'Content-Transfer-Encoding: base64', `Content-ID: <${p.cid}>`, 'Content-Disposition: inline', '', base64Lines(p.data)]),
    `--${rel}--`,
  ].join(CRLF) : part('text/html', html);
  const body = [
    part('text/plain', m.text.split(CRLF).join(String.fromCharCode(10)).split(String.fromCharCode(10)).join(CRLF)),
    htmlPart,
    `--${alt}--`,
  ];
  const to = oneLine(m.to);
  return [
    ...(to ? [`To: ${to}`] : []),
    `Subject: ${encodeHeader(m.subject)}`,
    'X-Unsent: 1',
    'MIME-Version: 1.0',
    ...(files.length ? [
      `Content-Type: multipart/mixed; boundary="${boundary}"`, '',
      `--${boundary}`, `Content-Type: multipart/alternative; boundary="${alt}"`, '', ...body,
      ...files.flatMap((f) => [
        `--${boundary}`, `Content-Type: ${f.type}`, 'Content-Transfer-Encoding: base64', `Content-Disposition: attachment; ${attachName(f.name)}`, '', base64Lines(f.data),
      ]),
      `--${boundary}--`,
    ] : [`Content-Type: multipart/alternative; boundary="${alt}"`, '', ...body]),
    '',
  ].join(CRLF);
}

/** Subiectul cu câmpurile «…» completate pentru rândul dat. */
export function fillSubject(subject: string, data: MergeData, row: number): string {
  return oneLine(docToText(fillDoc({ type: 'doc', content: [{ type: 'paragraph', content: subject ? [{ type: 'text', text: subject }] : [] }] }, data, row)));
}

/** Mesajul pentru un rând: adresa din coloana dată, subiectul și documentul completate; null dacă rândul n-are adresă bună.
 *  `attach`: documentul completat, ca fișier atașat (PDF / .docx), făcut doar pentru rândurile cu adresă. */
export async function mergeEml(doc: JSONContent, data: MergeData, row: number, emailCol: number, subject: string,
  attach?: (filled: JSONContent) => Promise<EmlFile>): Promise<string | null> {
  const to = (data.rows[row]?.[emailCol] ?? '').trim();
  if (!isEmail(to)) return null;
  const filled = fillDoc(doc, data, row);
  const attachments = attach ? [await attach(filled)] : undefined;
  return buildEml({ to, subject: fillSubject(subject, data, row), text: docToText(filled), html: docJsonToHtml(filled), attachments });
}
