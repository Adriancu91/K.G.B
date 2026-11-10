//! The certificates of Windows for the digital signature of PDFs (7.4l-0c, D-085): the user's "Personal" store,
//! including those on a USB token or smart card. As in Cyber Office Studio (electron/wincerts.cjs, tested by
//! people with their tokens), the list and the signing go through the same PowerShell scripts, which use .NET
//! from Windows, without administrator rights. When signing, Windows (the token's driver) asks for the PIN itself,
//! in its own window: K.G.B. never sees or keeps the PIN. Only the bytes to sign go out (the CMS signed attributes,
//! a few hundred bytes) and only the signature comes back.
//!
//! For tests: `KGB_TEST_WINCERT=<file .pfx>|<password>` uses the certificate of that file instead of the store (the
//! key only in memory, nothing written to Windows), as COS's `SUITE_TEST_WINCERT`.

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as B64;
use serde::{Deserialize, Serialize};
use std::time::Duration;

const HEAD: &str = r#"$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Security
function Get-SuiteCerts {
  $t = $env:KGB_TEST_WINCERT
  if ($t) {
    $i = $t.LastIndexOf('|')
    $c = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($t.Substring(0, $i), $t.Substring($i + 1), [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]32)
    return ,@($c)
  }
  $s = New-Object System.Security.Cryptography.X509Certificates.X509Store('My', 'CurrentUser')
  $s.Open([System.Security.Cryptography.X509Certificates.OpenFlags]'ReadOnly, OpenExistingOnly')
  $all = @($s.Certificates)
  $s.Close()
  return ,$all
}
"#;

const LIST: &str = r#"
$out = @()
foreach ($c in (Get-SuiteCerts)) {
  if (-not $c.HasPrivateKey) { continue }
  $ch = New-Object System.Security.Cryptography.X509Certificates.X509Chain
  $ch.ChainPolicy.RevocationMode = 'NoCheck'
  [void]$ch.Build($c)
  $chain = @($ch.ChainElements | Select-Object -Skip 1 | ForEach-Object { [Convert]::ToBase64String($_.Certificate.RawData) })
  $out += [pscustomobject]@{
    thumb = $c.Thumbprint; name = $c.GetNameInfo('SimpleName', $false); issuer = $c.GetNameInfo('SimpleName', $true)
    from = $c.NotBefore.ToString('yyyy-MM-dd'); to = $c.NotAfter.ToString('yyyy-MM-dd')
    ec = ($c.PublicKey.Oid.Value -eq '1.2.840.10045.2.1')
    der = [Convert]::ToBase64String($c.RawData); chain = $chain
  }
}
ConvertTo-Json -InputObject @($out) -Depth 4 -Compress
"#;

fn sign_script(thumb: &str, b64: &str, ec: bool) -> String {
    let key = if ec {
        "$k = [System.Security.Cryptography.X509Certificates.ECDsaCertificateExtensions]::GetECDsaPrivateKey($c)\n$sig = $k.SignData($data, $h)"
    } else {
        "$k = [System.Security.Cryptography.X509Certificates.RSACertificateExtensions]::GetRSAPrivateKey($c)\n$sig = $k.SignData($data, $h, [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)"
    };
    format!(
        "{HEAD}
$c = $null
foreach ($x in (Get-SuiteCerts)) {{ if ($x.Thumbprint -eq '{thumb}') {{ $c = $x; break }} }}
if (-not $c) {{ throw 'Certificatul nu mai e pe calculator (tokenul e scos?).' }}
$data = [Convert]::FromBase64String('{b64}')
$h = [System.Security.Cryptography.HashAlgorithmName]::SHA256
{key}
[Convert]::ToBase64String($sig)
"
    )
}

/// A certificate with a private key: its thumbprint and public data (the key stays in Windows / on the token).
#[derive(Serialize, Deserialize, Debug)]
pub struct WinCert {
    thumb: String,
    name: String,
    issuer: String,
    from: String,
    to: String,
    ec: bool,
    der: String,
    #[serde(default, deserialize_with = "one_or_many")]
    chain: Vec<String>,
}

/// PowerShell's JSON gives a single string instead of a list of one.
fn one_or_many<'de, D: serde::Deserializer<'de>>(d: D) -> Result<Vec<String>, D::Error> {
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum V {
        One(String),
        Many(Vec<String>),
        Nothing(()),
    }
    Ok(match V::deserialize(d)? {
        V::One(s) => vec![s],
        V::Many(v) => v,
        V::Nothing(()) => Vec::new(),
    })
}

/// PowerShell started without a console writes its errors as XML ("#< CLIXML"); the readable line is taken out.
fn ps_error_text(stderr: &str) -> String {
    let mut t = stderr.to_string();
    if t.trim_start().starts_with("#< CLIXML") {
        let mut out = String::new();
        let mut rest = t.as_str();
        while let Some(i) = rest.find("<S S=\"Error\">") {
            rest = &rest[i + 13..];
            if let Some(j) = rest.find("</S>") {
                out.push_str(&rest[..j]);
                rest = &rest[j + 4..];
            }
        }
        // _xHHHH_ escapes and the XML entities.
        let mut dec = String::new();
        let mut s = out.as_str();
        while let Some(i) = s.find("_x") {
            dec.push_str(&s[..i]);
            let tail = &s[i + 2..];
            match (tail.get(..4).and_then(|h| u32::from_str_radix(h, 16).ok()), tail.get(4..5)) {
                (Some(c), Some("_")) => {
                    dec.extend(char::from_u32(c));
                    s = &tail[5..];
                }
                _ => {
                    dec.push_str("_x");
                    s = tail;
                }
            }
        }
        dec.push_str(s);
        t = dec
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", "\"")
            .replace("&apos;", "'")
            .replace("&amp;", "&");
    }
    t.lines()
        .map(str::trim)
        .find(|l| {
            !l.is_empty()
                && !["At line", "+", "CategoryInfo", "FullyQualifiedErrorId", "~"]
                    .iter()
                    .any(|p| l.starts_with(p))
        })
        .unwrap_or_default()
        .to_string()
}

