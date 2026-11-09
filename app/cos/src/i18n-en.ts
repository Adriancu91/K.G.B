// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Dicționarul română → engleză al interfeței (PLAN, „Finalul cerut” b). Cheia e textul românesc exact, așa cum apare pe ecran
// (fără pictograma din față și fără „▾” / „…” de la capăt, pe care i18n.ts le păstrează singur). Termenii englezești sunt
// cei obișnuiți în programele de birou, ca utilizatorul să-i recunoască. Dicționarele pe aplicații stau în i18n-en-<aplicație>.ts.
import { EN_SHEETS } from './i18n-en-sheets';
import { EN_DOCS } from './i18n-en-docs';
import { EN_SLIDES } from './i18n-en-slides';
import { EN_NOTES } from './i18n-en-notes';
import { EN_PDF } from './i18n-en-pdf';
import { EN_HOME } from './i18n-en-home';

export const EN: Record<string, string> = {
  ...EN_SHEETS,
  ...EN_DOCS,
  ...EN_SLIDES,
  ...EN_NOTES,
  ...EN_PDF,
  ...EN_HOME,
  // Rama aplicației: bara din stânga, taburile, tema.
  'Acasă': 'Home', 'Notițe': 'Notes', 'Imagini': 'Images', 'Aplicații': 'Apps', 'În lucru': 'In progress',
  'Fișiere recente și toate aplicațiile': 'Recent files and all apps',
  'Notițe rapide, liste, idei': 'Quick notes, lists, ideas',
  'Documente, scrisori, contracte': 'Documents, letters, contracts',
  'Gata': 'Done',
  'Tabele, calcule, grafice': 'Tables, calculations, charts',
  'Citire, adnotare, semnare PDF': 'Read, annotate and sign PDF',
  'Editare poze': 'Photo editing', 'Prezentări': 'Presentations',
  'Slideshow din poze, montaj video': 'Photo slideshows, video editing',
  'Trimite o observație': 'Send feedback',
  'Scrii ce nu merge; se salvează pe calculator, cu o poză a ferestrei, ca să le trimiți tu': 'Describe what is not working; it is saved on this computer with a picture of the window, so you can send it yourself',
  'Lărgește bara (cu numele aplicațiilor)': 'Widen the bar (with app names)',
  'Strânge bara (doar pictogramele), ca să ai mai mult loc': 'Collapse the bar (icons only) for more room',
  'Lărgește bara din stânga': 'Widen the left bar', 'Strânge bara din stânga': 'Collapse the left bar',
  'Tema': 'Theme', 'Temă': 'Theme', 'luminoasă': 'light', 'automată (după sistem)': 'automatic (system)', 'întunecată': 'dark',
  'Limba': 'Language',
  'Aplicații deschise': 'Open apps', 'Tab nou': 'New tab', 'nesalvat': 'unsaved', 'Închide tabul (Ctrl+W)': 'Close tab (Ctrl+W)',
  'Tab nou: alegi aplicația (Ctrl+Alt+T; pe Acasă și Ctrl+T)': 'New tab: choose the app (Ctrl+Alt+T; on Home also Ctrl+T)',
  'Compară': 'Compare', 'Derulare împreună': 'Synchronous scrolling', 'Un singur tab': 'Single tab',
  'Document nou': 'New document', 'Tabel nou': 'New workbook', 'Prezentare nouă': 'New presentation', 'Salvare automată': 'AutoSave',
  // Panglica comună.
  'Fișier': 'File', 'Meniu': 'Menu', 'Caută o comandă': 'Search for a command', 'Bara rapidă': 'Quick Access Toolbar', 'Meniuri': 'Menus',
  'Înapoi': 'Back', 'Recente': 'Recent', 'Niciun fișier deschis de curând.': 'No recently opened files.',
  'Înapoi la document (Esc)': 'Back to the document (Esc)',
  'Caută orice comandă după nume și o pornește (Alt+Q sau Ctrl+Shift+P)': 'Find any command by name and run it (Alt+Q or Ctrl+Shift+P)',
  'Arată panglica tot timpul (Ctrl+F1)': 'Always show the ribbon (Ctrl+F1)',
  'Strânge panglica: rămân doar numele filelor (Ctrl+F1)': 'Collapse the ribbon: only tab names remain (Ctrl+F1)',
  'Arată bara cu butoanele folosite des (Ctrl+F1)': 'Show the bar with frequently used buttons (Ctrl+F1)',
  'Ascunde bara cu butoanele folosite des: rămân doar meniurile (Ctrl+F1)': 'Hide the bar with frequently used buttons: only the menus remain (Ctrl+F1)',
  'Bara cu butoanele folosite des': 'Frequently used buttons', 'Mai mult': 'More', 'Mai multe': 'More',
  'Toate uneltele': 'All tools', 'Avansat': 'Advanced', 'Închide': 'Close',
  // Profilurile de meniu (▦ Aranjare).
  'Aranjare': 'Arrange', 'Panglică': 'Ribbon', 'Meniuri clasice': 'Classic menus', 'Aerisit': 'Airy', 'Simplu': 'Simple',
  'Unelte în stânga': 'Tools on the left', 'Panouri laterale': 'Side panels',
  'Aranjare: aceleași comenzi, așezate altfel pe ecran (se ține minte)': 'Arrange: the same commands, laid out differently on screen (remembered)',
  'Scrie': 'Write', 'Inserează': 'Insert', 'Calculează': 'Calculate', 'Vezi': 'View', 'Pagina': 'Page', 'Revizuiește': 'Review',
  'Prezintă': 'Present', 'Desenează': 'Draw',
  'Celelalte file, cu toate comenzile lor (se deschid în bara de dedesubt)': 'The other tabs, with all their commands (they open in the bar below)',
  // Filele.
  'Pornire': 'Home', 'Inserare': 'Insert', 'Aspect pagină': 'Page Layout', 'Formule': 'Formulas', 'Date': 'Data', 'Revizuire': 'Review',
  'Vizualizare': 'View', 'Proiectare tabel': 'Table Design', 'Proiectare diagramă': 'Chart Design', 'Proiectare': 'Design', 'Aspect': 'Layout',
  'Referințe': 'References', 'Corespondență': 'Mailings', 'Antet și subsol': 'Header & Footer', 'Tranziții': 'Transitions', 'Animații': 'Animations',
  'Expunere diapozitive': 'Slide Show', 'Desenare': 'Draw', 'Tabel': 'Table', 'Poză': 'Picture', 'Ajutor': 'Help', 'Ajustări': 'Adjustments',
  'Editare': 'Edit', 'Conversie': 'Convert', 'Semnătură': 'Signature', 'Formular': 'Form', 'Imagine': 'Image', 'Strat': 'Layer', 'Selectare': 'Select',
  'Filtru': 'Filter', 'Fereastră': 'Window', 'Text': 'Text', 'Câmp': 'Field', 'Începe': 'Start', 'Măsurare': 'Measure', 'Adăugare comentarii': 'Add comments',
  'Completare și semnare': 'Fill & Sign', 'Creare PDF': 'Create PDF', 'Editare PDF': 'Edit PDF', 'Organizare pagini': 'Organize pages',
  'Panouri și instantaneu': 'Panels and snapshot', 'Pregătire formular': 'Prepare form', 'Producție pentru imprimare': 'Print production',
  'Protejare PDF': 'Protect PDF', 'Scanare și OCR': 'Scan & OCR', 'Verificare și comparare': 'Check and compare',
  'Aa Text': 'Aa Text', 'Pagini': 'Pages', 'Muzică și sunete': 'Music and sounds', 'Semnează': 'Sign', 'Editează': 'Edit',
  'Elemente grafice': 'Graphics', 'Înregistrare': 'Record', 'Conținutul tău': 'Your media', 'Adnotează': 'Annotate',
  // Grupurile din panglici.
  'Accesibilitate': 'Accessibility', 'Adaugă': 'Add', 'Afișare': 'Show', 'Ajustare': 'Adjust', 'Ajutoare': 'Guides', 'Alege': 'Choose',
  'Aliniere': 'Alignment', 'Analiză': 'Analysis', 'Animație complexă': 'Advanced Animation', 'Animație': 'Animation',
  'Aspecte diagramă': 'Chart Layouts', 'Audit formule': 'Formula Auditing', 'Bibliotecă de funcții': 'Function Library', 'Borduri': 'Borders',
  'Calcul': 'Calculation', 'Cameră': 'Camera', 'Capitole': 'Chapters', 'Ce măsori': 'What to measure', 'Celule': 'Cells', 'Citire': 'Reading',
  'Citări și bibliografie': 'Citations & Bibliography', 'Clipboard': 'Clipboard', 'Coloane': 'Columns', 'Color / Tonuri de gri': 'Color / Grayscale',
  'Comentarii': 'Comments', 'Comentariu': 'Comment', 'Comparare': 'Compare', 'Completare': 'Fill', 'Completează': 'Fill in',
  'Configurare pagină': 'Page Setup', 'Configurare': 'Setup', 'Controale': 'Controls', 'Conținut': 'Content', 'Creare': 'Create', 'Creează': 'Create',
  'Cuprins': 'Table of Contents', 'Câmpuri': 'Fields', 'Desen': 'Drawing', 'Desenare borduri': 'Draw Borders', 'Diagrame': 'Charts',
  'Diapozitive': 'Slides', 'Dimensiune celulă': 'Cell Size', 'Dimensiune': 'Size', 'Durată': 'Duration', 'Ecran': 'Screen',
  'Etichete': 'Tags', 'Examinare rezultate': 'Preview Results', 'Examinare': 'Preview', 'Export': 'Export', 'Filtre': 'Filters',
  'Finalizare': 'Finish', 'Fișiere': 'Files', 'Foaie': 'Sheet', 'Folosește': 'Use', 'Font': 'Font', 'Formatare document': 'Document Formatting',
  'Forme': 'Shapes', 'Formă': 'Shape', 'Fundal pagină': 'Page Background', 'Ilustrații': 'Illustrations', 'Imersiv': 'Immersive', 'Index': 'Index',
  'Indiciu': 'Hint', 'Inițializare pagină': 'Page Setup', 'Instrumente de date': 'Data Tools', 'Instrumente': 'Tools', 'Istoric': 'History',
  'Legende': 'Captions', 'Linkuri': 'Links', 'Logo': 'Logo', 'Marcaj de timp': 'Time Stamp', 'Media': 'Media', 'Memento': 'Reminder',
  'Minidiagrame': 'Sparklines', 'Modifică': 'Modify', 'Modificări': 'Changes', 'Muzică': 'Music', 'Mărime': 'Size', 'Navigare': 'Navigation',
  'Note de subsol': 'Footnotes', 'Note': 'Notes', 'Notiță': 'Note', 'Nume definite': 'Defined Names', 'Număr': 'Number',
  'Opțiuni foaie': 'Sheet Options', 'Opțiuni stil tabel': 'Table Style Options', 'Opțiuni': 'Options', 'Ordine': 'Order', 'Ordinea Tab': 'Tab Order',
  'Organizează': 'Organize', 'Pagină': 'Page', 'Panouri': 'Panes', 'Paragraf': 'Paragraph', 'Particularizare': 'Customize', 'Pe grupuri': 'By groups',
  'Pe toate paginile': 'On all pages', 'Peste film': 'Overlay', 'Pornire expunere diapozitive': 'Start Slide Show', 'Poza': 'Picture',
  'Preluare și transformare date': 'Get & Transform Data', 'Prognoză': 'Forecast', 'Proprietăți': 'Properties', 'Protecție': 'Protection',
  'Protejare': 'Protect', 'Păstrează': 'Keep', 'Ramă': 'Frame', 'Reguli': 'Rules', 'Repede': 'Quick', 'Rezultat': 'Result', 'Rotire': 'Rotate',
  'Rânduri și coloane': 'Rows & Columns', 'Rânduri': 'Rows', 'Scalare pentru a se potrivi': 'Scale to Fit', 'Scanări': 'Scans', 'Scară': 'Scale',
  'Schiță': 'Draft', 'Scriere și inserare câmpuri': 'Write & Insert Fields', 'Simboluri': 'Symbols', 'Sortare și filtrare': 'Sort & Filter',
  'Stilouri': 'Pens', 'Stiluri text artistic': 'Text Art Styles', 'Stiluri diagramă': 'Chart Styles', 'Stiluri formă': 'Shape Styles',
  'Stiluri imagine': 'Picture Styles', 'Stiluri tabel': 'Table Styles', 'Stiluri': 'Styles', 'Strat nou': 'New layer', 'Sunete': 'Sounds',
  'Tabele': 'Tables', 'Teme': 'Themes', 'Temporizare': 'Timing', 'Text de bază': 'Basic Text', 'Text și fișiere': 'Text and files', 'Tip': 'Type',
  'Tipar': 'Print', 'Titluri': 'Headings', 'Toate': 'All', 'Transformare': 'Transform', 'Tranziție la acest diapozitiv': 'Transition to This Slide',
  'Treceri': 'Transitions', 'Umbrire': 'Shading', 'Unealta': 'Tool', 'Unelte': 'Tools', 'Unire': 'Combine', 'Urmărire': 'Tracking', 'Variante': 'Variants',
  'Verificare': 'Proofing', 'Verifică': 'Check', 'Vizualizări prezentare': 'Presentation Views', 'Vizualizări registru de lucru': 'Workbook Views',
  'Vizualizări': 'Views', 'Voce': 'Voice', 'Vorbire': 'Speech', 'Zoom': 'Zoom', 'Îmbinare': 'Merge', 'Începere îmbinare corespondență': 'Start Mail Merge',
  'Închidere': 'Close', 'Ștampile': 'Stamps', 'Șterge': 'Delete', 'Ștergere': 'Delete',
};

