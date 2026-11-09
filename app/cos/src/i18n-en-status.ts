// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
import type { Pattern } from './i18n';
import { EN_SHEETS_STATUS } from './i18n-en-sheets-status';
import { SHEETS_STATUS_PATTERNS } from './i18n-en-sheets-status2';
import { SHEETS_STATUS3_PATTERNS } from './i18n-en-sheets-status3';
import { SHEETS_STATUS4_PATTERNS } from './i18n-en-sheets-status4';
import { SHEETS_STATUS5_PATTERNS } from './i18n-en-sheets-status5';
import { EN_NOTES_STATUS, NOTES_STATUS_PATTERNS } from './i18n-en-notes-status';
import { EN_SLIDES_STATUS, SLIDES_STATUS_PATTERNS } from './i18n-en-slides-status';
import { EN_VIDEO_STATUS } from './i18n-en-video-status';
import { EN_VIDEO_STATUS2, VIDEO_STATUS_PATTERNS } from './i18n-en-video-status2';
import { EN_IMAGES_STATUS, IMAGES_STATUS_PATTERNS } from './i18n-en-images-status';
// Dicționarul englez pentru barele de stare (jos, în Docs, Sheets, PDF, Imagini și Notițe). Cuvintele scurte („din”, „cuvinte”)
// au aici sensul lor din bara de stare; i18n.ts îl folosește doar în `.statusbar`. Mesajele de stare (`{status}`) vin pe rând.
export const EN_STATUS: Record<string, string> = {
  // Docs
  'Pagina pe care e cursorul și câte pagini are documentul la tipărire (aproximativ). Click: Mergi la (Ctrl+G)': 'The page the cursor is on and how many pages the document has when printed (approximately). Click: Go To (Ctrl+G)',
  'Pagina': 'Page', 'din': 'of', 'cuvânt': 'word', 'cuvinte': 'words', 'caractere': 'characters',
  'Arată panoul cu comentarii și modificări': 'Show the pane with comments and changes',
  'Alege următorul text de completat dintre [ ] (F2)': 'Select the next text to fill in between [ ] (F2)',
  'câmp': 'field', 'câmpuri': 'fields', 'de completat · F2': 'to fill in · F2',
  'Schiță': 'Outline', 'Ciornă': 'Draft', 'Web': 'Web',
  'Schiță: doar titlurile documentului, pe niveluri, cu ▾ / ▸ ca să strângi sau să desfaci ce e sub ele (doar pe ecran)': 'Outline: only the headings of the document, by level, with ▾ / ▸ to collapse or expand what is under them (on screen only)',
  'Aspect web: textul pe toată lățimea ferestrei, fără foaie și margini (la tipărire rămân paginile). Click din nou: aspect pagină': 'Web Layout: the text across the whole window, without sheet and margins (printing keeps the pages). Click again: page layout',
  'Ciornă: doar textul, pe toată lățimea, fără antet, subsol, filigran și coloane, cu sfârșiturile de pagină ca linii punctate (bun la scris repede; la tipărire rămân paginile). Click din nou: aspect pagină': 'Draft: only the text, full width, without header, footer, watermark and columns, with page breaks as dotted lines (good for fast writing; printing keeps the pages). Click again: page layout',
  // Zoomul de jos (comun)
  'Zoom': 'Zoom', 'Micșorează': 'Zoom out', 'Mărește': 'Zoom in', 'Glisorul de zoom': 'Zoom slider', 'Înapoi la 100%': 'Back to 100%',
  'pagina': 'the page', 'tabelul': 'the table', 'textul notiței': 'the note text',
  'O pagină': 'One Page', 'O pagină: toată pagina încape pe ecran, de sus până jos': 'One Page: the whole page fits on screen, top to bottom',
  'Lățime': 'Width', 'Pagina cât toată lățimea ferestrei': 'The page as wide as the window',
  'Selecția': 'Selection', 'Zoom pe selecție: zona selectată umple fereastra (între 50% și 200%)': 'Zoom to Selection: the selected range fills the window (between 50% and 200%)',
  // Sheets
  'celulă completată': 'cell filled', 'celule completate': 'cells filled', 'Sumă': 'Sum', 'Medie': 'Average', 'Număr': 'Count',
  'Filtru': 'Filter', 'se văd': 'showing', 'rânduri': 'rows',
  'Calculează (F9)': 'Calculate (F9)', 'Calcul: manual': 'Calculation: manual', 'Calcul: automat': 'Calculation: automatic',
  'În calculul manual formulele nu se refac singure: clic (sau F9) ca să le recalculezi': 'In manual calculation formulas do not update by themselves: click (or F9) to recalculate them',
  'Opțiuni de calcul: automat (formulele se refac la fiecare schimbare) sau manual (doar la F9). Se păstrează în fișier și în .xlsx.': 'Calculation options: automatic (formulas update at every change) or manual (only on F9). Kept in the file and in .xlsx.',
  'Iterativ': 'Iterative',
  'Calculul iterativ: formulele care depind de ele însele (referințe circulare, de exemplu un comision calculat din total) se calculează pe rând, până nu se mai schimbă': 'Iterative calculation: formulas that depend on themselves (circular references, for example a commission calculated from the total) are calculated in turns until they stop changing',
  'Se salvează…': 'Saving…', 'Nesalvat': 'Not saved',
  // PDF
  'Ctrl + rotița mouse-ului: mărire': 'Ctrl + mouse wheel: zoom',
  // Imagini
  'Pixeli reali (Ctrl 1)': 'Actual pixels (Ctrl 1)', 'Potrivește': 'Fit', 'Toată poza în fereastră (Ctrl 0)': 'The whole picture in the window (Ctrl 0)',
  'Rotește vederea la stânga': 'Rotate view left', 'Rotește vederea la dreapta': 'Rotate view right', 'Îndreaptă vederea': 'Straighten view',
  'Rotește vederea la stânga cu 15° (doar pe ecran, poza nu se schimbă; Shift+R)': 'Rotate the view 15° left (on screen only, the picture does not change; Shift+R)',
  'Rotește vederea la dreapta cu 15° (doar pe ecran, poza nu se schimbă; R)': 'Rotate the view 15° right (on screen only, the picture does not change; R)',
  'Vederea e rotită; click o îndreaptă la loc (Shift+Alt+R)': 'The view is rotated; click straightens it (Shift+Alt+R)',
  'Navigator: miniatura pozei; tragi dreptunghiul roșu ca să vezi altă parte, glisorul schimbă zoomul': 'Navigator: picture thumbnail; drag the red rectangle to see another part, the slider changes the zoom',
  'Ecran complet': 'Full Screen', 'Poza și uneltele pe tot ecranul, fără bara aplicației (F; Esc iese)': 'The picture and tools on the whole screen, without the app bar (F; Esc exits)',
  'Trage de poză (sau ține Spațiu) ca s-o muți': 'Drag the picture (or hold Space) to move it',
  'Trage colțurile sau mută chenarul; Enter aplică, Esc renunță': 'Drag the corners or move the frame; Enter applies, Esc cancels',
  'Micșorează (Ctrl −, Ctrl + rotița)': 'Zoom out (Ctrl −, Ctrl + wheel)', 'Mărește (Ctrl +, Ctrl + rotița)': 'Zoom in (Ctrl +, Ctrl + wheel)',
  // Mesajele de stare din Docs
  'Documentul nu are text de citit.': 'The document has no text to read.', 'Deschis': 'Opened',
  'Document nou (nesalvat): salvează-l cu Ctrl+S.': 'New document (not saved): save it with Ctrl+S.',
  'Documentul tău nesalvat e tot aici.': 'Your unsaved document is still here.',
  'Urmărirea e blocată: deblochează-o întâi cu 🔒': 'Tracking is locked: unlock it first with 🔒',
  'Urmărirea modificărilor e pornită: ce scrii apare verde, ce ștergi rămâne tăiat': 'Track Changes is on: what you type appears green, what you delete stays struck through',
  'Urmărirea modificărilor e oprită': 'Track Changes is off',
  'Urmărirea e blocată: rămâne pornită, iar modificările nu se pot accepta sau respinge până la deblocare': 'Tracking is locked: it stays on, and changes cannot be accepted or rejected until it is unlocked',
  'Urmărirea e deblocată': 'Tracking is unlocked',
  'Alege întâi textul pe care vrei să-l comentezi': 'First select the text you want to comment on',
  'Nu mai sunt câmpuri [ ] de completat': 'There are no more [ ] fields to fill in',
  'Trimiterile sunt la zi': 'Cross-references are up to date',
  'Se pregătește fișierul .docx…': 'Preparing the .docx file…', 'Se citește fișierul .docx…': 'Reading the .docx file…',
  'Protejat: orice schimbare se urmărește, iar modificările nu se pot accepta sau respinge până la oprirea protecției (🔒)': 'Protected: every change is tracked, and changes cannot be accepted or rejected until protection is turned off (🔒)',
  'Protecția e oprită: documentul se poate modifica din nou': 'Protection is off: the document can be edited again',
  'doar citire': 'read only', 'doar comentarii': 'comments only',
  'Fișierul era deteriorat și a fost reparat: s-a adus tot ce era întreg.': 'The file was damaged and has been repaired: everything intact was brought in.',
  'documentul era prea complicat: s-a adus doar textul, fără formatare': 'the document was too complex: only the text was brought in, without formatting',
  'unele detalii de formatare nu au putut fi păstrate': 'some formatting details could not be kept',
  'unul sub altul (listă)': 'one below the other (list)', 'fiecare de la pagină nouă': 'each on a new page',
  // Notițe
  'notiță': 'note', 'notițe': 'notes',
  ...EN_SHEETS_STATUS,
  ...EN_NOTES_STATUS,
  ...EN_SLIDES_STATUS,
  ...EN_VIDEO_STATUS,
  ...EN_VIDEO_STATUS2,
  ...EN_IMAGES_STATUS,
};

