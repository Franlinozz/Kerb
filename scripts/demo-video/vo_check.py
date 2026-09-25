# vo_check.py: narration placement against the edit. Flags overlaps and tight gaps between spoken lines.
import json, sys
sys.path.insert(0, "/root/kerb/scripts/demo-video")
import kerb_film as kf
asr = json.load(open("/root/kerb/artifacts/demo-video/voice/asr.json"))
S, G = kf.build()
sched = kf.vo_schedule(S)
starts = kf.timeline_starts(S)
total = starts[-1] + S[-1].dur
prev_end = 0
for seg, t in sched:
    sp = asr[seg]["last"]
    gap = t - prev_end
    flag = "  <-- OVERLAP" if gap < 0 else ("  <-- tight" if gap < 0.6 else "")
    print(f"{seg:<16} {t:7.2f} -> {t + sp:7.2f}   gap before {gap:5.2f}{flag}")
    prev_end = t + sp
print(f"film {total:.2f}s, tail after last word {total - prev_end:.2f}s")
