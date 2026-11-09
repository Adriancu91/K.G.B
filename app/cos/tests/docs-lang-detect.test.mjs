// Test: recunoașterea limbii unui paragraf (Docs → Revizuire → 🌐 Detectează limba), fără internet: română, engleză, franceză,
// germană, italiană, spaniolă și maghiară, și „nu știu” la texte prea scurte sau amestecate.
// Rulare (în suite/): node tests/docs-lang-detect.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = join(tmpdir(), `suite-lang-${process.pid}`);
await build({ entryPoints: ['src/docs/langDetect.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error', external: ['@tiptap/*'] });
const { detectLang } = await import(pathToFileURL(join(dir, 'langDetect.js')).href);
rmSync(dir, { recursive: true, force: true });

const cases = [
  ['ro', 'Contractul este semnat de ambele părți și intră în vigoare la data înregistrării.'],
  ['ro', 'Vă rugăm să trimiteți factura până la sfârșitul lunii, pentru că altfel nu putem face plata.'],
  ['ro', 'Am fost la birou si am vorbit cu colegii despre proiect, dar nu am terminat inca.'],
  ['en-US', 'The contract is signed by both parties and it will be valid from the date of registration.'],
  ['en-US', 'Please send the invoice before the end of the month, because otherwise we cannot pay it.'],
  ['fr-FR', 'Le contrat est signé par les deux parties et il entre en vigueur à la date de son enregistrement.'],
  ['de-DE', 'Der Vertrag wird von beiden Parteien unterschrieben und ist ab dem Tag der Eintragung gültig.'],
  ['it-IT', 'Il contratto è firmato dalle due parti e sarà valido dalla data della registrazione.'],
  ['es-ES', 'El contrato está firmado por las dos partes y es válido desde la fecha del registro.'],
  ['hu-HU', 'A szerződést mindkét fél aláírta, és a nyilvántartásba vétel napjától érvényes, ha nincs más megállapodás.'],
  ['pt-PT', 'O contrato é assinado pelas duas partes e não pode ser alterado sem o acordo de ambas.'],
  ['pt-PT', 'Ainda não recebemos a fatura, por isso o pagamento será feito quando ela chegar.'],
  ['nl-NL', 'Het contract wordt door beide partijen ondertekend en is geldig vanaf de datum van registratie.'],
  ['nl-NL', 'Wij hebben de factuur nog niet ontvangen, maar de betaling wordt deze week gedaan.'],
  ['pl-PL', 'Umowa jest podpisana przez obie strony i obowiązuje od dnia rejestracji.'],
  ['pl-PL', 'Nie otrzymaliśmy jeszcze faktury, ale płatność zostanie wykonana w tym tygodniu.'],
];
for (const [want, text] of cases) assert.equal(detectLang(text), want, text);
// Prea scurt sau fără cuvinte cunoscute: nu se ghicește.
assert.equal(detectLang('Hello world'), null);
assert.equal(detectLang('Cyber Office Studio 2026'), null);
assert.equal(detectLang('ABC-123 XYZ-456 QRS-789 TUV-000'), null);
assert.equal(detectLang(''), null);
console.log('OK: limba paragrafelor e recunoscută');
