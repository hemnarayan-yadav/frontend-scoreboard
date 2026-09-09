import { displayedSides, formatClock } from "../../helpers/match.js";

export function Scoreboard({ match }) {
  const { left, right } = displayedSides(match);
  const remaining =
    match.matchRunning && match.matchEndAt
      ? new Date(match.matchEndAt).getTime() - Date.now()
      : match.matchRemainingMs;
  const raid =
    match.raidRunning && match.raidEndAt
      ? new Date(match.raidEndAt).getTime() - Date.now()
      : match.raidRemainingMs;
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
