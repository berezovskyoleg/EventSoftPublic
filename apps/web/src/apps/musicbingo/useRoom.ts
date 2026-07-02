import { useEffect, useRef, useState, useCallback } from "react";
import type { PlayerPublic, CardCell } from "./types";

const WS_URL =
  window.location.protocol === "https:"
    ? `wss://${window.location.host}/ws/musicbingo`
    : `ws://${window.location.host}/ws/musicbingo`;

export interface RoomState {
  phase: "lobby" | "playing" | "roundover" | "gameover";
  roundNumber: number;
  pattern: string | null;
  currentTrackId: string | null;
  currentTrackTitle: string | null;
  playedTrackIds: string[];
  winners: { playerId: string; name: string; at: number }[];
}

export function useRoom(role: "host" | "player", roomCode: string, playerName?: string) {
  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<number | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const attemptRef = useRef(0);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerPublic[]>([]);
  const [roomState, setRoomState] = useState<RoomState>({
    phase: "lobby",
    roundNumber: 1,
    pattern: null,
    currentTrackId: null,
    currentTrackTitle: null,
    playedTrackIds: [],
    winners: [],
  });
  const [card, setCard] = useState<CardCell[] | null>(null);
  const [bingo, setBingo] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const url = `${WS_URL}?room=${encodeURIComponent(roomCode)}&role=${role}${
      role === "player" && playerName ? `&name=${encodeURIComponent(playerName)}` : ""
    }`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError(null);
      attemptRef.current = 0;
    };

    ws.onclose = () => {
      setConnected(false);
      // Exponential reconnect.
      const delay = Math.min(1000 * 2 ** attemptRef.current, 30000);
      attemptRef.current += 1;
      if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
      reconnectRef.current = window.setTimeout(connect, delay);
    };

    ws.onerror = () => {
      setError("Ошибка соединения");
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        switch (msg.type) {
          case "host_assigned":
            setPlayers(msg.players || []);
            setRoomState((s) => ({ ...s, winners: msg.winners || [] }));
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
            setRoomState((s) => ({
              phase: msg.phase,
              roundNumber: msg.roundNumber,
              pattern: msg.pattern,
              currentTrackId: msg.currentTrackId ?? s.currentTrackId,
              currentTrackTitle: msg.currentTrackTitle ?? s.currentTrackTitle,
              playedTrackIds: msg.playedTrackIds || [],
              winners: msg.winners || [],
            }));
            setBingo(false);
            break;
          case "card":
            setCard(msg.card);
            setBingo(false);
            break;
          case "track_started":
            setRoomState((s) => ({
              ...s,
              currentTrackId: msg.trackId,
              currentTrackTitle: msg.title,
              playedTrackIds: Array.from(new Set([...s.playedTrackIds, msg.trackId])),
            }));
            break;
          case "bingo":
            if (msg.you) {
              setBingo(true);
            } else if (msg.winner) {
              setRoomState((s) => ({
                ...s,
                winners: [...s.winners, msg.winner].sort((a, b) => a.at - b.at),
              }));
            }
            break;
          case "player_bingo":
            setPlayers((prev) =>
              prev.map((p) =>
                p.id === msg.playerId ? { ...p, bingoWon: true, bingoAt: Date.now() } : p
              )
            );
            break;
          case "reset_game":
            setPlayers([]);
            setRoomState({
              phase: "lobby",
              roundNumber: 1,
              pattern: null,
              currentTrackId: null,
              currentTrackTitle: null,
              playedTrackIds: [],
              winners: [],
            });
            setCard(null);
            setBingo(false);
            break;
          case "error":
            setError(msg.message);
            break;
        }
      } catch {
        // ignore
      }
    };
  }, [role, roomCode, playerName]);

  useEffect(() => {
    connect();

    // Heartbeat to keep connection alive through short sleeps.
    pingRef.current = window.setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 20000);

    // Reconnect immediately when the device wakes up or comes back online.
    const onVisible = () => {
      if (document.visibilityState === "visible" && wsRef.current?.readyState !== WebSocket.OPEN) {
        connect();
      }
    };
    const onOnline = () => connect();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);

    return () => {
      if (pingRef.current) window.clearInterval(pingRef.current);
      if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      wsRef.current?.close();
    };
  }, [connect]);

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
    bingo,
    playerId,
    send,
  };
}
