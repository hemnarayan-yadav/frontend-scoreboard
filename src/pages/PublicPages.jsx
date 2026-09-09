import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { io } from "socket.io-client";
import { API, api } from "../helpers/api.js";
import { eventLabel, formatDate, phaseLabel } from "../helpers/match.js";
import {
  BackButton,
  Loading,
  SiteLayout,
} from "../components/layout/SiteLayout.jsx";
import { Scoreboard } from "../components/match/Scoreboard.jsx";

export function LivePage({ id }) {
  const [match, setMatch] = useState(null);
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const [, refresh] = useState(Date.now());
  useEffect(() => {
    api(`/api/matches/${id}`)
      .then((data) => {
        setMatch(data);
        setEvents(data.events || []);
      })
      .catch(() => {});
    const socket = io(API);
    socket.on("connect", () => {
      setConnected(true);
      socket.emit("match:join", id);
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("state:update", (next) => {
      setMatch(next);
      if (next.events) setEvents(next.events);
    });
    socket.on("events:new", (added) => {
      setEvents((current) => [
        ...current,
        ...added.filter(
          (event) =>
            !current.some((item) => item.clientEventId === event.clientEventId),
        ),
      ]);
      setMatch((current) =>
        current
          ? added.reduce(
              (next, event) => ({
                ...next,
                scoreA:
                  event.team === "A"
                    ? Math.max(0, next.scoreA + (event.points || 0))
                    : next.scoreA,
                scoreB:
                  event.team === "B"
                    ? Math.max(0, next.scoreB + (event.points || 0))
                    : next.scoreB,
              }),
              current,
            )
          : current,
      );
    });
    const timer = setInterval(() => refresh(Date.now()), 500);
    return () => {
      clearInterval(timer);
      socket.disconnect();
    };
  }, [id]);
  if (!match) return <Loading>Loading match…</Loading>;
  return (
    <SiteLayout>
      <section className="live-header">
        <BackButton />
        <div className="live-title">
          <p className="eyebrow">
            {phaseLabel(match.phase)} · Match {id.slice(0, 8)}
          </p>
          <h1>
            {match.nameA} <span>vs</span> {match.nameB}
          </h1>
          <a
            className="hero-link"
            href={`/display/${encodeURIComponent(id)}`}
            target="_blank"
            rel="noopener"
          >
            Open Big Display ↗
          </a>
        </div>
        <div className={`connection ${connected ? "on" : ""}`}>
          <i />
          {connected
            ? phaseLabel(match.phase)
            : "Reconnecting… waiting for venue"}
        </div>
      </section>
      <Scoreboard match={match} />
      <Timeline events={events} match={match} />
    </SiteLayout>
  );
}

function Timeline({ events, match }) {
  return (
    <section className="events">
      <div className="section-head">
        <div>
          <p className="eyebrow">Live feed</p>
          <h2>Match timeline</h2>
        </div>
        <span>{events.length} events</span>
      </div>
      {events.length ? (
        [...events].reverse().map((event, index) => (
          <article className="event" key={event.clientEventId || index}>
            <time>
              {event.createdAt ? formatDate(event.createdAt) : "Live"}
            </time>
            <p>{eventLabel(event, match)}</p>
            <b>{event.points > 0 ? `+${event.points}` : event.points || ""}</b>
          </article>
        ))
      ) : (
        <div className="empty">
          Events will appear here as the match unfolds.
        </div>
      )}
    </section>
  );
}

export function HistoryPage() {
  const [matches, setMatches] = useState([]);
  useEffect(() => {
    api("/api/matches?status=completed")
      .then(setMatches)
      .catch(() => {});
  }, []);
  return (
    <SiteLayout>
      <section className="page-head">
        <BackButton />
        <p className="eyebrow">The archive</p>
        <h1>Match history</h1>
        <p className="page-intro">
          Completed matches, final scores and every recorded moment.
        </p>
      </section>
      <section className="section">
        {matches.length ? (
          <div className="history-list">
            {matches.map((match) => (
              <Link
                className="history-row"
                to={`/match/${match._id}`}
                key={match._id}
              >
                <div>
                  <h3>
                    {match.nameA} <span>vs</span> {match.nameB}
                  </h3>
                  <small>
                    {formatDate(match.updatedAt || match.createdAt)} ·{" "}
                    {match.endedEarly
                      ? `Ended after ${match.half === 1 ? "1st" : "2nd"} Half`
                      : "Full time"}{" "}
                    · View match summary →
                  </small>
                </div>
                <strong>
                  {match.scoreA} <i>:</i> {match.scoreB}
                </strong>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty">Completed matches will appear here.</div>
        )}
      </section>
    </SiteLayout>
  );
}

export function FeaturesPage() {
  return (
    <SiteLayout>
      <section className="page-head">
        <BackButton />
        <p className="eyebrow">The roadmap</p>
        <h1>
          Built for
          <br />
          <em>the next raid.</em>
        </h1>
        <p className="page-intro">
          KabaddiLive will grow with the communities, organizers and players who
          make the game.
        </p>
      </section>
      <section className="feature-grid">
        <article>
          <span>01</span>
          <h2>Team profiles</h2>
          <p>
            Follow your team, see their results and keep their season together
            in one place.
          </p>
        </article>
        <article>
          <span>02</span>
          <h2>Tournaments</h2>
          <p>
            Fixtures, standings and live coverage for every local competition.
          </p>
        </article>
        <article>
          <span>03</span>
          <h2>Player stories</h2>
          <p>
            Celebrate the people and moments that make every match worth
            watching.
          </p>
        </article>
      </section>
    </SiteLayout>
  );
}

export function DetailPage({ id }) {
  const [match, setMatch] = useState(null);
  useEffect(() => {
    api(`/api/matches/${id}`)
      .then(setMatch)
      .catch(() => {});
  }, [id]);
  if (!match) return <Loading>Loading match…</Loading>;
  return (
    <SiteLayout>
      <section className="page-head">
        <BackButton />
        <p className="eyebrow">
          Final result · {formatDate(match.updatedAt || match.createdAt)}
        </p>
        <h1>
          {match.nameA} <span>vs</span> {match.nameB}
        </h1>
      </section>
      <Scoreboard match={match} />
      <Timeline events={match.events} match={match} />
    </SiteLayout>
  );
}
