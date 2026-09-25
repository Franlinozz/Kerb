"""The Kerb demo film: edit decision list, motion layer and render entry point.

Every shot names its source recording and in point, both read off the footage audit
(artifacts/demo-video/FOOTAGE_AUDIT.md). Rects are in source pixels of that recording,
so brackets stay locked to the UI through camera moves.

  python kerb_film.py rough   -> artifacts/demo-video/rough_mute.mp4 (1280x720 preview, no audio)
  python kerb_film.py master  -> artifacts/demo-video/video_master_noaudio.mp4
  python kerb_film.py edl     -> docs/demo_video/EDL.json and artifacts/demo-video/final_timeline.json
  python kerb_film.py stills T1 T2 ...  -> review stills at film times
"""
from __future__ import annotations

import json
import sys

import numpy as np

from filmkit import (BRASS, CANVAS, H, INK, INK2, INK3, MOSS, OXIDE, OP_CAM, W, Cam, Ctx, Shot, aa_line, blit,
                     bracket, cam_push, cam_static, chapter, clamp01, custom, dim_all, ease_io, ease_out, fill_rect,
                     gradient_panel, label, ramp, render, rule_mark, spotlight, text_patch, timeline_starts)

ROOT = "/root/kerb"
SC = f"{ROOT}/docs/demo_video_scenes"
V01, V02, V03, V04 = (f"{SC}/01_HOME_MASTER.mov.mp4", f"{SC}/02_BOARD_LIVE.mov.mp4",
                      f"{SC}/03_ASSET_EXIT_AND_WHY.mov.mp4", f"{SC}/04_KTS_METHOD.mov.mp4")
V05, V06, V07 = f"{SC}/05_CREDIT_BORROW.mov.mp4", f"{SC}/06_LAST_CALL_AND_CURE.mov.mp4", f"{SC}/07_PROOF.mov.mp4"
V08, V09, V10 = f"{SC}/08_AGENT_AND_CONTRACT.mov.mp4", f"{SC}/09_RESEARCH_REPORT_2.mov.mp4", f"{SC}/10_HOME_CLOSER.mov.mp4"
CAP_HOME = f"{ROOT}/artifacts/demo-video/captures/home_hero_live.mkv"

WIDE = (98, 120, 1802, 958)       # page area including the right edge up to the scrollbar
FULL = (0, 0, 1920, 1080)

LAST_CALL_FLIP_SRC = 21.967       # 06: NEXT LAST CALL flips to the next cycle (frame diff)
CURED_SRC = 57.867                # 06: "Done" and "Cured kKOx" appear


def base(cx=OP_CAM[0], cy=OP_CAM[1], w=OP_CAM[2]):
    return cam_static(cx, cy, w)


