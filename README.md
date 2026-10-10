# Countersign — ledger-hackathon

An AI agent checks student-society expense claims in seconds, but it can't pay anyone. Only the society treasurer's Ledger can release the money. See [`Context/CONTEXT.md`](Context/CONTEXT.md) and [`user_flows.md`](user_flows.md).

## Front-end

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm run build      # outputs frontend/dist
```

The app runs entirely on mock data saved in your browser (`VITE_DATA_SOURCE=mock`). Use the **Viewing as** bar at the top to switch personas, and **Reset data** to start over.

Backend developers: read [`HANDOVER.md`](HANDOVER.md) for the schemas, status machine and API contract.

### Deploying the demo (GitHub Pages)

`.github/workflows/deploy-pages.yml` builds `frontend/` and publishes it on every push to `main` that touches `frontend/`.
One-time setup: **Repo → Settings → Pages → Source: GitHub Actions**.
The site will be at `https://tamrachan.github.io/ledger-hackathon/`. Routing uses `#/…` URLs, so deep links work on Pages.

### On a phone

Open the Pages URL on your phone, then **Share → Add to Home Screen** (iOS) or **Install app** (Android). It opens full-screen with a bottom tab bar. The centre **Scan** button opens the camera directly. Photos are compressed on the phone before upload.

### Demo script

Society names come from the St Andrews Students' Association directory. All people, wallets and receipts are fictional.

| As | Do | Shows |
|---|---|---|
| Amara (member) | Scan → Blockchain Society → *Co-op Food* hackathon lunch (or take a real photo) → tick each field → submit | AI pre-fill, member checks every field, all 7 checks pass |
| Amara | Scan → The Baking Society → *Tesco Express* bread-workshop ingredients | Baking ingredients use case |
| Amara | Scan → *Pixel Print Co.* | Hidden prompt-injection text is flagged, so the claim can't be submitted |
| Amara | Scan → *Fife Coast Catering* / June *Co-op* / *Domino's* | Over limit / too old / duplicate of CLM-0004 |
| Amara | Claims → CLM-0003 → Edit claim, change £39.60 to £35.10 | The Baking treasurer said to remove the shampoo. A partial claim passes and creates version 2 |
| Jonah (Blockchain treasurer) | Review → CLM-0004 (£145.90 Domino's for the hackathon) → Approve → hold to sign | Ledger device approval, then pending, then paid only after confirmation |
| Jonah | Review → CLM-0006 | The AI *was* tricked. The extra fields were discarded and payment can only go to Kit's saved wallet |
| Jonah | Approve CLM-0005, choose "RPC times out" | Needs-reconciliation path, with no double payment |
| Elena (Baking treasurer) | Review the resubmitted CLM-0003 | The member-vs-AI table flags the partial amount for a human to check |
| Sam (FinTech treasurer) | Me → Treasury setup | Reimbursement stays disabled until all 5 checks pass |
| Signed out | Create account as `Tomás Ferreira`, `tf12@st-andrews.ac.uk`, code `482913` → Committee access → STA-AI / Treasurer | Committee-record match grants least-privilege permissions. Try `Tom Ferreira` to get manual review |
