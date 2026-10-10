// Match a verified user's committee-access request against the Union's committee records.
// A name match alone is not proof of identity: it is combined with verified university email,
// and anything short of an exact, unclaimed match goes to manual review — never auto-granted.

export function normaliseName(s = '') {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return dp[a.length][b.length]
}

/**
 * @returns {{ outcome: 'matched'|'manual_review'|'denied', record: object|null, reason: string }}
 */
export function matchCommitteeRecord({ records, societyId, role, submittedName, claimedRecordIds = [], today = new Date() }) {
  const day = today.toISOString().slice(0, 10)
  const candidates = records.filter(
    (r) => r.societyId === societyId && r.role === role && r.termStart <= day && r.termEnd >= day,
  )
  if (!candidates.length) return { outcome: 'denied', record: null, reason: 'No current committee record for that role.' }

  const name = normaliseName(submittedName)
  const exact = candidates.find((r) => normaliseName(r.fullName) === name)
  if (exact) {
    if (claimedRecordIds.includes(exact.id))
      return { outcome: 'manual_review', record: exact, reason: 'This committee record is already linked to another account.' }
    return { outcome: 'matched', record: exact, reason: 'Name, society and role match the Union record.' }
  }

  const [first = '', ...rest] = name.split(' ')
  const last = rest.at(-1) ?? ''
  const near = candidates.find((r) => {
    const n = normaliseName(r.fullName)
    const [rf = '', ...rr] = n.split(' ')
    const rl = rr.at(-1) ?? ''
    return levenshtein(n, name) <= 3 || (rl && rl === last && rf[0] === first[0])
  })
  if (near) return { outcome: 'manual_review', record: near, reason: 'Close but not exact match — needs confirmation by the Union.' }

  return { outcome: 'denied', record: null, reason: 'No committee record matches that name for this role.' }
}
