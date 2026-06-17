"""
CURB - Enforcement Prioritizer
==============================

Turns the ranked hotspot table into a control-room-facing priority list.

Design principles (hard-won across the project's honesty review):
  * We do NOT predict traffic outcomes. There is no measured congestion in the
    dataset, so `congestion_impact_index` is our severity x footprint score
    normalised to 0-100 - an INDEX, not a predicted % reduction.
  * We do NOT assume how many units are available. We describe each spot's own
    measured enforcement history and leave deployment to the control room.
  * Nothing about the force is hardcoded. Every number is recomputed from
    whatever data is loaded; citywide staffing is reported as a day-by-day
    spread (descriptive context), never baked into a calculation.

Per-hotspot output is deliberately simple on the surface (rank, impact index,
a Chronic/Frequent/Occasional tag, cause -> fix, one deploy note) while keeping
the richer fields available for the frontend.

This module is self-contained: it reads only the few extra columns it needs
directly from the CSV, so it does not require changes to data_loader.py.
"""

import json
import os

import pandas as pd

import config

# --- persistence tiers: active days over the data window --------------------
# Tunable, documented constants. "How many distinct days did this spot need
# attention?" is the one operational signal the data supports cleanly.
CHRONIC_MIN_DAYS = 60     # needs a unit on it on a large share of days
FREQUENT_MIN_DAYS = 15    # recurring, worth scheduled sweeps
# else: Occasional

DEPLOY_NOTE = {
    "Chronic":    "Standing post - assign a unit on a regular basis.",
    "Frequent":   "Recurring - schedule periodic sweeps.",
    "Occasional": "One-off - clear as capacity allows.",
}

PRIORITIES_CSV = os.path.join(config.OUTPUT_DIR, "curb_priorities.csv")
PRIORITIES_JSON = os.path.join(config.OUTPUT_DIR, "curb_priorities.json")


# ---------------------------------------------------------------------------
# measured enforcement footprint, read straight from the CSV
# ---------------------------------------------------------------------------
def _footprint_source(path):
    """Load only the columns needed to measure per-cell enforcement history."""
    df = pd.read_csv(path, usecols=[
        "latitude", "longitude", "created_by_id",
        "created_datetime", "validation_status",
    ])
    df = df.dropna(subset=["latitude", "longitude"])
    b = config.BBOX
    df = df[df.latitude.between(b["lat_min"], b["lat_max"])
            & df.longitude.between(b["lon_min"], b["lon_max"])]
    df = df[~df.validation_status.isin(config.DROP_VALIDATION)].copy()

    dt = pd.to_datetime(df.created_datetime, errors="coerce", utc=True).dt.tz_convert("Asia/Kolkata")
    df["day"] = dt.dt.date
    df["clat"] = (df.latitude / config.GRID).round() * config.GRID
    df["clon"] = (df.longitude / config.GRID).round() * config.GRID
    return df, dt


def enforcement_footprint(path):
    """Per-cell measured history: distinct officers, active days, units/day."""
    df, dt = _footprint_source(path)
    g = df.groupby(["clat", "clon"])
    foot = g.agg(
        active_days=("day", "nunique"),
        officers_total=("created_by_id", "nunique"),
    ).reset_index()

    # typical & peak simultaneous presence = distinct officers per active day
    per_day = df.groupby(["clat", "clon", "day"]).created_by_id.nunique()
    units = per_day.groupby(["clat", "clon"]).agg(
        units_typical="median", units_peak="max").reset_index()
    foot = foot.merge(units, on=["clat", "clon"])

    window_days = (dt.max() - dt.min()).days
    return foot, window_days


