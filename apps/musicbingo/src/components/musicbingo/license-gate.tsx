"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { KeyRound, Loader2, Lock } from "lucide-react";
import { MusicBingoLogo } from "./logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMachineFingerprint } from "@/lib/fingerprint";
import { licenseActivate } from "@/lib/api";

interface LicenseGateProps {
  onUnlocked: (key: string) => void;
}

export function LicenseGate({ onUnlocked }: LicenseGateProps) {
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!key.trim()) {
      setError("Введите лицензионный ключ.");
      return;
    }
    setLoading(true);
    try {
      const fingerprint = await getMachineFingerprint();
      const data = await licenseActivate(key.trim(), fingerprint);
      localStorage.setItem("musicbingoLicenseKey", data.key);
      setSuccess(
        data.activated
          ? "Ключ успешно активирован на этом устройстве!"
          : "Ключ подтверждён. Добро пожаловать!"
      );
      setTimeout(() => onUnlocked(data.key), 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось активировать ключ.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0f0f13] text-indigo-50">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-pink-700/20 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          <div className="mb-8 text-center">
            <motion.div
              initial={{ rotate: -8, scale: 0.8 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 12 }}
              className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 to-pink-500 shadow-lg shadow-indigo-900/50"
            >
              <MusicBingoLogo className="h-10 w-10" />
            </motion.div>
            <h1 className="bg-gradient-to-b from-indigo-200 to-pink-300 bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">
              MusicBingo
            </h1>
            <p className="mt-2 text-sm text-indigo-200/70">
              Музыкальное бинго для вечеринок и мероприятий
            </p>
          </div>

          <div className="rounded-2xl border border-indigo-700/40 bg-[#1a1a24]/80 p-6 shadow-2xl shadow-black/50 backdrop-blur">
            <div className="mb-5 flex items-center gap-2 text-indigo-200">
              <Lock className="h-4 w-4" />
              <h2 className="text-sm font-semibold uppercase tracking-wider">
                Активация лицензии
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="license-key" className="text-indigo-100">
                  Лицензионный ключ
                </Label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-500/70" />
                  <Input
                    id="license-key"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="MUSIC-XXXX-XXXX-XXXX"
                    value={key}
                    onChange={(e) => setKey(e.target.value.toUpperCase())}
                    className="border-indigo-700/50 bg-[#0f0f13] pl-9 font-mono text-base tracking-wider text-indigo-100 placeholder:text-indigo-700/40 focus-visible:ring-indigo-500"
                    disabled={loading}
                  />
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="rounded-lg border border-rose-800/50 bg-rose-950/40 px-3 py-2 text-sm text-rose-300"
                >
                  {error}
                </motion.div>
              )}

              {success && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="rounded-lg border border-emerald-800/50 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300"
                >
                  {success}
                </motion.div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-500 to-pink-500 font-semibold text-white hover:from-indigo-400 hover:to-pink-400"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="mr-2 h-4 w-4" />
                )}
                {loading ? "Активация..." : "Активировать"}
              </Button>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
