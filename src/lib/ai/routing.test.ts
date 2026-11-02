import { describe, it, expect } from 'vitest'
import { pickAgent, matchesTestPhone, type RoutableAgent } from './routing'

const agent = (over: Partial<RoutableAgent> & { id: string }): RoutableAgent => ({
  is_default: false,
  countries: [],
  is_active: true,
  auto_reply_enabled: true,
  ...over,
})

const MAIN = agent({ id: 'main', is_default: true })
const DO = agent({ id: 'do', countries: ['DO'] })
const GT = agent({ id: 'gt', countries: ['GT', 'SV'] })

describe('pickAgent', () => {
  it('routes by country to the matching agent and locks it', () => {
    expect(
      pickAgent({ agents: [MAIN, DO, GT], lockedAgentId: null, country: 'DO', isTest: false }),
    ).toEqual({ agentId: 'do', record: 'lock' })
    expect(
      pickAgent({ agents: [MAIN, DO, GT], lockedAgentId: null, country: 'sv', isTest: false }),
    ).toEqual({ agentId: 'gt', record: 'lock' })
  })

  it('falls back to the default agent for countries without an agent', () => {
    expect(
      pickAgent({ agents: [MAIN, DO], lockedAgentId: null, country: 'MX', isTest: false }),
    ).toEqual({ agentId: 'main', record: 'lock' })
    expect(
      pickAgent({ agents: [MAIN, DO], lockedAgentId: null, country: null, isTest: false }),
    ).toEqual({ agentId: 'main', record: 'lock' })
  })

  it('skips a country agent that is off and uses the default instead', () => {
    const off = agent({ id: 'do', countries: ['DO'], auto_reply_enabled: false })
    expect(
      pickAgent({ agents: [MAIN, off], lockedAgentId: null, country: 'DO', isTest: false }),
    ).toEqual({ agentId: 'main', record: 'lock' })
  })

  it('keeps a locked conversation with its owner even if the country matches another agent', () => {
    expect(
      pickAgent({ agents: [MAIN, DO], lockedAgentId: 'main', country: 'DO', isTest: false }),
    ).toEqual({ agentId: 'main', record: 'lock' })
  })

  it('stays quiet when the owning agent is off (no other agent cuts in)', () => {
    const off = agent({ id: 'do', countries: ['DO'], is_active: false })
    expect(
      pickAgent({ agents: [MAIN, off], lockedAgentId: 'do', country: 'DO', isTest: false }),
    ).toBeNull()
  })

  it('re-routes when the owning agent was deleted', () => {
    expect(
      pickAgent({ agents: [MAIN, GT], lockedAgentId: 'gone', country: 'GT', isTest: false }),
    ).toEqual({ agentId: 'gt', record: 'lock' })
  })

  it('test numbers ignore the lock and overwrite ownership', () => {
    expect(
      pickAgent({ agents: [MAIN, DO, GT], lockedAgentId: 'do', country: 'GT', isTest: true }),
    ).toEqual({ agentId: 'gt', record: 'overwrite' })
  })
})

describe('matchesTestPhone', () => {
  it('matches a locally-typed number against the WhatsApp E.164 form', () => {
    expect(matchesTestPhone('18294759418', '8294759418')).toBe(true)
    expect(matchesTestPhone('18294759418', '+1 (829) 475-9418')).toBe(true)
  })

  it('does not match different numbers or too-short input', () => {
    expect(matchesTestPhone('18294759418', '8294759419')).toBe(false)
    expect(matchesTestPhone('18294759418', '9418')).toBe(false)
  })
})
