// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Export Markdown (.md): notițele ies ca text simplu pe care îl deschide orice program (Obsidian, Joplin, Notepad, GitHub).
// Titlul devine „# Titlu”, listele de bifat devin „- [ ]” / „- [x]”, etichetele #cuvânt rămân cum sunt.
import { DONE } from './checklist';
import type { Note } from './store';
import { boxImages, withBoxes } from './freeCanvas';

const day = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export function noteToMarkdown(n: Note): string {
  const body = withBoxes(n.body, n).split('\n').map((line) => {
    // Sub-elementele (cu spații în față) rămân sub-liste.
    const c = /^( *)([☐☑])/.exec(line);
    if (c) return `${c[1]}- [${c[2] === DONE ? 'x' : ' '}] ${line.slice(c[0].length).trimStart()}`;
    // Bulinele „•” devin „-” (Markdown); sub-listele păstrează spațiile din față.
    const b = /^(\s*)• /.exec(line);
    if (b) return `${b[1]}- ${line.slice(b[0].length)}`;
    // Paragraful retras cu Tab: spațiile din față devin spații care nu se pierd (altfel Markdown l-ar arăta ca bloc de cod).
    const ind = /^ +/.exec(line);
    if (ind && line.trim()) return String.fromCharCode(160).repeat(ind[0].length) + line.slice(ind[0].length);
    return line;
  }).join('\n').trim();
  const meta = [n.pinned ? '📌 fixată' : '', day(n.updated) ? `modificată ${day(n.updated)}` : ''].filter(Boolean).join(' · ');
  // Pozele intră în fișier (ca „data:”), deci .md-ul rămâne un singur fișier; Obsidian, Typora și VS Code le arată.
  const extra = [
    n.secret ? '*🔒 Notiță blocată cu parolă: conținutul nu se exportă.*' : '',
    n.files?.length ? `📎 Atașamente: ${n.files.map((f) => f.name).join(', ')}` : '',
    ...[...(n.images ?? []), ...boxImages(n.boxes)].map((src, i) => `![Poza ${i + 1}](${src})`),
  ].filter(Boolean).join('\n\n');
  return `# ${n.title.trim() || 'Fără titlu'}\n\n${meta ? `*${meta}*\n\n` : ''}${body}${body && extra ? '\n\n' : ''}${extra}\n`;
}

/** Toate notițele într-un singur fișier, cele fixate primele, despărțite de o linie. */
export function notesToMarkdown(notes: Note[]): string {
  const sorted = [...notes].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updated.localeCompare(a.updated));
  return sorted.map(noteToMarkdown).join('\n---\n\n');
}
