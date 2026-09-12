import { useEffect, useState } from "react";
import { api, jsonOptions } from "../../helpers/api.js";
import { AdminDetailDrawer } from "../../components/admin/AdminDetailDrawer.jsx";

export default function SuperAdminDashboard() {
  const [admins, setAdmins] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  function loadAdmins() {
    api("/api/auth/users")
      .then((data) => {
        setAdmins(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }
  useEffect(loadAdmins, []);

  async function createAdmin(event) {
    event.preventDefault();
    setCreating(true);
    setError("");
    try {
      // Always created as "admin" — this console doesn't offer a way to
      // mint another super admin from the UI, which is the safer default.
      await api("/api/auth/users", jsonOptions("POST", { ...form, role: "admin" }));
      setForm({ name: "", email: "", password: "" });
      loadAdmins();
    } catch (err) {
      setError(err.message || "Couldn't create the admin.");
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(admin) {
    try {
      const updated = await api(
        `/api/auth/users/${admin.id}/status`,
        jsonOptions("PATCH", { active: !admin.active }),
      );
      setAdmins((current) =>
        current.map((item) => (item.id === admin.id ? { ...item, active: updated.user.active } : item)),
      );
    } catch {
      /* the row just won't have changed — no need for a toast on a console page */
    }
  }

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <h1>Admins</h1>
          <p>Create operator accounts and control who can run matches.</p>
        </div>
      </div>

      <div className="superadmin-layout">
        <section className="table-panel">
          {!loaded ? (
            <p className="panel-empty">Loading…</p>
          ) : admins.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Matches run</th>
                  <th>Status</th>
                  <th aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {admins.map((admin) => (
                  <tr
                    key={admin.id}
                    className={selectedId === admin.id ? "is-selected" : ""}
                    onClick={() => setSelectedId(admin.id)}
                  >
                    <td className="data-table-primary">{admin.name}</td>
                    <td className="muted">{admin.email}</td>
                    <td>{admin.matchCount}</td>
                    <td>
                      <span className={`status-pill ${admin.active ? "is-active" : "is-inactive"}`}>
                        {admin.active ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td className="data-table-actions">
                      <button
                        className={admin.active ? "btn btn-ghost btn-danger" : "btn btn-ghost"}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleActive(admin);
                        }}
                      >
                        {admin.active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="panel-empty">No admins yet — create the first one.</p>
          )}
        </section>

        <aside className="create-panel">
          <h2>New admin</h2>
          <form className="stack-form" onSubmit={createAdmin}>
            <label>
              Full name
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </label>
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                required
              />
            </label>
            <label>
              Temporary password
              <input
                type="password"
                minLength={8}
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                required
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <button className="btn btn-primary btn-block" disabled={creating}>
              {creating ? "Creating…" : "Create admin"}
            </button>
          </form>
        </aside>
      </div>

      {selectedId && (
        <AdminDetailDrawer adminId={selectedId} onClose={() => setSelectedId(null)} onChanged={loadAdmins} />
      )}
    </div>
  );
}
