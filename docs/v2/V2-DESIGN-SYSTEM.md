# KERBSTONE
## The Kerb V2 design system and page specifications

Reference: the Marque and KiteAI posters you supplied (bone and black editorial canvases, weathered stone monoliths, moss, brass and glass cubes, hairline construction lines, registration crosshairs, tracked uppercase annotation stacks, coordinates in the corner, one olive accent line in the headline). Kerb takes that language and makes it its own by grounding every decorative element in Kerb's subject: market time.

A kerb is the stone edge between the road and the pavement: a boundary you step across. That is the product. The market steps from open to closed; credit must step with it. The whole identity is built on that one image.

---

## 1. Principles

1. **Stone and instrument.** Stone is permanence: the append-only record nobody can revise. Instrument is precision: hairlines, coordinates, registration marks, tabular figures. Every screen holds both.
2. **Time is the organising axis.** Every page shows where the markets are right now. Nothing on the site is timeless.
3. **Ornament is evidence.** The "decorative" details are real: the coordinates are the exchange floors, the clocks are the exchange local times, the hashes are real transactions, the cubes in the art are the observations. Never a fake number used as texture.
4. **Two voices.** The *Instrument* voice (sans, tabular, tracked labels) runs the product. The *Almanac* voice (serif) is reserved for research, where Kerb speaks as an institution.
5. **One image per major page, then silence.** Art opens a page; below it, typography, hairlines and data carry everything.
6. **Tables where comparison is the job, composition everywhere else.** The V1 rule "tables not cards" is retired. Board, histories, sources, parameters and deployments are tables. Decisions, positions, research and verification are composed layouts.

---

## 2. Themes

Three options in the theme menu:

| Theme | Name | Behaviour |
|---|---|---|
| Dark (default) | **Night** | Market-closed palette. Brass cubes glow like lamps. |
| Light | **Day** | Session-open palette. Bone, warm haze, stone. |
| Auto | **Market** | Day while the New York regular session is open (13:30 to 20:00 UTC on trading days), Night otherwise. The site literally dims when Wall Street closes. Label in the menu: "Market time". |

Theme is stored in `localStorage` (`kerb-theme` = `night` / `day` / `market`) and painted before first paint by the existing bootstrap script. `data-theme` on `<html>` is `night` or `day` at all times; "market" resolves to one of them and re-resolves every minute.

---

## 3. Tokens (paste into `src/styles/tokens.css`)

