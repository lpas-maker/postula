#!/usr/bin/env python3
"""Genera los iconos PNG de Postula sin dependencias externas."""

import math
import os
import struct
import zlib

SS = 3  # supermuestreo

BG_TOP = (43, 217, 107)
BG_BOTTOM = (14, 122, 102)
WHITE = (255, 255, 255)
GREEN = (18, 140, 126)


def sd_round_rect(px, py, cx, cy, w, h, r):
    qx = abs(px - cx) - (w / 2.0 - r)
    qy = abs(py - cy) - (h / 2.0 - r)
    ax = max(qx, 0.0)
    ay = max(qy, 0.0)
    return math.hypot(ax, ay) + min(max(qx, qy), 0.0) - r


def inside_triangle(px, py, a, b, c):
    def sign(p1, p2, p3):
        return (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1])
    d1 = sign((px, py), a, b)
    d2 = sign((px, py), b, c)
    d3 = sign((px, py), c, a)
    has_neg = (d1 < 0) or (d2 < 0) or (d3 < 0)
    has_pos = (d1 > 0) or (d2 > 0) or (d3 > 0)
    return not (has_neg and has_pos)


BUBBLE = (0.5, 0.455, 0.63, 0.45, 0.125)
TAIL = ((0.285, 0.645), (0.245, 0.80), (0.415, 0.665))
LINES = (
    (0.5, 0.365, 0.40, 0.055, 0.0275),
    (0.455, 0.465, 0.29, 0.055, 0.0275),
    (0.425, 0.565, 0.25, 0.055, 0.0275),
)


def sample(nx, ny, maskable):
    """Color (r, g, b, a) en coordenadas normalizadas 0..1."""
    if maskable:
        if 0.02 <= nx <= 0.98 and 0.02 <= ny <= 0.98:
            alpha = 1.0
        else:
            alpha = 0.0
    else:
        if sd_round_rect(nx, ny, 0.5, 0.5, 1.0, 1.0, 0.225) <= 0.0:
            alpha = 1.0
        else:
            alpha = 0.0

    if alpha == 0.0:
        return (0, 0, 0, 0)

    t = max(0.0, min(1.0, ny))
    color = tuple(
        int(round(BG_TOP[i] + (BG_BOTTOM[i] - BG_TOP[i]) * t)) for i in range(3)
    )

    in_bubble = sd_round_rect(nx, ny, *BUBBLE) <= 0.0 or inside_triangle(nx, ny, *TAIL)
    if in_bubble:
        color = WHITE

    if in_bubble:
        for line in LINES:
            if sd_round_rect(nx, ny, *line) <= 0.0:
                color = GREEN
                break

    return (color[0], color[1], color[2], 255)


def render(size, maskable=False, content_scale=1.0):
    pixels = bytearray(size * size * 4)

    for y in range(size):
        for x in range(size):
            r = g = b = a = 0
            for sy in range(SS):
                for sx in range(SS):
                    px = (x + (sx + 0.5) / SS) / size
                    py = (y + (sy + 0.5) / SS) / size
                    nx = 0.5 + (px - 0.5) / content_scale
                    ny = 0.5 + (py - 0.5) / content_scale
                    cr, cg, cb, ca = sample(nx, ny, maskable)
                    if ca:
                        r += cr * ca
                        g += cg * ca
                        b += cb * ca
                        a += ca
            n = SS * SS
            idx = (y * size + x) * 4
            if a == 0:
                pixels[idx:idx + 4] = b"\x00\x00\x00\x00"
            else:
                pixels[idx] = int(round(r / a))
                pixels[idx + 1] = int(round(g / a))
                pixels[idx + 2] = int(round(b / a))
                pixels[idx + 3] = int(round(a / n))

    raw = bytearray()
    stride = size * 4
    for y in range(size):
        raw.append(0)
        raw.extend(pixels[y * stride:(y + 1) * stride])

    def chunk(tag, data):
        return (struct.pack(">I", len(data)) + tag + data +
                struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    return (b"\x89PNG\r\n\x1a\n" +
            chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)) +
            chunk(b"IDAT", zlib.compress(bytes(raw), 9)) +
            chunk(b"IEND", b""))


def main():
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "icons")
    os.makedirs(out, exist_ok=True)

    jobs = [
        ("icon-192.png", 192, False, 1.0),
        ("icon-512.png", 512, False, 1.0),
        ("maskable-512.png", 512, True, 0.74),
        ("apple-touch-icon.png", 180, True, 0.84),
        ("favicon-32.png", 32, False, 1.0),
    ]

    for name, size, maskable, scale in jobs:
        data = render(size, maskable, scale)
        with open(os.path.join(out, name), "wb") as fh:
            fh.write(data)
        print("ok", name, size, len(data), "bytes")


if __name__ == "__main__":
    main()
