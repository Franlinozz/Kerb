"""filmkit2: the v2 compositor. Recordings play inside a designed browser window that sits on the
Kerb art backdrop; emphasis comes from live lift-out cards and short tags, never from zooming the page.

Layers, back to front: backdrop art, window shadow, window (URL bar + page), cards and tags,
motion graphics, running header, global fades.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Callable

import cv2
import numpy as np

from filmkit import (BRASS, CANVAS, FPS, H, INK, INK2, INK3, MOSS, OLIVE, OXIDE, W, Reader, aa_line, blit, clamp01,
                     ease_io, ease_out, fill_rect, text_patch)

ROOT = "/root/kerb"
ART = f"{ROOT}/apps/web/public/art/masters"
BRAND = f"{ROOT}/artifacts/demo-video/brand"

# Window geometry: page content 1568x882 under a 34 px bar, centred, with the running header above.
WW, WH = 1568, 882
BAR = 34
WX = (W - WW) // 2            # 176
WY = 146                      # top of the page content
WBX, WBY, WBW, WBH = WX, WY - BAR, WW, WH + BAR
RADIUS = 12
PANEL = (0x13, 0x15, 0x14)    # BGR of the bar

OP_CROP = (98, 120, 1704, 958)
FULL_CROP = (0, 0, 1920, 1080)


def ease_in(x: float) -> float:
    x = clamp01(x)
    return x * x * x


def lerp(a, b, t):
    return a + (b - a) * t


# ------------------------------------------------------------------ takes (window content)
@dataclass
class Take:
    name: str
    src: str
    url: str
    remap: list[tuple[float, float]]            # (seconds into the take, source seconds)
    tail: float = 1.0                           # source speed after the last point
    crop: tuple = OP_CROP
    matrix: str = "bt709"
    xfade: float = 0.45                         # dissolve from the previous take, inside the window
    start: float = 0.0
    end: float = 0.0

    def src_t(self, T: float) -> float:
        dt = T - self.start
        pts = self.remap
        if dt <= pts[0][0]:
            return pts[0][1]
        for (a, sa), (b, sb) in zip(pts, pts[1:]):
            if dt <= b:
                return sa + (sb - sa) * (dt - a) / max(1e-9, b - a)
        a, sa = pts[-1]
        return sa + (dt - a) * self.tail

    def k(self) -> float:
        return WW / self.crop[2]

    def to_out(self, x: float, y: float) -> tuple[float, float]:
        cx, cy, cw, ch = self.crop
        k = WW / cw
        return WX + (x - cx) * k, WY + (y - cy) * k


class TakeReader:
    """Sequential reader positioned on a take's source frames, by absolute source frame index."""

    def __init__(self, take: Take, t_from: float, t_to: float):
        s0 = take.src_t(t_from)
        s1 = take.src_t(t_to)
        self.base = int(math.floor(s0 * FPS + 1e-6))
        self.r = Reader(take.src, self.base / FPS, int(s1 * FPS) - self.base + 4, take.matrix)

    def frame(self, s: float) -> np.ndarray:
        i = int(math.floor(s * FPS + 1e-6)) - self.base
        return self.r.get(max(0, i))

    def close(self):
        self.r.close()


# ------------------------------------------------------------------ cards and tags
@dataclass
class Card:
    take: str
    rect: tuple                                  # source px (x, y, w, h)
    T0: float
    T1: float
    dest: tuple | None = None                    # (cx, cy, out px per source px); None = lift in place
    lift: float = 1.035
    label: str | None = None
    label_after: tuple | None = None             # (T, text, colour) switch
    label_color: tuple = BRASS
    dim: float = 0.5
    still: tuple | None = None                   # (take name, source seconds) for a frozen crop
    kind: str = "card"                           # card | window
    url: str = ""
    fin: float = 0.5
    fout: float = 0.35


@dataclass
class Tag:
    take: str
    point: tuple                                 # source px the leader points at
    text: str
    T0: float
    T1: float
    dx: float = 0.0                              # label offset from the point, output px
    dy: float = 70.0
    color: tuple = BRASS
    lift_card: int | None = None                 # index of an in-place card the point rides with


