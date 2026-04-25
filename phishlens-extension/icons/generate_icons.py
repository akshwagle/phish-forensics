"""
PhishLens Guard - Icon Generator
Generates icon16.png, icon48.png, icon128.png using only Python stdlib.
No external deps needed.
"""
import struct, zlib, os, math

def make_png(size):
    """Generate a minimal PNG with a blue rounded-rect background + white magnifying glass."""
    # Work in RGBA
    img = [[(0, 0, 0, 0)] * size for _ in range(size)]

    pad = size * 0.08
    radius = size * 0.22
    cx = size / 2
    cy = size / 2

    def lerp_color(c1, c2, t):
        return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))

    def in_rounded_rect(x, y):
        l, r, t, b = pad, size - pad, pad, size - pad
        if x < l or x > r or y < t or y > b:
            return False
        # corners
        corners = [(l + radius, t + radius), (r - radius, t + radius),
                   (r - radius, b - radius), (l + radius, b - radius)]
        for (cx2, cy2) in corners:
            if x < l + radius and y < t + radius:
                return math.hypot(x - cx2, y - cy2) <= radius
            if x > r - radius and y < t + radius:
                return math.hypot(x - (r - radius), y - cy2) <= radius
            if x > r - radius and y > b - radius:
                return math.hypot(x - (r - radius), y - (b - radius)) <= radius
            if x < l + radius and y > b - radius:
                return math.hypot(x - cx2, y - (b - radius)) <= radius
        return True

    glass_r = size * 0.22
    glass_x = cx - size * 0.04
    glass_y = cy - size * 0.04
    handle_len = size * 0.18
    line_w = max(1.5, size * 0.07)
    angle = math.pi * 0.75
    hx1 = glass_x + math.cos(angle) * glass_r
    hy1 = glass_y + math.sin(angle) * glass_r
    hx2 = hx1 + math.cos(angle) * handle_len
    hy2 = hy1 + math.sin(angle) * handle_len

    def near_circle(px, py, cx2, cy2, r, lw):
        d = abs(math.hypot(px - cx2, py - cy2) - r)
        return d <= lw / 2

    def near_segment(px, py, ax, ay, bx, by, lw):
        dx, dy = bx - ax, by - ay
        ln = math.hypot(dx, dy)
        if ln == 0:
            return False
        t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (ln * ln)))
        nx, ny = ax + t * dx, ay + t * dy
        return math.hypot(px - nx, py - ny) <= lw / 2

    dot_cx = size - pad - size * 0.08
    dot_cy = size - pad - size * 0.08
    dot_r  = size * 0.07

    for y in range(size):
        for x in range(size):
            # Background
            if in_rounded_rect(x + 0.5, y + 0.5):
                t = (y / size) * 0.5
                bg = lerp_color((59, 130, 246), (29, 78, 216), t)  # blue gradient
                r_ch, g_ch, b_ch = bg
                a_ch = 255
                img[y][x] = (r_ch, g_ch, b_ch, a_ch)

            # Magnifying glass circle
            if near_circle(x + 0.5, y + 0.5, glass_x, glass_y, glass_r, line_w):
                img[y][x] = (255, 255, 255, 255)

            # Handle
            if near_segment(x + 0.5, y + 0.5, hx1, hy1, hx2, hy2, line_w):
                img[y][x] = (255, 255, 255, 255)

            # Yellow accent dot (48+)
            if size >= 48 and math.hypot((x + 0.5) - dot_cx, (y + 0.5) - dot_cy) <= dot_r:
                img[y][x] = (251, 191, 36, 255)

    # Encode PNG
    def write_chunk(chunk_type, data):
        c = chunk_type + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xFFFFFFFF)

    raw_rows = b""
    for row in img:
        raw_rows += b"\x00"  # filter type: None
        for (r2, g2, b2, a2) in row:
            raw_rows += bytes([r2, g2, b2, a2])

    compressed = zlib.compress(raw_rows, 9)

    png = b"\x89PNG\r\n\x1a\n"
    png += write_chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
    # IHDR: width, height, bit_depth=8, color_type=2(RGB) — use 6 for RGBA
    # Let's redo with color_type=6 (RGBA)
    ihdr_data = struct.pack(">II", size, size) + bytes([8, 6, 0, 0, 0])
    png = b"\x89PNG\r\n\x1a\n"
    png += write_chunk(b"IHDR", ihdr_data)
    png += write_chunk(b"IDAT", compressed)
    png += write_chunk(b"IEND", b"")
    return png

out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)))
for sz in [16, 48, 128]:
    data = make_png(sz)
    path = os.path.join(out_dir, f"icon{sz}.png")
    with open(path, "wb") as f:
        f.write(data)
    print(f"Generated: {path} ({len(data)} bytes)")

print("All icons generated successfully.")
