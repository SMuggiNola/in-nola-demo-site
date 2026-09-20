"""fetch.py - download the greater Mountshannon area (East Clare, Lough Derg) from OpenStreetMap.

Writes osm.json next to this file. Map data (c) OpenStreetMap contributors, ODbL.
Same idea as the MuggsOfDreams map tool: a script draws what must be correct.
"""
import json, os, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
# south, west, north, east. Mountshannon village sits at about 52.932 N, 8.427 W.
BOX = (52.855, -8.545, 52.985, -8.330)
B = f"{BOX[0]},{BOX[1]},{BOX[2]},{BOX[3]}"

QUERY = f"""
[out:json][timeout:180];
(
  way["highway"~"^(trunk|primary|secondary|tertiary|unclassified|residential|living_street)$"]({B});
  way["natural"="water"]({B});
  relation["natural"="water"]({B});
  way["natural"="coastline"]({B});
  node["place"~"^(town|village|hamlet|locality|island|townland|isolated_dwelling)$"]({B});
  way["place"="island"]({B});
  nwr["historic"~"^(monastery|ruins|church|castle|round_tower|high_cross)$"]({B});
  nwr["amenity"="place_of_worship"]({B});
  nwr["leisure"="marina"]({B});
  nwr["amenity"="pub"]({B});
);
out geom;
"""

def main():
    data = urllib.parse.urlencode({"data": QUERY}).encode()
    req = urllib.request.Request("https://overpass-api.de/api/interpreter", data=data,
                                 headers={"User-Agent": "innola-mountshannon-map/1.0"})
    with urllib.request.urlopen(req, timeout=300) as r:
        d = json.load(r)
    json.dump(d, open(os.path.join(HERE, "osm.json"), "w", encoding="utf-8"))
    els = d["elements"]
    def count(f): return sum(1 for e in els if f(e.get("tags", {})))
    print(f"elements {len(els)} | roads {count(lambda t:'highway' in t)} "
          f"| water {count(lambda t:t.get('natural')=='water')} "
          f"| places {count(lambda t:'place' in t)} "
          f"| historic {count(lambda t:'historic' in t)} "
          f"| pubs {count(lambda t:t.get('amenity')=='pub')} "
          f"| marinas {count(lambda t:t.get('leisure')=='marina')}")

if __name__ == "__main__":
    main()
