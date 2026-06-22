"use client";

import { useEffect, useRef, useState } from "react";
import { Music, Volume2, VolumeX, X, Upload, Trash2, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  getSoundEngine,
  SOUND_EVENT_LABELS,
  type SoundEvent,
} from "@/lib/sounds";

const EVENT_ORDER: SoundEvent[] = [
  "clickSpin",
  "spinLoop",
  "tick",
  "reelStop",
  "winFanfare",
  "coin",
  "uiClick",
];

const ACCEPTED_TYPES = [
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/webm",
  "audio/flac",
];

export function SoundSettings() {
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(75);
  const [customMap, setCustomMap] = useState<Record<string, { name: string }>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingEvent, setPendingEvent] = useState<SoundEvent | null>(null);
  const sound = getSoundEngine();

  const refresh = () => {
    setMuted(sound.isMuted);
    setVolume(Math.round(sound.masterVolume * 100));
    const map = sound.getCustomSounds();
    const next: Record<string, { name: string }> = {};
    Object.values(map).forEach((s) => {
      next[s.event] = { name: s.name };
    });
    setCustomMap(next);
  };

  useEffect(() => {
    if (open) refresh();
  }, [open]);

  const handleToggleMute = () => {
    const m = sound.toggleMuted();
    setMuted(m);
  };

  const handleVolumeChange = (value: number[]) => {
    const v = value[0] ?? 75;
    setVolume(v);
    sound.setVolume(v / 100);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingEvent) return;
    await sound.uploadCustomSound(pendingEvent, file);
    refresh();
    setPendingEvent(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const triggerUpload = (event: SoundEvent) => {
    setPendingEvent(event);
    fileInputRef.current?.click();
  };

  const removeSound = async (event: SoundEvent) => {
    await sound.removeCustomSound(event);
    refresh();
  };

  const preview = (event: SoundEvent) => {
    switch (event) {
      case "clickSpin":
        sound.clickSpin();
        break;
      case "spinLoop":
        sound.startSpinLoop(1200);
        setTimeout(() => sound.stopSpinLoop(), 1200);
        break;
      case "tick":
        sound.tick();
        break;
      case "reelStop":
        sound.reelStop();
        break;
      case "winFanfare":
        sound.winFanfare();
        break;
      case "coin":
        sound.coin();
        break;
      case "uiClick":
        sound.uiClick();
        break;
    }
  };

  const resetAll = async () => {
    for (const event of EVENT_ORDER) {
      await sound.removeCustomSound(event);
    }
    sound.setVolume(0.75);
    sound.setMuted(false);
    refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-amber-700/40 bg-transparent text-amber-200 hover:bg-amber-900/30 hover:text-amber-100"
          aria-label="Настройки звука"
        >
          <Music className="h-4 w-4" />
          <span className="ml-1 hidden sm:inline">Звуки</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-amber-700/40 bg-[#1a0f0a] text-amber-50">
        <DialogHeader>
          <DialogTitle className="text-amber-200">Настройки звука</DialogTitle>
          <DialogDescription className="text-amber-200/60">
            Загрузите свои звуковые дорожки для любого события или используйте
            встроенные мягкие звуки.
          </DialogDescription>
        </DialogHeader>

        {/* Master controls */}
        <div className="space-y-4 rounded-xl border border-amber-700/30 bg-[#241710]/60 p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleMute}
              className="border-amber-700/40 bg-transparent text-amber-200 hover:bg-amber-900/30"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              <span className="ml-2">{muted ? "Вкл" : "Выкл"}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={resetAll}
              className="border-amber-700/40 bg-transparent text-amber-200 hover:bg-amber-900/30"
            >
              <RotateCcw className="mr-1 h-4 w-4" />
              Сбросить всё
            </Button>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-amber-200/70">
              <span>Общая громкость</span>
              <span>{volume}%</span>
            </div>
            <Slider
              value={[volume]}
              min={0}
              max={100}
              step={1}
              onValueChange={handleVolumeChange}
              className="[&_[role=slider]]:border-amber-400 [&_[role=slider]]:bg-amber-500 [&_.relative]:bg-amber-800 [&_[data-orientation=horizontal]>.bg-primary]:bg-amber-500"
            />
          </div>
        </div>

        {/* Per-event list */}
        <div className="space-y-3">
          {EVENT_ORDER.map((event) => {
            const custom = customMap[event];
            return (
              <div
                key={event}
                className="rounded-xl border border-amber-700/30 bg-[#241710]/60 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-amber-200">
                      {SOUND_EVENT_LABELS[event]}
                    </p>
                    <p className="text-xs text-amber-200/50">
                      {custom ? `Свой: ${custom.name}` : "Встроенный звук"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => preview(event)}
                      className="h-8 w-8 text-amber-200 hover:bg-amber-900/30"
                      title="Прослушать"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => triggerUpload(event)}
                      className="h-8 w-8 text-amber-200 hover:bg-amber-900/30"
                      title="Загрузить свой звук"
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                    {custom && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSound(event)}
                        className="h-8 w-8 text-rose-400 hover:bg-rose-900/20"
                        title="Удалить свой звук"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs leading-relaxed text-amber-200/40">
          Поддерживаются MP3, WAV, OGG, M4A, WEBM, FLAC. Для «Фонового кручения»
          лучше всего подходит короткий бесшовный loop — он будет повторяться до
          остановки барабана. Остальные звуки проигрываются один раз.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="hidden"
          onChange={handleFileSelect}
        />
      </DialogContent>
    </Dialog>
  );
}
