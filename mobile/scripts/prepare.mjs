import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";

const mobile = resolve(import.meta.dirname, "..");
const web = resolve(mobile, "..");
const generated = join(mobile, "generated");
// The Actions ZIP includes a fully materialized project and can build outside the web monorepo.
if (!existsSync(join(web, "components/game/GameApp.tsx"))) {
  if (existsSync(join(generated, "components/game/GameApp.tsx")) && existsSync(join(mobile, "public/data/catalog.json"))) {
    console.log("Standalone Android source detected: using bundled React UI and offline catalog");
    process.exit(0);
  }
  throw new Error("Cannot find original web project or generated standalone files");
}

const write = (path, data) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data, "utf8");
};
const copy = (from, to) => {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
};
const replaceRequired = (code, before, after) => {
  if (!code.includes(before)) throw new Error("Original game was modified; cannot safely patch " + before);
  return code.replace(before, after);
};

// Copy the real design system and components, not a reimplementation.
await import("./generate-brand.mjs");
for (const path of [
  "components/game/Mascot.tsx",
  "components/game/TimerRing.tsx",
  "components/ui/AmbientBackground.tsx",
  "components/ui/AppShell.tsx",
  "components/ui/Button.tsx",
  "components/ui/Modal.tsx",
  "types/game.ts"
]) copy(join(web, path), join(generated, path));
copy(join(web, "app/globals.css"), join(generated, "globals.css"));
for (const name of ["adazi-mascot-96.webp", "adazi-mascot-192.webp", "adazi-mascot-384.webp", "adazi-mascot-768.webp", "adazi-lockup-480.webp", "adazi-lockup-960.webp", "adazi-lockup-1440.webp", "adazi-adaptive-foreground.png", "adazi-splash.png", "assets.json"]) {
  copy(join(web, "public/brand", name), join(mobile, "public/brand", name));
}
copy(join(mobile, "src/offline/catalog-client.ts"), join(generated, "lib/game/catalog-client.ts"));
copy(join(mobile, "src/offline/personal-catalog.ts"), join(generated, "lib/game/personal-catalog.ts"));
copy(join(mobile, "src/offline/client-sync.ts"), join(generated, "lib/game/client-sync.ts"));
for (const name of ["icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"]) {
  copy(join(web, "public/icons", name), join(mobile, "public/icons", name));
}
copy(join(web, "public/icons/icon-512.png"), join(mobile, "assets/icon.png"));

let source = readFileSync(join(web, "components/game/GameApp.tsx"), "utf8");
// Force offline for new games, stored preferences, resume and settings.
source = replaceRequired(source, 'useState<RuntimeMode>("online")', 'useState<RuntimeMode>("local")');
source = replaceRequired(source, 'useState<RuntimeMode>("online")', 'useState<RuntimeMode>("local")');
source = replaceRequired(source, 'setRuntimeMode(storedRuntime === "local" ? "local" : "online");', 'setRuntimeMode("local");');
source = replaceRequired(source, 'const restoredMode = snapshot.gameRuntimeMode ?? "online";', 'const restoredMode: RuntimeMode = "local";');
source = replaceRequired(source, 'void loadCategories(snapshot.gameRuntimeMode ?? "online");', 'void loadCategories("local");');
source = source.replaceAll('(snapshot.gameRuntimeMode ?? "online") === "online"', "false");
source = replaceRequired(source, 'void flushOutbox();', '/* Offline-only build: do not flush web outbox. */');
const begin = '      <div className="settings-section-label">حالت اجرا</div>';
const end = '      <div className="settings-section-label">ظاهر</div>';
const i = source.indexOf(begin), j = source.indexOf(end, i);
if (i < 0 || j < 0) throw new Error("Unable to locate mode selection UI");
source = source.slice(0, i) + source.slice(j);
write(join(generated, "components/game/GameApp.tsx"), source);

