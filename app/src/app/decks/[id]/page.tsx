import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCardsByNamesFromDb } from "@/lib/mtg/cardDb";
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
  const raw = deck.data as {
    commander?: { name: string; imageUrl?: string };
    main?: Array<{ name: string; quantity: number; role?: string; typeLine?: string; cmc?: number; imageUrl?: string }>;
    lands?: Array<{ name: string; quantity: number; imageUrl?: string }>;
    stats?: { totalNonlands: number; totalLands: number; byRole?: Record<string, number>; shortBy?: number; colorIdentity?: string[]; strategyExplanation?: string };
    legalityEnforced?: boolean;
  };
  const main = raw?.main ?? [];
  const lands = raw?.lands ?? [];
  const needsMainEnrich = main.some((c) => !(c.typeLine ?? "").trim() || !c.imageUrl);
  const needsLandsEnrich = lands.some((c) => !c.imageUrl);
  const needsEnrich = needsMainEnrich || needsLandsEnrich;
  let data = raw;
  if (needsEnrich) {
    const allNames = [...new Set([...main.map((c) => c.name), ...lands.map((c) => c.name)])];
    const cardInfos = allNames.length > 0 ? await getCardsByNamesFromDb(allNames) : new Map();
    const mainEnriched = main.map((c) => {
      const info = cardInfos.get(c.name.toLowerCase());
      return {
        ...c,
        typeLine: c.typeLine ?? info?.typeLine,
        cmc: c.cmc ?? info?.cmc,
        imageUrl: c.imageUrl ?? info?.imageUrl,
      };
    });
    const landsEnriched = lands.map((c) => {
      const info = cardInfos.get(c.name.toLowerCase());
      return { ...c, imageUrl: c.imageUrl ?? info?.imageUrl };
    });
    data = { ...raw, main: mainEnriched, lands: landsEnriched };
  }
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <DeckView
          deckId={deck.id}
          commanderName={deck.commanderName}
          data={data}
          legalityEnforced={deck.legalityEnforced}
        />
      </main>
    </div>
  );
}
