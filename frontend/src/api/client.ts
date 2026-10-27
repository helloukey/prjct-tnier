export type Meta = {
  delivery_start: string
  delivery_end: string
  gate_closure_utc: string
  max_horizon_hours: number
  forecast_publishes: number
  latest_publish: string
}

export type Summary = {
  count: number
  mae_mw: number
  rmse_mw: number
  bias_mw: number
  p50_abs_error_mw: number
  p90_abs_error_mw: number
  max_over_forecast_mw: number
  max_under_forecast_mw: number
  nmae_pct: number | null
  mean_actual_mw: number
  mean_forecast_mw: number
  share_over_forecast_pct: number
}

export type ErrorQuantiles = { p10: number; p50: number; p90: number }

export type Accuracy = {
  summary: Summary
  error_quantiles: ErrorQuantiles
  histogram: { bin_start_mw: number; bin_end_mw: number; count: number }[]
  by_hour: { hour: number; mae_mw: number; bias_mw: number }[]
  by_day: { day: string; mae_mw: number; bias_mw: number; mean_actual_mw: number }[]
  points: { start_time: string; forecast_mw: number; actual_mw: number }[]
}

export type HorizonPoint = {
  horizon_h: number
  mae_mw: number
  rmse_mw: number
  bias_mw: number
  p90_abs_error_mw: number
  coverage_pct: number
}

export type DecisionHour = {
  start_time: string
  forecast_mw: number
  actual_mw: number
  latest_forecast_mw: number | null
  p10_mw: number
  p90_mw: number
}

export type Decision = {
  day: string
  publish_time: string | null
  gate_closure_utc: string
  error_quantiles: ErrorQuantiles
  summary: Summary | null
  hours: DecisionHour[]
}

export type Mode = 'day_ahead' | 'horizon'

async function get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const query = params ? `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}` : ''
  const res = await fetch(`/api${path}${query}`)
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`)
  return res.json() as Promise<T>
}

export const fetchMeta = () => get<Meta>('/meta')

export const fetchAccuracy = (mode: Mode, horizonHours: number, gateClosure: string) =>
  get<Accuracy>('/accuracy', { mode, horizon_hours: horizonHours, gate_closure: gateClosure })

export const fetchHorizonCurve = () => get<HorizonPoint[]>('/horizon-curve')

export const fetchDecision = (day: string, gateClosure: string) =>
  get<Decision>(`/decision/${day}`, { gate_closure: gateClosure })
