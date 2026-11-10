// English for the app (7.4l-0f): finds every text of app/src that could be shown (JSX text, strings,
// templates with ${…}) and checks that the translator of Cyber Office Studio (app/cos/src/i18n.ts), with the
// app's own dictionary (src/i18n/kgb-en.json), gives it in English. The same rules as COS
// (suite/tests/i18n/extract-ro.mjs + check-ro.mjs), with oxc instead of the TypeScript compiler API.
// Writes i18n/missing.json and must end with "fără traducere: 0".
// Usage (in app/): node --import ./cos/hooks.mjs i18n/check.mjs
import fs from "node:fs";
import path from "node:path";
import { parseSync } from "rolldown/experimental";

const SRC = path.resolve("src");
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx?)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) files.push(p);
  }
})(SRC);

const RO_CH = /[ăâîșțşţĂÂÎȘȚŞŢ„”]/;
const RO_WORD =
  /\b(de|si|cu|pe|la|din|sau|un|o|ce|nu|mai|al|ale|lui|pentru|dupa|fara|toate|tot|nou|noua|alege|apasa|clic|click|aici|fisier|fisierul|pagina|foaia|foaie|celula|celule|rand|randuri|coloana|coloane|text|textul|poza|imagine|culoare|marime|stil|tabel|grafic|lista|sus|jos|stanga|dreapta|inapoi|inainte|deschide|salveaza|inchide|sterge|adauga|copiaza|lipeste|anuleaza|reface|cauta|gaseste|inlocuieste|document|forma|forme|linie|font)\b/i;
const CODEY = /^(#?[0-9a-f]{3,8}|[\w-]+(\.[\w-]+)+|[a-z]+([A-Z][a-z0-9]*)+|[\w./\\-]*\/[\w./\\-]*|[a-z0-9_-]+|[A-Z0-9_]+|\W*)$/;
const looksText = (s) => {
  const t = s.trim();
  if (t.length < 2 || !/[A-Za-zĂÂÎȘȚăâîșț]/.test(t)) return false;
  if (/^(https?:|data:|blob:|file:)/.test(t)) return false;
  if (RO_CH.test(t)) return true;
  if (CODEY.test(t)) return false;
  if (/[{};=<>]|=>|\$\{/.test(t) && !/ /.test(t)) return false;
  if (/^[.#[:]/.test(t) || /^[a-z0-9-]+( [a-z0-9-]+)+$/.test(t)) return false;
  return RO_WORD.test(t) || /^[A-ZĂÂÎȘȚ][a-zăâîșț]+( [a-zăâîșț]+)*$/.test(t);
};
const NOT_UI_ATTR = new Set(["className", "id", "key", "type", "role", "name", "htmlFor", "style", "href", "src", "accept", "autoComplete", "inputMode", "lang", "dir"]);

const out = new Map();
const add = (s, t, f) => {
  const k = (t ? "T" : "S") + s;
  const o = out.get(k);
  if (o) o.n++;
  else out.set(k, { s, t: t ? 1 : 0, f: [f], n: 1 });
};
for (const file of files) {
  const rel = path.relative(SRC, file).split(path.sep).join("/");
  const { program } = parseSync(file, fs.readFileSync(file, "utf8"));
  const visit = (node, parent) => {
    if (!node || typeof node.type !== "string") return;
    if (node.type === "ImportDeclaration" || node.type.startsWith("Export") && node.source) return;
    if (node.type === "JSXText") {
      const s = node.value.replace(/\s+/g, " ").trim();
      if (looksText(s)) add(s, 0, rel);
    } else if (node.type === "Literal" && typeof node.value === "string") {
      const isKey = parent?.type === "Property" && parent.key === node;
      const isIndex = parent?.type === "MemberExpression" && parent.computed;
      const isAttr = parent?.type === "JSXAttribute" && NOT_UI_ATTR.has(parent.name?.name);
      const isTypeOnly = parent?.type === "TSLiteralType";
      if (!isKey && !isIndex && !isAttr && !isTypeOnly && looksText(node.value)) add(node.value, 0, rel);
    } else if (node.type === "TemplateLiteral") {
      if (node.expressions.length === 0) {
        const s = node.quasis[0]?.value.cooked ?? "";
        if (looksText(s)) add(s, 0, rel);
      } else {
        let s = "";
        node.quasis.forEach((q, i) => (s += (i ? `{${i - 1}}` : "") + (q.value.cooked ?? "")));
        if (looksText(s.replace(/\{\d+\}/g, ""))) add(s, 1, rel);
      }
    }
    for (const [k, v] of Object.entries(node)) {
      if (k === "parent") continue;
      if (Array.isArray(v)) for (const c of v) visit(c, node);
      else if (v && typeof v === "object" && typeof v.type === "string") visit(v, node);
    }
  };
  visit(program, null);
}
// The core's messages (0f-2): the Romanian strings of the Rust code (errors, summaries, template names,
// sources, module manifests). They stay Romanian in the core and in saved data and are translated only on
// screen; format! slots ({}, {name}, {:.2}) become {0}, {1}… so they are checked as templates.
const RO_RS = /[ăâîșțĂÂÎȘȚ„”]|\b(nu|este|si|sau|pentru|fisierul|documentul|lipseste|exista)\b/;
const QUOTED = /"((?:[^"\\]|\\.)*)"/g;
const unesc = (s) => s.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
(function rust(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (!["target", "tests", "node_modules", "spikes", "bin", "examples"].includes(e.name)) rust(p);
      continue;
    }
    if (!p.endsWith(".rs") && !p.endsWith("manifest.json")) continue;
    const rel = path.relative(path.resolve(".."), p).split(path.sep).join("/");
    const src = fs.readFileSync(p, "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    for (const m of src.matchAll(QUOTED)) {
      if (m[1].length <= 2 || !RO_RS.test(m[1])) continue;
      let n = 0;
      const s = unesc(m[1])
        .replace(/\{\{/g, "\u0001")
        .replace(/\}\}/g, "\u0002")
        .replace(/\{[^{}]*\}/g, () => `{${n++}}`)
        .replace(/\u0001/g, "{")
        .replace(/\u0002/g, "}");
      if (s.replace(/\{\d+\}/g, "").replace(/[^\p{L}]/gu, "").length < 3) continue;
      add(s, n ? 1 : 0, rel);
    }
  }
})(path.resolve(".."));
const list = [...out.values()];

