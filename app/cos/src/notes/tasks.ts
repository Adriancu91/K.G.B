// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// „Export sarcini (.ics)”: rândurile de bifat ale notiței (☐ / ☑) devin sarcini (VTODO) într-un fișier de calendar, pe care
// programele de e-mail și de calendar îl deschid și îl pun în lista lor de sarcini. Sub-elementele (cu spații în față) rămân legate
// de sarcina de deasupra (RELATED-TO), cele bifate ies terminate, iar mementoul notiței devine termenul (DUE). Testat în tests/notes-tasks.test.mjs.
import { isDone } from './checklist';
import { parseInline } from './inline';
import { remindTimes, shownTitle, type Note } from './store';

export interface NoteTask { text: string; done: boolean; level: number; parent: number | null }

/** Câte sarcini intră într-un fișier (o notiță cu mii de rânduri de bifat ar face un fișier pe care programele îl refuză). */
export const MAX_TASKS = 500;

const ITEM = /^( *)([☐☑])\s?(.*)$/;

/** Rândurile de bifat ale notiței, fără semnele de format, cu sarcina de deasupra pentru sub-elemente. */
export function noteTasks(body: string): NoteTask[] {
  const out: NoteTask[] = [];
  const stack: { level: number; i: number }[] = [];
  for (const line of body.split('\n')) {
    const m = ITEM.exec(line);
    if (!m) continue;
    const text = parseInline(m[3]).map((sp) => sp.s).join('').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const level = m[1].length;
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
    out.push({ text, done: isDone(line), level, parent: stack.length ? stack[stack.length - 1].i : null });
    stack.push({ level, i: out.length - 1 });
    if (out.length >= MAX_TASKS) break;
  }
  return out;
}

/** Textul pentru .ics: \ ; , și rândurile noi scrise cu \ în față. */
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
/** Data în UTC, cum o cere .ics: 20261028T064500Z. */
const utc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Rândurile mai lungi de 75 de octeți se rup, iar continuarea începe cu un spațiu (fără să tăiem o literă în două). */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let cur = '', size = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const max = parts.length ? 74 : 75;
    if (size + n > max) { parts.push(cur); cur = ''; size = 0; }
    cur += ch; size += n;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

/** Fișierul .ics cu sarcinile notiței; `null` dacă notița nu are rânduri de bifat. */
export function noteTasksIcs(n: Note, now = new Date()): string | null {
  const tasks = noteTasks(n.body);
  if (!tasks.length) return null;
  const title = shownTitle(n) || 'Notiță';
  const { next } = remindTimes(n, now);
  const due = next ?? (n.remind && !Number.isNaN(Date.parse(n.remind)) ? new Date(n.remind) : null);
  const uid = (i: number) => `${n.id}-${i + 1}@suite-notite`;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cyber Office Studio//Notite//RO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  tasks.forEach((t, i) => {
    lines.push('BEGIN:VTODO', `UID:${uid(i)}`, `DTSTAMP:${utc(now)}`, `SUMMARY:${esc(t.text)}`, `DESCRIPTION:${esc(`Din notița „${title}”`)}`);
    if (t.parent !== null) lines.push(`RELATED-TO;RELTYPE=PARENT:${uid(t.parent)}`);
    if (due && !t.done) lines.push(`DUE:${utc(due)}`);
    if (t.done) lines.push('STATUS:COMPLETED', 'PERCENT-COMPLETE:100', `COMPLETED:${utc(now)}`);
    else lines.push('STATUS:NEEDS-ACTION');
    lines.push('END:VTODO');
  });
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

// „Import sarcini (.ics)”, legătura înapoi: după ce bifezi sarcinile în programul de calendar și le exporți (sau salvezi lista
// de sarcini ca .ics), fișierul adus în notiță bifează / debifează rândurile ei. Sarcina se recunoaște după UID-ul pus la
// export (<notița>-<numărul rândului>@suite-notite) și după text; dacă rândurile s-au mutat între timp, se caută după text.

export interface IcsTask { uid: string; summary: string; done: boolean }

const unesc = (s: string) => s.replace(/\\([\\;,nN])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));

/** Sarcinile (VTODO) dintr-un fișier .ics: UID, textul și dacă e terminată (STATUS:COMPLETED, 100% sau cu dată de terminare). */
export function parseIcsTasks(ics: string): IcsTask[] {
  // Rândurile rupte (care încep cu spațiu sau Tab) se lipesc de cel de dinainte.
  const lines = ics.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const out: IcsTask[] = [];
  let cur: { uid: string; summary: string; status: string; pct: number; completed: boolean } | null = null;
  for (const line of lines) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i).split(';')[0].toUpperCase(), val = line.slice(i + 1);
    if (key === 'BEGIN' && val.trim().toUpperCase() === 'VTODO') cur = { uid: '', summary: '', status: '', pct: 0, completed: false };
    else if (!cur) continue;
    else if (key === 'END' && val.trim().toUpperCase() === 'VTODO') {
      out.push({ uid: cur.uid, summary: cur.summary, done: cur.status === 'COMPLETED' || (cur.status !== 'NEEDS-ACTION' && cur.status !== 'IN-PROCESS' && (cur.pct >= 100 || cur.completed)) });
      cur = null;
    } else if (key === 'UID') cur.uid = val.trim();
    else if (key === 'SUMMARY') cur.summary = unesc(val).replace(/\s+/g, ' ').trim();
    else if (key === 'STATUS') cur.status = val.trim().toUpperCase();
    else if (key === 'PERCENT-COMPLETE') cur.pct = parseInt(val, 10) || 0;
    else if (key === 'COMPLETED') cur.completed = !!val.trim();
  }
  return out;
}

/**
 * Pune în textul notiței starea sarcinilor din fișier: ☐ → ☑ pentru cele terminate, ☑ → ☐ pentru cele redeschise.
 * `matched` = câte sarcini din fișier au fost găsite în notiță; `others` = câte sunt ale altor notițe.
 */
export function applyIcsTasks(body: string, noteId: string, list: IcsTask[]): { body: string; checked: number; unchecked: number; matched: number; others: number } {
  const lines = body.split('\n');
  // Rândurile de bifat, în aceeași ordine și cu același text ca la export.
  const rows: { line: number; text: string; done: boolean }[] = [];
  lines.forEach((line, n) => {
    if (rows.length >= MAX_TASKS) return;
    const m = ITEM.exec(line);
    if (!m) return;
    const text = parseInline(m[3]).map((sp) => sp.s).join('').replace(/\s+/g, ' ').trim();
    if (text) rows.push({ line: n, text, done: isDone(line) });
  });
  const used = new Set<number>();
  const re = /^(.*)-(\d+)@suite-notite$/;
  let checked = 0, unchecked = 0, matched = 0, others = 0;
  for (const t of list) {
    const m = re.exec(t.uid);
    if (!m) continue;
    if (m[1] !== noteId) { others++; continue; }
    const idx = parseInt(m[2], 10) - 1;
    let r = rows[idx] && !used.has(idx) && rows[idx].text === t.summary ? idx : -1;
    if (r < 0) r = rows.findIndex((x, k) => !used.has(k) && x.text === t.summary);
    if (r < 0) continue;
    used.add(r);
    matched++;
    const row = rows[r];
    if (row.done === t.done) continue;
    lines[row.line] = lines[row.line].replace(/^( *)[☐☑]/, (_, sp: string) => sp + (t.done ? '☑' : '☐'));
    if (t.done) checked++; else unchecked++;
  }
  return { body: lines.join('\n'), checked, unchecked, matched, others };
}
