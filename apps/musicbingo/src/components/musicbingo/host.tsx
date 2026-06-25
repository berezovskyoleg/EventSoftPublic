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
  QrCode,
  Settings2,
  ListMusic,
  Gamepad2,
  Info,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { MusicBingoLogo } from "./logo";
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
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [showHowTo, setShowHowTo] = useState(true);

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

  function handleDragOver(e: React.DragEvent, id: number) {
    e.preventDefault();
    setDropTarget(id);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDropTarget(null);
  }

  async function handleDrop(e: React.DragEvent, id: number) {
    e.preventDefault();
    setDropTarget(null);
    const files = e.dataTransfer.files;
    if (!files.length) return;
    await uploadFiles(id, Array.from(files));
  }

  async function uploadFiles(id: number, files: File[]) {
    const payload = files.map((f) => ({
      path: (f as unknown as { path?: string }).path || URL.createObjectURL(f),
      title: f.name.replace(/\.[^/.]+$/, ""),
      artist: "",
      duration_seconds: 30,
    }));
    try {
      await importTracks(id, payload);
      toast({ title: `Загружено ${payload.length} песен` });
      await loadPlaylists();
    } catch (err) {
      toast({
        title: "Ошибка загрузки",
        description: err instanceof Error ? err.message : "",
        variant: "destructive",
      });
    }
  }

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || importTarget == null) return;
    await uploadFiles(importTarget, Array.from(files));
    e.target.value = "";
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
              <MusicBingoLogo className="h-7 w-7 text-white" />
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
            <TabsTrigger value="game" className="gap-2">
              <Gamepad2 className="h-4 w-4" />
              Игра
            </TabsTrigger>
            <TabsTrigger value="playlists" className="gap-2">
              <ListMusic className="h-4 w-4" />
              Плейлисты
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Настройки
            </TabsTrigger>
          </TabsList>

          <TabsContent value="game" className="space-y-4">
            {/* Step-by-step status + invite */}
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="border-indigo-700/30 bg-[#1a1a24] text-indigo-50 lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-indigo-200/70">
                    <Gamepad2 className="h-4 w-4" />
                    {gameState?.phase === "playing"
                      ? `Раунд ${gameState?.round.round_number} идёт`
                      : gameState?.phase === "finished"
                        ? "Игра завершена"
                        : "Подготовка к игре"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Current track display */}
                  <div className="rounded-xl border border-indigo-700/30 bg-[#0f0f13] p-4">
                    {activeTrack ? (
                      <div className="space-y-1">
                        <div className="text-xs uppercase tracking-wider text-indigo-200/50">Сейчас играет</div>
                        <div className="text-2xl font-bold">{activeTrack.title}</div>
                        <div className="text-indigo-200/70">{activeTrack.artist}</div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 text-indigo-200/50">
                        <Music className="h-5 w-5" />
                        <span>Трек ещё не запущен</span>
                      </div>
                    )}
                  </div>

                  {/* Quick controls */}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Паттерн победы</Label>
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
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleStartRound} className="bg-indigo-600 hover:bg-indigo-500">
                      <Play className="mr-2 h-4 w-4" />
                      Начать раунд
                    </Button>
                    <Button onClick={handleNextTrack} variant="secondary">
                      <SkipForward className="mr-2 h-4 w-4" />
                      Следующий трек
                    </Button>
                    <Button onClick={handleEndRound} variant="outline" className="border-indigo-700/50">
                      Завершить раунд
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Invite card with QR */}
              <Card className="border-indigo-700/30 bg-[#1a1a24] text-indigo-50">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-indigo-200/70">
                    <QrCode className="h-4 w-4" />
                    Пригласить игроков
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {qrSvg ? (
                    <div className="flex flex-col items-center gap-3">
                      <img src={qrSvg} alt="QR" className="h-44 w-44 rounded-xl bg-white p-2" />
                      <p className="text-center text-xs text-indigo-200/60">
                        Отсканируйте QR или перейдите по ссылке, чтобы получить карточку бинго
                      </p>
                    </div>
                  ) : (
                    <div className="flex h-44 items-center justify-center text-indigo-200/50">Загрузка QR...</div>
                  )}

                  {serverUrl && (
                    <div className="space-y-2">
                      <Label className="text-xs">Ссылка для игроков</Label>
                      <div className="flex items-center gap-2 rounded-lg bg-[#0f0f13] px-3 py-2 text-sm">
                        <span className="flex-1 truncate text-indigo-200/70">{serverUrl}</span>
                        <Button variant="ghost" size="icon" onClick={copyUrl} className="h-7 w-7 shrink-0">
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {showHowTo && (
                    <div className="rounded-lg border border-indigo-700/30 bg-[#0f0f13] p-3 text-xs text-indigo-200/70">
                      <div className="mb-2 flex items-center gap-1.5 font-semibold text-indigo-200">
                        <Info className="h-3.5 w-3.5" />
                        Как играют гости
                      </div>
                      <ol className="list-decimal space-y-1 pl-4">
                        <li>Открывают ссылку на телефоне</li>
                        <li>Вводят код комнаты: <span className="font-mono text-indigo-300">{roomCode || "—"}</span></li>
                        <li>Отмечают услышанные песни на карточке</li>
                        <li>Кричат «Бинго!» — вы проверяете здесь</li>
                      </ol>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Players */}
            <Card className="border-indigo-700/30 bg-[#1a1a24] text-indigo-50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-indigo-200/70">
                  <Users className="h-4 w-4" />
                  Игроки ({players.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {players.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-6 text-center text-indigo-200/50">
                    <Users className="h-10 w-10 opacity-30" />
                    <div>
                      <p className="font-medium text-indigo-200/70">Пока никто не подключился</p>
                      <p className="text-sm">Поделитесь QR-кодом или ссылкой выше, чтобы игроки присоединились</p>
                    </div>
                  </div>
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
                          <span className="flex items-center gap-1 text-sm font-bold text-emerald-400">
                            <CheckCircle2 className="h-4 w-4" /> Бинго!
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="playlists" className="space-y-4">
            {/* Empty state helper */}
            {playlists.length === 0 && (
              <div className="rounded-xl border border-indigo-700/30 bg-[#1a1a24] p-6 text-center">
                <ListMusic className="mx-auto mb-3 h-10 w-10 text-indigo-400/40" />
                <h3 className="text-lg font-semibold text-indigo-100">Создайте первый плейлист</h3>
                <p className="mt-1 text-sm text-indigo-200/60">
                  Введите название ниже, затем перетащите в него mp3-файлы или нажмите «Загрузить песни»
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Input
                placeholder="Название нового плейлиста"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreatePlaylist()}
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
                  <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
                    <div className="flex items-center gap-2">
                      <span>{pl.name}</span>
                      {selectedPlaylistId === pl.id && (
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                          Выбран для игры
                        </span>
                      )}
                    </div>
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
                        Загрузить песни
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
                <CardContent className="space-y-3">
                  {/* Drag-and-drop zone */}
                  <div
                    onDragOver={(e) => handleDragOver(e, pl.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, pl.id)}
                    onClick={() => openImport(pl.id)}
                    className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                      dropTarget === pl.id
                        ? "border-indigo-400 bg-indigo-500/10"
                        : "border-indigo-700/40 bg-[#0f0f13] hover:border-indigo-500/50 hover:bg-indigo-500/5"
                    }`}
                  >
                    <Upload className="mx-auto mb-2 h-6 w-6 text-indigo-400/70" />
                    <p className="text-sm font-medium text-indigo-200/80">
                      Перетащите mp3-файлы сюда
                    </p>
                    <p className="mt-1 text-xs text-indigo-200/50">или нажмите, чтобы выбрать файлы</p>
                  </div>

                  {tracks[pl.id]?.length ? (
                    <div>
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-indigo-200/50">
                        Треков: {tracks[pl.id].length}
                      </div>
                      <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
                        {tracks[pl.id].map((t, idx) => (
                          <li
                            key={t.id}
                            className="flex items-center justify-between rounded-md bg-[#0f0f13] px-3 py-2 text-sm"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="shrink-0 text-xs text-indigo-200/40">{idx + 1}.</span>
                              <span className="truncate">
                                {t.title} {t.artist ? `— ${t.artist}` : ""}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteTrack(t.id)}
                              className="h-6 w-6 shrink-0 text-rose-400"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-indigo-200/50">
                      <AlertCircle className="h-4 w-4" />
                      В этом плейлисте пока нет песен
                    </div>
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
                  Управление игрой
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-indigo-200/70">
                  Сброс вернёт игру в начальное состояние. Все карточки игроков будут удалены.
                </p>
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
