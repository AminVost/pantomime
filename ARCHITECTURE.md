# Architecture Notes

## Game state

Transient state مثل timer، current word و prefetch queue روی Client نگهداری می‌شود. دیتابیس فقط eventهای معنی‌دار و state پایدار را ذخیره می‌کند.

## Timer

Timer بر اساس `endAt - Date.now()` محاسبه می‌شود؛ بنابراین با کند شدن interval یا background شدن موبایل drift نمی‌کند.

## Word selection

Server کلمات استفاده‌شده را از `game_used_words` حذف می‌کند، batch جدید را reserve می‌کند و Client چند کلمه را جلوتر نگه می‌دارد.

## Offline resilience

Answer eventها `clientEventId` یکتا دارند. در خطای شبکه/5xx درخواست در LocalStorage outbox قرار می‌گیرد. Sync به‌ترتیب انجام می‌شود تا Answerها قبل از Finish Turn روی Server ثبت شوند.

## Rendering

صفحه اصلی یک Server Component بسیار کوچک است. `GameApp` به‌عنوان Client Component فقط بخش تعاملی بازی را کنترل می‌کند. API/Prisma کاملاً Server-side باقی می‌ماند.

## Motion

هیچ dependency انیمیشن سنگینی وجود ندارد. Ambient blobs، screen transitions، mascot و micro-interactions با CSS و عمدتاً transform/opacity اجرا می‌شوند.

## Runtime architecture v1.4

Gameplay is local-first. The React game state and active snapshot are stored on-device. Online mode uses a FIFO local outbox and background server synchronization; it does not wait for server responses during turns. Local mode bypasses game APIs entirely and reads its bundled catalog from the PWA cache. Server-side score validation and persistent history remain available in Online mode.
