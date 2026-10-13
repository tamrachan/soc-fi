# Demo guide

Society names come from the St Andrews Students' Association directory. All people, wallets and receipts are fictional.

## Personas

Switch between them with the **Viewing as** bar at the top of the app.

| Persona | Role | Can do |
|---|---|---|
| Amara Okafor | Member of the Blockchain and Baking societies | Submit claims, fix or appeal declined ones |
| Robin Calder | **Union treasurer** | The only persona with **Payments** and the Ledger prompt. Sees every claim that has a payment |
| Jonah Whitfield, Elena Marsh | Society treasurers (Blockchain, Baking) | Decide **Appeals** for their own society. Cannot pay |
| Priya Raman | Logistics coordinator, Blockchain | View her society's claims |
| Sam Lindqvist | Society treasurer, FinTech | Society setup (see [known gaps](ARCHITECTURE.md#known-gaps)) |

## The three moments to show

1. **A receipt is read**, from a real photo.
2. **Kevin decides**: approved with no person involved, or declined with a reason and a route to appeal.
3. **The Union treasurer signs on the Ledger**: the device shows the amount, recipient and network.

## The recorded demo

Run in hybrid mode ([setup](RUNNING.md#2-the-full-flow-hybrid-mode)). Click **Reset** first.

| Scene | Steps | Shows |
|---|---|---|
| Kevin starts | `npm run keyring -- status`, then `npm run dev`, then `curl localhost:3000/api/status` | Kevin's API key is not in `.env`. It is decrypted through Ledger Key Ring at start |
| Kevin declines | As Amara, claim for the Blockchain Society with [`demo-receipts/coop-food-beer.png`](../demo-receipts/coop-food-beer.png) | The LLM reads the photo, spots the beer and declines in plain words |
| Kevin approves, a person signs | As Amara, claim the *Tesco Express* sample for The Baking Society. As Robin, open it in Payments, **Open Ledger prompt**, sign on the device, open the transaction link | No society treasurer is involved. The recipient check, clear signing, and a real USDC transfer |
| Kevin is fooled, a person stops it | The [attack demo](#the-attack-demo) below | The Ledger is the last line of defence |

## The attack demo

The **Attack demo** switch in the demo bar turns the software safeguards off on purpose. While it is on, the fraud scan is skipped and Kevin is treated as having obeyed a "pay this wallet" note hidden on a receipt, so the drafted payment goes to the address on the receipt. In hybrid mode the backend LLM is not called for such a claim. Everything after that is the normal flow.

1. With the switch **off**, as Amara, start a claim for the Blockchain Society and pick the *Northgate Print Shop* sample. The form shows that Kevin will reject it: plain code found the hidden text.
2. Click **Replace receipt**, tick **Attack demo**, and pick the same sample again. Submit. Every check passes.
3. As Robin, open the claim in **Payments**. A red notice says the address is not Amara's saved wallet and is printed on the receipt.
4. **Open Ledger prompt**. The device shows the attacker's address. Reject on the device. Nothing is signed.

Untick the switch afterwards. It is a simulation of failed safeguards, not evidence that the real agent falls for the receipt.

## More things to try

These rows were tested by script against the mock data layer. Not every one has been clicked through in a browser.

| As | Do | Shows |
|---|---|---|
| Amara | Scan → Blockchain Society → photograph the *Co-op Food* test receipt → tick each field → submit | The receipt is read, the member checks every field, Kevin approves and the claim goes straight to "Awaiting Ledger" |
| Amara | Scan → photograph *Pixel Print Co.* | **Fraud:** hidden "note to AI" text and a wallet address are found, and the claim is rejected. It cannot be appealed |
| Amara | Scan → *Cook & Bake Supplies* (sample list) | **Fraud:** the line items add up to £20 but the total says £70, so it is rejected as altered |
| Amara | Scan → *Fife Coast Catering* / the June *Co-op* / *Domino's* | Declined: over the limit / too old / a duplicate of CLM-0004 |
| Amara (hybrid) | Claim the *Tesco Express* baking ingredients for the **Blockchain** Society as "Team dinner" | Kevin declines it as not a reasonable expense for that society, and says why |
| Amara | Open a declined claim → **Appeal to your society treasurer** → give a reason | The member can challenge Kevin; the status becomes "Appealed" |
| Jonah | Appeals → open the appealed claim → uphold, request edits or deny | The only human review of a claim. Upholding sends the payment to the Union treasurer; Jonah cannot sign |
| Robin | Payments → CLM-0006 | The receipt reader was tricked into returning extra fields. They were discarded, and the payment can only go to Kit's saved wallet |
| Robin | Open Ledger prompt → reject on the device | Nothing is signed. The claim stays approved and can be sent again |
| Robin (mock mode) | Sign a claim, choosing "RPC times out" | The needs-reconciliation path, with no double payment |
| Amara | Claims → CLM-0003 → Edit claim, change £39.60 to £35.10 | A partial claim creates version 2 and goes back to Kevin |
| Signed out | Create an account as `Tomás Ferreira`, `tf12@st-andrews.ac.uk`, code `482913` → Committee access → STA-AI / Treasurer | A committee-record match grants least-privilege permissions. Try `Tom Ferreira` to get manual review |
