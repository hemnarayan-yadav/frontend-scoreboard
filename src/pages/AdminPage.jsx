import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api, jsonOptions } from "../helpers/api.js";
import { blankMatch, phaseLabel } from "../helpers/match.js";
import { Loading, SiteLayout } from "../components/layout/SiteLayout.jsx";
import ControlPanel from "../components/admin/ControlPanel.jsx";
import AdminUsers from "../components/admin/AdminUsers.jsx";
import "../styles/admin.css";

export default function AdminPage() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user)
      api("/api/matches")
        .then(setMatches)
        .catch(() => setMatches([]));
  }, [user]);

  if (loading) return <Loading>Checking admin access…</Loading>;
  if (!user) {
    navigate("/login", { replace: true });
    return null;
  }

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
    setSelected(next);
    setMatches(matches.map((item) => (item._id === next._id ? next : item)));
  }

  return (
    <SiteLayout>
      <section className="admin-page dashboard-page">
        <div className="admin-dashboard-head">
          <div>
            <p className="eyebrow">
              {user.name} · {user.role.replace("_", " ")}
            </p>
            <h1>Venue control</h1>
            <p className="page-intro">Run every mat from one professional workspace.</p>
          </div>
          <button className="text-button" onClick={() => logout().then(() => navigate("/"))}>
            Sign out
          </button>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="admin-toolbar">
          <button className="primary-button" disabled={creating} onClick={newMatch}>
            {creating ? "Creating…" : "+ New match"}
          </button>
          {user.role === "super_admin" && (
            <a className="secondary-button" href="#operators">
              Manage operators
            </a>
          )}
        </div>
        <div className="admin-layout">
          <aside className="match-sidebar">
            <h3>Your matches</h3>
            {matches.map((match) => (
              <button
                className={selected?._id === match._id ? "match-select active" : "match-select"}
                key={match._id}
                onClick={() => setSelected(match)}
              >
                <span>
                  {match.nameA} vs {match.nameB}
                </span>
                <small>
                  {phaseLabel(match.phase)} · {match.scoreA}:{match.scoreB}
                </small>
              </button>
            ))}
            {!matches.length && <p className="empty">Create your first match.</p>}
          </aside>
          <section>
            {selected ? (
              <ControlPanel match={selected} onChange={updateMatch} />
            ) : (
              <div className="admin-empty">
                <strong>Select a match to begin</strong>
                <p>Create a match, set the teams, then open the public display on any LED screen.</p>
              </div>
            )}
          </section>
        </div>
        {user.role === "super_admin" && (
          <div id="operators">
            <AdminUsers />
          </div>
        )}
      </section>
    </SiteLayout>
  );
}