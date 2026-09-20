/** Pinning is I/O and lives outside the computation path. Without a JWT the bundle still has a CID. */
export interface PinResult {
  status: "pinned" | "unpinned";
  cid: string;
  service: string;
  reason?: string;
}

export async function pinBundle(canonical: string, localCid: string, name: string): Promise<PinResult> {
  const jwt = process.env["PINATA_JWT"];
  if (!jwt) return { status: "unpinned", cid: localCid, service: "none", reason: "PINATA_JWT not configured; CID computed locally" };
  const form = new FormData();
  form.append("file", new Blob([canonical], { type: "application/json" }), `${name}.json`);
  form.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));
  form.append("pinataMetadata", JSON.stringify({ name }));
  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST", headers: { authorization: `Bearer ${jwt}` }, body: form, signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  if (!res.ok) return { status: "unpinned", cid: localCid, service: "pinata", reason: `pinata ${res.status}: ${text.slice(0, 160)}` };
  const body = JSON.parse(text) as { IpfsHash?: string };
  if (!body.IpfsHash) return { status: "unpinned", cid: localCid, service: "pinata", reason: "pinata returned no IpfsHash" };
  return { status: "pinned", cid: body.IpfsHash, service: "pinata" };
}