// All words are shipped within the APK, no database and no API downloads.
const additions = [
  ["سینمای ایران","iranian-cinema","🎬",
    ["اخراجی‌ها","مارمولک","کلاه قرمزی","شهرزاد","پایتخت","هزارپا"],
    ["جدایی نادر از سیمین","اجاره‌نشین‌ها","شب‌های برره","قهوه تلخ","مهمان مامان","لیسانسه‌ها"],
    ["درباره الی","آژانس شیشه‌ای","ارتفاع پست","روز واقعه","زیر پوست شهر","ابد و یک روز"]],
  ["دورهمی و مهمانی","party-time","🎉",
    ["تولد","بریدن کیک","باز کردن هدیه","باد کردن بادکنک","دست زدن","فوت کردن شمع"],
    ["بازی اسم فامیل","رقص دسته‌جمعی","چیدن میز شام","عکس یادگاری","تعریف خاطره","غافلگیر کردن دوست"],
    ["جنگ بادکنکی","خاموش شدن برق وسط جشن","مهمانی مخفیانه","گم شدن کفش مهمان","انتخاب آهنگ اشتباه","غذا پختن برای مهمان ناخوانده"]],
  ["اتفاقات خنده‌دار","funny-moments","😂",
    ["ترسیدن از سوسک","عطسه وسط حرف","جا گذاشتن کلید","خوردن فلفل تند","افتادن بستنی","خروپف کردن"],
    ["گیر کردن در آسانسور","فراموش کردن اسم دوست","عکس با چشم بسته","خواب ماندن سر کار","رقصیدن جلوی آینه","اشتباه گرفتن آدم‌ها"],
    ["خندیدن سر جلسه جدی","پاک کردن پیام اشتباهی","پنهان کردن کیک تولد","افتادن روی صندلی شکسته","فرار از مرغ عصبانی","شکستن بشقاب هنگام نمایش"]],
  ["سفر و ماجراجویی","travel-adventure","🧭",
    ["چادر زدن","سوار هواپیما شدن","شنا در دریا","بالا رفتن از کوه","گم شدن","عکس گرفتن در سفر"],
    ["چمدان گم کردن","پل معلق","قایق‌سواری","کویرگردی","کمپینگ جنگلی","گم کردن گذرنامه"],
    ["عبور از رودخانه خروشان","جهت‌یابی با ستاره","باز کردن چادر در طوفان","بالون‌سواری","مسابقه با شتر","فرار از موج بلند"]],
  ["دنیای دیجیتال","digital-life","📱",
    ["سلفی","ارسال پیام","بازی موبایل","تماس تصویری","تایپ کردن","شارژ گوشی"],
    ["گم کردن رمز وای‌فای","گرفتن اسکرین‌شات","قطع شدن اینترنت","فیلتر عکس","ساختن ویدیو","پاک کردن حافظه"],
    ["درگیر شدن با کپچا","مخفی کردن نوتیفیکیشن","بازیابی رمز دومرحله‌ای","آپلود نشدن فایل","ضبط ویدیو بدون صدا","تعویض گوشی بدون بکاپ"]],
  ["ماجراهای فوتبالی","football-moments","⚽",
    ["گل زدن","داور","دروازه‌بان","پنالتی","هوادار","جام قهرمانی"],
    ["آفساید گرفتن","کارت قرمز","شادی بعد از گل","ضربه آزاد","تکل زدن","کرنر زدن"],
    ["گل به خودی دقیقه نود","اعتراض مربی کنار زمین","مداخله کمک‌داور ویدیویی","از دست دادن پنالتی آخر","لایی خوردن در فوتبال","مهار توپ روی خط دروازه"]],
  ["افسانه و خیال","fantasy-world","🧙",
    ["اژدها","جادوگر","پری دریایی","غول","قصر","شمشیر جادویی"],
    ["فرش پرنده","ماشین زمان","نامرئی شدن","کتاب طلسم","پیدا کردن گنج","هیولای دریایی"],
    ["باز کردن دروازه زمان","فرار از قلعه تسخیرشده","تبدیل شدن به سنگ","دوئل با سایه خود","مسابقه با اژدهای آتشین","چرخاندن عصای جادویی"]],
  ["زندگی روزمره","daily-adventures","🛒",
    ["خرید نان","آب دادن گل","سوار اتوبوس شدن","خوابیدن در کلاس","گرفتن تاکسی","پختن برنج"],
    ["جا گذاشتن کیف پول","اشتباه پوشیدن کفش","دیر رسیدن به قرار","سوزاندن غذا","گم کردن کنترل تلویزیون","جمع کردن لباس‌ها"],
    ["گم شدن در پارکینگ","افتادن خریدها از کیسه","سرهم کردن وسیله بدون راهنما","تعویض لامپ روی صندلی","برخورد با در شیشه‌ای","حمل کردن مبل از راه‌پله"]]
];
const extras = {
  animals:[["خرس قطبی"],["طاووس"],["اسب آبی"]],
  foods:[["آش رشته"],["ته‌چین"],["فسنجان"]],
  sports:[["والیبال ساحلی"],["اسکیت نمایشی"],["واترپلو"]],
  funny:[["بادکنک ترکیدن"],["خنده عصبی"],["برداشتن گوشی اشتباهی"]],
  iranian:[["تخم‌مرغ رنگی"],["نقالی"],["عروسک حاجی فیروز"]],
  technology:[["ربات"],["واقعیت مجازی"],["تایپ صوتی"]],
  "daily-life":[["شستن دست"],["چسباندن شیشه شکسته"],["تعمیر شیر آب"]],
  music:[["سنتور"],["همخوانی جمعی"],["کوک کردن ویولن"]],
  games:[["وسطی"],["کارت بازی کردن"],["نمایش بی‌کلام"]],
  nature:[["رنگین‌کمان"],["مهاجرت پرندگان"],["آبشار یخ‌زده"]]
};
const catalog = JSON.parse(readFileSync(join(web, "public/data/catalog.json"), "utf8"));
const pack = { version: (catalog.version || 1) + 1, categories: structuredClone(catalog.categories), words: structuredClone(catalog.words) };
let nextCategoryId = Math.max(...pack.categories.map(c => c.id)) + 1;
let nextWordId = Math.max(...pack.words.map(w => w.id)) + 1;
function addWords(category, groups) {
  const prior = new Set(pack.words.filter(w => w.categoryId === category.id).map(w => w.title.normalize("NFKC").trim()));
  [2,4,6].forEach((points, index) => {
    for (const raw of groups[index]) {
      const title = raw.normalize("NFKC").trim();
      if (!title || prior.has(title)) continue;
      pack.words.push({ id: nextWordId++, title, points, categoryId: category.id, categoryName: category.name });
      prior.add(title);
    }
  });
}
for (const category of pack.categories) {
  if (extras[category.slug]) addWords(category, extras[category.slug]);
}
for (const [name, slug, icon, easy, medium, hard] of additions) {
  if (pack.categories.some(c => c.slug === slug)) throw new Error("Duplicate slug: " + slug);
  const category = { id: nextCategoryId++, name, slug, icon, counts: { points2: 0, points4: 0, points6: 0 } };
  pack.categories.push(category);
  addWords(category, [easy, medium, hard]);
}
for (const category of pack.categories) {
  category.counts = {
    points2: pack.words.filter(w => w.categoryId === category.id && w.points === 2).length,
    points4: pack.words.filter(w => w.categoryId === category.id && w.points === 4).length,
    points6: pack.words.filter(w => w.categoryId === category.id && w.points === 6).length
  };
}
write(join(mobile, "public/data/catalog.json"), JSON.stringify(pack));
console.log("Offline catalog:", pack.categories.length, "categories,", pack.words.length, "words");
