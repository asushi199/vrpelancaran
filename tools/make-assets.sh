#!/usr/bin/env sh
# Rebuilds the VR scene images from assets/Peluncuran.mp4 (needs ffmpeg + node).
#   assets/Orb_firstframe_final.png  first frame of the film (visual reference)
#   assets/orb-sprite.png            the orb cut out of that frame, background removed
#                                    (drawn with additive blending over the VR sky)
#   assets/sky-galaxy.jpg            360° equirectangular galaxy sky
set -e
cd "$(dirname "$0")/.."

ffmpeg -v error -y -i assets/Peluncuran.mp4 -frames:v 1 assets/Orb_firstframe_final.png

# 768px square around the orb (diameter ~340px at 1920x1080). Subtract the measured
# background blue, then fade out beyond the glow so no square edge shows in VR.
M="clip((330-hypot(X-384\,Y-384))/140\,0\,1)"
ffmpeg -v error -y -i assets/Orb_firstframe_final.png -vf \
  "crop=768:768:576:156,format=gbrp,geq=r='max(0\,r(X\,Y)-16)*pow($M\,1.6)':g='max(0\,g(X\,Y)-32)*pow($M\,1.6)':b='max(0\,b(X\,Y)-66)*pow($M\,1.6)',format=rgb24" \
  assets/orb-sprite.png

node tools/make-sky.js 4096
ffmpeg -v error -y -i assets/sky-galaxy.ppm -q:v 3 assets/sky-galaxy.jpg
rm assets/sky-galaxy.ppm
ls -lh assets/Orb_firstframe_final.png assets/orb-sprite.png assets/sky-galaxy.jpg
