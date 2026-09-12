import { useEffect, useRef, useState } from "react";
import { api, jsonOptions } from "../../helpers/api.js";
import { formatClock } from "../../helpers/match.js";
import { useNow, remainingMs } from "../../hooks/useNow.js";

// Mirrors WRITABLE_STATE_FIELDS in the backend's matchController.js.
// Restricting the outgoing payload to just these fields means a score tap
// doesn't also re-upload the match's full event log (up to 300 entries) —
// the server ignores extra fields anyway, but there's no reason to pay for
// that bandwidth over venue wifi.
const STATE_FIELDS = [
  "nameA", "nameB", "scoreA", "scoreB",
  "half", "sideSwapped", "endedEarly",
  "halfDurationMs", "raidDurationMs",
  "matchRunning", "matchRemainingMs", "matchEndAt",
  "raidRunning", "raidRemainingMs", "raidEndAt",
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

  // Auto-flip to HALF TIME / FULL TIME when a running clock hits zero. Uses
  // a ref (not the `busy` state) to guard against double-firing — state
  // updates aren't synchronous, so two ticks 250ms apart could otherwise
  // both see `busy === false` and both fire the transition.
  useEffect(() => {
    if (autoTransitioning.current) return;
    if (draft.matchRunning && draft.matchEndAt && remainingMs(true, draft.matchEndAt, 0, now) === 0) {
      autoTransitioning.current = true;
      save({
        matchRunning: false,
        matchEndAt: null,
        matchRemainingMs: 0,
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
      setError(err.message || "Couldn't save — check the connection and try again.");
      throw err;
    } finally {
      setBusy(false);
    }
  }

  // Best-effort: a missed timeline entry is never worth blocking or rolling
  // back a score change over, so failures here are swallowed silently.
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

  function adjust(team, amount) {
    if (isLocked) return;
    const side = draft.sideSwapped ? (team === "A" ? "B" : "A") : team;
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
          note: `${teamName} — ${amount > 0 ? "Score added" : "Score adjusted"}`,
        }),
      )
      .catch((err) => setError(err.message || "Couldn't update the score — check the connection and try again."))
      .finally(() => setBusy(false));
  }

  function setName(field, value) {
    setDraft({ ...draft, [field]: value });
  }

  function startHalf(half) {
    if (draft.status !== "live" || draft.matchRunning) return;
    save({
      half,
      sideSwapped: half === 2,
      matchRunning: true,
      matchRemainingMs: draft.halfDurationMs,
      // Plain epoch-ms number — the backend's matchEndAt is a Number field,
      // not a Date. Sending `.toISOString()` here used to fail Mongoose's
      // cast (a date string can't cast to Number) and would 400/500 the
      // save on every "Start Half" click against the current backend.
      matchEndAt: Date.now() + draft.halfDurationMs,
      raidRunning: false,
      raidEndAt: null,
      raidRemainingMs: draft.raidDurationMs,
      overlayText: null,
    }).catch(() => {});
  }

  function toggleRaid() {
    if (draft.status !== "live") return;
    save(
      draft.raidRunning
        ? { raidRunning: false, raidEndAt: null, raidRemainingMs: draft.raidDurationMs }
        : { raidRunning: true, raidEndAt: Date.now() + draft.raidDurationMs, raidRemainingMs: draft.raidDurationMs },
    ).catch(() => {});
  }

  function stopRaid() {
    if (draft.status !== "live") return;
    save({ raidRunning: false, raidEndAt: null, raidRemainingMs: draft.raidDurationMs }).catch(() => {});
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
      setError(err.message || "Couldn't complete the match — try again.");
    } finally {
      setBusy(false);
    }
  }

  const matchRemaining = remainingMs(draft.matchRunning, draft.matchEndAt, draft.matchRemainingMs, now);
  const raidRemaining = remainingMs(draft.raidRunning, draft.raidEndAt, draft.raidRemainingMs, now);
  const firstHalfDisabled =
    draft.status !== "live" || draft.matchRunning || draft.half !== 1 || draft.matchRemainingMs === 0;
  const secondHalfDisabled =
    draft.status !== "live" || draft.matchRunning || draft.half !== 1 || draft.matchRemainingMs > 0;
  const isLocked = draft.status === "completed";

  return (
    <div className="operator-workspace control-panel">
      <div className="operator-top">
        <div>
          <p className="eyebrow">Match operator</p>
          <h2>Scoreboard control</h2>
        </div>
        <a className="secondary-button" href={`/display/${draft._id}`} target="_blank" rel="noopener">
          Open LED display ↗
        </a>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="control-preview">
        <div className="preview-team orange">
          <b>{draft.sideSwapped ? draft.nameB : draft.nameA}</b>
          <strong>{draft.sideSwapped ? draft.scoreB : draft.scoreA}</strong>
        </div>
        <div className="preview-middle">
          <small>{draft.half === 1 ? "1ST HALF" : "2ND HALF"}</small>
          <b>{formatClock(matchRemaining)}</b>
          <em>Raid: {Math.ceil(raidRemaining / 1000)}</em>
        </div>
        <div className="preview-team cyan">
          <b>{draft.sideSwapped ? draft.nameA : draft.nameB}</b>
          <strong>{draft.sideSwapped ? draft.scoreA : draft.scoreB}</strong>
        </div>
      </div>

      <div className="control-grid">
        <section className="control-card team-card orange">
          <h3>Team A</h3>
          <input
            value={draft.sideSwapped ? draft.nameB : draft.nameA}
            onChange={(event) => setName(draft.sideSwapped ? "nameB" : "nameA", event.target.value)}
            onBlur={() => save({ nameA: draft.nameA, nameB: draft.nameB }).catch(() => {})}
            disabled={isLocked}
          />
          <div className="score-controls">
            <button aria-label="Decrease Team A score" disabled={isLocked} onClick={() => adjust("A", -1)}>
              −
            </button>
            <strong>{draft.sideSwapped ? draft.scoreB : draft.scoreA}</strong>
            <button aria-label="Increase Team A score" disabled={isLocked} onClick={() => adjust("A", 1)}>
              +
            </button>
          </div>
        </section>
        <section className="control-card team-card cyan">
          <h3>Team B</h3>
          <input
            value={draft.sideSwapped ? draft.nameA : draft.nameB}
            onChange={(event) => setName(draft.sideSwapped ? "nameA" : "nameB", event.target.value)}
            onBlur={() => save({ nameA: draft.nameA, nameB: draft.nameB }).catch(() => {})}
            disabled={isLocked}
          />
          <div className="score-controls">
            <button aria-label="Decrease Team B score" disabled={isLocked} onClick={() => adjust("B", -1)}>
              −
            </button>
            <strong>{draft.sideSwapped ? draft.scoreA : draft.scoreB}</strong>
            <button aria-label="Increase Team B score" disabled={isLocked} onClick={() => adjust("B", 1)}>
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
          <h3>Match Clock · {draft.half === 1 ? "1st Half" : "2nd Half"}</h3>
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
          </div>
          <p className="control-note">Half buttons unlock once the match is live.</p>
        </section>

        <section className="control-card">
          <h3>Raid Clock</h3>
          <div className="button-row">
            <button className="action-button warn" disabled={draft.status !== "live"} onClick={toggleRaid}>
              {draft.raidRunning ? "Clear Raid" : "Start Raid"}
            </button>
            <button className="action-button" disabled={draft.status !== "live"} onClick={stopRaid}>
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
              {draft.status === "upcoming" ? "Save & Set Live" : "Match Live"}
            </button>
            <button className="action-button danger" disabled={busy || draft.status !== "live"} onClick={complete}>
              {draft.status === "completed" ? "Match Completed" : "Complete Match"}
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
          Status: <b>{draft.status}</b>
        </span>
      </div>
    </div>
  );
}
