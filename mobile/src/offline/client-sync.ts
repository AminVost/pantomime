// Offline-only build: no HTTP communication or outbox.
export async function apiGet<T>(_path: string): Promise<T> {
  throw new Error("این نسخه فقط آفلاین اجرا می‌شود.");
}
export async function apiPost<T>(_path: string, _payload?: unknown): Promise<T> {
  throw new Error("این نسخه فقط آفلاین اجرا می‌شود.");
}
export function enqueueAndFlush(_path: string, _payload: unknown): void {}
export function enqueueRequest(_path: string, _payload: unknown): void {}
export function outboxSize(): number { return 0; }
export async function flushOutbox(): Promise<number> { return 0; }
export async function submitOrQueue<T>(_path: string, _payload: unknown): Promise<{queued: boolean; data?: T}> {
  throw new Error("همگام‌سازی در نسخه آفلاین وجود ندارد.");
}