# ------------------------------------------------------------------ art
@lru_cache(maxsize=4)
def backdrop_image(name: str, darken: float, blur: float, scale: float = 1.12) -> np.ndarray:
    img = cv2.imread(f"{ART}/{name}.png", cv2.IMREAD_COLOR)
    h0, w0 = img.shape[:2]
    s = max(W * scale / w0, H * scale / h0)
    img = cv2.resize(img, (int(round(w0 * s)), int(round(h0 * s))), interpolation=cv2.INTER_CUBIC)
    if blur > 0:
        img = cv2.GaussianBlur(img, (0, 0), blur)
    img = img.astype(np.float32) * darken
    # vignette
    hh, ww = img.shape[:2]
    yy, xx = np.mgrid[0:hh, 0:ww].astype(np.float32)
    d = np.sqrt(((xx - ww / 2) / (ww / 2)) ** 2 + ((yy - hh / 2) / (hh / 2)) ** 2)
    vig = np.clip(1.15 - 0.45 * d ** 1.6, 0.35, 1.0)
    img *= vig[..., None]
    return np.clip(img, 0, 255).astype(np.uint8)


def backdrop_frame(name: str, darken: float, blur: float, zoom: float, px: float, py: float) -> np.ndarray:
    img = backdrop_image(name, darken, blur)
    hh, ww = img.shape[:2]
    s = zoom * max(W / ww, H / hh) * 1.0
    # centre the art, then pan by (px, py) output px
    cx, cy = ww / 2 - px / s, hh / 2 - py / s
    M = np.array([[s, 0, W / 2 - s * cx], [0, s, H / 2 - s * cy]], np.float32)
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


