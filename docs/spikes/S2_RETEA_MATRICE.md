# S2 — Matricea candidaților de rețea (cercetare pe surse oficiale)

**Data verificării:** 6 nov. 2026 · Doar cercetare web; nimic instalat. Elementele marcate „neverificat” trebuie confirmate în spike.

| | iroh | NetBird | Nebula | Tailscale / Headscale |
|---|---|---|---|---|
| Versiune / întreținere | **1.0 lansat 15 iun. 2026**, ultima v1.4.1 (22 oct. 2026), foarte activ | v0.82.0, activ | v1.12.0 (oct. 2026), activ | active |
| Licență | MIT / Apache-2.0 | client BSD-3; **servere AGPLv3** (din v0.53, aug. 2025) | MIT | client BSD-3 (interfața grafică Windows închisă); Headscale BSD-3 |
| Server de coordonare | **nu e necesar**; relay propriu `iroh-relay` fără stare | management + signal + relay obligatorii | lighthouse cu IP public + relay-uri | server de control obligatoriu (SaaS sau Headscale) |
| Motor DB pe ce operăm noi | **relay: nu**. Serverul DNS opțional `iroh-dns-server` folosește **redb** (DB embedded) → **nu îl găzduim** (folosim adresa relay-ului în invitație și mDNS în LAN) | **da** (SQLite implicit) | nu | Headscale: **da** (SQLite) |
| Driver / admin pe Windows | **nu** — bibliotecă în proces, UDP obișnuit (posibil prompt Windows Firewall) | da (serviciu + driver, UAC) | da (adaptor TUN) | da; `tsnet` fără driver, dar doar în Go |
| Ocolire NAT | foarte bună (hole punching + QUIC multipath + relay criptat) | bună | cea mai slabă (NAT simetric = relay configurat manual) | cea mai bună |

## Concluzie
iroh este singurul candidat care respectă simultan D-004, D-005, D-007 și D-008: fără DB, fără server central de date, fără driver și fără UAC. Rămâne prim candidat (D-015). Pentru comparația cerută în D-015, candidatul VPN recomandat este **Nebula** (fără DB, MIT). NetBird și Headscale aduc SQLite și un plan de control central.

## Condiții pentru relay-urile publice n0
- Documentația spune explicit că sunt „pentru dezvoltare și hobby”, nu pentru producție. Nu există SLA și nu sunt publicate limite.
- **Folosire permisă doar pentru teste (D-017).** Pentru producție: relay propriu `iroh-relay` (fără DB) sau serviciul plătit al n0.
- Metadate văzute de relay/discovery: ID-ul public al dispozitivului, adresa relay-ului, adrese IP, metadate de trafic. Conținutul nu e vizibil (criptare end-to-end).

## Surse
github.com/n0-computer/iroh (releases, iroh-dns-server/Cargo.toml) · docs.iroh.computer (relays, discovery, rate-limiting) · github.com/netbirdio/netbird · netbird.io/knowledge-hub/netbird-agpl-announcement · docs.netbird.io/selfhosted/maintenance/sqlite-store · github.com/slackhq/nebula · github.com/juanfont/headscale · tailscale.com/kb/1244/tsnet

---

# Smart App Control și semnarea de cod

- SAC blochează aplicațiile nesemnate fără reputație și nu are excepții per aplicație sau per folder (nici Dev Drive). Confirmat pe acest PC: eveniment CodeIntegrity 3077.
- **Noutate 2026:** documentația Microsoft spune că SAC se poate **reporni** din Windows Security fără reinstalare (actualizarea din aprilie 2026). Excepție: dacă datele de diagnostic opționale sunt oprite. Rapoarte neverificate spun că actualizarea din oct. 2026 a blocat butonul pe unele PC-uri.
- SAC acceptă aplicațiile semnate cu certificate de la furnizori de încredere. Microsoft recomandă **Azure Artifact Signing** (fostul Trusted Signing). Certificatele self-signed nu contează.
- **Artifact Signing:** Basic 9,99 USD/lună (5.000 de semnături). **Eligibile: firme din UE (deci o firmă din România)**. Persoanele fizice doar din SUA/Canada. Validarea durează 1–20 zile lucrătoare.
- Semnarea nu elimină avertismentele SmartScreen; reputația se acumulează în timp.
- De testat: o aplicație nouă, semnată, pe o mașină virtuală cu SAC pornit (unele rapoarte indică blocări și pentru aplicații semnate foarte noi).

Surse: support.microsoft.com (Smart App Control FAQ) · learn.microsoft.com/azure/artifact-signing (quickstart, faq) · azure.microsoft.com/pricing/details/artifact-signing
