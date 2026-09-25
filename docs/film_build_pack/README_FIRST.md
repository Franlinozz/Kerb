# Kerb Demo Video Build Pack

This pack is designed to be committed at the repository root and handed to Claude Code.

It does not replace the existing Kerb product plan. It adds a tightly scoped production plan for the final OKX Dev Day demo film.

## Goal

Produce a final Kerb demo video between 3:05 and 3:30, with a preferred target of about 3:18.

The film must remain primarily a real product demonstration. Target composition:

- 75 to 80 percent real Kerb UI and recorded interactions.
- 20 to 25 percent motion treatment, typography, crops, transitions, callouts, and visual explanation.
- No fabricated product state, numbers, or transactions.
- No generic crypto animation, fake dashboards, or AI-generated substitute UI.

## Inputs already in the repository

Video sources:
`docs/demo_video_scenes/`

Music:
`docs/audio_background/Audio compilation.mp3`

Preferred audio section:
Use the beginning of the supplied music. Trim only what is needed for the final film. Do not jump to a later section unless the opening has a technical defect.

## Start here

Claude Code should read these in order:

1. Root `AGENTS.md`
2. `docs/demo_video/AGENTS.md`
3. `docs/demo_video/MASTERPLAN.md`
4. `docs/demo_video/STORYBOARD.md`
5. `docs/demo_video/VOICEOVER_SCRIPT.md`
6. `docs/demo_video/MOTION_SYSTEM.md`
7. `docs/demo_video/AUDIO_SYSTEM.md`
8. `docs/demo_video/QUALITY_GATES.md`
9. `docs/demo_video/CLAUDE_CODE_START_PROMPT.md`

Then run:

```bash
node scripts/demo-video/preflight.mjs
node scripts/demo-video/inspect-media.mjs
node scripts/demo-video/make-review-frames.mjs
```

Do not render the final film before Milestones M0 through M3 in `MASTERPLAN.md` have passed.
