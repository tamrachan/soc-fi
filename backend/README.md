# Backend: the agent and the Ledger (N3XT Hackathon @ OP3N 2026)

This folder is the Express API that gives the SocFi frontend its two real parts: the LLM agent that judges claims, and the Ledger signing and payout. The project overview, the claim flow and the demo script are in the [root README](../README.md). This file covers the hackathon brief, how to run and configure the backend, its API, and what we learned.

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

- Frontend: React, in `../frontend`. It keeps all claim data in the browser (mock) and calls this backend for the agent's verdict and the Ledger signature when run with `VITE_DATA_SOURCE=hybrid`.
- Backend and Ledger integration: this folder.

## Decisions

- **TypeScript on Node, Express.** Ledger's DMK is TypeScript, and types can be shared with the React frontend.
- **USDC on Base Sepolia** (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`). The emulated device clear-signs it ("Amount 32.5 ttUSDC · Network Base Sepolia"). tGBP was not tried.
- **GBP to USDC** uses a fixed placeholder rate (`USDC_PER_GBP`, default 1.27, matching the frontend mock), not a live feed.
- **No physical Ledger:** we use the Speculos emulator (Nano S Plus). The app binary is bundled at `speculos/ethereum-nanosp.elf`: it is Ledger's Ethereum app v1.22.5, built from [LedgerHQ/app-ethereum](https://github.com/LedgerHQ/app-ethereum) for the Nano S Plus. `ETH_APP_ELF=/path/to/app.elf npm run speculos` uses a different build.
- **The DMK runs in the backend** and talks to Speculos over HTTP. With a real device it would have to move to the treasurer's browser (WebHID); the backend would then only draft the unsigned transaction and broadcast the signed one.
- **LLM:** OpenAI SDK, with base URL and model configurable, so any OpenAI-compatible provider works.
- **Hard limits in code**, applied whatever the model says: per-claim cap (`MAX_CLAIM_GBP`), claimed amount may not exceed the receipt total. The cap is applied again at signing, in USDC.
- **Hybrid, not Firebase.** The frontend was designed for a Firebase backend of about 35 methods. We did not build it. The frontend keeps its mock data layer and only the agent and the Ledger are real.
- **Our own seed for the emulator.** The treasury address comes from `SPECULOS_SEED` in `.env`, not from Speculos' public default seed.

## Current state

Layout: `src/config.ts` (env), `src/agent.ts` (audit), `src/ledger.ts` (DMK + Ethereum signer), `src/payout.ts` (USDC transfer drafting and broadcast), `src/store.ts` (claims, persisted to `data/expenses.json`), `src/index.ts` (routes).

### Running it

```sh
npm install
cp .env.example .env   # then fill it in, see below
npm run speculos       # emulated Ledger (needs Docker); screen and buttons at http://127.0.0.1:5001
npm run dev            # API on http://localhost:3000
```

On Windows use `Copy-Item .env.example .env` and `npm run speculos:win` (a PowerShell copy of `scripts/speculos.sh`). The [root README](../README.md#on-windows-powershell) has the full Windows command list.

`.env` (git-ignored):

| Variable | What it does |
| --- | --- |
| `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` | The agent's model. Any OpenAI-compatible provider. Tested with Gemini (`gemini-3.1-flash-lite` through Google's OpenAI-compatible URL). Without a key the agent declines everything. |
| `SPECULOS_SEED` | 24 words. The emulated Ledger's seed, which decides the treasury address. `npm run speculos` reads it. Unset means Speculos' public default seed. Testnet funds only. |
| `BROADCAST` | `false` stops after signing, so no funds are needed; the returned hash is real but never reaches the chain. Default `true`. |
| `MAX_CLAIM_GBP`, `USDC_PER_GBP` | Per-claim cap (default 100) and the fixed GBP to USDC rate (default 1.27). |
| `SPECULOS_URL`, `RPC_URL`, `PORT` | Defaults: `http://127.0.0.1:5001`, `https://sepolia.base.org`, `3000`. |

### The treasury wallet and funding it

- The seed phrase is the wallet's master secret; the treasury address is the first Ethereum address derived from it (path `44'/60'/0'/0/0`). A physical Ledger keeps the seed inside the device. It is in `.env` only because the emulator has to be told which seed to hold. The backend never sees a private key: it hands the device a transaction and gets a signature back.
- `curl localhost:3000/api/treasurer/wallet` shows the address and its ETH and USDC balances.
- It needs Base Sepolia ETH for fees (about 0.0000007 ETH per payout) and test USDC to pay out. Both are free: USDC from faucet.circle.com (choose Base Sepolia), ETH from the Coinbase Developer Platform faucet (needs a free sign-in). Alchemy's faucet wants a mainnet balance.
- Faucets give roughly 10 to 20 USDC a day, so keep real payouts small. A transfer larger than the balance is mined and reverts; `broadcast` reports that as an error.
- Each developer's `.env` has its own seed, so each has a different treasury address unless the seed is shared.

### With the frontend

The React app stays on its mock data; two steps are real: the agent's verdict when a claim is submitted, and the Ledger signature. With the emulator and API running:

```sh
cd ../frontend && VITE_DATA_SOURCE=hybrid npm run dev
```

Submitting a claim calls `POST /api/agent/audit`; if this backend is not running, the submit fails. In the "Viewing as" switcher, the Union treasurer (Robin Calder) is the only persona who can sign: Payments, open a claim, "Open Ledger prompt" sends the transfer to the emulated device. The modal mirrors its screen and buttons; signing or rejecting there decides the payment. The amount and recipient come from the browser's mock store, so the device screen is the only real check on them.

### API

The frontend uses only the last four rows. The `/api/expenses` routes are this backend's own earlier claim store, which the frontend does not call; they still work and are handy for testing with curl.

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

Statuses of the backend's own claims (not the frontend's): `agent_approved`, `agent_rejected`, `overridden`, `signing`, `signed`, `paid`, `treasurer_rejected`.

### Verified

- DMK connects to Speculos from Node and reads the treasury address.
- Signing: the device shows the USDC amount, recipient and network in clear; confirming returns a signed transaction, rejecting returns 403.
- **A real payout** (2026-10-12): a claim submitted in the frontend, approved by the agent, signed on the emulated device and paid in USDC on Base Sepolia.
- **The LLM agent**, with a Gemini key: it approves and declines with reasons, and uses the society context (it declined baking ingredients claimed as a "team dinner" for the Blockchain Society).
- `POST /api/payments/sign`: sign, reject (403), a repeated request returning the first result, and the per-claim cap.
- The backend reconnects on its own after the emulator is restarted.
- The frontend's claim, appeal and payment logic, by script. Not every screen has been clicked through.

### Not verified yet

- **Receipt images** sent to the agent. Only receipt text has been tried.
- A payout larger than the wallet's USDC balance (expected: mined, reverted, reported as an error).

### Not built

- Accounts / auth. Routes are open and members are identified by the email in the request body.
- Treasurer email on override. `notifyTreasurer` in `src/index.ts` only logs.
- Any use of the Ledger CLI / Key Ring (e.g. keeping the LLM key in it).
- Persistence for `POST /api/payments/sign`. Its record of sent payments is in memory, so the double-pay guard resets when the backend restarts.

## Gotchas

- **Port 5000 is taken on macOS** by AirPlay Receiver, so Speculos' API is mapped to 5001.
- **Speculos needs `--pki-prod`.** Without it the device rejects Ledger's token metadata (`ProvidePkiCertificateCommandError 5720`), falls back to blind signing, and fails with `6a80 Invalid data` because blind signing is off.
- **The Speculos transport is HTTP, not the APDU TCP port.** `speculosTransportFactory(url)` takes the REST API URL. Its device model defaults to Stax; we pass `DeviceModelId.NANO_SP`.
- **The Ethereum signer is a separate package**, `@ledgerhq/device-signer-kit-ethereum`. There is no `LedgerDeviceManagementKit` class; it is `DeviceManagementKitBuilder`.
- **The default Speculos seed is public.** Its first address (`0xDad77910DbDFdE764fC21FCD4E74D71bBACA6D8D`) already has other people's transactions on Base Sepolia. Put your own 24 words in `.env` as `SPECULOS_SEED`; `npm run speculos` reads it. `GET /api/treasurer/wallet` then shows the address to fund. Testnet funds only.
- **`npm run speculos` replaces the running emulator.** Changing the seed means restarting it; the backend reconnects by itself.
- **A hash with `BROADCAST=false` will not resolve on the explorer.** It is the hash the transaction would have had.
- Device buttons can be driven over HTTP: `POST /button/{left,right,both}` with `{"action":"press-and-release"}`; the current screen text is at `GET /events?currentscreenonly=true`.

## Developer-experience notes (for the submission write-up)

- Nothing in the Signer docs says Speculos must be started with `--pki-prod` for clear signing; the visible error (`6a80 Invalid data`) points nowhere near the cause.
- The Speculos transport's constructor arguments (HTTP URL, model defaulting to Stax) had to be read from the type definitions.
- Speculos' default API port collides with macOS AirPlay.
