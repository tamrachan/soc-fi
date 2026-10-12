import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Address, Hex } from "viem";
import type { Audit } from "./agent.js";

export type ExpenseStatus =
  | "agent_approved" // agent is satisfied, waiting for the treasurer's device
  | "agent_rejected" // sent back to the member, who may override
  | "overridden" // member overrode the rejection, treasurer decides
  | "signing" // waiting for confirmation on the Ledger
  | "signed" // signed but not broadcast
  | "paid"
  | "treasurer_rejected";

export interface Expense {
  id: string;
  createdAt: string;
  society: string;
  memberEmail: string;
  memberWallet: Address;
  description: string;
  amountGbp: number;
  receiptText?: string;
  receiptImage?: string; // data URL
  status: ExpenseStatus;
  audit: Audit;
  overrideReason?: string;
  treasurerNote?: string;
  amountUsdc?: string;
  signedTx?: Hex;
  txHash?: Hex;
  payoutError?: string;
}

const FILE = "data/expenses.json";

const expenses = new Map<string, Expense>(
  existsSync(FILE)
    ? (JSON.parse(readFileSync(FILE, "utf8")) as Expense[]).map((e) => [e.id, e])
    : [],
);

function persist() {
  mkdirSync("data", { recursive: true });
  writeFileSync(FILE, JSON.stringify([...expenses.values()], null, 2));
}

export const store = {
  create(fields: Omit<Expense, "id" | "createdAt">): Expense {
    const expense = {
      ...fields,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    expenses.set(expense.id, expense);
    persist();
    return expense;
  },
  get: (id: string) => expenses.get(id),
  list: () => [...expenses.values()],
  update(expense: Expense, patch: Partial<Expense>): Expense {
    Object.assign(expense, patch);
    persist();
    return expense;
  },
};
