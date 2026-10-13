# Running SocFi

The short version is in the [README](../README.md#how-to-run-it). This page has the full setup, Windows commands, wallets and troubleshooting. Backend settings, Key Ring setup and API routes are in [backend/README.md](../backend/README.md).

## 1. The app alone (mock mode)

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm run build      # outputs frontend/dist
```

Everything runs on mock data saved in the browser. Use the **Viewing as** bar at the top to switch between demo personas, and **Reset** to start over. Run locally, the app opens signed in as Amara; the deployed demo opens signed out on the landing page.

## 2. The full flow (hybrid mode)

This adds the real agent, the emulated Ledger and a real testnet payout. You need Docker and an API key for any OpenAI-compatible LLM. Use three terminals.

```bash
# One-time setup
cd backend && npm install && cp .env.example .env    # then edit .env, see below
cd ../frontend && npm install

# Terminal 1: emulated Ledger (screen and buttons also at http://127.0.0.1:5001)
cd backend && npm run speculos

# Terminal 2: API on http://localhost:3000
cd backend && npm run dev

# Terminal 3: the app
cd frontend && npm run dev:hybrid
```

In `backend/.env`, set `LLM_API_KEY` (and `LLM_BASE_URL` / `LLM_MODEL` if you are not using OpenAI), and set `SPECULOS_SEED` to 24 words of your own. The seed decides the Union wallet's address. [backend/README.md](../backend/README.md#configuration) lists every variable.

Then:

1. As **Amara**, submit a claim. Kevin's verdict appears as an eighth check, "Kevin: a reasonable expense for this society".
2. As **Robin Calder** (Union treasurer), open **Payments**, open the claim and click **Open Ledger prompt**.
3. Press **Right** to page through the amount, recipient and network on the device, then **Both** on "Sign transaction" (or on "Reject transaction", one screen further).
4. The claim's transaction link opens the transfer on sepolia.basescan.org.

### On Windows (PowerShell)

Windows PowerShell 5.1 has no `&&`, `cp` or inline `VAR=value`, and `npm run speculos` runs a shell script that Windows cannot execute. Use these instead, one terminal each:

```powershell
# One-time setup
cd backend
npm install
Copy-Item .env.example .env          # then edit .env
cd ..\frontend
npm install

# Terminal 1: emulated Ledger (needs Docker Desktop running)
cd backend
npm run speculos:win

# Terminal 2: API
cd backend
npm run dev

# Terminal 3: the app
cd frontend
npm run dev:hybrid
```

| macOS / Linux | Windows PowerShell |
|---|---|
| `a && b` | `a; if ($?) { b }`, or put them on separate lines |
| `cp .env.example .env` | `Copy-Item .env.example .env` |
| `ETH_APP_ELF=/path/app.elf npm run speculos` | `$env:ETH_APP_ELF='C:\path\app.elf'; npm run speculos:win` |
| `curl localhost:3000/api/treasurer/wallet` | `Invoke-RestMethod http://localhost:3000/api/treasurer/wallet` (or `curl.exe …`) |

`$env:NAME='value'` lasts until you close that terminal. PowerShell 7 (`pwsh`) does support `&&`. The Key Ring setup has no Windows script; it is optional.

## 3. Wallets

- **The Union wallet** is the first address of the emulated Ledger, derived from `SPECULOS_SEED`. Each developer has a different one unless they share a seed. `curl localhost:3000/api/treasurer/wallet` shows the address and its balances.
- **Funding it.** It needs a little Base Sepolia ETH for fees and test USDC to pay out. Both are free: USDC from faucet.circle.com (choose Base Sepolia), ETH from the Coinbase Developer Platform faucet. Faucets give roughly 10 to 20 USDC a day, so keep real payouts small.
- **The "From" label.** Set `VITE_UNION_TREASURY_WALLET` in `frontend/.env.local` to the Union wallet's address. It only changes what the app displays, not where money comes from.
- **Members' wallets.** The demo personas' addresses in [`users.json`](../frontend/src/data/mock/users.json) were generated for this project. One team member holds their recovery phrase, so test USDC paid to them can be sent back to the Union wallet. A new account types its own address at sign-up.
- Payments always go to the claimant's saved wallet, never to an address found on a receipt.

## 4. Things that catch people out

- **Submitting a claim never touches the Ledger.** The device is prompted only when the Union treasurer opens the Ledger prompt.
- **In hybrid mode, submitting fails if the backend is not running.** A claim is never let through unjudged.
- **A payment larger than the Union wallet's USDC balance is signed, mined and then reverts.** The app shows an error. To see a real payout, claim a small amount; partial claims are allowed. The seeded claims (CLM-0004 to CLM-0006) are too large to pay from a faucet-funded wallet: sign those in mock mode, or with `BROADCAST=false` in `backend/.env`.
- **The backend refuses to sign a claim above its own cap** (`MAX_CLAIM_GBP`, default £100), whatever the frontend says.
- **Seed data changes need Reset.** The mock data is copied into the browser on first load.

## 5. Receipt reader

- **Default: on-device OCR.** Tesseract.js runs in the browser. There is no key and no cost, and the photo does not leave the device at this step. The first read downloads about 10 MB of OCR data.
- **Optional: Claude vision.** More accurate on crumpled or angled photos and on PDFs. In the app go to **Me → Receipt reader**, choose Claude and paste an Anthropic API key. The key is stored in that browser only; use one with a low spend limit.
- **In hybrid mode Kevin also sees the photo.** On submit, an uploaded image is sent to the backend's LLM along with the text the reader extracted.
- **Test receipts.** Open `#/demo/receipts` on a laptop and photograph one with a phone using **Scan**, or pick one from the sample list on the claim form.

## 6. On a phone

Open the live demo on a phone, then **Share → Add to Home Screen** (iOS) or **Install app** (Android). It opens full-screen with a bottom tab bar. The centre **Scan** button opens the camera. Photos are compressed on the phone before upload.

## 7. Deploying the live demo

[`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml) builds `frontend/` in mock mode and publishes it to GitHub Pages on every push to `main` that touches `frontend/`. One-time setup: **Repo → Settings → Pages → Source: GitHub Actions**. Routing uses `#/…` URLs, so deep links work.
