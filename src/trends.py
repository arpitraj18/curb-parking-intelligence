"""
CURB - Emerging-Hotspot Trends
==============================

The defensible "reactive -> proactive" layer: which spots got *worse* over the
data window. Built only on the date signal (week granularity), which we verified
is trustworthy - citywide weekly volume is flat across the period, so a cell that
rises is genuinely rising, not riding a citywide ramp.

Method (transparent, explainable):
  * trim the two partial boundary weeks (the data starts/ends mid-week)
  * split the remaining window into first half vs second half by date
  * per cell, compare second-half vs first-half citations
  * normalise against the citywide first/second split, so "emerging" means
    rising FASTER than the city as a whole - not just rising

Honesty notes (for the deck):
  * This is a retrospective trend over a ~5-month window, NOT a future forecast.
    "Emerging" = trended up over the period and worth watching.
  * Dates were shifted by a constant offset in anonymisation; relative trends are
    valid, absolute calendar dates are not. Hour-of-day is unreliable and unused.
  * Provided dataset only.
"""

import json
import os
import pandas as pd

import config
from src.data_loader import load_and_clean
from src.hotspots import add_row_features

# tunable, documented thresholds
MIN_TOTAL = 20          # a cell needs this many citations for a trend to be meaningful
MIN_INCREASE = 8        # min absolute (2nd-half minus 1st-half) to call it emerging
EMERGING_REL = 1.5      # 2nd/1st growth must exceed 1.5x the citywide growth
COOLING_REL = 0.67      # below this (relative) = cooling

OUT_JSON = os.path.join(config.OUTPUT_DIR, "curb_trends.json")
OUT_CSV = os.path.join(config.OUTPUT_DIR, "curb_trends.csv")


def _cell_name(sub):
    jn = sub.junction_name[sub.junction_name != "No Junction"]
    if len(jn):
        return jn.mode().iloc[0]
    loc = sub.location.dropna()
    if len(loc):
        return ", ".join(str(loc.mode().iloc[0]).split(",")[:2]).strip()
    return "Unnamed cell"


def run(data_path=None, top_n=300):
    df = load_and_clean(data_path)
    df = add_row_features(df)
    df["clat"] = (df.latitude / config.GRID).round() * config.GRID
    df["clon"] = (df.longitude / config.GRID).round() * config.GRID
    df["cell"] = df.clat.round(4).astype(str) + "," + df.clon.round(4).astype(str)
    dt = pd.to_datetime(df.created_datetime, errors="coerce", utc=True).dt.tz_convert("Asia/Kolkata")
    df["date"] = dt.dt.normalize()
    df = df.dropna(subset=["date"])

    # trim the two partial boundary ISO weeks
    df["week"] = dt.dt.to_period("W")
    weeks = sorted(df["week"].unique())
    keep = set(weeks[1:-1])
    df = df[df["week"].isin(keep)].copy()

    # split the trimmed window in half by date
    dmin, dmax = df["date"].min(), df["date"].max()
    mid = dmin + (dmax - dmin) / 2
    df["half"] = (df["date"] > mid).map({False: "first", True: "second"})

    # citywide baseline (near-flat, but normalise against it to be safe)
    city = df["half"].value_counts()
    city_ratio = city.get("second", 0) / max(city.get("first", 1), 1)

    g = df.groupby("cell")
    cell = g.agg(
        total=("row_impact", "size"),
        impact_score=("row_impact", "sum"),
    )
    halves = df.groupby(["cell", "half"]).size().unstack(fill_value=0)
    for col in ["first", "second"]:
        if col not in halves:
            halves[col] = 0
    cell = cell.join(halves[["first", "second"]])
    cell = cell[cell["total"] >= MIN_TOTAL].copy()

    cell["change"] = cell["second"] - cell["first"]
    cell["growth"] = cell["second"] / cell["first"].replace(0, 0.5)   # raw 2nd/1st
    cell["rel_growth"] = (cell["growth"] / city_ratio).round(2)        # vs the city

    def label(r):
        if r.rel_growth >= EMERGING_REL and r.change >= MIN_INCREASE:
            return "Emerging"
        if r.rel_growth <= COOLING_REL and r.change <= -MIN_INCREASE:
            return "Cooling"
        return "Stable"
    cell["trend"] = cell.apply(label, axis=1)

    cell = cell.reset_index()
    cell["name"] = cell["cell"].map(g.apply(_cell_name, include_groups=False))
    cell[["clat", "clon"]] = cell["cell"].str.split(",", expand=True).astype(float)
    cell["impact_score"] = cell["impact_score"].round(1)

    # rank emerging spots by absolute increase (real rises, not tiny noise)
    cell = cell.sort_values(["change"], ascending=False).reset_index(drop=True)

    emerging = cell[cell.trend == "Emerging"].copy().reset_index(drop=True)
    emerging["rank"] = emerging.index + 1

    os.makedirs(config.OUTPUT_DIR, exist_ok=True)
    cols = ["name", "clat", "clon", "first", "second", "change", "rel_growth",
            "trend", "total", "impact_score"]
    cell[cols].to_csv(OUT_CSV, index=False)

    payload = {
        "meta": {
            "city_second_over_first": round(float(city_ratio), 3),
            "cells_assessed": int(len(cell)),
            "emerging": int((cell.trend == "Emerging").sum()),
            "cooling": int((cell.trend == "Cooling").sum()),
            "note": "Retrospective trend over the data window (NOT a forecast); measured "
                    "relative to the flat citywide baseline; provided dataset only.",
        },
        "emerging": json.loads(
            emerging.head(top_n)[["rank"] + cols].rename(columns={"clat": "lat", "clon": "lon"}).to_json(orient="records")),
    }
    with open(OUT_JSON, "w") as f:
        json.dump(payload, f, indent=2)
    return cell, emerging, city_ratio