# ------------------------------------------------------------------ bespoke motion pieces
def kts_rail(t0: float) -> custom:
    """Two horizons on one rail. No times, no numbers: the concept only."""
    X0, X1, XL, XD, Y = 250, 1670, 760, 1260, 600

    def draw(img, c: Ctx):
        t = c.t - t0
        if t < 0:
            return
        a = ramp(c.t, t0, c.dur + 1, 0.35, 0.3)
        gradient_panel(img, 0, 120, W, 800, 0.86 * a, "flat")
        p = text_patch("KERB TERMS STANDARD · TWO HORIZONS", "IBMPlexMono-Medium", 22, INK2, 0.2)
        blit(img, p, X0, 318, a)
        # rail
        g = ease_io(t / 0.8)
        aa_line(img, (X0, Y), (X0 + (X1 - X0) * g, Y), INK3, 1.5, a)
        # weak hours hatch and deep session block, like the site's session rail
        if t > 0.5:
            ah = a * ease_out((t - 0.5) / 0.5)
            for x in range(XL + 6, XD, 14):
                aa_line(img, (x, Y - 7), (x + 8, Y + 7), BRASS, 1.2, 0.55 * ah)
            fill_rect(img, (XD, Y - 7, X1 - XD, 14), INK, 0.85 * ah)
        ticks = [(X0, "NOW", MOSS, 0.4), (XL, "LAST CALL", BRASS, 0.6), ((XL + XD) / 2, "WEAK HOURS", INK3, 0.75),
                 (XD, "NEXT DEEP SESSION", INK, 0.9)]
        for x, txt, col, tt in ticks:
            at = a * ease_out((t - tt) / 0.35)
            if at <= 0:
                continue
            if txt != "WEAK HOURS":
                aa_line(img, (x, Y - 14), (x, Y + 14), col, 2.0, at)
            pt = text_patch(txt, "IBMPlexMono-Medium", 21, col, 0.18)
            blit(img, pt, x - (pt.shape[1] / 2 if txt == "WEAK HOURS" else 0), Y + 26, at)
        # Session Max span (short horizon)
        def span(y, xe, col, text, sub, ts):
            k = ease_io((t - ts) / 0.6)
            if k <= 0:
                return
            ak = a * min(1, k * 1.4)
            aa_line(img, (X0, y), (X0 + (xe - X0) * k, y), col, 2.0, ak)
            aa_line(img, (X0, y - 8), (X0, y + 8), col, 2.0, ak)
            if k > 0.98:
                aa_line(img, (xe, y - 8), (xe, y + 8), col, 2.0, ak)
            pt = text_patch(text, "IBMPlexMono-Medium", 23, col, 0.18)
            blit(img, pt, X0, y - 44, ak)
            ps = text_patch(sub, "IBMPlexMono-Regular", 21, INK2, 0.08)
            blit(img, ps, X0 + pt.shape[1] + 20, y - 42, ak * ease_out((t - ts - 0.3) / 0.4))
        span(Y - 70, XL, BRASS, "SESSION MAX", "more credit now · cured back to Carry at Last Call", 1.3)
        span(Y - 150, XD, INK, "CARRY", "sized to survive to the next deep session, untouched", 2.5)
        # fixed liquidation line
        k = ease_io((t - 3.7) / 0.7)
        if k > 0:
            ak = a * min(1, k * 1.4)
            yl = Y + 130
            x = X0
            while x < X0 + (X1 - X0) * k:
                aa_line(img, (x, yl), (min(x + 14, X1), yl), OXIDE, 2.0, ak)
                x += 24
            pt = text_patch("LIQUIDATION LINE · FIXED · SESSIONS NEVER MOVE IT", "IBMPlexMono-Medium", 21, OXIDE, 0.18)
            blit(img, pt, X0, yl + 16, ak)
    return custom(draw)


def proof_strip(t0: float) -> custom:
    nodes = ["INPUT BUNDLE", "KTS 0.2", "TERMS ON X LAYER", "RECOMPUTED · MATCH"]

    def draw(img, c: Ctx):
        t = c.t - t0
        if t < 0:
            return
        a = ramp(c.t, t0, c.dur + 1, 0.35, 0.3)
        gradient_panel(img, 0, 640, W, 900, 0.8 * a, "flat")
        widths = [text_patch(n, "IBMPlexMono-Medium", 22, INK, 0.18).shape[1] + 48 for n in nodes]
        gap = 90
        total = sum(widths) + gap * (len(nodes) - 1)
        x = (W - total) / 2
        y = 740
        for i, (n, wbox) in enumerate(zip(nodes, widths)):
            ti = i * 0.55
            k = ease_out((t - ti) / 0.4)
            if k <= 0:
                break
            last = i == len(nodes) - 1
            col = MOSS if last else INK
            ak = a * k
            for p0, p1 in (((x, y), (x + wbox, y)), ((x + wbox, y), (x + wbox, y + 56)), ((x + wbox, y + 56), (x, y + 56)), ((x, y + 56), (x, y))):
                aa_line(img, p0, p1, col if last else INK3, 1.5, ak)
            pt = text_patch(n, "IBMPlexMono-Medium", 22, col, 0.18)
            blit(img, pt, x + 24, y + 28 - pt.shape[0] / 2, ak)
            if not last:
                kk = ease_io((t - ti - 0.3) / 0.3)
                if kk > 0:
                    x2 = x + wbox + gap * kk
                    aa_line(img, (x + wbox + 10, y + 28), (x2 - 10, y + 28), BRASS, 2.0, a)
                    if kk > 0.95:
                        aa_line(img, (x2 - 10, y + 28), (x2 - 18, y + 21), BRASS, 2.0, a)
                        aa_line(img, (x2 - 10, y + 28), (x2 - 18, y + 35), BRASS, 2.0, a)
            x += wbox + gap
    return custom(draw)


