"use client";

type Mood = "idle" | "thinking" | "ready" | "tense" | "celebrate" | "sad" | "look-up";

export function Mascot({ mood = "idle", size = "md" }: { mood?: Mood; size?: "sm" | "md" | "lg" }) {
  return <div className={`mascot mascot-${mood} mascot-${size}`} aria-hidden="true">
    <img className="mascot-art" src="/brand/adazi-mascot-192.webp"
      srcSet="/brand/adazi-mascot-96.webp 96w, /brand/adazi-mascot-192.webp 192w, /brand/adazi-mascot-384.webp 384w, /brand/adazi-mascot-768.webp 768w"
      sizes={size === "lg" ? "160px" : size === "sm" ? "80px" : "112px"}
      width={192} height={192} alt="" draggable={false} decoding="async" />
  </div>;
}
