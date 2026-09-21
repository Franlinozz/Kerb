// Convert a screenshot folder to WebP (quality 72) so committed screenshots stay small.
const sharp = require("sharp");
const fs = require("fs"); const path = require("path");
const dir = process.argv[2];
(async () => { for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".png"))) {
  const p = path.join(dir, f);
  await sharp(p, { limitInputPixels: false }).webp({ quality: 72 }).toFile(p.replace(/\.png$/, ".webp"));
  fs.unlinkSync(p);
} })();
