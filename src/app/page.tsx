"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { LicenseGate } from "@/components/toast-slot/license-gate";
import { SlotMachine } from "@/components/toast-slot/slot-machine";
import { AdminPanel } from "@/components/toast-slot/admin-panel";
import { getMachineFingerprint } from "@/lib/fingerprint";

type Status = "loading" | "unlocked" | "locked";

export default function Home() {
  const [status, setStatus] = useState<Status>("loading");
  const [licenseKey, setLicenseKey] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const stored = localStorage.getItem("toastLicenseKey");
      if (!stored) {
        setStatus("locked");
        return;
      }
      try {
        const fp = await getMachineFingerprint();
        const res = await fetch("/api/license/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: stored, fingerprint: fp }),
        });
        const data = await res.json();
        if (!cancelled && res.ok && data.ok) {
          setLicenseKey(data.key);
          setStatus("unlocked");
        } else {
          // key invalid on this machine — clear it
          localStorage.removeItem("toastLicenseKey");
          setStatus("locked");
        }
      } catch {
        if (!cancelled) {
          // network issue — still allow local use if we had a key? No, require verify.
          setStatus("locked");
        }
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleUnlocked(key: string) {
    setLicenseKey(key);
    setStatus("unlocked");
  }

  function handleLogout() {
    localStorage.removeItem("toastLicenseKey");
    setLicenseKey(null);
    setStatus("locked");
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1a0f0a] text-amber-200">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
          <p className="text-sm text-amber-200/60">Проверка лицензии...</p>
        </div>
      </div>
    );
  }

  if (status === "locked" || !licenseKey) {
    return (
      <>
        <LicenseGate
          onUnlocked={handleUnlocked}
          onOpenAdmin={() => setAdminOpen(true)}
        />
        <AdminPanel open={adminOpen} onOpenChange={setAdminOpen} />
      </>
    );
  }

  return <SlotMachine licenseKey={licenseKey} onLogout={handleLogout} />;
}
