import { useLiveMatch } from "../hooks/useLiveMatch.js";
import { useNow, remainingMs } from "../hooks/useNow.js";
import { formatClock, phaseLabel } from "../helpers/match.js";
import "../styles/display.css";

export default function DisplayPage({ id }) {
  const { match } = useLiveMatch(id);
  const now = useNow(250);
  if (!match) return <div className="led-loading">Waiting for match…</div>;

  const remaining = remainingMs(match.matchRunning, match.matchEndAt, match.matchRemainingMs, now);
  // The previous version rendered `match.raidRemainingMs` directly here —
  // a static snapshot that only changed when a new state:update socket
  // message arrived (i.e. at raid start/stop), so the raid clock never
  // visibly counted down second-by-second on the actual LED screen.
  const raid = remainingMs(match.raidRunning, match.raidEndAt, match.raidRemainingMs, now);

  return (
    <div className="led-display">
      <div className="led-team orange">
        <small>{match.nameA}</small>
        <strong>{match.scoreA}</strong>
      </div>
      <div className="led-center">
        <span>{phaseLabel(match.phase)}</span>
        <b>{formatClock(remaining)}</b>
        <i>
          {match.half === 1 ? "1ST HALF" : "2ND HALF"} · RAID {formatClock(raid)}
        </i>
        {match.status === "completed" && <em>FULL TIME</em>}
      </div>
      <div className="led-team cyan">
        <small>{match.nameB}</small>
        <strong>{match.scoreB}</strong>
      </div>
    </div>
  );
}