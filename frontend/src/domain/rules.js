// Deterministic claim checks (CONTEXT.md step 3). Plain code, no AI.
// The server must run the same checks and treat its own result as authoritative;
// this copy exists so the mock API and the UI can show identical results.
import { CHECKS, CATEGORIES } from '../data/schema.js'
import { RECENT_RECEIPT_DAYS } from '../config.js'
import { fmtMoney } from '../lib/format.js'

const DAY_MS = 86_400_000
const IGNORED_FOR_DUPLICATES = new Set(['rejected', 'withdrawn', 'superseded', 'validation_failed'])
const norm = (s) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

export function runChecks({ fields, extraction, society, claims, claimId, supersedesClaimId, now = new Date() }) {
  const r = society.reimbursement
  const amount = Number(fields.amount)
  const cur = fields.currency
  const results = {}

  // 1. Amount is backed by the receipt as read by the AI. Claiming part of a receipt is allowed
  //    (e.g. removing a personal item); claiming more than the total is not.
  if (extraction?.total == null) {
    results.amount_matches = [false, 'Receipt total could not be read']
  } else if (extraction.currency && extraction.currency !== cur) {
    results.amount_matches = [false, `Receipt is in ${extraction.currency}, claim is in ${cur}`]
  } else {
    const total = extraction.total
    const claimed = `${fmtMoney(amount, cur)} claimed`
    if (Math.abs(total - amount) < 0.005) results.amount_matches = [true, `${claimed}, ${fmtMoney(total, cur)} on receipt`]
    else if (amount < total) results.amount_matches = [true, `${claimed}: part of the ${fmtMoney(total, cur)} receipt`]
    else results.amount_matches = [false, `${claimed}, more than the ${fmtMoney(total, cur)} receipt total`]
  }

  // 2. Duplicate: same society, merchant, date and amount on another live claim
  const dupe = claims.find((c) => {
    if (c.id === claimId || c.id === supersedesClaimId) return false
    if (c.societyId !== society.id || IGNORED_FOR_DUPLICATES.has(c.status)) return false
    const f = c.versions[c.versions.length - 1].fields
    return norm(f.merchant) === norm(fields.merchant) && f.date === fields.date && Math.abs(f.amount - amount) < 0.005
  })
  results.not_duplicate = dupe ? [false, `Matches ${dupe.reference}`] : [true, 'No matching claim found']

  // 3. Within term budget
  const remaining = (r.termBudget ?? 0) - (r.spentThisTerm ?? 0)
  results.within_budget = [amount <= remaining, `${fmtMoney(remaining, cur)} left of ${fmtMoney(r.termBudget, cur)}`]

  // 4. Category allowed
  const allowed = (r.allowedCategories ?? []).includes(fields.category)
  results.allowed_category = [allowed, `${CATEGORIES[fields.category] ?? fields.category} is ${allowed ? '' : 'not '}allowed`]

  // 5. Recent date (not in the future, not older than the window)
  const days = Math.floor((now.getTime() - new Date(fields.date + 'T12:00:00Z').getTime()) / DAY_MS)
  if (Number.isNaN(days)) results.recent_date = [false, 'No valid date']
  else if (days < -1) results.recent_date = [false, 'Date is in the future']
  else results.recent_date = [days <= RECENT_RECEIPT_DAYS, `Receipt is ${Math.max(days, 0)} day${days === 1 ? '' : 's'} old (max ${RECENT_RECEIPT_DAYS})`]

  // 6. Per-claim limit
  results.under_limit = [amount <= (r.perClaimLimit ?? 0), `Limit ${fmtMoney(r.perClaimLimit, cur)}`]

  // 7. Nothing flagged by the reader
  const flags = extraction?.flags ?? []
  results.not_flagged = flags.length ? [false, flags.map((f) => f.message).join('; ')] : [true, 'Nothing flagged by the reader']

  const checks = CHECKS.map(({ id }) => ({ id, passed: results[id][0], detail: results[id][1] }))
  return { passed: checks.every((c) => c.passed), ranAt: now.toISOString(), checks }
}
