// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Diagramele din Docs (ca SmartArt): proces, săgeți, listă, ciclu, piramidă, ierarhie, proces ascendent, matrice, Venn, pâlnie, cronologie,
// radial, țintă, proces vertical, proces șerpuit, cerc împărțit, ecuație, ierarhie orizontală, săgeată continuă,
// radial convergent, proces în trepte în jos, fagure, roți dințate, proces cu cercuri, listă cu etape,
// radial divergent, Venn stivuit, listă în piramidă, piramidă inversată, Venn liniar,
// săgeată ascendentă, balanță, săgeți în sens opus, proces alternant, listă pe săgeată, listă cu trapeze, blocuri descrescătoare, bandă înclinată, templu, arc, cercuri crescătoare, radial cu hexagoane, romburi în zigzag, triunghiuri alternante, cruce de idei, piramidă din triunghiuri, listă cu acoladă, ovale în cascadă, cercuri în grilă, listă cu buline pe linie, fișe cu file, blocuri în grilă, ciclu cu blocuri, cronologie verticală, Venn radial, matrice cu titlu, listă cu hexagoane, listă cu cercuri, listă cu romburi, listă cu stele, listă cu pentagoane, listă cu octogoane, ciclu continuu, săgeți față în față, plus și minus, listă cu linii, bule de dialog, listă tabel, bare în clasament, podium, clepsidră. Scrii elementele, câte unul pe rând,
// iar desenul (SVG → PNG, ca la grafice) se face din nou când schimbi textul, felul sau culoarea. Descrierea rămâne pe imagine.
import type { Editor } from '@tiptap/react';
import { svgToPng } from '../sheets/chartSvg';

export type DocDiagramKind = 'process' | 'chevrons' | 'list' | 'cycle' | 'pyramid' | 'hierarchy' | 'stairs' | 'matrix' | 'venn' | 'funnel' | 'timeline' | 'radial' | 'target' | 'vprocess' | 'bending' | 'segments' | 'equation' | 'hhierarchy' | 'arrowprocess' | 'converge' | 'stepdown' | 'honeycomb' | 'gears' | 'circleprocess' | 'chevronlist' | 'diverge' | 'stackvenn' | 'pyramidlist' | 'invpyramid' | 'linearvenn' | 'uparrow' | 'balance' | 'opposing' | 'meetarrows' | 'plusminus' | 'alternating' | 'arrowlist' | 'trapezoids' | 'descending' | 'slanted' | 'temple' | 'arc' | 'growing' | 'hexradial' | 'diamonds' | 'triangles' | 'cross' | 'trigrid' | 'bracket' | 'linedlist' | 'bubbles' | 'tablelist' | 'rankbars' | 'podium' | 'hourglass' | 'cascade' | 'circlegrid' | 'beadlist' | 'tabs' | 'blockgrid' | 'blockcycle' | 'ringcycle' | 'vtimeline' | 'radialvenn' | 'titledmatrix' | 'hexlist' | 'circlelist' | 'diamondlist' | 'starlist' | 'pentagonlist' | 'octagonlist' | 'trianglelist' | 'squarelist' | 'checklist' | 'heartlist' | 'cloudlist' | 'droplist' | 'plaquelist' | 'seallist' | 'gearlist' | 'doclist' | 'cubelist' | 'canlist' | 'notelist' | 'bevellist' | 'sunlist' | 'framelist' | 'donutlist' | 'flaglist' | 'ribbonlist' | 'scrolllist' | 'pielist' | 'cardlist' | 'burstlist' | 'halfcirclelist' | 'pilllist' | 'decagonlist' | 'basicpie' | 'nestedtarget' | 'radialcluster' | 'gridaxes' | 'zigzagblocks' | 'brickpyramid' | 'ladder' | 'pillars' | 'incarrows' | 'phasebar' | 'pluslist' | 'fishbone' | 'mindmap' | 'growthcurve' | 'iceberg' | 'parallelogramlist' | 'heptagonlist' | 'roadmap' | 'mountain' | 'thermometer' | 'bridge' | 'puzzle' | 'tree' | 'bulb' | 'dodecagonlist' | 'compass' | 'moonlist' | 'signlist' | 'calloutlist' | 'star6list' | 'star8list' | 'sparklist' | 'notchlist' | 'boltlist' | 'setsquarelist' | 'trapezoidlist' | 'star10list' | 'star7list' | 'star16list' | 'star24list' | 'star32list' | 'badgelist' | 'sniplist' | 'round1list' | 'snipdiaglist' | 'rounddiaglist' | 'quarterlist' | 'sniproundlist' | 'ovalcalloutlist' | 'roundcalloutlist' | 'chordlist' | 'displaylist' | 'mergelist' | 'cornerlist' | 'desklist' | 'stripelist' | 'halfframelist' | 'storagelist' | 'rightcalloutlist' | 'downcalloutlist' | 'upcalloutlist' | 'burst2list' | 'lrcalloutlist' | 'quadcalloutlist';
export const DOC_DIAGRAMS: [DocDiagramKind, string][] = [
  ['process', 'Proces (pași cu săgeți)'], ['chevrons', 'Săgeți în lanț'], ['list', 'Listă numerotată'],
  ['cycle', 'Ciclu'], ['pyramid', 'Piramidă'], ['hierarchy', 'Ierarhie (unul sus, restul dedesubt)'],
  ['stairs', 'Proces ascendent (trepte)'], ['matrix', 'Matrice (grilă)'], ['venn', 'Venn (cercuri suprapuse)'],
  ['funnel', 'Pâlnie (etape tot mai înguste)'], ['timeline', 'Cronologie (momente pe o linie)'],
  ['radial', 'Radial (primul în mijloc, restul în jur)'], ['target', 'Țintă (cercuri unul în altul)'],
  ['vprocess', 'Proces vertical (pași de sus în jos)'], ['bending', 'Proces șerpuit (pași pe mai multe rânduri)'],
  ['segments', 'Cerc împărțit (felii egale)'], ['equation', 'Ecuație (A + B = rezultat; ultimul e rezultatul)'],
  ['hhierarchy', 'Ierarhie orizontală (primul în stânga, restul în dreapta)'],
  ['arrowprocess', 'Săgeată continuă (pașii pe o săgeată mare)'],
  ['converge', 'Radial convergent (primul în mijloc, restul cu săgeți spre el)'],
  ['stepdown', 'Proces în trepte în jos (pași în scară, cu săgeți îndoite)'],
  ['honeycomb', 'Fagure (hexagoane lipite pe două rânduri)'],
  ['gears', 'Roți dințate (idei care se prind una de alta)'],
  ['circleprocess', 'Proces cu cercuri (pași în cercuri, cu săgeți între ei)'],
  ['chevronlist', 'Listă cu etape (numărul într-o săgeată, textul lângă ea)'],
  ['diverge', 'Radial divergent (primul în mijloc, cu săgeți spre restul)'],
  ['stackvenn', 'Venn stivuit (cercuri unul în altul, pe aceeași bază)'],
  ['pyramidlist', 'Listă în piramidă (nivelurile în piramidă, textul alături)'],
  ['invpyramid', 'Piramidă inversată (nivelul cel mai lat sus)'],
  ['linearvenn', 'Venn liniar (cercuri în rând, suprapuse)'],
  ['uparrow', 'Săgeată ascendentă (pașii pe o săgeată care urcă)'],
  ['opposing', 'Săgeți în sens opus (una spre dreapta, una spre stânga, cu ideile pe ele)'],
  ['meetarrows', 'Săgeți față în față (două săgeți care se întâlnesc la mijloc, cu ideile pe ele)'],
  ['plusminus', 'Plus și minus (avantajele sub un plus, dezavantajele sub un minus, în două coloane)'],
  ['balance', 'Balanță (ideile pe două talere, înclinată spre partea cu mai multe)'],
  ['arrowlist', 'Listă pe săgeată (pașii unul sub altul, lângă o săgeată în jos)'],
  ['trapezoids', 'Listă cu trapeze (ideile una lângă alta, în trapeze lipite)'],
  ['slanted', 'Bandă înclinată (ideile una lângă alta, în paralelograme)'],
  ['temple', 'Templu (ideile ca niște coloane sub un acoperiș, pe o temelie)'],
  ['arc', 'Arc (ideile în cercuri, pe un semicerc de la stânga la dreapta)'],
  ['growing', 'Cercuri crescătoare (ideile în cercuri tot mai mari, de la stânga la dreapta)'],
  ['trigrid', 'Piramidă din triunghiuri (ideile în triunghiurile mici dintr-unul mare, de sus în jos)'],
  ['cross', 'Cruce de idei (ideea principală la mijloc, celelalte deasupra, în dreapta, dedesubt, în stânga și apoi pe colțuri)'],
  ['triangles', 'Triunghiuri alternante (ideile în triunghiuri lipite, pe rând cu vârful în sus și în jos)'],
  ['diamonds', 'Romburi în zigzag (ideile în romburi lipite unul de altul, pe rând sus și jos)'],
  ['hexradial', 'Radial cu hexagoane (ideea principală la mijloc, celelalte în hexagoane lipite în jur)'],
  ['descending', 'Blocuri descrescătoare (coloane tot mai scunde, de la stânga la dreapta)'],
  ['alternating', 'Proces alternant (pașii pe rând deasupra și dedesubtul unei săgeți)'],
  ['bracket', 'Listă cu acoladă (ideea principală în stânga, celelalte în dreapta, strânse de o acoladă)'],
  ['linedlist', 'Listă cu linii (titlul în stânga, ideile una sub alta în dreapta, despărțite de linii)'],
  ['tablelist', 'Listă tabel (titlul într-o bandă lată sus, ideile în coloane egale dedesubt, pe o temelie)'],
  ['rankbars', 'Bare în clasament (ideile în benzi una sub alta, fiecare mai scurtă decât cea de deasupra, cu locul în față)'],
  ['podium', 'Podium (primul loc în mijloc, cel mai înalt; următoarele de o parte și de alta, tot mai joase)'],
  ['hourglass', 'Clepsidră (ideile în benzi care se îngustează spre mijloc, apoi se lărgesc din nou)'],
  ['bubbles', 'Bule de dialog (ideile în bule de vorbire, pe rând în stânga și în dreapta)'],
  ['cascade', 'Ovale în cascadă (ideile în ovale care coboară în diagonală, fiecare puțin peste cel dinainte)'],
  ['circlegrid', 'Cercuri în grilă (ideile în cercuri la fel de mari, câte două sau trei pe rând)'],
  ['beadlist', 'Listă cu buline pe linie (ideile în benzi, una sub alta, cu câte o bulină pe o linie verticală)'],
  ['tabs', 'Fișe cu file (ideile pe fișe alăturate, fiecare cu o filă colorată deasupra, ca dosarele)'],
  ['blockgrid', 'Blocuri în grilă (ideile în dreptunghiuri rotunjite la fel de mari, câte două sau trei pe rând)'],
  ['blockcycle', 'Ciclu cu blocuri (ideile în dreptunghiuri rotunjite pe un cerc, cu o săgeată spre următoarea)'],
  ['ringcycle', 'Ciclu continuu (ideile în dreptunghiuri rotunjite pe un inel gros, fără început și sfârșit)'],
  ['vtimeline', 'Cronologie verticală (momentele pe o linie de sus în jos, pe rând în stânga și în dreapta ei)'],
  ['radialvenn', 'Venn radial (primul în cercul din mijloc, restul în cercuri care îl ating pe margine)'],
  ['titledmatrix', 'Matrice cu titlu (primul într-o casetă în mijloc, peste grila cu celelalte)'],
  ['hexlist', 'Listă cu hexagoane (numărul într-un hexagon, textul într-o bandă alături)'],
  ['circlelist', 'Listă cu cercuri (numărul într-un cerc, textul într-o bandă alături)'],
  ['diamondlist', 'Listă cu romburi (numărul într-un romb, textul într-o bandă alături)'],
  ['starlist', 'Listă cu stele (numărul într-o stea, textul într-o bandă alături)'],
  ['pentagonlist', 'Listă cu pentagoane (numărul într-un pentagon, textul într-o bandă alături)'],
  ['octagonlist', 'Listă cu octogoane (numărul într-un octogon, textul într-o bandă alături)'],
  ['trianglelist', 'Listă cu triunghiuri (numărul într-un triunghi, textul într-o bandă alături)'],
  ['squarelist', 'Listă cu pătrate (numărul într-un pătrat, textul într-o bandă alături)'],
  ['checklist', 'Listă cu bife (o căsuță bifată pe fiecare rând, textul într-o bandă alături)'],
  ['heartlist', 'Listă cu inimi (numărul într-o inimă, textul într-o bandă alături)'],
  ['cloudlist', 'Listă cu nori (numărul într-un nor, textul într-o bandă alături)'],
  ['droplist', 'Listă cu picături (numărul într-o picătură, textul într-o bandă alături)'],
  ['plaquelist', 'Listă cu plăcuțe (numărul pe o plăcuță cu colțurile scobite, textul într-o bandă alături)'],
  ['seallist', 'Listă cu sigilii (numărul pe un sigiliu zimțat, textul într-o bandă alături)'],
  ['gearlist', 'Listă cu roți dințate (numărul pe o roată dințată, textul într-o bandă alături)'],
  ['doclist', 'Listă cu documente (numărul pe o foaie cu marginea de jos ondulată, textul într-o bandă alături)'],
  ['cubelist', 'Listă cu cuburi (numărul pe un cub, textul într-o bandă alături)'],
  ['canlist', 'Listă cu cilindri (numărul pe un cilindru, textul într-o bandă alături)'],
  ['notelist', 'Listă cu notițe (numărul pe o foaie cu colțul îndoit, textul într-o bandă alături)'],
  ['bevellist', 'Listă cu butoane (numărul pe un buton teșit, textul într-o bandă alături)'],
  ['sunlist', 'Listă cu sori (numărul pe un soare cu raze, textul într-o bandă alături)'],
  ['framelist', 'Listă cu rame (numărul într-o ramă, textul într-o bandă alături)'],
  ['donutlist', 'Listă cu inele (numărul în mijlocul unui inel, textul într-o bandă alături)'],
  ['flaglist', 'Listă cu stegulețe (numărul pe un steguleț, textul într-o bandă alături)'],
  ['ribbonlist', 'Listă cu panglici (numărul pe o panglică, textul într-o bandă alături)'],
  ['scrolllist', 'Listă cu suluri (numărul pe un sul de hârtie, textul într-o bandă alături)'],
  ['pielist', 'Listă cu felii (numărul pe o felie de cerc, textul într-o bandă alături)'],
  ['cardlist', 'Listă cu fișe (numărul pe o fișă cu colțul tăiat, textul într-o bandă alături)'],
  ['burstlist', 'Listă cu explozii (numărul pe o explozie cu colțuri, textul într-o bandă alături)'],
  ['halfcirclelist', 'Listă cu semicercuri (numărul pe o formă rotunjită la dreapta, textul într-o bandă alături)'],
  ['pilllist', 'Listă cu capsule (numărul pe o capsulă rotunjită la capete, textul într-o bandă alături)'],
  ['decagonlist', 'Listă cu decagoane (numărul pe un decagon, textul într-o bandă alături)'],
  ['basicpie', 'Plăcintă (un cerc plin tăiat în felii egale, câte o idee pe felie)'],
  ['nestedtarget', 'Țintă cu dreptunghiuri (dreptunghiuri unul în altul, textul sus în fiecare)'],
  ['radialcluster', 'Radial cu blocuri (primul într-un bloc în mijloc, restul în blocuri în jur, legate de el)'],
  ['gridaxes', 'Grilă cu axe (ideile câte două pe rând, despărțite de o axă verticală și de axe orizontale)'],
  ['zigzagblocks', 'Blocuri în zigzag (pașii de la stânga la dreapta, pe rând sus și jos)'],
  ['brickpyramid', 'Piramidă din blocuri (ideile în blocuri așezate ca o piramidă de cărămizi, de sus în jos)'],
  ['ladder', 'Scară cu trepte (pașii pe treptele unei scări, de jos în sus)'],
  ['pillars', 'Coloane pe o bază (ideile în coloane înalte, alăturate, pe o bază comună)'],
  ['incarrows', 'Săgeți crescătoare (ideile pe săgeți una sub alta, fiecare mai lungă decât cea de deasupra)'],
  ['phasebar', 'Bară cu etape (o bară lungă împărțită în segmente lipite, câte o etapă pe segment)'],
  ['pluslist', 'Listă cu plusuri (numărul pe un semn plus, textul într-o bandă alături)'],
  ['parallelogramlist', 'Listă cu paralelograme (numărul pe un paralelogram înclinat spre dreapta, textul într-o bandă alături)'],
  ['heptagonlist', 'Listă cu heptagoane (numărul pe un heptagon, cu 7 colțuri, textul într-o bandă alături)'],
  ['setsquarelist', 'Listă cu echere (numărul pe un echer, un triunghi cu unghi drept, textul într-o bandă alături)'],
  ['trapezoidlist', 'Listă cu trapeze numerotate (numărul pe un trapez, mai lat jos, textul într-o bandă alături)'],
  ['star10list', 'Listă cu stele în zece colțuri (numărul pe o stea cu 10 colțuri, textul într-o bandă alături)'],
  ['star7list', 'Listă cu stele în șapte colțuri (numărul pe o stea cu 7 colțuri, textul într-o bandă alături)'],
  ['star16list', 'Listă cu stele în șaisprezece colțuri (numărul pe o stea cu 16 colțuri, textul într-o bandă alături)'],
  ['star24list', 'Listă cu stele în douăzeci și patru de colțuri (numărul pe o stea cu 24 de colțuri, textul într-o bandă alături)'],
  ['star32list', 'Listă cu stele în treizeci și două de colțuri (numărul pe o stea cu 32 de colțuri, textul într-o bandă alături)'],
  ['badgelist', 'Listă cu ecusoane (numărul pe un ecuson cu vârful în jos, textul într-o bandă alături)'],
  ['sniplist', 'Listă cu plăcuțe teșite (numărul pe o plăcuță cu colțurile de sus tăiate, textul într-o bandă alături)'],
  ['round1list', 'Listă cu plăcuțe rotunjite (numărul pe o plăcuță cu colțul din dreapta sus rotunjit, textul într-o bandă alături)'],
  ['snipdiaglist', 'Listă cu plăcuțe cu colțuri opuse tăiate (numărul pe o plăcuță cu colțul din dreapta sus și cel din stânga jos tăiate, textul într-o bandă alături)'],
  ['rounddiaglist', 'Listă cu plăcuțe cu colțuri opuse rotunjite (numărul pe o plăcuță cu colțul din stânga sus și cel din dreapta jos rotunjite, textul într-o bandă alături)'],
  ['quarterlist', 'Listă cu sferturi de cerc (numărul pe un sfert de cerc, textul într-o bandă alături)'],
  ['sniproundlist', 'Listă cu plăcuțe cu un colț tăiat și unul rotunjit (numărul pe o plăcuță cu colțul din stânga sus rotunjit și cel din dreapta sus tăiat, textul într-o bandă alături)'],
  ['ovalcalloutlist', 'Listă cu bule ovale (numărul într-o bulă ovală cu coada în jos, spre stânga, textul într-o bandă alături)'],
  ['roundcalloutlist', 'Listă cu bule rotunjite (numărul într-o bulă cu colțurile rotunjite și coada în jos, spre stânga, textul într-o bandă alături)'],
  ['chordlist', 'Listă cu segmente de cerc (numărul pe un cerc cu o bucată tăiată drept în dreapta sus, textul într-o bandă alături)'],
  ['displaylist', 'Listă cu ecrane (numărul pe forma de ecran, ascuțită în stânga și rotunjită în dreapta, textul într-o bandă alături)'],
  ['mergelist', 'Listă cu triunghiuri întoarse (numărul pe un triunghi cu vârful în jos, textul într-o bandă alături)'],
  ['cornerlist', 'Listă cu colțare (numărul în colțul unui L, textul într-o bandă alături)'],
  ['desklist', 'Listă cu pupitre (numărul pe o plăcuță cu marginea de sus înclinată, textul într-o bandă alături)'],
  ['stripelist', 'Listă cu benzi oblice (numărul pe o bandă oblică, textul într-o bandă alături)'],
  ['halfframelist', 'Listă cu jumătăți de cadru (numărul în colțul unei jumătăți de cadru, textul într-o bandă alături)'],
  ['storagelist', 'Listă cu date stocate (numărul pe o formă rotunjită în stânga și scobită în dreapta, textul într-o bandă alături)'],
  ['rightcalloutlist', 'Listă cu casete cu săgeată (numărul într-o casetă cu o săgeată spre text, textul într-o bandă alături)'],
  ['downcalloutlist', 'Listă cu casete cu săgeată în jos (numărul într-o casetă cu o săgeată în jos, textul într-o bandă alături)'],
  ['upcalloutlist', 'Listă cu casete cu săgeată în sus (numărul într-o casetă cu o săgeată în sus, textul într-o bandă alături)'],
  ['burst2list', 'Listă cu explozii mari (numărul pe o explozie cu colțuri lungi, textul într-o bandă alături)'],
  ['lrcalloutlist', 'Listă cu casete cu săgeți în ambele părți (numărul într-o casetă cu săgeți spre stânga și spre dreapta, textul într-o bandă alături)'],
  ['quadcalloutlist', 'Listă cu casete cu săgeți în patru părți (numărul într-o casetă cu săgeți în toate cele patru părți, textul într-o bandă alături)'],
  ['boltlist', 'Listă cu fulgere (numărul pe un fulger, textul într-o bandă alături)'],
  ['sparklist', 'Listă cu sclipiri (numărul pe o sclipire, o stea cu patru colțuri, textul într-o bandă alături)'],
  ['notchlist', 'Listă cu săgeți crestate (numărul pe o săgeată cu coada crestată, textul într-o bandă alături)'],
  ['star6list', 'Listă cu stele în șase colțuri (numărul pe o stea cu șase colțuri, textul într-o bandă alături)'],
  ['star8list', 'Listă cu rozete (numărul pe o rozetă, o stea cu opt colțuri, textul într-o bandă alături)'],
  ['calloutlist', 'Listă cu bule de vorbire (numărul într-o bulă de vorbire cu coada în jos, textul într-o bandă alături)'],
  ['signlist', 'Listă cu indicatoare (numărul pe un indicator în formă de săgeată spre dreapta, textul într-o bandă alături)'],
  ['moonlist', 'Listă cu semilune (numărul în partea plină a unei semilune, textul într-o bandă alături)'],
  ['dodecagonlist', 'Listă cu dodecagoane (numărul pe un dodecagon, cu 12 colțuri, textul într-o bandă alături)'],
  ['growthcurve', 'Curbă de creștere (ideile pe o curbă care urcă tot mai repede, din stânga jos spre dreapta sus)'],
  ['roadmap', 'Drum cu borne (etapele pe un drum care șerpuiește de la stânga la dreapta, pe rând deasupra și dedesubtul lui)'],
  ['mountain', 'Munte cu etape (etapele urcă pe o potecă în zigzag până pe vârf, unde e ultima, cu un steag)'],
  ['thermometer', 'Termometru (nivelurile pe scara unui termometru, de jos în sus, coloana plină până la ultimul)'],
  ['bridge', 'Pod (primul element pe malul din stânga, ultimul pe malul din dreapta, pașii dintre ele pe pod)'],
  ['tree', 'Copac (primul element e rădăcina, sub trunchi; celelalte sunt frunzele din coroană, legate de trunchi prin ramuri)'],
  ['compass', 'Busolă (primul element e în mijlocul rozei vânturilor; celelalte pe direcții: nord, est, sud, vest, apoi între ele)'],
  ['bulb', 'Bec cu idei (primul element e ideea, în bec; celelalte, în căsuțe în stânga și în dreapta lui, legate de bec prin raze)'],
  ['puzzle', 'Piese de puzzle (ideile pe piese care se îmbină una în alta, de la stânga la dreapta, pe unul sau două rânduri)'],
  ['iceberg', 'Aisberg (primul element e vârful, deasupra apei; celelalte, ce nu se vede, sub apă, unul sub altul)'],
  ['mindmap', 'Hartă mentală (primul element e subiectul, în mijloc; celelalte, ramurile, în dreapta și în stânga lui, legate prin linii curbe)'],
  ['fishbone', 'Os de pește (primul element e problema, în capul peștelui; celelalte, cauzele, pe oase sus și jos)'],
];
/** `lv` (doar la ierarhie, când are mai multe rânduri): nivelul fiecărui element (0 = cel de sus, apoi 1–3), aliniat cu `items`. */
export interface DocDiagram { k: DocDiagramKind; items: string[]; color: string; lv?: number[] }
export const DIAGRAM_MAX = 8;
export const DIAGRAM_W = 560;

export const newDiagram = (): DocDiagram => ({ k: 'process', items: ['Planificare', 'Execuție', 'Verificare', 'Îmbunătățire'], color: '#4f6bed' });

export function parseDiagram(v: unknown): DocDiagram | null {
  let o: unknown = v;
  if (typeof v === 'string') { try { o = JSON.parse(v); } catch { return null; } }
  if (!o || typeof o !== 'object') return null;
  const x = o as Record<string, unknown>;
  if (!Array.isArray(x.items)) return null;
  const items = x.items.map((t) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)).filter(Boolean).slice(0, DIAGRAM_MAX);
  if (!items.length) return null;
  const k = DOC_DIAGRAMS.some(([id]) => id === x.k) ? (x.k as DocDiagramKind) : 'process';
  const color = typeof x.color === 'string' && /^#[0-9a-f]{6}$/i.test(x.color) ? x.color.toLowerCase() : '#4f6bed';
  const lv = k === 'hierarchy' && Array.isArray(x.lv) ? fixLevels(items.map((_, i) => Number((x.lv as unknown[])[i]) || 1)) : undefined;
  return { k, items, color, ...(lv?.some((l) => l > 1) ? { lv } : {}) };
}

/** Nivelurile ierarhiei îndreptate: primul element e vârful (0), al doilea e 1, niciunul nu sare peste un nivel, cel mult 3. */
function fixLevels(ls: number[]): number[] {
  const out: number[] = [];
  ls.forEach((l, i) => out.push(i ? Math.max(1, Math.min(3, Math.round(l) || 1, out[i - 1] + 1)) : 0));
  return out;
}

/** Nivelurile scrise în fereastră: fiecare tab sau pereche de spații de la începutul rândului coboară elementul un nivel. */
export function levelsFromText(text: string): number[] {
  const lines = text.split(/\r?\n/).filter((t) => t.trim()).slice(0, DIAGRAM_MAX);
  return fixLevels(lines.map((l) => { const m = /^[\t ]*/.exec(l)![0]; return 1 + (m.match(/\t/g)?.length ?? 0) + Math.floor((m.match(/ /g)?.length ?? 0) / 2); }));
}

/** Textul din fereastră pentru o diagramă: un element pe rând, la ierarhie cu câte două spații pe nivel. */
export const diagramText = (d: DocDiagram) => d.items.map((t, i) => (d.lv && i ? '  '.repeat(Math.max(0, d.lv[i] - 1)) : '') + t).join('\n');

/** Elementele scrise în fereastră: câte unul pe rând, fără rândurile goale. */
export const itemsFromText = (text: string) => text.split(/\r?\n/).map((t) => t.trim()).filter(Boolean).slice(0, DIAGRAM_MAX);

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Culoarea amestecată cu alb (t = 0 … 1). */
function tint(hex: string, t: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * t));
  return `rgb(${c.join(',')})`;
}
/** Textul rupt pe rânduri care încap în lățimea w (aproximativ, după mărimea literelor), cel mult 3 rânduri. */
export function wrapText(text: string, w: number, size: number): string[] {
  const max = Math.max(4, Math.floor(w / (size * 0.56)));
  const lines: string[] = [];
  let cur = '';
  for (const word of text.split(' ')) {
    const next = cur ? `${cur} ${word}` : word;
    if (next.length <= max) { cur = next; continue; }
    if (cur) lines.push(cur);
    cur = word.length > max ? word.slice(0, max - 1) + '…' : word;
  }
  if (cur) lines.push(cur);
  return lines.length > 3 ? [...lines.slice(0, 2), lines[2].slice(0, max - 1) + '…'] : lines;
}
function label(text: string, cx: number, cy: number, w: number, size: number, fill: string) {
  const lines = wrapText(text, w, size);
  const y0 = cy - ((lines.length - 1) * size * 1.2) / 2;
  return `<text x="${cx}" y="${y0}" font-size="${size}" fill="${fill}" text-anchor="middle" dominant-baseline="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="600">`
    + lines.map((l, i) => `<tspan x="${cx}" y="${(y0 + i * size * 1.2).toFixed(1)}">${esc(l)}</tspan>`).join('') + '</text>';
}

