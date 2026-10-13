# Submission answers

Our answers to the submission form's questions, for the N3XT Hackathon @ OP3N 2026. The project itself is described in the [README](../README.md).

## Ledger components used

| Component                                                     | Used?                         | How                                                                                                                                                                                                                                           |
| ------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Device Management Kit** (`@ledgerhq/device-management-kit`) | Yes                           | The backend connects to the device and runs device actions ([`backend/src/ledger.ts`](../backend/src/ledger.ts))                                                                                                                              |
| **Signer** (`@ledgerhq/device-signer-kit-ethereum`)           | Yes                           | Reads the Union wallet's address and clear-signs every USDC transfer ([`backend/src/payout.ts`](../backend/src/payout.ts))                                                                                                                    |
| **Key Ring**                                                  | Yes, but not through Ring CLI | The agent's LLM API key is encrypted with a key ring, using Ledger Live's library `@ledgerhq/ledger-key-ring-protocol` against Ledger's staging service ([`backend/scripts/keyring.cjs`](../backend/scripts/keyring.cjs))                     |
| **Ring CLI / Wallet CLI**                                     | Tried, not in the final build | Both need a physical Ledger over USB, and we had none                                                                                                                                                                                         |
| **Enterprise CLI**                                            | No                            |                                                                                                                                                                                                                                               |
| **Other**                                                     | Yes                           | The Speculos emulator and its DMK transport (`@ledgerhq/device-transport-kit-speculos`), the Ethereum app and the Ledger Sync app built for the Nano S Plus, clear signing of an ERC-20 transfer, and Ledger's `wallet-cli-usage` agent skill |

The agent's model is any OpenAI-compatible provider; we tested with Google Gemini. The optional receipt reader can use Anthropic Claude, and the default reader is Tesseract OCR in the browser.

## Developer feedback

We built the whole project without a physical Ledger, on the Speculos emulator. Most of what follows comes from that.

### What was hard or confusing

- **Clear signing on the emulator fails with a misleading error.** Speculos must be started with `--pki-prod`, or the device rejects Ledger's token metadata, falls back to blind signing, and fails with `6a80 Invalid data`. Nothing in the Signer documentation mentions the flag, and the error points nowhere near the cause.
- **The Speculos transport's arguments are undocumented.** `speculosTransportFactory` takes the emulator's HTTP API URL, not the APDU port, and its device model defaults to Stax. We found both by reading the type definitions.
- **Key Ring has no documented route without hardware.** `wallet-cli ring init` needs a physical Ledger over USB running the Ledger Sync app. The CLI has no emulator option and the documentation does not say so. A team working on Speculos can use the signer but, as documented, cannot use Key Ring at all.
- **The DMK Key Ring package cannot create a key ring.** `@ledgerhq/device-trusted-app-kit-ledger-keyring-protocol` 0.5.0 authenticated the emulated device and then failed with "Ledger Sync must be initialized from Ledger Live with this device". Its README has headings and no content.
- **`npx wallet-cli` runs someone else's package.** Without the scope, npm resolves an unrelated package of the same name. The Ledger one is `@ledgerhq/wallet-cli`.
- **Package names took some finding.** The Ethereum signer is a separate package from the DMK, and the DMK's entry point is `DeviceManagementKitBuilder`. An AI assistant we asked early on invented a class that does not exist, which suggests the documentation is thin enough for models to guess wrongly.

### Was the documentation clear? What was missing or wrong?

The DMK and Signer guides were clear once we had a device session. What was missing was everything around them:

- A "no hardware" path. The brief says to set tools up early, but there is no single page that takes a team from nothing to a signed transaction on Speculos.
- Any statement of which tools need a physical device. We lost time discovering that Ring CLI and Wallet CLI do.
- What Key Ring protects against and what it does not. We had to work out for ourselves that it protects a secret at rest and controls which machines can be given it, and that a running process still holds the secret in memory.
- How structured data and addresses appear on each device model. We could only find out by running the emulator.

### Bugs we hit

- `tsx` cannot load `@ledgerhq/ledger-key-ring-protocol`. It resolves the package to its TypeScript sources, which mix `require` and ES modules. Plain `node` with CommonJS works, so our Key Ring code runs in a child process.
- Speculos' default API port (5000) collides with AirPlay Receiver on macOS.
- The `6a80 Invalid data` error described above. We would call the unhelpful message a bug.

### What worked that the documentation does not describe

