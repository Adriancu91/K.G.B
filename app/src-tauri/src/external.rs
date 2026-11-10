//! Exchange rates and weather for the start page (Etapa 7, step 7.4e),
//! fetched only while their sources are switched on in „Surse externe”.
//! Answers are kept in memory: BNR at most once an hour; the weather of a
//! town again only after MET's `Expires` time and at least 3 hours later
//! (MET's rules), asking with `If-Modified-Since`.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use kgb_core::{fx, weather};

const FX_EVERY: Duration = Duration::from_secs(3600);

static FX: Mutex<Option<(Instant, fx::Day)>> = Mutex::new(None);

struct Cached {
    not_before: SystemTime,
    last_modified: Option<String>,
    body: String,
}
static WEATHER: Mutex<Option<HashMap<String, Cached>>> = Mutex::new(None);

/// "Mon, 09 Nov 2026 22:30:12 GMT" → the moment (HTTP dates are always GMT).
pub fn http_date(s: &str) -> Option<SystemTime> {
    let mut it = s.split_whitespace().skip(1);
    let d: u64 = it.next()?.parse().ok()?;
    let m = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ]
    .iter()
    .position(|x| Some(*x) == it.clone().next())? as u64
        + 1;
    it.next();
    let y: i64 = it.next()?.parse().ok()?;
    let mut hms = it.next()?.split(':').map(|x| x.parse::<u64>().ok());
    let (h, mi, se) = (hms.next()??, hms.next()??, hms.next()??);
    // Days since 1970 (civil calendar).
    let (yy, mm) = if m <= 2 { (y - 1, m + 9) } else { (y, m - 3) };
    let era = yy.div_euclid(400);
    let yoe = (yy - era * 400) as u64;
    let doy = (153 * mm + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    let days = era * 146_097 + doe as i64 - 719_468;
    let secs = u64::try_from(days).ok()? * 86_400 + h * 3600 + mi * 60 + se;
    Some(UNIX_EPOCH + Duration::from_secs(secs))
}

pub async fn rates() -> Result<fx::Day, String> {
    if let Ok(g) = FX.lock()
        && let Some((at, day)) = g.as_ref()
        && at.elapsed() < FX_EVERY
    {
        return Ok(day.clone());
    }
    let a = kgb_net::web::get(
        fx::BNR_URL,
        concat!("KGB/", env!("CARGO_PKG_VERSION"), " github.com/Adriancu91/K.G.B"),
        None,
    )
    .await
    .map_err(|e| format!("cursul BNR: {e}"))?;
    if a.status != 200 {
        return Err(format!("cursul BNR: serverul a răspuns cu codul {}", a.status));
    }
    let day = fx::parse(&a.body).map_err(|e| e.to_string())?;
    if let Ok(mut g) = FX.lock() {
        *g = Some((Instant::now(), day.clone()));
    }
    Ok(day)
}

pub async fn today(town: &str, azi: &str, offset_min: i64) -> Result<weather::Today, String> {
    let url = weather::url_for(town).map_err(|e| e.to_string())?;
    let now = SystemTime::now();
    let (cached_body, lm) = {
        let g = WEATHER
            .lock()
            .map_err(|_| "starea aplicației este blocată".to_string())?;
        match g.as_ref().and_then(|m| m.get(town)) {
            Some(c) if now < c.not_before => {
                return weather::parse(&c.body, town, azi, offset_min).map_err(|e| e.to_string());
            }
            Some(c) => (Some(c.body.clone()), c.last_modified.clone()),
            None => (None, None),
        }
    };
    let a = kgb_net::web::get(&url, weather::USER_AGENT, lm.as_deref())
        .await
        .map_err(|e| format!("vremea: {e}"))?;
    let body = match (a.status, cached_body) {
        (200 | 203, _) => a.body,
        (304, Some(b)) => b,
        (429, _) => return Err("vremea: MET Norway cere o pauză; încearcă mai târziu".into()),
        (s, _) => return Err(format!("vremea: serverul a răspuns cu codul {s}")),
    };
    let min_next = now + Duration::from_secs(weather::MIN_REFRESH_SECS);
    let not_before = a
        .expires
        .as_deref()
        .and_then(http_date)
        .map_or(min_next, |e| e.max(min_next));
    let t = weather::parse(&body, town, azi, offset_min).map_err(|e| e.to_string())?;
    if let Ok(mut g) = WEATHER.lock() {
        g.get_or_insert_with(HashMap::new).insert(
            town.to_string(),
            Cached {
                not_before,
                last_modified: a.last_modified.or(lm),
                body,
            },
        );
    }
    Ok(t)
}

#[cfg(test)]
mod tests {
    use super::http_date;
    use std::time::UNIX_EPOCH;
    #[test]
    fn http_dates() {
        let t = http_date("Mon, 09 Nov 2026 22:30:12 GMT").unwrap();
        assert_eq!(t.duration_since(UNIX_EPOCH).unwrap().as_secs(), 1_794_263_412);
        assert!(http_date("ieri").is_none());
    }
}
