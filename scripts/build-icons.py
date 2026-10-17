"""Reproduce the existing icon.svg geometry as opaque PNG app icons.
Dev-only: run with Python + Pillow; not required by the app or npm run dev.
"""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1] / 'public'
scale = 4
image = Image.new('RGB', (512*scale, 512*scale), '#0e766e')
draw = ImageDraw.Draw(image)
def box(coords):
    return tuple(int(x*scale) for x in coords)
draw.rounded_rectangle(box((126, 102, 386, 410)), radius=24*scale, fill='white')
def line(points, color):
    points = [(x*scale, y*scale) for x,y in points]
    draw.line(points, fill=color, width=20*scale, joint='curve')
    for x,y in points:
        draw.ellipse((x-10*scale,y-10*scale,x+10*scale,y+10*scale),fill=color)
for y,end in [(186,340),(238,340),(290,284)]:
    line([(172,y),(end,y)], '#0e766e')
for points in [[(95,164),(95,94),(165,94)],[(347,94),(417,94),(417,164)],[(417,349),(417,418),(347,418)],[(165,418),(95,418),(95,349)]]:
    line(points, '#8ce2cd')
for size,name in [(180,'apple-touch-icon.png'),(192,'icon-192.png'),(512,'icon-512.png')]:
    image.resize((size,size),Image.Resampling.LANCZOS).save(root/name)
    print(name, size, 'RGB opaque')
