"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  RotateCcw,
  Users,
  LogOut,
  Sparkles,
  Trophy,
  Wine,
  Volume2,
  VolumeX,
  Check,
  PartyPopper,
  X,
  Plus,
  UserX,
  UserPlus,
  Pencil,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { getSoundEngine } from "@/lib/sounds";
import { SoundSettings } from "./sound-settings";

interface SlotMachineProps {
  licenseKey: string;
  onLogout: () => void;
}

const ITEM_HEIGHT = 84; // px per reel item (incl. gap)
const VISIBLE_ROWS = 3;
const WINDOW_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS;
const REPEATS = 14; // how many times the name list is repeated in the strip
const SPIN_MIN_MS = 7000;
const SPIN_MAX_MS = 10000;

const REEL_COLORS = [
  "from-amber-500/15 to-amber-700/5",
  "from-rose-500/15 to-rose-700/5",
  "from-emerald-500/15 to-emerald-700/5",
  "from-orange-500/15 to-orange-700/5",
];

function parseNames(raw: string): string[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => l.replace(/\s+/g, " "));
}

function buildStrip(names: string[]): string[] {
  const strip: string[] = [];
  for (let r = 0; r < REPEATS; r++) {
    strip.push(...names);
  }
  return strip;
}

export function SlotMachine({ licenseKey, onLogout }: SlotMachineProps) {
  const defaultNames =
    "Анна Петрова\nИван Смирнов\nМария Иванова\nДмитрий Козлов\nЕлена Соколова\nАлексей Новиков\nОльга Морозова\nСергей Волков";
  const [rawNames, setRawNames] = useState(defaultNames);
  const [names, setNames] = useState<string[]>(() => parseNames(defaultNames));
  const [editing, setEditing] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const [showWinner, setShowWinner] = useState(false);

  // Names that have already given a toast in THIS session — they won't be
  // picked again until the user starts a new round.
  const [spoken, setSpoken] = useState<string[]>([]);
  const [allDone, setAllDone] = useState(false);

  // Manage-list drawer state
  const [manageOpen, setManageOpen] = useState(false);
  const [manageRaw, setManageRaw] = useState("");
  const [quickName, setQuickName] = useState("");

  const [muted, setMuted] = useState(false);

  const stripRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentWinnerIdxRef = useRef(0);
  const [spinDuration, setSpinDuration] = useState(8000);

  const sound = useMemo(() => getSoundEngine(), []);

  // Build the reel strip from the REMAINING (not yet spoken) names so that
  // already-toasted guests literally do not appear on the spinning reel.
  const remaining = useMemo(
    () => names.filter((n) => !spoken.includes(n)),
    [names, spoken]
  );
  const strip = useMemo(
    () => (remaining.length ? buildStrip(remaining) : []),
    [remaining]
  );

  // Sync mute state into the sound engine.
  useEffect(() => {
    sound.setMuted(muted);
  }, [muted, sound]);

  // Position the reel at the start (first repeat, winner centered) without transition.
  const resetReelTo = useCallback((winnerIdx: number) => {
    const el = stripRef.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.transform = `translateY(${ITEM_HEIGHT * (1 - winnerIdx)}px)`;
    // force reflow so the next transition applies cleanly
    void el.offsetHeight;
  }, []);

  useEffect(() => {
    // when names change & not spinning, reset reel to show first guest centered
    if (!spinning && remaining.length) {
      currentWinnerIdxRef.current = 0;
      resetReelTo(0);
    }
  }, [remaining, spinning, resetReelTo]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      sound.stopSpinLoop();
    };
  }, [sound]);

  function handleLoadNames() {
    const parsed = parseNames(rawNames);
    if (parsed.length < 2) {
      return;
    }
    setWinner(null);
    setShowWinner(false);
    setSpoken([]);
    setAllDone(false);
    setNames(parsed);
    currentWinnerIdxRef.current = 0;
    setEditing(false);
    sound.uiClick();
    // reset reel after render
    requestAnimationFrame(() => resetReelTo(0));
  }

  function spin() {
    if (spinning || remaining.length < 1) return;
    if (remaining.length === 0) return;
    const el = stripRef.current;
    if (!el) return;

    const k = remaining.length;

    // Last remaining guest — special case: just pick them directly (no real
    // "spin" needed), but still play the show for theatre.
    const winnerIdx =
      k === 1 ? 0 : Math.floor(Math.random() * k);
    const winnerName = remaining[winnerIdx];

    // 1. Reset (instant) to current winner centered in an early repeat so the
    //    center item visually stays the same, then spin forward.
    resetReelTo(currentWinnerIdxRef.current);

    // 2. Spin to the winner near the end of the strip.
    const finalIndex = (REPEATS - 2) * k + winnerIdx;
    const duration =
      k === 1
        ? SPIN_MIN_MS
        : SPIN_MIN_MS + Math.floor(Math.random() * (SPIN_MAX_MS - SPIN_MIN_MS));
    setSpinDuration(duration);

    setSpinning(true);
    setWinner(null);
    setShowWinner(false);

    // Sound: lever thunk + start the continuous spin loop.
    sound.clickSpin();
    sound.startSpinLoop(duration);

    // apply transition on next frame
    requestAnimationFrame(() => {
      if (!stripRef.current) return;
      stripRef.current.style.transition = `transform ${duration}ms cubic-bezier(0.08, 0.62, 0.12, 1)`;
      stripRef.current.style.transform = `translateY(${
        ITEM_HEIGHT * (1 - finalIndex)
      }px)`;
    });

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setSpinning(false);
      // Sound: reel locks in, then the win fanfare.
      sound.stopSpinLoop();
      sound.reelStop();
      // tiny beat between the clunk and the fanfare
      setTimeout(() => sound.winFanfare(), 220);

      setWinner(winnerName);
      setShowWinner(true);
      setSpoken((prev) =>
        prev.includes(winnerName) ? prev : [...prev, winnerName]
      );
      currentWinnerIdxRef.current = winnerIdx;

      // If that was the last remaining guest, mark the round complete.
      if (remaining.length <= 1) {
        setTimeout(() => setAllDone(true), 2600);
      }
    }, duration + 80);
  }

  function continueFromWinner() {
    sound.uiClick();
    setShowWinner(false);
    setWinner(null);
  }

  function startNewRound() {
    sound.uiClick();
    setSpoken([]);
    setAllDone(false);
    setShowWinner(false);
    setWinner(null);
    currentWinnerIdxRef.current = 0;
    requestAnimationFrame(() => resetReelTo(0));
  }

  // Open the list-management drawer. Pre-fill textarea with current active pool.
  function openManage() {
    if (spinning) return;
    sound.uiClick();
    setManageRaw(names.join("\n"));
    setQuickName("");
    setManageOpen(true);
  }

  function closeManage() {
    sound.uiClick();
    setManageOpen(false);
  }

  // Save the edited list. Keep spoken entries that are still present; drop ones
  // that were removed. New names become part of the remaining pool.
  function saveManage() {
    const parsed = parseNames(manageRaw);
    if (parsed.length < 1) {
      // keep at least one guest so the game doesn't break
      return;
    }
    const nextNames = parsed;
    const nextSpoken = spoken.filter((n) => nextNames.includes(n));
    setNames(nextNames);
    setSpoken(nextSpoken);
    setRawNames(nextNames.join("\n"));
    setManageOpen(false);
    setShowWinner(false);
    setWinner(null);
    setAllDone(false);
    currentWinnerIdxRef.current = 0;
    requestAnimationFrame(() => resetReelTo(0));
  }

  // Remove a name from the active pool entirely.
  function removeName(name: string) {
    const next = names.filter((n) => n !== name);
    if (next.length < 1) return; // prevent empty pool
    setNames(next);
    setSpoken((prev) => prev.filter((n) => n !== name));
    setRawNames(next.join("\n"));
    setManageRaw(next.join("\n"));
    if (winner === name) {
      setWinner(null);
      setShowWinner(false);
    }
    if (next.length === spoken.filter((n) => next.includes(n)).length) {
      setAllDone(true);
    }
  }

  // Return a spoken guest back to the remaining pool.
  function returnName(name: string) {
    setSpoken((prev) => prev.filter((n) => n !== name));
    setAllDone(false);
  }

  // Quick-add a new guest from the drawer input.
  function addQuickName() {
    const parsed = parseNames(quickName);
    if (!parsed.length) return;
    const next = [...names];
    let changed = false;
    for (const n of parsed) {
      if (!next.includes(n)) {
        next.push(n);
        changed = true;
      }
    }
    if (!changed) return;
    setNames(next);
    setRawNames(next.join("\n"));
    setManageRaw(next.join("\n"));
    setQuickName("");
    setAllDone(false);
  }

  function toggleMute() {
    const m = sound.toggleMuted();
    setMuted(m);
  }

  const remainingCount = remaining.length;
  const spokenCount = spoken.length;
  const totalCount = names.length;

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#1a0f0a] text-amber-50">
      {/* ambient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-amber-700/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-rose-800/15 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-emerald-800/10 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-6">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-900/40">
              <Wine className="h-6 w-6 text-[#1a0f0a]" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-amber-200 sm:text-2xl">
                ToastMachine
              </h1>
              <p className="text-[11px] text-amber-200/50">Кто следующим говорит тост?</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleMute}
              aria-label={muted ? "Включить звук" : "Выключить звук"}
              className="border-amber-700/40 bg-transparent text-amber-200 hover:bg-amber-900/30 hover:text-amber-100"
            >
              {muted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
              <span className="ml-1 hidden sm:inline">
                {muted ? "Звук выкл" : "Звук вкл"}
              </span>
            </Button>
            <SoundSettings />
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="text-amber-200/60 hover:bg-amber-900/30 hover:text-amber-100"
            >
              <LogOut className="h-4 w-4" />
              <span className="ml-1 hidden sm:inline">Выход</span>
            </Button>
          </div>
        </header>

        {/* Main */}
        <main className="flex flex-1 flex-col items-center gap-6">
          {/* Editing panel */}
          <AnimatePresence>
            {editing && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="w-full max-w-2xl"
              >
                <div className="rounded-2xl border border-amber-700/40 bg-[#241710]/80 p-5 backdrop-blur">
                  <div className="mb-3 flex items-center gap-2 text-amber-200">
                    <Users className="h-4 w-4" />
                    <Label className="text-sm font-semibold uppercase tracking-wider">
                      Список гостей
                    </Label>
                    <span className="ml-auto text-xs text-amber-200/50">
                      одно имя — одна строка
                    </span>
                  </div>
                  <Textarea
                    value={rawNames}
                    onChange={(e) => setRawNames(e.target.value)}
                    rows={8}
                    placeholder={"Иван Смирнов\nМария Петрова\n..."}
                    className="resize-none border-amber-700/40 bg-[#1a0f0a] font-mono text-sm text-amber-100 placeholder:text-amber-700/40 focus-visible:ring-amber-500"
                  />
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-xs text-amber-200/50">
                      Гостей в списке:{" "}
                      <span className="font-semibold text-amber-200">
                        {parseNames(rawNames).length}
                      </span>
                      {parseNames(rawNames).length < 2 && (
                        <span className="ml-2 text-rose-400">нужно минимум 2</span>
                      )}
                    </span>
                    <Button
                      onClick={handleLoadNames}
                      disabled={parseNames(rawNames).length < 2}
                      className="bg-gradient-to-b from-amber-400 to-amber-600 font-bold text-[#1a0f0a] hover:from-amber-300 hover:to-amber-500"
                    >
                      <Sparkles className="mr-1 h-4 w-4" />
                      Загрузить и играть
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Slot cabinet */}
          <div className="relative flex w-full max-w-3xl items-stretch gap-3">
            {/* Lever (one-armed bandit) */}
            <div className="hidden w-12 shrink-0 flex-col items-center justify-start pt-2 sm:flex">
              <div className="relative flex h-full flex-col items-center">
                <motion.div
                  animate={spinning ? { rotate: 35 } : { rotate: 0 }}
                  transition={{ type: "spring", stiffness: 120, damping: 10 }}
                  className="origin-top"
                >
                  <div className="mx-auto h-3 w-3 rounded-full bg-amber-500" />
                  <div className="mx-auto h-40 w-2 rounded-full bg-gradient-to-b from-amber-600 to-amber-800" />
                </motion.div>
                <motion.div
                  animate={spinning ? { y: 60 } : { y: 0 }}
                  transition={{ type: "spring", stiffness: 120, damping: 10 }}
                  className="absolute top-[168px] h-10 w-10 rounded-full bg-gradient-to-br from-rose-500 to-rose-700 shadow-lg shadow-rose-900/50 ring-2 ring-amber-300/40"
                />
              </div>
            </div>

            {/* Cabinet body */}
            <div className="relative flex-1 overflow-hidden rounded-3xl border-2 border-amber-600/50 bg-gradient-to-b from-[#2a1810] to-[#1a0f0a] p-4 shadow-2xl shadow-black/60 sm:p-6">
              {/* Marquee lights */}
              <div className="mb-4 flex items-center justify-center gap-1.5">
                {Array.from({ length: 15 }).map((_, i) => (
                  <motion.span
                    key={i}
                    animate={{
                      opacity: spinning ? [0.3, 1, 0.3] : 0.7,
                      scale: spinning ? [1, 1.3, 1] : 1,
                    }}
                    transition={{
                      duration: 0.6,
                      repeat: spinning ? Infinity : 0,
                      delay: i * 0.06,
                    }}
                    className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_6px_2px_rgba(251,191,36,0.6)]"
                  />
                ))}
              </div>

              {/* Title plate */}
              <div className="mb-4 text-center">
                <div className="inline-block rounded-full border border-amber-600/40 bg-amber-950/40 px-5 py-1">
                  <span className="bg-gradient-to-b from-amber-200 to-amber-500 bg-clip-text text-sm font-black uppercase tracking-[0.3em] text-transparent">
                    ToastMachine
                  </span>
                </div>
              </div>

              {/* Reel window */}
              <div
                className="relative mx-auto overflow-hidden rounded-xl border-2 border-amber-700/60 bg-[#0f0805] shadow-inner"
                style={{ height: WINDOW_HEIGHT }}
              >
                {/* top/bottom gradients */}
                <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-12 bg-gradient-to-b from-[#0f0805] to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-12 bg-gradient-to-t from-[#0f0805] to-transparent" />

                {/* center highlight line */}
                <div
                  className="pointer-events-none absolute inset-x-0 z-30 border-y-2 border-amber-400/70"
                  style={{
                    top: ITEM_HEIGHT,
                    height: ITEM_HEIGHT,
                    boxShadow:
                      "inset 0 0 24px rgba(251,191,36,0.25), 0 0 16px rgba(251,191,36,0.3)",
                  }}
                />

                {/* strip */}
                <div
                  ref={stripRef}
                  className="absolute inset-x-0 will-change-transform"
                  style={{ transform: `translateY(${ITEM_HEIGHT * 1}px)` }}
                >
                  {strip.map((name, i) => {
                    const colorIdx = i % REEL_COLORS.length;
                    return (
                      <div
                        key={`${name}-${i}`}
                        className={`flex items-center justify-center bg-gradient-to-r ${REEL_COLORS[colorIdx]} px-4`}
                        style={{ height: ITEM_HEIGHT }}
                      >
                        <span
                          className={`truncate text-center font-bold text-amber-100 ${
                            spinning ? "blur-[1px]" : ""
                          }`}
                          style={{ fontSize: "1.35rem" }}
                        >
                          {name}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {remaining.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-amber-700/40">
                    Загрузите список гостей
                  </div>
                )}
              </div>

              {/* Spin button */}
              <div className="mt-5 flex flex-col items-center gap-2">
                <motion.button
                  whileHover={{ scale: spinning ? 1 : 1.04 }}
                  whileTap={{ scale: spinning ? 1 : 0.96 }}
                  onClick={spin}
                  disabled={spinning || remaining.length < 1}
                  className="group relative h-20 w-20 overflow-hidden rounded-full bg-gradient-to-b from-rose-500 to-rose-700 shadow-xl shadow-rose-900/50 ring-4 ring-amber-400/40 transition disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent to-white/20" />
                  {spinning ? (
                    <RotateCcw className="relative mx-auto h-8 w-8 animate-spin text-white" />
                  ) : (
                    <Play className="relative mx-auto h-8 w-8 fill-white text-white" />
                  )}
                </motion.button>
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-200/70">
                  {spinning
                    ? "Крутится..."
                    : remaining.length === 1
                      ? "Последний тостующийся!"
                      : "Крутить барабан"}
                </span>
                {spinning && (
                  <div className="mt-1 h-1 w-48 overflow-hidden rounded-full bg-amber-950/60">
                    <motion.div
                      className="h-full bg-gradient-to-r from-amber-400 to-amber-600"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: spinDuration / 1000, ease: "easeInOut" }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Progress: who has spoken / who is left */}
          {!editing && names.length > 0 && (
            <div className="w-full max-w-3xl space-y-3">
              {/* progress bar */}
              <div className="mb-2 flex items-center justify-between text-xs text-amber-200/60">
                <span className="flex items-center gap-1.5">
                  <Trophy className="h-3.5 w-3.5 text-amber-400" />
                  Тостов прозвучало:{" "}
                  <span className="font-bold text-amber-200">
                    {spokenCount}
                  </span>{" "}
                  из{" "}
                  <span className="font-bold text-amber-200">{totalCount}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  Осталось:{" "}
                  <span className="font-bold text-amber-200">
                    {remainingCount}
                  </span>
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-amber-950/60">
                <motion.div
                  className="h-full bg-gradient-to-r from-amber-400 to-amber-600"
                  animate={{
                    width: `${totalCount ? (spokenCount / totalCount) * 100 : 0}%`,
                  }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>

              {/* spoken chips */}
              {spoken.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {spoken.map((n) => (
                    <span
                      key={n}
                      className="inline-flex items-center gap-1 rounded-full border border-amber-700/40 bg-amber-950/40 px-2.5 py-1 text-xs text-amber-200/80"
                    >
                      <Check className="h-3 w-3 text-emerald-400" />
                      {n}
                    </span>
                  ))}
                </div>
              )}

              {/* manage list button */}
              <Button
                variant="outline"
                size="sm"
                onClick={openManage}
                disabled={spinning}
                className="border-amber-700/40 bg-transparent text-amber-200 hover:bg-amber-900/30 hover:text-amber-100"
              >
                <Pencil className="mr-1 h-4 w-4" />
                Изменить список
              </Button>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="mt-6 pt-4 text-center text-[11px] text-amber-700/40">
          Лицензия: <span className="font-mono">{licenseKey}</span> · привязана к этому устройству
        </footer>
      </div>

      {/* Winner overlay */}
      <AnimatePresence>
        {showWinner && winner && !allDone && (
          <WinnerOverlay
            winner={winner}
            onContinue={continueFromWinner}
          />
        )}
      </AnimatePresence>

      {/* Round-complete overlay */}
      <AnimatePresence>
        {allDone && (
          <RoundCompleteOverlay
            spoken={spoken}
            onNewRound={startNewRound}
          />
        )}
      </AnimatePresence>

      {/* Manage-list drawer */}
      <AnimatePresence>
        {manageOpen && (
          <ManageDrawer
            raw={manageRaw}
            setRaw={setManageRaw}
            spoken={spoken}
            remaining={remaining}
            quickName={quickName}
            setQuickName={setQuickName}
            onClose={closeManage}
            onSave={saveManage}
            onRemove={removeName}
            onReturn={returnName}
            onAdd={addQuickName}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function WinnerOverlay({
  winner,
  onContinue,
}: {
  winner: string;
  onContinue: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
    >
      {/* ambient glow behind the card */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/20 blur-3xl" />
      <div className="pointer-events-none absolute left-1/4 top-1/3 h-64 w-64 rounded-full bg-rose-600/15 blur-3xl" />
      <div className="pointer-events-none absolute right-1/4 bottom-1/3 h-64 w-64 rounded-full bg-emerald-600/15 blur-3xl" />
      {/* confetti */}
      <Confetti />

      <motion.div
        initial={{ scale: 0.6, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 18, delay: 0.1 }}
        className="relative z-10 mx-4 w-full max-w-lg rounded-3xl border-2 border-amber-400/60 bg-gradient-to-b from-[#2a1810] to-[#1a0f0a] p-8 text-center shadow-2xl"
      >
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 12, delay: 0.25 }}
          className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-600 shadow-lg shadow-amber-900/60"
        >
          <Trophy className="h-11 w-11 text-[#1a0f0a]" />
        </motion.div>

        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-400/80">
          Следующий тост
        </p>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-2 bg-gradient-to-b from-amber-100 to-amber-400 bg-clip-text text-4xl font-black text-transparent sm:text-5xl"
        >
          {winner}
        </motion.h2>
        <p className="mt-3 text-base text-amber-200/70">
          Вам слово!
        </p>

        {/* Continue arrow */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={onContinue}
            className="group flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-b from-amber-400 to-amber-600 text-[#1a0f0a] shadow-lg shadow-amber-900/40 transition hover:from-amber-300 hover:to-amber-500 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            aria-label="Продолжить"
          >
            <ChevronRight className="h-7 w-7 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function RoundCompleteOverlay({
  spoken,
  onNewRound,
}: {
  spoken: string[];
  onNewRound: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
    >
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/20 blur-3xl" />
      <Confetti />

      <motion.div
        initial={{ scale: 0.7, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
        className="relative z-10 mx-4 w-full max-w-lg rounded-3xl border-2 border-amber-400/60 bg-gradient-to-b from-[#2a1810] to-[#1a0f0a] p-8 text-center shadow-2xl"
      >
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 12, delay: 0.1 }}
          className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-600 shadow-lg shadow-amber-900/60"
        >
          <PartyPopper className="h-11 w-11 text-[#1a0f0a]" />
        </motion.div>

        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-400/80">
          Все тосты прозвучали!
        </p>
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-2 bg-gradient-to-b from-amber-100 to-amber-400 bg-clip-text text-3xl font-black text-transparent sm:text-4xl"
        >
          Раунд завершён
        </motion.h2>
        <p className="mt-3 text-sm text-amber-200/70">
          Каждый гость из списка уже произнёс свой тост. Можно начать новый раунд
          — тогда список тостующихся сбросится.
        </p>

        {spoken.length > 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {spoken.map((n, i) => (
              <span
                key={n}
                className="inline-flex items-center gap-1 rounded-full border border-amber-700/40 bg-amber-950/40 px-2.5 py-1 text-xs text-amber-200/80"
              >
                <span className="text-amber-500/70">{i + 1}.</span>
                {n}
              </span>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            onClick={onNewRound}
            className="bg-gradient-to-b from-amber-400 to-amber-600 font-bold text-[#1a0f0a] hover:from-amber-300 hover:to-amber-500"
          >
            <RotateCcw className="mr-1 h-4 w-4" />
            Новый раунд
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ManageDrawer({
  raw,
  setRaw,
  spoken,
  remaining,
  quickName,
  setQuickName,
  onClose,
  onSave,
  onRemove,
  onReturn,
  onAdd,
}: {
  raw: string;
  setRaw: (v: string) => void;
  spoken: string[];
  remaining: string[];
  quickName: string;
  setQuickName: (v: string) => void;
  onClose: () => void;
  onSave: () => void;
  onRemove: (name: string) => void;
  onReturn: (name: string) => void;
  onAdd: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-amber-700/40 bg-gradient-to-b from-[#2a1810] to-[#1a0f0a] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-amber-200">Управление списком</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-amber-200/60 hover:bg-amber-900/30 hover:text-amber-100"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="space-y-5">
          {/* quick add */}
          <div className="rounded-xl border border-amber-700/40 bg-[#241710]/60 p-4">
            <Label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-amber-200/70">
              Быстро добавить гостя
            </Label>
            <div className="flex gap-2">
              <input
                type="text"
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onAdd();
                }}
                placeholder="Имя Фамилия"
                className="flex-1 rounded-lg border border-amber-700/40 bg-[#1a0f0a] px-3 py-2 text-sm text-amber-100 placeholder:text-amber-700/40 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <Button
                onClick={onAdd}
                className="bg-amber-500 text-[#1a0f0a] hover:bg-amber-400"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* textarea editor */}
          <div className="rounded-xl border border-amber-700/40 bg-[#241710]/60 p-4">
            <Label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-amber-200/70">
              Редактировать список
            </Label>
            <Textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={6}
              placeholder="Иван Смирнов\nМария Петрова\n..."
              className="resize-none border-amber-700/40 bg-[#1a0f0a] font-mono text-sm text-amber-100 placeholder:text-amber-700/40 focus-visible:ring-amber-500"
            />
            <p className="mt-2 text-xs text-amber-200/50">
              Удалите имя, чтобы убрать гостя из текущего раунда. Добавьте новое — оно появится в розыгрыше.
            </p>
          </div>

          {/* remaining */}
          {remaining.length > 0 && (
            <div className="rounded-xl border border-amber-700/40 bg-[#241710]/60 p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-200/70">
                Ещё не говорили ({remaining.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {remaining.map((n) => (
                  <span
                    key={n}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-600/40 bg-amber-950/60 px-2.5 py-1 text-sm text-amber-100"
                  >
                    {n}
                    <button
                      onClick={() => onRemove(n)}
                      title="Убрать из списка"
                      className="ml-1 rounded-full p-0.5 text-amber-200/60 hover:bg-rose-500/20 hover:text-rose-400"
                    >
                      <UserX className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* spoken */}
          {spoken.length > 0 && (
            <div className="rounded-xl border border-emerald-700/30 bg-emerald-950/20 p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-200/70">
                Уже произнесли тост ({spoken.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {spoken.map((n) => (
                  <span
                    key={n}
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-700/40 bg-emerald-950/40 px-2.5 py-1 text-sm text-emerald-100"
                  >
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    {n}
                    <button
                      onClick={() => onReturn(n)}
                      title="Вернуть в розыгрыш"
                      className="ml-1 rounded-full p-0.5 text-emerald-200/60 hover:bg-emerald-500/20 hover:text-emerald-300"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 border-amber-700/40 bg-transparent text-amber-200 hover:bg-amber-900/30 hover:text-amber-100"
          >
            Отмена
          </Button>
          <Button
            onClick={onSave}
            className="flex-1 bg-gradient-to-b from-amber-400 to-amber-600 font-bold text-[#1a0f0a] hover:from-amber-300 hover:to-amber-500"
          >
            Сохранить
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 50 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 2.5,
        duration: 2.4 + Math.random() * 2,
        size: 6 + Math.random() * 8,
        rotate: Math.random() * 360,
        color: [
          "#fbbf24",
          "#f59e0b",
          "#ef4444",
          "#10b981",
          "#f97316",
          "#fde68a",
        ][i % 6],
        drift: (Math.random() - 0.5) * 100,
        shape: i % 3,
      })),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          initial={{ y: -30, x: `${p.x}%`, opacity: 0, rotate: p.rotate }}
          animate={{
            y: "110vh",
            x: `calc(${p.x}% + ${p.drift}px)`,
            rotate: p.rotate + 720,
            opacity: [0, 1, 1, 0.7],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            repeatDelay: Math.random() * 1.5,
            ease: "easeIn",
          }}
          style={{
            position: "absolute",
            width: p.size,
            height: p.shape === 1 ? p.size : p.size * 0.6,
            backgroundColor: p.color,
            borderRadius: p.shape === 2 ? "50%" : 2,
          }}
        />
      ))}
    </div>
  );
}
