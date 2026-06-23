use rusqlite::{Connection, Result};
use std::path::Path;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Playlist {
    pub id: i64,
    pub name: String,
    pub created_at: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Track {
    pub id: i64,
    pub playlist_id: i64,
    pub title: String,
    pub artist: String,
    pub file_path: String,
    pub duration_seconds: i64,
    pub sort_order: i64,
}

pub struct PlaylistStore {
    conn: Connection,
}

impl PlaylistStore {
    pub fn open<P: AsRef<Path>>(db_path: P) -> Result<Self> {
        let conn = Connection::open(db_path)?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS playlists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )",
            [],
        )?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS tracks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                playlist_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                artist TEXT NOT NULL,
                file_path TEXT NOT NULL UNIQUE,
                duration_seconds INTEGER NOT NULL DEFAULT 0,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
            )",
            [],
        )?;
        Ok(Self { conn })
    }

    pub fn create_playlist(&self, name: &str) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO playlists (name) VALUES (?1)",
            [name],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn list_playlists(&self) -> Result<Vec<Playlist>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, created_at FROM playlists ORDER BY created_at DESC"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(Playlist {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
            })
        })?;
        rows.collect()
    }

    pub fn delete_playlist(&self, id: i64) -> Result<()> {
        self.conn.execute("DELETE FROM playlists WHERE id = ?1", [id])?;
        Ok(())
    }

    pub fn add_track(&self, playlist_id: i64, title: &str, artist: &str, file_path: &str, duration_seconds: i64) -> Result<i64> {
        let max_order: i64 = self.conn.query_row(
            "SELECT COALESCE(MAX(sort_order), 0) FROM tracks WHERE playlist_id = ?1",
            [playlist_id],
            |row| row.get(0),
        )?;
        self.conn.execute(
            "INSERT INTO tracks (playlist_id, title, artist, file_path, duration_seconds, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![playlist_id, title, artist, file_path, duration_seconds, max_order + 1],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn get_tracks(&self, playlist_id: i64) -> Result<Vec<Track>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, playlist_id, title, artist, file_path, duration_seconds, sort_order
             FROM tracks WHERE playlist_id = ?1 ORDER BY sort_order"
        )?;
        let rows = stmt.query_map([playlist_id], |row| {
            Ok(Track {
                id: row.get(0)?,
                playlist_id: row.get(1)?,
                title: row.get(2)?,
                artist: row.get(3)?,
                file_path: row.get(4)?,
                duration_seconds: row.get(5)?,
                sort_order: row.get(6)?,
            })
        })?;
        rows.collect()
    }

    pub fn delete_track(&self, id: i64) -> Result<()> {
        self.conn.execute("DELETE FROM tracks WHERE id = ?1", [id])?;
        Ok(())
    }
}
