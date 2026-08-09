"use client";

const OUTBOX_KEY = "pantomin-outbox-v1";

export type OutboxItem = {
  id: string;
  path: string;
  payload: unknown;
  createdAt: number;
};

let flushPromise: Promise<number> | null = null;

function readOutbox(): OutboxItem[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || "[]") as OutboxItem[]; }
  catch { return []; }
}

function writeOutbox(items: OutboxItem[]) {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
}

export function enqueueRequest(path: string, payload: unknown) {
  const items = readOutbox();
  items.push({ id: crypto.randomUUID(), path, payload, createdAt: Date.now() });
  writeOutbox(items.slice(-300));
}

export function outboxSize() {
  return readOutbox().length;
}

export async function apiPost<T>(path: string, payload?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) {
    const error = new Error(body?.error || "درخواست انجام نشد.") as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return body.data as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) throw new Error(body?.error || "دریافت اطلاعات انجام نشد.");
  return body.data as T;
}

export async function submitOrQueue<T>(path: string, payload: unknown): Promise<{ queued: boolean; data?: T }> {
  try {
    const data = await apiPost<T>(path, payload);
    return { queued: false, data };
  } catch (error) {
    const status = (error as Error & { status?: number }).status;
    if (status && status < 500) throw error;
    enqueueRequest(path, payload);
    return { queued: true };
  }
}

async function doFlush(): Promise<number> {
  const items = readOutbox();
  if (!items.length) return 0;
  const remaining: OutboxItem[] = [];

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    try {
      await apiPost(item.path, item.payload);
    } catch (error) {
      const status = (error as Error & { status?: number }).status;
      if (!status || status >= 500) {
        remaining.push(...items.slice(index));
        break;
      }
      // 4xx means this event is stale/invalid. Keep the queue moving.
    }
  }

  // Preserve events that were appended while this flush was running.
  const latest = readOutbox();
  const processedIds = new Set(items.map((item) => item.id));
  const appended = latest.filter((item) => !processedIds.has(item.id));
  writeOutbox([...remaining, ...appended].slice(-300));
  return remaining.length + appended.length;
}

export function flushOutbox(): Promise<number> {
  if (flushPromise) return flushPromise;
  flushPromise = doFlush().finally(() => { flushPromise = null; });
  return flushPromise;
}

export function enqueueAndFlush(path: string, payload: unknown) {
  enqueueRequest(path, payload);
  void flushOutbox().then((remaining) => {
    if (remaining > 0 && typeof navigator !== "undefined" && navigator.onLine) void flushOutbox();
  });
}
