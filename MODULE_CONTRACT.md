# K.G.B. — Contractul modulelor

**Statut:** v1, implementat în Etapa 1 (`crates/kgb-core/src/manifest.rs`, `modules.rs`). Sursa: Metaprompt §9, Master Plan §4.1–4.2, decizia D-024.

## Cum există un modul
- Modulele din Etapele 1–5 sunt **incluse în aplicație** (D-024). Nu se încarcă cod străin la rulare.
- Fiecare modul are un crate Rust propriu (logica), interfața în `app/src/modules/<id>/` și un `manifest.json` inclus în crate.
- Codul implementează trăsătura `Module`: `manifest()`, `handle(ctx, comandă, argumente)` și, la nevoie, `migrate(ctx, de_la)`.

## Manifest (`manifest_format: 1`)
| Câmp | Obligatoriu | Regulă |
|---|---|---|
| `id` | da | stil domeniu invers, litere mici: `kgb.notes` |
| `name`, `description` | da | text pentru utilizator |
| `version` | da | semver (`0.1.0`) |
| `core` | da | versiunile de nucleu compatibile, cerință semver (`>=0.1.0, <0.2.0`) |
| `status` | da | `stable` · `beta` · `experimental` · `disabled` |
| `permissions` | nu | doar din lista nucleului (mai jos) |
| `services` | nu | `storage`, `settings`, `identity`, `files`, `log`; o permisiune cere serviciul ei |
| `data_types` | nu | colecții logice `[a-z0-9_]+`; cer `storage.own`; fiecare poate avea o `schema` (mai jos) și `indexes` (câmpuri indexate, din schemă dacă există) |
| `events.emits` / `events.listens` | nu | evenimentele emise încep cu `<id>.` |
| `data_format` | da | formatul curent al datelor, de la 1 |
| `migrations` | da dacă `data_format > 1` | lanț fără goluri: 1→2, 2→3, … |
| `on_disable` | da | ce se întâmplă cu datele la dezactivare, pentru utilizator |

Validarea e strictă: orice câmp necunoscut, permisiune necunoscută sau valoare greșită face manifestul să fie refuzat.

## Schema unei colecții (Etapa 2)
`"schema": {"fields": {"<câmp>": {...}}, "additional": false}`. Pentru fiecare câmp:
- `type`: `string` · `number` · `integer` · `bool` · `array` · `object` · `any`;
- `required`, `nullable` (implicit `false`);
- `max_len` (caractere la text, elemente la liste);
- `min`/`max` (doar la numere);
- `enum` (doar la text).

Nucleul verifică **fiecare scriere** a modulului. O înregistrare greșită e refuzată și nu se salvează nimic din lotul respectiv. Schema se schimbă doar odată cu `data_format`, printr-o migrare.

## Indexuri și interogări (Etapa 2)
- `"indexes": ["câmp", ...]`: nucleul creează indexurile la activare. Motorul le păstrează și le reconstruiește la fiecare deschidere, iar un index pierdut nu pierde date.
- `ctx.query(colecție, Query)`: filtre (`eq`, `ne`, `lt`, `le`, `gt`, `ge`, `in`, `contains`, `exists`, `and`, `or`, `not`), sortare, `offset`/`limit`. O egalitate pe un câmp indexat, cu valoare text sau adevărat/fals, folosește automat indexul.

## Permisiuni (lista nucleului, v1)
| Permisiune | Ce permite |
|---|---|
| `storage.own` | citire/scriere doar în colecțiile proprii declarate (`mod.<id>.<colecție>`) |
| `settings.read` | citirea setărilor spațiului de lucru |
| `identity.read` | numele proprietarului și amprenta dispozitivului |
| `files.own` | fișiere atașate proprii (`ctx.put_file/get_file/delete_file/list_files`); maximum 64 MB pe fișier; conținutul e verificat prin BLAKE3 la fiecare citire; un modul nu vede fișierele altui modul |

În listă intră doar permisiuni pe care nucleul le verifică efectiv. Una nouă se adaugă împreună cu verificarea ei.

## Reguli aplicate de nucleu
- **Activare:** utilizatorul vede permisiunile cerute și le acordă pe toate sau deloc. Un modul incompatibil cu nucleul sau retras (`disabled`) nu poate fi activat.
- **Migrații:** se rulează în ordine, o singură dată, înainte de activare. Date mai noi decât modulul → refuz (aplicația veche nu strică datele noi).
- **Dezactivare:** datele rămân neatinse. La reactivare, modulul le regăsește.
- **Izolare:** un modul ajunge la date doar prin `ModuleContext`, care verifică permisiunea la fiecare operație și limitează stocarea la colecțiile declarate. Două module cu aceeași colecție logică au colecții fizice diferite.
- **Audit:** fiecare refuz, activare, dezactivare și migrare se scrie în `core.audit`.
- **Fișiere:** ștergerea doar marchează înregistrarea. Conținutul fără nicio referință e mutat în `retired/blobs/` doar de colectarea explicită (`files::collect_unreferenced`), niciodată imediat.
- **Loguri:** modulele folosesc logul nucleului (`ctx.log`), nu un mecanism propriu.
- **Catalog:** modulele `experimental` apar doar în versiunile de dinainte de lansare, marcate „experimental”. Modulele etapelor viitoare apar ca „Neimplementat — Etapa N” și nu pot fi activate.

## Ce nu acoperă încă v1
- Evenimentele dintre module sunt declarate, dar **nu există încă magistrala de evenimente**: vine când un al doilea modul are nevoie de ea, cel mai devreme în Etapa 4.
- Exportul datelor unui modul: Etapa 2, odată cu backup/restore în aplicație.
- Permisiunile cu expirare și rolurile pentru alți utilizatori: Etapa 6.
