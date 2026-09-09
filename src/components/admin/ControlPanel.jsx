import { useEffect, useState } from "react";
import { api, jsonOptions } from "../../helpers/api.js";
import { formatClock } from "../../helpers/match.js";

export default function ControlPanel({ match, onChange }) {
  const [draft, setDraft] = useState(match);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => setDraft(match), [match._id, match.version]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (
      !busy &&
      draft.matchRunning &&
      draft.matchEndAt &&
      remaining(draft.matchEndAt, 0) === 0
    ) {
      save({
        matchRunning: false,
        matchEndAt: null,
        matchRemainingMs: 0,
        overlayText: draft.half === 1 ? "HALF TIME" : "FULL TIME",
      });
    }
    if (
      !busy &&
      draft.raidRunning &&
      draft.raidEndAt &&
      remaining(draft.raidEndAt, 0) === 0
    ) {
      save({ raidRunning: false, raidEndAt: null, raidRemainingMs: 0 });
    }
  }, [
    now,
    draft.matchRunning,
    draft.matchEndAt,
    draft.raidRunning,
    draft.raidEndAt,
    busy,
  ]);

  async function save(next) {
    setBusy(true);
    try {
      const saved = await api(
        `/api/matches/${draft._id}/state`,
        jsonOptions("PUT", {
          state: { ...draft, ...next, version: (draft.version || 0) + 1 },
        }),
      );
      setDraft(saved);
      onChange(saved);
    } finally {
      setBusy(false);
    }
  }

  function remaining(endAt, fallback) {
    return endAt
      ? Math.max(0, new Date(endAt).getTime() - now)
      : Number(fallback || 0);
  }

  function adjust(team, amount) {
    const side = draft.sideSwapped ? (team === "A" ? "B" : "A") : team;
    save({
      [`score${side}`]: Math.max(
        0,
        Number(draft[`score${side}`] || 0) + amount,
      ),
      status: "live",
      phase: "live",
    });
  }

  function setName(field, value) {
    setDraft({ ...draft, [field]: value });
  }

  function startHalf(half) {
    if (draft.status === "completed" || draft.matchRunning) return;
    save({
      half,
      sideSwapped: half === 2,
      status: "live",
      phase: "live",
      matchRunning: true,
      matchRemainingMs: draft.halfDurationMs,
      matchEndAt: new Date(Date.now() + draft.halfDurationMs).toISOString(),
      raidRunning: false,
      raidEndAt: null,
      raidRemainingMs: draft.raidDurationMs,
      overlayText: null,
    });
  }

  function toggleRaid() {
    if (draft.status === "completed") return;
    save(
      draft.raidRunning
        ? {
            raidRunning: false,
            raidEndAt: null,
            raidRemainingMs: draft.raidDurationMs,
          }
        : {
            raidRunning: true,
            raidEndAt: new Date(
              Date.now() + draft.raidDurationMs,
            ).toISOString(),
            raidRemainingMs: draft.raidDurationMs,
          },
    );
  }

  function stopRaid() {
    save({
      raidRunning: false,
      raidEndAt: null,
      raidRemainingMs: draft.raidDurationMs,
    });
  }

  async function complete() {
    const saved = await api(
      `/api/matches/${draft._id}/complete`,
      jsonOptions("POST", {}),
    );
    setDraft(saved);
    onChange(saved);
  }

  const matchRemaining = remaining(
    draft.matchRunning ? draft.matchEndAt : null,
    draft.matchRemainingMs,
  );
  const raidRemaining = remaining(
    draft.raidRunning ? draft.raidEndAt : null,
    draft.raidRemainingMs,
  );
  const firstHalfDisabled =
    draft.status !== "live" ||
    draft.matchRunning ||
    draft.half !== 1 ||
    draft.matchRemainingMs === 0;
  const secondHalfDisabled =
    draft.status !== "live" ||
    draft.matchRunning ||
    draft.half !== 1 ||
    draft.matchRemainingMs > 0;

  return (
    <div className="operator-workspace control-panel">
      <div className="operator-top">
        <div>
          <p className="eyebrow">Match operator</p>
          <h2>Scoreboard control</h2>
        </div>
        <a
          className="secondary-button"
          href={`/display/${draft._id}`}
          target="_blank"
          rel="noopener"
        >
          Open LED display ↗
        </a>
      </div>

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
            onChange={(event) =>
              setName(draft.sideSwapped ? "nameB" : "nameA", event.target.value)
            }
            onBlur={() => save({ nameA: draft.nameA, nameB: draft.nameB })}
          />
          <div className="score-controls">
            <button
              aria-label="Decrease Team A score"
              onClick={() => adjust("A", -1)}
            >
              −
            </button>
            <strong>{draft.sideSwapped ? draft.scoreB : draft.scoreA}</strong>
            <button
              aria-label="Increase Team A score"
              onClick={() => adjust("A", 1)}
            >
              +
            </button>
          </div>
        </section>
        <section className="control-card team-card cyan">
          <h3>Team B</h3>
          <input
            value={draft.sideSwapped ? draft.nameA : draft.nameB}
            onChange={(event) =>
              setName(draft.sideSwapped ? "nameA" : "nameB", event.target.value)
            }
            onBlur={() => save({ nameA: draft.nameA, nameB: draft.nameB })}
          />
          <div className="score-controls">
            <button
              aria-label="Decrease Team B score"
              onClick={() => adjust("B", -1)}
            >
              −
            </button>
            <strong>{draft.sideSwapped ? draft.scoreA : draft.scoreB}</strong>
            <button
              aria-label="Increase Team B score"
              onClick={() => adjust("B", 1)}
            >
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
                value={Math.round(draft.halfDurationMs / 60000)}
                onChange={(event) => {
                  const minutes = Math.max(
                    1,
                    Math.min(60, Number(event.target.value) || 20),
                  );
                  setDraft({
                    ...draft,
                    halfDurationMs: minutes * 60000,
                    matchRemainingMs: draft.matchRunning
                      ? draft.matchRemainingMs
                      : minutes * 60000,
                  });
                }}
                onBlur={() =>
                  save({
                    halfDurationMs: draft.halfDurationMs,
                    matchRemainingMs: draft.matchRemainingMs,
                  })
                }
              />
            </label>
            <label>
              Raid time
              <input value="30 sec" readOnly />
            </label>
          </div>
        </section>
        <section className="control-card">
          <h3>Match Clock · {draft.half === 1 ? "1st Half" : "2nd Half"}</h3>
          <div className="button-row">
            <button
              className={
                draft.matchRunning && draft.half === 1
                  ? "action-button active"
                  : "action-button"
              }
              disabled={firstHalfDisabled}
              onClick={() => startHalf(1)}
            >
              Start 1st Half
            </button>
            <button
              className={
                draft.matchRunning && draft.half === 2
                  ? "action-button active"
                  : "action-button"
              }
              disabled={secondHalfDisabled}
              onClick={() => startHalf(2)}
            >
              Start 2nd Half
            </button>
          </div>
          <p className="control-note">
            Set Live karke match public live list me dikhega.
          </p>
        </section>
        <section className="control-card">
          <h3>Raid Clock</h3>
          <div className="button-row">
            <button
              className="action-button warn"
              disabled={draft.status === "completed"}
              onClick={toggleRaid}
            >
              {draft.raidRunning ? "Clear Raid" : "Start Raid"}
            </button>
            <button className="action-button" onClick={stopRaid}>
              Stop Raid
            </button>
          </div>
        </section>
        <section className="control-card">
          <h3>Match Status</h3>
          <div className="button-row">
            <button
              className="action-button primary"
              disabled={busy || draft.status === "completed"}
              onClick={() => save({ status: "live", phase: "live" })}
            >
              Save &amp; Set Live
            </button>
            <button
              className="action-button danger"
              disabled={busy || draft.status === "completed"}
              onClick={complete}
            >
              Complete Match
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
