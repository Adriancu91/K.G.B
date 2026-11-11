// Test for the CUI matching of „Contracte și abonamente” (src/modules/contracts/cui.ts): the contract's partner
// found among the partners of Business with or without „RO” and spaces, a person without CUI by name.
// Rulare (în app/): node tests/contracts-cui.test.mjs
import "./ts-hooks.mjs";

const { cuiKey, findBusinessPartner } = await import("../src/modules/contracts/cui.ts");

let fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? "ok " : "GREȘIT"} ${name}${ok ? "" : ` → ${JSON.stringify(got)} (trebuia ${JSON.stringify(want)})`}`);
  if (!ok) fail++;
};

eq("RO și spații", cuiKey(" ro 185 472 90 "), "18547290");
eq("fără RO", cuiKey("18547290"), "18547290");
eq("gol", cuiKey(null), "");
const biz = [
  { id: "a", nume: "Alfa Construct SRL", cui: "18547290" },
  { id: "b", nume: "Ion Popescu", cui: null },
  { id: "c", nume: "Beta SRL", cui: "RO14399840" },
];
eq("cu RO în agendă, fără RO în Business", findBusinessPartner(biz, "RO 18547290", "Alfa")?.id, "a");
eq("fără RO în agendă, cu RO în Business", findBusinessPartner(biz, "14399840", "")?.id, "c");
eq("persoană fără CUI, după nume", findBusinessPartner(biz, "", "ion  popescu")?.id, "b");
eq("CUI necunoscut: nu se ia după nume", findBusinessPartner(biz, "RO99", "Alfa Construct SRL"), undefined);
eq("fără CUI și nume necunoscut", findBusinessPartner(biz, "", "Altcineva"), undefined);
eq("fără CUI nu potrivește o firmă cu CUI", findBusinessPartner(biz, "", "Beta SRL"), undefined);
if (fail) process.exit(1);
console.log("toate trecute");
