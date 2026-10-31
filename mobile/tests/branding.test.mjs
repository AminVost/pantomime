import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

const root = resolve(import.meta.dirname, "../..");
const read = path => readFileSync(resolve(root, path));
const hash = data => createHash("sha256").update(data).digest("hex");
// Materialized standalone ZIPs intentionally omit monorepo brand masters.
const brandTest = (name, fn) => test(name, { skip: !existsSync(resolve(root, "branding/source/adazi-mascot.png")) }, fn);
brandTest("the two approved original PNGs retain their exact bytes and transparency", async () => {
  const expected = {
    mascot: "bd1513467f64b9c8d09bca5edae8b3be02ba783415e084b4e416cc6f23f63e4d",
    lockup: "bf7922b41480751fbc017ad8ba49cdacf1af7d59761c325bbb896535dc363588"
  };
  for (const [name, digest] of Object.entries(expected)) {
    const file = read(`branding/source/adazi-${name}.png`);
    assert.equal(hash(file), digest);
    assert.equal((await sharp(file).metadata()).hasAlpha, true);
  }
});
brandTest("UI exports are proportional lossless renditions, identically packaged for mobile", async () => {
  for (const [name, width] of [["mascot", 192], ["lockup", 480]]) {
    const expected = await sharp(read(`branding/source/adazi-${name}.png`)).resize({ width, fit: "inside" }).webp({ lossless: true }).toBuffer();
    const path = `brand/adazi-${name}-${width}.webp`;
    assert.deepEqual(read(`public/${path}`), expected);
    assert.deepEqual(read(`mobile/public/${path}`), expected);
    const metadata = await sharp(expected).metadata();
    assert.equal(metadata.width, width);
    assert.equal(metadata.height, name === "mascot" ? width : width * .75);
  }
});
brandTest("launcher, Apple and store icons have square opaque canvases and expected sizes", async () => {
  for (const [file, size] of [["icons/icon-192.png", 192], ["icons/icon-512.png", 512], ["icons/icon-maskable-512.png", 512], ["icons/apple-touch-icon.png", 180], ["brand/adazi-store-512.png", 512], ["brand/adazi-store-1024.png", 1024]]) {
    const bitmap = sharp(read(`public/${file}`));
    const meta = await bitmap.metadata();
    assert.equal(meta.width, size, file);
    assert.equal(meta.height, size, file);
    assert.equal((await bitmap.stats()).isOpaque, true, file);
  }
});
brandTest("adaptive foreground reserves transparent padding on every side", async () => {
  const { data, info } = await sharp(read("public/brand/adazi-adaptive-foreground.png")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 432);
  assert.equal(info.height, 432);
  let opaquePixels = 0;
  for (let y = 0; y < 432; y++) for (let x = 0; x < 432; x++) {
    const alpha = data[(y * 432 + x) * 4 + 3];
    if (x < 96 || x >= 336 || y < 96 || y >= 336) assert.equal(alpha, 0);
    else if (alpha > 200) opaquePixels++;
  }
  assert.ok(opaquePixels > 10000, "foreground artwork must not be empty");
});
brandTest("display metadata uses Adazi while installed/storage identities stay compatible", () => {
  const mobileConfig = read("mobile/capacitor.config.ts").toString("utf8");
  assert.ok(mobileConfig.includes('appName: "ادازی"'));
  assert.ok(mobileConfig.includes('appId: "ir.aminvost.pantomime"'));
  assert.equal(JSON.parse(read("public/manifest.webmanifest")).short_name, "ادازی");
  const listing = JSON.parse(read("publishing/fa-IR/listing.json"));
  assert.equal(listing.title, "ادازی");
  assert.ok(listing.description.includes("ادابازی") && listing.description.includes("پانتومیم"));
  assert.ok(read("components/game/GameApp.tsx").toString("utf8").includes('"pantomin-active-game-v1"'));
});
