import { Suspense } from "react";
import { Header } from "@/components/Header";
import { SignInForm } from "./SignInForm";

export default function SignInPage() {
  return (
    <div className="relative min-h-screen">
      <Header />
      <main className="relative z-10 mx-auto max-w-md px-4 pt-16">
        <div className="card p-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Sign in to save collections, build decks, and manage your account.
          </p>
          <Suspense fallback={<div className="mt-6 text-sm text-[var(--muted)]">Loading…</div>}>
            <SignInForm />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
