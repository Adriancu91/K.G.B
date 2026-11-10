//! D-086: requests the person asks for, against a small server on 127.0.0.1 started by the test itself (the
//! loopback is allowed only through the test switch, never from a page): the answer comes back, the size limit
//! holds, a redirect to the local network or too many redirects are refused, a time-stamp request is a POST
//! with its content type, and without the switch the loopback is refused before any connection.

use std::sync::{Arc, Mutex};

use kgb_net::web::{Purpose, user_fetch};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

/// A server answering every request with `answer(path)`; it keeps the request heads it saw.
async fn server(answer: fn(&str) -> Vec<u8>) -> (u16, Arc<Mutex<Vec<String>>>) {
    let l = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = l.local_addr().unwrap().port();
    let seen = Arc::new(Mutex::new(Vec::new()));
    let keep = seen.clone();
    tokio::spawn(async move {
        loop {
            let Ok((mut s, _)) = l.accept().await else { return };
            let keep = keep.clone();
            tokio::spawn(async move {
                let mut buf = vec![0u8; 64 * 1024];
                let n = s.read(&mut buf).await.unwrap_or(0);
                let head = String::from_utf8_lossy(&buf[..n]).to_string();
                let path = head.split_whitespace().nth(1).unwrap_or("/").to_string();
                keep.lock().unwrap().push(head);
                let _ = s.write_all(&answer(&path)).await;
                let _ = s.shutdown().await;
            });
        }
    });
    (port, seen)
}

fn ok(body: &[u8], kind: &str) -> Vec<u8> {
    let mut r = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: {kind}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    )
    .into_bytes();
    r.extend_from_slice(body);
    r
}
fn redirect(to: &str) -> Vec<u8> {
    format!("HTTP/1.1 302 Found\r\nLocation: {to}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").into_bytes()
}

fn answer(path: &str) -> Vec<u8> {
    match path {
        "/tabel.csv" => ok("Produs;Pret\nCiment;32,50\n".as_bytes(), "text/csv"),
        "/mare" => ok(&vec![b'x'; 11 * 1024 * 1024], "application/octet-stream"),
        "/spre-retea" => redirect("http://192.168.1.1/admin"),
        p if p.starts_with("/bucla") => {
            let n: u32 = p.trim_start_matches("/bucla").parse().unwrap_or(0);
            redirect(&format!("/bucla{}", n + 1))
        }
        "/tsa" => ok(&[0x30, 0x03, 0x02, 0x01, 0x00], "application/timestamp-reply"),
        _ => ok(b"?", "text/plain"),
    }
}

#[tokio::test]
async fn the_persons_requests_follow_the_rules() {
    let (port, seen) = server(answer).await;
    let at = |p: &str| format!("http://127.0.0.1:{port}{p}");

    // Without the test switch the loopback is refused before any connection.
    let e = user_fetch(&at("/tabel.csv"), Purpose::Page, None, true, false)
        .await
        .unwrap_err();
    assert!(e.contains("acest calculator"), "{e}");
    assert!(seen.lock().unwrap().is_empty(), "nothing reached the server");

    // An http:// address needs the person's confirmation.
    let e = user_fetch(&at("/tabel.csv"), Purpose::Page, None, false, true)
        .await
        .unwrap_err();
    assert!(e.contains("http://"), "{e}");

    let r = user_fetch(&at("/tabel.csv"), Purpose::Page, None, true, true)
        .await
        .unwrap();
    assert_eq!(r.status, 200);
    assert_eq!(r.content_type, "text/csv");
    assert_eq!(String::from_utf8(r.data).unwrap(), "Produs;Pret\nCiment;32,50\n");
    let head = seen.lock().unwrap().last().unwrap().to_lowercase();
    assert!(head.starts_with("get /tabel.csv"), "{head}");
    assert!(
        !head.contains("cookie") && head.contains("user-agent: k.g.b./"),
        "{head}"
    );

    let e = user_fetch(&at("/mare"), Purpose::Page, None, true, true)
        .await
        .unwrap_err();
    assert!(e.contains("10 MB"), "{e}");

    let e = user_fetch(&at("/spre-retea"), Purpose::Page, None, true, true)
        .await
        .unwrap_err();
    assert!(e.contains("rețeaua locală"), "{e}");

    let e = user_fetch(&at("/bucla0"), Purpose::Page, None, true, true)
        .await
        .unwrap_err();
    assert!(e.contains("redirecți"), "{e}");
    assert!(
        seen.lock().unwrap().iter().filter(|h| h.contains("/bucla")).count() <= 6,
        "at most 5 redirects followed"
    );

    let r = user_fetch(&at("/tsa"), Purpose::Timestamp, Some(vec![1, 2, 3]), true, true)
        .await
        .unwrap();
    assert_eq!(r.data, vec![0x30, 0x03, 0x02, 0x01, 0x00]);
    let head = seen.lock().unwrap().last().unwrap().to_lowercase();
    assert!(
        head.starts_with("post /tsa") && head.contains("content-type: application/timestamp-query"),
        "{head}"
    );
}
