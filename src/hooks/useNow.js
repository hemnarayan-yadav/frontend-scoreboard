import { useEffect, useState } from "react";

// A single shared "current time" ticker. ControlPanel, the old LivePage and
// DisplayPage each ran their own `setInterval` + `useState(Date.now())` to
// re-render while a clock counts down — same pattern, three copies, three
// slightly different intervals. This is the one version of it.
export function useNow(intervalMs = 250) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

// Countdown helper shared by every clock display. `endAt` is an epoch-ms
// number — the backend's Match model stores matchEndAt/raidEndAt as
// Number, not Date, specifically so this subtraction works without any
// string parsing. See CHANGES.md from the backend review.
export function remainingMs(running, endAt, fallbackMs, now) {
  if (running && endAt) return Math.max(0, endAt - now);
  return Math.max(0, Number(fallbackMs) || 0);
}