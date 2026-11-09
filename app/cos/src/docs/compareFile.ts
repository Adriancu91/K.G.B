// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Compararea documentului deschis cu un fișier Word primit înapoi (ce a schimbat celălalt): rândurile de text din .docx.
const ch = (n: number) => String.fromCharCode(n);
const CLOSE = ch(0xe001);
/** Textul șters cu „Track Changes” nu face parte din document; marcajele de comentarii și modificări se scot. */
const DELETED = new RegExp(ch(0xe005) + '(\\d+)' + CLOSE + '[\\s\\S]*?' + ch(0xe006) + '\\1' + CLOSE, 'g');
const MARKS = new RegExp('[' + ch(0xe000) + ch(0xe002) + ch(0xe003) + ch(0xe004) + ch(0xe005) + ch(0xe006) + ']\\d*' + CLOSE, 'g');

/** Cine a lucrat ultimul la fișier și când (docProps/core.xml), pentru Combină: modificările lor poartă numele lor. */
export async function docxAuthor(data: Uint8Array): Promise<{ author: string; date: string }> {
  try {
    const JSZip = (await import('jszip')).default;
    const xml = (await (await JSZip.loadAsync(data)).file('docProps/core.xml')?.async('string')) ?? '';
    const get = (tag: string) => (xml.match(new RegExp('<' + tag + '(?:\\s[^>]*)?>([^<]*)</' + tag + '>'))?.[1] ?? '').trim();
    const name = get('cp:lastModifiedBy') || get('dc:creator');
    const date = get('dcterms:modified');
    return { author: name === 'Suite' || name === 'Cyber Office Studio' ? '' : name, date: date && !isNaN(Date.parse(date)) ? date : '' };
  } catch { return { author: '', date: '' }; }
}

export async function docxLines(data: Uint8Array): Promise<string[]> {
  const { docxToHtml } = await import('./docxImport');
  const { html } = await docxToHtml(data);
  const dom = new DOMParser().parseFromString(html.replace(DELETED, ''), 'text/html');
  const out: string[] = [];
  for (const el of dom.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, th')) {
    if (el.querySelector('p, li, td, th')) continue; // doar blocurile cele mai mici, ca să nu luăm textul de două ori
    const t = (el.textContent ?? '').replace(MARKS, '').replace(/\s+/g, ' ').trim();
    if (t) out.push(t);
  }
  return out;
}
