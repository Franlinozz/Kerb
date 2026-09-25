# Footage Rules

## Source priority

Use sources in this order unless the visual audit proves a reason to change them:

1. `01_HOME_MASTER.mov.mp4`
2. `02_BOARD_LIVE.mov.mp4`
3. `03_ASSET_EXIT_AND_WHY.mov.mp4`
4. `04_KTS_METHOD.mov.mp4`
5. `05_CREDIT_BORROW.mov.mp4`
6. `06_LAST_CALL_AND_CURE.mov.mp4`
7. `07_PROOF.mov.mp4`
8. `08_AGENT_AND_CONTRACT.mov.mp4`
9. `09_RESEARCH_REPORT_2.mov.mp4`
10. `10_HOME_CLOSER.mov.mp4`

Supplementary:
- `06b...mp4`: salvage only
- `11_MINTING...mp4`: setup context only when essential

## Handling dead time

Allowed:
- trim idle cursor time
- remove wallet confirmation waits after the user has clearly signed
- shorten RPC wait
- cut from transaction submitted to transaction confirmed
- speed a passive loading section up to 1.25x when no data meaning changes

Avoid:
- speeding mouse interaction
- speeding the Last Call state change
- cutting away before confirmation
- removing labels that establish testnet or provenance
- hiding errors that materially affected the action

## Cropping

Never stretch UI.

Use letterboxing or proportional crop.

Final frame is 16:9.

If the recording contains browser chrome that adds no credibility, crop it carefully.

Do not crop away:
- network badge
- testnet label when relevant
- regime state
- transaction status
- proof source
- data timestamps when they support a claim

## Replacement footage

If a public read-only clip is poor:
- re-record with a clean browser at 100 percent zoom
- wait for data to settle
- move cursor off the important area
- record 4 seconds of stillness before and after the action
- use dark theme unless the sequence specifically needs light

If 06 is poor:
first attempt to salvage it through trims and crops.
Then inspect 06b.
Only after both fail should a new Last Call transaction sequence be staged.

## Truth preservation

Do not use visual compositing that makes two events appear simultaneous if they did not occur in the same state, unless the edit is clearly a cut and does not alter meaning.

Do not replace the text of a live UI element.

Do not cover a warning, limitation, or testnet badge to make the product appear more production-ready.
