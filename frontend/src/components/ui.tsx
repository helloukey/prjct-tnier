import type { ReactNode } from 'react'

export function Card({
  title,
  subtitle,
  actions,
  children,
  dim = false,
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  dim?: boolean
}) {
  return (
    <section className={`card${dim ? ' dim' : ''}`}>
      <header className="card-head">
        <div>
          <h3>{title}</h3>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        {actions}
      </header>
      {children}
    </section>
  )
}

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: ReactNode }) {
  return (
    <div className="tile">
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
      {hint && <div className="tile-hint">{hint}</div>}
    </div>
  )
}

export function LegendItem({ color, label, band = false }: { color: string; label: string; band?: boolean }) {
  return (
    <span className="legend-item">
      <span className={band ? 'swatch-band' : 'swatch-line'} style={{ background: color }} />
      {label}
    </span>
  )
}

/** Shared tooltip shell: a title row, then label/value rows with a colored key mark. */
export function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="tooltip">
      <div className="tooltip-title">{title}</div>
      {rows.map((r) => (
        <div className="tooltip-row" key={r.label}>
          <span>
            {r.color && <span className="swatch-dot" style={{ background: r.color }} />}
            {r.label}
          </span>
          <strong>{r.value}</strong>
        </div>
      ))}
    </div>
  )
}

export function Toggle<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'active' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
