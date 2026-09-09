import { Link, useNavigate } from "react-router-dom";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="brand-lockup" to="/">
        <span className="brand-mark">K</span>
        <span className="brand-name">
          Kabaddi<span>Live</span>
        </span>
      </Link>
      <nav className="site-nav">
        <Link to="/">Live matches</Link>
        <Link to="/history">History</Link>
        <Link to="/features">Upcoming features</Link>
        <Link to="/admin">Admin</Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <Link className="brand-lockup" to="/">
          <span className="brand-mark">K</span>
          <span className="brand-name">
            Kabaddi<span>Live</span>
          </span>
        </Link>
        <p>Live kabaddi, connected to every mat.</p>
      </div>
      <div className="footer-links">
        <Link to="/">Live matches</Link>
        <Link to="/history">History</Link>
        <Link to="/features">Upcoming features</Link>
      </div>
      <small>© 2026 KabaddiLive. Built for the game.</small>
    </footer>
  );
}

export function SiteLayout({ children }) {
  return (
    <main>
      <SiteHeader />
      {children}
      <SiteFooter />
    </main>
  );
}
export function BackButton() {
  const navigate = useNavigate();
  return (
    <button className="back-button" onClick={() => navigate(-1)}>
      ← <span>Back</span>
    </button>
  );
}
export function Loading({ children = "Loading…" }) {
  return (
    <SiteLayout>
      <div className="loading">{children}</div>
    </SiteLayout>
  );
}
