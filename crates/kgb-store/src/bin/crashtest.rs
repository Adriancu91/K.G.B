//! Forced-termination test (Master Plan §9.3 point 8).
//!
//! `crashtest run <dir> <iterations>` repeatedly starts `crashtest writer <dir>`,
//! kills it at a random moment (TerminateProcess on Windows — like closing the app
//! from Task Manager), reopens the store and checks:
//!   1. every transaction the writer reported as committed (ACK) is present;
//!   2. no transaction is partially visible (each writes 3 records or none).
//!
//! `crashtest run <dir> <iterations> compact` does the same while the writer
//! also rewrites older transactions (creating garbage) and runs incremental
//! compaction steps and occasional full compactions (Etapa 2, step 2.5), with
//! small segments so that segments are replaced often.
//!
//! Limitation: killing a process does not lose the OS write cache, so this does not
//! prove behaviour on power loss; that needs a VM with hard power-off (Etapa 2).

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write as _};
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

use kgb_store::{Options, Store, Write};
use serde_json::json;
use uuid::Uuid;

const PER_TXN: u128 = 3;

fn rec_id(txn: u64, i: u128) -> Uuid {
    Uuid::from_u128(((txn as u128) << 8) | i)
}

fn options(compact: bool) -> Options {
    Options {
        segment_max_bytes: if compact {
            64 * 1024
        } else {
            Options::default().segment_max_bytes
        },
        ..Options::default()
    }
}

fn writer(dir: &Path, compact: bool) {
    let mut s = Store::open(dir, options(compact)).expect("open");
    let start = s
        .ids("crash")
        .iter()
        .map(|id| (id.as_u128() >> 8) as u64)
        .max()
        .map_or(1, |m| m + 1);
    let out = std::io::stdout();
    for txn in start..=u64::MAX {
        let pad = "x".repeat(400);
        let rec = |t: u64, i: u128, generation: u64| {
            let serde_json::Value::Object(f) = json!({"txn": t, "i": i as u64, "gen": generation, "pad": pad}) else {
                unreachable!()
            };
            Write::put("crash", rec_id(t, i), f)
        };
        let mut batch: Vec<Write> = (0..PER_TXN).map(|i| rec(txn, i, 0)).collect();
        if compact && txn > start {
            // Rewrite an older transaction completely, so old frames become garbage.
            let old = start + (txn * 7919) % (txn - start);
            batch.extend((0..PER_TXN).map(|i| rec(old, i, txn)));
        }
        s.write(batch).expect("write");
        if compact && txn % 10 == 0 {
            s.compact_step(0.2).expect("compact step");
        }
        if compact && txn % 250 == 0 {
            s.compact().expect("full compaction");
        }
        let mut o = out.lock();
        writeln!(o, "ACK {txn}").unwrap();
        o.flush().unwrap();
    }
}

struct Rng(u64);
impl Rng {
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 7;
        self.0 ^= self.0 << 17;
        self.0
    }
}

fn verify(dir: &Path, last_ack: u64, compact: bool) -> Result<(u64, bool), String> {
    let s = Store::open(dir, options(compact)).map_err(|e| format!("open failed: {e}"))?;
    let torn = s.recovery_report().torn_tail.is_some();
    let mut per_txn: HashMap<u64, u128> = HashMap::new();
    for id in s.ids("crash") {
        *per_txn.entry((id.as_u128() >> 8) as u64).or_default() += 1;
    }
    for (txn, n) in &per_txn {
        if *n != PER_TXN {
            return Err(format!("transaction {txn} partially visible: {n} of {PER_TXN} records"));
        }
    }
    for txn in 1..=last_ack {
        if !per_txn.contains_key(&txn) {
            return Err(format!("acknowledged transaction {txn} lost"));
        }
    }
    let max = per_txn.keys().copied().max().unwrap_or(0);
    Ok((max, torn))
}

fn run(dir: &Path, iterations: u32, compact: bool) {
    let exe = std::env::current_exe().unwrap();
    let mut rng = Rng(0x9E3779B97F4A7C15 ^ Instant::now().elapsed().as_nanos() as u64 ^ std::process::id() as u64);
    let mut last_ack = 0u64;
    let mut torn_count = 0;
    let mut beyond_ack = 0;
    let t0 = Instant::now();
    for it in 1..=iterations {
        let mut child = Command::new(&exe)
            .arg("writer")
            .arg(dir)
            .arg(if compact { "compact" } else { "plain" })
            .stdout(Stdio::piped())
            .spawn()
            .expect("spawn writer");
        let stdout = child.stdout.take().unwrap();
        let (tx, rx) = mpsc::channel();
        let reader = thread::spawn(move || {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                if let Some(n) = line.strip_prefix("ACK ").and_then(|n| n.parse::<u64>().ok()) {
                    let _ = tx.send(n);
                }
            }
        });
        thread::sleep(Duration::from_millis(20 + rng.next() % 180));
        child.kill().expect("kill");
        child.wait().unwrap();
        reader.join().unwrap();
        while let Ok(n) = rx.try_recv() {
            last_ack = last_ack.max(n);
        }
        match verify(dir, last_ack, compact) {
            Ok((max, torn)) => {
                if torn {
                    torn_count += 1;
                }
                if max > last_ack {
                    beyond_ack += 1; // committed but killed before printing ACK: allowed
                }
                last_ack = last_ack.max(max);
            }
            Err(e) => {
                println!("FAIL iteration {it}: {e}");
                std::process::exit(1);
            }
        }
    }
    println!(
        "PASS {iterations} forced kills in {:.1}s: {last_ack} transactions intact, torn tails repaired {torn_count}, committed-before-ACK {beyond_ack}, 0 lost, 0 partial",
        t0.elapsed().as_secs_f64()
    );
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    match args.get(1).map(String::as_str) {
        Some("writer") => writer(Path::new(&args[2]), args.get(3).is_some_and(|m| m == "compact")),
        Some("run") => run(
            Path::new(&args[2]),
            args.get(3).and_then(|n| n.parse().ok()).unwrap_or(100),
            args.get(4).is_some_and(|m| m == "compact"),
        ),
        _ => eprintln!("usage: crashtest run <dir> <iterations> [compact]"),
    }
}
