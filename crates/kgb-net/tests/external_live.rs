//! Step 7.4e against the real services: one BNR request and one MET Norway
//! request, run by hand only
//! (`cargo test -p kgb-net --test external_live -- --ignored`).

#[tokio::test]
#[ignore = "calls the real BNR and MET Norway services; run by hand"]
async fn one_real_request_each() {
    let a = kgb_net::web::get(kgb_core::fx::BNR_URL, kgb_core::weather::USER_AGENT, None).await.unwrap();
    assert_eq!(a.status, 200);
    let d = kgb_core::fx::parse(&a.body).unwrap();
    println!("BNR: {} EUR {} USD {}", d.data, d.rate("EUR").unwrap().text, d.rate("USD").unwrap().text);

    let url = kgb_core::weather::url_for("bucuresti").unwrap();
    let w = kgb_net::web::get(&url, kgb_core::weather::USER_AGENT, None).await.unwrap();
    assert_eq!(w.status, 200, "{}", w.body);
    println!("MET: Expires {:?}, Last-Modified {:?}", w.expires, w.last_modified);
    let t = kgb_core::weather::parse(&w.body, "bucuresti", "2026-11-09", 120).unwrap();
    println!("MET: {} {} °C, {}, min {} max {}", t.oras, t.temperatura, t.cer, t.minima, t.maxima);
}