def last_call_seam(t_flip: float) -> custom:
    """At the exact state change a brass seam crosses the frame once, then rests as a rule along the top."""
    def draw(img, c: Ctx):
        t = c.t - t_flip
        if t < 0:
            return
        k = ease_io(t / 0.6)
        x = -10 + (W + 20) * k
        fade = 1 - clamp01((t - 0.6) / 0.5)
        if fade > 0:
            aa_line(img, (x, 0), (x, H), BRASS, 3.0, fade)
            fill_rect(img, (0, 0, max(0, x), H), BRASS, 0.05 * fade)
        aa_line(img, (0, 1.5), (min(W, x), 1.5), BRASS, 3.0, 1.0)
    return custom(draw)


def last_call_tag(T0: float, T1: float) -> custom:
    """Film-time state tag held through the hero sequence."""
    def draw(img, c: Ctx):
        a = ramp(c.T, T0, T1, 0.3, 0.4)
        if a <= 0:
            return
        fill_rect(img, (0, 0, W, 3), BRASS, a)
        p = text_patch("LAST CALL · OPEN", "IBMPlexMono-Medium", 20, BRASS, 0.2)
        p2 = text_patch("DEMO CLOCK · X LAYER TESTNET", "IBMPlexMono-Regular", 17, INK2, 0.16)
        x, y = 72, H - 70
        fill_rect(img, (x - 18, y - 16, 12 + 26 + p.shape[1] + 22 + p2.shape[1] + 18, p.shape[0] + 30), CANVAS, 0.88 * a)
        fill_rect(img, (x, y + p.shape[0] / 2 - 5, 10, 10), BRASS, a)
        blit(img, p, x + 24, y, a)
        blit(img, p2, x + 24 + p.shape[1] + 22, y + 2, a)
    return custom(draw)


def end_url(t0: float) -> custom:
    def draw(img, c: Ctx):
        a = ramp(c.t, t0, c.dur + 1, 0.6, 0.3)
        p = text_patch("usekerb.xyz", "IBMPlexMono-Medium", 24, INK2, 0.14)
        blit(img, p, (W - p.shape[1]) / 2, H - 78, a)
    return custom(draw)


def end_card(T0: float, T1: float) -> custom:
    """As the live page fades to canvas, only the address remains."""
    def draw(img, c: Ctx):
        a = ramp(c.T, T0, T1 + 1, 0.8, 0.1)
        if a <= 0:
            return
        fill_rect(img, (0, 0, W, H), CANVAS, ease_io((c.T - T0) / 1.1))
        a = ramp(c.T, T0 + 0.7, T1 + 1, 0.6, 0.1)
        p = text_patch("usekerb.xyz", "IBMPlexMono-Medium", 30, INK, 0.16)
        blit(img, p, (W - p.shape[1]) / 2, H / 2 - p.shape[0] / 2, a)
        g = ease_io((c.T - T0 - 0.9) / 0.6)
        aa_line(img, (W / 2 - 60 * g, H / 2 + 34), (W / 2 + 60 * g, H / 2 + 34), BRASS, 2.0, a)
    return custom(draw)


def pip(rect=(1446, 0, 474, 965), dest=(745, 108, 870), label_="OKX WALLET · X LAYER TESTNET", t0=0.0, t1=99):
    return {"rect": rect, "dest": dest, "dim": 0.66, "label": label_, "t0": t0, "t1": t1, "fin": 0.25, "fout": 0.2}


