import math

import pandas as pd
import pytest

from app import metrics


@pytest.fixture
def joined() -> pd.DataFrame:
    df = pd.DataFrame(
        {
            "start_time": pd.to_datetime(
                ["2026-01-10T00:00Z", "2026-01-10T01:00Z", "2026-01-11T00:00Z", "2026-01-11T01:00Z"], utc=True
            ),
            "forecast_mw": [110.0, 90.0, 130.0, 100.0],
            "actual_mw": [100.0, 100.0, 100.0, 100.0],
        }
    )
    df["error_mw"] = df["forecast_mw"] - df["actual_mw"]  # 10, -10, 30, 0
    return df


def test_summary_core_metrics(joined):
    s = metrics.summary(joined)
    assert s["count"] == 4
    assert s["mae_mw"] == pytest.approx(12.5)
    assert s["rmse_mw"] == pytest.approx(math.sqrt((100 + 100 + 900 + 0) / 4))
    assert s["bias_mw"] == pytest.approx(7.5)
    assert s["nmae_pct"] == pytest.approx(12.5)
    assert s["max_over_forecast_mw"] == 30
    assert s["max_under_forecast_mw"] == -10
    assert s["share_over_forecast_pct"] == pytest.approx(50)


def test_histogram_counts_every_error(joined):
    bins = metrics.histogram(joined["error_mw"], bin_width=10)
    assert sum(b["count"] for b in bins) == 4
    assert bins[0]["bin_start_mw"] <= -10
    assert bins[-1]["bin_end_mw"] >= 30  # numpy's last bin is closed on the right


def test_by_hour_and_by_day(joined):
    hours = {h["hour"]: h for h in metrics.by_hour_of_day(joined)}
    assert hours[0]["mae_mw"] == pytest.approx(20)
    assert hours[1]["bias_mw"] == pytest.approx(-5)
    days = {d["day"]: d for d in metrics.by_day(joined)}
    assert days["2026-01-11"]["mae_mw"] == pytest.approx(15)


def test_error_quantiles_keys():
    q = metrics.error_quantiles(pd.Series(range(101), dtype=float))
    assert q == {"p10": 10.0, "p50": 50.0, "p90": 90.0}
