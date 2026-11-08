# K.G.B. — Registrul licențelor și dependențelor

Reguli (Master Plan §12.3, Metaprompt §12):
- Se verifică licența exactă a versiunii folosite, plus dependențele tranzitive.
- AGPL/GPL sau termeni speciali: doar după analiză și aprobare.
- Se păstrează notices și atribuiri.

## spikes/s1-storage (prototip, nu se distribuie)
Verificat 7 nov. 2026 cu `cargo metadata` (target `x86_64-pc-windows-msvc`). Nicio dependență nu conține un motor DB.

| Dependență | Versiune | Licență | Rol |
|---|---|---|---|
| serde / serde_core / serde_derive | 1.0.229 | MIT OR Apache-2.0 | serializare |
| serde_json | 1.0.154 | MIT OR Apache-2.0 | format JSON |
| crc32fast | 1.5.4 | MIT OR Apache-2.0 | checksum pe cadre |
| uuid | 1.29.0 | Apache-2.0 OR MIT | identificatori |
| blake3 (feature `pure`) | 1.8.7 | CC0-1.0 OR Apache-2.0 (± LLVM-exception) | hash pentru blobs/backup |
| windows-sys / windows-link | 0.61.2 / 0.2.1 | MIT OR Apache-2.0 | MoveFileExW |
| tempfile (doar teste) | 3.27.0 | MIT OR Apache-2.0 | directoare temporare |
| tranzitive: arrayvec, cc, cfg-if, constant_time_eq, cpufeatures, fastrand, find-msvc-tools, getrandom, itoa, once_cell, proc-macro2, quote, shlex, syn | — | MIT OR Apache-2.0 / CC0 / MIT-0 | — |
| memchr | 2.8.3 | Unlicense OR MIT | — |
| unicode-ident | 1.0.27 | (MIT OR Apache-2.0) AND Unicode-3.0 | — |
| zmij | 1.0.23 | MIT | — |

## spikes/s3-tauri-shell (prototip, nu se distribuie)
Verificat 6 nov. 2026: `cargo metadata` (249 crates, target `x86_64-pc-windows-msvc`) + `package.json` din `node_modules` (27 pachete npm). **Niciun motor DB.** Nicio licență GPL/AGPL.

| Dependență | Versiune | Licență | Rol |
|---|---|---|---|
| tauri / tauri-build / tauri-runtime-wry | 2.12.5 / 2.7.4 / 2.12.3 | Apache-2.0 OR MIT | cadrul aplicației desktop |
| wry / tao / webview2-com | 0.57.1 / 0.37.2 / 0.39.1 | Apache-2.0 OR MIT / Apache-2.0 / MIT | fereastră + WebView2 |
| react / react-dom | 19.3.1 | MIT | interfață |
| @tauri-apps/api / @tauri-apps/cli | 2.12.4 | Apache-2.0 OR MIT | punte UI ↔ Rust / unealtă build |
| vite / @vitejs/plugin-react | 8.3.6 / 6.2.1 | MIT | unealtă build (nu se livrează) |
| typescript | 7.0.2 | Apache-2.0 | unealtă build (nu se livrează) |
| restul crates | — | MIT / Apache-2.0 / Unicode-3.0 / BSD-3 / Zlib / Unlicense / CC0 | tranzitive |

**MPL-2.0 (copyleft slab, la nivel de fișier) — acceptat de proprietar (D-021, 6 nov. 2026):**
- În executabil, tranzitiv prin `tauri-utils`: `cssparser` 0.37.0, `selectors` 0.38.0, `dtoa-short` 0.3.5; plus `option-ext` 0.2.0 (prin `dirs`).
- Doar unealtă de build, nu se livrează: `lightningcss` 1.33.0 (prin vite).
- Ce cere MPL-2.0: dacă modificăm *fișierele acelor biblioteci*, publicăm modificările lor; codul K.G.B. rămâne închis. Folosire nemodificată = doar păstrarea notice-urilor. Este licența standard a ecosistemului Tauri. **Recomandare: acceptat, fără modificări ale acestor biblioteci.**

## spikes/s2-network (prototip, nu se distribuie)
Verificat 6 nov. 2026: `cargo metadata` (267 crates, target `x86_64-pc-windows-msvc`). **Niciun motor DB.** Nicio licență GPL/AGPL. Rulat și în CI cu `cargo-deny`.

