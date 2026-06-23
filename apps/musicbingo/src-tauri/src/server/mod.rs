pub mod player_html;
pub mod routes;
pub mod state;

use std::net::SocketAddr;
use std::sync::Arc;

use local_ip_address::local_ip;
use tokio::net::TcpListener;
use tower_http::cors::CorsLayer;

use crate::server::state::AppState;

pub async fn start_server(state: Arc<AppState>, port: u16) -> Result<(String, u16), String> {
    let app = routes::router()
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = TcpListener::bind(&addr)
        .await
        .map_err(|e| format!("failed to bind: {}", e))?;

    let actual_port = listener.local_addr().map_err(|e| e.to_string())?.port();

    let ip = local_ip().unwrap_or(std::net::IpAddr::from([127, 0, 0, 1]));
    let url = format!("http://{}:{}", ip, actual_port);

    tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, app).await {
            eprintln!("HTTP server error: {}", e);
        }
    });

    Ok((url, actual_port))
}
