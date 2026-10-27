import { useState } from 'react'
import { fetchAccuracy, fetchHorizonCurve, type Mode } from '../api/client'
import { Card, StatTile, Toggle } from '../components/ui'
import { useApi } from '../hooks/useApi'
import { cutoffLabel, gw, pct } from '../lib/format'
import { DailyErrorChart, ErrorHistogram, ForecastVsActualScatter, HorizonChart, HourOfDayChart } from './AccuracyCharts'

type Props = {
  gateClosure: string
  maxHorizon: number
  selectedDay: string
  onSelectDay: (day: string) => void
}

/** Lead times covered by the day-ahead rule: from gate closure on D-1 to the start/end of day D. */
function decisionWindow(gateClosure: string): [number, number] {
  const [h, m] = gateClosure.split(':').map(Number)
  const toMidnight = 24 - h - m / 60
  return [toMidnight, toMidnight + 23]
}

export default function AccuracyView({ gateClosure, maxHorizon, selectedDay, onSelectDay }: Props) {
  const [mode, setMode] = useState<Mode>('day_ahead')
  const [horizon, setHorizon] = useState(24)
  const accuracy = useApi(() => fetchAccuracy(mode, horizon, gateClosure), [mode, horizon, gateClosure])
  const curve = useApi(fetchHorizonCurve, [])

  const a = accuracy.data
  const s = a?.summary
  const window = decisionWindow(gateClosure)
  const basis = mode === 'day_ahead' ? `forecast live at ${cutoffLabel(gateClosure)}` : `latest forecast published ≥ ${horizon}h ahead`
  // Only call the miss structural when it really is lopsided; otherwise don't over-claim.
  const lopsided = s ? Math.max(s.share_over_forecast_pct, 100 - s.share_over_forecast_pct) >= 75 : false

  return (
    <section>
      <div className="section-head">
        <div>
          <h2>How accurate are the forecasts?</h2>
          <p className="muted">All {s?.count ?? 744} delivery hours, 2 Jan – 1 Feb 2026, using the {basis}.</p>
        </div>
        <div className="controls">
          <Toggle
            label="Forecast basis"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'day_ahead', label: 'At decision cutoff' },
              { value: 'horizon', label: 'Fixed lead time' },
            ]}
          />
          {mode === 'horizon' && (
            <label className="slider">
              <input
                type="range"
                min={0}
                max={maxHorizon}
                step={1}
                value={horizon}
                onChange={(e) => setHorizon(Number(e.target.value))}
                aria-label="Forecast lead time in hours"
              />
              <span>{horizon}h</span>
            </label>
          )}
        </div>
      </div>

      {accuracy.error && <p className="error">Could not load accuracy: {accuracy.error}</p>}

      {s && a && (
        <>
          <div className="tiles">
            <StatTile label="Typical miss (MAE)" value={gw(s.mae_mw, 2)} hint={`Average hourly miss, ${pct(s.nmae_pct ?? 0)} of average output`} />
            <StatTile
              label={s.bias_mw >= 0 ? 'Over-forecast on average (bias)' : 'Under-forecast on average (bias)'}
              value={gw(Math.abs(s.bias_mw), 2)}
              hint={`Forecast above actual in ${pct(s.share_over_forecast_pct)} of hours`}
            />
            <StatTile label="Bad-hour miss (P90)" value={gw(s.p90_abs_error_mw, 2)} hint="1 hour in 10 misses by more than this" />
            <StatTile label="RMSE" value={gw(s.rmse_mw, 2)} hint={`Penalises big misses · worst shortfall ${gw(s.max_over_forecast_mw)}`} />
          </div>

          <div className="callout">
            <strong>What this means for buying:</strong> wind came in below the forecast in{' '}
            {pct(s.share_over_forecast_pct)} of hours. To be covered 9 times out of 10, plan on{' '}
            <strong>forecast − {gw(a.error_quantiles.p90)}</strong> of wind and buy the difference in the day-ahead
            auction rather than at short notice.
            {lopsided &&
              ' Because the miss is so one-sided at every lead time, it looks structural (possibly wind curtailment) rather than weather error, so it is predictable and can be planned for.'}
          </div>
        </>
      )}

      <div className="grid">
        <Card
          title="Error vs lead time"
          subtitle="How much a later forecast would have helped. Lower is better."
          dim={curve.loading}
        >
          {curve.data && <HorizonChart curve={curve.data} decisionWindow={window} selectedHorizon={mode === 'horizon' ? horizon : null} />}
          <p className="footnote">Coverage drops past ~44h: not every forecast run looks that far ahead.</p>
        </Card>
        <Card title="Distribution of misses" subtitle="Number of hours by actual − forecast, 0.5 GW bins" dim={accuracy.loading}>
          {a && <ErrorHistogram histogram={a.histogram} />}
        </Card>
        <Card title="Typical miss by delivery hour" subtitle="Average absolute miss (MAE) for each hour of the day, GW" dim={accuracy.loading}>
          {a && <HourOfDayChart byHour={a.by_hour} />}
        </Card>
        <Card title="Typical miss by day" subtitle="MAE per delivery day, GW. Click a day to open it above." dim={accuracy.loading}>
          {a && <DailyErrorChart byDay={a.by_day} selectedDay={selectedDay} onSelectDay={onSelectDay} />}
        </Card>
        <Card title="Forecast vs actual" subtitle="One dot per delivery hour, GW. Dots below the line are hours where wind fell short." dim={accuracy.loading}>
          {a && <ForecastVsActualScatter points={a.points} />}
        </Card>
      </div>
    </section>
  )
}
