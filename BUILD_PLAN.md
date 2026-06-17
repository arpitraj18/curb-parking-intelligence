# CURB — Build Plan (commit by commit)

Build the project on your own machine in this order. At each step: create/extend
the file, run it to confirm it works, then commit. This gives you a genuine,
incremental history and — more importantly — means you've actually run and
understood every piece before the live finale.

## One-time setup

```bash
mkdir curb && cd curb
git init
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
```

## The commits

**1. Project skeleton**
Create the folder layout (`src/`, `data/`, `outputs/`), `.gitignore`,
`requirements.txt`, and a one-line `README.md`. Then:
```bash
pip install -r requirements.txt
git add . && git commit -m "chore: project skeleton, gitignore, requirements"
```

**2. Configuration**
Add `config.py` (paths, severity weights, footprint factors, thresholds).
```bash
git add config.py && git commit -m "feat: config — severity weights and vehicle footprint factors"
```

**3. Data loader**
Add `src/__init__.py` and `src/data_loader.py`. Test in a quick Python shell:
`from src.data_loader import load_and_clean; load_and_clean("data/violations.csv")`.
```bash
git add src/ && git commit -m "feat: data loader — clean and parse violation records"
```

**4. Hotspot clustering (counts first)**
Add `src/hotspots.py` with grid snapping + per-cell counts and naming (no impact
score yet). Confirm you get ~14k cells.
```bash
git add src/hotspots.py && git commit -m "feat: grid-based hotspot clustering"
```

**5. Congestion-impact model**
Extend `src/hotspots.py`: add `add_row_features` (severity x footprint) and make
`impact_score` the ranking key. This is the differentiator.
```bash
git add src/hotspots.py && git commit -m "feat: PCU-weighted congestion-impact scoring"
```

**6. Root-cause classification**
Add `src/rootcause.py` (cause labels + recommended fixes).
```bash
git add src/rootcause.py && git commit -m "feat: root-cause classification and prescribed fixes"
```

**7. Pipeline + CLI**
Add `src/pipeline.py` and `run.py`. Confirm `python run.py data/violations.csv`
prints the top hotspots and writes `outputs/curb_hotspots.csv`.
```bash
git add src/pipeline.py run.py && git commit -m "feat: pipeline orchestrator and CLI runner"
```

**8. Verification notebook**
Add `notebooks/01_curb_analysis.ipynb`. Launch `jupyter notebook` from the repo
root and run it top to bottom — confirm the metrics (Spearman, concentration,
silhouette) match.
```bash
git add notebooks/ && git commit -m "feat: verification notebook with reproducible metrics"
```

**9. Documentation**
Flesh out `README.md` (methodology, run instructions, compliance note).
```bash
git add README.md && git commit -m "docs: methodology, run instructions, data-use note"
```

## After this core

Each later component is its own commit on top: enforcement prioritizer,
chronic-offender intelligence, emerging-hotspot trend, MapmyIndia dashboard,
officer copilot. Build → run → commit, one at a time.

## Push to GitHub (for the Repository URL field)

```bash
git branch -M main
git remote add origin https://github.com/<you>/curb.git
git push -u origin main
```
