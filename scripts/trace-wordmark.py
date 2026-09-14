"""Trace the supplied transparent wordmark into build-time SVG outlines.
Usage: python scripts/trace-wordmark.py path/to/reference.png
Requires Pillow, NumPy and SciPy only for this offline conversion.
"""
import sys, json
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

mask = np.asarray(Image.open(sys.argv[1]).convert('RGBA'))[:, :, 3] > 127
labels, _ = ndimage.label(mask)
sizes = np.bincount(labels.ravel())
mask &= sizes[labels] > 80
height, width = mask.shape
yy, xx = np.indices(mask.shape)
# Separate the connected lettering along its natural joins. Original coordinates
# are retained so the five meshes reassemble into the supplied silhouette.
seam = np.interp(np.arange(height), [205, 450, 480, 530, 650, 712], [440, 440, 445, 413, 365, 330])[:, None]
regions = [xx < seam, (xx >= seam) & (xx < 760), (xx >= 760) & (xx < 1130), (xx >= 1130) & (xx < 1520), xx >= 1520]
# The D curve overlaps the i's horizontal range. Separate the detached i
# components rather than cutting both letter contours at a vertical boundary.
i_components = np.unique(labels[mask & (xx > 1540)])
i_mask = np.isin(labels, i_components[i_components != 0])
regions[3] = (xx >= 1130) & ~i_mask
regions[4] = i_mask
# The small left serif of D sits just across the A/D boundary.
aa_labels, _ = ndimage.label(mask & regions[2])
aa_sizes = np.bincount(aa_labels.ravel()); aa_sizes[0] = 0
d_serif = (aa_labels != 0) & (aa_labels != int(np.argmax(aa_sizes)))
regions[2] &= ~d_serif
regions[3] |= d_serif
# Keep the detached end of the S bowl with S, rather than carrying it as
# an isolated fragment when the first A moves during its writing sequence.
a_labels, _ = ndimage.label(mask & regions[1])
a_sizes = np.bincount(a_labels.ravel()); a_sizes[0] = 0
main_a = int(np.argmax(a_sizes))
fragments = (a_labels != 0) & (a_labels != main_a)
regions[0] |= fragments
regions[1] &= ~fragments
scale = 70 / 500

def simplify(points, tolerance=1.2):
    if len(points) < 3: return points
    a, b = points[0], points[-1]
    delta = b - a
    if np.dot(delta, delta) == 0: distances = np.linalg.norm(points-a, axis=1)
    else: distances = np.abs(delta[0]*(a[1]-points[:,1]) - (a[0]-points[:,0])*delta[1])/np.linalg.norm(delta)
    k = int(np.argmax(distances))
    if distances[k] <= tolerance: return np.array([a,b])
    return np.concatenate([simplify(points[:k+1])[:-1],simplify(points[k:])])

def contours(m):
    edges = {}
    for y,x in zip(*np.nonzero(m)):
        if y == 0 or not m[y-1,x]: edges.setdefault((x,y),[]).append((x+1,y))
        if x == width-1 or not m[y,x+1]: edges.setdefault((x+1,y),[]).append((x+1,y+1))
        if y == height-1 or not m[y+1,x]: edges.setdefault((x+1,y+1),[]).append((x,y+1))
        if x == 0 or not m[y,x-1]: edges.setdefault((x,y+1),[]).append((x,y))
    result=[]
    while edges:
        start=next(iter(edges)); point=start; loop=[start]
        while True:
            nxt=edges[point].pop()
            if not edges[point]: del edges[point]
            point=nxt;loop.append(point)
            if point==start: break
        points=np.array(loop,dtype=float)
        if len(points)<12:continue
        split=np.argmax(np.linalg.norm(points-points[0],axis=1))
        points=np.concatenate([simplify(points[:split+1])[:-1],simplify(points[split:])])
        result.append(points)
    return result

letters=[]
for char,region in zip('SAADi',regions):
    m=mask & region
    origin=float(np.where(m)[1].min())
    paths=[]
    for points in contours(m):
        points[:,0]=(points[:,0]-origin)*scale
        points[:,1]=(points[:,1]-710)*scale
        paths.append('M'+' L'.join(f'{x:.3f} {y:.3f}' for x,y in points)+' Z')
    letters.append(dict(char=char,path=' '.join(paths),origin=round(origin*scale,3),advance=round((np.where(m)[1].max()-origin+1)*scale,3)))
output=Path(__file__).resolve().parents[1]/'assets/fonts/logo-wordmark.json'
output.write_text(json.dumps(dict(name='Traced SAADi reference',capHeight=70,letters=letters,source=Path(sys.argv[1]).name),indent=2)+'\n')
print(f'Wrote {output} ({sum(len(l["path"]) for l in letters)} path characters)')
