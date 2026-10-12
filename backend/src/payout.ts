import {
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  hexToBytes,
  http,
  keccak256,
  parseUnits,
  serializeTransaction,
  type Address,
  type Hex,
  type TransactionSerializableEIP1559,
} from "viem";
import { config } from "./config.js";
import { getTreasuryAddress, signOnDevice } from "./ledger.js";
import type { Expense } from "./store.js";

const client = createPublicClient({
  chain: config.chain,
  transport: http(config.rpcUrl),
});

export function usdcAmount(amountGbp: number): bigint {
  return parseUnits(
    (amountGbp * config.usdcPerGbp).toFixed(config.usdcDecimals),
    config.usdcDecimals,
  );
}

export async function treasuryStatus() {
  const address = await getTreasuryAddress();
  const [eth, usdc] = await Promise.all([
    client.getBalance({ address }),
    client.readContract({
      address: config.usdcAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
    }),
  ]);
  return {
    address,
    chain: config.chain.name,
    eth: formatUnits(eth, 18),
    usdc: formatUnits(usdc, config.usdcDecimals),
  };
}

export function signPayout(expense: Expense) {
  return signTransfer(expense.memberWallet, usdcAmount(expense.amountGbp));
}

// The agent drafts the transfer; only the device can authorise it.
export async function signTransfer(
  recipient: Address,
  amount: bigint,
): Promise<{ signedTx: Hex; amountUsdc: string }> {
  const from = await getTreasuryAddress();
  const [nonce, fees] = await Promise.all([
    client.getTransactionCount({ address: from, blockTag: "pending" }),
    client.estimateFeesPerGas(),
  ]);

  const tx: TransactionSerializableEIP1559 = {
    type: "eip1559",
    chainId: config.chain.id,
    nonce,
    to: config.usdcAddress,
    value: 0n,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [recipient, amount],
    }),
    // Fixed rather than estimated so a draft can be signed before the treasury is funded.
    gas: 100_000n,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  };

  const { r, s, v } = await signOnDevice(hexToBytes(serializeTransaction(tx)));
  const yParity = v === 0 || v === 27 ? 0 : 1;
  return {
    signedTx: serializeTransaction(tx, { r, s, yParity }),
    amountUsdc: formatUnits(amount, config.usdcDecimals),
  };
}

export async function broadcast(signedTx: Hex): Promise<Hex> {
  const hash = await client.sendRawTransaction({ serializedTransaction: signedTx });
  const receipt = await client.waitForTransactionReceipt({ hash });
  // A mined transfer can still revert, e.g. when the treasury holds too little USDC.
  if (receipt.status !== "success") throw new Error(`Transaction ${hash} reverted on-chain`);
  return hash;
}

// The hash a signed transaction will have once broadcast.
export const txHashOf = (signedTx: Hex): Hex => keccak256(signedTx);
