# Backend: the agent and the Ledger

This folder is the Express API that gives the SocFi app its real parts: the LLM agent that judges claims (Kevin), the Ledger signing and USDC payout, and Ledger Key Ring for the agent's API key. The project overview is in the [root README](../README.md); a step-by-step setup for the whole app is in [docs/RUNNING.md](../docs/RUNNING.md).

The frontend keeps all claim data in the browser. Run with `npm run dev:hybrid`, it calls this backend for two things only: the agent's verdict when a claim is submitted, and the Ledger signature when the Union treasurer pays.

## Layout

| File | What it does |
| --- | --- |
| `src/index.ts` | Routes |
| `src/agent.ts` | The agent: the prompt, the LLM call, and the limits enforced in code |
| `src/ledger.ts` | Device Management Kit and Ethereum Signer Kit, connected to the emulator |
| `src/payout.ts` | Drafts the USDC transfer, has it signed, broadcasts it |
| `src/secrets.ts` | Decrypts secrets sealed with Ledger Key Ring at start |
| `scripts/keyring.cjs` | The Key Ring commands (`npm run keyring -- …`) |
| `scripts/speculos.sh`, `scripts/speculos.ps1` | Start the emulated Ledger |
| `speculos/*.elf` | The Ledger apps the emulator runs (see [Decisions](#decisions)) |
| `src/config.ts` | Settings read from `.env` |
| `src/store.ts` | An earlier claim store, used only by the `/api/expenses` routes |

## Running it

```sh
npm install
cp .env.example .env   # then fill it in, see below
npm run speculos       # emulated Ledger (needs Docker); screen and buttons at http://127.0.0.1:5001
npm run dev            # API on http://localhost:3000
```

On Windows use `Copy-Item .env.example .env` and `npm run speculos:win`. [docs/RUNNING.md](../docs/RUNNING.md#on-windows-powershell) has the full Windows command list.

### Configuration

`.env` is git-ignored.

| Variable | What it does |
| --- | --- |
| `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL` | The agent's model. Any OpenAI-compatible provider works. Tested with Gemini (`gemini-3.1-flash-lite` through Google's OpenAI-compatible URL). Without a key the agent declines every claim. The key can be sealed with Ledger Key Ring instead of sitting here, see below. |
| `SPECULOS_SEED` | 24 words. The emulated Ledger's seed, which decides the Union wallet's address. `npm run speculos` reads it. If unset, Speculos uses its default seed, which is public. Testnet funds only. |
| `BROADCAST` | `false` stops after signing, so no funds are needed. The returned hash is the one the transaction would have had; it never reaches the chain. Default `true`. |
| `MAX_CLAIM_GBP`, `USDC_PER_GBP` | The per-claim cap (default 100) and the fixed GBP to USDC rate (default 1.27). |
| `SPECULOS_URL`, `RPC_URL`, `PORT` | Defaults: `http://127.0.0.1:5001`, `https://sepolia.base.org`, `3000`. |
| `KEYRING_API`, `KEYRING_APPLICATION_ID`, `SYNC_SPECULOS_PORT` | Key Ring settings. Defaults: Ledger's staging service, application 17, port 5002. |

### The Union wallet and funding it

- The seed phrase is the wallet's master secret. The Union wallet is the first Ethereum address derived from it (path `44'/60'/0'/0/0`). A physical Ledger keeps the seed inside the device; it is in `.env` here only because the emulator has to be told which seed to hold. The backend never sees a private key: it hands the device a transaction and gets a signature back.
- `curl localhost:3000/api/treasurer/wallet` shows the address and its ETH and USDC balances.
- It needs Base Sepolia ETH for fees (about 0.0000007 ETH per payout) and test USDC to pay out. Both are free: USDC from faucet.circle.com (choose Base Sepolia), ETH from the Coinbase Developer Platform faucet (needs a free sign-in). Alchemy's faucet wants a mainnet balance.
- Faucets give roughly 10 to 20 USDC a day, so keep real payouts small.
- Each developer's `.env` has its own seed, so each has a different Union wallet unless the seed is shared.

## The agent's key in Ledger Key Ring

The LLM API key does not have to sit in `.env`. It can be sealed: encrypted into `secrets.enc` with a key held in a Ledger Key Ring. The ring is created from the Ledger's seed, and a machine can only join it after an approval on the device. At start the backend fetches the ring's key from Ledger's Key Ring service (no device needed) and decrypts `secrets.enc` in memory. This is optional: with a plain `LLM_API_KEY` in `.env` everything works as before.

One-time setup, per machine:

```sh
npm run speculos:sync        # second emulator on :5002, running the Ledger Sync app
npm run keyring -- init      # then approve at http://127.0.0.1:5002: Right to page, Both on "Connect" and "Turn On sync"
npm run keyring -- seal      # moves LLM_API_KEY from .env into secrets.enc
```

After that the second emulator can be stopped (`docker stop speculos-sync`). `npm run dev` prints "Secrets decrypted with Ledger Key Ring", and `curl localhost:3000/api/status` shows `"agentKey": "keyring"`.

- `npm run keyring -- status` shows what is sealed. `npm run keyring -- unseal` puts the key back into `.env` and deletes `secrets.enc`.
- **If the key is also set in plain `.env`, the plain one wins.** That is the fallback if Ledger's service cannot be reached. With neither, the agent declines every claim.
- **Keep a copy of the API key somewhere else**, such as a password manager. If the service is down or the ring is reset, `secrets.enc` cannot be opened.
- `secrets.enc` and `data/` are git-ignored, so each developer seals their own key.

What this does and does not protect:

- **It protects the key from being committed, pasted or copied to a machine nobody approved.** The encrypted file is useless without ring membership, and membership needs the device.
- **It does not protect against someone who has this machine's disk.** `data/keyring.json` holds this machine's membership key (file mode 600) next to `secrets.enc`; whoever has both can decrypt. The ring's own key is never written to disk.
- **It does not protect a running backend.** Once decrypted, the key is in memory like any other.
- It runs against **Ledger's staging Key Ring service** with an **emulated** device. The emulated Ledger Sync app signs with a public test key, so production is not expected to accept it; we did not try.
- It uses Ledger Live's library `@ledgerhq/ledger-key-ring-protocol`, not the official `wallet-cli ring`, which needs a physical device over USB.

## API

The frontend uses the last three rows. The `/api/expenses` routes are this backend's own earlier claim store. The frontend does not call them; they still work and are handy for testing with curl.

| Route | Used by | What it does |
| --- | --- | --- |
| `POST /api/expenses` | curl | Body: `society`, `memberEmail`, `memberWallet`, `description`, `amountGbp`, and `receiptText` and/or `receiptImage` (data URL). Audited at once; returns the claim with `audit` and `status`. |
| `GET /api/expenses?memberEmail=`, `GET /api/expenses/:id` | curl | List claims, or fetch one. |
| `POST /api/expenses/:id/override` | curl | Body: `reason`. Only for `agent_rejected`; moves the claim to the treasurer. |
| `GET /api/treasurer/queue` | curl | Claims awaiting a decision, with flags and the USDC amount. |
| `POST /api/expenses/:id/reject` | curl | Body: `note`. |
| `POST /api/expenses/:id/pay` | curl | Drafts the transfer and waits for the device. 403 if rejected on the device. |
| `GET /api/status` | anyone | Which model the agent uses, where its key came from (`keyring`, `env` or `none`), the Key Ring id, and whether payouts are broadcast. |
| `GET /api/treasurer/wallet` | anyone | The Union wallet's address (read from the device) and its ETH and USDC balances. |
| `POST /api/agent/audit` | frontend | Body: `society` (name, category, policy, budget), `claim` (merchant, date, amount, currency, category, description), and `receiptText` and/or `receiptImage`. Returns the agent's verdict: `decision`, `reason`, `flags`. |
| `POST /api/payments/sign` | frontend | Body: `paymentId`, `recipientAddress`, `amountUsdc`. Drafts the transfer, waits for the device, broadcasts. Returns `{ txHash, broadcast }`. 403 if rejected on the device. A repeated request returns the first result instead of paying twice. |
| `GET /api/device/screenshot`, `POST /api/device/button/{left,right,both}` | frontend | The emulator's screen and buttons, shown in the app's signing screen. |

Statuses of the backend's own claims (not the frontend's): `agent_approved`, `agent_rejected`, `overridden`, `signing`, `signed`, `paid`, `treasurer_rejected`.

### Testing with curl

```sh
# The agent's verdict on a claim
curl -s -X POST localhost:3000/api/agent/audit -H 'Content-Type: application/json' -d '{
  "society": {"name": "Chess Society", "category": "Games"},
  "claim": {"merchant": "Argos", "date": "2026-10-08", "amount": 25, "currency": "GBP",
            "category": "equipment", "description": "Two chess clocks for weekly meetings"},
  "receiptText": "Argos, 08/10/2026. 2x DGT chess clock. Total 25.00 GBP"
}'

# Sign a payment. This stays open until the device is used.
curl -s -X POST localhost:3000/api/payments/sign -H 'Content-Type: application/json' -d '{
  "paymentId": "test-1", "recipientAddress": "0x17f2348121a79F7553959846BA6375F02faA8047", "amountUsdc": 1
}'
```

For the second command, open http://127.0.0.1:5001, press the right button through the screens, and press both buttons on "Sign transaction" (or on "Reject transaction", one screen further).

## Decisions

- **TypeScript on Node, with Express.** Ledger's DMK is TypeScript.
- **USDC on Base Sepolia** (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`). The emulated device clear-signs it: it shows the token amount, the recipient and "Base Sepolia".
- **GBP to USDC** uses a fixed placeholder rate (`USDC_PER_GBP`), not a live feed.
- **No physical Ledger.** We use the Speculos emulator as a Nano S Plus. Two app binaries are bundled in `speculos/`: Ledger's Ethereum app v1.22.5, built from [LedgerHQ/app-ethereum](https://github.com/LedgerHQ/app-ethereum), and Ledger Sync v1.4.2, built from [LedgerHQ/app-ledger-sync](https://github.com/LedgerHQ/app-ledger-sync). `ETH_APP_ELF=/path/to/app.elf npm run speculos` uses a different Ethereum build.
- **The DMK runs in the backend** and talks to Speculos over HTTP. With a real device it would move to the treasurer's browser (WebHID); the backend would then only draft the unsigned transaction and broadcast the signed one.
- **LLM through the OpenAI SDK**, with the base URL and model configurable, so any OpenAI-compatible provider works.
- **Hard limits in code**, applied whatever the model says: the per-claim cap, and the claimed amount may not exceed the receipt total. The cap is applied again at signing, in USDC.
- **Hybrid, not Firebase.** The frontend was designed for a Firebase backend of about 35 methods. We did not build it. The frontend keeps its mock data layer, and only the agent and the Ledger are real.
- **Our own seed for the emulator**, not Speculos' public default.

