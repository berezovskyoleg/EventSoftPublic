"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, ShieldAlert, Copy, Check, Ban, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface KeyInfo {
  index: number;
  key: string;
  status: "available" | "activated" | "revoked";
  activatedAt: string | null;
  lastVerifiedAt: string | null;
}

interface AdminListResponse {
  ok: boolean;
  total: number;
  available: number;
  activated: number;
  revoked: number;
  keys: KeyInfo[];
}

interface AdminPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AdminPanel({ open, onOpenChange }: AdminPanelProps) {
  const [secret, setSecret] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdminListResponse | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function load(secretVal: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/license/admin/list", {
        headers: { "x-admin-secret": secretVal },
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "Ошибка доступа.");
        setData(null);
        setAuthed(false);
        return;
      }
      setData(json);
      setAuthed(true);
    } catch {
      setError("Ошибка соединения.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    await load(secret);
  }

  async function handleRevoke(key: string, revoke: boolean) {
    setBusyKey(key);
    try {
      await fetch("/api/license/admin/revoke", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({ key, revoke }),
      });
      await load(secret);
    } finally {
      setBusyKey(null);
    }
  }

  function copyKey(k: string) {
    navigator.clipboard?.writeText(k);
    setCopiedKey(k);
    setTimeout(() => setCopiedKey(null), 1200);
  }

  useEffect(() => {
    if (!open) {
      // keep authed state but clear transient UI when closing
      setError(null);
    }
  }, [open]);

  const statusBadge = (status: KeyInfo["status"]) => {
    if (status === "available")
      return <Badge className="bg-emerald-600/20 text-emerald-300 border-emerald-700/40">Свободен</Badge>;
    if (status === "activated")
      return <Badge className="bg-amber-600/20 text-amber-300 border-amber-700/40">Активирован</Badge>;
    return <Badge className="bg-rose-600/20 text-rose-300 border-rose-700/40">Отозван</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-[#241710] border-amber-700/40 text-amber-50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-200">
            <ShieldAlert className="h-5 w-5" />
            Панель администратора
          </DialogTitle>
          <DialogDescription className="text-amber-200/60">
            Просмотр и управление лицензионными ключами.
          </DialogDescription>
        </DialogHeader>

        {!authed ? (
          <form onSubmit={handleAuth} className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="admin-secret" className="text-amber-100">
                Секретный код администратора
              </Label>
              <Input
                id="admin-secret"
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="••••••••"
                className="bg-[#1a0f0a] border-amber-700/50 text-amber-100"
                disabled={loading}
              />
            </div>
            {error && (
              <p className="text-sm text-rose-400">{error}</p>
            )}
            <Button
              type="submit"
              disabled={loading || !secret}
              className="bg-amber-500 text-[#1a0f0a] hover:bg-amber-400"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Войти"}
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            {data && (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-emerald-950/40 border border-emerald-800/40 p-2">
                    <div className="text-xl font-bold text-emerald-300">{data.available}</div>
                    <div className="text-[10px] uppercase tracking-wide text-emerald-200/60">Свободны</div>
                  </div>
                  <div className="rounded-lg bg-amber-950/40 border border-amber-800/40 p-2">
                    <div className="text-xl font-bold text-amber-300">{data.activated}</div>
                    <div className="text-[10px] uppercase tracking-wide text-amber-200/60">Активир.</div>
                  </div>
                  <div className="rounded-lg bg-rose-950/40 border border-rose-800/40 p-2">
                    <div className="text-xl font-bold text-rose-300">{data.revoked}</div>
                    <div className="text-[10px] uppercase tracking-wide text-rose-200/60">Отозваны</div>
                  </div>
                </div>

                <ScrollArea className="h-[320px] rounded-lg border border-amber-900/40 bg-[#1a0f0a]/60">
                  <div className="divide-y divide-amber-900/30">
                    {data.keys.map((k) => (
                      <div
                        key={k.key}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-amber-900/10"
                      >
                        <span className="w-8 shrink-0 text-right text-xs text-amber-700/70">
                          {k.index}
                        </span>
                        <code className="flex-1 font-mono text-sm text-amber-100">
                          {k.key}
                        </code>
                        {statusBadge(k.status)}
                        <button
                          onClick={() => copyKey(k.key)}
                          className="rounded p-1 text-amber-400/70 hover:bg-amber-900/30 hover:text-amber-300"
                          title="Копировать"
                        >
                          {copiedKey === k.key ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                        {k.status !== "revoked" ? (
                          <button
                            onClick={() => handleRevoke(k.key, true)}
                            disabled={busyKey === k.key}
                            className="rounded p-1 text-rose-400/70 hover:bg-rose-900/30 hover:text-rose-300 disabled:opacity-40"
                            title="Отозвать"
                          >
                            {busyKey === k.key ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Ban className="h-3.5 w-3.5" />
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRevoke(k.key, false)}
                            disabled={busyKey === k.key}
                            className="rounded p-1 text-emerald-400/70 hover:bg-emerald-900/30 hover:text-emerald-300 disabled:opacity-40"
                            title="Восстановить"
                          >
                            {busyKey === k.key ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
            {error && <p className="text-sm text-rose-400">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-amber-200/70 hover:text-amber-100"
          >
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
