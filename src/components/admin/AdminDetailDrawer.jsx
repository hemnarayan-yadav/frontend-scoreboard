import { useEffect, useState } from "react";
import { api, jsonOptions } from "../../helpers/api.js";
import { formatDate } from "../../helpers/match.js";

export function AdminDetailDrawer({ adminId, onClose, onChanged }) {
  const [data, setData] = useState(null); // null = loading, false = error, object = loaded
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setData(null);
    api(`/api/auth/users/${adminId}`)
      .then(setData)
      .catch(() => setData(false));
  }, [adminId]);

  async function toggleActive() {
    if (!data) return;
    setBusy(true);
    try {
      const updated = await api(
        `/api/auth/users/${adminId}/status`,
        jsonOptions("PATCH", { active: !data.user.active }),
      );
      setData({ ...data, user: updated.user });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-head">
          <h2>Admin details</h2>
          <button className="drawer-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {data === null && <p className="panel-empty">Loading…</p>}
        {data === false && <p className="panel-empty">Couldn't load this admin.</p>}

        {data && (
          <>
            <div className="drawer-identity">
              <strong>{data.user.name}</strong>
              <span className="muted">{data.user.email}</span>
              <span className="muted">Joined {formatDate(data.user.createdAt)}</span>
            </div>

            <div className="stat-row">
              <div className="stat-tile">
                <b>{data.stats.total}</b>
                <span>Matches run</span>
              </div>
              <div className="stat-tile">
                <b>{data.stats.live}</b>
                <span>Currently live</span>
              </div>
              <div className="stat-tile">
                <b>{data.stats.completed}</b>
                <span>Completed</span>
              </div>
            </div>

            <button
              className={data.user.active ? "btn btn-danger btn-block" : "btn btn-primary btn-block"}
              disabled={busy}
              onClick={toggleActive}
            >
              {busy ? "Saving…" : data.user.active ? "Deactivate account" : "Activate account"}
            </button>
          </>
        )}
      </aside>
    </div>
  );
}