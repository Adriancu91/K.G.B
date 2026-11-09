// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Export în alte formate (Word: Salvare ca → Text simplu / Pagină web / RTF): .txt, .html și .rtf.
import { sectionKind, sectionNewPage } from './sectionKinds';
import type { JSONContent } from '@tiptap/react';
import type { DocProps } from './format';
import { BIB_TITLE, citeTextJson, cleanStyle, docSourcesJson, refText } from './citation';
import { dropText } from './formDropData';
import { dateText } from './formDate';

const NL = '\r\n';

/** Textul documentului, ca „Text simplu” din Word: un paragraf pe rând, buline și numere la liste, celulele despărțite cu Tab,
 *  notele de subsol ca [1] în text și la sfârșit. */
export function docToText(doc: JSONContent): string {
  const lines: string[] = [];
  const notes: string[] = [];
  const inline = (nodes: JSONContent[] = []): string => nodes.map((n) => {
    if (n.type === 'text') return n.text ?? '';
    if (n.type === 'hardBreak') return NL;
    if (n.type === 'tabChar') return String.fromCharCode(9);
    if (n.type === 'citation') return citeTextJson(n);
    if (n.type === 'formCheck') return n.attrs?.checked ? '☒' : '☐';
    if (n.type === 'formDrop') return dropText(n.attrs);
    if (n.type === 'formDate') return dateText(n.attrs);
    if (n.type === 'footnote') { notes.push(String(n.attrs?.text ?? '')); return `[${notes.length}]`; }
    return inline(n.content);
  }).join('');
  const block = (n: JSONContent, prefix = '', depth = 0) => {
    switch (n.type) {
      case 'paragraph':
      case 'heading':
        lines.push(prefix + inline(n.content));
        break;
      case 'bulletList':
      case 'orderedList':
      case 'taskList': {
        let i = Number(n.attrs?.start) || 1;
        for (const item of n.content ?? []) {
          const mark = n.type === 'orderedList' ? `${i++}.` : n.type === 'taskList' ? (item.attrs?.checked ? '[x]' : '[ ]') : '•';
          const pad = '    '.repeat(depth);
          (item.content ?? []).forEach((c, k) => {
            if (c.type === 'bulletList' || c.type === 'orderedList' || c.type === 'taskList') block(c, '', depth + 1);
            else block(c, k === 0 ? `${pad}${mark} ` : `${pad}   `, depth);
          });
        }
        break;
      }
      case 'blockquote':
        (n.content ?? []).forEach((c) => block(c, prefix + '    ', depth));
        break;
      case 'textBox':
        (n.content ?? []).forEach((c) => block(c, prefix, depth));
        break;
      case 'table':
        for (const row of n.content ?? []) {
          lines.push(prefix + (row.content ?? []).map((cell) => (cell.content ?? []).map((p) => inline(p.content)).join(' ').replace(/\s*\r\n\s*/g, ' ')).join('\t'));
        }
        lines.push('');
        break;
      case 'horizontalRule':
        lines.push('----------');
        break;
      case 'image':
        if (n.attrs?.caption) lines.push(prefix + String(n.attrs.caption));
        break;
      case 'pageBreak':
        lines.push('\f');
        break;
      case 'sectionBreak':
        if (sectionNewPage(sectionKind(n.attrs?.kind))) lines.push('\f');
        break;
      case 'tableOfContents':
        break;
      case 'bibliography':
        lines.push(prefix + BIB_TITLE, ...docSourcesJson(doc).map((s) => prefix + refText(s, cleanStyle(n.attrs?.style))));
        break;
      default:
        if (n.content) n.content.forEach((c) => block(c, prefix, depth));
    }
  };
  (doc.content ?? []).forEach((n) => block(n));
  if (notes.length) lines.push('', '__________', ...notes.map((t, i) => `[${i + 1}] ${t}`));
  return lines.join(NL).replace(/\f\r\n/g, '\f') + NL;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const CSS = `body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; max-width: 50em; margin: 2em auto; padding: 0 1em; color: #222; }
h1 { font-size: 20pt; } h2 { font-size: 16pt; } h3 { font-size: 13pt; } h4 { font-size: 12pt; font-style: italic; } h5, h6 { font-size: 11pt; }
p.doc-title { font-size: 28pt; margin: 0 0 0.2em; } p.doc-subtitle { font-size: 14pt; color: #5a5a5a; margin: 0 0 1em; }
table { border-collapse: collapse; margin: 0.6em 0; } td, th { border: 1px solid #999; padding: 4px 8px; vertical-align: top; }
blockquote { margin: 0.6em 0; padding-left: 14px; border-left: 3px solid #ccc; color: #555; }
img { max-width: 100%; height: auto; } mark { padding: 0 1px; }
.doc-notes { margin-top: 2em; border-top: 1px solid #ccc; font-size: 0.9em; }`;

// Autorul, subiectul și cuvintele cheie din Proprietăți.
const meta = (p?: DocProps) => ([['author', p?.author], ['description', p?.subject], ['keywords', p?.keywords]] as const)
  .filter(([, v]) => v).map(([k, v]) => `<meta name="${k}" content="${esc(v!)}">\n`).join('');

/** O pagină web de sine stătătoare (pozele rămân în ea), cu notele de subsol numerotate la sfârșit. */
export function docToHtmlPage(bodyHtml: string, title: string, props?: DocProps): string {
  const dom = new DOMParser().parseFromString(`<body>${bodyHtml}</body>`, 'text/html');
  const notes: string[] = [];
  for (const fn of Array.from(dom.querySelectorAll('sup.doc-fn'))) {
    notes.push(fn.getAttribute('data-footnote') ?? '');
    const n = notes.length;
    const sup = dom.createElement('sup');
    sup.innerHTML = `<a href="#nota-${n}" id="ref-${n}">[${n}]</a>`;
    fn.replaceWith(sup);
  }
  // Atributele care țin doar de editor.
  for (const el of Array.from(dom.querySelectorAll('[contenteditable]'))) el.removeAttribute('contenteditable');
  let body = dom.body.innerHTML;
  if (notes.length) {
    body += `\n<section class="doc-notes">\n${notes.map((t, i) => `<p id="nota-${i + 1}"><a href="#ref-${i + 1}">[${i + 1}]</a> ${esc(t)}</p>`).join('\n')}\n</section>`;
  }
  return `<!DOCTYPE html>\n<html lang="ro">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="generator" content="Cyber Office Studio Docs">\n${meta(props)}<title>${esc(title)}</title>\n<style>\n${CSS}\n</style>\n</head>\n<body>\n${body}\n</body>\n</html>\n`;
}

/** HTML-ul conținutului unui document Docs dat ca JSON (fără editor deschis; de exemplu PDF → pagină web): paragrafe, titluri,
 *  liste, tabele, aldin / cursiv / subliniat, salturi de pagină. */
export function docJsonToHtml(doc: JSONContent): string {
  const inline = (nodes: JSONContent[] = []): string => nodes.map((n) => {
    if (n.type === 'hardBreak') return '<br>';
    if (n.type === 'tabChar') return '<span style="display:inline-block;width:1.25cm"></span>';
    if (n.type === 'citation') return esc(citeTextJson(n));
    if (n.type === 'formCheck') return n.attrs?.checked ? '☒' : '☐';
    if (n.type === 'formDrop') return esc(dropText(n.attrs));
    if (n.type === 'formDate') return esc(dateText(n.attrs));
    if (n.type !== 'text') return inline(n.content);
    let s = esc(n.text ?? '');
    for (const m of n.marks ?? []) {
      const tag = { bold: 'strong', italic: 'em', underline: 'u', strike: 's', subscript: 'sub', superscript: 'sup' }[m.type];
      if (tag) s = `<${tag}>${s}</${tag}>`;
      else if (m.type === 'link' && m.attrs?.href) s = `<a href="${esc(String(m.attrs.href))}">${s}</a>`;
    }
    return s;
  }).join('');
  const block = (n: JSONContent): string => {
    const kids = () => (n.content ?? []).map(block).join('');
    switch (n.type) {
      case 'paragraph': return `<p>${inline(n.content)}</p>\n`;
      case 'heading': { const l = Math.max(1, Math.min(6, Number(n.attrs?.level) || 1)); return `<h${l}>${inline(n.content)}</h${l}>\n`; }
      case 'bulletList': return `<ul>\n${kids()}</ul>\n`;
      case 'orderedList': return `<ol${Number(n.attrs?.start) > 1 ? ` start="${Number(n.attrs!.start)}"` : ''}>\n${kids()}</ol>\n`;
      case 'listItem': case 'taskItem': return `<li>${kids().replace(/^<p>([\s\S]*?)<\/p>\n/, '$1')}</li>\n`;
      case 'table': return `<table>\n${kids()}</table>\n`;
      case 'tableRow': return `<tr>${kids()}</tr>\n`;
      case 'tableCell': case 'tableHeader': { const t = n.type === 'tableHeader' ? 'th' : 'td'; return `<${t}>${(n.content ?? []).map((p) => inline(p.content)).join('<br>')}</${t}>`; }
      case 'pageBreak': return '<hr style="page-break-after: always; border: 0; border-top: 1px dashed #bbb;">\n';
      case 'sectionBreak': return sectionNewPage(sectionKind(n.attrs?.kind)) ? '<hr style="page-break-after: always; border: 0; border-top: 1px dashed #bbb;">\n' : '';
      case 'horizontalRule': return '<hr>\n';
      case 'blockquote': return `<blockquote>\n${kids()}</blockquote>\n`;
      default: return kids();
    }
  };
  return (doc.content ?? []).map(block).join('');
}

// ---------- RTF (Rich Text Format, specificația publică 1.9): se deschide în orice editor de text. ----------
// Bara oblică inversă e scrisă cu String.fromCharCode(92), ca să nu fie stricată de unelte.
const B = String.fromCharCode(92);
/** Textul cu acoladele și bara inversă scăpate; literele din afara ASCII ca \uN? (cu N cu semn, pe 16 biți). */
export function rtfEscape(s: string): string {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (ch === B || ch === '{' || ch === '}') out += B + ch;
    else if (c === 9) out += B + 'tab ';
    else if (c === 10 || c === 13) out += B + 'line ';
    else if (c < 128) out += ch;
    else if (c <= 0xffff) out += `${B}u${c > 32767 ? c - 65536 : c}?`;
    else { const h = Math.floor((c - 0x10000) / 0x400) + 0xd800, l = ((c - 0x10000) % 0x400) + 0xdc00; out += `${B}u${h - 65536}?${B}u${l - 65536}?`; }
  }
  return out;
}