/** Tiparele din barele de stare (număr + cuvânt într-un singur text). Fără „\”: parantezele și cifrele ca [(] și [0-9]. */
export const STATUS_PATTERNS: Pattern[] = [
  ...SHEETS_STATUS_PATTERNS,
  ...SHEETS_STATUS3_PATTERNS,
  ...SHEETS_STATUS4_PATTERNS,
  ...SHEETS_STATUS5_PATTERNS,
  ...NOTES_STATUS_PATTERNS,
  ...SLIDES_STATUS_PATTERNS,
  ...VIDEO_STATUS_PATTERNS,
  ...IMAGES_STATUS_PATTERNS,
  [/^Am ales (\d+) bucăți de text cu aceeași formatare[.]$/s, 'Selected $R1 pieces of text with the same formatting.'],
  [/^Am ales 1 bucată de text cu aceeași formatare[.]$/s, 'Selected 1 piece of text with the same formatting.'],
  [/^Micșorează (.+) pe ecran [(]Ctrl [+] rotița mouse-ului[)]$/s, 'Zoom out $1 on screen (Ctrl + mouse wheel)'],
  [/^Mărește (.+) pe ecran [(]Ctrl [+] rotița mouse-ului[)]$/s, 'Zoom in $1 on screen (Ctrl + mouse wheel)'],
  [/^Trage ca să mărești sau să micșorezi (.+) [(]între 50% și 200%[)]$/s, 'Drag to zoom $1 in or out (between 50% and 200%)'],
  [/^([0-9]+) modificare$/s, '$1 change'], [/^([0-9]+) modificări$/s, '$1 changes'],
  [/^([0-9]+) comentariu$/s, '$1 comment'], [/^([0-9]+) comentarii$/s, '$1 comments'],
  [/^([0-9]+) pagină$/s, '$1 page'], [/^([0-9]+) pagini$/s, '$1 pages'],
  [/^([0-9]+) selectate [(]Ctrl[+]click [/] Shift[+]click în miniaturi[)]$/s, '$1 selected (Ctrl+click / Shift+click in thumbnails)'],
  [/^([0-9]+) găsite$/s, '$1 found'], [/^([0-9]+) în arhivă$/s, '$1 archived'],
  [/^([0-9]+) cuvânt$/s, '$1 word'], [/^([0-9]+) cuvinte$/s, '$1 words'],
  // Mesajele de stare din Docs (numele fișierelor și textele utilizatorului rămân cum sunt: $R)
  [/^Fișierul nu mai există sau nu poate fi deschis: (.+)$/s, 'The file no longer exists or cannot be opened: $R1'],
  // Numele șablonului se traduce; un nume necunoscut (șablon făcut de utilizator) rămâne cum e, prin tiparul de dedesubt.
  [/^Șablon: (.+)[.] Scrie peste textele dintre .{3}; F2 te duce la următorul[.]$/s, 'Template: $1. Type over the texts between [ ]; F2 takes you to the next one.'],
  [/^Șablon: (.+)[.] Scrie peste textele dintre .{3}; F2 te duce la următorul[.]$/s, 'Template: $R1. Type over the texts between [ ]; F2 takes you to the next one.'],
  [/^Trimiteri actualizate: ([0-9]+)$/s, 'Cross-references updated: $R1'],
  [/^([0-9]+) trimiteri duc la un loc care nu mai există$/s, '$R1 cross-references lead to a place that no longer exists'],
  [/^PDF salvat: (.+)$/s, 'PDF saved: $R1'],
  [/^Document [.]docx salvat cu parolă: (.+)$/s, '.docx document saved with password: $R1'],
  [/^Document [.](docx|odt|rtf) salvat: (.+)$/s, '.$R1 document saved: $R2'],
  [/^Text salvat: (.+)$/s, 'Text saved: $R1'], [/^Pagina web salvată: (.+)$/s, 'Web page saved: $R1'],
  [/^Protejat: (doar citire|doar comentarii)(, cu parolă)?[.] Salvează ca să rămână așa[.]$/s,
    (m, tr) => `Protected: ${tr(m[1])}${m[2] ? ', with password' : ''}. Save to keep it that way.`],
  [/^Ai deschis versiunea din (.+)[.] Salvează ca s-o păstrezi [(]Ctrl[+]Z te întoarce[)]$/s, 'You opened the version from $R1. Save to keep it (Ctrl+Z takes you back)'],
  [/^Am făcut ([0-9]+) (exemplar|exemplare), (.+)[.] Salvează, tipărește sau fă PDF [(]Ctrl[+]Z te întoarce la model[)]$/s,
    (m, tr) => `I made ${m[1]} ${m[2] === 'exemplar' ? 'copy' : 'copies'}, ${tr(m[3])}. Save, print or make a PDF (Ctrl+Z takes you back to the template)`],
  [/^(Fișierul era deteriorat și a fost reparat: s-a adus tot ce era întreg[.] )?Importat din (.+?)(, cu (.+?))?( [(](.+)[)])?[.] Salvează cu Ctrl[+]S[.]$/s,
    (m, tr) => `${m[1] ? tr(m[1].trim()) + ' ' : ''}Imported from ${m[2]}${m[4] ? ', with ' + m[4].split(' și ').map(tr).join(' and ') : ''}${m[6] ? ' (' + tr(m[6]) + ')' : ''}. Save with Ctrl+S.`],
  [/^([0-9]+) modificare urmărită$/s, '$R1 tracked change'], [/^([0-9]+) modificări urmărite$/s, '$R1 tracked changes'],
  [/^Salvat la ([0-9:]+)$/s, 'Saved at $1'],
];
