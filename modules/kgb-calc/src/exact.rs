//! Exact rational numbers (i128 numerator / denominator) for the calculator:
//! 0,1 + 0,2 is exactly 0,3, and a result is rounded only when shown, with a
//! mark when the shown value is not exact (D-065). Overflow is an error,
//! never a silent wrong answer.

use std::cmp::Ordering;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Q {
    n: i128,
    d: i128,
}

fn gcd(mut a: i128, mut b: i128) -> i128 {
    a = a.abs();
    b = b.abs();
    while b != 0 {
        (a, b) = (b, a % b);
    }
    a
}

pub type R = Result<Q, String>;

const OVERFLOW: &str = "numerele sunt prea mari pentru un calcul exact";

impl Q {
    pub fn new(n: i128, d: i128) -> R {
        if d == 0 {
            return Err("împărțire la zero".into());
        }
        let g = gcd(n, d).max(1);
        let (mut n, mut d) = (n / g, d / g);
        if d < 0 {
            n = n.checked_neg().ok_or(OVERFLOW)?;
            d = d.checked_neg().ok_or(OVERFLOW)?;
        }
        Ok(Q { n, d })
    }
    pub fn int(n: i128) -> Q {
        Q { n, d: 1 }
    }
    pub fn num(&self) -> i128 {
        self.n
    }
    pub fn den(&self) -> i128 {
        self.d
    }
    pub fn is_zero(&self) -> bool {
        self.n == 0
    }
    pub fn plus(self, o: Q) -> R {
        let g = gcd(self.d, o.d).max(1);
        let d = (self.d / g).checked_mul(o.d).ok_or(OVERFLOW)?;
        let a = self.n.checked_mul(o.d / g).ok_or(OVERFLOW)?;
        let b = o.n.checked_mul(self.d / g).ok_or(OVERFLOW)?;
        Q::new(a.checked_add(b).ok_or(OVERFLOW)?, d)
    }
    pub fn negated(self) -> R {
        Ok(Q {
            n: self.n.checked_neg().ok_or(OVERFLOW)?,
            d: self.d,
        })
    }
    pub fn minus(self, o: Q) -> R {
        self.plus(o.negated()?)
    }
    pub fn times(self, o: Q) -> R {
        let g1 = gcd(self.n, o.d).max(1);
        let g2 = gcd(o.n, self.d).max(1);
        let n = (self.n / g1).checked_mul(o.n / g2).ok_or(OVERFLOW)?;
        let d = (self.d / g2).checked_mul(o.d / g1).ok_or(OVERFLOW)?;
        Q::new(n, d)
    }
    pub fn over(self, o: Q) -> R {
        if o.n == 0 {
            return Err("împărțire la zero".into());
        }
        self.times(Q::new(o.d, o.n)?)
    }

    /// Parses `12`, `12,5`, `2.5`, `-0,25`, `10.000`, `1.234,56` (`1e3` is not
    /// accepted). Dots followed by groups of three digits group thousands.
    pub fn parse(s: &str) -> R {
        let t: String = s.trim().chars().filter(|c| *c != ' ' && *c != '\u{a0}').collect();
        if t.is_empty() {
            return Err("lipsește numărul".into());
        }
        let (neg, body) = match t.strip_prefix('-') {
            Some(r) => (true, r.to_string()),
            None => (false, t.trim_start_matches('+').to_string()),
        };
        // Romanian notation: the comma is the decimal mark and dots group
        // thousands ("10.000" is ten thousand). A dot not followed by groups
        // of exactly three digits ("2.5") is read as a decimal point.
        let thousands = |b: &str| {
            let mut parts = b.split('.');
            let first = parts.next().unwrap_or("");
            !first.is_empty()
                && !first.starts_with('0')
                && first.len() <= 3
                && b.contains('.')
                && parts.all(|g| g.len() == 3)
        };
        let body = if body.contains('.') && body.contains(',') {
            body.replace('.', "").replace(',', ".")
        } else if thousands(&body) {
            body.replace('.', "")
        } else {
            body.replace(',', ".")
        };
        let (int, frac) = body.split_once('.').unwrap_or((&body, ""));
        if int.is_empty() && frac.is_empty()
            || !int.chars().all(|c| c.is_ascii_digit())
            || !frac.chars().all(|c| c.is_ascii_digit())
            || int.len() + frac.len() > 30
        {
            return Err(format!("„{}” nu este un număr", s.trim()));
        }
        let digits = format!("{int}{frac}");
        let n: i128 = if digits.is_empty() {
            0
        } else {
            digits.parse().map_err(|_| OVERFLOW.to_string())?
        };
        let d = 10i128.checked_pow(frac.len() as u32).ok_or(OVERFLOW)?;
        Q::new(if neg { -n } else { n }, d)
    }

