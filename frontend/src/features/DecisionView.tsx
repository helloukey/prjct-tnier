import { useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fetchDecision } from '../api/client'
import { Card, LegendItem, StatTile, Toggle, TooltipBox } from '../components/ui'
import { useApi } from '../hooks/useApi'
import { axisProps, C, gridProps, gwScale } from '../lib/chart'
import { addDays, axisGw, cutoffLabel, dayLabel, gw, hhmm, publishLabel, signedGw } from '../lib/format'

type Props = {
  day: string
  onDayChange: (day: string) => void
  gateClosure: string
  firstDay: string
  lastDay: string
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1)

export default function DecisionView({ day, onDayChange, gateClosure, firstDay, lastDay }: Props) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const { data, error, loading } = useApi(() => fetchDecision(day, gateClosure), [day, gateClosure])

  const rows = (data?.hours ?? []).map((h) => ({ ...h, t: hhmm(h.start_time), band: [h.p10_mw, h.p90_mw] }))
  const q = data?.error_quantiles
  const y = gwScale(Math.max(0, ...rows.flatMap((r) => [r.p90_mw, r.forecast_mw, r.actual_mw, r.latest_forecast_mw ?? 0])))

  return (
    <section>
      <div className="section-head">
        <div>
          <h2>What the desk saw at {cutoffLabel(gateClosure)}</h2>
          <p className="muted">
            Pick a delivery day: the latest forecast published by {gateClosure} UK the day before, the range wind
            usually landed in, and what it actually did.
          </p>
        </div>
        <div className="day-picker">
          <button onClick={() => onDayChange(addDays(day, -1))} disabled={day <= firstDay} aria-label="Previous day">
            ‹
          </button>
          <input
            type="date"
            value={day}
            min={firstDay}
            max={lastDay}
            onChange={(e) => e.target.value && onDayChange(e.target.value)}
            aria-label="Delivery day"
          />
          <button onClick={() => onDayChange(addDays(day, 1))} disabled={day >= lastDay} aria-label="Next day">
            ›
          </button>
        </div>
      </div>

      {error && <p className="error">Could not load {day}: {error}</p>}

      {data?.summary && q && (
        <div className="tiles">
          <StatTile
            label="Forecast used"
            value={data.publish_time ? publishLabel(data.publish_time) : '—'}
            hint={`Latest run published by ${data.gate_closure_utc} the day before`}
          />
          <StatTile label="Forecast wind (avg)" value={gw(data.summary.mean_forecast_mw)} hint="Average of the hourly forecast" />
          <StatTile
            label="Wind to rely on (avg)"
            value={gw(mean(data.hours.map((h) => h.p10_mw)))}
            hint="Actual wind beat this in 9 of 10 hours historically"
          />
          <StatTile
            label="Actual vs forecast (avg)"
            value={signedGw(-data.summary.bias_mw)}
            hint={`Wind came in ${data.summary.bias_mw > 0 ? 'below' : 'above'} forecast · typical hourly miss ${gw(data.summary.mae_mw)}`}
          />
        </div>
      )}

      <Card
        title={data ? `Wind generation, ${dayLabel(day)}` : 'Wind generation'}
        subtitle="GW, hourly, GB national"
        dim={loading}
        actions={
          <Toggle
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'chart', label: 'Chart' },
              { value: 'table', label: 'Table' },
            ]}
          />
        }
      >
        <div className="legend">
          <LegendItem color={C.actual} label="Actual" />
          <LegendItem color={C.forecast} label={`Forecast at ${cutoffLabel(gateClosure)}`} />
          <LegendItem color={C.forecast} label="Likely range (P10–P90)" band />
          <LegendItem color={C.latest} label="Latest forecast before delivery" />
        </div>
        {view === 'chart' ? (
          <div className="chart-lg">
            <ResponsiveContainer>
              <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="t" {...axisProps} interval="preserveStartEnd" minTickGap={24} />
                <YAxis {...axisProps} tickFormatter={axisGw} width={40} ticks={y.ticks} domain={y.domain} />
                <Tooltip
                  content={({ active, payload }) => {
                    const r = payload?.[0]?.payload as (typeof rows)[number] | undefined
                    if (!active || !r) return null
                    return (
                      <TooltipBox
                        title={`${dayLabel(day)} ${r.t}`}
                        rows={[
                          { label: 'Actual', value: gw(r.actual_mw, 2), color: C.actual },
                          { label: 'Forecast at cutoff', value: gw(r.forecast_mw, 2), color: C.forecast },
                          { label: 'Likely range', value: `${gw(r.p10_mw)} – ${gw(r.p90_mw)}` },
                          ...(r.latest_forecast_mw != null
                            ? [{ label: 'Latest forecast', value: gw(r.latest_forecast_mw, 2), color: C.latest }]
                            : []),
                        ]}
                      />
                    )
                  }}
                />
                <Area dataKey="band" stroke="none" fill={C.forecast} fillOpacity={0.12} isAnimationActive={false} />
                <Line dataKey="latest_forecast_mw" stroke={C.latest} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line dataKey="forecast_mw" stroke={C.forecast} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line dataKey="actual_mw" stroke={C.actual} strokeWidth={2} dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Hour</th>
                  <th>Forecast</th>
                  <th>Likely range</th>
                  <th>Actual</th>
                  <th>Miss</th>
                  <th>Latest forecast</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.t}>
                    <td>{r.t}</td>
                    <td>{gw(r.forecast_mw, 2)}</td>
                    <td>
                      {gw(r.p10_mw)} – {gw(r.p90_mw)}
                    </td>
                    <td>{gw(r.actual_mw, 2)}</td>
                    <td>{signedGw(r.actual_mw - r.forecast_mw, 2)}</td>
                    <td>{r.latest_forecast_mw != null ? gw(r.latest_forecast_mw, 2) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {q && (
          <p className="footnote">
            Likely range: the forecast shifted by how far wind landed from it on the <em>other</em> January days
            (10th–90th percentile: {signedGw(-q.p90)} to {signedGw(-q.p10)}). The day shown is left out, so the band
            isn't fitted to its own outcome.
          </p>
        )}
      </Card>
    </section>
  )
}
