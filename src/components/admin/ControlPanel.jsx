import { useEffect, useRef, useState } from "react";
import { api, jsonOptions } from "../../helpers/api.js";
import { formatClock } from "../../helpers/match.js";
import { useNow, remainingMs } from "../../hooks/useNow.js";

const STATE_FIELDS = [
  "nameA", "nameB", "scoreA", "scoreB",
  "half", "sideSwapped", "endedEarly",
  "halfDurationMs", "raidDurationMs",
  "matchRunning", "matchRemainingMs", "matchEndAt",
  "raidRunning", "raidRemainingMs", "raidEndAt",
  "timeoutActive", "timeoutMatchWasRunning", "timeoutRaidWasRunning",
  "sirenActive", "sirenNonce", "sirenAt",
  "overlayText", "status",
];

function pickStateFields(source) {
  const result = {};
  for (const key of STATE_FIELDS) if (source[key] !== undefined) result[key] = source[key];
  return result;
}

function isNewerMatch(current, next) {
  return !current || current._id !== next._id || (current.version || 0) <= (next.version || 0);
}

export default function ControlPanel({ match, onChange }) {
  const [draft, setDraft] = useState(match);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const now = useNow(250);
  const autoTransitioning = useRef(false);

  useEffect(() => setDraft(match), [match._id, match.version]);

  useEffect(() => {
    if (autoTransitioning.current) return;
    if (draft.matchRunning && draft.matchEndAt && remainingMs(true, draft.matchEndAt, 0, now) === 0) {
      autoTransitioning.current = true;
      save({
        matchRunning: false,
        matchEndAt: null,
        matchRemainingMs: 0,
        raidRunning: false,
        raidEndAt: null,
        raidRemainingMs: draft.raidDurationMs,
        timeoutActive: false,
        timeoutMatchWasRunning: false,
        timeoutRaidWasRunning: false,
        overlayText: draft.half === 1 ? "HALF TIME" : "FULL TIME",
      })
        .catch(() => {})
        .finally(() => (autoTransitioning.current = false));
      return;
    }
    if (draft.raidRunning && draft.raidEndAt && remainingMs(true, draft.raidEndAt, 0, now) === 0) {
      autoTransitioning.current = true;
      save({ raidRunning: false, raidEndAt: null, raidRemainingMs: 0 })
        .catch(() => {})
        .finally(() => (autoTransitioning.current = false));
    }
  }, [now, draft.matchRunning, draft.matchEndAt, draft.raidRunning, draft.raidEndAt]);

  async function save(next) {
    setBusy(true);
    setError("");
    try {
      const saved = await api(
        `/api/matches/${draft._id}/state`,
        jsonOptions("PUT", { state: pickStateFields({ ...draft, ...next }) }),
      );
      setDraft((current) => (isNewerMatch(current, saved) ? saved : current));
      onChange(saved);
      return saved;
    } catch (err) {
      setError(err.message || "Couldn't save. Check the connection and try again.");
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function logEvent(partial) {
    try {
      await api(
        `/api/matches/${draft._id}/events`,
        jsonOptions("POST", { clientEventId: crypto.randomUUID(), half: draft.half, ...partial }),
      );
    } catch {
      /* non-critical */
    }
  }

  function displayedTeam(side) {
    return draft.sideSwapped ? (side === "A" ? "B" : "A") : side;
  }

  function adjust(team, amount) {
    if (isLocked) return;
    const side = displayedTeam(team);
    const teamName = draft[`name${side}`] || `Team ${side}`;
    const clockRemainingMs = remainingMs(draft.matchRunning, draft.matchEndAt, draft.matchRemainingMs, now);
    setBusy(true);
    setError("");
    api(`/api/matches/${draft._id}/score`, jsonOptions("POST", { team: side, amount }))
      .then((saved) => {
        setDraft((current) => (isNewerMatch(current, saved) ? saved : current));
        onChange(saved);
        return saved;
      })
      .then(() =>
        logEvent({
          type: "score_adjustment",
          team: side,
          points: amount,
          clockRemainingMs,
          note: `${teamName} - ${amount > 0 ? "Score added" : "Score adjusted"}`,
        }),
      )
      .catch((err) => setError(err.message || "Couldn't update the score. Check the connection and try again."))
      .finally(() => setBusy(false));
  }

  function setName(field, value) {
    setDraft({ ...draft, [field]: value });
  }

  function startHalf(half) {
    if (draft.status !== "live" || draft.matchRunning || draft.raidRunning || draft.timeoutActive) return;
    save({
      half,
      sideSwapped: half === 2,
      matchRunning: true,
      matchRemainingMs: draft.halfDurationMs,
      matchEndAt: Date.now() + draft.halfDurationMs,
      raidRunning: false,
      raidEndAt: null,
      raidRemainingMs: draft.raidDurationMs,
      timeoutActive: false,
      timeoutMatchWasRunning: false,
      timeoutRaidWasRunning: false,
      overlayText: null,
    }).catch(() => {});
  }

  function toggleRaid() {
    if (draft.status !== "live" || draft.timeoutActive || (!draft.matchRunning && !draft.raidRunning)) return;
    save(
      draft.raidRunning
        ? { raidRunning: false, raidEndAt: null, raidRemainingMs: draft.raidDurationMs }
        : { raidRunning: true, raidEndAt: Date.now() + draft.raidDurationMs, raidRemainingMs: draft.raidDurationMs },
    ).catch(() => {});
  }

  function stopRaid() {
    if (draft.status !== "live" || draft.timeoutActive || !draft.raidRunning) return;
    save({ raidRunning: false, raidEndAt: null, raidRemainingMs: draft.raidDurationMs }).catch(() => {});
  }

  function toggleTimeout() {
    if (draft.status !== "live") return;

    const currentNow = Date.now();
    if (draft.timeoutActive) {
      const matchWasRunning = draft.timeoutMatchWasRunning && draft.matchRemainingMs > 0;
      const raidWasRunning = draft.timeoutRaidWasRunning && draft.raidRemainingMs > 0;
      save({
        timeoutActive: false,
        timeoutMatchWasRunning: false,
        timeoutRaidWasRunning: false,
        matchRunning: matchWasRunning,
        matchEndAt: matchWasRunning ? currentNow + draft.matchRemainingMs : null,
        raidRunning: raidWasRunning,
        raidEndAt: raidWasRunning ? currentNow + draft.raidRemainingMs : null,
        overlayText: null,
      }).catch(() => {});
      return;
    }

    if (!draft.matchRunning && !draft.raidRunning) return;
    const matchMs = remainingMs(draft.matchRunning, draft.matchEndAt, draft.matchRemainingMs, currentNow);
    const raidMs = remainingMs(draft.raidRunning, draft.raidEndAt, draft.raidRemainingMs, currentNow);
    save({
      timeoutActive: true,
      timeoutMatchWasRunning: draft.matchRunning,
      timeoutRaidWasRunning: draft.raidRunning,
      matchRunning: false,
      matchEndAt: null,
      matchRemainingMs: matchMs,
      raidRunning: false,
      raidEndAt: null,
      raidRemainingMs: raidMs,
      overlayText: "TIME OUT",
    }).catch(() => {});
  }

  function triggerSiren() {
    save({
      sirenActive: !draft.sirenActive,
      sirenNonce: (Number(draft.sirenNonce) || 0) + 1,
      sirenAt: Date.now(),
    }).catch(() => {});
  }

  function goLive() {
    if (draft.status !== "upcoming") return;
    save({ status: "live" }).catch(() => {});
  }

  async function complete() {
    if (draft.status !== "live") return;
    setBusy(true);
    setError("");
    try {
      const saved = await api(`/api/matches/${draft._id}/complete`, jsonOptions("POST", {}));
      setDraft(saved);
      onChange(saved);
    } catch (err) {
      setError(err.message || "Couldn't complete the match. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function resetAll() {
    if (draft.status !== "completed") return;
    if (!window.confirm("Reset score, clocks, teams, and match status?")) return;
    const halfDurationMs = draft.halfDurationMs || 20 * 60 * 1000;
    save({
      status: "upcoming",
      sideSwapped: false,
      endedEarly: false,
      nameA: "TEAM A",
      nameB: "TEAM B",
      scoreA: 0,
      scoreB: 0,
      half: 1,
      halfDurationMs,
      raidDurationMs: 30 * 1000,
      matchRunning: false,
      matchRemainingMs: halfDurationMs,
      matchEndAt: null,
      raidRunning: false,
      raidRemainingMs: 30 * 1000,
      raidEndAt: null,
      timeoutActive: false,
      timeoutMatchWasRunning: false,
      timeoutRaidWasRunning: false,
      sirenActive: false,
      sirenNonce: 0,
      sirenAt: null,
      overlayText: null,
    }).catch(() => {});
  }

  const matchRemaining = remainingMs(draft.matchRunning, draft.matchEndAt, draft.matchRemainingMs, now);
  const raidRemaining = remainingMs(draft.raidRunning, draft.raidEndAt, draft.raidRemainingMs, now);
  const leftTeam = displayedTeam("A");
  const rightTeam = displayedTeam("B");
  const leftName = draft[`name${leftTeam}`] || `Team ${leftTeam}`;
  const rightName = draft[`name${rightTeam}`] || `Team ${rightTeam}`;
  const leftScore = draft[`score${leftTeam}`] || 0;
  const rightScore = draft[`score${rightTeam}`] || 0;
  const isLocked = draft.status === "completed";
  const firstHalfDisabled =
    draft.status !== "live" ||
    draft.timeoutActive ||
    draft.matchRunning ||
    draft.raidRunning ||
    draft.half !== 1 ||
    draft.matchRemainingMs === 0;
  const secondHalfDisabled =
    draft.status !== "live" ||
    draft.timeoutActive ||
    draft.matchRunning ||
    draft.raidRunning ||
    draft.half !== 1 ||
    draft.matchRemainingMs > 0;
  const statusLabel = draft.timeoutActive
    ? "Time Out"
    : draft.status === "live"
      ? "Live"
      : draft.status === "completed"
        ? "Completed"
        : "Not started";

  return (
    <div className="operator-workspace control-panel">
      <div className="operator-top">
        <div>
          <p className="eyebrow">Match operator</p>
          <h2>Scoreboard control</h2>
        </div>
        <a className="secondary-button" href={`/display/${draft._id}`} target="_blank" rel="noopener">
          Open LED display
        </a>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="control-preview">
        <div className="preview-team orange">
          <b>{leftName}</b>
          <strong>{leftScore}</strong>
        </div>
        <div className="preview-middle">
          <small>{draft.half === 1 ? "1ST HALF" : "2ND HALF"}</small>
          <b>{formatClock(matchRemaining)}</b>
          <em>
            Raid: {Math.ceil(raidRemaining / 1000)}
            {draft.timeoutActive && draft.timeoutRaidWasRunning ? " Paused" : ""}
          </em>
          <span className={`preview-status ${draft.timeoutActive ? "timeout" : draft.status}`}>{statusLabel}</span>
        </div>
        <div className="preview-team cyan">
          <b>{rightName}</b>
          <strong>{rightScore}</strong>
        </div>
      </div>

      <div className="control-grid">
        <section className="control-card team-card orange">
          <h3>{leftName}</h3>
          <input
            value={leftName}
            onChange={(event) => setName(`name${leftTeam}`, event.target.value)}
            onBlur={() => save({ nameA: draft.nameA, nameB: draft.nameB }).catch(() => {})}
            disabled={isLocked}
            spellCheck="false"
          />
          <div className="score-controls">
            <button aria-label="Decrease left team score" disabled={isLocked} onClick={() => adjust("A", -1)}>
              -
            </button>
            <strong>{leftScore}</strong>
            <button aria-label="Increase left team score" disabled={isLocked} onClick={() => adjust("A", 1)}>
              +
            </button>
          </div>
        </section>

        <section className="control-card team-card cyan">
          <h3>{rightName}</h3>
          <input
            value={rightName}
            onChange={(event) => setName(`name${rightTeam}`, event.target.value)}
            onBlur={() => save({ nameA: draft.nameA, nameB: draft.nameB }).catch(() => {})}
            disabled={isLocked}
            spellCheck="false"
          />
          <div className="score-controls">
            <button aria-label="Decrease right team score" disabled={isLocked} onClick={() => adjust("B", -1)}>
              -
            </button>
            <strong>{rightScore}</strong>
            <button aria-label="Increase right team score" disabled={isLocked} onClick={() => adjust("B", 1)}>
              +
            </button>
          </div>
        </section>

        <section className="control-card">
          <h3>Match Settings</h3>
          <div className="setting-row">
            <label>
              Half length (minutes)
              <input
                type="number"
                min="1"
                max="60"
                disabled={draft.status !== "upcoming"}
                value={Math.round(draft.halfDurationMs / 60000)}
                onChange={(event) => {
                  const minutes = Math.max(1, Math.min(60, Number(event.target.value) || 20));
                  setDraft({
                    ...draft,
                    halfDurationMs: minutes * 60000,
                    matchRemainingMs: draft.matchRunning ? draft.matchRemainingMs : minutes * 60000,
                  });
                }}
                onBlur={() =>
                  save({ halfDurationMs: draft.halfDurationMs, matchRemainingMs: draft.matchRemainingMs }).catch(
                    () => {},
                  )
                }
              />
            </label>
            <label>
              Raid clock
              <span className="setting-static">30 sec (fixed)</span>
            </label>
          </div>
          <p className="control-note">Half length can only be changed before the match goes live.</p>
        </section>

        <section className="control-card">
          <h3>Match Clock - {draft.half === 1 ? "1st Half" : "2nd Half"}</h3>
          <div className="button-row">
            <button
              className={draft.matchRunning && draft.half === 1 ? "action-button active" : "action-button"}
              disabled={firstHalfDisabled}
              onClick={() => startHalf(1)}
            >
              Start 1st Half
            </button>
            <button
              className={draft.matchRunning && draft.half === 2 ? "action-button active" : "action-button"}
              disabled={secondHalfDisabled}
              onClick={() => startHalf(2)}
            >
              Start 2nd Half
            </button>
            <button
              className={draft.timeoutActive ? "action-button timeout active" : "action-button timeout"}
              disabled={draft.status !== "live" || (!draft.timeoutActive && !draft.matchRunning && !draft.raidRunning)}
              onClick={toggleTimeout}
            >
              {draft.timeoutActive ? "Resume Match" : "Time Out"}
            </button>
            <button
              className={draft.sirenActive ? "action-button warn active" : "action-button warn"}
              disabled={isLocked}
              onClick={triggerSiren}
            >
              {draft.sirenActive ? "Stop Siren" : "Siren"}
            </button>
          </div>
          <p className="control-note">Half buttons unlock once the match is live.</p>
        </section>

        <section className="control-card">
          <h3>Raid Clock</h3>
          <div className="button-row">
            <button
              className="action-button warn"
              disabled={draft.status !== "live" || draft.timeoutActive || (!draft.matchRunning && !draft.raidRunning)}
              onClick={toggleRaid}
            >
              {draft.raidRunning ? "Clear Raid" : "Start Raid"}
            </button>
            <button
              className="action-button"
              disabled={draft.status !== "live" || draft.timeoutActive || !draft.raidRunning}
              onClick={stopRaid}
            >
              Stop Raid
            </button>
          </div>
        </section>

        <section className="control-card">
          <h3>Match Status</h3>
          <div className="button-row">
            <button
              className={draft.status !== "upcoming" ? "action-button primary done" : "action-button primary"}
              disabled={busy || draft.status !== "upcoming"}
              onClick={goLive}
            >
              {draft.status === "upcoming" ? "Go Live" : "Match Live"}
            </button>
            <button className="action-button danger" disabled={busy || draft.status !== "live"} onClick={complete}>
              {draft.status === "completed" ? "Match Completed" : "Complete Match"}
            </button>
            <button className="action-button danger" disabled={busy || draft.status !== "completed"} onClick={resetAll}>
              Clear All
            </button>
          </div>
        </section>
      </div>

      <div className="control-status">
        <span>
          Auto-save: <b>{busy ? "saving..." : "on"}</b>
        </span>
        <span>
          Display sync: <b>live</b>
        </span>
        <span>
          Status: <b>{statusLabel}</b>
        </span>
        <span>
          Siren: <b>{draft.sirenActive ? "on" : "off"}</b>
        </span>
      </div>
    </div>
  );
}
