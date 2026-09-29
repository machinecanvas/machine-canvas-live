// Builds the "print on a wall" feature photo for each launch product by
// placing the real design onto an empty-room photo at true scale.
//
//   node scripts/room-mockups.mjs
//
// Placement lives in mockups/room-mockups.json. For each product:
//   room      - photo in mockups/rooms/ with a straight-on, empty wall
//   design    - the product image in public/products/
//   pxPerCm   - scale of the wall, measured from furniture of known size
//   centerX   - horizontal centre of the print on the wall (px)
//   top       - top edge of the print (px)
//   widthCm, heightCm - the print size; the design is centre-cropped to
//               that shape, as it would be printed
// Optional:
//   keepDarkerThan - room pixels darker than this (0-255) stay in front of
//                    the print, e.g. a black pendant lamp or leaves
//   keep           - [[x, y, w, h], …] room areas that stay in front
//   featherPx      - soften the print's edges into the wall
//   whiten         - [lo, hi] luminance: pixels brighter than lo fade to
//                    white by hi, so an off-white design background (e.g.
//                    painted plaster) disappears into the wall like white does
//
// The design is multiplied onto the wall, the way ink behaves on paint:
// its white background disappears into the wall colour and the room's own
// light and shadow carry across the print.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(fs.readFileSync(path.join(root, "mockups/room-mockups.json"), "utf8"));

for (const job of config) {
  const roomPath = path.join(root, "mockups/rooms", job.room);
  if (!fs.existsSync(roomPath)) {
    console.warn(`skip ${job.slug}: ${job.room} not found`);
    continue;
  }
  if (!job.pxPerCm) {
    console.warn(`skip ${job.slug}: placement not measured yet`);
    continue;
  }
  const widthPx = Math.round(job.widthCm * job.pxPerCm);
  const heightPx = Math.round(job.heightCm * job.pxPerCm);
  let print = await sharp(path.join(root, "public/products", `${job.slug}.webp`))
    .resize(widthPx, heightPx, { fit: "cover", position: "centre" })
    .removeAlpha()
    .raw()
    .toBuffer();
  if (job.whiten) print = whitenHighlights(print, job.whiten);
  print = await sharp(print, { raw: { width: widthPx, height: heightPx, channels: 3 } }).png().toBuffer();

  const out = path.join(root, "public/products", `${job.slug}-room.webp`);
  const left = Math.round(job.centerX - widthPx / 2);
  const top = Math.round(job.top);
  const mask = await printMask(roomPath, job, { left, top, widthPx, heightPx });
  const printWithAlpha = await sharp(print).joinChannel(mask).png().toBuffer();

  // Composite at the room's full size first: sharp applies resize before
  // composite within one pipeline, which would shift the placement.
  const composed = await sharp(roomPath)
    .composite([{ input: printWithAlpha, left, top, blend: "multiply" }])
    .toBuffer();
  await sharp(composed).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82 }).toFile(out);
  console.log(`${job.slug}: ${widthPx}×${heightPx}px print -> ${path.relative(root, out)}`);
}

/** Greyscale mask (255 = print shows) combining edge feathering and occluders. */
async function printMask(roomPath, job, { left, top, widthPx, heightPx }) {
  const f = job.featherPx ?? 0;
  const rects = (job.keep ?? [])
    .map(([x, y, w, h]) => `<rect x="${x - left}" y="${y - top}" width="${w}" height="${h}" fill="black"/>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}">
    <rect width="100%" height="100%" fill="black"/>
    <rect x="${f}" y="${f}" width="${widthPx - 2 * f}" height="${heightPx - 2 * f}" fill="white"/>${rects}</svg>`;
  let mask = sharp(Buffer.from(svg)).greyscale();
  if (f > 0) mask = mask.blur(f / 2);
  let maskBuf = await mask.raw().toBuffer();

  if (job.keepDarkerThan) {
    const room = await sharp(roomPath)
      .extract({ left, top, width: widthPx, height: heightPx })
      .greyscale()
      .blur(1.5)
      .raw()
      .toBuffer();
    maskBuf = Buffer.from(maskBuf.map((v, i) => (room[i] < job.keepDarkerThan ? 0 : v)));
  }
  return sharp(maskBuf, { raw: { width: widthPx, height: heightPx, channels: 1 } }).png().toBuffer();
}

function whitenHighlights(rgb, [lo, hi]) {
  const out = Buffer.from(rgb);
  for (let i = 0; i < out.length; i += 3) {
    const lum = 0.299 * out[i] + 0.587 * out[i + 1] + 0.114 * out[i + 2];
    const t = Math.min(1, Math.max(0, (lum - lo) / (hi - lo)));
    if (t > 0) for (let c = 0; c < 3; c++) out[i + c] = Math.round(out[i + c] + (255 - out[i + c]) * t);
  }
  return out;
}
