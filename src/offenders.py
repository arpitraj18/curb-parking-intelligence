"""
CURB - Chronic-Offender Intelligence
====================================

Two views, both from the provided dataset only:

1. Repeat-offender VEHICLES  - anonymized vehicle IDs cited 2+ times: how often,
   where, and whether they're "habitual" (same spot) or "roaming" (many spots).

2. Recidivist LOCATIONS - spots where the SAME vehicles keep returning. This is
   different from raw volume: 500 violations from 500 different cars is transient
   churn; 500 from 50 returning cars is a habitual-parking problem that needs a
   structural fix, not just a patrol.

Honesty notes (state these in the deck):
  * These are repeat *detections*, not proven repeat *offences* - a vehicle caught
    often may simply park where enforcement is heavy. Treat as candidates for
    review, not a verdict.
  * vehicle_number is anonymized; this is aggregate targeting, never owner ID.
  * Everything traces to the provided CSV; no external data.
"""

import json
import os
import pandas as pd

import config
from src.data_loader import load_and_clean
from src.hotspots import add_row_features

# ---- tunable, documented thresholds ----------------------------------------
MIN_REPEAT = 2            # a "repeat offender" = cited at least this many times
HABITUAL_CONCENTRATION = 0.6   # >=60% of a vehicle's citations at one cell -> habitual
ROAMING_CELLS = 4         # offends at >=4 distinct cells -> roaming
MIN_CELL_VIOL = 20        # a cell needs this many citations for recidivism to be meaningful
HABITUAL_SHARE = 0.5      # >=50% of a cell's citations from returning vehicles -> Habitual
MIXED_SHARE = 0.2

OUT_JSON = os.path.join(config.OUTPUT_DIR, "curb_offenders.json")
OUT_VEH = os.path.join(config.OUTPUT_DIR, "curb_offender_vehicles.csv")
OUT_LOC = os.path.join(config.OUTPUT_DIR, "curb_recidivist_locations.csv")


def _cell_name(sub):
    jn = sub.junction_name[sub.junction_name != "No Junction"]
    if len(jn):
        return jn.mode().iloc[0]
    loc = sub.location.dropna()
    if len(loc):
        return ", ".join(str(loc.mode().iloc[0]).split(",")[:2]).strip()
    return "Unnamed cell"


def _prepare(data_path=None):
    df = load_and_clean(data_path)
    df = add_row_features(df)                      # severity, footprint, row_impact
    df["clat"] = (df.latitude / config.GRID).round() * config.GRID
    df["clon"] = (df.longitude / config.GRID).round() * config.GRID
    df["cell"] = df.clat.round(4).astype(str) + "," + df.clon.round(4).astype(str)
    df["dt"] = pd.to_datetime(df.created_datetime, errors="coerce", utc=True)
    return df


def vehicle_intelligence(df):
    """Per repeat-offender vehicle: frequency, spread, pattern, impact."""
    counts = df.vehicle_number.value_counts()
    repeat_ids = counts[counts >= MIN_REPEAT].index
    sub = df[df.vehicle_number.isin(repeat_ids)].copy()

    g = sub.groupby("vehicle_number")
    veh = g.agg(
        violations=("row_impact", "size"),
        total_impact=("row_impact", "sum"),
        distinct_locations=("cell", "nunique"),
        vehicle_type=("vehicle_type", "first"),
        first_seen=("dt", "min"),
        last_seen=("dt", "max"),
    )
    veh["span_days"] = (veh.last_seen - veh.first_seen).dt.days

    # concentration: share of citations at the vehicle's single worst cell
    vc = sub.groupby(["vehicle_number", "cell"]).size()
    top_cell = vc.groupby(level=0).idxmax().map(lambda t: t[1])
    top_n = vc.groupby(level=0).max()
    veh["top_location_cell"] = top_cell
    veh["top_location_share"] = (top_n / veh["violations"]).round(2)

    def pattern(r):
        if r.violations >= 3 and r.top_location_share >= HABITUAL_CONCENTRATION:
            return "Habitual (one spot)"
        if r.distinct_locations >= ROAMING_CELLS:
            return "Roaming (many spots)"
        return "Repeat"
    veh["pattern"] = veh.apply(pattern, axis=1)

    veh = veh.sort_values("violations", ascending=False).reset_index()
    veh["total_impact"] = veh["total_impact"].round(1)
    return veh


def location_recidivism(df, cell_name, cell_impact):
    """Per cell: how much of its burden comes from returning vehicles."""
    cv = df.groupby(["cell", "vehicle_number"]).size()
    total = cv.groupby(level=0).sum()
    distinct = cv.groupby(level=0).size()
    rep = cv[cv >= 2]
    rep_viol = rep.groupby(level=0).sum()
    rep_veh = rep.groupby(level=0).size()

    loc = pd.DataFrame({
        "violations": total,
        "distinct_vehicles": distinct,
        "repeat_vehicles": rep_veh,
        "repeat_violations": rep_viol,
    }).fillna(0)
    loc["repeat_vehicles"] = loc["repeat_vehicles"].astype(int)
    loc["repeat_share"] = (loc["repeat_violations"] / loc["violations"]).round(2)

    # only meaningful where there's enough volume
    loc = loc[loc["violations"] >= MIN_CELL_VIOL].copy()

    def label(s):
        if s >= HABITUAL_SHARE:
            return "Habitual"
        if s >= MIXED_SHARE:
            return "Mixed"
        return "Transient"
    loc["recidivism"] = loc["repeat_share"].apply(label)

    loc = loc.reset_index().rename(columns={"index": "cell"})
    loc["name"] = loc["cell"].map(cell_name)
    loc["impact_score"] = loc["cell"].map(cell_impact).round(1)
    loc[["clat", "clon"]] = loc["cell"].str.split(",", expand=True).astype(float)
    loc = loc.sort_values(["repeat_share", "violations"], ascending=False).reset_index(drop=True)
    loc["rank"] = loc.index + 1
    return loc


def run(data_path=None, top_n=300):
    df = _prepare(data_path)
    cell_name = df.groupby("cell").apply(_cell_name, include_groups=False)
    cell_impact = df.groupby("cell").row_impact.sum()

    veh = vehicle_intelligence(df)
    loc = location_recidivism(df, cell_name, cell_impact)

    veh["top_location"] = veh["top_location_cell"].map(cell_name)

    os.makedirs(config.OUTPUT_DIR, exist_ok=True)
    veh_cols = ["vehicle_number", "violations", "total_impact", "distinct_locations",
                "top_location", "top_location_share", "span_days", "vehicle_type", "pattern"]
    loc_cols = ["rank", "name", "clat", "clon", "violations", "distinct_vehicles",
                "repeat_vehicles", "repeat_share", "recidivism", "impact_score"]
    veh[veh_cols].to_csv(OUT_VEH, index=False)
    loc[loc_cols].to_csv(OUT_LOC, index=False)

    payload = {
        "meta": {
            "repeat_offender_vehicles": int(len(veh)),
            "recidivist_locations_assessed": int(len(loc)),
            "note": "Repeat DETECTIONS, not proven repeat offences; anonymized vehicle IDs; "
                    "provided dataset only.",
        },
        "offender_vehicles": json.loads(
            veh.head(top_n)[veh_cols].rename(columns={"vehicle_number": "vehicle_id"}).to_json(orient="records")),
        "recidivist_locations": json.loads(
            loc.head(top_n)[loc_cols].rename(columns={"clat": "lat", "clon": "lon"}).to_json(orient="records")),
    }
    with open(OUT_JSON, "w") as f:
        json.dump(payload, f, indent=2)
    return veh, loc