# S2 — Conectivitate între PC-uri cu iroh: rezultate (partea locală)

**Data:** 6 nov. 2026 · **Cod:** `spikes/s2-network` · **Rulare:** laptopul proprietarului (Windows 11 Pro, Defender activ)
**Statut:** PROTOTIP. **Testat doar cu 2 procese pe același PC.** Testele între 2 PC-uri (LAN și internet) nu sunt făcute: lipsește al doilea PC (🔒 S2.3).

## Ce face prototipul
Un singur program `kgb-net-spike.exe` cu 4 comenzi:

| Comandă | Ce face |
|---|---|
| `listen <dir>` | pornește „serverul” unui PC și afișează o **invitație** (adresă + jeton unic de 128 biți) |
| `pair <dir> <invitație>` | al doilea PC se asociază folosind invitația; jetonul se consumă |
| `msg <dir> <text>` | trimite un mesaj peer-ului asociat |
| `send <dir> <fișier>` | trimite un fișier; dacă se întrerupe, se reia de unde a rămas; la final se verifică BLAKE3 |

**Securitate:**
- Fiecare conexiune folosește QUIC + TLS 1.3, autentificată cu cheile dispozitivelor (iroh, Ed25519), deci totul e criptat de la un capăt la altul.
- Peste asta, serverul servește doar dispozitivele asociate cu o invitație validă. Un dispozitiv care știe adresa, dar nu s-a asociat, e refuzat.
- Starea e în fișiere JSON mici, fără DB. Cheia dispozitivului e un fișier simplu (prototip); în Etapa 1 se mută sub DPAPI.

**Opțiuni de relay** (`--relay`): `none` (doar conexiune directă), `n0` (relay-urile publice n0, **doar pentru teste**, D-017), sau URL-ul unui relay propriu.

## Rezultate — 2 procese pe același PC

`test-local.ps1`, fișier de 50 MB, rulat atât fără relay cât și cu relay-ul public n0:

| Test | Fără relay | Cu relay n0 |
|---|---|---|
| Asociere cu invitație | ✅ 10–20 ms | ✅ 52 ms |
| Invitația nu se poate refolosi | ✅ refuzată | ✅ refuzată |
| Mesaj criptat | ✅ 5–10 ms | ✅ 25 ms |
| Dispozitiv neasociat (știe adresa, n-are invitație) | ✅ refuzat | ✅ refuzat |
| Transfer întrerupt brusc la 40% (proces oprit) | ✅ partea primită păstrată | ✅ |
| Reluare transfer + verificare BLAKE3 | ✅ reluat de la ~20 MB, 60–87 MB/s | ✅ 54 MB/s |
| Fișier identic (SHA256 calculat independent) | ✅ | ✅ |
| Transfer complet fără întrerupere | ✅ 62–95 MB/s | ✅ 71 MB/s |

**S2.2 — Comportament la eșec** (`test-failures.ps1`): niciun caz nu blochează programul.

| Caz | Rezultat | Timp |
|---|---|---|
| Peer-ul asociat e oprit | ✅ „conexiune eșuată: peer-ul nu a răspuns în 15s” | 15,2 s |
| Relay mort, dar cale directă disponibilă | ✅ conexiunea merge direct | 1,2 s |
| Relay-ul e singura cale și e mort | ✅ „conexiune eșuată …” | 15,1 s |
| Invitație coruptă | ✅ „invitație ilizibilă” | imediat |
| Mesaj fără asociere | ✅ „nu există un peer asociat” | imediat |

## Probleme găsite și rezolvate
1. **Fișier blocat pe Windows:** un fișier deschis doar pentru adăugare (`append`) nu poate fi trunchiat (*Access denied*). Rezolvat: deschidere pentru scriere + poziționare.
2. **Cursă la reluarea transferului:** după o oprire bruscă, conexiunea veche rămâne „pe jumătate deschisă” ~30 s (timeout QUIC) și ține fișierul parțial deschis, în timp ce reluarea scrie în același fișier. Verificarea BLAKE3 ar fi prins orice stricăciune, dar era o cursă reală. **Rezolvat:** un transfer reluat oprește întâi transferul vechi pentru același fișier și abia apoi continuă (vezi evenimentele „superseded” / „stopped a stale transfer”).
3. **Handle de fișier ținut deschis de tokio** după `drop`: închis acum explicit.

## Observații
- **Pornirea cu relay configurat dar mort durează 10 s** (așteaptă relay-ul, apoi continuă cu adrese directe). În produs, starea „relay indisponibil” trebuie arătată în UI, nu ascunsă.
- **Pe acest laptop, iroh a ales uneori interfața Tailscale** (adrese `100.x.x.x`) în locul rețelei Wi-Fi. Funcționează, dar arată că iroh folosește orice interfață disponibilă, inclusiv un VPN instalat. De ținut minte la diagnosticare.
- Viteza măsurată pe același PC (60–95 MB/s) **nu spune nimic despre rețeaua reală**; doar arată că programul nu e gâtul de sticlă.

## Ce NU s-a testat (🔒 cere al doilea PC)
- 2 PC-uri în aceeași rețea locală (LAN).
- 2 PC-uri prin internet, în rețele diferite (NAT traversal, „hole punching”), și cât trafic trece prin relay.
- Relay propriu (D-017, varianta c): de instalat `iroh-relay` pe un server; nu are DB.
- Comparația cu Nebula (S2.4) — doar documentată în `S2_RETEA_MATRICE.md`, fără test.
- Firewall-ul Windows: la primul `listen` pe un PC curat, Windows poate cere permisiune de rețea. Pe acest laptop nu a apărut nicio fereastră; de verificat pe al doilea PC.

## Dependențe
iroh 1.4.1 (MIT/Apache-2.0) + tokio, rustls, ring etc. 267 crates, **niciun motor DB**, verificat și în CI cu `cargo-deny`. **MPL-2.0 de confirmat:** `attohttpc` (pentru UPnP), aceeași situație ca D-021. Detalii în `LICENSES.md`.
