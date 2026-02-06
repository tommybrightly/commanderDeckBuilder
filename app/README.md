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

3. **Card database (required before building decks)**

   All card data is stored in your DB. **No Scryfall calls** happen during deck building or commander search. After running the app, go to **Settings** and click **Sync card database**. That downloads Scryfall’s bulk oracle cards once into the `Card` table. Run it again periodically to stay updated. Until you sync, commander search and deck building will fail with a clear message to sync first.

4. **Auth (Google OAuth)**

   **→ Full step-by-step guide: [docs/GOOGLE_AUTH_SETUP.md](docs/GOOGLE_AUTH_SETUP.md)**

   Short version: copy `.env.example` to `.env`, then in [Google Cloud Console](https://console.cloud.google.com/) create a project → OAuth consent screen → Credentials → OAuth client ID (Web application). Add redirect URI `http://localhost:3000/api/auth/callback/google`, then put the Client ID and Client Secret into `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Set `AUTH_SECRET` to a random string (e.g. `openssl rand -base64 32`).

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with Google, go to **Settings** and **Sync card database** once, then use **Collections** to add your card list, **Build** to pick a collection and commander and generate a deck, and **My Decks** to view saved decks.

## How it works

- **Card store:** All card data lives in your DB (`Card` table). Sync from **Settings** (one-time or periodic). Deck building and commander search use only this local data—no Scryfall calls during normal use.
- **Enrichment:** The first time you build from a collection, the app resolves each card name to a row in `Card` and saves `CollectionItem` rows. If any name isn’t in the DB, you’ll be told to sync first.
- **Deck building:** The engine picks cards from your (enriched) collection by role and curve and obeys the legality toggle.

## Putting it on the internet

**Step-by-step: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** — Railway (SQLite) or Vercel + Neon (Postgres).

- **Vercel:** Works for the app, but serverless timeouts (e.g. 60s) may cut off the first **Sync card database** run (it can take 2–5 minutes). Options: (1) Run sync once locally, then copy `prisma/dev.db` into your project and deploy (not ideal for Vercel’s read-only filesystem), or (2) Use a plan with longer function timeout and run sync from the deployed app.
- **Railway / Render / Fly.io:** Good fit. Persistent disk for SQLite, longer request timeouts. Run **Sync card database** from Settings after deploy. Optionally re-run periodically (e.g. monthly) or add a cron that calls `POST /api/cards/sync`.
## Testing

Run deck builder tests: `npm run test`. See **[docs/TESTING_AND_RULES.md](docs/TESTING_AND_RULES.md)** for what’s covered (deck size, color identity, legality, no duplicates) and how to verify that builds follow Commander rules. The doc also explains how “most powerful” is defined (role + curve heuristics, not win-rate optimization).

## Tech

- Next.js 16 (App Router), TypeScript, Tailwind
- NextAuth (Google), Prisma 7 + SQLite
- Local card store (synced from Scryfall in-app); text/CSV parser; deckbuilder with role/curve heuristics and legality toggle.
