// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Deschiderea prezentărilor PowerPoint (.pptx): citim noi XML-ul din arhivă (JSZip, MIT) și facem din el o prezentare Suite.
// Ce aducem: titluri, subtitluri, liste, casete de text, forme simple cu text, poze, tabele, grafice (coloane, linie,
// plăcintă), notițele vorbitorului, tranzițiile și animațiile de intrare. Pozițiile se păstrează (slide-urile 4:3 se centrează pe pânza 16:9).
// Ce nu aducem încă: fundalurile cu poze, SmartArt, formele complicate (ele se numără și se spun la final).
import { TR_SOUNDS } from './trSound';
import { cellFmtFromSeen, type CellSeen } from './cellFmt';
import { isMetafileExt, metafileToSvg } from '../metafile';
import { bendOf, linkImported, routeOf, untransposed } from './connectors';
import { PALETTES, type ChartType } from '../sheets/chartSvg';
import { guidesFromXml } from './guides';
import { imageToDataUrl } from './image';
import { cleanDir, cleanMerges, detectBorder, nearestPad } from './tableMerge';
import { cleanLineC, cleanLineW, cleanTColor, pptxAccent, styleOfPptxId } from './tableStyle';
import { fxOfSpPr, rot3dOfSpPr, textFxOf, textGradOf } from './fx';
import { warpOf } from './warp';
import { adjOfBlip } from './adjust';
import { tableLook, OPEN_PATHS, type Anim, SLIDE_W as PATH_W, SLIDE_H as PATH_H, ANIMS, isMotionPath, isClosedPath, pathPointsLen, PATH_POINTS, drawnPath, cleanLang, cleanPfmt, type ParaFmt, cleanAnimFx, fxKey, MAX_FX, cleanTrDur, cleanTrim, cleanBmk, cleanGap, cleanRange, type BgDir, animDur, cleanShows, cleanLook, cleanColW, LineDash, atLevel, SIZE_MAX, SIZE_MIN, cleanAdvance, cleanFont, cleanInset, DIRECTED, fitFormat, deckSize, normRot, themeOf, THEMES, Deck, ElKind, emptyDeck, fontSize, ShapeKind, SHAPES, Slide, SlideEl, TABLE_MAX_COLS, TABLE_MAX_ROWS, ThemeId, Transition, uid } from './model';
import { custGeomPath } from './geom';
import { mediaEl, mediaLength } from './media';
import { cleanLink } from './links';
import { placeRawInk, readInkml } from './inkml';
import { cleanClip, cropOfSrcRect } from './crop';
import { cleanSection } from './sections';
import { authorsOf, readCommentsXml } from './pptxComments';
import { cleanComments } from './comments';
import { cleanMarks, type TextMark } from './marks';

type Zip = import('jszip');

export interface PptxImport {
  deck: Deck;
  /** Câte lucruri n-am putut aduce (forme complicate, poze EMF, SmartArt, video). */
  skipped: number;
  /** Arhiva era deteriorată (tăiată) și s-a reparat: s-a adus ce era întreg. */
  repaired?: boolean;
  /** Semnatarii, dacă fișierul e semnat digital (semnătura nu se păstrează la salvare). */
  signers?: import('../xmlSig').XmlSigCheck[];
}

const EMU_PER_PT = 12700;

/** Copiii direcți cu numele local dat (fără prefixul p:, a:). */
const kids = (n: Element | null | undefined, name: string) => (n ? [...n.children].filter((c) => c.localName === name) : []);
const kid = (n: Element | null | undefined, name: string) => kids(n, name)[0] ?? null;
/** Primul descendent cu numele local dat. */
const find = (n: Element | Document | null | undefined, name: string): Element | null => {
  if (!n) return null;
  const all = n.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) if (all[i].localName === name) return all[i];
  return null;
};
/** Linia întreruptă / punctată (a:prstDash din a:ln): cele lungi și scurte devin cele trei feluri ale noastre. */
const lineDashOf = (ln: Element | null): LineDash | undefined => {
  const dash = kid(ln, 'prstDash')?.getAttribute('val') ?? '';
  return /dot$/i.test(dash) && !/dash/i.test(dash) ? 'dot' : /dashdot/i.test(dash) ? 'dashDot' : /dash$/i.test(dash) ? 'dash' : undefined;
};
const findAll = (n: Element | null | undefined, name: string) => (n ? [...n.getElementsByTagName('*')].filter((e) => e.localName === name) : []);
const rAttr = (n: Element | null, name: string) => n?.getAttribute(`r:${name}`) ?? n?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', name) ?? null;

