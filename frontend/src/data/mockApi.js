// In-browser implementation of the API contract (HANDOVER.md §4), persisted to localStorage.
// It enforces the same rules the backend must enforce, so the demo behaves like production.
import societiesSeed from './mock/societies.json'
import committeeSeed from './mock/committeeRecords.json'
import usersSeed from './mock/users.json'
import membershipsSeed from './mock/memberships.json'
import claimsSeed from './mock/claims.json'
import paymentsSeed from './mock/payments.json'
import auditSeed from './mock/auditLog.json'
import receiptsSeed from './mock/receipts.json'
import { ApiError } from './errors.js'
import { ROLE_PERMISSIONS, COMMITTEE_ROLES } from './schema.js'
import { runChecks } from '../domain/rules.js'
import { readReceipt } from '../domain/reader/index.js'
import { matchCommitteeRecord } from '../domain/committeeMatch.js'
import { round2, toUsdc, isEvmAddress } from '../lib/format.js'
import { FX_TO_USDC, UNI_EMAIL_SUFFIX } from '../config.js'

// Bump the version whenever the seed data changes, so browsers drop their old copy.
const DB_KEY = 'socfi.db.v2'
const SESSION_KEY = 'socfi.session.v1'
const DEFAULT_USER = 'usr_amara'
const DEMO_CODE = '482913'

const seed = () =>
  structuredClone({
    societies: societiesSeed,
    committeeRecords: committeeSeed,
    users: usersSeed,
    memberships: membershipsSeed,
    roleClaims: [],
    claims: claimsSeed,
    payments: paymentsSeed,
    auditLog: auditSeed,
    receipts: receiptsSeed,
  })

function load() {
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return seed()
}

let db = load()
let sessionUserId = (() => {
  try {
    const v = localStorage.getItem(SESSION_KEY)
    return v === null ? DEFAULT_USER : v || null
  } catch {
    return DEFAULT_USER
  }
})()