@lru_cache(maxsize=4)
def brand_rgba(name: str, height: int) -> np.ndarray:
    img = cv2.imread(f"{BRAND}/{name}.png", cv2.IMREAD_UNCHANGED)
    ys, xs = np.where(img[..., 3] > 8)
    img = img[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    s = height / img.shape[0]
    img = cv2.resize(img, (int(round(img.shape[1] * s)), height), interpolation=cv2.INTER_AREA)
    a = img[..., 3:4].astype(np.float32) / 255.0
    out = np.concatenate([img[..., :3].astype(np.float32) * a, a], axis=2)
    return out


# ------------------------------------------------------------------ shapes
@lru_cache(maxsize=64)
def round_mask(w: int, h: int, r: int) -> np.ndarray:
    SS = 4
    m = np.zeros((h * SS, w * SS), np.uint8)
    R = r * SS
    cv2.rectangle(m, (R, 0), (w * SS - R - 1, h * SS - 1), 255, -1)
    cv2.rectangle(m, (0, R), (w * SS - 1, h * SS - R - 1), 255, -1)
    for cx, cy in ((R, R), (w * SS - R - 1, R), (R, h * SS - R - 1), (w * SS - R - 1, h * SS - R - 1)):
        cv2.circle(m, (cx, cy), R, 255, -1)
    m = cv2.resize(m, (w, h), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0
    return m


def shadow(stage: np.ndarray, x: float, y: float, w: float, h: float, strength: float, spread: float = 40, dy: float = 22):
    """Soft drop shadow computed at quarter resolution."""
    if strength <= 0.003:
        return
    q = 4
    pad = int(spread * 2.2)
    x0, y0 = int(max(0, x - pad)), int(max(0, y + dy - pad))
    x1, y1 = int(min(W, x + w + pad)), int(min(H, y + dy + h + pad))
    if x1 <= x0 or y1 <= y0:
        return
    sw, sh = max(1, (x1 - x0) // q), max(1, (y1 - y0) // q)
    m = np.zeros((sh, sw), np.float32)
    cv2.rectangle(m, (int((x - x0) / q), int((y + dy - y0) / q)), (int((x + w - x0) / q), int((y + dy + h - y0) / q)), 1.0, -1)
    m = cv2.GaussianBlur(m, (0, 0), spread / q)
    m = cv2.resize(m, (x1 - x0, y1 - y0), interpolation=cv2.INTER_LINEAR)
    f = 1 - strength * m
    region = stage[y0:y1, x0:x1]
    stage[y0:y1, x0:x1] = cv2.multiply(region, cv2.merge([f, f, f]), dtype=cv2.CV_8U)


def paste_rounded(stage: np.ndarray, img: np.ndarray, x: int, y: int, r: int, alpha: float = 1.0):
    """Composite img with rounded corners at integer (x, y)."""
    h, w = img.shape[:2]
    inside = x >= 0 and y >= 0 and x + w <= W and y + h <= H
    if alpha >= 0.999 and inside and r > 0:
        m = round_mask(w, h, r)
        corners = ((0, 0), (0, w - r), (h - r, 0), (h - r, w - r))
        saved = [stage[y + cy:y + cy + r, x + cx:x + cx + r].astype(np.float32) for cy, cx in corners]
        stage[y:y + h, x:x + w] = img
        for (cy, cx), sv in zip(corners, saved):
            mm = m[cy:cy + r, cx:cx + r][..., None]
            cur = stage[y + cy:y + cy + r, x + cx:x + cx + r].astype(np.float32)
            stage[y + cy:y + cy + r, x + cx:x + cx + r] = (cur * mm + sv * (1 - mm)).astype(np.uint8)
        return
    X0, Y0, X1, Y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
    if X1 <= X0 or Y1 <= Y0:
        return
    sub = img[Y0 - y:Y1 - y, X0 - x:X1 - x].astype(np.float32)
    m = (round_mask(w, h, r) if r > 0 else np.ones((h, w), np.float32))[Y0 - y:Y1 - y, X0 - x:X1 - x][..., None] * alpha
    dst = stage[Y0:Y1, X0:X1].astype(np.float32)
    stage[Y0:Y1, X0:X1] = (sub * m + dst * (1 - m)).astype(np.uint8)


def hairline_rect(img, x, y, w, h, color, alpha, r=RADIUS):
    # straight edges only; the rounded corners are left to the mask
    aa_line(img, (x + r, y + 0.5), (x + w - r, y + 0.5), color, 1.0, alpha)
    aa_line(img, (x + r, y + h - 0.5), (x + w - r, y + h - 0.5), color, 1.0, alpha)
    aa_line(img, (x + 0.5, y + r), (x + 0.5, y + h - r), color, 1.0, alpha)
    aa_line(img, (x + w - 0.5, y + r), (x + w - 0.5, y + h - r), color, 1.0, alpha)


@lru_cache(maxsize=32)
def bar_image(url: str) -> np.ndarray:
    img = np.empty((BAR, WW, 3), np.uint8)
    img[:] = PANEL
    for i in range(3):
        cv2.circle(img, (22 + i * 18, BAR // 2), 5, (0x3A, 0x3D, 0x37), -1, cv2.LINE_AA)
    # address pill
    pw, ph = 520, 22
    px, py = (WW - pw) // 2, (BAR - ph) // 2
    pill = img[py:py + ph, px:px + pw]
    pill[:] = (0x0E, 0x10, 0x0F)
    p = text_patch(url, "IBMPlexMono-Regular", 15, INK2, 0.02)
    blit_local(img, p, px + (pw - p.shape[1]) / 2, py + (ph - p.shape[0]) / 2 + 1)
    aa_line(img, (0, BAR - 0.5), (WW, BAR - 0.5), (0x26, 0x28, 0x24), 1.0, 1.0)
    return img


def blit_local(dst, patch, x, y, alpha=1.0):
    x, y = int(round(x)), int(round(y))
    ph, pw = patch.shape[:2]
    H2, W2 = dst.shape[:2]
    x0, y0, x1, y1 = max(0, x), max(0, y), min(W2, x + pw), min(H2, y + ph)
    if x1 <= x0 or y1 <= y0:
        return
    p = patch[y0 - y:y1 - y, x0 - x:x1 - x]
    region = dst[y0:y1, x0:x1].astype(np.float32)
    a = p[..., 3:4] * alpha
    dst[y0:y1, x0:x1] = np.clip(region * (1 - a) + p[..., :3] * alpha, 0, 255).astype(np.uint8)


def label_pill(stage, text, x, y, color, alpha, size=16, anchor="bl"):
    """A small tag: mono caps on a canvas pill. anchor bl = (x, y) is the pill's bottom-left."""
    if alpha <= 0.003:
        return (0, 0)
    p = text_patch(text, "IBMPlexMono-Medium", size, color, 0.14)
    pw, ph = p.shape[1] + 20, p.shape[0] + 8
    X = x if anchor[1] == "l" else x - pw if anchor[1] == "r" else x - pw / 2
    Y = y - ph if anchor[0] == "b" else y
    fill_rect(stage, (X, Y, pw, ph), CANVAS, 0.9 * alpha)
    aa_line(stage, (X, Y + ph - 0.5), (X + pw, Y + ph - 0.5), color, 1.0, 0.55 * alpha)
    blit(stage, p, X + 10, Y + 4, alpha)
    return (pw, ph)


# ------------------------------------------------------------------ tracks
class Track:
    """Keyframed values (T, value) with cubic in-out easing between keys."""

    def __init__(self, keys):
        self.keys = sorted(keys, key=lambda k: k[0])

    def at(self, T):
        k = self.keys
        if T <= k[0][0]:
            return k[0][1]
        for (a, va), (b, vb) in zip(k, k[1:]):
            if T <= b:
                x = ease_io((T - a) / max(1e-9, b - a))
                if isinstance(va, tuple):
                    return tuple(lerp(p, q, x) for p, q in zip(va, vb))
                return lerp(va, vb, x)
        return k[-1][1]
