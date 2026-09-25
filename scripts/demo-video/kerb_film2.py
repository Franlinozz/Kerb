"""The Kerb demo film, v2.

Every recording plays in one designed browser window on Kerb's own art. Time is set by the narration:
each take, card, tag and graphic is placed on a spoken word (ASR word timestamps of the takes).

  python kerb_film2.py master|rough      render (parallel chunks)
  python kerb_film2.py stills T ...      review stills
  python kerb_film2.py plan              print the timeline
  python kerb_film2.py export            write vo_plan.json, EDL and timeline for the audio and captions
"""
from __future__ import annotations

import json
import math
import os
import subprocess
import sys

import cv2
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from filmkit import (BRASS, CANVAS, FPS, H, INK, INK2, INK3, MOSS, OLIVE, OXIDE, W, Encoder, aa_line, blit, clamp01,  # noqa: E402
                     ease_io, ease_out, fill_rect, gradient_panel, text_patch)
from filmkit2 import (BAR, FULL_CROP, OP_CROP, RADIUS, WBH, WBW, WBX, WBY, WH, WW, WX, WY, Card, Tag, Take,  # noqa: E402
                      TakeReader, backdrop_frame, bar_image, blit_local, brand_rgba, ease_in, hairline_rect,
                      label_pill, lerp, paste_rounded, round_mask, shadow)

ROOT = "/root/kerb"
SC = f"{ROOT}/docs/demo_video_scenes"
V01, V02, V03, V04 = (f"{SC}/01_HOME_MASTER.mov.mp4", f"{SC}/02_BOARD_LIVE.mov.mp4",
                      f"{SC}/03_ASSET_EXIT_AND_WHY.mov.mp4", f"{SC}/04_KTS_METHOD.mov.mp4")
V05, V06, V07 = f"{SC}/05_CREDIT_BORROW.mov.mp4", f"{SC}/06_LAST_CALL_AND_CURE.mov.mp4", f"{SC}/07_PROOF.mov.mp4"
V08, V09, V10 = f"{SC}/08_AGENT_AND_CONTRACT.mov.mp4", f"{SC}/09_RESEARCH_REPORT_2.mov.mp4", f"{SC}/10_HOME_CLOSER.mov.mp4"
CAP_HOME = f"{ROOT}/artifacts/demo-video/captures/home_hero_live.mkv"
VOICE = f"{ROOT}/artifacts/demo-video/voice"

LAST_CALL_FLIP_SRC = 21.967
CURED_SRC = 57.867


# ------------------------------------------------------------------ narration placement
class VO:
    def __init__(self):
        self.asr = json.load(open(f"{VOICE}/asr.json"))
        self.clips = []
        self._dur = {}

    def dur(self, seg):
        if seg not in self._dur:
            out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                                  f"{VOICE}/{seg}.mp3"], capture_output=True, text=True).stdout
            self._dur[seg] = float(out)
        return self._dur[seg]

    def _bounds(self, seg, wf, wt):
        w = self.asr[seg]["words"]
        cut_from = 0.0 if wf == 0 else (w[wf - 1]["e"] + w[wf]["s"]) / 2
        cut_to = min(self.dur(seg), w[wt]["e"] + 0.4) if wt == len(w) - 1 else (w[wt]["e"] + w[wt + 1]["s"]) / 2
        return cut_from, cut_to

    def at(self, seg, wf, wt, T):
        """Word wf of seg starts at film time T."""
        cf, ct = self._bounds(seg, wf, wt)
        w = self.asr[seg]["words"]
        self.clips.append(dict(seg=seg, wf=wf, wt=wt, cut_from=cf, cut_to=ct, place=T - (w[wf]["s"] - cf)))

    def gap(self, seg, wf, wt, g):
        self.at(seg, wf, wt, self.end() + g)

    def end_at(self, seg, wf, wt, T_end):
        """Word wt of seg ends at film time T_end."""
        w = self.asr[seg]["words"]
        self.at(seg, wf, wt, T_end - (w[wt]["e"] - w[wf]["s"]))

    def end(self):
        c = self.clips[-1]
        return c["place"] + self.asr[c["seg"]]["words"][c["wt"]]["e"] - c["cut_from"]

    def W(self, seg, i):
        for c in self.clips:
            if c["seg"] == seg and c["wf"] <= i <= c["wt"]:
                return c["place"] + self.asr[seg]["words"][i]["s"] - c["cut_from"]
        raise KeyError((seg, i))

    def WE(self, seg, i):
        for c in self.clips:
            if c["seg"] == seg and c["wf"] <= i <= c["wt"]:
                return c["place"] + self.asr[seg]["words"][i]["e"] - c["cut_from"]
        raise KeyError((seg, i))

    def spans(self):
        out = []
        for c in self.clips:
            w = self.asr[c["seg"]]["words"]
            out.append((c["place"] + w[c["wf"]]["s"] - c["cut_from"], c["place"] + w[c["wt"]]["e"] - c["cut_from"]))
        return out


