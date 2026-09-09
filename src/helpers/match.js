export function formatClock(ms = 0) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function phaseLabel(phase) {
  return (
    {
      upcoming: "NOT STARTED",
      live: "LIVE NOW",
      break: "HALF-TIME BREAK",
      finished: "FULL TIME",
      completed: "FULL TIME",
    }[phase] || "STATUS UNAVAILABLE"
  );
}

export function displayedSides(match) {
  const left = match.sideSwapped ? "B" : "A";
  return { left, right: left === "A" ? "B" : "A" };
}

export function eventLabel(event, match) {
  const team =
    event.team === "A"
      ? match?.nameA || "Team A"
      : event.team === "B"
        ? match?.nameB || "Team B"
        : "Match";
  const note = event.note || (event.type || "event").replaceAll("_", " ");
  return note.startsWith(`${team} —`) ? note : `${team} — ${note}`;
}

export function blankMatch(id = crypto.randomUUID()) {
  return {
    _id: id,
    nameA: "TEAM A",
    nameB: "TEAM B",
    scoreA: 0,
    scoreB: 0,
    half: 1,
    halfDurationMs: 20 * 60 * 1000,
    raidDurationMs: 30 * 1000,
    matchRemainingMs: 20 * 60 * 1000,
    raidRemainingMs: 30 * 1000,
    matchRunning: false,
    raidRunning: false,
    status: "upcoming",
    phase: "upcoming",
    version: 0,
    events: [],
  };
}