/**
 * Venn radial pentru m cercuri în jur, într-un cerc mare de rază 1: raza cercului din mijloc (c), diametrul cercurilor din jur (d)
 * și depărtarea lor de centru (R). Fiecare cerc din jur intră cu 15% din diametru în cel din mijloc și atinge marginea mare;
 * c crește până când vecinii nu se mai suprapun (la 7–8 cercuri cel din mijloc e mai mare și cele din jur mai mici).
 */
export function radialVennFit(m: number): { c: number; d: number; R: number } {
  const k = 0.15, fit = (c: number) => { const d = (1 - c) / (1 - k); return { c, d, R: c + (0.5 - k) * d }; };
  let c = 0.4;
  while (c < 0.8 && m >= 2) { const t = fit(c); if (2 * t.R * Math.sin(Math.PI / m) >= t.d * 1.02) break; c += 0.01; }
  return fit(c);
}

type Rect = { x: number; y: number; w: number; h: number };
/**
 * Matrice cu titlu pentru m căsuțe într-o zonă w × h: grila cu câte două pe rând (la număr impar ultima ocupă tot rândul),
 * caseta din mijloc (titlul) peste colțurile lor și, pentru fiecare căsuță, partea ei pe care n-o acoperă titlul (acolo stă textul):
 * la cele din stânga partea din stânga, la cele din dreapta partea din dreapta, la cea lată partea de sub titlu.
 */
export function titledMatrixLayout(m: number, w: number, h: number, gap = 10): { boxes: (Rect & { text: Rect; ha: 'left' | 'center' | 'right'; va: 'top' | 'middle' | 'bottom' })[]; mid: Rect } {
  const rows = Math.max(1, Math.ceil(m / 2)), bw = (w - gap) / 2, bh = (h - (rows - 1) * gap) / rows;
  const cw = w * 0.36, ch = rows === 1 ? h * 0.6 : Math.min(h * 0.36, bh * 0.9), mid = { x: (w - cw) / 2, y: (h - ch) / 2, w: cw, h: ch };
  const boxes = [];
  for (let i = 0; i < m; i++) {
    const r = Math.floor(i / 2), wide = i === m - 1 && m % 2 === 1, c = i % 2;
    const b = { x: wide ? 0 : c * (bw + gap), y: r * (bh + gap), w: wide ? w : bw, h: bh };
    const ha = wide ? 'center' as const : c ? 'right' as const : 'left' as const;
    const va = rows === 1 || (r > 0 && r < rows - 1) ? 'middle' as const : r === 0 && !wide ? 'top' as const : 'bottom' as const;
    let text: Rect = { ...b };
    if (ha === 'left') text = { ...b, w: Math.min(b.w, mid.x - b.x - 6) };
    else if (ha === 'right') { const x = Math.max(b.x, mid.x + mid.w + 6); text = { ...b, x, w: b.x + b.w - x }; }
    else if (mid.y + mid.h > b.y && mid.y < b.y + b.h) { const y = Math.min(b.y + b.h * 0.6, mid.y + mid.h + 4); text = { ...b, y, h: b.y + b.h - y }; }
    boxes.push({ ...b, text, ha, va });
  }
  return { boxes, mid };
}

