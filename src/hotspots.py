"""
Turn cleaned violation rows into ranked spatial hotspots.

Pipeline inside this module:
  1. per-row features: congestion-impact contribution + behaviour flags
  2. snap each row to a ~55 m grid cell (the candidate hotspot)
  3. aggregate rows -> per-cell stats (count, impact, vehicle mix, flags)
  4. give every cell a human-readable name

Congestion-impact model (the differentiator):
    row_impact = (sum of violation severities)  x  vehicle footprint factor
    cell_impact = sum of row_impact over the cell

So a main-road double-parked lorry contributes far more than a scooter on a
footpath. Both factors come from config.py as transparent constants.
"""

import numpy as np
import pandas as pd

import config


def _row_severity(violation_list):
    if not violation_list:
        return config.DEFAULT_SEVERITY
    return sum(config.SEVERITY.get(v, config.DEFAULT_SEVERITY) for v in violation_list)


def add_row_features(df):
    """Attach per-row impact contribution and behaviour flags."""
    df = df.copy()
    df["severity"] = df.violations.apply(_row_severity)
    df["footprint"] = df.vehicle_type.map(config.FOOTPRINT).fillna(config.DEFAULT_FOOTPRINT)
    df["row_impact"] = df.severity * df.footprint

    df["is_safety"] = df.violations.apply(
        lambda L: any(v in config.SAFETY_VIOLATIONS for v in L)
    )
    df["is_mainroad"] = df.violations.apply(lambda L: "PARKING IN A MAIN ROAD" in L)

    vt = df.vehicle_type.fillna("UNKNOWN")
    df["is_two"] = vt.isin(config.TWO_WHEELER)
    df["is_goods"] = vt.isin(config.GOODS)
    df["is_hire"] = vt.isin(config.HIRE)
    return df


def _cell_name(sub):
    """Prefer a real junction name; else the most common street/location text."""
    jn = sub.junction_name[sub.junction_name != "No Junction"]
    if len(jn):
        return jn.mode().iloc[0]
    loc = sub.location.dropna()
    if len(loc):
        return ", ".join(str(loc.mode().iloc[0]).split(",")[:2]).strip()
    return "Unnamed cell"


def build_hotspots(df):
    """Return a per-cell hotspot table, ranked by congestion impact."""
    df = add_row_features(df)

    df["clat"] = (df.latitude / config.GRID).round() * config.GRID
    df["clon"] = (df.longitude / config.GRID).round() * config.GRID

    grouped = df.groupby(["clat", "clon"])
    hot = grouped.agg(
        violations=("row_impact", "size"),
        impact_score=("row_impact", "sum"),
        two_share=("is_two", "mean"),
        goods_share=("is_goods", "mean"),
        hire_share=("is_hire", "mean"),
        safety_hits=("is_safety", "sum"),
        mainroad_hits=("is_mainroad", "sum"),
    ).reset_index()

    names = grouped.apply(_cell_name, include_groups=False).rename("name").reset_index()
    hot = hot.merge(names, on=["clat", "clon"])

    hot = hot.sort_values("impact_score", ascending=False).reset_index(drop=True)
    hot.insert(0, "rank", hot.index + 1)
    for col in ["impact_score", "two_share", "goods_share", "hire_share"]:
        hot[col] = hot[col].round(2)

    print(f"[hotspots] {len(hot):,} candidate cells built")
    return hot
