import * as React from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import { Select, SelectItem } from "../../components/ui/select";
import { Label } from "../../components/ui/label";
import { MusicBingoLogo } from "./logo";
import { useRoom } from "./useRoom";
import { pickMusicFiles, pickMusicFolder, supportsDirectoryPicker } from "./fileAccess";
import { loadPlaylists, savePlaylists } from "./storage";
import type { Playlist, Track, HostConfig, PlayerPublic } from "./types";
import { PATTERNS } from "./types";
import {
  Users,
  Play,
  SkipForward,
  Upload,
  Plus,
  Trash2,
  Copy,
  RefreshCw,
  QrCode,
  ListMusic,
  Settings2,
  Gamepad2,
  AlertCircle,
  CheckCircle2,
  Volume2,
  VolumeX,
  FolderOpen,
  Music,
} from "lucide-react";
import QRCode from "qrcode";

export function MusicBingoHost() {
  const [tab, setTab] = React.useState("playlists");
  const [playlists, setPlaylists] = React.useState<Playlist[]>(loadPlaylists());
  const [selectedPlaylistId, setSelectedPlaylistId] = React.useState<string | null>(null);
  const [newPlaylistName, setNewPlaylistName] = React.useState("");
  const [config, setConfig] = React.useState<HostConfig>({
    hostName: "",
    roomCode: generateRoomCode(),
    totalRounds: 3,
  });
  const [pattern, setPattern] = React.useState("line_horizontal");
  const [roundNumber, setRoundNumber] = React.useState(1);
  const [qrSvg, setQrSvg] = React.useState("");
  const [currentTrack, setCurrentTrack] = React.useState<Track | null>(null);
  const [trackQueue, setTrackQueue] = React.useState<Track[]>([]);
  const [trackIndex, setTrackIndex] = React.useState<number | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = React.useState(false);

  const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId) || null;
  const roomCode = config.roomCode;
  const inviteUrl = `${window.location.origin}/musicbingo/play?room=${encodeURIComponent(roomCode)}`;

  const { connected, players, roomState, send } = useRoom("host", roomCode);

  React.useEffect(() => {
    QRCode.toString(inviteUrl, { type: "svg", width: 200, margin: 2 }, (err, svg) => {
      if (!err) setQrSvg(svg);
    });
  }, [inviteUrl]);

  React.useEffect(() => {
    savePlaylists(playlists);
  }, [playlists]);

  React.useEffect(() => {
    if (currentTrack && audioRef.current) {
      const url = URL.createObjectURL(currentTrack.file);
      audioRef.current.src = url;
      audioRef.current.play().catch(() => {});
      return () => URL.revokeObjectURL(url);
    }
  }, [currentTrack]);

  function generateRoomCode() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  function createPlaylist() {
    if (!newPlaylistName.trim()) return;
    const pl: Playlist = {
      id: Math.random().toString(36).slice(2),
      name: newPlaylistName.trim(),
      tracks: [],
    };
    setPlaylists((prev) => [...prev, pl]);
    setNewPlaylistName("");
  }

  function deletePlaylist(id: string) {
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
    if (selectedPlaylistId === id) setSelectedPlaylistId(null);
  }

  async function addTracksFromFolder(playlistId: string) {
    try {
      const tracks = supportsDirectoryPicker()
        ? await pickMusicFolder()
        : await pickMusicFiles();
      addTracks(playlistId, tracks);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка загрузки");
    }
  }

  async function addTracksFromFiles(playlistId: string) {
    try {
      const tracks = await pickMusicFiles();
      addTracks(playlistId, tracks);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ошибка загрузки");
    }
  }

  function addTracks(playlistId: string, tracks: Track[]) {
    if (!tracks.length) return;
    setPlaylists((prev) =>
      prev.map((p) => (p.id === playlistId ? { ...p, tracks: [...p.tracks, ...tracks] } : p))
    );
  }

  function removeTrack(playlistId: string, trackId: string) {
    setPlaylists((prev) =>
      prev.map((p) => (p.id === playlistId ? { ...p, tracks: p.tracks.filter((t) => t.id !== trackId) } : p))
    );
  }

  function startRound() {
    console.log("startRound clicked", { selectedPlaylist, tracks: selectedPlaylist?.tracks.length, connected });
    if (!selectedPlaylist) {
      alert("Сначала выберите плейлист во вкладке 'Плейлисты'");
      return;
    }
    if (selectedPlaylist.tracks.length < 25) {
      alert(`Нужно минимум 25 треков в плейлисте, сейчас ${selectedPlaylist.tracks.length}`);
      return;
    }
    const queue = [...selectedPlaylist.tracks].sort(() => Math.random() - 0.5);
    setTrackQueue(queue);
    setTrackIndex(null);
    setCurrentTrack(null);
    send({
      type: "start_round",
      roundNumber,
      pattern,
      trackPool: selectedPlaylist.tracks.map((t) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
      })),
    });
  }

  function nextTrack() {
    if (!selectedPlaylist || trackQueue.length === 0) return;
    const nextIdx = trackIndex == null ? 0 : trackIndex + 1;
    if (nextIdx >= trackQueue.length) {
      alert("Все треки раунда сыграны");
      return;
    }
    const track = trackQueue[nextIdx];
    setTrackIndex(nextIdx);
    setCurrentTrack(track);
    send({
      type: "track_started",
      trackId: track.id,
      title: track.title,
      artist: track.artist,
    });
  }

  function endRound() {
    send({ type: "end_round" });
    setCurrentTrack(null);
    setTrackIndex(null);
    if (roundNumber < config.totalRounds) {
      setRoundNumber((n) => n + 1);
    }
  }

  function confirmBingo(player: PlayerPublic, valid: boolean) {
    send({ type: "confirm_bingo", playerId: player.id, valid });
  }

  function resetGame() {
    send({ type: "reset_game" });
    setCurrentTrack(null);
    setTrackIndex(null);
    setRoundNumber(1);
  }

  function copyUrl() {
    navigator.clipboard.writeText(inviteUrl);
  }

  function toggleMute() {
    if (audioRef.current) {
      audioRef.current.muted = !audioRef.current.muted;
      setMuted(!!audioRef.current.muted);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0f13] p-4 text-indigo-50 md:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-col gap-4 rounded-2xl border border-indigo-700/30 bg-[#1a1a24] p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-pink-500">
              <MusicBingoLogo className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-xl font-bold">MusicBingo Web</h1>
              <p className="text-xs text-indigo-200/60">
                {connected ? "Подключено к комнате" : "Подключение..."} · Код: {roomCode}
              </p>
            </div>
          </div>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="play" className="gap-2">
                <Gamepad2 className="h-4 w-4" /> Игра
              </TabsTrigger>
              <TabsTrigger value="playlists" className="gap-2">
                <ListMusic className="h-4 w-4" /> Плейлисты
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2">
                <Settings2 className="h-4 w-4" /> Настройки
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </header>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsContent value="play" className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-indigo-200/70">
                    <Gamepad2 className="h-4 w-4" />
                    {roomState.phase === "playing"
                      ? `Раунд ${roomState.roundNumber} идёт`
                      : roomState.phase === "roundover"
                      ? "Раунд завершён"
                      : "Подготовка к игре"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-indigo-700/30 bg-[#0f0f13] p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm text-indigo-200/70">
                        {selectedPlaylist ? (
                          <>
                            Плейлист: <span className="font-semibold text-indigo-100">{selectedPlaylist.name}</span>
                            <span className="ml-2 text-xs">({selectedPlaylist.tracks.length} треков)</span>
                          </>
                        ) : (
                          <span className="text-rose-300">Плейлист не выбран</span>
                        )}
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setTab("playlists")}>
                        <ListMusic className="mr-1 h-3 w-3" /> Выбрать
                      </Button>
                    </div>
                    {currentTrack ? (
                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-wider text-indigo-200/50">Сейчас играет</div>
                        <div className="text-2xl font-bold">{currentTrack.title}</div>
                        <div className="text-indigo-200/70">{currentTrack.artist || "—"}</div>
                        <audio ref={audioRef} controls className="mt-2 w-full" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 text-indigo-200/50">
                        <Music className="h-5 w-5" />
                        <span>Трек ещё не запущен</span>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Паттерн победы</Label>
                      <Select value={pattern} onValueChange={setPattern}>
                        {PATTERNS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Номер раунда</Label>
                      <Input
                        type="number"
                        min={1}
                        value={roundNumber}
                        onChange={(e) => setRoundNumber(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={startRound}
                      disabled={!selectedPlaylist || selectedPlaylist.tracks.length < 25 || !connected}
                      title={
                        !selectedPlaylist
                          ? "Выберите плейлист"
                          : selectedPlaylist.tracks.length < 25
                          ? `Нужно минимум 25 треков (сейчас ${selectedPlaylist.tracks.length})`
                          : !connected
                          ? "Нет подключения"
                          : ""
                      }
                    >
                      <Play className="mr-2 h-4 w-4" /> Начать раунд
                    </Button>
                    <Button onClick={nextTrack} variant="secondary">
                      <SkipForward className="mr-2 h-4 w-4" /> Следующий трек
                    </Button>
                    <Button onClick={endRound} variant="outline">
                      Завершить раунд
                    </Button>
                    <Button onClick={toggleMute} variant="ghost">
                      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-indigo-200/70">
                    <QrCode className="h-4 w-4" /> Пригласить игроков
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {qrSvg ? (
                    <div dangerouslySetInnerHTML={{ __html: qrSvg }} className="mx-auto w-44 rounded-xl bg-white p-2" />
                  ) : (
                    <div className="flex h-44 items-center justify-center text-indigo-200/50">QR...</div>
                  )}
                  <div className="flex items-center gap-2 rounded-lg bg-[#0f0f13] px-3 py-2 text-sm">
                    <span className="flex-1 truncate text-indigo-200/70">{inviteUrl}</span>
                    <Button variant="ghost" size="icon" onClick={copyUrl} className="h-7 w-7 shrink-0">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-indigo-200/70">
                  <Users className="h-4 w-4" /> Игроки ({players.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {players.length === 0 ? (
                  <div className="py-6 text-center text-indigo-200/50">
                    Пока никто не подключился. Поделитесь QR-кодом или ссылкой.
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {players.map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded-lg bg-[#0f0f13] p-3">
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-indigo-200/50">
                            {p.bingoClaimed ? "Заявил бинго" : "В игре"}
                          </div>
                        </div>
                        {p.bingoClaimed && !p.bingoConfirmed && (
                          <div className="flex gap-1">
                            <Button size="sm" onClick={() => confirmBingo(p, true)} className="bg-emerald-600 hover:bg-emerald-500">
                              <CheckCircle2 className="mr-1 h-3 w-3" /> Да
                            </Button>
                            <Button size="sm" onClick={() => confirmBingo(p, false)} variant="outline" className="border-rose-700/50 text-rose-300">
                              Нет
                            </Button>
                          </div>
                        )}
                        {p.bingoConfirmed && <span className="text-sm font-bold text-emerald-400">Бинго!</span>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="playlists" className="space-y-4">
            {playlists.length === 0 && (
              <div className="rounded-xl border border-indigo-700/30 bg-[#1a1a24] p-6 text-center">
                <ListMusic className="mx-auto mb-3 h-10 w-10 text-indigo-400/40" />
                <h3 className="text-lg font-semibold text-indigo-100">Создайте первый плейлист</h3>
                <p className="mt-1 text-sm text-indigo-200/60">
                  Затем добавьте mp3 с диска. Файлы останутся на компьютере, сервер их не получит.
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Input
                placeholder="Название плейлиста"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createPlaylist()}
              />
              <Button onClick={createPlaylist}>
                <Plus className="mr-2 h-4 w-4" /> Создать
              </Button>
            </div>

            {playlists.map((pl) => (
              <Card key={pl.id}>
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
                    <div className="flex items-center gap-2">
                      {pl.name}
                      {selectedPlaylistId === pl.id && (
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                          Выбран
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant={selectedPlaylistId === pl.id ? "default" : "outline"} size="sm" onClick={() => setSelectedPlaylistId(pl.id)}>
                        {selectedPlaylistId === pl.id ? "Выбран" : "Выбрать"}
                      </Button>
                      {supportsDirectoryPicker() && (
                        <Button variant="outline" size="sm" onClick={() => addTracksFromFolder(pl.id)}>
                          <FolderOpen className="mr-2 h-4 w-4" /> Папка
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => addTracksFromFiles(pl.id)}>
                        <Upload className="mr-2 h-4 w-4" /> Файлы
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deletePlaylist(pl.id)} className="text-rose-400">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {pl.tracks.length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-indigo-200/50">
                      <AlertCircle className="h-4 w-4" /> В плейлисте нет песен
                    </div>
                  ) : (
                    <ul className="max-h-64 space-y-1 overflow-y-auto">
                      {pl.tracks.map((t, idx) => (
                        <li key={t.id} className="flex items-center justify-between rounded-md bg-[#0f0f13] px-3 py-2 text-sm">
                          <span className="truncate">
                            {idx + 1}. {t.title}
                          </span>
                          <Button variant="ghost" size="icon" onClick={() => removeTrack(pl.id, t.id)} className="h-6 w-6 text-rose-400">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wider text-indigo-200/70">Параметры игры</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <Label>Имя ведущего</Label>
                  <Input value={config.hostName} onChange={(e) => setConfig((c) => ({ ...c, hostName: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Код комнаты</Label>
                  <Input value={config.roomCode} onChange={(e) => setConfig((c) => ({ ...c, roomCode: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Количество раундов</Label>
                  <Input type="number" min={1} value={config.totalRounds} onChange={(e) => setConfig((c) => ({ ...c, totalRounds: Number(e.target.value) }))} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm uppercase tracking-wider text-indigo-200/70">Управление</CardTitle>
              </CardHeader>
              <CardContent>
                <Button onClick={resetGame} variant="outline" className="border-rose-700/50 text-rose-300">
                  <RefreshCw className="mr-2 h-4 w-4" /> Сбросить игру
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
