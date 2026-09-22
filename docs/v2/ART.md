# Kerbstone art: what is placed where, and why

Operator-generated plates (ChatGPT Plus, no API cost), uploaded 21 Sep 2026 and identified by
looking at each image, not by upload order. Embedded creation times: 21:20 to 21:35 UTC.

| Master | What the image shows | Placed | Focal point (object-position) |
|---|---|---|---|
| `p1-kerbstone-night.png` | Moss-grown stone arch in still water at night, brass and stone cubes lifting off it, open sky left | Home hero, Night | desktop 72% 50%, tablet 70% 50%, phone 4:5 crop centred at 69% |
| `p1-kerbstone-day.png` | The same arch at golden hour | Home hero, Day | as Night |
| `p2-record.png` | Stepped wall of stone and glass cubes rising right, fog and mountains left | Research | 64% 45% (phone 70%) |
| `p3-standard.png` | Stacked glass slabs over a mossy stone step, golden hour | Methodology | 58% 42% |
| `p5-fog.png` | A stone gate in fog, right third, lit from within | 404 | 74% 50% |
| `p4-seal.png` | Two stone monoliths holding a lit glass cube, a beam through the seam, fog and peaks left (upload 09, approved by the operator 22 Sep) | Proof | 66% 40% |

Not placed, kept in `docs/v2/art-unplaced/` for the operator: `03-kerb-step-day.png` (a Day
kerb step with rising cubes, the literal P1 brief, no Night pair), `07-forest-variant.png`,
and the two other experiments (`08` gate, `10` ring). `09` (a sealed cube held in stone) became
P4 The Seal on the operator's approval, 22 Sep.

Derivatives: `apps/web/scripts/art/process.mjs` (sharp). AVIF q68 (4:4:4) and WebP q80 at
640, 960, 1280, 1600 and the master's 1672 px, never upscaled; a 4:5 phone crop of P1 at 480
and 753 px (the master's full height); a 24 px blur placeholder. AVIF at q58 was tried first and
visibly softened the stone texture; q68 keeps it. Hero at 1600 px: 125 KB (Night), 157 KB (Day).

Loading: every plate is lazy; the Home hero's painted-theme variant is promoted to eager with
high fetch priority by an inline script before layout, so only one hero variant is fetched.

A dedicated phone render of P1 is not needed: the 4:5 crop keeps the whole arch and its
reflection (checked at 390 px in both themes).
