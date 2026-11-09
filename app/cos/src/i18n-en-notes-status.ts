// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Mesajele de stare din Notițe (jos, în bara de stare), în engleză. Titlurile notițelor, secțiunile, caietele și etichetele rămân cum sunt ($R).
import type { Pattern } from './i18n';

export const EN_NOTES_STATUS: Record<string, string> = {
  'Ecranul întreg nu e disponibil aici.': 'Full screen is not available here.',
  'Notița blocată s-a închis singură (câteva minute fără activitate).': 'The locked note closed by itself (a few minutes without activity).',
  'Notița e blocată cu parolă.': 'The note is locked with a password.', 'Notița e deja pagină de sus.': 'The note is already a top-level page.',
  'Nu s-a putut salva caietul de notițe!': 'The notebook could not be saved!', 'Poza nu s-a putut roti.': 'The picture could not be rotated.',
  'Se aduc notițele…': 'Loading the notes…', 'Textul din poză a fost copiat.': 'The text from the picture was copied.', 'Înregistrarea e goală.': 'The recording is empty.',
  'Lista e acum în „Ordinea mea”: notițele rămân unde le-ai tras.': 'The list is now in “My order”: notes stay where you dragged them.',
  'Nu e nimic de refăcut.': 'There is nothing to redo.', 'Nu e nimic de anulat.': 'There is nothing to undo.',
  'Refăcut (Ctrl+Y).': 'Redone (Ctrl+Y).', 'Anulat (Ctrl+Z). Ctrl+Y reface.': 'Undone (Ctrl+Z). Ctrl+Y redoes.',
  'Notița nu mai e în nicio secțiune.': 'The note is no longer in any section.', 'Notiță nouă.': 'New note.',
  'Subpagina a urcat un nivel.': 'The subpage moved up one level.', 'Notița e acum pagină de sus.': 'The note is now a top-level page.',
  'Notița e în Arhivă (o găsești la căutare sau la 🗄 Arhivă).': 'The note is in the Archive (find it by searching or under 🗄 Archive).',
  'Notița a ieșit din Arhivă.': 'The note left the Archive.',
  'Elementele bifate coboară singure la sfârșitul listei.': 'Checked items move to the end of the list by themselves.',
  'Elementele bifate rămân pe loc.': 'Checked items stay in place.',
};

export const NOTES_STATUS_PATTERNS: Pattern[] = [
  [/^(Clipul video|Înregistrarea) [(]([0-9:]+)[)] a intrat în notiță[.]$/s, (m) => `The ${m[1] === 'Clipul video' ? 'video clip' : 'recording'} (${m[2]}) was added to the note.`],
  [/^Am copiat legătura .{2}(.*).{2}: lipește-o în altă notiță[.]$/s, 'I copied the link [[$R1]]: paste it in another note.'],
  [/^Am făcut o copie: „(.*)”[.]$/s, 'I made a copy: “$R1”.'],
  [/^Caietul „(.*)” e deschis[.] Notițele noi intră în el[.]$/s, 'The notebook “$R1” is open. New notes go into it.'],
  [/^Copia „(.*)” e salvată[.]$/s, 'The copy “$R1” is saved.'],
  [/^Eticheta #(.+) a fost scoasă[.]$/s, 'The tag #$R1 was removed.'],
  [/^Eticheta #(.+) se numește acum #(.+)[.]$/s, 'The tag #$R1 is now called #$R2.'],
  [/^Notița e acum subpagină a „(.*)”[.]$/s, 'The note is now a subpage of “$R1”.'],
  [/^Notița e acum în caietul „(.*)”[.]$/s, 'The note is now in the notebook “$R1”.'],
  [/^Notița e acum în secțiunea „(.*)”[.]$/s, 'The note is now in the section “$R1”.'],
  [/^Notița „(.*)” a revenit din coș[.]$/s, 'The note “$R1” is back from the trash.'],
  [/^Notița „(.*)” e în 🗑 Coș [(]o poți readuce ([0-9]+) de zile[)][.]$/s, 'The note “$R1” is in the 🗑 Trash (you can bring it back for $R2 days).'],
  [/^Notiță nouă: „(.*)”[.]$/s, 'New note: “$R1”.'],
  [/^Subpagină nouă sub „(.*)”[.]$/s, 'New subpage under “$R1”.'],
  [/^Grupul se numește acum „(.*)”[.]$/s, 'The group is now called “$R1”.'],
  [/^Grupul „(.*)” s-a desfăcut; secțiunile lui au rămas[.]$/s, 'The group “$R1” was ungrouped; its sections stayed.'],
  [/^Am copiat notița în secțiunea „(.*)”[.]$/s, 'I copied the note to the section “$R1”.'],
  [/^Am copiat notița în afara secțiunilor[.]$/s, 'I copied the note outside the sections.'],
  [/^Am copiat notița în caietul „(.*)”[.]$/s, 'I copied the note to the notebook “$R1”.'],
  [/^(.+)” există deja[.]$/s, '$R1” already exists.'],
];
