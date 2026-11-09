// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Export .ods (OpenDocument, foaia de calcul), scris de noi după specificația ODF 1.2: toate foile, valorile, textele, formulele
// (în sintaxa OpenFormula, cu rezultatul calculat de noi), formatarea celulelor (font, culori, aliniere, chenar, încadrare),
// formatele de număr (zecimale, procent, lei / euro, dată, oră), lățimile coloanelor, înălțimile rândurilor, rândurile și coloanele
// ascunse, celulele îmbinate, notele și foile ascunse. Graficele, filtrele și formatarea condiționată nu se scriu încă.
import { threadText } from './comments';
import JSZip from 'jszip';
import { CellStyle, cellId, parseCellId as cellPos, colName, COLS, isNumber, lastUsedRow, ROWS } from './format';
import { toExcelFormula, type XlsxOut } from './xlsx';
import { sheetKey, type ExtBook } from './formula';
import { linkTarget, quoteExtRefs } from './extLinks';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const NL = String.fromCharCode(10);
const BOOL = /^(ADEVĂRAT|ADEVARAT|FALS|TRUE|FALSE)$/i;

// Funcțiile noi din Excel au în OpenDocument numele cu „COM.MICROSOFT.” în față (așa le scriu și le citesc programele ODF).
const MS_FUNCS = new Set(['IFS', 'SWITCH', 'MAXIFS', 'MINIFS', 'CONCAT', 'TEXTJOIN', 'XLOOKUP', 'XMATCH', 'FILTER', 'SORT', 'SORTBY', 'UNIQUE',
  'SEQUENCE', 'RANDARRAY', 'LET', 'IFNA', 'FORECAST.LINEAR', 'STOCKHISTORY', 'TEXTBEFORE', 'TEXTAFTER', 'TEXTSPLIT', 'VSTACK', 'HSTACK', 'TOCOL', 'TOROW',
  'TAKE', 'DROP', 'CHOOSECOLS', 'CHOOSEROWS', 'EXPAND', 'WRAPROWS', 'WRAPCOLS']);

/** O referință din formula Excel („A1”, „$B$2:C3”, „Foaia2!A1”, „'Foaia mea'!A:A”) → forma ODF („[.A1]”, „[$Foaia2.A1]”…). */
function odfRef(sheet: string | undefined, a: string, b?: string, links: ExtBook[] = []): string {
  // Foaia altui registru ('C:\Dosar\[Buget.xlsx]Foaie1') → ['file:///C:/Dosar/Buget.xlsx'#$Foaie1.A1], cu calea ținută minte în legătură.
  const ext = sheet === undefined ? null : /^(.*?)\[([^\][]+)\](.+)$/.exec(sheet);
  if (ext) {
    const l = links.find((x) => sheetKey(x.name) === sheetKey(ext[2]));
    const iri = linkTarget(l ?? { name: ext[2], ...(ext[1] ? { path: ext[1] + ext[2] } : {}), sheets: [] });
    const s2 = /^[A-Za-z_][A-Za-z0-9_]*$/.test(ext[3]) ? '$' + ext[3] : `$'${ext[3].replace(/'/g, "''")}'`;
    return `['${iri.replace(/'/g, "''")}'#${s2}.${a}${b ? ':.' + b : ''}]`;
  }
  const sh = sheet === undefined ? '' : /^[A-Za-z_][A-Za-z0-9_]*$/.test(sheet) ? '$' + sheet : `$'${sheet.replace(/'/g, "''")}'`;
  return '[' + sh + '.' + a + (b ? ':.' + b : '') + ']';
}
// Foaia (opțional), apoi celulă / zonă de celule / coloane întregi / rânduri întregi.
const REF = /(?:('(?:[^']|'')+'|[A-Za-z_][A-Za-z0-9_.]*)!)?(\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?|\$?[A-Z]{1,3}:\$?[A-Z]{1,3}|\$?\d+:\$?\d+)/y;

