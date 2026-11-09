// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Mesajele din Imagini (banda roșie de sus, „✓ Salvat”, mesajul de la Decupare margini), în engleză.
// Banda are clasa status-msg, deci folosește dicționarul barelor de stare (EN_STATUS), în care intră și acesta.
import type { Pattern } from './i18n';

export const EN_IMAGES_STATUS: Record<string, string> = {
  'Alege un strat cu pixeli (nu unul de ajustare) pentru Aplică imaginea.': 'Choose a layer with pixels (not an adjustment layer) for Apply Image.',
  'Canalul e negru peste tot: nu se poate face o selecție din el.': 'The channel is black everywhere: no selection can be made from it.',
  'Ce e în clipboard nu se poate lipi ca poză.': 'What is on the clipboard cannot be pasted as a picture.',
  'Colțurile s-au încrucișat: trage-le înapoi ca forma să nu se întoarcă pe dos.': 'The corners crossed: drag them back so the shape does not turn inside out.',
  'Cu mai multe straturi, comanda aceasta merge după ◫ Straturi → Aplatizează.': 'With several layers, this command works after ◫ Layers → Flatten.',
  'Ecranul complet nu e disponibil aici.': 'Full screen is not available here.',
  'Fișierul nu pare o imagine pe care o putem deschide (JPG, PNG, WebP, BMP, GIF).': 'The file does not look like an image we can open (JPG, PNG, WebP, BMP, GIF).',
  'Leagă cu 🔗 cel puțin 3 straturi cu pixeli (nu blocate) ca să le distribui.': 'Link with 🔗 at least 3 layers with pixels (not locked) to distribute them.',
  'Locul de unde iei textura trebuie să fie tot în poză: trage zona mai puțin spre margine.': 'The place you take the texture from must be fully inside the picture: drag the area less toward the edge.',
  'Marginile noi sunt prea mari față de poză ca să fie umplute după conținut; au rămas transparente.': 'The new edges are too large for the picture to be content-aware filled; they stayed transparent.',
  'Nu am găsit poze separate pe foaie: pozele trebuie să fie pe un fundal uniform (alb, gri sau negru), cu loc liber între ele.': 'I found no separate photos on the sheet: the photos must be on a plain background (white, gray or black), with free space between them.',
  'Nu am putut copia măsurătorile.': 'I could not copy the measurements.', 'Nu am putut copia numărătoarea.': 'I could not copy the count.',
  'Nu am putut copia poza în clipboard.': 'I could not copy the picture to the clipboard.',
  'Nu e destulă poză în jurul zonei alese ca să umplu locul rămas gol.': 'There is not enough picture around the chosen area to fill the empty space.',
  'Nu e destulă poză în jurul zonei alese: alege doar obiectul de scos, cu ceva fundal în jurul lui.': 'There is not enough picture around the chosen area: choose only the object to remove, with some background around it.',
  'Pagina din PDF nu a putut fi desenată (PDF deteriorat sau cu parolă).': 'The PDF page could not be drawn (damaged PDF or with a password).',
  'Pentru un colaj alege cel puțin 2 poze (Ctrl+click pe ele în fereastră).': 'For a collage choose at least 2 pictures (Ctrl+click them in the window).',
  'Pentru „Lipește în selecție” alege întâi o zonă (⬚ Selecție).': 'For “Paste Into Selection” first choose an area (⬚ Selection).',
  'Poza nu a putut fi pregătită ca PNG.': 'The picture could not be prepared as PNG.',
  'Poza nu a putut fi pregătită pentru tipărire.': 'The picture could not be prepared for printing.',
  'Poza nu a putut fi salvată în acest format.': 'The picture could not be saved in this format.',
  'Poza nu s-a putut salva peste fișierul vechi (poate e deschisă în alt program sau e doar pentru citire). Alege „Salvează ca…”.': 'The picture could not be saved over the old file (maybe it is open in another program or it is read-only). Choose “Save As…”.',
  'Scrie întâi un text (sau alege unul), apoi apasă „Selecție din text”.': 'First type a text (or choose one), then press “Selection from Text”.',
  'Stratul ales e gol: nu are ce alinia.': 'The chosen layer is empty: there is nothing to align.',
  'Stratul ales e gol: nu are ce transforma.': 'The chosen layer is empty: there is nothing to transform.',
  'Textul e în afara pozei: nu s-a făcut nicio selecție.': 'The text is outside the picture: no selection was made.',
  'Trage întâi o linie peste ceva de lungime cunoscută și scrie cât are (un număr mai mare ca 0).': 'First drag a line over something of known length and type how long it is (a number greater than 0).',
  'Un strat blocat (🔒) nu se poate uni: deblochează-le întâi pe amândouă.': 'A locked layer (🔒) cannot be merged: unlock both first.',
  'Un strat de ajustare nu are pixeli de aliniat.': 'An adjustment layer has no pixels to align.',
  'Un strat de ajustare nu are pixeli de transformat.': 'An adjustment layer has no pixels to transform.',
  'Una dintre poze nu a putut fi deschisă, așa că nu am făcut colajul.': 'One of the pictures could not be opened, so I did not make the collage.',
  'În clipboard nu e nicio poză. Copiază întâi o poză sau o bucată (Ctrl+C).': 'There is no picture on the clipboard. First copy a picture or a part of one (Ctrl+C).',
  'Poza nu s-a putut citi.': 'The picture could not be read.', 'Poza pentru hartă nu s-a putut citi.': 'The picture for the map could not be read.',
  'Am găsit o poză: e îndreptată, în tabul nou.': 'I found one photo: it is straightened, in the new tab.',
  'Salvat. Copia de dinainte e păstrată.': 'Saved. The previous copy is kept.',
  'Nu am găsit margini goale de tăiat.': 'I found no empty edges to trim.', 'Poza are o singură culoare: nu e nimic de tăiat.': 'The picture has a single color: there is nothing to trim.',
};

