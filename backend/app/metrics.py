"""Forecast accuracy metrics over a joined frame (start_time, forecast_mw, actual_mw, error_mw).

Sign convention: error = forecast - actual, so positive error means wind under-delivered and the
desk would have had to buy the shortfall late.
"""

import numpy as np
import pandas as pd


def summary(joined: pd.DataFrame) -> dict:
    err = joined["error_mw"]
    abs_err = err.abs()
    mean_actual = joined["actual_mw"].mean()
    return {
        "count": int(len(joined)),
        "mae_mw": float(abs_err.mean()),
        "rmse_mw": float(np.sqrt((err**2).mean())),
        "bias_mw": float(err.mean()),
        "p50_abs_error_mw": float(abs_err.quantile(0.5)),
        "p90_abs_error_mw": float(abs_err.quantile(0.9)),
        "max_over_forecast_mw": float(err.max()),
        "max_under_forecast_mw": float(err.min()),
        # MAE relative to mean output: a scale-free "how wrong, typically" figure.
        "nmae_pct": float(100 * abs_err.mean() / mean_actual) if mean_actual else None,
        "mean_actual_mw": float(mean_actual),
        "mean_forecast_mw": float(joined["forecast_mw"].mean()),
        "share_over_forecast_pct": float(100 * (err > 0).mean()),
    }


def error_quantiles(errors: pd.Series, levels: tuple[float, ...] = (0.1, 0.5, 0.9)) -> dict[str, float]:
    return {f"p{round(q * 100)}": float(errors.quantile(q)) for q in levels}


def histogram(errors: pd.Series, bin_width: float = 500) -> list[dict]:
    lo = np.floor(errors.min() / bin_width) * bin_width
    hi = np.ceil(errors.max() / bin_width) * bin_width + bin_width
    counts, edges = np.histogram(errors, bins=np.arange(lo, hi, bin_width))
    return [
        {"bin_start_mw": float(s), "bin_end_mw": float(e), "count": int(c)} for s, e, c in zip(edges, edges[1:], counts)
    ]


def by_hour_of_day(joined: pd.DataFrame) -> list[dict]:
    grouped = joined.groupby(joined["start_time"].dt.hour)["error_mw"]
    stats = pd.DataFrame({"mae_mw": grouped.apply(lambda e: e.abs().mean()), "bias_mw": grouped.mean()})
    return [{"hour": int(h), **{k: float(v) for k, v in row.items()}} for h, row in stats.iterrows()]


def by_day(joined: pd.DataFrame) -> list[dict]:
    grouped = joined.groupby(joined["start_time"].dt.strftime("%Y-%m-%d"))
    return [
        {
            "day": day,
            "mae_mw": float(g["error_mw"].abs().mean()),
            "bias_mw": float(g["error_mw"].mean()),
            "mean_actual_mw": float(g["actual_mw"].mean()),
        }
        for day, g in grouped
    ]
