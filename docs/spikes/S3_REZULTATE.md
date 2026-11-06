# S3 — Fereastră Tauri 2 + React/TS legată de motorul S1: rezultate

**Data:** 6 nov. 2026 · **Cod:** `spikes/s3-tauri-shell` · **Rulare:** laptopul proprietarului (i5-1135G7, 7,8 GB RAM, SSD NVMe, Windows 11 Pro, Defender activ, Smart App Control oprit)
**Statut:** PROTOTIP. Fereastra afișează clar „PROTOTIP S3 — nu folosi pentru date reale”.

## Ce face
- O fereastră Tauri 2 cu interfață React 19 + TypeScript strict (`strict`, `noUncheckedIndexedAccess`).
- Interfața nu stochează nimic singură (fără localStorage/IndexedDB). Totul trece prin 4 comenzi Rust: `status`, `list_notes`, `add_note`, `delete_note`. Comenzile apelează motorul S1 (jurnal fără DB) din `%LOCALAPPDATA%\ro.kronos.kgb.s3spike\workspace`.
- Ștergerea folosește concurența optimistă din S1 (versiunea așteptată).
- Permisiuni minime: doar `core:default`, fără pluginuri (fișiere, shell, rețea). Politică CSP strictă.

## Rezultate

| Criteriu (ETAPA0_PLAN 0.5) | Rezultat |
|---|---|
| Build reușit (MSVC, release, LTO) | ✅ ~2–3 min build complet. Primul build a eșuat o dată cu o eroare trecătoare a compilatorului (fișier `.rmeta` citit incomplet); a doua rulare a trecut fără schimbări |
| TypeScript strict + build frontend | ✅ fără erori (JS 222 KB, 70 KB gzip) |
| Installer NSIS nesemnat | ✅ **1,18 MB**; instalare silențioasă pentru utilizatorul curent, fără UAC, în 1,1 s |
| Executabil | **3,19 MB** |
| Apel UI → Rust → S1 | ✅ verificat vizual: nota salvată apare în listă |
| Persistență după oprire forțată | ✅ nota există după 3 opriri forțate (`Stop-Process -Force`) + repornire, „nimic de reparat” |

### Pornire și memorie (5 rulări, `measure.ps1`)

| Măsurătoare | Valoare |
|---|---|
| Fereastra nativă există (handle) | 31–36 ms (prima rulare 213 ms) |
| Pornire proces → stocare deschisă (măsurat în aplicație) | ~0,9–1,1 s; din acestea stocarea S1 doar 6–7 ms, restul e inițializarea Tauri/WebView2 |
| Procese totale | 7 (aplicația + 6 procese WebView2) |
| Memorie privată totală | **~156 MB** |
| Working set total | ~340 MB (supraestimat: include biblioteci WebView2 partajate cu Edge) |
| Doar procesul aplicației | ~26 MB |

## Concluzii
1. **Stack-ul Tauri 2 + React/TS + motor Rust fără DB funcționează pe Windows 11**, cu installer mic (1,2 MB față de ~80–100 MB pentru Electron).
2. **Memoria e dominată de WebView2** (~130 MB din 156 MB). E mult mai puțin decât un Electron tipic (200–300 MB privat), dar nu e „mică”. Pe PC-uri de 8 GB e acceptabil.
3. **Pornirea până la conținut durează ~1 s**, din cauza inițializării WebView2, nu a stocării. Trebuie măsurată și la pornire „la rece”, după restartul PC-ului.

## Limitări (ce NU s-a testat)
- **Pornire la rece**, după restart Windows: nemăsurată. Măsurătorile sunt „la cald”.
- **Timpul până la primul conținut desenat** e estimat prin timpul până la stocare gata, nu măsurat exact în WebView.
- **Installer nesemnat:** pe un PC cu Smart App Control pornit nu va rula (R11). Semnarea vine prin firmă.
- **WebView2 lipsă:** installerul presupune WebView2 deja instalat (`webviewInstallMode: skip`). Pe Windows 11 e preinstalat; pe Windows 10 vechi, nu întotdeauna.
- **Dezinstalarea** nu a fost testată. Prototipul a rămas instalat pentru utilizator (`%LOCALAPPDATA%\KGB S3 Prototip`, cu `uninstall.exe`).
- **Uneltele de build vin din ecosistemul npm** (vite, typescript), descărcate la `npm install`. `package-lock.json` le fixează versiunile.

## Dependențe
Vezi `LICENSES.md`, secțiunea S3. 249 crates + 27 pachete npm. Niciun motor DB. **MPL-2.0 de confirmat** (cssparser, selectors, dtoa-short, option-ext în executabil; lightningcss doar la build).
