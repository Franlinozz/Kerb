#!/usr/bin/env node
// Generates the narration, one ElevenLabs request per segment, into artifacts/demo-video/voice/.
//   ELEVENLABS_API_KEY=... node scripts/demo-video/generate-voiceover.mjs [--only id1,id2] [--force]
// Existing takes are kept unless --force or --only names them, so single lines can be regenerated.
// previous_text and next_text are sent so each segment is read with its neighbours' intonation in mind.
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
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
const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : null;
const force = args.includes("--force");

async function findVoice() {
  if (process.env.ELEVENLABS_VOICE_ID) return { voice_id: process.env.ELEVENLABS_VOICE_ID, name: "explicit override" };
  for (const name of cfg.voice_preference) {
    const u = new URL("https://api.elevenlabs.io/v2/voices");
    u.searchParams.set("search", name);
    u.searchParams.set("page_size", "100");
    const res = await fetch(u, { headers: { "xi-api-key": apiKey } });
    if (!res.ok) continue;
    const data = await res.json();
    // Premade voices are named like "Adam - Dominant, Firm": match on the first word.
    const exact = (data.voices ?? []).find((v) => String(v.name).split(" - ")[0].trim().toLowerCase() === name.toLowerCase());
    if (exact) return exact;
  }
  throw new Error(`None of the preferred voices were available: ${cfg.voice_preference.join(", ")}`);
}

const voice = await findVoice();
console.log(`Using ElevenLabs voice: ${voice.name} (${voice.voice_id}), model ${cfg.model_id}`);

const manifestPath = path.join(OUT, "voice_manifest.json");
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : { segments: [] };
manifest.voice = { name: voice.name, id: voice.voice_id };
manifest.model_id = cfg.model_id;
manifest.settings = cfg.voice_settings;

const segs = cfg.segments;
for (let i = 0; i < segs.length; i++) {
  const seg = segs[i];
  const dest = path.join(OUT, `${seg.id}.mp3`);
  const wanted = only ? only.includes(seg.id) : force || !existsSync(dest);
  if (!wanted) continue;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice.voice_id}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      text: seg.text,
      model_id: cfg.model_id,
      voice_settings: cfg.voice_settings,
      previous_text: i > 0 ? segs[i - 1].text : undefined,
      next_text: i < segs.length - 1 ? segs[i + 1].text : undefined,
    }),
  });
  if (!res.ok) throw new Error(`TTS failed for ${seg.id}: ${res.status} ${await res.text()}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  manifest.segments = manifest.segments.filter((s) => s.id !== seg.id);
  manifest.segments.push({ ...seg, file: path.relative(ROOT, dest), generatedAt: new Date().toISOString() });
  console.log(`generated ${seg.id} (${seg.text.length} chars)`);
}
manifest.segments.sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log("Voiceover generation complete.");