// The translator of COS, with the app's dictionary, in Node (a minimal window).
Object.assign(globalThis, {
  window: globalThis,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  alert() {},
  confirm: () => true,
  prompt: () => null,
});
const { translateAny, addExtra } = await import("../cos/src/i18n.ts");
const kgb = JSON.parse(fs.readFileSync("src/i18n/kgb-en.json", "utf8"));
addExtra([{ group: "kgb", modules: null, data: kgb }]);
const skip = new Set(kgb.skip ?? []);
const RO = /[ăâîșțşţĂÂÎȘȚŞŢ]|\b(și|sau|pentru|după|fără|din|pe|la|cu|de|nu|mai|aici|alege|apasă|clic|fișier|pagina|foaia|celula|reguli|celule|rândul|coloana|poza|deschide|salvează|închide|șterge|adaugă|caută|nou|nouă|toate)\b/i;
const miss = [];
for (const x of list) {
  if (skip.has(x.s)) continue;
  if (x.t) {
    const samples = [x.s.replace(/\{\d+\}/g, "3"), x.s.replace(/\{\d+\}/g, "raport.docx")];
    if (samples.some((s) => { const r = translateAny(s); return r !== null && !RO.test(r); })) continue;
  } else {
    const r = translateAny(x.s);
    if (r !== null && !RO.test(r)) continue;
  }
  miss.push(x);
}
fs.writeFileSync("i18n/missing.json", JSON.stringify(miss, null, 1));
// What was translated without an exact entry (by the COS dictionaries' patterns or by pieces): these
// are the ones to read, since a pattern can split a word („Stocare” → „Stockhas”). Listed apart.
const exact = (s) => s in kgb.dict || s.trim() in kgb.dict;
const byPattern = [];
for (const x of list) {
  if (skip.has(x.s) || exact(x.s) || (x.t && x.s in (kgb.templates ?? {}))) continue;
  // A template is tried with sample values, as above.
  const probe = x.t ? x.s.replace(/{(d+)}/g, (_, n) => (n === "0" ? "3" : "raport.docx")) : x.s;
  const r = translateAny(probe);
  if (r !== null && r !== probe) byPattern.push({ ro: probe, en: r, f: x.f[0] });
}
fs.writeFileSync("i18n/by-pattern.json", JSON.stringify(byPattern, null, 1));
console.log("traduse fără intrare exactă (de citit, i18n/by-pattern.json):", byPattern.length);
console.log("texte:", list.length, "· fără traducere:", miss.length);
for (const m of miss.slice(0, 30)) console.log("  ", m.f[0], "·", m.s.slice(0, 90));
process.exit(miss.length ? 1 : 0);