/** Un sunet din .pptx: unul de-al nostru (scris de Suite, după nume) sau fișierul ca data: URL (cel mult 5 MB). */
async function soundOf(zip: Zip, path: string, name: string): Promise<string | undefined> {
  const mine = path.toLowerCase().endsWith('.wav') && (path.includes('suite-trsound') || path.includes('suite-actsnd'));
  const own = mine ? TR_SOUNDS.find(([, nm]) => nm === name)?.[0] : undefined;
  if (own) return own;
  const file = zip.file(path);
  if (!file) return undefined;
  const b = new Uint8Array(await file.async('arraybuffer'));
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const mime = ext === 'mp3' ? 'audio/mpeg' : ext === 'm4a' || ext === 'mp4' ? 'audio/mp4' : ext === 'ogg' ? 'audio/ogg' : ext === 'wma' ? '' : 'audio/wav';
  if (!mime || b.length >= 5 * 1048576) return undefined;
  let bin = '';
  for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(bin)}`;
}

async function xmlOf(zip: Zip, path: string): Promise<Document | null> {
  const f = zip.file(path);
  if (!f) return null;
  return new DOMParser().parseFromString(await f.async('string'), 'application/xml');
}

/** Legăturile unui fișier din arhivă (rId → calea întreagă și tipul). */
async function relsOf(zip: Zip, path: string): Promise<Map<string, { target: string; type: string }>> {
  const dir = path.slice(0, path.lastIndexOf('/'));
  const doc = await xmlOf(zip, `${dir}/_rels/${path.slice(dir.length + 1)}.rels`);
  const map = new Map<string, { target: string; type: string }>();
  for (const r of doc ? findAll(doc.documentElement, 'Relationship') : []) {
    const t = r.getAttribute('Target') ?? '';
    if (r.getAttribute('TargetMode') === 'External') continue;
    map.set(r.getAttribute('Id') ?? '', { target: resolve(dir, t), type: r.getAttribute('Type') ?? '' });
  }
  return map;
}
/**
 * Previzualizarea unui obiect încorporat salvat în stilul vechi: p:oleObj are doar spid, iar poza stă în desenul VML al
 * slide-ului (v:shape cu același id → v:imagedata o:relid → legătura din desenul VML). VML-ul nu e mereu XML curat: îl citim cu regex.
 */
async function vmlPreview(zip: Zip, rels: Map<string, { target: string; type: string }>, spid: string | null): Promise<string | undefined> {
  const vml = spid ? [...rels.values()].find((r) => r.type.endsWith('/vmlDrawing'))?.target : undefined;
  const text = vml ? await zip.file(vml)?.async('string') : undefined;
  if (!vml || !text) return undefined;
  const at = text.search(new RegExp(`<v:shape\\b[^>]*\\bid="${spid!.replace(/\W/g, '')}"`));
  const end = at >= 0 ? text.indexOf('</v:shape>', at) : -1;
  const shape = at >= 0 ? text.slice(at, end > at ? end : undefined) : '';
  const rid = /<v:imagedata\b[^>]*\b(?:o:relid|r:id)="([^"]+)"/.exec(shape)?.[1];
  return rid ? (await relsOf(zip, vml)).get(rid)?.target : undefined;
}
/** Adresele externe ale unui fișier (rId → adresa), pentru legăturile de pe casete. */
async function urlsOf(zip: Zip, path: string): Promise<Map<string, string>> {
  const dir = path.slice(0, path.lastIndexOf('/'));
  const doc = await xmlOf(zip, `${dir}/_rels/${path.slice(dir.length + 1)}.rels`);
  const map = new Map<string, string>();
  for (const r of doc ? findAll(doc.documentElement, 'Relationship') : []) {
    if (r.getAttribute('TargetMode') === 'External') map.set(r.getAttribute('Id') ?? '', r.getAttribute('Target') ?? '');
  }
  return map;
}
const JUMP_ACTIONS: Record<string, string> = { nextslide: '#next', previousslide: '#prev', firstslide: '#first', lastslide: '#last' };
function resolve(dir: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1);
  const parts = dir.split('/');
  for (const p of target.split('/')) {
    if (p === '..') parts.pop();
    else if (p !== '.') parts.push(p);
  }
  return parts.join('/');
}
const relOfType = (rels: Map<string, { target: string; type: string }>, type: string) =>
  [...rels.values()].find((r) => r.type.endsWith('/' + type))?.target ?? null;

/** Transformarea din EMU (unitățile PowerPoint) în pixelii pânzei noastre; grupurile își adaugă propria transformare. */
type Tf = (x: number, y: number) => { x: number; y: number };
interface Box { x: number; y: number; w: number; h: number }

function xfrmOf(spPr: Element | null): { off: { x: number; y: number }; ext: { cx: number; cy: number } } | null {
  const xf = kid(spPr, 'xfrm');
  const off = kid(xf, 'off'), ext = kid(xf, 'ext');
  if (!off || !ext) return null;
  return { off: { x: +(off.getAttribute('x') ?? 0), y: +(off.getAttribute('y') ?? 0) }, ext: { cx: +(ext.getAttribute('cx') ?? 0), cy: +(ext.getAttribute('cy') ?? 0) } };
}

/** Rotirea și oglindirea din a:xfrm (rot în 60000-imi de grad). */
function turnOf(spPr: Element | null): Pick<SlideEl, 'rot' | 'flipH' | 'flipV'> {
  const xf = kid(spPr, 'xfrm');
  if (!xf) return {};
  const rot = normRot(Number(xf.getAttribute('rot') ?? 0) / 60000 || 0);
  const on = (a: string) => ['1', 'true'].includes(xf.getAttribute(a) ?? '');
  return { ...(rot ? { rot } : {}), ...(on('flipH') ? { flipH: true } : {}), ...(on('flipV') ? { flipV: true } : {}) };
}

const PH_SKIP = new Set(['dt', 'ftr', 'sldNum', 'hdr', 'sldImg']);
const IMG_MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp' };
/** Se poate aduce ca poză: formatele obișnuite, plus desenele .wmf / .emf (transformate în SVG de metafile.ts). */
const isPic = (ext: string) => !!IMG_MIME[ext] || isMetafileExt(ext) || ext === 'tif' || ext === 'tiff';
/** Octeții unei poze → Blob de desenat; un .wmf / .emf devine SVG, un .tif PNG (null dacă n-are nimic de desenat). */
export async function picBlob(buf: ArrayBuffer, ext: string): Promise<Blob | null> {
  if (IMG_MIME[ext]) return new Blob([buf], { type: IMG_MIME[ext] });
  if (ext === 'tif' || ext === 'tiff') {
    // TIFF (scanări, poze din programe de grafică): cititorul din Imagini, apoi PNG; prima pagină.
    try {
      const { decodeImage } = await import('../images/decode');
      const { bmp } = await decodeImage(new Uint8Array(buf));
      const c = document.createElement('canvas');
      c.width = bmp.width; c.height = bmp.height;
      c.getContext('2d')!.drawImage(bmp, 0, 0);
      bmp.close();
      const png = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/png'));
      c.width = 0;
      return png;
    } catch { return null; }
  }
  const svg = metafileToSvg(new Uint8Array(buf));
  return svg ? new Blob([svg], { type: 'image/svg+xml' }) : null;
}

export async function pptxToDeck(data: Uint8Array): Promise<PptxImport> {
  const { isRepaired, officeSigners, openOfficeZip } = await import('../officeFile');
  const zip: Zip = await openOfficeZip(data, 'pptx', 'Fișierul nu este o prezentare .pptx sau e stricat.');
  const pres = await xmlOf(zip, 'ppt/presentation.xml');
  if (!pres) throw new Error('Fișierul nu este o prezentare .pptx. Prezentările vechi .ppt trebuie întâi salvate ca .pptx.');
  const presRels = await relsOf(zip, 'ppt/presentation.xml');
  const sz = find(pres, 'sldSz');
  const cx = +(sz?.getAttribute('cx') ?? 12192000), cy = +(sz?.getAttribute('cy') ?? 6858000);
  // Slide-ul primește formatul nostru cel mai apropiat (16:9, 4:3, A4, pătrat, vertical); altfel se centrează pe pânza 16:9.
  const fit = fitFormat(cx / 9525, cy / 9525), S = deckSize(fit);
  const k = Math.min(S.w / cx, S.h / cy);
  const ox = (S.w - cx * k) / 2, oy = (S.h - cy * k) / 2;
  const base: Tf = (x, y) => ({ x: ox + x * k, y: oy + y * k });

  let skipped = 0;
  const slides: Slide[] = [];
  // Coordonatorul (slide master-ul primului slide): formele lui care nu sunt substituenți (sigle, benzi, poze) devin deck.master.
  let masterOf: string | null = null;
  let masterList: SlideEl[] = [];
  // Formele aspectelor (slide layout) care nu sunt substituenți, citite o dată pe aspect.
  const layoutShapes = new Map<string, SlideEl[]>();
  /** Câte slide-uri au numărul lor scris pe ele (substituentul sldNum): dacă cele mai multe îl au, prezentarea are „Numere”. */
  let numbered = 0;
  const footers = new Map<string, number>(), dates = new Map<string, number>();
  const slideIds = new Map<string, string>();
  const jumps: { el: SlideEl; path: string }[] = [];
  // Sunetele acțiunilor (<a:snd> din hlinkClick / hlinkMouseOver): fișierul și numele, citite după ce se termină slide-ul.
  const actSounds: { el: SlideEl; path: string; name: string }[] = [];
  let dark: boolean | null = null;
  const schemes = new Map<string, Map<string, string>>();
  // Autorii comentariilor (formatul clasic și cel nou), citiți o singură dată.
  const cmAuthors = authorsOf(await xmlOf(zip, 'ppt/commentAuthors.xml'), await xmlOf(zip, 'ppt/authors.xml'));

  for (const sid of findAll(find(pres, 'sldIdLst'), 'sldId')) {
    const path = presRels.get(rAttr(sid, 'id') ?? '')?.target;
    const doc = path ? await xmlOf(zip, path) : null;
    if (!path || !doc) continue;
    // `let`: la citirea formelor din slide master pozele se caută în relațiile lui.
    let rels = await relsOf(zip, path);
    let urls = await urlsOf(zip, path);
    const slideId = uid();
    slideIds.set(path, slideId);
    const layoutPath = relOfType(rels, 'slideLayout');
    const layout = layoutPath ? await xmlOf(zip, layoutPath) : null;
    const masterPath = layoutPath ? relOfType(await relsOf(zip, layoutPath), 'slideMaster') : null;
    const master = masterPath ? await xmlOf(zip, masterPath) : null;
    const themePath = masterPath ? relOfType(await relsOf(zip, masterPath), 'theme') : null;
    let scheme = themePath ? schemes.get(themePath) : undefined;
    if (themePath && !scheme) { scheme = readScheme(await xmlOf(zip, themePath)); schemes.set(themePath, scheme); }
    const colorOf = (fill: Element | null) => colorIn(fill, scheme ?? new Map());
    if (dark === null) dark = isDark(doc) ?? isDark(layout) ?? isDark(master);

    /** Locul unui substituent (titlu, corp) care nu-și scrie poziția: îl luăm din aspect, apoi din șablon. */
    const phPlace = (ph: Element) => {
      const type = ph.getAttribute('type') ?? 'body', idx = ph.getAttribute('idx');
      for (const d of [layout, master]) {
        for (const sp of d ? findAll(d.documentElement, 'sp') : []) {
          const p = find(sp, 'ph');
          if (!p) continue;
          const t = p.getAttribute('type') ?? 'body';
          const same = (idx && p.getAttribute('idx') === idx) || t === type || (type === 'ctrTitle' && t === 'title') || (type === 'subTitle' && t === 'body');
          const xf = same ? xfrmOf(kid(sp, 'spPr')) : null;
          if (xf) return xf;
        }
      }
      return null;
    };

    const els: SlideEl[] = [];
    let hasNum = false;
    let slideFtr = '', slideDt = '';
    const bySpid = new Map<string, SlideEl>();
    let grpDepth = 0;
    // Desenul unei diagrame SmartArt: r:dm din cadru → partea de date → dsp:dataModelExt relId → ppt/diagrams/drawingN.xml.
    const smartArtTree = async (n: Element): Promise<Element | null> => {
      const dm = rels.get(rAttr(find(n, 'relIds'), 'dm') ?? '')?.target;
      const data = dm ? await xmlOf(zip, dm) : null;
      const relId = find(data, 'dataModelExt')?.getAttribute('relId') ?? '';
      const path = rels.get(relId)?.target;
      const drawing = path ? await xmlOf(zip, path) : null;
      return find(drawing, 'spTree');
    };
    const walk = async (tree: Element, tf: Tf) => {
      for (const n of [...tree.children]) {
        if (n.localName === 'grpSp') {
          // Grupul: copiii au coordonatele lor (chOff/chExt), mutate și scalate în locul grupului.
          // Grupul de pe primul nivel se păstrează (grp); cele din interiorul lui se topesc în el.
          const from = els.length, top = grpDepth++ === 0;
          const xf = kid(kid(n, 'grpSpPr'), 'xfrm');
          const off = kid(xf, 'off'), ext = kid(xf, 'ext'), chOff = kid(xf, 'chOff'), chExt = kid(xf, 'chExt');
          if (off && ext && chOff && chExt) {
            const [gx, gy, gw, gh] = [off, off, ext, ext].map((e, i) => +(e.getAttribute(['x', 'y', 'cx', 'cy'][i]) ?? 0));
            const [cx0, cy0] = [+(chOff.getAttribute('x') ?? 0), +(chOff.getAttribute('y') ?? 0)];
            const sx = +(chExt.getAttribute('cx') ?? 0) ? gw / +(chExt.getAttribute('cx') ?? 1) : 1;
            const sy = +(chExt.getAttribute('cy') ?? 0) ? gh / +(chExt.getAttribute('cy') ?? 1) : 1;
            await walk(n, (x, y) => tf(gx + (x - cx0) * sx, gy + (y - cy0) * sy));
          } else await walk(n, tf);
          grpDepth--;
          if (top && els.length - from > 1) { const g = uid(); for (const e of els.slice(from)) e.grp = g; }
          continue;
        }
        // mc:AlternateContent: obiectele noi (cerneală, ecuații, forme din versiunile noi) au o variantă (Choice) și o
        // rezervă pentru programele care n-o știu (Fallback, de obicei o poză). Luăm varianta dacă e o formă / poză
        // pe care o citim; cerneala (contentPart) și ecuațiile (a14:m) vin din rezervă, ca să se vadă ca în original.
        if (n.localName === 'AlternateContent') {
          const choice = kids(n, 'Choice').find((c) => [...c.children].some((x) => READABLE.has(x.localName)) && !find(c, 'contentPart') && !find(c, 'm') && !find(c, 'oMath'));
          const fb = kid(n, 'Fallback');
          const from = els.length;
          if (choice) await walk(choice, tf);
          else if (fb) await walk(fb, tf);
          else skipped++;
          // Cerneala adusă ca poză: textul alternativ spune ce e.
          if (!choice && find(n, 'contentPart')) for (const e of els.slice(from)) if (e.kind === 'image' && !e.alt) e.alt = 'Desen de mână';
          // Liniile cernelii (ppt/ink/inkN.xml) devin desenul pozei: cu ✎ Desen se pot muta, șterge sau completa.
          const cpart = !choice ? find(n, 'contentPart') : null;
          const inkTarget = cpart ? rels.get(rAttr(cpart, 'id') ?? '')?.target : undefined;
          const inkPics = els.slice(from).filter((e) => e.kind === 'image');
          if (inkTarget && inkPics.length === 1) {
            const doc = await xmlOf(zip, inkTarget).catch(() => null);
            const raw = doc ? readInkml(doc) : null;
            const pic = inkPics[0];
            if (raw?.strokes.length) {
              const o = tf(0, 0), c = tf(360000, 0);
              const lines = placeRawInk(raw, pic, Math.abs(c.x - o.x));
              if (lines.length) pic.ink = { lines, x: pic.x, y: pic.y, w: pic.w, h: pic.h };
            }
          }
          // O casetă care are doar o ecuație (a14:m): poza din rezervă devine ecuația Suite, la locul ei, care se poate schimba.
          if (!choice && els.length - from === 1 && find(n, 'oMath')) {
            const eq = await choiceEquation(n, els[from]);
            if (eq) els[from] = eq;
          }
          continue;
        }
        // SmartArt: diagrama are și un desen gata făcut (ppt/diagrams/drawingN.xml, forme obișnuite cu alt spațiu de nume),
        // cu coordonatele față de colțul cadrului. Îl aducem ca forme grupate, ca să se vadă ca în original.
        if (n.localName === 'graphicFrame' && /\/diagram$/.test(find(n, 'graphicData')?.getAttribute('uri') ?? '')) {
          const tree = await smartArtTree(n);
          const off = kid(kid(n, 'xfrm'), 'off');
          if (tree && off) {
            const ox = +(off.getAttribute('x') ?? 0), oy = +(off.getAttribute('y') ?? 0);
            const from = els.length, top = grpDepth++ === 0;
            try { await walk(tree, (x, y) => tf(ox + x, oy + y)); } finally { grpDepth--; }
            if (els.length > from) {
              if (top && els.length - from > 1) { const g = uid(); for (const e of els.slice(from)) e.grp = g; }
              const alt = find(n, 'cNvPr')?.getAttribute('descr');
              if (alt && !els[from].alt) els[from].alt = alt;
              continue;
            }
          }
        }
        try {
          const el = await readEl(n, tf);
          if (el === 'skip') skipped++;
          else if (el) {
            els.push(el);
            // Obiectul ascuns din Panoul de selecție (cNvPr hidden): rămâne în prezentare, dar nu se vede.
            if (/^(1|true)$/.test(find(n, 'cNvPr')?.getAttribute('hidden') ?? '')) el.hide = true;
            // Numărul obiectului în PowerPoint: animațiile îl folosesc ca să spună ce apare.
            const spid = find(n, 'cNvPr')?.getAttribute('id');
            if (spid) bySpid.set(spid, el);
            // Legătura (Link / Action): pe casetă (cNvPr) sau pe primul text cu legătură din ea.
            const over = find(n, 'hlinkClick') ? null : find(n, 'hlinkMouseOver');
            const hl = find(n, 'hlinkClick') ?? over;
            if (hl) {
              // Acțiunea la trecerea mouse-ului (Mouse Over) și sunetul ei (Play sound).
              if (over) el.linkHover = true;
              const snd = find(hl, 'snd');
              const sp = snd ? rels.get(rAttr(snd, 'embed') ?? '')?.target : undefined;
              if (snd && sp) actSounds.push({ el, path: sp, name: snd.getAttribute('name') ?? '' });
              const action = hl.getAttribute('action') ?? '';
              const jump = /jump=([a-z]+)/.exec(action)?.[1];
              const rid = rAttr(hl, 'id') ?? '';
              if (jump && JUMP_ACTIONS[jump]) el.link = JUMP_ACTIONS[jump];
              else if (action.includes('hlinksldjump')) { const t = rels.get(rid)?.target; if (t) jumps.push({ el, path: t }); }
              else if (!action) { const u = cleanLink(urls.get(rid)); if (u) el.link = u; }
            }
          }
        } catch { skipped++; }
      }
    };

    // Caseta cu text care are lățimea sau înălțimea 0 în fișier (programul original o mărește singur după text, spAutoFit):
    // altfel se pierdea cu tot cu text. Primește cel puțin 1 țol lățime și o jumătate de țol pe paragraf.
    const autoFitBox = (n: Element, xf: ReturnType<typeof xfrmOf>, tf: Tf): Box | null => {
      const tx = kid(n, 'txBody');
      if (!xf || xf.ext.cx < 0 || xf.ext.cy < 0 || !findAll(tx, 't').some((t) => (t.textContent ?? '').trim())) return null;
      const np = Math.max(1, kids(tx, 'p').length);
      return boxOf({ ...xf, ext: { cx: Math.max(xf.ext.cx, 914400), cy: Math.max(xf.ext.cy, 457200 * np) } }, tf);
    };
    const boxOf = (xf: ReturnType<typeof xfrmOf>, tf: Tf): Box | null => {
      if (!xf || xf.ext.cx <= 0 || xf.ext.cy <= 0) return null;
      const a = tf(xf.off.x, xf.off.y), b = tf(xf.off.x + xf.ext.cx, xf.off.y + xf.ext.cy);
      return { x: Math.round(a.x), y: Math.round(a.y), w: Math.max(4, Math.round(b.x - a.x)), h: Math.max(4, Math.round(b.y - a.y)) };
    };
    /** Câți pixeli de-ai noștri are un punct tipografic (după potrivirea slide-ului pe pânză). */
    const ptPx = EMU_PER_PT * k;

    /** Linie sau conector (p:cxnSp, ori p:sp cu geometrie de linie): ca linie dreaptă între colțurile casetei, cu săgeți și culoare.
     *  Conectorii frânți / curbați își păstrează traseul (route). Caseta poate avea lățimea sau înălțimea 0. */
    // Capătul lipit de o formă: deocamdată cu numărul formei din fișier („#7”), legat la sfârșit (linkImported).
    const cxnRef = (k: 'stCxn' | 'endCxn', c: Element | null) => {
      const id = c?.getAttribute('id'), idx = Number(c?.getAttribute('idx'));
      return id && Number.isInteger(idx) ? { [k]: { id: '#' + id, idx } } : {};
    };
    const lineOf = (n: Element, tf: Tf): SlideEl | 'skip' => {
      const spPr = kid(n, 'spPr'), xf = xfrmOf(spPr);
      if (!xf || (xf.ext.cx <= 0 && xf.ext.cy <= 0)) return 'skip';
      const a = tf(xf.off.x, xf.off.y), b = tf(xf.off.x + xf.ext.cx, xf.off.y + xf.ext.cy);
      const ln = kid(spPr, 'ln'), lnRef = kid(kid(n, 'style'), 'lnRef');
      if (kid(ln, 'noFill')) return 'skip';
      const refIdx = Number(lnRef?.getAttribute('idx') ?? 0);
      const color = colorOf(kid(ln, 'solidFill')) ?? colorOf(kid(kid(kid(ln, 'gradFill'), 'gsLst'), 'gs')) ?? (lnRef ? colorOf(lnRef) : undefined) ?? '#000000';
      const wPt = ln?.getAttribute('w') ? +ln.getAttribute('w')! / EMU_PER_PT : [0.75, 0.75, 2, 3][Math.min(3, refIdx)];
      const arrow = (x: Element | null) => !!x && (x.getAttribute('type') ?? 'none') !== 'none';
      const head = arrow(kid(ln, 'headEnd')), tail = arrow(kid(ln, 'tailEnd'));
      const dash = lineDashOf(ln);
      const prst = kid(spPr, 'prstGeom')?.getAttribute('prst');
      return untransposed({
        id: uid(), kind: 'shape', shape: 'line', fill: 'accent', text: '',
        x: Math.round(a.x), y: Math.round(a.y), w: Math.max(0, Math.round(b.x - a.x)), h: Math.max(0, Math.round(b.y - a.y)),
        line: color, lineW: clamp(Math.round(wPt * ptPx * 10) / 10, 0.5, 20), ...(dash ? { lineDash: dash } : {}),
        ...(head && tail ? { ends: 'both' as const } : tail ? { ends: 'end' as const } : head ? { ends: 'start' as const } : {}),
        ...turnOf(spPr),
        // Linia inversă (lineInv) merge din stânga-jos în dreapta-sus: linia obișnuită, întoarsă pe verticală.
        ...(prst === 'lineInv' ? (turnOf(spPr).flipV ? { flipV: undefined } : { flipV: true }) : {}),
        ...(routeOf(prst) ? { route: routeOf(prst), ...bendOf(kid(spPr, 'prstGeom')) } : {}),
        ...cxnRef('stCxn', find(n, 'stCxn')), ...cxnRef('endCxn', find(n, 'endCxn')),
      }, /Connector2$/.test(prst ?? ''));
    };
    const LINE_GEOMS = new Set(['line', 'lineInv', 'straightConnector1', 'bentConnector2', 'bentConnector3', 'bentConnector4', 'bentConnector5', 'curvedConnector2', 'curvedConnector3', 'curvedConnector4', 'curvedConnector5']);

    const readEl = async (n: Element, tf: Tf): Promise<SlideEl | null | 'skip'> => {
      if (n.localName === 'cxnSp') return lineOf(n, tf);
      if (n.localName === 'sp' && !find(kid(n, 'nvSpPr'), 'ph') && LINE_GEOMS.has(kid(kid(n, 'spPr'), 'prstGeom')?.getAttribute('prst') ?? '')
        && !findAll(kid(n, 'txBody'), 't').some((t) => t.textContent?.trim())) return lineOf(n, tf);
      if (n.localName === 'sp') {
        const ph = find(kid(n, 'nvSpPr'), 'ph');
        const phType = ph ? ph.getAttribute('type') ?? 'body' : null;
        if (phType === 'sldNum') hasNum = true;
        // Subsolul și data (Antet și subsol): se adună pe prezentare, nu devin casete.
        if (phType === 'ftr' || phType === 'dt') {
          const t = findAll(n, 't').map((x) => x.textContent ?? '').join('').trim();
          if (phType === 'ftr' && t) slideFtr = t;
          if (phType === 'dt') {
            const auto = findAll(n, 'fld').some((f) => /^datetime/i.test(f.getAttribute('type') ?? ''));
            if (auto || t) slideDt = auto ? 'auto' : t;
          }
        }
        if (phType && PH_SKIP.has(phType)) return null;
        const spPr = kid(n, 'spPr');
        // Fără poziție nici în aspect, nici în șablon: locul obișnuit al titlului / listei pe slide.
        const box = boxOf(xfrmOf(spPr) ?? (ph ? phPlace(ph) : null), tf)
          ?? (phType === 'title' || phType === 'ctrTitle' ? { x: 70, y: 40, w: 1140, h: 110 }
            : phType === 'subTitle' ? { x: 100, y: 410, w: 1080, h: 90 } : phType ? { x: 70, y: 170, w: 1140, h: 500 } : null)
          ?? autoFitBox(n, xfrmOf(spPr), tf);
        if (!box) return null;
        const txBody = kid(n, 'txBody');
        const paras = kids(txBody, 'p');
        const lines = paras.map((p) => [...p.children].map((r) => (r.localName === 'br' ? '\n' : r.localName === 'r' || r.localName === 'fld' ? kid(r, 't')?.textContent ?? '' : '')).join(''));
        const text = lines.join('\n').replace(/\n+$/, '');
        const geom = kid(spPr, 'prstGeom')?.getAttribute('prst') ?? (kid(spPr, 'custGeom') ? 'custom' : 'rect');
        const styleFill = kid(kid(n, 'style'), 'fillRef');
        // Poza ca umplere a formei (a:blipFill în spPr): se aduce ca data: URL, ca pozele de pe slide.
        const fillBlip = phType ? null : kid(kid(spPr, 'blipFill'), 'blip');
        const fillTarget = fillBlip ? rels.get(rAttr(fillBlip, 'embed') ?? '')?.target : undefined;
        const fillExt = fillTarget?.split('.').pop()?.toLowerCase() ?? '';
        const fillFile = fillTarget && isPic(fillExt) ? zip.file(fillTarget) : null;
        let fillImg: string | undefined;
        if (fillFile) try { const fb = await picBlob(await fillFile.async('arraybuffer'), fillExt); if (fb) fillImg = (await imageToDataUrl(fb)).src; } catch { /* poză stricată: forma rămâne fără ea */ }
        const fill = colorOf(kid(spPr, 'solidFill')) ?? colorOf(kid(kid(kid(spPr, 'gradFill'), 'gsLst'), 'gs')) ?? (fillImg ? '#ffffff' : undefined)
          ?? (!kid(spPr, 'noFill') && !kid(spPr, 'gradFill') && !kid(spPr, 'blipFill') && !kid(spPr, 'pattFill') && styleFill && styleFill.getAttribute('idx') !== '0'
            ? colorOf(styleFill) : undefined);
        const bullets = paras.some((p) => kid(kid(p, 'pPr'), 'buChar') || kid(kid(p, 'pPr'), 'buAutoNum'));
        let kind: ElKind;
        if (phType === 'title' || phType === 'ctrTitle') kind = 'title';
        else if (phType === 'subTitle') kind = 'subtitle';
        else if (phType && phType !== 'pic') kind = text.includes('\n') || bullets || phType === 'body' || phType === 'obj' ? 'body' : 'text';
        else if ((fill || OPEN_PATHS[geom as ShapeKind]) && !phType) kind = 'shape';
        else kind = bullets ? 'body' : 'text';
        const freePath = kind === 'shape' && geom === 'custom' && xfrmOf(spPr)
          ? custGeomPath(kid(spPr, 'custGeom')!, xfrmOf(spPr)!.ext.cx, xfrmOf(spPr)!.ext.cy) : null;
        if (kind === 'shape' && !freePath && !['rect', 'roundRect', 'ellipse', 'snipRect', 'round2SameRect'].includes(geom) && !GEOM_ALIAS[geom] && !SHAPES.some(([k]) => k === geom)) {
          // Formă pe care n-o avem (săgeată, stea…): păstrăm măcar textul ei, dacă are.
          if (!text.trim()) return 'skip';
          kind = 'text';
        }
        if (!text.trim() && kind !== 'shape') return null;
        const el: SlideEl = { id: uid(), kind, ...box, text: kind === 'body' ? lines.map((l, i) => atLevel(l, Number(kid(paras[i], 'pPr')?.getAttribute('lvl') ?? 0))).filter((l) => l.trim()).join('\n') : text, ...turnOf(spPr) };
        if (kind === 'shape') {
          el.shape = (SHAPES.some(([k]) => k === geom) ? geom : GEOM_ALIAS[geom] ?? 'round') as ShapeKind;
          el.fill = fill ?? '#000000'; // paranteze / acolade / arc fără umplere: linia neagră, dacă n-are contur al ei
          // Umplerea în degrade: prima și ultima culoare, cu direcția (ca la fundalul slide-ului).
          const g = gradOf(kid(spPr, 'gradFill'), colorOf);
          if (g && !kid(spPr, 'solidFill')) { el.fill = g.bg; el.fill2 = g.bg2; if (g.bgDir) el.fillDir = g.bgDir; }
          if (fillImg) {
            el.fillImg = fillImg;
            const amt = find(fillBlip, 'alphaModFix')?.getAttribute('amt');
            if (amt && +amt < 99000) el.transp = clamp(Math.round(100 - +amt / 1000), 1, 100);
          }
          // Transparența umplerii: a:alpha (100000 = opacă) în culoarea plină.
          const alpha = find(kid(spPr, 'solidFill'), 'alpha')?.getAttribute('val');
          if (alpha && +alpha < 99000) el.transp = clamp(Math.round(100 - +alpha / 1000), 1, 100);
          // Efectul (a:effectLst: umbră exterioară sau strălucire).
          const fx = fxOfSpPr(spPr);
          if (fx) el.fx = fx;
          const r3 = rot3dOfSpPr(spPr);
          if (r3) el.rot3d = r3;
          if (freePath) { el.shape = 'rect'; el.path = freePath; }
          // Conturul: linia scrisă în formă sau cea din stilul formei (lnRef), cu grosimea ei.
          const ln = kid(spPr, 'ln'), lnRef = kid(kid(n, 'style'), 'lnRef');
          const refIdx = Number(lnRef?.getAttribute('idx') ?? 0);
          const lineColor = kid(ln, 'noFill') ? undefined : colorOf(kid(ln, 'solidFill')) ?? (refIdx > 0 ? colorOf(lnRef) : undefined);
          if (lineColor) {
            const w = ln?.getAttribute('w') ? +ln.getAttribute('w')! / EMU_PER_PT : [0.75, 2, 3][Math.min(3, refIdx) - 1];
            el.line = lineColor;
            el.lineW = clamp(Math.round(w * ptPx * 10) / 10, 0.5, 20);
            // Linia întreruptă / punctată (a:prstDash): cele lungi și scurte devin cele trei feluri ale noastre.
            const dash = lineDashOf(ln);
            if (dash) el.lineDash = dash;
          }
        }
        // Formatarea: din primul rând de text care o spune (mărime, aldin, culoare) și alinierea primului paragraf.
        const rPr = findAll(txBody, 'rPr').find((r) => r.getAttribute('sz')) ?? find(txBody, 'rPr');
        // Mărimea casetei: cea a celor mai multe litere (un cuvânt mai mare la început nu mărește toată caseta).
        const bySz = new Map<string, number>();
        for (const r of findAll(txBody, 'r')) { const z = kid(r, 'rPr')?.getAttribute('sz'); if (z) bySz.set(z, (bySz.get(z) ?? 0) + (kid(r, 't')?.textContent?.length ?? 0)); }
        const szAttr = [...bySz].sort((x, y) => y[1] - x[1])[0]?.[0] ?? rPr?.getAttribute('sz');
        if (szAttr) el.size = clamp(+((+szAttr / 100) * ptPx / fontSize(kind, 'blank')).toFixed(2), SIZE_MIN, SIZE_MAX);
        const b = rPr?.getAttribute('b');
        if (b === '1' || b === 'true') el.bold = true;
        else if ((b === '0' || b === 'false') && kind === 'title') el.bold = false;
        if (['1', 'true'].includes(rPr?.getAttribute('i') ?? '')) el.italic = true;
        const u = rPr?.getAttribute('u');
        if (u && u !== 'none') el.underline = true;
        const st = rPr?.getAttribute('strike');
        if (st && st !== 'noStrike') el.strike = true;
        // Efectul textului (umbră / strălucire / contur al literelor în a:rPr).
        const tfx = textFxOf(rPr);
        if (tfx) el.tfx = tfx;
        // Literele umplute cu gradient (a:gradFill în a:rPr).
        const tgrad = textGradOf(rPr, colorOf);
        if (tgrad) el.tgrad = tgrad;
        // Limba de verificare (a:rPr lang / noProof): alta decât româna se ține pe casetă.
        const lang = ['1', 'true'].includes(rPr?.getAttribute('noProof') ?? '') ? 'none' : cleanLang(rPr?.getAttribute('lang'));
        if (lang) el.lang = lang;
        // Fontul scris în text (nu cel al temei, „+mj-lt” / „+mn-lt”).
        const typeface = cleanFont(findAll(txBody, 'latin').map((l) => l.getAttribute('typeface') ?? '').find((f) => f && !f.startsWith('+')));
        // Segoe UI e fontul temei în care se deschid prezentările (și cel scris de exportul nostru), deci nu se ține separat.
        if (typeface && !/^Segoe UI( Semibold)?$/.test(typeface)) el.font = typeface;
        const color = colorOf(kid(rPr, 'solidFill'));
        if (color) el.color = color;
        // Formatul pe bucăți: rândurile de text (a:r) care diferă de formatul casetei (un cuvânt aldin, roșu, cu alt font).
        const marks: TextMark[] = [];
        let pos = 0;
        const boxBold = el.bold ?? kind === 'title';
        for (const r of paras.flatMap((p) => [...p.children].filter((x) => x.localName === 'r' || x.localName === 'fld'))) {
          const t = kid(r, 't')?.textContent ?? '';
          if (!t) continue;
          const at = el.text.indexOf(t, pos);
          if (at < 0) continue;
          pos = at + t.length;
          const pr = kid(r, 'rPr');
          if (!pr) continue;
          const m: TextMark = { s: at, e: at + t.length };
          const flag = (v: string | null) => (v === '1' || v === 'true' ? true : v === '0' || v === 'false' ? false : undefined);
          const rb = flag(pr.getAttribute('b')), ri = flag(pr.getAttribute('i'));
          if (rb !== undefined && rb !== boxBold) m.b = rb;
          if (ri !== undefined && ri !== !!el.italic) m.i = ri;
          const ru = pr.getAttribute('u'), rs = pr.getAttribute('strike');
          if (ru && ru !== 'none' && !el.underline) m.u = true;
          if (rs && rs !== 'noStrike' && !el.strike) m.k = true;
          const rc = colorOf(kid(pr, 'solidFill'));
          if (rc && rc !== el.color) m.c = rc;
          const rf = cleanFont(kid(pr, 'latin')?.getAttribute('typeface') ?? '');
          if (rf && !rf.startsWith('+') && rf !== el.font && !(!el.font && /^Segoe UI( Semibold)?$/.test(rf))) m.f = rf;
          const rh = colorOf(kid(pr, 'highlight'));
          if (rh) m.h = rh;
          const bl = Number(pr.getAttribute('baseline') ?? 0);
          if (bl > 0) m.v = 'sup'; else if (bl < 0) m.v = 'sub';
          // Mărimea rândului față de cea a casetei (sz în sutimi de punct).
          const rsz = Number(pr.getAttribute('sz') ?? ''), bsz = Number(szAttr ?? '');
          if (rsz > 0 && bsz > 0 && Math.abs(rsz / bsz - 1) > 0.01) m.z = Math.round((rsz / bsz) * 100) / 100;
          if (Object.keys(m).length > 2) marks.push(m);
        }
        const clean = cleanMarks(marks, el.text.length);
        if (clean) el.marks = clean;
        // Spațierea rândurilor (a:lnSpc / a:spcPct, în miimi de procent: 150000 = 1,5).
        const spc = Number(kid(kid(kid(paras[0], 'pPr'), 'lnSpc'), 'spcPct')?.getAttribute('val') ?? '');
        if (spc > 0 && Math.abs(spc / 100000 - 1) > 0.01) el.spacing = clamp(Math.round(spc / 1000) / 100, 0.5, 5);
        // Spațierea înainte / după paragraf (a:spcBef / a:spcAft cu a:spcPts, în sutimi de punct), din primul paragraf.
        const gap = (tag: string) => cleanGap(Number(kid(kid(kid(paras[0], 'pPr'), tag), 'spcPts')?.getAttribute('val') ?? '') / 100);
        const spb = gap('spcBef'), spa = gap('spcAft');
        if (spb) el.spb = spb;
        // La liste, 8 pt după e spațierea obișnuită pe care o scriem noi (ca distanța dintre punctele noastre): nu se mai pune.
        if (spa && !(kind === 'body' && spa === 8)) el.spa = spa;
        // Felul listei: numerotarea primului punct (a:buAutoNum) sau fără puncte, dacă toate paragrafele au a:buNone.
        if (kind === 'body') {
          const full = paras.filter((p) => kids(p, 'r').some((r) => kid(r, 't')?.textContent?.trim()));
          const auto = kid(kid(full[0], 'pPr'), 'buAutoNum');
          const num = auto?.getAttribute('type') ?? '';
          if (num) el.list = /^alphaUc/.test(num) ? 'upper' : /^alpha/.test(num) ? 'alpha' : /^romanUc/.test(num) ? 'roman' : /^arabicParen/.test(num) ? 'paren' : 'number';
          const startAt = Math.round(Number(auto?.getAttribute('startAt') ?? 1));
          if (num && startAt > 1 && startAt <= 9999) el.listStart = startAt;
          else if (full.length && full.every((p) => kid(kid(p, 'pPr'), 'buNone'))) el.list = 'none';
        }
        // Unde stă textul pe înălțime (a:bodyPr anchor), dacă slide-ul o spune.
        const anchor = kid(txBody, 'bodyPr')?.getAttribute('anchor');
        if (anchor === 't') el.valign = 'top'; else if (anchor === 'ctr') el.valign = 'middle'; else if (anchor === 'b') el.valign = 'bottom';
        // Marginile interioare (a:bodyPr lIns / tIns / rIns / bIns, în EMU), doar dacă slide-ul le schimbă față de cele obișnuite (0,1 / 0,05 inci), ca să nu mute textul casetelor obișnuite.
        { const bp = kid(txBody, 'bodyPr'), ins = (n: string, d: number) => (+(bp?.getAttribute(n) ?? d) || 0) * k;
          if (bp && [['lIns', 91440], ['tIns', 45720], ['rIns', 91440], ['bIns', 45720]].some(([n, d]) => bp.hasAttribute(n as string) && +(bp.getAttribute(n as string) ?? d) !== d)) { const v = cleanInset([ins('tIns', 45720), ins('rIns', 91440), ins('bIns', 45720), ins('lIns', 91440)]); if (v && (el.kind === 'shape' || v.some((x) => x > 0))) el.inset = v; } }
        // Textul transformat (a:prstTxWarp: arc, cerc, val).
        const warp = warpOf(kid(txBody, 'bodyPr'));
        if (warp) el.warp = warp;
        const algn = kid(paras[0], 'pPr')?.getAttribute('algn');
        if (algn === 'ctr') el.align = 'center'; else if (algn === 'r') el.align = 'right'; else if (algn === 'just' || algn === 'dist') el.align = 'justify'; else if (algn === 'l' && kind !== 'body') el.align = 'left';
        // Alinierea și spațierea fiecărui paragraf, când diferă de ale casetei (luate de la primul). În liste, paragrafele goale nu sunt rânduri.
        {
          const pf: (ParaFmt | null)[] = [];
          paras.forEach((p, i) => {
            if (kind === 'body' && !lines[i].trim()) return;
            const pPr = kid(p, 'pPr'), al = pPr?.getAttribute('algn'), pc = Number(kid(kid(pPr, 'lnSpc'), 'spcPct')?.getAttribute('val') ?? '');
            const a = al === 'ctr' ? 'center' : al === 'r' ? 'right' : al === 'just' || al === 'dist' ? 'justify' : al === 'l' ? 'left' : undefined;
            const sp = pc > 0 ? clamp(Math.round(pc / 1000) / 100, 0.5, 5) : undefined;
            // Spațierea înainte / după paragraf, când e alta decât a casetei (la liste, 8 pt după = cea obișnuită).
            const gp = (tag: string) => cleanGap(Number(kid(kid(pPr, tag), 'spcPts')?.getAttribute('val') ?? '') / 100) ?? 0;
            const gb = gp('spcBef'), gaRaw = gp('spcAft'), ga = kind === 'body' && gaRaw === 8 ? 0 : gaRaw;
            const f: ParaFmt = { ...(a && a !== (el.align ?? 'left') ? { a } : {}), ...(sp && sp !== (el.spacing ?? 1) ? { sp } : {}), ...(gb !== (el.spb ?? 0) ? { b: gb } : {}), ...(ga !== (el.spa ?? 0) ? { af: ga } : {}) };
            for (const _ of lines[i].split('\n')) pf.push(Object.keys(f).length ? f : null);
          });
          const c = cleanPfmt(pf, el.text.split('\n').length);
          if (c) el.pfmt = c;
        }
        return el;
      }
      if (n.localName === 'pic') {
        // Poza pusă într-un substituent de imagine fără poziție proprie: locul substituentului din aspect / șablon.
        const picPh = find(kid(n, 'nvPicPr'), 'ph');
        const picXf = xfrmOf(kid(n, 'spPr'));
        // Poza de mărime 0 nu se vede nici în original: nu e o pierdere, o lăsăm deoparte fără s-o numărăm.
        if (picXf && (picXf.ext.cx <= 0 || picXf.ext.cy <= 0)) return null;
        const box = boxOf(picXf ?? (picPh ? phPlace(picPh) : null), tf);
        // Clip video / sunet: fișierul din arhivă (p14:media), altfel legătura din videoFile / audioFile; dacă lipsește, rămâne poza de copertă.
        const mediaTarget = rels.get(rAttr(find(n, 'media'), 'embed') ?? rAttr(find(n, 'videoFile') ?? find(n, 'audioFile'), 'link') ?? '')?.target;
        const mediaFile = mediaTarget ? zip.file(mediaTarget) : null;
        if (box && mediaFile && mediaTarget) {
          const data = new Uint8Array(await mediaFile.async('arraybuffer'));
          const m = await mediaEl(mediaTarget, data, { w: 1280, h: 720 });
          if (typeof m !== 'string') {
            // Coperta clipului (poza din blip), afară de butonul gri de redare pus implicit de unele programe (PNG 1920 × 1383).
            const ct = rels.get(rAttr(find(n, 'blip'), 'embed') ?? '')?.target;
            const cext = ct?.split('.').pop()?.toLowerCase() ?? '';
            const cf = ct && IMG_MIME[cext] && m.src?.startsWith('data:video/') ? zip.file(ct) : null;
            let poster: string | undefined;
            if (cf) {
              const b = new Uint8Array(await cf.async('arraybuffer'));
              const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
              const playBtn = cext === 'png' && b.length > 24 && dv.getUint32(16) === 1920 && dv.getUint32(20) === 1383;
              if (!playBtn && b.length < 4 * 1048576) { let bin = ''; for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000)); poster = `data:${b[0] === 0xff && b[1] === 0xd8 ? 'image/jpeg' : b[0] === 0x89 && b[1] === 0x50 ? 'image/png' : IMG_MIME[cext]};base64,${btoa(bin)}`; }
            }
            // Decuparea (p14:trim: st = tăiat de la început, end = tăiat de la coadă, în ms) și apariția / stingerea (p14:fade).
            const pm = find(n, 'media'), tr = find(pm, 'trim'), fd = find(pm, 'fade');
            const sec = (x: Element | null, a: string) => { const v = parseFloat(x?.getAttribute(a) ?? ''); return v > 0 ? v / 1000 : undefined; };
            const st = sec(tr, 'st'), cutEnd = sec(tr, 'end');
            const len = cutEnd ? await mediaLength(m.src ?? '', data) : undefined;
            const trim = cleanTrim(st, len && cutEnd ? len - cutEnd : undefined);
            const fi = sec(fd, 'inDuration'), fo = sec(fd, 'outDuration');
            const fades = { ...(fi ? { fadeIn: Math.min(10, Math.round(fi * 10) / 10) } : {}), ...(fo ? { fadeOut: Math.min(10, Math.round(fo * 10) / 10) } : {}) };
            const bmk = cleanBmk(findAll(pm, 'bmk').map((b) => parseFloat(b.getAttribute('time') ?? '') / 1000));
            return { ...m, ...box, text: find(n, 'cNvPr')?.getAttribute('name') ?? m.text, ...(poster ? { poster } : {}), ...trim, ...fades, ...bmk };
          }
        }
        // blipFill poate sta și în mc:AlternateContent (Choice = un PDF pus ca poză, Fallback = PNG-ul de rezervă):
        // luăm prima variantă pe care o putem citi.
        const fills = kid(n, 'blipFill') ? [kid(n, 'blipFill')!] : findAll(n, 'blipFill');
        const tgt = (bf: Element) => rels.get(rAttr(kid(bf, 'blip'), 'embed') ?? '')?.target;
        const bfill = fills.find((bf) => { const t = tgt(bf); return !!t && isPic(t.split('.').pop()!.toLowerCase()) && !!zip.file(t); }) ?? fills[0] ?? null;
        const target = bfill ? tgt(bfill) : undefined;
        const ext = target?.split('.').pop()?.toLowerCase() ?? '';
        const file = target ? zip.file(target) : null;
        // Poză fără fișier (blipFill gol), dar cu umplere plină: în original se vede dreptunghiul colorat, cu chenarul lui.
        const emptyFill = !target && box ? colorOf(kid(kid(n, 'spPr'), 'solidFill')) : undefined;
        if (emptyFill && box) {
          const ln = kid(kid(n, 'spPr'), 'ln'), lc = kid(ln, 'noFill') ? undefined : colorOf(kid(ln, 'solidFill'));
          const lw = ln?.getAttribute('w') ? +ln.getAttribute('w')! / EMU_PER_PT : 0.75;
          return { id: uid(), kind: 'shape', shape: 'rect', ...box, text: '', fill: emptyFill, ...(lc ? { line: lc, lineW: clamp(Math.round(lw * ptPx * 10) / 10, 0.5, 20) } : {}), ...turnOf(kid(n, 'spPr')) };
        }
        if (!box || !file || !isPic(ext)) return 'skip'; // video, PDF fără rezervă
        const blob = await picBlob(await file.async('arraybuffer'), ext);
        if (!blob) return 'skip'; // .wmf / .emf fără nimic de desenat (de exemplu doar EMF+)
        const { src } = await imageToDataUrl(blob);
        const crop = cropOfSrcRect(kid(bfill, 'srcRect'));
        // Textul alternativ (Alt Text): descr din cNvPr.
        const alt = find(n, 'cNvPr')?.getAttribute('descr')?.trim().slice(0, 500);
        // Decupată la formă: a:prstGeom din spPr-ul pozei (altceva decât dreptunghi).
        const clip = cleanClip(kid(kid(n, 'spPr'), 'prstGeom')?.getAttribute('prst'));
        const pic: SlideEl = { id: uid(), kind: 'image', ...box, text: '', src, ...(crop ? { crop } : {}), ...(clip ? { clip } : {}), ...(alt ? { alt } : {}), ...turnOf(kid(n, 'spPr')) };
        // Transparența pozei (a:alphaModFix în a:blip) și chenarul ei (a:ln cu culoare plină în spPr).
        const amt = find(kid(bfill, 'blip'), 'alphaModFix')?.getAttribute('amt');
        if (amt && +amt < 99000) pic.transp = clamp(Math.round(100 - +amt / 1000), 1, 100);
        // Luminozitatea / contrastul (a:lum) și alb-negru (a:grayscl).
        const adj = adjOfBlip(kid(bfill, 'blip'));
        if (adj) pic.adj = adj;
        const pfx = fxOfSpPr(kid(n, 'spPr'));
        if (pfx) pic.fx = pfx;
        const pr3 = rot3dOfSpPr(kid(n, 'spPr'));
        if (pr3) pic.rot3d = pr3;
        const ln = kid(kid(n, 'spPr'), 'ln'), lc = kid(ln, 'noFill') ? undefined : colorOf(kid(ln, 'solidFill'));
        if (ln && lc) {
          pic.line = lc;
          pic.lineW = clamp(Math.round((ln.getAttribute('w') ? +ln.getAttribute('w')! / EMU_PER_PT : 0.75) * ptPx * 10) / 10, 0.5, 20);
          const dash = lineDashOf(ln);
          if (dash) pic.lineDash = dash;
        }
        return pic;
      }
      if (n.localName === 'graphicFrame') {
        const xf = kid(n, 'xfrm');
        const off = kid(xf, 'off'), ext = kid(xf, 'ext');
        const box = off && ext ? boxOf({ off: { x: +(off.getAttribute('x') ?? 0), y: +(off.getAttribute('y') ?? 0) }, ext: { cx: +(ext.getAttribute('cx') ?? 0), cy: +(ext.getAttribute('cy') ?? 0) } }, tf) : null;
        if (!box) return 'skip';
        // Obiect încorporat (OLE: foaie de calcul, document, fișier atașat): îi arătăm previzualizarea (p:pic din p:oleObj,
        // de obicei un desen .wmf / .emf), ca poză, cu numele obiectului ca text alternativ.
        const oles = findAll(n, 'oleObj'), ole = oles.find((o) => find(o, 'blip')) ?? oles[0]; // în mc:Fallback, de obicei
        if (ole) {
          const target = rels.get(rAttr(find(ole, 'blip'), 'embed') ?? '')?.target ?? await vmlPreview(zip, rels, ole.getAttribute('spid'));
          const ext = target?.split('.').pop()?.toLowerCase() ?? '';
          const file = target && isPic(ext) ? zip.file(target) : null;
          const blob = file ? await picBlob(await file.async('arraybuffer'), ext) : null;
          if (!blob) return 'skip';
          const { src } = await imageToDataUrl(blob);
          const alt = (find(n, 'cNvPr')?.getAttribute('descr') || ole.getAttribute('name') || ole.getAttribute('progId') || '').trim().slice(0, 500);
          return { id: uid(), kind: 'image', ...box, text: '', src, ...(alt ? { alt } : {}) };
        }
        const tbl = find(n, 'tbl');
        if (tbl) {
          const rows = kids(tbl, 'tr').slice(0, TABLE_MAX_ROWS).map((tr) => kids(tr, 'tc').slice(0, TABLE_MAX_COLS)
            .map((tc) => kids(kid(tc, 'txBody'), 'p').map((p) => findAll(p, 't').map((t) => t.textContent ?? '').join('')).join('\n')));
          const cols = Math.max(1, ...rows.map((r) => r.length));
          if (!rows.length) return 'skip';
          // Opțiunile de stil (a:tblPr firstRow / bandRow / firstCol / lastRow); lipsa lor înseamnă „nu”.
          const pr = kid(tbl, 'tblPr'), on = (a: string) => /^(1|true)$/.test(pr?.getAttribute(a) ?? '');
          const tlook = cleanLook({ head: on('firstRow'), band: on('bandRow'), first: on('firstCol'), last: on('lastRow') });
          // Stilul din galerie (a:tableStyleId), dacă e unul pe care îl știm.
          const tstyle = styleOfPptxId(kid(pr, 'tableStyleId')?.textContent);
          // La „Accent 2…6”, culoarea acelui accent din tema fișierului (capul, benzile).
          const acc = pptxAccent(kid(pr, 'tableStyleId')?.textContent), tcolor = acc ? cleanTColor(scheme?.get(acc)) : undefined;
          // Alinierea verticală (a:tcPr anchor), dacă toate celulele o au la fel și nu e cea obișnuită (la mijloc).
          const anchors = new Set(findAll(tbl, 'tc').map((tc) => kid(tc, 'tcPr')?.getAttribute('anchor') ?? 't'));
          const anchor = anchors.size === 1 ? [...anchors][0] : '';
          const valign = anchor === 'b' ? 'bottom' as const : anchor === 't' ? 'top' as const : undefined;
          // Lățimile coloanelor (a:tblGrid / a:gridCol w), dacă diferă între ele.
          const colW = cleanColW(kids(kid(tbl, 'tblGrid'), 'gridCol').slice(0, cols).map((g) => +(g.getAttribute('w') ?? 0)), cols);
          // Celulele îmbinate: a:tc cu gridSpan / rowSpan e colțul îmbinării (celulele acoperite au hMerge / vMerge).
          const merge = cleanMerges(kids(tbl, 'tr').slice(0, TABLE_MAX_ROWS).flatMap((tr, r) => kids(tr, 'tc').slice(0, TABLE_MAX_COLS)
            .map((tc, c) => [r, c, +(tc.getAttribute('rowSpan') ?? 1) || 1, +(tc.getAttribute('gridSpan') ?? 1) || 1])), rows.length, cols);
          // Chenarele scrise în celule (a:lnT / lnR / lnB / lnL: cu culoare = linie, a:noFill = fără), dacă se potrivesc cu un fel cunoscut.
          const trs = kids(tbl, 'tr').slice(0, TABLE_MAX_ROWS);
          const tborder = detectBorder((r, c) => {
            const pr = kid(kids(trs[r], 'tc')[c], 'tcPr');
            return ['lnT', 'lnR', 'lnB', 'lnL'].map((n) => { const ln = kid(pr, n); return !ln ? null : !kid(ln, 'noFill') && (ln.getAttribute('w') ?? '1') !== '0'; });
          }, merge, rows.length, cols);
          // Marginile și direcția textului, după prima celulă (a:tcPr marT / marL în EMU, lipsă = 0,05 / 0,1 inci; vert).
          const pr0 = kid(kids(trs[0], 'tc')[0], 'tcPr'), emu = (a: string, d: number) => +(pr0?.getAttribute(a) ?? d) / 9525;
          const tpad = nearestPad(emu('marT', 45720), emu('marL', 91440));
          const tdir = cleanDir(pr0?.getAttribute('vert'));
          // Grosimea și culoarea liniilor, după prima latură cu linie (a:lnL / a:lnT w în EMU, a:srgbClr).
          // Culorile obișnuite ale textului din temele noastre nu se țin minte (sunt cele de la sine).
          const ln0 = findAll(tbl, 'tcPr').flatMap((p) => ['lnL', 'lnT', 'lnR', 'lnB'].map((n) => kid(p, n))).find((l) => l && !kid(l, 'noFill'));
          const tlineW = ln0 ? cleanLineW(+(ln0.getAttribute('w') ?? 0) / 9525) : undefined;
          const lc = cleanLineC('#' + (ln0 ? find(ln0, 'srgbClr')?.getAttribute('val') ?? '' : ''));
          const tlineC = lc && ![...THEMES.map((x) => x.fg.toLowerCase()), '#f9fafb'].includes(lc) ? lc : undefined;
          // Înălțimile rândurilor (a:tr h), dacă diferă între ele.
          const rowH = cleanColW(kids(tbl, 'tr').slice(0, TABLE_MAX_ROWS).map((tr) => +(tr.getAttribute('h') ?? 0)), rows.length);
          // Formatarea proprie a celulelor (fundalul din a:tcPr, primul a:rPr, alinierea din a:pPr), doar ce se abate de la
          // celulele cu același rol: multe programe (și exportul nostru) scriu culorile stilului pe fiecare celulă.
          const lk = tableLook({ tlook });
          const seen = trs.map((tr) => kids(tr, 'tc').slice(0, TABLE_MAX_COLS).map((tc): CellSeen | null => {
            if (/^(1|true)$/.test(tc.getAttribute('hMerge') ?? '') || /^(1|true)$/.test(tc.getAttribute('vMerge') ?? '')) return null;
            const tcPr = kid(tc, 'tcPr'), rPr = findAll(kid(tc, 'txBody'), 'rPr').find((x) => kid(x.parentElement, 't')) ?? null;
            const algn = find(kid(tc, 'txBody'), 'pPr')?.getAttribute('algn');
            const on = (a: string) => /^(1|true)$/.test(rPr?.getAttribute(a) ?? '');
            return { bg: kid(tcPr, 'solidFill') ? colorOf(kid(tcPr, 'solidFill'))?.toLowerCase() : undefined, fg: kid(rPr, 'solidFill') ? colorOf(kid(rPr, 'solidFill'))?.toLowerCase() : undefined,
              b: on('b'), i: on('i'), u: !!rPr?.getAttribute('u') && rPr.getAttribute('u') !== 'none', al: algn === 'ctr' ? 'center' : algn === 'r' ? 'right' : algn === 'l' ? 'left' : undefined };
          }));
          const cfmt = cellFmtFromSeen(seen, (r, c) => r === 0 && lk.head ? 'h' : lk.last && r === rows.length - 1 && r > 0 ? 'l' : lk.first && c === 0 ? 'f' : lk.band && (r - (lk.head ? 1 : 0)) % 2 === 1 ? 'b' : 'o');
          return { id: uid(), kind: 'table', ...box, text: '', cells: rows.map((r) => Array.from({ length: cols }, (_, c) => r[c] ?? '')), ...(tlook ? { tlook } : {}), ...(valign ? { valign } : {}), ...(colW ? { colW } : {}), ...(rowH ? { rowH } : {}), ...(merge ? { merge } : {}), ...(tborder ? { tborder } : {}), ...(tstyle ? { tstyle } : {}), ...(tcolor ? { tcolor } : {}), ...(tlineW ? { tlineW } : {}), ...(tlineC ? { tlineC } : {}), ...(tpad ? { tpad } : {}), ...(tdir ? { tdir } : {}), ...(cfmt ? { cfmt } : {}) };
        }
        const chartRef = find(n, 'chart');
        const chartPath = chartRef ? rels.get(rAttr(chartRef, 'id') ?? '')?.target : null;
        const chart = chartPath ? await readChart(zip, chartPath) : null;
        if (chart) return { id: uid(), kind: 'chart', ...box, ...chart };
        return 'skip'; // SmartArt, obiecte OLE
      }
      if (n.localName === 'contentPart') return 'skip'; // cerneală
      return null;
    };

    const tree = find(find(doc, 'cSld'), 'spTree');
    if (tree) await walk(tree, base);
    if (hasNum) numbered++;
    if (slideFtr) footers.set(slideFtr, (footers.get(slideFtr) ?? 0) + 1);
    if (slideDt) dates.set(slideDt, (dates.get(slideDt) ?? 0) + 1);
    // Conectorii: capetele lipite de forme (a:stCxn / a:endCxn) trec de la numărul formei la id-ul ei.
    linkImported(els, bySpid);
    readAnims(doc, bySpid, els);
    const mTree = master && masterPath && masterOf === null ? find(find(master, 'cSld'), 'spTree') : null;
    if (masterPath && master && masterOf === null) {
      masterOf = masterPath;
      if (mTree) {
        // Fără substituenți (titlu, corp, dată, număr): aceia sunt doar locuri pentru textul slide-urilor.
        const t2 = mTree.cloneNode(true) as Element;
        for (const c of [...t2.children]) if (find(c, 'ph')) t2.removeChild(c);
        const keep = { rels, urls, n0: els.length };
        rels = await relsOf(zip, masterPath); urls = await urlsOf(zip, masterPath);
        try { await walk(t2, base); } catch { skipped++; }
        masterList = els.splice(keep.n0).filter((e) => !e.hide && (e.text ?? '').trim() !== '‹#›').map((e) => { const { anim: _a, ...rest } = e; return rest; });
        rels = keep.rels; urls = keep.urls;
      }
    }
    // Formele aspectului (de exemplu banda de pe aspectul de titlu): avem un singur coordonator, așa că se pun pe slide,
    // în spatele casetelor lui. „Ascundere grafică de fundal” pe slide (showMasterSp="0") le ascunde și pe ele, ca în original.
    const slideHides = /^(0|false)$/.test(doc.documentElement.getAttribute('showMasterSp') ?? '');
    if (layout && layoutPath) {
      let tpl = layoutShapes.get(layoutPath);
      if (!tpl) {
        tpl = [];
        const lTree = find(find(layout, 'cSld'), 'spTree');
        const t2 = lTree ? lTree.cloneNode(true) as Element : null;
        for (const c of t2 ? [...t2.children] : []) if (find(c, 'ph')) t2!.removeChild(c);
        if (t2 && [...t2.children].some((c) => c.localName === 'sp' || c.localName === 'pic' || c.localName === 'grpSp' || c.localName === 'cxnSp')) {
          const keep = { rels, urls, n0: els.length };
          rels = await relsOf(zip, layoutPath); urls = await urlsOf(zip, layoutPath);
          try { await walk(t2, base); } catch { skipped++; }
          tpl = els.splice(keep.n0).filter((e) => !e.hide && (e.text ?? '').trim() !== '‹#›').map((e) => { const { anim: _a, ...rest } = e; return rest; });
          rels = keep.rels; urls = keep.urls;
        }
        layoutShapes.set(layoutPath, tpl);
      }
      if (tpl.length && !slideHides) els.unshift(...tpl.map((e) => ({ ...e, id: uid() })));
    }
    // Slide-ul (sau aspectul lui) care ascunde formele șablonului (showMasterSp="0"), ori are alt șablon.
    const noMaster = masterOf !== masterPath || [doc, layout].some((d) => /^(0|false)$/.test(d?.documentElement.getAttribute('showMasterSp') ?? ''));

    // Notițele vorbitorului: substituentul „body” din pagina de notițe.
    let notes = '';
    const notesPath = relOfType(rels, 'notesSlide');
    const nd = notesPath ? await xmlOf(zip, notesPath) : null;
    for (const sp of nd ? findAll(nd.documentElement, 'sp') : []) {
      if (find(sp, 'ph')?.getAttribute('type') !== 'body') continue;
      notes = kids(kid(sp, 'txBody'), 'p').map((p) => findAll(p, 't').map((t) => t.textContent ?? '').join('')).join('\n').trim();
    }

    // Fundalul: al slide-ului, altfel al aspectului, altfel al șablonului (doar culoare plină).
    const bg = [doc, layout, master].map((d) => colorOf(find(find(d, 'bg'), 'solidFill'))).find(Boolean);
    // Sau în degrade (a:gradFill): prima și ultima culoare, direcția după unghi (sau din centru, la a:path).
    // Sau poză (a:blipFill în p:bg al slide-ului): se aduce ca data: URL, ca pozele de pe slide.
    const bgBlip = find(find(find(doc, 'bg'), 'blipFill'), 'blip');
    const bgTarget = bgBlip ? rels.get(rAttr(bgBlip, 'embed') ?? '')?.target : undefined;
    const bgExt = bgTarget?.split('.').pop()?.toLowerCase() ?? '';
    const bgFile = bgTarget && isPic(bgExt) ? zip.file(bgTarget) : null;
    let bgImg: string | undefined;
    if (bgFile) try { const bb = await picBlob(await bgFile.async('arraybuffer'), bgExt); if (bb) bgImg = (await imageToDataUrl(bb)).src; } catch { /* poză stricată: rămâne culoarea */ }
    const grad = bg || bgImg ? undefined : [doc, layout, master].map((d) => gradOf(find(find(d, 'bg'), 'gradFill'), colorOf)).find(Boolean);
    // Slide ascuns în PowerPoint: <p:sld show="0">.
    const hidden = /^(0|false)$/.test(doc.documentElement.getAttribute('show') ?? '');
    // Avans automat (advTm, în milisecunde).
    const advance = cleanAdvance(Number(find(doc, 'transition')?.getAttribute('advTm') ?? '') / 1000);
    // Sunetul tranziției (<p:sndAc><p:stSnd><p:snd r:embed>): unul de-al nostru, după nume, sau fișierul ca data: URL (cel mult 5 MB).
    const sndEl = find(find(doc, 'transition'), 'snd');
    const sndPath = sndEl ? rels.get(rAttr(sndEl, 'embed') ?? '')?.target : undefined;
    const trSound = sndEl && sndPath ? await soundOf(zip, sndPath, sndEl.getAttribute('name') ?? '') : undefined;
    for (const x of actSounds.splice(0)) {
      const v = await soundOf(zip, x.path, x.name);
      if (v) x.el.linkSnd = v; else if (!x.el.link) delete x.el.linkHover;
    }
    // Comentariile slide-ului (clasice și noi).
    const cms = [];
    for (const r of rels.values()) if (r.type.endsWith('/comments')) cms.push(...readCommentsXml(await xmlOf(zip, r.target), cmAuthors));
    const comments = cleanComments(cms);
    slides.push({ id: slideId, layout: 'blank', els, notes, ...(noMaster ? { noMaster: true } : {}), ...(comments ? { comments } : {}), ...transitionOf(doc), ...(bg ? { bg } : {}), ...(grad ?? {}), ...(bgImg ? { bgImg } : {}), ...(hidden ? { hidden: true } : {}), ...(advance ? { advance } : {}), ...(trSound ? { trSound } : {}) });
  }

  // Fără forme în șablon, semnul „ascunde grafica de fundal” n-are rost.
  if (!masterList.length) for (const sl of slides) delete sl.noMaster;
  if (!slides.length) throw new Error('Prezentarea nu are slide-uri pe care să le pot citi.');
  // Salturile la un anumit slide: abia acum știm ce slide e la fiecare cale.
  for (const { el, path } of jumps) { const id = slideIds.get(path); if (id) el.link = '#s:' + id; }
  // Secțiunile (p14:sectionLst din presentation.xml): numele trece pe primul slide citit al fiecăreia.
  const pathOfSid = new Map<string, string>();
  for (const sid of findAll(find(pres, 'sldIdLst'), 'sldId')) { const p = presRels.get(rAttr(sid, 'id') ?? '')?.target; if (p) pathOfSid.set(sid.getAttribute('id') ?? '', p); }
  for (const sect of findAll(find(pres, 'sectionLst'), 'section')) {
    const name = cleanSection(sect.getAttribute('name')) ?? 'Secțiune';
    const first = findAll(sect, 'sldId').map((x) => slideIds.get(pathOfSid.get(x.getAttribute('id') ?? '') ?? '')).find(Boolean);
    const s = slides.find((x) => x.id === first);
    if (s && s.section === undefined) s.section = name;
  }
  // Prezentările personalizate (<p:custShowLst>): numele și slide-urile, prin relațiile din presentation.xml.
  const shows = cleanShows(findAll(find(pres, 'custShowLst'), 'custShow').map((cs) => ({
    name: cs.getAttribute('name') ?? '',
    slides: findAll(cs, 'sld').map((x) => slideIds.get(presRels.get(rAttr(x, 'id') ?? '')?.target ?? '')).filter(Boolean),
  })), slides);
  const theme: ThemeId = dark ? 'noapte' : 'simplu';
  // Fundalul fiecărui slide (culoare plină); cel egal cu fundalul temei alese nu se mai ține separat.
  const themeBg = themeOf(theme).bg.toLowerCase();
  for (const s of slides) if (s.bg && s.bg.toLowerCase() === themeBg) delete s.bg;
  const numbers = numbered > 0 && numbered * 2 >= slides.length;
  // Buclă continuă (Set Up Slide Show → Loop continuously until Esc).
  const showPr = find(await xmlOf(zip, 'ppt/presProps.xml'), 'showPr');
  const loop = ['1', 'true'].includes(showPr?.getAttribute('loop') ?? '');
  // Chioșc (Set Up Slide Show → Browsed at a kiosk): merge singură, în buclă.
  const kiosk = !!showPr && !!find(showPr, 'kiosk');
  // Fără secundele de avans automat (Set Up Slide Show → Use Timings oprit).
  const noTimings = !kiosk && ['0', 'false'].includes(showPr?.getAttribute('useTimings') ?? '');
  // Fără narațiuni (Set Up Slide Show → Play Narrations oprit); doar când e scris anume.
  const noNarr = ['0', 'false'].includes(showPr?.getAttribute('showNarration') ?? '');
  // Doar slide-urile de la … la … (Set Up Slide Show → Show slides From / To).
  const rg = showPr ? find(showPr, 'sldRg') : null;
  const range = rg ? cleanRange({ from: rg.getAttribute('st'), to: rg.getAttribute('end') }, slides.length) : null;
  // Subsolul și data: cele mai dese, dacă apar pe măcar jumătate din slide-urile care nu sunt de titlu.
  const common = (m: Map<string, number>) => {
    const [v, c] = [...m.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['', 0];
    return c > 0 && c * 2 >= Math.max(1, slides.length - 1) ? v : '';
  };
  const footer = common(footers).slice(0, 200), date = common(dates).slice(0, 60);
  // Fișier → Proprietăți…: titlul, subiectul, autorul și cuvintele cheie (docProps/core.xml) și clasificarea (docProps/custom.xml).
  const core = await xmlOf(zip, 'docProps/core.xml');
  const coreOf = (n: string) => find(core, n)?.textContent?.trim() ?? '';
  const { docProps, labelFromCustom } = await import('../docs/format');
  const props = docProps({ props: { title: coreOf('title'), subject: coreOf('subject'), author: /^(Cyber Office Studio|PptxGenJS)$/.test(coreOf('creator')) ? '' : coreOf('creator'), keywords: coreOf('keywords'), label: labelFromCustom(await zip.file('docProps/custom.xml')?.async('string')) } });
  // Ghidajele (p15:sldGuideLst din p:extLst), mutate pe pânza noastră ca și casetele.
  const guides = guidesFromXml(findAll(find(pres, 'sldGuideLst'), 'guide'), (emu, dir) => (dir === 'v' ? ox + emu * k : oy + emu * k), S);
  return {
    deck: { ...emptyDeck(), theme, ...fit, ...(numbers ? { numbers: true } : {}), ...(loop && !kiosk ? { loop: true } : {}), ...(kiosk ? { kiosk: true } : {}), ...(noTimings ? { noTimings: true } : {}), ...(noNarr ? { noNarr: true } : {}), ...(range ? { range } : {}), ...(footer ? { footer } : {}), ...(date ? { date } : {}), ...(shows ? { shows } : {}), ...(guides ? { guides } : {}), ...(masterList.length ? { master: { els: masterList } } : {}), ...(props ? { props } : {}), slides },
    skipped, repaired: isRepaired(zip), ...await officeSigners(zip).then((signers) => (signers ? { signers } : {}), () => ({})),
  };
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Culoarea unei umpleri simple (doar RGB scris direct; culorile temei PowerPoint nu le știm). */
function solid(fill: Element | null): string | undefined {
  const v = kid(fill, 'srgbClr')?.getAttribute('val');
  return v && /^[0-9a-f]{6}$/i.test(v) ? '#' + v.toLowerCase() : undefined;
}

/** Elementele din arborele slide-ului pe care le citim (vezi mc:AlternateContent în walk). */
const READABLE = new Set(['sp', 'pic', 'grpSp', 'graphicFrame', 'cxnSp']);

/**
 * Ecuația dintr-o casetă a14:m (varianta Choice a unui mc:AlternateContent), dacă în casetă e o singură ecuație și niciun alt
 * text: ecuația Suite desenată în locul pozei din rezervă (`old`), cu proporțiile păstrate, la mijloc, în culoarea textului.
 */
async function choiceEquation(ac: Element, old: SlideEl): Promise<SlideEl | null> {
  const sp = kids(ac, 'Choice').map((c) => find(c, 'sp')).find((s) => s && find(s, 'oMath'));
  if (!sp) return null;
  const all = [...sp.getElementsByTagName('*')];
  const maths = all.filter((e) => e.localName === 'oMath');
  const MATH = 'http://schemas.openxmlformats.org/officeDocument/2006/math';
  if (maths.length !== 1 || all.some((e) => e.localName === 't' && e.namespaceURI !== MATH && (e.textContent ?? '').trim())) return null;
  const { ommlToEquation } = await import('../omml');
  const src = ommlToEquation(maths[0]);
  if (!src) return null;
  const rgb = [...maths[0].getElementsByTagName('*')].find((e) => e.localName === 'srgbClr')?.getAttribute('val');
  const ink = rgb && /^[0-9a-f]{6}$/i.test(rgb) ? `#${rgb}` : '#000000';
  try {
    const { equationAlt, equationToPng } = await import('../docs/equation');
    const res = await equationToPng({ src }, 40, 2, ink);
    const k = Math.min(old.w / res.w, old.h / res.h);
    const w = Math.max(10, Math.round(res.w * k)), h = Math.max(10, Math.round(res.h * k));
    return { id: old.id, kind: 'image', text: '', src: res.src, eq: src, alt: equationAlt({ src }), x: Math.round(old.x + (old.w - w) / 2), y: Math.round(old.y + (old.h - h) / 2), w, h, ...(old.grp ? { grp: old.grp } : {}) };
  } catch { return null; } // fără desen (de exemplu în teste fără pânză): rămâne poza din rezervă
}

