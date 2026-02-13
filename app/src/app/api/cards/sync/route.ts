import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runCardDatabaseSync } from "@/lib/mtg/syncCardDatabase";

export const maxDuration = 300;

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Sign in to sync the card database." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };
      try {
        const count = await runCardDatabaseSync((message, progress) => {
          send({ type: "progress", message, progress });
        });
        send({ type: "done", count, message: `Card database updated. ${count} cards.` });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Sync failed";
        send({ type: "error", error: message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}
