"use client";

import { useEffect, useState } from "react";
import { startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { ArrowRight, AlertCircle, ShieldCheck, Sparkles, ScanFace } from "lucide-react";
import { LogoMark } from "./Logo";

interface LoginScreenProps {
  onLoginSuccess: (isDemo?: boolean) => void;
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);

  useEffect(() => {
    if (!browserSupportsWebAuthn()) return;
    fetch("/api/auth/passkey/login")
      .then((r) => r.json())
      .then((d) => setPasskeyAvailable(Boolean(d.available)))
      .catch(() => {});
  }, []);

  const handlePasskeyLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fresh challenge each attempt (the cookie expires after 5 minutes)
      const optRes = await fetch("/api/auth/passkey/login");
      const { available, options } = await optRes.json();
      if (!available) throw new Error("No passkey is set up yet. Sign in with your password.");
      const response = await startAuthentication({ optionsJSON: options });
      const res = await fetch("/api/auth/passkey/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response }),
      });
      const data = await res.json();
      if (res.ok && data.success) onLoginSuccess(false);
      else setError(data.error || "Passkey sign-in failed");
    } catch (err: any) {
      if (err?.name !== "NotAllowedError") setError(err?.message || "Passkey sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "demo", password: "demo123" }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onLoginSuccess(true);
      } else {
        setError(data.error || "Failed to enter demo mode");
      }
    } catch (err: any) {
      setError("Failed to connect to authentication server");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onLoginSuccess(Boolean(data.isDemo));
      } else {
        setError(data.error || "Incorrect username or password");
      }
    } catch (err: any) {
      setError("Failed to connect to authentication server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-bg flex items-center justify-center px-5 py-10 relative overflow-hidden">
      {/* Ambient aurora */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[720px] h-[720px] rounded-full bg-sys-blue/20 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-[-200px] right-[-120px] w-[520px] h-[520px] rounded-full bg-sys-indigo/20 blur-[140px]" />

      <div className="w-full max-w-[380px] relative z-10 view-enter">
        <div className="flex flex-col items-center text-center mb-9">
          <LogoMark size="lg" />
          <h1 className="mt-6 font-display text-[32px] leading-tight font-bold tracking-[-0.025em] text-white">
            Personal Finance
          </h1>
          <p className="mt-1.5 text-[15px] text-label-2">Sign in to unlock your vault.</p>
        </div>

        {error && (
          <div role="alert" className="mb-4 px-4 py-3 rounded-2xl bg-sys-red/12 text-sys-red text-[13px] font-medium flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="rounded-2xl bg-surface overflow-hidden shadow-card">
            <label className="sr-only" htmlFor="login-username">Username</label>
            <input
              id="login-username"
              type="text"
              required
              autoComplete="username"
              autoCapitalize="none"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-transparent text-white text-[17px] px-4 py-3.5 placeholder:text-label-3 !shadow-none"
            />
            <div className="h-px ml-4 bg-white/10" />
            <label className="sr-only" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent text-white text-[17px] px-4 py-3.5 placeholder:text-label-3 !shadow-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="mt-5 w-full h-[50px] rounded-[14px] bg-sys-blue hover:bg-sys-blue/90 text-[#fff] text-[17px] font-semibold flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100"
          >
            {loading ? (
              <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <>
                <span>Continue</span>
                <ArrowRight className="w-[18px] h-[18px]" />
              </>
            )}
          </button>
        </form>

        {passkeyAvailable && (
          <button
            type="button"
            onClick={handlePasskeyLogin}
            disabled={loading}
            className="mt-3 w-full h-[50px] rounded-[14px] bg-white text-bg text-[17px] font-semibold flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-40"
          >
            <ScanFace className="w-5 h-5" />
            <span>Sign in with Face ID</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleDemoLogin}
          disabled={loading}
          className="mt-3 w-full h-[50px] rounded-[14px] bg-white/[0.08] hover:bg-white/[0.12] text-sys-blue text-[17px] font-semibold flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-40"
        >
          <Sparkles className="w-[18px] h-[18px]" />
          <span>Try the Demo</span>
        </button>

        <p className="mt-10 flex items-center justify-center gap-1.5 text-[12px] text-label-3">
          <ShieldCheck className="w-3.5 h-3.5" />
          Encrypted with AES-256 · Your data stays private
        </p>
      </div>
    </div>
  );
}
