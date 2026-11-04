import { describe, expect, it } from 'vitest'
import { normalizeNotificationEmails } from './notification-emails'

describe('normalizeNotificationEmails', () => {
  it('trims, and drops blanks and duplicates', () => {
    expect(normalizeNotificationEmails([' a@x.com ', '', 'a@x.com', 'b@x.com'])).toEqual([
      'a@x.com',
      'b@x.com',
    ])
  })

  it('accepts three addresses but not four', () => {
    const three = ['a@x.com', 'b@x.com', 'c@x.com']
    expect(normalizeNotificationEmails(three)).toEqual(three)
    expect(normalizeNotificationEmails([...three, 'd@x.com'])).toBeNull()
  })

  it('rejects something that is not an email', () => {
    expect(normalizeNotificationEmails(['not-an-email'])).toBeNull()
  })

  it('rejects a value that is not a list', () => {
    expect(normalizeNotificationEmails('a@x.com')).toBeNull()
  })
})
