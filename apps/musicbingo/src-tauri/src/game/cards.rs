use rand::seq::SliceRandom;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub const CARD_SIZE: usize = 25;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Card {
    pub player_id: String,
    pub player_name: String,
    pub cells: Vec<CardCell>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CardCell {
    pub track_id: i64,
    pub title: String,
    pub artist: String,
    pub marked: bool,
}

impl Card {
    pub fn generate(player_id: String, player_name: String, track_ids: &[i64], titles: &[String], artists: &[String]) -> Option<Self> {
        if track_ids.len() < CARD_SIZE || titles.len() < CARD_SIZE || artists.len() < CARD_SIZE {
            return None;
        }
        let mut rng = rand::thread_rng();
        let mut indices: Vec<usize> = (0..track_ids.len()).collect();
        indices.shuffle(&mut rng);
        let chosen = &indices[..CARD_SIZE];
        let cells = chosen.iter().map(|&i| CardCell {
            track_id: track_ids[i],
            title: titles[i].clone(),
            artist: artists[i].clone(),
            marked: false,
        }).collect();
        Some(Self { player_id, player_name, cells })
    }

    pub fn mark(&mut self, track_id: i64) {
        for cell in &mut self.cells {
            if cell.track_id == track_id {
                cell.marked = true;
            }
        }
    }

    pub fn marked_array(&self) -> [bool; CARD_SIZE] {
        let mut arr = [false; CARD_SIZE];
        for (i, cell) in self.cells.iter().enumerate() {
            arr[i] = cell.marked;
        }
        arr
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Player {
    pub id: String,
    pub name: String,
    pub card: Option<Card>,
    pub bingo_claimed: bool,
    pub bingo_confirmed: bool,
}

impl Player {
    pub fn new(name: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            card: None,
            bingo_claimed: false,
            bingo_confirmed: false,
        }
    }
}
