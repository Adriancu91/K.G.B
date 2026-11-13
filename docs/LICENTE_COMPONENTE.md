# K.G.B. — Licențele componentelor livrate (pasul 8.1)

Generat de `node tools/licenses.mjs` din `Cargo.lock` (programul, dependențele normale pentru Windows) și `app/package-lock.json` (pachetele ferestrei, fără uneltele de build). Fișierul cu atribuiri și textele licențelor, `app/src-tauri/THIRD-PARTY-NOTICES.txt`, se livrează cu installerul și se vede în „Diagnostic”.

**Componente:** 768 (615 Rust, 153 JavaScript). Crate-urile proprii K.G.B. nu sunt în listă.

## Pe licențe
| Licență (exact cum o declară versiunea folosită) | Componente |
|---|---|
| MIT OR Apache-2.0 | 272 |
| MIT | 246 |
| Apache-2.0 OR MIT | 87 |
| Apache-2.0 | 29 |
| Unicode-3.0 | 27 |
| MIT/Apache-2.0 | 20 |
| BSD-3-Clause | 11 |
| BSD-2-Clause | 10 |
| Unlicense OR MIT | 6 |
| MPL-2.0 | 6 |
| ISC | 4 |
| Unlicense/MIT | 4 |
| MIT OR Apache-2.0 OR Zlib | 4 |
| Zlib OR Apache-2.0 OR MIT | 3 |
| Zlib | 3 |
| BSD-3-Clause OR Apache-2.0 | 3 |
| (MIT OR Apache-2.0) AND Unicode-3.0 | 3 |
| BSD-3-Clause AND MIT | 2 |
| BSD-3-Clause/MIT | 2 |
| CC0-1.0 OR MIT-0 OR Apache-2.0 | 2 |
| Apache-2.0 OR ISC OR MIT | 2 |
| MIT OR Zlib OR Apache-2.0 | 2 |
| BSD-3-Clause OR MIT OR Apache-2.0 | 2 |
| BSD-2-Clause OR Apache-2.0 OR MIT | 2 |
| Python-2.0 | 1 |
| BSD | 1 |
| (MIT OR GPL-3.0-or-later) | 1 |
| (MIT AND Zlib) | 1 |
| BlueOak-1.0.0 | 1 |
| 0BSD | 1 |
| 0BSD OR MIT OR Apache-2.0 | 1 |
| CC0-1.0 OR Apache-2.0 OR Apache-2.0 WITH LLVM-exception | 1 |
| Apache-2.0 AND MIT | 1 |
| (Apache-2.0 OR MIT) AND BSD-3-Clause | 1 |
| Apache-2.0 / MIT | 1 |
| Apache-2.0 AND ISC | 1 |
| 0BSD OR CC0-1.0 | 1 |
| Apache-2.0 OR BSL-1.0 | 1 |
| Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT | 1 |
| CDLA-Permissive-2.0 | 1 |

## De urmărit
**Fără licență declarată:**
- niciuna

**Licențe în afara listei acceptate (cer o decizie):**
- niciuna

**Copyleft slab, la nivel de fișier (MPL-2.0, acceptat în D-021):** obligația e ca fișierele MPL, dacă le modificăm, să fie publicate. Nu le modificăm; textul licenței e în fișierul de atribuiri.
- Rust: `attohttpc` 0.30.1 — MPL-2.0
- Rust: `cssparser` 0.37.0 — MPL-2.0
- Rust: `cssparser-macros` 0.7.1 — MPL-2.0
- Rust: `dtoa-short` 0.3.5 — MPL-2.0
- Rust: `option-ext` 0.2.0 — MPL-2.0
- Rust: `selectors` 0.38.0 — MPL-2.0

**Alegere între licențe:** unde licența e „A OR B”, K.G.B. folosește varianta permisivă (de ex. `jszip`: MIT, nu GPL-3.0).

**Componente fără fișier de licență în pachet:** 92. Pentru ele se aplică textul standard al licenței declarate; sunt numite separat în fișierul de atribuiri.

## Ce nu e în această listă
- **WebView2** (Microsoft): face parte din Windows sau se instalează separat; nu e livrat în installer (D-095).
- **Fonturile și datele OCR** livrate ca fișiere (dacă există) au licența lor, în registrul `LICENSES.md`.
