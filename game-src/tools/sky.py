"""Convert an HDRI (.exr or .hdr) into the three files a world needs:
  sky/<id>.jpg   tone-mapped photo backdrop (3072 wide)
  sky/<id>.hdr   small HDR (512x256) for lighting and reflections
  sky/<id>.json  horizon colour (for fog) and sun direction (for the shadow-casting light)
usage: python3 sky.py input.exr id [exposure]"""
import sys, json, math, os
import numpy as np
from PIL import Image

def read(path):
    if path.lower().endswith('.exr'):
        import OpenEXR, Imath
        f = OpenEXR.InputFile(path); dw = f.header()['dataWindow']; W = dw.max.x - dw.min.x + 1; H = dw.max.y - dw.min.y + 1
        pt = Imath.PixelType(Imath.PixelType.FLOAT)
        return np.stack([np.frombuffer(f.channel(c, pt), dtype=np.float32).reshape(H, W) for c in 'RGB'], -1)
    import cv2
    a = cv2.imread(path, cv2.IMREAD_ANYDEPTH | cv2.IMREAD_COLOR)
    return a[..., ::-1].astype(np.float32)

def down(a, w):
    f = a.shape[1] // w
    if f <= 1: return a
    return a[:a.shape[0] // f * f, :a.shape[1] // f * f].reshape(a.shape[0] // f, f, a.shape[1] // f, f, 3).mean((1, 3))

def write_hdr(a, p):
    a = np.maximum(a, 1e-9).astype(np.float32); m = a.max(-1); e = np.ceil(np.log2(m)); sc = 256.0 / np.exp2(e)
    out = np.zeros(a.shape[:2] + (4,), np.uint8); v = m > 1e-32
    out[..., :3] = np.where(v[..., None], np.clip(a * sc[..., None], 0, 255), 0).astype(np.uint8); out[..., 3] = np.where(v, e + 128, 0).astype(np.uint8)
    with open(p, 'wb') as fh:
        fh.write(b'#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y %d +X %d\n' % a.shape[:2]); fh.write(out.tobytes())

def aces(x):
    return np.clip((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0, 1)

src, sid = sys.argv[1], sys.argv[2]; exp = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
out = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sky'); os.makedirs(out, exist_ok=True)
rgb = read(src)
H, W = rgb.shape[:2]
# sun: brightest region of a blurred copy
small = down(rgb, 256); lum = small @ np.array([0.2126, 0.7152, 0.0722])
r, c = np.unravel_index(np.argmax(lum), lum.shape); h2, w2 = lum.shape
u = (c + 0.5) / w2; v = 1 - (r + 0.5) / h2
az = (u - 0.5) * 2 * math.pi; lat = (v - 0.5) * math.pi
sun = [math.cos(lat) * math.cos(az), math.sin(lat), math.cos(lat) * math.sin(az)]
sun_strength = float(lum.max() / max(1e-6, np.median(lum)))
bg = down(rgb, 3072) * exp
img = (aces(bg) ** (1 / 2.2) * 255).astype(np.uint8)
if img.shape[1] > 3072: img = np.asarray(Image.fromarray(img).resize((3072, 1536), Image.LANCZOS))
Image.fromarray(img).save(os.path.join(out, sid + '.jpg'), quality=86, optimize=True, progressive=True)
write_hdr(np.minimum(down(rgb, 256), 12.0), os.path.join(out, sid + '.hdr'))
band = img[img.shape[0] // 2 - img.shape[0] // 40: img.shape[0] // 2 + img.shape[0] // 60].reshape(-1, 3).mean(0)
json.dump({'horizon': '#%02x%02x%02x' % tuple(int(x) for x in band), 'sun': [round(x, 4) for x in sun], 'sunStrength': round(sun_strength, 1), 'exposure': exp}, open(os.path.join(out, sid + '.json'), 'w'))
print(sid, img.shape, 'horizon', band.astype(int), 'sun', [round(x, 2) for x in sun], 'strength', round(sun_strength, 1))
