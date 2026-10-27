from datetime import time

import pandas as pd

from app.selection import join_with_actuals, select_day_ahead, select_fixed_horizon


def _ts(s: str) -> pd.Timestamp:
    return pd.Timestamp(s, tz="UTC")


def _forecasts(rows: list[tuple[str, str, float]]) -> pd.DataFrame:
    df = pd.DataFrame(rows, columns=["publish_time", "start_time", "forecast_mw"])
    df["publish_time"] = pd.to_datetime(df["publish_time"], utc=True)
    df["start_time"] = pd.to_datetime(df["start_time"], utc=True)
    return df.sort_values(["start_time", "publish_time"]).reset_index(drop=True)


FC = _forecasts(
    [
        ("2026-01-09T09:30Z", "2026-01-10T12:00Z", 100),  # before D-1 11:00 gate
        ("2026-01-09T11:30Z", "2026-01-10T12:00Z", 200),  # after gate: must be ignored
        ("2026-01-10T09:30Z", "2026-01-10T12:00Z", 300),  # same day: must be ignored
    ]
)


def test_day_ahead_picks_latest_forecast_before_gate_closure():
    out = select_day_ahead(FC, time(11, 0))
    assert out["forecast_mw"].tolist() == [100]


def test_day_ahead_gate_closure_is_inclusive():
    out = select_day_ahead(FC, time(11, 30))
    assert out["forecast_mw"].tolist() == [200]


def test_fixed_horizon_respects_lead_time():
    assert select_fixed_horizon(FC, 2)["forecast_mw"].tolist() == [300]
    assert select_fixed_horizon(FC, 24)["forecast_mw"].tolist() == [200]
    assert select_fixed_horizon(FC, 26.5)["forecast_mw"].tolist() == [100]


def test_target_without_eligible_forecast_is_dropped():
    assert select_fixed_horizon(FC, 48).empty


def test_join_computes_signed_error_on_hourly_points():
    actuals = pd.DataFrame(
        {"start_time": [_ts("2026-01-10T12:00"), _ts("2026-01-10T12:30")], "actual_mw": [90.0, 95.0]}
    )
    out = join_with_actuals(select_day_ahead(FC, time(11, 0)), actuals)
    assert len(out) == 1
    assert out["error_mw"].iloc[0] == 10.0  # positive = over-forecast