/** Formula Suite („=SUMĂ(A1:A3;2,5)” sau „=SUM(A1:A3,2.5)”) → „of:=SUM([.A1:.A3];2.5)”. */
export function toOdsFormula(raw: string, links: ExtBook[] = []): string {
  const src = toExcelFormula(quoteExtRefs(raw)).replace(/_xlfn\._xlws\.|_xlfn\.|_xlpm\.|_xleta\./g, '');
  let out = '';
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"') {
      let j = i + 1;
      while (j < src.length && (src[j] !== '"' || src[j + 1] === '"')) j += src[j] === '"' ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    const prev = i ? src[i - 1] : '';
    if (!/[A-Za-z0-9_.$']/.test(prev)) {
      REF.lastIndex = i;
      const m = REF.exec(src);
      // Nu e referință dacă urmează o paranteză (o funcție ca LOG10) sau o literă / cifră.
      if (m && !/[A-Za-z0-9_(.]/.test(src[REF.lastIndex] ?? '')) {
        const [a, b] = m[2].split(':');
        out += odfRef(m[1]?.replace(/^'(.*)'$/, (_x, s: string) => s.replace(/''/g, "'")), a, b, links);
        i = REF.lastIndex;
        continue;
      }
      const fn = /^([A-Za-z][A-Za-z0-9_.]*)\s*\(/.exec(src.slice(i));
      if (fn) {
        const up = fn[1].toUpperCase();
        out += (MS_FUNCS.has(up) ? 'COM.MICROSOFT.' : '') + up;
        i += fn[1].length;
        continue;
      }
    }
    out += ch === ',' ? ';' : ch;
    i++;
  }
  return 'of:=' + out;
}

const px2in = (px: number) => (px / 96).toFixed(4) + 'in';

/** Stilul de număr ODF pentru formatul celulei (sau null pentru General / Text). */
function dataStyle(st: CellStyle, name: string): string | null {
  const dec = st.dec ?? 2;
  const num = (d: number, group = true) => `<number:number number:decimal-places="${d}" number:min-decimal-places="${d}" number:min-integer-digits="1"${group ? ' number:grouping="true"' : ''}/>`;
  switch (st.fmt) {
    case 'number': return `<number:number-style style:name="${name}">${num(st.dec ?? 2)}</number:number-style>`;
    case 'percent': return `<number:percentage-style style:name="${name}">${num(st.dec ?? 0, false)}<number:text>%</number:text></number:percentage-style>`;
    case 'lei': case 'acct': return `<number:currency-style style:name="${name}">${num(dec)}<number:text> </number:text><number:currency-symbol number:language="ro" number:country="RO">lei</number:currency-symbol></number:currency-style>`;
    case 'eur': return `<number:currency-style style:name="${name}">${num(dec)}<number:text> </number:text><number:currency-symbol>€</number:currency-symbol></number:currency-style>`;
    case 'sci': return `<number:number-style style:name="${name}"><number:scientific-number number:decimal-places="${dec}" number:min-integer-digits="1" number:min-exponent-digits="2"/></number:number-style>`;
    case 'date': return `<number:date-style style:name="${name}"><number:day number:style="long"/><number:text>.</number:text><number:month number:style="long"/><number:text>.</number:text><number:year number:style="long"/></number:date-style>`;
    case 'datelong': return `<number:date-style style:name="${name}" number:language="ro" number:country="RO"><number:day/><number:text> </number:text><number:month number:textual="true" number:style="long"/><number:text> </number:text><number:year number:style="long"/></number:date-style>`;
    case 'time': return `<number:time-style style:name="${name}"><number:hours number:style="long"/><number:text>:</number:text><number:minutes number:style="long"/></number:time-style>`;
    case 'datetime': return `<number:date-style style:name="${name}"><number:day number:style="long"/><number:text>.</number:text><number:month number:style="long"/><number:text>.</number:text><number:year number:style="long"/><number:text> </number:text><number:hours number:style="long"/><number:text>:</number:text><number:minutes number:style="long"/></number:date-style>`;
    default: return null;
  }
}
/** Felul valorii ODF pentru formatul celulei: o dată se scrie ca dată, un procent ca procent… */
function valueAttrs(st: CellStyle | undefined, v: number): string {
  const f = st?.fmt;
  if ((f === 'date' || f === 'datelong' || f === 'datetime') && v > 0 && v < 2958466) {
    const d = new Date(Math.round((v - 25569) * 86400000));
    const iso = d.toISOString().slice(0, f === 'datetime' ? 19 : 10);
    return `office:value-type="date" office:date-value="${iso}"`;
  }
  if (f === 'time' && v >= 0 && v < 1) {
    const s = Math.round(v * 86400);
    return `office:value-type="time" office:time-value="PT${Math.floor(s / 3600)}H${Math.floor(s / 60) % 60}M${s % 60}S"`;
  }
  if (f === 'percent') return `office:value-type="percentage" office:value="${v}"`;
  if (f === 'lei' || f === 'acct') return `office:value-type="currency" office:currency="RON" office:value="${v}"`;
  if (f === 'eur') return `office:value-type="currency" office:currency="EUR" office:value="${v}"`;
  return `office:value-type="float" office:value="${v}"`;
}

const BORDER: Record<string, string> = { thin: '0.75pt solid', medium: '1.75pt solid', thick: '2.5pt solid', dashed: '0.75pt dashed', dotted: '0.75pt dotted', double: '2.5pt double' };

/** Foile → octeții unui .ods. */
export async function writeOds(book: XlsxOut[], active = 0, links: ExtBook[] = []): Promise<Uint8Array> {
  const cellStyles = new Map<string, string>();
  const fonts = new Set<string>(['Calibri']);
  const autoXml: string[] = [];
  const numXml: string[] = [];
  const styleName = (st: CellStyle | undefined): string => {
    if (!st) return '';
    const key = JSON.stringify({ ...st, note: undefined, cmt: undefined, cdone: undefined, link: undefined, chk: undefined, unlock: undefined });
    if (key === '{}') return '';
    const known = cellStyles.get(key);
    if (known) return known;
    const name = 'ce' + (cellStyles.size + 1);
    cellStyles.set(key, name);
    const ds = dataStyle(st, 'N' + (numXml.length + 1));
    if (ds) numXml.push(ds);
    const cell: string[] = [], para: string[] = [], text: string[] = [];
    if (st.bg) cell.push(`fo:background-color="${st.bg}"`);
    if (st.wrap) cell.push('fo:wrap-option="wrap"');
    if (st.va) cell.push(`style:vertical-align="${st.va}"`);
    if (st.rot && st.rot !== 255) cell.push(`style:rotation-angle="${(st.rot + 360) % 360}"`);
    if (st.bd) {
      const line = `${BORDER[st.bdStyle ?? 'thin'] ?? BORDER.thin} ${st.bdColor ?? '#000000'}`;
      for (const [k, side] of [['t', 'top'], ['b', 'bottom'], ['l', 'left'], ['r', 'right']]) if (st.bd.includes(k)) cell.push(`fo:border-${side}="${line}"`);
    }
    if (st.align) { cell.push('style:text-align-source="fix"'); para.push(`fo:text-align="${st.align === 'left' ? 'start' : st.align === 'right' ? 'end' : 'center'}"`); }
    if (st.ind) para.push(`fo:margin-left="${(st.ind * 0.1).toFixed(2)}in"`);
    if (st.b) text.push('fo:font-weight="bold"', 'style:font-weight-asian="bold"', 'style:font-weight-complex="bold"');
    if (st.i) text.push('fo:font-style="italic"', 'style:font-style-asian="italic"', 'style:font-style-complex="italic"');
    if (st.u) text.push('style:text-underline-style="solid"', 'style:text-underline-width="auto"', 'style:text-underline-color="font-color"');
    if (st.s) text.push('style:text-line-through-style="solid"');
    if (st.color) text.push(`fo:color="${st.color}"`);
    if (st.sz) text.push(`fo:font-size="${st.sz}pt"`);
    if (st.font) { fonts.add(st.font); text.push(`style:font-name="${esc(st.font)}"`, `fo:font-family="${esc(st.font)}"`); }
    if (st.pos) text.push(`style:text-position="${st.pos === 'sup' ? 'super' : 'sub'} 58%"`);
    autoXml.push(`<style:style style:name="${name}" style:family="table-cell" style:parent-style-name="Default"${ds ? ` style:data-style-name="N${numXml.length}"` : ''}>`
      + (cell.length ? `<style:table-cell-properties ${cell.join(' ')}/>` : '')
      + (para.length ? `<style:paragraph-properties ${para.join(' ')}/>` : '')
      + (text.length ? `<style:text-properties ${text.join(' ')}/>` : '')
      + '</style:style>');
    return name;
  };
  // Lățimile coloanelor și înălțimile rândurilor alese de mână: câte un stil pentru fiecare mărime.
  const sizeStyles = new Map<string, string>();
  const sizeStyle = (family: 'table-column' | 'table-row', px: number) => {
    const key = family + px;
    let n = sizeStyles.get(key);
    if (!n) {
      n = (family === 'table-column' ? 'co' : 'ro') + (sizeStyles.size + 1);
      sizeStyles.set(key, n);
      autoXml.push(family === 'table-column'
        ? `<style:style style:name="${n}" style:family="table-column"><style:table-column-properties fo:break-before="auto" style:column-width="${px2in(px)}"/></style:style>`
        : `<style:style style:name="${n}" style:family="table-row"><style:table-row-properties style:row-height="${px2in(px * 0.75 * 96 / 72)}" style:use-optimal-row-height="false"/></style:style>`);
    }
    return n;
  };
  autoXml.push('<style:style style:name="ta1" style:family="table" style:master-page-name="Default"><style:table-properties table:display="true"/></style:style>');
  autoXml.push('<style:style style:name="ta2" style:family="table" style:master-page-name="Default"><style:table-properties table:display="false"/></style:style>');

  const tables: string[] = [];
  for (const { sheet, results } of book) {
    const lastR = Math.min(ROWS - 1, lastUsedRow(sheet.cells, sheet.styles));
    let lastC = -1;
    for (const id of [...Object.keys(sheet.cells), ...Object.keys(sheet.styles)]) { const p = cellPos(id); if (p && p.c > lastC) lastC = p.c; }
    lastC = Math.min(COLS - 1, Math.max(lastC, 0));
    // Celulele îmbinate: cea din stânga-sus întinde zona, celelalte sunt „acoperite”.
    const span = new Map<string, { rows: number; cols: number }>();
    const covered = new Set<string>();
    for (const m of sheet.merges ?? []) {
      const [a, b] = m.split(':').map((x) => cellPos(x));
      if (!a || !b) continue;
      span.set(cellId(a.r, a.c), { rows: b.r - a.r + 1, cols: b.c - a.c + 1 });
      for (let r = a.r; r <= b.r; r++) for (let c = a.c; c <= b.c; c++) if (r !== a.r || c !== a.c) covered.add(cellId(r, c));
    }
    const hidR = new Set(sheet.hideRows ?? []), hidC = new Set(sheet.hideCols ?? []);
    const cols: string[] = [];
    for (let c = 0; c <= lastC; c++) {
      const w = sheet.colW[colName(c)];
      cols.push(`<table:table-column${w ? ` table:style-name="${sizeStyle('table-column', w)}"` : ''}${hidC.has(c + 1) ? ' table:visibility="collapse"' : ''} table:default-cell-style-name="Default"/>`);
    }
    const rows: string[] = [];
    let emptyRun = 0;
    const flushEmpty = () => { if (emptyRun) rows.push(`<table:table-row${emptyRun > 1 ? ` table:number-rows-repeated="${emptyRun}"` : ''}><table:table-cell table:number-columns-repeated="${lastC + 1}"/></table:table-row>`); emptyRun = 0; };
    for (let r = 0; r <= Math.max(lastR, 0); r++) {
      const cs: string[] = [];
      let blank = 0;
      const flushBlank = () => { if (blank) cs.push(`<table:table-cell${blank > 1 ? ` table:number-columns-repeated="${blank}"` : ''}/>`); blank = 0; };
      for (let c = 0; c <= lastC; c++) {
        const id = cellId(r, c);
        if (covered.has(id)) { flushBlank(); cs.push('<table:covered-table-cell/>'); continue; }
        const raw = sheet.cells[id];
        const st = sheet.styles[id];
        const res = results[id];
        if (!raw && !st && !res) { blank++; continue; }
        flushBlank();
        const sn = styleName(st);
        const sp = span.get(id);
        let a = (sn ? ` table:style-name="${sn}"` : '') + (sp ? ` table:number-columns-spanned="${sp.cols}" table:number-rows-spanned="${sp.rows}"` : '');
        let shown = '';
        const value = (v: Result | undefined) => {
          if (!v) return;
          if (v.err) { a += ` office:value-type="string" office:string-value="${esc(v.text)}"`; shown = v.text; }
          else if (v.num && v.value !== undefined) { a += ' ' + valueAttrs(st, v.value); shown = v.text; }
          else if (BOOL.test(v.text)) { a += ` office:value-type="boolean" office:boolean-value="${/^(ADEV|TRUE)/i.test(v.text)}"`; shown = v.text; }
          else { a += ' office:value-type="string"'; shown = v.text; }
        };
        if (raw && raw.startsWith('=') && raw.length > 1) {
          a += ` table:formula="${esc(toOdsFormula(raw, links))}"`;
          value(res);
        } else if (raw && isNumber(raw)) {
          const v = Number(raw.trim().replace(',', '.'));
          a += ' ' + valueAttrs(st, v);
          shown = res?.text ?? raw;
        } else if (raw && BOOL.test(raw.trim())) {
          a += ` office:value-type="boolean" office:boolean-value="${/^(ADEV|TRUE)/i.test(raw.trim())}"`;
          shown = raw.trim();
        } else if (raw) {
          a += ' office:value-type="string"';
          shown = raw.startsWith("'") ? raw.slice(1) : raw;
        } else if (res) value(res); // valoare vărsată de o formulă de deasupra
        const link = st?.link;
        const paras = shown ? shown.split(NL).map((l) => `<text:p>${link ? `<text:a xlink:href="${esc(link)}" xlink:type="simple">${esc(l)}</text:a>` : esc(l)}</text:p>`).join('') : '';
        const noteText = st?.cmt?.length ? (st.note ? st.note + NL : '') + threadText(st.cmt, st.cdone) : st?.note;
        const note = noteText ? `<office:annotation><text:p>${esc(noteText).split(NL).join('</text:p><text:p>')}</text:p></office:annotation>` : '';
        cs.push(`<table:table-cell${a}>${note}${paras}</table:table-cell>`);
      }
      blank = 0; // celulele goale de la capătul rândului nu se scriu
      const h = sheet.rowH?.[String(r + 1)];
      const ra = (h ? ` table:style-name="${sizeStyle('table-row', h)}"` : '') + (hidR.has(r + 1) ? ' table:visibility="collapse"' : '');
      if (!cs.length && !ra) { emptyRun++; continue; }
      flushEmpty();
      rows.push(`<table:table-row${ra}>${cs.length ? cs.join('') : `<table:table-cell table:number-columns-repeated="${lastC + 1}"/>`}</table:table-row>`);
    }
    flushEmpty();
    tables.push(`<table:table table:name="${esc(sheet.name)}" table:style-name="${sheet.hidden ? 'ta2' : 'ta1'}"${sheet.protect ? ' table:protected="true"' : ''}>`
      + cols.join('') + rows.join('') + '</table:table>');
  }

  const NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"'
    + ' xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"'
    + ' xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink"'
    + ' xmlns:number="urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0" xmlns:of="urn:oasis:names:tc:opendocument:xmlns:of:1.2"'
    + ' xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0"';
  const head = '<?xml version="1.0" encoding="UTF-8"?>' + NL;
  const content = head + `<office:document-content ${NS} office:version="1.2">`
    + '<office:font-face-decls>' + [...fonts].map((n) => `<style:font-face style:name="${esc(n)}" svg:font-family="${esc(n)}"/>`).join('') + '</office:font-face-decls>'
    + `<office:automatic-styles>${numXml.join('')}${autoXml.join('')}</office:automatic-styles>`
    + `<office:body><office:spreadsheet>${tables.join('')}</office:spreadsheet></office:body></office:document-content>`;
  const styles = head + `<office:document-styles ${NS} office:version="1.2"><office:styles>`
    + '<style:style style:name="Default" style:family="table-cell"><style:text-properties fo:font-size="11pt" style:font-name="Calibri" fo:font-family="Calibri"/></style:style>'
    + '</office:styles><office:automatic-styles><style:page-layout style:name="pm1"/></office:automatic-styles>'
    + '<office:master-styles><style:master-page style:name="Default" style:page-layout-name="pm1"/></office:master-styles></office:document-styles>';
  // Foaia deschisă la pornire (o foaie vizibilă).
  let tab = Math.max(0, Math.min(book.length - 1, active));
  if (book[tab]?.sheet.hidden) tab = Math.max(0, book.findIndex((b) => !b.sheet.hidden));
  const settings = head + `<office:document-settings ${NS} office:version="1.2"><office:settings><config:config-item-set config:name="ooo:view-settings">`
    + '<config:config-item-map-indexed config:name="Views"><config:config-item-map-entry>'
    + `<config:config-item config:name="ViewId" config:type="string">view1</config:config-item><config:config-item config:name="ActiveTable" config:type="string">${esc(book[tab]?.sheet.name ?? '')}</config:config-item>`
    + '</config:config-item-map-entry></config:config-item-map-indexed></config:config-item-set></office:settings></office:document-settings>';
  const meta = head + `<office:document-meta ${NS} office:version="1.2"><office:meta><meta:generator>Cyber Office Studio</meta:generator><meta:creation-date>${new Date().toISOString().slice(0, 19)}</meta:creation-date></office:meta></office:document-meta>`;
  const manifest = head + '<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">'
    + '<manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="application/vnd.oasis.opendocument.spreadsheet"/>'
    + ['content.xml', 'styles.xml', 'meta.xml', 'settings.xml'].map((f) => `<manifest:file-entry manifest:full-path="${f}" manifest:media-type="text/xml"/>`).join('')
    + '</manifest:manifest>';
  const zip = new JSZip();
  zip.file('mimetype', 'application/vnd.oasis.opendocument.spreadsheet', { compression: 'STORE' });
  zip.file('content.xml', content);
  zip.file('styles.xml', styles);
  zip.file('meta.xml', meta);
  zip.file('settings.xml', settings);
  zip.file('META-INF/manifest.xml', manifest);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', mimeType: 'application/vnd.oasis.opendocument.spreadsheet' });
}

type Result = XlsxOut['results'][string];
