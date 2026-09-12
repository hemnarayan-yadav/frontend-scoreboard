import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { API, api } from "../helpers/api.js";

// Mirrors MAX_STORED_EVENTS in the backend's Match model. Without this, a
// browser tab left open for a whole tournament day would grow `events`
// (and the rendered Timeline list) without bound even though the server's
// own copy is capped — same reasoning, same number, kept in sync.
const MAX_TRACKED_EVENTS = 300;

// Shared by every screen that needs a live-synced match: fetches the
// current state once, joins the match's socket.io room, and applies
// `state:update` / `events:new` as they arrive.
//
// LivePage and DisplayPage used to hand-roll this same connect/fetch/listen
// sequence independently, with small, easy-to-miss differences between
// the two copies (see CHANGES: DisplayPage never subscribed to events, and
// the score-tallying that LivePage did from `events:new` duplicated what
// `state:update` already delivers — removed here, since events are purely
// a timeline log and scores flow from state:update only).
export function useLiveMatch(id) {
  const [match, setMatch] = useState(null);
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const seenEventIds = useRef(new Set());

  useEffect(() => {
    let cancelled = false;
    setMatch(null);
    setEvents([]);
    seenEventIds.current = new Set();

    api(`/api/matches/${id}`)
      .then((data) => {
        if (cancelled) return;
        setMatch(data);
        setEvents(data.events || []);
        seenEventIds.current = new Set((data.events || []).map((event) => event.clientEventId));
      })
      .catch(() => {});

    const socket = io(API);
    socket.on("connect", () => {
      setConnected(true);
      socket.emit("match:join", id);
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("state:update", (next) =>
      setMatch((current) => (!current || (current.version || 0) <= (next.version || 0) ? next : current)),
    );
    socket.on("events:new", (added) => {
      const fresh = added.filter((event) => !seenEventIds.current.has(event.clientEventId));
      if (!fresh.length) return;
      fresh.forEach((event) => seenEventIds.current.add(event.clientEventId));
      setEvents((current) => [...current, ...fresh].slice(-MAX_TRACKED_EVENTS));
    });

    return () => {
      cancelled = true;
      socket.disconnect();
    };
  }, [id]);

  return { match, events, connected };
}
