const EM_DASH = '—'

export function formatNumber(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return EM_DASH
  return value.toFixed(digits)
}

export function formatSigned(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return EM_DASH
  const formatted = Math.abs(value).toFixed(digits)
  if (value > 0) return `+${formatted}`
  if (value < 0) return `-${formatted}`
  return formatted
}

export function formatRank(rank: number | null): string {
  if (rank === null) return EM_DASH
  return String(rank)
}

export function formatDash(): string {
  return EM_DASH
}
