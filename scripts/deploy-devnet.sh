#!/usr/bin/env bash
# Deploys the program to devnet from Docker, then runs the one-time setup.
# Needs ~3 SOL on keys/admin.json (devnet faucet: https://faucet.solana.com).
set -euo pipefail
cd "$(dirname "$0")/.."
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W 2>/dev/null || pwd):/work" -v kazisafe-cargo:/root/.cargo/registry -w /work solanafoundation/anchor:v1.0.2 \
  bash -c "solana program deploy -u devnet -k keys/admin.json --program-id target/deploy/kazisafe-keypair.json target/deploy/kazisafe.so"
cd server && RPC_URL=https://api.devnet.solana.com npx tsx scripts/setup-devnet.ts
