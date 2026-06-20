"""
CURB — web export.

The bridge between the (batch) backend and the (static) frontend.

It reads the JSON the analysis steps already wrote into ``outputs/`` and
regenerates the two files the frontend reads:

    <site>/assets/curb-data.js     # window.CURB = {...}  (all pages read this)
    <site>/api/_hotspots.json      # compact rows the GenAI assistant is grounded on

Because the frontend's data is *generated from* the backend outputs, re-running
the pipeline (or just this step) makes the site reflect the current data — no
manual editing, no stale snapshot.

Usage
-----
    # after your analysis notebooks/pipeline have refreshed outputs/*.json
    python -m src.webexport                 # outputs/ -> ./site
    python -m src.webexport --site ../site  # custom frontend location
"""

from __future__ import annotations

import argparse
import csv
import json
import os
from collections import Counter


def _load(outputs: str, name: str) -> dict:
    path = os.path.join(outputs, name)
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Missing {path}. Run the analysis steps first so outputs/ is populated."
        )
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def build_payload(outputs: str = "outputs") -> tuple[dict, list]:
    """Return (web_payload, compact_hotspots) built from the JSON in ``outputs``."""
    intel = _load(outputs, "curb_intelligence.json")
    off = _load(outputs, "curb_offenders.json")
    tr = _load(outputs, "curb_trends.json")
    H = intel["hotspots"]  # all ranked hotspots

    def split(key):
        return dict(Counter(x.get(key) for x in H if x.get(key) not in (None, "n/a")))

    coverage = []
    for n in (25, 50, 100, 250, 500):
        row = next((x for x in H if x.get("rank") == n), None)
        if row:
            coverage.append({"n": n, "pct": row["cumulative_coverage_pct"]})

    # cooling spots live in the trends CSV (the JSON only stores emerging)
    cooling = []
    csv_path = os.path.join(outputs, "curb_trends.csv")
    if os.path.exists(csv_path):
        rows = list(csv.DictReader(open(csv_path, encoding="utf-8")))
        cool = [r for r in rows if r.get("trend") == "Cooling"]
        for r in cool:
            r["first"] = int(float(r["first"]))
            r["second"] = int(float(r["second"]))
            r["change"] = int(float(r["change"]))
            r["rel_growth"] = float(r["rel_growth"])
            r["impact_score"] = float(r["impact_score"])
        cool.sort(key=lambda r: r["change"])  # most negative first
        cooling = [
            {"name": r["name"], "first": r["first"], "second": r["second"],
             "change": r["change"], "rel_growth": r["rel_growth"],
             "impact_score": r["impact_score"]}
            for r in cool[:200]
        ]

    agg = {
        "chronic": sum(1 for x in H if x.get("persistence_tier") == "Chronic"),
        "tier": split("persistence_tier"),
        "trend": split("trend"),
        "cause": split("root_cause"),
        "recidivism": split("recidivism"),
        "coverage": coverage,
        "offender_pattern": dict(Counter(v["pattern"] for v in off.get("offender_vehicles", []))),
        "loc_recidivism": dict(Counter(l["recidivism"] for l in off.get("recidivist_locations", []))),
    }

    payload = {
        "meta": intel.get("meta", {}),
        "citywide": intel.get("citywide", {}),
        "agg": agg,
        "hotspots": H,
        "offenders": {
            "meta": off.get("meta", {}),
            "vehicles": off.get("offender_vehicles", [])[:200],
            "locations": off.get("recidivist_locations", [])[:200],
        },
        "trends": {
            "meta": tr.get("meta", {}),
            "emerging": tr.get("emerging", [])[:300],
            "cooling": cooling,
        },
    }

    compact = [
        {"rank": h["rank"], "name": " ".join(h["name"].split()),
         "root_cause": h["root_cause"], "impact": round(h["congestion_impact_index"]),
         "persistence": h["persistence_tier"], "trend": h["trend"],
         "recidivism": h["recidivism"], "fix": h["recommended_fix"],
         "area_hint": " ".join(h["name"].split()).split(",")[-1].strip()}
        for h in H[:150]
    ]
    return payload, compact


def export(outputs: str = "outputs", site: str = "site") -> None:
    payload, compact = build_payload(outputs)

    assets = os.path.join(site, "assets")
    api = os.path.join(site, "api")
    os.makedirs(assets, exist_ok=True)
    os.makedirs(api, exist_ok=True)

    data_js = os.path.join(assets, "curb-data.js")
    with open(data_js, "w", encoding="utf-8") as fh:
        fh.write("window.CURB = " + json.dumps(payload, separators=(",", ":")) + ";")

    hot_json = os.path.join(api, "_hotspots.json")
    with open(hot_json, "w", encoding="utf-8") as fh:
        fh.write(json.dumps(compact, separators=(",", ":")))

    print(f"[webexport] wrote {data_js}  ({len(payload['hotspots'])} hotspots)")
    print(f"[webexport] wrote {hot_json}  ({len(compact)} compact rows for the assistant)")
    print("[webexport] frontend now reflects the current outputs/ — refresh the browser.")


def main():
    ap = argparse.ArgumentParser(description="Regenerate the CURB frontend data from outputs/.")
    ap.add_argument("--outputs", default="outputs", help="folder with the backend JSON (default: outputs)")
    ap.add_argument("--site", default="site", help="frontend folder to write into (default: site)")
    args = ap.parse_args()
    export(args.outputs, args.site)


if __name__ == "__main__":
    main()
