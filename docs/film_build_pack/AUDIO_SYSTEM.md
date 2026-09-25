# Audio System

## Voice

Preferred voice: Antoni.

Fallbacks:
Adam, Sam, Noah.

The final voice must sound more like an experienced product lead or market-infrastructure narrator than a commercial voice actor.

Recommended ElevenLabs starting values:
- stability: 0.58
- similarity: 0.78
- style: 0.00
- speaker boost: on
- speed: 0.96

Regenerate any segment that sounds:
- rushed
- theatrical
- overly cheerful
- monotone
- synthetic on acronyms
- unclear on X Layer, Kerb, KTS, C(1%), or x402

Generate scene narration separately.

## Music

Source:
`docs/audio_background/Audio compilation.mp3`

Use the beginning.

Target music section:
approximately 0:00 to final runtime plus 2 seconds.

Do not loop unless necessary.

Apply:
- gentle 1.0 to 1.5 second fade in
- narration sidechain or volume automation
- 2.0 to 3.0 second fade out

Music should remain felt, not noticed.

Starting mix target:
- narration centered and dominant
- music approximately 18 to 24 dB below narration during normal speech
- music may rise 3 to 5 dB in gaps
- final integrated loudness around -14 LUFS
- true peak at or below -1 dBTP

These are starting points, not a substitute for listening.

## Sound design

Maximum three designed accents in the whole film:

1. soft structural transition into measurement or terms
2. low impact at Last Call opening
3. restrained confirmation accent after Cure succeeds

Do not add click sounds to every UI interaction.

Do not download random cinematic sound packs without checking license.

Generated synthesis is acceptable if it sounds clean.

## Silence

Allow small moments of silence under:
- the actual Last Call state change
- Cure confirmation
- the final line

A film that never breathes feels less premium.
