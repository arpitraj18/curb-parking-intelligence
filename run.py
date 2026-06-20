"""
CURB — command-line entry point.

Runs the full analysis chain and then regenerates the frontend data so the
site reflects the current numbers.

Usage:
    python run.py                          # data/violations.csv (or $CURB_DATA) -> outputs/ -> site/
    python run.py path/to/file.csv         # custom dataset
    python run.py --site ../frontend       # custom frontend folder
    python run.py --no-web                 # skip the frontend regeneration

The chain: pipeline -> prioritizer -> offenders -> trends -> intelligence -> webexport.
Each step writes its JSON into outputs/; webexport turns outputs/ into the site's data.
"""

import argparse

import pandas as pd

from src import pipeline, prioritizer, offenders, trends, intelligence


def main():
    ap = argparse.ArgumentParser(description="Run CURB end to end and refresh the frontend.")
    ap.add_argument("data_path", nargs="?", default=None, help="CSV path (default: config.DATA_PATH)")
    ap.add_argument("--site", default="site", help="frontend folder to regenerate (default: site)")
    ap.add_argument("--no-web", action="store_true", help="skip regenerating the frontend data")
    args = ap.parse_args()

    print("\n[1/5] hotspots ...")
    hot = pipeline.run(args.data_path)
    print("[2/5] prioritizer ...")
    prioritizer.run(args.data_path)
    print("[3/5] offenders ...")
    offenders.run(args.data_path)
    print("[4/5] trends ...")
    trends.run(args.data_path)
    print("[5/5] intelligence ...")
    intelligence.run(args.data_path)

    if not args.no_web:
        import os
        if os.path.isdir(args.site):
            from src.webexport import export
            print(f"\n[web] regenerating frontend data in {args.site}/ ...")
            export(outputs="outputs", site=args.site)
        else:
            print(f"\n[web] '{args.site}/' not found - skipping frontend regen. "
                  f"(Put the frontend folder there, or pass --site PATH.)")

    cols = ["rank", "name", "violations", "impact_score", "root_cause", "recommended_fix"]
    print("\n=== TOP 15 HOTSPOTS BY CONGESTION IMPACT ===")
    with pd.option_context("display.max_colwidth", 40, "display.width", 200):
        print(hot.head(15)[cols].to_string(index=False))


if __name__ == "__main__":
    main()
