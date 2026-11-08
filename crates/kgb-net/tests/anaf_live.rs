//! Step 7.4b, against the real ANAF service: one request, run by hand only
//! (`cargo test -p kgb-net --test anaf_live -- --ignored`), so the normal
//! test runs never call an outside service.

#[tokio::test]
#[ignore = "calls the real ANAF service; run by hand"]
async fn one_real_lookup() {
    let body = kgb_core::anaf::request_body(&["14399840"], "2026-11-08").unwrap();
    let (status, answer) = kgb_net::web::post_json(kgb_core::anaf::ANAF_URL, body).await.unwrap();
    assert_eq!(status, 200, "{answer}");
    let (found, not_found) = kgb_core::anaf::parse(&answer).unwrap();
    assert!(not_found.is_empty(), "{not_found:?}");
    let c = &found[0];
    assert_eq!(c.cui, "14399840");
    assert!(!c.denumire.is_empty() && !c.localitate.is_empty() && !c.nr_reg_com.is_empty(), "{c:?}");
    println!("găsit: denumire {} caractere, localitate {}, TVA {}", c.denumire.len(), !c.localitate.is_empty(), c.platitor_tva);
}
