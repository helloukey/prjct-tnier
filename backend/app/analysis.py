"""Use-case layer: composes selection + metrics into the payloads the API serves.

Results are cached per parameter set; the data is immutable, so cached frames must never be mutated.
"""

from datetime import date, time
from functools import lru_cache
from typing import Literal

import pandas as pd

from app import config, metrics
from app.selection import join_with_actuals, select_day_ahead, select_fixed_horizon
from app.store import load_actuals, load_forecasts

Mode = Literal["day_ahead", "horizon"]


def _in_delivery_window(df: pd.DataFrame) -> pd.DataFrame:
    return df[(df["start_time"] >= config.DELIVERY_START) & (df["start_time"] < config.DELIVERY_END)]


@lru_cache(maxsize=128)
def paired(mode: Mode, horizon_hours: float, gate_closure: time) -> pd.DataFrame:
    forecasts = load_forecasts()
    selected = (
        select_day_ahead(forecasts, gate_closure)
        if mode == "day_ahead"
        else select_fixed_horizon(forecasts, horizon_hours)
    )
    return _in_delivery_window(join_with_actuals(selected, load_actuals())).reset_index(drop=True)


def accuracy(mode: Mode, horizon_hours: float, gate_closure: time) -> dict:
    joined = paired(mode, horizon_hours, gate_closure)
    return {
        "summary": metrics.summary(joined),
        "error_quantiles": metrics.error_quantiles(joined["error_mw"]),
        "histogram": metrics.histogram(joined["error_mw"]),
        "by_hour": metrics.by_hour_of_day(joined),
        "by_day": metrics.by_day(joined),
        "points": joined[["start_time", "forecast_mw", "actual_mw"]].to_dict(orient="records"),
    }


@lru_cache(maxsize=1)
def horizon_curve() -> list[dict]:
    total_targets = int((config.DELIVERY_END - config.DELIVERY_START).total_seconds() // 3600)
    curve = []
    for h in range(0, config.MAX_HORIZON_HOURS + 1, config.HORIZON_CURVE_STEP_HOURS):
        joined = paired("horizon", float(h), config.DAY_AHEAD_GATE_CLOSURE)
        s = metrics.summary(joined)
        curve.append(
            {
                "horizon_h": h,
                "mae_mw": s["mae_mw"],
                "rmse_mw": s["rmse_mw"],
                "bias_mw": s["bias_mw"],
                "p90_abs_error_mw": s["p90_abs_error_mw"],
                "coverage_pct": 100 * s["count"] / total_targets,
            }
        )
    return curve


def decision_day(day: date, gate_closure: time) -> dict:
    """Hour-by-hour view of one delivery day, as the desk would have seen it at gate closure.

    The uncertainty band comes from errors on *other* days (leave-one-day-out), so the band shown
    for a day is never fitted to that day's own outcome.
    """
    joined = paired("day_ahead", 0.0, gate_closure)
    is_day = joined["start_time"].dt.date == day
    rows = joined[is_day]
    q = metrics.error_quantiles(joined.loc[~is_day, "error_mw"])

    # Latest forecast before each hour (horizon 0): how the picture changed after the purchase.
    latest = paired("horizon", 0.0, gate_closure)[["start_time", "forecast_mw"]].rename(
        columns={"forecast_mw": "latest_forecast_mw"}
    )
    rows = rows.merge(latest, on="start_time", how="left")

    hours = [
        {
            "start_time": r.start_time,
            "forecast_mw": r.forecast_mw,
            "actual_mw": r.actual_mw,
            "latest_forecast_mw": None if pd.isna(r.latest_forecast_mw) else r.latest_forecast_mw,
            # actual = forecast - error, so error quantiles flip into a band on actual output.
            "p10_mw": max(r.forecast_mw - q["p90"], 0.0),
            "p90_mw": max(r.forecast_mw - q["p10"], 0.0),
        }
        for r in rows.itertuples()
    ]
    return {
        "day": day,
        "publish_time": rows["publish_time"].iloc[0] if len(rows) else None,
        "gate_closure_utc": gate_closure.strftime("%H:%M"),
        "error_quantiles": q,
        "summary": metrics.summary(rows) if len(rows) else None,
        "hours": hours,
    }
