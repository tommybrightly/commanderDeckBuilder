"use client";

import { signIn } from "next-auth/react";

interface SignInPromptProps {
  title: string;
  description?: string;
}

export function SignInPrompt({ title, description }: SignInPromptProps) {
  return (
    <div className="card mx-auto mt-8 max-w-md p-8 text-center">
      <h2 className="text-xl font-semibold text-[var(--foreground)]">{title}</h2>
      {description && (
        <p className="mt-2 text-sm text-[var(--muted)]">{description}</p>
      )}
      <button
        type="button"
        onClick={() => signIn()}
        className="btn-primary mt-6"
      >
        Sign in
      </button>
    </div>
  );
}
