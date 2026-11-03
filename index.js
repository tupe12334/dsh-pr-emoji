// Node half: GET /api/pr-state?refs=owner/repo#1,owner/repo#2 → { "owner/repo#1": "🟪", ... }
// Reads states through the `gh` CLI, so private repos use the user's own login.
import { execFile } from 'node:child_process'
import { marker, PR_FIELDS } from './marker.js'

export const name = 'pr-emoji'
export const inject = ['connection']

const PATH = '/api/pr-state'
const REF = /^([\w.-]+)\/([\w.-]+)#(\d+)$/
const TTL_MS = 60_000 // ponytail: per-ref cache, no invalidation; a state change shows within a minute
const MAX_REFS = 50
const cache = new Map()

function gh(query) {
  return new Promise((resolve, reject) => {
    execFile('gh', ['api', 'graphql', '-f', `query=${query}`], {
      // The launchd service PATH has no Homebrew bin.
      env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH ?? ''}` },
      timeout: 20_000,
      maxBuffer: 4 << 20,
    }, (err, stdout) => {
      // GraphQL answers partial data with exit 1 when one PR is missing; keep the rest.
      try { resolve(JSON.parse(stdout).data ?? {}) } catch { reject(err ?? new Error('gh: bad output')) }
    })
  })
}

async function states(refs) {
  const now = Date.now()
  const out = {}
  const misses = []
  for (const ref of refs) {
    const hit = cache.get(ref)
    if (hit && now - hit.at < TTL_MS) out[ref] = hit.marker
    else misses.push(ref)
  }
  if (misses.length) {
    // Refs passed REF, so owner, repo and number hold only safe characters.
    const query = `{ ${misses.map((ref, i) => {
      const [, owner, repo, num] = REF.exec(ref)
      return `p${i}: repository(owner: "${owner}", name: "${repo}") { pullRequest(number: ${num}) { ${PR_FIELDS} } }`
    }).join('\n')} }`
    const data = await gh(query)
    misses.forEach((ref, i) => {
      const pr = data[`p${i}`]?.pullRequest
      if (!pr) return
      out[ref] = marker(pr)
      cache.set(ref, { marker: out[ref], at: now })
    })
  }
  return out
}

export function apply(ctx) {
  ctx.inject(['connection'], scope => {
    scope.effect(() => scope.connection.fetch.register({
      path: PATH,
      methods: ['GET'],
      requestBody: 'buffered',
      fetch: async request => {
        const raw = new URL(request.url).searchParams.get('refs') ?? ''
        const refs = [...new Set(raw.split(',').filter(r => REF.test(r)))].slice(0, MAX_REFS)
        try {
          return Response.json(await states(refs))
        } catch (err) {
          return Response.json({ error: String(err?.message ?? err) }, { status: 502 })
        }
      },
    }), `pr-emoji: ${PATH}`)
  })
}
