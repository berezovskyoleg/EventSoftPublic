use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use crate::game::cards::Player;
use crate::game::patterns::Pattern;
use crate::playlist::db::Track;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub enum GamePhase {
    #[default]
    Lobby,
    RoundIntro,
    Playing,
    RoundOver,
    GameOver,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RoundState {
    pub round_number: usize,
    pub pattern: Option<Pattern>,
    pub tracks_queue: Vec<i64>,
    pub current_track_index: Option<usize>,
    pub finished: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CurrentTrack {
    pub track_id: i64,
    pub title: String,
    pub artist: String,
    pub started_at: u64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct GameConfig {
    pub total_rounds: usize,
    pub host_name: String,
    pub room_code: String,
}

pub struct AppState {
    pub config: RwLock<GameConfig>,
    pub phase: RwLock<GamePhase>,
    pub players: RwLock<HashMap<String, Player>>,
    pub current_round: RwLock<RoundState>,
    pub current_track: RwLock<Option<CurrentTrack>>,
    pub rounds_history: RwLock<Vec<RoundState>>,
    pub available_tracks: RwLock<Vec<Track>>,
    pub winners: RwLock<Vec<String>>,
}

impl AppState {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            config: RwLock::new(GameConfig {
                total_rounds: 3,
                host_name: String::new(),
                room_code: String::new(),
            }),
            phase: RwLock::new(GamePhase::Lobby),
            players: RwLock::new(HashMap::new()),
            current_round: RwLock::new(RoundState::default()),
            current_track: RwLock::new(None),
            rounds_history: RwLock::new(Vec::new()),
            available_tracks: RwLock::new(Vec::new()),
            winners: RwLock::new(Vec::new()),
        })
    }
}