    /// Rounded half away from zero to `places` decimals, as a scaled integer.
    pub fn round_scaled(&self, places: u32) -> Result<i128, String> {
        let p = 10i128.checked_pow(places).ok_or(OVERFLOW)?;
        let x = self.n.checked_mul(p).ok_or(OVERFLOW)?;
        let (q, r) = (x / self.d, x % self.d);
        Ok(if r.abs().checked_mul(2).ok_or(OVERFLOW)? >= self.d {
            q + x.signum()
        } else {
            q
        })
    }

    /// Whether the value has at most `places` decimals.
    pub fn exact_at(&self, places: u32) -> bool {
        10i128
            .checked_pow(places)
            .is_some_and(|p| (self.n.checked_mul(p).unwrap_or(1) % self.d) == 0)
    }

    /// Romanian notation: comma for decimals, dot every three digits, at most
    /// `places` decimals (trailing zeros dropped unless `fixed`).
    pub fn ro(&self, places: u32, fixed: bool) -> Result<String, String> {
        let v = self.round_scaled(places)?;
        let neg = v < 0;
        let a = v.unsigned_abs();
        let p = 10u128.pow(places);
        let (int, frac) = (a / p, a % p);
        let int_s = int.to_string();
        let mut grouped = String::new();
        for (i, c) in int_s.chars().enumerate() {
            if i > 0 && (int_s.len() - i) % 3 == 0 {
                grouped.push('.');
            }
            grouped.push(c);
        }
        let mut frac_s = if places > 0 {
            format!("{frac:0width$}", width = places as usize)
        } else {
            String::new()
        };
        if !fixed {
            frac_s = frac_s.trim_end_matches('0').to_string();
        }
        let sign = if neg && (int > 0 || frac > 0) { "-" } else { "" };
        Ok(if frac_s.is_empty() {
            format!("{sign}{grouped}")
        } else {
            format!("{sign}{grouped},{frac_s}")
        })
    }
}

impl PartialOrd for Q {
    fn partial_cmp(&self, o: &Q) -> Option<Ordering> {
        Some(self.cmp(o))
    }
}
impl Ord for Q {
    fn cmp(&self, o: &Q) -> Ordering {
        // Denominators are positive; compare n1*d2 with n2*d1 (i128 is wide
        // enough for the magnitudes the calculator accepts).
        (self.n.saturating_mul(o.d)).cmp(&(o.n.saturating_mul(self.d)))
    }
}

// ---------- expressions ----------

/// Evaluates `+ - * / × ÷ ( ) %` with the usual precedence. `x%` is x/100.
pub fn eval(src: &str) -> R {
    let chars: Vec<char> = src.chars().filter(|c| !c.is_whitespace()).collect();
    if chars.is_empty() {
        return Err("expresia e goală".into());
    }
    if chars.len() > 400 {
        return Err("expresia e prea lungă".into());
    }
    let mut p = Parser { s: chars, i: 0 };
    let v = p.expr()?;
    if p.i != p.s.len() {
        return Err(format!("caracter neașteptat: „{}”", p.s[p.i]));
    }
    Ok(v)
}

struct Parser {
    s: Vec<char>,
    i: usize,
}

impl Parser {
    fn peek(&self) -> Option<char> {
        self.s.get(self.i).copied()
    }
    fn expr(&mut self) -> R {
        let mut v = self.term()?;
        while let Some(c) = self.peek() {
            match c {
                '+' => {
                    self.i += 1;
                    v = v.plus(self.term()?)?;
                }
                '-' | '−' => {
                    self.i += 1;
                    v = v.minus(self.term()?)?;
                }
                _ => break,
            }
        }
        Ok(v)
    }
    fn term(&mut self) -> R {
        let mut v = self.factor()?;
        while let Some(c) = self.peek() {
            match c {
                '*' | '×' | 'x' => {
                    self.i += 1;
                    v = v.times(self.factor()?)?;
                }
                '/' | '÷' | ':' => {
                    self.i += 1;
                    v = v.over(self.factor()?)?;
                }
                _ => break,
            }
        }
        Ok(v)
    }
    fn factor(&mut self) -> R {
        match self.peek() {
            Some('-' | '−') => {
                self.i += 1;
                self.factor()?.negated()
            }
            Some('+') => {
                self.i += 1;
                self.factor()
            }
            Some('(') => {
                self.i += 1;
                let v = self.expr()?;
                if self.peek() != Some(')') {
                    return Err("lipsește o paranteză „)”".into());
                }
                self.i += 1;
                self.percent(v)
            }
            Some(c) if c.is_ascii_digit() || c == ',' || c == '.' => {
                let start = self.i;
                while self.peek().is_some_and(|c| c.is_ascii_digit() || c == ',' || c == '.') {
                    self.i += 1;
                }
                let lit: String = self.s[start..self.i].iter().collect();
                let v = Q::parse(&lit)?;
                self.percent(v)
            }
            Some(c) => Err(format!("caracter neașteptat: „{c}”")),
            None => Err("expresia se termină prea devreme".into()),
        }
    }
    fn percent(&mut self, v: Q) -> R {
        if self.peek() == Some('%') {
            self.i += 1;
            return v.over(Q::int(100));
        }
        Ok(v)
    }
}
