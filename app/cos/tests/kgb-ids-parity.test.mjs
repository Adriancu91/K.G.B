// K.G.B. only (7.4m-2), not copied from COS: the spreadsheet window's =VALIDCUI / =VALIDIBAN / =VALIDCNP
// (src/sheets/ids.ts) give the answers of the shared list crates/kgb-core/tests/data/ids.json, which the core's
// rule (kgb_core::ids, crates/kgb-core/tests/ids.rs) checks too: the two cannot drift apart.
// Use (in app/cos/): node --import ./hooks.mjs tests/kgb-ids-parity.test.mjs
import { readFileSync } from 'node:fs';

const { validCnp, validCui, validIban } = await import('../src/sheets/ids.ts');
const list = JSON.parse(readFileSync(new URL('../../../crates/kgb-core/tests/data/ids.json', import.meta.url), 'utf8'));
const check = { cui: validCui, iban: validIban, cnp: validCnp };
let fail = 0;
list.rows.forEach((r, i) => {
  const got = check[r.kind](r.code);
  // The CNPs are made up; still, only the kind and the position are printed.
  if (got !== r.valid) {
    console.log(`GREȘIT ${r.kind} #${i}: ${got} (trebuia ${r.valid})`);
    fail++;
  }
});
console.log(fail ? `${fail} greșite` : `ok: ${list.rows.length} coduri, aceleași răspunsuri ca nucleul`);
process.exit(fail ? 1 : 0);
