// 8.1: the licences of everything shipped with K.G.B. (Rust crates in the program, JavaScript packages in the
// window), with the exact licence of the version used and the licence texts found in each package.
//
// Writes:
// - app/src-tauri/THIRD-PARTY-NOTICES.txt: the attributions shipped with the installer and shown in „Diagnostic”;
// - docs/LICENTE_COMPONENTE.md: the summary (counts per licence, what needs attention).
// Exits with 1 if a component has no licence, or a licence outside the accepted list (a decision is needed then).
//
// Usage (from the repository root): node tools/licenses.mjs
// Reads only: `cargo tree`, `cargo metadata`, app/package-lock.json, the packages on disk. Sends nothing anywhere.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const TARGET = "x86_64-pc-windows-msvc";
const OWN = "LicenseRef-Kronos-Proprietary";
/** Licence identifiers accepted without a new decision (permissive, or MPL-2.0 accepted in D-021). */
const OK = new Set(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "Zlib", "Unlicense", "CC0-1.0", "MIT-0", "0BSD", "Unicode-3.0", "BSL-1.0", "CDLA-Permissive-2.0", "Python-2.0", "BlueOak-1.0.0", "MPL-2.0", "BSD", "LLVM-exception", "Apache-2.0 WITH LLVM-exception"]);
/** Copyleft or file-level copyleft: listed apart, with what it asks. */
const WEAK = new Set(["MPL-2.0"]);

const big = { maxBuffer: 512 * 1024 * 1024, encoding: "utf8" };

/** The ids of an SPDX-like expression ("MIT OR Apache-2.0", "MIT/Apache-2.0", "(A AND B)"). */
function ids(expr) {
  return expr
    .replace(/Apache-2\.0 WITH LLVM-exception/g, "Apache-2.0_WITH_LLVM")
    .split(/\s+OR\s+|\s+AND\s+|\/|\(|\)/)
    .map((s) => s.trim().replace("Apache-2.0_WITH_LLVM", "Apache-2.0 WITH LLVM-exception"))
    .filter(Boolean);
}
/** An OR expression is fine if one choice is fine; AND needs all. */
function accepted(expr) {
  const e = expr.replace(/[()]/g, " ");
  if (/\sAND\s/.test(e) && !/\sOR\s/.test(e)) return ids(expr).every((i) => OK.has(i));
  return ids(expr).some((i) => OK.has(i) && !WEAK.has(i)) || ids(expr).every((i) => OK.has(i));
}
const onlyWeak = (expr) => !ids(expr).some((i) => OK.has(i) && !WEAK.has(i)) && ids(expr).some((i) => WEAK.has(i));

function texts(dir) {
  if (!dir || !existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^(licen[cs]e|copying|notice|unlicense)/i.test(f))
    .sort()
    .flatMap((f) => {
      try {
        return [{ file: f, text: readFileSync(join(dir, f), "utf8").replace(/\r\n/g, "\n").trim() }];
      } catch {
        return [];
      }
    });
}

// Rust: the crates in the program (normal dependencies for Windows), with their folders.
const tree = execFileSync("cargo", ["tree", "-p", "kgb-app", "-e", "normal", "--target", TARGET, "--prefix", "none", "--format", "{p}|{l}"], big);
const inTree = new Map();
for (const line of tree.split("\n")) {
  const m = /^(\S+) v(\S+)[^|]*\|(.*)$/.exec(line.trim());
  if (m) inTree.set(`${m[1]}@${m[2]}`, m[3].trim());
}
const meta = JSON.parse(execFileSync("cargo", ["metadata", "--format-version", "1", "--filter-platform", TARGET], big));
const rust = [];
for (const p of meta.packages) {
  const key = `${p.name}@${p.version}`;
  if (!inTree.has(key)) continue;
  const lic = p.license ?? inTree.get(key) ?? "";
  if (lic === OWN) continue;
  rust.push({ kind: "Rust", name: p.name, version: p.version, license: lic, repo: p.repository ?? "", texts: texts(dirname(p.manifest_path)) });
}