/** Mărimea în pixeli a unei poze PNG (antetul IHDR) sau JPEG (primul segment SOF); null dacă nu se poate citi. */
export function pictureSize(b: Uint8Array): { w: number; h: number } | null {
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50) return { w: (b[16] << 24 | b[17] << 16 | b[18] << 8 | b[19]) >>> 0, h: (b[20] << 24 | b[21] << 16 | b[22] << 8 | b[23]) >>> 0 };
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: b[i + 7] << 8 | b[i + 8], h: b[i + 5] << 8 | b[i + 6] };
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    i += 2 + (b[i + 2] << 8 | b[i + 3]);
  }
  return null;
}

/** O poză PNG / JPEG din document (data: URL) ca grup RTF pict, cu lățimea afișată (px, 1 px = 15 twips); altfel ''. */
export function rtfPicture(src: string, width: number): string {
  const m = /^data:image\/(png|jpe?g);base64,/i.exec(src);
  if (!m) return '';
  let bin: string;
  try { bin = atob(src.slice(m[0].length)); } catch { return ''; }
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const size = pictureSize(bytes);
  if (!size || !size.w || !size.h) return '';
  const gw = Math.round((width > 0 ? width : size.w) * 15), gh = Math.round(gw * size.h / size.w);
  let hex = '';
  for (let k = 0; k < bytes.length; k++) { hex += bytes[k].toString(16).padStart(2, '0'); if (k % 64 === 63) hex += '\n'; }
  const kind = m[1].toLowerCase() === 'png' ? 'pngblip' : 'jpegblip';
  return `{${B}pict${B}${kind}${B}picw${size.w}${B}pich${size.h}${B}picwgoal${gw}${B}pichgoal${gh}\n${hex}}`;
}