/**
 * Formele din .pptx pe care nu le avem, aduse la cea mai apropiată formă a noastră (aceeași casetă, culoare și text).
 * Fără ele, o formă necunoscută fără text dispărea de pe slide, iar una cu text rămânea doar text, fără fundal.
 */
const GEOM_ALIAS: Record<string, ShapeKind> = {
  // Scheme logice
  flowChartProcess: 'rect', flowChartAlternateProcess: 'round', flowChartConnector: 'ellipse',
  flowChartMagneticDisk: 'round', flowChartMagneticDrum: 'round', flowChartMagneticTape: 'ellipse', flowChartOnlineStorage: 'round', flowChartOfflineStorage: 'triangle',
  // Dreptunghiuri și cadre
  round1Rect: 'round', round2DiagRect: 'round', snipRoundRect: 'snip1Rect',
  plaque: 'round', bevel: 'rect', frame: 'rect', foldedCorner: 'rect',
  can: 'flowChartMagneticDisk', cube: 'rect',
  // Rotunde
  donut: 'ellipse', blockArc: 'moon', pie: 'ellipse', chord: 'ellipse',
  // Triunghiuri, stele, poligoane
  isosTriangle: 'triangle',
  gear6: 'star6', gear9: 'star8', pieWedge: 'rtTriangle',
  // Săgeți
  stripedRightArrow: 'rightArrow', bentArrow: 'rightArrow', uturnArrow: 'rightArrow',
  // Bule și explicații
  wedgeRoundRectCallout: 'round', wedgeEllipseCallout: 'ellipse',
  // Panglici, suluri, valuri, semne

  mathPlus: 'plus', mathMinus: 'rect', mathEqual: 'rect', mathDivide: 'rect',
  // Butoanele de acțiune (Înainte, Înapoi, Acasă, Ajutor, Film…) au toate forma lor (din 31.10).
};

