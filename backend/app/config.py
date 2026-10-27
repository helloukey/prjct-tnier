"""Central configuration. Everything domain-specific that a reviewer might want to tweak lives here."""

from datetime import datetime, time, timezone
from pathlib import Path

ELEXON_BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1/datasets"

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
FORECAST_SNAPSHOT = DATA_DIR / "windfor.json"
ACTUALS_SNAPSHOT = DATA_DIR / "fuelhh_wind.json"

# Scope: purchase decisions made in January 2026.
# A decision on day D-1 buys power for delivery day D, so delivery days run 2 Jan -> 1 Feb.
DECISION_START = datetime(2026, 1, 1, tzinfo=timezone.utc)
DECISION_END = datetime(2026, 2, 1, tzinfo=timezone.utc)  # exclusive
DELIVERY_START = datetime(2026, 1, 2, tzinfo=timezone.utc)
DELIVERY_END = datetime(2026, 2, 2, tzinfo=timezone.utc)  # exclusive

# GB day-ahead auction (N2EX / EPEX) gate closure is 11:00 UK time on D-1.
# January is GMT, so UK time == UTC for the whole scope.
DAY_AHEAD_GATE_CLOSURE = time(11, 0)

# WINDFOR runs reach ~64h ahead at most, and coverage of the 744 delivery hours falls off past 48h
# (589 targets at 48h, 217 at 60h), so horizon analysis is capped where the comparison is still fair.
MAX_HORIZON_HOURS = 48
HORIZON_CURVE_STEP_HOURS = 2

# Fetch windows for the snapshot: wide enough to cover a 72h horizon before the first target.
FORECAST_PUBLISH_FROM = datetime(2025, 12, 29, tzinfo=timezone.utc)
FORECAST_PUBLISH_TO = DELIVERY_END
ACTUALS_SETTLEMENT_FROM = "2025-12-31"
ACTUALS_SETTLEMENT_TO = "2026-02-02"
