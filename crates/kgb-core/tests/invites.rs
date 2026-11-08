//! Step 6.2 (D-058): invitations, device approval and the signed registry,
//! between two workspaces on the same PC (each with its own device key).
//! - invitation: expiry, one use, no private key, tamper-evident;
//! - request: signed by the new device; accepted only for a valid invitation
//!   of this organization; waits for the administrator's approval;
//! - approval: the device joins the person, signed in the registry;
//! - registry: forged or altered entries are ignored and reported.

use kgb_core::identity::DeviceIdentity;
use kgb_core::invites;
use kgb_core::org::{self, Access};
use kgb_core::registry::{self, REGISTRY_COLLECTION};
use kgb_core::workspace::Workspace;
use kgb_store::Write;
use serde_json::json;

fn dev(t: &tempfile::TempDir, name: &str) -> DeviceIdentity {
    DeviceIdentity::load_or_create(&t.path().join(name)).unwrap()
}

/// Changes one character in the middle of a code.
fn tamper(code: &str) -> String {
    let mut c: Vec<char> = code.chars().collect();
    let i = c.len() * 2 / 3;
    c[i] = if c[i] == 'A' { 'B' } else { 'A' };
    c.into_iter().collect()
}

#[test]
fn invite_request_approve_and_registry() {
    let t = tempfile::tempdir().unwrap();
    let (a, b) = (dev(&t, "pc-ana"), dev(&t, "pc-ion"));
    let mut ws = Workspace::create(&t.path().join("ana"), "Ana").unwrap();
    org::create(ws.store_mut(), "Firma Test SRL", "Ana", &a, "Laptop Ana").unwrap();
    let ion = org::add_member(ws.store_mut(), &a, "Ion", org::role_member()).unwrap();

    let inv = invites::create(ws.store_mut(), &a, ion, 24).unwrap();
    assert!(inv.code.starts_with("KGB-INVITATIE-1:"));
    assert!(invites::create(ws.store_mut(), &a, ion, 0).is_err(), "1 … 168 hours");
    assert!(invites::create(ws.store_mut(), &a, ion, 169).is_err());
    // No private key inside: the decoded invitation has only public fields.
    let decoded = String::from_utf8(
        base64_decode(inv.code.trim_start_matches("KGB-INVITATIE-1:")),
    )
    .unwrap();
    for k in ["admin_key", "expires_ms", "member", "org", "org_name", "sig", "token", "\"v\""] {
        assert!(decoded.contains(k), "{k} in {decoded}");
    }
    assert!(!decoded.contains("secret") && !decoded.contains("sealed"));

    // The new PC reads the invitation and answers.
    let info = invites::read(&inv.code).unwrap();
    assert_eq!((info.org_name.as_str(), info.member.as_str()), ("Firma Test SRL", "Ion"));
    assert_eq!(info.admin_fingerprint, a.fingerprint());
    assert!(invites::read(&tamper(&inv.code)).is_err(), "altered invitation refused");
    assert!(invites::read("ceva oarecare").is_err());
    let req = invites::request(&inv.code, &b, "PC Ion").unwrap();
    assert_eq!(req.fingerprint, b.fingerprint());

    // The administrator's PC: altered request refused, the real one waits.
    let e = invites::receive(ws.store_mut(), &a, &tamper(&req.code)).unwrap_err();
    assert!(e.to_string().contains("modificat"), "{e}");
    let p = invites::receive(ws.store_mut(), &a, &req.code).unwrap();
    assert_eq!(p.fingerprint, b.fingerprint(), "the same fingerprint on both PCs");
    assert_eq!(p.member, "Ion");
    let e = invites::receive(ws.store_mut(), &a, &req.code).unwrap_err();
    assert!(e.to_string().contains("deja folosită"), "{e}");
    assert_eq!(invites::list(ws.store()).unwrap()[0].stare, "folosită");

    // Waiting is not joining.
    assert_eq!(org::access(ws.store(), Some(&b.fingerprint()), "kgb.notes").unwrap().0, Access::Niciunul);
    // Only an administrator approves.
    assert!(invites::approve(ws.store_mut(), &b, p.id).is_err());
    invites::approve(ws.store_mut(), &a, p.id).unwrap();
    assert!(invites::pending(ws.store()).unwrap().is_empty());
    assert_eq!(org::access(ws.store(), Some(&b.fingerprint()), "kgb.notes").unwrap().0, Access::Scriere);
    assert_eq!(org::access(ws.store(), Some(&b.fingerprint()), "kgb.business").unwrap().0, Access::Niciunul);

    // The registry agrees: Ion's PC is listed, nothing rejected.
    let st = registry::verify(ws.store()).unwrap();
    assert!(st.rejected.is_empty(), "{:?}", st.rejected);
    assert_eq!(st.member_of(&b.public_hex()).unwrap().1.name, "Ion");
    assert!(st.is_admin(&a.public_hex()) && !st.is_admin(&b.public_hex()));
    assert!(registry::consistency(ws.store()).unwrap().is_empty());

    // A member cannot invite.
    assert!(invites::create(ws.store_mut(), &b, ion, 24).is_err());

    // Survives reopening.
    let dir = ws.dir().to_path_buf();
    drop(ws);
    let ws = Workspace::open(&dir).unwrap();
    assert!(registry::consistency(ws.store()).unwrap().is_empty());
    assert_eq!(org::current(ws.store(), &b.fingerprint()).unwrap().unwrap().member.name, "Ion");
}

