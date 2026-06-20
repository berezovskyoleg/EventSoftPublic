"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { KeyRound, Loader2, ShieldCheck, Wine, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMachineFingerprint } from "@/lib/fingerprint";

interface LicenseGateProps {
  onUnlocked: (key: string) => void;
  onOpenAdmin: () => void;
}

export function LicenseGate({ onUnlocked, onOpenAdmin }: LicenseGateProps) {
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
      const res = await fetch("/api/license/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, fingerprint }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Не удалось активировать ключ.");
        return;
      }
      localStorage.setItem("toastLicenseKey", data.key);
      setSuccess(
        data.activated
          ? "Ключ успешно активирован на этом устройстве!"
          : "Ключ подтверждён. Добро пожаловать!"
      );
      // brief delay so the user sees the success state
      setTimeout(() => onUnlocked(data.key), 700);
    } catch {
      setError("Ошибка соединения с сервером. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#1a0f0a] text-amber-50">
      {/* ambient glow */}
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-amber-600/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-rose-700/20 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          {/* Header */}
          <div className="mb-8 text-center">
            <motion.div
              initial={{ rotate: -8, scale: 0.8 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 12 }}
              className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-900/50"
            >
              <Wine className="h-10 w-10 text-[#1a0f0a]" />
            </motion.div>
            <h1 className="bg-gradient-to-b from-amber-200 to-amber-400 bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">
              Тост Слот
            </h1>
            <p className="mt-2 text-sm text-amber-200/70">
              Слот-машина для выбора того, кто произнесёт тост
            </p>
          </div>

          {/* Card */}
          <div className="rounded-2xl border border-amber-700/40 bg-[#241710]/80 p-6 shadow-2xl shadow-black/50 backdrop-blur">
            <div className="mb-5 flex items-center gap-2 text-amber-200">
              <Lock className="h-4 w-4" />
              <h2 className="text-sm font-semibold uppercase tracking-wider">
                Активация лицензии
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="license-key" className="text-amber-100">
                  Лицензионный ключ
                </Label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-500/70" />
                  <Input
                    id="license-key"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="TOAST-XXXX-XXXX-XXXX"
                    value={key}
                    onChange={(e) => setKey(e.target.value.toUpperCase())}
                    className="border-amber-700/50 bg-[#1a0f0a] pl-9 font-mono text-base tracking-wider text-amber-100 placeholder:text-amber-700/40 focus-visible:ring-amber-500"
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
                  className="flex items-center gap-2 rounded-lg border border-emerald-800/50 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300"
                >
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  {success}
                </motion.div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-b from-amber-400 to-amber-600 text-base font-bold text-[#1a0f0a] shadow-lg shadow-amber-900/40 hover:from-amber-300 hover:to-amber-500"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Проверка...
                  </>
                ) : (
                  "Активировать ключ"
                )}
              </Button>
            </form>

            <div className="mt-5 rounded-lg bg-amber-950/30 px-3 py-3 text-xs leading-relaxed text-amber-200/60">
              Один ключ привязывается к одному устройству при первой активации.
              Передать ключ на другой компьютер нельзя — он там не сработает.
            </div>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={onOpenAdmin}
              className="text-xs text-amber-700/60 underline-offset-2 transition hover:text-amber-500 hover:underline"
            >
              Панель администратора
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
