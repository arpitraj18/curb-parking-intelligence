"""
CURB — central configuration.

Every weight and threshold below is a SELF-DEFINED, transparent assumption.
None of it is loaded from any external dataset. The footprint factors are
adapted from the traffic-engineering Passenger Car Unit (PCU) concept, which
expresses how much road space a vehicle occupies relative to a car. We adapt
that idea to *stationary* obstruction: a parked lorry blocks far more
carriageway than a parked scooter.

Keeping these as plain constants (not values fitted to outside data) is both
defensible to judges and compliant with the rule that Problem Statement 1 may
use only the provided dataset.
"""

import os

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
# Data path resolves in this order: command-line arg (handled in run.py) ->
# CURB_DATA env var -> the default below. Place the HackerEarth-provided CSV at
# data/violations.csv (it is NOT bundled in this repo).
DATA_PATH = os.environ.get("CURB_DATA", "data/violations.csv")
OUTPUT_DIR = "outputs"
HOTSPOTS_CSV = os.path.join(OUTPUT_DIR, "curb_hotspots.csv")

# ---------------------------------------------------------------------------
# Spatial settings
# ---------------------------------------------------------------------------
# Bengaluru bounding box — anything outside is treated as a bad coordinate.
BBOX = dict(lat_min=12.7, lat_max=13.3, lon_min=77.4, lon_max=77.8)

# Grid cell size in degrees. ~0.0005 deg ≈ 55 m at Bengaluru's latitude.
# Snapping to a grid avoids DBSCAN's "chaining" problem in dense commercial
# districts (which merged whole areas into one useless blob).
GRID = 0.0005

# Rows whose validation_status is one of these were rejected/flagged by the
# police themselves — dropped to keep the analysis base defensible.
DROP_VALIDATION = {"rejected", "duplicate"}

# ---------------------------------------------------------------------------
# Violation severity — how much each violation chokes a carriageway.
# (the WHERE/HOW factor)
# ---------------------------------------------------------------------------
SEVERITY = {
    "PARKING IN A MAIN ROAD": 3.0,
    "PARKING NEAR ROAD CROSSING": 3.0,
    "PARKING NEAR TRAFFIC LIGHT OR ZEBRA CROSS": 3.0,
    "DOUBLE PARKING": 2.5,
    "PARKING OPPOSITE TO ANOTHER PARKED VEHICLE": 2.0,
    "PARKING NEAR BUSTOP/SCHOOL/HOSPITAL ETC": 2.0,
    "WRONG PARKING": 1.5,
    "NO PARKING": 1.5,
    "PARKING ON FOOTPATH": 1.2,
    "PARKING OTHER THAN BUS STOP": 1.0,
}
# Non-parking violations (defective plate, black film, fare refusal, ...) barely
# affect traffic flow.
DEFAULT_SEVERITY = 0.3

# ---------------------------------------------------------------------------
# Vehicle footprint factor — how much carriageway a *parked* vehicle blocks,
# relative to a car (=1.0). (the WHAT factor)
# ---------------------------------------------------------------------------
FOOTPRINT = {
    "SCOOTER": 0.4,
    "MOPED": 0.4,
    "MOTOR CYCLE": 0.5,
    "PASSENGER AUTO": 0.8,   # auto-rickshaw
    "CAR": 1.0,              # reference
    "JEEP": 1.2,
    "GOODS AUTO": 1.2,
    "MAXI-CAB": 1.3,
    "VAN": 1.5,
    "LGV": 1.8,              # light goods vehicle
    "TEMPO": 1.8,
    "LORRY/GOODS VEHICLE": 3.0,
    "PRIVATE BUS": 3.0,
    "BUS (BMTC/KSRTC)": 3.0,
    "HGV": 3.5,              # heavy goods vehicle
}
DEFAULT_FOOTPRINT = 1.0

# ---------------------------------------------------------------------------
# Vehicle behaviour buckets — drive the root-cause label.
# ---------------------------------------------------------------------------
TWO_WHEELER = {"SCOOTER", "MOTOR CYCLE", "MOPED"}
GOODS = {"LGV", "GOODS AUTO", "LORRY/GOODS VEHICLE", "TEMPO", "HGV", "VAN"}
HIRE = {"PASSENGER AUTO", "MAXI-CAB"}

# Violations that are primarily a pedestrian-safety problem.
SAFETY_VIOLATIONS = {"PARKING ON FOOTPATH", "PARKING NEAR BUSTOP/SCHOOL/HOSPITAL ETC"}

# ---------------------------------------------------------------------------
# Root-cause thresholds + the prescribed fix per cause.
# ---------------------------------------------------------------------------
ROOTCAUSE_RULES = dict(
    safety_min_share=0.10,     # >=10% of violations are safety-type
    safety_min_count=5,
    goods_share=0.20,          # >=20% goods vehicles
    two_wheeler_share=0.55,    # >=55% two-wheelers
    hire_share=0.30,           # >=30% autos/cabs
    structural_min_violations=800,
)

RECOMMENDED_FIX = {
    "Safety risk": "Bollards / physical barrier + enforcement",
    "Delivery overflow": "Timed loading bay (off-peak windows)",
    "Commuter overflow": "Park-and-ride signage + reroute to legal lots",
    "Hire / transit demand": "Designated auto/cab stand + drop-off zone",
    "Structural demand": "Paid curb / off-street provision study",
    "Enforcement priority": "Ranked patrol dispatch",
}
