#!/bin/bash
# Finish the film after promo/record.js and promo/music.py:
#   promo/out/paint-your-week.mp4   full quality, for Releases
#   promo/out/readme.mp4            under 10 MB, the size GitHub accepts for an inline README video
#   docs/stills/*.jpg               one frame per feature section, caption band cropped off
set -euo pipefail
cd "$(dirname "$0")/.."
V=promo/out/video.mp4; A=promo/out/audio.wav; F=promo/out/paint-your-week.mp4
ffmpeg -loglevel error -y -i "$V" -i "$A" -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$F"
(cd promo/out && ffmpeg -loglevel error -y -i video.mp4 -c:v libx264 -preset slow -b:v 1300k -pass 1 -an -f null - &&
  ffmpeg -loglevel error -y -i video.mp4 -i audio.wav -c:v libx264 -preset slow -b:v 1300k -pass 2 -pix_fmt yuv420p \
    -c:a aac -b:a 128k -shortest -movflags +faststart readme.mp4 && rm -f ffmpeg2pass-0.log*)
mkdir -p docs/stills
for p in drag:8.8 inbox:14.2 paint:20.2 energy:24.6 month:29.0 settle:38.2 review:45.2; do
  ffmpeg -loglevel error -y -ss "${p##*:}" -i "$F" -frames:v 1 -vf "crop=1920:880:0:200,scale=1600:-1:flags=lanczos" -q:v 3 "docs/stills/${p%%:*}.jpg"
done
for f in "$F" promo/out/readme.mp4; do echo "$f  $(( $(stat -c %s "$f") / 1024 )) KB"; done
