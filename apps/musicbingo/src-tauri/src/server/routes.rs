use std::sync::Arc;

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{Html, IntoResponse, Json},
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::game::cards::{Card, Player};
use crate::server::player_html::PLAYER_HTML;
use crate::server::state::AppState;

#[derive(Deserialize)]
struct JoinRequest {
    name: String,
}

#[derive(Deserialize)]
struct MarkRequest {
    player_id: String,
    track_id: i64,
}

#[derive(Deserialize)]
struct BingoRequest {
    player_id: String,
}

#[derive(Deserialize)]
struct StateQuery {
    player_id: Option<String>,
}

#[derive(Serialize)]
struct PlayerStateResponse {
    room_code: String,
    phase: String,
    round_number: usize,
    round_pattern: Option<String>,
    card: Option<Vec<serde_json::Value>>,
    bingo_claimed: bool,
    bingo_confirmed: bool,
}

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/", get(player_home))
        .route("/api/game/state", get(game_state))
        .route("/api/game/join", post(join_game))
        .route("/api/game/mark", post(mark_track))
        .route("/api/game/bingo", post(claim_bingo))
}

async fn player_home() -> impl IntoResponse {
    Html(PLAYER_HTML)
}

async fn game_state(
    State(state): State<Arc<AppState>>,
    Query(query): Query<StateQuery>,
) -> impl IntoResponse {
    let phase = state.phase.read().unwrap().clone();
    let round = state.current_round.read().unwrap().clone();
    let config = state.config.read().unwrap().clone();
    let winners = state.winners.read().unwrap().clone();

    let mut resp = PlayerStateResponse {
        room_code: config.room_code.clone(),
        phase: format!("{:?}", phase).to_lowercase(),
        round_number: round.round_number,
        round_pattern: round.pattern.as_ref().map(|p| p.label().to_string()),
        card: None,
        bingo_claimed: false,
        bingo_confirmed: false,
    };

    if let Some(ref player_id) = query.player_id {
        let players = state.players.read().unwrap();
        if let Some(player) = players.get(player_id) {
            resp.bingo_claimed = player.bingo_claimed;
            resp.bingo_confirmed = player.bingo_confirmed;
            if let Some(card) = &player.card {
                let cells: Vec<serde_json::Value> = card.cells.iter().map(|c| {
                    json!({
                        "track_id": c.track_id,
                        "title": c.title,
                        "artist": c.artist,
                        "marked": c.marked,
                    })
                }).collect();
                resp.card = Some(cells);
            }
        }
    }

    if winners.contains(&query.player_id.unwrap_or_default()) {
        resp.bingo_confirmed = true;
    }

    Json(resp)
}

async fn join_game(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<JoinRequest>,
) -> impl IntoResponse {
    let name = payload.name.trim().to_string();
    if name.is_empty() || name.len() > 30 {
        return (StatusCode::BAD_REQUEST, Json(json!({"error":"invalid name"})));
    }

    let mut player = Player::new(name.clone());
    let tracks = state.available_tracks.read().unwrap().clone();
    if tracks.len() >= 25 {
        let ids: Vec<i64> = tracks.iter().map(|t| t.id).collect();
        let titles: Vec<String> = tracks.iter().map(|t| t.title.clone()).collect();
        let artists: Vec<String> = tracks.iter().map(|t| t.artist.clone()).collect();
        if let Some(card) = Card::generate(player.id.clone(), name, &ids, &titles, &artists) {
            player.card = Some(card);
        }
    }

    let player_id = player.id.clone();
    state.players.write().unwrap().insert(player_id.clone(), player);

    (StatusCode::OK, Json(json!({"player_id": player_id})))
}

async fn mark_track(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<MarkRequest>,
) -> impl IntoResponse {
    let mut players = state.players.write().unwrap();
    if let Some(player) = players.get_mut(&payload.player_id) {
        if let Some(card) = &mut player.card {
            card.mark(payload.track_id);
            let cells: Vec<serde_json::Value> = card.cells.iter().map(|c| {
                json!({
                    "track_id": c.track_id,
                    "title": c.title,
                    "artist": c.artist,
                    "marked": c.marked,
                })
            }).collect();
            return (StatusCode::OK, Json(json!({"card": cells})));
        }
    }
    (StatusCode::NOT_FOUND, Json(json!({"error":"player not found"})))
}

async fn claim_bingo(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<BingoRequest>,
) -> impl IntoResponse {
    let mut players = state.players.write().unwrap();
    if let Some(player) = players.get_mut(&payload.player_id) {
        player.bingo_claimed = true;
        let valid = if let Some(card) = &player.card {
            let round = state.current_round.read().unwrap();
            if let Some(pattern) = &round.pattern {
                pattern.check(&card.marked_array())
            } else {
                false
            }
        } else {
            false
        };
        if valid {
            player.bingo_confirmed = true;
            state.winners.write().unwrap().push(payload.player_id.clone());
            return (StatusCode::OK, Json(json!({"valid": true})));
        }
        return (StatusCode::OK, Json(json!({"valid": false})));
    }
    (StatusCode::NOT_FOUND, Json(json!({"error":"player not found"})))
}
