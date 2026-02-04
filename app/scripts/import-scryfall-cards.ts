/**
 * One-time (or periodic) import of Scryfall oracle cards into the local Card table.
 * Run from app dir: npx tsx scripts/import-scryfall-cards.ts
 * Requires: dotenv loaded (e.g. .env in app dir), DATABASE_URL set.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const url = process.env.DATABASE_URL ?? "file:./dev.db";
const adapter = new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

const BATCH = 500;

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

async function main() {
  console.log("Fetching Scryfall bulk data manifest...");
  const manifestRes = await fetch("https://api.scryfall.com/bulk-data/oracle-cards");
  if (!manifestRes.ok) throw new Error("Failed to fetch bulk manifest");
  const manifest = (await manifestRes.json()) as { download_uri: string };
  const downloadUrl = manifest.download_uri;
  console.log("Downloading oracle cards (gzip)...", downloadUrl);

  const dataRes = await fetch(downloadUrl);
  if (!dataRes.ok) throw new Error("Failed to download bulk file");
  const data = (await dataRes.json()) as ScryfallOracleCard[];
  console.log("Parsed", data.length, "cards. Upserting in batches of", BATCH);

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
    if (done % 2000 === 0 || done === data.length) {
      console.log("Upserted", done, "/", data.length);
    }
  }

  console.log("Done. Total cards in DB:", await prisma.card.count());
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
