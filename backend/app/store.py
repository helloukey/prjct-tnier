"""Loads the January 2026 data into DataFrames.

The scope is historical and immutable, so we ship a JSON snapshot in `data/` and load it once
per process. This keeps the deployed app fast and independent of Elexon uptime.
Refresh the snapshot with `python -m scripts.fetch_snapshot`.
"""

import json
from functools import lru_cache
from pathlib import Path

import pandas as pd

from app.config import ACTUALS_SNAPSHOT, FORECAST_SNAPSHOT


def _read(path: Path) -> list[dict]:
    with path.open() as f:
        return json.load(f)


@lru_cache(maxsize=1)
def load_actuals() -> pd.DataFrame:
    """Columns: start_time (UTC), actual_mw. Half-hourly, de-duplicated."""
    df = pd.DataFrame(_read(ACTUALS_SNAPSHOT))
    df = df[df["fuelType"] == "WIND"]
    df = pd.DataFrame(
        {
            "start_time": pd.to_datetime(df["startTime"], utc=True),
            "actual_mw": df["generation"].astype(float),
        }
    )
    return df.drop_duplicates("start_time", keep="last").sort_values("start_time").reset_index(drop=True)


@lru_cache(maxsize=1)
def load_forecasts() -> pd.DataFrame:
    """Columns: publish_time, start_time (UTC), forecast_mw, horizon_h. One row per (publish, target)."""
    df = pd.DataFrame(_read(FORECAST_SNAPSHOT))
    df = pd.DataFrame(
        {
            "publish_time": pd.to_datetime(df["publishTime"], utc=True),
            "start_time": pd.to_datetime(df["startTime"], utc=True),
            "forecast_mw": df["generation"].astype(float),
        }
    )
    df = df.drop_duplicates(["publish_time", "start_time"], keep="last")
    df["horizon_h"] = (df["start_time"] - df["publish_time"]).dt.total_seconds() / 3600
    # Rows targeting the past (negative horizon) are not forecasts.
    df = df[df["horizon_h"] >= 0]
    return df.sort_values(["start_time", "publish_time"]).reset_index(drop=True)
