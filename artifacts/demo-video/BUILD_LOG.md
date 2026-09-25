# Demo film build log

## M0 Toolchain and source integrity (25 Sep, 14:00 UTC)
- Changed: pack moved to `docs/demo_video/` and `scripts/demo-video/` (the paths its scripts expect); placeholder `hi` and `clips` files removed.
- Evidence: `preflight.json` ok; `source_manifest.json`: 12 clips, all 1920x1080 30 fps H.264 with silent AAC (-90 dB); music 708.7 s MP3 44.1 kHz.
- Issues: no ElevenLabs key in the Kerb env. The operator's own key from the Marque env was used (free tier, 8,174 characters available).
- Next: M1.

## M1 Eyes and ears audit (14:05 to 14:55 UTC)
- Changed: `FOOTAGE_AUDIT.md`; 2 fps contact sheets (`review2/`), gridded full-resolution stills (`stills/g/`), 10 fps motion map (`scripts/demo-video/motion_profile.py`), music loudness map and waveform.
- Evidence: exact state-change frames measured by frame difference: 06 Last Call flip at 21.967 s, curable row at 28.0 s, Cure done at 57.867 s.
- Decisions: 06 alone carries the hero sequence; 06b and 11 unused. One replacement capture: the live Home hero (`captures/home_hero_live.mkv`, recorded headless at the operator's layout scale) for a long, steady close.
- Next: M2.

## M2 Edit decision list (15:00 UTC)
- Changed: `scripts/demo-video/kerb_film.py` holds the edit (source in points, speeds, camera, overlays); `docs/demo_video/EDL.json` is written from it.
- Evidence: 46 shots, every in point on a measured still window.
- Issues: the Report #2 figures in the planning script (5 of 10, HKEXCx -82.80%) are superseded by the final report the footage shows (window closed 25 Sep 07:00 UTC: held at the cliff, 6 of 10 fell 10% or more a day later, 4 rose). Narration follows the final report, as CLAIM_GUARDRAILS directs.
- Next: M3.

## M3 Silent rough cut (15:30 UTC)
- Changed: `rough_mute.mp4` (720p preview, no audio), 3:20.1.
- Evidence: reviewed as 2 s contact sheets muted. The order reads without narration: live Board, exit measurement, terms, Session Max borrow, countdown to Last Call, curable row, another wallet cures, back at Carry, proof, consumers, evidence, testnet and unaudited limitations, thesis.
- Issues found and fixed: zooms that clipped headlines, colliding labels in the hero, duplicate BORROWER label, chapter marks over UI text, KerbQuote label over the row above.
- Next: M4.

## M4 Motion pass (15:40 to 16:30 UTC)
- Changed: seam transitions at the eight chapter boundaries, the chapter marks, source-locked corner brackets, the KTS two-horizon rail, the proof strip, the Last Call seam at the exact flip frame, the Last Call state tag through the hero, the OKX Wallet insert, the end card.
- Evidence: full-resolution stills reviewed (`stills/review_A..F.png`).
- Next: M5.

## M5 Voiceover (15:10 UTC)
- Changed: `voice/*.mp3`, 13 segments, ElevenLabs `eleven_multilingual_v2`, voice Adam (premade). Antoni, Sam and Noah are not in the connected account; Adam is the pack's first fallback.
- Evidence: local ASR (`voice/asr.json`) of every take; one retake (05: "The borrow confirms" was heard as "The borrower confirms"; line changed to "The loan confirms").
- Issues: ASR spells Kerb as "curb", which is the intended pronunciation.
- Next: M6.

## M6 Music and sound (16:00 UTC)
- Changed: `scripts/demo-video/build_audio.py`. Music is the opening of the supplied track, with one edit: the silent middle of the gap between its second and third pieces (149.5 to 152.9 s) is removed with a 0.3 s crossfade. Deterministic ducking at about 21 dB under speech, about 16.5 dB in gaps. Three synthesised accents only: a soft structural swell into the Board, a low impact on the Last Call flip frame, a restrained two-partial tone on the Cure confirmation frame.
- Evidence: master -14.0 LUFS integrated, true peak under -1 dBTP (`audio/mix_info.json`).
- Next: M7.

## M7 QA (16:30 to 17:50 UTC)
- Changed: master rendered in five parallel chunks; one defect found on the master (a sliver of browser chrome in the Cured shot, from a framing wider than the page viewport) and fixed by re-rendering that chunk only.
- Evidence: `FINAL_QA.md`, `render_qa.json`, ASR of the finished mix (`audio/mix_asr.txt`), sync measured at the Last Call flip (94.017 s).
- Issues: no audio playback in this environment; the operator should listen once on headphones.
- Next: M8.

## M8 Export (17:50 UTC)
- Changed: `Kerb_OKX_Dev_Day_Demo_MASTER.mp4` (117.5 MB), `Kerb_OKX_Dev_Day_Demo_WEB.mp4` (49.0 MB), `Kerb_OKX_Dev_Day_Demo.srt` (51 cues, written forms), `final_timeline.json`, `docs/demo_video/EDL.json`.
- Runtime: 3:20.5.
