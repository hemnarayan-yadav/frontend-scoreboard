import { useNow, remainingMs } from "../../hooks/useNow.js";
import { displayedSides, formatClock } from "../../helpers/match.js";

export function Scoreboard({ match }) {
  const now = useNow(250);
  const { left, right } = displayedSides(match);
  const remaining = remainingMs(match.matchRunning, match.matchEndAt, match.matchRemainingMs, now);
  const raid = remainingMs(match.raidRunning, match.raidEndAt, match.raidRemainingMs, now);
  return (
    <div className="scoreboard">
      <div className="score-side orange">
        <small>{match[`name${left}`]}</small>
        <strong>{match[`score${left}`]}</strong>
      </div>
      <div className="score-middle">
        <span>{match.half === 1 ? "1ST HALF" : "2ND HALF"}</span>
        <b>{formatClock(remaining)}</b>
        <i>{formatClock(raid)} RAID CLOCK</i>
      </div>
      <div className="score-side cyan">
        <small>{match[`name${right}`]}</small>
        <strong>{match[`score${right}`]}</strong>
      </div>
    </div>
  );
}