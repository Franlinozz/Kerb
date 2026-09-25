# Demo video scripts

These scripts provide deterministic inspection and media preparation without adding package dependencies.

Required system tools:
- Node 22
- ffmpeg
- ffprobe

Recommended flow:

```bash
node scripts/demo-video/preflight.mjs
node scripts/demo-video/inspect-media.mjs
node scripts/demo-video/make-review-frames.mjs
```

Then visually inspect the generated review material and fill exact source trims in:
`docs/demo_video/EDL.json`

Generate narration after the rough cut:

```bash
ELEVENLABS_API_KEY=... node scripts/demo-video/generate-voiceover.mjs
```

Optional explicit voice override:

```bash
ELEVENLABS_API_KEY=... ELEVENLABS_VOICE_ID=... node scripts/demo-video/generate-voiceover.mjs
```

Prepare the supplied music opening:

```bash
KERB_DEMO_RUNTIME=198 node scripts/demo-video/build-music-bed.mjs
```

`qa-render.mjs` checks basic technical output after the final edit.

The final motion edit is intentionally not reduced to a one-command blind render. Claude must inspect the actual footage and build the exact edit from the EDL because source timecodes and visual quality determine the correct cut.