/** Culorile temei (clrScheme): accent1…6, dk1/lt1, dk2/lt2, hlink…, ca „#rrggbb”. */
function readScheme(doc: Document | null): Map<string, string> {
  const out = new Map<string, string>();
  for (const c of [...(find(doc, 'clrScheme')?.children ?? [])]) {
    const v = kid(c, 'srgbClr')?.getAttribute('val') ?? kid(c, 'sysClr')?.getAttribute('lastClr');
    if (v && /^[0-9a-f]{6}$/i.test(v)) out.set(c.localName, '#' + v.toLowerCase());
  }
  return out;
}

/**
 * Culoarea dintr-un element care o conține (solidFill, gs, fillRef): RGB scris direct sau culoare a temei,
 * cu luminozitatea schimbată ca în PowerPoint (lumMod / lumOff, tint / shade).
 */
/** Fundalul în degrade al unui slide: culorile primei și ultimei opriri și direcția (unghiul a:lin, sau a:path = din centru). */
function gradOf(g: Element | null, colorOf: (e: Element | null) => string | undefined): { bg: string; bg2: string; bgDir?: BgDir } | undefined {
  const gs = g ? findAll(g, 'gs').sort((x, y) => Number(x.getAttribute('pos') ?? 0) - Number(y.getAttribute('pos') ?? 0)) : [];
  if (gs.length < 2) return undefined;
  const a = colorOf(gs[0]), b = colorOf(gs[gs.length - 1]);
  if (!a || !b) return undefined;
  if (find(g, 'path')) return { bg: a, bg2: b, bgDir: 'radial' };
  const ang = ((Number(find(g, 'lin')?.getAttribute('ang') ?? 5400000) / 60000) % 360 + 360) % 360;
  const dir: BgDir = ang < 22.5 || ang >= 337.5 ? 'right' : ang < 67.5 ? 'diag' : 'down';
  // Unghiurile „inverse” (de jos în sus, de la dreapta la stânga) se scriu ca direcția noastră cu culorile schimbate.
  if (ang >= 157.5 && ang < 202.5) return { bg: b, bg2: a, bgDir: 'right' };
  if (ang >= 202.5 && ang < 337.5) return { bg: b, bg2: a, ...(ang >= 247.5 && ang < 292.5 ? {} : { bgDir: 'diag' as BgDir }) };
  return { bg: a, bg2: b, ...(dir !== 'down' ? { bgDir: dir } : {}) };
}