// JavaScript: the packages the window ships (not the build tools).
const lock = JSON.parse(readFileSync("app/package-lock.json", "utf8"));
const js = [];
for (const [path, v] of Object.entries(lock.packages)) {
  if (!path || v.dev || v.link) continue;
  const name = path.replace(/^.*node_modules\//, "");
  const lic = typeof v.license === "string" ? v.license : v.license ? JSON.stringify(v.license) : "";
  js.push({ kind: "JavaScript", name, version: v.version, license: lic, repo: "", texts: texts(join("app", path)) });
}

const all = [...rust, ...js].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
const unknown = all.filter((c) => !c.license);
const refused = all.filter((c) => c.license && !accepted(c.license));
const weak = all.filter((c) => c.license && onlyWeak(c.license));
const noText = all.filter((c) => c.texts.length === 0);

// The notices file: each licence text once, with the components that ship it.
const byText = new Map();
for (const c of all) {
  for (const t of c.texts) {
    const k = t.text;
    if (!byText.has(k)) byText.set(k, []);
    byText.get(k).push(`${c.name} ${c.version}`);
  }
}
let out = `K.G.B. — componente terțe și licențele lor / third-party components and their licences
Generat de tools/licenses.mjs din Cargo.lock și app/package-lock.json. Componente: ${all.length} (${rust.length} Rust, ${js.length} JavaScript).

=== Lista componentelor / component list ===
`;
for (const c of all) out += `${c.kind}\t${c.name} ${c.version}\t${c.license || "(fără licență declarată)"}${c.repo ? `\t${c.repo}` : ""}\n`;
if (noText.length) {
  out += `\n=== Componente fără fișier de licență în pachet (se aplică textul standard al licenței declarate) / components without a licence file (the standard text of the declared licence applies) ===\n`;
  for (const c of noText) out += `${c.name} ${c.version}\t${c.license}\n`;
}
out += `\n=== Textele licențelor / licence texts ===\n`;
for (const [text, who] of byText) {
  out += `\n----------------------------------------------------------------------\n${who.join(", ")}\n----------------------------------------------------------------------\n${text}\n`;
}
writeFileSync("app/src-tauri/THIRD-PARTY-NOTICES.txt", out);

// The summary for the documents.
const count = new Map();
for (const c of all) count.set(c.license || "(lipsă)", (count.get(c.license || "(lipsă)") ?? 0) + 1);
const rows = [...count].sort((a, b) => b[1] - a[1]).map(([l, n]) => `| ${l} | ${n} |`).join("\n");
const list = (v) => (v.length ? v.map((c) => `- ${c.kind}: \`${c.name}\` ${c.version} — ${c.license || "(lipsă)"}`).join("\n") : "- niciuna");
writeFileSync(
  "docs/LICENTE_COMPONENTE.md",
  `# K.G.B. — Licențele componentelor livrate (pasul 8.1)

Generat de \`node tools/licenses.mjs\` din \`Cargo.lock\` (programul, dependențele normale pentru Windows) și \`app/package-lock.json\` (pachetele ferestrei, fără uneltele de build). Fișierul cu atribuiri și textele licențelor, \`app/src-tauri/THIRD-PARTY-NOTICES.txt\`, se livrează cu installerul și se vede în „Diagnostic”.

**Componente:** ${all.length} (${rust.length} Rust, ${js.length} JavaScript). Crate-urile proprii K.G.B. nu sunt în listă.

## Pe licențe
| Licență (exact cum o declară versiunea folosită) | Componente |
|---|---|
${rows}

## De urmărit
**Fără licență declarată:**
${list(unknown)}

**Licențe în afara listei acceptate (cer o decizie):**
${list(refused)}

**Copyleft slab, la nivel de fișier (MPL-2.0, acceptat în D-021):** obligația e ca fișierele MPL, dacă le modificăm, să fie publicate. Nu le modificăm; textul licenței e în fișierul de atribuiri.
${list(weak)}

**Alegere între licențe:** unde licența e „A OR B”, K.G.B. folosește varianta permisivă (de ex. \`jszip\`: MIT, nu GPL-3.0).

**Componente fără fișier de licență în pachet:** ${noText.length}. Pentru ele se aplică textul standard al licenței declarate; sunt numite separat în fișierul de atribuiri.

## Ce nu e în această listă
- **WebView2** (Microsoft): face parte din Windows sau se instalează separat; nu e livrat în installer (D-095).
- **Fonturile și datele OCR** livrate ca fișiere (dacă există) au licența lor, în registrul \`LICENSES.md\`.
`,
);

console.log(`componente: ${all.length} (Rust ${rust.length}, JavaScript ${js.length}); fără licență: ${unknown.length}; în afara listei: ${refused.length}; MPL: ${weak.length}; fără fișier de licență: ${noText.length}`);
for (const c of [...unknown, ...refused]) console.log(`  DE VERIFICAT: ${c.kind} ${c.name} ${c.version} — ${c.license || "(lipsă)"}`);
process.exit(unknown.length || refused.length ? 1 : 0);
