# Putting Commander Deck Builder on the Internet

This guide walks you through deploying the app so anyone can use it. The easiest path is **Railway** (works with SQLite and has a free tier). Alternative: **Vercel** + **Neon** (serverless, free tiers).

---

## Option A: Railway (recommended — keeps SQLite)

Railway gives you a Node app + persistent disk, so your SQLite database and synced card data stay between deploys.

### 1. Put your code on GitHub

1. Create a new repository on [GitHub](https://github.com/new).
2. In your project folder (the one that contains the `app` folder), run:

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

   Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your GitHub username and repo name.

**Important:** Make sure `app/.env` is **not** committed (it should be in `.gitignore`). You'll add secrets in Railway instead.

### 2. Create a Railway project

1. Go to [railway.app](https://railway.app) and sign in (e.g. with GitHub).
2. Click **New Project**.
3. Choose **Deploy from GitHub repo** and select your repository.
4. Set the **Root Directory** to `app` (so Railway runs from the folder that has `package.json` and `next.config.ts`).
5. Railway will detect Next.js and add build/start commands. If not, set:
   - **Build command:** `npm install && npx prisma generate && npm run build`
   - **Start command:** `npx prisma migrate deploy && npm start`

### 3. Add a volume (for SQLite)

SQLite needs a **persistent disk** so the database file isn’t lost when Railway redeploys. Railway calls this a **Volume**.

**Where to add it:** Volumes are not under Settings or Variables. Use one of these:

- **Command Palette:** On the Railway project dashboard, press **Ctrl+K** (Windows/Linux) or **⌘K** (Mac), then type **“Volume”** or **“Create volume”** and choose the option to create a new volume.
- **Right‑click:** Right‑click on the **project canvas** (the area where your service/box is drawn) and look for **“Add volume”** or **“Create volume”** in the menu.

**Then:**

1. When asked which service to attach the volume to, select your app service (the one that runs the Next.js app).
2. Set the **mount path** to `/data` (or another path you prefer). This is the folder inside the container where the volume will appear.
3. Create/save the volume. Railway will attach it to your service.
4. In **Variables**, set `DATABASE_URL` to `file:/data/dev.db` (if you used `/data` as the mount path). Railway also sets `RAILWAY_VOLUME_MOUNT_PATH` automatically; you can use that path in `DATABASE_URL` if you prefer, e.g. `file:${RAILWAY_VOLUME_MOUNT_PATH}/dev.db`.

**If you don’t see Volume options:** You may need to be on a paid plan (e.g. Hobby) for volumes; the free/trial tier has limits. Check [Railway’s pricing](https://railway.app/pricing) and [Volumes docs](https://docs.railway.app/guides/volumes).

### 4. Set environment variables

In Railway → your service → **Variables**, add:

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | `file:/data/dev.db` (or the path where your volume is mounted) |
| `AUTH_SECRET` | A random secret (generate once and paste the result — see below) |
| `GOOGLE_CLIENT_ID` | Your Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Your Google OAuth client secret |

**Generate `AUTH_SECRET`** (run one of these locally and paste the output):

- **PowerShell (Windows):**  
  `[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))`
- **Node.js** (if you have Node installed):  
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
- **OpenSSL** (Mac/Linux or if installed on Windows):  
  `openssl rand -base64 32`

**Auth redirect URIs:** In [Google Cloud Console](https://console.cloud.google.com/) → your OAuth client → **Authorized redirect URIs**, add the **exact** URL where users open your app, plus `/api/auth/callback/google`:

- If you use the Railway domain: `https://commanderdeckbuilder-production.up.railway.app/api/auth/callback/google` (replace with your actual Railway domain if different).
- If you use a custom domain (e.g. GoDaddy): also add `https://www.commanderdeckbuilder.com/api/auth/callback/google` and/or `https://commanderdeckbuilder.com/api/auth/callback/google` so the URI matches the address in the browser.

**Important:** The redirect URI must match the **address in the browser** when you click “Sign in.” If you get `redirect_uri_mismatch`, add the callback URL for the exact host you’re visiting (no trailing slash).

Optional (for more sign-in options):

- `GITHUB_ID` / `GITHUB_SECRET` — add redirect URI `https://YOUR_RAILWAY_URL/api/auth/callback/github`
- `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` — add redirect URI `https://YOUR_RAILWAY_URL/api/auth/callback/discord`

### 5. Deploy

1. Push to `main` or click **Deploy** in Railway. Railway will build and run your app.
2. Open the URL Railway gives you (e.g. **Settings** → **Domains**).
3. Sign in with Google (or another provider), go to **Settings**, and click **Sync card database** once so the card table is filled.

### 6. (Optional) Custom domain

In Railway → your service → **Settings** → **Domains**, add your own domain and point your DNS to the value Railway shows.

**If the domain reaches Railway but shows "not found" or a Railway error page:**

- **Domain must be on the app service:** Add the custom domain under the **same service** that runs your Next.js app (the one with the Build/Start commands), not a different service or project.
- **Exact hostname:** Add the **exact** hostname users type (e.g. `www.yourdomain.com` or `yourdomain.com`). If DNS forwards root to www, add `www.yourdomain.com` in Railway.
- **One domain per service:** If you have multiple services, ensure the custom domain is only assigned to the web app service so Railway routes traffic to it.
- **Redeploy after adding domain:** Sometimes a redeploy (or toggling the domain off/on in **Settings** → **Domains**) fixes routing. Check **Deployments** to confirm the latest deploy is active.
- **Railway status:** Check [status.railway.app](https://status.railway.app) for incidents. If it’s still broken, open a ticket or post in [Railway’s Discord/Help](https://discord.gg/railway) with: project name, service name, and the exact domain you added.

---

## Option B: Vercel + Neon (serverless)

Vercel doesn’t keep a writable filesystem between requests, so SQLite isn’t a good fit. Use **Neon** (Postgres) instead.

### 1. Database: Neon

1. Go to [neon.tech](https://neon.tech) and create a free account.
2. Create a new project and copy the **connection string** (e.g. `postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require`).

### 2. Switch Prisma to Postgres

1. In `app/prisma/schema.prisma`, change the datasource:

   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. Install the Postgres driver:

   ```bash
   cd app
   npm install @prisma/adapter-pg pg
   ```

3. Update Prisma to use the Postgres adapter (see [Prisma 7 docs](https://www.prisma.io/docs/orm/overview/databases/postgresql) for adapter setup if your project uses a custom adapter). If you’re using the default Prisma client only, you may just need to set `DATABASE_URL` and run migrations.

4. Create a new migration for Postgres:

   ```bash
   npx prisma migrate dev --name postgres_init
   ```

   (You might need to reset or adjust migrations when switching from SQLite to Postgres; Prisma will guide you.)

### 3. Deploy to Vercel

1. Push your code to GitHub (same as Option A, step 1).
2. Go to [vercel.com](https://vercel.com) and **Add New** → **Project**; import your GitHub repo.
3. Set **Root Directory** to `app`.
4. In **Environment Variables**, add:
   - `DATABASE_URL` — your Neon connection string
   - `AUTH_SECRET` — `openssl rand -base64 32`
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
5. In Google Cloud Console, add the Vercel URL to redirect URIs, e.g. `https://your-app.vercel.app/api/auth/callback/google`.
6. Deploy. After deploy, run migrations against production DB (e.g. `DATABASE_URL="your-neon-url" npx prisma migrate deploy` from your machine or a one-off script).
7. Open the app, sign in, then go to **Settings** and **Sync card database** once.

---

## After going live

- **Card sync:** Run **Sync card database** from Settings once after the first deploy so the `Card` table is populated. You can run it again later to refresh data.
- **OAuth:** Any time you change the app’s public URL, add that new redirect URI in Google (and GitHub/Discord if you use them).
- **Secrets:** Never commit `.env`. Always set secrets in the host’s dashboard (Railway Variables, Vercel Environment Variables).

If you tell me which option you prefer (Railway vs Vercel), I can give you the exact commands for your repo and any small code changes (e.g. Prisma Postgres) step-by-step.
