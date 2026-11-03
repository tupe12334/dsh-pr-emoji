// Map one GitHub PR (GraphQL shape below) to its state marker.
// Order for open PRs: ✳️ changes requested, ❎ failing check, ✅ approved + green,
// ❇️ nobody engaged, 🟩 anything else.
export const MARKERS = ['🟪', '🟥', '⬜️', '✳️', '❎', '✅', '❇️', '🟩']

export const PR_FIELDS = `state isDraft headRefOid
  comments { totalCount } reviews { totalCount }
  latestReviews(first: 50) { nodes { state commit { oid } } }
  commits(last: 1) { nodes { commit { statusCheckRollup { state } } } }`

export function marker(pr) {
  if (pr.state === 'MERGED') return '🟪'
  if (pr.state === 'CLOSED') return '🟥'
  if (pr.isDraft) return '⬜️'
  // Only reviews on the current head count: a later commit answers old ones.
  const onHead = pr.latestReviews.nodes.filter(r => r.commit?.oid === pr.headRefOid)
  if (onHead.some(r => r.state === 'CHANGES_REQUESTED')) return '✳️'
  const checks = pr.commits.nodes[0]?.commit.statusCheckRollup?.state
  if (checks === 'FAILURE' || checks === 'ERROR') return '❎'
  if (checks === 'SUCCESS' && onHead.some(r => r.state === 'APPROVED')) return '✅'
  if (pr.reviews.totalCount === 0 && pr.comments.totalCount === 0) return '❇️'
  return '🟩'
}
