# motion_profile.py: per-clip scroll/motion map at 10 fps (mean abs frame diff on a 192x108 grey proxy).
# '.' still, '-' small change (cursor, ticking clock), '#' scroll or page change.
import subprocess, sys, numpy as np, glob, os
for f in sorted(glob.glob('docs/demo_video_scenes/*.mp4')):
    raw = subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-i',f,'-vf','fps=10,crop=1704:958:98:120,scale=192:108,format=gray','-f','rawvideo','-'],capture_output=True).stdout
    a = np.frombuffer(raw,np.uint8).reshape(-1,108,192).astype(np.int16)
    d = np.abs(np.diff(a,axis=0)).mean(axis=(1,2))
    s = ''.join('.' if v<0.08 else ('-' if v<0.8 else '#') for v in d)
    name=os.path.basename(f)[:3]
    print(name, 'len', len(a)/10)
    for i in range(0,len(s),100): print(f'  {i/10:5.1f}s |{s[i:i+100]}')