function colorIn(fill: Element | null, scheme: Map<string, string>): string | undefined {
  const rgb = kid(fill, 'srgbClr');
  const sch = kid(fill, 'schemeClr');
  let hex: string | undefined;
  if (rgb) hex = solid(fill);
  else if (sch) {
    const alias: Record<string, string> = { tx1: 'dk1', bg1: 'lt1', tx2: 'dk2', bg2: 'lt2' };
    const name = sch.getAttribute('val') ?? '';
    hex = scheme.get(alias[name] ?? name);
  }
  const mod = rgb ?? sch;
  if (!hex || !mod) return hex;
  const val = (n: string) => { const v = kid(mod, n)?.getAttribute('val'); return v === undefined || v === null ? null : +v / 100000; };
  let [r, g, b] = [1, 3, 5].map((i) => parseInt(hex!.slice(i, i + 2), 16) / 255);
  const lumMod = val('lumMod'), lumOff = val('lumOff'), tint = val('tint'), shade = val('shade');
  if (lumMod !== null || lumOff !== null) {
    // În HSL: L = L * lumMod + lumOff.
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, sat = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h /= 6;
    }
    const L = Math.min(1, Math.max(0, l * (lumMod ?? 1) + (lumOff ?? 0)));
    const q = L < 0.5 ? L * (1 + sat) : L + sat - L * sat, p = 2 * L - q;
    const hue = (t: number) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    [r, g, b] = sat ? [hue(h + 1 / 3), hue(h), hue(h - 1 / 3)] : [L, L, L];
  }
  if (tint !== null) [r, g, b] = [r, g, b].map((x) => x * tint + (1 - tint));
  if (shade !== null) [r, g, b] = [r, g, b].map((x) => x * shade);
  return '#' + [r, g, b].map((x) => Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, '0')).join('');
}

