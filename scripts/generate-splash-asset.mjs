import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const width = 512;
const height = 512;
const bytesPerPixel = 4;
const stride = width * bytesPerPixel + 1;
const raw = Buffer.alloc(stride * height);

for (let y = 0; y < height; y += 1) raw[y * stride] = 0;

function setPixel(x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const offset = y * stride + 1 + x * bytesPerPixel;
  raw[offset] = r;
  raw[offset + 1] = g;
  raw[offset + 2] = b;
  raw[offset + 3] = a;
}

function fillCircle(cx, cy, radius, color) {
  const r2 = radius * radius;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) setPixel(x, y, ...color);
    }
  }
}

function fillRoundedLine(x1, x2, y, halfHeight, color) {
  for (let yy = y - halfHeight; yy <= y + halfHeight; yy += 1) {
    for (let x = x1; x <= x2; x += 1) setPixel(x, yy, ...color);
  }
  fillCircle(x1, y, halfHeight, color);
  fillCircle(x2, y, halfHeight, color);
}

function fillDiamond(cx, cy, radius, color) {
  for (let dy = -radius; dy <= radius; dy += 1) {
    const span = radius - Math.abs(dy);
    for (let dx = -span; dx <= span; dx += 1) setPixel(cx + dx, cy + dy, ...color);
  }
}

const amber = [247, 185, 85, 255];
const coral = [247, 123, 94, 255];
const mint = [128, 220, 196, 255];
const softMint = [128, 220, 196, 150];
const white = [255, 255, 255, 255];

fillRoundedLine(154, 358, 256, 5, softMint);
fillCircle(138, 256, 54, amber);
fillCircle(374, 256, 54, coral);
fillCircle(138, 256, 28, white);
fillCircle(374, 256, 28, white);
fillCircle(256, 256, 64, [7, 31, 42, 255]);
fillCircle(256, 256, 56, mint);
fillCircle(256, 256, 45, [7, 31, 42, 255]);
fillDiamond(256, 256, 30, white);
fillDiamond(256, 256, 13, amber);

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
  return Buffer.concat([length, name, data, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(width, 0);
ihdr.writeUInt32BE(height, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const output = path.resolve('assets/splash-emblem.png');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, png);
console.log(`Generated ${output} (${png.length} bytes)`);
