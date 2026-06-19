"""
CURB - Unified Hotspot Intelligence
===================================

The capstone layer. Each of CURB's signals is computed independently, then
merged into ONE enriched record per hotspot:

  priority/impact + root cause + fix + persistence   (from prioritizer)
  + trend  (Emerging / Stable / Cooling)             (from trends)
  + recidivism (Habitual / Mixed / Transient)        (from offenders, by location)

This powers two things:
  1. A single enriched feed (`curb_intelligence.json`) - a SUPERSET of
     curb_priorities.json (same fields + `trend`, `recidivism`), so it's an
     additive, drop-in upgrade for the frontend (no existing field changes).
  2. The high-conviction watchlist: hotspots that are high-impact AND emerging
     AND habitual - worst, getting worse, with the same vehicles returning.

Provided dataset only; merges signals we already validated. (Runs the three
analyses, so it reads the CSV a few times - expect ~30s.)
"""

import json
import os
import pandas as pd

import config
from src.pipeline import run as run_pipeline
from src.prioritizer import prioritize, citywide_context, FRONTEND_FIELDS
from src.trends import run as run_trends
from src.offenders import run as run_offenders

OUT_JSON = os.path.join(config.OUTPUT_DIR, "curb_intelligence.json")
OUT_CSV = os.path.join(config.OUTPUT_DIR, "curb_intelligence.csv")


def _key(df):
    df = df.copy()
    df["k"] = df["clat"].round(4).astype(str) + "_" + df["clon"].round(4).astype(str)
    return df


def run(data_path=None, top_n=500):
    data_path = data_path or config.DATA_PATH

    # 1. priority/impact + root cause + persistence
    hot = run_pipeline(data_path, write=False)
    prio = _key(prioritize(hot, data_path))
    ctx = citywide_context(data_path)

    # 2. trend per cell
    cell_tr, _emerging, _ratio = run_trends(data_path)
    tr = _key(cell_tr)[["k", "trend", "rel_growth"]].rename(columns={"rel_growth": "trend_rel_growth"})

    # 3. recidivism per cell (location view)
    _veh, loc = run_offenders(data_path)
    rc = _key(loc)[["k", "recidivism", "repeat_share"]]

    # merge (left join onto the priority list)
    m = prio.merge(tr, on="k", how="left").merge(rc, on="k", how="left")
    m["trend"] = m["trend"].fillna("n/a")
    m["trend_rel_growth"] = m["trend_rel_growth"].fillna(0)
    m["recidivism"] = m["recidivism"].fillna("n/a")
    m["repeat_share"] = m["repeat_share"].fillna(0)

    # high-conviction flag: worst + getting worse + same offenders
    m["high_conviction"] = (
        (m["rank"] <= 100) & (m["trend"] == "Emerging") & (m["recidivism"] == "Habitual")
    )

    os.makedirs(config.OUTPUT_DIR, exist_ok=True)
    extra = ["trend", "trend_rel_growth", "recidivism", "repeat_share", "high_conviction"]
    cols = [c for c in FRONTEND_FIELDS if c in m.columns] + extra
    m[cols].to_csv(OUT_CSV, index=False)

    payload = {
        "meta": {
            "hotspot_count": int(len(m)),
            "high_conviction": int(m["high_conviction"].sum()),
            "note": "Superset of curb_priorities.json (adds trend + recidivism). "
                    "congestion_impact_index is a normalised index, not measured traffic. "
                    "Provided dataset only.",
        },
        "citywide": ctx,
        "hotspots": json.loads(
            m.head(top_n)[cols].rename(columns={"clat": "lat", "clon": "lon"}).to_json(orient="records")),
    }
    with open(OUT_JSON, "w") as f:
        json.dump(payload, f, indent=2)
    return m
