# K.G.B. — Registrul riscurilor

Scală: probabilitate / impact = Mică · Medie · Mare · Critic. Actualizat: 6 nov. 2026.

| # | Risc | Prob. | Impact | Măsură | Stare |
|---|---|---|---|---|---|
| R1 | Motorul propriu de stocare pierde sau corupe date | Medie | Critic | Spike S1: teste de oprire forțată, corupere, index șters, concurență | Deschis |
| R2 | Conexiunea nu trece prin anumite NAT/firewall | Medie | Mare | Spike S2: test LAN, internet, hotspot, relay oprit | Deschis |
| R3 | Licențe incompatibile (AGPL, condiții comerciale) | Medie | Mare | Matrice licențe, `cargo-deny`, SBOM (LICENSES.md) | Deschis |
| R4 | Dependență de serviciu extern de relay/coordonare | Mare | Mediu | Documentare, variantă self-host (D-017) | Deschis |
| R5 | Toolchain MSVC lipsă pe PC-ul de dezvoltare | Sigur | Mic | Instalare (D-014) | Deschis |
| R6 | Scope prea mare | Mare | Mare | Porți de acceptare pe etape; fără module în Etapa 0 | Deschis |
| R7 | Antivirus sau foldere sincronizate cloud interferă cu scrierile atomice | Medie | Mare | Test cu Defender activ; refuz spațiu de lucru în OneDrive/Dropbox | Deschis |
| R8 | Lipsa unui al doilea PC pentru teste reale de rețea | Necunoscută | Mare | Proprietarul confirmă disponibilitatea | Deschis |
| R9 | DB folosit pe serverul de coordonare (NetBird/Headscale) contrazice D-005 | Medie | Mediu | D-015 / D-016 | Deschis |
| R10 | Biblioteci care conțin intern un motor DB | Medie | Mare | Lista D-018; verificare la fiecare dependență nouă | Deschis |
| R11 | **Smart App Control** (Windows 11) blochează programele nesemnate. Pe PC-ul de dezvoltare blochează orice build Rust/Tauri (constatat 6 nov. 2026, eveniment CodeIntegrity 3077). Pe PC-urile clienților cu SAC pornit, K.G.B. nesemnat nu va porni | Sigur | Critic | Dezvoltare: decizie D-020. Produs: semnare de cod (Authenticode, certificat cu reputație, ex. Azure Trusted Signing) devine cerință încă din testele pe PC-uri curate, nu abia în Etapa 8 | Dezvoltare: rezolvat (SAC oprit, D-020). Produs: deschis |
