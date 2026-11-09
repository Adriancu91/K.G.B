// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Mesajele de stare din Video cu numere și nume (partea 2). Numele fișierelor rămân cum sunt ($R); ora „00:05” trece neschimbată.
// Textele care încep cu „ își pierd ghilimeaua din față la potrivire (traducătorul o păstrează și o pune la loc), deci tiparul începe după ea.
// „…” de la capăt e scos înainte de potrivire și pus la loc după.
import type { Pattern } from './i18n';

const pl = (n: string, one: string, many: string) => (n === '1' ? one : many);
const dot = (x: string) => x.replace(',', '.');

/** Mesajele fixe care stau într-o alegere (… ? '…' : '…'), deci nu le prinde căutarea după setStatus('…'). */
export const EN_VIDEO_STATUS2: Record<string, string> = {
  'Am decupat poza / clipul: Ctrl+V îl pune după cel ales.': 'I cut the photo / clip: Ctrl+V puts it after the selected one.',
  'Am copiat poza / clipul: Ctrl+V pune o copie după cel ales.': 'I copied the photo / clip: Ctrl+V puts a copy after the selected one.',
  'Filmez cu camera; apasă ⏹ ca să te oprești. Filmarea intră în bandă ca un clip.': 'Recording with the camera; press ⏹ to stop. The recording goes on the timeline as a clip.',
  'Am lipit poza / clipul.': 'I pasted the photo / clip.',
  'Am scos poza / clipul (Ctrl+Z îl aduce înapoi).': 'I removed the photo / clip (Ctrl+Z brings it back).',
  'Fă clic pe imagine, pe fundalul ferestrei, ca să iei culoarea lui.': 'Click the picture, on the window background, to take its color.',
};

