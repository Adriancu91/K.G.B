//! Recurring tasks (Etapa 4, step 4.3; D-046): simple rules — every N days,
//! weeks (on chosen weekdays), months or years — not full iCalendar.
//!
//! The rule keeps the anchor day: a task due on the 31st that repeats monthly
//! falls on the last day of shorter months and comes back to the 31st when
//! the month has one; a yearly task on 29 February falls on the 28th in
//! common years.

use serde::{Deserialize, Serialize};

use crate::dates::{Date, days_in_month};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Freq {
    Zilnic,
    Saptamanal,
    Lunar,
    Anual,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Rule {
    pub frecventa: Freq,
    /// Every `interval` days / weeks / months / years (1 = every).
    #[serde(default = "one")]
    pub interval: u32,
    /// Weekly only: weekdays 1 (Monday) … 7 (Sunday); empty = the due date's weekday.
    #[serde(default)]
    pub zile: Vec<u32>,
    /// Day of the month the series was set on (kept across short months).
    #[serde(default)]
    pub zi: Option<u32>,
    /// No occurrence after this date (YYYY-MM-DD).
    #[serde(default)]
    pub pana_la: Option<String>,
}

fn one() -> u32 {
    1
}

pub const MAX_INTERVAL: u32 = 366;

impl Rule {
    pub fn check(&self) -> Result<(), String> {
        if self.interval == 0 || self.interval > MAX_INTERVAL {
            return Err(format!("intervalul trebuie să fie între 1 și {MAX_INTERVAL}"));
        }
        if self.zile.iter().any(|d| !(1..=7).contains(d)) {
            return Err("zilele săptămânii sunt 1 (luni) … 7 (duminică)".into());
        }
        if self.frecventa != Freq::Saptamanal && !self.zile.is_empty() {
            return Err("zilele săptămânii se aleg doar la repetarea săptămânală".into());
        }
        Ok(())
    }
}

/// Days since 1 Jan 1970 (proleptic Gregorian), and back.
fn to_days(d: Date) -> i64 {
    let (y, m) = if d.m <= 2 {
        (i64::from(d.y) - 1, d.m + 9)
    } else {
        (i64::from(d.y), d.m - 3)
    };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let doy = (153 * i64::from(m) + 2) / 5 + i64::from(d.d) - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

fn from_days(z: i64) -> Date {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    let y = (yoe + era * 400 + i64::from(m <= 2)) as i32;
    Date { y, m, d }
}

pub fn add_days(d: Date, n: i64) -> Date {
    from_days(to_days(d) + n)
}

/// 1 = Monday … 7 = Sunday.
pub fn weekday(d: Date) -> u32 {
    // 1 Jan 1970 was a Thursday (4).
    ((to_days(d) + 3).rem_euclid(7) + 1) as u32
}

fn add_months(d: Date, months: u32, anchor: u32) -> Date {
    let total = d.y * 12 + d.m as i32 - 1 + months as i32;
    let (y, m) = (total.div_euclid(12), total.rem_euclid(12) as u32 + 1);
    Date {
        y,
        m,
        d: anchor.min(days_in_month(y, m)),
    }
}

/// The occurrence after `due`, or `None` when the series has ended.
pub fn next(rule: &Rule, due: Date) -> Option<Date> {
    let n = rule.interval.max(1);
    let anchor = rule.zi.unwrap_or(due.d);
    let candidate = match rule.frecventa {
        Freq::Zilnic => add_days(due, i64::from(n)),
        Freq::Saptamanal => {
            let mut days: Vec<u32> = if rule.zile.is_empty() {
                vec![weekday(due)]
            } else {
                rule.zile.clone()
            };
            days.sort_unstable();
            days.dedup();
            let today = weekday(due);
            match days.iter().find(|d| **d > today) {
                // A later chosen day in the same week.
                Some(d) => add_days(due, i64::from(d - today)),
                // Otherwise the first chosen day of the week `n` weeks on.
                None => {
                    let this_monday = add_days(due, -i64::from(today - 1));
                    add_days(this_monday, 7 * i64::from(n) + i64::from(days[0] - 1))
                }
            }
        }
        Freq::Lunar => add_months(due, n, anchor),
        Freq::Anual => add_months(due, 12 * n, anchor),
    };
    match rule.pana_la.as_deref().and_then(crate::dates::parse) {
        Some(end) if candidate > end => None,
        _ => Some(candidate),
    }
}

/// A short Romanian description, e.g. „lunar, ziua 31” or „la 2 săptămâni (luni, vineri)”.
pub fn describe(rule: &Rule) -> String {
    const DAY: [&str; 7] = ["luni", "marți", "miercuri", "joi", "vineri", "sâmbătă", "duminică"];
    let n = rule.interval;
    let base = match (&rule.frecventa, n) {
        (Freq::Zilnic, 1) => "zilnic".to_string(),
        (Freq::Zilnic, n) => format!("la {n} zile"),
        (Freq::Saptamanal, 1) => "săptămânal".to_string(),
        (Freq::Saptamanal, n) => format!("la {n} săptămâni"),
        (Freq::Lunar, 1) => "lunar".to_string(),
        (Freq::Lunar, n) => format!("la {n} luni"),
        (Freq::Anual, 1) => "anual".to_string(),
        (Freq::Anual, n) => format!("la {n} ani"),
    };
    let days: Vec<&str> = rule
        .zile
        .iter()
        .filter_map(|d| DAY.get((*d as usize).wrapping_sub(1)).copied())
        .collect();
    let mut s = if days.is_empty() {
        base
    } else {
        format!("{base} ({})", days.join(", "))
    };
    if let Some(end) = rule.pana_la.as_deref().and_then(crate::dates::parse) {
        s += &format!(", până la {}", end.ro());
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d(s: &str) -> Date {
        crate::dates::parse(s).unwrap()
    }
    fn rule(f: Freq, interval: u32) -> Rule {
        Rule {
            frecventa: f,
            interval,
            zile: vec![],
            zi: None,
            pana_la: None,
        }
    }
    fn series(r: &Rule, start: &str, n: usize) -> Vec<String> {
        let mut out = vec![];
        let mut cur = d(start);
        for _ in 0..n {
            match next(r, cur) {
                Some(x) => {
                    out.push(x.iso());
                    cur = x;
                }
                None => break,
            }
        }
        out
    }

    #[test]
    fn day_arithmetic_round_trips() {
        for s in ["1970-01-01", "2000-02-29", "2026-11-07", "2100-03-01", "1900-02-28"] {
            assert_eq!(from_days(to_days(d(s))).iso(), s);
        }
        assert_eq!(weekday(d("2026-11-07")), 6, "7 Nov 2026 is a Saturday");
        assert_eq!(weekday(d("2026-11-09")), 1);
        assert_eq!(add_days(d("2026-12-31"), 1).iso(), "2027-01-01");
        assert_eq!(add_days(d("2028-02-28"), 1).iso(), "2028-02-29");
    }

    #[test]
    fn monthly_keeps_the_31st() {
        let mut r = rule(Freq::Lunar, 1);
        r.zi = Some(31);
        assert_eq!(
            series(&r, "2027-01-31", 4),
            ["2027-02-28", "2027-03-31", "2027-04-30", "2027-05-31"]
        );
        assert_eq!(series(&r, "2028-01-31", 1), ["2028-02-29"]);
    }

    #[test]
    fn yearly_29_february() {
        let mut r = rule(Freq::Anual, 1);
        r.zi = Some(29);
        assert_eq!(
            series(&r, "2028-02-29", 4),
            ["2029-02-28", "2030-02-28", "2031-02-28", "2032-02-29"]
        );
    }

    #[test]
    fn daily_and_weekly() {
        assert_eq!(
            series(&rule(Freq::Zilnic, 3), "2026-12-30", 2),
            ["2027-01-02", "2027-01-05"]
        );
        // Mon/Wed/Fri starting Monday 9 Nov 2026.
        let mut r = rule(Freq::Saptamanal, 1);
        r.zile = vec![5, 1, 3];
        assert_eq!(
            series(&r, "2026-11-09", 4),
            ["2026-11-11", "2026-11-13", "2026-11-16", "2026-11-18"]
        );
        // Every 2 weeks, on the due date's weekday.
        assert_eq!(
            series(&rule(Freq::Saptamanal, 2), "2026-11-07", 2),
            ["2026-11-21", "2026-12-05"]
        );
        // Every 2 weeks on Tue/Thu, from a Thursday: Tuesday two weeks on.
        let mut r = rule(Freq::Saptamanal, 2);
        r.zile = vec![2, 4];
        assert_eq!(series(&r, "2026-11-12", 2), ["2026-11-24", "2026-11-26"]);
    }

    #[test]
    fn until_ends_the_series() {
        let mut r = rule(Freq::Lunar, 1);
        r.pana_la = Some("2027-03-15".into());
        assert_eq!(series(&r, "2027-01-15", 5), ["2027-02-15", "2027-03-15"]);
    }

    #[test]
    fn checks_and_descriptions() {
        assert!(rule(Freq::Zilnic, 0).check().is_err());
        assert!(rule(Freq::Zilnic, 367).check().is_err());
        let mut r = rule(Freq::Lunar, 1);
        r.zile = vec![1];
        assert!(r.check().is_err(), "weekdays only for weekly");
        let mut r = rule(Freq::Saptamanal, 2);
        r.zile = vec![1, 5];
        assert!(r.check().is_ok());
        r.pana_la = Some("2027-01-31".into());
        assert_eq!(describe(&r), "la 2 săptămâni (luni, vineri), până la 31.01.2027");
        assert_eq!(describe(&rule(Freq::Lunar, 1)), "lunar");
    }
}
