"""Integration tests against the bundled January 2026 snapshot."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_accuracy_day_ahead_covers_every_delivery_hour():
    body = client.get("/api/accuracy").json()
    assert body["summary"]["count"] == 31 * 24
    assert len(body["points"]) == 31 * 24
    assert len(body["by_hour"]) == 24
    assert len(body["by_day"]) == 31


def test_accuracy_rejects_horizon_beyond_cap():
    assert client.get("/api/accuracy", params={"mode": "horizon", "horizon_hours": 72}).status_code == 422


def test_horizon_curve_error_grows_with_lead_time():
    curve = client.get("/api/horizon-curve").json()
    assert curve[0]["horizon_h"] == 0
    assert curve[-1]["mae_mw"] > curve[0]["mae_mw"]
    assert all(0 < p["coverage_pct"] <= 100 for p in curve)


def test_decision_day_uses_forecast_published_before_gate_closure():
    body = client.get("/api/decision/2026-01-15").json()
    assert len(body["hours"]) == 24
    assert body["publish_time"] <= "2026-01-14T11:00:00Z"
    for h in body["hours"]:
        assert h["p10_mw"] <= h["p90_mw"]


def test_decision_day_outside_window_is_404():
    assert client.get("/api/decision/2026-03-01").status_code == 404


def test_decision_band_is_calibrated_out_of_sample():
    """The P10–P90 band should contain roughly 80% of actual outturns on days it wasn't fitted to."""
    days = client.get("/api/accuracy").json()["by_day"]
    hours = [h for d in days for h in client.get(f"/api/decision/{d['day']}").json()["hours"]]
    inside = sum(h["p10_mw"] <= h["actual_mw"] <= h["p90_mw"] for h in hours) / len(hours)
    below = sum(h["actual_mw"] < h["p10_mw"] for h in hours) / len(hours)
    assert 0.7 <= inside <= 0.9
    assert 0.05 <= below <= 0.15