#[test]
fn expired_foreign_refused_and_forged() {
    let t = tempfile::tempdir().unwrap();
    let (a, b, c, d) = (dev(&t, "a"), dev(&t, "b"), dev(&t, "c"), dev(&t, "d"));
    let mut ws = Workspace::create(&t.path().join("ws"), "A").unwrap();
    org::create(ws.store_mut(), "Firma Test SRL", "Ana", &a, "Laptop").unwrap();
    let ion = org::add_member(ws.store_mut(), &a, "Ion", org::role_member()).unwrap();

    // Expired on the new PC.
    let old = invites::create_until(ws.store_mut(), &a, ion, 1).unwrap();
    assert!(invites::read(&old.code).unwrap_err().to_string().contains("expirat"));
    assert!(invites::request(&old.code, &b, "PC").is_err());
    assert_eq!(invites::list(ws.store()).unwrap().iter().filter(|i| i.stare == "expirată").count(), 1);

    // Expired between the request and its arrival.
    let soon = invites::create_until(ws.store_mut(), &a, ion, kgb_core::workspace::now_ms() + 300).unwrap();
    let req = invites::request(&soon.code, &b, "PC").unwrap();
    std::thread::sleep(std::time::Duration::from_millis(400));
    assert!(invites::receive(ws.store_mut(), &a, &req.code).unwrap_err().to_string().contains("expirat"));

    // A request made from another organization's invitation.
    let mut other = Workspace::create(&t.path().join("other"), "C").unwrap();
    org::create(other.store_mut(), "Alta SRL", "Cora", &c, "PC Cora").unwrap();
    let x = org::add_member(other.store_mut(), &c, "Xenia", org::role_member()).unwrap();
    let foreign = invites::create(other.store_mut(), &c, x, 1).unwrap();
    let req = invites::request(&foreign.code, &d, "PC").unwrap();
    assert!(invites::receive(ws.store_mut(), &a, &req.code).unwrap_err().to_string().contains("altă organizație"));

    // Refused: the device does not join and the invitation stays used.
    let inv = invites::create(ws.store_mut(), &a, ion, 1).unwrap();
    let p = invites::receive(ws.store_mut(), &a, &invites::request(&inv.code, &d, "PC D").unwrap().code).unwrap();
    invites::refuse(ws.store_mut(), &a, p.id).unwrap();
    assert!(invites::pending(ws.store()).unwrap().is_empty());
    assert_eq!(org::access(ws.store(), Some(&d.fingerprint()), "kgb.notes").unwrap().0, Access::Niciunul);
    assert!(invites::receive(ws.store_mut(), &a, &invites::request(&inv.code, &d, "PC D").unwrap().code).is_err());

    // Forged registry entries: signed by a device that is not an
    // administrator's (makes Ion admin), and an altered real entry.
    let forged = registry::signed_writes(
        ws.store(),
        &b,
        vec![("persoana", json!({"id": ion.to_string(), "name": "Ion", "role": org::role_admin().to_string(), "active": true}))],
    );
    ws.store_mut().write(forged).unwrap();
    let st = registry::verify(ws.store()).unwrap();
    assert_eq!(st.rejected.len(), 1, "{:?}", st.rejected);
    assert!(st.rejected[0].contains("nu e al unui administrator"));
    assert_eq!(st.members[&ion].role, org::role_member(), "the forged change had no effect");

    let real = ws
        .store()
        .scan(REGISTRY_COLLECTION, |r| r.fields.get("kind") == Some(&json!("persoana")) && r.fields.get("signer") == Some(&json!(a.public_hex())))
        .unwrap()
        .remove(0);
    let mut f = real.fields.clone();
    f.get_mut("payload").unwrap()["role"] = json!(org::role_admin().to_string());
    ws.store_mut()
        .write(vec![Write::put(REGISTRY_COLLECTION, real.id, f).expect(real.version)])
        .unwrap();
    let st = registry::verify(ws.store()).unwrap();
    assert!(st.rejected.iter().any(|r| r.contains("semnătură invalidă")), "{:?}", st.rejected);
    assert!(!registry::consistency(ws.store()).unwrap().is_empty(), "the check reports it");
}

fn base64_decode(s: &str) -> Vec<u8> {
    use base64::Engine;
    base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(s).unwrap()
}
