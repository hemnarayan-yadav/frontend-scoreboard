import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../helpers/api.js";
import { displayedSides, phaseLabel } from "../helpers/match.js";
import { SiteLayout } from "../components/layout/SiteLayout.jsx";

export default function HomePage() {
  const [matches, setMatches] = useState([]);
  useEffect(() => {
    const load = () =>
      api("/api/matches")
        .then((all) =>
          setMatches(
            all.filter(
              (match) => match.phase === "live" || match.phase === "break",
            ),
          ),
        )
        .catch(() => setMatches([]));
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, []);
  return (
    <SiteLayout>
      <section className="hero">
        <div>
          <p className="eyebrow">Live scoreboard</p>
          <h1>
            The game,
            <br />
            <em>as it happens.</em>
          </h1>
          <p className="intro">
            Follow every raid, point and final whistle from the mat.
          </p>
        </div>
        <Link className="hero-link" to="/history">
          Explore match history →
        </Link>
      </section>
      <section className="section live-section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Right now</p>
            <h2>Live matches</h2>
          </div>
          <span>
            {matches.length} match{matches.length === 1 ? "" : "es"}
          </span>
        </div>
        {matches.length ? (
          <div className="match-list">
            {matches.map((match) => {
              const { left, right } = displayedSides(match);
              return (
                <Link
                  className="match-card"
                  to={`/live/${match._id}`}
                  key={match._id}
                >
                  <div>
                    <span
                      className={`live-dot ${match.phase === "break" ? "break-dot" : ""}`}
                    >
                      {phaseLabel(match.phase)}
                    </span>
                    <h3>
                      {match[`name${left}`]} <b>vs</b> {match[`name${right}`]}
                    </h3>
                    <small>
                      Half {match.half || 1} ·{" "}
                      {match.phase === "break"
                        ? "Break in progress"
                        : "Follow live score"}
                    </small>
                  </div>
                  <div className="mini-score">
                    <strong>{match[`score${left}`]}</strong>
                    <i>:</i>
                    <strong>{match[`score${right}`]}</strong>
                    <span>View match →</span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="empty">
            No live matches at the moment.
            <br />
            <Link to="/history">Browse completed matches</Link>
          </div>
        )}
      </section>
      <section className="feature-strip">
        <div>
          <p className="eyebrow">Built for what comes next</p>
          <h2>
            More of the game,
            <br />
            <em>coming soon.</em>
          </h2>
        </div>
        <Link to="/features">See the roadmap →</Link>
      </section>
    </SiteLayout>
  );
}