```css
@layer tokens {
  :root, [data-theme="night"] {
    /* canvas and surfaces */
    --canvas:    #0B0C0A;
    --canvas-2:  #0F110E;
    --panel:     #131511;
    --panel-2:   #191C17;
    --forest:    #15201A;   /* feature bands only */
    --stone:     #3A3D37;
    --hair:      rgba(236, 232, 222, 0.09);
    --hair-2:    rgba(236, 232, 222, 0.17);
    --scrim:     rgba(11, 12, 10, 0.72);

    /* ink */
    --ink:       #ECE8DE;   /* bone */
    --ink-2:     #B8B3A6;
    --ink-3:     #8A857A;   /* AA on --canvas for 13px+ */
    --ink-inverse: #0B0C0A;

    /* accents */
    --olive:     #A6A47A;   /* display accent line only */
    --moss:      #8FA35E;   /* interactive: focus, active nav, links, safe */
    --moss-dim:  #56633A;
    --brass:     #D6A64F;   /* Last Call, action needed, data glow */
    --brass-dim: #6B5428;
    --oxide:     #D2694C;   /* liquidation, danger */

    /* regime tones */
    --r-deep:      #ECE8DE;
    --r-normal:    #C7C2B4;
    --r-thin:      #8F8A7E;
    --r-last-call: var(--brass);
    --r-closed:    #4A4D46;
    --r-action:    var(--olive);
    --r-halted:    var(--oxide);
    --r-stale:     #6E6A61;
    --r-recovery:  var(--moss);

    /* construction layer */
    --grid-line: rgba(236, 232, 222, 0.045);
    --cross:     rgba(236, 232, 222, 0.28);

    color-scheme: dark;
  }

  [data-theme="day"] {
    --canvas:    #EFEBE3;
    --canvas-2:  #E8E3D9;
    --panel:     #F6F3ED;
    --panel-2:   #FBF9F5;
    --forest:    #1E2A21;   /* stays dark: used as an inverse feature band */
    --stone:     #C9C2B4;
    --hair:      rgba(20, 20, 16, 0.10);
    --hair-2:    rgba(20, 20, 16, 0.18);
    --scrim:     rgba(239, 235, 227, 0.78);

    --ink:       #141410;
    --ink-2:     #4A4740;
    --ink-3:     #6B675E;
    --ink-inverse: #EFEBE3;

    --olive:     #6E6C45;
    --moss:      #4E6128;
    --moss-dim:  #A9B48C;
    --brass:     #9A6B12;
    --brass-dim: #E6D3A8;
    --oxide:     #A5402A;

    --r-deep:      #141410;
    --r-normal:    #3F3C35;
    --r-thin:      #6B675E;
    --r-closed:    #B9B2A3;
    --r-stale:     #8A857A;

    --grid-line: rgba(20, 20, 16, 0.05);
    --cross:     rgba(20, 20, 16, 0.30);

    color-scheme: light;
  }

  :root {
    --font-sans:  "General Sans", "Hanken Grotesk", ui-sans-serif, system-ui, sans-serif;
    --font-serif: "Instrument Serif", "Iowan Old Style", Georgia, serif;
    --font-mono:  "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace;

    --r-1: 2px;   /* data: pills, cells, inputs */
    --r-2: 4px;   /* panels */
    --r-3: 10px;  /* sheets, modals */

    --s-1: 4px;  --s-2: 8px;  --s-3: 12px; --s-4: 16px; --s-5: 24px;
    --s-6: 32px; --s-7: 48px; --s-8: 72px; --s-9: 120px;

    --maxw: 1360px;
    --gutter: 24px;
    --margin: clamp(20px, 3.2vw, 48px);

    --ease: cubic-bezier(0.2, 0.7, 0.1, 1);
    --t-fast: 160ms;
    --t-panel: 320ms;
    --t-hero: 900ms;
  }
}
```

Contrast rule: `--ink-3` is the lowest text tone allowed, and only at 13 px or larger. Anything smaller uses `--ink-2`.

---

## 4. Typography

| Family | Source | Use |
|---|---|---|
| **General Sans** 300 / 400 / 500 / 600 | Fontshare (ITF Free Font License, commercial use allowed), self-hosted via `next/font/local` | Everything in the product |
| **Instrument Serif** 400, 400 italic | Google Fonts (OFL) via `next/font/google` | Research titles, report pull-quotes, the big numerals on report pages. Nowhere else |
| **IBM Plex Mono** 400 / 500 | Google Fonts (OFL) via `next/font/google` | Addresses, hashes, commands, raw parameter values |

Fallback ladder if the Fontshare files cannot be fetched: Hanken Grotesk (Google). Log the rung.

### Scale

| Token | Desktop | Mobile | Weight | Tracking | Use |
|---|---|---|---|---|---|
| `display-xl` | 88 / 0.95 | 48 / 1.0 | 500 | −0.04em | Home H1 |
| `display` | 64 / 1.0 | 40 / 1.05 | 500 | −0.035em | Page heroes |
| `h1` | 44 / 1.05 | 32 / 1.1 | 500 | −0.03em | Page titles |
| `h2` | 28 / 1.15 | 22 / 1.2 | 500 | −0.02em | Sections |
| `h3` | 19 / 1.3 | 17 / 1.3 | 500 | −0.01em | Panels |
| `body-l` | 18 / 1.55 | 16 / 1.55 | 400 | 0 | Ledes |
| `body` | 15.5 / 1.55 | 15 / 1.55 | 400 | 0 | Running text |
| `small` | 13 / 1.45 | 13 / 1.45 | 400 | 0 | Notes |
| `label` | 11 / 1.2 | 11 / 1.2 | 500 | +0.22em, uppercase | Annotation stacks, table heads |
| `num-xl` | 56 / 1 | 40 / 1 | 300 | −0.02em, tabular | Hero KPIs |
| `num-l` | 32 / 1.05 | 26 / 1.05 | 400 | −0.01em, tabular | Panel KPIs |
| `num` | 14.5 / 1.3 | 14 / 1.3 | 500 | tabular | Table data |
| `serif-xl` | 72 / 1.0 | 44 / 1.05 | 400 | −0.01em | Report titles |

