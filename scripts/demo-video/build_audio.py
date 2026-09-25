"""build_audio.py: the film's sound. Narration on the edit's anchors, the opening of the supplied
music under it with a deterministic ducking envelope, three synthesised accents, then a two-pass
EBU R128 master at -14 LUFS integrated and -1 dBTP.

  python build_audio.py            -> artifacts/demo-video/audio/mix_master.wav (+ stems)
"""
from __future__ import annotations

import json
import subprocess
import sys

import numpy as np

sys.path.insert(0, "/root/kerb/scripts/demo-video")
import kerb_film as kf  # noqa: E402

ROOT = "/root/kerb"
OUT = f"{ROOT}/artifacts/demo-video/audio"
MUSIC = f"{ROOT}/docs/audio_background/Audio compilation.mp3"
SR = 48000

# Music: the opening of the compilation. One edit only: the silent middle of the gap between the
# second and third tracks (149.5 to 152.9 s, below -35 dB) is removed with a 0.3 s crossfade.
MUSIC_CUT = (149.5, 152.9)

# Mix targets (dB relative to the narration level).
MUSIC_UNDER_SPEECH = -21.0
MUSIC_IN_GAPS = -16.5
MUSIC_BASE_GAIN = -13.0     # music file (-11.9 LUFS) down to about -25 LUFS before automation


