# Backend handover: where things stand and what to do next

Written 2026-10-12 for the next working session, after `backend/` moves into the team repo (`ledger-hackathon/backend`, remote `github.com/tamrachan/ledger-hackathon`).

**Deadline: submissions close Oct 13, 23:59 CEST.** Scope everything against that.

Read alongside:
- `backend/README.md`: hackathon brief, scoring, backend decisions, API table, gotchas, developer-experience notes.
- `HANDOVER.md` (repo root): the frontend's data model and API contract.
- `Context/CONTEXT.md` (repo root): the team's pitch and must-haves.

## State of the backend

An Express + TypeScript API (`src/`), run with `npm run dev` on port 3000.

Verified working:
- The Ledger DMK connects from Node to the Speculos emulator and reads the treasury address.
- `POST /api/expenses/:id/pay` drafts a USDC transfer on Base Sepolia, waits for the device, and returns a signed transaction. The device shows amount, recipient and network in clear. Rejecting on the device returns 403.
- Submit, override and treasurer-queue routes.

Not verified:
- The LLM audit with a real key (`.env` now has one; the test commands are in the "How to test" section below).
- Broadcasting. The treasury address `0xDad77910DbDFdE764fC21FCD4E74D71bBACA6D8D` needs Base Sepolia ETH and test USDC from faucets. Only a human can do this; do it early.
- Receipt images. Only text receipts have been tried.

## Fix immediately after the move

1. ~~`scripts/speculos.sh` path.~~ Done: the Ethereum app is bundled at `backend/speculos/ethereum-nanosp.elf` and the script uses it (`ETH_APP_ELF` overrides).
2. ~~Rename `backend/CONTEXT.md` to `backend/README.md`.~~ Done.
3. **Check `git status` before the first commit.** `backend/.gitignore` excludes `.env`, `node_modules` and `data`; confirm none are staged. Commit on a `backend` branch.
4. **Delete `CONVO.md`** (an old chat transcript whose code sample is wrong) or leave it out of the commit.
5. A Speculos container named `speculos-eth` may still be running from the old path. `npm run speculos` replaces it.

## Pivot on Oct 12: the agent decides, society treasurers only hear appeals

Built on branch `backend-integration`, in the frontend's mock layer and `hybridApi.js`:
- Submitting a claim runs the rule checks and, in hybrid mode, the backend agent (`POST /api/agent/audit`) with the society's profile and policy. Approved claims get a payment at once.
- A declined claim can be fixed and resubmitted, or appealed (`appealClaim`). Society treasurers see only appealed claims, and cannot pay.
- A new Union treasurer persona (`usr_union`, `user.unionRole`) is the only one who can list, sign, retry or reconcile payments.

Not changed: the society setup pages still ask each society for a treasury wallet and a paired Ledger, and `HANDOVER.md` still describes the old flow.

## The gap with the frontend

The frontend (`frontend/`, Vite + React) expects a full Firebase backend: Auth, Firestore, Storage and Cloud Functions behind about 35 methods (memberships, committee matching, claim versions, payments, audit log). Every method in `frontend/src/data/firebaseApi.js` throws "unimplemented". The app currently runs entirely on `mockApi.js`, with state in the browser's localStorage.

This backend has a different, much simpler model (a flat `Expense` with seven statuses) and none of those methods.

**Decision proposed, not yet confirmed by the team: go hybrid, skip Firebase.** Building the Firebase contract by the deadline is not realistic, and Cloud Functions could not reach an emulator on a laptop. Keep the frontend on mock data and make only the simulated Ledger and AI moments real.

## What to build, in order

### 1. Real device signing behind the "Hold to sign" modal (the demo's key moment)

**Built on branch `backend-integration`, not yet clicked through in a browser.** `VITE_DATA_SOURCE=hybrid` selects `frontend/src/data/hybridApi.js`; the modal mirrors the emulator's screen and buttons instead of "Hold to sign". The backend route was tested against the emulator with `BROADCAST=false` (sign, reject, repeat, cap). The original plan follows.

Frontend today: `LedgerSignModal.jsx` calls `api.confirmOnDevice(paymentId)` and `api.cancelOnDevice(paymentId)`. The mock's `confirmOnDevice` (in `mockApi.js`) invents a random `txHash`, sets the payment to `pending`, and settles it after 4 seconds.

Backend:
- Add `POST /api/payments/sign` taking `{ paymentId, recipientAddress, amountUsdc, claimReference }`. It drafts the USDC transfer, waits for the device, broadcasts, and returns `{ txHash }`. Reuse `signPayout` and `broadcast` in `src/payout.ts`; `signPayout` currently takes an `Expense` and converts from GBP, so split out a function that takes a recipient and a USDC amount.
- Return 403 when the device rejects (already how `DeviceError` is mapped), so the frontend can call the mock's `cancelOnDevice`.