# ------------------------------------------------------------------ the film
class Film:
    def __init__(self):
        v = self.vo = VO()
        v.at("01_cold_open", 0, 6, 1.4)
        v.gap("01_cold_open", 7, 19, 0.8)
        v.gap("01_cold_open", 20, 32, 1.4)
        v.gap("02_board", 0, 40, 1.6)
        v.gap("03_exit", 0, 42, 1.35)
        v.gap("04_kts", 0, 49, 1.35)
        v.gap("05_borrow", 0, 35, 1.5)
        self.T_cd = v.end() + 2.3
        self.CD0 = 16.0
        self.FLIP = self.T_cd + (LAST_CALL_FLIP_SRC - self.CD0)
        v.end_at("06a_last_call", 0, 5, self.FLIP - 0.35)
        v.at("06a_last_call", 6, 16, self.FLIP + 1.6)
        self.T_row = self.T_cd + (28.0 - self.CD0)
        v.at("06b_curable", 0, 11, max(v.end() + 0.55, self.T_row + 0.4))
        v.gap("06b_curable", 12, 16, 0.6)
        v.gap("06b_curable", 17, 27, 0.55)
        self.T_cure = v.W("06b_curable", 17) - 0.35
        self.T_wal = self.T_cure + 3.2
        self.T_curedtake = self.T_wal + 2.1
        self.CURED = self.T_curedtake + (CURED_SRC - 56.8)
        v.at("06c_cured", 0, 24, self.CURED + 0.35)
        v.gap("07_proof", 0, 45, 1.6)
        v.gap("08_consumers", 0, 39, 1.35)
        v.gap("09_research", 0, 50, 1.35)
        v.gap("10_close", 0, 23, 1.4)
        v.gap("10_close", 24, 41, 0.9)
        v.gap("10b_final_line", 0, 6, 1.7)
        self.END = v.end() + 4.4
        self.build()

    # --------------------------------------------------------------
    def build(self):
        v, W_ = self.vo, self.vo.W
        T = []
        self.takes = T

        def take(name, src, url, start, remap, tail=1.0, crop=OP_CROP, matrix="bt709", xfade=0.45):
            t = Take(name, src, url, remap, tail, crop, matrix, xfade, start)
            T.append(t)
            return t

        # Cold open: the window rises on "on X Layer"
        self.WIN_IN = W_("01_cold_open", 30) - 0.1
        take("home", V10, "usekerb.xyz", self.WIN_IN, [(0, 0.0)], tail=0.62, xfade=0.0)
        b1 = take("board1", V02, "usekerb.xyz/board", W_("02_board", 0) - 0.35, [(0, 0.3)], tail=0.85)
        take("board2", V02, "usekerb.xyz/board", W_("02_board", 6) - 0.25, [(0, 21.55), (7.85, 29.4)], tail=0.55)
        take("exit1", V04, "usekerb.xyz/methodology", W_("03_exit", 0) - 0.5,
             [(0, 8.6), (7.1, 15.7), (8.0, 16.6)], tail=0.45)
        take("exit2", V03, "usekerb.xyz/asset/KOx", W_("03_exit", 28) - 0.45, [(0, 20.1)], tail=0.34)
        take("terms1", V01, "usekerb.xyz", W_("04_kts", 0) - 0.6, [(0, 12.5)], tail=0.12)
        take("terms2", V03, "usekerb.xyz/asset/KOx", W_("04_kts", 43) - 0.4, [(0, 7.5)], tail=0.45)
        take("borrow1", V05, "usekerb.xyz/credit", W_("05_borrow", 0) - 0.8,
             [(0, 7.5), (3.6, 11.1), (4.2, 11.7), (5.9, 14.3), (10.5, 19.6), (11.7, 20.8)], tail=0.6)
        take("wal1", V05, "usekerb.xyz/credit", W_("05_borrow", 29) - 0.5, [(0, 29.9)], tail=0.85, xfade=0.2)
        take("wal2", V05, "usekerb.xyz/credit", W_("05_borrow", 29) - 0.5 + 1.8, [(0, 43.8)], tail=1.0, xfade=0.2)
        take("position", V05, "usekerb.xyz/credit", W_("05_borrow", 29) - 0.5 + 3.6, [(0, 48.2)], tail=0.55, xfade=0.25)
        take("countdown", V06, "usekerb.xyz/credit", self.T_cd,
             [(0, self.CD0), (28.0 - self.CD0, 28.0), (28.8 - self.CD0, 30.45), (29.6 - self.CD0, 31.25)], tail=0.5)
        take("cure", V06, "usekerb.xyz/credit", self.T_cure, [(0, 41.0)], tail=1.0, xfade=0.3)
        take("walcure", V06, "usekerb.xyz/credit", self.T_wal, [(0, 52.4)], tail=0.72, xfade=0.2)
        take("cured", V06, "usekerb.xyz/credit", self.T_curedtake, [(0, 56.8)], tail=1.0, xfade=0.2)
        take("carry", V06, "usekerb.xyz/credit", W_("06c_cured", 9) - 0.4, [(0, 76.4)], tail=0.2)
        take("proof1", V07, "usekerb.xyz/proof", W_("07_proof", 0) - 0.8, [(0, 0.1)], tail=0.36)
        take("proof2", V07, "usekerb.xyz/proof", W_("07_proof", 4) - 0.35, [(0, 4.8)], tail=0.36)
        take("proof3", V07, "usekerb.xyz/proof", W_("07_proof", 27) - 0.35, [(0, 13.6)], tail=0.3)
        take("proof4", V07, "usekerb.xyz/proof", W_("07_proof", 38) - 0.35, [(0, 5.2)], tail=0.4)
        take("con1", V01, "usekerb.xyz", W_("08_consumers", 0) - 0.8, [(0, 15.25)], tail=0.2)
        take("con2", V08, "usekerb.xyz/developers#agents", W_("08_consumers", 14) - 0.4, [(0, 0.8)], tail=0.62)
        take("con3", V08, "usekerb.xyz/developers#agents", W_("08_consumers", 22) - 0.4, [(0, 25.6)], tail=0.45)
        take("con4", V08, "usekerb.xyz/developers#agents", W_("08_consumers", 30) - 0.4,
             [(0, 8.9), (2.3, 11.2), (4.0, 13.0)], tail=0.7)
        take("ev1", V09, "usekerb.xyz/research/2", W_("09_research", 0) - 0.8, [(0, 6.7)], tail=0.5)
        take("ev2", V09, "usekerb.xyz/research/2", W_("09_research", 7) - 0.35, [(0, 14.7)], tail=0.12)
        take("ev3", V09, "usekerb.xyz/research/2", W_("09_research", 42) - 0.35, [(0, 18.6)], tail=0.28)
        take("lim", V07, "usekerb.xyz/proof", W_("10_close", 0) - 0.8, [(0, 17.2)], tail=0.33)
        take("home2", CAP_HOME, "usekerb.xyz", W_("10_close", 24) - 0.5, [(0, 0.4)], tail=1.0,
             crop=FULL_CROP, matrix="bt601")
        for a, b in zip(T, T[1:]):
            a.end = b.start
        T[-1].end = self.END
        self.by = {t.name: t for t in T}

        # Overlay takes (used by cards only)
        self.overlay = {
            "oklink": Take("oklink", V06, "", [(0, 70.6)], 0.8, OP_CROP, "bt709", 0, W_("06c_cured", 3) - 0.35),
        }
        self.overlay["oklink"].end = W_("06c_cured", 9) - 0.45

        # Last Call state
        self.HERO_END = self.by["carry"].end
        # The close: fly into the arch
        self.FLY0 = W_("10_close", 32) + 0.35
        self.FLY1 = self.FLY0 + 2.6

        # ---------------- cards and tags
        C = self.cards = []
        G = self.tags = []
        K = self.by

        # Board
        C.append(Card("board1", (165, 712, 1575, 172), W_("02_board", 3), K["board1"].end - 0.1))
        C.append(Card("board2", (165, 188, 1575, 182), W_("02_board", 7) - 0.1, W_("02_board", 17) - 0.25))
        C.append(Card("board2", (838, 418, 470, 600), W_("02_board", 19), W_("02_board", 22) - 0.3,
                      dest=(1395, 596, 1.28), label="C(1%) · TERMS · DEBT CEILING", dim=0.55))
        C.append(Card("board2", (165, 772, 1110, 118), W_("02_board", 34) - 0.1, K["board2"].end - 0.05,
                      label="POSTED ON X LAYER MAINNET · CHAIN 196"))
        # Exit capacity
        self.c1_point = ("exit1", (1449, 688))
        C.append(Card("exit2", (188, 402, 1552, 112), W_("03_exit", 29), K["exit2"].end - 0.1))
        # Kerb Terms
        C.append(Card("terms1", (698, 595, 1040, 78), W_("04_kts", 4), W_("04_kts", 10) - 0.9))
        C.append(Card("terms2", (160, 640, 1580, 128), W_("04_kts", 44), K["terms2"].end - 0.1))
        G.append(Tag("terms2", (1215, 668), "FIXED", W_("04_kts", 46), K["terms2"].end - 0.1, dx=150, dy=-2, color=OXIDE,
                     lift_card=len(C) - 1))
        # Borrow
        C.append(Card("borrow1", (620, 595, 585, 270), W_("05_borrow", 3) - 0.1, W_("05_borrow", 6) - 0.2,
                      dest=(960, 590, 1.55), label="TWO HORIZONS · CHOOSE ONE", dim=0.5))
        C.append(Card("borrow1", (612, 770, 600, 138), max(W_("05_borrow", 9), K["borrow1"].start + 6.05), W_("05_borrow", 22) - 0.2,
                      dest=(960, 640, 1.6), label="BEFORE SIGNING", dim=0.55))
        C.append(Card("borrow1", (915, 372, 288, 265), W_("05_borrow", 23) - 0.15, K["borrow1"].end - 0.1,
                      dest=(960, 560, 1.6), label="SESSION MAX · THE COVENANT", dim=0.55))
        pip = dict(dest=(1230, 578, 0.92), label="OKX WALLET · X LAYER TESTNET", dim=0.76, fin=0.35, fout=0.2)
        C.append(Card("wal1", (1446, 0, 474, 965), K["wal1"].start + 0.05, K["wal1"].end, **pip))
        C.append(Card("wal2", (1446, 0, 474, 965), K["wal2"].start, K["wal2"].end, **{**pip, "fin": 0.01}))
        C.append(Card("position", (1255, 228, 480, 690), K["position"].start + 0.3, K["position"].end - 0.1,
                      label="SESSION MAX POSITION · OPEN"))
        # Last Call
        cd = K["countdown"]
        C.append(Card("countdown", (1486, 550, 244, 84), cd.start + 0.7, self.FLIP + 1.25, dest=(960, 575, 2.45),
                      label="NEXT LAST CALL · DEMO CLOCK", label_color=INK2, label_after=(self.FLIP, "LAST CALL · OPEN", BRASS),
                      dim=0.64, fin=0.6))
        C.append(Card("countdown", (170, 544, 1520, 62), self.T_row + 1.7, cd.end + 0.3, lift=1.03, dim=0.42, fout=0.3))
        rowc = len(C) - 1
        G.append(Tag("countdown", (962, 606), "ABOVE ITS CARRY TARGET", W_("06b_curable", 6), cd.end + 0.25, dy=52,
                     lift_card=rowc))
        G.append(Tag("countdown", (1172, 606), "ONLY THE EXCESS IS DUE", W_("06b_curable", 12), cd.end + 0.25, dy=104,
                     lift_card=rowc))
        C.append(Card("cure", (170, 544, 1520, 62), K["cure"].start, K["cure"].end, lift=1.03, dim=0.42, fin=0.3))
        rowc2 = len(C) - 1
        G.append(Tag("cure", (1552, 172), "CURER · 0xc995…a4dc", K["cure"].start + 0.2, K["cure"].end, dx=-40, dy=60))
        G.append(Tag("cure", (283, 606), "BORROWER · 0xaccd…c0f4", K["cure"].start + 0.4, K["cure"].end, dy=58,
                     lift_card=rowc2))
        G.append(Tag("cure", (1320, 606), "1.5% CURE BONUS", W_("06b_curable", 24) - 0.1, K["cure"].end, dy=58,
                     lift_card=rowc2))
        C.append(Card("walcure", (1446, 0, 474, 965), K["walcure"].start + 0.05, K["walcure"].end, **pip))
        C.append(Card("cured", (170, 626, 265, 76), self.CURED + 0.05, W_("06c_cured", 3) - 0.2, dest=(700, 600, 2.0),
                      label="CURE CONFIRMED", label_color=MOSS, dim=0.5))
        C.append(Card("oklink", (98, 120, 1704, 958), self.overlay["oklink"].start, self.overlay["oklink"].end,
                      dest=(1010, 612, 0.64), kind="window", url="oklink.com/x-layer-testnet/tx/0x2c16…836e", dim=0.62,
                      fin=0.45, fout=0.3))
        C.append(Card("carry", (170, 795, 1520, 70), K["carry"].start + 0.3, K["carry"].end - 0.1, lift=1.03, dim=0.42))
        G.append(Tag("carry", (962, 864), "BACK AT ITS CARRY TARGET", W_("06c_cured", 10), K["carry"].end - 0.1, dy=54,
                     color=MOSS, lift_card=len(C) - 1))
        C.append(Card("carry", (915, 318, 330, 52), W_("06c_cured", 20) - 0.1, K["carry"].end - 0.1, dim=0.0,
                      label="kKOx LIQUIDATION LINE · FIXED", label_color=OXIDE))
        # Proof
        C.append(Card("proof2", (168, 438, 396, 208), W_("07_proof", 4), W_("07_proof", 11) - 0.25))
        C.append(Card("proof2", (168, 688, 396, 185), W_("07_proof", 11), W_("07_proof", 18) - 0.5))
        C.append(Card("proof3", (168, 908, 1565, 128), W_("07_proof", 31), K["proof3"].end - 0.1,
                      label="RECOMPUTED FROM THE BUNDLE · COMPARED WITH THE POSTED TRANSACTION"))
        C.append(Card("proof4", (948, 438, 394, 208), W_("07_proof", 41) - 0.1, K["proof4"].end - 0.1,
                      dest=(960, 590, 1.75), label="KERB BUILDER CODE", dim=0.55))
        # Consumers
        C.append(Card("con1", (163, 588, 388, 200), W_("08_consumers", 6) - 0.1, K["con1"].end - 0.1,
                      label="THE REFERENCE CONSUMER"))
        C.append(Card("con2", (160, 890, 1000, 158), W_("08_consumers", 15), K["con2"].end - 0.1,
                      label="AGENTS · PAY PER CALL"))
        C.append(Card("con3", (163, 368, 880, 44), W_("08_consumers", 22) + 0.1, K["con3"].end - 0.1,
                      label="CONTRACTS · ONE READ"))
        # Evidence
        C.append(Card("ev2", (163, 740, 808, 302), W_("09_research", 13) - 0.2, W_("09_research", 21) - 0.3,
                      dest=(740, 600, 1.2), label="24 SEP · 06:55 AND 07:05 UTC · HELD", dim=0.55))
        C.append(Card("ev2", (985, 740, 218, 302), W_("09_research", 21) - 0.1, W_("09_research", 32) - 0.35,
                      dest=(1180, 600, 1.55), label="A DAY LATER · 25 SEP 07:00 UTC", dim=0.55))
        C.append(Card("ev1", (163, 598, 1275, 118), W_("09_research", 32) - 0.2, K["ev2"].end - 0.1,
                      dest=(960, 600, 1.1), still=("ev1", 8.4), label="MARKET-TIME REPORT #2 · FINAL", dim=0.6))
        # Where it runs
        C.append(Card("lim", (163, 712, 1585, 66), W_("10_close", 0), W_("10_close", 19) - 0.2))
        C.append(Card("lim", (163, 884, 1585, 48), W_("10_close", 19) - 0.1, K["lim"].end - 0.1))

        # graphic windows that dim the page: (T0, T1, dim, blur)
        self.gdim = [
            (W_("04_kts", 10) - 0.75, W_("04_kts", 43) - 0.35, 0.82, 1.0),
            (W_("07_proof", 18) - 0.35, W_("07_proof", 27) - 0.3, 0.72, 0.6),
        ]
        self.chapters = [
            (K["board1"].start, "01", "The Board", "X LAYER MAINNET · LIVE"),
            (K["exit1"].start, "02", "Exit capacity", "UNISWAP V3 TICK-WALK · OKX DEX CROSS-CHECK"),
            (K["terms1"].start, "03", "Kerb Terms", "KTS 0.2 · CAPACITY BOUND TO TIME"),
            (K["borrow1"].start, "04", "Borrow", "KERB CREDIT · X LAYER TESTNET · MIRROR COLLATERAL"),
            (K["countdown"].start, "05", "Last Call", "DEMO CLOCK · X LAYER TESTNET"),
            (K["proof1"].start, "06", "Proof", "RECOMPUTE ANY TERM · X LAYER MAINNET"),
            (K["con1"].start, "07", "Four consumers", "CREDIT · AGENTS · CONTRACTS · DEVELOPERS"),
            (K["ev1"].start, "08", "Evidence", "MARKET-TIME REPORT #2 · 48 H · 15 POOLS"),
            (K["lim"].start, "09", "Where it runs", "MAINNET RISK PLANE · TESTNET CREDIT"),
        ]

    # ------------------------------------------------------------------ helpers
    def active_takes(self, T):
        out = []
        for i, t in enumerate(self.takes):
            nxt = self.takes[i + 1] if i + 1 < len(self.takes) else None
            end = t.end + (nxt.xfade if nxt else 0)
            if t.start - 1e-9 <= T < end:
                out.append(t)
        return out

    def window_state(self, T):
        """(opacity, dy, scale, ox, oy) of the window."""
        a = clamp01((T - self.WIN_IN) / 1.0)
        op = ease_out(a)
        dy = 70 * (1 - ease_out(a))
        s, ox, oy = 1.0, 0.0, 0.0
        if T > self.FLY0:
            f = clamp01((T - self.FLY0) / (self.FLY1 - self.FLY0))
            e = ease_in(f) * 0.55 + ease_io(f) * 0.45
            s = 1 + 1.35 * e
            # push towards the art on the right of the live Home
            ox, oy = -330 * e, -40 * e
            op *= 1 - clamp01((f - 0.45) / 0.5)
        return op, dy, s, ox, oy


