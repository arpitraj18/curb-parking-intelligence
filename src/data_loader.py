"""
Load and clean the provided Bengaluru parking-violation dataset.

Responsibilities:
  - read only the columns we use
  - drop bad coordinates and rows outside Bengaluru
  - drop violations the police themselves rejected/flagged
  - parse the violation_type column (a JSON-encoded list per row)
"""

import json
import pandas as pd

import config

USECOLS = [
    "id",
    "latitude",
    "longitude",
    "location",
    "vehicle_type",
    "violation_type",
    "vehicle_number",
    "created_datetime",
    "police_station",
    "junction_name",
    "validation_status",
]


def _parse_violation_list(value):
    """violation_type is stored as a JSON array string, e.g. '["NO PARKING"]'."""
    if pd.isna(value):
        return []
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, list) else [parsed]
    except (ValueError, TypeError):
        return [value]


def load_and_clean(path=None):
    """Return a cleaned DataFrame ready for the hotspot pipeline."""
    path = path or config.DATA_PATH
    df = pd.read_csv(path, usecols=USECOLS)
    n_raw = len(df)

    # 1. valid coordinates only
    df = df.dropna(subset=["latitude", "longitude"])
    b = config.BBOX
    df = df[
        df.latitude.between(b["lat_min"], b["lat_max"])
        & df.longitude.between(b["lon_min"], b["lon_max"])
    ]

    # 2. drop police-rejected / duplicate records
    df = df[~df.validation_status.isin(config.DROP_VALIDATION)].copy()

    # 3. parse the multi-violation column
    df["violations"] = df.violation_type.apply(_parse_violation_list)

    df.reset_index(drop=True, inplace=True)
    print(f"[data] loaded {n_raw:,} rows -> {len(df):,} usable after cleaning")
    return df
