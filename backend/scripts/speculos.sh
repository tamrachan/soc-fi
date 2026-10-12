#!/bin/sh
# Starts the emulated Ledger (Nano S Plus, Ethereum app) with its REST API and web UI on :5001.
# --pki-prod is required: without it the device rejects Ledger's token metadata
# and every ERC-20 transfer falls back to blind signing.
# The app binary is bundled in speculos/; set ETH_APP_ELF to use another build.
APP_ELF="${ETH_APP_ELF:-$(cd "$(dirname "$0")/../speculos" && pwd)/ethereum-nanosp.elf}"
if [ ! -f "$APP_ELF" ]; then
  echo "Ethereum app not found at $APP_ELF" >&2
  exit 1
fi
# The seed decides the wallet address. Without one Speculos uses its default seed, which is public.
ENV_FILE="$(dirname "$0")/../.env"
if [ -z "$SPECULOS_SEED" ] && [ -f "$ENV_FILE" ]; then
  SPECULOS_SEED="$(sed -n 's/^SPECULOS_SEED=//p' "$ENV_FILE" | tail -1 | tr -d "\"'")"
fi
[ -n "$SPECULOS_SEED" ] || echo "No SPECULOS_SEED set: using the public default seed" >&2
docker rm -f speculos-eth >/dev/null 2>&1
exec docker run --rm --name speculos-eth \
  -v "$APP_ELF:/app.elf:ro" -p 127.0.0.1:5001:5000 \
  --entrypoint speculos ghcr.io/ledgerhq/ledger-app-builder/ledger-app-dev-tools:latest \
  --model nanosp --display headless --pki-prod --api-port 5000 \
  ${SPECULOS_SEED:+--seed "$SPECULOS_SEED"} /app.elf
