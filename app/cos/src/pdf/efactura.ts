// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Vizualizator e-Factura: fișierul XML (UBL 2.1, RO_CIUS) descărcat din SPV, sau arhiva ZIP de acolo, devine o factură
// lizibilă, ca PDF. Totul se face local. PDF-ul e doar o reprezentare vizuală: documentul cu valoare legală rămâne XML-ul.
// Nu verificăm conformitatea cu regulile ANAF și nici semnătura Ministerului Finanțelor din arhivă.
import fontkit from '@pdf-lib/fontkit';
import regularUrl from 'pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf?url';
import boldUrl from 'pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf?url';
import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib';

export interface Party {
  name: string;
  cui: string;
  regCom: string;
  address: string[];
  contact: string[];
}

export interface Line {
  nr: string;
  name: string;
  description: string;
  unit: string;
  qty: number;
  price: number;
  value: number;
  vat: string;
}

export interface Invoice {
  credit: boolean;
  typeCode: string;
  id: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  supplier: Party;
  customer: Party;
  payment: string[];
  lines: Line[];
  /** Reduceri (cu minus) și taxe suplimentare la nivelul facturii. */
  extras: { label: string; amount: number }[];
  vat: { label: string; base: number; amount: number }[];
  totals: { net: number; vat: number; gross: number; prepaid: number; payable: number };
  vatInLei: number | null;
  notes: string[];
}

// Căutăm după numele local al elementelor, ca prefixele (cbc:, cac: sau altele) să nu conteze.
const kids = (el: Element | null | undefined, name: string): Element[] =>
  el ? [...el.children].filter((c) => c.localName === name) : [];
const kid = (el: Element | null | undefined, ...path: string[]): Element | null => {
  let cur: Element | null | undefined = el;
  for (const p of path) { cur = kids(cur, p)[0]; if (!cur) return null; }
  return cur ?? null;
};
const txt = (el: Element | null | undefined, ...path: string[]) => (kid(el, ...path)?.textContent ?? '').trim();
const num = (el: Element | null | undefined, ...path: string[]) => {
  const v = parseFloat(txt(el, ...path));
  return Number.isFinite(v) ? v : 0;
};

const COUNTIES: Record<string, string> = {
  AB: 'Alba', AR: 'Arad', AG: 'Argeș', BC: 'Bacău', BH: 'Bihor', BN: 'Bistrița-Năsăud', BT: 'Botoșani', BV: 'Brașov',
  BR: 'Brăila', B: 'București', BZ: 'Buzău', CS: 'Caraș-Severin', CL: 'Călărași', CJ: 'Cluj', CT: 'Constanța',
  CV: 'Covasna', DB: 'Dâmbovița', DJ: 'Dolj', GL: 'Galați', GR: 'Giurgiu', GJ: 'Gorj', HR: 'Harghita', HD: 'Hunedoara',
  IL: 'Ialomița', IS: 'Iași', IF: 'Ilfov', MM: 'Maramureș', MH: 'Mehedinți', MS: 'Mureș', NT: 'Neamț', OT: 'Olt',
  PH: 'Prahova', SM: 'Satu Mare', SJ: 'Sălaj', SB: 'Sibiu', SV: 'Suceava', TR: 'Teleorman', TM: 'Timiș', TL: 'Tulcea',
  VS: 'Vaslui', VL: 'Vâlcea', VN: 'Vrancea',
};

const UNITS: Record<string, string> = {
  H87: 'buc', C62: 'buc', EA: 'buc', XPP: 'buc', PCE: 'buc', SET: 'set', KGM: 'kg', GRM: 'g', TNE: 't', MTR: 'm',
  KMT: 'km', MTK: 'mp', MTQ: 'mc', LTR: 'l', HUR: 'ore', DAY: 'zile', MON: 'luni', ANN: 'ani', KWH: 'kWh', PR: 'perechi',
  XBX: 'cutii', XPK: 'pachete', XPA: 'pachete', XRO: 'role', XBO: 'sticle', ACT: 'activitate', LS: 'serviciu',
};

const TYPES: Record<string, string> = {
  '380': 'FACTURĂ', '381': 'NOTĂ DE CREDIT', '384': 'FACTURĂ CORECTATĂ', '389': 'AUTOFACTURĂ', '751': 'FACTURĂ (informații contabile)',
};