# ------------------------------------------------------------------ rendering
class Renderer:
    def __init__(self, film: Film):
        self.f = film
        self.readers = {}
        self.stills = {}

    def reader(self, take, T, t_to):
        key = take.name
        r = self.readers.get(key)
        if r is None:
            r = TakeReader(take, T, t_to)
            self.readers[key] = r
        return r

    def frame_of(self, name, T):
        f = self.f
        t = f.by.get(name) or f.overlay.get(name)
        s = t.src_t(max(T, t.start))
        end = t.end + 1.0
        return self.reader(t, max(T, t.start), end).frame(s)

    def still(self, name, s):
        key = (name, s)
        if key not in self.stills:
            t = self.f.by.get(name) or self.f.overlay.get(name)
            raw = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-ss", f"{s:.3f}", "-i", t.src, "-frames:v", "1",
                                  "-vf", f"scale=in_color_matrix={t.matrix}:in_range=tv:out_range=pc,format=bgr24",
                                  "-f", "rawvideo", "-"], capture_output=True).stdout
            self.stills[key] = np.frombuffer(raw, np.uint8).reshape(H, W, 3)
        return self.stills[key]

    def gc(self, T):
        f = self.f
        for name in list(self.readers):
            t = f.by.get(name) or f.overlay.get(name)
            if T > t.end + 1.2:
                self.readers[name].close()
                del self.readers[name]

    # ------------------------------------------------------------------
    def content(self, take, T):
        fr = self.frame_of(take.name, T)
        x, y, w, h = take.crop
        return cv2.resize(fr[y:y + h, x:x + w], (WW, WH), interpolation=cv2.INTER_AREA)

    def window_image(self, T):
        f = self.f
        act = self.active_takes_render(T)
        if not act:
            return None, None
        cur = act[-1]
        img = np.empty((WBH, WBW, 3), np.uint8)
        c = self.content(cur, T)
        url = cur.url
        if len(act) == 2 and cur.xfade > 0:
            p = ease_io((T - cur.start) / cur.xfade)
            prev = self.content(act[0], T)
            c = cv2.addWeighted(c, p, prev, 1 - p, 0)
            if p < 0.5:
                url = act[0].url
        img[:BAR] = bar_image(url)
        img[BAR:] = c
        return img, cur

    def active_takes_render(self, T):
        return self.f.active_takes(T)

    # ------------------------------------------------------------------
    def card_q(self, c, T):
        if T < c.T0 or T > c.T1:
            return 0.0
        a = ease_out((T - c.T0) / c.fin) if c.fin > 0.02 else 1.0
        b = ease_out((c.T1 - T) / c.fout) if c.fout > 0.02 else 1.0
        return min(a, b)

    def card_geom(self, c, q, T):
        """Output rect (x, y, w, h) of card c at progress q."""
        f = self.f
        t = f.by.get(c.take) or f.overlay.get(c.take)
        x, y, w, h = c.rect
        if c.kind == "window":
            s = c.dest[2]
            dw, dh = w * s, h * s + 30
            X, Y = c.dest[0] - dw / 2, c.dest[1] - dh / 2 + 60 * (1 - q)
            return X, Y, dw, dh
        ox, oy = t.to_out(x, y)
        k = t.k()
        ow, oh = w * k, h * k
        if c.dest is None:
            s = 1 + (c.lift - 1) * q
            cx, cy = ox + ow / 2, oy + oh / 2 - 4 * q
            return cx - ow * s / 2, cy - oh * s / 2, ow * s, oh * s
        dcx, dcy, ds = c.dest
        dw, dh = w * ds, h * ds
        X = lerp(ox, dcx - dw / 2, q)
        Y = lerp(oy, dcy - dh / 2, q)
        return X, Y, lerp(ow, dw, q), lerp(oh, dh, q)

    def draw_card(self, stage, c, T):
        q = self.card_q(c, T)
        if q <= 0.003:
            return
        X, Y, Wd, Hd = self.card_geom(c, q, T)
        if c.still:
            fr = self.still(*c.still)
        else:
            fr = self.frame_of(c.take, T)
        x, y, w, h = c.rect
        crop = fr[y:y + h, x:x + w]
        fading_out = T > (c.T0 + c.T1) / 2
        alpha = q if fading_out else clamp01(q * 2.2)
        if c.kind == "window":
            iw, ih = int(round(Wd)), int(round(Hd - 30))
            body = cv2.resize(crop, (iw, ih), interpolation=cv2.INTER_AREA)
            img = np.empty((ih + 30, iw, 3), np.uint8)
            bar = np.empty((30, iw, 3), np.uint8)
            bar[:] = (0x13, 0x15, 0x14)
            p = text_patch(c.url, "IBMPlexMono-Regular", 14, INK2, 0.02)
            blit_local(bar, p, (iw - p.shape[1]) / 2, (30 - p.shape[0]) / 2 + 1)
            img[:30] = bar
            img[30:] = body
            shadow(stage, X, Y, iw, ih + 30, 0.7 * alpha, 46, 26)
            paste_rounded(stage, img, int(round(X)), int(round(Y)), 10, alpha)
            return
        iw, ih = max(2, int(round(Wd))), max(2, int(round(Hd)))
        interp = cv2.INTER_CUBIC if iw > w else cv2.INTER_AREA
        img = cv2.resize(crop, (iw, ih), interpolation=interp)
        shadow(stage, X, Y, iw, ih, 0.72 * alpha, 30, 18)
        paste_rounded(stage, img, int(round(X)), int(round(Y)), 8, alpha)
        hairline_rect(stage, int(round(X)), int(round(Y)), iw, ih, INK, 0.22 * alpha, 8)
        lab, col = c.label, c.label_color
        if c.label_after and T >= c.label_after[0]:
            lab, col = c.label_after[1], c.label_after[2]
        if lab:
            label_pill(stage, lab, X, Y - 10, col, alpha * clamp01((q - 0.4) / 0.6))

    def tag_point(self, g, T):
        f = self.f
        t = f.by.get(g.take)
        px, py = t.to_out(*g.point)
        if g.lift_card is not None:
            c = f.cards[g.lift_card]
            q = self.card_q(c, T)
            X, Y, Wd, Hd = self.card_geom(c, q, T)
            x, y, w, h = c.rect
            ox, oy = t.to_out(x, y)
            k = t.k()
            sx, sy = Wd / (w * k), Hd / (h * k)
            px, py = X + (px - ox) * sx, Y + (py - oy) * sy
        return px, py

    def draw_tag(self, stage, g, T):
        if T < g.T0 or T > g.T1:
            return
        a = min(ease_out((T - g.T0) / 0.35), ease_out((g.T1 - T) / 0.25))
        px, py = self.tag_point(g, T)
        lx, ly = px + g.dx, py + g.dy
        grow = ease_io((T - g.T0) / 0.35)
        aa_line(stage, (px, py + 3), (px + (lx - px) * grow, py + 3 + (ly - py - 3) * grow), g.color, 1.5, a)
        fill_rect(stage, (px - 3, py, 6, 6), g.color, a)
        label_pill(stage, g.text, lx, ly, g.color, a * clamp01((T - g.T0 - 0.15) / 0.3), anchor="tc")

    # ------------------------------------------------------------------ motion graphics
    def g_open(self, stage, T):
        """The problem, drawn: a token that trades all day over two markets that do not."""
        v = self.f.vo
        A = v.W("01_cold_open", 0)
        B = v.W("01_cold_open", 7)
        Cc = v.W("01_cold_open", 10)
        D = v.W("01_cold_open", 18)
        E = v.W("01_cold_open", 20) - 0.45
        if T < A - 0.8 or T > E + 0.8:
            return
        out = 1 - ease_io((T - E) / 0.7)
        up = -26 * ease_io((T - E) / 0.7)
        X0, X1 = 360, 1620
        ph = (X1 - X0) / 24.0
        def hx(h):
            return X0 + h * ph
        yT, yN, yH, yA = 420 + up, 560 + up, 640 + up, 740 + up
        # axis
        aax = out * ease_out((T - (A - 0.6)) / 0.6)
        for h in range(0, 25, 6):
            aa_line(stage, (hx(h), yA - 6), (hx(h), yA), INK3, 1.0, aax)
            p = text_patch(f"{h:02d}:00", "IBMPlexMono-Regular", 17, INK2, 0.06)
            blit(stage, p, hx(h) - p.shape[1] / 2, yA + 8, aax)
        p = text_patch("UTC · ONE DAY", "IBMPlexMono-Medium", 16, INK3, 0.18)
        blit(stage, p, X1 - p.shape[1], yA + 34, aax)
        aa_line(stage, (X0, yA - 0.5), (X1, yA - 0.5), INK3, 1.0, 0.5 * aax)
        # token lane
        g = ease_io((T - A) / 1.9)
        at = out * clamp01((T - A) / 0.3)
        p = text_patch("TOKENIZED STOCKS ON X LAYER", "IBMPlexMono-Medium", 21, INK, 0.16)
        blit(stage, p, X0, yT - 50, at)
        if g > 0:
            aa_line(stage, (X0, yT), (X0 + (X1 - X0) * g, yT), INK, 3.0, out)
            aa_line(stage, (X0 + (X1 - X0) * g, yT - 7), (X0 + (X1 - X0) * g, yT + 7), INK, 2.0, out * (1 - clamp01((T - A - 1.9) / 0.3)))
        p = text_patch("TRADE AROUND THE CLOCK", "IBMPlexMono-Medium", 21, BRASS, 0.16)
        blit(stage, p, X1 - p.shape[1], yT - 50, out * clamp01((T - A - 1.5) / 0.4))
        # market lanes
        lanes = [(yN, "NEW YORK · XNYS", [(13.5, 20.0)], 0.0),
                 (yH, "HONG KONG · XHKG", [(1.5, 4.0), (5.0, 8.0)], 0.35)]
        for y, name, sess, delay in lanes:
            al = out * clamp01((T - B - delay) / 0.35)
            if al <= 0:
                continue
            p = text_patch(name, "IBMPlexMono-Medium", 18, INK, 0.16)
            blit(stage, p, X0, y - 40, al)
            fill_rect(stage, (X0, y - 1, X1 - X0, 2), (0x37, 0x3A, 0x35), al)
            gs = ease_io((T - B - delay) / 0.7)
            for h0, h1 in sess:
                xa, xb = hx(h0), hx(h0) + (hx(h1) - hx(h0)) * gs
                fill_rect(stage, (xa, y - 9, xb - xa, 18), INK, 0.88 * al)
            # closed stretches hatch in once the exit line is spoken
            ah = out * clamp01((T - Cc) / 0.6) * 0.55
            if ah > 0:
                edges = [0.0] + [e for s_ in sess for e in s_] + [24.0]
                for i in range(0, len(edges), 2):
                    xa, xb = hx(edges[i]), hx(edges[i + 1])
                    x = xa + 4
                    while x < xb - 6:
                        aa_line(stage, (x, y + 6), (x + 7, y - 6), BRASS, 1.0, ah)
                        x += 11
        ac = out * clamp01((T - Cc - 0.3) / 0.5)
        if ac > 0:
            p = text_patch("MARKET CLOSED", "IBMPlexMono-Medium", 16, BRASS, 0.16)
            blit(stage, p, hx(22.0) - p.shape[1] / 2, yN - 40, ac)
            blit(stage, p, hx(16.0) - p.shape[1] / 2, yH - 40, ac)
        # the closes: seams through every lane
        for i, (h, txt) in enumerate(((8.0, "HONG KONG CLOSES"), (20.0, "NEW YORK CLOSES"))):
            k = ease_io((T - D - i * 0.18) / 0.5)
            if k <= 0:
                continue
            aa_line(stage, (hx(h), yT - 20), (hx(h), yT - 20 + (yA - yT + 20) * k), BRASS, 2.0, out)
            p = text_patch(txt, "IBMPlexMono-Medium", 16, BRASS, 0.14)
            blit(stage, p, hx(h) - p.shape[1] / 2, yA + 64, out * clamp01((T - D - i * 0.18 - 0.3) / 0.4))

    def lockup(self, height):
        mk = brand_rgba("mark", height)
        wm = brand_rgba("wordmark", int(round(height * 0.52)))
        gap = int(height * 0.42)
        w = mk.shape[1] + gap + wm.shape[1]
        out = np.zeros((height, w, 4), np.float32)
        out[:, :mk.shape[1]] = mk
        y = (height - wm.shape[0]) // 2
        out[y:y + wm.shape[0], mk.shape[1] + gap:] = wm
        return out

    def g_brand(self, stage, T):
        v = self.f.vo
        A = v.W("01_cold_open", 20) - 0.15
        S = v.W("01_cold_open", 23)
        M0 = self.f.WIN_IN - 0.15
        if T < A or T > M0 + 0.9:
            return
        big = self.lockup(96)
        a = ease_out((T - A) / 0.6) * (1 - ease_io((T - M0) / 0.6))
        up = -30 * ease_io((T - M0) / 0.8)
        blit(stage, big, (W - big.shape[1]) / 2, 400 + 12 * (1 - ease_out((T - A) / 0.6)) + up, a)
        sa = clamp01((T - S) / 0.5) * (1 - ease_io((T - M0) / 0.5))
        if sa > 0:
            p = text_patch("The market-time risk layer for tokenized stocks on X Layer", "GeneralSans-Regular", 36, INK, 0.0)
            blit(stage, p, (W - p.shape[1]) / 2, 548 + 10 * (1 - ease_out((T - S) / 0.6)) + up, sa)

    def g_kts(self, stage, T):
        v = self.f.vo
        G0, G1 = self.f.gdim[0][0], self.f.gdim[0][1]
        if T < G0 or T > G1 + 0.1:
            return
        a = min(ease_out((T - G0) / 0.5), ease_out((G1 - T) / 0.4))
        X0, XL, XD, X1, Y = 330, 860, 1330, 1600, 700
        p = text_patch("KERB TERMS STANDARD · TWO HORIZONS", "IBMPlexMono-Medium", 17, BRASS, 0.18)
        blit(stage, p, X0, 300, a)
        tA = G0 + 0.25
        g = ease_io((T - tA) / 0.8)
        aa_line(stage, (X0, Y), (X0 + (X1 - X0) * g, Y), INK3, 1.5, a)
        ah = a * clamp01((T - tA - 0.5) / 0.5)
        x = XL + 6
        while x < XD - 4:
            aa_line(stage, (x, Y + 7), (x + 8, Y - 7), BRASS, 1.2, 0.55 * ah)
            x += 13
        fill_rect(stage, (XD, Y - 7, X1 - XD, 14), INK, 0.85 * ah)
        LC = v.W("04_kts", 41)
        pulse = math.exp(-max(0.0, T - LC) * 2.2) if T >= LC else 0.0
        for xx, txt, col, dt in ((X0, "Now", MOSS, 0.3), (XL, "Last Call", BRASS, 0.5), ((XL + XD) / 2, "Weak hours", INK3, 0.7),
                                 (XD, "Next deep session", INK, 0.9)):
            at = a * clamp01((T - tA - dt) / 0.35)
            if txt != "Weak hours":
                aa_line(stage, (xx, Y - 16), (xx, Y + 16), col, 2.0 + (3 * pulse if txt == "Last Call" else 0), at)
            pt = text_patch(txt, "GeneralSans-Medium", 24, col, 0.0)
            blit(stage, pt, xx - (pt.shape[1] / 2 if txt == "Weak hours" else 0), Y + 28, at)

        def span(y, xe, col, title, sub, ts):
            k = ease_io((T - ts) / 0.75)
            if k <= 0:
                return
            ak = a * min(1, k * 1.5)
            aa_line(stage, (X0, y), (X0 + (xe - X0) * k, y), col, 3.0, ak)
            aa_line(stage, (X0, y - 10), (X0, y + 10), col, 2.0, ak)
            if k > 0.98:
                aa_line(stage, (xe, y - 10), (xe, y + 10), col, 2.0, ak)
            pt = text_patch(title, "GeneralSans-Medium", 40, col, -0.01)
            blit(stage, pt, X0, y - 70, ak)
            ps = text_patch(sub, "GeneralSans-Regular", 25, INK2, 0.0)
            blit(stage, ps, X0 + pt.shape[1] + 22, y - 58, ak * clamp01((T - ts - 0.35) / 0.4))
        span(Y - 190, XD, INK, "Carry", "survives the weak hours, untouched", v.W("04_kts", 10) - 0.1)
        span(Y - 80, XL, BRASS, "Session Max", "more credit now, back to Carry at Last Call", v.W("04_kts", 29) - 0.1)

    def g_proof(self, stage, T):
        v = self.f.vo
        G0, G1 = self.f.gdim[1][0], self.f.gdim[1][1]
        if T < G0 or T > G1 + 0.1:
            return
        a = min(ease_out((T - G0) / 0.45), ease_out((G1 - T) / 0.35))
        nodes = [("Input bundle", "hash on chain", v.W("07_proof", 19)),
                 ("Recompute", "KTS 0.2, pure functions", v.W("07_proof", 24)),
                 ("Posted terms", "match, field by field", v.W("07_proof", 25) + 0.3)]
        bw, bh, gap = 390, 128, 120
        total = 3 * bw + 2 * gap
        x = (W - total) / 2
        y = 500
        p = text_patch("ANYONE CAN CHECK A TERM", "IBMPlexMono-Medium", 17, BRASS, 0.18)
        blit(stage, p, x, y - 64, a)
        for i, (t1, t2, ts) in enumerate(nodes):
            k = ease_out((T - ts + 0.15) / 0.45)
            if k <= 0:
                x += bw + gap
                continue
            last = i == 2
            col = MOSS if last else INK
            ak = a * k
            fill_rect(stage, (x, y, bw, bh), CANVAS, 0.85 * ak)
            for p0, p1 in (((x, y), (x + bw, y)), ((x + bw, y), (x + bw, y + bh)), ((x + bw, y + bh), (x, y + bh)), ((x, y + bh), (x, y))):
                aa_line(stage, p0, p1, col if last else INK3, 1.5, ak)
            pt = text_patch(t1, "GeneralSans-Medium", 34, col, -0.01)
            blit(stage, pt, x + 26, y + 26, ak)
            ps = text_patch(t2, "GeneralSans-Regular", 22, INK2, 0.0)
            blit(stage, ps, x + 26, y + 76, ak)
            if i < 2:
                kk = ease_io((T - nodes[i + 1][2] + 0.45) / 0.35)
                if kk > 0:
                    xa, xb = x + bw + 12, x + bw + gap - 12
                    xe = xa + (xb - xa) * kk
                    aa_line(stage, (xa, y + bh / 2), (xe, y + bh / 2), BRASS, 2.0, a)
                    if kk > 0.95:
                        aa_line(stage, (xe, y + bh / 2), (xe - 9, y + bh / 2 - 7), BRASS, 2.0, a)
                        aa_line(stage, (xe, y + bh / 2), (xe - 9, y + bh / 2 + 7), BRASS, 2.0, a)
            x += bw + gap

    def g_c1(self, stage, T):
        """C(1%) defined, pinned to its point on the live depth curve."""
        v = self.f.vo
        T0, T1 = v.W("03_exit", 25) - 0.1, self.f.by["exit2"].start + 0.2
        if T < T0 or T > T1:
            return
        a = min(ease_out((T - T0) / 0.4), ease_out((T1 - T) / 0.3))
        t = self.f.by["exit1"]
        px, py = t.to_out(1449, 690)
        bx, by = 1262, py + 92
        g = ease_io((T - T0) / 0.45)
        aa_line(stage, (px, py), (px + (bx + 150 - px) * g, py + (by - py) * g), BRASS, 1.5, a)
        fill_rect(stage, (px - 4, py - 4, 8, 8), BRASS, a)
        bw, bh = 470, 150
        fill_rect(stage, (bx, by, bw, bh), CANVAS, 0.92 * a)
        aa_line(stage, (bx, by), (bx + bw, by), BRASS, 1.5, a)
        pt = text_patch("C(1%)", "GeneralSans-Medium", 48, INK, -0.01)
        blit(stage, pt, bx + 24, by + 18, a)
        for i, line in enumerate(("the largest sale that clears", "within 1% price impact")):
            ps = text_patch(line, "GeneralSans-Regular", 24, INK2, 0.0)
            blit(stage, ps, bx + 24, by + 78 + i * 30, a)

    def g_lastcall(self, stage, T):
        F = self.f.FLIP
        if T < F or T > self.f.HERO_END:
            return
        t = T - F
        k = ease_io(t / 0.65)
        x = -10 + (W + 20) * k
        fade = 1 - clamp01((t - 0.65) / 0.5)
        if fade > 0:
            aa_line(stage, (x, 0), (x, H), BRASS, 3.0, fade)
            fill_rect(stage, (0, 0, max(0, x), H), BRASS, 0.05 * fade)
        end_a = 1 - clamp01((T - (self.f.HERO_END - 0.5)) / 0.5)
        fill_rect(stage, (0, 0, min(W, x), 3), BRASS, end_a)

    def g_final(self, stage, T):
        f, v = self.f, self.f.vo
        L1, L2 = v.W("10b_final_line", 0), v.W("10b_final_line", 4)
        if T < L1 - 0.2:
            return
        a1 = ease_out((T - L1 + 0.1) / 0.5)
        a2 = ease_out((T - L2 + 0.05) / 0.5)
        fa = 1 - clamp01((T - (f.END - 1.4)) / 1.2)
        x, y = 150, 400
        p1 = text_patch("Never lend more than", "GeneralSans-Medium", 84, INK, -0.02)
        p2 = text_patch("you can liquidate.", "GeneralSans-Medium", 84, OLIVE, -0.02)
        blit(stage, p1, x, y + 14 * (1 - a1), a1 * fa)
        blit(stage, p2, x, y + 100 + 14 * (1 - a2), a2 * fa)
        LK = v.end() + 1.1
        al = ease_out((T - LK) / 0.6) * fa
        if al > 0:
            lk = self.lockup(40)
            blit(stage, lk, x, y + 260, al)
            p = text_patch("usekerb.xyz", "IBMPlexMono-Medium", 22, INK2, 0.1)
            blit(stage, p, x + lk.shape[1] + 34, y + 260 + (40 - p.shape[0]) / 2, al)

    def header(self, stage, T):
        f = self.f
        hs = clamp01((T - f.WIN_IN - 0.9) / 0.5) * (1 - clamp01((T - f.FLY0) / 0.4))
        if hs <= 0:
            return
        cur = None
        for i, ch in enumerate(f.chapters):
            if T >= ch[0] - 0.2:
                cur = i
        if cur is None:
            return
        t0 = f.chapters[cur][0] - 0.2
        a = hs * ease_out((T - t0) / 0.5)
        num, title, ctx = f.chapters[cur][1:]
        ctx_col = INK3
        if cur == 4 and f.FLIP <= T <= f.HERO_END:
            ctx, ctx_col = "LAST CALL · OPEN · DEMO CLOCK · X LAYER TESTNET", BRASS
        pn = text_patch(num, "IBMPlexMono-Medium", 18, BRASS, 0.1)
        pt = text_patch(title, "GeneralSans-Medium", 30, INK, -0.005)
        pc = text_patch(ctx, "IBMPlexMono-Regular", 15, ctx_col, 0.14)
        y = 52 + 6 * (1 - ease_out((T - t0) / 0.5))
        blit(stage, pn, WX, y - pn.shape[0] / 2 + 1, a)
        blit(stage, pt, WX + pn.shape[1] + 16, y - pt.shape[0] / 2, a)
        blit(stage, pc, WX + WW - pc.shape[1], y - pc.shape[0] / 2 + 1, a)

    # ------------------------------------------------------------------
    def frame(self, T):
        f = self.f
        prog = T / f.END
        # backdrop: fog, slow drift; the arch at the close
        stage = backdrop_frame("p5-fog", 0.62, 1.2, 1.0 + 0.06 * prog, -30 + 60 * prog, 0)
        if T > f.FLY0 + 0.5:
            k = ease_io((T - f.FLY0 - 0.5) / 1.8)
            z = 1.18 - 0.14 * ease_out((T - f.FLY0) / 7.0)
            arch = backdrop_frame("p1-kerbstone-night", 0.8, 0.0, z, 330, 30)
            # keep the left side dark for the final line
            gradient_panel(arch, 0, 0, 1250, H, 0.72, "left")
            stage = cv2.addWeighted(arch, k, stage, 1 - k, 0)
        # a scrim over the art while the opening graphic and lockup are on screen
        v = f.vo
        o0, o1 = v.W("01_cold_open", 0) - 1.0, f.WIN_IN + 0.8
        if T < o1:
            sc = 0.5 * (1 - ease_io((T - f.WIN_IN) / 0.8))
            cv2.convertScaleAbs(stage, dst=stage, alpha=1 - sc)
        # Last Call: a brief warm lift behind the window
        if f.FLIP <= T <= f.FLIP + 2.5:
            g = math.exp(-(T - f.FLIP) * 1.8) * 0.16
            stage = cv2.addWeighted(stage, 1.0, np.full_like(stage, BRASS), g, 0)

        op, dy, s, ox, oy = f.window_state(T)
        if op > 0.003:
            img, cur = self.window_image(T)
            if img is not None:
                dim, blur = 0.0, 0.0
                for c in f.cards:
                    q = self.card_q(c, T)
                    if q > 0:
                        dim = max(dim, c.dim * q)
                for g0, g1, gd, gb in f.gdim:
                    if g0 <= T <= g1:
                        q = min(ease_out((T - g0) / 0.5), ease_out((g1 - T) / 0.4))
                        dim, blur = max(dim, gd * q), max(blur, gb * q)
                if blur > 0.01:
                    small = cv2.resize(img, (WBW // 4, WBH // 4), interpolation=cv2.INTER_AREA)
                    small = cv2.GaussianBlur(small, (0, 0), 3.0)
                    bl = cv2.resize(small, (WBW, WBH), interpolation=cv2.INTER_LINEAR)
                    img = cv2.addWeighted(bl, blur, img, 1 - blur, 0)
                if dim > 0.003:
                    cv2.convertScaleAbs(img, dst=img, alpha=1 - dim)
                if abs(s - 1) < 1e-4 and abs(ox) < 1e-3:
                    X, Y = WBX, int(round(WBY + dy))
                    shadow(stage, X, Y, WBW, WBH, 0.62 * op, 46, 26)
                    paste_rounded(stage, img, X, Y, RADIUS, op)
                    hairline_rect(stage, X, Y, WBW, WBH, INK, 0.12 * op)
                else:
                    cx, cy = WBX + WBW / 2 + ox, WBY + WBH / 2 + dy + oy
                    M = np.array([[s, 0, cx - s * WBW / 2], [0, s, cy - s * WBH / 2]], np.float32)
                    warped = cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR)
                    m = cv2.warpAffine(round_mask(WBW, WBH, RADIUS), M, (W, H), flags=cv2.INTER_LINEAR)[..., None] * op
                    stage = (warped.astype(np.float32) * m + stage.astype(np.float32) * (1 - m)).astype(np.uint8)

        for c in f.cards:
            self.draw_card(stage, c, T)
        for g in f.tags:
            self.draw_tag(stage, g, T)
        self.g_open(stage, T)
        self.g_brand(stage, T)
        self.g_c1(stage, T)
        self.g_kts(stage, T)
        self.g_proof(stage, T)
        self.g_lastcall(stage, T)
        self.g_final(stage, T)
        self.header(stage, T)
        # global fades
        fi = ease_io(T / 1.2)
        fo = 1 - ease_io((T - (f.END - 0.9)) / 0.9)
        k = min(fi, fo)
        if k < 0.999:
            canvas = np.empty_like(stage)
            canvas[:] = CANVAS
            stage = cv2.addWeighted(stage, k, canvas, 1 - k, 0)
        self.gc(T)
        return stage


# ------------------------------------------------------------------ entry points
def render_range(t0, t1, out, preview=False):
    film = Film()
    r = Renderer(film)
    enc = Encoder(out, preview)
    for i in range(int(round(t0 * FPS)), int(round(min(t1, film.END) * FPS))):
        enc.write(r.frame(i / FPS))
    enc.close()


def render_parallel(out, preview, nproc=5):
    film = Film()
    nfr = int(round(film.END * FPS))
    cuts = [int(round(nfr * i / nproc)) for i in range(nproc + 1)]
    tmp = out + ".parts"
    os.makedirs(tmp, exist_ok=True)
    procs = [subprocess.Popen([sys.executable, __file__, "chunk", "1" if preview else "0", str(cuts[i] / FPS), str(cuts[i + 1] / FPS),
                               f"{tmp}/part{i:02d}.mp4"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) for i in range(nproc)]
    for p in procs:
        p.wait()
    with open(f"{tmp}/list.txt", "w") as fh:
        for i in range(nproc):
            fh.write(f"file 'part{i:02d}.mp4'\n")
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", f"{tmp}/list.txt",
                    "-c", "copy", "-movflags", "+faststart", out], check=True)
    return film.END


