# K.G.B. — Contractul modulelor

**Statut:** CIORNĂ. Se finalizează în Etapa 1. Conținutul minim obligatoriu vine din Metaprompt §9 și Master Plan §4.2.

## Manifest (câmpuri obligatorii)
- ID unic și nume
- versiune
- versiunea minimă/maximă compatibilă a nucleului
- permisiuni solicitate
- servicii API ale nucleului folosite
- tipuri de date deținute
- evenimente emise și ascultate
- migrații de format
- status: `stable` | `beta` | `experimental` | `disabled`

## Reguli
- Un modul nu accesează direct datele interne ale altui modul.
- Un modul nu ocolește verificarea permisiunilor și nu își face propriul sistem de identitate, sincronizare sau jurnal.
- Dezactivarea unui modul nu îi șterge datele.
- Un modul `experimental` nu apare ca funcțional pentru utilizatorul final.

Formatul exact al manifestului (fișier, schemă, validare) — de definit în Etapa 1.
