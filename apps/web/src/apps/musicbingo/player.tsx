import * as React from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { MusicBingoLogo } from "./logo";
import { useRoom } from "./useRoom";
import { checkPattern } from "./cards";
import { Trophy, Music } from "lucide-react";

interface PlayerViewProps {
  roomCode: string;
}

export function MusicBingoPlayer({ roomCode }: PlayerViewProps) {
  const [name, setName] = React.useState("");
  const [joined, setJoined] = React.useState(false);
  const [marked, setMarked] = React.useState<Set<string>>(new Set());
  const [claimSent, setClaimSent] = React.useState(false);

  const { connected, error, roomState, card, bingoResult, send } = useRoom(
    "player",
    roomCode,
    joined ? name : undefined
  );

  React.useEffect(() => {
    if (!joined) return;
    send({ type: "set_name", name });
  }, [joined, name, send]);

  React.useEffect(() => {
    if (roomState.currentTrackId) {
      setMarked((prev) => {
        const next = new Set(prev);
        next.add(roomState.currentTrackId!);
        return next;
      });
    }
  }, [roomState.currentTrackId]);

  function toggleMark(trackId: string) {
    setMarked((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
    send({ type: "mark", trackId });
  }

  function claimBingo() {
    if (!card) return;
    const arr = card.map((c) => marked.has(c.trackId));
    if (roomState.pattern && checkPattern(roomState.pattern, arr)) {
      send({ type: "bingo" });
      setClaimSent(true);
    } else {
      alert("Пока нет собранного паттерна");
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

        {roomState.currentTrackTitle && (
          <div className="rounded-xl border border-indigo-700/30 bg-[#1a1a24] p-3 text-center text-sm text-indigo-200/70">
            <Music className="mx-auto mb-1 h-5 w-5" />
            Сейчас: <span className="font-semibold text-indigo-100">{roomState.currentTrackTitle}</span>
          </div>
        )}

        {card ? (
          <>
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
            <Button onClick={claimBingo} className="w-full bg-pink-600 hover:bg-pink-500">
              <Trophy className="mr-2 h-4 w-4" /> Бинго!
            </Button>
            {claimSent && bingoResult && (
              <p className={`text-center text-sm font-semibold ${bingoResult.valid ? "text-emerald-400" : "text-rose-400"}`}>
                {bingoResult.valid ? "Бинго подтверждено!" : "Бинго не подтверждено"}
              </p>
            )}
          </>
        ) : (
          <div className="rounded-2xl border border-indigo-700/30 bg-[#1a1a24] p-8 text-center text-indigo-200/60">
            Ожидаем начала раунда и карточку от ведущего...
          </div>
        )}
      </div>
    </div>
  );
}
