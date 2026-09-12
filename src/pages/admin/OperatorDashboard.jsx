import { useEffect, useState } from "react";
import { api, jsonOptions } from "../../helpers/api.js";
import { blankMatch, phaseLabel } from "../../helpers/match.js";
import ControlPanel from "../../components/admin/ControlPanel.jsx";

export default function OperatorDashboard() {
  const [matches, setMatches] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/matches")
      .then((data) => {
        setMatches(data);
        setLoaded(true);
      })
      .catch(() => {
        setMatches([]);
        setLoaded(true);
      });
  }, []);

  async function newMatch() {
    if (creating) return;
    setCreating(true);
    setError("");
    try {
      const match = blankMatch();
      const saved = await api(`/api/matches/${match._id}/state`, jsonOptions("PUT", { state: match }));
      setMatches([saved, ...matches]);
      setSelected(saved);
    } catch (err) {
      setError(err.message || "Couldn't create a new match.");
    } finally {
      setCreating(false);
    }
  }

  function updateMatch(next) {
    setSelected((current) =>
      current?._id === next._id && (current.version || 0) > (next.version || 0) ? current : next,
    );
    setMatches((current) =>
      current.map((item) =>
        item._id === next._id && (item.version || 0) <= (next.version || 0) ? next : item,
      ),
    );
  }

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <h1>Matches</h1>
          <p>Create a match, run the clock, and hand the display to the venue screen.</p>
        </div>
        <button className="btn btn-primary" disabled={creating} onClick={newMatch}>
          {creating ? "Creating…" : "New match"}
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="operator-layout">
        <aside className="list-panel">
          <h2>Your matches</h2>
          {!loaded ? (
            <p className="panel-empty">Loading…</p>
          ) : matches.length ? (
            <ul className="match-list">
              {matches.map((match) => (
                <li key={match._id}>
                  <button
                    className={selected?._id === match._id ? "match-row is-selected" : "match-row"}
                    onClick={() => setSelected(match)}
                  >
                    <span className="match-row-teams">
                      {match.nameA} <i>vs</i> {match.nameB}
                    </span>
                    <span className={`status-pill is-${match.phase}`}>{phaseLabel(match.phase)}</span>
                    <span className="match-row-score">
                      {match.scoreA}–{match.scoreB}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel-empty">No matches yet — create your first one to get started.</p>
          )}
        </aside>

        <section className="panel-slot">
          {selected ? (
            <ControlPanel match={selected} onChange={updateMatch} />
          ) : (
            <div className="panel-placeholder">
              <strong>Select a match to begin</strong>
              <p>Create a match, set the teams, then open the display on the venue screen.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
