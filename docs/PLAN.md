# Project plan

Time budget: 16h total. Status markers: ✅ done · ⏳ next · ⬜ later.

## 1. Domain understanding

- **Who:** the day-ahead power purchasing desk at a UK utility.
- **Decision:** on day D-1, before the GB day-ahead auction gate closure (**11:00 UK**, N2EX/EPEX), they
  buy the hourly volumes for delivery day D. Volume to buy ≈ demand − expected wind (− other sources).
- **Why forecasts matter:** wind is weather-driven. When it under-delivers versus the forecast, the
  shortfall is bought at imbalance or intraday prices, and when it over-delivers they hold surplus. The
  team needs the *latest forecast available at decision time* and the *size of the error* to expect.
- **Data (Elexon BMRS, public, no API key):**
  | Dataset | Content | Resolution | Notes |
  |---|---|---|---|
  | `FUELHH` (fuelType=WIND) | Actual wind outturn, MW | 30 min | `startTime` = target |
  | `WINDFOR` | Wind forecast, MW | hourly targets, ~72h ahead | Published ~8×/day at 02:30, 04:30, 07:30, 09:30, 11:30, 15:30, 18:30, 22:30 UTC |
- **Scope:** decisions made **1–31 Jan 2026**, so delivery days run **2 Jan → 1 Feb 2026** (744 hourly targets).
  January is GMT, so UK time = UTC and there are no DST edge cases inside the scope.

### Key modelling choices
1. **Decision forecast (`day_ahead` mode):** for each target hour on day D, use the latest WINDFOR
   published at or before 11:00 on D-1. In practice that's the **09:30 D-1 run**, with lead times of 14.5h–38.5h.
   The gate closure time is a parameter.
2. **Fixed-horizon mode:** for each target T, use the latest forecast published at or before T − H
   (H = 0–48h). This shows how accuracy changes with lead time. It's capped at 48h because WINDFOR runs
   reach about 64h at most, and coverage of the 744 delivery hours falls off past about 44h (79% at 48h,
   29% at 60h, 0% at 72h).
3. **Pairing:** forecasts are hourly and actuals half-hourly, so we join on the on-the-hour timestamps.
   We don't interpolate or average, so no synthetic data gets in.
4. **Error sign:** `error = forecast − actual`. Positive means over-forecast, which is the risk that
   forces extra buying late.
5. **No look-ahead:** a forecast is used only if `publish_time ≤ cutoff`. This is enforced in
   `backend/app/selection.py` and covered by unit tests.

6. **Uncertainty band:** P10–P90 of actual output = forecast − error quantiles. On the decision view the
   quantiles come from all *other* days (leave-one-day-out), so a day's band is never fitted to its own outcome.

### Findings (January 2026, forecast live at 11:00 gate closure)
| Metric | Value |
|---|---|
| Typical miss (MAE) | 2.00 GW (18% of mean output 11.3 GW) |
| RMSE | 2.50 GW |
| Bias (forecast − actual) | **+1.73 GW**: forecast above actual in **84%** of hours |
| P90 absolute error | 4.18 GW |
| Error at 0h → 24h → 48h lead time | 1.68 → 1.93 → 2.30 GW MAE |

- **The gap is one-directional and about the same at every lead time (+1.5 GW even at 0h).** That points
  to a structural gap rather than weather error. Our hypothesis is curtailment: FUELHH is output after
  the grid operator's balancing actions, while the forecast reflects available wind. We haven't confirmed
  this yet, but it's worth raising with the client.
- **Rule of thumb for the desk:** wind ≥ forecast − 4.2 GW in 9 of 10 hours.
- **The likely-range band is well calibrated when tested on days it wasn't fitted to:** actual wind fell inside the P10–P90 band in 78.2% of hours (target 80%) and below P10 in 11.2% (target 10%). `test_decision_band_is_calibrated_out_of_sample` checks this.
- Errors are largest overnight (00:00–07:00).

## 2. Product (what the client sees)

| View | Purpose (maps to requirement) |
|---|---|
| **Decision view** | Pick a delivery day and see the forecast that was live at gate closure, the actuals, and a **P10–P90 error band** taken from historical errors. Answers "how much wind can I count on?" (Req 1) |
| **Accuracy dashboard** | KPI tiles (MAE, RMSE, bias, P90 absolute error, nMAE %), error distribution histogram, actual vs forecast scatter (Req 2) |
| **Horizon analysis** | Error vs lead time (0–48h). Shows how much is gained by waiting for a later run |
| **Error patterns** | Error by hour of day and by wind level, e.g. where ramps hurt the most |
| **Buy-side takeaway** | "Holding back X MW covers 90% of wind shortfalls": turns the error stats into a hedging rule of thumb |

## 3. Architecture

```
React (Vite, TS, Recharts) ──/api──▶ FastAPI (Python) ──▶ pandas analysis
                                         │
                                         └─ bundled JSON snapshot  ◀── scripts/fetch_snapshot.py ◀── Elexon BMRS
```
- **Snapshot instead of live calls:** the January 2026 data is historical and doesn't change, and it's
  only about 2 MB. Bundling it makes the app fast, deterministic and independent of Elexon uptime. A
  script refreshes it.
- **Single origin `/api`:** the same frontend code works in Vite dev (proxy), Docker (nginx proxy) and
  Vercel (rewrite to a Python serverless function).
- **Backend layering:** `elexon.py` (I/O) → `store.py` (load and normalise) → `selection.py` (which
  forecast) → `metrics.py` (accuracy) → `main.py` (HTTP). Domain logic is pure functions over DataFrames,
  which keeps it easy to unit-test.

## 4. Milestones

| # | Task | Est. | Status |
|---|---|---|---|
| 0 | Domain research, data probing, plan | 1.5h | ✅ |
| 1 | Scaffold: FastAPI, Vite React, Docker, Vercel config, snapshot, selection logic and tests | 1.5h | ✅ |
| 2 | `metrics.py`: MAE/RMSE/bias/quantiles, by-horizon, by-hour, error bands, plus tests | 2h | ✅ |
| 3 | API endpoints: `/api/accuracy`, `/api/horizon-curve`, `/api/decision/{day}` | 1h | ✅ |
| 4 | Frontend: layout, controls (cutoff, mode, horizon, date), decision view chart and table | 3h | ✅ |
| 5 | Frontend: accuracy dashboard, horizon and error-pattern charts | 2.5h | ✅ |
| 6 | Polish: copy review, "How to read this page" panel, code-split the chart bundle | 1h | ✅ |
| 6b | Docker build check (+ backend healthcheck gating nginx start) | 0.25h | ✅ |
| 7a | CI: GitHub Actions (ruff lint+format, pytest, oxlint, build, Docker smoke test) | 0.5h | ✅ |
| 7b | Deploy to Vercel, README live link | 0.5h | ✅ |
| 8 | Video: customer pitch (≤5 min) and tech-lead walkthrough (≤5 min) | 1.5h | ⬜ |

## 5. Deliverables checklist
- [ ] Public GitHub repo with an anonymous name (e.g. `prjct-tnier`)
- [ ] README: file layout, how to run, live link, AI-tool disclosure
- [ ] Vercel deployment, checked in incognito
- [ ] Unlisted YouTube video ≤10 min, checked in incognito
- [ ] Submission form
