# Bulk list for testing the card database

Put a card list here to seed the **Card** table for local testing (no full Scryfall download). In production, users upload their list via the website.

## Files (script uses first that exists)

- **`bulk.csv`** – CSV with a header row. Same format as app upload, e.g.:
  - `Name,Set code,Set name,Collector number,...,Quantity,...`
  - Or `Count,Name,Set,CollectorNumber` (column names case-insensitive).
- **`bulk-list.txt`** – Plain text, one card per line (same as paste in app):
  - `3 Lightning Bolt`
  - `1 Sol Ring (C14)`
  - `Sol Ring` (no number = 1 copy)

## Command

From the **app** folder:

```bash
npm run seed-from-file
```

Reads `data/bulk.csv` (or `data/bulk-list.txt`), fetches each card from Scryfall in batches, and upserts into the **Card** table. After that, building decks from collections that use these names will resolve.

You can still run `npm run seed-cards` to import the full Scryfall oracle set (~170MB).
