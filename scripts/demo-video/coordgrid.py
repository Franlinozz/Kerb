# coordgrid.py <video> <t> <x> <y> <w> <h> <out>: a source-pixel crop with labelled 50 px grid, for placing pointers.
import subprocess, sys, cv2, numpy as np
v, t, x, y, w, h, out = sys.argv[1], float(sys.argv[2]), *map(int, sys.argv[3:7]), sys.argv[7]
raw = subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-ss",str(t),"-i",v,"-frames:v","1","-f","rawvideo","-pix_fmt","bgr24","-"],capture_output=True).stdout
f = np.frombuffer(raw,np.uint8).reshape(1080,1920,3)[y:y+h, x:x+w].copy()
for gx in range((x//50+1)*50, x+w, 50):
    c = (0,200,255) if gx % 100 == 0 else (0,90,120)
    cv2.line(f,(gx-x,0),(gx-x,h),c,1)
    if gx % 100 == 0: cv2.putText(f,str(gx),(gx-x+2,12),cv2.FONT_HERSHEY_SIMPLEX,0.38,(0,255,255),1)
for gy in range((y//50+1)*50, y+h, 50):
    c = (0,200,255) if gy % 100 == 0 else (0,90,120)
    cv2.line(f,(0,gy-y),(w,gy-y),c,1)
    if gy % 100 == 0: cv2.putText(f,str(gy),(2,gy-y-2),cv2.FONT_HERSHEY_SIMPLEX,0.38,(0,255,255),1)
cv2.imwrite(out, f)
