//! Step 6.3 (D-057, D-059): the synchronisation protocol between two
//! workspaces on the same PC, messages passed in memory (no network).
//! - a new PC joins with the invitation's trust anchor and gets the
//!   organization and the modules its role may read — nothing else;
//! - changes go both ways; changes the author had no right to make are
//!   refused; tampered or foreign messages are refused;
//! - widening a role fills in what was hidden; a narrower role stops writes;
//! - repeating a round changes nothing, also after reopening.

use kgb_core::identity::DeviceIdentity;
use kgb_core::org::{self, Access};
use kgb_core::replication::{self, Summary};
use kgb_core::workspace::Workspace;
use kgb_core::{invites, registry};
use kgb_store::{Fields, Write};
use serde_json::{Value, json};
use uuid::Uuid;

const NOTES: &str = "mod.kgb.notes.items";
const BIZ: &str = "mod.kgb.business.items";

fn dev(t: &tempfile::TempDir, name: &str) -> DeviceIdentity {
    DeviceIdentity::load_or_create(&t.path().join(name)).unwrap()
}

fn put(ws: &mut Workspace, coll: &str, id: Uuid, text: &str) {
    let mut f = Fields::new();
    f.insert("t".into(), json!(text));
    let v = ws.store().get(coll, id).unwrap().map(|r| r.version).unwrap_or(0);
    ws.store_mut().write(vec![Write::put(coll, id, f).expect(v)]).unwrap();
}

fn text(ws: &Workspace, coll: &str, id: Uuid) -> Option<String> {
    ws.store()
        .get(coll, id)
        .unwrap()
        .and_then(|r| r.fields.get("t").and_then(Value::as_str).map(String::from))
}

/// `to` pulls from `from`.
fn pull(to: &mut Workspace, to_dev: &DeviceIdentity, from: &Workspace, from_dev: &DeviceIdentity) -> Summary {
    let req = replication::request(to.store(), to_dev).unwrap();
    let resp = replication::answer(from.store(), from_dev, &req).unwrap();
    replication::apply(to.store_mut(), to_dev, &resp).unwrap()
}

struct Two {
    t: tempfile::TempDir,
    a: Workspace,
    b: Workspace,
    da: DeviceIdentity,
    db: DeviceIdentity,
    ion: Uuid,
}

/// Ana's PC (administrator) and Ion's new PC (Membru), joined by invitation.
fn two() -> Two {
    let t = tempfile::tempdir().unwrap();
    let (da, db) = (dev(&t, "pc-a"), dev(&t, "pc-b"));
    let mut a = Workspace::create(&t.path().join("a"), "A").unwrap();
    let mut b = Workspace::create(&t.path().join("b"), "B").unwrap();
    org::create(a.store_mut(), "Firma Test SRL", "Ana", &da, "PC A").unwrap();
    let ion = org::add_member(a.store_mut(), &da, "Ion", org::role_member()).unwrap();
    let inv = invites::create(a.store_mut(), &da, ion, 24).unwrap();
    let req = invites::request(b.store_mut(), &inv.code, &db, "PC B").unwrap();
    // Not approved yet: A does not answer B.
    let p = invites::receive(a.store_mut(), &da, &req.code).unwrap();
    let sreq = replication::request(b.store(), &db).unwrap();
    let e = replication::answer(a.store(), &da, &sreq).unwrap_err();
    assert!(e.to_string().contains("nu e aprobat"), "{e}");
    invites::approve(a.store_mut(), &da, p.id).unwrap();
    Two { t, a, b, da, db, ion }
}

