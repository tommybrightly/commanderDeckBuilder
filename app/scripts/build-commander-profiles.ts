/**
 * Pre-build CommanderPlan for all commanders in the card DB (~2,500).
 * Run after syncing the card database: npx tsx scripts/build-commander-profiles.ts
 * Uses in-memory analysis only (no AI). Results are cached in CommanderProfile for fast deck builds.
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { dbCardToCardInfo } from "../src/lib/mtg/cardDb";
import { getCommanderPlan } from "../src/lib/mtg/commanderPlan";
import { setCachedPlan } from "../src/lib/mtg/commanderProfileCache";
import type { CardInfo } from "../src/lib/mtg/types";

type CardRow = {
  oracleId: string;
  name: string;
  manaCost: string | null;
  cmc: number;
  colors: string;
  colorIdentity: string;
  typeLine: string;
  oracleText: string | null;
  legalities: string | null;
  imageUrl: string | null;
};

async function main() {
  const rows = await prisma.$queryRaw<CardRow[]>`
    SELECT "oracleId", "name", "manaCost", "cmc", "colors", "colorIdentity", "typeLine", "oracleText", "legalities", "imageUrl"
    FROM "Card"
    WHERE "typeLine" LIKE '%Legendary%'
      AND ("typeLine" LIKE '%Creature%' OR "typeLine" LIKE '%Planeswalker%')
  `;

  console.log(`Found ${rows.length} commanders. Building profiles…`);

  let done = 0;
  let errors = 0;
  for (const row of rows) {
    try {
      const card: Parameters<typeof dbCardToCardInfo>[0] = {
        ...row,
        id: row.oracleId,
      };
      const info = dbCardToCardInfo(card) as CardInfo;
      const plan = getCommanderPlan(info);
      await setCachedPlan(info.id, plan);
      done++;
      if (done % 100 === 0) console.log(`  ${done}/${rows.length}`);
    } catch (e) {
      errors++;
      if (errors <= 5) console.warn(`  Skip ${row.name}:`, e instanceof Error ? e.message : e);
    }
  }

  console.log(`Done. Cached ${done} commander profiles.${errors > 0 ? ` (${errors} errors)` : ""}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
