/**
 * Seed the Card table from a local bulk list for testing.
 * Run from app dir: npm run seed-from-file
 * Reads data/bulk.csv (or data/bulk-list.txt). CSV uses same format as app upload (e.g. Name,Quantity,Set code,...).
 */
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { parseTextList, parseCsv } from "../src/lib/mtg/parseCollection";
import { getCardInfoListBatched } from "../src/lib/mtg/cardDataService";
import { upsertCardFromScryfall } from "../src/lib/mtg/cardDb";

const DATA_DIR = path.join(process.cwd(), "data");
const BULK_CSV = path.join(DATA_DIR, "bulk.csv");
const BULK_TXT = path.join(DATA_DIR, "bulk-list.txt");

async function main() {
  let raw: string;
  let owned: { name: string; quantity: number }[];

  if (fs.existsSync(BULK_CSV)) {
    raw = fs.readFileSync(BULK_CSV, "utf-8");
    owned = parseCsv(raw);
  } else if (fs.existsSync(BULK_TXT)) {
    raw = fs.readFileSync(BULK_TXT, "utf-8");
    owned = parseTextList(raw);
  } else {
    console.error("Missing data/bulk.csv or data/bulk-list.txt. Add one for testing (users upload via the website).");
    process.exit(1);
  }

  const uniqueNames = [...new Set(owned.map((c) => c.name.trim()).filter(Boolean))];

  if (uniqueNames.length === 0) {
    console.error("No card names found in data/bulk-list.txt.");
    process.exit(1);
  }

  console.log("Fetching", uniqueNames.length, "cards from Scryfall…");
  const cardInfos = await getCardInfoListBatched(uniqueNames, (fetched, total) => {
    if (fetched % 50 === 0 || fetched === total) {
      console.log("  Fetched", fetched, "/", total);
    }
  });

  console.log("Upserting", cardInfos.size, "cards into Card table…");
  let n = 0;
  for (const [, info] of cardInfos) {
    await upsertCardFromScryfall(info);
    n++;
    if (n % 50 === 0) console.log("  Upserted", n);
  }

  console.log("Done. Card table now has", cardInfos.size, "cards from your list.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
