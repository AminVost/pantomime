import sharp from "sharp";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const source = resolve(root, "branding/source");
const brand = resolve(root, "public/brand");
const icons = resolve(root, "public/icons");
mkdirSync(brand, { recursive: true });
mkdirSync(icons, { recursive: true });
const mascot = readFileSync(resolve(source, "adazi-mascot.png"));
const lockup = readFileSync(resolve(source, "adazi-lockup.png"));
const background = "#f2eeff";

// Only deterministic resizing/padding: no redraw, crop, recolor or AI edits.
for (const width of [96, 192, 384, 768]) {
  await sharp(mascot).resize({ width, fit: "inside" }).webp({ lossless: true }).toFile(resolve(brand, `adazi-mascot-${width}.webp`));
}
for (const width of [480, 960, 1440]) {
  await sharp(lockup).resize({ width, fit: "inside" }).webp({ lossless: true }).toFile(resolve(brand, `adazi-lockup-${width}.webp`));
}
async function paddedIcon(size, ratio, color) {
  const artSize = Math.round(size * ratio);
  const art = await sharp(mascot).resize(artSize, artSize, { fit: "contain" }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: color } })
    .composite([{ input: art, gravity: "centre" }]).png().toBuffer();
}
for (const size of [192, 512]) {
  writeFileSync(resolve(icons, `icon-${size}.png`), await paddedIcon(size, .86, background));
}
writeFileSync(resolve(icons, "icon-maskable-512.png"), await paddedIcon(512, .60, background));
writeFileSync(resolve(icons, "apple-touch-icon.png"), await paddedIcon(180, .86, background));
// Android foreground uses a 108dp canvas with a 60dp rendition of the artwork.
writeFileSync(resolve(brand, "adazi-adaptive-foreground.png"), await paddedIcon(432, 60 / 108, "#00000000"));
writeFileSync(resolve(brand, "adazi-splash.png"), await paddedIcon(512, .60, "#00000000"));
for (const size of [512, 1024]) {
  writeFileSync(resolve(brand, `adazi-store-${size}.png`), await paddedIcon(size, .86, background));
}
const sha256 = value => createHash("sha256").update(value).digest("hex");
writeFileSync(resolve(brand, "assets.json"), JSON.stringify({
  name: "ادازی", background,
  sourceSha256: { mascot: sha256(mascot), lockup: sha256(lockup) },
  sources: { mascot: "branding/source/adazi-mascot.png", lockup: "branding/source/adazi-lockup.png" },
  note: "Original user-supplied artwork, preserved without cropping or redrawing."
}, null, 2) + "\n");
console.log("Adazi branding generated from the two original transparent PNGs.");
