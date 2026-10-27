"""Refresh the bundled data snapshot from Elexon. Run from backend/: `python -m scripts.fetch_snapshot`."""

import json

from app import config
from app.elexon import fetch_wind_actuals, fetch_wind_forecasts


def main() -> None:
    forecasts = fetch_wind_forecasts(config.FORECAST_PUBLISH_FROM, config.FORECAST_PUBLISH_TO)
    actuals = fetch_wind_actuals(config.ACTUALS_SETTLEMENT_FROM, config.ACTUALS_SETTLEMENT_TO)
    config.DATA_DIR.mkdir(exist_ok=True)
    config.FORECAST_SNAPSHOT.write_text(json.dumps(forecasts))
    config.ACTUALS_SNAPSHOT.write_text(json.dumps(actuals))
    print(f"Saved {len(forecasts)} forecast rows and {len(actuals)} actual rows to {config.DATA_DIR}")


if __name__ == "__main__":
    main()
