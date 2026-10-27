import { useState } from 'react'
import { fetchMeta } from './api/client'
import AccuracyView from './features/AccuracyView'
import DecisionView from './features/DecisionView'
import { useApi } from './hooks/useApi'
import { addDays, GATE_CLOSURE, publishLabel } from './lib/format'

const GATE_CLOSURES = ['07:30', '09:00', '10:00', '11:00', '12:00']

export default function App() {
  const meta = useApi(fetchMeta, [])
  const [gateClosure, setGateClosure] = useState(GATE_CLOSURE)
  const [day, setDay] = useState('2026-01-15')

  if (meta.error) return <main className="shell"><p className="error">API unavailable: {meta.error}</p></main>
  if (!meta.data) return <main className="shell"><p className="muted">Loading…</p></main>

  const firstDay = meta.data.delivery_start.slice(0, 10)
  const lastDay = addDays(meta.data.delivery_end.slice(0, 10), -1)

  const selectDay = (d: string) => {
    setDay(d)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <main className="shell">
      <header className="app-head">
        <div>
          <h1>Wind Forecast Monitor</h1>
          <p className="muted">
            GB national wind · day-ahead purchasing, January 2026 · {meta.data.forecast_publishes} forecast runs, data to{' '}
            {publishLabel(meta.data.latest_publish)} (Elexon BMRS)
          </p>
        </div>
        <label className="field">
          <span>Decision cutoff (D-1, UK)</span>
          <select value={gateClosure} onChange={(e) => setGateClosure(e.target.value)}>
            {GATE_CLOSURES.map((g) => (
              <option key={g} value={g}>
                {g}
                {g === GATE_CLOSURE ? ' · auction gate closure' : ''}
              </option>
            ))}
          </select>
        </label>
      </header>

      <details className="howto">
        <summary>How to read this page</summary>
        <ul>
          <li>
            <strong>Forecast at cutoff:</strong> the day-ahead auction closes at 11:00 UK the day before delivery. We
            show the latest national wind forecast published before then, which is what the desk would have bought
            against. Change the cutoff (top right) to see whether an earlier or later decision would have helped.
          </li>
          <li>
            <strong>Likely range (P10–P90):</strong> based on past misses, actual wind landed inside this band in about
            8 of 10 hours. Its lower edge is the wind you can count on about 9 times out of 10. Checked on January: 78% of hours fell inside the band and 11% below it.
          </li>
          <li>
            <strong>Miss / error:</strong> actual minus forecast. Negative means less wind than forecast, a shortfall
            that would have to be bought late, usually at a higher price.
          </li>
          <li>
            <strong>Data:</strong> Elexon BMRS national wind outturn (FUELHH) and forecasts (WINDFOR) for delivery 2 Jan
            – 1 Feb 2026, compared hourly.
          </li>
        </ul>
      </details>

      <DecisionView day={day} onDayChange={setDay} gateClosure={gateClosure} firstDay={firstDay} lastDay={lastDay} />
      <AccuracyView
        gateClosure={gateClosure}
        maxHorizon={meta.data.max_horizon_hours}
        selectedDay={day}
        onSelectDay={selectDay}
      />

      <footer className="muted footnote">
        Actuals: Elexon FUELHH (fuel type WIND), half-hourly. Forecasts: Elexon WINDFOR, hourly. Forecasts and actuals are
        compared on the hour. All times UK (GMT in January).
      </footer>
    </main>
  )
}
