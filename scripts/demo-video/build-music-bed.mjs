#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const input = path.join(ROOT, "docs/audio_background/Audio compilation.mp3");
const outDir = path.join(ROOT, "artifacts/demo-video/audio");
mkdirSync(outDir, { recursive: true });

const duration = Number(process.env.KERB_DEMO_RUNTIME ?? "198");
const out = path.join(outDir, "music_bed.wav");

execFileSync("ffmpeg", [
  "-y",
  "-hide_banner",
  "-loglevel", "error",
  "-i", input,
  "-t", String(duration + 1),
  "-af",
  `afade=t=in:st=0:d=1.2,afade=t=out:st=${Math.max(0, duration - 2.5)}:d=2.5,volume=0.16`,
  "-ar", "48000",
  "-ac", "2",
  out
]);

console.log(`Wrote ${out}`);
