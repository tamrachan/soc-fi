# MODEL

Language Recommendations

You should use TypeScript (Node.js) for the backend.

Here is why:

Ledger Tooling: The hackathon brief explicitly links to the dmk-ts (Device Management Kit for TypeScript) documentation. Ledger’s most modern integration tools for web and Node environments are built in TypeScript.

Crypto Ecosystem: Libraries for transaction construction and web3 interaction (like viem, ethers.js, or @solana/web3.js) have first-class TypeScript support.

Frontend Synergy: Since your frontend is React, using TypeScript on the backend allows you to share types (e.g., receipt data structures, API responses) between the frontend and backend.

Python is an alternative if you plan to use Python-native AI agent frameworks (like LangChain or AutoGen), but you will face more friction integrating the hardware-signing components compared to TypeScript.

Where to Start

Define the Ledger Integration Point: Decide exactly how the treasurer interacts with the device. Based on the brief, you should use Signer (DMK) or DMK Skills. If you are building a web dashboard for the treasurer, you will integrate the Signer (DMK) into the frontend/backend flow so the treasurer physically connects their device to approve the payout.

Set up the Backend Foundation: Initialize a Node.js project with Express or Fastify (or use Next.js if you want a monolithic architecture with your React frontend). Set up endpoints for receipt upload and status overriding.

Build the AI Parsing Module: Integrate an LLM (e.g., OpenAI API) using structured outputs (JSON mode) to extract specific fields from the uploaded receipt (amount, date, merchant, items).

Implement the Agent/Checker Logic: Write the logic that evaluates the parsed JSON against society rules (e.g., "reject alcohol purchases," "flag amounts over £50").

Construct the Transaction: When a payment is approved, your backend needs to format the transaction data (e.g., an ERC-20 transfer on a cheap L2 like Base or Arbitrum) and pass it to the Ledger Signer via the DMK for the treasurer to sign.

Feedback on your Flow vs. Hackathon Brief

Your current flow risks being judged as a standard dApp with a basic AI OCR feature, rather than a true "AI Agent" project. The brief emphasizes using the Ledger Agent Stack, Key Ring, or DMK Skills.

To align better with the rubric (especially "Technical execution" and "New use cases"):

Rather than a static backend, frame your backend as an Autonomous Agent.

Use the Ledger Agent Stack / Key Ring to give the agent its own secure credentials (e.g., database access keys, or a hot wallet to pay gas fees for the relayer).

Use DMK Skills so the AI agent itself constructs the payment payload and requests a hardware-backed signature from the Treasurer, clearly defining the boundary between the agent's autonomous work (parsing, auditing, drafting the transaction) and the human-in-the-loop (the treasurer signing).
Clarifying Questions

To give you more specific architectural advice, I need more information:

Are you planning to build a standalone backend API (e.g., Node/Express) or a full-stack framework (e.g., Next.js)?

What specific blockchain network or token are you planning to use for the payouts?

How is the AI checker making its decisions? Are you using a framework like LangChain/Eliza, or just direct API calls to an LLM?

Will the Treasurer be connecting their Ledger directly to the browser (web USB/Bluetooth) when reviewing the dashboard, or are you attempting a headless integration?

# ME

Whatever is quickest
USDC or tGBP depending on what's better for ease and price
not sure yet, but i agree that the agent should be quite autonomous, and the final treasurer confirmation is more a check against malicious transfers, with the agent being given full autonomy on deciding if an expense is valid within the context of the society
not sure, we don't have a ledger so will be using emulator

Give me the insturctions on how to start setting up the backend

# MODEL

