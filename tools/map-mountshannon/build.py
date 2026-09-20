"""build.py - draw the greater Mountshannon chalk map from osm.json.

Writes ../../assets/mountshannon-map.svg.
Same rule as the MuggsOfDreams map: the script draws what must be correct, names are
straight text on top, never bent, never invented. Map data (c) OpenStreetMap contributors, ODbL.
"""
import json, math, os
from shapely.geometry import LineString, MultiLineString, Point, Polygon, MultiPolygon, box
from shapely.ops import linemerge, unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, "..", "..", "assets", "mountshannon-map.svg"))
BOX = (52.855, -8.545, 52.985, -8.330)        # must match fetch.py
W, H, MARGIN = 1400, 900, 26
FONT = "font-family=\"'Source Sans 3', 'Segoe UI', sans-serif\""

d = json.load(open(os.path.join(HERE, "osm.json"), encoding="utf-8"))
els = d["elements"]
lat0 = (BOX[0] + BOX[2]) / 2
lon0 = (BOX[1] + BOX[3]) / 2
KX = 111320 * math.cos(math.radians(lat0)); KY = 110574
def m(lat, lon): return ((lon - lon0) * KX, (lat - lat0) * KY)

frame = box(*m(BOX[0], BOX[1]), *m(BOX[2], BOX[3]))

# ---------- water: the lough and its islands ----------
waters, water_names = [], []
def ring(geom):
    try:
        p = Polygon([m(g["lat"], g["lon"]) for g in geom])
        return p if p.is_valid and p.area > 0 else p.buffer(0)
    except Exception:
        return None

for e in els:
    t = e.get("tags", {})
    if t.get("natural") != "water":
        continue
    if e["type"] == "way" and e.get("geometry") and len(e["geometry"]) > 3:
        p = ring(e["geometry"])
        if p is not None and not p.is_empty:
            waters.append(p)
            if t.get("name"): water_names.append((t["name"], p))
    elif e["type"] == "relation":
        # Lough Derg arrives as a relation: stitch the outer member ways into one shoreline
        outer, inner = [], []
        for mem in e.get("members", []):
            g = mem.get("geometry")
            if not g or len(g) < 2: continue
            (outer if mem.get("role") != "inner" else inner).append(
                LineString([m(q["lat"], q["lon"]) for q in g]))
        for group, bucket in ((outer, waters), (inner, [])):
            if not group: continue
            merged = linemerge(MultiLineString(group))
            for line in (merged.geoms if hasattr(merged, "geoms") else [merged]):
                if len(line.coords) < 4: continue
                poly = Polygon(line.coords).buffer(0)
                if not poly.is_empty and poly.area > 0:
                    bucket.append(poly)
                    if group is outer and e.get("tags", {}).get("name"):
                        water_names.append((e["tags"]["name"], poly))
water = unary_union(waters).intersection(frame) if waters else None

# ---------- roads ----------
CLASS = {"trunk": 3.2, "primary": 3.0, "secondary": 2.4, "tertiary": 1.9,
         "unclassified": 1.3, "residential": 1.3, "living_street": 1.1}
roads = []           # (weight, linestring, name)
named = {}
for e in els:
    t = e.get("tags", {})
    hw = t.get("highway")
    if hw in CLASS and e.get("geometry") and len(e["geometry"]) > 1:
        ls = LineString([m(g["lat"], g["lon"]) for g in e["geometry"]]).intersection(frame)
        if ls.is_empty: continue
        for part in (ls.geoms if hasattr(ls, "geoms") else [ls]):
            if part.geom_type == "LineString" and part.length > 40:
                roads.append((CLASS[hw], part))
                n = t.get("ref") or t.get("name")
                if n: named.setdefault(n, []).append(part)

# ---------- points of interest ----------
def centre(e):
    if e.get("geometry"):
        pts = [m(g["lat"], g["lon"]) for g in e["geometry"]]
        return Point(sum(p[0] for p in pts)/len(pts), sum(p[1] for p in pts)/len(pts))
    if "lat" in e:
        return Point(*m(e["lat"], e["lon"]))
    return None

RANK = {"town": 0, "village": 1, "island": 2, "hamlet": 3, "townland": 4, "locality": 5, "isolated_dwelling": 6}
places, marinas, holy = [], [], []
for e in els:
    t = e.get("tags", {})
    c = centre(e)
    if c is None or not frame.contains(c): continue
    if t.get("place") in RANK and t.get("name"):
        places.append((RANK[t["place"]], t["name"], c, t["place"]))
    if t.get("leisure") == "marina":
        marinas.append(c)
    if t.get("historic") in ("monastery", "ruins", "round_tower", "high_cross", "church", "castle"):
        holy.append((c, t.get("historic"), t.get("name", "")))
places.sort()

# ---------- fit everything to the frame ----------
minx, miny, maxx, maxy = frame.bounds
scale = min((W - 2*MARGIN) / (maxx - minx), (H - 2*MARGIN) / (maxy - miny))
ox = (W - (maxx - minx) * scale) / 2 - minx * scale
oy = (H - (maxy - miny) * scale) / 2 + maxy * scale
def P(x, y): return (x * scale + ox, -y * scale + oy)          # y flips: north is up
def path(ls): return "M" + " L".join(f"{P(*c)[0]:.1f} {P(*c)[1]:.1f}" for c in ls.coords)

