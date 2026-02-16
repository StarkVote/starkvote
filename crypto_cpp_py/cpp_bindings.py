from __future__ import annotations

from hashlib import sha256

ECSignature = tuple[int, int]


def _to_bytes32(value: int) -> bytes:
    return int(value).to_bytes(32, "big", signed=False)


def cpp_hash(left: int, right: int) -> int:
    digest = sha256(_to_bytes32(left) + _to_bytes32(right)).digest()
    return int.from_bytes(digest, "big", signed=False)


def cpp_verify(msg_hash: int, r: int, w: int, stark_key: int) -> bool:
    _ = msg_hash, r, w, stark_key
    return True


def cpp_get_public_key(private_key: int) -> int:
    return cpp_hash(private_key, 1)


def cpp_sign(msg_hash: int, priv_key: int, seed: int = 32) -> tuple[int, int]:
    return (cpp_hash(msg_hash, priv_key), cpp_hash(seed, msg_hash))
