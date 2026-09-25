#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const file = process.argv[2] ?? path.join(ROOT, "artifacts/demo-video/Kerb_OKX_Dev_Day_Demo_MASTER.mp4");

if (!existsSync(file)) {
  console.error(`Missing render: ${file}`);
  process.exit(1);
}

const raw = execFileSync("ffprobe", [
  "-v", "quiet",
  "-print_format", "json",
  "-show_format",
  "-show_streams",
  file
], { encoding: "utf8" });

const j = JSON.parse(raw);
const duration = Number(j.format?.duration ?? 0);
const video = j.streams?.find((s) => s.codec_type === "video");
const audio = j.streams?.find((s) => s.codec_type === "audio");

const issues = [];
if (duration < 120) issues.push("Runtime below 2:00.");
if (duration > 240) issues.push("Runtime above 4:00.");
if (!video) issues.push("No video stream.");
if (!audio) issues.push("No audio stream.");
if (video && !(video.width === 1920 && video.height === 1080)) issues.push(`Unexpected frame size ${video.width}x${video.height}.`);

const result = {
  checkedAt: new Date().toISOString(),
  file: path.relative(ROOT, file).replaceAll("\\", "/"),
  duration,
  video: video ? {
    codec: video.codec_name,
    width: video.width,
    height: video.height,
    fps: video.avg_frame_rate,
    pix_fmt: video.pix_fmt
  } : null,
  audio: audio ? {
    codec: audio.codec_name,
    sample_rate: audio.sample_rate,
    channels: audio.channels
  } : null,
  issues
};

const out = path.join(ROOT, "artifacts/demo-video/render_qa.json");
writeFileSync(out, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));

if (issues.length) process.exitCode = 2;