# ------------------------------------------------------------------ the edit
# Narration anchors: (segment id, shot name, seconds into that shot). The audio mix reads these.
VO_ANCHORS = [
    ("01_cold_open", "hero", 0.9),
    ("02_board", "board header", 0.9),
    ("03_exit", "method text", 0.45),
    ("04_kts", "term made", 0.45),
    ("05_borrow", "collateral + sm", 0.35),
    ("06a_last_call", "countdown", 0.1),
    ("06b_curable", "countdown", 9.9),
    ("06c_cured", "cured", 0.9),
    ("07_proof", "verifiable", 0.45),
    ("08_consumers", "four consumers", 0.4),
    ("09_research", "report 2", 0.45),
    ("10_close", "limitations", 0.4),
    ("10b_final_line", "thesis", 9.6),
]


def build() -> tuple[list[Shot], list]:
    S: list[Shot] = []
    add = S.append

    # 1 · Cold open: the mismatch (VO 01)
    add(Shot(V10, 0.0, 3.9, cam_push(950, 599, 1704, 960, 590, 1620), speed=0.82, fade_in=0.7, name="hero",
             overlays=[bracket((1455, 262, 285, 170), 1.3, 3.9, pad=12)]))
    add(Shot(V01, 4.85, 4.6, cam_push(950, 600, 1680, 930, 630, 1560), speed=0.45, name="own hours",
             overlays=[bracket((195, 603, 365, 40), 0.9, 4.6, pad=10)]))
    add(Shot(V01, 7.95, 6.2, cam_push(950, 560, 1704, 940, 560, 1600), speed=0.54, name="record",
             overlays=[bracket((698, 508, 372, 100), 1.0, 6.2, pad=12)]))

    # 2 · The Board (VO 02)
    add(Shot(V02, 0.3, 4.4, cam_push(950, 560, 1704, 940, 580, 1560), speed=0.75, trans="seam", tdur=0.55, name="board header",
             overlays=[chapter("01", "THE BOARD", "X LAYER MAINNET · LIVE · 10 ASSETS · 4 MARKETS", 0.4, 4.4),
                       bracket((172, 498, 1540, 90), 1.6, 4.4, pad=12)]))
    add(Shot(V02, 21.6, 3.3, cam_static(940, 590, 1600), name="market per asset",
             overlays=[bracket((195, 200, 300, 40), 0.3, 2.3, pad=8, label="SHEINx · HONG KONG CLOCK", label_side="right")]))
    add(Shot(V02, 8.5, 3.0, cam_push(950, 700, 1680, 940, 700, 1600), name="table",
             overlays=[bracket((476, 640, 110, 400), 0.3, 3.0, pad=8, label="REGIME")]))
    add(Shot(V02, 14.2, 2.4, cam_static(940, 690, 1600), name="table capacity",
             overlays=[bracket((735, 445, 450, 610), 0.2, 2.4, pad=8, label="C(1%) · TERMS")]))
    add(Shot(V02, 31.2, 4.9, cam_push(950, 560, 1704, 900, 600, 1560), speed=0.36, name="hk closed",
             overlays=[bracket((172, 470, 1560, 240), 0.3, 1.9, pad=10, label="HONG KONG · STALE · CLOSED"),
                       rule_mark((172, 850, 945, 26), 1.9, 4.9)]))

    # 3 · Exit capacity (VO 03)
    add(Shot(V04, 17.75, 3.5, cam_push(1082, 640, 1440, 1092, 660, 1400), speed=0.58, trans="seam", tdur=0.5, name="method text",
             overlays=[chapter("02", "EXIT CAPACITY", "UNISWAP V3 TICK-WALK · OKX DEX CROSS-CHECK", 0.3, 3.5),
                       bracket((476, 893, 800, 82), 0.7, 3.5, pad=10)]))
    add(Shot(V04, 8.9, 6.8, cam_push(1095, 660, 1360, 1095, 690, 1260), name="depth curve",
             overlays=[bracket((1320, 640, 260, 90), 5.0, 6.8, pad=10, label="C(1%)")]))
    add(Shot(V03, 20.1, 5.0, cam_push(840, 560, 1420, 800, 520, 1300), speed=0.44, name="exit check",
             overlays=[bracket((195, 415, 920, 78), 0.3, 5.0, pad=12)]))
    add(Shot(V03, 23.9, 3.5, base(), speed=0.43, name="aggregate"))

    # 4 · Kerb Terms (VO 04)
    add(Shot(V01, 12.5, 3.6, cam_push(950, 545, 1704, 960, 552, 1640), speed=0.38, trans="seam", tdur=0.5, name="term made",
             overlays=[chapter("03", "KERB TERMS", "KTS 0.2 · CAPACITY BOUND TO TIME", 0.3, 3.6),
                       bracket((880, 612, 700, 50), 1.2, 3.6, pad=8)]))
    add(Shot(V01, 17.85, 3.8, cam_push(950, 620, 1704, 950, 620, 1660), speed=0.36, name="carry vs sm",
             overlays=[bracket((172, 505, 763, 223), 0.3, 3.8, pad=8, color=INK),
                       bracket((965, 505, 763, 223), 2.0, 3.8, pad=8)]))
    add(Shot(V03, 7.5, 8.4, base(), speed=0.28, base_dim=0.5, name="kts rail", overlays=[kts_rail(0.15)]))
    add(Shot(V03, 15.0, 4.9, cam_push(760, 530, 1400, 760, 540, 1260), name="never the line",
             overlays=[spotlight((172, 390, 845, 215), 0.3, 4.9, amount=0.45),
                       rule_mark((172, 575, 510, 24), 1.0, 4.9)]))

    # 5 · Borrow (VO 05)
    add(Shot(V05, 7.5, 3.5, cam_static(950, 620, 1580), trans="seam", tdur=0.5, name="collateral + sm",
             overlays=[chapter("04", "BORROW", "KERB CREDIT · X LAYER TESTNET · MIRROR COLLATERAL", 0.3, 3.5),
                       bracket((920, 603, 273, 254), 2.55, 3.5, pad=6, label="SESSION MAX")]))
    add(Shot(V05, 12.5, 4.0, cam_push(950, 640, 1704, 950, 660, 1640), name="preview",
             overlays=[spotlight((600, 290, 620, 790), 0.2, 4.0, amount=0.5),
                       bracket((625, 780, 570, 120), 0.8, 4.0, pad=10, label="BEFORE SIGNING")]))
    add(Shot(V05, 19.2, 1.8, cam_static(950, 660, 1640), name="borrow click",
             overlays=[spotlight((600, 290, 620, 790), 0.0, 1.8, amount=0.5, fin=0.01)]))
    add(Shot(V05, 29.9, 1.8, base(), speed=0.85, pip=pip(), name="wallet deposit"))
    add(Shot(V05, 43.8, 1.8, base(), pip=pip(), name="wallet borrow"))
    add(Shot(V05, 48.2, 4.0, cam_static(1046, 599, 1704), speed=0.6, bounds=WIDE, name="position",
             overlays=[spotlight((1255, 225, 480, 700), 0.2, 4.0, amount=0.45),
                       bracket((1265, 245, 440, 110), 0.3, 4.0, pad=10, label="SESSION MAX POSITION"),
                       bracket((1405, 952, 460, 92), 1.0, 4.0, pad=6, color=MOSS)]))

    # 6 · Last Call and Cure (VO 06a, 06b, 06c). Real time at the state changes.
    t_flip = LAST_CALL_FLIP_SRC - 14.4
    # One continuous take: the clock runs out, Last Call opens, the page scrolls to the curable list.
    add(Shot(V06, 14.4, 16.1, Cam([(0, 1400, 560, 1000), (0.47, 1450, 585, 900), (0.49, 1450, 585, 900),
                                    (0.60, 960, 640, 1640), (1, 960, 640, 1640)], ease_io), bounds=WIDE,
             trans="dip", tdur=0.6, name="countdown",
             overlays=[chapter("05", "LAST CALL", "DEMO CLOCK · X LAYER TESTNET", 0.5, 3.6),
                       spotlight((1495, 560, 240, 50), 3.4, t_flip + 0.3, amount=0.4, pad=26),
                       bracket((1495, 560, 240, 50), 3.6, t_flip + 0.9, pad=14),
                       last_call_seam(t_flip),
                       rule_mark((172, 668, 620, 30), 10.1, 13.45, color=INK2),
                       bracket((175, 718, 1510, 56), 13.65, 16.1, pad=12)]))
    add(Shot(V06, 31.3, 3.6, cam_static(950, 560, 1600), name="the excess",
             overlays=[spotlight((175, 548, 1510, 56), 0.0, 3.6, amount=0.5, fin=0.2),
                       bracket((898, 560, 128, 32), 0.15, 3.6, pad=8, label="ABOVE CARRY TARGET", label_side="below"),
                       bracket((1103, 560, 134, 32), 0.6, 3.6, pad=8, label="ONLY THE EXCESS IS DUE", label_side="below", label_dy=30),
                       bracket((1296, 560, 50, 32), 2.8, 3.6, pad=8, label="BONUS")]))
    add(Shot(V06, 41.0, 3.4, base(), name="another wallet cures",
             overlays=[bracket((1428, 138, 245, 32), 0.2, 3.4, pad=6, label="CURER 0xc995…a4dc", label_side="below"),
                       bracket((183, 560, 200, 30), 0.8, 3.4, pad=6, label="SESSION MAX BORROWER", label_side="below")]))
    add(Shot(V06, 52.4, 2.2, base(), speed=0.7, pip=pip(), name="wallet cure"))
    add(Shot(V06, 56.8, 2.6, cam_static(1020, 599, 1704), bounds=WIDE, name="cured",
             overlays=[bracket((172, 628, 250, 70), CURED_SRC - 56.8, 2.6, pad=8, color=MOSS, label="CURED")]))
    add(Shot(V06, 70.6, 1.7, cam_static(880, 690, 1100), bounds=WIDE, name="oklink",
             overlays=[bracket((445, 543, 172, 32), 0.2, 1.7, pad=6, color=MOSS),
                       bracket((450, 890, 745, 66), 0.5, 1.7, pad=6)]))
    add(Shot(V06, 76.4, 6.0, cam_push(950, 720, 1560, 960, 760, 1400), speed=0.18, name="back at carry",
             overlays=[spotlight((172, 805, 1560, 48), 0.0, 6.0, amount=0.45, fin=0.2),
                       bracket((895, 812, 130, 34), 0.3, 6.0, pad=8, color=MOSS, label="BACK AT CARRY TARGET")]))

    # 7 · Proof (VO 07)
    add(Shot(V07, 0.1, 2.4, cam_push(950, 560, 1704, 900, 520, 1560), speed=0.42, trans="seam", tdur=0.5, name="verifiable",
             overlays=[chapter("06", "PROOF", "X LAYER MAINNET · RECOMPUTE ANY TERM", 0.3, 2.4)]))
    add(Shot(V07, 4.8, 3.3, cam_push(950, 640, 1704, 950, 640, 1600), speed=0.7, name="tiles",
             overlays=[bracket((190, 455, 370, 115), 0.2, 3.3, pad=8),
                       bracket((190, 700, 370, 120), 1.2, 3.3, pad=8)]))
    add(Shot(V07, 13.6, 4.4, cam_push(950, 700, 1704, 950, 760, 1560), speed=0.34, name="reproduce",
             overlays=[bracket((172, 600, 960, 90), 0.2, 4.4, pad=8, label="INPUTS HASH ON CHAIN", label_side="right"),
                       bracket((190, 960, 1520, 70), 2.4, 4.4, pad=8, color=MOSS, label="LAST VERIFY · MATCHES")]))
    add(Shot(V01, 23.3, 4.3, base(), speed=0.41, base_dim=0.2, name="verify band", overlays=[proof_strip(0.35)]))
    add(Shot(V07, 5.2, 4.0, cam_push(1150, 560, 1300, 1150, 540, 1200), speed=0.47, name="builder code",
             overlays=[bracket((960, 455, 370, 90), 0.3, 4.0, pad=8, label="KERB BUILDER CODE")]))

    # 8 · Consumers (VO 08)
    add(Shot(V01, 15.25, 4.6, cam_push(950, 540, 1704, 950, 556, 1640), speed=0.245, trans="seam", tdur=0.5, name="four consumers",
             overlays=[chapter("07", "ONE TERM, FOUR CONSUMERS", "CREDIT · AGENTS · CONTRACTS · DEVELOPERS", 0.3, 4.6),
                       bracket((172, 600, 360, 190), 1.6, 4.6, pad=8, label="REFERENCE CONSUMER"),
                       bracket((590, 600, 1140, 190), 3.2, 4.6, pad=8)]))
    add(Shot(V08, 0.8, 3.4, cam_static(950, 639, 1560), speed=0.82, name="x402",
             overlays=[bracket((700, 905, 390, 34), 0.3, 3.4, pad=8, label="AGENTS · x402 ON X LAYER MAINNET", label_side="right")]))
    add(Shot(V08, 25.6, 3.3, cam_push(950, 560, 1704, 900, 520, 1560), speed=0.46, name="kerbquote",
             overlays=[bracket((172, 375, 860, 32), 0.3, 3.3, pad=8, label="CONTRACTS · KERBQUOTE ON X LAYER MAINNET", label_side="right")]))
    add(Shot(V08, 8.9, 2.9, base(), speed=0.8, name="mcp build"))
    add(Shot(V08, 13.0, 4.0, base(), speed=0.7, name="endpoints"))

    # 9 · Evidence (VO 09)
    add(Shot(V09, 6.7, 5.0, cam_push(950, 560, 1704, 900, 580, 1560), speed=0.56, trans="seam", tdur=0.5, name="report 2",
             overlays=[chapter("08", "EVIDENCE", "MARKET-TIME REPORT #2 · 48 H · 15 POOLS", 0.3, 3.6),
                       bracket((172, 600, 1260, 110), 1.8, 5.0, pad=10)]))
    add(Shot(V09, 14.7, 6.0, cam_static(900, 780, 1500), speed=0.3, name="held then fell",
             overlays=[bracket((250, 780, 60, 270), 0.4, 6.0, pad=8, label="HELD AT 07:00"),
                       bracket((985, 780, 150, 270), 5.4, 6.0, pad=8, color=OXIDE, label="A DAY LATER")]))
    add(Shot(V09, 11.4, 4.2, base(), speed=0.47, name="by pool"))
    add(Shot(V09, 18.6, 5.5, base(), speed=0.236, name="every capture"))

    # 10 · Close (VO 10, then the final line)
    add(Shot(V07, 17.0, 8.4, cam_push(950, 600, 1704, 900, 640, 1560), speed=0.36, trans="seam", tdur=0.5, name="limitations",
             overlays=[bracket((172, 722, 1060, 40), 0.6, 8.4, pad=8, label="TESTNET CREDIT · MAINNET RISK PLANE"),
                       bracket((172, 893, 1270, 30), 4.2, 8.4, pad=8, label="UNAUDITED")]))
    add(Shot(CAP_HOME, 0.4, 15.6, cam_push(960, 540, 1920, 820, 600, 1640), matrix="bt601", bounds=FULL, trans="fade",
             tdur=0.8, name="thesis",
             overlays=[rule_mark((70, 1004, 490, 22), 9.7, 15.6, color=BRASS)]))

    starts = timeline_starts(S)
    names = [s.name for s in S]
    hero_start = starts[names.index("countdown")]
    k = names.index("back at carry")
    total = starts[-1] + S[-1].dur
    globals_ = [last_call_tag(hero_start + t_flip, starts[k] + S[k].dur), end_card(total - 2.6, total)]
    return S, globals_


