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

3. **Auth (Google OAuth)**

   - Copy `.env.example` to `.env` if you haven’t already.
   - Create a project in [Google Cloud Console](https://console.cloud.google.com/) and enable the Google+ API (or Google Identity).
   - Create OAuth 2.0 credentials (Web application), set authorized redirect URI to `http://localhost:3000/api/auth/callback/google`.
   - In `.env` set:

   ```env
   AUTH_SECRET=<run: openssl rand -base64 32>
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with Google, then use **Collections** to add your card list, **Build** to pick a collection and commander and generate a deck, and **My Decks** to view saved decks.

## Tech

- Next.js 16 (App Router), TypeScript, Tailwind
- NextAuth (Google), Prisma 7 + SQLite
- Scryfall API for card data; in-app parser for text/CSV collections and a simple deckbuilder engine with role/curve heuristics and a legality toggle.
