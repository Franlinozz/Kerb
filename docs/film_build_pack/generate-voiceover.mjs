#!/usr/bin/env node
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const cfg = JSON.parse(readFileSync(path.join(ROOT, "docs/demo_video/voiceover.json"), "utf8"));
const OUT = path.join(ROOT, "artifacts/demo-video/voice");
mkdirSync(OUT, { recursive: true });

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  console.error("ELEVENLABS_API_KEY is not set.");
  process.exit(1);
}

async function findVoice() {
  if (process.env.ELEVENLABS_VOICE_ID) return {
    voice_id: process.env.ELEVENLABS_VOICE_ID,
    name: "explicit override"
  };

  for (const name of cfg.voice_preference) {
    const u = new URL("https://api.elevenlabs.io/v2/voices");
    u.searchParams.set("search", name);
    u.searchParams.set("page_size", "100");
    const res = await fetch(u, { headers: { "xi-api-key": apiKey } });
    if (!res.ok) continue;
    const data = await res.json();
    const exact = (data.voices ?? []).find((v) => String(v.name).toLowerCase() === name.toLowerCase());
    if (exact) return exact;
  }
  throw new Error(`None of the preferred voices were available: ${cfg.voice_preference.join(", ")}`);
}

const voice = await findVoice();
console.log(`Using ElevenLabs voice: ${voice.name} (${voice.voice_id})`);

const manifest = {
  generatedAt: new Date().toISOString(),
  voice: { name: voice.name, id: voice.voice_id },
  model_id: cfg.model_id,
  settings: cfg.voice_settings,
  segments: []
};

for (const seg of cfg.segments) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice.voice_id}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: seg.text,
        model_id: cfg.model_id,
        voice_settings: cfg.voice_settings
      })
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TTS failed for ${seg.id}: ${res.status} ${body}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const dest = path.join(OUT, `${seg.id}.mp3`);
  writeFileSync(dest, buf);
  manifest.segments.push({ ...seg, file: path.relative(ROOT, dest).replaceAll("\\", "/") });
  console.log(`generated ${seg.id}`);
}

writeFileSync(path.join(OUT, "voice_manifest.json"), JSON.stringify(manifest, null, 2));
console.log("Voiceover generation complete.");
