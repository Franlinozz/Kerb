# Claude Code Start Prompt

Paste this into Claude Code after committing this pack and setting the ElevenLabs API key in the environment.

---

You are producing the final remote submission demo for Kerb.

Before editing anything, read the root `AGENTS.md`, then every file in `docs/demo_video/`.

Your job is not to make a generic hackathon montage. Your job is to create a world-class, truthful, high-retention product film from the real recorded Kerb interface.

The working footage is already in `docs/demo_video_scenes/`.

The music is already in `docs/audio_background/Audio compilation.mp3`.

Use the beginning of that music.

The final film should be about 3 minutes 18 seconds and must remain between 2 and 4 minutes.

Use approximately 75 to 80 percent real product demo and 20 to 25 percent motion treatment.

Do not invent data, UI, transactions, or unsupported claims.

Do not redesign Kerb.

Do not bury the Last Call and Cure sequence.

Do not mistake Kerb Credit for the whole product. Kerb is the market-time risk layer. Kerb Credit is the reference consumer and proof.

Milestone behavior is mandatory:

M0. Run the preflight and inspect all source metadata.

M1. Generate review frames and create `artifacts/demo-video/FOOTAGE_AUDIT.md`. You must visually inspect every recording and separately judge 06 and 06b. Listen to or otherwise inspect the beginning of the music. Do not proceed until the audit exists.

M2. Replace the null trims in `docs/demo_video/EDL.json` with exact source timecodes based on the footage. If any read-only source is poor, re-record the public live route yourself. For wallet transaction footage, prefer the supplied recordings.

M3. Build a mute rough cut first. Watch it. The story must still work without narration.

M4. Add the motion language in `MOTION_SYSTEM.md`. Keep motion structural, restrained, and subordinate to real footage.

M5. Generate the segmented voiceover with ElevenLabs. Prefer Antoni. If unavailable, use Adam, then Sam, then Noah. Use the script as a factual boundary, but you may tighten lines for timing without adding claims.

M6. Mix the supplied music under the narration. Use the opening of the track. Keep it subtle.

M7. Run every gate in `QUALITY_GATES.md`. Watch the entire result with sound, muted, and audio only.

M8. Export the master, web copy, SRT, timeline, and QA report.

If 06 is not sufficient, salvage only the strongest missing moment from 06b. Do not use 06b by default.

If 11 is not needed, omit it.

If you discover a stronger edit than the target timeline, you may change individual scene lengths, but preserve the story spine and final runtime.

Do not ask for permission to continue between milestones. Continue automatically unless the root `AGENTS.md` requires an operator gate.

At the end of each milestone, write one short checkpoint to `artifacts/demo-video/BUILD_LOG.md` containing:
- milestone
- what changed
- evidence
- runtime if applicable
- issues
- next milestone

The final film should leave a judge with one dominant impression:

Kerb knows when an apparently continuous token market stops being safely liquidatable, and it turns that fact into verifiable financial terms before the risk becomes a liquidation problem.
