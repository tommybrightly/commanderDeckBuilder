/**
 * Runs when the Next.js server starts. Kicks off card database sync in background
 * if the Card table is empty, so users never need to manually sync.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startCardDatabaseSyncIfEmpty } = await import("./lib/mtg/syncCardDatabase");
    startCardDatabaseSyncIfEmpty();
  }
}
