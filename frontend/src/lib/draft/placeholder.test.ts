import { describe, expect, it } from 'vitest'
import { makePlaceholderPickId, parsePlaceholderPickId } from './placeholder'

describe('makePlaceholderPickId / parsePlaceholderPickId', () => {
  it('round-trips both positions', () => {
    expect(parsePlaceholderPickId(makePlaceholderPickId('K', 0))).toBe('K')
    expect(parsePlaceholderPickId(makePlaceholderPickId('DST', 143))).toBe('DST')
  })

  it('is unique per pick index, so two K picks never collide', () => {
    const a = makePlaceholderPickId('K', 5)
    const b = makePlaceholderPickId('K', 40)
    expect(a).not.toBe(b)
  })

  it('a real player_id (or any other string) is not a placeholder', () => {
    expect(parsePlaceholderPickId('4046')).toBeNull()
    expect(parsePlaceholderPickId('placeholder:QB:0')).toBeNull()
    expect(parsePlaceholderPickId('')).toBeNull()
  })
})
