// Firebase implementation of the API contract — TO BE COMPLETED BY BACKEND.
// Every method must return the same shapes as mockApi.js (see HANDOVER.md §4).
// Reads can go straight to Firestore (guarded by security rules); every write that changes
// claim status, permissions or payments must go through a Cloud Function, never a client write.
// Firebase is loaded lazily so the mock demo build doesn't initialise it.
import { ApiError } from './errors.js'

const fb = () => import('../lib/firebase.js')

const todo = (name) => async () => {
  await fb()
  throw new ApiError('unimplemented', `firebaseApi.${name}() is not implemented yet`)
}

const METHODS = [
  // session & onboarding
  'signUp', 'verifyEmail', 'resendVerification', 'signOut', 'updateProfile',
  // societies & membership
  'listSocieties', 'getSociety', 'requestMembership', 'joinWithInvite', 'listMembershipRequests',
  'decideMembership', 'listCommitteeRoles', 'requestCommitteeAccess',
  // reimbursement setup
  'updateReimbursementSetup', 'pairLedger', 'requestUnionApproval', 'enableReimbursement',
  // receipts & AI
  'listSampleReceipts', 'getReceipt', 'extractReceipt',
  // claims
  'listMyClaims', 'listReviewClaims', 'getClaim', 'submitClaim', 'withdrawClaim', 'reviewClaim',
  // payments
  'listPayments', 'retryPayment', 'cancelOnDevice', 'confirmOnDevice', 'reconcilePayment',
  // audit
  'listAuditLog',
]

export const firebaseApi = {
  ...Object.fromEntries(METHODS.map((m) => [m, todo(m)])),
  // Call fn whenever data the UI depends on changes (wire to onAuthStateChanged + onSnapshot).
  onChange: () => () => {},
  getSession: async () => ({ user: null, memberships: [] }),
  demo: null,
}