# ---------------------------------------------------------------------------
# citywide staffing context (descriptive only - NOT an input to any ranking)
# ---------------------------------------------------------------------------
def citywide_context(path):
    df, dt = _footprint_source(path)
    officers_per_day = df.groupby("day").created_by_id.nunique()
    q = officers_per_day.quantile([.25, .5, .75])
    return {
        "officers_per_day_min": int(officers_per_day.min()),
        "officers_per_day_p25": int(q.loc[.25]),
        "officers_per_day_median": int(q.loc[.5]),
        "officers_per_day_p75": int(q.loc[.75]),
        "officers_per_day_max": int(officers_per_day.max()),
        "active_days_in_data": int(officers_per_day.size),
        "note": "Descriptive only; recomputed from the loaded data. Daily staffing "
                "varies - shown as a spread, never used as a fixed capacity.",
    }


# ---------------------------------------------------------------------------
# the prioritizer
# ---------------------------------------------------------------------------
def _persistence_tier(active_days):
    if active_days >= CHRONIC_MIN_DAYS:
        return "Chronic"
    if active_days >= FREQUENT_MIN_DAYS:
        return "Frequent"
    return "Occasional"


def prioritize(hot, data_path=None):
    """
    Attach impact index, measured persistence, and a control-room note to the
    hotspot table. Returns the enriched, rank-ordered DataFrame.
    """
    data_path = data_path or config.DATA_PATH
    foot, window_days = enforcement_footprint(data_path)

    p = hot.merge(foot, on=["clat", "clon"], how="left")
    p["active_days"] = p["active_days"].fillna(0).astype(int)
    p["units_typical"] = p["units_typical"].fillna(1).astype(int)
    p["units_peak"] = p["units_peak"].fillna(1).astype(int)

    # congestion IMPACT INDEX (0-100) - normalised score, honestly an index
    top = p["impact_score"].max()
    p["congestion_impact_index"] = (p["impact_score"] / top * 100).round(1)

    # measured persistence
    p["recurrence_days"] = p["active_days"]
    p["window_days"] = window_days
    p["persistence_tier"] = p["active_days"].apply(_persistence_tier)
    p["deploy_note"] = p["persistence_tier"].map(DEPLOY_NOTE)

    # cumulative coverage of total obstruction impact, in priority order
    p = p.sort_values("impact_score", ascending=False).reset_index(drop=True)
    p["cumulative_coverage_pct"] = (
        p["impact_score"].cumsum() / p["impact_score"].sum() * 100).round(1)
    p["rank"] = p.index + 1
    return p


# ---------------------------------------------------------------------------
# export for the frontend
# ---------------------------------------------------------------------------
FRONTEND_FIELDS = [
    "rank", "name", "clat", "clon",
    "congestion_impact_index", "persistence_tier", "recurrence_days", "window_days",
    "units_typical", "units_peak",
    "root_cause", "recommended_fix", "deploy_note",
    "violations", "impact_score", "cumulative_coverage_pct",
]


def export(priorities, context, data_path=None, top_n_json=500):
    os.makedirs(config.OUTPUT_DIR, exist_ok=True)
    cols = [c for c in FRONTEND_FIELDS if c in priorities.columns]
    priorities[cols].to_csv(PRIORITIES_CSV, index=False)

    payload = {
        "meta": {
            "hotspot_count": int(len(priorities)),
            "json_top_n": int(min(top_n_json, len(priorities))),
            "note": "congestion_impact_index is a normalised severity x footprint "
                    "INDEX (0-100), not a measured/predicted traffic change.",
        },
        "citywide": context,
        "hotspots": (priorities.head(top_n_json)[cols]
                     .rename(columns={"clat": "lat", "clon": "lon"})
                     .to_dict(orient="records")),
    }
    with open(PRIORITIES_JSON, "w") as f:
        json.dump(payload, f, indent=2)
    return PRIORITIES_CSV, PRIORITIES_JSON


def run(data_path=None, top_n_json=500):
    """Convenience: build hotspots, prioritize, export. Returns (df, context)."""
    from src.pipeline import run as run_pipeline
    hot = run_pipeline(data_path, write=False)
    context = citywide_context(data_path or config.DATA_PATH)
    priorities = prioritize(hot, data_path)
    export(priorities, context, data_path, top_n_json)
    return priorities, context