Tracked uppercase labels are part of the reference look and they stay, with one rule: **a label must carry information** (a market code, coordinates, a status, a count, a chain id). Never a decorative "OVERVIEW" above a heading that already says it.

Olive accent: only the second line of a display headline, only on Home, Research and 404. Never on body copy, never on buttons.

---

## 5. Grid and the construction layer

- 12 columns, max width 1360, gutter 24, outer margin `--margin`. Content left-aligned. Tables may span 12, prose max 68 ch.
- **Construction layer:** a fixed, non-interactive SVG behind hero sections and section headers: vertical hairlines on the 12-column edges in `--grid-line`, plus registration crosshairs (`+`, 11 px, 1 px stroke, `--cross`) at the four corners of each hero and at the left end of each section rule. Never behind tables or forms.
- **Section rule:** every section opens with a 1 px `--hair-2` rule spanning the content width, a crosshair at its left end, the tracked label on the left and a right-aligned tracked annotation (a count, a time, coordinates).
- Vertical rhythm: 120 px between Home sections, 72 px between inner-page sections, 24 px inside panels.

---

## 6. The mark and wordmark

**Mark: the kerb step with one observation.** A solid stone profile with a single step down, and one small square hovering above the lower tread.

```svg
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M2 8.5h11v5h9V20H2z" fill="currentColor"/>
  <rect x="15.5" y="4" width="4" height="4" fill="currentColor"/>
</svg>
```

- Wordmark: "Kerb" in General Sans 500, −0.03em, mark to the left at cap height with a 0.4 em gap.
- Favicon and app icon: mark in `--ink` on a `--canvas` square (Night) with 3 px inset. Provide `app/icon.svg`, `app/apple-icon.png` (180), `app/favicon.ico` (32, 16).
- Never: shields, coins, chain links, candlesticks, sparkles, robots, or the Marque bow-tie.

---

## 7. Imagery

Generated with the OpenAI image model (prompts in `V2-IMAGE-PROMPTS.md`), then colour-matched and masked into the canvas so art and page read as one surface. Every image has a Night and a Day variant.

| Page | Plate | Idea |
|---|---|---|
| Home hero | **The Kerbstone** | A monumental granite step rising from still water, moss in the joint, stone, brass and glass cubes lifting off the upper tread. Day: golden-hour haze. Night: black water, cubes glowing |
| Research | **The Record** | A tall archive wall of stacked stone and brass cubes, older layers mossed over. The observation store as architecture |
| Methodology | **The Standard** | Five thin glass slabs stacked with air between them, a small mossy stone step on the lowest. The five layers of a term |
| Proof | **The Seal** | A brass-edged glass cube on a stone plinth holding a miniature kerb step. Evidence preserved |
| 404 | **Fog** | One kerbstone alone in fog |
| OG / social | Kerbstone crop with wordmark and tagline composited |

**Integration rules**
- Art never carries text. All text is live HTML over it.
- Edges dissolve into the canvas with CSS masks (linear to the text side, radial to the bottom), so there is never a visible image rectangle.
- Hero art may carry up to three **live data callouts**: a hairline leader from a point on the art to a tracked label with a real value (for example `HKEXCx · REFERENCE CLOSED · C(1%) $16.3K`). Values come from the API; if the API fails, callouts are removed, never faked.
- AVIF with WebP fallback, max 2400 px wide, hero under 320 KB, blur placeholder, `priority` only on the hero.

---

## 8. Motion

