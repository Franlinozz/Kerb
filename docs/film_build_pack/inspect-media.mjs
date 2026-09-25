#!/usr/bin/env node
import { readdirSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const SCENES = path.join(ROOT, "docs/demo_video_scenes");
const MUSIC = path.join(ROOT, "docs/audio_background/Audio compilation.mp3");
const OUT = path.join(ROOT, "artifacts/demo-video");
mkdirSync(OUT, { recursive: true });

function probe(file) {
  const raw = execFileSync("ffprobe", [
    "-v", "quiet",
    "-print_format", "json",
    "-show_format",
    "-show_streams",
    file
  ], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
  const j = JSON.parse(raw);
  const v = j.streams?.find((s) => s.codec_type === "video") ?? null;
  const a = j.streams?.find((s) => s.codec_type === "audio") ?? null;
  return {
    file: path.relative(ROOT, file).replaceAll("\\", "/"),
    duration: Number(j.format?.duration ?? 0),
    size: Number(j.format?.size ?? 0),
    format: j.format?.format_name ?? null,
    video: v ? {
      codec: v.codec_name,
      width: v.width,
      height: v.height,
      fps: v.avg_frame_rate,
      pix_fmt: v.pix_fmt
    } : null,
    audio: a ? {
      codec: a.codec_name,
      sample_rate: a.sample_rate,
      channels: a.channels
    } : null
  };
}

const sceneFiles = readdirSync(SCENES)
  .filter((n) => /\.(mp4|mov|mkv|webm)$/i.test(n))
  .sort()
  .map((n) => path.join(SCENES, n));

const manifest = {
  generatedAt: new Date().toISOString(),
  scenes: sceneFiles.map(probe),
  music: existsSync(MUSIC) ? probe(MUSIC) : null
};

writeFileSync(path.join(OUT, "source_manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`Wrote ${path.join(OUT, "source_manifest.json")}`);