const LOCKED: Record<string, string> = { 'Pixelii stratului': 'The pixels of layer', 'Poziția stratului': 'The position of layer', 'Stratul': 'Layer' };
const re = (s: string) => new RegExp('^' + s + '$', 's');

export const IMAGES_STATUS_PATTERNS: Pattern[] = [
  [re('(Pixelii stratului|Poziția stratului|Stratul) „(.+)” (sunt blocați [(]✎[)]|e blocată [(]✥[)]|e blocat [(]🔒[)])[.] (Debifează blocarea din ◫ Straturi ca să pictezi pe el|Debifează blocarea din ◫ Straturi ca să-l muți|Deblochează-l din ◫ Straturi ca să-l schimbi)[.]'),
    (m) => `${LOCKED[m[1]]} “${m[2]}” ${m[3].includes('✎') ? 'are locked (✎)' : m[3].includes('✥') ? 'is locked (✥)' : 'is locked (🔒)'}. ${m[4].includes('pictezi') ? 'Uncheck the lock in ◫ Layers to paint on it' : m[4].includes('muți') ? 'Uncheck the lock in ◫ Layers to move it' : 'Unlock it in ◫ Layers to change it'}.`],
  [re('Am salvat „(.+)”: o aduci înapoi oricând din lista „Încarcă selecția”[.]'), 'I saved “$R1”: bring it back anytime from the “Load Selection” list.'],
  [re('Nu am putut salva PNG-ul: (.+)'), (m, tr) => `I could not save the PNG: ${tr(m[1])}`],
  [re('Poza nu mai există sau nu poate fi citită: (.+)'), 'The picture no longer exists or cannot be read: $R1'],
  [re('Straturile nu s-au putut salva toate în (.+) [(]salvate: ([0-9]+)[)][.]'), 'Not all layers could be saved in $R1 (saved: $R2).'],
  [re('Pagina era prea mare pentru memorie la ([0-9]+) dpi și s-a deschis la ([0-9]+) × ([0-9]+) px[.]'), 'The page was too large for memory at $R1 dpi and opened at $R2 × $R3 px.'],
  [re('Colajul are cel mult ([0-9]+) poze: le-am folosit pe primele ([0-9]+)[.]'), 'A collage has at most $R1 pictures: I used the first $R2.'],
  [re('Am găsit ([0-9]+) poze: fiecare e îndreptată, în tabul ei[.]'), 'I found $R1 photos: each is straightened, in its own tab.'],
];
