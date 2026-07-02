const { WebSocketServer } = require("ws");
const { parse } = require("url");
const crypto = require("crypto");

// In-memory room state. Suitable for up to ~100 concurrent players.
const rooms = new Map(); // roomCode -> Room

class Room {
  constructor(code, hostWs) {
    this.code = code;
    this.host = hostWs;
    this.hostId = generateId();
    this.players = new Map(); // playerId -> Player
    this.phase = "lobby"; // lobby | playing | roundover | gameover
    this.roundNumber = 1;
    this.pattern = null;
    this.trackPool = []; // { id, title, artist }[]
    this.playedTrackIds = new Set();
    this.winners = []; // { playerId, name, at }[]
  }

  broadcastToPlayers(message) {
    const text = JSON.stringify(message);
    for (const p of this.players.values()) {
      if (p.ws.readyState === 1) p.ws.send(text);
    }
  }

  broadcastToAll(message) {
    const text = JSON.stringify(message);
    if (this.host && this.host.readyState === 1) this.host.send(text);
    this.broadcastToPlayers(message);
  }

  hostSend(message) {
    if (this.host && this.host.readyState === 1) {
      this.host.send(JSON.stringify(message));
    }
  }

  addPlayer(ws, name) {
    const id = generateId();
    const player = {
      id,
      ws,
      name,
      card: null,
      markedIds: new Set(),
      bingoWon: false,
      bingoAt: null,
    };
    this.players.set(id, player);
    this.hostSend({ type: "player_joined", player: this.playerPublic(player) });
    ws.send(JSON.stringify({ type: "joined", playerId: id, roomCode: this.code }));
    // Send state first, then card if round is in progress.
    ws.send(JSON.stringify({
      type: "round_state",
      phase: this.phase,
      roundNumber: this.roundNumber,
      pattern: this.pattern,
      playedTrackIds: Array.from(this.playedTrackIds),
      winners: this.winners,
    }));
    if (this.phase === "playing" && this.trackPool.length >= 25) {
      player.card = generateCard(this.trackPool);
      ws.send(JSON.stringify({ type: "card", card: player.card }));
    }
    return player;
  }


  removePlayer(ws) {
    for (const [id, p] of this.players.entries()) {
      if (p.ws === ws) {
        this.players.delete(id);
        this.hostSend({ type: "player_left", playerId: id });
        return;
      }
    }
  }

  playerPublic(p) {
    return {
      id: p.id,
      name: p.name,
      bingoWon: p.bingoWon,
      bingoAt: p.bingoAt,
    };
  }

  allPlayersPublic() {
    return Array.from(this.players.values()).map((p) => this.playerPublic(p));
  }

  distributeCards() {
    for (const p of this.players.values()) {
      p.card = generateCard(this.trackPool);
      if (p.ws.readyState === 1) {
        p.ws.send(JSON.stringify({ type: "card", card: p.card }));
      }
    }
  }

  mark(player, trackId) {
    if (!this.playedTrackIds.has(trackId)) return { ok: false, error: "not_played" };
    if (!player.card || !player.card.some((c) => c.trackId === trackId)) return { ok: false, error: "not_on_card" };
    player.markedIds.add(trackId);
    return { ok: true };
  }

  checkBingo(player) {
    if (!this.pattern || !player.card) return false;
    const marked = player.card.map((c) => player.markedIds.has(c.trackId));
    return checkPattern(this.pattern, marked);
  }
}

function generateId() {
  return crypto.randomBytes(8).toString("hex");
}

function generateCard(trackPool) {
  const shuffled = [...trackPool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 25).map((t) => ({
    trackId: t.id,
    title: t.title,
    artist: t.artist || "",
    marked: false,
  }));
}

function checkPattern(pattern, marked) {
  if (marked.length !== 25) return false;
  const rows = [];
  for (let r = 0; r < 5; r++) rows.push(Array.from({ length: 5 }, (_, c) => r * 5 + c));
  const cols = [];
  for (let c = 0; c < 5; c++) cols.push(Array.from({ length: 5 }, (_, r) => r * 5 + c));
  const diag1 = [0, 6, 12, 18, 24];
  const diag2 = [4, 8, 12, 16, 20];
  const corners = [0, 4, 20, 24];
  const all = Array.from({ length: 25 }, (_, i) => i);

  switch (pattern) {
    case "line_horizontal":
      return rows.some((line) => line.every((i) => marked[i]));
    case "line_vertical":
      return cols.some((line) => line.every((i) => marked[i]));
    case "two_lines": {
      let c = 0;
      [...rows, ...cols].forEach((line) => { if (line.every((i) => marked[i])) c++; });
      return c >= 2;
    }
    case "three_lines": {
      let c = 0;
      [...rows, ...cols].forEach((line) => { if (line.every((i) => marked[i])) c++; });
      return c >= 3;
    }
    case "four_corners":
      return corners.every((i) => marked[i]);
    case "x":
      return diag1.every((i) => marked[i]) && diag2.every((i) => marked[i]);
    case "full_house":
      return all.every((i) => marked[i]);
    default:
      return false;
  }
}

