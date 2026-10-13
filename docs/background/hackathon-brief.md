# 🛠️ N3XT Hackathon @ OP3N 2026

> The organisers' brief for the N3XT Hackathon @ OP3N 2026, copied here for reference. Not written by us.

Build before you land. Pitch live in Paris.

Your seat comes with a hackathon. It's a **1-week remote build** the week before OP3N, with **live finals at Ledger HQ on Friday 16 October**. Every club fields one team — this is where you show what you can ship. **€5,000 cash prize for the top 3 winners**

---

# The challenge

Build a project using the **Ledger Agent Stack and/or a Ledger signer and/or Key Ring**: the project can be either (1) an AI agent, (2) an AI-powered product built on the Ledger Agent Stack, or (3) an AI-powered use case built around a Ledger signer.

You build with one or more of the Ledger tools below. Any AI model or provider works.

---

# Ways to build

**👉 Start here:** [AI Tools — Overview](https://developers.ledger.com/docs/ai-tools/overview)

| **Tool** | **What it's for** | **Docs** |
|---|---|---|
| **Agent Stack** (Ledger CLI) | Give your agent secrets it **cannot leak** — hardware-backed keys & credentials. | [Ledger CLI](https://developers.ledger.com/docs/ai-tools/ledger-cli) |
| **Ring CLI / Key Ring** | Encrypt secrets under keys derived from your Ledger seed. **Headless by design** — for CI & agents with no human at the keyboard. | [Key Ring](https://developers.ledger.com/docs/ai-tools/ledger-cli#key-ring) |
| **DMK Skills** | Plug a Ledger Signer into your **AI agent** so it can request device-backed approval. | [Ledger DMK Skills](https://developers.ledger.com/docs/ai-tools/ledger-dmk-skills) |
| **Signer (DMK)** | Wire a Signer into your app so Ledger **confirms high-risk actions** — human-in-the-loop. | [How to use a Signer](https://developers.ledger.com/docs/device-interaction/dmk-ts/integration/how_to/how_to_use_a_signer) · [DMK integration](https://developers.ledger.com/docs/device-interaction/dmk-ts/integration/how_to/dmk) |

---

# Resources & docs

Everything you might need, depending on your build:

- **Wallet integration** → [Ledger Wallet Provider — Overview](https://developers.ledger.com/docs/ledger-wallet-provider/overview)
- **Safe, readable signing** → [Clear Signing — Overview](https://developers.ledger.com/docs/clear-signing/overview)
- **Use the device as a security key** → [Hardware Security — Security Key](https://developers.ledger.com/docs/ai-tools/hardware-security/security-key)
- **Encryption / signing with OpenPGP** → [Hardware Security — OpenPGP](https://developers.ledger.com/docs/ai-tools/hardware-security/open-pgp)

Any questions? Join our Discord group: (send me your discord handle)

---

# 📺 Watch this first

The fastest way to understand the tools is this walkthrough from Ledger's Product team showing the Agent Stack, Ring CLI and Signer in action:

▶️ **Ledger Tools Walkthrough** → [https://www.youtube.com/watch?v=328z0_foOi4](https://www.youtube.com/watch?v=328z0_foOi4)

⚠️ **Heads-up:** this video was made for the public **ETHOnline** hackathon, so it's organised around *ETHOnline's tracks* and mentions *its own prizes and deadlines*. **Ignore all of that.** For the N3XT hackathon there are **no tracks — one unified challenge** — and the dates, prizes and submission rules are the ones in **this brief**. Watch it for the *tools*, not the *rules*.

---

# Where this gets interesting

A signer does one thing: it proves that a specific human approved a specific action, and it does it in hardware rather than in software that can be rewritten remotely. **That property isn't about crypto.** It applies anywhere something needs to be provably authorised by a person — access, credentials, identity, an agent acting on someone's behalf, a decision that has to be attributable later.

Most of what exists today points the stack at wallets and transactions. The projects we haven't seen yet are the ones that point it somewhere else. If your idea has nothing to do with finance and you're wondering whether it counts, it counts. Be creative, don’t put yourself any limits :)

---

# Project ideas (to spark yours)

- An agent that uses secrets it can never expose (hardware-backed keys via Ring CLI).
- A **human-in-the-loop** agent where a Ledger Signer approves any high-risk move.
- Bring Key Ring to environments **without USB** (headless / cloud / CI agents).
- **Add a Signer or device confirmations to an app you've already shipped** (tell us what existed before Oct 7 — undisclosed pre-existing code disqualifies).
- Agentic payments / agent wallets with **device-backed authorization**.
- A private agent end to end: a Ledger Signer for every action that matters, no secret ever leaving the device.

Open to your own ideas — surprise us.

---

# What we like

- Real user value over a generic demo
- A **clear boundary between what the agent does autonomously and what a human approves** — name it explicitly
- A concrete Ledger primitive actually implemented, not mentioned
- A practical demonstration that device-backed trust matters to your use case
- Runnable code, or a recorded walkthrough if it won't run on someone else's machine

---

# Teams

**One team per club, 2 to 4 members.** Everyone from your club who's coming to Paris is on the team, up to the four-member cap. Any places left over can go to club members building remotely — a teammate who isn't travelling can still build.

**Only two of you pitch**, on behalf of the whole team, and they have to be in the room. Remote members don't pitch and can't be dialled in. **Whoever pitches is who answers the jury, so build your team accordingly.**

Winning is a team outcome: the prize goes to the team, remote members included.

---

# Key dates *(all CEST)*

| **Date** | **Milestone** |
|---|---|
| **Oct 7, 3:00 PM** | 🚀 Hackathon kickoff — build starts |
| **Oct 13, 11:59 PM** | 🔒 Submissions close |
| **Oct 14–15** | 🧑‍⚖️ Review of submissions |
| **Oct 15** | 📣 Finalists announced *(exact time TBC)* |
| **Oct 16, 3:00 PM — Ledger HQ, Paris** | 🎤 Final pitches → winners announced right after |

---

# How to submit

Three steps, all required:

1. ✅ **Submit through the form** → [LINK](https://forms.gle/TcmwuFQMGfyEcuNd6)
2. ✅ **Post your project** on **X or LinkedIn, from the club account**, with **#LedgerN3XTCollab, tagging @Ledger**
3. ✅ **Include your GitHub repo link + a short demo video**

*The form is open from day one. One submission per team: if you need to update it, edit your response rather than submitting again.*

**Prepare your pitch slides in advance** — finalists are announced on **Oct 15**, and you'll pitch the next afternoon (Oct 16).

---

# Judging & finals

**Every submission is scored out of 100%:**

- Technical execution — 25%
- Usefulness and relevance for Ledger — 20%
- Innovation / originality — 20%
- User experience — 15%
- New use cases possible for Ledger — 10%
- Clarity, presentation and documentation — 10%

**Jury: Ian Rogers** (Chief Human Agency Officer), **Guillaume Mathias** (VP Product), **Joshua Mo** (DevRel Lead @ Venice), **Drake Breeding** (Director, Ecosystem Arc @ Circle).

Submissions are reviewed on **Oct 14–15**; finalists are invited to pitch live on **Oct 16 at 3:00 PM** at Ledger HQ.

---

# The pitch, if you make the finals

**Ten (10) minutes: five (5) minutes of presentation, then five (5) minutes of questions** from the jury. Two presenters per team, both present in Paris.

**Jury: Ian Rogers** (Chief Human Agency Officer), **Guillaume Mathias** (VP Product), **Joshua Mo** (DevRel Lead @ Venice), **Drake Breeding** (Director, Ecosystem Arc @ Circle).

---

# One thing we ask back: developer-experience feedback

Every submission includes a short write-up on what it was actually like to build on our stack: where the documentation lost you, which workflow was confusing, what context was missing, and one concrete suggestion. **Be blunt**, this is the part our Dev Rel team reads first.

---

# Mentoring and support

Around five people from Ledger's dev, product and Dev Rel teams are on hand through build week, roughly an hour a day, **on working days**. Mentors are off on Saturday and Sunday.

Technical questions go to the Discord dedicated channel — Ask there or open a ticket rather than DMing, so everyone benefits from the answer.

**If something genuinely blocks you over the weekend, message me directly on Telegram** and I'll unblock what I can or find the person who can.

---

# Your code stays yours

**You and your team keep ownership of everything you build. Ledger takes no transfer or assignment of your intellectual property. What we ask for is the right to show the work — your project, code included, its description, your video demo, the recording of your pitch — on Ledger Academy and Ledger's own channels, credited to you and your club.**

---

# Prizes

**€5,000 across the top three teams — €2,500, €1,500 and €1,000.**

Paid after the event by College.xyz, the same channel as your travel reimbursement; it may arrive as a single payment with the two amounts itemised separately.

You handle the distribution among the team.

### Before you start

- Read the challenge and set up your tools early — don't lose Day 1 to install issues.
- **Full T&C, the selection rubric and the submission form are coming soon** — we'll drop them in the Discord and here.

*Questions? Ask in the Discord or ping me directly.*

**May the best win! :)**