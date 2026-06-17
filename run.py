"""
CURB — command-line entry point.

Usage:
    python run.py                 # uses data/violations.csv (or $CURB_DATA)
    python run.py path/to/file.csv

Writes outputs/curb_hotspots.csv and prints the top hotspots.
"""

import sys

import pandas as pd

from src.pipeline import run


def main():
    data_path = sys.argv[1] if len(sys.argv) > 1 else None
    hot = run(data_path)

    cols = ["rank", "name", "violations", "impact_score", "root_cause", "recommended_fix"]
    print("\n=== TOP 15 HOTSPOTS BY CONGESTION IMPACT ===")
    with pd.option_context("display.max_colwidth", 40, "display.width", 200):
        print(hot.head(15)[cols].to_string(index=False))


if __name__ == "__main__":
    main()
