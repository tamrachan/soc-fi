import express, { type Request, type Response } from "express";
import { formatUnits, getAddress, isAddress, parseUnits, type Hex } from "viem";
import { auditClaim } from "./agent.js";
import { config } from "./config.js";
import { DeviceError } from "./ledger.js";
import {
  broadcast,
  signPayout,
  signTransfer,
  treasuryStatus,
  txHashOf,
  usdcAmount,
} from "./payout.js";
import { secrets } from "./secrets.js";
import { store, type Expense } from "./store.js";

const app = express();
app.use(express.json({ limit: "15mb" })); // receipts arrive as data URLs
app.use((req, res, next) => {
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  if (req.method === "OPTIONS") return void res.sendStatus(204);
  next();
});

// TODO: no email provider wired up yet, overrides are only logged.
function notifyTreasurer(expense: Expense) {
  console.log(
    `[notify treasurer] ${expense.memberEmail} overrode the agent on ${expense.id}: ${expense.overrideReason}`,
  );
}

function findExpense(req: Request, res: Response): Expense | undefined {
  const expense = store.get(String(req.params.id));
  if (!expense) res.status(404).json({ error: "Expense not found" });
  return expense;
}

// Member submits a claim; the agent audits it straight away.
app.post("/api/expenses", async (req, res) => {
  const { society, memberEmail, memberWallet, description, receiptText, receiptImage } =
    req.body ?? {};
  const amountGbp = Number(req.body?.amountGbp);

  if (!society || !memberEmail || !description)
    return void res.status(400).json({ error: "society, memberEmail and description are required" });
  if (!isAddress(memberWallet ?? ""))
    return void res.status(400).json({ error: "memberWallet is not a valid address" });
  if (!(amountGbp > 0))
    return void res.status(400).json({ error: "amountGbp must be a positive number" });
  if (!receiptText && !receiptImage)
    return void res.status(400).json({ error: "receiptText or receiptImage is required" });

  const audit = await auditClaim({ society, description, amountGbp, receiptText, receiptImage });
  const expense = store.create({
    society,
    memberEmail,
    memberWallet,
    description,
    amountGbp,
    receiptText,
    receiptImage,
    audit,
    status: audit.decision === "approve" ? "agent_approved" : "agent_rejected",
  });
  res.status(201).json(expense);
});

app.get("/api/expenses", (req, res) => {
  const { memberEmail } = req.query;
  res.json(store.list().filter((e) => !memberEmail || e.memberEmail === memberEmail));
});

app.get("/api/expenses/:id", (req, res) => {
  const expense = findExpense(req, res);
  if (expense) res.json(expense);
});

// Member disagrees with the agent: the claim goes to the treasurer anyway, flags attached.
app.post("/api/expenses/:id/override", (req, res) => {
  const expense = findExpense(req, res);
  if (!expense) return;
  if (expense.status !== "agent_rejected")
    return void res.status(409).json({ error: `Cannot override a claim that is ${expense.status}` });
  if (!req.body?.reason)
    return void res.status(400).json({ error: "reason is required" });

  store.update(expense, { status: "overridden", overrideReason: String(req.body.reason) });
  notifyTreasurer(expense);
  res.json(expense);
});

app.get("/api/treasurer/queue", (_req, res) => {
  res.json(
    store
      .list()
      .filter((e) => ["agent_approved", "overridden", "signing", "signed"].includes(e.status))
      .map((e) => ({
        ...e,
        amountUsdc: e.amountUsdc ?? formatUnits(usdcAmount(e.amountGbp), config.usdcDecimals),
      })),
  );
});

// What is live: whether the agent has a model, and where its key came from.
app.get("/api/status", (_req, res) => {
  res.json({
    agent: config.llmApiKey ? config.llmModel : null,
    agentKey: secrets.source,
    keyRing: secrets.ring ?? null,
    broadcast: config.broadcast,
  });
});

app.get("/api/treasurer/wallet", async (_req, res) => {
  res.json(await treasuryStatus());
});

app.post("/api/expenses/:id/reject", (req, res) => {
  const expense = findExpense(req, res);
  if (!expense) return;
  if (!["agent_approved", "overridden"].includes(expense.status))
    return void res.status(409).json({ error: `Cannot reject a claim that is ${expense.status}` });
  store.update(expense, { status: "treasurer_rejected", treasurerNote: req.body?.note });
  res.json(expense);
});

