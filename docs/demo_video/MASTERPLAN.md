# Kerb Demo Video Masterplan

## Final target

Preferred runtime: 3:18.

Allowed editorial range: 3:05 to 3:30.

Absolute maximum: 3:45.

Delivery master:
- 1920x1080
- 30 fps constant frame rate
- H.264 High Profile
- AAC 48 kHz
- web fast start
- clean stereo mix
- no burned browser chrome unless the source itself requires it for credibility

The final film should feel like a serious product film made from a functioning protocol, not like a screen recording with narration added afterward.

## Story spine

The film moves through six ideas:

Problem -> live measurement -> terms -> credit lifecycle -> proof and consumers -> measured evidence and close.

The emotional peak is not the borrow transaction. It is the moment Last Call turns an otherwise valid Session Max position into a curable obligation, then a second wallet repairs only the excess.

## Milestones

### M0: Toolchain and source integrity

Run preflight.

Pass only if:
- every expected recording exists
- background music exists
- `ffmpeg` and `ffprobe` are available
- source metadata has been indexed
- no source files are modified in place

Output:
`artifacts/demo-video/source_manifest.json`

### M1: Eyes and ears audit

Claude must inspect the source material before choosing trims.

Required actions:
- generate contact sheets for every recording
- inspect the beginning, middle, and end of every recording
- inspect 06 and 06b separately
- inspect the waveform and first 3:30 of the music
- note obvious dead time, misclicks, wallet interruptions, unreadable states, capture defects, and strong moments

Output:
`artifacts/demo-video/FOOTAGE_AUDIT.md`

The audit must explicitly answer:
- Is 06 sufficient by itself?
- Is any portion of 06b cleaner and worth salvaging?
- Does 05 clearly show Session Max selection and confirmed borrowing?
- Does 03 clearly show executable depth and the OKX DEX cross-check or enough surrounding UI to support narration?
- Does 08 clearly show both the agent and contract consumer story?
- Does 09 clearly show Report #2 and its empirical result?
- Is 11 needed at all?

No rough cut before this audit exists.

### M2: Edit decision list

Create exact source in and out points in:
`docs/demo_video/EDL.json`

Do not guess timecodes before viewing footage.

Target scene lengths are in `STORYBOARD.md`.

Output:
- exact clip trims
- final scene order
- intentional hard cuts and transitions
- list of any replacement recordings needed

### M3: Silent rough cut

Build a mute rough cut first.

This is mandatory.

Pass only if a technically literate judge can understand the broad product story without narration.

The rough cut must show:
- live Board state
- depth or exit measurement
- KTS or term causality
- Carry versus Session Max
- Last Call
- permissionless Cure
- proof or recomputation
- at least one non-Credit consumer
- Report #2 or equivalent measured evidence
- closing product identity

Target rough cut: 2:55 to 3:10 before pauses from narration.

### M4: Motion design pass

Add only the motion system defined in `MOTION_SYSTEM.md`.

Do not redesign the site.

Use motion to focus attention, compress dead time, and explain transitions.

Target motion graphics footprint: 20 to 25 percent of total runtime, mostly layered over real footage.

### M5: Voiceover

Preferred voice: Antoni.

Fallback order if unavailable in the connected ElevenLabs account:
1. Adam
2. Sam
3. Noah

Voice must sound calm, precise, institutional, and human.

Use ElevenLabs Multilingual v2 unless the connected account exposes a clearly higher quality production model with the same voice and Claude verifies it is appropriate.

Generate in separate scene segments, not one monolithic request.

Reason:
- easier pacing control
- easier regeneration of weak lines
- easier synchronization
- avoids damaging the entire narration when one phrase needs a new take

### M6: Music and sound design

Use the beginning of:
`docs/audio_background/Audio compilation.mp3`

Do not loop unless final runtime exceeds the usable opening section.

The music is subordinate to narration.

Use sound design sparingly:
- one low structural hit for the Last Call state change
- one restrained confirmation accent for Cure success
- optional soft transition texture between problem and system
- no repeated whooshes

### M7: Technical and editorial QA

Run the complete checklist in `QUALITY_GATES.md`.

Watch the entire video three ways:

1. with sound
2. muted
3. audio only

If any mode fails to communicate cleanly, revise.

### M8: Final export

Produce:
- `artifacts/demo-video/Kerb_OKX_Dev_Day_Demo_MASTER.mp4`
- `artifacts/demo-video/Kerb_OKX_Dev_Day_Demo_WEB.mp4`
- `artifacts/demo-video/Kerb_OKX_Dev_Day_Demo.srt`
- `artifacts/demo-video/final_timeline.json`
- `artifacts/demo-video/FINAL_QA.md`

## Replacement recording policy

Claude is allowed to replace weak public read-only footage by recording the live site itself.

Preferred replacement routes:
- `/`
- `/board`
- `/asset/<symbol>`
- `/methodology`
- `/proof`
- `/developers`
- `/research/2`

Replacement footage must be:
- current live product
- dark theme unless a specific reason requires light
- 100 percent browser zoom
- stable viewport
- no devtools
- no random tabs or notifications
- no fake data
- no hidden mocked API

For wallet flows, use existing 05 and 06 unless the operator environment already contains the explicit testnet demo wallet setup needed to repeat them safely.

## Editing doctrine

Use hard cuts more often than transitions.

A good cut that lands on an idea is stronger than a decorative transition.

Do not show complete pages when the judge only needs one panel. Crop and zoom into the exact evidence.

Do not hold a static table for seven seconds. Use a controlled push-in, a bracket, or a single-line highlight.

Do not turn every sentence into on-screen text. Important phrases only.
