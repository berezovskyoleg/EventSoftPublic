"use client";

import { useEffect, useRef, useState } from "react";
import {
  Copy,
  LogOut,
  Music,
  Play,
  Plus,
  RefreshCw,
  SkipForward,
  Trophy,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  confirmBingo,
  createPlaylist,
  deletePlaylist,
  deleteTrack,
  endRound,
  generateQr,
  getGameState,
  getPlaylistTracks,
  getPlayers,
  getServerUrl,
  importTracks,
  listPlaylists,
  nextTrack,
  resetGame,
  setGameConfig,
  setGamePlaylist,
  startRound,
  type CurrentTrack,
  type GameStateResponse,
  type Player,
  type Playlist,
  type Track,
} from "@/lib/api";

interface HostProps {
  licenseKey: string;
  onLogout: () => void;
}

const PATTERNS = [
  { value: "line_horizontal", label: "Одна линия (горизонталь)" },
  { value: "line_vertical", label: "Одна линия (вертикаль)" },
  { value: "two_lines", label: "Две линии" },
  { value: "three_lines", label: "Три линии" },
  { value: "four_corners", label: "Четыре угла" },
  { value: "x", label: "Буква X" },
  { value: "full_house", label: "Полный дом" },
];

export function MusicBingoHost({ licenseKey, onLogout }: HostProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState("game");

  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);

  const [hostName, setHostName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [totalRounds, setTotalRounds] = useState(3);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [tracks, setTracks] = useState<Record<number, Track[]>>({});
  const [newPlaylistName, setNewPlaylistName] = useState("");

  const [gameState, setGameState] = useState<GameStateResponse | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPattern, setCurrentPattern] = useState("line_horizontal");
  const [roundNumber, setRoundNumber] = useState(1);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importTarget, setImportTarget] = useState<number | null>(null);

  useEffect(() => {
    loadServerUrl();
    loadPlaylists();
    const id = setInterval(pollGame, 2000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadServerUrl() {
    try {
      const url = await getServerUrl();
      setServerUrl(url);
      if (url) {
        const svg = await generateQr(url);
        setQrSvg(svg);
      }
    } catch {
      // ignore
    }
  }

  async function loadPlaylists() {
    try {
      const list = await listPlaylists();
      setPlaylists(list);
      const nextTracks: Record<number, Track[]> = {};
      for (const pl of list) {
        nextTracks[pl.id] = await getPlaylistTracks(pl.id);
      }
      setTracks(nextTracks);
    } catch (err) {
      toast({
        title: "Ошибка загрузки плейлистов",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    }
  }

  async function pollGame() {
    try {
      const state = await getGameState();
      setGameState(state);
      const list = await getPlayers();
      setPlayers(list);
    } catch {
      // ignore polling errors
    }
  }

  async function handleSaveConfig() {
    try {
      await setGameConfig(hostName, roomCode, totalRounds);
      toast({ title: "Настройки сохранены" });
    } catch (err) {
      toast({
        title: "Ошибка",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    }
  }

  async function handleSelectPlaylist(id: number) {
    try {
      await setGamePlaylist(id);
      setSelectedPlaylistId(id);
      toast({ title: "Плейлист выбран для игры" });
    } catch (err) {
      toast({
        title: "Ошибка",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    }
  }

  async function handleCreatePlaylist() {
    if (!newPlaylistName.trim()) return;
    try {
      await createPlaylist(newPlaylistName.trim());
      setNewPlaylistName("");
      await loadPlaylists();
    } catch (err) {
      toast({
        title: "Ошибка",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    }
  }

  async function handleDeletePlaylist(id: number) {
    if (!confirm("Удалить плейлист?")) return;
    try {
      await deletePlaylist(id);
      await loadPlaylists();
    } catch (err) {
      toast({
        title: "Ошибка",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    }
  }

  async function handleDeleteTrack(id: number) {
    if (!confirm("Удалить трек?")) return;
    try {
      await deleteTrack(id);
      await loadPlaylists();
    } catch (err) {
      toast({
        title: "Ошибка",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    }
  }

  function openImport(id: number) {
    setImportTarget(id);
    fileInputRef.current?.click();
  }

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || importTarget == null) return;

    const payload = Array.from(files).map((f) => ({
      path: (f as unknown as { path?: string }).path || URL.createObjectURL(f),
      title: f.name.replace(/\.[^/.]+$/, ""),
      artist: "",
      duration_seconds: 30,
    }));

    try {
      await importTracks(importTarget, payload);
      toast({ title: `Импортировано ${payload.length} треков` });
      await loadPlaylists();
    } catch (err) {
      toast({
        title: "Ошибка импорта",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    } finally {
      e.target.value = "";
    }
  }

  async function handleStartRound() {
    try {
      await startRound(currentPattern, roundNumber);
      toast({ title: `Раунд ${roundNumber} начат` });
    } catch (err) {
      toast({
        title: "Ошибка",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    }
  }

  async function handleNextTrack() {
    try {
      const t = await nextTrack();
      toast({ title: `Играет: ${t.title} — ${t.artist}` });
    } catch (err) {
      toast({
        title: "Ошибка",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    }
  }

  async function handleEndRound() {
    try {
      await endRound();
      setRoundNumber((n) => n + 1);
      toast({ title: "Раунд завершён" });
    } catch (err) {
      toast({
        title: "Ошибка",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    }
  }

  async function handleResetGame() {
    if (!confirm("Сбросить игру? Все игроки потеряют карточки.")) return;
    try {
      await resetGame();
      setRoundNumber(1);
      toast({ title: "Игра сброшена" });
    } catch (err) {
      toast({
        title: "Ошибка",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    }
  }

  async function handleConfirmBingo(playerId: string, name: string) {
    try {
      const res = await confirmBingo(playerId);
      if (res.valid) {
        toast({ title: `🎉 Бинго подтверждено — ${name}!` });
      } else {
        toast({ title: `Бинго не подтверждено — ${name}`, variant: "destructive" });
      }
      await pollGame();
    } catch (err) {
      toast({
        title: "Ошибка",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    }
  }

  function copyUrl() {
    if (!serverUrl) return;
    navigator.clipboard.writeText(serverUrl);
    toast({ title: "Ссылка скопирована" });
  }

  const activeTrack = gameState?.current_track;

  return (
    <div className="min-h-screen bg-[#0f0f13] p-4 text-indigo-50 md:p-6">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/mpeg,audio/wav,audio/mp3"
        className="hidden"
        onChange={handleFilesSelected}
      />

      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-col gap-4 rounded-2xl border border-indigo-700/30 bg-[#1a1a24] p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-pink-500">
              <Music className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">MusicBingo</h1>
              <p className="text-xs text-indigo-200/60">Ключ: {licenseKey}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {serverUrl && (
              <div className="flex items-center gap-2 rounded-lg bg-[#0f0f13] px-3 py-2 text-sm">
                <span className="text-indigo-200/70">{serverUrl}</span>
                <Button variant="ghost" size="icon" onClick={copyUrl} className="h-6 w-6">
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={onLogout} className="border-indigo-700/50 text-indigo-100">
              <LogOut className="mr-2 h-4 w-4" />
              Выйти
            </Button>
          </div>
        </header>

        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="bg-[#1a1a24]">
            <TabsTrigger value="game">Игра</TabsTrigger>
            <TabsTrigger value="playlists">Плейлисты</TabsTrigger>
            <TabsTrigger value="settings">Настройки</TabsTrigger>
          </TabsList>

          <TabsContent value="game" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-indigo-700/30 bg-[#1a1a24] text-indigo-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm uppercase tracking-wider text-indigo-200/70">
                    Управление раундом
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Паттерн</Label>
                    <Select value={currentPattern} onValueChange={setCurrentPattern}>
                      <SelectTrigger className="bg-[#0f0f13] border-indigo-700/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PATTERNS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Номер раунда</Label>
                    <Input
                      type="number"
                      min={1}
                      value={roundNumber}
                      onChange={(e) => setRoundNumber(Number(e.target.value))}
                      className="bg-[#0f0f13] border-indigo-700/50"
                    />
                  </div>
                  <Button onClick={handleStartRound} className="w-full bg-indigo-600 hover:bg-indigo-500">
                    <Play className="mr-2 h-4 w-4" />
                    Начать раунд
                  </Button>
                  <Button onClick={handleNextTrack} variant="secondary" className="w-full">
                    <SkipForward className="mr-2 h-4 w-4" />
                    Следующий трек
                  </Button>
                  <Button onClick={handleEndRound} variant="outline" className="w-full border-indigo-700/50">
                    Завершить раунд
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-indigo-700/30 bg-[#1a1a24] text-indigo-50 md:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm uppercase tracking-wider text-indigo-200/70">
                    Сейчас играет
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {activeTrack ? (
                    <div className="space-y-2">
                      <div className="text-2xl font-bold">{activeTrack.title}</div>
                      <div className="text-indigo-200/70">{activeTrack.artist}</div>
                      <div className="text-xs text-indigo-200/40">
                        Фаза: {gameState?.phase} | Раунд: {gameState?.round.round_number} |{" "}
                        Паттерн: {gameState?.round.pattern ?? "—"}
                      </div>
                    </div>
                  ) : (
                    <div className="text-indigo-200/50">Трек ещё не запущен</div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="border-indigo-700/30 bg-[#1a1a24] text-indigo-50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-indigo-200/70">
                  <Users className="h-4 w-4" />
                  Игроки ({players.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {players.length === 0 ? (
                  <div className="text-indigo-200/50">Пока никто не подключился</div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {players.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-lg bg-[#0f0f13] p-3"
                      >
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-indigo-200/50">
                            {p.bingo_claimed ? "Заявил бинго" : "В игре"}
                          </div>
                        </div>
                        {p.bingo_claimed && !p.bingo_confirmed && (
                          <Button
                            size="sm"
                            onClick={() => handleConfirmBingo(p.id, p.name)}
                            className="bg-pink-600 hover:bg-pink-500"
                          >
                            <Trophy className="mr-1 h-3 w-3" />
                            Проверить
                          </Button>
                        )}
                        {p.bingo_confirmed && (
                          <span className="text-sm font-bold text-emerald-400">Бинго!</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="playlists" className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Название нового плейлиста"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                className="bg-[#1a1a24] border-indigo-700/50"
              />
              <Button onClick={handleCreatePlaylist}>
                <Plus className="mr-2 h-4 w-4" />
                Создать
              </Button>
            </div>

            {playlists.map((pl) => (
              <Card key={pl.id} className="border-indigo-700/30 bg-[#1a1a24] text-indigo-50">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>{pl.name}</span>
                    <div className="flex gap-2">
                      <Button
                        variant={selectedPlaylistId === pl.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleSelectPlaylist(pl.id)}
                      >
                        {selectedPlaylistId === pl.id ? "Выбран" : "Выбрать"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openImport(pl.id)}>
                        <Upload className="mr-2 h-4 w-4" />
                        Импорт
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeletePlaylist(pl.id)}
                        className="text-rose-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {tracks[pl.id]?.length ? (
                    <ul className="space-y-1">
                      {tracks[pl.id].map((t) => (
                        <li
                          key={t.id}
                          className="flex items-center justify-between rounded-md bg-[#0f0f13] px-3 py-2 text-sm"
                        >
                          <span>
                            {t.title} — {t.artist}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteTrack(t.id)}
                            className="h-6 w-6 text-rose-400"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-indigo-200/50">Нет треков</div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card className="border-indigo-700/30 bg-[#1a1a24] text-indigo-50">
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wider text-indigo-200/70">
                  Параметры игры
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label>Имя ведущего</Label>
                    <Input
                      value={hostName}
                      onChange={(e) => setHostName(e.target.value)}
                      className="bg-[#0f0f13] border-indigo-700/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Код комнаты</Label>
                    <Input
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value)}
                      className="bg-[#0f0f13] border-indigo-700/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Количество раундов</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={totalRounds}
                      onChange={(e) => setTotalRounds(Number(e.target.value))}
                      className="bg-[#0f0f13] border-indigo-700/50"
                    />
                  </div>
                </div>
                <Button onClick={handleSaveConfig} className="bg-indigo-600 hover:bg-indigo-500">
                  Сохранить настройки
                </Button>
              </CardContent>
            </Card>

            <Card className="border-indigo-700/30 bg-[#1a1a24] text-indigo-50">
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wider text-indigo-200/70">
                  QR-код для подключения
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                {qrSvg ? (
                  <img src={qrSvg} alt="QR" className="h-48 w-48 rounded-xl bg-white p-2" />
                ) : (
                  <div className="text-indigo-200/50">Загрузка QR...</div>
                )}
                <Button variant="outline" onClick={handleResetGame} className="border-rose-700/50 text-rose-300">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Сбросить игру
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
