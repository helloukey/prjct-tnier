import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Accuracy, HorizonPoint } from '../api/client'
import { LegendItem, TooltipBox } from '../components/ui'
import { axisProps, C, gridProps, gwScale } from '../lib/chart'
import { axisGw, dayLabel, gw, pct, signedGw } from '../lib/format'

const BAR = { maxBarSize: 24, radius: [4, 4, 0, 0] as [number, number, number, number], isAnimationActive: false }

/** Error vs lead time, with the band of lead times the day-ahead decision actually uses. */
export function HorizonChart({
  curve,
  decisionWindow,
  selectedHorizon,
}: {
  curve: HorizonPoint[]
  decisionWindow: [number, number]
  selectedHorizon: number | null
}) {
  const y = gwScale(Math.max(...curve.map((p) => p.p90_abs_error_mw)))
  return (
    <>
      <div className="legend">
        <LegendItem color={C.actual} label="Typical miss (MAE)" />
        <LegendItem color={C.forecast} label="Bad-hour miss (P90 abs. error)" />
        <LegendItem color={C.latest} label="Bias (avg forecast − actual)" />
      </div>
      <div className="chart">
        <ResponsiveContainer>
          <LineChart data={curve} margin={{ top: 8, right: 16, bottom: 16, left: 0 }}>
            <CartesianGrid {...gridProps} />
            <ReferenceArea
              x1={decisionWindow[0]}
              x2={decisionWindow[1]}
              fill="var(--grid)"
              fillOpacity={0.6}
              label={{ value: 'Lead times at the decision cutoff', position: 'insideTop', fill: C.muted, fontSize: 12 }}
            />
            {selectedHorizon != null && <ReferenceLine x={selectedHorizon} stroke={C.muted} />}
            <XAxis
              dataKey="horizon_h"
              type="number"
              domain={[0, 'dataMax']}
              ticks={[0, 6, 12, 18, 24, 30, 36, 42, 48]}
              {...axisProps}
              label={{ value: 'Hours between forecast publish and delivery', position: 'insideBottom', offset: -8, fill: C.muted, fontSize: 12 }}
            />
            <YAxis {...axisProps} tickFormatter={axisGw} width={40} ticks={y.ticks} domain={y.domain} />
            <Tooltip
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as HorizonPoint | undefined
                if (!active || !p) return null
                return (
                  <TooltipBox
                    title={`${p.horizon_h}h ahead`}
                    rows={[
                      { label: 'Typical miss', value: gw(p.mae_mw, 2), color: C.actual },
                      { label: 'Bad-hour miss', value: gw(p.p90_abs_error_mw, 2), color: C.forecast },
                      { label: 'Bias', value: signedGw(p.bias_mw, 2), color: C.latest },
                      { label: 'Hours covered', value: pct(p.coverage_pct) },
                    ]}
                  />
                )
              }}
            />
            <Line dataKey="mae_mw" stroke={C.actual} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line dataKey="p90_abs_error_mw" stroke={C.forecast} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line dataKey="bias_mw" stroke={C.latest} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}