/** Documentul Docs (JSON) ca RTF: paragrafe, titluri, aldin / cursiv / subliniat / tăiat, indici, legături, liste, tabele cu chenar,
 *  citate, salturi de pagină și pozele PNG / JPEG. */
export function docJsonToRtf(doc: JSONContent): string {
  const inline = (nodes: JSONContent[] = []): string => nodes.map((n) => {
    if (n.type === 'hardBreak') return B + 'line ';
    if (n.type === 'tabChar') return B + 'tab ';
    if (n.type === 'citation') return rtfEscape(citeTextJson(n));
    if (n.type !== 'text') return inline(n.content);
    let s = rtfEscape(n.text ?? '');
    for (const m of n.marks ?? []) {
      const cw = ({ bold: 'b', italic: 'i', underline: 'ul', strike: 'strike', subscript: 'sub', superscript: 'super' } as Record<string, string>)[m.type];
      if (cw) s = `{${B}${cw} ${s}}`;
      else if (m.type === 'link' && m.attrs?.href) s = `{${B}field{${B}*${B}fldinst HYPERLINK "${rtfEscape(String(m.attrs.href)).replace(/"/g, '')}"}{${B}fldrslt{${B}ul ${s}}}}`;
    }
    return s;
  }).join('');
  const SIZE = [0, 40, 32, 26, 24, 22, 22];
  const para = (text: string, li = 0, extra = '') => `${B}pard${B}sa120${li ? `${B}li${li}` : ''}${extra} ${text}${B}par\n`;
  const block = (n: JSONContent, li = 0): string => {
    const kids = (ind = li) => (n.content ?? []).map((c) => block(c, ind)).join('');
    switch (n.type) {
      case 'paragraph': return para(inline(n.content), li);
      case 'heading': {
        const l = Math.max(1, Math.min(6, Number(n.attrs?.level) || 1));
        return `${B}pard${B}sb240${B}sa120${B}keepn${li ? `${B}li${li}` : ''} {${B}b${B}fs${SIZE[l]} ${inline(n.content)}}${B}par\n`;
      }
      case 'bulletList': case 'orderedList': case 'taskList': {
        let k = Number(n.attrs?.start) || 1;
        return (n.content ?? []).map((item) => {
          const mark = n.type === 'orderedList' ? `${k++}.` : n.type === 'taskList' ? (item.attrs?.checked ? `${B}u9746?` : `${B}u9744?`) : `${B}u8226?`;
          const ind = li + 360;
          return (item.content ?? []).map((c, j) => {
            if (c.type === 'bulletList' || c.type === 'orderedList' || c.type === 'taskList') return block(c, ind);
            if (j === 0 && (c.type === 'paragraph' || c.type === 'heading')) return para(`${mark}${B}tab ${inline(c.content)}`, ind, `${B}fi-360${B}tx${ind}`);
            return block(c, ind);
          }).join('');
        }).join('');
      }
      case 'blockquote': return kids(li + 720);
      case 'table': {
        const rows = n.content ?? [];
        const cols = Math.max(1, ...rows.map((r) => (r.content ?? []).length));
        const w = Math.floor(9000 / cols);
        const edge = ['t', 'l', 'b', 'r'].map((s) => `${B}clbrdr${s}${B}brdrs${B}brdrw10`).join('');
        return rows.map((r) => {
          const cells = r.content ?? [];
          let out = `${B}trowd${B}trgaph108${li ? `${B}trleft${li}` : ''}`;
          cells.forEach((_, k) => { out += `${edge}${B}cellx${li + (k + 1) * w}`; });
          out += '\n';
          for (const cell of cells) {
            const head = cell.type === 'tableHeader';
            const text = (cell.content ?? []).map((p) => inline(p.content)).join(B + 'line ');
            out += `${B}pard${B}intbl ${head ? `{${B}b ${text}}` : text}${B}cell\n`;
          }
          return out + B + 'row\n';
        }).join('') + `${B}pard${B}par\n`;
      }
      case 'pageBreak': return `${B}page\n`;
      // În .rtf: \sect (secțiune nouă), cu felul ei (\sbknone = continuu, \sbkeven / \sbkodd = pagină pară / impară).
      case 'sectionBreak': { const k = sectionKind(n.attrs?.kind); return `${B}sect${B}sectd${B}sbk${k === 'continuous' ? 'none' : k === 'evenPage' ? 'even' : k === 'oddPage' ? 'odd' : 'page'}\n`; }
      case 'horizontalRule': return `${B}pard${B}brdrb${B}brdrs${B}brdrw10${B}brsp20 ${B}par\n`;
      case 'image': {
        const pict = rtfPicture(String(n.attrs?.src ?? ''), Number(n.attrs?.width) || 0);
        return (pict ? para(pict, li, `${B}qc`) : '') + (n.attrs?.caption ? para(`{${B}i ${rtfEscape(String(n.attrs.caption))}}`, li) : '');
      }
      case 'tableOfContents': return '';
      default: return kids();
    }
  };
  return `{${B}rtf1${B}ansi${B}ansicpg1252${B}deff0${B}uc1{${B}fonttbl{${B}f0${B}fswiss Calibri;}}\n`
    + `{${B}*${B}generator Cyber Office Studio;}${B}viewkind4${B}f0${B}fs22\n`
    + (doc.content ?? []).map((c) => block(c)).join('') + '}\n';
}
