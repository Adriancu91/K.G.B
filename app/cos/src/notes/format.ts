// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Formatul fișierelor .snote. Câmpul `version` ne lasă să schimbăm formatul mai târziu.
export interface NoteDoc {
  format: 'suite-note';
  version: 1;
  title: string;
  body: string;
  updatedAt: string;
}

export function emptyNote(): NoteDoc {
  return { format: 'suite-note', version: 1, title: '', body: '', updatedAt: new Date().toISOString() };
}

export function parseNote(text: string): NoteDoc {
  const data = JSON.parse(text);
  if (data?.format !== 'suite-note') throw new Error('Fișierul nu este o notiță Cyber Office Studio.');
  return { ...emptyNote(), title: String(data.title ?? ''), body: String(data.body ?? ''), updatedAt: String(data.updatedAt ?? '') };
}

export function serializeNote(note: NoteDoc): string {
  return JSON.stringify({ ...note, updatedAt: new Date().toISOString() }, null, 2);
}

export function safeFileName(title: string): string {
  const clean = title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim().slice(0, 80);
  return clean || 'Notiță';
}
