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
docker rm -f speculos-eth >/dev/null 2>&1
exec docker run --rm --name speculos-eth \
  -v "$APP_ELF:/app.elf:ro" -p 127.0.0.1:5001:5000 \
  --entrypoint speculos ghcr.io/ledgerhq/ledger-app-builder/ledger-app-dev-tools:latest \
  --model nanosp --display headless --pki-prod --api-port 5000 \
  ${SPECULOS_SEED:+--seed "$SPECULOS_SEED"} /app.elf
