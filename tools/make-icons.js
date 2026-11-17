// Generates the app icons (PNG) without external dependencies: node tools/make-icons.js
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const BG = [0x1f, 0x4f, 0xd1];
const FG = [0xff, 0xff, 0xff];

// Shapes in a 0..1 coordinate space: rounded rectangles {x, y, w, h, r}
function barbell(scale) {
  const s = (v) => 0.5 + (v - 0.5) * scale;
  const rect = (x, y, w, h, r) => ({ x: s(x), y: s(y), w: w * scale, h: h * scale, r: r * scale });
  return [
    rect(0.14, 0.475, 0.72, 0.05, 0.02),  // bar
    rect(0.22, 0.30, 0.085, 0.40, 0.03),  // big plate left
    rect(0.695, 0.30, 0.085, 0.40, 0.03), // big plate right
    rect(0.315, 0.36, 0.055, 0.28, 0.025),// small plate left
    rect(0.63, 0.36, 0.055, 0.28, 0.025), // small plate right
    rect(0.10, 0.44, 0.04, 0.12, 0.015),  // collar left
    rect(0.86, 0.44, 0.04, 0.12, 0.015),  // collar right
  ];
}

function inRoundRect(px, py, q) {
  if (px < q.x || px > q.x + q.w || py < q.y || py > q.y + q.h) return false;
  const cx = Math.min(Math.max(px, q.x + q.r), q.x + q.w - q.r);
  const cy = Math.min(Math.max(py, q.y + q.r), q.y + q.h - q.r);
  return (px - cx) ** 2 + (py - cy) ** 2 <= q.r ** 2;
}

function render(size, scale) {
  const shapes = barbell(scale);
  const SS = 4; // supersampling for smooth edges
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let hits = 0;
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const px = (x + (sx + 0.5) / SS) / size, py = (y + (sy + 0.5) / SS) / size;
          if (shapes.some((q) => inRoundRect(px, py, q))) hits++;
        }
      const a = hits / (SS * SS);
      const o = y * (size * 3 + 1) + 1 + x * 3;
      for (let c = 0; c < 3; c++) raw[o + c] = Math.round(BG[c] * (1 - a) + FG[c] * a);
    }
  }
  return png(size, size, raw);
}

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(w, h, raw) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const out = path.join(__dirname, "..", "icons");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "apple-touch-icon.png"), render(180, 1));
fs.writeFileSync(path.join(out, "icon-192.png"), render(192, 1));
fs.writeFileSync(path.join(out, "icon-512.png"), render(512, 1));
fs.writeFileSync(path.join(out, "icon-maskable-512.png"), render(512, 0.78));
console.log("icons written to", out);
