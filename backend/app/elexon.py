"""Thin client for the Elexon BMRS Insights API (public, no key required)."""

from datetime import datetime

import httpx

from app.config import ELEXON_BASE_URL

TIMEOUT = httpx.Timeout(60.0)


def _iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def fetch_wind_forecasts(publish_from: datetime, publish_to: datetime) -> list[dict]:
    """WINDFOR: national wind forecasts, published ~8x/day, hourly targets ~72h ahead."""
    resp = httpx.get(
        f"{ELEXON_BASE_URL}/WINDFOR/stream",
        params={"publishDateTimeFrom": _iso(publish_from), "publishDateTimeTo": _iso(publish_to)},
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()


def fetch_wind_actuals(settlement_from: str, settlement_to: str) -> list[dict]:
    """FUELHH filtered to WIND: half-hourly outturn generation (MW)."""
    resp = httpx.get(
        f"{ELEXON_BASE_URL}/FUELHH/stream",
        params={
            "settlementDateFrom": settlement_from,
            "settlementDateTo": settlement_to,
            "fuelType": "WIND",
        },
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()