/** Fundalul slide-ului e închis? (ca să alegem tema Noapte în loc de Simplu) */
function isDark(doc: Document | null): boolean | null {
  const c = solid(find(find(doc, 'bg'), 'solidFill'));
  if (!c) return null;
  const n = parseInt(c.slice(1), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 110;
}

/**
 * Animațiile de intrare din „secvența principală” a slide-ului: fiecare obiect care apare primește animația cea mai apropiată
 * de ale noastre (Apariție, Estompare, Zbor, Ștergere, Împărțire, Roată, Bare, Zoom; restul — ascensiune, rotire… — → Urcă).
 * La noi, casetele animate apar în ordinea din listă, așa că le rearanjăm între ele în ordinea din PowerPoint
 * (celelalte casete rămân pe locul lor, ca să nu se schimbe ce e deasupra și ce e dedesubt).
 */
// presetID din PowerPoint → animația noastră (Zoom de bază 23 și Zoom 53 → Zoom; Fly In 2 și Peek In 12 → Zboară).
const ANIM_OF: Record<string, SlideEl['anim']> = { '1': 'appear', '10': 'fade', '42': 'rise', '2': 'fly', '12': 'fly', '22': 'wipe', '16': 'split', '21': 'wheel', '14': 'bars', '23': 'zoom', '53': 'zoom' };
// Ieșirile: Dispare (1), Zboară afară (2) / Ieșire rapidă (12); restul → Se estompează.
const EXIT_OF: Record<string, SlideEl['anim']> = { '1': 'exit', '10': 'exitFade', '2': 'exitFly', '12': 'exitFly' };
// Accentele: Puls (26), Rotire (8), Crește/Micșorează (6), Balans (32); restul (culori, clipire…) → Puls.
const EMPH_OF: Record<string, SlideEl['anim']> = { '26': 'pulse', '8': 'spin', '6': 'grow', '32': 'teeter' };
/**
 * O cale de mișcare din fișier (animMotion path="M 0 0 L 0.25 0 … E", în fracții din slide) → Linie / Arc / Cerc și direcția.
 * Capătul aproape de început = Cerc; punctele departe de dreapta dintre capete = Arc; altfel Linie. Lungimea drumului nu se păstrează.
 */
/** Punctele unui drum animMotion (M / L / C / Z, și relative m / l / c; în fracții din slide), cu curbele C împărțite în 8 bucăți. */
export function motionPoints(d: string): [number, number][] {
  const tok = d.match(/[a-zA-Z]|-?[0-9]*[.]?[0-9]+(?:e-?[0-9]+)?/gi) ?? [];
  const pts: [number, number][] = [];
  let cmd = 'M', i = 0, cur: [number, number] = [0, 0];
  const isNum = (k: number) => k < tok.length && !/^[a-df-z]$/i.test(tok[k]) && tok[k].toLowerCase() !== 'e';
  const pair = (rel: boolean): [number, number] => { const p: [number, number] = [Number(tok[i]), Number(tok[i + 1])]; i += 2; return rel ? [cur[0] + p[0], cur[1] + p[1]] : p; };
  while (i < tok.length && pts.length < 2000) {
    if (!isNum(i)) {
      cmd = tok[i++];
      if ((cmd === 'Z' || cmd === 'z') && pts.length) { cur = pts[0]; pts.push(cur); }
      continue;
    }
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
    if (C === 'C' && isNum(i + 5)) {
      const p0 = cur, p1 = pair(rel), p2 = pair(rel), p3 = pair(rel);
      for (let k = 1; k <= 8; k++) {
        const t = k / 8, u = 1 - t;
        pts.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
      }
      cur = p3;
    } else if ((C === 'M' || C === 'L') && isNum(i + 1)) { cur = pair(rel); pts.push(cur); }
    else i++;
  }
  return pts;
}
/** Calea din fișier ca drum desenat de mână (punctele față de primul, în pixeli de slide); null dacă e prea scurtă. */
function freePath(d: string): [number, number][] | null {
  return drawnPath(motionPoints(d).map(([x, y]) => [x * PATH_W, y * PATH_H]));
}
export function pathKind(d: string, custom = false): Pick<SlideEl, 'anim' | 'animDir' | 'animLen' | 'animPts'> {
  const nums = (d.match(/-?[0-9]*[.]?[0-9]+(?:e-?[0-9]+)?/gi) ?? []).map(Number);
  const pts: [number, number][] = [];
  for (let k = 0; k + 1 < nums.length; k += 2) pts.push([nums[k], nums[k + 1]]);
  if (pts.length < 2) return { anim: 'pathLine' };
  // Căile scrise de noi (8 puncte după 0 0) se recunosc exact, cu felul și direcția lor.
  if (pts.length === PATH_POINTS + 1) {
    for (const [a] of ANIMS) {
      if (!isMotionPath(a || undefined)) continue;
      for (const dir of isClosedPath(a as Anim) ? [undefined] : [undefined, 't', 'l', 'r'] as const) for (const len of [undefined, 's', 'l'] as const) {
        const ref = pathPointsLen(a as Anim, dir, len);
        if (ref.every(([x, y], k) => Math.abs(x / PATH_W - pts[k + 1][0]) < 0.0011 && Math.abs(y / PATH_H - pts[k + 1][1]) < 0.0011)) return { anim: a as Anim, ...(dir ? { animDir: dir } : {}), ...(len ? { animLen: len } : {}) };
      }
    }
  }
  // O cale desenată în alt program (presetID 0) se păstrează așa cum e, ca drum desenat de mână.
  const free = custom ? freePath(d) : null;
  if (free) return { anim: 'pathFree', animPts: free };
  const [x0, y0] = pts[0], [x1, y1] = pts[pts.length - 1];
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
  const far = Math.max(...pts.map(([x, y]) => Math.hypot(x - x0, y - y0)));
  // Lungimea: față de un sfert din slide (drumul mediu), la jumătatea dintre trepte; la cerc, diametrul.
  const animLen = far < 0.177 ? 's' as const : far > 0.354 ? 'l' as const : undefined, L = animLen ? { animLen } : {};
  if (len < far * 0.2) return { anim: 'pathCircle', ...L };
  const off = Math.max(...pts.map(([x, y]) => Math.abs((x - x0) * dy - (y - y0) * dx) / len));
  const dir: SlideEl['animDir'] = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : dy < 0 ? 't' : undefined;
  return { anim: off > len * 0.15 ? 'pathArc' : 'pathLine', ...(dir ? { animDir: dir } : {}), ...L };
}
/** Efectul unei animații din .pptx (felul, direcția, pornirea, întârzierea, durata) pus pe casetă. */
function applyEffect(el: SlideEl, eff: Element, cls: string) {
  const preset = eff.getAttribute('presetID');
  el.anim = cls === 'exit' ? EXIT_OF[preset ?? ''] ?? 'exitFade' : cls === 'emph' ? EMPH_OF[preset ?? ''] ?? 'pulse' : ANIM_OF[preset ?? ''] ?? 'rise';
  if (cls === 'path') Object.assign(el, pathKind(find(eff, 'animMotion')?.getAttribute('path') ?? '', preset === '0'));
  // Direcția (presetSubtype: 1 sus, 2 dreapta, 4 jos, 8 stânga); diagonalele rămân de jos.
  const dir = ({ '1': 't', '2': 'r', '8': 'l' } as Record<string, SlideEl['animDir']>)[eff.getAttribute('presetSubtype') ?? ''];
  // Animația pe paragrafe: ținta e un paragraf (p:txEl / p:pRg), nu toată caseta.
  if (find(eff, 'pRg') && el.kind === 'body') el.animBy = 'p';
  if (dir && (el.anim === 'fly' || el.anim === 'wipe' || el.anim === 'exitFly')) el.animDir = dir;
  if (cls === 'path' && isClosedPath(el.anim)) delete el.animDir;
  // Pornire (nodeType), întârzierea efectului și durata lui (cel mai lung pas, fără „set”-ul de vizibilitate de 1 ms).
  const node = eff.getAttribute('nodeType');
  if (node === 'withEffect' || node === 'afterEffect') el.animStart = node === 'withEffect' ? 'with' : 'after';
  const delay = Number(find(kid(eff, 'stCondLst'), 'cond')?.getAttribute('delay') ?? 0) / 1000;
  if (delay > 0 && delay <= 60) el.animDelay = Math.round(delay * 100) / 100;
  const dur = Math.max(0, ...findAll(eff, 'cTn').map((c) => Number(c.getAttribute('dur'))).filter((d) => d > 1 && d < 20000)) / 1000;
  if (dur >= 0.1 && Math.abs(dur - animDur(el)) > 0.01 && el.anim !== 'appear' && el.anim !== 'exit' && el.anim !== 'pulse' && el.anim !== 'teeter') el.animDur = Math.round(dur * 100) / 100;
}

function readAnims(doc: Document, bySpid: Map<string, SlideEl>, els: SlideEl[]) {
  const timing = find(doc, 'timing');
  // Clipurile: „playFrom” care nu așteaptă un click = Pornește singur; repeatCount="indefinite" pe nodul clipului = Repetă.
  for (const eff of findAll(timing, 'cTn')) {
    if (eff.getAttribute('presetClass') !== 'mediacall' || eff.getAttribute('nodeType') === 'clickEffect') continue;
    if (!findAll(eff, 'cmd').some((c) => (c.getAttribute('cmd') ?? '').startsWith('playFrom'))) continue;
    const el = bySpid.get(find(eff, 'spTgt')?.getAttribute('spid') ?? '');
    if (el?.kind === 'media') el.autoplay = true;
  }
  for (const node of findAll(timing, 'cMediaNode')) {
    const el = bySpid.get(find(node, 'spTgt')?.getAttribute('spid') ?? '');
    if (el?.kind !== 'media') continue;
    if (kid(node, 'cTn')?.getAttribute('repeatCount') === 'indefinite') el.loop = true;
    // „Redă pe toate slide-urile” (numSld = câte slide-uri ține sunetul; 1 = doar al lui).
    if (Number(node.getAttribute('numSld') ?? '1') > 1 && el.src?.startsWith('data:audio/')) el.across = true;
    // Volumul (80% e cel obișnuit, deci „tare”), fără sunet, ascuns cât nu rulează, pe tot ecranul.
    const vol = Number(node.getAttribute('vol') ?? '80000');
    if (node.getAttribute('mute') === '1' || node.getAttribute('mute') === 'true') el.vol = 0;
    else if (Number.isFinite(vol) && vol < 60000) el.vol = Math.max(0, Math.round(vol / 1000) / 100);
    const sws = node.getAttribute('showWhenStopped');
    if (sws === '0' || sws === 'false') el.hideIdle = true;
    const full = (node.parentNode as Element | null)?.getAttribute?.('fullScrn');
    if (full === '1' || full === 'true') el.full = true;
  }
  // Secvențele interactive: animațiile pornite la click pe o casetă (declanșator); prima animație a fiecărei casete.
  for (const iseq of findAll(timing, 'cTn').filter((c) => c.getAttribute('nodeType') === 'interactiveSeq')) {
    const trig = bySpid.get(find(kid(iseq, 'stCondLst'), 'spTgt')?.getAttribute('spid') ?? '');
    if (!trig) continue;
    for (const eff of findAll(iseq, 'cTn')) {
      const cls = eff.getAttribute('presetClass') ?? '';
      if (cls !== 'entr' && cls !== 'exit' && cls !== 'emph' && cls !== 'path') continue;
      const el = bySpid.get(find(eff, 'spTgt')?.getAttribute('spid') ?? '');
      if (!el || el === trig || el.anim) continue;
      applyEffect(el, eff, cls);
      delete el.animBy;
      el.animTrig = trig.id;
    }
  }
  const seq = findAll(timing, 'cTn').find((c) => c.getAttribute('nodeType') === 'mainSeq');
  if (!seq) return;
  const order: SlideEl[] = [];
  const keys: string[] = []; // toate efectele, în ordinea din fișier („id” sau „id~j” pentru al doilea, al treilea… efect al casetei)
  for (const eff of findAll(seq, 'cTn')) {
    const cls = eff.getAttribute('presetClass');
    // „Redă” la click pe un clip = animația „Media: Redare” (cele pornite singure sunt Pornește singur, mai sus).
    const cmd = cls === 'mediacall' ? findAll(eff, 'cmd').map((c) => c.getAttribute('cmd') ?? '').find((c) => /^(playFrom|togglePause|pause|stop)/.test(c)) ?? '' : '';
    // Pauză și Oprire sunt pași ai animațiilor oricum ar porni; Redă doar la click (cele pornite singure sunt Pornește singur).
    const media = cmd.startsWith('playFrom') ? (eff.getAttribute('nodeType') === 'clickEffect' ? 'play' : '') : cmd ? (cmd === 'stop' ? 'stop' : 'pause') : '';
    const play = !!media;
    if (cls !== 'entr' && cls !== 'exit' && cls !== 'emph' && cls !== 'path' && !play) continue;
    const el0 = bySpid.get(find(eff, 'spTgt')?.getAttribute('spid') ?? '');
    if (!el0 || (play && el0.kind !== 'media')) continue;
    // Încă un efect pe aceeași casetă = o animație în plus (more); paragrafele unei casete animate pe paragrafe nu se numără.
    const again = order.includes(el0);
    if (again && (find(eff, 'pRg') || (el0.more?.length ?? 0) >= MAX_FX)) continue;
    const el: SlideEl = again ? { ...el0, anim: undefined, animStart: undefined, animDelay: undefined, animDur: undefined, animDir: undefined, animLen: undefined, animPts: undefined, animBy: undefined, more: undefined } : el0;
    applyEffect(el, eff, cls!);
    if (play) { el.anim = media as Anim; delete el.animDur; delete el.animDir; delete el.animLen; }
    if (again) {
      const fx = cleanAnimFx(el);
      if (fx) { (el0.more ??= []).push(fx); keys.push(fxKey(el0.id, el0.more.length - 1)); }
      continue;
    }
    keys.push(el.id);
    order.push(el);
  }
  const slots = els.map((e, i) => (order.includes(e) ? i : -1)).filter((i) => i >= 0);
  slots.forEach((slot, k) => { els[slot] = order[k]; });
  // Cu animații în plus, fiecare animație primește locul ei din fișier (de exemplu: A intră, B intră, A pleacă).
  if (order.some((e) => e.more?.length)) for (const e of order) {
    e.animOrder = keys.indexOf(e.id);
    e.more?.forEach((m, j) => { m.animOrder = keys.indexOf(fxKey(e.id, j)); });
  }
}

function transitionOf(doc: Document): Pick<Slide, 'transition' | 'trDir' | 'trSplit' | 'trSpeed' | 'trDur'> {
  const t = find(doc, 'transition');
  if (!t) return { transition: 'none' };
  const kindEl = [...t.childNodes].find((c) => c.nodeType === 1) as Element | undefined;
  const kind = kindEl?.localName;
  if (!kind) return { transition: 'none' }; // doar avans automat, fără efect
  const transition: Transition = kind === 'push' ? 'push' : kind === 'wipe' ? 'wipe' : kind === 'split' ? 'split' : kind === 'cover' ? 'cover'
    : kind === 'pull' ? 'uncover' : kind === 'zoom' ? 'zoom'
    : kind === 'flip' || kind === 'vortex' || kind === 'ferris' || kind === 'gallery' || kind === 'doors' || kind === 'morph' || kind === 'pan' || kind === 'conveyor' ? kind
    : kind === 'prism' ? (!/^(1|true)$/.test(kindEl?.getAttribute('isContent') ?? '') ? 'cube' : /^(1|true)$/.test(kindEl?.getAttribute('isInverted') ?? '') ? 'orbit' : 'rotate')
    : kind === 'prstTrans' ? (/^curtains$/.test(kindEl?.getAttribute('prst') ?? '') ? 'curtains' : /^pageCurl/.test(kindEl?.getAttribute('prst') ?? '') ? 'curl' : 'fade') : 'fade';
  // dir poate avea și diagonale (lu, rd): le păstrăm la Ștergere, Acoperire, Descoperire; la celelalte, prima literă.
  const dir = kindEl?.getAttribute('dir') ?? '';
  const d = ['lu', 'ru', 'ld', 'rd'].includes(dir) && (transition === 'wipe' || transition === 'cover' || transition === 'uncover') ? dir as 'lu' : dir.charAt(0);
  const trDir = DIRECTED.includes(transition) && ['r', 'u', 'd', 'lu', 'ru', 'ld', 'rd'].includes(d) ? d as 'r' : undefined;
  // Durata: spd (fast / med / slow) sau p14:dur în milisecunde (PowerPoint 2010+).
  const ms = Number(t.getAttribute('p14:dur') ?? t.getAttribute('dur') ?? NaN);
  const spd = t.getAttribute('spd');
  const trSpeed = ms > 0 ? (ms < 625 ? 'fast' : ms > 875 ? 'slow' : undefined) : spd === 'fast' || spd === 'slow' ? spd : undefined;
  // O durată care nu e una din cele trei obișnuite (0,5 / 0,75 / 1 s) se păstrează exact.
  const trDur = ms > 0 && ![500, 750, 1000].includes(ms) ? cleanTrDur(ms / 1000) : undefined;
  // Împărțirea: orient (lipsă = horz în format) și dir (lipsă = out).
  const trSplit = transition === 'split' ? ((kindEl?.getAttribute('orient') === 'vert' ? 'v' : 'h') + (kindEl?.getAttribute('dir') === 'in' ? 'i' : 'o')) as 'vo' | 'vi' | 'ho' | 'hi' : undefined;
  return { transition, ...(trDir ? { trDir } : {}), ...(trSplit && trSplit !== 'vo' ? { trSplit } : {}), ...(trSpeed ? { trSpeed } : {}), ...(trDur ? { trDur } : {}) };
}

/** Graficul din arhivă → tipul și datele (din valorile memorate în grafic, fără foaia Excel din spate). */
/** Felul graficului cu bare după direcție (bar = orizontal) și grupare (stacked / percentStacked). */
export function barKind(horizontal: boolean, grouping: string): ChartType {
  const g = grouping === 'percentStacked' ? '100' : /stacked/i.test(grouping) ? 'st' : '';
  return horizontal ? (g === '100' ? 'barStack100' : g ? 'barStack' : 'bar') : (g === '100' ? 'stack100' : g ? 'stack' : 'col');
}

const readChart = async (zip: Zip, path: string) => chartFromDoc(await xmlOf(zip, path));

/** Graficul DrawingML (c:chartSpace) cu valorile lui salvate (c:numCache / c:strCache) → felul, titlul, tabelul de date și aspectul; și în Docs (.docx). */
/**
 * Graficele de tip nou (cx:chartSpace: pâlnie, cascadă, histogramă, Pareto, cutie, hartă de suprafețe, soare), cu valorile salvate
 * în fișier. Pe slide și în document se desenează cu felul de bază cel mai apropiat (pâlnia și harta ca bare, cascada și restul
 * ca coloane, soarele ca inel), cu aceleași date; harta regiunilor nu se aduce.
 */
const CX_KINDS: Record<string, ChartType> = { funnel: 'funnel', waterfall: 'waterfall', clusteredColumn: 'hist', boxWhisker: 'box', treemap: 'treemap', sunburst: 'sunburst' };

function chartExFromDoc(doc: Document): ReturnType<typeof chartFromDoc> {
  const all = findAll(find(doc, 'plotAreaRegion'), 'series'), sers = all.filter((s) => s.getAttribute('layoutId') !== 'paretoLine');
  // Histograma cu linia Pareto (seria paretoLine) e graficul Pareto.
  const chart = all.length > sers.length ? 'pareto' : CX_KINDS[sers[0]?.getAttribute('layoutId') ?? ''];
  if (!chart) return null;
  const data = kids(find(doc, 'chartData'), 'data');
  // Valorile unei dimensiuni: ultimul nivel (cx:lvl) are numele frunzelor la hartă / soare.
  const pts = (dim: Element | null) => {
    const lv = kids(dim, 'lvl'), out: string[] = [];
    for (const pt of kids(lv[lv.length - 1], 'pt')) out[+(pt.getAttribute('idx') ?? 0)] = pt.textContent ?? '';
    return out;
  };
  const cols = sers.slice(0, TABLE_MAX_COLS - 1).map((s, i) => {
    const d = data.find((x) => x.getAttribute('id') === (kid(s, 'dataId')?.getAttribute('val') ?? String(i))) ?? data[i];
    const val = kids(d, 'numDim').find((n) => n.getAttribute('type') === 'val' || n.getAttribute('type') === 'size') ?? null;
    const cat = kids(d, 'strDim').find((n) => n.getAttribute('type') === 'cat') ?? null;
    return { name: findAll(kid(s, 'tx'), 'v')[0]?.textContent?.trim() || `Seria ${i + 1}`, vals: pts(val), cats: pts(cat) };
  }).filter((c) => c.vals.length);
  if (!cols.length) return null;
  const n = Math.min(TABLE_MAX_ROWS - 1, Math.max(...cols.map((c) => c.vals.length)));
  const cats = cols[0].cats;
  const cells = [['', ...cols.map((c) => c.name)], ...Array.from({ length: n }, (_, r) => [cats[r] ?? String(r + 1), ...cols.map((c) => (c.vals[r] ?? '').replace('.', ','))])];
  const tx = kid(kid(find(doc, 'chart'), 'title'), 'tx');
  const text = (tx ? findAll(tx, 'v')[0]?.textContent ?? findAll(tx, 't').map((t) => t.textContent ?? '').join('') : '').trim();
  const clab = sers.some((s) => kid(kid(s, 'dataLabels'), 'visibility')?.getAttribute('value') === '1');
  return { chart, text, cells, ...(clab ? { clab: true } : {}), ...(cols.length < 2 && chart !== 'doughnut' ? { cleg: 'none' as const } : {}) };
}

export function chartFromDoc(doc: Document | null): { chart: ChartType; text: string; cells: string[][]; cpal?: number; cxt?: string; cyt?: string; clab?: boolean; cleg?: 't' | 'r' | 'none'; cng?: boolean; cbg?: string; cln?: string; cfont?: string; cink?: string } | null {
  if (doc && find(doc, 'chartData')) return chartExFromDoc(doc);
  const plot = find(doc, 'plotArea');
  if (!doc || !plot) return null;
  const KINDS = ['barChart', 'bar3DChart', 'lineChart', 'line3DChart', 'pieChart', 'pie3DChart', 'doughnutChart', 'areaChart', 'area3DChart', 'scatterChart', 'stockChart', 'radarChart'];
  const all = [...plot.children].filter((c) => KINDS.includes(c.localName));
  // Coloane + linie = combinat (linia la sfârșit; pe axa din dreapta dacă are alte axe decât coloanele).
  const barEl = all.find((c) => c.localName === 'barChart' && kid(c, 'barDir')?.getAttribute('val') !== 'bar' && !/stacked/i.test(kid(c, 'grouping')?.getAttribute('val') ?? ''));
  const lineEl = all.find((c) => c.localName === 'lineChart');
  const axIds = (n: Element) => kids(n, 'axId').map((a) => a.getAttribute('val')).join(',');
  const comboOf = barEl && lineEl ? (axIds(barEl) === axIds(lineEl) ? 'combo' as const : 'combo2' as const) : null;
  const kindEl = comboOf ? barEl! : all[0];
  if (!kindEl) return null;
  const nm = kindEl.localName, grouping = kid(kindEl, 'grouping')?.getAttribute('val') ?? '';
  const chart: ChartType = comboOf ?? (nm === 'doughnutChart' ? 'doughnut' : nm.startsWith('pie') ? 'pie' : nm.startsWith('line') ? 'line' : nm.startsWith('area') ? 'area'
    // Bursierul (deschidere / maxim / minim / închidere) rămâne bursier; radarul (păianjenul) rămâne radar, gol sau umplut.
    : nm === 'scatterChart' ? 'scatter' : nm === 'stockChart' ? 'stock' : nm === 'radarChart' ? (kid(kindEl, 'radarStyle')?.getAttribute('val') === 'filled' ? 'radarFill' : 'radar') : barKind(kid(kindEl, 'barDir')?.getAttribute('val') === 'bar', grouping));
  const pts = (n: Element | null) => {
    const out: string[] = [];
    for (const pt of findAll(n, 'pt')) out[+(pt.getAttribute('idx') ?? 0)] = kid(pt, 'v')?.textContent ?? '';
    return out;
  };
  const sers = [...kids(kindEl, 'ser'), ...(comboOf ? kids(lineEl!, 'ser') : [])].slice(0, TABLE_MAX_COLS - 1);
  if (!sers.length) return null;
  // La puncte (X–Y), etichetele sunt valorile X (c:xVal), iar numerele valorile Y (c:yVal).
  const cats = pts(kid(sers[0], 'cat') ?? kid(sers[0], 'xVal'));
  const vals = sers.map((s) => pts(kid(s, 'val') ?? kid(s, 'yVal')));
  const n = Math.min(TABLE_MAX_ROWS - 1, Math.max(cats.length, ...vals.map((v) => v.length)));
  const names = sers.map((s, i) => findAll(kid(s, 'tx'), 'v')[0]?.textContent ?? `Seria ${i + 1}`);
  const cells = [['', ...names], ...Array.from({ length: n }, (_, r) => [cats[r] ?? String(r + 1), ...vals.map((v) => (v[r] ?? '').replace('.', ','))])];
  const title = findAll(kid(find(doc, 'chart'), 'title'), 't').map((t) => t.textContent ?? '').join('');
  // Titlurile axelor (după locul axei) și paleta noastră, dacă prima serie are prima ei culoare.
  const look: { cpal?: number; cxt?: string; cyt?: string; clab?: boolean; cleg?: 't' | 'r' | 'none'; cng?: boolean; cbg?: string; cln?: string; cfont?: string; cink?: string } = {};
  // Fontul și culoarea textului: din formatarea textului (c:txPr) a legendei, a axelor sau a întregului grafic, primul găsit;
  // griurile obișnuite (și negrul automat al altor programe, fără culoare scrisă) nu se păstrează.
  const txPrs = [kid(find(doc, 'chart'), 'legend'), ...[...plot.children].filter((k) => /^(catAx|valAx|dateAx)$/.test(k.localName)), find(doc, 'chartSpace')]
    .map((n) => kid(n ?? undefined, 'txPr')).filter((n): n is Element => !!n);
  const face = txPrs.map((t) => findAll(t, 'latin')[0]?.getAttribute('typeface') ?? '').find((f) => f && !f.startsWith('+'));
  if (face && face !== 'Segoe UI' && cleanFont(face)) look.cfont = cleanFont(face);
  const inkV = txPrs.map((t) => findAll(t, 'srgbClr')[0]?.getAttribute('val') ?? '').find((v) => /^[0-9a-f]{6}$/i.test(v));
  if (inkV && !/^(222222|333333|444444|555555|666666)$/i.test(inkV)) look.cink = '#' + inkV.toLowerCase();
  // Zona diagramei (c:chartSpace/c:spPr): umplerea plină (dacă nu e albă) și conturul; graficul fără grilă pe nicio axă de valori.
  const spaceSp = kid(find(doc, 'chartSpace'), 'spPr');
  const solid = (n: Element | null | undefined) => { const v = kid(kid(n ?? undefined, 'solidFill'), 'srgbClr')?.getAttribute('val'); return v && /^[0-9a-f]{6}$/i.test(v) ? '#' + v.toLowerCase() : undefined; };
  const bgC = solid(spaceSp), lnC = solid(kid(spaceSp ?? undefined, 'ln'));
  if (bgC && bgC !== '#ffffff') look.cbg = bgC;
  if (lnC) look.cln = lnC;
  const valAxes = [...plot.children].filter((k) => k.localName === 'valAx');
  if (valAxes.length && !valAxes.some((a) => kid(a, 'majorGridlines'))) look.cng = true;
  // Legenda: lipsă (la cel puțin două serii sau la plăcintă) = „Fără”; sus / dreapta se păstrează (la plăcintă stă oricum în dreapta).
  const legEl = kid(find(doc, 'chart'), 'legend');
  const round = chart === 'pie' || chart === 'doughnut';
  if (!legEl) { if (round || sers.length > 1) look.cleg = 'none'; }
  else if (!round) { const lp = kid(legEl, 'legendPos')?.getAttribute('val'); if (lp === 't') look.cleg = 't'; else if (lp === 'r' || lp === 'l' || lp === 'tr') look.cleg = 'r'; }
  // Valorile pe grafic: c:dLbls cu showVal = 1 pe o serie sau pe tot tipul de grafic.
  if (chart !== 'pie' && chart !== 'doughnut' && [kindEl, ...sers].some((n) => kid(kid(n, 'dLbls'), 'showVal')?.getAttribute('val') === '1')) look.clab = true;
  for (const ax of [...plot.children]) {
    if (!/^(catAx|valAx|dateAx)$/.test(ax.localName)) continue;
    const t = findAll(kid(ax, 'title'), 't').map((x) => x.textContent ?? '').join('').trim().slice(0, 100);
    const pos = kid(ax, 'axPos')?.getAttribute('val');
    if (!t) continue;
    if ((pos === 'b' || pos === 't') && !look.cxt) look.cxt = t;
    else if ((pos === 'l' || pos === 'r') && !look.cyt) look.cyt = t;
  }
  // La plăcintă culorile stau pe felii (c:dPt), deci căutăm printre primele culori ale seriei, nu doar prima (albul marginilor nu contează).
  const used = findAll(sers[0], 'srgbClr').slice(0, 6).map((c) => c.getAttribute('val')?.toUpperCase());
  const pi = PALETTES.findIndex(([, cols]) => used.includes(cols[0].slice(1).toUpperCase()));
  if (pi > 0) look.cpal = pi;
  return { chart, text: title, cells, ...look };
}