function setupMusicBingoWSS(server) {
  const wss = new WebSocketServer({ server, path: "/ws/musicbingo" });

  wss.on("connection", (ws, req) => {
    const { query } = parse(req.url || "", true);
    const roomCode = (query.room || "").toString().trim();
    const role = (query.role || "").toString().trim();

    if (!roomCode) {
      ws.send(JSON.stringify({ type: "error", message: "Missing room code" }));
      ws.close();
      return;
    }

    if (role === "host") {
      const room = rooms.get(roomCode) || new Room(roomCode, ws);
      room.host = ws;
      rooms.set(roomCode, room);

      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          handleHostMessage(room, ws, msg);
        } catch {
          ws.send(JSON.stringify({ type: "error", message: "Invalid message" }));
        }
      });

      ws.on("close", () => {
        if (room.host === ws) room.host = null;
      });

      ws.send(JSON.stringify({
        type: "host_assigned",
        roomCode,
        players: room.allPlayersPublic(),
        winners: room.winners,
      }));
      return;
    }

    if (role === "player") {
      const room = rooms.get(roomCode);
      if (!room) {
        ws.send(JSON.stringify({ type: "error", message: "Room not found" }));
        ws.close();
        return;
      }
      const player = room.addPlayer(ws, query.name?.toString() || "Игрок");

      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          handlePlayerMessage(room, player, msg);
        } catch {
          ws.send(JSON.stringify({ type: "error", message: "Invalid message" }));
        }
      });

      ws.on("close", () => room.removePlayer(ws));
      return;
    }

    ws.send(JSON.stringify({ type: "error", message: "Invalid role" }));
    ws.close();
  });

  return wss;
}

function handleHostMessage(room, ws, msg) {
  switch (msg.type) {
    case "start_round": {
      if (!Array.isArray(msg.trackPool) || msg.trackPool.length < 25) {
        ws.send(JSON.stringify({ type: "error", message: "Need at least 25 tracks" }));
        return;
      }
      room.phase = "playing";
      room.roundNumber = msg.roundNumber || room.roundNumber;
      room.pattern = msg.pattern || room.pattern;
      room.trackPool = msg.trackPool;
      room.playedTrackIds.clear();
      room.winners = [];
      for (const p of room.players.values()) {
        p.markedIds.clear();
        p.bingoWon = false;
        p.bingoAt = null;
      }
      room.distributeCards();
      room.broadcastToAll({
        type: "round_state",
        phase: room.phase,
        roundNumber: room.roundNumber,
        pattern: room.pattern,
        playedTrackIds: [],
        winners: [],
      });
      break;
    }
    case "track_started": {
      room.playedTrackIds.add(msg.trackId);
      room.broadcastToAll({
        type: "track_started",
        trackId: msg.trackId,
        title: msg.title,
        artist: msg.artist,
      });
      break;
    }
    case "end_round": {
      room.phase = "roundover";
      room.broadcastToAll({
        type: "round_state",
        phase: room.phase,
        roundNumber: room.roundNumber,
        pattern: room.pattern,
        playedTrackIds: Array.from(room.playedTrackIds),
        winners: room.winners,
      });
      break;
    }
    case "game_over": {
      room.phase = "gameover";
      room.broadcastToAll({
        type: "round_state",
        phase: room.phase,
        roundNumber: room.roundNumber,
        pattern: room.pattern,
        playedTrackIds: Array.from(room.playedTrackIds),
        winners: room.winners,
      });
      break;
    }
    case "reset_game": {
      room.players.clear();
      room.phase = "lobby";
      room.roundNumber = 1;
      room.pattern = null;
      room.trackPool = [];
      room.playedTrackIds.clear();
      room.winners = [];
      room.broadcastToAll({ type: "reset_game" });
      break;
    }
    default:
      ws.send(JSON.stringify({ type: "error", message: "Unknown host message" }));
  }
}

function handlePlayerMessage(room, player, msg) {
  switch (msg.type) {
    case "set_name":
      player.name = msg.name || player.name;
      room.hostSend({ type: "player_update", player: room.playerPublic(player) });
      break;
    case "mark": {
      const result = room.mark(player, msg.trackId);
      if (!result.ok) {
        player.ws.send(JSON.stringify({ type: "mark_error", error: result.error }));
        return;
      }
      player.ws.send(JSON.stringify({ type: "mark_ack", trackId: msg.trackId }));
      if (!player.bingoWon && room.checkBingo(player)) {
        player.bingoWon = true;
        player.bingoAt = Date.now();
        const winner = { playerId: player.id, name: player.name, at: player.bingoAt };
        room.winners.push(winner);
        room.winners.sort((a, b) => a.at - b.at);
        player.ws.send(JSON.stringify({ type: "bingo", you: true }));
        room.hostSend({ type: "bingo", winner });
        room.broadcastToPlayers({
          type: "player_bingo",
          playerId: player.id,
          name: player.name,
        });
      }
      break;
    }
    default:
      player.ws.send(JSON.stringify({ type: "error", message: "Unknown player message" }));
  }
}

module.exports = { setupMusicBingoWSS };
