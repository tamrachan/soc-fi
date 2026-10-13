// Loads .env, then any secrets sealed with Ledger Key Ring, before the values below are read.
import "./secrets.js";
import { baseSepolia } from "viem/chains";
import type { Address } from "viem";

export const config = {
  port: Number(process.env.PORT ?? 3000),

  // Speculos REST API. Not 5000: macOS AirPlay Receiver already listens there.
  speculosUrl: process.env.SPECULOS_URL ?? "http://127.0.0.1:5001",
  derivationPath: process.env.DERIVATION_PATH ?? "44'/60'/0'/0/0",

  chain: baseSepolia,
  rpcUrl: process.env.RPC_URL ?? "https://sepolia.base.org",
  // Circle's USDC on Base Sepolia (6 decimals)
  usdcAddress: (process.env.USDC_ADDRESS ??
    "0x036CbD53842c5426634e7929541eC2318f3dCF7e") as Address,
  usdcDecimals: 6,
  // Receipts are in GBP, payouts in USDC. Placeholder fixed rate, not a live feed.
  usdcPerGbp: Number(process.env.USDC_PER_GBP ?? 1.27),
  broadcast: process.env.BROADCAST !== "false",

  // Any OpenAI-compatible provider works (OpenAI, Venice, ...) via LLM_BASE_URL.
  llmApiKey: process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY,
  llmBaseUrl: process.env.LLM_BASE_URL,
  llmModel: process.env.LLM_MODEL ?? "gpt-4o",

  // Hard limit enforced in code, whatever the model says.
  maxClaimGbp: Number(process.env.MAX_CLAIM_GBP ?? 100),
};
