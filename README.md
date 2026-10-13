# SocFi — Society Finance, secured.

An AI agent checks student-society expense claims in seconds and decides them on its own, but it can't pay anyone. Only the Union treasurer's Ledger can release the money. See [`Context/CONTEXT.md`](Context/CONTEXT.md) and [`user_flows.md`](user_flows.md).

## How a claim flows

1. **A member submits** a receipt and confirms every field.
2. **The agent decides.** Seven plain-code checks run, and (when the backend is connected) an LLM agent judges whether the expense is reasonable for that society, using the society's profile, policy and budget.
3. **Approved:** a USDC payment is drafted and goes straight to the Union treasurer. No society treasurer looks at it.
4. **Declined:** the member can fix and resubmit, or appeal with a reason. An appeal is the only time a society treasurer is involved; they uphold it, deny it or ask for edits. A receipt flagged for tampering can't be appealed.
5. **The Union treasurer signs** on the Ledger. They are the only person who can pay, and their job is narrow: check that the amount and recipient on the device match the claim.

**The boundary:** the agent reads, audits and drafts the transfer. It cannot move money. Only a confirmation on the Ledger, where the amount, recipient and network are shown in clear, authorises a payout.

## What is real and what is mock

| Part | Mock mode (`VITE_DATA_SOURCE=mock`, GitHub Pages) | Hybrid mode (`VITE_DATA_SOURCE=hybrid`, local only) |
|---|---|---|
| Accounts, societies, claims, appeals, audit log | Browser `localStorage` | Browser `localStorage` (same) |
| Receipt reading | In the browser (OCR or Claude) | In the browser (same) |
| The agent's judgement | None: the seven checks alone decide | Real: `backend/` calls an LLM (`POST /api/agent/audit`) |
| Ledger signing | Simulated "Hold to sign" modal | Real: an emulated Ledger Nano S Plus signs; the modal mirrors its screen and buttons |
| Payment | Invented transaction hash | Real USDC transfer on Base Sepolia (a test network, no real money) |
| The agent's API key | n/a | Optionally sealed with Ledger Key Ring (staging service, emulated device) instead of plain `.env` |

There is no Firebase backend. `VITE_DATA_SOURCE=firebase` still exists but every method throws "unimplemented".

## Running it

### Front-end only (mock)

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm run build      # outputs frontend/dist
```

The app runs entirely on mock data saved in your browser. Use the **Viewing as** bar at the top to switch personas, and **Reset** to start over.

### Full demo: agent + Ledger (hybrid)

Needs Docker (for the Ledger emulator) and three terminals. Details, environment variables and troubleshooting are in [`backend/README.md`](backend/README.md).

```bash
cd backend && npm install && cp .env.example .env    # then set LLM_API_KEY (and SPECULOS_SEED)
npm run speculos                                     # 1. emulated Ledger
npm run dev                                          # 2. API on http://localhost:3000
cd ../frontend && npm run dev:hybrid                    # 3. the app (same as VITE_DATA_SOURCE=hybrid npm run dev)
```

#### On Windows (PowerShell)

Windows PowerShell 5.1 has no `&&`, `cp` or inline `VAR=value`. `npm run speculos` also runs a shell script that Windows can't execute. Use these instead, one terminal each:

```powershell
# One-time setup
cd backend
npm install
Copy-Item .env.example .env          # then edit .env: LLM_API_KEY, and your own SPECULOS_SEED
cd ..\frontend
npm install

# Terminal 1: emulated Ledger (needs Docker Desktop running)
cd backend
npm run speculos:win

# Terminal 2: API on http://localhost:3000
cd backend
npm run dev

# Terminal 3: the app in hybrid mode (works on every OS)
cd frontend
npm run dev:hybrid
```

Other commands from the docs, translated:

| macOS / Linux | Windows PowerShell |
|---|---|
| `a && b` | `a; if ($?) { b }`, or put them on separate lines |
| `cp .env.example .env` | `Copy-Item .env.example .env` |
| `VITE_DATA_SOURCE=hybrid npm run dev` | `npm run dev:hybrid`, or `$env:VITE_DATA_SOURCE='hybrid'; npm run dev` |
| `ETH_APP_ELF=/path/app.elf npm run speculos` | `$env:ETH_APP_ELF='C:\path\app.elf'; npm run speculos:win` |
| `curl localhost:3000/api/treasurer/wallet` | `Invoke-RestMethod http://localhost:3000/api/treasurer/wallet` (or `curl.exe …`) |
| `curl -X POST … -H 'Content-Type: application/json' -d '{…}'` | `Invoke-RestMethod -Method Post http://localhost:3000/… -ContentType 'application/json' -Body '{…}'` |

