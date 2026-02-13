import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/Header";
import { CollectionDetailClient } from "./CollectionDetailClient";

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/collections");
  }
  const { id } = await params;
  const collection = await prisma.collection.findFirst({
    where: { id, userId: session.user.id },
    include: {
      collectionItems: {
        include: { card: true },
      },
    },
  });
  if (!collection) {
    redirect("/collections");
  }
  const cards = collection.collectionItems.map((i) => ({
    name: i.card.name,
    quantity: i.quantity,
  }));
  return (
    <div className="relative min-h-screen">
      <Header />
      <main className="relative z-10 mx-auto max-w-4xl px-4 py-8">
        <CollectionDetailClient
          collectionId={collection.id}
          collectionName={collection.name}
          rawInput={collection.rawInput}
          cards={cards}
          updatedAt={collection.updatedAt}
        />
      </main>
    </div>
  );
}