#[test]
fn join_and_role_limited_data() {
    let Two {
        t,
        mut a,
        mut b,
        da,
        db,
        ion,
    } = two();
    let (n1, f1) = (Uuid::new_v4(), Uuid::new_v4());
    put(&mut a, NOTES, n1, "notă de la Ana");
    put(&mut a, BIZ, f1, "factură");

    let s = pull(&mut b, &db, &a, &da);
    assert!(s.create > 0, "{s:?}");
    assert_eq!(s.refuzate, 0, "{s:?}");
    // B now has the organization and knows it is Ion's PC.
    let cur = org::current(b.store(), &db.fingerprint()).unwrap().unwrap();
    assert_eq!((cur.member.name.as_str(), cur.role.name.as_str()), ("Ion", "Membru"));
    assert!(
        registry::consistency(b.store()).unwrap().is_empty(),
        "{:?}",
        registry::consistency(b.store()).unwrap()
    );
    // Notes yes, business no; A's local things never.
    assert_eq!(text(&b, NOTES, n1).as_deref(), Some("notă de la Ana"));
    assert_eq!(text(&b, BIZ, f1), None);
    assert!(s.ascunse > 0);
    assert_eq!(b.store().count(invites::INVITES_COLLECTION), 0, "invitations stay on A");
    assert_eq!(b.store().count("core.audit"), 0);

    // Ion writes a note; Ana gets it.
    let n2 = Uuid::new_v4();
    put(&mut b, NOTES, n2, "notă de la Ion");
    let s = pull(&mut a, &da, &b, &db);
    assert_eq!(s.refuzate, 0, "{s:?}");
    assert_eq!(text(&a, NOTES, n2).as_deref(), Some("notă de la Ion"));
    // Both edit the same note offline: a conflict, not an overwrite.
    put(&mut a, NOTES, n1, "Ana v2");
    put(&mut b, NOTES, n1, "Ion v2");
    let s = pull(&mut a, &da, &b, &db);
    assert_eq!(s.conflicte, 1, "{s:?}");
    pull(&mut b, &db, &a, &da);
    assert_eq!(
        text(&a, NOTES, n1),
        text(&b, NOTES, n1),
        "same provisional value on both"
    );

    // Ion's PC, bypassing the app, writes business data and makes Membru an
    // administrator role: Ana's PC refuses both.
    let f2 = Uuid::new_v4();
    put(&mut b, BIZ, f2, "factură falsă");
    let r = b.store().get("core.roles", org::role_member()).unwrap().unwrap();
    let mut f = r.fields.clone();
    f.insert("admin".into(), json!(true));
    b.store_mut()
        .write(vec![Write::put("core.roles", org::role_member(), f).expect(r.version)])
        .unwrap();
    let s = pull(&mut a, &da, &b, &db);
    assert_eq!(s.refuzate, 2, "{s:?}");
    assert_eq!(text(&a, BIZ, f2), None);
    assert!(!org::role(a.store(), org::role_member()).unwrap().admin);
    assert!(registry::consistency(a.store()).unwrap().is_empty());

    // Repeating rounds changes nothing; also after reopening.
    let s = pull(&mut b, &db, &a, &da);
    assert_eq!((s.create, s.actualizate, s.refuzate), (0, 0, 0), "{s:?}");
    let (da_dir, db_dir) = (a.dir().to_path_buf(), b.dir().to_path_buf());
    drop((a, b));
    let mut a = Workspace::open(&da_dir).unwrap();
    let b = Workspace::open(&db_dir).unwrap();
    let s = pull(&mut a, &da, &b, &db);
    assert_eq!((s.create, s.actualizate), (0, 0), "{s:?}");
    assert_eq!(text(&a, NOTES, n2).as_deref(), Some("notă de la Ion"));
    let _ = (t, ion);
}

