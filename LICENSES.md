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

**De confirmat de proprietar — MPL-2.0 (copyleft slab, la nivel de fișier):**
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

**De confirmat de proprietar — MPL-2.0:** `attohttpc` 0.30.1 (client HTTP mic, prin `portmapper` → `igd-next`, pentru UPnP pe router). Aceeași situație ca la Tauri (D-021).
