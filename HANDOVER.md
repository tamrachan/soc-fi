# Front-end → Back-end handover

Living document. The front-end updates it whenever the schema, statuses or API contract change.
**If you change something here on the backend side, update this file in the same PR.**

| | |
|---|---|
| Last updated | 2026-10-12 — the agent decides, appeals, Union treasurer, hybrid backend (see Changelog). **Sections 2 to 6 below still describe the older flow in places; the changelog entry is authoritative where they differ.** |
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
    items: [{ desc, amount }],          // line items, used for the arithmetic check
    flags: [{ code: 'prompt_injection' | 'wallet_address_on_receipt' | 'total_mismatch',
              severity: 'block' | 'warn', message, evidence? }],
    discardedFields: { [key]: any },   // anything outside the schema, plus walletAddressInText
    rawTextExcerpt,                     // first 2,000 chars of what the reader saw (shown to the treasurer)
    model, engineKind: 'model' | 'ocr', unreadable?, note?, extractedAt
  },
  memberConfirmedAt, submittedAt,
  validation: {
    passed: bool,                       // true when no check has status 'fail'
    warnings: number,                   // checks with status 'warn': the treasurer must look
    ranAt,
    checks: [{ id, status: 'pass' | 'warn' | 'fail', passed: bool, detail }]
  }
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
| `extractReceipt(receipt, {onProgress?})` | | aiExtraction | runs the AI server-side; strips non-schema keys into `discardedFields`; runs the fraud scan (§5.11). `onProgress({stage, progress})` is optional |
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

1. **The AI never submits, approves or pays.** `extractReceipt` returns data only. Any key outside the extraction schema (`src/domain/reader/index.js` → `EXTRACTION_FIELDS`) goes into `discardedFields` and is ignored.
2. **The 7 checks** are in `src/domain/rules.js` (port or import it into Functions). Each returns `pass`, `warn` or `fail`. **Only `fail` stops a claim**; `warn` lets it through and is shown to the treasurer as "things to check".
   - `amount_matches` never fails, because the AI can misread a photo and the member must not be stuck. Equal or less than the read total (a partial claim) → `pass`. More than the read total, a different currency, or no total found → `warn`.
   - `not_flagged`: any `block` flag → `fail`; only `warn` flags → `warn`.
   - The other checks are `not_duplicate`, `within_budget`, `allowed_category`, `recent_date` (≤ 90 days), `under_limit`, `not_flagged`. Re-run them server-side on every submit. Never trust `validation` from the client. If the client sends no `aiExtraction` (manual entry), the server reads the receipt itself.
3. **Server-side re-extraction.** Even when the client sends `aiExtraction`, production should re-extract from the stored receipt rather than trust the browser's copy.
4. **Separation of duties.** A reviewer can't review their own claim. `logistics_coordinator` can't review, approve or pay.
5. **Version binding.** `reviewClaim` must receive `version === currentVersion`, otherwise `aborted`. Approval sets `approvedVersion`. Payment is blocked if `currentVersion !== approvedVersion`. Editing a returned claim creates a new version, so a previous approval never carries over.
6. **Payment is built from trusted records only:** the approved version's amount, the claimant's saved `walletAddress` copied at approval, and the society's token, network and treasury. **Never** use anything from the browser or the receipt.
7. **A claim is paid only after on-chain confirmation.** `spentThisTerm` is incremented at the same moment.
8. **Uncertain outcome:** set `needs_reconciliation` and look up `txHash` before allowing any retry, so nobody is paid twice.
9. **Reimbursement stays disabled** until committee verification, treasury wallet, Ledger pairing, policy and Union approval are all done. Any setup change resets Union approval.
10. **Audit log** on: committee claims (all outcomes), permission grants, membership decisions, setup changes, enablement, submissions, reviews, device confirm/reject, payment confirmation and reconciliation.
11. **Fraud scan runs on everything the reader saw, in plain code** (`src/domain/reader/injection.js`, plus the arithmetic check in `reader/index.js`). It doesn't rely on the AI noticing:
    - **Text instructing an AI** (ignore rules, "note to AI", pre-approved, pay this address, mark urgent) → `prompt_injection`, `block`.
    - **Any crypto wallet address printed on the receipt** → `wallet_address_on_receipt`, `block`. The address is also copied into `discardedFields.walletAddressInText`.
    - **Line items that don't add up to the printed total** → `total_mismatch`. This is `block` when a model read the receipt, and `warn` for OCR, because OCR can miss lines.

### Receipt reader (production)
Run the reader in a Cloud Function, with the Claude API key held in Ledger Key Ring (CONTEXT.md must-have). The demo's browser version is in `src/domain/reader/claudeReader.js`. Port it as is:
- **Call:** `client.messages.parse` with `output_config.format = jsonSchemaOutputFormat(RECEIPT_SCHEMA)` and effort `low`.
- **Model:** `claude-opus-5-5` by default; `claude-haiku-5-5` is the cheaper option.
- **The schema has no payee, amount override or approval field,** so the model can't return one. Text that tries to instruct it is reported in `suspiciousText` instead.
- **Refusals:** on `stop_reason: 'refusal'` or any API error, the demo falls back to the free OCR reader.