const VAT_CATS: Record<string, string> = {
  S: 'cota standard', Z: 'cota zero', E: 'scutit', AE: 'taxare inversă', K: 'livrare intracomunitară', G: 'export',
  O: 'neplătitor de TVA',
};

/** 1234.5 → „1.234,50” (format românesc). */
export const money = (v: number) => v.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' } as unknown as Intl.NumberFormatOptions);
const qtyText = (v: number) => v.toLocaleString('ro-RO', { maximumFractionDigits: 4, useGrouping: 'always' } as unknown as Intl.NumberFormatOptions);
/** 2026-03-15 → 15.03.2026. */
const dateText = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : s;
};

function party(el: Element | null): Party {
  const p = kid(el, 'Party');
  const legal = kid(p, 'PartyLegalEntity');
  const name = txt(legal, 'RegistrationName') || txt(p, 'PartyName', 'Name');
  // CUI: din PartyTaxScheme (RO…, pentru plătitorii de TVA), altfel din PartyLegalEntity sau PartyIdentification.
  const cui = txt(p, 'PartyTaxScheme', 'CompanyID') || txt(legal, 'CompanyID') || txt(p, 'PartyIdentification', 'ID');
  const legalId = txt(legal, 'CompanyID');
  const regCom = legalId && legalId !== cui ? legalId : '';
  const a = kid(p, 'PostalAddress');
  const street = [txt(a, 'StreetName'), txt(a, 'AdditionalStreetName'), ...kids(a, 'AddressLine').map((l) => txt(l, 'Line'))]
    .filter(Boolean).join(', ');
  const sub = txt(a, 'CountrySubentity');
  const county = COUNTIES[sub.replace(/^RO-/i, '').toUpperCase()] ?? sub;
  // În București, orașul e scris „SECTOR1”…„SECTOR6”.
  const city = txt(a, 'CityName').replace(/^sector\s*(\d)$/i, 'Sector $1');
  const country = txt(a, 'Country', 'IdentificationCode');
  const place = [city, county && county !== city ? (county === 'București' ? 'București' : `jud. ${county}`) : '', txt(a, 'PostalZone'),
    country && country !== 'RO' ? country : ''].filter(Boolean).join(', ');
  const c = kid(p, 'Contact');
  const contact = [txt(c, 'Name'), txt(c, 'Telephone') && `Tel. ${txt(c, 'Telephone')}`, txt(c, 'ElectronicMail')].filter(Boolean);
  return { name, cui, regCom, address: [street, place].filter(Boolean), contact };
}

