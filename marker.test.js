import { test } from 'node:test'
import assert from 'node:assert/strict'
import { marker } from './marker.js'

const head = 'abc'
const pr = (o = {}) => ({
  state: 'OPEN', isDraft: false, headRefOid: head,
  comments: { totalCount: 0 }, reviews: { totalCount: 0 },
  latestReviews: { nodes: [] },
  commits: { nodes: [{ commit: { statusCheckRollup: { state: 'PENDING' } } }] },
  ...o,
})
const checks = state => ({ nodes: [{ commit: { statusCheckRollup: { state } } }] })
const review = (state, oid = head) => ({ nodes: [{ state, commit: { oid } }] })
const engaged = { reviews: { totalCount: 1 } }

test('lifecycle states', () => {
  assert.equal(marker(pr({ state: 'MERGED' })), '🟪')
  assert.equal(marker(pr({ state: 'CLOSED' })), '🟥')
  assert.equal(marker(pr({ isDraft: true })), '⬜️')
})

test('open priority ✳️ > ❎ > ✅ > ❇️ > 🟩', () => {
  assert.equal(marker(pr({ ...engaged, latestReviews: review('CHANGES_REQUESTED'), commits: checks('FAILURE') })), '✳️')
  assert.equal(marker(pr({ ...engaged, latestReviews: review('APPROVED'), commits: checks('FAILURE') })), '❎')
  assert.equal(marker(pr({ ...engaged, latestReviews: review('APPROVED'), commits: checks('SUCCESS') })), '✅')
  assert.equal(marker(pr()), '❇️')
  assert.equal(marker(pr({ comments: { totalCount: 2 } })), '🟩')
})

test('reviews on an older commit do not count', () => {
  assert.equal(marker(pr({ ...engaged, latestReviews: review('CHANGES_REQUESTED', 'old') })), '🟩')
  assert.equal(marker(pr({ ...engaged, latestReviews: review('APPROVED', 'old'), commits: checks('SUCCESS') })), '🟩')
})

test('no checks at all is not a failure', () => {
  assert.equal(marker(pr({ commits: { nodes: [{ commit: { statusCheckRollup: null } }] } })), '❇️')
})
