# K.G.B. — Registrul riscurilor

Scală: probabilitate / impact = Mică · Medie · Mare · Critic. Actualizat: 6 nov. 2026.

| # | Risc | Prob. | Impact | Măsură | Stare |
|---|---|---|---|---|---|
| R1 | Motorul propriu de stocare pierde sau corupe date | Medie | Critic | Spike S1: teste de oprire forțată, corupere, index șters, concurență | **Redus:** 20/20 teste, 1.000 opriri forțate fără pierderi (laptop + CI). Rămâne deschis: pierdere de curent (VM), RAM la 1M |
| R2 | Conexiunea nu trece prin anumite NAT/firewall | Medie | Mare | Spike S2: test LAN, internet, hotspot, relay oprit | **Parțial:** relay oprit → eroare clară în 15 s (testat local). LAN și internet: 🔒 al doilea PC |
| R3 | Licențe incompatibile (AGPL, condiții comerciale) | Medie | Mare | Matrice licențe, `cargo-deny`, SBOM (LICENSES.md) | **Redus:** `cargo-deny` în CI pentru S1/S2/S3, fără GPL/AGPL; MPL-2.0 de confirmat (D-021); SBOM încă nu |
| R4 | Dependență de serviciu extern de relay/coordonare | Mare | Mediu | Documentare, variantă self-host (D-017) | Deschis |
| R5 | Toolchain MSVC lipsă pe PC-ul de dezvoltare | Sigur | Mic | Instalare (D-014) | **Închis:** MSVC instalat și implicit |
| R6 | Scope prea mare | Mare | Mare | Porți de acceptare pe etape; fără module în Etapa 0 | Deschis |
| R7 | Antivirus sau foldere sincronizate cloud interferă cu scrierile atomice | Medie | Mare | Test cu Defender activ; refuz spațiu de lucru în OneDrive/Dropbox | **Redus:** S1 și S3 testate cu Defender activ; refuzul OneDrive testat. Observat: Windows ține fișierele ocupate scurt după scriere (S2) |
| R8 | Lipsa unui al doilea PC pentru teste reale de rețea | Necunoscută | Mare | Proprietarul confirmă disponibilitatea | **Deschis — blochează S2.3** |
| R9 | DB folosit pe serverul de coordonare (NetBird/Headscale) contrazice D-005 | Medie | Mediu | D-015 / D-016 | **Închis:** iroh nu are nevoie de server de coordonare; relay-ul nu are DB |
| R10 | Biblioteci care conțin intern un motor DB | Medie | Mare | Lista D-018; verificare la fiecare dependență nouă | **Redus:** lista D-018 e blocată automat în CI (`deny.toml`) |
| R11 | **Smart App Control** (Windows 11) blochează programele nesemnate. Pe PC-ul de dezvoltare blochează orice build Rust/Tauri (constatat 6 nov. 2026, eveniment CodeIntegrity 3077). Pe PC-urile clienților cu SAC pornit, K.G.B. nesemnat nu va porni | Sigur | Critic | Dezvoltare: decizie D-020. Produs: semnare de cod (Authenticode, certificat cu reputație, ex. Azure Trusted Signing) devine cerință încă din testele pe PC-uri curate, nu abia în Etapa 8 | Dezvoltare: rezolvat (SAC oprit, D-020). Produs: deschis |
| R12 | Memoria WebView2 (~130 MB din ~156 MB) pe PC-uri cu 8 GB | Medie | Mediu | Măsurat în S3; de urmărit la fiecare modul nou | Deschis |
| R13 | Conexiuni „pe jumătate deschise” după întreruperi (QUIC ~30 s) produc curse la reluare | Medie | Mare | Găsit și rezolvat în S2 (transferul nou îl oprește pe cel vechi); de păstrat în designul sincronizării | Redus |
| R14 | Biblioteci MPL-2.0 aduse de Tauri și iroh | Sigur | Mic | D-021: acceptare cu regula „nu le modificăm” | Acceptat (D-021 DECIS) |
