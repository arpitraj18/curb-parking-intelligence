"""
CURB pipeline orchestrator.

run() ties the stages together and returns the ranked hotspot table:

    load_and_clean  ->  build_hotspots  ->  classify

Import and call run() from a notebook or the API/dashboard layer, or run the
whole thing from the command line via ../run.py.
"""

import os

import config
from src.data_loader import load_and_clean
from src.hotspots import build_hotspots
from src.rootcause import classify


def run(data_path=None, write=True):
    df = load_and_clean(data_path)
    hot = build_hotspots(df)
    hot = classify(hot)

    if write:
        os.makedirs(config.OUTPUT_DIR, exist_ok=True)
        hot.to_csv(config.HOTSPOTS_CSV, index=False)
        print(f"[pipeline] wrote {config.HOTSPOTS_CSV}")
    return hot