export const VIDEO_STATUS_PATTERNS: Pattern[] = [
  [/^Salvat la ([0-9:]+) [(]([0-9]+) poze fără loc pe disc nu intră în proiect[)]$/s, 'Saved at $R1 ($R2 photos with no place on disk are not included in the project)'],
  [/^Deschis, dar ([0-9]+) (fișier nu mai e|fișiere nu mai sunt) pe disc [(]mutate sau șterse[)][.]$/s,
    (m) => `Opened, but ${m[1]} ${pl(m[1], 'file is', 'files are')} no longer on disk (moved or deleted).`],
  [/^Am adus (un slide|([0-9]+) slide-uri) din prezentare[.] Pune muzică, apoi ⤓ Export MP4$/s,
    (m) => `I brought ${m[2] ? m[2] + ' slides' : 'one slide'} from the presentation. Add music, then ⤓ Export MP4`],
  [/^Am ales toate cele ([0-9]+) poze [/] clipuri [(]Delete le scoate, Esc le lasă[)][.]$/s, 'I selected all $R1 photos / clips (Delete removes them, Esc leaves them).'],
  [/^Am decupat ([0-9]+) poze [/] clipuri: Ctrl[+]V le pune după cel ales[.]$/s, 'I cut $R1 photos / clips: Ctrl+V puts them after the selected one.'],
  [/^Am copiat ([0-9]+) poze [/] clipuri: Ctrl[+]V pune copiile după cel ales[.]$/s, 'I copied $R1 photos / clips: Ctrl+V puts the copies after the selected one.'],
  [/^Pregătesc o copie ușoară a clipului „(.+)”, ca redarea să meargă lin$/s, 'Preparing a light copy of the clip “$R1”, so playback runs smoothly'],
  [/^Copia ușoară pentru „(.+)” e gata [(]exportul folosește tot clipul original[)][.]$/s, 'The light copy for “$R1” is ready (the export still uses the original clip).'],
  [/^Nu am putut face copia ușoară pentru „(.+)”; redarea folosește clipul original[.]$/s, 'I could not make the light copy for “$R1”; playback uses the original clip.'],
  [/^Am pus „(.+)” în locul lui „(.+)”, cu aceleași setări [(]Ctrl[+]Z revine[)][.]$/s, 'I put “$R1” in place of “$R2”, with the same settings (Ctrl+Z goes back).'],
  [/^Am pus „(.+)” pe bandă[.]$/s, 'I put “$R1” on the timeline.'],
  [/^Am adăugat ([0-9]+) (poză|poze)[.]$/s, (m) => `I added ${m[1]} ${pl(m[1], 'photo', 'photos')}.`],
  [/^(?:Am adăugat ([0-9]+) (clip|clipuri)[.])? ?(?:([0-9]+) (clip nu se poate reda|clipuri nu se pot reda) [(]format necunoscut; MP4 sau WebM merg sigur[)][.])?$/s,
    (m) => [m[1] ? `I added ${m[1]} ${pl(m[1], 'clip', 'clips')}.` : '',
      m[3] ? `${m[3]} ${pl(m[3], 'clip cannot', 'clips cannot')} be played (unknown format; MP4 or WebM work for sure).` : ''].filter(Boolean).join(' ')],
  [/^(.+)” are un format care nu se poate reda direct; îl convertesc o dată în MP4( [(]poate dura puțin[)])?$/s,
    (m) => `${m[1]}” has a format that cannot be played directly; converting it once to MP4${m[2] ? ' (it may take a while)' : ''}`],
  [/^(.+)” nu se poate deschide[.]$/s, '$R1” cannot be opened.'],
  [/^(.+)” apare în colțul de sus, de la ([0-9:]+); trage-l pe imagine ca să-l muți, iar locul, mărimea și forma le alegi mai jos[.]$/s,
    '$R1” appears in the top corner, from $R2; drag it on the picture to move it, and choose the place, size and shape below.'],
  [/^Muzică: (.+)$/s, 'Music: $R1'],
  [/^Vocea începe la ([0-9:]+) [(]de unde e bara de timp[)]; muzica scade cât se aude[.]$/s, 'The voice-over starts at $R1 (where the playhead is); the music gets quieter while it plays.'],
  [/^Vocea înregistrată începe la ([0-9:]+); o poți muta din „de la … s”[.]$/s, 'The recorded voice-over starts at $R1; you can move it from “from … s”.'],
  [/^Filmez cu camera; filmarea va apărea în colț de la ([0-9:]+)[.] Apasă ⏹ ca să te oprești[.]$/s, 'Recording with the camera; the recording will appear in the corner from $R1. Press ⏹ to stop.'],
  [/^Filmarea camerei e în colț, de la ([0-9:]+) [(]o muți sau o faci mai mare din ⧉ Imagine în imagine[)][.]$/s,
    'The camera recording is in the corner, from $R1 (move or enlarge it from ⧉ Picture in Picture).'],
  [/^Ritm: ([0-9]+) bătăi pe minut; pozele se schimbă la fiecare (bătaie|([0-9]+) bătăi) [(]([0-9,]+) s[)][.]$/s,
    (m) => `Beat: ${m[1]} beats per minute; the photos change on every ${m[3] ? m[3] + ' beats' : 'beat'} (${dot(m[4])} s).`],
  [/^Am mutat (clipul|poza) pe locul ([0-9]+)[.]$/s, (m) => `I moved the ${m[1] === 'clipul' ? 'clip' : 'photo'} to position ${m[2]}.`],
  [/^Clipul ([0-9]+): de la ([0-9,]+) s până la ([0-9,]+) s[.]$/s, (m) => `Clip ${m[1]}: from ${dot(m[2])} s to ${dot(m[3])} s.`],
  [/^Poza ([0-9]+) stă ([0-9,]+) s[.]$/s, (m) => `Photo ${m[1]} stays ${dot(m[2])} s.`],
  [/^Aici [(]([0-9:]+)[)] e deja un capitol[.]$/s, 'There is already a chapter here ($R1).'],
  [/^Un film are cel mult ([0-9]+) de capitole[.]$/s, 'A video has at most $R1 chapters.'],
  [/^Capitol nou la ([0-9:]+): scrie-i numele în lista de lângă buton[.]$/s, 'New chapter at $R1: write its name in the list next to the button.'],
  [/^Sunet salvat: (.+)$/s, 'Sound saved: $R1'], [/^Video salvat: (.+)$/s, 'Video saved: $R1'],
  [/^Subtitrări salvate: (.+)$/s, 'Subtitles saved: $R1'],
  [/^Export (MP3|MP4|GIF): ([0-9]+)% [(]([0-9:]+) din ([0-9:]+)[)]$/s, 'Export $R1: $R2% ($R3 of $R4)'],
  [/^Export (MP3|MP4|GIF): se termină fișierul$/s, 'Export $R1: finishing the file'],
  [/^Export video: ([0-9:]+) din ([0-9:]+)$/s, 'Export video: $R1 of $R2'],
  [/^Am adus ([0-9]+) subtitrări[.]$/s, (m) => `I brought ${m[1]} ${pl(m[1], 'subtitle', 'subtitles')}.`],
  [/^Culoarea scoasă: (#[0-9a-fA-F]+)[.] Dacă rămân margini, mărește Toleranța[.]$/s, 'Color removed: $R1. If edges remain, increase the Tolerance.'],
  [/^Clipul ([0-9]+) e împărțit în două, la secunda ([0-9,]+) din el[.]$/s, (m) => `Clip ${m[1]} is split in two, at second ${dot(m[2])} of it.`],
  [/^Cadrul e salvat ca (.+) și pus după clipul ([0-9]+), 3 secunde [(]cadru înghețat[)][.]$/s, 'The frame is saved as $R1 and put after clip $R2, 3 seconds (freeze frame).'],
  [/^Sunetul începe la ([0-9:]+) [(]de unde e bara de timp[)][.]$/s, 'The sound starts at $R1 (where the playhead is).'],
  [/^Am lipit ([0-9]+) poze [/] clipuri[.]$/s, 'I pasted $R1 photos / clips.'],
  [/^Am scos ([0-9]+) poze [/] clipuri [(]Ctrl[+]Z le aduce înapoi[)][.]$/s, 'I removed $R1 photos / clips (Ctrl+Z brings them back).'],
  [/^Filmul are acum ([0-9:]+); fiecare poză stă ([0-9,]+) s[.]$/s, (m) => `The video is now ${m[1]} long; each photo stays ${dot(m[2])} s.`],
  [/^Filmul are ([0-9:]+) în loc de ([0-9:]+): o poză stă între ([0-9]+) și ([0-9]+) secunde, adaugă sau scoate poze[.]$/s,
    'The video is $R1 long instead of $R2: a photo stays between $R3 and $R4 seconds, add or remove photos.'],
  [/^Bucata [(]([0-9:]+)[)] e salvată în (.+)[.]$/s, 'The part ($R1) is saved in $R2.'],
];