## What has been verified

- The DMK connects to Speculos from Node and reads the Union wallet's address.
- Signing: the device shows the USDC amount, recipient and network in clear. Confirming returns a signed transaction; rejecting returns 403.
- **Real payouts** (first on 2026-10-12): a claim submitted in the frontend, approved by the agent, signed on the emulated device and paid in USDC on Base Sepolia.
- **The LLM agent**, with a Gemini key: it approves and declines with reasons and uses the society context. It declined baking ingredients claimed as a "team dinner" for the Blockchain Society, and a lunch receipt photo that included beer.
- `POST /api/payments/sign`: sign, reject (403), a repeated request returning the first result, the per-claim cap, and recipient addresses in any letter case.
- The backend reconnects on its own after the emulator is restarted.
- **Ledger Key Ring** (2026-10-13): joining the ring with an approval on the emulated device, sealing and unsealing, and a fresh backend start that decrypted the LLM key and ran the agent with it, with no device running.

Not verified: a payout larger than the wallet's USDC balance (expected: mined, reverted, and reported as an error).

Not built:

- Accounts or authentication. Routes are open.
- Checking a payment against a stored, approved claim. The amount and recipient come from the browser; the device screen is the check on them.
- Persistence for `POST /api/payments/sign`. Its record of sent payments is in memory, so the double-payment guard resets when the backend restarts.
- Key Ring on Ledger's production service or with a physical device.

