#!/usr/bin/env bash
# grid.sh <video> <time> <out.png>  full-res frame with a 100px labelled grid, scaled to 1280 wide
set -e
ffmpeg -y -hide_banner -loglevel error -ss "$2" -i "$1" -frames:v 1 \
  -vf "drawgrid=w=100:h=100:t=1:c=yellow@0.35,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf:text='x100/y100 grid':x=4:y=4:fontsize=18:fontcolor=yellow,scale=1280:-2" "$3"
