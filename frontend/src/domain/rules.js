// Deterministic claim checks (CONTEXT.md step 3). Plain code, no AI.
// The server must run the same checks and treat its own result as authoritative;
// this copy exists so the mock API and the UI can show identical results.
//
// Each check is 'pass', 'warn' or 'fail'. A fail stops the claim and sends it back to the
// member. A warn lets it through but tells the treasurer exactly what to look at. The AI can
// misread a photo, so disagreeing with the AI is a warn, never a hard block on its own.
import { CHECKS, CATEGORIES } from '../data/schema.js'
import { RECENT_RECEIPT_DAYS } from '../config.js'
import { fmtMoney } from '../lib/format.js'

const DAY_MS = 86_400_000
const IGNORED_FOR_DUPLICATES = new Set(['rejected', 'withdrawn', 'superseded', 'validation_failed'])
const norm = (s) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

export const checkStatus = (c) => c.status ?? (c.passed ? 'pass' : 'fail')

export function runChecks({ fields, extraction, society, claims, claimId, supersedesClaimId, now = new Date() }) {
  const r = society.reimbursement
  const amount = Number(fields.amount)
  const cur = fields.currency
  const results = {}

  // 1. Amount is backed by the receipt as read. Claiming part of a receipt is fine. Claiming more
  //    than the reader saw is a warning for the treasurer, since the reader might be wrong.
  const total = extraction?.total
  if (total == null) {
    results.amount_matches = ['warn', 'Reader couldn’t find a total. Treasurer to check the amount against the receipt']
  } else if (extraction.currency && extraction.currency !== cur) {
    results.amount_matches = ['warn', `Reader saw ${extraction.currency}, claim is in ${cur}. Treasurer to check`]
  } else if (Math.abs(total - amount) < 0.005) {
    results.amount_matches = ['pass', `${fmtMoney(amount, cur)} claimed, ${fmtMoney(total, cur)} on receipt`]
  } else if (amount < total) {
    results.amount_matches = ['pass', `${fmtMoney(amount, cur)} claimed: part of the ${fmtMoney(total, cur)} receipt`]
  } else {
    results.amount_matches = ['warn', `${fmtMoney(amount, cur)} claimed but the reader saw ${fmtMoney(total, cur)}. Treasurer to check the receipt`]
  }

  // 2. Duplicate: same society, merchant, date and amount on another live claim
  const dupe = claims.find((c) => {
    if (c.id === claimId || c.id === supersedesClaimId) return false
    if (c.societyId !== society.id || IGNORED_FOR_DUPLICATES.has(c.status)) return false
    const f = c.versions[c.versions.length - 1].fields
    return norm(f.merchant) === norm(fields.merchant) && f.date === fields.date && Math.abs(f.amount - amount) < 0.005
  })
  results.not_duplicate = dupe ? ['fail', `Matches ${dupe.reference}`] : ['pass', 'No matching claim found']

  // 3. Within term budget
  const remaining = (r.termBudget ?? 0) - (r.spentThisTerm ?? 0)
  results.within_budget = [amount <= remaining ? 'pass' : 'fail', `${fmtMoney(remaining, cur)} left of ${fmtMoney(r.termBudget, cur)}`]

  // 4. Category allowed
  const allowed = (r.allowedCategories ?? []).includes(fields.category)
  results.allowed_category = [allowed ? 'pass' : 'fail', `${CATEGORIES[fields.category] ?? fields.category} is ${allowed ? '' : 'not '}allowed`]

  // 5. Recent date (not in the future, not older than the window)
  const days = Math.floor((now.getTime() - new Date(fields.date + 'T12:00:00Z').getTime()) / DAY_MS)
  if (Number.isNaN(days)) results.recent_date = ['fail', 'No valid date']
  else if (days < -1) results.recent_date = ['fail', 'Date is in the future']
  else results.recent_date = [days <= RECENT_RECEIPT_DAYS ? 'pass' : 'fail', `Receipt is ${Math.max(days, 0)} day${days === 1 ? '' : 's'} old (max ${RECENT_RECEIPT_DAYS})`]

  // 6. Per-claim limit
  results.under_limit = [amount <= (r.perClaimLimit ?? 0) ? 'pass' : 'fail', `Limit ${fmtMoney(r.perClaimLimit, cur)}`]

  // 7. Fraud signals from the reader: injection attempts and wallet addresses block; softer signals warn
  const flags = extraction?.flags ?? []
  const blocking = flags.filter((f) => (f.severity ?? 'block') === 'block')
  const soft = flags.filter((f) => f.severity === 'warn')
  if (blocking.length) results.not_flagged = ['fail', blocking.map((f) => f.message).join(' ')]
  else if (soft.length) results.not_flagged = ['warn', soft.map((f) => f.message).join(' ')]
  else results.not_flagged = ['pass', 'Nothing suspicious found on the receipt']

  const checks = CHECKS.map(({ id }) => ({ id, status: results[id][0], passed: results[id][0] !== 'fail', detail: results[id][1] }))
  return {
    passed: checks.every((c) => c.passed),
    warnings: checks.filter((c) => c.status === 'warn').length,
    ranAt: now.toISOString(),
    checks,
  }
}
