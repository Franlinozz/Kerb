/**
 * A thin read-only proxy to the Kerb API for browser calls.
 *
 * The public API at api.usekerb.xyz serves the same routes with CORS open, so this is not a
 * gate: it just means the page works the same way in development, behind a preview URL, and in
 * production, without depending on a public hostname resolving.
 */
import { NextResponse } from "next/server";

const BASE = process.env["KERB_API_INTERNAL"] ?? "http://127.0.0.1:8720";

export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }): Promise<NextResponse> {
  const { path } = await ctx.params;
  // Only the credit read routes, and only with the shapes the API itself validates.
  const safe = path.every((seg) => /^[A-Za-z0-9._-]{1,80}$/.test(seg));
  if (!safe || path.length > 5) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  try {
    const res = await fetch(`${BASE}/v1/credit/${path.join("/")}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    const body = (await res.json()) as unknown;
    return NextResponse.json(body, { status: res.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "the Kerb API did not answer";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
