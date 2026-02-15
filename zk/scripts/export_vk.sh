#!/bin/bash
# Export verification key from Semaphore circuit (depth 30 for WorldCoin compatibility)

# Create artifacts directory if it doesn't exist
mkdir -p artifacts

# Export VK for depth 30 (matches WorldCoin's verifier)
npx snarkjs zkey export verificationkey \
  node_modules/@zk-kit/semaphore-artifacts/semaphore-30.zkey \
  artifacts/verification_key_30.json

echo "✅ Verification key for depth 30 exported to artifacts/verification_key_30.json"

# Also keep depth 20 for reference
npx snarkjs zkey export verificationkey \
  node_modules/@zk-kit/semaphore-artifacts/semaphore-20.zkey \
  artifacts/verification_key_20.json

echo "✅ Verification key for depth 20 exported to artifacts/verification_key_20.json"
