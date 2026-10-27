// Chart tokens. Values resolve from CSS custom properties so light/dark mode swaps in one place (index.css).
export const C = {
  actual: 'var(--series-1)',
  forecast: 'var(--series-2)',
  latest: 'var(--series-3)',
  grid: 'var(--grid)',
  axis: 'var(--axis)',
  muted: 'var(--text-muted)',
  surface: 'var(--surface-1)',
}

export const axisProps = {
  stroke: C.axis,
  tick: { fill: C.muted, fontSize: 12 },
  tickLine: false,
} as const

export const gridProps = { stroke: C.grid, vertical: false } as const

/** Clean GW ticks (0, 2, 4 ... GW) for an MW-valued axis; returns ticks in MW plus the matching domain. */
export function gwScale(maxMw: number, targetTicks = 5) {
  const steps = [0.5, 1, 2, 2.5, 5, 10]
  const stepGw = steps.find((st) => (maxMw / 1000) / st <= targetTicks) ?? 10
  const top = Math.max(Math.ceil(maxMw / 1000 / stepGw), 1) * stepGw
  const ticks = Array.from({ length: Math.round(top / stepGw) + 1 }, (_, i) => i * stepGw * 1000)
  return { ticks, domain: [0, top * 1000] as [number, number] }
}
