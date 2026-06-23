"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { LicenseGate } from "@/components/musicbingo/license-gate";
import { MusicBingoHost } from "@/components/musicbingo/host";
import { getMachineFingerprint } from "@/lib/fingerprint";
import { licenseLogout, licenseVerify } from "@/lib/api";

type Status = "loading" | "unlocked" | "locked";

export default function Home() {
  const [status, setStatus] = useState<Status>("loading");
  const [licenseKey, setLicenseKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const fp = await getMachineFingerprint();
        const data = await licenseVerify(fp);
        if (!cancelled && data.ok) {
          setLicenseKey(data.key);
          setStatus("unlocked");
        } else {
          setStatus("locked");
        }
      } catch {
        if (!cancelled) {
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

  async function handleLogout() {
    try {
      await licenseLogout();
    } catch {
      // ignore cleanup errors
    }
    localStorage.removeItem("musicbingoLicenseKey");
    setLicenseKey(null);
    setStatus("locked");
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f13] text-indigo-200">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          <p className="text-sm text-indigo-200/60">Проверка лицензии...</p>
        </div>
      </div>
    );
  }

  if (status === "locked" || !licenseKey) {
    return <LicenseGate onUnlocked={handleUnlocked} />;
  }

  return <MusicBingoHost licenseKey={licenseKey} onLogout={handleLogout} />;
}
