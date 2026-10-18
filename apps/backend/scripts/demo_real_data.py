"""End-to-end demo of the real-data integration against a running backend.

Usage (backend on :8000):
    .venv/bin/python apps/backend/scripts/demo_real_data.py [--api http://localhost:8000]

Creates (or reuses) a demo account, registers a farm in Niphad (Nashik, Maharashtra),
uploads tests/fixtures/niphad_fields.kml as its boundary, then prints the real NDVI,
weather/agro indices, SoilGrids estimate and alerts returned by the API.
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

import requests

FIXTURE = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "niphad_fields.kml"
# Local throwaway demo account; override via env for shared environments.
EMAIL = os.environ.get("DEMO_EMAIL", "realdata.demo@agrinexus.dev")
PASSWORD = os.environ.get("DEMO_PASSWORD", "RealData123!")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default="http://localhost:8000")
    api = ap.parse_args().api.rstrip("/") + "/api/v1"

    requests.post(f"{api}/auth/register", json={"email": EMAIL, "password": PASSWORD,
                                                "full_name": "Real Data Demo", "state": "Maharashtra"}, timeout=30)
    tok = requests.post(f"{api}/auth/login", data={"username": EMAIL, "password": PASSWORD}, timeout=30)
    tok.raise_for_status()
    h = {"Authorization": f"Bearer {tok.json()['access_token']}"}

    farms = requests.get(f"{api}/farms/", headers=h, timeout=30).json()
    farm = next((f for f in farms if f["name"] == "Niphad Grape Block"), None)
    if not farm:
        farm = requests.post(f"{api}/farms/", headers=h, timeout=30, json={
            "name": "Niphad Grape Block", "area": 12.4, "area_unit": "hectares", "state": "Maharashtra",
            "district": "Nashik", "village": "Niphad", "gps_coordinates": "20.0788 N, 74.1115 E",
            "current_crop": "Grapes", "sowing_date": "2026-06-20", "irrigation_method": "Drip"}).json()
    fid = farm["id"]
    print(f"farm id {fid}")

    with open(FIXTURE, "rb") as fh:
        up = requests.post(f"{api}/farms/{fid}/boundary", headers=h, timeout=60,
                           files={"file": (FIXTURE.name, fh, "application/vnd.google-earth.kml+xml")},
                           data={"feature_index": "0"})
    up.raise_for_status()
    u = up.json()
    print(f"\n[boundary] saved {u['saved_geometry_type']} {u['area']['hectares']} ha "
          f"(entered {u['entered_area']['value']} ha); skipped: {u['skipped']}")

    t = time.time()
    veg = requests.get(f"{api}/farms/{fid}/vegetation", headers=h, timeout=300).json()
    print(f"\n[ndvi] status={veg['status']} scenes={veg['scenes_considered']} "
          f"rejected_low_valid={veg['scenes_rejected_low_valid']} in {time.time() - t:.1f}s")
    for o in veg["observations"][-6:]:
        print(f"  {o['date']}  {o['scene_id']}  cloud {o['scene_cloud_pct']:5.1f}%  valid {o['valid_pixel_pct']:5.1f}%  "
              f"NDVI mean {o['ndvi']['mean']:.3f} median {o['ndvi']['median']:.3f} "
              f"p10 {o['ndvi']['p10']:.3f} p90 {o['ndvi']['p90']:.3f}  EVI {o['evi']}  NDWI {o['ndwi']}")

    w = requests.get(f"{api}/weather/forecast", params={"farm_id": fid}, headers=h, timeout=120).json()
    print(f"\n[weather] source={w.get('source')} basis={w.get('location_basis')} ({w.get('lat')}, {w.get('lon')}) "
          f"temp {w.get('temperature')}°C humidity {w.get('humidity')}% rain {w.get('rain_chance')}%")
    print("  agri_indices:", json.dumps({k: w.get("agri_indices", {}).get(k) for k in (
        "as_of", "gdd_last_30d", "gdd_since_sowing", "precip_30d_mm", "et0_30d_mm",
        "water_balance_30d_mm", "drought_index", "drought_category", "source")}))

    s = requests.get(f"{api}/farms/{fid}/soil-estimate", headers=h, timeout=120).json()
    e = s["estimate"]
    print(f"\n[soil] status={e['status']} label={e.get('label')} source={e.get('source')}")
    print("  topsoil 0-30cm:", e.get("topsoil_0_30cm"), "texture:", e.get("texture_class_usda"),
          "sampling:", e.get("sampling"))
    print("  farmer_entered kept:", bool(s["farmer_entered"]), "|", s["precedence"])

    a = requests.get(f"{api}/farms/{fid}/alerts", headers=h, timeout=300).json()
    print(f"\n[alerts] {len(a['alerts'])} alert(s), {len(a['suppressed'])} suppressed")
    for al in a["alerts"]:
        print(f"  - {al['rule']} [{al['severity']}, conf {al['confidence']}]: {al['evidence_text']}")
    for sp in a["suppressed"]:
        print(f"  (suppressed) {sp['reason']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
