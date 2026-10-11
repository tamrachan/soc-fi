// Shared enums. Keep in sync with HANDOVER.md — the backend uses the same string values.

export const CLAIM_STATUS = {
  VALIDATION_FAILED: 'validation_failed', // automated checks failed; member can fix and resubmit
  PENDING_REVIEW: 'pending_review',
  RETURNED: 'returned', // treasurer asked for edits; see latest review.resolution
  REJECTED: 'rejected',
  APPROVED: 'approved', // approved, no live device prompt (e.g. treasurer cancelled on device)
  AWAITING_LEDGER: 'awaiting_ledger',
  PAYMENT_PENDING: 'payment_pending', // broadcast, waiting for on-chain confirmation
  PAID: 'paid',
  NEEDS_RECONCILIATION: 'needs_reconciliation',
  WITHDRAWN: 'withdrawn',
  SUPERSEDED: 'superseded', // returned with "start new claim" and a replacement was submitted
}

export const CLAIM_STATUS_META = {
  validation_failed: { label: 'Needs fixing', tone: 'rose', member: 'Some automated checks failed. Fix the fields and resubmit.' },
  pending_review: { label: 'In review', tone: 'ice', member: 'Waiting for your treasurer to review.' },
  returned: { label: 'Edits requested', tone: 'copper', member: 'Your treasurer asked for changes.' },
  rejected: { label: 'Denied', tone: 'rose', member: 'This claim will not be paid.' },
  approved: { label: 'Approved', tone: 'copper', member: 'Approved — waiting for the treasurer to sign on their Ledger.' },
  awaiting_ledger: { label: 'Awaiting Ledger', tone: 'copper', member: 'Approved — waiting for the treasurer to sign on their Ledger.' },
  payment_pending: { label: 'Payment pending', tone: 'ice', member: 'Payment sent, waiting for network confirmation.' },
  paid: { label: 'Paid', tone: 'sage', member: 'Paid to your saved wallet.' },
  needs_reconciliation: { label: 'Reconciling', tone: 'rose', member: 'Payment outcome is being checked before any retry.' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral', member: 'You withdrew this claim.' },
  superseded: { label: 'Replaced', tone: 'neutral', member: 'Replaced by a new claim.' },
}

export const PAYMENT_STATUS = {
  AWAITING_DEVICE: 'awaiting_device',
  CANCELLED: 'cancelled', // rejected/cancelled on device — nothing broadcast
  PENDING: 'pending', // signed + broadcast, not yet confirmed
  CONFIRMED: 'confirmed',
  NEEDS_RECONCILIATION: 'needs_reconciliation',
}

export const PAYMENT_STATUS_META = {
  awaiting_device: { label: 'Awaiting device', tone: 'copper' },
  cancelled: { label: 'Cancelled on device', tone: 'neutral' },
  pending: { label: 'Pending on-chain', tone: 'ice' },
  confirmed: { label: 'Confirmed', tone: 'sage' },
  needs_reconciliation: { label: 'Needs reconciliation', tone: 'rose' },
}

export const ROLES = {
  MEMBER: 'member',
  TREASURER: 'treasurer',
  LOGISTICS: 'logistics_coordinator',
}

export const ROLE_LABELS = {
  member: 'Member',
  treasurer: 'Treasurer',
  logistics_coordinator: 'Logistics Coordinator',
}

// Fixed allowlist offered in the committee-access dropdown. Users never type role names.
export const COMMITTEE_ROLES = [ROLES.TREASURER, ROLES.LOGISTICS]

export const PERMISSIONS = {
  CLAIMS_CREATE: 'claims.create',
  CLAIMS_VIEW_SOCIETY: 'claims.view_society',
  CLAIMS_REVIEW: 'claims.review',
  CLAIMS_APPROVE: 'claims.approve',
  PAYMENTS_INITIATE: 'payments.initiate',
  SOCIETY_CONFIGURE: 'society.configure_reimbursement',
  MEMBERS_MANAGE: 'members.manage',
}

// Least privilege: logistics can see society claims but cannot approve or pay.
export const ROLE_PERMISSIONS = {
  member: ['claims.create'],
  logistics_coordinator: ['claims.create', 'claims.view_society'],
  treasurer: [
    'claims.create',
    'claims.view_society',
    'claims.review',
    'claims.approve',
    'payments.initiate',
    'society.configure_reimbursement',
    'members.manage',
  ],
}

export const CATEGORIES = {
  venue: 'Venue hire',
  equipment: 'Equipment',
  food: 'Food & drink',
  travel: 'Travel',
  printing: 'Printing & publicity',
  other: 'Other',
}

export const CURRENCIES = ['GBP', 'EUR', 'USD']

// The seven deterministic checks run by plain code after the AI read (CONTEXT.md step 3).
export const CHECKS = [
  { id: 'amount_matches', label: 'Claimed amount is covered by the receipt' },
  { id: 'not_duplicate', label: 'Not a duplicate of another claim' },
  { id: 'within_budget', label: 'Within society term budget' },
  { id: 'allowed_category', label: 'Category allowed by society policy' },
  { id: 'recent_date', label: 'Receipt is recent' },
  { id: 'under_limit', label: 'Under the per-claim limit' },
  { id: 'not_flagged', label: 'No signs of fraud or hidden instructions' },
]

export const REIMBURSEMENT_STATUS = {
  DISABLED: 'disabled',
  ENABLED: 'enabled',
}

export const SETUP_STEPS = [
  { id: 'committeeVerified', label: 'Treasurer verified against Union committee record' },
  { id: 'treasuryWalletSet', label: 'Treasury wallet address recorded' },
  { id: 'ledgerPaired', label: 'Ledger signer paired and genuine-checked' },
  { id: 'policySet', label: 'Spending policy set' },
  { id: 'unionApproval', label: 'Union finance office approval' },
]