def export(film):
    v = film.vo
    plan = {
        "runtime": round(film.END, 3),
        "clips": [{k: (round(x, 4) if isinstance(x, float) else x) for k, x in c.items()} for c in v.clips],
        "speech": [[round(a, 3), round(b, 3)] for a, b in v.spans()],
        "accents": {"window_in": round(film.WIN_IN, 3), "last_call_flip": round(film.FLIP, 3), "cured": round(film.CURED, 3)},
        "final_line": [round(v.W("10b_final_line", 0), 3), round(v.WE("10b_final_line", 6), 3)],
    }
    json.dump(plan, open(f"{ROOT}/artifacts/demo-video/vo_plan.json", "w"), indent=2)
    shots = [{"name": t.name, "source": t.src.replace(ROOT + "/", ""), "url": t.url, "final_start": round(t.start, 3),
              "final_end": round(t.end, 3), "source_in": round(t.src_t(t.start), 3), "source_out": round(t.src_t(t.end), 3),
              "remap": t.remap, "tail_speed": t.tail, "dissolve_in": t.xfade} for t in film.takes]
    cards = [{"take": c.take, "rect": c.rect, "start": round(c.T0, 3), "end": round(c.T1, 3), "label": c.label,
              "mode": c.kind if c.kind == "window" else ("in place" if c.dest is None else "lifted")} for c in film.cards]
    edl = {"status": "FINAL_V2", "fps": 30, "resolution": "1920x1080", "runtime_seconds": round(film.END, 3),
           "presentation": "browser window on the Kerb p5-fog art plate; close on p1-kerbstone-night",
           "takes": shots, "cards": cards, "narration": plan["clips"], "accents": plan["accents"]}
    json.dump(edl, open(f"{ROOT}/docs/demo_video/EDL.json", "w"), indent=2)
    return plan


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "plan"
    if mode == "chunk":
        render_range(float(sys.argv[3]), float(sys.argv[4]), sys.argv[5], preview=sys.argv[2] == "1")
    elif mode in ("master", "rough"):
        out = f"{ROOT}/artifacts/demo-video/{'video2_master_noaudio' if mode == 'master' else 'rough2'}.mp4"
        print(f"{mode} {render_parallel(out, mode == 'rough'):.2f}s -> {out}")
    elif mode == "stills":
        film = Film()
        r = Renderer(film)
        os.makedirs(f"{ROOT}/artifacts/demo-video/stills2", exist_ok=True)
        for Ts in sys.argv[2:]:
            Tf = float(Ts)
            img = r.frame(Tf)
            cv2.imwrite(f"{ROOT}/artifacts/demo-video/stills2/v2_{Tf:07.2f}.png", img)
            print(f"stills2/v2_{Tf:07.2f}.png")
    elif mode == "plan":
        film = Film()
        for t in film.takes:
            print(f"{t.start:7.2f}-{t.end:7.2f} {t.name:<10} {t.url:<30} src {t.src_t(t.start):6.2f}-{t.src_t(t.end):6.2f}")
        print("FLIP", round(film.FLIP, 3), "CURED", round(film.CURED, 3), "FLY0", round(film.FLY0, 2), "END", round(film.END, 2))
        for c in film.vo.clips:
            print("VO", c["seg"], c["wf"], c["wt"], round(film.vo.W(c["seg"], c["wf"]), 2), "->", round(film.vo.WE(c["seg"], c["wt"]), 2))
    elif mode == "export":
        film = Film()
        p = export(film)
        print(p["runtime"], p["accents"])
