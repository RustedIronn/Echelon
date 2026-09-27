use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::RngCore;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::{
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex,
    },
    thread,
    time::{Duration, Instant},
};
use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;
use url::Url;

const GOOGLE_AUTHORIZE_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const CALLBACK_TIMEOUT: Duration = Duration::from_secs(5 * 60);

fn desktop_client_secret() -> Result<&'static str, String> {
    option_env!("GOOGLE_DESKTOP_CLIENT_SECRET")
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "Desktop Google OAuth is missing GOOGLE_DESKTOP_CLIENT_SECRET.".to_string())
}

#[derive(Default)]
pub struct OAuthRuntime {
    next_attempt: AtomicU64,
    active: Mutex<Option<(u64, Arc<AtomicBool>)>>,
}

#[derive(Deserialize)]
struct TokenResponse {
    id_token: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

#[derive(Deserialize)]
struct IdTokenClaims {
    aud: serde_json::Value,
    nonce: Option<String>,
}

fn random_urlsafe(byte_count: usize) -> String {
    let mut bytes = vec![0_u8; byte_count];
    rand::rng().fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

fn write_response(mut stream: TcpStream, status: &str, heading: &str, message: &str) {
    let body = format!(
        r#"<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{heading}</title><style>body{{font:16px system-ui,sans-serif;background:#eef0f5;color:#171724;display:grid;place-items:center;min-height:100vh;margin:0}}main{{max-width:30rem;padding:2rem;background:white;border:1px solid #ddd7e2;border-radius:18px}}h1{{margin-top:0}}p{{color:#565466;line-height:1.55}}</style></head><body><main><h1>{heading}</h1><p>{message}</p></main><script>window.setTimeout(()=>window.close(),600);</script></body></html>"#
    );
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    let _ = stream.write_all(response.as_bytes());
}

fn read_request_target(stream: &mut TcpStream) -> Option<String> {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
    let mut request = [0_u8; 8192];
    let count = stream.read(&mut request).ok()?;
    let first_line = String::from_utf8_lossy(&request[..count]);
    first_line.lines().next()?.split_whitespace().nth(1).map(str::to_owned)
}

fn wait_for_callback(
    listener: TcpListener,
    expected_state: String,
    cancelled: Arc<AtomicBool>,
) -> Result<String, String> {
    listener.set_nonblocking(true).map_err(|error| error.to_string())?;
    let expires = Instant::now() + CALLBACK_TIMEOUT;

    while Instant::now() < expires {
        if cancelled.load(Ordering::SeqCst) {
            return Err("oauth_cancelled".into());
        }

        match listener.accept() {
            Ok((mut stream, address)) => {
                if !address.ip().is_loopback() {
                    write_response(stream, "403 Forbidden", "Sign-in rejected", "The callback did not originate from this device.");
                    continue;
                }
                let Some(target) = read_request_target(&mut stream) else {
                    write_response(stream, "400 Bad Request", "Sign-in rejected", "The callback request was incomplete.");
                    continue;
                };
                let Ok(url) = Url::parse(&format!("http://127.0.0.1{target}")) else {
                    write_response(stream, "400 Bad Request", "Sign-in rejected", "The callback request was invalid.");
                    continue;
                };
                if url.path() != "/oauth/callback" {
                    write_response(stream, "404 Not Found", "Not found", "This callback address is not available.");
                    continue;
                }
                let value = |name: &str| {
                    url.query_pairs()
                        .find(|(key, _)| key == name)
                        .map(|(_, value)| value.into_owned())
                };
                if value("state").as_deref() != Some(expected_state.as_str()) {
                    write_response(stream, "400 Bad Request", "Sign-in rejected", "The sign-in response could not be verified. Return to Echelon and try again.");
                    continue;
                }
                if let Some(error) = value("error") {
                    write_response(stream, "200 OK", "Sign-in cancelled", "You can close this tab and return to Echelon.");
                    return Err(if error == "access_denied" { "oauth_cancelled".into() } else { format!("oauth_provider:{error}") });
                }
                let Some(code) = value("code") else {
                    write_response(stream, "400 Bad Request", "Sign-in rejected", "Google did not return an authorization code.");
                    return Err("oauth_missing_code".into());
                };
                write_response(stream, "200 OK", "Signed in to Echelon", "Authentication is complete. This tab may close automatically; otherwise, close it and return to Echelon.");
                return Ok(code);
            }
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(40));
            }
            Err(error) => return Err(error.to_string()),
        }
    }
    Err("oauth_timeout".into())
}

