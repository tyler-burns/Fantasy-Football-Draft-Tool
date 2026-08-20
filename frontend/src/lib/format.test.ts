import { describe, expect, it } from 'vitest'
import { formatNumber, formatRank, formatSigned } from './format'

describe('formatNumber', () => {
  it('formats to the given precision', () => {
    expect(formatNumber(70.456, 1)).toBe('70.5')
  })
  it('null becomes an em dash', () => {
    expect(formatNumber(null)).toBe('—')
  })
})

describe('formatSigned', () => {
  it('prefixes positive values with +', () => {
    expect(formatSigned(18.4)).toBe('+18.4')
  })
  it('keeps the minus sign for negatives', () => {
    expect(formatSigned(-5.2)).toBe('-5.2')
  })
  it('zero has no sign', () => {
    expect(formatSigned(0)).toBe('0.0')
  })
  it('null becomes an em dash', () => {
    expect(formatSigned(null)).toBe('—')
  })
})

describe('formatRank', () => {
  it('formats an integer rank', () => {
    expect(formatRank(3)).toBe('3')
  })
  it('null becomes an em dash', () => {
    expect(formatRank(null)).toBe('—')
  })
})
