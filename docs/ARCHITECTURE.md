# Architecture

How SocFi is put together, what protects the money, and what is not finished. The claim flow and the diagram are in the [README](../README.md#how-it-works).

"The agent" and "Kevin" mean the same thing throughout the documentation and the app. Kevin is the name the app gives the agent (`AGENT_NAME` in [`frontend/src/config.js`](../frontend/src/config.js)).

## Repository layout

| Path | What it is |
|---|---|
| [`frontend/`](../frontend/) | React + Vite web app, installable on a phone. The mock data layer, the receipt reader, every screen, and the scroll-driven landing page |
| [`frontend/src/data/`](../frontend/src/data/) | The API the screens call: `mockApi.js` (browser storage), `hybridApi.js` (mock data plus the real agent and Ledger), `schema.js` (statuses, checks, permissions), `submissions.js` (claims still being checked) |
| [`frontend/src/domain/`](../frontend/src/domain/) | Plain-code rules: the seven checks, permissions, committee-record matching, the prompt-injection scan |
| [`backend/`](../backend/) | Express + TypeScript API: the LLM agent, Ledger signing through the DMK, USDC payouts, Key Ring |
| [`pitch/`](../pitch/) | Pitch deck (`.pptx` and `.pdf`) |
| [`demo-receipts/`](../demo-receipts/) | A receipt image used in the recorded demo |
| [`docs/`](.) | This documentation |
| `.claude/`, `.agents/`, `skills-lock.json` | Ledger's `wallet-cli-usage` skill for AI coding assistants, installed from `ledgerhq/agent-skills`. Not part of the app |

## The two modes

The frontend picks its data source from `VITE_DATA_SOURCE`.

| Part | Mock mode (default, and the live demo link) | Hybrid mode (`npm run dev:hybrid`, local only) |
|---|---|---|
| Accounts, societies, claims, appeals, audit log | Browser `localStorage` | Browser `localStorage` (the same) |
| Receipt reading | In the browser: OCR, or Claude with the user's own key | In the browser (the same) |
| The agent's judgement | None. The seven code checks alone decide | Real. `backend/` calls an LLM (`POST /api/agent/audit`) |
| Ledger signing | A simulated "Hold to sign" screen | Real. An emulated Ledger Nano S Plus signs; the app mirrors its screen and buttons |
| Payment | An invented transaction hash | A real USDC transfer on Base Sepolia (a test network) |
| The agent's API key | Not applicable | Optionally sealed with Ledger Key Ring |

A third value, `firebase`, selects [`firebaseApi.js`](../frontend/src/data/firebaseApi.js). That file is a stub: every method throws "unimplemented". We planned a Firebase backend and did not build it; [HANDOVER.md](HANDOVER.md) is the contract it would have to meet.

## Who can do what

| Actor | Can | Cannot |
|---|---|---|
| Member | Submit a claim, fix or appeal a declined one | Choose where the money goes at claim time: it goes to the wallet saved on their account |
| Kevin (the agent) | Approve or decline a claim, draft the payment | Sign or send a payment. He holds no wallet key |
| Society treasurer | Decide appeals for their own society: uphold, ask for edits, or deny | Pay |
| Union treasurer | Sign or reject each payment on the Ledger | Change a claim |

## Security model

| Threat | What stops it |
|---|---|
| Hidden instructions for the AI on a receipt | The reader's output is locked to a schema and extra fields are discarded. Plain code blocks AI-directed text and wallet addresses found on a receipt ([`injection.js`](../frontend/src/domain/reader/injection.js)) |
| An altered receipt total | The line items must add up to the printed total |
| A payout to an attacker's address | Money goes only to the wallet saved on the member's account, never to an address read from a receipt. The recipient check tells the Union treasurer whether the address being paid is that saved wallet, when it was last changed, and whether it appears on the receipt ([`RecipientCheck.jsx`](../frontend/src/components/RecipientCheck.jsx)) |
| A compromised laptop or browser | The Ledger's own screen shows the real amount and recipient. A mismatch means reject on the device |
| Approving one claim and paying another | Approval is bound to one exact claim version. The per-claim cap is enforced again at signing (`MAX_CLAIM_GBP`) |
| Paying twice | A repeated signing request returns the first result, and an uncertain payment is reconciled on-chain before any retry |
| Fake committee members | A verified university email, a match against the Union's committee records, least-privilege roles, and an audit log |
| A leaked agent API key | It can be sealed with Ledger Key Ring, so it is not in plain `.env` |

What the Ledger does and does not prove: it proves that a person saw the real amount and recipient and approved them, and that software alone cannot pay. It does not prove that the saved wallet really belongs to the member. That rests on the account records, which is why the recipient check exists and why signed wallet enrolment is first on our list of [next steps](SUBMISSION.md#what-would-you-build-next-with-another-week).

## Known gaps

- **Hybrid mode trusts the browser for the payment details.** The amount and recipient are sent from the browser's mock store to the backend. The Ledger screen is the real check on them. A production backend would hold the approved claim itself and refuse to sign anything that did not match.
- **There is no database, login or email.** All claim data is in the browser, and the backend's routes are open.
- **The device is emulated and the network is a testnet.** With a physical Ledger, signing would move from the backend to the treasurer's browser (WebHID).
- **Key Ring runs on Ledger's staging service.** The machine's membership key sits on disk next to the encrypted file, and the emulator's seed is in `.env`, so this protects the API key from being shared or committed by accident, not from someone who has the whole disk.
- **The society setup pages are out of date.** They still ask each society for its own treasury wallet and Ledger. In the current flow only the Union has either.
- **A payment rejected on the device can be sent again.** The Union treasurer has no way yet to cancel it for good.
- **A claim still being checked is lost on a full page reload.** Leaving the form or switching user is safe; reloading the tab is not.
- **The double-payment guard is in memory.** It resets when the backend restarts.
- **Receipt reading on the live demo uses OCR**, which is weaker than a vision model on crumpled or angled photos.