/** Citește XML-ul unei facturi (Invoice) sau note de credit (CreditNote) UBL. */
export function parseInvoice(xml: string): Invoice {
  const dom = new DOMParser().parseFromString(xml, 'application/xml');
  if (dom.getElementsByTagName('parsererror').length) throw new Error('Fișierul nu e un XML valid.');
  const root = dom.documentElement;
  if (root.localName !== 'Invoice' && root.localName !== 'CreditNote') {
    throw new Error('Fișierul XML nu e o factură electronică (e-Factura / UBL). Poate e fișierul cu semnătura din arhivă?');
  }
  const credit = root.localName === 'CreditNote';
  const typeCode = txt(root, credit ? 'CreditNoteTypeCode' : 'InvoiceTypeCode');
  const currency = txt(root, 'DocumentCurrencyCode') || 'RON';
  const lines: Line[] = kids(root, credit ? 'CreditNoteLine' : 'InvoiceLine').map((l, i) => {
    const q = kid(l, credit ? 'CreditedQuantity' : 'InvoicedQuantity');
    const unitCode = q?.getAttribute('unitCode') ?? '';
    const item = kid(l, 'Item');
    const cat = kid(item, 'ClassifiedTaxCategory');
    const pct = txt(cat, 'Percent');
    const base = num(l, 'Price', 'BaseQuantity') || 1;
    return {
      nr: txt(l, 'ID') || String(i + 1),
      name: txt(item, 'Name'),
      description: txt(item, 'Description'),
      unit: UNITS[unitCode] ?? unitCode,
      qty: parseFloat(q?.textContent ?? '') || 0,
      price: num(l, 'Price', 'PriceAmount') / base,
      value: num(l, 'LineExtensionAmount'),
      vat: pct ? `${qtyText(parseFloat(pct))}%` : (VAT_CATS[txt(cat, 'ID')] ?? txt(cat, 'ID')),
    };
  });
  const extras = kids(root, 'AllowanceCharge').map((a) => {
    const charge = txt(a, 'ChargeIndicator') === 'true';
    return { label: txt(a, 'AllowanceChargeReason') || (charge ? 'Taxă suplimentară' : 'Reducere'), amount: (charge ? 1 : -1) * num(a, 'Amount') };
  });
  // Pot fi două TaxTotal: unul în moneda facturii (cu detalii) și unul în lei, doar cu suma.
  const taxTotals = kids(root, 'TaxTotal');
  const main = taxTotals.find((t) => kid(t, 'TaxAmount')?.getAttribute('currencyID') === currency) ?? taxTotals[0];
  const vat = kids(main, 'TaxSubtotal').map((s) => {
    const cat = kid(s, 'TaxCategory');
    const pct = txt(cat, 'Percent');
    const code = txt(cat, 'ID');
    const reason = txt(cat, 'TaxExemptionReason');
    const label = code === 'S' || (pct && parseFloat(pct) > 0) ? `TVA ${qtyText(parseFloat(pct) || 0)}%` : `TVA ${VAT_CATS[code] ?? code}${reason ? ` (${reason})` : ''}`;
    return { label, base: num(s, 'TaxableAmount'), amount: num(s, 'TaxAmount') };
  });
  const lei = currency !== 'RON' ? taxTotals.find((t) => kid(t, 'TaxAmount')?.getAttribute('currencyID') === 'RON') : undefined;
  const m = kid(root, 'LegalMonetaryTotal');
  const pm = kids(root, 'PaymentMeans').flatMap((p) => {
    const acc = kid(p, 'PayeeFinancialAccount');
    const iban = txt(acc, 'ID');
    const bank = txt(acc, 'Name') || txt(acc, 'FinancialInstitutionBranch', 'Name');
    return iban ? [`IBAN ${iban}${bank ? `, ${bank}` : ''}`] : [];
  });
  const terms = txt(root, 'PaymentTerms', 'Note');
  return {
    credit,
    typeCode,
    id: txt(root, 'ID'),
    issueDate: dateText(txt(root, 'IssueDate')),
    dueDate: dateText(txt(root, 'DueDate') || txt(root, 'PaymentMeans', 'PaymentDueDate')),
    currency,
    supplier: party(kid(root, 'AccountingSupplierParty')),
    customer: party(kid(root, 'AccountingCustomerParty')),
    payment: [...pm, ...(terms ? [terms] : [])],
    lines,
    extras,
    vat,
    totals: {
      net: num(m, 'TaxExclusiveAmount'),
      vat: num(main, 'TaxAmount'),
      gross: num(m, 'TaxInclusiveAmount'),
      prepaid: num(m, 'PrepaidAmount'),
      payable: num(m, 'PayableAmount'),
    },
    vatInLei: lei ? num(lei, 'TaxAmount') : null,
    notes: kids(root, 'Note').map((n) => (n.textContent ?? '').trim()).filter(Boolean),
  };
}

/** Din XML sau din arhiva ZIP descărcată din SPV (factura + semnătura), scoate textul facturii. */
export async function invoiceXml(data: Uint8Array): Promise<string> {
  if (data[0] === 0x50 && data[1] === 0x4b) {
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(data);
    const files = Object.values(zip.files).filter((f) => !f.dir && /\.xml$/i.test(f.name));
    for (const f of files) {
      const s = await f.async('string');
      if (/<([\w-]+:)?(Invoice|CreditNote)[\s>]/.test(s)) return s;
    }
    throw new Error('Arhiva nu conține o factură electronică (XML).');
  }
  return new TextDecoder('utf-8').decode(data).replace(/^﻿/, '');
}

