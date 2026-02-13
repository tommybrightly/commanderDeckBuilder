"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { signIn, getProviders } from "next-auth/react";
import type { ClientSafeProvider } from "next-auth/react";

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  github: "GitHub",
  discord: "Discord",
};

export function SignInForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const [providers, setProviders] = useState<Record<string, ClientSafeProvider> | null>(null);

  useEffect(() => {
    getProviders().then(setProviders);
  }, []);

  if (!providers) {
    return (
      <div className="mt-6 flex justify-center">
        <span className="text-sm text-[var(--muted)]">Loading…</span>
      </div>
    );
  }

  const list = Object.values(providers);
  if (list.length === 0) {
    return (
      <button
        type="button"
        className="btn-primary mt-6"
        onClick={() => signIn(undefined, { callbackUrl })}
      >
        Sign in
      </button>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      {list.map((p) => (
        <button
          key={p.id}
          type="button"
          className="btn-primary w-full"
          onClick={() => signIn(p.id, { callbackUrl })}
        >
          Sign in with {PROVIDER_LABELS[p.id] ?? p.name}
        </button>
      ))}
    </div>
  );
}
