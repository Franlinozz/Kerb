/** Pinning is I/O and lives outside the computation path. Without a JWT the bundle still has a CID. */
export interface PinResult {
  status: "pinned" | "unpinned";
  cid: string;
  service: string;
  reason?: string;
}

/**
 * When the pinning service refuses for a reason that will not change in the next minute (a
 * quota, a blocked account, a bad key), stop asking for a while. Hammering a 403 every cycle
 * wastes time in the attester's critical path and tells nobody anything new.
 */
let blockedUntilMs = 0;
let blockedReason = "";
const BACKOFF_MS = 30 * 60 * 1000;

export async function pinBundle(canonical: string, localCid: string, name: string): Promise<PinResult> {
  const jwt = process.env["PINATA_JWT"];
  if (!jwt) return { status: "unpinned", cid: localCid, service: "none", reason: "PINATA_JWT not configured; CID computed locally" };
  if (Date.now() < blockedUntilMs) {
    return { status: "unpinned", cid: localCid, service: "pinata", reason: blockedReason };
  }
  const form = new FormData();
  form.append("file", new Blob([canonical], { type: "application/json" }), `${name}.json`);
  form.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));
  form.append("pinataMetadata", JSON.stringify({ name }));
  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST", headers: { authorization: `Bearer ${jwt}` }, body: form, signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  if (!res.ok) {
    const reason = `pinata ${res.status}: ${text.slice(0, 160)}`;
    if (res.status === 401 || res.status === 403 || res.status === 429) {
      blockedUntilMs = Date.now() + BACKOFF_MS;
      blockedReason = `${reason} (not retrying for 30 minutes)`;
      return { status: "unpinned", cid: localCid, service: "pinata", reason: blockedReason };
    }
    return { status: "unpinned", cid: localCid, service: "pinata", reason };
  }
  const body = JSON.parse(text) as { IpfsHash?: string };
  if (!body.IpfsHash) return { status: "unpinned", cid: localCid, service: "pinata", reason: "pinata returned no IpfsHash" };
  return { status: "pinned", cid: body.IpfsHash, service: "pinata" };
}
