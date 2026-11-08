//! Synchronisation over the network: glue between [`Net`] and
//! `kgb_core::replication`, shared by the app and the two-process test node.
//!
//! The workspace is reached through [`Local`], so the caller decides how it
//! is locked (the app keeps it behind its session lock). The lock is never
//! held while waiting for the network.

use std::sync::{Arc, Mutex};

use kgb_core::identity::DeviceIdentity;
use kgb_core::replication::{self, Summary};
use kgb_core::workspace::Workspace;
use kgb_core::{modules, peers};
use serde::Serialize;
use serde_json::Value;

use crate::{Handler, Net, Path};

/// Access to the open workspace and this device.
pub trait Local: Send + Sync + 'static {
    /// Runs `f` with the workspace and device; false when none is open.
    fn run(&self, f: &mut dyn FnMut(&mut Workspace, &DeviceIdentity)) -> bool;
}

fn with<L: Local + ?Sized, R>(local: &L, f: impl FnOnce(&mut Workspace, &DeviceIdentity) -> R) -> Result<R, String> {
    let mut f = Some(f);
    let mut out = None;
    let ran = local.run(&mut |ws, dev| {
        if let Some(f) = f.take() {
            out = Some(f(ws, dev));
        }
    });
    match (ran, out) {
        (true, Some(r)) => Ok(r),
        _ => Err("spațiul de lucru nu este deschis".into()),
    }
}

/// Answers peers' requests from the local workspace.
pub struct SyncHandler<L: Local> {
    local: Arc<L>,
    /// This device's current address, sent along with every answer.
    pub addr: Arc<Mutex<Option<String>>>,
}

impl<L: Local> SyncHandler<L> {
    pub fn new(local: Arc<L>) -> SyncHandler<L> {
        SyncHandler {
            local,
            addr: Arc::new(Mutex::new(None)),
        }
    }
}

impl<L: Local> Handler for SyncHandler<L> {
    fn answer(&self, _peer: &str, request: Value) -> Result<Value, String> {
        let addr = self.addr.lock().ok().and_then(|a| a.clone());
        with(&*self.local, |ws, dev| {
            let r = replication::answer_from(ws.store(), dev, &request, addr.as_deref()).map_err(|e| e.to_string())?;
            // Accepted: remember where the asking device is.
            if let (key, Some(a)) = replication::sender(&request) {
                let _ = peers::remember(ws.store_mut(), &key, &a);
            }
            Ok(r)
        })?
    }
}

/// Result of one synchronisation with one device.
#[derive(Clone, Debug, Serialize)]
pub struct Outcome {
    pub key: String,
    pub label: String,
    pub member: String,
    pub path: Option<Path>,
    pub summary: Option<Summary>,
    pub error: Option<String>,
}

/// Pulls from the device with `key` at `addr`; records the result in the
/// address book and the audit journal.
pub fn pull<L: Local + ?Sized>(
    net: &Net,
    local: &L,
    key: &str,
    addr: &str,
    my_addr: Option<&str>,
) -> Result<(Summary, Path), String> {
    let req = with(local, |ws, dev| {
        replication::request_from(ws.store(), dev, my_addr).map_err(|e| e.to_string())
    })??;
    let exchanged = net.exchange(addr, &req);
    with(local, |ws, dev| {
        let r = exchanged.and_then(|(resp, path)| {
            let (sender, sender_addr) = replication::sender(&resp);
            if sender != key {
                return Err("a răspuns alt dispozitiv decât cel căutat".to_string());
            }
            let s = replication::apply(ws.store_mut(), dev, &resp).map_err(|e| e.to_string())?;
            if let Some(a) = sender_addr {
                let _ = peers::remember(ws.store_mut(), key, &a);
            }
            Ok((s, path))
        });
        let path_name = match &r {
            Ok((_, Path::Relay)) => "relay",
            Ok(_) => "direct",
            Err(_) => "",
        };
        let _ = peers::record(
            ws.store_mut(),
            key,
            r.as_ref().map(|_| path_name).map_err(|e| e.as_str()),
        );
        let detail = match &r {
            Ok((s, _)) => format!(
                "{} create, {} actualizate, {} refuzate",
                s.create, s.actualizate, s.refuzate
            ),
            Err(e) => e.chars().take(200).collect(),
        };
        let _ = modules::audit(
            ws,
            "core.sync",
            "sincronizare",
            if r.is_ok() { "ok" } else { "eroare" },
            &detail,
        );
        r
    })?
}

/// Pulls from every known device of the organization.
pub fn pull_all<L: Local + ?Sized>(net: &Net, local: &L, my_addr: Option<&str>) -> Result<Vec<Outcome>, String> {
    let list = with(local, |ws, dev| {
        peers::list(ws.store(), &dev.public_hex()).map_err(|e| e.to_string())
    })??;
    Ok(list
        .into_iter()
        .map(|p| {
            let mut o = Outcome {
                key: p.key.clone(),
                label: p.label.clone(),
                member: p.member.clone(),
                path: None,
                summary: None,
                error: None,
            };
            match p.addr {
                None => {
                    o.error = Some("adresa lui nu e cunoscută încă (se află la prima sincronizare de la el)".into())
                }
                Some(a) => match pull(net, local, &p.key, &a, my_addr) {
                    Ok((s, path)) => {
                        o.summary = Some(s);
                        o.path = Some(path);
                    }
                    Err(e) => o.error = Some(e),
                },
            }
            o
        })
        .collect())
}