const A4: [number, number] = [595.28, 841.89];
const M = 40;
const INK = rgb(0.1, 0.1, 0.12);
const GRAY = rgb(0.42, 0.42, 0.46);
const RULE = rgb(0.8, 0.8, 0.84);
const HEAD = rgb(0.92, 0.94, 0.97);

/** Rupe textul pe rânduri care încap în lățimea dată. */
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) { line = next; continue; }
      if (line) out.push(line);
      // Un cuvânt mai lung decât rândul se taie.
      let w = word;
      while (font.widthOfTextAtSize(w, size) > width && w.length > 1) {
        let k = w.length - 1;
        while (k > 1 && font.widthOfTextAtSize(w.slice(0, k), size) > width) k--;
        out.push(w.slice(0, k));
        w = w.slice(k);
      }
      line = w;
    }
    out.push(line);
  }
  return out;
}

/** Desenează factura ca PDF A4 (cu fonturi care au ă, â, î, ș, ț). */
export async function invoicePdf(inv: Invoice): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const [reg, bold] = await Promise.all([regularUrl, boldUrl].map(async (u) => doc.embedFont(await (await fetch(u)).arrayBuffer(), { subset: true })));
  const title = inv.credit ? 'NOTĂ DE CREDIT' : TYPES[inv.typeCode] ?? 'FACTURĂ';
  doc.setTitle(`${title} ${inv.id}`);
  doc.setCreator('Cyber Office Studio');
  const W = A4[0] - 2 * M;
  let page: PDFPage = doc.addPage(A4);
  let y = A4[1] - M;
  const text = (s: string, x: number, size = 9, font = reg, color = INK) => page.drawText(s, { x, y, size, font, color });
  const right = (s: string, xr: number, size = 9, font = reg) => page.drawText(s, { x: xr - font.widthOfTextAtSize(s, size), y, size, font, color: INK });

  // Antet: titlul, numărul și datele.
  text(title, M, 18, bold);
  right(`Nr. ${inv.id}`, M + W, 12, bold);
  y -= 16;
  right(`Data emiterii: ${inv.issueDate}`, M + W, 9);
  if (inv.dueDate) { y -= 12; right(`Scadența: ${inv.dueDate}`, M + W, 9); }
  y -= 12;
  right(`Moneda: ${inv.currency}`, M + W, 9);
  y -= 22;

  // Furnizor și client, pe două coloane.
  const colW = (W - 20) / 2;
  const block = (label: string, p: Party, extra: string[]) => {
    const rows: { s: string; font: PDFFont; size: number; color?: typeof INK }[] = [{ s: label, font: bold, size: 8, color: GRAY }];
    for (const l of wrap(p.name || '—', bold, 10, colW)) rows.push({ s: l, font: bold, size: 10 });
    const info = [p.cui && `CUI/CIF: ${p.cui}`, p.regCom && `Reg. Com.: ${p.regCom}`, ...p.address, ...p.contact, ...extra].filter(Boolean) as string[];
    for (const i of info) for (const l of wrap(i, reg, 9, colW)) rows.push({ s: l, font: reg, size: 9 });
    return rows;
  };
  const left = block('FURNIZOR', inv.supplier, inv.payment);
  const rightRows = block('CLIENT', inv.customer, []);
  const top = y;
  let bottom = y;
  for (const [rows, x] of [[left, M], [rightRows, M + colW + 20]] as const) {
    y = top;
    for (const r of rows) { text(r.s, x, r.size, r.font, r.color); y -= r.size + 3.5; }
    bottom = Math.min(bottom, y);
  }
  y = bottom - 14;

  // Tabelul cu produse și servicii.
  const cols = [
    { h: 'Nr.', w: 24, align: 'l' },
    { h: 'Denumire', w: W - 24 - 40 - 50 - 70 - 75 - 40, align: 'l' },
    { h: 'U.M.', w: 40, align: 'l' },
    { h: 'Cant.', w: 50, align: 'r' },
    { h: 'Preț unitar', w: 70, align: 'r' },
    { h: 'Valoare', w: 75, align: 'r' },
    { h: 'TVA', w: 40, align: 'r' },
  ];
  const xs: number[] = [];
  cols.reduce((x, c) => { xs.push(x); return x + c.w; }, M);
  const header = () => {
    page.drawRectangle({ x: M, y: y - 5, width: W, height: 17, color: HEAD });
    cols.forEach((c, i) => (c.align === 'r' ? right(c.h, xs[i] + c.w - 3, 8, bold) : text(c.h, xs[i] + 3, 8, bold)));
    y -= 20;
  };
  const footerSpace = 50;
  const newPage = () => { page = doc.addPage(A4); y = A4[1] - M; };
  header();
  for (const l of inv.lines) {
    const nameW = cols[1].w - 6;
    const nameLines = wrap(l.name || '—', reg, 9, nameW);
    const descLines = l.description && l.description !== l.name ? wrap(l.description, reg, 7.5, nameW) : [];
    const h = nameLines.length * 11 + descLines.length * 9.5 + 5;
    if (y - h < M + footerSpace) { newPage(); header(); }
    const vals = [l.nr, '', l.unit, qtyText(l.qty), money(l.price), money(l.value), l.vat];
    vals.forEach((v, i) => { if (i !== 1 && v) (cols[i].align === 'r' ? right(v, xs[i] + cols[i].w - 3) : text(v, xs[i] + 3)); });
    const y0 = y;
    for (const s of nameLines) { text(s, xs[1] + 3); y -= 11; }
    for (const s of descLines) { text(s, xs[1] + 3, 7.5, reg, GRAY); y -= 9.5; }
    y = Math.min(y, y0 - 11) - 2;
    page.drawLine({ start: { x: M, y: y + 6 }, end: { x: M + W, y: y + 6 }, thickness: 0.5, color: RULE });
    y -= 3;
  }

  // Totalurile, aliniate la dreapta.
  const totalRows: { l: string; v: number; strong?: boolean }[] = [
    ...inv.extras.map((e) => ({ l: e.label, v: e.amount })),
    { l: 'Total fără TVA', v: inv.totals.net },
    ...inv.vat.map((v) => ({ l: `${v.label} (bază ${money(v.base)})`, v: v.amount })),
    { l: 'Total TVA', v: inv.totals.vat },
    { l: 'Total cu TVA', v: inv.totals.gross },
    ...(inv.totals.prepaid ? [{ l: 'Achitat în avans', v: -inv.totals.prepaid }] : []),
    { l: 'TOTAL DE PLATĂ', v: inv.totals.payable, strong: true },
  ];
  const needed = totalRows.length * 14 + 20 + (inv.vatInLei !== null ? 14 : 0);
  if (y - needed < M + footerSpace) newPage();
  y -= 10;
  for (const r of totalRows) {
    const f = r.strong ? bold : reg, size = r.strong ? 11 : 9;
    if (r.strong) {
      y -= 5;
      page.drawLine({ start: { x: M + W - 260, y: y + size + 4 }, end: { x: M + W, y: y + size + 4 }, thickness: 0.8, color: INK });
    }
    right(r.l, M + W - 100, size, f);
    right(`${money(r.v)} ${inv.currency}`, M + W, size, f);
    y -= size + 5;
  }
  if (inv.vatInLei !== null) { right(`TVA în lei: ${money(inv.vatInLei)} RON`, M + W, 9); y -= 14; }

  // Observații.
  if (inv.notes.length) {
    y -= 10;
    if (y < M + footerSpace + 30) newPage();
    text('Observații', M, 9, bold);
    y -= 13;
    for (const n of inv.notes) for (const s of wrap(n, reg, 8.5, W)) {
      if (y < M + footerSpace) newPage();
      text(s, M, 8.5);
      y -= 11;
    }
  }

  // Subsolul fiecărei pagini.
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: M + 18 }, end: { x: M + W, y: M + 18 }, thickness: 0.5, color: RULE });
    p.drawText('Reprezentare vizuală a facturii electronice (e-Factura), făcută local de Cyber Office Studio. Documentul cu valoare legală este fișierul XML.',
      { x: M, y: M + 6, size: 7, font: reg, color: GRAY });
    const s = `Pagina ${i + 1} din ${pages.length}`;
    p.drawText(s, { x: M + W - reg.widthOfTextAtSize(s, 7), y: M - 4, size: 7, font: reg, color: GRAY });
  });
  return doc.save();
}