def decode(path: str, start: float = 0.0, dur: float | None = None) -> np.ndarray:
    args = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-ss", str(start), "-i", path]
    if dur is not None:
        args += ["-t", str(dur)]
    args += ["-ac", "2", "-ar", str(SR), "-f", "f32le", "-"]
    raw = subprocess.run(args, capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()


def db(x: float) -> float:
    return 10 ** (x / 20)


def loudness(x: np.ndarray) -> float:
    p = subprocess.run(["ffmpeg", "-hide_banner", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-", "-af", "ebur128", "-f", "null", "-"],
                       input=x.astype(np.float32).tobytes(), capture_output=True)
    txt = p.stderr.decode()
    tail = txt[txt.rfind("Summary"):]
    for line in tail.splitlines():
        if line.strip().startswith("I:"):
            return float(line.split()[1])
    raise RuntimeError("no loudness")


def smooth_env(targets: np.ndarray, attack_s: float, release_s: float) -> np.ndarray:
    """One-pole smoothing of a gain curve (dB) at 1 kHz control rate, then upsampled."""
    rate = 1000
    n = len(targets)
    out = np.empty(n, np.float64)
    cur = targets[0]
    a_up = np.exp(-1 / (release_s * rate))
    a_dn = np.exp(-1 / (attack_s * rate))
    for i in range(n):
        tgt = targets[i]
        a = a_dn if tgt < cur else a_up
        cur = a * cur + (1 - a) * tgt
        out[i] = cur
    return out


# ------------------------------------------------------------------ accents (synthesised, no samples)
def accent_structure(dur=1.6) -> np.ndarray:
    """Soft structural transition: a filtered air swell with a faint low body."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(7)
    noise = rng.standard_normal(n)
    # crude low-pass by cumulative averaging
    k = 60
    lp = np.convolve(noise, np.ones(k) / k, mode="same")
    env = np.clip(t / (dur * 0.62), 0, 1) ** 2 * np.exp(-np.clip(t - dur * 0.62, 0, None) * 9)
    body = np.sin(2 * np.pi * 62 * t) * np.exp(-np.clip(t - dur * 0.6, 0, None) * 6) * np.clip(t / (dur * 0.6), 0, 1)
    x = lp * env * 0.6 + body * 0.25 * env
    x /= np.abs(x).max()
    return np.stack([x * 0.95, x], axis=1).astype(np.float32)


def accent_impact(dur=2.8) -> np.ndarray:
    """Low structural impact for Last Call: a sub drop with a soft transient, no boom-trailer cliche."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 34 + 22 * np.exp(-t * 5.5)                      # 56 Hz falling to 34 Hz
    phase = 2 * np.pi * np.cumsum(f) / SR
    sub = np.sin(phase) * np.exp(-t * 1.7)
    harm = np.sin(2 * phase) * 0.22 * np.exp(-t * 3.2)
    rng = np.random.default_rng(11)
    click = rng.standard_normal(n) * np.exp(-t * 55)
    click = np.convolve(click, np.ones(24) / 24, mode="same") * 0.5
    attack = np.clip(t / 0.006, 0, 1)
    x = (sub + harm + click) * attack
    x /= np.abs(x).max()
    return np.stack([x, x], axis=1).astype(np.float32)


def accent_confirm(dur=1.9) -> np.ndarray:
    """Restrained confirmation: two soft sine partials, a fifth apart, slow decay."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    env = np.clip(t / 0.012, 0, 1) * np.exp(-t * 2.6)
    a = np.sin(2 * np.pi * 659.25 * t) + 0.55 * np.sin(2 * np.pi * 987.77 * t) + 0.12 * np.sin(2 * np.pi * 1318.5 * t)
    env2 = np.clip((t - 0.09) / 0.012, 0, 1) * np.exp(-np.clip(t - 0.09, 0, None) * 2.6)
    b = 0.6 * np.sin(2 * np.pi * 987.77 * t) * env2
    x = a * env + b
    x /= np.abs(x).max()
    left = x
    right = np.concatenate([np.zeros(int(0.004 * SR)), x[: n - int(0.004 * SR)]])   # a hair of width
    return np.stack([left, right], axis=1).astype(np.float32)


def place(bus: np.ndarray, clip: np.ndarray, t: float, gain_db: float) -> None:
    i = int(round(t * SR))
    j = min(len(bus), i + len(clip))
    if j > i:
        bus[i:j] += clip[: j - i] * db(gain_db)


def main() -> None:
    import os
    os.makedirs(OUT, exist_ok=True)
    S, _ = kf.build()
    starts = kf.timeline_starts(S)
    total = starts[-1] + S[-1].dur
    N = int(round(total * SR))
    names = [s.name for s in S]

    # ---------------- narration
    asr = json.load(open(f"{ROOT}/artifacts/demo-video/voice/asr.json"))
    vo = np.zeros((N, 2), np.float32)
    speech_spans = []
    levels = []
    segs = {}
    for seg, t in kf.vo_schedule(S):
        x = decode(f"{ROOT}/artifacts/demo-video/voice/{seg}.mp3")
        segs[seg] = (t, x)
        levels.append(loudness(x))
    ref = float(np.median(levels))
    for (seg, (t, x)), lvl in zip(segs.items(), levels):
        g = ref - lvl                      # even out take-to-take level differences
        place(vo, x, t, g)
        speech_spans.append((t + asr[seg]["first"], t + asr[seg]["last"]))
    vo_lufs = loudness(vo)

    # ---------------- music bed: opening of the compilation, one silent-gap splice
    a0, a1 = MUSIC_CUT
    need = total + 1.0
    A = decode(MUSIC, 0, a0 + 0.3)
    B = decode(MUSIC, a1, need - a0 + 0.3)
    xf = int(0.3 * SR)
    ramp = np.linspace(0, 1, xf, dtype=np.float32)[:, None]
    music = np.concatenate([A[:-xf], A[-xf:] * (1 - ramp) + B[:xf] * ramp, B[xf:]])[:N]
    if len(music) < N:
        music = np.concatenate([music, np.zeros((N - len(music), 2), np.float32)])
    music *= db(MUSIC_BASE_GAIN)
    music_lufs = loudness(music)
    # gain so that "under speech" sits MUSIC_UNDER_SPEECH below the narration's loudness
    offset = (vo_lufs + MUSIC_UNDER_SPEECH) - music_lufs

    # ---------------- ducking envelope (control rate 1 kHz)
    rate = 1000
    n_ctl = int(total * rate) + 1
    tgt = np.full(n_ctl, MUSIC_IN_GAPS - MUSIC_UNDER_SPEECH, np.float64)   # relative to the under-speech level
    for s0, s1 in speech_spans:
        i0, i1 = max(0, int((s0 - 0.35) * rate)), min(n_ctl, int((s1 + 0.25) * rate))
        tgt[i0:i1] = 0.0
    # the final line: keep the bed a touch lower while it is spoken, then let it open
    fl0, fl1 = speech_spans[-1]
    tgt[int((fl0 - 0.5) * rate):int((fl1 + 0.2) * rate)] = -2.0
    tgt[int((fl1 + 0.2) * rate):] = MUSIC_IN_GAPS - MUSIC_UNDER_SPEECH + 1.5
    env_db = smooth_env(tgt, attack_s=0.18, release_s=0.9) + offset
    # fades: 1.3 s in, 3.0 s out
    tt = np.arange(n_ctl) / rate
    fade = np.clip(tt / 1.3, 0, 1) * np.clip((total - tt) / 3.0, 0, 1)
    env = db(env_db) * fade ** 1.5
    env_s = np.interp(np.arange(N) / SR, tt, env).astype(np.float32)
    music *= env_s[:, None]

    # ---------------- accents (three, no more)
    fx = np.zeros((N, 2), np.float32)
    seam_board = starts[names.index("board header")]
    flip = starts[names.index("countdown")] + kf.LAST_CALL_FLIP_SRC - 14.4
    cured = starts[names.index("cured")] + kf.CURED_SRC - 56.8
    place(fx, accent_structure(), seam_board - 0.95, -31.0)
    place(fx, accent_impact(), flip, -13.0)
    place(fx, accent_confirm(), cured, -30.0)
    fx *= db(vo_lufs - loudness(vo)) if False else 1.0

    # ---------------- sum, master
    mix = vo + music + fx
    write_wav(f"{OUT}/stem_voice.wav", vo)
    write_wav(f"{OUT}/stem_music.wav", music)
    write_wav(f"{OUT}/stem_fx.wav", fx)
    write_wav(f"{OUT}/mix_premaster.wav", mix)
    # master: linear gain to -14 LUFS, then a gentle look-ahead limiter so true peak stays under -1 dBTP
    j = measure(f"{OUT}/mix_premaster.wav")
    gain = -14.0 - float(j["input_i"])
    limit = 10 ** (-1.6 / 20)
    for attempt in range(4):
        subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", f"{OUT}/mix_premaster.wav", "-af",
                        f"volume={gain:.3f}dB,aresample=192000,alimiter=limit={limit:.4f}:attack=4:release=60:level=false,aresample={SR}",
                        "-c:a", "pcm_s24le", f"{OUT}/mix_master.wav"], check=True)
        m = measure(f"{OUT}/mix_master.wav")
        if float(m["input_tp"]) <= -1.0 and abs(float(m["input_i"]) + 14) <= 0.3:
            break
        gain += -14.0 - float(m["input_i"])
        if float(m["input_tp"]) > -1.0:
            limit *= 10 ** ((-1.0 - float(m["input_tp"]) - 0.2) / 20)
    j = {"premaster": j, "master": m, "gain_db": round(gain, 2)}
    info = {
        "runtime": round(total, 3), "narration_lufs_premaster": round(vo_lufs, 2), "music_offset_db": round(offset, 2),
        "master_measure": j, "anchors": {"board_seam": round(seam_board, 3), "last_call_flip": round(flip, 3), "cured": round(cured, 3)},
        "music_cut": MUSIC_CUT, "narration": kf.vo_schedule(S),
    }
    json.dump(info, open(f"{OUT}/mix_info.json", "w"), indent=2)
    print(json.dumps({k: v for k, v in info.items() if k not in ("master_measure", "narration")}, indent=1))
    print("premaster", j["premaster"]["input_i"], "LUFS", j["premaster"]["input_tp"], "dBTP | master", j["master"]["input_i"], "LUFS",
          j["master"]["input_tp"], "dBTP, LRA", j["master"]["input_lra"], "| gain", j["gain_db"])


def measure(path: str) -> dict:
    p = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af", "loudnorm=I=-14:TP=-1:LRA=11:print_format=json", "-f", "null", "-"],
                       capture_output=True)
    err = p.stderr.decode()
    return json.loads(err[err.rfind("{"):err.rfind("}") + 1])


def write_wav(path: str, x: np.ndarray) -> None:
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-f", "f32le", "-ar", str(SR), "-ac", "2", "-i", "-",
                    "-c:a", "pcm_f32le", path], input=x.astype(np.float32).tobytes(), check=True)


if __name__ == "__main__":
    main()