## Gotchas

- **Port 5000 is taken on macOS** by AirPlay Receiver, so Speculos' API is mapped to 5001.
- **Speculos needs `--pki-prod`.** Without it the device rejects Ledger's token metadata (`ProvidePkiCertificateCommandError 5720`), falls back to blind signing, and fails with `6a80 Invalid data` because blind signing is off.
- **The Speculos transport is HTTP, not the APDU TCP port.** `speculosTransportFactory(url)` takes the REST API URL. Its device model defaults to Stax; we pass `DeviceModelId.NANO_SP`.
- **The Ethereum signer is a separate package**, `@ledgerhq/device-signer-kit-ethereum`. The DMK entry point is `DeviceManagementKitBuilder`.
- **The default Speculos seed is public.** Its first address already has other people's transactions on Base Sepolia. Put your own 24 words in `.env` as `SPECULOS_SEED`.
- **`npm run speculos` replaces the running emulator.** Changing the seed means restarting it; the backend reconnects by itself.
- **With the key sealed, every backend start calls Ledger's staging service**, including each automatic restart when a source file is saved.
- **`tsx` cannot load `@ledgerhq/ledger-key-ring-protocol`**, so the Key Ring code is plain CommonJS run by `node` in a child process.
- Device buttons can be driven over HTTP: `POST /button/{left,right,both}` on the Speculos API with `{"action":"press-and-release"}`. The current screen text is at `GET /events?currentscreenonly=true`.

Our feedback for Ledger on all of the above is in [docs/SUBMISSION.md](../docs/SUBMISSION.md).
