import { prisma } from "@/lib/prisma";

export type SyncProgress = (message: string, progress: number) => void;

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

/**
 * Download Scryfall oracle bulk data and upsert into the Card table.
 * Calls onProgress(message, 0..1) during the run.
 * Returns the final card count.
 */
export async function runCardDatabaseSync(onProgress?: SyncProgress): Promise<number> {
  onProgress?.("Fetching Scryfall bulk manifest…", 0);
  const manifestRes = await fetch("https://api.scryfall.com/bulk-data/oracle-cards");
  if (!manifestRes.ok) {
    throw new Error("Failed to fetch Scryfall bulk manifest");
  }
  const manifest = (await manifestRes.json()) as { download_uri: string };
  const downloadUrl = manifest.download_uri;

  onProgress?.("Downloading card list…", 0.05);
  const dataRes = await fetch(downloadUrl);
  if (!dataRes.ok) {
    throw new Error("Failed to download Scryfall bulk file");
  }
  const data = (await dataRes.json()) as ScryfallOracleCard[];
  const total = data.length;
  const BATCH = 500;

  onProgress?.(`Upserting ${total} cards…`, 0.1);
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
    onProgress?.(`Upserted ${done}/${total}`, progress);
  }

  const count = await prisma.card.count();
  onProgress?.(`Card database updated. ${count} cards.`, 1);
  return count;
}

let syncInProgress: Promise<void> | null = null;

/**
 * If the Card table is empty, run a full sync (or wait for an in-flight sync).
 * Call this before any operation that needs the card database (build deck, commander search).
 * Progress is reported only when this call starts the sync; concurrent callers just wait.
 */
export async function ensureCardDatabaseSynced(onProgress?: SyncProgress): Promise<void> {
  const count = await prisma.card.count();
  if (count > 0) return;

  if (syncInProgress) {
    await syncInProgress;
    return;
  }

  const run = async () => {
    try {
      await runCardDatabaseSync(onProgress);
    } finally {
      syncInProgress = null;
    }
  };
  syncInProgress = run();
  await syncInProgress;
}
