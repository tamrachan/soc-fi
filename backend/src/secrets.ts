import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import "dotenv/config";

// Where the LLM key came from, reported by GET /api/status.
export type SecretsSource = "keyring" | "env" | "none";

const root = path.join(import.meta.dirname, "..");

// Secrets sealed with Ledger Key Ring (scripts/keyring.cjs) are decrypted into this process's
// environment only; nothing is written back to disk. A value set in plain .env wins, so the
// backend still starts if Ledger's Key Ring service cannot be reached.
function load(): { source: SecretsSource; ring?: string } {
  const plain = Boolean(process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY);
  if (!existsSync(path.join(root, "secrets.enc"))) return { source: plain ? "env" : "none" };
  if (plain) {
    console.warn("LLM_API_KEY is set in plain .env; the Key Ring copy in secrets.enc is ignored");
    return { source: "env" };
  }
  try {
    const out = execFileSync(process.execPath, [path.join(root, "scripts/keyring.cjs"), "open"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
      timeout: 60_000,
    });
    const { vars, rootId } = JSON.parse(out) as { vars: Record<string, string>; rootId: string };
    for (const [name, value] of Object.entries(vars)) process.env[name] ??= value;
    console.log(`Secrets decrypted with Ledger Key Ring (ring ${rootId.slice(0, 12)}…): ${Object.keys(vars).join(", ")}`);
    return { source: "keyring", ring: rootId };
  } catch {
    console.error("Could not decrypt secrets.enc with Ledger Key Ring; the agent will decline every claim");
    return { source: "none" };
  }
}

export const secrets = load();
