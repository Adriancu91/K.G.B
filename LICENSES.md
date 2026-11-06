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
