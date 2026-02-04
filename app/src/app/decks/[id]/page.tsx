import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/Header";
import { DeckView } from "./DeckView";

export default async function DeckDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    notFound();
  }
  const { id } = await params;
  const deck = await prisma.deck.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!deck) {
    notFound();
  }
  const data = deck.data as {
    commander?: { name: string; imageUrl?: string };
    main?: Array<{ name: string; quantity: number; role?: string }>;
    lands?: Array<{ name: string; quantity: number }>;
    stats?: { totalNonlands: number; totalLands: number; byRole?: Record<string, number> };
    legalityEnforced?: boolean;
  };
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <DeckView
          commanderName={deck.commanderName}
          data={data}
          legalityEnforced={deck.legalityEnforced}
        />
      </main>
    </div>
  );
}
