// QAS33 — PWA icon generator (run once: `bun scripts/generate-icons.ts`)
// Renders a navy rounded-square shield with gold "Q33" text to PNG 192 + 512
// using the installed `sharp` package (no external assets needed).

import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = join(process.cwd(), "public");

const SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#052a9e"/>
      <stop offset="1" stop-color="#020f3f"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <path d="M256 84 L392 132 V250 c0 92-58 148-136 178 C178 398 120 342 120 250 V132 Z"
        fill="none" stroke="#fccf03" stroke-width="18" stroke-linejoin="round"/>
  <path d="M256 130 L350 165 V252 c0 68-42 110-94 132 C204 362 162 320 162 252 V165 Z"
        fill="#fccf03" fill-opacity="0.12"/>
  <text x="256" y="286" text-anchor="middle"
        font-family="'Arial Black', Arial, Helvetica, sans-serif"
        font-size="120" font-weight="900" fill="#fccf03" letter-spacing="4">Q33</text>
  <text x="256" y="344" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif"
        font-size="34" font-weight="700" fill="#dbe2f8" letter-spacing="6">PIO DURAN</text>
</svg>
`;

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const size of [192, 512]) {
    const out = join(OUT_DIR, `icon-${size}.png`);
    await sharp(Buffer.from(SVG)).resize(size, size).png().toFile(out);
    console.log(`wrote ${out} (${size}x${size})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
