"""FastAPI entrypoint. All routes live under /api so the same app works behind Vercel and Docker."""

from datetime import date, time

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app import analysis, config
from app.analysis import Mode
from app.store import load_forecasts

app = FastAPI(title="Wind Forecast Monitor API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

GateClosure = Query(
    config.DAY_AHEAD_GATE_CLOSURE, description="Day-ahead decision cutoff on D-1 (UK time = UTC in Jan)"
)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/meta")
def meta() -> dict:
    forecasts = load_forecasts()
    return {
        "delivery_start": config.DELIVERY_START,
        "delivery_end": config.DELIVERY_END,
        "gate_closure_utc": config.DAY_AHEAD_GATE_CLOSURE.strftime("%H:%M"),
        "max_horizon_hours": config.MAX_HORIZON_HOURS,
        "forecast_publishes": int(forecasts["publish_time"].nunique()),
        "latest_publish": forecasts["publish_time"].max(),
    }


@app.get("/api/accuracy")
def accuracy(
    mode: Mode = "day_ahead",
    horizon_hours: float = Query(24, ge=0, le=config.MAX_HORIZON_HOURS),
    gate_closure: time = GateClosure,
) -> dict:
    """Accuracy of the selected forecast over all January delivery hours."""
    return analysis.accuracy(mode, horizon_hours, gate_closure)


@app.get("/api/horizon-curve")
def horizon_curve() -> list[dict]:
    """Error metrics as a function of forecast lead time (0 to MAX_HORIZON_HOURS)."""
    return analysis.horizon_curve()


@app.get("/api/decision/{day}")
def decision(day: date, gate_closure: time = GateClosure) -> dict:
    """One delivery day: the forecast live at gate closure, actuals, and an uncertainty band."""
    if not (config.DELIVERY_START.date() <= day < config.DELIVERY_END.date()):
        raise HTTPException(404, f"{day} is outside the delivery window")
    return analysis.decision_day(day, gate_closure)