Key Ring does work on the emulator. We built [LedgerHQ/app-ledger-sync](https://github.com/LedgerHQ/app-ledger-sync) for the Nano S Plus, ran it in Speculos, and used Ledger Live's own library with `@ledgerhq/hw-transport-node-speculos-http` against Ledger's staging trustchain service. It created a key ring, added a second member after an approval on the emulated device, encrypted and decrypted, and decrypted again with the emulator stopped. If that is an acceptable route for developers, it deserves a page.

### Blockers on our side

- **No physical Ledger.** Everything runs on an emulator, so the DMK lives in our backend. With a real device it belongs in the treasurer's browser.
- **Faucet limits.** Test USDC comes at 10 to 20 a day, which limited how many real payouts we could rehearse.
- **Time.** We planned a Firebase backend and did not build it. The app's data stays in the browser, and only the agent and the Ledger are real.
- **A late change of design.** We moved from "a treasurer reviews every claim" to "the agent decides and a person only signs" on 12 October, the day before the deadline, which meant reworking the claim flow, the roles and the landing page.

### What is missing from the tools

- An emulator option for Ring CLI and Wallet CLI.
- A Key Ring package for the DMK that can create a ring, with a README.
- A way to approve data, not only machines, with Key Ring. We wanted "this wallet address was approved on the device" and found that Key Ring is the wrong tool for it; a signature from the signer is the right one. Saying so in the documentation would save others the detour.

### One concrete suggestion

Publish a "build without hardware" quickstart: one Docker command that starts Speculos with the Ethereum app and `--pki-prod`, a ten-line DMK script that clear-signs an ERC-20 transfer, and the same for Key Ring. It would have saved us a lot of time.

## What's the hardest thing you had to solve?

Two things, one technical and one of design.

**Technical: getting Key Ring to work with no hardware.** The documented tool needs a USB device. The DMK package failed at creating a ring. We ended up building the Ledger Sync app ourselves for the emulator, pointing at Ledger's staging service because the emulated app signs with a public test key, and wiring Ledger Live's protocol library into a Node script that our TypeScript runner could not import. The result is small, under 200 lines, but each step was found by trial.

**Design: working out what the treasurer's signature actually proves.** Our first design had the treasurer review each claim and then sign. That made the Ledger a formality after a human decision. We changed it so the agent decides alone, which makes the device the only human control and forced us to be exact about it. The device proves that a person saw the real amount and recipient, and that software alone cannot pay. It does not prove that the recipient address really belongs to the member. Once we saw that gap we added the recipient check, which tells the treasurer whether the address is the member's saved wallet, when it last changed and whether it appears on the receipt. We also built the attack demo, which switches the software safeguards off to show the one case the device does catch.

## What would you build next with another week?

In order:

1. **Wallet enrolment signed on the Ledger.** When a member registers or changes a payout wallet, the Union treasurer's device signs a structured message approving it. The backend then refuses to pay any wallet without a valid signature. This closes the gap described above: a stolen account or a tampered database could not redirect money.
2. **A backend that holds the truth.** Today the browser sends the amount and recipient to be signed. The backend should record each approved claim when the agent decides, and refuse to sign anything that does not match.
3. **A physical device in the treasurer's browser.** Move the DMK from the backend to the browser over WebHID, so the backend only drafts and broadcasts.
4. **A treasury contract with clear signing.** Per-society budgets enforced on-chain, an allowlist of enrolled wallets, and an ERC-7730 descriptor so the device shows "Reimburse · Chess Society · 42.50 USDC".
5. **Key Ring for the whole team.** Commit the encrypted secrets file and have each teammate's machine join the ring by device approval, with a way to remove a machine.
6. **The unfinished product work:** a real database and login, email to the treasurer, and society setup pages that match the Union-wallet model.

## Anything else you want to add?

- **What is real.** The agent's decision, the device signature, the on-chain USDC transfer and the Key Ring encryption are all real. The device is emulated, the network is Base Sepolia, and Key Ring runs on Ledger's staging service. Accounts and claims are mock data in the browser. We have tried to say so wherever it matters.
- **Pre-existing code.** None. The repository's first commit is dated 10 October 2026. The two Ledger app binaries in `backend/speculos/` are builds of Ledger's open-source apps.
- **The pattern is not specific to expenses.** An agent that does all the work and proposes one high-risk action, and a person who confirms that action on a screen the agent cannot alter, applies wherever an agent acts with someone else's authority.
