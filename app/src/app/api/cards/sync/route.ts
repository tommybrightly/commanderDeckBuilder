import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300;

type ScryfallOracleCard = {
  id: string;
  name: string;
  mana_cost?: string;
  cmc: number;
  colors: string[];
  color_identity: string[];
  type_line: string;
  oracle_text?: string;
  legalities?: Record<string, string>;
  image_uris?: { normal?: string };
  card_faces?: Array<{ image_uris?: { normal?: string } }>;
};

function toCardRow(c: ScryfallOracleCard) {
  const imageUrl =
    c.image_uris?.normal ?? c.card_faces?.[0]?.image_uris?.normal ?? null;
  return {
    oracleId: c.id,
    name: c.name,
    manaCost: c.mana_cost ?? null,
    cmc: typeof c.cmc === "number" ? Math.round(c.cmc) : 0,
    colors: JSON.stringify(c.colors ?? []),
    colorIdentity: JSON.stringify(c.color_identity ?? []),
    typeLine: c.type_line ?? "",
    oracleText: c.oracle_text ?? null,
    legalities: c.legalities ? JSON.stringify(c.legalities) : null,
    imageUrl,
  };
}

export async function POST() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };
      try {
        send({ type: "progress", message: "Fetching Scryfall bulk manifest…", progress: 0 });
        const manifestRes = await fetch("https://api.scryfall.com/bulk-data/oracle-cards");
        if (!manifestRes.ok) {
          send({ type: "error", error: "Failed to fetch Scryfall bulk manifest" });
          controller.close();
          return;
        }
        const manifest = (await manifestRes.json()) as { download_uri: string };
        const downloadUrl = manifest.download_uri;

        send({ type: "progress", message: "Downloading card list…", progress: 0.05 });
        const dataRes = await fetch(downloadUrl);
        if (!dataRes.ok) {
          send({ type: "error", error: "Failed to download Scryfall bulk file" });
          controller.close();
          return;
        }
        const data = (await dataRes.json()) as ScryfallOracleCard[];
        const total = data.length;
        const BATCH = 500;

        send({ type: "progress", message: `Upserting ${total} cards…`, progress: 0.1, total });
        let done = 0;
        for (let i = 0; i < data.length; i += BATCH) {
          const chunk = data.slice(i, i + BATCH);
          await prisma.$transaction(
            chunk.map((c) =>
              prisma.card.upsert({
                where: { oracleId: c.id },
                create: toCardRow(c),
                update: toCardRow(c),
              })
            )
          );
          done += chunk.length;
          const progress = 0.1 + (0.9 * done) / total;
          send({ type: "progress", message: `Upserted ${done}/${total}`, progress, done, total });
        }

        const count = await prisma.card.count();
        send({ type: "done", count, message: `Card database updated. ${count} cards.` });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Sync failed";
        send({ type: "error", error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}
