"use client";

import { useEffect, useRef, useState } from "react";

type Mood = "idle" | "thinking" | "ready" | "tense" | "celebrate" | "sad" | "look-up";

export function Mascot({ mood = "idle", size = "md" }: { mood?: Mood; size?: "sm" | "md" | "lg" }) {
  const [randomWave, setRandomWave] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    const schedule = () => {
      const delay = 3200 + Math.floor(Math.random() * 4200);
      timerRef.current = window.setTimeout(() => {
        if (!active) return;
        setRandomWave(true);
        window.setTimeout(() => {
          if (!active) return;
          setRandomWave(false);
          schedule();
        }, 720);
      }, delay);
    };
    schedule();
    return () => {
      active = false;
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className={`mascot mascot-${mood} mascot-${size} ${randomWave ? "mascot-random-wave" : ""}`} aria-hidden="true">
      <div className="mascot-shadow" />
      <div className="mascot-body">
        <span className="mascot-eye mascot-eye-right" />
        <span className="mascot-eye mascot-eye-left" />
        <span className="mascot-mouth" />
        <span className="mascot-arm mascot-arm-right" />
        <span className="mascot-arm mascot-arm-left" />
      </div>
    </div>
  );
}
