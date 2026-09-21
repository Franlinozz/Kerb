#!/usr/bin/env node
/**
 * Derive the served art from the operator-approved masters. Masters are never modified.
 * AVIF (primary) and WebP (fallback) at widths up to, never above, the master's width; a 4:5 crop
 * for phones where the manifest asks for one; a 24 px blur placeholder. Writes
 * public/art/optimized/* and src/lib/art.generated.json (dimensions, files, placeholders).
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(resolve(root, "package.json"));
const sharp = require("sharp");

const MASTERS = resolve(root, "public/art/masters");
const OUT = resolve(root, "public/art/optimized");
mkdirSync(OUT, { recursive: true });

// Crop centres come from looking at each master (docs/v2/ART.md): x as a fraction of width.
const PLATES = {
  "p1-kerbstone-night": { mobileCentreX: 0.69 },
  "p1-kerbstone-day": { mobileCentreX: 0.69 },
  "p2-record": {},
  "p3-standard": {},
  "p5-fog": {},
};
const LADDER = [640, 960, 1280, 1600];

const generated = {};
let originalBytes = 0, optimizedBytes = 0;
for (const [name, opts] of Object.entries(PLATES)) {
  const src = resolve(MASTERS, `${name}.png`);
  originalBytes += statSync(src).size;
  const meta = await sharp(src).metadata();
  const widths = [...LADDER.filter((w) => w < meta.width), meta.width];
  const files = [];
  for (const w of widths) {
    for (const [ext, fn] of [["avif", (s) => s.avif({ quality: 68, effort: 4, chromaSubsampling: "4:4:4" })], ["webp", (s) => s.webp({ quality: 80, smartSubsample: true })]]) {
      const out = resolve(OUT, `${name}-${w}.${ext}`);
      await fn(sharp(src).resize({ width: w, withoutEnlargement: true })).toFile(out);
      optimizedBytes += statSync(out).size;
      files.push({ w, ext, bytes: statSync(out).size });
    }
  }
  let mobile = null;
  if (opts.mobileCentreX !== undefined) {
    // 4:5 from the full master height; no upscaling, so the crop is as tall as the master.
    const h = meta.height, w = Math.round((h * 4) / 5);
    const left = Math.max(0, Math.min(meta.width - w, Math.round(meta.width * opts.mobileCentreX - w / 2)));
    const cropped = await sharp(src).extract({ left, top: 0, width: w, height: h }).toBuffer();
    const mw = [480, w];
    mobile = { width: w, height: h, left, files: [] };
    for (const mwid of mw) {
      for (const ext of ["avif", "webp"]) {
        const out = resolve(OUT, `${name}-m-${mwid}.${ext}`);
        const s = sharp(cropped).resize({ width: mwid, withoutEnlargement: true });
        await (ext === "avif" ? s.avif({ quality: 68, effort: 4, chromaSubsampling: "4:4:4" }) : s.webp({ quality: 80 })).toFile(out);
        optimizedBytes += statSync(out).size;
        mobile.files.push({ w: mwid, ext, bytes: statSync(out).size });
      }
    }
  }
  const blur = await sharp(src).resize({ width: 24 }).webp({ quality: 50 }).toBuffer();
  generated[name] = { width: meta.width, height: meta.height, widths, files, mobile, blur: `data:image/webp;base64,${blur.toString("base64")}` };
  console.log(`${name}: ${meta.width}x${meta.height}, widths ${widths.join(", ")}${mobile ? `, 4:5 crop ${mobile.width}x${mobile.height} from x=${mobile.left}` : ""}`);
}
writeFileSync(resolve(root, "src/lib/art.generated.json"), JSON.stringify(generated, null, 1) + "\n");
console.log(`original ${(originalBytes / 1e6).toFixed(2)} MB, optimized total ${(optimizedBytes / 1e6).toFixed(2)} MB`);