def vo_schedule(S: list[Shot]) -> list[tuple[str, float]]:
    starts = timeline_starts(S)
    names = [s.name for s in S]
    return [(seg, round(starts[names.index(shot)] + off, 3)) for seg, shot, off in VO_ANCHORS]


def render_parallel(S, G, out: str, preview: bool, nproc: int = 5) -> float:
    import subprocess, os, math as _m
    starts = timeline_starts(S)
    total = starts[-1] + S[-1].dur
    nfr = int(round(total * 30))
    cuts = [int(round(nfr * i / nproc)) for i in range(nproc + 1)]
    tmp = out + ".parts"
    os.makedirs(tmp, exist_ok=True)
    procs = []
    for i in range(nproc):
        part = f"{tmp}/part{i:02d}.mp4"
        procs.append(subprocess.Popen([sys.executable, __file__, "chunk", "1" if preview else "0", str(cuts[i] / 30), str(cuts[i + 1] / 30), part],
                                      stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
    for p in procs:
        p.wait()
    with open(f"{tmp}/list.txt", "w") as f:
        for i in range(nproc):
            f.write(f"file 'part{i:02d}.mp4'\n")
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", f"{tmp}/list.txt",
                    "-c", "copy", "-movflags", "+faststart", out], check=True)
    return total


