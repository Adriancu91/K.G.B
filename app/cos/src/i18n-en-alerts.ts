// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Ferestrele mici de mesaj (alert / confirm) în engleză. Partea 1: mesajele fixe din toate aplicațiile.
// Mesajele pe mai multe rânduri se traduc rând cu rând (translateMsg din i18n.ts), deci fiecare rând e o intrare separată.
import type { Pattern } from './i18n';
import { valRuleEn } from './i18n-en-sheets-status5';

export const EN_ALERTS: Record<string, string> = {
  // Notițe
  'Într-o notiță blocată cu parolă nu se pot pune poze. Scoate întâi parola.': 'You cannot add pictures to a password-locked note. Remove the password first.',
  'Într-o notiță blocată cu parolă nu se pot atașa PDF-uri. Scoate întâi parola.': 'You cannot attach PDFs to a password-locked note. Remove the password first.',
  'Într-o notiță blocată cu parolă nu se pot atașa fișiere. Scoate întâi parola.': 'You cannot attach files to a password-locked note. Remove the password first.',
  'Într-o notiță blocată cu parolă nu se pot pune înregistrări. Scoate întâi parola.': 'You cannot add recordings to a password-locked note. Remove the password first.',
  'Înregistrarea nu s-a putut păstra.': 'The recording could not be kept.',
  // PDF
  'Pagina nu are text de citit (dacă e scanată, folosește întâi „Text din scanare”).': 'The page has no text to read (if it is scanned, use “Text from Scan” first).',
  'Elementele puse pe pagină nu au putut fi pregătite.': 'The items placed on the page could not be prepared.',
  'Pagina nu a putut fi salvată ca poză.': 'The page could not be saved as a picture.',
  'Paginile nu au putut fi salvate ca TIFF.': 'The pages could not be saved as TIFF.',
  'Niciunul dintre PDF-uri nu are text (sunt scanări). Compararea merge doar pe text.': 'None of the PDFs has text (they are scans). Comparing works only on text.',
  'PDF-ul nu are text (paginile sunt scanări sau poze). Folosește întâi „Text din scanare…”, apoi copiază textul în Docs.': 'The PDF has no text (the pages are scans or pictures). First use “Text from Scan…”, then copy the text to Docs.',
  'Textul PDF-ului nu a putut fi citit.': 'The text of the PDF could not be read.',
  'PDF-ul nu are text (paginile sunt scanări sau poze). Folosește întâi „Text din scanare…”, apoi salvează din nou.': 'The PDF has no text (the pages are scans or pictures). First use “Text from Scan…”, then save again.',
  'Nu am găsit text de pus în tabel.': 'I found no text to put in the table.',
  'Nu am găsit tabele în PDF, așa că fiecare rând de text devine un rând în tabel.': 'I found no tables in the PDF, so each line of text becomes a row in the table.',
  'Textul PDF-ului nu a putut fi salvat.': 'The text of the PDF could not be saved.',
  'Imaginile PDF-ului nu au putut fi citite.': 'The images of the PDF could not be read.',
  'PDF-ul nu are text (paginile sunt scanări sau poze). Folosește întâi „Fă PDF-ul căutabil”, apoi încearcă din nou.': 'The PDF has no text (the pages are scans or pictures). First use “Make PDF Searchable”, then try again.',
  'Nu am găsit tabele în PDF, așa că fiecare rând de text devine un rând în Sheets.': 'I found no tables in the PDF, so each line of text becomes a row in Sheets.',
  'Tabelele PDF-ului nu au putut fi citite.': 'The tables of the PDF could not be read.',
  'Paginile PDF-ului nu au putut fi puse într-o prezentare.': 'The pages of the PDF could not be put into a presentation.',
  'Documentul nu a putut fi pregătit pentru tipărire.': 'The document could not be prepared for printing.',
  'Imaginea nu s-a putut citi. Încearcă un fișier PNG sau JPG.': 'The image could not be read. Try a PNG or JPG file.',
  'Imaginea nu s-a putut citi. Încearcă un fișier JPG sau PNG.': 'The image could not be read. Try a JPG or PNG file.',
  'Nu mai e loc pentru încă o ștampilă. Șterge una dintre ștampilele tale.': 'There is no room for another stamp. Delete one of your stamps.',
  'Fișierul e prea mare (peste 50 MB) ca să fie pus într-un comentariu.': 'The file is too large (over 50 MB) to be put in a comment.',
  'Modificările nesalvate se scriu întâi în PDF, iar asta rescrie fișierul: semnăturile de acum nu mai rămân valabile. Continui?': 'The unsaved changes are first written into the PDF, and this rewrites the file: the current signatures will no longer be valid. Continue?',
  'Modificările nu au putut fi scrise în PDF înainte de semnare.': 'The changes could not be written into the PDF before signing.',
  'Scrie parola de permisiuni ca să scoți restricțiile.': 'Type the permissions password to remove the restrictions.',
  'Un PDF trebuie să aibă cel puțin o pagină.': 'A PDF must have at least one page.',
  'Poza aleasă nu se poate citi. Încearcă un JPG sau un PNG.': 'The chosen picture cannot be read. Try a JPG or a PNG.',
  'În clipboard nu e nicio poză și niciun text. Copiază ceva (de exemplu o captură de ecran cu Win+Shift+S) și încearcă din nou.': 'There is no picture and no text on the clipboard. Copy something (for example a screenshot with Win+Shift+S) and try again.',
  'Valorile din formular nu au putut fi scrise în PDF.': 'The form values could not be written into the PDF.',
  'PDF-ul nu s-a putut salva peste fișierul vechi (poate e deschis în alt program sau e doar pentru citire).': 'The PDF could not be saved over the old file (maybe it is open in another program or it is read-only).',
  'Îl salvezi ca fișier nou?': 'Save it as a new file?',
  'Ștergi ID-ul digital de pe acest calculator? PDF-urile semnate deja rămân semnate, dar nu mai poți semna cu el.': 'Delete the digital ID from this computer? PDFs already signed stay signed, but you can no longer sign with it.',
  'Formular XFA (ca declarațiile ANAF): scrie direct în câmpuri, apoi Tipărește sau „Salvează ca…”. Butoanele lui (Validează, XML) nu funcționează aici. Paginile lui nu se pot modifica (rotire, ștergere, semnătură pusă pe pagină).':
    'XFA form (like tax returns): type directly in the fields, then Print or “Save As…”. Its buttons (Validate, XML) do not work here. Its pages cannot be changed (rotate, delete, signature placed on the page).',
  'PDF-ul e protejat (criptat): îl poți citi, căuta, tipări și completa formularele. Ca să-i modifici paginile (rotire, ștergere, semnătură…), apasă „Elimină parola”.':
    'The PDF is protected (encrypted): you can read, search, print it and fill in the forms. To change its pages (rotate, delete, signature…), press “Remove Password”.',
  'PDF-ul ales are parolă: alege unul fără parolă pentru filigran.': 'The chosen PDF has a password: choose one without a password for the watermark.',
  'PDF-ul ales nu se poate citi.': 'The chosen PDF cannot be read.', 'Modificarea nu a reușit.': 'The change did not succeed.',
  // Sheets
  'Scrie valorile listei proprii, în ordine, despărțite prin virgulă.': 'Type the values of your own list, in order, separated by commas.',
  'Scrie valoarea pentru condiție.': 'Type the value for the condition.',
  'Lasă bifată măcar o valoare, altfel tabelul ar rămâne gol.': 'Leave at least one value checked, otherwise the table would be empty.',
  'Valoare neobișnuită': 'Unusual value',
  // Video
  'Sunetul are peste 5 MB: alege unul mai scurt.': 'The sound is over 5 MB: choose a shorter one.',
  'Fișierul ales nu e un sunet.': 'The chosen file is not a sound.',
  'Înlocuiesc proiectul video deschis cu prezentarea din Slides?': 'Replace the open video project with the presentation from Slides?',
  'Înregistrarea video nu e disponibilă aici.': 'Video recording is not available here.',
  'În fișier nu am găsit subtitrări (format .srt).': 'I found no subtitles in the file (.srt format).',
};

