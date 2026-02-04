# Commander Deck Builder

Build a 100-card Commander deck from the bulk cards you own. Sign in with Google, add collections (paste list or CSV), pick a commander, optionally turn off legality for casual play, and save decks.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Database**

   SQLite is used by default. Ensure `.env` has:

   ```env
   DATABASE_URL="file:./dev.db"
   ```

   Then create the DB and generate the Prisma client:

   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```

3. **Scryfall card store (recommended for production)**

   The app can use a local copy of Scryfall’s oracle card data so builds don’t depend on live API calls. Run once (and optionally on a schedule):

   ```bash
   npm run seed-cards
   ```

   This downloads Scryfall’s bulk oracle cards (~170MB gzip) and upserts them into the `Card` table. After that, most card lookups are served from your DB. Any card not in the DB is still fetched from Scryfall on demand and stored for future use.

4. **Auth (Google OAuth)**

   **→ Full step-by-step guide: [docs/GOOGLE_AUTH_SETUP.md](docs/GOOGLE_AUTH_SETUP.md)**

   Short version: copy `.env.example` to `.env`, then in [Google Cloud Console](https://console.cloud.google.com/) create a project → OAuth consent screen → Credentials → OAuth client ID (Web application). Add redirect URI `http://localhost:3000/api/auth/callback/google`, then put the Client ID and Client Secret into `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Set `AUTH_SECRET` to a random string (e.g. `openssl rand -base64 32`).

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with Google, then use **Collections** to add your card list, **Build** to pick a collection and commander and generate a deck, and **My Decks** to view saved decks.

## How it works

- **Card store:** Card data is read from your DB (`Card` table). Populate it with `npm run seed-cards` (Scryfall bulk import). Missing cards are fetched from Scryfall and saved for next time.
- **Enrichment:** The first time you build a deck from a collection, the app “enriches” it: it resolves each card name to a row in `Card` (or fetches from Scryfall and inserts) and saves `CollectionItem` rows. Later builds from that collection use only the DB, so they’re fast.
- **Deck building:** The engine picks cards from your (enriched) collection by role and curve and obeys the legality toggle.

## Tech

- Next.js 16 (App Router), TypeScript, Tailwind
- NextAuth (Google), Prisma 7 + SQLite
- Local Scryfall-derived card store; optional bulk import; in-app parser for text/CSV; deckbuilder with role/curve heuristics and legality toggle.
