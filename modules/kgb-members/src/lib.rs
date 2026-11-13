//! `kgb.members` — „Membri și cotizații” (Etapa 8, step 8.17).
//!
//! - **Members** (`membri`): people or firms, with a category (free text, e.g. „membru fondator”), the day they came
//!   in and the day they left (withdrawn or excluded; the record stays).
//! - **Dues** (`tarife`): per year, for one category or for everyone (empty category), an amount per year or per
//!   month. The category's own rate wins over the general one.
//! - **Payments** (`plati`): for a member and a year; never deleted, a wrong one is cancelled with a reason.
//! - **Meetings** (`sedinte`): the day, the kind, the agenda, who was present (members active that day) and the
//!   resolutions. The quorum rules are the statute's: the module only counts present and active members.
//!
//! What a member owes for a year is computed, never written: with a yearly rate, the amount if the member was active
//! any day of that year up to today; with a monthly rate, every calendar month touched (from the later of coming in
//! and 1 January to the earliest of leaving, 31 December and today) times the amount.
//! Commands: `membri {text?, stare?}`, `membru {id, azi}`, `membru_save`, `membru_iesire {id, version, stare, data}`,
//! `membru_delete`, `tarife`, `tarif_save`, `tarif_delete`, `plata_save`, `plata_anuleaza`, `situatie {an, azi}`,
//! `sedinte`, `sedinta_save`, `sedinta_delete`.

use kgb_core::manifest::Manifest;
use kgb_core::modules::{Module, ModuleContext};
use kgb_core::workspace::now_ms;
use kgb_core::{CoreError, CoreResult};
use kgb_store::{Fields, RecordState, Write};
use serde::Deserialize;
use serde::de::DeserializeOwned;
use serde_json::{Value, json};
use uuid::Uuid;

pub const ID: &str = "kgb.members";
pub const MEMBERS: &str = "membri";
pub const RATES: &str = "tarife";
pub const PAYMENTS: &str = "plati";
pub const MEETINGS: &str = "sedinte";
pub const PAY_KINDS: [&str; 3] = ["numerar", "card", "transfer"];
pub const MEETING_KINDS: [&str; 3] = ["adunare_generala", "consiliu_director", "alta"];

pub struct Members {
    manifest: Manifest,
}

impl Members {
    pub fn new() -> Members {
        Members {
            manifest: Manifest::parse(include_str!("../manifest.json")).expect("built-in manifest is valid"),
        }
    }
}

impl Default for Members {
    fn default() -> Self {
        Members::new()
    }
}

fn args<T: DeserializeOwned>(command: &str, v: Value) -> CoreResult<T> {
    serde_json::from_value(v).map_err(|e| CoreError::invalid(format!("argumentele comenzii {command}"), e.to_string()))
}

fn bad(what: &str, detail: impl Into<String>) -> CoreError {
    CoreError::invalid(what, detail)
}

fn s(r: &RecordState, k: &str) -> String {
    r.fields.get(k).and_then(Value::as_str).unwrap_or_default().to_string()
}

fn i(r: &RecordState, k: &str) -> i64 {
    r.fields.get(k).and_then(Value::as_i64).unwrap_or_default()
}

fn b(r: &RecordState, k: &str) -> bool {
    r.fields.get(k) == Some(&json!(true))
}

fn now() -> i64 {
    i64::try_from(now_ms()).unwrap_or_default()
}

fn text(what: &str, t: &str, max: usize, required: bool) -> CoreResult<String> {
    let t = t.trim();
    if (required && t.is_empty()) || t.chars().count() > max {
        return Err(bad(
            what,
            if required {
                format!("are 1–{max} caractere")
            } else {
                format!("are cel mult {max} caractere")
            },
        ));
    }
    Ok(t.to_string())
}

fn fold(t: &str) -> String {
    t.to_lowercase()
        .replace(['ă', 'â'], "a")
        .replace('î', "i")
        .replace(['ș', 'ş'], "s")
        .replace(['ț', 'ţ'], "t")
}

