import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { API, api } from "../helpers/api.js";
import { formatClock, phaseLabel } from "../helpers/match.js";
import "../styles/display.css";

export default function DisplayPage({ id }) {
  const [match, setMatch] = useState(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    api(`/api/matches/${id}`)
      .then(setMatch)
      .catch(() => {});
    const socket = io(API);
    socket.on("connect", () => socket.emit("match:join", id));
    socket.on("state:update", setMatch);
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => {
      clearInterval(timer);
      socket.disconnect();
    };
  }, [id]);
  if (!match) return <div className="led-loading">Waiting for match…</div>;
  const remaining =
    match.matchRunning && match.matchEndAt
      ? new Date(match.matchEndAt).getTime() - now
      : match.matchRemainingMs;
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
          {match.half === 1 ? "1ST HALF" : "2ND HALF"} · RAID{" "}
          {formatClock(match.raidRemainingMs)}
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