// Partea 2: ferestrele cu nume de fișiere, numere sau mesajul unei erori (care se traduce și el, dacă se cunoaște).

Object.assign(EN_ALERTS, {
  'Fișierul nu mai există sau nu poate fi deschis': 'The file no longer exists or cannot be opened', 'fel necunoscut': 'unknown type',
});
const FAILED: Record<string, string> = {
  'Comentariile nu s-au putut exporta': 'The comments could not be exported', 'Rezumatul nu s-a putut face': 'The summary could not be made',
  'Datele formularului nu s-au putut salva': 'The form data could not be saved', 'Răspunsurile nu s-au putut aduna': 'The answers could not be collected',
  'Câmpurile nu s-au putut citi': 'The fields could not be read', 'Parola nu s-a putut elimina': 'The password could not be removed',
  'Efectul nu s-a putut aplica': 'The effect could not be applied', 'Corecția nu s-a putut aplica': 'The correction could not be applied',
};
const GONE: Record<string, string> = { 'Fișierul': 'The file', 'PDF-ul': 'The PDF', 'Înregistrarea': 'The recording' };
const re = (s: string) => new RegExp('^' + s + '$', 's');

export const ALERT_PATTERNS: Pattern[] = [
  [re('Cyber Office Studio nu știe să deschidă „(.+)”[.] Merg documente, tabele, prezentări, PDF, poze, clipuri, sunete și proiecte video[.]'),
    'Cyber Office Studio cannot open “$R1”. Documents, spreadsheets, presentations, PDF, pictures, clips, sounds and video projects work.'],
  [re('(.+)”: clipurile se deschid din aplicația instalată'), '$R1”: clips open in the installed app'],
  [re('(.+)” nu poate fi deschis: (.+)'), (m, tr) => `${m[1]}” cannot be opened: ${tr(m[2])}`],
  [re('Prea mari [(]maximum ([0-9]+) MB[)]: (.+)'), 'Too large (maximum $R1 MB): $R2'],
  [re('Imaginea „(.+)” nu a putut fi deschisă[.]'), 'The image “$R1” could not be opened.'],
  [re('O notiță poate avea cel mult ([0-9]+) poze[.]'), 'A note can have at most $R1 pictures.'],
  [re('O notiță poate avea cel mult ([0-9]+) atașamente[.]'), 'A note can have at most $R1 attachments.'],
  [re('(.+)” are peste ([0-9]+) MB și nu se poate atașa[.]'), '$R1” is over $R2 MB and cannot be attached.'],
  [re('Fișierul are peste ([0-9]+) MB și nu se poate atașa[.]'), 'The file is over $R1 MB and cannot be attached.'],
  [re('(.+)” nu e un PDF[.]'), '$R1” is not a PDF.'], [re('(.+)” nu s-a putut atașa[.]'), '$R1” could not be attached.'],
  [re('Au intrat primele ([0-9]+) pagini din ([0-9]+) [(]o notiță are cel mult ([0-9]+) poze[)][.]'), 'The first $R1 pages of $R2 went in (a note has at most $R3 pictures).'],
  [re('Paginile din „(.+)” nu au putut fi puse în notiță[.]'), 'The pages of “$R1” could not be put in the note.'],
  [re('(Fișierul|PDF-ul|Înregistrarea) „(.+)” nu mai e lângă caiet [(]dosarul (.+)[)][.]'),
    (m) => `${GONE[m[1]]} “${m[2]}” is no longer next to the notebook (the ${m[3]} folder).`],
  [re('PDF-ul are ([0-9]+) pagini; în prezentare intră primele ([0-9]+)[.]'), 'The PDF has $R1 pages; the first $R2 go into the presentation.'],
  [re('Ai deja ([0-9]+) ștampile[.] Șterge una ca să adaugi alta[.]'), 'You already have $R1 stamps. Delete one to add another.'],
  [re('Am adunat răspunsurile din ([0-9]+) (formular|formulare) în (.+?)(?: [(]([0-9]+) fără câmpuri sau care nu s-au putut citi: (.+)[)])?[.] Îl deschizi în Sheets cu Import [.]csv[.]'),
    (m) => `I collected the answers from ${m[1]} ${m[1] === '1' ? 'form' : 'forms'} in ${m[3]}${m[4] ? ` (${m[4]} without fields or unreadable: ${m[5]})` : ''}. Open it in Sheets with Import .csv.`],
  [re('(' + Object.keys(FAILED).join('|') + '): (.+)'), (m, tr) => `${FAILED[m[1]]}: ${tr(m[2])}`],
  // Fereastra de avertisment a validării din Sheets (titlu, regula, întrebarea).
  [re('Aici se primește doar (.+)[.]'), (m) => { const r = valRuleEn(m[1]); return r ? `Only ${r} is accepted here.` : m[0]; }],
  [re('Păstrezi totuși „(.+)”[?]'), 'Keep “$R1” anyway?'],
];
