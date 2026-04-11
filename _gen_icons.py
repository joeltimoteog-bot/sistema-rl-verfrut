import struct, zlib, os

def make_png(size, bg_hex, out_path):
    w = h = size
    br = int(bg_hex[1:3], 16)
    bg = int(bg_hex[3:5], 16)
    bb = int(bg_hex[5:7], 16)

    # Letter bitmaps (5 cols x 7 rows)
    R = [
        [1,1,1,1,0],
        [1,0,0,0,1],
        [1,0,0,0,1],
        [1,1,1,1,0],
        [1,0,1,0,0],
        [1,0,0,1,0],
        [1,0,0,0,1],
    ]
    L = [
        [1,0,0,0,0],
        [1,0,0,0,0],
        [1,0,0,0,0],
        [1,0,0,0,0],
        [1,0,0,0,0],
        [1,0,0,0,0],
        [1,1,1,1,1],
    ]

    scale = max(1, int(w * 0.085))
    gap   = scale * 3
    lw    = 5 * scale
    lh    = 7 * scale
    total = lw + gap + lw
    ox    = (w - total) // 2
    oy    = (h - lh)    // 2

    # RGBA grid — background
    grid = [[(br, bg, bb, 255)] * w for _ in range(h)]

    def draw(letter, off_x, off_y):
        for ri, row in enumerate(letter):
            for ci, px in enumerate(row):
                if px:
                    for sy in range(scale):
                        for sx in range(scale):
                            x = off_x + ci * scale + sx
                            y = off_y + ri * scale + sy
                            if 0 <= x < w and 0 <= y < h:
                                grid[y][x] = (255, 255, 255, 255)

    draw(R, ox,          oy)
    draw(L, ox + lw + gap, oy)

    # PNG encoding
    def chunk(tag, data):
        c = tag + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xFFFFFFFF)

    ihdr = chunk(b'IHDR', struct.pack('>II', w, h) + bytes([8, 6, 0, 0, 0]))  # 8-bit RGBA

    raw = b''
    for row in grid:
        raw += b'\x00'  # filter None
        for (r, g, b, a) in row:
            raw += bytes([r, g, b, a])

    idat = chunk(b'IDAT', zlib.compress(raw, 9))
    iend = chunk(b'IEND', b'')

    png = b'\x89PNG\r\n\x1a\n' + ihdr + idat + iend
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'wb') as f:
        f.write(png)
    print(f'OK {out_path}  ({len(png):,} bytes)')

make_png(192, '#0a2463', r'C:\sistema-rl-verfrut\frontend\images\icon-192.png')
make_png(512, '#0a2463', r'C:\sistema-rl-verfrut\frontend\images\icon-512.png')
