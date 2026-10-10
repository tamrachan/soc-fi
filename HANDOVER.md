# Front-end → Back-end handover

Living document. The front-end updates it whenever the schema, statuses or API contract change.
**If you change something here on the backend side, update this file in the same PR.**

| | |
|---|---|
| Last updated | 2026-10-10 — St Andrews data, partial-claim rule, mobile receipt capture (see Changelog) |
| Pilot | University of St Andrews · St Andrews Students' Association ("Your Union") · `@st-andrews.ac.uk` |
| Front-end | `frontend/` — Vite + React (JS), HashRouter, deployed to GitHub Pages in mock mode |
| Source of truth for enums | [`frontend/src/data/schema.js`](frontend/src/data/schema.js) |
| Mock implementation of the contract | [`frontend/src/data/mockApi.js`](frontend/src/data/mockApi.js) |
| Stub you implement | [`frontend/src/data/firebaseApi.js`](frontend/src/data/firebaseApi.js) |
| Seed data | [`frontend/src/data/mock/*.json`](frontend/src/data/mock/) — can be loaded into the Firestore emulator as-is |

---

## 1. How the front-end talks to data

Every page imports `api` from `src/data/api.js` and calls the async methods listed in §4. Nothing else touches Firestore.

- `VITE_DATA_SOURCE=mock` (default) → `mockApi.js`, state saved in the browser's `localStorage`. This is what GitHub Pages serves.
- `VITE_DATA_SOURCE=firebase` → `firebaseApi.js`. Every method currently throws `unimplemented`.

To go live, implement each method in `firebaseApi.js` so it **returns the same shape as `mockApi.js`**. The UI needs no other changes.

- **Reads** can query Firestore directly, guarded by security rules.
- **Writes** that change claim status, permissions, setup or payments **must go through Cloud Functions**, never direct client writes. The mock enforces the rules the functions must enforce (§5), so read `mockApi.js` as the spec.
- `onChange(fn)`: call `fn()` whenever anything the UI depends on changes. Wire it to `onAuthStateChanged` plus `onSnapshot` on the user's claims, memberships and queue. The UI re-fetches on each call.
- Errors: throw `ApiError(code, message)` from `src/data/errors.js`. `message` is shown to the user, so keep it human. Codes use Firebase style: `permission-denied`, `failed-precondition`, `invalid-argument`, `not-found`, `already-exists`, `aborted`, `auth/required`, `auth/unverified`.

Timestamps are ISO-8601 strings in the mock. Convert Firestore `Timestamp`s to ISO strings in `firebaseApi.js` so the UI stays the same. Receipt dates (`fields.date`) are plain `YYYY-MM-DD`.

---

## 2. Firestore collections

IDs below are the mock's. Use auto-IDs in production, except where a composite ID is noted.

### `users/{uid}`, where uid is the Firebase Auth uid
```js
{ id, displayName, email, emailVerified: bool, walletAddress: '0x…' | null, createdAt }
```
- `email` must end with `@st-andrews.ac.uk`. The mock uses the St Andrews username format, e.g. `ab123@st-andrews.ac.uk`. Configurable as `UNI_EMAIL_SUFFIX` in `src/config.js`. `emailVerified` comes from Firebase Auth email-link/code verification. **Never trust a client-written value.**
- `walletAddress` is the **only** address a reimbursement can be sent to. You can't change it while the user has a claim in `approved | awaiting_ledger | payment_pending | needs_reconciliation`.

### `societies/{societyId}`, imported from the Union directory
```js
{
  id, unionId: 'SU-0142', name, category, memberCount,
  unionStatus: 'active' | 'suspended',
  reimbursement: {
    status: 'disabled' | 'enabled',            // disabled by default on import
    token: 'USDC', network: 'base-sepolia', currency: 'GBP',
    treasuryWallet: '0x…' | null,
    perClaimLimit: number | null,               // in `currency`
    termBudget: number | null,
    spentThisTerm: number,                      // incremented ONLY on on-chain confirmation
    allowedCategories: ['venue','equipment','food','travel','printing','other'],
    setup: {
      committeeVerified: bool, treasuryWalletSet: bool, ledgerPaired: bool, policySet: bool,
      unionApproval: 'not_requested' | 'requested' | 'approved'
    },
    ledgerDevice: { model, genuineCheckAt } | null,
    enabledAt, enabledBy
  }
}
```
- `inviteCode` is in the mock seed for convenience. **In production keep it in a server-only subcollection** (`societies/{id}/private/invite`), because every member can read the society doc.

### `committeeRecords/{id}`, imported from the Union committee database (server-only)
```js
{ id, societyId, fullName, role: 'treasurer' | 'logistics_coordinator', termStart: 'YYYY-MM-DD', termEnd, source: 'union_import' }
```
Clients never read this collection. The front-end only calls `listCommitteeRoles(societyId)`, which returns the allowlisted roles that exist for that society.

