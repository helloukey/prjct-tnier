// All times in scope are January (GMT), so UTC is UK local time; format in UTC to be explicit.

export const gw = (mw: number, digits = 1) => `${(mw / 1000).toFixed(digits)} GW`

export const signedGw = (mw: number, digits = 1) => `${mw > 0 ? '+' : mw < 0 ? '−' : ''}${gw(Math.abs(mw), digits)}`

export const axisGw = (mw: number) => `${+(mw / 1000).toFixed(1)}`

export const pct = (v: number, digits = 0) => `${v.toFixed(digits)}%`

export const hhmm = (iso: string) => iso.slice(11, 16)

const dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
export const dayLabel = (isoDay: string) => dayFmt.format(new Date(`${isoDay.slice(0, 10)}T00:00:00Z`))

const publishFmt = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
})
export const publishLabel = (iso: string) => publishFmt.format(new Date(iso))

export const addDays = (isoDay: string, n: number) => {
  const d = new Date(`${isoDay}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export const GATE_CLOSURE = '11:00'

/** "11:00 gate closure" for the real auction deadline, "09:00 cutoff" for what-if cutoffs. */
export const cutoffLabel = (hhmmStr: string) => (hhmmStr === GATE_CLOSURE ? `${hhmmStr} gate closure` : `${hhmmStr} cutoff`)
