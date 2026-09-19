/**
 * Raw HTTP fetch that keeps the exact bytes received, so the collector can hash and
 * store the payload as observed. Parsing always happens after the bytes are kept.
 */
export interface RawHttp {
  url: string;
  status: number;
  fetchedAt: string;
  body: string;
  latencyMs: number;
}

export interface HttpFetcher {
  get(url: string, headers?: Record<string, string>): Promise<RawHttp>;
}

const UA = "kerb-collector/0.1 (+https://userkerb.xyz)";

export class LiveHttp implements HttpFetcher {
  constructor(private readonly timeoutMs = 15_000) {}

  async get(url: string, headers: Record<string, string> = {}): Promise<RawHttp> {
    const t0 = Date.now();
    const fetchedAt = new Date(t0).toISOString();
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/json", ...headers },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const body = await res.text();
    return { url, status: res.status, fetchedAt, body, latencyMs: Date.now() - t0 };
  }
}

export class HttpError extends Error {
  constructor(readonly raw: RawHttp) {
    super(`HTTP ${raw.status} from ${raw.url}: ${raw.body.slice(0, 200)}`);
  }
}

export function parseJsonOk<T>(raw: RawHttp): T {
  if (raw.status < 200 || raw.status >= 300) throw new HttpError(raw);
  return JSON.parse(raw.body) as T;
}
