import * as React from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { MusicBingoLogo } from "./logo";
import { useRoom } from "./useRoom";
import { Trophy } from "lucide-react";

interface PlayerViewProps {
  roomCode: string;
}

export function MusicBingoPlayer({ roomCode }: PlayerViewProps) {
  const [name, setName] = React.useState("");
  const [joined, setJoined] = React.useState(false);
  const [marked, setMarked] = React.useState<Set<string>>(new Set());

  const { connected, error, roomState, card, bingo, bingoError, send } = useRoom(
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
  }, [roomState.roundNumber, roomState.phase]);

  function toggleMark(trackId: string) {
    setMarked((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) {
        next.delete(trackId);
        send({ type: "unmark", trackId });
      } else {
        next.add(trackId);
        send({ type: "mark", trackId });
      }
      return next;
    });
  }

  function claimBingo() {
    send({ type: "bingo" });
  }

  if (!joined) {
    return (
      <div className="flex h-screen w-full max-w-full items-center justify-center overflow-x-hidden p-4">
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
            <p className="text-center text-sm text-indigo-100/70">Комната: {roomCode}</p>
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
      <div className="flex h-screen w-full max-w-full items-center justify-center overflow-x-hidden p-4 text-indigo-100/70">
        Подключение...
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full max-w-full flex-col overflow-x-hidden overflow-y-auto bg-slate-950 p-3 text-slate-50 sm:p-4">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3">
        <header className="shrink-0 rounded-2xl border border-indigo-500/30 bg-slate-900 p-3 shadow-sm sm:p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MusicBingoLogo className="h-6 w-6" />
              <span className="font-bold text-slate-50">{name}</span>
            </div>
            <div className="text-xs font-medium text-slate-300/80">
              {roomState.phase === "playing" ? `Раунд ${roomState.roundNumber}` : "Ожидание"}
            </div>
          </div>
        </header>

        {bingo && (
          <div className="shrink-0 animate-pulse rounded-2xl bg-gradient-to-r from-pink-500 to-indigo-500 p-4 text-center text-2xl font-black text-white shadow-lg shadow-pink-500/30">
            🎉 Бинго! 🎉
          </div>
        )}

        {bingoError && (
          <div className="shrink-0 rounded-xl border border-rose-500/30 bg-rose-500/15 p-4 text-center">
            <p className="font-semibold text-rose-100">Пока не бинго 😅</p>
            <p className="text-sm text-rose-100/80">{bingoError.message}</p>
          </div>
        )}

        {card ? (
          <>
            <div className="grid grid-cols-5 gap-1 sm:gap-2">
              {card.map((cell, idx) => {
                const isMarked = marked.has(cell.trackId);
                return (
                  <button
                    key={idx}
                    onClick={() => toggleMark(cell.trackId)}
                    className={`flex min-h-[64px] items-start justify-start overflow-hidden rounded-xl border p-0.5 text-left text-[9px] font-medium leading-tight transition sm:min-h-[84px] sm:p-1 sm:text-[11px] ${
                      isMarked
                        ? "border-emerald-500/60 bg-emerald-500/25 text-emerald-50 shadow-sm"
                        : "border-slate-600/40 bg-slate-800 text-slate-100 shadow-sm hover:bg-slate-700"
                    }`}
                    title={cell.title}
                  >
                    <span className="break-words">{cell.title}</span>
                  </button>
                );
              })}
            </div>
            <Button
              onClick={claimBingo}
              disabled={bingo}
              className="shrink-0 w-full bg-pink-600 py-5 text-lg font-bold hover:bg-pink-500 disabled:opacity-60 sm:py-6"
            >
              <Trophy className="mr-2 h-5 w-5" /> БИНГО!
            </Button>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-indigo-500/30 bg-slate-900 p-8 text-center text-slate-300/80">
            Ожидаем, пока ведущий начнёт раунд...
          </div>
        )}
      </div>
    </div>
  );
}
