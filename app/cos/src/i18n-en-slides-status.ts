// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Mesajele de stare din Slides (lângă numele prezentării, sus), în engleză. Numele fișierelor și șabloanelor rămân cum sunt ($R).
import type { Pattern } from './i18n';

export const EN_SLIDES_STATUS: Record<string, string> = {
  'Pentru o diagramă, caseta are nevoie de cel puțin 2 rânduri de text.': 'For a diagram, the box needs at least 2 lines of text.',
  'Caseta a devenit diagramă. Ctrl+Z o readuce.': 'The box became a diagram. Ctrl+Z brings it back.',
  'Citesc slide-urile…': 'Reading the slides…',
  'Desenul a fost șters de pe slide': 'The drawing was removed from the slide',
  'Desenul e pe slide, ca poză: îl muți, îl mărești sau îl schimbi cu ✎ Desen': 'The drawing is on the slide, as a picture: move it, resize it or change it with ✎ Draw',
  'Documentul e gol, nu am din ce face slide-uri.': 'The document is empty, there is nothing to make slides from.',
  'Fac GIF-ul…': 'Making the GIF…', 'Nu am putut face fișierul .pptx.': 'I could not make the .pptx file.',
  'O poză nu a putut fi citită (merg JPG, PNG, WebP, BMP, GIF).': 'A picture could not be read (JPG, PNG, WebP, BMP, GIF work).',
  'Pozele alese nu au putut fi citite (merg JPG, PNG, WebP, BMP, GIF).': 'The selected pictures could not be read (JPG, PNG, WebP, BMP, GIF work).',
  'Pregătesc albumul…': 'Preparing the album…', 'Pregătesc fișierul .pptx…': 'Preparing the .pptx file…', 'Pregătesc imaginile…': 'Preparing the images…',
  'Pregătesc slide-urile pentru Docs…': 'Preparing the slides for Docs…', 'Pregătesc slide-urile pentru GIF…': 'Preparing the slides for the GIF…',
  'Pregătesc slide-urile pentru video…': 'Preparing the slides for the video…', 'Pregătesc sunetul…': 'Preparing the sound…',
  'Se înregistrează de la microfon… Apasă ⏹ ca să oprești.': 'Recording from the microphone… Press ⏹ to stop.',
  'Înregistrarea nu a putut fi pusă pe slide.': 'The recording could not be put on the slide.',
  // Numele animațiilor din „Animație adăugată: …”
  'Apare': 'Appear', 'Se estompează': 'Fade', 'Urcă': 'Rise Up', 'Zboară înăuntru': 'Fly In', 'Ștergere': 'Wipe', 'Împărțire': 'Split', 'Roată': 'Wheel',
  'Bare': 'Random Bars', 'Zoom': 'Zoom', 'Ieșire: Dispare': 'Exit: Disappear', 'Ieșire: Se estompează': 'Exit: Fade', 'Ieșire: Zboară afară': 'Exit: Fly Out',
  'Accent: Puls': 'Emphasis: Pulse', 'Accent: Rotire': 'Emphasis: Spin', 'Accent: Crește': 'Emphasis: Grow', 'Accent: Balans': 'Emphasis: Teeter',
  'Cale: Linie': 'Path: Line', 'Cale: Arc': 'Path: Arc', 'Cale: Cerc': 'Path: Circle',
};

export const SLIDES_STATUS_PATTERNS: Pattern[] = [
  [/^Am adus ([0-9]+) (slide|slide-uri) din „(.+)”, după slide-ul ([0-9]+) [(]cu tema prezentării tale[)][.]$/s,
    (m) => `I brought ${m[1]} ${m[1] === '1' ? 'slide' : 'slides'} from “${m[3]}”, after slide ${m[4]} (with the theme of your presentation).`],
  [/^Am făcut ([0-9]+) slide-uri din „(.+)”[.] Verifică-le și salvează[.]$/s, 'I made $R1 slides from “$R2”. Check them and save.'],
  [/^Am salvat ([0-9]+) imagini PNG în dosarul ales[.]$/s, 'I saved $R1 PNG images in the chosen folder.'],
  [/^Animație adăugată: (.+)[.] Vine la sfârșitul slide-ului; ordinea și pornirea se schimbă în ✦ Panou animație[.]$/s,
    (m, tr) => `Animation added: ${tr(m[1])}. It comes at the end of the slide; the order and start are changed in ✦ Animation Pane.`],
  [/^Cod QR pus pe slide [(]([0-9]+) × ([0-9]+) pătrățele[)]; mută-l sau mărește-l ca pe orice poză$/s, 'QR code put on the slide ($R1 × $R2 squares); move or resize it like any picture'],
  [/^Imaginea ([0-9]+) din ([0-9]+)$/s, 'Image $R1 of $R2'],
  [/^Pregătesc slide-ul ([0-9]+) din ([0-9]+) pentru (Docs|GIF|video)$/s, (m) => `Preparing slide ${m[1]} of ${m[2]} for ${m[3] === 'GIF' ? 'the GIF' : m[3] === 'video' ? 'the video' : 'Docs'}`],
  [/^Sunetul înregistrat [(]([0-9:]+)[)] e pe slide; în prezentare pornește cu clic pe el[.]$/s, 'The recorded sound ($R1) is on the slide; in the show it starts when you click it.'],
  [/^Șablonul „(.+)”: înlocuiește textele dintre .{3} și salvează[.]$/s, 'Template “$1”: replace the texts between [ ] and save.'],
];