| Dependență | Versiune | Licență | Rol |
|---|---|---|---|
| iroh / iroh-base / iroh-relay (client) | 1.4.1 | MIT OR Apache-2.0 | conexiuni P2P QUIC, NAT traversal, relay |
| noq | 1.4.0 | MIT OR Apache-2.0 | implementarea QUIC folosită de iroh |
| rustls / ring | 0.23.46 / 0.17.14 | Apache-2.0 OR ISC OR MIT / Apache-2.0 AND ISC | TLS 1.3, criptografie |
| tokio | 1.54.1 | MIT | runtime asincron |
| portmapper | 0.19.3 | MIT OR Apache-2.0 | UPnP / NAT-PMP / PCP |
| anyhow, serde, serde_json, blake3, data-encoding, rand | — | MIT / Apache-2.0 / CC0 | utilitare |
| webpki-roots | 1.0.11 | CDLA-Permissive-2.0 | lista certificatelor rădăcină (date, licență permisivă) |

**MPL-2.0 — acceptat (D-021):** `attohttpc` 0.30.1 (client HTTP mic, prin `portmapper` → `igd-next`, pentru UPnP pe router). Aceeași situație ca la Tauri (D-021).

## spikes/s4-pdf (prototip, nu se distribuie)
Verificat 7 nov. 2026:
- `cargo metadata` (182 de crate-uri, target `x86_64-pc-windows-msvc`): **niciun motor DB**, nicio licență GPL/AGPL;
- `cargo-deny` în CI.

| Dependență | Versiune | Licență | Rol |
|---|---|---|---|
| lopdf | 0.47.0 | MIT | citire/modificare/salvare PDF (ales, D-032) |
| hayro (+ hayro-syntax, -interpret, -font, ...) | 0.9.0 | Apache-2.0 OR MIT | randare pagini (ales pentru miniaturi/teste) |
| ↳ fonturi standard Foxit (în hayro-font) | — | BSD-3-Clause (PDFium) | **cer atribuire** în notices |
| ↳ profiluri ICC (în hayro-interpret) | — | CC0-1.0 | — |
| vello_cpu, skrifa, read-fonts | 0.3 / 0.49 / 0.46 | Apache-2.0 OR MIT | rasterizare, fonturi |
| pdf (pdf-rs) | 0.10.0 | MIT | cititor strict, doar în teste |
| pdf-extract | 0.12.1 | MIT | evaluat, respins (spații false în text) |
| yoke, zerofrom (tranzitive) | 0.8 / 0.1 | Unicode-3.0 | permisă în `deny.toml` |
| **tesseract.js** + tesseract.js-core (npm, `spikes/s4-pdf/ocr`) | 7.0.0 | Apache-2.0 | OCR WebAssembly (candidat D-035); tranzitive MIT/Apache/BSD-2; scriptul de instalare neexecutat |
| @tesseract.js-data/ron (npm) | 1.0.0 | MIT (datele tessdata: Apache-2.0) | limba română pentru OCR |
| **pdfjs-dist** (npm) | 6.4.299 | Apache-2.0 | afișare PDF în fereastră (ales); fără dependențe obligatorii (`@napi-rs/canvas` e opțional, neinstalat) |

## spikes/s5-sheets (prototip, nu se distribuie)
Verificat 7 nov. 2026:
- `cargo metadata` (148 de crate-uri, target `x86_64-pc-windows-msvc`): **niciun motor DB**, toate permisive;
- `cargo-deny` în CI.

| Dependență | Versiune | Licență | Rol |
|---|---|---|---|
| calamine | 0.38.0 | MIT | citire XLSX/XLSM/XLSB/XLS/ODS (ales, D-033) |
| umya-spreadsheet | 4.0.0-beta.1 (fixat exact) | MIT | editare + salvare XLSX (ales, D-033). 3.1.1 respinsă: `zip` 8.6 vulnerabil (RUSTSEC-2026-0367/0368/0369/0429) |
| ironcalc / ironcalc_base | 0.9.1 | MIT OR Apache-2.0 | motor de formule (ales, D-033) |
| rust_xlsxwriter | 0.102.0 | MIT OR Apache-2.0 | fișiere noi / export (ales, D-033) |
| zip | 9.4.1 | MIT | arhive XLSX. Doar `deflate`: opțiunea implicită bzip2 (licență „bzip2-1.0.6”) e oprită |
| quick-xml | 0.41 / 0.42 | MIT | XML |

## Cod de produs (Etapa 1): `crates/kgb-store`, `crates/kgb-core`, `app/`
Verificat automat de `cargo-deny` în CI pe workspace-ul rădăcină (`Cargo.toml`): licențe, crate-uri DB interzise (D-018), vulnerabilități.

