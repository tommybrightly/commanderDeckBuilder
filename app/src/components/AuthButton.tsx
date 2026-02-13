"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { signIn, signOut, useSession, getProviders } from "next-auth/react";
import type { ClientSafeProvider } from "next-auth/react";

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  github: "GitHub",
  discord: "Discord",
};

export function AuthButton() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [providers, setProviders] = useState<Record<string, ClientSafeProvider> | null>(null);
  const [open, setOpen] = useState(false);
  const callbackUrl = pathname ?? "/";

  useEffect(() => {
    getProviders().then(setProviders);
  }, []);

  if (status === "loading") {
    return <span className="text-sm text-[var(--muted)]">Loading…</span>;
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-2">
        <span className="max-w-[120px] truncate text-sm text-[var(--muted)]" title={session.user.email ?? undefined}>
          {session.user.name ?? session.user.email}
        </span>
        <button
          type="button"
          onClick={() => signOut()}
          className="btn-secondary text-sm"
        >
          Sign out
        </button>
      </div>
    );
  }

  const list = providers ? Object.values(providers) : [];
  if (list.length === 0) {
    return (
      <button type="button" className="btn-primary text-sm" onClick={() => signIn()}>
        Sign in
      </button>
    );
  }
  if (list.length === 1) {
    return (
      <button
        type="button"
        className="btn-primary text-sm"
        onClick={() => signIn(list[0]!.id)}
      >
        Sign in with {PROVIDER_LABELS[list[0]!.id] ?? list[0]!.name}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="btn-primary text-sm"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        Sign in
      </button>
      {open && (
        <>
          <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-[var(--card-border)] bg-[var(--card)] py-1 shadow-lg">
            {list.map((p) => (
              <button
                key={p.id}
                type="button"
                className="block w-full px-4 py-2 text-left text-sm text-[var(--foreground)] hover:bg-white/5"
                onClick={() => {
                  setOpen(false);
                  signIn(p.id, { callbackUrl });
                }}
              >
                Sign in with {PROVIDER_LABELS[p.id] ?? p.name}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="fixed inset-0 z-40"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
        </>
      )}
    </div>
  );
}
