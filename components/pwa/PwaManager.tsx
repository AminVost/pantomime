"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "pantomin-install-dismissed-v1";

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export function PwaManager() {
  const production = process.env.NODE_ENV === "production";
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    if (!production) return;
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    if (isStandalone()) return;
    const ua = navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIos(isIos);
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    const recentlyDismissed = Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000;
    if (isIos && !recentlyDismissed) window.setTimeout(() => setShow(true), 1400);

    const handler = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
      if (!recentlyDismissed) setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setShow(false));
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [production]);

  if (!production || !show) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  };

  const install = async () => {
    if (promptEvent) {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") setShow(false);
      setPromptEvent(null);
      return;
    }
    if (ios) setIosHelp(true);
  };

  return <>
    <aside className="pwa-install-card" aria-label="نصب ادازی روی گوشی">
      <button className="pwa-install-close" onClick={dismiss} aria-label="بعداً">×</button>
      <div className="pwa-install-icon"><img className="brand-icon" src="/brand/adazi-mascot-192.webp" width={40} height={40} alt="" /></div>
      <div className="pwa-install-copy"><strong>ادازی رو روی گوشی داشته باش</strong><small>سریع‌تر باز می‌شه و حالت Local حتی بدون اینترنت هم کار می‌کنه.</small></div>
      <button className="pwa-install-action" onClick={install}>{ios ? "روش نصب" : "نصب اپ"}</button>
    </aside>
    {iosHelp && <div className="pwa-guide-backdrop" onClick={() => setIosHelp(false)}>
      <div className="pwa-guide" onClick={(event) => event.stopPropagation()}>
        <div className="pwa-guide-handle" />
        <h3>روی آیفون، فقط ۳ قدم</h3>
        <ol><li><b>۱</b><span>دکمه <strong>Share / اشتراک</strong> مرورگر رو بزن.</span></li><li><b>۲</b><span><strong>Add to Home Screen</strong> رو انتخاب کن.</span></li><li><b>۳</b><span><strong>Add</strong> رو بزن؛ بعد از آیکن ادازی وارد شو.</span></li></ol>
        <button className="btn pwa-guide-done" onClick={() => { setIosHelp(false); dismiss(); }}>گرفتم</button>
      </div>
    </div>}
  </>;
}
