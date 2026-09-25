#!/usr/bin/env node
import { readdirSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "docs/demo_video_scenes");
const OUT = path.join(ROOT, "artifacts/demo-video/review");
mkdirSync(OUT, { recursive: true });

const files = readdirSync(SRC)
  .filter((n) => /\.(mp4|mov|mkv|webm)$/i.test(n))
  .sort();

for (const name of files) {
  const input = path.join(SRC, name);
  const stem = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const dir = path.join(OUT, stem);
  mkdirSync(dir, { recursive: true });

  const pattern = path.join(dir, "contact_%02d.jpg");
  execFileSync("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel", "error",
    "-i", input,
    "-vf",
    "fps=1/4,scale=420:-2,tile=4x4:padding=6:margin=6",
    "-q:v", "3",
    pattern
  ]);

  for (const t of ["00:00:00.500", "00:00:05.000"]) {
    const out = path.join(dir, `still_${t.replaceAll(":", "-")}.jpg`);
    try {
      execFileSync("ffmpeg", [
        "-y", "-hide_banner", "-loglevel", "error",
        "-ss", t, "-i", input,
        "-frames:v", "1",
        "-vf", "scale=1280:-2",
        out
      ]);
    } catch {}
  }

  console.log(`review frames: ${name}`);
}