/** Numele tranzițiilor din Slides (au întâietate în galeria tranzițiilor: „Ștergere” e aici Wipe, nu Delete). */
export const EN_TRANSITIONS: Record<string, string> = {
  'Estompare': 'Fade', 'Împingere': 'Push', 'Ștergere': 'Wipe', 'Împărțire': 'Split', 'Acoperire': 'Cover', 'Descoperire': 'Uncover',
  'Apropiere': 'Zoom', 'Răsturnare': 'Flip', 'Vârtej': 'Vortex', 'Roată': 'Ferris Wheel', 'Galerie': 'Gallery', 'Uși': 'Doors', 'Cub': 'Cube', 'Cortine': 'Curtains', 'Pagină îndoită': 'Page Curl',
  'Transformare': 'Transform', 'Fără': 'None',
};
// Găsite de verificarea finală (tests/cdp/cdp-lang-sweep.mjs): titlurile taburilor, ale butoanelor de aranjare și cele din rama aplicațiilor.
Object.assign(EN, {
  'Slides: Prezentări': 'Slides: Presentations', 'Bara globală': 'Global bar',
  'Înapoi la notița deschisă înainte (Alt+←)': 'Back to the note opened before (Alt+←)', 'Înainte (Alt+→)': 'Forward (Alt+→)', 'Înainte': 'Forward', 'Înapoi': 'Back',
  'Anulează ultima schimbare din caiet: o notiță ștearsă, mutată, colorată, o bifă… (Ctrl+Z în afara textului)': 'Undo the last change in the notebook: a deleted, moved or colored note, a check mark… (Ctrl+Z outside the text)',
  'Refă': 'Redo', 'Salvează': 'Save', 'Salvează (Ctrl+S)': 'Save (Ctrl+S)', 'Anulează (Ctrl+Z)': 'Undo (Ctrl+Z)', 'Refă (Ctrl+Y)': 'Redo (Ctrl+Y)',
  'Fișier: nou, deschide, salvează, import, export, tipărește, proprietăți': 'File: new, open, save, import, export, print, properties',
  'Meniu: nou, deschide, salvează, comprimă, tipărește, proprietăți document': 'Menu: new, open, save, compress, print, document properties',
  'File cu butoane mari, grupate pe teme, deasupra tabelului (așezarea implicită)': 'Tabs with large buttons, grouped by topic, above the spreadsheet (the default layout)',
  'File cu butoane mari, grupate pe teme, deasupra documentului (așezarea implicită)': 'Tabs with large buttons, grouped by topic, above the document (the default layout)',
  'File cu butoane mari, grupate pe teme, deasupra prezentării (așezarea implicită)': 'Tabs with large buttons, grouped by topic, above the presentation (the default layout)',
  'File cu butoane mari, grupate pe teme, deasupra paginii (așezarea implicită)': 'Tabs with large buttons, grouped by topic, above the page (the default layout)',
  'Bara globală sus, panoul cu toate uneltele în stânga, miniaturile și panourile în dreapta (așezarea implicită)': 'Global bar at the top, the panel with all tools on the left, thumbnails and panels on the right (the default layout)',
  'Miniaturile în stânga, uneltele folosite des sus, restul în panoul „Avansat” din dreapta; fiecare bară se poate ascunde, iar Ctrl+H lasă doar pagina': 'Thumbnails on the left, frequently used tools at the top, the rest in the “Advanced” panel on the right; each bar can be hidden, and Ctrl+H leaves only the page',
  'O coloană cu sarcinile în stânga (Editează, Comentează, Semnează, Pagini…); uneltele sarcinii alese se deschid lângă ea': 'A column with the tasks on the left (Edit, Comment, Sign, Pages…); the tools of the chosen task open next to it',
  'O bară subțire cu modurile de lucru Citește, Adnotează, Editează, Semnează și Pagini; se văd doar uneltele modului ales': 'A thin bar with the work modes Read, Annotate, Edit, Sign and Pages; only the tools of the chosen mode are shown',
  'Câteva moduri de lucru în loc de file (Scrie, Inserează…); se vede doar bara subțire a modului ales, iar celelalte file stau în „Mai mult”': 'A few work modes instead of tabs (Write, Insert…); only the thin bar of the chosen mode is shown, and the other tabs are under “More”',
  'Închide panoul de unelte (se redeschide din bara de sus)': 'Close the tools panel (reopen it from the top bar)', 'Închide panoul de unelte': 'Close the tools panel',
  'Înapoi la lista tuturor uneltelor': 'Back to the list of all tools',
  'PDF nou cu o pagină A4 albă: scrii pe el cu Semnează… (text, imagini, semnătură) și adaugi pagini': 'New PDF with a blank A4 page: write on it with Sign… (text, images, signature) and add pages',
  'PDF nou cu o pagină A4 albă': 'New PDF with a blank A4 page',
  // Despre (About.tsx)
  'ⓘ Despre': 'ⓘ About', 'Despre': 'About', 'Despre: versiunea, licența': 'About: version, license', 'Versiunea': 'Version', 'Ultima zi:': 'Last day:',
  'Versiune de test: expiră mâine.': 'Test version: expires tomorrow.', 'Titular: Iancu Ionuț Adrian ·': 'Owner: Iancu Ionuț Adrian ·',
  'Programul poate fi folosit doar pentru testare: fără copiere la alții, vânzare, modificare sau decompilare.': 'The program may be used only for testing: no copying to others, selling, modifying or decompiling.',
  'Programul lucrează pe calculatorul tău, iar fișierele rămân la tine. Folosește și biblioteci open-source, cu licențele lor.': 'The program works on your computer, and your files stay with you. It also uses open-source libraries, under their own licenses.',
  'Licența': 'License', 'Licențele bibliotecilor': 'Library licenses',
});
