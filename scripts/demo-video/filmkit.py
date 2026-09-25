"""filmkit: the Kerb demo film renderer.

Frames are decoded from the source recordings with ffmpeg, framed with a sub-pixel camera
(cv2.warpAffine, Lanczos), given the motion layer (seams, brackets, labels, the KTS rail) and
piped to x264. Nothing here alters UI pixels beyond crop, scale, dimming and overlays drawn
beside or around them.
"""
from __future__ import annotations

import math
import subprocess
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Callable

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1920, 1080, 30
ROOT = "/root/kerb"
FONTS = f"{ROOT}/artifacts/demo-video/fonts"

# Kerbstone dark tokens, BGR.
def _hex(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return (b, g, r)

CANVAS = _hex("#0B0C0A")
INK = _hex("#ECE8DE")
INK2 = _hex("#B8B3A6")
INK3 = _hex("#8A857A")
BRASS = _hex("#D6A64F")
MOSS = _hex("#8FA35E")
OXIDE = _hex("#D2694C")
OLIVE = _hex("#A6A47A")

# Operator recordings: Chrome at 125 percent; the page viewport without browser chrome.
OP_CROP = (98, 120, 1704, 958)
OP_CAM = (98 + 852, 120 + 479, 1704)


# ----------------------------------------------------------------- easing
def clamp01(x: float) -> float:
    return 0.0 if x < 0 else 1.0 if x > 1 else x

def ease_io(x: float) -> float:  # cubic in-out
    x = clamp01(x)
    return 4 * x * x * x if x < 0.5 else 1 - pow(-2 * x + 2, 3) / 2

def ease_out(x: float) -> float:
    x = clamp01(x)
    return 1 - pow(1 - x, 3)

def ease_sine(x: float) -> float:
    x = clamp01(x)
    return -(math.cos(math.pi * x) - 1) / 2

def ramp(t: float, t0: float, t1: float, fin: float = 0.3, fout: float = 0.3) -> float:
    """Opacity envelope: 0 before t0, eased up over fin, held, eased down over fout ending at t1."""
    if t < t0 or t > t1:
        return 0.0
    a = ease_out((t - t0) / fin) if fin > 0 else 1.0
    b = ease_out((t1 - t) / fout) if fout > 0 else 1.0
    return min(a, b)


# ----------------------------------------------------------------- sources
class Reader:
    """Sequential frame reader for one shot: frames from t_in onward at the source rate."""

    def __init__(self, src: str, t_in: float, nframes: int, matrix: str = "bt709"):
        self.src = src
        vf = f"scale=in_color_matrix={matrix}:in_range=tv:out_range=pc,format=bgr24"
        self.p = subprocess.Popen(
            ["ffmpeg", "-hide_banner", "-loglevel", "error", "-ss", f"{t_in:.4f}", "-i", src,
             "-frames:v", str(nframes), "-vf", vf, "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
            stdout=subprocess.PIPE, bufsize=W * H * 3 * 4)
        self.idx = -1
        self.last: np.ndarray | None = None

    def get(self, i: int) -> np.ndarray:
        while self.idx < i:
            buf = self.p.stdout.read(W * H * 3)
            if len(buf) < W * H * 3:
                if self.last is None:
                    raise RuntimeError(f"no frames from {self.src}")
                self.idx = i  # hold the last frame at the very end of a source
                break
            self.last = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
            self.idx += 1
        return self.last

    def close(self) -> None:
        try:
            self.p.stdout.close()
            self.p.kill()
        except Exception:
            pass


# ----------------------------------------------------------------- camera
@dataclass
class Cam:
    """Keyframes (u, cx, cy, w) with u in [0, 1] of the shot, eased between keys."""
    keys: list[tuple[float, float, float, float]]
    ease: Callable[[float], float] = ease_sine

    def at(self, u: float) -> tuple[float, float, float]:
        k = self.keys
        if u <= k[0][0]:
            return k[0][1:]
        for a, b in zip(k, k[1:]):
            if u <= b[0]:
                x = self.ease((u - a[0]) / max(1e-9, b[0] - a[0]))
                return tuple(a[i] + (b[i] - a[i]) * x for i in (1, 2, 3))  # type: ignore
        return k[-1][1:]

def cam_static(cx: float, cy: float, w: float) -> Cam:
    return Cam([(0, cx, cy, w), (1, cx, cy, w)])

def cam_push(cx0, cy0, w0, cx1, cy1, w1, ease=ease_sine) -> Cam:
    return Cam([(0, cx0, cy0, w0), (1, cx1, cy1, w1)], ease)

def frame_cam(frame: np.ndarray, cx: float, cy: float, w: float, bounds=(0, 0, W, H)) -> tuple[np.ndarray, tuple]:
    h = w * H / W
    bx, by, bw, bh = bounds
    cx = min(max(cx, bx + w / 2), bx + bw - w / 2)
    cy = min(max(cy, by + h / 2), by + bh - h / 2)
    s = W / w
    M = np.array([[s, 0, W / 2 - s * cx], [0, s, H / 2 - s * cy]], np.float32)
    interp = cv2.INTER_LANCZOS4 if s > 1.001 else cv2.INTER_AREA if s < 0.999 else cv2.INTER_LINEAR
    if abs(s - 1) < 1e-6 and abs(M[0, 2] - round(M[0, 2])) < 1e-6 and abs(M[1, 2] - round(M[1, 2])) < 1e-6:
        out = frame.copy()
    else:
        out = cv2.warpAffine(frame, M, (W, H), flags=interp, borderMode=cv2.BORDER_REPLICATE)
    return out, (s, W / 2 - s * cx, H / 2 - s * cy)

def to_out(xf, x: float, y: float) -> tuple[float, float]:
    s, tx, ty = xf
    return x * s + tx, y * s + ty


# ----------------------------------------------------------------- type
@lru_cache(maxsize=32)
def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(f"{FONTS}/{name}.ttf", size)

@lru_cache(maxsize=512)
def text_patch(text: str, fname: str, size: int, color: tuple[int, int, int], tracking: float = 0.0) -> np.ndarray:
    """Anti-aliased text as a premultiplied BGRA patch. tracking is in em."""
    f = font(fname, size)
    asc, desc = f.getmetrics()
    track = tracking * size
    widths = [f.getlength(ch) for ch in text]
    tw = int(math.ceil(sum(widths) + track * max(0, len(text) - 1))) + 4
    img = Image.new("L", (max(tw, 1), asc + desc + 4), 0)
    d = ImageDraw.Draw(img)
    x = 2.0
    for ch, cw in zip(text, widths):
        d.text((x, 2), ch, font=f, fill=255)
        x += cw + track
    a = np.asarray(img).astype(np.float32) / 255.0
    out = np.zeros((a.shape[0], a.shape[1], 4), np.float32)
    for i in range(3):
        out[..., i] = a * color[i]
    out[..., 3] = a
    return out

def blit(dst: np.ndarray, patch: np.ndarray, x: float, y: float, alpha: float = 1.0) -> None:
    """Composite a premultiplied BGRA float patch onto a uint8 BGR frame at integer position."""
    if alpha <= 0.003:
        return
    x, y = int(round(x)), int(round(y))
    ph, pw = patch.shape[:2]
    x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + pw), min(H, y + ph)
    if x1 <= x0 or y1 <= y0:
        return
    p = patch[y0 - y:y1 - y, x0 - x:x1 - x]
    region = dst[y0:y1, x0:x1].astype(np.float32)
    a = p[..., 3:4] * alpha
    region = region * (1 - a) + p[..., :3] * alpha
    dst[y0:y1, x0:x1] = np.clip(region, 0, 255).astype(np.uint8)

def text_size(text: str, fname: str, size: int, tracking: float = 0.0) -> tuple[int, int]:
    p = text_patch(text, fname, size, (255, 255, 255), tracking)
    return p.shape[1], p.shape[0]


# ----------------------------------------------------------------- drawing primitives
def aa_line(img: np.ndarray, p0, p1, color, thick: float = 2.0, alpha: float = 1.0) -> None:
    if alpha <= 0.003:
        return
    SH = 4
    a = (int(round(p0[0] * (1 << SH))), int(round(p0[1] * (1 << SH))))
    b = (int(round(p1[0] * (1 << SH))), int(round(p1[1] * (1 << SH))))
    if alpha >= 0.999:
        cv2.line(img, a, b, color, max(1, int(round(thick))), cv2.LINE_AA, SH)
        return
    x0, x1 = int(min(p0[0], p1[0]) - thick - 2), int(max(p0[0], p1[0]) + thick + 3)
    y0, y1 = int(min(p0[1], p1[1]) - thick - 2), int(max(p0[1], p1[1]) + thick + 3)
    x0, y0, x1, y1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
    if x1 <= x0 or y1 <= y0:
        return
    sub = img[y0:y1, x0:x1].copy()
    off = (x0 << SH, y0 << SH)
    cv2.line(sub, (a[0] - off[0], a[1] - off[1]), (b[0] - off[0], b[1] - off[1]), color, max(1, int(round(thick))), cv2.LINE_AA, SH)
    img[y0:y1, x0:x1] = cv2.addWeighted(sub, alpha, img[y0:y1, x0:x1], 1 - alpha, 0)

def dim_outside(img: np.ndarray, rect, amount: float, feather: int = 28) -> None:
    """Darken everything outside rect (output coords) by amount, with a soft edge."""
    if amount <= 0.003:
        return
    x, y, w, h = rect
    mask = np.zeros((H // 4, W // 4), np.float32)
    cv2.rectangle(mask, (int(x / 4), int(y / 4)), (int((x + w) / 4), int((y + h) / 4)), 1.0, -1)
    k = max(3, (feather // 4) | 1)
    mask = cv2.GaussianBlur(mask, (k * 2 + 1, k * 2 + 1), 0)
    mask = cv2.resize(mask, (W, H), interpolation=cv2.INTER_LINEAR)
    f = 1 - amount * (1 - mask)
    img[:] = cv2.multiply(img, cv2.merge([f, f, f]), dtype=cv2.CV_8U)

def dim_all(img: np.ndarray, amount: float) -> None:
    if amount > 0.003:
        cv2.convertScaleAbs(img, dst=img, alpha=1 - amount)


_CANVAS_FRAME = None

def mix_canvas(img: np.ndarray, k: float) -> None:
    """img = img * k + canvas * (1 - k), in place."""
    global _CANVAS_FRAME
    if _CANVAS_FRAME is None:
        _CANVAS_FRAME = np.empty((H, W, 3), np.uint8)
        _CANVAS_FRAME[:] = CANVAS
    cv2.addWeighted(img, k, _CANVAS_FRAME, 1 - k, 0, dst=img)

def fill_rect(img, rect, color, alpha):
    if alpha <= 0.003:
        return
    x, y, w, h = [int(round(v)) for v in rect]
    x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0:
        return
    region = img[y0:y1, x0:x1].astype(np.float32)
    img[y0:y1, x0:x1] = (region * (1 - alpha) + np.array(color, np.float32) * alpha).astype(np.uint8)

@lru_cache(maxsize=64)
def _ramp_map(h: int, w: int, side: str) -> np.ndarray:
    if side == "left":
        g = np.tile(np.linspace(1, 0, w, dtype=np.float32) ** 0.8, (h, 1))
    elif side == "bottom":
        g = np.tile((np.linspace(0, 1, h, dtype=np.float32) ** 1.2)[:, None], (1, w))
    else:
        g = np.ones((h, w), np.float32)
    return cv2.merge([g, g, g])

def gradient_panel(img, x0, y0, x1, y1, strength=0.72, side="left"):
    """A soft darkening wash toward the canvas colour behind editorial type."""
    x0, y0, x1, y1 = [int(v) for v in (x0, y0, x1, y1)]
    x0, y0, x1, y1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
    if x1 <= x0 or y1 <= y0 or strength <= 0.003:
        return
    g = _ramp_map(y1 - y0, x1 - x0, side) * strength
    region = img[y0:y1, x0:x1].astype(np.float32)
    canvas = np.array(CANVAS, np.float32)
    img[y0:y1, x0:x1] = cv2.convertScaleAbs(region + (canvas - region) * g)


# ----------------------------------------------------------------- overlay elements
@dataclass
class Ctx:
    t: float          # seconds into the shot
    dur: float        # shot duration
    T: float          # seconds into the film
    xf: tuple         # source to output transform (s, tx, ty)

Overlay = Callable[[np.ndarray, Ctx], None]

def bracket(rect_src, t0, t1, color=BRASS, arm=22, thick=2.0, label: str | None = None,
            label_color=None, label_side="above", pad=10, fin=0.32, fout=0.25, space="src", label_dy=0) -> Overlay:
    """Corner brackets that draw in around a UI region, locked to the source through the camera."""
    def draw(img, c: Ctx):
        a = ramp(c.t, t0, t1, fin, fout)
        if a <= 0:
            return
        x, y, w, h = rect_src
        if space == "src":
            (X0, Y0), (X1, Y1) = to_out(c.xf, x, y), to_out(c.xf, x + w, y + h)
        else:
            X0, Y0, X1, Y1 = x, y, x + w, y + h
        X0, Y0, X1, Y1 = X0 - pad, Y0 - pad, X1 + pad, Y1 + pad
        grow = ease_out((c.t - t0) / 0.42)
        L = arm * grow
        for (px, py, dx, dy) in ((X0, Y0, 1, 1), (X1, Y0, -1, 1), (X0, Y1, 1, -1), (X1, Y1, -1, -1)):
            aa_line(img, (px, py), (px + dx * L, py), color, thick, a)
            aa_line(img, (px, py), (px, py + dy * L), color, thick, a)
        if label:
            p = text_patch(label, "IBMPlexMono-Medium", 19, label_color or color, 0.16)
            if label_side == "right":
                lx, ly = X1 + 16, (Y0 + Y1) / 2 - p.shape[0] / 2
            elif label_side == "left":
                lx, ly = X0 - 16 - p.shape[1], (Y0 + Y1) / 2 - p.shape[0] / 2
            elif label_side == "below":
                lx, ly = X0, Y1 + 8
            else:
                lx, ly = X0, Y0 - p.shape[0] - 6
            ly += label_dy
            fill_rect(img, (lx - 6, ly - 1, p.shape[1] + 12, p.shape[0] + 2), CANVAS, 0.82 * a)
            blit(img, p, lx, ly, a)
    return draw

def rule_mark(rect_src, t0, t1, color=BRASS, thick=2.0, space="src", fin=0.4, fout=0.25) -> Overlay:
    """A thin rule drawn under a line of UI text, left to right."""
    def draw(img, c: Ctx):
        a = ramp(c.t, t0, t1, fin, fout)
        if a <= 0:
            return
        x, y, w, h = rect_src
        if space == "src":
            (X0, Y0), (X1, Y1) = to_out(c.xf, x, y), to_out(c.xf, x + w, y + h)
        else:
            X0, Y0, X1, Y1 = x, y, x + w, y + h
        g = ease_io((c.t - t0) / 0.5)
        aa_line(img, (X0, Y1 + 6), (X0 + (X1 - X0) * g, Y1 + 6), color, thick, a)
    return draw

def spotlight(rect_src, t0, t1, amount=0.5, pad=16, fin=0.4, fout=0.3, space="src") -> Overlay:
    def draw(img, c: Ctx):
        a = ramp(c.t, t0, t1, fin, fout)
        if a <= 0:
            return
        x, y, w, h = rect_src
        if space == "src":
            (X0, Y0), (X1, Y1) = to_out(c.xf, x, y), to_out(c.xf, x + w, y + h)
        else:
            X0, Y0, X1, Y1 = x, y, x + w, y + h
        dim_outside(img, (X0 - pad, Y0 - pad, X1 - X0 + 2 * pad, Y1 - Y0 + 2 * pad), amount * a)
    return draw

def label(text, x, y, t0, t1, color=INK2, size=19, fname="IBMPlexMono-Medium", tracking=0.18, fin=0.3, fout=0.3, anchor="lt") -> Overlay:
    def draw(img, c: Ctx):
        a = ramp(c.t, t0, t1, fin, fout)
        if a <= 0:
            return
        p = text_patch(text, fname, size, color, tracking)
        X = x - (p.shape[1] if anchor[0] == "r" else p.shape[1] / 2 if anchor[0] == "c" else 0)
        Y = y - (p.shape[0] if anchor[1] == "b" else p.shape[0] / 2 if anchor[1] == "c" else 0)
        blit(img, p, X, Y, a)
    return draw

def chapter(num: str, title: str, sub: str, t0: float, t1: float) -> Overlay:
    """Bottom-left chapter mark: a short brass rule, then '02  THE BOARD' and a quieter context line."""
    def draw(img, c: Ctx):
        a = ramp(c.t, t0, t1, 0.35, 0.4)
        if a <= 0:
            return
        x, y = 72, H - 92
        gradient_panel(img, 0, H - 270, W, H - 150, 0.95 * a, "bottom")
        fill_rect(img, (0, H - 150, W, 150), CANVAS, 0.95 * a)
        g = ease_io((c.t - t0) / 0.45)
        aa_line(img, (x, y - 14), (x + 40 * g, y - 14), BRASS, 2.0, a)
        p1 = text_patch(num, "IBMPlexMono-Medium", 20, BRASS, 0.18)
        p2 = text_patch(title, "IBMPlexMono-Medium", 20, INK, 0.2)
        blit(img, p1, x, y, a)
        blit(img, p2, x + p1.shape[1] + 18, y, a)
        if sub:
            p3 = text_patch(sub, "IBMPlexMono-Regular", 17, INK3, 0.16)
            blit(img, p3, x, y + 30, a * ramp(c.t, t0 + 0.25, t1, 0.35, 0.4))
    return draw

def statement(lines: list[tuple[str, tuple]], x, y, t0, t1, size=46, fname="GeneralSans-Medium", lead=1.18,
              panel=True, stagger=0.18, anchor="left") -> Overlay:
    """Editorial type set over footage. lines: [(text, color)]. Each line fades up in turn."""
    def draw(img, c: Ctx):
        a = ramp(c.t, t0, t1, 0.4, 0.35)
        if a <= 0:
            return
        if panel:
            gradient_panel(img, 0, 0, x + 1150, H, 0.78 * a, "left")
        yy = y
        for i, (txt, col) in enumerate(lines):
            p = text_patch(txt, fname, size, col, -0.01)
            ai = a * ramp(c.t, t0 + i * stagger, t1, 0.4, 0.35)
            X = x if anchor == "left" else x - p.shape[1] / 2
            blit(img, p, X, yy, ai)
            yy += size * lead
    return draw

def custom(fn: Callable[[np.ndarray, Ctx], None]) -> Overlay:
    return fn


# ----------------------------------------------------------------- shots and transitions
@dataclass
class Shot:
    src: str
    t_in: float
    dur: float
    cam: Cam | None = None
    speed: float = 1.0
    overlays: list = field(default_factory=list)
    trans: str = "cut"          # transition into this shot: cut | fade | seam | seamv | dip
    tdur: float = 0.0           # overlap with the previous shot
    matrix: str = "bt709"
    bounds: tuple = (98, 120, 1704, 958)
    pip: dict | None = None     # magnified insert: {rect: src rect, dest: (x, y, h), dim: 0.6, label}
    base_dim: float = 0.0
    name: str = ""
    fade_in: float = 0.0        # from canvas
    fade_out: float = 0.0       # to canvas

    def nframes(self) -> int:
        return int(round(self.dur * FPS))

    def src_frames_needed(self) -> int:
        return int(math.ceil(self.dur * self.speed * FPS)) + 3


def render_shot_frame(shot: Shot, reader: Reader, i: int, T: float) -> np.ndarray:
    t = i / FPS
    src_idx = int(math.floor(t * shot.speed * FPS + 1e-6))
    frame = reader.get(src_idx)
    u = t / max(1e-6, shot.dur)
    cam = shot.cam or cam_static(*OP_CAM)
    cx, cy, w = cam.at(u)
    out, xf = frame_cam(frame, cx, cy, w, shot.bounds)
    if shot.base_dim:
        dim_all(out, shot.base_dim)
    if shot.pip:
        pp = shot.pip
        a = ramp(t, pp.get("t0", 0), pp.get("t1", shot.dur + 1), pp.get("fin", 0.3), pp.get("fout", 0.25))
        dim_all(out, pp.get("dim", 0.62) * a)
        rx, ry, rw, rh = pp["rect"]
        dx, dy, dh = pp["dest"]
        scale = dh / rh
        dw = rw * scale
        crop = frame[ry:ry + rh, rx:rx + rw]
        ins = cv2.resize(crop, (int(round(dw)), int(round(dh))), interpolation=cv2.INTER_LANCZOS4 if scale > 1 else cv2.INTER_AREA)
        # slide up 18 px as it appears
        oy = int(round(dy + 18 * (1 - ease_out(clamp01((t - pp.get("t0", 0)) / 0.35)))))
        ox = int(round(dx))
        h2, w2 = ins.shape[:2]
        y0, y1 = max(0, oy), min(H, oy + h2)
        x0, x1 = max(0, ox), min(W, ox + w2)
        region = out[y0:y1, x0:x1].astype(np.float32)
        out[y0:y1, x0:x1] = (region * (1 - a) + ins[y0 - oy:y1 - oy, x0 - ox:x1 - ox].astype(np.float32) * a).astype(np.uint8)
        # hairline frame
        for (p0, p1) in (((ox - 1, oy - 1), (ox + w2, oy - 1)), ((ox + w2, oy - 1), (ox + w2, oy + h2)),
                         ((ox + w2, oy + h2), (ox - 1, oy + h2)), ((ox - 1, oy + h2), (ox - 1, oy - 1))):
            aa_line(out, p0, p1, INK3, 1.0, 0.6 * a)
        if pp.get("label"):
            p = text_patch(pp["label"], "IBMPlexMono-Medium", 18, INK2, 0.16)
            blit(out, p, ox, oy - p.shape[0] - 10, a)
    c = Ctx(t=t, dur=shot.dur, T=T, xf=xf)
    for ov in shot.overlays:
        ov(out, c)
    if shot.fade_in and t < shot.fade_in:
        mix_canvas(out, ease_io(t / shot.fade_in))
    if shot.fade_out and t > shot.dur - shot.fade_out:
        mix_canvas(out, ease_io((shot.dur - t) / shot.fade_out))
    return out


def blend_transition(a: np.ndarray, b: np.ndarray, kind: str, p: float) -> np.ndarray:
    """a is the outgoing frame, b the incoming, p in [0, 1]."""
    if kind == "fade":
        k = ease_io(p)
        return cv2.addWeighted(b, k, a, 1 - k, 0)
    if kind == "dip":
        k = ease_io(p)
        if k < 0.5:
            out = a.copy()
            mix_canvas(out, 1 - k * 2)
            return out
        out = b.copy()
        mix_canvas(out, (k - 0.5) * 2)
        return out
    if kind in ("seam", "seamv"):
        k = ease_io(p)
        out = a.copy()
        if kind == "seam":  # vertical seam travelling left to right, revealing b behind it
            x = int(round(k * (W + 40))) - 20
            if x > 0:
                out[:, :min(W, x)] = b[:, :min(W, x)]
            aa_line(out, (x + 0.5, 0), (x + 0.5, H), BRASS, 2.0, 0.95 * (1 - abs(2 * k - 1) ** 6))
            aa_line(out, (x - 5.5, 0), (x - 5.5, H), INK, 1.0, 0.25 * (1 - abs(2 * k - 1) ** 6))
        else:  # horizontal seam travelling top to bottom
            y = int(round(k * (H + 40))) - 20
            if y > 0:
                out[:min(H, y)] = b[:min(H, y)]
            aa_line(out, (0, y + 0.5), (W, y + 0.5), BRASS, 2.0, 0.95 * (1 - abs(2 * k - 1) ** 6))
        return out
    return b


class Encoder:
    def __init__(self, out: str, preview: bool = False):
        args = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgr24",
                "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-"]
        if preview:
            args += ["-vf", "scale=1280:720", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23"]
        else:
            args += ["-vf", "scale=out_color_matrix=bt709:out_range=tv", "-c:v", "libx264", "-preset", "slow", "-crf", "14",
                     "-profile:v", "high", "-level", "4.2", "-x264-params", "keyint=60:min-keyint=30:aq-mode=3",
                     "-tune", "stillimage"]
        args += ["-pix_fmt", "yuv420p", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
                 "-movflags", "+faststart", out]
        self.p = subprocess.Popen(args, stdin=subprocess.PIPE)
        self.n = 0

    def write(self, frame: np.ndarray) -> None:
        self.p.stdin.write(np.ascontiguousarray(frame).tobytes())
        self.n += 1

    def close(self) -> None:
        self.p.stdin.close()
        self.p.wait()


def timeline_starts(shots: list[Shot]) -> list[float]:
    starts, t = [], 0.0
    for i, s in enumerate(shots):
        if i > 0:
            t -= s.tdur
        starts.append(t)
        t += s.dur
    return starts


def render(shots: list[Shot], out: str, globals_: list | None = None, preview: bool = False,
           t_from: float = 0.0, t_to: float | None = None, log=print) -> float:
    """Render shots in order with overlapping transitions. globals_ are overlays in film time."""
    starts = timeline_starts(shots)
    total = starts[-1] + shots[-1].dur
    t_to = total if t_to is None else min(t_to, total)
    enc = Encoder(out, preview)
    nfr = int(round(t_to * FPS))
    first = int(round(t_from * FPS))
    readers: dict[int, Reader] = {}

    def get_reader(k: int) -> Reader:
        if k not in readers:
            s = shots[k]
            # start the reader at the source time of the first frame this render needs from the shot
            readers[k] = Reader(s.src, s.t_in, s.src_frames_needed(), s.matrix)
        return readers[k]

    active_prev = -1
    for f in range(first, nfr):
        T = f / FPS
        # shots covering T
        idx = [k for k, st in enumerate(starts) if st - 1e-9 <= T < st + shots[k].dur - 1e-9]
        if not idx:
            idx = [len(shots) - 1]
        for k in list(readers):
            if k < min(idx):
                readers[k].close()
                del readers[k]
        frames = []
        for k in idx:
            i = int(round((T - starts[k]) * FPS))
            frames.append(render_shot_frame(shots[k], get_reader(k), i, T))
        if len(frames) == 2:
            k = idx[1]
            p = (T - starts[k]) / max(1e-6, shots[k].tdur)
            frame = blend_transition(frames[0], frames[1], shots[k].trans, p)
        else:
            frame = frames[-1]
        if globals_:
            c = Ctx(t=T, dur=total, T=T, xf=(1, 0, 0))
            for g in globals_:
                g(frame, c)
        enc.write(frame)
        if idx[-1] != active_prev:
            active_prev = idx[-1]
            log(f"  {T:7.2f}s  shot {idx[-1]:02d} {shots[idx[-1]].name}")
    for r in readers.values():
        r.close()
    enc.close()
    return total