`$env:NAME='value'` lasts until you close that terminal. PowerShell 7 (`pwsh`) does support `&&`.

Then:

1. As **Amara**, submit a claim. The agent's verdict appears as an eighth check, "Agent: a reasonable expense for this society".
2. As **Robin Calder (Union treasurer)**, open **Payments**, open the claim, and click **Open Ledger prompt**.
3. In the modal, press **Right** to page through the amount, recipient and network on the device, then **Both** on "Sign transaction" (or on "Reject transaction", one screen further).
4. The claim's transaction link opens the real transfer on sepolia.basescan.org.

Things that catch people out:

- **Submitting a claim never touches the Ledger.** The device is only prompted when the Union treasurer opens the Ledger prompt.
- **If the backend isn't running, submitting fails** in hybrid mode. A claim is never let through unjudged.
- **The Union wallet holds only a little test USDC** (about 19 at the time of writing). A payment larger than the balance is signed, mined and then reverts, and the modal shows an error. For a real payout, claim a small part of a receipt (partial claims are allowed), e.g. £5. The seeded claims (CLM-0004 to 0006) are far too large to pay for real; sign those in mock mode, or with `BROADCAST=false` in `backend/.env`.
- **Large claims are refused at signing** by the backend's own cap (`MAX_CLAIM_GBP` in `backend/.env`, default £100), whatever the frontend says.

## People and wallets

| Persona | Role | Can do |
|---|---|---|
| Amara Okafor | Member | Submit claims, fix or appeal declined ones |
| Robin Calder | **Union treasurer** (`user.unionRole: 'treasurer'`) | The only one with **Payments** and the Ledger prompt. Sees every claim that has a payment |
| Jonah Whitfield, Elena Marsh | Society treasurers | **Appeals** only, for their own society. Cannot pay |
| Priya Raman | Logistics coordinator | View society claims |
| Sam Lindqvist | Society treasurer, FinTech | Society setup (not yet enabled) |

- **The Union wallet** is the first address of the emulated Ledger. It comes from the seed phrase in `backend/.env` (`SPECULOS_SEED`), so each developer's emulator has its own unless they share a seed. `curl localhost:3000/api/treasurer/wallet` shows the address and its balances. Set `VITE_UNION_TREASURY_WALLET` in `frontend/.env.local` to the same address; that variable only changes the "From" label, not where money comes from.
- **Members' wallets.** The demo personas' addresses in [`frontend/src/data/mock/users.json`](frontend/src/data/mock/users.json) were generated for this project on 2026-10-13, from one recovery phrase held by the developer who generated them (in the git-ignored `backend/data/demo-wallets.json`). Nobody else can move test USDC paid to them. A new account types its own address at sign-up.
- Payments always go to the claimant's saved wallet, never to an address found on a receipt.

Backend developers: [`HANDOVER.md`](HANDOVER.md) has the schemas, status machine and API contract, with a 2026-10-12 changelog entry for everything above.

## Front-end notes

### Deploying the demo (GitHub Pages)

`.github/workflows/deploy-pages.yml` builds `frontend/` and publishes it on every push to `main` that touches `frontend/`.
One-time setup: **Repo → Settings → Pages → Source: GitHub Actions**.
The site will be at `https://tamrachan.github.io/ledger-hackathon/`. Routing uses `#/…` URLs, so deep links work on Pages.

### On a phone

Open the Pages URL on your phone, then **Share → Add to Home Screen** (iOS) or **Install app** (Android). It opens full-screen with a bottom tab bar. The centre **Scan** button opens the camera directly. Photos are compressed on the phone before upload.

### Receipt reader