/** Distribution of misses as actual − forecast, so shortfalls (the costly side) sit left of zero. */
export function ErrorHistogram({ histogram }: { histogram: Accuracy['histogram'] }) {
  const rows = histogram.map((b) => ({ ...b, x: -(b.bin_start_mw + b.bin_end_mw) / 2 }))
  const lo = Math.floor(Math.min(...histogram.map((b) => -b.bin_end_mw)) / 1000) * 1000
  const hi = Math.ceil(Math.max(...histogram.map((b) => -b.bin_start_mw)) / 1000) * 1000
  const ticks = Array.from({ length: (hi - lo) / 1000 + 1 }, (_, i) => lo + i * 1000)
  return (
    <>
      <div className="legend">
        <LegendItem color="var(--diverge-neg)" label="Wind below forecast (shortfall)" />
        <LegendItem color="var(--diverge-pos)" label="Wind above forecast" />
      </div>
      <div className="chart">
        <ResponsiveContainer>
          <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 16, left: 0 }} barCategoryGap={1}>
            <CartesianGrid {...gridProps} />
            <XAxis
              dataKey="x"
              type="number"
              domain={[lo, hi]}
              ticks={ticks}
              interval={0}
              {...axisProps}
              tickFormatter={(v: number) => (v === 0 ? '0' : signedGw(v, 0).replace(' GW', ''))}
              label={{ value: 'Actual − forecast (GW)', position: 'insideBottom', offset: -8, fill: C.muted, fontSize: 12 }}
            />
            <YAxis {...axisProps} width={40} allowDecimals={false} />
            <ReferenceLine x={0} stroke={C.axis} />
            <Tooltip
              cursor={{ fill: 'var(--grid)', fillOpacity: 0.5 }}
              content={({ active, payload }) => {
                const b = payload?.[0]?.payload as (typeof rows)[number] | undefined
                if (!active || !b) return null
                return (
                  <TooltipBox
                    title={`Actual ${signedGw(-b.bin_end_mw)} to ${signedGw(-b.bin_start_mw)} vs forecast`}
                    rows={[{ label: 'Hours', value: String(b.count) }]}
                  />
                )
              }}
            />
            <Bar dataKey="count" {...BAR}>
              {rows.map((b) => (
                <Cell key={b.x} fill={b.x < 0 ? 'var(--diverge-neg)' : 'var(--diverge-pos)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}

export function HourOfDayChart({ byHour }: { byHour: Accuracy['by_hour'] }) {
  const y = gwScale(Math.max(...byHour.map((h) => h.mae_mw)))
  return (
    <div className="chart">
      <ResponsiveContainer>
        <BarChart data={byHour} margin={{ top: 8, right: 16, bottom: 16, left: 0 }}>
          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey="hour"
            {...axisProps}
            interval="preserveStartEnd"
            minTickGap={24}
            tickFormatter={(h: number) => `${String(h).padStart(2, '0')}:00`}
            label={{ value: 'Delivery hour (UK)', position: 'insideBottom', offset: -8, fill: C.muted, fontSize: 12 }}
          />
          <YAxis {...axisProps} tickFormatter={axisGw} width={40} ticks={y.ticks} domain={y.domain} />
          <Tooltip
            cursor={{ fill: 'var(--grid)', fillOpacity: 0.5 }}
            content={({ active, payload }) => {
              const h = payload?.[0]?.payload as Accuracy['by_hour'][number] | undefined
              if (!active || !h) return null
              return (
                <TooltipBox
                  title={`${String(h.hour).padStart(2, '0')}:00`}
                  rows={[
                    { label: 'Typical miss', value: gw(h.mae_mw, 2), color: C.actual },
                    { label: 'Bias', value: signedGw(h.bias_mw, 2) },
                  ]}
                />
              )
            }}
          />
          <Bar dataKey="mae_mw" fill={C.actual} {...BAR} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Daily typical miss; clicking a day opens it in the decision view. */
export function DailyErrorChart({
  byDay,
  selectedDay,
  onSelectDay,
}: {
  byDay: Accuracy['by_day']
  selectedDay: string
  onSelectDay: (day: string) => void
}) {
  const y = gwScale(Math.max(...byDay.map((d) => d.mae_mw)))
  return (
    <div className="chart">
      <ResponsiveContainer>
        <BarChart
          data={byDay}
          margin={{ top: 8, right: 16, bottom: 16, left: 0 }}
          onClick={(s) => {
            const i = Number(s?.activeIndex)
            if (Number.isInteger(i) && byDay[i]) onSelectDay(byDay[i].day)
          }}
          style={{ cursor: 'pointer' }}
        >
          <CartesianGrid {...gridProps} />
          <XAxis dataKey="day" {...axisProps} tickFormatter={(d: string) => String(Number(d.slice(8)))} interval="preserveStartEnd" minTickGap={12} />
          <YAxis {...axisProps} tickFormatter={axisGw} width={40} ticks={y.ticks} domain={y.domain} />
          <Tooltip
            cursor={{ fill: 'var(--grid)', fillOpacity: 0.5 }}
            content={({ active, payload }) => {
              const d = payload?.[0]?.payload as Accuracy['by_day'][number] | undefined
              if (!active || !d) return null
              return (
                <TooltipBox
                  title={`${dayLabel(d.day)} · click to inspect`}
                  rows={[
                    { label: 'Typical miss', value: gw(d.mae_mw, 2), color: C.actual },
                    { label: 'Bias', value: signedGw(d.bias_mw, 2) },
                    { label: 'Avg actual wind', value: gw(d.mean_actual_mw) },
                  ]}
                />
              )
            }}
          />
          <Bar dataKey="mae_mw" {...BAR}>
            {byDay.map((d) => (
              <Cell key={d.day} fill={d.day === selectedDay ? C.actual : 'var(--series-1-soft)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ForecastVsActualScatter({ points }: { points: Accuracy['points'] }) {
  const { ticks, domain } = gwScale(Math.max(...points.flatMap((p) => [p.forecast_mw, p.actual_mw]), 0))
  const top = domain[1]
  return (
    <div className="chart">
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 8, right: 16, bottom: 16, left: 0 }}>
          <CartesianGrid {...gridProps} vertical />
          <XAxis
            dataKey="forecast_mw"
            type="number"
            domain={domain}
            ticks={ticks}
            {...axisProps}
            tickFormatter={axisGw}
            label={{ value: 'Forecast (GW)', position: 'insideBottom', offset: -8, fill: C.muted, fontSize: 12 }}
          />
          <YAxis dataKey="actual_mw" type="number" domain={domain} ticks={ticks} {...axisProps} tickFormatter={axisGw} width={40} />
          <ReferenceLine
            segment={[
              { x: 0, y: 0 },
              { x: top, y: top },
            ]}
            stroke={C.muted}
            label={{ value: 'perfect forecast', position: 'insideTopRight', fill: C.muted, fontSize: 12 }}
          />
          <Tooltip
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as Accuracy['points'][number] | undefined
              if (!active || !p) return null
              return (
                <TooltipBox
                  title={`${dayLabel(p.start_time)} ${p.start_time.slice(11, 16)}`}
                  rows={[
                    { label: 'Forecast', value: gw(p.forecast_mw, 2) },
                    { label: 'Actual', value: gw(p.actual_mw, 2) },
                  ]}
                />
              )
            }}
          />
          <Scatter data={points} fill={C.actual} fillOpacity={0.45} shape="circle" isAnimationActive={false} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
