//! The network in the app (Etapa 6, step 6.5): starts iroh with the device
//! key when the workspace belongs to an organization, answers the other
//! devices, and synchronises with them every minute and on request.
//!
//! Lock order: the network slot first, then the session — never the reverse.
//! The session lock is never held while waiting for the network.

use std::sync::{Arc, Mutex};
use std::time::Duration;

use kgb_core::identity::DeviceIdentity;
use kgb_core::workspace::Workspace;
use kgb_core::{invites, peers, registry};
use kgb_net::sync::{Local, Outcome, SyncHandler, pull_all};
use kgb_net::{Net, Relay};

use crate::Session;

pub type SharedSession = Arc<Mutex<Option<Session>>>;

/// Lets the network reach the open workspace through the session lock.
pub struct AppLocal(pub SharedSession);

impl Local for AppLocal {
    fn run(&self, f: &mut dyn FnMut(&mut Workspace, &DeviceIdentity)) -> bool {
        let Ok(mut g) = self.0.lock() else { return false };
        match g.as_mut() {
            Some(s) => {
                f(&mut s.ws, &s.device);
                true
            }
            None => false,
        }
    }
}

pub struct Running {
    pub net: Net,
    pub addr: String,
    pub local: Arc<AppLocal>,
}

#[derive(Default)]
pub struct NetSlot {
    pub running: Mutex<Option<Arc<Running>>>,
    /// Why the network is not running (shown on screen).
    pub why_not: Mutex<Option<String>>,
    /// One synchronisation round at a time.
    pub busy: Mutex<()>,
    pub last: Mutex<Option<(u64, Vec<Outcome>)>>,
}

/// Whether this workspace belongs to (or asked to join) an organization.
fn wanted(session: &SharedSession) -> bool {
    let Ok(g) = session.lock() else { return false };
    g.as_ref().is_some_and(|s| {
        registry::verify(s.ws.store()).is_ok_and(|st| st.org.is_some())
            || invites::join_anchor(s.ws.store()).is_ok_and(|a| a.is_some())
    })
}

/// Starts the network if the workspace needs it (or `force`) and it is not
/// running. Returns this device's address when running.
pub fn ensure(slot: &NetSlot, session: &SharedSession, force: bool) -> Result<Option<String>, String> {
    let mut run = slot
        .running
        .lock()
        .map_err(|_| "rețeaua e blocată după o eroare".to_string())?;
    if let Some(r) = run.as_ref() {
        return Ok(Some(r.addr.clone()));
    }
    if !force && !wanted(session) {
        *slot.why_not.lock().unwrap() =
            Some("rețeaua pornește doar când spațiul de lucru face parte dintr-o organizație".into());
        return Ok(None);
    }
    let (secret, relay, port) = {
        let g = session.lock().map_err(|_| "starea aplicației e blocată".to_string())?;
        let s = g.as_ref().ok_or("spațiul de lucru nu este deschis")?;
        let (relay, port) = peers::network_settings(s.ws.store()).map_err(|e| e.to_string())?;
        (s.device.secret_bytes(), relay, port)
    };
    let local = Arc::new(AppLocal(session.clone()));
    let handler = Arc::new(SyncHandler::new(local.clone()));
    let cell = handler.addr.clone();
    let net = match Net::start(&secret, Relay::parse(&relay), port, handler) {
        Ok(n) => n,
        Err(e) => {
            *slot.why_not.lock().unwrap() = Some(e.clone());
            return Err(e);
        }
    };
    let addr = net.addr();
    *cell.lock().unwrap() = Some(addr.clone());
    if net.port() != port {
        let mut g = session.lock().map_err(|_| "starea aplicației e blocată".to_string())?;
        if let Some(s) = g.as_mut() {
            let _ = peers::save_network_settings(s.ws.store_mut(), &relay, net.port());
        }
    }
    tracing::info!(port = net.port(), relay = %relay, "network started");
    *slot.why_not.lock().unwrap() = None;
    *run = Some(Arc::new(Running {
        net,
        addr: addr.clone(),
        local,
    }));
    Ok(Some(addr))
}

/// Stops the network (e.g. before switching workspaces or changing the relay).
pub fn stop(slot: &NetSlot) {
    let r = slot.running.lock().ok().and_then(|mut g| g.take());
    if let Some(r) = r {
        // Wait for a running round to end; then the endpoint can close.
        let _busy = slot.busy.lock();
        if let Ok(r) = Arc::try_unwrap(r) {
            r.net.shutdown();
        }
    }
}

/// One round with every known device (skipped if one is already running).
pub fn round(slot: &NetSlot) -> Result<Vec<Outcome>, String> {
    let Ok(_busy) = slot.busy.try_lock() else {
        return Err("o sincronizare e deja în curs".into());
    };
    let Some(r) = slot.running.lock().ok().and_then(|g| g.clone()) else {
        return Err(slot
            .why_not
            .lock()
            .ok()
            .and_then(|w| w.clone())
            .unwrap_or_else(|| "rețeaua nu e pornită".into()));
    };
    let out = pull_all(&r.net, &*r.local, Some(&r.addr))?;
    *slot.last.lock().unwrap() = Some((kgb_core::workspace::now_ms(), out.clone()));
    Ok(out)
}

/// Background: start when needed, then a round every minute.
pub fn background(slot: Arc<NetSlot>, session: SharedSession) {
    std::thread::Builder::new()
        .name("kgb-sync".into())
        .spawn(move || {
            loop {
                if let Err(e) = ensure(&slot, &session, false) {
                    tracing::warn!("network not started: {e}");
                }
                if slot.running.lock().is_ok_and(|g| g.is_some()) {
                    let _ = round(&slot);
                }
                std::thread::sleep(Duration::from_secs(60));
            }
        })
        .expect("sync thread");
}