The demo's free reader is Tesseract.js running in the browser, with a contrast boost (`reader/enhance.js`) so faint grey thermal print is readable.

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

## 8. Confirmed flow (2026-10-11): the app isn't aligned yet

The team confirmed this flow. The landing-page animation (`src/components/story/`) shows it. The working app and the schema above still use the older per-society-treasurer model, so **check with front-end before building these parts**:

| Confirmed flow | App today | Likely schema change |
|---|---|---|
| The **Union** holds the Ledger wallet | Each society has `reimbursement.treasuryWallet` and its own Ledger | Move the treasury, Ledger device and payment source to a single `union` doc. Keep per-society budget and policy |
| The **Union treasurer** reviews and approves | The society treasurer (`claims.review` on a society membership) | New union-level role, e.g. `unionRoles/{uid}: { role: 'union_treasurer' }`, with review rights across all societies |
| A society **committee member** submits | Any member with `claims.create` | Probably restrict `claims.create` to committee roles. To be decided |
| Checker rejects → ticket back to the member, who can **override** | A failed claim can only be fixed or withdrawn | New status (e.g. `override_requested`) plus `version.override = { reason, at }`; the claim enters review with the failed checks shown as warnings |
| **Email the Union treasurer only when a claim is submitted**, never at the moment something is flagged. The email includes the claim, the event (`fields.description`), the amount, and every `warn` check (e.g. "Amount differs from the AI read (£14.59)") | No emails | Cloud Function on submit (status → `pending_review`) |
| In review, each warning is shown **under the field it concerns** (e.g. under Amount) | Warnings listed in a summary card | Front-end change; no schema change needed (map check id → field: `amount_matches` → amount) |
| Payment goes to the member's saved crypto address | Same | No change |

## Changelog

- **2026-10-13:**
  - **Recipient check.** Payments returned by `getClaim` and `listPayments` carry `recipientCheck: { savedWallet, matchesSavedWallet, walletChangedAt, walletSince, earlierPayouts, printedOnReceipt }`, worked out server-side from the user and payment records. `components/RecipientCheck.jsx` shows it to the Union treasurer on the claim and in the signing modal. New user field `walletChangedAt`, set by `updateProfile`.
  - **Attack demo (mock and hybrid only).** `api.demo.attack()` / `api.demo.setAttack(bool)`, a checkbox in the demo bar. While on, `extractReceipt` drops the fraud flags and adds `obeyedInstruction: { payTo }` when the receipt text contains an address, and `submitClaim` drafts the payment to that address. Hybrid skips the backend agent for such a claim. Do not port this.
  - **Submitting in the background.** `data/submissions.js` runs `submitClaim` outside the form and lists claims still being checked on My claims. `submitClaim` takes an internal `asUserId` so a claim stays with whoever submitted it.
  - **Sample receipts added:** `rcp_coop_beer`, `rcp_stickers` (hidden "pay this wallet" text). Seed changes need **Reset**.
- **2026-10-12 (b), landing page only, no schema or API change:** The scroll story now matches the agent-decides flow. It has a new middle chapter, `components/story/AgentChapter.jsx`, which shows:
  - the eight `CHECKS`, each with the reason it can fail;
  - Priya's claim passing;
  - a doctored receipt failing `under_limit` and `not_flagged`;
  - a Baking Society claim over its £80 limit, appealed and approved by the society treasurer.

  The Union treasurer chapter now opens the Payments queue, checks the flagged field, then signs or rejects on the Ledger. It no longer shows an email or approve/edit/deny. The member chapter ends with "Approved by the agent · Awaiting Ledger". The hero bullets and the Boundary section are rewritten to match. If the backend changes the check list or the £200 / £80 / 90-day values, update `AgentChapter.jsx`.

