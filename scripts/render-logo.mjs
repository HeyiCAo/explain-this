import fs from 'node:fs';
import zlib from 'node:zlib';

const sizes = [16, 32, 48, 128];

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffers) {
  let c = 0xffffffff;
  for (const buffer of buffers) {
    for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  typeBuffer.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32([typeBuffer, data]), 8 + data.length);
  return out;
}

function writePng(path, width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    rgba.copy(raw, row + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  fs.writeFileSync(path, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND'),
  ]));
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function lerpColor(a, b, t) {
  return [
    Math.round(mix(a[0], b[0], t)),
    Math.round(mix(a[1], b[1], t)),
    Math.round(mix(a[2], b[2], t)),
    Math.round(mix(a[3], b[3], t)),
  ];
}

function bgColor(x, y) {
  const blue = [77, 163, 255, 255];
  const deep = [37, 99, 235, 255];
  const teal = [19, 194, 163, 255];
  const t = Math.max(0, Math.min(1, (x + y - 30) / 180));
  if (t < 0.56) return lerpColor(blue, deep, t / 0.56);
  return lerpColor(deep, teal, (t - 0.56) / 0.44);
}

function insideRoundRect(x, y, rx, ry, rw, rh, rr) {
  const cx = Math.max(rx + rr, Math.min(x, rx + rw - rr));
  const cy = Math.max(ry + rr, Math.min(y, ry + rh - rr));
  return (x - cx) ** 2 + (y - cy) ** 2 <= rr ** 2;
}

function insideRect(x, y, rx, ry, rw, rh) {
  return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
}

function insideDiamond(x, y, cx, cy, r) {
  return Math.abs(x - cx) + Math.abs(y - cy) <= r;
}

function insideTriangle(x, y, a, b, c) {
  const area = (p1, p2, p3) => Math.abs((p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y)) / 2);
  const whole = area(a, b, c);
  const sum = area({ x, y }, b, c) + area(a, { x, y }, c) + area(a, b, { x, y });
  return Math.abs(whole - sum) < 0.4;
}

function composite(base, over) {
  const alpha = over[3] / 255;
  const inv = 1 - alpha;
  return [
    Math.round(over[0] * alpha + base[0] * inv),
    Math.round(over[1] * alpha + base[1] * inv),
    Math.round(over[2] * alpha + base[2] * inv),
    Math.round((alpha + base[3] / 255 * inv) * 255),
  ];
}

function sample(x, y) {
  let color = [0, 0, 0, 0];
  if (insideRoundRect(x, y, 10, 10, 108, 108, 28)) color = bgColor(x, y);

  const bubble = insideRoundRect(x, y, 15, 36, 84, 52, 19)
    || insideTriangle(x, y, { x: 40, y: 82 }, { x: 37, y: 101 }, { x: 63, y: 82 });
  if (bubble) color = composite(color, [255, 255, 255, 245]);

  if (insideRoundRect(x, y, 35, 54, 40, 7, 3.5)) color = [31, 111, 235, 255];
  if (insideRoundRect(x, y, 35, 69, 28, 7, 3.5)) color = [122, 167, 255, 255];
  if (insideDiamond(x, y, 82.5, 61.3, 9)) color = [19, 194, 163, 255];
  if (insideDiamond(x, y, 98, 30, 6)) color = composite(color, [184, 247, 232, 242]);

  return color;
}

function render(size) {
  const scale = 128 / size;
  const rgba = Buffer.alloc(size * size * 4);
  const samples = size <= 32 ? 4 : 3;
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const acc = [0, 0, 0, 0];
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const c = sample((px + (sx + 0.5) / samples) * scale, (py + (sy + 0.5) / samples) * scale);
          for (let i = 0; i < 4; i += 1) acc[i] += c[i];
        }
      }
      const index = (py * size + px) * 4;
      const divisor = samples * samples;
      for (let i = 0; i < 4; i += 1) rgba[index + i] = Math.round(acc[i] / divisor);
    }
  }
  return rgba;
}

for (const size of sizes) {
  writePng(`public/icon${size}.png`, size, size, render(size));
}