#[test]
fn widened_and_narrowed_roles_and_bad_messages() {
    let Two {
        t,
        mut a,
        mut b,
        da,
        db,
        ion,
    } = two();
    let f1 = Uuid::new_v4();
    put(&mut a, BIZ, f1, "factură");
    pull(&mut b, &db, &a, &da);
    assert_eq!(text(&b, BIZ, f1), None);

    // Ion becomes "Doar citire": he now may read Business — the hidden
    // invoice is filled in — but no longer write notes.
    let v = org::members(a.store(), false)
        .unwrap()
        .into_iter()
        .find(|m| m.id == ion)
        .unwrap()
        .version;
    org::update_member(a.store_mut(), &da, ion, "Ion", org::role_reader(), v).unwrap();
    let s = pull(&mut b, &db, &a, &da);
    assert!(s.completate >= 1, "{s:?}");
    assert_eq!(text(&b, BIZ, f1).as_deref(), Some("factură"));
    assert_eq!(
        org::access(b.store(), Some(&db.fingerprint()), "kgb.notes").unwrap().0,
        Access::Citire
    );
    let n = Uuid::new_v4();
    put(&mut b, NOTES, n, "scrisă fără drept");
    let s = pull(&mut a, &da, &b, &db);
    assert_eq!(s.refuzate, 1, "{s:?}");
    assert!(s.motive.contains_key("autorul nu avea dreptul să o facă"), "{s:?}");
    assert_eq!(text(&a, NOTES, n), None);

    // A tampered answer is refused.
    let req = replication::request(b.store(), &db).unwrap();
    put(&mut a, NOTES, Uuid::new_v4(), "nouă");
    let mut resp = replication::answer(a.store(), &da, &req).unwrap();
    resp["ops"][0]["s"]["f"]["t"] = json!("modificată pe drum");
    let e = replication::apply(b.store_mut(), &db, &resp).unwrap_err();
    assert!(e.to_string().contains("semnătura"), "{e}");

    // A stranger's PC: its requests and answers are refused.
    let dc = dev(&t, "pc-c");
    let mut c = Workspace::create(&t.path().join("c"), "C").unwrap();
    org::create(c.store_mut(), "Alta SRL", "Cora", &dc, "PC C").unwrap();
    let req = replication::request(c.store(), &dc).unwrap();
    assert!(
        replication::answer(a.store(), &da, &req)
            .unwrap_err()
            .to_string()
            .contains("altă organizație")
    );
    let req = replication::request(b.store(), &db).unwrap();
    let mut forged = replication::answer(a.store(), &da, &req).unwrap();
    forged["org"] = json!("x");
    assert!(replication::apply(b.store_mut(), &db, &forged).is_err());
    let resp = replication::answer(c.store(), &dc, &replication::request(c.store(), &dc).unwrap()).unwrap();
    assert!(
        replication::apply(b.store_mut(), &db, &resp).is_err(),
        "answer from another organization"
    );
}

#[test]
fn conflicts_are_shown_by_role_and_decided_everywhere() {
    use kgb_core::conflicts;
    let Two {
        t,
        mut a,
        mut b,
        da,
        db,
        ion,
    } = two();
    let n = Uuid::new_v4();
    put(&mut a, NOTES, n, "start");
    pull(&mut b, &db, &a, &da);
    put(&mut a, NOTES, n, "varianta Anei");
    put(&mut b, NOTES, n, "varianta lui Ion");
    pull(&mut a, &da, &b, &db);
    pull(&mut b, &db, &a, &da);
    let (fa, fb) = (da.fingerprint(), db.fingerprint());
    let ca = conflicts::list(&a, Some(&fa)).unwrap();
    let cb = conflicts::list(&b, Some(&fb)).unwrap();
    assert_eq!((ca.len(), cb.len()), (1, 1));
    assert_eq!(ca[0].id, cb[0].id, "the same conflict on both PCs");
    assert_eq!(
        (ca[0].aici.as_str(), ca[0].venit.as_str()),
        ("varianta Anei", "varianta lui Ion")
    );
    assert_eq!(ca[0].modul.as_deref(), Some("kgb.notes"));
    assert_eq!(ca[0].camp.as_deref(), Some("t"));
    assert!(ca[0].poate_decide && cb[0].poate_decide);

    // As "Doar citire", Ion sees it but cannot decide.
    let v = org::members(a.store(), false)
        .unwrap()
        .into_iter()
        .find(|m| m.id == ion)
        .unwrap()
        .version;
    org::update_member(a.store_mut(), &da, ion, "Ion", org::role_reader(), v).unwrap();
    pull(&mut b, &db, &a, &da);
    let cb = conflicts::list(&b, Some(&fb)).unwrap();
    assert!(!cb[0].poate_decide);
    let e = conflicts::decide(&mut b, Some(&fb), cb[0].id, true).unwrap_err();
    assert!(e.to_string().contains("nu poate decide"), "{e}");

    // Ana keeps Ion's version; Ion's PC gets the decision.
    conflicts::decide(&mut a, Some(&fa), ca[0].id, false).unwrap();
    assert!(conflicts::list(&a, Some(&fa)).unwrap().is_empty());
    let s = pull(&mut b, &db, &a, &da);
    assert_eq!(s.refuzate, 0, "{s:?}");
    assert!(
        conflicts::list(&b, Some(&fb)).unwrap().is_empty(),
        "resolved on Ion's PC too"
    );
    assert_eq!(text(&a, NOTES, n).as_deref(), Some("varianta lui Ion"));
    assert_eq!(text(&b, NOTES, n).as_deref(), Some("varianta lui Ion"));
    assert!(
        conflicts::decide(&mut a, Some(&fa), ca[0].id, true).is_err(),
        "only once"
    );
    let _ = t;
}