### `memberships/{societyId}__{uid}` (composite ID)
```js
{ id, societyId, userId, role: 'member' | 'treasurer' | 'logistics_coordinator',
  status: 'pending' | 'active', joinedVia: 'request' | 'invite' | 'committee_match',
  permissions: string[], committeeRecordId: string | null, createdAt }
```
Permissions are written explicitly, from `ROLE_PERMISSIONS`:

| role | permissions |
|---|---|
| member | `claims.create` |
| logistics_coordinator | `claims.create`, `claims.view_society` |
| treasurer | the above + `claims.review`, `claims.approve`, `payments.initiate`, `society.configure_reimbursement`, `members.manage` |

Consider mirroring permissions into custom claims, or reading memberships in security rules.

### `roleClaims/{id}`, one per committee-access attempt
```js
{ id, userId, societyId, requestedRole, submittedName, outcome: 'matched' | 'manual_review' | 'denied', reason, committeeRecordId, createdAt }
```
Matching logic is in `src/domain/committeeMatch.js`:
- An exact normalised name match (accents, case and spacing ignored) on an unclaimed, in-term record gives `matched`.
- A near match (Levenshtein ≤ 3, or same surname and first initial), or a record already linked to someone else, gives `manual_review`.
- Anything else gives `denied`.

Only `matched` grants permissions.

### `claims/{claimId}`
```js
{
  id, reference: 'CLM-0004', societyId, claimantId,
  status,                       // see §3
  currentVersion: number,
  approvedVersion: number | null,
  paymentId: string | null,
  supersedesClaimId: string | null,   // set when member "started a new claim" after a return
  createdAt, updatedAt,
  versions: [ ClaimVersion ],   // mock embeds these. In Firestore use claims/{id}/versions/{n}
  reviews:  [ Review ]          // mock embeds these. In Firestore use claims/{id}/reviews/{id}
}
```
The UI also expects these joined fields on reads (see `claimView` in mockApi):
`latest` (the current ClaimVersion), `latestReview`, `society: {id, name, reimbursement}`, `claimant: {id, displayName, email, walletAddress}`, `payment`.

**ClaimVersion** (immutable once reviewed)
```js
{
  version: 1,
  entryMode: 'ai_prefill' | 'manual',
  fields: { merchant, date: 'YYYY-MM-DD', amount: number, currency: 'GBP'|'EUR'|'USD', category, description },
  receipt: { kind: 'upload', fileName, mimeType, size, width, height, originalSize, storagePath }
         | { kind: 'sample', sampleId },                               // demo receipts only
  aiExtraction: {
    merchant, date, total, currency, suggestedCategory, confidence: 0..1,
    flags: [{ code: 'prompt_injection' | …, message }],
    discardedFields: { [key]: any },   // anything the model returned outside the schema
    model, extractedAt
  },
  memberConfirmedAt, submittedAt,
  validation: { passed: bool, ranAt, checks: [{ id, passed, detail }] }
}
```
**Receipt photos (mobile).** The member photographs the receipt with the phone camera (`<input capture="environment">`). Before anything is uploaded, the browser downscales the photo to a JPEG at most 1400px on the long edge, quality 0.78 (`src/lib/image.js`). That's typically 150–400 KB. PDFs and images the browser can't decode (e.g. HEIC on desktop) are passed through unchanged.
- In the mock, the compressed image is stored inline as `dataUrl`.
- In production, upload it to Storage at `receipts/{uid}/{claimId}/{version}.jpg` and store `storagePath`, not `dataUrl`.
- Suggested Storage rules: owner-only write; `contentType` must be `image/jpeg` or `application/pdf`; under 5 MB. The claimant and reviewers with `claims.view_society` can read.

**Review**
```js
{ id, version, decision: 'approve' | 'return' | 'reject', resolution: 'edit_existing' | 'start_new' | null, reason, reviewerId, at }
```

### `payments/{paymentId}`
```js
{
  id, claimId, claimReference, claimVersion, societyId,
  recipientUserId, recipientAddress,  // copied from users/{claimant}.walletAddress AT APPROVAL
  sourceAddress,                      // society treasury
  fiatAmount, fiatCurrency, fxRate, amount /* USDC */, token: 'USDC', network,
  status: 'awaiting_device' | 'cancelled' | 'pending' | 'confirmed' | 'needs_reconciliation',
  attempts, txHash, approvedBy, approvedAt, deviceConfirmedAt, confirmedAt,
  history: [{ status, at }]
}
```

### `auditLog/{id}` (append-only, server-written)
```js
{ id, at, actorId /* uid | 'system' | 'union_finance' */, action, entity: { type, id }, societyId, details }
```
The action names the UI knows are listed in `src/pages/AuditLog.jsx` (`LABELS`). If you add a new action, add a label there.