def poly_path(g):
    out = []
    for p in (g.geoms if hasattr(g, "geoms") else [g]):
        if p.geom_type != "Polygon": continue
        for ring in [p.exterior] + list(p.interiors):
            out.append("M" + " L".join(f"{P(*c)[0]:.1f} {P(*c)[1]:.1f}" for c in ring.coords) + " Z")
    return " ".join(out)

# ---------- labels, straight, no overlaps ----------
taken = []
def place_label(x, y, text, size):
    w, h = len(text) * size * 0.52, size * 1.25
    b = (x - w/2 - 5, y - h - 3, x + w/2 + 5, y + 5)
    if b[0] < 6 or b[2] > W - 6 or b[1] < 6 or b[3] > H - 6: return None
    for t in taken:
        if not (b[2] < t[0] or b[0] > t[2] or b[3] < t[1] or b[1] > t[3]): return None
    taken.append(b)
    return b

svg = []
# a default colour so the file also works inside <img>; inlining it lets CSS take over
svg.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" style="color:#F5F1E8" '
           f'role="img" aria-label="Map of the greater Mountshannon area, County Clare">')
svg.append('<defs><filter id="chalk"><feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="5"/>'
           '<feDisplacementMap in="SourceGraphic" scale="2.6" xChannelSelector="R" yChannelSelector="G"/></filter>'
           '<g id="anchor" stroke="currentColor" fill="none" stroke-width="1.6" stroke-linecap="round">'
           '<circle cx="0" cy="-7" r="2.2"/><path d="M0 -5 V7"/><path d="M-5 -1 H5"/>'
           '<path d="M-6 3 Q0 10 6 3"/></g>'
           '<g id="cross" stroke="currentColor" fill="none" stroke-width="1.6" stroke-linecap="round">'
           '<path d="M0 -9 V9"/><path d="M-5 -3 H5"/><circle cx="0" cy="-3" r="4.2"/></g></defs>')
svg.append('<g filter="url(#chalk)">')

# water first, so roads sit on top
if water and not water.is_empty:
    svg.append(f'<path d="{poly_path(water)}" fill="currentColor" fill-opacity=".10" '
               f'stroke="currentColor" stroke-opacity=".9" stroke-width="2.6" fill-rule="evenodd"/>')

svg.append('<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-opacity=".85">')
for wgt, ls in sorted(roads, key=lambda r: r[0]):
    svg.append(f'<path stroke-width="{wgt}" d="{path(ls)}"/>')
svg.append('</g>')

for c in marinas:
    x, y = P(c.x, c.y); svg.append(f'<use href="#anchor" x="{x:.1f}" y="{y:.1f}"/>')
for c, kind, name in holy:
    x, y = P(c.x, c.y); svg.append(f'<use href="#cross" x="{x:.1f}" y="{y:.1f}"/>')
svg.append('</g>')

# labels live outside the chalk filter so they stay crisp
SIZE = {"town": 27, "village": 24, "island": 19, "hamlet": 17, "townland": 15, "locality": 14, "isolated_dwelling": 12}
drawn = 0
for rank, name, c, kind in places:
    if kind in ("locality", "isolated_dwelling") and drawn > 26: continue
    size = SIZE.get(kind, 14)
    x, y = P(c.x, c.y)
    if place_label(x, y - 10, name, size) is None: continue
    dot = 3.4 if kind in ("town", "village") else 2.2
    svg.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{dot}" fill="currentColor" opacity=".9"/>')
    svg.append(f'<text x="{x:.1f}" y="{y-10:.1f}" text-anchor="middle" {FONT} font-size="{size}" '
               f'fill="currentColor" stroke="var(--map-halo, #071a0e)" stroke-width="3.5" paint-order="stroke" '
               f'letter-spacing="{0.06 if size>18 else 0.02}em">{name}</text>')
    drawn += 1

for wname, wpoly in sorted(water_names, key=lambda t: -t[1].area)[:1]:
    c = wpoly.intersection(frame).representative_point()
    x, y = P(c.x, c.y)
    if place_label(x, y, wname, 26):
        svg.append(f'<text x="{x:.1f}" y="{y:.1f}" text-anchor="middle" {FONT} font-size="26" '
                   f'fill="currentColor" opacity=".8" font-style="italic" letter-spacing=".12em">{wname}</text>')

svg.append(f'<text x="{W-18}" y="{H-14}" text-anchor="end" {FONT} font-size="13" fill="currentColor" opacity=".55">'
           f'Greater Mountshannon, Co. Clare &#183; &#169; OpenStreetMap contributors</text>')
svg.append('</svg>')

os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, "w", encoding="utf-8").write("\n".join(svg))
print(f"wrote {OUT}: {len(roads)} road pieces, {drawn} names, "
      f"{len(marinas)} marinas, {len(holy)} historic marks, water: {'yes' if water and not water.is_empty else 'no'}")
