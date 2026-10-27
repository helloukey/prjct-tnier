"""Which forecast would the trader actually have seen? This is the core domain logic.

Two selection rules, both strictly "no peeking into the future":

* day_ahead: for each target in delivery day D, the latest forecast published at or before
  gate closure on D-1 (11:00 UK by default). Matches how the team really buys power.
* horizon:   for each target T, the latest forecast published at or before T - H hours.
  Lets us show how accuracy degrades with lead time.
"""

from datetime import time

import pandas as pd


def _latest_published_before(forecasts: pd.DataFrame, cutoff: pd.Series) -> pd.DataFrame:
    eligible = forecasts.assign(cutoff=cutoff)
    eligible = eligible[eligible["publish_time"] <= eligible["cutoff"]]
    # Rows are sorted by (start_time, publish_time), so the last per target is the latest.
    return eligible.groupby("start_time", as_index=False).last().drop(columns="cutoff")


def select_day_ahead(forecasts: pd.DataFrame, gate_closure: time) -> pd.DataFrame:
    delivery_day = forecasts["start_time"].dt.normalize()
    cutoff = delivery_day - pd.Timedelta(days=1) + pd.Timedelta(hours=gate_closure.hour, minutes=gate_closure.minute)
    return _latest_published_before(forecasts, cutoff)


def select_fixed_horizon(forecasts: pd.DataFrame, horizon_hours: float) -> pd.DataFrame:
    cutoff = forecasts["start_time"] - pd.Timedelta(hours=horizon_hours)
    return _latest_published_before(forecasts, cutoff)


def join_with_actuals(selected: pd.DataFrame, actuals: pd.DataFrame) -> pd.DataFrame:
    """Forecasts are hourly, actuals half-hourly: inner-join on the shared on-the-hour timestamps."""
    joined = selected.merge(actuals, on="start_time", how="inner")
    joined["error_mw"] = joined["forecast_mw"] - joined["actual_mw"]
    return joined