// Treasurer pays: this request stays open until they confirm or reject on the Ledger.
app.post("/api/expenses/:id/pay", async (req, res) => {
  const expense = findExpense(req, res);
  if (!expense) return;
  if (!["agent_approved", "overridden", "signed"].includes(expense.status))
    return void res.status(409).json({ error: `Cannot pay a claim that is ${expense.status}` });
  if (store.list().some((e) => e.status === "signing"))
    return void res.status(409).json({ error: "Another payout is waiting on the Ledger" });

  if (!expense.signedTx) {
    const previous = expense.status;
    store.update(expense, { status: "signing" });
    try {
      store.update(expense, { ...(await signPayout(expense)), status: "signed" });
    } catch (error) {
      store.update(expense, { status: previous });
      const status = error instanceof DeviceError ? 403 : 502;
      return void res.status(status).json({ error: (error as Error).message });
    }
  }

  if (config.broadcast) {
    try {
      const txHash = await broadcast(expense.signedTx!);
      delete expense.payoutError;
      store.update(expense, { status: "paid", txHash });
    } catch (error) {
      // The signature may be stale (e.g. the nonce moved on): drop it so a retry re-signs.
      delete expense.signedTx;
      store.update(expense, {
        status: expense.overrideReason ? "overridden" : "agent_approved",
        payoutError: (error as Error).message,
      });
      return void res.status(502).json({ error: `Signed but not broadcast: ${expense.payoutError}` });
    }
  }
  res.json(expense);
});

// --- Frontend integration (hybrid mode) ---
// The React app keeps its claims in its own store and only calls these routes for the
// device moment, so the amount and recipient arrive from the browser. The device screen
// is the check on them.

// Payments already sent, so a retried request never pays the same claim twice.
const sentPayments = new Map<string, { txHash: Hex; broadcast: boolean }>();
let deviceBusy = false;

app.post("/api/payments/sign", async (req, res) => {
  const { paymentId, recipientAddress } = req.body ?? {};
  const amountUsdc = Number(req.body?.amountUsdc);
  if (!paymentId) return void res.status(400).json({ error: "paymentId is required" });
  // Any 20-byte address is accepted whatever its letter case; the device shows it checksummed.
  if (!isAddress(recipientAddress ?? "", { strict: false }))
    return void res.status(400).json({ error: "recipientAddress is not a valid address" });
  if (!(amountUsdc > 0))
    return void res.status(400).json({ error: "amountUsdc must be a positive number" });
  const capUsdc = config.maxClaimGbp * config.usdcPerGbp;
  if (amountUsdc > capUsdc)
    return void res.status(400).json({ error: `Above the per-claim cap of ${capUsdc} USDC` });

  const key = `${paymentId}:${recipientAddress.toLowerCase()}:${amountUsdc}`;
  const sent = sentPayments.get(key);
  if (sent) return void res.json(sent);
  if (deviceBusy || store.list().some((e) => e.status === "signing"))
    return void res.status(409).json({ error: "Another payout is waiting on the Ledger" });

  deviceBusy = true;
  try {
    const { signedTx } = await signTransfer(
      getAddress(recipientAddress),
      parseUnits(amountUsdc.toFixed(config.usdcDecimals), config.usdcDecimals),
    );
    const result = config.broadcast
      ? { txHash: await broadcast(signedTx), broadcast: true }
      : { txHash: txHashOf(signedTx), broadcast: false };
    sentPayments.set(key, result);
    res.json(result);
  } catch (error) {
    const status = error instanceof DeviceError ? 403 : 502;
    res.status(status).json({ error: (error as Error).message });
  } finally {
    deviceBusy = false;
  }
});

// The agent's verdict on a claim, with the society's profile and policy as context.
// It decides alone; the frontend only sends a claim to a person if the member appeals.
app.post("/api/agent/audit", async (req, res) => {
  const { society, claim, receiptText, receiptImage } = req.body ?? {};
  const amount = Number(claim?.amount);
  if (!society?.name || !claim?.description)
    return void res.status(400).json({ error: "society.name and claim.description are required" });
  if (!(amount > 0))
    return void res.status(400).json({ error: "claim.amount must be a positive number" });
  if (!receiptText && !receiptImage)
    return void res.status(400).json({ error: "receiptText or receiptImage is required" });

  const { description, amount: _amount, ...fields } = claim;
  res.json(
    await auditClaim({
      society: society.name,
      societyContext: society,
      fields,
      description,
      amountGbp: amount,
      receiptText,
      receiptImage,
    }),
  );
});

// The emulator's screen and buttons, proxied so the frontend can show them in the signing modal.
app.get("/api/device/screenshot", async (_req, res) => {
  const upstream = await fetch(`${config.speculosUrl}/screenshot`);
  res
    .status(upstream.status)
    .set({ "Content-Type": "image/png", "Cache-Control": "no-store" })
    .send(Buffer.from(await upstream.arrayBuffer()));
});

app.post("/api/device/button/:button", async (req, res) => {
  if (!["left", "right", "both"].includes(req.params.button))
    return void res.status(400).json({ error: "button must be left, right or both" });
  const upstream = await fetch(`${config.speculosUrl}/button/${req.params.button}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "press-and-release" }),
  });
  res.sendStatus(upstream.ok ? 204 : 502);
});

app.use((error: Error, _req: Request, res: Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ error: error?.message ?? String(error) });
});

app.listen(config.port, () =>
  console.log(`Society expense backend on http://localhost:${config.port}`),
);