/// Whether `AAAA-LL-ZZ` is a real date.
pub fn is_date(d: &str) -> bool {
    let by = d.as_bytes();
    if by.len() != 10 || by[4] != b'-' || by[7] != b'-' {
        return false;
    }
    let (Ok(y), Ok(m), Ok(dd)) = (d[0..4].parse::<i64>(), d[5..7].parse::<i64>(), d[8..10].parse::<i64>()) else {
        return false;
    };
    let leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
    let dim = [31, if leap { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    (1900..=2200).contains(&y) && (1..=12).contains(&m) && dd >= 1 && dd <= dim[(m - 1) as usize]
}

fn date_arg(what: &str, t: &str) -> CoreResult<String> {
    let t = t.trim();
    if is_date(t) {
        Ok(t.to_string())
    } else {
        Err(bad(what, format!("„{t}” nu e o dată AAAA-LL-ZZ")))
    }
}

/// What a member owes for `year` (dates as `AAAA-LL-ZZ`; `left` empty = still a member): with a yearly rate, the
/// amount once if active any day of the year up to `today`; with a monthly rate, the calendar months touched times
/// the amount.
pub fn owed_for_year(year: i64, monthly: bool, amount: i64, came: &str, left: &str, today: &str) -> i64 {
    let first = format!("{year:04}-01-01");
    let last = format!("{year:04}-12-31");
    let start = if came > first.as_str() { came } else { first.as_str() };
    let mut end = last.as_str();
    for e in [left, today] {
        if !e.is_empty() && e < end {
            end = e;
        }
    }
    if end < start {
        return 0;
    }
    if !monthly {
        return amount;
    }
    let month = |d: &str| d[5..7].parse::<i64>().unwrap_or(1);
    (month(end) - month(start) + 1) * amount
}

// ---------- arguments ----------

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct MemberList {
    #[serde(default)]
    text: String,
    #[serde(default)]
    stare: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ById {
    id: Uuid,
    #[serde(default)]
    version: u64,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct MemberOpen {
    id: Uuid,
    azi: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct MemberIn {
    #[serde(default)]
    id: Option<Uuid>,
    #[serde(default)]
    version: u64,
    nume: String,
    #[serde(default = "person")]
    fel: String,
    #[serde(default)]
    categorie: String,
    #[serde(default)]
    telefon: String,
    #[serde(default)]
    email: String,
    #[serde(default)]
    adresa: String,
    intrat: String,
    #[serde(default)]
    nota: String,
}

fn person() -> String {
    "persoana".into()
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct LeaveIn {
    id: Uuid,
    version: u64,
    stare: String,
    data: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RateIn {
    #[serde(default)]
    id: Option<Uuid>,
    #[serde(default)]
    version: u64,
    an: i64,
    #[serde(default)]
    categorie: String,
    suma: i64,
    #[serde(default = "yearly")]
    perioada: String,
}

fn yearly() -> String {
    "anual".into()
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct PaymentIn {
    membru: Uuid,
    an: i64,
    data: String,
    suma: i64,
    #[serde(default = "cash")]
    fel: String,
    #[serde(default)]
    document: String,
    #[serde(default)]
    nota: String,
}

fn cash() -> String {
    "numerar".into()
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct CancelIn {
    id: Uuid,
    version: u64,
    motiv: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct YearIn {
    an: i64,
    azi: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct MeetingIn {
    #[serde(default)]
    id: Option<Uuid>,
    #[serde(default)]
    version: u64,
    data: String,
    #[serde(default = "general")]
    fel: String,
    #[serde(default)]
    ordine_de_zi: String,
    #[serde(default)]
    prezenti: Vec<Uuid>,
    #[serde(default)]
    hotarari: String,
}

fn general() -> String {
    "adunare_generala".into()
}

// ---------- the module ----------

/// Whether a member was a member on `day`.
fn active_on(m: &RecordState, day: &str) -> bool {
    s(m, "intrat").as_str() <= day && (s(m, "iesit").is_empty() || s(m, "iesit").as_str() >= day)
}

impl Members {
    fn all(&self, ctx: &mut ModuleContext<'_>, c: &str) -> CoreResult<Vec<RecordState>> {
        ctx.scan(c, |r| !r.deleted)
    }

    fn get(&self, ctx: &mut ModuleContext<'_>, c: &str, id: Uuid, what: &str) -> CoreResult<RecordState> {
        ctx.get(c, id)?
            .filter(|r| !r.deleted)
            .ok_or_else(|| bad(what, "nu există"))
    }

    /// The rate of a year for a category: its own, else the general one.
    fn rate<'a>(rates: &'a [RecordState], year: i64, category: &str) -> Option<&'a RecordState> {
        let of_year = |c: &str| rates.iter().find(|r| i(r, "an") == year && s(r, "categorie") == c);
        (if category.is_empty() { None } else { of_year(category) }).or_else(|| of_year(""))
    }

    /// One member's year: owed, paid, whether a rate exists.
    fn year_of(
        &self,
        m: &RecordState,
        year: i64,
        today: &str,
        rates: &[RecordState],
        payments: &[RecordState],
    ) -> Value {
        let r = Self::rate(rates, year, &s(m, "categorie"));
        let due = r.map_or(0, |r| {
            owed_for_year(
                year,
                s(r, "perioada") == "lunar",
                i(r, "suma"),
                &s(m, "intrat"),
                &s(m, "iesit"),
                today,
            )
        });
        let paid: i64 = payments
            .iter()
            .filter(|p| s(p, "membru") == m.id.to_string() && i(p, "an") == year && !b(p, "anulata"))
            .map(|p| i(p, "suma"))
            .sum();
        json!({"an": year, "datorat": due, "platit": paid, "rest": due - paid, "fara_tarif": r.is_none(),
            "tarif": r.map(|r| i(r, "suma")), "perioada": r.map(|r| s(r, "perioada"))})
    }

    fn member_view(m: &RecordState) -> Value {
        json!({"id": m.id, "version": m.version, "nume": s(m, "nume"), "fel": s(m, "fel"), "categorie": s(m, "categorie"),
            "telefon": s(m, "telefon"), "email": s(m, "email"), "adresa": s(m, "adresa"), "intrat": s(m, "intrat"),
            "iesit": s(m, "iesit"), "stare": s(m, "stare"), "nota": s(m, "nota")})
    }

    fn save_member(&self, ctx: &mut ModuleContext<'_>, a: MemberIn) -> CoreResult<Value> {
        if a.fel != "persoana" && a.fel != "firma" {
            return Err(bad("felul membrului", "e persoană sau firmă"));
        }
        let email = text("e-mailul", &a.email, 120, false)?;
        if !email.is_empty() && (!email.contains('@') || email.contains(' ')) {
            return Err(bad("e-mailul", format!("„{email}” nu arată ca o adresă de e-mail")));
        }
        let intrat = date_arg("data intrării", &a.intrat)?;
        let (iesit, stare, created) = match a.id {
            Some(id) => {
                let m = self.get(ctx, MEMBERS, id, "membrul")?;
                if !s(&m, "iesit").is_empty() && intrat > s(&m, "iesit") {
                    return Err(bad("data intrării", "e după data ieșirii"));
                }
                (s(&m, "iesit"), s(&m, "stare"), i(&m, "creat_ms"))
            }
            None => (String::new(), "activ".to_string(), now()),
        };
        let mut f = Fields::new();
        f.insert("nume".into(), json!(text("numele membrului", &a.nume, 160, true)?));
        f.insert("fel".into(), json!(a.fel));
        f.insert("categorie".into(), json!(text("categoria", &a.categorie, 60, false)?));
        f.insert("telefon".into(), json!(text("telefonul", &a.telefon, 40, false)?));
        f.insert("email".into(), json!(email));
        f.insert("adresa".into(), json!(text("adresa", &a.adresa, 200, false)?));
        f.insert("intrat".into(), json!(intrat));
        f.insert("iesit".into(), json!(iesit));
        f.insert("stare".into(), json!(stare));
        f.insert("nota".into(), json!(text("nota", &a.nota, 1000, false)?));
        f.insert("creat_ms".into(), json!(created));
        let id = a.id.unwrap_or_else(Uuid::new_v4);
        let version = ctx.write(vec![Write::put(MEMBERS, id, f).expect(if a.id.is_some() {
            a.version
        } else {
            0
        })])?[0];
        Ok(json!({"id": id, "version": version}))
    }

    fn save_rate(&self, ctx: &mut ModuleContext<'_>, a: RateIn) -> CoreResult<Value> {
        if !(2000..=2100).contains(&a.an) {
            return Err(bad("anul", "e între 2000 și 2100"));
        }
        if a.perioada != "anual" && a.perioada != "lunar" {
            return Err(bad("perioada", "e pe an sau pe lună"));
        }
        if !(0..=100_000_000).contains(&a.suma) {
            return Err(bad("suma", "nu poate fi negativă"));
        }
        let categorie = text("categoria", &a.categorie, 60, false)?;
        let taken = self
            .all(ctx, RATES)?
            .iter()
            .any(|r| Some(r.id) != a.id && i(r, "an") == a.an && fold(&s(r, "categorie")) == fold(&categorie));
        if taken {
            return Err(bad(
                "cotizația",
                if categorie.is_empty() {
                    format!("pentru toți membrii în {} există deja", a.an)
                } else {
                    format!("pentru „{categorie}” în {} există deja", a.an)
                },
            ));
        }
        let mut f = Fields::new();
        f.insert("an".into(), json!(a.an));
        f.insert("categorie".into(), json!(categorie));
        f.insert("suma".into(), json!(a.suma));
        f.insert("perioada".into(), json!(a.perioada));
        let id = a.id.unwrap_or_else(Uuid::new_v4);
        let version = ctx.write(vec![Write::put(RATES, id, f).expect(if a.id.is_some() {
            a.version
        } else {
            0
        })])?[0];
        Ok(json!({"id": id, "version": version}))
    }

    fn save_meeting(&self, ctx: &mut ModuleContext<'_>, a: MeetingIn) -> CoreResult<Value> {
        let data = date_arg("data ședinței", &a.data)?;
        if !MEETING_KINDS.contains(&a.fel.as_str()) {
            return Err(bad("felul ședinței", "nu e cunoscut"));
        }
        let members = self.all(ctx, MEMBERS)?;
        let mut present: Vec<String> = a.prezenti.iter().map(Uuid::to_string).collect();
        present.sort();
        present.dedup();
        for p in &present {
            match members.iter().find(|m| m.id.to_string() == *p) {
                None => return Err(bad("prezența", "un membru ales nu există")),
                Some(m) if !active_on(m, &data) => {
                    return Err(bad("prezența", format!("{} nu era membru la {data}", s(m, "nume"))));
                }
                Some(_) => {}
            }
        }
        let created = match a.id {
            Some(id) => i(&self.get(ctx, MEETINGS, id, "ședința")?, "creat_ms"),
            None => now(),
        };
        let mut f = Fields::new();
        f.insert("data".into(), json!(data));
        f.insert("fel".into(), json!(a.fel));
        f.insert(
            "ordine_de_zi".into(),
            json!(text("ordinea de zi", &a.ordine_de_zi, 4000, false)?),
        );
        f.insert("prezenti".into(), json!(present));
        f.insert("hotarari".into(), json!(text("hotărârile", &a.hotarari, 8000, false)?));
        f.insert("creat_ms".into(), json!(created));
        let id = a.id.unwrap_or_else(Uuid::new_v4);
        let version = ctx.write(vec![Write::put(MEETINGS, id, f).expect(if a.id.is_some() {
            a.version
        } else {
            0
        })])?[0];
        let active = members.iter().filter(|m| active_on(m, &data)).count();
        Ok(json!({"id": id, "version": version, "prezenti": present.len(), "membri_activi": active}))
    }
}

impl Module for Members {
    fn manifest(&self) -> &Manifest {
        &self.manifest
    }

    fn handle(&self, ctx: &mut ModuleContext<'_>, command: &str, a: Value) -> CoreResult<Value> {
        match command {
            "membri" => {
                let a: MemberList = args(command, a)?;
                let q = fold(a.text.trim());
                let mut l: Vec<RecordState> = self
                    .all(ctx, MEMBERS)?
                    .into_iter()
                    .filter(|m| a.stare.is_empty() || s(m, "stare") == a.stare)
                    .filter(|m| {
                        q.is_empty() || fold(&s(m, "nume")).contains(&q) || fold(&s(m, "categorie")).contains(&q)
                    })
                    .collect();
                l.sort_by_key(|m| (s(m, "stare") != "activ", fold(&s(m, "nume"))));
                Ok(json!(l.iter().map(Self::member_view).collect::<Vec<_>>()))
            }
            "membru" => {
                let a: MemberOpen = args(command, a)?;
                let today = date_arg("ziua de azi", &a.azi)?;
                let m = self.get(ctx, MEMBERS, a.id, "membrul")?;
                let rates = self.all(ctx, RATES)?;
                let payments = self.all(ctx, PAYMENTS)?;
                let from: i64 = s(&m, "intrat")[0..4].parse().unwrap_or(2000);
                let to: i64 = today[0..4].parse().unwrap_or(from);
                let years: Vec<Value> = (from..=to.max(from))
                    .rev()
                    .map(|y| self.year_of(&m, y, &today, &rates, &payments))
                    .collect();
                let mut pays: Vec<&RecordState> =
                    payments.iter().filter(|p| s(p, "membru") == a.id.to_string()).collect();
                pays.sort_by_key(|p| std::cmp::Reverse(s(p, "data")));
                let mut v = Self::member_view(&m);
                v["ani"] = json!(years);
                v["plati"] = json!(
                    pays.iter()
                        .map(|p| json!({"id": p.id, "version": p.version, "an": i(p, "an"), "data": s(p, "data"), "suma": i(p, "suma"),
                            "fel": s(p, "fel"), "document": s(p, "document"), "anulata": b(p, "anulata"), "motiv": s(p, "motiv")}))
                        .collect::<Vec<_>>()
                );
                Ok(v)
            }
            "membru_save" => self.save_member(ctx, args(command, a)?),
            "membru_iesire" => {
                let a: LeaveIn = args(command, a)?;
                let m = self.get(ctx, MEMBERS, a.id, "membrul")?;
                if a.stare != "retras" && a.stare != "exclus" {
                    return Err(bad("ieșirea", "e retragere sau excludere"));
                }
                if s(&m, "stare") != "activ" {
                    return Err(bad("membrul", "a ieșit deja"));
                }
                let d = date_arg("data ieșirii", &a.data)?;
                if d < s(&m, "intrat") {
                    return Err(bad("data ieșirii", "e înaintea intrării"));
                }
                let mut f = m.fields.clone();
                f.insert("iesit".into(), json!(d));
                f.insert("stare".into(), json!(a.stare));
                let version = ctx.write(vec![Write::put(MEMBERS, a.id, f).expect(a.version)])?[0];
                Ok(json!({"id": a.id, "version": version}))
            }
            "membru_delete" => {
                let a: ById = args(command, a)?;
                let key = a.id.to_string();
                let paid = self.all(ctx, PAYMENTS)?.iter().any(|p| s(p, "membru") == key);
                let met = self.all(ctx, MEETINGS)?.iter().any(|r| {
                    r.fields
                        .get("prezenti")
                        .and_then(Value::as_array)
                        .is_some_and(|p| p.contains(&json!(key)))
                });
                if paid || met {
                    return Err(bad(
                        "membrul",
                        "are încasări sau ședințe și nu se șterge; marchează-l retras",
                    ));
                }
                ctx.write(vec![Write::delete(MEMBERS, a.id).expect(a.version)])?;
                Ok(Value::Null)
            }
            "tarife" => {
                let mut l = self.all(ctx, RATES)?;
                l.sort_by_key(|r| (std::cmp::Reverse(i(r, "an")), s(r, "categorie")));
                Ok(json!(
                    l.iter()
                        .map(|r| json!({"id": r.id, "version": r.version, "an": i(r, "an"), "categorie": s(r, "categorie"),
                            "suma": i(r, "suma"), "perioada": s(r, "perioada")}))
                        .collect::<Vec<_>>()
                ))
            }
            "tarif_save" => self.save_rate(ctx, args(command, a)?),
            "tarif_delete" => {
                let a: ById = args(command, a)?;
                ctx.write(vec![Write::delete(RATES, a.id).expect(a.version)])?;
                Ok(Value::Null)
            }
            "plata_save" => {
                let a: PaymentIn = args(command, a)?;
                self.get(ctx, MEMBERS, a.membru, "membrul")?;
                if !(2000..=2100).contains(&a.an) {
                    return Err(bad("anul", "e între 2000 și 2100"));
                }
                if !(1..=100_000_000).contains(&a.suma) {
                    return Err(bad("suma", "trebuie să fie mai mare decât zero"));
                }
                if !PAY_KINDS.contains(&a.fel.as_str()) {
                    return Err(bad("felul plății", "e numerar, card sau transfer"));
                }
                let mut f = Fields::new();
                f.insert("membru".into(), json!(a.membru.to_string()));
                f.insert("an".into(), json!(a.an));
                f.insert("data".into(), json!(date_arg("data plății", &a.data)?));
                f.insert("suma".into(), json!(a.suma));
                f.insert("fel".into(), json!(a.fel));
                f.insert("document".into(), json!(text("documentul", &a.document, 60, false)?));
                f.insert("nota".into(), json!(text("nota", &a.nota, 500, false)?));
                f.insert("anulata".into(), json!(false));
                f.insert("motiv".into(), json!(""));
                f.insert("creat_ms".into(), json!(now()));
                let id = Uuid::new_v4();
                let version = ctx.write(vec![Write::put(PAYMENTS, id, f).expect(0)])?[0];
                Ok(json!({"id": id, "version": version}))
            }
            "plata_anuleaza" => {
                let a: CancelIn = args(command, a)?;
                let p = self.get(ctx, PAYMENTS, a.id, "plata")?;
                if b(&p, "anulata") {
                    return Err(bad("plata", "e deja anulată"));
                }
                let m = text("motivul", &a.motiv, 300, true)?;
                if m.chars().count() < 3 {
                    return Err(bad("motivul", "are cel puțin 3 caractere"));
                }
                let mut f = p.fields.clone();
                f.insert("anulata".into(), json!(true));
                f.insert("motiv".into(), json!(m));
                let version = ctx.write(vec![Write::put(PAYMENTS, a.id, f).expect(a.version)])?[0];
                Ok(json!({"id": a.id, "version": version}))
            }
            "situatie" => {
                let a: YearIn = args(command, a)?;
                let today = date_arg("ziua de azi", &a.azi)?;
                if !(2000..=2100).contains(&a.an) {
                    return Err(bad("anul", "e între 2000 și 2100"));
                }
                let rates = self.all(ctx, RATES)?;
                let payments = self.all(ctx, PAYMENTS)?;
                let (first, last) = (format!("{:04}-01-01", a.an), format!("{:04}-12-31", a.an));
                let mut rows: Vec<Value> = self
                    .all(ctx, MEMBERS)?
                    .iter()
                    .filter(|m| s(m, "intrat") <= last && (s(m, "iesit").is_empty() || s(m, "iesit") >= first))
                    .map(|m| {
                        let mut v = self.year_of(m, a.an, &today, &rates, &payments);
                        v["membru"] = json!(m.id);
                        v["nume"] = json!(s(m, "nume"));
                        v["categorie"] = json!(s(m, "categorie"));
                        v["stare"] = json!(s(m, "stare"));
                        v
                    })
                    .collect();
                rows.sort_by_key(|v| {
                    (
                        std::cmp::Reverse(v["rest"].as_i64().unwrap_or(0)),
                        fold(v["nume"].as_str().unwrap_or("")),
                    )
                });
                let sum = |k: &str| rows.iter().map(|v| v[k].as_i64().unwrap_or(0)).sum::<i64>();
                let restante = rows.iter().filter(|v| v["rest"].as_i64().unwrap_or(0) > 0).count();
                let without = rows.iter().filter(|v| v["fara_tarif"] == true).count();
                Ok(
                    json!({"an": a.an, "datorat": sum("datorat"), "platit": sum("platit"), "rest": sum("rest"),
                    "cu_restante": restante, "fara_tarif": without, "membri": rows}),
                )
            }
            "sedinte" => {
                let members = self.all(ctx, MEMBERS)?;
                let mut l = self.all(ctx, MEETINGS)?;
                l.sort_by_key(|r| std::cmp::Reverse(s(r, "data")));
                Ok(json!(
                    l.iter()
                        .map(|r| {
                            let d = s(r, "data");
                            json!({"id": r.id, "version": r.version, "data": d, "fel": s(r, "fel"),
                                "ordine_de_zi": s(r, "ordine_de_zi"), "hotarari": s(r, "hotarari"),
                                "prezenti": r.fields.get("prezenti").cloned().unwrap_or(json!([])),
                                "membri_activi": members.iter().filter(|m| active_on(m, &d)).count()})
                        })
                        .collect::<Vec<_>>()
                ))
            }
            "sedinta_save" => self.save_meeting(ctx, args(command, a)?),
            "sedinta_delete" => {
                let a: ById = args(command, a)?;
                ctx.write(vec![Write::delete(MEETINGS, a.id).expect(a.version)])?;
                Ok(Value::Null)
            }
            other => Err(bad("comanda", format!("„{other}” nu e cunoscută"))),
        }
    }
}