def edl_json(S: list[Shot]) -> dict:
    starts = timeline_starts(S)
    rows = []
    for i, (s, st) in enumerate(zip(S, starts)):
        rows.append({
            "id": f"S{i + 1:02d}", "name": s.name, "final_start": round(st, 3), "final_end": round(st + s.dur, 3),
            "source": s.src.replace(ROOT + "/", ""), "source_in": round(s.t_in, 3),
            "source_out": round(s.t_in + s.dur * s.speed, 3), "speed": s.speed,
            "transition_in": s.trans if i else "fade from canvas", "transition_seconds": s.tdur,
        })
    return {"status": "EDIT_LOCKED", "fps": 30, "resolution": "1920x1080",
            "runtime_seconds": round(starts[-1] + S[-1].dur, 3), "shots": rows}


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "rough"
    S, G = build()
    out_dir = f"{ROOT}/artifacts/demo-video"
    if mode == "chunk":
        preview, t0, t1, part = sys.argv[2] == "1", float(sys.argv[3]), float(sys.argv[4]), sys.argv[5]
        render(S, part, G, preview=preview, t_from=t0, t_to=t1, log=lambda *_: None)
    elif mode == "rough":
        t = render_parallel(S, G, f"{out_dir}/rough_mute.mp4", preview=True)
        print(f"rough cut {t:.2f}s")
    elif mode == "master":
        t = render_parallel(S, G, f"{out_dir}/video_master_noaudio.mp4", preview=False)
        print(f"master video {t:.2f}s")
    elif mode == "vo":
        print(json.dumps(vo_schedule(S)))
    elif mode == "edl":
        d = edl_json(S)
        d["narration"] = [{"segment": a, "start": b} for a, b in vo_schedule(S)]
        if len(sys.argv) > 2 and sys.argv[2] == "write":
            json.dump(d, open(f"{ROOT}/docs/demo_video/EDL.json", "w"), indent=2)
        print(json.dumps({k: v for k, v in d.items() if k not in ("shots", "narration")}))
        for r in d["shots"]:
            print(f"{r['id']} {r['final_start']:7.2f}-{r['final_end']:7.2f} {r['name']:<22} {r['source'].split('/')[-1][:24]:<24} {r['source_in']:6.2f}-{r['source_out']:6.2f} x{r['speed']}")
        for n in d["narration"]:
            print("VO", n)
    elif mode == "stills":
        import subprocess
        for T in sys.argv[2:]:
            T = float(T)
            render(S, "/tmp/kerb_still.mp4", G, preview=False, t_from=T, t_to=T + 1 / 30, log=lambda *_: None)
            subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", "/tmp/kerb_still.mp4", "-frames:v", "1",
                            f"{out_dir}/stills/film_{T:07.2f}.png"])
            print(f"{out_dir}/stills/film_{T:07.2f}.png")
