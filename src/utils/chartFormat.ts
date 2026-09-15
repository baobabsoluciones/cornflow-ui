/**
 * Shared pure formatting helpers for the dashboard stock charts. Extracted from
 * StockDailyChart.vue / StockLineChart.vue so the (previously duplicated)
 * date/number formatters live in one tested place.
 */

/** Compact number: 1.2M / 34K / 567. */
export function fmtK(n: number): string {
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (Math.abs(n) >= 1e3) return `${Math.round(n / 1e3)}K`
  return Math.round(n).toString()
}

/** Short day/month label, e.g. "05/03". */
export function formatDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Long label with weekday and year, e.g. "Mié 05/03/2026". */
export function formatDateLong(d: Date): string {
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  return `${days[d.getDay()]} ${formatDate(d)}/${d.getFullYear()}`
}

/** Stable per-day key (year-month-date) for grouping movements. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}
