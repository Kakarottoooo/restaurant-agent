#!/usr/bin/env node
/**
 * Generates minimal valid PNG icons for PWA manifest.
 * No external dependencies — uses only Node.js built-ins.
 *
 * Icon design: gold (#C9A84C) background, white "F" lettermark.
 * The "F" is rendered as filled rectangles to avoid needing a font renderer.
 */

import { deflateSync } from "zlib";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { join, dirname } from "path";

const __dir = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dir, "..", "public");

// ─── CRC32 ──────────────────────────────────────────────────────────────────

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++)
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u32(n) {
  const b = Buffer.allocUnsafe(4);
  b.writeUInt32BE(n, 0);
  return b;
}

function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const crc = crc32(Buffer.concat([t, d]));
  return Buffer.concat([u32(d.length), t, d, u32(crc)]);
}

// ─── PNG builder ────────────────────────────────────────────────────────────

/**
 * Creates a PNG file for a square image described by `pixels`,
 * where each pixel is [r, g, b].
 */
function buildPNG(pixels, size) {
  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.concat([
    u32(size), // width
    u32(size), // height
    Buffer.from([8, 2, 0, 0, 0]), // 8-bit RGB, no filter, no interlace
  ]);

  // Raw image data: filter byte 0 (None) + RGB for each row
  const raw = Buffer.allocUnsafe(size * (1 + size * 3));
  let pos = 0;
  for (let y = 0; y < size; y++) {
    raw[pos++] = 0; // filter byte
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixels[y * size + x];
      raw[pos++] = r;
      raw[pos++] = g;
      raw[pos++] = b;
    }
  }

  const idat = deflateSync(raw, { level: 6 });

  return Buffer.concat([
    PNG_SIG,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ─── Icon pixel drawing ─────────────────────────────────────────────────────

/**
 * Returns an array of [r,g,b] pixels for a size×size icon:
 * - Gold background (#C9A84C)
 * - Rounded white rectangle as an "F" lettermark
 */
function drawIcon(size) {
  const GOLD = [0xc9, 0xa8, 0x4c];
  const WHITE = [0xff, 0xff, 0xff];

  const pixels = Array.from({ length: size * size }, () => [...GOLD]);

  function fillRect(x0, y0, w, h) {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        if (x >= 0 && x < size && y >= 0 && y < size) {
          pixels[y * size + x] = [...WHITE];
        }
      }
    }
  }

  // Draw "F" as white rectangles, proportional to icon size
  const margin = Math.round(size * 0.28);
  const stroke = Math.max(2, Math.round(size * 0.1));
  const height = size - margin * 2;

  // Vertical bar of F
  fillRect(margin, margin, stroke, height);
  // Top horizontal bar
  fillRect(margin, margin, Math.round(size * 0.42), stroke);
  // Middle horizontal bar (shorter)
  fillRect(margin, Math.round(size * 0.48), Math.round(size * 0.32), stroke);

  return pixels;
}

// ─── Generate and write ─────────────────────────────────────────────────────

for (const size of [192, 512]) {
  const pixels = drawIcon(size);
  const png = buildPNG(pixels, size);
  const outPath = join(publicDir, `icon-${size}.png`);
  writeFileSync(outPath, png);
  console.log(`✓ Wrote ${outPath} (${png.length} bytes)`);
}
