"""build_srt.py: captions from the narration as spoken. Text is the script (voiceover.json), cut into
readable cues at sentence and clause boundaries; timing comes from the ASR word timestamps of each take
placed at its film anchor. Max 2 lines of 42 characters, cue duration 1.2 to 6.5 s.
"""
from __future__ import annotations

import json
import re
import sys

sys.path.insert(0, "/root/kerb/scripts/demo-video")
import kerb_film as kf  # noqa: E402

ROOT = "/root/kerb"
MAXLINE = 42


def chunks(text: str) -> list[str]:
    sents = re.split(r"(?<=[.?!])\s+", text.strip())
    out = []
    for s in sents:
        if len(s) <= MAXLINE * 2:
            out.append(s)
            continue
        parts = re.split(r"(?<=,)\s+", s)
        cur = ""
        for p in parts:
            if cur and len(cur) + 1 + len(p) > MAXLINE * 2:
                out.append(cur)
                cur = p
            else:
                cur = f"{cur} {p}".strip()
        if cur:
            out.append(cur)
    # hard-split anything still too long at the word nearest the middle
    final = []
    for c in out:
        while len(c) > MAXLINE * 2:
            words = c.split()
            k = len(words) // 2
            final.append(" ".join(words[:k]))
            c = " ".join(words[k:])
        final.append(c)
    return final


def wrap(c: str) -> str:
    if len(c) <= MAXLINE:
        return c
    words = c.split()
    best = None
    for k in range(1, len(words)):
        a, b = " ".join(words[:k]), " ".join(words[k:])
        if len(a) <= MAXLINE and len(b) <= MAXLINE:
            score = abs(len(a) - len(b))
            if best is None or score < best[0]:
                best = (score, a, b)
    return f"{best[1]}\n{best[2]}" if best else c


def ts(t: float) -> str:
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def main() -> None:
    cfg = json.load(open(f"{ROOT}/docs/demo_video/voiceover.json"))
    # captions use the written forms; the script spells some terms out for the voice
    display = [("x four oh two", "x402"), ("C one percent", "C(1%)"), ("Kerb Quote", "KerbQuote"),
               ("one percent price impact", "1% price impact"), ("ten percent", "10%"), ("six of ten", "6 of 10"),
               ("X Layer", "X\u00a0Layer")]
    text = {}
    for seg in cfg["segments"]:
        t = seg["text"]
        for a, b in display:
            t = t.replace(a, b)
        text[seg["id"]] = t
    asr = json.load(open(f"{ROOT}/artifacts/demo-video/voice/asr.json"))
    S, _ = kf.build()
    cues = []
    for seg, t0 in kf.vo_schedule(S):
        words = asr[seg]["words"]
        cs = chunks(text[seg])
        # distribute ASR words over chunks by word count of the script chunks
        counts = [len(c.split()) for c in cs]
        total = sum(counts)
        n = len(words)
        idx = 0
        for c, k in zip(cs, counts):
            j = min(n, idx + max(1, round(k * n / total)))
            if c is cs[-1]:
                j = n
            s = t0 + words[idx]["s"]
            e = t0 + words[j - 1]["e"]
            cues.append([s, e, wrap(c)])
            idx = j
    # durations: pad ends a little, never overlap, respect minimums
    for i, c in enumerate(cues):
        nxt = cues[i + 1][0] if i + 1 < len(cues) else c[1] + 2
        c[1] = min(max(c[1] + 0.25, c[0] + 1.2), nxt - 0.04)
    with open(f"{ROOT}/artifacts/demo-video/Kerb_OKX_Dev_Day_Demo.srt", "w") as f:
        for i, (s, e, t) in enumerate(cues, 1):
            f.write(f"{i}\n{ts(s)} --> {ts(e)}\n{t.replace(chr(160), ' ')}\n\n")
    print(f"{len(cues)} cues")


if __name__ == "__main__":
    main()