- **2026-10-12 (backend integration, branch `backend-integration`):**
  - **No Firebase.** A third data source, `VITE_DATA_SOURCE=hybrid` (`src/data/hybridApi.js`), spreads `mockApi` and replaces two methods with calls to `backend/` (`VITE_BACKEND_URL`, default `http://localhost:3000`): `submitClaim` (asks the LLM agent for a verdict first) and `confirmOnDevice` (real signature on the emulated Ledger, real USDC transfer). It also adds `api.device` (`label`, `screenshotUrl()`, `press(button)`). `isMock` is true for both mock and hybrid; the new `hasDevice` export is true only for hybrid.
  - **The agent decides (most of §8 is now built).** `submitClaim` no longer sends a passing claim to `pending_review`. A claim that passes gets a payment at once and status `awaiting_ledger`; one that fails gets `validation_failed`. `submitClaim` accepts an optional `agentVerdict: { decision, reason, flags }`, stored as an eighth check, `agent_judgement` (added to `CHECKS`; only present in hybrid mode).
  - **Appeals.** New method `appealClaim(id, reason)`: owner only, from `validation_failed` to `pending_review`, sets `claim.appeal = { reason, at, version }`. Refused when `not_flagged` failed. `pending_review` now means "appealed"; the society treasurer decides it with the existing `reviewClaim`. `listReviewClaims` returns only claims that have an appeal or a review.
  - **Union treasurer.** New `user.unionRole: 'treasurer'` (seed user `usr_union`, Robin Calder) and `isUnionTreasurer(session)` in `domain/permissions.js`. `listPayments`, `confirmOnDevice`, `cancelOnDevice`, `retryPayment` and `reconcilePayment` are Union-treasurer only. `payments.initiate` is removed from the society treasurer role. The Union treasurer can open any claim that has a payment.
  - **Payments.** `payment.approvedBy` is `'agent'` or the society treasurer's user id. `payment.sourceAddress` is the Union wallet (`UNION_TREASURY_WALLET`, from `VITE_UNION_TREASURY_WALLET`). `confirmOnDevice(paymentId, { demoOutcome, txHash, device })` accepts a real hash and device name.
  - **Display labels only:** `validation_failed` shows as "Declined by agent", `pending_review` as "Appealed", `rejected` as "Appeal denied". Stored enum values are unchanged.
  - **Audit actions added:** `claim.agent_approved`, `claim.agent_declined` (actor `agent`), `claim.appealed`.
  - **Seed data:** claims that were `pending_review` in the seed are approved by the agent on load, so they start in the Union treasurer's queue. Mock storage key bumped to `socfi.db.v3`.
  - **`useAction`'s `run`** now resolves to `{ ok, data, error }`.
  - **`LedgerSignModal`** in hybrid mode has no "Hold to sign": it sends the transfer to the device on open and mirrors the device's screen and buttons. The device is a Nano S Plus, not a Flex.
  - **Not done:** society setup still asks each society for a treasury wallet and a paired Ledger; no emails; committee-only claiming is undecided.

- **2026-10-11 (d):**
  - **Email rule added to §8:** the Union treasurer is emailed on submit, with warnings included; nothing is sent at flag time.
  - **Demo claims** now name the event ("…hackathon with Ledger"). Mock storage key bumped to `socfi.db.v2`.
- **2026-10-11 (c):**
  - **The app is now called SocFi** ("Society Finance, secured."); `APP_NAME` and `TAGLINE` are in `src/config.js`.
  - **Mock localStorage keys** renamed to `socfi.*` (`socfi.db.v1`, `socfi.session.v1`, `socfi.reader`, `socfi.lastSociety`). Old demo data is discarded.
  - **Animation:** the Ledger step now shows a hardware wallet with physical buttons, pressed by a finger.
- **2026-10-11 (b):**
  - **Scroll animation** on the landing page and `/how-it-works`, built with anime.js v4. It shows the confirmed Union flow.
  - **Confirmed flow recorded in §8.** The app and schema haven't been changed yet.
- **2026-10-11:**
  - **Real receipt reading.** Free on-device OCR (Tesseract.js) by default; optional Claude vision reader with a key typed in on the Account page (demo only). Replaces the simulated reader that copied values from a sample receipt.
  - **Checks are now `pass` / `warn` / `fail`.** A member amount that disagrees with the AI is a `warn` for the treasurer, not a block. This fixes members being unable to submit when the AI misread the total.
  - **New fraud flags:** `wallet_address_on_receipt`, and `total_mismatch` (catches altered totals). Flags carry `severity`.
  - **Extraction shape:** added `items`, `rawTextExcerpt`, `engineKind`, `unreadable` and `note`. `extractReceipt` accepts an optional `{ onProgress }`.
  - **Display labels only:** the `rejected` status shows as "Denied" and `returned` as "Edits requested". The stored enum values are unchanged.
  - **New sample receipt** `rcp_altered` (altered total). Mock storage key bumped to `countersign.db.v3`.

- **2026-10-10 (b):**
  - **Seed data is now St Andrews.** Email domain is `@st-andrews.ac.uk`. Society IDs changed: `soc_blockchain` and `soc_baking` are enabled; `soc_fintech` is mid-setup; `soc_staai`, `soc_stacs`, `soc_chess`, `soc_breakaway` and `soc_film` are disabled. Society names come from the Your Union directory. All people, wallets, IDs and receipts are fictional.
  - **Personas:** Amara (member), Jonah (Blockchain treasurer), Elena (Baking treasurer), Priya (Blockchain logistics), Sam (FinTech treasurer).
  - **`amount_matches` now allows partial claims** (claimed amount ≤ receipt total). The check's label changed; the ID didn't.
  - **Receipt upload shape:** added `width`, `height` and `originalSize`. Photos are compressed client-side (see §2 ClaimVersion).
  - **Mock storage key** bumped to `countersign.db.v2`, so old browser data is discarded.
  - **Front-end only:** installable web app manifest (`public/manifest.webmanifest`).
- **2026-10-10:** Initial version. Collections, enums, API contract, mock seed data, status machine.