#[test]
fn revoked_device_is_refused_everywhere() {
    let Two {
        t,
        mut a,
        mut b,
        da,
        db,
        ion: _,
    } = two();
    // A third PC: Maria's.
    let dc = dev(&t, "pc-c");
    let mut c = Workspace::create(&t.path().join("c"), "C").unwrap();
    let maria = org::add_member(a.store_mut(), &da, "Maria", org::role_member()).unwrap();
    let inv = invites::create(a.store_mut(), &da, maria, 24).unwrap();
    let req = invites::request(c.store_mut(), &inv.code, &dc, "PC C").unwrap();
    let p = invites::receive(a.store_mut(), &da, &req.code).unwrap();
    invites::approve(a.store_mut(), &da, p.id).unwrap();
    pull(&mut b, &db, &a, &da);
    pull(&mut c, &dc, &a, &da);

    // Before: Ion's note travels normally.
    let before = Uuid::new_v4();
    put(&mut b, NOTES, before, "înainte de revocare");
    pull(&mut a, &da, &b, &db);
    assert_eq!(text(&a, NOTES, before).as_deref(), Some("înainte de revocare"));

    // Only an administrator revokes, never this PC itself.
    assert!(org::revoke_device(b.store_mut(), &db, &dc.fingerprint()).is_err());
    assert!(org::revoke_device(a.store_mut(), &da, &da.fingerprint()).is_err());
    org::revoke_device(a.store_mut(), &da, &db.fingerprint()).unwrap();
    assert!(
        org::revoke_device(a.store_mut(), &da, &db.fingerprint()).is_err(),
        "only once"
    );
    assert!(registry::consistency(a.store()).unwrap().is_empty());
    // Ion stays in the organization; only that PC is out.
    assert!(org::members(a.store(), false).unwrap().iter().any(|m| m.name == "Ion"));
    assert_eq!(
        org::access(a.store(), Some(&db.fingerprint()), "kgb.notes").unwrap().0,
        Access::Niciunul
    );

    // The revoked PC can no longer ask, and its answers are not accepted.
    let after = Uuid::new_v4();
    put(&mut b, NOTES, after, "după revocare");
    let req = replication::request(b.store(), &db).unwrap();
    assert!(
        replication::answer(a.store(), &da, &req)
            .unwrap_err()
            .to_string()
            .contains("nu e aprobat")
    );
    let resp = replication::answer(b.store(), &db, &replication::request(a.store(), &da).unwrap()).unwrap();
    assert!(replication::apply(a.store_mut(), &da, &resp).is_err());

    // Maria's PC does not know yet: it still takes B's late change...
    let s = pull(&mut c, &dc, &b, &db);
    assert_eq!(text(&c, NOTES, after).as_deref(), Some("după revocare"), "{s:?}");
    // ...but where the revocation is known, that change is refused, even
    // when it comes through Maria's PC (its author was revoked by then).
    let s = pull(&mut a, &da, &c, &dc);
    assert!(s.refuzate >= 1, "{s:?}");
    assert_eq!(text(&a, NOTES, after), None);
    assert_eq!(
        text(&a, NOTES, before).as_deref(),
        Some("înainte de revocare"),
        "earlier changes stay valid"
    );

    // The revocation reaches Maria's PC through A; from then on she refuses B.
    pull(&mut c, &dc, &a, &da);
    assert!(registry::verify(c.store()).unwrap().devices[&db.public_hex()].revoked);
    let req = replication::request(b.store(), &db).unwrap();
    assert!(replication::answer(c.store(), &dc, &req).is_err());
    let resp = replication::answer(b.store(), &db, &replication::request(c.store(), &dc).unwrap()).unwrap();
    assert!(replication::apply(c.store_mut(), &dc, &resp).is_err());
    // Known limit (D-060): what Maria's PC took before it knew stays there.
    assert_eq!(text(&c, NOTES, after).as_deref(), Some("după revocare"));

    // The revoked key cannot be approved again with a new invitation.
    let ion2 = org::add_member(a.store_mut(), &da, "Ion 2", org::role_member()).unwrap();
    let inv = invites::create(a.store_mut(), &da, ion2, 24).unwrap();
    let req = invites::request(b.store_mut(), &inv.code, &db, "PC B").unwrap();
    assert!(invites::receive(a.store_mut(), &da, &req.code).is_err());
}
