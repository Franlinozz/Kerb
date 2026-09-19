import { gzipSync } from "node:zlib";
import { keccakBytes } from "@kerb/types";
import type { Db } from "./db/client.js";
import { blobs } from "./db/schema.js";

export interface StoredBlob {
  cid: string;
  contentHash: `0x${string}`;
}

/**
 * Store a raw payload exactly as received. The content hash is keccak256 of the raw bytes,
 * and the blob id is derived from it, so identical payloads dedupe without any UPDATE.
 */
export async function putBlob(db: Db, body: string | Uint8Array, mediaType: string): Promise<StoredBlob> {
  const bytes = typeof body === "string" ? Buffer.from(body, "utf8") : Buffer.from(body);
  const contentHash = keccakBytes(bytes);
  const cid = `keccak256:${contentHash}`;
  await db
    .insert(blobs)
    .values({ cid, contentHash, mediaType, encoding: "gzip", size: bytes.length, bytes: gzipSync(bytes) })
    .onConflictDoNothing({ target: blobs.cid });
  return { cid, contentHash };
}
