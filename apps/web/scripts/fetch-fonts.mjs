#!/usr/bin/env node
/**
 * Fetch General Sans from Fontshare into src/fonts/ before a build.
 *
 * The ITF Free Font License allows self-hosting on our own site but forbids redistributing the
 * font files, including through a public repository, so the files are git-ignored and fetched
 * here from the official source. If they cannot be fetched the build fails: next/font/local
 * refuses a missing file, which is the behaviour AGENTS.md section 12.4 asks for.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

const dir = resolve(dirname(fileURLToPath(import.meta.url)), "../src/fonts");
const WEIGHTS = ["Light", "Regular", "Medium", "Semibold"];
const want = WEIGHTS.map((w) => `GeneralSans-${w}.woff2`);
if (want.every((f) => existsSync(resolve(dir, f)))) process.exit(0);

const res = await fetch("https://api.fontshare.com/v2/fonts/download/general-sans");
if (!res.ok) { console.error(`fetch-fonts: Fontshare answered ${res.status}`); process.exit(1); }
const zip = Buffer.from(await res.arrayBuffer());

// Minimal zip reader: walk the central directory, inflate the entries we want.
const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
let p = zip.readUInt32LE(eocd + 16);
const count = zip.readUInt16LE(eocd + 10);
mkdirSync(dir, { recursive: true });
let found = 0;
for (let i = 0; i < count; i++) {
  const method = zip.readUInt16LE(p + 10);
  const size = zip.readUInt32LE(p + 20);
  const nameLen = zip.readUInt16LE(p + 28), extraLen = zip.readUInt16LE(p + 30), commentLen = zip.readUInt16LE(p + 32);
  const local = zip.readUInt32LE(p + 42);
  const name = zip.subarray(p + 46, p + 46 + nameLen).toString("utf8");
  p += 46 + nameLen + extraLen + commentLen;
  const base = name.split("/").pop();
  const isFont = name.includes("/WEB/fonts/") && want.includes(base);
  const isLicence = name.endsWith("License/FFL.txt");
  if (!isFont && !isLicence) continue;
  const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
  const raw = zip.subarray(start, start + size);
  writeFileSync(resolve(dir, isLicence ? "GeneralSans-LICENSE.txt" : base), method === 8 ? inflateRawSync(raw) : raw);
  if (isFont) found++;
}
if (found !== want.length) { console.error(`fetch-fonts: found ${found} of ${want.length} weights`); process.exit(1); }
console.log(`fetch-fonts: General Sans ${WEIGHTS.join(", ")} from Fontshare`);