| Dependență nouă | Licență | Rol | Pas |
|---|---|---|---|
| `kgb-store` | proprie (Kronos) | motorul de stocare, preluat din spike-ul S1 | 1.2 |
| `tracing`, `tracing-subscriber` (doar `registry`, `std`) | MIT | evenimente de log; scrierea în fișier e proprie (D-026) | 1.3 |
| `ed25519-dalek` 3.0.0 (+ `curve25519-dalek`, `sha2`) | BSD-3-Clause / MIT OR Apache-2.0 | cheia dispozitivului; aceeași versiune ca în iroh | 1.6 |
| `getrandom` 0.4.3 | MIT OR Apache-2.0 | numere aleatoare din sistemul de operare | 1.6 |
| `zeroize` 1.9.1 | Apache-2.0 OR MIT | ștergerea cheii din memorie | 1.6 |
| `semver` 1 | MIT OR Apache-2.0 | versiunile modulelor și compatibilitatea cu nucleul | 1.7 |
| `windows-sys` (Cryptography) | MIT OR Apache-2.0 | Windows DPAPI pentru sigilarea cheii (D-025) | 1.6 |
| `lopdf` 0.47.0 | MIT | operații PDF în modulul `kgb.pdf` (D-032) | 3.5 |
| `hayro` 0.9.0 (+ hayro-syntax/-interpret/-font, vello_cpu, skrifa, read-fonts) | Apache-2.0 OR MIT | miniaturile paginilor PDF (D-032) | 3.5 |
| ↳ fonturile standard Foxit din `hayro-font` | BSD-3-Clause (© PDFium Authors) | **atribuire obligatorie în notices** (fișierul `LICENSE_FOXIT`) — de inclus în installer înainte de distribuire | 3.5 |
| ↳ profilurile ICC din `hayro-interpret` | CC0-1.0 | — | 3.5 |
| `base64` 0.22.1 | MIT OR Apache-2.0 | conținutul fișierelor între interfață și module | 3.5 |
| `tauri-plugin-dialog` 2.8.4 (+ npm `@tauri-apps/plugin-dialog` 2.8.4) | MIT OR Apache-2.0 | dialogurile sistemului pentru import și export (doar `allow-open`, `allow-save`) | 3.5 |
| `calamine` 0.38.0 | MIT | citirea foilor de calcul în `kgb.sheets` (D-033) | 3.6 |
| `umya-spreadsheet` =4.0.0-beta.1 | MIT | editarea și salvarea XLSX (D-033; beta fixată exact, `zip` 9) | 3.6 |
| `iroh` 1.4.1 (+ `noq`, `rustls`, `ring`, `tokio`, `portmapper`, `webpki-roots`; aceleași ca în spike-ul S2) | MIT OR Apache-2.0 / ISC / CDLA-Permissive-2.0; `attohttpc` MPL-2.0 (D-021) | rețeaua între calculatoarele organizației, crate-ul `kgb-net` (D-015) | 6.5 |
| `ironcalc` 0.9.1 (+ `ironcalc_base`) | MIT OR Apache-2.0 | recalcularea formulelor (D-033) | 3.6 |
| `zip` 9.4.1 (doar `deflate`) | MIT | verificarea proprie anti-„bombă zip” | 3.6 |
| `csv` 1.4.0 | Unlicense OR MIT | citirea CSV | 3.6 |
| `encoding_rs` 0.8.44 | (Apache-2.0 OR MIT) AND BSD-3-Clause | CSV în codificarea veche Windows-1250 | 3.6 |
| `tauri-plugin-notification` 2.8.0 | Apache-2.0 OR MIT | notificările Windows pentru memento-uri, folosit doar din Rust (D-044) | 4.5 |
| `typst`, `typst-pdf`, `typst-layout` =0.15.1 (+ dependențele lor, toate permisive) | Apache-2.0 | PDF din modelele incluse în `kgb.docs` (D-045, ales de proprietar) | 4.8b |
| `typst-assets` =0.15.1 (fonturile incluse) | Apache-2.0; fonturile: SIL OFL 1.1 | fonturile PDF-urilor, incluse ca documentele să arate la fel pe orice calculator | 4.8b |
| `quick-xml` 0.42.0 | MIT | completarea câmpurilor din modelele Word în `kgb.docs` (D-045, spike S6) | 4.8 |
| `reqwest` 0.13.5 (fără funcțiile implicite, doar `rustls-no-provider`; + `rustls-platform-verifier` 0.7.1), `rustls` 0.23 cu `ring` | MIT OR Apache-2.0 | cereri HTTPS către sursele externe pornite de proprietar, de ex. ANAF (D-062); erau deja în aplicație prin iroh, nu s-a descărcat nimic nou | 7.4b |
| npm `pdfjs-dist` 6.4.299 | Apache-2.0 | afișarea paginilor PDF în fereastră (D-032); la `npm install` aduce opțional `@napi-rs/canvas` (MIT), folosit doar de Node, nu intră în aplicație | 3.5 |

Restul dependențelor (Tauri, React, Vite, serde, uuid, blake3) sunt cele din S1 și S3, deja în acest registru.
