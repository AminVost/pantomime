export function TimerRing({ remaining, total }: { remaining: number; total: number }) {
  const progress = Math.max(0, Math.min(1, remaining / total));
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);
  const urgent = remaining <= 10;

  return (
    <div className={`timer-wrap ${urgent ? "timer-urgent" : ""}`}>
      <svg viewBox="0 0 128 128" className="timer-svg" aria-hidden="true">
        <circle cx="64" cy="64" r={radius} className="timer-track" />
        <circle
          cx="64"
          cy="64"
          r={radius}
          className="timer-progress"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="timer-value" dir="ltr" aria-label={`${remaining} ثانیه باقی مانده`}>
        <strong>{remaining}</strong><span>ثانیه</span>
      </div>
    </div>
  );
}