- One entrance per page: hero art fades from 0 to 1 while scaling 1.02 to 1 over `--t-hero`; headline lines rise 8 px, staggered 60 ms. Once per load.
- Regime transition on the Session Rail: the cursor crosses the boundary, the lane tone cross-fades over 1.2 s, the regime pill swaps. The one orchestrated motion from V1 survives.
- **The Tape**: a slow horizontal ticker of the latest onchain Terms posts (asset, regime, C(1%), short tx hash, age) under the Home hero and above the Board. 60 s loop, pauses on hover and focus, static list under reduced motion.
- **Last Call takeover**: when a position enters its cure window, a 1 px brass border draws around the position panel over 600 ms and the panel headline changes. No shaking, no confetti.
- Brass cubes in Night art may pulse (opacity 0.85 to 1, 4 s) through a separate transparent overlay layer only if generated; otherwise no ambient motion.
- `prefers-reduced-motion: reduce` removes all of the above and swaps states instantly.

---

## 9. Components

Each component lists its job, anatomy and states. Build them once in `src/components/ui/` and `src/components/kerb/`.

**SiteHeader** (64 px desktop, 56 mobile, sticky, `--canvas` at 92% with backdrop blur, hairline bottom).
Left: mark + wordmark. Centre-left nav: Board, Credit, Research, Methodology, Developers (active item in `--ink` with a 2 px moss underline; others `--ink-2`). Right: **Status pill** (`● Live · posted 4m ago` in moss; brass if the last post is older than 15 min; oxide if the API is unreachable) linking to `/proof`; **Connect** button; theme menu (icon button). Mobile: mark, status dot, Connect (icon), menu button opening a full-height drawer with nav, market clocks and theme.

**MarketClocks.** Rows of `NEW YORK · XNYS · 40.7069° N 74.0113° W · 06:52 EDT · PRE-MARKET` and `HONG KONG · XHKG · 22.2840° N 114.1580° E · 18:52 HKT · CLOSED`. Time ticks every second, session from the Clock API. Used in the Home hero corner, the mobile drawer and the footer.

**SessionRail.** Variants: `lanes` (Home: New York and Hong Kong lanes on one shared cursor, 132 px), `full` (Board, Asset: 88 px), `compact` (inner pages: 40 px), `demo` (Credit: one compressed cycle of `KerbClockDemo`). Anatomy: day columns with centred day and date labels (`MON 21`), session segments by kind (Regular in `--r-deep`, Pre/Post in `--r-thin`, Lunch as a notch, Closed as empty), Last Call windows in brass hatching, a 2 px `--ink` cursor with a small "now" flag, and a head row with regime pill, session name and countdown. Behaviour: refetch the clock at every transition and every 60 s; never render a negative countdown (show "Updating" while refetching). Below 760 px the rail shows a 72 hour window centred on now instead of the week, the head row stacks, and MarketClocks leave the hero for the drawer and footer. Hover or focus a segment shows its times in UTC and exchange local time.

**RegimePill.** 24 px, 1 px border, glyph plus word. DEEP filled circle, NORMAL three-quarter, THIN half, LAST CALL brass fill with `--ink-inverse` text, REFERENCE CLOSED hollow, ACTION olive square, HALTED oxide square, STALE dotted outline, RECOVERY moss arc. Words: Deep, Normal, Thin, Last Call, Closed, Corporate action, Halted, Stale, Recovering.

**ProvMark.** The four provenance labels stay. Marker is 8 px; on hover or focus it opens a small card: label name, one-line meaning, source, observed time, and a link (tx, bundle, or source). On critical KPIs the label is also printed in text (`Attested`).

**Kpi.** Tracked label, `num-l` or `num-xl` value, unit, ProvMark, optional delta line. Never a KPI without a source.

**LtvLadder.** The signature data visual. A horizontal 0 to 100% scale. Filled bone bar to Carry, hatched extension to Session Max, a 16 px oxide rule at the fixed liquidation threshold labelled "Liquidation 65% · fixed", and, when a position exists, a brass diamond at its current LTV. Under the scale, one line explaining the margin (KTS-0.2): "Margin: 2.5 × stressed gap to Tue 13:30 UTC + 0.5% exit cost". Compact variant (160 × 14) for Board cells.

**DepthSpark.** 96 × 24 sparkline of C(1%) over 24 h with regime background bands; last point dot.

**ImpactCurve** (rebuilt). Area under the impact curve, markers at C(0.5%), C(1%), C(3%), dashed cross-check marker, hover readout of notional, impact, realised price. Axes in `label` style.