Since you need the quickest path, we will build a lightweight Express backend using TypeScript, the OpenAI SDK for the autonomous agent, and the Ledger Device Management Kit (DMK) connected to the Speculos Emulator (Ledger's software device simulator). We will assume USDC on a low-cost Ethereum L2 like Base or Arbitrum, which viem handles perfectly.

Here is your step-by-step setup guide.

1. Run the Ledger Emulator (Speculos)
   Since you don't have physical hardware, you need to run Speculos [3]. The easiest way to run it without compiling dependencies is via Docker.

Ensure you have Docker installed.

You will need the Ethereum App .elf file (the compiled Ledger app binary). Ledger provides these in their developer portals or via the Ledger App Builder.

Run Speculos in a terminal exposing the APDU ports:

Bash
docker run --rm -it -p 5000:5000 -p 40000:40000 ghcr.io/ledgerhq/speculos --display headless --apdu-port 40000 /path/to/ethereum_app.elf
Note: This creates a virtual Ledger device running the Ethereum app locally on port 40000.

2. Initialize the Backend Project
   Set up your Node.js TypeScript environment and install the necessary Web3, AI, and Ledger DMK packages.

Bash
mkdir society-agent-backend && cd society-agent-backend
npm init -y

# Core dependencies: Express, OpenAI (Agent), Viem (Web3 / USDC)

npm i express dotenv openai viem

# Ledger DMK and the Speculos transport kit

npm i @ledgerhq/device-management-kit @ledgerhq/device-transport-kit-speculos

# TypeScript setup

npm i -D typescript @types/node @types/express tsx
npx tsc --init 3. Build the Starter Backend Skeleton
Create an src/index.ts file. This architecture isolates the AI agent's logic from the physical (or emulated) signing gate.

TypeScript
import express from 'express';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { LedgerDeviceManagementKit } from '@ledgerhq/device-management-kit';
import { SpeculosTransport } from '@ledgerhq/device-transport-kit-speculos';
// Note: verify the exact transport export name in the Ledger DMK TS docs

dotenv.config();

const app = express();
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 1. Initialize the Ledger DMK for the Treasurer
const dmk = new LedgerDeviceManagementKit();

// Connect to the Speculos emulator running in Docker
const emulatorTransport = new SpeculosTransport({
apduPort: 40000,
host: '127.0.0.1'
});
dmk.addTransport(emulatorTransport);

app.post('/api/expenses/upload', async (req, res) => {
const { receiptText, studentWalletAddress } = req.body;

try {
// 2. The Autonomous AI Agent Evaluates the Receipt
const completion = await openai.chat.completions.create({
model: "gpt-4o",
response_format: { type: "json_object" },
messages: [
{
role: "system",
content: "You are a university society expense auditor. Extract the amount, merchant, and items. Decide if the expense is valid (no alcohol, under £100). Return JSON with fields: isValid (boolean), amount (number), reason (string)."
},
{ role: "user", content: receiptText }
]
});

    const agentDecision = JSON.parse(completion.choices[0].message.content || "{}");

    if (!agentDecision.isValid) {
      return res.status(400).json({ status: 'rejected', reason: agentDecision.reason });
    }

    // 3. Draft the USDC Transaction Payload (using Viem or similar)
    // Here you would construct the ERC-20 transfer payload for USDC
    const usdcTransferPayload = {
       to: studentWalletAddress,
       amount: agentDecision.amount,
       // ... blockchain specific data
    };

    // 4. Send to Treasurer's Ledger Queue
    // Instead of executing immediately, the agent queues it for the human-in-the-loop.
    // In a real app, this would save to a database for the Treasurer to view on the React frontend.

    return res.status(200).json({
        status: 'approved_by_agent',
        pending_hardware_signature: true,
        transaction: usdcTransferPayload
    });

} catch (error) {
res.status(500).json({ error: error.message });
}
});

// 5. The Hardware Signing Endpoint (Triggered by the Treasurer via the UI)
app.post('/api/treasurer/sign', async (req, res) => {
// This endpoint connects to the DMK to request a physical button press on the Ledger (Emulator)
// Follow the specific `dmk-ts` docs on how to trigger a web3 signature intent.
res.json({ message: "Sign request sent to Speculos emulator. Press the virtual buttons."});
});

app.listen(3000, () => console.log('Society Agent Backend running on port 3000'));
Next Steps & Tips for the Hackathon
Read the DMK Docs Carefully: The hackathon brief points directly to the DMK TS Integration guide. You will need to check the exact syntax for initiating an EVM signature intent through the DMK.

Run your dev server: You can use npx tsx src/index.ts to run your backend with hot-reloading during the hackathon.

The "Wow" Factor: To hit the "Innovation / originality" score (20%), highlight the hand-off. The agent does 99% of the work (parsing, auditing, drafting the payload), and the Ledger is purely a "dumb" hardware gate that enforces the Treasurer's ultimate authority. Emphasize this boundary in your final pitch.
