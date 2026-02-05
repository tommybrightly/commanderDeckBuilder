import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ enabled: false });
  }
  const enabled = Boolean(process.env.OPENAI_API_KEY?.trim());
  return Response.json({ enabled });
}