- **Default: free on-device OCR.** Tesseract.js runs in the browser, so there's no key and no cost, and the photo never leaves the phone. The first read downloads about 10 MB of OCR data, so do one practice scan before going on stage.
- **Optional: Claude vision.** More accurate on crumpled or angled photos and PDFs. In the app go to **Me → Receipt reader**, choose Claude and paste an Anthropic API key (it's stored in that browser only). Use a key with a low spend limit and delete it after the demo.
- **Test receipts.** Open `#/demo/receipts` on a laptop, then photograph one with the phone using **Scan**. Two of them are fraudulent.

### Demo script

Society names come from the St Andrews Students' Association directory. All people, wallets and receipts are fictional.

**The three moments to show:**
1. **Receipt upload and parsing:** a real photo, read live.
2. **The agent's decision:** approved with no human in the loop, or declined with a reason and an appeal.
3. **The Union treasurer signing on the Ledger:** the device shows the amount, recipient and network.

The rows below were rewritten for the agent-decides flow on 2026-10-12. The claim, appeal and payment logic was tested by script; not every row has been clicked through in the browser.

| As | Do | Shows |
|---|---|---|
| Amara (member) | Scan → Blockchain Society → **Take photo** of the *Co-op Food* test receipt on the laptop → tick each field → submit | Real AI/OCR parsing, member checks every field, the agent approves and the claim goes straight to "Awaiting Ledger" |
| Amara | Scan → photograph *Pixel Print Co.* | **Fraud:** the receipt agent finds hidden "note to AI" instructions and a wallet address, and rejects it. It can't be appealed |
| Amara | Scan → *Cook & Bake Supplies* (sample list, or the Claude reader on a photo) | **Fraud:** the line items add up to £20 but the total says £70, so it's rejected as altered |
| Amara | Scan → *Fife Coast Catering* / June *Co-op* / *Domino's* | Declined: over limit / too old / duplicate of CLM-0004 |
| Amara | Open a declined claim → **Appeal to your society treasurer** → give a reason | The member can challenge the agent; status becomes "Appealed" |
| Jonah (Blockchain society treasurer) | Appeals → open the appealed claim → **A** (Uphold appeal) | The only human review in the flow. Upholding sends the payment to the Union treasurer; Jonah cannot sign |
| Jonah | Appeals → **E** (Request edits) or **D** (Deny appeal) with a quick reason | The member sees the reason |
| Robin (Union treasurer) | Payments → open a claim → **Open Ledger prompt** → sign on the device | Device approval. Paid only after on-chain confirmation |
| Robin | Payments → CLM-0006 | The AI *was* tricked. The extra fields were discarded and payment can only go to Kit's saved wallet |
| Amara, then Robin | Tick **Attack demo** in the demo bar → Scan → pick the *Northgate Print Shop* sample → submit. Switch to Robin → Payments → open the claim → **Open Ledger prompt** → reject on the device | The safeguards are switched off on purpose: the fraud scan is skipped and the agent obeys the receipt's hidden "pay this wallet" note. Every check passes, but the recipient check shows the address is not Amara's saved wallet and is printed on the receipt. The Ledger is what stops it |
| Robin | Open Ledger prompt → reject on the device | Nothing is signed; the claim stays approved and can be sent again |
| Robin (mock mode only) | Sign a claim, choosing "RPC times out" | Needs-reconciliation path, with no double payment |
| Amara | Claims → CLM-0003 → Edit claim, change £39.60 to £35.10 | A partial claim creates version 2 and goes back to the agent |
| Hybrid mode: Amara | Claim the *Tesco Express* baking ingredients for the **Blockchain** Society as "Team dinner" | The LLM agent declines it as not a reasonable expense for that society, with its reason shown |
| Sam (FinTech treasurer) | Me → Treasury setup | Reimbursement stays disabled until all 5 checks pass (see the note below) |
| Signed out | Create account as `Tomás Ferreira`, `tf12@st-andrews.ac.uk`, code `482913` → Committee access → STA-AI / Treasurer | Committee-record match grants least-privilege permissions. Try `Tom Ferreira` to get manual review |

### Known gaps

- **Society setup is out of date.** It still asks each society for its own treasury wallet and a paired Ledger. In the current flow only the Union has a wallet and a Ledger.
- **Landing-page and "How it works" copy** has not been re-read against the new flow.
- **The agent needs the backend.** On GitHub Pages the seven checks alone decide.
- **Hybrid trusts the browser for the payment details.** The amount and recipient are sent from the browser's mock store to the backend, so the Ledger screen is the real check on them.
- **Ledger Key Ring runs on Ledger's staging service with an emulated device**, not production. It keeps the LLM key out of `backend/.env`; setup is in [`backend/README.md`](backend/README.md) and is optional for other developers.
