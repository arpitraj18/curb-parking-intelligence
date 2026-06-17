# CURB — Curb Intelligence System

**Theme:** Poor Visibility on Parking-Induced Congestion
**Gridlock Hackathon 2.0 · Flipkart × Bengaluru Traffic Police (ASTraM) × MapmyIndia**

CURB turns Bengaluru's parking-violation records into a ranked, *explained* map
of where parking is actually choking traffic — and what to do about each spot.
Most approaches stop at "detect a hotspot, send a patrol." CURB goes one step
further: it estimates the **congestion impact** of each hotspot and classifies
the **root cause**, so the recommended action fits the problem (loading bay vs.
park-and-ride vs. bollards vs. enforcement).

## What it does (current core)

1. **Hotspot detection** — snaps 248k cleaned violations to a ~55 m grid and
   ranks the resulting cells.
2. **Congestion-impact scoring** — the differentiator. Each cell's score is
   `Σ (violation severity × vehicle footprint)`, so a main-road double-parked
   lorry counts far more than a scooter on a footpath. This answers the brief's
   "quantify impact on traffic flow," not just "count violations."
3. **Root-cause classification** — labels every hotspot (commuter overflow /
   delivery overflow / hire demand / safety risk / structural demand /
   enforcement) from its vehicle and violation mix, and prescribes a matching
   fix.

Output: `outputs/curb_hotspots.csv` — every cell ranked, with impact score,
root cause, and recommended fix.

## Project structure

```
curb/
├── config.py              # all weights & thresholds (transparent constants)
├── run.py                 # command-line entry point
├── requirements.txt
├── src/
│   ├── data_loader.py     # read + clean + parse the provided CSV
│   ├── hotspots.py        # impact model + grid clustering + naming
│   ├── rootcause.py       # root-cause labels + recommended fixes
│   └── pipeline.py        # orchestrates the three stages
├── data/                  # place the provided CSV here (not bundled)
└── outputs/               # generated results
```

## Setup & run

```bash
# 1. install dependencies (Python 3.10+)
pip install -r requirements.txt

# 2. place the HackerEarth-provided dataset at:
#    data/violations.csv
#    (or point to it directly — see below)

# 3. run
python run.py                       # uses data/violations.csv
python run.py path/to/violations.csv  # or pass the path explicitly
```

This prints the top hotspots and writes `outputs/curb_hotspots.csv`.

## Methodology & data-use note

All figures trace back to the single provided violation dataset. The severity
weights and vehicle footprint factors in `config.py` are **self-defined,
transparent constants** — the footprint factors adapt the traffic-engineering
Passenger Car Unit (PCU) concept to stationary obstruction. They are not fitted
to, or loaded from, any external dataset. The impact score is therefore an
auditable index, not a black-box regressor: every value can be explained and
defended.

## Roadmap (next components)

- Enforcement prioritizer — rank cells by impact relieved per patrol-hour.
- Chronic-offender intelligence — repeat-vehicle watchlist.
- Emerging-hotspot trend detection — spatial week-over-week trend.
- MapmyIndia dashboard — hotspots + recommended fixes on the partner map.
- Officer copilot — natural-language query layer over the tables above
  (LLM used only as a reasoning/phrasing layer; no external data ingested).