const listeners = new Set()
function commit() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db))
    localStorage.setItem(SESSION_KEY, sessionUserId ?? '')
  } catch (e) {
    // Usually quota: too many receipt photos. The data stays in memory until reload.
    console.warn('Demo data not saved to localStorage', e)
  }
  listeners.forEach((fn) => fn())
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const now = () => new Date().toISOString()
const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 8)}`
const out = (x) => structuredClone(x)

function audit(action, entity, societyId, details = {}, actorId = sessionUserId) {
  db.auditLog.unshift({ id: uid('aud'), at: now(), actorId, action, entity, societyId, details })
}

// ---------- guards ----------
const me = () => db.users.find((u) => u.id === sessionUserId) ?? null
function requireUser() {
  const u = me()
  if (!u) throw new ApiError('auth/required', 'Please sign in.')
  return u
}
function requireVerified() {
  const u = requireUser()
  if (!u.emailVerified) throw new ApiError('auth/unverified', 'Verify your university email first.')
  return u
}
const membership = (userId, societyId) => db.memberships.find((m) => m.userId === userId && m.societyId === societyId)
function requirePerm(societyId, perm) {
  const u = requireVerified()
  const m = membership(u.id, societyId)
  if (!m || m.status !== 'active' || !m.permissions.includes(perm))
    throw new ApiError('permission-denied', 'Your role does not allow this action.')
  return u
}
const society = (id) => {
  const s = db.societies.find((x) => x.id === id)
  if (!s) throw new ApiError('not-found', 'Society not found.')
  return s
}
const claimById = (id) => {
  const c = db.claims.find((x) => x.id === id)
  if (!c) throw new ApiError('not-found', 'Claim not found.')
  return c
}
const paymentById = (id) => {
  const p = db.payments.find((x) => x.id === id)
  if (!p) throw new ApiError('not-found', 'Payment not found.')
  return p
}

// ---------- view builders ----------
const userCard = (id) => {
  const u = db.users.find((x) => x.id === id)
  return u ? { id: u.id, displayName: u.displayName, email: u.email, walletAddress: u.walletAddress } : null
}
const societyCard = (id) => {
  const s = db.societies.find((x) => x.id === id)
  return s ? { id: s.id, name: s.name, reimbursement: s.reimbursement } : null
}
function claimView(c) {
  const latest = c.versions[c.versions.length - 1]
  return {
    ...out(c),
    latest: out(latest),
    latestReview: out(c.reviews[c.reviews.length - 1] ?? null),
    society: out(societyCard(c.societyId)),
    claimant: userCard(c.claimantId),
    payment: c.paymentId ? out(db.payments.find((p) => p.id === c.paymentId)) : null,
  }
}

function setStatus(claim, status) {
  claim.status = status
  claim.updatedAt = now()
}

// ---------- API ----------
export const mockApi = {
  onChange(fn) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },

  // ----- session & onboarding -----
  async getSession() {
    const u = me()
    if (!u) return { user: null, memberships: [] }
    const memberships = db.memberships
      .filter((m) => m.userId === u.id)
      .map((m) => ({ ...out(m), society: out(societyCard(m.societyId)) }))
    return { user: out(u), memberships }
  },

  async signUp({ displayName, email, walletAddress }) {
    const name = displayName?.trim()
    const mail = email?.trim().toLowerCase()
    if (!name) throw new ApiError('invalid-argument', 'Enter your full name as it appears in Union records.')
    if (!mail?.endsWith(UNI_EMAIL_SUFFIX))
      throw new ApiError('invalid-argument', `Use your university email (${UNI_EMAIL_SUFFIX}).`)
    if (walletAddress && !isEvmAddress(walletAddress))
      throw new ApiError('invalid-argument', 'Wallet address must be a 0x… address with 40 hex characters.')
    if (db.users.some((u) => u.email === mail)) throw new ApiError('already-exists', 'An account with that email already exists.')
    const user = {
      id: uid('usr'),
      displayName: name,
      email: mail,
      emailVerified: false,
      walletAddress: walletAddress || null,
      createdAt: now(),
    }
    db.users.push(user)
    sessionUserId = user.id
    audit('user.signed_up', { type: 'user', id: user.id }, null)
    commit()
    await wait(300)
    return { user: out(user), demoCode: DEMO_CODE }
  },

  async verifyEmail({ code }) {
    const u = requireUser()
    await wait(400)
    if (code !== DEMO_CODE) throw new ApiError('invalid-argument', 'That code is not right. Check the email and try again.')
    u.emailVerified = true
    audit('user.email_verified', { type: 'user', id: u.id }, null)
    commit()
    return out(u)
  },

  async resendVerification() {
    requireUser()
    await wait(300)
    return { demoCode: DEMO_CODE }
  },

  async signOut() {
    sessionUserId = null
    commit()
  },

  async updateProfile({ walletAddress, displayName }) {
    const u = requireVerified()
    if (walletAddress !== undefined) {
      if (walletAddress && !isEvmAddress(walletAddress))
        throw new ApiError('invalid-argument', 'Wallet address must be a 0x… address with 40 hex characters.')
      const busy = db.claims.some(
        (c) => c.claimantId === u.id && ['approved', 'awaiting_ledger', 'payment_pending', 'needs_reconciliation'].includes(c.status),
      )
      if (busy) throw new ApiError('failed-precondition', 'You have an approved claim being paid. Change your wallet after it settles.')
      u.walletAddress = walletAddress || null
      audit('user.wallet_changed', { type: 'user', id: u.id }, null)
    }
    if (displayName !== undefined) u.displayName = displayName.trim()
    commit()
    return out(u)
  },

  // ----- societies & membership -----
  async listSocieties() {
    return out(db.societies.map(({ inviteCode, ...s }) => s))
  },

  async getSociety(id) {
    const { inviteCode, ...s } = society(id)
    return out(s)
  },

  async requestMembership(societyId) {
    const u = requireVerified()
    const s = society(societyId)
    if (s.unionStatus !== 'active') throw new ApiError('failed-precondition', 'This society is not currently active.')
    if (membership(u.id, societyId)) throw new ApiError('already-exists', 'You already have a membership or request here.')
    db.memberships.push({
      id: `${societyId}__${u.id}`,
      societyId,
      userId: u.id,
      role: 'member',
      status: 'pending',
      joinedVia: 'request',
      permissions: [],
      committeeRecordId: null,
      createdAt: now(),
    })
    audit('membership.requested', { type: 'society', id: societyId }, societyId)
    commit()
  },

  async joinWithInvite(code) {
    const u = requireVerified()
    const s = db.societies.find((x) => x.inviteCode.toLowerCase() === code.trim().toLowerCase())
    if (!s) throw new ApiError('not-found', 'That invite code is not valid.')
    const existing = membership(u.id, s.id)
    if (existing?.status === 'active') throw new ApiError('already-exists', `You are already a member of ${s.name}.`)
    if (existing) Object.assign(existing, { status: 'active', joinedVia: 'invite', permissions: ROLE_PERMISSIONS.member })
    else
      db.memberships.push({
        id: `${s.id}__${u.id}`,
        societyId: s.id,
        userId: u.id,
        role: 'member',
        status: 'active',
        joinedVia: 'invite',
        permissions: ROLE_PERMISSIONS.member,
        committeeRecordId: null,
        createdAt: now(),
      })
    audit('membership.joined_by_invite', { type: 'society', id: s.id }, s.id)
    commit()
    return { societyId: s.id, name: s.name }
  },

  async listMembershipRequests(societyId) {
    requirePerm(societyId, 'members.manage')
    return db.memberships
      .filter((m) => m.societyId === societyId && m.status === 'pending')
      .map((m) => ({ ...out(m), user: userCard(m.userId) }))
  },

  async decideMembership(membershipId, approve) {
    const m = db.memberships.find((x) => x.id === membershipId)
    if (!m) throw new ApiError('not-found', 'Request not found.')
    requirePerm(m.societyId, 'members.manage')
    if (approve) Object.assign(m, { status: 'active', permissions: ROLE_PERMISSIONS.member })
    else db.memberships = db.memberships.filter((x) => x !== m)
    audit(approve ? 'membership.approved' : 'membership.declined', { type: 'membership', id: m.id }, m.societyId)
    commit()
  },

  // Roles that exist in the Union's committee records for this society, from the fixed allowlist.
  async listCommitteeRoles(societyId) {
    const roles = new Set(db.committeeRecords.filter((r) => r.societyId === societyId).map((r) => r.role))
    return COMMITTEE_ROLES.filter((r) => roles.has(r))
  },

  async requestCommitteeAccess({ societyId, role, submittedName }) {
    const u = requireVerified()
    if (!COMMITTEE_ROLES.includes(role)) throw new ApiError('invalid-argument', 'Choose a role from the list.')
    society(societyId)
    await wait(700)
    const claimedRecordIds = db.memberships.filter((m) => m.committeeRecordId && m.userId !== u.id).map((m) => m.committeeRecordId)
    const result = matchCommitteeRecord({ records: db.committeeRecords, societyId, role, submittedName, claimedRecordIds })
    const roleClaim = {
      id: uid('rc'),
      userId: u.id,
      societyId,
      requestedRole: role,
      submittedName,
      outcome: result.outcome,
      reason: result.reason,
      committeeRecordId: result.record?.id ?? null,
      createdAt: now(),
    }
    db.roleClaims.push(roleClaim)

    let granted = []
    if (result.outcome === 'matched') {
      granted = ROLE_PERMISSIONS[role]
      const m = membership(u.id, societyId)
      const patch = { role, status: 'active', permissions: granted, committeeRecordId: result.record.id, joinedVia: 'committee_match' }
      if (m) Object.assign(m, patch)
      else db.memberships.push({ id: `${societyId}__${u.id}`, societyId, userId: u.id, createdAt: now(), ...patch })
      if (role === 'treasurer') society(societyId).reimbursement.setup.committeeVerified = true
    }
    audit(`committee.${result.outcome}`, { type: 'society', id: societyId }, societyId, {
      role,
      submittedName,
      committeeRecordId: roleClaim.committeeRecordId,
      permissionsGranted: granted,
    })
    commit()
    return { ...out(roleClaim), permissionsGranted: granted }
  },

  // ----- reimbursement setup -----
  async updateReimbursementSetup(societyId, { treasuryWallet, perClaimLimit, termBudget, allowedCategories }) {
    requirePerm(societyId, 'society.configure_reimbursement')
    const r = society(societyId).reimbursement
    if (treasuryWallet !== undefined) {
      if (!isEvmAddress(treasuryWallet)) throw new ApiError('invalid-argument', 'Treasury wallet must be a valid 0x… address.')
      r.treasuryWallet = treasuryWallet
      r.setup.treasuryWalletSet = true
    }
    if (perClaimLimit !== undefined || termBudget !== undefined || allowedCategories !== undefined) {
      const limit = Number(perClaimLimit ?? r.perClaimLimit)
      const budget = Number(termBudget ?? r.termBudget)
      const cats = allowedCategories ?? r.allowedCategories
      if (!(limit > 0) || !(budget > 0) || !cats.length)
        throw new ApiError('invalid-argument', 'Set a per-claim limit, a term budget and at least one category.')
      Object.assign(r, { perClaimLimit: limit, termBudget: budget, allowedCategories: cats })
      r.setup.policySet = true
    }
    // Any change after the Union looked at it needs a fresh approval.
    if (r.status !== 'enabled') r.setup.unionApproval = 'not_requested'
    audit('society.setup_updated', { type: 'society', id: societyId }, societyId)
    commit()
    return out(r)
  },

  // Real build: backend asks the treasurer's Ledger for a genuine check + address (wallet-cli genuine-check).
  async pairLedger(societyId) {
    requirePerm(societyId, 'society.configure_reimbursement')
    await wait(1600)
    const r = society(societyId).reimbursement
    r.ledgerDevice = { model: 'Ledger Flex', genuineCheckAt: now() }
    r.setup.ledgerPaired = true
    audit('society.ledger_paired', { type: 'society', id: societyId }, societyId, { model: 'Ledger Flex' })
    commit()
    return out(r)
  },

  async requestUnionApproval(societyId) {
    requirePerm(societyId, 'society.configure_reimbursement')
    const r = society(societyId).reimbursement
    const s = r.setup
    if (!s.committeeVerified || !s.treasuryWalletSet || !s.ledgerPaired || !s.policySet)
      throw new ApiError('failed-precondition', 'Finish the other setup steps first.')
    s.unionApproval = 'requested'
    audit('society.union_approval_requested', { type: 'society', id: societyId }, societyId)
    commit()
  },

  // Demo only: stands in for the Union finance office acting in their own tool.
  async demoUnionApprove(societyId) {
    society(societyId).reimbursement.setup.unionApproval = 'approved'
    audit('society.union_approved', { type: 'society', id: societyId }, societyId, {}, 'union_finance')
    commit()
  },

  async enableReimbursement(societyId) {
    const u = requirePerm(societyId, 'society.configure_reimbursement')
    const r = society(societyId).reimbursement
    const s = r.setup
    if (!(s.committeeVerified && s.treasuryWalletSet && s.ledgerPaired && s.policySet && s.unionApproval === 'approved'))
      throw new ApiError('failed-precondition', 'All setup checks must pass before reimbursement can be enabled.')
    Object.assign(r, { status: 'enabled', enabledAt: now(), enabledBy: u.id })
    audit('society.reimbursement_enabled', { type: 'society', id: societyId }, societyId)
    commit()
    return out(r)
  },

  // ----- receipts & AI -----
  async listSampleReceipts() {
    return out(db.receipts.filter((r) => r.sample))
  },

  async getReceipt(sampleId) {
    return out(db.receipts.find((r) => r.id === sampleId) ?? null)
  },

  // Demo: the reader runs in this browser (free OCR, or Claude with the user's own key).
  // Production: the backend runs it, so the AI key never reaches a client.
  async extractReceipt(receipt, { onProgress } = {}) {
    requireVerified()
    if (receipt?.kind === 'sample') await wait(1600) // sample reads are instant; pause so the demo shows the step
    return readReceipt(receipt, { samples: db.receipts, onProgress })
  },

  // ----- claims -----
  async listMyClaims() {
    const u = requireUser()
    return db.claims
      .filter((c) => c.claimantId === u.id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(claimView)
  },

  async listReviewClaims() {
    const u = requireVerified()
    const ids = db.memberships
      .filter((m) => m.userId === u.id && m.status === 'active' && m.permissions.includes('claims.review'))
      .map((m) => m.societyId)
    return db.claims
      .filter((c) => ids.includes(c.societyId))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(claimView)
  },

  async getClaim(id) {
    const u = requireVerified()
    const c = claimById(id)
    const m = membership(u.id, c.societyId)
    const canSee = c.claimantId === u.id || (m?.status === 'active' && m.permissions.includes('claims.view_society'))
    if (!canSee) throw new ApiError('permission-denied', 'You cannot view this claim.')
    return claimView(c)
  },

  /**
   * Create a claim, or a new version of one. The member has confirmed every field.
   * Server re-reads the receipt if no extraction is supplied, then runs the 7 checks.
   */
  async submitClaim({ claimId, societyId, fields, receipt, entryMode, aiExtraction, supersedesClaimId }) {
    const u = requirePerm(societyId, 'claims.create')
    if (!u.walletAddress) throw new ApiError('failed-precondition', 'Add a payout wallet to your account before claiming.')
    const s = society(societyId)
    if (s.reimbursement.status !== 'enabled') throw new ApiError('failed-precondition', `${s.name} has not enabled reimbursement.`)
    if (!receipt) throw new ApiError('invalid-argument', 'Attach a receipt.')
    const clean = {
      merchant: String(fields.merchant ?? '').trim(),
      date: fields.date,
      amount: round2(fields.amount),
      currency: fields.currency,
      category: fields.category,
      description: String(fields.description ?? '').trim(),
    }
    if (!clean.merchant || !clean.date || !(clean.amount > 0) || !clean.category || !clean.description)
      throw new ApiError('invalid-argument', 'Fill in every field.')

    let claim = claimId ? claimById(claimId) : null
    if (claim) {
      if (claim.claimantId !== u.id) throw new ApiError('permission-denied', 'Not your claim.')
      const review = claim.reviews.at(-1)
      const editable =
        claim.status === 'validation_failed' ||
        (claim.status === 'returned' && review?.resolution === 'edit_existing' && review.version === claim.currentVersion)
      if (!editable) throw new ApiError('failed-precondition', 'This claim can no longer be edited.')
    }

    const extraction = aiExtraction ?? (await mockApi.extractReceipt(receipt))
    await wait(500)
    const validation = runChecks({
      fields: clean,
      extraction,
      society: s,
      claims: db.claims,
      claimId: claim?.id,
      supersedesClaimId,
    })
    const ts = now()

    if (!claim) {
      const n = db.claims.length + 1
      claim = {
        id: uid('clm'),
        reference: `CLM-${String(n).padStart(4, '0')}`,
        societyId,
        claimantId: u.id,
        status: 'validation_failed',
        currentVersion: 0,
        approvedVersion: null,
        paymentId: null,
        supersedesClaimId: supersedesClaimId ?? null,
        createdAt: ts,
        updatedAt: ts,
        versions: [],
        reviews: [],
      }
      db.claims.push(claim)
    }

    const version = {
      version: claim.currentVersion + 1,
      entryMode,
      fields: clean,
      receipt,
      aiExtraction: extraction,
      memberConfirmedAt: ts,
      submittedAt: ts,
      validation,
    }
    // A version that failed validation was never reviewed, so it is replaced rather than kept.
    if (claim.status === 'validation_failed' && claim.versions.length) {
      version.version = claim.currentVersion
      claim.versions[claim.versions.length - 1] = version
    } else {
      claim.versions.push(version)
    }
    claim.currentVersion = version.version
    setStatus(claim, validation.passed ? 'pending_review' : 'validation_failed')

    if (validation.passed && supersedesClaimId) {
      const old = db.claims.find((c) => c.id === supersedesClaimId && c.claimantId === u.id)
      if (old && old.status === 'returned') setStatus(old, 'superseded')
    }
    audit('claim.submitted', { type: 'claim', id: claim.id }, societyId, { version: version.version, checksPassed: validation.passed })
    commit()
    return claimView(claim)
  },

  async withdrawClaim(id) {
    const u = requireVerified()
    const c = claimById(id)
    if (c.claimantId !== u.id) throw new ApiError('permission-denied', 'Not your claim.')
    if (!['validation_failed', 'pending_review', 'returned'].includes(c.status))
      throw new ApiError('failed-precondition', 'This claim can no longer be withdrawn.')
    setStatus(c, 'withdrawn')
    audit('claim.withdrawn', { type: 'claim', id }, c.societyId)
    commit()
  },

  /**
   * decision: 'approve' | 'return' | 'reject'. `version` binds the decision to what the treasurer saw.
   * Approval creates a payment from the trusted claim record and member's saved wallet only.
   */
  async reviewClaim(id, { decision, reason = '', resolution = null, version }) {
    const c = claimById(id)
    const u = requirePerm(c.societyId, 'claims.review')
    if (c.claimantId === u.id) throw new ApiError('permission-denied', 'You cannot review your own claim.')
    if (c.status !== 'pending_review') throw new ApiError('failed-precondition', 'This claim is not waiting for review.')
    if (version !== c.currentVersion) throw new ApiError('aborted', 'The claim changed while you were reviewing. Reload and check again.')
    if (decision !== 'approve' && !reason.trim()) throw new ApiError('invalid-argument', 'Give the member a reason.')
    if (decision === 'return' && !['edit_existing', 'start_new'].includes(resolution))
      throw new ApiError('invalid-argument', 'Choose whether the member edits this claim or starts a new one.')
    const claimant = db.users.find((x) => x.id === c.claimantId)
    if (decision === 'approve') {
      requirePerm(c.societyId, 'claims.approve')
      if (!claimant?.walletAddress) throw new ApiError('failed-precondition', 'Claimant has no saved payout wallet.')
    }

    const review = { id: uid('rev'), version, decision, resolution: decision === 'return' ? resolution : null, reason: reason.trim(), reviewerId: u.id, at: now() }
    c.reviews.push(review)

    if (decision === 'approve') {
      const s = society(c.societyId)
      const f = c.versions.find((v) => v.version === version).fields
      const payment = {
        id: uid('pay'),
        claimId: c.id,
        claimReference: c.reference,
        claimVersion: version,
        societyId: c.societyId,
        recipientUserId: claimant.id,
        recipientAddress: claimant.walletAddress,
        sourceAddress: s.reimbursement.treasuryWallet,
        fiatAmount: f.amount,
        fiatCurrency: f.currency,
        fxRate: FX_TO_USDC[f.currency] ?? 1,
        amount: toUsdc(f.amount, f.currency),
        token: s.reimbursement.token,
        network: s.reimbursement.network,
        status: 'awaiting_device',
        attempts: 0,
        txHash: null,
        approvedBy: u.id,
        approvedAt: review.at,
        deviceConfirmedAt: null,
        confirmedAt: null,
        history: [{ status: 'awaiting_device', at: review.at }],
      }
      db.payments.push(payment)
      c.paymentId = payment.id
      c.approvedVersion = version
      setStatus(c, 'awaiting_ledger')
    } else {
      setStatus(c, decision === 'return' ? 'returned' : 'rejected')
    }
    audit(`claim.${decision === 'approve' ? 'approved' : decision === 'return' ? 'returned' : 'rejected'}`, { type: 'claim', id }, c.societyId, {
      version,
      resolution: review.resolution,
    })
    commit()
    return claimView(c)
  },

  // ----- payments (Ledger) -----
  async listPayments() {
    const u = requireVerified()
    const ids = db.memberships
      .filter((m) => m.userId === u.id && m.status === 'active' && m.permissions.includes('payments.initiate'))
      .map((m) => m.societyId)
    return db.payments
      .filter((p) => ids.includes(p.societyId))
      .sort((a, b) => b.approvedAt.localeCompare(a.approvedAt))
      .map((p) => ({ ...out(p), society: societyCard(p.societyId), recipient: userCard(p.recipientUserId) }))
  },

  async retryPayment(paymentId) {
    const p = paymentById(paymentId)
    requirePerm(p.societyId, 'payments.initiate')
    const c = claimById(p.claimId)
    if (p.status !== 'cancelled' || c.status !== 'approved') throw new ApiError('failed-precondition', 'Nothing to retry.')
    p.status = 'awaiting_device'
    p.history.push({ status: 'awaiting_device', at: now() })
    setStatus(c, 'awaiting_ledger')
    commit()
  },

  // Treasurer rejected (or the prompt timed out) on the device. Nothing was signed or broadcast.
  async cancelOnDevice(paymentId) {
    const p = paymentById(paymentId)
    requirePerm(p.societyId, 'payments.initiate')
    const c = claimById(p.claimId)
    p.status = 'cancelled'
    p.attempts += 1
    p.history.push({ status: 'cancelled', at: now() })
    setStatus(c, 'approved')
    audit('payment.device_rejected', { type: 'payment', id: p.id }, p.societyId)
    commit()
  },

  /**
   * Device signed. In production the backend gets the signature via wallet-cli / Agent Intent and
   * broadcasts; it never marks paid until on-chain confirmation.
   * demoOutcome: 'confirm' | 'uncertain' simulates the chain result.
   */
  async confirmOnDevice(paymentId, { demoOutcome = 'confirm' } = {}) {
    const p = paymentById(paymentId)
    requirePerm(p.societyId, 'payments.initiate')
    const c = claimById(p.claimId)
    if (p.status !== 'awaiting_device') throw new ApiError('failed-precondition', 'This payment is not waiting for the device.')
    if (c.approvedVersion !== p.claimVersion || c.currentVersion !== p.claimVersion)
      throw new ApiError('aborted', 'Claim changed after approval. Payment blocked.')
    const ts = now()
    p.status = 'pending'
    p.attempts += 1
    p.deviceConfirmedAt = ts
    p.txHash = '0x' + Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')
    p.history.push({ status: 'pending', at: ts })
    setStatus(c, 'payment_pending')
    audit('payment.device_confirmed', { type: 'payment', id: p.id }, p.societyId, { device: 'Ledger Flex' })
    commit()

    setTimeout(() => {
      const t = now()
      if (demoOutcome === 'uncertain') {
        p.status = 'needs_reconciliation'
        p.history.push({ status: 'needs_reconciliation', at: t })
        setStatus(c, 'needs_reconciliation')
        audit('payment.unconfirmed', { type: 'payment', id: p.id }, p.societyId, { reason: 'RPC timeout' }, 'system')
      } else {
        settle(p, c, t)
      }
      commit()
    }, 4000)
    return out(p)
  },

  // Look the tx up on-chain before any retry, so a member is never paid twice.
  async reconcilePayment(paymentId) {
    const p = paymentById(paymentId)
    requirePerm(p.societyId, 'payments.initiate')
    if (p.status !== 'needs_reconciliation') throw new ApiError('failed-precondition', 'Nothing to reconcile.')
    await wait(1400)
    const c = claimById(p.claimId)
    settle(p, c, now())
    audit('payment.reconciled', { type: 'payment', id: p.id }, p.societyId, { found: true, txHash: p.txHash })
    commit()
    return out(p)
  },

  // ----- audit -----
  async listAuditLog() {
    const u = requireVerified()
    const ids = db.memberships
      .filter((m) => m.userId === u.id && m.status === 'active' && m.permissions.includes('claims.view_society'))
      .map((m) => m.societyId)
    return db.auditLog
      .filter((a) => a.actorId === u.id || ids.includes(a.societyId))
      .slice(0, 200)
      .map((a) => ({
        ...out(a),
        actorName: a.actorId === 'system' ? 'System' : a.actorId === 'union_finance' ? 'Union finance' : userCard(a.actorId)?.displayName ?? a.actorId,
        societyName: a.societyId ? societyCard(a.societyId)?.name : null,
      }))
  },

  // ----- demo-only controls (not part of the backend contract) -----
  demo: {
    personas: [
      { id: 'usr_amara', label: 'Amara Okafor', hint: 'Member · Blockchain, Baking' },
      { id: 'usr_jonah', label: 'Jonah Whitfield', hint: 'Treasurer · Blockchain Society' },
      { id: 'usr_elena', label: 'Elena Marsh', hint: 'Treasurer · The Baking Society' },
      { id: 'usr_priya', label: 'Priya Raman', hint: 'Logistics · Blockchain Society' },
      { id: 'usr_sam', label: 'Sam Lindqvist', hint: 'Treasurer · FinTech (setup pending)' },
    ],
    switchUser(id) {
      sessionUserId = id
      commit()
    },
    reset() {
      db = seed()
      sessionUserId = DEFAULT_USER
      commit()
    },
    code: DEMO_CODE,
  },
}

// A reload can interrupt the simulated confirmation timer; treat those payments as confirmed.
for (const p of db.payments.filter((x) => x.status === 'pending')) {
  const c = db.claims.find((x) => x.id === p.claimId)
  if (c) settle(p, c, new Date().toISOString())
}

function settle(p, c, ts) {
  p.status = 'confirmed'
  p.confirmedAt = ts
  p.history.push({ status: 'confirmed', at: ts })
  setStatus(c, 'paid')
  const s = db.societies.find((x) => x.id === p.societyId)
  s.reimbursement.spentThisTerm = round2(s.reimbursement.spentThisTerm + p.fiatAmount)
  audit('payment.confirmed', { type: 'payment', id: p.id }, p.societyId, { amount: p.amount, token: p.token }, 'system')
}
