// Ledger Key Ring for the backend's secrets.
//
// The LLM API key is not kept in .env. It is encrypted into secrets.enc with a key that lives in
// a Ledger Key Ring: the ring is created from the Ledger's seed, and this machine may only join
// it after an approval on the device. At start the backend asks Ledger's Key Ring service for
// the key (no device needed) and decrypts secrets.enc in memory.
//
//   npm run keyring -- init      once, with "npm run speculos:sync" running: join the ring
//   npm run keyring -- seal      move LLM_API_KEY from .env into secrets.enc
//   npm run keyring -- unseal    put it back into .env and delete secrets.enc
//   npm run keyring -- status
//   (open: used by src/secrets.ts; prints the decrypted variables as JSON on stdout)
//
// Plain CommonJS run by node: tsx resolves @ledgerhq/ledger-key-ring-protocol to its TypeScript
// sources, which fail to load. We use Ledger's staging service, because an emulated device signs
// with the public test key and is not expected to be accepted by production.
const path = require("node:path");
const fs = require("node:fs");
const dotenv = require("dotenv");

const ROOT = path.join(__dirname, "..");
const ENV_FILE = path.join(ROOT, ".env");
const SEALED_FILE = path.join(ROOT, "secrets.enc");
const STATE_FILE = path.join(ROOT, "data", "keyring.json"); // this machine's membership
dotenv.config({ path: ENV_FILE, quiet: true });

const apiBaseUrl = process.env.KEYRING_API ?? "https://trustchain-backend.api.aws.stg.ldg-tech.com";
const applicationId = Number(process.env.KEYRING_APPLICATION_ID ?? 17);
const syncPort = process.env.SYNC_SPECULOS_PORT ?? "5002";
const DEFAULT_SECRETS = ["LLM_API_KEY"];

function sdk() {
  const { getSdk } = require("@ledgerhq/ledger-key-ring-protocol");
  const { from, mergeMap, finalize } = require("rxjs");
  const withDevice = () => (fn) => {
    const Speculos = require("@ledgerhq/hw-transport-node-speculos-http");
    const Transport = Speculos.default ?? Speculos;
    return from(Transport.open({ baseURL: "http://127.0.0.1", apiPort: syncPort })).pipe(
      mergeMap((transport) => fn(transport).pipe(finalize(() => transport.close()))),
    );
  };
  return getSdk(false, { applicationId, name: "socfi-backend", apiBaseUrl }, withDevice);
}

function membership() {
  if (!fs.existsSync(STATE_FILE))
    throw new Error("This machine has not joined a Key Ring yet. Run: npm run keyring -- init");
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
}

// Fetches the ring's encryption key from Ledger's service. It is never written to disk.
async function ring() {
  const { memberCredentials, rootId } = membership();
  const ring = await sdk().restoreTrustchain({ rootId }, memberCredentials);
  return { sdk: sdk(), ring };
}

async function init() {
  const client = sdk();
  const memberCredentials = fs.existsSync(STATE_FILE)
    ? membership().memberCredentials
    : await client.initMemberCredentials();
  console.error(`Approve on the Ledger Sync emulator: http://127.0.0.1:${syncPort}`);
  console.error('(press Right to page through, Both on "Connect" and on "Turn On sync")');
  const result = await client.getOrCreateTrustchain("speculos", memberCredentials);
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify({ memberCredentials, rootId: result.trustchain.rootId, applicationPath: result.trustchain.applicationPath }),
    { mode: 0o600 },
  );
  console.error(`Key Ring ${result.type}: ${result.trustchain.rootId.slice(0, 12)}… (${result.trustchain.applicationPath})`);
}

async function open() {
  const sealed = JSON.parse(fs.readFileSync(SEALED_FILE, "utf8"));
  const { sdk: client, ring: r } = await ring();
  const plain = await client.decryptUserData(r, Buffer.from(sealed.data, "base64"));
  return { vars: JSON.parse(Buffer.from(plain).toString("utf8")), rootId: r.rootId };
}

async function seal(names) {
  const env = dotenv.parse(fs.readFileSync(ENV_FILE));
  const vars = fs.existsSync(SEALED_FILE) ? (await open()).vars : {};
  const moved = names.filter((name) => env[name]);
  if (!moved.length) throw new Error(`None of ${names.join(", ")} is set in .env`);
  for (const name of moved) vars[name] = env[name];

  const { sdk: client, ring: r } = await ring();
  const data = await client.encryptUserData(r, Buffer.from(JSON.stringify(vars)));
  fs.writeFileSync(
    SEALED_FILE,
    JSON.stringify({ ring: r.rootId, applicationPath: r.applicationPath, names: Object.keys(vars), data: Buffer.from(data).toString("base64") }, null, 2),
  );
  // Only now that the ciphertext is on disk and decrypts, take the plain values out of .env.
  const check = (await open()).vars;
  if (moved.some((name) => check[name] !== env[name])) throw new Error("Sealed file did not decrypt to the same values; .env left unchanged");
  const lines = fs.readFileSync(ENV_FILE, "utf8").split("\n").map((line) => {
    const name = moved.find((n) => new RegExp(`^\\s*(export\\s+)?${n}\\s*=`).test(line));
    return name ? `# ${name} is sealed with Ledger Key Ring (secrets.enc)` : line;
  });
  fs.writeFileSync(ENV_FILE, lines.join("\n"));
  console.error(`Sealed ${moved.join(", ")} into secrets.enc and removed from .env`);
}

async function unseal() {
  const { vars } = await open();
  let text = fs.readFileSync(ENV_FILE, "utf8");
  for (const [name, value] of Object.entries(vars)) {
    const marker = `# ${name} is sealed with Ledger Key Ring (secrets.enc)`;
    const line = `${name}=${JSON.stringify(value)}`;
    text = text.includes(marker) ? text.replace(marker, line) : `${text.replace(/\n*$/, "\n")}${line}\n`;
  }
  fs.writeFileSync(ENV_FILE, text);
  fs.rmSync(SEALED_FILE);
  console.error(`Restored ${Object.keys(vars).join(", ")} to .env and deleted secrets.enc`);
}

function status() {
  const joined = fs.existsSync(STATE_FILE);
  console.error(`Service:  ${apiBaseUrl} (application ${applicationId})`);
  console.error(`Member:   ${joined ? `joined ring ${membership().rootId.slice(0, 12)}…` : "not joined (run init)"}`);
  if (fs.existsSync(SEALED_FILE)) {
    const sealed = JSON.parse(fs.readFileSync(SEALED_FILE, "utf8"));
    console.error(`Sealed:   ${sealed.names.join(", ")} (ring ${sealed.ring.slice(0, 12)}…)`);
  } else console.error("Sealed:   nothing (secrets.enc does not exist)");
}

const [command, ...args] = process.argv.slice(2);
const commands = {
  init,
  seal: () => seal(args.length ? args : DEFAULT_SECRETS),
  unseal,
  status,
  // The only command that writes a secret to stdout; src/secrets.ts reads it through a pipe.
  open: async () => process.stdout.write(JSON.stringify(await open())),
};
if (!commands[command]) {
  console.error("Usage: npm run keyring -- init | seal [NAME...] | unseal | status");
  process.exit(2);
}
Promise.resolve(commands[command]()).then(
  () => process.exit(0),
  (error) => {
    console.error(`Key Ring: ${error?.message ?? error}`);
    process.exit(1);
  },
);
