# Google Auth Setup (Step-by-Step)

Follow these steps to get **Client ID** and **Client Secret** for "Sign in with Google" in this app.

---

## 1. Open Google Cloud Console

Go to: **https://console.cloud.google.com/**

Sign in with your Google account.

---

## 2. Create or select a project

- At the top of the page, click the **project dropdown** (it may say "Select a project" or show a project name).
- Click **"New Project"**.
  - Name it something like **Commander Deck Builder**.
  - Click **Create**.
- Make sure this new project is **selected** in the dropdown before continuing.

---

## 3. Configure the OAuth consent screen

- In the left sidebar, go to: **APIs & Services** → **OAuth consent screen**  
  (or open: https://console.cloud.google.com/apis/credentials/consent)
- Choose **External** (so any Google user can sign in). Click **Create**.
- Fill in:
  - **App name**: e.g. `Commander Deck Builder`
  - **User support email**: your email
  - **Developer contact email**: your email
- Click **Save and Continue**.
- On **Scopes**: click **Save and Continue** (no need to add scopes for basic sign-in).
- On **Test users**: click **Save and Continue** (you can leave empty for local testing).
- Click **Back to Dashboard**.

---

## 4. Create OAuth client credentials

- In the left sidebar: **APIs & Services** → **Credentials**  
  (or: https://console.cloud.google.com/apis/credentials)
- Click **+ Create Credentials** → **OAuth client ID**.
- **Application type**: choose **Web application**.
- **Name**: e.g. `Commander Deck Builder (local)`.
- Under **Authorized JavaScript origins**, click **+ Add URI** and add:
  - `http://localhost:3000`
- Under **Authorized redirect URIs**, click **+ Add URI** and add **exactly**:
  - `http://localhost:3000/api/auth/callback/google`
- Click **Create**.

---

## 5. Copy the Client ID and Client Secret

A popup will show:

- **Client ID** — long string ending in `.apps.googleusercontent.com`
- **Client secret** — shorter string (click "Copy" or copy it now; you can’t see it again easily)

Copy both. If you already closed the popup, open **Credentials** again, click the OAuth 2.0 Client you just created, and you’ll see the Client ID; you can reset the secret if needed.

---

## 6. Put them in your `.env` file

In your project’s **`app`** folder, open `.env` (create it from `.env.example` if needed) and set:

```env
AUTH_SECRET=your-random-secret-here
GOOGLE_CLIENT_ID=paste-your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=paste-your-client-secret-here
```

**AUTH_SECRET**: run this in a terminal and paste the output:

```bash
openssl rand -base64 32
```

(On Windows without OpenSSL, you can use any long random string, e.g. from https://generate-secret.vercel.app/32)

---

## 7. Restart the dev server

Stop the app (Ctrl+C) and run again:

```bash
npm run dev
```

Then open **http://localhost:3000** and click **Sign in with Google**. You should be redirected to Google, then back to your app when it works.

---

## Troubleshooting

| Problem | What to check |
|--------|----------------|
| "Redirect URI mismatch" | Redirect URI in Google Console must be **exactly** `http://localhost:3000/api/auth/callback/google` (no trailing slash, correct port). |
| "Access blocked: This app's request is invalid" | Finish the OAuth consent screen (step 3) and make sure you added your email. |
| "Invalid client" | Double-check **GOOGLE_CLIENT_ID** and **GOOGLE_CLIENT_SECRET** in `.env` (no extra spaces or quotes). |
| Still not working | Ensure the project selected in the Google Console dropdown is the one where you created the OAuth client. |
