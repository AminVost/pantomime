// Reusable Playwright integration tour, supplied as a function expression to
// a Playwright runner (e.g. browser_run_code_unsafe filename). An isolated Page
// is passed as its argument. No Playwright dependency is needed for npm test.
// This clears ONLY the supplied test page's local app storage.
async function runGameFlow(page, url = "http://localhost:4173") {
  const results = [];
  const errors = [];
  const apiCalls = [];
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const button = name => page.getByRole("button", { name, exact: true });
  const footer = () => page.locator(".turn-footer > button");
  const snapshot = () => page.evaluate(() => JSON.parse(localStorage.getItem("pantomin-active-game-v1")));
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/")) apiCalls.push(request.url()); });
  await page.goto(url);
  await page.waitForFunction(() => localStorage.getItem("pantomin-sound-v1") !== null);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.clock.install();
  const reset = async () => {
    await page.waitForFunction(() => localStorage.getItem("pantomin-sound-v1") !== null);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  };
  const setup = async () => {
    await button("شروع بازی").click();
    await page.locator(".setup-footer .btn-primary").click();
    await page.getByRole("spinbutton", { name: "تعداد دور", exact: true }).press("ArrowDown");
    await page.getByRole("spinbutton", { name: "تعداد دور", exact: true }).press("ArrowDown");
    await page.locator(".setup-footer .btn-primary").click();
    await page.getByRole("spinbutton", { name: "زمان دلخواه", exact: true }).fill("15");
    await page.locator(".setup-footer .btn-primary").click();
    await button("شروع بازی").click();
  };
  const enterTurn = async () => {
    await button("آماده‌ام").click();
    await page.locator(".category-point:not(:disabled)").first().click();
    assert(await page.locator(".word-title").count() === 0, "word leaked before reveal");
    await button("نمایش کلمه").click();
    await button("شروع زمان").click();
  };
  const homeAndResume = async () => {
    await button("خانه و ذخیره بازی").click();
    await page.reload();
    await button("ادامه بازی").click();
  };

  // Every screen remains reachable, and the active round's ids/time survive.
  await page.setViewportSize({ width: 360, height: 640 });
  await setup();
  await homeAndResume(); // READY
  assert((await snapshot()).screen === "READY", "READY resume");
  await button("آماده‌ام").click();
  await homeAndResume(); // CATEGORY
  assert((await snapshot()).screen === "CATEGORY", "CATEGORY resume");
  await page.locator(".category-point:not(:disabled)").first().click();
  await button("نمایش کلمه").click();
  const oldWord = (await snapshot()).currentWord.id;
  await page.locator(".change-word-btn").click();
  await page.locator(".change-word-btn.used").waitFor();
  assert((await snapshot()).currentWord.id !== oldWord, "replacement reused word");
  assert((await snapshot()).roundStats.changePenalty === 1, "replacement penalty");
  await homeAndResume(); // REVEAL must be covered again
  assert(await page.locator(".word-title").count() === 0, "word leaked after resume");
  await button("نمایش کلمه").click();
  await button("شروع زمان").click();
  await page.clock.runFor(2000);
  await page.locator(".fault-btn").click();
  await button("خانه و ذخیره بازی").click();
  const paused = await snapshot();
  assert(paused.pausedRemainingMs > 0 && paused.pausedRemainingMs <= 13000, "pause duration");
  await page.clock.runFor(120000);
  await page.reload();
  await button("ادامه بازی").click();
  assert(await page.locator(".word-title").count() === 0, "playing resume privacy");
  await button("نمایش کلمه").click();
  await button("ادامه زمان").click();
  const resumed = await snapshot();
  const now = await page.evaluate(() => Date.now());
  assert(resumed.turnId === paused.turnId, "resume created a new turn");
  assert(Math.abs(resumed.timerEndAt - now - paused.pausedRemainingMs) < 250, "remaining time changed");
  assert(resumed.roundStats.faultCount === 1, "lost fault");
  await button("درست گفتن").click();
  // Kill/reload during the feedback animation: resolution must complete once.
  await page.reload();
  await button("ادامه بازی").click();
  await page.clock.runFor(800);
  assert((await snapshot()).screen === "ROUND_RESULT", "feedback resume stuck");
  await homeAndResume(); // result
  await footer().click();
  await homeAndResume(); // scoreboard
  await footer().click();
  await enterTurn();
  await page.clock.runFor(16000);
  assert((await snapshot()).lastRoundSummary.correctCount === 0, "timeout did not finish");
  await footer().click();
  await footer().click();
  assert((await snapshot()).screen === "WINNER", "full game did not finish");
  await homeAndResume();
  assert((await snapshot()).screen === "WINNER", "winner resume");
  results.push("full game; resume READY/CATEGORY/REVEAL/PLAYING/RESULT/SCOREBOARD/WINNER; scoring and timeout");

  // Responsive footer, long setup and draft persistence.
  await reset();
  await page.setViewportSize({ width: 320, height: 568 });
  await button("شروع بازی").click();
  for (let i = 0; i < 6; i++) await button("اضافه کردن تیم").click();
  const beforeScroll = await page.locator(".setup-footer .btn-primary").boundingBox();
  await page.locator(".setup-body").evaluate(node => { node.scrollTop = node.scrollHeight; });
  const afterScroll = await page.locator(".setup-footer .btn-primary").boundingBox();
  assert(beforeScroll.y === afterScroll.y && afterScroll.y + afterScroll.height <= 568, "footer scrolls outside viewport");
  await homeAndResume();
  assert(await page.getByRole("textbox").count() === 8, "setup draft lost");
  results.push("320x568 pinned footer and eight-team draft");

  // Personal content: create/edit/duplicate/reload/play/exhaustion/delete.
  await reset();
  await button("کلمات من").click();
  await page.getByRole("textbox", { name: "نام موضوع جدید" }).fill("دوستان آزمایشی");
  await button("افزودن موضوع").click();
  await page.getByRole("textbox", { name: "متن کلمات" }).fill(["كودك خندان", "بادکنک جادویی", "پرواز با دوچرخه", ...Array.from({ length: 8 }, (_, i) => `حرکت نمایشی شماره ${i + 1}`)].join("\n"));
  await button("ذخیره کلمه‌ها").click();
  await page.getByRole("textbox", { name: "متن کلمات" }).fill("کودک خندان");
  await button("ذخیره کلمه‌ها").click();
  assert((await page.getByRole("alert").innerText()).includes("تکراری"), "duplicate accepted");
  await page.getByRole("textbox", { name: "متن کلمات" }).fill("");
  await button("ویرایش کودک خندان").click();
  await page.getByRole("textbox", { name: "متن کلمات" }).fill("بازیگر خندان");
  await button("ذخیره تغییرات").click();
  await button("خانه").click();
  await page.reload();
  await button("تنظیمات").click();
  const settingsText = await page.getByRole("dialog").innerText();
  assert(!/حالت اجرا|آفلاین|تمام امکانات|Reduce Motion/.test(settingsText), "technical settings copy remains");
  await button("تیره").click();
  await page.getByLabel("حالت چندکلمه‌ای", { exact: true }).click();
  const personalCategory = page.locator(".settings-category-grid .category-chip").filter({ hasText: "دوستان آزمایشی" });
  if (!(await personalCategory.getAttribute("class")).includes("selected")) await personalCategory.click();
  const others = page.locator(".settings-category-grid .selected").filter({ hasNotText: "دوستان آزمایشی" });
  while (await others.count()) await others.first().click();
  const close = await button("بستن").boundingBox();
  assert(close.y + close.height <= 568, "settings close button off screen");
  await button("بستن").click();
  await setup();
  await button("آماده‌ام").click();
  await page.locator(".category-point:not(:disabled)").first().click();
  await button("نمایش کلمه").click();
  await page.locator(".change-word-btn").click();
  await page.locator(".change-word-btn.used").waitFor();
  await button("شروع زمان").click();
  const seenPersonalIds = new Set();
  for (let i = 0; i < 9; i++) {
    const id = (await snapshot()).currentWord.id;
    assert(!seenPersonalIds.has(id), "continuous queue repeated a word");
    seenPersonalIds.add(id);
    await button("درست گفتن").click();
    await page.clock.runFor(300);
  }
  await button("رد کردن").click();
  await page.clock.runFor(1000);
  assert((await snapshot()).screen === "ROUND_RESULT", "continuous exhaustion stuck");
  assert((await snapshot()).lastRoundSummary.correctCount === 9, "continuous refill lost answers");
  await footer().click();
  await footer().click();
  await button("آماده‌ام").click();
  await button("ادامه بدون امتیاز").click();
  await footer().click();
  await footer().click();
  assert((await snapshot()).game.status === "FINISHED", "exhausted second team stuck");
  await button("خانه و ذخیره بازی").click();
  await button("کلمات من").click();
  await button("حذف موضوع دوستان آزمایشی").click();
  await page.evaluate(() => window.dispatchEvent(new Event("pantomime:native-back", { cancelable: true })));
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert(await page.getByRole("dialog").count() === 0, "Back did not close library confirmation");
  assert(await page.locator(".library-screen").count() === 1, "Back left library while closing confirmation");
  await button("حذف موضوع دوستان آزمایشی").click();
  await page.getByRole("dialog").getByRole("button", { name: "حذف", exact: true }).click();
  assert(await button("حذف موضوع دوستان آزمایشی").count() === 0, "category deletion failed");
  results.push("personal CRUD, Persian duplicate checks, persistence, continuous queue exhaustion, dark settings, native Back event");

  // Risk30 success/failure; background expiration for legacy v1 snapshots.
  for (const correct of [true, false]) {
    await reset();
    await setup();
    await button("آماده‌ام").click();
    await page.locator(".thirty-risk-card").click();
    assert(await page.locator(".word-title").count() === 0, "risk word leaked");
    await button("نمایش کلمه").click();
    await button("شروع زمان").click();
    if (correct) await button("درست گفتن").click();
    else {
      await page.evaluate(() => {
        const data = JSON.parse(localStorage.getItem("pantomin-active-game-v1"));
        delete data.pausedRemainingMs;
        delete data.resolutionReason;
        data.timerEndAt = Date.now() - 1000;
        localStorage.setItem("pantomin-active-game-v1", JSON.stringify(data));
      });
      await page.reload();
      await button("ادامه بازی").click();
    }
    await page.clock.runFor(800);
    const data = await snapshot();
    assert(data.screen === "ROUND_RESULT", "risk resolution stuck");
    assert(data.pausedRemainingMs === null, "expired pause leaked into the next turn");
    assert(correct ? data.lastRoundSummary.score === 30 : data.game.teams[0].forfeited, "risk result incorrect");
  }
  results.push("risk30 success/failure and expired legacy v1 restore");
  assert(errors.length === 0, `browser errors: ${errors.join("; ")}`);
  assert(apiCalls.length === 0, "Android called server API");
  return { passed: results, browserErrors: errors, apiCalls };
}