**TermsHistory.** Two-series chart (debt ceiling and C(1%), plus Carry and Session Max on a secondary scale after KTS-0.2) over the last 72 h, with regime background bands. Below it the existing table, collapsed to 10 rows with "Show all".

**MarkWaterfall.** Reference median, pool TWAP, the min of the two, regime haircut, Credit Mark and band, as a horizontal step diagram with values and sources.

**DataTable.** Sticky header, tracked heads, 56 px rows, right-aligned tabular numbers, whole-row link where a row has a destination, sort buttons with `aria-sort`. Mobile: the Board becomes a card list; other tables scroll with the first column sticky and a fade on the right edge.

**Button.** Primary: `--ink` fill, `--ink-inverse` text, 46 px, 2 px radius, 15 px 500. Secondary: 1 px `--hair-2` outline. Quiet: text with underline offset 4. Destructive: oxide outline. Focus: 2 px moss ring offset 2. Loading: label stays, trailing 3-dot indicator, width fixed.

**Field.** 48 px, `--panel` background, 1 px `--hair-2`, right-aligned tabular numbers, inline "Max" chip, unit suffix, helper line, error line in oxide.

**Toast.** Bottom right (top on mobile), `--panel-2`, 1 px `--hair-2`, left 2 px bar in the state colour. Info 4 s, success 5 s with a tx link, error persists until dismissed. Never shows raw library text.

**WalletSheet.** Modal sheet 440 px. Lists EIP-6963 discovered wallets with their icons (OKX Wallet first if present), then generic Injected. Empty state: "No browser wallet found" with links to OKX Wallet and MetaMask. Footer: "Kerb Credit runs on X Layer testnet (chain 1952). We will ask your wallet to add it."

**TxStepper.** Inline stepper for any action with approvals: Approve, Sign, Confirming, Done. Each step shows its state; Done shows "View on OKLink". Failures keep the step highlighted in oxide with the mapped reason and a Retry.

**ArtPanel.** `<picture>` with Night and Day sources, masked edges, optional callout layer, reduced-motion aware.

**SectionHead.** Crosshair, rule, tracked label left, tracked annotation right, `h2` below.

**EmptyState / ErrorState / Skeleton.** Empty explains what belongs here and the next action. Error names the source, says whether anything changed, offers retry. Skeletons match final geometry.

**Footer.** Four columns (Product: Board, Credit, Research. Protocol: Methodology, Contracts, Proof. Developers: SDK, REST, GitHub. Studio: Xyndicate Labs, X, contact), market clocks row, a giant "Kerb" wordmark set in `display-xl` at 18vw clipped by the page bottom, and the standing line: "Risk plane on X Layer mainnet. Credit plane on X Layer testnet with mirror collateral. Unaudited. Not investment advice."

---

## 10. Copy rules

- Plain, exact, calm. Short sentences. Numbers over adjectives.
- No em dashes anywhere, in UI, README or docs. Empty values say what they are: "No debt", "Not yet posted", "Updating". Never a dash glyph as a placeholder.
- Buttons name the action and the toast repeats the verb: "Borrow 500 mUSDG" then "Borrowed 500 mUSDG".
- Errors: what happened, whether anything changed, what to do.
- Number format standard: prices 2 dp (full precision in the ProvMark card); USDG amounts as `$12.4K` / `$8,590` in tables and full with 2 dp in forms; LTVs 1 dp with `%`; ratios 2 dp with `×`; ages as `4m 12s`; times as `13:30 UTC` plus exchange local time where it matters.
- Contract error names are never shown raw. Map every custom error (`ExceedsModeLTV`, `ExceedsDebtCeiling`, `ExceedsPositionCap`, `InsufficientLiquidity`, `PositionUnsafe`, `TermsUnusable`, `CureWindowClosed`, `NotCurable`, `CureTooLarge`, `NotLiquidatable`, `CloseFactorExceeded`, `InsufficientCollateral`, `MarkUnavailable`, `BorrowPaused`, `DepositPaused`, `FaucetCapExceeded`, `ZeroAmount`, `NoDebt`) to a sentence with the numbers decoded.

---

## 11. Page specifications

Routes after V2 (old routes 308-redirect to new):