/// Runs a script in Windows PowerShell (no profile, no window), with a time limit.
#[cfg(windows)]
fn run_ps(script: &str, limit: Duration) -> Result<String, String> {
    use std::io::Read as _;
    use std::os::windows::process::CommandExt as _;
    use std::process::{Command, Stdio};
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let utf16: Vec<u8> = script.encode_utf16().flat_map(u16::to_le_bytes).collect();
    let mut child = Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand"])
        .arg(B64.encode(utf16))
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(|_| "Sistemul nu a putut folosi certificatul.".to_string())?;
    // The pipes are read on their own threads, so a large output never blocks the script.
    let mut out = child.stdout.take().ok_or("Sistemul nu a putut folosi certificatul.")?;
    let mut err = child.stderr.take().ok_or("Sistemul nu a putut folosi certificatul.")?;
    let o = std::thread::spawn(move || {
        let mut s = String::new();
        let _ = out.read_to_string(&mut s);
        s
    });
    let e = std::thread::spawn(move || {
        let mut s = String::new();
        let _ = err.read_to_string(&mut s);
        s
    });
    let start = std::time::Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(st)) => break st,
            Ok(None) if start.elapsed() > limit => {
                let _ = child.kill();
                let _ = child.wait();
                return Err("Certificatul nu a răspuns la timp (PIN-ul nu a fost scris?).".into());
            }
            Ok(None) => std::thread::sleep(Duration::from_millis(100)),
            Err(_) => return Err("Sistemul nu a putut folosi certificatul.".into()),
        }
    };
    let stdout = o.join().unwrap_or_default();
    let stderr = e.join().unwrap_or_default();
    if !status.success() {
        let m = ps_error_text(&stderr);
        return Err(if m.is_empty() { "Sistemul nu a putut folosi certificatul.".into() } else { m });
    }
    Ok(stdout.trim().to_string())
}

#[cfg(not(windows))]
fn run_ps(_: &str, _: Duration) -> Result<String, String> {
    Err("Certificatele de pe calculator se pot folosi doar pe Windows.".into())
}

/// The certificates with a private key from the user's store (or the test file).
#[tauri::command]
pub async fn wincert_list() -> Result<Vec<WinCert>, String> {
    let txt = tauri::async_runtime::spawn_blocking(|| run_ps(&format!("{HEAD}{LIST}"), Duration::from_secs(60)))
        .await
        .map_err(|_| "Sistemul nu a putut citi certificatele.".to_string())??;
    if txt.is_empty() {
        return Ok(Vec::new());
    }
    serde_json::from_str::<Vec<WinCert>>(&txt).map_err(|_| "Lista certificatelor nu se poate citi.".to_string())
}

/// Signs `data` (base64, at most 64 KB: the signed attributes) with the certificate `thumb`; Windows asks for the PIN.
#[tauri::command]
pub async fn wincert_sign(thumb: String, data: String, ec: bool) -> Result<String, String> {
    if thumb.len() != 40 || !thumb.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("Certificat necunoscut.".into());
    }
    let bytes = B64.decode(data.as_bytes()).map_err(|_| "Datele de semnat nu au ajuns întregi.".to_string())?;
    if bytes.is_empty() || bytes.len() > 64 * 1024 {
        return Err("Datele de semnat nu sunt bune.".into());
    }
    let script = sign_script(&thumb.to_uppercase(), &B64.encode(&bytes), ec);
    // Up to 3 minutes: time to type the PIN in the token's window.
    let out = tauri::async_runtime::spawn_blocking(move || run_ps(&script, Duration::from_secs(180)))
        .await
        .map_err(|_| "Sistemul nu a putut folosi certificatul.".to_string())??;
    let sig = B64.decode(out.as_bytes()).map_err(|_| "Semnătura nu a venit întreagă.".to_string())?;
    Ok(B64.encode(sig))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn errors_of_powershell_are_read_from_clixml() {
        let x = "#< CLIXML\r\n<Objs><S S=\"Error\">Certificatul nu mai e pe calculator (tokenul e scos?)._x000D__x000A_</S><S S=\"Error\">At line:5 char:1_x000D__x000A_</S></Objs>";
        assert_eq!(ps_error_text(x), "Certificatul nu mai e pe calculator (tokenul e scos?).");
        assert_eq!(ps_error_text("At line:1\n+ foo\nCeva clar"), "Ceva clar");
    }

    #[test]
    fn the_sign_script_takes_only_the_checked_values() {
        let s = sign_script("AB".repeat(20).as_str(), "AAEC", true);
        assert!(s.contains("'ABABABABABABABABABABABABABABABABABABABAB'") && s.contains("'AAEC'") && s.contains("GetECDsaPrivateKey"));
        let r = sign_script("AB".repeat(20).as_str(), "AAEC", false);
        assert!(r.contains("RSASignaturePadding]::Pkcs1"));
    }

    #[test]
    fn a_chain_of_one_is_a_list() {
        let c: WinCert = serde_json::from_str(r#"{"thumb":"a","name":"n","issuer":"i","from":"f","to":"t","ec":false,"der":"d","chain":"x"}"#).unwrap();
        assert_eq!(c.chain, vec!["x".to_string()]);
    }
}