Frontend:
- Add a third data source in `frontend/src/data/api.js`, e.g. `VITE_DATA_SOURCE=hybrid`: `{ ...mockApi, confirmOnDevice, cancelOnDevice }`.
- The hybrid `confirmOnDevice` calls the backend, then updates mock state with the real hash. `mockApi.confirmOnDevice` needs a small change to accept a `txHash` instead of generating one.
- Add `VITE_BACKEND_URL` (default `http://localhost:3000`). CORS is already open on the backend.
- The explorer link (`NETWORKS['base-sepolia'].explorer`) will then point at a real transaction.

Things to know:
- **The modal says "Hold to sign" and the mock audit log says "Ledger Flex", but the emulator is a Nano S Plus** (two buttons; the app was only built for that model). Either change the modal wording or rebuild the Ethereum app for Flex.
- **The treasurer presses the buttons in the Speculos web UI** at http://127.0.0.1:5001. Consider embedding or linking it from the modal.
- **Trust caveat:** in hybrid mode the amount and recipient come from the browser's mock store, which breaks HANDOVER rule 6 ("payment is built from trusted records only"). It is acceptable for the demo because the device screen is the real check, but don't claim otherwise in the pitch.
- **GitHub Pages stays mock.** Hybrid only works where the backend and emulator run, so the demo video is recorded locally.

### 2. One real payout on Base Sepolia

Fund the treasury address, run with `BROADCAST=true`, and get a transaction hash on sepolia.basescan.org for the video.

### 3. Server-side receipt reading (optional)

`api.extractReceipt(receipt, { onProgress })` could call the backend so the API key is not typed into the browser. HANDOVER §5 specifies the production reader: Claude (`claude-opus-5-5`, or `claude-haiku-5-5` as the cheaper option), structured output against `RECEIPT_SCHEMA`, ported from `frontend/src/domain/reader/claudeReader.js`. This backend's `src/agent.ts` uses the OpenAI SDK with a different output shape, so this is a port, not a hookup. The frontend's OCR and Claude readers already work in the browser; skip this if time is short.

### 4. Ledger Key Ring for the API key

The team lists this as a must-have ("no plain `.env`"), and it would be a second Ledger primitive for the technical score. Nothing is built. Docs: https://developers.ledger.com/docs/ai-tools/ledger-cli#key-ring. The repo has a `wallet-cli-usage` skill under `.claude/skills/`.

### 5. Submission material

README, demo video, and the developer-experience write-up (notes started at the bottom of `backend/README.md`). All required. Leave a few hours.

## Differences from what the team planned

- **Signing tool.** The team planned Ledger Wallet CLI (`genuine-check`, `send`) or Agent Intent. The backend uses the DMK with the Ethereum signer kit instead. It is verified working; keep it unless the team objects.
- **Network.** HANDOVER §7 asks which chain can be signed on. Answer: Base Sepolia works, and USDC (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`) is clear-signed.
- **Exchange rate.** Backend default is now 1.27 to match the frontend's `FX_TO_USDC`. Check `USDC_PER_GBP` in `.env`, which overrides it.
- **Who holds the wallet.** The confirmed flow is a union-held wallet with a union treasurer, plus a member override of rejections. HANDOVER §8 says the frontend still models a per-society treasurer and has no override. That is a frontend change. The backend's own `/override` route exists but the frontend does not call it.
- **Treasurer email.** HANDOVER §8 wants an email on submit, including warnings. The backend only logs on override (`notifyTreasurer` in `src/index.ts`).

## How to test the backend

Terminal 1: `npm run speculos`. Terminal 2: `npm run dev`.

```sh
# 1. Submit a claim (runs the LLM audit). Expect status agent_approved and audit.auditedBy "llm".
curl -s -X POST localhost:3000/api/expenses -H 'Content-Type: application/json' -d '{
  "society": "Chess Society", "memberEmail": "sam@uni.ac.uk",
  "memberWallet": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "description": "Two chess clocks for weekly meetings", "amountGbp": 25,
  "receiptText": "Argos, 08/10/2026. 2x DGT chess clock. Total £25.00"
}'

# 2. Override a rejected claim
curl -s -X POST localhost:3000/api/expenses/<id>/override -H 'Content-Type: application/json' -d '{"reason":"Approved at committee"}'

# 3. Treasurer queue and wallet balances
curl -s localhost:3000/api/treasurer/queue
curl -s localhost:3000/api/treasurer/wallet

# 4. Pay. Hangs until the device is used.
curl -s -X POST localhost:3000/api/expenses/<id>/pay
```

For step 4, open http://127.0.0.1:5001, press the right button through the screens, and press both buttons on "Sign transaction" (or on "Reject transaction", one screen further). Results: `signed` when `BROADCAST=false`; `paid` with a `txHash` when funded; 502 "Signed but not broadcast" when the wallet is empty; 403 when rejected on the device.

If step 1 returns a 500, the usual cause is `LLM_MODEL` not matching a model the `LLM_BASE_URL` provider offers, or a model without JSON output.
