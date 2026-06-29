import { useEffect, useRef, useState, useCallback } from "react";
import type { PlayerPublic, RoomState, CardCell } from "./types";

const WS_URL =
  window.location.protocol === "https:"
    ? `wss://${window.location.host}/ws/musicbingo`
    : `ws://${window.location.host}/ws/musicbingo`;

export function useRoom(role: "host" | "player", roomCode: string, playerName?: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerPublic[]>([]);
  const [roomState, setRoomState] = useState<RoomState>({
    phase: "lobby",
    roundNumber: 1,
    pattern: null,
    currentTrackId: null,
    currentTrackTitle: null,
  });
  const [card, setCard] = useState<CardCell[] | null>(null);
  const [bingoResult, setBingoResult] = useState<{ valid: boolean } | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);

  useEffect(() => {
    const url = `${WS_URL}?room=${encodeURIComponent(roomCode)}&role=${role}${
      role === "player" && playerName ? `&name=${encodeURIComponent(playerName)}` : ""
    }`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setError("Ошибка соединения");

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        switch (msg.type) {
          case "host_assigned":
            setPlayers(msg.players || []);
            break;
          case "joined":
            setPlayerId(msg.playerId);
            break;
          case "player_joined":
          case "player_update":
            setPlayers((prev) => {
              const idx = prev.findIndex((p) => p.id === msg.player.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = msg.player;
                return next;
              }
              return [...prev, msg.player];
            });
            break;
          case "player_left":
            setPlayers((prev) => prev.filter((p) => p.id !== msg.playerId));
            break;
          case "round_state":
            setRoomState({
              phase: msg.phase,
              roundNumber: msg.roundNumber,
              pattern: msg.pattern,
              currentTrackId: msg.currentTrackId,
              currentTrackTitle: msg.currentTrackTitle,
            });
            break;
          case "card":
            setCard(msg.card);
            break;
          case "track_started":
            setRoomState((prev) => ({
              ...prev,
              currentTrackId: msg.trackId,
              currentTrackTitle: msg.title,
            }));
            break;
          case "bingo_claim":
            // host only
            break;
          case "bingo_confirmed":
            setBingoResult({ valid: msg.valid });
            break;
          case "reset_game":
            setPlayers([]);
            setRoomState({
              phase: "lobby",
              roundNumber: 1,
              pattern: null,
              currentTrackId: null,
              currentTrackTitle: null,
            });
            setCard(null);
            setBingoResult(null);
            break;
          case "error":
            setError(msg.message);
            break;
        }
      } catch {
        // ignore
      }
    };

    return () => {
      ws.close();
    };
  }, [role, roomCode, playerName]);

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  return {
    connected,
    error,
    players,
    roomState,
    card,
    bingoResult,
    playerId,
    send,
  };
}
