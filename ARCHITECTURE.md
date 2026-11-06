# K.G.B. — Arhitectură tehnică

**Statut:** CIORNĂ. Se completează pe baza rezultatelor spike-urilor din Etapa 0. Până atunci, arhitectura logică este cea din Master Plan §4.

## Principii obligatorii (rezumat)
- Local-first, offline-first, fără server central de date (D-003, D-004).
- Fără motor de baze de date (D-005, D-018); stocare proprie din jurnal, snapshot-uri, indexuri regenerabile (D-006).
- Sincronizarea este protocol de aplicație prin schimb de evenimente; fișierele interne de stocare nu se partajează (Master Plan §9.5).
- Fără criptografie proprie (Master Plan §10).

## Secțiuni de completat după spike-uri
1. Storage Engine — format jurnal, snapshot, index, recovery, concurență (după S1)
2. Network & Sync — transport, identitate, pairing, relay (după S2)
3. Desktop shell — Tauri/React, granița UI ↔ Rust (după S3)
4. Module Manager și contractul modulelor (Etapa 1)
