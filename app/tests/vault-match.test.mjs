// Test for the duplicate check between the vault and Business (src/modules/vault/match.ts): the same rules as the
// vault module (modules/kgb-vault/src/lib.rs, split_number / invoice_key / same_invoice).
// Rulare (în app/): node tests/vault-match.test.mjs
import "./ts-hooks.mjs";

const { splitNumber, keyOf, fromIssued, fromPurchase, matchesOf } = await import("../src/modules/vault/match.ts");

let fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? "ok " : "GREȘIT"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (trebuia ${JSON.stringify(want)})`}`);
  if (!ok) fail++;
};

// The same cases as the vault's own test (normalising).
eq("KGB 0012", splitNumber("KGB 0012"), ["KGB", "12"]);
eq("0012 cu seria scrisă separat", splitNumber("0012", "abc"), ["ABC", "12"]);
eq("F-2026-007", splitNumber("F-2026-007"), ["F2026", "7"]);
eq("000", splitNumber("000"), ["", "0"]);

const vault = { emitent_cui: "14399840", serie: "KGB", numar: "12", data: "2026-11-05", total: 121000 };
const issued = fromIssued({ serie: "KGB", numar: 12, data: "2026-11-05", total: 121000 }, "RO 14399840");
eq("emisă în Business: aceeași cheie", keyOf(issued), "14399840|KGB|12");
const buy = fromPurchase({ furnizor_cui: "RO18547290", numar: "ABC 0007", data: "2026-11-06", total: 5950 });
eq("cheltuială: cheia", keyOf(buy), "18547290|ABC|7");
eq("fără CUI emitent: fără cheie", keyOf(fromPurchase({ furnizor_cui: null, numar: "7", data: "", total: 1 })), null);

eq(
  "găsită în Business, sigur",
  matchesOf(vault, [{ inv: issued, where: "Business: facturi emise" }, { inv: buy, where: "Business: cheltuieli" }]),
  [{ where: "Business: facturi emise", sure: true }],
);
eq(
  "același număr, alt total: posibil",
  matchesOf(vault, [{ inv: { ...issued, total: 99900 }, where: "Business: facturi emise" }]),
  [{ where: "Business: facturi emise", sure: false, otherTotal: 99900 }],
);
eq("alt emitent: nimic", matchesOf({ ...vault, emitent_cui: "18547290" }, [{ inv: issued, where: "x" }]), []);
if (fail) process.exit(1);
console.log("toate trecute");
