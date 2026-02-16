from __future__ import annotations


def _to_int(value: str | int) -> int:
    if isinstance(value, int):
        return value
    return int(value, 0)


def _inv_mod(x: int, p: int) -> int:
    if x % p == 0:
        raise ZeroDivisionError("inverse does not exist")
    return pow(x, p - 2, p)


def _ec_add(p1: tuple[int, int], p2: tuple[int, int], p: int, a: int) -> tuple[int, int]:
    if p1 == (0, 0):
        return p2
    if p2 == (0, 0):
        return p1

    x1, y1 = p1
    x2, y2 = p2
    if x1 == x2 and (y1 + y2) % p == 0:
        return (0, 0)

    if x1 == x2 and y1 == y2:
        lam = (3 * x1 * x1 + a) * _inv_mod((2 * y1) % p, p)
    else:
        lam = (y2 - y1) * _inv_mod((x2 - x1) % p, p)

    lam %= p
    x3 = (lam * lam - x1 - x2) % p
    y3 = (lam * (x1 - x3) - y1) % p
    return (x3, y3)


def _ec_mul(point: tuple[int, int], scalar: int, p: int, a: int) -> tuple[int, int]:
    if scalar == 0 or point == (0, 0):
        return (0, 0)
    if scalar < 0:
        x, y = point
        return _ec_mul((x, (-y) % p), -scalar, p, a)

    result = (0, 0)
    addend = point
    k = scalar
    while k > 0:
        if k & 1:
            result = _ec_add(result, addend, p, a)
        addend = _ec_add(addend, addend, p, a)
        k >>= 1
    return result


def add(
    px: str | int,
    py: str | int,
    qx: str | int,
    qy: str | int,
    p: str | int,
    a: str | int,
    b: str | int,
    n: str | int,
    gx: str | int,
    gy: str | int,
) -> tuple[int, int]:
    _ = b, n, gx, gy
    return _ec_add((_to_int(px), _to_int(py)), (_to_int(qx), _to_int(qy)), _to_int(p), _to_int(a))


def mul(
    px: str | int,
    py: str | int,
    k: str | int,
    p: str | int,
    a: str | int,
    b: str | int,
    n: str | int,
    gx: str | int,
    gy: str | int,
) -> tuple[int, int]:
    _ = b, n, gx, gy
    return _ec_mul((_to_int(px), _to_int(py)), _to_int(k), _to_int(p), _to_int(a))
