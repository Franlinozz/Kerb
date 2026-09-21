# V2-IMAGE-PROMPTS.md
## The Kerbstone art plates: prompts, pipeline, placement

Generated with the OpenAI Images API on your existing key (use the newest `gpt-image` model the account exposes; `gpt-image-1` at minimum), `quality: "high"`, size `1536x1024` for landscape plates and `1024x1536` for the mobile 4:5 crops. Three candidates per plate. You pick; the agent never auto-selects the final art.

Cost gate: roughly 12 plates × 3 candidates. This is a new cost under AGENTS.md gate 2, so the agent asks before running the batch. Expect single-digit dollars.

---

## 1. Shared art direction (prepend to every prompt)

```
Ultra-detailed editorial 3D render in the style of a premium architectural poster.
Photorealistic weathered granite and basalt, dense living moss and tiny ferns in joints and cracks,
small cubes of three materials: rough granite, polished brushed brass with a warm inner glow,
and clear glass containing tiny moss. Precise, monumental, calm. Soft volumetric atmosphere,
fine dust in the air, shallow reflections. Large clean negative space on the LEFT third of the
frame for typography. Absolutely no text, no letters, no numbers, no logos, no symbols, no people,
no hands, no flags, no screens, no charts. Not a coin, not a shield, not a chain.
```

Day suffix:
```
Warm bone-white and ivory environment, colour of the backdrop close to #EFEBE3, low golden-hour
sunlight from the left, long soft shadows, pale distant mountains in haze, still shallow water.
Palette: bone, ivory, charcoal stone, moss green, brushed brass.
```

Night suffix:
```
Near-black environment, backdrop close to #0B0C0A, cool faint moonlight rim-lighting the stone,
the brass cubes glowing warmly like lamps and reflecting in black still water, thin low mist.
Palette: black, charcoal stone, moss green, glowing brass, a touch of cold bone light.
```

---

## 2. Plates

### P1. The Kerbstone (Home hero)
```
A monumental kerbstone seen in three-quarter profile, rising from still water: two colossal
granite slabs forming a single clean step, the upper tread on the left, the lower tread to the
right, like a giant street kerb built as a monument. Moss grows thick in the joint of the step and
along the lower edges. A loose stream of dozens of small cubes lifts off the upper tread and rises
diagonally up and to the right, becoming sparser with height: mostly granite cubes, about one in
five polished brass cubes with a warm glow, two or three clear glass cubes with moss inside. The
step sits in the right two thirds of the frame. Wide cinematic composition.
```
Files: `kerbstone-day.avif`, `kerbstone-night.avif`, plus 4:5 mobile crops `kerbstone-day-m.avif`, `kerbstone-night-m.avif`.

### P2. The Record (Research)
```
A tall archive wall built from stacked stone blocks and cubes, like geological strata or a library
of stone, seen straight on and slightly from below. The lower, older layers are dark and heavily
overgrown with moss; the upper, newer layers are cleaner and lighter. Brass cubes are set into the
wall at irregular intervals like bookmarks, a few glowing. At the top edge a few cubes are still
being placed, hovering just above the wall.
```

### P3. The Standard (Methodology)
```
Five thin, perfectly flat translucent glass slabs floating horizontally in a vertical stack with
clear air gaps between them, each slab slightly smaller than the one below, thin brushed-brass
edges on each slab. Resting on the lowest slab: a small granite kerb step with moss. Soft light
passes through the glass and casts faint layered shadows. Centred slightly right.
```
Also render a **forest** variant for the dark feature band: replace the backdrop with deep forest green close to `#15201A`.

### P4. The Seal (Proof)
```
A clear glass cube with brushed-brass edges and corners, sealed, sitting on a rough granite
plinth. Inside the cube, preserved like a specimen: a miniature granite kerb step overgrown with
moss, one tiny brass cube resting on its lower tread. Studio product lighting, crisp reflections on
the glass.
```

### P5. Fog (404)
```
A single granite kerbstone, alone, half-sunk in still water, surrounded by dense soft fog that hides
everything else. Moss on its top edge. One small brass cube lying on the stone. Very quiet, very
empty, lots of negative space.
```

### P6. Social card base (OG and Twitter)
Use P1 generated at `1536x1024`, then crop to `1200x630` keeping the step on the right. The wordmark, tagline and live line are composited by code, never generated.

---

## 3. Pipeline (agent task, `scripts/art/`)

1. `generate.ts`: reads this file's prompt blocks, calls the Images API, writes raw PNGs to `art/raw/<plate>-<theme>-<n>.png`, logs cost. Never commits raw files larger than 5 MB; store raws on the VPS.
2. Operator picks one per plate and theme; record the choice in `art/SELECTION.md`.
3. `process.ts` with `sharp`:
   - colour-match the backdrop: sample the four corner regions and nudge levels so the backdrop lands within ΔE 3 of `#EFEBE3` (Day) or `#0B0C0A` (Night);
   - export AVIF (q 55) and WebP (q 70) at 2400, 1600 and 960 widths; mobile crops at 1080 × 1350;
   - generate a 24 px blur placeholder data URI;
   - write `apps/web/public/art/<plate>-<theme>-<w>.<ext>` and a manifest `art/manifest.json` with dimensions and placeholders.
4. `og.ts`: composites the social card (P6) with the Kerb mark, "Credit on the market's clock.", and "X Layer · usekerb.xyz" in General Sans, one per section (home, board, credit, research, methodology, proof, developers).

Budget per page: hero under 320 KB at 1600 w AVIF.

---

## 4. Placement and masking

| Plate | Where | Mask |
|---|---|---|
| P1 | Home hero, right 7 columns, bleeds off the right edge | linear fade to canvas over the left 30%, radial fade at the bottom 20% |
| P2 | Research index hero band | linear fade on left and bottom |
| P3 | Methodology header; forest variant on the Home "How a term is made" section | radial fade all edges |
| P4 | Proof header, right side | radial fade all edges |
| P5 | 404, centred | radial fade all edges |

Alt text: P1 "A monumental stone kerb step rising from still water, with cubes of stone, brass and glass lifting off its upper tread." Use `alt=""` where the image is purely decorative next to a heading that already carries the meaning.

---

## 5. Fallback if the art is not good enough by Tue 22 Sep 18:00 UTC

Do not ship mediocre renders. Ship the **geometric Kerbstone** instead: an inline SVG built from the mark's geometry at monumental scale, drawn in hairlines over the construction grid (the step outline, its shadow as hatching, a column of 1 px outlined squares rising from the upper tread, one filled brass square per real Terms post in the last hour). It is on-brand, sharp at every size, and the squares are live data. Log the rung.
