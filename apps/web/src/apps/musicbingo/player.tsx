import * as React from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { MusicBingoLogo } from "./logo";
import { useRoom } from "./useRoom";

interface PlayerViewProps {
  roomCode: string;
}

export function MusicBingoPlayer({ roomCode }: PlayerViewProps) {
  const [name, setName] = React.useState("");
  const [joined, setJoined] = React.useState(false);
  const [marked, setMarked] = React.useState<Set<string>>(new Set());
  const [markError, setMarkError] = React.useState<string | null>(null);

  const { connected, error, roomState, card, bingo, send } = useRoom(
    "player",
    roomCode,
    joined ? name : undefined
  );

  React.useEffect(() => {
    if (!joined) return;
    send({ type: "set_name", name });
  }, [joined, name, send]);

  React.useEffect(() => {
    // Reset local marks on new round.
    setMarked(new Set());
    setMarkError(null);
  }, [roomState.roundNumber, roomState.phase]);

  function toggleMark(trackId: string) {
    setMarkError(null);
    if (!roomState.playedTrackIds.includes(trackId)) {
      setMarkError("Эта песня ещё не звучала");
      return;
    }
    if (marked.has(trackId)) {
      setMarked((prev) => {
        const next = new Set(prev);
        next.delete(trackId);
        return next;
      });
      send({ type: "mark", trackId });
    } else {
      setMarked((prev) => {
        const next = new Set(prev);
        next.add(trackId);
        return next;
      });
      send({ type: "mark", trackId });
    }
  }

  if (!joined) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <div className="mb-3 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-pink-500">
                <MusicBingoLogo className="h-8 w-8" />
              </div>
            </div>
            <CardTitle className="text-center">MusicBingo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-center text-sm text-indigo-200/60">Комната: {roomCode}</p>
            <Input
              placeholder="Ваше имя"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && name.trim() && setJoined(true)}
            />
            <Button onClick={() => name.trim() && setJoined(true)} className="w-full">
              Войти в игру
            </Button>
            {error && <p className="text-center text-sm text-rose-400">{error}</p>}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 text-indigo-200/60">
        Подключение...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f13] p-4 text-indigo-50">
      <div className="mx-auto max-w-md space-y-4">
        <header className="flex items-center justify-between rounded-2xl border border-indigo-700/30 bg-[#1a1a24] p-4">
          <div className="flex items-center gap-2">
            <MusicBingoLogo className="h-6 w-6" />
            <span className="font-bold">{name}</span>
          </div>
          <div className="text-xs text-indigo-200/60">
            {roomState.phase === "playing" ? `Раунд ${roomState.roundNumber}` : "Ожидание"}
          </div>
        </header>

        {bingo && (
          <div className="animate-pulse rounded-2xl bg-gradient-to-r from-pink-500 to-indigo-500 p-4 text-center text-2xl font-black text-white shadow-lg shadow-pink-500/30">
            🎉 Бинго! 🎉
          </div>
        )}

        {markError && (
          <div className="rounded-lg bg-rose-500/20 px-3 py-2 text-center text-sm text-rose-200">
            {markError}
          </div>
        )}

        {card ? (
          <div className="grid grid-cols-5 gap-1.5">
            {card.map((cell, idx) => {
              const isMarked = marked.has(cell.trackId);
              return (
                <button
                  key={idx}
                  onClick={() => toggleMark(cell.trackId)}
                  className={`aspect-square rounded-lg border p-1 text-[10px] leading-tight transition ${
                    isMarked
                      ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-100"
                      : "border-indigo-700/40 bg-[#1a1a24] text-indigo-200/80 hover:bg-[#252532]"
                  }`}
                  title={cell.title}
                >
                  <span className="line-clamp-3">{cell.title}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-indigo-700/30 bg-[#1a1a24] p-8 text-center text-indigo-200/60">
            Ожидаем начала раунда и карточку от ведущего...
          </div>
        )}
      </div>
    </div>
  );
}
