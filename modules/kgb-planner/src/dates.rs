//! Calendar dates without a time zone (due dates are days, not instants).
//! Accepts `aaaa-ll-zz` and `zz.ll.aaaa`; checks the date exists.

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct Date {
    pub y: i32,
    pub m: u32,
    pub d: u32,
}

pub fn days_in_month(y: i32, m: u32) -> u32 {
    match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if (y % 4 == 0 && y % 100 != 0) || y % 400 == 0 => 29,
        _ => 28,
    }
}

impl Date {
    pub fn new(y: i32, m: u32, d: u32) -> Option<Date> {
        ((1900..=2200).contains(&y) && (1..=12).contains(&m) && d >= 1 && d <= days_in_month(y, m)).then_some(Date {
            y,
            m,
            d,
        })
    }
    pub fn iso(&self) -> String {
        format!("{:04}-{:02}-{:02}", self.y, self.m, self.d)
    }
    pub fn ro(&self) -> String {
        format!("{:02}.{:02}.{:04}", self.d, self.m, self.y)
    }
}

pub fn parse(s: &str) -> Option<Date> {
    let s = s.trim();
    let p: Vec<&str> = s.split(['-', '.', '/']).collect();
    if p.len() != 3 {
        return None;
    }
    let n = |x: &str| x.parse::<u32>().ok();
    if p[0].len() == 4 {
        Date::new(p[0].parse().ok()?, n(p[1])?, n(p[2])?)
    } else if p[2].len() == 4 {
        Date::new(p[2].parse().ok()?, n(p[1])?, n(p[0])?)
    } else {
        None
    }
}
