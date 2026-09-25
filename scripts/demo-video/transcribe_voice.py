# transcribe_voice.py: local ASR over each narration take (the editor's "ears"): transcript, word timings, pauses.
import glob, json, os, sys
from faster_whisper import WhisperModel
m = WhisperModel(os.environ.get("ASR_MODEL", "small.en"), device="cpu", compute_type="int8")
out = json.load(open("artifacts/demo-video/voice/asr.json")) if os.path.exists("artifacts/demo-video/voice/asr.json") else {}
files = sys.argv[1:] or sorted(glob.glob("artifacts/demo-video/voice/*.mp3"))
for f in files:
    segs, _ = m.transcribe(f, word_timestamps=True, beam_size=5, vad_filter=False)
    words = [dict(w=w.word.strip(), s=round(w.start, 2), e=round(w.end, 2)) for s in segs for w in s.words]
    text = " ".join(x["w"] for x in words)
    gaps = [(round(a["e"], 2), round(b["s"] - a["e"], 2)) for a, b in zip(words, words[1:]) if b["s"] - a["e"] > 0.35]
    sid = os.path.basename(f)[:-4]
    out[sid] = dict(text=text, words=words, first=words[0]["s"] if words else None, last=words[-1]["e"] if words else None)
    print(f"== {sid}  speech {out[sid]['first']}-{out[sid]['last']}  pauses {gaps}\n   {text}")
json.dump(out, open("artifacts/demo-video/voice/asr.json", "w"), indent=1)