fn verify_id_token_binding(id_token: &str, client_id: &str, nonce: &str) -> Result<(), String> {
    let encoded_claims = id_token
        .split('.')
        .nth(1)
        .ok_or_else(|| "Google returned an invalid ID token.".to_string())?;
    let claims_bytes = URL_SAFE_NO_PAD
        .decode(encoded_claims)
        .map_err(|_| "Google returned an invalid ID token.".to_string())?;
    let claims: IdTokenClaims = serde_json::from_slice(&claims_bytes)
        .map_err(|_| "Google returned an invalid ID token.".to_string())?;
    let audience_matches = match claims.aud {
        serde_json::Value::String(value) => value == client_id,
        serde_json::Value::Array(values) => values.iter().any(|value| value.as_str() == Some(client_id)),
        _ => false,
    };
    if !audience_matches || claims.nonce.as_deref() != Some(nonce) {
        return Err("Google returned a credential for a different sign-in attempt.".into());
    }
    Ok(())
}

async fn run_oauth(app: &AppHandle, client_id: &str, cancelled: Arc<AtomicBool>) -> Result<String, String> {
    let client_secret = desktop_client_secret()?;
    let listener = TcpListener::bind(("127.0.0.1", 0)).map_err(|error| error.to_string())?;
    let port = listener.local_addr().map_err(|error| error.to_string())?.port();
    let redirect_uri = format!("http://127.0.0.1:{port}/oauth/callback");
    let verifier = random_urlsafe(64);
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let state = random_urlsafe(32);
    let nonce = random_urlsafe(32);

    let mut authorize = Url::parse(GOOGLE_AUTHORIZE_URL).map_err(|error| error.to_string())?;
    authorize.query_pairs_mut()
        .append_pair("client_id", client_id)
        .append_pair("redirect_uri", &redirect_uri)
        .append_pair("response_type", "code")
        .append_pair("scope", "openid email profile")
        .append_pair("code_challenge", &challenge)
        .append_pair("code_challenge_method", "S256")
        .append_pair("state", &state)
        .append_pair("nonce", &nonce)
        .append_pair("prompt", "select_account");

    app.opener()
        .open_url(authorize.as_str(), None::<&str>)
        .map_err(|error| error.to_string())?;

    let callback_cancelled = cancelled.clone();
    let code = tauri::async_runtime::spawn_blocking(move || wait_for_callback(listener, state, callback_cancelled))
        .await
        .map_err(|error| error.to_string())??;
    if cancelled.load(Ordering::SeqCst) {
        return Err("oauth_cancelled".into());
    }

    let response = reqwest::Client::new()
        .post(GOOGLE_TOKEN_URL)
        .form(&[
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("code", code.as_str()),
            ("code_verifier", verifier.as_str()),
            ("grant_type", "authorization_code"),
            ("redirect_uri", redirect_uri.as_str()),
        ])
        .send()
        .await
        .map_err(|error| format!("Token exchange failed: {error}"))?;
    let status = response.status();
    let token: TokenResponse = response.json().await.map_err(|error| format!("Google returned an unreadable token response: {error}"))?;
    if cancelled.load(Ordering::SeqCst) {
        return Err("oauth_cancelled".into());
    }
    if !status.is_success() {
        return Err(token.error_description.or(token.error).unwrap_or_else(|| "Google rejected the token exchange.".into()));
    }
    let id_token = token.id_token.ok_or_else(|| "Google did not return an ID token.".to_string())?;
    verify_id_token_binding(&id_token, client_id, &nonce)?;
    Ok(id_token)
}

#[tauri::command]
pub async fn start_google_oauth(
    app: AppHandle,
    runtime: State<'_, OAuthRuntime>,
    client_id: String,
) -> Result<String, String> {
    if client_id.trim().is_empty() {
        return Err("Desktop Google OAuth is not configured.".into());
    }
    let attempt_id = runtime.next_attempt.fetch_add(1, Ordering::SeqCst) + 1;
    let cancelled = Arc::new(AtomicBool::new(false));
    {
        let mut active = runtime.active.lock().map_err(|_| "OAuth state is unavailable.")?;
        if active.is_some() {
            return Err("oauth_in_progress".into());
        }
        *active = Some((attempt_id, cancelled.clone()));
    }

    let result = run_oauth(&app, client_id.trim(), cancelled).await;
    if let Ok(mut active) = runtime.active.lock() {
        if active.as_ref().is_some_and(|(id, _)| *id == attempt_id) {
            *active = None;
        }
    }
    result
}

#[tauri::command]
pub fn cancel_google_oauth(runtime: State<'_, OAuthRuntime>) -> Result<bool, String> {
    let active = runtime.active.lock().map_err(|_| "OAuth state is unavailable.")?;
    if let Some((_, cancelled)) = active.as_ref() {
        cancelled.store(true, Ordering::SeqCst);
        return Ok(true);
    }
    Ok(false)
}
