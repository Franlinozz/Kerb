#!/usr/bin/env python3
"""Draw the Kerb architecture diagram as SVG, in Night and Day palettes.

  python3 scripts/architecture-svg.py

Writes docs/media/architecture-{dark,light}.svg and apps/web/public/architecture-{dark,light}.svg.
One source for the README and the site, so the two never drift. The flow lines animate (CSS in
the SVG), which GitHub and browsers both play inside an <img>; reduced motion stops them.
"""
from pathlib import Path
from html import escape

ROOT = Path(__file__).resolve().parent.parent
W, H = 1600, 1010

PALETTES = {
    "dark": dict(bg="#0B0C0A", panel="#131511", panel2="#181A15", hair="#2B2E27", ink="#ECE8DE", ink2="#A9A69C", ink3="#75736B", brass="#D6A64F", moss="#9DB074", oxide="#C8664B"),
    "light": dict(bg="#F5F2EB", panel="#FFFFFF", panel2="#FBF9F4", hair="#DAD5C8", ink="#16170F", ink2="#55544C", ink3="#8A887F", brass="#A7771E", moss="#5B7340", oxide="#A6462C"),
}

SANS = "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif"
MONO = "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace"


def box(x, y, w, h, title, lines, kind="panel", tag=None):
    """A labelled panel. kind: panel | core | chain | chain2 | consumer."""
    out = [f'<g class="box {kind}">', f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8"/>']
    ty = y + 28
    if tag:
        out.append(f'<text class="tag" x="{x + 16}" y="{y + 22}">{escape(tag)}</text>')
        ty = y + 46
    out.append(f'<text class="title" x="{x + 16}" y="{ty}">{escape(title)}</text>')
    for i, ln in enumerate(lines):
        out.append(f'<text class="line" x="{x + 16}" y="{ty + 22 + i * 19}">{escape(ln)}</text>')
    out.append("</g>")
    return "\n".join(out)


def label(x, y, text, cls="col"):
    return f'<text class="{cls}" x="{x}" y="{y}">{escape(text)}</text>'


def flow(d, cls="flow"):
    return f'<path class="{cls}" d="{d}" marker-end="url(#arrow-{"post" if "post" in cls else "data"})"/>'


def draw(p):
    s = []
    s.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-labelledby="t d">')
    s.append('<title id="t">Kerb architecture</title>')
    s.append('<desc id="d">Market data flows from X Layer pools, OKX DEX quotes, reference prices and exchange calendars into the Kerb collector and an append-only store. The deterministic KTS 0.2 engine turns it into terms and an input bundle; the attester signs and posts them to KerbTerms on X Layer mainnet with the Builder Code. A relay mirrors the terms to X Layer testnet, where Kerb Credit lends against them. Contracts, agents over x402 and MCP, and developers over REST and the SDK read the same terms.</desc>')
    s.append(f"""<defs>
<marker id="arrow-data" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="{p['ink3']}"/></marker>
<marker id="arrow-post" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="{p['brass']}"/></marker>
<pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="{p['hair']}" stroke-width="0.6" opacity="0.45"/></pattern>
</defs>
<style>
.bgc{{fill:{p['bg']}}}
.box rect{{fill:{p['panel']};stroke:{p['hair']};stroke-width:1.2}}
.box.core rect{{fill:{p['panel2']};stroke:{p['ink3']}}}
.box.chain rect{{fill:{p['panel2']};stroke:{p['brass']};stroke-width:1.4}}
.box.chain2 rect{{fill:{p['panel2']};stroke:{p['moss']};stroke-width:1.4}}
.box.consumer rect{{fill:{p['panel']};stroke:{p['hair']}}}
.title{{font:600 16px {SANS};fill:{p['ink']};letter-spacing:-0.01em}}
.line{{font:400 13px {SANS};fill:{p['ink2']}}}
.tag{{font:500 10.5px {MONO};fill:{p['brass']};letter-spacing:0.12em;text-transform:uppercase}}
.chain2 .tag{{fill:{p['moss']}}}
.col{{font:500 11.5px {MONO};fill:{p['ink3']};letter-spacing:0.16em;text-transform:uppercase}}
.head{{font:600 30px {SANS};fill:{p['ink']};letter-spacing:-0.03em}}
.sub{{font:400 15px {SANS};fill:{p['ink2']}}}
.note{{font:400 12px {MONO};fill:{p['ink3']}}}
.flow,.flow-post{{fill:none;stroke-width:1.6;stroke-linecap:round}}
.flow{{stroke:{p['ink3']};stroke-dasharray:5 7}}
.flow-post{{stroke:{p['brass']};stroke-width:2;stroke-dasharray:7 7}}
@media (prefers-reduced-motion:no-preference){{.flow{{animation:run 1.6s linear infinite}}.flow-post{{animation:run 1.1s linear infinite}}}}
@keyframes run{{to{{stroke-dashoffset:-24}}}}
.chip rect{{fill:none;stroke:{p['hair']}}}
.chip text{{font:500 11.5px {MONO};fill:{p['ink2']}}}
.brand-a{{fill:{p['ink']}}}.brand-b{{fill:{p['ink']};opacity:0.5}}
</style>""")
    s.append(f'<rect class="bgc" width="{W}" height="{H}"/><rect width="{W}" height="{H}" fill="url(#grid)"/>')

    # Header with the mark.
    s.append('<g transform="translate(48 40) scale(0.052)"><path class="brand-a" d="M263.4 47.3Q315.0 0.0 385.0 0.0L636.0 0.0Q658.0 0.0 641.7 14.8L390.9 242.0Q339.0 289.0 269.0 289.0L22.0 289.0Q0.0 289.0 16.2 274.1Z"/><path class="brand-b" d="M506.4 171.3Q558.0 124.0 628.0 124.0L832.0 124.0Q854.0 124.0 837.8 138.9L590.6 365.7Q539.0 413.0 469.0 413.0L265.0 413.0Q243.0 413.0 259.2 398.1Z"/></g>')
    s.append(label(100, 62, "Kerb · system architecture", "head"))
    s.append(label(48, 96, "One measured, deterministic term, posted on X Layer and read by a credit market, contracts, agents and code.", "sub"))

    # Column headings.
    cols = [(48, "1 · Sources"), (400, "2 · Measure and compute (off chain, recomputable)"), (948, "3 · Post (X Layer)"), (1300, "4 · Consumers")]
    for x, t in cols:
        s.append(label(x, 150, t))

    # Sources.
    src = [
        ("X Layer pools", ["10 xStocks Uniswap V3 pools", "slot0, liquidity, ticks, every minute"]),
        ("OKX DEX aggregator", ["sell quotes at fixed sizes", "cross-checks the tick-walk"]),
        ("Reference prices", ["xStocks issuer data, Yahoo as a", "second, independent check"]),
        ("Exchange calendars", ["XNYS · XNAS · ARCX · XHKG", "sessions, lunch, DST, holidays"]),
    ]
    for i, (t, ls) in enumerate(src):
        s.append(box(48, 172 + i * 112, 290, 94, t, ls))

    # Core.
    s.append(box(400, 172, 490, 94, "kerb-collector → observation store", ["Postgres, append-only (triggers reject UPDATE and DELETE)", "every row kept; bundles cut from it byte for byte"], "core", "apps/collector"))
    s.append(box(400, 296, 490, 150, "KTS 0.2 engine (pure functions)", ["Clock: regime and the next weakening, per asset", "Depth: C(1%) by tick-walk, the exit that is really there", "Mark: the lower of reference and pool, less a haircut", "Terms: Carry, Session Max, fixed LT, debt ceiling"], "core", "apps/engine · no model, no floats"))
    s.append(box(400, 476, 490, 94, "Input bundle", ["canonical JSON, hashed; anyone recomputes the same", "report byte for byte (kerb verify <hash>)"], "core", "published by the API"))
    s.append(box(400, 600, 490, 94, "kerb-attester", ["guardrails (tighten fast, loosen slow) · EIP-712 sign", "post with Builder Code kt0hl6xyhlx8xmt (ERC-8021)"], "core", "apps/attester"))

    # Chains.
    s.append(box(948, 172, 300, 214, "X Layer mainnet · 196", ["KerbTerms: signed terms + inputs hash", "KerbClock: calendars and regimes", "KerbQuote: max borrow, cure", "   deadline, usability in one call", "KerbMarkFeed × 10: Credit Mark", "   as a Chainlink-shaped feed", "Sourcify exact match, all 34"], "chain", "risk plane · real xStocks"))
    s.append(box(948, 468, 300, 226, "X Layer testnet · 1952", ["KerbCredit: Carry, Session Max,", "   Last Call, public cure", "KerbMirror: mirror collateral", "mUSDG loan asset · demo clock", "kerb-demo-keeper: a standing", "   position to cure every cycle"], "chain2", "credit plane · mirror terms"))

    # Consumers.
    cons = [
        ("Kerb Credit", ["borrow, Last Call, cure on testnet"]),
        ("Any contract", ["KerbQuote and Credit Mark feeds"]),
        ("Agents", ["x402 paid checks · MCP · OKX.AI"]),
        ("Developers", ["REST (no key) · npm i kerb-sdk"]),
        ("People", ["usekerb.xyz · Telegram alerts"]),
    ]
    for i, (t, ls) in enumerate(cons):
        s.append(box(1300, 172 + i * 106, 252, 88, t, ls, "consumer"))

    # Flows: sources to collector.
    for i in range(4):
        y = 219 + i * 112
        s.append(flow(f"M338 {y} C 368 {y}, 368 219, 396 219"))
    s.append(flow("M645 266 L645 292"))
    s.append(flow("M645 446 L645 472"))
    s.append(flow("M645 570 L645 596"))
    # Attester posts to mainnet.
    s.append(flow("M890 647 C 925 647, 915 300, 944 300", "flow-post"))
    # Mirror relay mainnet to testnet.
    s.append(flow("M1098 386 L1098 464", "flow-post"))
    s.append('<text class="note" x="1110" y="430">kerb-mirror-relay</text>')
    # Chains to consumers: the testnet feeds Kerb Credit; mainnet feeds everything else over one bus.
    s.append(flow("M1248 580 H1264 Q1270 580 1270 572 V224 Q1270 216 1278 216 H1296"))
    s.append(f'<path class="flow" d="M1248 280 H1278 Q1286 280 1286 288 V632"/>')
    for y in (322, 428, 534, 640):
        s.append(flow(f"M1286 {y - 8} Q1286 {y} 1294 {y} H1296" if y == 640 else f"M1286 {y} H1296"))

    # Explain and observe band.
    s.append(label(48, 760, "Explain · observe · alert (run beside the core, never in the posting path)"))
    band = [
        ("kerb-attribution", ["why each term moved: horizon,", "volatility, exit cost, caps"]),
        ("kerb-indexer + API", ["events to Postgres, 24 REST", "endpoints, free MCP server"]),
        ("kerb-agents", ["x402 on X Layer through the", "OKX facilitator, USDT0"]),
        ("Market-Time Reports", ["what the market clock did to", "real exit capacity, versioned"]),
        ("Last Call alerts", ["browser notifications and", "@KerbAlertsBot on Telegram"]),
    ]
    bw = 290
    for i, (t, ls) in enumerate(band):
        s.append(box(48 + i * (bw + 12), 776, bw, 94, t, ls))

    # Footer chips.
    chips = ["Chain is canonical", "Postgres is a rebuildable view", "Bundles are the irreplaceable data", "No model near the numbers", "Unaudited · testnet credit"]
    x = 48
    for c in chips:
        w = 16 + len(c) * 7.2
        s.append(f'<g class="chip"><rect x="{x}" y="904" width="{w:.0f}" height="30" rx="15"/><text x="{x + 12}" y="924">{escape(c)}</text></g>')
        x += w + 10
    s.append(f'<g><path class="flow" d="M1236 919 L1276 919"/><text class="note" x="1284" y="923">data</text><path class="flow-post" d="M1336 919 L1376 919"/><text class="note" x="1384" y="923">signed post on chain</text></g>')
    s.append(label(48, 978, "github.com/Franlinozz/Kerb · usekerb.xyz · api.usekerb.xyz", "note"))
    s.append("</svg>")
    return "\n".join(s)


for name, pal in PALETTES.items():
    svg = draw(pal)
    for out in (ROOT / "docs/media" / f"architecture-{name}.svg", ROOT / "apps/web/public" / f"architecture-{name}.svg"):
        out.write_text(svg + "\n")
        print("wrote", out.relative_to(ROOT))