### `receipts` (demo only)
`mock/receipts.json` contains the sample receipts the demo renders as paper, including `rcp_pixel`, which has hidden prompt-injection text. These aren't needed in production.

---

## 3. Claim status machine

```
(new) ──submit──▶ validation_failed ──fix & resubmit──▶ pending_review
                      │ withdraw                          │
                      ▼                                   ├─ approve ─▶ awaiting_ledger ─device reject─▶ approved ─retry─▶ awaiting_ledger
                  withdrawn                               │                 │ device signs + broadcast
                                                          │                 ▼
                                                          │           payment_pending ─confirmed─▶ paid
                                                          │                 │ unknown
                                                          │                 ▼
                                                          │           needs_reconciliation ─reconcile─▶ paid (or back to approved if tx not found)
                                                          ├─ return (edit_existing) ─▶ returned ─member edits─▶ pending_review (new version)
                                                          ├─ return (start_new)     ─▶ returned ─new claim passes─▶ superseded
                                                          └─ reject ─▶ rejected
```
Notes:
- `validation_failed` stands in for "Draft with validation issues" in `user_flows.md`. The version that failed is **replaced** on resubmit, because it was never reviewed. A returned claim gets a **new** version.
- Payment status values and their labels are in `PAYMENT_STATUS_META` in `schema.js`.

---

## 4. API contract

All methods are async. "Session" means the signed-in, verified user unless noted.

| Method | Args | Returns | Server must check |
|---|---|---|---|
| `onChange(fn)` | listener | unsubscribe fn | — |
| `getSession()` | — | `{ user, memberships: [membership + society{id,name,reimbursement}] }` | — |
| `signUp({displayName, email, walletAddress?})` | | `{ user }` | uni email domain, wallet format, unique email |
| `verifyEmail({code})` | | user | real verification (Firebase Auth) |
| `resendVerification()` | | — | rate limit |
| `signOut()` | | — | |
| `updateProfile({walletAddress?, displayName?})` | | user | no change while a payment is in flight; audit log |
| `listSocieties()` / `getSociety(id)` | | society (no invite code) | |
| `requestMembership(societyId)` | | — | society active, no existing membership |
| `joinWithInvite(code)` | | `{ societyId, name }` | |
| `listMembershipRequests(societyId)` | | `[membership + user]` | `members.manage` |
| `decideMembership(membershipId, approve)` | | — | `members.manage` |
| `listCommitteeRoles(societyId)` | | `string[]` | allowlist ∩ records for that society |
| `requestCommitteeAccess({societyId, role, submittedName})` | | roleClaim + `permissionsGranted` | §2 matching; audit log |
| `updateReimbursementSetup(societyId, {treasuryWallet?} \| {perClaimLimit, termBudget, allowedCategories})` | | reimbursement | `society.configure_reimbursement`; resets `unionApproval` |
| `pairLedger(societyId)` | | reimbursement | genuine check via wallet-cli |
| `requestUnionApproval(societyId)` | | — | the other 4 steps are done |
| `enableReimbursement(societyId)` | | reimbursement | all 5 steps done |
| `listSampleReceipts()` / `getReceipt(sampleId)` | | | demo only |
| `extractReceipt(receipt)` | | aiExtraction | runs the AI server-side; strips non-schema keys into `discardedFields` |
| `listMyClaims()` | | `[claimView]` | |
| `listReviewClaims()` | | `[claimView]` for societies where the user has `claims.review` | |
| `getClaim(id)` | | claimView | claimant, or `claims.view_society` |
| `submitClaim({claimId?, societyId, fields, receipt, entryMode, aiExtraction?, supersedesClaimId?})` | | claimView (status `pending_review` or `validation_failed`) | §5 |
| `withdrawClaim(id)` | | — | owner; status in validation_failed / pending_review / returned |
| `reviewClaim(id, {decision, reason, resolution, version})` | | claimView | §5 |
| `listPayments()` | | `[payment + society + recipient]` | `payments.initiate` |
| `confirmOnDevice(paymentId)` | | payment | see §6 |
| `cancelOnDevice(paymentId)` | | — | |
| `retryPayment(paymentId)` | | — | only from `cancelled` |
| `reconcilePayment(paymentId)` | | payment | look up `txHash` on-chain before any retry |
| `listAuditLog()` | | `[entry + actorName + societyName]` | own entries plus societies with `claims.view_society` |

`api.demo` (persona switcher, reset) exists only in the mock. Set it to `null` in Firebase.

---

## 5. Rules the server must enforce

The front-end enforces these too, but **the server is authoritative**.

