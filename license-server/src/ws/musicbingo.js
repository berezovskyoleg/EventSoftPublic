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
    this.players = new Map(); // playerId -> { ws, name, card, bingoClaimed, bingoConfirmed }
    this.phase = "lobby"; // lobby | playing | roundover | gameover
    this.roundNumber = 1;
    this.currentTrackId = null;
    this.currentTrackTitle = null;
    this.pattern = null;
    this.winners = [];
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
      bingoClaimed: false,
      bingoConfirmed: false,
    };
    this.players.set(id, player);
    this.hostSend({ type: "player_joined", player: this.playerPublic(player) });
    ws.send(JSON.stringify({ type: "joined", playerId: id, roomCode: this.code }));
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

  setCards(cards) {
    // cards: [{ playerId, cells: [{ trackId, title, artist }] }]
    for (const c of cards) {
      const p = this.players.get(c.playerId);
      if (p) p.card = c.cells;
    }
    for (const p of this.players.values()) {
      if (p.card && p.ws.readyState === 1) {
        p.ws.send(JSON.stringify({ type: "card", card: p.card }));
      }
    }
  }

  playerPublic(p) {
    return {
      id: p.id,
      name: p.name,
      bingoClaimed: p.bingoClaimed,
      bingoConfirmed: p.bingoConfirmed,
    };
  }

  allPlayersPublic() {
    return Array.from(this.players.values()).map((p) => this.playerPublic(p));
  }
}

function generateId() {
  return crypto.randomBytes(8).toString("hex");
}

function setupMusicBingoWSS(server) {
  const wss = new WebSocketServer({
    server,
    path: "/ws/musicbingo",
  });

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
      // If room exists, replace host (reconnect).
      const room = rooms.get(roomCode) || new Room(roomCode, ws);
      room.host = ws;
      rooms.set(roomCode, room);

      ws.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          handleHostMessage(room, ws, msg);
        } catch (err) {
          ws.send(JSON.stringify({ type: "error", message: "Invalid message" }));
        }
      });

      ws.on("close", () => {
        // Keep room alive for players, but mark host offline.
        if (room.host === ws) room.host = null;
      });

      ws.send(
        JSON.stringify({
          type: "host_assigned",
          roomCode,
          players: room.allPlayersPublic(),
        })
      );
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
        } catch (err) {
          ws.send(JSON.stringify({ type: "error", message: "Invalid message" }));
        }
      });

      ws.on("close", () => {
        room.removePlayer(ws);
      });

      // Send current round state if already playing.
      ws.send(
        JSON.stringify({
          type: "round_state",
          phase: room.phase,
          roundNumber: room.roundNumber,
          pattern: room.pattern,
          currentTrackId: room.currentTrackId,
          currentTrackTitle: room.currentTrackTitle,
        })
      );
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
      room.phase = "playing";
      room.roundNumber = msg.roundNumber || room.roundNumber;
      room.pattern = msg.pattern || room.pattern;
      room.currentTrackId = null;
      room.currentTrackTitle = null;
      // Reset player bingo claims for new round.
      for (const p of room.players.values()) {
        p.bingoClaimed = false;
        p.bingoConfirmed = false;
      }
      room.broadcastToAll({
        type: "round_state",
        phase: room.phase,
        roundNumber: room.roundNumber,
        pattern: room.pattern,
        currentTrackId: null,
        currentTrackTitle: null,
      });
      break;
    }
    case "track_started": {
      room.currentTrackId = msg.trackId;
      room.currentTrackTitle = msg.title;
      room.broadcastToPlayers({
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
        currentTrackId: room.currentTrackId,
        currentTrackTitle: room.currentTrackTitle,
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
        currentTrackId: room.currentTrackId,
        currentTrackTitle: room.currentTrackTitle,
      });
      break;
    }
    case "distribute_cards": {
      room.setCards(msg.cards || []);
      break;
    }
    case "confirm_bingo": {
      const p = room.players.get(msg.playerId);
      if (!p) break;
      const valid = !!msg.valid;
      p.bingoConfirmed = valid;
      if (valid) room.winners.push(p.id);
      p.ws.send(
        JSON.stringify({
          type: "bingo_confirmed",
          valid,
        })
      );
      room.broadcastToAll({
        type: "player_update",
        player: room.playerPublic(p),
      });
      break;
    }
    case "reset_game": {
      room.players.clear();
      room.phase = "lobby";
      room.roundNumber = 1;
      room.currentTrackId = null;
      room.currentTrackTitle = null;
      room.pattern = null;
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
    case "set_name": {
      player.name = msg.name || player.name;
      room.hostSend({ type: "player_update", player: room.playerPublic(player) });
      break;
    }
    case "mark": {
      player.ws.send(
        JSON.stringify({ type: "mark_ack", trackId: msg.trackId })
      );
      break;
    }
    case "bingo": {
      player.bingoClaimed = true;
      room.hostSend({
        type: "bingo_claim",
        playerId: player.id,
        name: player.name,
      });
      room.broadcastToAll({
        type: "player_update",
        player: room.playerPublic(player),
      });
      break;
    }
    default:
      player.ws.send(JSON.stringify({ type: "error", message: "Unknown player message" }));
  }
}

module.exports = { setupMusicBingoWSS };
