import { runDayTradeScan } from "@/lib/server/daytrade";
import { cached, jsonCached } from "@/lib/server/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const data = await cached("daytrade", 90, runDayTradeScan);
    return jsonCached(data, 120);
  } catch (e) {
    return jsonCached({ error: (e as Error).message }, 0, 502);
  }
}