/** Desenul diagramei ca SVG; întoarce și înălțimea (lățimea e mereu DIAGRAM_W). */
export function diagramSvg(d: DocDiagram): { svg: string; h: number } {
  const W = DIAGRAM_W, n = d.items.length, col = d.color;
  const parts: string[] = [];
  let H = 200;
  if (d.k === 'process' || d.k === 'chevrons') {
    const gap = d.k === 'process' ? 26 : -6, bw = (W - 20 - gap * (n - 1)) / n, bh = 90, y = 20;
    H = bh + 40;
    d.items.forEach((t, i) => {
      const x = 10 + i * (bw + gap), fill = tint(col, i * 0.12);
      if (d.k === 'process') {
        parts.push(`<rect x="${x.toFixed(1)}" y="${y}" width="${bw.toFixed(1)}" height="${bh}" rx="10" fill="${fill}"/>`);
        if (i < n - 1) { const ax = x + bw + 5, ay = y + bh / 2; parts.push(`<path d="M${ax.toFixed(1)} ${ay - 9} L${(ax + 16).toFixed(1)} ${ay} L${ax.toFixed(1)} ${ay + 9} Z" fill="${tint(col, 0.4)}"/>`); }
      } else {
        const p = 22, pts = [[x, y], [x + bw - p, y], [x + bw, y + bh / 2], [x + bw - p, y + bh], [x, y + bh], [x + (i ? p : 0), y + bh / 2]];
        parts.push(`<polygon points="${pts.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ')}" fill="${fill}" stroke="#fff" stroke-width="2"/>`);
      }
      parts.push(label(t, x + bw / 2 + (d.k === 'chevrons' && i ? 6 : 0), y + bh / 2, bw - (d.k === 'chevrons' ? 34 : 14), n > 5 ? 12 : 15, '#fff'));
    });
  } else if (d.k === 'list') {
    const rh = 44, gap = 8;
    H = 20 + n * (rh + gap);
    d.items.forEach((t, i) => {
      const y = 10 + i * (rh + gap);
      parts.push(`<rect x="10" y="${y}" width="${rh}" height="${rh}" rx="8" fill="${col}"/>`, label(String(i + 1), 10 + rh / 2, y + rh / 2, rh, 18, '#fff'));
      parts.push(`<rect x="${20 + rh}" y="${y}" width="${W - 30 - rh}" height="${rh}" rx="8" fill="${tint(col, 0.82)}"/>`);
      parts.push(label(t, 20 + rh + (W - 30 - rh) / 2, y + rh / 2, W - 60 - rh, 15, '#1f2937'));
    });
  } else if (d.k === 'cycle') {
    H = 360;
    const cx = W / 2, cy = H / 2, R = 125, r = n > 5 ? 44 : 54;
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${tint(col, 0.6)}" stroke-width="6"/>`);
    d.items.forEach((t, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
      // O săgeată mică pe cerc, la jumătatea drumului spre elementul următor.
      const m = a + Math.PI / n, mx = cx + R * Math.cos(m), my = cy + R * Math.sin(m), tx = -Math.sin(m), ty = Math.cos(m), nx = Math.cos(m), ny = Math.sin(m);
      parts.push(`<path d="M${(mx + tx * 12).toFixed(1)} ${(my + ty * 12).toFixed(1)} L${(mx - tx * 4 + nx * 10).toFixed(1)} ${(my - ty * 4 + ny * 10).toFixed(1)} L${(mx - tx * 4 - nx * 10).toFixed(1)} ${(my - ty * 4 - ny * 10).toFixed(1)} Z" fill="${tint(col, 0.35)}"/>`);
      parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${tint(col, i * 0.1)}"/>`, label(t, x, y, r * 1.7, n > 5 ? 11 : 13, '#fff'));
    });
  } else if (d.k === 'pyramid') {
    const bh = 52;
    H = 20 + n * bh;
    const top = 10, cx = W / 2, half = (W - 40) / 2;
    d.items.forEach((t, i) => {
      const y0 = top + i * bh, y1 = y0 + bh, w0 = (half * i) / n, w1 = (half * (i + 1)) / n;
      parts.push(`<polygon points="${(cx - w0).toFixed(1)},${y0} ${(cx + w0).toFixed(1)},${y0} ${(cx + w1).toFixed(1)},${y1} ${(cx - w1).toFixed(1)},${y1}" fill="${tint(col, i * 0.1)}" stroke="#fff" stroke-width="2"/>`);
      parts.push(label(t, cx, (y0 + y1) / 2 + 4, Math.max(60, w0 + w1), 14, '#fff'));
    });
  } else if (d.k === 'invpyramid') {
    // Piramida întoarsă: primul nivel e cel mai lat, sus; ultimul se strânge într-un vârf, jos (ca o pâlnie fără gât).
    const bh = 52;
    H = 20 + n * bh;
    const top = 10, cx = W / 2, half = (W - 40) / 2;
    d.items.forEach((t, i) => {
      const y0 = top + i * bh, y1 = y0 + bh, w0 = (half * (n - i)) / n, w1 = (half * (n - i - 1)) / n;
      parts.push(`<polygon points="${(cx - w0).toFixed(1)},${y0} ${(cx + w0).toFixed(1)},${y0} ${(cx + w1).toFixed(1)},${y1} ${(cx - w1).toFixed(1)},${y1}" fill="${tint(col, i * 0.1)}" stroke="#fff" stroke-width="2"/>`);
      parts.push(label(t, cx, (y0 + y1) / 2 + 4, Math.max(60, w0 + w1), 14, '#fff'));
    });
  } else if (d.k === 'stairs') {
    // Trepte pe aceeași bază, fiecare mai înaltă decât cea din stânga; textul sus, în treaptă.
    const gap = 8, bw = (W - 20 - gap * (n - 1)) / n, top = 10;
    H = 230;
    d.items.forEach((t, i) => {
      const h = ((H - 20) * (i + 1)) / n, x = 10 + i * (bw + gap), y = H - 10 - h;
      parts.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="4" fill="${tint(col, (n - 1 - i) * 0.1)}"/>`);
      parts.push(label(t, x + bw / 2, Math.max(top + 14, y + 24), bw - 10, n > 5 ? 11 : 14, '#fff'));
    });
  } else if (d.k === 'matrix') {
    // Grilă: 2 coloane până la 4 elemente, apoi 3, apoi 4; ultimul rând incomplet stă la mijloc.
    const cols = n <= 4 ? 2 : n <= 6 ? 3 : 4, rows = Math.ceil(n / cols), gap = 10, bh = 72;
    const bw = (W - 20 - gap * (cols - 1)) / cols;
    H = 20 + rows * bh + (rows - 1) * gap;
    d.items.forEach((t, i) => {
      const r = Math.floor(i / cols), c = i % cols, inRow = Math.min(cols, n - r * cols);
      const x = 10 + ((cols - inRow) * (bw + gap)) / 2 + c * (bw + gap), y = 10 + r * (bh + gap);
      parts.push(`<rect x="${x.toFixed(1)}" y="${y}" width="${bw.toFixed(1)}" height="${bh}" rx="10" fill="${tint(col, (i % 4) * 0.12)}"/>`, label(t, x + bw / 2, y + bh / 2, bw - 14, 15, '#fff'));
    });
  } else if (d.k === 'venn') {
    // Cercuri suprapuse cu ~40%, pe jumătate transparente; textul spre marginea dinafară a fiecărui cerc.
    H = 330;
    const cx = W / 2, cy = H / 2, r = H / 2 - 10;
    const dm = n === 1 ? H - 20 : n === 2 ? Math.min((W - 20) / 1.6, H - 20) : r / (0.5 + 0.3 / Math.sin(Math.PI / n));
    const R = n === 1 ? 0 : n === 2 ? dm * 0.3 : r - dm / 2;
    d.items.forEach((t, i) => {
      const a = n === 2 ? Math.PI * (i + 1) : -Math.PI / 2 + (2 * Math.PI * i) / n, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
      parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(dm / 2).toFixed(1)}" fill="${tint(col, i * 0.12)}" fill-opacity="0.55"/>`);
      const o = dm * 0.2;
      parts.push(label(t, x + o * Math.cos(a), y + o * Math.sin(a), dm * 0.55, n > 5 ? 11 : 14, '#1f2937'));
    });
  } else if (d.k === 'funnel') {
    // Pâlnie: trapeze tot mai înguste de sus în jos; ultimul are 40% din lățimea primului.
    const bh = 50, gap = 4, top = 10, cx = W / 2, half = (W - 40) / 2, hh = n * bh;
    H = 20 + hh;
    const at = (y: number) => half * (1 - (0.6 * y) / hh);
    d.items.forEach((t, i) => {
      const y0 = top + i * bh, y1 = y0 + bh - gap, w0 = at(i * bh), w1 = at((i + 1) * bh - gap);
      parts.push(`<polygon points="${(cx - w0).toFixed(1)},${y0} ${(cx + w0).toFixed(1)},${y0} ${(cx + w1).toFixed(1)},${y1} ${(cx - w1).toFixed(1)},${y1}" fill="${tint(col, i * 0.1)}"/>`);
      parts.push(label(t, cx, (y0 + y1) / 2, Math.max(60, w0 + w1 - 30), 14, '#fff'));
    });
  } else if (d.k === 'timeline') {
    // Cronologie: o linie cu un cerc pentru fiecare moment; textele pe rând deasupra și dedesubt, legate de linie.
    H = 230;
    const cy = H / 2, slot = (W - 20) / n, bw = Math.min(slot * 1.5, 190), bh = 62, line = tint(col, 0.5);
    parts.push(`<rect x="10" y="${cy - 2}" width="${W - 20}" height="4" rx="2" fill="${line}"/>`);
    d.items.forEach((t, i) => {
      const x = 10 + (i + 0.5) * slot, up = i % 2 === 0, y = up ? cy - 40 - bh : cy + 40;
      const bx = Math.max(10, Math.min(W - 10 - bw, x - bw / 2));
      parts.push(`<path d="M${x.toFixed(1)} ${up ? y + bh : cy} V${up ? cy : y}" stroke="${line}" stroke-width="3"/>`);
      parts.push(`<circle cx="${x.toFixed(1)}" cy="${cy}" r="20" fill="${col}" stroke="#fff" stroke-width="3"/>`);
      parts.push(`<rect x="${bx.toFixed(1)}" y="${y}" width="${bw.toFixed(1)}" height="${bh}" rx="10" fill="${tint(col, 0.12 + (i % 3) * 0.1)}"/>`, label(t, bx + bw / 2, y + bh / 2, bw - 14, n > 5 ? 12 : 14, '#fff'));
    });
  } else if (d.k === 'zigzagblocks') {
    // Blocuri în zigzag: pașii de la stânga la dreapta, în dreptunghiuri rotunjite, pe rând pe rândul de sus și pe cel de jos;
    // fiecare bloc începe înainte să se termine cel dinainte, ca șirul să se citească în zigzag.
    const bh = 64, gap = 12, bw = n === 1 ? 200 : Math.min(200, (W - 20) / (1 + 0.62 * (n - 1))), step = n === 1 ? 0 : (W - 20 - bw) / (n - 1);
    H = 20 + 2 * bh + gap;
    d.items.forEach((t, i) => {
      const x = n === 1 ? (W - bw) / 2 : 10 + i * step, y = 10 + (i % 2) * (bh + gap);
      parts.push(`<rect x="${x.toFixed(1)}" y="${y}" width="${bw.toFixed(1)}" height="${bh}" rx="10" fill="${tint(col, (i % 4) * 0.12)}"/>`, label(t, x + bw / 2, y + bh / 2, bw - 14, n > 5 ? 12 : 14, '#fff'));
    });
  } else if (d.k === 'brickpyramid') {
    // Piramidă din blocuri: rânduri de 1, 2, 3… blocuri, centrate, ca o piramidă de cărămizi; ideile umplu blocurile de sus în jos
    // și de la stânga la dreapta, iar blocurile rămase fără idee sunt doar colorate deschis, ca piramida să rămână întreagă.
    let rows = 1;
    while ((rows * (rows + 1)) / 2 < n) rows++;
    const gap = 6, bh = 52, bw = (W - 20 - (rows - 1) * gap) / rows;
    H = 20 + rows * bh + (rows - 1) * gap;
    let i = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c <= r; c++, i++) {
      const x = W / 2 - ((r + 1) * bw + r * gap) / 2 + c * (bw + gap), y = 10 + r * (bh + gap);
      parts.push(`<rect x="${x.toFixed(1)}" y="${y}" width="${bw.toFixed(1)}" height="${bh}" rx="6" fill="${i < n ? tint(col, (r % 3) * 0.14) : tint(col, 0.82)}"/>`);
      if (i < n) parts.push(label(d.items[i], x + bw / 2, y + bh / 2, bw - 12, rows > 3 ? 12 : 14, '#fff'));
    }
  } else if (d.k === 'ladder') {
    // Scară: două bare verticale (lonjeroanele) și pașii pe trepte între ele, primul jos, ultimul sus (urcarea spre scop).
    const bh = 40, gap = 14, rail = 10, bw = 300, x = (W - bw) / 2;
    H = 20 + n * bh + (n + 1) * gap;
    parts.push(`<rect x="${x - rail}" y="10" width="${rail}" height="${H - 20}" rx="4" fill="${tint(col, 0.55)}"/>`, `<rect x="${x + bw}" y="10" width="${rail}" height="${H - 20}" rx="4" fill="${tint(col, 0.55)}"/>`);
    d.items.forEach((t, i) => {
      const y = H - 10 - (i + 1) * (bh + gap);
      parts.push(`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="6" fill="${tint(col, (i % 4) * 0.12)}"/>`, label(t, W / 2, y + bh / 2, bw - 16, 13, '#fff'));
    });
  } else if (d.k === 'pillars') {
    // Coloane pe o bază: ideile în coloane înalte, alăturate, sprijinite pe o bară comună (ce ține totul împreună).
    const gap = 10, base = 22, ch = 170, cw = Math.min(120, (W - 20 - (n - 1) * gap) / n), gw = n * cw + (n - 1) * gap, left = (W - gw) / 2;
    H = 20 + ch + 6 + base;
    d.items.forEach((t, i) => {
      const x = left + i * (cw + gap);
      parts.push(`<rect x="${x.toFixed(1)}" y="10" width="${cw.toFixed(1)}" height="${ch}" rx="6" fill="${tint(col, (i % 4) * 0.12)}"/>`, label(t, x + cw / 2, 10 + ch / 2, cw - 10, n > 5 ? 11 : 13, '#fff'));
    });
    parts.push(`<rect x="${Math.max(6, left - 16).toFixed(1)}" y="${16 + ch}" width="${Math.min(W - 12, gw + 32).toFixed(1)}" height="${base}" rx="4" fill="${tint(col, 0.55)}"/>`);
  } else if (d.k === 'incarrows') {
    // Săgeți crescătoare: câte o săgeată pe rând, toate pornind din stânga; fiecare e mai lungă decât cea de deasupra (ceva care crește).
    const bh = 44, gap = 8, hd = 26, full = W - 20, min = full * 0.45;
    H = 20 + n * bh + (n - 1) * gap;
    d.items.forEach((t, i) => {
      const len = n === 1 ? full : min + ((full - min) * i) / (n - 1), y = 10 + i * (bh + gap), x = 10;
      parts.push(`<polygon points="${x},${y} ${(x + len - hd).toFixed(1)},${y} ${(x + len).toFixed(1)},${y + bh / 2} ${(x + len - hd).toFixed(1)},${y + bh} ${x},${y + bh}" fill="${tint(col, (n - 1 - i) * 0.1)}"/>`, label(t, x + (len - hd) / 2, y + bh / 2, len - hd - 12, 13, '#fff'));
    });
  } else if (d.k === 'phasebar') {
    // Bară cu etape: o singură bară rotunjită la capete, tăiată în segmente egale, lipite, câte o etapă pe segment (despărțite de linii albe).
    const bh = 70, r = 14, sw = (W - 20) / n;
    H = 20 + bh;
    d.items.forEach((t, i) => {
      const x = 10 + i * sw, rl = i === 0 ? r : 0, rr = i === n - 1 ? r : 0, y = 10, w = sw;
      parts.push(`<path d="M${(x + rl).toFixed(1)} ${y} H${(x + w - rr).toFixed(1)} Q${(x + w).toFixed(1)} ${y} ${(x + w).toFixed(1)} ${y + rr} V${y + bh - rr} Q${(x + w).toFixed(1)} ${y + bh} ${(x + w - rr).toFixed(1)} ${y + bh} H${(x + rl).toFixed(1)} Q${x.toFixed(1)} ${y + bh} ${x.toFixed(1)} ${y + bh - rl} V${y + rl} Q${x.toFixed(1)} ${y} ${(x + rl).toFixed(1)} ${y} Z" fill="${tint(col, (i % 4) * 0.12)}"/>`, label(t, x + w / 2, y + bh / 2, w - 12, n > 5 ? 11 : 13, '#fff'));
      if (i) parts.push(`<rect x="${(x - 1).toFixed(1)}" y="${y}" width="2" height="${bh}" fill="#fff"/>`);
    });
  } else if (d.k === 'radialcluster') {
    // Radial cu blocuri: primul element într-un dreptunghi rotunjit în mijloc, celelalte în dreptunghiuri rotunjite pe o elipsă în jurul lui,
    // fiecare legat de mijloc printr-o linie (liniile desenate primele, sub blocuri).
    H = 360;
    const m = n - 1, cx = W / 2, cy = H / 2, line = tint(col, 0.5), bw = m > 5 ? 120 : 150, bh = 56, cw = 150, ch = 70;
    const rx = W / 2 - bw / 2 - 10, ry = H / 2 - bh / 2 - 10, at = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / Math.max(1, m);
    const pos = (i: number) => ({ x: cx + rx * Math.cos(at(i)), y: cy + ry * Math.sin(at(i)) });
    for (let i = 0; i < m; i++) { const p = pos(i); parts.push(`<path d="M${cx} ${cy} L${p.x.toFixed(1)} ${p.y.toFixed(1)}" stroke="${line}" stroke-width="3"/>`); }
    parts.push(`<rect x="${cx - cw / 2}" y="${cy - ch / 2}" width="${cw}" height="${ch}" rx="12" fill="${col}"/>`, label(d.items[0], cx, cy, cw - 16, 15, '#fff'));
    for (let i = 0; i < m; i++) {
      const p = pos(i);
      parts.push(`<rect x="${(p.x - bw / 2).toFixed(1)}" y="${(p.y - bh / 2).toFixed(1)}" width="${bw}" height="${bh}" rx="10" fill="${tint(col, 0.2 + (i % 3) * 0.1)}"/>`, label(d.items[i + 1], p.x, p.y, bw - 14, m > 5 ? 12 : 13, '#fff'));
    }
  } else if (d.k === 'gridaxes') {
    // Grilă cu axe: ideile câte două pe rând, în dreptunghiuri; între coloane o axă verticală, între rânduri câte o axă orizontală
    // (bare subțiri care se încrucișează, desenate sub dreptunghiuri). La număr impar ultima idee stă singură, la mijloc, peste axă.
    const rows = Math.max(1, Math.ceil(n / 2)), gap = 28, bh = rows <= 2 ? 104 : 78, bw = (W - 20 - gap) / 2, axis = tint(col, 0.45);
    H = 20 + rows * bh + (rows - 1) * gap;
    parts.push(`<rect x="${W / 2 - 2}" y="4" width="4" height="${H - 8}" rx="2" fill="${axis}"/>`);
    for (let r = 1; r < rows; r++) parts.push(`<rect x="4" y="${10 + r * (bh + gap) - gap / 2 - 2}" width="${W - 8}" height="4" rx="2" fill="${axis}"/>`);
    d.items.forEach((t, i) => {
      const r = Math.floor(i / 2), alone = i === n - 1 && n % 2 === 1, x = alone ? (W - bw) / 2 : 10 + (i % 2) * (bw + gap), y = 10 + r * (bh + gap);
      parts.push(`<rect x="${x.toFixed(1)}" y="${y}" width="${bw.toFixed(1)}" height="${bh}" rx="10" fill="${tint(col, (i % 4) * 0.12)}"/>`, label(t, x + bw / 2, y + bh / 2, bw - 20, 15, '#fff'));
    });
  } else if (d.k === 'radial') {
    // Radial: primul element în cercul din mijloc, celelalte în cercuri în jurul lui, legate de mijloc prin linii.
    H = 360;
    const m = n - 1, cx = W / 2, cy = H / 2, r = H / 2 - 10, line = tint(col, 0.5);
    const s = 1.7 * Math.sin(Math.PI / Math.max(3, m)), dd = Math.min(r * 0.6, (s * r) / (1 + s / 2)), R = r - dd / 2;
    const rc = m ? Math.min(r * 0.32, R - dd / 2 - 20) : r * 0.45;
    const at = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / m;
    for (let i = 0; i < m; i++) parts.push(`<path d="M${cx} ${cy} L${(cx + R * Math.cos(at(i))).toFixed(1)} ${(cy + R * Math.sin(at(i))).toFixed(1)}" stroke="${line}" stroke-width="3"/>`);
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${rc.toFixed(1)}" fill="${col}"/>`, label(d.items[0], cx, cy, rc * 1.7, 15, '#fff'));
    for (let i = 0; i < m; i++) {
      const x = cx + R * Math.cos(at(i)), y = cy + R * Math.sin(at(i));
      parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(dd / 2).toFixed(1)}" fill="${tint(col, 0.2 + (i % 3) * 0.1)}"/>`, label(d.items[i + 1], x, y, dd * 0.85, m > 5 ? 11 : 13, '#fff'));
    }
  } else if (d.k === 'target') {
    // Țintă: cercuri unul în altul, primul element pe cel mai mare; textul fiecăruia sus, în inelul lui, iar al celui din mijloc în centru.
    H = 340;
    const cx = W / 2, cy = H / 2, R = H / 2 - 10, band = n > 1 ? (R * (1 - Math.max(1 / n, 0.36))) / (n - 1) : R;
    d.items.forEach((_, i) => {
      const ri = R - i * band;
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${ri.toFixed(1)}" fill="${i % 2 ? tint(col, 0.35) : tint(col, i * 0.08)}" stroke="#fff" stroke-width="2"/>`);
    });
    d.items.forEach((t, i) => {
      const ri = R - i * band, last = i === n - 1;
      parts.push(label(t, cx, last ? cy : cy - ri + band / 2, last ? ri * 1.6 : Math.max(60, ri * 1.2), n > 5 ? 11 : 13, '#fff'));
    });
  } else if (d.k === 'vprocess') {
    // Proces vertical: cutii una sub alta, la mijloc, cu o săgeată în jos între ele.
    const bw = Math.min(380, W - 40), bh = n > 5 ? 44 : 52, gap = 26, x = (W - bw) / 2;
    H = 20 + n * bh + (n - 1) * gap;
    d.items.forEach((t, i) => {
      const y = 10 + i * (bh + gap);
      parts.push(`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="10" fill="${tint(col, i * 0.1)}"/>`, label(t, W / 2, y + bh / 2, bw - 20, 15, '#fff'));
      if (i < n - 1) { const ay = y + bh + 5; parts.push(`<path d="M${W / 2 - 10} ${ay} L${W / 2 + 10} ${ay} L${W / 2} ${ay + 16} Z" fill="${tint(col, 0.4)}"/>`); }
    });
  } else if (d.k === 'bending') {
    // Proces șerpuit: câte 3 cutii pe rând (4 de la 7 elemente); rândurile pare merg de la dreapta la stânga, iar la capătul rândului
    // o săgeată coboară spre rândul următor, ca drumul să nu se rupă.
    const cols = Math.min(n, n > 6 ? 4 : 3), rows = Math.ceil(n / cols), gapX = 30, gapY = 30, bh = 64;
    const bw = (W - 20 - gapX * (cols - 1)) / cols, arrow = tint(col, 0.4);
    H = 20 + rows * bh + (rows - 1) * gapY;
    const at = (i: number) => { const r = Math.floor(i / cols), c = i % cols; return { r, x: 10 + (r % 2 ? cols - 1 - c : c) * (bw + gapX), y: 10 + r * (bh + gapY) }; };
    d.items.forEach((t, i) => {
      const { r, x, y } = at(i);
      parts.push(`<rect x="${x.toFixed(1)}" y="${y}" width="${bw.toFixed(1)}" height="${bh}" rx="10" fill="${tint(col, (i % 4) * 0.1)}"/>`, label(t, x + bw / 2, y + bh / 2, bw - 14, n > 5 ? 12 : 14, '#fff'));
      if (i === n - 1) return;
      const nx = at(i + 1);
      if (nx.r === r) {
        const ay = y + bh / 2, ax = r % 2 ? x - 6 : x + bw + 6, dir = r % 2 ? -1 : 1;
        parts.push(`<path d="M${ax.toFixed(1)} ${ay - 9} L${(ax + dir * 16).toFixed(1)} ${ay} L${ax.toFixed(1)} ${ay + 9} Z" fill="${arrow}"/>`);
      } else {
        const ax = x + bw / 2, ay = y + bh + 6;
        parts.push(`<path d="M${(ax - 9).toFixed(1)} ${ay} L${(ax + 9).toFixed(1)} ${ay} L${ax.toFixed(1)} ${ay + 16} Z" fill="${arrow}"/>`);
      }
    });
  } else if (d.k === 'basicpie') {
    // Plăcintă: un cerc plin tăiat în felii egale din centru, prima felie sus, în sensul acelor de ceas; textul la 60% din rază, în mijlocul feliei.
    H = 340;
    const cx = W / 2, cy = H / 2, R = H / 2 - 10, mid = R * (n > 4 ? 0.64 : 0.58);
    const pt = (a: number, rr: number) => `${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`;
    if (n === 1) parts.push(`<circle cx="${cx}" cy="${cy}" r="${R}" fill="${col}"/>`);
    d.items.forEach((t, i) => {
      const a0 = -Math.PI / 2 + (2 * Math.PI * i) / n, a1 = a0 + (2 * Math.PI) / n, big = a1 - a0 > Math.PI ? 1 : 0;
      if (n > 1) parts.push(`<path d="M${cx} ${cy} L${pt(a0, R)} A${R} ${R} 0 ${big} 1 ${pt(a1, R)} Z" fill="${tint(col, (i % 4) * 0.12)}" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>`);
      const am = (a0 + a1) / 2, lx = n === 1 ? cx : cx + mid * Math.cos(am), ly = n === 1 ? cy : cy + mid * Math.sin(am);
      // Lățimea textului: coarda feliei la locul textului (la 2 felii, jumătatea de cerc e largă), ca textul să nu iasă din felie.
      const lw = n === 1 ? R * 1.4 : n === 2 ? R * 0.9 : Math.min(R * 0.8, 2 * mid * Math.sin(Math.PI / n) - 10);
      parts.push(label(t, lx, ly, Math.max(50, lw), n > 5 ? 11 : 13, '#fff'));
    });
  } else if (d.k === 'nestedtarget') {
    // Țintă cu dreptunghiuri: dreptunghiuri unul în altul, primul element pe cel mai mare; fiecare e mai mic cu o bandă sus și câte o margine
    // la stânga, dreapta și jos; textul fiecăruia stă în banda lui de sus, iar al ultimului în mijlocul lui.
    H = 340;
    const side = Math.min(26, 120 / Math.max(1, n - 1)), band = n > 1 ? Math.min(52, (H - 20 - 70) / (n - 1) - side * 0.4) : 0;
    d.items.forEach((t, i) => {
      const x = 10 + i * side, y = 10 + i * band, w = W - 20 - 2 * i * side, h = H - 20 - i * (band + side * 0.4), last = i === n - 1;
      parts.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="8" fill="${tint(col, (i % 2 ? 0.3 : 0) + i * 0.06)}" stroke="#fff" stroke-width="2"/>`);
      parts.push(label(t, x + w / 2, last ? y + h / 2 : y + band / 2, last ? w - 20 : w - 30, n > 5 ? 11 : 13, '#fff'));
    });
  } else if (d.k === 'segments') {
    // Cerc împărțit: un inel tăiat în felii egale, prima felie sus, în sensul acelor de ceas; textul în mijlocul feliei.
    H = 340;
    const cx = W / 2, cy = H / 2, R = H / 2 - 10, r0 = R * 0.42, mid = (R + r0) / 2;
    if (n === 1) parts.push(`<circle cx="${cx}" cy="${cy}" r="${R}" fill="${col}"/>`, `<circle cx="${cx}" cy="${cy}" r="${r0.toFixed(1)}" fill="#fff"/>`);
    const pt = (a: number, rr: number) => `${(cx + rr * Math.cos(a)).toFixed(1)} ${(cy + rr * Math.sin(a)).toFixed(1)}`;
    d.items.forEach((t, i) => {
      const a0 = -Math.PI / 2 + (2 * Math.PI * i) / n, a1 = a0 + (2 * Math.PI) / n, big = n === 1 ? 0 : a1 - a0 > Math.PI ? 1 : 0;
      if (n > 1) parts.push(`<path d="M${pt(a0, R)} A${R} ${R} 0 ${big} 1 ${pt(a1, R)} L${pt(a1, r0)} A${r0.toFixed(1)} ${r0.toFixed(1)} 0 ${big} 0 ${pt(a0, r0)} Z" fill="${tint(col, (i % 4) * 0.12)}" stroke="#fff" stroke-width="3"/>`);
      const am = (a0 + a1) / 2, lx = n === 1 ? cx : cx + mid * Math.cos(am), ly = n === 1 ? cy - mid : cy + mid * Math.sin(am);
      // Textul stă în lățimea inelului și a feliei (coarda la mijlocul inelului), ca să nu iasă din felie.
      // La cel mult 4 felii, felia e largă și pe orizontală, deci textul poate ieși puțin din lățimea inelului.
      const lw = n === 1 ? R : n <= 4 ? R - r0 + 10 : Math.min(R - r0 - 14, 2 * mid * Math.sin(Math.PI / n) - 8);
      parts.push(label(t, lx, ly, Math.max(50, lw), n > 5 ? 11 : 12, '#fff'));
    });
  } else if (d.k === 'arrowprocess') {
    // Săgeată continuă: o săgeată mare și deschisă la culoare pe toată lățimea, cu pașii în cutii pe ea, înainte de vârf.
    const ah = 150, head = 90, gap = 12, room = W - 30 - head / 2, bw = (room - gap * (n - 1)) / n, bh = 64, cy = 10 + ah / 2;
    H = ah + 20;
    parts.push(`<path d="M10 10 L${W - 10 - head} 10 L${W - 10} ${cy} L${W - 10 - head} ${10 + ah} L10 ${10 + ah} Z" fill="${tint(col, 0.7)}"/>`);
    d.items.forEach((t, i) => {
      const x = 20 + i * (bw + gap);
      parts.push(`<rect x="${x.toFixed(1)}" y="${cy - bh / 2}" width="${bw.toFixed(1)}" height="${bh}" rx="10" fill="${tint(col, (i % 4) * 0.1)}"/>`, label(t, x + bw / 2, cy, bw - 12, n > 5 ? 11 : 13, '#fff'));
    });
  } else if (d.k === 'diverge') {
    // Radial divergent: primul element în cercul din mijloc, celelalte în căsuțe în jurul lui, cu săgeți groase din mijloc spre ele.
    H = 360;
    const m = n - 1, cx = W / 2, cy = H / 2, r = H / 2 - 10, dc = r * 0.56;
    const s = 1.7 * Math.sin(Math.PI / Math.max(3, m)), dd = Math.min(r * 0.5, (s * r) / (1 + s / 2)), bw = dd * 1.5, bh = dd * 0.7, R = r - bh / 2;
    const at = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / m;
    const pt = (x: number, y: number) => `${x.toFixed(1)},${y.toFixed(1)}`;
    for (let i = 0; i < m; i++) {
      const ux = Math.cos(at(i)), uy = Math.sin(at(i)), vx = -uy, vy = ux;
      const edge = Math.min(Math.abs(ux) > 1e-6 ? bw / 2 / Math.abs(ux) : Infinity, Math.abs(uy) > 1e-6 ? bh / 2 / Math.abs(uy) : Infinity);
      const a = R - edge - 5, b = dc / 2 + 6, L = a - b, t = Math.min(dd * 0.32, Math.max(8, L * 0.7)), hl = Math.min(L * 0.5, t * 0.9);
      if (L < 8) continue;
      // Vârful lângă căsuță (al = 0), coada lângă cercul din mijloc (al = L).
      const p = (al: number, ac: number) => pt(cx + ux * (a - al) + vx * ac, cy + uy * (a - al) + vy * ac);
      parts.push(`<polygon points="${[p(0, 0), p(hl, -t / 2), p(hl, -t / 4), p(L, -t / 4), p(L, t / 4), p(hl, t / 4), p(hl, t / 2)].join(' ')}" fill="${tint(col, 0.45)}"/>`);
    }
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${(dc / 2).toFixed(1)}" fill="${col}"/>`, label(d.items[0], cx, cy, dc * 0.85, 15, '#fff'));
    for (let i = 0; i < m; i++) {
      const x = cx + R * Math.cos(at(i)), y = cy + R * Math.sin(at(i));
      parts.push(`<rect x="${(x - bw / 2).toFixed(1)}" y="${(y - bh / 2).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="10" fill="${tint(col, 0.2 + (i % 3) * 0.1)}"/>`, label(d.items[i + 1], x, y, bw - 12, m > 5 ? 11 : 13, '#fff'));
    }
  } else if (d.k === 'linearvenn') {
    // Venn liniar: cercuri egale pe un rând, fiecare suprapus cu ~30% peste vecinul lui, pe jumătate transparente; textul în mijlocul
    // fiecărui cerc (poate trece puțin peste părțile comune, ca să încapă cuvintele lungi).
    const step = 0.7, dm = Math.min(240, (W - 20) / (1 + step * (n - 1)));
    H = Math.round(dm + 20);
    const x0 = (W - dm * (1 + step * (n - 1))) / 2 + dm / 2, cy = H / 2;
    d.items.forEach((t, i) => {
      const x = x0 + i * dm * step;
      parts.push(`<circle cx="${x.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(dm / 2).toFixed(1)}" fill="${tint(col, i * 0.12)}" fill-opacity="0.55"/>`);
      parts.push(label(t, x, cy + 4, dm * (n > 1 ? 0.62 : 0.8), n > 4 ? 12 : 14, '#1f2937'));
    });
  } else if (d.k === 'uparrow') {
    // Săgeată ascendentă: o bandă curbă care urcă tot mai repede de la stânga jos spre dreapta sus, cu vârf; fiecare pas e un punct
    // pe ea, cu textul deasupra (mai sus decât banda din dreapta lui, ca să nu treacă peste ea).
    H = 300;
    const xl = 20, xr = W - 44, yb = H - 24, yt = 76, th = 22;
    const yAt = (x: number) => yb - (yb - yt) * Math.pow(Math.max(0, x - xl) / (xr - xl), 1.8);
    const pts: string[] = [];
    for (let k = 0; k <= 40; k++) { const x = xl + ((xr - xl) * k) / 40; pts.push(`${x.toFixed(1)},${yAt(x).toFixed(1)}`); }
    parts.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${tint(col, 0.25)}" stroke-width="${th}" stroke-linejoin="round"/>`);
    // Vârful: un triunghi în direcția curbei de la capăt.
    const dx = 1, dy = -(yb - yt) * 1.8 / (xr - xl), L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, hl = 30, hw = 24;
    const tip = [xr + ux * hl, yt + uy * hl], a = [xr - uy * hw, yt + ux * hw], b = [xr + uy * hw, yt - ux * hw];
    parts.push(`<polygon points="${[tip, a, b].map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')}" fill="${tint(col, 0.25)}"/>`);
    const bw = (xr - xl) / n;
    d.items.forEach((t, i) => {
      const x = xl + bw * (i + 0.5), y = yAt(x);
      parts.push(`<rect x="${(x - 9).toFixed(1)}" y="${(y - 9).toFixed(1)}" width="18" height="18" rx="9" fill="#fff" stroke="${col}" stroke-width="4"/>`);
      parts.push(label(t, x, yAt(x + bw / 2) - th / 2 - 26, bw - 8, n > 4 ? 12 : 13, '#1f2937'));
    });
  } else if (d.k === 'slanted') {
    // Bandă înclinată: ideile una lângă alta, fiecare într-un paralelogram aplecat spre dreapta, cu un spațiu mic între ele.
    const sk = 30, gap = 8, bw = (W - 20 - sk - gap * (n - 1)) / n, th = 110, top = 12;
    H = top + th + 12;
    d.items.forEach((t, i) => {
      const x = 10 + i * (bw + gap), pts = [[x + sk, top], [x + sk + bw, top], [x + bw, top + th], [x, top + th]];
      parts.push(`<polygon points="${pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')}" fill="${tint(col, i * 0.1)}"/>`);
      parts.push(label(t, x + (sk + bw) / 2, top + th / 2, bw - sk / 2 - 6, n > 4 ? 13 : 15, '#fff'));
    });
  } else if (d.k === 'temple') {
    // Templu: un acoperiș în triunghi sus, ideile în coloane înalte una lângă alta și o temelie lată dedesubt (pilonii care țin un scop).
    const top = 12, rh = 56, gap = 12, ch = 150, bh = 18, ins = 22, bw = (W - 20 - ins * 2 - gap * (n - 1)) / n;
    H = top + rh + 6 + ch + 6 + bh + 12;
    parts.push(`<polygon points="10,${top + rh} ${W / 2},${top} ${W - 10},${top + rh}" fill="${tint(col, 0.25)}"/>`);
    const cy = top + rh + 6;
    d.items.forEach((t, i) => {
      const x = 10 + ins + i * (bw + gap);
      parts.push(`<rect x="${x.toFixed(1)}" y="${cy}" width="${bw.toFixed(1)}" height="${ch}" rx="3" fill="${tint(col, i * 0.08)}"/>`);
      parts.push(label(t, x + bw / 2, cy + ch / 2, bw - 10, n > 4 ? 13 : 15, '#fff'));
    });
    parts.push(`<rect x="10" y="${cy + ch + 6}" width="${W - 20}" height="${bh}" rx="3" fill="${tint(col, 0.25)}"/>`);
  } else if (d.k === 'arc') {
    // Arc: o linie în semicerc și ideile în cercuri pe ea, de la stânga la dreapta (capetele jos, mijlocul sus).
    const r = Math.min(46, (W - 20) / n / 2.1), rx = (W - 20) / 2 - r, ry = 150, cx = W / 2, by = 10 + r + ry;
    H = by + r + 10;
    parts.push(`<path d="M${(cx - rx).toFixed(1)},${by} A${rx.toFixed(1)},${ry} 0 0 1 ${(cx + rx).toFixed(1)},${by}" fill="none" stroke="${tint(col, 0.6)}" stroke-width="6"/>`);
    d.items.forEach((t, i) => {
      const a = Math.PI - (Math.PI * i) / Math.max(1, n - 1), x = cx + rx * Math.cos(a), y = by - ry * Math.sin(a);
      parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${tint(col, i * 0.08)}"/>`);
      parts.push(label(t, x, y, r * 1.7, n > 5 ? 12 : 14, '#fff'));
    });
  } else if (d.k === 'hexradial') {
    // Radial cu hexagoane: prima idee într-un hexagon la mijloc (vârfurile în stânga și în dreapta), celelalte în hexagoane lipite
    // de el, pornind de sus, în sensul acelor de ceas; peste 6, inelul se depărtează ca să nu se suprapună.
    const m = n - 1, k = Math.max(1, m / 6), w = Math.min(150, (W - 20) / (1 + 1.732 * k)), h = w * 0.866, R = h * k, cx = W / 2, cy = 10 + (m ? R : 0) + h / 2;
    H = Math.round(cy + (m ? R : 0) + h / 2 + 10);
    const hex = (x: number, y: number) => [[x - w / 2, y], [x - w / 4, y - h / 2], [x + w / 4, y - h / 2], [x + w / 2, y], [x + w / 4, y + h / 2], [x - w / 4, y + h / 2]].map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');
    d.items.forEach((t, i) => {
      const a = -Math.PI / 2 + ((i - 1) * Math.PI * 2) / Math.max(1, m), x = i ? cx + R * Math.cos(a) : cx, y = i ? cy + R * Math.sin(a) : cy;
      parts.push(`<polygon points="${hex(x, y)}" fill="${i ? tint(col, 0.2 + ((i - 1) % 3) * 0.1) : col}" stroke="#fff" stroke-width="3"/>`);
      parts.push(label(t, x, y, w * 0.7, n > 5 ? 12 : 14, '#fff'));
    });
  } else if (d.k === 'trigrid') {
    // Piramidă din triunghiuri: un triunghi mare împărțit în rânduri de triunghiuri mici (1, 3, 5…), pe rând cu vârful în sus și în jos;
    // ideile le umplu de sus în jos, de la stânga la dreapta, iar locurile rămase goale sunt doar colorate mai deschis.
    const rows = Math.max(2, Math.ceil(Math.sqrt(n))), B = Math.min(470, W - 20), s = B / rows, h = s * 0.866, top = 10, cx = W / 2;
    H = Math.round(top + h * rows + 10);
    let i = 0;
    for (let k = 0; k < rows; k++) for (let j = 0; j <= 2 * k; j++, i++) {
      const y = top + k * h, xl = cx - (k * s) / 2 + Math.floor(j / 2) * s, up = j % 2 === 0, t = d.items[i];
      const pts = (up ? [[xl, y], [xl + s / 2, y + h], [xl - s / 2, y + h]] : [[xl, y], [xl + s, y], [xl + s / 2, y + h]]).map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');
      parts.push(`<polygon points="${pts}" fill="${t === undefined ? tint(col, 0.75) : tint(col, up ? k * 0.1 : 0.2 + k * 0.1)}" stroke="#fff" stroke-width="3"/>`);
      if (t !== undefined) parts.push(label(t, up ? xl : xl + s / 2, y + (up ? (h * 2) / 3 : h / 3), s * 0.45, rows > 2 ? 11 : 13, '#fff'));
    }
  } else if (d.k === 'bracket') {
    // Listă cu acoladă: ideea principală într-o căsuță în stânga, celelalte una sub alta în dreapta, strânse de o acoladă
    // al cărei vârf arată spre ideea principală (ca un rezumat: „asta înseamnă …”).
    const kids = Math.max(1, n - 1), rh = n > 5 ? 40 : 48, gap = 8, top = 10, mw = 170, bw = 26, kx = 10 + mw + bw + 24, kw = W - 10 - kx;
    const listH = kids * rh + (kids - 1) * gap;
    H = top + Math.max(listH, 90) + 10;
    const ly = top + (H - 20 - listH) / 2, cy = H / 2, mh = Math.min(110, Math.max(70, listH * 0.6));
    parts.push(`<rect x="10" y="${(cy - mh / 2).toFixed(1)}" width="${mw}" height="${mh.toFixed(1)}" rx="12" fill="${col}"/>`);
    parts.push(label(d.items[0], 10 + mw / 2, cy, mw - 18, 15, '#fff'));
    if (n > 1) {
      const bx = 10 + mw + 12, mx = bx + bw / 2, x1 = bx + bw, y1 = ly + 2, y2 = ly + listH - 2, r = Math.min(14, (y2 - y1) / 4);
      parts.push(`<path d="M${x1} ${y1.toFixed(1)} Q${mx} ${y1.toFixed(1)} ${mx} ${(y1 + r).toFixed(1)} L${mx} ${(cy - r).toFixed(1)} Q${mx} ${cy} ${bx} ${cy} Q${mx} ${cy} ${mx} ${(cy + r).toFixed(1)} L${mx} ${(y2 - r).toFixed(1)} Q${mx} ${y2.toFixed(1)} ${x1} ${y2.toFixed(1)}" fill="none" stroke="${tint(col, 0.35)}" stroke-width="4" stroke-linecap="round"/>`);
    }
    d.items.slice(1).forEach((t, i) => {
      const y = ly + i * (rh + gap);
      parts.push(`<rect x="${kx}" y="${y.toFixed(1)}" width="${kw}" height="${rh}" rx="8" fill="${tint(col, 0.2 + (i % 3) * 0.1)}"/>`);
      parts.push(label(t, kx + kw / 2, y + rh / 2, kw - 16, n > 5 ? 13 : 14, '#fff'));
    });
  } else if (d.k === 'podium') {
    // Podium: blocuri la fel de late, așezate pe aceeași linie de jos; primul loc în mijloc, cel mai înalt, apoi pe rând
    // în stânga și în dreapta lui, tot mai joase (ultimul are jumătate din înălțime). În bloc e locul, deasupra lui ideea.
    const gap = 6, bw = (W - 20 - gap * (n - 1)) / n, hMax = 150, lh = 36, top = 6, base = top + lh + hMax;
    const mid = Math.floor(n / 2), slot = (i: number) => mid + (i % 2 ? -(i + 1) / 2 : i / 2);
    H = base + 10;
    d.items.forEach((t, i) => {
      const x = 10 + slot(i) * (bw + gap), h = n > 1 ? hMax * (1 - (0.5 * i) / (n - 1)) : hMax, y = base - h;
      parts.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="4" fill="${tint(col, i * 0.1)}"/>`);
      parts.push(label(String(i + 1), x + bw / 2, y + Math.min(30, h / 2), bw - 8, 24, '#fff'));
      parts.push(label(t, x + bw / 2, y - lh / 2, bw - 4, n > 4 ? 12 : 14, '#333'));
    });
  } else if (d.k === 'hourglass') {
    // Clepsidră: benzi una sub alta, cu marginile drepte; lățimea scade până la mijloc (35% din cea de sus), apoi crește la loc.
    // Banda care trece prin mijloc are și ea „talia”, ca marginile să rămână linii frânte, nu trepte.
    const bh = 50, gap = 4, top = 10, cx = W / 2, half = (W - 40) / 2, hh = n * bh, mid = (hh - gap) / 2;
    H = 20 + hh;
    const at = (y: number) => half * (0.35 + 0.65 * Math.abs(1 - y / mid));
    d.items.forEach((t, i) => {
      const y0 = i * bh, y1 = y0 + bh - gap, side: [number, number][] = [[y0, at(y0)]];
      if (y0 < mid && y1 > mid) side.push([mid, at(mid)]);
      side.push([y1, at(y1)]);
      const pts = [...side.map(([y, w]) => [cx + w, top + y]), ...side.reverse().map(([y, w]) => [cx - w, top + y])];
      parts.push(`<polygon points="${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}" fill="${tint(col, i * 0.1)}"/>`);
      parts.push(label(t, cx, top + (y0 + y1) / 2, Math.max(60, 2 * Math.min(at(y0), at(y1), y0 < mid && y1 > mid ? at(mid) : Infinity) - 20), n > 5 ? 13 : 14, '#fff'));
    });
  } else if (d.k === 'rankbars') {
    // Bare în clasament: ideile în benzi orizontale una sub alta, pornite din aceeași margine din stânga; fiecare e mai scurtă
    // decât cea de deasupra (ultima are 50%), iar în față, într-un cerc, locul din clasament (un top, priorități, rezultate).
    const rh = n > 5 ? 40 : 48, gap = 8, top = 10, cr = rh / 2, bx = 10 + cr * 2 + 12, wMax = W - 10 - bx;
    H = top + n * rh + (n - 1) * gap + 10;
    d.items.forEach((t, i) => {
      const y = top + i * (rh + gap), w = n > 1 ? wMax * (1 - (0.5 * i) / (n - 1)) : wMax;
      parts.push(`<circle cx="${10 + cr}" cy="${(y + rh / 2).toFixed(1)}" r="${cr}" fill="${tint(col, 0.15)}"/>`);
      parts.push(label(String(i + 1), 10 + cr, y + rh / 2, cr * 2, 15, '#fff'));
      parts.push(`<rect x="${bx}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${rh}" rx="6" fill="${tint(col, i * 0.08)}"/>`);
      parts.push(label(t, bx + w / 2, y + rh / 2, w - 16, n > 5 ? 13 : 14, '#fff'));
    });
  } else if (d.k === 'tablelist') {
    // Listă tabel: titlul (prima idee) într-o bandă lată sus; dedesubt celelalte idei în coloane la fel de late, lipite una de alta
    // ca celulele unui tabel, iar jos o bandă subțire mai închisă, ca o temelie (un subiect și părțile lui, de aceeași importanță).
    const v = parseInt(col.slice(1), 16), dark = 'rgb(' + [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => Math.round(c * 0.7)).join(',') + ')';
    const kids = Math.max(1, n - 1), top = 10, hh = 56, gap = 6, ch = kids > 4 ? 110 : 96, fh = 10, cw = (W - 20 - gap * (kids - 1)) / kids;
    H = top + hh + gap + ch + gap + fh + 10;
    parts.push(`<rect x="10" y="${top}" width="${W - 20}" height="${hh}" rx="8" fill="${col}"/>`);
    parts.push(label(d.items[0], W / 2, top + hh / 2, W - 40, 16, '#fff'));
    d.items.slice(1).forEach((t, i) => {
      const x = 10 + i * (cw + gap), y = top + hh + gap;
      parts.push(`<rect x="${x.toFixed(1)}" y="${y}" width="${cw.toFixed(1)}" height="${ch}" rx="6" fill="${tint(col, 0.25 + (i % 2) * 0.12)}"/>`);
      parts.push(label(t, x + cw / 2, y + ch / 2, cw - 12, kids > 4 ? 12 : 14, '#fff'));
    });
    parts.push(`<rect x="10" y="${top + hh + gap + ch + gap}" width="${W - 20}" height="${fh}" rx="3" fill="${dark}"/>`);
  } else if (d.k === 'linedlist') {
    // Listă cu linii: titlul (prima idee) într-o bandă colorată în stânga, cât toată lista; în dreapta ei o linie groasă în sus și
    // celelalte idei una sub alta, scrise pe fundal alb, fiecare cu o linie subțire dedesubt (ca rândurile unui caiet).
    const kids = Math.max(1, n - 1), rh = n > 5 ? 38 : 46, top = 10, mw = 160, kx = 10 + mw + 22, kw = W - 10 - kx;
    H = top + Math.max(kids * rh, 90) + 10;
    const listH = H - top - 10, ly = top + (listH - kids * rh) / 2;
    parts.push(`<rect x="10" y="${top}" width="${mw}" height="${listH}" rx="10" fill="${col}"/>`);
    parts.push(label(d.items[0], 10 + mw / 2, top + listH / 2, mw - 18, 15, '#fff'));
    parts.push(`<rect x="${10 + mw + 8}" y="${top}" width="5" height="${listH}" fill="${tint(col, 0.35)}"/>`);
    d.items.slice(1).forEach((t, i) => {
      const y = ly + i * rh;
      parts.push(label(t, kx + kw / 2, y + rh / 2, kw - 16, n > 5 ? 13 : 14, '#222'));
      parts.push(`<rect x="${kx}" y="${(y + rh - 2).toFixed(1)}" width="${kw}" height="2" fill="${tint(col, 0.55)}"/>`);
    });
  } else if (d.k === 'bubbles') {
    // Bule de dialog: fiecare idee într-o bulă de vorbire, de sus în jos, pe rând lipită de stânga și de dreapta (ca o conversație);
    // coada bulei iese jos, spre marginea ei. Bulele din dreapta sunt puțin mai închise.
    const rh = n > 5 ? 50 : 58, bh = rh - 16, bw = Math.round(W * 0.62), top = 10;
    H = top + n * rh + 6;
    d.items.forEach((t, i) => {
      const right = i % 2 === 1, x = right ? W - 10 - bw : 10, y = top + i * rh, c = tint(col, right ? 0.6 : 0.75);
      const tx = right ? x + bw - 34 : x + 34, tip = right ? x + bw - 12 : x + 12;
      parts.push(`<path d="M${tx - 9} ${y + bh - 1} L${tip} ${y + bh + 13} L${tx + 9} ${y + bh - 1} Z" fill="${c}" stroke="${col}" stroke-width="1.5" stroke-linejoin="round"/>`);
      parts.push(`<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="12" fill="${c}" stroke="${col}" stroke-width="1.5"/>`);
      parts.push(`<rect x="${tx - 7.5}" y="${y + bh - 3}" width="15" height="4" fill="${c}"/>`);
      parts.push(label(t, x + bw / 2, y + bh / 2, bw - 20, n > 5 ? 13 : 14, '#222'));
    });
  } else if (d.k === 'cross') {
    // Cruce de idei: o grilă de 3 × 3 cu prima idee în mijloc; celelalte iau pe rând locurile de sus, din dreapta, de jos, din stânga,
    // apoi colțurile (de la cel din dreapta sus, în sensul acelor de ceas). Liniile subțiri leagă fiecare idee de mijloc.
    const gap = 14, cw = (W - 20 - gap * 2) / 3, ch = 70, top = 10;
    H = top + ch * 3 + gap * 2 + 10;
    const at = [[1, 1], [1, 0], [2, 1], [1, 2], [0, 1], [2, 0], [2, 2], [0, 2], [0, 0]];
    const cx = (c: number) => 10 + c * (cw + gap) + cw / 2, cy = (r: number) => top + r * (ch + gap) + ch / 2;
    d.items.forEach((_, i) => { if (i) parts.push(`<line x1="${cx(1).toFixed(1)}" y1="${cy(1)}" x2="${cx(at[i][0]).toFixed(1)}" y2="${cy(at[i][1])}" stroke="${tint(col, 0.45)}" stroke-width="3"/>`); });
    d.items.forEach((t, i) => {
      const [c, r] = at[i], x = 10 + c * (cw + gap), y = top + r * (ch + gap);
      parts.push(`<rect x="${x.toFixed(1)}" y="${y}" width="${cw.toFixed(1)}" height="${ch}" rx="12" fill="${i ? tint(col, 0.2 + ((i - 1) % 4) * 0.08) : col}"/>`);
      parts.push(label(t, x + cw / 2, y + ch / 2, cw - 16, n > 5 ? 13 : 15, '#fff'));
    });
  } else if (d.k === 'triangles') {
    // Triunghiuri alternante: triunghiuri echilaterale pe aceeași bandă, pe rând cu vârful în sus și în jos, lipite latură pe latură;
    // textul stă în centrul fiecărui triunghi (la o treime de bază).
    const w = Math.min(190, ((W - 20) * 2) / (n + 1)), h = w * 0.866, top = 10;
    H = Math.round(top + h + 10);
    const x0 = (W - (w * (n + 1)) / 2) / 2;
    d.items.forEach((t, i) => {
      const x = x0 + w / 2 + (i * w) / 2, up = i % 2 === 0;
      const pts = (up ? [[x, top], [x + w / 2, top + h], [x - w / 2, top + h]] : [[x - w / 2, top], [x + w / 2, top], [x, top + h]]).map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');
      parts.push(`<polygon points="${pts}" fill="${tint(col, up ? 0 : 0.25)}" stroke="#fff" stroke-width="3"/>`);
      parts.push(label(t, x, top + (up ? (h * 2) / 3 : h / 3), w * 0.45, n > 5 ? 11 : 13, '#fff'));
    });
  } else if (d.k === 'circlegrid') {
    // Cercuri în grilă: cercuri la fel de mari, câte două pe rând (la 4 idei) sau trei, cu ultimul rând centrat, ca o galerie.
    const cols = n === 4 ? 2 : Math.min(3, n), rows = Math.ceil(n / cols), gap = 18;
    const dd = Math.min(150, (W - 20 - (cols - 1) * gap) / cols);
    H = Math.round(20 + rows * dd + (rows - 1) * gap);
    d.items.forEach((t, i) => {
      const r = Math.floor(i / cols), inRow = Math.min(cols, n - r * cols), c = i % cols, rowW = inRow * dd + (inRow - 1) * gap;
      const cx = (W - rowW) / 2 + c * (dd + gap) + dd / 2, cy = 10 + r * (dd + gap) + dd / 2;
      parts.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(dd / 2).toFixed(1)}" fill="${tint(col, (i % 3) * 0.14)}" stroke="#fff" stroke-width="3"/>`);
      parts.push(label(t, cx, cy, dd * 0.72, n > 4 ? 13 : 15, '#fff'));
    });
  } else if (d.k === 'vtimeline') {
    // Cronologie verticală: o linie în mijloc, de sus în jos, cu o bulină pentru fiecare moment; casetele stau pe rând
    // în dreapta și în stânga liniei, fiecare legată de bulina ei printr-o linie scurtă.
    const rowH = n > 6 ? 52 : 62, bh = rowH - 14, cx = W / 2, bw = cx - 10 - 34;
    H = 20 + n * rowH;
    parts.push(`<rect x="${cx - 2}" y="6" width="4" height="${H - 12}" rx="2" fill="${tint(col, 0.55)}"/>`);
    d.items.forEach((t, i) => {
      const cy = 10 + i * rowH + rowH / 2, right = i % 2 === 0, x = right ? cx + 34 : 10;
      parts.push(`<rect x="${right ? cx : x + bw}" y="${cy - 1}" width="34" height="2" fill="${tint(col, 0.55)}"/>`);
      parts.push(`<rect x="${cx - 8}" y="${cy - 8}" width="16" height="16" rx="8" fill="#fff" stroke="${col}" stroke-width="4"/>`);
      parts.push(`<rect x="${x.toFixed(1)}" y="${(cy - bh / 2).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh}" rx="8" fill="${tint(col, (i % 3) * 0.13)}"/>`);
      parts.push(label(t, x + bw / 2, cy, bw - 16, n > 6 ? 13 : 14, '#fff'));
    });
  } else if (d.k === 'radialvenn') {
    // Venn radial: primul element în cercul din mijloc, celelalte în cercuri pe jumătate transparente, care intră puțin în el;
    // textul fiecărui cerc din jur stă spre marginea dinafară, al celui din mijloc deasupra tuturor.
    H = 360;
    const m = n - 1, cx = W / 2, cy = H / 2, r = H / 2 - 10, f = radialVennFit(m), rc = m ? f.c * r : r * 0.6, dd = f.d * r, R = f.R * r;
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${rc.toFixed(1)}" fill="${col}"/>`);
    for (let i = 0; i < m; i++) {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / m, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a), o = dd * 0.14;
      parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(dd / 2).toFixed(1)}" fill="${tint(col, 0.25 + (i % 3) * 0.15)}" fill-opacity="0.6" stroke="#fff" stroke-width="2"/>`);
      parts.push(label(d.items[i + 1], x + o * Math.cos(a), y + o * Math.sin(a), dd * 0.62, m > 5 ? 11 : 13, '#1f2937'));
    }
    parts.push(label(d.items[0], cx, cy, rc * 1.1, m > 5 ? 13 : 15, '#fff'));
  } else if (d.k === 'titledmatrix') {
    // Matrice cu titlu: celelalte elemente în grila de dedesubt, primul în caseta din mijloc, cu margine albă, peste colțurile lor.
    const m = n - 1, rows = Math.max(1, Math.ceil(m / 2));
    H = rows === 1 ? 160 : rows === 2 ? 300 : rows * 110;
    const L = titledMatrixLayout(Math.max(1, m), W - 20, H - 20);
    L.boxes.forEach((b, i) => {
      parts.push(`<rect x="${(10 + b.x).toFixed(1)}" y="${(10 + b.y).toFixed(1)}" width="${b.w.toFixed(1)}" height="${b.h.toFixed(1)}" rx="8" fill="${tint(col, 0.3 + (i % 3) * 0.12)}"/>`);
      if (m) parts.push(label(d.items[i + 1], 10 + b.text.x + b.text.w / 2, 10 + b.text.y + b.text.h / 2, b.text.w - 16, rows > 2 ? 13 : 14, '#1f2937'));
    });
    const c = L.mid;
    parts.push(`<rect x="${(10 + c.x).toFixed(1)}" y="${(10 + c.y).toFixed(1)}" width="${c.w.toFixed(1)}" height="${c.h.toFixed(1)}" rx="10" fill="${col}" stroke="#fff" stroke-width="4"/>`);
    parts.push(label(d.items[0], 10 + c.x + c.w / 2, 10 + c.y + c.h / 2, c.w - 18, 15, '#fff'));
  } else if (d.k === 'blockcycle') {
    // Ciclu cu blocuri: dreptunghiuri rotunjite pe o elipsă, primul sus, în sensul acelor de ceas, cu o săgeată
    // la jumătatea drumului dintre două blocuri, în direcția cercului (și de la ultimul înapoi la primul).
    H = n > 5 ? 400 : 340;
    const bw = n > 4 ? 120 : 140, bh = n > 4 ? 54 : 62, cx = W / 2, cy = H / 2, rx = (W - 20 - bw) / 2 * (n > 5 ? 1 : 0.82), ry = (H - 20 - bh) / 2;
    d.items.forEach((t, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n, m = a + Math.PI / n;
      const mx = cx + rx * Math.cos(m), my = cy + ry * Math.sin(m), dx0 = -rx * Math.sin(m), dy0 = ry * Math.cos(m), dl = Math.hypot(dx0, dy0) || 1;
      const ux = dx0 / dl, uy = dy0 / dl, L = 30, s = 4, hw = 10, hl = 13;
      const pt = (f: number, q: number) => `${(mx + ux * f - uy * q).toFixed(1)},${(my + uy * f + ux * q).toFixed(1)}`;
      parts.push(`<polygon points="${[pt(-L / 2, -s), pt(L / 2 - hl, -s), pt(L / 2 - hl, -hw), pt(L / 2, 0), pt(L / 2 - hl, hw), pt(L / 2 - hl, s), pt(-L / 2, s)].join(' ')}" fill="${tint(col, 0.45)}"/>`);
      const x = cx + rx * Math.cos(a) - bw / 2, y = cy + ry * Math.sin(a) - bh / 2;
      parts.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw}" height="${bh}" rx="10" fill="${tint(col, (i % 3) * 0.13)}"/>`);
      parts.push(label(t, x + bw / 2, y + bh / 2, bw - 16, n > 4 ? 13 : 14, '#fff'));
    });
  } else if (d.k === 'ringcycle') {
    // Ciclu continuu: un inel gros, deschis la culoare, pe o elipsă, iar pe el dreptunghiurile rotunjite, primul sus, în sensul
    // acelor de ceas (inelul le leagă pe toate, fără săgeți).
    H = n > 5 ? 400 : 340;
    const bw = n > 4 ? 120 : 140, bh = n > 4 ? 54 : 62, cx = W / 2, cy = H / 2, rx = (W - 20 - bw) / 2 * (n > 5 ? 1 : 0.82), ry = (H - 20 - bh) / 2;
    parts.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="none" stroke="${tint(col, 0.55)}" stroke-width="${Math.round(bh * 0.4)}"/>`);
    d.items.forEach((t, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n, x = cx + rx * Math.cos(a) - bw / 2, y = cy + ry * Math.sin(a) - bh / 2;
      parts.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw}" height="${bh}" rx="10" fill="${tint(col, (i % 3) * 0.13)}" stroke="#fff" stroke-width="2"/>`);
      parts.push(label(t, x + bw / 2, y + bh / 2, bw - 16, n > 4 ? 13 : 14, '#fff'));
    });
  } else if (d.k === 'blockgrid') {
    // Blocuri în grilă: dreptunghiuri rotunjite la fel de mari, câte două pe rând (la 4 idei) sau trei, cu ultimul rând centrat.
    const cols = n === 4 ? 2 : Math.min(3, n), rows = Math.ceil(n / cols), gap = 14;
    const bw = (W - 20 - (cols - 1) * gap) / cols, bh = n > 6 ? 70 : 84;
    H = Math.round(20 + rows * bh + (rows - 1) * gap);
    d.items.forEach((t, i) => {
      const r = Math.floor(i / cols), inRow = Math.min(cols, n - r * cols), c = i % cols, rowW = inRow * bw + (inRow - 1) * gap;
      const x = (W - rowW) / 2 + c * (bw + gap), y = 10 + r * (bh + gap);
      parts.push(`<rect x="${x.toFixed(1)}" y="${y}" width="${bw.toFixed(1)}" height="${bh}" rx="10" fill="${tint(col, ((r + c) % 3) * 0.13)}"/>`);
      parts.push(label(t, x + bw / 2, y + bh / 2, bw - 20, n > 6 ? 13 : 15, '#fff'));
    });
  } else if (d.k === 'tabs') {
    // Fișe cu file: fișe la fel de late, una lângă alta, fiecare cu o filă mai închisă în stânga-sus (ca dosarele dintr-un sertar).
    const gap = 12, th = 20, bh = n > 5 ? 120 : 140, top = 10, cw = (W - 20 - (n - 1) * gap) / n;
    H = Math.round(top + th + bh + 10);
    d.items.forEach((t, i) => {
      const x = 10 + i * (cw + gap), y = top + th;
      parts.push(`<rect x="${x.toFixed(1)}" y="${top}" width="${(cw * 0.55).toFixed(1)}" height="${th + 8}" rx="6" fill="${col}"/>`);
      parts.push(`<rect x="${x.toFixed(1)}" y="${y}" width="${cw.toFixed(1)}" height="${bh}" rx="6" fill="${tint(col, 0.2 + (i % 2) * 0.1)}"/>`);
      parts.push(label(t, x + cw / 2, y + bh / 2, cw - 16, n > 4 ? 13 : 15, '#fff'));
    });
  } else if (d.k === 'beadlist') {
    // Listă cu buline pe linie: o linie verticală în stânga, pe ea câte o bulină în dreptul fiecărei idei; ideile în benzi
    // late, una sub alta (ca pașii unei liste sau ai unui istoric).
    const bh = n > 5 ? 44 : 54, gap = 12, top = 10, r = 20, lx = 10 + r, bx = lx + r + 16;
    H = Math.round(top + n * bh + (n - 1) * gap + 10);
    if (n > 1) parts.push(`<line x1="${lx}" y1="${top + bh / 2}" x2="${lx}" y2="${top + (n - 1) * (bh + gap) + bh / 2}" stroke="${tint(col, 0.45)}" stroke-width="4" stroke-linecap="round"/>`);
    d.items.forEach((t, i) => {
      const y = top + i * (bh + gap), cy = y + bh / 2;
      parts.push(`<circle cx="${lx}" cy="${cy}" r="${r.toFixed(1)}" fill="${col}" stroke="#fff" stroke-width="3"/>`);
      parts.push(`<rect x="${bx}" y="${y}" width="${W - 10 - bx}" height="${bh}" rx="8" fill="${tint(col, 0.14 + (i % 2) * 0.12)}"/>`);
      parts.push(label(t, (bx + W - 10) / 2, cy, W - 10 - bx - 24, n > 5 ? 13 : 15, '#fff'));
    });
  } else if (d.k === 'cascade') {
    // Ovale în cascadă: ovale la fel de mari, din stânga-sus spre dreapta-jos, fiecare acoperă puțin marginea celui dinainte
    // (ușor transparente, ca suprapunerea să se vadă).
    const ow = Math.min(240, (W - 20) / (1 + (n - 1) * 0.62)), oh = Math.min(84, ow * 0.5), dx = (W - 20 - ow) / Math.max(1, n - 1), dy = oh * 0.62, top = 10;
    H = Math.round(top + oh + (n - 1) * dy + 10);
    d.items.forEach((t, i) => {
      const cx = 10 + ow / 2 + (n > 1 ? i * dx : (W - 20 - ow) / 2), cy = top + oh / 2 + i * dy;
      parts.push(`<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(ow / 2).toFixed(1)}" ry="${(oh / 2).toFixed(1)}" fill="${tint(col, (i % 3) * 0.14)}" fill-opacity="0.88" stroke="#fff" stroke-width="2"/>`);
      parts.push(label(t, cx, cy, ow * 0.7, n > 5 ? 12 : 14, '#fff'));
    });
  } else if (d.k === 'diamonds') {
    // Romburi în zigzag: romburi la fel de mari, fiecare mutat cu o jumătate de lățime față de cel dinainte și pe rând sus / jos,
    // așa că se lipesc latură pe latură, fără să se suprapună.
    const w = Math.min(170, ((W - 20) * 2) / (n + 1)), top = 10;
    H = Math.round(top + w * 1.5 + 10);
    const x0 = (W - (w * (n + 1)) / 2) / 2;
    d.items.forEach((t, i) => {
      const x = x0 + w / 2 + (i * w) / 2, y = top + w / 2 + (i % 2 ? w / 2 : 0);
      const pts = [[x, y - w / 2], [x + w / 2, y], [x, y + w / 2], [x - w / 2, y]].map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');
      parts.push(`<polygon points="${pts}" fill="${tint(col, (i % 3) * 0.14)}" stroke="#fff" stroke-width="3"/>`);
      parts.push(label(t, x, y, w * 0.55, n > 5 ? 11 : 13, '#fff'));
    });
  } else if (d.k === 'growing') {
    // Cercuri crescătoare: cercuri una lângă alta, așezate pe aceeași linie de jos, fiecare mai mare decât cel din stânga lui (primul are jumătate).
    const gap = 8, sc = d.items.map((_, i) => 0.5 + (0.5 * i) / Math.max(1, n - 1)), sum = sc.reduce((a, b) => a + b, 0);
    const u = Math.min(170, (W - 20 - gap * (n - 1)) / sum), by = 10 + u;
    H = by + 10;
    let x = (W - (u * sum + gap * (n - 1))) / 2;
    d.items.forEach((t, i) => {
      const r = (sc[i] * u) / 2;
      parts.push(`<circle cx="${(x + r).toFixed(1)}" cy="${(by - r).toFixed(1)}" r="${r.toFixed(1)}" fill="${tint(col, (n - 1 - i) * 0.08)}"/>`);
      parts.push(label(t, x + r, by - r, r * 1.7, r < 30 ? 11 : n > 5 ? 12 : 14, '#fff'));
      x += r * 2 + gap;
    });
  } else if (d.k === 'descending') {
    // Blocuri descrescătoare: coloane una lângă alta, așezate pe aceeași linie de jos, fiecare mai scundă decât cea din stânga ei.
    const gap = 8, bw = (W - 20 - gap * (n - 1)) / n, hMax = 190, hMin = 70, top = 12;
    H = top + hMax + 12;
    d.items.forEach((t, i) => {
      const h = n > 1 ? hMax - ((hMax - hMin) * i) / (n - 1) : hMax, x = 10 + i * (bw + gap), y = top + hMax - h;
      parts.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="6" fill="${tint(col, i * 0.1)}"/>`);
      parts.push(label(t, x + bw / 2, y + Math.min(h / 2, 40), bw - 12, n > 4 ? 13 : 15, '#fff'));
    });
  } else if (d.k === 'trapezoids') {
    // Listă cu trapeze: ideile una lângă alta, fiecare într-un trapez (mai îngust sus), lipite, ca blocurile unei temelii.
    const gap = 6, bw = (W - 20 - gap * (n - 1)) / n, th = 150, ins = Math.min(28, bw * 0.18), top = 12;
    H = top + th + 12;
    d.items.forEach((t, i) => {
      const x = 10 + i * (bw + gap), pts = [[x + ins, top], [x + bw - ins, top], [x + bw, top + th], [x, top + th]];
      parts.push(`<polygon points="${pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')}" fill="${tint(col, i * 0.1)}"/>`);
      parts.push(label(t, x + bw / 2, top + th * 0.55, bw - 2 * ins - 4, n > 4 ? 13 : 15, '#fff'));
    });
  } else if (d.k === 'arrowlist') {
    // Listă pe săgeată: o săgeată mare în jos în stânga, pașii unul sub altul în dreapta ei.
    const rh = 46, gap = 8, aw = 70, hh = 40, sw = 38, ax = 10 + aw / 2, top = 10;
    H = top + n * (rh + gap) - gap + hh / 2 + 14;
    const bot = H - 10, pts = [[ax - sw / 2, top], [ax + sw / 2, top], [ax + sw / 2, bot - hh], [10 + aw, bot - hh], [ax, bot], [10, bot - hh], [ax - sw / 2, bot - hh]];
    parts.push(`<polygon points="${pts.map((p) => p.join(',')).join(' ')}" fill="${tint(col, 0.55)}"/>`);
    d.items.forEach((t, i) => {
      const y = top + i * (rh + gap), x = 24 + aw;
      parts.push(`<rect x="${x}" y="${y}" width="${W - 10 - x}" height="${rh}" rx="8" fill="${tint(col, i * 0.1)}"/>`);
      parts.push(label(t, x + (W - 10 - x) / 2, y + rh / 2, W - 30 - x, 15, '#fff'));
    });
  } else if (d.k === 'alternating') {
    // Proces alternant: o săgeată lungă prin mijloc; pașii pe rând deasupra și dedesubtul ei, fiecare legat de săgeată printr-o linie.
    const ah = 40, body = 20, hl = 30, bh = 64, gap = 14, cy = 12 + bh + gap + ah / 2, cw = (W - 20 - hl) / n, bw = Math.min(170, cw + 16);
    H = cy + ah / 2 + gap + bh + 12;
    const pts = [[10, cy - body / 2], [W - 10 - hl, cy - body / 2], [W - 10 - hl, cy - ah / 2], [W - 10, cy], [W - 10 - hl, cy + ah / 2], [W - 10 - hl, cy + body / 2], [10, cy + body / 2]];
    parts.push(`<polygon points="${pts.map((p) => p.join(',')).join(' ')}" fill="${tint(col, 0.55)}"/>`);
    d.items.forEach((t, i) => {
      const cx = 10 + cw * (i + 0.5), up = i % 2 === 0, y = up ? cy - ah / 2 - gap - bh : cy + ah / 2 + gap;
      parts.push(`<rect x="${(cx - 1.5).toFixed(1)}" y="${(up ? y + bh : cy + body / 2).toFixed(1)}" width="3" height="${gap + (ah - body) / 2}" fill="${tint(col, 0.55)}"/>`);
      parts.push(`<rect x="${(cx - bw / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh}" rx="10" fill="${tint(col, i * 0.1)}"/>`);
      parts.push(label(t, cx, y + bh / 2, bw - 12, n > 4 ? 12 : 13, '#fff'));
    });
  } else if (d.k === 'opposing') {
    // Săgeți în sens opus: sus o săgeată spre dreapta cu primele ceil(n / 2) idei, jos una spre stânga cu restul, textul pe trupul ei.
    const m = Math.ceil(n / 2), ah = 80, gap = 16, hl = 56, body = 56, x0 = 10, x1 = W - 10;
    H = 2 * ah + gap + 24;
    [[12, 1], [12 + ah + gap, -1]].forEach(([y, dir], row) => {
      const cy = y + ah / 2, tipX = dir > 0 ? x1 : x0, baseX = dir > 0 ? x0 : x1, neck = tipX - dir * hl;
      const pts = [[baseX, cy - body / 2], [neck, cy - body / 2], [neck, y], [tipX, cy], [neck, y + ah], [neck, cy + body / 2], [baseX, cy + body / 2]];
      parts.push(`<polygon points="${pts.map((p) => p.join(',')).join(' ')}" fill="${tint(col, row * 0.3)}"/>`);
      const items = row ? d.items.slice(m) : d.items.slice(0, m), lo = Math.min(baseX, neck) + 8, w = (Math.max(baseX, neck) - 8 - lo) / Math.max(1, items.length);
      items.forEach((t, j) => parts.push(label(t, lo + w * (j + 0.5), cy, w - 10, n > 4 ? 12 : 13, '#fff')));
    });
  } else if (d.k === 'meetarrows') {
    // Săgeți față în față: pe același rând, din stânga o săgeată spre dreapta cu primele ceil(n / 2) idei și din dreapta una spre
    // stânga cu restul; vârfurile se opresc aproape de mijloc (un acord, un compromis, două părți care ajung la același punct).
    const m = Math.ceil(n / 2), ah = 96, hl = 44, body = 64, mid = W / 2, g = 8, y = 12, cy = y + ah / 2;
    H = ah + 24;
    [[10, mid - g / 2], [W - 10, mid + g / 2]].forEach(([baseX, tipX], side) => {
      const dir = Math.sign(tipX - baseX), neck = tipX - dir * hl;
      const pts = [[baseX, cy - body / 2], [neck, cy - body / 2], [neck, y], [tipX, cy], [neck, y + ah], [neck, cy + body / 2], [baseX, cy + body / 2]];
      parts.push(`<polygon points="${pts.map((p) => p.join(',')).join(' ')}" fill="${tint(col, side * 0.3)}"/>`);
      const items = side ? d.items.slice(m) : d.items.slice(0, m), lo = Math.min(baseX, neck) + 6, w = (Math.max(baseX, neck) - 6 - lo) / Math.max(1, items.length);
      items.forEach((t, j) => parts.push(label(t, lo + w * (j + 0.5), cy, w - 10, n > 4 ? 12 : 13, '#fff')));
    });
  } else if (d.k === 'plusminus') {
    // Plus și minus: două coloane; sus în stânga un cerc cu ＋ și sub el primele ceil(n / 2) idei (avantajele), sus în dreapta un
    // cerc cu − și sub el restul (dezavantajele). Coloana minusului e mai deschisă la culoare.
    const m = Math.ceil(n / 2), cw = (W - 50) / 2, rr = 26, top = 10, bh = 40, gap = 8, y1 = top + rr * 2 + 12;
    H = y1 + m * (bh + gap) + 6;
    [0, 1].forEach((side) => {
      const x = 15 + side * (cw + 20), cx = x + cw / 2, cy = top + rr, c = tint(col, side * 0.3);
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${rr}" fill="${c}"/>`);
      parts.push(`<rect x="${cx - 13}" y="${cy - 3.5}" width="26" height="7" fill="#fff"/>`);
      if (!side) parts.push(`<rect x="${cx - 3.5}" y="${cy - 13}" width="7" height="26" fill="#fff"/>`);
      const items = side ? d.items.slice(m) : d.items.slice(0, m);
      items.forEach((t, j) => {
        const y = y1 + j * (bh + gap);
        parts.push(`<rect x="${x}" y="${y}" width="${cw}" height="${bh}" rx="6" fill="${tint(col, 0.75 + side * 0.1)}" stroke="${c}" stroke-width="1.5"/>`);
        parts.push(label(t, cx, y + bh / 2, cw - 16, n > 6 ? 12 : 13, '#222'));
      });
    });
  } else if (d.k === 'balance') {
    // Balanță: primele ceil(n / 2) idei pe talerul din stânga, restul pe cel din dreapta, stivuite de jos în sus; brațul stă pe un
    // triunghi și se înclină cu 8° spre partea cu mai multe idei (la număr egal rămâne drept).
    const m = Math.ceil(n / 2), r = n - m, a = (Math.sign(m - r) * 8 * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
    const bh = 34, gap = 6, bw = 170, L = 180, bt = 10, fh = 60, cx = W / 2;
    const py = 12 + m * (bh + gap) - gap + 10 + Math.ceil(L * Math.abs(sa)) + bt;
    H = py + fh + 12;
    const ends = [[cx - L * ca, py + L * sa], [cx + L * ca, py - L * sa]], nx = (sa * bt) / 2, ny = (ca * bt) / 2;
    parts.push(`<polygon points="${cx},${py} ${cx + fh * 0.55},${py + fh} ${cx - fh * 0.55},${py + fh}" fill="${tint(col, 0.45)}"/>`);
    const beam = [[ends[0][0] - nx, ends[0][1] - ny], [ends[1][0] - nx, ends[1][1] - ny], [ends[1][0] + nx, ends[1][1] + ny], [ends[0][0] + nx, ends[0][1] + ny]];
    parts.push(`<polygon points="${beam.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')}" fill="${tint(col, 0.25)}"/>`);
    d.items.forEach((t, i) => {
      const side = i < m ? 0 : 1, j = side ? i - m : i, [ex, ey] = ends[side];
      const y = ey - bt / 2 - 6 - (j + 1) * bh - j * gap;
      parts.push(`<rect x="${(ex - bw / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${bw}" height="${bh}" rx="6" fill="${tint(col, i * 0.08)}"/>`);
      parts.push(label(t, ex, y + bh / 2, bw - 12, 13, '#fff'));
    });
  } else if (d.k === 'stackvenn') {
    // Venn stivuit: cercuri unul în altul, primul element pe cel mai mare, toate pe aceeași linie de jos; textul fiecăruia în partea
    // de sus vizibilă a cercului lui, iar al celui mai mic în mijlocul lui.
    H = 340;
    const cx = W / 2, bottom = H - 10, R = H / 2 - 10, step = n > 1 ? (R * (1 - Math.max(1 / n, 0.3))) / (n - 1) : R;
    const rad = (i: number) => R - i * step;
    d.items.forEach((_, i) => {
      parts.push(`<circle cx="${cx}" cy="${(bottom - rad(i)).toFixed(1)}" r="${rad(i).toFixed(1)}" fill="${i % 2 ? tint(col, 0.35) : tint(col, i * 0.08)}" stroke="#fff" stroke-width="2"/>`);
    });
    d.items.forEach((t, i) => {
      const last = i === n - 1, top = bottom - 2 * rad(i), y = last ? bottom - rad(i) : top + step;
      parts.push(label(t, cx, y, last ? rad(i) * 1.6 : Math.max(60, rad(i) * 1.1), n > 5 ? 11 : 13, '#fff'));
    });
  } else if (d.k === 'converge') {
    // Radial convergent: primul element în cercul din mijloc, celelalte în căsuțe în jurul lui, fiecare cu o săgeată groasă spre mijloc.
    H = 360;
    const m = n - 1, cx = W / 2, cy = H / 2, r = H / 2 - 10, dc = r * 0.56;
    const s = 1.7 * Math.sin(Math.PI / Math.max(3, m)), dd = Math.min(r * 0.5, (s * r) / (1 + s / 2)), bw = dd * 1.5, bh = dd * 0.7, R = r - bh / 2;
    const at = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / m;
    const pt = (x: number, y: number) => `${x.toFixed(1)},${y.toFixed(1)}`;
    for (let i = 0; i < m; i++) {
      const ux = Math.cos(at(i)), uy = Math.sin(at(i)), vx = -uy, vy = ux;
      const edge = Math.min(Math.abs(ux) > 1e-6 ? bw / 2 / Math.abs(ux) : Infinity, Math.abs(uy) > 1e-6 ? bh / 2 / Math.abs(uy) : Infinity);
      const a = R - edge - 5, b = dc / 2 + 6, L = a - b, t = Math.min(dd * 0.32, Math.max(8, L * 0.7)), hl = Math.min(L * 0.5, t * 0.9);
      if (L < 8) continue;
      const p = (al: number, ac: number) => pt(cx + ux * (a - al) + vx * ac, cy + uy * (a - al) + vy * ac);
      parts.push(`<polygon points="${[p(0, -t / 4), p(L - hl, -t / 4), p(L - hl, -t / 2), p(L, 0), p(L - hl, t / 2), p(L - hl, t / 4), p(0, t / 4)].join(' ')}" fill="${tint(col, 0.45)}"/>`);
    }
    parts.push(`<circle cx="${cx}" cy="${cy}" r="${(dc / 2).toFixed(1)}" fill="${col}"/>`, label(d.items[0], cx, cy, dc * 0.85, 15, '#fff'));
    for (let i = 0; i < m; i++) {
      const x = cx + R * Math.cos(at(i)), y = cy + R * Math.sin(at(i));
      parts.push(`<rect x="${(x - bw / 2).toFixed(1)}" y="${(y - bh / 2).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="10" fill="${tint(col, 0.2 + (i % 3) * 0.1)}"/>`, label(d.items[i + 1], x, y, bw - 12, m > 5 ? 11 : 13, '#fff'));
    }
  } else if (d.k === 'stepdown') {
    // Proces în trepte în jos: fiecare pas mai jos și mai la dreapta; din partea de jos a fiecăruia coboară o săgeată îndoită
    // care intră din stânga în pasul următor.
    const bw = (W - 20) / (1 + 0.6 * Math.max(0, n - 1)), bh = 46, sx = bw * 0.6, sy = bh * 1.4, t = 8, hl = 12, hw = 8;
    H = 20 + bh + (n - 1) * sy;
    const pt = ([x, y]: number[]) => `${x.toFixed(1)},${y.toFixed(1)}`;
    for (let i = 0; i < n - 1; i++) {
      const x = 10 + i * sx, y = 10 + i * sy, ax = x + bw * 0.2, top = y + bh + 3, cyN = y + sy + bh / 2, end = x + sx - 3;
      parts.push(`<polygon points="${[[ax - t / 2, top], [ax + t / 2, top], [ax + t / 2, cyN - t / 2], [end - hl, cyN - t / 2], [end - hl, cyN - hw], [end, cyN], [end - hl, cyN + hw], [end - hl, cyN + t / 2], [ax - t / 2, cyN + t / 2]].map(pt).join(' ')}" fill="${tint(col, 0.45)}"/>`);
    }
    d.items.forEach((t2, i) => {
      const x = 10 + i * sx, y = 10 + i * sy;
      parts.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh}" rx="10" fill="${tint(col, (i % 4) * 0.1)}"/>`, label(t2, x + bw / 2, y + bh / 2, bw - 14, n > 5 ? 11 : 13, '#fff'));
    });
  } else if (d.k === 'honeycomb') {
    // Fagure: hexagoane cu vârfurile în stânga și în dreapta; cele de rang impar coboară o jumătate de hexagon, lipite de vecini.
    const g = 6, w = Math.min(150, (W - 20) / (1 + 0.75 * Math.max(0, n - 1))), h = w * 0.866, dx = w * 0.75 + g * 0.87, dy = h / 2 + g / 2;
    const tw = w + (n - 1) * dx, bx = (W - tw) / 2;
    H = Math.round(20 + h + (n > 1 ? dy : 0));
    d.items.forEach((t, i) => {
      const x = bx + i * dx, y = 10 + (i % 2) * dy;
      const pts = [[x + w / 4, y], [x + (3 * w) / 4, y], [x + w, y + h / 2], [x + (3 * w) / 4, y + h], [x + w / 4, y + h], [x, y + h / 2]];
      parts.push(`<polygon points="${pts.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ')}" fill="${tint(col, (i % 3) * 0.12)}"/>`, label(t, x + w / 2, y + h / 2, w * 0.66, n > 5 ? 11 : 13, '#fff'));
    });
  } else if (d.k === 'gears') {
    // Roți dințate: roți la fel de mari, prinse una de alta în zigzag; dinții alternează, ca roțile să pară angrenate.
    const dd = Math.min(160, (W - 20) / (1 + 0.86 * Math.max(0, n - 1))), dx = dd * 0.86, dy = dd * 0.38, R = dd / 2, r = R * 0.82, teeth = 10;
    const tw = dd + (n - 1) * dx, bx = (W - tw) / 2;
    H = Math.round(20 + dd + (n > 1 ? dy : 0));
    d.items.forEach((t, i) => {
      const cx = bx + i * dx + R, cy = 10 + (i % 2) * dy + R, off = i % 2 ? Math.PI / teeth : 0, pts: string[] = [];
      for (let k = 0; k < teeth * 4; k++) {
        // Fiecare dinte: două puncte sus (pe raza mare) și două jos (pe raza mică).
        const a = off + (k * Math.PI * 2) / (teeth * 4) - Math.PI / 2, rr = k % 4 < 2 ? R : r;
        pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
      }
      parts.push(`<polygon points="${pts.join(' ')}" fill="${tint(col, (i % 3) * 0.12)}"/>`, label(t, cx, cy, r * 1.6, n > 5 ? 11 : 13, '#fff'));
    });
  } else if (d.k === 'hexlist') {
    // Listă cu hexagoane: pe fiecare rând un hexagon plin cu numărul (vârfurile în stânga și în dreapta), apoi o bandă
    // deschisă la culoare cu textul, ca la Listă cu etape.
    const rh = 48, gap = 8, aw = 64, q = 14;
    H = 20 + n * (rh + gap) - gap;
    d.items.forEach((t, i) => {
      const y = 10 + i * (rh + gap), pts = [[10, y + rh / 2], [10 + q, y], [10 + aw - q, y], [10 + aw, y + rh / 2], [10 + aw - q, y + rh], [10 + q, y + rh]];
      parts.push(`<polygon points="${pts.map(([a, b]) => `${a},${b}`).join(' ')}" fill="${tint(col, (i % 4) * 0.1)}"/>`, label(String(i + 1), 10 + aw / 2, y + rh / 2, aw - 2 * q, 18, '#fff'));
      parts.push(`<rect x="${16 + aw}" y="${y}" width="${W - 26 - aw}" height="${rh}" rx="8" fill="${tint(col, 0.82)}"/>`, label(t, 16 + aw + (W - 26 - aw) / 2, y + rh / 2, W - 56 - aw, 15, '#1f2937'));
    });
  } else if (d.k === 'circlelist') {
    // Listă cu cercuri: pe fiecare rând un cerc plin cu numărul, apoi o bandă rotunjită cu textul, care pornește de sub cerc.
    const rh = 48, gap = 8;
    H = 20 + n * (rh + gap) - gap;
    d.items.forEach((t, i) => {
      const y = 10 + i * (rh + gap), x = 10 + rh / 2;
      parts.push(`<rect x="${x}" y="${y + 6}" width="${W - 10 - x}" height="${rh - 12}" rx="${(rh - 12) / 2}" fill="${tint(col, 0.82)}"/>`, label(t, x + rh / 2 + 8 + (W - 10 - x - rh / 2 - 8) / 2, y + rh / 2, W - 40 - x - rh / 2, 15, '#1f2937'));
      parts.push(`<circle cx="${x}" cy="${y + rh / 2}" r="${rh / 2}" fill="${tint(col, (i % 4) * 0.1)}" stroke="#fff" stroke-width="3"/>`, label(String(i + 1), x, y + rh / 2, rh - 12, 18, '#fff'));
    });
  } else if (d.k === 'pentagonlist' || d.k === 'octagonlist' || d.k === 'trianglelist' || d.k === 'squarelist') {
    // Listă cu pentagoane / octogoane / triunghiuri / pătrate: pe fiecare rând un poligon regulat cu numărul în el, apoi o bandă cu textul, care pornește de sub poligon.
    const rh = 54, gap = 6, m = d.k === 'pentagonlist' ? 5 : d.k === 'trianglelist' ? 3 : d.k === 'squarelist' ? 4 : 8;
    H = 20 + n * (rh + gap) - gap;
    d.items.forEach((t, i) => {
      const y = 10 + i * (rh + gap), cx = 10 + rh / 2, cy = y + rh / 2, r = rh / 2;
      // Pentagonul și triunghiul cu vârful în sus; octogonul și pătratul cu o latură dreaptă sus (rotite cu o jumătate de pas).
      const a0 = m % 2 ? -Math.PI / 2 : -Math.PI / 2 + Math.PI / m;
      const pts = Array.from({ length: m }, (_, k) => { const a = a0 + (k * 2 * Math.PI) / m; return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`; });
      parts.push(`<rect x="${cx}" y="${y + 8}" width="${W - 10 - cx}" height="${rh - 16}" rx="4" fill="${tint(col, 0.82)}"/>`, label(t, cx + r + 8 + (W - 18 - cx - r) / 2, cy, W - 40 - cx - r, 15, '#1f2937'));
      parts.push(`<polygon points="${pts.join(' ')}" fill="${tint(col, (i % 4) * 0.1)}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>`, label(String(i + 1), cx, cy + (m === 5 ? 2 : m === 3 ? 4 : 0), m === 3 ? r * 0.8 : r * 1.1, m === 3 ? 15 : 17, '#fff'));
    });
  } else if (d.k === 'checklist') {
    // Listă cu bife: pe fiecare rând o căsuță pătrată cu o bifă albă desenată (nu literă, ca să arate la fel cu orice font), apoi banda cu textul.
    const rh = 48, gap = 8, b = 34;
    H = 20 + n * (rh + gap) - gap;
    d.items.forEach((t, i) => {
      const y = 10 + i * (rh + gap), x = 10, cy = y + rh / 2, bx = x + (rh - b) / 2, by = cy - b / 2;
      parts.push(`<rect x="${x + rh / 2}" y="${y + 6}" width="${W - 10 - x - rh / 2}" height="${rh - 12}" rx="6" fill="${tint(col, 0.82)}"/>`, label(t, x + rh + 8 + (W - 18 - x - rh) / 2, cy, W - 40 - x - rh, 15, '#1f2937'));
      parts.push(`<rect x="${bx}" y="${by}" width="${b}" height="${b}" rx="6" fill="${tint(col, (i % 4) * 0.1)}" stroke="#fff" stroke-width="2"/>`);
      parts.push(`<path d="M${(bx + b * 0.24).toFixed(1)},${(by + b * 0.52).toFixed(1)} L${(bx + b * 0.43).toFixed(1)},${(by + b * 0.71).toFixed(1)} L${(bx + b * 0.78).toFixed(1)},${(by + b * 0.3).toFixed(1)}" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`);
    });
  } else if (d.k === 'plaquelist') {
    // Listă cu plăcuțe: pe fiecare rând o plăcuță pătrată cu colțurile scobite (patru laturi și patru arce întoarse înăuntru), cu numărul pe ea, apoi o bandă rotunjită cu textul.
    const rh = 50, gap = 8;
    H = 20 + n * (rh + gap) - gap;
    d.items.forEach((t, i) => {
      const y = 10 + i * (rh + gap), b = rh - 4, x = 10, bx = x + 2, by = y + 2, c = b * 0.2, cx = x + rh / 2, cy = y + rh / 2, f = (v: number) => v.toFixed(1);
      const A = (ex: number, ey: number) => ` A${f(c)},${f(c)} 0 0 0 ${f(ex)},${f(ey)}`;
      const path = `M${f(bx + c)},${f(by)} L${f(bx + b - c)},${f(by)}${A(bx + b, by + c)} L${f(bx + b)},${f(by + b - c)}${A(bx + b - c, by + b)} L${f(bx + c)},${f(by + b)}${A(bx, by + b - c)} L${f(bx)},${f(by + c)}${A(bx + c, by)} Z`;
      parts.push(`<rect x="${cx}" y="${y + 8}" width="${W - 10 - cx}" height="${rh - 16}" rx="${(rh - 16) / 2}" fill="${tint(col, 0.82)}"/>`, label(t, x + rh + 8 + (W - 18 - x - rh) / 2, cy, W - 40 - x - rh, 15, '#1f2937'));
      parts.push(`<path d="${path}" fill="${tint(col, (i % 4) * 0.1)}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>`, label(String(i + 1), cx, cy + 1, b * 0.6, 16, '#fff'));
    });
  } else if (d.k === 'canlist') {
    // Listă cu cilindri: pe fiecare rând un cilindru în picioare (corpul cu fundul rotunjit, capacul ca o elipsă mai deschisă, cu marginea albă) cu numărul pe corp, apoi o bandă rotunjită cu textul.
    const rh = 50, gap = 8;
    H = 20 + n * (rh + gap) - gap;
    d.items.forEach((t, i) => {
      const y = 10 + i * (rh + gap), x = 10, bw = rh - 12, bh = rh - 4, bx = x + 6, by = y + 2, e = 6, cx = bx + bw / 2, cy = y + rh / 2, f = (v: number) => v.toFixed(1);
      const body = `M${f(bx)},${f(by + e)} L${f(bx)},${f(by + bh - e)} A${f(bw / 2)},${e} 0 0 0 ${f(bx + bw)},${f(by + bh - e)} L${f(bx + bw)},${f(by + e)} A${f(bw / 2)},${e} 0 0 1 ${f(bx)},${f(by + e)} Z`;
      parts.push(`<rect x="${x + rh / 2}" y="${y + 8}" width="${W - 10 - x - rh / 2}" height="${rh - 16}" rx="${(rh - 16) / 2}" fill="${tint(col, 0.82)}"/>`, label(t, x + rh + 8 + (W - 18 - x - rh) / 2, cy, W - 40 - x - rh, 15, '#1f2937'));
      parts.push(`<path d="${body}" fill="${tint(col, (i % 4) * 0.1)}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>`, `<ellipse cx="${f(cx)}" cy="${f(by + e)}" rx="${f(bw / 2)}" ry="${e}" fill="${tint(col, 0.3 + (i % 4) * 0.1)}" stroke="#fff" stroke-width="2"/>`, label(String(i + 1), cx, by + e + (bh - e) / 2 + 1, bw * 0.8, 16, '#fff'));
    });
  } else if (d.k === 'notelist') {
    // Listă cu notițe: pe fiecare rând o foaie pătrată cu colțul din dreapta jos îndoit (foaia din 5 colțuri și îndoitura ca un triunghi mai închis) cu numărul pe ea, apoi o bandă rotunjită cu textul.
    const rh = 50, gap = 8;
    H = 20 + n * (rh + gap) - gap;
    d.items.forEach((t, i) => {
      const y = 10 + i * (rh + gap), x = 10, s = rh - 6, c = s * 0.28, bx = x + 3, by = y + 3, cy = y + rh / 2, f = (v: number) => v.toFixed(1);
      const pts = (a: number[][]) => a.map(([p, q]) => `${f(p)},${f(q)}`).join(' ');
      parts.push(`<rect x="${x + rh / 2}" y="${y + 8}" width="${W - 10 - x - rh / 2}" height="${rh - 16}" rx="${(rh - 16) / 2}" fill="${tint(col, 0.82)}"/>`, label(t, x + rh + 8 + (W - 18 - x - rh) / 2, cy, W - 40 - x - rh, 15, '#1f2937'));
      parts.push(`<polygon points="${pts([[bx, by], [bx + s, by], [bx + s, by + s - c], [bx + s - c, by + s], [bx, by + s]])}" fill="${tint(col, (i % 4) * 0.1)}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>`, `<polygon points="${pts([[bx + s, by + s - c], [bx + s - c, by + s - c], [bx + s - c, by + s]])}" fill="${tint(col, 0.45)}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>`, label(String(i + 1), bx + (s - c / 2) / 2, by + (s - c / 2) / 2 + 1, s * 0.6, 16, '#fff'));
    });
  } else if (d.k === 'bevellist') {
    // Listă cu butoane: pe fiecare rând un buton pătrat teșit (pătratul mare, fața din mijloc mai deschisă și cele 4 muchii albe spre colțuri) cu numărul pe față, apoi o bandă rotunjită cu textul.
    const rh = 50, gap = 8;
    H = 20 + n * (rh + gap) - gap;
    d.items.forEach((t, i) => {
      const y = 10 + i * (rh + gap), x = 10, s = rh - 6, b = s * 0.16, bx = x + 3, by = y + 3, cy = y + rh / 2, f = (v: number) => v.toFixed(1);
      parts.push(`<rect x="${x + rh / 2}" y="${y + 8}" width="${W - 10 - x - rh / 2}" height="${rh - 16}" rx="${(rh - 16) / 2}" fill="${tint(col, 0.82)}"/>`, label(t, x + rh + 8 + (W - 18 - x - rh) / 2, cy, W - 40 - x - rh, 15, '#1f2937'));
      parts.push(`<rect x="${f(bx)}" y="${f(by)}" width="${f(s)}" height="${f(s)}" fill="${tint(col, 0.35)}" stroke="#fff" stroke-width="2"/>`, `<rect x="${f(bx + b)}" y="${f(by + b)}" width="${f(s - 2 * b)}" height="${f(s - 2 * b)}" fill="${tint(col, (i % 4) * 0.1)}"/>`, `<path d="M${f(bx)},${f(by)} L${f(bx + b)},${f(by + b)} M${f(bx + s)},${f(by)} L${f(bx + s - b)},${f(by + b)} M${f(bx + s)},${f(by + s)} L${f(bx + s - b)},${f(by + s - b)} M${f(bx)},${f(by + s)} L${f(bx + b)},${f(by + s - b)}" fill="none" stroke="#fff" stroke-width="1.5"/>`, label(String(i + 1), bx + s / 2, by + s / 2 + 1, s - 2 * b, 16, '#fff'));
    });
  } else if (d.k === 'sunlist') {
    // Listă cu sori: pe fiecare rând un soare (un disc plin (desenat ca elipsă rotundă) înconjurat de 8 raze ca niște triunghiuri subțiri, cu marginea albă) cu numărul în cerc, apoi o bandă rotunjită cu textul.
    const rh = 50, gap = 8, rays = 8;
    H = 20 + n * (rh + gap) - gap;
    d.items.forEach((t, i) => {
      const y = 10 + i * (rh + gap), x = 10, cx = x + rh / 2, cy = y + rh / 2, ro = rh / 2 - 1, rc = ro * 0.6, f = (v: number) => v.toFixed(1);
      const ray = (k: number) => { const a = (k / rays) * 2 * Math.PI, w = Math.PI / rays * 0.7, r1 = rc - 1; return [[cx + ro * Math.cos(a), cy + ro * Math.sin(a)], [cx + r1 * Math.cos(a + w), cy + r1 * Math.sin(a + w)], [cx + r1 * Math.cos(a - w), cy + r1 * Math.sin(a - w)]].map(([p, q]) => `${f(p)},${f(q)}`).join(' '); };
      parts.push(`<rect x="${cx}" y="${y + 8}" width="${W - 10 - cx}" height="${rh - 16}" rx="${(rh - 16) / 2}" fill="${tint(col, 0.82)}"/>`, label(t, x + rh + 8 + (W - 18 - x - rh) / 2, cy, W - 40 - x - rh, 15, '#1f2937'));
      for (let k = 0; k < rays; k++) parts.push(`<polygon points="${ray(k)}" fill="${tint(col, 0.1 + (i % 4) * 0.1)}" stroke="#fff" stroke-width="0.8" stroke-linejoin="round"/>`);
      parts.push(`<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rc)}" ry="${f(rc)}" fill="${tint(col, (i % 4) * 0.1)}" stroke="#fff" stroke-width="2"/>`, label(String(i + 1), cx, cy + 1, rc * 1.6, 15, '#fff'));
    });
  } else if (d.k === 'framelist') {
    // Listă cu rame: pe fiecare rând o ramă pătrată (marginea plină, cu golul din mijloc lăsat deschis) cu numărul în gol, apoi o bandă rotunjită cu textul.
    const rh = 50, gap = 8;
    H = 20 + n * (rh + gap) - gap;
    d.items.forEach((t, i) => {
      const y = 10 + i * (rh + gap), x = 10, s = rh - 6, b = s * 0.2, bx = x + 3, by = y + 3, cy = y + rh / 2, f = (v: number) => v.toFixed(1);
      const ring = `M${f(bx)},${f(by)} H${f(bx + s)} V${f(by + s)} H${f(bx)} Z M${f(bx + b)},${f(by + b)} V${f(by + s - b)} H${f(bx + s - b)} V${f(by + b)} Z`;
      parts.push(`<rect x="${x + rh / 2}" y="${y + 8}" width="${W - 10 - x - rh / 2}" height="${rh - 16}" rx="${(rh - 16) / 2}" fill="${tint(col, 0.82)}"/>`, label(t, x + rh + 8 + (W - 18 - x - rh) / 2, cy, W - 40 - x - rh, 15, '#1f2937'));
      parts.push(`<rect x="${f(bx + b)}" y="${f(by + b)}" width="${f(s - 2 * b)}" height="${f(s - 2 * b)}" fill="#fff"/>`, `<path d="${ring}" fill="${tint(col, (i % 4) * 0.1)}" fill-rule="evenodd" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>`, label(String(i + 1), bx + s / 2, by + s / 2 + 1, s - 2 * b, 15, tint(col, (i % 4) * 0.1)));
    });
  } else if (d.k === 'donutlist') {
    // Listă cu inele: pe fiecare rând un inel gros (cercul mare minus cel mic, cu evenodd, ca golul să rămână deschis la culoare) cu numărul în gol, apoi o bandă rotunjită cu textul.
    const rh = 50, gap = 8;
    H = 20 + n * (rh + gap) - gap;
    d.items.forEach((t, i) => {
      const y = 10 + i * (rh + gap), x = 10, cx = x + rh / 2, cy = y + rh / 2, ro = rh / 2 - 2, ri = ro * 0.58, f = (v: number) => v.toFixed(1);
      const circ = (r: number) => `M${f(cx - r)},${f(cy)} A${f(r)},${f(r)} 0 1 0 ${f(cx + r)},${f(cy)} A${f(r)},${f(r)} 0 1 0 ${f(cx - r)},${f(cy)} Z`;
      parts.push(`<rect x="${cx}" y="${y + 8}" width="${W - 10 - cx}" height="${rh - 16}" rx="${(rh - 16) / 2}" fill="${tint(col, 0.82)}"/>`, label(t, x + rh + 8 + (W - 18 - x - rh) / 2, cy, W - 40 - x - rh, 15, '#1f2937'));
      parts.push(`<path d="${circ(ri)}" fill="#fff"/>`, `<path d="${circ(ro)} ${circ(ri)}" fill="${tint(col, (i % 4) * 0.1)}" fill-rule="evenodd" stroke="#fff" stroke-width="2"/>`, label(String(i + 1), cx, cy + 1, ri * 1.7, 15, tint(col, (i % 4) * 0.1)));
    });
  } else if (d.k === 'flaglist') {
    // Listă cu stegulețe: pe fiecare rând un băț subțire și un steguleț care flutură (sus și jos câte o undă din curbe), cu numărul pe steag, apoi o bandă rotunjită cu textul.
    const rh = 50, gap = 8;
    H = 20 + n * (rh + gap) - gap;
    d.items.forEach((t, i) => {
      const y = 10 + i * (rh + gap), x = 10, px = x + 8, fw = rh - 12, ft = y + 8, fh = rh - 22, c = tint(col, (i % 4) * 0.1), f = (v: number) => v.toFixed(1);
      const flag = `M${f(px)},${f(ft)} C${f(px + fw / 3)},${f(ft - 6)} ${f(px + 2 * fw / 3)},${f(ft + 6)} ${f(px + fw)},${f(ft)} L${f(px + fw)},${f(ft + fh)} C${f(px + 2 * fw / 3)},${f(ft + fh + 6)} ${f(px + fw / 3)},${f(ft + fh - 6)} ${f(px)},${f(ft + fh)} Z`;
      parts.push(`<rect x="${x + rh / 2}" y="${y + 8}" width="${W - 10 - x - rh / 2}" height="${rh - 16}" rx="${(rh - 16) / 2}" fill="${tint(col, 0.82)}"/>`, label(t, x + rh + 8 + (W - 18 - x - rh) / 2, y + rh / 2, W - 40 - x - rh, 15, '#1f2937'));
      parts.push(`<rect x="${x + 3}" y="${y + 3}" width="4" height="${rh - 6}" rx="2" fill="${tint(col, 0.35)}"/>`, `<path d="${flag}" fill="${c}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>`, label(String(i + 1), px + fw / 2, ft + fh / 2 + 1, fw - 8, 15, '#fff'));
    });
  } else if (d.k === 'ribbonlist') {
    // Listă cu panglici: pe fiecare rând o panglică (dreptunghiul din față cu numărul și, în spate, două capete crestate, mai deschise, care coboară), apoi o bandă rotunjită cu textul.
    const rh = 50, gap = 8;
    H = 20 + n * (rh + gap) - gap;
    d.items.forEach((t, i) => {
      const y = 10 + i * (rh + gap), x = 10, c = tint(col, (i % 4) * 0.1), tl = tint(col, 0.4);
      parts.push(`<rect x="${x + rh / 2}" y="${y + 8}" width="${W - 10 - x - rh / 2}" height="${rh - 16}" rx="${(rh - 16) / 2}" fill="${tint(col, 0.82)}"/>`, label(t, x + rh + 8 + (W - 18 - x - rh) / 2, y + rh / 2, W - 40 - x - rh, 15, '#1f2937'));
      parts.push(`<path d="M${x},${y + 18} L${x + 12},${y + 18} L${x + 12},${y + 42} L${x},${y + 42} L${x + 5},${y + 30} Z" fill="${tl}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>`, `<path d="M${x + rh},${y + 18} L${x + rh - 12},${y + 18} L${x + rh - 12},${y + 42} L${x + rh},${y + 42} L${x + rh - 5},${y + 30} Z" fill="${tl}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>`);
      parts.push(`<rect x="${x + 6}" y="${y + 9}" width="${rh - 12}" height="26" fill="${c}" stroke="#fff" stroke-width="1.5"/>`, label(String(i + 1), x + rh / 2, y + 23, rh - 20, 15, '#fff'));
    });
  } else if (d.k === 'scrolllist') {
    // Listă cu suluri: pe fiecare rând o foaie desfăcută (plină, cu numărul) și la capete câte un sul (un dreptunghi rotunjit, mai deschis), apoi o bandă rotunjită cu textul.
    const rh = 50, gap = 8;
    H = 20 + n * (rh + gap) - gap;
    d.items.forEach((t, i) => {
      const y = 10 + i * (rh + gap), x = 10, c = tint(col, (i % 4) * 0.1), rl = tint(col, 0.4);
      parts.push(`<rect x="${x + rh / 2}" y="${y + 8}" width="${W - 10 - x - rh / 2}" height="${rh - 16}" rx="${(rh - 16) / 2}" fill="${tint(col, 0.82)}"/>`, label(t, x + rh + 8 + (W - 18 - x - rh) / 2, y + rh / 2, W - 40 - x - rh, 15, '#1f2937'));
      parts.push(`<rect x="${x + 8}" y="${y + 10}" width="${rh - 16}" height="${rh - 20}" fill="${c}"/>`, `<rect x="${x + 2}" y="${y + 5}" width="10" height="${rh - 10}" rx="5" fill="${rl}" stroke="#fff" stroke-width="1.5"/>`, `<rect x="${x + rh - 12}" y="${y + 5}" width="10" height="${rh - 10}" rx="5" fill="${rl}" stroke="#fff" stroke-width="1.5"/>`, label(String(i + 1), x + rh / 2, y + rh / 2 + 1, rh - 26, 15, '#fff'));
    });
  } else if (d.k === 'pielist') {
    // Listă cu felii: pe fiecare rând o felie de cerc (cercul fără sfertul din dreapta sus: din centru, un arc mare de trei sferturi) cu numărul, apoi o bandă rotunjită cu textul.
    const rh = 50, gap = 8;
    H = 20 + n * (rh + gap) - gap;
    d.items.forEach((t, i) => {
      const y = 10 + i * (rh + gap), x = 10, cx = x + rh / 2, cy = y + rh / 2, r = rh / 2 - 2, c = tint(col, (i % 4) * 0.1);
      parts.push(`<rect x="${cx}" y="${y + 8}" width="${W - 10 - cx}" height="${rh - 16}" rx="${(rh - 16) / 2}" fill="${tint(col, 0.82)}"/>`, label(t, x + rh + 8 + (W - 18 - x - rh) / 2, cy, W - 40 - x - rh, 15, '#1f2937'));
      parts.push(`<path d="M${cx},${cy} L${cx + r},${cy} A${r},${r} 0 1 1 ${cx},${cy - r} Z" fill="${c}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>`, label(String(i + 1), cx - r * 0.3, cy + r * 0.3, r, 15, '#fff'));
    });
  } else if (d.k === 'cardlist') {
    // Listă cu fișe: pe fiecare rând o fișă pătrată cu colțul din dreapta sus tăiat (un contur din 5 colțuri) cu numărul, apoi o bandă rotunjită cu textul.
    const rh = 50, gap = 8;
    H = 20 + n * (rh + gap) - gap;
    d.items.forEach((t, i) => {
      const y = 10 + i * (rh + gap), x = 10, a = x + 3, b = y + 3, s = rh - 6, k = 12, c = tint(col, (i % 4) * 0.1);
      parts.push(`<rect x="${x + rh / 2}" y="${y + 8}" width="${W - 10 - x - rh / 2}" height="${rh - 16}" rx="${(rh - 16) / 2}" fill="${tint(col, 0.82)}"/>`, label(t, x + rh + 8 + (W - 18 - x - rh) / 2, y + rh / 2, W - 40 - x - rh, 15, '#1f2937'));
      parts.push(`<path d="M${a},${b} L${a + s - k},${b} L${a + s},${b + k} L${a + s},${b + s} L${a},${b + s} Z" fill="${c}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>`, label(String(i + 1), a + s / 2, b + s / 2 + 1, s - 10, 15, '#fff'));
    });
  } else if (d.k === 'burstlist') {
    // Listă cu explozii: pe fiecare rând o explozie (un contur cu 12 colțuri ascuțite, cu razele puțin diferite, ca o explozie desenată) cu numărul, apoi o bandă rotunjită cu textul.
    const rh = 50, gap = 8, RO = [1, 0.86, 0.97, 0.9, 1, 0.84, 0.95, 0.88, 1, 0.9, 0.93, 0.86];
    H = 20 + n * (rh + gap) - gap;
    d.items.forEach((t, i) => {
      const y = 10 + i * (rh + gap), x = 10, cx = x + rh / 2, cy = y + rh / 2, R = rh / 2 - 1, c = tint(col, (i % 4) * 0.1), f = (v: number) => v.toFixed(1);
      const pts = Array.from({ length: 24 }, (_, j) => { const a = (j * Math.PI) / 12 - Math.PI / 2, r = j % 2 ? R * 0.62 : R * RO[j / 2]; return `${f(cx + r * Math.cos(a))},${f(cy + r * Math.sin(a))}`; });
      parts.push(`<rect x="${cx}" y="${y + 8}" width="${W - 10 - cx}" height="${rh - 16}" rx="${(rh - 16) / 2}" fill="${tint(col, 0.82)}"/>`, label(t, x + rh + 8 + (W - 18 - x - rh) / 2, cy, W - 40 - x - rh, 15, '#1f2937'));
      parts.push(`<path d="M${pts.join(' L')} Z" fill="${c}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>`, label(String(i + 1), cx, cy + 1, R, 15, '#fff'));
    });
  } else if (d.k === 'halfcirclelist') {
    // Listă cu semicercuri: pe fiecare rând o formă dreaptă la stânga și rotunjită la dreapta (jumătate de pătrat și un semicerc) cu numărul, apoi o bandă rotunjită cu textul.
    const rh = 50, gap = 8;
    H = 20 + n * (rh + gap) - gap;
    d.items.forEach((t, i) => {
      const y = 10 + i * (rh + gap), x = 10, a = x + 3, b = y + 3, s = rh - 6, c = tint(col, (i % 4) * 0.1);
      parts.push(`<rect x="${x + rh / 2}" y="${y + 8}" width="${W - 10 - x - rh / 2}" height="${rh - 16}" rx="${(rh - 16) / 2}" fill="${tint(col, 0.82)}"/>`, label(t, x + rh + 8 + (W - 18 - x - rh) / 2, y + rh / 2, W - 40 - x - rh, 15, '#1f2937'));
      parts.push(`<path d="M${a},${b} L${a + s / 2},${b} A${s / 2},${s / 2} 0 0 1 ${a + s / 2},${b + s} L${a},${b + s} Z" fill="${c}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>`, label(String(i + 1), a + s * 0.45, b + s / 2 + 1, s - 12, 15, '#fff'));
    });
  } else if (d.k === 'pilllist') {
    // Listă cu capsule: pe fiecare rând o capsulă culcată (două semicercuri unite prin laturi drepte) cu numărul, apoi o bandă rotunjită cu textul.
    const rh = 50, gap = 8;
    H = 20 + n * (rh + gap) - gap;
    d.items.forEach((t, i) => {
      const y = 10 + i * (rh + gap), x = 10, a = x + 2, w = rh - 4, h = 26, b = y + (rh - h) / 2, r = h / 2, c = tint(col, (i % 4) * 0.1);
      parts.push(`<rect x="${x + rh / 2}" y="${y + 8}" width="${W - 10 - x - rh / 2}" height="${rh - 16}" rx="${(rh - 16) / 2}" fill="${tint(col, 0.82)}"/>`, label(t, x + rh + 8 + (W - 18 - x - rh) / 2, y + rh / 2, W - 40 - x - rh, 15, '#1f2937'));
      parts.push(`<path d="M${a + r},${b} L${a + w - r},${b} A${r},${r} 0 0 1 ${a + w - r},${b + h} L${a + r},${b + h} A${r},${r} 0 0 1 ${a + r},${b} Z" fill="${c}" stroke="#fff" stroke-width="1.5"/>`, label(String(i + 1), a + w / 2, b + h / 2 + 1, w - 12, 15, '#fff'));
    });
  } else if (d.k === 'parallelogramlist' || d.k === 'heptagonlist' || d.k === 'dodecagonlist' || d.k === 'signlist' || d.k === 'calloutlist' || d.k === 'star6list' || d.k === 'star8list' || d.k === 'sparklist' || d.k === 'notchlist' || d.k === 'boltlist' || d.k === 'setsquarelist' || d.k === 'trapezoidlist' || d.k === 'star10list' || d.k === 'star7list' || d.k === 'star16list' || d.k === 'star24list' || d.k === 'star32list' || d.k === 'badgelist' || d.k === 'sniplist' || d.k === 'round1list' || d.k === 'snipdiaglist' || d.k === 'rounddiaglist' || d.k === 'quarterlist' || d.k === 'sniproundlist' || d.k === 'ovalcalloutlist' || d.k === 'roundcalloutlist' || d.k === 'chordlist' || d.k === 'displaylist' || d.k === 'mergelist' || d.k === 'cornerlist' || d.k === 'desklist' || d.k === 'stripelist' || d.k === 'halfframelist' || d.k === 'storagelist' || d.k === 'rightcalloutlist' || d.k === 'downcalloutlist' || d.k === 'upcalloutlist' || d.k === 'burst2list' || d.k === 'lrcalloutlist' || d.k === 'quadcalloutlist') {
    // Listă cu paralelograme / cu heptagoane / cu indicatoare / cu bule de vorbire: pe fiecare rând forma cu numărul (paralelogramul înclinat spre dreapta;
    // heptagonul cu un colț sus; indicatorul cu vârful spre dreapta; bula cu coada în jos, spre stânga, și numărul în dreptunghiul ei;
    // steaua cu 6 / 8 colțuri: vârfurile pe cercul mare, colțurile dintre ele pe unul mai mic, un colț sus;
    // sclipirea = steaua cu 4 colțuri, cu talia îngustă; săgeata crestată cu vârful spre dreapta și o crestătură în coadă;
    // fulgerul: o bucată lată sus, cu numărul, și vârful în jos, spre stânga; echerul: unghiul drept jos, în stânga, cu numărul lângă el;
    // trapezul mai lat jos; steaua cu 10 colțuri ca celelalte stele; ecusonul: un pătrat cu vârful în jos; plăcuța teșită: colțurile de sus tăiate; plăcuța rotunjită: colțul din dreapta sus e un sfert de cerc, din 5 puncte; colțurile opuse: tăiate sau rotunjite pe diagonală; sfertul de cerc: arcul din 9 puncte și colțul drept jos în dreapta;
    // bula ovală: elipsa din 24 de puncte, cu punctul de jos-stânga înlocuit de vârful cozii; bula rotunjită: ca bula de vorbire, cu colțurile din câte 4 puncte;
    // segmentul de cerc: arcul de la 45° la 270° din 13 puncte, închis cu o coardă dreaptă; ecranul: vârf în stânga, latura dreaptă un semicerc din 9 puncte;
    // triunghiul întors: latura lungă sus, vârful jos; colțarul: un L cu brațele groase, numărul în colțul de jos-stânga;
    // pupitrul: marginea de sus urcă spre dreapta; banda oblică: o fâșie de la jos-stânga la sus-dreapta, numărul la mijlocul ei;
    // jumătatea de cadru: latura de sus și cea din stânga, groase, numărul în colțul lor; datele stocate: stânga un arc ieșit în afară, dreapta un arc scobit, din câte 9 puncte;
    // caseta cu săgeată: caseta cu numărul și o săgeată scurtă spre bandă (sau în jos, spre rândul următor), din 11 puncte; caseta cu săgeată în sus: săgeata deasupra casetei;
    // explozia mare: 28 de colțuri neregulate, pe grila de 21600 a formei din Slides;
    // casetele cu săgeți în ambele părți (18 puncte) și în patru părți (32 de puncte): caseta cu numărul la mijloc),
    // apoi o bandă rotunjită cu textul.
    const rh = 50, gap = 8;
    H = 20 + n * (rh + gap) - gap;
    d.items.forEach((t, i) => {
      const y = 10 + i * (rh + gap), x = 10, cx = x + rh / 2, cy = y + rh / 2, R = rh / 2 - 2, c = tint(col, (i % 4) * 0.1), f = (v: number) => v.toFixed(1);
      const pts = d.k === 'parallelogramlist'
        ? [[x + 12, y + 5], [x + rh + 2, y + 5], [x + rh - 10, y + rh - 5], [x, y + rh - 5]].map(([u, v]) => `${f(u)},${f(v)}`)
        : d.k === 'trapezoidlist' ? [[x + 12, y + 5], [x + rh - 10, y + 5], [x + rh + 2, y + rh - 5], [x, y + rh - 5]].map(([u, v]) => `${f(u)},${f(v)}`)
        : d.k === 'setsquarelist' ? [[x + 2, y + 3], [x + 2, y + rh - 3], [x + rh + 2, y + rh - 3]].map(([u, v]) => `${f(u)},${f(v)}`)
        : d.k === 'boltlist' ? [[0.38, 0.02], [0.82, 0.02], [0.62, 0.36], [0.9, 0.36], [0.3, 0.98], [0.44, 0.56], [0.12, 0.56]].map(([u, v]) => `${f(x + u * rh)},${f(y + v * rh)}`)
        : d.k === 'notchlist' ? [[x, y + 9], [x + rh - 16, y + 9], [x + rh - 16, y + 3], [x + rh + 4, cy], [x + rh - 16, y + rh - 3], [x + rh - 16, y + rh - 9], [x, y + rh - 9], [x + 8, cy]].map(([u, v]) => `${f(u)},${f(v)}`)
        : d.k === 'star6list' || d.k === 'star8list' || d.k === 'sparklist' || d.k === 'star10list' || d.k === 'star7list' || d.k === 'star16list' || d.k === 'star24list' || d.k === 'star32list' ? Array.from({ length: d.k === 'star6list' ? 12 : d.k === 'sparklist' ? 8 : d.k === 'star10list' ? 20 : d.k === 'star7list' ? 14 : d.k === 'star16list' ? 32 : d.k === 'star24list' ? 48 : d.k === 'star32list' ? 64 : 16 }, (_, j, np = d.k === 'star6list' ? 6 : d.k === 'sparklist' ? 4 : d.k === 'star10list' ? 10 : d.k === 'star7list' ? 7 : d.k === 'star16list' ? 16 : d.k === 'star24list' ? 24 : d.k === 'star32list' ? 32 : 8) => { const a = (j * Math.PI) / np - Math.PI / 2, q = j % 2 ? R * (np === 4 ? 0.45 : np === 6 ? 0.62 : np === 10 ? 0.78 : np === 7 ? 0.66 : np === 16 ? 0.8 : np === 24 ? 0.84 : np === 32 ? 0.87 : 0.72) : R; return `${f(cx + q * Math.cos(a))},${f(cy + 1 + q * Math.sin(a))}`; })
        : d.k === 'calloutlist' ? [[x, y + 4], [x + rh, y + 4], [x + rh, y + rh - 14], [x + 20, y + rh - 14], [x + 8, y + rh - 3], [x + 11, y + rh - 14], [x, y + rh - 14]].map(([u, v]) => `${f(u)},${f(v)}`)
        : d.k === 'badgelist' ? [[x + 4, y + 2], [x + rh - 4, y + 2], [x + rh - 4, y + rh * 0.62], [cx, y + rh - 1], [x + 4, y + rh * 0.62]].map(([u, v]) => `${f(u)},${f(v)}`)
        : d.k === 'quarterlist' ? [...Array.from({ length: 9 }, (_, j) => { const a = Math.PI + (j / 8) * Math.PI / 2; return [x + rh - 4 + (rh - 8) * Math.cos(a), y + rh - 4 + (rh - 8) * Math.sin(a)]; }), [x + rh - 4, y + rh - 4]].map(([u, v]) => `${f(u)},${f(v)}`)
        : d.k === 'mergelist' ? [[x + 2, y + 4], [x + rh + 2, y + 4], [cx + 1, y + rh - 2]].map(([u, v]) => `${f(u)},${f(v)}`)
        : d.k === 'lrcalloutlist' ? [[0.2594, 0], [0.7406, 0], [0.7406, 0.375], [0.75, 0.375], [0.75, 0.25], [1, 0.5], [0.75, 0.75], [0.75, 0.625], [0.7406, 0.625], [0.7406, 1], [0.2594, 1], [0.2594, 0.625], [0.25, 0.625], [0.25, 0.75], [0, 0.5], [0.25, 0.25], [0.25, 0.375], [0.2594, 0.375]].map(([u, v]) => `${f(x - 1 + u * (rh + 6))},${f(y + 6 + v * (rh - 12))}`)
        : d.k === 'quadcalloutlist' ? [[0.5, 0], [0.6852, 0.1852], [0.5926, 0.1852], [0.5926, 0.2594], [0.7406, 0.2594], [0.7406, 0.4074], [0.8148, 0.4074], [0.8148, 0.3148], [1, 0.5], [0.8148, 0.6852], [0.8148, 0.5926], [0.7406, 0.5926], [0.7406, 0.7406], [0.5926, 0.7406], [0.5926, 0.8148], [0.6852, 0.8148], [0.5, 1], [0.3148, 0.8148], [0.4074, 0.8148], [0.4074, 0.7406], [0.2594, 0.7406], [0.2594, 0.5926], [0.1852, 0.5926], [0.1852, 0.6852], [0, 0.5], [0.1852, 0.3148], [0.1852, 0.4074], [0.2594, 0.4074], [0.2594, 0.2594], [0.4074, 0.2594], [0.4074, 0.1852], [0.3148, 0.1852]].map(([u, v]) => `${f(x + 1 + u * (rh - 2))},${f(y + 1 + v * (rh - 2))}`)
        : d.k === 'upcalloutlist' ? [[0, 0.35], [0.375, 0.35], [0.375, 0.25], [0.25, 0.25], [0.5, 0], [0.75, 0.25], [0.625, 0.25], [0.625, 0.35], [1, 0.35], [1, 1], [0, 1]].map(([u, v]) => `${f(x + 2 + u * (rh - 4))},${f(y + 2 + v * (rh - 4))}`)
        : d.k === 'burst2list' ? [[11462, 4342], [14790, 0], [14525, 5777], [18007, 3172], [16380, 6532], [21600, 6645], [16985, 9402], [18270, 11290], [16380, 12310], [18877, 15632], [14640, 14350], [14942, 17370], [12180, 15935], [11612, 18842], [9872, 17370], [8700, 19712], [7527, 18125], [4917, 21600], [4805, 18240], [1285, 17825], [3330, 15370], [0, 12877], [3935, 11592], [1172, 8270], [5372, 7817], [4502, 3625], [8550, 6382], [9722, 1887]].map(([u, v]) => `${f(x + (u / 21600) * (rh + 2))},${f(y + 1 + (v / 21600) * (rh - 2))}`)
        : d.k === 'rightcalloutlist' ? [[0, 0], [0.65, 0], [0.65, 0.375], [0.75, 0.375], [0.75, 0.25], [1, 0.5], [0.75, 0.75], [0.75, 0.625], [0.65, 0.625], [0.65, 1], [0, 1]].map(([u, v]) => `${f(x + u * (rh + 4))},${f(y + 4 + v * (rh - 8))}`)
        : d.k === 'downcalloutlist' ? [[0, 0], [1, 0], [1, 0.65], [0.625, 0.65], [0.625, 0.75], [0.75, 0.75], [0.5, 1], [0.25, 0.75], [0.375, 0.75], [0.375, 0.65], [0, 0.65]].map(([u, v]) => `${f(x + 2 + u * (rh - 4))},${f(y + 2 + v * (rh - 4))}`)
        : d.k === 'halfframelist' ? [[x + 2, y + 3], [x + rh, y + 3], [x + rh * 0.62, y + rh * 0.44], [x + rh * 0.44, y + rh * 0.44], [x + rh * 0.44, y + rh * 0.62], [x + 2, y + rh - 3]].map(([u, v]) => `${f(u)},${f(v)}`)
        : d.k === 'storagelist' ? [...Array.from({ length: 9 }, (_, j) => { const a = Math.PI / 2 + (j / 8) * Math.PI; return [x + 9 + 9 * Math.cos(a), cy + (rh / 2 - 4) * Math.sin(a)]; }), ...Array.from({ length: 9 }, (_, j) => { const a = 1.5 * Math.PI - (j / 8) * Math.PI; return [x + rh + 6 + 9 * Math.cos(a), cy + (rh / 2 - 4) * Math.sin(a)]; })].map(([u, v]) => `${f(u)},${f(v)}`)
        : d.k === 'desklist' ? [[x, y + 16], [x + rh, y + 4], [x + rh, y + rh - 4], [x, y + rh - 4]].map(([u, v]) => `${f(u)},${f(v)}`)
        : d.k === 'stripelist' ? [[x, cy], [cx, y + 3], [x + rh, y + 3], [x, y + rh - 3]].map(([u, v]) => `${f(u)},${f(v)}`)
        : d.k === 'cornerlist' ? [[x, y + 4], [x + 24, y + 4], [x + 24, y + rh - 28], [x + rh, y + rh - 28], [x + rh, y + rh - 4], [x, y + rh - 4]].map(([u, v]) => `${f(u)},${f(v)}`)
        : d.k === 'chordlist' ? Array.from({ length: 13 }, (_, j) => { const a = ((45 + j * 18.75) * Math.PI) / 180; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; }).map(([u, v]) => `${f(u)},${f(v)}`)
        : d.k === 'displaylist' ? [[x, cy], [x + 12, y + 5], ...Array.from({ length: 9 }, (_, j) => { const a = ((j / 8) - 0.5) * Math.PI; return [x + rh - 20 + 20 * Math.cos(a), cy + 20 * Math.sin(a)]; }), [x + 12, y + rh - 5]].map(([u, v]) => `${f(u)},${f(v)}`)
        : d.k === 'ovalcalloutlist' ? Array.from({ length: 24 }, (_, j) => { const a = (j / 24) * 2 * Math.PI; return j === 8 ? [x + 3, y + rh - 2] : [cx + rh / 2 * Math.cos(a), y + 19 + 15 * Math.sin(a)]; }).map(([u, v]) => `${f(u)},${f(v)}`)
        : d.k === 'roundcalloutlist' ? ((rc: (ox: number, oy: number, a0: number) => number[][]) => [...rc(x + rh - 6, y + 10, 270), ...rc(x + rh - 6, y + rh - 20, 0), [x + 20, y + rh - 14], [x + 8, y + rh - 3], [x + 11, y + rh - 14], ...rc(x + 6, y + rh - 20, 90), ...rc(x + 6, y + 10, 180)])((ox, oy, a0) => [0, 1, 2, 3].map((j) => { const a = ((a0 + j * 30) * Math.PI) / 180; return [ox + 6 * Math.cos(a), oy + 6 * Math.sin(a)]; })).map(([u, v]) => `${f(u)},${f(v)}`)
        : d.k === 'sniproundlist' ? [...[0, 1, 2, 3, 4].map((j) => { const a = Math.PI + (j / 4) * Math.PI / 2; return [x + 14 + 14 * Math.cos(a), y + 18 + 14 * Math.sin(a)]; }), [x + rh - 12, y + 4], [x + rh, y + 16], [x + rh, y + rh - 4], [x, y + rh - 4]].map(([u, v]) => `${f(u)},${f(v)}`)
        : d.k === 'snipdiaglist' ? [[x, y + 4], [x + rh - 12, y + 4], [x + rh, y + 16], [x + rh, y + rh - 4], [x + 12, y + rh - 4], [x, y + rh - 16]].map(([u, v]) => `${f(u)},${f(v)}`)
        : d.k === 'rounddiaglist' ? [...[0, 1, 2, 3, 4].map((j) => { const a = Math.PI + (j / 4) * Math.PI / 2; return [x + 14 + 14 * Math.cos(a), y + 18 + 14 * Math.sin(a)]; }), [x + rh, y + 4], ...[0, 1, 2, 3, 4].map((j) => { const a = (j / 4) * Math.PI / 2; return [x + rh - 14 + 14 * Math.cos(a), y + rh - 18 + 14 * Math.sin(a)]; }), [x, y + rh - 4]].map(([u, v]) => `${f(u)},${f(v)}`)
        : d.k === 'round1list' ? [[x, y + 4], ...[0, 1, 2, 3, 4].map((j) => { const a = (j / 4 - 1) * Math.PI / 2; return [x + rh - 16 + 16 * Math.cos(a), y + 20 + 16 * Math.sin(a)]; }), [x + rh, y + rh - 4], [x, y + rh - 4]].map(([u, v]) => `${f(u)},${f(v)}`)
        : d.k === 'sniplist' ? [[x + 12, y + 4], [x + rh - 12, y + 4], [x + rh, y + 16], [x + rh, y + rh - 4], [x, y + rh - 4], [x, y + 16]].map(([u, v]) => `${f(u)},${f(v)}`)
        : d.k === 'signlist' ? [[x, y + 5], [x + rh - 14, y + 5], [x + rh + 2, cy], [x + rh - 14, y + rh - 5], [x, y + rh - 5]].map(([u, v]) => `${f(u)},${f(v)}`)
        : Array.from({ length: d.k === 'heptagonlist' ? 7 : 12 }, (_, j, np = d.k === 'heptagonlist' ? 7 : 12) => { const a = (j * 2 * Math.PI) / np - Math.PI / 2; return `${f(cx + R * Math.cos(a))},${f(cy + 1 + R * Math.sin(a))}`; });
      parts.push(`<rect x="${cx}" y="${y + 8}" width="${W - 10 - cx}" height="${rh - 16}" rx="${(rh - 16) / 2}" fill="${tint(col, 0.82)}"/>`, label(t, x + rh + 8 + (W - 18 - x - rh) / 2, cy, W - 40 - x - rh, 15, '#1f2937'));
      parts.push(`<path d="M${pts.join(' L')} Z" fill="${c}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>`, label(String(i + 1), d.k === 'rightcalloutlist' ? x + rh * 0.35 : d.k === 'halfframelist' ? x + 12 : d.k === 'stripelist' ? x + rh * 0.36 : d.k === 'cornerlist' ? x + 12 : d.k === 'chordlist' ? cx - 3 : d.k === 'boltlist' ? x + rh * 0.53 : d.k === 'setsquarelist' ? x + rh * 0.34 : cx + 1, d.k === 'upcalloutlist' ? y + rh * 0.7 : d.k === 'burst2list' ? cy + 2 : d.k === 'downcalloutlist' ? y + rh * 0.36 : d.k === 'halfframelist' ? y + 14 : d.k === 'stripelist' ? y + rh * 0.36 : d.k === 'desklist' ? cy + 5 : d.k === 'cornerlist' ? y + rh - 15 : d.k === 'mergelist' ? cy - 7 : d.k === 'chordlist' ? cy + 4 : d.k === 'calloutlist' || d.k === 'badgelist' || d.k === 'roundcalloutlist' ? cy - 4 : d.k === 'ovalcalloutlist' ? cy - 6 : d.k === 'boltlist' ? y + rh * 0.42 : d.k === 'setsquarelist' ? y + rh * 0.68 : cy + 2, d.k === 'boltlist' || d.k === 'setsquarelist' || d.k === 'cornerlist' || d.k === 'stripelist' || d.k === 'halfframelist' || d.k === 'rightcalloutlist' || d.k === 'downcalloutlist' || d.k === 'upcalloutlist' || d.k === 'burst2list' || d.k === 'lrcalloutlist' || d.k === 'quadcalloutlist' ? R * 0.8 : R * 1.3, d.k === 'boltlist' || d.k === 'setsquarelist' || d.k === 'cornerlist' || d.k === 'stripelist' || d.k === 'halfframelist' || d.k === 'rightcalloutlist' || d.k === 'downcalloutlist' || d.k === 'upcalloutlist' || d.k === 'burst2list' || d.k === 'lrcalloutlist' || d.k === 'quadcalloutlist' ? 13 : 15, '#fff'));
    });
  } else if (d.k === 'moonlist') {
    // Listă cu semilune: pe fiecare rând o semilună deschisă spre dreapta (arcul mare al cercului și un arc mai mic, întors), cu numărul
    // în partea ei plină, din stânga, apoi o bandă rotunjită cu textul.
    const rh = 50, gap = 8;
    H = 20 + n * (rh + gap) - gap;
    d.items.forEach((t, i) => {
      const y = 10 + i * (rh + gap), x = 10, cx = x + rh / 2, cy = y + rh / 2, R = rh / 2 - 2, c = tint(col, (i % 4) * 0.1), f = (v: number) => v.toFixed(1);
      const tx = f(cx + R * 0.3), ty = f(cy - R * 0.95), by = f(cy + R * 0.95);
      parts.push(`<rect x="${cx}" y="${y + 8}" width="${W - 10 - cx}" height="${rh - 16}" rx="${(rh - 16) / 2}" fill="${tint(col, 0.82)}"/>`, label(t, x + rh + 8 + (W - 18 - x - rh) / 2, cy, W - 40 - x - rh, 15, '#1f2937'));
      parts.push(`<path d="M${tx} ${ty} A${f(R)} ${f(R)} 0 1 0 ${tx} ${by} A${f(R)} ${f(R)} 0 0 1 ${tx} ${ty} Z" fill="${c}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>`, label(String(i + 1), cx - R * 0.68, cy + 1, R * 0.7, 12, '#fff'));
    });
  } else if (d.k === 'decagonlist') {
    // Listă cu decagoane: pe fiecare rând un decagon (10 colțuri pe un cerc, cu o latură sus) cu numărul, apoi o bandă rotunjită cu textul.
    const rh = 50, gap = 8;
    H = 20 + n * (rh + gap) - gap;
    d.items.forEach((t, i) => {
      const y = 10 + i * (rh + gap), x = 10, cx = x + rh / 2, cy = y + rh / 2, R = rh / 2 - 2, c = tint(col, (i % 4) * 0.1), f = (v: number) => v.toFixed(1);
      const pts = Array.from({ length: 10 }, (_, j) => { const a = ((j + 0.5) * Math.PI) / 5 - Math.PI / 2; return `${f(cx + R * Math.cos(a))},${f(cy + R * Math.sin(a))}`; });
      parts.push(`<rect x="${cx}" y="${y + 8}" width="${W - 10 - cx}" height="${rh - 16}" rx="${(rh - 16) / 2}" fill="${tint(col, 0.82)}"/>`, label(t, x + rh + 8 + (W - 18 - x - rh) / 2, cy, W - 40 - x - rh, 15, '#1f2937'));
      parts.push(`<path d="M${pts.join(' L')} Z" fill="${c}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>`, label(String(i + 1), cx, cy + 1, R * 1.4, 15, '#fff'));
    });
  } else if (d.k === 'growthcurve') {
    // Curbă de creștere: o curbă care urcă tot mai repede din stânga jos spre dreapta sus, cu o bulină pentru fiecare idee;
    // textul stă sub curbă, în dreapta bulinei (acolo e mereu loc liber, fiindcă curba urcă spre dreapta), fără să atingă căsuța următoare.
    H = 280;
    const bh = 36, x1 = 20, x2 = W - 20, yb = H - 24 - bh, yt = 20, line = tint(col, 0.45);
    const f = (t: number) => ({ x: x1 + (x2 - x1) * t, y: yb - (yb - yt) * Math.pow(t, 1.8) });
    const pts = Array.from({ length: 41 }, (_, i) => f(i / 40)).map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
    parts.push(`<path d="M${pts.join(' L')}" fill="none" stroke="${line}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`);
    const slot = (x2 - x1) / (n + 0.3), bw = Math.min(150, slot - 10);
    d.items.forEach((t, i) => {
      const p = f((slot * (i + 0.3)) / (x2 - x1)), bx = p.x + 6, by = p.y + 14;
      parts.push(`<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh}" rx="${bh / 2}" fill="${tint(col, 0.15 + (i % 4) * 0.1)}"/>`, label(t, bx + bw / 2, by + bh / 2, bw - 14, n > 5 ? 11 : 13, '#fff'));
      parts.push(`<ellipse cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" rx="9" ry="9" fill="${col}" stroke="#fff" stroke-width="3"/>`);
    });
  } else if (d.k === 'roadmap') {
    // Drum cu borne: un drum lat care șerpuiește de la stânga la dreapta (cu linia albă întreruptă la mijloc), o bornă rotundă pentru
    // fiecare etapă, iar căsuța cu textul pe rând deasupra și dedesubtul drumului, legată de bornă printr-o linie scurtă.
    H = 300;
    const bh = 44, cy = H / 2, amp = 26, x1 = 20, x2 = W - 20, slot = (x2 - x1) / n, bw = Math.min(150, (2.5 * slot - 14) / 1.5), road = tint(col, 0.55);
    const yAt = (x: number) => cy + amp * Math.sin(((x - x1) / (x2 - x1)) * Math.PI * 2);
    const pts = Array.from({ length: 57 }, (_, i) => { const x = 6 + ((W - 12) * i) / 56; return `${x.toFixed(1)} ${yAt(x).toFixed(1)}`; });
    parts.push(`<path d="M${pts.join(' L')}" fill="none" stroke="${road}" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>`, `<path d="M${pts.join(' L')}" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="10 8"/>`);
    d.items.forEach((t, i) => {
      const x = x1 + slot * (i + 0.5), y = yAt(x), up = i % 2 === 0, bx = Math.max(6, Math.min(W - 6 - bw, x - bw / 2)), by = up ? 12 : H - 12 - bh;
      parts.push(`<path d="M${x.toFixed(1)} ${(up ? by + bh : by).toFixed(1)} L${x.toFixed(1)} ${(up ? y - 12 : y + 12).toFixed(1)}" stroke="${road}" stroke-width="2.5"/>`);
      parts.push(`<rect x="${bx.toFixed(1)}" y="${by}" width="${bw.toFixed(1)}" height="${bh}" rx="10" fill="${tint(col, (i % 4) * 0.1)}"/>`, label(t, bx + bw / 2, by + bh / 2, bw - 14, n > 5 ? 11 : 13, '#fff'));
      parts.push(`<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="10" ry="10" fill="${col}" stroke="#fff" stroke-width="3"/>`);
    });
  } else if (d.k === 'mountain') {
    // Munte cu etape: un munte (triunghi) cu zăpadă pe vârf și un steag sus; etapele urcă pe o potecă în zigzag, de la poale
    // până pe vârf (ultima), cu căsuța pe rând în stânga și în dreapta muntelui, legată de punct printr-o linie scurtă.
    H = 340;
    const cx = W / 2, yp = 52, yb = H - 6, half = W * 0.22, gap = 10, bw = W / 2 - half - gap - 8, step = n > 1 ? (yb - yp - 26) / (n - 1) : 0;
    const bh = Math.min(42, n > 2 ? 2 * step - 8 : 42), hw = (y: number) => (half * (y - yp)) / (yb - yp);
    const p = (pts: number[][]) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L');
    parts.push(`<path d="M${p([[cx - half, yb], [cx, yp], [cx + half, yb]])} Z" fill="${tint(col, 0.55)}" stroke="${tint(col, 0.3)}" stroke-width="2" stroke-linejoin="round"/>`);
    const ys = yp + (yb - yp) * 0.24, sh = hw(ys);
    parts.push(`<path d="M${p([[cx, yp], [cx + sh, ys], [cx + sh * 0.45, ys - 8], [cx + sh * 0.1, ys + 2], [cx - sh * 0.3, ys - 9], [cx - sh, ys]])} Z" fill="#fff" fill-opacity="0.85"/>`);
    parts.push(`<path d="M${cx} ${yp} L${cx} ${yp - 40} L${cx + 26} ${yp - 32} L${cx} ${yp - 24}" fill="${col}" stroke="${col}" stroke-width="2" stroke-linejoin="round"/>`);
    const pt = d.items.map((_, i) => { const y = n > 1 ? yb - 26 - i * step : yp, left = i % 2 === 0; return { y, left, x: i === n - 1 ? cx : cx + (left ? -0.5 : 0.5) * hw(y) }; });
    parts.push(`<path d="M${pt.map((q) => `${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' L')}" fill="none" stroke="#fff" stroke-width="2.5" stroke-dasharray="7 6"/>`);
    d.items.forEach((t, i) => {
      const q = pt[i], e = cx + (q.left ? -1 : 1) * (hw(q.y) + gap), bx = q.left ? e - bw : e, by = Math.max(4, Math.min(yb - bh, q.y - bh / 2));
      parts.push(`<path d="M${q.x.toFixed(1)} ${q.y.toFixed(1)} L${e.toFixed(1)} ${q.y.toFixed(1)}" stroke="${tint(col, 0.3)}" stroke-width="2"/>`);
      parts.push(`<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="10" fill="${tint(col, (i % 4) * 0.1)}"/>`, label(t, bx + bw / 2, by + bh / 2, bw - 14, n > 5 ? 11 : 13, '#fff'));
      parts.push(`<ellipse cx="${q.x.toFixed(1)}" cy="${q.y.toFixed(1)}" rx="8" ry="8" fill="${col}" stroke="#fff" stroke-width="3"/>`);
    });
  } else if (d.k === 'thermometer') {
    // Termometru: tubul și rezervorul rotund de jos, coloana colorată plină până la ultimul nivel; nivelurile pe scară, de jos în sus,
    // fiecare cu o gradație și o căsuță în dreapta tubului.
    H = 330;
    const tx = W * 0.3, tw = 28, yt = 18, cb = H - 40, rb = 30, ylo = cb - rb - 18, yhi = yt + 24, step = n > 1 ? (ylo - yhi) / (n - 1) : 0;
    const bh = Math.min(40, n > 1 ? step - 6 : 40), bx = tx + tw / 2 + 34, bw = W - 16 - bx;
    parts.push(`<rect x="${tx - tw / 2}" y="${yt}" width="${tw}" height="${cb - yt}" rx="${tw / 2}" fill="${tint(col, 0.88)}" stroke="${tint(col, 0.4)}" stroke-width="2"/>`);
    parts.push(`<ellipse cx="${tx}" cy="${cb}" rx="${rb}" ry="${rb}" fill="${tint(col, 0.88)}" stroke="${tint(col, 0.4)}" stroke-width="2"/>`);
    const ytop = ylo - (n - 1) * step;
    parts.push(`<rect x="${tx - 7}" y="${(ytop - 4).toFixed(1)}" width="14" height="${(cb - ytop + 4).toFixed(1)}" rx="7" fill="${col}"/>`, `<ellipse cx="${tx}" cy="${cb}" rx="${rb - 8}" ry="${rb - 8}" fill="${col}"/>`);
    d.items.forEach((t, i) => {
      const y = ylo - i * step, by = y - bh / 2;
      parts.push(`<path d="M${tx + tw / 2 + 4} ${y.toFixed(1)} L${bx - 6} ${y.toFixed(1)}" stroke="${tint(col, 0.3)}" stroke-width="2"/>`);
      parts.push(`<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="10" fill="${tint(col, 0.3 - (i / Math.max(1, n - 1)) * 0.3)}"/>`, label(t, bx + bw / 2, y, bw - 14, n > 6 ? 11 : 13, '#fff'));
    });
  } else if (d.k === 'tree') {
    // Copac: trunchiul, coroana (un oval mare), primul element într-o căsuță la rădăcină; celelalte în frunze ovale în coroană
    // (pe două rânduri peste 4), legate de vârful trunchiului prin ramuri desenate sub frunze.
    const m = n - 1, cx = W / 2, cy = 105, rx = 250, ry = 95, rows = m > 4 ? 2 : 1, cols = Math.ceil(m / rows), lw = Math.min(130, 400 / cols - 8), lh = 44;
    H = 300;
    const leaves = d.items.slice(1).map((t, i) => { const r = Math.floor(i / cols), inRow = r < rows - 1 ? cols : m - cols * (rows - 1), c = i - r * cols; return { t, x: cx + (c - (inRow - 1) / 2) * (lw + 8), y: rows > 1 ? (r ? 140 : 72) : cy }; });
    parts.push(`<rect x="${cx - 24}" y="170" width="48" height="84" fill="${tint(col, 0.35)}"/>`, `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${tint(col, 0.82)}"/>`);
    leaves.forEach((q) => parts.push(`<path d="M${cx} 186 Q${cx} ${((q.y + 186) / 2).toFixed(1)} ${q.x.toFixed(1)} ${q.y.toFixed(1)}" fill="none" stroke="${tint(col, 0.35)}" stroke-width="4" stroke-linecap="round"/>`));
    leaves.forEach((q, i) => parts.push(`<ellipse cx="${q.x.toFixed(1)}" cy="${q.y}" rx="${lw / 2}" ry="${lh / 2}" fill="${tint(col, 0.05 + (i % 3) * 0.12)}" stroke="#fff" stroke-width="2"/>`, label(q.t, q.x, q.y, lw - 20, m > 4 ? 11 : 13, '#fff')));
    parts.push(`<rect x="${cx - 120}" y="250" width="240" height="42" rx="10" fill="${col}"/>`, label(d.items[0] ?? '', cx, 271, 224, 13, '#fff'));
  } else if (d.k === 'compass') {
    // Busolă: roza vânturilor (un cerc cu o stea cu 4 colțuri) în mijloc, cu primul element; celelalte în căsuțe pe direcții (nord, est,
    // sud, vest, apoi nord-est, sud-est, sud-vest, nord-vest), legate de centru prin raze punctate (desenate primele).
    const cx = W / 2, cy = 160, r = 62, bw = 124, bh = 36, line = tint(col, 0.45);
    H = 320;
    const dirs: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0], [0.72, -0.7], [0.72, 0.7], [-0.72, 0.7], [-0.72, -0.7]];
    const at = (i: number) => { const [dx, dy] = dirs[i]; return { x: cx + dx * (W / 2 - 10 - bw / 2), y: cy + dy * (H / 2 - 10 - bh / 2) }; };
    d.items.slice(1).forEach((_, i) => { const p = at(i); parts.push(`<path d="M${cx} ${cy} L${p.x.toFixed(1)} ${p.y.toFixed(1)}" fill="none" stroke="${line}" stroke-width="3" stroke-dasharray="8 5" stroke-linecap="round"/>`); });
    const R = r + 26, k = 16, star = [[cx, cy - R], [cx + k, cy - k], [cx + R, cy], [cx + k, cy + k], [cx, cy + R], [cx - k, cy + k], [cx - R, cy], [cx - k, cy - k]];
    parts.push(`<polygon points="${star.map(([a, b]) => `${a},${b}`).join(' ')}" fill="${tint(col, 0.55)}"/>`, `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}" stroke="#fff" stroke-width="3"/>`, label(d.items[0] ?? '', cx, cy, r * 2 - 22, 14, '#fff'));
    d.items.slice(1).forEach((t, i) => { const p = at(i); parts.push(`<rect x="${(p.x - bw / 2).toFixed(1)}" y="${(p.y - bh / 2).toFixed(1)}" width="${bw}" height="${bh}" rx="8" fill="${tint(col, 0.2 + (i % 4) * 0.1)}"/>`, label(t, p.x, p.y, bw - 14, 13, '#fff')); });
  } else if (d.k === 'bulb') {
    // Bec cu idei: becul (sticla rotundă, gâtul cu două dungi și vârful) în mijloc, cu primul element în sticlă; celelalte în căsuțe
    // pe rând în dreapta și în stânga, una sub alta, legate de centrul becului prin raze drepte (desenate primele, sub bec).
    const m = n - 1, rows = Math.max(1, Math.ceil(m / 2)), bw = 150, bh = 40, gap = 12, r = 72, line = tint(col, 0.45);
    H = Math.max(230, 20 + rows * (bh + gap) - gap);
    const cx = W / 2, top = (H - 196) / 2, cy = top + r + 4;
    const at = (i: number) => { const right = i % 2 === 0, side = right ? Math.ceil(m / 2) : Math.floor(m / 2), y = (H - side * (bh + gap) + gap) / 2 + Math.floor(i / 2) * (bh + gap); return { x: right ? W - 10 - bw : 10, y, right }; };
    const boxes: string[] = [];
    d.items.slice(1).forEach((t, i) => {
      const p = at(i), ex = p.right ? p.x : p.x + bw;
      parts.push(`<path d="M${cx} ${cy.toFixed(1)} L${ex} ${(p.y + bh / 2).toFixed(1)}" fill="none" stroke="${line}" stroke-width="3" stroke-dasharray="8 5" stroke-linecap="round"/>`);
      boxes.push(`<rect x="${p.x}" y="${p.y.toFixed(1)}" width="${bw}" height="${bh}" rx="8" fill="${tint(col, 0.2 + (i % 4) * 0.1)}"/>`, label(t, p.x + bw / 2, p.y + bh / 2, bw - 16, 13, '#fff'));
    });
    const ny = cy + r - 12;
    parts.push(...boxes, `<rect x="${cx - 34}" y="${ny.toFixed(1)}" width="68" height="44" rx="6" fill="#6b7280"/>`,
      `<path d="M${cx - 34} ${(ny + 22).toFixed(1)} L${cx + 34} ${(ny + 22).toFixed(1)} M${cx - 34} ${(ny + 33).toFixed(1)} L${cx + 34} ${(ny + 33).toFixed(1)}" stroke="#d1d5db" stroke-width="2"/>`,
      `<rect x="${cx - 18}" y="${(ny + 42).toFixed(1)}" width="36" height="14" rx="7" fill="#4b5563"/>`,
      `<circle cx="${cx}" cy="${cy.toFixed(1)}" r="${r}" fill="${col}" stroke="${tint(col, 0.6)}" stroke-width="4"/>`, label(d.items[0] ?? '', cx, cy, r * 2 - 28, 14, '#fff'));
  } else if (d.k === 'puzzle') {
    // Piese de puzzle: câte o piesă pe idee, de la stânga la dreapta (pe două rânduri când sunt mai mult de 4); fiecare piesă are
    // un nod rotund pe latura din dreapta, care intră în scobitura din stânga piesei următoare de pe același rând.
    const rows = n > 4 ? 2 : 1, cols = Math.ceil(n / rows), pw = (W - 20) / cols, ph = 86, r = Math.min(14, pw * 0.12), gy = 16;
    H = 20 + rows * ph + (rows - 1) * gy;
    d.items.forEach((t, i) => {
      const row = Math.floor(i / cols), c = i % cols, x = 10 + c * pw, y = 10 + row * (ph + gy), my = y + ph / 2, last = c === cols - 1 || i === n - 1;
      const right = last ? `V${y + ph}` : `V${my - r} A${r} ${r} 0 0 1 ${(x + pw).toFixed(1)} ${my + r} V${y + ph}`;
      const left = c === 0 ? 'Z' : `V${my + r} A${r} ${r} 0 0 0 ${x.toFixed(1)} ${my - r} Z`;
      parts.push(`<path d="M${x.toFixed(1)} ${y} H${(x + pw).toFixed(1)} ${right} H${x.toFixed(1)} ${left}" fill="${tint(col, (i % 4) * 0.12)}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>`, label(t, x + pw / 2, my, pw - 2 * r - 14, n > 4 ? 11 : 13, '#fff'));
    });
  } else if (d.k === 'bridge') {
    // Pod: apa jos, malul din stânga (primul element, de unde pornim) și malul din dreapta (ultimul, unde ajungem), un pod în arc
    // între ele, sprijinit pe stâlpi; pașii dintre ele stau pe pod, în căsuțe una lângă alta.
    const bw = 120, xl = bw, xr = W - bw, m = Math.max(0, n - 2), rise = 50, sw = (xr - xl) / Math.max(1, m), two = m > 3, cw = Math.min(116, (two ? 2 : 1) * sw - 8), ch = 40;
    const yb = (two ? 2 * ch + 20 : m ? ch + 12 : 10) + rise + 14, yw = yb + 70;
    H = yb + 130;
    const yd = (x: number) => yb - rise * Math.sin((Math.PI * (x - xl)) / (xr - xl));
    parts.push(`<rect x="0" y="${yw}" width="${W}" height="${H - yw}" fill="${tint(col, 0.85)}"/>`);
    const deck = Array.from({ length: 41 }, (_, i) => { const x = xl + ((xr - xl) * i) / 40; return `${x.toFixed(1)} ${yd(x).toFixed(1)}`; });
    for (let i = 1; i < 8; i++) { const x = xl + ((xr - xl) * i) / 8; parts.push(`<path d="M${x.toFixed(1)} ${yd(x).toFixed(1)} L${x.toFixed(1)} ${yw + 6}" stroke="${tint(col, 0.45)}" stroke-width="4"/>`); }
    parts.push(`<path d="M${deck.join(' L')}" fill="none" stroke="${tint(col, 0.25)}" stroke-width="10" stroke-linecap="round"/>`);
    [[0, d.items[0] ?? ''], [xr, d.items[n - 1] ?? '']].forEach(([x, t], j) => {
      parts.push(`<rect x="${x}" y="${yb - 6}" width="${bw}" height="${H - yb + 6}" rx="8" fill="${tint(col, j ? 0 : 0.2)}"/>`, label(String(t), Number(x) + bw / 2, (yb + H) / 2, bw - 16, 13, '#fff'));
    });
    d.items.slice(1, n - 1).forEach((t, i) => {
      const x = xl + sw * (i + 0.5), by = two && i % 2 ? yb - rise - 2 * ch - 20 : yd(x) - ch - 12;
      parts.push(`<rect x="${(x - cw / 2).toFixed(1)}" y="${by.toFixed(1)}" width="${cw.toFixed(1)}" height="${ch}" rx="10" fill="${tint(col, 0.1 + (i % 3) * 0.1)}"/>`, label(t, x, by + ch / 2, cw - 12, m > 3 ? 11 : 13, '#fff'));
    });
  } else if (d.k === 'iceberg') {
    // Aisberg: apa de la linia de plutire în jos, vârful aisbergului (primul element) deasupra ei, iar partea mare de sub apă,
    // mai lată, cu celelalte elemente (ce nu se vede) în benzi una sub alta.
    const m = n - 1, rh = 30, gap = 8, yw = 120, cx = W / 2, p = (pts: number[][]) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L');
    H = Math.max(yw + 90, yw + 22 + Math.max(0, m * (rh + gap) - gap) + 26);
    const yh = H - yw;
    parts.push(`<rect x="0" y="${yw}" width="${W}" height="${yh}" fill="${tint(col, 0.9)}"/>`);
    parts.push(`<path d="M${p([[cx - 95, yw], [cx + 85, yw], [cx + 190, yw + 40], [cx + 215, yw + yh * 0.55], [cx + 150, H - 8], [cx - 170, H - 8], [cx - 220, yw + yh * 0.5], [cx - 180, yw + 30]])} Z" fill="${tint(col, 0.62)}"/>`);
    const wave = Array.from({ length: 57 }, (_, i) => [i * 10, yw + Math.sin(i * 0.9) * 2.5]);
    parts.push(`<path d="M${p(wave)}" fill="none" stroke="${tint(col, 0.3)}" stroke-width="2"/>`);
    parts.push(`<path d="M${p([[cx - 95, yw], [cx - 40, yw - 70], [cx - 5, yw - 100], [cx + 35, yw - 78], [cx + 85, yw]])} Z" fill="${col}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>`, label(d.items[0] ?? '', cx - 3, yw - 32, 110, 13, '#fff'));
    d.items.slice(1).forEach((t, i) => {
      const y = yw + 22 + i * (rh + gap);
      parts.push(`<rect x="${cx - 120}" y="${y}" width="240" height="${rh}" rx="${rh / 2}" fill="${tint(col, 0.05 + (i % 3) * 0.12)}"/>`, label(t, cx, y + rh / 2, 220, 13, '#fff'));
    });
  } else if (d.k === 'mindmap') {
    // Hartă mentală: subiectul (primul element) într-un oval în mijloc; ramurile pe rând în dreapta și în stânga, una sub alta
    // pe fiecare parte, legate de oval prin linii curbe (desenate primele, sub forme).
    const m = n - 1, rows = Math.max(1, Math.ceil(m / 2)), bw = 150, bh = 44, gap = 14, line = tint(col, 0.45);
    H = Math.max(200, 20 + rows * (bh + gap) - gap);
    const cx = W / 2, cy = H / 2, ew = 75, eh = 40;
    const at = (i: number) => { const right = i % 2 === 0, side = right ? Math.ceil(m / 2) : Math.floor(m / 2), r = Math.floor(i / 2), top = (H - side * (bh + gap) + gap) / 2; return { x: right ? W - 10 - bw : 10, y: top + r * (bh + gap), right }; };
    const boxes: string[] = [];
    d.items.slice(1).forEach((t, i) => {
      const p = at(i), sx = p.right ? cx + ew - 4 : cx - ew + 4, ex = p.right ? p.x : p.x + bw, ey = p.y + bh / 2, mx = (sx + ex) / 2;
      parts.push(`<path d="M${sx} ${cy} C${mx.toFixed(1)} ${cy} ${mx.toFixed(1)} ${ey.toFixed(1)} ${ex} ${ey.toFixed(1)}" fill="none" stroke="${line}" stroke-width="3" stroke-linecap="round"/>`);
      boxes.push(`<rect x="${p.x}" y="${p.y.toFixed(1)}" width="${bw}" height="${bh}" rx="${bh / 2}" fill="${tint(col, 0.2 + (i % 4) * 0.1)}"/>`, label(t, p.x + bw / 2, p.y + bh / 2, bw - 16, 13, '#fff'));
    });
    parts.push(...boxes, `<ellipse cx="${cx}" cy="${cy}" rx="${ew}" ry="${eh}" fill="${col}"/>`, label(d.items[0], cx, cy, ew * 2 - 24, 15, '#fff'));
  } else if (d.k === 'fishbone') {
    // Os de pește (cauze și efect): problema (primul element) în capul din dreapta, o șira spinării orizontală spre ea, cu o coadă în stânga,
    // iar cauzele pe rând sus și jos, fiecare într-o căsuță legată de șira spinării printr-un os oblic, aplecat spre cap.
    const m = n - 1, k = Math.max(1, Math.ceil(m / 2)), hw = 130, bh = 44, line = tint(col, 0.35);
    H = 230;
    const cy = H / 2, hx = W - 10 - hw, sx = 34, s = (hx - 14 - sx) / k, bw = s - 12;
    parts.push(`<path d="M10 ${cy - 22} L${sx} ${cy} L10 ${cy + 22} Z" fill="${line}"/>`, `<rect x="${sx - 4}" y="${cy - 3}" width="${hx - sx + 4}" height="6" fill="${line}"/>`);
    const boxes: string[] = [];
    d.items.slice(1).forEach((t, i) => {
      const c = Math.floor(i / 2), up = i % 2 === 0, x = sx + 6 + c * s, y = up ? 10 : H - 10 - bh, ax = x + bw / 2, ay = up ? y + bh : y;
      parts.push(`<path d="M${ax.toFixed(1)} ${ay} L${(ax + Math.min(40, s * 0.3)).toFixed(1)} ${cy}" stroke="${line}" stroke-width="3" stroke-linecap="round"/>`);
      boxes.push(`<rect x="${x.toFixed(1)}" y="${y}" width="${bw.toFixed(1)}" height="${bh}" rx="8" fill="${tint(col, 0.2 + (c % 3) * 0.1)}"/>`, label(t, ax, y + bh / 2, bw - 12, m > 4 ? 12 : 13, '#fff'));
    });
    parts.push(...boxes, `<rect x="${hx}" y="${cy - 40}" width="${hw}" height="80" rx="14" fill="${col}"/>`, label(d.items[0], hx + hw / 2, cy, hw - 16, 14, '#fff'));
  } else if (d.k === 'pluslist') {
    // Listă cu plusuri: pe fiecare rând un semn plus (o cruce cu brațe egale) cu numărul în mijloc, apoi o bandă rotunjită cu textul (avantajele, beneficiile).
    const rh = 50, gap = 8;
    H = 20 + n * (rh + gap) - gap;
    d.items.forEach((t, i) => {
      const y = 10 + i * (rh + gap), x = 10, cx = x + rh / 2, cy = y + rh / 2, R = rh / 2 - 2, k = R * 0.42, c = tint(col, (i % 4) * 0.1);
      const pts = [[-k, -R], [k, -R], [k, -k], [R, -k], [R, k], [k, k], [k, R], [-k, R], [-k, k], [-R, k], [-R, -k], [-k, -k]].map(([u, v]) => `${(cx + u).toFixed(1)},${(cy + v).toFixed(1)}`);
      parts.push(`<rect x="${cx}" y="${y + 8}" width="${W - 10 - cx}" height="${rh - 16}" rx="${(rh - 16) / 2}" fill="${tint(col, 0.82)}"/>`, label(t, x + rh + 8 + (W - 18 - x - rh) / 2, cy, W - 40 - x - rh, 15, '#1f2937'));
      parts.push(`<path d="M${pts.join(' L')} Z" fill="${c}" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>`, label(String(i + 1), cx, cy + 1, k * 2.2, 13, '#fff'));
    });
  } else if (d.k === 'cubelist') {
    // Listă cu cuburi: pe fiecare rând un cub văzut puțin de sus și din dreapta (conturul din 6 colțuri, plin, cu muchiile dinăuntru albe) cu numărul pe fața din față, apoi o bandă rotunjită cu textul.
    const rh = 50, gap = 8;
    H = 20 + n * (rh + gap) - gap;
    d.items.forEach((t, i) => {
      const y = 10 + i * (rh + gap), x = 10, s = rh - 14, dp = 10, bx = x + 2, by = y + 2 + dp, cy = y + rh / 2, f = (v: number) => v.toFixed(1);
      const outline = [[bx, by], [bx + dp, by - dp], [bx + s + dp, by - dp], [bx + s + dp, by + s - dp], [bx + s, by + s], [bx, by + s]].map(([a, b]) => `${f(a)},${f(b)}`).join(' ');
      parts.push(`<rect x="${x + rh / 2}" y="${y + 8}" width="${W - 10 - x - rh / 2}" height="${rh - 16}" rx="${(rh - 16) / 2}" fill="${tint(col, 0.82)}"/>`, label(t, x + rh + 8 + (W - 18 - x - rh) / 2, cy, W - 40 - x - rh, 15, '#1f2937'));
      parts.push(`<polygon points="${outline}" fill="${tint(col, (i % 4) * 0.1)}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>`, `<path d="M${f(bx)},${f(by)} L${f(bx + s)},${f(by)} L${f(bx + s + dp)},${f(by - dp)} M${f(bx + s)},${f(by)} L${f(bx + s)},${f(by + s)}" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>`, label(String(i + 1), bx + s / 2, by + s / 2 + 1, s * 0.8, 16, '#fff'));
    });
  } else if (d.k === 'doclist') {
    // Listă cu documente: pe fiecare rând o foaie (semnul de document din scheme: dreptunghi cu marginea de jos ondulată) cu numărul pe ea, apoi o bandă rotunjită cu textul.
    const rh = 50, gap = 8;
    H = 20 + n * (rh + gap) - gap;
    d.items.forEach((t, i) => {
      const y = 10 + i * (rh + gap), x = 10, bw = rh - 6, bh = rh - 8, bx = x + 3, by = y + 2, cx = x + rh / 2, cy = y + rh / 2, f = (v: number) => v.toFixed(1);
      const yb = by + bh * 0.84, path = `M${f(bx)},${f(by)} L${f(bx + bw)},${f(by)} L${f(bx + bw)},${f(yb)} C${f(bx + bw * 0.75)},${f(yb - bh * 0.16)} ${f(bx + bw * 0.5)},${f(yb - bh * 0.16)} ${f(bx + bw * 0.5)},${f(yb)} C${f(bx + bw * 0.5)},${f(yb + bh * 0.16)} ${f(bx + bw * 0.25)},${f(yb + bh * 0.16)} ${f(bx)},${f(yb)} Z`;
      parts.push(`<rect x="${cx}" y="${y + 8}" width="${W - 10 - cx}" height="${rh - 16}" rx="${(rh - 16) / 2}" fill="${tint(col, 0.82)}"/>`, label(t, x + rh + 8 + (W - 18 - x - rh) / 2, cy, W - 40 - x - rh, 15, '#1f2937'));
      parts.push(`<path d="${path}" fill="${tint(col, (i % 4) * 0.1)}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>`, label(String(i + 1), cx, by + bh * 0.42, bw * 0.7, 16, '#fff'));
    });
  } else if (d.k === 'gearlist') {
    // Listă cu roți dințate: pe fiecare rând o roată cu 8 dinți (ca la Roți dințate, cu dinții rotiți pe rânduri alterne, ca și cum s-ar prinde una de alta) cu numărul pe ea, apoi o bandă rotunjită cu textul.
    const rh = 50, gap = 8, teeth = 8;
    H = 20 + n * (rh + gap) - gap;
    d.items.forEach((t, i) => {
      const y = 10 + i * (rh + gap), x = 10, cx = x + rh / 2, cy = y + rh / 2, R = rh / 2 - 1, r = R * 0.8, off = i % 2 ? Math.PI / teeth : 0, pts: string[] = [];
      for (let k = 0; k < teeth * 4; k++) { const a = off + (k * Math.PI * 2) / (teeth * 4) - Math.PI / 2, rr = k % 4 < 2 ? R : r; pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`); }
      parts.push(`<rect x="${cx}" y="${y + 8}" width="${W - 10 - cx}" height="${rh - 16}" rx="${(rh - 16) / 2}" fill="${tint(col, 0.82)}"/>`, label(t, x + rh + 8 + (W - 18 - x - rh) / 2, cy, W - 40 - x - rh, 15, '#1f2937'));
      parts.push(`<polygon points="${pts.join(' ')}" fill="${tint(col, (i % 4) * 0.1)}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>`, label(String(i + 1), cx, cy + 1, r * 1.1, 16, '#fff'));
    });
  } else if (d.k === 'seallist') {
    // Listă cu sigilii: pe fiecare rând un sigiliu zimțat (stea cu 12 colțuri scurte, ca o ștampilă sau o insignă) cu numărul pe el, apoi o bandă rotunjită cu textul.
    const rh = 50, gap = 8;
    H = 20 + n * (rh + gap) - gap;
    d.items.forEach((t, i) => {
      const y = 10 + i * (rh + gap), x = 10, cx = x + rh / 2, cy = y + rh / 2, ro = rh / 2 - 2, ri = ro * 0.84, f = (v: number) => v.toFixed(1);
      const pts: string[] = [];
      for (let k = 0; k < 24; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 12, r = k % 2 ? ri : ro; pts.push(`${k ? 'L' : 'M'}${f(cx + r * Math.cos(a))},${f(cy + r * Math.sin(a))}`); }
      parts.push(`<rect x="${cx}" y="${y + 8}" width="${W - 10 - cx}" height="${rh - 16}" rx="${(rh - 16) / 2}" fill="${tint(col, 0.82)}"/>`, label(t, x + rh + 8 + (W - 18 - x - rh) / 2, cy, W - 40 - x - rh, 15, '#1f2937'));
      parts.push(`<path d="${pts.join(' ')} Z" fill="${tint(col, (i % 4) * 0.1)}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>`, label(String(i + 1), cx, cy + 1, ri * 1.1, 16, '#fff'));
    });
  } else if (d.k === 'droplist') {
    // Listă cu picături: pe fiecare rând o picătură (cerc cu colțul din dreapta sus ascuțit, din trei arce) cu numărul în ea, apoi o bandă rotunjită cu textul.
    const rh = 50, gap = 8;
    H = 20 + n * (rh + gap) - gap;
    d.items.forEach((t, i) => {
      const y = 10 + i * (rh + gap), r = rh / 2 - 2, x = 10, cx = x + rh / 2, cy = y + rh / 2, f = (v: number) => v.toFixed(1);
      const path = `M${f(cx)},${f(cy - r)} L${f(cx + r)},${f(cy - r)} L${f(cx + r)},${f(cy)} A${f(r)},${f(r)} 0 0 1 ${f(cx)},${f(cy + r)} A${f(r)},${f(r)} 0 0 1 ${f(cx - r)},${f(cy)} A${f(r)},${f(r)} 0 0 1 ${f(cx)},${f(cy - r)} Z`;
      parts.push(`<rect x="${cx}" y="${y + 8}" width="${W - 10 - cx}" height="${rh - 16}" rx="${(rh - 16) / 2}" fill="${tint(col, 0.82)}"/>`, label(t, x + rh + 8 + (W - 18 - x - rh) / 2, cy, W - 40 - x - rh, 15, '#1f2937'));
      parts.push(`<path d="${path}" fill="${tint(col, (i % 4) * 0.1)}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>`, label(String(i + 1), cx, cy + 1, r, 16, '#fff'));
    });
  } else if (d.k === 'cloudlist') {
    // Listă cu nori: pe fiecare rând un nor (trei umflături sus, două jos, făcut din arce) cu numărul în el, apoi o bandă rotunjită cu textul.
    const rh = 50, gap = 8;
    H = 20 + n * (rh + gap) - gap;
    d.items.forEach((t, i) => {
      const y = 10 + i * (rh + gap), w = rh * 1.3, x = 10, cx = x + w / 2, cy = y + rh / 2, f = (v: number) => v.toFixed(1);
      // Colțurile norului (pe conturul unei elipse), apoi câte un arc umflat în afară între ele.
      const pts = [[x + w * 0.1, y + rh * 0.72], [x + w * 0.16, y + rh * 0.36], [x + w * 0.42, y + rh * 0.16], [x + w * 0.7, y + rh * 0.22], [x + w * 0.9, y + rh * 0.5], [x + w * 0.76, y + rh * 0.86], [x + w * 0.4, y + rh * 0.9]];
      let path = `M${f(pts[0][0])},${f(pts[0][1])}`;
      pts.forEach((p, k) => { const q = pts[(k + 1) % pts.length], r = Math.hypot(q[0] - p[0], q[1] - p[1]) * 0.56; path += ` A${f(r)},${f(r)} 0 0 1 ${f(q[0])},${f(q[1])}`; });
      path += ' Z';
      parts.push(`<rect x="${cx}" y="${y + 8}" width="${W - 10 - cx}" height="${rh - 16}" rx="${(rh - 16) / 2}" fill="${tint(col, 0.82)}"/>`, label(t, x + w + 8 + (W - 18 - x - w) / 2, cy, W - 40 - x - w, 15, '#1f2937'));
      parts.push(`<path d="${path}" fill="${tint(col, (i % 4) * 0.1)}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>`, label(String(i + 1), cx, cy + 1, w * 0.5, 16, '#fff'));
    });
  } else if (d.k === 'heartlist') {
    // Listă cu inimi: pe fiecare rând o inimă (două arce sus, vârful jos) cu numărul în ea, apoi o bandă rotunjită cu textul, care pornește de sub inimă.
    const rh = 54, gap = 6;
    H = 20 + n * (rh + gap) - gap;
    d.items.forEach((t, i) => {
      const y = 10 + i * (rh + gap), cx = 10 + rh / 2, cy = y + rh / 2, r = rh / 2, f = (v: number) => v.toFixed(1);
      const top = y + r * 0.52, bot = y + rh - 2;
      const path = `M${f(cx)},${f(bot)} C${f(cx - r * 0.35)},${f(bot - r * 0.4)} ${f(cx - r)},${f(cy + r * 0.05)} ${f(cx - r)},${f(top)} A${f(r * 0.5)},${f(r * 0.5)} 0 0 1 ${f(cx)},${f(top)} A${f(r * 0.5)},${f(r * 0.5)} 0 0 1 ${f(cx + r)},${f(top)} C${f(cx + r)},${f(cy + r * 0.05)} ${f(cx + r * 0.35)},${f(bot - r * 0.4)} ${f(cx)},${f(bot)} Z`;
      parts.push(`<rect x="${cx}" y="${y + 9}" width="${W - 10 - cx}" height="${rh - 18}" rx="${(rh - 18) / 2}" fill="${tint(col, 0.82)}"/>`, label(t, cx + r + 8 + (W - 18 - cx - r) / 2, cy, W - 40 - cx - r, 15, '#1f2937'));
      parts.push(`<path d="${path}" fill="${tint(col, (i % 4) * 0.1)}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>`, label(String(i + 1), cx, cy + 1, r, 16, '#fff'));
    });
  } else if (d.k === 'starlist') {
    // Listă cu stele: pe fiecare rând o stea cu 5 colțuri, cu numărul în ea, apoi o bandă rotunjită cu textul, care pornește de sub stea.
    const rh = 56, gap = 6;
    H = 20 + n * (rh + gap) - gap;
    d.items.forEach((t, i) => {
      const y = 10 + i * (rh + gap), cx = 10 + rh / 2, cy = y + rh / 2 + 2, ro = rh / 2, ri = ro * 0.5;
      const pts = Array.from({ length: 10 }, (_, k) => { const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? ri : ro; return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy - 2 + r * Math.sin(a)).toFixed(1)}`; });
      parts.push(`<rect x="${cx}" y="${y + 9}" width="${W - 10 - cx}" height="${rh - 18}" rx="${(rh - 18) / 2}" fill="${tint(col, 0.82)}"/>`, label(t, cx + ro + 8 + (W - 18 - cx - ro) / 2, y + rh / 2, W - 40 - cx - ro, 15, '#1f2937'));
      parts.push(`<polygon points="${pts.join(' ')}" fill="${tint(col, (i % 4) * 0.1)}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>`, label(String(i + 1), cx, cy, ri * 1.6, 14, '#fff'));
    });
  } else if (d.k === 'diamondlist') {
    // Listă cu romburi: pe fiecare rând un romb plin cu numărul, apoi o bandă dreptunghiulară cu textul, care pornește din vârful din dreapta al rombului.
    const rh = 52, gap = 6;
    H = 20 + n * (rh + gap) - gap;
    d.items.forEach((t, i) => {
      const y = 10 + i * (rh + gap), cx = 10 + rh / 2, cy = y + rh / 2, bx = cx + rh / 2;
      parts.push(`<rect x="${bx}" y="${y + 8}" width="${W - 10 - bx}" height="${rh - 16}" rx="4" fill="${tint(col, 0.82)}"/>`, label(t, bx + 12 + (W - 22 - bx) / 2, cy, W - 40 - bx, 15, '#1f2937'));
      parts.push(`<polygon points="${cx},${y} ${cx + rh / 2},${cy} ${cx},${y + rh} ${cx - rh / 2},${cy}" fill="${tint(col, (i % 4) * 0.1)}" stroke="#fff" stroke-width="2"/>`, label(String(i + 1), cx, cy, rh / 2, 17, '#fff'));
    });
  } else if (d.k === 'chevronlist') {
    // Listă cu etape: pe fiecare rând o săgeată plină cu numărul etapei, apoi o bară deschisă la culoare cu textul.
    const rh = 48, gap = 8, aw = 74, p = 18;
    H = 20 + n * (rh + gap) - gap;
    d.items.forEach((t, i) => {
      const y = 10 + i * (rh + gap), pts = [[10, y], [10 + aw - p, y], [10 + aw, y + rh / 2], [10 + aw - p, y + rh], [10, y + rh]];
      parts.push(`<polygon points="${pts.map(([a, b]) => `${a},${b}`).join(' ')}" fill="${tint(col, (i % 4) * 0.1)}"/>`, label(String(i + 1), 10 + (aw - p) / 2 + 2, y + rh / 2, aw - p, 18, '#fff'));
      parts.push(`<rect x="${16 + aw}" y="${y}" width="${W - 26 - aw}" height="${rh}" rx="8" fill="${tint(col, 0.82)}"/>`, label(t, 16 + aw + (W - 26 - aw) / 2, y + rh / 2, W - 56 - aw, 15, '#1f2937'));
    });
  } else if (d.k === 'pyramidlist') {
    // Listă în piramidă: piramida în stânga (vârful sus, nivelurile tot mai deschise la culoare), iar pe rândul fiecărui nivel
    // o bară deschisă cu textul, ca la Listă cu etape.
    const bh = 52, gap = 6, pw = Math.min(260, 40 + n * 44), cx = 10 + pw / 2;
    H = 20 + n * bh;
    d.items.forEach((t, i) => {
      const y0 = 10 + i * bh, y1 = y0 + bh - gap, w0 = (pw * (i * bh)) / (n * bh), w1 = (pw * (y1 - 10)) / (n * bh);
      parts.push(`<polygon points="${(cx - w0 / 2).toFixed(1)},${y0} ${(cx + w0 / 2).toFixed(1)},${y0} ${(cx + w1 / 2).toFixed(1)},${y1} ${(cx - w1 / 2).toFixed(1)},${y1}" fill="${tint(col, (i % 4) * 0.1)}"/>`);
      parts.push(`<rect x="${pw + 26}" y="${y0}" width="${W - 36 - pw}" height="${bh - gap}" rx="8" fill="${tint(col, 0.82)}"/>`, label(t, pw + 26 + (W - 36 - pw) / 2, y0 + (bh - gap) / 2, W - 66 - pw, 15, '#1f2937'));
    });
  } else if (d.k === 'circleprocess') {
    // Proces cu cercuri: cercuri la fel de mari pe un rând, cu o săgeată mică între ele; textul în cerc.
    const gap = 30, dd = Math.min(150, (W - 20 - gap * (n - 1)) / n), tw = n * dd + (n - 1) * gap, bx = (W - tw) / 2, y = 10;
    H = Math.round(dd + 20);
    d.items.forEach((t, i) => {
      const x = bx + i * (dd + gap), r = dd / 2;
      parts.push(`<circle cx="${(x + r).toFixed(1)}" cy="${(y + r).toFixed(1)}" r="${r.toFixed(1)}" fill="${tint(col, (i % 4) * 0.1)}"/>`, label(t, x + r, y + r, dd * 0.72, n > 5 ? 11 : 13, '#fff'));
      if (i < n - 1) { const ax = x + dd + 7, ay = y + r; parts.push(`<path d="M${ax.toFixed(1)} ${(ay - 9).toFixed(1)} L${(ax + 16).toFixed(1)} ${ay.toFixed(1)} L${ax.toFixed(1)} ${(ay + 9).toFixed(1)} Z" fill="${tint(col, 0.4)}"/>`); }
    });
  } else if (d.k === 'equation') {
    // Ecuație: elementele adunate (+ între ele), apoi = și ultimul element, rezultatul. Până la 5 elemente pe un rând, în cercuri;
    // de la 6, cele adunate stau unul sub altul în stânga, iar = și rezultatul în dreapta.
    const sign = (x: number, y: number, s: number, eq: boolean) => {
      const t = s * 0.24, f = tint(col, 0.4);
      return eq
        ? `<rect x="${(x - s / 2).toFixed(1)}" y="${(y - t * 1.4).toFixed(1)}" width="${s}" height="${t.toFixed(1)}" fill="${f}"/><rect x="${(x - s / 2).toFixed(1)}" y="${(y + t * 0.4).toFixed(1)}" width="${s}" height="${t.toFixed(1)}" fill="${f}"/>`
        : `<rect x="${(x - s / 2).toFixed(1)}" y="${(y - t / 2).toFixed(1)}" width="${s}" height="${t.toFixed(1)}" fill="${f}"/><rect x="${(x - t / 2).toFixed(1)}" y="${(y - s / 2).toFixed(1)}" width="${t.toFixed(1)}" height="${s}" fill="${f}"/>`;
    };
    if (n <= 5) {
      const s = 26, g = 8, dd = Math.min(120, (W - 20 - (n - 1) * (s + 2 * g)) / n), x0 = (W - n * dd - (n - 1) * (s + 2 * g)) / 2, cy = 20 + dd / 2;
      H = Math.round(dd + 40);
      d.items.forEach((t, i) => {
        const cx = x0 + i * (dd + s + 2 * g) + dd / 2;
        parts.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(dd / 2).toFixed(1)}" fill="${i === n - 1 ? col : tint(col, 0.15 + (i % 3) * 0.1)}"/>`, label(t, cx, cy, dd * 0.9, dd < 90 ? 11 : dd < 110 ? 12 : 14, '#fff'));
        if (i < n - 1) parts.push(sign(cx + dd / 2 + g + s / 2, cy, s, i === n - 2));
      });
    } else {
      const rh = 34, gp = 22, bw = 300, T = (n - 1) * rh + (n - 2) * gp, R = 80;
      H = T + 20;
      d.items.slice(0, n - 1).forEach((t, i) => {
        const y = 10 + i * (rh + gp);
        parts.push(`<rect x="10" y="${y}" width="${bw}" height="${rh}" rx="8" fill="${tint(col, 0.15 + (i % 3) * 0.1)}"/>`, label(t, 10 + bw / 2, y + rh / 2, bw - 20, 13, '#fff'));
        if (i < n - 2) parts.push(sign(10 + bw / 2, y + rh + gp / 2, 16, false));
      });
      parts.push(sign(10 + bw + 40, H / 2, 30, true));
      const cx = W - 10 - R;
      parts.push(`<circle cx="${cx}" cy="${(H / 2).toFixed(1)}" r="${R}" fill="${col}"/>`, label(d.items[n - 1], cx, H / 2, R * 1.6, 14, '#fff'));
    }
  } else if (d.k === 'hhierarchy') {
    // Ierarhie orizontală: primul element în stânga, ceilalți unul sub altul în dreapta, legați printr-o „acoladă” de linii.
    const kids = d.items.slice(1), m = kids.length, kh = m > 5 ? 40 : 48, g = 12, rw = 180, rh = 72, kw = 250, line = tint(col, 0.4);
    const T = Math.max(rh, m * kh + (m - 1) * g);
    H = T + 30;
    const ry = (H - rh) / 2, kx = W - 10 - kw, xm = (10 + rw + kx) / 2, ky = (H - (m * kh + (m - 1) * g)) / 2, mid = (i: number) => ky + i * (kh + g) + kh / 2;
    if (m) parts.push(`<path d="M${10 + rw} ${H / 2} H${xm}${m > 1 ? ` M${xm} ${mid(0).toFixed(1)} V${mid(m - 1).toFixed(1)}` : ''}${kids.map((_, i) => ` M${xm} ${mid(i).toFixed(1)} H${kx}`).join('')}" stroke="${line}" stroke-width="3" fill="none"/>`);
    parts.push(`<rect x="10" y="${ry}" width="${rw}" height="${rh}" rx="10" fill="${col}"/>`, label(d.items[0], 10 + rw / 2, H / 2, rw - 16, 16, '#fff'));
    kids.forEach((t, i) => {
      const y = ky + i * (kh + g);
      parts.push(`<rect x="${kx}" y="${y.toFixed(1)}" width="${kw}" height="${kh}" rx="10" fill="${tint(col, 0.25)}"/>`, label(t, kx + kw / 2, y + kh / 2, kw - 16, m > 5 ? 13 : 14, '#fff'));
    });
  } else if (d.lv?.some((l) => l > 1)) {
    // Ierarhie pe mai multe niveluri: fiecare element stă sub cel mai apropiat de deasupra lui cu un nivel mai sus; elementele fără
    // nimic sub ele împart lățimea, iar unul cu altele sub el stă la mijlocul lor.
    const lv = fixLevels(d.lv.slice(0, n));
    const par = lv.map((l, i) => { if (!i) return -1; for (let j = i - 1; j >= 0; j--) if (lv[j] === l - 1) return j; return 0; });
    const kidsOf = lv.map((_, i) => lv.map((_, j) => j).filter((j) => par[j] === i));
    const leaves = lv.map((_, i) => i).filter((i) => !kidsOf[i].length);
    const slot = (W - 20) / leaves.length, cx: number[] = [];
    leaves.forEach((i, k) => { cx[i] = 10 + (k + 0.5) * slot; });
    for (let i = n - 1; i >= 0; i--) if (kidsOf[i].length) cx[i] = (cx[kidsOf[i][0]] + cx[kidsOf[i][kidsOf[i].length - 1]]) / 2;
    const rows = Math.max(...lv) + 1, bh = 56, gap = 40, bw = Math.min(170, slot - 10), rw = Math.min(240, W - 40);
    H = 20 + rows * bh + (rows - 1) * gap;
    const rowY = (r: number) => 10 + r * (bh + gap), line = tint(col, 0.4);
    lv.forEach((l, i) => {
      const ks = kidsOf[i];
      if (!ks.length) return;
      const mid = rowY(l) + bh + gap / 2;
      parts.push(`<path d="M${cx[i].toFixed(1)} ${rowY(l) + bh} V${mid} M${cx[ks[0]].toFixed(1)} ${mid} H${cx[ks[ks.length - 1]].toFixed(1)}${ks.map((j) => ` M${cx[j].toFixed(1)} ${mid} V${rowY(l + 1)}`).join('')}" stroke="${line}" stroke-width="3" fill="none"/>`);
    });
    lv.forEach((l, i) => {
      const w = i ? bw : rw, x = Math.max(10, Math.min(W - 10 - w, cx[i] - w / 2)), y = rowY(l);
      parts.push(`<rect x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${bh}" rx="10" fill="${i ? tint(col, 0.15 + 0.15 * (l - 1)) : col}"/>`, label(d.items[i], x + w / 2, y + bh / 2, w - 12, i ? (n > 5 ? 12 : 14) : 16, '#fff'));
    });
  } else {
    // Ierarhie: primul element sus, restul pe un rând dedesubt, legați cu linii.
    const kids = d.items.slice(1), m = Math.max(1, kids.length), bw = Math.min(180, (W - 20 - 12 * (m - 1)) / m), bh = 64;
    H = 30 + bh * 2 + 50;
    const rw = Math.min(260, W - 40), ry = 15, ky = ry + bh + 50;
    parts.push(`<rect x="${(W - rw) / 2}" y="${ry}" width="${rw}" height="${bh}" rx="10" fill="${col}"/>`, label(d.items[0], W / 2, ry + bh / 2, rw - 16, 16, '#fff'));
    const total = m * bw + (m - 1) * 12, x0 = (W - total) / 2;
    if (kids.length) parts.push(`<path d="M${W / 2} ${ry + bh} V${ry + bh + 25} M${(x0 + bw / 2).toFixed(1)} ${ry + bh + 25} H${(x0 + total - bw / 2).toFixed(1)}" stroke="${tint(col, 0.4)}" stroke-width="3" fill="none"/>`);
    kids.forEach((t, i) => {
      const x = x0 + i * (bw + 12);
      parts.push(`<path d="M${(x + bw / 2).toFixed(1)} ${ry + bh + 25} V${ky}" stroke="${tint(col, 0.4)}" stroke-width="3"/>`);
      parts.push(`<rect x="${x.toFixed(1)}" y="${ky}" width="${bw.toFixed(1)}" height="${bh}" rx="10" fill="${tint(col, 0.25)}"/>`, label(t, x + bw / 2, ky + bh / 2, bw - 12, n > 5 ? 12 : 14, '#fff'));
    });
  }
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join('')}</svg>`, h: H };
}

export async function diagramToPng(d: DocDiagram): Promise<string> {
  const { svg, h } = diagramSvg(d);
  const blob = await svgToPng(svg, DIAGRAM_W, h, 2);
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export const diagramAlt = (d: DocDiagram) =>
  `Diagramă (${(DOC_DIAGRAMS.find(([k]) => k === d.k)?.[1] ?? '').replace(/ [(].*[)]/, '').toLowerCase()}): ${d.items.join(', ')}`.slice(0, 300);

export async function insertDiagram(editor: Editor) {
  const d = newDiagram();
  editor.chain().focus().insertContent({ type: 'image', attrs: { src: await diagramToPng(d), alt: diagramAlt(d), width: DIAGRAM_W, align: 'center', diagram: JSON.stringify(d) } }).run();
}