1. **The AI never submits, approves or pays.** `extractReceipt` returns data only. Any key outside `merchant, date, total, currency, suggestedCategory, confidence, flags` goes into `discardedFields` and is ignored.
2. **The 7 checks** are in `src/domain/rules.js` (port or import it into Functions). `amount_matches` passes if the claimed amount is **at most** the receipt total, so a member can claim part of a receipt (e.g. leave out a personal item). Claiming more than the total fails. The other checks are `not_duplicate`, `within_budget`, `allowed_category`, `recent_date` (≤ 90 days), `under_limit`, `not_flagged`. Re-run them server-side on every submit. Never trust `validation` from the client. If the client sends no `aiExtraction` (manual entry), the server reads the receipt itself.
3. **Server-side re-extraction.** Even when the client sends `aiExtraction`, production should re-extract from the stored receipt rather than trust the browser's copy.
4. **Separation of duties.** A reviewer can't review their own claim. `logistics_coordinator` can't review, approve or pay.
5. **Version binding.** `reviewClaim` must receive `version === currentVersion`, otherwise `aborted`. Approval sets `approvedVersion`. Payment is blocked if `currentVersion !== approvedVersion`. Editing a returned claim creates a new version, so a previous approval never carries over.
6. **Payment is built from trusted records only:** the approved version's amount, the claimant's saved `walletAddress` copied at approval, and the society's token, network and treasury. **Never** use anything from the browser or the receipt.
7. **A claim is paid only after on-chain confirmation.** `spentThisTerm` is incremented at the same moment.
8. **Uncertain outcome:** set `needs_reconciliation` and look up `txHash` before allowing any retry, so nobody is paid twice.
9. **Reimbursement stays disabled** until committee verification, treasury wallet, Ledger pairing, policy and Union approval are all done. Any setup change resets Union approval.
10. **Audit log** on: committee claims (all outcomes), permission grants, membership decisions, setup changes, enablement, submissions, reviews, device confirm/reject, payment confirmation and reconciliation.

---

## 6. Ledger integration points (where the mock is simulated)

| UI moment | Mock does | Real implementation |
|---|---|---|
| Society setup → "Pair Ledger" | waits 1.6 s, sets `ledgerPaired` | `wallet-cli genuine-check` + record device model |
| Review → "Approve and sign on Ledger" | creates `payments` doc `awaiting_device` | same, then propose the tx (wallet-cli `send`, or Agent Intent `send` for human review) |
| `LedgerSignModal` "Hold to sign" | `confirmOnDevice` → `pending`, then `confirmed` after 4 s (or `needs_reconciliation` if the demo selector says so) | the physical device shows amount, recipient and network. The backend gets the result and broadcast hash, then watches for confirmation |
| Device "Reject" | `cancelOnDevice` → `cancelled`, claim back to `approved` | device rejection or timeout |
| AI API key | n/a | stored with Ledger Key Ring (`ring encrypt`). No plaintext `.env` |

The device screen in the modal shows `Reimburse claim · {society} · {reference} v{n}` / amount / to / network. That's what we want ERC-7730 clear signing to show (stretch goal).

---

## 7. Open questions for backend

- **Network:** the mock uses `base-sepolia`. Confirm the chain we can actually sign on with wallet-cli / Agent Intent, then change `NETWORKS` in `src/config.js`.
- **FX:** claims are in GBP and paid in USDC. The mock uses a fixed 1.27 (`FX_TO_USDC`). The backend should quote and store `fxRate` at approval. Or do we just claim in USD?
- **Who confirms `manual_review` committee claims?** There's no Union admin UI yet.
- **Firebase region:** `src/lib/firebase.js` assumes `europe-west2` for Functions.

---

## Changelog

- **2026-10-10 (b):**
  - **Seed data is now St Andrews.** Email domain is `@st-andrews.ac.uk`. Society IDs changed: `soc_blockchain` and `soc_baking` are enabled; `soc_fintech` is mid-setup; `soc_staai`, `soc_stacs`, `soc_chess`, `soc_breakaway` and `soc_film` are disabled. Society names come from the Your Union directory. All people, wallets, IDs and receipts are fictional.
  - **Personas:** Amara (member), Jonah (Blockchain treasurer), Elena (Baking treasurer), Priya (Blockchain logistics), Sam (FinTech treasurer).
  - **`amount_matches` now allows partial claims** (claimed amount ≤ receipt total). The check's label changed; the ID didn't.
  - **Receipt upload shape:** added `width`, `height` and `originalSize`. Photos are compressed client-side (see §2 ClaimVersion).
  - **Mock storage key** bumped to `countersign.db.v2`, so old browser data is discarded.
  - **Front-end only:** installable web app manifest (`public/manifest.webmanifest`).
- **2026-10-10:** Initial version. Collections, enums, API contract, mock seed data, status machine.