| Route | Replaces | Job |
|---|---|---|
| `/` | `/` | Sell the thesis in 10 seconds |
| `/board` | same | Explain the market |
| `/asset/[symbol]` | same | Explain one asset's risk |
| `/credit` | `/market` | Let the user act |
| `/research`, `/research/[id]` | `/reports`, `/reports/[id]` | Establish expertise |
| `/methodology` | same | Prove the maths |
| `/proof` | same | Make every claim checkable |
| `/developers` | same | Distribute the primitive |
| `/changelog` | new, P2 | Render `BUILD_PERIOD.md` |

### 11.1 Home

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ + [mark] Kerb    Board  Credit  Research  Methodology  Developers   ● Live 4m  Connect ◐ │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ +                                                              NEW YORK · XNYS          │
│ TOKENIZED EQUITIES                                             40.7069° N 74.0113° W    │
│ EXECUTABLE LIQUIDITY                        [ THE KERBSTONE ]   06:52 EDT · PRE-MARKET   │
│ MARKET TIME                                  granite step,      ─                        │
│ X LAYER 196                                  moss, cubes        HONG KONG · XHKG         │
│ ─                                            lifting            22.2840° N 114.1580° E   │
│                                                                 18:52 HKT · CLOSED       │
│ Credit on the                         ╲ HKEXCx · CLOSED          ─                       │
│ market's clock.   (olive line)         ╲ C(1%) $16.3K                                   │
│                                                                                          │
│ Tokenized stocks trade around the clock. Liquidation            LAST TERMS POSTED        │
│ conditions don't. Kerb measures the exit in real X Layer        4M AGO · X LAYER 196     │
│ pools, then lends against it.                                   ─                        │
│                                                                                          │
│ [ Open the Board ]  [ Borrow on testnet ]                                                │
│                                                                                          │
│ NEVER LEND MORE THAN YOU CAN LIQUIDATE.          BOARD / CREDIT / RESEARCH / PROOF    + │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ THE TAPE ▸ BRK.Bx NORMAL C1 $12.4K 0x3adc… 4m · HKEXCx CLOSED C1 $16.3K 0xea72… 11m · …│
└──────────────────────────────────────────────────────────────────────────────────────┘
```

Sections below the fold, in order:

1. **Every asset keeps its own hours.** SessionRail `lanes` (New York, Hong Kong) with the shared cursor, Last Call windows in brass, and three sentences: New York and Hong Kong open, break and close on their own calendars; the tokens never stop trading; Kerb tracks the difference live.
2. **Measured, not modelled.** Three `num-xl` KPIs from live data with ProvMarks: pool observations stored (`obs_pool_state` rows), Terms posted on X Layer mainnet (post count chain 196), and "7 of 10 pools lost in-range liquidity over the weekend" (Report #1, links to it). After 24 Sep, the third slot rotates to Report #2's headline.
3. **How a term is made.** The Standard plate at left; right, five rows (Clock, Depth, Mark, Terms, Credit), each with one sentence and the live value for the lead asset ("Depth: C(1%) $16.3K from a tick-walk of pool 0x293A…7Ed4"). Links to Methodology.
4. **How long should your loan survive without you?** Carry and Session Max side by side for the lead asset with live LTVs, the LtvLadder, the next cure deadline, and a small Last Call timeline. Button: "Try it on testnet".
5. **The Board.** Top five rows of the new DataTable. "All 10 assets".
6. **Verify everything.** A forest band: mainnet contract addresses (copy + OKLink), Builder Code, test counts from the last CI run, "Every term recomputes from its published inputs". Button: "Open the proof".
7. Footer.

### 11.2 Board

- Header: tracked `THE BOARD · X LAYER 196 · 10 ASSETS · 3 MARKETS`; `h1` "What each stock can safely support, right now."; updated age with live refresh every 30 s.
- KPI band (all computed from the board payload, each labelled Computed): In Last Call now; Executable at 1% (sum of C(1%)); Debt capacity (sum of ceilings); Sources healthy (n of m); Last post age.
- Filters: All · New York · Hong Kong · Metals; regime chips (Last Call, Closed, Normal, Thin, Stale) that only appear when present.
- SessionRail `full` for the currently selected row (defaults to the first).
- Table columns: Asset (ticker, underlying name, market code, local time) · Regime · Credit Mark · Depth C(1%) with DepthSpark · Terms (LtvLadder compact: Carry, Session Max, LT) · Debt ceiling · Coverage · Next (transition name and countdown) · Posted (age, tx link).
- Sources: collapsed disclosure "15 sources reporting" with the table inside.
- Mobile: card per asset (ticker and regime pill, ladder, C(1%), ceiling, next transition).

### 11.3 Asset

```
BRK.Bx                                            ○ CLOSED   NEW YORK · XNYS · 06:52 EDT
Berkshire Hathaway · pool wBRK.Bx / USDG 0.05% · 0x34Fa…A507
───────────────────────────────────────────────────────────────────────────────────────
CREDIT MARK      CARRY     SESSION MAX    LIQUIDATION    C(1%)       DEBT CEILING
$504.92 ◐        55.6%     58.8%          65.0% fixed    $12.4K      $9.3K
[ LtvLadder with margin line ]
[ SessionRail full ]
Overview · Liquidity · Mark · Terms history · Onchain
```

Overview: what you are borrowing against (instrument profile), next transitions, what Carry and Session Max mean for this asset right now. Liquidity: ImpactCurve, C(i) table, cross-check, excluded venues. Mark: MarkWaterfall with sources and exclusions. Terms history: TermsHistory chart and table. Onchain: latest tx, input bundle hash with copy, retrievability status, verify command.

### 11.4 Credit

Three-zone workspace at 1440; stacked at 768 and below.

```
KERB CREDIT · X LAYER TESTNET 1952 · DEMO CLOCK        [ Testnet · mirror collateral · risk from mainnet ⓘ ]
h1  Borrow against tokenized stocks, on the market's clock.
[ SessionRail demo: SESSION ████████▓▓ LAST CALL ░░ CLOSED ····  next Last Call in 07:12 ]
┌ COLLATERAL ───────────┬ ACTION ─────────────────────────────┬ YOUR POSITION ─────────────┐
│ kKOx  mirror of KOx   │ Borrow · Supply · Repay · Withdraw  │ READY TO CARRY             │
│ ○ Closed  $87.77      │                                     │ Health 1.42                │
│ Carry 55.6  SMax 58.8 │ How long should this loan survive   │ [ LtvLadder with ◆ ]       │
│ Next cure 07:12       │ without you?                        │ Current 51.4 · Target 55.6 │
│ ───────────────────── │ ┌ Carry ─────────┐┌ Session Max ───┐ │ Next Last Call 07:12       │
│ kHKEXCx mirror        │ │ $5,560          ││ $5,880  +$320  │ │                            │
│ ...                   │ │ No cure events  ││ Cure by 07:12  │ │ [ Repay ] [ Add collateral]│
│                       │ └─────────────────┘└────────────────┘ │                            │
│ Get set up ✓✓○○       │ Amount [        ] Max                 │                            │
│ 1 Network             │ After: LTV 57.9 · Health 1.12         │                            │
│ 2 Test OKB  (faucet)  │ [ TxStepper Approve · Sign · Done ]   │                            │
│ 3 Test kKOx (mint)    │ [ Borrow $5,880 mUSDG ]               │                            │
│ 4 mUSDG to supply     │                                       │                            │
└───────────────────────┴───────────────────────────────────────┴────────────────────────────┘
CURABLE NOW  (public)   0x1f…9a  kHKEXCx  Session Max  cure 214.30 mUSDG  bonus 1.5%  [ Cure ]
POOL  Supplied $80.0K · Borrowed $2.7K · Available $77.3K · Utilisation 3.4% · Rate 1.17%
```

Last Call takeover of the position panel:

```
LAST CALL                                  brass border drawn around the panel
$486.22 cure required by 07:58 UTC
Repay or add collateral before the window closes. After that, anyone may cure
the position back to its 55.6% Carry target and earn a 1.5% bonus.
[ Repay $486.22 ]  [ Add collateral ]
Liquidation line 65% is not moving.
```

After a cure, the panel resolves to `READY TO CARRY` with a small timeline: `58.8% Session Max → cure 214.30 → 55.6% Carry`.

Disclosure (the ⓘ) opens a drawer with the full testnet explanation, the mUSDG substitution and why, the mirror LT relationship to mainnet LT, and links to every contract on `/proof`.

### 11.5 Research

Index: forest-band hero with The Record plate; serif `serif-xl` "Market-Time Reports"; sub "Measured studies of what market time does to executable liquidity on X Layer." Featured latest report as a large card (serif title, three `num-xl` findings, window, readings). Below, a list with a "Scheduled" row for the next capture with a live countdown until it is published.

Report page: serif title, window and readings line, three headline numbers, **Liquidity change by pool** (horizontal diverging bars, sorted, oxide for falls, moss for rises, route legs separated), **Window against the sessions** (a SessionRail-style strip of the observation window with the gap marked honestly), Findings (claim and evidence), What this report does not show, Sources, Appendix table (existing L values, labelled "in-range liquidity L, protocol units"), Reproduce block, Download JSON. Report #2 adds a **before and after** table from the campaign-end window captures (C(1%), C(3%), mark, ceiling, regime) with change bars.

### 11.6 Methodology

Sticky contents rail at left (Regime, Depth, Mark, Capacity, Covenant, Reproducibility, Parameters, Limits) with scroll-spy. Header with The Standard plate. Each section: a diagram first (regime state order as a vertical ladder; tick-walk explained with the live ImpactCurve; MarkWaterfall; LtvLadder with the KTS-0.2 margin annotation; cure covenant timeline), then the rule in two sentences, then the live worked example. Parameters: grouped definition lists that wrap, nested objects as sub-rows, version pill `KTS 0.2 · params 2026-09-22.1`, "Download parameters JSON". No horizontal scroll at any width.

### 11.7 Proof

Header: `h1` "Kerb is independently verifiable." Status matrix of tiles, each with a state and a link:

| Tile | Example |
|---|---|
| Mainnet risk plane | Live · 876 posts on chain 196 |
| KerbClock / KerbTerms source | Sourcify exact match |
| Builder Code | kt0hl6xyhlx8xmt decoded from latest tx |
| Credit plane | X Layer testnet · verified |
| Input bundles | Retrievable since K-43 · IPFS n of m |
| Tests | 494 TS · 106 Sol · CI passing |
| Mainnet user funds | None held |

Then disclosures: Contracts, Latest Terms posts, Build period, Data store, Reproduce a report, Limitations. The pinning history is phrased as: "Every bundle posted after K-43 resolves from its inputsHash through the API. Earlier posts have a documented IPFS gap caused by the pinning quota." Verification column vocabulary: "Sourcify exact match", "Sourcify partial", "Source in repo, verification pending". Never a bare "no".

### 11.8 Developers

`h1` "Read Kerb Terms from anywhere." Tabs SDK · REST · Solidity, each with an install line, an 8 to 12 line example with copy, and a live response panel fetched from the public API. Then "What you can build": Lender (read Carry and debt ceiling before accepting collateral), Venue (use regime and depth to configure risk), Agent (refuse new exposure when `usable` is false). Then the endpoint table and ABIs.

### 11.9 System pages

- `not-found`: Fog plate, olive second line: "This street / has no kerb." Button "Open the Board".
- `error`: "Something upstream stopped answering." Which source, retry, link to `/proof` status.
- `loading`: skeletons in final geometry.
- Metadata per page (title, description), OG image per section, Twitter large card.

---

## 12. Responsive

| Width | Behaviour |
|---|---|
| ≥ 1280 | Full layouts, 3-zone Credit, 12 columns |
| 1024 | Credit becomes 2 zones (position panel moves under action) |
| 768 | Single column, rails keep full width, tables scroll with sticky first column |
| 390 | Mobile header and drawer, Board as cards, hero art above the headline cropped 4:5, display sizes per the scale, touch targets 44 px |

Zero horizontal page scroll at any width. Long hashes truncate in the middle with copy.

## 13. Accessibility

AA contrast on every text token pairing used; focus visible on everything interactive; the whole Credit flow keyboard-operable; tx status in `aria-live="polite"`; regime never by colour alone; charts have text equivalents; reduced motion honoured; images have meaningful `alt` or `alt=""` when decorative.
