// Test pentru „Caută și ascunde” — copiat din Cyber Office Studio (tests/pdf-redactfind.test.mjs, D-071): CNP (doar cu cifra de
// control bună), e-mail, telefon, IBAN, cuvinte fără diacritice / litere mari, și dreptunghiurile pe pagină citite cu pdf.js.
// Rulare (în app/): node tests/redactfind.test.mjs
import { findSensitive, findBoxes, validCnp, viewportOf } from "../src/modules/pdf/redactFind.ts";
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };
const J = (x) => JSON.stringify(x);

// Un CNP cu cifra de control calculată.
const cnpOf = (s12) => { const key = '279146358279'; let sum = 0; for (let i = 0; i < 12; i++) sum += +s12[i] * +key[i]; const c = sum % 11 === 10 ? 1 : sum % 11; return s12 + c; };
const cnp = cnpOf('180010122114');
const bad = cnp.slice(0, 12) + ((+cnp[12] + 1) % 10);
check('CNP valid / invalid', validCnp(cnp) && !validCnp(bad) && !validCnp('0800101221144'));

const text = `Subsemnatul ION POPESCU, CNP ${cnp}, cod ${bad}, e-mail: ion.popescu@exemplu.ro, tel. 0722 123 456 sau +40 21 312 34 56, cont RO49 AAAA 1B31 0075 9384 0000, dosar 1234567890123.`;
const f = findSensitive(text, ['cnp', 'email', 'phone', 'iban']);
const kinds = f.map((s) => s.kind + ':' + s.text);
check('găsește CNP-ul bun, nu și pe cel greșit', kinds.includes('cnp:' + cnp) && !kinds.some((k) => k.includes(bad)), J(kinds));
check('e-mail', kinds.includes('email:ion.popescu@exemplu.ro'), J(kinds));
check('telefoane', kinds.includes('phone:0722 123 456') && kinds.includes('phone:+40 21 312 34 56'), J(kinds));
check('IBAN cu spații', kinds.includes('iban:RO49 AAAA 1B31 0075 9384 0000'), J(kinds));
check('numărul de dosar nu e luat', !kinds.some((k) => k.includes('1234567890123')), J(kinds));
const w = findSensitive(text, ['words'], 'popescu\nședință, ion');
check('cuvinte fără litere mari', w.filter((s) => s.text === 'POPESCU').length === 1 && w.some((s) => s.text === 'ION'), J(w));
check('cuvântul din e-mail se găsește și el', w.some((s) => s.text === 'popescu'), J(w.map((s) => s.text)));
check('fără suprapuneri', findSensitive('ion.popescu@exemplu.ro', ['email', 'words'], 'popescu').length === 1);

// Dreptunghiurile pe o pagină reală: în original pagina e făcută cu pdf-lib (nu e în K.G.B.); aici e scrisă de mână,
// cu fontul standard Helvetica, și citită cu pdf.js, ca în fereastră.
const NL = String.fromCharCode(10);
const content = `BT /F1 12 Tf 50 250 Td (CNP: ${cnp}) Tj ET BT /F1 12 Tf 50 200 Td (Contact: ion@exemplu.ro) Tj ET`;
const objs = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 500 300] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
  `<< /Length ${content.length} >>${NL}stream${NL}${content}${NL}endstream`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
];
let pdfText = `%PDF-1.4${NL}`;
const offs = [];
objs.forEach((o, i) => { offs.push(pdfText.length); pdfText += `${i + 1} 0 obj${NL}${o}${NL}endobj${NL}`; });
const xref = pdfText.length;
pdfText += `xref${NL}0 ${objs.length + 1}${NL}0000000000 65535 f ${NL}` + offs.map((o) => `${String(o).padStart(10, "0")} 00000 n ${NL}`).join("") + `trailer${NL}<< /Size ${objs.length + 1} /Root 1 0 R >>${NL}startxref${NL}${xref}${NL}%%EOF`;
const doc = await pdfjs.getDocument({ data: new TextEncoder().encode(pdfText), disableFontFace: true, verbosity: 0 }).promise;
const pg = await doc.getPage(1);
const vp = pg.getViewport({ scale: 1 });
const items = (await pg.getTextContent()).items.filter((it) => 'str' in it);
const boxes = findBoxes(items, viewportOf(vp), ['cnp', 'email']); // pdf.js 6: vederea prin viewportOf
check('două dreptunghiuri', boxes.length === 2, J(boxes));
const b0 = boxes.find((b) => b.kind === 'cnp');
check('CNP: începe după „CNP: ” (nu acoperă eticheta)', b0 && b0.x > 70 && b0.x < 90, J(b0));
check('CNP: acoperă rândul (sus = 300 - 250 - 12)', b0 && b0.y < 300 - 250 - 10 && b0.y + b0.h > 300 - 250 + 1, J(b0));
const b1 = boxes.find((b) => b.kind === 'email');
check('e-mail pe rândul de jos', b1 && b1.y > b0.y + 40 && b1.x > 90, J(b1));
await doc.loadingTask.destroy(); // ca în COS c329e119: merge pe pdf.js 4 și 6

console.log(fail ? `${fail} GREȘITE` : 'TOATE TREC');
process.exit(fail ? 1 : 0);
