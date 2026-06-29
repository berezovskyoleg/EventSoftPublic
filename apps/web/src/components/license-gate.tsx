import * as React from "react";
import { activateKey, verifyKey, clearKey } from "../lib/license";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Loader2, KeyRound } from "lucide-react";

interface LicenseGateProps {
  app: "musicbingo" | "toastmachine";
  title: string;
  logo: React.ReactNode;
  children: React.ReactNode;
}

export function LicenseGate({ app, title, logo, children }: LicenseGateProps) {
  const [key, setKey] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [authorized, setAuthorized] = React.useState(false);

  React.useEffect(() => {
    const stored = localStorage.getItem(`eventsoft_license_${app}`);
    if (stored) {
      setKey(stored);
      verifyKey(app)
        .then(() => setAuthorized(true))
        .catch(() => clearKey(app))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [app]);

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await activateKey(key.trim().toUpperCase(), app);
      setAuthorized(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка активации");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-indigo-700/30 bg-[#1a1a24] p-6 shadow-2xl">
          <div className="mb-4 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-pink-500">
              {logo}
            </div>
          </div>
          <h1 className="text-center text-xl font-bold">{title}</h1>
          <p className="mb-4 text-center text-sm text-indigo-200/60">
            Введите лицензионный ключ
          </p>
          <form onSubmit={handleActivate} className="space-y-3">
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="MUSIC-XXXX-..."
              className="uppercase"
            />
            {error && (
              <p className="text-sm text-rose-400">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="mr-2 h-4 w-4" />
              )}
              Активировать
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
