#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "artifacts/demo-video");
mkdirSync(OUT, { recursive: true });

const required = [
  "docs/demo_video_scenes/01_HOME_MASTER.mov.mp4",
  "docs/demo_video_scenes/02_BOARD_LIVE.mov.mp4",
  "docs/demo_video_scenes/03_ASSET_EXIT_AND_WHY.mov.mp4",
  "docs/demo_video_scenes/04_KTS_METHOD.mov.mp4",
  "docs/demo_video_scenes/05_CREDIT_BORROW.mov.mp4",
  "docs/demo_video_scenes/06_LAST_CALL_AND_CURE.mov.mp4",
  "docs/demo_video_scenes/07_PROOF.mov.mp4",
  "docs/demo_video_scenes/08_AGENT_AND_CONTRACT.mov.mp4",
  "docs/demo_video_scenes/09_RESEARCH_REPORT_2.mov.mp4",
  "docs/demo_video_scenes/10_HOME_CLOSER.mov.mp4",
  "docs/audio_background/Audio compilation.mp3",
  "docs/demo_video/EDL.json",
  "docs/demo_video/voiceover.json"
];

const missing = required.filter((p) => !existsSync(path.join(ROOT, p)));

function has(bin) {
  try {
    execFileSync(bin, ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const result = {
  checkedAt: new Date().toISOString(),
  missing,
  tools: {
    ffmpeg: has("ffmpeg"),
    ffprobe: has("ffprobe"),
    node: process.version
  },
  ok: missing.length === 0 && has("ffmpeg") && has("ffprobe")
};

writeFileSync(path.join(OUT, "preflight.json"), JSON.stringify(result, null, 2));

console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exit(1);
