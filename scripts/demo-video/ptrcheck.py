# ptrcheck.py: every pointer target drawn as a crosshair on the source frame shown at that moment.
import subprocess, sys, cv2, numpy as np
sys.path.insert(0, ".")
import kerb_film2 as k
f = k.Film()
tiles = []
for i, (t0, t1, take, pt) in enumerate(f.pointers):
    t = f.by[take]
    tm = min(t1, t0 + 0.6)
    s = t.src_t(tm)
    raw = subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-ss",f"{s:.3f}","-i",t.src,"-frames:v","1","-f","rawvideo","-pix_fmt","bgr24","-"],capture_output=True).stdout
    fr = np.frombuffer(raw,np.uint8).reshape(1080,1920,3).copy()
    x, y = map(int, pt)
    cv2.line(fr,(x-40,y),(x+40,y),(0,0,255),1); cv2.line(fr,(x,y-40),(x,y+40),(0,0,255),1); cv2.circle(fr,(x,y),4,(0,0,255),-1)
    x0, y0 = max(0, x-300), max(0, y-110)
    c = fr[y0:y0+220, x0:x0+600]
    c = cv2.copyMakeBorder(c, 0, 220-c.shape[0], 0, 600-c.shape[1], cv2.BORDER_CONSTANT)
    cv2.putText(c, f"{i} {take} src{s:.1f} {pt}", (4,14), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0,255,255), 1)
    tiles.append(c)
while len(tiles) % 3: tiles.append(np.zeros_like(tiles[0]))
rows = [np.hstack(tiles[i:i+3]) for i in range(0, len(tiles), 3)]
for j in range(0, len(rows), 5):
    cv2.imwrite(f"/root/kerb/artifacts/demo-video/stills2/ptr_{j//5}.png", np.vstack(rows[j:j+5]))
print(len(f.pointers))
