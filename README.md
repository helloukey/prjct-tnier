# Wind Forecast Monitor

A web app for a UK utility's day-ahead power purchasing team. It shows **the latest national wind
generation forecast available at decision time** and **how accurate those forecasts have been**, so
purchase volumes can account for the expected error. Scope: GB national wind (Elexon `FUELHH` and
`WINDFOR`), purchase decisions made in January 2026.

- **Live app:** _TBD (Vercel)_
- **Plan, domain notes and findings:** [docs/PLAN.md](docs/PLAN.md)

## What it does

1. **Decision view:** pick a delivery day and see the forecast that was live at the day-ahead cutoff
   (11:00 UK on D-1 by default, adjustable), a P10–P90 "likely range", the actual outturn, and the latest
   forecast before delivery. Available as a chart or a table.
2. **Accuracy dashboard:** MAE, bias, P90 error and RMSE over all January delivery hours, with a
   plain-English buying takeaway, error vs lead time (0–48h), error distribution, error by hour of day,
   error by day (click a day to inspect it) and a forecast-vs-actual scatter. Switch between "at gate
   closure" and "fixed lead time" forecasts.

## API

| Endpoint | Description |
|---|---|
| `GET /api/meta` | Scope, gate closure, data freshness |
| `GET /api/accuracy?mode=day_ahead\|horizon&horizon_hours=24&gate_closure=11:00` | Accuracy metrics and chart data |
| `GET /api/horizon-curve` | Error metrics per lead time, 0–48h |
| `GET /api/decision/{YYYY-MM-DD}?gate_closure=11:00` | One delivery day, hour by hour, with uncertainty band |

Interactive docs are at `/docs` when running the backend.

## Repository layout

```
.
├── api/index.py              # Vercel serverless entry: re-exports the FastAPI app
├── backend/
│   ├── app/
│   │   ├── config.py         # Scope dates, gate closure, data paths
│   │   ├── elexon.py         # Elexon BMRS API client
│   │   ├── store.py          # Loads and normalises the data snapshot (pandas)
│   │   ├── selection.py      # Which forecast was live at decision time (no look-ahead)
│   │   ├── metrics.py        # MAE, RMSE, bias, quantiles, histogram, by hour/day
│   │   ├── analysis.py       # Composes selection + metrics into API payloads (cached)
│   │   └── main.py           # FastAPI routes under /api
│   ├── data/                 # Bundled Jan 2026 snapshot (WINDFOR + FUELHH wind)
│   ├── scripts/fetch_snapshot.py  # Refreshes the snapshot from Elexon
│   ├── tests/                # pytest: selection + metrics units, API integration
│   └── Dockerfile
├── frontend/                 # React + TypeScript (Vite), Recharts
│   ├── src/api/client.ts     # Typed API client
│   ├── src/features/         # DecisionView (req. 1), AccuracyView + charts (req. 2)
│   ├── src/components/ui.tsx # Card, StatTile, Toggle, legend and tooltip primitives
│   ├── src/lib/              # Formatting and chart tokens/scales
│   ├── src/hooks/useApi.ts   # Fetch hook (keeps previous data while refetching)
│   ├── nginx.conf            # Serves the SPA and proxies /api in Docker
│   └── Dockerfile
├── .github/workflows/ci.yml  # CI: backend, frontend, Docker smoke test
├── docs/PLAN.md              # Domain notes, design decisions, milestones
├── docker-compose.yml
├── vercel.json
└── requirements.txt          # Python deps for Vercel (mirrors backend/requirements.txt)
```

## Running locally

**Docker (recommended)**
```bash
docker compose up --build
# App: http://localhost:8080   API: http://localhost:8000/api/health   API docs: http://localhost:8000/docs
```

**Without Docker**
```bash
# Backend (Python 3.12+)
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000

# Frontend (Node 20+), in another terminal
cd frontend
npm install
npm run dev        # http://localhost:5173 (proxies /api to :8000)
```

**Tests and lint**
```bash
cd backend && pytest && ruff check . && ruff format --check .
cd frontend && npm run lint && npm run build
```

## Continuous integration

[.github/workflows/ci.yml](.github/workflows/ci.yml) runs on every push to `main` and on every pull request, as three parallel jobs:

| Job | Checks |
|---|---|
| Backend | `ruff check`, `ruff format --check`, `pytest` (Python 3.12) |
| Frontend | `oxlint`, TypeScript type-check and production build (Node 22) |
| Docker | `docker compose build`, starts the stack (waits for the healthcheck), smoke-tests the page and API through nginx |

**Refresh the data snapshot**
```bash
cd backend && python -m scripts.fetch_snapshot
```

## AI tools

This project was built with help from **Claude Code** (Anthropic), used for scaffolding, code
generation and documentation. All design decisions and outputs were reviewed by the author.
