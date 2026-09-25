"""build_audio2.py: the v2 soundtrack. Narration clips placed word-exactly from vo_plan.json (written by
kerb_film2.py export), the opening of the supplied music under a ducking envelope, three accents, -14 LUFS."""
from __future__ import annotations

import json
import subprocess
import sys

import numpy as np

sys.path.insert(0, "/root/kerb/scripts/demo-video")
from build_audio import (MUSIC, MUSIC_BASE_GAIN, MUSIC_CUT, MUSIC_IN_GAPS, MUSIC_UNDER_SPEECH, OUT, ROOT, SR,  # noqa: E402
                         accent_confirm, accent_impact, accent_structure, db, decode, loudness, measure, place, smooth_env,
                         write_wav)


def main() -> None:
    plan = json.load(open(f"{ROOT}/artifacts/demo-video/vo_plan.json"))
    total = plan["runtime"]
    N = int(round(total * SR))
    # narration: even out take levels using each whole take, then place the cut clips
    segs = sorted({c["seg"] for c in plan["clips"]})
    lv = {s: loudness(decode(f"{ROOT}/artifacts/demo-video/voice/{s}.mp3")) for s in segs}
    ref = float(np.median(list(lv.values())))
    vo = np.zeros((N, 2), np.float32)
    for c in plan["clips"]:
        x = decode(f"{ROOT}/artifacts/demo-video/voice/{c['seg']}.mp3", c["cut_from"], c["cut_to"] - c["cut_from"])
        n = len(x)
        f = np.ones(n, np.float32)
        k = min(n // 2, int(0.012 * SR))
        f[:k] = np.linspace(0, 1, k)
        f[n - k:] = np.linspace(1, 0, k)
        place(vo, x * f[:, None], c["place"], ref - lv[c["seg"]])
    vo_lufs = loudness(vo)

    a0, a1 = MUSIC_CUT
    A = decode(MUSIC, 0, a0 + 0.3)
    B = decode(MUSIC, a1, total + 1.0 - a0 + 0.3)
    xf = int(0.3 * SR)
    r = np.linspace(0, 1, xf, dtype=np.float32)[:, None]
    music = np.concatenate([A[:-xf], A[-xf:] * (1 - r) + B[:xf] * r, B[xf:]])[:N]
    if len(music) < N:
        music = np.concatenate([music, np.zeros((N - len(music), 2), np.float32)])
    music *= db(MUSIC_BASE_GAIN)
    offset = (vo_lufs + MUSIC_UNDER_SPEECH) - loudness(music)

    rate = 1000
    n_ctl = int(total * rate) + 1
    tgt = np.full(n_ctl, MUSIC_IN_GAPS - MUSIC_UNDER_SPEECH, np.float64)
    for s0, s1 in plan["speech"]:
        tgt[max(0, int((s0 - 0.35) * rate)):min(n_ctl, int((s1 + 0.25) * rate))] = 0.0
    fl0, fl1 = plan["final_line"]
    tgt[int((fl0 - 0.5) * rate):int((fl1 + 0.2) * rate)] = -2.0
    tgt[int((fl1 + 0.2) * rate):] = MUSIC_IN_GAPS - MUSIC_UNDER_SPEECH + 2.0
    env_db = smooth_env(tgt, 0.18, 0.9) + offset
    tt = np.arange(n_ctl) / rate
    fade = np.clip(tt / 1.3, 0, 1) * np.clip((total - tt) / 3.2, 0, 1)
    env = db(env_db) * fade ** 1.5
    music *= np.interp(np.arange(N) / SR, tt, env).astype(np.float32)[:, None]

    fx = np.zeros((N, 2), np.float32)
    acc = plan["accents"]
    place(fx, accent_structure(), acc["window_in"] - 0.95, -31.0)
    place(fx, accent_impact(), acc["last_call_flip"], -13.0)
    place(fx, accent_confirm(), acc["cured"], -30.0)

    mix = vo + music + fx
    write_wav(f"{OUT}/v2_stem_voice.wav", vo)
    write_wav(f"{OUT}/v2_mix_premaster.wav", mix)
    j = measure(f"{OUT}/v2_mix_premaster.wav")
    gain = -14.0 - float(j["input_i"])
    limit = 10 ** (-1.6 / 20)
    for _ in range(4):
        subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", f"{OUT}/v2_mix_premaster.wav", "-af",
                        f"volume={gain:.3f}dB,aresample=192000,alimiter=limit={limit:.4f}:attack=4:release=60:level=false,aresample={SR}",
                        "-c:a", "pcm_s24le", f"{OUT}/v2_mix_master.wav"], check=True)
        m = measure(f"{OUT}/v2_mix_master.wav")
        if float(m["input_tp"]) <= -1.0 and abs(float(m["input_i"]) + 14) <= 0.3:
            break
        gain += -14.0 - float(m["input_i"])
    json.dump({"premaster": j, "master": m, "gain_db": gain, "runtime": total}, open(f"{OUT}/v2_mix_info.json", "w"), indent=2)
    print("master", m["input_i"], "LUFS", m["input_tp"], "dBTP LRA", m["input_lra"], "runtime", total)


if __name__ == "__main__":
    main()
