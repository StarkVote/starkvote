#!/usr/bin/env python3
"""
Generate Worldcoin-compatible full_proof_with_hints from Semaphore proof outputs.

Inputs:
  - zk/samples/proof.json          (snarkjs proof object with pi_a/pi_b/pi_c)
  - zk/samples/public.json         (must contain publicSignals array)
  - zk/artifacts/verification_key.json
  - zk/.local/proof_config.json    (poll_id, option)

Output:
  - zk/samples/worldcoin_calldata.json
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path


def _normalize_proof_for_garaga(proof_data):
    """
    Accept Semaphore proof outputs and convert to a snarkjs-like Groth16 dict.

    Supported inputs:
    - snarkjs object: {"pi_a": ..., "pi_b": ..., "pi_c": ...}
    - Semaphore v3 packed array of 8 elements:
      [a0, a1, b01, b00, b11, b10, c0, c1]
    - Semaphore v4 object with "points" array in the same packed order.
    """
    if isinstance(proof_data, dict):
        if all(k in proof_data for k in ("pi_a", "pi_b", "pi_c")):
            return {
                "curve": proof_data.get("curve", "bn128"),
                "proof": {
                    "a": proof_data["pi_a"],
                    "b": proof_data["pi_b"],
                    "c": proof_data["pi_c"],
                },
            }

        if all(k in proof_data for k in ("a", "b", "c")):
            return {"curve": proof_data.get("curve", "bn128"), "proof": proof_data}

        points = proof_data.get("points")
        if isinstance(points, list):
            proof_data = points
        else:
            raise ValueError("Unsupported proof object format. Expected pi_a/pi_b/pi_c or points.")

    if isinstance(proof_data, list):
        if len(proof_data) != 8:
            raise ValueError("Packed proof list must have exactly 8 elements.")

        a0, a1, b01, b00, b11, b10, c0, c1 = [str(x) for x in proof_data]
        return {
            "curve": "bn128",
            "proof": {
                "a": [a0, a1, "1"],
                "b": [[b00, b01], [b10, b11], ["1", "0"]],
                "c": [c0, c1, "1"],
            },
        }

    raise ValueError("Unsupported proof format. Expected object or list.")


def main() -> int:
    root = Path(__file__).resolve().parents[2]
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))

    from garaga.starknet.groth16_contract_generator.calldata import (  # pylint: disable=import-error
        groth16_calldata_from_vk_and_proof,
    )
    from garaga.starknet.groth16_contract_generator.parsing_utils import (  # pylint: disable=import-error
        Groth16Proof,
        Groth16VerifyingKey,
    )

    zk_dir = root / "zk"
    proof_path = zk_dir / "samples" / "proof.json"
    public_path = zk_dir / "samples" / "public.json"
    config_path = zk_dir / ".local" / "proof_config.json"
    vk_path = zk_dir / "artifacts" / "verification_key30.json"
    zkey_path = zk_dir / "artifacts" / "semaphore30.zkey"
    local_vk_path = zk_dir / ".local" / "vk_from_zkey30.json"
    out_path = zk_dir / "samples" / "worldcoin_calldata.json"

    required = [proof_path, public_path, config_path, vk_path]
    missing = [str(p) for p in required if not p.exists()]
    if missing:
        print("Missing required files:")
        for file in missing:
            print(f"  - {file}")
        return 1

    # Prefer a VK exported from the exact zkey used for proving so proof/VK cannot drift.
    if zkey_path.exists():
        try:
            local_vk_path.parent.mkdir(parents=True, exist_ok=True)
            npx_bin = shutil.which("npx.cmd") or shutil.which("npx")
            if not npx_bin:
                raise FileNotFoundError("npx not found in PATH")
            subprocess.run(
                [
                    npx_bin,
                    "snarkjs",
                    "zkey",
                    "export",
                    "verificationkey",
                    str(zkey_path),
                    str(local_vk_path),
                ],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            vk_path = local_vk_path
            print(f"Using VK exported from zkey: {vk_path}")
        except Exception as err:  # pylint: disable=broad-except
            print(f"Warning: could not export VK from zkey, falling back to artifacts VK. {err}")

    with proof_path.open("r", encoding="utf-8") as f:
        proof_data = json.load(f)
    with public_path.open("r", encoding="utf-8") as f:
        public_data = json.load(f)
    with config_path.open("r", encoding="utf-8") as f:
        config = json.load(f)

    public_signals = public_data.get("publicSignals")
    if not isinstance(public_signals, list) or len(public_signals) < 4:
        print("public.json must contain publicSignals array with at least 4 entries")
        return 1

    vk = Groth16VerifyingKey.from_json(vk_path)
    normalized_proof = _normalize_proof_for_garaga(proof_data)
    proof = Groth16Proof.from_dict(normalized_proof, public_signals)
    calldata = groth16_calldata_from_vk_and_proof(vk, proof)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    output = {
        "poll_id": int(config["poll_id"]),
        "option": int(config["option"]),
        "full_proof_with_hints_len": len(calldata),
        "full_proof_with_hints": [hex(x) for x in calldata],
        "public_signals": [str(x) for x in public_signals],
    }
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    print(f"Generated {out_path}")
    print(f"Calldata length: {len(calldata)} felts")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
