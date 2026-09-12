import { Link } from "react-router-dom";

// The admin console gets its own, minimal chrome instead of the public
// SiteLayout. A control room doesn't need "Live matches / History /
// Upcoming features" in its nav — that's marketing-site furniture, and it
// doesn't belong inside the tool the operators actually work in.
export function DashboardShell({ user, onSignOut, children }) {
  return (
    <div className="console">
      <header className="console-bar">
        <Link className="console-brand" to="/">
          <span className="console-mark">K</span>
          <span className="console-brand-name">
            KabaddiLive <b>Console</b>
          </span>
        </Link>
        <div className="console-identity">
          <div className="console-who">
            <strong>{user.name}</strong>
            {user.role === "super_admin" && <span className="console-role">Super Admin</span>}
          </div>
          <button className="btn btn-ghost console-signout" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>
      <main className="console-body">{children}</main>
    </div>
  );
}