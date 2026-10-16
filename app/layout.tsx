import type { Metadata, Viewport } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";
import { PwaManager } from "@/components/pwa/PwaManager";

const vazirmatn = Vazirmatn({
  subsets: ["arabic"],
  display: "swap",
  variable: "--font-vazirmatn"
});

const themeScript = `
(function(){
  try {
    var pref = localStorage.getItem('pantomin-theme') || 'system';
    var dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.dataset.themePreference = pref;
  } catch (e) {}
})();`;

export const metadata: Metadata = {
  title: "ادازی | ادابازی و پانتومیم فارسی",
  description: "ادازی، بازی ادابازی و پانتومیم فارسی برای دورهمی؛ حدس کلمه، رقابت تیمی، تایمر و موضوع‌ها و کلمات دلخواه.",
  keywords: ["ادازی", "ادابازی", "ادا بازی", "ادا‌بازی", "پانتومیم", "بازی پانتومیم", "بازی دورهمی", "بازی گروهی", "حدس کلمه", "Adazi", "charades"],
  openGraph: { title: "ادازی | ادابازی و پانتومیم", description: "بازی گروهی حدس و اجرا برای دورهمی‌های شما؛ با موضوع‌ها و کلمات دلخواه.", locale: "fa_IR", type: "website" },
  applicationName: "ادازی",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "ادازی", statusBarStyle: "black-translucent" },
  icons: { icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }, { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }], apple: "/icons/apple-touch-icon.png" }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#10121a" }
  ]
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning className={vazirmatn.variable}>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}<PwaManager /></body>
    </html>
  );
}
