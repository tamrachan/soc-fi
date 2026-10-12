# Context: society expense handler (N3XT Hackathon @ OP3N 2026)

## Hackathon

- **Challenge:** build an AI agent / AI-powered product using the Ledger Agent Stack, a Ledger signer, and/or Key Ring. One unified challenge, no tracks. Any AI model or provider.
- **Dates (CEST):** kickoff Oct 7 15:00 · **submissions close Oct 13 23:59** · review Oct 14–15 · finalists announced Oct 15 · live pitch Oct 16 15:00 at Ledger HQ, Paris.
- **Submission (all three required):** the form (https://forms.gle/TcmwuFQMGfyEcuNd6, edit rather than resubmit) · a post on X or LinkedIn from the club account with #LedgerN3XTCollab tagging @Ledger · GitHub repo link + short demo video.
- **Also required:** a blunt developer-experience write-up (where docs lost us, confusing workflows, missing context, one concrete suggestion). Running notes are at the bottom of this file.
- **Pre-existing code** must be disclosed (anything from before Oct 7), or the team is disqualified.
- **Pitch:** 5 min presentation + 5 min questions, two presenters, both in the room.
- **Jury:** Ian Rogers (Chief Human Agency Officer, Ledger), Guillaume Mathias (VP Product, Ledger), Joshua Mo (DevRel Lead, Venice), Drake Breeding (Director, Ecosystem Arc, Circle).
- **Prizes:** €2,500 / €1,500 / €1,000.

### Scoring

| Criterion | Weight |
| --- | --- |
| Technical execution | 25% |
| Usefulness and relevance for Ledger | 20% |
| Innovation / originality | 20% |
| User experience | 15% |
| New use cases possible for Ledger | 10% |
| Clarity, presentation and documentation | 10% |

What they say they like: real user value over a generic demo; an explicitly named boundary between what the agent does on its own and what a human approves; a Ledger primitive actually implemented; a demonstration that device-backed trust matters; runnable code or a recorded walkthrough.

### Ledger docs

- Overview: https://developers.ledger.com/docs/ai-tools/overview
- Ledger CLI / Agent Stack: https://developers.ledger.com/docs/ai-tools/ledger-cli (Key Ring: `#key-ring`)
- DMK Skills: https://developers.ledger.com/docs/ai-tools/ledger-dmk-skills
- Signer: https://developers.ledger.com/docs/device-interaction/dmk-ts/integration/how_to/how_to_use_a_signer
- DMK integration: https://developers.ledger.com/docs/device-interaction/dmk-ts/integration/how_to/dmk
- Clear Signing: https://developers.ledger.com/docs/clear-signing/overview
- Walkthrough video (ignore its tracks, prizes and dates): https://www.youtube.com/watch?v=328z0_foOi4

## Product

A university society expense handler. The students' union holds funds in a Ledger wallet; committee members claim expenses back in stablecoin.

1. The union holds a Ledger wallet.
2. A committee member uploads a receipt and gives their crypto address.
3. An AI model reads the receipt.
4. The agent decides whether the claim is valid for that society.
5. If the agent approves, the payment goes straight to the union treasurer. No society treasurer reviews it.
6. If the agent declines, the member can fix and resubmit, or appeal. An appeal is the only time a society treasurer is involved: they uphold or deny it.
7. The union treasurer, the only person with a Ledger, checks that the amount and recipient on the device match the claim and signs. The money goes to the member's wallet.

**The boundary (name this in the pitch):** the agent reads the receipt, decides validity on its own, and drafts the transfer. It cannot move money. Only the treasurer's confirmation on the device, where the amount, recipient and network are shown in clear, authorises a payout. The treasurer is a check against malicious transfers, not a second auditor.

## Team split

- Frontend: React (teammates).
- Backend and Ledger integration: this repo.

## Decisions

- **TypeScript on Node, Express.** Ledger's DMK is TypeScript, and types can be shared with the React frontend.
- **USDC on Base Sepolia** (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`). The emulated device clear-signs it ("Amount 32.5 ttUSDC · Network Base Sepolia"). tGBP was not tried.
- **GBP to USDC** uses a fixed placeholder rate (`USDC_PER_GBP`, default 1.27, matching the frontend mock), not a live feed.
- **No physical Ledger:** we use the Speculos emulator (Nano S Plus). The app binary is bundled at `speculos/ethereum-nanosp.elf`: it is Ledger's Ethereum app v1.22.5, built from [LedgerHQ/app-ethereum](https://github.com/LedgerHQ/app-ethereum) for the Nano S Plus. `ETH_APP_ELF=/path/to/app.elf npm run speculos` uses a different build.
- **The DMK runs in the backend** and talks to Speculos over HTTP. With a real device it would have to move to the treasurer's browser (WebHID); the backend would then only draft the unsigned transaction and broadcast the signed one.
- **LLM:** OpenAI SDK, with base URL and model configurable, so any OpenAI-compatible provider works.
- **Hard limits in code**, applied whatever the model says: per-claim cap (`MAX_CLAIM_GBP`), claimed amount may not exceed the receipt total.

## Current state

Layout: `src/config.ts` (env), `src/agent.ts` (audit), `src/ledger.ts` (DMK + Ethereum signer), `src/payout.ts` (USDC transfer drafting and broadcast), `src/store.ts` (claims, persisted to `data/expenses.json`), `src/index.ts` (routes).

### Running it

```sh
npm run speculos   # emulated Ledger (needs Docker); screen and buttons at http://127.0.0.1:5001
cp .env.example .env   # add LLM_API_KEY
npm run dev        # API on http://localhost:3000
```

### With the frontend

The React app stays on its mock data; two steps are real: the agent's verdict when a claim is submitted, and the Ledger signature. With the emulator and API running:

```sh
cd ../frontend && VITE_DATA_SOURCE=hybrid npm run dev
```

In the "Viewing as" switcher, the Union treasurer (Robin Calder) is the only persona who can sign: Payments, open a claim, "Open Ledger prompt" sends the transfer to the emulated device. The modal mirrors its screen and buttons; signing or rejecting there decides the payment. The amount and recipient come from the browser's mock store, so the device screen is the only real check on them.

### API

| Route | Who | What |
| --- | --- | --- |
| `POST /api/expenses` | member | Body: `society`, `memberEmail`, `memberWallet`, `description`, `amountGbp`, and `receiptText` and/or `receiptImage` (data URL). Audited immediately; returns the claim with `audit` and `status`. |
| `GET /api/expenses?memberEmail=` | member | List claims. |
| `GET /api/expenses/:id` | both | One claim. |
| `POST /api/expenses/:id/override` | member | Body: `reason`. Only for `agent_rejected`; moves it to the treasurer. |
| `GET /api/treasurer/queue` | treasurer | Claims awaiting a decision, with flags and USDC amount. |
| `GET /api/treasurer/wallet` | treasurer | Treasury address (read from the device) and ETH / USDC balances. |
| `POST /api/expenses/:id/reject` | treasurer | Body: `note`. |
| `POST /api/expenses/:id/pay` | treasurer | Drafts the transfer and waits for the device. Stays open until the treasurer confirms or rejects. 403 if rejected on the device. |
| `POST /api/agent/audit` | frontend (hybrid) | Body: `society` (name, category, policy, budget), `claim` (merchant, date, amount, currency, category, description), `receiptText` and/or `receiptImage`. Returns the agent's verdict (`decision`, `reason`, `flags`). |
| `POST /api/payments/sign` | frontend (hybrid) | Body: `paymentId`, `recipientAddress`, `amountUsdc`. Drafts the transfer, waits for the device, broadcasts. Returns `{ txHash, broadcast }`. 403 if rejected on the device; a repeated request returns the first result instead of paying twice (kept in memory only). |
| `GET /api/device/screenshot`, `POST /api/device/button/{left,right,both}` | frontend (hybrid) | The emulator's screen and buttons, shown in the signing modal. |

Statuses: `agent_approved`, `agent_rejected`, `overridden`, `signing`, `signed`, `paid`, `treasurer_rejected`.

### Verified

- DMK connects to Speculos from Node and reads the treasury address.
- `pay` end to end with `BROADCAST=false`: the device shows the USDC amount, recipient and network in clear; confirming returns a signed transaction, rejecting returns 403 and leaves the claim in the queue.
- Submit, override and queue routes.

### Not verified yet

- **The LLM audit path.** No API key was available, so only the no-key fallback ran (it rejects everything with a "receipt was not read" flag).
- **Broadcasting.** The treasury address has no USDC and almost no ETH on Base Sepolia.

### Not built

- Accounts / auth. Routes are open and members are identified by the email in the request body.
- Treasurer email on override. `notifyTreasurer` in `src/index.ts` only logs.
- Any use of the Ledger CLI / Key Ring (e.g. keeping the LLM key in it).

## Gotchas

- **Port 5000 is taken on macOS** by AirPlay Receiver, so Speculos' API is mapped to 5001.
- **Speculos needs `--pki-prod`.** Without it the device rejects Ledger's token metadata (`ProvidePkiCertificateCommandError 5720`), falls back to blind signing, and fails with `6a80 Invalid data` because blind signing is off.
- **The Speculos transport is HTTP, not the APDU TCP port.** `speculosTransportFactory(url)` takes the REST API URL. Its device model defaults to Stax; we pass `DeviceModelId.NANO_SP`.
- **The Ethereum signer is a separate package**, `@ledgerhq/device-signer-kit-ethereum`. There is no `LedgerDeviceManagementKit` class; it is `DeviceManagementKitBuilder`.
- **The default Speculos seed is public.** Its first address (`0xDad77910DbDFdE764fC21FCD4E74D71bBACA6D8D`) already has other people's transactions on Base Sepolia. Testnet only. To use our own, run `SPECULOS_SEED="..." npm run speculos`.
- Device buttons can be driven over HTTP: `POST /button/{left,right,both}` with `{"action":"press-and-release"}`; the current screen text is at `GET /events?currentscreenonly=true`.

## Developer-experience notes (for the submission write-up)

- Nothing in the Signer docs says Speculos must be started with `--pki-prod` for clear signing; the visible error (`6a80 Invalid data`) points nowhere near the cause.
- The Speculos transport's constructor arguments (HTTP URL, model defaulting to Stax) had to be read from the type definitions.
- Speculos' default API port collides with macOS AirPlay.
