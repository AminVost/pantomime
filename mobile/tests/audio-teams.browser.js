// Run against a dedicated preview profile. Does not touch a player's saved data.
async function runAudioTeams(page, url = "http://127.0.0.1:4173") {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const button = name => page.getByRole("button", { name, exact: true });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    window.__sounds = [];
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      window.__sounds.push({ duration: this.buffer?.duration, loop: this.loop });
      return start.apply(this, args);
    };
  });
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(url);
  await page.waitForFunction(() => localStorage.getItem("pantomin-sound-v1"));
  await button("شروع بازی").click();
  await button("ظاهر تیم 1").click();
  await button("روباه نئونی").click(); await button("نارنجی").click();
  assert(await button("روباه نئونی").getAttribute("aria-pressed") === "true", "avatar selection");
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "avatar horizontal overflow");
  await page.screenshot({ path: "qa-team-avatar.png" });
  await page.evaluate(() => window.dispatchEvent(new Event("pantomime:native-back")));
  assert(await page.getByRole("dialog").count() === 0, "native back did not close avatar picker");
  await page.reload(); await button("ادامه بازی").click();
  await button("ظاهر تیم 1").click();
  assert(await button("روباه نئونی").getAttribute("aria-pressed") === "true", "avatar draft not persisted");
  assert(await button("نارنجی").getAttribute("aria-pressed") === "true", "color draft not persisted");
  await button("بستن").click();
  await page.locator(".setup-footer .btn-primary").click();
  await page.locator(".setup-footer .btn-primary").click();
  await page.getByRole("spinbutton", { name: "زمان دلخواه", exact: true }).fill("15");
  await page.locator(".setup-footer .btn-primary").click(); await button("شروع بازی").click();
  const snapshot = () => page.evaluate(() => JSON.parse(localStorage.getItem("pantomin-active-game-v1")));
  const data = await snapshot();
  assert(data.game.teams[0].avatarId === "fox" && data.game.teams[0].colorKey === "orange", "team style lost on create");
  await button("آماده‌ام").click(); await page.locator(".category-point:not(:disabled)").first().click();
  await button("نمایش کلمه").click(); await button("شروع زمان").click();
  await page.waitForFunction(() => window.__sounds.some(sound => sound.loop));
  await page.waitForFunction(() => window.__sounds.some(sound => !sound.loop && sound.duration > 1 && sound.duration < 1.6));
  await page.screenshot({ path: "qa-playing-audio.png" });
  await page.waitForFunction(() => window.__sounds.some(sound => !sound.loop && sound.duration < .25), { timeout: 18000 });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("pantomin-active-game-v1"))?.screen === "ROUND_RESULT", { timeout: 20000 });
  assert(await page.evaluate(() => window.__sounds.some(sound => !sound.loop && sound.duration > 3 && sound.duration < 3.3)), "attached timeout clip did not play");
  await button("خانه و ذخیره بازی").click(); await button("تنظیمات").click();
  await button("تعقیب بامزه ماریمبا · بازیگوش").click();
  await page.getByRole("slider", { name: "بلندی موسیقی", exact: true }).fill("72");
  await button("بستن").click(); await page.reload();
  await button("تنظیمات").click();
  assert(await button("تعقیب بامزه ماریمبا · بازیگوش").getAttribute("aria-pressed") === "true", "music preference not persisted");
  assert(await page.getByRole("slider", { name: "بلندی موسیقی", exact: true }).inputValue() === "72", "volume not persisted");
  await page.screenshot({ path: "qa-audio-settings.png" });
  const decoded = await page.evaluate(async () => {
    const ctx = new AudioContext(); const results = [];
    for (const name of ["start", "end", "tick", "neon", "playful"]) {
      const response = await fetch(`/audio/${name}.m4a`);
      const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
      let peak = 0; for (const value of buffer.getChannelData(0)) peak = Math.max(peak, Math.abs(value));
      results.push({ name, duration: buffer.duration, rate: buffer.sampleRate, peak });
    }
    await ctx.close(); return results;
  });
  assert(decoded.every(item => item.peak > .1 && item.peak <= 1), "silent or clipped audio");
  assert(errors.length === 0, errors.join("; "));
  return { passed: ["avatar/color selection and save", "native back", "start bell", "looping music", "last-ten-seconds ticking", "attached timeout audio", "music/volume persistence", "AAC decode and signal peaks", "320px layout"], decoded, errors };
}
